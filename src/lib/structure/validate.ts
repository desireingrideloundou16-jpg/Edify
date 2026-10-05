/** Structural sanity checks (pure). Returns the list of problems; empty = valid. */
import type { PackagingStructure, Pt } from "./types";

const finite = (n: number) => typeof n === "number" && Number.isFinite(n);

export function validatePackagingStructure(s: PackagingStructure): string[] {
  const errors: string[] = [];
  const pts = (list: Pt[] | undefined, where: string) => {
    for (const [x, y] of list ?? []) if (!finite(x) || !finite(y)) errors.push(`${where}: non-finite point`);
  };
  for (const k of ["L", "W", "H"] as const) if (!finite(s.outerMm[k]) || s.outerMm[k] <= 0) errors.push(`outerMm.${k} must be > 0`);
  if (!finite(s.material.thicknessMm) || s.material.thicknessMm < 0) errors.push("material.thicknessMm must be >= 0");
  if (!finite(s.bleedMm) || s.bleedMm < 0) errors.push("bleedMm must be >= 0");
  if (!Array.isArray(s.printSurfaces) || s.printSurfaces.length === 0) errors.push("printSurfaces must not be empty");

  const surfaceIds = new Set<string>();
  for (const p of s.printSurfaces ?? []) {
    if (surfaceIds.has(p.id)) errors.push(`duplicate surface id "${p.id}"`);
    surfaceIds.add(p.id);
    if (!finite(p.wMm) || p.wMm <= 0 || !finite(p.hMm) || p.hMm <= 0) errors.push(`surface "${p.id}": size must be > 0`);
    if (!finite(p.safeMm) || p.safeMm < 0) errors.push(`surface "${p.id}": safeMm must be >= 0`);
    if (typeof p.printable !== "boolean") errors.push(`surface "${p.id}": printable must be set`);
    if (p.shape) {
      const inBox = (q: Pt[]) => q.every(([x, y]) => finite(x) && finite(y) && x >= -1e-9 && y >= -1e-9 && x <= p.wMm + 1e-9 && y <= p.hMm + 1e-9);
      if (p.shape.outline.length < 3 || !inBox(p.shape.outline)) errors.push(`surface "${p.id}": outline must be a polygon inside the surface`);
      if (p.shape.printOutline.length < 3 || !inBox(p.shape.printOutline)) errors.push(`surface "${p.id}": printOutline must be a polygon inside the surface`);
    }
    const a = p.printArea;
    if (a) {
      const ok = [a.x, a.y, a.w, a.h].every(finite) && a.w > 0 && a.h > 0 && a.x >= 0 && a.y >= 0 && a.x + a.w <= p.wMm + 1e-9 && a.y + a.h <= p.hMm + 1e-9;
      if (!ok) errors.push(`surface "${p.id}": printArea must lie inside the surface`);
    }
  }
  const sheet = s.flatMm;
  (s.seals ?? []).forEach((seal, i) => {
    const [x, y, w, h] = seal.rect;
    if (![x, y, w, h, seal.widthMm].every(finite) || w <= 0 || h <= 0) errors.push(`seal "${seal.id}": invalid size`);
    if (sheet && (x < 0 || y < 0 || x + w > sheet.width + 1e-9 || y + h > sheet.height + 1e-9)) errors.push(`seal "${seal.id}": outside the flat sheet`);
    for (const id of seal.surfaceIds) if (!surfaceIds.has(id)) errors.push(`seal "${seal.id}": unknown surface "${id}"`);
    for (const other of (s.seals ?? []).slice(i + 1)) {
      const [x2, y2, w2, h2] = other.rect;
      if (x < x2 + w2 && x2 < x + w && y < y2 + h2 && y2 < y + h) errors.push(`seals "${seal.id}" and "${other.id}" overlap`);
    }
  });

  const panelIds = new Set<string>();
  for (const p of s.panels ?? []) {
    if (panelIds.has(p.id)) errors.push(`duplicate panel id "${p.id}"`);
    panelIds.add(p.id);
    if (p.polygon.length < 3) errors.push(`panel "${p.id}": polygon needs 3+ points`);
    pts(p.polygon, `panel "${p.id}"`);
    if (p.surfaceId && !surfaceIds.has(p.surfaceId)) errors.push(`panel "${p.id}": unknown surface "${p.surfaceId}"`);
    if (p.surfaceOffsetMm !== undefined) {
      const sw = s.printSurfaces.find((x) => x.id === p.surfaceId)?.wMm ?? 0;
      if (!finite(p.surfaceOffsetMm) || p.surfaceOffsetMm < 0 || p.surfaceOffsetMm >= sw) errors.push(`panel "${p.id}": surfaceOffsetMm outside its surface`);
    }
  }
  if (s.assembly) {
    const partIds = new Set<string>();
    for (const p of s.assembly.parts) {
      if (partIds.has(p.id)) errors.push(`duplicate assembly part "${p.id}"`);
      partIds.add(p.id);
      if (![...p.min, ...p.max].every(finite) || p.min.some((v, i) => !(p.max[i] > v))) errors.push(`assembly part "${p.id}": empty or invalid box`);
      if (p.surface && !surfaceIds.has(p.surface.id)) errors.push(`assembly part "${p.id}": unknown surface "${p.surface.id}"`);
    }
    for (const surf of s.printSurfaces ?? []) {
      const n = s.assembly.parts.filter((p) => p.surface?.id === surf.id).length;
      // one surface may span several parts (the back of a film tube, split by its fin seal), all facing the same way
      const faces = new Set(s.assembly.parts.filter((p) => p.surface?.id === surf.id).map((p) => p.surface!.face));
      if (surf.printable && (n < 1 || faces.size !== 1)) errors.push(`surface "${surf.id}": on ${n} assembly parts facing ${faces.size} ways (expected 1+ parts, 1 way)`);
    }
    for (const f of s.assembly.folds) {
      if (!partIds.has(f.from) || !partIds.has(f.to)) errors.push(`fold "${f.id}": unknown part`);
      if (![...f.edge[0], ...f.edge[1]].every(finite)) errors.push(`fold "${f.id}": non-finite edge`);
    }
    if (s.assembly.folds.filter((f) => f.hinge).length > 1) errors.push("assembly: more than one hinge");
    for (const p of s.assembly.parts) {
      const target = p.glueTo ?? p.bond?.to;
      if (!target) continue;
      const q = s.assembly.parts.find((x) => x.id === target);
      // glued = face to face: touching on one axis, overlapping on the other two
      const touch = q && [0, 1, 2].filter((i) => Math.abs(p.max[i] - q.min[i]) < 1e-9 || Math.abs(q.max[i] - p.min[i]) < 1e-9).length >= 1 &&
        [0, 1, 2].filter((i) => Math.min(p.max[i], q.max[i]) - Math.max(p.min[i], q.min[i]) > 1e-9).length === 2;
      if (!touch) errors.push(`assembly part "${p.id}": not joined face to face on "${target}"`);
    }
    for (const e of s.assembly.endSeals ?? []) {
      if (!(finite(e.widthMm) && e.widthMm > 0)) errors.push(`end seal "${e.id}": invalid width`);
      for (const id of e.parts) if (!partIds.has(id)) errors.push(`end seal "${e.id}": unknown part "${id}"`);
    }
  }
  const hingeIds = new Set<string>();
  for (const h of s.hinges ?? []) {
    if (hingeIds.has(h.id)) errors.push(`duplicate hinge id "${h.id}"`);
    hingeIds.add(h.id);
    if (!panelIds.has(h.from) || !panelIds.has(h.to)) errors.push(`hinge "${h.id}": unknown panel`);
    pts(h.line, `hinge "${h.id}"`);
  }
  if (s.rootPanel && !panelIds.has(s.rootPanel)) errors.push(`rootPanel "${s.rootPanel}" is not a panel`);
  pts(s.cut, "cut");
  for (const c of s.extraCuts ?? []) {
    pts(c, "extra cut");
    if (c.length < 3) errors.push("extra cut contour needs 3+ points");
  }
  for (const c of s.creases ?? []) pts(c, "crease");
  for (const c of s.slits ?? []) pts(c, "slit");
  for (const c of s.formedFolds ?? []) pts(c, "formed fold");
  for (const z of s.sealZones ?? []) pts(z.polygon, `seal zone "${z.id}"`);
  const inside = (q: Pt[], id: string) => {
    const poly = s.panels?.find((p) => p.id === id)?.polygon;
    if (!poly) return false;
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    return q.every(([x, y]) => x >= Math.min(...xs) - 1e-9 && x <= Math.max(...xs) + 1e-9 && y >= Math.min(...ys) - 1e-9 && y <= Math.max(...ys) + 1e-9);
  };
  for (const f of s.innerFolds ?? []) {
    pts(f.line, `inner fold "${f.id}"`);
    if (!inside(f.line, f.panel)) errors.push(`inner fold "${f.id}": outside its panel "${f.panel}"`);
  }
  for (const g of s.compositionGuides ?? []) {
    pts(g.polygon, `composition guide "${g.kind}"`);
    if (!inside(g.polygon, g.panel)) errors.push(`composition guide "${g.kind}": outside its panel "${g.panel}"`);
  }
  for (const z of s.technicalZones ?? []) {
    pts(z.polygon, `technical zone "${z.id}"`);
    if (!inside(z.polygon, z.panel)) errors.push(`technical zone "${z.id}": outside its panel "${z.panel}"`);
    const ps = s.panels?.find((p) => p.id === z.panel)?.surfaceId;
    if (z.surfaceId !== ps) errors.push(`technical zone "${z.id}": surface "${z.surfaceId}" is not the panel's ("${ps}")`);
  }
  // A sheet developed from a folded assembly is a single piece.
  if ((s.template === "rollEndTuckFront" || s.template === "gluedCornerTray" || s.template === "sideGussetBag") && s.extraCuts?.length) errors.push("folded assembly must develop into a single piece");
  for (const z of s.glueZones ?? []) {
    pts(z.polygon, `glue zone on "${z.panel}"`);
    if (!panelIds.has(z.panel)) errors.push(`glue zone: unknown panel "${z.panel}"`);
  }
  if (s.assembly && s.dieline === "supported") {
    for (const p of s.assembly.parts) if (p.glueTo && (s.glueZones ?? []).filter((z) => z.panel === p.id).length !== 1) errors.push(`glued part "${p.id}" needs one glue zone in the flat sheet`);
  }
  if (s.assembly && s.dieline === "supported" && (s.hinges?.length ?? 0) !== s.assembly.folds.length) errors.push("every fold of the assembly needs its hinge in the flat sheet");
  for (const g of s.glue ?? []) pts(g, "glue");

  if (s.dieline === "supported") {
    if (!s.cut || s.cut.length < 3) errors.push("supported die-line needs a cut contour");
    if (!s.flatMm || !(s.flatMm.width > 0) || !(s.flatMm.height > 0)) errors.push("supported die-line needs flatMm");
    if (!s.panels?.length) errors.push("supported die-line needs panels");
  } else if (s.cut || s.panels) {
    errors.push("unsupported die-line must not carry a flat template");
  }
  return errors;
}
