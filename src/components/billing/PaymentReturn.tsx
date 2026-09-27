"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { useCopy, useLang } from "@/components/i18n/LangProvider";
import { fmt, LOCALES } from "@/lib/i18n/config";
import { loadBrief } from "@/lib/design/brief";

type State = "checking" | "paid" | "pending" | "failed" | "cancelled" | "error";


export function PaymentReturn({ paymentId }: { paymentId: string }) {
  const { lang } = useLang();
  const t = useCopy("billing").return;
  const [state, setState] = useState<State>("checking");
  const [info, setInfo] = useState<{ credits: number; until: string } | null>(null);

  useEffect(() => {
    let stop = false;
    let tries = 0;
    const check = async () => {
      tries += 1;
      try {
        const res = await fetch("/api/billing/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId }) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        if (json.profile?.plan_expires_at) {
          setInfo({ credits: json.profile.credits, until: new Date(json.profile.plan_expires_at).toLocaleDateString(LOCALES[lang]) });
        }
        if (json.status === "pending") {
          setState("pending");
          // Mobile Money confirmations can take a minute: keep checking for ~3 minutes.
          if (!stop && tries < 60) setTimeout(check, 3000);
          return;
        }
        setState(json.status);
      } catch {
        if (!stop && tries < 4) setTimeout(check, 3000);
        else setState("error");
      }
    };
    check();
    return () => {
      stop = true;
    };
  }, [paymentId, lang]);

  const hasBrief = typeof window !== "undefined" && !!loadBrief();
  const Icon = state === "paid" ? CheckCircle2 : state === "pending" ? Clock : state === "checking" ? Loader2 : XCircle;
  const [title, text] = t[state];

  return (
    <div className="lp bl">
      <header className="sw-top">
        <a href="/" className="lp-logo" aria-label="Edify">
          <span className="lp-logo-badge">E</span>
          <span>Edify</span>
        </a>
      </header>
      <main className="bl-return">
        <Icon className={`bl-return-icon is-${state} ${state === "checking" ? "animate-spin" : ""}`} />
        <h1 className="lp-h2">{title}</h1>
        <p className="lp-sub">{text}</p>
        {state === "paid" && info && (
          <p className="bl-status is-active">
            {fmt(t.credits, { n: info.credits })} · {fmt(t.until, { date: info.until })}
          </p>
        )}
        {state === "paid" && (
          <a href={hasBrief ? "/create?brief=1" : "/create"} className="lp-btn lp-btn-magenta lp-btn-xl">
            {t.studio}
          </a>
        )}
        {(state === "failed" || state === "cancelled" || state === "error") && (
          <a href="/abonnement" className="lp-btn lp-btn-ink lp-btn-xl">
            {t.retry}
          </a>
        )}
      </main>
    </div>
  );
}
