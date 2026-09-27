"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Globe, Monitor, Moon, Sun } from "lucide-react";
import { useCopy, useLang } from "./LangProvider";
import { THEME_KEY, type ThemePref } from "@/lib/theme";
import { LANGS, LANG_NAMES } from "@/lib/i18n/config";

function applyTheme(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const r = document.documentElement;
  r.dataset.theme = dark ? "dark" : "light";
  r.dataset.themePref = pref;
  r.style.colorScheme = dark ? "dark" : "light";
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const t = useCopy("site").toggles;
  const [pref, setPref] = useState<ThemePref>("system");

  useEffect(() => {
    let saved: ThemePref = "system";
    try {
      saved = (localStorage.getItem(THEME_KEY) as ThemePref) || "system";
    } catch {}
    setPref(saved);
    // Follow the system live while the visitor hasn't forced a theme.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let p: ThemePref = "system";
      try {
        p = (localStorage.getItem(THEME_KEY) as ThemePref) || "system";
      } catch {}
      if (p === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const next: Record<ThemePref, ThemePref> = { system: "light", light: "dark", dark: "system" };
  const Icon = pref === "dark" ? Moon : pref === "light" ? Sun : Monitor;

  return (
    <button
      type="button"
      className={`site-toggle ${className}`}
      aria-label={`${t.theme[pref]}. ${t.change}`}
      title={t.theme[pref]}
      onClick={() => {
        const p = next[pref];
        setPref(p);
        try {
          localStorage.setItem(THEME_KEY, p);
        } catch {}
        applyTheme(p);
      }}
    >
      <Icon className="w-[18px] h-[18px]" />
    </button>
  );
}

/**
 * Language picker: a globe button opening the list of languages (native names).
 * variant="list" shows the languages inline (mobile menu).
 */
export function LangToggle({ className = "", variant = "menu" }: { className?: string; variant?: "menu" | "list" }) {
  const { lang, setLang } = useLang();
  const t = useCopy("site").toggles;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (l: (typeof LANGS)[number]) => {
    setOpen(false);
    if (l !== lang) setLang(l);
  };

  if (variant === "list") {
    return (
      <div className={`site-lang-list ${className}`} role="group" aria-label={t.language}>
        <Globe className="w-4 h-4" aria-hidden="true" />
        {LANGS.map((l) => (
          <button key={l} type="button" lang={l} aria-pressed={lang === l} className={lang === l ? "is-active" : ""} onClick={() => choose(l)}>
            {LANG_NAMES[l]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} className={`site-lang-menu ${className}`}>
      <button type="button" className="site-lang-btn" aria-haspopup="listbox" aria-expanded={open} aria-label={`${t.language} : ${LANG_NAMES[lang]}`} onClick={() => setOpen((v) => !v)}>
        <Globe className="w-[18px] h-[18px]" />
        <span>{lang.toUpperCase()}</span>
      </button>
      {open && (
        <ul className="site-lang-pop" role="listbox" aria-label={t.language}>
          {LANGS.map((l) => (
            <li key={l}>
              <button type="button" role="option" lang={l} aria-selected={lang === l} onClick={() => choose(l)}>
                <span className="site-lang-code">{l.toUpperCase()}</span>
                {LANG_NAMES[l]}
                {lang === l && <Check className="w-4 h-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
