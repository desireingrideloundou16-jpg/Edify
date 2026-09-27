"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowRight, Menu, X } from "lucide-react";
import { pickTheme, type LandingTheme } from "./themes";
import { SHOWCASE } from "./showcase";
import { useLang } from "@/components/i18n/LangProvider";
import { LangToggle, ThemeToggle } from "@/components/i18n/SiteToggles";

// ─── Pack images (pre-rendered by the Edify engine, see /dev-renders?mode=landing) ───

export function PackRender({ index, className = "", alt, eager = false }: { index: number; size?: number; yaw?: number; className?: string; alt: string; eager?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/landing/packs/${String(index).padStart(2, "0")}.webp`}
      alt={alt}
      width={720}
      height={720}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={`lp-pack is-ready ${className}`}
      draggable={false}
    />
  );
}

const Hero3D = dynamic(() => import("./Hero3D").then((m) => m.Hero3D), { ssr: false });

/** Hero cluster: a different universe (packs, art, accent, 3D scene) on every visit. */
export function HeroCluster({ scene3d = true }: { scene3d?: boolean }) {
  const { lang } = useLang();
  const [theme, setTheme] = useState<LandingTheme | null>(null);
  const [use3d, setUse3d] = useState(false);
  const [ready3d, setReady3d] = useState(false);
  const onReady = useCallback(() => setReady3d(true), []);

  useEffect(() => {
    const t = pickTheme();
    setTheme(t);
    if (!scene3d) return;
    const desktop = window.matchMedia("(min-width: 1025px) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!desktop || reduced) return;
    // Start the 3D scene once the page is idle so it never delays the first paint.
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const id = w.requestIdleCallback ? w.requestIdleCallback(() => setUse3d(true), { timeout: 2500 }) : window.setTimeout(() => setUse3d(true), 1200);
    return () => window.clearTimeout(id);
  }, [scene3d]);

  useEffect(() => {
    if (theme) applyThemeToPage(theme, lang === "fr" ? theme.label : theme.labelEn);
  }, [theme, lang]);

  if (!theme) return <div className="lp-cluster" aria-hidden="true" />;
  const [back, right, left, centre, front] = theme.packs;
  const items = [
    { i: back, cls: "lp-c5" },
    { i: right, cls: "lp-c3" },
    { i: left, cls: "lp-c1" },
    { i: centre, cls: "lp-c2" },
    { i: front, cls: "lp-c4" },
  ];
  const fr = lang === "fr";
  return (
    <div
      className={`lp-cluster art-${theme.art} ${ready3d ? "is-3d" : ""}`}
      aria-label={`${fr ? "Exemples de packagings conçus avec Edify" : "Packaging examples designed with Edify"} — ${fr ? theme.label : theme.labelEn}`}
    >
      <span className={`lp-cluster-disc is-${theme.disc}`} aria-hidden="true" />
      <div className="lp-cluster-static">
        {items.map(({ i, cls }) => (
          <PackRender
            key={`${theme.id}-${cls}`}
            index={i}
            eager
            className={cls}
            alt={fr ? `Packaging ${SHOWCASE[i].design.brandName} généré avec Edify` : `${SHOWCASE[i].design.brandName} packaging generated with Edify`}
          />
        ))}
      </div>
      {use3d && <Hero3D theme={theme} onReady={onReady} />}
    </div>
  );
}

/** Per-visit art direction applied to the whole page (keeps Edify colours and fonts). */
function applyThemeToPage(t: LandingTheme, label: string) {
  const root = document.querySelector<HTMLElement>(".lp");
  if (root) {
    root.dataset.pattern = t.pattern;
    root.style.setProperty("--accent", `var(--${t.disc})`);
    root.style.setProperty("--hero-paper", t.paper);
    t.blobs.forEach((c, i) => root.style.setProperty(`--b${i + 1}`, c));
  }
  const chip = document.querySelector<HTMLElement>("[data-theme-label]");
  if (chip) chip.textContent = label;
}

// ─── Navigation ──────────────────────────────────────────────────────────────

const LINKS = {
  fr: [
    { href: "/#comment", label: "Comment ça marche" },
    { href: "/#fonctionnalites", label: "Fonctionnalités" },
    { href: "/#exemples", label: "Exemples" },
    { href: "/#tarifs", label: "Tarifs" },
    { href: "/#faq", label: "Questions" },
  ],
  en: [
    { href: "/#comment", label: "How it works" },
    { href: "/#fonctionnalites", label: "Features" },
    { href: "/#exemples", label: "Examples" },
    { href: "/#tarifs", label: "Pricing" },
    { href: "/#faq", label: "FAQ" },
  ],
};

export function LandingNav() {
  const { lang } = useLang();
  const fr = lang === "fr";
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Mobile sheet: lock page scroll and close with Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const t = {
    home: fr ? "Edify, accueil" : "Edify, home",
    nav: fr ? "Navigation principale" : "Main navigation",
    login: fr ? "Se connecter" : "Log in",
    cta: fr ? "Commencez maintenant" : "Start now",
    ctaShort: fr ? "Commencer" : "Start",
    open: fr ? "Ouvrir le menu" : "Open menu",
    close: fr ? "Fermer le menu" : "Close menu",
    prefs: fr ? "Langue et thème" : "Language and theme",
  };

  return (
    <>
      <header className={`lp-nav ${scrolled ? "is-scrolled" : ""} ${open ? "is-open" : ""}`}>
        <div className="lp-wrap lp-nav-inner">
          <a href="/" className="lp-logo" aria-label={t.home}>
            <span className="lp-logo-badge">E</span>
            <span>Edify</span>
          </a>
          <nav className="lp-nav-links" aria-label={t.nav}>
            {LINKS[lang].map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
          </nav>
          <div className="lp-nav-actions">
            <LangToggle className="lp-nav-desktop" />
            <ThemeToggle className="lp-nav-desktop" />
            <a href="/login" className="lp-nav-login">{t.login}</a>
            <a href="/commencer" className="lp-btn lp-btn-ink lp-nav-cta">
              <span className="lp-nav-cta-long">{t.cta}</span>
              <span className="lp-nav-cta-short">{t.ctaShort}</span>
            </a>
            <button type="button" className="lp-burger" aria-label={open ? t.close : t.open} aria-expanded={open} aria-controls="lp-sheet" onClick={() => setOpen((v) => !v)}>
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu: full-height sheet (outside the header: its backdrop-filter would trap position: fixed) */}
      <div id="lp-sheet" className="lp-sheet" hidden={!open}>
        <nav aria-label={t.nav} className="lp-sheet-links">
          {LINKS[lang].map((l, i) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} style={{ animationDelay: `${i * 40}ms` }}>
              {l.label}
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </a>
          ))}
        </nav>
        <div className="lp-sheet-prefs" aria-label={t.prefs}>
          <LangToggle />
          <ThemeToggle />
        </div>
        <div className="lp-sheet-actions">
          <a href="/commencer" className="lp-btn lp-btn-magenta lp-btn-xl" onClick={() => setOpen(false)}>
            {t.cta} <ArrowRight className="w-5 h-5" />
          </a>
          <a href="/login" className="lp-btn lp-btn-ghost lp-btn-xl" onClick={() => setOpen(false)}>
            {t.login}
          </a>
        </div>
      </div>
    </>
  );
}
