"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  Trash2,
  FileCheck,
  Check,
  Edit2,
  Search,
  X,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { PackagingShape, VisualStylePreset } from "./Modals";
import { SHAPE_CATEGORIES, searchShapes } from "@/lib/catalog/shapes";
import { STYLE_FAMILIES, searchStyles } from "@/lib/catalog/styles";
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

interface LeftSidebarProps {
  selectedShape: PackagingShape;
  selectedStyle: VisualStylePreset;
  uploadedLogo: string | null;
  uploadedLogoName: string | null;
  projectName: string;
  onSelectShape: (shape: PackagingShape) => void;
  onSelectStyle: (style: VisualStylePreset) => void;
  onOpenShapeModal?: () => void;
  onOpenStyleModal?: () => void;
  onLogoUpload: (dataUrl: string, fileName: string) => void;
  onRemoveLogo: () => void;
  onRenameProject: (newName: string) => void;
  className?: string;
}

export function LeftSidebar({
  selectedShape,
  selectedStyle,
  uploadedLogo,
  uploadedLogoName,
  projectName,
  onSelectShape,
  onSelectStyle,
  onLogoUpload,
  onRemoveLogo,
  onRenameProject,
  className = "",
}: LeftSidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(projectName);
  const [shapeCategory, setShapeCategory] = useState<string>("all");
  const [shapeQuery, setShapeQuery] = useState("");
  const [styleFamily, setStyleFamily] = useState<string>("all");
  const [styleQuery, setStyleQuery] = useState("");

  // ── File Upload helpers ──────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readFile(file);
  };

  const readFile = (file: File) => {
    if (!file.type.startsWith("image/") && !file.name.endsWith(".svg")) {
      alert("Veuillez sélectionner une image valide (PNG, SVG, JPG, WebP)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result as string;
      if (result) onLogoUpload(result, file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) onRenameProject(tempName.trim());
    setIsEditingName(false);
  };

  // ── Filtered catalogs ────────────────────────────────────────────────────
  const visibleShapes = useMemo(() => searchShapes(shapeQuery, shapeCategory), [shapeQuery, shapeCategory]);
  const visibleStyles = useMemo(() => searchStyles(styleQuery, styleFamily), [styleQuery, styleFamily]);

  return (
    <aside className={`edify-left-column ${className}`} data-purpose="left-sidebar">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ── Header ── */}
      <div className="edify-sidebar-header">
        <div className="flex items-center space-x-2.5">
          <div className="edify-brand-badge transition-transform duration-300 hover:scale-105">E</div>
          <span className="text-base font-extrabold tracking-tight text-slate-900">Edify</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="edify-pulse-dot" />
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
            v2.4 Pro
          </span>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="edify-scrollable-content text-sm">

        {/* Logo / Artwork Dropzone */}
        <div className="space-y-2" data-purpose="upload-section">
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-brand-500" />
              Votre logo ou image
            </label>
            <span className="text-[10px] text-slate-400 font-semibold">PNG, SVG, JPG</span>
          </div>

          {uploadedLogo ? (
            <div className="edify-logo-preview-card hover-lift">
              <div className="edify-logo-thumb-wrapper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={uploadedLogo} alt="Logo chargé" className="edify-logo-thumbnail" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate max-w-[140px]">
                    {uploadedLogoName || "logo-vector.png"}
                  </p>
                  <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                    <FileCheck className="w-3 h-3" /> Appliqué au patron 2D
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onRemoveLogo}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Supprimer le logo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={`edify-dropzone hover-lift ${isDragOver ? "drag-active" : ""}`}
            >
              <div className="edify-dropzone-icon">
                <Upload className="w-5 h-5" />
              </div>
              <p className="mt-2 text-xs font-bold text-slate-700">Glissez-déposez le fichier</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ou <span className="text-brand-600 font-semibold underline underline-offset-2">parcourir</span>
              </p>
            </div>
          )}
        </div>

        {/* ── Forme du packaging — searchable 3D catalog ── */}
        <div className="space-y-2.5" data-purpose="packaging-shape-section">
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-800 text-xs">Forme du packaging</label>
            <span className="text-[10px] text-slate-400 font-semibold">
              {visibleShapes.length} modèle{visibleShapes.length > 1 ? "s" : ""}
            </span>
          </div>

          <SearchField value={shapeQuery} onChange={setShapeQuery} placeholder="Rechercher : flacon, pochette, canette…" />

          <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
            {SHAPE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setShapeCategory(cat.id)}
                className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all duration-200 ${
                  shapeCategory === cat.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="max-h-[440px] overflow-y-auto pr-1 -mr-1">
            {visibleShapes.length ? (
              <div className="grid grid-cols-2 gap-x-2.5 gap-y-3">
                {visibleShapes.map((shape) => (
                  <ShapeCard
                    key={shape.id}
                    shape={shape}
                    selected={shape.id === selectedShape.id}
                    onSelect={() => onSelectShape(shape)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 text-center py-6">
                Aucun contenant ne correspond à « {shapeQuery} ».
              </p>
            )}
          </div>
        </div>

        {/* ── Style visuel — family dropdown + search + scrolling list ── */}
        <div className="space-y-2.5" data-purpose="visual-style-section">
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-800 text-xs">Style visuel</label>
            <span className="text-[10px] text-slate-400 font-semibold">
              {visibleStyles.length} style{visibleStyles.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="relative">
            <select
              value={styleFamily}
              onChange={(e) => setStyleFamily(e.target.value)}
              className="w-full appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:border-slate-400 focus:outline-none cursor-pointer"
              aria-label="Famille de styles"
            >
              {STYLE_FAMILIES.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <SearchField value={styleQuery} onChange={setStyleQuery} placeholder="Rechercher : luxe, kraft, pastel…" />

          <div className="max-h-[300px] overflow-y-auto pr-1 -mr-1 space-y-1">
            {visibleStyles.map((style) => {
              const isSelected = style.id === selectedStyle.id;
              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => onSelectStyle(style)}
                  title={style.name}
                  aria-pressed={isSelected}
                  className={`w-full flex items-center gap-2.5 p-1.5 pr-2.5 rounded-xl border text-left transition-all duration-150 ${
                    isSelected ? "border-slate-900 bg-slate-900" : "border-transparent hover:bg-slate-100"
                  }`}
                >
                  <span className="grid grid-cols-2 w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-black/10">
                    {style.palette.slice(0, 4).map((color, idx) => (
                      <span key={idx} style={{ backgroundColor: color }} />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-xs font-bold leading-tight ${isSelected ? "text-white" : "text-slate-800"}`}>
                      {style.label ?? style.name}
                    </span>
                    <span className={`block text-[10px] leading-tight truncate ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                      {style.hint ?? style.subtitle}
                    </span>
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-white flex-shrink-0" />}
                </button>
              );
            })}
            {!visibleStyles.length && (
              <p className="text-[11px] text-slate-500 text-center py-6">Aucun style trouvé.</p>
            )}
          </div>
        </div>

        {/* Pro tips card */}
        <div className="edify-guidelines-card hover-lift" data-purpose="pro-tips-card">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="edify-guidelines-badge">i</span>
            <h4 className="text-xs font-bold text-amber-950">Conseils packaging certifié</h4>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-900/90 font-medium">
            • <strong>300 DPI</strong> natif pour vectorisation<br />
            • Fond perdu sécurisé de <strong>3 mm</strong> inclus<br />
            • Profil colorimétrique certifié <strong>CMJN FOGRA39</strong>
          </p>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="edify-sidebar-footer">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-800 flex-shrink-0">
            ED
          </div>
          {isEditingName ? (
            <form onSubmit={handleNameSubmit} className="min-w-0">
              <input
                type="text"
                autoFocus
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleNameSubmit}
                className="text-xs font-bold text-slate-900 px-1 py-0.5 border border-brand-500 rounded outline-none w-32"
              />
            </form>
          ) : (
            <div
              onClick={() => setIsEditingName(true)}
              className="flex items-center gap-1.5 cursor-pointer group min-w-0"
              title="Cliquer pour renommer"
            >
              <span className="font-bold text-slate-800 truncate max-w-[130px] group-hover:text-brand-600 transition-colors">
                {projectName}
              </span>
              <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
        </div>
        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Auto-sync
        </span>
      </div>
    </aside>
  );
}
