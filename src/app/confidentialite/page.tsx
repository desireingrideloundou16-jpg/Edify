import type { Metadata } from "next";
import { SitePage } from "@/components/landing/SiteChrome";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function Page() {
  return (
    <SitePage title="Politique de confidentialité" intro="Dernière mise à jour : septembre 2026.">
      <h2>Données collectées</h2>
      <ul>
        <li><strong>Compte</strong> : adresse e-mail, nom et photo de profil (si vous vous connectez avec Google).</li>
        <li><strong>Projets</strong> : les textes, choix de contenant, de style et de polices de vos packagings, pour les retrouver à votre prochaine connexion.</li>
        <li><strong>Briefs envoyés au designer IA</strong> : le texte et l&apos;éventuelle image de référence, transmis au service d&apos;IA pour générer le design.</li>
        <li><strong>Messages de contact</strong> : nom, e-mail et contenu du message.</li>
      </ul>
      <h2>Finalités</h2>
      <p>Fournir le service (compte, sauvegarde des projets, génération de designs, crédits), répondre à vos demandes et sécuriser la plateforme. Aucune donnée n&apos;est vendue à des tiers.</p>
      <h2>Sous-traitants</h2>
      <ul>
        <li>Supabase : authentification et base de données, hébergées dans l&apos;Union européenne (Paris).</li>
        <li>Google (Gemini) et, le cas échéant, Anthropic (Claude) : génération des designs à partir de vos briefs.</li>
        <li>Google : connexion avec un compte Google, si vous choisissez cette option.</li>
      </ul>
      <h2>Cookies</h2>
      <p>Edify n&apos;utilise que des cookies strictement nécessaires : ceux qui maintiennent votre session de connexion. Aucun cookie publicitaire ni de mesure d&apos;audience.</p>
      <h2>Durée de conservation</h2>
      <p>Vos données sont conservées tant que votre compte est actif. Vous pouvez demander la suppression de votre compte et de vos projets à tout moment.</p>
      <h2>Vos droits</h2>
      <p>Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de limitation, d&apos;opposition et de portabilité. Pour les exercer, écrivez-nous via la <a href="/contact">page de contact</a>. Vous pouvez aussi saisir la CNIL (cnil.fr).</p>
      <p>Responsable du traitement : [à compléter : raison sociale et adresse].</p>
    </SitePage>
  );
}
