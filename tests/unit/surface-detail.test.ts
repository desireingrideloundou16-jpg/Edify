import { describe, expect, it } from "vitest";
import { heightField, normalsFromHeight, roughnessFromHeight, valueNoise, type MicroKind } from "@/lib/three/surfaceDetail";

const KINDS: MicroKind[] = ["paper", "laid", "kraft", "coated", "softtouch", "plastic", "brushed", "film"];
const N = 64;

describe("micro-surfaces procédurales", () => {
  it("bruit tuilable : les bords opposés se raccordent sans couture", () => {
    const n = valueNoise(N, 8, 8, 3);
    for (let y = 0; y < N; y++) {
      // x = N wraps to x = 0: the step across the seam is no larger than a normal step
      const seam = Math.abs(n[y * N + N - 1] - n[y * N]);
      const inner = Math.abs(n[y * N + 1] - n[y * N]);
      expect(seam).toBeLessThan(inner + 0.2);
    }
  });

  it("déterministe : même type → même champ de hauteur", () => {
    for (const k of KINDS) expect(heightField(k, N)).toEqual(heightField(k, N));
  });

  it("normal maps valides (z vers l'extérieur) et roughness dans [lo, 1]", () => {
    for (const k of KINDS) {
      const h = heightField(k, N);
      expect(h.every(Number.isFinite)).toBe(true);
      const nm = normalsFromHeight(h, N, 3);
      for (let i = 0; i < N * N; i++) expect(nm[i * 4 + 2]).toBeGreaterThanOrEqual(128);
      const r = roughnessFromHeight(h, N, k, 0.7);
      for (let i = 0; i < N * N; i++) expect(r[i * 4 + 1]).toBeGreaterThanOrEqual(Math.floor(0.7 * 255));
    }
  });
});
