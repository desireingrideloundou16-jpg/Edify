"use client";

import React from "react";
import { 
  MousePointer, 
  Hand, 
  Ruler, 
  Scissors, 
  FoldHorizontal, 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Magnet, 
  Grid
} from "lucide-react";
import { ActiveTool } from "@/types/packaging";

interface ToolboxProps {
  activeTool: ActiveTool;
  onChangeTool: (tool: ActiveTool) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
}

export const Toolbox: React.FC<ToolboxProps> = ({
  activeTool,
  onChangeTool,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  snapToGrid,
  onToggleSnap,
  showGrid,
  onToggleGrid,
}) => {
  const tools = [
    { id: "select", icon: MousePointer, label: "Sélection (V)" },
    { id: "pan", icon: Hand, label: "Déplacement / Pan (H)" },
    { id: "measure", icon: Ruler, label: "Cotation & Mesure (M)" },
    { id: "cut", icon: Scissors, label: "Outil Découpe ThruCut (C)" },
    { id: "crease", icon: FoldHorizontal, label: "Outil Rainage (R)" },
  ] as const;

  return (
    <aside className="w-12 bg-studio-900 border-r border-studio-800 flex flex-col items-center py-3 justify-between z-20 select-none">
      {/* CAD Drawing Tools */}
      <div className="flex flex-col items-center gap-1">
        {tools.map((t) => {
          const Icon = t.icon;
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChangeTool(t.id)}
              title={t.label}
              className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${
                isActive
                  ? "bg-brand-600 text-white shadow-md shadow-brand-500/30"
                  : "text-studio-500 hover:text-slate-200 hover:bg-studio-800"
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}

        <div className="w-6 h-[1px] bg-studio-800 my-2" />

        {/* Snap & Grid options */}
        <button
          onClick={onToggleSnap}
          title={snapToGrid ? "Magnétisme activé" : "Magnétisme désactivé"}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
            snapToGrid
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "text-studio-500 hover:text-slate-200 hover:bg-studio-800"
          }`}
        >
          <Magnet className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleGrid}
          title={showGrid ? "Masquer la grille" : "Afficher la grille"}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
            showGrid
              ? "bg-brand-500/20 text-brand-400 border border-brand-500/30"
              : "text-studio-500 hover:text-slate-200 hover:bg-studio-800"
          }`}
        >
          <Grid className="w-4 h-4" />
        </button>
      </div>

      {/* Zoom Controls */}
      <div className="flex flex-col items-center gap-1">
        <div className="text-[10px] font-mono text-studio-500 mb-1">
          {Math.round(zoom * 100)}%
        </div>

        <button
          onClick={onZoomIn}
          title="Zoomer (+)"
          className="w-8 h-8 rounded-md flex items-center justify-center text-studio-500 hover:text-slate-200 hover:bg-studio-800 transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          onClick={onZoomOut}
          title="Dézoomer (-)"
          className="w-8 h-8 rounded-md flex items-center justify-center text-studio-500 hover:text-slate-200 hover:bg-studio-800 transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          onClick={onResetZoom}
          title="Réinitialiser zoom (100%)"
          className="w-8 h-8 rounded-md flex items-center justify-center text-studio-500 hover:text-slate-200 hover:bg-studio-800 transition-colors"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
