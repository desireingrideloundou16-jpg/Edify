/**
 * Parametric Pouch & Doypack Geometry Generator for Edify.
 * Generates realistic flexible film packaging envelopes with:
 * - Asymmetric gravity bulge (internal volume)
 * - Pinched thermo-sealed crimp seals (top & bottom)
 * - Corner tension folds radiating from seal junctions
 * - Lateral edge creasing
 * - Bottom gusset with inverted-W fold (for Doypack)
 * - Seamless UV mapping compatible with Edify's drawWrap artwork
 */
import * as THREE from "three";
import { pouchSeals } from "@/lib/structure/profile/flexibleProfile";

export type PouchType = "flatpouch" | "pouch" | "doypack" | "sachet";

export interface PouchGeometryConfig {
  /** Width in mm (along X) */
  width: number;
  /** Height in mm (along Y) */
  height: number;
  /** Nominal depth in mm (along Z) */
  depth: number;
  /** Packaging type */
  type: PouchType;
  /** Height of top heat-seal in mm (default ~15mm) */
  topSealHeight?: number;
  /** Height of bottom heat-seal in mm (default ~14mm for flatpouch) */
  bottomSealHeight?: number;
  /** Pitch of crimped ridges in mm (default 3.0mm) */
  crimpPeriod?: number;
  /** Depth of crimp ridges in mm (default 0.35mm) */
  crimpDepth?: number;
  /** Relative height of maximum bulge [0..1] (default 0.38) */
  bulgePosition?: number;
  /** Bulge scale multiplier (default 1.0) */
  bulgeStrength?: number;
  /** Lateral crease intensity (default 0.6) */
  sideCreaseStrength?: number;
  /** Micro-wrinkle intensity (default 0.25) */
  wrinkleStrength?: number;
  /** Deterministic seed for reproducible folds */
  seed?: number;
  /** Horizontal perimeter subdivisions (default 48) */
  resolutionX?: number;
  /** Vertical subdivisions (default 56) */
  resolutionY?: number;
}

/**
 * Deterministic pseudo-random float generator based on seed.
 */
function pseudoRandom(seed: number, index: number): number {
  const x = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Smoothstep interpolation function.
 */
function smoothstep(min: number, max: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

/**
 * Builds a realistic flexible pouch geometry (flatpouch or doypack).
 */
export function createPouchGeometry(config: PouchGeometryConfig): THREE.BufferGeometry {
  const {
    width: L,
    height: H,
    depth: W,
    type,
    topSealHeight = pouchSeals(type, H).top,
    bottomSealHeight = pouchSeals(type, H).bottom,
    crimpPeriod = 3.2,
    crimpDepth = 0.32,
    bulgePosition = (type === "doypack" || type === "pouch") ? 0.22 : 0.38,
    bulgeStrength = 1.0,
    sideCreaseStrength = 0.5,
    wrinkleStrength = 0.25,
    seed = 42,
    resolutionX = 48,
    resolutionY = 56,
  } = config;

  const isDoypack = type === "doypack" || type === "pouch";
  const halfW = (W / 2) * bulgeStrength;
  const halfL = L / 2;

  // Vertical subdivision counts
  const ny = Math.max(24, resolutionY);
  const nx = Math.ceil(Math.max(24, resolutionX) / 4) * 4; // panels split at s = 0.25 / 0.75

  // Normalized heights
  const hTopSeal = topSealHeight / H;
  const hBottomSeal = bottomSealHeight / H;
  const hTopTrans = hTopSeal + 0.06;
  const hBottomTrans = isDoypack ? 0.25 : hBottomSeal + 0.08;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Generate grid vertices: i vertical (0..ny), j perimeter (0..nx)
  // Perimeter parameter s in [0..1]:
  // s = 0.00: Back center (x = 0, z < 0)
  // s = 0.25: Left edge   (x = -halfL, z = 0)
  // s = 0.50: Front center(x = 0, z > 0)
  // s = 0.75: Right edge  (x = +halfL, z = 0)
  // s = 1.00: Back center (x = 0, z < 0)

  for (let i = 0; i <= ny; i++) {
    const t = i / ny; // normalized height [0..1]
    const y = t * H;

    // Calculate depth expansion factor D(t) along Y
    let depthFactor = 0;
    let isTopSeal = false;
    let isBottomSeal = false;

    if (t >= 1 - hTopSeal) {
      // In top heat seal zone
      depthFactor = 0;
      isTopSeal = true;
    } else if (!isDoypack && t <= hBottomSeal) {
      // In bottom heat seal zone (flatpouch only)
      depthFactor = 0;
      isBottomSeal = true;
    } else if (isDoypack) {
      // Doypack depth curve: wide at base (gusset), gently tapering towards top seal
      if (t < hBottomTrans) {
        // Base gusset region: full expansion
        const bt = t / hBottomTrans;
        depthFactor = 1.0 - 0.12 * smoothstep(0, 1, bt);
      } else {
        // Body region: tapering up to flat seal
        const bodyT = (t - hBottomTrans) / (1 - hTopSeal - hBottomTrans);
        depthFactor = (1.0 - smoothstep(0, 1, bodyT)) * 0.88;
      }
    } else {
      // Flatpouch / pillow pack: asymmetric gravity volume
      const bodyT = (t - hBottomSeal) / (1 - hTopSeal - hBottomSeal);
      // Asymmetric sine envelope centered near bulgePosition
      const rawSine = Math.sin(Math.PI * Math.max(0, Math.min(1, bodyT)));
      const asymmetry = 1.0 + 0.35 * (bulgePosition - 0.5) * (1.0 - 2.0 * bodyT);
      depthFactor = Math.pow(rawSine, 0.72) * Math.max(0.1, asymmetry);
    }

    // Corner tension multiplier (pulls corners inward where seal meets body)
    let cornerTension = 1.0;
    if (t > 1 - hTopTrans && t < 1 - hTopSeal) {
      const transT = (t - (1 - hTopTrans)) / (hTopTrans - hTopSeal);
      cornerTension = 1.0 - 0.45 * smoothstep(0, 1, transT);
    } else if (!isDoypack && t > hBottomSeal && t < hBottomTrans) {
      const transT = 1.0 - (t - hBottomSeal) / (hBottomTrans - hBottomSeal);
      cornerTension = 1.0 - 0.45 * smoothstep(0, 1, transT);
    }

    for (let j = 0; j <= nx; j++) {
      const s = j / nx; // perimeter parameter [0..1]

      // Map perimeter parameter s to (x, z)
      let normX = 0;
      let signZ = 1;

      if (s <= 0.25) {
        // Back left: x goes from 0 to -1, z is negative
        normX = -s * 4;
        signZ = -1;
      } else if (s <= 0.5) {
        // Front left: x goes from -1 to 0, z is positive
        normX = -(0.5 - s) * 4;
        signZ = 1;
      } else if (s <= 0.75) {
        // Front right: x goes from 0 to +1, z is positive
        normX = (s - 0.5) * 4;
        signZ = 1;
      } else {
        // Back right: x goes from +1 to 0, z is negative
        normX = (1.0 - s) * 4;
        signZ = -1;
      }

      // Base X coordinate with subtle pinch at seals
      let x = normX * halfL;
      if (isTopSeal || isBottomSeal) {
        // Keep seals straight across width
        x = normX * halfL * 0.995;
      } else {
        // Slight organic curve across width (tension pulls sides slightly inward)
        const sideTuck = sideCreaseStrength * (1.0 - Math.abs(normX)) * Math.sin(Math.PI * t) * 0.04;
        x *= 1.0 - sideTuck;
      }

      // Lens/cushion profile across width: full at center (normX=0), zero at edges (normX=±1)
      const lensProfile = Math.pow(Math.max(0, 1.0 - normX * normX), 0.72);
      let z = signZ * halfW * depthFactor * lensProfile * cornerTension;

      // Crimp ridges on top and bottom seals
      if (isTopSeal || isBottomSeal) {
        const crimpWave = Math.sin((x / crimpPeriod) * Math.PI * 2);
        // Crimping creates alternating ridges facing front and back
        z = crimpWave * crimpDepth;
      } else {
        // Real packaging wrinkles and diagonal tension folds
        // 1. Diagonal corner folds radiating from seal junctions
        const cornerDistTop = Math.abs(normX) * (1.0 - t);
        const cornerDistBot = Math.abs(normX) * t;
        const cornerFoldTop = Math.sin(cornerDistTop * Math.PI * 5) * Math.exp(-cornerDistTop * 3.5);
        const cornerFoldBot = Math.sin(cornerDistBot * Math.PI * 5) * Math.exp(-cornerDistBot * 3.5);

        // 2. Subtle deterministic film ripples
        const r1 = Math.sin(t * 14.0 + normX * 8.0 + pseudoRandom(seed, 1) * 6.28);
        const r2 = Math.cos(t * 9.0 - normX * 11.0 + pseudoRandom(seed, 2) * 6.28);
        const subtleWrinkle = (r1 * 0.6 + r2 * 0.4) * wrinkleStrength * (1.0 - Math.abs(normX)) * 0.8;

        z += signZ * (cornerFoldTop * 0.6 + cornerFoldBot * 0.4 + subtleWrinkle);
      }

      // Bottom gusset handling for Doypack
      if (isDoypack && t < 0.14) {
        // In the bottom-most region, create the inward-folding W bottom
        const gussetFactor = (0.14 - t) / 0.14;
        const innerGusset = (1.0 - Math.abs(normX)) * halfW * 0.85 * gussetFactor;
        // Inward fold pulls bottom center up
        if (Math.abs(normX) < 0.85) {
          z = signZ * (Math.abs(z) - innerGusset * 0.5);
        }
      }

      positions.push(x, y, z);
      // UV matching Edify's drawWrap: U runs [0..1] around perimeter, V runs [0..1] vertically
      uvs.push(s, t);

      // Initial placeholder normal (computed cleanly afterward)
      normals.push(0, 0, signZ);
    }
  }

  // Create quad indices
  for (let i = 0; i < ny; i++) {
    for (let j = 0; j < nx; j++) {
      const a = i * (nx + 1) + j;
      const b = (i + 1) * (nx + 1) + j;
      const c = (i + 1) * (nx + 1) + (j + 1);
      const d = i * (nx + 1) + (j + 1);

      // Two triangles per quad, wound so the faces point outward (s runs back → left → front → right)
      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  // Compute normals with proper hard-edge weighting for crimped seals
  geometry.computeVertexNormals();

  // Fine-tune normals on seals to face directly forward (+Z) and backward (-Z)
  // so the crimping ridges reflect crisp directional highlights
  const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
  const normAttr = geometry.getAttribute("normal") as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i <= ny; i++) {
    const t = i / ny;
    const isSeal = t >= 1 - hTopSeal || (!isDoypack && t <= hBottomSeal);

    if (isSeal) {
      for (let j = 0; j <= nx; j++) {
        const idx = i * (nx + 1) + j;
        v.fromBufferAttribute(posAttr, idx);
        n.fromBufferAttribute(normAttr, idx);

        const s = j / nx;
        const signZ = s > 0.25 && s < 0.75 ? 1 : -1;

        // Enhance Z component on seals while preserving X crimp ripples
        n.z = signZ * 0.92;
        n.normalize();
        normAttr.setXYZ(idx, n.x, n.y, n.z);
      }
    }
  }
  normAttr.needsUpdate = true;

  // Print panels (phase 2C-3): front = s ∈ [0.25, 0.75], back = s ∈ [0.75, 1] ∪ [0, 0.25] as ONE
  // panel (no seam through its artwork). Same triangles, positions and normals as the closed grid.
  const body = splitPanels(geometry, nx, ny);
  geometry.dispose();

  // If doypack, add the bottom closing gusset plate (group 2)
  if (isDoypack) {
    const bottomGusset = createDoypackGussetPlate(L, W, halfW, resolutionX);
    const merged = mergeGeometries([body.geometry, bottomGusset]);
    merged.addGroup(0, body.frontCount, 0);
    merged.addGroup(body.frontCount, body.backCount, 1);
    merged.addGroup(body.frontCount + body.backCount, bottomGusset.getIndex()!.count, 2);
    body.geometry.dispose();
    return merged;
  }

  body.geometry.addGroup(0, body.frontCount, 0);
  body.geometry.addGroup(body.frontCount, body.backCount, 1);
  return body.geometry;
}

/**
 * Rebuilds the closed (ny+1) × (nx+1) grid as two print panels. UVs follow the real film: on each
 * row, u is the arc length across the panel divided by the panel's arc length on that row, so the
 * printed sheet spreads evenly over the bulged surface; v stays the height fraction.
 * Group order: front quads, then back quads.
 */
function splitPanels(grid: THREE.BufferGeometry, nx: number, ny: number) {
  const pos = grid.getAttribute("position") as THREE.BufferAttribute;
  const nrm = grid.getAttribute("normal") as THREE.BufferAttribute;
  const uvSrc = grid.getAttribute("uv") as THREE.BufferAttribute;
  const q = nx / 4;
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
  // Column strips; the back is two strips that meet at the back centre (column nx ≡ column 0).
  const front = [range(q, 3 * q)];
  const back = [range(3 * q, nx), range(0, q)];

  const P: number[] = [], N: number[] = [], U: number[] = [], I: number[] = [];
  const at = (i: number, j: number) => i * (nx + 1) + j;
  const emitPanel = (strips: number[][]) => {
    const start = I.length;
    // u per row along the whole panel (strips chained), arc length normalised to [0, 1].
    const cols = strips.flat();
    const uRows: number[][] = [];
    for (let i = 0; i <= ny; i++) {
      const cum = [0];
      for (let k = 1; k < cols.length; k++) {
        const a = at(i, cols[k - 1]), b = at(i, cols[k]);
        cum.push(cum[k - 1] + Math.hypot(pos.getX(b) - pos.getX(a), pos.getY(b) - pos.getY(a), pos.getZ(b) - pos.getZ(a)));
      }
      const total = cum[cum.length - 1] || 1;
      uRows.push(cum.map((c) => c / total));
    }
    let offset = 0;
    for (const strip of strips) {
      const base = P.length / 3;
      const w = strip.length;
      for (let i = 0; i <= ny; i++) {
        for (let k = 0; k < w; k++) {
          const v = at(i, strip[k]);
          P.push(pos.getX(v), pos.getY(v), pos.getZ(v));
          N.push(nrm.getX(v), nrm.getY(v), nrm.getZ(v));
          U.push(uRows[i][offset + k], uvSrc.getY(v));
        }
      }
      for (let i = 0; i < ny; i++) {
        for (let k = 0; k < w - 1; k++) {
          const a = base + i * w + k, d = a + 1, b = a + w, c = b + 1;
          I.push(a, d, b, b, d, c); // same winding as the closed grid (outward)
        }
      }
      offset += w;
    }
    return I.length - start;
  };
  const frontCount = emitPanel(front);
  const backCount = emitPanel(back);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  geometry.setIndex(I);
  return { geometry, frontCount, backCount };
}

/**
 * Creates the bottom gusset closure plate for a Doypack with realistic inward-folded W profile.
 */
function createDoypackGussetPlate(L: number, W: number, halfW: number, segments = 32): THREE.BufferGeometry {
  const halfL = L / 2;
  const gussetHeight = W * 0.38; // upward apex of the W fold

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const nRadial = 8;
  const nAngular = segments;

  for (let r = 0; r <= nRadial; r++) {
    const tr = r / nRadial; // 0 at outer rim, 1 at central crease
    for (let a = 0; a <= nAngular; a++) {
      const ta = (a / nAngular) * Math.PI * 2;
      const cosA = Math.cos(ta);
      const sinA = Math.sin(ta);

      // Elliptical footprint
      const x = cosA * halfL * (1.0 - tr * 0.1);
      const z = sinA * halfW * (1.0 - tr);
      // Upward fold profile: peak height along central axis z=0
      const y = Math.sin(tr * Math.PI * 0.5) * gussetHeight * (1.0 - Math.pow(x / halfL, 2) * 0.6);

      positions.push(x, Math.max(0.1, y), z);
      normals.push(0, -1, 0); // Facing downward
      uvs.push(0.5 + cosA * 0.4, 0.5 + sinA * 0.4);
    }
  }

  for (let r = 0; r < nRadial; r++) {
    for (let a = 0; a < nAngular; a++) {
      const idx1 = r * (nAngular + 1) + a;
      const idx2 = (r + 1) * (nAngular + 1) + a;
      const idx3 = (r + 1) * (nAngular + 1) + (a + 1);
      const idx4 = r * (nAngular + 1) + (a + 1);

      indices.push(idx1, idx3, idx2);
      indices.push(idx1, idx4, idx3);
    }
  }

  const gussetGeo = new THREE.BufferGeometry();
  gussetGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  gussetGeo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  gussetGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  gussetGeo.setIndex(indices);
  gussetGeo.computeVertexNormals();

  return gussetGeo;
}

/**
 * Clean BufferGeometry merger without external dependencies.
 */
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalPos = 0;
  let totalNorm = 0;
  let totalUv = 0;
  let totalIndices = 0;

  for (const g of geometries) {
    totalPos += g.getAttribute("position").count * 3;
    totalNorm += (g.getAttribute("normal")?.count ?? 0) * 3;
    totalUv += (g.getAttribute("uv")?.count ?? 0) * 2;
    totalIndices += g.getIndex()?.count ?? 0;
  }

  const mergedPos = new Float32Array(totalPos);
  const mergedNorm = new Float32Array(totalNorm);
  const mergedUv = new Float32Array(totalUv);
  const mergedIndices = new Uint32Array(totalIndices);

  let posOffset = 0;
  let normOffset = 0;
  let uvOffset = 0;
  let indexOffset = 0;
  let vertexOffset = 0;

  for (const g of geometries) {
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    const norm = g.getAttribute("normal") as THREE.BufferAttribute;
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    const idx = g.getIndex();

    mergedPos.set(pos.array, posOffset);
    posOffset += pos.array.length;

    if (norm) {
      mergedNorm.set(norm.array, normOffset);
      normOffset += norm.array.length;
    }

    if (uv) {
      mergedUv.set(uv.array, uvOffset);
      uvOffset += uv.array.length;
    }

    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        mergedIndices[indexOffset + i] = idx.getX(i) + vertexOffset;
      }
      indexOffset += idx.count;
    }

    vertexOffset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(mergedPos, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(mergedNorm, 3));
  merged.setAttribute("uv", new THREE.BufferAttribute(mergedUv, 2));
  merged.setIndex(new THREE.BufferAttribute(mergedIndices, 1));

  return merged;
}
