// Glass for the intro's last beat. fracture() cracks the screen around the impact point the way a hit pane
// breaks: rays out of the hit, rings around it, the big outer cells split again, everything clipped to the
// screen. The same polygons draw the cracks on the 2D stage (drawCracks), become the three.js shards
// (shatter3d.js) or fall on the 2D canvas when three.js is not there (drawShards2D). Units: CSS pixels.

const TAU = Math.PI * 2;
export const GRAVITY = 2600;   // px/s², screen y points down

const area = (p) => {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; }
  return a / 2;
};
const centroid = (p) => {
  let x = 0, y = 0;
  for (const q of p) { x += q[0]; y += q[1]; }
  return [x / p.length, y / p.length];
};

// split a convex polygon by the line through (px, py) with direction (dx, dy)
function cut(poly, px, py, dx, dy) {
  const a = [], b = [];
  const side = (q) => dx * (q[1] - py) - dy * (q[0] - px);
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const sp = side(p), sq = side(q);
    (sp >= 0 ? a : b).push(p);
    if ((sp >= 0) !== (sq >= 0)) {
      const t = sp / (sp - sq);
      const x = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      a.push(x); b.push(x);
    }
  }
  return [a, b].filter((r) => r.length >= 3);
}

// keep splitting a shard across its long side until it is no bigger than `max`
function subdivide(poly, max, rand, out) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (Math.max(x1 - x0, y1 - y0) <= max) { out.push(poly); return; }
  const [cx, cy] = centroid(poly);
  const along = x1 - x0 > y1 - y0 ? Math.PI / 2 : 0;   // cut across the longer extent
  const a = along + (rand() - 0.5) * 0.9;
  const parts = cut(poly, cx + (rand() - 0.5) * (x1 - x0) * 0.2, cy + (rand() - 0.5) * (y1 - y0) * 0.2, Math.cos(a), Math.sin(a));
  if (parts.length < 2) { out.push(poly); return; }
  for (const p of parts) subdivide(p, max, rand, out);
}

// Sutherland-Hodgman against the screen rectangle
function clipRect(poly, w, h) {
  const edges = [
    (p) => p[0] >= 0, (p) => p[0] <= w, (p) => p[1] >= 0, (p) => p[1] <= h,
  ];
  const hit = [
    (p, q) => { const t = (0 - p[0]) / (q[0] - p[0]); return [0, p[1] + (q[1] - p[1]) * t]; },
    (p, q) => { const t = (w - p[0]) / (q[0] - p[0]); return [w, p[1] + (q[1] - p[1]) * t]; },
    (p, q) => { const t = (0 - p[1]) / (q[1] - p[1]); return [p[0] + (q[0] - p[0]) * t, 0]; },
    (p, q) => { const t = (h - p[1]) / (q[1] - p[1]); return [p[0] + (q[0] - p[0]) * t, h]; },
  ];
  let out = poly;
  for (let e = 0; e < 4 && out.length; e++) {
    const src = out; out = [];
    for (let i = 0; i < src.length; i++) {
      const p = src[i], q = src[(i + 1) % src.length];
      const pin = edges[e](p), qin = edges[e](q);
      if (pin) out.push(p);
      if (pin !== qin) out.push(hit[e](p, q));
    }
  }
  return out;
}

/**
 * Crack the w×h screen around (ix, iy). Returns { shards: [{ pts, cx, cy, area }], segs: [{ ax, ay, bx, by,
 * d0, d1 }] (crack lines, a = the end nearer the hit), maxR }.
 */
export function fracture(w, h, ix, iy, rand) {
  const maxR = Math.max(Math.hypot(ix, iy), Math.hypot(w - ix, iy), Math.hypot(ix, h - iy), Math.hypot(w - ix, h - iy));
  const f = Math.min(1.25, Math.max(0.5, Math.hypot(w, h) / 1900));
  const n = Math.round(13 + 5 * Math.min(1, f));
  const base = rand() * TAU;
  const ang = [];
  for (let i = 0; i < n; i++) ang.push(base + (i + (rand() - 0.5) * 0.55) * TAU / n);
  const radii = [];
  for (let r = 26 * f; r < maxR; r *= 1.8 + rand() * 0.6) radii.push(r);
  radii.push(maxR * 1.3);
  const last = radii.length - 1;
  const V = ang.map((a) => radii.map((r, k) => {
    const aj = k === last ? a : a + (rand() - 0.5) * 0.1;
    const rj = k === last ? r : r * (1 + (rand() - 0.5) * 0.3);
    return [ix + Math.cos(aj) * rj, iy + Math.sin(aj) * rj];
  }));
  const cells = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    cells.push([[ix, iy], V[i][0], V[j][0]]);
    for (let k = 0; k < last; k++) {
      const a = V[i][k], b = V[j][k], c = V[j][k + 1], d = V[i][k + 1];
      if (k >= 1 && rand() < 0.3) {
        if (rand() < 0.5) cells.push([a, b, c], [a, c, d]); else cells.push([a, b, d], [b, c, d]);
      } else cells.push([a, b, c, d]);
    }
  }
  const max = 300 * f;
  const shards = [];
  for (const cell of cells) {
    const clipped = clipRect(cell, w, h);
    if (clipped.length < 3 || Math.abs(area(clipped)) < 6) continue;
    const parts = [];
    subdivide(clipped, max, rand, parts);
    for (let p of parts) {
      const a = area(p);
      if (Math.abs(a) < 4) continue;
      if (a < 0) p = p.slice().reverse();   // clockwise on screen (y down) = counter-clockwise in y-up space
      const [cx, cy] = centroid(p);
      shards.push({ pts: p, cx, cy, area: Math.abs(a) });
    }
  }
  // crack lines: every shard edge once, minus the ones lying on the screen border
  const seen = new Set();
  const segs = [];
  const key = (p) => `${Math.round(p[0])},${Math.round(p[1])}`;
  const onBorder = (p, q) => (p[0] <= 0.5 && q[0] <= 0.5) || (p[0] >= w - 0.5 && q[0] >= w - 0.5) || (p[1] <= 0.5 && q[1] <= 0.5) || (p[1] >= h - 0.5 && q[1] >= h - 0.5);
  for (const s of shards) {
    for (let i = 0; i < s.pts.length; i++) {
      const p = s.pts[i], q = s.pts[(i + 1) % s.pts.length];
      const k1 = key(p), k2 = key(q);
      if (k1 === k2 || onBorder(p, q)) continue;
      const k = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const dp = Math.hypot(p[0] - ix, p[1] - iy), dq = Math.hypot(q[0] - ix, q[1] - iy);
      const sg = dp <= dq ? { ax: p[0], ay: p[1], bx: q[0], by: q[1], d0: dp, d1: dq } : { ax: q[0], ay: q[1], bx: p[0], by: p[1], d0: dq, d1: dp };
      // radial cracks all show; the rings and the later splits only here and there (they open when it breaks)
      const mx = (p[0] + q[0]) / 2 - ix, my = (p[1] + q[1]) / 2 - iy, ml = Math.hypot(mx, my) || 1, el = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      sg.radial = Math.abs(((q[0] - p[0]) * mx + (q[1] - p[1]) * my) / (ml * el)) > 0.82;
      sg.vis = sg.radial ? 1 : rand() < (sg.d0 < maxR * 0.18 ? 0.8 : 0.35) ? 0.55 : 0;
      segs.push(sg);
    }
  }
  segs.sort((a, b) => a.d0 - b.d0);
  return { shards, segs, maxR, ix, iy };
}

/** How each shard flies: inner ones first and fast, toward the viewer; outer ones mostly drop. */
export function shardMotion(fr, rand) {
  const { shards, ix, iy, maxR } = fr;
  for (const s of shards) {
    const dx = s.cx - ix, dy = s.cy - iy, d = Math.hypot(dx, dy) || 1;
    const dn = Math.min(1, d / maxR);
    const out = (1 - dn) * 560 + 140 + rand() * 180;
    s.delay = dn * 0.16 + rand() * 0.035;
    s.vx = (dx / d) * out + (rand() - 0.5) * 140;
    s.vy = (dy / d) * out - (140 + rand() * 260) * (1 - dn * 0.5);
    s.vz = (1 - dn) ** 2 * 1700 + rand() * 300;
    const ax = rand() - 0.5, ay = rand() - 0.5, az = (rand() - 0.5) * 0.45, al = Math.hypot(ax, ay, az) || 1;
    s.ax = ax / al; s.ay = ay / al; s.az = az / al;
    s.spin = (2.4 + rand() * 6.5) * (1.3 - dn * 0.6) * (rand() < 0.5 ? -1 : 1);
    s.life = 0.78 + rand() * 0.32;
  }
  return fr;
}

/** The cracks spreading out of the hit: `p` 0..1 is how far they have run. Drawn in CSS px space. */
export function drawCracks(c, fr, p, alpha = 1) {
  if (p <= 0) return;
  const reach = fr.maxR * p;
  c.save();
  c.lineCap = 'round';
  const pass = (width, style, dx, dy) => {
    c.lineWidth = width; c.strokeStyle = style;
    c.beginPath();
    for (const s of fr.segs) {
      if (s.d0 > reach) break;
      if (!s.vis) continue;
      const k = s.d1 <= reach ? 1 : (reach - s.d0) / Math.max(1e-3, s.d1 - s.d0);
      c.moveTo(s.ax + dx, s.ay + dy);
      c.lineTo(s.ax + (s.bx - s.ax) * k + dx, s.ay + (s.by - s.ay) * k + dy);
    }
    c.stroke();
  };
  c.globalAlpha = alpha;
  pass(1.6, 'rgba(0,0,0,0.4)', 1, 1.2);
  c.globalCompositeOperation = 'lighter';
  pass(4, 'rgba(150,225,255,0.16)', 0, 0);
  pass(1, 'rgba(255,255,255,0.8)', 0, 0);
  // the star where it hit
  c.globalCompositeOperation = 'source-over';
  const g = c.createRadialGradient(fr.ix, fr.iy, 0, fr.ix, fr.iy, 46);
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.3, 'rgba(210,245,255,0.5)'); g.addColorStop(1, 'rgba(210,245,255,0)');
  c.fillStyle = g;
  c.beginPath(); c.arc(fr.ix, fr.iy, 46, 0, TAU); c.fill();
  c.restore();
}

// rotation matrix for an axis-angle (row-major 3x3)
function rot(ax, ay, az, a) {
  const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [
    t * ax * ax + c, t * ax * ay - s * az, t * ax * az + s * ay,
    t * ax * ay + s * az, t * ay * ay + c, t * ay * az - s * ax,
    t * ax * az - s * ay, t * ay * az + s * ax, t * az * az + c,
  ];
}

/**
 * The fallback shatter on a 2D canvas (no three.js): every shard is the snapshot clipped to its polygon, moved by
 * the same motion as the 3D one and drawn as the orthographic image of its rotated plane (an affine map), so it
 * still flips in depth. `R` = canvas pixels per CSS pixel, `t` = seconds since the shatter began.
 * Returns false once every shard is gone.
 */
export function drawShards2D(c, snap, fr, t, w, h, R) {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, c.canvas.width, c.canvas.height);
  const cam = (h / 2) / Math.tan((35 / 2) * Math.PI / 180);
  let alive = false;
  for (const s of fr.shards) {
    const tt = Math.max(0, t - s.delay);
    const fade = 1 - Math.min(1, Math.max(0, (tt - (s.life - 0.32)) / 0.32));
    if (fade <= 0) continue;
    const z = s.vz * tt;
    if (cam - z < 90) continue;
    alive = true;
    const k = cam / (cam - z);
    const m = rot(s.ax, s.ay, s.az, s.spin * tt * Math.min(1, tt * 6));
    const x = w / 2 + (s.cx + s.vx * tt - w / 2) * k;
    const y = h / 2 + (s.cy + s.vy * tt + 0.5 * GRAVITY * tt * tt - h / 2) * k;
    c.setTransform(m[0] * k * R, m[3] * k * R, m[1] * k * R, m[4] * k * R, x * R, y * R);
    c.globalAlpha = fade;
    c.beginPath();
    for (let i = 0; i < s.pts.length; i++) {
      const px = s.pts[i][0] - s.cx, py = s.pts[i][1] - s.cy;
      if (i) c.lineTo(px, py); else c.moveTo(px, py);
    }
    c.closePath();
    c.save();
    c.clip();
    c.drawImage(snap, -s.cx, -s.cy, w, h);
    const nz = m[8];
    // a glint as the face turns toward the light, darker as it turns away
    const lit = (-0.4 * m[2] - 0.6 * m[5] + nz) / 1.233 - 0.811;   // light from the upper left, 0 at rest
    if (lit > 0) { c.fillStyle = `rgba(230,250,255,${Math.min(0.55, lit * 2.2)})`; c.fill(); }
    if (Math.abs(nz) < 0.9) { c.fillStyle = `rgba(6,8,20,${(0.9 - Math.abs(nz)) * 0.5})`; c.fill(); }
    c.restore();
    c.lineWidth = 1.4 / k;
    c.strokeStyle = 'rgba(200,240,255,0.75)';
    c.stroke();
  }
  c.globalAlpha = 1;
  return alive;
}
