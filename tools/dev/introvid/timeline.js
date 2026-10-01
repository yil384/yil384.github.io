// Output timeline of the intro video: frame/time mapping, beats and easing helpers. Everything downstream is a pure
// function of the output frame index (no clocks, no Math.random).

export const FPS = 24;
export const SIZE = 720;
export const DURATION = 14.0;
export const FRAMES = Math.round(DURATION * FPS); // 336
export const SRC_W = 1280;
export const SRC_H = 720;
export const SRC_FRAMES = 240;
export const OFFSET = 1.0; // output t = source t + OFFSET during the clip
export const CLIP_END = OFFSET + SRC_FRAMES / FPS; // 11.0
export const OUTRO_FRAME = 231; // final pose: waving, sword out (picked from the last 0.6 s of the clip)

// beats (output seconds)
export const B = {
  alive: 0.85, // intro panel starts to come alive
  aliveEnd: 1.12,
  hey: [1.0, 2.05],
  caption: [-1, 1.8], // already up on frame 0 (= the poster)
  secret: 2.1, name: 2.35, line1: 3.2, line2: 3.85, secretOut: 5.3,
  cut: 0, // filled from track.json: OFFSET + cut / FPS
  great: [5.85, 8.1],
  shing: [7.15, 7.85],
  spin: [8.05, 9.7],
  applause: [9.2, 11.0],
  shhh: [9.75, 10.6],
  outro: 11.0,
  powers: 11.2, chips: [11.38, 11.66, 11.94],
  cont: 12.35,
};

export function srcIndex(t) {
  if (t < OFFSET) return 0;
  if (t >= CLIP_END) return OUTRO_FRAME;
  return Math.min(SRC_FRAMES - 1, Math.max(0, Math.round((t - OFFSET) * FPS)));
}

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (k) => { k = clamp(k); return k * k * (3 - 2 * k); };
export const inOut = (k) => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
export const outCubic = (k) => 1 - Math.pow(1 - clamp(k), 3);
export function outBack(k, s = 1.9) {
  k = clamp(k) - 1;
  return 1 + (s + 1) * k * k * k + s * k * k;
}
export const ramp = (t, a, b) => clamp((t - a) / (b - a));

// pop-in with overshoot (0.18 s), quick pop-out (0.12 s). Returns { s: scale, a: alpha, on }.
export function pop(t, tIn, tOut, dIn = 0.18, dOut = 0.12) {
  if (t < tIn || t >= tOut) return { s: 0, a: 0, on: false, k: 0 };
  const kin = (t - tIn) / dIn;
  let s = kin < 1 ? outBack(kin) : 1;
  let a = clamp(kin * 2.5);
  if (t > tOut - dOut) { const ko = (tOut - t) / dOut; s *= lerp(0.6, 1, ko); a *= ko; }
  return { s: Math.max(0, s), a, on: true, k: t - tIn };
}

// deterministic PRNG (mulberry32)
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// smooth 1D value noise from a seed (for wobble/shake): pure function of t
export function wob(t, seed, freq = 1) {
  const r = rng(seed);
  const p1 = r() * 6.283, p2 = r() * 6.283, p3 = r() * 6.283;
  return (Math.sin(t * freq * 6.283 + p1) * 0.5 + Math.sin(t * freq * 2.31 * 6.283 + p2) * 0.3 + Math.sin(t * freq * 4.7 * 6.283 + p3) * 0.2);
}
