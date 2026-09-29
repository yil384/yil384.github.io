// Voxel actors: sprite meshes on the island with frame animation, facing and hit flash.
import * as THREE from 'three/webgpu';
import { voxelSprite } from '../three/voxel.js';
import { ART, VARIANTS } from '../three/art.js';

const DEFAULT_GLOW = {
  scholar: { G: 0.7 }, bit: { A: 2.2, a: 1.2 }, sparkit: { Z: 2.5, W: 0.6 }, voltrix: { Z: 2.5, z: 1.5, W: 0.6 },
  emberling: { F: 3, f: 1.5 }, pyrelion: { M: 1.6, m: 1.2 }, tidefin: { W: 0.5 }, wyrmlet: { G: 2.5, W: 0.8 },
  oracle: { G: 3, W: 1.2 }, golem: { C: 4 }, mage: { G: 3, o: 1.2, O: 2 }, dragon: { T: 3, Y: 0.4 },
  bat: { W: 3 }, skeleton: { R: 4 }, 'slime-dark': { k: 3 }, token: { W: 2.5, G: 1.2 }, crystal: { V: 2, v: 1, W: 3 },
  robot: { C: 3, O: 1.5 }, cartographer: { Y: 3 }, owl: { Y: 0.6 }, door: { R: 0 },
};

/** Build a voxel actor. Returns a Group whose origin is the feet centre. */
export function makeActor(name, { scale = 0.2, glow = null, maxHalf = 2 } = {}) {
  const base = VARIANTS[name] ? VARIANTS[name][0] : name;
  const overrides = VARIANTS[name] ? VARIANTS[name][1] : null;
  const art = ART[base];
  if (!art) throw new Error(`unknown actor ${name}`);
  const g = voxelSprite(art, { overrides, glow: glow || DEFAULT_GLOW[name] || DEFAULT_GLOW[base] || {}, maxHalf, bevel: 0 });
  g.scale.setScalar(scale);
  g.userData.name = name;
  g.userData.height = art.frames[0].length * scale;
  g.userData.width = Math.max(...art.frames[0].map((r) => r.length)) * scale;
  for (const f of g.userData.frames) { f.castShadow = true; f.receiveShadow = false; }
  return g;
}

/** Flash an actor white for a moment (hit feedback). */
const flashing = new Map();
export function flash(group, ms = 140) {
  for (const f of group.userData.frames) {
    if (!f.material.userData.base) f.material.userData.base = f.material.emissiveNode;
  }
  const until = performance.now() + ms;
  flashing.set(group, until);
  group.traverse((o) => { if (o.isInstancedMesh) o.material.emissiveIntensity = 1; });
  group.userData.flashUntil = until;
  group.scale.multiplyScalar(1.12);
  setTimeout(() => {
    group.scale.divideScalar(1.12);
    flashing.delete(group);
  }, ms);
}

/** A flat ground decal (ring) that fades out. */
export function makeRing(color = '#f2b84b', radius = 1.5) {
  const geo = new THREE.RingGeometry(radius * 0.8, radius, 32);
  const mat = new THREE.MeshBasicNodeMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  return m;
}

/** A small emissive orb used for projectiles. */
const orbGeo = new THREE.SphereGeometry(0.28, 10, 8);
export function makeOrb(color = '#fb923c', size = 1) {
  const mat = new THREE.MeshStandardNodeMaterial({ color, roughness: 0.4, emissive: color, emissiveIntensity: 2.2 });
  const m = new THREE.Mesh(orbGeo, mat);
  m.scale.setScalar(size);
  return m;
}
