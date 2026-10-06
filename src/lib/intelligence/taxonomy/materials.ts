/**
 * PI-1H — what each packaging material usually offers, as design-relevant tendencies (internal rules,
 * not measurements). "variable" means it depends on the grade, coating or construction.
 *
 * No environmental claim is ever derived from a material: recyclabilityClaim is "notClaimed" for every
 * entry. A claim ("recyclable", "compostable") only exists when a user or a cited source states it for
 * a given pack, never because the pack is glass, paper or "biodegradable material".
 */
import type { Provenance } from "./provenance";
import { PI1_ARCHETYPE_SOURCE } from "./provenance";
import type { PackagingMaterial, RecyclabilityClaim, Transparency } from "./vocabulary";

type Tendency = "low" | "medium" | "high" | "variable";

export interface MaterialProfile {
  transparency: Transparency;
  rigidity: Tendency;
  flexibility: Tendency;
  premiumPerception: Tendency;
  barrierPotential: Tendency;
  recyclabilityClaim: RecyclabilityClaim;
  provenance: Provenance;
}

const m = (transparency: Transparency, rigidity: Tendency, flexibility: Tendency, premiumPerception: Tendency, barrierPotential: Tendency): MaterialProfile =>
  ({ transparency, rigidity, flexibility, premiumPerception, barrierPotential, recyclabilityClaim: "notClaimed", provenance: PI1_ARCHETYPE_SOURCE });

export const MATERIAL_PROFILES: Readonly<Record<PackagingMaterial, MaterialProfile>> = {
  glass: m("variable", "high", "low", "high", "high"),
  PET: m("variable", "medium", "medium", "medium", "medium"),
  HDPE: m("translucent", "medium", "medium", "low", "medium"),
  PP: m("variable", "medium", "medium", "low", "medium"),
  aluminum: m("opaque", "variable", "variable", "variable", "high"),
  steel: m("opaque", "high", "low", "variable", "high"),
  paper: m("opaque", "low", "high", "variable", "low"),
  carton: m("opaque", "medium", "low", "variable", "variable"),
  kraft: m("opaque", "variable", "variable", "variable", "low"),
  flexibleFilm: m("variable", "low", "high", "low", "variable"),
  metallizedFilm: m("opaque", "low", "high", "medium", "high"),
  composite: m("opaque", "variable", "variable", "variable", "high"),
  biodegradableMaterial: m("variable", "variable", "variable", "variable", "variable"),
  other: m("variable", "variable", "variable", "variable", "variable"),
};
