/**
 * PI-4 — claims: what each reference says, in our words (short summaries, no long quotation), attached
 * to existing PI-3 knowledge ids. A claim states its jurisdiction, its evidence kind and, when it has one,
 * its validity period. Claims on pending references are kept (they document what remains to verify) but
 * never count as evidence.
 */
import type { ReferenceClaim } from "./types";

const FOOD_AND_DRINKS = ["food", "beverages"] as const;

export const CLAIMS: readonly ReferenceClaim[] = Object.freeze([
  // ── Prepackaged food & drinks ─────────────────────────────────────────────
  {
    id: "claim.prepackaged.codex.mandatory", referenceId: "ref.codex.cxs_1_1985", knowledgeId: "prepackaged.codex.mandatory",
    categoryIds: ["prepackagedFood"], productCategories: FOOD_AND_DRINKS, claimType: "labelingRequirement", relation: "supports", jurisdiction: "global",
    claim: "La norme prévoit des mentions obligatoires : dénomination, liste des ingrédients, quantité nette, nom et adresse, pays d'origine (sous conditions), identification du lot, marquage de la date et conservation, mode d'emploi.",
    evidence: { kind: "secondarySummary", note: "Liste issue de résumés de recherche ; la section 4 de la norme n'a pas été relue dans cette session." },
  },
  {
    id: "claim.prepackaged.fao.harmonization", referenceId: "ref.fao.food_labelling", knowledgeId: "prepackaged.codex.mandatory",
    categoryIds: ["prepackagedFood"], productCategories: FOOD_AND_DRINKS, claimType: "regulatoryContext", relation: "contextualizes", jurisdiction: "global",
    claim: "La FAO présente CXS 1-1985 comme l'instrument Codex clé de l'information alimentaire, utilisé par les pays comme guide d'harmonisation et base de politiques nationales.",
    evidence: { kind: "officialSummary", note: "Page FAO lue le 2026-10-06." },
  },
  {
    id: "claim.prepackaged.codex.allergens2024", referenceId: "ref.who.cac47_2024", knowledgeId: "prepackaged.codex.mandatory",
    categoryIds: ["prepackagedFood"], productCategories: FOOD_AND_DRINKS, claimType: "labelingRequirement", relation: "partiallySupports", jurisdiction: "global",
    claim: "La norme a été révisée pour l'étiquetage des allergènes : allergènes à toujours déclarer, et allergènes à déclarer selon la région ou le pays.",
    evidence: { kind: "officialSummary", note: "Page OMS lue le 2026-10-06 (adoption le 27.11.2024)." },
    validFrom: "2024-11-27",
  },
  {
    id: "claim.prepackaged.eu.mandatory", referenceId: "ref.eu.your_europe_food_labelling", knowledgeId: "prepackaged.codex.mandatory",
    categoryIds: ["prepackagedFood"], productCategories: FOOD_AND_DRINKS, claimType: "labelingRequirement", relation: "supports", jurisdiction: "EU",
    claim: "Dans l'UE : dénomination, ingrédients (dont additifs), allergènes, quantité de certains ingrédients, date, quantité nette, conservation, exploitant, origine si nécessaire, mode d'emploi, déclaration nutritionnelle.",
    evidence: { kind: "officialSummary", note: "Page Your Europe lue le 2026-10-06." },
  },
  {
    id: "claim.prepackaged.eu.xheight", referenceId: "ref.eu.your_europe_food_labelling",
    categoryIds: ["prepackagedFood"], productCategories: FOOD_AND_DRINKS, claimType: "labelingRequirement", relation: "supports", jurisdiction: "EU",
    claim: "Dans l'UE, les mentions obligatoires ont une hauteur d'x d'au moins 1,2 mm ; 0,9 mm si la plus grande face de l'emballage est inférieure à 80 cm².",
    evidence: { kind: "officialSummary", note: "Page Your Europe lue le 2026-10-06." },
  },
  {
    id: "claim.prepackaged.cm.nc04", referenceId: "ref.cm.anor_nc_04_2000_20", knowledgeId: "prepackaged.codex.mandatory",
    categoryIds: ["prepackagedFood"], productCategories: FOOD_AND_DRINKS, claimType: "regulatoryContext", relation: "supports", jurisdiction: "Cameroon",
    claim: "Norme camerounaise d'étiquetage des denrées préemballées, décrite par un résumé secondaire comme équivalente à CXS 1-1985 et rendue obligatoire.",
    evidence: { kind: "secondarySummary", note: "Non vérifié : à confirmer sur le texte ANOR et l'acte qui la rend obligatoire." },
  },

  // ── Local beverages and spices (Codex / EU particulars that back PI-3 items) ─
  {
    id: "claim.localbev.storage.codex", referenceId: "ref.codex.cxs_1_1985", knowledgeId: "localbev.conv.storage",
    categoryIds: ["localBeverages"], productCategories: ["beverages"], claimType: "labelingRequirement", relation: "partiallySupports", jurisdiction: "global",
    claim: "Le marquage de la date et les conditions de conservation figurent parmi les mentions obligatoires de la norme.",
    evidence: { kind: "secondarySummary", note: "Mention de la liste résumée ; section 4 non relue." },
  },
  {
    id: "claim.localbev.storage.eu", referenceId: "ref.eu.your_europe_food_labelling", knowledgeId: "localbev.conv.storage",
    categoryIds: ["localBeverages"], productCategories: ["beverages"], claimType: "labelingRequirement", relation: "partiallySupports", jurisdiction: "EU",
    claim: "Dans l'UE, la date (à consommer de préférence avant / jusqu'au) et les conditions de conservation sont des mentions obligatoires.",
    evidence: { kind: "officialSummary", note: "Page Your Europe lue le 2026-10-06." },
  },
  {
    id: "claim.localbev.ingredients.codex", referenceId: "ref.codex.cxs_1_1985", knowledgeId: "localbev.trust.realIngredients",
    categoryIds: ["localBeverages"], productCategories: ["beverages"], claimType: "labelingRequirement", relation: "partiallySupports", jurisdiction: "global",
    claim: "La liste des ingrédients est une mention obligatoire de la norme (elle ne dit rien des allégations « naturel » ou « sans conservateur »).",
    evidence: { kind: "secondarySummary", note: "Mention de la liste résumée ; section 4 non relue." },
  },
  {
    id: "claim.spices.origin.codex", referenceId: "ref.codex.cxs_1_1985", knowledgeId: "spices.trust.origin",
    categoryIds: ["spices"], productCategories: ["food"], claimType: "labelingRequirement", relation: "partiallySupports", jurisdiction: "global",
    claim: "Le pays d'origine figure parmi les mentions de la norme, sous conditions ; la valeur d'une origine plus précise (terroir) n'y est pas traitée.",
    evidence: { kind: "secondarySummary", note: "Mention de la liste résumée ; conditions exactes non relues." },
  },

  // ── Household (pending) ───────────────────────────────────────────────────
  {
    id: "claim.household.ghs.labels", referenceId: "ref.un.ghs", knowledgeId: "household.reg.ghs",
    categoryIds: ["household"], productCategories: ["household"], claimType: "safetySignal", relation: "supports", jurisdiction: "global",
    claim: "Le SGH harmonise la classification des dangers et les éléments de communication des dangers (étiquettes, fiches de données de sécurité).",
    evidence: { kind: "secondarySummary", note: "Résumé de recherche ; page UNECE non lue (domaine bloqué)." },
  },

  // ── Cosmetics (pending) ───────────────────────────────────────────────────
  {
    id: "claim.haircare.eu.inci", referenceId: "ref.eu.reg_1223_2009", knowledgeId: "haircare.trust.inci",
    categoryIds: ["haircare"], productCategories: ["cosmetics"], claimType: "labelingRequirement", relation: "supports", jurisdiction: "EU",
    claim: "Dans l'UE, la liste des ingrédients (nomenclature INCI) figure parmi les mentions obligatoires des produits cosmétiques (article 19).",
    evidence: { kind: "secondarySummary", note: "Résumé de recherche ; article 19 non vérifié sur le texte." },
  },
  {
    id: "claim.skincare.eu.inci", referenceId: "ref.eu.reg_1223_2009", knowledgeId: "skincare.trust.inci",
    categoryIds: ["skincare"], productCategories: ["cosmetics", "luxury"], claimType: "labelingRequirement", relation: "supports", jurisdiction: "EU",
    claim: "Dans l'UE, liste des ingrédients, durée de durabilité ou PAO et précautions d'emploi figurent parmi les mentions de l'article 19.",
    evidence: { kind: "secondarySummary", note: "Résumé de recherche ; article 19 non vérifié sur le texte." },
  },
  {
    id: "claim.fragrance.eu.cosmetic", referenceId: "ref.eu.reg_1223_2009",
    categoryIds: ["fragrance"], productCategories: ["cosmetics", "luxury"], claimType: "regulatoryContext", relation: "contextualizes", jurisdiction: "EU",
    claim: "Dans l'UE, les parfums relèvent du règlement sur les produits cosmétiques et de ses mentions d'étiquetage.",
    evidence: { kind: "secondarySummary", note: "Résumé de recherche ; non vérifié sur le texte." },
  },

  // ── Supplements (pending) ─────────────────────────────────────────────────
  {
    id: "claim.supp.eu.dose", referenceId: "ref.eu.dir_2002_46", knowledgeId: "supp.conv.doseForm",
    categoryIds: ["supplements"], productCategories: ["supplements"], claimType: "labelingRequirement", relation: "supports", jurisdiction: "EU",
    claim: "Dans l'UE, l'étiquette indique la portion journalière recommandée et un avertissement de ne pas la dépasser.",
    evidence: { kind: "secondarySummary", note: "Résumé de recherche ; texte non lu." },
  },
  {
    id: "claim.supp.eu.statements", referenceId: "ref.eu.dir_2002_46", knowledgeId: "supp.trust.composition",
    categoryIds: ["supplements"], productCategories: ["supplements"], claimType: "labelingRequirement", relation: "partiallySupports", jurisdiction: "EU",
    claim: "Dans l'UE, l'étiquette précise que le complément ne remplace pas une alimentation variée et doit être tenu hors de portée des jeunes enfants.",
    evidence: { kind: "secondarySummary", note: "Résumé de recherche ; texte non lu." },
  },
]);
