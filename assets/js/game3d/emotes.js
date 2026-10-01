// Play-mode social toys: emotes (X, or the touch emote button), the islanders and the campus crowd
// reacting to them (and to being bumped into), and Bit's running commentary on what you get up to
// (bunny hops, spinning on the spot, dodging nothing, standing about). Nothing here changes stats or
// can hurt the player; every line is a joke. Under reduced motion the poses hold still.
//   index.js: createEmotes(...) once; emotes.onKey(e) before its own keys, emotes.update(dt) from the
//   play tick, emotes.pose() when it places the scholar, emotes.reset() when play ends.
import { on } from './bus.js';
import { clock } from './clock.js';
import { player } from './player.js';
import { buddy } from './companion.js';
import { npcs } from './npcs.js';
import { where, isLive } from './where.js';
import { mode } from './mode.js';
import { setArmPose, swinging } from './weapon.js';
import { liveTargets } from './combat.js';
import { sfx } from './audio.js';
import * as fx from './fx.js';
import { h } from './util.js';
import { registerEgg, found } from '../site/eggs.js';
import { reducedMotion } from '../three/boot.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const calm = () => reducedMotion.matches;
const TOUCH = matchMedia('(pointer: coarse)').matches;

const EMOTES = {
  wave: { label: 'Wave', glyph: 'o/', dur: 2.2, lines: ['Hi!', 'Hello there!', 'Hello! Welcome to the island.', 'Hi! Mind the seagulls.'] },
  dance: { label: 'Dance', glyph: '♪', dur: 4.4, lines: ['♪ Accepted, accepted ♪', 'This is my rebuttal dance.', 'Dancing like the deadline got extended.', '♪ Minor revisions ♪'] },
  think: { label: 'Think', glyph: '?', dur: 3.4, lines: ['What if the benchmark benchmarked the benchmark?', 'Could an agent write this kernel? A faster one?', 'Hmm. Is the bottleneck memory, or me?', 'What should a chip for agents look like?', 'If the harness is the product, what is the paper?'] },
  bow: { label: 'Bow', glyph: '\\o_', dur: 1.9, lines: ['Thank you, thank you.', 'Thank you, Reviewer #1.', 'Thanks for reading this far.'] },
};
const ORDER = ['wave', 'dance', 'think', 'bow'];

// what the islanders say back (hub ids); everyone else gets a generic line
const HELLO = {
  nell: 'Hoo. Hello, reader.', unit7: 'GREETING ACKNOWLEDGED. HELLO, HUMAN.', mo: 'Hi! Browsing is free.', tide: 'Ribbit. (That means hi.)',
  fern: 'Oh! Hello, sprout.', zhuo: 'Hey! Tomato and egg later?', ash: 'Hi! You are here. On the map, I mean.',
};
const DANCE = {
  nell: 'Hoo. Shh. This is a library.', unit7: 'RHYTHM DETECTED. JOINING.', mo: 'Nice moves. I do not sell shoes, sadly.', tide: 'Ribbit ribbit. (Encore.)',
  fern: 'Plants grow faster with music. Keep going.', zhuo: 'Dancing before dinner? Bold.', ash: 'Marking this spot on the map: "dance floor".',
};
const HELLO_ANY = ['Hi!', 'Oh, hello!', 'Hey there.', 'Hello, traveller.', '*waves back*'];
const DANCE_ANY = ['Nice moves!', 'Is this a conference afterparty?', 'Woo!', 'Somebody extended a deadline?'];
const BOW_ANY = ['Oh, very polite.', '*bows back*', 'Likewise, likewise.'];

const EGGS = [
  { id: 'social', name: 'Office hours', hint: 'Wave at five different islanders (emotes: X, or the o/ button).', done: 'Five islanders waved back. That counts as networking.' },
  { id: 'flashmob', name: 'Flash mob', hint: 'Dance where the students hang out.', done: 'Price Center will talk about this for weeks.' },
  { id: 'bunnyhop', name: 'Bunny hop', hint: 'Jump. Then keep jumping.', done: 'Bit filed a bug: "player will not stay on the ground".' },
  { id: 'dizzy', name: 'Gradient spin', hint: 'Turn round and round on the spot.', done: '720 degrees. The loss landscape looks the same from every side.' },
];

let director = null;
let lastBit = -1e9;
/** Bit says something, at most every ~9 s of game time unless `force`. */
export function bitSay(text, { force = false, ms = 4600 } = {}) {
  if (!director || !mode.play) return false;
  if (!force && clock.t - lastBit < 9000) return false;
  lastBit = clock.t;
  director.say('bit', text, ms);
  return true;
}

/**
 * @param {{ hudEl: HTMLElement, director, ambient, input, touch?: { el: HTMLElement } | null }} deps
 */
export function createEmotes({ hudEl, director: dir, ambient, input, touch = null }) {
  director = dir;
  for (const e of EGGS) registerEgg({ ...e, kind: 'game', src: 'world', region: 'hub', regionName: 'UC San Diego island' });

  // ---------------------------------------------------------------- the picker
  const picker = h('div', { class: 'emotes', role: 'toolbar', 'aria-label': 'Emotes', hidden: true },
    ...ORDER.map((id, i) => {
      const E = EMOTES[id];
      const b = h('button', { type: 'button', class: 'emotes__btn', 'data-emote': id, tabindex: '-1', 'aria-label': E.label },
        h('kbd', null, String(i + 1)), h('b', { 'aria-hidden': 'true' }, E.glyph), h('small', null, E.label));
      // pointerdown (not click): on phones the gesture surface under it would otherwise see the touch first
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); play(id); close(); });
      return b;
    }),
  );
  let btn = null;
  if (touch?.el) {
    btn = h('button', { type: 'button', class: 'touch__btn touch__btn--emote', 'aria-label': 'Emote', tabindex: '-1' }, h('b', null, 'o/'));
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); toggle(); });
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    picker.classList.add('emotes--touch');
    touch.el.append(btn, picker);
  } else hudEl.append(picker);
  let closeT = 0;
  function open() { picker.hidden = false; btn?.classList.add('is-down'); clearTimeout(closeT); closeT = setTimeout(close, 6000); }
  function close() { picker.hidden = true; btn?.classList.remove('is-down'); clearTimeout(closeT); }
  function toggle() { if (picker.hidden) open(); else close(); }
  on('pause', (p) => { if (p) close(); });

  // ---------------------------------------------------------------- playing an emote
  let cur = null;                // { id, t, dur, beat }
  let dizzy = 0;                 // seconds of wobble left
  const waved = new Set();
  function canEmote() { return mode.play && !player.dead && !player.vehicle && player.grounded && !swinging(); }
  function play(id) {
    if (!canEmote()) { if (player.vehicle) bitSay('Emotes are for pedestrians. Hop off first (V).', { force: true }); return false; }
    const E = EMOTES[id];
    cur = { id, t: 0, dur: E.dur, beat: -1 };
    director.say('me', pick(E.lines), id === 'think' ? 4200 : 3000);
    if (id === 'think') fx.text(player.x, player.y + 4.6, player.z, '?', 'info');
    sfx(id === 'dance' ? 'ring' : id === 'think' ? 'tick' : 'pop');
    reactIslanders(id);
    reactCrowd(id);
    return true;
  }
  function stop() { cur = null; setArmPose(null); }

  function reactIslanders(id) {
    const near = npcs.filter((n) => isLive(n.region) && Math.hypot(n.x - player.x, n.z - player.z) < 7.5)
      .sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z)).slice(0, 3);
    near.forEach((n, i) => {
      n.turnT = 3;
      setTimeout(() => {
        if (!mode.play || !isLive(n.region)) return;
        if (!calm()) n.hopT = 0.45;
        const key = HELLO[n.id] ? n.id : n.id.split('-').pop();     // tsinghua-zhuo is still Zhuo
        const line = id === 'dance' ? (DANCE[key] || pick(DANCE_ANY)) : id === 'bow' ? pick(BOW_ANY) : id === 'wave' ? (HELLO[key] || pick(HELLO_ANY)) : null;
        if (line) director.say(n.id, line, 3400);
      }, 450 + i * 550);
      if (id === 'wave' || id === 'bow') waved.add(n.id);
    });
    if (waved.size >= 5) found('social');
  }

  function reactCrowd(id) {
    if (where.id !== 'hub' || !ambient) return;
    if (id === 'dance') {
      const n = ambient.react(player.x, player.z, 9, 'dance', EMOTES.dance.dur, 14);
      if (n >= 3) {
        setTimeout(() => { if (mode.play) director.say('me', 'It\'s a flash mob!', 2600); }, 1400);
        if (found('flashmob')) bitSay('A flash mob! I have never been prouder.', { force: true });
      }
    } else if (id === 'wave' || id === 'bow') ambient.react(player.x, player.z, 8, 'wave', 1.8, 8);
    else ambient.react(player.x, player.z, 5, 'wave', 1.2, 3);
  }

  // ---------------------------------------------------------------- per frame (play tick)
  const jumps = [];
  const dodges = [];
  const turns = [];              // [t, dyaw, x, z]
  let lastYaw = player.yaw;
  let idleSaid = -1e9, ringAt = -1e9;
  let playFrom = clock.t;
  on('mode', (m) => { if (m === 'play') playFrom = clock.t; });
  on('player:jump', () => {
    if (cur) stop();
    const now = clock.t;
    jumps.push(now);
    while (jumps.length && now - jumps[0] > 12000) jumps.shift();
    const recent = jumps.filter((t) => now - t < 6000).length;
    if (jumps.length >= 15 && found('bunnyhop')) bitSay('Fifteen jumps. Are we doing parkour now?', { force: true });
    else if (recent === 8) bitSay(pick(['Boing. Boing. Boing.', 'The ground is not lava. I checked.', 'You know there is a sword too, right?']));
  });
  on('player:dodge', () => {
    if (cur) stop();
    const now = clock.t;
    dodges.push(now);
    while (dodges.length && now - dodges[0] > 5000) dodges.shift();
    if (dodges.length >= 5 && !liveTargets().some((t) => Math.hypot(t.x - player.x, t.z - player.z) < 14)) {
      dodges.length = 0;
      bitSay(pick(['You are dodging… nothing. Very thorough.', 'Rolling away from your problems, I see.', 'Nothing is attacking us. I asked.']));
    }
  });
  for (const ev of ['player:swing', 'spell', 'vehicle', 'player:dead']) on(ev, () => { if (cur) stop(); });
  on('player:land', (impact) => { if (impact > 24) bitSay(pick(['Ten out of ten landing. The judges are a seagull.', 'Stuck the landing. Gravity is a reviewer, and you passed.'])); });
  let streak = [];
  on('kill', ({ source }) => {
    if (source === 'buddy') return;
    const now = clock.t;
    streak = streak.filter((t) => now - t < 10000);
    streak.push(now);
    if (streak.length === 5) bitSay(pick(['Five in ten seconds! Reviewer #2 is taking notes.', 'Combo! I would cite that.']));
  });

  function update(dt) {
    // ---- the current emote
    if (cur) {
      const ax = input.axis();
      if (Math.hypot(ax.x, ax.y) > 0.2 || !canEmote()) stop();
      else {
        cur.t += dt;
        if (cur.id === 'dance') {
          const beat = Math.floor(cur.t * 2.2);
          if (beat !== cur.beat) {
            cur.beat = beat;
            if (beat % 2 === 0) fx.text(player.x + (Math.random() - 0.5) * 1.2, player.y + 4.2, player.z, pick(['♪', '♫']), 'info');
            if (!calm() && beat % 2 === 1) buddy.hop = 0.5;
          }
        }
        if (cur.t >= cur.dur) {
          if (cur.id === 'think') { fx.text(player.x, player.y + 4.6, player.z, '!', 'gold'); sfx('pop'); }
          stop();
        }
      }
    }
    if (dizzy > 0) dizzy = Math.max(0, dizzy - dt);
    if (!mode.play) return;

    // ---- spinning on the spot: two full turns within ~3.5 s while staying within a few steps
    let d = player.yaw - lastYaw;
    d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    lastYaw = player.yaw;
    const now = clock.t;
    // only turns made by moving count (first-person mouse look turns the body too)
    turns.push([now, Math.hypot(player.vx || 0, player.vz || 0) > 0.3 ? d : 0, player.x, player.z]);
    while (turns.length && now - turns[0][0] > 3500) turns.shift();
    if (dizzy <= 0 && turns.length > 20 && !player.vehicle) {
      let sum = 0;
      for (const tr of turns) sum += tr[1];
      const o = turns[0];
      if (Math.abs(sum) > Math.PI * 4 && Math.hypot(player.x - o[2], player.z - o[3]) < 4) {
        turns.length = 0;
        dizzy = 2.6;
        fx.text(player.x, player.y + 4.4, player.z, 'dizzy', 'info');
        fx.burst(player.x, player.y + 3.8, player.z, '#fde68a', 8, 2, 0.8, 0.5);
        const first = found('dizzy');
        bitSay(first ? 'That was 720 degrees. The loss landscape is not that interesting.' : pick(['Again? I am getting dizzy just watching.', 'Round and round. Like a review cycle.']), { force: first });
      }
    }

    // ---- standing about
    if (!cur && now - Math.max(player.lastActionAt, playFrom) > 40000 && now - idleSaid > 60000 && !player.dead) {
      idleSaid = now;
      if (canEmote()) play('think');
      setTimeout(() => bitSay(pick(['Are we waiting for the GPU queue too?', 'I could run a gradient step in the meantime.', TOUCH ? 'Tip: the o/ button does emotes. Just saying.' : 'Tip: X does emotes. Just saying.', 'Is this a coffee break? I like coffee breaks.']), { force: true }), 1800);
    }

    // ---- bumping into the crowd (hub)
    if (where.id === 'hub' && ambient) {
      const moving = Math.hypot(player.vx || 0, player.vz || 0) > 1.5;
      for (const a of ambient.agents) {
        const dd = Math.hypot(a.x - player.x, a.z - player.z);
        if (a.mode === 'loop') {
          if (dd < 1.6 && now - ringAt > 2500) { ringAt = now; sfx('ring'); fx.text(a.x, a.y + 2.4, a.z, 'ring ring!', 'info'); }
          continue;
        }
        if (!moving || dd > 1.05 || a.react || (a.bumpAt && now - a.bumpAt < 3000)) continue;
        a.bumpAt = now;
        a.react = { kind: 'bump', t: 0.8, x: player.x, z: player.z };
        fx.text(a.x, a.y + 2.3, a.z, player.vehicle === 'car' ? 'hey!' : pick(['sorry!', 'oops', 'excuse me', 'oh, hi']), 'info');
      }
    }
  }

  /** Offsets for the scholar mesh this frame: { dy, rx, ry, rz } (rotation in the mesh's own frame). */
  const P = { dy: 0, rx: 0, ry: 0, rz: 0 };
  function pose() {
    P.dy = 0; P.rx = 0; P.ry = 0; P.rz = 0;
    const still = calm();
    if (dizzy > 0 && !still) { const k = Math.min(1, dizzy / 0.6); P.rz = Math.sin(dizzy * 9) * 0.16 * k; P.ry = Math.sin(dizzy * 4.5) * 0.25 * k; }
    if (!cur) return P;
    const t = cur.t, k = Math.min(1, t / 0.25, (cur.dur - t) / 0.25);   // ease in and out
    if (cur.id === 'wave') {
      if (!still) P.rz = Math.sin(t * 9) * 0.05;
      setArmPose({ rx: 0.1, ry: 0, rz: still ? 0.5 : 0.45 + Math.sin(t * 9) * 0.35 });   // blade up and out, waving clear of the head
    } else if (cur.id === 'dance') {
      if (!still) {
        P.dy = Math.abs(Math.sin(t * Math.PI * 2.2)) * 0.45 * k;
        P.ry = Math.sin(t * Math.PI * 1.1) * 0.7 * k;
        P.rz = Math.sin(t * Math.PI * 2.2) * 0.1 * k;
      }
      setArmPose({ rx: 0.2, ry: 0, rz: still ? 0.5 : Math.sin(t * Math.PI * 2.2) * 0.8 });
    } else if (cur.id === 'think') {
      P.rz = 0.13 * k;
      setArmPose({ rx: Math.PI - 0.25, ry: 0, rz: 0.1 });
    } else if (cur.id === 'bow') {
      P.rx = (still ? 0.3 : Math.sin(Math.min(1, t / cur.dur) * Math.PI) * 0.42);
      setArmPose({ rx: 2.2, ry: 0, rz: 0 });
    }
    return P;
  }

  function onKey(e) {
    if (!mode.play) return false;
    if (!picker.hidden) {
      const n = Number(e.key);
      if (n >= 1 && n <= ORDER.length) { play(ORDER[n - 1]); close(); return true; }
      if (e.key === 'Escape' || e.code === 'KeyX') { close(); return true; }
    }
    if (e.code === 'KeyX') { open(); return true; }
    return false;
  }

  function reset() { stop(); close(); dizzy = 0; turns.length = 0; }

  return { onKey, update, pose, reset, play, open, close, get current() { return cur?.id || null; }, get dizzy() { return dizzy; } };
}
