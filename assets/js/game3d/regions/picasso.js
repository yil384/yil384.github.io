// regions/picasso.js: Picasso Lab, UC San Diego CSE (research intern, Mar 2024 – Feb 2025): a CXL
// system simulator for large-model communication, lab websites, and a RAG pipeline for reading papers.
// The lab is a CXL memory pool: the centre is a CXL switch between three GPUs and three memory devices,
// guarded by the Head-of-Line Blocker (a puzzle-boss: route every lane to break its shield); the east
// side is the memory hierarchy as a tower of moving platforms (SSD → … → registers) with a small house
// on top; the west side is the reading corner of R.A.G.-1, the robot librarian.
import {
  terrain, props, platform, registerArt, registerEnemyKind, spawnEnemy, spawnBoss, spawnNpc,
  interactable, trigger, pickup, portal, quest, egg, say, banner, toast, sfx, dialog, cinematic,
  onUpdate, onEnter, hash3,
} from '../regions.js';
import { PIC_ART, PIC_GLOW } from './art-picasso.js';

// ---------------------------------------------------------------- layout (region-local cells)
const R = 24;
const island = (x, z) => (Math.abs(x) / R) ** 8 + (Math.abs(z) / R) ** 8;
const inBox = (x, z, [x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
const G = 3;                                // floor height (feet at 3.5)
const PILLAR = [15, 17, -18, -15];          // the house on the roof sits on this
const LIB = [-24, -12, -3, 9];              // the reading corner
const SW = { x: 0, z: -6 };                 // the CXL switch
const HOSTS = [{ x: -8, z: -17 }, { x: 0, z: -19 }, { x: 8, z: -17 }];
const DEVICES = [{ x: -11, z: -6 }, { x: 11, z: -6 }, { x: 0, z: 5 }];
const LEVERS = [{ x: -11, z: -2.6 }, { x: 11, z: -2.6 }, { x: 3.4, z: 5 }];
const GPU = [{ k: 'A', c: '#f59e0b' }, { k: 'B', c: '#ec4899' }, { k: 'C', c: '#22c55e' }];

// Solid machines are terrain boxes (not blocked props), so the camera and the player treat them as
// real ledges: the switch, the three GPU racks, and the memory devices (2 high: you can hop on them).
const BOXES = [
  { b: [SW.x - 1, SW.x + 1, SW.z - 1, SW.z + 1], h: 6, t: 'switch' },
  ...HOSTS.map((h) => ({ b: [h.x - 1, h.x + 1, h.z - 1, h.z], h: 8, t: 'rack' })),
  ...DEVICES.map((d) => ({ b: [d.x - 1, d.x + 1, d.z - 1, d.z + 1], h: 5, t: 'device' })),
];
const boxAt = (x, z) => BOXES.find((o) => inBox(x, z, o.b)) || null;
function heightAt(x, z) {
  if (island(x, z) > 1) return null;
  if (inBox(x, z, PILLAR)) return 16;
  const o = boxAt(x, z);
  return o ? o.h : G;
}
function typeAt(x, z) {
  if (inBox(x, z, PILLAR)) return 'pillar';
  const o = boxAt(x, z);
  if (o) return o.t;
  if (island(x, z) > 0.78) return 'edge';
  if (inBox(x, z, LIB)) return 'carpet';
  if (Math.hypot(x - SW.x, z - SW.z) < 12.5) return 'arena';
  if (z >= 12) return (x + z) % 2 ? 'hall' : 'hall2';
  if (x % 8 === 0 || z % 8 === 0) return 'trace';
  return (Math.floor(x / 4) + Math.floor(z / 4)) & 1 ? 'floor2' : 'floor';
}
const PALETTE = {
  floor: ['#1e293b', '#233146'],
  floor2: ['#273449', '#2b3a52'],
  trace: ['#0e7490', '#0891b2'],
  hall: ['#334155', '#3b4a61'],
  hall2: ['#2d3a4f', '#34435a'],
  arena: ['#111827', '#161f30', '#131b2b'],
  edge: ['#475569', '#3f4c5f'],
  pillar: ['#64748b', '#56657a'],
  carpet: ['#4c1d95', '#5b21b6'],
  switch: ['#1e293b', '#334155'],
  rack: ['#1f2937', '#111827'],
  device: ['#64748b', '#56657a'],
};

// A 3×5 voxel font for the lab-website billboard.
const FONT = {
  P: ['111', '101', '111', '100', '100'], I: ['111', '010', '010', '010', '111'], C: ['111', '100', '100', '100', '111'],
  A: ['010', '101', '111', '101', '101'], S: ['111', '100', '111', '001', '111'], O: ['111', '101', '101', '101', '111'],
  L: ['100', '100', '100', '100', '111'], B: ['110', '101', '110', '101', '110'], 4: ['101', '101', '111', '001', '001'],
  0: ['111', '101', '101', '101', '111'],
};
function textCells(str, color, glow, dy = 0) {
  const out = [];
  [...str].forEach((ch, i) => (FONT[ch] || []).forEach((row, r) => [...row].forEach((b, c) => { if (b === '1') out.push([i * 4 + c, -r - dy, 0, color, glow]); })));
  return out;
}

export default {
  id: 'picasso',
  name: 'Picasso Lab',
  subtitle: 'UC San Diego CSE · research intern, Mar 2024 – Feb 2025',
  size: 50,
  spawn: [0, 19],
  sky: { tint: '#9be7ff', ground: '#06141c', fog: '#061019', density: 0.011, sun: 1.8 },
  zones: {
    hall: { x: 0, z: 17, r: 6, label: 'Picasso Lab · the front hall' },
    switch: { x: 0, z: -7, r: 9, label: 'The CXL switch' },
    tiers: { x: 16, z: -3, r: 6.5, label: 'The memory hierarchy' },
    star: { x: 16, z: -16.5, r: 3, label: 'A small house on the roof' },
    library: { x: -18, z: 3, r: 7, label: 'R.A.G.-1’s reading corner' },
    sim: { x: -17, z: -15, r: 6, label: 'The simulator racks' },
  },

  build(ctx) {
    for (const [name, art] of Object.entries(PIC_ART)) registerArt(name, art, PIC_GLOW[name] || null);
    const st = () => ctx.state;
    const done = (k) => { st()[k] = true; ctx.save(); };

    // ================================================================ terrain
    terrain(ctx, { size: 50, height: heightAt, type: typeAt, palette: PALETTE, skirt: 8 });

    // ================================================================ scenery
    const S = [], Bk = [];
    const put = (list, x, y, z, c, g = 0) => list.push([x, y, z, c, g]);

    // -- the entry arch (UCSD gold)
    for (const x of [-4, -3, 3, 4]) for (let y = 4; y <= 8; y++) put(Bk, x, y, 16, '#334155');
    for (let x = -4; x <= 4; x++) put(S, x, 9, 16, x % 2 ? '#1e293b' : '#334155');
    for (let x = -2; x <= 2; x++) put(S, x, 9, 15.44, '#ffcd00', 1.6);

    // -- the lab-website billboard (404 until you deploy it) and its terminal
    for (let x = -15; x <= -1; x++) for (let y = 4; y <= 11; y++) put(Bk, x, y, 11, x === -15 || x === -1 || y === 11 || y === 4 ? '#334155' : '#0b1220');
    for (let x = -9; x <= -7; x++) put(Bk, x, 4, 12, '#475569');
    put(Bk, -8, 5, 12, '#22d3ee', 1.4);

    // -- the 2024 wall calendar
    for (let x = 5; x <= 9; x++) for (let y = 4; y <= 7; y++) put(Bk, x, y, 12, '#e2e8f0');
    for (let x = 5; x <= 9; x++) for (let y = 4; y <= 6; y++) put(S, x, y, 12.06, hash3(x, y, 12) < 0.8 ? '#ef4444' : '#f8fafc', 0.4);
    for (let x = 5; x <= 9; x++) put(S, x, 7, 12.06, '#1e293b');

    // -- the CXL switch, the GPUs, the memory devices, the levers
    for (let x = -1; x <= 1; x++) for (let z = -7; z <= -5; z++) put(S, x, 6.1, z, '#22d3ee', 1.8);
    HOSTS.forEach((h, i) => {
      for (let x = h.x - 1; x <= h.x + 1; x++) for (let y = 5; y <= 7; y++) put(S, x, y, h.z + 0.06, y === 6 ? GPU[i].c : '#0f172a', y === 6 ? 2 : 0);
      // its lane to the switch (always its own colour)
      const n = Math.ceil(Math.hypot(SW.x - h.x, SW.z - 1.5 - h.z - 1));
      for (let k = 1; k < n; k++) { const u = k / n; put(S, h.x + (SW.x - h.x) * u, G + 0.06, h.z + 1 + (SW.z - 1.5 - h.z - 1) * u, GPU[i].c, 0.9); }
    });
    LEVERS.forEach((l) => { put(S, l.x, 4, l.z, '#1f2937'); put(S, l.x, 5, l.z, '#94a3b8'); put(S, l.x + 0.3, 6, l.z, '#f87171', 1.2); });

    // -- the library: shelves of colourful books
    const BOOKS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#eab308'];
    for (const z of [0, 4]) for (let x = -22; x <= -15; x++) for (let y = 4; y <= 6; y++) put(Bk, x, y, z, BOOKS[Math.floor(hash3(x, y, z) * BOOKS.length)]);
    for (const z of [0, 4]) for (let x = -22; x <= -15; x++) put(S, x, 7, z, '#78350f');
    for (let x = -21; x <= -19; x++) put(Bk, x, 4, 8, '#92400e');                               // a reading desk
    put(S, -20, 5, 8, '#fde68a', 1.5);                                                         // its lamp

    // -- server racks (the simulator runs here) with blinking LEDs
    const leds = [];
    for (const [x0, z0] of [[-23, -20], [-23, -16], [19, -22], [21, -19]]) {
      for (let x = x0; x <= x0 + 1; x++) for (let z = z0; z <= z0 + 2; z++) for (let y = 4; y <= 7; y++) put(Bk, x, y, z, '#111827');
      for (let z = z0; z <= z0 + 2; z++) for (let y = 4; y <= 7; y++) leds.push([x0 > 0 ? x0 - 0.06 : x0 + 1.06, y, z, hash3(x0, y, z) < 0.5 ? '#22c55e' : '#38bdf8', 2]);
    }
    const ledMesh = props(ctx, leds, { shadow: false });
    for (let x = -19; x <= -17; x++) put(Bk, x, 4, -12, '#475569');                            // simulator console
    put(Bk, -18, 5, -12, '#a78bfa', 1.6);

    // -- desks with monitors in the hall
    for (const [x, z] of [[-12, 16], [-12, 19], [11, 16], [11, 19]]) {
      for (let dx = -1; dx <= 1; dx++) put(Bk, x + dx, 4, z, '#57534e');
      put(S, x, 5, z, '#0f172a'); put(S, x, 5, z - 0.3, '#60a5fa', 1.3);
    }

    // -- the small house on the roof: at UCSD it perches on the engineering building's edge
    const house = [];
    for (let x = -2; x <= 2; x++) for (let z = -1; z <= 2; z++) for (let y = 0; y <= 2; y++) {
      if (x > -2 && x < 2 && z > -1 && z < 2 && y < 2) continue;
      const door = z === 2 && x === 0 && y < 2, win = z === 2 && x === 1 && y === 1;
      house.push([x, y, z, door ? '#7c2d12' : win ? '#fde68a' : '#93c5fd', win ? 2 : 0]);
    }
    for (let x = -3; x <= 3; x++) for (let z = -2; z <= 3; z++) house.push([x, 3, z, '#334155']);
    for (let x = -2; x <= 2; x++) for (let z = -1; z <= 2; z++) house.push([x, 4, z, '#1e293b']);
    house.push([1, 5, 0, '#475569']);
    const houseMesh = props(ctx, house);
    houseMesh.scale.setScalar(0.55);
    houseMesh.position.set(ctx.ox + 16.3, 16.55, ctx.oz - 17.6);
    houseMesh.rotation.set(0.05, 0.25, -0.16);
    for (let x = 15; x <= 17; x++) for (let z = -18; z <= -17; z++) put(Bk, x, 16.2, z, '#475569');

    // -- floating data motes (small voxels: built at 5× and scaled down)
    const motes = [];
    for (let i = 0; i < 36; i++) motes.push([(-20 + (i * 7.3) % 40) * 5, (5 + (i % 5) * 1.2) * 5, (-20 + (i * 11.7) % 38) * 5, i % 3 ? '#67e8f9' : '#f0abfc', 3]);
    const moteMesh = props(ctx, motes, { shadow: false });
    moteMesh.scale.setScalar(0.2);

    props(ctx, S);
    props(ctx, Bk, { block: true });

    // ================================================================ the memory hierarchy (a jump tower)
    const TIERS = [
      { name: 'SSD', z: 8, y: 4.5 },
      { name: 'CXL memory', z: 4.5, y: 4.5, move: (t) => 6 - 1.5 * Math.cos(t * 1.3) },
      { name: 'DRAM', z: 1, y: 8.5 },
      { name: 'L3 cache', z: -2.5, y: 8.5, move: (t) => 10 - 1.5 * Math.cos(t * 1.1 + 1) },
      { name: 'L2 cache', z: -6, y: 12.5 },
      { name: 'L1 cache', z: -9.5, y: 12.5, move: (t) => 13.5 - Math.cos(t * 1.5 + 2) },
      { name: 'Registers', z: -13, y: 16.5 },
    ];
    const TCOL = ['#64748b', '#0891b2', '#2563eb', '#7c3aed', '#a855f7', '#db2777', '#f59e0b'];
    TIERS.forEach((tr, i) => {
      platform(ctx, { x: 16, z: tr.z, w: 4, d: 2.6, y: tr.y, color: TCOL[i], glow: 0.25, move: tr.move || null });
      interactable(ctx, { x: 16, z: tr.z, r: 0.01, y: tr.move ? tr.y + 1.5 : tr.y, plateY: 1.3, label: tr.name, prompt: '' });
    });
    const findRegs = egg('pic-registers', 'Registers', 'Climb the memory hierarchy to the very top tier.', 'The fastest memory there is, and the smallest. You fit, barely.');
    trigger(ctx, { x: 16, z: -13, w: 4, d: 2.6, minY: 16, onEnter: () => { if (findRegs()) say('me', 'Registers! No latency. No room either.'); } });
    const findStar = egg('pic-fallen-star', 'A house on the roof', 'Past the registers, there is a small house.', 'At UCSD a small house sits tilted on the edge of the engineering building’s roof (Fallen Star). Yes, there really is a house on the roof.');
    trigger(ctx, { x: 16, z: -15.8, r: 1.8, minY: 16, onEnter: () => { if (findStar()) { sfx('rune'); banner('A house on the roof', 'The door is locked. The view is free.', 'star-swirl'); } } });

    // ================================================================ enemies (and ambient packets)
    registerEnemyKind('pic-miss', { name: 'Cache Miss', sprite: 'pic-miss', hp: 20, speed: 5.2, dmg: 6, type: 'Ghost', xp: 14, gold: 12, behaviour: 'swarm', flying: true, scale: 0.16, color: '#67e8f9' });
    registerEnemyKind('pic-fault', { name: 'Page Fault', sprite: 'pic-fault', hp: 40, speed: 3.4, dmg: 10, type: 'Fire', xp: 24, gold: 20, behaviour: 'charge', rate: 2600, scale: 0.19, color: '#ef4444' });
    registerEnemyKind('pic-leak', { name: 'Memory Leak', sprite: 'pic-leak', hp: 70, speed: 1.8, dmg: 9, type: 'Water', xp: 26, gold: 22, behaviour: 'chase', aggro: 8, scale: 0.2, color: '#60a5fa' });
    registerEnemyKind('pic-flip', { name: 'Bit Flip', sprite: 'pic-flip', hp: 30, dmg: 6, type: 'Electric', xp: 18, gold: 16, behaviour: 'turret', rate: 3000, burst: true, aggro: 10, proj: 'spark', scale: 0.2, color: '#fde047' });
    registerEnemyKind('pic-packet', { name: 'Packet (in a hurry)', sprite: 'pic-packet', hp: 12, speed: 2.2, behaviour: 'wander', xp: 1, gold: 1, scale: 0.13, color: '#fb923c' });
    for (const [x, z] of [[-6, 7], [8, 8], [-16, -8]]) spawnEnemy(ctx, { kind: 'pic-miss', x, z });
    for (const [x, z] of [[21, 11], [-19, 12]]) spawnEnemy(ctx, { kind: 'pic-fault', x, z });
    for (const [x, z] of [[21, 3], [-6, -21]]) spawnEnemy(ctx, { kind: 'pic-leak', x, z });
    for (const [x, z] of [[21, -9], [-20, -19]]) spawnEnemy(ctx, { kind: 'pic-flip', x, z });
    for (const [x, z] of [[4, 9], [-5, -15], [12, 12]]) spawnEnemy(ctx, { kind: 'pic-packet', x, z });

    // ================================================================ the CXL switch puzzle-boss
    // Each memory device has a lamp: the GPU it should hear from. Each device's lever changes which GPU
    // its lane carries. While any lane is wrong, packets queue behind the Head-of-Line Blocker and it is
    // shielded. Route all three to break the shield. At half health the switch "updates its firmware":
    // lanes scramble and every lever now also bumps the next port (a real little puzzle; always solvable).
    const P = { route: [0, 0, 0], target: [1, 2, 0], coupled: false, phase: 1, solved: false };
    const laneMeshes = DEVICES.map((d) => GPU.map((g) => {
      const cells = [];
      const sx = SW.x + Math.sign(d.x - SW.x) * 2, sz = SW.z + Math.sign(d.z - SW.z) * 2;
      const ex = d.x - Math.sign(d.x - SW.x) * 2, ez = d.z - Math.sign(d.z - SW.z) * 2;
      const n = Math.max(1, Math.round(Math.hypot(ex - sx, ez - sz)));
      for (let k = 0; k <= n; k++) cells.push([sx + (ex - sx) * (k / n), G + 0.07, sz + (ez - sz) * (k / n), g.c, 1.2]);
      const m = props(ctx, cells, { shadow: false });
      m.visible = false;
      return m;
    }));
    const lamps = DEVICES.map((d, i) => {
      const cells = [[d.x, 7.6, d.z, GPU[P.target[i]].c, 2.6]];
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (!dx || !dz) cells.push([d.x + dx, 5.06, d.z + dz, GPU[P.target[i]].c, dx || dz ? 1.2 : 2.2]);
      return props(ctx, cells, { shadow: false });
    });
    const flow = DEVICES.map(() => { const m = props(ctx, [[0, 0, 0, '#f8fafc', 3]], { shadow: false }); m.scale.setScalar(0.45); m.visible = false; return m; });
    DEVICES.forEach((d, i) => interactable(ctx, { x: d.x, z: d.z, r: 0.01, y: 5.5, plateY: 2.4, label: `Memory ${i + 1} · wants GPU ${GPU[P.target[i]].k}`, prompt: '' }));
    const leverHandles = [];
    const ok = (i) => P.route[i] === P.target[i];
    function refresh() {
      DEVICES.forEach((d, i) => {
        laneMeshes[i].forEach((m, c) => { m.visible = P.route[i] === c; m.userData.setHi(ok(i) ? 1 : 0); });
        leverHandles[i]?.setLabel(`Port ${i + 1}: GPU ${GPU[P.route[i]].k} → wants ${GPU[P.target[i]].k} ${ok(i) ? '✓' : '✗'}`);
      });
    }
    const findRoute = egg('pic-route', 'Packets, flowing', 'Route every lane of the CXL switch to the GPU its memory wants.', 'CXL: big models sharing a memory pool. Somebody here built a CXL system simulator for exactly this kind of large-model communication.');
    function checkSolved() {
      const all = P.route.every((_, i) => ok(i));
      if (all && !P.solved) {
        P.solved = true;
        findRoute();
        sfx('victory');
        banner(P.phase === 1 ? 'Packets flowing!' : 'Re-routed!', boss.alive ? 'The Head-of-Line Blocker’s shield is down. Hit it!' : 'Every GPU can talk to its memory again.', 'lightning-branches');
      }
    }
    LEVERS.forEach((l, i) => {
      leverHandles[i] = interactable(ctx, {
        x: l.x, z: l.z, r: 1.7, label: '', prompt: 'E · reroute', plateY: 3.4,
        onInteract: () => {
          if (P.solved && !boss.alive) { say('me', 'It works. Don’t touch it.'); return; }
          if (P.solved) { toast('Every lane is right. Go hit the Blocker!', { icon: 'check' }); return; }
          P.route[i] = (P.route[i] + 1) % 3;
          if (P.coupled) P.route[(i + 1) % 3] = (P.route[(i + 1) % 3] + 1) % 3;
          sfx('flip');
          refresh();
          checkSolved();
        },
      });
    });
    refresh();

    const findBadge = egg('pic-badge', 'Head of the line', 'Beat the Head-of-Line Blocker at the CXL switch.', 'Picasso Lab, Mar 2024 – Feb 2025: research intern. Badge earned.');
    const boss = spawnBoss(ctx, {
      id: 'pic-hol', name: 'Head-of-Line Blocker', sprite: 'pic-hol', scale: 0.28, x: 0, z: -12, hp: 280, type: 'Normal', r: 1.6,
      pattern: ['volley', 'summon', 'rings'], phases: [{ below: 0.5, pattern: ['nova', 'rings', 'summon', 'volley'] }],
      minion: 'pic-miss', move: 'hover', aggro: 14, contact: 11, color: '#f97316',
      reward: { gold: 420, xp: 170 }, drop: 'badge-picasso', respawn: false,
      onDefeat: (b, { first }) => {
        P.solved = true; P.route = [...P.target]; refresh();
        findBadge();
        if (first) {
          say('me', 'The queue is moving! Every packet, all at once.');
          setTimeout(() => say('pic-model', 'I can hear my other half! Hello, me!'), 2200);
        }
      },
    });
    if (!boss.alive) { P.solved = true; P.route = [...P.target]; refresh(); }
    // the shield: hits bounce off while any lane is wrong
    const hit0 = boss.hit.bind(boss);
    let warnAt = 0;
    boss.hit = (dmg, info) => {
      if (!P.solved && boss.alive) {
        if (Date.now() - warnAt > 2600) {
          warnAt = Date.now();
          sfx('block');
          toast('Shielded! Packets are queuing. Route every lane to the GPU its memory lamp wants (levers by each device).', { icon: 'magic-shield' });
        }
        return false;
      }
      const killed = hit0(dmg, info);
      if (!killed && P.phase === 1 && boss.hp / boss.maxHp <= 0.5) {
        P.phase = 2; P.coupled = true; P.solved = false;
        P.route = [(P.target[0] + 1) % 3, (P.target[1] + 2) % 3, (P.target[2] + 2) % 3];
        refresh();
        sfx('boom');
        banner('Firmware update!', 'The switch rebooted: lanes scrambled, and now each lever also bumps the next port.', 'hazard-sign');
        say('pic-model', 'Oh no, an update. It always happens mid-conversation.');
      }
      return killed;
    };
    // the shield's look: a cage of glowing voxels around the Blocker
    const cage = [];
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; for (const y of [0.3, 2, 3.7]) cage.push([Math.cos(a + y) * 2.4 * 2.5, y * 2.5, Math.sin(a + y) * 2.4 * 2.5, i % 2 ? '#67e8f9' : '#e0f2fe', 2.4]); }
    const cageMesh = props(ctx, cage, { shadow: false });
    cageMesh.scale.setScalar(0.4);
    cageMesh.material.transparent = true;
    cageMesh.material.opacity = 0.7;
    trigger(ctx, {
      x: 0, z: -7, r: 10,
      onEnter: () => {
        if (!boss.alive || st().introAt > Date.now() - 60000) return;
        st().introAt = Date.now();
        cinematic(ctx, { x: 0, y: 5, z: -10, pitch: 0.45, dist: 18, seconds: 2.2 });
        banner('Head-of-Line Blocker', 'One slow packet at the front, everyone else waiting. Route every lane to its lamp to break the shield.', 'magic-shield');
      },
    });

    // ================================================================ NPCs
    const chunkIds = ['pic-chunk-1', 'pic-chunk-2', 'pic-chunk-3'];
    const chunks = () => chunkIds.filter((id) => st().picked?.[id]).length;
    const findRag = egg('pic-rag', 'Retrieval-augmented', 'Ask the robot librarian what it is.', 'A RAG pipeline for reading papers: chunk, retrieve, answer, cite.');
    const findChunks = egg('pic-chunks', 'Context restored', 'Return the three escaped chunks to R.A.G.-1.', 'Its answers went from “it depends” to “it depends, see Section 3”.');
    spawnNpc(ctx, {
      id: 'pic-librarian', name: 'R.A.G.-1', sprite: 'pic-librarian', x: -12, z: 2, face: 1.5,
      news: () => !st().ragAsked || (chunks() >= 3 && !st().chunksDone),
      talk: () => {
        const ask = [
          { label: 'What did Yichen do here?', next: { text: 'Retrieving… 1 chunk found. “Mar 2024 – Feb 2025, research intern. Built a CXL system simulator for large-model communication; set up lab websites and a RAG pipeline for reading papers.” Relevance: very high. Source: the CV you just scrolled past.', choices: [{ label: 'Thanks' }] } },
          { label: 'What are you, exactly?', next: () => { findRag(); return { text: 'I am a RAG pipeline for reading papers, with legs. One: split every paper into chunks. Two: retrieve the chunks that match your question. Three: answer from them, and cite them. Four: never invent a number. Step four is the hard one.', choices: [{ label: 'Respect' }] }; } },
          { label: 'What is CXL?', next: { text: 'Compute Express Link: processors and accelerators sharing a pool of memory over a fast link. Around here it is how big models talk across GPUs without shouting.', choices: [{ label: 'Got it' }] } },
          { label: 'Summarise the appendix', next: { text: 'Retrieving… 0 chunks found. Nobody has ever read the appendix. Not even the authors.', choices: [{ label: 'Fair' }] } },
        ];
        if (!st().ragAsked) {
          return {
            text: 'Welcome to the reading corner. I am R.A.G.-1. I read papers so humans can say they did. Ask me anything; I retrieve before I answer. Also… three chunks of a paper escaped my index. Without them I can only say “it depends”.',
            choices: [{ label: 'I’ll find your chunks', icon: 'scroll-text', action: () => { done('ragAsked'); toast('Quest: Escaped chunks', { icon: 'scroll-text', tone: 'gold' }); say('pic-librarian', 'One hid behind the website billboard. One went up the memory hierarchy. One is in my back aisle.'); } }, ...ask],
          };
        }
        if (chunks() >= 3 && !st().chunksDone) {
          return {
            text: 'Chunks detected in your inventory. Re-indexing… Context restored. My answers just went from “it depends” to “it depends, see Section 3”.',
            choices: [{ label: 'Happy to help', action: () => { done('chunksDone'); findChunks(); sfx('victory'); } }],
          };
        }
        return {
          text: st().chunksDone ? 'Fully indexed. Ask away.' : `Chunks recovered: ${chunks()}/3. Behind the website billboard, up on the L2 cache, and in my back aisle.`,
          choices: ask,
        };
      },
    });
    spawnNpc(ctx, {
      id: 'pic-model', name: 'Big Model', sprite: 'pic-model', x: -13, z: -17, face: 0.8, scale: 0.22,
      news: () => !st().metModel,
      talk: () => {
        done('metModel');
        if (!boss.alive) {
          return {
            text: 'I can hear my other half across the GPUs again! We finished a whole sentence. Together. Thank you, tiny human with a sword.',
            choices: [
              { label: 'How big are you, exactly?', next: { text: 'Rude. (Large.)', choices: [{ label: 'Sorry' }] } },
              { label: 'Bye' },
            ],
          };
        }
        return {
          text: 'Hi! I am a large model. So large I do not fit on one GPU, so half of me lives over there and we talk through the CXL memory pool. Or we would, if the Head-of-Line Blocker weren’t sitting on the switch. Everything is queued behind one very slow packet.',
          choices: [
            { label: 'How do I fix the switch?', next: { text: 'Each memory device has a lamp: that is the GPU it should hear from. The lever next to each device changes which GPU its lane carries. Match every lane to its lamp and the Blocker loses its shield. If the switch updates its firmware mid-fight… well. Updates always happen mid-fight.', choices: [{ label: 'On it' }] } },
            { label: 'Why is there a simulator?', next: { text: 'Before anyone buys real CXL hardware, you simulate it. Somebody here built a CXL system simulator for large-model communication. I was in the simulation. It was very flattering.', choices: [{ label: 'Neat' }] } },
            { label: 'Show me the switch', action: () => cinematic(ctx, { x: 0, y: 4, z: -6, pitch: 0.55, dist: 20, seconds: 2.4 }) },
            { label: 'How big are you, exactly?', next: { text: 'Rude. (Large.)', choices: [{ label: 'Sorry' }] } },
          ],
        };
      },
    });

    // ================================================================ interactables, eggs, secrets
    interactable(ctx, {
      x: 5.2, z: 15.2, r: 2, label: 'Picasso Lab · UC San Diego CSE', prompt: 'E · read',
      onInteract: () => dialog({ text: 'Picasso Lab · UC San Diego CSE.\nResearch intern, Mar 2024 – Feb 2025: a CXL system simulator for large-model communication, lab websites, and a RAG pipeline for reading papers.', note: 'Keywords: CXL simulator · RAG · Lab websites', choices: [{ label: 'Enter the lab' }] }, { name: 'Door plaque', sprite: 'book' }),
    });

    // -- the lab website: 404 until deployed
    const t404 = props(ctx, textCells('404', '#ef4444', 1.8));
    t404.position.set(ctx.ox - 13, 10, ctx.oz + 11.1);
    const tLab = props(ctx, [...textCells('PICASSO', '#ffcd00', 1.8), ...textCells('LAB', '#ffcd00', 1.8, 6).map((c) => [c[0] + 8, c[1], c[2], c[3], c[4]])]);
    tLab.scale.setScalar(0.5);
    tLab.position.set(ctx.ox - 14.5, 10, ctx.oz + 11.6);
    const showSite = () => { t404.visible = !st().website; tLab.visible = !!st().website; };
    showSite();
    const findSite = egg('pic-website', 'Deployed', 'Fix and deploy the lab website from the terminal in the hall.', 'Lab websites: part of the Picasso Lab internship. The 404 is gone.');
    const deploy = () => { done('website'); showSite(); findSite(); sfx('victory'); banner('Deployed!', 'The lab website is live. The billboard stops saying 404.', 'check'); };
    const step3 = { text: 'Step 3/3 · Ship it?', choices: [
      { label: 'Deploy', icon: 'upgrade', action: deploy },
      { label: 'Deploy on Friday evening', next: { text: 'The terminal refuses, out of respect for your weekend.', choices: [{ label: 'Deploy now instead', action: deploy }, { label: 'Later' }] } },
    ] };
    const step2 = { text: 'Step 2/3 · The publications page is out of date.', choices: [
      { label: 'Update the publications list', next: step3 },
      { label: 'Add “under review” to everything', next: { text: 'Honest, but it reads like a cry for help. Maybe just update the list.', choices: [{ label: 'Update the list', next: step3 }] } },
    ] };
    const step1 = { text: 'lab-website · last build: FAILED (404). Step 1/3 · The group photo is enormous and the page will not load.', choices: [
      { label: 'Compress the group photo', next: step2 },
      { label: 'Crop everyone out except me', next: { text: 'Tempting. Rejected by the build. And by the group.', choices: [{ label: 'Compress it properly', next: step2 }] } },
      { label: 'Leave' },
    ] };
    interactable(ctx, {
      x: -8, z: 13.3, r: 1.8, label: 'lab-website · build terminal', prompt: 'E · build',
      onInteract: () => dialog(st().website ? { text: 'lab-website · last build: ✔ passing. Uptime: good. Nobody has complained, which is the highest praise a website gets.', choices: [{ label: 'Nice' }] } : step1, { name: 'Terminal', sprite: 'robot' }),
    });

    // -- the 2024 wall calendar
    const findCal = egg('pic-calendar', 'Busy 2024', 'Read the wall calendar in the front hall.', 'Picasso Lab ran Mar 2024 – Feb 2025, alongside Hotstar, TiMi and Metabit. Free weekends: not found.');
    interactable(ctx, {
      x: 7, z: 13.7, r: 1.8, label: 'Wall calendar · 2024', prompt: 'E · read',
      onInteract: () => { findCal(); dialog({ text: '2024. In big letters: “Picasso Lab: Mar 2024 – Feb 2025.” In smaller handwriting, squeezed into the same boxes: “Disney+ Hotstar (Mar–Jun) · TiMi Studio (Jun–Jul) · Metabit (Sep–Nov).” Almost every day has a red mark.', note: 'Free weekends: not found.', choices: [{ label: 'Wow' }] }, { name: 'Calendar', sprite: 'book' }); },
    });

    // -- the simulator console
    const findSim = egg('pic-sim', 'Simulated', 'Run the CXL simulator at the racks in the north-west.', 'A CXL system simulator for large-model communication: simulate it before anyone buys the hardware.');
    const simNode = () => ({
      text: 'CXL system simulator · large-model communication. Choose a configuration.',
      choices: [
        { label: 'Two GPUs, one memory pool', next: () => { findSim(); return { text: 'Simulating… done. Traffic: tidy. Queues: short. Simulated coffee: free.', choices: [{ label: 'Again', next: simNode }, { label: 'Close' }] }; } },
        { label: 'Every GPU on Earth', next: () => { findSim(); return { text: 'Simulating… estimated time remaining: one PhD.', choices: [{ label: 'Cancel', next: simNode }, { label: 'Close' }] }; } },
        { label: 'One slow packet at the front', next: () => { findSim(); return { text: 'Simulating… everything waits behind it. This is called head-of-line blocking. There is currently a very large one sitting on the real switch.', choices: [{ label: 'On it', next: simNode }, { label: 'Close' }] }; } },
        { label: 'Close' },
      ],
    });
    interactable(ctx, { x: -18, z: -10.6, r: 2, label: 'CXL simulator', prompt: 'E · run', onInteract: () => dialog(simNode, { name: 'Simulator', sprite: 'robot' }) });

    // -- chunks for R.A.G.-1
    const gotChunk = () => toast(`A paper chunk (${chunks()}/3)${st().ragAsked ? '' : ': the librarian might want this'}`, { icon: 'scroll-text' });
    pickup(ctx, { id: 'pic-chunk-1', x: -8, z: 9.5, sprite: 'pic-chunk', scale: 0.14, onPick: gotChunk });
    pickup(ctx, { id: 'pic-chunk-2', x: 16, z: -6, y: 12.5, sprite: 'pic-chunk', scale: 0.14, onPick: gotChunk });
    pickup(ctx, { id: 'pic-chunk-3', x: -22, z: 6.5, sprite: 'pic-chunk', scale: 0.14, onPick: gotChunk });
    quest({
      id: 'pic-chunks-quest', title: 'Escaped chunks',
      steps: [
        { id: 'ask', text: 'Talk to R.A.G.-1 in the reading corner', done: () => !!st().ragAsked },
        { id: 'find', get text() { return `Find 3 paper chunks (${chunks()}/3)`; }, done: () => chunks() >= 3 },
        { id: 'return', text: 'Return them to R.A.G.-1', done: () => !!st().chunksDone },
      ],
      reward: { gold: 150, xp: 80 },
    });

    // ================================================================ the way home
    portal(ctx, { x: 0, z: 22.4, to: 'hub', at: [16, 9], label: 'Back to UC San Diego' });

    // ================================================================ per frame
    onUpdate(ctx, (dt, t) => {
      moteMesh.position.y = Math.sin(t * 0.9) * 0.3;
      moteMesh.userData.setHi(0.5 + 0.5 * Math.sin(t * 2.3));
      ledMesh.userData.setHi(Math.sin(t * 5) > 0 ? 1 : 0.2);
      // lamps pulse; the shield cage follows the Blocker
      lamps.forEach((m, i) => m.userData.setHi(ok(i) ? 0.3 : 0.5 + 0.5 * Math.sin(t * 4)));
      cageMesh.visible = boss.alive && !P.solved;
      if (cageMesh.visible) { cageMesh.position.set(boss.x, boss.y, boss.z); cageMesh.rotation.y = t * 0.8; }
      // packets flow along correct lanes
      DEVICES.forEach((d, i) => {
        const m = flow[i];
        m.visible = ok(i);
        if (!m.visible) return;
        const u = (t * 0.7 + i * 0.33) % 1;
        const sx = SW.x + Math.sign(d.x - SW.x) * 2, sz = SW.z + Math.sign(d.z - SW.z) * 2;
        const ex = d.x - Math.sign(d.x - SW.x) * 2, ez = d.z - Math.sign(d.z - SW.z) * 2;
        m.position.set(ctx.ox + sx + (ex - sx) * u, G + 0.9, ctx.oz + sz + (ez - sz) * u);
      });
    });
    const LINES = [
      'Picasso Lab! Mind the packets. They are in a hurry.',
      'That billboard says 404. Somebody should deploy the lab website.',
      'The whole lab is a memory pool. Even the floor is probably addressable.',
    ];
    let visit = 0;
    onEnter(ctx, () => { setTimeout(() => say('bit', LINES[visit++ % LINES.length]), 1200); });
  },
};
