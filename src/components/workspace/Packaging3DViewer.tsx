"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { buildPackaging, disposeObject, PackagingDesign, PackagingSpec } from "@/lib/three/packagingModels";
import { loadDesignFonts } from "@/lib/artwork/draw";
import { viewerDesign } from "@/lib/three/designKey";
import { chooseQuality, frameShot, resolveCamera, resolveLighting, type CameraPresetId, type LightingPresetId, type RenderQualityConfig } from "@/lib/three/scenePresets";
import { detectGraphicsCaps } from "@/lib/three/capabilities";
import { StudioRig } from "@/lib/three/studioRig";

/** Camera shots and lighting come from the shared presets (src/lib/three/scenePresets.ts). */
export type ViewPreset = CameraPresetId;
/** New preset ids, plus the former "studio" / "warm" names (aliases). */
export type LightingPreset = LightingPresetId | "studio" | "warm";

interface ViewerProps {
  spec: PackagingSpec;
  /** The APPLIED design (phase 3C): the same object the 2D and the PDF draw (illustration, logo, layout). */
  design: PackagingDesign;
  /** Fallback only: a logo loaded by the view while the design carries none yet. */
  logoUrl: string | null;
  view: ViewPreset;
  /**
   * Explicit camera command (phase 3D-B): bumped by Face / ¾ / Dos / Recentrer to reframe on the preset
   * of `view`, without remounting the canvas. Design changes never reframe.
   */
  viewCommand?: number;
  lighting: LightingPreset;
  autoRotate: boolean;
  /** Receives a function that returns the current frame as a PNG data URL. */
  onCaptureReady?: (capture: () => string) => void;
}

function useImage(url: string | null) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) {
      setImg(null);
      return;
    }
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = url;
  }, [url]);
  return img;
}

/** Bumps when the design fonts finish loading so textures are redrawn with them. */
function useFontsVersion(heading: string, body: string) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    loadDesignFonts({ headingFont: heading, bodyFont: body }).then(() => alive && setVersion((v) => v + 1));
    return () => {
      alive = false;
    };
  }, [heading, body]);
  return version;
}

function PackagingObject({ spec, design, logo, onObject, materialQuality }: {
  spec: PackagingSpec;
  design: PackagingDesign;
  logo: HTMLImageElement | null;
  onObject: (object: THREE.Object3D) => void;
  materialQuality: RenderQualityConfig["materialQuality"];
}) {
  const fonts = useFontsVersion(design.headingFont, design.bodyFont);
  const [debounced, setDebounced] = useState(design);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(design), 120);
    return () => clearTimeout(t);
  }, [design]);

  const object = useMemo(
    () => buildPackaging(spec, viewerDesign(debounced, logo), { quality: materialQuality }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec.model, spec.lengthMm, spec.widthMm, spec.heightMm, spec.material, debounced, logo, fonts, materialQuality]
  );

  useEffect(() => {
    onObject(object);
    return () => disposeObject(object);
  }, [object, onObject]);

  return <primitive object={object} />;
}

/** Studio lighting, cast + contact shadows and reflections, shared with every Edify renderer. */
function StudioStage({ lighting, object, quality }: { lighting: LightingPreset; object: THREE.Object3D | null; quality: RenderQualityConfig }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const [rig, setRig] = useState<StudioRig | null>(null);
  useEffect(() => {
    const r = new StudioRig(gl, resolveLighting(lighting), quality);
    r.attach(scene, gl);
    setRig(r);
    return () => {
      r.detach(scene);
      r.dispose();
    };
  }, [gl, scene, lighting, quality]);
  useEffect(() => {
    if (!rig || !object || !object.parent) return;
    rig.fit(gl, scene, object);
    invalidate();
  }, [rig, object, gl, scene, invalidate]);
  return null;
}

/**
 * The pack is lost from view: its centre is outside the frame (or behind the camera), or the camera
 * sits inside it. A close-up the user zoomed into on purpose is NOT lost (its centre stays in frame).
 */
function lostFromView(camera: THREE.PerspectiveCamera, object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.containsPoint(camera.position)) return true;
  camera.updateMatrixWorld();
  const c = box.getCenter(new THREE.Vector3()).project(camera);
  return Math.abs(c.x) > 1 || Math.abs(c.y) > 1 || c.z <= -1 || c.z >= 1;
}

/**
 * Camera (phase 3D-B). The automatic composition (frameShot) runs only when it is asked for:
 *   - the first pack shown;
 *   - an explicit view command (Face, ¾, Dos, Recentrer: `command` changes, or the view itself).
 * A rebuilt pack (text, colour, illustration, another container) keeps the user's camera: orbit, zoom
 * and target stay as they are. Only when the pack is lost from view (another container, a resize) is
 * it reframed, keeping the user's current angle, never by jumping back to the preset.
 */
function CameraRig({ view, command, object, controls }: {
  view: ViewPreset;
  command: number;
  object: THREE.Object3D | null;
  controls: React.RefObject<OrbitControlsImpl | null>;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const get = useThree((s) => s.get);
  const invalidate = useThree((s) => s.invalidate);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  /** The view command already applied (null: nothing framed yet). */
  const applied = useRef<string | null>(null);

  const frame = useCallback(
    (obj: THREE.Object3D, keepAngle: boolean) => {
      const { width: w, height: h } = get().size;
      let shot = resolveCamera(view);
      if (keepAngle) {
        // The user's current angle around the target, so a safety reframe never jumps to the preset.
        const target = controls.current?.target ?? new THREE.Vector3();
        const d = camera.position.clone().sub(target).normalize();
        shot = { ...shot, azimuth: THREE.MathUtils.radToDeg(Math.atan2(d.x, d.z)), elevation: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(d.y, -1, 1))) };
      }
      const box = new THREE.Box3().setFromObject(obj);
      const f = frameShot({ min: box.min.toArray(), max: box.max.toArray() }, shot, w / Math.max(1, h));
      camera.fov = f.fov;
      camera.near = f.near;
      camera.far = f.far;
      camera.position.set(...f.position);
      camera.lookAt(...f.target);
      camera.updateProjectionMatrix();
      const c = controls.current;
      if (c) {
        c.target.set(...f.target);
        c.minDistance = f.distance * 0.4;
        c.maxDistance = f.distance * 2.2;
        // Drop the momentum left by damping or auto-rotation, so the shot lands exactly where asked
        // (the old canvas remount used to discard it): an undamped update consumes it, then the
        // camera is placed again. OrbitControls has no public way to clear it.
        const damping = c.enableDamping;
        c.enableDamping = false;
        c.update();
        camera.position.set(...f.position);
        camera.lookAt(...f.target);
        c.update();
        c.enableDamping = damping;
      }
      invalidate();
    },
    [view, camera, controls, get, invalidate]
  );

  // First pack and explicit view commands: the preset framing. `object` is read, not depended on:
  // a rebuilt pack must not re-run this (handled below).
  const latest = useRef(object);
  latest.current = object;
  const hasObject = object !== null;
  useEffect(() => {
    const obj = latest.current;
    if (!obj) return;
    const key = `${view}|${command}`;
    if (applied.current === key) return;
    applied.current = key;
    frame(obj, false);
  }, [view, command, hasObject, frame]);

  // Rebuilt pack or resized canvas: keep the user's camera; reframe (same angle) only if the pack is lost.
  useEffect(() => {
    if (!object || applied.current === null) return;
    if (lostFromView(camera, object)) frame(object, true);
    else invalidate();
  }, [object, width, height, camera, frame, invalidate]);
  return null;
}

/**
 * Demand rendering and auto-rotation: while it is on, each frame asks for the next one (R3F's own loop,
 * nothing else). OrbitControls alone would not: with damping its first auto-rotation step is below the
 * movement threshold of its "change" event, so it never asks for a frame. Off → no frame is requested.
 */
function AutoRotateFrames({ active }: { active: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (active) invalidate();
  }, [active, invalidate]);
  useFrame(() => {
    if (active) invalidate();
  });
  return null;
}

function CaptureBridge({ onCaptureReady }: { onCaptureReady?: (capture: () => string) => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    onCaptureReady?.(() => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL("image/png");
    });
  }, [gl, scene, camera, onCaptureReady]);
  return null;
}

/** Shown instead of a black canvas when the device has no WebGL. */
function NoWebGL() {
  return (
    <div style={{ display: "grid", placeItems: "center", height: "100%", padding: 24, textAlign: "center", color: "var(--muted, #6b7280)", fontSize: 14 }}>
      {"L'aperçu 3D n'est pas disponible sur cet appareil. Le patron à plat et les exports restent utilisables."}
    </div>
  );
}

export default function Packaging3DViewer({ spec, design, logoUrl, view, viewCommand = 0, lighting, autoRotate, onCaptureReady }: ViewerProps) {
  const logo = useImage(logoUrl);
  const controls = useRef<OrbitControlsImpl>(null);
  const [object, setObject] = useState<THREE.Object3D | null>(null);
  const onObject = useMemo(() => (o: THREE.Object3D) => setObject(o), []);
  // PREVIEW tier: interactive, lighter on mobile and low-end GPUs.
  const [quality] = useState(() => chooseQuality("preview", detectGraphicsCaps()));
  if (!quality) return <NoWebGL />;

  return (
    // Demand rendering (phase 3D-B): a frame is drawn only when something changes. OrbitControls asks for
    // frames while the user orbits / zooms, while damping settles and while auto-rotation runs; the stage,
    // the camera rig and R3F (resize, scene changes) ask for theirs. An idle scene draws nothing.
    <Canvas
      frameloop="demand"
      dpr={[1, quality.maxPixelRatio]}
      shadows="variance"
      camera={{ fov: 30, near: 0.01, far: 50, position: [0.8, 0.6, 2.2] }}
      gl={{ antialias: true, preserveDrawingBuffer: true, alpha: true }}
      fallback={<NoWebGL />}
    >
      <StudioStage lighting={lighting} object={object} quality={quality} />
      <PackagingObject spec={spec} design={design} logo={logo} onObject={onObject} materialQuality={quality.materialQuality} />

      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        autoRotate={autoRotate}
        autoRotateSpeed={1.4}
        maxPolarAngle={Math.PI - 0.05}
      />
      <CameraRig view={view} command={viewCommand} object={object} controls={controls} />
      <AutoRotateFrames active={autoRotate} />
      <CaptureBridge onCaptureReady={onCaptureReady} />
    </Canvas>
  );
}
