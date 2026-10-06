/**
 * PI-1.5 — Product Intelligence shadow mode: a read-only comparison. The existing resolver (or the
 * user's own choice) stays the decision; Product Intelligence only produces a diagnostic.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { decidePackaging, decisionFrom, resolvePackaging, userDecision } from "@/lib/catalog/packagingResolver";
import { shadowLogFields, shadowPackaging, type ActualPackaging } from "@/lib/intelligence/shadow";

const actualOf = (text: string): ActualPackaging => {
  const r = resolvePackaging(text);
  return { shapeId: r.shapeId, source: "resolver", confidence: r.confidence };
};
const deepFreeze = <T,>(o: T): T => {
  if (o && typeof o === "object") { Object.freeze(o); Object.values(o).forEach(deepFreeze); }
  return o;
};

afterEach(() => vi.restoreAllMocks());

describe("Shadow Mode — lecture seule", () => {
  it("1-2. ne modifie pas la décision réelle ; le résolveur reste l'autorité", () => {
    for (const t of ["eau minérale", "eau de javel", "lessive", "biscuits sablés"]) {
      const resolution = deepFreeze(resolvePackaging(t));
      const before = JSON.stringify(resolution);
      const actual = deepFreeze({ shapeId: resolution.shapeId, source: "resolver" as const, confidence: resolution.confidence });
      const s = shadowPackaging(t, actual); // frozen inputs: any write would throw
      expect(JSON.stringify(resolution)).toBe(before);
      expect(JSON.stringify(resolvePackaging(t))).toBe(before);
      expect(s.currentDecision).toBe(resolution.shapeId);
    }
  });

  it("3-4. Product Intelligence peut recommander autre chose : la différence est enregistrée", () => {
    const s = shadowPackaging("biscuits sablés", actualOf("biscuits sablés"));
    expect(s).toMatchObject({ currentDecision: "cookie-tin", currentFamily: "boite-metal", intelligentFamily: "sachet", sameDecision: false, sameFamily: false, differenceReason: "currentInOtherPreferredFamily" });
    expect(s.intelligentFamilies).toContain("boite-metal");
    const user = shadowPackaging("Shampooing réparateur 500 ml", { shapeId: "cosmetic-jar", source: "user" });
    expect(user).toMatchObject({ currentSource: "user", currentFamily: "pot", intelligentFamily: "bouteille", differenceReason: "currentOutsidePreferredFamilies" });
    const undecided = shadowPackaging("eau de javel", actualOf("eau de javel"));
    expect(undecided).toMatchObject({ currentDecision: null, intelligentDecision: "shampoo-bottle", differenceReason: "currentUndecided" });
  });

  it("5. une même décision est enregistrée comme telle", () => {
    const s = shadowPackaging("lait en poudre", actualOf("lait en poudre"));
    expect(s).toMatchObject({ currentDecision: "milk-powder-tin", intelligentDecision: "milk-powder-tin", sameDecision: true, sameFamily: true, differenceReason: "same", archetypeId: "milkPowder" });
  });

  it("6. les confiances sont conservées, sans mélange", () => {
    const r = resolvePackaging("jus de mangue");
    const s = shadowPackaging("jus de mangue", { shapeId: r.shapeId, source: "resolver", confidence: r.confidence });
    expect(s.currentConfidence).toBe(r.confidence);
    expect(s.intelligentConfidence).toBe(resolvePackaging("jus de mangue", { family: "bouteille" }).confidence);
    expect(s.productIntelligenceConfidence).toBe("low"); // a single word: PI never claims more
    expect(shadowPackaging("x", { shapeId: null, source: "locked" }).currentConfidence).toBeNull();
  });

  it("7-8. aucune requête réseau, aucun appel IA", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    for (const t of ["eau", "eau de javel", "parfum", "café"]) shadowPackaging(t, actualOf(t));
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const f of ["src/lib/intelligence/shadow.ts", ...["vocabulary", "productTaxonomy", "provenance", "materials", "types", "archetypes", "infer", "resolverAdapter", "validate", "index"].map((n) => `src/lib/intelligence/taxonomy/${n}.ts`), "src/lib/catalog/phraseSpecificity.ts"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/fetch\(|@anthropic-ai|@\/lib\/ai\/|gemini|XMLHttpRequest|process\.env/);
    }
  });

  it("9. un choix manuel compatible reste respecté (le shadow n'y change rien)", () => {
    const tube = userDecision("squeeze-tube");
    const before = decidePackaging("Crème hydratante visage 250 ml", tube);
    const s = shadowPackaging("Crème hydratante visage 250 ml", { shapeId: tube.shapeId, source: "user" });
    expect(before).toMatchObject({ action: "keep", shapeId: "squeeze-tube" });
    expect(decidePackaging("Crème hydratante visage 250 ml", tube)).toEqual(before);
    expect(s).toMatchObject({ currentDecision: "squeeze-tube", currentSource: "user" });
  });

  it("10. un choix manuel incompatible suit toujours le comportement existant du résolveur", () => {
    const wrong = userDecision("squeeze-tube");
    const before = decidePackaging("Jus de mangue 33 cl", wrong);
    shadowPackaging("Jus de mangue 33 cl", { shapeId: wrong.shapeId, source: "user" });
    expect(before.action).toBe("change");
    expect(decidePackaging("Jus de mangue 33 cl", wrong)).toEqual(before);
    const kept = decisionFrom(resolvePackaging("Lait en poudre 400 g"));
    expect(decidePackaging("Lait en poudre 400 g, premium", kept)).toMatchObject({ action: "keep", shapeId: "milk-powder-tin" });
  });

  it("11-12. aucun lien avec l'état de design appliqué, la 2D, la 3D, le PDF ou le projet sauvegardé", () => {
    const code = readFileSync("src/lib/intelligence/shadow.ts", "utf8");
    expect(code).not.toMatch(/@\/lib\/(artwork|three|print|structure|design|supabase)|@\/components|AppliedDesignState|fullDesign|localStorage/);
    // the only production use: one log line in the design API, never in its response
    const route = readFileSync("src/app/api/design/route.ts", "utf8");
    const uses = route.split("\n").filter((l) => /shadowPackaging\(/.test(l));
    expect(uses).toHaveLength(1);
    expect(uses[0]).toMatch(/logEvent\("info", "PACKAGING_SHADOW", shadowLogFields\(shadowPackaging\(/);
    expect(route).not.toMatch(/=\s*shadowPackaging\(/);
    // the log line never carries the brief (lib/log.ts rule)
    const fields = shadowLogFields(shadowPackaging("Mon secret de fabrication : eau de javel", actualOf("eau de javel")));
    expect(JSON.stringify(fields)).not.toMatch(/secret/);
    expect(fields).not.toHaveProperty("input");
  });

  it("cas représentatifs : diagnostic déterministe et cohérent", () => {
    const cases: [string, string | null, string][] = [
      ["eau minérale", "bottledWater", "same"],
      ["eau de javel", "bleach", "currentUndecided"],
      ["eau de parfum", "perfume", "same"],
      ["lessive", "laundryDetergent", "currentUndecided"],
      ["shampooing", "shampoo", "same"],
      ["huile capillaire", "hairOil", "currentUndecided"],
      ["lait en poudre", "milkPowder", "same"],
      ["jus de mangue", "fruitJuice", "same"],
      ["café moulu", "coffee", "same"],
      ["parfum", "perfume", "same"],
      ["ma marque", null, "noProductIntelligence"],
    ];
    for (const [t, archetype, reason] of cases) {
      const s = shadowPackaging(t, actualOf(t));
      expect(s.archetypeId, t).toBe(archetype);
      expect(s.differenceReason, t).toBe(reason);
      expect(s.source).toBe("productIntelligenceShadow");
      expect(JSON.stringify(shadowPackaging(t, actualOf(t))), t).toBe(JSON.stringify(s));
      // only water may be recommended a water bottle; nothing is recommended a sport bottle
      if (archetype !== "bottledWater") expect(s.intelligentDecision, t).not.toBe("water-bottle");
      expect(s.intelligentDecision, t).not.toBe("sport-bottle");
    }
  });
});
