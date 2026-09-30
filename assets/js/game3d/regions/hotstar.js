// regions/hotstar.js: the Hotstar stadium (Disney+ Hotstar, algorithm developer intern, Mar – Jun 2024:
// optimised the search page, fine-tuned the recommendation model for TPUs).
//   - a stadium-shaped streaming hub: terraced stands with a crowd that does the wave, a jumbotron
//   - the search bar on the pitch (a real search box over Yichen's CV, with autocomplete)
//   - The Recommendation Engine among three TPU racks: it's overfitting (takes little damage) until
//     you fine-tune it on the racks (→ badge-hotstar)
//   - Cold-start Users, Buffering Spinners, Clickbait Thumbnails, Spoilers; Cass the commentator
import * as THREE from 'three/webgpu';
import {
  terrain, props, registerArt, registerEnemyKind, spawnEnemy, spawnBoss, spawnNpc, interactable, trigger,
  portal, quest, egg, say, banner, toast, sfx, onUpdate, onEnter, dialog, hash3, hasItem,
} from '../regions.js';
import { on } from '../bus.js';
import { openModal } from '../modal.js';
import { h } from '../util.js';
import { HOTSTAR_ART } from './art-hotstar.js';

const PURPLE = '#b58cff';
const BOSS_HOME = { x: 0, z: -5 };
const RACKS = [[-7, -7], [0, -11], [7, -7]];
const SPOT = { x: 0, z: 10.5 };
const inTunnel = (x, z) => Math.abs(x) <= 2 && z > 12;
const inBar = (x, z) => z >= 6 && z <= 7 && Math.abs(x) <= 7;
function groundH(x, z) {
  const r = Math.hypot(x, z);
  if (r > 24) return null;
  if (inTunnel(x, z)) return 2;
  if (r < 13) return inBar(x, z) ? 3 : 2;
  if (r < 21) return 3 + Math.floor((r - 13) / 1.6);
  return 8;
}

// the search index: only facts from the CV
const INDEX = [
  { keys: ['tritongym', 'triton', 'gpu', 'kernel', 'benchmark', 'agent', 'llm', 'icml'], title: 'TritonGym', sub: 'A benchmark for agentic LLM workflows that write Triton GPU kernels. Yue Guan*, Yichen Lin* (equal contribution). Under review, ICML 2026.' },
  { keys: ['reh2o', '(re)', 're2h2o', 'driving', 'autonomous', 'reinforcement', 'rl', 'scenario', 'ieee', 'iv 2023'], title: '(Re)²H₂O', sub: 'Autonomous-driving scenario generation via reversely regularized hybrid offline-and-online RL. Haoyi Niu*, Kun Ren*, Yichen Lin et al. IEEE IV 2023.' },
  { keys: ['starry', 'starry-next', 'rust', 'network', 'tcp', 'os'], title: 'Starry-Next', sub: 'A networking stack for a monolithic-kernel OS, written in Rust. Graduation project.' },
  { keys: ['im', 'chat', 'websocket', 'django', 'typescript'], title: 'IM System', sub: 'Real-time chat: WebSocket + Django + TypeScript.' },
  { keys: ['oj', 'cst-oj', 'judge', 'data structure', 'sandbox'], title: 'CST-OJ', sub: 'An online judge for data-structure coursework, in Rust: sandboxed grading, a submission queue.' },
  { keys: ['ucsd', 'san diego', 'phd', 'ph.d', 'yufei', 'ding', 'advisor'], title: 'Ph.D. student, UC San Diego CSE (2025–)', sub: 'Advisor: Prof. Yufei Ding.' },
  { keys: ['tsinghua', '清华', 'beijing', 'undergrad', 'b.s', 'bachelor'], title: 'B.S., Tsinghua University (2021–2025)', sub: 'Computer Science & Technology.' },
  { keys: ['hotstar', 'disney', 'search', 'recommend', 'recsys', 'tpu', 'stadium'], title: 'Disney+ Hotstar · algorithm developer intern (Mar – Jun 2024)', sub: 'Optimised the search page; fine-tuned the recommendation model for TPUs. You are standing in it.' },
  { keys: ['picasso', 'cxl', 'rag', 'simulator', 'lab website'], title: 'Picasso Lab · UCSD CSE research intern (Mar 2024 – Feb 2025)', sub: 'A CXL system simulator for large-model communication; lab websites; a RAG pipeline for reading papers.' },
  { keys: ['metabit', 'quant', 'parsing', 'streaming'], title: 'Metabit · quantitative developer intern (Sep – Nov 2024)', sub: 'Faster data parsing; streaming reads for the internal AI platform.' },
  { keys: ['tencent', 'timi', 'monster', 'hunter', 'game', 'voice'], title: 'Tencent TiMi Studio · game developer intern (Jun – Jul 2024)', sub: 'Client work on the Monster Hunter mobile game, including voice-controlled teammates.' },
  { keys: ['bytedance', 'lark', 'askai', 'redis', 'rocketmq'], title: 'ByteDance Lark · backend developer intern (Jun – Nov 2023)', sub: 'The AskAI assistant for sales-data analysis, on Redis and RocketMQ.' },
  { keys: ['zhuo', 'cook', 'food', 'roommate', 'dinner', 'yao'], title: 'Zhuo Chen', sub: 'Roommate and labmate. Tsinghua Yao Class alumnus. Best cook in the building.' },
  { keys: ['python', 'c++', 'go', 'verilog', 'javascript', 'skills', 'vim', 'latex', 'linux', 'mongodb'], title: 'Skills', sub: 'Python, C++, Rust, Go, TypeScript, JavaScript, Verilog; Linux, Vim, LaTeX, WebSocket, Django, MongoDB.' },
  { keys: ['yichen', 'lin', 'yichen lin', 'me', 'myself'], title: 'Yichen Lin', sub: 'Found him. He is the one holding the sword, standing on a search bar.' },
];
const SUGGEST = ['tritongym', '(re)²h₂o', 'starry-next', 'tpu', 'recommendation', 'ucsd', 'tsinghua', 'zhuo', 'rust', 'websocket', 'redis', 'yichen lin'];
function search(q) {
  const low = q.toLowerCase().trim();
  if (!low) return [];
  return INDEX.filter((e) => e.keys.some((k) => (k.length <= 3 ? new RegExp(`(^|[^a-z])${k.replace(/[.()+]/g, '\\$&')}($|[^a-z])`).test(low) : low.includes(k) || k.startsWith(low))));
}

// 3×5 pixel font for the jumbotron
const FONT = {
  Y: ['1.1', '1.1', '.1.', '.1.', '.1.'], I: ['111', '.1.', '.1.', '.1.', '111'], C: ['111', '1..', '1..', '1..', '111'],
  H: ['1.1', '1.1', '111', '1.1', '1.1'], E: ['111', '1..', '111', '1..', '111'], N: ['1..1', '11.1', '1.11', '1..1', '1..1'],
};

export default {
  id: 'hotstar',
  name: 'Hotstar stadium',
  subtitle: 'Algorithm developer intern · Mar – Jun 2024',
  size: 50,
  spawn: [0, 17],
  sky: { tint: '#e9d5ff', ground: '#140a24', fog: '#120a1f', density: 0.0082, sun: 2.5 },
  zones: {
    tunnel: { x: 0, z: 18, r: 5, label: 'Players\' tunnel' },
    bar: { x: 0, z: 7, r: 5, label: 'The search bar' },
    racks: { x: 0, z: -7, r: 7, label: 'TPU racks' },
    stands: { x: 0, z: 0, r: 24, label: 'The stands' },
  },

  build(ctx) {
    for (const [name, art] of Object.entries(HOTSTAR_ART)) registerArt(name, art, name === 'hs-spinner' ? { W: 2, V: 1 } : name === 'hs-engine' ? { W: 0.8, V: 0.6, k: 0 } : null);
    const st = ctx.state;
    let lastT = 0;
    const gy = (x, z) => groundH(Math.round(x), Math.round(z)) ?? 2;

    // ================================================================ terrain
    terrain(ctx, {
      size: 50,
      height: groundH,
      type: (x, z) => {
        const r = Math.hypot(x, z);
        if (inTunnel(x, z)) return 'tunnel';
        if (Math.hypot(x - SPOT.x, z - SPOT.z) < 1.6) return 'spot';
        if (inBar(x, z)) return 'bar';
        if (r < 13) return Math.floor((x + 40) / 3) % 2 ? 'pitchA' : 'pitchB';
        if (r >= 21) return 'rim';
        return Math.floor((r - 13) / 1.6) % 2 ? 'seatA' : 'seatB';
      },
      palette: {
        pitchA: ['#3f9d4f', '#43a353'], pitchB: ['#358a44', '#39904a'], bar: ['#f8fafc', '#e2e8f0'],
        spot: ['#fde68a', '#fcd34d'], tunnel: ['#27272a', '#303036'], rim: ['#3b0764', '#4c1d95'],
        seatA: ['#6d28d9', '#7c3aed'], seatB: ['#1e1b4b', '#312e81'],
      },
    });

    // ================================================================ props
    const solid = [], deco = [], glowCells = [], text = [];
    // magnifier at the end of the search bar
    for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]]) glowCells.push([8 + dx, 4 + dy, 6, '#ffffff', 1.2]);
    solid.push([10, 3, 7, PURPLE], [11, 3, 8, PURPLE]);
    // the jumbotron on the north rim
    const JZ = -20;
    for (let y = 9; y <= 19; y++) for (const x of [-11, 11]) solid.push([x, y, JZ - 1, '#18181b']);
    for (let x = -13; x <= 13; x++) for (let y = 11; y <= 19; y++) {
      const edge = x === -13 || x === 13 || y === 11 || y === 19;
      (edge ? deco : glowCells).push([x, y, JZ, edge ? '#27272a' : hash3(x, y, 3) < 0.5 ? '#2e1065' : '#3b0764', edge ? 0 : 0.6]);
    }
    let cx = -12;
    for (const ch of 'YICHEN') {
      const g = FONT[ch];
      for (let row = 0; row < 5; row++) for (let col = 0; col < g[row].length; col++) if (g[row][col] === '1') text.push([cx + col, 17 - row, JZ + 1, '#f5f3ff', 1.4]);
      cx += g[0].length + 1;
    }
    // floodlights on four masts
    for (const a of [0.6, 2.54, 3.74, 5.68]) {
      const x = Math.round(Math.cos(a) * 22.5), z = Math.round(Math.sin(a) * 22.5);
      for (let y = 9; y <= 18; y++) solid.push([x, y, z, '#52525b']);
      for (let dx = -1; dx <= 1; dx++) glowCells.push([x + dx, 19, z, '#fffbeb', 3]);
    }
    // TPU racks: dark cabinets; their lights are separate meshes so each can light up when tuned
    const rackLights = [];
    for (const [rx, rz] of RACKS) {
      const lights = [];
      for (let dx = 0; dx <= 1; dx++) for (let dz = 0; dz <= 1; dz++) for (let y = 3; y <= 8; y++) {
        if (y % 2 === 0) lights.push([rx + dx, y, rz + dz, '#a78bfa', 0.35]);
        else solid.push([rx + dx, y, rz + dz, '#1f2937']);
      }
      rackLights.push(lights);
    }
    props(ctx, solid, { block: true });
    for (const [rx, rz] of RACKS) for (let dx = 0; dx <= 1; dx++) for (let dz = 0; dz <= 1; dz++) ctx.world.block(rx + dx + ctx.ox, rz + dz + ctx.oz);
    props(ctx, deco);
    const glowMesh = props(ctx, glowCells, { shadow: false });
    const textMesh = props(ctx, text, { shadow: false });
    const rackMeshes = rackLights.map((c) => props(ctx, c, { shadow: false }));

    // ================================================================ the crowd (one instanced mesh, does the wave)
    const fans = [];
    const seen = new Set();
    const CASS = { x: 5, z: 15.5 };
    for (let ring = 0; ring < 5; ring++) {
      const r = 13.8 + ring * 1.6;
      const n = Math.floor((Math.PI * 2 * r) / 1.7);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * 0.2;
        const deg = ((a * 180) / Math.PI) % 30;
        if (deg < 5 || deg > 26) continue;                             // aisles every 30 degrees
        const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
        if (Math.abs(x) < 4 && z > 0) continue;                        // the tunnel
        if (Math.hypot(x - CASS.x, z - CASS.z) < 2.5) continue;
        const key = `${x},${z}`;
        if (seen.has(key)) continue;
        seen.add(key);
        fans.push({ x, z, y: gy(x, z) + 0.5, a: Math.atan2(z, x), ph: hash3(x, 7, z) * 6.28 });
        ctx.world.block(x + ctx.ox, z + ctx.oz);
      }
    }
    const crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardNodeMaterial({ roughness: 0.9 }), fans.length * 2);
    const SHIRTS = ['#b58cff', '#f5f3ff', '#60a5fa', '#facc15', '#f472b6', '#34d399', '#1e3a8a'];
    const SKIN = ['#f3cfa4', '#d8a47f', '#a97454', '#f1d3b3'];
    const col = new THREE.Color();
    fans.forEach((f, i) => {
      crowd.setColorAt(i * 2, col.set(SHIRTS[Math.floor(hash3(f.x, 1, f.z) * SHIRTS.length)]));
      crowd.setColorAt(i * 2 + 1, col.set(SKIN[Math.floor(hash3(f.x, 2, f.z) * SKIN.length)]));
    });
    crowd.castShadow = false; crowd.receiveShadow = false;
    ctx.group.add(crowd);
    const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
    let waveAt = -99;
    const doWave = (t) => { if (t - waveAt > 3) { waveAt = t; sfx('levelup'); } };
    function drawCrowd(t) {
      const wa = (t - waveAt) * 2.6;
      for (let i = 0; i < fans.length; i++) {
        const f = fans[i];
        let lift = Math.max(0, Math.sin(t * 2 + f.ph)) * 0.08;
        if (wa < 7) { let d = (f.a + Math.PI / 2) - wa; d = Math.atan2(Math.sin(d), Math.cos(d)); lift += Math.max(0, Math.cos(d)) ** 14 * 1.3; }
        const x = f.x + ctx.ox, z = f.z + ctx.oz;
        _m.compose(_p.set(x, f.y + 0.55 + lift, z), _q, _s.set(0.78, 1.1, 0.78)); crowd.setMatrixAt(i * 2, _m);
        _m.compose(_p.set(x, f.y + 1.4 + lift, z), _q, _s.set(0.55, 0.55, 0.55)); crowd.setMatrixAt(i * 2 + 1, _m);
      }
      crowd.instanceMatrix.needsUpdate = true;
    }
    drawCrowd(0);

    // ================================================================ enemies
    const kinds = {
      'hotstar-cold': { name: 'Cold-start User', sprite: 'hs-cold', hp: 26, speed: 2.4, dmg: 6, type: 'Normal', xp: 14, gold: 15, behaviour: 'chase', scale: 0.18, color: '#e5e7eb',
        onDeath: () => { st.onboarded = (st.onboarded || 0) + 1; ctx.save(); if (st.onboarded <= 4) toast(`User onboarded (${st.onboarded}/4). They now have one watch-history item: you.`, { icon: 'check' }); } },
      'hotstar-spinner': { name: 'Buffering Spinner', sprite: 'hs-spinner', hp: 18, speed: 4.4, dmg: 5, type: 'Electric', xp: 12, gold: 12, behaviour: 'swarm', flying: true, scale: 0.2, color: '#c4b5fd' },
      'hotstar-bait': { name: 'Clickbait Thumbnail', sprite: 'hs-bait', hp: 28, speed: 2.6, dmg: 7, type: 'Psychic', xp: 18, gold: 18, behaviour: 'ranged', rate: 2400, proj: 'psy', projSpeed: 7, scale: 0.2, color: '#fde047' },
      'hotstar-spoiler': { name: 'Spoiler', sprite: 'hs-spoiler', hp: 38, speed: 3.4, dmg: 10, type: 'Dark', xp: 22, gold: 20, behaviour: 'charge', rate: 2700, scale: 0.2, color: '#ef4444' },
      'hotstar-drone': { name: 'Broadcast Drone', sprite: 'hs-drone', hp: 8, speed: 2, dmg: 0, type: 'Flying', xp: 2, gold: 2, behaviour: 'wander', flying: true, scale: 0.16, color: '#94a3b8' },
    };
    for (const [id, k] of Object.entries(kinds)) registerEnemyKind(id, k);
    const put = (kind, list) => { for (const [x, z] of list) spawnEnemy(ctx, { kind, x, z }); };
    put('hotstar-cold', [[-8, 2], [8, 2], [-5, -1], [5, 1]]);
    put('hotstar-spinner', [[-10, -3], [10, -3]]);
    put('hotstar-bait', [[-11, 5], [11, 5]]);
    put('hotstar-spoiler', [[-6, 9], [6, 4]]);
    put('hotstar-drone', [[-4, 4], [9, -9]]);

    // ================================================================ boss: The Recommendation Engine
    const tuned = [false, false, false];
    const tunedN = () => tuned.filter(Boolean).length;
    const MULT = [0.2, 0.45, 0.7, 1];
    const boss = spawnBoss(ctx, {
      id: 'hotstar-engine', name: 'The Recommendation Engine', sprite: 'hs-engine', scale: 0.3, x: BOSS_HOME.x, z: BOSS_HOME.z,
      hp: 400, type: 'Psychic', r: 1.9, color: '#c084fc', contact: 11, speed: 1.2, aggro: 9, move: 'hover',
      pattern: ['fan', 'summon', 'fan'],
      phases: [
        { below: 0.6, pattern: ['volley', 'rings', 'fan'] },
        { below: 0.3, pattern: ['nova', 'summon', 'volley'], every: 2400 },
      ],
      minion: 'hotstar-cold', reward: { gold: 330, xp: 120 }, drop: 'badge-hotstar', respawn: 40000,
      onDefeat: (b, { first }) => {
        findEngine();
        banner('Because you watched: Yichen', first ? 'Hotstar Badge earned. Recommended for you: more badges.' : 'Recommended again. The engine respawns.', 'ribbon-medal');
        doWave(lastT);
        say('hs-cass', 'THE ENGINE IS DOWN! What a performance!');
      },
    });
    const origHit = boss.hit.bind(boss);
    let shieldToast = 0;
    boss.hit = (dmg, info) => {
      const n = tunedN();
      if (n < 3 && lastT - shieldToast > 4) { shieldToast = lastT; toast(`Overfitting: ${Math.round(MULT[n] * 100)}% damage. Fine-tune it on the TPU racks (E).`, { icon: 'cpu', tone: 'bad' }); }
      return origHit(Math.max(1, Math.round(dmg * MULT[n])), info);
    };
    const shield = new THREE.Mesh(new THREE.SphereGeometry(2.6, 18, 12), new THREE.MeshBasicNodeMaterial({ color: '#c084fc', transparent: true, opacity: 0.22, depthWrite: false }));
    ctx.group.add(shield);
    let phaseShown = 0, wasAlive = boss.alive, introShown = false;
    const PHASES = [null, ['"Because you watched…"', 'Phase 2 · aimed recommendations and hot zones'], ['Autoplay in 3… 2… 1…', 'Phase 3 · everything, all at once']];
    function resetRacks() { tuned.fill(false); rackMeshes.forEach((m) => m.userData.setHi(0)); }
    RACKS.forEach(([rx, rz], i) => {
      const cx0 = rx + 0.5, cz0 = rz + 0.5;
      const dx = BOSS_HOME.x - cx0, dz = BOSS_HOME.z + 3 - cz0, l = Math.hypot(dx, dz);
      interactable(ctx, {
        x: cx0 + (dx / l) * 2, z: cz0 + (dz / l) * 2, r: 2.2, label: `TPU rack ${i + 1}`, prompt: 'E · fine-tune',
        onInteract: () => {
          if (tuned[i]) { toast('Already fine-tuned. Try the other racks.', { icon: 'cpu' }); return; }
          tuned[i] = true;
          rackMeshes[i].userData.setHi(1);
          sfx('zap');
          const n = tunedN();
          toast(n < 3 ? `Rack ${i + 1} fine-tuned (${n}/3). The Engine generalises a little.` : 'All three racks fine-tuned. The Engine stops overfitting: full damage!', { icon: 'cpu', tone: 'good' });
          if (n === 3) { findTpu(); say('hs-cass', 'Fine-tuned for TPUs! Now it\'s a fair fight!'); }
        },
      });
    });

    // ================================================================ NPCs
    spawnNpc(ctx, {
      id: 'hs-cass', name: 'Cass · commentator', sprite: 'hs-cass', x: CASS.x, z: CASS.z, face: 3.6,
      news: () => !st.metCass,
      talk: () => {
        st.metCass = true; ctx.save();
        return {
          text: 'Cass here, live from the stands! Tonight\'s fixture: one Ph.D. student versus a Recommendation Engine. Some background for viewers at home: Yichen was an algorithm developer intern at Disney+ Hotstar, March to June 2024.',
          choices: [
            { label: 'What was the work?', icon: 'briefcase', action: () => { findSeason(); dialog({ text: 'Two things, straight from the CV: he optimised the search page, and he fine-tuned the recommendation model for TPUs. Out here, that means a search bar you can stand on, and three TPU racks the Engine really does not want you to touch.', choices: [{ label: 'Back to the game' }] }, { name: 'Cass · commentator', sprite: 'hs-cass' }); } },
            { label: 'How do I beat the Engine?', icon: 'crossed-swords', next: { text: 'It\'s overfitting! It only knows one trick, so your hits barely register. Run to the three TPU racks around it and press E on each: every rack you fine-tune makes it take more damage. All three and it\'s a fair fight.', choices: [{ label: 'Understood' }] } },
            { label: 'What\'s the big screen for?', icon: 'eye', next: { text: 'Stand on the golden spot by the tunnel and find out. The crowd loves a close-up.', choices: [{ label: 'Ooh' }] } },
            { label: 'Bye' },
          ],
        };
      },
    });
    spawnNpc(ctx, {
      id: 'hs-newbie', name: 'New User', sprite: 'hs-newbie', x: -4, z: 9.5, face: 2.6,
      news: () => !st.recommended,
      talk: () => {
        st.metNewbie = true; ctx.save();
        if (st.recommended) return { text: 'I watched what you recommended. Then the next one. Then autoplay did the rest. I haven\'t slept. Thank you!', choices: [{ label: 'Any time' }] };
        return {
          text: 'Hi! I just signed up. I have no watch history, no likes, nothing. The algorithm has no idea who I am. I\'m a cold start. What should I watch?',
          choices: [
            { label: '"A documentary about GPU kernels"', action: () => recommend('A documentary about GPU kernels? Bold. Adding it to my list. My list now has one thing!') },
            { label: '"Whatever is trending"', action: () => recommend('Trending! Popularity is a solid baseline for cold starts. I feel seen. Statistically.') },
            { label: '"Tell me three things you like"', action: () => recommend('You asked me! Onboarding questions! Cats, rain, and very long matches. Wow, I have a profile now.') },
            { label: 'Later' },
          ],
        };
      },
    });
    function recommend(line) {
      st.recommended = true; ctx.save();
      say('hs-newbie', line, 6000);
      findCold();
    }

    // ================================================================ the search bar
    function openSearch() {
      const input = h('input', { class: 'typing__input', type: 'search', maxlength: '60', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Search', placeholder: 'Search Yichen…' });
      const sugg = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '8px 0' } });
      const out = h('div', { 'aria-live': 'polite', style: { display: 'grid', gap: '8px', marginTop: '6px', maxHeight: '42vh', overflowY: 'auto' } });
      const chip = (s) => h('button', { type: 'button', class: 'btn', style: { padding: '3px 9px', fontSize: '12.5px' }, onclick: () => { input.value = s; run(); } }, s);
      const showSugg = () => {
        const v = input.value.toLowerCase().trim();
        const list = (v ? SUGGEST.filter((s) => s.startsWith(v) || s.includes(v)) : SUGGEST.slice(0, 6)).slice(0, 6);
        sugg.replaceChildren(...list.map(chip));
      };
      const run = () => {
        const q = input.value.trim();
        if (!q) return;
        sfx('pop');
        st.searched = true; ctx.save();
        findSearch();
        const res = search(q);
        if (!res.length) {
          findDidYouMean();
          out.replaceChildren(h('p', null, `No results for “${q}”. `, h('b', null, 'Did you mean: Yichen Lin?')), h('div', { style: { display: 'flex' } }, chip('yichen lin')));
          return;
        }
        out.replaceChildren(h('p', { class: 'game__hint' }, `${res.length} result${res.length > 1 ? 's' : ''}, ranked by the (fine-tuned) model:`),
          ...res.map((r) => h('div', { style: { padding: '8px 10px', borderRadius: '8px', background: 'rgba(181,140,255,.12)', border: '1px solid rgba(181,140,255,.35)' } }, h('b', null, r.title), h('div', { style: { fontSize: '13.5px', opacity: '.85', marginTop: '3px' } }, r.sub))));
      };
      input.addEventListener('input', showSugg);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
      openModal({
        id: 'hotstar-search', title: 'Search', className: 'game-panel',
        body: (b) => b.append(h('p', { class: 'game__hint' }, 'The search page, optimised. Search anything about Yichen.'), input, sugg, out),
      });
      showSugg();
    }
    interactable(ctx, { x: 0, z: 8.4, r: 2.4, label: 'The search bar', prompt: 'E · search', onInteract: () => openSearch() });
    interactable(ctx, { x: -6, z: 8.4, r: 2, label: 'Search bar (left end)', prompt: 'E · search', onInteract: () => openSearch() });

    // ================================================================ triggers, portal
    trigger(ctx, { x: SPOT.x, z: SPOT.z, r: 1.4, onEnter: () => {
      textMesh.userData.setHi(1);
      glowMesh.userData.setHi(0.6);
      doWave(lastT);
      banner('You\'re on the big screen!', 'The crowd goes wild.', 'star-swirl');
      say('hs-cass', 'Look who\'s on the jumbotron!');
      findScreen();
    }, onLeave: () => { textMesh.userData.setHi(0); glowMesh.userData.setHi(0); } });
    trigger(ctx, { x: BOSS_HOME.x, z: BOSS_HOME.z, r: 9, onEnter: () => {
      if (!boss.alive || introShown) return;
      introShown = true;
      banner('THE RECOMMENDATION ENGINE', tunedN() < 3 ? 'It\'s overfitting. Fine-tune it on the 3 TPU racks (E)!' : 'Fine-tuned and ready.', 'cpu');
      sfx('encounter');
    } });
    portal(ctx, { x: 0, z: 21.5, to: 'hub', color: PURPLE });

    // ================================================================ quest + eggs
    quest({
      id: 'hotstar-personalise', title: 'Personalise the stadium',
      steps: [
        { id: 'newbie', text: 'Recommend something to the New User', done: () => !!st.recommended },
        { id: 'search', text: 'Search for something at the search bar', done: () => !!st.searched },
        { id: 'cold', text: 'Onboard 4 Cold-start Users (defeat them)', done: () => (st.onboarded || 0) >= 4 },
        { id: 'screen', text: 'Get on the big screen (the golden spot)', done: () => !!st.onScreen },
      ],
      reward: { gold: 170, xp: 70 },
    });
    const findSearch = egg('hotstar-search', 'Search page', 'Use the search bar in the Hotstar stadium.', 'Optimising the search page: a real Hotstar objective.');
    const findDidYouMean = egg('hotstar-didyoumean', 'Did you mean: Yichen Lin?', 'Search for something that isn\'t on the CV.', 'Every query is secretly about him.');
    const findTpu = egg('hotstar-tpu', 'Fine-tuned for TPUs', 'Fine-tune all three TPU racks.', 'Fine-tuning the recommendation model for TPUs: the other real objective.');
    const findCold = egg('hotstar-coldstart', 'Cold start, solved', 'Recommend something to the New User.', 'One user onboarded. Only a few hundred million to go.');
    const findSeason = egg('hotstar-season', 'Mar – Jun 2024', 'Ask Cass the commentator about the work.', 'Algorithm developer intern at Disney+ Hotstar, March – June 2024.');
    const findScreen = egg('hotstar-bigscreen', 'On the big screen', 'Stand on the golden spot in the stadium.', 'Y-I-C-H-E-N on the jumbotron.');
    const findWave = egg('hotstar-wave', 'Stadium wave', 'Defeat three monsters in quick succession in the stadium.', 'The crowd did the wave. For you.');
    const findBuffer = egg('hotstar-buffer', 'Buffering…', 'Stand perfectly still in the stadium for a while.', 'Buffering… 99%… 99%… 99%…');
    const findEngine = egg('hotstar-engine', 'Because you watched', 'Beat the Recommendation Engine.', 'Hotstar Badge earned.');

    // ================================================================ events: the crowd reacts
    const CHEERS = ['And a clean hit!', 'What a strike!', 'The crowd is on its feet!', 'That\'s going on the highlight reel!', 'Textbook combo!', 'Ooh, that one had topspin.'];
    let kills = [], cheerAt = -99, ci = 0;
    on('kill', ({ target }) => {
      if (!ctx.live || target?.region !== 'hotstar') return;
      kills = kills.filter((k) => lastT - k < 12);
      kills.push(lastT);
      if (kills.length >= 3) { doWave(lastT); findWave(); kills = []; }
      if (lastT - cheerAt > 7) { cheerAt = lastT; say('hs-cass', CHEERS[ci++ % CHEERS.length], 2600); }
    });

    // ================================================================ per frame
    let stillT = 0, lx = 0, lz = 0, buffered = false;
    onUpdate(ctx, (dt, t) => {
      lastT = t;
      drawCrowd(t);
      // boss: shield, phases, revive
      if (boss.alive && !wasAlive) { resetRacks(); phaseShown = 0; introShown = false; }
      wasAlive = boss.alive;
      const n = tunedN();
      shield.visible = boss.alive && n < 3;
      if (shield.visible) {
        shield.position.set(boss.x, boss.y + 2.6, boss.z);
        shield.material.opacity = 0.12 + (3 - n) * 0.07 + Math.sin(t * 4) * 0.03;
        shield.scale.setScalar(1 + (3 - n) * 0.12);
      }
      if (boss.alive) {
        const f = boss.hp / boss.maxHp;
        const ph = f <= 0.3 ? 2 : f <= 0.6 ? 1 : 0;
        if (ph > phaseShown) { phaseShown = ph; banner(...PHASES[ph], 'cpu'); sfx('encounter'); }
      }
      if (!ctx.playing) return;
      // the big-screen state for the quest
      if (!st.onScreen && Math.hypot(ctx.player.x - SPOT.x, ctx.player.z - SPOT.z) < 1.4) { st.onScreen = true; ctx.save(); }
      // buffering: stand still for 10 s
      const px = ctx.player.x, pz = ctx.player.z;
      if (Math.hypot(px - lx, pz - lz) > 0.05) { stillT = 0; lx = px; lz = pz; if (buffered) buffered = false; }
      else stillT += dt;
      if (stillT > 10 && !buffered) { buffered = true; say('me', 'Buffering… 99%', 4000); findBuffer(); }
    });

    onEnter(ctx, () => {
      if (!st.visited) { st.visited = true; ctx.save(); setTimeout(() => say('bit', 'A stadium! And a search bar the size of a pitch.'), 900); }
      if (!hasItem('badge-hotstar')) setTimeout(() => say('hs-cass', 'Welcome to the stadium, folks!'), 2200);
    });
  },
};
