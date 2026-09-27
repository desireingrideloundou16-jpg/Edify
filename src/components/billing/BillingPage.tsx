"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { useCopy, useLang } from "@/components/i18n/LangProvider";
import { LangToggle, ThemeToggle } from "@/components/i18n/SiteToggles";
import { PERIODS, PLANS, priceFor, creditsFor, type Months, type PlanId } from "@/lib/billing/plans";
import { landingCopy } from "@/components/landing/copy";
import { fcfa, fmt, LOCALES } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/client";

export function BillingPage({ initialPlan }: { initialPlan: PlanId }) {
  const { lang, messages } = useLang();
  const t = useCopy("billing");
  const pricing = useMemo(() => landingCopy(lang, messages).pricing, [lang, messages]);
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
            ? fmt(t.current, {
                plan: pricing.plans.find((p) => p.id === profile.plan)?.name ?? profile.plan,
                date: new Date(profile.plan_expires_at!).toLocaleDateString(LOCALES[lang]),
                credits: profile.credits,
              })
            : t.none}
        </p>

        <div className="bl-grid">
          <div className="bl-plans" role="radiogroup" aria-label={t.title}>
            {pricing.plans.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={plan === p.id} className={`bl-plan ${plan === p.id ? "is-on" : ""}`} onClick={() => setPlan(p.id)}>
                <span className="bl-plan-head">
                  <strong>{p.name}</strong>
                  {p.featured && <em>{pricing.badge}</em>}
                  <span className="bl-radio" aria-hidden="true">{plan === p.id && <Check className="w-4 h-4" />}</span>
                </span>
                <span className="bl-plan-price">{p.price} <small>{pricing.perMonth}</small></span>
                <span className="bl-plan-desc">{p.desc}</span>
                <ul>
                  {p.features.map((f) => <li key={f}>{f}</li>)}
                </ul>
              </button>
            ))}
          </div>

          <aside className="bl-summary">
            <p className="bl-label">{t.duration}</p>
            <div className="bl-periods" role="radiogroup" aria-label={t.duration}>
              {PERIODS.map((p) => (
                <button key={p.months} type="button" role="radio" aria-checked={months === p.months} className={months === p.months ? "is-on" : ""} onClick={() => setMonths(p.months)}>
                  {p.months === 1 ? t.month : fmt(t.months, { n: p.months })}
                  {p.discount > 0 && <small>{fmt(t.save, { p: Math.round(p.discount * 100) })}</small>}
                </button>
              ))}
            </div>
            <div className="bl-total">
              <span>{t.total}</span>
              <strong>{fcfa(total, lang)}</strong>
              {full !== total && <s>{fcfa(full, lang)}</s>}
            </div>
            <p className="bl-includes">{fmt(t.includes, { credits: creditsFor(plan, months) })}</p>
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
