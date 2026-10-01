// Track the green-suited ninja through source.mp4 and write track.json (per source frame: centroid, bbox, head point,
// face/mouth anchor), smoothed within each shot and never across the hard cut. Coordinates are normalised (0..1) in
// the 1280x720 source frame. Used by the intro-video render page (camera + balloon tails).
// usage: node tools/dev/introvid/track.mjs [--sheet]   (--sheet also writes /tmp/yl/introvid/track_sheet.png;
//        MASKDUMP=0,96 dumps the suit/face masks of those frames to /tmp/yl/introvid/mask_<i>.ppm)
import { spawn, execFileSync } from 'child_process';
import fs from 'fs';

const DIR = new URL('./', import.meta.url).pathname;
const SRC = DIR + 'source.mp4';
const W = 320, H = 180, FPS = 24;
const SHEET = process.argv.includes('--sheet');

function decode() {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-v', 'error', '-i', SRC, '-vf', `scale=${W}:${H}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
    const chunks = [];
    ff.stdout.on('data', (c) => chunks.push(c));
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code) return reject(new Error('ffmpeg exited ' + code));
      const buf = Buffer.concat(chunks);
      const n = buf.length / (W * H * 3);
      const frames = [];
      for (let i = 0; i < n; i++) frames.push(buf.subarray(i * W * H * 3, (i + 1) * W * H * 3));
      resolve(frames);
    });
  });
}

function hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx / 255];
}

// suit green: saturated mid green; the energy effect is a much brighter, paler green (excluded); faces are yellow
function masks(px) {
  const suit = new Uint8Array(W * H), yel = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const [h, s, v] = hsv(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]);
    if (h > 95 && h < 160 && s > 0.42 && v > 0.12 && v < 0.86) suit[i] = 1;
    if (h > 38 && h < 62 && s > 0.55 && v > 0.6) yel[i] = 1;
  }
  return { suit, yel };
}

// 3x3 open (erode then dilate) to drop speckle
function open(m) {
  const e = new Uint8Array(W * H), o = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    let ok = 1;
    for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (!m[(y + dy) * W + x + dx]) { ok = 0; break; }
    e[y * W + x] = ok;
  }
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (!e[y * W + x]) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) o[(y + dy) * W + x + dx] = 1;
  }
  return o;
}

function blobs(m) {
  const lab = new Int32Array(W * H), out = [];
  const st = new Int32Array(W * H);
  let id = 0;
  for (let p = 0; p < W * H; p++) {
    if (!m[p] || lab[p]) continue;
    id++;
    let sp = 0; st[sp++] = p; lab[p] = id;
    const b = { id, n: 0, sx: 0, sy: 0, x0: W, y0: H, x1: 0, y1: 0 };
    while (sp) {
      const q = st[--sp], x = q % W, y = (q / W) | 0;
      b.n++; b.sx += x; b.sy += y;
      if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const r = ny * W + nx;
        if (m[r] && !lab[r]) { lab[r] = id; st[sp++] = r; }
      }
    }
    b.cx = b.sx / b.n; b.cy = b.sy / b.n;
    out.push(b);
  }
  return { lab, out };
}

function cutScore(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i += 3) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
  return s / (a.length / 3) / 3;
}

const frames = await decode();
const N = frames.length;
// hard cut: the frame with the largest mean abs difference to its predecessor
const diffs = [0];
for (let i = 1; i < N; i++) diffs.push(cutScore(frames[i - 1], frames[i]));
let cut = 1;
for (let i = 1; i < N; i++) if (diffs[i] > diffs[cut]) cut = i;
const sortedDiffs = diffs.slice(1).sort((a, b) => a - b);
console.log(`frames ${N}, cut at frame ${cut} (${(cut / FPS).toFixed(3)} s), diff ${diffs[cut].toFixed(1)} vs median ${sortedDiffs[N >> 1].toFixed(1)}`);

const raw = [];
let prev = null;
for (let i = 0; i < N; i++) {
  if (i === cut) prev = null;
  const { suit, yel } = masks(frames[i]);
  const m = open(suit);
  if (process.env.MASKDUMP && process.env.MASKDUMP.split(',').includes(String(i))) {
    const img = Buffer.alloc(W * H * 3);
    for (let p = 0; p < W * H; p++) { img[p * 3] = m[p] * 255; img[p * 3 + 1] = yel[p] * 255; img[p * 3 + 2] = suit[p] * 120; }
    fs.writeFileSync(`/tmp/yl/introvid/mask_${i}.ppm`, Buffer.concat([Buffer.from(`P6\n${W} ${H}\n255\n`), img]));
  }
  const { lab, out } = blobs(m);
  const wide = i >= cut;
  // the close-up ninja is a huge blob on the left; in the wide shot he is the biggest blob near the centre
  // (green-shirted crowd minifigs are smaller and off to the sides). Temporal gating against the previous pick.
  let best = null, bestScore = -1;
  for (const b of out) {
    if (b.n < 30) continue;
    let score = b.n;
    const cxn = b.cx / W;
    if (wide) score *= Math.exp(-((cxn - 0.48) ** 2) / (2 * 0.12 ** 2));
    if (prev) score *= Math.exp(-(((b.cx - prev.cx) / W) ** 2 + ((b.cy - prev.cy) / H) ** 2) / (2 * 0.12 ** 2));
    if (score > bestScore) { bestScore = score; best = b; }
  }
  // merge in nearby large pieces (the sash / gold shoulder armour splits the suit into several blobs)
  const pick = new Set([best.id]);
  const pad = 6;
  for (const b of out) {
    if (b === best || b.n < 25) continue;
    // close-up: everything big in the left 62% is him (no other green there); wide: touching pieces near his centre
    if (!wide) { if (b.n >= 40 && b.cx < 0.62 * W) pick.add(b.id); continue; }
    if (b.x1 >= best.x0 - pad && b.x0 <= best.x1 + pad && b.y1 >= best.y0 - pad && b.y0 <= best.y1 + pad &&
      Math.abs(b.cx - best.cx) < 0.09 * W) pick.add(b.id);
  }
  let n = 0, sx = 0, sy = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let p = 0; p < W * H; p++) {
    if (!pick.has(lab[p])) continue;
    const x = p % W, y = (p / W) | 0;
    n++; sx += x; sy += y;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const cx = sx / n, cy = sy / n;
  // face: yellow pixels sandwiched between suit green above and below (the eye slit in the hood), inside the bbox
  const hood = (x, y) => y >= 0 && y < H && suit[y * W + x];
  let fn = 0, fx = 0, fy = 0;
  const reach = wide ? 6 : 16;
  for (let y = y0; y <= Math.min(y1, y0 + (y1 - y0) * 0.6); y++) for (let x = Math.max(0, x0 - 2); x <= Math.min(W - 1, x1 + 2); x++) {
    if (!yel[y * W + x]) continue;
    let up = false, dn = false;
    for (let d = 1; d <= reach; d++) { if (hood(x, y - d)) up = true; if (hood(x, y + d)) dn = true; }
    if (up && dn) { fn++; fx += x; fy += y; }
  }
  // head: the topmost suit rows of the main blob near the face (or the column band of the upper body)
  // top-of-suit estimate (median x of the picked pixels in a band under the top row): the fallback head point
  const band = Math.round((wide ? 0.07 : 0.14) * H), xs = [];
  for (let y = y0; y < Math.min(H, y0 + band); y++) for (let x = x0; x <= x1; x++) if (pick.has(lab[y * W + x])) xs.push(x);
  xs.sort((a, b) => a - b);
  const tx = xs[xs.length >> 1] / W, ty = y0 / H;
  const minFace = wide ? 6 : 40;
  let hx, hy;
  if (fn >= minFace) { hx = fx / fn; hy = fy / fn; } else { hx = NaN; hy = NaN; }
  raw.push({ tx, ty, cx: cx / W, cy: cy / H, x0: x0 / W, y0: y0 / H, x1: (x1 + 1) / W, y1: (y1 + 1) / H, n: n / (W * H), fx: hx / W, fy: hy / H, fn });
  prev = { cx, cy };
}

// fill missing face detections by interpolation within the shot, then smooth everything within each shot
const shots = [[0, cut], [cut, N]];
function fillNaN(key) {
  for (const [a, b] of shots) {
    const ok = [];
    for (let i = a; i < b; i++) if (Number.isFinite(raw[i][key])) ok.push(i);
    for (let i = a; i < b; i++) {
      if (Number.isFinite(raw[i][key])) continue;
      let lo = null, hi = null;
      for (const k of ok) { if (k < i) lo = k; if (k > i && hi === null) hi = k; }
      if (lo === null && hi === null) raw[i][key] = NaN;
      else if (lo === null) raw[i][key] = raw[hi][key];
      else if (hi === null) raw[i][key] = raw[lo][key];
      else raw[i][key] = raw[lo][key] + (raw[hi][key] - raw[lo][key]) * (i - lo) / (hi - lo);
    }
  }
}
// where the face is hidden (he turns away), use the top-of-suit point plus the shot's median face offset
for (const [a, b] of shots) {
  const dx = [], dy = [];
  for (let i = a; i < b; i++) if (Number.isFinite(raw[i].fx)) { dx.push(raw[i].fx - raw[i].tx); dy.push(raw[i].fy - raw[i].ty); }
  dx.sort((p, q) => p - q); dy.sort((p, q) => p - q);
  const mdx = dx[dx.length >> 1] || 0, mdy = dy[dy.length >> 1] || 0;
  console.log(`shot ${a}-${b}: face seen in ${dx.length} frames, face-top offset ${mdx.toFixed(3)},${mdy.toFixed(3)}`);
  for (let i = a; i < b; i++) if (!Number.isFinite(raw[i].fx)) { raw[i].fx = raw[i].tx + mdx; raw[i].fy = raw[i].ty + mdy; raw[i].est = 1; }
}
fillNaN('fx'); fillNaN('fy');
// robust smoothing: median of 7 then gaussian (sigma 3 frames), clamped at shot edges
function smooth(key, sigma = 3) {
  const res = new Array(N);
  for (const [a, b] of shots) {
    const med = [];
    for (let i = a; i < b; i++) {
      const w = [];
      for (let k = Math.max(a, i - 3); k <= Math.min(b - 1, i + 3); k++) w.push(raw[k][key]);
      w.sort((p, q) => p - q);
      med[i - a] = w[w.length >> 1];
    }
    for (let i = a; i < b; i++) {
      let s = 0, ws = 0;
      const R = Math.ceil(3 * sigma);
      for (let k = Math.max(a, i - R); k <= Math.min(b - 1, i + R); k++) {
        const wt = Math.exp(-((k - i) ** 2) / (2 * sigma * sigma));
        s += med[k - a] * wt; ws += wt;
      }
      res[i] = s / ws;
    }
  }
  return res;
}
const keys = ['cx', 'cy', 'x0', 'y0', 'x1', 'y1', 'fx', 'fy'];
const sm = {};
for (const k of keys) sm[k] = smooth(k, k === 'fx' || k === 'fy' ? 2.5 : 3);

const r3 = (v) => Math.round(v * 1000) / 1000;
const out = {
  source: 'source.mp4', fps: FPS, width: 1280, height: 720, frames: N, cut,
  note: 'normalised source coords; c=suit centroid, box=[x0,y0,x1,y1], head=face (eye slit) centre, mouth=just below it',
  f: [],
};
for (let i = 0; i < N; i++) {
  const wide = i >= cut;
  const fx = sm.fx[i], fy = sm.fy[i];
  // mouth sits under the eye slit (behind the mask): ~0.6 face-heights lower
  const faceH = wide ? 0.035 : 0.09;
  out.f.push({
    c: [r3(sm.cx[i]), r3(sm.cy[i])],
    box: [r3(sm.x0[i]), r3(sm.y0[i]), r3(sm.x1[i]), r3(sm.y1[i])],
    head: [r3(fx), r3(fy)],
    mouth: [r3(fx), r3(fy + faceH * 0.6)],
    q: raw[i].est ? 0 : raw[i].fn,
  });
}
fs.writeFileSync(DIR + 'track.json', JSON.stringify(out));
console.log('wrote track.json; face detections per frame (min/median):',
  Math.min(...raw.map((r) => r.fn)), raw.map((r) => r.fn).sort((a, b) => a - b)[N >> 1]);

if (SHEET) {
  // draw the track onto every 12th frame and tile them (ffmpeg drawbox via a sendcmd-free approach: one png per frame)
  fs.mkdirSync('/tmp/yl/introvid/trk', { recursive: true });
  const picks = [];
  for (let i = 0; i < N; i += 12) picks.push(i);
  picks.push(cut - 1, cut);
  picks.sort((a, b) => a - b);
  for (const i of picks) {
    const f = out.f[i], px = frames[i];
    const img = Buffer.from(px);
    const dot = (nx, ny, rgb, r = 2) => {
      const X = Math.round(nx * W), Y = Math.round(ny * H);
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = X + dx, y = Y + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        img[(y * W + x) * 3] = rgb[0]; img[(y * W + x) * 3 + 1] = rgb[1]; img[(y * W + x) * 3 + 2] = rgb[2];
      }
    };
    const [bx0, by0, bx1, by1] = f.box;
    for (let t = 0; t <= 1; t += 0.005) {
      dot(bx0 + (bx1 - bx0) * t, by0, [255, 0, 255], 0); dot(bx0 + (bx1 - bx0) * t, by1, [255, 0, 255], 0);
      dot(bx0, by0 + (by1 - by0) * t, [255, 0, 255], 0); dot(bx1, by0 + (by1 - by0) * t, [255, 0, 255], 0);
    }
    dot(f.c[0], f.c[1], [0, 0, 255], 3);
    dot(f.head[0], f.head[1], [255, 0, 0], 3);
    dot(f.mouth[0], f.mouth[1], [255, 255, 255], 2);
    const ppm = Buffer.concat([Buffer.from(`P6\n${W} ${H}\n255\n`), img]);
    fs.writeFileSync(`/tmp/yl/introvid/trk/${String(i).padStart(3, '0')}.ppm`, ppm);
  }
  const files = fs.readdirSync('/tmp/yl/introvid/trk').filter((f) => f.endsWith('.ppm')).sort();
  const cols = 5, rows = Math.ceil(files.length / cols);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-pattern_type', 'glob', '-i', '/tmp/yl/introvid/trk/*.ppm',
    '-vf', `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='%{frame_num}':x=4:y=4:fontsize=12:fontcolor=white:box=1:boxcolor=black,tile=${cols}x${rows}`,
    '-frames:v', '1', '/tmp/yl/introvid/track_sheet.png']);
  console.log('order:', files.map((f) => parseInt(f, 10)).join(' '));
  console.log('wrote /tmp/yl/introvid/track_sheet.png');
}
