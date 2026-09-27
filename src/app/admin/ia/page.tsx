import { requireAdminPage } from "@/lib/admin/auth";
import { aiStats, systemStatus } from "@/lib/admin/data";
import { BarChart, Card, Empty, Kpi, PageHead } from "@/components/admin/ui";

export const metadata = { title: "Intelligence artificielle" };

const KIND: Record<string, string> = { design: "Designs de packaging", suggest: "Suggestions du parcours", image: "Décors photo" };
const ENGINE: Record<string, string> = { claude: "Claude (Anthropic)", gemini: "Gemini (Google)", local: "Mode hors ligne", cloudflare: "Cloudflare Workers AI" };

export default async function AiPage() {
  await requireAdminPage();
  const s = await aiStats();
  const status = systemStatus();
  const engines = status.filter((x) => ["Gemini", "Claude (Anthropic)", "Cloudflare Workers AI"].includes(x.key));
  return (
    <>
      <PageHead title="Intelligence artificielle" sub="Usage des moteurs IA sur les 30 derniers jours." />
      <div className="ad-kpis">
        <Kpi label="Designs aujourd'hui" value={s.today} tone="m" hint="Offre gratuite Gemini : environ 20 par jour sur le modèle principal" />
        <Kpi label="Designs (30 j)" value={s.designs30} tone="c" />
        <Kpi label="Suggestions (30 j)" value={s.suggest30} tone="y" />
        <Kpi label="Échecs moteur (30 j)" value={s.failures30} tone="k" hint="Un échec bascule sur le moteur suivant" />
      </div>
      <div className="ad-grid-2">
        <Card title="Designs par jour">
          <BarChart data={s.chart} tone="m" />
        </Card>
        <Card title="Moteurs configurés">
          <ul className="ad-status">
            {engines.map((e) => (
              <li key={e.key} className={e.ok ? "is-ok" : "is-off"}>
                <strong>{e.key}</strong>
                <span>{e.detail}</span>
                <em>{e.ok ? "Actif" : "Non configuré"}</em>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="ad-grid-2">
        <Card title="Par type d'usage">
          {s.byKind.length ? (
            <table className="ad-table">
              <thead><tr><th>Usage</th><th className="is-num">Réussis</th><th className="is-num">Échecs</th></tr></thead>
              <tbody>
                {s.byKind.map(([k, v]) => (
                  <tr key={k}><td>{KIND[k] ?? k}</td><td className="is-num">{v.ok}</td><td className="is-num">{v.fail}</td></tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>Aucun usage enregistré pour l&apos;instant.</Empty>
          )}
        </Card>
        <Card title="Par moteur">
          {s.byEngine.length ? (
            <table className="ad-table">
              <thead><tr><th>Moteur</th><th className="is-num">Réussis</th><th className="is-num">Échecs</th></tr></thead>
              <tbody>
                {s.byEngine.map(([k, v]) => (
                  <tr key={k}><td>{ENGINE[k] ?? k}</td><td className="is-num">{v.ok}</td><td className="is-num">{v.fail}</td></tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>Aucun usage enregistré pour l&apos;instant.</Empty>
          )}
        </Card>
      </div>
    </>
  );
}
