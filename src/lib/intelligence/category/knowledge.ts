/**
 * PI-3 — the initial category knowledge base. Priority: hair care, spices, local beverages; then a few
 * representative categories to prove the architecture (skin care, fragrance, food, supplements,
 * household) plus the shared labelling knowledge of prepackaged food and drinks. Not an encyclopaedia.
 *
 * Basis: almost everything is Edify's internal editorial knowledge ("internal", medium at most) or an
 * inference ("inferred", low). Two real standards are cited with their reference and scope (Codex
 * CXS 1-1985, UN GHS); no market study, no research, no expert is claimed because none was consulted.
 * Conventions are tendencies of the category, never recommendations: no colour is assigned to a
 * category, no cultural pattern to a local product.
 */
import type { ElementRole } from "@/lib/structure";
import type { CategoryKnowledge, CategoryTension, KnowledgeItem, TensionPole } from "./types";
import { CODEX_PREPACKAGED_LABELLING, PI3_INFERRED_SOURCE, PI3_INTERNAL_SOURCE, UN_GHS } from "./vocabulary";

type ItemInput = Omit<KnowledgeItem, "id" | "basis" | "confidence" | "provenance"> & Partial<Pick<KnowledgeItem, "basis" | "confidence" | "provenance">>;
/** An internal note unless stated otherwise (the honest default). */
const item = (id: string, x: ItemInput): KnowledgeItem => ({
  id, basis: "internal", confidence: x.basis === "inferred" ? "low" : "medium", provenance: x.basis === "inferred" ? PI3_INFERRED_SOURCE : PI3_INTERNAL_SOURCE, ...x,
});
const tension = (id: string, poles: [TensionPole, TensionPole], statement: string, guidance: string): CategoryTension =>
  ({ id, poles, statement, guidance, basis: "internal", confidence: "medium", provenance: PI3_INTERNAL_SOURCE });

// ─── Shared notes ────────────────────────────────────────────────────────────

const GENERIC_NATURAL_CLICHE = (id: string) => item(id, {
  kind: "pitfall", strength: "avoid", statement: "Signifier « naturel » par le seul réflexe vert + feuille : le produit devient interchangeable et la promesse n'est pas prouvée.",
  rationale: "Le naturel se démontre par l'ingrédient réel, la matière, l'origine ; une couleur n'est pas une preuve.",
});
const NO_UNPROVIDED_CERTIFICATION = (id: string) => item(id, {
  kind: "pitfall", strength: "avoid", statement: "Afficher une certification, un label ou une indication géographique (bio, IGP, halal…) que la marque n'a pas fournie.",
  rationale: "Une certification se prouve ; l'inventer expose la marque et trompe l'acheteur.",
});

const STRUCTURED_BACK = (id: string, roles: readonly ElementRole[]) => item(id, {
  kind: "informationPriority", strength: "strongConvention", statement: "Face avant : identité et produit ; dos : informations complètes, hiérarchisées, lisibles.",
  rationale: "Séparer ce qui fait choisir de ce qui informe garde la face avant lisible sans rien retirer.", relates: { roles },
});

// ─── Prepackaged food & drinks (labelling) ──────────────────────────────────

const CODEX_SCOPE = "Norme internationale de référence pour les denrées préemballées ; son adoption et le détail des exigences dépendent du pays visé (à vérifier pour chaque marché). Ce n'est pas un avis juridique.";
const PREPACKAGED: CategoryKnowledge = {
  id: "prepackagedFood",
  label: { fr: "Denrées et boissons préemballées (étiquetage)", en: "Prepackaged food and drinks (labelling)" },
  definition: "Connaissance d'étiquetage commune aux aliments et boissons vendus préemballés.",
  appliesTo: { categories: ["food", "beverages"] },
  typicalProducts: [], usages: [], audience: [],
  items: [
    item("prepackaged.codex.mandatory", {
      kind: "informationPriority", strength: "strongConvention", basis: "regulatory", provenance: CODEX_PREPACKAGED_LABELLING, confidence: "medium", scope: CODEX_SCOPE,
      statement: "La norme Codex d'étiquetage prévoit notamment : la dénomination du produit, la liste des ingrédients (par ordre décroissant de poids), la quantité nette (unités métriques), le nom et l'adresse du fabricant ou du conditionneur, le pays d'origine lorsque son omission pourrait tromper, l'identification du lot, le marquage de la date et les conditions de conservation, et le mode d'emploi si nécessaire.",
      rationale: "Ces informations appartiennent au pack : le design doit leur réserver une place lisible, pas les supprimer pour l'épure.",
      relates: { roles: ["productName", "bodyText", "netContent", "regulatory", "barcode"] },
    }),
  ],
  tensions: [],
  dataNeeds: [
    { fact: "liste des ingrédients", why: "mention prévue par la norme Codex (selon le pays)", role: "bodyText" },
    { fact: "quantité nette", why: "mention prévue par la norme Codex (selon le pays)", role: "netContent" },
    { fact: "nom et adresse du fabricant ou du conditionneur", why: "mention prévue par la norme Codex (selon le pays)", role: "regulatory" },
    { fact: "date et conditions de conservation", why: "mention prévue par la norme Codex (selon le pays)", role: "regulatory" },
  ],
};

// ─── 1. Hair care ────────────────────────────────────────────────────────────

const HAIRCARE: CategoryKnowledge = {
  id: "haircare",
  label: { fr: "Cosmétique capillaire", en: "Hair care" },
  definition: "Produits de soin et de lavage des cheveux : shampoings, après-shampoings, crèmes, beurres et huiles capillaires.",
  appliesTo: { categories: ["cosmetics"], subcategories: ["hairCare", "shampoo", "conditioner", "hairCream", "hairOil"] },
  typicalProducts: ["shampoing", "après-shampoing", "crème capillaire", "beurre capillaire", "huile capillaire", "défrisant"],
  usages: ["lavage", "soin", "coiffage", "protection"],
  audience: ["beautyConsumers", "massMarket", "professional"],
  informationOrder: ["brand", "productName", "subtitle", "claim", "image", "netContent", "bodyText", "regulatory", "barcode"],
  items: [
    item("haircare.conv.variantByNeed", {
      kind: "convention", strength: "strongConvention",
      statement: "La variante se définit souvent par le type de cheveux ou le besoin (secs, crépus, bouclés, défrisés, cuir chevelu…) et se lit juste après la marque.",
      rationale: "L'acheteur cherche d'abord « pour mes cheveux » : la variante est un critère de choix, pas un détail.", relates: { roles: ["subtitle"] },
    }),
    item("haircare.conv.rangeSystem", {
      kind: "convention", strength: "strongConvention",
      statement: "Les gammes partagent une même composition ; un code d'accent (couleur, bandeau, pictogramme) distingue les variantes.",
      rationale: "En rayon, une gamme se lit comme un ensemble ; la variante doit se repérer sans relire le nom.", relates: { composition: ["stacked"] },
    }),
    item("haircare.conv.heroIngredient", {
      kind: "convention", strength: "weakConvention",
      statement: "Un ingrédient vedette (karité, coco, ricin, avocat…) est fréquemment mis en avant comme bénéfice.",
      rationale: "L'ingrédient sert de raccourci de bénéfice — à condition d'être réellement dans la formule.", relates: { imagery: ["ingredient", "botanical"] },
      yieldsTo: ["minimalist", "clinical"],
    }),
    item("haircare.trust.inci", {
      kind: "trustSignal", strength: "strongConvention", statement: "Composition complète (liste INCI) et mode d'emploi clair au dos.",
      rationale: "La transparence de formule est un signal de confiance attendu en cosmétique ; l'obligation exacte dépend du marché.", relates: { roles: ["bodyText"] },
    }),
    item("haircare.trust.oneBenefit", {
      kind: "trustSignal", strength: "weakConvention", statement: "Un bénéfice principal crédible, hiérarchisé, plutôt qu'une liste de promesses.",
      rationale: "Une promesse claire est plus crédible qu'une accumulation.", relates: { roles: ["claim"] },
    }),
    STRUCTURED_BACK("haircare.info.frontBack", ["brand", "productName", "subtitle", "bodyText"]),
    item("haircare.diff.ingredientStory", {
      kind: "opportunity", strength: "opportunity",
      statement: "Raconter l'ingrédient par la matière, la typographie ou une illustration précise et propre à la marque plutôt que par une illustration générique.",
      rationale: "Sortir du cliché tout en gardant la compréhension de la catégorie.", relates: { illustration: ["lineart", "engraving"] },
    }),
    item("haircare.diff.modernPremium", {
      kind: "opportunity", strength: "opportunity",
      statement: "Un langage premium moderne (espace, typographie maîtrisée, peu de pastilles) se distingue dans un rayon souvent saturé.",
      rationale: "Inférence : la différence vient du contraste avec la densité habituelle du rayon.", basis: "inferred",
    }),
    item("haircare.diff.lookalike", {
      kind: "differentiation", strength: "avoid", statement: "Reprendre les codes couleur par variante des marques leaders au point de leur ressembler.",
      rationale: "Une ressemblance trop forte brouille la marque et peut prêter à confusion.",
    }),
    item("haircare.pit.results", {
      kind: "pitfall", strength: "avoid", statement: "Avant/après ou promesses de résultat (pousse, réparation « 100 % ») non fournies par la marque.",
      rationale: "Une promesse visuelle excessive n'est pas prouvée et peut tromper.",
    }),
    item("haircare.pit.badgeOverload", {
      kind: "pitfall", strength: "avoid", statement: "Accumulation de pastilles « sans sulfate, sans paraben… » qui écrase la hiérarchie.",
      rationale: "Trop de mentions concurrentes : plus rien ne se lit.", relates: { decorative: ["badges"] }, check: { facet: "layout", values: ["pop"] },
    }),
    GENERIC_NATURAL_CLICHE("haircare.pit.greenCliche"),
    item("haircare.pit.fakeScience", {
      kind: "pitfall", strength: "avoid", statement: "Références scientifiques de façade (molécules, pourcentages, « testé cliniquement ») sans source.",
      rationale: "Une preuve inventée détruit la confiance qu'elle prétend créer.",
    }),
    item("haircare.pit.foodConfusion", {
      kind: "pitfall", strength: "avoid", statement: "Présenter une huile ou un beurre capillaire avec les codes d'une huile ou d'un produit alimentaire.",
      rationale: "La confusion d'usage est un risque réel pour des produits proches (huiles, beurres).", subcategories: ["hairOil", "hairCream"],
    }),
    item("haircare.shelf.rangeRead", {
      kind: "shelfBehavior", strength: "strongConvention", statement: "Nom de gamme et variante lisibles en vignette ; un bloc d'accent par variante aide la reconnaissance.",
      rationale: "La vignette e-commerce et le rayon beauté se lisent à distance.", relates: { roles: ["brand", "subtitle"] },
    }),
  ],
  tensions: [
    tension("haircare.t.naturalClinical", ["natural", "clinical"], "Naturel (ingrédients, tradition capillaire) contre clinique (efficacité, technicité).", "Un ingrédient réel montré avec précision et une information nette tiennent les deux."),
    tension("haircare.t.accessiblePremium", ["accessible", "premium"], "Grand public contre premium dans un rayon très concurrentiel.", "Retenue et matière pour le premium, sans sacrifier la lisibilité de la variante."),
    tension("haircare.t.localGlobal", ["local", "global"], "Savoir-faire et ingrédients locaux contre codes des marques internationales.", "L'origine racontée précisément, dans un langage graphique contemporain."),
  ],
  dataNeeds: [
    { fact: "type de cheveux ou besoin visé", why: "c'est la variante que l'acheteur cherche", role: "subtitle" },
    { fact: "ingrédient vedette réellement présent", why: "évite d'inventer un bénéfice", role: "claim" },
    { fact: "composition (INCI) et mode d'emploi", why: "signal de confiance attendu", role: "bodyText" },
  ],
};

// ─── 2. Spices ───────────────────────────────────────────────────────────────

const SPICES: CategoryKnowledge = {
  id: "spices",
  label: { fr: "Épices", en: "Spices" },
  definition: "Épices et aromates entiers ou moulus, en petits formats (pots, sachets, boîtes).",
  appliesTo: { categories: ["food"], subcategories: ["spices"] },
  typicalProducts: ["poivre", "piment", "curcuma", "njansang", "mbongo", "cannelle", "mélanges d'épices"],
  usages: ["cuisine quotidienne", "cuisine professionnelle", "cadeau"],
  audience: ["middleMarket", "culturallyFocused", "professional"],
  informationOrder: ["productName", "subtitle", "brand", "image", "netContent", "bodyText", "regulatory", "barcode"],
  items: [
    item("spices.conv.nameAndOrigin", {
      kind: "convention", strength: "strongConvention", statement: "Le nom de l'épice et sa forme (entière, moulue) dominent ; l'origine précise est une valeur forte quand elle est réelle.",
      rationale: "On choisit une épice par son nom et sa provenance.", relates: { roles: ["productName", "subtitle"] },
    }),
    item("spices.conv.productVisible", {
      kind: "convention", strength: "weakConvention", statement: "Le produit (couleur, texture, grain) est souvent rendu visible : fenêtre, contenant transparent ou photo du produit.",
      rationale: "La texture de l'épice est une preuve de qualité.", relates: { imagery: ["productObject", "texture"], composition: ["productLed"] },
    }),
    item("spices.conv.artisanalCodes", {
      kind: "convention", strength: "weakConvention", statement: "Les codes artisanaux (papier kraft, tampon, gravure) sont fréquents dans la catégorie.",
      rationale: "Ils signalent le savoir-faire — ce sont des habitudes, pas une obligation.", relates: { illustration: ["engraving", "linocut"], positioning: ["artisanal"] },
      yieldsTo: ["minimalist", "modern", "luxury"], check: { facet: "artStyle", values: ["engraving", "linocut"] },
    }),
    item("spices.conv.shortFront", {
      kind: "convention", strength: "strongConvention", statement: "Sur les petits formats, la face avant porte très peu de texte : nom, origine, marque, quantité.",
      rationale: "La surface est réduite : chaque mot en plus coûte de la lisibilité.", relates: { density: "minimal" },
    }),
    item("spices.trust.origin", {
      kind: "trustSignal", strength: "strongConvention", statement: "Origine précise (région, terroir, producteur) — uniquement si elle est fournie.",
      rationale: "L'origine est la preuve principale de qualité d'une épice.", relates: { roles: ["subtitle", "badge"] },
    }),
    item("spices.trust.usage", {
      kind: "trustSignal", strength: "weakConvention", statement: "Suggestions d'utilisation ou d'accords au dos.",
      rationale: "Aide à l'achat d'une épice moins connue.", relates: { roles: ["bodyText"] },
    }),
    STRUCTURED_BACK("spices.info.frontBack", ["productName", "subtitle", "bodyText"]),
    item("spices.opp.preciseOrigin", {
      kind: "opportunity", strength: "opportunity", statement: "Raconter l'origine avec précision (lieu, producteur, récolte) plutôt qu'avec des motifs « exotiques » génériques.",
      rationale: "La précision distingue ; le décor générique banalise.",
    }),
    item("spices.opp.collection", {
      kind: "opportunity", strength: "opportunity", statement: "Pour une collection, un système de gamme (même structure, une couleur d'accent par épice) crée un mur de marque en rayon.",
      rationale: "Inférence : de petits formats alignés se lisent comme un ensemble.", basis: "inferred",
    }),
    item("spices.diff.genericKraft", {
      kind: "differentiation", strength: "avoid", statement: "Kraft + tampon par défaut, sans idée propre : la marque se confond avec toutes les autres épiceries fines.",
      rationale: "Le code de catégorie aide à comprendre, pas à se distinguer.",
    }),
    item("spices.pit.exoticism", {
      kind: "pitfall", strength: "avoid", statement: "Exotisme caricatural : motifs ou typographies « ethniques » plaqués pour signifier l'origine.",
      rationale: "Le cliché remplace l'information réelle sur l'origine et peut être perçu comme irrespectueux.", check: { facet: "motif", values: ["wax"] }, unlessSourcedCulture: true,
    }),
    item("spices.pit.automaticHeat", {
      kind: "pitfall", strength: "avoid", statement: "Assigner automatiquement une couleur (le rouge du « piquant ») à toute épice.",
      rationale: "Une couleur de catégorie n'est pas une règle ; elle doit servir la marque et le produit réel.",
    }),
    NO_UNPROVIDED_CERTIFICATION("spices.pit.certification"),
    item("spices.pit.overload", {
      kind: "pitfall", strength: "avoid", statement: "Surcharger un petit format (textes, pastilles, illustrations multiples).",
      rationale: "Sur une petite face, la surcharge rend tout illisible.", relates: { decorative: ["badges", "ornaments"] },
    }),
    item("spices.shelf.smallFace", {
      kind: "shelfBehavior", strength: "strongConvention", statement: "Le nom doit rester lisible sur la face visible en étagère ou en présentoir, souvent réduite.",
      rationale: "Les petits pots sont vus de face, serrés, parfois de dessus.", relates: { roles: ["productName"] },
    }),
  ],
  tensions: [
    tension("spices.t.traditionalModern", ["traditional", "modern"], "Codes artisanaux traditionnels contre épicerie moderne.", "Garder un signe de savoir-faire (origine, tampon) dans une composition contemporaine."),
    tension("spices.t.artisanalMass", ["artisanal", "massMarket"], "Épicerie fine artisanale contre grande distribution.", "La lisibilité du nom et du prix prime en grande distribution ; le récit d'origine reste possible au dos."),
    tension("spices.t.localGlobal", ["local", "global"], "Produit d'origine locale contre vente à l'export.", "Nom local conservé, avec une dénomination compréhensible par l'acheteur visé."),
  ],
  dataNeeds: [
    { fact: "origine précise (si connue)", why: "principale preuve de qualité ; jamais inventée", role: "subtitle" },
    { fact: "forme (entière, moulue, mélange)", why: "critère de choix immédiat", role: "subtitle" },
    { fact: "certification réellement obtenue (le cas échéant)", why: "aucune certification n'est affichée sans preuve", role: "badge" },
  ],
};

// ─── 3. Local beverages ──────────────────────────────────────────────────────

const LOCAL_BEVERAGES: CategoryKnowledge = {
  id: "localBeverages",
  label: { fr: "Boissons locales", en: "Local beverages" },
  definition: "Boissons de fleurs, racines ou fruits locaux (bissap, gingembre, foléré, baobab…) produites et vendues en Afrique de l'Ouest et centrale.",
  appliesTo: { categories: ["beverages"], subcategories: ["juice", "softDrink", "syrup", "concentrate"], regions: ["WestAfrica", "CentralAfrica"] },
  typicalProducts: ["jus de bissap", "jus de gingembre", "jus de baobab", "boissons de fleurs et de racines"],
  usages: ["rafraîchissement", "accompagnement des repas", "fêtes"],
  audience: ["massMarket", "family", "culturallyFocused"],
  informationOrder: ["productName", "brand", "image", "claim", "netContent", "bodyText", "regulatory", "barcode"],
  items: [
    item("localbev.conv.flavourName", {
      kind: "convention", strength: "strongConvention", statement: "Le nom de la saveur (bissap, gingembre…) est l'identifiant principal, souvent plus que la marque.",
      rationale: "On choisit d'abord la boisson, puis le producteur.", relates: { roles: ["productName"] },
    }),
    item("localbev.conv.colourVisible", {
      kind: "convention", strength: "strongConvention", statement: "La couleur réelle de la boisson est souvent visible (contenant transparent ou zone dégagée sur l'étiquette).",
      rationale: "La couleur du liquide est une preuve de produit et un repère de saveur.", relates: { imagery: ["productObject"], composition: ["productLed"] },
      check: { facet: "layout", values: ["window"] },
    }),
    item("localbev.conv.vividColours", {
      kind: "convention", strength: "weakConvention", statement: "Les couleurs vives sont fréquentes en point de vente de proximité.",
      rationale: "Tendance observée de la catégorie, pas une obligation : une marque peut choisir la retenue.", relates: { saturation: "vivid" }, yieldsTo: ["minimalist", "luxury", "premium"],
    }),
    item("localbev.conv.storage", {
      kind: "convention", strength: "strongConvention", statement: "Les conditions de conservation (au frais, après ouverture) et la date sont essentielles pour une boisson fraîche.",
      rationale: "Une boisson peu ou pas pasteurisée se dégrade vite : l'information protège l'acheteur.", relates: { roles: ["regulatory", "bodyText"] },
    }),
    item("localbev.trust.realIngredients", {
      kind: "trustSignal", strength: "strongConvention", statement: "Ingrédients courts et réels ; « sans conservateur » ou « naturel » seulement s'ils sont vrais et fournis.",
      rationale: "Une allégation non vérifiée détruit la confiance.", relates: { roles: ["bodyText", "claim"] },
    }),
    item("localbev.trust.producer", {
      kind: "trustSignal", strength: "weakConvention", statement: "Le producteur et le lieu de production rassurent sur une boisson souvent artisanale.",
      rationale: "La proximité est un argument de confiance quand elle est réelle.", relates: { roles: ["regulatory", "badge"] },
    }),
    item("localbev.opp.contemporaryLocal", {
      kind: "opportunity", strength: "opportunity", statement: "Une identité locale contemporaine : l'ingrédient, le lieu, le savoir-faire — plutôt que le folklore.",
      rationale: "L'origine se raconte par des faits ; le décor plaqué la banalise.",
    }),
    item("localbev.opp.colourCodedRange", {
      kind: "opportunity", strength: "opportunity", statement: "Coder les variantes par la couleur réelle de chaque boisson.",
      rationale: "Inférence : le code couleur naît alors du produit, pas d'une convention.", basis: "inferred",
    }),
    item("localbev.diff.globalSoda", {
      kind: "differentiation", strength: "avoid", statement: "Copier la mise en page des sodas internationaux : la boisson perd ce qui la rend locale.",
      rationale: "La ressemblance efface la différence de produit.",
    }),
    item("localbev.pit.genericPattern", {
      kind: "pitfall", strength: "avoid", statement: "Plaquer par défaut des motifs « africains » génériques (wax, kente, bogolan) sans lien avec la marque ni source culturelle.",
      rationale: "« Local » ne veut pas dire « motif africain » : un code culturel s'emploie quand il a un sens précis pour la marque.",
      check: { facet: "motif", values: ["wax", "geometric"] }, unlessSourcedCulture: true,
    }),
    item("localbev.pit.absentIngredient", {
      kind: "pitfall", strength: "avoid", statement: "Montrer des fruits ou ingrédients absents de la recette.",
      rationale: "Une image trompeuse sur la composition.",
    }),
    item("localbev.pit.healthClaims", {
      kind: "pitfall", strength: "avoid", statement: "Attribuer des vertus médicinales ou de santé non sourcées (tension, digestion, « détox »…).",
      rationale: "Une allégation santé se prouve ; la tradition n'est pas une preuve.",
    }),
    item("localbev.shelf.fridge", {
      kind: "shelfBehavior", strength: "strongConvention", statement: "En réfrigérateur ou glacière, la couleur du liquide et le nom de saveur font la reconnaissance.",
      rationale: "Les bouteilles sont vues serrées, de face, souvent rapidement.", relates: { roles: ["productName", "image"] },
    }),
  ],
  tensions: [
    tension("localbev.t.localGlobal", ["local", "global"], "Ancrage local contre codes des boissons internationales.", "Garder le nom local et l'ingrédient réel au premier plan, dans une composition contemporaine."),
    tension("localbev.t.traditionalModern", ["traditional", "modern"], "Recette traditionnelle contre présentation moderne.", "La tradition dans le récit et l'ingrédient, la modernité dans la structure graphique."),
    tension("localbev.t.accessiblePremium", ["accessible", "premium"], "Boisson populaire contre montée en gamme (verre, cadeau).", "Le premium passe par la matière et la retenue, pas par le décor."),
  ],
  dataNeeds: [
    { fact: "conditions de conservation et durée de vie", why: "essentiel pour une boisson fraîche ; jamais deviné", role: "regulatory" },
    { fact: "ingrédients exacts", why: "aucune image d'ingrédient absent", role: "bodyText" },
    { fact: "code culturel précis voulu par la marque (le cas échéant)", why: "aucun motif culturel n'est ajouté par défaut", role: "decorative" },
  ],
};

// ─── Representative categories ───────────────────────────────────────────────

const SKINCARE: CategoryKnowledge = {
  id: "skincare",
  label: { fr: "Soin de la peau (visage et corps)", en: "Skin care (face and body)" },
  definition: "Crèmes, sérums, laits, nettoyants et masques pour le visage et le corps.",
  appliesTo: { categories: ["cosmetics", "luxury"], subcategories: ["skincare", "faceCare", "bodyCare", "serum", "lotion", "cream", "cleanser", "mask", "scrub", "luxuryCosmetics"] },
  typicalProducts: ["crème visage", "sérum", "lait corporel", "nettoyant", "masque"], usages: ["soin quotidien"], audience: ["beautyConsumers"],
  informationOrder: ["brand", "productName", "subtitle", "claim", "netContent", "bodyText", "regulatory", "barcode"],
  items: [
    item("skincare.conv.functionSkinType", {
      kind: "convention", strength: "strongConvention", statement: "La fonction du soin et le type de peau visé se lisent juste après la marque.",
      rationale: "C'est le critère de choix d'un soin.", relates: { roles: ["productName", "subtitle"] },
    }),
    item("skincare.conv.cleanCodes", {
      kind: "convention", strength: "weakConvention", statement: "Les codes « clean » (espace, typographie sans empattement, peu d'ornement) sont très répandus.",
      rationale: "Tendance de catégorie, qui rend aussi les marques interchangeables.", relates: { decoration: "subtle", typeTraits: ["grotesque"] }, yieldsTo: ["cultural", "playful", "bold", "heritage"],
    }),
    item("skincare.trust.inci", {
      kind: "trustSignal", strength: "strongConvention", statement: "Liste INCI complète, mode d'emploi, durée d'utilisation après ouverture lorsqu'elle s'applique.",
      rationale: "Transparence attendue en cosmétique ; l'obligation exacte dépend du marché.", relates: { roles: ["bodyText", "regulatory"] },
    }),
    item("skincare.opp.warmth", {
      kind: "opportunity", strength: "opportunity", statement: "Chaleur, matière ou culture dans une catégorie dominée par le blanc clinique.",
      rationale: "Inférence : la différence se crée contre la convention dominante, sans perdre la lisibilité.", basis: "inferred",
    }),
    item("skincare.pit.clinicalFacade", {
      kind: "pitfall", strength: "avoid", statement: "Clinique de façade : croix, blouses, pourcentages ou « testé dermatologiquement » sans étude fournie.",
      rationale: "Une preuve visuelle sans preuve réelle trompe.",
    }),
    item("skincare.pit.fakePremium", {
      kind: "pitfall", strength: "avoid", statement: "Faux premium : dorures, reflets et ornements partout.",
      rationale: "L'accumulation signale l'inverse du premium.", relates: { decorative: ["ornaments", "flourishes"] },
    }),
    GENERIC_NATURAL_CLICHE("skincare.pit.greenCliche"),
  ],
  tensions: [
    tension("skincare.t.naturalClinical", ["natural", "clinical"], "Naturel contre efficacité dermatologique.", "Ingrédient réel + information précise ; pas de science de façade."),
    tension("skincare.t.emotionalTechnical", ["emotional", "technical"], "Plaisir sensoriel contre efficacité technique.", "Le geste et la texture en image, la preuve dans le texte."),
  ],
  dataNeeds: [{ fact: "type de peau et fonction", why: "critère de choix", role: "subtitle" }, { fact: "INCI", why: "transparence attendue", role: "bodyText" }],
};

const FRAGRANCE: CategoryKnowledge = {
  id: "fragrance",
  label: { fr: "Parfum", en: "Fragrance" },
  definition: "Eaux de parfum, eaux de toilette, extraits et brumes parfumées.",
  appliesTo: { categories: ["cosmetics", "luxury"], subcategories: ["perfume"] },
  typicalProducts: ["eau de parfum", "eau de toilette", "extrait", "brume"], usages: ["usage personnel", "cadeau"], audience: ["beautyConsumers", "premium", "luxury"],
  informationOrder: ["brand", "productName", "subtitle", "netContent", "bodyText", "regulatory", "barcode"],
  items: [
    item("fragrance.conv.nameDominant", {
      kind: "convention", strength: "strongConvention", statement: "La marque et le nom du parfum dominent ; la face avant porte très peu d'information.",
      rationale: "Le parfum se choisit sur une identité, pas sur une liste.", relates: { roles: ["brand", "productName"], density: "minimal", composition: ["typographyLed"] },
      check: { facet: "layout", values: ["minimal", "poster", "bold", "classic"] },
    }),
    item("fragrance.conv.objectHero", {
      kind: "convention", strength: "weakConvention", statement: "Le flacon est souvent l'objet héros ; l'étui porte l'identité.",
      rationale: "L'objet fait partie du produit.", relates: { imagery: ["productObject"] },
    }),
    item("fragrance.trust.concentration", {
      kind: "trustSignal", strength: "strongConvention", statement: "Concentration (eau de parfum, eau de toilette, extrait) et volume clairement indiqués.",
      rationale: "C'est une information de choix et de comparaison.", relates: { roles: ["subtitle", "netContent"] },
    }),
    item("fragrance.opp.signature", {
      kind: "opportunity", strength: "opportunity", statement: "Une signature propre (typographie, matière, forme d'étiquette) plutôt que les codes génériques du luxe.",
      rationale: "La catégorie est saturée de codes luxe interchangeables.",
    }),
    item("fragrance.pit.blackGold", {
      kind: "pitfall", strength: "avoid", statement: "L'équation automatique « premium = noir + or ».",
      rationale: "Une convention répandue n'est pas une recommandation ; elle rend la marque interchangeable.",
    }),
    item("fragrance.pit.clutter", {
      kind: "pitfall", strength: "avoid", statement: "Faux luxe par accumulation : ornements, pastilles, effets multiples.",
      rationale: "Le luxe se dit par la retenue.", relates: { decorative: ["badges", "ornaments"] }, check: { facet: "layout", values: ["pop"] },
    }),
  ],
  tensions: [
    tension("fragrance.t.accessibleLuxury", ["accessible", "luxury"], "Parfum accessible contre codes du luxe.", "Retenue et une seule finition signature ; lisibilité de la concentration."),
  ],
  dataNeeds: [{ fact: "concentration", why: "information de choix", role: "subtitle" }],
};

const FOOD: CategoryKnowledge = {
  id: "food",
  label: { fr: "Alimentaire", en: "Food" },
  definition: "Produits alimentaires préemballés en général.",
  appliesTo: { categories: ["food"] },
  typicalProducts: [], usages: ["consommation"], audience: ["massMarket", "family"],
  informationOrder: ["productName", "brand", "image", "claim", "netContent", "bodyText", "regulatory", "barcode"],
  items: [
    item("food.conv.productFirst", {
      kind: "convention", strength: "strongConvention", statement: "Le nom du produit et une image appétissante et fidèle guident la lecture.",
      rationale: "L'acheteur identifie d'abord ce qu'il mange.", relates: { roles: ["productName", "image"], imagery: ["photography", "ingredient", "productObject"] },
    }),
    item("food.pit.absentIngredient", {
      kind: "pitfall", strength: "avoid", statement: "Montrer un ingrédient absent de la recette ou une portion trompeuse.",
      rationale: "Une image trompeuse sur la composition.",
    }),
    NO_UNPROVIDED_CERTIFICATION("food.pit.certification"),
  ],
  tensions: [tension("food.t.artisanalMass", ["artisanal", "massMarket"], "Artisanal contre grande distribution.", "Lisibilité du produit d'abord ; le récit artisanal en second.")],
  dataNeeds: [],
};

const SUPPLEMENTS: CategoryKnowledge = {
  id: "supplements",
  label: { fr: "Compléments alimentaires", en: "Supplements" },
  definition: "Vitamines, minéraux, plantes et protéines en gélules, comprimés ou poudres.",
  appliesTo: { categories: ["supplements"] },
  typicalProducts: ["vitamines", "protéine en poudre", "complément de plantes"], usages: ["prise quotidienne"], audience: ["healthConsumers", "athletes"],
  informationOrder: ["productName", "claim", "netContent", "brand", "bodyText", "regulatory", "barcode"],
  items: [
    item("supp.conv.doseForm", {
      kind: "convention", strength: "strongConvention", statement: "La forme (gélules, poudre), le dosage par prise et le nombre de prises sont très visibles.",
      rationale: "C'est l'information de comparaison et d'usage.", relates: { roles: ["subtitle", "netContent"] },
    }),
    item("supp.trust.composition", {
      kind: "trustSignal", strength: "strongConvention", statement: "Composition par dose, mode d'emploi et précautions d'emploi lisibles.",
      rationale: "La confiance repose sur l'information complète ; les mentions exactes dépendent du marché.", relates: { roles: ["bodyText", "regulatory"] },
    }),
    item("supp.pit.healthClaims", {
      kind: "pitfall", strength: "avoid", statement: "Allégations santé, avant/après ou promesses de performance non fournies par la marque.",
      rationale: "Une allégation santé doit être autorisée et prouvée.",
    }),
    item("supp.pit.pharmaFacade", {
      kind: "pitfall", strength: "avoid", statement: "Imiter les codes d'un médicament pour un complément.",
      rationale: "La confusion de statut trompe l'acheteur.",
    }),
  ],
  tensions: [tension("supp.t.naturalScientific", ["natural", "scientific"], "Plantes et naturel contre preuve scientifique.", "Le végétal précis, l'information nette, aucune science de façade.")],
  dataNeeds: [{ fact: "dosage par prise et nombre de prises", why: "information de base", role: "netContent" }],
};

const GHS_SCOPE = "Système de l'ONU, appliqué selon l'adoption nationale ; ne concerne que les produits classés dangereux, et la classification dépend de la formulation — à établir par le fabricant.";
const HOUSEHOLD: CategoryKnowledge = {
  id: "household",
  label: { fr: "Entretien ménager", en: "Household care" },
  definition: "Lessives, liquides vaisselle, javel, nettoyants et désinfectants.",
  appliesTo: { categories: ["household"] },
  typicalProducts: ["lessive", "eau de javel", "liquide vaisselle", "nettoyant"], usages: ["nettoyage"], audience: ["family", "massMarket", "professional"],
  informationOrder: ["productName", "brand", "claim", "regulatory", "bodyText", "netContent", "barcode"],
  items: [
    item("household.conv.functionFirst", {
      kind: "convention", strength: "strongConvention", statement: "La fonction et l'usage (surface, linge, vaisselle) se comprennent immédiatement.",
      rationale: "On achète une fonction.", relates: { roles: ["productName", "claim"] },
    }),
    item("household.conv.usageSafety", {
      kind: "convention", strength: "strongConvention", statement: "Mode d'emploi, dosage et précautions sont lisibles et non dissimulés.",
      rationale: "La sécurité d'usage fait partie du produit.", relates: { roles: ["bodyText", "regulatory"] },
    }),
    item("household.reg.ghs", {
      kind: "trustSignal", strength: "strongConvention", basis: "regulatory", provenance: UN_GHS, confidence: "medium", scope: GHS_SCOPE,
      statement: "Pour un produit classé dangereux, le SGH prévoit pictogrammes de danger, mention d'avertissement et mentions de danger et de prudence.",
      rationale: "Le design doit leur réserver une place lisible ; la classification elle-même n'est jamais supposée.", relates: { roles: ["regulatory"] },
    }),
    item("household.pit.foodLook", {
      kind: "pitfall", strength: "avoid", statement: "Ressembler à un aliment ou à une boisson (fruits appétissants, verres, gouttes « fraîches »).",
      rationale: "Une confusion avec un produit consommable est un risque d'ingestion.", relates: { imagery: ["ingredient"] },
    }),
    item("household.pit.childAppeal", {
      kind: "pitfall", strength: "avoid", statement: "Mascottes ou codes qui attirent les enfants vers un produit dangereux.",
      rationale: "Un risque de sécurité, quelle que soit la cible marketing.", relates: { illustration: ["mascot"] }, check: { facet: "artStyle", values: ["mascot"] },
    }),
    item("household.pit.greenClaims", {
      kind: "pitfall", strength: "avoid", statement: "Allégations « écologique », « biodégradable » ou « naturel » sans preuve.",
      rationale: "Greenwashing : une allégation environnementale se prouve.",
    }),
  ],
  tensions: [tension("household.t.emotionalTechnical", ["emotional", "technical"], "Réconfort domestique contre efficacité technique.", "L'efficacité se dit clairement ; l'émotion ne doit jamais rendre le produit attirant comme un aliment.")],
  dataNeeds: [{ fact: "classification de danger (si applicable)", why: "jamais supposée", role: "regulatory" }],
};

export const CATEGORY_KNOWLEDGE: readonly CategoryKnowledge[] = Object.freeze([LOCAL_BEVERAGES, HAIRCARE, SPICES, SKINCARE, FRAGRANCE, SUPPLEMENTS, HOUSEHOLD, FOOD, PREPACKAGED]);
