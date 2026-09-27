"use client";

import { saveBlob } from "@/lib/download";
import React, { useEffect, useState } from "react";
import { X, Smartphone, Download, Loader2 } from "lucide-react";
import { exportGlb, exportUsdz, isIOS } from "@/lib/three/arExport";
import type { PackagingSpec } from "@/lib/three/packagingModels";
import type { PackagingDesign } from "@/lib/artwork/draw";
import { slugify } from "@/lib/print/exportPrintPdf";

interface ArModalProps {
  isOpen: boolean;
  onClose: () => void;
  spec: PackagingSpec;
  design: PackagingDesign;
  projectName: string;
  onToast: (msg: string) => void;
}

const save = saveBlob;

export function ArModal({ isOpen, onClose, spec, design, projectName, onToast }: ArModalProps) {
  const [busy, setBusy] = useState<"glb" | "usdz" | "ios" | null>(null);
  const [ios, setIos] = useState(false);
  useEffect(() => setIos(isIOS()), []);

  if (!isOpen) return null;
  const base = slugify(projectName) || "edify";

  const run = async (kind: "glb" | "usdz" | "ios") => {
    setBusy(kind);
    try {
      if (kind === "glb") save(await exportGlb(spec, design), `${base}.glb`);
      else {
        const blob = await exportUsdz(spec, design);
        if (kind === "ios") {
          // iOS Quick Look opens USDZ links marked rel="ar".
          const a = document.createElement("a");
          a.rel = "ar";
          a.href = URL.createObjectURL(blob);
          a.appendChild(document.createElement("img"));
          a.click();
        } else save(blob, `${base}.usdz`);
      }
      onToast("✓ Modèle 3D exporté à l'échelle réelle.");
    } catch (e) {
      console.error(e);
      onToast("L'export 3D a échoué pour ce contenant.");
    } finally {
      setBusy(null);
    }
  };

  const Btn = ({ kind, label, hint }: { kind: "glb" | "usdz" | "ios"; label: string; hint: string }) => (
    <button type="button" onClick={() => run(kind)} disabled={!!busy} className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-left transition disabled:opacity-60">
      <span className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
        {busy === kind ? <Loader2 className="w-4 h-4 animate-spin" /> : kind === "ios" ? <Smartphone className="w-4 h-4" /> : <Download className="w-4 h-4" />}
      </span>
      <span>
        <span className="block text-xs font-bold text-slate-900">{label}</span>
        <span className="block text-[11px] text-slate-500">{hint}</span>
      </span>
    </button>
  );

  return (
    <div className="edify-modal-backdrop" onClick={onClose}>
      <div className="edify-modal-content max-w-md" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Réalité augmentée">
        <div className="edify-sheet-drag-handle md:hidden" />
        <div className="edify-modal-header">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Réalité augmentée</h3>
              <p className="text-[11px] text-slate-500">Votre packaging à taille réelle ({spec.lengthMm}×{spec.widthMm}×{spec.heightMm} mm)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" aria-label="Fermer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="edify-modal-body space-y-2">
          {ios && <Btn kind="ios" label="Voir dans ma pièce (iPhone / iPad)" hint="Ouvre le modèle en réalité augmentée avec Quick Look" />}
          <Btn kind="glb" label="Télécharger le modèle GLB" hint="Android, sites web, Blender, visionneuses 3D" />
          <Btn kind="usdz" label="Télécharger le modèle USDZ" hint="iPhone / iPad (Quick Look), Keynote, Reality Composer" />
          <p className="text-[11px] text-slate-500 pt-2">
            Sur Android, ouvrez le fichier GLB avec l&apos;application Google (Scene Viewer) ou envoyez-le sur votre téléphone.
          </p>
        </div>
      </div>
    </div>
  );
}
