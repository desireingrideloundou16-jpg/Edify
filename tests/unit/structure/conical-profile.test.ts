/**
 * Phase 2C-4F-1: the conical wall and its exact development (annular sector), pure math, checked on
 * the 4 plastic tubs of the catalog — dimensions from the catalog, never typed in here.
 */
import { describe, expect, it } from "vitest";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import { arcSegments, coneToSurface, cylinderWrap, frustumWall, sectorOutline, sectorPoint, surfaceToCone, tubWall } from "@/lib/structure";

const TUBS = SHAPE_ROWS.filter((r) => r[3] === "tub").map((r) => [r[0], r[4], r[5], r[6]] as const);
const dist = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]));

describe("catalogue", () => {
  it("4 pots plastiques au modèle tub (le pot de glace n'en fait pas partie)", () => {
    expect(TUBS.map((t) => t[0]).sort()).toEqual(["deli-container", "hair-cream-tub", "protein-tub", "yogurt-cup"]);
  });
});

describe.each(TUBS)("%s", (_id, L, W, H) => {
  const c = cylinderWrap("tub", L, W, H);
  const { wall: w } = tubWall(L, W, H);

  it("1-3. R haut, r bas, hauteur : ceux de la géométrie construite (cylinderWrap, source du builder 3D)", () => {
    expect(w.R).toBe(c.R);
    expect(w.R).toBe(Math.min(L, W) / 2);
    expect(w.r).toBe(c.rBottom);
    expect(w.r).toBeLessThan(w.R);
    expect(w.h).toBe(c.bodyH);
  });

  it("4-9. génératrice, rayons du secteur, angle, arcs = circonférences", () => {
    expect(w.slant).toBeCloseTo(Math.sqrt(w.h ** 2 + (w.R - w.r) ** 2), 12);
    expect(w.rOut).toBeCloseTo((w.slant * w.R) / (w.R - w.r), 9);
    expect(w.rIn).toBeCloseTo((w.slant * w.r) / (w.R - w.r), 9);
    expect(w.rOut - w.rIn).toBeCloseTo(w.slant, 9);
    expect(w.angle * w.rOut).toBeCloseTo(2 * Math.PI * w.R, 9); // outer arc = top circumference
    expect(w.angle * w.rIn).toBeCloseTo(2 * Math.PI * w.r, 9); // inner arc = bottom circumference
    expect(w.angle).toBeGreaterThan(0);
    expect(w.angle).toBeLessThan(Math.PI);
  });

  it("secteur → cône → secteur : aller-retour exact ; longueurs conservées (génératrice et cercles)", () => {
    for (const theta of [-3, -1.2, 0, 0.4, 2.9]) for (const y of [0, w.h / 3, w.h]) {
      const p = coneToSurface(w, theta, y);
      const q = surfaceToCone(w, p);
      const rad = w.r + (y / w.h) * (w.R - w.r);
      expect(q[1]).toBeCloseTo(y, 9);
      expect(Math.hypot(q[0], q[2])).toBeCloseTo(rad, 9);
      expect(Math.atan2(q[0], q[2])).toBeCloseTo(theta, 9);
      // a small step around the cone and along the generatrix has the same length flat
      const d = 1e-4;
      expect(dist(coneToSurface(w, theta + d, y), p)).toBeCloseTo(rad * d, 8);
      expect(dist(coneToSurface(w, theta, y + d), p)).toBeCloseTo((d / w.h) * w.slant, 10);
    }
  });

  it("repère : face au centre, couture au dos sur les deux côtés radiaux, droite vue de face = droite du secteur", () => {
    expect(coneToSurface(w, 0, w.h)[0]).toBeCloseTo(w.width / 2, 9); // front on the axis
    expect(coneToSurface(w, 0, w.h)[1]).toBeCloseTo(0, 9); // top of the wall = top of the box
    const left = coneToSurface(w, -Math.PI, w.h), right = coneToSurface(w, Math.PI, w.h);
    expect(left[0]).toBeCloseTo(0, 9);
    expect(right[0]).toBeCloseTo(w.width, 9);
    // the right side of the pot seen from the front (+x at θ > 0) is on the right of the sector: no mirror
    expect(surfaceToCone(w, coneToSurface(w, 0.5, w.h / 2))[0]).toBeGreaterThan(0);
    expect(coneToSurface(w, 0.5, w.h / 2)[0]).toBeGreaterThan(w.width / 2);
    // the bottom of the wall is the inner arc, lower in the sector
    expect(coneToSurface(w, 0, 0)[1]).toBeCloseTo(w.rOut - w.rIn, 9);
  });

  it("contour : sommets exactement sur les arcs, boîte englobante = largeur × hauteur du secteur", () => {
    const n = arcSegments(w);
    expect(n % 2).toBe(0);
    const o = sectorOutline(w);
    expect(o.length).toBe(2 * (n + 1));
    const apex = [w.width / 2, w.rOut];
    for (const p of o.slice(0, n + 1)) expect(dist(p, apex)).toBeCloseTo(w.rOut, 9);
    for (const p of o.slice(n + 1)) expect(dist(p, apex)).toBeCloseTo(w.rIn, 9);
    const xs = o.map((p) => p[0]), ys = o.map((p) => p[1]);
    expect([Math.min(...xs), Math.min(...ys)].map((v) => +v.toFixed(9))).toEqual([0, 0]);
    expect(Math.max(...xs)).toBeCloseTo(w.width, 9);
    expect(Math.max(...ys)).toBeCloseTo(w.height, 9);
    // chords never stray more than 0.01 mm from the true arc
    const chordStep = w.angle / n;
    expect(w.rOut * (1 - Math.cos(chordStep / 2))).toBeLessThanOrEqual(0.01 + 1e-12);
    expect(sectorPoint(w, w.rOut, 0)).toEqual([w.width / 2, 0]);
  });
});

describe("garde-fous", () => {
  it("refuse un cône inversé ou un secteur de plus d'un demi-tour", () => {
    expect(() => frustumWall(30, 40, 50)).toThrow();
    expect(() => frustumWall(50, 49, 1)).toThrow();
  });
});
