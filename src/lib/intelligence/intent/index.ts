/**
 * Edify Packaging Intelligence — PI-5, Master Design Intent: the central visual decision layer. It
 * consumes PI-1 → PI-4, the packaging resolver and the user's explicit intent, and hands a canonical shot
 * style to resolveShot and directions to the 2D engine. It renders nothing. See docs/phase5.
 */
export * from "./vocabulary";
export type * from "./types";
export { buildMasterDesignIntent } from "./build";
export { normalizeIntent, type NormalizedIntent, type ScalarCollision } from "./normalize";
export { canonicalShotStyle, isShotStyle, resolveShotIntent, shotRequestFromIntent } from "./shot";
export { validateMasterDesignIntent, type IntentIssue, type IntentValidation } from "./validate";
export { toDesignBrief } from "./brief";
export { exportShotOf, intentLogFields, publicIntent, shadowMasterDesignIntent, type IntentShadowInput, type IntentShadowResult } from "./production";
