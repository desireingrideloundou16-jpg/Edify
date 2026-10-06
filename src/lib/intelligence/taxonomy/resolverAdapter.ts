/**
 * PI-1O — the one bridge between semantic intelligence and the existing packaging resolver
 * (catalog/packagingResolver.ts). The resolver stays the only authority on supported structures; the
 * taxonomy never names a structure. The adapter:
 *   - maps semantic families (bottle, tub, dropper…) to the resolver's human families (bouteille, pot…);
 *   - steps in only where the resolver would otherwise ask the user ("Quel type de packaging ?"): the
 *     product's preferred families answer that question, through the resolver itself (opts.family).
 * A container the user asked for, and every confident resolver decision, are returned untouched.
 */
import { availableFamilies, resolvePackaging, type PackagingFamily, type PackagingResolution, type PhysicalState as ResolverPhysicalState } from "@/lib/catalog/packagingResolver";
import type { ProductIntelligence } from "./types";
import type { OrUnknown, PhysicalState, SemanticPackagingFamily } from "./vocabulary";

/** null: no human family of the resolver covers it yet (the family is skipped, never forced). */
export const SEMANTIC_TO_RESOLVER_FAMILY: Readonly<Record<SemanticPackagingFamily, PackagingFamily | null>> = {
  bottle: "bouteille", dropper: "bouteille", spray: "bouteille", pump: "bouteille",
  jar: "pot", tub: "pot", cup: "pot",
  tube: "tube",
  pouch: "sachet", sachet: "sachet", bag: "sachet",
  box: "boite", tray: "boite",
  carton: "brique",
  can: "canette",
  tin: "boite-metal",
  envelope: null, blister: null, sleeve: null, wrapper: null, stick: null, ampoule: null, other: null,
};

/** The resolver's coarser physical states. */
const STATE_TO_RESOLVER: Readonly<Record<PhysicalState, ResolverPhysicalState | null>> = {
  liquid: "liquid", viscous: "liquid",
  cream: "paste", gel: "paste", paste: "paste", semiSolid: "paste",
  powder: "powder", granules: "powder",
  solid: "solid", tablet: "solid", capsule: "solid", frozen: "solid",
  gasAerosol: null, mixed: null,
};
export const resolverPhysicalState = (s: OrUnknown<PhysicalState> | undefined): ResolverPhysicalState | null => (s && s !== "unknown" ? STATE_TO_RESOLVER[s] : null);

/**
 * The resolver families this product prefers, best first, limited to the families that have supported
 * formats. A required premium presentation puts the rigid "coffret" before a plain box.
 */
export function resolverFamiliesFor(pi: ProductIntelligence): PackagingFamily[] {
  const available = new Set(availableFamilies());
  const premium = pi.packagingRequirements?.needsPremiumPresentation === "required";
  const out: PackagingFamily[] = [];
  for (const sf of pi.preferredPackagingFamilies ?? []) {
    const f = SEMANTIC_TO_RESOLVER_FAMILY[sf];
    const fams: (PackagingFamily | null)[] = premium && f === "boite" ? ["coffret", "boite"] : [f];
    for (const x of fams) if (x && available.has(x) && !out.includes(x)) out.push(x);
  }
  return out;
}

export interface IntelligentResolution {
  resolution: PackagingResolution;
  /** "resolver": its own decision (or its question, when intelligence has nothing to add);
   *  "intelligence": the question was answered by the product's preferred family. */
  decidedBy: "resolver" | "intelligence";
  /** The resolver family used to answer, when decidedBy is "intelligence". */
  family: PackagingFamily | null;
  /** Does the resolver's family belong to the product's preferred families? (null when not comparable) */
  agreesWithIntelligence: boolean | null;
}

export function resolvePackagingWithIntelligence(text: string, pi: ProductIntelligence): IntelligentResolution {
  const base = resolvePackaging(text);
  const families = resolverFamiliesFor(pi);
  const agrees = base.family && families.length ? families.includes(base.family) : null;
  if (!base.needsClarification || base.intent.preferredFamily || !families.length) {
    return { resolution: base, decidedBy: "resolver", family: null, agreesWithIntelligence: agrees };
  }
  for (const family of families) {
    const r = resolvePackaging(text, { family });
    if (r.shapeId) return { resolution: r, decidedBy: "intelligence", family, agreesWithIntelligence: true };
  }
  return { resolution: base, decidedBy: "resolver", family: null, agreesWithIntelligence: agrees };
}
