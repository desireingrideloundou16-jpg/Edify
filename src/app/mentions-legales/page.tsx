import type { Metadata } from "next";
import { SitePage } from "@/components/landing/SiteChrome";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Mentions légales" };

export default function Page() {
  return (
    <SitePage title="Mentions légales" intro="Dernière mise à jour : septembre 2026.">
      <h2>Éditeur du site</h2>
      <p>
        Le site et le service Edify sont édités par <strong>{LEGAL.owner}</strong>, {LEGAL.form}, dont le siège est situé {LEGAL.address}.
      </p>
      <ul>
        <li>Numéro d&apos;identifiant unique (NIU) : {LEGAL.niu}</li>
        <li>Registre du commerce et du crédit mobilier (RCCM) : {LEGAL.rccm}</li>
        <li>Responsable de la publication : {LEGAL.owner}</li>
        <li>
          Téléphone et WhatsApp : <a href={LEGAL.whatsappUrl}>{LEGAL.phone}</a>
        </li>
        <li>
          Contact écrit : <a href="/contact">formulaire de contact</a>
        </li>
      </ul>
      <p>Ces informations sont fournies conformément à la loi camerounaise n° 2010/021 du 21 décembre 2010 régissant le commerce électronique.</p>

      <h2>Hébergement</h2>
      <ul>
        <li>Base de données et comptes utilisateurs : Supabase Inc., serveurs situés dans l&apos;Union européenne (région de Paris, France).</li>
        <li>Application web : {LEGAL.host}</li>
      </ul>

      <h2>Paiements</h2>
      <p>Les paiements par Mobile Money (MTN Mobile Money, Orange Money) sont traités par la passerelle sécurisée SasPay. Edify n&apos;a jamais accès à votre code secret Mobile Money.</p>

      <h2>Propriété intellectuelle</h2>
      <p>
        La marque Edify, le site et ses contenus (textes, visuels, logiciels, modèles 3D) sont la propriété de l&apos;éditeur et protégés par le droit de la propriété intellectuelle. Toute reproduction sans autorisation est interdite. Les designs de packaging créés par les utilisateurs leur appartiennent, dans les conditions prévues par les <a href="/cgu">conditions d&apos;utilisation</a>.
      </p>

      <h2>Responsabilité</h2>
      <p>
        Les propositions de l&apos;IA (textes, ingrédients, mentions) sont des suggestions. Il appartient à l&apos;utilisateur de vérifier la conformité de son étiquette finale avant impression, notamment auprès de l&apos;Agence des Normes et de la Qualité (ANOR).
      </p>
    </SitePage>
  );
}
