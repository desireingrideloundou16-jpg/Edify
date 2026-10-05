"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveStructure, type StructureInput } from "@/lib/structure";
import { loadDesignFonts, type PackagingDesign } from "@/lib/artwork/draw";
import { computeSmartLayout, type SmartLayoutResult } from "@/lib/artwork/smartLayout";

/**
 * Smart layout (RECOMMEND) of the design on the format, for formats with composition regions
 * (developed conical tubs); null for every other format. Computed once per design, fonts loaded,
 * on a scratch canvas: the same result feeds the preview, the 3D and the PDF when it is applied.
 */
export function useSmartLayout(input: StructureInput, design: PackagingDesign): SmartLayoutResult | null {
  const structure = useMemo(() => resolveStructure(input), [input]);
  const [result, setResult] = useState<{ structure: unknown; value: SmartLayoutResult | null } | null>(null);
  useEffect(() => {
    if (!structure.composition) return;
    let alive = true;
    const t = setTimeout(async () => {
      await loadDesignFonts(design);
      const ctx = document.createElement("canvas").getContext("2d");
      if (!alive || !ctx) return;
      setResult({ structure, value: computeSmartLayout(structure, design, ctx) });
    }, 120);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [structure, design]);
  // A result is only used for the structure it was made for (the design may lag a moment behind).
  return structure.composition && result?.structure === structure ? result.value : null;
}
