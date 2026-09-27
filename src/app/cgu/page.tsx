import type { Metadata } from "next";
import { SitePage } from "@/components/landing/SiteChrome";

export const metadata: Metadata = { title: "Conditions d'utilisation" };

export default function Page() {
  return (
    <SitePage title="Conditions générales d'utilisation" intro="Dernière mise à jour : septembre 2026.">
      <h2>1. Objet</h2>
      <p>Edify est un service en ligne qui permet de concevoir des packagings avec l&apos;aide de l&apos;intelligence artificielle et d&apos;exporter des fichiers d&apos;impression, des maquettes 3D et des visuels.</p>
      <h2>2. Compte</h2>
      <p>L&apos;utilisation du studio nécessite un compte. Vous êtes responsable de la confidentialité de vos identifiants et des actions réalisées depuis votre compte.</p>
      <h2>3. Abonnements et paiement</h2>
      <p>Edify propose trois abonnements (Essentiel 3 000 FCFA, Pro 10 000 FCFA et Entreprise 30 000 FCFA par mois), payés à l&apos;avance pour 1, 3 ou 12 mois par Mobile Money (MTN MoMo, Orange Money) via la passerelle SasPay. Il n&apos;y a pas de prélèvement automatique : l&apos;abonnement prend fin à la date indiquée dans votre compte, sauf si vous le rechargez.</p>
      <p>Chaque abonnement inclut un nombre de créations IA par mois. Une génération par l&apos;IA utilise une création ; les retouches et l&apos;aperçu n&apos;en consomment pas. Les téléchargements (PDF, visuels, 3D) nécessitent un abonnement actif. [Politique de remboursement à compléter.]</p>
      <h2>4. Vos créations</h2>
      <p>Les designs que vous créez vous appartiennent et peuvent être imprimés et commercialisés. Vous garantissez disposer des droits sur les logos, textes et images que vous importez. Les polices proposées sont sous licence libre (SIL Open Font License ou Apache 2.0).</p>
      <h2>5. Fichiers d&apos;impression</h2>
      <p>Les PDF sont fournis avec fonds perdus, traits de coupe et tracé de découpe. Avant toute production, faites valider un bon à tirer (BAT) par votre imprimeur : Edify ne peut être tenu responsable d&apos;une impression non conforme.</p>
      <h2>6. Contenus générés par l&apos;IA</h2>
      <p>Les propositions de l&apos;IA (textes, mentions, ingrédients) sont des suggestions : vérifiez-les, en particulier les mentions réglementaires propres à votre produit.</p>
      <h2>7. Disponibilité</h2>
      <p>Nous faisons notre possible pour assurer la disponibilité du service, sans garantie d&apos;absence d&apos;interruption.</p>
      <h2>8. Contact</h2>
      <p>Pour toute question : <a href="/contact">page de contact</a>. Éditeur : voir les <a href="/mentions-legales">mentions légales</a>.</p>
    </SitePage>
  );
}
