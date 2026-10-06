/**
 * PI-5 — the design brief as text, DERIVED from a MasterDesignIntent (never the source of truth). It only
 * prints what the structure holds: an unknown stays "non fourni", nothing is completed or embellished.
 */
import type { HierarchyEntry, IntentValue, MasterDesignIntent, Unknown } from "./types";

const v = (x: IntentValue<string> | Unknown) => (x.value === "unknown" ? "non fourni" : x.value);
const list = (xs: IntentValue<string>[]) => (xs.length ? xs.map((x) => x.value).join(" ; ") : "—");
const roles = (xs: HierarchyEntry[]) => (xs.length ? xs.map((e) => (e.content === "notProvided" ? e.role : `${e.role} (« ${e.content} »)`)).join(", ") : "—");

export function toDesignBrief(m: MasterDesignIntent): string {
  return [
    "PRODUIT",
    `Marque : ${v(m.brand.name)}`,
    `Produit : ${v(m.product.name)}`,
    `Catégorie : ${v(m.product.category)}${m.product.subcategory.value !== "unknown" ? ` / ${m.product.subcategory.value}` : ""}`,
    `Positionnement : ${m.product.positioning.map((p) => `${p.value}${p.status === "explicit" ? " (demandé)" : ""}`).join(", ") || "—"}`,
    `Marché : ${m.product.market.countries.join(", ") || "non fourni"}`,
    `Packaging : ${m.packaging.shapeId ? `${m.packaging.name ?? m.packaging.shapeId}${m.packaging.material ? `, ${m.packaging.material}` : ""}` : "à décider"}`,
    "",
    "DIRECTION VISUELLE",
    `Territoire : ${v(m.visual.territory)}`,
    `Style : ${list(m.visual.style)}`,
    `Ambiance : ${list(m.visual.mood)}`,
    `Sophistication : ${v(m.visual.sophistication as IntentValue<string> | Unknown)}`,
    `Densité : ${v(m.visual.visualDensity as IntentValue<string> | Unknown)}`,
    `Couleur : ${list(m.visual.colorDirection)}`,
    `Typographie : ${list(m.visual.typographyDirection)}`,
    `Imagerie : ${list(m.visual.imageryDirection)}`,
    `Composition : ${list(m.visual.compositionDirection)}`,
    "",
    "HIÉRARCHIE",
    `Primaire : ${roles(m.hierarchy.primary)}`,
    `Secondaire : ${roles(m.hierarchy.secondary)}`,
    `Tertiaire : ${roles(m.hierarchy.tertiary)}`,
    `Support : ${roles(m.hierarchy.supporting)}`,
    "",
    "ALLÉGATIONS",
    `Utilisables : ${m.claims.product.filter((c) => c.status === "validated" || c.status === "explicit").map((c) => c.value).join(" ; ") || "—"}`,
    `Incertaines (non promises) : ${m.claims.product.filter((c) => c.status === "uncertain").map((c) => c.value).join(" ; ") || "—"}`,
    `Interdites : ${m.claims.prohibited.join(" ; ") || "—"}`,
    "",
    "CONTRAINTES",
    `Structure : ${list(m.constraints.structural)}`,
    `Obligatoire : ${list(m.constraints.mandatory)}`,
    `Réglementaire (indicatif) : ${list(m.constraints.regulatory)}`,
    `Interdit : ${list(m.constraints.prohibited)}`,
    "",
    "À ÉVITER",
    ...(m.negativeDirections.length ? m.negativeDirections.map((n) => `- ${n.value}`) : ["—"]),
    "",
    "PRISE DE VUE",
    `Usage : ${m.shotIntent.purpose ?? "non précisé"} — style : ${m.shotIntent.style ?? m.shotIntent.status}`,
  ].join("\n");
}
