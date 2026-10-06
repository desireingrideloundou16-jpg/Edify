/**
 * PI-2 — Packaging Design Grammar: structured visual reasoning from ProductIntelligence (PI-1).
 * Tests check structure and reasoning, never "beauty": preferences, avoidances, priorities, conflicts,
 * user overrides, unknowns, provenance, determinism and isolation from production design.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { archetypeById, inferProductIntelligence, POSITIONING_TERRITORIES, type ProductIntelligence } from "@/lib/intelligence/taxonomy";
import {
  DESIGN_TERRITORIES, GRAMMAR_RULES, PI2_GRAMMAR_SOURCE, RULE_PRIORITIES, STRUCTURE_LAYOUTS, designDirectivesFromBrief, grammarIssues, inferDesignGrammar, ruleIssues,
  shadowDesignGrammar, type DesignGrammar,
} from "@/lib/intelligence/grammar";
import { LAYOUTS } from "@/lib/artwork/compose";

const GRAMMAR_DIR = "src/lib/intelligence/grammar";
const arch = (id: string) => archetypeById(id)!.intelligence;
const pi = (x: Partial<ProductIntelligence>): ProductIntelligence => ({ confidence: "medium", origin: "ruleBased", provenance: [], ...x });
const g = (id: string) => inferDesignGrammar(arch(id));
const conflict = (gr: DesignGrammar, facet: string) => gr.conflicts.find((c) => c.facet === facet);

describe("A. structure et règles", () => {
  it("la base de règles est valide : vocabulaire contrôlé, provenance interne, priorités", () => {
    expect(GRAMMAR_RULES.flatMap(ruleIssues)).toEqual([]);
    expect(new Set(GRAMMAR_RULES.map((r) => r.id)).size).toBe(GRAMMAR_RULES.length);
    for (const r of GRAMMAR_RULES) {
      expect(r.provenance.sourceType, r.id).toBe("internalRule");
      expect(r.provenance.sourceUrl, r.id).toBeUndefined();
      expect(["userBrief", "brandDirection"], r.id).not.toContain(r.priority);
    }
  });

  it("chaque territoire de positionnement PI-1 a sa règle : aucun vocabulaire de positionnement dupliqué", () => {
    for (const p of POSITIONING_TERRITORIES) expect(GRAMMAR_RULES.some((r) => r.when.positioning === p), p).toBe(true);
    for (const t of DESIGN_TERRITORIES) for (const s of t.signature) expect(POSITIONING_TERRITORIES, t.id).toContain(s);
    const vocab = readFileSync(`${GRAMMAR_DIR}/vocabulary.ts`, "utf8");
    expect(vocab).not.toMatch(/"clinical", "scientific", "natural"/); // PI-1's list is imported, not copied
  });

  it("les mises en page proposées sont celles du moteur existant (adaptateur, aucune nouvelle)", () => {
    for (const ls of Object.values(STRUCTURE_LAYOUTS)) for (const l of ls) expect(LAYOUTS).toContain(l);
  });

  it("1. inférence de base : grammaire complète et valide pour chaque archétype PI-1", () => {
    for (const a of ["perfume", "serum", "hairCream", "biscuits", "fruitJuice", "proteinPowder", "bleach", "premiumChocolate", "snacks", "luxuryPerfume", "milkPowder", "coffee"]) {
      const gr = g(a);
      expect(grammarIssues(gr), a).toEqual([]);
      expect(gr.applied.length, a).toBeGreaterThan(1);
      expect(gr.hierarchy.order[0], a).toBe(gr.hierarchy.dominant);
    }
  });
});

describe("B. catégories, positionnement, audience", () => {
  it("2. parfum (luxe) : territoire luxe minimal, espace généreux, densité minimale, point focal isolé", () => {
    const gr = g("luxuryPerfume");
    expect(gr.territory.primary).toBe("luxuryMinimal");
    expect(gr.whitespace.preference.value).toBe("generous");
    expect(gr.density.value).toBe("minimal");
    expect(gr.whitespace.focalIsolation.value).toBe("high");
    expect(gr.hierarchy.dominant).toBe("brand");
    expect(gr.decoration.elements.avoid).toEqual(expect.arrayContaining(["badges"]));
    // preference, not a template: no colour value is ever imposed
    expect(JSON.stringify(gr)).not.toMatch(/#[0-9a-f]{6}|\bgold\b|\bblack\b/i);
    expect(gr.pitfalls.map((p) => p.text).join(" ")).toMatch(/luxe = noir \+ or/);
  });

  it("2. soin (sérum) : registre clinique/scientifique, typographie sans, information structurée", () => {
    const gr = g("serum");
    expect(gr.territory.primary).toBe("clinicalScientific");
    expect(gr.typography.classes.prefer[0]).toBe("sans");
    expect(gr.typography.classes.avoid).toContain("script");
    expect(gr.tone.register.value).toBeLessThan(0);
  });

  it("2. capillaire : la catégorie cosmétique met la marque en tête", () => {
    expect(g("hairCream").hierarchy.order.slice(0, 2)).toEqual(["brand", "productName"]);
  });

  it("2. alimentaire : le produit domine, imagerie d'ingrédient ou photo, registre émotionnel", () => {
    const gr = g("biscuits");
    expect(gr.hierarchy.dominant).toBe("productName");
    expect(gr.imagery.modes.prefer).toEqual(expect.arrayContaining(["photography"]));
    expect(gr.imagery.register.value).toBe("emotional");
  });

  it("2. boisson : emphase verticale, forte visibilité en rayon", () => {
    const gr = g("fruitJuice");
    expect(gr.composition.structures.prefer).toContain("verticalEmphasis");
    expect(gr.visibility.emphasis.value).toBe("high");
    expect(gr.visibility.colorBlock).toBe("preferred");
  });

  it("2. complément : l'information obligatoire est une contrainte produit (priorité supérieure au positionnement)", () => {
    const gr = g("proteinPowder");
    expect(gr.density).toMatchObject({ value: "informationRich", priority: "productConstraint" });
    expect(gr.hierarchy.order.slice(0, 3)).toEqual(["productName", "claim", "netContent"]);
  });

  it("2. ménager : sécurité — jamais de codes alimentaires ni de mascotte", () => {
    const gr = g("bleach");
    expect(gr.imagery.modes.avoid).toContain("ingredient");
    expect(gr.illustration.avoid).toContain("mascot");
    expect(gr.avoidances).toEqual(expect.arrayContaining([expect.objectContaining({ facet: "illustration", value: "mascot", priority: "safetyRegulatory" })]));
    expect(gr.pitfalls.map((p) => p.text).join(" ")).toMatch(/alimentaires ou de boisson/);
  });

  it("4. enfants : l'audience rend le ton ludique et la typographie arrondie", () => {
    const gr = inferDesignGrammar(pi({ productCategory: "food", targetAudience: ["children"] }));
    expect(gr.tone.mood.value).toBe(2);
    expect(gr.typography.traits.prefer).toContain("rounded");
    expect(gr.illustration.prefer).toEqual(expect.arrayContaining(["flat", "mascot"]));
  });

  it("2. premium (chocolat) et grand public (chips) se distinguent", () => {
    const premium = g("premiumChocolate"), mass = g("snacks");
    expect(premium.territory.primary).toBe("premiumEditorial");
    expect(premium.color.complexity.value).toBe("limited");
    expect(premium.whitespace.preference.value).toBe("generous");
    expect(mass.color.saturation.value).toBe("vivid");
    expect(mass.decoration.level.value).toBe("moderate");
    expect(mass.tone.access.value).toBeLessThan(0);
    expect(premium.tone.access.value).toBeGreaterThan(0);
  });

  it("3. le positionnement change la grammaire à catégorie égale", () => {
    const a = inferDesignGrammar(pi({ productCategory: "food", positioningTerritories: ["minimalist"] }));
    const b = inferDesignGrammar(pi({ productCategory: "food", positioningTerritories: ["playful"] }));
    expect(a.decoration.level.value).toBe("none");
    expect(b.decoration.level.value).toBe("moderate");
    expect(a.whitespace.preference.value).toBe("generous");
    expect(b.color.saturation.value).toBe("vivid");
  });
});

describe("C. facettes", () => {
  it("5. typographie : classes, traits, familles, relation titre/texte", () => {
    const lux = g("luxuryPerfume");
    expect(lux.typography.traits.prefer).toEqual(expect.arrayContaining(["refined", "highContrast"]));
    expect(lux.typography.traits.avoid).toEqual(expect.arrayContaining(["heavy"]));
    expect(lux.typography.letterSpacing.value).toBe("generous");
    expect(lux.typography.maxFamilies.value).toBe(1);
    expect(lux.typography.displayBodyRelation.value).toBe("singleFamily");
  });

  it("6. hiérarchie : rôles explicites du moteur (phase 3A), ordre complet sans doublon", () => {
    const gr = g("milkPowder");
    expect(new Set(gr.hierarchy.order).size).toBe(gr.hierarchy.order.length);
    expect(gr.hierarchy.order).toEqual(expect.arrayContaining(["brand", "productName", "netContent", "regulatory", "barcode"]));
    expect(gr.hierarchy.because.length).toBe(1);
  });

  it("7. composition : structures préférées et mises en page existantes correspondantes", () => {
    const gr = g("luxuryPerfume");
    expect(gr.composition.structures.prefer).toEqual(expect.arrayContaining(["typographyLed", "editorial"]));
    expect(gr.composition.structures.avoid).toContain("badgeDriven");
    expect(gr.composition.layouts.prefer.length).toBeGreaterThan(0);
    for (const l of gr.composition.layouts.prefer) expect(gr.composition.layouts.avoid).not.toContain(l);
  });

  it("8. couleur : complexité, saturation, contraste — jamais de valeur RVB", () => {
    const clinical = inferDesignGrammar(pi({ productCategory: "supplements", positioningTerritories: ["clinical"] }));
    expect(clinical.color).toMatchObject({ complexity: { value: "limited" }, accentRole: { value: "functional" }, background: { value: "light" } });
    expect(clinical.color.contrast.value).toBe("high");
    expect(JSON.stringify(clinical.color)).not.toMatch(/#|rgb/);
  });

  it("9. imagerie et illustration : naturel → botanique et trait fin ; technique → pictogrammes", () => {
    const nat = inferDesignGrammar(pi({ productCategory: "cosmetics", positioningTerritories: ["natural"] }));
    expect(nat.imagery.modes.prefer).toEqual(expect.arrayContaining(["botanical"]));
    expect(nat.illustration.prefer).toEqual(expect.arrayContaining(["lineart"]));
    const tech = inferDesignGrammar(pi({ productCategory: "industrial", positioningTerritories: ["technical"] }));
    expect(tech.imagery.modes.prefer).toContain("icon");
  });

  it("10-11. espace et densité : le B2B tolère plus d'information que le parfum", () => {
    const b2b = inferDesignGrammar(pi({ productCategory: "industrial", positioningTerritories: ["technical"] }));
    expect(b2b.density.value).toBe("informationRich");
    expect(g("luxuryPerfume").density.value).toBe("minimal");
    expect(b2b.decoration.level.value).toBe("none");
  });

  it("indices de matière : visuels seulement, aucune finition de fabrication affirmée", () => {
    const gr = g("luxuryPerfume");
    expect(gr.materialCues).toMatchObject({ nature: "visualCue", manufacturing: "notAssessed" });
    expect(gr.materialCues.cues.prefer).toEqual(expect.arrayContaining(["embossed"]));
  });

  it("expression de marque : jamais inventée ; prise du brief seulement", () => {
    expect(g("perfume").brandExpression).toEqual({ status: "notProvided", traits: [] });
    const gr = inferDesignGrammar(arch("perfume"), { brandTraits: ["rebellious"], source: "brand" });
    expect(gr.brandExpression).toEqual({ status: "provided", traits: ["rebellious"] });
    expect(gr.tone.restraint).toMatchObject({ value: 2, priority: "brandDirection" });
  });

  it("visibilité vignette : point focal = rôle dominant, ordre lisible en petit format", () => {
    const gr = g("snacks");
    expect(gr.visibility.focalRole).toBe(gr.hierarchy.dominant);
    expect(gr.visibility.smallSizeOrder[0]).toBe("productName");
    expect(gr.visibility.smallSizeOrder.length).toBeLessThanOrEqual(3);
    expect(gr.visibility.shelfImportance).toBe("critical");
  });

  it("12. évitements : chaque évitement dit sa facette, sa priorité et ses règles", () => {
    const gr = g("luxuryPerfume");
    expect(gr.avoidances.length).toBeGreaterThan(0);
    for (const a of gr.avoidances) {
      expect(RULE_PRIORITIES).toContain(a.priority);
      expect(a.because.length).toBeGreaterThan(0);
    }
    for (const p of gr.pitfalls) expect(p.because.length).toBeGreaterThan(0);
    // the PI-1 archetype's own "avoid" signals are carried as pitfalls
    expect(g("bleach").pitfalls.some((p) => p.because.some((b) => b.startsWith("archetype.")))).toBe(true);
  });
});

describe("D. conflits (résolution déterministe)", () => {
  it("premium + ludique → ludique raffiné, pas un luxe minimal", () => {
    const gr = inferDesignGrammar(pi({ productCategory: "food", positioningTerritories: ["premium", "playful"] }));
    expect(gr.territory.primary).toBe("refinedPlayful");
    expect(conflict(gr, "positioning")).toMatchObject({ strategy: "namedResolution", resolution: "refinedPlayful" });
    expect(gr.color.saturation.value).toBe("balanced");
    expect(gr.illustration.avoid).toContain("mascot");
    expect(gr.tone.mood.value).toBeGreaterThan(0);
  });

  it("naturel + scientifique → naturel prouvé (végétal précis, typographie humaniste)", () => {
    const gr = inferDesignGrammar(pi({ productCategory: "cosmetics", positioningTerritories: ["natural", "scientific"] }));
    expect(gr.territory.primary).toBe("evidenceNatural");
    expect(gr.typography.traits.prefer).toContain("humanist");
    expect(gr.illustration.avoid).toContain("watercolor");
    expect(conflict(gr, "tone.register")?.strategy).toBe("blend");
  });

  it("traditionnel + moderne → héritage contemporain (ornement réduit, ère médiane)", () => {
    const gr = inferDesignGrammar(pi({ productCategory: "food", positioningTerritories: ["traditional", "modern"] }));
    expect(gr.territory.primary).toBe("contemporaryHeritage");
    expect(gr.tone.era.value).toBe(0);
    expect(gr.decoration.elements.avoid).toContain("ornaments");
    expect(gr.typography.displayBodyRelation.value).toBe("contrasting");
  });

  it("grand public + luxe → premium accessible (lisibilité gardée)", () => {
    const gr = inferDesignGrammar(pi({ productCategory: "cosmetics", positioningTerritories: ["luxury"], targetAudience: ["massMarket"] }));
    expect(gr.territory.primary).toBe("masstige");
    expect(conflict(gr, "positioning")?.resolution).toBe("masstige");
    expect(gr.typography.hierarchyStrength.value).toBe("high");
    expect(gr.contrast.typography.value).toBe("high");
  });

  it("technique + émotionnel → registre médian, conflit enregistré", () => {
    const gr = inferDesignGrammar(pi({ productCategory: "household", positioningTerritories: ["technical", "artisanal"] }));
    expect(gr.tone.register.value).toBe(0);
    expect(conflict(gr, "tone.register")).toMatchObject({ between: ["technical", "emotional"], strategy: "blend", resolution: "balanced" });
  });

  it("minimal + riche en information → la contrainte produit l'emporte sur le positionnement", () => {
    const gr = inferDesignGrammar(pi({ productCategory: "supplements", positioningTerritories: ["minimalist"] }));
    expect(gr.density).toMatchObject({ value: "informationRich", priority: "productConstraint" });
    expect(conflict(gr, "density")).toMatchObject({ resolution: "informationRich", strategy: "higherPriority" });
    expect(gr.whitespace.preference.value).toBe("generous");
  });

  it("13. les conflits sont bien formés et ne s'empilent pas", () => {
    for (const a of ["luxuryPerfume", "snacks", "proteinPowder", "traditionalFood"]) {
      const gr = g(a);
      expect(grammarIssues(gr), a).toEqual([]);
      for (const c of gr.conflicts) expect(c.between[0], a).not.toBe(c.between[1]);
    }
  });
});

describe("E. intention explicite de l'utilisateur", () => {
  it("14. « Use bold red » : la couleur demandée est gardée malgré une catégorie retenue", () => {
    const d = designDirectivesFromBrief("Use bold red for my perfume");
    expect(d).toEqual({ source: "brief", colors: [{ name: "rouge", intensity: "vivid" }] });
    const gr = inferDesignGrammar(arch("luxuryPerfume"), d);
    expect(gr.color.saturation).toMatchObject({ value: "vivid", priority: "userBrief" });
    expect(gr.color.requested).toEqual(["rouge (vivid)"]);
    expect(conflict(gr, "saturation")).toMatchObject({ strategy: "userOverride", resolution: "vivid" });
  });

  it("14. « je veux un design minimaliste » : respecté même pour un snack percutant", () => {
    const d = designDirectivesFromBrief("Je veux un design minimaliste pour mes chips");
    expect(d?.positioning).toEqual(["minimalist"]);
    const gr = inferDesignGrammar(arch("snacks"), d);
    expect(gr.territory.primary).toBe("minimal");
    expect(gr.decoration.level).toMatchObject({ value: "none", priority: "userBrief" });
    expect(gr.density).toMatchObject({ value: "minimal", priority: "userBrief" });
    expect(gr.decoration.motifs.prefer).toEqual([]);
  });

  it("une épure demandée n'efface jamais l'information obligatoire : elle la déplace (note de conflit)", () => {
    const gr = inferDesignGrammar(arch("vitaminSupplement"), { positioning: ["minimalist"] });
    expect(gr.density.value).toBe("minimal");
    expect(conflict(gr, "density")?.rationale).toMatch(/jamais supprimées/);
  });

  it("une allégation produit n'est pas une intention de design", () => {
    expect(designDirectivesFromBrief("crème bio au karité")).toBeUndefined();
    expect(designDirectivesFromBrief("jus de fruits rouges 33 cl")).toBeUndefined();
    expect(designDirectivesFromBrief("packaging en rouge vif, style ludique")).toEqual({ source: "brief", colors: [{ name: "rouge", intensity: "vivid" }], positioning: ["playful"] });
  });
});

describe("F. inconnu, provenance, déterminisme, isolation", () => {
  it("15. sans connaissance produit : défauts seulement, confiance « unknown », aucun territoire", () => {
    const gr = inferDesignGrammar(pi({ confidence: "unknown", origin: "unknown" }));
    expect(gr.territory.primary).toBeNull();
    expect(gr.confidence).toBe("unknown");
    expect(gr.typography.classes.prefer).toEqual([]);
    expect(gr.whitespace.preference.priority).toBe("aestheticDefault");
    expect(gr.tone.mood).toEqual({ value: "unknown", priority: null, because: [] });
    expect(grammarIssues(gr)).toEqual([]);
  });

  it("16. provenance : règles internes signalées comme telles, utilisateur tracé, jamais « high »", () => {
    const gr = inferDesignGrammar(arch("perfume"), { positioning: ["minimalist"] });
    expect(gr.provenance[0]).toEqual(PI2_GRAMMAR_SOURCE);
    expect(gr.provenance.some((p) => p.sourceType === "user")).toBe(true);
    expect(gr.confidence).not.toBe("high");
    expect(inferDesignGrammar({ ...arch("perfume"), confidence: "high" }).confidence).toBe("medium");
    expect(inferDesignGrammar(inferProductIntelligence("jus").intelligence).confidence).toBe("low");
    for (const f of readdirSync(GRAMMAR_DIR)) expect(readFileSync(`${GRAMMAR_DIR}/${f}`, "utf8"), f).not.toMatch(/https?:\/\//);
  });

  it("aucune affirmation commerciale non sourcée dans les règles", () => {
    const text = GRAMMAR_RULES.map((r) => `${r.rationale} ${(r.effects.pitfalls ?? []).join(" ")}`).join(" ");
    expect(text).not.toMatch(/vend plus|augmente les ventes|garantit|les consommateurs préfèrent|increases sales|customers prefer/i);
  });

  it("17. déterministe : même entrée → même sortie", () => {
    for (const a of ["luxuryPerfume", "snacks", "bleach"]) expect(JSON.stringify(g(a))).toBe(JSON.stringify(g(a)));
  });

  it("18. aucune mutation de l'entrée", () => {
    const input = structuredClone(arch("premiumChocolate")) as ProductIntelligence;
    const frozen = JSON.stringify(input);
    const deep = <T,>(o: T): T => { if (o && typeof o === "object") { Object.freeze(o); Object.values(o).forEach(deep); } return o; };
    const d = deep({ positioning: ["minimalist" as const], colors: [{ name: "rouge" }] });
    const gr = inferDesignGrammar(deep(input), d);
    expect(JSON.stringify(input)).toBe(frozen);
    gr.archetypeSignals.colorDirection = { primary: ["x"] }; // the output is a copy, not the input
    expect(JSON.stringify(input)).toBe(frozen);
  });

  it("19. aucun appel réseau ni IA ; aucune dépendance au rendu 2D/3D/PDF ni à l'état de design", () => {
    const spy = vi.spyOn(globalThis, "fetch");
    shadowDesignGrammar("parfum de luxe", { layout: "minimal", motif: "none", artStyle: "none", headingFont: "Montserrat", bodyFont: "Montserrat" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    for (const f of readdirSync(GRAMMAR_DIR)) {
      const code = readFileSync(`${GRAMMAR_DIR}/${f}`, "utf8");
      expect(code, f).not.toMatch(/fetch\(|@anthropic-ai|@\/lib\/ai\/(gateway|gemini|suggest)|process\.env|Math\.random|Date\.now|new Date/);
      expect(code, f).not.toMatch(/@\/lib\/(three|print|design\/state)|@\/components\/workspace\/(EdifyWorkspace|Packaging3DViewer)|AppliedDesignState/);
    }
  });

  it("20. compatible avec la sortie de PI-1 (brief → PI-1 → PI-2)", () => {
    for (const brief of ["eau de parfum", "lait en poudre 400 g", "whey protéine", "eau de javel", "gari blanc", "crème capillaire"]) {
      const { intelligence } = inferProductIntelligence(brief);
      const gr = inferDesignGrammar(intelligence);
      expect(grammarIssues(gr), brief).toEqual([]);
      expect(gr.territory.signals, brief).toEqual(expect.arrayContaining(intelligence.positioningTerritories ?? []));
    }
  });
});

describe("G. shadow : lecture seule", () => {
  it("compare le design produit à la grammaire sans rien modifier, sans le brief dans le résultat", () => {
    const produced = Object.freeze({ layout: "pop", motif: "dots", artStyle: "mascot", headingFont: "Montserrat", bodyFont: "Montserrat" });
    const s = shadowDesignGrammar("Mon secret : parfum de luxe", produced);
    expect(s).toMatchObject({ source: "designGrammarShadow", archetypeId: "luxuryPerfume", territory: "luxuryMinimal" });
    expect(s.layout.verdict).toBe("avoided"); // "pop" realises the badge-driven structure the grammar avoids
    expect(["preferred", "secondary", "neutral", "avoided", "unknown"]).toContain(s.headingFont.verdict);
    expect(JSON.stringify(s)).not.toMatch(/secret/);
  });

  it("la route ne fait que journaliser le shadow ; la réponse n'en dépend pas", () => {
    const route = readFileSync("src/app/api/design/route.ts", "utf8");
    const uses = route.split("\n").filter((l) => /shadowDesignGrammar\(/.test(l));
    expect(uses).toHaveLength(1);
    expect(uses[0]).toMatch(/logEvent\("info", "DESIGN_GRAMMAR_SHADOW"/);
    expect(route).not.toMatch(/=\s*shadowDesignGrammar\(/);
    expect(route).toMatch(/spec: localSpec,/);
  });
});
