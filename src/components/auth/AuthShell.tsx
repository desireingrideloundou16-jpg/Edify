import React, { Suspense } from "react";
import { AuthForm, type AuthMode } from "./AuthForm";
import { HeroCluster } from "@/components/landing/LandingClient";

export function AuthShell({ mode }: { mode: AuthMode }) {
  return (
    <div className="lp au-shell">
      <div className="au-left">
        <a href="/" className="lp-logo au-logo" aria-label="Edify, accueil">
          <span className="lp-logo-badge">E</span>
          <span>Edify</span>
        </a>
        <main className="au-main">
          <Suspense>
            <AuthForm mode={mode} />
          </Suspense>
        </main>
        <p className="au-foot">© 2026 Edify</p>
      </div>
      <aside className="au-right" aria-hidden="true">
        <div className="au-right-inner">
          <p className="au-quote">Décrivez votre produit. Edify s&apos;occupe du packaging.</p>
          <div className="au-cluster">
            <HeroCluster splash={false} />
          </div>
          <ul className="au-points">
            <li>Design complet généré par l&apos;IA</li>
            <li>Maquette 3D et visuels publicitaires</li>
            <li>PDF prêt pour l&apos;imprimeur</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
