import { requireAdminPage } from "@/lib/admin/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { isActive, userDetail } from "@/lib/admin/data";
import { getAdmin } from "@/lib/admin/auth";
import { Badge, Card, Empty, Kpi, PageHead, PaymentStatus, PlanBadge, PLAN_LABEL, ago, date, money } from "@/components/admin/ui";
import { UserActions } from "@/components/admin/actions";

export const metadata = { title: "Fiche utilisateur" };

export default async function UserPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  await requireAdminPage();
  const [d, admin] = await Promise.all([userDetail(params.id), getAdmin()]);
  if (!d) notFound();
  const p = d.profile;
  const paid = d.payments.filter((x) => x.status === "paid");
  const designs = d.ai.filter((e) => e.kind === "design" && e.success).length;

  return (
    <>
      <Link href="/admin/utilisateurs" className="ad-back"><ArrowLeft className="w-4 h-4" /> Utilisateurs</Link>
      <PageHead
        title={p.full_name || p.email || "Utilisateur"}
        sub={`${p.email ?? ""} · inscrit le ${date(p.created_at)} · connexion ${d.provider === "google" ? "Google" : "e-mail"}${d.confirmed ? "" : " (e-mail non confirmé)"}`}
        actions={
          <>
            <PlanBadge plan={p.plan} active={isActive(p)} />
            {p.role === "admin" && <Badge tone="k">Admin</Badge>}
            {p.suspended && <Badge tone="red">Suspendu</Badge>}
          </>
        }
      />

      <div className="ad-kpis">
        <Kpi label="Abonnement" value={isActive(p) ? PLAN_LABEL[p.plan] : "Aucun"} hint={isActive(p) ? `jusqu'au ${date(p.plan_expires_at)}` : p.plan_expires_at ? `expiré le ${date(p.plan_expires_at)}` : "jamais abonné"} tone="m" />
        <Kpi label="Packagings restants" value={p.credits} tone="c" />
        <Kpi label="Total payé" value={money(paid.reduce((s, x) => s + x.amount, 0))} hint={`${paid.length} paiement(s)`} tone="y" />
        <Kpi label="Designs IA générés" value={designs} hint={`Dernière connexion : ${ago(d.lastSignIn)}`} tone="k" />
      </div>

      <div className="ad-grid-2 is-wide-left">
        <div className="ad-stack">
          <Card title="Paiements">
            {d.payments.length ? (
              <div className="ad-table-wrap">
                <table className="ad-table">
                  <thead>
                    <tr><th>Date</th><th>Plan</th><th className="is-num">Montant</th><th>Moyen</th><th>Statut</th></tr>
                  </thead>
                  <tbody>
                    {d.payments.map((x) => (
                      <tr key={x.id}>
                        <td className="is-muted">{date(x.created_at, true)}</td>
                        <td>{PLAN_LABEL[x.plan]} · {x.months} mois</td>
                        <td className="is-num">{money(x.amount)}</td>
                        <td className="is-muted">{x.provider === "manual" ? "Manuel" : "SasPay"}</td>
                        <td><PaymentStatus status={x.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Aucun paiement.</Empty>
            )}
          </Card>
          <Card title={`Projets (${d.projects.length})`}>
            {d.projects.length ? (
              <ul className="ad-list">
                {d.projects.map((pr) => {
                  const data = pr.data as { shapeId?: string; content?: { brandName?: string; productName?: string } };
                  return (
                    <li key={pr.id}>
                      <strong>{pr.name}</strong>
                      <span>{[data?.content?.brandName, data?.content?.productName, data?.shapeId].filter(Boolean).join(" · ")} — modifié {ago(pr.updated_at)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>Aucun projet enregistré.</Empty>
            )}
          </Card>
        </div>
        <Card title="Actions">
          <UserActions
            user={{ id: p.id, email: p.email, plan: p.plan, credits: p.credits, plan_expires_at: p.plan_expires_at, suspended: p.suspended, role: p.role }}
            isSelf={admin?.id === p.id}
          />
        </Card>
      </div>
    </>
  );
}
