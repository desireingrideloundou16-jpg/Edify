"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  Trash2,

  Check,
  ImagePlus,
  Search,
  X,
  Loader2,
} from "lucide-react";
import type { PackagingShape, VisualStylePreset } from "@/components/workspace/Modals";
import type { DesignContent } from "@/lib/design/state";
import { normalizeEan } from "@/lib/print/ean13";
import { LAYOUTS, LAYOUT_LABELS, MOTIFS, MOTIF_LABELS } from "@/lib/artwork/compose";
import { SHAPE_CATEGORIES, searchShapes } from "@/lib/catalog/shapes";
import { STYLE_FAMILIES, ALL_CATALOG_STYLES } from "@/lib/catalog/styles";
import { PACKAGING_FONTS, type FontCategory } from "@/lib/catalog/fonts";

const FONT_GROUPS: [FontCategory, string][] = [
  ["sans", "Sans-serif (moderne)"],
  ["serif", "Serif (élégant)"],
  ["display", "Display (impact)"],
  ["script", "Manuscrite"],
  ["mono", "Machine à écrire"],
];
import { requestThumbnail } from "@/lib/three/thumbnails";

// ─── 3D thumbnail card (rendered lazily when scrolled into view) ─────────────

function ShapeCard({ shape, selected, onSelect }: {
  shape: PackagingShape;
  selected: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancel: (() => void) | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !cancel) {
          cancel = requestThumbnail(shape, setUrl);
          io.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancel?.();
    };
  }, [shape]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      title={`${shape.name} — ${shape.dimensions}`}
      aria-pressed={selected}
      className="group text-left"
    >
      <div
        className={`relative aspect-square rounded-xl border bg-white overflow-hidden transition-all duration-200 ${
          selected ? "border-slate-900 ring-2 ring-slate-900/10" : "border-slate-200 group-hover:border-slate-400 group-hover:shadow-md"
        }`}
      >
        <span className="absolute top-1.5 left-1.5 text-[9px] font-extrabold text-slate-400 tracking-wide">3D</span>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        )}
        {selected && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-slate-900 text-white flex items-center justify-center">
            <Check className="w-2.5 h-2.5" />
          </span>
        )}
      </div>
      <p className={`mt-1 text-[11px] leading-tight font-semibold truncate ${selected ? "text-slate-900" : "text-slate-600 group-hover:text-slate-900"}`}>
        {shape.name}
      </p>
    </button>
  );
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:outline-none transition"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-700"
          aria-label="Effacer la recherche"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}


// ─── Panel ──────────────────────────────────────────────────────────────────

export type PanelTab = "shape" | "style" | "text";

const TABS: { id: PanelTab; n: number; label: string }[] = [
  { id: "shape", n: 1, label: "Contenant" },
  { id: "style", n: 2, label: "Style" },
  { id: "text", n: 3, label: "Textes" },
];

type TextKey = "brandName" | "productName" | "tagline" | "volume" | "details" | "ingredients" | "usage" | "extra" | "expiry" | "production";

const LABEL_AREAS: { key: TextKey; label: string; placeholder: string }[] = [
  { key: "ingredients", label: "Ingrédients", placeholder: "Par ordre décroissant, allergènes en MAJUSCULES" },
  { key: "usage", label: "Mode d'emploi", placeholder: "Comment utiliser ou conserver le produit" },
  { key: "details", label: "Description et fabricant", placeholder: "Origine, conservation, « Fabriqué par … »" },
  { key: "extra", label: "Autres mentions", placeholder: "Lot, contact, certifications réelles…" },
];

const LABEL_DATES: { key: TextKey; label: string }[] = [
  { key: "production", label: "Date de production" },
  { key: "expiry", label: "Date de péremption" },
];

const TEXT_FIELDS: { key: TextKey; label: string; placeholder: string }[] = [
  { key: "brandName", label: "Marque", placeholder: "Ex. LUMINA" },
  { key: "productName", label: "Nom du produit", placeholder: "Ex. Sérum éclat" },
  { key: "tagline", label: "Accroche", placeholder: "Ex. Vitamine C pure" },
  { key: "volume", label: "Contenance", placeholder: "Ex. 30 ml" },
];

interface StudioPanelProps {
  tab: PanelTab;
  onTab: (t: PanelTab) => void;
  shape: PackagingShape;
  style: VisualStylePreset;
  isCustomPalette: boolean;
  headingFont: string;
  bodyFont: string;
  content: DesignContent;
  logo: string | null;
  logoName: string | null;
  onSelectShape: (s: PackagingShape) => void;
  onSelectStyle: (s: VisualStylePreset) => void;
  onChangeFont: (role: "heading" | "body", family: string) => void;
  layout: string;
  motif: string;
  onChangeLayout: (layout: string) => void;
  onChangeMotif: (motif: string) => void;
  onChangeContent: (patch: Partial<DesignContent>) => void;
  onLogoUpload: (dataUrl: string, name: string) => void;
  onRemoveLogo: () => void;
  onToast: (msg: string) => void;
}

export function StudioPanel(props: StudioPanelProps) {
  const { tab, onTab } = props;
  return (
    <aside className="st-panel" aria-label="Réglages du packaging">
      <div className="st-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            className={`st-tab ${tab === t.id ? "is-active" : ""}`}
            onClick={() => onTab(t.id)}
          >
            <span className="st-tab-n">{t.n}</span>
            {t.label}
          </button>
        ))}
      </div>
      <div className="st-panel-body">
        {tab === "shape" && <ShapeTab {...props} />}
        {tab === "style" && <StyleTab {...props} />}
        {tab === "text" && <TextTab {...props} />}
      </div>
    </aside>
  );
}

function ShapeTab({ shape, onSelectShape }: StudioPanelProps) {
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => searchShapes(query, category), [query, category]);
  return (
    <div className="st-section">
      <p className="st-help">Choisissez la forme de votre emballage.</p>
      <SearchField value={query} onChange={setQuery} placeholder="Rechercher : flacon, pochette, canette…" />
      <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
        {SHAPE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategory(cat.id)}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold transition ${
              category === cat.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
      {visible.length ? (
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-3">
          {visible.map((s) => (
            <ShapeCard key={s.id} shape={s} selected={s.id === shape.id} onSelect={() => onSelectShape(s)} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500 text-center py-6">Aucun contenant ne correspond à « {query} ».</p>
      )}
    </div>
  );
}

function StyleTab({ style, isCustomPalette, headingFont, bodyFont, onSelectStyle, onChangeFont, layout, motif, onChangeLayout, onChangeMotif }: StudioPanelProps) {
  return (
    <div className="st-section">
      <label htmlFor="st-style" className="st-label">Style visuel</label>
      <select
        id="st-style"
        className="edify-select"
        value={isCustomPalette ? "__custom" : style.id}
        onChange={(e) => {
          const s = ALL_CATALOG_STYLES.find((x) => x.id === e.target.value);
          if (s) onSelectStyle(s);
        }}
      >
        {isCustomPalette && <option value="__custom">✦ Sur mesure (créé par l&apos;IA)</option>}
        {STYLE_FAMILIES.filter((f) => f.id !== "all").map((fam) => (
          <optgroup key={fam.id} label={fam.label}>
            {ALL_CATALOG_STYLES.filter((s) => s.category === fam.id).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label ?? s.name} — {s.hint ?? s.subtitle}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="st-label">Mise en page</span>
          <select className="edify-select" value={layout} onChange={(e) => onChangeLayout(e.target.value)}>
            {LAYOUTS.map((l) => <option key={l} value={l}>{LAYOUT_LABELS[l]}</option>)}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="st-label">Motif</span>
          <select className="edify-select" value={motif} onChange={(e) => onChangeMotif(e.target.value)}>
            {MOTIFS.map((m) => <option key={m} value={m}>{MOTIF_LABELS[m]}</option>)}
          </select>
        </label>
      </div>

      {([
        ["heading", "Police des titres", headingFont],
        ["body", "Police des textes", bodyFont],
      ] as const).map(([role, label, value]) => (
        <label key={role} className="block space-y-1.5">
          <span className="st-label">{label}</span>
          <select className="edify-select" value={value} style={{ fontFamily: `"${value}", sans-serif` }} onChange={(e) => onChangeFont(role, e.target.value)}>
            {FONT_GROUPS.map(([cat, catLabel]) => (
              <optgroup key={cat} label={catLabel}>
                {PACKAGING_FONTS.filter((f) => f.category === cat).map((f) => (
                  <option key={f.id} value={f.family} style={{ fontFamily: `"${f.family}"` }}>
                    {f.family}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      ))}
      <p className="st-help">Astuce : décrivez l&apos;ambiance souhaitée dans la barre du bas, l&apos;IA choisit le style et les polices pour vous.</p>
    </div>
  );
}

function TextTab({ content, logo, logoName, onChangeContent, onLogoUpload, onRemoveLogo, onToast }: StudioPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const ean = normalizeEan(content.barcode);
  const read = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return onToast("Choisissez une image : PNG, SVG, JPG ou WebP.");
    const reader = new FileReader();
    reader.onload = () => onLogoUpload(String(reader.result), file.name);
    reader.readAsDataURL(file);
  };
  return (
    <div className="st-section">
      <span className="st-label">Votre logo</span>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={(e) => read(e.target.files?.[0])} />
      {logo ? (
        <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="Logo importé" className="w-10 h-10 object-contain rounded-md bg-slate-50" />
            <span className="text-xs font-semibold text-slate-700 truncate">{logoName ?? "logo"}</span>
          </div>
          <button type="button" onClick={onRemoveLogo} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" aria-label="Retirer le logo">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            read(e.dataTransfer.files?.[0]);
          }}
          className={`st-drop ${drag ? "is-drag" : ""}`}
        >
          <ImagePlus className="w-5 h-5" />
          <span>Ajouter votre logo</span>
          <small>Glissez un fichier ou cliquez · PNG, SVG, JPG</small>
        </button>
      )}

      {TEXT_FIELDS.map((f) => (
        <label key={f.key} className="block space-y-1.5">
          <span className="st-label">{f.label}</span>
          <input className="edify-input" value={content[f.key] ?? ""} placeholder={f.placeholder} maxLength={80} onChange={(e) => onChangeContent({ [f.key]: e.target.value })} />
        </label>
      ))}
      <p className="st-group">Mentions du dos · français / anglais</p>
      {LABEL_AREAS.map((f) => (
        <label key={f.key} className="block space-y-1.5">
          <span className="st-label">{f.label}</span>
          <textarea
            className="edify-input resize-y min-h-[72px]"
            value={content[f.key] ?? ""}
            maxLength={600}
            placeholder={f.placeholder}
            onChange={(e) => onChangeContent({ [f.key]: e.target.value })}
          />
        </label>
      ))}
      <div className="grid grid-cols-2 gap-3">
        {LABEL_DATES.map((f) => (
          <label key={f.key} className="block space-y-1.5">
            <span className="st-label">{f.label}</span>
            <input type="date" className="edify-input" value={/^\d{4}-\d{2}-\d{2}$/.test(content[f.key] ?? "") ? content[f.key] : ""} onChange={(e) => onChangeContent({ [f.key]: e.target.value })} />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="st-label">Code-barres EAN-13</span>
          <input className="edify-input" inputMode="numeric" value={content.barcode ?? ""} placeholder="13 chiffres" maxLength={20} onChange={(e) => onChangeContent({ barcode: e.target.value.replace(/[^\d\s-]/g, "") })} />
        </label>
        <label className="block space-y-1.5">
          <span className="st-label">Prix (facultatif)</span>
          <input className="edify-input" value={content.price ?? ""} placeholder="Ex. 2 500 FCFA" maxLength={30} onChange={(e) => onChangeContent({ price: e.target.value })} />
        </label>
      </div>
      {content.barcode?.trim() && (
        <p className={`st-hint ${ean.ok ? "text-emerald-600" : "text-amber-600"}`}>
          {ean.ok ? "✓ Code valide, imprimé en vrai code-barres." : ean.reason === "checksum" ? `Code invalide : le dernier chiffre devrait être ${ean.expected}.` : "Un code EAN-13 comporte 13 chiffres (12 pour un UPC)."}
        </p>
      )}
    </div>
  );
}
