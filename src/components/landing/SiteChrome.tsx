"use client";

import React from "react";
import { LandingNav } from "./LandingClient";
import { useCopy } from "@/components/i18n/LangProvider";

const PRODUCT = ["/commencer", "/create", "/#fonctionnalites", "/#exemples", "/#tarifs"];
const RESOURCES = ["/#demo", "/#faq", "/contact"];
const LEGAL = ["/mentions-legales", "/confidentialite", "/cgu"];

export function SiteFooter() {
  const t = useCopy("site").footer;
  const cols: [string, string[], string[]][] = [
    [t.product, PRODUCT, t.productLinks],
    [t.resources, RESOURCES, t.resourcesLinks],
    [t.legal, LEGAL, t.legalLinks],
  ];
  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-footer-grid">
          <div className="lp-footer-brand">
            <a href="/" className="lp-logo">
              <span className="lp-logo-badge">E</span>
              <span>Edify</span>
            </a>
            <p>{t.tagline}</p>
          </div>
          {cols.map(([title, hrefs, labels]) => (
            <nav key={title} aria-label={title} className="lp-footer-col">
              <h3>{title}</h3>
              {hrefs.map((href, i) => (
                <a key={href} href={href}>{labels[i]}</a>
              ))}
            </nav>
          ))}
        </div>
        <div className="lp-footer-bottom">
          <p>© 2026 Edify. {t.rights}</p>
          <p>{t.pay}</p>
        </div>
      </div>
    </footer>
  );
}

/** Simple content page (legal, contact) with the landing header and footer. */
export function SitePage({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <div className="lp">
      <LandingNav />
      <main className="lp-page">
        <div className="lp-wrap lp-page-wrap">
          <h1 className="lp-h2">{title}</h1>
          {intro && <p className="lp-sub">{intro}</p>}
          <div className="lp-prose">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
