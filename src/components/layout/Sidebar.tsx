"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Box,
  LayoutDashboard,
  PenTool,
  Boxes,
  Sparkles,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";
import { QuotaBar } from "./QuotaBar";
import { MOCK_SUBSCRIPTION } from "@/types/subscription";
import { clsx } from "clsx";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Studio 2D",
    href: "/studio/new",
    icon: PenTool,
    badge: "CAD",
    badgeColor: "text-print-cut bg-print-cut/10 border-print-cut/20",
  },
  {
    label: "Studio 3D",
    href: "/studio/new?view=3d",
    icon: Boxes,
    badge: "3D",
    badgeColor: "text-brand-400 bg-brand-500/10 border-brand-500/20",
  },
  {
    label: "Générateur IA",
    href: "/ai-generator",
    icon: Sparkles,
    badge: "IA",
    badgeColor: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  },
  {
    label: "Tarifs & Quotas",
    href: "/pricing",
    icon: CreditCard,
  },
  {
    label: "Paramètres",
    href: "/settings",
    icon: Settings,
  },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={clsx(
        "relative flex flex-col h-full bg-studio-900 border-r border-studio-800 sidebar-transition overflow-hidden flex-shrink-0 z-20",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* ── Brand Logo ──────────────────────────────────────────── */}
      <div className="h-14 flex items-center px-4 border-b border-studio-800 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 via-brand-500 to-violet-500 flex items-center justify-center shadow-lg shadow-brand-500/20 border border-brand-500/30 flex-shrink-0">
            <Box className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0 animate-fade-in">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-white font-mono">
                  EDIFY
                </span>
                <span className="text-[9px] uppercase tracking-wider font-semibold px-1 py-0.5 rounded bg-brand-500/20 text-brand-400 border border-brand-500/30">
                  STUDIO
                </span>
              </div>
              <p className="text-[10px] text-studio-500 leading-none truncate">
                Packaging Design & 3D AI
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Navigation Items ─────────────────────────────────────── */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <p className="px-4 mb-2 text-[10px] uppercase font-semibold text-studio-600 tracking-widest">
            Navigation
          </p>
        )}
        <ul className="space-y-0.5 px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href.split("?")[0]));

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={clsx(
                    "flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 group relative",
                    isActive
                      ? "bg-brand-600/20 text-white border border-brand-500/30 shadow-sm"
                      : "text-studio-400 hover:text-slate-200 hover:bg-studio-800 border border-transparent"
                  )}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-brand-400 rounded-r-full" />
                  )}

                  <Icon
                    className={clsx(
                      "w-4 h-4 flex-shrink-0",
                      isActive
                        ? "text-brand-400"
                        : "text-studio-500 group-hover:text-slate-300"
                    )}
                  />

                  {!collapsed && (
                    <span className="flex-1 truncate animate-fade-in">
                      {item.label}
                    </span>
                  )}

                  {!collapsed && item.badge && (
                    <span
                      className={clsx(
                        "text-[9px] font-bold px-1 py-0.5 rounded border animate-fade-in",
                        item.badgeColor
                      )}
                    >
                      {item.badge}
                    </span>
                  )}

                  {/* Tooltip for collapsed state */}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-studio-800 border border-studio-700 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
                      {item.label}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* ── Upgrade CTA (only for Starter) ─────────────────────── */}
        {!collapsed && MOCK_SUBSCRIPTION.plan.id === "starter" && (
          <div className="mx-2 mt-4 p-3 rounded-xl bg-gradient-to-br from-brand-600/15 to-violet-600/10 border border-brand-500/20 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3.5 h-3.5 text-brand-400" />
              <span className="text-xs font-semibold text-white">Passer à Pro</span>
            </div>
            <p className="text-[11px] text-studio-400 leading-snug mb-2.5">
              Projets illimités, PDF CMJN & Mockups 3D HD
            </p>
            <Link
              href="/pricing"
              className="block w-full text-center text-[11px] font-semibold py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white transition-colors"
            >
              Voir les offres →
            </Link>
          </div>
        )}
      </nav>

      {/* ── Quota Bar ────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="border-t border-studio-800 p-3 animate-fade-in">
          <QuotaBar quota={MOCK_SUBSCRIPTION} />
        </div>
      )}

      {/* ── User Avatar (collapsed) ──────────────────────────────── */}
      {collapsed && (
        <div className="border-t border-studio-800 p-2 flex justify-center">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
            U
          </div>
        </div>
      )}

      {/* ── Collapse Toggle ──────────────────────────────────────── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 rounded-full bg-studio-800 border border-studio-700 flex items-center justify-center text-studio-400 hover:text-white hover:bg-studio-700 transition-colors shadow-md z-30"
        title={collapsed ? "Étendre la sidebar" : "Réduire la sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>
    </aside>
  );
};
