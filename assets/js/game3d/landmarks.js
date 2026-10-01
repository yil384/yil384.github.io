// Voxel landmarks that stand in for the sections of the page. Each builder returns
//   { group, meshes, update?(t, dt), ... }  built in local coordinates (y = 0 is the ground),
// so the stage can drop it anywhere and turn it to face something.
import * as THREE from 'three/webgpu';
import { voxBuild, boxCells, ringCells, hash3, shade } from './props.js';

const cellsOf = (...lists) => lists.flat();
const rnd = (a, b, c) => hash3(a, b, c);

// ------------------------------------------------------------------------------------------------
// The library tower: an inverted stepped pyramid on a narrow stem, a nod to UC San Diego's Geisel
// Library. Rings of concrete alternate with rings of warm windows so it glows at night.
export function buildTower() {
  const CONCRETE = ['#e6eaf2', '#d9deea', '#cdd3e0'];
  const cells = [];
  const conc = (x, y, z) => CONCRETE[Math.floor(rnd(x, y, z) * CONCRETE.length)];
  // stem / lobby (rows 0-1): concrete corners, glass between, entrance on +z
  for (let y = 0; y <= 2; y++) {
    cells.push(...ringCells(0, 0, 2, y, (x, z) => (Math.abs(x) === 2 && Math.abs(z) === 2 ? conc(x, y, z) : '#ffd98a'), {}).map((c) => {
      const isCorner = c[3] !== '#ffd98a';
      const door = y <= 1 && c[2] === 2 && Math.abs(c[0]) <= 0;
      if (door) return [c[0], c[1], c[2], '#fff1c4', 1.6];
      return isCorner ? c : [c[0], c[1], c[2], c[3], 0.75];
    }));
  }
  // floors: two rows each, slab then window band; widths step out as they rise
  const HW = [3, 4, 4, 5, 5, 6];
  let y = 3;
  for (const hw of HW) {
    cells.push(...ringCells(0, 0, hw, y, (x, z) => conc(x, y, z)));
    y++;
    cells.push(...ringCells(0, 0, hw, y, (x, z) => {
      const mullion = (Math.abs(x) === hw ? z : x) % 3 === 0 || (Math.abs(x) === hw && Math.abs(z) === hw);
      return mullion ? '#aab2c0' : (rnd(x, y, z) < 0.22 ? '#39425a' : '#ffd27a');
    }).map((c) => [c[0], c[1], c[2], c[3], c[3] === '#ffd27a' ? 0.85 : 0]));
    y++;
  }
  // roof slab (solid) and penthouse
  cells.push(...boxCells(-6, 6, y, y, -6, 6, null, { pick: (x, yy, z) => shade('#8b95a8', (rnd(x, yy, z) - 0.5) * 0.2) }));
  y++;
  cells.push(...ringCells(0, 0, 2, y, (x, z) => conc(x, y, z)));
  y++;
  cells.push(...ringCells(0, 0, 2, y, (x, z) => (Math.abs(x) === 2 && Math.abs(z) === 2 ? '#aab2c0' : '#ffe6a3')).map((c) => [c[0], c[1], c[2], c[3], c[3] === '#ffe6a3' ? 0.9 : 0]));
  y++;
  cells.push(...boxCells(-2, 2, y, y, -2, 2, '#8b95a6'));
  y++;
  for (let k = 0; k < 5; k++) cells.push([0, y + k, 0, '#9aa3b2', 0]);
  cells.push([0, y + 5, 0, '#ff5a5a', 3.2]);
  const mesh = voxBuild(cells, { roughness: 0.8 });
  const group = new THREE.Group();
  group.add(mesh);
  return { group, meshes: [mesh], height: y + 6, topY: y };
}

// ------------------------------------------------------------------------------------------------
// Tsinghua's Second Gate, in white voxels: one tall central arch, two smaller side arches, a
// pediment over the lintel. Faces +z.
export function buildGate() {
  const W = ['#eef1f5', '#e2e7ee', '#d6dce6'];
  const w = (x, y, z) => W[Math.floor(rnd(x, y, z) * W.length)];
  const cells = [];
  const add = (x, y, z, c = w(x, y, z), g = 0) => cells.push([x, y, z, c, g]);
  for (let v = 0; v <= 1; v++) {
    // pillars: outer pair wider, inner pair slimmer
    for (const u of [-6, -3, 3, 6]) for (let y = 0; y <= 6; y++) add(u, y, v, y === 0 ? '#aeb6c3' : w(u, y, v));
    for (const u of [-7, 7]) for (let y = 6; y <= 7; y++) add(u, y, v);
    // side arches are 2 wide × 4 tall; the centre is 5 wide × 6 tall with rounded shoulders
    add(-2, 5, v); add(2, 5, v);
    add(-5, 4, v); add(-4, 4, v); add(4, 4, v); add(5, 4, v);
    for (const u of [-5, -4, 4, 5]) for (let y = 5; y <= 5; y++) add(u, y, v);
    // lintel and pediment
    for (let u = -7; u <= 7; u++) for (let y = 6; y <= 7; y++) add(u, y, v);
    for (let u = -4; u <= 4; u++) add(u, 8, v);
    for (let u = -2; u <= 2; u++) add(u, 9, v);
    add(0, 10, v, '#f2c14e', 1.2);
  }
  // inscription plaque, lit from within
  for (let u = -2; u <= 2; u++) add(u, 7, 2, '#8a1f1f', 0.55);
  for (let u = -2; u <= 2; u++) add(u, 6, 2, '#d8c27a', 0.2);
  const mesh = voxBuild(cells, { roughness: 0.75 });
  const group = new THREE.Group();
  group.add(mesh);
  // local pillar cells so the stage can block them
  const pillars = [];
  for (const u of [-6, -3, 3, 6]) for (const v of [0, 1]) pillars.push([u, v]);
  return { group, meshes: [mesh], pillars, height: 11 };
}

// ------------------------------------------------------------------------------------------------
// A trail flag: wooden pole, gilt finial, waving cloth in the company colour.
export function buildFlag(colour) {
  // pole and cloth in one instanced mesh (the first cells are the pole; the rest wave)
  const cells = [];
  cells.push([0, 0, 0, '#6b7280', 0]);
  for (let y = 1; y <= 7; y++) cells.push([0, y, 0, '#8b6f4e', 0]);
  cells.push([0, 8, 0, '#f2c14e', 1.4]);
  const POLE = cells.length;
  const CLOTH_W = 5, CLOTH_H = 4;
  for (let u = 0; u < CLOTH_W; u++) for (let y = 0; y < CLOTH_H; y++) {
    const edge = u === CLOTH_W - 1 && (y === 0 || y === CLOTH_H - 1);
    if (edge) continue;
    cells.push([1 + u, 3.5 + y, 0, shade(colour, (y % 2 ? -0.06 : 0.04)), 0.28]);
  }
  const flag = voxBuild(cells, { roughness: 0.8 });
  const base = flag.instanceMatrix.array.slice();
  const group = new THREE.Group();
  group.add(flag);
  return {
    group, meshes: [flag], height: 9,
    update(t) {
      const arr = flag.instanceMatrix.array;
      for (let i = POLE; i < cells.length; i++) {
        const u = cells[i][0] - 1;
        const wave = Math.sin(t * 3.1 + u * 0.9) * 0.28 * (u / CLOTH_W);
        arr[i * 16 + 14] = base[i * 16 + 14] + wave;
        arr[i * 16 + 13] = base[i * 16 + 13] + Math.sin(t * 2.4 + u) * 0.08 * (u / CLOTH_W);
      }
      flag.instanceMatrix.needsUpdate = true;
    },
  };
}

// ------------------------------------------------------------------------------------------------
// Project monuments. Each has a distinct silhouette and reacts when the page points at it.

/** Starry-Next: an obsidian monolith speckled with stars, a rust-orange gear turning on top. */
export function buildMonolith() {
  const cells = [];
  for (let y = 0; y <= 10; y++) for (let x = -1; x <= 1; x++) for (let z = 0; z <= 1; z++) {
    const star = y > 1 && rnd(x + 9, y, z + 4) < 0.16;
    cells.push([x, y, z, star ? '#b9f1ff' : (rnd(x, y, z) < 0.5 ? '#2b3350' : '#343d5e'), star ? 2.6 : 0]);
  }
  for (let x = -2; x <= 2; x++) for (let z = -1; z <= 2; z++) cells.push([x, 0, z, '#3b4256', 0]);
  const body = voxBuild(cells, { roughness: 0.35, metalness: 0.2 });
  const gearCells = [];
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    gearCells.push([Math.round(Math.cos(ang) * 2), 0, Math.round(Math.sin(ang) * 2), '#e0703a', 0.7]);
  }
  for (let a = 0; a < 8; a++) {
    const ang = ((a + 0.5) / 8) * Math.PI * 2;
    gearCells.push([Math.round(Math.cos(ang) * 3), 0, Math.round(Math.sin(ang) * 3), a % 2 ? '#c2410c' : '#e0703a', 0.5]);
  }
  gearCells.push([0, 0, 0, '#ffb072', 1.6]);
  const gear = voxBuild(gearCells, { roughness: 0.5, metalness: 0.4 });
  gear.position.set(0, 12.2, 0.5);
  const group = new THREE.Group();
  group.add(body, gear);
  return { group, meshes: [body, gear], height: 14, update(t) { gear.rotation.y = t * 0.6; gear.position.y = 12.2 + Math.sin(t * 1.4) * 0.25; } };
}

/** IM System: two chat bubbles on posts, with a live "typing…" dot rhythm. */
export function buildChat() {
  const post = (x, h, col) => { const c = []; for (let y = 0; y <= h; y++) c.push([x, y, 0, col, 0]); return c; };
  const bubble = (x0, y0, w, h, col, glow) => {
    const c = [];
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
      if ((x === 0 || x === w - 1) && (y === 0 || y === h - 1)) continue;
      c.push([x0 + x, y0 + y, 1, col, glow]);
    }
    c.push([x0 + 1, y0 - 1, 1, col, glow]);
    return c;
  };
  const stand = cellsOf(post(-3, 4, '#6b7280'), post(4, 7, '#6b7280'), boxCells(-5, 6, 0, 0, -1, 1, '#444b5c'));
  const a = bubble(-6, 5, 7, 4, '#4ea3ff', 0.35);
  const b = bubble(1, 8, 8, 4, '#4ade80', 0.35);
  const frame = voxBuild(cellsOf(stand, a, b), { roughness: 0.6 });
  // typing dots
  const dots = voxBuild(cellsOf([[-4, 7, 2, '#ffffff', 2.2], [-3, 7, 2, '#ffffff', 2.2], [-2, 7, 2, '#ffffff', 2.2]],
    [[3, 10, 2, '#ffffff', 2.2], [4, 10, 2, '#ffffff', 2.2], [5, 10, 2, '#ffffff', 2.2], [6, 10, 2, '#ffffff', 2.2]]), { shadow: false });
  const group = new THREE.Group();
  group.add(frame, dots);
  const m = new THREE.Matrix4();
  return {
    group, meshes: [frame, dots], height: 12,
    update(t) {
      for (let i = 0; i < 7; i++) {
        const phase = (i < 3 ? i : i - 3) * 0.35;
        const s = 0.55 + 0.45 * Math.max(0, Math.sin(t * 4 - phase * 4 + (i < 3 ? 0 : 1.6)));
        m.makeScale(s, s, s).setPosition(i < 3 ? -4 + i : 3 + (i - 3), i < 3 ? 7 : 10, 2);
        dots.setMatrixAt(i, m);
      }
      dots.instanceMatrix.needsUpdate = true;
    },
  };
}

/** CST-OJ: a judge's podium with a verdict board. `judge()` flips a random verdict. */
export const VERDICTS = [
  { text: 'Accepted', colour: '#4ade80', ok: true },
  { text: 'Wrong Answer on test 3', colour: '#f87171' },
  { text: 'Time Limit Exceeded', colour: '#fbbf24' },
  { text: 'Runtime Error (SIGSEGV)', colour: '#fb7185' },
  { text: 'Memory Limit Exceeded', colour: '#c084fc' },
  { text: 'Compile Error', colour: '#94a3b8' },
];
export function buildJudge() {
  const stand = cellsOf(
    boxCells(-3, 3, 0, 0, -1, 2, '#3b4256'),
    boxCells(-2, 2, 1, 3, 0, 1, null, { pick: (x, y, z) => (rnd(x, y, z) < 0.5 ? '#4a4331' : '#54492f') }),
    boxCells(-3, 3, 4, 4, 0, 1, '#a08a52'),
  );
  // gavel
  stand.push([0, 5, 0, '#8b5a2b', 0], [0, 6, 0, '#8b5a2b', 0], [-1, 7, 0, '#8b5a2b', 0], [0, 7, 0, '#8b5a2b', 0], [1, 7, 0, '#8b5a2b', 0]);
  const body = voxBuild(stand, { roughness: 0.7 });
  // verdict board on two posts
  const boardCells = [];
  for (let y = 0; y <= 6; y++) { boardCells.push([-5, y, 0, '#6b7280', 0]); boardCells.push([5, y, 0, '#6b7280', 0]); }
  for (let x = -4; x <= 4; x++) for (let y = 3; y <= 6; y++) boardCells.push([x, y, 0, '#0f1424', 0]);
  const board = voxBuild(boardCells, { roughness: 0.5 });
  board.position.set(0, 0, -3);
  const cellsList = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) cellsList.push([-3 + c, 3.9 + r, 0, '#4ade80', 1.6]);
  const lights = voxBuild(cellsList.map((c) => [c[0], c[1], c[2], c[3], c[4]]), { shadow: false });
  lights.position.set(0, 0, -2.4);
  lights.scale.set(0.8, 0.7, 0.4);
  const group = new THREE.Group();
  group.add(body, board, lights);
  const col = new THREE.Color();
  let flashUntil = 0;
  const api = {
    group, meshes: [body, board, lights], height: 9,
    verdictIdx: 0,
    /** Set the board to a verdict colour pattern for a moment. */
    judge(v) {
      flashUntil = performance.now() + 2600;
      for (let i = 0; i < cellsList.length; i++) {
        col.set(rnd(i, v.text.length, 5) < (v.ok ? 0.05 : 0.5) ? v.colour : (v.ok ? '#4ade80' : '#334155'));
        lights.setColorAt(i, col);
      }
      lights.instanceColor.needsUpdate = true;
    },
    update(t) {
      if (performance.now() > flashUntil) {
        // idle: a scrolling pattern of green ticks with the odd red cross
        for (let i = 0; i < cellsList.length; i++) {
          const phase = Math.sin(t * 0.9 + i * 1.7);
          col.set(phase > 0.93 ? '#f87171' : phase > -0.2 ? '#4ade80' : '#1e293b');
          lights.setColorAt(i, col);
        }
        lights.instanceColor.needsUpdate = true;
      }
    },
  };
  return api;
}

/** A stepped stone plinth with a gold plaque, for the sprite statues (King Triton, the Sun God). */
export function buildPlinth({ hw = 3, hd = 3, h = 2, top = '#8f98a8', plaque = '#f2c14e' } = {}) {
  const cells = [];
  for (let y = 0; y < h; y++) {
    cells.push(...boxCells(-hw - (h - 1 - y ? 1 : 0), hw + (h - 1 - y ? 1 : 0), y, y, -hd - (h - 1 - y ? 1 : 0), hd + (h - 1 - y ? 1 : 0), null,
      { pick: (x, yy, z) => shade(y === h - 1 ? top : '#6f7888', (rnd(x, yy, z) - 0.5) * 0.18) }));
  }
  for (let x = -1; x <= 1; x++) cells.push([x, 0, hd + 2, plaque, 0.5]);
  const mesh = voxBuild(cells, { roughness: 0.75 });
  const group = new THREE.Group();
  group.add(mesh);
  return { group, meshes: [mesh], height: h };
}

// ------------------------------------------------------------------------------------------------
// Camp furniture.
export function buildTent(colour = '#c2571a') {
  const cells = [];
  for (let y = 0; y <= 4; y++) for (let x = -(4 - y); x <= 4 - y; x++) for (const z of [-3, 3]) {
    const edge = Math.abs(x) === 4 - y;
    cells.push([x, y, z, edge ? shade(colour, -0.2) : colour, 0]);
  }
  for (let y = 0; y <= 3; y++) for (let x of [-(4 - y), 4 - y]) for (let z = -2; z <= 2; z++) cells.push([x, y, z, shade(colour, y % 2 ? 0.05 : -0.05), 0]);
  for (let z = -2; z <= 2; z++) cells.push([0, 4, z, shade(colour, 0.15), 0]);
  // the door
  for (let y = 0; y <= 2; y++) cells.push([0, y, 3, '#1a1206', 0]);
  const mesh = voxBuild(cells, { roughness: 0.9 });
  const group = new THREE.Group();
  group.add(mesh);
  return { group, meshes: [mesh], height: 6 };
}

export function buildCampfire() {
  const logs = [];
  for (const [x, z, c] of [[-1, 0, '#6b4423'], [1, 0, '#6b4423'], [0, -1, '#7a5230'], [0, 1, '#7a5230']]) logs.push([x, 0, z, c, 0]);
  for (const [x, z] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [-1, 1], [1, -1]]) logs.push([x, -0.05, z, '#4b5563', 0]);
  const base = voxBuild(logs, { roughness: 0.95 });
  const flameCells = [[0, 1, 0, '#ff8a3d', 2.4], [0, 2, 0, '#ffb454', 2.6], [0, 3, 0, '#ffd89a', 2.2], [1, 1, 0, '#ff6a2b', 2], [-1, 1, 0, '#ff6a2b', 2], [0, 1, 1, '#ff6a2b', 2], [0, 1, -1, '#ff6a2b', 2]];
  const flame = voxBuild(flameCells, { shadow: false });
  const group = new THREE.Group();
  group.add(base, flame);
  const m = new THREE.Matrix4();
  return {
    group, meshes: [base], height: 4,
    update(t) {
      for (let i = 0; i < flameCells.length; i++) {
        const c = flameCells[i];
        const f = 0.75 + 0.35 * Math.sin(t * (7 + i) + i * 2.1);
        m.makeScale(f, f * (1.1 + 0.3 * Math.sin(t * 9 + i)), f).setPosition(c[0] * 0.8, c[1] * 0.6 + 0.35, c[2] * 0.8);
        flame.setMatrixAt(i, m);
      }
      flame.instanceMatrix.needsUpdate = true;
    },
  };
}

export function buildWorkbench() {
  const cells = cellsOf(
    boxCells(-3, 3, 2, 2, 0, 1, '#8b6f4e'),
    [[-3, 0, 0, '#6b5238', 0], [-3, 1, 0, '#6b5238', 0], [3, 0, 0, '#6b5238', 0], [3, 1, 0, '#6b5238', 0], [-3, 0, 1, '#6b5238', 0], [-3, 1, 1, '#6b5238', 0], [3, 0, 1, '#6b5238', 0], [3, 1, 1, '#6b5238', 0]],
    // a keyboard, a monitor glowing, a mug
    boxCells(-2, 0, 3, 3, 1, 1, '#2b3348'),
    boxCells(1, 3, 3, 5, 0, 0, '#0f1424'),
    boxCells(1, 3, 4, 5, 0, 0, '#7dd3fc', { glow: 1.1 }),
    [[3, 3, 1, '#e5e7eb', 0]],
  );
  const mesh = voxBuild(cells, { roughness: 0.7 });
  const group = new THREE.Group();
  group.add(mesh);
  return { group, meshes: [mesh], height: 6 };
}

// ------------------------------------------------------------------------------------------------
// Contact: a mailbox on a post, and a lighthouse on the east shore that sweeps a beam.
export function buildMailbox() {
  const cells = [];
  for (let y = 0; y <= 3; y++) cells.push([0, y, 0, '#8b6f4e', 0]);
  cells.push(...boxCells(-1, 1, 4, 5, -1, 1, '#3b82f6'));
  cells.push(...boxCells(-1, 1, 6, 6, -1, 1, '#2563eb'));
  cells.push([0, 4, 2, '#0b1226', 0]);
  const box = voxBuild(cells, { roughness: 0.55 });
  const flagCells = [[0, 0, 0, '#ef4444', 0.6], [0, 1, 0, '#ef4444', 0.6], [0, 2, 0, '#ef4444', 0.9], [1, 2, 0, '#ef4444', 0.9]];
  const flag = voxBuild(flagCells, { shadow: false });
  const group = new THREE.Group();
  group.add(box, flag);
  let raise = 0, target = 0;
  flag.position.set(1, 5, 0);
  return {
    group, meshes: [box, flag], height: 8,
    /** 0 = flag down, 1 = flag up (there is mail). */
    raise(v) { target = v; },
    update(t, dt = 0.016) {
      raise += (target - raise) * Math.min(1, dt * 8);
      flag.rotation.z = -(1 - raise) * 1.4;
    },
  };
}

export function buildLighthouse() {
  const cells = [];
  for (let y = 0; y <= 13; y++) {
    const col = Math.floor(y / 2) % 2 ? '#ef4444' : '#f5f5f4';
    cells.push(...ringCells(0, 0, y < 3 ? 3 : 2, y, () => col));
  }
  cells.push(...boxCells(-3, 3, 14, 14, -3, 3, '#374151'));
  const lamp = [];
  for (let y = 15; y <= 16; y++) lamp.push(...ringCells(0, 0, 1, y, () => '#ffe9a8').map((c) => [c[0], c[1], c[2], c[3], 2.6]));
  lamp.push([0, 15, 0, '#fff7d6', 3.2], [0, 16, 0, '#fff7d6', 3.2]);
  cells.push(...boxCells(-2, 2, 17, 17, -2, 2, '#374151'), [0, 18, 0, '#374151', 0], [0, 19, 0, '#f2c14e', 1.5]);
  const body = voxBuild(cells, { roughness: 0.7 });
  const lampMesh = voxBuild(lamp, { shadow: false });
  const beamMat = new THREE.MeshBasicNodeMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const beamGeo = new THREE.ConeGeometry(5, 46, 20, 1, true);
  beamGeo.translate(0, -23, 0);
  const beams = new THREE.Group();
  for (const s of [1, -1]) {
    const b = new THREE.Mesh(beamGeo, beamMat);
    b.rotation.z = Math.PI / 2 * s;
    beams.add(b);
  }
  beams.position.y = 15.5;
  const group = new THREE.Group();
  group.add(body, lampMesh, beams);
  return { group, meshes: [body, lampMesh], height: 20, update(t) { beams.rotation.y = t * 0.55; } };
}

// ------------------------------------------------------------------------------------------------
// UC San Diego set dressing.

const LETTERS = {
  C: ['XXX', 'X..', 'X..', 'X..', 'XXX'],
  S: ['XXX', 'X..', 'XXX', '..X', 'XXX'],
  E: ['XXX', 'X..', 'XXX', 'X..', 'XXX'],
};

/** The CSE building: a concrete-and-glass block with a rooftop sign. Faces +z. */
export function buildCSE() {
  const HW = 7, HD = 3, FLOORS = 5;
  const cells = [];
  const CONC = ['#c9cfd8', '#bfc6d1', '#b5bcc9'];
  const conc = (x, y, z) => CONC[Math.floor(rnd(x, y, z) * CONC.length)];
  // ground-floor lobby set back behind glass
  for (let y = 0; y <= 1; y++) {
    for (let x = -HW; x <= HW; x++) for (const z of [-HD, HD]) {
      const glass = Math.abs(x) < HW && (x + HW) % 4 !== 0;
      cells.push([x, y, z, glass ? '#ffd98a' : conc(x, y, z), glass ? 0.7 : 0]);
    }
    for (const x of [-HW, HW]) for (let z = -HD + 1; z <= HD - 1; z++) cells.push([x, y, z, conc(x, y, z), 0]);
  }
  let y = 2;
  for (let f = 0; f < FLOORS; f++) {
    for (let x = -HW; x <= HW; x++) for (let z = -HD; z <= HD; z++) {
      if (Math.abs(x) !== HW && Math.abs(z) !== HD) continue;
      cells.push([x, y, z, conc(x, y, z), 0]);
    }
    y++;
    for (let x = -HW; x <= HW; x++) for (let z = -HD; z <= HD; z++) {
      if (Math.abs(x) !== HW && Math.abs(z) !== HD) continue;
      const pier = (Math.abs(z) === HD ? x + HW : z + HD) % 4 === 0;
      const dark = rnd(x, y, z) < 0.3;
      cells.push([x, y, z, pier ? '#9aa3b2' : dark ? '#3a445c' : '#ffd27a', pier || dark ? 0 : 0.8]);
    }
    y++;
  }
  cells.push(...boxCells(-HW, HW, y, y, -HD, HD, null, { pick: (x, yy, z) => shade('#6b7587', (rnd(x, yy, z) - 0.5) * 0.2) }));
  const roofY = y;
  // rooftop letters, lit gold, standing on the roof edge facing +z
  const sign = [];
  const gap = 1, lw = 3, total = 3 * lw + 2 * gap;
  ['C', 'S', 'E'].forEach((ch, i) => {
    LETTERS[ch].forEach((row, ry) => {
      for (let rx = 0; rx < lw; rx++) if (row[rx] === 'X') sign.push([-Math.floor(total / 2) + i * (lw + gap) + rx, roofY + 7 - ry, HD - 1, '#ffd23f', 2.6]);
    });
  });
  for (const x of [-HW + 2, HW - 2]) sign.push([x, roofY + 1, HD - 1, '#6b7280', 0]);
  for (let x = -HW + 2; x <= HW - 2; x++) sign.push([x, roofY + 2, HD - 1, '#232a3d', 0]);
  const body = voxBuild(cells, { roughness: 0.8 });
  const letters = voxBuild(sign, { shadow: false });
  const group = new THREE.Group();
  group.add(body, letters);
  return { group, meshes: [body, letters], roofY, hw: HW, hd: HD, height: roofY + 8 };
}

/** Fallen Star: a little house that has landed on the roof at a slant (Stuart Collection nod). */
export function buildFallenStar() {
  const cells = [];
  const WALL = ['#f3e3c3', '#ecd9b3'];
  for (let y = 0; y < 3; y++) for (let x = -2; x <= 2; x++) for (let z = -1; z <= 1; z++) {
    if (Math.abs(x) !== 2 && Math.abs(z) !== 1 && y < 2) continue;
    const win = y === 1 && z === 1 && (x === -1 || x === 1);
    const door = y < 2 && z === 1 && x === 0 && y === 0;
    cells.push([x, y, z, door ? '#5a3a22' : win ? '#7dd3fc' : WALL[(x + z + y) & 1], win ? 1.2 : 0]);
  }
  for (let r = 0; r < 3; r++) for (let x = -3; x <= 3; x++) for (let z = -2 + r; z <= 2 - r; z++) {
    if (z !== -2 + r && z !== 2 - r && x !== -3 && x !== 3) continue;
    cells.push([x, 3 + r, z, r % 2 ? '#b8412f' : '#a63a2a', 0]);
  }
  cells.push([2, 5, 0, '#7a3b2b', 0], [2, 6, 0, '#7a3b2b', 0]);
  const mesh = voxBuild(cells, { roughness: 0.8 });
  const group = new THREE.Group();
  group.add(mesh);
  // a slow twinkle of stardust above the roof
  const dust = voxBuild([[0, 8, 0, '#fff3b0', 3], [1, 8, 0, '#fff3b0', 2], [-1, 8, 0, '#fff3b0', 2], [0, 9, 0, '#fff3b0', 2], [0, 7, 0, '#fff3b0', 2]], { shadow: false });
  group.add(dust);
  return { group, meshes: [mesh], update(t) { dust.rotation.y = t; dust.scale.setScalar(0.8 + 0.25 * Math.sin(t * 3)); } };
}

/** Scripps-style pier heading +x: planked deck on pilings, lamp posts, a hut at the end. */
export function buildPier(len = 18) {
  const cells = [];
  for (let x = 0; x < len; x++) for (let z = -2; z <= 2; z++) cells.push([x, 0, z, (x + z) % 2 ? '#8b6f4e' : '#7a6040', 0]);
  for (let z = -1; z <= 1; z++) cells.push([-1, -0.75, z, '#6b5238', 0]);     // the step up from the sand (index.js addPierDeck)
  for (let x = 1; x < len; x += 3) for (const z of [-2, 2]) for (let y = -9; y < 0; y++) cells.push([x, y, z, '#4a3b2a', 0]);
  for (let x = 0; x < len; x += 2) for (const z of [-2, 2]) { cells.push([x, 1, z, '#6b5238', 0]); }
  for (let x = 0; x < len; x++) for (const z of [-2, 2]) cells.push([x, 2, z, '#6b5238', 0]);
  for (let x = 4; x < len - 6; x += 6) for (const z of [-2, 2]) { cells.push([x, 1, z, '#3b4256', 0], [x, 2, z, '#3b4256', 0], [x, 3, z, '#3b4256', 0], [x, 4, z, '#ffe6a3', 2.4]); }
  // end platform and hut
  for (let x = len; x < len + 6; x++) for (let z = -3; z <= 3; z++) cells.push([x, 0, z, (x + z) % 2 ? '#8b6f4e' : '#7a6040', 0]);
  for (let x = len + 1; x < len + 6; x += 2) for (const z of [-3, 3]) for (let y = -9; y < 0; y++) cells.push([x, y, z, '#4a3b2a', 0]);
  for (let y = 1; y <= 3; y++) for (let x = len + 1; x <= len + 4; x++) for (let z = -2; z <= 2; z++) {
    if (x !== len + 1 && x !== len + 4 && Math.abs(z) !== 2) continue;
    const win = y === 2 && ((Math.abs(z) === 2 && x % 2 === 0) || (x === len + 4 && z === 0));
    cells.push([x, y, z, win ? '#ffe6a3' : '#e9edf3', win ? 1.6 : 0]);
  }
  for (let x = len; x <= len + 5; x++) for (let z = -3; z <= 3; z++) cells.push([x, 4, z, '#1e3a8a', 0]);
  const beaconX = len + 2;
  cells.push([beaconX, 5, 0, '#374151', 0], [beaconX, 6, 0, '#fff7d6', 3]);
  const mesh = voxBuild(cells, { roughness: 0.85 });
  const group = new THREE.Group();
  group.add(mesh);
  return { group, meshes: [mesh], length: len + 6, beaconX, height: 7 };
}

/** A few boulders for the sea lions to rest on. */
export function buildRocks() {
  const cells = [];
  for (const [cx, cz, r] of [[0, 0, 2.6], [3.5, 1.5, 1.8], [-2.5, 2, 1.6]]) {
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
      const d = Math.hypot(x - cx, z - cz);
      if (d > r) continue;
      const h = Math.max(1, Math.round((r - d) * 1.1 + 0.6));
      for (let y = 0; y < h; y++) cells.push([x, y, z, ['#5b6472', '#4d5563', '#6b7382'][Math.floor(rnd(x, y, z) * 3)], 0]);
    }
  }
  const mesh = voxBuild(cells, { roughness: 0.95 });
  const group = new THREE.Group();
  group.add(mesh);
  return { group, meshes: [mesh] };
}

/** Snake Path: a winding mosaic snake laid into the ground; the head has eyes. Cells are world offsets. */
export function snakeCells(points) {
  const cells = [];
  const pal = ['#22c55e', '#facc15', '#16a34a', '#fb923c', '#0ea5e9'];
  points.forEach(([x, z], i) => {
    const c = pal[(Math.floor(i / 2)) % pal.length];
    cells.push([x, 0, z, c, 0.15]);
    if (i < points.length - 3) cells.push([x + 1, 0, z, c, 0.15]);
  });
  const [hx, hz] = points[points.length - 1];
  cells.push([hx, 0, hz, '#ef4444', 0.3], [hx + 1, 0, hz, '#ef4444', 0.3], [hx, 0.4, hz - 0.3, '#ffffff', 1.6], [hx + 1, 0.4, hz - 0.3, '#ffffff', 1.6]);
  return cells;
}
