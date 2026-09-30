// regions/timi.js: the TiMi hunting grounds (Tencent TiMi Studio, game developer intern, Jun – Jul 2024:
// client work on the Monster Hunter mobile game, including voice-controlled teammates).
// Everything here is original: the monsters, the wyvern, the teammates.
//   - base camp (tent, campfire, supply crate, quest board), plains with a river, a moss forest, an ore
//     outcrop, a giant phone-shaped monolith, and the wyvern's nest up north
//   - Pip and Mochi, voice-controlled teammates: type (or shout, or actually say) a command
//   - boss: Hitboxia, the wyvern with the generous hitbox (→ badge-timi)
import * as THREE from 'three/webgpu';
import {
  terrain, props, registerArt, registerEnemyKind, spawnEnemy, spawnBoss, spawnNpc, interactable, trigger,
  pickup, portal, quest, egg, say, banner, toast, sfx, onUpdate, onEnter, cinematic, dialog, shade, hash3,
  hasItem,
} from '../regions.js';
import { openModal } from '../modal.js';
import { dealDamage } from '../combat.js';
import { heal } from '../player.js';
import { h } from '../util.js';
import { TIMI_ART } from './art-timi.js';

const BLUE = '#5fb3ff';
const NEST = { x: 0, z: -16 };
const riverZ = (x) => 1 + 2.5 * Math.sin(x * 0.16);
const inIsland = (x, z) => Math.hypot(x, z) < 24 + 1.5 * Math.sin(Math.atan2(z, x) * 5);
const inCamp = (x, z) => z > 13 && Math.abs(x) < 11;
const hills = (x, z) => 3 + Math.max(0, Math.min(2, Math.round(0.9 * Math.sin(x * 0.23) + 0.8 * Math.cos(z * 0.19) + 0.5 * Math.sin((x + z) * 0.31))));

function groundH(x, z) {
  if (!inIsland(x, z)) return null;
  const n = Math.hypot(x - NEST.x, z - NEST.z);
  if (n < 7) return 6;
  if (n < 9) return 5;
  if (n < 11) return 4;
  const dr = Math.abs(z - riverZ(x));
  if (dr < 1.6) return 1;
  if (dr < 2.6) return 2;
  if (inCamp(x, z)) return 3;
  let hh = hills(x, z);
  hh = Math.min(hh, 3 + Math.floor(dr - 2.6));      // gentle banks
  hh = Math.min(hh, 4 + Math.floor(n - 11));        // gentle around the nest
  return Math.max(3, hh);
}

// the voice command parser: text -> { verb, who, shout, zh }
const VERBS = {
  attack: ['attack', 'fight', 'hit', 'kill', 'charge', 'sic', 'hunt', 'get him', 'get it', 'go go', '冲', '上', '打', '攻击', '干'],
  follow: ['follow', 'come', 'here', 'with me', 'regroup', '跟', '过来', '集合'],
  stay: ['stay', 'wait', 'stop', 'hold', 'halt', 'camp', '停', '等', '别动'],
  heal: ['heal', 'potion', 'herb', 'help', 'medic', 'hp', '治疗', '奶', '救'],
  dance: ['dance', 'emote', 'party', 'celebrate', 'boogie', '跳舞', '跳'],
  roll: ['roll', 'dodge', 'evade', '翻滚', '闪'],
  hello: ['hello', 'hi', 'hey', 'yo', 'greetings', '你好', '嗨'],
  gg: ['gg', 'good game', 'well played', 'wp'],
  who: ['who made', 'who built', 'yichen', 'creator', 'who are you'],
};
function parseCommand(raw) {
  const text = raw.trim();
  const low = text.toLowerCase();
  const letters = text.replace(/[^A-Za-z]/g, '');
  const shout = letters.length >= 3 && letters === letters.toUpperCase();
  const zh = /[一-鿿]/.test(text);
  const who = /\bpip\b/.test(low) && !/\bmochi\b/.test(low) ? 'pip' : /\bmochi\b/.test(low) && !/\bpip\b/.test(low) ? 'mochi' : 'both';
  let verb = null;
  for (const [v, words] of Object.entries(VERBS)) if (words.some((w) => (/^[a-z ]+$/.test(w) ? new RegExp(`\\b${w}\\b`).test(low) : low.includes(w)))) { verb = v; break; }
  return { verb, who, shout, zh, text };
}

export default {
  id: 'timi',
  name: 'TiMi hunting grounds',
  subtitle: 'Game developer intern · Jun – Jul 2024',
  size: 54,
  spawn: [0, 19],
  sky: { tint: '#fde68a', ground: '#12230f', fog: '#0f1d18', density: 0.0078, sun: 2.1 },
  zones: {
    camp: { x: 0, z: 17, r: 8, label: 'Base camp' },
    river: { x: 0, z: 1, r: 6, label: 'Snapdrake ford' },
    forest: { x: -16, z: 0, r: 8, label: 'Mossy forest' },
    outcrop: { x: 16, z: -6, r: 7, label: 'Ore outcrop' },
    phone: { x: 13, z: 12, r: 4, label: 'The Monolith' },
    nest: { x: NEST.x, z: NEST.z, r: 10, label: 'Hitboxia\'s nest' },
  },

  build(ctx) {
    for (const [name, art] of Object.entries(TIMI_ART)) registerArt(name, art, name === 'tm-fly' ? { Y: 3, W: 2 } : name === 'tm-missing' ? { M: 0.6 } : null);
    const st = ctx.state;
    const W = ctx.world;

    // ================================================================ terrain
    terrain(ctx, {
      size: 54,
      height: groundH,
      type: (x, z) => {
        const n = Math.hypot(x - NEST.x, z - NEST.z);
        if (n < 7) return 'straw';
        if (n < 11) return 'rim';
        const dr = Math.abs(z - riverZ(x));
        if (dr < 1.6) return 'water';
        if (dr < 2.6) return 'bank';
        if (inCamp(x, z)) return 'camp';
        if (x < -9) return 'moss';
        if (x > 11 && z < 3) return 'rock';
        return hash3(x, 0, z) < 0.5 ? 'grass' : 'grass2';
      },
      palette: {
        grass: ['#5b9e3c', '#4f8f34', '#66a845'], grass2: ['#6aa84f', '#5c9a43'],
        moss: ['#2f5d34', '#3a6b3c', '#284f2c'], water: ['#2f86c9', '#3b9ae0', '#2a78b5'],
        bank: ['#d6c08a', '#c9b27a'], camp: ['#a07850', '#8f6a45', '#b08858'],
        rock: ['#78716c', '#6b645f', '#8a837d'], rim: ['#57534e', '#6b635c'],
        straw: ['#caa24a', '#b8902f', '#d9b25a'],
      },
    });
    const gy = (x, z) => groundH(Math.round(x), Math.round(z)) ?? 3;

    // ================================================================ props
    const solid = [], deco = [], glow = [];
    // trees in the moss forest
    for (let i = 0; i < 16; i++) {
      const x = Math.round(-21 + ctx.rand() * 11), z = Math.round(-14 + ctx.rand() * 26);
      if (Math.abs(z - riverZ(x)) < 3.5 || !inIsland(x, z) || Math.hypot(x, z) > 21) continue;
      const g = gy(x, z);
      for (let y = g + 1; y <= g + 4; y++) solid.push([x, y, z, '#6b4423']);
      const top = 3 + Math.floor(ctx.rand() * 2);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let y = g + 5; y < g + 5 + top; y++) {
        if (Math.abs(dx) + Math.abs(dz) === 2 && y === g + 4 + top) continue;
        deco.push([x + dx, y, z + dz, hash3(x + dx, y, z + dz) < 0.5 ? '#2f7d32' : '#3c9440']);
      }
      deco.push([x, g + 5 + top, z, '#4caf50']);
    }
    // the tent (TiMi blue with white stripes)
    for (let k = 0; k <= 3; k++) for (let x = -10; x <= -6; x++) {
      const c = x % 2 ? BLUE : '#f8fafc';
      solid.push([x, 4 + k, 14 + k, c]);
      if (k < 3) solid.push([x, 4 + k, 20 - k, c]);
    }
    for (let x = -10; x <= -6; x++) solid.push([x, 7, 17, BLUE], [x, 8, 17, '#f8fafc']);
    // the campfire: stones + glowing embers
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) deco.push([dx, 4, 15 + dz, '#57534e']);
    glow.push([0, 4, 15, '#f97316', 2.5], [0, 5, 15, '#fbbf24', 2.5]);
    // supply crate
    for (const c of [[6, 4, 16], [7, 4, 16], [6, 4, 17], [7, 4, 17], [6, 5, 16], [7, 5, 16], [6, 5, 17], [7, 5, 17]]) solid.push([...c, c[1] === 5 ? BLUE : '#8b5a2b']);
    // quest board
    for (let y = 4; y <= 7; y++) solid.push([2, y, 12, '#6b4423'], [5, y, 12, '#6b4423']);
    for (let x = 2; x <= 5; x++) for (let y = 6; y <= 8; y++) deco.push([x, y, 12, y === 8 ? '#92400e' : '#e7d3a8']);
    // the Monolith: a giant phone standing in the grass
    const PH = { x: 13, z: 12 };
    const pg = gy(PH.x, PH.z);
    for (let x = PH.x - 2; x <= PH.x + 2; x++) for (let y = pg + 1; y <= pg + 10; y++) {
      const edge = x === PH.x - 2 || x === PH.x + 2 || y === pg + 1 || y === pg + 10;
      if (edge) solid.push([x, y, PH.z, '#111827']);
      else glow.push([x, y, PH.z, shade(BLUE, (y - pg) / 20 - 0.2), 1.3]);
    }
    deco.push([PH.x, pg + 10, PH.z - 1, '#374151']);
    // nest: bone ribs around the rim (gaps to walk through)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.2;
      if (Math.abs(Math.sin(a) - 1) < 0.25) continue;      // leave the south entrance open
      for (let k = 0; k < 5; k++) {
        const r = 9 - Math.max(0, k - 2) * 0.9;
        const x = Math.round(NEST.x + Math.cos(a) * r), z = Math.round(NEST.z + Math.sin(a) * r);
        (k === 0 ? solid : deco).push([x, 6 + k, z, '#f5f5f4']);
      }
    }
    // boulders on the outcrop
    for (const [x, z] of [[17, -11], [20, -5], [14, -1], [21, -9]]) {
      const g = gy(x, z);
      for (const c of [[0, 1, 0], [1, 1, 0], [0, 1, 1], [0, 2, 0]]) solid.push([x + c[0], g + c[1], z + c[2], '#57534e']);
    }
    props(ctx, solid, { block: true });
    props(ctx, deco);
    const glowMesh = props(ctx, glow, { shadow: false });

    // ================================================================ enemies
    const bugKill = () => { st.bugs = (st.bugs || 0) + 1; ctx.save(); if (st.bugs <= 3) toast(`Bug squashed (${Math.min(3, st.bugs)}/3). Filed as "won't happen again".`, { icon: 'check' }); };
    const kinds = {
      'timi-snap': { name: 'Snapdrake', sprite: 'tm-snap', hp: 22, speed: 5.2, dmg: 6, type: 'Grass', xp: 14, gold: 14, behaviour: 'swarm', scale: 0.18, color: '#84cc16' },
      'timi-spore': { name: 'Sporepuff', sprite: 'tm-spore', hp: 30, dmg: 7, type: 'Grass', xp: 16, gold: 16, behaviour: 'turret', rate: 2500, proj: 'psy', projSpeed: 6.5, aggro: 10, scale: 0.2, color: '#e879f9' },
      'timi-beetle': { name: 'Tuskbeetle', sprite: 'tm-beetle', hp: 44, speed: 3.2, dmg: 10, type: 'Normal', xp: 22, gold: 22, behaviour: 'charge', rate: 2800, scale: 0.2, color: '#f59e0b' },
      'timi-tpose': { name: 'T-Pose Grunt', sprite: 'tm-tpose', hp: 36, speed: 2.4, dmg: 8, type: 'Normal', xp: 20, gold: 20, behaviour: 'chase', scale: 0.2, color: '#ff00ff',
        onDeath: () => { bugKill(); findTpose(); } },
      'timi-missing': { name: 'Missing Texture', sprite: 'tm-missing', hp: 16, speed: 4.6, dmg: 5, type: 'Ghost', xp: 12, gold: 12, behaviour: 'swarm', scale: 0.2, color: '#ff00ff',
        onDeath: () => bugKill() },
      'timi-moss': { name: 'Mossback', sprite: 'tm-moss', hp: 60, speed: 1.1, dmg: 0, type: 'Grass', xp: 4, gold: 4, behaviour: 'wander', scale: 0.26, color: '#65a30d', respawn: 30000 },
      'timi-fly': { name: 'Firefly', sprite: 'tm-fly', hp: 4, speed: 1.4, dmg: 0, type: 'Flying', xp: 1, gold: 1, behaviour: 'wander', flying: true, scale: 0.12, color: '#fde047' },
    };
    for (const [id, k] of Object.entries(kinds)) registerEnemyKind(id, k);
    const hostiles = [];
    const put = (kind, list) => { for (const [x, z] of list) { const f = spawnEnemy(ctx, { kind, x, z }); if (kinds[kind].behaviour !== 'wander') hostiles.push(f); } };
    put('timi-snap', [[-4, -6], [5, -5], [1, -9]]);
    put('timi-spore', [[-15, -4], [-13, 8]]);
    put('timi-beetle', [[16, -5], [12, -13]]);
    put('timi-tpose', [[8, 6], [-8, 8]]);
    put('timi-missing', [[10, -1], [-6, -2]]);
    put('timi-moss', [[-3, 3], [9, 3]]);
    put('timi-fly', [[-16, 2], [-12, -8], [-18, 9]]);

    // ================================================================ boss: Hitboxia
    const boss = spawnBoss(ctx, {
      id: 'timi-hitboxia', name: 'Hitboxia, the Generous Wyvern', sprite: 'tm-wyvern', scale: 0.3, x: NEST.x, z: NEST.z - 1,
      hp: 460, type: 'Dragon', r: 3.4, color: '#2dd4bf', contact: 12, speed: 1.7, aggro: 12,
      pattern: ['charge', 'volley', 'rings'],
      phases: [
        { below: 0.6, pattern: ['volley', 'summon', 'nova'], speed: 1.2 },
        { below: 0.25, pattern: ['charge', 'rings', 'volley', 'charge'], speed: 2.4, every: 2400 },
      ],
      minion: 'timi-snap', reward: { gold: 360, xp: 130 }, drop: 'badge-timi', respawn: 45000,
      onDefeat: (b, { first }) => {
        b.cfg.flying = false;
        findHitbox();
        banner(first ? 'Hunt complete' : 'Hunt complete (again)', first ? 'TiMi Badge earned. Carve responsibly.' : 'Hitboxia will respawn. It always does.', 'dragon-head');
        for (const m of mates) if (m.mode !== 'stay') { m.mode = 'dance'; m.until = clockT + 4; }
        say('tm-pip', 'WE DID IT!');
      },
    });
    // the generous hitbox, drawn as a debug wireframe that follows it around
    const hitbox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(6.8, 5, 6.8)), new THREE.LineBasicNodeMaterial({ color: '#4ade80' }));
    ctx.group.add(hitbox);
    let phaseShown = 0, introDone = false;
    const PHASES = [null, ['It takes flight!', 'Phase 2 · fireballs from above, and it calls the pack'], ['Limping… and furious', 'Phase 3 · faster charges. Roll with K!']];

    // ================================================================ teammates (voice-controlled)
    const pip = spawnNpc(ctx, { id: 'tm-pip', name: 'Pip · teammate', sprite: 'tm-pip', x: -3, z: 17, face: 3.1, talk: () => mateTalk('pip'), news: () => !st.commanded });
    const mochi = spawnNpc(ctx, { id: 'tm-mochi', name: 'Mochi · teammate', sprite: 'tm-mochi', x: -5, z: 19, face: 3.1, talk: () => mateTalk('mochi'), news: () => !st.commanded });
    const mates = [
      { id: 'pip', npc: pip, off: [-1.9, 1.4], mode: 'idle', home: [-3, 17], cd: 0, until: 0, healCd: 0 },
      { id: 'mochi', npc: mochi, off: [1.9, 1.4], mode: 'idle', home: [-5, 19], cd: 0, until: 0, healCd: 0 },
    ];
    let clockT = 0;

    function mateTalk(who) {
      const n = who === 'pip'
        ? 'Pip here! Otter, squire, pot-lid enthusiast. I\'m a voice-controlled teammate: tell me what to do and I do it. Mostly.'
        : 'Mochi, dumpling knight, reporting. Voice-controlled. I respond to commands, snacks, and very loud commands.';
      return {
        text: n,
        choices: [
          { label: 'Give a voice command…', icon: 'messages-square', action: () => openVoice() },
          { label: '"Follow me!"', action: () => command('follow me', { preset: true }) },
          { label: '"Attack!"', action: () => command('attack', { preset: true }) },
          { label: '"Stay here."', action: () => command('stay', { preset: true }) },
          { label: 'Bye' },
        ],
      };
    }

    function openVoice() {
      const input = h('input', { class: 'typing__input', type: 'text', maxlength: '60', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Your command', placeholder: 'attack · follow me · stay · heal · dance · 跟上 …' });
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      let handle = null;
      const submit = (opts = {}) => { const v = input.value.trim(); if (!v) { input.focus(); return; } handle.close(); command(v, opts); };
      const mic = SR ? h('button', { type: 'button', class: 'btn', onclick: () => {
        try {
          const rec = new SR();
          rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
          rec.onresult = (e) => { input.value = e.results[0][0].transcript; submit({ mic: true }); };
          rec.onerror = () => toast('The mic did not hear anything. Typing works too.', { icon: 'volume-x' });
          rec.start();
          mic.textContent = 'Listening…';
        } catch { toast('No microphone here. Typing works too.', { icon: 'volume-x' }); }
      } }, 'Say it out loud') : null;
      handle = openModal({
        id: 'timi-voice', title: 'Voice command', className: 'game-panel',
        body: (b) => b.append(
          h('p', { class: 'game__hint' }, 'Type what you would say to Pip and Mochi. Name one of them to talk to just that one. ALL CAPS counts as shouting.'),
          input,
          h('div', { class: 'modal__actions' }, mic, h('button', { type: 'button', class: 'btn', onclick: () => submit() }, 'Send')),
        ),
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    }

    const LINES = {
      attack: ['On it!', 'Charging!', 'For the hunt!'],
      follow: ['Right behind you!', 'Following!', 'Coming!'],
      stay: ['Holding position.', 'Staying put.', 'I\'ll guard this rock.'],
      heal: ['Herb incoming!', 'Here, eat this leaf.'],
      dance: ['♪ emote wheel ♪', 'Dance break!'],
      roll: ['*rolls*', 'Dodge roll! (It does nothing here.)'],
      hello: ['Hi! Awaiting orders.', 'Hello, hunter!'],
      gg: ['GG! Good game.', 'gg wp'],
      who: ['Yichen built voice-controlled teammates at TiMi Studio, summer 2024. We\'re the fan-made version.', 'Voice-controlled teammates were a real feature Yichen worked on. We\'re the original-character edition.'],
    };
    function command(raw, { preset = false, mic = false } = {}) {
      const c = parseCommand(raw);
      const targets = mates.filter((m) => c.who === 'both' || m.id === c.who);
      if (!c.verb) {
        for (const m of targets) say(m.npc, c.shout ? 'SORRY, I DIDN\'T CATCH THAT.' : 'Sorry, I didn\'t catch that. Did you mean "attack"?');
        findUnknown();
        return;
      }
      st.commanded = true; ctx.save();
      findVoice();
      if (!preset && (c.shout || mic)) findShout();
      if (c.zh) findZh();
      targets.forEach((m, i) => {
        let line = LINES[c.verb][(i + Math.floor(clockT)) % LINES[c.verb].length];
        if (c.zh) line = { attack: '冲！', follow: '跟上了！', stay: '收到，原地待命。', heal: '奶一口！', dance: '来跳舞！', roll: '翻滚！', hello: '你好！', gg: 'GG!', who: line }[c.verb] || line;
        if (c.shout) line = line.toUpperCase();
        setTimeout(() => say(m.npc, line, 3200), i * 450);
        switch (c.verb) {
          case 'attack': m.mode = 'attack'; break;
          case 'follow': m.mode = 'follow'; break;
          case 'stay': m.mode = 'stay'; break;
          case 'heal':
            if (m.healCd > clockT) { setTimeout(() => say(m.npc, 'Out of herbs. Give me a few seconds!', 2600), 1200); break; }
            m.healCd = clockT + 12; heal(18); sfx('heal'); break;
          case 'dance': m.prev = m.mode === 'dance' ? m.prev : m.mode; m.mode = 'dance'; m.until = clockT + 4; findDance(); break;
          case 'roll': m.roll = clockT + 0.5; break;
          default: break;
        }
      });
    }

    function stepMate(m, tx, tz, speed, dt) {
      const n = m.npc;
      const dx = tx - n.x, dz = tz - n.z, l = Math.hypot(dx, dz);
      if (l < 0.3) return false;
      const s = Math.min(l, speed * dt);
      const nx = n.x + (dx / l) * s, nz = n.z + (dz / l) * s;
      const h0 = W.height(n.x, n.z), h1 = W.height(nx, nz);
      if (h1 > -Infinity && !W.isBlocked(nx, nz) && h1 - h0 <= 1.2) { n.x = nx; n.z = nz; }
      else if (W.height(nx, n.z) > -Infinity && !W.isBlocked(nx, n.z)) n.x = nx;
      else if (W.height(n.x, nz) > -Infinity && !W.isBlocked(n.x, nz)) n.z = nz;
      n.y = W.surfaceY(n.x, n.z);
      n.mesh.position.x = n.x; n.mesh.position.z = n.z;
      n.mesh.rotation.y = Math.atan2(dx, dz);
      return true;
    }
    function nearestHostile(px, pz, range) {
      let best = null, bd = range;
      const consider = (f) => { if (!f.alive) return; const d = Math.hypot(f.x - px, f.z - pz); if (d < bd) { bd = d; best = f; } };
      for (const f of hostiles) consider(f);
      if (boss.alive) { consider(boss); for (const f of boss.minions) consider(f); }
      return best;
    }

    // ================================================================ NPC: Producer Pan
    spawnNpc(ctx, {
      id: 'tm-pan', name: 'Producer Pan', sprite: 'tm-pan', x: 4, z: 18, face: 3.4,
      news: () => !st.metPan,
      talk: () => {
        st.metPan = true; ctx.save();
        return {
          text: hasItem('badge-timi')
            ? 'You hunted Hitboxia! Ship it. Well, the build shipped long ago. Ship the badge. To you. Congratulations.'
            : 'Producer Pan. Welcome to the hunting grounds, where the monsters are original and the bugs are real. Grab your teammates, hunt the wyvern, and please file a ticket for every T-pose you see.',
          choices: [
            { label: 'What did Yichen do here?', icon: 'briefcase', next: {
              text: 'Summer 2024, June to July: game developer intern at Tencent\'s TiMi Studio. Client work on the Monster Hunter mobile game, including voice-controlled teammates. Out here we only have our own monsters. Legally distinct, emotionally available.',
              choices: [{ label: 'Voice-controlled?', next: { text: 'Talk to Pip or Mochi, then say what you want. Follow me. Attack. Stay. Heal. Dance, if you\'re that kind of hunter. They\'re bilingual, and they can tell when you\'re shouting.', choices: [{ label: 'Cool' }] } }] } },
            { label: 'Tell me about the wyvern', icon: 'crossed-swords', next: {
              text: 'Hitboxia. North, in the nest. Charges, breathes fire, flies when hurt, limps when really hurt. Its hitbox is far bigger than its body. Design says that\'s a bug. I say it\'s accessibility.',
              choices: [{ label: 'Noted' }] } },
            { label: 'Any work?', icon: 'scroll-text', next: {
              text: 'Playtest this build for me: give your teammates a voice command, squash three bugs (T-Pose Grunts and Missing Textures), and mine three ore crystals on the outcrop to the east.',
              choices: [{ label: 'Playtesting' }] } },
            { label: 'Bye' },
          ],
        };
      },
    });

    // ================================================================ interactables, pickups
    let crateCd = 0;
    interactable(ctx, {
      x: 6.5, z: 18.6, label: 'Supply crate', prompt: 'E · take a herb',
      onInteract: () => {
        if (crateCd > clockT) { toast('Empty. The next herb grows in a few seconds.', { icon: 'hourglass' }); return; }
        crateCd = clockT + 15;
        const got = heal(40);
        sfx('heal');
        toast(got ? 'First-aid herb. Tastes like grass. Works like magic.' : 'You are at full health. You eat the herb anyway.', { icon: 'health-potion', tone: 'good' });
      },
    });
    interactable(ctx, {
      x: 3.5, z: 13.6, label: 'Quest board', prompt: 'E · read',
      onInteract: () => {
        dialog({
          text: 'TiMi Studio · Summer 2024 (June – July).\nGame developer intern: client work on the Monster Hunter mobile game, including voice-controlled teammates.\n\nPosted quests:\n· Hunt Hitboxia (north nest)\n· Teach your teammates to listen\n· Somebody fix the T-poses',
          choices: [{ label: 'Accept all' }],
        }, { name: 'Quest board', sprite: 'book' });
        findSummer();
      },
    });
    interactable(ctx, {
      x: PH.x, z: PH.z + 1.6, r: 2.6, label: 'The Monolith', prompt: 'E · touch the screen',
      onInteract: () => {
        sfx('pop');
        dialog({
          text: 'A monolith shaped exactly like a phone. The screen lights up under your hand. Somewhere in the stone, a mobile game client is running. Yichen did client work on one of those: the Monster Hunter mobile game. Mind the thumb zone.',
          choices: [{ label: 'Tap tap' }],
        }, { name: 'The Monolith', sprite: 'crystal' });
        findMobile();
      },
    });
    for (const [i, [x, z]] of [[15, -4], [18, -8], [13, -10], [19, -2]].entries()) {
      pickup(ctx, { x, z, sprite: 'crystal', scale: 0.12, respawn: 25000, onPick: () => {
        st.ore = (st.ore || 0) + 1; ctx.save();
        if (st.ore <= 3) toast(`Ore crystal (${st.ore}/3). It hums in a pleasing key.`, { icon: 'gems' });
        void i;
      } });
    }
    portal(ctx, { x: 0, z: 23, to: 'hub', color: BLUE });
    trigger(ctx, { x: NEST.x, z: NEST.z, r: 11, onEnter: () => {
      if (!boss.alive || introDone) return;
      introDone = true;
      cinematic(ctx, { x: NEST.x, y: 7, z: NEST.z, pitch: 0.35, dist: 20, seconds: 2.4 });
      banner('HITBOXIA', 'The Generous Wyvern · its hitbox is bigger than it is', 'dragon-head');
      sfx('encounter');
    } });
    trigger(ctx, { x: 0, z: 4, r: 5, once: true, onEnter: () => say('bit', 'Snapdrakes! They come in packs. Tell your teammates to attack!') });

    // ================================================================ quest + eggs
    quest({
      id: 'timi-playtest', title: 'Playtest the build',
      steps: [
        { id: 'pan', text: 'Talk to Producer Pan at base camp', done: () => !!st.metPan },
        { id: 'voice', text: 'Give Pip or Mochi a voice command', done: () => !!st.commanded },
        { id: 'bugs', text: 'Squash 3 bugs (T-Pose Grunts, Missing Textures)', done: () => (st.bugs || 0) >= 3 },
        { id: 'ore', text: 'Mine 3 ore crystals on the east outcrop', done: () => (st.ore || 0) >= 3 },
      ],
      reward: { gold: 180, xp: 70 },
    });
    const findVoice = egg('timi-voice', 'Voice-controlled teammates', 'Give your TiMi teammates an order.', 'Voice-controlled teammates: a real feature from the TiMi internship.');
    const findShout = egg('timi-shout', 'Shouted commands', 'Shout at your teammates (ALL CAPS, or the microphone).', 'They heard you. So did the wyvern.');
    const findZh = egg('timi-bilingual', '双语队友 · Bilingual squad', 'Give your teammates a command in Chinese.', '冲！ The teammates speak both languages.');
    const findDance = egg('timi-dance', 'Emote wheel', 'Ask your teammates to dance.', 'Mid-hunt dance break. Very important for team morale.');
    const findUnknown = egg('timi-unknown', 'Sorry, I didn\'t catch that', 'Say something your teammates don\'t understand.', 'Every voice assistant\'s favourite sentence.');
    const findSummer = egg('timi-summer', 'Summer 2024', 'Read the quest board at TiMi base camp.', 'Game developer intern at TiMi Studio, June – July 2024.');
    const findMobile = egg('timi-mobile', 'Mobile client', 'Touch the Monolith in the TiMi hunting grounds.', 'Client work on the Monster Hunter mobile game. Mind the thumb zone.');
    const findTpose = egg('timi-tpose', 'Animation not found', 'Defeat a T-Pose Grunt.', 'Its animation controller has been notified.');
    const findHitbox = egg('timi-hitbox', 'Generous hitbox', 'Hunt Hitboxia in the TiMi nest.', 'Hunt complete. TiMi Badge earned.');

    // ================================================================ per frame
    onUpdate(ctx, (dt, t) => {
      clockT = t;
      glowMesh.userData.setHi(0.3 + 0.25 * Math.sin(t * 9) * Math.sin(t * 3.7));
      // boss: hitbox wireframe, phases
      hitbox.visible = boss.alive;
      if (boss.alive) {
        hitbox.position.set(boss.x, boss.y + 2.5 + (boss.cfg.flying ? 2 : 0), boss.z);
        hitbox.rotation.y = boss.mesh.rotation.y;
        const f = boss.hp / boss.maxHp;
        const ph = f <= 0.25 ? 2 : f <= 0.6 ? 1 : 0;
        if (ph > phaseShown) {
          phaseShown = ph;
          banner(...PHASES[ph], 'dragon-head'); sfx('encounter');
          boss.cfg.flying = ph === 1;
        } else if (f > 0.99 && phaseShown) { phaseShown = 0; boss.cfg.flying = false; introDone = false; }
      }
      // teammates
      if (!ctx.playing) return;
      const P = ctx.player;
      const px = P.x + ctx.ox, pz = P.z + ctx.oz;
      for (const m of mates) {
        const n = m.npc;
        let moving = false;
        if (Math.hypot(n.x - px, n.z - pz) > 30 && (m.mode === 'follow' || m.mode === 'attack')) {
          n.x = px + m.off[0]; n.z = pz + m.off[1]; n.y = W.surfaceY(n.x, n.z);
          if (n.y === -Infinity) { n.x = px; n.z = pz; n.y = W.surfaceY(px, pz); }
          n.mesh.position.set(n.x, n.y, n.z);
        }
        if (m.mode === 'dance') {
          n.mesh.rotation.y += dt * 9;
          n.mesh.position.y = n.y + Math.abs(Math.sin(t * 10)) * 0.6;
          if (t > m.until) m.mode = m.prev && m.prev !== 'dance' ? m.prev : 'follow';
          continue;
        }
        if (m.roll && t < m.roll) { n.mesh.rotation.x = (m.roll - t) * 12; } else if (n.mesh.rotation.x) n.mesh.rotation.x = 0;
        if (m.mode === 'follow') {
          if (Math.hypot(n.x - px, n.z - pz) > 3) moving = stepMate(m, px + m.off[0], pz + m.off[1], 6.2, dt);
        } else if (m.mode === 'attack') {
          const tgt = nearestHostile(px, pz, 16);
          if (!tgt) {
            if (!m.bored) { m.bored = true; say(n, 'No monsters nearby. Following!', 2400); }
            if (Math.hypot(n.x - px, n.z - pz) > 3) moving = stepMate(m, px + m.off[0], pz + m.off[1], 6.2, dt);
          } else {
            m.bored = false;
            const d = Math.hypot(tgt.x - n.x, tgt.z - n.z);
            if (d > (tgt.r || 0.9) + 1.1) moving = stepMate(m, tgt.x, tgt.z, 6.6, dt);
            else if (t > m.cd) {
              m.cd = t + 0.9;
              n.mesh.rotation.y = Math.atan2(tgt.x - n.x, tgt.z - n.z);
              dealDamage(tgt, tgt.boss ? 5 : 7, { source: 'buddy' });
              sfx('hit');
            }
          }
        }
        n.mesh.userData.setFrame?.(moving ? Math.floor(t * 8) % 2 : 0);
      }
    });

    onEnter(ctx, () => {
      // teammates wait at camp for their first order; afterwards they arrive with you
      for (const m of mates) {
        const n = m.npc;
        const [hx, hz] = m.mode === 'follow' || m.mode === 'attack' ? [ctx.def.spawn[0] + m.off[0], ctx.def.spawn[1] - 1.5] : m.home;
        n.x = hx + ctx.ox; n.z = hz + ctx.oz; n.y = W.surfaceY(n.x, n.z);
        n.mesh.position.set(n.x, n.y, n.z);
      }
      if (!st.visited) { st.visited = true; ctx.save(); setTimeout(() => say('bit', 'A hunting ground! Your teammates are by the tent. Talk to them.'), 900); }
    });
  },
};
