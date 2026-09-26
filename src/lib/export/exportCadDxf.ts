import { PackagingTemplate, BoxDimensions } from "@/types/packaging";

/**
 * Generates an AutoCAD DXF (R12 ASCII) string compliant with Kongsberg, Zünd, and ESKO cutting tables.
 * Contains:
 * - Table layer 'CUT' with ACI color 6 (Magenta)
 * - Table layer 'CREASE' with ACI color 4 (Cyan)
 * - Line entities with exact millimeter coordinates
 */
export function generateCadDxf(
  _template: PackagingTemplate,
  dimensions: BoxDimensions
): string {
  const { length: L, width: W, height: H, glueFlap: G, tuckFlap: T } = dimensions;

  const lines: { layer: "CUT" | "CREASE"; x1: number; y1: number; x2: number; y2: number }[] = [];

  const originX = 0;
  const originY = W + T;

  const pGlueX = originX;
  const pBackX = originX + G;
  const pLeftX = originX + G + L;
  const pFrontX = originX + G + L + W;
  const pRightX = originX + G + L + W + L;

  // Crease fold lines
  lines.push({ layer: "CREASE", x1: pBackX, y1: originY, x2: pBackX, y2: originY + H });
  lines.push({ layer: "CREASE", x1: pLeftX, y1: originY, x2: pLeftX, y2: originY + H });
  lines.push({ layer: "CREASE", x1: pFrontX, y1: originY, x2: pFrontX, y2: originY + H });
  lines.push({ layer: "CREASE", x1: pRightX, y1: originY, x2: pRightX, y2: originY + H });

  lines.push({ layer: "CREASE", x1: pBackX, y1: originY, x2: pRightX + W, y2: originY });
  lines.push({ layer: "CREASE", x1: pBackX, y1: originY + H, x2: pRightX + W, y2: originY + H });
  lines.push({ layer: "CREASE", x1: pFrontX, y1: originY - W, x2: pFrontX + L, y2: originY - W });
  lines.push({ layer: "CREASE", x1: pBackX, y1: originY + H + W, x2: pBackX + L, y2: originY + H + W });

  // Cut contour lines
  lines.push({ layer: "CUT", x1: pGlueX, y1: originY + 2, x2: pGlueX, y2: originY + H - 2 });
  lines.push({ layer: "CUT", x1: pGlueX, y1: originY + 2, x2: pBackX, y2: originY });
  lines.push({ layer: "CUT", x1: pGlueX, y1: originY + H - 2, x2: pBackX, y2: originY + H });

  // Top Flaps
  lines.push({ layer: "CUT", x1: pLeftX, y1: originY, x2: pLeftX, y2: originY - (W * 0.75) });
  lines.push({ layer: "CUT", x1: pLeftX, y1: originY - (W * 0.75), x2: pLeftX + W, y2: originY - (W * 0.75) });
  lines.push({ layer: "CUT", x1: pLeftX + W, y1: originY - (W * 0.75), x2: pLeftX + W, y2: originY });

  lines.push({ layer: "CUT", x1: pFrontX, y1: originY, x2: pFrontX, y2: originY - W });
  lines.push({ layer: "CUT", x1: pFrontX, y1: originY - W, x2: pFrontX + (L * 0.1), y2: originY - W - T });
  lines.push({ layer: "CUT", x1: pFrontX + (L * 0.1), y1: originY - W - T, x2: pFrontX + (L * 0.9), y2: originY - W - T });
  lines.push({ layer: "CUT", x1: pFrontX + (L * 0.9), y1: originY - W - T, x2: pFrontX + L, y2: originY - W });
  lines.push({ layer: "CUT", x1: pFrontX + L, y1: originY - W, x2: pFrontX + L, y2: originY });

  lines.push({ layer: "CUT", x1: pRightX, y1: originY, x2: pRightX, y2: originY - (W * 0.75) });
  lines.push({ layer: "CUT", x1: pRightX, y1: originY - (W * 0.75), x2: pRightX + W, y2: originY - (W * 0.75) });
  lines.push({ layer: "CUT", x1: pRightX + W, y1: originY - (W * 0.75), x2: pRightX + W, y2: originY });

  // Right Edge
  lines.push({ layer: "CUT", x1: pRightX + W, y1: originY, x2: pRightX + W, y2: originY + H });

  // Bottom Flaps
  lines.push({ layer: "CUT", x1: pRightX + W, y1: originY + H, x2: pRightX + W, y2: originY + H + (W * 0.75) });
  lines.push({ layer: "CUT", x1: pRightX + W, y1: originY + H + (W * 0.75), x2: pRightX, y2: originY + H + (W * 0.75) });
  lines.push({ layer: "CUT", x1: pRightX, y1: originY + H + (W * 0.75), x2: pRightX, y2: originY + H });

  lines.push({ layer: "CUT", x1: pLeftX + W, y1: originY + H, x2: pLeftX + W, y2: originY + H + (W * 0.75) });
  lines.push({ layer: "CUT", x1: pLeftX + W, y1: originY + H + (W * 0.75), x2: pLeftX, y2: originY + H + (W * 0.75) });
  lines.push({ layer: "CUT", x1: pLeftX, y1: originY + H + (W * 0.75), x2: pLeftX, y2: originY + H });

  lines.push({ layer: "CUT", x1: pBackX, y1: originY + H, x2: pBackX, y2: originY + H + W });
  lines.push({ layer: "CUT", x1: pBackX, y1: originY + H + W, x2: pBackX + (L * 0.1), y2: originY + H + W + T });
  lines.push({ layer: "CUT", x1: pBackX + (L * 0.1), y1: originY + H + W + T, x2: pBackX + (L * 0.9), y2: originY + H + W + T });
  lines.push({ layer: "CUT", x1: pBackX + (L * 0.9), y1: originY + H + W + T, x2: pBackX + L, y2: originY + H + W });
  lines.push({ layer: "CUT", x1: pBackX + L, y1: originY + H + W, x2: pBackX + L, y2: originY + H });

  // DXF Builder
  let dxf = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1009
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LAYER
70
2
0
LAYER
2
CUT
70
64
62
6
6
CONTINUOUS
0
LAYER
2
CREASE
70
64
62
4
6
DASHED
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
`;

  lines.forEach((l) => {
    dxf += `0
LINE
8
${l.layer}
10
${l.x1.toFixed(3)}
20
${l.y1.toFixed(3)}
30
0.0
11
${l.x2.toFixed(3)}
21
${l.y2.toFixed(3)}
31
0.0
`;
  });

  dxf += `0
ENDSEC
0
EOF
`;

  return dxf;
}

export function downloadCadDxf(
  template: PackagingTemplate,
  dimensions: BoxDimensions
): void {
  const dxfText = generateCadDxf(template, dimensions);
  const blob = new Blob([dxfText], { type: "application/dxf;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dieline-${template.code.replace(/[^a-zA-Z0-9]/g, "_")}-${Date.now()}.dxf`;
  a.click();
  URL.revokeObjectURL(url);
}
