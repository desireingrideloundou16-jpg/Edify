import { requireAdminPage } from "@/lib/admin/auth";
import { aiStats, aiUsageStats, systemStatus, type AiUsageGroup } from "@/lib/admin/data";
import { BarChart, Card, Empty, Kpi, PageHead, ago } from "@/components/admin/ui";
import { PRICING_SOURCES } from "@/lib/ai/costs";

export const metadata = { title: "Intelligence artificielle" };

const KIND: Record<string, string> = { design: "Designs de packaging", suggest: "Suggestions du parcours", image: "Décors photo" };
const OPERATION: Record<string, string> = {
  "design.generate": "Conception du design",
  "suggest.generate": "Suggestions du parcours",
  "image.illustration": "Illustration du pack",
  "image.scene": "Décor photo (pub)",
  "voice.generate": "Notes vocales",
};
const PROVIDER: Record<string, string> = { gemini: "Google Gemini", claude: "Anthropic Claude", cloudflare: "Cloudflare Workers AI", edify: "Repli Edify (sans IA)" };
const num = (n: number) => n.toLocaleString("fr-FR");
/** Provider success rate (deterministic fallbacks excluded: they are not provider calls). */
const pct = (g: AiUsageGroup) => {
  const provider = g.calls - g.fallbacks;
  return provider ? `${Math.round((g.successes / provider) * 100)} %` : "—";
};

/** Estimated list-price cost: µ$ → $ (4 decimals), plus FCFA when AI_COST_USD_TO_XAF is set. */
function Cost({ micros, xaf }: { micros: number; xaf: number | null }) {
  const usd = micros / 1_000_000;
  return (
    <>
      {usd.toLocaleString("fr-FR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} $
      {xaf ? <small style={{ display: "block", opacity: 0.7 }}>≈ {Math.round(usd * xaf).toLocaleString("fr-FR")} FCFA</small> : null}
    </>
  );
}

function UsageTable({ rows, label, xaf }: { rows: AiUsageGroup[]; label: (k: string) => string; xaf: number | null }) {
  if (!rows.length) return <Empty>Aucun appel enregistré pour l&apos;instant.</Empty>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="ad-table">
        <thead>
          <tr>
            <th>Élément</th>
            <th className="is-num">Appels</th>
            <th className="is-num">Réussite</th>
            <th className="is-num">Replis</th>
            <th className="is-num">Latence moy.</th>
            <th className="is-num">p95</th>
            <th className="is-num">Tokens entrée / sortie</th>
            <th className="is-num">Images</th>
            <th className="is-num">Coût estimé</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.key}>
              <td>{label(g.key)}</td>
              <td className="is-num">{num(g.calls)}</td>
              <td className="is-num">{pct(g)}</td>
              <td className="is-num">{num(g.fallbacks)}</td>
              <td className="is-num">{(g.avgLatencyMs / 1000).toFixed(1)} s</td>
              <td className="is-num">{(g.p95LatencyMs / 1000).toFixed(1)} s</td>
              <td className="is-num">{num(g.inputTokens)} / {num(g.outputTokens)}</td>
              <td className="is-num">{num(g.images)}</td>
              <td className="is-num">
                <Cost micros={g.costMicros} xaf={xaf} />
                {g.unpriced ? <small style={{ display: "block", opacity: 0.7 }}>+ {g.unpriced} sans tarif</small> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ENGINE: Record<string, string> = { claude: "Claude (Anthropic)", gemini: "Gemini (Google)", local: "Mode hors ligne", cloudflare: "Cloudflare Workers AI" };

export default async function AiPage() {
  await requireAdminPage();
  const [s, u] = await Promise.all([aiStats(), aiUsageStats()]);
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
      <PageHead
        title="AI Usage — observabilité des appels IA"
        sub="Chaque appel à un fournisseur (tentatives et replis compris). Coûts estimés au tarif public documenté, hors offres gratuites : jamais une donnée comptable."
      />
      {!u.ready ? (
        <Card><Empty>La table ai_usage n&apos;est pas encore disponible.</Empty></Card>
      ) : (
        <>
          <div className="ad-kpis">
            <Kpi label="Opérations IA (30 j)" value={num(u.month?.calls ?? 0)} tone="m" hint={u.month ? `${num(u.month.successes)} réussies · ${num(u.month.errors)} échouées · ${num(u.month.fallbacks)} replis` : undefined} />
            <Kpi label="Taux de réussite (30 j)" value={u.month ? pct(u.month) : "—"} tone="c" hint={u.month ? `Latence moyenne ${(u.month.avgLatencyMs / 1000).toFixed(1)} s` : undefined} />
            <Kpi label="Coût estimé (30 j)" value={<Cost micros={u.month?.costMicros ?? 0} xaf={u.usdToXaf} />} tone="y" hint={u.month?.unpriced ? `${u.month.unpriced} appel(s) sans tarif documenté` : "Tous les appels réussis ont un tarif documenté"} />
            <Kpi label="Tokens et images (30 j)" value={num((u.month?.inputTokens ?? 0) + (u.month?.outputTokens ?? 0))} tone="k" hint={`${num(u.month?.images ?? 0)} image(s) générée(s)`} />
          </div>
          <div className="ad-kpis is-3">
            <Kpi label="Coût estimé (24 h)" value={<Cost micros={u.day?.costMicros ?? 0} xaf={u.usdToXaf} />} tone="m" hint={`${num(u.day?.calls ?? 0)} opération(s)`} />
            <Kpi label="Coût estimé (7 j)" value={<Cost micros={u.week?.costMicros ?? 0} xaf={u.usdToXaf} />} tone="c" hint={`${num(u.week?.calls ?? 0)} opération(s)`} />
            <Kpi label="Coût estimé (30 j)" value={<Cost micros={u.month?.costMicros ?? 0} xaf={u.usdToXaf} />} tone="y" hint={`${num(u.month?.calls ?? 0)} opération(s)`} />
          </div>
          <Card title="Par opération — classées par coût (30 j)">
            <UsageTable rows={u.byOperation} label={(k) => OPERATION[k] ?? k} xaf={u.usdToXaf} />
          </Card>
          <Card title="Par fournisseur (30 j)">
            <UsageTable rows={u.byProvider} label={(k) => PROVIDER[k] ?? k} xaf={u.usdToXaf} />
          </Card>
          <Card title="Par modèle réel (30 j)">
            <UsageTable rows={u.byModel} label={(k) => k} xaf={u.usdToXaf} />
          </Card>
          <Card title="Dernières erreurs">
            {u.recentErrors.length ? (
              <div style={{ overflowX: "auto" }}>
                <table className="ad-table">
                  <thead>
                    <tr><th>Quand</th><th>Opération</th><th>Modèle</th><th>Statut</th><th>Code</th><th>Message</th></tr>
                  </thead>
                  <tbody>
                    {u.recentErrors.map((e, i) => (
                      <tr key={i}>
                        <td>{ago(e.created_at)}</td>
                        <td>{OPERATION[e.operation] ?? e.operation}</td>
                        <td>{e.provider} · {e.model ?? "?"}</td>
                        <td>{e.status}</td>
                        <td>{e.error_code ?? "—"}</td>
                        <td>{e.error_message ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Aucune erreur sur les 30 derniers jours.</Empty>
            )}
          </Card>
          <p className="ad-note">
            Tarifs relevés le {PRICING_SOURCES.gemini.checkedAt} :{" "}
            <a href={PRICING_SOURCES.gemini.url} target="_blank" rel="noreferrer">Gemini</a> et{" "}
            <a href={PRICING_SOURCES.cloudflare.url} target="_blank" rel="noreferrer">Cloudflare Workers AI</a>. Les alias « latest » sont chiffrés
            d&apos;après le modèle réellement renvoyé par le fournisseur. « Replis » = le client a reçu le résultat déterministe d&apos;Edify
            (sans appel payant).{u.usdToXaf ? ` Conversion FCFA au taux configuré (AI_COST_USD_TO_XAF = ${u.usdToXaf}).` : " Pour afficher les montants en FCFA, définir AI_COST_USD_TO_XAF."}
          </p>
        </>
      )}
    </>
  );
}
