"use client";

import React from "react";
export type ShapeCategory =
  | "boxes" | "bottles" | "jars" | "pouches" | "tubes_cans"
  | "cans" | "cups" | "bags" | "food" | "tins";

/** 3D model family used by the WebGL renderer (see lib/three/packagingModels). */
export type ShapeModel =
  | "box" | "mailer" | "rigid" | "pillow" | "tray"
  | "bottle" | "wine" | "dropper" | "pump" | "spray" | "jug"
  | "jar" | "tin" | "tub"
  | "pouch" | "flatpouch" | "sachet" | "bag" | "shopper"
  | "tube" | "papertube" | "can" | "cup" | "carton";

export interface PackagingShape {
  id: string;
  name: string;
  category: ShapeCategory;
  categoryLabel: string;
  dimensions: string;
  material: string;
  description: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  renderIllustration: () => React.ReactNode;
  model?: ShapeModel;
  keywords?: string[];
}

export type StyleFamily =
  | "eco" | "luxury" | "vintage" | "modern" | "wellness"
  | "minimal" | "playful" | "food" | "cultural" | "bold";

export interface VisualStylePreset {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  badge: string;
  primaryColor: string;
  accentColor: string;
  palette: string[];
  bgGradient: string;
  fontFamily: string;
  finishing: string;
  category: StyleFamily;
  /** Short one-word label + a few words, for quick picking in the sidebar. */
  label?: string;
  hint?: string;
}

// ─── 3D Realistic Vector Illustrations Components ───────────────────────────

// 1. Boîte Pliante Standard
export function IllustrationFoldingBox() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md" fill="none">
      {/* Shadow */}
      <ellipse cx="50" cy="85" rx="32" ry="7" fill="rgba(0,0,0,0.08)" />
      {/* Left panel (shaded) */}
      <path d="M28 32 L48 44 L48 80 L28 66 Z" fill="url(#box-left-grad)" />
      {/* Front panel (light) */}
      <path d="M48 44 L72 32 L72 66 L48 80 Z" fill="url(#box-front-grad)" stroke="rgba(236,72,153,0.3)" strokeWidth="0.8" />
      {/* Top flap (highlight) */}
      <path d="M48 18 L72 32 L48 44 L28 32 Z" fill="url(#box-top-grad)" />
      {/* Front panel artwork line */}
      <circle cx="60" cy="52" r="6" fill="#ec4899" fillOpacity="0.2" stroke="#ec4899" strokeWidth="0.6" />
      <path d="M54 62 L66 62" stroke="#ec4899" strokeWidth="0.8" strokeLinecap="round" />
      {/* Definitions */}
      <defs>
        <linearGradient id="box-top-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f1f5f9" />
        </linearGradient>
        <linearGradient id="box-left-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
        <linearGradient id="box-front-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fdf2f8" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// 2. Coffret Rigide Cloche (Luxe)
export function IllustrationRigidBox() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md" fill="none">
      <ellipse cx="50" cy="85" rx="38" ry="8" fill="rgba(0,0,0,0.1)" />
      {/* Base */}
      <path d="M22 52 L50 66 L78 52 L78 72 L50 84 L22 72 Z" fill="#1e293b" />
      {/* Lid left */}
      <path d="M20 40 L50 56 L50 68 L20 52 Z" fill="#0f172a" />
      {/* Lid right */}
      <path d="M50 56 L80 40 L80 52 L50 68 Z" fill="#1e293b" />
      {/* Lid top */}
      <path d="M50 24 L80 40 L50 56 L20 40 Z" fill="url(#rigid-gold-rim)" stroke="#f59e0b" strokeWidth="0.8" />
      {/* Gold branding badge on lid */}
      <rect x="44" y="36" width="12" height="7" rx="1.5" transform="rotate(-15 44 36)" fill="#f59e0b" fillOpacity="0.8" />
      <defs>
        <linearGradient id="rigid-gold-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="50%" stopColor="#334155" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// 3. Flacon Compte-Goutte (Serum Dropper)
export function IllustrationDropperBottle() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md" fill="none">
      <ellipse cx="50" cy="88" rx="20" ry="5" fill="rgba(0,0,0,0.12)" />
      {/* Bottle glass body */}
      <rect x="36" y="44" width="28" height="42" rx="4" fill="url(#amber-glass)" stroke="#d97706" strokeWidth="0.8" />
      {/* Glass reflection streak */}
      <path d="M40 46 L40 82" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" />
      {/* Label wrap */}
      <rect x="36" y="52" width="28" height="24" fill="#ffffff" />
      <path d="M41 58 L59 58" stroke="#ec4899" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M44 64 L56 64" stroke="#64748b" strokeWidth="0.8" strokeLinecap="round" />
      {/* Gold collar */}
      <rect x="42" y="36" width="16" height="8" rx="1" fill="url(#gold-collar)" stroke="#b45309" strokeWidth="0.5" />
      {/* Rubber bulb */}
      <path d="M45 36 C45 25 55 25 55 36 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.8" />
      <defs>
        <linearGradient id="amber-glass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#b45309" />
          <stop offset="50%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        <linearGradient id="gold-collar" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// 4. Pot Cosmétique Crème (Cosmetic Jar)
export function IllustrationCosmeticJar() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md" fill="none">
      <ellipse cx="50" cy="84" rx="30" ry="7" fill="rgba(0,0,0,0.12)" />
      {/* Glass Jar Body */}
      <path d="M26 48 C26 48 24 78 50 78 C76 78 74 48 74 48 Z" fill="url(#jar-glass)" stroke="rgba(255,255,255,0.8)" strokeWidth="1" />
      {/* Product inside */}
      <path d="M30 52 C30 52 28 72 50 72 C72 72 70 52 70 52 Z" fill="#fdf2f8" opacity="0.9" />
      {/* Glossy Lid */}
      <ellipse cx="50" cy="46" rx="26" ry="7" fill="url(#gold-lid-top)" />
      <rect x="24" y="38" width="52" height="8" rx="2" fill="url(#gold-lid-side)" stroke="#b45309" strokeWidth="0.6" />
      <ellipse cx="50" cy="38" rx="26" ry="6" fill="#fde68a" />
      <defs>
        <linearGradient id="jar-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
          <stop offset="50%" stopColor="rgba(241,245,249,0.5)" />
          <stop offset="100%" stopColor="rgba(203,213,225,0.8)" />
        </linearGradient>
        <linearGradient id="gold-lid-top" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="50%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="gold-lid-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#b45309" />
          <stop offset="30%" stopColor="#fde68a" />
          <stop offset="70%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// 5. Doypack Stand-up Pouch (Sachet zippé)
export function IllustrationDoypack() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md" fill="none">
      <ellipse cx="50" cy="88" rx="28" ry="6" fill="rgba(0,0,0,0.1)" />
      {/* Pouch body */}
      <path d="M26 28 L74 28 L70 82 C64 86 36 86 30 82 Z" fill="url(#kraft-grad)" stroke="#92400e" strokeWidth="0.8" />
      {/* Top heat seal line */}
      <rect x="25" y="24" width="50" height="7" rx="1.5" fill="#a16207" />
      <path d="M25 27.5 L75 27.5" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
      {/* Tear notch */}
      <path d="M25 35 L28 36 L25 37 Z" fill="#ffffff" />
      {/* Center artwork label */}
      <rect x="34" y="44" width="32" height="26" rx="2" fill="#ffffff" stroke="rgba(146,64,14,0.3)" strokeWidth="0.8" />
      <circle cx="50" cy="54" r="5" fill="#f59e0b" fillOpacity="0.2" stroke="#d97706" strokeWidth="0.8" />
      <path d="M42 63 L58 63" stroke="#475569" strokeWidth="1" strokeLinecap="round" />
      <defs>
        <linearGradient id="kraft-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d97706" />
          <stop offset="50%" stopColor="#b45309" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// 6. Boîte Postale E-commerce (Mailer Box)
export function IllustrationMailerBox() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md" fill="none">
      <ellipse cx="50" cy="85" rx="38" ry="7" fill="rgba(0,0,0,0.1)" />
      {/* Box base left */}
      <path d="M16 48 L48 64 L48 80 L16 64 Z" fill="#92400e" />
      {/* Box base right */}
      <path d="M48 64 L84 48 L84 64 L48 80 Z" fill="#b45309" />
      {/* Lid angled top */}
      <path d="M48 26 L84 42 L48 58 L16 42 Z" fill="#d97706" stroke="#fef3c7" strokeWidth="0.8" />
      {/* Front flap clasp */}
      <path d="M40 54 L56 62 L56 66 L40 58 Z" fill="#78350f" />
    </svg>
  );
}

// 7. Flacon Pompe Cosmétique (Pump Bottle)
export function IllustrationPumpBottle() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md" fill="none">
      <ellipse cx="50" cy="88" rx="18" ry="5" fill="rgba(0,0,0,0.12)" />
      {/* Cylinder body */}
      <rect x="36" y="38" width="28" height="48" rx="3" fill="url(#pump-bottle-grad)" stroke="#cbd5e1" strokeWidth="0.8" />
      <rect x="36" y="46" width="28" height="28" fill="#ffffff" />
      <path d="M42 56 L58 56" stroke="#ec4899" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M45 62 L55 62" stroke="#94a3b8" strokeWidth="0.8" strokeLinecap="round" />
      {/* Gold pump collar */}
      <rect x="43" y="31" width="14" height="7" rx="1" fill="#f59e0b" stroke="#b45309" strokeWidth="0.5" />
      {/* Pump spout */}
      <path d="M48 31 L48 20 L60 22 L60 25 L52 24 L52 31 Z" fill="#ffffff" stroke="#94a3b8" strokeWidth="0.8" />
      <defs>
        <linearGradient id="pump-bottle-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="50%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// 8. Tube Souple Cosmétique (Squeeze Tube)
export function IllustrationSqueezeTube() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md" fill="none">
      <ellipse cx="50" cy="88" rx="16" ry="4" fill="rgba(0,0,0,0.1)" />
      {/* Tube body tapered */}
      <path d="M36 28 L64 28 L60 76 L40 76 Z" fill="url(#tube-gradient)" stroke="#cbd5e1" strokeWidth="0.8" />
      {/* Crimped top seam */}
      <rect x="35" y="24" width="30" height="5" rx="1" fill="#94a3b8" />
      {/* Artwork on tube */}
      <circle cx="50" cy="46" r="6" fill="#ec4899" fillOpacity="0.2" stroke="#ec4899" strokeWidth="0.8" />
      <path d="M44 58 L56 58" stroke="#334155" strokeWidth="1" strokeLinecap="round" />
      {/* Flip cap bottom */}
      <rect x="42" y="76" width="16" height="10" rx="2" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.8" />
      <defs>
        <linearGradient id="tube-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fce7f3" />
          <stop offset="50%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f1f5f9" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// 9. Canette Aluminium (Beverage Can)
export function IllustrationCanette() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md" fill="none">
      <ellipse cx="50" cy="86" rx="18" ry="5" fill="rgba(0,0,0,0.14)" />
      {/* Can Body */}
      <rect x="34" y="28" width="32" height="56" rx="4" fill="url(#aluminum-can-grad)" stroke="#94a3b8" strokeWidth="0.8" />
      {/* Top rim & tab */}
      <ellipse cx="50" cy="28" rx="16" ry="4" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.8" />
      <ellipse cx="50" cy="27" rx="12" ry="2.5" fill="#e2e8f0" />
      {/* Pop tab ring */}
      <rect x="47" y="24" width="6" height="3" rx="1" fill="#94a3b8" />
      {/* Graphic design */}
      <path d="M34 46 Q50 40 66 46 L66 68 Q50 62 34 68 Z" fill="#8b5cf6" fillOpacity="0.85" />
      <circle cx="50" cy="56" r="5" fill="#ffffff" />
      <defs>
        <linearGradient id="aluminum-can-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="30%" stopColor="#f8fafc" />
          <stop offset="60%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// 10. Tube Carton Cylindrique (Cardboard Cylinder)
export function IllustrationCylinderTube() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md" fill="none">
      <ellipse cx="50" cy="86" rx="18" ry="5" fill="rgba(0,0,0,0.12)" />
      {/* Tube body */}
      <rect x="34" y="38" width="32" height="46" rx="2" fill="url(#cylinder-kraft)" stroke="#92400e" strokeWidth="0.8" />
      {/* Removable Cap */}
      <rect x="33" y="22" width="34" height="20" rx="3" fill="#a16207" stroke="#78350f" strokeWidth="0.8" />
      <ellipse cx="50" cy="22" rx="17" ry="4" fill="#d97706" />
      {/* Label on tube */}
      <rect x="36" y="46" width="28" height="24" fill="#ffffff" />
      <path d="M40 56 L60 56" stroke="#b45309" strokeWidth="1" />
      <defs>
        <linearGradient id="cylinder-kraft" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#b45309" />
          <stop offset="50%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
      </defs>
    </svg>
  );
}


// ─── Visual style presets (data lives in lib/catalog so the server can use it) ─
export { ALL_VISUAL_STYLES } from "@/lib/catalog/legacyStyles";
import { ALL_VISUAL_STYLES } from "@/lib/catalog/legacyStyles";
export const VISUAL_STYLES = ALL_VISUAL_STYLES;
