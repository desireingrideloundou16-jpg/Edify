/**
 * Answer suggestions for the "Commencez maintenant" steps. The AI route (/api/suggest) uses
 * Gemini when available; this local table is the instant fallback and needs no network.
 * Server-safe and client-safe: no imports with side effects.
 */
import type { Lang } from "@/lib/i18n/config";
import type { StartBrief, SuggestStep } from "@/lib/design/brief";

type Cat = {
  id: string;
  words: string[];
  packs: { fr: string[]; en: string[] };
  ingredients: { fr: string[]; en: string[] };
  usage: { fr: string[]; en: string[] };
  quantity: string[];
  shelfMonths: number[];
  extra: { fr: string[]; en: string[] };
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const COMMON_EXTRA = {
  fr: ["Fabriqué au Cameroun", "À conserver dans un endroit frais et sec", "Numéro de lot : voir l'emballage", "Contact : +237 6XX XX XX XX"],
  en: ["Made in Cameroon", "Store in a cool, dry place", "Batch number: see packaging", "Contact: +237 6XX XX XX XX"],
};

const CATS: Cat[] = [
  {
    id: "coffee",
    words: ["cafe", "coffee", "arabica", "robusta", "espresso"],
    packs: { fr: ["Sachet café à valve 250 g", "Sachet kraft à fond plat 500 g", "Boîte métal 250 g", "Sachet doypack 1 kg"], en: ["Coffee pouch with valve 250 g", "Flat-bottom kraft bag 500 g", "Metal tin 250 g", "Stand-up pouch 1 kg"] },
    ingredients: { fr: ["100 % café arabica torréfié", "Café arabica et robusta torréfiés", "Café moulu 100 % arabica de l'Ouest Cameroun"], en: ["100% roasted arabica coffee", "Roasted arabica and robusta coffee", "Ground coffee, 100% West Cameroon arabica"] },
    usage: { fr: ["1 cuillère à soupe (7 g) pour 15 cl d'eau chaude à 92 °C", "Refermer le sachet après ouverture", "Idéal en cafetière italienne ou filtre"], en: ["1 tablespoon (7 g) per 150 ml of water at 92 °C", "Reseal the bag after opening", "Ideal for moka pot or filter"] },
    quantity: ["250 g", "500 g", "1 kg", "100 g"],
    shelfMonths: [12, 18],
    extra: { fr: ["Torréfié au Cameroun", "Moulu fin, spécial filtre", "Agriculture biologique"], en: ["Roasted in Cameroon", "Fine grind, for filter", "Organic farming"] },
  },
  {
    id: "juice",
    words: ["jus", "juice", "bissap", "gingembre", "ginger", "boisson", "drink", "folere", "baobab", "ananas", "pineapple", "limonade", "soda", "sirop", "syrup"],
    packs: { fr: ["Bouteille PET 50 cl", "Bouteille verre 33 cl", "Canette 33 cl", "Brique 1 L"], en: ["PET bottle 50 cl", "Glass bottle 33 cl", "Can 33 cl", "Carton 1 L"] },
    ingredients: { fr: ["Eau, fleurs d'hibiscus (bissap) 12 %, sucre de canne, arôme naturel de menthe", "Eau, gingembre frais 15 %, jus de citron, sucre", "Pur jus d'ananas, sans sucre ajouté"], en: ["Water, hibiscus flowers (bissap) 12%, cane sugar, natural mint flavour", "Water, fresh ginger 15%, lemon juice, sugar", "100% pineapple juice, no added sugar"] },
    usage: { fr: ["Bien agiter avant de servir", "Servir très frais", "À conserver au réfrigérateur après ouverture et à consommer sous 3 jours"], en: ["Shake well before serving", "Serve chilled", "Refrigerate after opening and consume within 3 days"] },
    quantity: ["33 cl", "50 cl", "1 L", "1,5 L"],
    shelfMonths: [6, 9, 12],
    extra: { fr: ["Sans conservateur", "100 % naturel", "Pasteurisé"], en: ["No preservatives", "100% natural", "Pasteurised"] },
  },
  {
    id: "honey",
    words: ["miel", "honey"],
    packs: { fr: ["Pot en verre 500 g", "Pot en verre 250 g", "Flacon doseur 350 g"], en: ["Glass jar 500 g", "Glass jar 250 g", "Squeeze bottle 350 g"] },
    ingredients: { fr: ["100 % miel pur", "Miel blanc d'Oku", "Miel de fleurs sauvages"], en: ["100% pure honey", "White honey from Oku", "Wildflower honey"] },
    usage: { fr: ["Utiliser une cuillère propre et sèche", "Peut cristalliser naturellement : réchauffer au bain-marie", "Déconseillé aux enfants de moins d'un an"], en: ["Use a clean, dry spoon", "May crystallise naturally: warm gently in a water bath", "Not suitable for children under one year"] },
    quantity: ["250 g", "500 g", "1 kg"],
    shelfMonths: [24, 36],
    extra: { fr: ["Récolté au Cameroun", "Non chauffé", "Produit de coopérative"], en: ["Harvested in Cameroon", "Raw, unheated", "Cooperative product"] },
  },
  {
    id: "spice",
    words: ["poivre", "pepper", "penja", "epice", "spice", "piment", "chili", "sauce", "curry", "njansang", "djansang", "sel"],
    packs: { fr: ["Sachet kraft à fenêtre 100 g", "Pot en verre 50 g", "Bouteille sauce 150 ml", "Boîte métal 100 g"], en: ["Kraft pouch with window 100 g", "Glass jar 50 g", "Sauce bottle 150 ml", "Metal tin 100 g"] },
    ingredients: { fr: ["Poivre blanc de Penja (IGP)", "Piment, ail, oignon, huile végétale, sel", "Mélange d'épices : poivre, njansang, rondelles, clou de girofle"], en: ["White Penja pepper (PGI)", "Chilli, garlic, onion, vegetable oil, salt", "Spice blend: pepper, njansang, country onion, clove"] },
    usage: { fr: ["Moudre au dernier moment pour plus d'arômes", "Quelques gouttes suffisent", "Refermer hermétiquement après usage"], en: ["Grind just before use for more aroma", "A few drops are enough", "Close tightly after use"] },
    quantity: ["50 g", "100 g", "150 ml", "250 g"],
    shelfMonths: [12, 24],
    extra: { fr: ["Indication géographique protégée Penja", "Très piquant", "Sans exhausteur de goût"], en: ["Protected geographical indication: Penja", "Very hot", "No flavour enhancer"] },
  },
  {
    id: "cosmetic",
    words: ["karite", "shea", "savon", "soap", "huile", "oil", "creme", "cream", "beurre", "butter", "lotion", "serum", "shampo", "cheveux", "hair", "cosmet", "parfum"],
    packs: { fr: ["Pot cosmétique 200 ml", "Flacon pompe 250 ml", "Boîte carton pour savon 100 g", "Flacon pipette 30 ml"], en: ["Cosmetic jar 200 ml", "Pump bottle 250 ml", "Soap carton box 100 g", "Dropper bottle 30 ml"] },
    ingredients: { fr: ["Butyrospermum Parkii (Shea) Butter", "Aqua, Elaeis Guineensis Oil, Glycerin, Parfum", "Sodium Palmate, Sodium Cocoate, Aqua, Butyrospermum Parkii Butter"], en: ["Butyrospermum Parkii (Shea) Butter", "Aqua, Elaeis Guineensis Oil, Glycerin, Parfum", "Sodium Palmate, Sodium Cocoate, Aqua, Butyrospermum Parkii Butter"] },
    usage: { fr: ["Appliquer sur peau propre en massant doucement", "Usage externe uniquement", "Éviter le contact avec les yeux"], en: ["Apply to clean skin with a gentle massage", "For external use only", "Avoid contact with eyes"] },
    quantity: ["100 g", "200 ml", "250 ml", "500 ml"],
    shelfMonths: [12, 24],
    extra: { fr: ["Karité pur non raffiné", "Pour peaux sèches", "Non testé sur les animaux"], en: ["Pure unrefined shea", "For dry skin", "Not tested on animals"] },
  },
  {
    id: "choco",
    words: ["chocolat", "chocolate", "cacao", "cocoa"],
    packs: { fr: ["Étui tablette 100 g", "Boîte coffret 200 g", "Sachet doypack 250 g (poudre)"], en: ["Chocolate bar sleeve 100 g", "Gift box 200 g", "Stand-up pouch 250 g (powder)"] },
    ingredients: { fr: ["Pâte de cacao, sucre, beurre de cacao. Cacao : 70 % minimum", "Cacao en poudre non sucré 100 %", "Sucre, beurre de cacao, lait entier en poudre, pâte de cacao"], en: ["Cocoa mass, sugar, cocoa butter. Cocoa: 70% minimum", "100% unsweetened cocoa powder", "Sugar, cocoa butter, whole milk powder, cocoa mass"] },
    usage: { fr: ["Conserver entre 16 et 18 °C, à l'abri de la lumière", "2 cuillères dans un bol de lait chaud"], en: ["Store between 16 and 18 °C, away from light", "2 spoonfuls in a cup of hot milk"] },
    quantity: ["100 g", "200 g", "250 g"],
    shelfMonths: [12, 18],
    extra: { fr: ["Cacao du Cameroun", "Peut contenir des traces de lait et de fruits à coque"], en: ["Cameroonian cocoa", "May contain traces of milk and nuts"] },
  },
  {
    id: "snack",
    words: ["chips", "plantain", "biscuit", "cookie", "gateau", "snack", "arachide", "peanut", "cacahuete", "beignet", "crackers", "noix"],
    packs: { fr: ["Sachet chips 80 g", "Boîte carton 200 g", "Sachet doypack refermable 150 g", "Boîte métal cadeau 300 g"], en: ["Crisp bag 80 g", "Carton box 200 g", "Resealable stand-up pouch 150 g", "Gift tin 300 g"] },
    ingredients: { fr: ["Banane plantain, huile végétale, sel", "Arachides grillées, sel", "Farine de blé, sucre, beurre, œufs, sésame"], en: ["Plantain, vegetable oil, salt", "Roasted peanuts, salt", "Wheat flour, sugar, butter, eggs, sesame"] },
    usage: { fr: ["À consommer rapidement après ouverture", "Refermer le sachet pour garder le croustillant"], en: ["Eat soon after opening", "Reseal the bag to keep it crunchy"] },
    quantity: ["80 g", "150 g", "200 g", "300 g"],
    shelfMonths: [6, 9],
    extra: { fr: ["Contient : arachide, gluten", "Sans colorant", "Cuit au four"], en: ["Contains: peanuts, gluten", "No colouring", "Oven-baked"] },
  },
  {
    id: "tea",
    words: ["the ", "tea", "tisane", "infusion", "citronnelle", "moringa", "kinkeliba"],
    packs: { fr: ["Boîte de 20 sachets", "Sachet kraft 100 g (vrac)", "Boîte métal 80 g"], en: ["Box of 20 tea bags", "Kraft pouch 100 g (loose)", "Metal tin 80 g"] },
    ingredients: { fr: ["Thé noir des hauts plateaux", "Feuilles de moringa séchées 100 %", "Citronnelle, gingembre, menthe"], en: ["Highland black tea", "100% dried moringa leaves", "Lemongrass, ginger, mint"] },
    usage: { fr: ["Infuser 3 à 5 minutes dans une eau frémissante", "1 cuillère à café par tasse"], en: ["Steep 3 to 5 minutes in simmering water", "1 teaspoon per cup"] },
    quantity: ["20 sachets — 40 g", "100 g", "80 g"],
    shelfMonths: [18, 24],
    extra: { fr: ["Cultivé au Cameroun", "Sans théine (infusion)"], en: ["Grown in Cameroon", "Caffeine-free (herbal)"] },
  },
  {
    id: "staple",
    words: ["farine", "flour", "riz", "rice", "manioc", "cassava", "gari", "semoule", "mais", "corn", "haricot", "bean", "huile de palme", "palm"],
    packs: { fr: ["Sac en papier kraft 1 kg", "Sachet plastique imprimé 5 kg", "Bouteille PET 1 L (huile)"], en: ["Kraft paper bag 1 kg", "Printed plastic bag 5 kg", "PET bottle 1 L (oil)"] },
    ingredients: { fr: ["Farine de manioc 100 %", "Riz long grain", "Huile de palme rouge non raffinée"], en: ["100% cassava flour", "Long-grain rice", "Unrefined red palm oil"] },
    usage: { fr: ["Verser progressivement dans l'eau bouillante en remuant", "Rincer avant cuisson"], en: ["Pour gradually into boiling water while stirring", "Rinse before cooking"] },
    quantity: ["1 kg", "5 kg", "25 kg", "1 L"],
    shelfMonths: [12, 18],
    extra: { fr: ["Produit local", "Enrichi en vitamine A"], en: ["Local product", "Fortified with vitamin A"] },
  },
];

const GENERIC: Cat = {
  id: "generic",
  words: [],
  packs: {
    fr: ["Jus de bissap en bouteille 50 cl", "Café moulu en sachet 250 g", "Miel en pot verre 500 g", "Poivre de Penja en sachet kraft 100 g", "Beurre de karité en pot 200 ml", "Chips de plantain en sachet 80 g", "Chocolat en tablette 100 g", "Savon naturel en boîte carton"],
    en: ["Bissap juice in a 50 cl bottle", "Ground coffee in a 250 g bag", "Honey in a 500 g glass jar", "Penja pepper in a 100 g kraft pouch", "Shea butter in a 200 ml jar", "Plantain chips in an 80 g bag", "Chocolate bar 100 g", "Natural soap in a carton box"],
  },
  ingredients: { fr: [], en: [] },
  usage: { fr: ["Conserver dans un endroit frais et sec", "Refermer après ouverture"], en: ["Store in a cool, dry place", "Reseal after opening"] },
  quantity: ["100 g", "250 g", "500 g", "1 kg", "50 cl", "1 L"],
  shelfMonths: [6, 12, 24],
  extra: { fr: [], en: [] },
};

export function detectCategory(text: string): Cat {
  const t = ` ${norm(text)} `;
  return CATS.find((c) => c.words.some((w) => t.includes(w))) ?? GENERIC;
}

/** Local calendar date (the visitor's day, not UTC). */
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addMonths = (d: Date, m: number) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
};

export function localSuggestions(step: SuggestStep, brief: Partial<StartBrief>, siteLang: Lang, today = new Date()): string[] {
  // Local tables exist in French and English; other languages get English (the AI route answers in the right language).
  const lang = siteLang === "fr" ? "fr" : "en";
  const cat = detectCategory(`${brief.packaging ?? ""} ${brief.brand ?? ""}`);
  switch (step) {
    case "packaging":
      return (brief.packaging?.trim() && cat.id !== "generic" ? cat.packs[lang] : GENERIC.packs[lang]).slice(0, 8);
    case "ingredients":
      return cat.ingredients[lang];
    case "usage":
      return cat.usage[lang];
    case "quantity":
      return cat.quantity;
    case "production":
      return [iso(today), iso(addMonths(today, -1))];
    case "expiry": {
      const from = brief.production && /^\d{4}-\d{2}-\d{2}$/.test(brief.production) ? new Date(brief.production + "T12:00:00") : today;
      return cat.shelfMonths.map((m) => iso(addMonths(from, m)));
    }
    case "extra":
      return [...cat.extra[lang], ...COMMON_EXTRA[lang]].slice(0, 6);
  }
}
