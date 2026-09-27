"use client";

import React, { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useLang } from "./LangProvider";
import { THEME_KEY, type ThemePref } from "@/lib/theme";


function applyTheme(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const r = document.documentElement;
  r.dataset.theme = dark ? "dark" : "light";
  r.dataset.themePref = pref;
  r.style.colorScheme = dark ? "dark" : "light";
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { lang } = useLang();
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
  const labels = {
    fr: { system: "Thème : système", light: "Thème : clair", dark: "Thème : sombre" },
    en: { system: "Theme: system", light: "Theme: light", dark: "Theme: dark" },
  }[lang];
  const Icon = pref === "dark" ? Moon : pref === "light" ? Sun : Monitor;

  return (
    <button
      type="button"
      className={`site-toggle ${className}`}
      aria-label={`${labels[pref]}. ${lang === "fr" ? "Changer" : "Change"}`}
      title={labels[pref]}
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

export function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`site-lang ${className}`} role="group" aria-label={lang === "fr" ? "Langue du site" : "Site language"}>
      {(["fr", "en"] as const).map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} className={lang === l ? "is-active" : ""} onClick={() => lang !== l && setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
