// The UCSD island: a deterministic voxel heightmap with themed zones, set in a round diorama of sea.
// World units: 1 unit = 1 voxel. x/z are horizontal, y is up; the island is centred on (0, 0), +x is
// the ocean side (the Scripps cove and pier, the mesa and Black's Beach), -x the eucalyptus forest.
//
// The core (Geisel plaza, CSE, the Snake Path, the camp, the monuments, Sun God lawn) keeps the shape
// it always had; around it grows the outer campus (Library Walk, Price Center, RIMAC, Warren Mall,
// the Torrey Pines mesa and gliderport) with a shuttle loop road. districts.js builds the buildings.
//
// Rendering: the terrain is ONE merged mesh of visible faces with baked ambient occlusion and strata
// on every cliff (no hidden cube faces); trees and other static scenery collect into `statics` and
// are baked into one more merged mesh by bake(); the sea is water.js.
import * as THREE from 'three/webgpu';
import { LAYOUT, loopPath } from './layout.js';
import { voxMesh, GeoWriter, rgb, AO } from './voxmesh.js';
import { mergeSprites } from './actors.js';
import { buildWater } from './water.js';

export const SIZE = 128;          // heightmap resolution (SIZE x SIZE)
const HALF = SIZE / 2;
export const DISC = 61;           // radius of the diorama: land, then sea, then the strata rim
export const WATER = 0.3;         // sea level (y of the water surface)
const VOID = -128;
const WALL_BOTTOM = -12;

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
  // the outer campus
  libwalk: { x: -8,  z: 22,  r: 7,  label: 'Library Walk' },
  price:   { x: -9,  z: 41,  r: 9,  label: 'Price Center' },
  forest:  { x: -42, z: 2,   r: 17, label: 'Eucalyptus forest' },
  rimac:   { x: -16, z: -39, r: 11, label: 'RIMAC Arena' },
  warren:  { x: 13,  z: -42, r: 11, label: 'Warren Mall · Jacobs School' },
  glider:  { x: 40,  z: -28, r: 8,  label: 'Torrey Pines Gliderport' },
  blacks:  { x: 47,  z: -32, r: 5,  label: 'Black’s Beach' },
  scripps: { x: 40,  z: 7,   r: 8,  label: 'Scripps Pier' },
  bluff:   { x: 35,  z: 33,  r: 11, label: 'La Jolla bluffs' },
};

// District labels for the maps (a subset of the zones, with a map position).
export const DISTRICTS = [
  ['plaza', 'Geisel'], ['libwalk', 'Library Walk'], ['price', 'Price Center'], ['forest', 'Eucalyptus forest'],
  ['rimac', 'RIMAC'], ['warren', 'Warren Mall'], ['glider', 'Gliderport'], ['blacks', 'Black’s Beach'],
  ['scripps', 'Scripps Pier'], ['bluff', 'La Jolla bluffs'], ['meadow', 'Sun God Lawn'], ['camp', 'Jacobs Yard'],
  ['peak', 'Torrey Pines'], ['shadow', 'The grove'],
];

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
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const hashI = (x, y, z) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export const TYPE = { GRASS: 1, DIRT: 2, STONE: 3, ICE: 4, SHADOW: 5, ROCK: 6, SAND: 7, PATH: 8, ROAD: 9, DRY: 10, FOREST: 11, PAVE: 12, FIELD: 13, SEABED: 14, WET: 15 };
// Top colours per type (the first is the map colour).
export const PAL = {
  [TYPE.GRASS]: ['#4fb56b', '#47aa62', '#57bd72', '#4aa565'],
  [TYPE.DIRT]: ['#8f6a45', '#846040', '#98714a'],
  [TYPE.STONE]: ['#5f6878', '#56606f', '#687182'],
  [TYPE.ICE]: ['#cfe9ff', '#a9d3f5', '#e8f4ff'],
  [TYPE.SHADOW]: ['#24402f', '#2a4a36', '#1f3a2b'],
  [TYPE.ROCK]: ['#6b4444', '#5a3a3a', '#7a4d4a'],
  [TYPE.SAND]: ['#e2cf93', '#d9c587', '#e8d8a3'],
  [TYPE.PATH]: ['#a8997d', '#9d8f74', '#b0a185'],
  [TYPE.ROAD]: ['#40444f', '#3b3f49', '#454954'],
  [TYPE.DRY]: ['#939556', '#9f9d5e', '#868b4e', '#a39a63'],
  [TYPE.FOREST]: ['#2f5b3b', '#356542', '#2a523a'],
  [TYPE.PAVE]: ['#cbc3b2', '#c1b9a8', '#d5cdbc'],
  [TYPE.FIELD]: ['#4cc15f', '#44b457'],
  [TYPE.SEABED]: ['#b09a68', '#a38e5e', '#b8a473'],
  [TYPE.WET]: ['#b8a574', '#ad9a6b'],
};
const DECO = { 1: '#f0cf4f', 2: '#eef2f6', 3: '#9a8f7c', 4: '#b8583f', 5: '#2f3440' };
// Cliff strata by height (bands wobble a little per column): basalt, shale, browns, sandstone, a rust band, cream.
const STRATA = [
  [-8, ['#2c313c', '#323846']], [-5, ['#463d4c', '#40374a']], [-2, ['#5c4a3f', '#554438']], [0, ['#7d5e43', '#73563d']],
  [2, ['#a57c52', '#9a734c']], [4, ['#c29a6a', '#b89060']], [6, ['#d4b284', '#caa87a']], [7, ['#a9634a', '#9c5a43']],
  [9, ['#d9bf93', '#cfb588']], [99, ['#bf9d73', '#b39368']],
];
const strata = (x, y, z) => {
  const w = hashI(x >> 2, 7, z >> 2) < 0.3 ? 1 : 0;
  const yy = y + w;
  for (const [top, cols] of STRATA) if (yy <= top) return cols[hashI(x, y, z) < 0.5 ? 0 : 1];
  return STRATA[STRATA.length - 1][1][0];
};

/**
 * Builds the island. Returns { group, height, walkable, zoneAt, surfaceY, grid, statics, bake(), ... }.
 *   height(x, z)   -> integer column height (top voxel y) or -Infinity off-island / deep water
 *   walkable(x, z) -> bool
 */
export function buildWorld(seed = 7, { lowfx = false } = {}) {
  const t0 = performance.now();
  const rand = mulberry(seed);
  const noise = makeNoise(rand);
  const noise2 = makeNoise(rand);
  const rand2 = mulberry(seed * 31 + 5);
  const noise3 = makeNoise(rand2);
  const noise4 = makeNoise(rand2);

  const N = SIZE * SIZE;
  const H = new Int16Array(N).fill(VOID);      // collision heights (VOID: sea too deep to wade, or off the map)
  const HV = new Int16Array(N).fill(VOID);     // what is drawn (the deep sea floor too)
  const T = new Uint8Array(N);                 // terrain type
  const D = new Uint8Array(N);                 // decoration on the top face (road dashes, pitch lines…)
  const FIX = new Uint8Array(N);               // 1: plot/landform (never smoothed), 2: road
  const LAND = new Uint8Array(N);
  const idx = (x, z) => (z + HALF) * SIZE + (x + HALF);
  const inRange = (x, z) => x >= -HALF && x < HALF && z >= -HALF && z < HALF;
  const inDisc = (x, z) => x * x + z * z < DISC * DISC;
  const land = (x, z) => inRange(x, z) && LAND[idx(x, z)] === 1;

  // ---------------------------------------------------------------- the coastline
  const plots = LAYOUT.plots;
  const nearPlot = (x, z, m) => plots.some((p) => Math.abs(x - p.cx) <= p.hx + m && Math.abs(z - p.cz) <= p.hz + m);
  const coastR = (x, z) => {
    const a = Math.atan2(z, x);
    return 49.5 + 9 * (noise3(Math.cos(a) * 2.4 + 8, Math.sin(a) * 2.4 + 8) - 0.5) + 2.4 * (noise4(x * 0.18 + 3, z * 0.18) - 0.5);
  };
  const M = LAYOUT.mesa;
  const mesaSector = (x, z) => x >= 30 && z <= -16;
  const bayX = (z) => 31 + 0.07 * (z - 6) ** 2;          // the Scripps cove, east of the pier landing
  for (let z = -HALF; z < HALF; z++) for (let x = -HALF; x < HALF; x++) {
    const r = Math.hypot(x, z);
    let on = false;
    if (r > DISC - 3.5) on = false;
    else if (z > -15 && z < 27 && x > bayX(z)) on = false;
    else if (mesaSector(x, z)) on = r <= 57;
    else on = r <= coastR(x, z) || (nearPlot(x, z, 3) && r < DISC - 5);
    LAND[idx(x, z)] = on ? 1 : 0;
  }
  // distance (in cells, 8-neighbour) to the other side of the coastline
  const bfs = (fromLand) => {
    const d = new Int16Array(N).fill(99);
    const q = [];
    for (let z = -HALF; z < HALF; z++) for (let x = -HALF; x < HALF; x++) {
      const i = idx(x, z);
      if ((LAND[i] === 1) !== fromLand) { d[i] = 0; q.push(i); }
    }
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = (i % SIZE) - HALF, z = Math.floor(i / SIZE) - HALF;
      if (d[i] >= 14) continue;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, nz = z + dz;
        if (!inRange(nx, nz)) continue;
        const j = idx(nx, nz);
        if (d[j] > d[i] + 1) { d[j] = d[i] + 1; q.push(j); }
      }
    }
    return d;
  };
  const coastD = bfs(true);    // land cells: distance to the sea
  const seaD = bfs(false);     // sea cells: distance to land
  const cliffy = (x, z) => {
    if (z > -15 && z < 27 && x > 16) return false;          // the cove's beaches
    if (z > 38 && x > -24 && x < 8) return false;            // the shore below Price Center
    if (x > 22 && z > 22) return true;                       // the bluffs
    if (z < -44) return true;                                // north cliffs
    const a = Math.atan2(z, x);
    return noise4(Math.cos(a) * 3 + 2, Math.sin(a) * 3 + 2) > 0.5;
  };

  // ---------------------------------------------------------------- heights and types
  for (let z = -HALF; z < HALF; z++) for (let x = -HALF; x < HALF; x++) {
    const i = idx(x, z);
    if (!LAND[i]) continue;
    const r = Math.hypot(x, z);
    let h = 2 + Math.round(2.6 * noise(x * 0.11, z * 0.11) + 1.4 * noise2(x * 0.3, z * 0.3) - 1.2);
    const k = smooth(28, 42, r);
    if (k > 0) h += Math.round(k * (noise3(x * 0.055 + 3, z * 0.055 + 7) * 7.5 - 2));
    let type = TYPE.GRASS;
    if (x < -27 + 8 * (noise4(x * 0.1, z * 0.1) - 0.5) && r > 24) type = TYPE.FOREST;
    // the core zones shape the terrain (as they always have)
    const dIce = dist2(x, z, ZONES.ice.x, ZONES.ice.z);
    const dPeak = dist2(x, z, ZONES.peak.x, ZONES.peak.z);
    const dShadow = dist2(x, z, ZONES.shadow.x, ZONES.shadow.z);
    const dPlaza = dist2(x, z, ZONES.plaza.x, ZONES.plaza.z);
    const dChamber = dist2(x, z, ZONES.chamber.x, ZONES.chamber.z);
    if (dPlaza < 7) { h = 3; type = TYPE.PATH; } else if (dPlaza < 9) { h = 3; type = TYPE.GRASS; }
    if (dIce < ZONES.ice.r) { h = 4 + Math.round((ZONES.ice.r - dIce) * 0.35); type = TYPE.ICE; }
    if (dPeak < ZONES.peak.r) { h = 4 + Math.round((ZONES.peak.r - dPeak) * 0.7); type = TYPE.ROCK; }
    if (dPeak < 3.5) h = 9;
    if (dShadow < ZONES.shadow.r) { h = Math.max(2, h - 1); type = TYPE.SHADOW; }
    if (dChamber < ZONES.chamber.r + 1.5) { h = 3; type = TYPE.STONE; }
    // the Torrey Pines mesa and Black's Beach below its cliff
    if (mesaSector(x, z)) {
      if (r <= 54 && x >= M.x0 && z <= M.z1) { h = M.h; type = TYPE.DRY; FIX[i] = 1; } else if (r > 54) { h = r > 55.6 ? 1 : 2; type = TYPE.SAND; FIX[i] = 1; }
    }
    // beaches slope into the sea; cliff coasts drop straight in
    const cd = coastD[i];
    if (!FIX[i] && cd <= 3 && !cliffy(x, z) && dPeak >= ZONES.peak.r) {
      h = Math.min(h, cd);
      if (cd <= 2 && type !== TYPE.PATH) type = TYPE.SAND;
    }
    H[i] = Math.max(1, h);
    T[i] = type;
  }

  // smooth drops > 1 so everything is walkable (the peak plateau and the mesa keep their cliffs)
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const lower = (passes) => {
    for (let pass = 0; pass < passes; pass++) {
      let changed = false;
      for (let z = -HALF + 1; z < HALF - 1; z++) for (let x = -HALF + 1; x < HALF - 1; x++) {
        const i = idx(x, z);
        if (!LAND[i] || FIX[i]) continue;
        if (dist2(x, z, ZONES.peak.x, ZONES.peak.z) < ZONES.peak.r) continue;
        for (const [ox, oz] of NB) {
          const j = idx(x + ox, z + oz);
          if (!LAND[j]) continue;
          if (H[i] - H[j] > 1) { H[i] = H[j] + 1; changed = true; }
        }
      }
      if (!changed) break;
    }
  };
  lower(10);

  // level the ground under the landmark plots, with a ramp around each
  for (const pl of plots) {
    if (pl.auto) {
      const hs = [];
      for (let z = Math.ceil(pl.cz - pl.hz); z <= Math.floor(pl.cz + pl.hz); z++) for (let x = Math.ceil(pl.cx - pl.hx); x <= Math.floor(pl.cx + pl.hx); x++) if (land(x, z)) hs.push(H[idx(x, z)]);
      hs.sort((a, b) => a - b);
      pl.h = Math.max(3, Math.min(7, hs.length ? hs[hs.length >> 1] : pl.h));
    }
    const ramp = pl.ramp ?? 2;
    for (let z = Math.floor(pl.cz - pl.hz) - ramp; z <= Math.ceil(pl.cz + pl.hz) + ramp; z++) {
      for (let x = Math.floor(pl.cx - pl.hx) - ramp; x <= Math.ceil(pl.cx + pl.hx) + ramp; x++) {
        if (!land(x, z)) continue;
        const i = idx(x, z);
        const dx = Math.max(0, Math.abs(x - pl.cx) - pl.hx), dz = Math.max(0, Math.abs(z - pl.cz) - pl.hz);
        const ring = Math.max(dx, dz);
        if (ring <= 0) { H[i] = pl.h; T[i] = TYPE[pl.type]; FIX[i] = 1; } else if (ring <= ramp && FIX[i] !== 1) H[i] = Math.max(pl.h - ring, Math.min(pl.h + ring, H[i]));
      }
    }
  }

  // ---------------------------------------------------------------- the shuttle loop road
  const loop = loopPath(1);
  const hs = loop.map((p) => { const xi = Math.round(p.x), zi = Math.round(p.z); return land(xi, zi) ? H[idx(xi, zi)] : 3; });
  for (let it = 0; it < 3; it++) {
    const src = hs.slice();
    for (let i = 0; i < hs.length; i++) { let s = 0; for (let k = -4; k <= 4; k++) s += src[(i + k + hs.length) % hs.length]; hs[i] = s / 9; }
  }
  for (let i = 0; i < hs.length; i++) hs[i] = Math.max(2, Math.round(hs[i]));
  for (let it = 0; it < 2; it++) for (let i = 1; i <= hs.length; i++) { const a = hs[(i - 1) % hs.length], j = i % hs.length; hs[j] = Math.max(a - 1, Math.min(a + 1, hs[j])); }
  const roadD = new Float32Array(N).fill(99), roadI = new Int32Array(N).fill(-1);
  loop.forEach((p, k) => {
    for (let z = Math.floor(p.z - 2); z <= Math.ceil(p.z + 2); z++) for (let x = Math.floor(p.x - 2); x <= Math.ceil(p.x + 2); x++) {
      if (!inRange(x, z)) continue;
      const d = Math.hypot(x - p.x, z - p.z), i = idx(x, z);
      if (d < roadD[i]) { roadD[i] = d; roadI[i] = k; }
    }
  });
  const onLibWalk = (x, z) => x >= LAYOUT.libwalk.x0 - 1 && x <= LAYOUT.libwalk.x1 + 1;
  for (let i = 0; i < N; i++) {
    if (roadD[i] > 1.45 || !LAND[i]) continue;
    const x = (i % SIZE) - HALF, z = Math.floor(i / SIZE) - HALF;
    if (FIX[i] !== 1) { H[i] = hs[roadI[i]]; FIX[i] = 2; }
    T[i] = TYPE.ROAD;
    if (onLibWalk(x, z)) D[i] = (x + z) & 1 ? 2 : 5;                // the crosswalk
    else if (roadD[i] < 0.5 && roadI[i] % 6 < 3) D[i] = 1;          // centre dashes
  }
  // settle the ground around the plots and the road: lower what towers over them, raise what sinks
  const near = new Uint8Array(N);
  for (let z = -HALF + 3; z < HALF - 3; z++) for (let x = -HALF + 3; x < HALF - 3; x++) {
    if (!FIX[idx(x, z)] || mesaSector(x, z)) continue;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) near[idx(x + dx, z + dz)] = 1;
  }
  for (let pass = 0; pass < 16; pass++) {
    let changed = false;
    for (let z = -HALF + 1; z < HALF - 1; z++) for (let x = -HALF + 1; x < HALF - 1; x++) {
      const i = idx(x, z);
      if (!LAND[i] || FIX[i]) continue;
      if (dist2(x, z, ZONES.peak.x, ZONES.peak.z) < ZONES.peak.r) continue;
      let lo = -Infinity, hi = Infinity;
      for (const [ox, oz] of NB) {
        const j = idx(x + ox, z + oz);
        if (!LAND[j]) continue;
        hi = Math.min(hi, H[j] + 1);
        if (near[i]) lo = Math.max(lo, H[j] - 1);
      }
      const v = Math.max(1, Math.min(hi, Math.max(lo, H[i])));
      if (v !== H[i]) { H[i] = v; changed = true; }
    }
    if (!changed) break;
  }

  // stone stairs from Warren Mall up to the mesa
  const W = plots.find((p) => p.id === 'warren');
  const ST = LAYOUT.stairs;
  const stairCells = [];
  if (W) {
    const n = M.h - W.h;
    const x0 = M.x0 - n;
    for (let z = ST.z0; z <= ST.z1; z++) {
      for (let x = Math.ceil(W.cx + W.hx) + 1; x < x0; x++) if (land(x, z)) { const i = idx(x, z); H[i] = W.h; T[i] = TYPE.PAVE; FIX[i] = 1; }
      for (let k = 0; k < n; k++) {
        const x = x0 + k;
        if (!land(x, z)) continue;
        const i = idx(x, z);
        H[i] = W.h + k + 1; T[i] = TYPE.STONE; FIX[i] = 1;
        stairCells.push([x, z]);
      }
    }
  }

  // paths from the plaza (and the camp) to the places people go
  const carve = (ax, az, bx, bz) => {
    const n = Math.ceil(dist2(ax, az, bx, bz));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = Math.round(ax + (bx - ax) * t), pz = Math.round(az + (bz - az) * t);
      for (const [ox, oz] of [[0, 0], [1, 0], [0, 1]]) {
        const x = px + ox, z = pz + oz;
        if (!land(x, z)) continue;
        const k = T[idx(x, z)];
        if (k === TYPE.GRASS || k === TYPE.SHADOW || k === TYPE.SAND || k === TYPE.FOREST || k === TYPE.DRY) T[idx(x, z)] = TYPE.PATH;
      }
    }
  };
  for (const k of ['meadow', 'camp', 'ice', 'shadow', 'peak', 'door']) carve(0, 0, ZONES[k].x, ZONES[k].z);
  carve(ZONES.door.x, ZONES.door.z, ZONES.chamber.x, ZONES.chamber.z);
  carve(-3, 7, -8, 13.5);                                    // plaza -> Library Walk
  carve(14, -12, 12, -36);                                   // Jacobs Yard -> Warren Mall
  carve(-2, -8, -12, -33);                                   // plaza -> RIMAC
  carve(-20, 6, -40, 4);                                     // the grove -> the forest
  carve(26, 18, 30, 26);                                     // Sun God lawn -> the bluffs
  carve(34, -18, 46, -22);                                   // the cove -> Black's Beach
  // pitch lines on the RIMAC field; a tile band down the middle of Library Walk and Warren Mall
  const RF = LAYOUT.rimac.field;
  for (let z = RF.z - 4; z <= RF.z + 4; z++) for (let x = RF.x - 4; x <= RF.x + 4; x++) {
    if (!land(x, z)) continue;
    const i = idx(x, z);
    T[i] = TYPE.FIELD;
    if (Math.abs(x - RF.x) === 4 || Math.abs(z - RF.z) === 4 || x === RF.x) D[i] = 2;
  }
  for (let z = LAYOUT.libwalk.z0; z <= LAYOUT.libwalk.z1; z++) { const x = -8; if (land(x, z) && T[idx(x, z)] === TYPE.PAVE) D[idx(x, z)] = 3; }
  for (let x = 1; x <= 25; x++) for (const z of [-43, -42]) if (land(x, z) && T[idx(x, z)] === TYPE.PAVE && x % 3) D[idx(x, z)] = 3;

  // ---------------------------------------------------------------- the sea floor
  for (let z = -HALF; z < HALF; z++) for (let x = -HALF; x < HALF; x++) {
    const i = idx(x, z);
    if (LAND[i]) { HV[i] = H[i]; continue; }
    if (!inDisc(x, z)) continue;
    const sd = seaD[i];
    T[i] = TYPE.SEABED;
    if (sd <= 3) { H[i] = HV[i] = sd <= 1 ? 0 : sd === 2 ? -1 : -2; if (sd <= 1) T[i] = TYPE.WET; } else HV[i] = -4;
  }
  // keep the rim of the diorama clean: nothing but water above the strata wall there
  for (let z = -HALF; z < HALF; z++) for (let x = -HALF; x < HALF; x++) {
    const i = idx(x, z);
    if (HV[i] !== VOID && Math.hypot(x, z) > DISC - 1.6) { H[i] = VOID; HV[i] = -4; T[i] = TYPE.SEABED; }
  }

  const height = (x, z) => {
    const xi = Math.round(x), zi = Math.round(z);
    if (!inRange(xi, zi)) return -Infinity;
    const h = H[idx(xi, zi)];
    return h === VOID ? -Infinity : h;
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
  /** Top colour at a cell (maps). */
  const colorAt = (x, z) => {
    const xi = Math.round(x), zi = Math.round(z);
    if (!inRange(xi, zi)) return null;
    const i = idx(xi, zi);
    if (HV[i] === VOID) return null;
    if (D[i]) return DECO[D[i]];
    return (PAL[T[i]] || ['#888'])[0];
  };

  // ---------------------------------------------------------------- the terrain mesh
  const group = new THREE.Group();
  const terrain = meshTerrain();
  terrain.receiveShadow = true;
  terrain.castShadow = true;
  terrain.name = 'terrain';
  group.add(terrain);
  function meshTerrain() {
    const w = new GeoWriter(false);
    const hv = (x, z) => (inRange(x, z) ? HV[idx(x, z)] : VOID);
    const topCol = (x, z, i) => {
      if (D[i]) return rgb(DECO[D[i]]);
      const p = PAL[T[i]] || ['#888888'];
      return rgb(p[Math.floor(hashI(x, 3, z) * p.length)]);
    };
    const sideCol = (x, y, z, i, h) => {
      const t = T[i];
      if (t === TYPE.ICE) return rgb(PAL[TYPE.ICE][(x + y + z) & 1]);
      if (t === TYPE.ROCK) return rgb(PAL[TYPE.ROCK][Math.floor(hashI(x, y, z) * 3)]);
      if (y === h) {
        if (t === TYPE.GRASS || t === TYPE.FOREST || t === TYPE.FIELD || t === TYPE.SHADOW || t === TYPE.DRY) {
          const c = topCol(x, z, i); return [c[0] * 0.78, c[1] * 0.78, c[2] * 0.78];
        }
        if (t === TYPE.SAND || t === TYPE.WET || t === TYPE.SEABED) return rgb(PAL[t][1]);
        if (t === TYPE.PAVE || t === TYPE.ROAD || t === TYPE.PATH || t === TYPE.STONE) return rgb('#8e8a82');
      }
      if (y === h - 1 && (t === TYPE.GRASS || t === TYPE.FOREST || t === TYPE.FIELD || t === TYPE.SHADOW || t === TYPE.DRY)) return rgb(hashI(x, y, z) < 0.5 ? '#7a5534' : '#6f4c2e');
      if (t === TYPE.SAND && y >= h - 2 && y > -1) return rgb(PAL[TYPE.SAND][1 + (hashI(x, y, z) < 0.5 ? 1 : 0)]);
      return rgb(strata(x, y, z));
    };
    // top-face corners in FACES order: (-,+) (+,+) (-,-) (+,-)
    const TOPC = [[-1, 1], [1, 1], [-1, -1], [1, -1]];
    const SIDES = [
      { n: [-1, 0], c: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]] },
      { n: [1, 0], c: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]] },
      { n: [0, -1], c: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]] },
      { n: [0, 1], c: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]] },
    ];
    for (let z = -HALF; z < HALF; z++) for (let x = -HALF; x < HALF; x++) {
      const i = idx(x, z);
      const h = HV[i];
      if (h === VOID) continue;
      // top
      const [r, g, b] = topCol(x, z, i);
      const occ = [0, 0, 0, 0];
      const base = w.v;
      for (let k = 0; k < 4; k++) {
        const [sx, sz] = TOPC[k];
        const s1 = hv(x + sx, z) > h ? 1 : 0, s2 = hv(x, z + sz) > h ? 1 : 0, cr = hv(x + sx, z + sz) > h ? 1 : 0;
        const o = s1 && s2 ? 3 : s1 + s2 + cr;
        occ[k] = o;
        const a = AO[o];
        w.vert(x + sx * 0.5, h + 0.5, z + sz * 0.5, 0, 1, 0, r * a, g * a, b * a);
      }
      w.quad(base, occ[0] + occ[3] < occ[1] + occ[2]);
      // sides, down to the neighbour (or the rim of the diorama)
      for (const s of SIDES) {
        const nh = hv(x + s.n[0], z + s.n[1]);
        const bottom = nh === VOID ? WALL_BOTTOM : nh + 1;
        if (bottom > h) continue;
        for (let y = bottom; y <= h; y++) {
          const [cr, cg, cb] = sideCol(x, y, z, i, h);
          const vb = w.v;
          for (const cc of s.c) {
            const a = cc[1] === 0 && y === bottom && nh !== VOID ? 0.7 : 1;
            w.vert(x + cc[0] - 0.5, y + cc[1] - 0.5, z + cc[2] - 0.5, s.n[0], 0, s.n[1], cr * a, cg * a, cb * a);
          }
          w.quad(vb);
        }
      }
    }
    const mat = new THREE.MeshStandardNodeMaterial({ roughness: 0.93, vertexColors: true });
    const mesh = new THREE.Mesh(w.geometry(), mat);
    mesh.userData.faces = w.i / 6;
    return mesh;
  }

  // ---------------------------------------------------------------- the sea
  const water = buildWater({ HV, LAND, seaD, idx, inRange, inDisc, SIZE, HALF, VOID, WATER });
  group.add(water.mesh);

  // ---------------------------------------------------------------- trees and static scenery
  // Everything static goes into `statics` ([x, y, z, colour, glow?] cells) and becomes one merged
  // mesh in bake() (districts.js adds its buildings before that).
  const statics = [];
  const push = (x, y, z, c, g = 0) => statics.push([x, y, z, c, g]);
  const tuft = (cx, cy, cz, r, cols, flat = false) => {
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.abs(dx) + Math.abs(dz) > r + (r > 1 ? 1 : 0)) continue;
      if (Math.abs(dx) === r && Math.abs(dz) === r) continue;
      push(cx + dx, cy, cz + dz, cols[Math.floor(rand() * cols.length)]);
      if (!flat && Math.abs(dx) + Math.abs(dz) <= r - 1) push(cx + dx, cy + 1, cz + dz, cols[Math.floor(rand() * cols.length)]);
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
      push(x + ox, h + y, z + oz, y % 2 ? '#6a4a2e' : '#5a3d25');
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
      push(x + ox, h + y, z + oz, y % 2 ? '#9a7a52' : '#8a6a45');
    }
    const top = h + th;
    const frond = ['#3aa35a', '#2f8f4e', '#46b566'];
    push(x + ox, top + 1, z + oz, frond[0]);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      push(x + ox + dx, top + 1, z + oz + dz, frond[Math.floor(rand() * 3)]);
      push(x + ox + dx * 2, top + 1, z + oz + dz * 2, frond[Math.floor(rand() * 3)]);
      push(x + ox + dx * 3, top, z + oz + dz * 3, frond[Math.floor(rand() * 3)]);
    }
  };
  // eucalyptus: tall pale trunks with peeling bark, dark blue-green crowns in loose layers
  const EUC = { trunk: ['#d8d0bf', '#c4b9a2', '#a39985'], leaf: ['#1f4d34', '#255a3c', '#2c6644', '#1a4230', '#35714c'] };
  const EUC_DARK = { trunk: ['#9d9787', '#857f70', '#6f6a5d'], leaf: ['#173a2e', '#1c4535', '#133026', '#21503c'] };
  const addEucalyptus = (x, z, dark = false, tall = false) => {
    const h = height(x, z);
    if (h === -Infinity) return;
    const P = dark ? EUC_DARK : EUC;
    const th = (tall ? 10 : 7) + Math.floor(rand() * (tall ? 5 : 3));
    const lean = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rand() * 4)];
    let ox = 0, oz = 0;
    for (let y = 1; y <= th; y++) {
      if (tall && y === Math.floor(th * 0.6)) { ox += lean[0]; oz += lean[1]; }
      push(x + ox, h + y, z + oz, P.trunk[(y + (hashI(x, y, z) < 0.3 ? 1 : 0)) % 3]);
    }
    const layers = tall ? [[0, 0, 0, 2], [1, -2, 1, 2], [-1, -4, -1, 1], [1, -5, 0, 1], [-1, -6, 1, 1]] : [[0, 0, 0, 2], [1, -1, 0, 1], [-1, -2, 0, 1], [0, -2, 1, 1], [0, -3, -1, 1], [1, -4, 1, 1]];
    for (const [dx, dy, dz, r] of layers) tuft(x + ox + dx, h + th + dy, z + oz + dz, r, P.leaf);
    if (tall) push(x + ox, h + th + 2, z + oz, P.leaf[0]);
  };
  const addJacaranda = (x, z) => {
    const h = height(x, z);
    if (h === -Infinity) return;
    for (let y = 1; y <= 4; y++) push(x, h + y, z, '#5b4636');
    const cols = ['#8b6fd6', '#9d80e6', '#7a5fc4', '#a78bfa'];
    tuft(x, h + 5, z, 2, cols);
    tuft(x, h + 6, z, 1, cols);
  };
  const addBush = (x, z, cols) => {
    const h = height(x, z);
    if (h === -Infinity) return;
    push(x, h + 1, z, cols[0]);
    if (rand() < 0.6) push(x + (rand() < 0.5 ? 1 : 0), h + 1, z + (rand() < 0.5 ? 0 : 1), cols[1 % cols.length]);
  };

  const placed = [];
  const tryPlace = (zoneKey, count, minGap, cb, rMin = 2) => {
    const zn = ZONES[zoneKey];
    let tries = 0;
    for (let n = 0; n < count && tries < 200; tries++) {
      const a = rand() * Math.PI * 2, r = rMin + rand() * Math.max(0.5, zn.r - 0.5 - rMin);
      const x = Math.round(zn.x + Math.cos(a) * r), z = Math.round(zn.z + Math.sin(a) * r);
      if (!walkable(x, z) || typeAt(x, z) === TYPE.PATH || typeAt(x, z) === TYPE.ROAD || height(x, z) < 1) continue;
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

  // the outer campus: a dense eucalyptus forest in the west, pines on the bluffs, palms by the sea
  const freeFor = (x, z, gap) => {
    if (!walkable(x, z) || height(x, z) < 1) return false;
    const i = idx(x, z);
    if (FIX[i] || roadD[i] < 2.6 || T[i] === TYPE.PATH || T[i] === TYPE.SAND || T[i] === TYPE.ROAD) return false;
    if (nearPlot(x, z, 1.5)) return false;
    for (const zn of [ZONES.shadow, ZONES.chamber, ZONES.door, ZONES.plaza]) if (dist2(x, z, zn.x, zn.z) < zn.r + 1.5) return false;
    return !placed.some(([px, pz]) => Math.abs(px - x) < gap && Math.abs(pz - z) < gap && dist2(px, pz, x, z) < gap);
  };
  const STEP = lowfx ? 5 : 4;
  for (let gz = -40; gz <= 44; gz += STEP) for (let gx = -60; gx <= -22; gx += STEP) {
    const x = Math.round(gx + (rand() - 0.5) * 2.6), z = Math.round(gz + (rand() - 0.5) * 2.6);
    if (T[idx(Math.max(-HALF, Math.min(HALF - 1, x)), Math.max(-HALF, Math.min(HALF - 1, z)))] !== TYPE.FOREST || !freeFor(x, z, 3)) continue;
    placed.push([x, z]);
    addEucalyptus(x, z, false, true);
  }
  const scatter = (count, box, gap, test, cb) => {
    for (let n = 0, tries = 0; n < count && tries < count * 30; tries++) {
      const x = Math.round(box[0] + rand() * (box[1] - box[0])), z = Math.round(box[2] + rand() * (box[3] - box[2]));
      if (!inRange(x, z) || !test(x, z) || !freeFor(x, z, gap)) continue;
      placed.push([x, z]);
      cb(x, z);
      n++;
    }
  };
  scatter(9, [22, 48, 20, 50], 4, (x, z) => T[idx(x, z)] !== TYPE.SAND, addPine);                        // the bluffs
  scatter(5, [26, 50, -52, -18], 5, (x, z) => T[idx(x, z)] === TYPE.DRY && !(Math.abs(x - 40) < 7 && Math.abs(z + 28) < 6), addPine); // the mesa
  scatter(6, [-26, 10, 26, 36], 4, () => true, addPalm);                                                 // around the loop in the south
  scatter(5, [-34, 30, -54, -30], 4, () => true, addJacaranda);                                          // north campus
  scatter(8, [-40, 30, -30, 40], 4, (x, z) => T[idx(x, z)] === TYPE.GRASS && Math.hypot(x, z) > 30, addEucalyptus);
  for (const x of [LAYOUT.libwalk.x0 - 2, LAYOUT.libwalk.x1 + 2]) for (let z = LAYOUT.libwalk.z0 + 2; z <= LAYOUT.libwalk.z1 - 1; z += 6) {
    if (freeFor(x, z, 2)) { placed.push([x, z]); addJacaranda(x, z); }
  }
  // chaparral on the mesa, beach grass on the dunes
  scatter(lowfx ? 20 : 40, [30, 56, -54, -18], 1.5, (x, z) => T[idx(x, z)] === TYPE.DRY, (x, z) => addBush(x, z, ['#6f7a3e', '#7f8a45']));
  scatter(lowfx ? 10 : 22, [-60, 60, -60, 60], 2, (x, z) => T[idx(x, z)] === TYPE.GRASS && coastD[idx(x, z)] <= 5, (x, z) => addBush(x, z, ['#4d8f4f', '#5aa25a']));

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
  for (const [x, z] of wallCells) { const hy = height(x, z); for (let y = 1; y <= 4; y++) push(x, hy + y, z, y === 4 ? '#4b5568' : (x + z) % 2 ? '#3a4356' : '#333b4c'); blocked.add(`${x},${z}`); }
  const gateVox = [];
  for (const [x, z] of gateCells) { const hy = height(x, z); for (let y = 1; y <= 4; y++) gateVox.push([x, hy + y, z, y === 4 ? '#4b5568' : '#2b2f45', 0]); }
  const gateMesh = voxMesh(gateVox.length ? gateVox : [[0, -50, 0, '#000']], { roughness: 0.9 });
  group.add(gateMesh);
  const sealChamber = (on) => {
    gateMesh.visible = on;
    for (const [x, z] of gateCells) { if (on) blocked.add(`${x},${z}`); else blocked.delete(`${x},${z}`); }
  };
  // Ice crystals in the cold aisle: one instanced mesh for all of them
  const crystalSpots = [];
  tryPlace('ice', 6, 2.5, (x, z) => crystalSpots.push({ x, y: height(x, z) + 0.5, z, rotY: rand() * 6.28, scale: 0.4 + rand() * 0.3 }));
  if (crystalSpots.length) {
    const crystals = mergeSprites('crystal', crystalSpots, { maxHalf: 1, glow: { V: 1.4, v: 0.8, W: 2.2 } });
    group.add(crystals);
  }

  /** Merge every static cell collected so far into one mesh (call once, after the districts). */
  let baked = null;
  function bake() {
    if (baked) return baked;
    const solidTerrain = (x, y, z) => inRange(x, z) && HV[idx(x, z)] !== VOID && y <= HV[idx(x, z)];
    baked = voxMesh(statics, { roughness: 0.86, solidExtra: solidTerrain });
    baked.name = 'statics';
    group.add(baked);
    return baked;
  }

  const surfaceY = (x, z) => height(x, z) + 0.5;
  const isBlocked = (x, z) => blocked.has(`${Math.round(x)},${Math.round(z)}`);
  const block = (x, z) => blocked.add(`${Math.round(x)},${Math.round(z)}`);
  const unblock = (x, z) => blocked.delete(`${Math.round(x)},${Math.round(z)}`);
  const grid = { H, HV, T, D, LAND, coastD, seaD, SIZE, HALF, DISC, WATER, VOID, idx, inRange, TYPE, PAL, DECO, roadD, stairs: stairCells };
  const buildMs = performance.now() - t0;
  return {
    group, height, walkable, zoneAt, typeAt, colorAt, surfaceY, isBlocked, block, unblock, sealChamber, gate, TYPE, rand, ZONES,
    grid, statics, bake, water, terrain, loop, roadHeights: hs, buildMs,
    bounds: { x0: -HALF - 0.5, x1: HALF - 0.5, z0: -HALF - 0.5, z1: HALF - 0.5 },
    voxels: terrain.userData.faces,
  };
}
