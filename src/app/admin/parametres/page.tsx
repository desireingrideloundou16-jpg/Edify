import Link from "next/link";
import { getSettings, listAdmins, systemStatus } from "@/lib/admin/data";
import { Card, PageHead, money } from "@/components/admin/ui";
import { AnnouncementForm } from "@/components/admin/actions";
import { PERIODS, PLANS, priceFor, type PlanId } from "@/lib/billing/plans";

export const metadata = { title: "Paramètres" };

const NAMES: Record<PlanId, string> = { essentiel: "Essentiel", pro: "Pro", entreprise: "Entreprise" };

export default async function SettingsPage() {
  const [settings, admins] = await Promise.all([getSettings(), listAdmins()]);
  const status = systemStatus();
  return (
    <>
      <PageHead title="Paramètres" sub="Configuration du site, offres et accès." />
      <div className="ad-grid-2">
        <Card title="Bandeau d'annonce">
          <AnnouncementForm initial={settings.announcement} />
        </Card>
        <Card title="État des services">
          <ul className="ad-status">
            {status.map((e) => (
              <li key={e.key} className={e.ok ? "is-ok" : "is-off"}>
                <strong>{e.key}</strong>
                <span>{e.detail}</span>
                <em>{e.ok ? "Configuré" : "À configurer"}</em>
              </li>
            ))}
          </ul>
          <p className="ad-note">Les clés se renseignent dans <code>.env.local</code> (et dans les variables d&apos;environnement de l&apos;hébergeur en production). Elles ne sont jamais affichées ici.</p>
        </Card>
      </div>
      <div className="ad-grid-2">
        <Card title="Offres et tarifs">
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr><th>Plan</th>{PERIODS.map((p) => <th key={p.months} className="is-num">{p.months} mois</th>)}<th className="is-num">IA / mois</th></tr>
              </thead>
              <tbody>
                {(Object.keys(PLANS) as PlanId[]).map((id) => (
                  <tr key={id}>
                    <td><strong>{NAMES[id]}</strong></td>
                    {PERIODS.map((p) => <td key={p.months} className="is-num">{money(priceFor(id, p.months))}</td>)}
                    <td className="is-num">{PLANS[id].credits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ad-note">Les prix se modifient dans <code>src/lib/billing/plans.ts</code> (le montant payé est toujours recalculé côté serveur).</p>
        </Card>
        <Card title="Administrateurs">
          <ul className="ad-list">
            {admins.map((a) => (
              <li key={a.id}>
                <Link href={`/admin/utilisateurs/${a.id}`}>{a.email}</Link>
                <span>{a.full_name || "—"}</span>
              </li>
            ))}
          </ul>
          <p className="ad-note">Pour nommer un administrateur, ouvrez sa fiche dans Utilisateurs puis « Nommer administrateur ».</p>
        </Card>
      </div>
    </>
  );
}
