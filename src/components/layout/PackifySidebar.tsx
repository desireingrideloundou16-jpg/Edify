"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Plus,
  Palette,
  FolderOpen,
  PanelLeftClose,
  PanelLeft,
  Settings,
  CreditCard,
  Layers,
  ChevronRight
} from "lucide-react";
import { PackagingDesignState } from "../studio/LivePackaging3D";

interface SessionItem {
  id: string;
  title: string;
  type: string;
  thumbEmoji: string;
  thumbBg: string;
}

interface PackifySidebarProps {
  onNewProject: () => void;
  onSelectSession?: (session: SessionItem) => void;
  activeSessionId?: string;
  onOpenBrandKit?: () => void;
}

export const PackifySidebar: React.FC<PackifySidebarProps> = ({
  onNewProject,
  onSelectSession,
  activeSessionId = "session-1",
  onOpenBrandKit,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const [sessions, setSessions] = useState<SessionItem[]>([
    {
      id: "session-1",
      title: "Confiture Artisanale Fraise",
      type: "Bocal avec étiquette",
      thumbEmoji: "🍓",
      thumbBg: "from-rose-500 to-red-600",
    },
    {
      id: "session-2",
      title: "Sérum Réparateur Nuit",
      type: "Flacon verre ambré",
      thumbEmoji: "✨",
      thumbBg: "from-amber-400 to-orange-500",
    },
    {
      id: "session-3",
      title: "Soda Citron Vert Givré",
      type: "Canette 330ml",
      thumbEmoji: "🍋",
      thumbBg: "from-lime-400 to-emerald-500",
    },
    {
      id: "session-4",
      title: "Coffret Prestige Ébène",
      type: "Boîte pliante",
      thumbEmoji: "📦",
      thumbBg: "from-purple-600 to-indigo-700",
    },
  ]);

  return (
    <aside
      className={`h-full bg-white border-r border-slate-200/80 flex flex-col transition-all duration-300 select-none z-30 flex-shrink-0 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* ── Brand Logo Header ────────────────────────────────────────── */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center text-white font-black shadow-md shadow-purple-500/20 flex-shrink-0">
            P
          </div>
          {!collapsed && (
            <div className="flex items-center gap-1.5 min-w-0 animate-fade-in">
              <span className="font-extrabold text-base tracking-tight text-slate-900 font-display">
                Packify
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-600 border border-purple-100">
                AI
              </span>
            </div>
          )}
        </div>

        {/* Toggle Collapse */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title={collapsed ? "Agrandir" : "Réduire"}
        >
          {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Navigation Body ──────────────────────────────────────────── */}
      <div className="flex-1 py-4 overflow-y-auto px-3 space-y-6">
        {/* Workspace Section */}
        <div>
          {!collapsed && (
            <div className="px-2 mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Espace de travail
            </div>
          )}
          <button
            onClick={onOpenBrandKit}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-purple-600 transition-colors group"
          >
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-[11px] shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
              <Palette className="w-3.5 h-3.5" />
            </div>
            {!collapsed && <span className="truncate">Kit de marque</span>}
          </button>
        </div>

        {/* Sessions Section */}
        <div>
          {!collapsed && (
            <div className="px-2 mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Sessions
            </div>
          )}

          {/* New Project Button */}
          <button
            onClick={onNewProject}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold text-slate-800 bg-slate-100 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 border border-slate-200/60 transition-all active:scale-98 mb-3 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <div className="w-5 h-5 rounded-md bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 flex-shrink-0">
              <Plus className="w-3.5 h-3.5" />
            </div>
            {!collapsed && <span>Nouveau projet</span>}
          </button>

          {/* Sessions List */}
          <div className="space-y-1">
            {sessions.map((item) => {
              const isActive = activeSessionId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectSession?.(item)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all ${
                    isActive
                      ? "bg-purple-50/80 text-purple-900 font-semibold border border-purple-200/60 shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
                  }`}
                  title={collapsed ? item.title : undefined}
                >
                  <div
                    className={`w-6 h-6 rounded-lg bg-gradient-to-br ${item.thumbBg} flex items-center justify-center text-xs shadow-sm flex-shrink-0`}
                  >
                    <span>{item.thumbEmoji}</span>
                  </div>

                  {!collapsed && (
                    <div className="min-w-0 flex-1">
                      <p className="text-xs truncate">{item.title}</p>
                      <p className="text-[10px] text-slate-400 font-normal truncate">
                        {item.type}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            U
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">Créateur IA</p>
              <p className="text-[10px] text-slate-400">Packify Pro</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
