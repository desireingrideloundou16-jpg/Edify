/**
 * PI-1A — product taxonomy: category → subcategory. A product is described by
 *   category (closed) → subcategory (closed, per category) → productType (open text) → customType (open text)
 * so a product nobody planned for still fits: "other" at either level, and a free productType / customType.
 *
 * "luxury" is used when luxury retail or gifting is the product's primary identity (a prestige perfume, a
 * gift box); a premium product of an ordinary category keeps its category and says "premium" through its
 * price position and positioning territories (a premium chocolate stays food / chocolate).
 */

export const PRODUCT_TAXONOMY = {
  food: {
    label: { fr: "Alimentaire", en: "Food" },
    subcategories: ["bakery", "confectionery", "chocolate", "snacks", "cereals", "grains", "flour", "powderedFood", "spices", "sauces", "condiments", "spreads", "edibleOils", "dairy", "frozenFood", "readyMeals", "cannedFood", "preservedFood", "babyFood", "coffee", "tea", "functionalFood", "other"],
  },
  beverages: {
    label: { fr: "Boissons", en: "Beverages" },
    subcategories: ["water", "juice", "softDrink", "energyDrink", "sportsDrink", "milk", "plantMilk", "wine", "spirit", "beer", "cocktail", "syrup", "concentrate", "powderedBeverage", "other"],
  },
  cosmetics: {
    label: { fr: "Cosmétique", en: "Cosmetics" },
    subcategories: ["skincare", "faceCare", "bodyCare", "hairCare", "shampoo", "conditioner", "hairCream", "hairOil", "serum", "lotion", "cream", "gel", "cleanser", "mask", "scrub", "perfume", "makeup", "other"],
  },
  personalCare: {
    label: { fr: "Hygiène", en: "Personal care" },
    subcategories: ["soap", "liquidSoap", "deodorant", "oralCare", "shaving", "hygieneProducts", "other"],
  },
  supplements: {
    label: { fr: "Compléments", en: "Supplements" },
    subcategories: ["vitamins", "minerals", "herbalSupplement", "proteinPowder", "sportsSupplement", "capsules", "tablets", "gummies", "powderedSupplement", "liquidSupplement", "other"],
  },
  pharmaceutical: {
    label: { fr: "Santé", en: "Pharmaceutical / health" },
    subcategories: ["otc", "prescription", "medicalDevice", "topical", "liquidMedicine", "powder", "tablets", "capsules", "other"],
  },
  household: {
    label: { fr: "Entretien", en: "Household" },
    subcategories: ["detergent", "bleach", "cleaningLiquid", "disinfectant", "airFreshener", "laundry", "dishwashing", "surfaceCleaner", "other"],
  },
  petCare: {
    label: { fr: "Animaux", en: "Pet care" },
    subcategories: ["petFood", "treats", "supplements", "grooming", "hygiene", "other"],
  },
  luxury: {
    label: { fr: "Luxe", en: "Luxury" },
    subcategories: ["luxuryFood", "luxuryCosmetics", "perfume", "premiumBeverage", "premiumGiftProduct", "other"],
  },
  industrial: {
    label: { fr: "Industriel / B2B", en: "Industrial / B2B" },
    subcategories: ["chemicals", "agricultural", "technicalProducts", "industrialConsumables", "other"],
  },
  other: {
    label: { fr: "Autre", en: "Other" },
    subcategories: ["other"],
  },
} as const;

export type ProductCategory = keyof typeof PRODUCT_TAXONOMY;
export type ProductSubcategory<C extends ProductCategory = ProductCategory> = (typeof PRODUCT_TAXONOMY)[C]["subcategories"][number];

export const PRODUCT_CATEGORIES = Object.keys(PRODUCT_TAXONOMY) as ProductCategory[];

export const isProductCategory = (v: unknown): v is ProductCategory => typeof v === "string" && Object.prototype.hasOwnProperty.call(PRODUCT_TAXONOMY, v);

/** Does this subcategory belong to this category? */
export function isSubcategoryOf(category: ProductCategory, sub: unknown): sub is ProductSubcategory {
  return typeof sub === "string" && (PRODUCT_TAXONOMY[category].subcategories as readonly string[]).includes(sub);
}
