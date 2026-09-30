// regions/tsinghua.js: Tsinghua University, the undergrad years (B.S. Computer Science & Technology,
// 2021–2025). Arrive through 二校门, the Second Gate; the campus is a small night-time island with the
// lotus pond (荷塘月色), 清华学堂, the Grand Auditorium (大礼堂) and its lawn, the CS&T building, the
// Zijing (紫荆) dorms where Zhuo cooks tomato & egg, Zhuo's old Yao Class classroom with a whiteboard
// puzzle, and bicycles everywhere. The boss, The Final Exam, awards the Diploma.
import {
  terrain, props, scatter, platform, registerArt, registerEnemyKind, spawnEnemy, spawnBoss,
  spawnNpc, interactable, trigger, pickup, portal, quest, egg, say, banner, toast, sfx, dialog, cinematic,
  ride, dismount, onUpdate, onEnter, hash3,
} from '../regions.js';
import { heal } from '../player.js';
import { THU_ART, THU_GLOW } from './art-tsinghua.js';

// ---------------------------------------------------------------- layout (region-local cells)
const R = 24.5;
const inIsland = (x, z) => {
  const r = R + Math.sin(x * 0.7 + z * 0.3) * 0.5;
  return (Math.abs(x) / r) ** 8 + (Math.abs(z) / r) ** 8 <= 1;
};
const inBox = (x, z, [x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
const POND = { x: -14, z: -3 };
const pondD = (x, z) => Math.hypot((x - POND.x) / 1.15, z - POND.z);
const STONES = new Set(['-7,-3', '-9,-3', '-11,-3']);
const AUD = [-7, 7, -23, -16];            // 大礼堂 (the roof is climbable: platforms on its west side)
const DOME = { x: 0, z: -19.5 };
const CST = [13, 21, -22, -14];           // CS&T building (roof reachable by a jump route on its west side)
const XT = [13, 22, -10, -5];             // 清华学堂
const DORM = [-24, -14, 5, 12];           // 紫荆 dorms
const CLASS = [11, 21, 3, 11];            // Yao Class classroom (open-air, low walls)
const LAWN = [-10, 10, -14, -3];          // the exam hall
const PATIO = [-14, -7, 14, 19];          // Zhuo's kitchen patio

function heightAt(x, z) {
  if (!inIsland(x, z)) return null;
  if (inBox(x, z, AUD)) {
    const dd = Math.hypot(x - DOME.x, z - DOME.z);
    return dd < 4.6 ? 8 + Math.min(5, Math.ceil(4.6 - dd)) : 8;
  }
  if (z === -15 && x >= -7 && x <= 7) return 3;                     // the portico step
  if (inBox(x, z, CST)) return 12;
  if (inBox(x, z, XT)) return 6 + Math.min(z + 10, -5 - z);         // a pitched roof
  if (inBox(x, z, DORM)) return 10;
  const pd = pondD(x, z);
  if (pd < 2.3) return 2;                                            // the pavilion island
  if (pd < 6.2) return STONES.has(`${x},${z}`) ? 1 : 0;              // water (wadeable) and stepping stones
  return 2;
}
function typeAt(x, z) {
  if (inBox(x, z, AUD)) return Math.hypot(x - DOME.x, z - DOME.z) < 4.6 ? 'dome' : 'brick';
  if (z === -15 && x >= -7 && x <= 7) return 'marble';
  if (inBox(x, z, CST)) return 'cst';
  if (inBox(x, z, XT)) return 'roof';
  if (inBox(x, z, DORM)) return 'dorm';
  const pd = pondD(x, z);
  if (pd < 2.3) return 'moss';
  if (pd < 6.2) return STONES.has(`${x},${z}`) ? 'stone' : 'water';
  if (inBox(x, z, CLASS)) return 'wood';
  if (inBox(x, z, PATIO)) return 'patio';
  if (Math.abs(x) <= 1 && z >= -14 && z <= 16) return 'path';
  if ((z === 1 || z === 2) && x >= -9 && x <= 22) return 'path';
  if (x === -8 && z >= 3 && z <= 13) return 'path';
  if (inBox(x, z, [-5, 5, 15, 24])) return 'plaza';
  if (inBox(x, z, [4, 12, 18, 23])) return 'path';
  if (inBox(x, z, LAWN)) return (Math.floor(x / 2) & 1) ? 'lawn2' : 'lawn';
  return hash3(x, 7, z) < 0.5 ? 'grass' : 'grass2';
}
const PALETTE = {
  grass: ['#3f8f5f', '#3a8558', '#46966a'],
  grass2: ['#37805a', '#3c8a5c'],
  lawn: ['#5cb85c', '#55ad55'],
  lawn2: ['#4ea24e', '#489a48'],
  path: ['#b8b1a3', '#aea796', '#c2bbad'],
  plaza: ['#d6d0c4', '#cbc5b8'],
  water: ['#1e3a8a', '#1d4ed8', '#1e40af'],
  moss: ['#4d7c0f', '#3f6212'],
  stone: ['#a8a29e', '#78716c'],
  brick: ['#9a3b2e', '#8c3428', '#a3442f'],
  dome: ['#5f8f7a', '#6b9a84', '#577f6d'],
  marble: ['#e7e5e4', '#d6d3d1'],
  cst: ['#64748b', '#5b6b82'],
  roof: ['#6b7280', '#5f6570'],
  dorm: ['#d4b8a0', '#cfae94'],
  wood: ['#a0703f', '#94663a'],
  patio: ['#d1c7b7', '#c4baa9'],
};

// The Final Exam's written questions. Every right answer is a fact from the CV; the rest are jokes.
const QUESTIONS = [
  { q: 'Complete the motto: 自强不息，____', right: '厚德载物', wrong: ['好好学习', '明天再说', '早点睡觉'] },
  { q: 'Roommate, labmate, Yao Class alumnus, best cook in the building?', right: 'Zhuo Chen', wrong: ['The rice cooker', 'Reviewer #2', 'A Deadline Imp'] },
  { q: 'Starry-Next, the graduation project, is a networking stack written in…', right: 'Rust', wrong: ['Verilog', 'LaTeX', 'Pure vibes'] },
  { q: 'Yichen’s major at Tsinghua:', right: 'CS & Technology', wrong: ['Lotus Pond Studies', 'Bicycle Parking', 'Applied Tomato & Egg'] },
  { q: 'CST-OJ judges…', right: 'Data-structure homework', wrong: ['Cooking contests', 'Your life choices', 'Essays about ponds'] },
  { q: 'You walked in through…', right: '二校门 · the Second Gate', wrong: ['A wormhole', 'The cafeteria window', 'The back door'] },
  { q: 'Undergrad years at Tsinghua:', right: '2021 – 2025', wrong: ['Yes', 'One very long semester', 'Still loading…'] },
];

export default {
  id: 'tsinghua',
  name: 'Tsinghua University',
  subtitle: '自强不息，厚德载物 · B.S. Computer Science & Technology, 2021–2025',
  size: 52,
  spawn: [0, 20.5],
  sky: { tint: '#aab8ff', ground: '#0c1233', fog: '#0a0f2c', density: 0.0095, sun: 1.5 },
  zones: {
    gate: { x: 0, z: 18.5, r: 5.5, label: '二校门 · The Second Gate' },
    bikes: { x: 8, z: 20.5, r: 4, label: 'Bicycle rack (all identical)' },
    pond: { x: -14, z: -3, r: 8, label: '荷塘 · The Lotus Pond' },
    lawn: { x: 0, z: -8.5, r: 7, label: '大草坪 · The Exam Lawn' },
    aud: { x: 0, z: -19.5, r: 6.5, label: '大礼堂 · The Grand Auditorium' },
    xuetang: { x: 17.5, z: -7.5, r: 4.5, label: '清华学堂 · Tsinghua Xuetang' },
    yao: { x: 16, z: 7, r: 5.5, label: '姚班 · Zhuo’s old Yao Class classroom' },
    cst: { x: 17, z: -18, r: 6, label: 'CS&T building' },
    dorm: { x: -16, z: 12, r: 7, label: '紫荆 · Zijing dorms' },
  },

  build(ctx) {
    for (const [name, art] of Object.entries(THU_ART)) registerArt(name, art, THU_GLOW[name] || null);
    const st = () => ctx.state;
    const done = (k) => { st()[k] = true; ctx.save(); };

    // ================================================================ terrain
    terrain(ctx, { size: 52, height: heightAt, type: typeAt, palette: PALETTE, skirt: 7 });

    // ================================================================ scenery
    const S = [];          // decorative cells (one draw call)
    const Bk = [];         // solid cells (one draw call, columns blocked)
    const put = (list, x, y, z, c, g = 0) => list.push([x, y, z, c, g]);
    const pick = (arr, x, y, z) => arr[Math.floor(hash3(x, y, z) * arr.length)];

    // -- 二校门, the Second Gate: white, three bays, the centre one open
    for (let y = 3; y <= 9; y++) for (const x of [-5, -4, -3, -2, 2, 3, 4, 5]) for (const z of [17, 18]) put(Bk, x, y, z, (x + y) % 2 ? '#f1f5f9' : '#e2e8f0');
    for (let y = 10; y <= 11; y++) for (let x = -5; x <= 5; x++) for (const z of [17, 18]) put(S, x, y, z, '#f8fafc');
    for (let x = -6; x <= 6; x++) for (let z = 16; z <= 19; z++) put(S, x, 12, z, (x + z) % 2 ? '#cbd5e1' : '#b6c2d1');
    for (let x = -5; x <= 5; x++) for (const z of [17, 18]) put(S, x, 13, z, '#94a3b8');
    for (const zf of [16.94, 18.06]) {
      for (let x = -1; x <= 1; x++) for (let y = 10; y <= 11; y++) put(S, x, y, zf, x === 0 && y === 11 ? '#111827' : '#facc15', x === 0 && y === 11 ? 0 : 0.9);
      for (const x of [-4, -3, 3, 4]) for (let y = 4; y <= 6; y++) put(S, x, y, zf, '#1e293b');
    }
    // the motto stone
    for (let x = -9; x <= -7; x++) { put(Bk, x, 3, 14, '#9ca3af'); put(Bk, x, 4, 14, '#6b7280'); put(S, x, 4, 14.56, '#facc15', 1.2); }

    // -- trees, willows and lamps
    const tree = (x, z, willow = false) => {
      const gy = heightAt(x, z);
      const ty = typeAt(x, z);
      if (gy !== 2 || ty === 'path' || ty === 'lawn' || ty === 'lawn2') return;
      const trunkTop = gy + (willow ? 3 : 2);
      for (let y = gy + 1; y <= trunkTop; y++) put(Bk, x, y, z, '#6b4423');
      const greens = willow ? ['#65a30d', '#84cc16', '#4d7c0f'] : ['#166534', '#15803d', '#1f7a3f'];
      const top = trunkTop + 1;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        put(S, x + dx, top, z + dz, pick(greens, x + dx, top, z + dz));
        put(S, x + dx, top + 1, z + dz, pick(greens, x + dx, top + 1, z + dz));
        if (willow && dx && dz) { put(S, x + dx * 1.4, top - 1, z + dz * 1.4, '#a3e635'); put(S, x + dx * 1.4, top - 2, z + dz * 1.4, '#bef264'); }
      }
      for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) put(S, x + dx, top + 2, z + dz, pick(greens, x, top + 2, z + dz));
    };
    for (const z of [13, 9, 5]) { tree(-3, z); tree(3, z); }
    tree(-3, -1); tree(3, -1);
    for (let i = 0; i < 7; i++) {
      const a = 0.35 + i * 0.9;
      tree(Math.round(POND.x + Math.cos(a) * 8.4), Math.round(POND.z + Math.sin(a) * 7.4), true);
    }
    for (const [x, z] of [[-20, -10], [-19, -20], [-12, -21], [-18, 20], [-22, 16], [14, 20], [20, 16], [23, 8], [23, -2], [-5, 10], [18, 14], [-22, 0], [8, -24], [-4, -24], [22, -24]]) tree(x, z);
    const lamp = (x, z) => {
      const gy = heightAt(x, z);
      for (let y = gy + 1; y <= gy + 3; y++) put(S, x, y, z, '#1f2937');
      put(S, x, gy + 4, z, '#fde68a', 2.6);
    };
    for (const z of [11, 7, 3, -3]) { lamp(-2, z); lamp(2, z); }
    for (const [x, z] of [[-10, -3], [10, -3], [-8, 14], [10, 6], [-6, 1], [-5, 14], [5, 14]]) lamp(x, z);

    // -- 大礼堂: portico columns, door, windows, a golden pinnacle
    for (const x of [-6, -4, -2, 2, 4, 6]) for (let y = 4; y <= 7; y++) put(Bk, x, y, -15, '#f5f5f4');
    for (let x = -7; x <= 7; x++) put(S, x, 8, -15, '#e7e5e4');
    for (let x = -1; x <= 1; x++) for (let y = 4; y <= 6; y++) put(S, x, y, -15.94, '#3f2a1d');
    for (const x of [-5, -3, 3, 5]) for (let y = 5; y <= 6; y++) put(S, x, y, -15.94, '#fde68a', 1.4);
    for (const zf of [-19, -21]) for (const [xf, s] of [[-7.5, -1], [7.5, 1]]) for (let y = 4; y <= 6; y++) put(S, xf - s * 0.44, y, zf, '#fde68a', y === 6 ? 0.4 : 1.3);
    put(Bk, 0, 14, -20, '#facc15', 1.5); put(Bk, 0, 15, -20, '#fde047', 2);

    // -- windows on the tall buildings (lit or dark)
    const winX = (xf, s, z0, z1, ys, lit = 0.6) => { for (let z = z0; z <= z1; z += 2) for (const y of ys) { const on = hash3(Math.round(xf), y, z) < lit; put(S, xf - s * 0.44, y, z, on ? '#fde68a' : '#1e293b', on ? 1.6 : 0); } };
    const winZ = (zf, s, x0, x1, ys, lit = 0.6) => { for (let x = x0; x <= x1; x += 2) for (const y of ys) { const on = hash3(x, y, Math.round(zf)) < lit; put(S, x, y, zf - s * 0.44, on ? '#fde68a' : '#1e293b', on ? 1.6 : 0); } };
    winX(12.5, -1, -21, -15, [4, 6, 8, 10]); winX(21.5, 1, -21, -15, [4, 6, 8, 10]);
    winZ(-13.5, 1, 14, 20, [6, 8, 10]); winZ(-22.5, -1, 14, 20, [4, 6, 8, 10]);
    for (const x of [16, 17]) for (const y of [3, 4]) put(S, x, y, -13.94, '#22d3ee', 0.7);
    winZ(-4.5, 1, 14, 21, [4, 5], 0.8); winZ(-10.5, -1, 14, 21, [4, 5], 0.5);
    for (const y of [3, 4]) put(S, 17, y, -4.94, '#3f2a1d');
    winZ(12.5, 1, -23, -15, [4, 6, 8], 0.55); winX(-13.5, 1, 6, 10, [4, 6, 8], 0.55);
    for (let x = -24; x <= -14; x++) put(S, x, 10.6, 12.06, '#a78bfa', 0.5);          // a purple 紫荆 trim

    // -- the pond: lotus pads and flowers, the pavilion, stepping stones
    for (let i = 0; i < 26; i++) {
      const a = i * 2.39, r = 2.8 + (i % 5) * 0.7;
      const x = Math.round(POND.x + Math.cos(a) * r * 1.1), z = Math.round(POND.z + Math.sin(a) * r);
      if (heightAt(x, z) !== 0 || (Math.abs(z + 3) < 1 && x > -12)) continue;
      put(S, x, 0.08, z, i % 2 ? '#15803d' : '#16a34a');
      if (i % 3 === 0) { put(S, x, 1, z, '#f9a8d4', 1.3); }
    }
    for (const [x, z] of [[-15, -4], [-13, -4], [-15, -2], [-13, -2]]) for (let y = 3; y <= 5; y++) put(Bk, x, y, z, '#b91c1c');
    for (let x = -16; x <= -12; x++) for (let z = -5; z <= -1; z++) put(S, x, 6, z, '#334155');
    for (let x = -15; x <= -13; x++) for (let z = -4; z <= -2; z++) put(S, x, 7, z, '#1f2937');
    put(S, -14, 8, -3, '#facc15', 1.2);

    // -- 紫荆 dorm patio: Zhuo's stove, wok and a table
    for (let x = -11; x <= -9; x++) put(Bk, x, 3, 16, '#374151');
    put(S, -10, 4, 16, '#111827'); put(S, -10.3, 4.4, 16, '#ef4444', 1); put(S, -9.7, 4.4, 16.1, '#fde047', 1);
    put(S, -9.2, 3.8, 16, '#f97316', 2.2);
    for (let x = -13; x <= -12; x++) for (let z = 17; z <= 18; z++) put(Bk, x, 3, z, '#a16207');

    // -- Yao Class classroom: low walls, the whiteboard, desks
    const [cx0, cx1, cz0, cz1] = CLASS;
    for (let x = cx0; x <= cx1; x++) for (let z = cz0; z <= cz1; z++) {
      const edge = x === cx0 || x === cx1 || z === cz0 || z === cz1;
      if (!edge) continue;
      if (x === cx0 && z >= 6 && z <= 8) continue;               // west door
      if (z === cz1 && x >= 15 && x <= 17) continue;             // south door
      for (let y = 3; y <= 4; y++) put(Bk, x, y, z, (x + z + y) % 2 ? '#e2e8f0' : '#cbd5e1');
    }
    for (let x = 12; x <= 20; x++) for (let y = 5; y <= 7; y++) put(S, x, y, 3, '#f8fafc', 0.25);
    for (let y = 5; y <= 8; y++) { put(S, 11, y, 3, '#94a3b8'); put(S, 21, y, 3, '#94a3b8'); }
    for (let x = 11; x <= 21; x++) put(S, x, 8, 3, '#94a3b8');
    for (let x = 12; x <= 20; x++) for (const y of [4.5, 5]) if (hash3(x, y * 2, 3) < 0.45 && x % 2) put(S, x, y + 0.5, 3.1, '#1e3a8a');
    for (const x of [13, 15, 17, 19]) { put(Bk, x, 3, 9, '#92400e'); put(S, x, 3, 10, '#57534e'); }

    // -- the moon, and its reflection (appears for the patient)
    const moon = [];
    for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) {
      if (dx * dx + dy * dy > 17) continue;
      const crater = (dx === 1 && dy === 1) || (dx === -2 && dy === -1) || (dx === 2 && dy === -2);
      moon.push([-18 + dx, 30 + dy, -52, crater ? '#e5e7c4' : '#fef9c3', crater ? 1.4 : 2.4]);
    }
    props(ctx, moon, { shadow: false });
    const refl = [];
    for (let dx = -2; dx <= 2; dx++) for (let dz = -1; dz <= 1; dz++) if (dx * dx + dz * dz * 2 <= 5) refl.push([-14 + dx, 0.06, -7.5 + dz, '#fef9c3', 1.6]);
    const reflMesh = props(ctx, refl, { shadow: false });
    reflMesh.visible = !!st().moon;

    // -- fireflies (small voxels: built at 5x and scaled down)
    const flies = [];
    for (let i = 0; i < 28; i++) {
      const near = i < 16;
      const x = near ? POND.x + Math.cos(i * 1.7) * (3 + (i % 4) * 1.4) : -9 + (i % 7) * 3;
      const z = near ? POND.z + Math.sin(i * 1.7) * (3 + (i % 3) * 1.3) : (i % 2 ? 4 : -2) + (i % 5);
      flies.push([x * 5, (2.2 + (i % 4) * 0.6) * 5, z * 5, i % 3 ? '#fef08a' : '#bef264', 3]);
    }
    const flyMesh = props(ctx, flies, { shadow: false });
    flyMesh.scale.setScalar(0.2);

    // -- steam over Zhuo's wok
    const steamMesh = props(ctx, [[-10 * 4, 5 * 4, 16 * 4, '#f8fafc', 0.6], [-10.2 * 4, 5.6 * 4, 16.1 * 4, '#e2e8f0', 0.5], [-9.8 * 4, 6.2 * 4, 15.9 * 4, '#f1f5f9', 0.4]], { shadow: false });
    steamMesh.scale.setScalar(0.25);
    steamMesh.material.transparent = true;
    steamMesh.material.opacity = 0.7;

    // a CS&T window that is always on: someone is debugging at 3 a.m.
    const late = props(ctx, [[21.06, 8, -18, '#bae6fd', 1.8]], { shadow: false });

    props(ctx, S, { shadow: true });
    props(ctx, Bk, { block: true });

    // -- bicycles everywhere (one draw call for the parked ones)
    const bikes = [];
    for (let i = 0; i < 8; i++) for (const z of [19.5, 21.5]) bikes.push({ x: 4.8 + i * 1.05, z, rotY: Math.PI / 2 + (hash3(i, 1, z) - 0.5) * 0.3, scale: 0.12 });
    for (let i = 0; i < 4; i++) bikes.push({ x: 9.5, z: 12 + i * 1.05, rotY: (hash3(i, 2, 3) - 0.5) * 0.3, scale: 0.12 });
    for (let i = 0; i < 4; i++) bikes.push({ x: 12.4 + i * 1.05, z: -12.2, rotY: Math.PI / 2, scale: 0.12 });
    for (let i = 0; i < 4; i++) bikes.push({ x: -6.5, z: 15 + i * 1.05, rotY: 0.05 * i, scale: 0.12 });
    scatter(ctx, 'thu-bike', bikes, { maxHalf: 1 });

    // ================================================================ enemies (and ambient life)
    registerEnemyKind('thu-imp', { name: 'Deadline Imp', sprite: 'thu-imp', hp: 22, speed: 5, dmg: 6, type: 'Fire', xp: 14, gold: 12, behaviour: 'swarm', scale: 0.17, color: '#ef4444' });
    registerEnemyKind('thu-midterm', { name: 'Midterm Slime', sprite: 'thu-midterm', hp: 40, speed: 3, dmg: 8, type: 'Water', xp: 18, gold: 18, behaviour: 'chase', scale: 0.19, color: '#f1f5f9' });
    registerEnemyKind('thu-ghost', { name: 'Gaokao Ghost', sprite: 'thu-ghost', hp: 55, speed: 3, dmg: 9, type: 'Ghost', xp: 40, gold: 40, behaviour: 'ranged', flying: true, proj: 'psy', rate: 2500, aggro: 10, scale: 0.2, color: '#e0e7ff' });
    registerEnemyKind('thu-pset', { name: 'Problem-Set Pile', sprite: 'thu-pset', hp: 45, speed: 3.2, dmg: 10, type: 'Normal', xp: 24, gold: 20, behaviour: 'charge', rate: 2600, scale: 0.19, color: '#fafaf9' });
    registerEnemyKind('thu-seat', { name: 'Seat Reserver', sprite: 'thu-seat', hp: 30, dmg: 5, type: 'Normal', xp: 15, gold: 15, behaviour: 'turret', rate: 3200, aggro: 8, proj: 'bubble', scale: 0.18, color: '#2563eb' });
    registerEnemyKind('thu-scroll', { name: 'Pop Quiz', sprite: 'thu-scroll', hp: 14, speed: 5.5, dmg: 5, type: 'Psychic', xp: 6, gold: 5, behaviour: 'swarm', scale: 0.15, respawn: false, color: '#fde68a' });
    registerEnemyKind('thu-wild-bike', { name: 'Feral Bicycle', sprite: 'thu-bike', hp: 20, speed: 2.4, behaviour: 'wander', xp: 2, gold: 2, scale: 0.13, color: '#7c3aed' });
    registerEnemyKind('thu-duck', { name: 'Pond Duck', sprite: 'thu-duck', hp: 15, speed: 1.4, behaviour: 'wander', xp: 1, gold: 1, scale: 0.13, color: '#f8fafc' });

    for (const [x, z] of [[4, 6], [-4, 3], [6, -1]]) spawnEnemy(ctx, { kind: 'thu-imp', x, z });
    for (const [x, z] of [[-19, 2], [15, 14], [-3, 10]]) spawnEnemy(ctx, { kind: 'thu-midterm', x, z });
    for (const [x, z] of [[18, -12], [22, 1]]) spawnEnemy(ctx, { kind: 'thu-pset', x, z });
    spawnEnemy(ctx, { kind: 'thu-seat', x: 19.6, z: 9.4 });
    const findGaokao = egg('thu-gaokao', 'Gaokao Ghost, laid to rest', 'A (joke) ghost haunts the woods behind the auditorium.', 'It was just an exam. It was always just an exam.');
    spawnEnemy(ctx, { kind: 'thu-ghost', x: -17, z: -15, onDeath: () => { findGaokao(); say('me', 'Rest now. The exam is over. It has been over for years.'); } });
    spawnEnemy(ctx, { kind: 'thu-wild-bike', x: 7, z: 10 });
    spawnEnemy(ctx, { kind: 'thu-wild-bike', x: -6, z: -1 });
    spawnEnemy(ctx, { kind: 'thu-duck', x: -15, z: -7 });
    spawnEnemy(ctx, { kind: 'thu-duck', x: -10, z: 0 });

    // ================================================================ the boss: The Final Exam
    const findDiploma = egg('thu-diploma', 'Graduated', 'Pass The Final Exam on the lawn before 大礼堂.', 'B.S. Computer Science & Technology, Tsinghua University, 2021–2025.');
    const boss = spawnBoss(ctx, {
      id: 'thu-final-exam', name: 'The Final Exam', sprite: 'thu-exam', scale: 0.3, x: 0, z: -9, hp: 300, type: 'Psychic', r: 1.5,
      pattern: ['fan', 'summon', 'fan', 'rings'],
      phases: [
        { below: 0.66, pattern: ['volley', 'fan', 'summon', 'rings'] },
        { below: 0.33, pattern: ['nova', 'fan', 'summon', 'charge'], speed: 1.9 },
      ],
      minion: 'thu-scroll', aggro: 11, contact: 11, speed: 1.3, color: '#ef4444',
      reward: { gold: 400, xp: 160 }, drop: 'diploma', respawn: false,
      onDefeat: (b, { first }) => {
        endQuestion(true);
        findDiploma();
        if (first) {
          cinematic(ctx, { x: 0, y: 10, z: -19.5, pitch: 0.3, dist: 22, seconds: 2.6 });
          setTimeout(() => say('me', 'B.S. in Computer Science & Technology. 2021 to 2025. Worth every Deadline Imp.'), 2700);
        } else say('me', 'Passed. Again.');
      },
    });

    // Written questions: every so often the exam stops shooting and asks one. Four answer pads on the
    // lawn light up with A–D; stand on the right one when the time runs out. Right: the exam takes
    // 12% damage. Wrong pads get a red "incorrect" blast (readable, avoidable). Blank: nothing happens.
    const PADS = [{ k: 'A', x: -6, z: -11, c: '#f87171' }, { k: 'B', x: 6, z: -11, c: '#60a5fa' }, { k: 'C', x: -6, z: -5, c: '#34d399' }, { k: 'D', x: 6, z: -5, c: '#fbbf24' }];
    for (const p of PADS) {
      const cells = [];
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) cells.push([p.x + dx, 2.06, p.z + dz, (dx + dz) % 2 ? p.c : '#f8fafc', dx || dz ? 0.35 : 0.7]);
      p.mesh = props(ctx, cells, { shadow: false });
      p.plate = interactable(ctx, { x: p.x, z: p.z, r: 1.6, label: p.k, prompt: 'stand here to answer', plateY: 2.4, onInteract: () => {} });
      p.plate.enabled = false;
    }
    const Q = { active: null, cd: 7, t: 0, n: 0, shown: -1, resumeAt: 0, order: QUESTIONS.map((_, i) => i) };
    for (let i = Q.order.length - 1; i > 0; i--) { const j = Math.floor(ctx.rand() * (i + 1)); [Q.order[i], Q.order[j]] = [Q.order[j], Q.order[i]]; }
    const ASK_S = 6;
    const padUnder = () => PADS.find((p) => Math.abs(ctx.player.x - p.x) <= 1.7 && Math.abs(ctx.player.z - p.z) <= 1.7) || null;
    function ask() {
      const q = QUESTIONS[Q.order[Q.n % Q.order.length]];
      Q.n++;
      const answers = [q.right, ...q.wrong];
      for (let i = answers.length - 1; i > 0; i--) { const j = Math.floor(ctx.rand() * (i + 1)); [answers[i], answers[j]] = [answers[j], answers[i]]; }
      Q.active = { q, answers };
      Q.t = ASK_S; Q.shown = -1;
      PADS.forEach((p, i) => { p.answer = answers[i]; p.plate.enabled = true; });
      Q.saved = boss.nextAttack;
      boss.nextAttack = Infinity;
      sfx('rune');
      banner(`Question ${Q.n}`, q.q, 'scroll-text');
      if (Q.n === 1) toast('Written question! Stand on the pad with the right answer before time runs out.', { icon: 'scroll-text' });
    }
    function endQuestion(silent = false) {
      if (!Q.active) return;
      for (const p of PADS) { p.plate.enabled = false; p.mesh.userData.setHi(0); }
      if (!silent && Number.isFinite(Q.saved)) boss.nextAttack = Q.saved + ASK_S * 1000;
      Q.active = null;
    }
    function grade() {
      const { q } = Q.active;
      const on = padUnder();
      for (const p of PADS) if (p.answer !== q.right) boss.hazard(p.x + ctx.ox, p.z + ctx.oz, 1.9, '#ef4444', 150, 1300);
      const right = PADS.find((p) => p.answer === q.right);
      right.mesh.userData.setHi(1);
      if (on && on === right) {
        sfx('stamp');
        toast(`Correct: ${q.right}. The Final Exam loses 12% of its confidence.`, { icon: 'check', tone: 'good' });
        boss.hit(Math.ceil(boss.maxHp * 0.12));
      } else if (on) {
        sfx('error');
        toast(`Wrong! The answer was ${q.right}. (Partial credit: none. Dodge!)`, { icon: 'triangle-alert', tone: 'bad' });
      } else toast(`No answer. It was ${q.right}. Blank answers score nothing, but nothing explodes under you either.`, { icon: 'scroll-text' });
      endQuestion();
    }
    let lastPhase = 0;
    onUpdate(ctx, (dt) => {
      if (!boss.alive) { endQuestion(true); return; }
      const f = boss.hp / boss.maxHp;
      const ph = f <= 0.33 ? 2 : f <= 0.66 ? 1 : 0;
      if (ph > lastPhase) {
        lastPhase = ph;
        sfx('boom');
        if (ph === 1) banner('Section B', 'Short answers. Very short. Mostly fireballs.', 'scroll-text');
        else banner('Section C', 'The essay question. It is enraged, and it charges.', 'scroll-text');
      }
      if (!boss.threat()) { if (Q.active) endQuestion(); Q.cd = Math.max(Q.cd, 5); return; }
      if (!Q.active) {
        Q.cd -= dt;
        if (Q.cd <= 0) { ask(); Q.cd = ph === 2 ? 12 : 15; }
        return;
      }
      Q.t -= dt;
      const secs = Math.ceil(Q.t);
      if (secs !== Q.shown) {
        Q.shown = secs;
        for (const p of PADS) p.plate.setLabel(`${p.k} · ${p.answer}  (${Math.max(0, secs)})`);
        if (secs <= 3 && secs > 0) sfx('tick');
      }
      for (const p of PADS) p.mesh.userData.setHi(0.5 + 0.5 * Math.sin(Q.t * 8));
      if (Q.t <= 0) grade();
    });
    trigger(ctx, {
      x: 0, z: -8, r: 9.5,
      onEnter: () => {
        if (!boss.alive || st().examIntroAt > Date.now() - 60000) return;
        st().examIntroAt = Date.now();
        cinematic(ctx, { x: 0, y: 4, z: -9, pitch: 0.35, dist: 15, seconds: 2 });
        banner('The Final Exam', 'Closed book. Open sword. When a question appears, stand on the right answer.', 'scroll-text');
      },
    });

    // ================================================================ NPCs
    const tomatoIds = ['thu-tomato-1', 'thu-tomato-2', 'thu-tomato-3'];
    const eggIds = ['thu-egg-1', 'thu-egg-2'];
    const picked = (ids) => ids.filter((id) => st().picked?.[id]).length;
    const findCook = egg('thu-cook', 'Best cook in the building', 'Bring Zhuo what he needs for tomato & egg.', '番茄炒蛋, the Zhuo way. Roommate, labmate, and the best cook in the building.');
    spawnNpc(ctx, {
      id: 'tsinghua-zhuo', name: 'Zhuo', sprite: 'chef', x: -11, z: 15, face: 0.4,
      news: () => !st().zhuoAsked || (picked(tomatoIds) >= 3 && picked(eggIds) >= 2 && !st().cooked),
      talk: () => {
        const t = picked(tomatoIds), e = picked(eggIds);
        const rice = { label: 'Could I have some rice?', icon: 'health-potion', action: () => { heal(25); say('tsinghua-zhuo', 'Plain rice. Character building.'); } };
        if (!st().zhuoAsked) {
          return {
            text: 'Yichen! Back at Tsinghua? Perfect timing. I am making 番茄炒蛋, tomato & egg. Small problem: I have no tomatoes and no eggs. So right now I am making rice.',
            choices: [
              { label: 'I’ll find some', icon: 'scroll-text', action: () => { done('zhuoAsked'); toast('Quest: Tomato & egg, the Zhuo way', { icon: 'scroll-text', tone: 'gold' }); say('tsinghua-zhuo', 'Three tomatoes, two eggs. Real eggs. Not the other kind.'); } },
              { label: 'Why always tomato & egg?', next: { text: 'It is the first dish everyone learns and the last one anyone perfects. Also, roommate rules: I cook, you do the dishes. That was the deal.', choices: [{ label: 'Fair deal', action: () => done('zhuoAsked') }] } },
              rice,
            ],
          };
        }
        if (!st().cooked && (t < 3 || e < 2)) {
          return {
            text: `Tomatoes: ${t}/3. Eggs: ${e}/2. Tomatoes grow in odd places around here: out on the pond pavilion, on top of the auditorium dome, and behind 清华学堂. Eggs like high places. And my old classroom, oddly.`,
            note: 'The auditorium roof: try the stacked platforms on its west side. The CS&T roof: the ones on its west side.',
            choices: [rice, { label: 'On it' }],
          };
        }
        if (!st().cooked) {
          return {
            text: 'You found everything! Stand back. Eggs first, then tomatoes, then a little sugar. Do not tell the purists.',
            choices: [{
              label: 'Cook!', icon: 'campfire', action: () => {
                done('cooked'); heal(9999); sfx('heal');
                banner('番茄炒蛋', 'Tomato & egg, the Zhuo way. HP fully restored.', 'campfire');
                findCook();
                say('tsinghua-zhuo', 'Seconds are always free. That is also a roommate rule.');
              },
            }],
          };
        }
        return {
          text: ['Seconds? There are always seconds.', 'You did the dishes last time. I checked. I am impressed.', 'I heard the Final Exam is on the lawn. Eat first. Never fight an exam hungry.'][Math.floor(Math.random() * 3)],
          choices: [
            { label: 'Seconds, please (full heal)', icon: 'health-potion', action: () => { heal(9999); sfx('heal'); say('tsinghua-zhuo', 'Best cook in the building. It says so on the website.'); } },
            { label: 'What’s your secret?', next: { text: 'Hot wok, patience, and I never measure anything. Very Yao Class of me: the proof is in the eating.', choices: [{ label: 'Delicious proof' }] } },
            { label: 'Bye' },
          ],
        };
      },
    });
    spawnNpc(ctx, {
      id: 'tsinghua-lotus', name: 'Old Lotus', sprite: 'thu-frog', x: -10, z: 3, face: -2.4,
      talk: () => ({
        text: 'Ribbit. This is 荷塘, the lotus pond. A famous essay, 荷塘月色 (“Moonlight over the Lotus Pond”), was written about exactly this kind of evening. Good news: on this island it is always evening.',
        choices: [
          { label: 'How do I see the moonlight?', next: { text: 'Walk out to the pavilion in the middle and just… stand still for a moment. The moon only shows up in the water for people who stop running. Very academic advice, I know.', choices: [{ label: 'I’ll try' }] } },
          { label: 'Are you in the essay?', next: { text: 'Not by name. I like to think I am implied.', choices: [{ label: 'You are' }] } },
          { label: 'Bye' },
        ],
      }),
    });
    spawnNpc(ctx, {
      id: 'tsinghua-proctor', name: 'Proctor-3000', sprite: 'thu-proctor', x: 5, z: 0, face: Math.PI,
      news: () => !st().metProctor,
      talk: () => {
        done('metProctor');
        if (boss.defeated) {
          return {
            text: 'BEEP. Congratulations, graduate. B.S. Computer Science & Technology. Please collect your belongings and your bicycle. Especially your bicycle. There are many bicycles.',
            choices: [{ label: 'Thank you, Proctor' }],
          };
        }
        return {
          text: 'BEEP. The lawn before 大礼堂 is the exam hall today. The Final Exam is waiting. Rules: closed book, open sword. When a question appears, stand on the pad with the right answer. Wrong pads explode. Blank answers are safe. Pop quizzes may occur.',
          choices: [
            { label: 'Can I use a calculator?', next: { text: 'You may use a sword and a small glowing companion. Calculators are considered unfair.', choices: [{ label: 'Understood' }] } },
            { label: 'What if I fail?', next: { text: 'Nothing! You wake up at the Second Gate and try again. It is a very forgiving exam. Unlike some.', choices: [{ label: 'Phew' }] } },
            { label: 'Show me the exam', action: () => cinematic(ctx, { x: 0, y: 4, z: -9, pitch: 0.35, dist: 16, seconds: 2.2 }) },
            { label: 'Bye' },
          ],
        };
      },
    });

    // ================================================================ interactables, eggs, secrets
    // -- the motto
    const findMotto = egg('thu-motto', '自强不息，厚德载物', 'Read the stone by the Second Gate.', 'The Tsinghua motto: “Self-discipline and social commitment.”');
    interactable(ctx, {
      x: -8, z: 15.3, r: 2, label: '自强不息 · 厚德载物', prompt: 'E · read',
      onInteract: () => {
        findMotto();
        dialog({ text: '自强不息，厚德载物\n“Self-discipline and social commitment”: the Tsinghua motto, carved in stone just inside the Second Gate.', choices: [{ label: '自强不息' }] }, { name: 'The motto stone', sprite: 'book' });
      },
    });

    // -- which bike is mine?
    const findBike = egg('thu-bike', 'Which one is mine?', 'Find your own bicycle among the identical ones by the gate.', 'Bicycles everywhere, all alike. Yours has a tiny Rust sticker on the fender.');
    const NOT_MINE = [
      'Not yours. This one has a basket full of somebody else’s lab notes.',
      'Not yours. Same model, same colour, same rust. Different bike.',
      'Not yours. This one belongs to a senior who graduated years ago. It is still parked here, loyal.',
      'Not yours. Its bell rings in a key you do not recognise.',
    ];
    const MINE = 2;
    const rackSpots = [[5.5, 19.5], [7.5, 21.5], [9.5, 19.5], [11, 21.5], [6.5, 21.5]];
    rackSpots.forEach(([x, z], i) => {
      const it = interactable(ctx, {
        x, z, r: 1.05, label: 'A bicycle', prompt: 'E · is this mine?', plateY: 1.6,
        onInteract: (h) => {
          if (i !== MINE || !st().myBike) {
            if (i !== MINE) { sfx('error'); say('me', NOT_MINE[(i + (st().bikeTries || 0)) % NOT_MINE.length]); st().bikeTries = (st().bikeTries || 0) + 1; return; }
            done('myBike'); findBike(); sfx('ring');
            say('me', 'This one! Tiny Rust sticker on the fender. Hello, old friend.');
            h.setLabel('Your bicycle'); h.setPrompt('E · ride');
            return;
          }
          if (ctx.player.vehicle) { toast('Park the vehicle first (V).'); return; }
          if (h.riding) { dismount(); h.riding = false; h.setPrompt('E · ride'); return; }
          ride({ name: 'Your bicycle', speed: 1.8 }); h.riding = true; h.setPrompt('E · get off');
        },
      });
      if (i === MINE && st().myBike) { it.setLabel('Your bicycle'); it.setPrompt('E · ride'); }
    });

    // -- Yao Class whiteboard: write 21 (as in 2021) in binary on five lamps
    const BITS = [16, 8, 4, 2, 1];
    const LAMP_X = [12, 14, 16, 18, 20];
    const lampsOff = props(ctx, LAMP_X.map((x) => [x, 6, 3.25, '#334155', 0]), { shadow: false });
    void lampsOff;
    const lampOn = LAMP_X.map((x) => { const m = props(ctx, [[x, 6, 3.35, '#facc15', 2.4]], { shadow: false }); m.visible = false; return m; });
    const bits = st().bits ? [...st().bits] : [0, 0, 0, 0, 0];
    const value = () => bits.reduce((a, b, i) => a + b * BITS[i], 0);
    const findBinary = egg('thu-binary', 'Class of 2021, in binary', 'Solve the warm-up on the whiteboard in Zhuo’s old Yao Class classroom.', '21 = 10101₂. The undergrad years started in 2021.');
    let eggPickup = null;
    const spawnEggPickup = () => { if (!eggPickup && !st().picked?.['thu-egg-2']) eggPickup = pickup(ctx, { id: 'thu-egg-2', x: 16, z: 8, sprite: 'thu-egg', scale: 0.14, onPick: () => toast('A real egg (1 of 2 Zhuo needs). Not an easter egg. …Okay, also an easter egg.', { icon: 'sparkle' }) }); };
    const refreshLamps = () => lampOn.forEach((m, i) => { m.visible = !!bits[i]; });
    refreshLamps();
    if (st().binary) spawnEggPickup();
    LAMP_X.forEach((x, i) => {
      interactable(ctx, {
        x, z: 6, r: 1.0, label: `${BITS[i]}`, prompt: 'E · flip', plateY: 1.4,
        onInteract: () => {
          bits[i] ^= 1; st().bits = [...bits]; ctx.save();
          refreshLamps(); sfx('tick');
          if (value() === 21 && !st().binary) {
            done('binary'); findBinary(); sfx('victory');
            banner('21 = 10101₂', 'Class of 2021: the year the undergrad began. Warm-up solved.', 'check');
            spawnEggPickup();
            say('me', 'Something rolled out from under the desk. An egg?');
          }
        },
      });
    });
    interactable(ctx, {
      x: 16, z: 4.3, r: 1.5, label: 'Whiteboard', prompt: 'E · read', plateY: 4.8,
      onInteract: () => dialog(st().binary
        ? { text: '21 = 10101₂. Underneath, someone added “Class of 2021 ✓” and a smiley. The rest of the board is a proof sketch nobody dares to erase.', choices: [{ label: 'Leave it be' }] }
        : {
          text: 'Yao Class warm-up (in three colours of marker): “Light the lamps with the year the undergrad began, 2021. The board only has five bits, so the last two digits will do.”',
          note: `The switches on the floor are worth 16, 8, 4, 2 and 1. Right now the lamps read ${value()}.`,
          choices: [
            { label: 'What is 21 in binary?', next: { text: 'Nice try. That is the question.', choices: [{ label: 'Fair' }] } },
            { label: 'Extra credit: prove P ≠ NP', next: { text: 'You write “Trivial. Left as an exercise for the reader.” The whiteboard awards you zero points and a little respect.', choices: [{ label: 'Worth it' }] } },
            { label: 'Leave' },
          ],
        }, { name: 'Whiteboard', sprite: 'book' }),
    });

    // -- CST-OJ homework terminal at the CS&T door
    const findOJ = egg('thu-oj', 'Submitted to CST-OJ', 'Find the homework terminal at the CS&T building door.', 'CST-OJ: an online judge for data-structure coursework. Rust, sandboxed grading, a submission queue.');
    const verdict = (text) => () => { findOJ(); sfx('stamp'); return { text, choices: [{ label: 'Submit again', next: ojNode }, { label: 'Log out' }] }; };
    const ojNode = () => ({
      text: 'CST-OJ · data-structure coursework. Written in Rust, with sandboxed grading and a submission queue. What would you like to submit?',
      choices: [
        { label: 'A clean O(n log n) solution', next: verdict('Queued… judging… ✔ Accepted. Every test passes. Somewhere in the queue, a single proud tear.') },
        { label: 'An O(n²) solution, and hope', next: verdict('Queued… judging… ✘ Time Limit Exceeded. The sandbox kept your code safe. Mostly from itself.') },
        { label: 'print(42)', next: verdict('Queued… judging… ✘ Wrong Answer on test 1. Close? No. Not close.') },
        { label: 'The problem statement itself', next: verdict('Queued… judging… ✘ Compile Error. The judge is written in Rust and has seen things.') },
        { label: 'Log out' },
      ],
    });
    interactable(ctx, { x: 16.5, z: -12.4, r: 2, label: 'CS&T · homework terminal', prompt: 'E · submit', onInteract: () => dialog(ojNode, { name: 'CST-OJ', sprite: 'robot' }) });

    // -- the CS&T roof: the graduation project, still running (a jump route up the west side)
    platform(ctx, { x: 11, z: -12.5, w: 2, d: 2, y: 4.5, color: '#ef4444' });
    platform(ctx, { x: 11, z: -15.5, w: 2, d: 2, y: 5.5, color: '#3b82f6' });
    platform(ctx, { x: 10.5, z: -19, w: 3, d: 3, y: 5.5, color: '#facc15', glow: 0.3, move: (t) => 7.5 - 2 * Math.cos(t * 1.1) });
    platform(ctx, { x: 11, z: -22.5, w: 2, d: 2, y: 10.5, color: '#22c55e' });
    const findStarry = egg('thu-starry', 'The graduation project', 'Something is still running on the CS&T roof.', 'Starry-Next: a networking stack for a monolithic-kernel OS, in Rust. The graduation project.');
    interactable(ctx, {
      x: 17, z: -18, y: 12.5, r: 2, label: 'A terminal, still running', prompt: 'E · look',
      onInteract: () => {
        findStarry();
        dialog({
          text: 'On screen: “Starry-Next: networking stack for a monolithic-kernel OS. Rust. Graduation project.” Below it, a very long build log that ends in green.',
          choices: [
            { label: 'ping 127.0.0.1', next: { text: 'Reply from 127.0.0.1. The kernel, the network stack and you are all on speaking terms.', choices: [{ label: 'Nice' }] } },
            { label: 'Leave it running' },
          ],
        }, { name: 'Starry-Next', sprite: 'robot' });
      },
    });
    props(ctx, [[17, 13, -19, '#0f172a'], [17, 14, -19, '#22d3ee', 1.4]], { block: true });

    // -- the auditorium dome (stacked platforms up its west side)
    platform(ctx, { x: -9, z: -15, w: 2, d: 2, y: 4.5, color: '#b45309' });
    platform(ctx, { x: -9, z: -18, w: 2, d: 2, y: 4.5, color: '#7c3aed', glow: 0.3, move: (t) => 6 - 1.5 * Math.cos(t * 1.3 + 1) });
    platform(ctx, { x: -9, z: -21, w: 2, d: 2, y: 8.5, color: '#0ea5e9' });
    const findDome = egg('thu-dome', 'Top of 大礼堂', 'Climb the Grand Auditorium’s dome.', 'You shout “自强不息” from the dome; the echo politely replies “厚德载物”.');
    trigger(ctx, { x: 0, z: -19.5, r: 1.8, minY: 12, onEnter: () => { if (findDome()) { sfx('achievement'); say('me', '自强不息!'); setTimeout(() => say('bit', '(echo) …厚德载物…'), 1400); } } });

    // -- 荷塘月色: stand still on the pavilion to see the moon in the water
    const findMoon = egg('thu-moon', '荷塘月色', 'Stand still on the lotus-pond pavilion at night.', 'Moonlight over the Lotus Pond: the moon shows up in the water, just as the famous essay promised.');
    const pav = trigger(ctx, { x: -14, z: -3, r: 2.2, onEnter: () => { stillT = 0; } });
    let stillT = 0, lx = 0, lz = 0;

    // -- tomatoes and eggs for Zhuo
    const gotItem = (what) => () => {
      const t = picked(tomatoIds), e = picked(eggIds);
      toast(`${what} (${t}/3 tomatoes, ${e}/2 eggs)${st().zhuoAsked ? '' : ': Zhuo might want this'}`, { icon: 'sparkle' });
    };
    pickup(ctx, { id: 'thu-tomato-1', x: -14, z: -3.6, sprite: 'thu-tomato', scale: 0.14, onPick: gotItem('A tomato, by the moonlit water') });
    pickup(ctx, { id: 'thu-tomato-2', x: 0, z: -19, sprite: 'thu-tomato', scale: 0.14, onPick: gotItem('A tomato, on top of the dome. How?') });
    pickup(ctx, { id: 'thu-tomato-3', x: 22, z: -12, sprite: 'thu-tomato', scale: 0.14, onPick: gotItem('A tomato, hiding behind 清华学堂') });
    pickup(ctx, { id: 'thu-egg-1', x: 19.5, z: -20.5, sprite: 'thu-egg', scale: 0.14, onPick: gotItem('An egg, on the CS&T roof') });
    quest({
      id: 'thu-tomato-egg', title: 'Tomato & egg, the Zhuo way',
      steps: [
        { id: 'ask', text: 'Ask Zhuo what’s cooking (紫荆 dorm patio)', done: () => !!st().zhuoAsked },
        { id: 'tomatoes', get text() { return `Find 3 tomatoes (${picked(tomatoIds)}/3)`; }, done: () => picked(tomatoIds) >= 3 },
        { id: 'eggs', get text() { return `Find 2 real eggs, not easter eggs (${picked(eggIds)}/2)`; }, done: () => picked(eggIds) >= 2 },
        { id: 'cook', text: 'Bring them to Zhuo', done: () => !!st().cooked },
      ],
      reward: { gold: 150, xp: 80 },
    });

    // ================================================================ the way home
    portal(ctx, { x: 0, z: 23.2, to: 'hub', at: [-13, 2.5], label: 'Back to UC San Diego' });

    // ================================================================ per frame: ambient life
    onUpdate(ctx, (dt, t) => {
      flyMesh.position.y = Math.sin(t * 1.3) * 0.25;
      flyMesh.userData.setHi(0.5 + 0.5 * Math.sin(t * 3.1));
      steamMesh.position.y = ((t * 0.8) % 1.5) - 0.2;
      steamMesh.material.opacity = 0.7 * (1 - ((t * 0.8) % 1.5) / 1.5);
      late.userData.setHi(Math.sin(t * 7) > 0.85 ? 0 : 0.8);
      if (reflMesh.visible) reflMesh.userData.setHi(0.4 + 0.3 * Math.sin(t * 1.7));
      // the moon in the pond
      if (pav.inside && !st().moon) {
        const moved = Math.hypot(ctx.player.x - lx, ctx.player.z - lz) > 0.05;
        stillT = moved ? Math.max(0, stillT - dt) : stillT + dt;
        if (stillT > 2.5) {
          done('moon'); reflMesh.visible = true; findMoon(); sfx('rune');
          banner('荷塘月色', 'Moonlight over the Lotus Pond. The moon shows up in the water, for those who stop.', 'star-swirl');
        }
      }
      lx = ctx.player.x; lz = ctx.player.z;
    });

    const LINES = [
      'Tsinghua! Watch out for bicycles. And Deadline Imps. Mostly bicycles.',
      'It is night here. It is always night here. Great for the lotus pond.',
      'Zhuo is cooking by the dorms. I can smell tomato & egg from here.',
      'The Final Exam is on the lawn. It has been waiting since 2025.',
    ];
    let visit = 0;
    onEnter(ctx, () => { setTimeout(() => say('bit', LINES[visit++ % LINES.length]), 1200); });
  },
};
