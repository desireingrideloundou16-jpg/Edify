/**
 * Phase 3A — explicit artwork roles. Every element an artwork primitive draws carries the role its
 * CALLER gives (brand, productName, subtitle, netContent, logo, badge, barcode…), never a role guessed
 * by comparing the drawn text with the design's fields. The rendering itself is untouched (verified
 * call for call against the phase 2C drawing when the change was made).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import { ROLE_PRIORITY, resolveStructure, type ElementRole } from "@/lib/structure";
import { LAYOUTS } from "@/lib/artwork/compose";
import { drawSurface } from "@/lib/artwork/surface";
import { recordWrapElements } from "@/lib/artwork/smartLayout";
import type { PackagingDesign } from "@/lib/artwork/draw";
import { mockContext } from "./mockCanvas";

const logo = { complete: true, naturalWidth: 120, naturalHeight: 60 } as unknown as HTMLImageElement;
const DISTINCT = {
  brandName: "Maison Kola", productName: "Jus de bissap", tagline: "Pressé à froid", volume: "33 cl", origin: "Fait à Douala", badge: "100 % naturel",
  palette: ["#fdf6ec", "#1b1b1b", "#b3261e", "#e6a700"], headingFont: "Playfair Display", bodyFont: "Lato", finishing: "Vernis mat",
  ingredients: "Eau, fleurs d'hibiscus, sucre.", barcode: "6151234567890", logo,
} as PackagingDesign;
/** Same structure of content, every text field identical: a guessed role could not tell them apart. */
const SAME = "Maison Kola";
const IDENTICAL = { ...DISTINCT, productName: SAME, tagline: SAME, volume: SAME, origin: SAME, badge: SAME } as PackagingDesign;

const row = (id: string) => SHAPE_ROWS.find((r) => r[0] === id)!;
const structureOf = (id: string) => { const r = row(id); return resolveStructure({ model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] }); };
const tub = structureOf("deli-container");
const wrap = tub.printSurfaces.find((p) => p.id === "wrap")!;
/**
 * Undeclared element kept as it is in phase 3A (declaring it would change the smart layout): the poster
 * layout's oversized, deliberately cropped brand lettering (a direct fillText).
 */
const BRAND_NOT_DECLARED = new Set<string>(["poster"]);
const roles = (d: PackagingDesign) => recordWrapElements(mockContext().ctx, d, wrap).map((e) => `${e.id}:${e.role}${e.parentId ? `>${e.parentId}` : ""}`);

describe("rôles explicites (aucune déduction depuis le texte)", () => {
  it("le code ne devine plus de rôle : textRole a disparu et chaque ligne de texte nomme son rôle", () => {
    const compose = readFileSync("src/lib/artwork/compose.ts", "utf8");
    const placement = readFileSync("src/lib/artwork/placement.ts", "utf8");
    expect(compose).not.toMatch(/textRole/);
    expect(placement).not.toMatch(/function textRole/);
    const calls = compose.match(/\btext\(ctx, [^,]+,/g) ?? [];
    expect(calls.length).toBeGreaterThan(40);
    const known = Object.keys(ROLE_PRIORITY);
    for (const c of calls) {
      const role = c.slice("text(ctx, ".length, -1);
      // a literal role, or the pop burst's documented choice
      expect(/^"[a-zA-Z]+"$/.test(role) ? known.includes(role.slice(1, -1)) : role === `d.volume ? "netContent" : "secondary"`).toBe(true);
    }
  });

  it.each([...LAYOUTS])("gabarit %s : les rôles ne dépendent pas des textes (champs tous identiques = mêmes rôles)", (layout) => {
    const a = roles({ ...DISTINCT, layout });
    const b = roles({ ...IDENTICAL, layout });
    expect(b).toEqual(a);
    expect(a.some((r) => /:brand\b/.test(r))).toBe(!BRAND_NOT_DECLARED.has(layout));
    expect(a.some((r) => /:productName\b/.test(r))).toBe(true);
  });

  it.each([...LAYOUTS])("gabarit %s : chaque élément transmis porte le rôle de son champ", (layout) => {
    const els = recordWrapElements(mockContext().ctx, { ...DISTINCT, layout }, wrap);
    const of = (role: ElementRole) => els.filter((e) => e.role === role).length;
    // the face carries the brand and the product name; the back always carries the barcode
    expect(of("brand") > 0).toBe(!BRAND_NOT_DECLARED.has(layout));
    expect(of("productName")).toBeGreaterThan(0);
    expect(of("barcode")).toBe(1);
    // decorations linked to a brand point to a real brand element
    for (const e of els.filter((x) => x.parentId)) expect(els.some((p) => p.id === e.parentId && p.role === "brand")).toBe(true);
    for (const e of els) expect(Object.keys(ROLE_PRIORITY)).toContain(e.role);
  });
});

describe("les 14 gabarits fonctionnent sur les familles de surfaces (aucune coordonnée NaN / Infinity)", () => {
  const formats = ["deli-container", "ecom-mailer", "shampoo-bottle", "luxury-rigid-box", "food-tray"];
  it.each(formats.flatMap((f) => LAYOUTS.map((l) => [f, l] as const)))("%s · %s", (format, layout) => {
    const s = structureOf(format);
    for (const p of s.printSurfaces) {
      for (const d of [DISTINCT, IDENTICAL, { ...DISTINCT, tagline: "", volume: "", origin: "", badge: "", logo: null }]) {
        const m = mockContext();
        expect(() => drawSurface(m.ctx, 0, 0, p.wMm * 3, p.hMm * 3, { ...d, layout } as PackagingDesign, p)).not.toThrow();
        for (const c of m.calls) {
          expect(Number.isFinite(c.x)).toBe(true);
          expect(Number.isFinite(c.y)).toBe(true);
        }
      }
    }
  });
});
