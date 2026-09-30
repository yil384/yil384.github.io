// Door markers: every hub door to a region gets a coloured ring on the ground, a signpost with the
// region's name (painted into the shared sign atlas) and, in play mode, a thin light beacon you can
// spot from across the island. Doors you have not been through yet pulse; visited ones glow steady
// and their sign ticks. All rings are one instanced mesh, all beacons another.
import * as THREE from 'three/webgpu';
import { time, uv, float, sin, instancedBufferAttribute, smoothstep, vec3 } from 'three/tsl';
import { doorList } from './travel.js';
import { LAYOUT } from './layout.js';
import { regionName } from './regions.js';
import { ROAD, hasItem } from './road.js';
import { S } from './state.js';
import { on } from './bus.js';
import { mode } from './mode.js';

const PI = Math.PI;

/** Where each door's ring, sign and beacon go (world coordinates). */
export function doorMarkSpecs() {
  const flagOf = Object.fromEntries(LAYOUT.flags.map((f) => [f.id, f]));
  const flagFor = { samsung: 'flag-samsung', metabit: 'flag-metabit', timi: 'flag-tencent', hotstar: 'flag-hotstar', lark: 'flag-lark' };
  const M = LAYOUT.monuments, G = LAYOUT.gate, C = LAYOUT.cse, T = LAYOUT.tower;
  return doorList().map((d) => {
    const f = flagFor[d.to] ? flagOf[flagFor[d.to]] : null;
    const colour = d.colour;
    let sign, ring = 1.8, beacon = [d.x, d.z];
    if (f) { sign = { x: f.x - 1.1, z: f.z + 1.3, yaw: 0, w: 2.4, h: 0.62, y: 0.95, post: 0 }; ring = 1.35; }
    else if (d.to === 'tsinghua') { sign = { x: G.x + 5, z: G.z - 2.6, yaw: PI, w: 3.2, h: 0.85, y: 2.1, post: 2 }; ring = 1.5; }
    else if (d.to === 'picasso') { sign = { x: C.x + 4, z: C.z + 5.4, yaw: 0, w: 3, h: 0.8, y: 2, post: 2 }; ring = 1.7; }
    else if (d.to === 'stacks') { sign = { x: T.x - 3.2, z: T.z + 4.8, yaw: 0, w: 3, h: 0.8, y: 2, post: 2 }; ring = 1.6; }
    else {
      const m = M[d.to];
      const yaw = m?.yaw ?? PI;
      sign = { x: d.x + (d.to === 'im' ? 5.8 : 3.4), z: d.z - 1.8, yaw, w: 3, h: 0.8, y: 2, post: 2 };
      ring = d.to === 'im' ? 3.2 : 2.6;
    }
    return { door: d, to: d.to, colour, ring, sign, beacon };
  });
}

const subFor = (to, walk) => {
  const items = ROAD.filter((r) => r.region === to);
  const got = items.filter((r) => hasItem(r.id)).length;
  if (S.world.discovered?.[to]) return items.length && got === items.length ? `★ ${items[0].kind} earned` : '✓ visited · E to return';
  return walk ? 'Walk through the arch' : 'New · press E';
};

/** Sign specs for the atlas and the voxel posts under them. */
export function doorSigns(world) {
  const signs = [], cells = [];
  for (const m of doorMarkSpecs()) {
    const s = m.sign;
    const gy = world.height(s.x, s.z);
    if (!(gy > -Infinity)) continue;
    signs.push({ id: `door:${m.to}`, text: regionName(m.to), sub: subFor(m.to, m.door.walk), colour: m.colour, x: s.x, y: gy + 0.5 + s.y, z: s.z, yaw: s.yaw, w: s.w, h: s.h });
    const px = Math.round(s.x), pz = Math.round(s.z);
    for (let y = 1; y <= s.post; y++) cells.push([px, gy + y, pz, '#3b4256', 0]);
    if (s.post) {
      // a thin board backing so the sign reads as a solid object from the side
      const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
      for (let k = -1; k <= 1; k++) cells.push([Math.round(s.x + k * c), gy + s.post + 1, Math.round(s.z - k * sn), '#1f2937', 0]);
    } else cells.push([px, gy + 1, pz, '#1f2937', 0]);
  }
  return { signs, cells };
}

/** Rings and beacons; call after the sign atlas exists (signsApi.redraw keeps the signs current). */
export function buildDoorMarks(world, parent, signsApi) {
  const specs = doorMarkSpecs();
  const n = specs.length;
  const fresh = new Float32Array(n);
  const freshAttr = new THREE.InstancedBufferAttribute(fresh, 1);
  const col = new THREE.Color();
  const m4 = new THREE.Matrix4();

  // rings: one flat annulus, scaled per door
  const ringGeo = new THREE.RingGeometry(0.82, 1, 48, 1);
  ringGeo.rotateX(-PI / 2);
  const ringMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
  const fr = instancedBufferAttribute(freshAttr, 'float');
  const pulse = sin(time.mul(2.4)).mul(0.5).add(0.5);
  ringMat.opacityNode = float(0.55).add(fr.mul(pulse).mul(0.4));
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, n);
  // beacons: a thin column of light that fades upward (play mode only)
  const beamGeo = new THREE.CylinderGeometry(0.28, 0.4, 16, 8, 1, true);
  beamGeo.translate(0, 8, 0);
  const beamMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  beamMat.opacityNode = smoothstep(float(1), float(0), uv().y).mul(float(0.16).add(fr.mul(pulse).mul(0.16)));
  const beams = new THREE.InstancedMesh(beamGeo, beamMat, n);
  specs.forEach((m, i) => {
    const y = world.surfaceY(m.door.x, m.door.z) + 0.07;
    m4.makeScale(m.ring, 1, m.ring).setPosition(m.door.x, y, m.door.z);
    rings.setMatrixAt(i, m4);
    m4.makeTranslation(m.beacon[0], y, m.beacon[1]);
    beams.setMatrixAt(i, m4);
    col.set(m.colour);
    rings.setColorAt(i, col);
    beams.setColorAt(i, col);
  });
  rings.frustumCulled = beams.frustumCulled = false;
  rings.castShadow = beams.castShadow = false;
  rings.name = 'door-rings'; beams.name = 'door-beacons';
  parent.add(rings, beams);
  ringMat.colorNode = vec3(1, 1, 1);
  beamMat.colorNode = vec3(1, 1, 1);

  const sync = () => {
    specs.forEach((m, i) => { fresh[i] = S.world.discovered?.[m.to] ? 0 : 1; });
    freshAttr.needsUpdate = true;
    for (const m of specs) signsApi?.redraw(`door:${m.to}`, { sub: subFor(m.to, m.door.walk) });
  };
  sync();
  on('region:discovered', sync);
  on('road:item', sync);
  const showBeams = () => { beams.visible = !!mode.play; };
  showBeams();
  on('mode', showBeams);
  return { rings, beams, specs, sync };
}
