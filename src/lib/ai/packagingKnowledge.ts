/**
 * Packaging-design knowledge given to the AI designer (Claude / Gemini): the craft of a senior
 * packaging designer, category codes for African markets and labelling rules (Codex STAN 1-1985,
 * adopted in Cameroon through ANOR standard NC 04:2000-20; bilingual French/English labels).
 */
export const PACKAGING_KNOWLEDGE = `
SAVOIR-FAIRE DU PACKAGING DESIGNER

1. Impact en rayon (règle des 3 secondes)
- En rayon, le client décide en 3 à 5 secondes. La face avant porte UN message principal.
- Hiérarchie de la face avant : bloc marque (logo ou monogramme + nom) → nom du produit / variante → bénéfice clé (3 à 7 mots) → quantité nette. Rien d'autre en façade.
- Un seul point focal ; beaucoup d'air autour de la marque. Le nom du produit doit se lire à 1,5 m.
- Différenciation : respecter les codes de la catégorie (pour être compris) et casser UN code (pour être vu).

2. Couleur
- Règle 60-30-10 : 60 % couleur dominante (fond), 30 % secondaire, 10 % accent. 3 couleurs + 1 neutre au maximum.
- Contraste texte/fond ≥ 4,5:1 (WCAG AA). Jamais de texte clair fin sur fond moyen.
- Les couleurs vives et saturées attirent en marché ouvert et en supérette ; les palettes sobres signalent le premium.

3. Typographie
- 2 familles au maximum : une de caractère pour la marque, une très lisible pour les textes.
- Jamais de police script ou décorative pour les ingrédients et les mentions. Taille minimale des mentions : hauteur de x ≥ 1,2 mm (≈ 6 pt), ≥ 0,9 mm sur les très petits emballages.
- Majuscules réservées aux mots courts (marque, catégorie). Interlignage 120-140 %.

4. Codes par catégorie (marchés d'Afrique centrale et de l'Ouest)
- Café (Ouest-Cameroun, arabica, robusta) : bruns torréfiés, crème, cuivre ; kraft et sachet à valve ; typographie à empattements ou artisanale ; origine et altitude mises en avant.
- Jus, bissap, gingembre, folléré, baobab : couleurs du fruit (rouge hibiscus, jaune gingembre), fraîcheur (gouttes, feuilles), bouteille PET ou verre ; "sans conservateur" seulement si c'est vrai.
- Miel (dont miel blanc d'Oku) : ambre, doré, blanc cassé ; pot en verre qui montre le produit ; étiquette naturelle, abeille ou alvéoles en motif discret.
- Épices, poivre de Penja (IGP), piment, njansang : noir, blanc, rouge piment ; kraft à fenêtre ; ton premium pour Penja (dorure, typographie fine), ton énergique pour les sauces pimentées.
- Cacao et chocolat du Cameroun : bruns profonds + accent or, terracotta ou vert cacaoyer ; pourcentage de cacao bien visible.
- Cosmétique naturelle (karité, huile de palme raffinée, coco, savon noir) : ivoire, vert sauge, terre, or doux ; composition INCI ; allégations prudentes.
- Snacks (chips de plantain, arachides, biscuits) : couleurs saturées et joyeuses, typographie ronde, fenêtre ou photo appétissante, format familial ou portion.
- Produits de base (farine de manioc, gari, riz, huile) : lisibilité maximale, grand nom, couleurs franches (vert, jaune, bleu), mentions nutritionnelles claires.
- Thé, tisanes, moringa : vert profond, doré, blanc ; illustration botanique.
- Héritage visuel : les motifs ndop (indigo et blanc, Grassfields du Cameroun), wax, kente ou bogolan peuvent servir d'accent graphique respectueux (bordure, bandeau, fond discret), jamais en caricature ni au détriment de la lisibilité.

5. Mentions obligatoires (Codex STAN 1-1985 ; norme camerounaise NC 04:2000-20, ANOR)
- Étiquetage bilingue français / anglais au Cameroun : dénomination, ingrédients et mentions dans les deux langues.
- Dénomination de vente (nature réelle du produit), liste des ingrédients par ordre décroissant de poids, allergènes mis en évidence (arachide, gluten, lait, œuf, soja, fruits à coque, sésame, poisson, crustacés, sulfites).
- Quantité nette avec unité légale (g, kg, ml, cl, L) dans le même champ visuel que la dénomination.
- Date : "À consommer jusqu'au / Use by" pour les denrées périssables ; "À consommer de préférence avant / Best before" sinon. Conditions de conservation.
- Nom et adresse du fabricant ou du conditionneur, pays d'origine, numéro de lot, mode d'emploi si nécessaire.
- Cosmétiques : liste INCI, précautions d'emploi, durée après ouverture (PAO), fabricant.
- Boissons alcoolisées : titre alcoométrique et message de modération.
- N'invente JAMAIS une certification (bio, halal, IGP…), une allégation santé ou un chiffre nutritionnel : utilise seulement ce que l'utilisateur fournit.

6. Code-barres et impression
- Code-barres EAN-13 au dos ou sous le fond, barres sombres sur fond clair (jamais de rouge), zones blanches autour, pas sur un pli ni sur une soudure.
- Fonds perdus 3 mm, zone de sécurité de 3 à 5 mm des plis et des coupes, traits d'au moins 0,25 pt, noir riche pour les grands aplats.
- Finitions : kraft et papier non couché = naturel ; soft touch = premium ; dorure à chaud = luxe (coûteuse, à réserver au logo) ; vernis sélectif = relief sur la marque.

7. Tendances 2026 (Pentawards, DIELINE Awards) à utiliser avec discernement
- Design de provenance et culturel : l'origine et le savoir-faire local deviennent le cœur de la marque (terroir camerounais, coopératives, motifs kente, ndop, wax traités de façon contemporaine).
- Minimalisme avec une vraie personnalité : peu d'éléments, mais une typographie ou une couleur signature.
- Couleurs « dopamine » dans les catégories challengers (boissons, snacks, enfants) ; retenue et précision pour le nouveau luxe.
- Accessibilité : textes lisibles, contrastes forts, informations essentielles en gros ; pensez aux personnes âgées et aux malvoyants.
- « Display drama » : le pack est pensé pour s'aligner en rayon et former un mur de marque ; une gamme partage la même composition et le même motif, seule la couleur d'accent change par variante (code couleur).
- Durabilité honnête : ne mentionner que ce qui est vrai (recyclable, recharge, papier kraft) ; jamais de greenwashing.
- Repères chiffrés : décision d'achat en 2,5 secondes ; la marque occupe 25 à 30 % de la face avant, le nom du produit 20 à 25 %, le bénéfice 15 à 20 % ; un pack avec un point focal clair vend nettement plus qu'un pack encombré.
- Psychologie des couleurs (repères) : vert = naturel et durable, rouge = appétit et énergie, noir = luxe, blanc et bleu = santé et pureté, jaune = joie et énergie, brun et kraft = artisanal.

8. Rédaction
- Accroche courte orientée bénéfice client, jamais générique ("de qualité" est interdit).
- Au dos : 1 à 2 phrases d'histoire ou d'origine (terroir, coopérative, savoir-faire), puis les mentions.
- Ton adapté à la cible : chaleureux pour l'alimentaire artisanal, précis pour la cosmétique, énergique pour les boissons.
`;
