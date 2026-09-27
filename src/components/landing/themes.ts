/**
 * Landing "universes": a different one is shown on every visit.
 * Colours and typography stay Edify's; packs, liquid, ingredients and accent change.
 */
export type Ingredient = "bean" | "citrus" | "chili" | "drop" | "petal" | "leaf" | "cube";

export interface LandingTheme {
  id: string;
  label: string;
  /** Indices into SHOWCASE for the five hero packs (back → front). */
  packs: [number, number, number, number, number];
  liquid: { color: string; transmission: number; roughness: number };
  ingredients: Ingredient[];
  /** Accent disc behind the packs: one of the CMYK process colours. */
  disc: "m" | "c" | "y";
  /** Very light tint of the hero paper. */
  paper: string;
}

// SHOWCASE indices: 0 can, 1 coffee pouch, 2 serum, 3 tea box, 4 honey, 5 chips, 6 wine, 7 tube,
// 8 perfume, 9 protein, 10 candle, 11 cookie tin, 12 milk, 13 shampoo, 14 neon can, 15 watch box, 16 hot sauce
export const THEMES: LandingTheme[] = [
  { id: "cafe", label: "Univers café", packs: [3, 11, 1, 10, 4], liquid: { color: "#3b1f0f", transmission: 0.15, roughness: 0.05 }, ingredients: ["bean", "bean", "drop"], disc: "m", paper: "#fffaf6" },
  { id: "agrumes", label: "Univers agrumes", packs: [9, 5, 0, 12, 14], liquid: { color: "#ff8a00", transmission: 0.55, roughness: 0.04 }, ingredients: ["citrus", "leaf", "drop"], disc: "y", paper: "#fffdf2" },
  { id: "piquant", label: "Univers piquant", packs: [6, 5, 16, 11, 0], liquid: { color: "#c8150d", transmission: 0.3, roughness: 0.06 }, ingredients: ["chili", "drop", "leaf"], disc: "c", paper: "#fff8f6" },
  { id: "beaute", label: "Univers beauté", packs: [8, 13, 2, 7, 10], liquid: { color: "#f6d7df", transmission: 0.35, roughness: 0.08 }, ingredients: ["petal", "drop", "petal"], disc: "m", paper: "#fff7fa" },
  { id: "miel", label: "Univers miel", packs: [3, 11, 4, 10, 12], liquid: { color: "#e39a13", transmission: 0.6, roughness: 0.03 }, ingredients: ["drop", "leaf", "cube"], disc: "y", paper: "#fffbf0" },
  { id: "neon", label: "Univers néon", packs: [15, 9, 14, 0, 7], liquid: { color: "#00c8ff", transmission: 0.5, roughness: 0.05 }, ingredients: ["cube", "drop", "cube"], disc: "c", paper: "#f6fbff" },
];

const KEY = "edify-landing-theme";

/** A different universe than last time (random otherwise). */
let chosen: LandingTheme | null = null;

export function pickTheme(): LandingTheme {
  if (chosen) return chosen; // one draw per page load, even if called twice
  let last: string | null = null;
  try {
    last = localStorage.getItem(KEY);
  } catch {
    // storage unavailable (private mode): still random
  }
  const pool = THEMES.filter((t) => t.id !== last);
  const theme = pool[Math.floor(Math.random() * pool.length)];
  try {
    localStorage.setItem(KEY, theme.id);
  } catch {
    /* ignore */
  }
  chosen = theme;
  return theme;
}
