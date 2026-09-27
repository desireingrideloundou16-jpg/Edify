import { requireAdminPage } from "@/lib/admin/auth";
import Link from "next/link";
import { listProjects } from "@/lib/admin/data";
import { Card, Empty, Filters, PageHead, Pager, ago, date } from "@/components/admin/ui";
import { ALL_CATALOG_SHAPES } from "@/lib/catalog/shapes";
import { ALL_CATALOG_STYLES } from "@/lib/catalog/styles";

export const metadata = { title: "Projets" };

export default async function ProjectsPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const searchParams = await searchParamsPromise;
  await requireAdminPage();
  const q = searchParams.q ?? "";
  const res = await listProjects({ q, page: Number(searchParams.page) || 1 });
  return (
    <>
      <PageHead title="Projets" sub={`${res.total} packaging${res.total > 1 ? "s" : ""} enregistré${res.total > 1 ? "s" : ""} par vos utilisateurs`} />
      <Card>
        <Filters>
          <input name="q" defaultValue={q} placeholder="Nom du projet" aria-label="Recherche" />
        </Filters>
        {res.rows.length ? (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Projet</th>
                  <th>Contenant</th>
                  <th>Style</th>
                  <th>Propriétaire</th>
                  <th>Créé</th>
                  <th>Modifié</th>
                </tr>
              </thead>
              <tbody>
                {res.rows.map((p) => {
                  const d = p.data as { shapeId?: string; styleId?: string; customPalette?: string[] | null; content?: { brandName?: string; productName?: string } };
                  const shape = ALL_CATALOG_SHAPES.find((s) => s.id === d?.shapeId);
                  const style = ALL_CATALOG_STYLES.find((s) => s.id === d?.styleId);
                  const palette = d?.customPalette ?? style?.palette ?? [];
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <small>{[d?.content?.brandName, d?.content?.productName].filter(Boolean).join(" · ") || "—"}</small>
                      </td>
                      <td>{shape?.name ?? d?.shapeId ?? "—"}</td>
                      <td>
                        <span className="ad-swatches">{palette.slice(0, 4).map((c) => <i key={c} style={{ background: c }} />)}</span>
                        <small>{style?.label ?? style?.name ?? "—"}</small>
                      </td>
                      <td><Link href={`/admin/utilisateurs/${p.user_id}`}>{p.email ?? "—"}</Link></td>
                      <td className="is-muted">{date(p.created_at)}</td>
                      <td className="is-muted">{ago(p.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Aucun projet.</Empty>
        )}
        <Pager page={res.page} pages={res.pages} href={(n) => `/admin/projets?q=${encodeURIComponent(q)}&page=${n}`} />
      </Card>
    </>
  );
}
