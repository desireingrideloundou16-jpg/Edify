/**
 * PI-3 — Industry / Category Knowledge: what a category knows, with provenance. Knowledge, never a
 * decision: tests check structure, traceability, honesty (no invented fact), user precedence and the
 * isolation from the packaging resolver and from PI-2.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { archetypeById, inferProductIntelligence, PRODUCT_ARCHETYPES, SOURCE_TYPES, provenanceIssues, type ProductIntelligence } from "@/lib/intelligence/taxonomy";
import { designDirectivesFromBrief, inferDesignGrammar } from "@/lib/intelligence/grammar";
import { resolvePackaging } from "@/lib/catalog/packagingResolver";
import {
  BASIS_MAX_CONFIDENCE, CATEGORY_KNOWLEDGE, CODEX_PREPACKAGED_LABELLING, UN_GHS, categoryKnowledgeIssues, inferCategoryKnowledge, shadowCategoryKnowledge,
  type AppliedKnowledge, type CategoryKnowledgeResult,
} from "@/lib/intelligence/category";

const DIR = "src/lib/intelligence/category";
const k = (brief: string, d?: Parameters<typeof inferCategoryKnowledge>[1]) => inferCategoryKnowledge(inferProductIntelligence(brief).intelligence, d);
const ids = (xs: AppliedKnowledge[]) => xs.map((x) => x.id);
const all = (r: CategoryKnowledgeResult) => [...r.conventions, ...r.trustSignals, ...r.informationPriorities.items, ...r.differentiation, ...r.opportunities, ...r.pitfalls, ...r.shelfBehavior, ...r.regulatory];
/** What the category recommends or expects (everything that is not a caution). */
const affirmative = (r: CategoryKnowledgeResult) => all(r).filter((x) => x.kind !== "pitfall" && x.strength !== "avoid");
const pi = (x: Partial<ProductIntelligence>): ProductIntelligence => ({ confidence: "medium", origin: "ruleBased", provenance: [], ...x });
const produced = (x: Partial<{ layout: string; motif: string; artStyle: string }> = {}) => ({ layout: "classic", motif: "none", artStyle: "none", headingFont: "Montserrat", bodyFont: "Montserrat", ...x });

describe("A. base de connaissance", () => {
  it("valide : vocabulaire contrôlé, provenance conforme à la base déclarée, aucune URL", () => {
    expect(CATEGORY_KNOWLEDGE.flatMap(categoryKnowledgeIssues)).toEqual([]);
    expect(new Set(CATEGORY_KNOWLEDGE.map((c) => c.id)).size).toBe(CATEGORY_KNOWLEDGE.length);
    expect(CATEGORY_KNOWLEDGE.map((c) => c.id)).toEqual(expect.arrayContaining(["haircare", "spices", "localBeverages", "skincare", "fragrance", "food", "supplements", "household"]));
    for (const f of readdirSync(DIR)) expect(readFileSync(`${DIR}/${f}`, "utf8"), f).not.toMatch(/https?:\/\//);
  });

  it("13. aucun vocabulaire dupliqué : catégories, rôles, positionnements et provenance viennent de PI-1 / PI-2", () => {
    const code = readdirSync(DIR).map((f) => readFileSync(`${DIR}/${f}`, "utf8")).join("\n");
    expect(code).not.toMatch(/export const (POSITIONING_TERRITORIES|PRODUCT_TAXONOMY|HIERARCHY_ROLES|SOURCE_TYPES|CONFIDENCE_LEVELS)\b/);
    expect(code).not.toMatch(/interface Provenance\b|type ElementRole =|PRODUCT_INTENTS/);
    // the only provenance extension is in PI-1's own model
    expect(SOURCE_TYPES).toEqual(expect.arrayContaining(["regulatory", "market"]));
    expect(provenanceIssues({ sourceType: "regulatory", sourceTitle: "Norme", confidence: "medium" }).join()).toMatch(/reference/);
  });

  it("2. provenance : chaque élément est traçable ; le réglementaire cite une norme réelle avec son champ d'application", () => {
    for (const c of CATEGORY_KNOWLEDGE) for (const it of c.items) {
      expect(provenanceIssues(it.provenance), it.id).toEqual([]);
      expect(it.rationale.length, it.id).toBeGreaterThan(10);
      if (it.basis === "regulatory") {
        expect([CODEX_PREPACKAGED_LABELLING.sourceId, UN_GHS.sourceId], it.id).toContain(it.provenance.sourceId);
        expect(it.scope, it.id).toMatch(/pays|national/);
      }
    }
    const bases = new Set(CATEGORY_KNOWLEDGE.flatMap((c) => c.items.map((i) => i.basis)));
    expect([...bases].sort()).toEqual(["inferred", "internal", "regulatory"]); // no research / expert / market claimed: none was consulted
  });

  it("3. confiance : jamais au-dessus de ce que la base permet ; l'inféré reste « low »", () => {
    for (const c of CATEGORY_KNOWLEDGE) for (const it of c.items) {
      const order = ["unknown", "low", "medium", "high"];
      expect(order.indexOf(it.confidence), it.id).toBeLessThanOrEqual(order.indexOf(BASIS_MAX_CONFIDENCE[it.basis]));
      if (it.basis === "inferred") expect(it.confidence, it.id).toBe("low");
    }
  });
});

describe("B. catégories représentatives", () => {
  it("1. cosmétique capillaire : variante par besoin, confiance INCI, écueils de promesses", () => {
    const r = k("huile capillaire premium naturelle");
    expect(r.matched[0]).toEqual({ id: "haircare", specificity: "subcategory" });
    expect(ids(r.conventions)).toContain("haircare.conv.variantByNeed");
    expect(ids(r.trustSignals)).toContain("haircare.trust.inci");
    expect(ids(r.pitfalls)).toEqual(expect.arrayContaining(["haircare.pit.results", "haircare.pit.greenCliche", "haircare.pit.fakeScience", "haircare.pit.foodConfusion"]));
    expect(ids(r.opportunities)).toContain("haircare.diff.ingredientStory");
    expect(r.informationPriorities).toMatchObject({ from: "haircare", order: expect.arrayContaining(["brand", "subtitle"]) });
    expect(r.dataNeeds.map((n) => n.fact)).toContain("type de cheveux ou besoin visé");
    // a shampoo is not an oil: the oil-specific pitfall does not apply
    expect(ids(k("shampooing").pitfalls)).not.toContain("haircare.pit.foodConfusion");
  });

  it("1. épices : spécifique puis général (épices > alimentaire > étiquetage)", () => {
    const r = k("poivre de Penja");
    expect(r.matched.map((m) => m.id)).toEqual(["spices", "food", "prepackagedFood"]);
    expect(r.informationPriorities.from).toBe("spices");
    expect(ids(r.trustSignals)).toContain("spices.trust.origin");
    expect(ids(r.pitfalls)).toEqual(expect.arrayContaining(["spices.pit.exoticism", "spices.pit.certification", "spices.pit.automaticHeat"]));
    expect(r.regulatory.map((x) => x.provenance.sourceId)).toEqual(["CXS 1-1985"]);
  });

  it("1. boissons locales : reconnues par la région du produit (PI-1), nom de saveur et couleur réelle", () => {
    const r = k("jus de bissap 50 cl");
    expect(inferProductIntelligence("jus de bissap").archetypeId).toBe("localBeverage");
    expect(r.matched[0]).toEqual({ id: "localBeverages", specificity: "region" });
    expect(ids(r.conventions)).toEqual(expect.arrayContaining(["localbev.conv.flavourName", "localbev.conv.colourVisible", "localbev.conv.storage"]));
    expect(ids(r.pitfalls)).toEqual(expect.arrayContaining(["localbev.pit.genericPattern", "localbev.pit.healthClaims"]));
    // a mango juice without a local market is not a "local beverage"
    expect(k("jus de mangue").matched.map((m) => m.id)).toEqual(["prepackagedFood"]);
  });

  it("1. soin, parfum, alimentaire, complément, ménager", () => {
    expect(k("sérum").matched[0].id).toBe("skincare");
    expect(k("crème de luxe anti-âge").matched[0].id).toBe("skincare");
    expect(k("eau de parfum").matched[0].id).toBe("fragrance");
    expect(k("parfum de luxe").matched[0].id).toBe("fragrance");
    expect(k("biscuits").matched.map((m) => m.id)).toEqual(["food", "prepackagedFood"]);
    expect(ids(k("protéine en poudre").conventions)).toContain("supp.conv.doseForm");
    const bleach = k("eau de javel");
    expect(bleach.matched[0].id).toBe("household");
    expect(bleach.regulatory.map((x) => x.provenance.sourceId)).toEqual(["UN GHS"]);
    expect(ids(bleach.pitfalls)).toEqual(expect.arrayContaining(["household.pit.foodLook", "household.pit.childAppeal"]));
  });
});

describe("C. tensions, différenciation, conventions vs recommandations", () => {
  it("8. une tension est « active » quand le produit touche les deux pôles, « latente » sinon", () => {
    const latent = inferCategoryKnowledge(pi({ productCategory: "cosmetics", productSubcategory: "hairOil", positioningTerritories: ["natural"] }));
    expect(latent.tensions.find((t) => t.id === "haircare.t.naturalClinical")?.state).toBe("latent");
    const active = inferCategoryKnowledge(pi({ productCategory: "cosmetics", productSubcategory: "hairOil", positioningTerritories: ["natural", "clinical"] }));
    expect(active.tensions.find((t) => t.id === "haircare.t.naturalClinical")).toMatchObject({ state: "active", guidance: expect.any(String) });
    const local = inferCategoryKnowledge({ ...archetypeById("localBeverage")!.intelligence, marketRegion: ["CentralAfrica", "Global"] });
    expect(local.tensions.find((t) => t.id === "localbev.t.localGlobal")?.state).toBe("active");
  });

  it("7. différenciation : risques de ressemblance et opportunités séparés", () => {
    const r = k("crème capillaire");
    expect(r.differentiation.every((x) => x.strength === "avoid")).toBe(true);
    expect(r.opportunities.every((x) => x.strength === "opportunity")).toBe(true);
    expect(r.opportunities.some((x) => x.basis === "inferred" && x.confidence === "low")).toBe(true);
  });

  it("4-6. conventions = tendances de catégorie ; écueils = mises en garde ; aucune ne décide d'un design", () => {
    const r = k("jus de bissap");
    for (const c of r.conventions) expect(["strongConvention", "weakConvention", "optional"]).toContain(c.strength);
    for (const p of r.pitfalls) expect(p.strength).toBe("avoid");
    expect(JSON.stringify(r)).not.toMatch(/"shapeId"|"layoutId"|#[0-9a-f]{6}|\b\d+px\b/i);
  });
});

describe("D. stéréotypes interdits", () => {
  it("« naturel » ne devient pas automatiquement « vert »", () => {
    for (const b of ["huile capillaire premium naturelle", "sérum", "crème capillaire"]) {
      const r = k(b);
      for (const x of affirmative(r)) expect(x.statement, `${b}: ${x.id}`).not.toMatch(/\bvert\b|\bgreen\b|feuille/i);
      expect(r.pitfalls.some((p) => /vert \+ feuille/.test(p.statement))).toBe(true); // the cliché is named as a pitfall
    }
  });

  it("« local » ne devient pas automatiquement « motif africain »", () => {
    const r = k("jus de bissap");
    for (const x of affirmative(r)) {
      expect(x.statement, x.id).not.toMatch(/wax|kente|bogolan|motif/i);
      expect(x.relates?.decorative ?? [], x.id).not.toContain("patterns");
    }
    expect(ids(r.pitfalls)).toContain("localbev.pit.genericPattern");
    const gr = inferDesignGrammar(inferProductIntelligence("jus de bissap").intelligence);
    expect([...gr.decoration.motifs.prefer, ...gr.decoration.motifs.secondary]).not.toContain("wax");
  });

  it("« premium » ne devient pas automatiquement « noir et or »", () => {
    for (const b of ["parfum de luxe", "crème de luxe anti-âge", "chocolat premium"]) {
      for (const x of affirmative(k(b))) expect(x.statement, `${b}: ${x.id}`).not.toMatch(/noir|black|\bor\b|gold|doré/i);
    }
    expect(k("parfum de luxe").pitfalls.some((p) => /noir \+ or/.test(p.statement))).toBe(true);
  });
});

describe("E. utilisateur, inconnu, données manquantes, faits inventés", () => {
  it("9. une intention explicite suspend une convention (gardée, marquée) ; jamais un écueil ni le réglementaire", () => {
    const d = designDirectivesFromBrief("Je veux un design minimaliste pour mes épices");
    const r = inferCategoryKnowledge(inferProductIntelligence("poivre de Penja").intelligence, d);
    const artisanal = r.conventions.find((c) => c.id === "spices.conv.artisanalCodes")!;
    expect(artisanal).toMatchObject({ status: "overriddenByUser", overriddenBecause: expect.stringMatching(/minimalist/) });
    expect(r.pitfalls.every((p) => p.status === "applies")).toBe(true);
    expect(r.regulatory.every((p) => p.status === "applies")).toBe(true);
    const red = k("jus de bissap", { colors: [{ name: "rouge", intensity: "muted" }] });
    expect(red.conventions.find((c) => c.id === "localbev.conv.vividColours")?.status).toBe("overriddenByUser");
  });

  it("10. catégorie inconnue : rien n'est deviné", () => {
    const r = k("ma nouvelle marque");
    expect(r).toMatchObject({ status: "unknown", matched: [], confidence: "unknown", conventions: [], pitfalls: [], dataNeeds: [] });
    expect(r.informationPriorities).toEqual({ order: [], from: null, items: [] });
    const industrial = inferCategoryKnowledge(pi({ productCategory: "industrial" }));
    expect(industrial.status).toBe("unknown");
  });

  it("11. informations manquantes : listées comme à demander, jamais remplies", () => {
    const r = k("jus de bissap");
    expect(r.dataNeeds.map((n) => n.fact)).toEqual(expect.arrayContaining(["conditions de conservation et durée de vie", "code culturel précis voulu par la marque (le cas échéant)"]));
    for (const n of r.dataNeeds) expect(n.from).toBeTruthy();
    expect(JSON.stringify(r)).not.toMatch(/"origin":"[A-Z]/); // no origin value is produced
  });

  it("12. aucun fait inventé : pas d'étude, d'expert ou de donnée de marché revendiqués ; certifications seulement en écueil", () => {
    for (const c of CATEGORY_KNOWLEDGE) for (const it of c.items) {
      expect(["research", "expert", "market"], it.id).not.toContain(it.basis);
      if (it.kind !== "pitfall") expect(it.statement, it.id).not.toMatch(/\b(IGP|bio|halal)\b.*(obligatoire|requis)|selon une étude|les consommateurs préfèrent|augmente les ventes/i);
    }
  });

  it("le shadow : convention respectée / ignorée / écueil détecté / neutre, sans le brief", () => {
    const wax = shadowCategoryKnowledge("Mon secret : jus de bissap", produced({ motif: "wax", layout: "window" }));
    expect(wax.checks).toEqual(expect.arrayContaining([
      { item: "localbev.conv.colourVisible", verdict: "conventionRespected" },
      { item: "localbev.pit.genericPattern", verdict: "pitfallDetected" },
    ]));
    expect(JSON.stringify(wax)).not.toMatch(/secret/);
    expect(shadowCategoryKnowledge("eau de javel", produced({ artStyle: "mascot" })).pitfallsDetected).toBe(1);
    expect(shadowCategoryKnowledge("eau de parfum", produced({ layout: "pop" })).checks).toEqual(expect.arrayContaining([
      { item: "fragrance.conv.nameDominant", verdict: "conventionIgnored" }, { item: "fragrance.pit.clutter", verdict: "pitfallDetected" },
    ]));
    expect(shadowCategoryKnowledge("ma marque", produced()).checks).toEqual([]);
  });
});

describe("F. isolation et déterminisme", () => {
  it("14. le résolveur de packaging n'est pas influencé (décisions identiques, aucun import croisé)", () => {
    const code = readdirSync(DIR).map((f) => readFileSync(`${DIR}/${f}`, "utf8")).join("\n");
    // ElementRole is reused as a type only; nothing from the resolver or the structure engine is called
    expect(code).not.toMatch(/packagingResolver|resolveStructure|shapeId/);
    const structureImports = code.match(/from "@\/lib\/structure"/g)?.length ?? 0;
    expect(structureImports).toBe(code.match(/import type \{ ElementRole \} from "@\/lib\/structure"/g)?.length ?? 0);
    expect(readFileSync("src/lib/catalog/packagingResolver.ts", "utf8")).not.toMatch(/intelligence\/category/);
    for (const t of ["jus de bissap 50 cl", "eau de javel", "huile capillaire"]) {
      const before = JSON.stringify(resolvePackaging(t));
      k(t);
      expect(JSON.stringify(resolvePackaging(t)), t).toBe(before);
    }
  });

  it("15. PI-2 reste intact : la grammaire est la même avec ou sans PI-3", () => {
    const grammarCode = readdirSync("src/lib/intelligence/grammar").map((f) => readFileSync(`src/lib/intelligence/grammar/${f}`, "utf8")).join("\n");
    expect(grammarCode).not.toMatch(/intelligence\/category/);
    const p = inferProductIntelligence("poivre de Penja").intelligence;
    const before = JSON.stringify(inferDesignGrammar(p));
    inferCategoryKnowledge(p, { positioning: ["minimalist"] });
    expect(JSON.stringify(inferDesignGrammar(p))).toBe(before);
  });

  it("16. déterministe, sans mutation, sans réseau ni IA", () => {
    const spy = vi.spyOn(globalThis, "fetch");
    for (const b of ["jus de bissap", "poivre de Penja", "crème capillaire", "eau de javel"]) expect(JSON.stringify(k(b)), b).toBe(JSON.stringify(k(b)));
    const input = structuredClone(archetypeById("hairOil")!.intelligence);
    const frozen = JSON.stringify(input);
    const r = inferCategoryKnowledge(input, { positioning: ["minimalist"] });
    r.conventions[0].statement = "modifié"; // the output is a copy of the knowledge base
    expect(JSON.stringify(input)).toBe(frozen);
    expect(CATEGORY_KNOWLEDGE.find((c) => c.id === "haircare")!.items[0].statement).not.toBe("modifié");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    for (const f of readdirSync(DIR)) expect(readFileSync(`${DIR}/${f}`, "utf8"), f).not.toMatch(/fetch\(|@anthropic-ai|gemini|process\.env|Math\.random|Date\.now|new Date/);
  });

  it("la route ne fait que journaliser le shadow de catégorie", () => {
    const route = readFileSync("src/app/api/design/route.ts", "utf8");
    const uses = route.split("\n").filter((l) => /shadowCategoryKnowledge\(/.test(l));
    expect(uses).toHaveLength(1);
    expect(uses[0]).toMatch(/logEvent\("info", "CATEGORY_KNOWLEDGE_SHADOW"/);
    expect(route).toMatch(/EDIFY_CATEGORY_SHADOW !== "off"/);
  });

  it("PI-1 étendu sans régression : l'archétype boisson locale porte sa région, le jus de fruits reste générique", () => {
    expect(PRODUCT_ARCHETYPES.length).toBe(54);
    expect(archetypeById("localBeverage")!.intelligence.marketRegion).toEqual(["WestAfrica", "CentralAfrica"]);
    expect(inferProductIntelligence("jus de mangue").archetypeId).toBe("fruitJuice");
    expect(inferProductIntelligence("gingembre").archetypeId).toBe("localBeverage");
  });
});
