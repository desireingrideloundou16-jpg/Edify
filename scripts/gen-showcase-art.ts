import { readFileSync, writeFileSync, mkdirSync } from "fs";
for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) { const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i)] = l.slice(i + 1).trim(); }
const OUT = process.argv[2];
const ONLY = process.argv[3]?.split(",").map(Number);
(async () => {
  const { SHOWCASE } = await import("../src/components/landing/showcase");
  const { colorName } = await import("../src/lib/ai/colorNames");
  const { resolveColors, luminance } = await import("../src/lib/artwork/draw");
  const STYLES: Record<string, string> = {
    engraving: "vintage botanical engraving illustration, fine etching and cross-hatching lines, detailed scientific illustration, printed label artwork",
    flat: "bold flat vector illustration, clean geometric shapes, modern packaging illustration, flat colours, no gradients",
    watercolor: "delicate watercolour illustration, soft washes and pigment blooms, elegant, hand painted",
    linocut: "bold linocut relief print illustration, carved texture, strong graphic contrast, African textile inspired shapes",
    photo: "appetizing high-end macro photograph, studio lighting, fresh, glistening, ultra detailed, commercial food photography",
    papercut: "layered paper-cut art illustration, soft shadows between paper layers, handcrafted",
    mascot: "friendly cartoon mascot character illustration, bold clean outlines, playful, vector style, full body",
    lineart: "minimal elegant continuous line art illustration, thin confident lines",
  };
  mkdirSync(OUT, { recursive: true });
  for (let i = 0; i < SHOWCASE.length; i++) {
    const d = SHOWCASE[i].design;
    if (!d.artStyle || d.artStyle === "none" || (ONLY && !ONLY.includes(i))) continue;
    const { bg, ink, accent, extra } = resolveColors(d.palette);
    const dark = luminance(bg) <= 0.45;
    const ground = d.artStyle === "photo" ? `on a plain seamless ${colorName(bg)} background` : dark ? "on a pure solid black background" : "on a pure solid white background";
    const prompt = `${STYLES[d.artStyle]}: ${d.artSubject}. Colour palette limited to ${[accent, extra, ink].map(colorName).join(", ")}. Isolated subject ${ground}, centred, generous empty margin around it. Packaging label artwork, award-winning, high detail. No text, no letters, no words, no numbers, no logo, no frame, no border, no packaging, no bottle, no mockup.`;
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
      method: "POST", headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ prompt, steps: 8 }),
    });
    const j = await res.json();
    if (!j?.result?.image) { console.log(i, "FAIL", JSON.stringify(j).slice(0, 200)); continue; }
    writeFileSync(`${OUT}/${String(i).padStart(2, "0")}.jpg`, Buffer.from(j.result.image, "base64"));
    console.log(i, d.brandName, d.artStyle, dark ? "(noir)" : "(blanc)");
  }
})();
