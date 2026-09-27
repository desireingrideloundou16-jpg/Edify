"use client";

/**
 * Hero 3D scene: the day's packs as real 3D models, floating and turning,
 * with glossy CMYK shapes orbiting around them. Desktop only, loaded after
 * the page is idle; the static images stay underneath until it is ready.
 */
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { buildPackaging } from "@/lib/three/packagingModels";
import { loadDesignFonts } from "@/lib/artwork/draw";
import { ALL_CATALOG_SHAPES } from "@/lib/catalog/shapes";
import { SHOWCASE, loadShowcaseArt } from "./showcase";
import type { LandingTheme } from "./themes";

const CMYK = { c: "#00a0e3", m: "#e6007e", y: "#ffe500", k: "#141414" };

export function Hero3D({ theme, onReady }: { theme: LandingTheme; onReady: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let raf = 0;
    const cleanups: (() => void)[] = [];

    (async () => {
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      } catch {
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
      const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
      camera.position.set(0, 0.35, 7.4);
      const key = new THREE.DirectionalLight("#ffffff", 1.6);
      key.position.set(-3, 4, 4);
      scene.add(key);

      // Packs: the three front slots of the day's universe.
      const [, right, left, centre] = theme.packs;
      const slots = [
        { i: left, x: -0.95, y: -0.15, s: 1.3, yaw: -0.55, phase: 0 },
        { i: centre, x: 0.2, y: -0.4, s: 1.0, yaw: -0.25, phase: 1.7 },
        { i: right, x: 1.05, y: 0.0, s: 1.1, yaw: -0.7, phase: 3.1 },
      ];
      const packs: THREE.Group[] = [];
      for (const slot of slots) {
        const item = SHOWCASE[slot.i];
        const shape = ALL_CATALOG_SHAPES.find((s) => s.id === item.shapeId);
        if (!shape?.model) continue;
        await loadDesignFonts(item.design);
        if (disposed) return;
        const obj = buildPackaging(
          { model: shape.model, lengthMm: shape.lengthMm, widthMm: shape.widthMm, heightMm: shape.heightMm, material: shape.material },
          { ...item.design, logo: null, art: await loadShowcaseArt(item) }
        );
        obj.scale.multiplyScalar(slot.s);
        const g = new THREE.Group();
        const box = new THREE.Box3().setFromObject(obj);
        obj.position.y -= (box.max.y - box.min.y) / 2;
        g.add(obj);
        g.position.set(slot.x, slot.y, 0);
        g.userData = slot;
        scene.add(g);
        packs.push(g);
        await new Promise((r) => setTimeout(r, 0)); // keep the main thread responsive
      }

      // Glossy CMYK shapes orbiting around the packs.
      const gloss = (color: string, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
        new THREE.MeshPhysicalMaterial({ color, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, ...extra });
      const shapes: THREE.Mesh[] = [
        new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.1, 32, 96), gloss(CMYK.m)),
        new THREE.Mesh(new THREE.SphereGeometry(0.22, 48, 32), gloss(CMYK.c)),
        new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.34, 0.34, 4, 0.08), gloss(CMYK.y)),
        new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.3, 12, 32), gloss(CMYK.k, { roughness: 0.3 })),
        new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 24), gloss(CMYK.m)),
        new THREE.Mesh(new THREE.TorusKnotGeometry(0.13, 0.045, 96, 16), gloss(CMYK.c)),
        new THREE.Mesh(new THREE.SphereGeometry(0.14, 32, 24), gloss("#ffffff", { transmission: 1, thickness: 0.4, roughness: 0.05 })),
      ];
      const orbits = [
        [-1.65, 0.95, -0.6], [1.7, 1.0, -0.4], [-1.55, -0.95, 0.4], [1.75, -0.8, 0.3], [0.1, 1.2, -0.8], [-0.5, 1.05, 0.6], [0.95, -1.1, 0.8],
      ];
      shapes.forEach((m, i) => {
        m.userData = { base: new THREE.Vector3(...(orbits[i] as [number, number, number])), phase: i * 1.3, spin: 0.3 + (i % 3) * 0.2 };
        scene.add(m);
      });

      host.appendChild(renderer.domElement);
      const resize = () => {
        const w = host.clientWidth, h = host.clientHeight;
        if (!w || !h || !renderer) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);
      cleanups.push(() => ro.disconnect());

      const pointer = { x: 0, y: 0 };
      const onMove = (e: PointerEvent) => {
        pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
        pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      cleanups.push(() => window.removeEventListener("pointermove", onMove));

      let visible = true;
      const start = performance.now();
      const frame = () => {
        if (!renderer) return;
        const t = (performance.now() - start) / 1000;
        packs.forEach((g) => {
          const u = g.userData as (typeof slots)[number];
          g.rotation.y = u.yaw + Math.sin(t * 0.45 + u.phase) * 0.35;
          g.position.y = u.y + Math.sin(t * 0.9 + u.phase) * 0.06;
        });
        shapes.forEach((m) => {
          const u = m.userData as { base: THREE.Vector3; phase: number; spin: number };
          m.position.set(u.base.x + Math.sin(t * 0.5 + u.phase) * 0.12, u.base.y + Math.sin(t * 0.8 + u.phase) * 0.14, u.base.z);
          m.rotation.set(t * u.spin, t * u.spin * 0.7, 0);
        });
        camera.position.x += (pointer.x * 0.35 - camera.position.x) * 0.04;
        camera.position.y += (0.35 - pointer.y * 0.2 - camera.position.y) * 0.04;
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
        if (visible) raf = requestAnimationFrame(frame);
      };
      const io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        cancelAnimationFrame(raf);
        if (visible) raf = requestAnimationFrame(frame);
      });
      io.observe(host);
      cleanups.push(() => io.disconnect());
      frame();
      if (!disposed) onReady();

      cleanups.push(() => {
        scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry.dispose();
          (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((mat) => {
            (mat as THREE.MeshStandardMaterial).map?.dispose();
            mat.dispose();
          });
        });
        scene.environment?.dispose();
      });
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanups.forEach((fn) => fn());
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [theme, onReady]);

  return <div ref={hostRef} className="lp-hero3d" aria-hidden="true" />;
}
