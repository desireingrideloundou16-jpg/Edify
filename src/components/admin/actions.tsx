"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PERIODS, PLANS, priceFor, type PlanId } from "@/lib/billing/plans";

const PLAN_NAMES: Record<PlanId, string> = { essentiel: "Essentiel", pro: "Pro", entreprise: "Entreprise" };

function useAction(url: string) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (key: string, body: Record<string, unknown>, success: string) => {
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setMsg({ ok: true, text: success });
      router.refresh();
      return json;
    } catch (e) {
      setMsg({ ok: false, text: `Échec : ${e instanceof Error ? e.message : "erreur"}` });
      return null;
    } finally {
      setBusy(null);
    }
  };
  return { busy, msg, run, router };
}

const Spin = ({ on }: { on: boolean }) => (on ? <Loader2 className="w-4 h-4 animate-spin" /> : null);

// ─── Users ───────────────────────────────────────────────────────────────────

export function UserActions({ user, isSelf }: { user: { id: string; email: string | null; plan: string; credits: number; plan_expires_at: string | null; suspended: boolean; role: string }; isSelf: boolean }) {
  const { busy, msg, run, router } = useAction(`/api/admin/users/${user.id}`);
  const [plan, setPlan] = useState<PlanId>(user.plan in PLANS ? (user.plan as PlanId) : "pro");
  const [months, setMonths] = useState<1 | 3 | 12>(1);
  const [paid, setPaid] = useState(false);
  const [amount, setAmount] = useState(String(priceFor(plan, months)));
  const [credits, setCredits] = useState(String(user.credits));
  const [expiry, setExpiry] = useState(user.plan_expires_at?.slice(0, 10) ?? "");
  const [confirm, setConfirm] = useState("");

  return (
    <div className="ad-actions">
      <section>
        <h3>Activer ou prolonger un abonnement</h3>
        <p>Pour un client qui a payé autrement (espèces, Mobile Money direct) ou un compte offert.</p>
        <div className="ad-form-row">
          <select value={plan} onChange={(e) => { const p = e.target.value as PlanId; setPlan(p); setAmount(String(priceFor(p, months))); }}>
            {(Object.keys(PLANS) as PlanId[]).map((p) => <option key={p} value={p}>{PLAN_NAMES[p]}</option>)}
          </select>
          <select value={months} onChange={(e) => { const m = Number(e.target.value) as 1 | 3 | 12; setMonths(m); setAmount(String(priceFor(plan, m))); }}>
            {PERIODS.map((p) => <option key={p.months} value={p.months}>{p.months} mois</option>)}
          </select>
        </div>
        <label className="ad-check">
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Paiement reçu (enregistré dans les revenus)
        </label>
        {paid && (
          <label className="ad-field">
            <span>Montant reçu (FCFA)</span>
            <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
          </label>
        )}
        <button type="button" className="lp-btn lp-btn-magenta" disabled={!!busy} onClick={() => run("grant", { action: "grant_plan", plan, months, amount: paid ? Number(amount) : 0 }, "Abonnement activé.")}>
          <Spin on={busy === "grant"} /> {paid ? "Enregistrer le paiement et activer" : "Offrir l'abonnement"}
        </button>
      </section>

      <section>
        <h3>Crédits et échéance</h3>
        <div className="ad-form-row">
          <label className="ad-field">
            <span>Créations IA restantes</span>
            <input inputMode="numeric" value={credits} onChange={(e) => setCredits(e.target.value.replace(/\D/g, ""))} />
          </label>
          <button type="button" className="lp-btn lp-btn-ink" disabled={!!busy} onClick={() => run("credits", { action: "set_credits", credits: Number(credits) }, "Crédits mis à jour.")}>
            <Spin on={busy === "credits"} /> Enregistrer
          </button>
        </div>
        <div className="ad-form-row">
          <label className="ad-field">
            <span>Fin de l&apos;abonnement</span>
            <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </label>
          <button type="button" className="lp-btn lp-btn-ink" disabled={!!busy} onClick={() => run("expiry", { action: "set_expiry", date: expiry || null }, "Échéance mise à jour.")}>
            <Spin on={busy === "expiry"} /> Enregistrer
          </button>
        </div>
      </section>

      {!isSelf && (
        <section>
          <h3>Accès</h3>
          <div className="ad-form-row">
            <button type="button" className="lp-btn lp-btn-ghost" disabled={!!busy} onClick={() => run("suspend", { action: user.suspended ? "unsuspend" : "suspend" }, user.suspended ? "Compte réactivé." : "Compte suspendu.")}>
              <Spin on={busy === "suspend"} /> {user.suspended ? "Réactiver le compte" : "Suspendre le compte"}
            </button>
            <button type="button" className="lp-btn lp-btn-ghost" disabled={!!busy} onClick={() => run("role", { action: user.role === "admin" ? "remove_admin" : "make_admin" }, "Rôle mis à jour.")}>
              <Spin on={busy === "role"} /> {user.role === "admin" ? "Retirer les droits admin" : "Nommer administrateur"}
            </button>
          </div>
        </section>
      )}

      {!isSelf && (
        <section className="ad-danger">
          <h3>Supprimer le compte</h3>
          <p>Supprime définitivement le compte, ses projets et son historique de paiements. Tapez l&apos;e-mail pour confirmer.</p>
          <div className="ad-form-row">
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={user.email ?? ""} aria-label="E-mail de confirmation" />
            <button
              type="button"
              className="lp-btn ad-btn-danger"
              disabled={!!busy || confirm !== user.email}
              onClick={async () => {
                const r = await run("delete", { action: "delete", confirm }, "Compte supprimé.");
                if (r?.deleted) router.push("/admin/utilisateurs");
              }}
            >
              <Spin on={busy === "delete"} /> Supprimer
            </button>
          </div>
        </section>
      )}
      {msg && <p className={`ad-msg ${msg.ok ? "is-ok" : "is-err"}`} role="status">{msg.text}</p>}
    </div>
  );
}

// ─── Payments ────────────────────────────────────────────────────────────────

export function PaymentActions({ id, status, hasSession }: { id: string; status: string; hasSession: boolean }) {
  const { busy, msg, run } = useAction(`/api/admin/payments/${id}`);
  const [confirmPaid, setConfirmPaid] = useState(false);
  if (status === "paid") return null;
  return (
    <div className="ad-row-actions">
      {hasSession && (
        <button type="button" disabled={!!busy} onClick={() => run("verify", { action: "verify" }, "Statut revérifié.")} title="Interroger SasPay">
          <Spin on={busy === "verify"} /> Revérifier
        </button>
      )}
      {confirmPaid ? (
        <button type="button" className="is-strong" disabled={!!busy} onClick={() => run("paid", { action: "mark_paid" }, "Paiement validé.")}>
          <Spin on={busy === "paid"} /> Confirmer : argent reçu
        </button>
      ) : (
        <button type="button" disabled={!!busy} onClick={() => setConfirmPaid(true)}>Valider</button>
      )}
      {status === "pending" && (
        <button type="button" disabled={!!busy} onClick={() => run("cancel", { action: "mark_cancelled" }, "Paiement annulé.")}>Annuler</button>
      )}
      {msg && <small className={msg.ok ? "is-ok" : "is-err"}>{msg.text}</small>}
    </div>
  );
}

// ─── Messages ────────────────────────────────────────────────────────────────

export function MessageActions({ id, status }: { id: string; status: string }) {
  const { busy, run } = useAction(`/api/admin/messages/${id}`);
  return (
    <div className="ad-row-actions">
      {status !== "handled" && <button type="button" disabled={!!busy} onClick={() => run("h", { status: "handled" }, "")}><Spin on={busy === "h"} /> Traité</button>}
      {status !== "new" && <button type="button" disabled={!!busy} onClick={() => run("n", { status: "new" }, "")}><Spin on={busy === "n"} /> Non lu</button>}
      {status !== "archived" && <button type="button" disabled={!!busy} onClick={() => run("a", { status: "archived" }, "")}><Spin on={busy === "a"} /> Archiver</button>}
    </div>
  );
}

// ─── Settings ────────────────────────────────────────────────────────────────

export function AnnouncementForm({ initial }: { initial: { enabled: boolean; text: string; link: string; tone: string } }) {
  const { busy, msg, run } = useAction("/api/admin/settings");
  const [a, setA] = useState(initial);
  return (
    <div className="ad-actions">
      <label className="ad-check">
        <input type="checkbox" checked={a.enabled} onChange={(e) => setA({ ...a, enabled: e.target.checked })} /> Afficher le bandeau en haut du site
      </label>
      <label className="ad-field">
        <span>Message (200 caractères max)</span>
        <input value={a.text} maxLength={200} onChange={(e) => setA({ ...a, text: e.target.value })} placeholder="Ex. −20 % sur l'abonnement annuel jusqu'au 31 octobre" />
      </label>
      <div className="ad-form-row">
        <label className="ad-field">
          <span>Lien (facultatif)</span>
          <input value={a.link} onChange={(e) => setA({ ...a, link: e.target.value })} placeholder="/#tarifs ou https://…" />
        </label>
        <label className="ad-field">
          <span>Style</span>
          <select value={a.tone} onChange={(e) => setA({ ...a, tone: e.target.value })}>
            <option value="info">Information (noir)</option>
            <option value="promo">Promotion (magenta)</option>
            <option value="warning">Alerte (jaune)</option>
          </select>
        </label>
      </div>
      {a.text && (
        <div className={`lp-announce is-${a.tone}`} aria-hidden="true">
          <span>{a.text}</span>
        </div>
      )}
      <button type="button" className="lp-btn lp-btn-magenta" disabled={!!busy} onClick={() => run("s", { announcement: a }, "Bandeau enregistré.")}>
        <Spin on={busy === "s"} /> Enregistrer
      </button>
      {msg && <p className={`ad-msg ${msg.ok ? "is-ok" : "is-err"}`}>{msg.text}</p>}
    </div>
  );
}
