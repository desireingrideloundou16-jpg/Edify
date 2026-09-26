"use client";

import React, { useState } from "react";
import { 
  Minus, 
  Plus, 
  Maximize2, 
  Sparkles,
  Edit2
} from "lucide-react";
import { PackagingShape, VisualStylePreset } from "./Modals";

interface Canvas2DWorkspaceProps {
  selectedShape: PackagingShape;
  selectedStyle: VisualStylePreset;
  uploadedLogo: string | null;
  brandName: string;
  productName: string;
  volume: string;
  ingredients: string;
  activeIngredient: string;
  onUpdateText: (fields: Partial<{
    brandName: string;
    productName: string;
    volume: string;
    ingredients: string;
    activeIngredient: string;
  }>) => void;
}

export function Canvas2DWorkspace({
  selectedShape,
  selectedStyle,
  uploadedLogo,
  brandName,
  productName,
  volume,
  ingredients,
  activeIngredient,
  onUpdateText,
}: Canvas2DWorkspaceProps) {
  const [zoom, setZoom] = useState<number>(100);

  const [editingField, setEditingField] = useState<string | null>(null);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 15, 180));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 15, 60));
  const handleResetZoom = () => setZoom(100);

  const scaleFactor = zoom / 100;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] relative overflow-hidden select-none font-sans" data-purpose="main-canvas-workspace">
      {/* Top Workspace Toolbar */}
      <header className="edify-canvas-header">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-brand-500" />
            <h1 className="text-sm font-extrabold text-slate-900 tracking-tight font-sans">
              Patron de découpe à plat (2D)
            </h1>
          </div>
        </div>

        {/* Canvas Inspection & Zoom Tools */}
        <div className="flex items-center space-x-2.5">

          {/* Zoom Controls */}
          <div className="edify-zoom-controls">
            <button
              onClick={handleZoomOut}
              className="edify-zoom-btn"
              title="Zoom -"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="edify-zoom-value">{zoom}%</span>
            <button
              onClick={handleZoomIn}
              className="edify-zoom-btn"
              title="Zoom +"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleResetZoom}
            className="p-2 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition hover-lift"
            title="Centrer la vue à 100%"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Center 2D Die-Line Technical Canvas Viewport (Clean Neutral Background without Dots) */}
      <div 
        className="edify-canvas-bg flex-1 overflow-auto flex items-center justify-center p-6 sm:p-10 relative touch-pan-canvas"
        data-purpose="die-line-viewport"
      >
        {/* Scaled Die-Line Technical Assembly */}
        <div 
          className="edify-die-assembly-card"
          style={{ transform: `scale(${scaleFactor})`, transformOrigin: "center center" }}
        >
          {/* Dimensions Header Indicator */}
          <div className="w-full flex items-center justify-between pb-3.5 border-b border-slate-100 text-xs font-sans">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
              <span className="font-extrabold text-slate-800 uppercase tracking-wide">
                PATRON {selectedShape.name.toUpperCase()} (4 FACES + RABATS)
              </span>
            </div>
            <span className="font-extrabold text-slate-800 bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg">
              {selectedShape.dimensions}
            </span>
          </div>

          {/* Dimension Guide Arrows (Top) */}
          {(
            <div className="edify-dimension-guides mt-4">
              <span>← Languette: 10 mm</span>
              <span>Face A: {selectedShape.lengthMm} mm</span>
              <span>Face B: {selectedShape.widthMm} mm</span>
              <span>Face C: {selectedShape.lengthMm} mm</span>
              <span>Face D: {selectedShape.widthMm} mm →</span>
            </div>
          )}

          {/* The Flat Packaging Fold Structure */}
          <div className="edify-die-panels-row">
            {/* Panel 0: Glue Flap (Languette de colle) */}
            <div className={"edify-panel-glue"}>
              <span className="text-[10px] text-slate-500 font-sans font-extrabold -rotate-90 whitespace-nowrap tracking-wider">
                GLUE TAB (10mm)
              </span>
            </div>

            {/* Panel 1: Back Panel (Dos) */}
            <div className="edify-die-panel">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest text-center">
                Dos
              </span>
              <div className="space-y-2 text-[9px] text-slate-500">
                <div className="h-2.5 bg-slate-200 rounded-sm w-3/4" />
                <div className="h-2.5 bg-slate-100 rounded-sm w-full" />
                <div className="h-2.5 bg-slate-100 rounded-sm w-5/6" />
                <div className="pt-4 flex flex-col items-center">
                  <div className="edify-barcode">
                    |||| || |||
                  </div>
                  <span className="text-[9px] font-sans font-semibold text-slate-500 mt-1">
                    3700123456789
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-slate-500 text-center font-sans font-bold">
                {selectedShape.heightMm} mm
              </span>
            </div>

            {/* Panel 2: Left Side (Côté Gauche) */}
            <div className="edify-die-panel">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest text-center">
                Côté Gauche
              </span>
              <div className="text-center my-auto px-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-600 font-extrabold">
                  Ingrédients
                </p>
                {editingField === "ingredients" ? (
                  <textarea
                    autoFocus
                    value={ingredients}
                    onChange={(e) => onUpdateText({ ingredients: e.target.value })}
                    onBlur={() => setEditingField(null)}
                    className="w-full text-[9px] font-sans p-1.5 border border-brand-500 rounded-lg text-slate-800 bg-white"
                    rows={3}
                  />
                ) : (
                  <p 
                    onClick={() => setEditingField("ingredients")}
                    className="text-[9px] text-slate-600 leading-snug mt-1.5 font-sans font-medium hover:text-brand-600 cursor-pointer transition-colors"
                    title="Cliquer pour modifier les ingrédients"
                  >
                    {ingredients}
                  </p>
                )}
              </div>
              <div className="text-center text-[10px] font-bold text-slate-500">
                Made in France
              </div>
            </div>

            {/* Panel 3: Front Facing Panel (Face Avant - Branding & Artwork) */}
            <div
              className={`edify-die-panel edify-panel-front relative ${selectedStyle.bgGradient}`}
              style={selectedStyle.bgGradient ? undefined : { background: `linear-gradient(180deg, ${selectedStyle.palette[0]}40 0%, #ffffff 100%)` }}
            >
              {/* Safety margin indicator */}
              {(
                <div className="absolute inset-1.5 border border-emerald-400/80 border-dotted pointer-events-none rounded-sm" />
              )}

              <div className="text-center pt-2 relative z-10">
                {/* Brand Emblem or Uploaded Logo */}
                {uploadedLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={uploadedLogo} 
                    alt="Logo" 
                    className="w-8 h-8 mx-auto object-contain mb-1 rounded-sm shadow-xs"
                  />
                ) : (
                  <div className="w-7 h-7 mx-auto rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold mb-1 shadow-sm">
                    {selectedStyle.badge}
                  </div>
                )}

                {/* Editable Brand Name */}
                {editingField === "brandName" ? (
                  <input
                    type="text"
                    autoFocus
                    value={brandName}
                    onChange={(e) => onUpdateText({ brandName: e.target.value.toUpperCase() })}
                    onBlur={() => setEditingField(null)}
                    className="w-full text-center text-xs font-extrabold font-sans border border-brand-500 rounded bg-white"
                  />
                ) : (
                  <h3 
                    onClick={() => setEditingField("brandName")}
                    className="text-xs font-black text-slate-900 tracking-wider uppercase font-sans cursor-pointer hover:text-brand-600 transition"
                    title="Cliquer pour modifier la marque"
                  >
                    {brandName}
                  </h3>
                )}

                <span className="text-[9px] text-brand-600 font-bold tracking-widest uppercase block -mt-0.5 font-sans">
                  Botanics
                </span>
              </div>

              {/* Central graphic/text element */}
              <div className="text-center py-2 relative z-10">
                <div 
                  className="w-13 h-13 mx-auto rounded-full flex items-center justify-center border shadow-xs"
                  style={{ 
                    backgroundColor: `${selectedStyle.primaryColor}15`, 
                    borderColor: `${selectedStyle.primaryColor}40` 
                  }}
                >
                  <span 
                    className="text-xs font-extrabold font-sans"
                    style={{ color: selectedStyle.primaryColor }}
                  >
                    Huile
                  </span>
                </div>

                {editingField === "productName" ? (
                  <input
                    type="text"
                    autoFocus
                    value={productName}
                    onChange={(e) => onUpdateText({ productName: e.target.value })}
                    onBlur={() => setEditingField(null)}
                    className="w-full text-center text-[9px] font-bold border border-brand-500 rounded bg-white mt-1.5"
                  />
                ) : (
                  <p 
                    onClick={() => setEditingField("productName")}
                    className="text-[9px] font-extrabold text-slate-900 uppercase tracking-wider mt-1.5 cursor-pointer hover:text-brand-600 transition"
                    title="Cliquer pour modifier le produit"
                  >
                    {productName}
                  </p>
                )}

                <p className="text-[8px] text-slate-600 uppercase tracking-widest font-semibold font-sans">
                  Nectar Précieux
                </p>
              </div>

              <div className="text-center pb-1 relative z-10">
                {editingField === "volume" ? (
                  <input
                    type="text"
                    autoFocus
                    value={volume}
                    onChange={(e) => onUpdateText({ volume: e.target.value })}
                    onBlur={() => setEditingField(null)}
                    className="w-full text-center text-[9px] font-bold border border-brand-500 rounded bg-white font-sans"
                  />
                ) : (
                  <span 
                    onClick={() => setEditingField("volume")}
                    className="text-[9px] font-sans text-slate-800 bg-white/90 border border-slate-200/90 px-2.5 py-1 rounded-md font-bold cursor-pointer hover:border-brand-500 shadow-2xs"
                    title="Cliquer pour modifier la contenance"
                  >
                    {volume}
                  </span>
                )}
              </div>
            </div>

            {/* Panel 4: Right Side (Côté Droit - Cut Line indicator) */}
            <div className={"edify-die-panel edify-die-panel-cut-edge"}>
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest text-center">
                Côté Droit
              </span>
              <div className="space-y-1.5 my-auto text-center px-1">
                <div className="w-8 h-8 mx-auto rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                  <Sparkles className="w-4 h-4 text-brand-500" />
                </div>
                <p className="text-[9px] font-extrabold text-slate-800 uppercase">
                  Actifs Clés
                </p>
                {editingField === "activeIngredient" ? (
                  <input
                    type="text"
                    autoFocus
                    value={activeIngredient}
                    onChange={(e) => onUpdateText({ activeIngredient: e.target.value })}
                    onBlur={() => setEditingField(null)}
                    className="w-full text-center text-[8px] font-bold border border-brand-500 rounded bg-white"
                  />
                ) : (
                  <p 
                    onClick={() => setEditingField("activeIngredient")}
                    className="text-[8px] text-slate-600 font-semibold cursor-pointer hover:text-brand-600 transition"
                    title="Cliquer pour modifier"
                  >
                    {activeIngredient}
                  </p>
                )}
              </div>
              <div className="text-center text-[9px] text-slate-500 font-sans font-bold">
                12M / RECYCLABLE
              </div>
            </div>
          </div>

          {/* Top/Bottom Flaps Indicators */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-6 text-[11px] text-slate-600 font-sans font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 border border-blue-400 bg-blue-50 rounded-xs" /> Rainures de rabat fermées
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 border border-emerald-400 bg-emerald-50 rounded-xs" /> Tolérance d'impression : ±0.2 mm
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
