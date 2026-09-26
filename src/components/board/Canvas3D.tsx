"use client";

import React, { useState, useRef } from "react";
import { BoxDimensions, MaterialOption } from "@/types/packaging";
import { RotateCw, Sparkles, Box, Sliders } from "lucide-react";

interface Canvas3DProps {
  dimensions: BoxDimensions;
  material: MaterialOption;
}

export const Canvas3D: React.FC<Canvas3DProps> = ({ dimensions, material }) => {
  const [foldProgress, setFoldProgress] = useState<number>(85); // 0% flat -> 100% folded
  const [rotation, setRotation] = useState({ x: -20, y: 35 });
  const [isRotating, setIsRotating] = useState(false);
  const startPos = useRef({ x: 0, y: 0 });

  const { length: L, width: W, height: H } = dimensions;

  // Scale down for 3D viewport representation
  const maxDim = Math.max(L, W, H, 100);
  const s = 240 / maxDim;

  const wPx = Math.round(W * s);
  const lPx = Math.round(L * s);
  const hPx = Math.round(H * s);

  // Fold angle factor (90 deg when 100%)
  const foldAngle = (foldProgress / 100) * 90;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsRotating(true);
    startPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isRotating) return;
    const deltaX = e.clientX - startPos.current.x;
    const deltaY = e.clientY - startPos.current.y;
    setRotation((prev) => ({
      x: Math.max(-85, Math.min(85, prev.x - deltaY * 0.5)),
      y: prev.y + deltaX * 0.5,
    }));
    startPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    setIsRotating(false);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-studio-950 via-studio-900 to-studio-950 overflow-hidden cursor-grab active:cursor-grabbing select-none"
    >
      {/* 3D Environment Floating Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="bg-studio-900/90 backdrop-blur-md px-3 py-2 rounded-lg border border-studio-800 shadow-xl flex items-center gap-3">
          <Box className="w-4 h-4 text-brand-400" />
          <div>
            <span className="text-xs font-semibold text-white">Visualisation 3D Paramétrique</span>
            <p className="text-[11px] text-studio-500">Cliquez et glissez pour orbiter à 360°</p>
          </div>
        </div>
      </div>

      {/* Floating Fold Progress Control Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 w-80 bg-studio-900/95 backdrop-blur-md px-4 py-3 rounded-xl border border-studio-700/80 shadow-2xl flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Sliders className="w-3.5 h-3.5 text-brand-400" />
            <span>Simulation Pliage (Folding)</span>
          </div>
          <span className="font-mono text-brand-400 font-bold">{foldProgress}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={foldProgress}
          onChange={(e) => setFoldProgress(Number(e.target.value))}
          className="w-full accent-brand-500 h-1.5 bg-studio-800 rounded-lg cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-studio-500 font-mono">
          <span>0% Développé à plat</span>
          <span>50% Montage</span>
          <span>100% Boîte fermée</span>
        </div>
      </div>

      {/* 3D Viewport Scene */}
      <div
        className="w-full h-full flex items-center justify-center"
        style={{
          perspective: "1200px",
        }}
      >
        <div
          className="relative transition-transform duration-75 ease-out"
          style={{
            width: `${lPx}px`,
            height: `${hPx}px`,
            transformStyle: "preserve-3d",
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
          }}
        >
          {/* Main Front Panel (Face Avant) */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center border border-studio-700/60 shadow-2xl transition-all"
            style={{
              backgroundColor: material.color,
              color: material.color === "#1E2229" ? "#E2E8F0" : "#1E293B",
              transformStyle: "preserve-3d",
            }}
          >
            <span className="text-xs font-bold uppercase tracking-wider font-mono opacity-80">
              Face Avant
            </span>
            <span className="text-[10px] opacity-60 font-mono">
              {L} × {H} mm
            </span>

            {/* Left Side Panel - Folds inwards from left edge */}
            <div
              className="absolute top-0 right-full border border-studio-700/60 flex flex-col items-center justify-center transition-all"
              style={{
                width: `${wPx}px`,
                height: `${hPx}px`,
                transformOrigin: "right center",
                transform: `rotateY(${-foldAngle}deg)`,
                backgroundColor: material.color,
                color: material.color === "#1E2229" ? "#E2E8F0" : "#1E293B",
                filter: "brightness(0.92)",
                transformStyle: "preserve-3d",
              }}
            >
              <span className="text-[11px] font-bold font-mono opacity-80">Gauche</span>
              <span className="text-[9px] opacity-60 font-mono">{W} × {H} mm</span>

              {/* Back Panel connected to Left Panel */}
              <div
                className="absolute top-0 right-full border border-studio-700/60 flex flex-col items-center justify-center transition-all"
                style={{
                  width: `${lPx}px`,
                  height: `${hPx}px`,
                  transformOrigin: "right center",
                  transform: `rotateY(${-foldAngle}deg)`,
                  backgroundColor: material.color,
                  color: material.color === "#1E2229" ? "#E2E8F0" : "#1E293B",
                  filter: "brightness(0.85)",
                  transformStyle: "preserve-3d",
                }}
              >
                <span className="text-xs font-bold font-mono opacity-80">Face Arrière</span>
                <span className="text-[10px] opacity-60 font-mono">{L} × {H} mm</span>

                {/* Bottom Cover Flap connected to Back panel */}
                <div
                  className="absolute top-full left-0 border border-studio-700/60 flex items-center justify-center transition-all"
                  style={{
                    width: `${lPx}px`,
                    height: `${wPx}px`,
                    transformOrigin: "center top",
                    transform: `rotateX(${-foldAngle}deg)`,
                    backgroundColor: material.color,
                    filter: "brightness(0.8)",
                  }}
                >
                  <span className="text-[10px] font-mono opacity-70">Fond</span>
                </div>
              </div>
            </div>

            {/* Right Side Panel - Folds inwards from right edge */}
            <div
              className="absolute top-0 left-full border border-studio-700/60 flex flex-col items-center justify-center transition-all"
              style={{
                width: `${wPx}px`,
                height: `${hPx}px`,
                transformOrigin: "left center",
                transform: `rotateY(${foldAngle}deg)`,
                backgroundColor: material.color,
                color: material.color === "#1E2229" ? "#E2E8F0" : "#1E293B",
                filter: "brightness(0.92)",
              }}
            >
              <span className="text-[11px] font-bold font-mono opacity-80">Droit</span>
              <span className="text-[9px] opacity-60 font-mono">{W} × {H} mm</span>
            </div>

            {/* Top Cover (Couvercle) connected to top edge of Front */}
            <div
              className="absolute bottom-full left-0 border border-studio-700/60 flex items-center justify-center transition-all"
              style={{
                width: `${lPx}px`,
                height: `${wPx}px`,
                transformOrigin: "center bottom",
                transform: `rotateX(${foldAngle}deg)`,
                backgroundColor: material.color,
                color: material.color === "#1E2229" ? "#E2E8F0" : "#1E293B",
                filter: "brightness(1.05)",
                transformStyle: "preserve-3d",
              }}
            >
              <span className="text-[10px] font-mono opacity-80">Couvercle</span>

              {/* Tuck Flap on Top Cover */}
              <div
                className="absolute bottom-full left-0 border border-dashed border-studio-700/60 flex items-center justify-center rounded-t-md"
                style={{
                  width: `${lPx}px`,
                  height: `${Math.round(wPx * 0.45)}px`,
                  transformOrigin: "center bottom",
                  transform: `rotateX(${foldAngle * 0.9}deg)`,
                  backgroundColor: material.color,
                  filter: "brightness(0.95)",
                }}
              >
                <span className="text-[9px] font-mono opacity-60">Languette</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
