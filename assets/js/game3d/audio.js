// Tiny WebAudio synth for chiptune sound effects and an optional music loop.
import { S, save } from './state.js';

let ctx = null;
let master = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// iOS / Android only let a page start audio inside a user gesture, and touch controls call
// preventDefault (no click follows): wake the context on the first real gestures while sound is on
{
  const unlock = () => {
    if (!S.settings.sound && !S.settings.music) return;
    const c = audio();
    if (c && c.state === 'running') for (const t of ['pointerup', 'touchend', 'keydown']) window.removeEventListener(t, unlock, true);
  };
  for (const t of ['pointerup', 'touchend', 'keydown']) window.addEventListener(t, unlock, { capture: true, passive: true });
}

/** Play a sequence of notes: [[freq, startOffset, duration], ...] */
function seq(notes, { type = 'square', gain = 0.12, slide } = {}) {
  const c = audio();
  // still locked (no tap or key yet): drop the sound instead of queueing a burst for the first tap
  if (!c || c.state !== 'running') return;
  const now = c.currentTime;
  for (const [f, at = 0, dur = 0.12] of notes) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, now + at);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, now + at + dur);
    g.gain.setValueAtTime(gain, now + at);
    g.gain.exponentialRampToValueAtTime(0.0008, now + at + dur);
    o.connect(g).connect(master);
    o.start(now + at);
    o.stop(now + at + dur + 0.02);
  }
}

const SFX = {
  coin: () => seq([[988, 0, 0.07], [1319, 0.07, 0.18]], { gain: 0.1 }),
  swing: () => seq([[220, 0, 0.12]], { type: 'sawtooth', gain: 0.07, slide: 90 }),
  hit: () => seq([[150, 0, 0.09]], { gain: 0.08 }),
  hurt: () => seq([[260, 0, 0.16]], { type: 'sawtooth', gain: 0.09, slide: 70 }),
  block: () => seq([[660, 0, 0.06], [440, 0.05, 0.08]], { type: 'triangle', gain: 0.1 }),
  kill: () => seq([[420, 0, 0.3]], { gain: 0.08, slide: 100 }),
  crit: () => seq([[880, 0, 0.05], [1320, 0.05, 0.12]], { gain: 0.09 }),
  fireball: () => seq([[300, 0, 0.25]], { type: 'sawtooth', gain: 0.07, slide: 900 }),
  heal: () => seq([[523, 0, 0.18], [659, 0.1, 0.18], [784, 0.2, 0.28]], { type: 'sine', gain: 0.1 }),
  zap: () => seq([[120, 0, 0.1], [1800, 0.08, 0.12]], { type: 'sawtooth', gain: 0.07 }),
  meteor: () => seq([[80, 0, 0.5]], { type: 'sawtooth', gain: 0.08, slide: 420 }),
  boom: () => seq([[70, 0, 0.3]], { type: 'sawtooth', gain: 0.1, slide: 40 }),
  buddy: () => seq([[740, 0, 0.06], [988, 0.06, 0.1]], { type: 'triangle', gain: 0.06 }),
  signature: () => seq([[392, 0, 0.1], [523, 0.08, 0.1], [784, 0.16, 0.22]], { type: 'square', gain: 0.09 }),
  levelup: () => seq([[523, 0, 0.15], [659, 0.1, 0.15], [784, 0.2, 0.15], [1047, 0.3, 0.35]], { type: 'triangle', gain: 0.14 }),
  achievement: () => seq([[659, 0, 0.12], [784, 0.1, 0.12], [1047, 0.2, 0.12], [1319, 0.3, 0.3]], { type: 'triangle', gain: 0.12 }),
  victory: () => seq([[523, 0, 0.18], [659, 0.15, 0.18], [784, 0.3, 0.18], [1047, 0.45, 0.18], [784, 0.6, 0.12], [1047, 0.72, 0.5]], { gain: 0.11 }),
  purchase: () => seq([[800, 0, 0.08], [1200, 0.08, 0.16]], { type: 'sine', gain: 0.1 }),
  open: () => seq([[440, 0, 0.12], [660, 0.08, 0.2]], { type: 'triangle', gain: 0.08 }),
  error: () => seq([[200, 0, 0.12], [160, 0.1, 0.16]], { gain: 0.07 }),
  rune: () => seq([[440, 0, 0.2], [554, 0.12, 0.2], [659, 0.24, 0.2], [880, 0.36, 0.6]], { type: 'sine', gain: 0.12 }),
  door: () => seq([[98, 0, 0.8], [147, 0.4, 0.9]], { type: 'triangle', gain: 0.14, slide: 60 }),
  encounter: () => seq([[330, 0, 0.08], [440, 0.08, 0.08], [330, 0.16, 0.08], [554, 0.24, 0.2]], { gain: 0.08 }),
  // the scroll tour: a low, felt thump when a new section arrives (the wind itself is scrollWind below)
  thump: () => { seq([[72, 0, 0.42]], { type: 'sine', gain: 0.16, slide: 44 }); seq([[140, 0, 0.09]], { type: 'triangle', gain: 0.05, slide: 60 }); },
  // page UI (the interactive CV)
  stamp: () => seq([[110, 0, 0.06], [70, 0.03, 0.14]], { type: 'square', gain: 0.13 }),
  flip: () => seq([[620, 0, 0.04], [930, 0.035, 0.05]], { type: 'triangle', gain: 0.05 }),
  tick: () => seq([[1500 + Math.random() * 300, 0, 0.012]], { gain: 0.025 }),
  pop: () => seq([[880, 0, 0.05]], { type: 'triangle', gain: 0.07, slide: 1320 }),
  warp: () => { gust(0.9, 1.1); seq([[90, 0.25, 0.6]], { type: 'sine', gain: 0.12, slide: 50 }); },
  ring: () => seq([[1320, 0, 0.05], [1320, 0.1, 0.05], [1320, 0.2, 0.05]], { gain: 0.05 }),
  squeak: () => seq([[520, 0, 0.05], [780, 0.04, 0.07]], { gain: 0.07 }),
  // round 4: traversal, blades and vehicles
  jump: () => seq([[330, 0, 0.09]], { type: 'triangle', gain: 0.05, slide: 620 }),
  slash: () => seq([[900, 0, 0.09]], { type: 'sawtooth', gain: 0.05, slide: 240 }),
  slash3: () => seq([[1200, 0, 0.16]], { type: 'sawtooth', gain: 0.06, slide: 180 }),
  honk: () => seq([[392, 0, 0.22], [370, 0, 0.22], [392, 0.28, 0.3], [370, 0.28, 0.3]], { type: 'square', gain: 0.08 }),
  thrust: () => seq([[90, 0, 0.18]], { type: 'sawtooth', gain: 0.05, slide: 160 }),
  vehicle: () => seq([[262, 0, 0.08], [392, 0.07, 0.08], [523, 0.14, 0.14]], { type: 'triangle', gain: 0.08 }),
  portal: () => seq([[196, 0, 0.5]], { type: 'sine', gain: 0.1, slide: 1568 }),
};

// ---- wind: filtered noise whose level and brightness follow how fast the page scrolls ----
let wind = null;
function windNodes(c) {
  if (wind) return wind;
  const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = buf.getChannelData(0);
  let b = 0;
  for (let i = 0; i < d.length; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 6; }   // soft, brown-ish noise
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300; f.Q.value = 0.8;
  const g = c.createGain(); g.gain.value = 0;
  src.connect(f).connect(g).connect(master);
  src.start();
  wind = { f, g };
  return wind;
}
let speed = 0;
/** Scroll speed (px/s) from the page: drives the wind, and mutes bright UI blips while you race down. */
export function scrollWind(pxPerSec) {
  speed = pxPerSec;
  if (!S.settings.sound || !ctx || ctx.state !== 'running') return;
  const w = windNodes(ctx), t = ctx.currentTime;
  const k = Math.min(1, pxPerSec / 3000);              // 0: still, ~0.1-0.2: reading, 1: flinging
  w.g.gain.setTargetAtTime(k < 0.02 ? 0 : 0.025 + 0.22 * k ** 1.1, t, k < 0.02 ? 0.25 : 0.08);
  w.f.frequency.setTargetAtTime(260 + 2600 * k, t, 0.1);
}
/** A single gust (the teleport, big arrivals). */
function gust(level = 0.6, secs = 0.8) {
  if (!ctx || ctx.state !== 'running') return;
  const w = windNodes(ctx), t = ctx.currentTime;
  w.g.gain.cancelScheduledValues(t); w.f.frequency.cancelScheduledValues(t);
  w.g.gain.setValueAtTime(w.g.gain.value, t); w.g.gain.linearRampToValueAtTime(0.22 * level, t + secs * 0.35); w.g.gain.setTargetAtTime(0, t + secs * 0.35, secs * 0.3);
  w.f.frequency.setValueAtTime(400, t); w.f.frequency.linearRampToValueAtTime(2400 * level, t + secs * 0.35); w.f.frequency.setTargetAtTime(300, t + secs * 0.35, secs * 0.4);
}
const BRIGHT = new Set(['coin', 'tick', 'pop', 'flip', 'buddy', 'ring', 'squeak', 'stamp']);
let lastThump = 0;

/** True once the browser lets this page make sound (after the first tap / click / key). */
export const audioReady = () => !!ctx && ctx.state === 'running';

export function sfx(name) {
  if (!S.settings.sound) return;
  // racing down the page: the wind carries it; no pile-up of blips, and at most one thump per half second
  if (speed > 1200 && BRIGHT.has(name)) return;
  if (name === 'thump') {
    const now = performance.now();
    if (now - lastThump < 500 || speed > 3500) return;
    lastThump = now;
    try { if (matchMedia('(pointer: coarse)').matches) navigator.vibrate?.(14); } catch { /* no vibration */ }
  }
  try { SFX[name]?.(); } catch { /* audio unavailable */ }
}

export function setSound(on) {
  S.settings.sound = !!on;
  save();
  if (!on) stopMusic();
}

// ---- optional music loop ----
let musicTimer = 0;
const MELODY = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1047, 988, 784, 659, 587];
const BASS = [131, 131, 175, 175, 147, 147, 196, 196];

export function startMusic() {
  if (musicTimer || !S.settings.sound) return;
  let i = 0;
  musicTimer = setInterval(() => {
    seq([[MELODY[i % MELODY.length], 0, 0.22]], { gain: 0.035 });
    if (i % 2 === 0) seq([[BASS[(i / 2) % BASS.length], 0, 0.4]], { type: 'triangle', gain: 0.05 });
    i++;
  }, 260);
}

export function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = 0;
}
