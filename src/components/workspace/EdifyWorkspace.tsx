"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { CheckCircle2 } from "lucide-react";
import { AiPromptDock, type ReferenceFile } from "./AiPromptDock";
import { StudioTopBar, type ExportAction } from "@/components/studio/StudioTopBar";
import { StudioPanel, type PanelTab } from "@/components/studio/StudioPanel";
import { PreviewStage, type PreviewMode } from "@/components/studio/PreviewStage";
import { AdStudioModal } from "./AdStudioModal";
import { DesignInProgress, DesignReveal, FirstPackagingInvite } from "./DesignReveal";
import { GameCelebration, GameChip, GamePanel, useGame } from "@/components/studio/Game";
import { normalizeEan } from "@/lib/print/ean13";
import { ArModal } from "./ArModal";
import type { PackagingShape, VisualStylePreset } from "./Modals";
import { ALL_CATALOG_SHAPES } from "@/lib/catalog/shapes";
import { ALL_CATALOG_STYLES } from "@/lib/catalog/styles";
import { toPackagingDesign, encodeShare, decodeShare, type DesignContent, type DesignExtras } from "@/lib/design/state";
import { luminance } from "@/lib/artwork/draw";
import type { PackagingDesign } from "@/lib/artwork/draw";
import type { PackagingSpec } from "@/lib/three/packagingModels";
import type { DesignSpec } from "@/lib/ai/designSpec";
import { generatePrintPdf, downloadPrintPdf, slugify } from "@/lib/print/exportPrintPdf";
import { useSmartLayout } from "@/components/studio/useSmartLayout";
import { PreflightDialog } from "@/components/studio/PreflightDialog";
import { loadDesignFonts } from "@/lib/artwork/draw";
import { computeSmartLayout } from "@/lib/artwork/smartLayout";
import { autoLayoutState, exportAllowed, fullPreflight, parseSmartLayoutState, sameState, stateFromResult, wrapPlacementFromState } from "@/lib/artwork/smartLayoutState";
import { resolveStructure, type PreflightReport } from "@/lib/structure";
import { UnsupportedDielineError } from "@/lib/print/layout";
import { createClient as createSupabase } from "@/lib/supabase/client";
import { briefContent, briefToPrompt, clearBrief, loadBrief } from "@/lib/design/brief";
import { PlanPaywall, type PaywallReason } from "@/components/billing/PlanPaywall";
import { hasProFeatures } from "@/lib/billing/plans";
import { analyzeLogo } from "@/lib/design/logoColors";
import { saveBlob } from "@/lib/download";

export interface ProjectItem {
  id: string;
  name: string;
  updated_at: string;
  counted: boolean;
}

interface SavedProject {
  version: 1;
  content: DesignContent;
  /** Uploaded logo (data URL), kept with the packaging. */
  logo?: string | null;
  logoName?: string | null;
  shapeId: string;
  styleId: string;
  customPalette: string[] | null;
  headingFont: string | null;
  bodyFont: string | null;
  layout?: string | null;
  motif?: string | null;
  extras?: DesignExtras | null;
  /** Applied smart layout (conical tubs, phase 2C-4F-4): validated on load, see artwork/smartLayoutState.ts. */
  smartLayout?: unknown;
  /** Automatic layout adjustment (phase 3B): on unless the user chose "Annuler l'ajustement". */
  smartLayoutAuto?: boolean;
}

/** Neutral placeholders: the studio never shows a demo product as if it were the user's. */
const DEFAULT_CONTENT: DesignContent = {
  projectName: "Nouveau packaging",
  brandName: "VOTRE MARQUE",
  productName: "Nom du produit",
  tagline: "Votre accroche",
  volume: "250 g",
  details: "",
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
  const [layout, setLayout] = useState<string | null>(null);
  const [motif, setMotif] = useState<string | null>(null);
  const [extras, setExtras] = useState<DesignExtras>({});
  const [artBusy, setArtBusy] = useState(false);
  const [content, setContent] = useState<DesignContent>(DEFAULT_CONTENT);
  const [uploadedLogo, setUploadedLogo] = useState<string | null>(null);
  const [uploadedLogoName, setUploadedLogoName] = useState<string | null>(null);

  const [credits, setCredits] = useState<number | null>(null);
  /** null = not loaded yet; the studio is usable, AI and downloads need an active plan. */
  const [planActive, setPlanActive] = useState<boolean | null>(null);
  const [paywall, setPaywall] = useState<null | PaywallReason>(null);
  const [plan, setPlan] = useState<string | null>(null);
  /** Answers the user typed in the wizard: never overwritten by the AI. */
  const keepFields = useRef<Partial<DesignContent>>({});
  const [account, setAccount] = useState<{ name: string; email: string; avatar: string | null; isAdmin?: boolean } | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const projectId = useRef<string | null>(null);
  /** Whether the current project already counts as one of the plan's packagings. */
  const [projectCounted, setProjectCounted] = useState(false);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  /** A brand-new design is being made: the preview shows the progress, never the previous pack. */
  const [designPending, setDesignPending] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [lastRationale, setLastRationale] = useState<string | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const restored = useRef(false);
  const creatingProject = useRef<Promise<string | null> | null>(null);
  /** Account, plan and projects are loaded (or there is no account): the brief may start. */
  const [ready, setReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isArOpen, setIsArOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("shape");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("flat");
  const [isAdOpen, setIsAdOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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
  // The illustration is too heavy for a share link: it stays in the saved project.
  const selection = { shapeId: shape.id, styleId: style.id, customPalette, headingFont, bodyFont, layout, motif, extras: { ...extras, artUrl: null } };
  const baseDesign = useMemo(
    () => toPackagingDesign(content, style, { shapeId: shape.id, styleId: style.id, customPalette, headingFont, bodyFont, layout, motif, extras }),
    [content, style, shape.id, customPalette, headingFont, bodyFont, layout, motif, extras]
  );
  const logoImg = useImage(uploadedLogo);
  const artImg = useImage(extras.artUrl ?? null);
  const designAsDrawn: PackagingDesign = useMemo(() => ({ ...baseDesign, logo: logoImg, art: artImg }), [baseDesign, logoImg, artImg]);
  const spec: PackagingSpec = useMemo(
    () => ({ model: shape.model ?? "box", lengthMm: shape.lengthMm, widthMm: shape.widthMm, heightMm: shape.heightMm, material: shape.material }),
    [shape]
  );
  // Smart layout (conical tubs): RECOMMEND by default; APPLY carries the planned offsets in the design,
  // so the preview, the 3D, the thumbnails and the PDF draw every element at the same place.
  const smartLayout = useSmartLayout(spec, designAsDrawn);
  // APPLY is a persistent state of the design (saved with the project): validated against the format,
  // drawn as it is after a reload; dropping it restores the original layout, which is never rewritten.
  const structure = useMemo(() => resolveStructure(spec), [spec]);
  const [smartLayoutRaw, setSmartLayoutRaw] = useState<unknown>(null);
  const [smartLayoutAuto, setSmartLayoutAuto] = useState(true);
  const smartState = useMemo(() => parseSmartLayoutState(smartLayoutRaw, structure).state, [smartLayoutRaw, structure]);
  const wrapPlacement = useMemo(() => (smartState ? wrapPlacementFromState(smartState) : undefined), [smartState]);
  // P0-2 (phase 3B): the correction the smart layout computes is applied automatically, once per result,
  // and follows the design; "Annuler l'ajustement" switches it off (kept with the project). Converges at
  // once: autoLayoutState is idempotent, so the new state never triggers another change.
  useEffect(() => {
    const next = autoLayoutState(smartLayout, smartState, smartLayoutAuto);
    if (!sameState(next, smartState)) setSmartLayoutRaw(next);
  }, [smartLayout, smartState, smartLayoutAuto]);
  const applySmartLayout = useCallback((on: boolean) => {
    setSmartLayoutAuto(on);
    setSmartLayoutRaw(on && smartLayout ? stateFromResult(smartLayout) : null);
  }, [smartLayout]);
  const fullDesign: PackagingDesign = useMemo(() => (wrapPlacement ? { ...designAsDrawn, wrapPlacement } : designAsDrawn), [designAsDrawn, wrapPlacement]);
  const stageBaseDesign = useMemo(() => (wrapPlacement ? { ...baseDesign, wrapPlacement } : baseDesign), [baseDesign, wrapPlacement]);
  // Preflight of the packaging as it will be printed (live in the preview; recomputed fresh before an export).
  const barcode = designAsDrawn.barcode;
  const preflight = useMemo(() => fullPreflight(structure, smartLayout?.elements ?? null, smartState, { barcode }), [structure, smartLayout, smartState, barcode]);
  const [preflightBlock, setPreflightBlock] = useState<PreflightReport | null>(null);
  const smartView = useMemo(
    () => (smartLayout ? { result: smartLayout, applied: !!smartState, auto: smartLayoutAuto, onApply: applySmartLayout, preflight } : null),
    [smartLayout, smartState, smartLayoutAuto, applySmartLayout, preflight]
  );

  const game = useGame(!!account);
  const { track } = game;

  // Small edits and a valid barcode count for the game (debounced).
  const editTick = useRef(0);
  useEffect(() => {
    if (!restored.current || !account) return;
    if (++editTick.current <= 2) return; // ignore the initial load
    const t = setTimeout(() => track("edit_text"), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);
  useEffect(() => {
    if (normalizeEan(content.barcode).ok) track("barcode_valid");
  }, [content.barcode, track]);
  useEffect(() => {
    if (previewMode === "3d") track("view_3d");
  }, [previewMode, track]);

  // Catalog thumbnails wear the user's current design (redrawn shortly after each edit).
  useEffect(() => {
    const t = setTimeout(() => {
      import("@/lib/three/thumbnails").then((m) => m.setThumbnailDesign(fullDesign, shape.id)).catch(() => {});
    }, 900);
    return () => clearTimeout(t);
  }, [fullDesign, shape.id]);

  // ── Account: profile, credits and the last saved project ──────────────
  useEffect(() => {
    const supabase = createSupabase();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const meta = user.user_metadata ?? {};
      const { data: profile } = await supabase.from("profiles").select("full_name, avatar_url, credits, plan, plan_expires_at, role").eq("id", user.id).single();
      setAccount({
        name: profile?.full_name || meta.full_name || meta.name || user.email?.split("@")[0] || "Mon compte",
        email: user.email ?? "",
        avatar: profile?.avatar_url || meta.avatar_url || null,
        isAdmin: profile?.role === "admin",
      });
      setCredits(profile?.credits ?? 0);
      const active = !!profile?.plan_expires_at && new Date(profile.plan_expires_at) > new Date();
      setPlanActive(active);
      setPlan(active ? profile?.plan ?? null : null);
      // A shared link or a landing brief takes precedence over the last saved project.
      const qs = new URLSearchParams(window.location.search);
      const fromLink = window.location.hash.includes("d=") || qs.has("prompt") || qs.has("brief");
      const { data: list } = await supabase.from("projects").select("id, name, updated_at, counted").order("updated_at", { ascending: false }).limit(100);
      setProjects((list ?? []) as ProjectItem[]);
      if (!list?.length && !fromLink) setShowInvite(true);
      // A brief or a shared link is a new packaging: it must never overwrite the last one.
      if (list?.length && !fromLink) {
        const { data: last } = await supabase.from("projects").select("id, data, counted").eq("id", list[0].id).single();
        if (last) {
          projectId.current = last.id;
          setProjectCounted(!!last.counted);
          restoreSaved(last.data as SavedProject);
        }
      }
      // A brief started before subscribing leaves an untitled, never-counted draft: reuse it
      // instead of creating a duplicate packaging.
      if (list?.length && fromLink && !list[0].counted && ["Nouveau packaging", "Sans titre"].includes(list[0].name)) {
        projectId.current = list[0].id;
      }
      restored.current = true;
    })()
      .catch(console.error)
      .finally(() => setReady(true));
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
    setLayout(d.layout ?? null);
    setMotif(d.motif ?? null);
    setExtras(d.extras ?? {});
    setSmartLayoutRaw(d.smartLayout ?? null);
    setSmartLayoutAuto(d.smartLayoutAuto ?? true);
    setContent({ ...DEFAULT_CONTENT, ...d.content });
    setUploadedLogo(d.logo ?? null);
    setUploadedLogoName(d.logoName ?? null);
  };

  // Autosave (debounced) to Supabase once the account and last project are loaded.
  useEffect(() => {
    if (!restored.current || !account) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      const supabase = createSupabase();
      const data: SavedProject = { version: 1, content, shapeId: shape.id, styleId: style.id, customPalette, headingFont, bodyFont, layout, motif, extras, logo: uploadedLogo, logoName: uploadedLogoName, smartLayout: smartState, smartLayoutAuto };
      const row = { name: (content.projectName || "Sans titre").slice(0, 120), data };
      const id = projectId.current ?? (await ensureProjectId());
      if (!id) return setSaveState("error");
      const res = await supabase.from("projects").update(row).eq("id", id).select("id").single();
      if (res.error) return setSaveState("error");
      projectId.current = res.data.id;
      setSaveState("saved");
      setProjects((list) => {
        const item = { id: res.data.id, name: row.name, updated_at: new Date().toISOString(), counted: list.find((p) => p.id === res.data.id)?.counted ?? projectCounted };
        return [item, ...list.filter((p) => p.id !== res.data.id)];
      });
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, content, shape.id, style.id, customPalette, headingFont, bodyFont, layout, motif, extras, uploadedLogo, uploadedLogoName, smartState, smartLayoutAuto]);

  /** Makes sure the packaging exists in the database (needed before the AI or a download). */
  const ensureProjectId = async () => {
    if (projectId.current) return projectId.current;
    // Single flight: the autosave and the AI may ask at the same time — create one packaging only.
    if (!creatingProject.current) {
      const data: SavedProject = { version: 1, content, shapeId: shape.id, styleId: style.id, customPalette, headingFont, bodyFont, layout, motif, extras, logo: uploadedLogo, logoName: uploadedLogoName, smartLayout: smartState, smartLayoutAuto };
      creatingProject.current = (async () => {
        const { data: row } = await createSupabase().from("projects").insert({ name: (content.projectName || "Nouveau packaging").slice(0, 120), data }).select("id").single();
        projectId.current = row?.id ?? null;
        return projectId.current;
      })().finally(() => {
        creatingProject.current = null;
      });
    }
    return creatingProject.current;
  };

  /** The first download counts the packaging in the plan (once). */
  const ensurePackagingClaimed = async () => {
    if (projectCounted) return true;
    const id = await ensureProjectId();
    const res = await fetch("/api/packaging/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: id }) });
    const json = await res.json().catch(() => ({}));
    if (typeof json.credits === "number") setCredits(json.credits);
    if (res.ok) {
      setProjectCounted(true);
      setProjects((list) => list.map((p) => (p.id === id ? { ...p, counted: true } : p)));
      return true;
    }
    if (res.status === 402) setPaywall(json.reason === "no_plan" ? "export" : "credits");
    else showToast("Impossible de vérifier votre abonnement. Réessayez.");
    return false;
  };

  const openProject = async (id: string) => {
    if (id === projectId.current) return;
    const { data } = await createSupabase().from("projects").select("id, data, counted").eq("id", id).single();
    if (!data) return;
    projectId.current = data.id;
    setProjectCounted(!!data.counted);
    restoreSaved(data.data as SavedProject);
    showToast(`Packaging ouvert : ${(data.data as SavedProject)?.content?.projectName ?? ""}`);
  };

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
    setLayout(shared.layout ?? null);
    setMotif(shared.motif ?? null);
    setExtras(shared.extras ?? {});
    setSmartLayoutRaw(null);
    setSmartLayoutAuto(true);
    setContent({
      projectName: shared.projectName ?? DEFAULT_CONTENT.projectName,
      brandName: shared.brandName ?? "",
      productName: shared.productName ?? "",
      tagline: shared.tagline ?? "",
      volume: shared.volume ?? "",
      details: shared.details ?? "",
      ingredients: shared.ingredients ?? "",
      usage: shared.usage ?? "",
      barcode: shared.barcode ?? "",
      expiry: shared.expiry ?? "",
      production: shared.production ?? "",
      price: shared.price ?? "",
      extra: shared.extra ?? "",
    });
    showToast("✓ Design partagé chargé.");
  }, [showToast]);

  // ── Brief sent from the landing page (/create?prompt=…) ─────────────────
  const autoPrompt = useRef(false);
  useEffect(() => {
    if (!ready || autoPrompt.current) return;
    autoPrompt.current = true;
    const qs = new URLSearchParams(window.location.search);
    const brief = qs.has("brief") ? loadBrief() : null;
    const prompt = brief ? briefToPrompt(brief) : qs.get("prompt");
    if (!prompt) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    if (brief) {
      // The user's own answers go on the pack right away and are kept after the AI design.
      keepFields.current = briefContent(brief);
      setContent((c) => ({ ...c, ...keepFields.current }));
      if (brief.logo) {
        setUploadedLogo(brief.logo);
        setUploadedLogoName(brief.logoName ?? "logo");
      }
    }
    if (brief) setDesignPending(true);
    else showToast("✨ Conception de votre packaging en cours…", 60000);
    (async () => {
      // The brief is a brand-new pack: the AI must not start from the studio's current design.
      const logo = brief?.logo ? await analyzeLogo(brief.logo).catch(() => null) : null;
      const ok = await handleGenerate(prompt, logo ? { name: "logo", mediaType: logo.mediaType, data: logo.data } : null, {
        fresh: !!brief,
        fields: brief ? briefContent(brief) : {},
        logoColors: logo?.colors ?? [],
      });
      if (ok && brief) clearBrief();
      setDesignPending(false);
      if (ok && brief) {
        setToast(null);
        setReveal(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

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
    setLastRationale(sp.rationale || null);
    const { ingredients: _i, usage: _u, ...keep } = keepFields.current;
    void _i;
    void _u;
    const s = ALL_CATALOG_SHAPES.find((x) => x.id === sp.shapeId);
    const st = ALL_CATALOG_STYLES.find((x) => x.id === sp.styleId);
    if (s) setShape(s);
    if (st) setStyle(st);
    setCustomPalette([sp.palette.background, sp.palette.ink, sp.palette.accent, sp.palette.extra]);
    setHeadingFont(sp.headingFont || null);
    setBodyFont(sp.bodyFont || null);
    setLayout(sp.layout || null);
    setMotif(sp.motif || null);
    setExtras({
      artUrl: null,
      artStyle: sp.artStyle,
      artSubject: sp.artSubject,
      badge: sp.badge,
      origin: sp.origin,
      contentColor: sp.contentColor,
      adHeadline: sp.adHeadline,
      adCta: sp.adCta,
    });
    setContent({
      projectName: sp.projectName,
      brandName: sp.brandName,
      productName: sp.productName,
      tagline: sp.tagline,
      volume: sp.volume,
      details: sp.details,
      barcode: "",
      expiry: "",
      production: "",
      price: "",
      extra: "",
      ...keep,
      // The AI rewrites the user's ingredients and directions faithfully, in French and English.
      ingredients: sp.ingredients?.trim() || keepFields.current.ingredients || "",
      usage: sp.usage?.trim() || keepFields.current.usage || "",
    });
  };

  const handleGenerate = async (
    prompt: string,
    reference: ReferenceFile | null,
    opts: { fresh?: boolean; fields?: Partial<DesignContent>; logoColors?: string[] } = {}
  ) => {
    // Designing is free to try: the paywall comes at download time.
    setIsGenerating(true);
    try {
      const pid = await ensureProjectId();
      const res = await fetch("/api/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          reference: reference ? { name: reference.name, mediaType: reference.mediaType, data: reference.data } : null,
          fresh: opts.fresh ?? false,
          projectId: pid,
          logoColors: opts.logoColors ?? [],
          current: {
            shapeId: shape.id,
            styleId: style.id,
            brandName: content.brandName,
            productName: content.productName,
            volume: content.volume,
            tagline: content.tagline,
            details: content.details,
            ingredients: content.ingredients,
            usage: content.usage,
            barcode: content.barcode,
            expiry: content.expiry,
            production: content.production,
            price: content.price,
            extra: content.extra,
            // Wizard answers override whatever the studio showed before.
            ...opts.fields,
          },
        }),
      });
      const json = await res.json();
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent("/create")}`;
        return false;
      }
      if (typeof json.credits === "number") setCredits(json.credits);
      if (json.projectId) projectId.current = json.projectId;
      if (res.status === 402) {
        setPaywall(json.reason === "no_plan" ? "generate" : "credits");
        return false;
      }
      if (res.status === 429 || res.status === 403) {
        showToast(json.error ?? "Limite de designs IA atteinte pour aujourd'hui.", 8000);
        return false;
      }
      if (json.projectId && !projectId.current) projectId.current = json.projectId;
      if (json.counted) {
        setProjectCounted(true);
        setProjects((list) => list.map((p) => (p.id === json.projectId ? { ...p, counted: true } : p)));
      }
      if (!res.ok || !json.spec) throw new Error(json.error || `HTTP ${res.status}`);
      const sp = json.spec as DesignSpec;
      applySpec(sp);
      // The custom illustration is part of the design: wait for it (the layouts fall back without it).
      if (sp.artStyle && sp.artStyle !== "none" && sp.artSubject) {
        await generateArt(sp.artStyle, sp.artSubject, [sp.palette.background, sp.palette.ink, sp.palette.accent, sp.palette.extra]);
      }
      if (json.engine !== "local") track("ai_design");
      if (opts.fresh) track("new_packaging");
      const msg = json.engine === "local" ? `Design généré hors ligne. ${json.notice ?? ""}` : `✨ ${json.spec.rationale}`;
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

  /** Custom illustration for the pack (FLUX), drawn on white or black so it blends into the label. */
  const generateArt = async (artStyle: string, subject: string, palette: string[]) => {
    setArtBusy(true);
    try {
      const [bg, ink, accent, extra] = palette;
      const res = await fetch("/api/ai-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "art", style: artStyle, subject, colors: [accent, extra, ink], background: bg, dark: luminance(bg) <= 0.45 }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.image) {
        setExtras((x) => ({ ...x, artUrl: json.image, artStyle, artSubject: subject }));
        return true;
      }
      if (res.status === 429) showToast("Limite d'illustrations IA atteinte pour aujourd'hui.");
      return false;
    } catch {
      return false;
    } finally {
      setArtBusy(false);
    }
  };

  const regenerateArt = (artStyle: string) => {
    const subject = extras.artSubject || `${content.productName}, key natural ingredients`;
    if (artStyle === "none") {
      setExtras((x) => ({ ...x, artStyle: "none", artUrl: null }));
      return;
    }
    generateArt(artStyle, subject, baseDesign.palette).then((ok) => ok && showToast("✓ Nouvelle illustration appliquée."));
  };

  /** Every download goes through here: plan check, then the packaging counts once. */
  const gateDownload = async () => {
    if (planActive === false) {
      setPaywall("export");
      return false;
    }
    return ensurePackagingClaimed();
  };

  /** Voice note → AI understanding → studio action (edit the pack or design a new one). */
  const handleVoice = async (audio: string) => {
    setVoiceBusy(true);
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio,
          context: { projectName: content.projectName, brandName: content.brandName, productName: content.productName, tagline: content.tagline, volume: content.volume, price: content.price, container: shape.name, style: style.label ?? style.name, layout, motif, palette: baseDesign.palette },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.command) {
        showToast(res.status === 401 ? "Connectez-vous pour utiliser les notes vocales." : "La note vocale n'a pas pu être analysée. Réessayez en parlant près du micro.");
        return;
      }
      const c = json.command as {
        transcript?: string; reply?: string; action?: string; designBrief?: string;
        edits?: Partial<Record<keyof DesignContent, string>>; layout?: string; motif?: string;
        colors?: { background?: string; accent?: string; ink?: string }; containerQuery?: string;
      };
      showToast(`🎙 « ${(c.transcript ?? "").slice(0, 120)} » — ${c.reply ?? ""}`, 8000);
      track("voice_note");
      if (c.action === "design" && c.designBrief) {
        await handleGenerate(c.designBrief, null);
        return;
      }
      if (c.action !== "edit") return;
      const edits = Object.fromEntries(Object.entries(c.edits ?? {}).filter(([, v]) => typeof v === "string" && v.trim())) as Partial<DesignContent>;
      if (Object.keys(edits).length) updateContent(edits);
      if (c.layout && c.layout !== "keep") setLayout(c.layout);
      if (c.motif && c.motif !== "keep") setMotif(c.motif);
      const hex = (v?: string) => (v && /^#[0-9a-f]{6}$/i.test(v) ? v : null);
      if (hex(c.colors?.background) || hex(c.colors?.accent) || hex(c.colors?.ink)) {
        const p = baseDesign.palette;
        setCustomPalette([hex(c.colors?.background) ?? p[0], hex(c.colors?.ink) ?? p[1], hex(c.colors?.accent) ?? p[2], p[3] ?? p[2]]);
      }
      if (c.containerQuery?.trim()) {
        const words = c.containerQuery.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/\s+/).filter((w) => w.length > 2);
        const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const best = ALL_CATALOG_SHAPES.map((sh) => ({ sh, score: words.filter((w) => norm(`${sh.name} ${sh.category ?? ""} ${sh.material ?? ""}`).includes(w)).length }))
          .sort((a, b) => b.score - a.score)[0];
        if (best?.score) setShape(best.sh);
      }
    } catch (e) {
      console.error(e);
      showToast("La note vocale n'a pas pu être envoyée. Vérifiez votre connexion.");
    } finally {
      setVoiceBusy(false);
    }
  };

  /**
   * Preflight of the artwork exactly as it will be exported: fresh record, the automatic adjustment
   * applied to this very artwork (phase 3B), and the design to export with it — the exported files use
   * THIS design, so the check and the print file can never differ. Throws if the check cannot run.
   */
  const preflightNow = async (): Promise<{ report: PreflightReport; design: PackagingDesign }> => {
    if (!structure.composition) return { report: fullPreflight(structure, null, null, designAsDrawn), design: fullDesign };
    await loadDesignFonts(designAsDrawn);
    const ctx = document.createElement("canvas").getContext("2d");
    const res = ctx ? computeSmartLayout(structure, designAsDrawn, ctx) : null;
    if (!res) throw new Error("preflight unavailable");
    const state = autoLayoutState(res, smartState, smartLayoutAuto);
    if (!sameState(state, smartState)) setSmartLayoutRaw(state);
    const design = state ? { ...designAsDrawn, wrapPlacement: wrapPlacementFromState(state) } : designAsDrawn;
    return { report: fullPreflight(structure, res.elements, state, designAsDrawn), design };
  };
  type Checked = Awaited<ReturnType<typeof preflightNow>>;
  const warningNote = (r: PreflightReport | null | undefined) => {
    const warnings = r?.issues.filter((i) => !i.blocking) ?? [];
    const content = warnings.find((i) => i.fix === "content" && i.elementId === "barcode");
    if (content) return ` ⚠ ${content.message}`;
    return warnings.length ? ` ⚠ ${warnings.length} avertissement${warnings.length > 1 ? "s" : ""} de mise en page.` : "";
  };

  const handleDownloadPdf = async (checked: Checked | null = null) => {
    setIsExportingPdf(true);
    try {
      const res = await downloadPrintPdf(shape, checked?.design ?? fullDesign, content.projectName);
      track("download_pdf");
      showToast(`✓ PDF d'impression téléchargé (${res.dpi} dpi, fonds perdus 3 mm, tracé de découpe en page 2).${warningNote(checked?.report)}`, 6000);
    } catch (e) {
      // Formats without a valid die-line template: refuse with the reason, never a fake pattern.
      if (e instanceof UnsupportedDielineError) showToast(e.message, 6000);
      else {
        console.error(e);
        showToast("La création du PDF a échoué.");
      }
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadZip = async (checked: Checked | null = null) => {
    const design = checked?.design ?? fullDesign;
    setIsExportingZip(true);
    try {
      const zip = new JSZip();
      const base = slugify(content.projectName) || shape.id;
      // No print PDF for formats without a valid die-line template; the rest of the archive still ships.
      let dielineNote: string | null = null;
      const pdf = await generatePrintPdf(shape, design, content.projectName).catch((e: unknown) => {
        if (!(e instanceof UnsupportedDielineError)) throw e;
        dielineNote = e.message;
        return null;
      });
      if (pdf) zip.file(`${base}-impression.pdf`, pdf.bytes);
      let shot = previewMode === "3d" ? captureRef.current?.() : null;
      if (!shot) {
        const { renderShowcase } = await import("@/lib/three/thumbnails");
        shot = await renderShowcase(shape, design, 1400, -0.5);
      }
      if (shot) zip.file(`${base}-apercu-3d.png`, shot.split(",")[1], { base64: true });
      try {
        const { exportGlb } = await import("@/lib/three/arExport");
        zip.file(`${base}-modele-3d.glb`, await exportGlb(spec, design));
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
            impression: pdf
              ? { fondsPerdusMm: 3, resolutionDpi: pdf.dpi, formatAPlatMm: [pdf.layout.width, pdf.layout.height], gabarit: pdf.layout.kindLabel }
              : { patron: "indisponible", raison: dielineNote },
            export: new Date().toISOString(),
          },
          null,
          2
        )
      );
      const blob = await zip.generateAsync({ type: "blob" });
      saveBlob(blob, `edify-${base}.zip`);
      showToast(
        pdf
          ? `✓ Archive téléchargée : PDF d'impression, aperçu 3D, modèle GLB et fiche technique.${warningNote(checked?.report)}`
          : "✓ Archive téléchargée : aperçu 3D, modèle GLB et fiche technique (pas de patron de découpe pour ce format).",
        6000
      );
    } catch (e) {
      console.error(e);
      showToast("La création de l'archive a échoué.");
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleShare = async () => {
    track("share");
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
    window.location.href = "/abonnement";
  };

  const exportBusy: ExportAction | null = isExportingPdf ? "pdf" : isExportingZip ? "zip" : null;
  const handleExport = async (a: ExportAction) => {
    // 3D model / AR and the full ZIP pack come with Pro and Business.
    if ((a === "ar" || a === "zip") && planActive && !hasProFeatures(plan)) {
      setPaywall("upgrade");
      return;
    }
    if (a === "ad") {
      // Creating the ad visual is free; downloading it goes through the paywall.
      setIsAdOpen(true);
      track("ad_visual");
      return;
    }
    // Print files (PDF, and the ZIP that carries it): preflight first. A blocking issue stops the export
    // here — before the plan gate, so nothing is claimed — and is shown with its fix; warnings go through.
    let checked: Checked | null = null;
    if (a === "pdf" || a === "zip") {
      try {
        checked = await preflightNow();
      } catch (e) {
        console.error(e);
        showToast("La vérification avant impression n'a pas pu être faite. Réessayez.");
        return;
      }
      if (!exportAllowed(checked.report)) {
        setPreflightBlock(checked.report);
        return;
      }
    }
    if (a !== "share" && !(await gateDownload())) return;
    if (a === "pdf") handleDownloadPdf(checked);
    else if (a === "zip") handleDownloadZip(checked);
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
        projects={projects}
        currentProjectId={projectId.current}
        onOpenProject={openProject}
        extra={<GameChip state={game.state} gain={game.gain} onOpen={() => setGameOpen(true)} />}
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
          layout={baseDesign.layout ?? "classic"}
          motif={baseDesign.motif ?? "none"}
          onChangeLayout={(v) => {
            setLayout(v);
            track("change_layout", v);
          }}
          onChangeMotif={(v) => setMotif(v)}
          artStyle={extras.artUrl ? extras.artStyle ?? "flat" : "none"}
          artBusy={artBusy}
          onRegenerateArt={regenerateArt}
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
            track("logo_upload");
            showToast(`✓ Logo « ${name} » appliqué au packaging.`);
          }}
          onRemoveLogo={() => {
            setUploadedLogo(null);
            setUploadedLogoName(null);
            showToast("Logo retiré.");
          }}
          onToast={showToast}
        />

        <main className="st-main st-main-rel">
          {designPending && <DesignInProgress />}
          {showInvite && !designPending && <FirstPackagingInvite onDismiss={() => setShowInvite(false)} />}
          <PreviewStage
            mode={previewMode}
            onMode={setPreviewMode}
            shape={shape}
            spec={spec}
            design={fullDesign}
            baseDesign={stageBaseDesign}
            smart={smartView}
            logoUrl={uploadedLogo}
            onCaptureReady={handleCaptureReady}
            onViewChange={(v) => v === "back" && track("view_back")}
          />
          <AiPromptDock onGenerate={handleGenerate} isGenerating={isGenerating} onToast={showToast} onVoice={handleVoice} voiceBusy={voiceBusy} />
        </main>
      </div>

      <AdStudioModal isOpen={isAdOpen} onClose={() => setIsAdOpen(false)} spec={spec} design={fullDesign} projectName={content.projectName} onToast={showToast} onBeforeDownload={gateDownload} />
      <DesignReveal
        open={reveal}
        onClose={() => setReveal(false)}
        shape={shape}
        spec={spec}
        design={fullDesign}
        projectName={content.projectName}
        rationale={lastRationale}
        onBeforeDownload={gateDownload}
        onDownloadPdf={() => {
          setReveal(false);
          handleExport("pdf");
        }}
        onOpen3d={() => {
          setReveal(false);
          setPreviewMode("3d");
        }}
      />
      <GamePanel open={gameOpen} state={game.state} onClose={() => setGameOpen(false)} />
      <GameCelebration celebration={game.celebration} onClose={game.dismissCelebration} />
      <PlanPaywall open={!!paywall} reason={paywall ?? "generate"} onClose={() => setPaywall(null)} />
      <PreflightDialog
        report={preflightBlock}
        canFix={!!smartLayout && !!preflightBlock?.issues.some((i) => i.blocking && i.fix === "smart-layout")}
        onFix={() => {
          applySmartLayout(true);
          setPreflightBlock(null);
          setPreviewMode("flat");
          showToast("✓ Positions recommandées appliquées. Vérifiez le patron puis relancez le téléchargement.", 6000);
        }}
        onClose={() => setPreflightBlock(null)}
      />
      <ArModal isOpen={isArOpen} onClose={() => setIsArOpen(false)} spec={spec} design={fullDesign} projectName={content.projectName} onToast={showToast} />
    </div>
  );
}
