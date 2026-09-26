import { PDFDocument, rgb, StandardFonts, LineCapStyle } from "pdf-lib";
import { PackagingTemplate, BoxDimensions, MaterialOption } from "@/types/packaging";

export async function generateBatPdf(
  projectName: string,
  template: PackagingTemplate,
  dimensions: BoxDimensions,
  material: MaterialOption
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontCourier = await pdfDoc.embedFont(StandardFonts.Courier);

  // A3 Landscape: 420mm x 297mm in PDF points (1mm = 72 / 25.4 = 2.83465 points)
  const mmToPt = 2.83465;
  const pageWidth = 420 * mmToPt;  // 1190.55 pt
  const pageHeight = 297 * mmToPt; // 841.89 pt

  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  // Colors
  const cCut = rgb(0.88, 0.11, 0.28);      // Spot Magenta (Cut)
  const cCrease = rgb(0.01, 0.52, 0.78);   // Spot Cyan (Crease)
  const cBleed = rgb(0.06, 0.72, 0.50);    // Spot Green (Bleed)
  const cDark = rgb(0.08, 0.10, 0.14);     // Dark Studio
  const cBorder = rgb(0.82, 0.85, 0.90);   // Neutral light border
  const cMuted = rgb(0.45, 0.50, 0.58);    // Muted grey

  // 1. Draw Page Border & Header
  page.drawRectangle({
    x: 15 * mmToPt,
    y: 15 * mmToPt,
    width: (420 - 30) * mmToPt,
    height: (297 - 30) * mmToPt,
    borderColor: cBorder,
    borderWidth: 1,
  });

  // Top Header Ribbon
  page.drawRectangle({
    x: 15 * mmToPt,
    y: (297 - 28) * mmToPt,
    width: (420 - 30) * mmToPt,
    height: 13 * mmToPt,
    color: rgb(0.06, 0.08, 0.12),
  });

  page.drawText("EDIFY PACKAGING STUDIO — BON À TIRER TECHNIQUE (BAT)", {
    x: 20 * mmToPt,
    y: (297 - 23.5) * mmToPt,
    size: 10,
    font: fontHelveticaBold,
    color: rgb(1, 1, 1),
  });

  page.drawText("NORME ISO 12647-2 · FICHIER PREPRESS CERTIFIÉ", {
    x: 290 * mmToPt,
    y: (297 - 23.5) * mmToPt,
    size: 8,
    font: fontCourier,
    color: rgb(0.7, 0.75, 0.85),
  });

  // 2. Technical Title Block (Cartouche Technique) at Bottom
  const cartoucheX = 15 * mmToPt;
  const cartoucheY = 15 * mmToPt;
  const cartoucheW = (420 - 30) * mmToPt;
  const cartoucheH = 34 * mmToPt;

  page.drawRectangle({
    x: cartoucheX,
    y: cartoucheY,
    width: cartoucheW,
    height: cartoucheH,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: cBorder,
    borderWidth: 1,
  });

  // Vertical dividers in cartouche
  const col1 = cartoucheX + 110 * mmToPt;
  const col2 = cartoucheX + 220 * mmToPt;
  const col3 = cartoucheX + 310 * mmToPt;

  page.drawLine({
    start: { x: col1, y: cartoucheY },
    end: { x: col1, y: cartoucheY + cartoucheH },
    color: cBorder,
    thickness: 1,
  });
  page.drawLine({
    start: { x: col2, y: cartoucheY },
    end: { x: col2, y: cartoucheY + cartoucheH },
    color: cBorder,
    thickness: 1,
  });
  page.drawLine({
    start: { x: col3, y: cartoucheY },
    end: { x: col3, y: cartoucheY + cartoucheH },
    color: cBorder,
    thickness: 1,
  });

  // Column 1: Project & Client
  page.drawText("PROJET :", { x: cartoucheX + 8, y: cartoucheY + cartoucheH - 14, size: 7, font: fontHelveticaBold, color: cMuted });
  page.drawText(projectName.slice(0, 42), { x: cartoucheX + 8, y: cartoucheY + cartoucheH - 26, size: 10, font: fontHelveticaBold, color: cDark });

  page.drawText("GABARIT DÉPOUILLE :", { x: cartoucheX + 8, y: cartoucheY + cartoucheH - 42, size: 7, font: fontHelveticaBold, color: cMuted });
  page.drawText(`${template.name} (${template.code})`, { x: cartoucheX + 8, y: cartoucheY + cartoucheH - 54, size: 8, font: fontHelvetica, color: cDark });

  // Column 2: Dimensions & Prepress Spec
  const { length: L, width: W, height: H, caliper, glueFlap, bleed, safetyMargin, tuckFlap } = dimensions;
  page.drawText("DIMENSIONS UTILES (L × W × H) :", { x: col1 + 8, y: cartoucheY + cartoucheH - 14, size: 7, font: fontHelveticaBold, color: cMuted });
  page.drawText(`${L} × ${W} × ${H} mm`, { x: col1 + 8, y: cartoucheY + cartoucheH - 26, size: 11, font: fontHelveticaBold, color: cDark });

  page.drawText(`Épaisseur: ${caliper} mm · Patte collage: ${glueFlap} mm · Rabat: ${tuckFlap} mm`, {
    x: col1 + 8,
    y: cartoucheY + cartoucheH - 42,
    size: 7.5,
    font: fontHelvetica,
    color: cDark,
  });
  page.drawText(`Fond perdu (Bleed): ${bleed} mm · Zone tranquille: ${safetyMargin} mm`, {
    x: col1 + 8,
    y: cartoucheY + cartoucheH - 54,
    size: 7.5,
    font: fontHelvetica,
    color: cDark,
  });

  // Column 3: Material & Color Space
  page.drawText("MATIÈRE DU SUPPORT :", { x: col2 + 8, y: cartoucheY + cartoucheH - 14, size: 7, font: fontHelveticaBold, color: cMuted });
  page.drawText(material.name.slice(0, 36), { x: col2 + 8, y: cartoucheY + cartoucheH - 26, size: 8.5, font: fontHelveticaBold, color: cDark });
  page.drawText(`${material.grammage} g/m² · ${material.family}`, { x: col2 + 8, y: cartoucheY + cartoucheH - 38, size: 7.5, font: fontHelvetica, color: cDark });

  page.drawText("PROFIL ICC : ISO Coated v2 (ECI) / Fogra39 CMJN", {
    x: col2 + 8,
    y: cartoucheY + cartoucheH - 54,
    size: 7,
    font: fontCourier,
    color: rgb(0.2, 0.4, 0.8),
  });

  // Column 4: Legend & Sign-off
  page.drawText("LÉGENDE TECHNIQUE :", { x: col3 + 8, y: cartoucheY + cartoucheH - 14, size: 7, font: fontHelveticaBold, color: cMuted });
  
  // Legend items
  page.drawLine({ start: { x: col3 + 8, y: cartoucheY + cartoucheH - 24 }, end: { x: col3 + 24, y: cartoucheY + cartoucheH - 24 }, color: cCut, thickness: 2 });
  page.drawText("ThruCut (Découpe)", { x: col3 + 28, y: cartoucheY + cartoucheH - 27, size: 7.5, font: fontHelvetica, color: cDark });

  page.drawLine({ start: { x: col3 + 8, y: cartoucheY + cartoucheH - 38 }, end: { x: col3 + 24, y: cartoucheY + cartoucheH - 38 }, color: cCrease, thickness: 1.5, dashArray: [3, 2] });
  page.drawText("Crease (Rainage/Pli)", { x: col3 + 28, y: cartoucheY + cartoucheH - 41, size: 7.5, font: fontHelvetica, color: cDark });

  page.drawLine({ start: { x: col3 + 8, y: cartoucheY + cartoucheH - 52 }, end: { x: col3 + 24, y: cartoucheY + cartoucheH - 52 }, color: cBleed, thickness: 1 });
  page.drawText(`Bleed (${bleed}mm)`, { x: col3 + 28, y: cartoucheY + cartoucheH - 55, size: 7.5, font: fontHelvetica, color: cDark });

  // 3. Draw Dieline Geometry (Auto-scaled to fit the drawing area)
  // Usable drawing area:
  const drawAreaX = 30 * mmToPt;
  const drawAreaY = (cartoucheY + cartoucheH + 15 * mmToPt);
  const drawAreaW = (420 - 60) * mmToPt;
  const drawAreaH = ((297 - 35) * mmToPt) - drawAreaY;

  // Compute total dimensions in mm for layout
  const totalBoxWidthMm = glueFlap + (L * 2) + (W * 2);
  const totalBoxHeightMm = H + (W * 2) + (tuckFlap * 2);

  // Fit scale factor
  const scaleFit = Math.min(
    (drawAreaW / (totalBoxWidthMm * mmToPt)) * 0.85,
    (drawAreaH / (totalBoxHeightMm * mmToPt)) * 0.85,
    1.2 // Max 1.2x scale
  );

  const finalScale = scaleFit * mmToPt;

  // Center drawing in available area
  const originX = drawAreaX + (drawAreaW - (totalBoxWidthMm * finalScale)) / 2;
  const originY = drawAreaY + (drawAreaH - (totalBoxHeightMm * finalScale)) / 2 + (W + tuckFlap) * finalScale;

  const gW = glueFlap * finalScale;
  const lW = L * finalScale;
  const wW = W * finalScale;
  const hH = H * finalScale;
  const tH = tuckFlap * finalScale;

  // Main 4 body panels + glue flap
  const pGlue = { x: originX, y: originY, w: gW, h: hH };
  const pBack = { x: originX + gW, y: originY, w: lW, h: hH };
  const pLeft = { x: originX + gW + lW, y: originY, w: wW, h: hH };
  const pFront = { x: originX + gW + lW + wW, y: originY, w: lW, h: hH };
  const pRight = { x: originX + gW + lW + wW + lW, y: originY, w: wW, h: hH };

  // Draw Crease lines (interior folds)
  const creaseLines = [
    // Glue flap fold
    { x1: pGlue.x + pGlue.w, y1: originY, x2: pGlue.x + pGlue.w, y2: originY + hH },
    // Back to Left fold
    { x1: pBack.x + pBack.w, y1: originY, x2: pBack.x + pBack.w, y2: originY + hH },
    // Left to Front fold
    { x1: pLeft.x + pLeft.w, y1: originY, x2: pLeft.x + pLeft.w, y2: originY + hH },
    // Front to Right fold
    { x1: pFront.x + pFront.w, y1: originY, x2: pFront.x + pFront.w, y2: originY + hH },
    // Top horizontal crease line
    { x1: originX + gW, y1: originY + hH, x2: originX + gW + (lW * 2) + (wW * 2), y2: originY + hH },
    // Bottom horizontal crease line
    { x1: originX + gW, y1: originY, x2: originX + gW + (lW * 2) + (wW * 2), y2: originY },
    // Top Tuck fold
    { x1: pFront.x, y1: originY + hH + wW, x2: pFront.x + lW, y2: originY + hH + wW },
    // Bottom Tuck fold
    { x1: pBack.x, y1: originY - wW, x2: pBack.x + lW, y2: originY - wW },
  ];

  creaseLines.forEach((l) => {
    page.drawLine({
      start: { x: l.x1, y: l.y1 },
      end: { x: l.x2, y: l.y2 },
      color: cCrease,
      thickness: 1.2,
      dashArray: [4, 3],
      lineCap: LineCapStyle.Round,
    });
  });

  // Draw Cut lines (outer boundary)
  // Panels outline:
  // Glue flap trapezoid
  page.drawLine({ start: { x: pGlue.x, y: originY + (hH * 0.1) }, end: { x: pGlue.x, y: originY + (hH * 0.9) }, color: cCut, thickness: 1.5 });
  page.drawLine({ start: { x: pGlue.x, y: originY + (hH * 0.9) }, end: { x: pGlue.x + pGlue.w, y: originY + hH }, color: cCut, thickness: 1.5 });
  page.drawLine({ start: { x: pGlue.x, y: originY + (hH * 0.1) }, end: { x: pGlue.x + pGlue.w, y: originY }, color: cCut, thickness: 1.5 });

  // Top cover on pFront
  page.drawLine({ start: { x: pFront.x, y: originY + hH }, end: { x: pFront.x, y: originY + hH + wW }, color: cCut, thickness: 1.5 });
  page.drawLine({ start: { x: pFront.x + lW, y: originY + hH }, end: { x: pFront.x + lW, y: originY + hH + wW }, color: cCut, thickness: 1.5 });
  // Top tuck flap
  page.drawLine({ start: { x: pFront.x, y: originY + hH + wW }, end: { x: pFront.x + (lW * 0.1), y: originY + hH + wW + tH }, color: cCut, thickness: 1.5 });
  page.drawLine({ start: { x: pFront.x + (lW * 0.1), y: originY + hH + wW + tH }, end: { x: pFront.x + (lW * 0.9), y: originY + hH + wW + tH }, color: cCut, thickness: 1.5 });
  page.drawLine({ start: { x: pFront.x + (lW * 0.9), y: originY + hH + wW + tH }, end: { x: pFront.x + lW, y: originY + hH + wW }, color: cCut, thickness: 1.5 });

  // Dust flaps top (Left & Right)
  page.drawLine({ start: { x: pLeft.x, y: originY + hH + (wW * 0.75) }, end: { x: pLeft.x + wW, y: originY + hH + (wW * 0.75) }, color: cCut, thickness: 1.5 });
  page.drawLine({ start: { x: pLeft.x, y: originY + hH }, end: { x: pLeft.x, y: originY + hH + (wW * 0.75) }, color: cCut, thickness: 1.5 });
  page.drawLine({ start: { x: pLeft.x + wW, y: originY + hH }, end: { x: pLeft.x + wW, y: originY + hH + (wW * 0.75) }, color: cCut, thickness: 1.5 });

  page.drawLine({ start: { x: pRight.x, y: originY + hH + (wW * 0.75) }, end: { x: pRight.x + wW, y: originY + hH + (wW * 0.75) }, color: cCut, thickness: 1.5 });
  page.drawLine({ start: { x: pRight.x, y: originY + hH }, end: { x: pRight.x, y: originY + hH + (wW * 0.75) }, color: cCut, thickness: 1.5 });
  page.drawLine({ start: { x: pRight.x + wW, y: originY + hH }, end: { x: pRight.x + wW, y: originY + hH + (wW * 0.75) }, color: cCut, thickness: 1.5 });

  // Bottom cover on pBack
  page.drawLine({ start: { x: pBack.x, y: originY }, end: { x: pBack.x, y: originY - wW }, color: cCut, thickness: 1.5 });
  page.drawLine({ start: { x: pBack.x + lW, y: originY }, end: { x: pBack.x + lW, y: originY - wW }, color: cCut, thickness: 1.5 });
  // Bottom tuck flap
  page.drawLine({ start: { x: pBack.x, y: originY - wW }, end: { x: pBack.x + (lW * 0.1), y: originY - wW - tH }, color: cCut, thickness: 1.5 });
  page.drawLine({ start: { x: pBack.x + (lW * 0.1), y: originY - wW - tH }, end: { x: pBack.x + (lW * 0.9), y: originY - wW - tH }, color: cCut, thickness: 1.5 });
  page.drawLine({ start: { x: pBack.x + (lW * 0.9), y: originY - wW - tH }, end: { x: pBack.x + lW, y: originY - wW }, color: cCut, thickness: 1.5 });

  // Dust flaps bottom (Left & Right)
  page.drawLine({ start: { x: pLeft.x, y: originY - (wW * 0.75) }, end: { x: pLeft.x + wW, y: originY - (wW * 0.75) }, color: cCut, thickness: 1.5 });
  page.drawLine({ start: { x: pLeft.x, y: originY }, end: { x: pLeft.x, y: originY - (wW * 0.75) }, color: cCut, thickness: 1.5 });
  page.drawLine({ start: { x: pLeft.x + wW, y: originY }, end: { x: pLeft.x + wW, y: originY - (wW * 0.75) }, color: cCut, thickness: 1.5 });

  page.drawLine({ start: { x: pRight.x, y: originY - (wW * 0.75) }, end: { x: pRight.x + wW, y: originY - (wW * 0.75) }, color: cCut, thickness: 1.5 });
  page.drawLine({ start: { x: pRight.x, y: originY }, end: { x: pRight.x, y: originY - (wW * 0.75) }, color: cCut, thickness: 1.5 });
  page.drawLine({ start: { x: pRight.x + wW, y: originY }, end: { x: pRight.x + wW, y: originY - (wW * 0.75) }, color: cCut, thickness: 1.5 });

  // Right edge of right panel
  page.drawLine({ start: { x: pRight.x + wW, y: originY }, end: { x: pRight.x + wW, y: originY + hH }, color: cCut, thickness: 1.5 });

  // 4. Panel Labels in PDF
  const panels = [
    { name: "COLLAGE", x: pGlue.x + pGlue.w / 2, y: originY + hH / 2, size: 7 },
    { name: "FACE ARRIÈRE", x: pBack.x + pBack.w / 2, y: originY + hH / 2, size: 9 },
    { name: "CÔTÉ GAUCHE", x: pLeft.x + pLeft.w / 2, y: originY + hH / 2, size: 8 },
    { name: "FACE AVANT", x: pFront.x + pFront.w / 2, y: originY + hH / 2, size: 9 },
    { name: "CÔTÉ DROIT", x: pRight.x + pRight.w / 2, y: originY + hH / 2, size: 8 },
  ];

  panels.forEach((p) => {
    const textWidth = fontHelveticaBold.widthOfTextAtSize(p.name, p.size);
    page.drawText(p.name, {
      x: p.x - textWidth / 2,
      y: p.y,
      size: p.size,
      font: fontHelveticaBold,
      color: rgb(0.55, 0.60, 0.68),
    });
  });

  // 5. Corner Registration Targets (Hirondelles de repérage)
  const drawTarget = (x: number, y: number) => {
    const r = 4 * mmToPt;
    page.drawCircle({ x, y, size: r, borderColor: cDark, borderWidth: 0.8 });
    page.drawLine({ start: { x: x - r - 2, y }, end: { x: x + r + 2, y }, color: cDark, thickness: 0.8 });
    page.drawLine({ start: { x, y: y - r - 2 }, end: { x, y: y + r + 2 }, color: cDark, thickness: 0.8 });
  };

  drawTarget(22 * mmToPt, (297 - 35) * mmToPt);
  drawTarget((420 - 22) * mmToPt, (297 - 35) * mmToPt);
  drawTarget(22 * mmToPt, cartoucheY + cartoucheH + 8 * mmToPt);
  drawTarget((420 - 22) * mmToPt, cartoucheY + cartoucheH + 8 * mmToPt);

  return await pdfDoc.save();
}

/**
 * Triggers client-side download of the BAT PDF.
 */
export async function downloadBatPdf(
  projectName: string,
  template: PackagingTemplate,
  dimensions: BoxDimensions,
  material: MaterialOption
): Promise<void> {
  const pdfBytes = await generateBatPdf(projectName, template, dimensions, material);
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `BAT-${template.code.replace(/[^a-zA-Z0-9]/g, "_")}-${Date.now()}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
