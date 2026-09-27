// Building blocks of the admin board (server-compatible: no hooks).
import React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const money = (n: number) => `${new Intl.NumberFormat("fr-FR").format(n).replace(/ | /g, " ")} FCFA`;
export const date = (d: string | null | undefined, withTime = false) =>
  d ? new Date(d).toLocaleString("fr-FR", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }) : "—";
export const ago = (d: string | null | undefined) => {
  if (!d) return "—";
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 30) return `il y a ${Math.floor(s / 86400)} j`;
  return date(d);
};

export const PLAN_LABEL: Record<string, string> = { none: "Aucun", essentiel: "Essentiel", pro: "Pro", entreprise: "Entreprise" };

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="ad-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="ad-head-actions">{actions}</div>}
    </div>
  );
}

export function Kpi({ label, value, hint, tone = "k" }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "m" | "c" | "y" | "k" | "g" }) {
  return (
    <div className={`ad-kpi is-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function Card({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`ad-card ${className}`}>
      {(title || action) && (
        <header>
          {title && <h2>{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** Minimal SVG bar chart (30 days). */
export function BarChart({ data, format = (v: number) => String(v), tone = "m" }: { data: { day: string; value: number }[]; format?: (v: number) => string; tone?: "m" | "c" | "y" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  const w = 600, h = 150, gap = 3;
  const bw = (w - gap * (data.length - 1)) / data.length;
  return (
    <figure className="ad-chart">
      <figcaption>
        Total 30 jours : <strong>{format(total)}</strong>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h + 18}`} role="img" aria-label={`Total sur 30 jours : ${format(total)}`}>
        {data.map((d, i) => {
          const bh = d.value ? Math.max(3, (d.value / max) * h) : 2;
          return (
            <g key={d.day}>
              <rect x={i * (bw + gap)} y={h - bh} width={bw} height={bh} rx={2.5} className={d.value ? `is-${tone}` : "is-empty"}>
                <title>{`${new Date(d.day).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} : ${format(d.value)}`}</title>
              </rect>
              {(i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)) && (
                <text x={i * (bw + gap) + bw / 2} y={h + 14} textAnchor="middle">
                  {new Date(d.day).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export function Badge({ children, tone = "grey" }: { children: React.ReactNode; tone?: "grey" | "green" | "amber" | "red" | "m" | "c" | "y" | "k" }) {
  return <span className={`ad-badge is-${tone}`}>{children}</span>;
}

export function PaymentStatus({ status }: { status: string }) {
  const map: Record<string, [string, "green" | "amber" | "red" | "grey"]> = {
    paid: ["Payé", "green"],
    pending: ["En attente", "amber"],
    failed: ["Échoué", "red"],
    cancelled: ["Annulé", "grey"],
    refunded: ["Remboursé", "red"],
  };
  const [label, tone] = map[status] ?? [status, "grey"];
  return <Badge tone={tone}>{label}</Badge>;
}

export function PlanBadge({ plan, active }: { plan: string; active: boolean }) {
  if (!active || plan === "none") return <Badge tone="grey">{plan === "none" || !plan ? "Sans abonnement" : `${PLAN_LABEL[plan] ?? plan} · expiré`}</Badge>;
  return <Badge tone={plan === "entreprise" ? "k" : plan === "pro" ? "m" : "c"}>{PLAN_LABEL[plan] ?? plan}</Badge>;
}

export function Pager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="ad-pager" aria-label="Pagination">
      {page > 1 ? <Link href={href(page - 1)}><ChevronLeft className="w-4 h-4" /> Précédent</Link> : <span />}
      <span>
        Page {page} / {pages}
      </span>
      {page < pages ? <Link href={href(page + 1)}>Suivant <ChevronRight className="w-4 h-4" /></Link> : <span />}
    </nav>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="ad-empty">{children}</p>;
}

/** GET filter bar (works without JavaScript). */
export function Filters({ children }: { children: React.ReactNode }) {
  return (
    <form className="ad-filters" method="get">
      {children}
      <button type="submit" className="lp-btn lp-btn-ink">Filtrer</button>
    </form>
  );
}
