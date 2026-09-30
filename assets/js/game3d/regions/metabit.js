// regions/metabit.js: the Metabit trading floor (quantitative developer intern, Sep – Nov 2024:
// faster data parsing, streaming reads for the internal AI platform).
//   - a trading floor of desks and glowing screens, data streams flowing into the AI Platform
//   - the Order Book Abyss: candlestick platforms that rise and fall with a live ticker (jump puzzle)
//     up to the Closing Bell, which summons the boss "Flash Crash" into the pit (→ badge-metabit)
//   - Malformed Rows (parse them), Buffered Blobs (stream them: they split into chunks), Latency
//     Spikes, Stale Quotes; Hedge the hedgehog quant; the AI Platform terminal; eggs
import * as THREE from 'three/webgpu';
import {
  terrain, props, platform, registerArt, registerEnemyKind, spawnEnemy, spawnBoss, spawnNpc,
  interactable, trigger, portal, quest, egg, say, banner, toast, sfx, onUpdate, onEnter, onLeave,
  cinematic, dialog, boxCells, shade, hash3, hasItem,
} from '../regions.js';
import { METABIT_ART } from './art-metabit.js';

const TEAL = '#00c6d7';
const ARENA = { x: -8, z: -13, r: 7 };
// the candle path across the abyss (x, z), lowest to highest
const CANDLES = [[14, 11], [17, 8], [20, 5], [20, 1], [20, -3], [17, -6], [14, -9], [17, -12]];
const PLATEAU_Y = 8;

const inIsland = (x, z) => {
  const ax = Math.abs(x), az = Math.abs(z);
  if (ax > 23 || az > 23) return false;
  const cx = Math.max(0, ax - 17), cz = Math.max(0, az - 17);
  return cx * cx + cz * cz <= 40;
};
const inAbyss = (x, z) => x >= 12 && z >= -15 && z <= 15;
const inPlateau = (x, z) => x >= 12 && z < -15;
const inArena = (x, z) => Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r;
const onLane = (x, z) => (z === -1 && x >= -20 && x <= 11) || (x === -20 && z >= -1 && z <= 14) || (z === 13 && x >= -14 && x <= 11);

export default {
  id: 'metabit',
  name: 'Metabit trading floor',
  subtitle: 'Quant developer intern · Sep – Nov 2024',
  size: 52,
  spawn: [0, 18],
  sky: { tint: '#99f6e4', ground: '#03161c', fog: '#04121a', density: 0.0095, sun: 1.7 },
  zones: {
    lobby: { x: 0, z: 19, r: 6, label: 'Lobby' },
    floor: { x: -6, z: 5, r: 11, label: 'The trading floor' },
    abyss: { x: 18, z: 0, r: 9, label: 'Order Book Abyss' },
    bell: { x: 18, z: -20, r: 6, label: 'The Closing Bell' },
    pit: { x: ARENA.x, z: ARENA.z, r: ARENA.r, label: 'The Pit' },
    platform: { x: -19, z: 16, r: 5, label: 'Internal AI Platform' },
  },

  build(ctx) {
    for (const [name, art] of Object.entries(METABIT_ART)) registerArt(name, art, name === 'mb-moth' ? { G: 1.2 } : name === 'mb-chunk' ? { C: 1.2 } : null);
    const st = ctx.state;

    // ================================================================ terrain (one draw call)
    terrain(ctx, {
      size: 52,
      height: (x, z) => {
        if (!inIsland(x, z)) return null;
        if (inPlateau(x, z)) return PLATEAU_Y;
        if (inAbyss(x, z)) return null;
        if (inArena(x, z)) return 1;
        return 2;
      },
      type: (x, z) => {
        if (inPlateau(x, z)) return 'marble';
        if (inArena(x, z)) return (Math.round(x) % 3 === 0 || Math.round(z) % 3 === 0) ? 'gridline' : 'pit';
        if (onLane(x, z)) return 'lane';
        if (z >= 15) return 'carpet';
        return (x + z) & 1 ? 'floorA' : 'floorB';
      },
      palette: {
        floorA: ['#1f2937', '#1e293b'], floorB: ['#111827', '#162032'],
        carpet: ['#134e4a', '#115e59', '#0f4c47'], lane: ['#0891b2', '#06b6d4'],
        pit: ['#1c1917', '#171412'], gridline: ['#14532d', '#7f1d1d'],
        marble: ['#e7e5e4', '#d6d3d1', '#f5f5f4'],
      },
    });

    // ================================================================ props
    const solid = [], deco = [], screens = [];
    // desks with monitors, two rows
    for (const dz of [3, 9]) {
      for (const [x0, x1] of [[-20, -16], [-13, -9], [-6, -2], [1, 5], [8, 10]]) {
        for (let x = x0; x <= x1; x++) {
          solid.push([x, 3, dz, '#374151'], [x, 3, dz + 1, '#4b5563']);
          if ((x - x0) % 2 === 0) {
            const c = hash3(x, 1, dz) < 0.5 ? '#22c55e' : hash3(x, 2, dz) < 0.5 ? '#ef4444' : TEAL;
            screens.push([x, 4, dz, c, 1.6], [x, 5, dz, shade(c, 0.25), 1.6]);
          }
        }
      }
    }
    // the ticker wall behind the pit: a dark board with a price chart that ends in a cliff
    for (let x = -20; x <= 4; x++) {
      for (let y = 2; y <= 9; y++) solid.push([x, y, -22, y === 9 ? '#0f172a' : '#111827']);
      const t = (x + 20) / 24;
      const py = x < 0 ? 4 + Math.round(3 * t + Math.sin(x * 0.9) * 1.2) : 8 - Math.round((x + 1) * 1.2);
      screens.push([x, Math.max(3, Math.min(8, py)), -21, x < 0 ? '#4ade80' : '#f87171', 2]);
    }
    // the AI Platform: a server cabinet with a glowing face
    for (const c of boxCells(-22, -18, 3, 7, 14, 18, '#1e293b', { hollow: true })) solid.push(c);
    for (let z = 15; z <= 17; z++) for (let y = 4; y <= 6; y++) screens.push([-17, y, z, (y + z) % 2 ? TEAL : '#67e8f9', 1.8]);
    for (let z = 14; z <= 18; z++) deco.push([-20, 8, z, TEAL, 1.2]);
    // your old desk in the lobby
    solid.push([6, 3, 18, '#78716c'], [7, 3, 18, '#78716c'], [8, 3, 18, '#78716c']);
    deco.push([7, 4, 18, TEAL, 1.2], [6, 4, 18, '#fafaf9']);
    // circuit breaker box at the abyss edge
    solid.push([10, 3, 15, '#facc15'], [10, 4, 15, '#1f2937']);
    deco.push([10, 5, 15, '#ef4444', 1.5]);
    // the Closing Bell on the plateau: two posts, a beam, a gold bell
    for (let y = PLATEAU_Y + 1; y <= PLATEAU_Y + 5; y++) { solid.push([17, y, -21, '#78350f'], [21, y, -21, '#78350f']); }
    for (let x = 17; x <= 21; x++) deco.push([x, PLATEAU_Y + 6, -21, '#92400e']);
    const bellCells = [];
    for (let x = 18; x <= 20; x++) for (let y = PLATEAU_Y + 3; y <= PLATEAU_Y + 5; y++) bellCells.push([x, y, -21, y === PLATEAU_Y + 3 ? '#b45309' : '#facc15', 0.8]);
    bellCells.push([19, PLATEAU_Y + 2, -21, '#fde68a', 1]);
    // lobby pillars in Metabit teal and a welcome arch
    for (const x of [-4, 4]) for (let y = 3; y <= 8; y++) solid.push([x, y, 21, y === 8 ? TEAL : '#0f766e', y === 8 ? 1 : 0]);
    for (let x = -4; x <= 4; x++) deco.push([x, 9, 21, TEAL, 1.4]);
    props(ctx, solid, { block: true });
    props(ctx, deco);
    const screenMesh = props(ctx, screens, { shadow: false });
    const bellMesh = props(ctx, bellCells, { shadow: false });

    // ================================================================ the candle puzzle
    let mt = 0;              // market time (stops while trading is halted)
    let haltUntil = 0;       // wall-clock seconds
    let lastT = 0;
    const tops = CANDLES.map(() => 0);
    const candleTop = (i, t) => 3.7 + i * 0.66 + 1.8 * Math.sin(0.9 * t - i * 0.7) + 0.35 * Math.sin(0.37 * t);
    const candles = CANDLES.map(([x, z], i) => platform(ctx, {
      x, z, w: 2, d: 2, thick: 3, y: candleTop(i, 0), color: '#ffffff',
      move: () => tops[i],
    }));
    for (const c of candles) c.mesh.material.color.set('#4ade80');
    const wickMat = new THREE.MeshBasicNodeMaterial({ color: '#9ca3af' });
    const wicks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 2, 0.25), wickMat, CANDLES.length);
    ctx.group.add(wicks);
    const _m = new THREE.Matrix4();
    const rising = CANDLES.map(() => true);
    let tickerVal = 100;

    // ================================================================ ambient: data streams into the AI Platform
    const LANES = [
      [[11, -1], [-20, -1], [-20, 13], [-17, 13]],
      [[11, 13], [-14, 13], [-17, 13]],
    ];
    const lens = LANES.map((pts) => pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0));
    const N_PACK = 26;
    const packets = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshBasicNodeMaterial({ color: '#67e8f9' }), N_PACK);
    ctx.group.add(packets);
    const packState = Array.from({ length: N_PACK }, (_, i) => ({ lane: i % 2, s: (i / N_PACK) * 40 }));
    let streamBoost = 0;
    const along = (pts, s, out) => {
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
        const l = Math.hypot(bx - ax, bz - az);
        if (s <= l) { out[0] = ax + (bx - ax) * (s / l); out[1] = az + (bz - az) * (s / l); return; }
        s -= l;
      }
      out[0] = pts[pts.length - 1][0]; out[1] = pts[pts.length - 1][1];
    };
    const pos2 = [0, 0];

    // ================================================================ enemies
    const kinds = {
      'metabit-row': { name: 'Malformed Row', sprite: 'mb-row', hp: 26, speed: 3.2, dmg: 6, type: 'Normal', xp: 14, gold: 16, behaviour: 'chase', scale: 0.18, color: '#f1f5f9',
        onDeath: () => {
          st.rows = (st.rows || 0) + 1; ctx.save();
          const n = st.rows;
          if (n <= 5) toast(n < 5 ? `Row parsed (${n}/5). No commas were harmed.` : 'Row parsed (5/5). The feed is clean.', { icon: 'check' });
          if (n >= 5) findParse();
        } },
      'metabit-spike': { name: 'Latency Spike', sprite: 'mb-spike', hp: 34, speed: 3.4, dmg: 10, type: 'Electric', xp: 20, gold: 22, behaviour: 'charge', rate: 2600, scale: 0.2, color: '#ef4444' },
      'metabit-blob': { name: 'Buffered Blob', sprite: 'mb-blob', hp: 70, speed: 1.6, dmg: 9, type: 'Psychic', xp: 30, gold: 30, behaviour: 'chase', scale: 0.26, color: '#a78bfa', respawn: 25000,
        onDeath: (foe) => {
          const lx = foe.x - ctx.ox, lz = foe.z - ctx.oz;
          for (let i = 0; i < 3; i++) spawnEnemy(ctx, { kind: 'metabit-chunk', x: lx + Math.cos(i * 2.1) * 1.2, z: lz + Math.sin(i * 2.1) * 1.2, transient: true, respawn: false });
          if (!st.streamed) { st.streamed = true; ctx.save(); say('bit', 'It split into chunks! Streaming beats slurping.'); }
        } },
      'metabit-chunk': { name: 'Stream Chunk', sprite: 'mb-chunk', hp: 10, speed: 5, dmg: 3, type: 'Water', xp: 5, gold: 6, behaviour: 'swarm', scale: 0.16, color: '#22d3ee' },
      'metabit-quote': { name: 'Stale Quote', sprite: 'mb-quote', hp: 28, speed: 2.6, dmg: 7, type: 'Ghost', xp: 18, gold: 20, behaviour: 'ranged', rate: 2600, proj: 'pulse', projSpeed: 7, flying: true, scale: 0.2, color: '#fde68a' },
      'metabit-moth': { name: 'Ticker Moth', sprite: 'mb-moth', hp: 6, speed: 1.6, dmg: 0, type: 'Flying', xp: 2, gold: 2, behaviour: 'wander', flying: true, scale: 0.14, color: '#86efac' },
    };
    for (const [id, k] of Object.entries(kinds)) registerEnemyKind(id, k);
    for (const [x, z] of [[-12, 6], [-4, 12], [4, 6], [-16, 12], [0, 0], [7, -6]]) spawnEnemy(ctx, { kind: 'metabit-row', x, z });
    for (const [x, z] of [[-14, -3], [6, -3]]) spawnEnemy(ctx, { kind: 'metabit-spike', x, z });
    for (const [x, z] of [[-17, -6], [2, 13]]) spawnEnemy(ctx, { kind: 'metabit-blob', x, z });
    for (const [x, z] of [[-19, 6], [8, -12]]) spawnEnemy(ctx, { kind: 'metabit-quote', x, z });
    for (const [x, z] of [[-11, 4], [3, 10], [-17, 16]]) spawnEnemy(ctx, { kind: 'metabit-moth', x, z });

    // ================================================================ the boss: Flash Crash (summoned by the bell)
    const boss = spawnBoss(ctx, {
      id: 'metabit-flash-crash', name: 'Flash Crash', sprite: 'mb-crash', scale: 0.3, x: ARENA.x, z: ARENA.z,
      hp: 380, type: 'Electric', r: 1.8, color: '#f87171', contact: 11, speed: 1.6, aggro: 14,
      pattern: ['volley', 'charge', 'fan'],
      phases: [
        { below: 0.66, pattern: ['summon', 'rings', 'fan'], speed: 1.8 },
        { below: 0.33, pattern: ['nova', 'charge', 'volley', 'rings'], speed: 2.3, every: 2300 },
      ],
      minion: 'metabit-spike', reward: { gold: 320, xp: 110 }, drop: 'badge-metabit', respawn: false,
      onDefeat: (b, { first }) => {
        sleepBoss();
        findCrash();
        banner('Market recovered', first ? 'Metabit Badge earned. Buy the dip!' : 'It crashed again. You bought the dip again.', 'ribbon-medal');
        say('me', first ? 'Volatility: handled.' : 'Same crash, same dip.');
        bellMesh.userData.setHi(0);
      },
    });
    let phaseShown = 0;
    function sleepBoss() { boss.alive = false; boss.mesh.visible = false; boss.respawnAt = Infinity; boss.clearHazards(); }
    sleepBoss();
    const PHASE_LINES = [null, ['Liquidity evaporates', 'Phase 2 · it is summoning Latency Spikes'], ['Circuit breaker failed', 'Phase 3 · it was decorative. Dodge (K)!']];

    function ringBell() {
      sfx('ring');
      bellMesh.userData.setHi(1);
      if (boss.alive) { toast('The market is already crashing. Down in the pit!', { icon: 'triangle-alert', tone: 'bad' }); return; }
      boss.revive();
      phaseShown = 0;
      st.rang = true; ctx.save();
      cinematic(ctx, { x: ARENA.x, y: 3, z: ARENA.z, pitch: 0.5, dist: 22, seconds: 2.6 });
      banner('FLASH CRASH', 'Ding ding. Something very red just fell into the pit.', 'triangle-alert');
      setTimeout(() => say('me', 'Jump down and short it.'), 2800);
    }

    // ================================================================ NPC: Hedge
    spawnNpc(ctx, {
      id: 'metabit-hedge', name: 'Hedge · quant', sprite: 'mb-hedge', x: -5, z: 17, face: 0.4,
      news: () => !st.metHedge,
      talk: () => {
        st.metHedge = true; ctx.save();
        return {
          text: hasItem('badge-metabit')
            ? 'You rang the bell, you survived the crash, you parsed the rows. I would promote you, but you were an intern and it was three months. Take the badge and my respect.'
            : 'Welcome to the floor, intern. I\'m Hedge. Yes, a hedgehog at a quant shop. The name was not my idea. Yichen sat over there from September to November 2024. Made the data parsing faster and taught our AI platform to stream.',
          choices: [
            { label: 'What did the intern actually do?', icon: 'briefcase', next: {
              text: 'Two things, both real: sped up data parsing, and added streaming reads to the internal AI platform. Streaming means you start working on the first rows before the last ones have even been read. Revolutionary. Also: not loading everything into memory at once.',
              choices: [{ label: 'And the monsters?', next: { text: 'Malformed Rows (parse them: hit them), Buffered Blobs (whole datasets loaded at once; hit one and it streams out in chunks), Latency Spikes (they charge, you roll with K) and Stale Quotes, ghosts of old prices.', choices: [{ label: 'Got it' }] } }] } },
            { label: 'How do I reach the Closing Bell?', icon: 'circle-help', next: {
              text: 'Candles. The Order Book Abyss to the east: every candle rides the live ticker. Green means going up, red means going down. Jump when your next candle is level or lower. If it\'s too wild, pull the circuit breaker by the edge: trading halts for a bit. Falling costs nothing but pride.',
              choices: [{ label: 'And the bell?', next: { text: 'Ring it and the Flash Crash drops into the pit by the ticker wall. Big red candle. Charges, fans, summons spikes when it\'s down a third. The badge is yours if it closes lower than you.', choices: [{ label: 'Let\'s trade' }] } }] } },
            { label: 'Any work for me?', icon: 'scroll-text', next: {
              text: 'Clean the feed: parse five Malformed Rows, stream one Buffered Blob, and ask the AI Platform (the big cabinet, west) to use streaming reads. You know. The internship, but with a sword.',
              choices: [{ label: 'On it' }] } },
            { label: 'Bye' },
          ],
        };
      },
    });

    // ================================================================ interactables
    interactable(ctx, {
      x: -15.5, z: 16, r: 2.6, label: 'Internal AI Platform', prompt: 'E · load a dataset',
      onInteract: () => dialog({
        text: 'AI PLATFORM · data loader\n> dataset "market_ticks" is ready.\n> How should I read it?',
        choices: [
          { label: 'All of it. Into memory. Right now.', icon: 'triangle-alert', action: () => {
            sfx('error');
            spawnEnemy(ctx, { kind: 'metabit-blob', x: -14, z: 13, transient: true, respawn: false, name: 'Your Dataset (in RAM)' });
            toast('Out of memory. The dataset became sentient and hungry.', { icon: 'triangle-alert', tone: 'bad' });
            findSlurp();
          } },
          { label: 'Stream it, chunk by chunk', icon: 'check', action: () => {
            sfx('zap');
            st.platform = true; ctx.save();
            streamBoost = 6;
            toast('Streaming reads on. First rows arrive while the rest are still being read.', { icon: 'check', tone: 'good' });
            findStream();
          } },
          { label: 'Can you parse faster?', next: { text: '> parser: already optimised.\n> commit message: "faster data parsing".\n> author: the intern.', choices: [{ label: 'Nice' }] } },
          { label: 'Log out' },
        ],
      }, { name: 'AI Platform', sprite: 'robot' }),
    });
    interactable(ctx, {
      x: 7, z: 16.5, label: 'An intern\'s desk', prompt: 'E · look',
      onInteract: () => {
        dialog({
          text: 'A teal lanyard, a coffee ring and a desk calendar: September to November 2024, circled. A sticky note on the monitor says: "stream it, don\'t slurp it". Another says: "parse faster". A third just says "lunch?".',
          choices: [{ label: 'One quarter, well spent' }],
        }, { name: 'Quant developer intern', sprite: 'scholar' });
        findQuarter();
      },
    });
    const breaker = interactable(ctx, {
      x: 10, z: 13, r: 2.2, label: 'Circuit breaker', prompt: 'E · halt trading',
      onInteract: () => {
        haltUntil = lastT + 12;
        sfx('stamp');
        toast('Trading halted for 12 s. The candles hold still.', { icon: 'hourglass' });
        findHalt();
      },
    });
    const ticker = interactable(ctx, {
      x: 11, z: 10, r: 2, label: 'MKT ▲ 100.00', prompt: 'E · read the tape',
      onInteract: () => dialog({ text: 'The ticker drives every candle in the abyss. Green candles are rising, red ones are falling. Tip: wait on a candle until the next one comes level, then jump. The last candle overlooks the Closing Bell.', choices: [{ label: 'Buy low, jump high' }] }, { name: 'Ticker', sprite: 'crystal' }),
    });
    interactable(ctx, {
      x: 19, z: -19, r: 2.4, label: 'The Closing Bell', prompt: 'E · ring it', y: PLATEAU_Y + 0.5,
      onInteract: () => ringBell(),
    });
    interactable(ctx, {
      x: -8, z: -4, label: 'Sign: The Pit', prompt: 'E · read',
      onInteract: () => dialog({ text: 'THE PIT. Quiet until the Closing Bell rings (top of the candles, east). Then: not quiet.', choices: [{ label: 'OK' }] }, { name: 'Sign', sprite: 'book' }),
    });
    void breaker;

    // ================================================================ triggers, portal
    trigger(ctx, { x: 12, z: 6, w: 3, d: 18, once: true, onEnter: () => say('bit', 'Candles! Green goes up, red goes down. Wait for a level one.') });
    trigger(ctx, { x: 18, z: -19, r: 5, once: false, minY: PLATEAU_Y, onEnter: () => { if (!st.topSeen) { st.topSeen = true; ctx.save(); banner('The Closing Bell', 'You made it up the candles.', 'star-swirl'); } } });
    portal(ctx, { x: 0, z: 22, to: 'hub', color: TEAL });

    // ================================================================ quest + eggs
    quest({
      id: 'metabit-feed', title: 'Clean the feed',
      steps: [
        { id: 'hedge', text: 'Talk to Hedge in the lobby', done: () => !!st.metHedge },
        { id: 'rows', text: 'Parse 5 Malformed Rows', done: () => (st.rows || 0) >= 5 },
        { id: 'blob', text: 'Stream a Buffered Blob (defeat one)', done: () => !!st.streamed },
        { id: 'platform', text: 'Turn on streaming reads at the AI Platform', done: () => !!st.platform },
      ],
      reward: { gold: 160, xp: 70 },
    });
    const findStream = egg('metabit-stream', 'Streaming reads', 'Ask the AI Platform on the Metabit floor to read the right way.', 'Streaming reads on the internal AI platform: a real internship objective.');
    const findSlurp = egg('metabit-slurp', 'Out of memory', 'Ask the AI Platform to read the wrong way.', 'You loaded everything at once. This is why streaming reads exist.');
    const findParse = egg('metabit-parse', 'Faster parsing', 'Parse five Malformed Rows on the Metabit floor.', 'Faster data parsing: the other real objective. Now with a sword.');
    const findQuarter = egg('metabit-quarter', 'Sep – Nov 2024', 'Look at the intern\'s desk in the Metabit lobby.', 'Quant developer intern at Metabit, Sep – Nov 2024.');
    const findHalt = egg('metabit-halt', 'Circuit breaker', 'Halt trading at the edge of the Order Book Abyss.', 'Trading halted. The candles thank you.');
    const findHigh = egg('metabit-buy-high', 'Buy high', 'Stand on the tallest candle at its all-time high.', 'All-time high reached. Historically a great time to buy.');
    const findLow = egg('metabit-sell-low', 'Sell low', 'Fall into the Order Book Abyss.', 'Bought high, sold low. A classic strategy. Costs nothing here.');
    const findCrash = egg('metabit-crash', 'Buy the dip', 'Ring the Closing Bell and beat the Flash Crash.', 'Flash Crash defeated. Metabit Badge earned.');

    // ================================================================ per frame
    let tickT = 0, flickT = 0, fell = false;
    onUpdate(ctx, (dt, t) => {
      lastT = t;
      // market clock and candles
      const halted = t < haltUntil;
      if (!halted) mt += dt;
      tickT -= dt;
      for (let i = 0; i < CANDLES.length; i++) {
        const y = candleTop(i, mt);
        const up = y >= tops[i];
        tops[i] = y;
        if (up !== rising[i] && !halted) { rising[i] = up; candles[i].mesh.material.color.set(up ? '#4ade80' : '#f87171'); }
        _m.makeTranslation(CANDLES[i][0] + ctx.ox, y - 4, CANDLES[i][1] + ctx.oz);
        wicks.setMatrixAt(i, _m);
      }
      wicks.instanceMatrix.needsUpdate = true;
      if (tickT <= 0) {
        tickT = 0.5;
        const v = 100 + (candleTop(3, mt) - candleTop(3, mt - 0.5)) * 8 + Math.sin(mt * 0.37) * 4;
        const arrow = v >= tickerVal ? '▲' : '▼';
        tickerVal = v;
        ticker.setLabel(halted ? `MKT ■ HALTED ${Math.ceil(haltUntil - t)}s` : `MKT ${arrow} ${v.toFixed(2)}`);
      }
      // data streams
      const sp = streamBoost > 0 ? 9 : 3.5;
      if (streamBoost > 0) streamBoost -= dt;
      for (let i = 0; i < N_PACK; i++) {
        const p = packState[i];
        p.s = (p.s + sp * dt) % lens[p.lane];
        along(LANES[p.lane], p.s, pos2);
        _m.makeTranslation(pos2[0] + ctx.ox, 2.8 + Math.sin(p.s * 2) * 0.1, pos2[1] + ctx.oz);
        packets.setMatrixAt(i, _m);
      }
      packets.instanceMatrix.needsUpdate = true;
      // screens flicker; the bell glows while the boss is up
      flickT -= dt;
      if (flickT <= 0) { flickT = 0.12; screenMesh.userData.setHi(0.25 + 0.25 * Math.sin(t * 7) * Math.sin(t * 2.3)); }
      if (boss.alive) bellMesh.userData.setHi(0.5 + 0.5 * Math.sin(t * 6));
      // the boss's phases, announced
      if (boss.alive) {
        const f = boss.hp / boss.maxHp;
        const ph = f <= 0.33 ? 2 : f <= 0.66 ? 1 : 0;
        if (ph > phaseShown) { phaseShown = ph; banner(...PHASE_LINES[ph], 'triangle-alert'); sfx('encounter'); }
      }
      if (!ctx.playing) return;
      // eggs that watch the player
      const P = ctx.player;
      if (P.y < -3 && !fell) { fell = true; findLow(); }
      if (P.y > 0) fell = false;
      const top = tops[7];
      if (top > 9.35 && Math.abs(P.x - CANDLES[7][0]) < 1.2 && Math.abs(P.z - CANDLES[7][1]) < 1.2 && Math.abs(P.y - top) < 0.6) findHigh();
    });

    onEnter(ctx, () => {
      if (!st.visited) { st.visited = true; ctx.save(); setTimeout(() => say('bit', 'A trading floor! Everything is either green or red.'), 900); }
    });
    onLeave(ctx, () => { if (boss.alive) { sleepBoss(); boss.hp = boss.maxHp; } haltUntil = 0; });
  },
};
