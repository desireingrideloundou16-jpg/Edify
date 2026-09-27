/**
 * Design spec produced from a user's brief — by Claude (api/design) or, when
 * no API key is configured, by the local rule-based designer below.
 * Server-safe: no React / DOM imports.
 */
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import { ALL_CATALOG_STYLES } from "@/lib/catalog/styles";
import { PACKAGING_FONTS } from "@/lib/catalog/fonts";
import { LAYOUTS, MOTIFS, isLayout, isMotif } from "@/lib/artwork/compose";

export interface DesignSpec {
  shapeId: string;
  styleId: string;
  headingFont: string;
  bodyFont: string;
  palette: { background: string; ink: string; accent: string; extra: string };
  /** Front composition and background motif (see lib/artwork/compose). */
  layout: string;
  motif: string;
  projectName: string;
  brandName: string;
  productName: string;
  tagline: string;
  volume: string;
  details: string;
  /** Ingredient list / INCI, and directions: proposed by the AI when the user gave none. */
  ingredients: string;
  usage: string;
  rationale: string;
}

export interface CurrentDesign {
  shapeId: string;
  styleId: string;
  /** Label information already entered by the user (kept as is on the pack). */
  ingredients?: string;
  usage?: string;
  barcode?: string;
  expiry?: string;
  production?: string;
  price?: string;
  extra?: string;
  tagline?: string;
  details?: string;
  brandName: string;
  productName: string;
  volume: string;
}

export const SHAPE_IDS = SHAPE_ROWS.map((r) => r[0]);
export const STYLE_IDS = ALL_CATALOG_STYLES.map((s) => s.id);
export const FONT_FAMILIES = PACKAGING_FONTS.map((f) => f.family);
export const LAYOUT_IDS = [...LAYOUTS];
export const MOTIF_IDS = [...MOTIFS];

/** Art direction by category, used when the model gives nothing usable and by the offline designer. */
export function defaultArtDirection(text: string, seed: number): { layout: string; motif: string } {
  const t = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const pick = <T,>(list: T[]) => list[seed % list.length];
  if (/miel|honey|epice|poivre|penja|biscuit|chocolat|cacao|vin|rhum|whisky/.test(t)) return { layout: pick(["frame", "emblem", "window"]), motif: pick(["geometric", "wax", "none", "botanical"]) };
  if (/cafe|coffee|the |tea|infusion|moringa/.test(t)) return { layout: pick(["emblem", "minimal", "window", "split"]), motif: pick(["botanical", "geometric", "none"]) };
  if (/serum|creme|karite|shea|parfum|cosmet|savon|huile|lotion/.test(t)) return { layout: pick(["minimal", "window", "classic"]), motif: pick(["none", "botanical", "waves"]) };
  if (/chips|snack|plantain|bonbon|enfant|kids|jus|juice|bissap|soda|canette|energy/.test(t)) return { layout: pick(["pop", "bold", "band", "split"]), motif: pick(["dots", "stripes", "sunburst", "wax"]) };
  return { layout: pick(["band", "split", "classic", "window", "bold"]), motif: pick(["geometric", "dots", "none", "waves"]) };
}

/** Compact catalog description given to the model. */
export function catalogForPrompt() {
  const shapes = SHAPE_ROWS.map(([id, name, , , l, w, h, mat]) => `${id}: ${name} (${l}×${w}×${h} mm, ${mat})`).join("\n");
  const styles = ALL_CATALOG_STYLES.map((s) => `${s.id}: ${s.label ?? s.name} — ${s.hint ?? s.subtitle} [${s.palette.join(" ")}] finition ${s.finishing}`).join("\n");
  const fonts = PACKAGING_FONTS.map((f) => `${f.family} (${f.category})`).join(", ");
  return { shapes, styles, fonts };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Clamp a spec to known ids and valid colours. */
export function sanitizeSpec(spec: DesignSpec, current: CurrentDesign): DesignSpec {
  const style = ALL_CATALOG_STYLES.find((s) => s.id === spec.styleId) ?? ALL_CATALOG_STYLES[0];
  const pal = spec.palette ?? ({} as DesignSpec["palette"]);
  const fix = (c: string | undefined, i: number) => (c && HEX.test(c) ? c : style.palette[i]);
  return {
    ...spec,
    shapeId: SHAPE_IDS.includes(spec.shapeId) ? spec.shapeId : current.shapeId,
    styleId: style.id,
    headingFont: FONT_FAMILIES.includes(spec.headingFont) ? spec.headingFont : "",
    bodyFont: FONT_FAMILIES.includes(spec.bodyFont) ? spec.bodyFont : "",
    ...(() => {
      const fallback = defaultArtDirection(`${spec.productName} ${spec.projectName} ${spec.shapeId}`, spec.brandName?.length ?? 0);
      return { layout: isLayout(spec.layout) ? spec.layout : fallback.layout, motif: isMotif(spec.motif) ? spec.motif : fallback.motif };
    })(),
    palette: { background: fix(pal.background, 0), ink: fix(pal.ink, 1), accent: fix(pal.accent, 2), extra: fix(pal.extra, 3) },
    brandName: (spec.brandName || current.brandName).slice(0, 40),
    productName: (spec.productName || current.productName).slice(0, 60),
    tagline: (spec.tagline || "").slice(0, 80),
    volume: (spec.volume || current.volume).slice(0, 40),
    details: (spec.details || "").slice(0, 600),
    ingredients: (spec.ingredients || "").slice(0, 600),
    usage: (spec.usage || "").slice(0, 300),
    projectName: (spec.projectName || spec.productName || "Nouveau projet").slice(0, 60),
  };
}

// ─── Local rule-based designer (offline fallback) ────────────────────────────

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface Intent {
  words: string[];
  shape: string;
  style: string;
  product: string;
  volume: string;
  details: string;
}

const INTENTS: Intent[] = [
  { words: ["cafe", "coffee", "espresso", "arabica"], shape: "coffee-pouch", style: "coffee-roast", product: "Café en grains", volume: "250 g", details: "100 % arabica, torréfaction artisanale. À conserver au sec, à l'abri de la lumière. Refermer après ouverture." },
  { words: ["the ", "the,", "infusion", "tisane", "matcha"], shape: "tea-box", style: "herbal-apothecary", product: "Thé vert", volume: "20 sachets — 40 g", details: "Infusez 3 minutes dans une eau à 80 °C. Ingrédients : thé vert, plantes aromatiques." },
  { words: ["serum", "huile visage", "elixir"], shape: "dropper-bottle", style: "clean-beauty", product: "Sérum éclat", volume: "30 ml — 1.0 fl oz", details: "Aqua, Glycerin, Sodium Hyaluronate, Ascorbic Acid, Parfum. Appliquer matin et soir sur peau propre." },
  { words: ["parfum", "eau de toilette", "fragrance"], shape: "perfume-bottle", style: "champagne-gold", product: "Eau de parfum", volume: "50 ml — 1.7 fl oz", details: "Alcohol denat., Parfum, Aqua. Vaporiser sur la peau. Inflammable." },
  { words: ["creme", "baume", "hydratant"], shape: "cosmetic-jar", style: "clean-beauty", product: "Crème hydratante", volume: "50 ml", details: "Aqua, Butyrospermum Parkii Butter, Glycerin, Tocopherol. Appliquer sur peau propre." },
  { words: ["shampo", "gel douche", "apres-shampo"], shape: "shampoo-bottle", style: "spa-mint", product: "Shampoing doux", volume: "250 ml", details: "Aqua, Sodium Coco-Sulfate, Glycerin, Parfum. Appliquer sur cheveux mouillés, masser, rincer." },
  { words: ["savon"], shape: "soap-box", style: "recycled-speckle", product: "Savon saponifié à froid", volume: "100 g", details: "Huile d'olive, huile de coco, beurre de karité, huiles essentielles." },
  { words: ["bougie", "candle"], shape: "candle-jar", style: "sand-dune", product: "Bougie parfumée", volume: "180 g — 40 h", details: "Cire végétale, mèche en coton, parfum. Ne jamais laisser une bougie allumée sans surveillance." },
  { words: ["miel", "honey"], shape: "honey-jar", style: "honey-bee", product: "Miel de fleurs", volume: "250 g", details: "Miel récolté localement. Peut cristalliser naturellement." },
  { words: ["confiture"], shape: "jam-jar", style: "farm-fresh", product: "Confiture extra", volume: "320 g", details: "Fruits, sucre de canne, jus de citron, pectine. Préparée avec 60 g de fruits pour 100 g." },
  { words: ["chocolat"], shape: "chocolate-box", style: "chocolatier", product: "Chocolat noir 70 %", volume: "100 g", details: "Pâte de cacao, sucre, beurre de cacao. Traces possibles de lait et fruits à coque." },
  { words: ["biere", "beer", "ipa"], shape: "beverage-can", style: "color-block", product: "Bière artisanale IPA", volume: "33 cl — 6,5 % vol.", details: "Eau, malt d'orge, houblon, levure. L'abus d'alcool est dangereux pour la santé." },
  { words: ["vin", "wine"], shape: "wine-bottle", style: "burgundy-velvet", product: "Vin rouge", volume: "75 cl — 13,5 % vol.", details: "Contient des sulfites. L'abus d'alcool est dangereux pour la santé." },
  { words: ["gin", "rhum", "whisky", "vodka", "spiritueux"], shape: "spirits-bottle", style: "art-deco", product: "Gin distillé", volume: "70 cl — 40 % vol.", details: "L'abus d'alcool est dangereux pour la santé, à consommer avec modération." },
  { words: ["energy", "soda", "boisson", "canette"], shape: "sleek-can", style: "neon-night", product: "Boisson énergisante", volume: "250 ml", details: "Eau gazéifiée, sucre, acidifiant, caféine (32 mg/100 ml). Déconseillé aux enfants." },
  { words: ["jus", "smoothie", "juice"], shape: "juice-bottle", style: "juicy-fruit", product: "Jus pressé", volume: "33 cl", details: "100 % fruits pressés. À conserver au frais, à consommer rapidement après ouverture." },
  { words: ["eau ", "water"], shape: "water-bottle", style: "seaweed-ocean", product: "Eau de source", volume: "50 cl", details: "Eau de source naturelle. Minéralisation faible." },
  { words: ["huile d'olive", "huile olive"], shape: "olive-oil-bottle", style: "mediterranean", product: "Huile d'olive vierge extra", volume: "50 cl", details: "Première pression à froid. À conserver à l'abri de la lumière." },
  { words: ["chips", "snack", "crackers"], shape: "chips-bag", style: "color-block", product: "Chips croustillantes", volume: "150 g", details: "Pommes de terre, huile de tournesol, sel. Peut contenir des traces de gluten." },
  { words: ["biscuit", "cookie", "sable"], shape: "cookie-tin", style: "scandi-folk", product: "Biscuits sablés", volume: "300 g", details: "Farine de blé, beurre, sucre, œufs. Allergènes : gluten, lait, œufs." },
  { words: ["cereale", "granola", "muesli"], shape: "cereal-box", style: "farm-fresh", product: "Granola croustillant", volume: "375 g", details: "Flocons d'avoine, miel, amandes, raisins. Contient : gluten, fruits à coque." },
  { words: ["proteine", "whey", "complement", "vitamine", "gelule"], shape: "protein-tub", style: "startup-clean", product: "Protéine whey", volume: "1 kg", details: "Isolat de protéine de lactosérum, arôme naturel. Complément alimentaire, ne se substitue pas à une alimentation variée." },
  { words: ["dentifrice", "tube"], shape: "squeeze-tube", style: "pharma-blue", product: "Dentifrice blancheur", volume: "75 ml", details: "Aqua, Hydrated Silica, Sorbitol, Sodium Fluoride (1450 ppm F)." },
  { words: ["glace", "sorbet", "ice cream"], shape: "ice-cream-tub", style: "candy-pop", product: "Crème glacée", volume: "500 ml", details: "Lait, crème, sucre, vanille. Contient : lait." },
  { words: ["lait", "milk"], shape: "milk-carton", style: "dairy-fresh", product: "Lait entier", volume: "1 L", details: "Lait entier pasteurisé. À conserver au frais après ouverture." },
  { words: ["croquette", "chien", "chat", "animal"], shape: "pet-food-bag", style: "pet-friendly", product: "Croquettes premium", volume: "2 kg", details: "Viande de poulet déshydratée, riz, légumes, minéraux." },
  { words: ["pizza"], shape: "pizza-box", style: "italian-deli", product: "Pizza artisanale", volume: "Ø 33 cm", details: "Pâte au levain, sauce tomate, mozzarella." },
  { words: ["coffret", "cadeau", "gift", "bijou", "montre"], shape: "luxury-rigid-box", style: "luxury-obsidian-gold", product: "Coffret prestige", volume: "Édition limitée", details: "Coffret rigide recouvert, dorure à chaud." },
  { words: ["e-commerce", "colis", "envoi", "abonnement"], shape: "subscription-box", style: "startup-clean", product: "Box découverte", volume: "Édition du mois", details: "Merci pour votre commande ! Emballage 100 % recyclable." },
];

const STYLE_WORDS: [string[], string][] = [
  [["luxe", "premium", "prestige", "haut de gamme", "dore", "dorure"], "luxury-obsidian-gold"],
  [["bio", "naturel", "nature", "ecolo", "vegan", "botanique"], "botanical-natural"],
  [["kraft", "artisanal", "fait main"], "kraft-stamp"],
  [["minimal", "epure", "sobre", "simple", "clean"], "nordic-white"],
  [["enfant", "kids", "ludique", "fun"], "kids-rainbow"],
  [["vintage", "retro", "ancien"], "old-label"],
  [["neon", "cyber", "futur", "gaming"], "neon-night"],
  [["pharma", "medical", "clinique", "dermato"], "pharma-blue"],
  [["pastel", "doux", "tendre"], "pastel-scandi-zen"],
  [["japon", "zen"], "japanese-minimal"],
  [["maroc", "oriental"], "moroccan"],
  [["afrique", "africain", "wax"], "african-wax"],
  [["mexique", "fiesta"], "mexican-fiesta"],
  [["inde", "epice"], "indian-spice"],
  [["art deco", "gatsby"], "art-deco"],
  [["colore", "pop", "vif"], "color-block"],
];

const COLORS: [string[], string][] = [
  [["noir", "black"], "#111111"], [["blanc", "white"], "#fafafa"], [["creme", "ivoire", "beige"], "#f4ecdc"],
  [["or", "dore", "gold"], "#c9a24a"], [["argent", "silver"], "#b8c2d6"], [["rose", "pink"], "#f4a7bb"],
  [["rouge", "red"], "#c8102e"], [["bordeaux"], "#6b1a2e"], [["orange"], "#ff8a1f"], [["jaune", "yellow"], "#ffd23f"],
  [["vert", "green", "sauge"], "#2f5d3a"], [["bleu", "blue", "marine"], "#1b3a6b"], [["violet", "lavande", "purple"], "#6b4fa0"],
  [["marron", "brun", "chocolat"], "#5a3526"], [["turquoise"], "#2ec4b6"],
];

function has(text: string, w: string) {
  return new RegExp(`(^|[^a-z])${w.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(text);
}

function pickBrand(prompt: string): string | null {
  const quoted = prompt.match(/["«“]\s*([^"»”]{2,30})\s*["»”]/);
  if (quoted) return quoted[1].trim();
  const named = prompt.match(/(?:marque|appel[ée]e?s?|nomm[ée]e?s?|brand|nom)\s*:?\s+([A-ZÀ-Ý0-9][\wÀ-ÿ'&-]*(?:\s+[A-ZÀ-Ý0-9][\wÀ-ÿ'&-]*)?)/);
  return named ? named[1].trim() : null;
}

const BRAND_POOL = ["AURELLE", "NOVA", "TERRA", "MAISON LUNE", "OKKO", "SOLÈNE", "VERDANT", "KAÏA", "ALBA", "ORÉE", "NÉO", "SILVA"];

export function localDesign(prompt: string, current: CurrentDesign): DesignSpec {
  const text = ` ${norm(prompt)} `;
  // Product = the intent mentioned first (packaging-only intents like "coffret" don't count as the product).
  const PACKAGING_ONLY = new Set(["luxury-rigid-box", "subscription-box"]);
  const firstPos = (i: Intent) =>
    Math.min(...i.words.map((w) => {
      const m = new RegExp(`(^|[^a-z])${norm(w).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).exec(text);
      return m ? m.index : Infinity;
    }));
  const ranked = INTENTS.map((i) => ({ i, p: firstPos(i) })).filter((x) => x.p < Infinity).sort((a, b) => a.p - b.p);
  const intent = (ranked.find((x) => !PACKAGING_ONLY.has(x.i.shape)) ?? ranked[0])?.i;

  // Shape: a container word in the brief ("canette", "flacon", "coffret"…) beats the product's usual pack.
  let shapeId = intent?.shape ?? current.shapeId;
  let best = intent ? 3 : 0;
  for (const [id, name, , , , , , , keywords] of SHAPE_ROWS) {
    const tokens = norm(name).split(/\s+/);
    const score = (tokens[0].length > 2 && has(text, tokens[0]) ? 4 : 0)
      + tokens.slice(1).filter((t) => t.length > 3 && has(text, t)).length
      + keywords.split(" ").filter((t) => t.length > 3 && has(text, norm(t))).length
      + (id === intent?.shape ? 3 : 0);
    if (score > best) {
      best = score;
      shapeId = id;
    }
  }

  // "style X" / "ambiance X" wins; otherwise the first style word found in the brief.
  const asked = text.match(/(?:style|ambiance|esprit|look)\s+(?:tres\s+|plutot\s+)?([a-z-]+)/)?.[1];
  const askedHit = asked ? STYLE_WORDS.find(([words]) => words.some((w) => norm(w).startsWith(asked.slice(0, 5)))) : undefined;
  const labelHit = asked ? ALL_CATALOG_STYLES.find((s) => norm(s.label ?? s.name).startsWith(asked.slice(0, 5))) : undefined;
  const lastPos = (words: string[]) => Math.max(-1, ...words.map((w) => text.lastIndexOf(norm(w))));
  const styleHit = askedHit ?? STYLE_WORDS.filter(([words]) => words.some((w) => has(text, w))).sort((a, b) => lastPos(b[0]) - lastPos(a[0]))[0];
  const styleId = labelHit?.id ?? styleHit?.[1] ?? intent?.style ?? current.styleId;
  const style = ALL_CATALOG_STYLES.find((s) => s.id === styleId) ?? ALL_CATALOG_STYLES[0];

  // Colours explicitly asked for override the style palette.
  const palette = [...style.palette];
  const bgMatch = text.match(/fond\s+(?:de\s+couleur\s+)?([a-z]+)/);
  const mentioned = COLORS.filter(([words]) => words.some((w) => has(text, w)));
  if (bgMatch) {
    const c = COLORS.find(([words]) => words.includes(bgMatch[1]));
    if (c) palette[0] = c[1];
  }
  const isBlack = (hex: string) => hex === "#111111";
  if (!bgMatch && mentioned.some(([, hex]) => isBlack(hex))) {
    palette[0] = "#111111";
    palette[1] = "#f5f1e8";
  }
  const others = mentioned.filter(([, hex]) => hex !== palette[0]);
  if (others[0]) palette[2] = others[0][1];

  const brand = pickBrand(prompt) ?? (intent ? BRAND_POOL[prompt.length % BRAND_POOL.length] : current.brandName);
  const vol = prompt.match(/(\d+(?:[.,]\d+)?)\s?(ml|cl|l|g|kg|gélules|gelules|capsules|sachets|pièces|pieces)\b/i);
  const qualifiers = ["bio", "premium", "vegan", "artisanal", "naturel", "intense", "doux", "vitamine C", "sans sucre", "rechargeable"]
    .filter((q) => has(text, norm(q)));
  // Keep the user's own wording when the brief says "miel de lavande", "thé à la menthe"…
  const word = intent?.words.map((w) => w.trim()).find((w) => has(text, norm(w)));
  const phrase = word
    ? prompt.match(new RegExp(`(${word}\\p{L}*\\s+(?:de|du|des|d'|à la|au|aux)\\s*\\p{L}+)`, "iu"))?.[1]
    : undefined;
  const productName = phrase
    ? phrase.charAt(0).toUpperCase() + phrase.slice(1)
    : intent?.product ?? (current.productName || "Produit signature");
  const tagline = qualifiers.map((q) => q.charAt(0).toUpperCase() + q.slice(1)).join(" · ");

  return {
    shapeId,
    styleId: style.id,
    headingFont: "",
    bodyFont: "",
    palette: { background: palette[0], ink: palette[1], accent: palette[2], extra: palette[3] },
    projectName: `${productName} ${brand}`.trim(),
    brandName: brand,
    productName,
    tagline,
    volume: vol ? `${vol[1]} ${vol[2]}` : intent?.volume ?? current.volume,
    details: intent?.details ?? "",
    ...defaultArtDirection(prompt, prompt.length),
    ingredients: "",
    usage: "",
    rationale: `Contenant et style choisis à partir des mots-clés de votre brief (${[intent?.product, style.label].filter(Boolean).join(", ")}).`,
  };
}
