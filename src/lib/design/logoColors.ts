/**
 * Logo analysis in the browser: a PNG copy the AI can look at, and the logo's dominant colours
 * (so the pack palette is built from the brand's own colours).
 */
export interface LogoInfo {
  mediaType: "image/png";
  data: string; // base64, no data: prefix
  colors: string[]; // dominant colours, most frequent first
}

const hex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

export async function analyzeLogo(dataUrl: string): Promise<LogoInfo | null> {
  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => resolve(null);
    i.src = dataUrl;
  });
  if (!img || !img.naturalWidth) return null;

  // PNG copy (SVG logos are rasterised: the AI models don't read SVG).
  const scale = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const data = c.toDataURL("image/png").split(",")[1];

  // Dominant colours: 4-bit-per-channel buckets, ignoring transparent and near-white pixels.
  const px = ctx.getImageData(0, 0, c.width, c.height).data;
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < px.length; i += 16) {
    const [r, g, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
    if (a < 140) continue;
    if (r > 238 && g > 238 && b > 238) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += r;
    e.g += g;
    e.b += b;
    buckets.set(key, e);
  }
  const ranked = [...buckets.values()].sort((a, b) => b.n - a.n);
  const total = ranked.reduce((s, e) => s + e.n, 0) || 1;
  const colors: string[] = [];
  for (const e of ranked) {
    if (e.n / total < 0.03 || colors.length >= 4) break;
    const [r, g, b] = [Math.round(e.r / e.n), Math.round(e.g / e.n), Math.round(e.b / e.n)];
    // Skip shades too close to a colour already kept.
    const close = colors.some((h) => {
      const n = parseInt(h.slice(1), 16);
      return Math.abs(((n >> 16) & 255) - r) + Math.abs(((n >> 8) & 255) - g) + Math.abs((n & 255) - b) < 60;
    });
    if (!close) colors.push(hex(r, g, b));
  }
  return { mediaType: "image/png", data, colors };
}
