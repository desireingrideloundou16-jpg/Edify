"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Environment, Lightformer } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { buildPackaging, disposeObject, PackagingDesign, PackagingSpec } from "@/lib/three/packagingModels";

export type ViewPreset = "front" | "threeQuarter" | "top";
export type LightingPreset = "studio" | "soft" | "warm";

const VIEW_DIR: Record<ViewPreset, [number, number, number]> = {
  front: [0, 0.12, 1],
  threeQuarter: [0.75, 0.38, 1],
  top: [0.35, 1.25, 0.7],
};

const LIGHTING: Record<LightingPreset, { color: string; top: number; key: number; fill: number; rim: number; sun: number }> = {
  studio: { color: "#ffffff", top: 2.2, key: 1.6, fill: 0.7, rim: 1.2, sun: 1.1 },
  soft:   { color: "#f4f6ff", top: 1.4, key: 0.9, fill: 0.9, rim: 0.6, sun: 0.5 },
  warm:   { color: "#ffd9a8", top: 1.9, key: 1.7, fill: 0.5, rim: 1.4, sun: 1.2 },
};

interface ViewerProps {
  spec: PackagingSpec;
  design: Omit<PackagingDesign, "logo">;
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

/** Re-render once web fonts are available so canvas artwork uses them. */
function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    document.fonts?.ready.then(() => setReady(true));
  }, []);
  return ready;
}

function PackagingObject({ spec, design, logo, onSize }: {
  spec: PackagingSpec;
  design: Omit<PackagingDesign, "logo">;
  logo: HTMLImageElement | null;
  onSize: (size: THREE.Vector3) => void;
}) {
  const fonts = useFontsReady();
  const [debounced, setDebounced] = useState(design);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(design), 120);
    return () => clearTimeout(t);
  }, [design]);

  const object = useMemo(
    () => buildPackaging(spec, { ...debounced, logo }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec.model, spec.lengthMm, spec.widthMm, spec.heightMm, spec.material, debounced, logo, fonts]
  );

  useEffect(() => {
    onSize(new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()));
    return () => disposeObject(object);
  }, [object, onSize]);

  return <primitive object={object} />;
}

function CameraRig({ view, size, controls }: {
  view: ViewPreset;
  size: THREE.Vector3 | null;
  controls: React.RefObject<OrbitControlsImpl>;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  useEffect(() => {
    if (!size) return;
    const target = new THREE.Vector3(0, size.y * 0.44, 0);
    const radius = size.length() / 2;
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * aspect);
    const dist = (radius / Math.sin(Math.min(vHalf, hHalf))) * 1.08;
    const dir = new THREE.Vector3(...VIEW_DIR[view]).normalize();
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    if (controls.current) {
      controls.current.target.copy(target);
      controls.current.minDistance = dist * 0.45;
      controls.current.maxDistance = dist * 2.2;
      controls.current.update();
    }
  }, [view, size, camera, controls, aspect]);
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

export default function Packaging3DViewer({ spec, design, logoUrl, view, lighting, autoRotate, onCaptureReady }: ViewerProps) {
  const logo = useImage(logoUrl);
  const controls = useRef<OrbitControlsImpl>(null);
  const [size, setSize] = useState<THREE.Vector3 | null>(null);
  const onSize = useMemo(() => (s: THREE.Vector3) => setSize((prev) => (prev && prev.equals(s) ? prev : s)), []);
  const L = LIGHTING[lighting];

  return (
    <Canvas
      dpr={[1, 2]}
      shadows
      camera={{ fov: 30, near: 0.01, far: 50, position: [0.8, 0.6, 2.2] }}
      gl={{ antialias: true, preserveDrawingBuffer: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1.1;
      }}
    >
      <Environment resolution={256} frames={1} environmentIntensity={1.3}>
        <Lightformer form="rect" intensity={L.top} color={L.color} position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[6, 6, 1]} />
        <Lightformer form="rect" intensity={L.key} color={L.color} position={[-4, 1.5, 2]} rotation-y={Math.PI / 2.5} scale={[4, 2.5, 1]} />
        <Lightformer form="rect" intensity={L.fill} color="#ffffff" position={[4, 1, 2]} rotation-y={-Math.PI / 2.5} scale={[4, 2.5, 1]} />
        <Lightformer form="rect" intensity={L.rim} color={L.color} position={[0, 1.5, -4]} scale={[6, 1.5, 1]} />
        <Lightformer form="ring" intensity={0.6} color="#ffffff" position={[0, 0.5, 4]} scale={2} />
      </Environment>

      <directionalLight position={[2.5, 4, 3]} intensity={L.sun} color={L.color} />
      <ambientLight intensity={0.15} />

      <PackagingObject spec={spec} design={design} logo={logo} onSize={onSize} />

      <ContactShadows position={[0, 0.0005, 0]} opacity={0.5} scale={3} blur={2.6} far={1.2} resolution={512} color="#1b1f27" />

      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        autoRotate={autoRotate}
        autoRotateSpeed={1.4}
        maxPolarAngle={Math.PI / 2 - 0.04}
      />
      <CameraRig view={view} size={size} controls={controls} />
      <CaptureBridge onCaptureReady={onCaptureReady} />
    </Canvas>
  );
}
