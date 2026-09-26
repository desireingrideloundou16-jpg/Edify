"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Filter,
  LayoutGrid,
  Sparkles,
  TrendingUp,
  Package,
  FileCheck,
  Clock,
  Box,
} from "lucide-react";
import { Project, ProjectStatus } from "@/types/project";
import { MOCK_SUBSCRIPTION } from "@/types/subscription";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { NewProjectModal } from "@/components/dashboard/NewProjectModal";
import { PackagingTemplate, BoxDimensions } from "@/types/packaging";
import { useProjectStore } from "@/lib/store/projects";
import Link from "next/link";

type FilterTab = "all" | ProjectStatus;

const FILTER_TABS: { id: FilterTab; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "Tous", icon: LayoutGrid },
  { id: "draft", label: "Brouillons", icon: Clock },
  { id: "cmyk_exported", label: "Exportés CMJN", icon: FileCheck },
  { id: "mockup_ready", label: "Mockups Prêts", icon: Package },
];

export default function DashboardPage() {
  const router = useRouter();
  const { projects, addProject, deleteProject, duplicateProject } = useProjectStore();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);

  const quota = MOCK_SUBSCRIPTION;
  const isQuotaFull =
    quota.plan.max_projects !== -1 &&
    projects.length >= quota.plan.max_projects;

  const filteredProjects = projects.filter((p) => {
    const matchesFilter = filter === "all" || p.status === filter;
    const matchesSearch =
      !search.trim() ||
      p.name.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleCreate = (
    name: string,
    template: PackagingTemplate,
    dimensions: BoxDimensions
  ) => {
    const newProject = addProject(name, template.id, dimensions);
    setShowNewModal(false);
    router.push(`/studio/${newProject.id}`);
  };

  const handleDelete = (id: string) => {
    deleteProject(id);
  };

  const handleDuplicate = (id: string) => {
    duplicateProject(id);
  };

  // Stat counters
  const stats = {
    total: projects.length,
    draft: projects.filter((p) => p.status === "draft").length,
    cmyk: projects.filter((p) => p.status === "cmyk_exported").length,
    mockup: projects.filter((p) => p.status === "mockup_ready").length,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-studio-950">
      {/* ── Dashboard Top Bar ──────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-studio-800 bg-studio-900/70 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            Mes Projets Packaging
          </h1>
          <p className="text-xs text-studio-500 mt-0.5">
            {stats.total} projet{stats.total > 1 ? "s" : ""} · Plan{" "}
            <span className="text-brand-400 font-semibold">{quota.plan.name}</span>
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold shadow-lg shadow-brand-600/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Nouveau Projet
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

          {/* ── Stats Row ─────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Projets total", value: stats.total, icon: Box, color: "text-brand-400 bg-brand-500/10 border-brand-500/20" },
              { label: "Brouillons", value: stats.draft, icon: Clock, color: "text-studio-400 bg-studio-800 border-studio-700" },
              { label: "Exportés CMJN", value: stats.cmyk, icon: FileCheck, color: "text-pink-400 bg-pink-500/10 border-pink-500/20" },
              { label: "Mockups 3D Prêts", value: stats.mockup, icon: Package, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className={`animate-fade-in-up stagger-${i + 1} rounded-xl p-4 border ${stat.color} flex items-center gap-3`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <div className="text-xl font-bold text-white">{stat.value}</div>
                    <div className="text-[11px] text-studio-400">{stat.label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Quota Warning Banner ────────────────────────────────── */}
          {isQuotaFull && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-4 py-3 flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <div>
                  <span className="text-sm font-semibold text-amber-300">
                    Quota de projets atteint
                  </span>
                  <p className="text-xs text-amber-400/70">
                    Plan Starter : 1/1 projet utilisé. Passez au plan Pro pour des projets illimités.
                  </p>
                </div>
              </div>
              <Link
                href="/pricing"
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-colors whitespace-nowrap"
              >
                Passer à Pro →
              </Link>
            </div>
          )}

          {/* ── Filter Bar + Search ─────────────────────────────────── */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Filter Tabs */}
            <div className="flex items-center bg-studio-900 border border-studio-800 rounded-xl p-1 gap-0.5">
              {FILTER_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      filter === tab.id
                        ? "bg-studio-800 text-white shadow-sm border border-studio-700"
                        : "text-studio-500 hover:text-slate-300"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-48 max-w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-studio-500" />
              <input
                type="text"
                placeholder="Rechercher un projet..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-studio-900 border border-studio-800 rounded-xl text-xs text-slate-200 placeholder-studio-500 focus:outline-none focus:border-brand-500/60 transition-colors"
              />
            </div>

            <div className="flex items-center gap-1 text-[11px] text-studio-500 ml-auto">
              <Filter className="w-3 h-3" />
              <span>{filteredProjects.length} résultat{filteredProjects.length !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {/* ── Project Grid ─────────────────────────────────────────── */}
          {filteredProjects.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {filteredProjects.map((project, i) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  index={i}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                />
              ))}

              {/* Create New Card */}
              <button
                onClick={() => setShowNewModal(true)}
                className="rounded-2xl border-2 border-dashed border-studio-700 hover:border-brand-500/50 bg-transparent hover:bg-brand-500/5 flex flex-col items-center justify-center gap-2 py-16 text-studio-500 hover:text-brand-400 transition-all duration-200 group min-h-[280px]"
              >
                <div className="w-12 h-12 rounded-xl border-2 border-dashed border-current flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold">Créer un projet</span>
              </button>
            </div>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-studio-900 border border-studio-800 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-studio-500" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">
                Aucun projet trouvé
              </h3>
              <p className="text-sm text-studio-400 max-w-xs">
                {search
                  ? `Aucun projet correspondant à "${search}"`
                  : "Créez votre premier projet de packaging pour commencer"}
              </p>
              {!search && (
                <button
                  onClick={() => setShowNewModal(true)}
                  className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Créer un projet
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* New Project Modal */}
      {showNewModal && (
        <NewProjectModal
          onClose={() => setShowNewModal(false)}
          onCreate={handleCreate}
          isQuotaFull={isQuotaFull}
        />
      )}
    </div>
  );
}
