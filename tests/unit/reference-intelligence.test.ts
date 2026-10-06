/**
 * PI-4 — Reference Intelligence: references, claims and evidence. The real dataset is checked for
 * honesty (verified only when read, no invented URL, pending never used as evidence); the reasoning
 * (scope, jurisdiction, time, corroboration by independent families, conflicts, data needs) is checked on
 * a SYNTHETIC dataset that lives only in this test (clearly fictitious publishers, example.org URLs).
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { CATEGORY_KNOWLEDGE, CODEX_PREPACKAGED_LABELLING, UN_GHS } from "@/lib/intelligence/category";
import { archetypeById, provenanceIssues, withUserFacts } from "@/lib/intelligence/taxonomy";
import { inferDesignGrammar } from "@/lib/intelligence/grammar";
import { resolvePackaging } from "@/lib/catalog/packagingResolver";
import {
  CLAIMS, REFERENCES, REFERENCE_DATASET_VERSION, assessClaim, claimIssues, contextFromProductIntelligence, datasetIssues, duplicateReferences, getClaimsForKnowledge,
  getEvidenceForCategory, getEvidenceForClaim, getEvidenceForKnowledge, getReference, getReferenceByLegacyId, getReferencesByJurisdiction, getReferencesByType,
  getReferencesForCategory, getSupportedKnowledge, normalizeUrl, referenceIssues, shadowReferenceEvidence, sourceQuality,
  type Reference, type ReferenceClaim, type ReferenceDataset,
} from "@/lib/intelligence/reference";

const DIR = "src/lib/intelligence/reference";
const EU = { jurisdictions: ["EU", "Belgium"] as const };
const CM = { jurisdictions: ["Cameroon", "CEMAC"] as const };

// ── Synthetic dataset (tests only) ───────────────────────────────────────────
const ref = (id: string, x: Partial<Reference>): Reference => ({
  id, title: `Fictitious ${id}`, sourceType: "academic", publisher: `Test publisher ${id}`, sourceFamily: id, jurisdiction: "global", scope: "test", status: "verified",
  url: `https://example.org/${id.replace(/\./g, "/")}`, verification: { method: "officialPageRead", checkedAt: "2026-01-01", note: "synthetic" }, ...x,
});
const claim = (id: string, referenceId: string, x: Partial<ReferenceClaim> = {}): ReferenceClaim => ({
  id, referenceId, knowledgeId: "haircare.conv.variantByNeed", categoryIds: ["haircare"], productCategories: ["cosmetics"], claimType: "categoryConvention",
  relation: "supports", claim: "synthetic claim", jurisdiction: "global", evidence: { kind: "primaryText", note: "synthetic" }, ...x,
});
const TEST: ReferenceDataset = {
  references: [
    ref("ref.test.academic", { sourceType: "academic", sourceFamily: "uni-a" }),
    ref("ref.test.academic_same_family", { sourceType: "academic", sourceFamily: "uni-a" }),
    ref("ref.test.market", { sourceType: "market", sourceFamily: "panel-b", jurisdiction: "Belgium" }),
    ref("ref.test.expert", { sourceType: "expert", sourceFamily: "expert-c" }),
    ref("ref.test.old", { sourceType: "professional", sourceFamily: "assoc-d", validUntil: "2020-12-31" }),
    ref("ref.test.contra", { sourceType: "professional", sourceFamily: "assoc-e" }),
    ref("ref.test.pending", { sourceType: "academic", sourceFamily: "uni-f", status: "pendingVerification", url: undefined, verification: { method: "searchSummaryOnly", note: "synthetic" } }),
    ref("ref.test.internal", { sourceType: "internal", sourceFamily: "edify", status: "archived", url: undefined, verification: { method: "notVerified", note: "synthetic" } }),
  ],
  claims: [
    // two claims of the SAME family: one source, not corroboration
    claim("claim.test.academicOne", "ref.test.academic", { claimType: "consumerExpectation" }),
    claim("claim.test.academicTwo", "ref.test.academic_same_family", { claimType: "consumerExpectation" }),
    // market observation (Belgium) on another item
    claim("claim.test.market", "ref.test.market", { knowledgeId: "haircare.conv.rangeSystem", claimType: "shelfObservation", jurisdiction: "Belgium" }),
    // expert + academic = two families on a third item
    claim("claim.test.expertA", "ref.test.expert", { knowledgeId: "haircare.trust.oneBenefit", claimType: "trustSignal" }),
    claim("claim.test.academicB", "ref.test.academic", { knowledgeId: "haircare.trust.oneBenefit", claimType: "consumerExpectation" }),
    // outdated
    claim("claim.test.old", "ref.test.old", { knowledgeId: "haircare.conv.heroIngredient", claimType: "packagingPractice" }),
    // contradiction in the same scope
    claim("claim.test.pro", "ref.test.expert", { knowledgeId: "haircare.pit.badgeOverload", claimType: "packagingPractice" }),
    claim("claim.test.contra", "ref.test.contra", { knowledgeId: "haircare.pit.badgeOverload", claimType: "packagingPractice", relation: "contradicts" }),
    // contradiction explained by jurisdiction
    claim("claim.test.proEU", "ref.test.expert", { knowledgeId: "haircare.pit.results", claimType: "packagingPractice" }),
    claim("claim.test.contraOld", "ref.test.contra", { knowledgeId: "haircare.pit.results", claimType: "packagingPractice", relation: "contradicts", validUntil: "2019-12-31" }),
    // pending and internal
    claim("claim.test.pending", "ref.test.pending", { knowledgeId: "haircare.pit.fakeScience" }),
    claim("claim.test.internal", "ref.test.internal", { knowledgeId: "haircare.diff.lookalike" }),
  ],
};

describe("A–D. références et claims", () => {
  it("A. le jeu de données réel est valide (vocabulaire, URL lues seulement, ids PI-3, pas de doublon)", () => {
    expect(datasetIssues()).toEqual([]);
    expect(REFERENCE_DATASET_VERSION).toMatch(/^pi4-\d{4}\.\d{2}\.\d{2}$/);
  });

  it("B. une référence invalide est rejetée (verified sans lecture, URL non lue, type inconnu)", () => {
    const bad: Reference = { ...REFERENCES[0], id: "Ref Bad", status: "verified", url: "http://Example.org/a/", sourceType: "blog" as never, verification: { method: "searchSummaryOnly", note: "" } };
    const issues = referenceIssues(bad).join("\n");
    for (const w of ["id", "sourceType", "verified", "url", "verification.note"]) expect(issues).toContain(w);
  });

  it("C. chaque claim pointe une référence et un id PI-3 existants, de la bonne catégorie", () => {
    const knowledgeIds = new Set(CATEGORY_KNOWLEDGE.flatMap((k) => k.items.map((i) => i.id)));
    for (const c of CLAIMS) {
      expect(getReference(c.referenceId), c.id).toBeDefined();
      if (c.knowledgeId) expect(knowledgeIds.has(c.knowledgeId), c.id).toBe(true);
    }
    expect(getClaimsForKnowledge("prepackaged.codex.mandatory").map((c) => c.id)).toEqual(expect.arrayContaining(["claim.prepackaged.codex.mandatory", "claim.prepackaged.eu.mandatory"]));
    expect(claimIssues({ ...CLAIMS[0], knowledgeId: "haircare.conv.variantByNeed" }).join()).toMatch(/must include the knowledge's category/);
  });

  it("D. un claim sans référence (ou vers un id PI-3 inventé) est rejeté", () => {
    expect(claimIssues({ ...CLAIMS[0], referenceId: "ref.nowhere" }).join()).toMatch(/unknown reference/);
    expect(claimIssues({ ...CLAIMS[0], knowledgeId: "haircare.trust.01-copy" }).join()).toMatch(/not a PI-3 knowledge id/);
    expect(claimIssues({ ...CLAIMS[0], claim: "x".repeat(400) }).join()).toMatch(/not a quotation/);
  });
});

describe("E–L. portée, temps, sources multiples, conflits, types de sources", () => {
  it("E. hors périmètre : un claim UE ne vaut pas pour le Cameroun ; sans marché connu il reste « unconfirmed »", () => {
    const eu = CLAIMS.find((c) => c.id === "claim.prepackaged.eu.mandatory")!;
    expect(assessClaim(eu, CM).applicability).toBe("outOfScope");
    expect(assessClaim(eu, EU)).toMatchObject({ applicability: "inScope" });
    expect(assessClaim(eu, {})).toMatchObject({ applicability: "unconfirmed", confidence: "low" });
    expect(assessClaim(eu, { productCategory: "cosmetics" }).applicability).toBe("outOfScope");
    expect(getEvidenceForKnowledge("localbev.conv.storage", CM).dataNeeds).toContain("missingRegulatoryContext");
  });

  it("F. obsolète : une référence expirée ne soutient plus rien", () => {
    const e = getEvidenceForKnowledge("haircare.conv.heroIngredient", {}, TEST);
    expect(e).toMatchObject({ evidenceStatus: "outdated", confidence: "unknown" });
    expect(e.dataNeeds).toContain("outdatedReference");
    // a claim valid only from a future date is not yet in scope
    expect(assessClaim(CLAIMS.find((c) => c.id === "claim.prepackaged.codex.allergens2024")!, { asOf: "2024-01-01" }).applicability).toBe("outOfScope");
  });

  it("G. sources multiples : deux pages d'une même famille = une source ; deux familles indépendantes = corroboration", () => {
    const same = getEvidenceForKnowledge("haircare.conv.variantByNeed", {}, TEST);
    expect(same).toMatchObject({ evidenceStatus: "supported", independentSources: 1 });
    const two = getEvidenceForKnowledge("haircare.trust.oneBenefit", {}, TEST);
    expect(two).toMatchObject({ evidenceStatus: "corroborated", independentSources: 2, maturity: "stronglySupported" });
    // real dataset: FAO, WHO and Codex are one family
    expect(getEvidenceForKnowledge("prepackaged.codex.mandatory").independentSources).toBe(1);
    expect(getEvidenceForKnowledge("prepackaged.codex.mandatory", EU)).toMatchObject({ evidenceStatus: "corroborated", independentSources: 2 });
  });

  it("H. sources contradictoires : état « conflicting », aucune n'est choisie ; une contradiction d'une autre période n'en est pas une", () => {
    const c = getEvidenceForKnowledge("haircare.pit.badgeOverload", {}, TEST);
    expect(c).toMatchObject({ evidenceStatus: "conflicting", confidence: "low" });
    expect(c.conflicts[0]).toMatchObject({ kind: "conflicting" });
    expect(c.dataNeeds).toContain("conflictingSources");
    const p = getEvidenceForKnowledge("haircare.pit.results", {}, TEST);
    expect(p.evidenceStatus).not.toBe("conflicting");
    expect(p.conflicts[0].kind).toBe("differentPeriod");
  });

  it("I. réglementaire : fort pour une exigence d'étiquetage, faible pour l'esthétique ; jamais une garantie", () => {
    expect(sourceQuality("regulatory", "labelingRequirement")).toBe("high");
    expect(sourceQuality("regulatory", "visualConvention")).toBe("low");
    const e = getEvidenceForKnowledge("prepackaged.codex.mandatory", EU);
    expect(e.disclaimer).toMatch(/ni un avis juridique ni une garantie/);
    expect(JSON.stringify(REFERENCES)).not.toMatch(/garanti|guarantee/i);
  });

  it("J-K-L. académique, marché, interne : chacun pour ce qu'il peut prouver", () => {
    expect(sourceQuality("academic", "consumerExpectation")).toBe("high");
    expect(sourceQuality("academic", "labelingRequirement")).toBe("low");
    expect(sourceQuality("market", "shelfObservation")).toBe("medium");
    expect(sourceQuality("market", "regulatoryRequirement")).toBe("low");
    const market = getEvidenceForKnowledge("haircare.conv.rangeSystem", { jurisdictions: ["Belgium"] }, TEST);
    expect(market).toMatchObject({ evidenceStatus: "singleSource", maturity: "observed" }); // an observation, not a rule
    expect(getEvidenceForKnowledge("haircare.conv.rangeSystem", CM, TEST).evidenceStatus).toBe("outOfScope"); // Belgium ≠ Cameroon
    expect(sourceQuality("internal", "categoryConvention")).toBe("low");
    expect(getEvidenceForKnowledge("haircare.diff.lookalike", {}, TEST).evidenceStatus).toBe("outdated"); // an archived internal note supports nothing
    expect(getEvidenceForKnowledge("haircare.conv.variantByNeed").maturity).toBe("internal"); // real dataset: no source yet
    expect(getEvidenceForKnowledge("haircare.diff.modernPremium").maturity).toBe("inferred");
  });
});

describe("M–Q. confiance, provenance, besoins de données, filtres", () => {
  it("M. propagation de la confiance : résumé secondaire ≤ medium, international ≤ medium, corroboration en périmètre = high", () => {
    const codex = assessClaim(CLAIMS.find((c) => c.id === "claim.prepackaged.codex.mandatory")!, {});
    expect(codex).toMatchObject({ applicability: "international", quality: "high", confidence: "medium" });
    expect(getEvidenceForKnowledge("prepackaged.codex.mandatory", {}).confidence).toBe("medium");
    expect(getEvidenceForKnowledge("prepackaged.codex.mandatory", EU).confidence).toBe("high");
    expect(getEvidenceForKnowledge("prepackaged.codex.mandatory", CM).confidence).toBe("medium"); // no verified Cameroonian text
  });

  it("N. provenance : chaque claim se trace jusqu'à une provenance PI-1 valide ; les sources citées par PI-3 sont migrées", () => {
    for (const c of CLAIMS) expect(provenanceIssues(assessClaim(c).provenance), c.id).toEqual([]);
    expect(getReferenceByLegacyId(CODEX_PREPACKAGED_LABELLING.sourceId!)?.id).toBe("ref.codex.cxs_1_1985");
    expect(getReferenceByLegacyId(UN_GHS.sourceId!)?.id).toBe("ref.un.ghs");
    expect(duplicateReferences(REFERENCES)).toEqual([]);
    expect(duplicateReferences([...REFERENCES, { ...REFERENCES[1], id: "ref.fao.copy", url: "https://WWW.fao.org/food-labelling/en/?utm_source=x" }])).toEqual([["ref.fao.food_labelling", "ref.fao.copy"]]);
    expect(normalizeUrl("http://WWW.Example.org/a/?utm_source=x#top")).toBe("https://www.example.org/a");
  });

  it("O. besoins de données : juridiction manquante, vérification en attente, preuve insuffisante", () => {
    expect(getEvidenceForKnowledge("prepackaged.codex.mandatory").dataNeeds).toEqual(expect.arrayContaining(["missingJurisdiction", "pendingVerification"]));
    const ghs = getEvidenceForKnowledge("household.reg.ghs");
    expect(ghs).toMatchObject({ evidenceStatus: "pending", confidence: "unknown" });
    expect(ghs.dataNeeds).toEqual(expect.arrayContaining(["pendingVerification", "insufficientEvidence"]));
    expect(getEvidenceForKnowledge("spices.conv.shortFront").dataNeeds).toEqual(["insufficientEvidence"]);
  });

  it("P. filtrage par catégorie ; Q. par juridiction et par type", () => {
    expect(getReferencesForCategory("household").map((r) => r.id)).toEqual(["ref.un.ghs"]);
    expect(getReferencesForCategory("prepackagedFood").map((r) => r.id)).toEqual(expect.arrayContaining(["ref.codex.cxs_1_1985", "ref.eu.your_europe_food_labelling", "ref.cm.anor_nc_04_2000_20"]));
    const cat = getEvidenceForCategory("prepackagedFood", EU);
    expect(cat.categoryClaims.map((c) => [c.claim.id, c.applicability])).toEqual([["claim.prepackaged.eu.xheight", "inScope"]]);
    expect(getReferencesByJurisdiction("Cameroon").map((r) => r.id)).toEqual(["ref.cm.anor_nc_04_2000_20"]);
    expect(getReferencesByType("governmental").map((r) => r.id)).toEqual(["ref.eu.your_europe_food_labelling"]);
    expect(getSupportedKnowledge(EU)).toEqual(expect.arrayContaining(["prepackaged.codex.mandatory", "localbev.conv.storage", "spices.trust.origin"]));
    expect(getEvidenceForClaim("claim.prepackaged.eu.xheight", CM)?.applicability).toBe("outOfScope");
    // the market's jurisdiction comes only from an explicit country, never from a region
    expect(contextFromProductIntelligence(archetypeById("localBeverage")!.intelligence).jurisdictions).toBeUndefined();
    expect(contextFromProductIntelligence(withUserFacts(archetypeById("localBeverage")!.intelligence, { marketCountry: ["CM"] })).jurisdictions).toEqual(["Cameroon", "CEMAC"]);
  });
});

describe("R–W. isolation, shadow, stéréotypes, sources réelles", () => {
  it("R. aucun réseau au runtime : code local, aucun fetch ni horloge", () => {
    const spy = vi.spyOn(globalThis, "fetch");
    getSupportedKnowledge(EU);
    shadowReferenceEvidence("jus de bissap");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    for (const f of readdirSync(DIR).filter((x) => x.endsWith(".ts"))) {
      expect(readFileSync(`${DIR}/${f}`, "utf8"), f).not.toMatch(/fetch\(|XMLHttpRequest|@anthropic-ai|gemini|openai|process\.env|Date\.now|new Date\(/);
    }
  });

  it("S. aucune mutation de la production : résolveur, grammaire et connaissance PI-3 inchangés", () => {
    const before = JSON.stringify([resolvePackaging("jus de bissap 50 cl"), inferDesignGrammar(archetypeById("localBeverage")!.intelligence), CATEGORY_KNOWLEDGE]);
    for (const k of CATEGORY_KNOWLEDGE) getEvidenceForCategory(k.id, EU);
    shadowReferenceEvidence("eau de javel");
    expect(JSON.stringify([resolvePackaging("jus de bissap 50 cl"), inferDesignGrammar(archetypeById("localBeverage")!.intelligence), CATEGORY_KNOWLEDGE])).toBe(before);
    for (const layer of ["taxonomy", "grammar", "category"]) {
      const code = readdirSync(`src/lib/intelligence/${layer}`).map((f) => readFileSync(`src/lib/intelligence/${layer}/${f}`, "utf8")).join("\n");
      expect(code, layer).not.toMatch(/intelligence\/reference/); // PI-4 sits above; nothing below depends on it
    }
    expect(Object.isFrozen(REFERENCES) && Object.isFrozen(CLAIMS)).toBe(true);
  });

  it("U. shadow : statut d'évidence des connaissances qui s'appliquent, sans le brief", () => {
    const s = shadowReferenceEvidence("Mon secret : jus de bissap 50 cl");
    expect(s).toMatchObject({ source: "referenceShadow", archetypeId: "localBeverage", jurisdictionKnown: false });
    expect(s.items).toEqual(expect.arrayContaining([{ knowledgeId: "prepackaged.codex.mandatory", evidenceStatus: "singleSource", confidence: "medium" }]));
    expect(s.counts.unsupported).toBeGreaterThan(0);
    expect(s.dataNeeds).toContain("missingJurisdiction");
    expect(JSON.stringify(s)).not.toMatch(/secret/);
    expect(shadowReferenceEvidence("ma marque").items).toEqual([]);
  });

  it("V. anti-stéréotype : aucune référence ni aucun claim ne prescrit une couleur, un motif ou un style", () => {
    const text = JSON.stringify([REFERENCES, CLAIMS]);
    expect(text).not.toMatch(/\b(vert|green|noir|black|gold|doré|wax|kente|bogolan|tribal|ethnique|feuille|leaf|bleu labo|laboratory blue)\b/i);
    expect(CLAIMS.some((c) => c.claimType === "visualConvention")).toBe(false); // no visual convention is sourced yet
  });

  it("W. aucune référence inventée : vérifiée = page officielle lue ; URL seulement si lue ; métadonnées inconnues absentes", () => {
    const verified = REFERENCES.filter((r) => r.status === "verified");
    expect(verified.map((r) => r.id).sort()).toEqual(["ref.codex.cxs_1_1985", "ref.eu.your_europe_food_labelling", "ref.fao.food_labelling", "ref.who.cac47_2024"]);
    for (const r of REFERENCES) {
      if (r.url) expect(r.verification.method, r.id).toBe("officialPageRead");
      expect(r.author, r.id).toBeUndefined(); // no author was verified for any source
      expect(["fao.org", "who.int", "europa.eu"].some((d) => !r.url || new URL(r.url).hostname.endsWith(d)), r.id).toBe(true);
    }
    for (const r of REFERENCES.filter((x) => x.status !== "verified")) {
      expect(r.url, r.id).toBeUndefined();
      expect(getEvidenceForKnowledge(CLAIMS.find((c) => c.referenceId === r.id)?.knowledgeId ?? "x").claims.filter((a) => a.reference.id === r.id).every((a) => a.applicability === "notVerified")).toBe(true);
    }
    expect(REFERENCES.some((r) => /doi\.org|10\.\d{4,}\//.test(JSON.stringify(r)))).toBe(false);
    expect(REFERENCES.filter((r) => ["academic", "scientific", "market", "retailer", "packagingBenchmark", "brandObservation", "expert"].includes(r.sourceType))).toEqual([]);
  });
});
