import type { VisualStylePreset, StyleFamily } from "@/components/workspace/Modals";
import { ALL_VISUAL_STYLES as LEGACY_STYLES } from "./legacyStyles";

export const STYLE_FAMILIES: { id: StyleFamily | "all"; label: string }[] = [
  { id: "all",      label: "Toutes les familles" },
  { id: "minimal",  label: "Minimaliste & épuré" },
  { id: "luxury",   label: "Luxe & prestige" },
  { id: "eco",      label: "Naturel & écologique" },
  { id: "wellness", label: "Bien-être & soin" },
  { id: "vintage",  label: "Vintage & rétro" },
  { id: "modern",   label: "Moderne & tech" },
  { id: "bold",     label: "Audacieux & graphique" },
  { id: "playful",  label: "Ludique & enfants" },
  { id: "food",     label: "Gourmand & alimentaire" },
  { id: "cultural", label: "Inspirations du monde" },
];

// Short labels for the 10 original presets (their long names stay as tooltips).
const LEGACY_LABELS: Record<string, [string, string]> = {
  "botanical-natural":        ["Botanique", "Floral, doux, bio"],
  "luxury-obsidian-gold":     ["Noir & or", "Luxe intemporel"],
  "artisanal-kraft-cafe":     ["Kraft", "Artisanal, terroir"],
  "cyber-neon-modern":        ["Néon", "Holographique"],
  "clinical-purity-white":    ["Clinique", "Blanc, pur, médical"],
  "pastel-scandi-zen":        ["Pastel", "Doux, scandinave"],
  "retro-apothecary-1920":    ["Apothicaire", "Rétro 1920"],
  "pop-art-vibrant":          ["Pop art", "Vif, énergique"],
  "japanese-wabi-sabi":       ["Wabi-sabi", "Zen, japonais"],
  "high-tech-matte-titanium": ["Titane", "Mat, high-tech"],
};

// [id, label, hint, family, background, primary, accent, extra, finishing, font]
type Row = [string, string, string, StyleFamily, string, string, string, string, string, string];

const ROWS: Row[] = [
  // ── Minimaliste ──
  ["swiss-grid", "Suisse", "Grille, typo nette", "minimal", "#ffffff", "#111111", "#e30613", "#f2f2f2", "Offset mat", "sans"],
  ["nordic-white", "Nordique", "Blanc, bois clair", "minimal", "#f7f5f0", "#2b2b2b", "#c9b79c", "#e8e2d6", "Papier non couché", "sans"],
  ["monochrome-black", "Tout noir", "Monochrome intense", "minimal", "#111111", "#fafafa", "#7a7a7a", "#2a2a2a", "Soft touch + vernis sélectif", "sans"],
  ["monochrome-white", "Tout blanc", "Monochrome, gaufrage", "minimal", "#fbfbfb", "#1d1d1d", "#bdbdbd", "#efefef", "Gaufrage à sec", "sans"],
  ["industrial-clean", "Industriel", "Dieter Rams, précis", "minimal", "#eceae6", "#1f1f1f", "#ff5a1f", "#c8c6c1", "Offset mat", "mono"],
  ["type-only", "Typographique", "Que du texte", "minimal", "#f4f1ea", "#141414", "#141414", "#d8d3c7", "Impression noire 1 couleur", "serif"],
  ["line-art", "Trait fin", "Illustration au trait", "minimal", "#fffdf8", "#1c1c1c", "#9a8f7a", "#ece6d8", "Papier texturé", "serif"],
  ["soft-grey", "Gris doux", "Neutre, apaisé", "minimal", "#e9e9e7", "#3a3a3a", "#8c8c88", "#d4d4d1", "Soft touch", "sans"],

  // ── Luxe ──
  ["champagne-gold", "Champagne", "Crème & or pâle", "luxury", "#f5ecd9", "#3b2f22", "#c8a24a", "#e6d5b0", "Dorure à chaud or", "serif"],
  ["emerald-gold", "Émeraude", "Vert profond & or", "luxury", "#0f3b2e", "#f3e9cf", "#d4af37", "#165443", "Dorure or + soft touch", "serif"],
  ["navy-silver", "Marine", "Bleu nuit & argent", "luxury", "#0f1c3f", "#eef1f7", "#b8c2d6", "#1b2a55", "Marquage argent", "serif"],
  ["burgundy-velvet", "Bordeaux", "Velours, cuivre", "luxury", "#4a0f1f", "#f6e7e0", "#c07a4f", "#6b1a2e", "Toucher velours + cuivre", "serif"],
  ["marble-luxe", "Marbre", "Marbre blanc & or", "luxury", "#f3f1ee", "#2d2a26", "#b8913a", "#d9d4cc", "Vernis brillant + dorure", "serif"],
  ["art-deco", "Art déco", "Géométrie 1925, or", "luxury", "#141414", "#e8d3a2", "#c9a14a", "#262626", "Dorure or + gaufrage", "display"],
  ["rose-gold", "Or rose", "Rose poudré & cuivre", "luxury", "#f6e3dc", "#4a2c2a", "#b76e79", "#ecc9bf", "Dorure or rose", "serif"],
  ["black-silver", "Noir & argent", "Élégant, froid", "luxury", "#0d0d0d", "#e6e6e6", "#a8a8a8", "#262626", "Marquage argent + soft touch", "sans"],

  // ── Naturel ──
  ["kraft-stamp", "Tampon kraft", "Brut, tamponné", "eco", "#c8a57a", "#2a1e12", "#7a4b21", "#b38d5f", "Kraft brut 1 couleur", "mono"],
  ["forest-green", "Forêt", "Vert sapin, bois", "eco", "#e8efe4", "#1f3d2b", "#6b8f5e", "#c9d8c0", "Papier recyclé", "serif"],
  ["terracotta", "Terracotta", "Argile, chaud", "eco", "#f2e1d3", "#5a2e1b", "#c1673e", "#e3bfa4", "Papier non couché", "sans"],
  ["seaweed-ocean", "Océan", "Algue, bleu-vert", "eco", "#e3efee", "#153b40", "#3f8f8a", "#c2dcd9", "Papier recyclé", "sans"],
  ["recycled-speckle", "Recyclé", "Papier moucheté", "eco", "#ece7dd", "#2e2a24", "#5f7a4a", "#d6cfbf", "Papier recyclé moucheté", "sans"],
  ["herbal-apothecary", "Herboriste", "Plantes, gravure", "eco", "#f1efe4", "#28361f", "#8a7a3d", "#dcd8c3", "Papier texturé", "serif"],
  ["sand-dune", "Sable", "Beige, minéral", "eco", "#efe4d2", "#4b3b2a", "#b89468", "#e0d0b6", "Soft touch", "sans"],
  ["honey-bee", "Miel", "Ambre, alvéoles", "eco", "#fdf1d6", "#3f2a0c", "#e0a526", "#f5dca3", "Vernis sélectif", "serif"],

  // ── Bien-être ──
  ["spa-mint", "Spa", "Menthe, fraîcheur", "wellness", "#eaf6f2", "#1f4a42", "#7cc4b2", "#cfeae2", "Soft touch", "sans"],
  ["lavender-calm", "Lavande", "Calme, violet doux", "wellness", "#efeaf7", "#3b2d5c", "#9b87c9", "#dcd3ee", "Soft touch", "sans"],
  ["pharma-blue", "Pharmacie", "Bleu, confiance", "wellness", "#f4f8fc", "#0d3b66", "#2f80c3", "#dce9f5", "Vernis mat", "sans"],
  ["clean-beauty", "Clean beauty", "Beige nude, sobre", "wellness", "#f3ebe3", "#3d3029", "#c9a58d", "#e7d9cc", "Soft touch", "sans"],
  ["cbd-sage", "Sauge", "Vert sauge, apaisant", "wellness", "#e9eee6", "#2f3d2c", "#8fa383", "#d2dccb", "Papier non couché", "sans"],
  ["sunrise-vitamin", "Vitamine", "Orange, énergie", "wellness", "#fff3e6", "#5a2a00", "#ff8a1f", "#ffd9b0", "Vernis brillant", "sans"],
  ["pearl-glow", "Nacre", "Irisé, lumineux", "wellness", "#f7f4f8", "#3a3440", "#c7b8d6", "#e9e2ef", "Pelliculage nacré", "sans"],

  // ── Vintage ──
  ["retro-70s", "Années 70", "Orange, marron, ondes", "vintage", "#f6e3c0", "#5b2c10", "#e0772b", "#c9a045", "Papier mat", "display"],
  ["diner-50s", "Années 50", "Diner américain", "vintage", "#fdf1dc", "#b3122e", "#1d9aa6", "#f2c14e", "Vernis brillant", "script"],
  ["victorian", "Victorien", "Ornements, gravure", "vintage", "#efe6d2", "#2a1d12", "#8c1c13", "#c9b58c", "Dorure + gaufrage", "serif"],
  ["old-label", "Étiquette ancienne", "Papier vieilli", "vintage", "#e9dcc0", "#3a2a18", "#7a5a2f", "#d4c29c", "Papier vergé", "serif"],
  ["bauhaus", "Bauhaus", "Formes primaires", "vintage", "#f1ebdd", "#1a1a1a", "#d23a26", "#f2b705", "Offset mat", "sans"],
  ["french-bistro", "Bistrot", "Rayures, Paris", "vintage", "#f7f0e2", "#1f3552", "#c0392b", "#e6d8bd", "Papier non couché", "serif"],
  ["y2k", "An 2000", "Chrome, bulles", "vintage", "#e8f0ff", "#3a2bd1", "#ff5fc8", "#bfd4ff", "Pelliculage holographique", "display"],
  ["psychedelic", "Psychédélique", "Couleurs fondues", "vintage", "#ffe7c2", "#5b1a7a", "#ff4d6d", "#ffb703", "Vernis brillant", "display"],

  // ── Moderne ──
  ["gradient-mesh", "Dégradé", "Couleurs fluides", "modern", "#f1ecff", "#2a1f5c", "#7b5cff", "#ff8fb1", "Vernis brillant", "sans"],
  ["glassmorphism", "Verre dépoli", "Transparence, flou", "modern", "#eaf2fb", "#1c2b3d", "#6fa8dc", "#d2e3f5", "Pelliculage satiné", "sans"],
  ["dark-tech", "Tech sombre", "Noir, accents cyan", "modern", "#0e1116", "#e6f1ff", "#22d3ee", "#1c2330", "Soft touch", "mono"],
  ["electric-blue", "Bleu électrique", "Vif, sportif", "modern", "#0a2aff", "#ffffff", "#c6ff00", "#001a8c", "Vernis brillant", "sans"],
  ["chrome-future", "Chrome", "Métal liquide", "modern", "#dfe3e8", "#111418", "#8a96a3", "#c3c9d1", "Métallisé argent", "sans"],
  ["startup-clean", "Startup", "Frais, simple", "modern", "#f6f8ff", "#141a33", "#4f6bff", "#e1e6ff", "Offset mat", "sans"],
  ["brutalist", "Brutaliste", "Brut, gros caractères", "modern", "#e4e4e0", "#0a0a0a", "#ff3b00", "#bdbdb7", "Offset mat", "mono"],

  // ── Audacieux ──
  ["color-block", "Aplats", "Blocs de couleur", "bold", "#ffd23f", "#1b1b1b", "#ee4266", "#3bceac", "Vernis brillant", "sans"],
  ["memphis", "Memphis", "Formes, confettis", "bold", "#fff5e1", "#1f1f1f", "#ff4f79", "#2ec4b6", "Vernis brillant", "display"],
  ["neon-night", "Nuit néon", "Rose & bleu fluo", "bold", "#120b26", "#ffffff", "#ff2bd6", "#20e3ff", "Encres fluo", "display"],
  ["street-graffiti", "Street", "Graffiti, urbain", "bold", "#1c1c1c", "#f5f5f5", "#ffe600", "#ff3d7f", "Vernis sélectif", "display"],
  ["maximalist", "Maximaliste", "Motifs, chaos", "bold", "#ffe3ec", "#2b0f3a", "#ff6b35", "#00a896", "Vernis brillant", "display"],
  ["big-type", "Gros titre", "Typo géante", "bold", "#f2f2f2", "#111111", "#ff2e2e", "#dcdcdc", "Offset mat", "display"],
  ["duotone", "Duotone", "Deux couleurs fortes", "bold", "#ff5c39", "#1c1340", "#1c1340", "#ff9a7f", "Offset mat", "sans"],

  // ── Ludique ──
  ["kids-rainbow", "Arc-en-ciel", "Enfants, joyeux", "playful", "#fff8e7", "#2d2a6e", "#ff6f59", "#43bccd", "Vernis brillant", "display"],
  ["candy-pop", "Bonbon", "Rose, sucré", "playful", "#ffe4f1", "#5a1846", "#ff5fa2", "#ffd166", "Vernis brillant", "display"],
  ["cartoon-mascot", "Mascotte", "Personnage, cartoon", "playful", "#e8f7ff", "#12355b", "#ff9f1c", "#2ec4b6", "Vernis brillant", "display"],
  ["doodle", "Gribouillis", "Dessin à la main", "playful", "#fffdf5", "#222222", "#ff5d5d", "#ffd23f", "Papier mat", "script"],
  ["pet-friendly", "Animaux", "Doux, rassurant", "playful", "#fff4e0", "#3b2a1a", "#f28c28", "#8cc084", "Vernis mat", "display"],

  // ── Gourmand ──
  ["farm-fresh", "Ferme", "Produits frais", "food", "#f5f0e1", "#2f4a22", "#d9822b", "#c9d6a3", "Papier non couché", "serif"],
  ["artisan-bakery", "Boulangerie", "Pain, farine", "food", "#f3e6d0", "#4a2f1a", "#b5651d", "#e3cfa9", "Kraft + 1 couleur", "script"],
  ["chocolatier", "Chocolatier", "Cacao & or", "food", "#3b2218", "#f3e3cf", "#c8963e", "#5a3526", "Dorure or", "serif"],
  ["juicy-fruit", "Fruité", "Vitaminé, frais", "food", "#fff4d6", "#1f4d1a", "#ff6b3d", "#ffd23f", "Vernis brillant", "display"],
  ["coffee-roast", "Torréfaction", "Café, noir & crème", "food", "#1e1a17", "#f1e6d6", "#c47a3d", "#3a312a", "Soft touch", "serif"],
  ["italian-deli", "Épicerie italienne", "Rouge, vert, crème", "food", "#f7efdf", "#1f5130", "#c8102e", "#e6d6b3", "Papier non couché", "serif"],
  ["gourmet-black", "Épicerie fine", "Noir & cuivre", "food", "#141414", "#f1ece4", "#b87333", "#2a2a2a", "Soft touch + cuivre", "serif"],
  ["dairy-fresh", "Laitier", "Bleu ciel, lait", "food", "#f3f9ff", "#12356b", "#5aa9e6", "#dcecfb", "Vernis mat", "sans"],

  // ── Inspirations du monde ──
  ["japanese-minimal", "Japon", "Épuré, rouge hinomaru", "cultural", "#f6f1e7", "#1a1a1a", "#bc002d", "#e3dccb", "Papier washi", "serif"],
  ["moroccan", "Maroc", "Zellige, bleu majorelle", "cultural", "#f4ead8", "#1e2a78", "#d4a017", "#2e86ab", "Dorure or", "serif"],
  ["african-wax", "Wax", "Motifs africains", "cultural", "#ffcf3f", "#2b1a0e", "#e2442f", "#1b998b", "Vernis brillant", "display"],
  ["mexican-fiesta", "Mexique", "Couleurs vives", "cultural", "#fff0d9", "#2a1a4a", "#ff3c7e", "#00b2a9", "Vernis brillant", "display"],
  ["indian-spice", "Épices d'Inde", "Safran, motifs", "cultural", "#fbe8c8", "#5a1414", "#e08e0b", "#b83b5e", "Dorure or", "serif"],
  ["mediterranean", "Méditerranée", "Bleu, blanc, olive", "cultural", "#f5f7f8", "#12476b", "#6b8e23", "#d5e4ee", "Papier non couché", "serif"],
  ["chinese-lacquer", "Laque de Chine", "Rouge & or", "cultural", "#9e1b1b", "#fbe9c6", "#e6b422", "#6f1111", "Dorure or + vernis", "serif"],
  ["scandi-folk", "Folk nordique", "Motifs brodés", "cultural", "#f7f2ea", "#1e3a5f", "#c8453b", "#e5d8c2", "Papier non couché", "sans"],
];

const FAMILY_BADGE: Record<StyleFamily, string> = {
  minimal: "○", luxury: "★", eco: "✿", wellness: "✦", vintage: "❦",
  modern: "◆", bold: "■", playful: "●", food: "❀", cultural: "✺",
};

const NEW_STYLES: VisualStylePreset[] = ROWS.map(
  ([id, label, hint, family, bg, primary, accent, extra, finishing, font]) => ({
    id,
    name: label,
    subtitle: hint,
    description: `${label} — ${hint}.`,
    badge: FAMILY_BADGE[family],
    primaryColor: primary,
    accentColor: accent,
    palette: [bg, primary, accent, extra],
    bgGradient: "",
    fontFamily: font,
    finishing,
    category: family,
    label,
    hint,
  })
);

export const ALL_CATALOG_STYLES: VisualStylePreset[] = [
  ...LEGACY_STYLES.map((s) => {
    const [label, hint] = LEGACY_LABELS[s.id] ?? [s.name, s.subtitle];
    return { ...s, label, hint };
  }),
  ...NEW_STYLES,
];

export function searchStyles(query: string, family: string): VisualStylePreset[] {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const terms = norm(query).split(/\s+/).filter(Boolean);
  return ALL_CATALOG_STYLES.filter((s) => {
    if (family !== "all" && s.category !== family) return false;
    if (!terms.length) return true;
    const hay = norm([s.label, s.hint, s.name, s.subtitle, s.finishing].join(" "));
    return terms.every((t) => hay.includes(t));
  });
}
