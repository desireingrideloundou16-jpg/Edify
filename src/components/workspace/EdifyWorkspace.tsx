"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { CheckCircle2 } from "lucide-react";
import { AiPromptDock, type ReferenceFile } from "./AiPromptDock";
import { StudioTopBar, type ExportAction } from "@/components/studio/StudioTopBar";
import { StudioPanel, type PanelTab } from "@/components/studio/StudioPanel";
import { PreviewStage, type PreviewMode } from "@/components/studio/PreviewStage";
import { AdStudioModal } from "./AdStudioModal";
import { ArModal } from "./ArModal";
import type { PackagingShape, VisualStylePreset } from "./Modals";
import { ALL_CATALOG_SHAPES } from "@/lib/catalog/shapes";
import { ALL_CATALOG_STYLES } from "@/lib/catalog/styles";
import { toPackagingDesign, encodeShare, decodeShare, type DesignContent } from "@/lib/design/state";
import type { PackagingDesign } from "@/lib/artwork/draw";
import type { PackagingSpec } from "@/lib/three/packagingModels";
import type { DesignSpec } from "@/lib/ai/designSpec";
import { generatePrintPdf, downloadPrintPdf, slugify } from "@/lib/print/exportPrintPdf";
import { createClient as createSupabase } from "@/lib/supabase/client";

interface SavedProject {
  version: 1;
  content: DesignContent;
  shapeId: string;
  styleId: string;
  customPalette: string[] | null;
  headingFont: string | null;
  bodyFont: string | null;
}

const DEFAULT_CONTENT: DesignContent = {
  projectName: "Lumina Sérum 30 ml",
  brandName: "LUMINA",
  productName: "Sérum Éclat",
  tagline: "Vitamine C pure 15 %",
  volume: "30 ml — 1.0 fl oz",
  details: "Aqua, Glycerin, Sodium Hyaluronate, Ascorbic Acid, Citrus Aurantium Flower Oil. Appliquer 3 gouttes matin et soir sur peau propre. Éviter le contour des yeux.",
};

function useImage(url: string | null) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) return setImg(null);
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = url;
  }, [url]);
  return img;
}

export function EdifyWorkspace() {
  const [shape, setShape] = useState<PackagingShape>(
    ALL_CATALOG_SHAPES.find((s) => s.id === "folding-box-standard") ?? ALL_CATALOG_SHAPES[0]
  );
  const [style, setStyle] = useState<VisualStylePreset>(ALL_CATALOG_STYLES[0]);
  const [customPalette, setCustomPalette] = useState<string[] | null>(null);
  const [headingFont, setHeadingFont] = useState<string | null>(null);
  const [bodyFont, setBodyFont] = useState<string | null>(null);
  const [content, setContent] = useState<DesignContent>(DEFAULT_CONTENT);
  const [uploadedLogo, setUploadedLogo] = useState<string | null>(null);
  const [uploadedLogoName, setUploadedLogoName] = useState<string | null>(null);

  const [credits, setCredits] = useState<number | null>(null);
  const [account, setAccount] = useState<{ name: string; email: string; avatar: string | null } | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const projectId = useRef<string | null>(null);
  const restored = useRef(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isArOpen, setIsArOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("shape");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("flat");
  const [isAdOpen, setIsAdOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const captureRef = useRef<(() => string) | null>(null);

  const handleCaptureReady = useCallback((fn: () => string) => {
    captureRef.current = fn;
  }, []);

  const showToast = useCallback((msg: string, ms = 3800) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);

  // ── Derived design ──────────────────────────────────────────────────────
  const selection = { shapeId: shape.id, styleId: style.id, customPalette, headingFont, bodyFont };
  const baseDesign = useMemo(
    () => toPackagingDesign(content, style, { shapeId: shape.id, styleId: style.id, customPalette, headingFont, bodyFont }),
    [content, style, shape.id, customPalette, headingFont, bodyFont]
  );
  const logoImg = useImage(uploadedLogo);
  const fullDesign: PackagingDesign = useMemo(() => ({ ...baseDesign, logo: logoImg }), [baseDesign, logoImg]);
  const spec: PackagingSpec = useMemo(
    () => ({ model: shape.model ?? "box", lengthMm: shape.lengthMm, widthMm: shape.widthMm, heightMm: shape.heightMm, material: shape.material }),
    [shape]
  );

  // ── Account: profile, credits and the last saved project ──────────────
  useEffect(() => {
    const supabase = createSupabase();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const meta = user.user_metadata ?? {};
      const { data: profile } = await supabase.from("profiles").select("full_name, avatar_url, credits").eq("id", user.id).single();
      setAccount({
        name: profile?.full_name || meta.full_name || meta.name || user.email?.split("@")[0] || "Mon compte",
        email: user.email ?? "",
        avatar: profile?.avatar_url || meta.avatar_url || null,
      });
      setCredits(profile?.credits ?? 0);
      // A shared link or a landing brief takes precedence over the last saved project.
      const fromLink = window.location.hash.includes("d=") || new URLSearchParams(window.location.search).has("prompt");
      const { data: last } = await supabase.from("projects").select("id, data").order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (last) {
        projectId.current = last.id;
        if (!fromLink) restoreSaved(last.data as SavedProject);
      }
      restored.current = true;
    })().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restoreSaved = (d: SavedProject) => {
    if (!d?.content) return;
    const s = ALL_CATALOG_SHAPES.find((x) => x.id === d.shapeId);
    const st = ALL_CATALOG_STYLES.find((x) => x.id === d.styleId);
    if (s) setShape(s);
    if (st) setStyle(st);
    setCustomPalette(d.customPalette ?? null);
    setHeadingFont(d.headingFont ?? null);
    setBodyFont(d.bodyFont ?? null);
    setContent({ ...DEFAULT_CONTENT, ...d.content });
  };

  // Autosave (debounced) to Supabase once the account and last project are loaded.
  useEffect(() => {
    if (!restored.current || !account) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      const supabase = createSupabase();
      const data: SavedProject = { version: 1, content, shapeId: shape.id, styleId: style.id, customPalette, headingFont, bodyFont };
      const row = { name: content.projectName || "Sans titre", data };
      const res = projectId.current
        ? await supabase.from("projects").update(row).eq("id", projectId.current).select("id").single()
        : await supabase.from("projects").insert(row).select("id").single();
      if (res.error) return setSaveState("error");
      projectId.current = res.data.id;
      setSaveState("saved");
    }, 1200);
    return () => clearTimeout(t);
  }, [account, content, shape.id, style.id, customPalette, headingFont, bodyFont]);

  // ── Restore a shared design from the URL (#d=…) ────────────────────────
  useEffect(() => {
    const shared = decodeShare(window.location.hash);
    if (!shared) return;
    const s = ALL_CATALOG_SHAPES.find((x) => x.id === shared.shapeId);
    const st = ALL_CATALOG_STYLES.find((x) => x.id === shared.styleId);
    if (s) setShape(s);
    if (st) setStyle(st);
    setCustomPalette(shared.customPalette ?? null);
    setHeadingFont(shared.headingFont ?? null);
    setBodyFont(shared.bodyFont ?? null);
    setContent({
      projectName: shared.projectName ?? DEFAULT_CONTENT.projectName,
      brandName: shared.brandName ?? "",
      productName: shared.productName ?? "",
      tagline: shared.tagline ?? "",
      volume: shared.volume ?? "",
      details: shared.details ?? "",
    });
    showToast("✓ Design partagé chargé.");
  }, [showToast]);

  // ── Brief sent from the landing page (/create?prompt=…) ─────────────────
  const autoPrompt = useRef(false);
  useEffect(() => {
    if (autoPrompt.current) return;
    autoPrompt.current = true;
    const prompt = new URLSearchParams(window.location.search).get("prompt");
    if (!prompt) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    showToast("✨ Conception de votre packaging en cours…", 60000);
    handleGenerate(prompt, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────
  const updateContent = useCallback((patch: Partial<DesignContent>) => setContent((c) => ({ ...c, ...patch })), []);

  const handleSelectShape = (s: PackagingShape) => {
    setShape(s);
    showToast(`Contenant : ${s.name} (${s.dimensions})`);
  };

  const handleSelectStyle = (s: VisualStylePreset) => {
    setStyle(s);
    setCustomPalette(null);
    setHeadingFont(null);
    setBodyFont(null);
    showToast(`Style appliqué : ${s.label ?? s.name}`);
  };

  const handleChangeFont = (role: "heading" | "body", family: string) => {
    if (role === "heading") setHeadingFont(family);
    else setBodyFont(family);
  };

  const applySpec = (sp: DesignSpec) => {
    const s = ALL_CATALOG_SHAPES.find((x) => x.id === sp.shapeId);
    const st = ALL_CATALOG_STYLES.find((x) => x.id === sp.styleId);
    if (s) setShape(s);
    if (st) setStyle(st);
    setCustomPalette([sp.palette.background, sp.palette.ink, sp.palette.accent, sp.palette.extra]);
    setHeadingFont(sp.headingFont || null);
    setBodyFont(sp.bodyFont || null);
    setContent({
      projectName: sp.projectName,
      brandName: sp.brandName,
      productName: sp.productName,
      tagline: sp.tagline,
      volume: sp.volume,
      details: sp.details,
    });
  };

  const handleGenerate = async (prompt: string, reference: ReferenceFile | null) => {
    if (credits !== null && credits <= 0) {
      showToast("Vous n'avez plus de crédits IA. La recharge arrive bientôt.");
      return false;
    }
    setIsGenerating(true);
    try {
      const res = await fetch("/api/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          reference: reference ? { name: reference.name, mediaType: reference.mediaType, data: reference.data } : null,
          current: { shapeId: shape.id, styleId: style.id, brandName: content.brandName, productName: content.productName, volume: content.volume },
        }),
      });
      const json = await res.json();
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent("/create")}`;
        return false;
      }
      if (typeof json.credits === "number") setCredits(json.credits);
      if (res.status === 402) {
        showToast("Vous n'avez plus de crédits IA. La recharge arrive bientôt.");
        return false;
      }
      if (!res.ok || !json.spec) throw new Error(json.error || `HTTP ${res.status}`);
      applySpec(json.spec as DesignSpec);
      const msg = json.engine === "local" ? `Design généré hors ligne (aucun crédit utilisé). ${json.notice ?? ""}` : `✨ ${json.spec.rationale}`;
      showToast(msg, 7000);
      return true;
    } catch (e) {
      console.error(e);
      showToast("La génération a échoué. Vérifiez votre connexion et réessayez.");
      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      const res = await downloadPrintPdf(shape, fullDesign, content.projectName);
      showToast(`✓ PDF d'impression téléchargé (${res.dpi} dpi, fonds perdus 3 mm, tracé de découpe en page 2).`, 5000);
    } catch (e) {
      console.error(e);
      showToast("La création du PDF a échoué.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadZip = async () => {
    setIsExportingZip(true);
    try {
      const zip = new JSZip();
      const base = slugify(content.projectName) || shape.id;
      const pdf = await generatePrintPdf(shape, fullDesign, content.projectName);
      zip.file(`${base}-impression.pdf`, pdf.bytes);
      let shot = previewMode === "3d" ? captureRef.current?.() : null;
      if (!shot) {
        const { renderShowcase } = await import("@/lib/three/thumbnails");
        shot = await renderShowcase(shape, fullDesign, 1400, -0.5);
      }
      if (shot) zip.file(`${base}-apercu-3d.png`, shot.split(",")[1], { base64: true });
      try {
        const { exportGlb } = await import("@/lib/three/arExport");
        zip.file(`${base}-modele-3d.glb`, await exportGlb(spec, fullDesign));
      } catch (e) {
        console.warn("GLB export skipped", e);
      }
      zip.file(
        "fiche-technique.json",
        JSON.stringify(
          {
            projet: content.projectName,
            textes: content,
            contenant: { nom: shape.name, dimensions: shape.dimensions, materiau: shape.material },
            style: { nom: style.label ?? style.name, finition: style.finishing, palette: baseDesign.palette },
            polices: { titres: baseDesign.headingFont, textes: baseDesign.bodyFont },
            impression: { fondsPerdusMm: 3, resolutionDpi: pdf.dpi, formatAPlatMm: [pdf.layout.width, pdf.layout.height], gabarit: pdf.layout.kindLabel },
            export: new Date().toISOString(),
          },
          null,
          2
        )
      );
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `edify-${base}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast("✓ Archive téléchargée : PDF d'impression, aperçu 3D, modèle GLB et fiche technique.");
    } catch (e) {
      console.error(e);
      showToast("La création de l'archive a échoué.");
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}#d=${encodeShare({ ...content, ...selection })}`;
    window.history.replaceState(null, "", url);
    try {
      await navigator.clipboard.writeText(url);
      showToast(`✓ Lien copié !${uploadedLogo ? " (le logo importé n'est pas inclus dans le lien)" : ""}`);
    } catch {
      showToast("Lien prêt dans la barre d'adresse : copiez-le pour le partager.");
    }
  };

  const handleAddCredits = () => {
    showToast(`Il vous reste ${credits ?? 0} crédit${(credits ?? 0) > 1 ? "s" : ""} IA. La recharge arrive bientôt.`);
  };

  const exportBusy: ExportAction | null = isExportingPdf ? "pdf" : isExportingZip ? "zip" : null;
  const handleExport = (a: ExportAction) => {
    if (a === "pdf") handleDownloadPdf();
    else if (a === "zip") handleDownloadZip();
    else if (a === "ad") setIsAdOpen(true);
    else if (a === "ar") setIsArOpen(true);
    else handleShare();
  };

  return (
    <div className="st-app">
      {toast && (
        <div className="edify-toast" role="status">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <StudioTopBar
        projectName={content.projectName}
        onRename={(name) => updateContent({ projectName: name })}
        saveState={saveState}
        credits={credits}
        onCredits={handleAddCredits}
        account={account}
        busy={exportBusy}
        onExport={handleExport}
      />

      <div className="st-body">
        <StudioPanel
          tab={panelTab}
          onTab={setPanelTab}
          shape={shape}
          style={style}
          isCustomPalette={!!customPalette}
          headingFont={baseDesign.headingFont}
          bodyFont={baseDesign.bodyFont}
          content={content}
          logo={uploadedLogo}
          logoName={uploadedLogoName}
          onSelectShape={handleSelectShape}
          onSelectStyle={handleSelectStyle}
          onChangeFont={handleChangeFont}
          onChangeContent={updateContent}
          onLogoUpload={(dataUrl, name) => {
            setUploadedLogo(dataUrl);
            setUploadedLogoName(name);
            showToast(`✓ Logo « ${name} » appliqué au packaging.`);
          }}
          onRemoveLogo={() => {
            setUploadedLogo(null);
            setUploadedLogoName(null);
            showToast("Logo retiré.");
          }}
          onToast={showToast}
        />

        <main className="st-main">
          <PreviewStage
            mode={previewMode}
            onMode={setPreviewMode}
            shape={shape}
            spec={spec}
            design={fullDesign}
            baseDesign={baseDesign}
            logoUrl={uploadedLogo}
            onCaptureReady={handleCaptureReady}
          />
          <AiPromptDock onGenerate={handleGenerate} isGenerating={isGenerating} onToast={showToast} />
        </main>
      </div>

      <AdStudioModal isOpen={isAdOpen} onClose={() => setIsAdOpen(false)} spec={spec} design={fullDesign} projectName={content.projectName} onToast={showToast} />
      <ArModal isOpen={isArOpen} onClose={() => setIsArOpen(false)} spec={spec} design={fullDesign} projectName={content.projectName} onToast={showToast} />
    </div>
  );
}
