"use client";

import React, { useState } from "react";
import { LeftSidebar } from "./LeftSidebar";
import { Canvas2DWorkspace } from "./Canvas2DWorkspace";
import { AiPromptDock } from "./AiPromptDock";
import { RightSidebar } from "./RightSidebar";
import { 
  ShapeSelectorModal, 
  StyleSelectorModal, 
  MobileArModal, 
  PackagingShape,
  VisualStylePreset
} from "./Modals";
import { TEMPLATES, MATERIALS } from "@/lib/constants";
import { ALL_CATALOG_SHAPES as PACKAGING_SHAPES } from "@/lib/catalog/shapes";
import { ALL_CATALOG_STYLES as VISUAL_STYLES } from "@/lib/catalog/styles";
import { downloadBatPdf, downloadVectorSvg, generateVectorSvg } from "@/lib/export";
import JSZip from "jszip";
import { CheckCircle2 } from "lucide-react";

export function EdifyWorkspace() {
  // Core packaging & design state
  const [selectedShape, setSelectedShape] = useState<PackagingShape>(PACKAGING_SHAPES[0]);
  const [selectedStyle, setSelectedStyle] = useState<VisualStylePreset>(VISUAL_STYLES[0]);
  const [uploadedLogo, setUploadedLogo] = useState<string | null>(null);
  const [uploadedLogoName, setUploadedLogoName] = useState<string | null>(null);

  // Editable branding content
  const [projectName, setProjectName] = useState("Lumina Serum 50ml");
  const [brandName, setBrandName] = useState("LUMINA");
  const [productName, setProductName] = useState("Sérum Éclat");
  const [volume, setVolume] = useState("50 ml — 1.7 fl oz");
  const [ingredients, setIngredients] = useState("AQUA, GLYCERIN, HYALURONIC ACID, BOTANICAL ESSENCE 100% ORGANIC.");
  const [activeIngredient, setActiveIngredient] = useState("Vitamine C pure 15%");

  // Interactive AI & Credits
  const [credits, setCredits] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal dialog states
  const [isShapeModalOpen, setIsShapeModalOpen] = useState(false);
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);
  const [isArModalOpen, setIsArModalOpen] = useState(false);

  // Toast feedback helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Logo upload handler
  const handleLogoUpload = (dataUrl: string, fileName: string) => {
    setUploadedLogo(dataUrl);
    setUploadedLogoName(fileName);
    showToast(`✓ Fichier "${fileName}" appliqué au gabarit !`);
  };

  const handleRemoveLogo = () => {
    setUploadedLogo(null);
    setUploadedLogoName(null);
    showToast("Logo retiré du gabarit.");
  };

  // Shape change handler
  const handleSelectShape = (shape: PackagingShape) => {
    setSelectedShape(shape);
    // Adjust volume suggestion based on shape
    if (shape.id === "luxury-rigid-box") {
      setVolume("100 ml — Coffret");
    } else if (shape.id === "stand-up-pouch") {
      setVolume("250 g net");
    } else if (shape.id === "dropper-bottle") {
      setVolume("30 ml — 1.0 fl oz");
    } else if (shape.id === "ecom-mailer") {
      setVolume("Colis Standard");
    } else {
      setVolume("50 ml — 1.7 fl oz");
    }
    showToast(`Gabarit mis à jour : ${shape.name}`);
  };

  // Visual style change handler
  const handleSelectStyle = (style: VisualStylePreset) => {
    setSelectedStyle(style);
    showToast(`Ambiance appliquée : ${style.name}`);
  };

  // AI Generation simulation handler
  const handleGenerate = async (prompt: string) => {
    if (credits <= 0) {
      showToast("Solde de crédits insuffisant. Veuillez recharger.");
      return;
    }

    setIsGenerating(true);
    setCredits((c) => Math.max(0, c - 1));

    const lower = prompt.toLowerCase();

    setTimeout(() => {
      // Dynamic AI brief understanding
      if (lower.includes("café") || lower.includes("coffee") || lower.includes("kraft")) {
        const kraftStyle = VISUAL_STYLES.find((s) => s.id === "artisanal-kraft-cafe") || VISUAL_STYLES[2];
        const pouchShape = PACKAGING_SHAPES.find((s) => s.id === "stand-up-pouch") || PACKAGING_SHAPES[2];
        setSelectedStyle(kraftStyle);
        setSelectedShape(pouchShape);
        setBrandName("TERRA ROAST");
        setProductName("Arabica Haute Altitude");
        setVolume("250 g — Grains Purs");
        setIngredients("100% ARABICA BIO, TORREFACTION ARTISANALE LENTE.");
        setActiveIngredient("Origine Éthiopie Yirgacheffe");
        setProjectName("Café Bio Premium 250g");
      } else if (lower.includes("luxe") || lower.includes("cadeau") || lower.includes("or") || lower.includes("dorure")) {
        const goldStyle = VISUAL_STYLES.find((s) => s.id === "luxury-obsidian-gold") || VISUAL_STYLES[1];
        const boxShape = PACKAGING_SHAPES.find((s) => s.id === "luxury-rigid-box") || PACKAGING_SHAPES[1];
        setSelectedStyle(goldStyle);
        setSelectedShape(boxShape);
        setBrandName("AURA ROYALE");
        setProductName("Élixir d'Or Impérial");
        setVolume("100 ml — Extrait Pur");
        setIngredients("INFUSION D'OR 24K, HUILE D'ARGAN RARE, BOIS D'OUD NATUREL.");
        setActiveIngredient("Or Pur 24 Karats micronisé");
        setProjectName("Coffret Luxe 100ml");
      } else if (lower.includes("cyber") || lower.includes("néon") || lower.includes("holographique")) {
        const cyberStyle = VISUAL_STYLES.find((s) => s.id === "cyber-neon-modern") || VISUAL_STYLES[3];
        setSelectedStyle(cyberStyle);
        setBrandName("SYNAPSE");
        setProductName("Nootropic Focus Glow");
        setVolume("60 Gélules");
        setActiveIngredient("Lion's Mane + L-Théanine");
      } else {
        // Generic upgrade
        setBrandName("LUMINA");
        setProductName("Sérum Éclat Botanique");
        setIngredients("AQUA, GLYCERIN, HYALURONIC ACID, BOTANICAL ESSENCE 100% ORGANIC.");
        setActiveIngredient("Vitamine C pure 15%");
      }

      setIsGenerating(false);
      showToast("✨ Nouveau design de packaging généré avec succès !");
    }, 1500);
  };

  // PDF Export
  const handleDownloadPdf = async () => {
    try {
      showToast("Génération du BAT PDF Imprimeur 300 DPI certifié...");
      const tpl = TEMPLATES[0];
      const dims = {
        ...tpl.defaultDimensions,
        length: selectedShape.lengthMm,
        width: selectedShape.widthMm,
        height: selectedShape.heightMm,
      };
      await downloadBatPdf(projectName, tpl, dims, MATERIALS[0]);
      showToast("✓ BAT PDF 300 DPI téléchargé avec succès !");
    } catch (err) {
      console.error(err);
      // Fallback SVG download if PDF fails
      downloadVectorSvg(projectName, TEMPLATES[0], TEMPLATES[0].defaultDimensions, MATERIALS[0]);
      showToast("✓ Tracé vectoriel SVG certifié téléchargé !");
    }
  };

  // ZIP / Assets Export
  const handleDownloadZip = async () => {
    showToast("Préparation de l'archive ZIP du projet...");
    try {
      const template = TEMPLATES[0];
      const dimensions = {
        ...template.defaultDimensions,
        length: selectedShape.lengthMm,
        width: selectedShape.widthMm,
        height: selectedShape.heightMm,
      };
      const specData = {
        project: {
          name: projectName,
          brand: brandName,
          product: productName,
          volume,
          exportDate: new Date().toISOString(),
        },
        packaging: {
          shape: selectedShape.name,
          dimensions: selectedShape.dimensions,
          material: selectedShape.material,
          visualStyle: selectedStyle.name,
          finishing: selectedStyle.finishing,
        },
        qualityStandards: {
          resolution: "300 DPI",
          colorProfile: "CMJN FOGRA39",
          bleed: "3.0 mm",
          safetyMargin: "4.0 mm",
        },
      };

      const archive = new JSZip();
      archive.file("specifications.json", JSON.stringify(specData, null, 2));
      archive.file("dieline.svg", generateVectorSvg(projectName, template, dimensions, MATERIALS[0]));

      const blob = await archive.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fileName = projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || selectedShape.id;
      link.href = url;
      link.download = `edify-${fileName}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      showToast("✓ Archive ZIP avec gabarit SVG et fiche technique téléchargée !");
    } catch (err) {
      console.error(err);
      showToast("Échec de la création de l'archive ZIP.");
    }
  };

  // Share link handler
  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard?.writeText(window.location.href);
      showToast("✓ Lien de partage copié dans le presse-papier !");
    }
  };

  // Add credits handler
  const handleAddCredits = () => {
    setCredits((c) => c + 10);
    showToast("✓ +10 crédits ajoutés à votre solde !");
  };

  return (
    <div className="edify-app-shell">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="edify-toast">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main 3-Column Studio Workspace */}
      <div className="edify-workspace-container" data-purpose="app-shell">
        {/* Left Sidebar (Parameters, Dropzone, 3D Container Catalog) */}
        <LeftSidebar
          selectedShape={selectedShape}
          selectedStyle={selectedStyle}
          uploadedLogo={uploadedLogo}
          uploadedLogoName={uploadedLogoName}
          projectName={projectName}
          onSelectShape={handleSelectShape}
          onSelectStyle={handleSelectStyle}
          onLogoUpload={handleLogoUpload}
          onRemoveLogo={handleRemoveLogo}
          onRenameProject={setProjectName}
        />

        {/* Central Workspace (Clean 2D Technical Die-Line Canvas & Bottom AI Dock) */}
        <div className="edify-center-column">
          <Canvas2DWorkspace
            selectedShape={selectedShape}
            selectedStyle={selectedStyle}
            uploadedLogo={uploadedLogo}
            brandName={brandName}
            productName={productName}
            volume={volume}
            ingredients={ingredients}
            activeIngredient={activeIngredient}
            onUpdateText={(fields) => {
              if (fields.brandName !== undefined) setBrandName(fields.brandName);
              if (fields.productName !== undefined) setProductName(fields.productName);
              if (fields.volume !== undefined) setVolume(fields.volume);
              if (fields.ingredients !== undefined) setIngredients(fields.ingredients);
              if (fields.activeIngredient !== undefined) setActiveIngredient(fields.activeIngredient);
            }}
          />

          {/* Bottom Pacdora-Style AI Prompting Dock */}
          <AiPromptDock
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            onAttachReference={() => setIsStyleModalOpen(true)}
          />
        </div>

        {/* Right Sidebar (3D Photorealistic Render, Lighting & Exports) */}
        <RightSidebar
          selectedShape={selectedShape}
          selectedStyle={selectedStyle}
          brandName={brandName}
          productName={productName}
          volume={volume}
          uploadedLogo={uploadedLogo}
          credits={credits}
          onAddCredits={handleAddCredits}
          onDownloadPdf={handleDownloadPdf}
          onDownloadZip={handleDownloadZip}
          onOpenArModal={() => setIsArModalOpen(true)}
          onShare={handleShare}
        />
      </div>

      {/* Interactive Modals */}
      <ShapeSelectorModal
        isOpen={isShapeModalOpen}
        onClose={() => setIsShapeModalOpen(false)}
        selectedShape={selectedShape}
        onSelectShape={handleSelectShape}
      />

      <StyleSelectorModal
        isOpen={isStyleModalOpen}
        onClose={() => setIsStyleModalOpen(false)}
        selectedStyle={selectedStyle}
        onSelectStyle={handleSelectStyle}
      />

      <MobileArModal
        isOpen={isArModalOpen}
        onClose={() => setIsArModalOpen(false)}
        projectName={projectName}
      />
    </div>
  );
}
