import type { ElementRole, PreflightIssue } from "@/lib/structure";

/** Names of the artwork elements in the studio (smart layout panel, preflight). */
export const ROLE_LABEL: Record<ElementRole, string> = {
  barcode: "Code-barres", regulatory: "Mentions", logo: "Logo", brand: "Marque", productName: "Nom du produit",
  subtitle: "Accroche", netContent: "Contenu net", bodyText: "Texte", claim: "Slogan", badge: "Badge",
  secondary: "Ligne secondaire", image: "Illustration", decorative: "Décor",
};

/** How to fix a preflight issue, in the studio's words. */
export const fixLabel = (i: PreflightIssue) =>
  i.fix === "smart-layout"
    ? "Corriger avec la mise en page intelligente (positions recommandées)."
    : i.elementId === "barcode" // the content check (no valid code), not a placement of the barcode
      ? "Saisissez le code (13 chiffres) dans l'onglet Textes."
      : "Ne tient pas sur le pot tel quel : raccourcissez le texte ou allégez l'élément.";

/** A preflight message as one sentence (no double full stop). */
export const sentence = (s: string) => `${s.replace(/[.\s]+$/, "")}.`;
