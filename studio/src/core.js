// core.js: canvas, palette, timing and motion helpers, the paint() wrapper around p5.brush, camera, full-frame
// effects, glow, lettering, paper and the render hooks that studio.html / render.mjs call.
//
// Adapted from ClaudeAnimationBase (c) 2026 John Heibel, MIT (see ../LICENSE-ClaudeAnimationBase), extended with a
// configurable output scale, a per-video PROJECT registry and the cel-3D painter in cel3d.js.
//
// Frames are pure functions of time: nothing survives between frames, no Math.random(), and every element seeds its own
// boil with boilSeed(key). The world is always 1920x1080 (y down); PROJECT.scale sets the pixel size of the output.

const W = 1920, H = 1080;
const TAU = Math.PI * 2;
const BOIL = 12;

// The active video: set by VIDEO() in timeline.js before p5 setup runs. Defaults keep a scene testable on its own.
let PROJECT = { name: 'untitled', duration: 8, bpm: 120, offset: 0, scale: 2 / 3, fps: 24, fonts: null };
let S = PROJECT.scale;                  // world px -> canvas px
const CW = () => Math.round(W * S), CH = () => Math.round(H * S);
let BPM = PROJECT.bpm, BEAT = 60 / BPM, OFF = PROJECT.offset, DUR = PROJECT.duration;
function applyProject(p) {
  PROJECT = { ...PROJECT, ...p };
  S = PROJECT.scale; BPM = PROJECT.bpm; BEAT = 60 / BPM; OFF = PROJECT.offset || 0; DUR = PROJECT.duration;
}

// A palette for sci-fi anime: deep night blues, warm amber light, one hot accent. Any hex works.
const PAL = {
  paper: '#0E1120', ink: '#0A0B14', night: '#0F1530', indigo: '#1E2A5E', steel: '#3B4A6B', slate: '#5A6C8E',
  mist: '#8FA3C7', cream: '#F4EEDF', bone: '#D8D2C2', amber: '#F2B84B', ember: '#F26B3A', rose: '#E9557D',
  cyan: '#4FD6FF', teal: '#2FA6A0', violet: '#8A63D2', magenta: '#D24FB8', sap: '#5EA35C', gold: '#FFD470',
};

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, x) => a + (b - a) * x;
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const easeIn = x => Math.pow(clamp(x), 3);
const backOut = x => { x = clamp(x); const s = 1.9; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const elasticOut = x => { x = clamp(x); return x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (TAU / 3)) + 1; };
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const bpOf = t => (t - OFF) / BEAT;
const jit = a => (random() * 2 - 1) * a;
let BOILN = 0, ACTOR_N = 0;
const boilSeed = key => { let h = 2166136261; for (const c of key + '|' + BOILN) h = Math.imul(h ^ c.charCodeAt(0), 16777619); randomSeed(h >>> 0); };

// ---------- timing (pure functions of t) ----------
const seg = (t, a, b) => clamp((t - a) / (b - a));
const frac = x => x - Math.floor(x);
const beatN = t => Math.floor(bpOf(t));
const pulse = (t, k = 6) => Math.exp(-frac(bpOf(t)) * k);
const pulse2 = (t, k = 6) => Math.exp(-frac(bpOf(t) * 2) * k);
const wob = (t, f = 1, ph = 0) => Math.sin((t * f + ph) * TAU);
function kf(t, keys, e = ease) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0]) {
      const [a, va] = keys[i - 1], [b, vb] = keys[i], k = e((t - a) / (b - a));
      return Array.isArray(va) ? va.map((v, j) => lerp(v, vb[j], k)) : lerp(va, vb, k);
    }
  }
  return keys[keys.length - 1][1];
}
function mixCol(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), c = i => Math.round(lerp((pa >> i) & 255, (pb >> i) & 255, clamp(k)));
  return '#' + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1);
}
const shakeXY = (t, amt) => { const f = Math.floor(t * 24); return [(hash(f * 1.7) - .5) * 2 * amt, (hash(f * 2.3 + 9) - .5) * 2 * amt]; };

// ---------- motion principles ----------
const spring = (t, t0, k = 6, w = 18) => t < t0 ? 0 : Math.exp(-k * (t - t0)) * Math.sin(w * (t - t0));
const ring = (t, evs, k = 6, w = 18) => evs.reduce((s, e) => s + spring(t, e, k, w), 0);
const onTwos = t => Math.floor(t * 12 + 1e-6) / 12;
const arcPt = (p0, p1, h, k) => [lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k) - h * 4 * k * (1 - k)];
function jump(t, t0, t1, h = 3) {
  if (t < t0 - .12) return { dy: 0, sq: 0 };
  if (t < t0) return { dy: 0, sq: .18 * ease(seg(t, t0 - .12, t0)) };
  if (t < t1) { const k = (t - t0) / (t1 - t0); return { dy: -h * 4 * k * (1 - k), sq: -.16 * Math.abs(1 - 2 * k) }; }
  const a = t - t1; return { dy: 0, sq: .22 * Math.exp(-8 * a) * Math.cos(20 * a) };
}
function take(t, t0, amt = 1) {
  if (t < t0 - .1) return { sq: 0, dy: 0 };
  if (t < t0) return { sq: .12 * amt * ease(seg(t, t0 - .1, t0)), dy: 0 };
  const a = t - t0; return { sq: -.26 * amt * Math.exp(-6 * a) * Math.cos(16 * a), dy: -1.2 * amt * Math.exp(-7 * a) * Math.max(0, Math.cos(9 * a)) };
}
function stroll(t, t0, t1, x0, x1, u) {
  const x = lerp(x0, x1, ease(seg(t, t0, t1))), d = Math.abs(x - x0) / (4 * u), moving = t > t0 && t < t1;
  return { x, walk: d, view: moving ? 'q' : 'front', flip: x1 < x0, dy: moving ? -Math.abs(Math.sin(d * Math.PI)) * .5 : 0 };
}

// ---------- camera ----------
let CAM = null, LAST_CAM = null;
function camBegin(cx = W / 2, cy = H / 2, zoom = 1, rot = 0) { push(); translate(W / 2, H / 2); rotate(rot); scale(zoom); translate(-cx, -cy); CAM = LAST_CAM = { cx, cy, zoom, rot }; }
function camEnd() { pop(); CAM = null; }
function toScreen(x, y, cam = CAM) {
  if (!cam) return [x, y];
  const c = Math.cos(cam.rot), s = Math.sin(cam.rot), dx = (x - cam.cx) * cam.zoom, dy = (y - cam.cy) * cam.zoom;
  return [W / 2 + dx * c - dy * s, H / 2 + dx * s + dy * c];
}

// ---------- full-frame effects (screen space, outside a camera) ----------
function flash(k, col = '#FFFDF6') { if (k > .01) paint(rectPts(-60, -60, W + 120, H + 120), { wash: col, washOp: 255 * clamp(k), ink: null }); }
// Letterbox bars: k 0..1 slides cinema bars in from the top and bottom edges.
function letterbox(k, h = 130, col = PAL.ink) {
  if (k <= 0) return;
  const hh = h * ease(k);
  paint(rectPts(-60, -60, W + 120, 60 + hh), { wash: col, ink: null });
  paint(rectPts(-60, H - hh, W + 120, hh + 60), { wash: col, ink: null });
}
// Light: an additive halo (p5.brush mixes colour like pigment, so light can't be painted).
function glow(x, y, r, col = '#FFC766', a = 1) {
  if (a <= 0 || r < 1) return;
  flushBrush();
  const c = color(col), rr = r * (1 + jit(.03));
  push(); blendMode(ADD); tint(red(c), green(c), blue(c), 150 * clamp(a)); image(glowTex, x - rr, y - rr, 2 * rr, 2 * rr); noTint(); blendMode(BLEND); pop();
}
// A soft directional light streak (anamorphic flare / laser / thruster): a stretched glow.
function streak(x, y, len, thick, col = '#9FE8FF', a = 1, rot = 0) {
  if (a <= 0) return;
  flushBrush();
  const c = color(col);
  push(); translate(x, y); rotate(rot); blendMode(ADD); tint(red(c), green(c), blue(c), 150 * clamp(a)); image(glowTex, -len / 2, -thick / 2, len, thick); noTint(); blendMode(BLEND); pop();
}
function makeGlowTex() {
  const g = createGraphics(256, 256); g.pixelDensity(1); const c = g.drawingContext, gr = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  [[0, 1], [.18, .8], [.45, .32], [.75, .08], [1, 0]].forEach(([s, a]) => gr.addColorStop(s, `rgba(255,255,255,${a})`));
  c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
  return g;
}
function irisShape(pts, col = PAL.ink, far = 4000) {
  const n = pts.length; let cx = 0, cy = 0; for (const p of pts) { cx += p[0]; cy += p[1]; } cx /= n; cy /= n;
  const out = p => { const dx = p[0] - cx, dy = p[1] - cy, d = Math.hypot(dx, dy) || 1; return [cx + dx / d * far, cy + dy / d * far]; };
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], ex = (b[0] - a[0]) * .06, ey = (b[1] - a[1]) * .06;
    const a2 = [a[0] - ex, a[1] - ey], b2 = [b[0] + ex, b[1] + ey];
    paint([a2, b2, out(b2), out(a2)], { wash: col, washOp: 255, ink: null });
  }
}
function iris(cx, cy, r, col = PAL.ink) { if (r < 4) paint(rectPts(-60, -60, W + 120, H + 120), { wash: col, ink: null }); else irisShape(ellPts(cx, cy, r, r, 40), col); }
// Anime speed lines converging on (cx, cy): n ink strokes from the frame edge inward, k 0..1 strength.
function speedLines(cx, cy, k = 1, n = 48, col = PAL.ink, sw = 1.2) {
  if (k <= .01) return;
  boilSeed('speedlines');
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash(i) * .1, r0 = 1500, r1 = lerp(1500, 260 + 500 * hash(i + 50), k);
    const p0 = [cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], p1 = [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1];
    inkLine([p0, [lerp(p0[0], p1[0], .5) + jit(6), lerp(p0[1], p1[1], .5) + jit(6)], p1], sw * (.6 + hash(i + 9)), col, 'ink', .2);
  }
}
// Impact frame: the whole frame goes to two colours for a few frames (k 0..1 = mix toward the flat wash).
function impactFrame(k, col = PAL.cream) { if (k > .01) paint(rectPts(-60, -60, W + 120, H + 120), { wash: col, washOp: 255 * clamp(k), ink: null }); }

let T = 0, paperG = null, grainC = null, letG = null, glowTex = null, outC = null, outX = null;
let LETTERS = [];

// ---------- geometry ----------
function rectPts(x, y, w, h, j = 0) {
  return [[x + jit(j), y + jit(j)], [x + w / 2 + jit(j), y + jit(j) * .5], [x + w + jit(j), y + jit(j)],
          [x + w + jit(j) * .5, y + h / 2], [x + w + jit(j), y + h + jit(j)], [x + w / 2 + jit(j), y + h + jit(j) * .5],
          [x + jit(j), y + h + jit(j)], [x + jit(j) * .5, y + h / 2]];
}
function ellPts(cx, cy, rx, ry, n = 28, j = 0, rot = 0) {
  const p = []; for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; p.push([cx + Math.cos(a) * rx + jit(j), cy + Math.sin(a) * ry + jit(j)]); } return p;
}
function rrPts(x, y, w, h, r, j = 0) {
  const p = [], segs = 5, corner = (cx, cy, a0) => { for (let i = 0; i <= segs; i++) { const a = a0 + i / segs * Math.PI / 2; p.push([cx + Math.cos(a) * r + jit(j), cy + Math.sin(a) * r + jit(j)]); } };
  corner(x + w - r, y + r, -Math.PI / 2); corner(x + w - r, y + h - r, 0); corner(x + r, y + h - r, Math.PI / 2); corner(x + r, y + r, Math.PI);
  return p;
}
function starPts(cx, cy, r, inner = .38, n = 4, rot = -Math.PI / 2) {
  const p = []; for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, q = i % 2 ? r * inner : r; p.push([cx + Math.cos(a) * q, cy + Math.sin(a) * q]); } return p;
}
function polyPts(cx, cy, r, n = 6, rot = 0, j = 0) { const p = []; for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; p.push([cx + Math.cos(a) * r + jit(j), cy + Math.sin(a) * r + jit(j)]); } return p; }
function through(P, n = 6) {
  if (P.length < 3) return P.slice();
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const u = k / n, u2 = u * u, u3 = u2 * u;
      out.push([0, 1].map(d => .5 * (2 * p1[d] + (p2[d] - p0[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * u3)));
    }
  }
  out.push(P[P.length - 1]);
  return out;
}
function ribbon(P, w0, w1 = w0) {
  const C = through(P), n = C.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = C[Math.max(0, i - 1)], b = C[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, w = lerp(w0, w1, i / Math.max(1, n - 1)) / 2;
    L.push([C[i][0] - dy / d * w, C[i][1] + dx / d * w]); R.push([C[i][0] + dy / d * w, C[i][1] - dx / d * w]);
  }
  return L.concat(R.reverse());
}
const offsetPts = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy]);
const scalePts = (pts, sx, sy = sx, cx = 0, cy = 0) => pts.map(([x, y]) => [cx + (x - cx) * sx, cy + (y - cy) * sy]);

// ---------- paint wrapper ----------
// p5.brush 2.2.3 loses strokes drawn far from the origin under a zoomed camera, so every shape is drawn around its
// own centre. Any NaN in a point list throws deep inside p5.brush, so the wrapper drops them here with a clear message.
function centred(pts, draw) {
  if (!pts.length) return;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`paint(): non-finite point ${x},${y}`);
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  push(); translate(cx, cy); draw(pts.map(([x, y]) => [x - cx, y - cy])); pop();
}
function paint(pts, o = {}) { centred(pts, (P) => paintAt(P, o)); }
function paintAt(pts, o) {
  if (o.fill) BUDGET.fills++;
  if (o.ink !== null) BUDGET.strokes++;
  if (o.wash || o.fill || o.hatch) {
    if (o.wash) brush.wash(o.wash, o.washOp ?? 255); else brush.noWash();
    if (o.fill) { brush.fill(o.fill, o.fillOp ?? 170); brush.fillBleed(o.bleed ?? .1); brush.fillTexture(o.tex ?? .4, o.border ?? .35); } else brush.noFill();
    if (o.hatch) { brush.hatch(o.hatch.d, o.hatch.a, o.hatch.o || { rand: .15 }); brush.hatchStyle(o.hatch.b || 'HB', o.hatch.c || PAL.ink, o.hatch.w || 1); } else brush.noHatch();
    brush.noStroke();
    if (o.curv) { brush.beginShape(o.curv); for (const p of pts) brush.vertex(p[0], p[1]); brush.endShape(true); }
    else brush.polygon(pts);
  }
  if (o.ink !== null) {
    brush.noWash(); brush.noFill(); brush.noHatch(); brush.set(o.br || 'ink', o.ink || PAL.ink, o.sw ?? 1);
    brush.beginShape(o.curv || 0); for (const p of pts) brush.vertex(p[0], p[1]); brush.endShape(true);
  }
}
// Lines are clipped to a margin around the frame: a stroke is one stamp every ~0.6 px, so a line that runs 40 000 px
// off-screen (a floor grid seen edge-on) would otherwise cost seconds and can freeze p5.brush's culling.
const CLIP = { x0: -240, y0: -240, x1: W + 240, y1: H + 240 };
function clipSeg([ax, ay], [bx, by], R = CLIP) {
  let t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay;
  for (const [p, q] of [[-dx, ax - R.x0], [dx, R.x1 - ax], [-dy, ay - R.y0], [dy, R.y1 - ay]]) {
    if (p === 0) { if (q < 0) return null; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return [[ax + dx * t0, ay + dy * t0], [ax + dx * t1, ay + dy * t1]];
}
const inFrame = (p, R = CLIP) => p[0] >= R.x0 && p[0] <= R.x1 && p[1] >= R.y0 && p[1] <= R.y1;
function inkLine(pts, sw = 1, col = PAL.ink, br = 'ink', curv = .5) {
  if (pts.length < 2) return;
  BUDGET.strokes++;
  const world = CAM ? pts.map(p => toScreen(p[0], p[1])) : pts;   // clip in screen space, draw in world space
  if (pts.length === 2 || !world.every(inFrame)) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const s = clipSeg(world[i], world[i + 1]);
      if (!s) continue;
      const back = CAM ? s.map(q => fromScreen(q[0], q[1])) : s;
      if (Math.hypot(back[1][0] - back[0][0], back[1][1] - back[0][1]) < .5) continue;
      centred(back, (P) => { brush.noFill(); brush.noWash(); brush.noHatch(); brush.set(br, col, sw); brush.line(P[0][0], P[0][1], P[1][0], P[1][1]); });
    }
    return;
  }
  centred(pts, (P) => { brush.noFill(); brush.noWash(); brush.noHatch(); brush.set(br, col, sw); brush.spline(P, curv); });
}
function fromScreen(sx, sy, cam = CAM) {
  if (!cam) return [sx, sy];
  const c = Math.cos(-cam.rot), s = Math.sin(-cam.rot), dx = sx - W / 2, dy = sy - H / 2;
  return [cam.cx + (dx * c - dy * s) / cam.zoom, cam.cy + (dx * s + dy * c) / cam.zoom];
}

// ---------- lettering (composited over the painting, under the grain) ----------
// See "No text" in the guide: used only for the name card and sound effects.
function letter(txt, x, y, size, color, o = {}) {
  if (CAM && !o.screen) { [x, y] = toScreen(x, y); size *= CAM.zoom; o = { ...o, rot: (o.rot || 0) + CAM.rot }; }
  LETTERS.push({ txt, x, y, size, color, ...o });
}
function sfx(txt, x, y, size, color, age, o = {}) {
  const life = o.life ?? 1.2; if (age < 0 || age > life) return;
  letter(txt, x, y, size, color, { pop: age * 5, rot: (o.rot ?? -.08) + Math.sin(age * 20) * .03 * (1 - age / life), alpha: 1 - seg(age, life - .25, life), ...o });
}
function drawLetters(c) {
  for (const L of LETTERS) {
    const k = L.pop != null ? backOut(L.pop) : 1; if (k <= .01) continue;
    c.save(); c.translate(L.x * S, L.y * S); c.rotate(L.rot || 0); c.scale(k * S, k * S); c.globalAlpha = L.alpha ?? 1;
    c.font = L.font || `${L.weight || 700} ${L.size}px ${PROJECT.fonts || '"Bebas Neue", "Anton", Impact, sans-serif'}`;
    c.textAlign = L.align || 'center'; c.textBaseline = 'middle';
    if (L.tracking) c.letterSpacing = `${L.tracking}px`;
    if (L.stroke) { c.lineJoin = 'round'; c.lineWidth = L.size * (L.strokeW || .12); c.strokeStyle = L.stroke; c.strokeText(L.txt, 0, 0); }
    if (L.ink !== false) { c.fillStyle = L.inkColor || PAL.ink; c.fillText(L.txt, L.size * .045, L.size * .055); }
    c.fillStyle = L.color; c.fillText(L.txt, 0, 0);
    c.restore();
  }
}
function flushBrush() {
  push(); resetMatrix(); translate(-CW() / 2, -CH() / 2);
  brush.noStroke(); brush.noHatch(); brush.noWash(); brush.fill('#000000', 1); brush.fillBleed(0); brush.fillTexture(0, 0);
  brush.polygon([[-50, -50], [-40, -50], [-40, -40]]); brush.noFill(); pop();
}
function flushLetters() {
  if (!LETTERS.length) return;
  letG.clear(); drawLetters(letG.drawingContext); LETTERS = [];
  flushBrush();
  push(); resetMatrix(); translate(-CW() / 2, -CH() / 2); image(letG, 0, 0); pop();
}

// ---------- paper ----------
function lcg(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function makePaper() {
  const w = CW(), h = CH();
  const g = createGraphics(w, h); g.pixelDensity(1); const c = g.drawingContext, rnd = lcg(11);
  c.fillStyle = PAL.paper; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) { const x = rnd() * w, y = rnd() * h, r = (120 + rnd() * 380) * S, gr = c.createRadialGradient(x, y, 0, x, y, r), a = .05 * rnd(); gr.addColorStop(0, `rgba(120,140,190,${a})`); gr.addColorStop(1, 'rgba(120,140,190,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, 2 * r, 2 * r); }
  c.lineWidth = 1;
  for (let i = 0; i < 1400; i++) { const x = rnd() * w, y = rnd() * h, l = (6 + rnd() * 26) * S, a = rnd() * TAU; c.strokeStyle = `rgba(140,150,180,${.03 + rnd() * .05})`; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a + .6) * l * .5, y + Math.sin(a + .6) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  return g;
}
function makeGrain() {
  const w = CW(), h = CH();
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'), rnd = lcg(5);
  const id = c.createImageData(w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const v = 255 - (rnd() < .55 ? rnd() * rnd() * 30 : 0); d[i] = v; d[i + 1] = v - 1; d[i + 2] = v - 2; d[i + 3] = 255; }
  c.putImageData(id, 0, 0);
  const g = c.createRadialGradient(w / 2, h / 2, h * .45, w / 2, h / 2, h * 1.05); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(60,70,110,.4)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  return cv;
}

// ---------- brushes ----------
function defineBrushes() {
  brush.add('ink', { type: 'default', weight: 5, scatter: .25, sharpness: .8, grain: 40, opacity: 235, spacing: .2, pressure: [1.15, .75], rotate: 'natural', noise: .15 });
  brush.add('inkfine', { type: 'default', weight: 2.6, scatter: .15, sharpness: .85, grain: 40, opacity: 230, spacing: .2, pressure: [1.1, .8], rotate: 'natural', noise: .1 });
  brush.add('dry', { type: 'default', weight: 14, scatter: 3, sharpness: .3, grain: 6, opacity: 90, spacing: .6, pressure: [1, .6], rotate: 'natural', noise: .4 });
  brush.add('neon', { type: 'default', weight: 7, scatter: .1, sharpness: .95, grain: 0, opacity: 255, spacing: .15, pressure: [1, 1], rotate: 'natural', noise: 0 });
}

// ---------- frame ----------
async function setup() {
  createCanvas(CW(), CH(), WEBGL); pixelDensity(1); noLoop();
  brush.scaleBrushes(5 * S); defineBrushes();
  paperG = makePaper(); grainC = makeGrain(); glowTex = makeGlowTex(); letG = createGraphics(CW(), CH()); letG.pixelDensity(1);
  outC = document.getElementById('out'); outC.width = CW(); outC.height = CH(); outX = outC.getContext('2d');
  if (document.fonts && PROJECT.fontLoad) { try { await Promise.all(PROJECT.fontLoad.map(f => document.fonts.load(f))); } catch (e) { console.warn('font load', e); } }
  window.ready = true;
  if (!location.search.includes('render')) devUI();
}
function draw() {
  if (!window.ready) return;
  LETTERS = []; CAM = LAST_CAM = null;
  push(); translate(-CW() / 2, -CH() / 2); scale(S);
  BOILN = Math.floor(T * BOIL); ACTOR_N = 0; boilSeed('frame'); noiseSeed(77);
  BUDGET.fills = 0; BUDGET.faces = 0; BUDGET.strokes = 0;
  push(); resetMatrix(); translate(-CW() / 2, -CH() / 2); image(paperG, 0, 0); pop();
  drawWorld(T);
  pop();
  checkBudget();
}
// Per-frame budgets (ANIMATION_GUIDE §3/§4). Counted by paint() / inkLine() / cel3dPaint(); render.mjs collects the
// warnings so an over-budget shot is caught on the contact sheet, not by a stalled render.
const BUDGET = { fills: 0, faces: 0, strokes: 0, maxFills: 3, maxFaces: 400, maxStrokes: 300 };
function checkBudget() {
  const over = [];
  if (BUDGET.fills > BUDGET.maxFills) over.push(`fills ${BUDGET.fills} > ${BUDGET.maxFills}`);
  if (BUDGET.faces > BUDGET.maxFaces) over.push(`faces ${BUDGET.faces} > ${BUDGET.maxFaces}`);
  if (BUDGET.strokes > BUDGET.maxStrokes) over.push(`strokes ${BUDGET.strokes} > ${BUDGET.maxStrokes}`);
  if (over.length) console.warn(`[budget] t=${T.toFixed(3)} ${over.join(', ')}`);
}
window.frameBudget = () => ({ ...BUDGET });
function composite() {
  const c = outX;
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  c.drawImage(drawingContext.canvas, 0, 0, CW(), CH());
  drawLetters(c);
  c.globalCompositeOperation = 'multiply'; c.drawImage(grainC, 0, 0);
  c.globalCompositeOperation = 'source-over';
}
window.renderAt = async (t, type = 'image/png', q = .92) => { T = t; await redraw(); composite(); return outC.toDataURL(type, q); };
window.renderSheet = async (times, cols = 3, w = 640, crop = null, at = null) => {
  if (at) at = at.map((v) => typeof v === 'string' ? (0, eval)(v) : v);
  const [, , cw, ch] = at || crop || [0, 0, W, H], h = Math.round(w * ch / cw), rows = Math.ceil(times.length / cols), sc = document.createElement('canvas');
  sc.width = cols * w; sc.height = rows * h; const c = sc.getContext('2d'), ms = [];
  for (let i = 0; i < times.length; i++) {
    const t0 = performance.now(); T = times[i]; await redraw(); composite(); ms.push(Math.round(performance.now() - t0));
    const x = (i % cols) * w, y = Math.floor(i / cols) * h;
    const [cx, cy] = at ? toScreen(at[0], at[1], LAST_CAM).map((v, j) => v - (j ? ch : cw) / 2) : crop || [0, 0];
    c.drawImage(outC, cx * S, cy * S, cw * S, ch * S, x, y, w, h); c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(x, y, 84, 24); c.fillStyle = '#fff'; c.font = '15px sans-serif'; c.fillText(times[i].toFixed(2) + 's', x + 6, y + 17);
  }
  return { url: sc.toDataURL('image/jpeg', .9), ms };
};
window.gpuInfo = () => { const gl = drawingContext, e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); };
window.projectInfo = () => ({ ...PROJECT, W, H, CW: CW(), CH: CH() });

function devUI() {
  const s = document.getElementById('scrub'), lab = document.getElementById('tt'); s.max = window.LOOP ? window.LOOP.len : DUR;
  let busy = false, want = null;
  const go = async () => { if (busy) return; busy = true; while (want != null) { const t = want; want = null; const t0 = performance.now(); await window.renderAt(t); lab.textContent = `${PROJECT.name} · ${t.toFixed(2)}s  ·  ${Math.round(performance.now() - t0)} ms/frame`; } busy = false; };
  s.addEventListener('input', () => { want = +s.value; go(); });
  want = +(new URLSearchParams(location.search).get('t') || 0); s.value = want; go();
}
