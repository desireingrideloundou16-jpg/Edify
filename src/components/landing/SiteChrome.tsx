"use client";

import React from "react";
import { LandingNav } from "./LandingClient";
import { useLang } from "@/components/i18n/LangProvider";

const FOOTER = {
  fr: {
    tagline: "Le designer de packaging propulsé par l'IA, pensé pour les entrepreneurs africains. Décrivez votre produit, recevez un emballage prêt à imprimer.",
    product: ["Produit", [["/commencer", "Commencer"], ["/create", "Studio"], ["/#fonctionnalites", "Fonctionnalités"], ["/#exemples", "Exemples"], ["/#tarifs", "Tarifs"]]],
    resources: ["Ressources", [["/#demo", "Vidéo de démo"], ["/#faq", "Questions fréquentes"], ["/contact", "Contact"]]],
    legal: ["Légal", [["/mentions-legales", "Mentions légales"], ["/confidentialite", "Confidentialité"], ["/cgu", "Conditions d'utilisation"]]],
    rights: "Tous droits réservés.",
    pay: "Paiement Mobile Money : MTN MoMo · Orange Money",
  },
  en: {
    tagline: "The AI-powered packaging designer built for African entrepreneurs. Describe your product, get print-ready packaging.",
    product: ["Product", [["/commencer", "Get started"], ["/create", "Studio"], ["/#fonctionnalites", "Features"], ["/#exemples", "Examples"], ["/#tarifs", "Pricing"]]],
    resources: ["Resources", [["/#demo", "Demo video"], ["/#faq", "FAQ"], ["/contact", "Contact"]]],
    legal: ["Legal", [["/mentions-legales", "Legal notice"], ["/confidentialite", "Privacy"], ["/cgu", "Terms of use"]]],
    rights: "All rights reserved.",
    pay: "Mobile Money payment: MTN MoMo · Orange Money",
  },
} as const;

export function SiteFooter() {
  const { lang } = useLang();
  const t = FOOTER[lang];
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
          {[t.product, t.resources, t.legal].map(([title, links]) => (
            <nav key={title} aria-label={title} className="lp-footer-col">
              <h3>{title}</h3>
              {links.map(([href, label]) => (
                <a key={href} href={href}>{label}</a>
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
