/**
 * PI-5 — Master Design Intent: the structured visual decision built from PI-1 → PI-4, the packaging
 * resolver and the user's explicit intent, handed to resolveShot (camera authority) as a canonical style.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolveShot, SHOT_STYLES } from "@/lib/three/scenePresets";
import { resolvePackaging } from "@/lib/catalog/packagingResolver";
import { inferProductIntelligence, withUserFacts } from "@/lib/intelligence/taxonomy";
import { inferDesignGrammar } from "@/lib/intelligence/grammar";
import { inferCategoryKnowledge } from "@/lib/intelligence/category";
import { contextFromProductIntelligence, getEvidenceForKnowledge } from "@/lib/intelligence/reference";
import {
  MASTER_DESIGN_INTENT_VERSION, buildMasterDesignIntent, canonicalShotStyle, shotRequestFromIntent, toDesignBrief, validateMasterDesignIntent,
  type MasterDesignIntent, type MasterDesignIntentInput,
} from "@/lib/intelligence/intent";

const DIR = "src/lib/intelligence/intent";
const BISSAP: MasterDesignIntentInput = { brief: "jus de bissap 50 cl", content: { brandName: "Kola", productName: "Bissap", volume: "50 cl" }, marketCountries: ["CM"] };
const roles = (m: MasterDesignIntent) => [...m.hierarchy.primary, ...m.hierarchy.secondary, ...m.hierarchy.tertiary, ...m.hierarchy.supporting];
const deepFreeze = <T,>(o: T): T => { if (o && typeof o === "object") { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };

describe("PI-5 — unitaires", () => {
  it("1. produit simple : intention valide, versionnée, traçable", () => {
    const m = buildMasterDesignIntent(BISSAP);
    expect(m.version).toBe(MASTER_DESIGN_INTENT_VERSION);
    expect(validateMasterDesignIntent(m)).toMatchObject({ valid: true, errors: [] });
    expect(m.product.name).toMatchObject({ value: "Bissap", status: "explicit", source: "user" });
    expect(m.product.category).toMatchObject({ value: "beverages", status: "inferred", source: "productIntelligence" });
    expect(m.brand.name).toMatchObject({ value: "Kola", status: "explicit" });
    expect(m.product.market).toEqual({ countries: ["CM"], jurisdictions: ["Cameroon", "CEMAC"], status: "explicit" });
    expect(m.packaging).toMatchObject({ supported: true, source: "packagingResolver", recognisedProduct: expect.any(String) });
    expect(m.hierarchy.primary.map((e) => e.role)).toEqual(["productName", "brand"]);
    expect(m.hierarchy.primary[0]).toMatchObject({ content: "Bissap", required: true });
    expect(m.provenance.length).toBeGreaterThan(1);
  });

  it("2. positionnement premium explicite : conservé, prioritaire sur l'inféré", () => {
    const m = buildMasterDesignIntent({ brief: "chips de plantain", styles: ["premium"] });
    expect(m.product.positioning[0]).toMatchObject({ value: "premium", status: "explicit", priority: "userRequirement", confidence: "high" });
    expect(m.product.positioning.find((p) => p.value === "playful")).toMatchObject({ status: "inferred" });
    expect(m.conflicts.find((c) => c.facet === "positioning" && c.values.includes("playful"))).toMatchObject({ winner: "premium", suppressed: "playful", attenuated: true, priority: "userRequirement" });
    // synonyms land on the same canonical signal (one vocabulary)
    for (const s of ["haut de gamme", "Premium"]) expect(buildMasterDesignIntent({ brief: "chips", styles: [s] }).product.positioning[0].value).toBe("premium");
    expect(buildMasterDesignIntent({ brief: "chips", styles: ["luxe"] }).product.positioning[0].value).toBe("luxury");
  });

  it("3. minimal + maximaliste : conflit détecté, résolution déterministe (la valeur la plus retenue)", () => {
    const m = buildMasterDesignIntent({ brief: "crème capillaire", styles: ["minimaliste", "maximalist"] });
    const deco = m.conflicts.find((c) => c.facet === "decorationLevel")!;
    expect(deco).toMatchObject({ values: ["none", "expressive"], winner: "none", suppressed: "expressive", priority: "userRequirement" });
    expect(deco.reason).toMatch(/même priorité/);
    expect(m.conflicts.find((c) => c.facet === "density")).toMatchObject({ winner: "minimal", suppressed: "dense" });
    expect(m.visual.visualDensity).toMatchObject({ value: "sparse", status: "explicit" });
    // the same answer whatever the order of the two words
    const r = buildMasterDesignIntent({ brief: "crème capillaire", styles: ["maximalist", "minimaliste"] });
    expect(r.conflicts.find((c) => c.facet === "decorationLevel")?.winner).toBe("none");
    // two explicit values on the same field (normalisation)
    const n = buildMasterDesignIntent({ brief: "crème", styles: ["ultra-minimal", "dense"] });
    expect(n.conflicts.find((c) => c.facet === "style.density")).toMatchObject({ winner: "minimal", suppressed: "dense" });
  });

  it("4. Reference Intelligence active : influence intégrée avec ses références et sa provenance", () => {
    const m = buildMasterDesignIntent(BISSAP);
    expect(m.references.mode).toBe("active");
    const codex = m.references.active.find((a) => a.knowledgeId === "prepackaged.codex.mandatory")!;
    expect(codex.referenceIds).toContain("ref.codex.cxs_1_1985");
    expect(m.claims.knowledge.find((k) => k.knowledgeId === "prepackaged.codex.mandatory")).toMatchObject({ status: "supported" });
    expect(m.provenance.some((p) => p.sourceId === "ref.codex.cxs_1_1985")).toBe(true);
    // Cameroon: the EU source is out of scope, the Cameroonian standard is pending — neither is active
    expect(m.references.rejected).toEqual(expect.arrayContaining([{ referenceId: "ref.cm.anor_nc_04_2000_20", reason: "en attente de vérification" }, { referenceId: "ref.eu.your_europe_food_labelling", reason: "hors périmètre" }]));
    expect(m.constraints.regulatory[0].rationale).toMatch(/ni un avis juridique ni une garantie/);
  });

  it("5. Reference Intelligence désactivée : aucune influence active", () => {
    const m = buildMasterDesignIntent({ ...BISSAP, references: "disabled" });
    expect(m.references).toMatchObject({ mode: "disabled", active: [], influences: [], rejected: [] });
    expect(m.claims.knowledge.every((k) => k.status === "inferred" && k.evidenceStatus === "disabled" && !k.referenceIds.length)).toBe(true);
    expect(m.provenance.some((p) => p.sourceId?.startsWith("ref."))).toBe(false);
    const v = validateMasterDesignIntent(m);
    expect(v.valid).toBe(true);
    expect(v.warnings.map((w) => w.code)).toContain("REFERENCES_DISABLED");
    // a disabled intent that still carried an influence would be rejected
    expect(validateMasterDesignIntent({ ...m, references: { ...m.references, active: buildMasterDesignIntent(BISSAP).references.active } }).errors.map((e) => e.code)).toContain("DISABLED_REFERENCE_USED");
  });

  it("6. allégation incertaine : ne devient jamais validée ; une référence ne valide pas une connaissance", () => {
    const m = buildMasterDesignIntent({ ...BISSAP, claims: [{ text: "100 % naturel" }, { text: "Recette de grand-mère" }, { text: "Bio certifié", substantiated: true }] });
    expect(m.claims.product.map((c) => [c.value, c.status])).toEqual([["100 % naturel", "uncertain"], ["Recette de grand-mère", "explicit"], ["Bio certifié", "validated"]]);
    expect(m.claims.uncertain).toContain("100 % naturel");
    expect(m.claims.supported).not.toContain("100 % naturel");
    expect(m.claims.knowledge.some((k) => k.status === "validated")).toBe(false);
    expect(buildMasterDesignIntent({ brief: "eau de javel" }).claims.knowledge.find((k) => k.knowledgeId === "household.reg.ghs")?.status).toBe("uncertain"); // pending reference
  });

  it("7. allégation interdite : exclue des allégations actives, gardée comme interdiction", () => {
    const m = buildMasterDesignIntent({ ...BISSAP, claims: [{ text: "Soigne la tension" }, { text: "Fraîcheur garantie" }], prohibitedClaims: ["soigne"] });
    expect(m.claims.product[0]).toMatchObject({ value: "Soigne la tension", status: "prohibited" });
    expect(m.claims.supported).toEqual(expect.arrayContaining(["Fraîcheur garantie"]));
    expect(m.claims.supported.join()).not.toMatch(/Soigne/);
    expect(m.constraints.prohibited[0]).toMatchObject({ value: "allégation interdite: soigne", status: "prohibited", priority: "hardConstraint" });
    expect(validateMasterDesignIntent(m).valid).toBe(true);
    expect(validateMasterDesignIntent({ ...m, claims: { ...m.claims, supported: [...m.claims.supported, "Soigne la tension"] } }).errors.map((e) => e.code)).toContain("PROHIBITED_CLAIM_ACTIVE");
  });

  it("8. style de prise de vue valide : nom canonique de SHOT_STYLES", () => {
    for (const id of Object.keys(SHOT_STYLES)) expect(canonicalShotStyle(id)).toBe(id);
    expect(canonicalShotStyle("catalog-ecommerce")).toBe("catalogEcommerce");
    expect(canonicalShotStyle("HERO_PREMIUM")).toBe("heroPremium");
    const m = buildMasterDesignIntent({ brief: "eau de parfum", shot: { style: "heroPremium" } });
    expect(m.shotIntent).toMatchObject({ style: "heroPremium", status: "resolved", source: "user" });
    expect(buildMasterDesignIntent({ brief: "chips", shot: { purpose: "ecommerce" } }).shotIntent).toMatchObject({ purpose: "ecommerce", style: "catalogEcommerce", status: "resolved" });
  });

  it("9. style invalide : non résolu, aucun style inventé ; un style inconnu dans l'intention est une erreur", () => {
    for (const bad of ["catalogue", "ecommerceCatalog", "cinematic"]) {
      const m = buildMasterDesignIntent({ brief: "eau de parfum", shot: { style: bad } });
      expect(m.shotIntent).toMatchObject({ requestedStyle: bad, style: null, status: "unresolved" });
      expect(validateMasterDesignIntent(m).warnings.map((w) => w.code)).toContain("SHOT_UNRESOLVED");
    }
    expect(buildMasterDesignIntent({ brief: "chips", shot: { purpose: "technical" } }).shotIntent.status).toBe("unresolved");
    const m = buildMasterDesignIntent({ brief: "eau de parfum" });
    expect(validateMasterDesignIntent({ ...m, shotIntent: { ...m.shotIntent, style: "catalogue" as never } }).errors.map((e) => e.code)).toContain("SHOT_STYLE_UNKNOWN");
    expect(Object.keys(SHOT_STYLES)).toHaveLength(5); // no style was added
  });

  it("10. déterministe : deux appels identiques → résultats identiques", () => {
    for (const input of [BISSAP, { brief: "crème capillaire", styles: ["minimaliste", "maximalist"] }, { brief: "eau de javel", references: "disabled" as const }]) {
      expect(JSON.stringify(buildMasterDesignIntent(input))).toBe(JSON.stringify(buildMasterDesignIntent(input)));
    }
  });

  it("11. entrées immuables", () => {
    const input = deepFreeze({ ...structuredClone(BISSAP), styles: ["premium"], claims: [{ text: "Sans sucre ajouté" }], directives: { positioning: ["modern" as const], source: "brief" as const } });
    const before = JSON.stringify(input);
    buildMasterDesignIntent(input); // frozen: any write would throw
    expect(JSON.stringify(input)).toBe(before);
  });

  it("12. absence d'information : rien n'est inventé", () => {
    const m = buildMasterDesignIntent({ brief: "ma nouvelle marque" });
    expect(m.product.name).toMatchObject({ value: "unknown", confidence: "unknown" });
    expect(m.brand).toMatchObject({ name: { value: "unknown" }, personality: [], values: "notProvided" });
    expect(m.visual.territory.value).toBe("unknown");
    expect(m.visual.sophistication.value).toBe("unknown");
    expect(m.shotIntent.status).toBe("unspecified");
    expect(m.confidence.overall).toBe("unknown");
    for (const e of roles(m)) expect(e.content).toBe("notProvided");
    expect(m.dataNeeds).toEqual(expect.arrayContaining(["nom de la marque", "nom du produit", "pays de vente"]));
    expect(validateMasterDesignIntent(m).errors.map((e) => e.code)).toEqual(["PRODUCT_MISSING"]);
    // premium without any colour request: no colour value is invented
    const p = buildMasterDesignIntent({ brief: "parfum de luxe" });
    expect(JSON.stringify(p.visual)).not.toMatch(/#[0-9a-f]{3,6}|\bgold\b|\bnoir\b|\bblack\b|\bor\b/i);
    expect(p.visual.colorDirection.some((c) => c.value.startsWith("couleur demandée"))).toBe(false);
  });
});

describe("PI-5 — décisions explicites et sources", () => {
  it("une couleur demandée prime sur la convention de catégorie, qui reste tracée", () => {
    const m = buildMasterDesignIntent({ brief: "jus de bissap", directives: { colors: [{ name: "noir" }, { name: "blanc", intensity: "muted" }], source: "brief" } });
    expect(m.visual.colorDirection.filter((c) => c.value.startsWith("couleur demandée")).map((c) => [c.value, c.status])).toEqual([["couleur demandée: noir", "explicit"], ["couleur demandée: blanc (muted)", "explicit"]]);
    expect(m.visual.colorDirection.find((c) => c.value.startsWith("saturation"))).toMatchObject({ value: "saturation: muted", status: "explicit" });
    expect(m.conflicts.find((c) => c.facet === "category.localbev.conv.vividColours")).toMatchObject({ suppressed: "localbev.conv.vividColours", priority: "userRequirement" });
  });

  it("la structure décidée fait foi face à la famille habituelle du produit", () => {
    const m = buildMasterDesignIntent({ brief: "jus de bissap", shapeId: "cosmetic-jar" });
    expect(m.packaging).toMatchObject({ shapeId: "cosmetic-jar", family: "pot", source: "user" });
    expect(m.conflicts.find((c) => c.facet === "packaging")).toMatchObject({ winner: "pot", priority: "hardConstraint" });
    expect(m.constraints.structural[0]).toMatchObject({ priority: "hardConstraint", status: "explicit" });
    expect(validateMasterDesignIntent(buildMasterDesignIntent({ brief: "pizza", shapeId: "pizza-box" })).errors.map((e) => e.code)).toContain("STRUCTURE_UNSUPPORTED");
  });

  it("spécificité : PI-5 rapporte ce que le résolveur a reconnu (« eau de javel » n'est pas de l'eau)", () => {
    const m = buildMasterDesignIntent({ brief: "eau de javel 1 L" });
    expect(m.product.archetypeId).toBe("bleach");
    expect(m.packaging.recognisedProduct).not.toBe("Eau de source");
    expect(m.constraints.prohibited.some((p) => p.value === "illustration: mascot" && p.priority === "hardConstraint")).toBe(true);
    const crème = buildMasterDesignIntent({ brief: "crème capillaire" });
    expect(crème.packaging).toMatchObject({ shapeId: "hair-cream-tub", recognitionPrecision: "family" });
  });

  it("chaque décision dit QUOI, POURQUOI, SOURCE, CONFIANCE, PRIORITÉ ; l'inféré n'est jamais « high »", () => {
    const m = buildMasterDesignIntent({ ...BISSAP, styles: ["minimaliste"] });
    for (const v of [...m.visual.style, ...m.visual.colorDirection, ...m.visual.typographyDirection, ...m.negativeDirections]) {
      expect(v.rationale.length).toBeGreaterThan(5);
      if (v.status === "inferred") expect(v.confidence).not.toBe("high");
      if (v.status === "explicit") expect(v.source === "user" || v.source === "brand").toBe(true);
    }
  });

  it("directions négatives contextuelles (pas une liste universelle)", () => {
    const javel = buildMasterDesignIntent({ brief: "eau de javel" }).negativeDirections.map((n) => n.value).join("\n");
    const parfum = buildMasterDesignIntent({ brief: "parfum de luxe" }).negativeDirections.map((n) => n.value).join("\n");
    expect(javel).toMatch(/aliment ou à une boisson/);
    expect(parfum).not.toMatch(/aliment ou à une boisson/);
    expect(parfum).toMatch(/noir \+ or/);
  });

  it("le brief texte est dérivé de la structure et n'invente rien", () => {
    const text = toDesignBrief(buildMasterDesignIntent({ brief: "ma nouvelle marque" }));
    expect(text).toMatch(/Marque : non fourni/);
    expect(text).toMatch(/Produit : non fourni/);
    const b = toDesignBrief(buildMasterDesignIntent(BISSAP));
    expect(b).toMatch(/Produit : Bissap/);
    expect(b).not.toMatch(/jus de bissap 50 cl/); // the raw brief is never copied
  });
});

describe("PI-5 — intégration", () => {
  it("PI-3 → PI-4 → PI-5 → shotIntent → resolveShot : informations conservées, provenance, style canonique", () => {
    const pi = withUserFacts(inferProductIntelligence("parfum de luxe").intelligence, { marketCountry: ["BE"] });
    const pi3 = inferCategoryKnowledge(pi);
    const pi4 = pi3.conventions.map((c) => getEvidenceForKnowledge(c.id, contextFromProductIntelligence(pi)));
    const m = buildMasterDesignIntent({ brief: "parfum de luxe", marketCountries: ["BE"] });
    // PI-3 knowledge is all there, with PI-4's evidence status
    expect(m.claims.knowledge.map((k) => k.knowledgeId)).toEqual(expect.arrayContaining(pi3.conventions.map((c) => c.id)));
    for (const e of pi4) expect(m.claims.knowledge.find((k) => k.knowledgeId === e.knowledgeId)?.evidenceStatus).toBe(e.evidenceStatus);
    expect(m.product.market.jurisdictions).toEqual(["Belgium", "EU"]);
    expect(m.hierarchy.primary.map((e) => e.role)).toEqual(pi3.informationPriorities.order.filter((r) => r !== "subtitle").slice(0, 2));
    expect(validateMasterDesignIntent(m).valid).toBe(true);
    // shot: an intention handed to the camera authority, unchanged
    expect(m.shotIntent).toMatchObject({ purpose: "hero", style: "heroPremium", status: "resolved" });
    const shot = resolveShot(shotRequestFromIntent(m, "hd"));
    expect(shot).toEqual(resolveShot({ style: "heroPremium", quality: "hd" }));
    expect(shot).toMatchObject({ camera: { id: SHOT_STYLES.heroPremium.camera }, lighting: { id: SHOT_STYLES.heroPremium.lighting } });
  });

  it("compatibilité 3D : l'intention sélectionne heroPremium ou catalogEcommerce sans toucher caméra, rendu ou modèles", () => {
    const hero = buildMasterDesignIntent({ brief: "chocolat premium" });
    const shop = buildMasterDesignIntent({ brief: "chips de plantain", shot: { purpose: "ecommerce" } });
    expect(resolveShot(shotRequestFromIntent(hero)).camera.id).toBe(SHOT_STYLES.heroPremium.camera);
    expect(resolveShot(shotRequestFromIntent(shop))).toEqual(resolveShot({ style: "catalogEcommerce" }));
    // unresolved or unspecified intent → no style handed over: resolveShot keeps its own default
    expect(shotRequestFromIntent(buildMasterDesignIntent({ brief: "ma marque" }))).toEqual({});
    expect(resolveShot(shotRequestFromIntent(buildMasterDesignIntent({ brief: "x", shot: { style: "catalogue" } })))).toEqual(resolveShot({}));
    // code only (comments may name the downstream flow: resolveShot → renderHD)
    const code = readdirSync(DIR).filter((f) => f.endsWith(".ts")).map((f) => readFileSync(`${DIR}/${f}`, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")).join("\n");
    expect(code).not.toMatch(/from "three"|@\/lib\/three\/(hdRender|hdExport|packagingModels|studioRig|geometry)|renderHD|azimuth|focalMm|PerspectiveCamera/);
  });

  it("aucune régression : résolveur, grammaire et connaissance identiques ; aucun réseau, aucune horloge", () => {
    const before = JSON.stringify([resolvePackaging("jus de bissap 50 cl"), inferDesignGrammar(inferProductIntelligence("jus de bissap").intelligence)]);
    const spy = vi.spyOn(globalThis, "fetch");
    buildMasterDesignIntent({ ...BISSAP, styles: ["premium"], shot: { purpose: "hero" } });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    expect(JSON.stringify([resolvePackaging("jus de bissap 50 cl"), inferDesignGrammar(inferProductIntelligence("jus de bissap").intelligence)])).toBe(before);
    for (const f of readdirSync(DIR)) expect(readFileSync(`${DIR}/${f}`, "utf8"), f).not.toMatch(/fetch\(|axios|@anthropic-ai|gemini|openai|process\.env|Math\.random|Date\.now|new Date\(/);
    for (const layer of ["taxonomy", "grammar", "category", "reference"]) {
      const code = readdirSync(`src/lib/intelligence/${layer}`).map((f) => readFileSync(`src/lib/intelligence/${layer}/${f}`, "utf8")).join("\n");
      expect(code, layer).not.toMatch(/intelligence\/intent/);
    }
  });
});
