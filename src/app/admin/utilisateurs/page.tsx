import { requireAdminPage } from "@/lib/admin/auth";
import Link from "next/link";
import { isActive, listUsers } from "@/lib/admin/data";
import { Badge, Card, Empty, Filters, PageHead, Pager, PlanBadge, ago, date } from "@/components/admin/ui";

export const metadata = { title: "Utilisateurs" };

export default async function UsersPage({ searchParams }: { searchParams: { q?: string; plan?: string; status?: string; page?: string } }) {
  await requireAdminPage();
  const { q = "", plan = "all", status = "all" } = searchParams;
  const res = await listUsers({ q, plan, status, page: Number(searchParams.page) || 1 });
  const qs = (p: number) => `/admin/utilisateurs?${new URLSearchParams({ q, plan, status, page: String(p) })}`;

  return (
    <>
      <PageHead title="Utilisateurs" sub={`${res.total} compte${res.total > 1 ? "s" : ""}`} actions={<a className="lp-btn lp-btn-ghost" href="/api/admin/export?type=users">Exporter (CSV)</a>} />
      <Card>
        <Filters>
          <input name="q" defaultValue={q} placeholder="Rechercher un e-mail ou un nom" aria-label="Recherche" />
          <select name="plan" defaultValue={plan} aria-label="Plan">
            <option value="all">Tous les plans</option>
            <option value="none">Sans plan</option>
            <option value="essentiel">Essentiel</option>
            <option value="pro">Pro</option>
            <option value="entreprise">Entreprise</option>
          </select>
          <select name="status" defaultValue={status} aria-label="Statut">
            <option value="all">Tous les statuts</option>
            <option value="active">Abonnement actif</option>
            <option value="expired">Abonnement expiré</option>
            <option value="never">Jamais abonné</option>
            <option value="suspended">Suspendus</option>
            <option value="admin">Administrateurs</option>
          </select>
        </Filters>
        {res.rows.length ? (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Abonnement</th>
                  <th>Fin</th>
                  <th className="is-num">Packagings</th>
                  <th>Inscrit</th>
                  <th>Dernière activité IA</th>
                </tr>
              </thead>
              <tbody>
                {res.rows.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/admin/utilisateurs/${u.id}`}>{u.email ?? u.id}</Link>
                      <small>
                        {u.full_name || "—"} {u.role === "admin" && <Badge tone="k">Admin</Badge>} {u.suspended && <Badge tone="red">Suspendu</Badge>}
                      </small>
                    </td>
                    <td><PlanBadge plan={u.plan} active={isActive(u)} /></td>
                    <td className="is-muted">{date(u.plan_expires_at)}</td>
                    <td className="is-num">{u.credits}</td>
                    <td className="is-muted">{date(u.created_at)}</td>
                    <td className="is-muted">{ago(u.last_seen_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Aucun utilisateur ne correspond à ces filtres.</Empty>
        )}
        <Pager page={res.page} pages={res.pages} href={qs} />
      </Card>
    </>
  );
}
