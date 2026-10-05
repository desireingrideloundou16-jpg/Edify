/**
 * Minimal 2D context for the node test environment (no canvas): keeps the transform stack and the
 * font, measures text as 0.55 em per character, and logs every fillText / drawImage / fillRect with
 * the device position of its anchor. Every other call is a no-op (gradients return a stub).
 */
type Mat = [number, number, number, number, number, number];
const mul = ([a, b, c, d, e, f]: Mat, [A, B, C, D, E, F]: Mat): Mat => [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f];

export interface DrawCall { op: string; text?: string; x: number; y: number }

export function mockContext() {
  let m: Mat = [1, 0, 0, 1, 0, 0];
  const stack: { m: Mat; font: string }[] = [];
  const calls: DrawCall[] = [];
  const state: Record<string, unknown> = { font: "10px Arial", globalAlpha: 1, textAlign: "start", textBaseline: "alphabetic" };
  const dev = (x: number, y: number) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
  const size = () => Number(/(\d+(?:\.\d+)?)px/.exec(String(state.font))?.[1] ?? 10);
  const impl: Record<string, (...a: never[]) => unknown> = {
    save: () => stack.push({ m: [...m] as Mat, font: String(state.font) }),
    restore: () => { const s = stack.pop(); if (s) { m = s.m; state.font = s.font; } },
    getTransform: () => ({ a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] }),
    setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => { m = [a, b, c, d, e, f]; },
    resetTransform: () => { m = [1, 0, 0, 1, 0, 0]; },
    translate: (x: number, y: number) => { m = mul(m, [1, 0, 0, 1, x, y]); },
    scale: (x: number, y: number) => { m = mul(m, [x, 0, 0, y, 0, 0]); },
    rotate: (r: number) => { m = mul(m, [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]); },
    measureText: (s: string) => ({ width: [...s].length * size() * 0.55 }),
    fillText: (s: string, x: number, y: number) => calls.push({ op: "fillText", text: s, ...dev(x, y) }),
    drawImage: (_i: unknown, x: number, y: number) => calls.push({ op: "drawImage", ...dev(x, y) }),
    fillRect: (x: number, y: number) => calls.push({ op: "fillRect", ...dev(x, y) }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => ({}),
    createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: () => {},
  };
  const ctx = new Proxy(state, {
    get: (t, k: string) => (k in impl ? impl[k] : k in t ? t[k] : () => {}),
    set: (t, k: string, v) => { t[k] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}
