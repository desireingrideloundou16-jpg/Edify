"use client";

import React from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { useCopy } from "@/components/i18n/LangProvider";
import { LandingNav } from "./LandingClient";
import { SiteFooter } from "./SiteChrome";
import { SHOWCASE } from "./showcase";

const pad = (i: number) => String(i).padStart(2, "0");

/** /exemples: each brief as typed by an entrepreneur, and what Edify's AI delivered. */
export function ExamplesGallery() {
  const t = useCopy("site").examples;
  const prompts = useCopy("showcase").prompts;
  return (
    <div className="lp">
      <LandingNav />
      <main className="lp-page lp-examples">
        <div className="lp-wrap">
          <p className="lp-examples-kicker"><Sparkles className="w-4 h-4" /> {t.kicker}</p>
          <h1 className="lp-h2">{t.title}</h1>
          <p className="lp-sub">{t.intro}</p>

          <div className="lp-examples-grid">
            {SHOWCASE.map((item, i) => (
              <article key={item.design.brandName} className="lp-example">
                <div className="lp-example-media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/landing/examples/${pad(i)}.webp`} alt={`${t.adAlt} ${item.design.brandName}`} loading={i < 3 ? "eager" : "lazy"} decoding="async" width={819} height={1024} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="lp-example-pack" src={`/landing/packs/${pad(i)}.webp`} alt={`${t.packAlt} ${item.design.brandName}`} loading="lazy" decoding="async" width={720} height={720} />
                </div>
                <div className="lp-example-body">
                  <span className="lp-example-label">{t.brief}</span>
                  <p className="lp-example-prompt">« {prompts[i] ?? item.prompt} »</p>
                  <p className="lp-example-brand">
                    <strong>{item.design.brandName}</strong> · {item.design.productName}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <section className="lp-examples-cta">
            <h2>{t.ctaTitle}</h2>
            <p>{t.ctaText}</p>
            <a href="/commencer" className="lp-btn lp-btn-magenta lp-btn-xl">
              {t.cta} <ArrowRight className="w-5 h-5" />
            </a>
            <small>{t.note}</small>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
