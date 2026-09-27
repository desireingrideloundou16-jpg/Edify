"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { pickTheme, type LandingTheme } from "./themes";
import { Menu, X } from "lucide-react";
import { ALL_CATALOG_SHAPES } from "@/lib/catalog/shapes";
import { SHOWCASE } from "./showcase";

// ─── Live 3D renders of the showcase packs ───────────────────────────────────

const cache = new Map<string, string>();
let chain: Promise<unknown> = Promise.resolve();

/** Renders are serialised on the shared WebGL context. */
function useShowcaseRender(index: number, size: number, yaw: number) {
  const [url, setUrl] = useState<string | null>(() => cache.get(`${index}-${size}-${yaw}`) ?? null);
  useEffect(() => {
    const key = `${index}-${size}-${yaw}`;
    if (cache.has(key)) return setUrl(cache.get(key)!);
    let alive = true;
    chain = chain.then(async () => {
      const item = SHOWCASE[index];
      const shape = ALL_CATALOG_SHAPES.find((s) => s.id === item.shapeId);
      if (!shape) return;
      const { renderShowcase } = await import("@/lib/three/thumbnails");
      const out = await renderShowcase(shape, { ...item.design, logo: null }, size, yaw);
      if (out) cache.set(key, out);
      if (alive && out) setUrl(out);
    });
    return () => {
      alive = false;
    };
  }, [index, size, yaw]);
  return url;
}

export function PackRender({ index, size = 640, yaw = -0.5, className = "", alt }: { index: number; size?: number; yaw?: number; className?: string; alt: string }) {
  const url = useShowcaseRender(index, size, yaw);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className={`lp-pack is-ready ${className}`} draggable={false} />
  ) : (
    <span className={`lp-pack lp-pack-placeholder ${className}`} aria-hidden="true" />
  );
}

/** Hero cluster: several very different packs, to show Edify is not tied to one format. */
const LiquidSplash = dynamic(() => import("./LiquidSplash").then((m) => m.LiquidSplash), { ssr: false });

/** Hero cluster: a different universe (packs, liquid, accent) on every visit. */
export function HeroCluster({ splash = true }: { splash?: boolean }) {
  const [theme, setTheme] = useState<LandingTheme | null>(null);
  useEffect(() => {
    const t = pickTheme();
    setTheme(t);
    const hero = document.querySelector<HTMLElement>(".lp-hero");
    if (hero) hero.style.background = t.paper;
    const label = document.querySelector<HTMLElement>("[data-theme-label]");
    if (label) label.textContent = t.label;
  }, []);

  if (!theme) return <div className="lp-cluster" aria-hidden="true" />;
  // Slots back → front: top-right, right, left (hero), centre, front.
  const [back, right, left, centre, front] = theme.packs;
  const items = [
    { i: back, cls: "lp-c5", yaw: -0.55 },
    { i: right, cls: "lp-c3", yaw: -0.6 },
    { i: left, cls: "lp-c1", yaw: -0.45 },
    { i: centre, cls: "lp-c2", yaw: -0.3 },
    { i: front, cls: "lp-c4", yaw: -0.4 },
  ];
  return (
    <div className="lp-cluster" aria-label={`Exemples de packagings conçus avec Edify — ${theme.label}`}>
      <span className={`lp-cluster-disc is-${theme.disc}`} aria-hidden="true" />
      {splash && <LiquidSplash theme={theme} />}
      {items.map(({ i, cls, yaw }) => (
        <PackRender key={`${theme.id}-${cls}`} index={i} size={560} yaw={yaw} className={cls} alt={`Packaging ${SHOWCASE[i].design.brandName} généré avec Edify`} />
      ))}
    </div>
  );
}

// ─── Brief box: the product's core action, right in the hero ─────────────────

const EXAMPLES = [
  "Un café bio en grains, marque Terra, esprit artisanal",
  "Un sérum vitamine C en flacon pipette, look clean beauty",
  "Une bière IPA en canette, graphique et colorée",
  "Un miel de lavande en pot, étiquette vintage",
];

export function BriefBox({ variant = "hero" }: { variant?: "hero" | "final" }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [hint, setHint] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setHint((h) => (h + 1) % EXAMPLES.length), 3500);
    return () => clearInterval(t);
  }, []);

  const go = (prompt: string) => {
    const p = prompt.trim();
    router.push(p ? `/create?prompt=${encodeURIComponent(p)}` : "/create");
  };

  return (
    <form
      className={`lp-brief lp-brief-${variant}`}
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
    >
      <label htmlFor={`brief-${variant}`} className="lp-brief-label">
        Décrivez votre produit
      </label>
      <div className="lp-brief-row">
        <textarea
          id={`brief-${variant}`}
          ref={inputRef}
          rows={2}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              go(value);
            }
          }}
          placeholder={EXAMPLES[hint]}
          className="lp-brief-input"
        />
        <button type="submit" className="lp-btn lp-btn-magenta">
          Générer mon packaging
        </button>
      </div>
      {variant === "hero" && (
        <div className="lp-brief-examples">
          <span>Essayez :</span>
          {EXAMPLES.slice(0, 3).map((ex) => (
            <button
              key={ex}
              type="button"
              className="lp-chip"
              onClick={() => {
                setValue(ex);
                inputRef.current?.focus();
              }}
            >
              {ex.replace(/^(Un|Une) /, "")}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}

// ─── Navigation ──────────────────────────────────────────────────────────────

const LINKS = [
  { href: "#comment", label: "Comment ça marche" },
  { href: "#fonctionnalites", label: "Fonctionnalités" },
  { href: "#exemples", label: "Exemples" },
  { href: "#faq", label: "Questions" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`lp-nav ${scrolled ? "is-scrolled" : ""}`}>
      <div className="lp-wrap lp-nav-inner">
        <a href="#top" className="lp-logo" aria-label="Edify, accueil">
          <span className="lp-logo-badge">E</span>
          <span>Edify</span>
        </a>
        <nav className={`lp-nav-links ${open ? "is-open" : ""}`} aria-label="Navigation principale">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <a href="/login" className="lp-nav-login-mobile">Se connecter</a>
          <a href="/signup" className="lp-btn lp-btn-ink lp-nav-cta-mobile">
            Commencer gratuitement
          </a>
        </nav>
        <div className="lp-nav-actions">
          <a href="/login" className="lp-nav-login">Se connecter</a>
          <a href="/signup" className="lp-btn lp-btn-ink lp-nav-cta">
            Commencer gratuitement
          </a>
          <button type="button" className="lp-burger" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </header>
  );
}
