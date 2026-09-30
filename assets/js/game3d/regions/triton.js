// regions/triton.js: the TritonGym arena (TritonGym: a benchmark for agentic LLM workflows that write Triton GPU
// kernels; Yue Guan* and Yichen Lin*, equal contribution; under review at ICML 2026). A GPU as a gym:
//   - south: the entrance, an @triton.jit arch, the paper plaque and a trident statue (Triton the language and
//     King Triton the UCSD mascot share a name, nothing else)
//   - west: streaming-multiprocessor blocks where warps of threads march in lockstep; Coach Warp
//   - east: HBM stacks, memory streaming across the sky, and the leaderboard
//   - north: Kernie, an LLM agent who writes kernels (compile error → wrong → slow → fast)
//   - centre: the benchmark ring and the CUDA OOM Golem. It caches everything (40% damage). Memory pressure
//     rises as it attacks and keeps activations alive; pull the "Batch size ×2" levers to push it over 100% and
//     it runs out of memory, freezing for a few seconds (×3 damage) (→ relic-triton)
//   - side quest: Kernie's four tools (compiler, profiler, test oracle, docs) wandered off
import * as THREE from 'three/webgpu';
import {
  terrain, props, registerArt, registerEnemyKind, spawnEnemy, spawnBoss, spawnNpc, interactable, trigger,
  pickup, portal, quest, egg, say, banner, toast, sfx, onUpdate, onEnter, onLeave, dialog, hash3, hasItem,
  cinematic,
} from '../regions.js';
import { TRITON_ART } from './art-triton.js';

const SEA = '#0ea5e9', GPU = '#4ade80';
const ARENA = { x: 0, z: -3 };
const LEVERS = [[0, -13.5], [10.5, -3], [-10.5, -3], [0, 7.5]];
const SM_X = [[-21, -18], [-16, -13]], SM_Z = [[-14, -11], [-8, -5], [-2, 1]];
const HBM = [[15, -14], [18, -14], [15, -10], [18, -10]];
const SKY = { tint: '#a5f3fc', ground: '#04121c', fog: '#03101a', density: 0.0074, sun: 2.2 };

const inIsland = (x, z) => {
  const ax = Math.abs(x), az = Math.abs(z);
  if (ax > 22 || az > 22) return false;
  const ex = Math.max(0, ax - 17), ez = Math.max(0, az - 17);
  return ex * ex + ez * ez <= 26;
};
const inSM = (x, z) => SM_X.some(([a, b]) => x >= a && x <= b) && SM_Z.some(([a, b]) => z >= a && z <= b);
const arenaD = (x, z) => Math.hypot(x - ARENA.x, z - ARENA.z);
function groundH(x, z) {
  if (!inIsland(x, z)) return null;
  if (arenaD(x, z) < 10) return 2;
  if (inSM(x, z)) return 4;
  return 3;
}

export default {
  id: 'triton',
  name: 'TritonGym arena',
  subtitle: 'A benchmark for LLM agents that write Triton GPU kernels · under review, ICML 2026',
  size: 50,
  spawn: [0, 19],
  sky: SKY,
  zones: {
    entrance: { x: 0, z: 18, r: 5, label: 'Gym entrance' },
    ring: { x: ARENA.x, z: ARENA.z, r: 10, label: 'The benchmark ring' },
    sm: { x: -17, z: -6, r: 7, label: 'SM blocks · warps in lockstep' },
    hbm: { x: 17, z: -11, r: 5, label: 'HBM stacks' },
    board: { x: 19, z: 5.5, r: 4, label: 'The leaderboard' },
    lab: { x: 0, z: -18, r: 4.5, label: 'Agent lab' },
    statue: { x: 9, z: 16, r: 3, label: 'Triton (no relation)' },
  },

  build(ctx) {
    for (const [name, art] of Object.entries(TRITON_ART)) registerArt(name, art, name === 'tg-tensor' ? { T: 0.8 } : name === 'tg-kernie' ? { G: 2, Y: 0.8 } : name === 'tg-thread' ? { G: 0.5 } : null);
    const st = ctx.state;
    let lastT = 0;

    // ================================================================ terrain
    terrain(ctx, {
      size: 50,
      height: groundH,
      type: (x, z) => {
        const d = arenaD(x, z);
        if (d < 10) return d > 8.6 ? 'ringEdge' : (Math.round(x) + Math.round(z)) & 1 ? 'matA' : 'matB';
        if (d < 11.2) return 'rim';
        if (inSM(x, z)) return (Math.round(x) % 2 === 0 || Math.round(z) % 2 === 0) ? 'smLine' : 'sm';
        if (Math.abs(x) <= 1 && z > 8) return 'path';
        return hash3(x, 2, z) < 0.06 ? 'via' : 'pcb';
      },
      palette: {
        pcb: ['#0b2530', '#0d2a36', '#0a222c'], via: ['#1e6f8a', '#23809e'], path: ['#334155', '#3a4960'],
        matA: ['#1e293b', '#233044'], matB: ['#172033', '#1b263b'], ringEdge: [SEA, '#38bdf8'], rim: ['#475569', '#51617a'],
        sm: ['#14532d', '#166534'], smLine: [GPU, '#22c55e'],
      },
    });

    // ================================================================ props
    const solid = [], deco = [], glow = [];
    // HBM stacks: layered dies with glowing through-silicon vias
    for (const [x0, z0] of HBM) for (let x = x0; x <= x0 + 1; x++) for (let z = z0; z <= z0 + 2; z++) for (let y = 4; y <= 9; y++) {
      if (x === x0 + 1 && z === z0 + 1 && y % 2) glow.push([x, y, z, SEA, 1.6]);
      else solid.push([x, y, z, y === 9 ? '#94a3b8' : y % 2 ? '#334155' : '#475569']);
    }
    // the leaderboard wall (east): rows of bars (decorative; no numbers)
    for (let z = 2; z <= 9; z++) for (let y = 4; y <= 8; y++) {
      const row = 8 - y, len = [7, 6, 6, 4, 2][row];
      const lit = z - 2 < len && y > 4;
      (lit ? glow : solid).push([21, y, z, lit ? (row === 0 ? '#fbbf24' : GPU) : '#0f172a', lit ? 1.2 : 0]);
    }
    // agent lab desk + monitor
    for (let x = -2; x <= 2; x++) solid.push([x, 4, -20, '#78350f']);
    for (let x = -1; x <= 1; x++) for (let y = 5; y <= 6; y++) glow.push([x, y, -20.5, (x + y) % 2 ? GPU : '#052e16', 1.2]);
    // @triton.jit arch at the entrance
    for (let y = 4; y <= 8; y++) solid.push([-2, y, 13, '#1e3a8a'], [2, y, 13, '#1e3a8a']);
    for (let x = -2; x <= 2; x++) glow.push([x, 9, 13, SEA, 1.5]);
    // the trident statue (no relation) and the paper plaque's pedestal
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) solid.push([9 + dx, 4, 16 + dz, '#cbd5e1']);
    for (let y = 5; y <= 10; y++) deco.push([9.5, y, 16.5, '#d97706']);
    for (let x = 7.5; x <= 11.5; x += 1) deco.push([x, 10, 16.5, '#fbbf24']);
    for (const x of [7.5, 9.5, 11.5]) { deco.push([x, 11, 16.5, '#fbbf24']); glow.push([x, 12, 16.5, '#fde047', 0.5]); }
    solid.push([-8, 4, 16, '#475569'], [-7, 4, 16, '#475569']);
    glow.push([-8, 5, 16, SEA, 0.8], [-7, 5, 16, SEA, 0.8]);
    // lever posts on the rim of the ring
    for (const [x, z] of LEVERS) solid.push([Math.round(x), 4, Math.round(z), '#1f2937']);
    // gym stuff: dumbbell racks by the SM blocks
    for (const z of [5, 8]) { for (let x = -21; x <= -18; x++) deco.push([x, 4, z, '#1f2937']); deco.push([-21, 5, z, '#64748b'], [-18, 5, z, '#64748b']); }
    props(ctx, solid, { block: true });
    props(ctx, deco);
    const glowMesh = props(ctx, glow, { shadow: false });

    // ================================================================ instanced: VRAM bar, lever handles, memory streams
    const _m = new THREE.Matrix4(), col = new THREE.Color(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3(), ax = new THREE.Vector3(1, 0, 0);
    const inst = (geo, n, color = '#ffffff') => { const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicNodeMaterial({ color }), n); m.castShadow = false; m.frustumCulled = false; ctx.group.add(m); return m; };
    const N_BAR = 28;
    const bar = inst(new THREE.BoxGeometry(0.8, 0.8, 0.8), N_BAR);
    for (let i = 0; i < N_BAR; i++) { const a = (i / N_BAR) * Math.PI * 2 + Math.PI / 2; _m.makeTranslation(ARENA.x + Math.cos(a) * 10.6 + ctx.ox, 3.9, ARENA.z + Math.sin(a) * 10.6 + ctx.oz); bar.setMatrixAt(i, _m); }
    const handles = inst(new THREE.BoxGeometry(0.25, 1.6, 0.25), 4, '#f43f5e');
    const pulled = [0, 0, 0, 0];
    const N_STREAM = 20;
    const streams = inst(new THREE.BoxGeometry(0.5, 0.3, 0.3), N_STREAM, '#7dd3fc');
    const sS = Array.from({ length: N_STREAM }, (_, i) => ({ s: hash3(i, 1, 9), lane: i % 4 }));

    // ================================================================ enemies
    const warps = [[], []];
    const warpDone = [false, false];
    const kinds = {
      'triton-thread': { name: 'Thread', sprite: 'tg-thread', hp: 12, speed: 4.4, dmg: 4, type: 'Electric', xp: 7, gold: 7, behaviour: 'swarm', scale: 0.17, color: GPU, aggro: 8 },
      'triton-bank': { name: 'Bank Conflict', sprite: 'tg-bank', hp: 40, speed: 3, dmg: 9, type: 'Normal', xp: 22, gold: 20, behaviour: 'chase', scale: 0.22, color: '#93c5fd' },
      'triton-race': { name: 'Race Condition', sprite: 'tg-race', hp: 30, speed: 4.2, dmg: 9, type: 'Fire', xp: 20, gold: 18, behaviour: 'charge', rate: 2600, scale: 0.22, color: '#fb923c' },
      'triton-uncoal': { name: 'Uncoalesced Access', sprite: 'tg-uncoal', hp: 26, speed: 2.6, dmg: 7, type: 'Psychic', xp: 18, gold: 16, behaviour: 'ranged', rate: 2000, proj: 'psy', flying: true, scale: 0.2, color: '#c084fc' },
      'triton-tensor': { name: 'Activation Tensor', sprite: 'tg-tensor', hp: 20, speed: 3, dmg: 6, type: 'Water', xp: 8, gold: 6, behaviour: 'chase', scale: 0.2, color: '#22d3ee' },
      'triton-idle': { name: 'Idle Thread (waiting at a barrier)', sprite: 'tg-thread', hp: 6, speed: 0.8, dmg: 0, type: 'Normal', xp: 1, gold: 1, behaviour: 'wander', scale: 0.15, color: GPU,
        onDeath: () => findSync() },
    };
    for (const [id, k] of Object.entries(kinds)) registerEnemyKind(id, k);
    [[-16.5, -9.5], [12.5, 12.5]].forEach(([x, z], w) => {
      for (let i = 0; i < 4; i++) {
        const f = spawnEnemy(ctx, { kind: 'triton-thread', x: x + (i % 2), z: z + Math.floor(i / 2), onDeath: () => {
          if (warps[w].every((t) => !t.alive) && !warpDone[w]) { warpDone[w] = true; findWarp(); toast('Warp retired: all its threads exited together. Lockstep to the end.', { icon: 'check' }); }
        } });
        warps[w].push(f);
      }
    });
    for (const [kind, list] of [['triton-bank', [[13, -5], [12, -17]]], ['triton-race', [[-7, 12]]], ['triton-uncoal', [[-15, 14], [15, -19]]], ['triton-idle', [[-19, 3]]]]) for (const [x, z] of list) spawnEnemy(ctx, { kind, x, z });

    // ================================================================ boss: the CUDA OOM Golem and memory pressure
    let vram = 25, stunT = 0, lastPi = 0;
    const boss = spawnBoss(ctx, {
      id: 'triton-oom-golem', name: 'CUDA OOM Golem', sprite: 'golem', scale: 0.36, x: ARENA.x, z: ARENA.z,
      hp: 520, type: 'Ice', r: 1.8, color: '#93c5fd', contact: 12, speed: 1.1, aggro: 10.5,
      pattern: ['rings', 'summon', 'fan'],
      phases: [{ below: 0.5, pattern: ['rings', 'volley', 'summon', 'charge'] }],
      minion: 'triton-tensor', reward: { gold: 380, xp: 140 }, drop: 'relic-triton', respawn: 45000,
      onDefeat: (b, { first }) => {
        stunT = 0; b.mesh.rotation.z = 0;
        findRelic();
        banner('Benchmark complete', first ? 'TritonGym Relic earned. Memory freed, kernels measured, golem garbage-collected.' : 'Freed again. It will allocate its way back.', 'gem-pendant');
        say('me', first ? 'torch.cuda.empty_cache(). Permanently.' : 'Freed. Again.');
      },
    });
    const bossHit = boss.hit.bind(boss), bossUpdate = boss.update.bind(boss);
    let hintAt = 0;
    boss.hit = (dmg, info) => {
      if (!stunT && lastT - hintAt > 5) { hintAt = lastT; toast('It caches everything: 40% damage. Push VRAM to 100%: pull the "Batch size ×2" levers on the ring (or let it summon activations). Then hit it while it is out of memory.', { icon: 'cpu', tone: 'bad' }); }
      return bossHit(Math.max(1, Math.round(dmg * (stunT ? 3 : 0.4))), info);
    };
    // while it is out of memory it does nothing at all
    boss.update = (dt) => { if (stunT > 0 && boss.alive) return; bossUpdate(dt); };
    function oom() {
      stunT = 7;
      boss.clearHazards();
      for (const m of boss.minions) if (m.alive) m.hit(9999);
      boss.mesh.rotation.z = 0.35;
      sfx('boom');
      banner('RuntimeError: CUDA out of memory', 'Tried to allocate 2.00 GiB; 0 bytes free. The golem is frozen: hit it! (×3 damage)', 'triangle-alert');
      findOOM();
    }
    function addVram(n) {
      if (!boss.alive || stunT) return;
      vram = Math.min(100, vram + n);
      if (vram >= 100) oom();
    }
    LEVERS.forEach(([x, z], i) => {
      interactable(ctx, { x: x + (x ? -Math.sign(x) * 1.2 : 0), z: z + (x ? 0 : -Math.sign(z - ARENA.z) * 1.2), r: 2, label: 'Batch size ×2', prompt: 'E · pull', y: 3.5, onInteract: () => {
        if (pulled[i] > 0) return;
        pulled[i] = 1.2;
        sfx('flip');
        st.pulls = (st.pulls || 0) + 1; ctx.save();
        if (st.pulls >= 3) findBatch();
        if (!boss.alive) { toast('Batch size doubled. With no golem to feed, nothing happens. Beautiful, efficient nothing.', { icon: 'gauge' }); return; }
        if (stunT) { toast('It is already out of memory. Hit it!', { icon: 'swords' }); return; }
        toast(`Batch size ×2. VRAM ${Math.min(100, Math.round(vram + 25))}%.`, { icon: 'gauge' });
        addVram(25);
      } });
    });
    let introShown = false;
    trigger(ctx, { x: ARENA.x, z: ARENA.z, r: 9.5, maxY: 3.5, onEnter: () => {
      if (!boss.alive || introShown) return;
      introShown = true;
      cinematic(ctx, { x: ARENA.x, y: 4, z: ARENA.z, pitch: 0.4, dist: 17, seconds: 2 });
      banner('THE CUDA OOM GOLEM', 'It allocates and never frees. Feed it: the "Batch size ×2" levers push its VRAM to 100%.', 'cpu');
      sfx('encounter');
    } });

    // ================================================================ NPCs
    spawnNpc(ctx, {
      id: 'tg-kernie', name: 'Kernie · kernel agent', sprite: 'tg-kernie', x: -3.5, z: -17.5, face: 0.4,
      news: () => !st.metKernie || ((st.tools || 0) >= 4 && !st.toolsDone),
      talk: () => {
        st.metKernie = true; ctx.save();
        const n = st.tools || 0;
        const attempts = [
          'Attempt 1: `y = tl.softmax_fast(x)`. …Compile error: tl.softmax_fast does not exist. I may have imagined it. Very confidently.',
          'Attempt 2: compiles! Running the correctness check… the last block is wrong. I forgot to mask the ragged edge where the row is not a multiple of the block size.',
          'Attempt 3: masked. Correct on every test! Timing it… correct, but slower than the reference. Correct is not the same as good.',
          'Attempt 4: fused the max, the exponent and the sum into one pass over the row. Correct, and faster than the reference on this toy input. (Toy numbers, toy gym. The real measurements are in the paper.)',
        ];
        const step = (i) => ({
          text: attempts[i],
          choices: i < 3 ? [{ label: ['Read the error, try again', 'Fix the mask', 'Profile it'][i], next: () => step(i + 1) }, { label: 'Stop here' }] : [{ label: 'Ship it', action: () => { findAgent(); banner('Kernel accepted', 'Compiles ✓ Correct ✓ Fast ✓. Every step measured.', 'cpu'); } }],
        });
        if (st.toolsDone) return { text: 'Compiler, profiler, test oracle, docs: all mine again. An agent with tools is a very different agent. Want another kernel?', choices: [{ label: 'Write a softmax kernel', next: () => step(0) }, { label: 'Later' }] };
        if (n >= 4) {
          st.toolsDone = true; ctx.save();
          sfx('achievement'); findTools();
          banner('Tool-augmented', 'Compiler, profiler, test oracle, docs: back in the loop.', 'check');
          return { text: 'My tools! Compiler to catch my imaginary functions, test oracle to catch my wrong answers, profiler to catch my slow ones, docs so I stop imagining functions. Benchmarking tool-augmented agents like me is the whole point of TritonGym.', choices: [{ label: 'Welcome back' }] };
        }
        return {
          text: 'Hi! I\'m Kernie, an LLM agent. I write Triton GPU kernels. Give me a task and watch me work. Every step gets measured here; that is the gym.',
          choices: [
            { label: 'Write a softmax kernel', icon: 'cpu', next: () => step(0) },
            { label: 'What is TritonGym?', next: () => { findPython(); return { text: 'A benchmark for agentic LLM workflows in Triton GPU code generation. Triton lets you write GPU kernels in Python; agents like me try, with tools, and the harness measures what actually happens: does it compile, is it correct, is it fast. Systems behavior, not demo-only prompting wins.', choices: [{ label: 'Neat' }] }; } },
            { label: n ? `Your tools? (${n}/4 found)` : 'You look… under-equipped', next: { text: 'My four tools wandered off: the compiler (the SM blocks, west), the profiler (by the HBM stacks, east), the test oracle (by the leaderboard) and the docs (the far north-west corner). Without them I am just a very confident text generator.', choices: [{ label: 'I\'ll find them' }] } },
            { label: 'Bye' },
          ],
        };
      },
    });
    spawnNpc(ctx, {
      id: 'tg-coach', name: 'Coach Warp', sprite: 'tg-coach', x: -11, z: -12, face: 1,
      news: () => !st.metCoach,
      talk: () => {
        st.metCoach = true; ctx.save();
        return {
          text: 'THIRTY-TWO THREADS! ONE INSTRUCTION! IN LOCKSTEP! …Oh, hello. Coach Warp. Welcome to the gym.',
          choices: [
            { label: 'What is a warp?', next: { text: 'Threads on a GPU march in groups called warps: same instruction, different data. If they branch differently, they have to take turns: divergence. Not in my gym. The two squads out there march together, and they go down together.', choices: [{ label: 'Hut, hut' }] } },
            { label: 'How do I beat the golem?', icon: 'swords', next: { text: 'The CUDA OOM Golem? It allocates and allocates and never frees. Don\'t fight the memory: feed it! Pull the "Batch size ×2" levers around the ring. At 100% VRAM it runs out of memory and freezes. THEN you hit it. Hard. Three times as hard.', choices: [{ label: 'Feed it, then hit it' }] } },
            { label: 'Why "TritonGym"?', next: { text: 'Triton: a language for writing GPU kernels. Gym: where you train and get measured. Put them together: a benchmark where LLM agents write Triton kernels and get measured. The paper is by Yue Guan and Yichen Lin, equal contribution, et al.', choices: [{ label: 'Got it' }] } },
            { label: 'Bye' },
          ],
        };
      },
    });

    // ================================================================ interactables, pickups, portal
    interactable(ctx, { x: -7.5, z: 14.6, r: 2.2, label: 'The paper', prompt: 'E · read', onInteract: () => {
      findPaper();
      dialog({ text: 'TritonGym: A Benchmark for Agentic LLM Workflows in Triton GPU Code Generation. Yue Guan*, Yichen Lin*, et al. (* equal contribution). Status: under review, ICML 2026. No verdict yet, and no spoilers in this gym.', choices: [{ label: 'Fingers crossed' }] }, { name: 'The paper', sprite: 'book' });
    } });
    interactable(ctx, { x: 9.5, z: 14.4, r: 2.2, label: 'A trident statue', prompt: 'E · read', onInteract: () => {
      findMascot();
      dialog({ text: 'TRITON. Not this one. The GPU kernel language has nothing to do with King Triton, UC San Diego\'s mascot, whose statue stands back on campus. Same name, pure coincidence. The statue would like it noted that he is flattered.', choices: [{ label: 'Coincidence noted' }] }, { name: 'Plaque', sprite: 'triton' });
    } });
    interactable(ctx, { x: 19.5, z: 5.5, r: 2.4, label: 'Leaderboard', prompt: 'E · read', onInteract: () => {
      findBoard();
      dialog({ text: 'WHAT GETS MEASURED HERE: does the kernel compile? Is it correct? How fast is it? WHAT DOES NOT GET A COLUMN: how impressive the demo prompt looked. Measurable systems behavior, not demo-only prompting wins. (The bars on this wall are decorative. The real numbers live in the paper.)', choices: [{ label: 'Fair and measured' }] }, { name: 'Leaderboard', sprite: 'tg-kernie' });
    } });
    trigger(ctx, { x: 0, z: 13, r: 1.3, onEnter: () => {
      findJit();
      if (lastT - (st._jitT || 0) > 6) { st._jitT = lastT; toast('@triton.jit: you have been just-in-time compiled. You feel faster. (You are not faster.)', { icon: 'lightning-branches' }); sfx('zap'); }
    } });
    for (const [id, x, z, sp, what] of [['triton-tool-1', -19.5, -12.5, 'tg-wrench', 'the compiler'], ['triton-tool-2', 17, -5, 'tg-watch', 'the profiler'], ['triton-tool-3', 18.5, 11.5, 'tg-check', 'the test oracle'], ['triton-tool-4', -18, -19, 'book', 'the docs']]) {
      pickup(ctx, { id, x, z, sprite: sp, scale: sp === 'book' ? 0.12 : 0.16, onPick: () => {
        st.tools = (st.tools || 0) + 1; ctx.save();
        toast(st.tools < 4 ? `Kernie's tool (${st.tools}/4): ${what}.` : `All 4 tools! Back to Kernie in the agent lab (north).`, { icon: 'backpack' });
      } });
    }
    portal(ctx, { x: -10, z: 20, to: 'hub', color: SEA });
    trigger(ctx, { x: 0, z: 16, r: 2.5, once: true, onEnter: () => say('bit', 'A GPU gym! Is that… the CUDA OOM Golem in the ring?') });

    // ================================================================ quest + eggs
    quest({
      id: 'triton-tools', title: 'Tool-augmented',
      steps: [
        { id: 'meet', text: 'Talk to Kernie in the agent lab (north)', done: () => !!st.metKernie },
        { id: 'find', text: 'Find Kernie\'s 4 tools', done: () => (st.tools || 0) >= 4 },
        { id: 'back', text: 'Bring them back to Kernie', done: () => !!st.toolsDone },
      ],
      reward: { gold: 170, xp: 70 },
    });
    const findJit = egg('triton-jit', '@triton.jit', 'Walk through the arch at the TritonGym entrance.', 'Just-in-time compiled. Feels faster. Is not.');
    const findPaper = egg('triton-paper', 'Equal contribution', 'Read the paper plaque at the TritonGym entrance.', 'Yue Guan*, Yichen Lin*: equal contribution. Under review at ICML 2026.');
    const findMascot = egg('triton-mascot', 'No relation', 'Read the trident statue\'s plaque.', 'Triton the GPU language, Triton the UCSD mascot: a happy coincidence.');
    const findBoard = egg('triton-board', 'Measured, not demoed', 'Read the leaderboard.', 'Measurable systems behavior rather than demo-only prompting wins.');
    const findPython = egg('triton-python', 'Kernels in Python', 'Ask Kernie what TritonGym is.', 'Triton kernels are written in Python; TritonGym benchmarks agents that write them.');
    const findAgent = egg('triton-agent', 'Compile, correct, fast', 'Watch Kernie write a softmax kernel all the way through.', 'An agentic workflow, every step measured.');
    const findTools = egg('triton-tools', 'Tool-augmented', 'Bring Kernie its four tools.', 'Tool-augmented LLM workflows: what TritonGym benchmarks.');
    const findBatch = egg('triton-batch', 'Just double the batch size', 'Pull the batch-size levers three times.', 'The universal fix. Until it is not.');
    const findOOM = egg('triton-oom', 'CUDA out of memory', 'Push the CUDA OOM Golem to 100% VRAM.', 'Tried to allocate 2.00 GiB. Every GPU person has seen this line.');
    const findWarp = egg('triton-warp', 'Warp retired', 'Defeat all four threads of one warp.', 'They marched together; they exited together.');
    const findSync = egg('triton-sync', '__syncthreads()', 'Find the idle thread waiting at a barrier.', 'It was waiting for the others. They were never coming.');
    const findRelic = egg('triton-relic', 'Benchmark complete', 'Defeat the CUDA OOM Golem.', 'TritonGym Relic earned.');

    // ================================================================ per frame
    let wasAlive = boss.alive, barT = 0;
    ctx.debug = { get vram() { return vram; }, get stunT() { return stunT; } };
    onUpdate(ctx, (dt, t) => {
      lastT = t;
      glowMesh.userData.setHi(0.2 + 0.2 * Math.sin(t * 2.6));
      // memory streams from the HBM stacks to the SM blocks
      for (let i = 0; i < N_STREAM; i++) {
        const s = sS[i];
        s.s = (s.s + dt * 0.12) % 1;
        const x = 16 - s.s * 34, z = -13 + s.lane * 3.2, y = 9 + Math.sin(s.s * Math.PI) * 5;
        _m.makeTranslation(x + ctx.ox, y, z + ctx.oz);
        streams.setMatrixAt(i, _m);
      }
      streams.instanceMatrix.needsUpdate = true;
      // levers spring back
      for (let i = 0; i < 4; i++) {
        pulled[i] = Math.max(0, pulled[i] - dt);
        const [x, z] = LEVERS[i];
        q.setFromAxisAngle(ax, pulled[i] > 0 ? -0.9 : 0.35);
        _m.compose(pos.set(Math.round(x) + ctx.ox, 5.3, Math.round(z) + ctx.oz), q, sc);
        handles.setMatrixAt(i, _m);
      }
      handles.instanceMatrix.needsUpdate = true;
      // the golem: memory pressure from attacks and live activations; out of memory = frozen
      if (boss.alive && !wasAlive) { introShown = false; vram = 25; stunT = 0; lastPi = boss.pi; boss.mesh.rotation.z = 0; }
      wasAlive = boss.alive;
      if (boss.alive) {
        if (stunT > 0) {
          stunT -= dt;
          boss.mesh.rotation.z = 0.35 + Math.sin(t * 30) * 0.03;
          if (stunT <= 0) { stunT = 0; vram = 20; boss.mesh.rotation.z = 0; boss.pi = 0; lastPi = 0; toast('torch.cuda.empty_cache(). It is back up, at 20% VRAM, and learning nothing.', { icon: 'rotate-ccw' }); }
        } else {
          if (boss.pi !== lastPi) { lastPi = boss.pi; addVram(7); }
          const live = boss.minions.filter((m) => m.alive).length;
          if (live && boss.threat()) addVram(live * 2.5 * dt);
        }
        boss.name = stunT ? 'CUDA OOM Golem · OUT OF MEMORY' : `CUDA OOM Golem · VRAM ${Math.round(vram)}%`;
      }
      // the VRAM bar round the ring
      barT -= dt;
      if (barT <= 0) {
        barT = 0.1;
        const lit = boss.alive ? Math.round((vram / 100) * N_BAR) : 0;
        for (let i = 0; i < N_BAR; i++) {
          const f = i / N_BAR;
          bar.setColorAt(i, col.set(stunT ? (Math.floor(t * 8) % 2 ? '#ef4444' : '#7f1d1d') : i < lit ? (f < 0.5 ? GPU : f < 0.8 ? '#facc15' : '#ef4444') : '#1f2937'));
        }
        bar.instanceColor.needsUpdate = true;
      }
    });

    onEnter(ctx, () => {
      if (!st.visited) { st.visited = true; ctx.save(); setTimeout(() => say('bit', 'A GPU, but make it a gym. The threads are doing drills!'), 900); }
      if (!hasItem('relic-triton')) setTimeout(() => say('tg-coach', 'IN LOCKSTEP!'), 2600);
    });
    onLeave(ctx, () => { if (boss.alive) { boss.hp = boss.maxHp; vram = 25; stunT = 0; boss.mesh.rotation.z = 0; introShown = false; } });
  },
};
