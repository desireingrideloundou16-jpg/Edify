/** "#7a1f3d" → "deep burgundy red": image models follow colour words far better than hex codes. */
export function colorName(hex: string): string {
  const m = hex.replace("#", "");
  const n = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m.slice(0, 6), 16);
  if (Number.isNaN(n)) return "neutral";
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  if (s < 0.12) {
    if (l > 0.93) return "white";
    if (l > 0.8) return "off-white";
    if (l > 0.6) return "light grey";
    if (l > 0.3) return "grey";
    if (l > 0.12) return "charcoal";
    return "black";
  }
  const hues: [number, string][] = [
    [12, "red"], [25, "red-orange"], [40, "orange"], [50, "amber"], [62, "golden yellow"], [80, "yellow"],
    [100, "lime green"], [150, "green"], [175, "teal"], [195, "cyan"], [225, "blue"], [255, "indigo"],
    [285, "purple"], [320, "magenta"], [345, "pink"], [361, "red"],
  ];
  let hue = hues.find(([lim]) => h < lim)![1];
  // Warm colours read differently when dark or light.
  if (l < 0.35 && (hue === "orange" || hue === "red-orange" || hue === "amber")) hue = "brown";
  if (l < 0.3 && (hue === "red" || hue === "pink" || hue === "magenta")) hue = "burgundy";
  if (l > 0.78 && (hue === "orange" || hue === "amber" || hue === "golden yellow")) hue = "cream";
  const tone = l < 0.18 ? "very dark " : l < 0.35 ? "deep " : l > 0.82 ? "pale " : l > 0.65 ? "light " : "";
  const sat = s < 0.3 ? "muted " : s > 0.75 && l > 0.35 && l < 0.7 ? "vivid " : "";
  return `${tone}${sat}${hue}`.trim();
}
