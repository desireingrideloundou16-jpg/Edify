import {
  PackagingShape,
  ShapeCategory,
  ShapeModel,
  IllustrationFoldingBox,
  IllustrationRigidBox,
  IllustrationDropperBottle,
  IllustrationCosmeticJar,
  IllustrationDoypack,
  IllustrationMailerBox,
  IllustrationPumpBottle,
  IllustrationSqueezeTube,
  IllustrationCanette,
  IllustrationCylinderTube,
} from "@/components/workspace/Modals";

// ─── Categories (Pacdora-like families) ──────────────────────────────────────

export const SHAPE_CATEGORIES: { id: ShapeCategory | "all"; label: string }[] = [
  { id: "all",        label: "Tous" },
  { id: "boxes",      label: "Boîtes" },
  { id: "bottles",    label: "Bouteilles & flacons" },
  { id: "jars",       label: "Pots" },
  { id: "pouches",    label: "Sachets & pochettes" },
  { id: "tubes_cans", label: "Tubes" },
  { id: "cans",       label: "Canettes" },
  { id: "tins",       label: "Boîtes métal" },
  { id: "cups",       label: "Gobelets & tasses" },
  { id: "bags",       label: "Sacs" },
  { id: "food",       label: "Alimentaire" },
];

const CATEGORY_LABEL = Object.fromEntries(SHAPE_CATEGORIES.map((c) => [c.id, c.label])) as Record<string, string>;

// Flat 2D illustration kept for the legacy modal; the sidebar uses 3D thumbnails.
const ILLUSTRATION: Record<ShapeModel, () => React.ReactNode> = {
  box: IllustrationFoldingBox, pillow: IllustrationFoldingBox, tray: IllustrationMailerBox,
  mailer: IllustrationMailerBox, rigid: IllustrationRigidBox, carton: IllustrationFoldingBox,
  bottle: IllustrationPumpBottle, wine: IllustrationPumpBottle, jug: IllustrationPumpBottle,
  dropper: IllustrationDropperBottle, pump: IllustrationPumpBottle, spray: IllustrationPumpBottle,
  jar: IllustrationCosmeticJar, tin: IllustrationCosmeticJar, tub: IllustrationCosmeticJar,
  pouch: IllustrationDoypack, flatpouch: IllustrationDoypack, sachet: IllustrationDoypack,
  bag: IllustrationDoypack, shopper: IllustrationMailerBox,
  tube: IllustrationSqueezeTube, papertube: IllustrationCylinderTube,
  can: IllustrationCanette, cup: IllustrationCylinderTube,
};

// [id, name, category, model, L, W, H (mm), material, keywords]
type Row = [string, string, ShapeCategory, ShapeModel, number, number, number, string, string];

const ROWS: Row[] = [
  // ── Boîtes ──
  ["folding-box-standard", "Boîte pliante", "boxes", "box", 38, 38, 112, "Carton couché 350g", "étui cosmétique pharmacie reverse tuck"],
  ["tuck-end-box-wide", "Étui large", "boxes", "box", 90, 40, 130, "Carton couché 350g", "étui boîte pliante"],
  ["tuck-end-box-tall", "Étui haut parfum", "boxes", "box", 55, 55, 160, "Carton couché 400g", "parfum étui"],
  ["cube-box", "Boîte cube", "boxes", "box", 80, 80, 80, "Carton couché 350g", "carré cadeau"],
  ["flat-box", "Boîte plate", "boxes", "box", 150, 110, 30, "Carton couché 350g", "plate chocolat thé"],
  ["cereal-box", "Boîte céréales", "boxes", "box", 190, 65, 280, "Carton compact 400g", "céréales petit-déjeuner"],
  ["tea-box", "Boîte à thé", "boxes", "box", 70, 70, 130, "Carton couché 350g", "thé infusion"],
  ["cigarette-box", "Étui à rabat", "boxes", "box", 55, 22, 88, "Carton couché 300g", "petit étui"],
  ["soap-box", "Boîte savon", "boxes", "box", 90, 60, 35, "Kraft 350g", "savon solide"],
  ["candle-box", "Boîte bougie", "boxes", "box", 90, 90, 100, "Carton couché 350g", "bougie cadeau"],
  ["luxury-rigid-box", "Coffret rigide", "boxes", "rigid", 120, 120, 70, "Carton rigide 1,5 mm", "coffret luxe couvercle cloche"],
  ["rigid-watch-box", "Coffret montre", "boxes", "rigid", 100, 100, 80, "Carton rigide 2 mm", "bijou montre luxe"],
  ["rigid-shoe-box", "Boîte à chaussures", "boxes", "rigid", 330, 200, 120, "Carton rigide 1,5 mm", "chaussures"],
  ["gift-box-large", "Grand coffret cadeau", "boxes", "rigid", 300, 220, 100, "Carton rigide 2 mm", "cadeau coffret"],
  ["ecom-mailer", "Boîte postale", "boxes", "mailer", 220, 160, 60, "Carton ondulé E", "e-commerce envoi fefco"],
  ["mailer-small", "Petite boîte postale", "boxes", "mailer", 150, 110, 50, "Carton ondulé E", "e-commerce envoi"],
  ["mailer-large", "Grande boîte postale", "boxes", "mailer", 350, 250, 100, "Carton ondulé B", "e-commerce envoi"],
  ["subscription-box", "Box abonnement", "boxes", "mailer", 280, 200, 90, "Carton ondulé E", "abonnement box"],
  ["shipping-box", "Carton d'expédition", "boxes", "box", 300, 200, 200, "Carton ondulé double", "expédition transport"],
  ["pillow-box", "Boîte berlingot", "boxes", "pillow", 120, 30, 80, "Carton couché 350g", "pillow cadeau"],
  ["display-box", "Présentoir comptoir", "boxes", "tray", 200, 150, 80, "Carton ondulé E", "présentoir display"],
  ["sleeve-box", "Boîte à tiroir", "boxes", "box", 110, 80, 30, "Carton couché 400g", "tiroir sleeve"],
  ["pizza-box", "Boîte à pizza", "food", "mailer", 330, 330, 40, "Carton ondulé", "pizza livraison"],
  ["cake-box", "Boîte pâtisserie", "food", "box", 200, 200, 120, "Carton alimentaire", "gâteau pâtisserie"],
  ["burger-box", "Boîte burger", "food", "mailer", 120, 120, 80, "Carton alimentaire", "burger fast-food clamshell"],
  ["macaron-box", "Boîte macarons", "food", "box", 160, 50, 50, "Carton couché 350g", "macaron confiserie"],
  ["chocolate-box", "Ballotin chocolat", "food", "box", 120, 80, 50, "Carton couché 350g", "chocolat ballotin"],
  ["noodle-box", "Boîte à nouilles", "food", "cup", 90, 90, 100, "Carton alimentaire", "nouilles asiatique take-away"],
  ["fries-box", "Cornet de frites", "food", "cup", 90, 50, 110, "Carton alimentaire", "frites"],
  ["food-tray", "Barquette", "food", "tray", 180, 120, 40, "Carton alimentaire", "barquette plat"],
  ["egg-carton", "Boîte à œufs", "food", "tray", 150, 100, 70, "Carton moulé", "œufs"],
  ["milk-carton", "Brique de lait", "food", "carton", 70, 70, 190, "Carton aseptique", "lait jus brique"],
  ["juice-carton-small", "Brique de jus", "food", "carton", 60, 40, 105, "Carton aseptique", "jus enfant"],
  ["gable-top-1l", "Brique 1 L", "food", "carton", 70, 70, 240, "Carton aseptique", "lait jus 1 litre"],

  // ── Bouteilles & flacons ──
  ["dropper-bottle", "Flacon pipette", "bottles", "dropper", 34, 34, 95, "Verre ambré", "sérum huile compte-gouttes"],
  ["dropper-bottle-clear", "Flacon pipette transparent", "bottles", "dropper", 34, 34, 95, "Verre transparent", "sérum huile"],
  ["pump-bottle", "Flacon pompe", "bottles", "pump", 55, 55, 170, "PET recyclé", "lotion savon liquide"],
  ["pump-bottle-small", "Petit flacon pompe", "bottles", "pump", 40, 40, 120, "PET recyclé", "crème lotion"],
  ["spray-bottle", "Vaporisateur", "bottles", "spray", 45, 45, 150, "Verre transparent", "brume parfum spray"],
  ["perfume-bottle", "Flacon parfum", "bottles", "spray", 60, 35, 110, "Verre épais", "parfum eau de toilette"],
  ["shampoo-bottle", "Bouteille shampoing", "bottles", "bottle", 60, 40, 200, "PEHD", "shampoing gel douche"],
  ["water-bottle", "Bouteille d'eau", "bottles", "bottle", 65, 65, 220, "PET", "eau boisson"],
  ["juice-bottle", "Bouteille de jus", "bottles", "bottle", 60, 60, 190, "Verre transparent", "jus smoothie"],
  ["soda-bottle", "Bouteille soda", "bottles", "bottle", 70, 70, 240, "PET", "soda boisson"],
  ["beer-bottle", "Bouteille de bière", "bottles", "wine", 60, 60, 230, "Verre ambré", "bière brasserie"],
  ["wine-bottle", "Bouteille de vin", "bottles", "wine", 75, 75, 300, "Verre teinté", "vin bordelaise"],
  ["champagne-bottle", "Bouteille champagne", "bottles", "wine", 90, 90, 300, "Verre épais", "champagne crémant"],
  ["spirits-bottle", "Bouteille spiritueux", "bottles", "bottle", 85, 85, 260, "Verre extra-blanc", "gin rhum whisky"],
  ["olive-oil-bottle", "Bouteille d'huile", "bottles", "wine", 60, 60, 280, "Verre teinté", "huile d'olive"],
  ["sauce-bottle", "Bouteille de sauce", "bottles", "bottle", 55, 55, 180, "Verre transparent", "ketchup sauce"],
  ["syrup-bottle", "Bouteille de sirop", "bottles", "bottle", 75, 75, 250, "Verre transparent", "sirop"],
  ["milk-bottle", "Bouteille de lait", "bottles", "bottle", 75, 75, 210, "Verre transparent", "lait"],
  ["sport-bottle", "Gourde", "bottles", "bottle", 70, 70, 240, "Aluminium", "gourde sport"],
  ["supplement-bottle", "Pilulier", "bottles", "jar", 60, 60, 110, "PEHD blanc", "compléments gélules vitamines"],
  ["jug-bottle", "Bidon", "bottles", "jug", 150, 80, 250, "PEHD", "bidon lessive huile moteur"],
  ["detergent-bottle", "Flacon lessive", "bottles", "jug", 110, 70, 260, "PEHD", "lessive détergent"],
  ["nail-polish", "Flacon vernis", "bottles", "bottle", 30, 30, 70, "Verre épais", "vernis ongles"],

  // ── Pots ──
  ["cosmetic-jar", "Pot crème", "jars", "jar", 65, 65, 50, "Verre dépoli", "crème baume"],
  ["cosmetic-jar-tall", "Pot haut", "jars", "jar", 60, 60, 80, "Verre transparent", "gommage"],
  ["honey-jar", "Pot de miel", "jars", "jar", 75, 75, 95, "Verre transparent", "miel confiture"],
  ["jam-jar", "Pot de confiture", "jars", "jar", 70, 70, 85, "Verre transparent", "confiture"],
  ["mason-jar", "Bocal", "jars", "jar", 85, 85, 130, "Verre transparent", "bocal conserve"],
  ["candle-jar", "Pot à bougie", "jars", "jar", 80, 80, 90, "Verre ambré", "bougie parfumée"],
  ["baby-food-jar", "Petit pot bébé", "jars", "jar", 60, 60, 65, "Verre transparent", "bébé"],
  ["protein-tub", "Pot de protéine", "jars", "tub", 120, 120, 170, "PEHD", "protéine whey"],
  ["yogurt-cup", "Pot de yaourt", "jars", "tub", 70, 70, 75, "PP", "yaourt dessert"],
  ["ice-cream-tub", "Pot de glace", "jars", "tub", 100, 100, 90, "Carton alimentaire", "glace crème glacée"],
  ["deli-container", "Boîte traiteur", "jars", "tub", 115, 115, 70, "PP transparent", "traiteur salade"],

  // ── Sachets & pochettes ──
  ["stand-up-pouch", "Doypack", "pouches", "pouch", 140, 80, 210, "Kraft + PE", "doypack zip café"],
  ["stand-up-pouch-small", "Petit doypack", "pouches", "pouch", 100, 60, 150, "Film métallisé", "doypack snack"],
  ["coffee-pouch", "Sachet café valve", "pouches", "pouch", 130, 80, 220, "Kraft + alu", "café grain valve"],
  ["flat-pouch", "Sachet plat", "pouches", "flatpouch", 120, 10, 170, "Film métallisé", "sachet plat"],
  ["chips-bag", "Paquet de chips", "pouches", "flatpouch", 200, 20, 280, "Film métallisé", "chips snack"],
  ["candy-bag", "Sachet bonbons", "pouches", "flatpouch", 150, 15, 200, "Film transparent", "bonbons confiserie"],
  ["sachet-sample", "Échantillon", "pouches", "sachet", 60, 5, 80, "Film alu", "échantillon dosette"],
  ["stick-pack", "Stick", "pouches", "sachet", 25, 5, 110, "Film alu", "stick sucre poudre"],
  ["tea-sachet", "Sachet de thé", "pouches", "sachet", 70, 5, 90, "Papier", "thé infusion"],
  ["face-mask-sachet", "Sachet masque", "pouches", "sachet", 130, 5, 180, "Film alu", "masque tissu"],
  ["pet-food-bag", "Sac croquettes", "pouches", "bag", 250, 100, 400, "Film PE", "croquettes animaux"],
  ["flour-bag", "Sac de farine", "pouches", "bag", 150, 80, 250, "Papier kraft", "farine sucre"],
  ["coffee-bag-gusset", "Sac café soufflet", "pouches", "bag", 110, 70, 250, "Kraft + alu", "café soufflet"],
  ["rice-bag", "Sac de riz", "pouches", "bag", 200, 90, 330, "Film PE", "riz céréales"],

  // ── Sacs ──
  ["paper-shopper", "Sac shopping papier", "bags", "shopper", 250, 110, 320, "Kraft 120g", "sac boutique poignées"],
  ["luxury-shopper", "Sac boutique luxe", "bags", "shopper", 300, 120, 360, "Papier couché 210g", "sac luxe"],
  ["small-gift-bag", "Petit sac cadeau", "bags", "shopper", 150, 80, 200, "Papier couché 170g", "cadeau bijou"],
  ["wine-bag", "Sac bouteille", "bags", "shopper", 110, 110, 380, "Kraft 150g", "vin bouteille"],
  ["bakery-bag", "Sac boulangerie", "bags", "bag", 120, 60, 250, "Papier kraft", "pain viennoiserie"],

  // ── Tubes ──
  ["squeeze-tube", "Tube souple", "tubes_cans", "tube", 35, 35, 150, "PE", "crème dentifrice"],
  ["squeeze-tube-large", "Grand tube", "tubes_cans", "tube", 50, 50, 190, "PE", "gel douche crème"],
  ["lip-balm-tube", "Stick à lèvres", "tubes_cans", "papertube", 18, 18, 70, "Carton", "baume lèvres"],
  ["cylinder-tube", "Tube carton", "tubes_cans", "papertube", 70, 70, 180, "Carton kraft", "tube cylindrique cadeau"],
  ["poster-tube", "Tube poster", "tubes_cans", "papertube", 60, 60, 420, "Carton kraft", "affiche envoi"],
  ["deodorant-stick", "Stick déodorant", "tubes_cans", "papertube", 45, 45, 110, "Carton", "déodorant solide"],

  // ── Canettes ──
  ["beverage-can", "Canette 330 ml", "cans", "can", 66, 66, 115, "Aluminium", "soda bière boisson"],
  ["sleek-can", "Canette slim 250 ml", "cans", "can", 53, 53, 134, "Aluminium", "energy drink"],
  ["tall-can", "Canette 500 ml", "cans", "can", 66, 66, 168, "Aluminium", "bière"],
  ["food-can", "Boîte de conserve", "cans", "tin", 73, 73, 110, "Fer blanc", "conserve"],
  ["aerosol-can", "Aérosol", "cans", "spray", 50, 50, 190, "Aluminium", "spray déodorant"],

  // ── Boîtes métal ──
  ["round-tin", "Boîte ronde métal", "tins", "tin", 90, 90, 60, "Fer blanc", "bonbons baume"],
  ["tea-tin", "Boîte à thé métal", "tins", "tin", 75, 75, 120, "Fer blanc", "thé"],
  ["cookie-tin", "Boîte à biscuits", "tins", "tin", 200, 200, 80, "Fer blanc", "biscuits cadeau"],
  ["mint-tin", "Boîte à pastilles", "tins", "tin", 60, 60, 20, "Fer blanc", "pastilles"],

  // ── Gobelets & tasses ──
  ["paper-cup", "Gobelet carton", "cups", "cup", 80, 80, 95, "Carton PE", "café gobelet"],
  ["coffee-cup-lid", "Gobelet café couvercle", "cups", "cup", 90, 90, 110, "Carton PE", "café à emporter"],
  ["plastic-cup", "Gobelet plastique", "cups", "cup", 95, 95, 125, "PET transparent", "smoothie bubble tea"],
  ["ice-cream-cup", "Coupe glace", "cups", "tub", 90, 90, 60, "Carton PE", "glace sorbet"],
];

export const ALL_CATALOG_SHAPES: PackagingShape[] = ROWS.map(
  ([id, name, category, model, l, w, h, material, keywords]) => ({
    id,
    name,
    category,
    categoryLabel: CATEGORY_LABEL[category] ?? category,
    dimensions: `${l}×${w}×${h} mm`,
    material,
    description: `${name} — ${material}.`,
    lengthMm: l,
    widthMm: w,
    heightMm: h,
    renderIllustration: ILLUSTRATION[model],
    model,
    keywords: keywords.split(" "),
  })
);

/** Accent-insensitive search on name, category, material and keywords. */
export function searchShapes(query: string, category: string): PackagingShape[] {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const terms = norm(query).split(/\s+/).filter(Boolean);
  return ALL_CATALOG_SHAPES.filter((s) => {
    if (category !== "all" && s.category !== category) return false;
    if (!terms.length) return true;
    const hay = norm([s.name, s.categoryLabel, s.material, ...(s.keywords ?? [])].join(" "));
    return terms.every((t) => hay.includes(t));
  });
}
