/**
 * Printable surfaces of profiled containers, computed from the physical model (phase 2C-2).
 *
 * These functions are the ONLY definition of where and how large the label / wrap of a bottle,
 * jar, can, tin, paper tube, tub, cup or tube is. The 3D builders (three/packagingModels.ts) place
 * and texture their labels with them, and resolveStructure() turns them into print surfaces, so
 *   3D printable surface = die-line label = print export
 * by construction. Millimetres. Pure (no three.js, no DOM).
 */
import type { ShapeModel } from "../types";
import { bottleFamily, bottleMetrics, bottlePreset, bottleSection, type BottlePreset } from "./bottleProfile";
import { closurePreset, closureTop } from "./closureProfile";

export interface ProfileLabel {
  /** Developed width printed on the flat label: share of the container perimeter, mm. */
  arcLengthMm: number;
  heightMm: number;
  /** Bottom of the label above the base of the container, mm. */
  yStartMm: number;
  /** Share of the label width used by the front artwork (drawWrap). */
  frontFraction: number;
  /** Share of the container perimeter covered by the label. */
  coverage: number;
}

export const BOTTLE_MODELS = ["bottle", "wine", "dropper", "pump", "spray"] as const;
export type BottleModel = (typeof BOTTLE_MODELS)[number];

/**
 * Bottle: the glass stops where the closure starts (catalog height kept), then the label sits on
 * the straight part of the body, around the real section (circle, ellipse, rounded rectangle).
 */
export function bottleLabel(model: BottleModel, L: number, W: number, H: number, material = "") {
  const family = bottleFamily(model, L, W, material);
  // Closure height: preset fitted on a draft bottle's neck (same two passes as the 3D build).
  const draft = bottleMetrics(bottlePreset(family, L, W, H * 0.85).config);
  const draftClosure = closurePreset(family, H, { width: draft.nw * 2, finishHeight: draft.finishH, finishScale: draft.bead }, draft.yShoulder);
  const glassH = Math.max(H * 0.5, H - closureTop(draftClosure));
  const preset: BottlePreset = bottlePreset(family, L, W, glassH);
  const m = bottleMetrics(preset.config);
  const straight = m.yShoulder - m.rb;
  const coverage = Math.max(0.05, Math.min(1, preset.label.fraction));
  const label: ProfileLabel = {
    arcLengthMm: coverage * m.section.perimeter,
    heightMm: straight * (preset.label.to - preset.label.from),
    yStartMm: m.rb + straight * preset.label.from,
    frontFraction: 0.5,
    coverage,
  };
  return { family, glassH, preset, label };
}

/** Jar: lathe body under a lid; label on the round body (same label builder as the bottles). */
export function jarLabel(L: number, W: number, H: number) {
  const R = Math.min(L, W) / 2;
  const lidH = H * 0.2;
  const bodyH = H - lidH * 0.85;
  const coverage = 0.7;
  const label: ProfileLabel = {
    arcLengthMm: coverage * bottleSection({ width: R * 2, depth: R * 2, bodyShape: "round" }).perimeter,
    heightMm: bodyH * 0.62,
    yStartMm: bodyH * 0.17,
    frontFraction: 0.7,
    coverage,
  };
  return { R, lidH, bodyH, label };
}

export type WrapModel = "can" | "tin" | "papertube" | "tub" | "papertub" | "cup" | "tube";

/**
 * Cylindrical (or conical) bodies printed all around: the wrap is the full circumference of the
 * body radius R (the 3D draws it a hair outside, ×1.002 on cans, only to avoid z-fighting).
 */
export function cylinderWrap(model: WrapModel, L: number, W: number, H: number) {
  const R = Math.min(L, W) / 2;
  const circumference = 2 * Math.PI * R;
  switch (model) {
    case "can": {
      const neck = H * 0.08;
      const height = H - neck * 2;
      return { R, rBottom: R, neck, lidH: 0, bodyH: H, label: wrap(circumference, height, neck, 0.3) };
    }
    case "tube": {
      const height = H * 0.88;
      return { R, rBottom: R, neck: 0, lidH: 0, bodyH: height, label: wrap(circumference, height, H * 0.12, 0.32) };
    }
    default: {
      // tin / papertube / tub / cup: printed body under a lid. Tubs and cups are conical: the bottom
      // radius is the one source of the 3D wall (three/packagingModels.ts) and of the developed wall.
      const lidH = model === "cup" ? H * 0.07 : model === "papertube" ? H * 0.24 : H * 0.18;
      const bodyH = model === "papertube" ? H - lidH * 0.8 : H - lidH * 0.6;
      const tub = model === "tub" || model === "papertub";
      const tapered = tub || model === "cup";
      const rBottom = model === "cup" ? R * 0.72 : tub ? R * 0.86 : R;
      return { R, rBottom, neck: 0, lidH, bodyH, label: wrap(circumference, bodyH, 0, tapered ? 0.3 : 0.28) };
    }
  }
}

function wrap(circumference: number, height: number, yStart: number, frontFraction: number): ProfileLabel {
  return { arcLengthMm: circumference, heightMm: height, yStartMm: yStart, frontFraction, coverage: 1 };
}

/** Printable label / wrap of any profiled model, or null for non-profiled models. */
export function profileLabel(model: ShapeModel, L: number, W: number, H: number, material = ""): ProfileLabel | null {
  if ((BOTTLE_MODELS as readonly string[]).includes(model)) return bottleLabel(model as BottleModel, L, W, H, material).label;
  if (model === "jar") return jarLabel(L, W, H).label;
  if (["can", "tin", "papertube", "tub", "papertub", "cup", "tube"].includes(model)) return cylinderWrap(model as WrapModel, L, W, H).label;
  return null;
}
