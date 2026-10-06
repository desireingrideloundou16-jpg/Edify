/**
 * PI-1.5 — resolver safety and semantic precision.
 *
 * A. A specific phrase dominates a generic word it contains: "eau de javel", "eau de parfum", "eau
 *    micellaire" are never drinking water; "eau" alone still is.
 * B. Household products are never put in a food / drink pack when a safer supported pack exists
 *    ("lessive" → no sport bottle).
 * C. No generic word overrides a specific phrase: crème capillaire > crème, lait en poudre > lait…
 * D. The mechanism is general (read from the existing product words and the PI-1 archetypes) and
 *    leaves valid matches alone.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { familyOfShape, familyShapes, inferPackagingIntent, isSupportedShape, resolvePackaging, usageOfShape } from "@/lib/catalog/packagingResolver";
import { SPECIFICITY_RANK, specificityOf } from "@/lib/catalog/phraseSpecificity";
import { inferProductIntelligence } from "@/lib/intelligence/taxonomy";

const WATER = ["water-bottle", "water-sachet"];
const isWater = (text: string) => {
  const r = resolvePackaging(text);
  return r.intent.product?.product === "Eau de source" || WATER.includes(r.shapeId ?? "");
};

describe("A. matrice « eau » : la phrase spécifique l'emporte sur le mot générique", () => {
  it("eau : eau, eau de source, eau minérale (naturelle), eau gazeuse, eau pétillante → eau de boisson", () => {
    for (const t of ["eau", "eau de source", "eau minérale", "eau minérale naturelle", "eau gazeuse", "eau pétillante"]) {
      expect(isWater(t), t).toBe(true);
      expect(resolvePackaging(t).shapeId, t).toBe("water-bottle");
      expect(inferProductIntelligence(t).archetypeId === null || inferProductIntelligence(t).archetypeId === "bottledWater", t).toBe(true);
    }
  });

  it("javel : eau de javel, javel, eau de javel parfumée → ménager, jamais de l'eau", () => {
    for (const t of ["eau de javel", "javel", "eau de javel parfumée", "Eau de javel 1 L"]) {
      expect(isWater(t), t).toBe(false);
      const r = resolvePackaging(t);
      expect(r.intent.product, t).toBeNull();
      expect(r.intent.usage, t).toBe("household");
      if (r.shapeId) expect(usageOfShape(r.shapeId), t).not.toBe("food");
      expect(inferProductIntelligence(t).archetypeId, t).toBe("bleach");
      // whatever family the user then picks, never a food or drink pack
      for (const f of ["bouteille", "pot", "boite", "sachet"] as const) {
        const id = resolvePackaging(t, { family: f }).shapeId;
        if (id) expect(usageOfShape(id), `${t} [${f}] → ${id}`).not.toBe("food");
      }
    }
    expect(resolvePackaging("eau de javel", { family: "bouteille" }).shapeId).toBe("shampoo-bottle");
  });

  it("parfum : eau de parfum, eau de toilette, parfum, eau parfumée → flacon de parfum", () => {
    for (const t of ["eau de parfum", "eau de toilette", "parfum", "eau parfumée", "Eau de parfum 50 ml"]) {
      expect(isWater(t), t).toBe(false);
      const r = resolvePackaging(t);
      expect(r.shapeId, t).toBe("perfume-bottle");
      expect(r.intent.usage, t).toBe("cosmetic");
    }
  });

  it("cosmétique : eau micellaire, eau florale → cosmétique, jamais de l'eau de boisson", () => {
    for (const t of ["eau micellaire", "eau florale", "Eau micellaire 400 ml", "eau de rose"]) {
      expect(isWater(t), t).toBe(false);
      const r = resolvePackaging(t);
      expect(r.intent.usage, t).toBe("cosmetic");
      for (const f of ["bouteille", "pot", "boite", "sachet"] as const) {
        const id = resolvePackaging(t, { family: f }).shapeId;
        if (id) expect(usageOfShape(id), `${t} [${f}] → ${id}`).not.toBe("food");
      }
    }
    expect(inferProductIntelligence("eau micellaire").archetypeId).toBe("micellarWater");
    expect(inferProductIntelligence("eau florale").archetypeId).toBe("floralWater");
  });
});

describe("B. ménager : l'usage passe avant la ressemblance de forme", () => {
  it("lessive, lessive liquide, détergent, liquide vaisselle : jamais une gourde ni un emballage alimentaire", () => {
    for (const t of ["lessive", "lessive liquide", "détergent", "liquide vaisselle", "Lessive liquide 1,5 L"]) {
      const r = resolvePackaging(t);
      expect(r.shapeId, t).not.toBe("sport-bottle");
      if (r.shapeId) expect(usageOfShape(r.shapeId), t).not.toBe("food");
      const bottle = resolvePackaging(t, { family: "bouteille" }).shapeId;
      expect(bottle, t).not.toBe("sport-bottle");
      expect(isSupportedShape(bottle), t).toBe(true);
      expect(usageOfShape(bottle!), t).not.toBe("food");
    }
  });

  it("le meilleur flacon supporté pour la lessive : PEHD, non alimentaire, avant toute gourde ou bouteille de boisson", () => {
    const list = familyShapes("bouteille", "lessive");
    expect(list[0].shapeId).toBe("shampoo-bottle");
    const rank = (id: string) => list.findIndex((x) => x.shapeId === id);
    for (const drink of ["sport-bottle", "water-bottle", "juice-bottle", "milk-bottle", "drink-yogurt-bottle"]) expect(rank(drink), drink).toBeGreaterThan(rank("shampoo-bottle"));
    expect(resolvePackaging("lessive liquide").shapeId).toBe("shampoo-bottle");
    // the household packs of the catalog are refused by the engine: none is invented, none is returned
    expect(isSupportedShape("detergent-bottle")).toBe(false);
    for (const t of ["lessive", "lessive liquide"]) expect(resolvePackaging(t, { family: "bouteille" }).shapeId).not.toBe("detergent-bottle");
  });
});

describe("C. aucun mot générique ne domine une expression précise", () => {
  it("« crème capillaire » > « crème » : pot de crème capillaire, pas le pot de crème visage", () => {
    expect(resolvePackaging("crème capillaire").shapeId).toBe("hair-cream-tub");
    expect(resolvePackaging("Crème capillaire 250 ml").shapeId).toBe("hair-cream-tub");
    expect(resolvePackaging("crème").shapeId).toBe("cosmetic-jar");
    expect(inferPackagingIntent("crème capillaire").productMatch).toBe("family");
    expect(inferProductIntelligence("crème capillaire").archetypeId).toBe("hairCream");
  });

  it("« huile capillaire » > « huile » : jamais une huile alimentaire", () => {
    const r = resolvePackaging("huile capillaire");
    expect(r.intent.usage).toBe("cosmetic");
    const bottle = resolvePackaging("huile capillaire", { family: "bouteille" }).shapeId!;
    expect(usageOfShape(bottle)).toBe("cosmetic");
    expect(["oil-bottle-1l", "olive-oil-bottle"]).not.toContain(bottle);
    expect(inferProductIntelligence("huile capillaire").archetypeId).toBe("hairOil");
  });

  it("« lait en poudre » > « lait » ; « lait corporel » n'est pas du lait", () => {
    expect(resolvePackaging("lait en poudre").shapeId).toBe("milk-powder-tin");
    expect(resolvePackaging("lait").shapeId).toBe("milk-carton");
    const body = resolvePackaging("lait corporel");
    expect(body.intent.product).toBeNull();
    expect(body.intent.usage).toBe("cosmetic");
    expect(body.shapeId).not.toBe("milk-carton");
  });

  it("« eau de parfum » > « eau » ; « protéine en poudre » garde la protéine", () => {
    expect(resolvePackaging("eau de parfum").shapeId).toBe("perfume-bottle");
    expect(resolvePackaging("protéine en poudre").shapeId).toBe("protein-tub");
    expect(inferProductIntelligence("protéine en poudre").archetypeId).toBe("proteinPowder");
  });
});

describe("D. un mécanisme général, sans casser les correspondances valides", () => {
  it("niveaux de spécificité : phrase exacte > expression > mot-clé > mot générique", () => {
    expect(SPECIFICITY_RANK.exactPhrase).toBeGreaterThan(SPECIFICITY_RANK.multiWord);
    expect(SPECIFICITY_RANK.multiWord).toBeGreaterThan(SPECIFICITY_RANK.keyword);
    expect(SPECIFICITY_RANK.keyword).toBeGreaterThan(SPECIFICITY_RANK.generic);
    expect(specificityOf("eau de javel")).toBe("exactPhrase");
    expect(specificityOf("creme capillaire")).toBe("multiWord");
    for (const w of ["eau", "creme", "lait", "huile", "savon"]) expect(specificityOf(w), w).toBe("generic");
    expect(specificityOf("miel")).toBe("keyword");
    expect(specificityOf("parfum", true)).toBe("generic"); // "parfum" inside "parfumée"
  });

  it("aucune nouvelle liste de mots : le lexique vient des produits connus et des archétypes PI-1", () => {
    const code = readFileSync("src/lib/catalog/phraseSpecificity.ts", "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(code).toMatch(/PRODUCT_INTENTS/);
    expect(code).toMatch(/PRODUCT_ARCHETYPES/);
    expect(code).not.toMatch(/"eau de javel"|"eau de parfum"/);
  });

  it("les correspondances valides restent : mot-clé hors de la phrase, même produit, même usage", () => {
    expect(resolvePackaging("savon à l'huile de palme").intent.product?.product).toBe("Savon saponifié à froid");
    expect(resolvePackaging("friandises pour chien").shapeId).toBe("pet-food-bag");
    expect(resolvePackaging("Crème glacée vanille 500 ml").intent.product?.product).toBe("Crème glacée");
    expect(resolvePackaging("Shampooing réparateur 500 ml").shapeId).toBe("shampoo-bottle");
    expect(resolvePackaging("Huile de palme 1 L").intent.product?.product).toBe("Huile de palme");
    expect(familyOfShape(resolvePackaging("boisson gazeuse").shapeId!)).toBe("canette");
  });

  it("déterministe", () => {
    for (const t of ["eau de javel parfumée", "crème capillaire", "lessive"]) expect(JSON.stringify(resolvePackaging(t))).toBe(JSON.stringify(resolvePackaging(t)));
  });
});
