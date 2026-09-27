"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Loader2, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { useCopy, useLang } from "@/components/i18n/LangProvider";
import { fmt, LOCALES, type Lang } from "@/lib/i18n/config";
import { LangToggle, ThemeToggle } from "@/components/i18n/SiteToggles";
import { EMPTY_BRIEF, loadBrief, saveBrief, type StartBrief, type SuggestStep } from "@/lib/design/brief";
import { localSuggestions } from "@/lib/ai/suggest";
import { normalizeEan } from "@/lib/print/ean13";
import { createClient } from "@/lib/supabase/client";

type StepId = "packaging" | "brand" | "logo" | "ingredients" | "usage" | "quantity" | "barcode" | "expiry" | "production" | "price" | "extra" | "review";

interface StepDef {
  id: StepId;
  required?: boolean;
  suggest?: SuggestStep;
  /** How a picked suggestion is applied: replace the answer or append to it. */
  pick?: "replace" | "append";
  kind: "text" | "textarea" | "logo" | "date" | "barcode" | "price" | "review";
}

const STEPS: StepDef[] = [
  { id: "packaging", required: true, suggest: "packaging", pick: "replace", kind: "text" },
  { id: "brand", required: true, kind: "text" },
  { id: "logo", kind: "logo" },
  { id: "ingredients", suggest: "ingredients", pick: "replace", kind: "textarea" },
  { id: "usage", suggest: "usage", pick: "append", kind: "textarea" },
  { id: "quantity", suggest: "quantity", pick: "replace", kind: "text" },
  { id: "barcode", kind: "barcode" },
  { id: "expiry", suggest: "expiry", pick: "replace", kind: "date" },
  { id: "production", suggest: "production", pick: "replace", kind: "date" },
  { id: "price", kind: "price" },
  { id: "extra", suggest: "extra", pick: "append", kind: "textarea" },
  { id: "review", kind: "review" },
];

/** Resize an uploaded logo so the brief fits in localStorage (max 640 px, PNG keeps transparency). */
function readLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const src = String(reader.result);
      if (file.type === "image/svg+xml") return resolve(src);
      const img = new Image();
      img.onerror = () => reject(new Error("image"));
      img.onload = () => {
        const scale = Math.min(1, 640 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/png"));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

const fmtDate = (v: string, lang: Lang) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return new Date(v + "T12:00:00").toLocaleDateString(LOCALES[lang], { day: "numeric", month: "long", year: "numeric" });
};

export function StartWizard() {
  const { lang } = useLang();
  const t = useCopy("wizard");
  const [brief, setBrief] = useState<StartBrief>({ ...EMPTY_BRIEF, lang });
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hydrated = useRef(false);

  const step = STEPS[index];
  const total = STEPS.length - 1;

  // Resume an unfinished brief.
  useEffect(() => {
    const saved = loadBrief();
    if (saved) setBrief({ ...saved, lang });
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hydrated.current) saveBrief({ ...brief, lang });
  }, [brief, lang]);

  const set = useCallback(<K extends keyof StartBrief>(k: K, v: StartBrief[K]) => setBrief((b) => ({ ...b, [k]: v })), []);

  const fetchSuggestions = useCallback(
    async (s: SuggestStep, b: StartBrief, force = false) => {
      const key = `${s}|${lang}`;
      // Instant local proposals, then the AI's when they arrive.
      setSuggestions((prev) => (prev[key] && !force ? prev : { ...prev, [key]: localSuggestions(s, b, lang) }));
      if (s === "production") return;
      setLoadingSuggest(true);
      try {
        const { logo, ...rest } = b;
        void logo;
        const res = await fetch("/api/suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step: s, brief: rest, lang }) });
        const json = await res.json();
        if (Array.isArray(json.suggestions) && json.suggestions.length) setSuggestions((prev) => ({ ...prev, [key]: json.suggestions }));
      } catch {
        // keep the local proposals
      } finally {
        setLoadingSuggest(false);
      }
    },
    [lang]
  );

  // Load proposals when a step opens.
  useEffect(() => {
    setError(null);
    if (step.suggest) fetchSuggestions(step.suggest, brief);
    const id = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, lang]);

  // Packaging step: refresh proposals as the visitor types.
  useEffect(() => {
    if (step.id !== "packaging" || brief.packaging.trim().length < 4) return;
    const id = setTimeout(() => fetchSuggestions("packaging", brief, true), 900);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief.packaging]);

  const value = step.id === "review" || step.id === "logo" ? "" : String(brief[step.id as keyof StartBrief] ?? "");
  const ean = useMemo(() => normalizeEan(brief.barcode), [brief.barcode]);

  const go = (dir: 1 | -1, skip = false) => {
    if (dir === 1 && !skip && step.required && !value.trim()) {
      setError(t.required);
      return;
    }
    if (dir === 1 && step.id === "barcode" && brief.barcode.trim() && !ean.ok && !skip) {
      setError(ean.reason === "format" ? t.barcodeFormat : fmt(t.barcodeBad, { digit: ean.ok ? "?" : ean.expected ?? "?" }));
      return;
    }
    if (dir === 1 && skip && step.id !== "review") setBrief((b) => ({ ...b, [step.id]: step.id === "logo" ? b.hasLogo : "" }));
    setIndex((i) => Math.min(STEPS.length - 1, Math.max(0, i + dir)));
    window.scrollTo({ top: 0 });
  };

  const pickSuggestion = (s: string) => {
    const k = step.id as keyof StartBrief;
    const cur = String(brief[k] ?? "").trim();
    if (step.pick === "append" && cur && !cur.includes(s)) set(k, `${cur.replace(/[.\s]+$/, "")}. ${s}` as never);
    else set(k, s as never);
    setError(null);
  };

  const finish = async () => {
    setFinishing(true);
    saveBrief({ ...brief, lang });
    const target = "/create?brief=1";
    let signedIn = false;
    try {
      const { data } = await createClient().auth.getUser();
      signedIn = !!data.user;
    } catch {}
    window.location.href = signedIn ? target : `/signup?next=${encodeURIComponent(target)}`;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && step.kind !== "textarea") {
      e.preventDefault();
      go(1);
    }
  };

  const list = step.suggest ? suggestions[`${step.suggest}|${lang}`] ?? [] : [];
  const progress = Math.round((Math.min(index, total) / total) * 100);

  return (
    <div className="lp sw">
      <header className="sw-top">
        <a href="/" className="lp-logo" aria-label="Edify">
          <span className="lp-logo-badge">E</span>
          <span>Edify</span>
        </a>
        <div className="sw-top-right">
          <LangToggle />
          <ThemeToggle />
          <a href="/" className="sw-close" aria-label={t.close}>
            <X className="w-5 h-5" />
          </a>
        </div>
      </header>
      <div className="sw-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${Math.max(4, progress)}%` }} />
      </div>

      <main className="sw-main">
        <div className="sw-card" key={step.id}>
          {step.id !== "review" ? (
            <>
              <p className="sw-step">{fmt(t.step, { n: index + 1, total })}</p>
              <h1 className="sw-q">{t.q[step.id as keyof typeof t.q][0]}</h1>
              <p className="sw-help">{t.q[step.id as keyof typeof t.q][1]}</p>

              {(step.kind === "text" || step.kind === "price") && (
                <div className={`sw-field ${step.kind === "price" ? "has-suffix" : ""}`}>
                  <input
                    ref={inputRef}
                    className="sw-input"
                    value={value}
                    inputMode={step.kind === "price" ? "numeric" : undefined}
                    placeholder={t.placeholder[step.id as keyof typeof t.placeholder]}
                    maxLength={step.id === "brand" ? 40 : 140}
                    onChange={(e) => {
                      set(step.id as keyof StartBrief, e.target.value as never);
                      setError(null);
                    }}
                    onKeyDown={onKeyDown}
                    aria-invalid={!!error}
                  />
                  {step.kind === "price" && <span className="sw-suffix">{t.currency}</span>}
                </div>
              )}

              {step.kind === "textarea" && (
                <textarea
                  ref={inputRef}
                  className="sw-input sw-textarea"
                  value={value}
                  rows={3}
                  placeholder={t.placeholder[step.id as keyof typeof t.placeholder]}
                  maxLength={600}
                  onChange={(e) => set(step.id as keyof StartBrief, e.target.value as never)}
                />
              )}

              {step.kind === "barcode" && (
                <>
                  <input
                    ref={inputRef}
                    className="sw-input sw-mono"
                    value={value}
                    inputMode="numeric"
                    placeholder={t.placeholder.barcode}
                    maxLength={20}
                    onChange={(e) => {
                      set("barcode", e.target.value.replace(/[^\d\s-]/g, ""));
                      setError(null);
                    }}
                    onKeyDown={onKeyDown}
                  />
                  <p className={`sw-note ${brief.barcode.trim() ? (ean.ok ? "is-ok" : "is-warn") : ""}`}>
                    {!brief.barcode.trim() ? t.barcodeNone : ean.ok ? t.barcodeOk : ean.reason === "format" ? t.barcodeFormat : fmt(t.barcodeBad, { digit: ean.expected ?? "?" })}
                  </p>
                </>
              )}

              {step.kind === "date" && (
                <div className="sw-date">
                  <input
                    ref={inputRef}
                    type="date"
                    className="sw-input"
                    value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""}
                    onChange={(e) => set(step.id as keyof StartBrief, e.target.value as never)}
                    onKeyDown={onKeyDown}
                  />
                  {value && !/^\d{4}-\d{2}-\d{2}$/.test(value) && <p className="sw-note">{value}</p>}
                </div>
              )}

              {step.kind === "logo" && (
                <div className="sw-logo">
                  <div className="sw-choice" role="radiogroup">
                    {(["yes", "no"] as const).map((v) => (
                      <button key={v} type="button" role="radio" aria-checked={brief.hasLogo === v} className={brief.hasLogo === v ? "is-on" : ""} onClick={() => set("hasLogo", v)}>
                        {brief.hasLogo === v && <Check className="w-4 h-4" />}
                        {v === "yes" ? t.yes : t.no}
                      </button>
                    ))}
                  </div>
                  {brief.hasLogo === "yes" &&
                    (brief.logo ? (
                      <div className="sw-logo-preview">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={brief.logo} alt={brief.logoName ?? "Logo"} />
                        <span>{brief.logoName}</span>
                        <button type="button" onClick={() => setBrief((b) => ({ ...b, logo: null, logoName: null }))}>
                          <Trash2 className="w-4 h-4" /> {t.remove}
                        </button>
                        <small className="sw-logo-note">{t.logoColours}</small>
                      </div>
                    ) : (
                      <button type="button" className="sw-drop" onClick={() => fileRef.current?.click()}>
                        <ImagePlus className="w-6 h-6" />
                        <strong>{t.upload}</strong>
                        <small>{t.uploadHint}</small>
                      </button>
                    ))}
                  {brief.hasLogo === "no" && <p className="sw-note">{t.noLogo}</p>}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    hidden
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      try {
                        const url = await readLogo(f);
                        setBrief((b) => ({ ...b, logo: url, logoName: f.name, hasLogo: "yes" }));
                      } catch {}
                    }}
                  />
                </div>
              )}

              {error && <p className="sw-error" role="alert">{error}</p>}

              {step.suggest && (
                <section className="sw-ai" aria-live="polite">
                  <div className="sw-ai-head">
                    <span><Sparkles className="w-4 h-4" /> {t.aiTitle}</span>
                    {loadingSuggest ? (
                      <span className="sw-ai-loading"><Loader2 className="w-4 h-4 animate-spin" /> {t.aiLoading}</span>
                    ) : (
                      step.suggest !== "production" && (
                        <button type="button" onClick={() => fetchSuggestions(step.suggest!, brief, true)}>
                          <RefreshCw className="w-3.5 h-3.5" /> {t.aiMore}
                        </button>
                      )
                    )}
                  </div>
                  <div className="sw-chips">
                    {list.map((s) => (
                      <button key={s} type="button" className={`sw-chip ${value === s || value.includes(s) ? "is-on" : ""}`} onClick={() => pickSuggestion(s)}>
                        {step.kind === "date" ? fmtDate(s, lang) : s}
                      </button>
                    ))}
                  </div>
                  <p className="sw-ai-hint">{t.aiHint}</p>
                </section>
              )}
            </>
          ) : (
            <>
              <p className="sw-step">✓</p>
              <h1 className="sw-q">{t.review}</h1>
              <p className="sw-help">{t.reviewSub}</p>
              <dl className="sw-review">
                {STEPS.filter((s) => s.id !== "review").map((s, i) => {
                  const raw = s.id === "logo" ? (brief.logo ? brief.logoName ?? "✓" : brief.hasLogo === "yes" ? "✓" : "") : String(brief[s.id as keyof StartBrief] ?? "");
                  const shown = s.kind === "date" ? fmtDate(raw, lang) : s.id === "price" && raw ? `${raw} ${t.currency}` : raw;
                  return (
                    <div key={s.id}>
                      <dt>{t.labels[s.id as keyof typeof t.labels]}</dt>
                      <dd>{shown || <span className="sw-empty">{t.empty}</span>}</dd>
                      <button type="button" onClick={() => setIndex(i)}>{t.edit}</button>
                    </div>
                  );
                })}
              </dl>
            </>
          )}
        </div>
      </main>

      <footer className="sw-bar">
        <div className="sw-bar-inner">
          <button type="button" className="lp-btn lp-btn-ghost" onClick={() => go(-1)} disabled={index === 0}>
            <ArrowLeft className="w-4 h-4" /> <span className="sw-hide-xs">{t.back}</span>
          </button>
          <div className="sw-bar-right">
            {step.id !== "review" && !step.required && (
              <button type="button" className="sw-skip" onClick={() => go(1, true)}>
                {t.skip}
              </button>
            )}
            {step.id !== "review" ? (
              <button type="button" className="lp-btn lp-btn-magenta" onClick={() => go(1)}>
                {t.next} <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" className="lp-btn lp-btn-magenta" onClick={finish} disabled={finishing}>
                {finishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {finishing ? t.saving : t.finish}
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
