import type * as ThreeNS from "three";
import type { CareThreadSceneConfig } from "./care-thread-config";

/**
 * Procedural "two rooms, one thread" scene for the homepage hero.
 * Deliberately people-free: a clinic consultation room and a home living room built from
 * furniture, plants and trees, joined by a line of light from the clinic tablet to the home laptop.
 * Geometry is the asset (like a model file); colours, light, fog and opacity come from config.
 */

type Three = typeof ThreeNS;

/** Scene scale in metres; the camera clip range must cover the whole diorama and outdoor trees. */
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 80;

export interface CareThreadScene {
  scene: ThreeNS.Scene;
  /** Draws the first `fraction` (0–1) of the thread and moves its glowing head there. */
  setReveal: (fraction: number) => void;
  dispose: () => void;
}

const WALL_HEIGHT = 3.2;
const WALL = 0.2;
const THREAD_SEGMENTS = 320;
const THREAD_SIDES = 10;
// Clinic tablet screen → over the table → through the doorway → down to the home laptop screen.
const THREAD_PATH: Array<[number, number, number]> = [
  [-5.7, 0.9, -0.85], [-4.9, 1.55, -1.2], [-3, 1.85, -1.7], [-1.2, 1.6, -1.8], [0, 1.45, -1.8],
  [1.4, 1.5, -1.75], [3.4, 1.55, -1.45], [5.1, 1.05, -1.05], [5.95, 0.66, -0.98],
];

export function buildCareThreadScene(THREE: Three, config: CareThreadSceneConfig): CareThreadScene {
  const c = config.palette;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(c.sky);
  scene.fog = new THREE.Fog(c.sky, config.fog.near, config.fog.far);
  const materials = new Map<string, ThreeNS.Material>();
  const textures: ThreeNS.Texture[] = [];

  const standard = (color: string, roughness = 0.85) => {
    const key = `s:${color}:${roughness}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness }));
    return materials.get(key)!;
  };
  const place = <T extends ThreeNS.Object3D>(object: T, x: number, y: number, z: number, parent: ThreeNS.Object3D = scene) => {
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  };
  const solid = (geometry: ThreeNS.BufferGeometry, material: ThreeNS.Material, shadows = true) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    return mesh;
  };
  /** Box resting with its base at `y`. */
  const box = (w: number, h: number, d: number, color: string, x: number, y: number, z: number, parent?: ThreeNS.Object3D) =>
    place(solid(new THREE.BoxGeometry(w, h, d), standard(color)), x, y + h / 2, z, parent);
  const cylinder = (top: number, bottom: number, h: number, color: string, x: number, y: number, z: number, parent?: ThreeNS.Object3D) =>
    place(solid(new THREE.CylinderGeometry(top, bottom, h, 40), standard(color)), x, y + h / 2, z, parent);
  const group = (x: number, z: number, rotation = 0) => {
    const g = place(new THREE.Group(), x, 0, z);
    g.rotation.y = rotation;
    return g;
  };

  // Ground, plinths and walls.
  place(solid(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), standard(c.ground, 1), false), 0, -0.1, 0);
  box(11.2, 0.1, 6.4, c.clinicFloor, -5.6, -0.1, -0.9);
  box(11.2, 0.1, 6.4, c.homeFloor, 5.6, -0.1, -0.9);
  const wallWithWindow = (x0: number, x1: number, z: number, wx0: number, wx1: number) => {
    const sill = 0.85, head = 2.65;
    box(wx0 - x0, WALL_HEIGHT, WALL, c.wall, (x0 + wx0) / 2, 0, z);
    box(x1 - wx1, WALL_HEIGHT, WALL, c.wall, (wx1 + x1) / 2, 0, z);
    box(wx1 - wx0, sill, WALL, c.wall, (wx0 + wx1) / 2, 0, z);
    box(wx1 - wx0, WALL_HEIGHT - head, WALL, c.wall, (wx0 + wx1) / 2, head, z);
    const glass = new THREE.MeshStandardMaterial({ color: c.glass, transparent: true, opacity: config.opacity.glass, roughness: 0.1 });
    materials.set(`glass:${z}:${wx0}`, glass);
    place(solid(new THREE.PlaneGeometry(wx1 - wx0, head - sill), glass, false), (wx0 + wx1) / 2, (sill + head) / 2, z);
    for (let x = wx0; x <= wx1 + 0.001; x += (wx1 - wx0) / 3) box(0.06, head - sill, 0.12, c.metal, x, sill, z);
  };
  wallWithWindow(-11, 0, -4, -8.6, -3.2);
  wallWithWindow(0, 11, -4, 6.4, 10.2);
  box(WALL, WALL_HEIGHT, 6.2, c.wall, -11, 0, -0.9);
  box(WALL, WALL_HEIGHT, 6.2, c.wall, 11, 0, -0.9);
  // Dividing wall with the doorway the thread passes through.
  box(WALL, WALL_HEIGHT, 1.4, c.wall, 0, 0, -3.3);
  box(WALL, WALL_HEIGHT, 3.2, c.wall, 0, 0, 0.6);
  box(WALL, WALL_HEIGHT - 2.4, 1.6, c.wall, 0, 2.4, -1.8);
  for (let z = -3.6; z <= 1.8; z += 0.36) box(0.06, 2.6, 0.12, c.wood, -10.85, 0.2, z);
  for (let x = 1.4, i = 0; x <= 5.8; x += 0.3, i++) box(0.12, 2.8, 0.08, c.wood, x, 0.1, -3.82 + Math.sin(i * 0.9) * 0.08);

  // Clinic: consultation table, two empty chairs, a tablet showing the shared appointment.
  cylinder(0.32, 0.4, 0.04, c.table, -6, 0, -1);
  cylinder(0.12, 0.12, 0.7, c.table, -6, 0.04, -1);
  cylinder(1.1, 1.1, 0.07, c.table, -6, 0.74, -1);
  const chair = (x: number, z: number, rotation: number) => {
    const g = group(x, z, rotation);
    box(0.6, 0.09, 0.56, c.chair, 0, 0.44, 0, g);
    box(0.6, 0.62, 0.08, c.chair, 0, 0.53, -0.26, g);
    for (const [lx, lz] of [[-0.24, -0.22], [0.24, -0.22], [-0.24, 0.22], [0.24, 0.22]])
      place(solid(new THREE.CylinderGeometry(0.025, 0.02, 0.44, 12), standard(c.wood)), lx, 0.22, lz, g);
  };
  chair(-7.5, -1, Math.PI / 2);
  chair(-4.5, -1, -Math.PI / 2);
  const screenTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 200;
    const g = canvas.getContext("2d");
    if (g) {
      g.fillStyle = c.screen;
      g.fillRect(0, 0, 320, 200);
      g.fillStyle = c.card;
      g.beginPath();
      // roundRect is missing before Safari 16; a square card keeps the scene rendering there.
      if (g.roundRect) g.roundRect(24, 22, 272, 156, 14);
      else g.rect(24, 22, 272, 156);
      g.fill();
      g.fillStyle = c.accent;
      g.fillRect(44, 44, 96, 12);
      g.globalAlpha = 0.35;
      g.fillRect(44, 66, 160, 9);
      g.fillRect(44, 82, 120, 9);
      g.globalAlpha = 1;
      g.strokeStyle = c.accent;
      g.lineWidth = 6;
      g.lineJoin = "round";
      g.beginPath();
      [[44, 140], [110, 140], [126, 112], [146, 162], [166, 122], [180, 140], [276, 140]]
        .forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    return texture;
  };
  const screen = new THREE.MeshBasicMaterial({ map: screenTexture() });
  materials.set("screen", screen);
  const tablet = group(-5.7, -0.85, -Math.PI / 2);
  const tabletBody = box(0.36, 0.02, 0.26, c.metal, 0, 0.82, 0, tablet);
  tabletBody.rotation.x = -0.3;
  place(new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.22).rotateX(-Math.PI / 2), screen), 0, 0.012, 0, tabletBody);

  // Plants and outdoor trees seen through the windows.
  const plant = (x: number, z: number, scale = 1) => {
    const g = group(x, z);
    g.scale.setScalar(scale);
    cylinder(0.22, 0.17, 0.42, c.pot, 0, 0, 0, g);
    for (let i = 0; i < 7; i++) {
      const leaf = solid(new THREE.SphereGeometry(0.2, 12, 8), standard(c.plant, 0.7));
      leaf.scale.set(0.55, 1.3, 0.3);
      const angle = (i / 7) * Math.PI * 2;
      place(leaf, Math.cos(angle) * 0.18, 0.75 + (i % 3) * 0.18, Math.sin(angle) * 0.18, g);
      leaf.rotation.set(Math.sin(angle) * 0.5, -angle, Math.cos(angle) * 0.5);
    }
  };
  plant(-10.2, -3.3, 1.3);
  plant(-1.0, -3.3);
  plant(1.0, -3.3, 1.1);
  const tree = (x: number, z: number, scale: number) => {
    const g = group(x, z);
    g.scale.setScalar(scale);
    cylinder(0.12, 0.16, 1.4, c.trunk, 0, 0, 0, g);
    place(solid(new THREE.IcosahedronGeometry(0.95, 1), standard(c.plant, 0.9)), 0, 2.1, 0, g);
  };
  [[-9, -10, 1.3], [-5.5, -12, 1.5], [-2, -9.5, 1.1], [3, -11, 1.4], [7.5, -9.5, 1.2], [10.5, -12, 1.6]]
    .forEach(([x, z, s]) => tree(x, z, s));

  // Home: sofa, rug, coffee table with the laptop showing the same appointment, shelves, lamp.
  cylinder(1.9, 1.9, 0.012, c.card, 6, 0, -1.4);
  const sofa = group(6, -2.75);
  box(2.6, 0.42, 0.95, c.sofa, 0, 0.06, 0, sofa);
  box(2.6, 0.55, 0.24, c.sofa, 0, 0.48, -0.36, sofa);
  box(0.22, 0.32, 0.95, c.sofa, -1.3, 0.48, 0, sofa);
  box(0.22, 0.32, 0.95, c.sofa, 1.3, 0.48, 0, sofa);
  box(1.1, 0.14, 0.7, c.card, -0.6, 0.48, 0.05, sofa);
  box(1.1, 0.14, 0.7, c.card, 0.6, 0.48, 0.05, sofa);
  cylinder(0.1, 0.1, 0.4, c.table, 6, 0, -0.9);
  cylinder(0.65, 0.65, 0.05, c.table, 6, 0.4, -0.9);
  const laptop = group(5.98, -0.9);
  box(0.46, 0.02, 0.32, c.metal, 0, 0.45, 0, laptop);
  const lid = place(new THREE.Group(), 0, 0.47, -0.15, laptop);
  lid.rotation.x = -0.32;
  box(0.46, 0.3, 0.015, c.metal, 0, 0, 0, lid);
  place(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), screen), 0, 0.15, 0.009, lid);
  for (const y of [0.9, 1.55, 2.2]) {
    box(0.4, 0.05, 2.2, c.wood, 10.65, y, -1.6);
    let z = -2.55;
    for (let i = 0; z < -0.8; i++) {
      const w = 0.1 + ((i * 7) % 4) * 0.025, h = 0.32 + ((i * 5) % 3) * 0.06;
      box(0.26, h, w, c.books[i % c.books.length], 10.62, y + 0.05, z + w / 2);
      z += w + 0.02;
    }
  }
  cylinder(0.25, 0.25, 0.03, c.metal, 8.7, 0, -3.1);
  cylinder(0.025, 0.025, 1.6, c.metal, 8.7, 0.03, -3.1);
  const shade = new THREE.MeshStandardMaterial({ color: c.lamp, emissive: c.lamp, emissiveIntensity: config.lights.lamp, roughness: 0.6 });
  materials.set("shade", shade);
  place(solid(new THREE.CylinderGeometry(0.22, 0.32, 0.36, 32, 1, true), shade, false), 8.7, 1.78, -3.1);

  // The care thread: core line, soft halo and a glowing head that leads it.
  const curve = new THREE.CatmullRomCurve3(THREAD_PATH.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, "centripetal");
  const glow = (name: string, opacity: number) => {
    const material = new THREE.MeshBasicMaterial({ color: c.accent, transparent: opacity < 1, opacity, depthWrite: opacity === 1 });
    materials.set(`glow:${name}`, material);
    return material;
  };
  const core = place(new THREE.Mesh(new THREE.TubeGeometry(curve, THREAD_SEGMENTS, 0.022, THREAD_SIDES), glow("core", 1)), 0, 0, 0);
  const halo = place(new THREE.Mesh(new THREE.TubeGeometry(curve, THREAD_SEGMENTS, 0.07, THREAD_SIDES), glow("halo", config.opacity.halo)), 0, 0, 0);
  const head = place(new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), glow("head", 1)), 0, 0, 0);
  place(new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), glow("headHalo", config.opacity.headHalo)), 0, 0, 0, head);
  // The light stays in the scene (intensity 0 when idle): toggling visibility would change the light
  // count and force every lit material to recompile mid-scroll.
  const headLight = place(new THREE.PointLight(c.accent, 0, config.lights.glowDistance, 2), 0, 0, 0);

  scene.add(new THREE.HemisphereLight(c.sky, c.homeFloor, config.lights.hemisphere));
  const sun = place(new THREE.DirectionalLight(c.sun, config.lights.sun), -9, 13, 9);
  sun.target.position.set(0, 0, -1);
  scene.add(sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(config.shadowMapSize, config.shadowMapSize);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 9, bottom: -9, near: 1, far: 45 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;

  const setReveal = (fraction: number) => {
    const f = Math.max(0, Math.min(1, fraction));
    const count = Math.round(f * THREAD_SEGMENTS) * THREAD_SIDES * 6;
    core.geometry.setDrawRange(0, count);
    halo.geometry.setDrawRange(0, count);
    head.visible = f > 0;
    head.position.copy(curve.getPointAt(f));
    headLight.position.copy(head.position);
    headLight.intensity = f > 0 ? config.lights.glow : 0;
  };
  setReveal(0);

  const dispose = () => {
    scene.traverse(object => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    materials.forEach(material => material.dispose());
    textures.forEach(texture => texture.dispose());
    sun.shadow.map?.dispose();
  };
  return { scene, setReveal, dispose };
}
