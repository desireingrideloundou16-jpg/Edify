/**
 * Studio rig shared by every renderer (live viewer, catalog thumbnails, HD render): baked
 * environment, key / fill / rim lights, a real cast shadow on an invisible ground, and a
 * shape-aware contact shadow, so the pack sits *in* the scene instead of floating in front
 * of a backdrop. Everything comes from a `StudioLightingConfig` (scenePresets.ts).
 */
import * as THREE from "three";
import { HorizontalBlurShader } from "three/examples/jsm/shaders/HorizontalBlurShader.js";
import { VerticalBlurShader } from "three/examples/jsm/shaders/VerticalBlurShader.js";
import { shotDirection, type DirectionalSpec, type RenderQualityConfig, type StudioLightingConfig } from "./scenePresets";
import { studioEnvironment } from "./studioEnvironment";

const RIG_LAYER_HIDDEN = "studioRigHelper";

function directional(spec: DirectionalSpec) {
  const l = new THREE.DirectionalLight(spec.color, spec.intensity);
  l.userData.spec = spec;
  return l;
}

/** Contact shadow: the pack's footprint seen from below, blurred (same idea as drei's ContactShadows). */
class ContactShadow {
  readonly mesh: THREE.Mesh;
  private camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
  private target: THREE.WebGLRenderTarget;
  private blurTarget: THREE.WebGLRenderTarget;
  private depth: THREE.MeshDepthMaterial;
  private hBlur = new THREE.ShaderMaterial({ ...HorizontalBlurShader, uniforms: THREE.UniformsUtils.clone(HorizontalBlurShader.uniforms), depthTest: false });
  private vBlur = new THREE.ShaderMaterial({ ...VerticalBlurShader, uniforms: THREE.UniformsUtils.clone(VerticalBlurShader.uniforms), depthTest: false });
  private quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  private quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);

  constructor(private resolution = 512) {
    this.target = new THREE.WebGLRenderTarget(resolution, resolution);
    this.blurTarget = new THREE.WebGLRenderTarget(resolution, resolution);
    this.target.texture.generateMipmaps = this.blurTarget.texture.generateMipmaps = false;
    this.depth = new THREE.MeshDepthMaterial();
    this.depth.userData.darkness = { value: 1.4 };
    this.depth.onBeforeCompile = (shader) => {
      shader.uniforms.darkness = this.depth.userData.darkness;
      shader.fragmentShader = `uniform float darkness;\n${shader.fragmentShader.replace(
        "gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );",
        "gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );"
      )}`;
    };
    this.depth.depthTest = this.depth.depthWrite = false;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: this.target.texture, transparent: true, depthWrite: false, toneMapped: false })
    );
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.scale.set(1, -1, 1);
    this.mesh.renderOrder = 1;
    this.mesh.userData[RIG_LAYER_HIDDEN] = true;
    this.camera.rotation.x = Math.PI / 2;
    this.quadCamera.position.z = 1;
  }

  /** Re-render for a new pack (the pack is static, so once per build is enough). */
  update(renderer: THREE.WebGLRenderer, scene: THREE.Scene, bounds: THREE.Box3, opacity: number, blur: number) {
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const w = Math.max(size.x, size.z) * 1.9 + 0.15;
    this.mesh.position.set(center.x, bounds.min.y + 0.0006, center.z);
    this.mesh.scale.set(w, -w, 1);
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = opacity;
    Object.assign(this.camera, { left: -w / 2, right: w / 2, top: w / 2, bottom: -w / 2, near: 0, far: Math.max(0.2, size.y * 0.55) });
    this.camera.position.set(center.x, bounds.min.y, center.z);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();

    const hidden: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (o.visible && o.userData[RIG_LAYER_HIDDEN]) {
        hidden.push(o);
        o.visible = false;
      }
    });
    const { background, overrideMaterial } = scene;
    const prevTarget = renderer.getRenderTarget();
    const prevClear = renderer.getClearAlpha();
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = true;
    scene.background = null;
    scene.overrideMaterial = this.depth;
    renderer.setClearAlpha(0);
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(scene, this.camera);
    scene.overrideMaterial = overrideMaterial;
    scene.background = background;
    hidden.forEach((o) => (o.visible = true));

    // Two separable blur passes, the second at half strength for a soft falloff.
    for (const k of [1, 0.4]) {
      this.quad.material = this.hBlur;
      this.hBlur.uniforms.tDiffuse.value = this.target.texture;
      this.hBlur.uniforms.h.value = (blur * k) / 256;
      renderer.setRenderTarget(this.blurTarget);
      renderer.render(this.quad, this.quadCamera);
      this.quad.material = this.vBlur;
      this.vBlur.uniforms.tDiffuse.value = this.blurTarget.texture;
      this.vBlur.uniforms.v.value = (blur * k) / 256;
      renderer.setRenderTarget(this.target);
      renderer.render(this.quad, this.quadCamera);
    }
    renderer.setRenderTarget(prevTarget);
    renderer.setClearAlpha(prevClear);
    renderer.autoClear = prevAutoClear;
  }

  dispose() {
    this.target.dispose();
    this.blurTarget.dispose();
    this.depth.dispose();
    this.hBlur.dispose();
    this.vBlur.dispose();
    this.quad.geometry.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

export class StudioRig {
  readonly group = new THREE.Group();
  readonly environment: THREE.Texture;
  private key: THREE.DirectionalLight;
  private lights: THREE.DirectionalLight[] = [];
  private ground: THREE.Mesh;
  private contact: ContactShadow;
  private center = new THREE.Vector3(0, 0.5, 0);
  private lightDistance = 5;

  constructor(private renderer: THREE.WebGLRenderer, readonly config: StudioLightingConfig, quality: Pick<RenderQualityConfig, "shadowMapSize">) {
    renderer.shadowMap.enabled = true;
    // Pack and lights are static: the shadow map is only redrawn when they change (see placeLights).
    renderer.shadowMap.autoUpdate = false;
    // Variance shadows: blurrable (soft penumbra) and only received by the ground, so no light bleeding on packs.
    renderer.shadowMap.type = THREE.VSMShadowMap;
    this.environment = studioEnvironment(renderer, config.environment);

    this.key = directional(config.key);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    this.key.shadow.bias = -0.0002;
    this.key.shadow.radius = 10;
    this.key.shadow.blurSamples = 16;
    this.lights.push(this.key);
    for (const spec of [config.fill, config.rim]) if (spec) this.lights.push(directional(spec));
    for (const l of this.lights) {
      this.group.add(l, l.target);
    }
    const hemi = new THREE.HemisphereLight("#ffffff", new THREE.Color(config.environment.tint).multiplyScalar(config.environment.floor), config.ambient);
    this.group.add(hemi);

    // A disc inside the shadow camera frustum: no visible frustum edge on the floor.
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.ShadowMaterial({ opacity: config.shadow.opacity, depthWrite: false }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.ground.userData[RIG_LAYER_HIDDEN] = true;
    this.group.add(this.ground);

    this.contact = new ContactShadow();
    this.group.add(this.contact.mesh);
  }

  /** Installs the environment on a scene (restored by `detach`). */
  attach(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    scene.add(this.group);
    scene.environment = this.environment;
    scene.environmentIntensity = this.config.environment.intensity;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = this.config.exposure;
  }

  detach(scene: THREE.Scene) {
    scene.remove(this.group);
    if (scene.environment === this.environment) scene.environment = null;
  }

  /** Aims the lights, shadow camera and contact shadow at a (normalised) pack already in `scene`. */
  fit(renderer: THREE.WebGLRenderer, scene: THREE.Scene, object: THREE.Object3D) {
    object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = false;
    });
    object.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(object);
    const size = bounds.getSize(new THREE.Vector3());
    bounds.getCenter(this.center);
    const radius = Math.max(0.05, size.length() / 2);
    this.lightDistance = radius * 6;

    const cam = this.key.shadow.camera;
    const r = radius * 2.6;
    this.ground.position.set(this.center.x, bounds.min.y, this.center.z);
    this.ground.scale.setScalar(r * 0.92);
    Object.assign(cam, { left: -r, right: r, top: r, bottom: -r, near: 0.01, far: this.lightDistance * 2 });
    cam.updateProjectionMatrix();
    this.placeLights();
    this.contact.update(renderer, scene, bounds, this.config.shadow.contactOpacity, this.config.shadow.contactBlur);
  }

  /** HD: moves the key light across its apparent size, so accumulated frames give soft shadows. */
  jitterKey(u: number, v: number) {
    // softness = apparent radius of the light, as a fraction of its distance.
    this.placeLights(u * this.config.key.softness * 0.4, v * this.config.key.softness * 0.4);
  }

  private placeLights(du = 0, dv = 0) {
    for (const l of this.lights) {
      const spec = l.userData.spec as DirectionalSpec;
      const [x, y, z] = shotDirection(spec.azimuth, spec.elevation);
      l.position.set(x, y, z).multiplyScalar(this.lightDistance).add(this.center);
      if (l === this.key && (du || dv)) {
        // Offset perpendicular to the light direction.
        const dir = new THREE.Vector3(x, y, z);
        const side = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
        const up = dir.clone().cross(side).normalize();
        l.position.addScaledVector(side, du * this.lightDistance).addScaledVector(up, dv * this.lightDistance);
      }
      l.target.position.copy(this.center);
      l.updateMatrixWorld();
      l.target.updateMatrixWorld();
    }
    this.renderer.shadowMap.needsUpdate = true;
  }

  dispose() {
    this.environment.dispose();
    this.key.shadow.map?.dispose();
    this.ground.geometry.dispose();
    (this.ground.material as THREE.Material).dispose();
    this.contact.dispose();
  }
}
