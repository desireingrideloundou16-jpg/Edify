/**
 * Landing "universes": a different combination is shown on every visit.
 * Edify's colours and typography never change; packs, accent, hero shape and
 * background pattern do (6 universes × 4 shapes × 4 patterns = 96 looks).
 */
export type HeroArt = "disc" | "arch" | "blob" | "squircle";
export type PagePattern = "halftone" | "grid" | "stripes" | "rings";

export interface LandingTheme {
  id: string;
  label: string;
  labelEn: string;
  /** Three colours of the animated hero background. */
  blobs: [string, string, string];
  /** Indices into SHOWCASE for the five hero packs (back, right, left, centre, front). */
  packs: [number, number, number, number, number];
  /** Accent: one of the CMYK process colours. */
  disc: "m" | "c" | "y";
  /** Very light tint of the hero paper. */
  paper: string;
  art: HeroArt;
  pattern: PagePattern;
}

type Universe = Omit<LandingTheme, "art" | "pattern">;

// SHOWCASE indices: 0 can, 1 coffee pouch, 2 serum, 3 tea box, 4 honey, 5 chips, 6 wine, 7 tube,
// 8 perfume, 9 protein, 10 candle, 11 cookie tin, 12 milk, 13 shampoo, 14 neon can, 15 watch box, 16 hot sauce
export const UNIVERSES: Universe[] = [
  { id: "cafe", label: "Univers café", labelEn: "Coffee universe", packs: [3, 11, 1, 10, 4], disc: "m", paper: "#fffaf6", blobs: ["#e6007e", "#c47a3d", "#ffb400"] },
  { id: "agrumes", label: "Univers fruité", labelEn: "Fruity universe", packs: [9, 5, 0, 12, 14], disc: "y", paper: "#fffdf2", blobs: ["#ffe500", "#00a0e3", "#e6007e"] },
  { id: "piquant", label: "Univers piquant", labelEn: "Spicy universe", packs: [6, 5, 16, 11, 0], disc: "c", paper: "#fff8f6", blobs: ["#e4411e", "#ffb400", "#00a0e3"] },
  { id: "beaute", label: "Univers beauté", labelEn: "Beauty universe", packs: [8, 13, 2, 7, 10], disc: "m", paper: "#fff7fa", blobs: ["#e6007e", "#b76e79", "#00a0e3"] },
  { id: "miel", label: "Univers miel", labelEn: "Honey universe", packs: [3, 11, 4, 10, 12], disc: "y", paper: "#fffbf0", blobs: ["#ffb400", "#ffe500", "#e6007e"] },
  { id: "neon", label: "Univers néon", labelEn: "Neon universe", packs: [15, 9, 14, 0, 7], disc: "c", paper: "#f6fbff", blobs: ["#00a0e3", "#ff2bd6", "#6b4fa0"] },
];

const ARTS: HeroArt[] = ["disc", "arch", "blob", "squircle"];
const PATTERNS: PagePattern[] = ["halftone", "grid", "stripes", "rings"];
const KEY = "edify-landing-theme";
const pick = <T,>(list: T[], not?: T) => {
  const pool = list.filter((x) => x !== not);
  return pool[Math.floor(Math.random() * pool.length)];
};

let chosen: LandingTheme | null = null;

/** A universe different from the last visit, with a fresh shape and pattern. */
export function pickTheme(): LandingTheme {
  if (chosen) return chosen; // one draw per page load, even if called twice
  let last: Partial<{ id: string; art: HeroArt; pattern: PagePattern }> = {};
  try {
    last = JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    // storage unavailable (private mode): still random
  }
  const universe = pick(UNIVERSES.map((u) => u.id), last.id);
  const theme: LandingTheme = {
    ...UNIVERSES.find((u) => u.id === universe)!,
    art: pick(ARTS, last.art),
    pattern: pick(PATTERNS, last.pattern),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify({ id: theme.id, art: theme.art, pattern: theme.pattern }));
  } catch {
    /* ignore */
  }
  chosen = theme;
  return theme;
}

/** Stable per-visit offset, used to reorder galleries and marquees. */
export function visitSeed(): number {
  return UNIVERSES.findIndex((u) => u.id === pickTheme().id);
}
