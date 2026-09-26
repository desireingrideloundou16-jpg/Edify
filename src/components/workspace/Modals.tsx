"use client";

import React, { useState, useMemo } from "react";
import { 
  X, 
  Check, 
  Search, 
  Sparkles, 
  Smartphone, 
  Eye, 
  Layers, 
  Palette,
  Tag,
  ArrowUpRight
} from "lucide-react";

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

// ─── Complete Database of 14 Packaging Container Types ─────────────────────

export const ALL_PACKAGING_SHAPES: PackagingShape[] = [
  {
    id: "folding-box-standard",
    name: "Boîte Pliante Standard (Reverse Tuck)",
    category: "boxes",
    categoryLabel: "Boîtes & Coffrets",
    dimensions: "38×38×112 mm",
    material: "Carton couché 350g",
    description: "Format classique cosmétique et pharmaceutique à pattes opposées pour petits et moyens flacons.",
    lengthMm: 38,
    widthMm: 38,
    heightMm: 112,
    renderIllustration: IllustrationFoldingBox,
  },
  {
    id: "luxury-rigid-box",
    name: "Coffret Rigide Cloche (Lid & Base)",
    category: "boxes",
    categoryLabel: "Boîtes & Coffrets",
    dimensions: "160×110×50 mm",
    material: "Carton gris rembordé 1200g",
    description: "Structure 2 pièces rigide pour parfums de niche, joaillerie, maroquinerie et coffrets cadeaux de prestige.",
    lengthMm: 160,
    widthMm: 110,
    heightMm: 50,
    renderIllustration: IllustrationRigidBox,
  },
  {
    id: "dropper-bottle",
    name: "Flacon Compte-Gouttes Sérum",
    category: "bottles",
    categoryLabel: "Flacons & Bouteilles",
    dimensions: "Ø 36 × 105 mm",
    material: "Verre ambré ou opalin + Pipette dorée",
    description: "Flacon cylindrique premium pour sérums anti-âge, huiles de soin, élixirs botaniques et aromathérapie.",
    lengthMm: 36,
    widthMm: 36,
    heightMm: 105,
    renderIllustration: IllustrationDropperBottle,
  },
  {
    id: "cosmetic-jar",
    name: "Pot Cosmétique Crème & Baume",
    category: "jars",
    categoryLabel: "Pots & Bocaux",
    dimensions: "Ø 62 × 48 mm",
    material: "Verre lourd 50ml + Couvercle doré/noir",
    description: "Pot luxueux à double fond pour crèmes hydratantes, masques de beauté, baumes et cires capillaires.",
    lengthMm: 62,
    widthMm: 62,
    heightMm: 48,
    renderIllustration: IllustrationCosmeticJar,
  },
  {
    id: "stand-up-pouch",
    name: "Doypack Stand-up Pouch Zippé",
    category: "pouches",
    categoryLabel: "Sachets Souples",
    dimensions: "140×70×210 mm",
    material: "Kraft barrière thermoscellable 120µ",
    description: "Sachet étanche à soufflet de fond pour café en grains, thés rares, granolas bio, poudres et compléments.",
    lengthMm: 140,
    widthMm: 70,
    heightMm: 210,
    renderIllustration: IllustrationDoypack,
  },
  {
    id: "ecom-mailer",
    name: "Boîte Postale E-commerce (FEFCO 0427)",
    category: "boxes",
    categoryLabel: "Boîtes & Coffrets",
    dimensions: "220×160×70 mm",
    material: "Carton ondulé micro-cannelure E 400g",
    description: "Boîte d'expédition verrouillable sans ruban adhésif avec impression intérieure/extérieure sur-mesure.",
    lengthMm: 220,
    widthMm: 160,
    heightMm: 70,
    renderIllustration: IllustrationMailerBox,
  },
  {
    id: "pump-bottle",
    name: "Flacon Pompe Lotion & Huile Corps",
    category: "bottles",
    categoryLabel: "Flacons & Bouteilles",
    dimensions: "Ø 48 × 150 mm",
    material: "Flacon PET recyclé / Verre givré 150ml",
    description: "Distributeur hygiénique avec pompe doseuse pour laits hydratants, shampoings d'exception et nettoyants.",
    lengthMm: 48,
    widthMm: 48,
    heightMm: 150,
    renderIllustration: IllustrationPumpBottle,
  },
  {
    id: "squeeze-tube",
    name: "Tube Souple Cosmétique",
    category: "tubes_cans",
    categoryLabel: "Tubes & Canettes",
    dimensions: "Ø 35 × 125 mm",
    material: "Aluminium brossé ou PE biosourcé",
    description: "Tube souple imprimé 360° pour crèmes pour les mains, dentifrices blanchissants, gels et baumes.",
    lengthMm: 35,
    widthMm: 35,
    heightMm: 125,
    renderIllustration: IllustrationSqueezeTube,
  },
  {
    id: "cylinder-tube",
    name: "Tube Carton Cylindrique Luxe",
    category: "tubes_cans",
    categoryLabel: "Tubes & Canettes",
    dimensions: "Ø 55 × 160 mm",
    material: "Carton spiralé rembordé",
    description: "Tube rigide élégant avec bouchon télescopique pour bougies parfumées, thés prestigieux et spiritueux.",
    lengthMm: 55,
    widthMm: 55,
    heightMm: 160,
    renderIllustration: IllustrationCylinderTube,
  },
  {
    id: "beverage-can",
    name: "Canette Aluminium Sleek 330ml",
    category: "tubes_cans",
    categoryLabel: "Tubes & Canettes",
    dimensions: "Ø 58 × 146 mm",
    material: "Aluminium 100% recyclable à l'infini",
    description: "Format sleek moderne pour sodas artisanaux, thés glacés gazeux, kombuchas et boissons énergisantes.",
    lengthMm: 58,
    widthMm: 58,
    heightMm: 146,
    renderIllustration: IllustrationCanette,
  },
];

export const PACKAGING_SHAPES = ALL_PACKAGING_SHAPES;

// ─── Complete Database of 12 Packaging Visual Styles & Ambiances ───────────

export const ALL_VISUAL_STYLES: VisualStylePreset[] = [
  {
    id: "botanical-natural",
    name: "Botanique & Naturel",
    subtitle: "Palette terreuse, sérigraphie organique",
    description: "Tons sauge apaisants, rose poudré délicat et touches florales. Idéal pour les cosmétiques bio et soins holistiques.",
    badge: "✦",
    primaryColor: "#ec4899",
    accentColor: "#059669",
    palette: ["#fdf2f8", "#ec4899", "#059669", "#d97706"],
    bgGradient: "from-rose-50/50 via-white to-emerald-50/40",
    fontFamily: "sans",
    finishing: "Vernis sélectif + Dorure or",
    category: "eco",
  },
  {
    id: "luxury-obsidian-gold",
    name: "Luxe Minimaliste Noir & Or",
    subtitle: "Noir profond et dorure or à chaud 24K",
    description: "Élégance intemporelle pour parfumerie de créateur, haute horlogerie et spiritueux d'exception.",
    badge: "★",
    primaryColor: "#0f172a",
    accentColor: "#f59e0b",
    palette: ["#0f172a", "#1e293b", "#f59e0b", "#fde68a"],
    bgGradient: "from-slate-900 via-slate-950 to-neutral-900",
    fontFamily: "sans",
    finishing: "Dorure or 24K + Soft Touch",
    category: "luxury",
  },
  {
    id: "artisanal-kraft-cafe",
    name: "Café & Kraft Terroir",
    subtitle: "Texture fibreuse, typographie vintage",
    description: "Aspect brut et authentique avec encre noire végétale et tampons de torréfaction artisanale.",
    badge: "☕",
    primaryColor: "#78350f",
    accentColor: "#b45309",
    palette: ["#fef3c7", "#d97706", "#b45309", "#78350f"],
    bgGradient: "from-amber-100/60 via-amber-50 to-orange-100/40",
    fontFamily: "sans",
    finishing: "Embossage relief + Papier recyclé",
    category: "eco",
  },
  {
    id: "cyber-neon-modern",
    name: "Cyber Éclat Holographique",
    subtitle: "Reflets irisés et typographie néo-grotesque",
    description: "Inspiré du design digital moderne, boissons nootropiques, tech et compléments fonctionnels.",
    badge: "⚡",
    primaryColor: "#8b5cf6",
    accentColor: "#06b6d4",
    palette: ["#f3e8ff", "#8b5cf6", "#06b6d4", "#ec4899"],
    bgGradient: "from-violet-50/60 via-white to-cyan-50/50",
    fontFamily: "sans",
    finishing: "Film holographique arc-en-ciel",
    category: "modern",
  },
  {
    id: "clinical-purity-white",
    name: "Soin Clinique & Pureté Médicale",
    subtitle: "Minimalisme dermatologique immaculé",
    description: "Grille suisse rigoureuse, blancheur totale immaculée et repères de dosage cobalt ultra-lisibles.",
    badge: "✚",
    primaryColor: "#2563eb",
    accentColor: "#10b981",
    palette: ["#ffffff", "#f8fafc", "#2563eb", "#10b981"],
    bgGradient: "from-sky-50/50 via-white to-slate-50",
    fontFamily: "sans",
    finishing: "Pelliculage mat antibactérien",
    category: "wellness",
  },
  {
    id: "pastel-scandi-zen",
    name: "Pastel Douceur Scandinave",
    subtitle: "Pêche poudrée, crème vanille & sérénité",
    description: "Teintes réconfortantes, lignes géométriques minimalistes et toucher soyeux ultra-apaisant.",
    badge: "☁",
    primaryColor: "#f43f5e",
    accentColor: "#fb923c",
    palette: ["#fff1f2", "#fed7aa", "#fbcfe8", "#f43f5e"],
    bgGradient: "from-rose-50/70 via-orange-50/40 to-white",
    fontFamily: "sans",
    finishing: "Toucher peau de pêche Soft Velvet",
    category: "wellness",
  },
  {
    id: "retro-apothecary-1920",
    name: "Apothicaire Rétro 1920",
    subtitle: "Gravures historiques & étiquette ornée",
    description: "Hommage aux herboristeries traditionnelles avec armoiries dorées, bordures victoriennes et cachets d'époque.",
    badge: "⚜",
    primaryColor: "#831843",
    accentColor: "#d97706",
    palette: ["#fdf2f8", "#831843", "#d97706", "#1c1917"],
    bgGradient: "from-stone-100 via-amber-50/50 to-stone-200",
    fontFamily: "sans",
    finishing: "Gaufrage relief + Dorure cuivrée",
    category: "vintage",
  },
  {
    id: "pop-art-vibrant",
    name: "Pop Art & Vibrance Énergique",
    subtitle: "Couleurs saturées & motifs géométriques",
    description: "Design jeune et survitaminé avec contrastes audacieux et typographie extra-bold percutante.",
    badge: "✹",
    primaryColor: "#e11d48",
    accentColor: "#facc15",
    palette: ["#fef08a", "#e11d48", "#3b82f6", "#10b981"],
    bgGradient: "from-amber-50 via-rose-50 to-blue-50",
    fontFamily: "sans",
    finishing: "Vernis brillant ultra-gloss",
    category: "modern",
  },
  {
    id: "japanese-wabi-sabi",
    name: "Japonais Wabi-Sabi & Épuré",
    subtitle: "Papier washi texturé & minimalisme zen",
    description: "Éloge de la simplicité et des matières nobles, typographie délicate et espace négatif maîtrisé.",
    badge: "侘",
    primaryColor: "#334155",
    accentColor: "#a8a29e",
    palette: ["#fafaf9", "#e7e5e4", "#78716c", "#292524"],
    bgGradient: "from-stone-50 via-white to-stone-100",
    fontFamily: "sans",
    finishing: "Papier d'art vergé non couché",
    category: "eco",
  },
  {
    id: "high-tech-matte-titanium",
    name: "High-Tech Mat & Titane Chrome",
    subtitle: "Finition soft-touch & accents métalliques",
    description: "Univers premium contemporain avec noir anthracite, reflets aluminium brossé et gravure laser.",
    badge: "◈",
    primaryColor: "#475569",
    accentColor: "#0284c7",
    palette: ["#0f172a", "#334155", "#64748b", "#38bdf8"],
    bgGradient: "from-slate-800 via-slate-900 to-zinc-900",
    fontFamily: "sans",
    finishing: "Vernis sélectif 3D + Foil argent",
    category: "luxury",
  },
];

export const VISUAL_STYLES = ALL_VISUAL_STYLES;

// ─── Modal 1: Shape Selector with Realistic 3D Mockup Cards ─────────────────

export function ShapeSelectorModal({
  isOpen,
  onClose,
  selectedShape,
  onSelectShape,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedShape: PackagingShape;
  onSelectShape: (shape: PackagingShape) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const categories = [
    { id: "all", label: "Tous les contenants" },
    { id: "boxes", label: "Boîtes & Coffrets" },
    { id: "bottles", label: "Flacons & Bouteilles" },
    { id: "jars", label: "Pots & Bocaux" },
    { id: "pouches", label: "Sachets Souples" },
    { id: "tubes_cans", label: "Tubes & Canettes" },
  ];

  const filteredShapes = useMemo(() => {
    return ALL_PACKAGING_SHAPES.filter((shape) => {
      const matchCat = activeCategory === "all" || shape.category === activeCategory;
      const matchSearch = shape.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          shape.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          shape.material.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activeCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="edify-modal-backdrop" onClick={onClose}>
      <div 
        className="edify-modal-content max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="edify-sheet-drag-handle md:hidden" />
        
        {/* Header */}
        <div className="edify-modal-header">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Forme & Structure du packaging
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Sélectionnez votre type de contenant parmi notre catalogue de gabarits calibrés pour l'impression
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search and Category Filters */}
        <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/50">
          {/* Search bar */}
          <div className="relative flex items-center bg-white rounded-xl border border-slate-200 px-3 py-2 shadow-xs focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 transition">
            <Search className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Rechercher un gabarit (ex: sérum, boîte pliante, doypack, pot crème)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs font-medium text-slate-900 bg-transparent outline-none placeholder:text-slate-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-xs text-slate-400 hover:text-slate-700">
                Effacer
              </button>
            )}
          </div>

          {/* Category tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  activeCategory === cat.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-200/60 border border-slate-200"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Shapes Grid with 3D Illustrations */}
        <div className="p-5 overflow-y-auto max-h-[60vh] grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {filteredShapes.map((shape) => {
            const isSelected = shape.id === selectedShape.id;
            const Illustration = shape.renderIllustration;
            return (
              <div
                key={shape.id}
                onClick={() => {
                  onSelectShape(shape);
                  onClose();
                }}
                className={`group relative p-3.5 rounded-2xl border transition-all duration-250 cursor-pointer flex gap-3.5 items-center hover-lift ${
                  isSelected 
                    ? "border-brand-500 bg-brand-50/30 ring-2 ring-brand-100 shadow-sm" 
                    : "border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50/80"
                }`}
              >
                {/* 3D Illustration Thumbnail Box */}
                <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-b from-slate-50 to-slate-100 border border-slate-200/70 p-1 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
                  <Illustration />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-brand-600 transition-colors">
                      {shape.name}
                    </h4>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <span className="inline-block mt-0.5 font-bold text-[10px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {shape.dimensions}
                  </span>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-snug">
                    {shape.description}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold truncate">
                    {shape.material}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Modal 2: Visual Style & Ambiance Selector ──────────────────────────────

export function StyleSelectorModal({
  isOpen,
  onClose,
  selectedStyle,
  onSelectStyle,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedStyle: VisualStylePreset;
  onSelectStyle: (style: VisualStylePreset) => void;
}) {
  const [activeTab, setActiveTab] = useState<string>("all");

  const styleTabs = [
    { id: "all", label: "Tous les styles (10)" },
    { id: "luxury", label: "Luxe & Prestige" },
    { id: "eco", label: "Écologique & Bio" },
    { id: "wellness", label: "Bien-être & Soin" },
    { id: "modern", label: "Moderne & Tech" },
    { id: "vintage", label: "Vintage & Rétro" },
  ];

  const filteredStyles = useMemo(() => {
    if (activeTab === "all") return ALL_VISUAL_STYLES;
    return ALL_VISUAL_STYLES.filter((s) => s.category === activeTab);
  }, [activeTab]);

  if (!isOpen) return null;

  return (
    <div className="edify-modal-backdrop" onClick={onClose}>
      <div 
        className="edify-modal-content max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="edify-sheet-drag-handle md:hidden" />
        
        {/* Header */}
        <div className="edify-modal-header">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Style visuel & Direction artistique
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Adaptez instantanément l'ambiance, les harmonies de couleurs et les finitions d'impression
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter categories */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {styleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-200/60 border border-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Styles Grid */}
        <div className="p-5 overflow-y-auto max-h-[60vh] grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {filteredStyles.map((style) => {
            const isSelected = style.id === selectedStyle.id;
            return (
              <div
                key={style.id}
                onClick={() => {
                  onSelectStyle(style);
                  onClose();
                }}
                className={`group relative p-4 rounded-2xl border transition-all duration-250 cursor-pointer flex flex-col justify-between hover-lift ${
                  isSelected 
                    ? "border-brand-500 bg-brand-50/20 ring-2 ring-brand-100 shadow-sm" 
                    : "border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50/80"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                        {style.badge}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                          {style.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {style.subtitle}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
                    {style.description}
                  </p>
                </div>

                {/* Swatches & Finishes */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  {/* Palette circles */}
                  <div className="flex items-center gap-1.5">
                    {style.palette.map((color, idx) => (
                      <span
                        key={idx}
                        className="w-4 h-4 rounded-full border border-black/10 shadow-2xs"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>

                  <span className="text-[10px] font-bold text-brand-700 bg-brand-50 border border-brand-200/60 px-2 py-0.5 rounded-full">
                    {style.finishing}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Modal 3: Mobile AR Real-time Simulation ────────────────────────────────

export function MobileArModal({
  isOpen,
  onClose,
  projectName,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
}) {
  const [activeTab, setActiveTab] = useState<"qr" | "sim">("qr");

  if (!isOpen) return null;

  return (
    <div className="edify-modal-backdrop" onClick={onClose}>
      <div 
        className="edify-modal-content max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="edify-sheet-drag-handle md:hidden" />
        <div className="edify-modal-header">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Visualisation Réalité Augmentée</h3>
              <p className="text-[11px] text-slate-500">Projetez le packaging à échelle 1:1 dans votre espace</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="edify-modal-body">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("qr")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                activeTab === "qr" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Scanner QR Code Mobile
            </button>
            <button
              onClick={() => setActiveTab("sim")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                activeTab === "sim" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Simulateur Caméra
            </button>
          </div>

          {activeTab === "qr" ? (
            <div className="flex flex-col items-center text-center p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="w-44 h-44 bg-white p-3 rounded-2xl shadow-md border border-slate-200 flex flex-col items-center justify-center relative">
                <div className="w-full h-full border-4 border-slate-900 rounded-lg p-2 flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="w-7 h-7 bg-slate-900 rounded-sm" />
                    <div className="w-7 h-7 bg-slate-900 rounded-sm" />
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="w-9 h-9 rounded-full bg-brand-500 text-white flex items-center justify-center font-extrabold text-xs">
                      E
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <div className="w-7 h-7 bg-slate-900 rounded-sm" />
                    <div className="w-5 h-5 bg-slate-300 rounded-sm" />
                  </div>
                </div>
              </div>
              <p className="text-xs font-bold text-slate-800 mt-4">
                Scannez avec l'appareil photo de votre smartphone
              </p>
              <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                Compatible iOS QuickLook (USDZ) et Android WebXR (glTF). Aucun téléchargement d'application requis.
              </p>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden aspect-video bg-slate-950 flex flex-col items-center justify-center text-white border border-slate-800">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center animate-pulse mb-2">
                <Eye className="w-6 h-6 text-brand-400" />
              </div>
              <p className="text-xs font-bold">Calibration de la surface plane...</p>
              <p className="text-[10px] text-slate-400 mt-1">Placez l'objet sur une table bien éclairée</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500 font-medium">Format AR prêt pour l'export</span>
            <span className="font-bold text-[11px] bg-slate-100 px-2.5 py-0.5 rounded text-slate-800">
              USDZ &amp; GLTF 60 FPS
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
