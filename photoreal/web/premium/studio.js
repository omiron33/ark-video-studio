// A product-photography studio built in code: reflections from a lit room, soft boxes, a rim light
// and a floor, plus physically based material presets for hero objects. Import from a premium
// scene: import { studio, materials } from '/premium/studio.js';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

let areaReady = false;

// studio(renderer, scene, { background, envIntensity, key, fill, rim, floor })
//   background: [r,g,b] linear (default near-black)
//   key/fill:   soft boxes { pos, size: [w,h], intensity, color, target }
//   rim:        { pos, intensity, color, target, angle }
//   floor:      'mirror' | 'gloss' | 'matte' | false, at y = floorY
export function studio(renderer, scene, o = {}) {
  if (!areaReady) { RectAreaLightUniformsLib.init(); areaReady = true; }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  scene.environment = env;
  scene.environmentIntensity = o.envIntensity ?? 0.6;
  scene.background = new THREE.Color(...(o.background ?? [0.004, 0.004, 0.005]));
  const lights = {};
  const box = (b, name) => {
    if (!b) return;
    const l = new THREE.RectAreaLight(new THREE.Color(...(b.color ?? [1, 0.97, 0.92])), b.intensity ?? 6, ...(b.size ?? [2, 1]));
    l.position.set(...b.pos); l.lookAt(new THREE.Vector3(...(b.target ?? [0, 0, 0])));
    scene.add(l); lights[name] = l;
  };
  box(o.key ?? { pos: [-2.5, 2.5, 2.5], size: [2.4, 1.4], intensity: 8 }, 'key');
  box(o.fill === undefined ? { pos: [3, 1.5, 2], size: [3, 2], intensity: 1.5, color: [0.85, 0.9, 1] } : o.fill, 'fill');
  const rim = o.rim ?? { pos: [0, 2.5, -3.5], intensity: 40, color: [1, 0.95, 0.9], angle: 0.6 };
  if (rim) {
    const s = new THREE.SpotLight(new THREE.Color(...(rim.color ?? [1, 1, 1])), rim.intensity ?? 40, 0, rim.angle ?? 0.6, 0.6, 2);
    s.position.set(...rim.pos); s.target.position.set(...(rim.target ?? [0, 0, 0]));
    scene.add(s, s.target); lights.rim = s;
  }
  const y = o.floorY ?? 0;
  if (o.floor === 'mirror') {
    const m = new Reflector(new THREE.PlaneGeometry(40, 40), { textureWidth: 1920, textureHeight: 1080, color: new THREE.Color(0.08, 0.08, 0.09) });
    m.rotation.x = -Math.PI / 2; m.position.y = y; scene.add(m); lights.floor = m;
  } else if (o.floor !== false) {
    const glossy = (o.floor ?? 'gloss') === 'gloss';
    const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: glossy ? 0.18 : 0.8, metalness: 0, clearcoat: glossy ? 1 : 0, clearcoatRoughness: 0.08 }));
    m.rotation.x = -Math.PI / 2; m.position.y = y; scene.add(m); lights.floor = m;
  }
  return { env, lights };
}

// Physically based presets; pass overrides, e.g. materials.gold({ roughness: 0.3 }).
const P = (base) => (o = {}) => new THREE.MeshPhysicalMaterial({ ...base, ...o });
export const materials = {
  lacquer: P({ color: 0x050505, roughness: 0.25, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03 }),
  glass: P({ color: 0xffffff, roughness: 0.02, metalness: 0, transmission: 1, thickness: 0.4, ior: 1.5, specularIntensity: 1 }),
  gold: P({ color: 0xe0b060, roughness: 0.18, metalness: 1 }),
  silver: P({ color: 0xd8d8dc, roughness: 0.12, metalness: 1 }),
  brushed: P({ color: 0xb8b8bc, roughness: 0.38, metalness: 1, anisotropy: 0.8 }),
  porcelain: P({ color: 0xf2efe8, roughness: 0.32, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.15, sheen: 0.2 }),
  wine: P({ color: 0x5a0812, roughness: 0.05, metalness: 0, transmission: 0.85, thickness: 1.2, ior: 1.34, attenuationColor: new THREE.Color(0.35, 0.0, 0.03), attenuationDistance: 0.25 }),
  emissive: (color = [1, 0.6, 0.2], intensity = 4) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(...color), emissiveIntensity: intensity }),
};
