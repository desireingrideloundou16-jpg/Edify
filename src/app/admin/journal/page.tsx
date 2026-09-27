import { auditLog } from "@/lib/admin/data";
import { Card, Empty, PageHead, Pager, date } from "@/components/admin/ui";

export const metadata = { title: "Journal d'activité" };

export default async function AuditPage({ searchParams }: { searchParams: { page?: string } }) {
  const res = await auditLog(Number(searchParams.page) || 1);
  return (
    <>
      <PageHead title="Journal d'activité" sub="Toutes les actions réalisées depuis l'administration." />
      <Card>
        {res.rows.length ? (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr><th>Date</th><th>Administrateur</th><th>Action</th><th>Cible</th><th>Détails</th></tr>
              </thead>
              <tbody>
                {res.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="is-muted">{date(r.created_at, true)}</td>
                    <td>{r.admin_email ?? "—"}</td>
                    <td><strong>{r.action}</strong></td>
                    <td>{r.target ?? "—"}</td>
                    <td className="is-muted ad-json">
                      {Object.entries((r.details ?? {}) as Record<string, unknown>).map(([k, v]) => `${k} : ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Aucune action enregistrée pour l&apos;instant.</Empty>
        )}
        <Pager page={res.page} pages={res.pages} href={(n) => `/admin/journal?page=${n}`} />
      </Card>
    </>
  );
}
