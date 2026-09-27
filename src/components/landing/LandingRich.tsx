"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { ALL_CATALOG_SHAPES } from "@/lib/catalog/shapes";
import { PackRender } from "./LandingClient";
import { SHOWCASE } from "./showcase";
import { visitSeed } from "./themes";
import { useLang } from "@/components/i18n/LangProvider";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  return reduced;
}

function useInView<T extends Element>(rootMargin = "200px") {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return [ref, seen] as const;
}

// ─── Hero parallax: packs lean toward the pointer ────────────────────────────

export function HeroParallax({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || window.matchMedia("(pointer: coarse)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--px", String((e.clientX - (r.left + r.width / 2)) / r.width));
        el.style.setProperty("--py", String((e.clientY - (r.top + r.height / 2)) / r.height));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);
  return (
    <div ref={ref} className="lp-parallax">
      {children}
    </div>
  );
}

// ─── Live demo: a brief types itself, the pack appears ───────────────────────

const DEMO_ORDER = [1, 0, 2, 4, 9, 14];
type Phase = "typing" | "thinking" | "done";

export function LiveDemo() {
  const { lang } = useLang();
  const fr = lang === "fr";
  const reduced = useReducedMotion();
  const [ref, seen] = useInView<HTMLDivElement>("0px");
  const [slot, setSlot] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<Phase>("typing");
  const index = DEMO_ORDER[slot];
  const item = SHOWCASE[index];
  const shape = ALL_CATALOG_SHAPES.find((s) => s.id === item.shapeId);
  const prompt = fr ? item.prompt : item.promptEn;

  useEffect(() => {
    if (!seen) return;
    if (reduced) {
      setTyped(prompt);
      setPhase("done");
      return;
    }
    let i = 0;
    setTyped("");
    setPhase("typing");
    const timers: ReturnType<typeof setTimeout>[] = [];
    const tick = setInterval(() => {
      i += 1;
      setTyped(prompt.slice(0, i));
      if (i >= prompt.length) {
        clearInterval(tick);
        timers.push(setTimeout(() => setPhase("thinking"), 350));
        timers.push(setTimeout(() => setPhase("done"), 1700));
        timers.push(setTimeout(() => setSlot((s) => (s + 1) % DEMO_ORDER.length), 6200));
      }
    }, 32);
    return () => {
      clearInterval(tick);
      timers.forEach(clearTimeout);
    };
  }, [slot, seen, reduced, prompt]);

  const d = item.design;
  return (
    <div ref={ref} className="lp-demo" aria-label={fr ? "Démonstration du studio Edify" : "Edify studio demo"}>
      <div className="lp-demo-bar" aria-hidden="true">
        <span /><span /><span />
        <p>edify / studio</p>
      </div>
      <div className="lp-demo-body">
        <div className="lp-demo-left">
          <p className="lp-demo-label">{fr ? "Votre brief" : "Your brief"}</p>
          <div className="lp-demo-prompt">
            {typed}
            {phase === "typing" && <span className="lp-caret" aria-hidden="true" />}
          </div>
          <div className={`lp-demo-btn ${phase !== "typing" ? "is-pressed" : ""}`}>
            {phase === "thinking" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {phase === "thinking" ? (fr ? "Conception en cours…" : "Designing…") : fr ? "Générer" : "Generate"}
          </div>
          <dl className={`lp-demo-sheet ${phase === "done" ? "is-visible" : ""}`}>
            <div><dt>{fr ? "Contenant" : "Container"}</dt><dd>{shape?.name} · {shape?.dimensions}</dd></div>
            <div>
              <dt>{fr ? "Couleurs" : "Colours"}</dt>
              <dd className="lp-ai-swatches">{d.palette.map((c) => <span key={c} style={{ background: c }} />)}</dd>
            </div>
            <div><dt>{fr ? "Polices" : "Fonts"}</dt><dd>{d.headingFont} {fr ? "et" : "and"} {d.bodyFont}</dd></div>
            <div><dt>{fr ? "Finition" : "Finish"}</dt><dd>{d.finishing}</dd></div>
          </dl>
        </div>
        <div className="lp-demo-right" style={{ background: `${d.palette[3]}40` }}>
          <div className={`lp-demo-stage ${phase === "done" ? "is-visible" : ""}`}>
            <PackRender key={index} index={index} size={520} yaw={-0.45} alt={fr ? `Packaging ${d.brandName} généré` : `Generated ${d.brandName} pack`} />
          </div>
          {phase !== "done" && (
            <div className="lp-demo-wait" aria-hidden="true">
              <span className="lp-demo-scan" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Scroll story: brief → flat die-line → 3D → ad visual ────────────────────

const STORY_INDEX = 3; // tea box: shows a real carton die-line

const STORY = {
  fr: [
  { title: "Quelques réponses", text: "Vous décrivez le produit, votre marque et ses informations. C'est tout ce qu'Edify vous demande." },
  { title: "Un patron à plat, prêt pour la découpe", text: "L'IA place votre design sur le vrai gabarit du contenant : faces, rabats, languette de collage, fonds perdus." },
  { title: "Une maquette 3D", text: "Le même design, plié et éclairé en studio. Vous tournez le produit, vous changez les textes, tout se met à jour." },
  { title: "Un visuel pour le lancer", text: "Un clic suffit pour obtenir une image publicitaire prête pour Instagram, WhatsApp, vos fiches produits ou vos salons." },
  ],
  en: [
    { title: "A few answers", text: "You describe the product, your brand and its details. That's all Edify asks of you." },
    { title: "A flat die-line, ready for cutting", text: "The AI places your design on the container's real template: panels, flaps, glue tab, bleed." },
    { title: "A 3D mockup", text: "The same design, folded and lit in a studio. Spin the product, change the text, everything updates." },
    { title: "A visual to launch it", text: "One click gives you an ad image ready for Instagram, WhatsApp, product pages or trade fairs." },
  ],
};

export function ScrollStory() {
  const { lang } = useLang();
  const fr = lang === "fr";
  const steps = STORY[lang];
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const dieline = "/landing/story-dieline.webp", ad = "/landing/story-ad.webp";
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);
  const item = SHOWCASE[STORY_INDEX];

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(Number((e.target as HTMLElement).dataset.step))),
      { rootMargin: "-45% 0px -45% 0px" }
    );
    stepRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const visual = (i: number) => {
    switch (i) {
      case 0:
        return <div className="lp-story-brief">« {fr ? item.prompt : item.promptEn} »</div>;
      case 1:
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={dieline} alt={fr ? "Patron à plat avec tracé de découpe" : "Flat die-line with cut lines"} className="lp-story-img" loading="lazy" decoding="async" />;
      case 2:
        return <PackRender index={STORY_INDEX} size={620} yaw={-0.55} alt={fr ? "Maquette 3D de la boîte de thé" : "3D mockup of the tea box"} className="lp-story-pack" />;
      default:
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={ad} alt={fr ? "Visuel publicitaire généré" : "Generated ad visual"} className="lp-story-img lp-story-ad" loading="lazy" decoding="async" />;
    }
  };

  return (
    <div ref={ref} className="lp-story">
      <ol className="lp-story-steps">
        {steps.map((s, i) => (
          <li key={s.title} data-step={i} ref={(el) => { stepRefs.current[i] = el; }} className={`lp-story-step ${active === i ? "is-active" : ""}`}>
            <span className="lp-step-n">{i + 1}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
            <div className="lp-story-inline">{visual(i)}</div>
          </li>
        ))}
      </ol>
      <div className="lp-story-sticky" aria-hidden="true">
        <div className="lp-story-frame">
          {steps.map((_, i) => (
            <div key={i} className={`lp-story-layer ${active === i ? "is-active" : ""}`}>{visual(i)}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Marquee of many different packs ─────────────────────────────────────────

export function PackMarquee() {
  const { lang } = useLang();
  const [ref, seen] = useInView<HTMLDivElement>("400px");
  // Different order on every visit (applied after hydration to keep server and client HTML identical).
  const [shift, setShift] = useState(0);
  useEffect(() => setShift(visitSeed() * 3), []);
  const rotate = (a: number[]) => a.map((_, k) => a[(k + shift) % a.length]);
  const rows = [rotate([0, 5, 8, 3, 10, 12, 6, 15, 16]), rotate([1, 9, 2, 11, 4, 13, 7, 14, 16].reverse())];
  return (
    <div ref={ref} className="lp-marquee" aria-label={lang === "fr" ? "Exemples de packagings de toutes catégories" : "Packaging examples from every category"}>
      {rows.map((row, r) => (
        <div key={r} className={`lp-marquee-row ${r ? "is-reverse" : ""}`}>
          <div className="lp-marquee-track">
            {[...row, ...row].map((i, k) => (
              <div key={k} className="lp-marquee-item" style={{ background: `${SHOWCASE[i].design.palette[3]}33` }} aria-hidden={k >= row.length}>
                {seen && <PackRender index={i} size={360} yaw={-0.5} alt={`Packaging ${SHOWCASE[i].design.brandName}`} />}
                <span>{SHOWCASE[i].design.brandName}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
