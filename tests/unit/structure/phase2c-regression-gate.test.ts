/**
 * PHASE_2C_REGRESSION_GATE — the packaging engine as validated at the end of phase 2C (commit 5f9c808).
 *
 * Frozen fixtures (tests/fixtures/phase2c-gate/*.json) protect everything PHYSICAL:
 *   structures (construction, dimensions, material, die-line decision), print surfaces (identity, size,
 *   print area, safe margin, shape), flat sheets (cut, creases, glue, seals, technical zones, panels),
 *   3D geometry (vertices, UVs, groups) and the size of every texture.
 *
 * What phase 3 MAY change is deliberately outside the fixtures: positions, typography, hierarchy,
 * composition, colours and decoration of the artwork (the 3D is fingerprinted with the artwork drawing
 * stubbed out: only geometry and texture SIZES are compared, never pixels).
 *
 * A failure here means the physical engine changed. That is never fixed by regenerating the fixtures:
 * it needs an explicit decision. Regenerating (only after such a decision):
 *   PHASE2C_GATE_WRITE=1 npx vitest run tests/unit/structure/phase2c-regression-gate.test.ts
 */
import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import { resolveStructure, type PackagingStructure } from "@/lib/structure";
import { resolveFlatLayout } from "@/lib/print/layout";

// Geometry only: the artwork drawing is stubbed (phase 3 may change it freely).
vi.mock("@/lib/artwork/draw", async (orig) => ({ ...(await orig<typeof import("@/lib/artwork/draw")>()), drawFace: () => {}, drawWrap: () => {} }));

const DIR = "tests/fixtures/phase2c-gate";
const WRITE = process.env.PHASE2C_GATE_WRITE === "1";

/** Canonical JSON: sorted keys, numbers rounded (1e-9 for mm, `digits` overridable), no -0. */
function canon(v: unknown, digits = 9): unknown {
  if (typeof v === "number") {
    const r = Number(v.toFixed(digits));
    return Object.is(r, -0) ? 0 : r;
  }
  if (Array.isArray(v)) return v.map((x) => canon(x, digits));
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as Record<string, unknown>)[k], digits)]));
  return v;
}
const hash = (v: unknown, digits = 9) => createHash("sha256").update(JSON.stringify(canon(v, digits))).digest("hex").slice(0, 32);

type Row = (typeof SHAPE_ROWS)[number];
const input = (r: Row) => ({ model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] });

/** Readable physical summary of a structure (diffs say WHAT changed), plus a hash of the whole structure. */
function structureFixture(s: PackagingStructure) {
  return {
    model: s.model,
    family: s.family,
    dieline: s.dieline,
    template: s.template ?? null,
    outerMm: canon(s.outerMm),
    material: canon(s.material),
    bleedMm: s.bleedMm,
    flatMm: s.flatMm ? canon(s.flatMm) : null,
    surfaces: s.printSurfaces.map((p) => ({
      id: p.id, wMm: canon(p.wMm), hMm: canon(p.hMm), printable: p.printable, safeMm: canon(p.safeMm),
      printArea: p.printArea ? canon(p.printArea) : null, draw: canon(p.draw), shape: p.shape ? hash(p.shape) : null,
    })),
    technical: {
      cut: s.cut ? hash(s.cut) : null,
      extraCuts: s.extraCuts ? hash(s.extraCuts) : null,
      creases: s.creases ? hash(s.creases) : null,
      glueZones: s.glueZones ? hash(s.glueZones) : null,
      seals: s.seals ? hash(s.seals) : null,
      sealZones: s.sealZones ? hash(s.sealZones) : null,
      technicalZones: s.technicalZones ? hash(s.technicalZones) : null,
      hinges: s.hinges ? hash(s.hinges) : null,
      panels: s.panels ? hash(s.panels) : null,
      composition: s.composition ? hash(s.composition) : null,
    },
    structureHash: hash(s),
  };
}

function flatFixture(r: Row) {
  const f = resolveFlatLayout(input(r));
  if (!f.supported) return { supported: false };
  const L = f.layout;
  return { supported: true, width: canon(L.width), height: canon(L.height), panels: L.panels.length, kindLabel: L.kindLabel, layoutHash: hash(L) };
}

async function threeFixture(r: Row) {
  const { buildPackaging } = await import("@/lib/three/packagingModels");
  const design = { brandName: "T", productName: "P", tagline: "", volume: "", palette: ["#ffffff", "#1f2937", "#b91c1c"], headingFont: "Inter", bodyFont: "Inter", finishing: "Vernis mat", logo: null } as never;
  const obj = buildPackaging({ model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] }, design);
  obj.updateMatrixWorld(true);
  const meshes: unknown[] = [];
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position, uv = m.geometry.attributes.uv;
    const world: number[] = [];
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos as THREE.BufferAttribute, i).applyMatrix4(m.matrixWorld);
      world.push(v.x, v.y, v.z);
    }
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    meshes.push({
      name: m.name,
      vertices: pos.count,
      positions: hash(world, 6),
      uv: uv ? hash(Array.from(uv.array as Float32Array), 7) : null,
      groups: m.geometry.groups.length,
      textures: mats.map((mt) => {
        const map = (mt as THREE.MeshStandardMaterial).map;
        return map?.userData.mm ? { surfaceId: map.userData.surfaceId ?? null, mm: canon(map.userData.mm, 6) } : null;
      }),
    });
  });
  return meshes;
}

// Canvas stub for the 3D build in node (textures are sized, never drawn here).
const stubCtx = new Proxy({}, { get: (_t, k) => (k === "createImageData" ? (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}) });
vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => stubCtx }) });

const read = (name: string) => JSON.parse(readFileSync(`${DIR}/${name}.json`, "utf8"));

describe("PHASE_2C_REGRESSION_GATE", () => {
  if (WRITE) {
    it("écriture des fixtures (décision explicite)", async () => {
      mkdirSync(DIR, { recursive: true });
      const structures: Record<string, unknown> = {}, flats: Record<string, unknown> = {}, three: Record<string, unknown> = {};
      for (const r of SHAPE_ROWS) {
        structures[r[0]] = structureFixture(resolveStructure(input(r)));
        flats[r[0]] = flatFixture(r);
        three[r[0]] = await threeFixture(r);
      }
      const meta = {
        validated: "phase 2C-4G, commit 5f9c808",
        formats: SHAPE_ROWS.length,
        supported: Object.values(structures).filter((s) => (s as { dieline: string }).dieline === "supported").length,
        refused: Object.entries(structures).filter(([, s]) => (s as { dieline: string }).dieline !== "supported").map(([id]) => id),
      };
      writeFileSync(`${DIR}/meta.json`, JSON.stringify(meta, null, 1) + "\n");
      writeFileSync(`${DIR}/structures.json`, JSON.stringify(structures, null, 1) + "\n");
      writeFileSync(`${DIR}/flat-layouts.json`, JSON.stringify(flats, null, 1) + "\n");
      writeFileSync(`${DIR}/geometry-3d.json`, JSON.stringify(three, null, 1) + "\n");
    }, 240000);
    return;
  }

  it("les fixtures figées existent", () => {
    for (const f of ["meta", "structures", "flat-layouts", "geometry-3d"]) expect(existsSync(`${DIR}/${f}.json`)).toBe(true);
  });

  it("catalogue : 119 formats, 107 supportés, 12 refusés (les mêmes)", () => {
    const meta = read("meta");
    expect(SHAPE_ROWS.length).toBe(119);
    expect(meta.formats).toBe(119);
    expect(meta.supported).toBe(107);
    expect(meta.refused.length).toBe(12);
    const refused = SHAPE_ROWS.filter((r) => resolveStructure(input(r)).dieline !== "supported").map((r) => r[0]);
    expect(refused).toEqual(meta.refused);
    expect(SHAPE_ROWS.map((r) => r[0]).sort()).toEqual(Object.keys(read("structures")).sort());
  });

  const structures = WRITE ? {} : read("structures");
  const flats = WRITE ? {} : read("flat-layouts");
  const three = WRITE ? {} : read("geometry-3d");

  it.each(SHAPE_ROWS.map((r) => [r[0], r] as const))("%s : structure, surfaces, dimensions, patron et zones techniques identiques", (id, r) => {
    const now = structureFixture(resolveStructure(input(r)));
    const ref = structures[id];
    // readable first (what changed), then the whole structure
    expect({ model: now.model, family: now.family, dieline: now.dieline, template: now.template }).toEqual({ model: ref.model, family: ref.family, dieline: ref.dieline, template: ref.template });
    expect(now.outerMm).toEqual(ref.outerMm);
    expect(now.material).toEqual(ref.material);
    expect(now.bleedMm).toBe(ref.bleedMm);
    expect(now.flatMm).toEqual(ref.flatMm);
    expect(now.surfaces).toEqual(ref.surfaces);
    expect(now.technical).toEqual(ref.technical);
    expect(now.structureHash).toBe(ref.structureHash);
  });

  it.each(SHAPE_ROWS.map((r) => [r[0], r] as const))("%s : FlatLayout identique (ou toujours refusé)", (id, r) => {
    expect(flatFixture(r)).toEqual(flats[id]);
  });

  it.each(SHAPE_ROWS.map((r) => [r[0], r] as const))("%s : géométrie 3D, UV et tailles de texture identiques", async (id, r) => {
    expect(await threeFixture(r)).toEqual(three[id]);
  });
});
