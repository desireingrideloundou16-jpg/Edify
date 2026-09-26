"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Box, 
  Layers, 
  Eye, 
  Download, 
  Maximize2, 
  RotateCcw, 
  Share2, 
  Sparkles, 
  ChevronDown, 
  Printer, 
  ArrowLeft,
  Check,
  Edit2
} from "lucide-react";
import { PackagingTemplate, ActiveView, Unit } from "@/types/packaging";
import { TEMPLATES } from "@/lib/constants";

interface HeaderProps {
  selectedTemplate: PackagingTemplate;
  onSelectTemplate: (tpl: PackagingTemplate) => void;
  activeView: ActiveView;
  onChangeView: (view: ActiveView) => void;
  unit: Unit;
  onChangeUnit: (unit: Unit) => void;
  onResetView: () => void;
  onExport: (format: "svg" | "dxf" | "pdf" | "json") => void;
  projectName?: string;
  onRenameProject?: (name: string) => void;
  isSaving?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  selectedTemplate,
  onSelectTemplate,
  activeView,
  onChangeView,
  unit,
  onChangeUnit,
  onResetView,
  onExport,
  projectName = "Sérum Éclat Luxe — Coffret Premium",
  onRenameProject,
  isSaving = false,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(projectName);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleInput.trim() && titleInput !== projectName) {
      onRenameProject?.(titleInput.trim());
    }
  };

  return (
    <header className="h-14 border-b border-studio-800 bg-studio-900/90 backdrop-blur-md px-4 flex items-center justify-between z-30 select-none">
      {/* Brand & Project Name */}
      <div className="flex items-center gap-3">
        {/* Back to Dashboard button */}
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-studio-850 hover:bg-studio-800 text-studio-400 hover:text-white border border-studio-700/60 text-xs font-medium transition-colors"
          title="Retourner au tableau de bord"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Projets</span>
        </Link>

        <div className="h-4 w-[1px] bg-studio-800" />

        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 via-brand-500 to-indigo-400 flex items-center justify-center shadow-lg shadow-brand-500/20 border border-brand-500/40 group-hover:scale-105 transition-transform">
              <Box className="w-4 h-4 text-white" />
            </div>
          </Link>

          <div>
            {isEditingTitle ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={handleTitleSubmit}
                  onKeyDown={(e) => e.key === "Enter" && handleTitleSubmit()}
                  autoFocus
                  className="bg-studio-800 border border-brand-500/60 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
                />
                <button
                  onClick={handleTitleSubmit}
                  className="p-1 rounded bg-brand-600 text-white hover:bg-brand-500"
                >
                  <Check className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group/title">
                <span
                  onClick={() => onRenameProject && setIsEditingTitle(true)}
                  className="font-bold text-xs sm:text-sm tracking-tight text-white line-clamp-1 cursor-pointer hover:text-brand-300 transition-colors"
                  title="Cliquer pour renommer le projet"
                >
                  {projectName}
                </span>
                {onRenameProject && (
                  <button
                    onClick={() => setIsEditingTitle(true)}
                    className="opacity-0 group-hover/title:opacity-100 text-studio-500 hover:text-slate-300 transition-opacity"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-studio-500 leading-none">
                {isSaving ? "Enregistrement..." : "Enregistré automatiquement"}
              </span>
            </div>
          </div>
        </div>

        <div className="h-4 w-[1px] bg-studio-800 mx-1" />

        {/* Template Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-studio-850 hover:bg-studio-800 border border-studio-700/60 text-xs text-slate-200 transition-colors"
          >
            <span className="font-medium">{selectedTemplate.name}</span>
            <span className="text-[10px] text-studio-500 font-mono">({selectedTemplate.code})</span>
            <ChevronDown className="w-3.5 h-3.5 text-studio-500" />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-72 bg-studio-900 border border-studio-700 rounded-lg shadow-2xl z-50 py-1 overflow-hidden">
              <div className="px-3 py-1.5 text-[10px] uppercase font-semibold text-studio-500 tracking-wider">
                Gabarits Normalisés ECMA & FEFCO
              </div>
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => {
                    onSelectTemplate(tpl);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors flex flex-col gap-0.5 hover:bg-studio-800 ${
                    tpl.id === selectedTemplate.id ? "bg-brand-500/10 text-brand-400 font-medium" : "text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{tpl.name}</span>
                    <span className="text-[10px] font-mono text-studio-500">{tpl.code}</span>
                  </div>
                  <span className="text-[11px] text-studio-500 line-clamp-1">{tpl.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* View Switcher Tabs (2D, 3D, Split) */}
      <div className="flex items-center bg-studio-950 p-1 rounded-lg border border-studio-800/80">
        <button
          onClick={() => onChangeView("2d")}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
            activeView === "2d"
              ? "bg-studio-800 text-white shadow-sm border border-studio-700/50"
              : "text-studio-500 hover:text-slate-300"
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-print-cut" />
          <span>2D Plan Découpe</span>
        </button>

        <button
          onClick={() => onChangeView("3d")}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
            activeView === "3d"
              ? "bg-studio-800 text-white shadow-sm border border-studio-700/50"
              : "text-studio-500 hover:text-slate-300"
          }`}
        >
          <Box className="w-3.5 h-3.5 text-brand-400" />
          <span>3D Simulation Pliage</span>
        </button>

        <button
          onClick={() => onChangeView("split")}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
            activeView === "split"
              ? "bg-studio-800 text-white shadow-sm border border-studio-700/50"
              : "text-studio-500 hover:text-slate-300"
          }`}
        >
          <Eye className="w-3.5 h-3.5 text-emerald-400" />
          <span>Vue Split</span>
        </button>
      </div>

      {/* Right Controls: Units, Reset View, Export, Status */}
      <div className="flex items-center gap-2.5">
        {/* Unit toggle */}
        <div className="flex items-center bg-studio-950 rounded-md border border-studio-800 p-0.5 text-xs font-mono">
          {(["mm", "cm", "in"] as Unit[]).map((u) => (
            <button
              key={u}
              onClick={() => onChangeUnit(u)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                unit === u ? "bg-brand-600 text-white" : "text-studio-500 hover:text-slate-300"
              }`}
            >
              {u}
            </button>
          ))}
        </div>

        {/* Reset View */}
        <button
          onClick={onResetView}
          title="Recadrer et centrer la vue (Espace)"
          className="p-1.5 rounded-md hover:bg-studio-800 text-studio-500 hover:text-slate-200 border border-transparent hover:border-studio-700 transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Export Menu */}
        <div className="relative">
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium shadow-md shadow-brand-600/20 transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {exportOpen && (
            <div className="absolute right-0 mt-1.5 w-52 bg-studio-900 border border-studio-700 rounded-lg shadow-2xl z-50 py-1 overflow-hidden">
              <button
                onClick={() => {
                  onExport("svg");
                  setExportOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-studio-800 flex items-center justify-between"
              >
                <span>Tracé Vectoriel (.SVG)</span>
                <span className="text-[10px] font-mono text-studio-500">Vector CAD</span>
              </button>
              <button
                onClick={() => {
                  onExport("dxf");
                  setExportOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-studio-800 flex items-center justify-between"
              >
                <span>Fichier Découpeuse (.DXF)</span>
                <span className="text-[10px] font-mono text-studio-500">Kongsberg/Zünd</span>
              </button>
              <button
                onClick={() => {
                  onExport("pdf");
                  setExportOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-studio-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5 text-print-bleed" />
                  <span>BAT Imprimeur (.PDF)</span>
                </div>
                <span className="text-[10px] font-mono text-studio-500">300 DPI</span>
              </button>
              <button
                onClick={() => {
                  onExport("json");
                  setExportOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-studio-800 flex items-center justify-between border-t border-studio-800"
              >
                <span>Fiche Technique (.JSON)</span>
                <span className="text-[10px] font-mono text-studio-500">Spec Schema</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
