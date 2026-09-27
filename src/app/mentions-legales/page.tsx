import type { Metadata } from "next";
import { SitePage } from "@/components/landing/SiteChrome";

export const metadata: Metadata = { title: "Mentions légales" };

export default function Page() {
  return (
    <SitePage title="Mentions légales">
      <h2>Éditeur du site</h2>
      <p>Edify — [à compléter : raison sociale ou nom de l&apos;entrepreneur, forme juridique, capital social]</p>
      <p>Adresse : [à compléter]<br />SIRET / RCS : [à compléter]<br />Directeur de la publication : [à compléter]<br />Contact : via la <a href="/contact">page de contact</a></p>
      <h2>Hébergement</h2>
      <p>Application : [à compléter : hébergeur du site, par exemple Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis].</p>
      <p>Base de données et comptes utilisateurs : Supabase, serveurs situés dans l&apos;Union européenne (région Paris).</p>
      <h2>Propriété intellectuelle</h2>
      <p>La marque Edify, le site et ses contenus (textes, visuels, logiciels) sont protégés. Les designs de packaging créés par les utilisateurs leur appartiennent, dans les conditions prévues par les <a href="/cgu">conditions d&apos;utilisation</a>.</p>
    </SitePage>
  );
}
