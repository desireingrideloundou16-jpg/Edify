/**
 * Phase 3C — intelligent packaging selection and 2D/3D synchronisation.
 *
 * A. The 3D views draw the APPLIED design (fullDesign: illustration, logo, applied layout), the very
 *    object the 2D and the PDF draw; thumbnail caches identify images by their source, never as "{}".
 * B. The packaging resolver: product text → ONE supported format, deterministic, with reasons,
 *    alternatives and confidence; ONE human question when it cannot tell; never a refused format.
 * C. Saved projects keep their format, even one no longer offered (no silent migration).
 * D. The AI and the local designer can only use supported formats; a resolver choice is imposed.
 * E. The studio shows a recommended packaging and human families, not the 119 structures.
 * F. Semantic quality: use (food, cosmetic…) before close shape; manual choices kept while they fit.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import { ALL_CATALOG_SHAPES } from "@/lib/catalog/shapes";
import { MODEL_RULES } from "@/lib/structure";
import {
  CLARIFY_FAMILIES, FAMILY_LABEL, SCORE, availableFamilies, decidePackaging, decisionFrom, familyOfShape, familyShapes, inferPackagingIntent,
  isPackagingRelevant, isSupportedShape, legacyDecision, packagingSignature, parseDecision, recommendWhenUnsure, resolvePackaging, supportedShapeIds,
  userChoiceFits, userDecision, usageOfShape, type PackagingFamily,
} from "@/lib/catalog/packagingResolver";
import { ADMISSIBLE_SHAPE_IDS, DEFAULT_SHAPE_ID, SHAPE_IDS, admissibleShapeId, catalogForPrompt, localDesign, sanitizeSpec, type CurrentDesign, type DesignSpec } from "@/lib/ai/designSpec";
import { designIdentityKey, imageIdentity, viewerDesign } from "@/lib/three/designKey";
import { PRODUCT_INTENTS } from "@/lib/catalog/productIntents";
import type { PackagingDesign } from "@/lib/artwork/draw";

const src = (p: string) => readFileSync(p, "utf8");
const REFUSED = SHAPE_ROWS.filter((r) => MODEL_RULES[r[3]].unsupported).map((r) => r[0]);
/** Like a real HTMLImageElement: `src` is a prototype accessor, so JSON.stringify(img) is "{}". */
const img = (s: string) => Object.create({ get src() { return s; }, complete: true, naturalWidth: 10, naturalHeight: 10 }) as HTMLImageElement;
const DESIGN = {
  brandName: "Kola", productName: "Jus de bissap", tagline: "", volume: "33 cl", palette: ["#fff", "#111", "#b3261e", "#e6a700"],
  headingFont: "Inter", bodyFont: "Inter", finishing: "Vernis mat",
} as PackagingDesign;

// ─── A. 3D sync ──────────────────────────────────────────────────────────────

describe("A. synchronisation 2D / 3D", () => {
  it("1. la 2D, la 3D en direct et la vue 3D reçoivent le même design appliqué (fullDesign)", () => {
    const ws = src("src/components/workspace/EdifyWorkspace.tsx");
    const stage = src("src/components/studio/PreviewStage.tsx");
    expect(ws).not.toMatch(/stageBaseDesign/);
    expect(ws).not.toMatch(/baseDesign=\{/);
    expect(ws).toMatch(/<PreviewStage[\s\S]*?design=\{fullDesign\}/);
    const viewer = stage.slice(stage.indexOf("<Packaging3DViewer"), stage.indexOf("/>", stage.indexOf("<Packaging3DViewer")));
    expect(viewer).toMatch(/design=\{design\}/);
    expect(stage).toMatch(/<DielinePreview shape=\{shape\} design=\{design\}/);
    expect(stage).toMatch(/<LiveMini3D shape=\{shape\} design=\{design\}/);
    const v = src("src/components/workspace/Packaging3DViewer.tsx");
    expect(v).toMatch(/design: PackagingDesign;/);
    expect(v).toMatch(/buildPackaging\(spec, viewerDesign\(debounced, logo\)/);
  });

  it("2-4. l'illustration, le logo et la mise en page appliquée arrivent tels quels dans la 3D", () => {
    const art = img("https://cdn/art-A.jpg"), logo = img("data:image/png;base64,LOGO");
    const applied = { ...DESIGN, art, logo, wrapPlacement: { aspect: 2, offsets: { "barcode#0": [0.1, -0.05] as [number, number] } } };
    const built = viewerDesign(applied, img("other-logo"));
    expect(built).toBe(applied); // the applied design itself, not a copy
    expect(built.art).toBe(art);
    expect(built.logo).toBe(logo);
    expect(built.wrapPlacement).toBe(applied.wrapPlacement);
    // no logo in the design yet: the logo loaded by the view is only a fallback
    const fallback = img("loaded-logo");
    const noLogo = viewerDesign({ ...applied, logo: null }, fallback);
    expect(noLogo.logo).toBe(fallback);
    expect(noLogo.art).toBe(art);
  });

  it("5-6. une nouvelle illustration (ou un nouveau logo) change la clé ; deux illustrations ne sont jamais confondues", () => {
    const a = { ...DESIGN, art: img("https://cdn/art-A.jpg") }, b = { ...DESIGN, art: img("https://cdn/art-B.jpg") };
    expect(JSON.stringify(a)).toBe(JSON.stringify({ ...DESIGN, art: {} })); // the old bug: an image is "{}"
    expect(designIdentityKey(a)).not.toBe(designIdentityKey(b));
    expect(designIdentityKey(a)).toBe(designIdentityKey({ ...DESIGN, art: img("https://cdn/art-A.jpg") })); // same source, same key
    expect(designIdentityKey({ ...DESIGN, logo: img("L1") })).not.toBe(designIdentityKey({ ...DESIGN, logo: img("L2") }));
    expect(designIdentityKey(DESIGN)).not.toBe(designIdentityKey(a));
    expect(imageIdentity(null)).toBe("");
    // two long data URLs differing only in the middle
    const mid = (c: string) => `data:image/png;base64,${"A".repeat(5000)}${c}${"B".repeat(5000)}`;
    expect(imageIdentity(img(mid("x")))).not.toBe(imageIdentity(img(mid("y"))));
    expect(src("src/lib/three/thumbnails.ts")).toMatch(/const key = design \? designIdentityKey\(design\) : "neutral";/);
  });
});

// ─── B. Resolver ─────────────────────────────────────────────────────────────

const fam = (t: string) => resolvePackaging(t).family;

describe("B. résolveur de packaging", () => {
  it.each([
    ["Crème hydratante visage 250 ml", "pot"],
    ["Shampooing réparateur 500 ml", "bouteille"],
    ["Jus naturel de mangue 33 cl", "bouteille"],
    ["Protéine whey chocolat 1 kg", "pot"],
    ["Savon liquide 500 ml", "bouteille"],
    ["Crème capillaire 250 ml", "pot"],
    ["Farine de manioc en poudre 1 kg", "sachet"],
    ["Eau minérale 50 cl", "bouteille"],
    ["Miel de fleurs 250 g", "pot"],
  ] as [string, PackagingFamily][])("1-6. « %s » → %s, format supporté", (text, family) => {
    const r = resolvePackaging(text);
    expect(r.family).toBe(family);
    expect(isSupportedShape(r.shapeId)).toBe(true);
    expect(r.needsClarification).toBe(false);
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it("whey → le pot de protéine ; savon liquide → le flacon pompe (mots du catalogue)", () => {
    expect(resolvePackaging("Protéine whey chocolat 1 kg").shapeId).toBe("protein-tub");
    expect(resolvePackaging("Savon liquide 500 ml").shapeId).toBe("pump-bottle");
  });

  it("7 / 13 / 28. produit ambigu → confiance faible, aucune invention, UNE question humaine", () => {
    for (const t of ["Ma marque premium", "Nouveau produit", "Bonbons"]) {
      const r = resolvePackaging(t);
      expect(r.level).toBe("low");
      expect(r.shapeId).toBeNull();
      expect(r.needsClarification).toBe(true);
      expect(r.question!.options).toEqual(CLARIFY_FAMILIES);
      expect(r.question!.options.map((f) => FAMILY_LABEL[f])).toEqual(["Pot", "Bouteille", "Tube", "Boîte", "Sachet"]);
      expect(r.question!.allowUnsure).toBe(true);
      // the answer, or "Je ne sais pas", always lands on a supported format
      for (const f of CLARIFY_FAMILIES) expect(familyOfShape(resolvePackaging(t, { family: f }).shapeId!)).toBe(f);
      expect(isSupportedShape(recommendWhenUnsure(t).shapeId)).toBe(true);
    }
  });

  it("8. un contenant demandé explicitement passe avant l'emballage habituel du produit", () => {
    expect(fam("Crème hydratante en tube 50 ml")).toBe("tube");
    expect(fam("Jus de mangue en canette 33 cl")).toBe("canette");
    expect(fam("Miel en sachet 20 g")).toBe("sachet");
    expect(resolvePackaging("Crème hydratante en tube 50 ml").reasons[0]).toMatch(/vous avez demandé/);
  });

  it("9-10. un format refusé n'est jamais recommandé ; une alternative supportée est proposée et signalée", () => {
    for (const [t, refused] of [["Crème glacée vanille 500 ml", "ice-cream-tub"], ["Pizza artisanale", "pizza-box"]] as const) {
      const r = resolvePackaging(t);
      expect(r.refused?.shapeId).toBe(refused);
      expect(r.shapeId).not.toBe(refused);
      expect(isSupportedShape(r.shapeId)).toBe(true);
      expect(familyOfShape(r.shapeId!)).toBe(familyOfShape(refused));
      expect(r.reasons.join(" ")).toMatch(/n'est pas encore disponible/);
    }
    // across a broad set of products, nothing refused ever comes out (decision or alternatives)
    const texts = [...SHAPE_ROWS.map((r) => `${r[1]} ${r[8]}`), "glace", "pizza", "gobelet", "bidon 5 L", "sac de farine", "boîte d'oeufs"];
    for (const t of texts) {
      const r = resolvePackaging(t);
      if (r.shapeId) expect(REFUSED).not.toContain(r.shapeId);
      for (const a of r.alternatives) expect(REFUSED).not.toContain(a.shapeId);
    }
  });

  it("11-15. niveaux de confiance, raisons et alternatives", () => {
    const high = resolvePackaging("Shampooing réparateur 500 ml"), medium = resolvePackaging("Savon liquide 500 ml"), low = resolvePackaging("Ma marque premium");
    expect([high.level, medium.level, low.level]).toEqual(["high", "medium", "low"]);
    expect(high.confidence).toBeGreaterThan(medium.confidence);
    expect(medium.confidence).toBeGreaterThan(low.confidence);
    for (const r of [high, medium]) {
      expect(r.reasons.length).toBeGreaterThan(0);
      expect(r.alternatives.length).toBe(3);
      for (const a of r.alternatives) {
        expect(isSupportedShape(a.shapeId)).toBe(true);
        expect(a.shapeId).not.toBe(r.shapeId);
      }
    }
    // the score order is the documented priority
    expect(SCORE.asked).toBeGreaterThan(SCORE.product);
    expect(SCORE.product).toBeGreaterThan(SCORE.productFamily);
    expect(SCORE.productFamily).toBeGreaterThanOrEqual(SCORE.stateFitExplicit);
    expect(SCORE.stateFit).toBeGreaterThan(SCORE.contentClose);
  });

  it("16. déterminisme : même entrée → même résultat, même classement", () => {
    for (const t of ["Crème hydratante visage 250 ml", "Ma marque premium", "Pizza artisanale", "Savon liquide 500 ml"]) {
      expect(JSON.stringify(resolvePackaging(t))).toBe(JSON.stringify(resolvePackaging(t)));
      expect(familyShapes("bouteille", t)).toEqual(familyShapes("bouteille", t));
    }
  });

  it("19-20. unités : ml / cl / L = volume ; g / kg = masse, le contexte du produit restant prioritaire", () => {
    expect(inferPackagingIntent("Jus 33 cl").netContent).toMatchObject({ value: 33, unit: "cl", ml: 330 });
    expect(inferPackagingIntent("Huile 1 L").netContent).toMatchObject({ ml: 1000 });
    expect(inferPackagingIntent("Lotion 250 ml").netContent).toMatchObject({ ml: 250 });
    expect(inferPackagingIntent("Riz 1 kg").netContent).toMatchObject({ g: 1000 });
    expect(inferPackagingIntent("Épices 50 g").netContent).toMatchObject({ g: 50 });
    // only the unit is known → a hint, weaker than a word
    expect(inferPackagingIntent("Produit 500 ml")).toMatchObject({ physicalState: "liquid", stateSource: "unit" });
    expect(inferPackagingIntent("Produit 500 g")).toMatchObject({ physicalState: "solid", stateSource: "unit" });
    // context wins over the unit: a cream in ml is creamy, milk powder in g is a powder, honey in g a paste
    expect(inferPackagingIntent("Crème hydratante 250 ml").physicalState).toBe("paste");
    expect(inferPackagingIntent("Lait en poudre 400 g")).toMatchObject({ physicalState: "powder", stateSource: "explicit" });
    expect(inferPackagingIntent("Miel 250 g").physicalState).toBe("paste");
  });
});

// ─── Stability ───────────────────────────────────────────────────────────────

describe("stabilité du packaging (17-18, 11-13)", () => {
  const first = resolvePackaging("Shampooing réparateur 500 ml");
  const current = decisionFrom(first);

  it("une petite modification du texte garde le même packaging", () => {
    for (const t of ["Shampooing réparateur aux huiles naturelles 500 ml", "Shampooing réparateur premium", "Change la couleur en bleu", "Ajoute un logo plus grand"]) {
      const d = decidePackaging(t, current);
      expect(d.action).toBe("keep");
      if (d.action === "keep") expect(d.shapeId).toBe(first.shapeId);
    }
    expect(decidePackaging("Crème hydratante premium", decisionFrom(resolvePackaging("Crème hydratante visage 250 ml"))).action).toBe("keep");
  });

  it("un vrai changement d'intention (autre produit, autre forme, contenant demandé) peut changer le packaging", () => {
    const juice = decidePackaging("Jus de mangue 33 cl", current);
    expect(juice.action).toBe("change");
    const cream = decidePackaging("Crème hydratante visage 250 ml", current);
    expect(cream.action === "change" && cream.resolution.family).toBe("pot");
    const tube = decidePackaging("Shampooing en tube", current);
    expect(tube.action === "change" && tube.resolution.family).toBe("tube");
  });

  it("un choix de l'utilisateur est respecté, sauf s'il demande lui-même un autre contenant", () => {
    const mine = userDecision("cosmetic-jar");
    expect(decidePackaging("Shampooing réparateur 500 ml", mine).action).toBe("keep");
    expect(decidePackaging("Mettez-le en bouteille", mine).action).toBe("change");
  });

  it("une nouvelle création repart du produit ; un brief vague sur un format connu ne pose pas de question", () => {
    expect(decidePackaging("Crème hydratante visage 250 ml", current, { fresh: true }).action).toBe("change");
    expect(decidePackaging("Ma marque premium", current).action).toBe("keep");
    expect(decidePackaging("Ma marque premium", null, { fresh: true }).action).toBe("ask");
  });

  it("le résolveur n'est appelé qu'à la génération, jamais pendant la saisie", () => {
    const ws = src("src/components/workspace/EdifyWorkspace.tsx");
    expect(ws.match(/decidePackaging\(/g)).toHaveLength(1);
    const gen = ws.slice(ws.indexOf("const handleGenerate = async"), ws.indexOf("setIsGenerating(true);", ws.indexOf("const handleGenerate = async")));
    expect(gen).toMatch(/decidePackaging\(prompt, current, \{ fresh: opts\.fresh \}\)/);
    // not in a memo or an effect fed by the text fields
    expect(ws).not.toMatch(/useMemo\(\(\) => (?:decidePackaging|resolvePackaging)/);
    expect(isPackagingRelevant(inferPackagingIntent("Change la couleur en bleu"))).toBe(false);
    expect(packagingSignature(inferPackagingIntent("Shampooing doux"))).toBe(packagingSignature(inferPackagingIntent("Shampooing réparateur bio")));
  });
});

// ─── C. Saved projects ───────────────────────────────────────────────────────

describe("C. anciens projets", () => {
  it("21-23. les 119 identifiants restent dans le catalogue ; un format refusé enregistré s'ouvre tel quel", () => {
    expect(SHAPE_ROWS.length).toBe(119);
    expect(SHAPE_IDS.length).toBe(119);
    for (const id of REFUSED) expect(ALL_CATALOG_SHAPES.some((s) => s.id === id)).toBe(true);
    for (const id of ["ice-cream-tub", "pizza-box", "cosmetic-jar"]) {
      expect(parseDecision(undefined, id)).toMatchObject({ shapeId: id, source: "legacy" });
      expect(parseDecision({ shapeId: id, source: "resolver", signature: "x|y|z", reasons: ["ok"] }, id)).toMatchObject({ shapeId: id, source: "resolver" });
      expect(parseDecision({ shapeId: "other", source: "user" }, id)).toMatchObject({ shapeId: id, source: "legacy" }); // inconsistent → legacy
      expect(parseDecision("garbage", id).shapeId).toBe(id);
    }
  });

  it("24. aucune migration silencieuse : l'ouverture garde le format ; seule une NOUVELLE décision choisit un format supporté", () => {
    const ws = src("src/components/workspace/EdifyWorkspace.tsx");
    const restore = ws.slice(ws.indexOf("const restoreSaved = "), ws.indexOf("};", ws.indexOf("const restoreSaved = ")));
    expect(restore).toMatch(/setShape\(s\);/);
    expect(restore).not.toMatch(/resolvePackaging|decidePackaging|admissibleShapeId/);
    // a supported legacy format is kept by an edit that says nothing about the packaging
    expect(decidePackaging("Change la couleur", legacyDecision("cosmetic-jar"))).toMatchObject({ action: "keep", shapeId: "cosmetic-jar" });
    // a refused legacy format is never kept for a new decision
    const d = decidePackaging("Crème glacée vanille 500 ml", legacyDecision("ice-cream-tub"));
    expect(d.action).toBe("change");
    if (d.action === "change") expect(isSupportedShape(d.resolution.shapeId)).toBe(true);
  });
});

// ─── D. AI and new decisions ─────────────────────────────────────────────────

describe("D. IA et nouvelles créations", () => {
  const current: CurrentDesign = { shapeId: "cosmetic-jar", styleId: "clean-beauty", brandName: "B", productName: "P", volume: "50 ml" };
  const spec = (shapeId: string) => ({ ...localDesign("Crème hydratante", current), shapeId }) as DesignSpec;

  it("25-26. le catalogue de l'IA ne contient que des formats supportés", () => {
    expect([...ADMISSIBLE_SHAPE_IDS].sort()).toEqual([...supportedShapeIds()].sort());
    expect(ADMISSIBLE_SHAPE_IDS.length).toBe(107);
    for (const id of REFUSED) {
      expect(ADMISSIBLE_SHAPE_IDS).not.toContain(id);
      expect(catalogForPrompt().shapes).not.toMatch(new RegExp(`^${id}:`, "m"));
    }
    const route = src("src/app/api/design/route.ts");
    expect(route).toMatch(/shapeId: z\.enum\(ADMISSIBLE_SHAPE_IDS/);
    expect(route).not.toMatch(/z\.enum\(SHAPE_IDS/);
  });

  it("27. un format choisi par le résolveur est imposé, quoi que réponde l'IA ; un format refusé n'est jamais accepté", () => {
    expect(sanitizeSpec(spec("juice-bottle"), current, "protein-tub").shapeId).toBe("protein-tub");
    expect(sanitizeSpec(spec("ice-cream-tub"), current).shapeId).toBe("cosmetic-jar"); // refused → the supported current one
    expect(sanitizeSpec(spec("pizza-box"), { ...current, shapeId: "ice-cream-tub" }).shapeId).toBe(DEFAULT_SHAPE_ID);
    expect(sanitizeSpec(spec("juice-bottle"), current, "ice-cream-tub").shapeId).toBe("juice-bottle"); // a refused lock is ignored
    expect(admissibleShapeId("pizza-box", null)).toBe(DEFAULT_SHAPE_ID);
    const route = src("src/app/api/design/route.ts");
    expect(route).toMatch(/lockShapeId: typeof body\.lockShapeId === "string" && isSupportedShape\(body\.lockShapeId\)/);
    expect(route.match(/sanitizeSpec\([^)]*\), current, msgOpts\.lockShapeId\)/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(route).toMatch(/sanitizeSpec\(await engine\.run\(\), current, msgOpts\.lockShapeId\)/);
    expect(src("src/components/workspace/EdifyWorkspace.tsx")).toMatch(/lockShapeId: isSupportedShape\(decision\.shapeId\) \? decision\.shapeId : null/);
  });

  it("le designer local (secours sans IA) ne renvoie jamais un format refusé", () => {
    for (const p of ["Crème glacée vanille", "Pizza artisanale", "Glace à la mangue", "Bidon d'huile 5 L"]) {
      expect(isSupportedShape(localDesign(p, current).shapeId)).toBe(true);
    }
    expect(isSupportedShape(localDesign("Glace", { ...current, shapeId: "ice-cream-tub" }).shapeId)).toBe(true);
  });

  it("29. aucun appel réseau ni IA pour choisir le packaging (module pur)", () => {
    const resolver = src("src/lib/catalog/packagingResolver.ts");
    expect(resolver).not.toMatch(/fetch\(|anthropic|gemini|gateway|\/api\//i);
    const ws = src("src/components/workspace/EdifyWorkspace.tsx");
    expect(ws.match(/fetch\("\/api\/design"/g)).toHaveLength(1); // still one design call per generation
  });
});

// ─── E. Studio ───────────────────────────────────────────────────────────────

describe("E. interface du packaging", () => {
  const panel = src("src/components/studio/StudioPanel.tsx");
  const tab = panel.slice(panel.indexOf("function ShapeTab("), panel.indexOf("const ART_STYLE_LABELS"));

  it("30. plus de grille brute des 119 formats ni de recherche dans le catalogue", () => {
    expect(panel).not.toMatch(/searchShapes|SHAPE_CATEGORIES|SearchField/);
    expect(tab).not.toMatch(/ALL_CATALOG_SHAPES\.map/);
    expect(tab).toMatch(/Packaging recommandé/);
    expect(tab).toMatch(/familyShapes\(family, packaging\.productText\)/);
  });

  it("31. des familles humaines, avec « Je ne sais pas »", () => {
    expect(tab).toMatch(/availableFamilies\(\)/);
    expect(tab).toMatch(/Je ne sais pas/);
    expect(availableFamilies()).toEqual(expect.arrayContaining(["pot", "bouteille", "tube", "boite", "sachet"]));
    for (const f of availableFamilies()) expect(FAMILY_LABEL[f]).not.toMatch(/[-_]/);
  });

  it("32. aucun identifiant technique affiché : on montre des noms ; les listes ne contiennent que des formats supportés", () => {
    // ids are React keys and look-ups only, never rendered text
    expect(tab).not.toMatch(/>\s*\{(?:c\.shapeId|shape\.id)\}/);
    for (const f of availableFamilies()) {
      const list = familyShapes(f);
      expect(list.length).toBeGreaterThan(0);
      for (const c of list) {
        expect(isSupportedShape(c.shapeId)).toBe(true);
        expect(familyOfShape(c.shapeId)).toBe(f);
        expect(c.name).not.toBe(c.shapeId);
      }
    }
  });

  it("33. un changement manuel est enregistré comme un choix de l'utilisateur", () => {
    const ws = src("src/components/workspace/EdifyWorkspace.tsx");
    const sel = ws.slice(ws.indexOf("const handleSelectShape = "), ws.indexOf("};", ws.indexOf("const handleSelectShape = ")));
    expect(sel).toMatch(/setPackagingDecision\(userDecision\(s\.id\)\)/);
    expect(userDecision("pump-bottle")).toMatchObject({ shapeId: "pump-bottle", source: "user", family: "bouteille" });
    expect(src("src/components/studio/PackagingQuestion.tsx")).toMatch(/Je ne sais pas/);
  });
});

// ─── F. Semantic quality (corrections before checkpoint) ────────────────────

describe("F. qualité sémantique du résolveur", () => {
  const usageOk = (id: string, usage: string | null) => usage === null || usageOfShape(id) === null || usageOfShape(id) === usage;

  it("1. « lait en poudre » → la boîte de lait en poudre du catalogue, pas un stick", () => {
    for (const t of ["Lait en poudre 400 g", "lait en poudre", "Lait en poudre pour bébé 900 g"]) {
      const r = resolvePackaging(t);
      expect(r.shapeId).toBe("milk-powder-tin");
      expect(r.shapeId).not.toBe("stick-pack");
      expect(r.reasons.join(" ")).toMatch(/lait en poudre/);
    }
  });

  it("2. une glace va dans un pot alimentaire, jamais dans un pot de protéine (ni un pot cosmétique)", () => {
    for (const t of ["glace", "Crème glacée vanille 500 ml", "Sorbet mangue 500 ml", "Glace artisanale au chocolat"]) {
      const r = resolvePackaging(t);
      expect(r.refused?.shapeId).toBe("ice-cream-tub");
      expect(isSupportedShape(r.shapeId)).toBe(true);
      expect(r.shapeId).not.toBe("protein-tub");
      expect(familyOfShape(r.shapeId!)).toBe("pot");
      expect(usageOfShape(r.shapeId!)).toBe("food");
    }
  });

  it("3. une pizza ne donne jamais pizza-box (refusé) : une boîte alimentaire supportée à la place", () => {
    for (const t of ["pizza", "Pizza artisanale", "Pizza margherita 33 cm", "Boîte pour pizza"]) {
      const r = resolvePackaging(t);
      expect(r.shapeId).not.toBe("pizza-box");
      for (const a of r.alternatives) expect(a.shapeId).not.toBe("pizza-box");
      expect(isSupportedShape(r.shapeId)).toBe(true);
      expect(familyOfShape(r.shapeId!)).toBe("boite");
      expect(usageOfShape(r.shapeId!)).toBe("food");
    }
  });

  it("4. un choix manuel compatible avec le produit est conservé", () => {
    const tube = userDecision("squeeze-tube");
    expect(decidePackaging("Crème hydratante visage 250 ml", tube)).toMatchObject({ action: "keep", shapeId: "squeeze-tube" });
    expect(decidePackaging("Baume karité 100 ml", tube)).toMatchObject({ action: "keep", shapeId: "squeeze-tube" });
    // same use: the user's taste wins over the usual form
    expect(decidePackaging("Shampooing réparateur 500 ml", userDecision("cosmetic-jar"))).toMatchObject({ action: "keep", shapeId: "cosmetic-jar" });
    expect(decidePackaging("Jus de bissap 50 cl", userDecision("glass-juice-25cl"))).toMatchObject({ action: "keep", shapeId: "glass-juice-25cl" });
  });

  it("5. un choix manuel devenu incompatible après un changement de produit est re-résolu", () => {
    const juice = decidePackaging("Jus de mangue 33 cl", userDecision("squeeze-tube"));
    expect(juice.action).toBe("change");
    if (juice.action === "change") {
      expect(juice.resolution.family).toBe("bouteille");
      expect(usageOfShape(juice.resolution.shapeId!)).toBe("food");
    }
    expect(decidePackaging("Huile de palme 1 L", userDecision("folding-box-standard")).action).toBe("change");
    expect(decidePackaging("Croquettes pour chien 2 kg", userDecision("cosmetic-jar")).action).toBe("change");
    // an explicitly stated form must fit, even for the same use
    expect(userChoiceFits("soap-box", inferPackagingIntent("Savon liquide 500 ml"))).toBe(false);
  });

  it("6. une petite modification du texte ne change pas le packaging", () => {
    const powder = decisionFrom(resolvePackaging("Lait en poudre 400 g"));
    for (const t of ["Lait en poudre entier 400 g", "Lait en poudre 400 g, premium", "Change la couleur en bleu"]) {
      expect(decidePackaging(t, powder)).toMatchObject({ action: "keep", shapeId: "milk-powder-tin" });
    }
    const ice = decisionFrom(resolvePackaging("Crème glacée vanille 500 ml"));
    expect(decidePackaging("Crème glacée vanille bourbon 500 ml", ice)).toMatchObject({ action: "keep", shapeId: ice.shapeId });
    expect(decidePackaging("Crème hydratante visage 250 ml enrichie au karité", userDecision("squeeze-tube"))).toMatchObject({ action: "keep", shapeId: "squeeze-tube" });
  });

  const refusedProducts = PRODUCT_INTENTS.filter((p) => !isSupportedShape(p.shape));

  it("7. pour chaque produit au format refusé, décision et alternatives restent supportées", () => {
    expect(refusedProducts.map((p) => p.shape)).toEqual(expect.arrayContaining(["ice-cream-tub", "pizza-box"]));
    for (const p of refusedProducts) {
      const r = resolvePackaging(`${p.product} ${p.volume}`);
      expect(isSupportedShape(r.shapeId)).toBe(true);
      expect(r.alternatives.length).toBeGreaterThan(0);
      for (const a of r.alternatives) expect(isSupportedShape(a.shapeId)).toBe(true);
    }
  });

  it("8. décision et alternatives sont cohérentes avec l'usage du produit (alimentaire, cosmétique…)", () => {
    const texts = [...refusedProducts.map((p) => `${p.product} ${p.volume}`), "Lait en poudre 400 g", "Jus de mangue 33 cl", "Crème hydratante visage 250 ml", "Protéine whey 1 kg", "Huile d'olive 50 cl"];
    for (const t of texts) {
      const r = resolvePackaging(t);
      expect(r.intent.usage).not.toBeNull();
      expect(usageOk(r.shapeId!, r.intent.usage)).toBe(true);
      for (const a of r.alternatives) expect(usageOk(a.shapeId, r.intent.usage)).toBe(true);
    }
    // the usage is read from the catalog's own words, not from a parallel list of formats
    expect(usageOfShape("protein-tub")).toBe("supplement");
    expect(usageOfShape("yogurt-cup")).toBe("food");
    expect(usageOfShape("cosmetic-jar")).toBe("cosmetic");
    expect(SCORE.usageMismatch).toBeLessThan(-SCORE.sibling - SCORE.category);
  });
});
