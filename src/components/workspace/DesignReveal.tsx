"use client";

import React, { useEffect, useState } from "react";
import { Box, Download, FileDown, Loader2, Megaphone, Pencil, Sparkles, X } from "lucide-react";
import type { PackagingShape } from "./Modals";
import type { PackagingDesign } from "@/lib/artwork/draw";
import type { PackagingSpec } from "@/lib/three/packagingModels";
import { saveDataUrl } from "@/lib/download";
import { slugify } from "@/lib/print/exportPrintPdf";

const STEPS = [
  "Analyse de votre produit et de votre marché",
  "Choix du contenant idéal",
  "Idée créative et composition",
  "Palette de couleurs sur mesure",
  "Typographie et hiérarchie",
  "Mentions bilingues et code-barres",
  "Rendu de la maquette 3D",
];

/** Shown over the preview while the AI designs a new packaging (the previous one is never shown). */
export function DesignInProgress() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 1700);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="st-progress-overlay" role="status" aria-live="polite">
      <div className="st-progress-card">
        <span className="st-progress-orb"><Sparkles className="w-7 h-7" /></span>
        <h2>L&apos;IA conçoit votre packaging</h2>
        <p>Comme un directeur artistique : stratégie, idée créative, puis chaque détail.</p>
        <ol>
          {STEPS.map((s, i) => (
            <li key={s} className={i < step ? "is-done" : i === step ? "is-now" : ""}>
              <span>{i < step ? "✓" : i === step ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : ""}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** New account without any packaging: invite to the guided start instead of a demo pack. */
export function FirstPackagingInvite({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="st-progress-overlay">
      <div className="st-progress-card">
        <span className="st-progress-orb"><Sparkles className="w-7 h-7" /></span>
        <h2>Créons votre premier packaging</h2>
        <p>Répondez à quelques questions sur votre produit : l&apos;IA conçoit tout le reste, prêt à imprimer.</p>
        <a href="/commencer" className="st-cta">
          <Sparkles className="w-4 h-4" /> Commencer maintenant
        </a>
        <button type="button" className="st-link" onClick={onDismiss}>
          Explorer le studio d&apos;abord
        </button>
      </div>
    </div>
  );
}

/** "Votre packaging est prêt": 3D mockup + ad visual, ready to download in one click. */
export function DesignReveal({
  open,
  onClose,
  shape,
  spec,
  design,
  projectName,
  rationale,
  onDownloadPdf,
  onOpen3d,
}: {
  open: boolean;
  onClose: () => void;
  shape: PackagingShape;
  spec: PackagingSpec;
  design: PackagingDesign;
  projectName: string;
  rationale: string | null;
  onDownloadPdf: () => void;
  onOpen3d: () => void;
}) {
  const [mockup, setMockup] = useState<string | null>(null);
  const [ad, setAd] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setMockup(null);
    setAd(null);
    (async () => {
      // Let the new design settle (fonts, logo) before rendering.
      await new Promise((r) => setTimeout(r, 400));
      const { renderShowcase } = await import("@/lib/three/thumbnails");
      const m = await renderShowcase(shape, design, 900, -0.5).catch(() => null);
      if (alive) setMockup(m);
      const { renderAd } = await import("@/lib/three/adRender");
      const a = await renderAd({ spec, design, scene: "podium", format: "square", withCopy: true, seed: 3, scale: 0.6 }).catch(() => null);
      if (alive) setAd(a);
    })();
    return () => {
      alive = false;
    };
  }, [open, shape, spec, design]);

  if (!open) return null;
  const base = slugify(projectName) || "edify";
  return (
    <div className="edify-modal-backdrop" onClick={onClose}>
      <div className="edify-modal-content st-reveal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Votre packaging est prêt">
        <button type="button" className="st-reveal-close" onClick={onClose} aria-label="Fermer">
          <X className="w-5 h-5" />
        </button>
        <p className="st-reveal-kicker"><Sparkles className="w-4 h-4" /> Votre packaging est prêt</p>
        <h2>{projectName}</h2>
        {rationale && <p className="st-reveal-why">{rationale}</p>}
        <div className="st-reveal-grid">
          <figure>
            <div className="st-reveal-img">
              {mockup ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mockup} alt="Maquette 3D" />
              ) : (
                <Loader2 className="w-6 h-6 animate-spin" />
              )}
            </div>
            <figcaption>
              <strong>Maquette 3D</strong>
              <button type="button" disabled={!mockup} onClick={() => mockup && saveDataUrl(mockup, `${base}-maquette-3d.png`)}>
                <Download className="w-4 h-4" /> PNG
              </button>
            </figcaption>
          </figure>
          <figure>
            <div className="st-reveal-img is-ad">
              {ad ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ad} alt="Image publicitaire" />
              ) : (
                <Loader2 className="w-6 h-6 animate-spin" />
              )}
            </div>
            <figcaption>
              <strong>Image publicitaire</strong>
              <button type="button" disabled={!ad} onClick={() => ad && saveDataUrl(ad, `${base}-visuel.png`)}>
                <Download className="w-4 h-4" /> PNG
              </button>
            </figcaption>
          </figure>
        </div>
        <div className="st-reveal-actions">
          <button type="button" className="edify-primary-download-btn" onClick={onDownloadPdf}>
            <FileDown className="w-4 h-4" /> PDF pour l&apos;imprimeur
          </button>
          <button type="button" className="edify-secondary-btn" onClick={onOpen3d}>
            <Box className="w-4 h-4" /> Voir en 3D
          </button>
          <button type="button" className="edify-secondary-btn" onClick={onClose}>
            <Pencil className="w-4 h-4" /> Personnaliser
          </button>
          <span className="st-reveal-more"><Megaphone className="w-3.5 h-3.5" /> Plus de formats dans « Télécharger »</span>
        </div>
      </div>
    </div>
  );
}
