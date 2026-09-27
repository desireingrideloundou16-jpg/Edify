import type { PackagingDesign } from "@/lib/artwork/draw";

/** Example packs rendered live by the Edify 3D engine on the landing page (fictional brands). */
export interface ShowcaseItem {
  shapeId: string;
  prompt: string;
  design: Omit<PackagingDesign, "logo">;
}

export const SHOWCASE: ShowcaseItem[] = [
  {
    shapeId: "beverage-can",
    prompt: "Une limonade pétillante au yuzu, très colorée, pour les 20-30 ans",
    design: {
      brandName: "SOLAR", productName: "Yuzu pétillant", tagline: "Zéro sucre ajouté", volume: "33 cl",
      details: "Eau gazéifiée, jus de yuzu 8 %, arômes naturels.", palette: ["#FFE500", "#141414", "#E6007E", "#00A0E3"],
      headingFont: "Bagel Fat One", bodyFont: "DM Sans", finishing: "Vernis brillant",
    },
  },
  {
    shapeId: "coffee-pouch",
    prompt: "Café de spécialité bio en grains, marque Terra, esprit artisanal",
    design: {
      brandName: "TERRA", productName: "Éthiopie Yirgacheffe", tagline: "Torréfié à la main", volume: "250 g",
      details: "100 % arabica, agriculture biologique.", palette: ["#1E1A17", "#F1E6D6", "#C47A3D", "#3A312A"],
      headingFont: "Fraunces", bodyFont: "DM Sans", finishing: "Soft touch",
    },
  },
  {
    shapeId: "dropper-bottle",
    prompt: "Sérum vitamine C, flacon pipette, look clean beauty",
    design: {
      brandName: "LUMINA", productName: "Sérum Éclat", tagline: "Vitamine C pure 15 %", volume: "30 ml",
      details: "Aqua, Glycerin, Ascorbic Acid.", palette: ["#F3EBE3", "#3D3029", "#C9A58D", "#E7D9CC"],
      headingFont: "Cormorant Garamond", bodyFont: "Manrope", finishing: "Soft touch",
    },
  },
  {
    shapeId: "tea-box",
    prompt: "Thé vert japonais haut de gamme, élégant et sobre",
    design: {
      brandName: "NOCTA", productName: "Sencha impérial", tagline: "Récolte de printemps", volume: "20 sachets",
      details: "Thé vert du Japon.", palette: ["#0F3B2E", "#F3E9CF", "#D4AF37", "#165443"],
      headingFont: "Cinzel", bodyFont: "Lato", finishing: "Dorure or",
    },
  },
  {
    shapeId: "honey-jar",
    prompt: "Miel de lavande de Provence, étiquette vintage",
    design: {
      brandName: "Ruchers d'Azur", productName: "Miel de lavande", tagline: "Récolté en Provence", volume: "250 g",
      details: "Miel de lavande.", palette: ["#E9DCC0", "#3A2A18", "#6B4FA0", "#D4C29C"],
      headingFont: "Playfair Display", bodyFont: "EB Garamond", finishing: "Papier vergé",
    },
  },
  {
    shapeId: "chips-bag",
    prompt: "Chips de légumes pour enfants, sachet fun et joyeux",
    design: {
      brandName: "CROUNCH", productName: "Chips de légumes", tagline: "Betterave, carotte, panais", volume: "100 g",
      details: "Légumes, huile de tournesol, sel.", palette: ["#00A0E3", "#FFFFFF", "#FFE500", "#E6007E"],
      headingFont: "Fredoka", bodyFont: "Nunito", finishing: "Vernis brillant",
    },
  },
  {
    shapeId: "wine-bottle",
    prompt: "Vin rouge de Bordeaux, étiquette classique et raffinée",
    design: {
      brandName: "Maison Lune", productName: "Grand Vin", tagline: "Bordeaux 2022", volume: "75 cl",
      details: "Contient des sulfites.", palette: ["#F6F1E7", "#2A1D12", "#8C1C13", "#C9B58C"],
      headingFont: "Italiana", bodyFont: "Lato", finishing: "Papier vergé",
    },
  },
  {
    shapeId: "squeeze-tube",
    prompt: "Crème mains réparatrice, tube souple, univers pharmacie",
    design: {
      brandName: "DERMA+", productName: "Crème mains", tagline: "Réparation intense", volume: "75 ml",
      details: "Aqua, Glycerin, Urea.", palette: ["#F4F8FC", "#0D3B66", "#2F80C3", "#DCE9F5"],
      headingFont: "Manrope", bodyFont: "Inter", finishing: "Vernis mat",
    },
  },
  {
    shapeId: "perfume-bottle",
    prompt: "Eau de parfum florale, flacon luxueux rose et or",
    design: {
      brandName: "Solène", productName: "Eau de parfum", tagline: "Pivoine et musc blanc", volume: "50 ml",
      details: "Alcohol denat., Parfum, Aqua.", palette: ["#F6E3DC", "#4A2C2A", "#B76E79", "#ECC9BF"],
      headingFont: "Parisienne", bodyFont: "Montserrat", finishing: "Dorure or rose",
    },
  },
  {
    shapeId: "protein-tub",
    prompt: "Protéine vegan pour sportifs, pot énergique noir et vert fluo",
    design: {
      brandName: "VOLT", productName: "Protéine vegan", tagline: "25 g de protéines par dose", volume: "1 kg",
      details: "Protéine de pois, protéine de riz, cacao.", palette: ["#141414", "#F5F5F5", "#C6FF00", "#2A2A2A"],
      headingFont: "Anton", bodyFont: "Barlow", finishing: "Soft touch",
    },
  },
  {
    shapeId: "candle-jar",
    prompt: "Bougie parfumée figue et cèdre, ambiance cocooning",
    design: {
      brandName: "ALBA", productName: "Figue & cèdre", tagline: "Cire végétale", volume: "180 g",
      details: "Cire de soja, mèche coton, parfum.", palette: ["#EFE4D2", "#4B3B2A", "#B89468", "#E0D0B6"],
      headingFont: "Marcellus", bodyFont: "Work Sans", finishing: "Papier non couché",
    },
  },
  {
    shapeId: "cookie-tin",
    prompt: "Biscuits au beurre de Bretagne, boîte métal cadeau rétro",
    design: {
      brandName: "Maison Kerel", productName: "Galettes pur beurre", tagline: "Recette de 1932", volume: "300 g",
      details: "Farine de blé, beurre, sucre, œufs.", palette: ["#1B3A6B", "#F4ECDC", "#C8102E", "#E6D8BD"],
      headingFont: "Abril Fatface", bodyFont: "Lora", finishing: "Vernis brillant",
    },
  },
  {
    shapeId: "milk-carton",
    prompt: "Lait d'avoine bio, brique fraîche et simple",
    design: {
      brandName: "OKKO", productName: "Boisson avoine", tagline: "Riche en calcium", volume: "1 L",
      details: "Eau, avoine 10 %, huile de tournesol.", palette: ["#F3F9FF", "#12356B", "#5AA9E6", "#DCECFB"],
      headingFont: "Righteous", bodyFont: "Nunito", finishing: "Vernis mat",
    },
  },
  {
    shapeId: "shampoo-bottle",
    prompt: "Shampoing solide et doux au romarin, bouteille verte naturelle",
    design: {
      brandName: "VERDANT", productName: "Shampoing doux", tagline: "Romarin et ortie", volume: "250 ml",
      details: "Aqua, Coco-Glucoside, Rosmarinus Officinalis.", palette: ["#E8EFE4", "#1F3D2B", "#6B8F5E", "#C9D8C0"],
      headingFont: "Josefin Sans", bodyFont: "Josefin Sans", finishing: "Papier recyclé",
    },
  },
  {
    shapeId: "sleek-can",
    prompt: "Boisson énergisante gaming, canette slim néon",
    design: {
      brandName: "NEØN", productName: "Energy drink", tagline: "Focus sans crash", volume: "250 ml",
      details: "Eau gazéifiée, caféine, taurine.", palette: ["#120B26", "#FFFFFF", "#FF2BD6", "#20E3FF"],
      headingFont: "Bungee", bodyFont: "Space Grotesk", finishing: "Encres fluo",
    },
  },
  {
    shapeId: "luxury-rigid-box",
    prompt: "Coffret montre de luxe, noir profond et or",
    design: {
      brandName: "AURELLE", productName: "Chronographe", tagline: "Édition limitée", volume: "N° 001",
      details: "Coffret rigide.", palette: ["#0F172A", "#F3E9CF", "#D4AF37", "#1E293B"],
      headingFont: "Cinzel", bodyFont: "Montserrat", finishing: "Dorure or",
    },
  },
  {
    shapeId: "sauce-bottle",
    prompt: "Sauce piquante artisanale au piment fumé, étiquette mexicaine vibrante",
    design: {
      brandName: "FUEGO", productName: "Salsa piquante", tagline: "Piment chipotle fumé", volume: "150 ml",
      details: "Piments, vinaigre, ail, sel.", palette: ["#1B1B1B", "#FFF3E0", "#E4411E", "#FFB400"],
      headingFont: "Shrikhand", bodyFont: "DM Sans", finishing: "Vernis brillant",
    },
  },
];
