"use client";

import React from "react";
import Link from "next/link";
import {
  MoreHorizontal,
  PenTool,
  Boxes,
  Download,
  Trash2,
  Copy,
  Calendar,
  Clock3,
} from "lucide-react";
import { Project } from "@/types/project";
import { TEMPLATES } from "@/lib/constants";
import { StatusBadge } from "./StatusBadge";
import { clsx } from "clsx";

interface ProjectCardProps {
  project: Project;
  index: number;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

const TEMPLATE_GRADIENTS: Record<string, string> = {
  "reverse-tuck": "from-violet-600/20 via-purple-800/10 to-studio-900",
  "mailer-box": "from-blue-600/20 via-blue-800/10 to-studio-900",
  "sleeve-tray": "from-emerald-600/20 via-teal-800/10 to-studio-900",
  "crash-lock": "from-amber-600/20 via-orange-800/10 to-studio-900",
};

const TEMPLATE_ICON_BG: Record<string, string> = {
  "reverse-tuck": "from-violet-500 to-purple-600",
  "mailer-box": "from-blue-500 to-cyan-600",
  "sleeve-tray": "from-emerald-500 to-teal-600",
  "crash-lock": "from-amber-500 to-orange-600",
};

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  index,
  onDelete,
  onDuplicate,
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const template = TEMPLATES.find((t) => t.id === project.template_id);
  const gradient = TEMPLATE_GRADIENTS[project.template_id] ?? "from-studio-800 to-studio-900";
  const iconGradient = TEMPLATE_ICON_BG[project.template_id] ?? "from-brand-500 to-brand-600";

  const staggerClass = `stagger-${Math.min(index + 1, 5)}`;

  return (
    <div
      className={clsx(
        "group relative rounded-2xl bg-studio-900 border border-studio-800 overflow-hidden",
        "hover:border-studio-600 transition-all duration-300 cursor-pointer animate-fade-in-up",
        project.status === "mockup_ready" && "card-glow-mockup",
        project.status === "cmyk_exported" && "card-glow-cmyk",
        project.status === "draft" && "card-glow-brand",
        staggerClass
      )}
    >
      {/* ── Card Thumbnail Area ─────────────────────────────── */}
      <div
        className={`relative h-40 bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden`}
      >
        {/* 3D Box Preview SVG */}
        <div className="relative">
          <div
            className={`w-20 h-20 rounded-xl bg-gradient-to-br ${iconGradient} shadow-2xl flex items-center justify-center`}
            style={{ transform: "perspective(200px) rotateX(10deg) rotateY(-15deg)" }}
          >
            <Boxes className="w-8 h-8 text-white opacity-90" />
          </div>
          {/* Reflection */}
          <div
            className={`absolute -bottom-4 left-0 right-0 h-8 bg-gradient-to-br ${iconGradient} opacity-20 blur-md rounded-full`}
          />
        </div>

        {/* Status badge overlay */}
        <div className="absolute top-3 left-3">
          <StatusBadge status={project.status} />
        </div>

        {/* Context menu trigger */}
        <button
          onClick={(e) => {
            e.preventDefault();
            setMenuOpen(!menuOpen);
          }}
          className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-studio-900/70 backdrop-blur-sm border border-studio-700/50 flex items-center justify-center text-studio-400 hover:text-white hover:bg-studio-800 opacity-0 group-hover:opacity-100 transition-all"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>

        {/* Dropdown Menu */}
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute top-10 right-2 z-40 w-44 bg-studio-900 border border-studio-700 rounded-xl shadow-2xl py-1 animate-scale-in">
              <button
                onClick={() => {
                  onDuplicate?.(project.id);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:bg-studio-800 transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-studio-400" />
                Dupliquer
              </button>
              <button className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:bg-studio-800 transition-colors">
                <Download className="w-3.5 h-3.5 text-studio-400" />
                Télécharger
              </button>
              <div className="h-px bg-studio-800 my-1" />
              <button
                onClick={() => {
                  onDelete?.(project.id);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Card Body ────────────────────────────────────────── */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-white leading-snug line-clamp-1 mb-1 group-hover:text-brand-300 transition-colors">
          {project.name}
        </h3>
        <p className="text-[11px] text-studio-500 mb-3 line-clamp-1">
          {template?.name ?? project.template_id} · {template?.code}
        </p>

        {/* Metadata row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10px] text-studio-500">
            <Clock3 className="w-3 h-3" />
            <span>{formatRelativeDate(project.updated_at)}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-studio-500">
            <Calendar className="w-3 h-3" />
            <span>{new Date(project.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
          </div>
        </div>
      </div>

      {/* ── Action Buttons (appear on hover) ─────────────────── */}
      <div className="px-4 pb-4 grid grid-cols-2 gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 -mt-1">
        <Link
          href={`/studio/${project.id}`}
          className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[11px] font-semibold transition-colors"
        >
          <PenTool className="w-3 h-3" />
          Éditer 2D
        </Link>
        <Link
          href={`/studio/${project.id}?view=3d`}
          className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-studio-800 hover:bg-studio-700 text-slate-300 text-[11px] font-medium border border-studio-700 transition-colors"
        >
          <Boxes className="w-3 h-3" />
          Vue 3D
        </Link>
      </div>

      {/* Subtle active glow line at bottom */}
      <div
        className={clsx(
          "absolute bottom-0 left-0 right-0 h-0.5",
          project.status === "mockup_ready" && "bg-gradient-to-r from-transparent via-cyan-400 to-transparent",
          project.status === "cmyk_exported" && "bg-gradient-to-r from-transparent via-pink-500 to-transparent",
          project.status === "draft" && "bg-gradient-to-r from-transparent via-studio-600 to-transparent"
        )}
      />
    </div>
  );
};
