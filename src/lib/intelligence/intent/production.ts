/**
 * PI-6 — the production adapter of the Master Design Intent (contract PI-5.0, unchanged), SHADOW MODE.
 *
 *   /api/design: brief + CurrentDesign + decided packaging ─→ buildMasterDesignIntent (once per generation)
 *     ─→ validateMasterDesignIntent ─→ diagnostics (log fields, no user text)
 *     ─→ export shot: the ONLY operational bridge — a canonical SHOT_STYLES id handed to the client, used by
 *        renderExportPreview(…, { shot }) → resolveExportShot → resolveShot → renderHD.
 *
 * The intent never rewrites the design: the spec, its texts, colours, fonts, layout and hierarchy are
 * produced exactly as before. Never throws: an unexpected failure is reported and the product goes on with
 * its existing behaviour (the export keeps its default heroPremium shot).
 */
import type { CurrentDesign } from "@/lib/ai/designSpec";
import type { ShotStyleId } from "@/lib/three/scenePresets";
import { buildMasterDesignIntent } from "./build";
import { isShotStyle } from "./shot";
import type { MasterDesignIntent } from "./types";
import { validateMasterDesignIntent, type IntentValidation } from "./validate";
import { MASTER_DESIGN_INTENT_VERSION } from "./vocabulary";

export interface IntentShadowInput {
  brief: string;
  current: CurrentDesign;
  /** The packaging the generation is locked to (resolver or user choice), null when none. */
  shapeId: string | null;
  references: "active" | "disabled";
}

export interface IntentShadowResult {
  intent: MasterDesignIntent | null;
  validation: IntentValidation | null;
  /** A canonical style the export may use, or null (the export keeps its own default). */
  exportShot: ShotStyleId | null;
  /** Why the shot is or is not handed to the export. */
  exportShotReason: string;
  /** Set when building or validating failed unexpectedly (message only, no stack, no user text). */
  failure: string | null;
}

/** Only the user's texts PI-5 reads (the CurrentDesign fields of its input contract). */
function contentOf(c: CurrentDesign): NonNullable<Parameters<typeof buildMasterDesignIntent>[0]["content"]> {
  return { brandName: c.brandName, productName: c.productName, volume: c.volume, tagline: c.tagline, ingredients: c.ingredients, usage: c.usage, barcode: c.barcode, expiry: c.expiry, production: c.production };
}

/**
 * The export shot rule (observe first): a style pilots the export only when the intent is valid, its shot
 * is resolved to a canonical style, and that decision is at least "medium" confidence. A weak inference
 * (a single recognised word) is observed in the logs but does not change the export picture.
 */
export function exportShotOf(intent: MasterDesignIntent | null, validation: IntentValidation | null): { style: ShotStyleId | null; reason: string } {
  if (!intent || !validation) return { style: null, reason: "noIntent" };
  if (!validation.valid) return { style: null, reason: "invalidIntent" };
  const s = intent.shotIntent;
  if (s.status !== "resolved" || !s.style || !isShotStyle(s.style)) return { style: null, reason: s.status };
  if (s.confidence !== "high" && s.confidence !== "medium") return { style: null, reason: "lowConfidence" };
  return { style: s.style, reason: "applied" };
}

export function shadowMasterDesignIntent(input: IntentShadowInput): IntentShadowResult {
  try {
    const intent = buildMasterDesignIntent({
      brief: input.brief,
      content: contentOf(input.current),
      shapeId: input.shapeId,
      references: input.references,
    });
    const validation = validateMasterDesignIntent(intent);
    const shot = exportShotOf(intent, validation);
    return { intent, validation, exportShot: shot.style, exportShotReason: shot.reason, failure: null };
  } catch (e) {
    return { intent: null, validation: null, exportShot: null, exportShotReason: "failure", failure: e instanceof Error ? e.message.slice(0, 200) : "unknown error" };
  }
}

/**
 * Log fields: decisions, metrics and codes only. Never the brief, a product or brand name, a claim, a
 * text the user typed, nor provenance titles — only ids and counts.
 */
export function intentLogFields(r: IntentShadowResult, buildMs?: number): Record<string, unknown> {
  const m = r.intent, v = r.validation;
  return {
    intentVersion: MASTER_DESIGN_INTENT_VERSION,
    generated: !!m,
    ...(r.failure ? { failure: r.failure } : {}),
    ...(buildMs !== undefined ? { buildMs: Math.round(buildMs * 10) / 10 } : {}),
    ...(m && v ? {
      valid: v.valid,
      errors: v.errors.map((e) => e.code),
      warnings: v.warnings.map((w) => w.code),
      archetypeId: m.product.archetypeId,
      territory: m.visual.territory.value,
      visualDensity: m.visual.visualDensity.value,
      shapeId: m.packaging.shapeId,
      referenceMode: m.references.mode,
      activeReferences: m.references.active.length,
      conflicts: m.conflicts.length,
      conflictFacets: [...new Set(m.conflicts.map((c) => c.facet))].sort(),
      dataNeeds: m.dataNeeds.length,
      confidence: m.confidence,
      shot: { purpose: m.shotIntent.purpose, style: m.shotIntent.style, status: m.shotIntent.status, confidence: m.shotIntent.confidence },
      provenance: [...new Set(m.provenance.map((p) => p.sourceType))].sort(),
    } : {}),
    exportShot: r.exportShot,
    exportShotReason: r.exportShotReason,
  };
}

/** What the API response carries to the client: the contract version and the export shot decision only. */
export function publicIntent(r: IntentShadowResult): { version: string; shotStyle: ShotStyleId | null } {
  return { version: MASTER_DESIGN_INTENT_VERSION, shotStyle: r.exportShot };
}
