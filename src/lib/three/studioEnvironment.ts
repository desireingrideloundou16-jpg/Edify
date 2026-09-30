/**
 * Procedural product-photography studio baked into a PMREM environment (phase 2A).
 *
 * Unlike three's RoomEnvironment (an evenly lit room → flat, low-contrast reflections), this
 * is a cyclorama with softboxes placed by the lighting preset: strip boxes give bottles and
 * cans their long highlights, dark walls give edges their contrast. Zero assets, zero network:
 * planes with HDR colours, rendered once per preset.
 */
import * as THREE from "three";
import { shotDirection, type StudioLightingConfig } from "./scenePresets";

type EnvConfig = StudioLightingConfig["environment"];

/** The studio as a plain scene (exported for tests and custom bakes). */
export function studioScene(env: EnvConfig): THREE.Scene {
  const tint = new THREE.Color(env.tint);
  const scene = new THREE.Scene();

  // Cyclorama: walls fading into the floor (vertex colours along y).
  const room = new THREE.BoxGeometry(14, 9, 14);
  room.translate(0, 3.5, 0);
  const pos = room.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const wall = tint.clone().multiplyScalar(env.wall);
  const floor = tint.clone().multiplyScalar(env.floor);
  for (let i = 0; i < pos.count; i++) {
    const c = pos.getY(i) < -0.5 ? floor : wall;
    colors.set([c.r, c.g, c.b], i * 3);
  }
  room.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  scene.add(new THREE.Mesh(room, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, toneMapped: false })));

  for (const p of env.panels) {
    const color = new THREE.Color(p.color ?? env.tint).multiplyScalar(p.intensity);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(p.width, p.height),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false })
    );
    const [x, y, z] = shotDirection(p.azimuth, p.elevation);
    mesh.position.set(x * p.distance, 0.5 + y * p.distance, z * p.distance);
    mesh.lookAt(0, 0.5, 0);
    scene.add(mesh);
  }
  return scene;
}

/** Bakes the studio into a PMREM texture for `scene.environment`. The caller owns disposal. */
export function studioEnvironment(renderer: THREE.WebGLRenderer, env: EnvConfig): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const scene = studioScene(env);
  const texture = pmrem.fromScene(scene, 0.02).texture;
  pmrem.dispose();
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    (m.material as THREE.Material).dispose();
  });
  return texture;
}
