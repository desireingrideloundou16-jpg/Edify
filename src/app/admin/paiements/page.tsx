import Link from "next/link";
import { listPayments } from "@/lib/admin/data";
import { Card, Empty, Filters, Kpi, PageHead, Pager, PaymentStatus, PLAN_LABEL, date, money } from "@/components/admin/ui";
import { PaymentActions } from "@/components/admin/actions";

export const metadata = { title: "Paiements" };

export default async function PaymentsPage({ searchParams }: { searchParams: { status?: string; page?: string } }) {
  const status = searchParams.status ?? "all";
  const res = await listPayments({ status, page: Number(searchParams.page) || 1 });
  return (
    <>
      <PageHead
        title="Paiements"
        sub="Mobile Money via SasPay et paiements enregistrés à la main."
        actions={<a className="lp-btn lp-btn-ghost" href="/api/admin/export?type=payments">Exporter (CSV)</a>}
      />
      <div className="ad-kpis is-3">
        <Kpi label="Encaissé" value={money(res.totals.paid)} tone="m" />
        <Kpi label="En attente" value={money(res.totals.pending)} hint="Clients qui n'ont pas encore confirmé sur leur téléphone" tone="y" />
        <Kpi label="Échoué ou annulé" value={money(res.totals.failed)} tone="k" />
      </div>
      <Card>
        <Filters>
          <select name="status" defaultValue={status} aria-label="Statut">
            <option value="all">Tous les statuts</option>
            <option value="paid">Payés</option>
            <option value="pending">En attente</option>
            <option value="failed">Échoués</option>
            <option value="cancelled">Annulés</option>
          </select>
        </Filters>
        {res.rows.length ? (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Plan</th>
                  <th className="is-num">Montant</th>
                  <th>Moyen</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {res.rows.map((p) => (
                  <tr key={p.id}>
                    <td className="is-muted">{date(p.created_at, true)}</td>
                    <td>
                      <Link href={`/admin/utilisateurs/${p.user_id}`}>{p.owner?.email ?? p.user_id}</Link>
                      {p.session_id && <small title="Référence SasPay">{String(p.session_id).slice(0, 18)}…</small>}
                    </td>
                    <td>{PLAN_LABEL[p.plan]} · {p.months} mois</td>
                    <td className="is-num">{money(p.amount)}</td>
                    <td className="is-muted">{p.provider === "manual" ? "Manuel" : "SasPay"}</td>
                    <td><PaymentStatus status={p.status} /></td>
                    <td><PaymentActions id={p.id} status={p.status} hasSession={!!p.session_id && p.provider !== "manual"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Aucun paiement pour ce filtre.</Empty>
        )}
        <Pager page={res.page} pages={res.pages} href={(n) => `/admin/paiements?status=${status}&page=${n}`} />
      </Card>
    </>
  );
}
