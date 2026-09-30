// The island: a deterministic voxel heightmap with themed zones, built into a few InstancedMeshes.
// World units: 1 unit = 1 voxel. x/z are horizontal, y is up. The island is centred on (0, 0).
import * as THREE from 'three/webgpu';
import { voxelize } from '../three/voxel.js';
import { ART } from '../three/art.js';
import { LAYOUT } from './layout.js';

export const SIZE = 64;          // heightmap resolution (SIZE x SIZE)
const HALF = SIZE / 2;

// Zone centres (x, z) and radii. These are the places the game systems refer to.
export const ZONES = {
  plaza:   { x: 0,   z: 0,   r: 9,  label: 'Geisel Plaza' },
  meadow:  { x: 16,  z: 10,  r: 9,  label: 'Sun God Lawn' },
  camp:    { x: 14,  z: -12, r: 7,  label: 'Jacobs Yard' },
  ice:     { x: -4,  z: -20, r: 8,  label: 'The cold aisle' },
  shadow:  { x: -20, z: 6,   r: 8,  label: 'Eucalyptus grove' },
  peak:    { x: 6,   z: 22,  r: 8,  label: 'Torrey Pines bluff' },
  door:    { x: -14, z: -14, r: 4,  label: 'Sealed door' },
  chamber: { x: -20, z: -18, r: 4.5, label: 'Secret chamber' },
};

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cheap value noise.
function makeNoise(rand) {
  const G = 32;
  const grid = new Float32Array(G * G);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const g = (x, y) => grid[((y % G) + G) % G * G + ((x % G) + G) % G];
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const tx = sm(x - x0), ty = sm(y - y0);
    const a = g(x0, y0), b = g(x0 + 1, y0), c = g(x0, y0 + 1), d = g(x0 + 1, y0 + 1);
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  };
}

const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

/**
 * Builds the island. Returns { group, height, walkable, zoneAt, surfaceY, voxels }.
 *   height(x, z)   -> integer column height (top voxel y) or -Infinity off-island
 *   walkable(x, z) -> bool
 */
export function buildWorld(seed = 7) {
  const rand = mulberry(seed);
  const noise = makeNoise(rand);
  const noise2 = makeNoise(rand);

  // ---- heightmap ----
  const H = new Int8Array(SIZE * SIZE).fill(-128);
  const T = new Uint8Array(SIZE * SIZE); // terrain type
  const TYPE = { GRASS: 1, DIRT: 2, STONE: 3, ICE: 4, SHADOW: 5, ROCK: 6, SAND: 7, PATH: 8 };
  const idx = (x, z) => (z + HALF) * SIZE + (x + HALF);
  const inRange = (x, z) => x >= -HALF && x < HALF && z >= -HALF && z < HALF;

  for (let z = -HALF; z < HALF; z++) {
    for (let x = -HALF; x < HALF; x++) {
      const d = Math.hypot(x, z) / HALF;                       // 0 centre .. 1 edge
      const edge = 0.86 + 0.12 * noise(x * 0.25 + 9, z * 0.25 + 3);
      const dChamber = dist2(x, z, ZONES.chamber.x, ZONES.chamber.z);
      if (d > edge && dChamber > ZONES.chamber.r + 1.5) continue; // sea (the chamber always has ground)
      let h = 2 + Math.round(2.6 * noise(x * 0.11, z * 0.11) + 1.4 * noise2(x * 0.3, z * 0.3) - 1.2);
      let type = TYPE.GRASS;
      // zones shape the terrain
      const dIce = dist2(x, z, ZONES.ice.x, ZONES.ice.z);
      const dPeak = dist2(x, z, ZONES.peak.x, ZONES.peak.z);
      const dShadow = dist2(x, z, ZONES.shadow.x, ZONES.shadow.z);
      const dPlaza = dist2(x, z, ZONES.plaza.x, ZONES.plaza.z);
      if (dPlaza < 7) { h = 3; type = TYPE.PATH; }
      else if (dPlaza < 9) { h = 3; type = TYPE.GRASS; }
      if (dIce < ZONES.ice.r) { h = 4 + Math.round((ZONES.ice.r - dIce) * 0.35); type = TYPE.ICE; }
      if (dPeak < ZONES.peak.r) { h = 4 + Math.round((ZONES.peak.r - dPeak) * 0.7); type = TYPE.ROCK; }
      if (dPeak < 3.5) h = 9;
      if (dShadow < ZONES.shadow.r) { h = Math.max(2, h - 1); type = TYPE.SHADOW; }
      if (dChamber < ZONES.chamber.r + 1.5) { h = 3; type = TYPE.STONE; }
      if (d > edge - 0.08 && type === TYPE.GRASS) type = TYPE.SAND;
      H[idx(x, z)] = Math.max(1, h);
      T[idx(x, z)] = type;
    }
  }
  // paths from the plaza to each zone
  const carve = (ax, az, bx, bz) => {
    const n = Math.ceil(dist2(ax, az, bx, bz));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = Math.round(ax + (bx - ax) * t), pz = Math.round(az + (bz - az) * t);
      for (const [ox, oz] of [[0, 0], [1, 0], [0, 1]]) {
        const x = px + ox, z = pz + oz;
        if (!inRange(x, z) || H[idx(x, z)] === -128) continue;
        if (T[idx(x, z)] === TYPE.GRASS || T[idx(x, z)] === TYPE.SHADOW || T[idx(x, z)] === TYPE.SAND) T[idx(x, z)] = TYPE.PATH;
      }
    }
  };
  for (const k of ['meadow', 'camp', 'ice', 'shadow', 'peak', 'door']) carve(0, 0, ZONES[k].x, ZONES[k].z);
  carve(ZONES.door.x, ZONES.door.z, ZONES.chamber.x, ZONES.chamber.z);
  // smooth cliffs > 2 so everything is reachable (except the peak plateau, on purpose)
  for (let pass = 0; pass < 3; pass++) {
    for (let z = -HALF + 1; z < HALF - 1; z++) for (let x = -HALF + 1; x < HALF - 1; x++) {
      const h = H[idx(x, z)];
      if (h === -128) continue;
      if (dist2(x, z, ZONES.peak.x, ZONES.peak.z) < ZONES.peak.r) continue;
      for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) {
        const nh = H[idx(nx, nz)];
        if (nh === -128) continue;
        if (h - nh > 1) H[idx(x, z)] = nh + 1;
      }
    }
  }

  // level the ground under the landmark plots, with a gentle ramp around each
  for (const pl of LAYOUT.plots) {
    for (let z = Math.floor(pl.cz - pl.hz) - 2; z <= Math.ceil(pl.cz + pl.hz) + 2; z++) {
      for (let x = Math.floor(pl.cx - pl.hx) - 2; x <= Math.ceil(pl.cx + pl.hx) + 2; x++) {
        if (!inRange(x, z) || H[idx(x, z)] === -128) continue;
        const dx = Math.max(0, Math.abs(x - pl.cx) - pl.hx), dz = Math.max(0, Math.abs(z - pl.cz) - pl.hz);
        const ring = Math.max(dx, dz);
        if (ring <= 0) { H[idx(x, z)] = pl.h; T[idx(x, z)] = TYPE[pl.type]; }
        else if (ring <= 2) H[idx(x, z)] = Math.max(pl.h - ring, Math.min(pl.h + ring, H[idx(x, z)]));
      }
    }
  }

  const height = (x, z) => {
    const xi = Math.round(x), zi = Math.round(z);
    if (!inRange(xi, zi)) return -Infinity;
    const h = H[idx(xi, zi)];
    return h === -128 ? -Infinity : h;
  };
  const typeAt = (x, z) => (inRange(Math.round(x), Math.round(z)) ? T[idx(Math.round(x), Math.round(z))] : 0);
  const walkable = (x, z) => height(x, z) > -Infinity;
  const zoneAt = (x, z) => {
    let best = null, bd = Infinity;
    for (const [k, zn] of Object.entries(ZONES)) {
      const d = dist2(x, z, zn.x, zn.z);
      if (d < zn.r && d < bd) { bd = d; best = k; }
    }
    return best;
  };

  // ---- voxel meshes ----
  const group = new THREE.Group();
  const PAL = {
    [TYPE.GRASS]: ['#4fb56b', '#3f9d5a', '#469f5e'],
    [TYPE.DIRT]: ['#8a5a2b', '#6f4622'],
    [TYPE.STONE]: ['#3f4a5c', '#33404f'],
    [TYPE.ICE]: ['#cfe9ff', '#a9d3f5', '#e8f4ff'],
    [TYPE.SHADOW]: ['#2c2a4a', '#3a3563', '#262445'],
    [TYPE.ROCK]: ['#5a3a3a', '#6b4242', '#4a2e2e'],
    [TYPE.SAND]: ['#d9c58a', '#c9b478'],
    [TYPE.PATH]: ['#9b8c72', '#8f8168', '#a3947a'],
  };
  const cells = [];
  for (let z = -HALF; z < HALF; z++) for (let x = -HALF; x < HALF; x++) {
    const h = H[idx(x, z)];
    if (h === -128) continue;
    const t = T[idx(x, z)];
    // top block gets the zone colour; a few blocks below are dirt/stone; the rim shows a skirt
    let low = h - 2;
    for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) {
      const nh = inRange(nx, nz) ? H[idx(nx, nz)] : -128;
      if (nh === -128) low = Math.min(low, h - 7);           // island edge skirt
      else low = Math.min(low, nh);
    }
    for (let y = Math.max(-6, low); y <= h; y++) {
      const kind = y === h ? t : y >= h - 1 && t !== TYPE.ROCK && t !== TYPE.ICE && t !== TYPE.STONE ? TYPE.DIRT : (t === TYPE.ICE ? TYPE.ICE : t === TYPE.ROCK ? TYPE.ROCK : TYPE.STONE);
      const p = PAL[kind];
      cells.push(x, y, z, p[Math.abs(x * 7 + z * 13 + y * 3) % p.length]);
    }
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  const terrain = new THREE.InstancedMesh(box, new THREE.MeshStandardNodeMaterial({ roughness: 0.92 }), cells.length / 4);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  for (let i = 0; i < cells.length; i += 4) {
    m.makeTranslation(cells[i], cells[i + 1], cells[i + 2]);
    terrain.setMatrixAt(i / 4, m);
    terrain.setColorAt(i / 4, c.set(cells[i + 3]));
  }
  terrain.receiveShadow = true;
  terrain.castShadow = true;
  group.add(terrain);

  // ---- props: trees, ice crystals, dead trees, torches, the tower ----
  const props = [];
  // Trees of the campus: Torrey pines (lopsided, needles in tufts), palms, eucalyptus. `dark` is the
  // night-time eucalyptus grove where Reviewer #2 lurks.
  const tuft = (cx, cy, cz, r, cols) => {
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.abs(dx) + Math.abs(dz) > r + (r > 1 ? 1 : 0)) continue;
      if (Math.abs(dx) === r && Math.abs(dz) === r) continue;
      props.push(cx + dx, cy, cz + dz, cols[Math.floor(rand() * cols.length)]);
      if (Math.abs(dx) + Math.abs(dz) <= r - 1) props.push(cx + dx, cy + 1, cz + dz, cols[Math.floor(rand() * cols.length)]);
    }
  };
  const addPine = (x, z) => {
    const h = height(x, z);
    if (h === -Infinity) return;
    const th = 5 + Math.floor(rand() * 3);
    const lean = rand() < 0.5 ? 1 : -1;
    const axis = rand() < 0.5;
    let ox = 0, oz = 0;
    for (let y = 1; y <= th; y++) {
      if (y === 3 || y === 5) { if (axis) ox += lean; else oz += lean; }
      props.push(x + ox, h + y, z + oz, y % 2 ? '#6a4a2e' : '#5a3d25');
    }
    const cols = ['#2f6b3a', '#3a7d44', '#28583a'];
    tuft(x + ox, h + th, z + oz, 2, cols);
    tuft(x + ox + (axis ? -lean * 2 : 1), h + th - 2, z + oz + (axis ? 1 : -lean * 2), 1, cols);
    tuft(x + ox + (axis ? lean * 2 : -1), h + th - 3, z + oz + (axis ? -1 : lean * 2), 1, cols);
  };
  const addPalm = (x, z) => {
    const h = height(x, z);
    if (h === -Infinity) return;
    const th = 6 + Math.floor(rand() * 3);
    const dir = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rand() * 4)];
    let ox = 0, oz = 0;
    for (let y = 1; y <= th; y++) {
      if (y === 4 || y === 6) { ox += dir[0]; oz += dir[1]; }
      props.push(x + ox, h + y, z + oz, y % 2 ? '#9a7a52' : '#8a6a45');
    }
    const top = h + th;
    const frond = ['#3aa35a', '#2f8f4e', '#46b566'];
    props.push(x + ox, top + 1, z + oz, frond[0]);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      props.push(x + ox + dx, top + 1, z + oz + dz, frond[Math.floor(rand() * 3)]);
      props.push(x + ox + dx * 2, top + 1, z + oz + dz * 2, frond[Math.floor(rand() * 3)]);
      props.push(x + ox + dx * 3, top, z + oz + dz * 3, frond[Math.floor(rand() * 3)]);
    }
  };
  const addEucalyptus = (x, z, dark = false) => {
    const h = height(x, z);
    if (h === -Infinity) return;
    const th = 7 + Math.floor(rand() * 3);
    const trunk = dark ? ['#3b3358', '#2b2440'] : ['#d9d2c3', '#c9c0ac'];
    const leaf = dark ? ['#4c3a7a', '#5b4791', '#3f3266'] : ['#7fa08c', '#93b39f', '#6f9080'];
    for (let y = 1; y <= th; y++) props.push(x, h + y, z, trunk[y % 2]);
    for (const [dx, dy, dz] of [[0, 0, 0], [1, -1, 0], [-1, -2, 0], [0, -2, 1], [0, -3, -1], [1, -4, 1]]) tuft(x + dx * 1, h + th + dy, z + dz * 1, dy === 0 ? 2 : 1, leaf);
  };
  const placed = [];
  const tryPlace = (zoneKey, count, minGap, cb, rMin = 2) => {
    const zn = ZONES[zoneKey];
    let tries = 0;
    for (let n = 0; n < count && tries < 200; tries++) {
      const a = rand() * Math.PI * 2, r = rMin + rand() * Math.max(0.5, zn.r - 0.5 - rMin);
      const x = Math.round(zn.x + Math.cos(a) * r), z = Math.round(zn.z + Math.sin(a) * r);
      if (!walkable(x, z) || typeAt(x, z) === TYPE.PATH) continue;
      if (placed.some(([px, pz]) => dist2(px, pz, x, z) < minGap)) continue;
      placed.push([x, z]);
      cb(x, z);
      n++;
    }
  };
  // keep the Sun God lawn, the mailbox and the pier's landing clear so they can be seen
  const clearSpot = (x, z) => [[LAYOUT.sungod.x, LAYOUT.sungod.z, 7], [LAYOUT.mailbox.x, LAYOUT.mailbox.z, 5], [LAYOUT.pier.x, LAYOUT.pier.z, 6], [LAYOUT.cse.x, LAYOUT.cse.z + 6, 9]].some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r);
  tryPlace('meadow', 5, 3.2, (x, z) => { if (!clearSpot(x, z)) addPalm(x, z); });
  tryPlace('meadow', 4, 3.2, (x, z) => { if (!clearSpot(x, z)) addPine(x, z); });
  tryPlace('camp', 3, 3.2, (x, z) => addPine(x, z));
  tryPlace('camp', 2, 3.2, (x, z) => addEucalyptus(x, z));
  // the grove keeps clear of the Second Gate's lawn in the north
  tryPlace('shadow', 10, 2.5, (x, z) => { if (z > 3) addEucalyptus(x, z, true); });
  // plaza trees stand on the rim so the walking area stays open
  for (let i = 0; i < 3; i++) tryPlace('plaza', 1, 3, (x, z) => { if (z < -3 && Math.abs(x) < 8) addPalm(x, z); }, 7);
  for (let i = 0; i < 3; i++) tryPlace('plaza', 1, 3, (x, z) => { if (z < -3 && Math.abs(x) < 8) addPine(x, z); }, 7);
  // (the library tower is built by stage.js so it can be animated and highlighted)
  const propMesh = new THREE.InstancedMesh(box, new THREE.MeshStandardNodeMaterial({ roughness: 0.85 }), props.length / 4);
  for (let i = 0; i < props.length; i += 4) {
    m.makeTranslation(props[i], props[i + 1], props[i + 2]);
    propMesh.setMatrixAt(i / 4, m);
    propMesh.setColorAt(i / 4, c.set(props[i + 3]));
  }
  propMesh.castShadow = true;
  propMesh.receiveShadow = true;
  group.add(propMesh);

  // Blocked cells: tower footprint and tree trunks.
  const blocked = new Set();
  for (let x = -3; x <= 3; x++) for (let z = -4; z <= 2; z++) blocked.add(`${x},${z}`);
  for (const [x, z] of placed) blocked.add(`${x},${z}`);

  // The secret chamber: a stone ring wall with one gate facing the sealed-door zone. The gate
  // cells stay blocked (and the gate voxels visible) until the three runes unseal it.
  const ch = ZONES.chamber;
  const gateAngle = Math.atan2(ZONES.door.z - ch.z, ZONES.door.x - ch.x);
  const gate = { x: Math.round(ch.x + Math.cos(gateAngle) * ch.r), z: Math.round(ch.z + Math.sin(gateAngle) * ch.r), facing: Math.atan2(Math.cos(gateAngle), Math.sin(gateAngle)) };
  const wallCells = [], gateCells = [];
  for (let z = Math.floor(ch.z - ch.r - 1); z <= Math.ceil(ch.z + ch.r + 1); z++) for (let x = Math.floor(ch.x - ch.r - 1); x <= Math.ceil(ch.x + ch.r + 1); x++) {
    const d = dist2(x, z, ch.x, ch.z);
    if (d < ch.r - 0.5 || d > ch.r + 0.5 || height(x, z) === -Infinity) continue;
    (dist2(x, z, gate.x, gate.z) <= 1.2 ? gateCells : wallCells).push([x, z]);
  }
  const wallVox = [];
  for (const [x, z] of wallCells) { const hy = height(x, z); for (let y = 1; y <= 4; y++) wallVox.push(x, hy + y, z, y === 4 ? '#4b5568' : (x + z) % 2 ? '#3a4356' : '#333b4c'); blocked.add(`${x},${z}`); }
  const gateVox = [];
  for (const [x, z] of gateCells) { const hy = height(x, z); for (let y = 1; y <= 4; y++) gateVox.push(x, hy + y, z, y === 4 ? '#4b5568' : '#2b2f45'); }
  const wallMesh = new THREE.InstancedMesh(box, new THREE.MeshStandardNodeMaterial({ roughness: 0.9 }), Math.max(1, wallVox.length / 4));
  for (let i = 0; i < wallVox.length; i += 4) { m.makeTranslation(wallVox[i], wallVox[i + 1], wallVox[i + 2]); wallMesh.setMatrixAt(i / 4, m); wallMesh.setColorAt(i / 4, c.set(wallVox[i + 3])); }
  wallMesh.count = wallVox.length / 4;
  wallMesh.castShadow = wallMesh.receiveShadow = true;
  group.add(wallMesh);
  const gateMesh = new THREE.InstancedMesh(box, new THREE.MeshStandardNodeMaterial({ roughness: 0.9 }), Math.max(1, gateVox.length / 4));
  for (let i = 0; i < gateVox.length; i += 4) { m.makeTranslation(gateVox[i], gateVox[i + 1], gateVox[i + 2]); gateMesh.setMatrixAt(i / 4, m); gateMesh.setColorAt(i / 4, c.set(gateVox[i + 3])); }
  gateMesh.count = gateVox.length / 4;
  gateMesh.castShadow = gateMesh.receiveShadow = true;
  group.add(gateMesh);
  const sealChamber = (on) => {
    gateMesh.visible = on;
    for (const [x, z] of gateCells) { if (on) blocked.add(`${x},${z}`); else blocked.delete(`${x},${z}`); }
  };
  // Ice crystals (emissive) and rune-door cliff marker are placed by entities.js; here only static decor.
  const crystals = new THREE.Group();
  tryPlace('ice', 6, 2.5, (x, z) => {
    const g = voxelize(ART.crystal, { maxHalf: 1, bevel: 0, glow: { V: 1.4, v: 0.8, W: 2.2 } });
    g.scale.setScalar(0.4 + rand() * 0.3);
    g.position.set(x, height(x, z) + 0.5, z);
    g.rotation.y = rand() * 6.28;
    crystals.add(g);
  });
  group.add(crystals);

  // Sea: a flat dark disc under the island.
  const sea = new THREE.Mesh(new THREE.CircleGeometry(HALF * 1.6, 48), new THREE.MeshStandardNodeMaterial({ color: '#0a1428', roughness: 0.2, metalness: 0.1 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -7;
  sea.receiveShadow = true;
  group.add(sea);

  const surfaceY = (x, z) => height(x, z) + 0.5;
  const isBlocked = (x, z) => blocked.has(`${Math.round(x)},${Math.round(z)}`);
  const block = (x, z) => blocked.add(`${Math.round(x)},${Math.round(z)}`);
  const unblock = (x, z) => blocked.delete(`${Math.round(x)},${Math.round(z)}`);
  return { group, height, walkable, zoneAt, typeAt, surfaceY, isBlocked, block, unblock, sealChamber, gate, voxels: cells.length / 4 + props.length / 4, TYPE, rand };
}
