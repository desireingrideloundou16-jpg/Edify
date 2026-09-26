import { PackagingTemplate, BoxDimensions, MaterialOption } from "@/types/packaging";

export function generateVectorSvg(
  projectName: string,
  template: PackagingTemplate,
  dimensions: BoxDimensions,
  material: MaterialOption
): string {
  const { length: L, width: W, height: H, glueFlap: G, bleed: B, tuckFlap: T } = dimensions;

  // Margin in mm around dieline for title and bleed
  const margin = 20;
  const totalW = G + (L * 2) + (W * 2) + (B * 2) + (margin * 2);
  const totalH = H + (W * 2) + (T * 2) + (B * 2) + (margin * 2) + 30; // +30 for title block

  const originX = margin + B;
  const originY = margin + B + W + T;

  const gW = G;
  const lW = L;
  const wW = W;
  const hH = H;
  const tH = T;

  const pGlueX = originX;
  const pBackX = originX + gW;
  const pLeftX = originX + gW + lW;
  const pFrontX = originX + gW + lW + wW;
  const pRightX = originX + gW + lW + wW + lW;

  const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     width="${totalW}mm" 
     height="${totalH}mm" 
     viewBox="0 0 ${totalW} ${totalH}">
  <defs>
    <style>
      .thrucut { stroke: #E11D48; stroke-width: 0.35; fill: none; stroke-linecap: round; }
      .crease { stroke: #0284C7; stroke-width: 0.35; stroke-dasharray: 2,1.5; fill: none; }
      .bleed { stroke: #10B981; stroke-width: 0.25; stroke-dasharray: 1,1; fill: none; opacity: 0.7; }
      .annotation { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 3.5px; fill: #64748B; }
      .title { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 4px; font-weight: bold; fill: #0F172A; }
    </style>
  </defs>

  <!-- ── Layer: Information & Title Block ─────────────────── -->
  <g id="TITLE_BLOCK">
    <text x="${margin}" y="${margin / 2 + 2}" class="title">EDIFY STUDIO — ${projectName.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>
    <text x="${margin}" y="${margin / 2 + 7}" class="annotation">Gabarit: ${template.name} (${template.code}) · Dimensions: ${L}x${W}x${H}mm · Matière: ${material.name} (${material.grammage}g/m²)</text>
    <text x="${totalW - margin}" y="${margin / 2 + 7}" text-anchor="end" class="annotation">Profil: ISO Coated v2 (Fogra39) · Découpe Spot ThruCut / Crease</text>
  </g>

  <!-- ── Layer: Bleed Guide (Fond Perdu) ──────────────────── -->
  <g id="BLEED_GUIDE" class="bleed">
    <rect x="${originX - B}" y="${originY - wW - tH - B}" width="${gW + (lW * 2) + (wW * 2) + (B * 2)}" height="${hH + (wW * 2) + (tH * 2) + (B * 2)}" rx="2" />
  </g>

  <!-- ── Layer: Crease / Score Lines (Rainage) ────────────── -->
  <g id="CREASE_SCORE" class="crease">
    <!-- Glue Flap Fold -->
    <line x1="${pBackX}" y1="${originY}" x2="${pBackX}" y2="${originY + hH}" />
    <!-- Back to Left Fold -->
    <line x1="${pLeftX}" y1="${originY}" x2="${pLeftX}" y2="${originY + hH}" />
    <!-- Left to Front Fold -->
    <line x1="${pFrontX}" y1="${originY}" x2="${pFrontX}" y2="${originY + hH}" />
    <!-- Front to Right Fold -->
    <line x1="${pRightX}" y1="${originY}" x2="${pRightX}" y2="${originY + hH}" />
    <!-- Horizontal Body Top Fold -->
    <line x1="${pBackX}" y1="${originY}" x2="${pRightX + wW}" y2="${originY}" />
    <!-- Horizontal Body Bottom Fold -->
    <line x1="${pBackX}" y1="${originY + hH}" x2="${pRightX + wW}" y2="${originY + hH}" />
    <!-- Top Flap Fold -->
    <line x1="${pFrontX}" y1="${originY - wW}" x2="${pFrontX + lW}" y2="${originY - wW}" />
    <!-- Bottom Flap Fold -->
    <line x1="${pBackX}" y1="${originY + hH + wW}" x2="${pBackX + lW}" y2="${originY + hH + wW}" />
  </g>

  <!-- ── Layer: ThruCut (Filet de Découpe Extérieure) ─────── -->
  <g id="THRU_CUT" class="thrucut">
    <!-- Glue Flap Trapezoid -->
    <line x1="${pGlueX}" y1="${originY + 2}" x2="${pGlueX}" y2="${originY + hH - 2}" />
    <line x1="${pGlueX}" y1="${originY + 2}" x2="${pBackX}" y2="${originY}" />
    <line x1="${pGlueX}" y1="${originY + hH - 2}" x2="${pBackX}" y2="${originY + hH}" />

    <!-- Top Flaps: Left Dust Flap -->
    <line x1="${pLeftX}" y1="${originY}" x2="${pLeftX}" y2="${originY - (wW * 0.75)}" />
    <line x1="${pLeftX}" y1="${originY - (wW * 0.75)}" x2="${pLeftX + wW}" y2="${originY - (wW * 0.75)}" />
    <line x1="${pLeftX + wW}" y1="${originY - (wW * 0.75)}" x2="${pLeftX + wW}" y2="${originY}" />

    <!-- Top Flaps: Front Cover & Tuck Flap -->
    <line x1="${pFrontX}" y1="${originY}" x2="${pFrontX}" y2="${originY - wW}" />
    <line x1="${pFrontX}" y1="${originY - wW}" x2="${pFrontX + (lW * 0.1)}" y2="${originY - wW - tH}" />
    <line x1="${pFrontX + (lW * 0.1)}" y1="${originY - wW - tH}" x2="${pFrontX + (lW * 0.9)}" y2="${originY - wW - tH}" />
    <line x1="${pFrontX + (lW * 0.9)}" y1="${originY - wW - tH}" x2="${pFrontX + lW}" y2="${originY - wW}" />
    <line x1="${pFrontX + lW}" y1="${originY - wW}" x2="${pFrontX + lW}" y2="${originY}" />

    <!-- Top Flaps: Right Dust Flap -->
    <line x1="${pRightX}" y1="${originY}" x2="${pRightX}" y2="${originY - (wW * 0.75)}" />
    <line x1="${pRightX}" y1="${originY - (wW * 0.75)}" x2="${pRightX + wW}" y2="${originY - (wW * 0.75)}" />
    <line x1="${pRightX + wW}" y1="${originY - (wW * 0.75)}" x2="${pRightX + wW}" y2="${originY}" />

    <!-- Right Outer Edge -->
    <line x1="${pRightX + wW}" y1="${originY}" x2="${pRightX + wW}" y2="${originY + hH}" />

    <!-- Bottom Flaps: Right Dust Flap -->
    <line x1="${pRightX + wW}" y1="${originY + hH}" x2="${pRightX + wW}" y2="${originY + hH + (wW * 0.75)}" />
    <line x1="${pRightX + wW}" y1="${originY + hH + (wW * 0.75)}" x2="${pRightX}" y2="${originY + hH + (wW * 0.75)}" />
    <line x1="${pRightX}" y1="${originY + hH + (wW * 0.75)}" x2="${pRightX}" y2="${originY + hH}" />

    <!-- Bottom Flaps: Front Dust Flap (Left) -->
    <line x1="${pLeftX + wW}" y1="${originY + hH}" x2="${pLeftX + wW}" y2="${originY + hH + (wW * 0.75)}" />
    <line x1="${pLeftX + wW}" y1="${originY + hH + (wW * 0.75)}" x2="${pLeftX}" y2="${originY + hH + (wW * 0.75)}" />
    <line x1="${pLeftX}" y1="${originY + hH + (wW * 0.75)}" x2="${pLeftX}" y2="${originY + hH}" />

    <!-- Bottom Flaps: Back Cover & Tuck Flap -->
    <line x1="${pBackX}" y1="${originY + hH}" x2="${pBackX}" y2="${originY + hH + wW}" />
    <line x1="${pBackX}" y1="${originY + hH + wW}" x2="${pBackX + (lW * 0.1)}" y2="${originY + hH + wW + tH}" />
    <line x1="${pBackX + (lW * 0.1)}" y1="${originY + hH + wW + tH}" x2="${pBackX + (lW * 0.9)}" y2="${originY + hH + wW + tH}" />
    <line x1="${pBackX + (lW * 0.9)}" y1="${originY + hH + wW + tH}" x2="${pBackX + lW}" y2="${originY + hH + wW}" />
    <line x1="${pBackX + lW}" y1="${originY + hH + wW}" x2="${pBackX + lW}" y2="${originY + hH}" />
  </g>

  <!-- ── Layer: Panel Labels ─────────────────────────────── -->
  <g id="LABELS" class="annotation">
    <text x="${pGlueX + gW / 2}" y="${originY + hH / 2}" text-anchor="middle">COLLAGE</text>
    <text x="${pBackX + lW / 2}" y="${originY + hH / 2}" text-anchor="middle">FACE ARRIÈRE</text>
    <text x="${pLeftX + wW / 2}" y="${originY + hH / 2}" text-anchor="middle">CÔTÉ GAUCHE</text>
    <text x="${pFrontX + lW / 2}" y="${originY + hH / 2}" text-anchor="middle">FACE AVANT</text>
    <text x="${pRightX + wW / 2}" y="${originY + hH / 2}" text-anchor="middle">CÔTÉ DROIT</text>
  </g>
</svg>`;

  return svgContent;
}

export function downloadVectorSvg(
  projectName: string,
  template: PackagingTemplate,
  dimensions: BoxDimensions,
  material: MaterialOption
): void {
  const svgText = generateVectorSvg(projectName, template, dimensions, material);
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dieline-${template.id}-${Date.now()}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}
