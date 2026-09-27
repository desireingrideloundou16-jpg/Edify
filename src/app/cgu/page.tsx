import type { Metadata } from "next";
import { SitePage } from "@/components/landing/SiteChrome";
import { LEGAL } from "@/lib/legal";
import { AI_REGEN_PER_PACKAGING, PLANS } from "@/lib/billing/plans";

export const metadata: Metadata = { title: "Conditions d'utilisation" };

const fcfa = (n: number) => `${new Intl.NumberFormat("fr-FR").format(n).replace(/ | /g, " ")} FCFA`;

export default function Page() {
  return (
    <SitePage title="Conditions générales d'utilisation et de vente" intro="Dernière mise à jour : septembre 2026.">
      <h2>1. Objet</h2>
      <p>
        Edify, service édité par {LEGAL.owner} ({LEGAL.form}, {LEGAL.city}), permet de concevoir des packagings avec l&apos;aide de l&apos;intelligence artificielle et d&apos;exporter des fichiers d&apos;impression, des maquettes 3D et des visuels publicitaires. L&apos;utilisation du service vaut acceptation des présentes conditions.
      </p>

      <h2>2. Compte</h2>
      <p>L&apos;utilisation du studio nécessite un compte. Vous êtes responsable de la confidentialité de vos identifiants et des actions réalisées depuis votre compte. Edify peut suspendre un compte en cas de fraude ou d&apos;usage contraire aux présentes conditions.</p>

      <h2>3. Abonnements</h2>
      <p>Edify ne propose pas d&apos;offre gratuite. Trois abonnements sont disponibles :</p>
      <ul>
        <li><strong>Essentiel</strong> : {fcfa(PLANS.essentiel.monthly)} par mois, {PLANS.essentiel.packagings} packaging complet par mois.</li>
        <li><strong>Pro</strong> : {fcfa(PLANS.pro.monthly)} par mois, une gamme de {PLANS.pro.packagings} packagings complets par mois.</li>
        <li><strong>Entreprise</strong> : {fcfa(PLANS.entreprise.monthly)} par mois, une gamme de {PLANS.entreprise.packagings} packagings complets par mois.</li>
      </ul>
      <p>
        Un <strong>packaging complet</strong> comprend le design réalisé par l&apos;IA, la maquette 3D (mockup), l&apos;image publicitaire, le PDF d&apos;impression et les fichiers 3D. Un packaging est décompté la première fois que l&apos;IA le conçoit ou qu&apos;il est téléchargé ; ses retouches et téléchargements sont ensuite illimités, et l&apos;IA peut le régénérer jusqu&apos;à {AI_REGEN_PER_PACKAGING} fois. Toutes les fonctionnalités sont incluses dans les trois abonnements. Les packagings non utilisés restent disponibles tant que l&apos;abonnement est actif.
      </p>

      <h2>4. Paiement</h2>
      <p>
        Les abonnements se paient à l&apos;avance pour 1, 3 mois (remise de 10 %) ou 12 mois (remise de 20 %), par Mobile Money (MTN Mobile Money, Orange Money) via la passerelle sécurisée SasPay. Les prix sont indiqués en francs CFA (FCFA), toutes taxes comprises. Il n&apos;y a pas de prélèvement automatique : l&apos;abonnement prend fin à la date indiquée dans votre compte, sauf si vous le rechargez. L&apos;abonnement est activé dès la confirmation du paiement par l&apos;opérateur.
      </p>

      <h2>5. Satisfait ou remboursé</h2>
      <p>
        Pour votre <strong>premier paiement</strong>, si Edify ne vous convient pas, vous pouvez demander le remboursement intégral dans les <strong>{LEGAL.refundDays} jours</strong> qui suivent, à condition de n&apos;avoir utilisé <strong>qu&apos;un seul packaging</strong>. Faites la demande via le <a href="/contact">formulaire de contact</a> ou sur WhatsApp au <a href={LEGAL.whatsappUrl}>{LEGAL.phone}</a>. Le remboursement est versé sur le numéro Mobile Money ayant servi au paiement, sous 7 jours ouvrés, et l&apos;abonnement est désactivé. Les renouvellements et les paiements suivants ne sont pas remboursables.
      </p>

      <h2>6. Vos créations</h2>
      <p>Les designs que vous créez vous appartiennent et peuvent être imprimés et commercialisés. Vous garantissez disposer des droits sur les logos, textes et images que vous importez. Les polices proposées sont sous licence libre (SIL Open Font License ou Apache 2.0).</p>

      <h2>7. Fichiers d&apos;impression et mentions légales du produit</h2>
      <p>
        Les PDF sont fournis avec fonds perdus, traits de coupe et tracé de découpe. Les propositions de l&apos;IA (textes, ingrédients, mentions) sont des suggestions : vérifiez-les, en particulier les mentions obligatoires propres à votre produit. Avant toute production, faites valider un bon à tirer (BAT) par votre imprimeur. Edify ne peut être tenu responsable d&apos;une impression non conforme ou d&apos;une mention inexacte non vérifiée.
      </p>

      <h2>8. Disponibilité</h2>
      <p>Nous faisons notre possible pour assurer la disponibilité du service, sans garantie d&apos;absence d&apos;interruption. En cas d&apos;interruption prolongée de notre fait, la durée de votre abonnement est prolongée d&apos;autant.</p>

      <h2>9. Droit applicable</h2>
      <p>Les présentes conditions sont régies par le droit camerounais. En cas de litige, une solution amiable sera recherchée en priorité ; à défaut, les tribunaux compétents de Yaoundé seront saisis.</p>

      <h2>10. Contact</h2>
      <p>
        <a href="/contact">Formulaire de contact</a> · WhatsApp <a href={LEGAL.whatsappUrl}>{LEGAL.phone}</a> · Éditeur : voir les <a href="/mentions-legales">mentions légales</a>.
      </p>
    </SitePage>
  );
}
