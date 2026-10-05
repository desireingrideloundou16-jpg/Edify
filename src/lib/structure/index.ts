/** Packaging structure: the single structural source of truth (mm). See docs/phase2/structure.md. */
export * from "./types";
export { BLEED_MM, SAFE_MM, MODEL_RULES, STRUCTURE_MODELS, materialThickness, resolveStructure } from "./resolveStructure";
export { validatePackagingStructure } from "./validate";
export { BOX_MODELS, boxParts, isBoxModel, type BoxModel, type BoxPart, type BoxPartFace } from "./profile/boxProfile";
export { cartonConfigFor, cartonDims } from "./profile/cartonProfile";
export { FACE_RIGHT, FACE_UP, bondContacts, contactSlits, endSealBands, innerFoldLines, seamStrips, surfaceWindows, developAssembly, flatDir, glueContacts, outerNormal, rectUnionOutline, rotationTowards, type GlueContact, type DevelopedFold, type DevelopedPanel, type PartMap } from "./develop";
export { BAG_ROOT, bagAssembly, bagDims, bagShape, type BagDims, type FilmPanel, type FilmTriangle } from "./profile/bagProfile";
export { arcSegments, coneToSurface, frustumWall, sectorOutline, sectorPoint, surfaceToCone, tubWall, type FrustumWall } from "./profile/conicalProfile";
export { LEVEL_TOLERANCE_DEG, PRIMARY_ARC_DEG, compositionScore, conicalSafeArea, distanceToSeam, pointInRegion, polarOf, rectInRegion, regionOutline, textOrientationAt, type ConicalSafeArea, type ConicalSafeAreaOptions, type SectorRegion } from "./profile/conicalSafeArea";
export {
  PLACEMENT_GRID_MM, PROTECTED_MAX_PRIORITY, ROLE_GROUP, ROLE_PRIORITY, ROLE_RULES, applyLayout, findValidPlacement, layoutOffsets, placementOrder, planLayout,
  rectInCircle, rectInLayoutRegion, rectsOverlap,
  type ElementGroup, type ElementRole, type PackagingElement, type Placement, type PlacementOptions, type PlacementStatus, type Priority, type Rect, type RegionId,
} from "./profile/conicalLayout";
export { PREFLIGHT_NOT_APPLICABLE, preflightLayout, preflightPlan, type PreflightIssue, type PreflightReport, type PreflightSeverity } from "./profile/conicalPreflight";
export { TRAY_ROOT, trayAssembly, trayDims, type TrayDims } from "./profile/trayProfile";
export { MAILER_ROOT, MAILER_RULES, mailerAssembly, mailerDims, partFaceSize, type MailerDims } from "./profile/mailerProfile";
export { pouchSeals } from "./profile/flexibleProfile";
export { BOTTLE_MODELS, bottleLabel, cylinderWrap, jarLabel, profileLabel, type BottleModel, type ProfileLabel, type WrapModel } from "./profile/labels";
