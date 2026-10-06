/**
 * PI-4 — the local, versioned reference registry (REFERENCE_DATASET_VERSION).
 *
 * Research pack of 2026-10-06. Rules followed:
 *   - "verified" only when an official page of the publisher was actually read in that session;
 *   - a URL is recorded only when that exact page was read (never reconstructed or guessed);
 *   - metadata that could not be confirmed stays undefined (no author, date or revision invented);
 *   - sources whose text could not be read (blocked domain, unreadable page, secondary summary only)
 *     are kept as "pendingVerification": visible, never used as evidence.
 */
import type { Reference } from "./types";

const READ = (note: string) => ({ method: "officialPageRead" as const, checkedAt: "2026-10-06", note });
const PENDING = (note: string) => ({ method: "searchSummaryOnly" as const, note });

export const REFERENCES: readonly Reference[] = Object.freeze([
  // ── Verified ──────────────────────────────────────────────────────────────
  {
    id: "ref.codex.cxs_1_1985",
    title: "General Standard for the Labelling of Pre-packaged Foods",
    officialId: "CXS 1-1985",
    sourceType: "regulatory",
    publisher: "Codex Alimentarius Commission (FAO/WHO)",
    sourceFamily: "fao-who-codex",
    publicationDate: "1985",
    lastRevision: "2024",
    jurisdiction: "global",
    language: "en",
    scope: "Norme internationale pour l'étiquetage des denrées préemballées. Force juridique seulement là où un pays l'adopte ; sert de guide d'harmonisation.",
    status: "verified",
    verification: READ("Identité confirmée par la page FAO « Food Labelling » (qui la désigne comme l'instrument Codex clé) et révision 2024 confirmée par la page OMS de la 47e Commission. Le PDF de la norme (workspace.fao.org) a répondu 403 : son texte n'a pas été relu."),
    legacyIds: ["CXS 1-1985"],
  },
  {
    id: "ref.fao.food_labelling",
    title: "Food Labelling",
    sourceType: "institutional",
    publisher: "Food and Agriculture Organization of the United Nations (FAO)",
    sourceFamily: "fao-who-codex",
    url: "https://www.fao.org/food-labelling/en",
    jurisdiction: "global",
    language: "en",
    scope: "Présentation institutionnelle de l'étiquetage alimentaire et de la norme Codex CXS 1-1985.",
    status: "verified",
    verification: READ("Page lue : CXS 1-1985 y est décrite comme l'instrument Codex clé, utilisé par les pays comme guide d'harmonisation et comme base de politiques nationales d'étiquetage."),
  },
  {
    id: "ref.who.cac47_2024",
    title: "47th session of the FAO/WHO Codex Alimentarius Commission adopts new standards",
    sourceType: "institutional",
    publisher: "World Health Organization (WHO)",
    sourceFamily: "fao-who-codex",
    url: "https://www.who.int/news-room/events/detail/2024/11/25/default-calendar/47th-session-of-the-FAO-WHO-Codex-Alimentarius-Commission-adopts-new-standards",
    jurisdiction: "global",
    language: "en",
    scope: "Annonce des normes adoptées à la 47e session de la Commission du Codex (novembre 2024).",
    status: "verified",
    verification: READ("Page lue : la norme générale d'étiquetage des denrées préemballées a été révisée (étiquetage des allergènes), adoption le 27.11.2024."),
  },
  {
    id: "ref.eu.your_europe_food_labelling",
    title: "Food labelling - general EU rules",
    sourceType: "governmental",
    publisher: "European Union — Your Europe",
    sourceFamily: "eu",
    url: "https://europa.eu/youreurope/business/product-requirements/food-labelling/general-rules/index_en.htm",
    jurisdiction: "EU",
    language: "en",
    scope: "Résumé officiel, par l'UE, des règles d'étiquetage des denrées alimentaires dans l'Union (règlement sur l'information des consommateurs).",
    status: "verified",
    verification: READ("Page lue : liste des mentions obligatoires et hauteur d'x minimale (1,2 mm ; 0,9 mm si la plus grande face est inférieure à 80 cm²)."),
  },

  // ── Pending verification (never used as evidence) ─────────────────────────
  {
    id: "ref.eu.reg_1169_2011",
    title: "Regulation (EU) No 1169/2011 on the provision of food information to consumers",
    officialId: "Regulation (EU) No 1169/2011",
    sourceType: "regulatory",
    publisher: "European Parliament and Council of the European Union",
    sourceFamily: "eu",
    jurisdiction: "EU",
    scope: "Information sur les denrées alimentaires fournie aux consommateurs dans l'UE.",
    status: "pendingVerification",
    verification: PENDING("Texte primaire non lu (EUR-Lex n'a renvoyé qu'un index) ; son contenu n'est utilisé qu'à travers le résumé officiel Your Europe."),
  },
  {
    id: "ref.un.ghs",
    title: "Globally Harmonized System of Classification and Labelling of Chemicals (GHS)",
    sourceType: "regulatory",
    publisher: "United Nations",
    sourceFamily: "un-ghs",
    jurisdiction: "global",
    scope: "Système de l'ONU de classification des dangers et de communication (étiquettes, fiches de données de sécurité) ; appliqué selon l'adoption nationale.",
    status: "pendingVerification",
    verification: PENDING("Le site UNECE n'a pas pu être lu depuis cet environnement (domaine bloqué) ; révision courante non confirmée."),
    legacyIds: ["UN GHS"],
  },
  {
    id: "ref.eu.reg_1223_2009",
    title: "Regulation (EC) No 1223/2009 on cosmetic products",
    officialId: "Regulation (EC) No 1223/2009",
    sourceType: "regulatory",
    publisher: "European Parliament and Council of the European Union",
    sourceFamily: "eu",
    jurisdiction: "EU",
    scope: "Produits cosmétiques mis sur le marché de l'UE (y compris les parfums).",
    status: "pendingVerification",
    verification: PENDING("La lecture du PDF de la Commission a renvoyé un contenu incohérent (attribué à l'ancienne directive 76/768) : l'article 19 n'est pas considéré comme vérifié."),
  },
  {
    id: "ref.eu.dir_2002_46",
    title: "Directive 2002/46/EC on food supplements",
    officialId: "Directive 2002/46/EC",
    sourceType: "regulatory",
    publisher: "European Parliament and Council of the European Union",
    sourceFamily: "eu",
    jurisdiction: "EU",
    scope: "Compléments alimentaires dans l'UE (transposée en droit national).",
    status: "pendingVerification",
    verification: PENDING("Texte EUR-Lex non lisible depuis cet environnement ; contenu connu seulement par des résumés de recherche."),
  },
  {
    id: "ref.cm.anor_nc_04_2000_20",
    title: "NC 04:2000-20 — Étiquetage des denrées alimentaires préemballées",
    officialId: "NC 04:2000-20",
    sourceType: "regulatory",
    publisher: "Agence des Normes et de la Qualité (ANOR), Cameroun",
    sourceFamily: "cm-anor",
    jurisdiction: "Cameroon",
    language: "fr",
    scope: "Norme camerounaise d'étiquetage des denrées alimentaires préemballées.",
    status: "pendingVerification",
    verification: PENDING("Un résumé secondaire la décrit comme équivalente à CXS 1-1985 et rendue obligatoire ; ni la norme ni l'acte qui la rend obligatoire n'ont été lus."),
  },
]);
