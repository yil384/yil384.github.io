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

/** Play a sequence of notes: [[freq, startOffset, duration], ...] */
function seq(notes, { type = 'square', gain = 0.12, slide } = {}) {
  const c = audio();
  if (!c) return;
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
};

export function sfx(name) {
  if (!S.settings.sound) return;
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
