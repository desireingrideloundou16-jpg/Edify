/**
 * Identity of a design for the 3D (phase 3C). Pure: no DOM access beyond reading `src`.
 *
 * - The 3D views receive the APPLIED design (the studio's fullDesign: content, style, logo, illustration,
 *   applied layout) — the very object the 2D and the PDF draw — never a reduced copy.
 * - An image's identity is a fingerprint of its source (URL or data URL), never the DOM object:
 *   JSON.stringify(HTMLImageElement) is "{}", so two different illustrations looked identical.
 */
import type { PackagingDesign } from "@/lib/artwork/draw";

/** 32-bit FNV-1a, hex. */
function fnv1a(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Stable identity of an image from its source ("" when absent). */
export function imageIdentity(img: { src?: string } | null | undefined): string {
  const src = img?.src ?? "";
  return src ? `${src.length}:${fnv1a(src)}` : "";
}

/**
 * Cache key of a design for 3D renders: every serialisable field, plus the identity of the logo and
 * of the illustration (two different images never share a key, the same image always does).
 */
export function designIdentityKey(design: PackagingDesign): string {
  const { logo, art, ...rest } = design;
  return `${JSON.stringify(rest)}|logo:${imageIdentity(logo)}|art:${imageIdentity(art)}`;
}

/**
 * The design a 3D view builds from: the applied design as it is (illustration, applied layout…), with
 * its own logo; a logo loaded separately by the view is only a fallback while the design has none.
 */
export function viewerDesign(design: PackagingDesign, loadedLogo: HTMLImageElement | null): PackagingDesign {
  return design.logo ? design : { ...design, logo: loadedLogo };
}
