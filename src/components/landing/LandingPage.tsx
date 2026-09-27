import React from "react";
import { ArrowRight, Play, Smartphone } from "lucide-react";
import type { Lang } from "@/lib/i18n/config";
import { HeroCluster, LandingNav, PackRender } from "./LandingClient";
import { HeroParallax, LiveDemo, PackMarquee, ScrollStory } from "./LandingRich";
import { DemoVideo } from "./DemoVideo";
import { SiteFooter } from "./SiteChrome";
import { SHOWCASE } from "./showcase";
import { landingCopy, type LandingCopy } from "./copy";

function CropMarks() {
  return (
    <>
      <span className="lp-crop lp-crop-tl" aria-hidden="true" />
      <span className="lp-crop lp-crop-tr" aria-hidden="true" />
      <span className="lp-crop lp-crop-bl" aria-hidden="true" />
      <span className="lp-crop lp-crop-br" aria-hidden="true" />
    </>
  );
}

function ColorBar() {
  return (
    <div className="lp-colorbar" aria-hidden="true">
      <span style={{ background: "var(--c)" }} />
      <span style={{ background: "var(--m)" }} />
      <span style={{ background: "var(--y)" }} />
      <span style={{ background: "var(--k)" }} />
    </div>
  );
}

function DielineArt({ t }: { t: LandingCopy }) {
  return (
    <svg viewBox="0 0 320 220" className="lp-dieline" role="img" aria-label={t.features.dielineAlt}>
      <g fill="none" strokeLinejoin="round">
        <path
          d="M40 70 L40 40 L46 22 L98 22 L104 40 L104 70 L108 50 L140 50 L148 62 L148 70 L212 70 L216 50 L248 50 L256 62 L256 70 L256 170 L256 178 L248 190 L216 190 L212 170 L212 202 L206 214 L154 214 L148 202 L148 170 L148 178 L140 190 L108 190 L104 170 L40 170 L28 166 L28 74 Z"
          stroke="var(--m)"
          strokeWidth="1.6"
        />
        <g stroke="var(--c)" strokeWidth="1.2" strokeDasharray="4 3">
          <path d="M40 70 L40 170 M104 70 L104 170 M148 70 L148 170 M212 70 L212 170" />
          <path d="M40 70 L104 70 M40 40 L104 40 M104 70 L148 70 M212 70 L256 70 M148 170 L212 170 M104 170 L148 170 M212 170 L256 170" />
        </g>
      </g>
      <rect x="152" y="80" width="56" height="80" rx="3" fill="var(--m)" opacity="0.12" />
      <text x="180" y="124" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--k)" fontFamily="Syne, sans-serif">{t.features.face}</text>
    </svg>
  );
}

export function LandingPage({ lang }: { lang: Lang }) {
  const t = landingCopy(lang);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Edify",
    applicationCategory: "DesignApplication",
    operatingSystem: "Web",
    description: t.jsonLd,
    offers: t.pricing.plans.map((p) => ({ "@type": "Offer", name: p.name, price: p.price.replace(/\D/g, ""), priceCurrency: "XAF" })),
    inLanguage: lang,
  };
  return (
    <div className="lp" id="top">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <a href="#contenu" className="lp-skip">{t.skip}</a>
      <LandingNav />

      <main id="contenu">
        {/* ── Hero ── */}
        <section className="lp-hero">
          <div className="lp-hero-bg" aria-hidden="true">
            <span className="lp-blob lp-blob-1" />
            <span className="lp-blob lp-blob-2" />
            <span className="lp-blob lp-blob-3" />
            <span className="lp-hero-grain" />
          </div>
          <div className="lp-wrap lp-hero-sheet">
            <CropMarks />
            <div className="lp-hero-copy">
              <p className="lp-kicker">
                <span className="lp-dot" aria-hidden="true" /> {t.hero.kicker}
                <span className="lp-theme-chip" data-theme-label aria-live="polite" />
              </p>
              <h1 className="lp-h1">
                {t.hero.h1a}
                <br />
                <span className="lp-h1-accent">{t.hero.h1b}</span>
              </h1>
              <p className="lp-lead">{t.hero.lead}</p>
              <div className="lp-hero-ctas">
                <a href="/commencer" className="lp-btn lp-btn-magenta lp-btn-xl">
                  {t.hero.cta} <ArrowRight className="w-5 h-5" />
                </a>
                <a href="#demo" className="lp-btn lp-btn-ghost lp-btn-xl">
                  <Play className="w-4 h-4" /> {t.hero.demo}
                </a>
              </div>
              <p className="lp-micro"><Smartphone className="w-4 h-4" aria-hidden="true" /> {t.hero.micro}</p>
              <ul className="lp-proof">
                {t.hero.proof.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
            <HeroParallax>
              <HeroCluster />
            </HeroParallax>
          </div>
          <div className="lp-wrap">
            <ColorBar />
            <ul className="lp-stats">
              {t.stats.map(([n, label]) => <li key={label}><strong>{n}</strong> {label}</li>)}
            </ul>
          </div>
        </section>

        {/* ── Demo film ── */}
        <section className="lp-section lp-video-sec" id="demo" aria-labelledby="video-title">
          <div className="lp-wrap">
            <h2 id="video-title" className="lp-h2">{t.video.title}</h2>
            <p className="lp-sub">{t.video.sub}</p>
            <DemoVideo />
          </div>
        </section>

        {/* ── Every category ── */}
        <section className="lp-section lp-cats" aria-labelledby="cats-title">
          <div className="lp-wrap">
            <h2 id="cats-title" className="lp-h2">{t.cats.title}</h2>
            <p className="lp-cats-list">
              {t.cats.list.map((c, i) => (
                <span key={c} className={`lp-cat lp-cat-${i % 4}`}>{c}</span>
              ))}
            </p>
          </div>
          <PackMarquee />
        </section>

        {/* ── Live demo ── */}
        <section className="lp-section lp-demo-sec" aria-labelledby="demo-title">
          <div className="lp-wrap">
            <h2 id="demo-title" className="lp-h2">{t.live.title}</h2>
            <p className="lp-sub">{t.live.sub}</p>
            <LiveDemo />
          </div>
        </section>

        {/* ── Scroll story (a real sequence) ── */}
        <section className="lp-section" id="comment" aria-labelledby="how-title">
          <div className="lp-wrap">
            <h2 id="how-title" className="lp-h2">{t.how.title}</h2>
            <p className="lp-sub">{t.how.sub}</p>
            <ScrollStory />
          </div>
        </section>

        {/* ── The real studio ── */}
        <section className="lp-section lp-studio-sec" aria-labelledby="studio-title">
          <div className="lp-wrap">
            <h2 id="studio-title" className="lp-h2">{t.studio.title}</h2>
            <p className="lp-sub">{t.studio.sub}</p>
            <figure className="lp-browser">
              <div className="lp-browser-bar" aria-hidden="true"><span /><span /><span /><p>Edify · Studio</p></div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/studio.webp" alt={t.studio.alt} loading="lazy" />
            </figure>
            <ul className="lp-callouts">
              {t.studio.callouts.map(([a, b]) => <li key={a}><strong>{a}</strong> {b}</li>)}
            </ul>
          </div>
        </section>

        {/* ── Capabilities (varied tiles, real renders) ── */}
        <section className="lp-section lp-features" id="fonctionnalites" aria-labelledby="feat-title">
          <div className="lp-wrap">
            <h2 id="feat-title" className="lp-h2">{t.features.title}</h2>
            <div className="lp-bento">
              <article className="lp-tile lp-tile-3d">
                <div>
                  <h3>{t.features.t3d[0]}</h3>
                  <p>{t.features.t3d[1]}</p>
                </div>
                <PackRender index={6} alt={t.features.packAlt[0]} className="lp-tile-pack" />
              </article>
              <article className="lp-tile lp-tile-print">
                <h3>{t.features.print[0]}</h3>
                <p>{t.features.print[1]}</p>
                <DielineArt t={t} />
              </article>
              <article className="lp-tile lp-tile-ai">
                <h3>{t.features.ai[0]}</h3>
                <p>{t.features.ai[1]}</p>
                <dl className="lp-ai-sheet">
                  {t.features.aiSheet.slice(0, 2).map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}
                  <div><dt>{t.features.colours}</dt><dd className="lp-ai-swatches"><span style={{ background: "#1E1A17" }} /><span style={{ background: "#F1E6D6" }} /><span style={{ background: "#C47A3D" }} /></dd></div>
                  {t.features.aiSheet.slice(2).map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}
                </dl>
              </article>
              <article className="lp-tile lp-tile-ad">
                <div className="lp-ad-stage">
                  <PackRender index={0} alt={t.features.packAlt[1]} />
                </div>
                <h3>{t.features.ad[0]}</h3>
                <p>{t.features.ad[1]}</p>
              </article>
              <article className="lp-tile lp-tile-numbers">
                {t.features.numbers.map(([n, l]) => <p key={l} className="lp-number"><strong>{n}</strong> {l}</p>)}
              </article>
              <article className="lp-tile lp-tile-ar">
                <h3>{t.features.ar[0]}</h3>
                <p>{t.features.ar[1]}</p>
              </article>
            </div>
          </div>
        </section>

        {/* ── Gallery: one sentence, one pack ── */}
        <section className="lp-section" id="exemples" aria-labelledby="ex-title">
          <div className="lp-wrap">
            <h2 id="ex-title" className="lp-h2">{t.gallery.title}</h2>
            <p className="lp-sub">{t.gallery.sub}</p>
            <div className="lp-gallery">
              {SHOWCASE.slice(0, 8).map((item, i) => (
                <figure key={item.shapeId} className="lp-card">
                  <div className="lp-card-stage" style={{ background: item.design.palette[3] + "33" }}>
                    <PackRender index={i} alt={t.packAlt(item.design.brandName)} />
                  </div>
                  <figcaption>« {lang === "fr" ? item.prompt : item.promptEn} »</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ── Staged mockups ── */}
        <section className="lp-section lp-mock-sec" aria-labelledby="mock-title">
          <div className="lp-wrap">
            <h2 id="mock-title" className="lp-h2">{t.mockups.title}</h2>
            <p className="lp-sub">{t.mockups.sub}</p>
            <div className="lp-mockups">
              {t.mockups.items.map(([id, label]) => (
                <figure key={id} className="lp-mockup">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/landing/mockups/${id}.webp`} alt={label} loading="lazy" decoding="async" width={1000} height={1250} />
                  <figcaption>{label}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ── Comparison ── */}
        <section className="lp-section lp-compare-sec" aria-labelledby="cmp-title">
          <div className="lp-wrap">
            <h2 id="cmp-title" className="lp-h2">{t.compare.title}</h2>
            <div className="lp-compare" role="table" aria-label={t.compare.aria}>
              <div className="lp-compare-row lp-compare-head" role="row">
                <span role="columnheader" />
                <span role="columnheader">{t.compare.head[0]}</span>
                <span role="columnheader">{t.compare.head[1]}</span>
              </div>
              {t.compare.rows.map(([label, a, b]) => (
                <div key={label} className="lp-compare-row" role="row">
                  <span role="rowheader">{label}</span>
                  <span role="cell">{a}</span>
                  <span role="cell" className="lp-compare-us">{b}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Export formats ── */}
        <section className="lp-section lp-formats-sec" aria-labelledby="formats-title">
          <div className="lp-wrap">
            <h2 id="formats-title" className="lp-h2">{t.formats.title}</h2>
            <p className="lp-sub">{t.formats.sub}</p>
            <ul className="lp-formats">
              {t.formats.list.map(([ext, title, text]) => (
                <li key={ext}>
                  <span className="lp-format-ext">{ext}</span>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className="lp-section" id="tarifs" aria-labelledby="price-title">
          <div className="lp-wrap">
            <h2 id="price-title" className="lp-h2">{t.pricing.title}</h2>
            <p className="lp-sub">{t.pricing.sub}</p>
            <div className="lp-plans">
              {t.pricing.plans.map((p) => (
                <article key={p.id} className={`lp-plan ${p.featured ? "is-featured" : ""}`}>
                  {p.featured && <span className="lp-plan-badge">{t.pricing.badge}</span>}
                  <h3>{p.name}</h3>
                  <p className="lp-price"><strong>{p.price}</strong><span>{t.pricing.perMonth}</span></p>
                  <p className="lp-plan-desc">{p.desc}</p>
                  <ul>
                    {p.features.map((f) => <li key={f}>{f}</li>)}
                  </ul>
                  <a href={`/abonnement?plan=${p.id}`} className={`lp-btn ${p.featured ? "lp-btn-magenta" : "lp-btn-ink"}`}>{t.pricing.choose}</a>
                </article>
              ))}
            </div>
            <p className="lp-plans-note">
              <span className="lp-momo" aria-hidden="true"><i className="is-mtn">MTN MoMo</i><i className="is-orange">Orange Money</i></span>
              {t.pricing.note}
            </p>
          </div>
        </section>

        {/* ── Trust ── */}
        <section className="lp-section lp-trust-sec" aria-labelledby="trust-title">
          <div className="lp-wrap lp-trust">
            <h2 id="trust-title" className="lp-h2">{t.trust.title}</h2>
            <ul>
              {t.trust.list.map(([a, b]) => <li key={a}><strong>{a}</strong>{b}</li>)}
            </ul>
          </div>
        </section>

        {/* ── Audience ── */}
        <section className="lp-section" aria-labelledby="who-title">
          <div className="lp-wrap lp-who">
            <h2 id="who-title" className="lp-h2">{t.who.title}</h2>
            <ul className="lp-who-list">
              {t.who.list.map(([a, b]) => <li key={a}><strong>{a}</strong> {b}</li>)}
            </ul>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="lp-section" id="faq" aria-labelledby="faq-title">
          <div className="lp-wrap lp-faq-wrap">
            <h2 id="faq-title" className="lp-h2">{t.faq.title}</h2>
            <div className="lp-faq">
              {t.faq.list.map(([q, a]) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="lp-final" aria-labelledby="final-title">
          <div className="lp-wrap lp-final-inner">
            <h2 id="final-title" className="lp-final-title">{t.final.title}</h2>
            <p className="lp-final-sub">{t.final.sub}</p>
            <a href="/commencer" className="lp-btn lp-btn-light lp-btn-xl">
              {t.hero.cta} <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
