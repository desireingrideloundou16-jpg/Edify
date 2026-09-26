"use client";

import React from "react";
import { clsx } from "clsx";
import { ProjectStatus } from "@/types/project";
import { Clock, CheckCircle2, Package } from "lucide-react";

interface StatusBadgeProps {
  status: ProjectStatus;
  size?: "sm" | "md";
}

const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; className: string; icon: React.ElementType; dot: string }
> = {
  draft: {
    label: "Brouillon",
    className:
      "text-studio-400 bg-studio-800 border-studio-700",
    icon: Clock,
    dot: "bg-studio-500",
  },
  cmyk_exported: {
    label: "Exporté CMJN",
    className:
      "text-pink-400 bg-pink-500/10 border-pink-500/25",
    icon: CheckCircle2,
    dot: "bg-pink-500",
  },
  mockup_ready: {
    label: "Mockup 3D Prêt",
    className:
      "text-cyan-400 bg-cyan-500/10 border-cyan-500/25",
    icon: Package,
    dot: "bg-cyan-400",
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = "sm",
}) => {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full font-medium border",
        config.className,
        size === "sm"
          ? "text-[10px] px-2 py-0.5"
          : "text-xs px-2.5 py-1"
      )}
    >
      <span
        className={clsx(
          "inline-block rounded-full flex-shrink-0",
          config.dot,
          size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2"
        )}
      />
      <span>{config.label}</span>
    </span>
  );
};
