// regions/samsung.js: the agent fab (Samsung Semiconductor, summer research intern, Jun – Sep 2026, San Jose,
// on-site; architecture for agentic AI workloads). You walk on a giant die:
//   - the compute array (north): The Agent Loop plans → calls tools → reflects, shown in its name bar. It runs
//     on hardware shaped for something else (25% damage) until you reshape the accelerator: step on the
//     nine PE tiles (each flips itself and its neighbours) until all are lit (→ badge-samsung)
//   - an HBM stack you can climb, a memory palace with an adaptive sequence puzzle, the agent commons (a
//     swarm of helper agents that self-organise into roles), a hall to present findings, and the MLOps bay
//     (Tessa-7 files its own bug reports; a simulator fast-forwards the fab)
//   - Tool-call Stalls, KV-cache Bloats (they grow), Context-window Overflows, Hallucination Wisps
import * as THREE from 'three/webgpu';
import {
  terrain, props, registerArt, registerEnemyKind, spawnEnemy, spawnBoss, spawnNpc, interactable, trigger,
  pickup, portal, quest, egg, say, banner, toast, sfx, onUpdate, onEnter, onLeave, dialog, setSky, sprite,
  scatter, hash3, hasItem, cinematic,
} from '../regions.js';
import { SAMSUNG_ART } from './art-samsung.js';

const BLUE = '#6e8bff';
const HBM = { x: 17, z: -16 };
const BOSS_HOME = { x: 0, z: -19.5 };
const TILE_X = [-3, 0, 3], TILE_Z = [-10, -13, -16];
const BANKS = [[14, -2, '#60a5fa'], [20, -2, '#fb923c'], [14, 4, '#4ade80'], [20, 4, '#f472b6']];
const STATIONS = [{ x: -20, z: -3, role: 'b', name: 'planners' }, { x: -20, z: 6, role: 'o', name: 'tool-callers' }, { x: -13, z: 6, role: 'g', name: 'critics' }];
const SKY = { tint: '#c7d2fe', ground: '#0a0f24', fog: '#080c1e', density: 0.008, sun: 2.2 };

const inIsland = (x, z) => {
  const ax = Math.abs(x), az = Math.abs(z);
  return ax <= 24 && az <= 24 && ax + az <= 44;
};
const inArena = (x, z) => x >= -8 && x <= 8 && z >= -22 && z <= -7;
const hbmD = (x, z) => Math.max(Math.abs(x - HBM.x), Math.abs(z - HBM.z));
const onNoc = (x, z) => (x === -10 || x === 10) || (z === -6 || z === 9);
function groundH(x, z) {
  if (!inIsland(x, z)) return null;
  const d = hbmD(x, z);
  if (d <= 5) return 7 - Math.max(0, d - 1);
  if (inArena(x, z)) return 3;
  return 2;
}

export default {
  id: 'samsung',
  name: 'Samsung agent fab',
  subtitle: 'Summer research intern · Jun – Sep 2026 · San Jose',
  size: 54,
  spawn: [0, 18],
  sky: SKY,
  zones: {
    lobby: { x: 0, z: 18, r: 6, label: 'Die entrance' },
    compute: { x: 0, z: -15, r: 8, label: 'Compute array' },
    hbm: { x: HBM.x, z: HBM.z, r: 6, label: 'HBM stack' },
    palace: { x: 17, z: 1, r: 6, label: 'Memory palace' },
    commons: { x: -16, z: 2, r: 7, label: 'Agent commons' },
    hall: { x: -16, z: 16, r: 6, label: 'Research team hall' },
    bay: { x: 16, z: 16, r: 6, label: 'MLOps bay' },
  },

  build(ctx) {
    for (const [name, art] of Object.entries(SAMSUNG_ART)) registerArt(name, art, name === 'sg-wisp' ? { V: 1.4, W: 1 } : name === 'sg-spark' ? { C: 3, W: 3 } : name === 'sg-chip' ? { B: 1.4, W: 1.5 } : name === 'sg-loop' ? { C: 1.5, Y: 1.5 } : null);
    const st = ctx.state;
    let lastT = 0;

    // ================================================================ terrain: the die
    terrain(ctx, {
      size: 54,
      height: groundH,
      type: (x, z) => {
        const ax = Math.abs(x), az = Math.abs(z);
        if (Math.max(ax, az) >= 23 || ax + az >= 43) return (x + z) & 1 ? 'pad' : 'rim';
        const d = hbmD(x, z);
        if (d <= 5) return d % 2 ? 'hbmA' : 'hbmB';
        if (inArena(x, z)) return (x % 3 === 0 || z % 3 === 0) ? 'peLine' : 'pe';
        if (onNoc(x, z)) return 'noc';
        if (x >= 11 && z >= -5 && z <= 6) return 'palace';
        if (x <= -11 && z >= -5 && z <= 8) return 'commons';
        if (x <= -11 && z >= 11) return 'hall';
        if (x >= 11 && z >= 11) return 'bay';
        return hash3(x, 0, z) < 0.08 ? 'via' : 'si';
      },
      palette: {
        si: ['#1e2745', '#1b2340', '#212b4b'], via: ['#4b5b7a', '#56688a'], rim: ['#111827', '#161e30'], pad: ['#d4a73c', '#e0b64a'],
        pe: ['#1e3a8a', '#1d3580'], peLine: ['#3b5bdb', '#4263eb'], noc: ['#22d3ee', '#0ea5e9'],
        hbmA: ['#475569', '#4b5a6e'], hbmB: ['#334155', '#384860'], palace: ['#e2e8f0', '#dbe3ee'],
        commons: ['#14532d', '#166534'], hall: ['#581c87', '#6b21a8'], bay: ['#27272a', '#2f2f33'],
      },
    });

    // ================================================================ props
    const solid = [], deco = [], glow = [];
    // the hall: a screen, a podium
    for (let x = -21; x <= -12; x++) for (let y = 3; y <= 8; y++) (y === 3 || y === 8 || x === -21 || x === -12 ? solid : glow).push([x, y, 11, y === 3 || y === 8 || x === -21 || x === -12 ? '#1f2937' : (y > 5 && x > -18 && x < -14 ? '#f8fafc' : '#312e81'), 0.9]);
    solid.push([-16, 3, 13, '#78350f']);
    deco.push([-16, 4, 13, BLUE, 1]);
    // agent commons: stations (planner whiteboard, toolbox, critic's magnifier desk) and the beacon
    for (let y = 3; y <= 5; y++) for (const dz of [-1, 0, 1]) solid.push([-22, y, -3 + dz, y === 3 ? '#475569' : '#f8fafc']);
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) solid.push([-22 + dx, 3, 5 + dz, '#ea580c']);
    solid.push([-13, 3, 7, '#166534'], [-12, 3, 7, '#166534']);
    glow.push([-13, 4, 7, '#bbf7d0', 1], [-12, 4, 7, '#4ade80', 1]);
    for (let y = 3; y <= 6; y++) solid.push([-16, y, 1, '#64748b']);
    glow.push([-16, 7, 1, '#fde047', 2.5]);
    // MLOps bay: server racks with LEDs, the simulator terminal
    for (let x = 12; x <= 21; x++) for (let y = 3; y <= 6; y++) (y % 2 ? solid : glow).push([x, y, 21, y % 2 ? '#111827' : (hash3(x, y, 21) < 0.7 ? '#4ade80' : '#ef4444'), 1.4]);
    for (const [dx, dz] of [[0, 0], [1, 0]]) solid.push([20 + dx, 3, 12 + dz, '#1f2937']);
    glow.push([20, 4, 12, '#22d3ee', 1.6], [21, 4, 12, '#22d3ee', 1.6]);
    // memory palace: columns and a recall orb
    for (const [x, z] of [[12, -5], [22, -5], [12, 6], [22, 6]]) for (let y = 3; y <= 6; y++) solid.push([x, y, z, '#f1f5f9']);
    solid.push([17, 3, 1, '#e2e8f0']);
    glow.push([17, 4, 1, '#a5b4fc', 2]);
    // the HBM stack: through-silicon vias glowing up its sides, a crown on top
    for (let d = 2; d <= 5; d++) for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) glow.push([HBM.x + sx * d, 7 - (d - 1) + 1, HBM.z + sz * d, '#22d3ee', 1.4]);
    // die markings: capacitors near the entrance and a few blocks of standard cells
    for (const [x, z] of [[-6, 14], [6, 14], [-6, 21], [6, 21], [-3, 3], [4, -2]]) for (let y = 3; y <= 4; y++) solid.push([x, y, z, y === 4 ? '#e5e7eb' : '#9ca3af']);
    for (let x = -4; x <= 4; x++) glow.push([x, 3, 20.6, x % 2 ? BLUE : '#a5b4fc', 0.8]);
    props(ctx, solid, { block: true });
    props(ctx, deco);
    const glowMesh = props(ctx, glow, { shadow: false });
    scatter(ctx, 'sg-agent', [[-19, 17], [-17, 17], [-15, 17], [-13, 17], [-18, 19], [-16, 19], [-14, 19], [-20, 19]].map(([x, z]) => ({ x, z, rotY: Math.PI, scale: 0.16 })), { maxHalf: 1 });

    // ================================================================ instanced bits: NoC packets, PE tiles, memory banks, relay token
    const flat = (w, hgt, d, n, color) => { const m = new THREE.InstancedMesh(new THREE.BoxGeometry(w, hgt, d), new THREE.MeshBasicNodeMaterial({ color: color || '#ffffff' }), n); m.castShadow = false; m.receiveShadow = false; ctx.group.add(m); return m; };
    const _m = new THREE.Matrix4(), col = new THREE.Color();
    // NoC packets
    const LANES = [['x', -10], ['x', 10], ['z', -6], ['z', 9]];
    const N_PK = 28;
    const pk = flat(0.4, 0.4, 0.4, N_PK, '#a5f3fc');
    const pkS = Array.from({ length: N_PK }, (_, i) => ({ lane: i % 4, s: hash3(i, 3, 9) * 44, dir: i % 8 < 4 ? 1 : -1 }));
    // PE tiles (lights-out puzzle)
    const tiles = flat(2.2, 0.12, 2.2, 9);
    const lit = Array(9).fill(true);
    const idx = (i, j) => j * 3 + i;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { _m.makeTranslation(TILE_X[i] + ctx.ox, 3.56, TILE_Z[j] + ctx.oz); tiles.setMatrixAt(idx(i, j), _m); }
    const paintTiles = () => { for (let k = 0; k < 9; k++) tiles.setColorAt(k, col.set(lit[k] ? '#93c5fd' : '#1e1b4b')); tiles.instanceColor.needsUpdate = true; };
    // memory banks
    const banks = flat(2.2, 0.14, 2.2, 4);
    BANKS.forEach(([x, z], i) => { _m.makeTranslation(x + ctx.ox, 2.58, z + ctx.oz); banks.setMatrixAt(i, _m); });
    const paintBanks = (on = -1) => { BANKS.forEach(([, , c], i) => banks.setColorAt(i, col.set(i === on ? c : '#475569'))); banks.instanceColor.needsUpdate = true; };
    paintBanks();
    // the coordination relay token (planner → tool-caller → critic → planner)
    const token = flat(0.45, 0.45, 0.45, 1, '#fde047');
    token.visible = false;

    // ================================================================ enemies
    const kinds = {
      'samsung-stall': { name: 'Tool-call Stall', sprite: 'sg-stall', hp: 34, speed: 3.2, dmg: 9, type: 'Normal', xp: 18, gold: 18, behaviour: 'charge', rate: 3400, scale: 0.22, color: '#fde68a' },
      'samsung-kv': { name: 'KV-cache Bloat', sprite: 'sg-kv', hp: 60, speed: 1.7, dmg: 9, type: 'Water', xp: 26, gold: 24, behaviour: 'chase', scale: 0.22, color: '#2dd4bf', respawn: 22000,
        onDeath: () => { if (lastT - (st._evT || 0) > 6) { st._evT = lastT; toast('Evicted. The cache breathes again.', { icon: 'check' }); } } },
      'samsung-overflow': { name: 'Context-window Overflow', sprite: 'sg-overflow', hp: 18, speed: 4.6, dmg: 5, type: 'Normal', xp: 12, gold: 12, behaviour: 'swarm', scale: 0.2, color: '#fef3c7' },
      'samsung-wisp': { name: 'Hallucination Wisp', sprite: 'sg-wisp', hp: 26, speed: 2.8, dmg: 7, type: 'Psychic', xp: 18, gold: 18, behaviour: 'ranged', rate: 2500, proj: 'psy', flying: true, scale: 0.2, color: '#c084fc',
        onDeath: () => { findWisp(); } },
      'samsung-spark': { name: 'Stray Electron', sprite: 'sg-spark', hp: 4, speed: 2.4, dmg: 0, type: 'Electric', xp: 1, gold: 1, behaviour: 'wander', flying: true, scale: 0.14, color: '#67e8f9' },
    };
    for (const [id, k] of Object.entries(kinds)) registerEnemyKind(id, k);
    const kvFoes = [];
    const put = (kind, list) => { for (const [x, z] of list) { const f = spawnEnemy(ctx, { kind, x, z }); if (kind === 'samsung-kv') kvFoes.push({ f, age: 0 }); } };
    put('samsung-stall', [[-5, -3], [6, 4]]);
    put('samsung-kv', [[-4, 7], [14, -9]]);
    put('samsung-overflow', [[8, -3], [-7, 13]]);
    put('samsung-wisp', [[17, 9], [-18, -10]]);
    put('samsung-spark', [[-10, 0], [10, -3], [0, 9]]);

    // ================================================================ boss: The Agent Loop
    const STEP = { fan: 'PLAN', summon: 'ACT · calling tools', rings: 'REFLECT', volley: 'RE-PLAN', nova: 'ACT · parallel tool calls', charge: 'RETRY' };
    const boss = spawnBoss(ctx, {
      id: 'samsung-agent-loop', name: 'The Agent Loop', sprite: 'sg-loop', scale: 0.3, x: BOSS_HOME.x, z: BOSS_HOME.z,
      hp: 480, type: 'Psychic', r: 2, color: '#818cf8', contact: 11, speed: 1.2, aggro: 13, move: 'hover',
      pattern: ['fan', 'summon', 'rings'],
      phases: [
        { below: 0.55, pattern: ['fan', 'volley', 'summon', 'nova', 'rings'] },
        { below: 0.2, pattern: ['charge', 'summon', 'charge', 'volley'], every: 2300 },
      ],
      minion: 'samsung-stall', reward: { gold: 380, xp: 140 }, drop: 'badge-samsung', respawn: 45000,
      onDefeat: (b, { first }) => {
        b.name = 'The Agent Loop';
        findLoop();
        banner('Loop terminated', first ? 'Samsung Semiconductor Badge earned. Plan, act, reflect… done.' : 'It will loop back. Loops do.', 'ribbon-medal');
        say('me', first ? 'Exit condition: met.' : 'Terminated. Again.');
      },
    });
    const bossHit = boss.hit.bind(boss);
    let solved = false, hintAt = 0, retries = 0, lastStep = '';
    boss.hit = (dmg, info) => {
      if (!solved && lastT - hintAt > 4.5) { hintAt = lastT; toast('It runs on hardware shaped for something else: 25% damage. Reshape the accelerator: light all nine PE tiles.', { icon: 'cpu', tone: 'bad' }); }
      return bossHit(solved ? dmg : Math.max(1, Math.round(dmg * 0.25)), info);
    };
    const shield = new THREE.Mesh(new THREE.IcosahedronGeometry(2.8, 1), new THREE.MeshBasicNodeMaterial({ color: '#818cf8', transparent: true, opacity: 0.2, depthWrite: false, wireframe: true }));
    ctx.group.add(shield);
    // lights out: stepping on a tile flips it and its orthogonal neighbours
    function scramble() {
      lit.fill(true);
      for (const [i, j] of [[0, 0], [2, 2], [1, 1]]) press(i, j, true);
      solved = false;
      paintTiles();
    }
    function press(i, j, silent = false) {
      for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = i + a, y = j + b; if (x >= 0 && x < 3 && y >= 0 && y < 3) lit[idx(x, y)] = !lit[idx(x, y)]; }
      if (silent) return;
      paintTiles();
      sfx('flip');
      if (lit.every(Boolean)) {
        solved = true;
        sfx('achievement');
        banner('Accelerator reshaped', 'The array now fits the agent workload. Full damage!', 'cpu');
        findReshape();
      }
    }
    scramble();
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      trigger(ctx, { x: TILE_X[i], z: TILE_Z[j], w: 2, d: 2, onEnter: () => { if (!solved) press(i, j); } });
    }
    interactable(ctx, { x: 6.5, z: -8.5, r: 2, label: 'PE array config', prompt: 'E · read / reset', y: 3.5,
      onInteract: () => dialog({
        text: solved ? 'CONFIG: all nine PE tiles lit. The array is mapped to the agent workload.' : 'CONFIG: the processing-element array is mapped for a different workload. Step on a tile to flip it and its neighbours. Light all nine and The Agent Loop runs on hardware that finally fits it (full damage).',
        choices: [{ label: 'Reset the tiles', action: () => { if (!solved) { scramble(); toast('Tiles reset: the dark diagonal is back.', { icon: 'rotate-ccw' }); } } }, { label: 'OK' }],
      }, { name: 'PE array', sprite: 'sg-chip' }) });
    let introShown = false, wasAlive = boss.alive;
    trigger(ctx, { x: 0, z: -14, r: 9, minY: 2.9, onEnter: () => {
      if (!boss.alive || introShown) return;
      introShown = true;
      cinematic(ctx, { x: BOSS_HOME.x, y: 5, z: BOSS_HOME.z, pitch: 0.4, dist: 20, seconds: 2.2 });
      banner('THE AGENT LOOP', 'Plan → act → reflect → repeat. Watch its name bar for the next step.', 'cpu');
      sfx('encounter');
    } });

    // ================================================================ NPCs
    spawnNpc(ctx, {
      id: 'sg-probe', name: 'Probe · guide', sprite: 'sg-probe', x: 3, z: 16, face: 3.4,
      news: () => !st.metProbe,
      talk: () => {
        st.metProbe = true; ctx.save();
        return {
          text: hasItem('badge-samsung')
            ? 'You terminated the loop! I have updated my map of the die: "here be no more infinite loops". Probably.'
            : 'Welcome to the agent fab! I\'m Probe. You are standing on a die. Yichen was a summer research intern at Samsung Semiconductor, June to September 2026, on-site in San Jose. The theme: architecture for agentic AI workloads.',
          choices: [
            { label: 'What did the work involve?', icon: 'briefcase', action: () => { findIntern(); dialog({ text: 'Runtime optimizations for agentic AI pipelines, and exploring their hardware design implications through simulation: how future accelerators should be designed to better support agent workloads. An agentic test-debug framework prototype for MLOps. Designing and running experiments, and presenting the findings to the research team.', choices: [{ label: 'Got it' }] }, { name: 'Probe · guide', sprite: 'sg-probe' }); } },
            { label: 'What\'s on this die?', icon: 'treasure-map', next: { text: 'North: the compute array, where The Agent Loop runs. North-east: the HBM stack (climb it). East: the memory palace. West: the agent commons. South-west: the research team\'s hall. South-east: the MLOps bay, with Tessa-7 and the simulator.', choices: [{ label: 'Thanks' }] } },
            { label: 'Research themes?', icon: 'scroll-text', next: { text: 'Five of them: multi-agent coordination and collective intelligence; structured action spaces and efficient decision-making; adaptive memory for long-term reasoning; trust, interpretability and human-AI collaboration; emergent specialization and role formation. Someone scattered five theme chips around the die. Collect them, then present at the hall.', choices: [{ label: 'On it' }] } },
            { label: 'Bye' },
          ],
        };
      },
    });
    spawnNpc(ctx, {
      id: 'sg-tessa', name: 'Tessa-7 · test-debug', sprite: 'sg-tessa', x: 14, z: 15, face: 2.6,
      news: () => !st.bugFiled,
      talk: () => ({
        text: 'TESSA-7, agentic test-debug framework for MLOps (prototype). I run the tests, read the failures, debug, and file the bug report. Myself. Want a demo?',
        choices: [
          { label: 'Run the test suite', icon: 'list-checks', next: () => {
            st.bugFiled = true; ctx.save(); findTest(); sfx('stamp');
            return { text: 'Running… one failure: test_agent_loop_terminates. Reading logs… root cause: the loop has no exit condition. Filing bug report… Title: "The Agent Loop does not terminate". Assignee: you. Priority: boss. Location: the compute array, north.', choices: [{ label: 'Accepted' }] };
          } },
          { label: 'Do you file bugs about yourself?', next: { text: 'Constantly. Latest: "Tessa-7 files too many bug reports." Filed by: Tessa-7. Status: won\'t fix. Resolution: working as intended.', choices: [{ label: 'Fair' }] } },
          { label: 'Bye' },
        ],
      }),
    });

    // ================================================================ the agent swarm (emergent specialization)
    const swarm = [];
    for (let i = 0; i < 9; i++) {
      const x = -19 + hash3(i, 1, 2) * 7, z = -3 + hash3(i, 2, 1) * 9;
      const plain = sprite(ctx, 'sg-agent', { x, z, scale: 0.16 });
      swarm.push({ x, z, tx: x, tz: z, wait: hash3(i, 5, 5) * 2, plain, role: -1, roleMesh: null, slot: 0 });
    }
    let specialised = false, relay = 0;
    function specialise() {
      if (specialised) { toast('Already specialised: planners, tool-callers, critics. Division of labour achieved.', { icon: 'check' }); return; }
      specialised = true;
      // each agent drifts to its nearest station, but no station takes more than three
      const count = [0, 0, 0];
      const order = swarm.map((a, i) => i).sort((a, b) => hash3(a, 9, 9) - hash3(b, 9, 9));
      for (const i of order) {
        const a = swarm[i];
        const ds = STATIONS.map((s, k) => (count[k] >= 3 ? Infinity : Math.hypot(s.x - a.x, s.z - a.z)));
        const k = ds.indexOf(Math.min(...ds));
        a.role = k; a.slot = count[k]++;
        a.roleMesh = sprite(ctx, `sg-agent-${STATIONS[k].role}`, { x: a.x, z: a.z, scale: 0.16 });
        a.roleMesh.visible = false;
      }
      sfx('buddy');
      toast('Ping! The agents negotiate roles…', { icon: 'messages-square' });
      setTimeout(() => {
        for (const a of swarm) { a.plain.visible = false; a.roleMesh.visible = true; }
        banner('Emergent specialization', 'Nobody assigned roles. Three planners, three tool-callers, three critics.', 'star-swirl');
        findSwarm();
        token.visible = true;
      }, 2600);
    }
    interactable(ctx, { x: -16, z: 2.6, r: 2.2, label: 'Swarm beacon', prompt: 'E · ping the agents', onInteract: () => specialise() });

    // ================================================================ memory palace (adaptive sequence)
    const mem = { state: 'idle', len: 3, seq: [], pos: 0, t: 0, show: -1 };
    function startMemory() {
      if (mem.state === 'show') return;
      mem.seq = Array.from({ length: mem.len }, () => Math.floor(Math.random() * 4));
      mem.state = 'show'; mem.pos = 0; mem.t = -0.6; mem.show = -1;
      toast(`Watch the banks: ${mem.len} to remember.`, { icon: 'eye' });
    }
    BANKS.forEach(([x, z], i) => trigger(ctx, { x, z, w: 2, d: 2, onEnter: () => {
      if (mem.state !== 'input') return;
      paintBanks(i); sfx('tick');
      setTimeout(() => { if (mem.state === 'input' || mem.state === 'idle') paintBanks(); }, 350);
      if (mem.seq[mem.pos] !== i) {
        mem.len = Math.max(2, mem.len - 1);
        mem.state = 'idle';
        sfx('error');
        toast(`Forgot one. Adaptive memory: the next sequence is ${mem.len} long.`, { icon: 'rotate-ccw', tone: 'bad' });
        setTimeout(startMemory, 1400);
        return;
      }
      mem.pos++;
      if (mem.pos >= mem.seq.length) {
        sfx('coin');
        mem.state = 'idle';
        if (mem.len >= 5) { st.memory = true; ctx.save(); banner('Adaptive memory', 'Five in a row. Long-term reasoning: engaged.', 'crystal-ball'); findMemory(); mem.len = 3; return; }
        mem.len++;
        toast(`Remembered! Next: ${mem.len}.`, { icon: 'check', tone: 'good' });
        setTimeout(startMemory, 1200);
      }
    } }));
    interactable(ctx, { x: 17, z: 2.6, r: 2, label: 'Recall orb', prompt: 'E · start', onInteract: () => { if (mem.state === 'idle') startMemory(); } });

    // ================================================================ the simulator, the podium
    let ffUntil = 0, skyT = 0;
    const SKY_CYCLE = [['#c7d2fe', '#080c1e'], ['#fdba74', '#3b1d10'], ['#bfdbfe', '#6b8fbf'], ['#f0abfc', '#3b1440']];
    interactable(ctx, { x: 20.5, z: 10.6, r: 2.2, label: 'Cycle-accurate simulator', prompt: 'E · fast-forward',
      onInteract: () => {
        if (lastT < ffUntil) return;
        ffUntil = lastT + 10;
        sfx('warp');
        toast('Simulating ahead: a whole day of the fab in ten seconds.', { icon: 'hourglass' });
        findSim();
      } });
    interactable(ctx, { x: -16, z: 14.4, r: 2, label: 'Podium', prompt: 'E · present findings',
      onInteract: () => dialog({
        text: 'The research team is seated. The screen glows. Time to present.',
        choices: [
          { label: 'Slide 1: agent workloads', next: { text: '"Agents plan, call tools, reflect, and loop. That is a very different workload." The audience nods. One agent takes notes.', choices: [{ label: 'Next slide', next: { text: '"What does it mean for the hardware? We explored that through simulation." A planner agent raises a hand, then decides to wait until the end.', choices: [{ label: 'Take questions', action: () => present() }] } }] } },
          { label: 'Skip to questions', action: () => present() },
          { label: 'Not yet' },
        ],
      }, { name: 'Research team hall', sprite: 'sg-probe' }) });
    function present() {
      st.presented = true; ctx.save();
      sfx('victory');
      banner('Findings presented', 'Polite applause. Someone asks about future work. You say "future work".', 'graduation-cap');
      findPresent();
    }

    // ================================================================ theme chips, portal
    const THEMES = [
      ['sg-theme-1', -18, -1, 'Multi-agent coordination and collective intelligence'],
      ['sg-theme-2', -6, -21, 'Structured action spaces and efficient decision-making'],
      ['sg-theme-3', HBM.x, HBM.z, 'Adaptive memory mechanisms for long-term reasoning'],
      ['sg-theme-4', -20, 20, 'Trust, interpretability and human-AI collaboration'],
      ['sg-theme-5', 21, 18, 'Emergent specialization and role formation'],
    ];
    for (const [id, x, z, text] of THEMES) {
      pickup(ctx, { id, x, z, sprite: 'sg-chip', scale: 0.16, onPick: () => {
        st.themes = (st.themes || 0) + 1; ctx.save();
        toast(`Research theme (${st.themes}/5): ${text}.`, { icon: 'scroll-text' });
      } });
    }
    portal(ctx, { x: 0, z: 22.5, to: 'hub', color: BLUE });

    // ================================================================ quest + eggs
    quest({
      id: 'samsung-themes', title: 'Five open questions',
      steps: [
        { id: 'probe', text: 'Talk to Probe at the die entrance', done: () => !!st.metProbe },
        { id: 'chips', text: 'Collect the 5 research-theme chips', done: () => (st.themes || 0) >= 5 },
        { id: 'present', text: 'Present your findings at the hall\'s podium', done: () => !!st.presented },
      ],
      reward: { gold: 200, xp: 90 },
    });
    const findIntern = egg('samsung-intern', 'Jun – Sep 2026, San Jose', 'Ask Probe what the work involved.', 'Summer research intern at Samsung Semiconductor: architecture for agentic AI workloads.');
    const findSwarm = egg('samsung-swarm', 'Emergent specialization', 'Ping the helper agents in the agent commons.', 'Roles formed on their own: planners, tool-callers, critics.');
    const findMemory = egg('samsung-memory', 'Adaptive memory', 'Remember a five-bank sequence in the memory palace.', 'The sequence adapted to you. Long-term reasoning, short-term panic.');
    const findTest = egg('samsung-testdebug', 'Files its own bug reports', 'Ask Tessa-7 to run the tests.', 'An agentic test-debug framework prototype for MLOps: a real internship project.');
    const findSim = egg('samsung-fastforward', 'Fast-forward', 'Run the cycle-accurate simulator in the MLOps bay.', 'Exploring future hardware through simulation. A day in ten seconds.');
    const findPresent = egg('samsung-present', 'Presented to the research team', 'Present at the podium in the hall.', 'Documented findings, presented insights. Polite applause.');
    const findReshape = egg('samsung-reshape', 'Reshaped the accelerator', 'Light all nine PE tiles in the compute array.', 'Toward accelerators that better support agent workloads.');
    const findWisp = egg('samsung-hallucination', 'Confidently wrong', 'Defeat a Hallucination Wisp.', 'It cited three sources. None of them exist.');
    const findLoop = egg('samsung-loop', 'Loop terminated', 'Defeat The Agent Loop.', 'Samsung Semiconductor Badge earned.');

    // ================================================================ per frame
    const tmpC = new THREE.Color(), tmpF = new THREE.Color();
    onUpdate(ctx, (dt, t) => {
      lastT = t;
      const ff = t < ffUntil;
      const k = ff ? 6 : 1;
      glowMesh.userData.setHi(0.25 + 0.25 * Math.sin(t * 2.2 * k));
      // NoC packets
      for (let i = 0; i < N_PK; i++) {
        const p = pkS[i];
        p.s += p.dir * dt * 4.5 * k;
        if (p.s > 44) p.s -= 44; else if (p.s < 0) p.s += 44;
        const [ax, v] = LANES[p.lane];
        const u = p.s - 22;
        if (ax === 'x') _m.makeTranslation(v + ctx.ox, 2.85, u + ctx.oz); else _m.makeTranslation(u + ctx.ox, 2.85, v + ctx.oz);
        pk.setMatrixAt(i, _m);
      }
      pk.instanceMatrix.needsUpdate = true;
      // fast-forward: the sky runs through a day
      if (ff) {
        skyT -= dt;
        if (skyT <= 0) {
          skyT = 0.15;
          const f = ((10 - (ffUntil - t)) / 10) * SKY_CYCLE.length;
          const a = SKY_CYCLE[Math.floor(f) % SKY_CYCLE.length], b = SKY_CYCLE[(Math.floor(f) + 1) % SKY_CYCLE.length], w = f % 1;
          setSky({ ...SKY, tint: `#${tmpC.set(a[0]).lerp(tmpF.set(b[0]), w).getHexString()}`, fog: `#${tmpC.set(a[1]).lerp(tmpF.set(b[1]), w).getHexString()}` });
        }
      } else if (ffUntil) { ffUntil = 0; setSky(SKY); }
      // KV-cache bloat grows while it lives
      for (const e of kvFoes) {
        if (!e.f.alive) { e.age = 0; continue; }
        e.age += dt * k;
        e.f.mesh.scale.setScalar(0.22 * (1 + Math.min(0.9, e.age * 0.03)));
      }
      // the swarm: wander, or gather at their station and pass a token around
      for (let i = 0; i < swarm.length; i++) {
        const a = swarm[i];
        if (a.role >= 0) { const s = STATIONS[a.role]; a.tx = s.x + (a.slot - 1) * 1.3 + 1.5; a.tz = s.z + (a.role === 0 ? 0 : -1.4); }
        else { a.wait -= dt * k; if (a.wait <= 0) { a.wait = 1.5 + Math.random() * 2.5; a.tx = -19 + Math.random() * 7; a.tz = -3 + Math.random() * 9; } }
        const dx = a.tx - a.x, dz = a.tz - a.z, l = Math.hypot(dx, dz);
        if (l > 0.1) { const s = Math.min(l, dt * 2.4 * k); a.x += dx / l * s; a.z += dz / l * s; }
        const m = a.role >= 0 && a.roleMesh?.visible ? a.roleMesh : a.plain;
        m.position.set(a.x + ctx.ox, 2.5 + Math.abs(Math.sin(t * 6 + i)) * 0.15, a.z + ctx.oz);
        if (l > 0.1) m.rotation.y = Math.atan2(dx, dz);
        m.userData.setFrame?.(Math.floor(t * 6 + i) % 2);
      }
      if (token.visible) {
        relay = (relay + dt * 0.5 * k) % 3;
        const i = Math.floor(relay), w = relay - i, A = STATIONS[i], B = STATIONS[(i + 1) % 3];
        _m.makeTranslation(A.x + (B.x - A.x) * w + 1.5 + ctx.ox, 4 + Math.sin(w * Math.PI) * 1.5, A.z + (B.z - A.z) * w + ctx.oz);
        token.setMatrixAt(0, _m); token.instanceMatrix.needsUpdate = true;
      }
      // memory palace playback
      if (mem.state === 'show') {
        mem.t += dt;
        const slot = Math.floor(mem.t / 0.9), inSlot = mem.t - slot * 0.9;
        if (mem.t >= 0 && slot < mem.seq.length) {
          const on = inSlot < 0.65 ? mem.seq[slot] : -1;
          if (on !== mem.show) { mem.show = on; paintBanks(on); if (on >= 0) sfx('tick'); }
        } else if (slot >= mem.seq.length) { mem.state = 'input'; mem.pos = 0; paintBanks(); toast('Your turn: step on the banks in order.', { icon: 'footprint' }); }
      }
      // the boss: name shows its next step, the shield shows whether the array fits it
      if (boss.alive && !wasAlive) { scramble(); introShown = false; retries = 0; }
      wasAlive = boss.alive;
      shield.visible = boss.alive && !solved;
      if (shield.visible) { shield.position.set(boss.x, boss.y + 2.8, boss.z); shield.rotation.y = t * 0.6; }
      if (boss.alive) {
        const list = [].concat(boss.phase?.pattern || boss.cfg.pattern);
        const next = list[boss.pi % list.length];
        if (next !== lastStep) { if (lastStep === 'charge') retries++; lastStep = next; }
        boss.name = next === 'charge' ? `The Agent Loop · RETRY (attempt ${retries + 2})` : `The Agent Loop · ${STEP[next] || 'THINKING'}…`;
      }
    });

    onEnter(ctx, () => {
      if (!st.visited) { st.visited = true; ctx.save(); setTimeout(() => say('bit', 'We\'re standing on a chip! Everything glows and hums.'), 900); }
      if (!hasItem('badge-samsung')) setTimeout(() => say('sg-probe', 'Welcome to the die!'), 2300);
    });
    onLeave(ctx, () => { if (ffUntil) { ffUntil = 0; } mem.state = 'idle'; paintBanks(); });
  },
};
