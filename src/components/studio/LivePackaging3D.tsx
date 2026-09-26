"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  RotateCcw,
  Sparkles,
  Download,
  Eye,
  Maximize2,
  Box,
  Layers,
  CheckCircle2,
  Share2,
  Play,
  Pause,
  Printer
} from "lucide-react";

export type PackagingType = "jar" | "bottle" | "box" | "can";

export interface PackagingDesignState {
  type: PackagingType;
  brandName: string;
  productName: string;
  tagline: string;
  primaryColor: string; // Hex for background
  accentColor: string;  // Hex for accents / gold foil
  textColor: string;    // Hex for typography
  style: string;        // "luxe", "organic", "minimalist", "pop", "vintage"
  keywords: string[];
  volumeOrWeight: string; // e.g., "250g", "50ml", "330ml"
  finish: "matte" | "gloss" | "kraft" | "metallic";
}

interface LivePackaging3DProps {
  design: PackagingDesignState;
  onChangeType: (type: PackagingType) => void;
  isGenerating?: boolean;
}

export const LivePackaging3D: React.FC<LivePackaging3DProps> = ({
  design,
  onChangeType,
  isGenerating = false,
}) => {
  const [rotation, setRotation] = useState({ x: -10, y: 25 });
  const [isDragging, setIsDragging] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const startPos = useRef({ x: 0, y: 0 });

  // Auto-rotation effect
  useEffect(() => {
    if (!autoRotate || isDragging) return;
    const interval = setInterval(() => {
      setRotation((prev) => ({
        ...prev,
        y: (prev.y + 0.6) % 360,
      }));
    }, 30);
    return () => clearInterval(interval);
  }, [autoRotate, isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    setRotation((prev) => ({
      x: Math.max(-45, Math.min(45, prev.x - dy * 0.4)),
      y: prev.y + dx * 0.5,
    }));
    startPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setRotation({ x: -10, y: 25 });
  };

  const handleDownloadMockup = () => {
    // Generate snapshot feedback
    const alertEl = document.createElement("div");
    alertEl.className = "fixed bottom-8 right-8 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold z-50 animate-fade-in flex items-center gap-2";
    alertEl.innerHTML = `<span>✓ Mockup 3D HD exporté avec succès !</span>`;
    document.body.appendChild(alertEl);
    setTimeout(() => alertEl.remove(), 3000);
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-50/70 border-l border-slate-200/80 select-none overflow-hidden">
      {/* ── Top Bar with Product Type Switcher ────────────────────────── */}
      <div className="px-5 py-3.5 border-b border-slate-200/80 bg-white/80 backdrop-blur-md flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-800 tracking-tight">
            Aperçu 3D en direct
          </span>
        </div>

        {/* Packaging Form Factor Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
          {[
            { id: "jar", label: "Bocal / Pot", icon: "🍯" },
            { id: "bottle", label: "Flacon", icon: "🧴" },
            { id: "box", label: "Boîte", icon: "📦" },
            { id: "can", label: "Canette", icon: "🥫" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeType(item.id as PackagingType)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                design.type === item.id
                  ? "bg-white text-slate-900 font-bold shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <span>{item.icon}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 3D Viewport Scene Canvas ─────────────────────────────────── */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="flex-1 relative flex items-center justify-center cursor-grab active:cursor-grabbing overflow-hidden bg-gradient-to-b from-white via-slate-50 to-slate-100/60"
        style={{ perspective: "1000px" }}
      >
        {/* Soft Background Multicolor Aura Light */}
        <div 
          className="absolute w-80 h-80 rounded-full blur-3xl opacity-30 pointer-events-none transition-all duration-700"
          style={{
            background: `radial-gradient(circle, ${design.accentColor} 0%, ${design.primaryColor} 60%, transparent 80%)`,
          }}
        />

        {/* Loading Overlay when generating */}
        {isGenerating && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-500 to-amber-400 flex items-center justify-center shadow-xl animate-spin">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <p className="text-xs font-bold text-slate-800 animate-pulse">
              L'IA applique le packaging en 3D...
            </p>
          </div>
        )}

        {/* ── 3D Object Container ────────────────────────────────────── */}
        <div
          className="relative transition-transform duration-75 ease-out"
          style={{
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          {/* ── VARIANT 1: Bocal avec étiquette (Jar / Pot) ─────────── */}
          {design.type === "jar" && (
            <div className="relative flex flex-col items-center">
              {/* Lid / Couvercle (Metallic / Gold or Dark) */}
              <div
                className="w-48 h-10 rounded-t-xl shadow-md border-b-2 border-black/10 relative overflow-hidden"
                style={{
                  background: `linear-gradient(90deg, #94A3B8 0%, #E2E8F0 40%, #FFFFFF 60%, #64748B 100%)`,
                }}
              >
                <div className="absolute inset-0 cylinder-gradient" />
                <div className="absolute top-1 left-4 right-4 h-1 rounded-full bg-white/40" />
              </div>

              {/* Glass Body */}
              <div
                className="w-44 h-56 rounded-b-3xl relative shadow-2xl flex items-center justify-center overflow-hidden border border-slate-300/40"
                style={{
                  background: "linear-gradient(135deg, rgba(248,250,252,0.92) 0%, rgba(226,232,240,0.85) 100%)",
                }}
              >
                {/* Cylinder reflections */}
                <div className="absolute inset-0 cylinder-gradient z-10 pointer-events-none" />

                {/* The Label Wrapped on the Jar */}
                <div
                  className="w-40 h-36 rounded-lg shadow-lg relative flex flex-col items-center justify-between p-3.5 text-center overflow-hidden border"
                  style={{
                    backgroundColor: design.primaryColor,
                    borderColor: `${design.accentColor}50`,
                  }}
                >
                  {/* Decorative Border on Label */}
                  <div
                    className="absolute inset-1.5 border border-dashed rounded pointer-events-none opacity-60"
                    style={{ borderColor: design.accentColor }}
                  />

                  {/* Top Label Tagline & Badge */}
                  <div className="relative z-10">
                    <span
                      className="text-[8px] uppercase tracking-widest font-extrabold block"
                      style={{ color: design.accentColor }}
                    >
                      ✦ {design.tagline || "ÉDITION LIMITÉE"} ✦
                    </span>
                  </div>

                  {/* Brand & Product Name */}
                  <div className="relative z-10 my-auto">
                    <h3
                      className="text-sm font-extrabold tracking-tight leading-tight uppercase"
                      style={{ color: design.textColor }}
                    >
                      {design.brandName || "VOTRE MARQUE"}
                    </h3>
                    <p
                      className="text-[10px] font-semibold mt-0.5"
                      style={{ color: design.accentColor }}
                    >
                      {design.productName || "Recette Artisanale"}
                    </p>
                  </div>

                  {/* Bottom Label Specs */}
                  <div className="relative z-10 flex items-center justify-between w-full px-1 text-[8px] font-mono font-bold" style={{ color: design.textColor }}>
                    <span>100% NATUREL</span>
                    <span>{design.volumeOrWeight || "250g"}</span>
                  </div>
                </div>
              </div>

              {/* Ground Shadow */}
              <div className="w-48 h-6 bg-slate-900/15 rounded-full blur-md -mt-2" />
            </div>
          )}

          {/* ── VARIANT 2: Bouteille / Flacon (Bottle / Serum) ──────── */}
          {design.type === "bottle" && (
            <div className="relative flex flex-col items-center">
              {/* Dropper Cap / Bouchon Pipette */}
              <div className="w-10 h-10 rounded-t-full bg-slate-800 shadow" />
              <div
                className="w-16 h-8 rounded-t-lg shadow border-b"
                style={{
                  background: `linear-gradient(90deg, ${design.accentColor}90 0%, #FFFFFF 50%, ${design.accentColor} 100%)`,
                }}
              />

              {/* Bottle Body */}
              <div
                className="w-36 h-60 rounded-b-2xl relative shadow-2xl flex items-center justify-center overflow-hidden border border-slate-300/30"
                style={{
                  background: `linear-gradient(135deg, ${design.primaryColor}20 0%, #F1F5F9 100%)`,
                }}
              >
                <div className="absolute inset-0 cylinder-gradient z-10 pointer-events-none" />

                {/* Minimalist Serum Label */}
                <div
                  className="w-32 h-44 rounded-md shadow-md relative flex flex-col items-center justify-between p-3 text-center border"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: `${design.accentColor}40`,
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-full border flex items-center justify-center mb-1 text-[11px]"
                    style={{ borderColor: design.accentColor, color: design.accentColor }}
                  >
                    ✦
                  </div>

                  <div>
                    <h4
                      className="text-xs font-extrabold tracking-wider uppercase"
                      style={{ color: "#0F172A" }}
                    >
                      {design.brandName || "L'ÉLIXIR"}
                    </h4>
                    <p
                      className="text-[9px] font-medium tracking-wide mt-0.5"
                      style={{ color: design.accentColor }}
                    >
                      {design.productName || "Sérum Réparateur"}
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-1 w-full text-[8px] text-slate-500 font-mono">
                    {design.volumeOrWeight || "50 ml"} · HAUTE EFFICACITÉ
                  </div>
                </div>
              </div>

              {/* Shadow */}
              <div className="w-40 h-5 bg-slate-900/15 rounded-full blur-md -mt-2" />
            </div>
          )}

          {/* ── VARIANT 3: Boîte étui pliant (Cosmetic Box) ─────────── */}
          {design.type === "box" && (
            <div className="relative flex flex-col items-center">
              <div
                className="w-44 h-64 rounded-xl shadow-2xl relative flex flex-col justify-between p-4 overflow-hidden border"
                style={{
                  backgroundColor: design.primaryColor,
                  borderColor: `${design.accentColor}50`,
                }}
              >
                {/* Geometric gold accents */}
                <div
                  className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-20 pointer-events-none"
                  style={{ backgroundColor: design.accentColor }}
                />

                <div className="relative z-10">
                  <span
                    className="text-[8px] uppercase tracking-widest font-extrabold"
                    style={{ color: design.accentColor }}
                  >
                    {design.tagline || "PARFUM & SOIN"}
                  </span>
                </div>

                <div className="relative z-10 my-auto text-center">
                  <div
                    className="w-10 h-10 rounded-full border-2 mx-auto mb-2 flex items-center justify-center font-bold text-sm"
                    style={{ borderColor: design.accentColor, color: design.accentColor }}
                  >
                    ✦
                  </div>
                  <h3
                    className="text-base font-black tracking-widest uppercase"
                    style={{ color: design.textColor }}
                  >
                    {design.brandName || "EDIFY"}
                  </h3>
                  <p
                    className="text-xs font-semibold mt-1"
                    style={{ color: design.accentColor }}
                  >
                    {design.productName || "Coffret Sublime"}
                  </p>
                </div>

                <div
                  className="relative z-10 flex items-center justify-between pt-2 border-t text-[8px] font-mono font-bold"
                  style={{ borderColor: `${design.accentColor}30`, color: design.textColor }}
                >
                  <span>PARIS</span>
                  <span>{design.volumeOrWeight || "100 ml"}</span>
                </div>
              </div>

              {/* Shadow */}
              <div className="w-48 h-6 bg-slate-900/15 rounded-full blur-md -mt-2" />
            </div>
          )}

          {/* ── VARIANT 4: Canette (Beverage Can) ───────────────────── */}
          {design.type === "can" && (
            <div className="relative flex flex-col items-center">
              {/* Can Top Rim & Tab */}
              <div
                className="w-36 h-6 rounded-t-xl shadow border-b relative overflow-hidden"
                style={{
                  background: "linear-gradient(90deg, #CBD5E1 0%, #F8FAFC 50%, #94A3B8 100%)",
                }}
              >
                <div className="w-8 h-2 rounded-full bg-slate-400 mx-auto mt-1" />
              </div>

              {/* Can Body */}
              <div
                className="w-36 h-64 rounded-b-2xl relative shadow-2xl flex flex-col justify-between p-4 overflow-hidden border border-slate-300/40"
                style={{
                  backgroundColor: design.primaryColor,
                }}
              >
                <div className="absolute inset-0 cylinder-gradient z-10 pointer-events-none" />

                <div className="relative z-20">
                  <span
                    className="text-[9px] uppercase tracking-widest font-black"
                    style={{ color: design.accentColor }}
                  >
                    {design.tagline || "PÉTILLANT & FRAIS"}
                  </span>
                </div>

                <div className="relative z-20 my-auto text-center">
                  <h3
                    className="text-lg font-black tracking-tight leading-none uppercase"
                    style={{ color: design.textColor }}
                  >
                    {design.brandName || "SODA CITRON"}
                  </h3>
                  <p
                    className="text-xs font-bold mt-1"
                    style={{ color: design.accentColor }}
                  >
                    {design.productName || "Citron Vert Givré"}
                  </p>
                </div>

                <div
                  className="relative z-20 flex items-center justify-between text-[8px] font-black font-mono"
                  style={{ color: design.textColor }}
                >
                  <span>ZÉRO SUCRE</span>
                  <span>{design.volumeOrWeight || "330 ml"}</span>
                </div>
              </div>

              {/* Shadow */}
              <div className="w-40 h-5 bg-slate-900/15 rounded-full blur-md -mt-2" />
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Floating Controls ─────────────────────────────────── */}
      <div className="p-4 bg-white border-t border-slate-200/80 flex items-center justify-between z-20">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-2 rounded-xl border text-xs font-medium transition-colors flex items-center gap-1.5 ${
              autoRotate
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
            }`}
            title={autoRotate ? "Arrêter la rotation" : "Activer rotation 360°"}
          >
            {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="text-[11px] font-semibold">{autoRotate ? "360° Actif" : "360° Pause"}</span>
          </button>

          <button
            onClick={handleReset}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 transition-colors"
            title="Recadrer la vue"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadMockup}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md shadow-slate-900/10 transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Mockup 3D HD</span>
          </button>
        </div>
      </div>
    </div>
  );
};
