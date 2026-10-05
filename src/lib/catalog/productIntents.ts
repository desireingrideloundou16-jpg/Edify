/**
 * Known products and the pack each is usually sold in (moved from ai/designSpec.ts in phase 3C, unchanged):
 * shared by the local designer (localDesign) and the packaging resolver (catalog/packagingResolver.ts).
 * Client- and server-safe data.
 */
export interface ProductIntent {
  words: string[];
  shape: string;
  style: string;
  product: string;
  volume: string;
  details: string;
}

export const PRODUCT_INTENTS: ProductIntent[] = [
  { words: ["bissap", "foleré", "folere", "hibiscus"], shape: "juice-bottle-30cl", style: "juicy-fruit", product: "Jus de bissap", volume: "30 cl", details: "Boisson à base de fleurs d'hibiscus. À conserver au frais, bien agiter avant de servir." },
  { words: ["gingembre", "ginger"], shape: "juice-bottle-30cl", style: "juicy-fruit", product: "Jus de gingembre", volume: "30 cl", details: "Boisson au gingembre frais. À conserver au frais, bien agiter avant de servir." },
  { words: ["huile de palme", "huile rouge"], shape: "oil-bottle-1l", style: "african-wax", product: "Huile de palme", volume: "1 L", details: "Huile de palme rouge non raffinée. À conserver à l'abri de la lumière et de la chaleur." },
  { words: ["huile d'arachide"], shape: "oil-bottle-1l", style: "farm-fresh", product: "Huile d'arachide", volume: "1 L", details: "Huile d'arachide pressée. À conserver à l'abri de la lumière." },
  { words: ["pate d'arachide", "arachide", "cacahuete"], shape: "peanut-butter-jar", style: "farm-fresh", product: "Pâte d'arachide", volume: "350 g", details: "Arachides grillées et broyées. Contient : ARACHIDES." },
  { words: ["gari", "tapioca", "manioc", "couscous"], shape: "gari-bag", style: "kraft-stamp", product: "Gari blanc", volume: "1 kg", details: "Semoule de manioc séchée. À conserver au sec, bien refermer après ouverture." },
  { words: ["plantain"], shape: "plantain-chips-bag", style: "color-block", product: "Chips de plantain", volume: "100 g", details: "Plantain, huile végétale, sel. À conserver au sec." },
  { words: ["karite", "shea"], shape: "shea-butter-jar", style: "botanical-natural", product: "Beurre de karité pur", volume: "150 g", details: "Butyrospermum Parkii Butter. Appliquer sur peau et cheveux." },
  { words: ["savon noir"], shape: "soap-wrap", style: "kraft-stamp", product: "Savon noir", volume: "150 g", details: "Savon traditionnel à base d'huiles végétales et de cendres de plantain." },
  { words: ["piment"], shape: "hot-sauce-bottle", style: "african-wax", product: "Piment à l'huile", volume: "150 ml", details: "Piments, huile végétale, ail, sel. Bien refermer après usage." },
  { words: ["poivre", "penja"], shape: "spice-jar", style: "kraft-stamp", product: "Poivre blanc de Penja", volume: "50 g", details: "Poivre blanc de Penja en grains. À conserver au sec, à l'abri de la lumière." },
  { words: ["tomate"], shape: "tomato-paste-tin", style: "color-block", product: "Double concentré de tomate", volume: "70 g", details: "Tomates, sel. Après ouverture, conserver au frais et consommer rapidement." },
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
  { words: ["creme glacee", "glace", "sorbet", "ice cream"], shape: "ice-cream-tub", style: "candy-pop", product: "Crème glacée", volume: "500 ml", details: "Lait, crème, sucre, vanille. Contient : lait." },
  { words: ["lait", "milk"], shape: "milk-carton", style: "dairy-fresh", product: "Lait entier", volume: "1 L", details: "Lait entier pasteurisé. À conserver au frais après ouverture." },
  { words: ["croquette", "chien", "chat", "animal"], shape: "pet-food-bag", style: "pet-friendly", product: "Croquettes premium", volume: "2 kg", details: "Viande de poulet déshydratée, riz, légumes, minéraux." },
  { words: ["pizza"], shape: "pizza-box", style: "italian-deli", product: "Pizza artisanale", volume: "Ø 33 cm", details: "Pâte au levain, sauce tomate, mozzarella." },
  { words: ["coffret", "cadeau", "gift", "bijou", "montre"], shape: "luxury-rigid-box", style: "luxury-obsidian-gold", product: "Coffret prestige", volume: "Édition limitée", details: "Coffret rigide recouvert, dorure à chaud." },
  { words: ["e-commerce", "colis", "envoi", "abonnement"], shape: "subscription-box", style: "startup-clean", product: "Box découverte", volume: "Édition du mois", details: "Merci pour votre commande ! Emballage 100 % recyclable." },
];
