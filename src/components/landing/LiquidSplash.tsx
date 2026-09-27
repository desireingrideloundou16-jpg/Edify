"use client";

/**
 * Real-time liquid splash behind the hero packs: glossy metaballs (marching
 * cubes) that ripple and orbit, plus floating ingredients. Themed per visit.
 */
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Ingredient, LandingTheme } from "./themes";

function citrusTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff4d6";
  g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#ff9f1a";
  g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#fff4d6";
  g.lineWidth = 6;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112); g.stroke();
  }
  g.fillStyle = "#fff4d6";
  g.beginPath(); g.arc(128, 128, 14, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeIngredient(kind: Ingredient, liquid: string): THREE.Object3D {
  switch (kind) {
    case "bean": {
      const geo = new THREE.SphereGeometry(1, 32, 24);
      geo.scale(0.075, 0.055, 0.1);
      const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: "#3a1d0c", roughness: 0.35, clearcoat: 0.8 }));
      const groove = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.006, 8, 32, Math.PI), new THREE.MeshStandardMaterial({ color: "#1b0c04" }));
      groove.rotation.set(0, Math.PI / 2, 0);
      groove.position.y = 0.05;
      m.add(groove);
      return m;
    }
    case "citrus": {
      const tex = citrusTexture();
      const side = new THREE.MeshStandardMaterial({ color: "#ffb347", roughness: 0.5 });
      const face = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.25, clearcoat: 0.6 });
      return new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.025, 48), [side, face, face]);
    }
    case "chili": {
      const pts = Array.from({ length: 12 }, (_, i) => new THREE.Vector2(Math.sin((i / 11) * Math.PI) * 0.045 * (1 - i / 14) + 0.004, i * 0.03));
      const geo = new THREE.LatheGeometry(pts, 24);
      geo.rotateZ(0.5);
      return new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: "#d4140c", roughness: 0.2, clearcoat: 1 }));
    }
    case "petal": {
      const geo = new THREE.SphereGeometry(1, 24, 16);
      geo.scale(0.11, 0.012, 0.07);
      return new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: "#f7b6c8", roughness: 0.5, sheen: 1, sheenColor: new THREE.Color("#ffffff"), side: THREE.DoubleSide }));
    }
    case "leaf": {
      const geo = new THREE.SphereGeometry(1, 24, 16);
      geo.scale(0.12, 0.01, 0.05);
      return new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: "#3f9a3a", roughness: 0.4, clearcoat: 0.4 }));
    }
    case "cube": {
      const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
      return new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: "#e8f7ff", transmission: 1, roughness: 0.08, thickness: 0.2, ior: 1.31 }));
    }
    default:
      return new THREE.Mesh(new THREE.SphereGeometry(0.045, 32, 24), new THREE.MeshPhysicalMaterial({ color: liquid, transmission: 0.4, roughness: 0.05, clearcoat: 1, thickness: 0.3 }));
  }
}

export function LiquidSplash({ theme }: { theme: LandingTheme }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return; // no WebGL: the static hero still looks complete
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0, 4.2);
    const key = new THREE.DirectionalLight("#ffffff", 2.2);
    key.position.set(-2, 3, 3);
    scene.add(key);
    scene.add(new THREE.AmbientLight("#ffffff", 0.35));

    // Liquid
    const liquidMat = new THREE.MeshPhysicalMaterial({
      color: theme.liquid.color,
      roughness: theme.liquid.roughness,
      transmission: theme.liquid.transmission,
      thickness: 0.6,
      ior: 1.33,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
    });
    const mobile = window.matchMedia("(max-width: 900px)").matches;
    const blob = new MarchingCubes(mobile ? 40 : 76, liquidMat, false, false, mobile ? 50000 : 160000);
    blob.position.set(0, -0.15, 0);
    blob.scale.setScalar(1.55);
    scene.add(blob);

    // Ingredients orbiting in front of and behind the splash
    const bits = Array.from({ length: 9 }, (_, i) => {
      const o = makeIngredient(theme.ingredients[i % theme.ingredients.length], theme.liquid.color);
      const angle = (i / 9) * Math.PI * 2;
      o.userData = { angle, radius: 1.05 + (i % 3) * 0.16, y: -0.55 + ((i * 37) % 10) / 9, speed: 0.12 + (i % 4) * 0.035, spin: new THREE.Vector3(0.6 + i * 0.1, 0.4, 0.3) };
      scene.add(o);
      return o;
    });

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // Liquid crown splash: a thin rim around the base, spikes rising from it
    // with droplets breaking off their tips, and two curling arcs.
    const N = 26;
    const subtract = 12;
    const updateLiquid = (t: number) => {
      blob.reset();
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 + t * 0.12;
        const r = 0.3 + Math.sin(t * 1.4 + i * 1.3) * 0.012;
        blob.addBall(0.5 + Math.cos(a) * r, 0.26, 0.5 + Math.sin(a) * r * 0.5, 0.075, subtract);
        // Every other rim point throws a spike with a droplet at its tip
        if (i % 2 === 0) {
          const h = (0.5 + 0.5 * Math.sin(t * 1.1 + i * 2.3)) * 0.2;
          for (let s = 1; s <= 3; s++) {
            blob.addBall(0.5 + Math.cos(a) * (r + s * 0.012), 0.26 + (h * s) / 3, 0.5 + Math.sin(a) * r * 0.5, 0.05 - s * 0.012, subtract);
          }
          blob.addBall(0.5 + Math.cos(a) * (r + 0.05), 0.3 + h + 0.06, 0.5 + Math.sin(a) * r * 0.5, 0.02, subtract);
        }
      }
      // Two curling arcs behind the packs
      for (let k = 0; k < 2; k++) {
        const side = k === 0 ? -1 : 1;
        for (let s = 0; s < 9; s++) {
          const p = s / 8;
          const sway = Math.sin(t * 0.8 + k * 2 + p * 2) * 0.025;
          blob.addBall(0.5 + side * (0.18 + p * 0.2) + sway, 0.3 + Math.sin(p * Math.PI * 0.85) * 0.34, 0.42, 0.07 - p * 0.05, subtract);
        }
      }
      // Free droplets rising and fading
      for (let d = 0; d < 7; d++) {
        const ph = (t * 0.3 + d * 0.17) % 1;
        blob.addBall(0.5 + Math.sin(d * 2.4) * 0.34, 0.4 + ph * 0.45, 0.48 + Math.cos(d * 1.7) * 0.08, 0.018 * (1 - ph), subtract);
      }
      blob.update();
    };

    let raf = 0;
    let visible = true;
    const start = performance.now();
    const frame = () => {
      const t = (performance.now() - start) / 1000;
      updateLiquid(t);
      bits.forEach((o) => {
        const u = o.userData;
        const a = u.angle + t * u.speed;
        o.position.set(Math.cos(a) * u.radius, u.y + Math.sin(t * 0.8 + u.angle) * 0.08, Math.sin(a) * u.radius * 0.6);
        o.rotation.set(t * u.spin.x * 0.4, t * u.spin.y * 0.4, t * u.spin.z * 0.4);
      });
      renderer.render(scene, camera);
      if (!reduced && visible) raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(frame);
    });
    io.observe(host);
    frame();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => mat.dispose());
        }
      });
      scene.environment?.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [theme]);

  return <div ref={hostRef} className="lp-liquid" aria-hidden="true" />;
}
