import Link from "next/link";
import { listMessages } from "@/lib/admin/data";
import { Badge, Card, Empty, PageHead, date } from "@/components/admin/ui";
import { MessageActions } from "@/components/admin/actions";

export const metadata = { title: "Messages" };

const TABS = [
  ["new", "Non lus"],
  ["handled", "Traités"],
  ["archived", "Archivés"],
  ["all", "Tous"],
] as const;

export default async function MessagesPage({ searchParams }: { searchParams: { status?: string } }) {
  const status = searchParams.status ?? "new";
  const res = await listMessages(status);
  return (
    <>
      <PageHead title="Messages" sub="Formulaire de contact du site." actions={<a className="lp-btn lp-btn-ghost" href="/api/admin/export?type=messages">Exporter (CSV)</a>} />
      <nav className="ad-tabs" aria-label="Filtrer les messages">
        {TABS.map(([id, label]) => (
          <Link key={id} href={`/admin/messages?status=${id}`} className={status === id ? "is-active" : ""}>
            {label} <em>{res.counts[id]}</em>
          </Link>
        ))}
      </nav>
      {res.rows.length ? (
        <div className="ad-stack">
          {res.rows.map((m) => (
            <Card key={m.id} className={`ad-message ${m.status === "new" ? "is-new" : ""}`}>
              <div className="ad-message-head">
                <div>
                  <strong>{m.name}</strong> <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`}>{m.email}</a>
                  <small>{date(m.created_at, true)}</small>
                </div>
                <Badge tone={m.subject === "Offre entreprise" ? "m" : m.subject === "Signaler un problème" ? "red" : "c"}>{m.subject}</Badge>
              </div>
              <p className="ad-message-body">{m.message}</p>
              <div className="ad-message-foot">
                <a className="lp-btn lp-btn-ink" href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`}>Répondre par e-mail</a>
                <MessageActions id={m.id} status={m.status} />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Empty>Aucun message dans cette catégorie.</Empty>
        </Card>
      )}
    </>
  );
}
