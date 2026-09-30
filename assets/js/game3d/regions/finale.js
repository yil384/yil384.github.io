// regions/finale.js: The Defense. Reached from the Stacks once the Road to Dr. is complete (all
// thirteen items). A round hall of books with a projector screen, a lectern and a committee table:
//   1. present at the lectern; "Any questions?" (silence); then the committee asks, one owl at a time
//   2. three committee members (original masked owl-scholars), each a pattern boss with its own
//      movement and attacks; every so often one asks a question about the CV and three answer stands
//      light up (walk to the right one, press E). Right answers hit hard, wrong ones cost nothing;
//      stepping out of the ring pauses the fight
//   3. "one more experiment": a GPU node whose run finishes on its own if you survive (hits speed it up)
//   4. graduation on the lawn: caps, confetti, fireworks, the Dr. (Honorary) title (a game joke), then
//      credits that roll through the real CV, a button back to the page and a New Game+ note
import * as THREE from 'three/webgpu';
import {
  terrain, props, registerArt, spawnBoss, spawnNpc, interactable, trigger, portal, egg, say, banner, toast,
  sfx, onUpdate, onEnter, onLeave, dialog, cinematic, sprite, setSky, travel, hash3, hasItem, ROAD, registerEnemyKind,
} from '../regions.js';
import { on } from '../bus.js';
import { clock } from '../clock.js';
import { player, heal } from '../player.js';
import { S, save } from '../state.js';
import { mode } from '../mode.js';
import { openModal, closeModal } from '../modal.js';
import * as fx from '../fx.js';
import { h } from '../util.js';
import { FINALE_ART, FINALE_GLOW } from './art-finale.js';

// ---------------------------------------------------------------- the Dr. (Honorary) name plate
// A game title, shown over the scholar in play after graduating (also installed by the Stacks on load).
let titleUnpin = null;
export function installDrTitle() {
  if (titleUnpin || !S.world.title) return;
  const el = h('div', { class: 'g__plate g__plate--thing is-near', style: { pointerEvents: 'none' } },
    h('b', null, 'Dr. Yichen Lin'), h('span', { class: 'g__plate-hint' }, '(Honorary · a game title)'));
  titleUnpin = fx.pin(el, () => (mode.play && !player.dead && !player.vehicle ? { x: player.x, y: player.y + 4.4, z: player.z } : null));
}

// ---------------------------------------------------------------- layout (region-local cells)
const C = { x: 0, z: -5, r: 10 };                     // the ring (the committee comes forward into it)
const ANS = [[-8, -1.5], [0, 2], [8, -1.5]];           // answer stands A, B, C
const LECTERN = { x: 7, z: -12 };
const SKY = { tint: '#c4b5fd', ground: '#140a1f', fog: '#0d0716', density: 0.0105, sun: 1.8 };
const GRAD_SKY = { tint: '#fde68a', ground: '#3b2a10', fog: '#22163a', density: 0.0065, sun: 2.8 };

function heightAt(x, z) {
  const r = Math.hypot(x, z);
  if (r > 22.5) return null;
  if (r > 19.5 && !(z > 0 && Math.abs(x) < 7)) return 10;              // walls of books (open to the south)
  if (z <= -16 && z >= -17 && Math.abs(x) <= 9) return 12;              // the screen wall
  if (z === 5 && Math.abs(x) <= 6) return 3;                            // the committee table
  if (x === LECTERN.x && z === LECTERN.z) return 3;                     // the lectern
  return 2;
}
function typeAt(x, z) {
  const hh = heightAt(x, z);
  if (hh === 10) return 'books';
  if (hh === 12) return 'screenwall';
  if (hh === 3) return z === 5 ? 'table' : 'lectern';
  if (z >= 9) return (x + z) & 1 ? 'lawn' : 'lawn2';
  const d = Math.hypot(x - C.x, z - C.z);
  if (d < C.r) return d > C.r - 1 ? 'rim' : ((Math.floor(x / 2) + Math.floor(z / 2)) & 1 ? 'parquet' : 'parquet2');
  if (Math.abs(x - LECTERN.x) <= 2 && Math.abs(z - LECTERN.z) <= 2) return 'stage';
  return Math.abs(x) <= 1 && z > 0 ? 'runner' : 'floor';
}
const PALETTE = {
  books: ['#7c2d12', '#1e3a8a', '#14532d', '#a16207', '#581c87', '#9f1239'], screenwall: ['#1f2937', '#232d3b'],
  table: ['#7f1d1d', '#6b1a1a'], lectern: ['#78350f'], lawn: ['#4ea24e', '#489a48'], lawn2: ['#5cb85c', '#55ad55'],
  rim: ['#fbbf24', '#f59e0b'], parquet: ['#8a5a2b', '#7c5026'], parquet2: ['#6b4423', '#5f3b1f'],
  stage: ['#334155', '#2b3647'], runner: ['#7c3aed', '#6d28d9'], floor: ['#3f2a1d', '#3a2619'],
};

// ---------------------------------------------------------------- the committee (original owls)
// Every right answer is a fact from the CV; the wrong ones are jokes.
const MEMBERS = [
  {
    id: 'fn-chair', name: 'Prof. Strix · Committee Chair', short: 'Prof. Strix', seat: [-3.5, 6.8], grad: [-3, 9.4],
    move: 'hover', pattern: ['fan', 'rings'], phases: [{ below: 0.5, pattern: ['fan', 'rings', 'nova'] }], hp: 300, type: 'Psychic', color: '#a78bfa',
    intro: '“Let us begin with the fundamentals.” The Chair fans objections: sidestep through the gaps.',
    beaten: 'Prof. Strix: “Satisfactory. More than satisfactory.” (sits down, takes notes)',
    Q: [
      { q: 'Where did you do your undergrad, and in what?', right: 'Tsinghua University, CS&T, 2021–2025', wrong: ['The lotus pond, informally', 'YouTube, mostly'] },
      { q: 'What is the status of TritonGym?', right: 'Under review, ICML 2026', wrong: ['Best paper, obviously', 'Accepted in my heart'] },
      { q: 'Where was (Re)²H₂O published?', right: 'IEEE Intelligent Vehicles Symposium (IV), 2023', wrong: ['A chemistry journal', 'The fridge door'] },
      { q: 'Who is your advisor?', right: 'Prof. Yufei Ding', wrong: ['Reviewer #2', 'Bit, the companion'] },
    ],
  },
  {
    id: 'fn-systems', name: 'Dr. Barn · Systems', short: 'Dr. Barn', seat: [0, 6.8], grad: [0, 9.4],
    move: 'lumber', pattern: ['volley', 'summon'], phases: [{ below: 0.5, pattern: ['volley', 'summon', 'charge'] }], minion: 'fn-followup', hp: 320, type: 'Electric', color: '#2dd4bf',
    intro: '“I have follow-up questions. They have follow-up questions.” It walks at you and throws fireballs.',
    beaten: 'Dr. Barn: “Your internships check out. All six of them.”',
    Q: [
      { q: 'Where did you build a CXL system simulator for large-model communication?', right: 'Picasso Lab, UC San Diego CSE', wrong: ['Metabit', 'In a dream, once'] },
      { q: 'Summer 2026, architecture for agentic AI workloads. Where?', right: 'Samsung Semiconductor, San Jose', wrong: ['Disney+ Hotstar', 'Down here, in secret'] },
      { q: 'The AskAI assistant on Redis and RocketMQ analysed…', right: 'Sales data (ByteDance Lark)', wrong: ['Monster Hunter loot tables', 'This committee’s moods'] },
      { q: 'Voice-controlled teammates were for…', right: 'Monster Hunter mobile (TiMi Studio)', wrong: ['This committee', 'The Hotstar search page'] },
      { q: 'At Metabit, what did you speed up?', right: 'Data parsing, plus streaming reads', wrong: ['The coffee machine', 'The stock market'] },
      { q: 'At Disney+ Hotstar you fine-tuned a recommendation model for…', right: 'TPUs', wrong: ['Toasters', 'The CXL switch'] },
    ],
  },
  {
    id: 'fn-external', name: 'Dr. Tawny · External Member', short: 'Dr. Tawny', seat: [3.5, 6.8], grad: [3, 9.4],
    move: 'blink', pattern: ['nova', 'charge'], phases: [{ below: 0.5, pattern: ['nova', 'charge', 'rings'] }], hp: 320, type: 'Dark', color: '#fb923c',
    intro: '“I am from the Department of Owls. What is a ‘kernel’?” It blinks around, rings of orbs, then charges (watch the red circle).',
    beaten: 'Dr. Tawny: “I understood about half of that. The good half. Pass.”',
    Q: [
      { q: 'Starry-Next, your graduation project, is written in…', right: 'Rust', wrong: ['Verilog', 'LaTeX'] },
      { q: 'What does CST-OJ judge?', right: 'Data-structure coursework', wrong: ['Cooking contests', 'This defense'] },
      { q: 'The IM System talks over…', right: 'WebSocket (Django + TypeScript)', wrong: ['Carrier pigeon', 'Fax'] },
      { q: 'Which of these is on your skills list?', right: 'Verilog', wrong: ['COBOL', 'Interpretive dance'] },
      { q: 'Which editor is on your CV?', right: 'Vim', wrong: ['Notepad', 'A napkin and a pen'] },
      { q: 'Who is the best cook in the building?', right: 'Zhuo Chen, roommate and labmate', wrong: ['The committee', 'The microwave'] },
    ],
  },
];
const WRONG_LINES = ['“Interesting. Wrong, but interesting.”', '“Let us… circle back to that.”', '“I will note that in the minutes.”', '“Bold. Incorrect, but bold.”'];

export default {
  id: 'finale',
  name: 'The Defense',
  subtitle: 'Deep in the Stacks · the committee is in session',
  size: 48,
  spawn: [0, 16],
  sky: SKY,
  zones: {
    ring: { x: C.x, z: C.z, r: C.r, label: 'The ring (step out to pause)' },
    table: { x: 0, z: 6, r: 4, label: 'The committee table' },
    lectern: { x: LECTERN.x, z: LECTERN.z, r: 3, label: 'The lectern' },
    screen: { x: 0, z: -15, r: 3, label: 'The projector screen' },
    lawn: { x: 0, z: 13, r: 6, label: 'The lawn (Sun God on loan)' },
  },

  build(ctx) {
    for (const [name, art] of Object.entries(FINALE_ART)) registerArt(name, art, FINALE_GLOW[name] || null);
    const st = ctx.state;
    let lastT = 0;
    const rate = {};
    const every = (k, s) => { if (lastT - (rate[k] ?? -1e9) < s) return false; rate[k] = lastT; return true; };
    const lp = (x, z) => Math.hypot(ctx.player.x - x, ctx.player.z - z);
    const inRing = () => lp(C.x, C.z) < C.r + 0.5;
    const dev = new URLSearchParams(location.search).get('region') === 'finale';

    // ================================================================ terrain and scenery
    terrain(ctx, { size: 48, height: heightAt, type: typeAt, palette: PALETTE, skirt: 8 });
    const D = [], G = [];
    const put = (list, x, y, z, c, g = 0) => list.push([x, y, z, c, g]);
    // the projector screen with a title slide: a title bar, a subtitle and 13 little squares
    for (let x = -8; x <= 8; x++) for (let y = 4; y <= 11; y++) {
      let c = '#e0f2fe', g = 0.9;
      if (y === 10 && Math.abs(x) <= 6) { c = '#1e3a8a'; g = 0.3; }
      else if (y === 8 && Math.abs(x) <= 4) { c = '#7c3aed'; g = 0.5; }
      else if (y === 6 && x >= -6 && x <= 6) { c = hasItem(ROAD[(x + 6)]?.id) ? '#fbbf24' : '#94a3b8'; g = 0.8; }
      put(G, x, y, -15.45, c, g);
    }
    for (let x = -9; x <= 9; x++) put(G, x, 13, -15.5, '#fbbf24', 1.2);
    // the committee table: water glasses, name cards
    for (const [x] of MEMBERS.map((m) => m.seat)) { put(G, x - 0.6, 3.6, 5, '#67e8f9', 0.8); put(D, x + 0.6, 3.5, 4.6, '#f8fafc'); }
    // chandeliers over the ring, lamps along the wall
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; put(G, C.x + Math.cos(a) * 6, 15, C.z + Math.sin(a) * 6, '#fde68a', 2.2); put(D, C.x + Math.cos(a) * 6, 16, C.z + Math.sin(a) * 6, '#44403c'); }
    for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; const x = Math.round(Math.cos(a) * 19), z = Math.round(Math.sin(a) * 19); if (z > 0 && Math.abs(x) < 7) continue; put(G, x, 8, z, '#f59e0b', 1.6); }
    // answer stands
    const stands = [];
    ANS.forEach(([x, z], i) => { put(D, x, 2.6, z, '#57534e'); stands.push([x, 3.1, z, ['#f87171', '#60a5fa', '#34d399'][i], 1]); });
    // the lawn: a hedge line and two lamps
    for (let x = -7; x <= 7; x++) if (Math.abs(x) > 1) put(D, x, 2.7, 9, hash3(x, 1, 9) < 0.5 ? '#166534' : '#15803d');
    for (const x of [-6, 6]) { for (let y = 3; y <= 5; y++) put(D, x, y, 15, '#1f2937'); put(G, x, 6, 15, '#fde68a', 2.4); }
    props(ctx, D, { shadow: false });
    const glowMesh = props(ctx, G, { shadow: false });
    const standMesh = props(ctx, stands, { shadow: false });

    // ================================================================ the committee
    registerEnemyKind('fn-followup', { name: 'Follow-up Question', sprite: 'fn-followup', hp: 14, speed: 5, dmg: 5, type: 'Psychic', xp: 5, gold: 4, behaviour: 'swarm', scale: 0.15, respawn: false, color: '#c4b5fd' });
    const F = { phase: 'idle', active: null, pose: 'seat', silT: 0, gradT: -1, right: 0, wrong: 0 };
    const QS = { m: null, q: null, answers: null, t: 0, cd: 5, shown: -1 };
    for (const m of MEMBERS) {
      const b = spawnBoss(ctx, {
        id: `finale-${m.id}`, name: m.name, sprite: m.id, scale: 0.3, x: m.seat[0], z: m.seat[1], hp: m.hp, type: m.type, r: 1.4,
        move: m.move, pattern: m.pattern, phases: m.phases, minion: m.minion, color: m.color, contact: 10, speed: 1.5, aggro: 0,
        reward: { gold: 300, xp: 120 }, respawn: false,
        onDefeat: () => memberDown(m),
      });
      m.boss = b;
      m.qi = Math.floor(ctx.rand() * m.Q.length);
      const up = b.update.bind(b), hit = b.hit.bind(b);
      m.rawHit = hit;
      b.update = (dt) => { if (F.active !== b || !b.alive) { park(m); return; } b.cfg.aggro = inRing() ? 40 : 0; up(dt); b.name = QS.m === m ? `${m.name} · asking…` : m.name; };
      b.hit = (dmg, info) => {
        if (F.active !== b) { if (every('turn', 6)) toast('Not their turn. The committee speaks one owl at a time.', { icon: 'conversation' }); return false; }
        return hit(dmg, info);
      };
    }
    const exp = spawnBoss(ctx, {
      id: 'finale-experiment', name: 'One More Experiment', sprite: 'fn-experiment', scale: 0.34, x: C.x, z: C.z - 1, hp: 420, type: 'Electric', r: 1.6,
      move: 'static', pattern: ['nova', 'rings', 'summon', 'rings'], minion: 'fn-followup', color: '#4ade80', contact: 10, aggro: 0,
      reward: { gold: 500, xp: 200 }, respawn: false, onDefeat: () => experimentDone(),
    });
    exp.alive = false; exp.mesh.visible = false; exp.respawnAt = Infinity;
    const expUp = exp.update.bind(exp), expHit = exp.hit.bind(exp);
    exp.update = (dt) => { if (F.phase !== 'exp' || !exp.alive) { exp.mesh.visible = false; return; } exp.cfg.aggro = inRing() ? 40 : 0; expUp(dt); };
    exp.hit = (dmg, info) => (F.phase === 'exp' ? expHit(dmg, info) : false);

    function park(m) {
      const b = m.boss;
      const [x, z] = F.pose === 'grad' ? m.grad : m.seat;
      b.x = x + ctx.ox; b.z = z + ctx.oz; b.y = ctx.surfaceY(x, z);
      b.mesh.position.set(b.x, b.y + (F.pose === 'grad' ? Math.abs(Math.sin(lastT * 5 + x)) * 0.35 : 0), b.z);
      b.mesh.rotation.y = F.pose === 'grad' ? 0 : Math.PI;
      b.mesh.visible = true;
    }
    function startDefense() {
      if (F.phase !== 'idle') return;
      F.phase = 'silence'; F.silT = 4.5; F.right = 0; F.wrong = 0;
      cinematic(ctx, { x: 0, y: 4, z: 6.8, yaw: Math.PI, pitch: 0.25, dist: 11, seconds: 3.5 });
    }
    function nextPhase() {
      if (!['silence', 'member', 'between'].includes(F.phase)) return;
      const m = MEMBERS.find((q) => q.boss.alive);
      if (m) { startMember(m); return; }
      startExperiment();
    }
    function startMember(m) {
      const b = m.boss;
      F.phase = 'member'; F.active = b;
      b.hx = C.x + ctx.ox; b.hz = C.z + ctx.oz; b.x = b.hx; b.z = b.hz;
      b.nextAttack = clock.t + 2500;
      QS.cd = 6; QS.m = null;
      fx.burst(b.x, b.y + 2, b.z, m.color, 24, 6, 0.7, 0.8);
      sfx('encounter');
      banner(m.short, m.intro, 'conversation');
    }
    function memberDown(m) {
      endQuestion(true);
      if (F.active === m.boss) F.active = null;
      m.boss.hx = m.seat[0] + ctx.ox; m.boss.hz = m.seat[1] + ctx.oz;
      toast(m.beaten, { icon: 'check', tone: 'good' });
      F.phase = 'between';
      setTimeout(nextPhase, 2600);
    }
    function startExperiment() {
      F.phase = 'exp'; F.active = null;
      banner('“…one more experiment.”', 'Prof. Strix: “Wonderful. Before we sign, just one more experiment.” Survive the run; hits make it finish sooner.', 'hourglass');
      sfx('boom');
      findExperiment();
      exp.revive();
      exp.mesh.visible = true;
      fx.burst(exp.x, exp.y + 2, exp.z, '#4ade80', 30, 7, 0.8, 0.9);
    }
    function experimentDone() {
      F.phase = 'verdict';
      banner('“It… works? It works.”', 'The experiment finished. The committee confers in whispers.', 'check');
      if (F.wrong === 0 && F.right >= 3) findPerfect();
      setTimeout(graduate, 2600);
    }

    // ---- questions at the answer stands
    const standIts = ANS.map(([x, z], i) => {
      const it = interactable(ctx, { x, z, r: 1.7, label: '—', prompt: 'E · answer', plateY: 2.4, onInteract: () => answer(i) });
      it.enabled = false;
      return it;
    });
    function ask(m) {
      const q = m.Q[m.qi++ % m.Q.length];
      const answers = [q.right, ...q.wrong].sort(() => ctx.rand() - 0.5);
      Object.assign(QS, { m, q, answers, t: 12, shown: -1 });
      m.boss.nextAttack = Infinity;
      m.boss.clearHazards();
      standIts.forEach((it, i) => { it.enabled = true; it.setLabel(`${'ABC'[i]} · ${answers[i]}`); });
      sfx('rune');
      banner(`${m.short} asks:`, q.q, 'conversation');
      if (!st.askedOnce) { st.askedOnce = true; ctx.save(); toast('A question! Walk to the answer stand with the right answer and press E. Wrong answers cost nothing.', { icon: 'conversation' }); }
    }
    function endQuestion(silent = false) {
      if (!QS.m) return;
      const m = QS.m;
      QS.m = null;
      standIts.forEach((it) => { it.enabled = false; });
      standMesh.userData.setHi(0);
      if (!silent && m.boss.alive) m.boss.nextAttack = clock.t + 1500;
      QS.cd = 11;
    }
    function answer(i) {
      if (!QS.m) return;
      const { m, q, answers } = QS;
      if (answers[i] === q.right) {
        F.right++;
        sfx('stamp');
        toast(`Correct: ${q.right}. ${m.short} nods slowly.`, { icon: 'check', tone: 'good' });
        endQuestion();
        m.rawHit(Math.ceil(m.boss.maxHp * 0.2));
      } else {
        F.wrong++;
        sfx('error');
        toast(`${m.short}: ${WRONG_LINES[F.wrong % WRONG_LINES.length]} (It was: ${q.right}. No harm done.)`, { icon: 'conversation' });
        endQuestion();
      }
    }

    // ---- the lectern, the slides, "Any questions?"
    const silence = () => ({
      text: 'Last slide: “Thank you! Any questions?”',
      choices: [{ label: '(wait)', next: () => ({
        text: '…',
        note: '(The projector fan hums.)',
        choices: [{ label: '(keep waiting)', next: () => { findSilence(); return {
          text: '… …',
          note: '(Somebody’s laptop fan spins up. The external member is reading your CV, visibly for the first time.)',
          choices: [{ label: '(smile confidently)', next: {
            text: 'Prof. Strix: “…Well. I have a few.” Dr. Barn: “I have several.” Dr. Tawny: “What is a GPU?”',
            choices: [{ label: 'Bring it on', icon: 'crossed-swords', action: () => startDefense() }],
          } }],
        }; } }],
      }) }],
    });
    const lecternNode = () => {
      if (F.phase !== 'idle') return { text: 'The defense is in progress. The lectern is not a hiding place. (Stepping out of the ring is, though.)', choices: [{ label: 'Back to it' }] };
      if (st.graduated) {
        return {
          text: 'Your slides are still loaded. The committee looks… hopeful?',
          choices: [
            { label: 'Defend again (New Game+)', icon: 'crossed-swords', next: () => { resetDefense(); return silence(); } },
            { label: 'Roll the credits', icon: 'scroll-text', action: () => openCredits() },
            { label: 'Leave' },
          ],
        };
      }
      const got = ROAD.filter((r) => hasItem(r.id)).length;
      return {
        text: `Your slides are loaded: 41 slides, plus 56 backup slides. Road to Dr.: ${got} / ${ROAD.length}.${got < ROAD.length ? ' (The committee lets it slide, this once.)' : ''} Ready?`,
        note: 'Tip: questions appear during the fight. Answer at the three stands (A, B, C). Step out of the ring any time to pause.',
        choices: [{ label: 'Begin the defense', icon: 'graduation-cap', next: silence }, { label: 'Not yet' }],
      };
    };
    interactable(ctx, { x: LECTERN.x, z: LECTERN.z + 1.4, r: 2.2, label: 'The lectern', prompt: 'E · present', onInteract: () => dialog(lecternNode, { name: 'The lectern', sprite: 'book' }) });
    const slideNode = () => ({
      text: 'Slide 1 of 41: “Road to Dr.: a diploma, six badges, four relics, two seals.” A squared-off chart of thirteen boxes, glowing where they are earned.',
      choices: [
        { label: 'Skip to the backup slides', next: () => { findSlides(); return { text: 'Backup slides 42 to 97: every experiment you ran, every experiment you did not, and one slide that just says “one more experiment?”. They will not be needed. (They will be needed.)', choices: [{ label: 'Back', next: slideNode }, { label: 'Close' }] }; } },
        { label: 'Close' },
      ],
    });
    interactable(ctx, { x: 0, z: -13.8, r: 2.4, label: 'Projector screen', prompt: 'E · read the slide', plateY: 10, onInteract: () => dialog(slideNode, { name: 'Projector', sprite: 'book' }) });
    interactable(ctx, { x: -10, z: 13, r: 2.6, label: 'The Sun God (on loan)', prompt: 'E · look', sprite: 'sungod', spriteScale: 0.2, plateY: 4.2, onInteract: () => {
      findSunGod();
      dialog({ text: 'The Sun God, borrowed from its lawn at UC San Diego for the occasion. Graduation photos with it are traditional. It is grinning. It is always grinning.', choices: [{ label: 'Grin back' }] }, { name: 'Sun God', sprite: 'sungod' });
    } });

    // ---- Paws, the graduate coordinator
    spawnNpc(ctx, {
      id: 'finale-paws', name: 'Paws · graduate coordinator', sprite: 'fn-coord', x: 6.5, z: 12, face: -0.6,
      news: () => !st.metPaws,
      talk: () => {
        st.metPaws = true; ctx.save();
        const got = ROAD.filter((r) => hasItem(r.id)).length;
        return {
          text: st.graduated
            ? 'Doctor! (Honorary.) All your forms are filed. The committee asks whether you would like to defend again. They enjoyed it. They will not say so.'
            : `Hi! Graduate coordinator. I have your forms: ${got} of ${ROAD.length} signatures on the Road to Dr. A diploma, six badges, four relics, two seals.`,
          choices: [
            { label: 'How does the defense work?', next: () => { findForms(); return { text: 'Present at the lectern by the screen. Then the committee asks, one owl at a time. Answer at the three stands (walk up, press E), or duel them politely. Step out of the ring to catch your breath: they wait. Nobody fails. Worst case you wake up on the lawn and try again.', choices: [{ label: 'Nobody fails. Got it' }] }; } },
            { label: 'What happens after?', next: { text: 'Caps. Confetti. Fireworks. A title, Dr. (Honorary): a game joke, handed out by three owls. Credits. Then the whole world stays open: New Game+.', choices: [{ label: 'Caps and confetti' }] } },
            { label: 'Could I have a snack?', icon: 'health-potion', action: () => { heal(9999); sfx('heal'); say('finale-paws', 'Committee cookies. Technically for the committee. Technically.'); } },
            ...(st.graduated ? [{ label: 'Roll the credits', icon: 'scroll-text', action: () => openCredits() }] : []),
            { label: 'Bye' },
          ],
        };
      },
    });

    // ================================================================ graduation: caps, confetti, fireworks
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _c = new THREE.Color();
    const NCONF = 160;
    const conf = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.05, 0.14), new THREE.MeshBasicNodeMaterial(), NCONF);
    conf.frustumCulled = false; conf.castShadow = false; conf.count = 0;
    const CONF_COL = ['#f43f5e', '#fbbf24', '#22d3ee', '#a78bfa', '#4ade80', '#f8fafc', '#fb923c'];
    const bits = Array.from({ length: NCONF }, (_, i) => ({ x: 0, y: 0, z: 0, vy: 0, a: 0, s: 0, i }));
    for (let i = 0; i < NCONF; i++) conf.setColorAt(i, _c.set(CONF_COL[i % CONF_COL.length]));
    ctx.group.add(conf);
    const caps = [];
    let confT = 0, fireT = 0, fireworks = 0;
    function capFor(x, z, y) { const g = sprite(ctx, 'fn-cap', { x, z, y, scale: 0.13 }); g.visible = false; return g; }
    function throwCaps() {
      findCap();
      sfx('achievement');
      const who = [[ctx.player.x, ctx.player.z, ctx.player.y + 3.1], ...MEMBERS.map((m) => [m.grad[0], m.grad[1], ctx.surfaceY(...m.grad) + 4.6])];
      who.forEach(([x, z, y], i) => {
        const g = caps[i] || (caps[i] = capFor(x, z, y));
        g.position.set(x + ctx.ox, y, z + ctx.oz);
        g.visible = true;
        g.userData.v = { vy: 13 + i * 0.8, vx: (ctx.rand() - 0.5) * 2, vz: (ctx.rand() - 0.5) * 2, spin: 6 + ctx.rand() * 4, t: 0 };
      });
      startConfetti();
    }
    function startConfetti() {
      confT = 14; fireworks = 12; fireT = 0.3;
      for (const b of bits) { b.x = (ctx.rand() - 0.5) * 22; b.z = 12 + (ctx.rand() - 0.5) * 14; b.y = 14 + ctx.rand() * 14; b.vy = 2 + ctx.rand() * 2; b.a = ctx.rand() * 6; b.s = 1 + ctx.rand() * 2; }
      conf.count = NCONF;
    }
    let myCap = null;
    function graduate() {
      if (F.phase === 'grad') return;
      F.phase = 'grad'; F.active = null;
      endQuestion(true);
      exp.clearHazards();
      for (const m of MEMBERS) m.boss.clearHazards();
      st.graduated = true; st.defenses = (st.defenses || 0) + 1; ctx.save();
      S.world.title = 'Dr. (Honorary)'; save();
      banner('The committee deliberates…', 'Please wait in the hallway. It is a very short hallway.', 'hourglass');
      setTimeout(() => {
        F.pose = 'grad';
        travel('finale', [0, 12.6]).then(() => ceremony());
      }, 2400);
    }
    function ceremony() {
      F.gradT = 0;
      setSky(GRAD_SKY);
      cinematic(ctx, { x: 0, y: 4, z: 11, yaw: Math.PI, pitch: 0.22, dist: 12, seconds: 4 });
      myCap = myCap || capFor(ctx.player.x, ctx.player.z, ctx.player.y + 3);
      myCap.visible = true;
      sfx('victory');
      say('finale-paws', 'All thirteen signatures. The forms are… complete?!');
    }
    function ceremonyTick(dt) {
      if (F.gradT < 0) return;
      const t0 = F.gradT;
      F.gradT += dt;
      const at = (s) => t0 < s && F.gradT >= s;
      if (myCap?.visible && F.gradT < 4) myCap.position.set(player.x, player.y + 3.05, player.z);
      if (at(1.4)) {
        banner('Congratulations, Dr. Lin', 'Dr. (Honorary): a title awarded by three owls in a video game. In real life: a Ph.D. student at UC San Diego, advised by Prof. Yufei Ding.', 'graduation-cap');
        findDr(); installDrTitle();
        toast('Prof. Strix: “Congratulations, Doctor.” Dr. Barn: “Doctor.” Dr. Tawny: “What is a doctor?”', { icon: 'conversation' });
      }
      if (at(4.2)) { if (myCap) myCap.visible = false; say('me', 'Caps off!'); throwCaps(); }
      if (at(6)) say('bit', 'Dr. Bit, too? No? Honorary Bit?');
      if (at(11)) { F.gradT = -1; F.phase = 'idle'; openCredits(); }
    }

    // ================================================================ the credits roll (the real CV)
    const CREDITS = [
      ['', ['YICHEN’S WORLD', 'a game about a CV']],
      ['Starring', ['Yichen Lin as the Scholar', 'Bit as Bit', 'Zhuo Chen as himself (best cook in the building)']],
      ['Education', ['UC San Diego · Ph.D., Computer Science and Engineering · 2025 – present', 'Advisor: Prof. Yufei Ding', 'Tsinghua University · B.S., Computer Science and Technology · 2021 – 2025']],
      ['Publications', [
        'TritonGym: A Benchmark for Agentic LLM Workflows in Triton GPU Code Generation',
        'Yue Guan*, Yichen Lin*, et al. (* equal contribution) · under review, ICML 2026',
        '(Re)²H₂O: Autonomous Driving Scenario Generation via Reversely Regularized Hybrid Offline-and-Online Reinforcement Learning',
        'Haoyi Niu*, Kun Ren*, Yichen Lin, et al. · IEEE Intelligent Vehicles Symposium (IV), 2023',
      ]],
      ['Experience', [
        'Samsung Semiconductor · summer research intern, San Jose · Jun – Sep 2026',
        'Architecture for agentic AI workloads: runtime optimizations for agent pipelines, simulating how future accelerators should support agent workloads, an agentic test-debug framework prototype for MLOps',
        'Picasso Lab, UC San Diego CSE · research intern · Mar 2024 – Feb 2025',
        'A CXL system simulator for large-model communication; lab websites; a RAG pipeline for reading papers',
        'Metabit · quantitative developer intern · Sep – Nov 2024',
        'Faster data parsing and streaming reads for the internal AI platform',
        'Tencent, TiMi Studio · game developer intern · Jun – Jul 2024',
        'The Monster Hunter mobile client, with voice-controlled teammates',
        'Disney+ Hotstar · algorithm developer intern · Mar – Jun 2024',
        'The search page, and a recommendation model fine-tuned for TPUs',
        'ByteDance, Lark · backend developer intern · Jun – Nov 2023',
        'The AskAI assistant for sales-data analysis, on Redis and RocketMQ',
      ]],
      ['Projects', [
        'Starry-Next · a networking stack for a monolithic-kernel OS, in Rust (graduation project)',
        'IM System · real-time chat over WebSocket, with Django and TypeScript',
        'CST-OJ · an online judge for data-structure coursework, in Rust: sandboxed grading, a submission queue',
        'TritonGym · the benchmark harness for LLM agents that write Triton GPU kernels',
      ]],
      ['Skills', ['Python · C++ · Rust · Go · TypeScript · JavaScript · Verilog', 'Linux · Vim · LaTeX · WebSocket · Django · MongoDB']],
      ['The committee', ['Prof. Strix, Dr. Barn and Dr. Tawny as themselves', '(original owls; no real committee was consulted)', 'Paws as the graduate coordinator', 'Quire, Rebutta and SCENE-GEN, down in the Stacks', 'Reviewer 3 (confidence 5)', 'Reviewer #2 (uncredited, as always)']],
      ['On location', ['UC San Diego: Geisel Library (named for Dr. Seuss), the Sun God, King Triton, Fallen Star, the Snake Path, Scripps pier, the Torrey Pines gliders, the sea lions (unpaid) · Fiat lux', 'Tsinghua University: 二校门, 清华学堂, 大礼堂, 荷塘月色 · 自强不息，厚德载物']],
      ['Contact', ['yil384@ucsd.edu']],
      ['', ['Built with three.js · no frameworks · no build step']],
      ['', ['The Dr. (Honorary) title is a game joke.', 'The real Yichen is a Ph.D. student. Back to work.']],
    ];
    function openCredits() {
      let raf = 0, pauseUntil = 0, last = 0, done = false;
      const roll = h('div', { style: { textAlign: 'center', padding: '44% 8px 8px' } });
      CREDITS.forEach(([head, lines], k) => {
        const sec = h('div', { style: { margin: '0 0 30px' } });
        if (head) sec.append(h('div', { style: { color: '#fbbf24', letterSpacing: '0.18em', textTransform: 'uppercase', fontSize: '12px', fontWeight: '700', margin: '0 0 8px' } }, head));
        lines.forEach((l, i) => sec.append(h('div', { style: k === 0 && i === 0 ? { fontSize: '26px', fontWeight: '800', letterSpacing: '0.06em' } : { fontSize: '14px', lineHeight: '1.5', margin: '0 0 4px', opacity: head && i % 2 && (head === 'Experience' || head === 'Publications') ? '0.72' : '1' } }, l)));
        roll.append(sec);
      });
      const end = h('div', { style: { padding: '8px 0 40%' } },
        h('div', { style: { fontSize: '28px', fontWeight: '800', letterSpacing: '0.08em', color: '#fbbf24' } }, 'Thanks for playing'),
        h('p', { style: { fontSize: '13px', opacity: '0.8', margin: '10px auto 0', maxWidth: '460px' } }, 'New Game+: the world stays open. Bosses return, eggs keep hiding, and the committee reconvenes at the lectern whenever you like. Your title stays.'));
      roll.append(end);
      const view = h('div', { style: { height: 'min(56vh, 460px)', overflowY: 'auto', scrollbarWidth: 'none', maskImage: 'linear-gradient(transparent, #000 14%, #000 86%, transparent)', WebkitMaskImage: 'linear-gradient(transparent, #000 14%, #000 86%, transparent)' } }, roll);
      const hold = () => { pauseUntil = performance.now() + 2500; };
      view.addEventListener('wheel', hold, { passive: true });
      view.addEventListener('touchstart', hold, { passive: true });
      const finish = () => { if (!done) { done = true; findCredits(); } };
      const close = () => { cancelAnimationFrame(raf); closeModal('fn-credits'); };
      const handle = openModal({
        id: 'fn-credits', title: 'Credits', className: 'wide-panel', dismissible: false,
        onClose: () => cancelAnimationFrame(raf),
        onKey: (e) => { if (e.key === 'Escape') { close(); return true; } return false; },
        body: (b) => b.append(view, h('div', { class: 'modal__actions', style: { justifyContent: 'center' } },
          h('button', { type: 'button', class: 'btn btn--primary', 'data-credits': 'page', onclick: () => { finish(); close(); window.__g?.exitPlay?.(); } }, 'Back to the page'),
          h('button', { type: 'button', class: 'btn', 'data-credits': 'roam', onclick: () => { finish(); close(); toast('Free roam: the world is yours. The committee reconvenes at the lectern whenever you like.', { icon: 'treasure-map', tone: 'gold' }); } }, 'Keep exploring'),
          h('button', { type: 'button', class: 'btn', 'data-credits': 'skip', onclick: () => { view.scrollTop = view.scrollHeight; finish(); } }, 'Skip to the end'),
        )),
      });
      const tick = (now) => {
        if (!handle.isOpen()) return;
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
        last = now;
        if (now > pauseUntil) view.scrollTop += dt * 38;
        if (view.scrollTop + view.clientHeight >= view.scrollHeight - 2) finish();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    // ================================================================ eggs
    const findSilence = egg('finale-silence', 'Any questions?', 'Finish your talk and wait.', 'The loudest silence in academia. Then: “I have a few.”');
    const findSlides = egg('finale-backup', 'Backup slides', 'Read the projector screen, all the way to the back.', 'Slides 42 to 97. They will not be needed. (They will be needed.)');
    const findSunGod = egg('finale-sungod', 'Photo with the Sun God', 'Something is grinning on the lawn.', 'The Sun God, on loan from UC San Diego for graduation photos.');
    const findForms = egg('finale-forms', 'Thirteen signatures', 'Ask the graduate coordinator how the defense works.', 'A diploma, six badges, four relics, two seals. Forms: complete.');
    const findExperiment = egg('finale-experiment', 'One more experiment', 'Survive the defense until someone asks for “just one more experiment”.', 'There is always one more experiment.');
    const findPerfect = egg('finale-perfect', 'Knew the CV by heart', 'Answer at least three committee questions right, and none wrong.', 'Degrees, papers, jobs, projects: every answer from the CV.');
    const findDr = egg('finale-dr', 'Dr. (Honorary)', 'Pass the Defense.', 'A game title, handed out by three owls. In real life: Ph.D. student, UC San Diego CSE.');
    const findCap = egg('finale-cap', 'Caps off', 'Graduate.', 'Caps in the air, confetti everywhere, fireworks over the lawn.');
    const findCredits = egg('finale-credits', 'Thanks for playing', 'Watch the credits to the end.', 'The whole CV, rolling. Thanks for playing!');

    // ================================================================ portals, arrival
    portal(ctx, { x: -3.8, z: 19.6, to: 'stacks', at: [0, -21.4], label: 'Back to the Stacks', color: '#fbbf24' });
    portal(ctx, { x: 3.8, z: 19.6, to: 'hub', label: 'Back to UC San Diego' });
    let introAt = -1e9;
    trigger(ctx, { x: C.x, z: C.z, r: C.r, onEnter: () => {
      if (F.phase === 'idle' && !st.graduated && lastT - introAt > 90) { introAt = lastT; toast('The ring. It is quiet now. Present at the lectern (by the screen) to begin.', { icon: 'graduation-cap' }); }
    }, onLeave: () => { if (['member', 'exp'].includes(F.phase) && every('pause', 8)) toast('Out of the ring: the committee waits. Catch your breath; come back in when ready.', { icon: 'hourglass' }); } });
    on('respawn', () => { if (ctx.live) endQuestion(true); });

    function resetDefense() {
      for (const m of MEMBERS) {
        m.boss.hx = m.seat[0] + ctx.ox; m.boss.hz = m.seat[1] + ctx.oz;
        if (!m.boss.alive) m.boss.revive();
        m.boss.hp = m.boss.maxHp; m.boss.clearHazards();
      }
      exp.alive = false; exp.mesh.visible = false; exp.respawnAt = Infinity;
      Object.assign(F, { phase: 'idle', active: null, pose: 'seat', gradT: -1 });
      for (const g of caps) g.visible = false;
      conf.count = 0; confT = 0;
      setSky(SKY);
    }
    // a page reload mid-defense: members already beaten stay beaten (bossKills); a finished defense
    // (graduated) starts fresh when you choose to defend again
    if (st.graduated) { F.pose = 'seat'; }
    ctx.debug = {
      F, QS, MEMBERS, exp, answer, startDefense, openCredits, resetDefense,
      right: () => (QS.m ? QS.answers.indexOf(QS.q.right) : -1),
      ask: () => { const m = MEMBERS.find((q) => q.boss === F.active); if (m) ask(m); },
    };

    // ================================================================ per frame
    onUpdate(ctx, (dt, t) => {
      lastT = t;
      glowMesh.userData.setHi(0.2 + 0.12 * Math.sin(t * 1.7));
      // the awkward silence
      if (F.phase === 'silence') {
        const s0 = F.silT;
        F.silT -= dt;
        for (const k of [3.6, 2.4, 1.2]) if (s0 > k && F.silT <= k) { const m = MEMBERS[Math.round((3.6 - k) / 1.2)]; fx.text(m.boss.x, m.boss.y + 3.4, m.boss.z, '…', 'info'); }
        if (F.silT <= 0) { F.phase = 'between'; nextPhase(); }
      }
      // questions during a member's turn
      if (F.phase === 'member' && F.active) {
        const m = MEMBERS.find((q) => q.boss === F.active);
        if (m && m.boss.alive) {
          if (!inRing()) { if (QS.m) endQuestion(); QS.cd = Math.max(QS.cd, 4); }
          else if (!QS.m) { QS.cd -= dt; if (QS.cd <= 0) ask(m); }
          else {
            QS.t -= dt;
            const secs = Math.ceil(QS.t);
            if (secs !== QS.shown) {
              QS.shown = secs;
              standIts.forEach((it, i) => it.setLabel(`${'ABC'[i]} · ${QS.answers[i]}  (${Math.max(0, secs)})`));
              if (secs <= 3 && secs > 0) sfx('tick');
            }
            standMesh.userData.setHi(0.5 + 0.5 * Math.sin(QS.t * 7));
            if (QS.t <= 0) { toast(`${m.short}: “…Let us take that offline.” (It was: ${QS.q.right}.)`, { icon: 'conversation' }); endQuestion(); }
          }
        }
      }
      // one more experiment: it runs on its own while you are in the ring
      if (F.phase === 'exp' && exp.alive) {
        if (inRing()) { const drain = exp.maxHp * 0.022 * dt; if (exp.hp - drain <= 1) expHit(exp.hp + 1); else exp.hp -= drain; }
        const prog = 1 - Math.max(0, exp.hp) / exp.maxHp;
        exp.name = `One More Experiment · epoch ${Math.min(10, 1 + Math.floor(prog * 10))}/10 · ${Math.round(prog * 100)}%`;
      }
      // the ceremony
      ceremonyTick(dt);
      for (const g of caps) {
        if (!g.visible) continue;
        const v = g.userData.v;
        v.t += dt; v.vy -= 11 * dt;
        g.position.x += v.vx * dt; g.position.z += v.vz * dt; g.position.y += v.vy * dt;
        g.rotation.y += v.spin * dt; g.rotation.x = Math.sin(v.t * 5) * 0.5;
        if (g.position.y < 2.6 && v.vy < 0) { g.position.y = 2.6; v.vx = v.vz = v.spin = 0; g.rotation.x = 0; }
      }
      if (confT > 0) {
        confT -= dt;
        for (const b of bits) {
          b.y -= b.vy * dt; b.a += dt * b.s;
          if (b.y < 2.2) b.y = confT > 3 ? 20 + ctx.rand() * 6 : 2.2;
          _p.set(b.x + Math.sin(b.a) * 0.6 + ctx.ox, b.y, b.z + Math.cos(b.a * 0.7) * 0.6 + ctx.oz);
          _q.setFromEuler(_e.set(b.a, b.a * 1.3, 0));
          _m.compose(_p, _q, _s);
          conf.setMatrixAt(b.i, _m);
        }
        conf.instanceMatrix.needsUpdate = true;
        if (confT <= 0) conf.count = 0;
      }
      if (fireworks > 0) {
        fireT -= dt;
        if (fireT <= 0) {
          fireT = 0.55; fireworks--;
          const x = (ctx.rand() - 0.5) * 24 + ctx.ox, z = 4 + (ctx.rand() - 0.5) * 20 + ctx.oz;
          fx.burst(x, 18 + ctx.rand() * 6, z, ['#f43f5e', '#fbbf24', '#22d3ee', '#a78bfa', '#4ade80'][fireworks % 5], 26, 8, 1.1, 1.3);
          if (fireworks % 3 === 0) sfx('boom');
        }
      }
    });

    onEnter(ctx, () => {
      if (F.phase === 'grad' || F.pose === 'grad') return;
      setSky(SKY);
      const got = ROAD.filter((r) => hasItem(r.id)).length;
      if (!st.visited) {
        st.visited = true; ctx.save();
        setTimeout(() => say('bit', 'This is it. The Defense. Three owls, one lectern, zero pressure. (So much pressure.)'), 1200);
        cinematic(ctx, { x: 0, y: 4, z: 6.8, yaw: Math.PI, pitch: 0.3, dist: 16, seconds: 2.4 });
        banner('THE DEFENSE', 'Present at the lectern by the screen. The committee is waiting.', 'graduation-cap');
      }
      if (got < ROAD.length && (dev || mode.play)) setTimeout(() => toast(`Road to Dr.: ${got} / ${ROAD.length}. ${dev ? 'Developer entry: the committee lets it slide.' : 'The committee peers at your forms, then lets it slide.'}`, { icon: 'graduation-cap' }), 2400);
    });
    onLeave(ctx, () => {
      endQuestion(true);
      if (F.pose === 'grad' && F.phase === 'idle') { F.pose = 'seat'; for (const g of caps) g.visible = false; conf.count = 0; confT = 0; fireworks = 0; }
    });
  },
};
