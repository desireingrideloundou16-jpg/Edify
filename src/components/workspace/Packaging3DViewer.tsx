"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
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

/** Automatic composition from the pack's bounds and the chosen shot. */
function CameraRig({ view, object, controls }: {
  view: ViewPreset;
  object: THREE.Object3D | null;
  controls: React.RefObject<OrbitControlsImpl | null>;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  useEffect(() => {
    if (!object) return;
    const box = new THREE.Box3().setFromObject(object);
    const f = frameShot({ min: box.min.toArray(), max: box.max.toArray() }, resolveCamera(view), aspect);
    camera.fov = f.fov;
    camera.near = f.near;
    camera.far = f.far;
    camera.position.set(...f.position);
    camera.lookAt(...f.target);
    camera.updateProjectionMatrix();
    if (controls.current) {
      controls.current.target.set(...f.target);
      controls.current.minDistance = f.distance * 0.4;
      controls.current.maxDistance = f.distance * 2.2;
      controls.current.update();
    }
  }, [view, object, camera, controls, aspect]);
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

export default function Packaging3DViewer({ spec, design, logoUrl, view, lighting, autoRotate, onCaptureReady }: ViewerProps) {
  const logo = useImage(logoUrl);
  const controls = useRef<OrbitControlsImpl>(null);
  const [object, setObject] = useState<THREE.Object3D | null>(null);
  const onObject = useMemo(() => (o: THREE.Object3D) => setObject(o), []);
  // PREVIEW tier: interactive, lighter on mobile and low-end GPUs.
  const [quality] = useState(() => chooseQuality("preview", detectGraphicsCaps()));
  if (!quality) return <NoWebGL />;

  return (
    <Canvas
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
      <CameraRig view={view} object={object} controls={controls} />
      <CaptureBridge onCaptureReady={onCaptureReady} />
    </Canvas>
  );
}
