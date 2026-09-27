/** All landing-page copy, in French and English (Cameroon is bilingual). */
import type { Lang } from "@/lib/i18n/config";
import { PLANS, type PlanId } from "@/lib/billing/plans";

const fcfa = (n: number, lang: Lang) => `${n.toLocaleString(lang === "fr" ? "fr-FR" : "en-US").replace(/ | /g, lang === "fr" ? " " : ",")} FCFA`;

const PLAN_TEXT: Record<PlanId, { fr: { name: string; desc: string; features: string[] }; en: { name: string; desc: string; features: string[] } }> = {
  essentiel: {
    fr: {
      name: "Essentiel",
      desc: "Pour lancer votre premier produit avec un packaging professionnel.",
      features: [
        `${PLANS.essentiel.credits} créations IA par mois`,
        "Les 97 contenants, 84 styles et 58 polices",
        "Mentions obligatoires bilingues FR/EN",
        "PDF prêt à imprimer et aperçu 3D",
        "Projets sauvegardés, lien de partage",
      ],
    },
    en: {
      name: "Essential",
      desc: "To launch your first product with professional packaging.",
      features: [
        `${PLANS.essentiel.credits} AI designs per month`,
        "All 97 containers, 84 styles and 58 fonts",
        "Bilingual FR/EN mandatory label information",
        "Print-ready PDF and 3D preview",
        "Saved projects, share link",
      ],
    },
  },
  pro: {
    fr: {
      name: "Pro",
      desc: "Pour les marques qui lancent et déclinent des produits chaque mois.",
      features: [
        `${PLANS.pro.credits} créations IA par mois`,
        "Tout Essentiel, plus :",
        "Visuels publicitaires HD pour vos réseaux",
        "Modèle 3D et réalité augmentée",
        "Pack complet ZIP pour l'imprimeur",
        "Support prioritaire par WhatsApp",
      ],
    },
    en: {
      name: "Pro",
      desc: "For brands that launch and extend products every month.",
      features: [
        `${PLANS.pro.credits} AI designs per month`,
        "Everything in Essential, plus:",
        "HD ad visuals for your social media",
        "3D model and augmented reality",
        "Complete ZIP pack for your printer",
        "Priority support on WhatsApp",
      ],
    },
  },
  entreprise: {
    fr: {
      name: "Entreprise",
      desc: "Pour les PME, coopératives et agences qui gèrent une gamme complète.",
      features: [
        `${PLANS.entreprise.credits} créations IA par mois`,
        "Tout Pro, plus :",
        "Plusieurs marques et gammes",
        "Accompagnement à l'impression",
        "Facture pour votre comptabilité",
        "Interlocuteur dédié",
      ],
    },
    en: {
      name: "Business",
      desc: "For SMEs, cooperatives and agencies running a full product range.",
      features: [
        `${PLANS.entreprise.credits} AI designs per month`,
        "Everything in Pro, plus:",
        "Several brands and product ranges",
        "Help getting your packs printed",
        "Invoices for your accounting",
        "A dedicated contact person",
      ],
    },
  },
};

export function landingCopy(lang: Lang) {
  const fr = lang === "fr";
  const plans = (Object.keys(PLANS) as PlanId[]).map((id) => ({
    id,
    ...PLAN_TEXT[id][lang],
    price: fcfa(PLANS[id].monthly, lang),
    featured: id === "pro",
  }));

  return {
    skip: fr ? "Aller au contenu" : "Skip to content",
    hero: {
      kicker: fr ? "Designer de packaging propulsé par l'IA" : "AI-powered packaging designer",
      h1a: fr ? "Décrivez votre produit." : "Describe your product.",
      h1b: fr ? "Recevez son packaging prêt à imprimer." : "Get print-ready packaging.",
      lead: fr
        ? "Edify conçoit votre emballage avec l'IA : la forme, le design, les mentions obligatoires, la maquette 3D et le PDF pour l'imprimeur. En quelques minutes, sans graphiste."
        : "Edify designs your packaging with AI: the shape, the artwork, the mandatory label information, the 3D mockup and the PDF for your printer. In minutes, no designer needed.",
      cta: fr ? "Commencez maintenant" : "Start now",
      demo: fr ? "Voir la démo" : "Watch the demo",
      micro: fr ? "Paiement par Mobile Money : MTN MoMo et Orange Money. Dès 3 000 FCFA par mois." : "Pay with Mobile Money: MTN MoMo and Orange Money. From 3,000 FCFA a month.",
      proof: fr ? ["Mentions FR/EN", "PDF 300 dpi", "Maquette 3D"] : ["FR/EN labels", "300 dpi PDF", "3D mockup"],
    },
    stats: fr
      ? [["97", "formes d'emballage"], ["84", "styles visuels"], ["58", "polices libres de droits"], ["300 dpi", "PDF prêt à imprimer"]]
      : [["97", "packaging shapes"], ["84", "visual styles"], ["58", "royalty-free fonts"], ["300 dpi", "print-ready PDF"]],
    video: {
      title: fr ? "Edify en action, en 24 secondes" : "Edify in action, in 24 seconds",
      sub: fr ? "Une phrase, un packaging complet, un fichier prêt pour l'imprimeur et des visuels pour le lancer." : "One sentence, a complete pack, a print-ready file and visuals to launch it.",
    },
    cats: {
      title: fr ? "Un seul outil pour tous vos emballages" : "One tool for all your packaging",
      list: fr
        ? ["Jus et boissons", "Café", "Cacao et chocolat", "Épices", "Miel", "Cosmétique", "Karité", "Snacks", "Huiles", "Savons", "Thé", "Compléments"]
        : ["Juices and drinks", "Coffee", "Cocoa and chocolate", "Spices", "Honey", "Cosmetics", "Shea butter", "Snacks", "Oils", "Soaps", "Tea", "Supplements"],
    },
    live: {
      title: fr ? "Regardez l'IA concevoir un packaging" : "Watch the AI design a pack",
      sub: fr
        ? "Un brief, quelques secondes, et toutes les décisions d'un directeur artistique : contenant, couleurs, typographies, finition."
        : "A brief, a few seconds, and every decision an art director would make: container, colours, typefaces, finish.",
    },
    how: {
      title: fr ? "De la phrase au fichier d'impression" : "From one sentence to a print file",
      sub: fr ? "Le même produit, suivi pas à pas. Chaque image ci-dessous est produite par Edify." : "The same product, step by step. Every image below is produced by Edify.",
    },
    studio: {
      title: fr ? "Un studio pensé pour ceux qui ne sont pas designers" : "A studio built for non-designers",
      sub: fr
        ? "Choisissez un contenant, un style, une police : tout se met à jour en même temps sur le patron à plat et sur la maquette 3D."
        : "Pick a container, a style, a font: the flat die-line and the 3D mockup update together.",
      alt: fr ? "Le studio Edify : catalogue de contenants, patron à plat et aperçu 3D" : "The Edify studio: container catalogue, flat die-line and 3D preview",
      callouts: fr
        ? [["Trois onglets", "Le contenant, le style, puis vos textes et votre logo. Rien de plus."], ["Un grand aperçu", "Le patron à plat en direct, et la vue 3D en un clic."], ["Un seul bouton", "« Télécharger » : PDF d'impression, visuel publicitaire, 3D, lien de partage."]]
        : [["Three tabs", "The container, the style, then your texts and logo. Nothing more."], ["One big preview", "The live flat die-line, and the 3D view in one click."], ["One button", "“Download”: print PDF, ad visual, 3D, share link."]],
    },
    features: {
      title: fr ? "Tout ce qu'un studio de design vous livrerait" : "Everything a design studio would deliver",
      t3d: [fr ? "Maquette 3D réaliste" : "Realistic 3D mockup", fr ? "Tournez votre packaging, changez l'éclairage, regardez-le sous tous les angles, même par-dessous." : "Spin your pack, change the lighting, look at it from every angle, even underneath."],
      print: [fr ? "PDF prêt pour l'imprimeur" : "Printer-ready PDF", fr ? "Fonds perdus de 3 mm, traits de coupe et tracé de découpe vectoriel sur une page séparée." : "3 mm bleed, crop marks and a vector die-line on a separate page."],
      ai: [fr ? "Un directeur artistique IA" : "An AI art director", fr ? "Il respecte les codes de votre catégorie, choisit des couleurs lisibles et rédige les mentions obligatoires, en français et en anglais." : "It follows your category's codes, picks legible colours and writes the mandatory label copy, in French and English."],
      aiSheet: fr
        ? [["Brief", "« Café arabica de l'Ouest, esprit artisanal »"], ["Contenant", "Sachet café à valve, 250 g"], ["Polices", "Fraunces et DM Sans"]]
        : [["Brief", "“West Cameroon arabica, artisanal feel”"], ["Container", "Coffee pouch with valve, 250 g"], ["Fonts", "Fraunces and DM Sans"]],
      colours: fr ? "Couleurs" : "Colours",
      ad: [fr ? "Visuels publicitaires" : "Ad visuals", fr ? "Votre produit mis en scène en studio, aux formats Instagram, WhatsApp, story et bannière." : "Your product staged in a studio, in Instagram, WhatsApp, story and banner formats."],
      numbers: fr ? [["97", "formes d'emballage"], ["84", "styles visuels"], ["58", "polices libres de droits"]] : [["97", "packaging shapes"], ["84", "visual styles"], ["58", "royalty-free fonts"]],
      ar: [fr ? "Réalité augmentée" : "Augmented reality", fr ? "Posez votre packaging à taille réelle sur votre table, depuis votre téléphone, avant de l'imprimer." : "Place your pack at real size on your table, from your phone, before printing it."],
      packAlt: fr ? ["Bouteille en 3D", "Canette mise en scène pour une publicité"] : ["3D bottle", "Can staged for an ad"],
      dielineAlt: fr ? "Tracé de découpe d'une boîte pliante" : "Die-line of a folding box",
      face: fr ? "Face" : "Front",
    },
    gallery: {
      title: fr ? "Une phrase, un packaging" : "One sentence, one pack",
      sub: fr ? "Chaque exemple ci-dessous est rendu par le moteur 3D d'Edify, à partir de la phrase affichée." : "Every example below is rendered by Edify's 3D engine from the sentence shown.",
    },
    mockups: {
      title: fr ? "Des maquettes réalistes, prêtes à publier" : "Realistic mockups, ready to post",
      sub: fr
        ? "Chaque packaging est mis en scène en studio : lumière, ombres, décor. Idéal pour Instagram, WhatsApp, vos fiches produits et vos présentations aux distributeurs."
        : "Every pack is staged in a studio: light, shadows, set. Perfect for Instagram, WhatsApp, product pages and pitches to retailers.",
      items: fr
        ? [["bissap", "Bissap pétillant · scène pop"], ["miel", "Miel blanc d'Oku · scène nature"], ["cafe", "Arabica de l'Ouest · scène nature"], ["baobab", "Sérum au baobab · scène luxe"]]
        : [["bissap", "Sparkling bissap · pop set"], ["miel", "Oku white honey · nature set"], ["cafe", "West Cameroon arabica · nature set"], ["baobab", "Baobab serum · luxury set"]],
    },
    compare: {
      title: fr ? "Le résultat d'une agence, sans le délai ni le budget" : "Agency results, without the wait or the budget",
      head: fr ? ["Avec une agence", "Avec Edify"] : ["With an agency", "With Edify"],
      aria: fr ? "Comparaison agence et Edify" : "Agency vs Edify comparison",
      rows: fr
        ? [["Délai", "Plusieurs semaines", "Quelques minutes"], ["Budget", "100 000 à 500 000 FCFA", "Dès 3 000 FCFA par mois"], ["Point de départ", "Brief écrit, réunions", "Une phrase"], ["Mentions légales", "À vérifier vous-même", "Rédigées en FR et EN"], ["Livrables", "En fin de projet", "PDF, 3D et visuels à tout moment"]]
        : [["Lead time", "Several weeks", "A few minutes"], ["Budget", "100,000 to 500,000 FCFA", "From 3,000 FCFA a month"], ["Starting point", "Written brief, meetings", "One sentence"], ["Label information", "Check it yourself", "Written in FR and EN"], ["Deliverables", "At the end of the project", "PDF, 3D and visuals anytime"]],
    },
    formats: {
      title: fr ? "Tous les fichiers dont vous avez besoin" : "Every file you need",
      sub: fr ? "Un design, et tous les formats pour l'imprimeur, votre boutique, vos réseaux et vos présentations." : "One design, and every format for your printer, your shop, your social media and your pitches.",
      list: fr
        ? [["PDF", "Fichier d'impression", "Fonds perdus 3 mm, traits de coupe, tracé de découpe vectoriel."], ["PNG", "Visuels publicitaires", "Formats Instagram, WhatsApp, story et bannière, en haute définition."], ["GLB", "Modèle 3D", "Pour votre site, Android et les logiciels 3D, à taille réelle."], ["USDZ", "Réalité augmentée", "Posez le packaging sur votre table depuis un iPhone."], ["ZIP", "Projet complet", "PDF, aperçu 3D, modèle et fiche technique en un clic."], ["URL", "Lien de partage", "Montrez le design à un client ou à votre imprimeur."]]
        : [["PDF", "Print file", "3 mm bleed, crop marks, vector die-line."], ["PNG", "Ad visuals", "Instagram, WhatsApp, story and banner formats, in high definition."], ["GLB", "3D model", "For your website, Android and 3D software, at real size."], ["USDZ", "Augmented reality", "Place the pack on your table from an iPhone."], ["ZIP", "Complete project", "PDF, 3D preview, model and spec sheet in one click."], ["URL", "Share link", "Show the design to a client or your printer."]],
    },
    pricing: {
      title: fr ? "Un prix pensé pour les entrepreneurs africains" : "Pricing built for African entrepreneurs",
      sub: fr
        ? "Payez par Mobile Money, sans carte bancaire et sans prélèvement automatique : vous rechargez votre abonnement quand vous voulez."
        : "Pay with Mobile Money, no bank card and no automatic debit: top up your plan whenever you like.",
      perMonth: fr ? "/ mois" : "/ month",
      badge: fr ? "Le plus choisi" : "Most popular",
      choose: fr ? "Choisir ce plan" : "Choose this plan",
      plans,
      note: fr
        ? "Économisez 10 % en payant 3 mois et 20 % en payant 12 mois. Paiement sécurisé par MTN MoMo et Orange Money."
        : "Save 10% by paying for 3 months and 20% for 12 months. Secure payment with MTN MoMo and Orange Money.",
      momo: fr ? "Paiement Mobile Money" : "Mobile Money payment",
    },
    trust: {
      title: fr ? "Vos créations restent les vôtres" : "Your designs stay yours",
      list: fr
        ? [["Propriété", "Les packagings que vous créez vous appartiennent. Imprimez-les et vendez-les librement."], ["Paiement local", "MTN MoMo et Orange Money, via la passerelle sécurisée SasPay. Aucune carte requise."], ["Connexion sécurisée", "E-mail et mot de passe, ou votre compte Google. Vos données ne sont jamais revendues."], ["Polices libres de droits", "Les 58 polices proposées sont utilisables commercialement, sans frais."]]
        : [["Ownership", "The packs you create are yours. Print them and sell them freely."], ["Local payment", "MTN MoMo and Orange Money, through the secure SasPay gateway. No card needed."], ["Secure sign-in", "Email and password, or your Google account. Your data is never sold."], ["Royalty-free fonts", "All 58 fonts can be used commercially at no cost."]],
    },
    who: {
      title: fr ? "Pensé pour ceux qui lancent des produits" : "Built for people who launch products",
      list: fr
        ? [["Transformateurs et coopératives", "qui veulent un emballage professionnel pour vendre en supermarché et à l'export."], ["Marques de cosmétiques naturels", "karité, huiles, savons : des packs qui inspirent confiance."], ["PME et commerçants", "qui déclinent de nouvelles références rapidement."], ["Agences et graphistes", "qui présentent des pistes créatives en quelques minutes."]]
        : [["Food processors and cooperatives", "who need professional packaging to sell in supermarkets and abroad."], ["Natural cosmetics brands", "shea, oils, soaps: packs that inspire trust."], ["SMEs and retailers", "who launch new product lines quickly."], ["Agencies and designers", "who pitch creative routes in minutes."]],
    },
    faq: {
      title: fr ? "Questions fréquentes" : "Frequently asked questions",
      list: fr
        ? [
            ["Faut-il savoir dessiner ou utiliser un logiciel de design ?", "Non. Vous répondez à quelques questions sur votre produit, l'IA choisit le contenant, les couleurs, les polices et rédige les textes. Vous pouvez ensuite tout modifier en quelques clics."],
            ["Comment payer ?", "Par Mobile Money (MTN MoMo ou Orange Money), via la passerelle sécurisée SasPay. Il n'y a pas de prélèvement automatique : vous payez 1, 3 ou 12 mois à l'avance et vous rechargez quand vous voulez."],
            ["Les mentions obligatoires sont-elles incluses ?", "Oui. Edify prévoit la dénomination, les ingrédients, la quantité nette, les dates, le lot, le fabricant et le mode d'emploi, en français et en anglais comme l'exige le marché camerounais. Faites toujours valider votre étiquette finale par votre imprimeur ou l'autorité compétente (ANOR)."],
            ["Le fichier est-il vraiment prêt pour l'imprimeur ?", "Edify génère un PDF avec fonds perdus de 3 mm, traits de coupe et tracé de découpe sur une page séparée. Votre imprimeur réalise la conversion CMJN et vous envoie un BAT à valider avant production."],
            ["Puis-je utiliser mon propre logo et mon code-barres ?", "Oui. Importez votre logo (PNG, SVG ou JPG) et saisissez votre code EAN-13 : il est dessiné au bon format sur le dos du packaging."],
            ["Qui possède les designs créés ?", "Vous. Les packagings que vous créez avec Edify vous appartiennent et peuvent être imprimés et commercialisés."],
          ]
        : [
            ["Do I need to draw or use design software?", "No. You answer a few questions about your product, the AI picks the container, colours and fonts and writes the copy. You can then change anything in a few clicks."],
            ["How do I pay?", "With Mobile Money (MTN MoMo or Orange Money), through the secure SasPay gateway. There is no automatic debit: you pay 1, 3 or 12 months upfront and top up whenever you like."],
            ["Is the mandatory label information included?", "Yes. Edify covers the product name, ingredients, net quantity, dates, batch, manufacturer and directions, in French and English as the Cameroonian market requires. Always have your final label checked by your printer or the relevant authority (ANOR)."],
            ["Is the file really ready for the printer?", "Edify produces a PDF with 3 mm bleed, crop marks and a die-line on a separate page. Your printer converts it to CMYK and sends you a proof to approve before production."],
            ["Can I use my own logo and barcode?", "Yes. Upload your logo (PNG, SVG or JPG) and type your EAN-13 code: it is drawn at the right size on the back of the pack."],
            ["Who owns the designs?", "You do. The packs you create with Edify are yours and can be printed and sold."],
          ],
    },
    final: {
      title: fr ? "Votre prochain packaging commence ici." : "Your next pack starts here.",
      sub: fr ? "Répondez à quelques questions, l'IA s'occupe du reste." : "Answer a few questions, the AI does the rest.",
    },
    clusterLabel: fr ? "Exemples de packagings conçus avec Edify" : "Packaging examples designed with Edify",
    packAlt: (brand: string) => (fr ? `Packaging ${brand} généré avec Edify` : `${brand} packaging generated with Edify`),
    jsonLd: fr
      ? "Edify conçoit votre packaging avec l'IA : forme, design, mentions obligatoires, maquette 3D et PDF prêt pour l'impression, en quelques minutes."
      : "Edify designs your packaging with AI: shape, artwork, mandatory label information, 3D mockup and print-ready PDF, in minutes.",
  };
}

export type LandingCopy = ReturnType<typeof landingCopy>;
