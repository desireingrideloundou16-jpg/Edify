"use client";

import React, { Suspense } from "react";
import { AuthForm, type AuthMode } from "./AuthForm";
import { HeroCluster } from "@/components/landing/LandingClient";
import { useCopy } from "@/components/i18n/LangProvider";
import { LangToggle, ThemeToggle } from "@/components/i18n/SiteToggles";


export function AuthShell({ mode }: { mode: AuthMode }) {
  const t = useCopy("auth").side;
  const home = useCopy("site").nav.home;
  return (
    <div className="lp au-shell">
      <div className="au-left">
        <div className="au-top">
          <a href="/" className="lp-logo au-logo" aria-label={home}>
            <span className="lp-logo-badge">E</span>
            <span>Edify</span>
          </a>
          <div className="au-toggles">
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
        <main className="au-main">
          <Suspense>
            <AuthForm mode={mode} />
          </Suspense>
        </main>
        <p className="au-foot">© 2026 Edify</p>
      </div>
      <aside className="au-right" aria-hidden="true">
        <div className="au-right-inner">
          <p className="au-quote">{t.quote}</p>
          <div className="au-cluster">
            <HeroCluster scene3d={false} />
          </div>
          <ul className="au-points">
            {t.points.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </div>
      </aside>
    </div>
  );
}
