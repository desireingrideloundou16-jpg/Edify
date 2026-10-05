/**
 * Packaging structure contract (phase 2C-1): the single structural source of truth that the
 * die-line, the 2D preview, the print export and (later) the 3D assembly, the SVG export, the
 * preflight and the AI Packaging Director all read.
 *
 * Canonical unit: MILLIMETRES, everywhere in this module. Flat layouts use y pointing down
 * with the origin at the top-left of the cut contour (same convention as the print PDF).
 * Pure types: no DOM, no React, no three.js.
 */
import type { ShapeModel } from "@/components/workspace/Modals";
import type { FaceKind } from "@/lib/artwork/draw";
import type { ConicalSafeArea } from "./profile/conicalSafeArea";

export type { ShapeModel, FaceKind };

/** Point in millimetres. */
export type Pt = [number, number];

/**
 * - "dieline": folded board cut from a flat sheet (boxes, cartons).
 * - "profile": rigid container defined by a section and a profile (bottles, jars, cans, tubes);
 *   only its label / wrap is printed flat.
 * - "flexible": film or paper sheets joined by seals or glue (pouches, sachets, bags).
 */
export type StructureFamily = "dieline" | "profile" | "flexible";

/** What the catalog / workspace gives today (PackagingShape and PackagingSpec both satisfy it). */
export interface StructureInput {
  model: ShapeModel;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  material?: string;
}

/**
 * A printable surface, identified by a stable id ("front", "label", "wrap"…) that does not
 * depend on its position in the flat layout or in any array. The same id is meant to be used by
 * the editor, the die-line, the 2D renderer, the 3D texture, the PDF, the SVG and the preflight.
 */
/** Face of a box-like part, by outward axis (front = +z, top = +y), in three.js material order. */
export type BoxFace = "+x" | "-x" | "+y" | "-y" | "+z" | "-z";

/** Rectangle inside a surface, mm, origin at its top-left (y down, like the flat sheet). */
export interface RectMm {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PrintSurface {
  id: string;
  label: string;
  /** Physical size of the whole surface, mm. */
  wMm: number;
  hMm: number;
  /** False for physical surfaces that carry no artwork (glue flap, inside faces, bag opening). */
  printable: boolean;
  /** Area that receives the artwork when smaller than the surface (seals excluded), mm. */
  printArea?: RectMm;
  /**
   * How the artwork engine draws it (artwork/draw.ts). `rotate` is the orientation in the FLAT
   * sheet only, clockwise (a lid that folds over: 180; a wall folded up from a side edge: 90 / 270);
   * the 3D always draws the surface upright. At 90 / 270 the flat panel is hMm wide and wMm high.
   */
  draw: { kind: FaceKind | "wrap"; frontFraction?: number; rotate?: 0 | 90 | 180 | 270 };
  /**
   * Non-rectangular surface (a developed conical wall…): its outline and the part that is printed, in
   * surface mm (y down) inside wMm × hMm. The artwork is drawn into printArea and clipped to
   * printOutline; outside it, the background only.
   */
  shape?: { outline: Pt[]; printOutline: Pt[] };
  /** Where the 3D puts it: part of the pack and, for box-like parts, the face. */
  placement?: { part: "body" | "base" | "lid" | "roof" | "label"; face?: BoxFace };
  /** Keep-out margin for text and important elements, mm (nominal, see SAFE_MM). */
  safeMm: number;
}

/**
 * Heat seal of a flexible pack: part of the physical film, kept free of artwork. `rect` is in
 * flat-sheet coordinates [x, y, w, h]; `widthMm` is the width of the seal band.
 */
export interface Seal {
  id: string;
  surfaceIds: string[];
  edge: "top" | "bottom";
  widthMm: number;
  rect: [number, number, number, number];
}

/** A face of the flat die-line (axis-aligned today), optionally carrying a print surface. */
export interface Panel {
  id: string;
  polygon: Pt[];
  surfaceId?: string;
  /**
   * Closed wraps whose glue seam is not at the surface origin: the panel shows its surface starting
   * at this horizontal position (mm along the surface), wrapping around. Default 0.
   */
  surfaceOffsetMm?: number;
}

/**
 * Fold between two panels of the flat sheet. Produced for templates developed from an assembly
 * (2C-4C mailer); `fold` is seen from the printed (outer) side of the sheet.
 */
export interface Hinge {
  id: string;
  from: string;
  to: string;
  line: [Pt, Pt];
  fold: "mountain" | "valley";
  foldedAngleDeg: number;
  /** How the fold is made (see FoldKind); absent = "crease". */
  kind?: FoldKind;
}

/**
 * "crease": scored by the cutting die (board: rainage). "formed": folded by the forming machine,
 * not scored (film gussets, fins): it must not be drawn or sent to the printer as a crease.
 */
export type FoldKind = "crease" | "formed";

/** A fold line inside one part (not between two parts), e.g. the centre fold of a film gusset. */
export interface InnerFold {
  id: string;
  edge: [Vec3, Vec3];
  kind: FoldKind;
}

/**
 * Technical zone of a flat sheet: still printed, but critical artwork (barcode, QR code, text, logo,
 * batch number, legal mentions) should stay out of it. Generic; produced today for a weld seam.
 */
export interface TechnicalZone {
  id: string;
  kind: "seam" | "glue" | "seal" | "fold" | "margin" | "covered";
  /** Panel of the flat sheet it lies on, and the print surface of that panel (if printed). */
  panel: string;
  surfaceId?: string;
  polygon: Pt[];
  note: string;
}

/**
 * Composition guide of a flat sheet (phase 2C-4F-2): where artwork reads well. Never printed, never a
 * cut / fold / zone: a preview aid computed from the geometry (structure/profile/conicalSafeArea.ts).
 */
export interface CompositionGuide {
  kind: "safe" | "primary" | "text" | "logo";
  panel: string;
  polygon: Pt[];
}

/** Weld / seam area of a flat web (flexible packs), derived from AssemblyPart.bond and EndSeal. */
export interface SealZone {
  id: string;
  kind: BondKind;
  /** Panels of the flat sheet it lies on. */
  panels: string[];
  polygon: Pt[];
  /** Made by the packer after filling (open mouth until then). */
  afterFilling?: boolean;
}

/** Glue area in a flat sheet (see PackagingStructure.glueZones). */
export interface GlueZone {
  panel: string;
  onto: string;
  side: "outer" | "inner";
  polygon: Pt[];
}

/** Which deterministic builder knows the shape of a profiled container (geometry stays in lib/three). */
export type ProfileBuilder = "bottle" | "jar" | "can" | "tin" | "tub" | "papertub" | "cup" | "papertube" | "tube" | "jug";

export type ClosureKind = "cap" | "capsule" | "pump" | "spray" | "dropper" | "lid" | "canEnd" | "crimp" | "tuck" | "heatSeal" | "none";

/** How two parts are joined face to face (not a fold). */
export type BondKind = "glue" | "weld" | "seam";

/**
 * Transverse seal across the end of a formed tube (flexible packs): every listed part is joined at
 * that end over `widthMm`. `afterFilling`: made by the packer once the pack is filled (open mouth).
 */
export interface EndSeal {
  id: string;
  kind: BondKind;
  edge: "top" | "bottom";
  widthMm: number;
  parts: string[];
  afterFilling?: boolean;
}

/** Point in the assembled pack, mm, three.js axes: x = L (right +), y = up (floor 0), z = W (front +). */
export type Vec3 = [number, number, number];

/**
 * Board panel of an assembled (closed) pack, as an axis-aligned slab between `min` and `max`
 * (its thickness is the board's). `surface`: the print surface shown on its outer face, if any.
 */
export interface AssemblyPart {
  id: string;
  label: string;
  /** Rigid group it moves with when the pack opens ("lid" turns about the hinge). */
  group: "base" | "lid";
  min: Vec3;
  max: Vec3;
  surface?: { id: string; face: BoxFace };
  /** Glue joint: this part (a corner flap…) is glued flat against that part. */
  glueTo?: string;
  /**
   * Generic face-to-face joint (glue, weld or seam) with another part — e.g. the welded fins of a
   * film tube. `glueTo` (2C-4D) is the same thing for glue and is kept as is.
   */
  bond?: { to: string; kind: BondKind };
  /** Folds inside this part (formed or scored), e.g. the centre fold of a film gusset. */
  innerFolds?: InnerFold[];
}

/**
 * Fold between two parts of the assembly, along their shared edge (closed state). `from` is the
 * part nearer the bottom panel; `angleDeg` is the folded angle (180 = rolled double wall).
 * `hinge`: the joint that opens and closes the pack (all other folds stay folded once set up).
 */
export interface AssemblyFold {
  id: string;
  from: string;
  to: string;
  edge: [Vec3, Vec3];
  angleDeg: 90 | 180;
  hinge?: boolean;
  /** Absent = "crease" (board). */
  kind?: FoldKind;
}

export interface PackagingStructure {
  family: StructureFamily;
  model: ShapeModel;
  /** Outer dimensions from the catalog, mm: L = front width, W = depth, H = height. */
  outerMm: { L: number; W: number; H: number };
  material: {
    name: string;
    /** Board / film / wall thickness, mm. NOMINAL unless `thicknessSource` is "material-name". */
    thicknessMm: number;
    thicknessSource: "material-name" | "default";
  };

  /** "unsupported" = no valid flat template yet: exports must refuse rather than invent one. */
  dieline: "supported" | "unsupported";
  /** Why the die-line is unsupported (shown to the user by the export). */
  dielineNote?: string;
  /** Flat template used today (supported die-lines only). */
  template?: "tuckEndBox" | "wrapLabel" | "frontBack" | "gableTop" | "rigidSetUp" | "rollEndTuckFront" | "gluedCornerTray" | "sideGussetBag" | "conicalWrap";
  /** Flat sheet size (cut contour bounding box), mm. */
  flatMm?: { width: number; height: number };
  kindLabel?: string;

  panels?: Panel[];
  hinges?: Hinge[];
  rootPanel?: string;
  cut?: Pt[];
  /** Further pieces cut from the same sheet (a separate lid…), each a closed contour like `cut`. */
  extraCuts?: Pt[][];
  /**
   * Glue areas of a folded sheet, derived from AssemblyPart.glueTo: on which panel, glued onto which
   * part, which side of the sheet ("outer" = printed side), and where (flat polygon).
   */
  glueZones?: GlueZone[];
  /** Knife cuts inside the contour that free two touching flaps (open segments, cut like `cut`). */
  slits?: [Pt, Pt][];
  /** Machine-formed folds (FoldKind "formed"), kept apart from the scored creases. */
  formedFolds?: [Pt, Pt][];
  /** Weld / seam areas of a flat web (flexible packs). */
  sealZones?: SealZone[];
  /** Folds inside a panel (AssemblyPart.innerFolds) in the flat sheet; also drawn with their kind. */
  innerFolds?: { id: string; panel: string; kind: FoldKind; line: [Pt, Pt] }[];
  /** Printed areas to keep critical artwork out of (see TechnicalZone). */
  technicalZones?: TechnicalZone[];
  /** Composition guides (safe area, primary area, text and logo areas): preview only, never printed. */
  compositionGuides?: CompositionGuide[];
  /** Composition regions of a developed conical surface (smart layout, phase 2C-4F-3), same geometry as the guides. */
  composition?: { surfaceId: string; safeArea: ConicalSafeArea };
  /** Fold / crease segments as drawn today (hinges with topology come in 2C-5). */
  creases?: [Pt, Pt][];
  glue?: Pt[][];

  /** Profiled containers: section footprint and the builder that knows the profile. */
  profile?: { builder: ProfileBuilder; sectionMm: { L: number; W: number } };
  closure?: { kind: ClosureKind };
  /**
   * Folded construction in 3D (phase 2C-4C-0, mailer): the parts the 3D builds and the folds that
   * join them. The flat template of 2C-4C is meant to be developed from it.
   */
  assembly?: { parts: AssemblyPart[]; folds: AssemblyFold[]; endSeals?: EndSeal[] };
  /** Flexible packs: seal areas [x, y, w, h] in the flat sheet. Declared for 2C-3. */
  seals?: Seal[];

  printSurfaces: PrintSurface[];
  bleedMm: number;
}

/**
 * Phase 3 (AI Packaging Director) — conceptual, NOT implemented: the AI only ever produces an
 * intent such as { model: "pouch", lengthMm: 130, widthMm: 80, heightMm: 220, material:
 * "Kraft + PE" }, validated against StructureInput, then resolveStructure() builds everything.
 * The AI never provides vertices, UVs, flat coordinates or 3D transforms.
 */
export type PackagingIntent = StructureInput;
