"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Header } from "@/components/board/Header";
import { Toolbox } from "@/components/board/Toolbox";
import { Canvas2D } from "@/components/board/Canvas2D";
import { Canvas3D } from "@/components/board/Canvas3D";
import { Inspector } from "@/components/board/Inspector";
import { TEMPLATES, MATERIALS } from "@/lib/constants";
import { useProjectStore } from "@/lib/store/projects";
import { 
  downloadBatPdf, 
  downloadVectorSvg, 
  downloadCadDxf 
} from "@/lib/export";
import { 
  PackagingTemplate, 
  BoxDimensions, 
  MaterialOption, 
  LayerVisibility, 
  ActiveTool, 
  ActiveView, 
  Unit 
} from "@/types/packaging";

function StudioProjectContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params?.id as string;
  const initialView = (searchParams?.get("view") as ActiveView) || "2d";

  const { projects, updateProject } = useProjectStore();
  const project = projects.find((p) => p.id === projectId);

  // Template setup
  const initialTemplate = 
    TEMPLATES.find((t) => t.id === project?.template_id) || TEMPLATES[0];

  const [projectName, setProjectName] = useState(
    project?.name || "Nouveau Projet Packaging"
  );
  const [selectedTemplate, setSelectedTemplate] = useState<PackagingTemplate>(initialTemplate);
  const [dimensions, setDimensions] = useState<BoxDimensions>(initialTemplate.defaultDimensions);
  const [material, setMaterial] = useState<MaterialOption>(MATERIALS[0]);
  const [layers, setLayers] = useState<LayerVisibility>({
    cut: true,
    crease: true,
    bleed: true,
    safety: true,
    dimensions: true,
    labels: true,
    artwork: false,
  });
  const [activeTool, setActiveTool] = useState<ActiveTool>("select");
  const [activeView, setActiveView] = useState<ActiveView>(
    initialView === "3d" ? "3d" : "2d"
  );
  const [unit, setUnit] = useState<Unit>("mm");
  const [zoom, setZoom] = useState<number>(1.0);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [notification, setNotification] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Synchronize when project loads from store
  useEffect(() => {
    if (project) {
      setProjectName(project.name);
      const tpl = TEMPLATES.find((t) => t.id === project.template_id);
      if (tpl) {
        setSelectedTemplate(tpl);
        setDimensions(tpl.defaultDimensions);
      }
    }
  }, [project]);

  // Handle URL query ?view=3d changes
  useEffect(() => {
    const v = searchParams?.get("view") as ActiveView;
    if (v === "3d" || v === "2d" || v === "split") {
      setActiveView(v);
    }
  }, [searchParams]);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleRename = (newName: string) => {
    setProjectName(newName);
    if (projectId) {
      updateProject(projectId, { name: newName });
      showToast(`Projet renommé : "${newName}"`);
    }
  };

  const handleSelectTemplate = (tpl: PackagingTemplate) => {
    setSelectedTemplate(tpl);
    setDimensions(tpl.defaultDimensions);
    if (projectId) {
      updateProject(projectId, { template_id: tpl.id });
    }
    showToast(`Gabarit chargé : ${tpl.name} (${tpl.code})`);
  };

  const handleDimensionsChange = (newDims: BoxDimensions) => {
    setDimensions(newDims);
    setIsSaving(true);
    const timer = setTimeout(() => {
      setIsSaving(false);
    }, 600);
    return () => clearTimeout(timer);
  };

  const handleToggleLayer = (key: keyof LayerVisibility) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Real Prepress & CAD Exports
  const handleExport = async (format: "svg" | "dxf" | "pdf" | "json") => {
    try {
      if (format === "pdf") {
        showToast("Génération du BAT PDF Imprimeur 300 DPI en cours...");
        await downloadBatPdf(projectName, selectedTemplate, dimensions, material);
        if (projectId) {
          updateProject(projectId, { status: "cmyk_exported" });
        }
        showToast("✓ BAT PDF 300 DPI généré et téléchargé avec succès !");
        return;
      }

      if (format === "svg") {
        showToast("Génération du tracé vectoriel SVG...");
        downloadVectorSvg(projectName, selectedTemplate, dimensions, material);
        showToast("✓ Tracé Vectoriel SVG téléchargé (Calques ThruCut & Crease) !");
        return;
      }

      if (format === "dxf") {
        showToast("Génération du fichier DXF CNC Kongsberg / Zünd...");
        downloadCadDxf(selectedTemplate, dimensions);
        showToast("✓ Fichier DXF CNC généré avec calques CUT & CREASE !");
        return;
      }

      if (format === "json") {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
          JSON.stringify({ 
            project: { id: projectId, name: projectName },
            template: selectedTemplate, 
            dimensions, 
            material,
            layers
          }, null, 2)
        );
        const dlAnchor = document.createElement("a");
        dlAnchor.setAttribute("href", dataStr);
        dlAnchor.setAttribute("download", `edify-spec-${selectedTemplate.id}.json`);
        dlAnchor.click();
        showToast("✓ Fiche technique JSON exportée !");
        return;
      }
    } catch (err) {
      console.error("Export error:", err);
      showToast("Une erreur est survenue lors de l'export.");
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-studio-950 text-slate-100 overflow-hidden font-sans">
      {/* Toast Notification */}
      {notification && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-brand-600 text-white px-4 py-2 rounded-lg text-xs font-medium shadow-2xl border border-brand-400/40 animate-bounce">
          {notification}
        </div>
      )}

      {/* Top Studio Header */}
      <Header
        projectName={projectName}
        onRenameProject={handleRename}
        isSaving={isSaving}
        selectedTemplate={selectedTemplate}
        onSelectTemplate={handleSelectTemplate}
        activeView={activeView}
        onChangeView={setActiveView}
        unit={unit}
        onChangeUnit={setUnit}
        onResetView={() => {
          setZoom(1.0);
          showToast("Vue recentrée à 100%");
        }}
        onExport={handleExport}
      />

      {/* Main Studio Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left CAD Toolbox */}
        <Toolbox
          activeTool={activeTool}
          onChangeTool={setActiveTool}
          zoom={zoom}
          onZoomIn={() => setZoom((z) => Math.min(z + 0.15, 3.5))}
          onZoomOut={() => setZoom((z) => Math.max(z - 0.15, 0.3))}
          onResetZoom={() => setZoom(1.0)}
          snapToGrid={snapToGrid}
          onToggleSnap={() => setSnapToGrid(!snapToGrid)}
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid(!showGrid)}
        />

        {/* Central Board Canvas Area */}
        <main className="flex-1 h-full relative overflow-hidden bg-studio-950 flex">
          {/* 2D CAD View */}
          {(activeView === "2d" || activeView === "split") && (
            <div className={`h-full ${activeView === "split" ? "w-1/2 border-r border-studio-800" : "w-full"}`}>
              <Canvas2D
                templateId={selectedTemplate.id}
                dimensions={dimensions}
                layers={layers}
                activeTool={activeTool}
                zoom={zoom}
                onZoomChange={setZoom}
                unit={unit}
                showGrid={showGrid}
              />
            </div>
          )}

          {/* 3D Folding Simulation View */}
          {(activeView === "3d" || activeView === "split") && (
            <div className={`h-full ${activeView === "split" ? "w-1/2" : "w-full"}`}>
              <Canvas3D dimensions={dimensions} material={material} />
            </div>
          )}
        </main>

        {/* Right Inspector Panel */}
        <Inspector
          dimensions={dimensions}
          onChangeDimensions={handleDimensionsChange}
          material={material}
          onSelectMaterial={setMaterial}
          layers={layers}
          onToggleLayer={handleToggleLayer}
          unit={unit}
        />
      </div>
    </div>
  );
}

export default function StudioProjectPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center bg-studio-950 text-studio-500 text-xs">
          Chargement du studio CAO...
        </div>
      }
    >
      <StudioProjectContent />
    </Suspense>
  );
}
