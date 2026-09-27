"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { useLang } from "@/components/i18n/LangProvider";
import { LangToggle, ThemeToggle } from "@/components/i18n/SiteToggles";
import { PERIODS, PLANS, priceFor, creditsFor, type Months, type PlanId } from "@/lib/billing/plans";
import { landingCopy } from "@/components/landing/copy";
import { createClient } from "@/lib/supabase/client";

const fmt = (n: number, lang: "fr" | "en") => n.toLocaleString(lang === "fr" ? "fr-FR" : "en-US").replace(/ | /g, lang === "fr" ? " " : ",");

const COPY = {
  fr: {
    back: "Retour",
    title: "Choisissez votre abonnement",
    sub: "Paiement unique par Mobile Money pour la durée choisie. Aucun prélèvement automatique : vous rechargez quand vous voulez.",
    current: (plan: string, date: string, credits: number) => `Plan actuel : ${plan}, actif jusqu'au ${date} · ${credits} créations IA restantes.`,
    none: "Vous n'avez pas encore d'abonnement actif.",
    duration: "Durée",
    months: (m: number) => (m === 1 ? "1 mois" : `${m} mois`),
    save: (p: number) => `−${p} %`,
    total: "Total à payer",
    includes: (c: number) => `${c} créations IA incluses sur la période`,
    pay: "Payer avec Mobile Money",
    paying: "Redirection vers le paiement…",
    secure: "Paiement sécurisé par SasPay. Vous choisirez MTN MoMo ou Orange Money puis confirmerez sur votre téléphone.",
    unavailable: "Le paiement Mobile Money s'active très bientôt. Écrivez-nous depuis la page Contact pour activer votre abonnement dès maintenant.",
    error: "Le paiement n'a pas pu démarrer. Réessayez dans un instant.",
    perMonth: "/ mois",
    choose: "Choisir",
    chosen: "Sélectionné",
  },
  en: {
    back: "Back",
    title: "Choose your plan",
    sub: "One-off Mobile Money payment for the period you choose. No automatic debit: top up whenever you like.",
    current: (plan: string, date: string, credits: number) => `Current plan: ${plan}, active until ${date} · ${credits} AI designs left.`,
    none: "You don't have an active plan yet.",
    duration: "Duration",
    months: (m: number) => (m === 1 ? "1 month" : `${m} months`),
    save: (p: number) => `−${p}%`,
    total: "Total to pay",
    includes: (c: number) => `${c} AI designs included for the period`,
    pay: "Pay with Mobile Money",
    paying: "Redirecting to payment…",
    secure: "Secure payment by SasPay. You'll pick MTN MoMo or Orange Money, then confirm on your phone.",
    unavailable: "Mobile Money payment is being switched on very soon. Message us from the Contact page to activate your plan right now.",
    error: "The payment couldn't start. Please try again in a moment.",
    perMonth: "/ month",
    choose: "Choose",
    chosen: "Selected",
  },
};

export function BillingPage({ initialPlan }: { initialPlan: PlanId }) {
  const { lang } = useLang();
  const t = COPY[lang];
  const plansText = landingCopy(lang).pricing.plans;
  const [plan, setPlan] = useState<PlanId>(initialPlan);
  const [months, setMonths] = useState<Months>(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ plan: string; plan_expires_at: string | null; credits: number } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase.from("profiles").select("plan, plan_expires_at, credits").eq("id", auth.user.id).single();
      if (data) setProfile(data);
    })().catch(() => {});
  }, []);

  const active = profile?.plan_expires_at && new Date(profile.plan_expires_at) > new Date();
  const total = priceFor(plan, months);
  const full = PLANS[plan].monthly * months;

  const pay = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, months }) });
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(`/abonnement?plan=${plan}`)}`;
        return;
      }
      const json = await res.json();
      if (res.ok && json.url) {
        window.location.href = json.url;
        return;
      }
      setMessage(res.status === 503 ? t.unavailable : t.error);
    } catch {
      setMessage(t.error);
    }
    setBusy(false);
  };

  return (
    <div className="lp bl">
      <header className="sw-top">
        <a href="/" className="lp-logo" aria-label="Edify">
          <span className="lp-logo-badge">E</span>
          <span>Edify</span>
        </a>
        <div className="sw-top-right">
          <LangToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="bl-main lp-wrap">
        <button type="button" className="bl-back" onClick={() => (history.length > 1 ? history.back() : (window.location.href = "/"))}>
          <ArrowLeft className="w-4 h-4" /> {t.back}
        </button>
        <h1 className="lp-h2">{t.title}</h1>
        <p className="lp-sub">{t.sub}</p>
        <p className={`bl-status ${active ? "is-active" : ""}`}>
          {active && profile
            ? t.current(
                plansText.find((p) => p.id === profile.plan)?.name ?? profile.plan,
                new Date(profile.plan_expires_at!).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB"),
                profile.credits
              )
            : t.none}
        </p>

        <div className="bl-grid">
          <div className="bl-plans" role="radiogroup" aria-label={t.title}>
            {plansText.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={plan === p.id} className={`bl-plan ${plan === p.id ? "is-on" : ""}`} onClick={() => setPlan(p.id)}>
                <span className="bl-plan-head">
                  <strong>{p.name}</strong>
                  {p.featured && <em>{landingCopy(lang).pricing.badge}</em>}
                  <span className="bl-radio" aria-hidden="true">{plan === p.id && <Check className="w-4 h-4" />}</span>
                </span>
                <span className="bl-plan-price">{p.price} <small>{t.perMonth}</small></span>
                <span className="bl-plan-desc">{p.desc}</span>
                <ul>
                  {p.features.slice(0, 4).map((f) => <li key={f}>{f}</li>)}
                </ul>
              </button>
            ))}
          </div>

          <aside className="bl-summary">
            <p className="bl-label">{t.duration}</p>
            <div className="bl-periods" role="radiogroup" aria-label={t.duration}>
              {PERIODS.map((p) => (
                <button key={p.months} type="button" role="radio" aria-checked={months === p.months} className={months === p.months ? "is-on" : ""} onClick={() => setMonths(p.months)}>
                  {t.months(p.months)}
                  {p.discount > 0 && <small>{t.save(Math.round(p.discount * 100))}</small>}
                </button>
              ))}
            </div>
            <div className="bl-total">
              <span>{t.total}</span>
              <strong>{fmt(total, lang)} FCFA</strong>
              {full !== total && <s>{fmt(full, lang)} FCFA</s>}
            </div>
            <p className="bl-includes">{t.includes(creditsFor(plan, months))}</p>
            <button type="button" className="lp-btn lp-btn-magenta lp-btn-xl bl-pay" onClick={pay} disabled={busy}>
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Smartphone className="w-5 h-5" />}
              {busy ? t.paying : t.pay}
            </button>
            <p className="bl-momo">
              <span className="lp-momo"><i className="is-mtn">MTN MoMo</i><i className="is-orange">Orange Money</i></span>
            </p>
            <p className="bl-secure"><ShieldCheck className="w-4 h-4" /> {t.secure}</p>
            {message && <p className="bl-message" role="alert">{message}</p>}
          </aside>
        </div>
      </main>
    </div>
  );
}
