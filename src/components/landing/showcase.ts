import type { PackagingDesign } from "@/lib/artwork/draw";

/** Example packs rendered live by the Edify 3D engine on the landing page (fictional brands). */
export interface ShowcaseItem {
  shapeId: string;
  prompt: string;
  promptEn: string;
  design: Omit<PackagingDesign, "logo">;
}

export const SHOWCASE: ShowcaseItem[] = [
  {
    shapeId: "beverage-can",
    prompt: "Un bissap pétillant en canette, très coloré, pour les 20-30 ans",
    promptEn: "A sparkling bissap soda in a can, bold and colourful, for 20–30 year olds",
    design: {
      brandName: "SOLAR", productName: "Bissap pétillant", tagline: "Hibiscus & gingembre", volume: "33 cl",
      details: "Eau gazéifiée, infusion de fleurs d'hibiscus 12 %, gingembre, sucre de canne.", palette: ["#FFE500", "#141414", "#E6007E", "#00A0E3"],
      headingFont: "Bagel Fat One", bodyFont: "DM Sans", finishing: "Vernis brillant",
    },
  },
  {
    shapeId: "coffee-pouch",
    prompt: "Café arabica de l'Ouest Cameroun en grains, marque Terra, esprit artisanal",
    promptEn: "Arabica coffee beans from West Cameroon, Terra brand, artisanal feel",
    design: {
      brandName: "TERRA", productName: "Arabica de l'Ouest", tagline: "Hauts plateaux du Cameroun", volume: "250 g",
      details: "100 % arabica, agriculture biologique.", palette: ["#1E1A17", "#F1E6D6", "#C47A3D", "#3A312A"],
      headingFont: "Fraunces", bodyFont: "DM Sans", finishing: "Soft touch",
    },
  },
  {
    shapeId: "dropper-bottle",
    prompt: "Sérum éclat au baobab, flacon pipette, look clean beauty",
    promptEn: "Baobab glow serum in a dropper bottle, clean beauty look",
    design: {
      brandName: "LUMINA", productName: "Sérum Baobab", tagline: "Éclat et hydratation", volume: "30 ml",
      details: "Aqua, Adansonia Digitata Seed Oil, Glycerin.", palette: ["#F3EBE3", "#3D3029", "#C9A58D", "#E7D9CC"],
      headingFont: "Cormorant Garamond", bodyFont: "Manrope", finishing: "Soft touch",
    },
  },
  {
    shapeId: "tea-box",
    prompt: "Thé noir haut de gamme des hauts plateaux, élégant et sobre",
    promptEn: "Premium highland black tea, elegant and understated",
    design: {
      brandName: "NOCTA", productName: "Thé noir d'altitude", tagline: "Récolte des hauts plateaux", volume: "20 sachets",
      details: "Thé noir, feuilles entières.", palette: ["#0F3B2E", "#F3E9CF", "#D4AF37", "#165443"],
      headingFont: "Cinzel", bodyFont: "Lato", finishing: "Dorure or",
    },
  },
  {
    shapeId: "honey-jar",
    prompt: "Miel blanc d'Oku en pot, étiquette vintage",
    promptEn: "White honey from Mount Oku in a jar, vintage label",
    design: {
      brandName: "Ruchers d'Oku", productName: "Miel blanc", tagline: "Récolté au Mont Oku", volume: "250 g",
      details: "Miel blanc d'Oku, 100 % naturel.", palette: ["#E9DCC0", "#3A2A18", "#6B4FA0", "#D4C29C"],
      headingFont: "Playfair Display", bodyFont: "EB Garamond", finishing: "Papier vergé",
    },
  },
  {
    shapeId: "chips-bag",
    prompt: "Chips de plantain pour enfants, sachet fun et joyeux",
    promptEn: "Plantain chips for kids, a fun and cheerful bag",
    design: {
      brandName: "CROUNCH", productName: "Chips de plantain", tagline: "Croustillantes et dorées", volume: "100 g",
      details: "Banane plantain, huile de palme raffinée, sel.", palette: ["#00A0E3", "#FFFFFF", "#FFE500", "#E6007E"],
      headingFont: "Fredoka", bodyFont: "Nunito", finishing: "Vernis brillant",
    },
  },
  {
    shapeId: "wine-bottle",
    prompt: "Sirop de gingembre artisanal en bouteille, étiquette classique et raffinée",
    promptEn: "Artisanal ginger syrup in a glass bottle, classic refined label",
    design: {
      brandName: "Maison Lune", productName: "Sirop de gingembre", tagline: "Pressé à froid", volume: "75 cl",
      details: "Gingembre frais, sucre de canne, citron vert.", palette: ["#F6F1E7", "#2A1D12", "#8C1C13", "#C9B58C"],
      headingFont: "Italiana", bodyFont: "Lato", finishing: "Papier vergé",
    },
  },
  {
    shapeId: "squeeze-tube",
    prompt: "Crème mains réparatrice, tube souple, univers pharmacie",
    promptEn: "Repairing hand cream, soft tube, pharmacy look",
    design: {
      brandName: "DERMA+", productName: "Crème mains", tagline: "Réparation intense", volume: "75 ml",
      details: "Aqua, Glycerin, Urea.", palette: ["#F4F8FC", "#0D3B66", "#2F80C3", "#DCE9F5"],
      headingFont: "Manrope", bodyFont: "Inter", finishing: "Vernis mat",
    },
  },
  {
    shapeId: "perfume-bottle",
    prompt: "Eau de parfum florale, flacon luxueux rose et or",
    promptEn: "Floral eau de parfum, luxurious pink and gold bottle",
    design: {
      brandName: "Solène", productName: "Eau de parfum", tagline: "Pivoine et musc blanc", volume: "50 ml",
      details: "Alcohol denat., Parfum, Aqua.", palette: ["#F6E3DC", "#4A2C2A", "#B76E79", "#ECC9BF"],
      headingFont: "Parisienne", bodyFont: "Montserrat", finishing: "Dorure or rose",
    },
  },
  {
    shapeId: "protein-tub",
    prompt: "Poudre de moringa pour sportifs, pot énergique noir et vert fluo",
    promptEn: "Moringa powder for athletes, energetic black and neon green tub",
    design: {
      brandName: "VOLT", productName: "Moringa énergie", tagline: "Superaliment 100 % naturel", volume: "500 g",
      details: "Feuilles de moringa séchées et moulues.", palette: ["#141414", "#F5F5F5", "#C6FF00", "#2A2A2A"],
      headingFont: "Anton", bodyFont: "Barlow", finishing: "Soft touch",
    },
  },
  {
    shapeId: "candle-jar",
    prompt: "Bougie parfumée figue et cèdre, ambiance cocooning",
    promptEn: "Fig and cedar scented candle, cosy mood",
    design: {
      brandName: "ALBA", productName: "Figue & cèdre", tagline: "Cire végétale", volume: "180 g",
      details: "Cire de soja, mèche coton, parfum.", palette: ["#EFE4D2", "#4B3B2A", "#B89468", "#E0D0B6"],
      headingFont: "Marcellus", bodyFont: "Work Sans", finishing: "Papier non couché",
    },
  },
  {
    shapeId: "cookie-tin",
    prompt: "Biscuits au sésame, boîte métal cadeau rétro",
    promptEn: "Sesame biscuits in a retro gift tin",
    design: {
      brandName: "Maison Ebène", productName: "Biscuits au sésame", tagline: "Recette de grand-mère", volume: "300 g",
      details: "Farine de blé, sésame 12 %, beurre, sucre, œufs.", palette: ["#1B3A6B", "#F4ECDC", "#C8102E", "#E6D8BD"],
      headingFont: "Abril Fatface", bodyFont: "Lora", finishing: "Vernis brillant",
    },
  },
  {
    shapeId: "milk-carton",
    prompt: "Jus d'ananas pur, brique fraîche et simple",
    promptEn: "Pure pineapple juice, a fresh and simple carton",
    design: {
      brandName: "OKKO", productName: "Jus d'ananas", tagline: "Ananas pain de sucre", volume: "1 L",
      details: "Pur jus d'ananas, sans sucre ajouté.", palette: ["#FFF3C4", "#1D3B1F", "#F2A900", "#FFE27A"],
      headingFont: "Righteous", bodyFont: "Nunito", finishing: "Vernis mat",
    },
  },
  {
    shapeId: "shampoo-bottle",
    prompt: "Shampoing doux au karité, bouteille verte naturelle",
    promptEn: "Gentle shea butter shampoo, natural green bottle",
    design: {
      brandName: "VERDANT", productName: "Shampoing doux", tagline: "Karité et romarin", volume: "250 ml",
      details: "Aqua, Coco-Glucoside, Butyrospermum Parkii Butter.", palette: ["#E8EFE4", "#1F3D2B", "#6B8F5E", "#C9D8C0"],
      headingFont: "Josefin Sans", bodyFont: "Josefin Sans", finishing: "Papier recyclé",
    },
  },
  {
    shapeId: "sleek-can",
    prompt: "Boisson énergisante gaming, canette slim néon",
    promptEn: "Gaming energy drink, slim neon can",
    design: {
      brandName: "NEØN", productName: "Energy drink", tagline: "Focus sans crash", volume: "250 ml",
      details: "Eau gazéifiée, caféine, taurine.", palette: ["#120B26", "#FFFFFF", "#FF2BD6", "#20E3FF"],
      headingFont: "Bungee", bodyFont: "Space Grotesk", finishing: "Encres fluo",
    },
  },
  {
    shapeId: "luxury-rigid-box",
    prompt: "Coffret montre de luxe, noir profond et or",
    promptEn: "Luxury watch box, deep black and gold",
    design: {
      brandName: "AURELLE", productName: "Chronographe", tagline: "Édition limitée", volume: "N° 001",
      details: "Coffret rigide.", palette: ["#0F172A", "#F3E9CF", "#D4AF37", "#1E293B"],
      headingFont: "Cinzel", bodyFont: "Montserrat", finishing: "Dorure or",
    },
  },
  {
    shapeId: "sauce-bottle",
    prompt: "Sauce piquante artisanale au poivre de Penja, étiquette vibrante",
    promptEn: "Artisanal hot sauce with Penja pepper, vibrant label",
    design: {
      brandName: "PIMENTO", productName: "Sauce piment", tagline: "Au poivre de Penja", volume: "150 ml",
      details: "Piment, poivre blanc de Penja, ail, vinaigre, sel.", palette: ["#1B1B1B", "#FFF3E0", "#E4411E", "#FFB400"],
      headingFont: "Shrikhand", bodyFont: "DM Sans", finishing: "Vernis brillant",
    },
  },
];
