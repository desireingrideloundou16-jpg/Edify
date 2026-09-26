"use client";

import React from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { QuotaUsage } from "@/types/subscription";
import { formatQuotaSummary, getQuotaRatio } from "@/lib/quota";

interface QuotaBarProps {
  quota: QuotaUsage;
}

export const QuotaBar: React.FC<QuotaBarProps> = ({ quota }) => {
  const { plan, projects_used, ai_credits_used } = quota;
  const projectRatio = getQuotaRatio(projects_used, plan.max_projects);
  const aiRatio = getQuotaRatio(ai_credits_used, plan.ai_logo_credits);

  const getBarColor = (ratio: number) => {
    if (ratio >= 0.9) return "bg-red-500";
    if (ratio >= 0.7) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="space-y-3">
      {/* ── User Profile ─────────────────────────────────── */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-md">
          U
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white truncate">Utilisateur Demo</p>
          <p className="text-[10px] text-studio-500 truncate">demo@edify.studio</p>
        </div>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-500/15 text-brand-400 border border-brand-500/25 uppercase tracking-wider flex-shrink-0">
          {plan.name}
        </span>
      </div>

      {/* ── Projects Quota ────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-studio-400 font-medium">Projets</span>
          <span className="font-mono text-slate-300">
            {projects_used}/{plan.max_projects === -1 ? "∞" : plan.max_projects}
          </span>
        </div>
        <div className="w-full h-1 bg-studio-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getBarColor(projectRatio)}`}
            style={{ width: `${Math.round(projectRatio * 100)}%` }}
          />
        </div>
      </div>

      {/* ── AI Credits Quota ──────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-studio-400 font-medium">Crédits IA</span>
          <span className="font-mono text-slate-300">
            {ai_credits_used}/{plan.ai_logo_credits === -1 ? "∞" : plan.ai_logo_credits}
          </span>
        </div>
        <div className="w-full h-1 bg-studio-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getBarColor(aiRatio)}`}
            style={{ width: `${Math.round(aiRatio * 100)}%` }}
          />
        </div>
      </div>

      {/* ── Upgrade Link ─────────────────────────────────── */}
      {plan.id !== "studio" && (
        <Link
          href="/pricing"
          className="flex items-center gap-1.5 text-[10px] font-medium text-brand-400 hover:text-brand-300 transition-colors"
        >
          <TrendingUp className="w-3 h-3" />
          <span>Augmenter les quotas</span>
        </Link>
      )}
    </div>
  );
};
