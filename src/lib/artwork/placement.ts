/**
 * Artwork elements of a wrap, seen by the smart layout (phase 2C-4F-3). The artwork stays procedural
 * (draw.ts, compose.ts): its primitives (text lines, logo, seal, back-panel blocks, barcode) declare
 * each element they draw through `placeElement`. Outside a session this is a plain call: the drawing
 * is unchanged, call for call. Inside a session opened by drawWrap on a canvas context:
 *
 * - "record": the element's box (its own drawing extent, in fractions of the wrap frame) is noted;
 * - "apply": the element is drawn translated by its planned offset — same size, font, colours and
 *   rotation; only its position changes. The clip of the printed outline (drawSurface) is not moved.
 *
 * Roles are given by the caller (phase 3A: never guessed from the drawn text). Ids are the role and its
 * rank in drawing order ("netContent#1"): the drawing order of a design is
 * fixed, so a record and an apply of the same design give the same ids.
 */
import type { ElementRole } from "@/lib/structure";
import type { PackagingDesign } from "./draw";

/** Offsets of the moved elements, in fractions of the wrap frame (one logical position for preview, 3D and PDF). */
export interface WrapPlacement {
  /** Frame width / height the plan was made for: never applied to another wrap. */
  aspect: number;
  offsets: Record<string, [number, number]>;
}

/** An element as recorded: its box in fractions of the wrap frame (x right, y down). */
export interface RecordedElement {
  id: string;
  role: ElementRole;
  box: { x: number; y: number; w: number; h: number };
  /** Linked element (phase 2C-4F-4): this one follows its parent's movement, never moves on its own. */
  parentId?: string;
}

type Mat = [number, number, number, number, number, number];

interface Session {
  mode: "record" | "apply";
  frame: { x: number; y: number; w: number; h: number };
  design: PackagingDesign;
  base: Mat;
  inv: Mat;
  counts: Map<ElementRole, number>;
  records: RecordedElement[];
  offsets: Record<string, [number, number]>;
}

const sessions = new WeakMap<object, Session>();

/** A plan is applied only to a frame of the same proportions (2 %: texture sizes are rounded to pixels). */
export const ASPECT_TOLERANCE = 0.02;

const matOf = (ctx: CanvasRenderingContext2D): Mat => {
  const m = ctx.getTransform();
  return [m.a, m.b, m.c, m.d, m.e, m.f];
};

function invert([a, b, c, d, e, f]: Mat): Mat {
  const det = a * d - b * c;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

const apply = ([a, b, c, d, e, f]: Mat, x: number, y: number): [number, number] => [a * x + c * y + e, b * x + d * y + f];

/**
 * Run `draw` (the wrap's drawing) inside a session on `ctx`. Returns the recorded elements (empty
 * in "apply" mode). Synchronous: the session lives exactly as long as the drawing.
 */
export function withPlacementSession(
  ctx: CanvasRenderingContext2D,
  s: { mode: "record" | "apply"; frame: { x: number; y: number; w: number; h: number }; design: PackagingDesign; offsets?: Record<string, [number, number]> },
  draw: () => void
): RecordedElement[] {
  const base = matOf(ctx);
  const session: Session = { mode: s.mode, frame: s.frame, design: s.design, base, inv: invert(base), counts: new Map(), records: [], offsets: s.offsets ?? {} };
  sessions.set(ctx, session);
  try {
    draw();
  } finally {
    sessions.delete(ctx);
  }
  return session.records;
}

/**
 * Declare one element drawn by `draw`. `box` (lazy: only computed inside a session) is its extent in
 * the context's CURRENT coordinates [x, y, w, h]; it is carried to the wrap frame through the current
 * transform (rotated elements: their axis-aligned extent).
 */
export function placeElement(ctx: CanvasRenderingContext2D, role: ElementRole, box: () => [number, number, number, number] | null, draw: () => void, parentId?: string) {
  const s = sessions.get(ctx);
  if (!s) {
    draw();
    return;
  }
  const n = s.counts.get(role) ?? 0;
  s.counts.set(role, n + 1);
  const id = `${role}#${n}`;
  if (s.mode === "record") {
    const b = box();
    if (b && b[2] > 0 && b[3] > 0) {
      const m = matOf(ctx);
      const pts = [[b[0], b[1]], [b[0] + b[2], b[1]], [b[0] + b[2], b[1] + b[3]], [b[0], b[1] + b[3]]].map(([x, y]) => {
        const [dx, dy] = apply(m, x, y);
        const [fx, fy] = apply(s.inv, dx, dy);
        return [(fx - s.frame.x) / s.frame.w, (fy - s.frame.y) / s.frame.h];
      });
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const x0 = Math.min(...xs), y0 = Math.min(...ys);
      s.records.push({ id, role, box: { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 }, ...(parentId ? { parentId } : {}) });
    }
    draw();
    return;
  }
  const off = s.offsets[id];
  if (!off) {
    draw();
    return;
  }
  // Frame offset → device vector (linear part of the base transform) → prepended to the current transform.
  const [a, b, c, d] = s.base;
  const vx = off[0] * s.frame.w, vy = off[1] * s.frame.h;
  const tx = a * vx + c * vy, ty = b * vx + d * vy;
  const m = matOf(ctx);
  ctx.save();
  ctx.setTransform(m[0], m[1], m[2], m[3], m[4] + tx, m[5] + ty);
  draw();
  ctx.restore();
}

/**
 * Id the NEXT element of `role` will get (a parent drawn after its linked decoration), or the id of
 * the LAST one (`last`: a decoration drawn after its parent). Undefined outside a session.
 */
export function elementId(ctx: CanvasRenderingContext2D, role: ElementRole, which: "next" | "last"): string | undefined {
  const s = sessions.get(ctx);
  if (!s) return undefined;
  const n = s.counts.get(role) ?? 0;
  if (which === "last") return n ? `${role}#${n - 1}` : undefined;
  return `${role}#${n}`;
}

/** Is a placement session open on this context (the wrap is being recorded or placed)? */
export const inPlacementSession = (ctx: CanvasRenderingContext2D) => sessions.has(ctx);

/**
 * Drawing extent [x, y, w, h] of a single text line drawn by fillText(s, x, y, maxW?) with the
 * context's current font: measured width (capped by maxW, which fillText enforces), one font size high.
 */
export function textBox(
  ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number,
  align: CanvasTextAlign, baseline: "middle" | "top", maxW?: number
): [number, number, number, number] {
  const w = Math.min(ctx.measureText(s).width, maxW ?? Infinity);
  const left = align === "center" ? x - w / 2 : align === "right" || align === "end" ? x - w : x;
  return [left, baseline === "middle" ? y - size / 2 : y, w, size];
}
