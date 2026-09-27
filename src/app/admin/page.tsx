import { requireAdminPage } from "@/lib/admin/auth";
import Link from "next/link";
import { dashboardStats, isActive } from "@/lib/admin/data";
import { BarChart, Card, Empty, Kpi, PageHead, PaymentStatus, PlanBadge, PLAN_LABEL, ago, date, money } from "@/components/admin/ui";

export const metadata = { title: "Tableau de bord" };

export default async function AdminDashboard() {
  await requireAdminPage();
  const s = await dashboardStats();
  return (
    <>
      <PageHead
        title="Tableau de bord"
        sub={`Mis à jour ${new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}`}
        actions={<a className="lp-btn lp-btn-ghost" href="/api/admin/export?type=users">Exporter les utilisateurs (CSV)</a>}
      />

      <div className="ad-kpis">
        <Kpi label="Revenu du mois" value={money(s.revenueMonth)} hint={`Total encaissé : ${money(s.revenueTotal)}`} tone="m" />
        <Kpi label="Revenu mensuel récurrent" value={money(s.mrr)} hint="Abonnements en cours, au tarif mensuel" tone="c" />
        <Kpi label="Abonnés actifs" value={s.activeSubscribers} hint={`Conversion : ${(s.conversion * 100).toFixed(1)} % des comptes`} tone="y" />
        <Kpi label="Utilisateurs" value={s.users} hint={`+${s.newUsers7} en 7 j · +${s.newUsers30} en 30 j`} tone="k" />
        <Kpi label="Designs IA (30 j)" value={s.aiDesigns30} hint={s.aiFailures30 ? `${s.aiFailures30} échec(s) moteur` : "Aucun échec"} tone="m" />
        <Kpi label="Projets enregistrés" value={s.projects} tone="c" />
        <Kpi label="Paiements en attente" value={s.pendingPayments} hint={<Link href="/admin/paiements?status=pending">Voir les paiements →</Link>} tone="y" />
        <Kpi label="Messages non lus" value={s.newMessages} hint={<Link href="/admin/messages">Ouvrir la boîte →</Link>} tone="k" />
      </div>

      <div className="ad-grid-2">
        <Card title="Revenus encaissés">
          <BarChart data={s.revenueChart} format={money} tone="m" />
        </Card>
        <Card title="Nouvelles inscriptions">
          <BarChart data={s.signupsChart} tone="c" />
        </Card>
      </div>

      <div className="ad-grid-3">
        <Card title="Abonnés par plan">
          <ul className="ad-split">
            {Object.entries(s.byPlan).map(([plan, n]) => (
              <li key={plan}>
                <span>{PLAN_LABEL[plan]}</span>
                <i style={{ width: `${s.activeSubscribers ? (n / s.activeSubscribers) * 100 : 0}%` }} className={`is-${plan}`} />
                <strong>{n}</strong>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Designs IA par jour">
          <BarChart data={s.aiChart} tone="y" />
        </Card>
        <Card title="Abonnements qui expirent sous 7 jours" action={<Link href="/admin/utilisateurs?status=active">Tous</Link>}>
          {s.expiringSoon.length ? (
            <ul className="ad-list">
              {s.expiringSoon.map((u) => (
                <li key={u.id}>
                  <Link href={`/admin/utilisateurs/${u.id}`}>{u.email}</Link>
                  <span>{PLAN_LABEL[u.plan]} · {date(u.plan_expires_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aucun abonnement n&apos;expire cette semaine.</Empty>
          )}
        </Card>
      </div>

      <div className="ad-grid-2">
        <Card title="Derniers paiements" action={<Link href="/admin/paiements">Tous les paiements</Link>}>
          {s.recentPayments.length ? (
            <div className="ad-table-wrap">
              <table className="ad-table">
                <tbody>
                  {s.recentPayments.map((p) => (
                    <tr key={p.id}>
                      <td><Link href={`/admin/utilisateurs/${p.user_id}`}>{p.email ?? "—"}</Link><small>{PLAN_LABEL[p.plan]} · {p.months} mois</small></td>
                      <td className="is-num">{money(p.amount)}</td>
                      <td><PaymentStatus status={p.status} /></td>
                      <td className="is-muted">{ago(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Aucun paiement pour l&apos;instant.</Empty>
          )}
        </Card>
        <Card title="Dernières inscriptions" action={<Link href="/admin/utilisateurs">Tous les utilisateurs</Link>}>
          <div className="ad-table-wrap">
            <table className="ad-table">
              <tbody>
                {s.recentUsers.map((u) => (
                  <tr key={u.id}>
                    <td><Link href={`/admin/utilisateurs/${u.id}`}>{u.email}</Link><small>{u.full_name || "—"}</small></td>
                    <td><PlanBadge plan={u.plan} active={isActive(u)} /></td>
                    <td className="is-muted">{ago(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
