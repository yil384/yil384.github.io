// regions/lark.js: the Lark tower (ByteDance Lark, backend developer intern, Jun – Nov 2023: the AskAI
// assistant for sales-data analysis, on Redis and RocketMQ).
//   - a stepped office tower of messages: plaza (lobby, AskAI, the mailroom) → Redis floor (cache lockers,
//     Cache Misses, a Hot Key) → RocketMQ floor (a message conveyor, Message Floods, Dead Letters) →
//     the rooftop, by stairs or the express elevator
//   - boss: Queue Backlog. Producers outpace you; start the three consumers on the roof to drain it,
//     and restart them when a rebalance knocks one out (→ badge-lark)
import * as THREE from 'three/webgpu';
import {
  terrain, props, platform, registerArt, registerEnemyKind, spawnEnemy, spawnBoss, spawnNpc, interactable,
  trigger, pickup, portal, quest, egg, say, banner, toast, sfx, onUpdate, onEnter, onLeave, dialog, hash3,
  hasItem,
} from '../regions.js';
import { LARK_ART } from './art-lark.js';

const GREEN = '#4ade80';
const TZ = -2;
const T1 = (x, z) => Math.abs(x) <= 15 && Math.abs(z - TZ) <= 13;
const T2 = (x, z) => Math.abs(x) <= 10 && Math.abs(z - TZ) <= 9;
const T3 = (x, z) => Math.abs(x) <= 6 && Math.abs(z - TZ) <= 5;
const SLOT = (x, z) => x >= 7 && x <= 8 && z >= 1;
const S3 = (x, z) => z >= -1 && z <= 1 && x >= -9 && x <= -7;
const S2 = (x, z) => z >= -4 && z <= -2 && x >= 11 && x <= 13;
const S1 = (x, z) => Math.abs(x) <= 2 && z >= 12 && z <= 13;
const ROOF = 13;
const BOSS_HOME = { x: 0, z: -2 };
const CONSUMERS = [[-5, -6], [5, -6], [-5, 2]];
const ELEV = { x: 7.5, z: 1.5 };
const inIsland = (x, z) => {
  const ax = Math.abs(x), az = Math.abs(z);
  if (ax > 24 || az > 24) return false;
  const cx = Math.max(0, ax - 18), cz = Math.max(0, az - 18);
  return cx * cx + cz * cz <= 40;
};
function groundH(x, z) {
  if (!inIsland(x, z)) return null;
  if (SLOT(x, z)) return 2;
  if (T3(x, z)) return ROOF;
  if (S3(x, z)) return 12 + (x + 7);
  if (T2(x, z)) return 9;
  if (S2(x, z)) return 8 - (x - 11);
  if (T1(x, z)) return 5;
  if (S1(x, z)) return 4 - (z - 12);
  return 2;
}
const isTier = (x, z) => !SLOT(x, z) && !S1(x, z) && !S2(x, z) && !S3(x, z) && T1(x, z);

export default {
  id: 'lark',
  name: 'Lark tower',
  subtitle: 'Backend developer intern · Jun – Nov 2023',
  size: 52,
  spawn: [0, 19],
  sky: { tint: '#bae6fd', ground: '#0b1a2a', fog: '#0a1624', density: 0.0078, sun: 2.3 },
  zones: {
    lobby: { x: 0, z: 18, r: 7, label: 'Lobby plaza' },
    mailroom: { x: -14, z: 19, r: 5, label: 'The mailroom' },
    redis: { x: -12, z: -2, r: 5, label: 'Floor 1 · Redis' },
    mq: { x: 0, z: -10, r: 4, label: 'Floor 2 · RocketMQ' },
    roof: { x: 0, z: -2, r: 6, label: 'Rooftop · the backlog' },
    elevator: { x: 7.5, z: 8, r: 3, label: 'Express elevator' },
  },

  build(ctx) {
    for (const [name, art] of Object.entries(LARK_ART)) registerArt(name, art, name === 'lk-askai' ? { C: 0.5, W: 1 } : name === 'lk-hotkey' ? { O: 0.8, Y: 1.5 } : null);
    const st = ctx.state;
    let lastT = 0;

    // ================================================================ terrain
    terrain(ctx, {
      size: 52,
      height: groundH,
      type: (x, z) => {
        if (SLOT(x, z)) return 'slot';
        if (T3(x, z)) return Math.hypot(x - BOSS_HOME.x, z - BOSS_HOME.z) < 2.2 && Math.hypot(x - BOSS_HOME.x, z - BOSS_HOME.z) > 1.2 ? 'helipad' : 'roof';
        if (S1(x, z) || S2(x, z) || S3(x, z)) return 'stair';
        if (T2(x, z)) return z === -10 && Math.abs(x) <= 8 ? 'belt' : 'mq';
        if (T1(x, z)) return 'redis';
        return (x + z) & 1 ? 'plazaA' : 'plazaB';
      },
      palette: {
        plazaA: ['#cbd5e1', '#c3ccd8'], plazaB: ['#e2e8f0', '#d9e0ea'], slot: ['#475569', '#3f4c5e'],
        redis: ['#7f1d1d', '#8b2323', '#761b1b'], mq: ['#1e3a8a', '#223f94'], belt: ['#111827', '#1f2937'],
        roof: ['#334155', '#3b4a60'], helipad: ['#fde047', '#facc15'], stair: ['#94a3b8', '#a3b0c2'],
      },
    });

    // ================================================================ props
    const solid = [], deco = [], glow = [];
    // glass railings wherever a floor drops away (gaps at stairs and the elevator door)
    for (let x = -16; x <= 16; x++) for (let z = -16; z <= 12; z++) {
      if (!isTier(x, z)) continue;
      const hh = groundH(x, z);
      if (hh === ROOF && x === 6 && z >= 1 && z <= 3) continue;           // the elevator door
      let edge = false;
      for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) { const nh = groundH(nx, nz); if (nh == null || nh < hh - 1) edge = true; }
      if (edge) solid.push([x, hh + 1, z, hash3(x, hh, z) < 0.5 ? '#86efac' : '#bbf7d0', 0.35]);
    }
    // Redis lockers on floor 1
    for (let z = -12; z <= 8; z++) for (let y = 6; y <= 7; y++) solid.push([-14, y, z, z % 2 === 0 && y === 7 ? '#fecaca' : (z + y) % 2 ? '#dc2626' : '#b91c1c']);
    // RocketMQ: producer (west) and consumer (east) machines at the ends of the belt
    for (const [x, c] of [[-9, '#1d4ed8'], [9, '#15803d']]) for (let y = 10; y <= 11; y++) for (const z of [-10, -9]) solid.push([x, y, z, c]);
    glow.push([-9, 12, -10, '#93c5fd', 1.5], [9, 12, -10, '#86efac', 1.5]);
    // mailroom pigeonholes on the plaza
    for (let x = -17; x <= -11; x++) for (let y = 3; y <= 6; y++) solid.push([x, y, 22, (x + y) % 2 ? '#a16207' : '#fef3c7']);
    // intern desk in the lobby
    solid.push([-7, 3, 16, '#e5e7eb'], [-6, 3, 16, '#e5e7eb'], [-5, 3, 16, '#e5e7eb']);
    deco.push([-6, 4, 16, GREEN, 1], [-5, 4, 16, '#111827']);
    // a big lobby sign over the stairs and the tower's roof antenna
    for (let x = -3; x <= 3; x++) glow.push([x, 8, 11.6, x % 2 ? GREEN : '#bbf7d0', 1.1]);
    for (let y = ROOF + 1; y <= ROOF + 7; y++) deco.push([-6, y, -7, '#94a3b8']);
    glow.push([-6, ROOF + 8, -7, '#ef4444', 2.5]);
    // planters on the plaza
    for (const [x, z] of [[-20, 14], [-20, -2], [20, 14], [20, -2], [-12, -19], [12, -19], [0, -20], [14, 19]]) {
      for (let dx = 0; dx <= 1; dx++) { solid.push([x + dx, 3, z, '#78716c']); deco.push([x + dx, 4, z, hash3(x + dx, 4, z) < 0.5 ? '#22c55e' : '#16a34a']); }
      deco.push([x, 5, z, '#86efac'], [x + 1, 5, z, '#f472b6']);
    }
    // elevator frame
    for (let y = 3; y <= 4; y++) deco.push([6.6, y, 12, '#64748b'], [8.4, y, 12, '#64748b']);
    props(ctx, solid, { block: true });
    props(ctx, deco);
    const glowMesh = props(ctx, glow, { shadow: false });
    // consumer terminals on the roof (one mesh each so each lights up on its own)
    const consumerMeshes = CONSUMERS.map(([x, z]) => {
      const m = props(ctx, [[x, ROOF + 1, z, '#1f2937'], [x, ROOF + 2, z, GREEN, 0.4]], { block: true });
      return m;
    });

    // ================================================================ express elevator
    const CYCLE = 13;
    const elevY = (t) => {
      const c = t % CYCLE;
      const lo = 2.5, hi = ROOF + 0.5;
      if (c < 2.5) return lo;
      if (c < 6.5) { const k = (c - 2.5) / 4; return lo + (hi - lo) * (k * k * (3 - 2 * k)); }
      if (c < 9.5) return hi;
      const k = (c - 9.5) / 3.5; return hi - (hi - lo) * (k * k * (3 - 2 * k));
    };
    platform(ctx, { x: ELEV.x, z: ELEV.z, w: 2, d: 2, thick: 1, y: 2.5, color: '#bbf7d0', glow: 0.5, move: (t) => elevY(t) });

    // ================================================================ ambient: the RocketMQ conveyor
    const N_ENV = 12;
    const envMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 0.16, 0.44), new THREE.MeshStandardNodeMaterial({ roughness: 0.7 }), N_ENV);
    const colr = new THREE.Color();
    for (let i = 0; i < N_ENV; i++) envMesh.setColorAt(i, colr.set('#f8fafc'));
    ctx.group.add(envMesh);
    const envS = Array.from({ length: N_ENV }, (_, i) => (i / N_ENV) * 16);
    let published = -1;
    const _m = new THREE.Matrix4();

    // ================================================================ enemies
    const kinds = {
      'lark-miss': { name: 'Cache Miss', sprite: 'lk-miss', hp: 20, speed: 4.6, dmg: 5, type: 'Normal', xp: 12, gold: 12, behaviour: 'swarm', scale: 0.18, color: '#ef4444',
        onDeath: () => { if (lastT - (st._missT || 0) > 8) { st._missT = lastT; toast('Miss resolved. Fetched from the database. Slowly.', { icon: 'hourglass' }); } } },
      'lark-hotkey': { name: 'Hot Key', sprite: 'lk-hotkey', hp: 42, speed: 3.4, dmg: 11, type: 'Fire', xp: 24, gold: 22, behaviour: 'charge', rate: 2600, scale: 0.22, color: '#f97316' },
      'lark-flood': { name: 'Message Flood', sprite: 'lk-flood', hp: 14, speed: 5, dmg: 4, type: 'Water', xp: 8, gold: 8, behaviour: 'swarm', scale: 0.16, color: '#f8fafc' },
      'lark-dead': { name: 'Dead Letter', sprite: 'lk-dead', hp: 28, speed: 2.6, dmg: 7, type: 'Ghost', xp: 18, gold: 18, behaviour: 'ranged', rate: 2500, proj: 'pulse', flying: true, scale: 0.2, color: '#cbd5e1' },
      'lark-chart': { name: 'Stale Chart', sprite: 'lk-chart', hp: 30, dmg: 6, type: 'Normal', xp: 16, gold: 16, behaviour: 'turret', rate: 2600, proj: 'spark', aggro: 9, scale: 0.22, color: '#60a5fa' },
      'lark-bird': { name: 'Lark', sprite: 'lk-bird', hp: 6, speed: 1.6, dmg: 0, type: 'Flying', xp: 1, gold: 1, behaviour: 'wander', flying: true, scale: 0.14, color: GREEN },
    };
    for (const [id, k] of Object.entries(kinds)) registerEnemyKind(id, k);
    const put = (kind, list) => { for (const [x, z] of list) spawnEnemy(ctx, { kind, x, z }); };
    put('lark-chart', [[-19, 4], [19, 4]]);
    put('lark-bird', [[-8, 20], [12, 18], [18, -18]]);
    put('lark-miss', [[-12, -5], [12, 9], [-6, -13]]);
    put('lark-hotkey', [[6, -13]]);
    put('lark-flood', [[-5, -9], [8, 5], [-8, 5]]);
    put('lark-dead', [[8, -9], [-8, -4]]);

    // ================================================================ boss: Queue Backlog
    const active = [false, false, false];
    const boss = spawnBoss(ctx, {
      id: 'lark-backlog', name: 'Queue Backlog', sprite: 'lk-backlog', scale: 0.3, x: BOSS_HOME.x, z: BOSS_HOME.z,
      hp: 520, type: 'Water', r: 1.9, color: '#93c5fd', contact: 11, speed: 1.0, aggro: 7,
      pattern: ['summon', 'fan'],
      phases: [
        { below: 0.6, pattern: ['volley', 'rings', 'summon'] },
        { below: 0.3, pattern: ['nova', 'charge', 'fan'], every: 2300 },
      ],
      minion: 'lark-flood', reward: { gold: 340, xp: 125 }, drop: 'badge-lark', respawn: 40000,
      onDefeat: (b, { first }) => {
        findInbox();
        banner('Inbox zero', first ? 'Lark Badge earned. Every message consumed, every ACK sent.' : 'Consumed again. New messages are always arriving.', 'ribbon-medal');
        say('me', first ? 'Backlog: 0. Consumers: happy.' : 'Drained. Again.');
      },
    });
    const bossHit = boss.hit.bind(boss);
    let phaseShown = 0, wasAlive = boss.alive, introShown = false, rebalanceAt = 0, drainT = 0;
    const PHASES = [null, ['Consumer lag rising', 'Phase 2 · volleys and hot partitions'], ['Backpressure!', 'Phase 3 · it charges. Keep the consumers up!']];
    const setConsumer = (i, on) => { active[i] = on; consumerMeshes[i].userData.setHi(on ? 1 : 0); };
    const resetConsumers = () => { for (let i = 0; i < 3; i++) setConsumer(i, false); };
    CONSUMERS.forEach(([x, z], i) => {
      const dx = BOSS_HOME.x - x, dz = BOSS_HOME.z - z, l = Math.hypot(dx, dz);
      interactable(ctx, {
        x: x + (dx / l) * 1.5, z: z + (dz / l) * 1.5, r: 1.8, label: `Consumer ${i + 1}`, prompt: 'E · start consumer', y: ROOF + 0.5,
        onInteract: () => {
          if (active[i]) { toast(`Consumer ${i + 1} is already consuming.`, { icon: 'check' }); return; }
          setConsumer(i, true);
          sfx('zap');
          const n = active.filter(Boolean).length;
          toast(`Consumer ${i + 1} online (${n}/3). The backlog shrinks.`, { icon: 'check', tone: 'good' });
          if (!rebalanceAt) rebalanceAt = lastT + 16;
        },
      });
    });
    // drain beams from active consumers to the backlog (one draw call)
    const beamPos = new Float32Array(3 * 2 * 3);
    const beamGeo = new THREE.BufferGeometry();
    beamGeo.setAttribute('position', new THREE.BufferAttribute(beamPos, 3));
    const beams = new THREE.LineSegments(beamGeo, new THREE.LineBasicNodeMaterial({ color: GREEN }));
    beams.frustumCulled = false;
    ctx.group.add(beams);

    // ================================================================ NPCs
    spawnNpc(ctx, {
      id: 'lk-askai', name: 'AskAI', sprite: 'lk-askai', x: 5, z: 17, face: 3.3,
      news: () => !st.asked,
      talk: () => ({
        text: 'Hello! I\'m AskAI, your sales-data analysis assistant. I cache with Redis and I queue with RocketMQ. Ask me anything about this chart. (The chart is behind you. It has bars.)',
        choices: [
          { label: 'Why did sales dip in Q3?', next: () => { ask(); return { text: 'Analysis complete: sales dipped in Q3 because the line goes down there. Confidence: extremely high. Would you like me to make the line go up? (I cannot.)', choices: [{ label: 'Thanks, I think' }] }; } },
          { label: 'Which region sold the most?', next: () => { ask(); return { text: 'The one with the tallest bar. I have cached this answer in Redis, so next time I can be this helpful even faster.', choices: [{ label: 'Impressive' }] }; } },
          { label: 'Forecast next quarter', next: () => { ask(); return { text: 'Up. Or down. Possibly sideways. I have published your question to RocketMQ; a consumer will get back to you. Probably after the backlog on the roof is cleared.', choices: [{ label: 'I\'ll go clear it' }] }; } },
          { label: 'Who built you?', next: () => { ask(); findBuilt(); return { text: 'ByteDance Lark, June to November 2023: an intern named Yichen worked on my backend as a backend developer intern. AskAI, for sales-data analysis, on Redis and RocketMQ. Every answer I give passes through his queues. Yes, even the bad ones.', choices: [{ label: 'Nice work, intern' }] }; } },
          { label: 'Bye' },
        ],
      }),
    });
    function ask() { if (!st.asked) { st.asked = true; ctx.save(); } findAsk(); }
    spawnNpc(ctx, {
      id: 'lk-larkin', name: 'Larkin · mailroom', sprite: 'lk-larkin', x: -14, z: 19, face: 0,
      news: () => !st.metLarkin || ((st.mail || 0) >= 5 && !st.delivered),
      talk: () => {
        st.metLarkin = true; ctx.save();
        const n = st.mail || 0;
        if (st.delivered) return { text: 'All delivered, all acknowledged. Exactly once, I checked. Twice.', choices: [{ label: 'Good bird' }] };
        if (n >= 5) {
          st.delivered = true; ctx.save();
          sfx('achievement');
          return { text: 'All five! Delivering now: ACK, ACK, ACK, ACK, ACK. You would make an excellent consumer. That is a compliment in this building.', choices: [{ label: 'Any time' }] };
        }
        return {
          text: `Larkin, mailroom. Five messages fell out of the queue and scattered across the tower: the plaza, the Redis floor, the RocketMQ floor, even the roof. Bring them back? You have ${n} of 5.`,
          choices: [
            { label: 'Where exactly?', next: { text: 'Two on the plaza, far corners. One by the Redis lockers. One on the RocketMQ floor near the elevator shaft. One on the roof, right next to the Backlog. Sorry about that one.', choices: [{ label: 'On it' }] } },
            { label: 'On it' },
          ],
        };
      },
    });

    // ================================================================ interactables, pickups
    let cached = false, fetching = false;
    const cache = interactable(ctx, {
      x: -12.4, z: -2, r: 2.2, label: 'Redis · 0 keys cached', prompt: 'E · GET sales:q3', y: 5.5,
      onInteract: () => {
        if (fetching) return;
        if (!cached) {
          fetching = true;
          sfx('tick');
          toast('GET sales:q3 → MISS. Fetching from the database…', { icon: 'hourglass' });
          setTimeout(() => { fetching = false; cached = true; cache.setLabel('Redis · 1 key cached'); toast('…got it. Cached in Redis. Try again.', { icon: 'check' }); }, 1800);
          return;
        }
        sfx('coin');
        toast('GET sales:q3 → HIT. Instant.', { icon: 'check', tone: 'good' });
        findHit();
      },
    });
    interactable(ctx, {
      x: -7.5, z: -9, r: 2, label: 'RocketMQ producer', prompt: 'E · publish a message', y: 9.5,
      onInteract: () => {
        if (published >= 0) { toast('Your message is still on the belt. Patience: at-least-once takes a moment.', { icon: 'hourglass' }); return; }
        let best = 0;
        for (let i = 1; i < N_ENV; i++) if (envS[i] < envS[best]) best = i;
        envS[best] = 0;
        published = best;
        envMesh.setColorAt(best, colr.set('#fbbf24')); envMesh.instanceColor.needsUpdate = true;
        sfx('pop');
        toast('Published to topic "sales-questions". Watch it ride to the consumer.', { icon: 'messages-square' });
      },
    });
    interactable(ctx, {
      x: -6, z: 17.4, label: 'An intern\'s desk', prompt: 'E · look',
      onInteract: () => {
        dialog({ text: 'A green lanyard, a whiteboard that says "Redis ≠ database (mostly)", and a calendar from June to November 2023. Backend developer intern at ByteDance Lark. Of all the jobs on this CV, this is the earliest.', choices: [{ label: 'Where it all started' }] }, { name: 'Backend developer intern', sprite: 'scholar' });
        findFirst();
      },
    });
    interactable(ctx, {
      x: 7.5, z: 13.2, label: 'Express elevator ↑ roof', prompt: 'E · read',
      onInteract: () => dialog({ text: 'EXPRESS ELEVATOR. Walk into the shaft and stand on the green platform. Goes to the roof. Comes back down. No stairs were harmed.', choices: [{ label: 'Going up' }] }, { name: 'Sign', sprite: 'book' }),
    });
    for (const [id, x, z] of [['lark-mail-1', -20, -9], ['lark-mail-2', 20, -19], ['lark-mail-3', -12.5, -11], ['lark-mail-4', 9, 5], ['lark-mail-5', -3, 1]]) {
      pickup(ctx, { id, x, z, sprite: 'lk-mail', scale: 0.14, onPick: () => {
        st.mail = (st.mail || 0) + 1; ctx.save();
        toast(st.mail < 5 ? `Undelivered message (${st.mail}/5).` : 'All 5 messages found. Back to Larkin in the mailroom!', { icon: 'mail' });
      } });
    }
    portal(ctx, { x: 0, z: 23, to: 'hub', color: GREEN });
    trigger(ctx, { x: 0, z: -2, r: 6.5, minY: ROOF - 0.5, onEnter: () => {
      if (!boss.alive || introShown) return;
      introShown = true;
      banner('QUEUE BACKLOG', 'Producers outpace you. Start the 3 consumers (E) to drain it.', 'mail');
      sfx('encounter');
    } });
    trigger(ctx, { x: 0, z: 11, r: 3, once: true, onEnter: () => say('bit', 'Floor 1 is Redis, floor 2 is RocketMQ, and the roof is… a lot of mail.') });

    // ================================================================ quest + eggs
    quest({
      id: 'lark-mail', title: 'Deliver the mail',
      steps: [
        { id: 'larkin', text: 'Talk to Larkin in the mailroom', done: () => !!st.metLarkin },
        { id: 'find', text: 'Find the 5 undelivered messages', done: () => (st.mail || 0) >= 5 },
        { id: 'deliver', text: 'Bring them back to Larkin', done: () => !!st.delivered },
      ],
      reward: { gold: 170, xp: 70 },
    });
    const findAsk = egg('lark-askai', 'Ask me anything', 'Ask AskAI a question about the sales chart.', 'AskAI: a sales-data analysis assistant. Real project, fictional chart.');
    const findBuilt = egg('lark-builder', 'Who built you?', 'Ask AskAI who built it.', 'Backend developer intern at ByteDance Lark: AskAI on Redis and RocketMQ.');
    const findHit = egg('lark-cache-hit', 'Cache hit', 'GET the same key twice on the Redis floor.', 'MISS, then HIT. Redis, working as intended.');
    const findAck = egg('lark-ack', 'ACK', 'Publish a message on the RocketMQ floor and watch it get consumed.', 'Produced, queued, consumed, acknowledged. RocketMQ in one belt.');
    const findElev = egg('lark-elevator', 'Scaled vertically', 'Ride the express elevator to the roof.', 'Sometimes the answer is a bigger machine. Or a taller one.');
    const findFirst = egg('lark-first', 'Jun – Nov 2023', 'Look at the intern\'s desk in the Lark lobby.', 'The earliest industry quest on the CV: Lark, June – November 2023.');
    const findDrop = egg('lark-dropped', 'Message dropped', 'Fall off the Lark tower\'s island.', 'At-most-once delivery. You were the message.');
    const findRebalance = egg('lark-rebalance', 'Rebalance!', 'Keep the consumers running long enough during the Queue Backlog fight.', 'A consumer dropped out of the group mid-fight. Very realistic.');
    const findInbox = egg('lark-inbox', 'Inbox zero', 'Drain the Queue Backlog on the roof.', 'Lark Badge earned.');

    // ================================================================ per frame
    let fell = false;
    onUpdate(ctx, (dt, t) => {
      lastT = t;
      glowMesh.userData.setHi(0.2 + 0.2 * Math.sin(t * 2));
      // the conveyor
      for (let i = 0; i < N_ENV; i++) {
        envS[i] += dt * 2.2;
        if (envS[i] >= 16) {
          envS[i] -= 16;
          if (i === published) {
            published = -1;
            envMesh.setColorAt(i, colr.set('#f8fafc')); envMesh.instanceColor.needsUpdate = true;
            sfx('coin');
            toast('Consumed. ACK sent.', { icon: 'check', tone: 'good' });
            findAck();
          }
        }
        _m.makeTranslation(-8 + envS[i] + ctx.ox, 9.62 + (i === published ? 0.12 : 0), -10 + ctx.oz);
        envMesh.setMatrixAt(i, _m);
      }
      envMesh.instanceMatrix.needsUpdate = true;
      // boss: revive resets, phases, consumers drain / producers refill, rebalances
      if (boss.alive && !wasAlive) { resetConsumers(); phaseShown = 0; introShown = false; rebalanceAt = 0; }
      wasAlive = boss.alive;
      let nb = 0;
      if (boss.alive) {
        const f = boss.hp / boss.maxHp;
        const ph = f <= 0.3 ? 2 : f <= 0.6 ? 1 : 0;
        if (ph > phaseShown) { phaseShown = ph; banner(...PHASES[ph], 'mail'); sfx('encounter'); }
        const engaged = ctx.playing && ctx.player.y > ROOF - 1 && Math.hypot(ctx.player.x - BOSS_HOME.x, ctx.player.z - BOSS_HOME.z) < 9;
        if (engaged) {
          drainT += dt;
          if (drainT >= 0.5) {
            drainT -= 0.5;
            const k = active.filter(Boolean).length;
            if (k) bossHit(3 * k);
            else if (boss.hp < boss.maxHp) boss.hp = Math.min(boss.maxHp, boss.hp + 3);
          }
          if (rebalanceAt && t > rebalanceAt && boss.alive) {
            rebalanceAt = t + 18;
            const on = [0, 1, 2].filter((i) => active[i]);
            if (on.length) {
              const i = on[Math.floor(Math.random() * on.length)];
              setConsumer(i, false);
              banner('Rebalance!', `Consumer ${i + 1} dropped out of the group. Restart it (E).`, 'triangle-alert');
              sfx('error');
              findRebalance();
            }
          }
        }
        for (let i = 0; i < 3; i++) {
          if (!active[i]) continue;
          const [cx, cz] = CONSUMERS[i];
          beamPos.set([cx + ctx.ox, ROOF + 2.2, cz + ctx.oz, boss.x, boss.y + 3, boss.z], nb * 6);
          nb++;
        }
      }
      beamGeo.setDrawRange(0, nb * 2);
      beamGeo.attributes.position.needsUpdate = true;
      beams.visible = nb > 0;
      if (!ctx.playing) return;
      const P = ctx.player;
      if (P.y < -3 && !fell) { fell = true; findDrop(); }
      if (P.y > 0) fell = false;
      if (P.y > ROOF - 0.2 && Math.abs(P.x - ELEV.x) < 1 && Math.abs(P.z - ELEV.z) < 1) findElev();
    });

    onEnter(ctx, () => {
      if (!st.visited) { st.visited = true; ctx.save(); setTimeout(() => say('bit', 'An office tower made of messages. The roof looks… backed up.'), 900); }
      if (!hasItem('badge-lark')) setTimeout(() => say('lk-askai', 'Ask me anything!'), 2400);
    });
    onLeave(ctx, () => { if (boss.alive) { boss.hp = boss.maxHp; resetConsumers(); rebalanceAt = 0; introShown = false; } });
  },
};
