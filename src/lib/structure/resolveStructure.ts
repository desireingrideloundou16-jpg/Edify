/**
 * resolveStructure(): catalog entry → PackagingStructure. The single structural entry point.
 * Pure and deterministic (no DOM, no three.js, no randomness, no network); never mutates input.
 */
import { conicalWrap, foldedSheet, frontBack, gableTopCarton, rigidSetUpBox, tuckEndBox, wrapLabel, type FlatTemplate, type TrayPart } from "./dieline";
import { FACE_UP, developAssembly, flatDir, rotationTowards } from "./develop";
import { BOTTLE_MODELS, profileLabel, type BottleModel } from "./profile/labels";
import { boxPartSurfaces, boxParts, isBoxModel } from "./profile/boxProfile";
import { cartonConfigFor, cartonDims } from "./profile/cartonProfile";
import { MAILER_ROOT, mailerAssembly, partFaceSize } from "./profile/mailerProfile";
import { TRAY_ROOT, trayAssembly } from "./profile/trayProfile";
import { sectorOutline, tubWall } from "./profile/conicalProfile";
import { conicalSafeArea, regionOutline } from "./profile/conicalSafeArea";
import { BAG_ROOT, bagAssembly } from "./profile/bagProfile";
import { pouchSeals } from "./profile/flexibleProfile";
import type { AssemblyFold, AssemblyPart, ClosureKind, Pt, PackagingStructure, PrintSurface, ProfileBuilder, Seal, ShapeModel, StructureFamily, StructureInput } from "./types";

/** Bleed around the flat artwork, mm (moved from print/layout.ts, unchanged). */
export const BLEED_MM = 3;
/** Nominal keep-out margin inside a print surface, mm (not a printer specification). */
export const SAFE_MM = 3;

interface ModelRule {
  family: StructureFamily;
  /** Reason the flat template is refused; absent = supported. */
  unsupported?: string;
  builder?: ProfileBuilder;
  closure: ClosureKind;
}

const NO_TEMPLATE = "Le patron de découpe n'est pas encore disponible pour ce format.";
const CONICAL = "Contenant conique : son étiquette se découpe en arc, pas en rectangle. Le patron n'est pas encore disponible pour ce format.";

/** Every ShapeModel, explicitly (the Record type makes a missing model a compile error). */
export const MODEL_RULES: Record<ShapeModel, ModelRule> = {
  box: { family: "dieline", closure: "none" },
  // Postal mailer: construction defined in 2C-4C-0 (profile/mailerProfile.ts), sheet developed from it in 2C-4C.
  mailer: { family: "dieline", closure: "tuck" },
  // Pizza box and burger clamshell: own constructions, not defined yet (closed block in 3D).
  pizza: { family: "dieline", unsupported: NO_TEMPLATE, closure: "none" },
  clamshell: { family: "dieline", unsupported: NO_TEMPLATE, closure: "none" },
  rigid: { family: "dieline", closure: "none" },
  pillow: { family: "dieline", unsupported: NO_TEMPLATE, closure: "none" },
  // Food tray: reference construction (2C-4D-1, profile/trayProfile.ts), sheet developed from it (2C-4D-2).
  tray: { family: "dieline", closure: "none" },
  // Counter display and moulded pulp (egg box): own constructions, not defined (closed block in 3D).
  display: { family: "dieline", unsupported: NO_TEMPLATE, closure: "none" },
  moulded: { family: "dieline", unsupported: "Pulpe moulée : cet emballage est moulé, il n'a pas de patron de découpe à plat.", closure: "none" },
  carton: { family: "dieline", closure: "none" },
  bottle: { family: "profile", builder: "bottle", closure: "cap" },
  wine: { family: "profile", builder: "bottle", closure: "capsule" },
  dropper: { family: "profile", builder: "bottle", closure: "dropper" },
  pump: { family: "profile", builder: "bottle", closure: "pump" },
  spray: { family: "profile", builder: "bottle", closure: "spray" },
  jug: { family: "profile", builder: "jug", unsupported: NO_TEMPLATE, closure: "cap" },
  jar: { family: "profile", builder: "jar", closure: "lid" },
  tin: { family: "profile", builder: "tin", closure: "lid" },
  // Plastic tubs: conical wall developed exactly as an annular sector (2C-4F-1, profile/conicalProfile.ts).
  tub: { family: "profile", builder: "tub", closure: "lid" },
  // Paper tub (ice cream): the wall is a die-cut board blank with a side seam, a separate bottom and a
  // curled rim — a construction not defined yet. Same 3D as before (conical, former wrap).
  papertub: { family: "profile", builder: "papertub", unsupported: "Pot en carton : la paroi est un flan de carton roulé (couture, fond rapporté, bord roulé), construction pas encore définie. Le patron n'est pas disponible pour ce format.", closure: "lid" },
  cup: { family: "profile", builder: "cup", unsupported: CONICAL, closure: "lid" },
  papertube: { family: "profile", builder: "papertube", closure: "lid" },
  tube: { family: "profile", builder: "tube", closure: "cap" },
  can: { family: "profile", builder: "can", closure: "canEnd" },
  pouch: { family: "flexible", closure: "none" },
  flatpouch: { family: "flexible", closure: "crimp" },
  sachet: { family: "flexible", closure: "crimp" },
  // Film bag with side gussets: construction (2C-4E-1, profile/bagProfile.ts), web developed from it (2C-4E-2).
  bag: { family: "flexible", closure: "heatSeal" },
  // Paper bag (square block bottom): construction not defined; former deformed block in 3D.
  paperbag: { family: "flexible", unsupported: "Sac papier à fond carré : la construction du fond n'est pas encore définie, le patron n'est pas disponible.", closure: "none" },
  shopper: { family: "flexible", unsupported: NO_TEMPLATE, closure: "none" },
};

export const STRUCTURE_MODELS = Object.keys(MODEL_RULES) as ShapeModel[];

/**
 * Nominal corrugated board thickness by flute letter, mm (typical values; E was the former 1.5 mm
 * default for every corrugated board). Other flutes keep that default until a pack needs them.
 */
const FLUTE_MM: Record<string, number> = { e: 1.5, b: 3 };

/**
 * Thickness: read from the material name when it states it ("Carton rigide 1,5 mm"), otherwise
 * a NOMINAL default per material type — a placeholder for later phases, not a printer spec.
 */
export function materialThickness(name: string): { thicknessMm: number; thicknessSource: "material-name" | "default" } {
  const m = name.match(/(\d+(?:[.,]\d+)?)\s*mm\b/i);
  if (m) return { thicknessMm: Number(m[1].replace(",", ".")), thicknessSource: "material-name" };
  const s = name.toLowerCase();
  const nominal =
    /ondul|cannel/.test(s) ? FLUTE_MM[s.match(/(?:ondul\S*|cannelure)\s+([a-z])\b/)?.[1] ?? ""] ?? 1.5
    : /verre/.test(s) ? 2.5
    : /film|pe\b|pp\b|sachet/.test(s) && !/pehd|pet\b/.test(s) ? 0.1
    : /alu|fer blanc|métal|metal/.test(s) ? 0.2
    : /pehd|pet|pp|plastique|plastic/.test(s) ? 0.6
    : /papier/.test(s) ? 0.1
    : 0.45; // board (carton couché, kraft, carton alimentaire…)
  return { thicknessMm: nominal, thicknessSource: "default" };
}

const safeFor = (wMm: number, hMm: number) => Math.min(SAFE_MM, Math.min(wMm, hMm) / 4);

function surface(id: string, label: string, wMm: number, hMm: number, draw: PrintSurface["draw"], extra: Partial<PrintSurface> = {}): PrintSurface {
  return { id, label, wMm, hMm, printable: true, draw, safeMm: safeFor(wMm, hMm), ...extra };
}

/**
 * Flat orientation of the rigid box walls (clockwise). Base seen from below with its front at the
 * top, lid seen from above with its back at the top (the 3D UVs of those faces): a wall reads
 * upright when its top edge points away from (base) or towards (lid) the centre panel.
 */
const RIGID_FLAT_ROTATE: Record<string, 90 | 180 | 270> = {
  "base-back": 180, "base-left": 270, "base-right": 90,
  "lid-back": 180, "lid-left": 90, "lid-right": 270,
};

/**
 * Physical print surfaces of a model, from the definitions the 3D builds with (profile/*):
 * one surface = one id = one size, whether the die-line is supported or not.
 */
/** Outer faces of the mailer's board parts, with the artwork the closed block used to carry. */
const MAILER_KIND: Record<string, PrintSurface["draw"]["kind"]> = { right: "plain", left: "plain", top: "top", bottom: "plain", front: "strip", back: "back" };
const MAILER_ORDER = ["right", "left", "top", "bottom", "front", "back"];

/**
 * Print surfaces of the printed parts of a folded assembly, in `order`, each oriented in the flat
 * sheet where its artwork's top lands once the sheet is developed from `root` (3D UVs, FACE_UP).
 */
function assemblySurfaces(parts: AssemblyPart[], folds: AssemblyFold[], root: typeof MAILER_ROOT, order: string[], kinds: Record<string, PrintSurface["draw"]["kind"]>): PrintSurface[] {
  const dev = developAssembly(parts, folds, root.id, root.map);
  return order.map((id) => {
    const p = parts.find((x) => x.surface?.id === id)!;
    const { wMm, hMm } = partFaceSize(p, p.surface!.face);
    const rotate = rotationTowards(flatDir(dev.panels.find((x) => x.part.id === p.id)!.map, FACE_UP[p.surface!.face]));
    return surface(id, p.label, wMm, hMm, { kind: kinds[id], ...(rotate ? { rotate } : {}) }, { placement: { part: p.group, face: p.surface!.face } });
  });
}

function mailerSurfaces(parts: AssemblyPart[], folds: AssemblyFold[]): PrintSurface[] {
  return assemblySurfaces(parts, folds, MAILER_ROOT, MAILER_ORDER, MAILER_KIND);
}

/** Outer faces of the open tray (no top: the tray is open); the inside is plain board, not printed. */
const TRAY_KIND: Record<string, PrintSurface["draw"]["kind"]> = { right: "side", left: "side", bottom: "plain", front: "front", back: "back" };
const TRAY_ORDER = ["right", "left", "bottom", "front", "back"];

function traySurfaces(parts: AssemblyPart[], folds: AssemblyFold[]): PrintSurface[] {
  return assemblySurfaces(parts, folds, TRAY_ROOT, TRAY_ORDER, TRAY_KIND);
}

/** Film bag: the four outer film panels; the welds stay free of artwork (printArea, like the pouches). */
function bagSurfaces(L: number, W: number, H: number, t: number): PrintSurface[] {
  const { dims: d, parts, folds } = bagAssembly(L, W, H, t);
  const printArea = { x: 0, y: d.sealTop, w: 0, h: d.flatH - d.sealTop - d.sealBottom };
  // Flat orientation of each surface in the web (3D UVs, FACE_UP), like the folded boards.
  const dev = developAssembly(parts, folds, BAG_ROOT.id, BAG_ROOT.map);
  const one = (id: string, w: number, kind: PrintSurface["draw"]["kind"], face: "+z" | "-z" | "+x" | "-x") => {
    const p = parts.find((x) => x.surface?.id === id)!;
    const rotate = rotationTowards(flatDir(dev.panels.find((x) => x.part.id === p.id)!.map, FACE_UP[face]));
    return surface(id, p.label.replace(/ \(moitié .*\)$/, ""), w, d.flatH, { kind, ...(rotate ? { rotate } : {}) }, { printArea: { ...printArea, w }, placement: { part: "body", face } });
  };
  return [one("front", L, "front", "+z"), one("back", L, "back", "-z"), one("gusset-left", d.gusset, "side", "-x"), one("gusset-right", d.gusset, "side", "+x")];
}

/**
 * Plastic tub: the print surface IS the developed wall (annular sector, surface mm): the artwork is
 * laid out in that plane, never squeezed; the band under the lid is not printed.
 */
function tubSurface(L: number, W: number, H: number): PrintSurface {
  const { wall, coveredSlant, frontFraction } = tubWall(L, W, H);
  const printOutline = sectorOutline(wall, wall.rIn, wall.rOut - coveredSlant);
  const xs = printOutline.map((p) => p[0]), ys = printOutline.map((p) => p[1]);
  const printArea = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  return surface("wrap", "Paroi (développée)", wall.width, wall.height, { kind: "wrap", frontFraction }, {
    placement: { part: "label" }, printArea, shape: { outline: sectorOutline(wall), printOutline },
  });
}

function surfacesFor(model: ShapeModel, L: number, W: number, H: number, material: string): PrintSurface[] {
  if (model === "tub") return [tubSurface(L, W, H)];
  if (model === "bag") return bagSurfaces(L, W, H, materialThickness(material).thicknessMm);
  if (model === "tray") {
    const asm = trayAssembly(L, W, H, materialThickness(material).thicknessMm);
    return traySurfaces(asm.parts, asm.folds);
  }
  if (model === "mailer") {
    const asm = mailerAssembly(L, W, H, materialThickness(material).thicknessMm);
    return mailerSurfaces(asm.parts, asm.folds);
  }
  if (isBoxModel(model)) {
    const list = boxPartSurfaces(boxParts(model, L, W, H), safeFor);
    // Reverse tuck end: the top tuck folds over from the back, so it lies upside down in the flat sheet.
    if (model === "box") return list.map((x) => (x.id === "top" ? { ...x, draw: { ...x.draw, rotate: 180 as const } } : x));
    // Rigid box crosses (dieline.ts rigidSetUpBox): walls folded up from the edges of the centre panel.
    if (model === "rigid") return list.map((x) => (RIGID_FLAT_ROTATE[x.id] ? { ...x, draw: { ...x.draw, rotate: RIGID_FLAT_ROTATE[x.id] } } : x));
    return list;
  }
  if (model === "carton") {
    const c = cartonDims(cartonConfigFor(L, W, H));
    return [
      // Starts at the back centre like the mesh UVs, so the front sits at the middle of the wrap.
      surface("body", "Corps", c.perimeter, c.bodyPrintH, { kind: "wrap", frontFraction: L / c.perimeter }, { placement: { part: "body" } }),
      surface("roof-front", "Toit — face avant", L, c.roofSlant, { kind: "top" }, { placement: { part: "roof", face: "+z" } }),
      surface("roof-back", "Toit — dos", L, c.roofSlant, { kind: "top" }, { placement: { part: "roof", face: "-z" } }),
    ];
  }
  if (model === "pouch" || model === "flatpouch" || model === "sachet") {
    const seals = pouchSeals(model, H);
    // Artwork stops at the heat seals (the film is sealed there).
    const printArea = { x: 0, y: seals.top, w: L, h: H - seals.top - seals.bottom };
    const list = [
      surface("front", "Face avant", L, H, { kind: "front" }, { printArea, placement: { part: "body", face: "+z" } }),
      surface("back", "Dos", L, H, { kind: "back" }, { printArea, placement: { part: "body", face: "-z" } }),
    ];
    if (model === "pouch") list.push(surface("gusset", "Soufflet", L * 2, W, { kind: "plain" }, { placement: { part: "body", face: "-y" } }));
    return list;
  }
  const label = profileLabel(model, L, W, H, material);
  if (label) {
    const id = model === "jar" || BOTTLE_MODELS.includes(model as BottleModel) ? "label" : "wrap";
    return [surface(id, "Étiquette", label.arcLengthMm, label.heightMm, { kind: "wrap", frontFraction: label.frontFraction }, { placement: { part: "label" } })];
  }
  return [surface("front", "Face avant", L, H, { kind: "front" })];
}

const KIND_LABEL: Partial<Record<ShapeModel, string>> = {
  can: "Étiquette enveloppante 360°", tin: "Étiquette enveloppante 360°", papertube: "Étiquette enveloppante 360°",
  tube: "Impression tube (à plat)", jar: "Étiquette de pot",
};

/** Flat template of a SUPPORTED model, laid out from its print surfaces. */
function flatFor(model: ShapeModel, L: number, W: number, H: number, surfaces: PrintSurface[], assembly?: PackagingStructure["assembly"]): { template: PackagingStructure["template"]; flat: FlatTemplate; seals?: Seal[] } {
  if (model === "pouch" || model === "flatpouch" || model === "sachet") {
    const doypack = model === "pouch";
    const flat = frontBack(L, H, doypack ? W : 0, doypack ? "Doypack — face, dos et soufflet" : "Sachet — face et dos");
    const sb = pouchSeals(model, H);
    const seals: Seal[] = [{ id: "seal-top", surfaceIds: ["front", "back"], edge: "top", widthMm: sb.top, rect: [0, 0, L * 2, sb.top] }];
    if (sb.bottom > 0) seals.push({ id: "seal-bottom", surfaceIds: ["front", "back"], edge: "bottom", widthMm: sb.bottom, rect: [0, H - sb.bottom, L * 2, sb.bottom] });
    return { template: "frontBack", flat, seals };
  }
  if (model === "box") return { template: "tuckEndBox", flat: tuckEndBox(L, W, H) };
  if (model === "tub") {
    const { wall, coveredSlant } = tubWall(L, W, H);
    const flat = conicalWrap(wall, coveredSlant, "Paroi conique développée (secteur d'anneau) — couture au dos");
    // Composition guides from the same geometry: the project's nominal keep-out (SAFE_MM) as margin.
    const sa = conicalSafeArea(wall, coveredSlant, { radialMarginMm: SAFE_MM });
    const t = sa.textArea, n = 64;
    flat.compositionGuides = [
      { kind: "safe", panel: "wrap", polygon: regionOutline(wall, sa.safe) },
      { kind: "primary", panel: "wrap", polygon: regionOutline(wall, sa.primary) },
      { kind: "text", panel: "wrap", polygon: [[t.x, t.y], [t.x + t.w, t.y], [t.x + t.w, t.y + t.h], [t.x, t.y + t.h]] },
      { kind: "logo", panel: "wrap", polygon: Array.from({ length: n }, (_, i): Pt => [sa.logo.cx + sa.logo.r * Math.cos((2 * Math.PI * i) / n), sa.logo.cy + sa.logo.r * Math.sin((2 * Math.PI * i) / n)]) },
    ];
    flat.composition = { surfaceId: "wrap", safeArea: sa };
    return { template: "conicalWrap", flat };
  }
  if (model === "bag" && assembly) {
    return { template: "sideGussetBag", flat: foldedSheet(assembly.parts, assembly.folds, BAG_ROOT, "Sac film à soufflets — laize, soudure dorsale en aileron, soudures haute et basse", assembly.endSeals ?? []) };
  }
  if (model === "tray" && assembly) {
    return { template: "gluedCornerTray", flat: foldedSheet(assembly.parts, assembly.folds, TRAY_ROOT, "Barquette à coins collés — une feuille, 4 pattes collées") };
  }
  if (model === "mailer" && assembly) {
    return { template: "rollEndTuckFront", flat: foldedSheet(assembly.parts, assembly.folds, MAILER_ROOT, "Boîte postale à rabat d'insertion (type FEFCO 0427) — une feuille, sans colle") };
  }
  if (model === "rigid") {
    // Same parts as the 3D (boxParts): sizes read from their surfaces.
    const part = (prefix: string, centre: TrayPart["centre"]): TrayPart => {
      const c = surfaces.find((x) => x.id === prefix + centre)!;
      return { prefix, centre, L: c.wMm, W: c.hMm, h: surfaces.find((x) => x.id === prefix + "front")!.hMm };
    };
    return { template: "rigidSetUp", flat: rigidSetUpBox(part("base-", "bottom"), part("lid-", "top"), BLEED_MM * 2) };
  }
  if (model === "carton") {
    // Same dimensions as the 3D carton and its "body" / "roof-*" surfaces.
    const c = cartonDims(cartonConfigFor(L, W, H));
    const body = surfaces.find((x) => x.id === "body")!;
    const roof = surfaces.find((x) => x.id === "roof-front")!;
    return { template: "gableTop", flat: gableTopCarton({ L: roof.wMm, W, perimeter: body.wMm, bodyH: body.hMm, roofSlant: roof.hMm, finH: c.ridgeH }) };
  }
  // Profiled containers: one label / wrap surface.
  const s = surfaces[0];
  return { template: "wrapLabel", flat: wrapLabel(s.wMm, s.hMm, KIND_LABEL[model] ?? "Étiquette de flacon", s.id) };
}

/**
 * Why an input cannot be built (phase 2C-4G): an unknown model, or a dimension that is not a finite
 * number > 0. Such an input is refused like an unsupported format — never mapped to another model's
 * construction, never developed with invalid numbers.
 */
function inputProblem(input: StructureInput): string | null {
  if (!Object.prototype.hasOwnProperty.call(MODEL_RULES, input.model)) return `Modèle de packaging inconnu (« ${String(input.model)} ») : aucune construction n'est définie.`;
  const dims: [string, unknown][] = [["longueur", input.lengthMm], ["largeur", input.widthMm], ["hauteur", input.heightMm]];
  for (const [k, v] of dims) if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return `Dimensions invalides (${k} = ${String(v)}) : la construction ne peut pas être calculée.`;
  return null;
}

export function resolveStructure(input: StructureInput): PackagingStructure {
  const model = input.model;
  const rule = MODEL_RULES[model] ?? MODEL_RULES.box;
  const L = input.lengthMm, W = input.widthMm, H = input.heightMm;
  const name = input.material ?? "";
  const problem = inputProblem(input);
  if (problem) {
    // Refused: no surface, no sheet, no profile — nothing downstream can draw or print a guess.
    return {
      family: rule.family, model, outerMm: { L, W, H }, material: { name, ...materialThickness(name) }, closure: { kind: rule.closure },
      bleedMm: BLEED_MM, dieline: "unsupported", dielineNote: problem, printSurfaces: [],
    };
  }
  const base = {
    family: rule.family,
    model,
    outerMm: { L, W, H },
    material: { name, ...materialThickness(name) },
    closure: { kind: rule.closure },
    ...(rule.builder ? { profile: { builder: rule.builder, sectionMm: { L, W } } } : {}),
    ...(model === "mailer" ? { assembly: (({ parts, folds }) => ({ parts, folds }))(mailerAssembly(L, W, H, materialThickness(name).thicknessMm)) } : {}),
    ...(model === "bag" ? { assembly: (({ parts, folds, endSeals }) => ({ parts, folds, endSeals }))(bagAssembly(L, W, H, materialThickness(name).thicknessMm)) } : {}),
    ...(model === "tray" ? { assembly: (({ parts, folds }) => ({ parts, folds }))(trayAssembly(L, W, H, materialThickness(name).thicknessMm)) } : {}),
    bleedMm: BLEED_MM,
  };

  const surfaces = surfacesFor(model, L, W, H, name);
  if (rule.unsupported) {
    return { ...base, dieline: "unsupported", dielineNote: rule.unsupported, printSurfaces: surfaces };
  }
  const { template, flat, seals } = flatFor(model, L, W, H, surfaces, base.assembly);
  // Glue flaps are physical but never printed.
  const glueSurfaces = (flat.glue ?? []).flatMap((g, i) => {
    const xs = g.map((p) => p[0]), ys = g.map((p) => p[1]);
    const id = i === 0 ? "glue" : `glue-${i + 1}`;
    return flat.panels.some((p) => p.surfaceId === id)
      ? [surface(id, "Patte de collage", Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), { kind: "plain" }, { printable: false })]
      : [];
  });
  return {
    ...base,
    dieline: "supported",
    template,
    flatMm: { width: flat.width, height: flat.height },
    kindLabel: flat.kindLabel,
    panels: flat.panels,
    rootPanel: flat.rootPanel,
    cut: flat.cut,
    ...(flat.extraCuts ? { extraCuts: flat.extraCuts } : {}),
    creases: flat.creases,
    glue: flat.glue,
    ...(flat.slits ? { slits: flat.slits } : {}),
    ...(flat.hinges ? { hinges: flat.hinges } : {}),
    ...(flat.glueZones ? { glueZones: flat.glueZones } : {}),
    ...(flat.formedFolds ? { formedFolds: flat.formedFolds } : {}),
    ...(flat.sealZones ? { sealZones: flat.sealZones } : {}),
    ...(flat.innerFolds ? { innerFolds: flat.innerFolds } : {}),
    ...(flat.technicalZones ? { technicalZones: flat.technicalZones } : {}),
    ...(flat.compositionGuides ? { compositionGuides: flat.compositionGuides } : {}),
    ...(flat.composition ? { composition: flat.composition } : {}),
    ...(seals ? { seals } : {}),
    printSurfaces: [...surfaces, ...glueSurfaces],
  };
}
