/**
 * Print-ready PDF: page 1 = artwork with 3 mm bleed, crop marks, trim/bleed
 * boxes; page 2 = vector die-line (cut + crease) for the printer.
 */
import { PDFDocument, StandardFonts, cmyk, rgb, LineCapStyle, type PDFPage } from "pdf-lib";
import { loadDesignFonts, type PackagingDesign } from "@/lib/artwork/draw";
import { BLEED_MM, flatLayout, type FlatLayout, type Pt } from "./layout";
import { canvasToBlob, renderFlatArtwork } from "./artwork";
import type { PackagingShape } from "@/components/workspace/Modals";

const MM = 72 / 25.4;
const MARGIN = 18; // mm around the bleed box for crop marks and slug
const MAX_PX = 8000;

export interface PrintPdfResult {
  bytes: Uint8Array;
  dpi: number;
  layout: FlatLayout;
}

function drawPath(page: PDFPage, pts: Pt[], ox: number, oy: number, pageH: number, color: ReturnType<typeof cmyk>, width: number, dash?: number[]) {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    page.drawLine({
      start: { x: (ox + a[0]) * MM, y: pageH - (oy + a[1]) * MM },
      end: { x: (ox + b[0]) * MM, y: pageH - (oy + b[1]) * MM },
      thickness: width,
      color,
      dashArray: dash,
      lineCap: LineCapStyle.Round,
    });
  }
}

export async function generatePrintPdf(shape: PackagingShape, design: PackagingDesign, projectName: string): Promise<PrintPdfResult> {
  const layout = flatLayout({ model: shape.model ?? "box", lengthMm: shape.lengthMm, widthMm: shape.widthMm, heightMm: shape.heightMm });
  await loadDesignFonts(design);

  const bleedW = layout.width + BLEED_MM * 2;
  const bleedH = layout.height + BLEED_MM * 2;
  const pxPerMm = Math.min(300 / 25.4, MAX_PX / Math.max(bleedW, bleedH));
  const dpi = Math.round(pxPerMm * 25.4);
  const art = renderFlatArtwork(layout, design, pxPerMm);
  const big = art.width * art.height > 12_000_000;
  const blob = await canvasToBlob(art, big ? "image/jpeg" : "image/png", big ? 0.95 : undefined);
  const imgBytes = new Uint8Array(await blob.arrayBuffer());

  const pdf = await PDFDocument.create();
  pdf.setTitle(`${projectName} — fichier d'impression`);
  pdf.setAuthor("Edify");
  pdf.setCreator("Edify Packaging Studio");
  pdf.setSubject(`${shape.name} ${shape.dimensions}`);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const image = big ? await pdf.embedJpg(imgBytes) : await pdf.embedPng(imgBytes);

  const pageW = (bleedW + MARGIN * 2) * MM;
  const pageH = (bleedH + MARGIN * 2) * MM;
  const registration = cmyk(1, 1, 1, 1);
  const magenta = cmyk(0, 1, 0, 0);
  const cyan = cmyk(1, 0, 0, 0);

  // ── Page 1: artwork ──
  const p1 = pdf.addPage([pageW, pageH]);
  p1.drawImage(image, { x: MARGIN * MM, y: MARGIN * MM, width: bleedW * MM, height: bleedH * MM });
  const trimX = (MARGIN + BLEED_MM) * MM;
  const trimY = (MARGIN + BLEED_MM) * MM;
  p1.setBleedBox(MARGIN * MM, MARGIN * MM, bleedW * MM, bleedH * MM);
  p1.setTrimBox(trimX, trimY, layout.width * MM, layout.height * MM);

  // Crop marks at the trim box corners, outside the bleed.
  const corners: [number, number, number, number][] = [
    [trimX, trimY, -1, -1],
    [trimX + layout.width * MM, trimY, 1, -1],
    [trimX, trimY + layout.height * MM, -1, 1],
    [trimX + layout.width * MM, trimY + layout.height * MM, 1, 1],
  ];
  const off = (BLEED_MM + 2) * MM;
  const len = 8 * MM;
  for (const [x, y, sx, sy] of corners) {
    p1.drawLine({ start: { x: x + sx * off, y }, end: { x: x + sx * (off + len), y }, thickness: 0.25, color: registration });
    p1.drawLine({ start: { x, y: y + sy * off }, end: { x, y: y + sy * (off + len) }, thickness: 0.25, color: registration });
  }
  const slug = `${projectName} · ${shape.name} ${shape.dimensions} · ${layout.kindLabel} · fonds perdus ${BLEED_MM} mm · ${dpi} dpi · RVB (conversion CMJN FOGRA39 par l'imprimeur)`;
  p1.drawText(slug, { x: MARGIN * MM, y: 6 * MM, size: 6.5, font, color: rgb(0.25, 0.27, 0.3), maxWidth: pageW - MARGIN * 2 * MM });

  // ── Page 2: die-line ──
  const p2 = pdf.addPage([pageW, pageH]);
  p2.drawImage(image, { x: MARGIN * MM, y: MARGIN * MM, width: bleedW * MM, height: bleedH * MM, opacity: 0.18 });
  const ox = MARGIN + BLEED_MM;
  const oy = MARGIN + BLEED_MM;
  drawPath(p2, layout.cut, ox, oy, pageH, magenta, 0.75);
  for (const [a, b] of layout.creases) {
    p2.drawLine({
      start: { x: (ox + a[0]) * MM, y: pageH - (oy + a[1]) * MM },
      end: { x: (ox + b[0]) * MM, y: pageH - (oy + b[1]) * MM },
      thickness: 0.6, color: cyan, dashArray: [4, 3],
    });
  }
  p2.drawText("TRACÉ DE DÉCOUPE — ne pas imprimer", { x: MARGIN * MM, y: pageH - 10 * MM, size: 9, font: bold, color: rgb(0.1, 0.1, 0.12) });
  p2.drawText(`Magenta : découpe   ·   Cyan pointillé : rainage/pli   ·   Format à plat : ${layout.width.toFixed(1)} × ${layout.height.toFixed(1)} mm`, {
    x: MARGIN * MM, y: 6 * MM, size: 7, font, color: rgb(0.25, 0.27, 0.3),
  });

  return { bytes: await pdf.save(), dpi, layout };
}

export async function downloadPrintPdf(shape: PackagingShape, design: PackagingDesign, projectName: string) {
  const res = await generatePrintPdf(shape, design, projectName);
  const blob = new Blob([res.bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(projectName) || shape.id}-impression.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return res;
}

export function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
