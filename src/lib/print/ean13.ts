/**
 * EAN-13 barcodes (GS1). Accepts 13 digits (EAN-13) or 12 digits (UPC-A, printed as EAN-13
 * with a leading 0). The check digit is always verified: a wrong code must never reach print.
 */

const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = L.map((c) => [...c].map((b) => (b === "0" ? "1" : "0")).reverse().join(""));
const R = L.map((c) => [...c].map((b) => (b === "0" ? "1" : "0")).join(""));
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

export function checkDigit(first12: string) {
  const sum = [...first12].reduce((s, d, i) => s + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

export type EanCheck = { ok: true; digits: string } | { ok: false; reason: "empty" | "format" | "checksum"; expected?: number };

export function normalizeEan(input: string | null | undefined): EanCheck {
  const raw = (input ?? "").replace(/[\s-]/g, "");
  if (!raw) return { ok: false, reason: "empty" };
  if (!/^\d{12,13}$/.test(raw)) return { ok: false, reason: "format" };
  const digits = raw.length === 12 ? "0" + raw : raw;
  const expected = checkDigit(digits.slice(0, 12));
  if (expected !== Number(digits[12])) return { ok: false, reason: "checksum", expected };
  return { ok: true, digits };
}

/** 95 modules ("1" = bar) for a valid 13-digit code. */
export function ean13Modules(digits: string) {
  const parity = PARITY[Number(digits[0])];
  let out = "101";
  for (let i = 1; i <= 6; i++) out += (parity[i - 1] === "L" ? L : G)[Number(digits[i])];
  out += "01010";
  for (let i = 7; i <= 12; i++) out += R[Number(digits[i])];
  return out + "101";
}

/** Guard bars (start, centre, end) are drawn longer, as on real packs. */
export function isGuardModule(i: number) {
  return i < 3 || (i >= 45 && i < 50) || i >= 92;
}
