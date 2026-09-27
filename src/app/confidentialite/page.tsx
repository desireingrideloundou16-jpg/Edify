import type { Metadata } from "next";
import { SitePage } from "@/components/landing/SiteChrome";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function Page() {
  return (
    <SitePage title="Politique de confidentialité" intro="Dernière mise à jour : septembre 2026.">
      <h2>Responsable du traitement</h2>
      <p>
        {LEGAL.owner}, {LEGAL.form}, {LEGAL.address}. Contact : <a href="/contact">formulaire de contact</a> ou WhatsApp <a href={LEGAL.whatsappUrl}>{LEGAL.phone}</a>.
      </p>

      <h2>Données collectées</h2>
      <ul>
        <li><strong>Compte</strong> : adresse e-mail, nom et photo de profil (si vous vous connectez avec Google).</li>
        <li><strong>Projets</strong> : les textes, le logo, les informations produit (ingrédients, dates, prix, code-barres) et les choix de contenant, de style et de polices de vos packagings.</li>
        <li><strong>Réponses du parcours « Commencez maintenant »</strong> : conservées dans votre navigateur jusqu&apos;à la création de votre packaging.</li>
        <li><strong>Briefs envoyés au designer IA</strong> : le texte et l&apos;éventuelle image (logo, référence), transmis au service d&apos;IA pour générer le design.</li>
        <li><strong>Paiements</strong> : plan choisi, montant, date et statut du paiement. Votre numéro et votre code Mobile Money sont traités par SasPay et votre opérateur, jamais stockés par Edify.</li>
        <li><strong>Messages de contact</strong> : nom, e-mail et contenu du message.</li>
      </ul>

      <h2>Finalités</h2>
      <p>Fournir le service (compte, sauvegarde des projets, génération des designs, abonnement), répondre à vos demandes, prévenir la fraude et sécuriser la plateforme. Aucune donnée n&apos;est vendue ni utilisée à des fins publicitaires.</p>

      <h2>Sous-traitants</h2>
      <ul>
        <li>Supabase : authentification et base de données, hébergées dans l&apos;Union européenne (Paris).</li>
        <li>Google (Gemini) et, le cas échéant, Anthropic (Claude) : génération des designs et des suggestions à partir de vos briefs.</li>
        <li>Cloudflare (Workers AI) : génération des décors photo des visuels publicitaires.</li>
        <li>SasPay : encaissement des paiements Mobile Money.</li>
        <li>Google : connexion avec un compte Google, si vous choisissez cette option.</li>
      </ul>

      <h2>Cookies</h2>
      <p>Edify n&apos;utilise que des cookies nécessaires au fonctionnement : votre session de connexion et votre choix de langue. Votre choix de thème (clair ou sombre) est gardé dans votre navigateur. Aucun cookie publicitaire ni de mesure d&apos;audience.</p>

      <h2>Durée de conservation</h2>
      <p>Vos données sont conservées tant que votre compte est actif. Les informations de paiement sont conservées pendant la durée exigée par les obligations comptables. Vous pouvez demander la suppression de votre compte et de vos projets à tout moment.</p>

      <h2>Vos droits</h2>
      <p>
        Conformément à la législation camerounaise sur la protection des données à caractère personnel, vous pouvez accéder à vos données, les rectifier, demander leur suppression ou vous opposer à leur traitement. Pour exercer ces droits, écrivez-nous via le <a href="/contact">formulaire de contact</a> ou sur WhatsApp. Nous répondons sous 30 jours au plus.
      </p>
    </SitePage>
  );
}
