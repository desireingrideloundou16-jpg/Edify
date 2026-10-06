/**
 * PI-1 — Packaging taxonomy intelligence: the deterministic knowledge layer.
 *
 * A. Vocabularies, taxonomy and archetypes are structurally valid (controlled values only).
 * B. Unknown, confidence and provenance: nothing inferred is presented as a fact, nothing regulatory or
 *    environmental is asserted without a source, no URL is made up.
 * C. The knowledge layer never names an engine structure and never mutates the frozen catalogue.
 * D. Representative products reason like a packaging designer.
 * E. Resolver integration: the resolver stays the authority; the adapter only answers its question.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import { PRODUCT_INTENTS } from "@/lib/catalog/productIntents";
import { availableFamilies, isSupportedShape, resolvePackaging } from "@/lib/catalog/packagingResolver";
import {
  CONFIDENCE_LEVELS, INFORMATION_ORIGINS, MATERIAL_PROFILES, PACKAGING_MATERIALS, PACKAGING_REQUIREMENT_KEYS, PI1_ARCHETYPE_SOURCE, PRODUCT_ARCHETYPES,
  PRODUCT_CATEGORIES, PRODUCT_TAXONOMY, REGULATORY_REQUIREMENT_KEYS, SEMANTIC_PACKAGING_FAMILIES, SEMANTIC_TO_RESOLVER_FAMILY, archetypeById, archetypeIssues,
  inferProductIntelligence, isProductCategory, isSubcategoryOf, productIntelligenceIssues, provenanceIssues, resolvePackagingWithIntelligence,
  resolverFamiliesFor, resolverPhysicalState, withUserFacts, type ProductIntelligence, type Provenance,
} from "@/lib/intelligence/taxonomy";

const TAXONOMY_DIR = "src/lib/intelligence/taxonomy";
const base = (extra: Partial<ProductIntelligence> = {}): ProductIntelligence => ({ confidence: "medium", origin: "ruleBased", provenance: [PI1_ARCHETYPE_SOURCE], ...extra });

describe("A. structure de la taxonomie", () => {
  it("1. les types compilent et la taxonomie couvre les 11 catégories demandées", () => {
    const pi: ProductIntelligence = base({ productCategory: "food", productSubcategory: "dairy", physicalState: "powder", preferredPackagingFamilies: ["tub"] });
    expect(productIntelligenceIssues(pi)).toEqual([]);
    expect(PRODUCT_CATEGORIES).toEqual(["food", "beverages", "cosmetics", "personalCare", "supplements", "pharmaceutical", "household", "petCare", "luxury", "industrial", "other"]);
    for (const c of PRODUCT_CATEGORIES) expect(PRODUCT_TAXONOMY[c].subcategories).toContain("other");
    expect(isSubcategoryOf("food", "dairy")).toBe(true);
    expect(isSubcategoryOf("food", "shampoo")).toBe(false);
  });

  it("entre 30 et 60 archétypes, ids uniques, base figée en lecture seule", () => {
    expect(PRODUCT_ARCHETYPES.length).toBeGreaterThanOrEqual(30);
    expect(PRODUCT_ARCHETYPES.length).toBeLessThanOrEqual(60);
    expect(new Set(PRODUCT_ARCHETYPES.map((a) => a.id)).size).toBe(PRODUCT_ARCHETYPES.length);
    expect(Object.isFrozen(PRODUCT_ARCHETYPES)).toBe(true);
    expect(Object.isFrozen(PRODUCT_ARCHETYPES[0].intelligence.packagingRequirements)).toBe(true);
  });

  it("2-3. chaque archétype a une catégorie valide et seulement du vocabulaire contrôlé", () => {
    for (const a of PRODUCT_ARCHETYPES) {
      expect(isProductCategory(a.intelligence.productCategory), a.id).toBe(true);
      expect(archetypeIssues(a), a.id).toEqual([]);
    }
  });

  it("3. le validateur rejette toute valeur hors vocabulaire", () => {
    const bad = base({
      productCategory: "food", productSubcategory: "shampoo" as never, physicalState: "plasma" as never, preferredPackagingFamilies: ["pot" as never],
      positioningTerritories: ["cheap" as never], packagingRequirements: { needsResealability: "maybe" as never, needsMagic: "required" } as never,
      designSignals: { soundDirection: {} } as never, confidence: "certain" as never,
    });
    const issues = productIntelligenceIssues(bad).join("\n");
    for (const w of ["productSubcategory", "physicalState", "preferredPackagingFamilies", "positioningTerritories", "needsResealability", "needsMagic", "soundDirection", "confidence"]) expect(issues).toContain(w);
    expect(productIntelligenceIssues({ ...base(), foo: 1 } as never).join()).toContain("unknown field");
  });

  it("chaque archétype renseigne les 16 exigences et explique son raisonnement", () => {
    for (const a of PRODUCT_ARCHETYPES) {
      expect(Object.keys(a.intelligence.packagingRequirements!).sort(), a.id).toEqual([...PACKAGING_REQUIREMENT_KEYS].sort());
      expect(a.rationale.length, a.id).toBeGreaterThan(30);
      expect(a.intelligence.positioningTerritories?.length, a.id).toBeGreaterThan(0);
    }
  });

  it("les liens vers le catalogue existant (PRODUCT_INTENTS) existent tous", () => {
    const names = new Set(PRODUCT_INTENTS.map((p) => p.product));
    for (const a of PRODUCT_ARCHETYPES) for (const p of a.catalogueProducts ?? []) expect(names.has(p), `${a.id} → ${p}`).toBe(true);
  });
});

describe("B. inconnu, confiance et provenance", () => {
  it("4. « unknown » est une valeur valide et l'absence aussi", () => {
    expect(productIntelligenceIssues({ confidence: "unknown", origin: "unknown", provenance: [] })).toEqual([]);
    expect(productIntelligenceIssues(base({ physicalState: "unknown", pricePosition: "unknown", fragility: "unknown", packagingRequirements: { needsLightProtection: "unknown" } }))).toEqual([]);
    // the archetypes use it where the form is genuinely undecided (lessive: poudre ou liquide)
    expect(archetypeById("laundryDetergent")!.intelligence.physicalState).toBe("unknown");
  });

  it("5. provenance : structure valide, pas d'URL inventée, recherche = source réelle", () => {
    expect(provenanceIssues(PI1_ARCHETYPE_SOURCE)).toEqual([]);
    expect(PI1_ARCHETYPE_SOURCE.sourceUrl).toBeUndefined();
    const ok: Provenance = { sourceType: "research", sourceTitle: "Study", sourceUrl: "https://example.org/study", retrievedAt: "2026-10-05", confidence: "medium" };
    expect(provenanceIssues(ok)).toEqual([]);
    expect(provenanceIssues({ sourceType: "research", confidence: "high" }).join()).toMatch(/sourceTitle.*|sourceUrl/);
    expect(provenanceIssues({ sourceType: "internalRule", sourceUrl: "https://x.org/a", retrievedAt: "2026-01-01", confidence: "low" }).join()).toContain("has no URL");
    expect(provenanceIssues({ sourceType: "ai", confidence: "high" }).join()).toContain("cannot be \"high\"");
    expect(provenanceIssues({ sourceType: "web" as never, confidence: "sure" as never })).toHaveLength(2);
    // no URL anywhere in the knowledge files
    for (const f of readdirSync(TAXONOMY_DIR)) expect(readFileSync(`${TAXONOMY_DIR}/${f}`, "utf8"), f).not.toMatch(/https?:\/\/(?!example)/);
  });

  it("6. confiance : vocabulaire fermé, origine distinguée, l'inféré n'est jamais « high »", () => {
    expect(CONFIDENCE_LEVELS).toEqual(["high", "medium", "low", "unknown"]);
    expect(INFORMATION_ORIGINS).toEqual(["userProvided", "inferred", "catalogue", "ruleBased", "aiGenerated", "unknown"]);
    for (const a of PRODUCT_ARCHETYPES) {
      expect(a.intelligence.origin).toBe("ruleBased");
      expect(a.intelligence.confidence).not.toBe("high");
    }
    expect(productIntelligenceIssues(base({ origin: "inferred", confidence: "high" })).join()).toContain("cannot be \"high\"");
    expect(productIntelligenceIssues(base({ fieldMeta: { physicalState: { origin: "guess" as never, confidence: "high" } } })).join()).toContain("fieldMeta.physicalState.origin");
  });

  it("les faits de l'utilisateur sont marqués « userProvided », l'inféré reste « inferred »", () => {
    const { intelligence } = inferProductIntelligence("lait en poudre");
    const merged = withUserFacts(intelligence, { pricePosition: "premium", marketCountry: ["CM"] }, "brief-1");
    expect(merged.pricePosition).toBe("premium");
    expect(merged.fieldMeta?.pricePosition).toMatchObject({ origin: "userProvided", confidence: "high" });
    expect(merged.fieldMeta?.physicalState).toBeUndefined();
    expect(merged.origin).toBe("inferred");
    expect(intelligence.pricePosition).toBe("mid"); // input untouched
    expect(productIntelligenceIssues(merged)).toEqual([]);
  });

  it("aucune exigence réglementaire inventée : sécurité enfant et inviolabilité restent « unknown »", () => {
    for (const a of PRODUCT_ARCHETYPES) for (const k of REGULATORY_REQUIREMENT_KEYS) expect(a.intelligence.packagingRequirements![k], `${a.id}.${k}`).toBe("unknown");
    for (const a of PRODUCT_ARCHETYPES) expect(a.intelligence.regulatoryContext?.status ?? "unknown", a.id).toBe("unknown");
    const claimed = base({ packagingRequirements: { needsChildResistance: "required" } });
    expect(productIntelligenceIssues(claimed).join()).toContain("regulatory requirement");
    const sourced = base({ packagingRequirements: { needsChildResistance: "required" }, fieldMeta: { packagingRequirements: { origin: "userProvided", confidence: "high", provenance: { sourceType: "user", confidence: "high" } } } });
    expect(productIntelligenceIssues(sourced)).toEqual([]);
    expect(productIntelligenceIssues(base({ regulatoryContext: { status: "sourced", statements: ["x"], provenance: [{ sourceType: "ai", confidence: "low" }] } })).join()).toContain("regulatoryContext");
  });

  it("aucune allégation environnementale déduite d'un matériau", () => {
    for (const m of PACKAGING_MATERIALS) expect(MATERIAL_PROFILES[m].recyclabilityClaim, m).toBe("notClaimed");
    for (const f of readdirSync(TAXONOMY_DIR)) {
      const code = readFileSync(`${TAXONOMY_DIR}/${f}`, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(code, f).not.toMatch(/recyclable|compostable|biodégradable|eco-friendly/i);
    }
  });
});

describe("C. séparation avec le moteur figé", () => {
  it("7. aucun archétype ne contient d'id de structure (supportée ou refusée)", () => {
    const ids = new Set(SHAPE_ROWS.map((r) => r[0]));
    const strings: string[] = [];
    const walk = (v: unknown) => {
      if (typeof v === "string") strings.push(v);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(PRODUCT_ARCHETYPES);
    expect(strings.filter((s) => ids.has(s))).toEqual([]);
    for (const a of PRODUCT_ARCHETYPES) for (const f of a.intelligence.preferredPackagingFamilies ?? []) expect(SEMANTIC_PACKAGING_FAMILIES).toContain(f);
  });

  it("8. la taxonomie ne modifie pas le catalogue figé", () => {
    const before = JSON.stringify({ SHAPE_ROWS, PRODUCT_INTENTS });
    for (const a of PRODUCT_ARCHETYPES) {
      const i = inferProductIntelligence(a.terms[0]);
      withUserFacts(i.intelligence, { pricePosition: "luxury" });
      resolverFamiliesFor(a.intelligence);
      resolvePackagingWithIntelligence(a.terms[0], i.intelligence);
    }
    expect(JSON.stringify({ SHAPE_ROWS, PRODUCT_INTENTS })).toBe(before);
    expect(SHAPE_ROWS).toHaveLength(119);
  });

  it("la couche n'importe ni le moteur de structure, ni la 3D, ni l'impression, ni un fournisseur IA", () => {
    for (const f of readdirSync(TAXONOMY_DIR)) {
      const code = readFileSync(`${TAXONOMY_DIR}/${f}`, "utf8");
      expect(code, f).not.toMatch(/from "@\/lib\/(structure|three|print|ai)|anthropic|gemini|fetch\(/);
    }
  });
});

describe("D. cas représentatifs", () => {
  const pi = (text: string) => {
    const r = inferProductIntelligence(text);
    expect(r.archetypeId, text).not.toBeNull();
    return { id: r.archetypeId, ...r.intelligence };
  };

  it("lait en poudre : poudre dosée, barrière humidité, refermeture obligatoire", () => {
    const p = pi("Lait en poudre entier 400 g");
    expect(p.id).toBe("milkPowder"); // not "milk": the longest term wins
    expect(p).toMatchObject({ productCategory: "food", productSubcategory: "dairy", physicalState: "powder", flowBehavior: "scoopable", dispensingNeed: ["scoop"] });
    expect(p.packagingRequirements).toMatchObject({ needsMoistureProtection: "required", needsResealability: "required" });
    expect(p.preferredPackagingFamilies).toEqual(expect.arrayContaining(["tin", "tub", "pouch"]));
    expect(p.confidence).toBe("medium");
  });

  it("jus : liquide sensible à l'oxydation, étanche, impact rayon critique", () => {
    const p = pi("jus de mangue");
    expect(p).toMatchObject({ id: "fruitJuice", productCategory: "beverages", physicalState: "liquid", shelfImportance: "critical" });
    expect(p.sensitivities).toEqual(expect.arrayContaining(["oxygen", "heat"]));
    expect(p.packagingRequirements?.needsLeakProtection).toBe("required");
    expect(p.confidence).toBe("low"); // a single word: only a hint
  });

  it("crème capillaire : crème prélevée au doigt → pot, pas de pompe", () => {
    const p = pi("crème capillaire à l'avocat");
    expect(p).toMatchObject({ id: "hairCream", productSubcategory: "hairCream", physicalState: "cream", flowBehavior: "scoopable" });
    expect(p.preferredPackagingFamilies![0]).toBe("tub");
    expect(p.packagingRequirements?.needsDispensing).toBe("notRelevant");
  });

  it("savon liquide : pompe, usage plusieurs fois par jour (≠ savon solide)", () => {
    const p = pi("savon liquide aux agrumes");
    expect(p).toMatchObject({ id: "liquidSoap", productCategory: "personalCare", flowBehavior: "pumpable", usageFrequency: "multipleDaily" });
    expect(p.dispensingNeed).toContain("pump");
    expect(inferProductIntelligence("savon noir").archetypeId).toBe("barSoap");
  });

  it("parfum : vaporisé, fragile, présentation premium obligatoire (≠ eau)", () => {
    const p = pi("eau de parfum boisée");
    expect(p).toMatchObject({ id: "perfume", flowBehavior: "sprayable", fragility: "high" });
    expect(p.dispensingNeed).toEqual(["spray"]);
    expect(p.packagingRequirements?.needsPremiumPresentation).toBe("required");
    expect(inferProductIntelligence("parfum de luxe").archetypeId).toBe("luxuryPerfume");
  });

  it("protéine en poudre : mesurette obligatoire, public sportif", () => {
    const p = pi("whey protéine chocolat 1 kg");
    expect(p).toMatchObject({ id: "proteinPowder", productCategory: "supplements", physicalState: "powder", dispensingNeed: ["scoop"] });
    expect(p.targetAudience).toContain("athletes");
    expect(p.packagingRequirements?.needsDispensing).toBe("required");
  });

  it("eau de javel : produit dangereux, jamais codé comme une boisson, sécurité enfant non supposée", () => {
    const p = pi("eau de javel 1 L");
    expect(p).toMatchObject({ id: "bleach", productCategory: "household", physicalState: "liquid" });
    expect(p.packagingRequirements?.needsChildResistance).toBe("unknown");
    expect(p.regulatoryContext).toEqual({ status: "unknown" });
    expect(p.designSignals?.imageryDirection?.avoid).toEqual(expect.arrayContaining([expect.stringMatching(/boissons/)]));
  });

  it("café : barrière lumière/oxygène/humidité ; forme (grains ou moulu) laissée inconnue", () => {
    const p = pi("café moulu du Cameroun");
    expect(p).toMatchObject({ id: "coffee", productSubcategory: "coffee", physicalState: "unknown" });
    expect(p.packagingRequirements).toMatchObject({ needsBarrierProtection: "required", needsLightProtection: "required", needsMoistureProtection: "required" });
    expect(p.preferredPackagingFamilies![0]).toBe("pouch");
  });

  it("produit traditionnel (gari) : contexte culturel sans stéréotype, régions explicites", () => {
    const p = pi("gari blanc 1 kg");
    expect(p).toMatchObject({ id: "traditionalFood", productSubcategory: "grains", physicalState: "granules" });
    expect(p.positioningTerritories).toEqual(expect.arrayContaining(["traditional", "cultural"]));
    expect(p.marketRegion).toEqual(["WestAfrica", "CentralAfrica"]);
    expect(p.cultureContext?.colorAssociations).toBeUndefined(); // no unsourced colour association
  });

  it("cosmétique premium : luxe, verre, présentation obligatoire", () => {
    const p = pi("crème de luxe anti-âge");
    expect(p).toMatchObject({ id: "luxuryFaceCream", productCategory: "luxury", pricePosition: "luxury" });
    expect(p.preferredMaterials).toContain("glass");
    expect(p.positioningTerritories).toEqual(expect.arrayContaining(["luxury", "elegant"]));
    expect(p.packagingRequirements?.needsPremiumPresentation).toBe("required");
  });

  it("un brief sans produit reconnu reste inconnu (rien n'est deviné)", () => {
    const r = inferProductIntelligence("ma nouvelle marque");
    expect(r).toMatchObject({ archetypeId: null, intelligence: { confidence: "unknown", origin: "unknown", provenance: [] } });
    expect(inferProductIntelligence("x").intelligence).not.toBe(inferProductIntelligence("y").intelligence);
  });

  it("déterministe : même entrée → même sortie", () => {
    expect(JSON.stringify(inferProductIntelligence("Sérum vitamine C 30 ml"))).toBe(JSON.stringify(inferProductIntelligence("Sérum vitamine C 30 ml")));
  });
});

describe("E. intégration au résolveur existant", () => {
  it("chaque famille sémantique est mappée vers une famille du résolveur ou explicitement non couverte", () => {
    const fams = new Set(availableFamilies());
    for (const f of SEMANTIC_PACKAGING_FAMILIES) {
      const r = SEMANTIC_TO_RESOLVER_FAMILY[f];
      expect(r === null || fams.has(r), f).toBe(true);
    }
    expect(resolverPhysicalState("cream")).toBe("paste");
    expect(resolverPhysicalState("unknown")).toBeNull();
  });

  it("chaque archétype obtient au moins une famille de résolveur disponible", () => {
    for (const a of PRODUCT_ARCHETYPES) expect(resolverFamiliesFor(a.intelligence).length, a.id).toBeGreaterThan(0);
    expect(resolverFamiliesFor(archetypeById("premiumGift")!.intelligence)[0]).toBe("coffret");
  });

  it("9. le résolveur n'est pas modifié : décision identique avant/après, l'adaptateur la renvoie telle quelle", () => {
    for (const text of ["lait en poudre 400 g", "jus de mangue", "crème capillaire", "eau de javel", "café moulu", "un pot de miel", "ma marque"]) {
      const before = JSON.stringify(resolvePackaging(text));
      const r = resolvePackagingWithIntelligence(text, inferProductIntelligence(text).intelligence);
      expect(JSON.stringify(resolvePackaging(text))).toBe(before);
      if (!JSON.parse(before).needsClarification) {
        expect(r.decidedBy).toBe("resolver");
        expect(JSON.stringify(r.resolution)).toBe(before);
      }
    }
  });

  it("un contenant demandé par l'utilisateur prime toujours sur l'intelligence", () => {
    const r = resolvePackagingWithIntelligence("yaourt en sachet", inferProductIntelligence("yaourt").intelligence);
    expect(r.decidedBy).toBe("resolver");
    expect(r.resolution.family).toBe("sachet");
  });

  it("là où le résolveur poserait une question, la famille préférée du produit y répond (format supporté)", () => {
    for (const [text, family] of [["yaourt nature", "pot"], ["lessive", "bouteille"], ["plat préparé", "boite"]] as const) {
      expect(resolvePackaging(text).needsClarification, text).toBe(true);
      const r = resolvePackagingWithIntelligence(text, inferProductIntelligence(text).intelligence);
      expect(r, text).toMatchObject({ decidedBy: "intelligence", family });
      expect(isSupportedShape(r.resolution.shapeId), text).toBe(true);
    }
  });

  it("sans intelligence, la question du résolveur reste posée", () => {
    const r = resolvePackagingWithIntelligence("ma marque", inferProductIntelligence("ma marque").intelligence);
    expect(r.decidedBy).toBe("resolver");
    expect(r.resolution.needsClarification).toBe(true);
  });
});
