// Every 2D overlay of the intro video, drawn with q5 (instance mode, 2D canvas): comic panel gutter/border, speech
// balloons with curved tails, caption boxes, the name stamp, SFX lettering, speed lines, halftone bursts, chips.
// Pure function of (t, camera, track): no clocks, no Math.random.
import { SIZE, SRC_W, SRC_H, CLIP_END, B, clamp, lerp, outBack, outCubic, inOut, ramp, pop, rng, wob } from './timeline.js';
import { toScreen } from './camera.js';

const INK = '#111111';
const PAPER = '#fffdf4';
const YELLOW = '#ffd84a';
const GOLD = '#f2b84b';
const NAVY = '#182b49';
const GREEN = '#7dff6a';
const BANG = 'Bangers';
const NEUE = '"Comic Neue"';
const RAD = Math.PI / 180;

let q = null;
export function initOverlay(q5) { q = q5; }

function ctx() { return q.drawingContext; }
function alpha(a) { ctx().globalAlpha = clamp(a); }

function font(name, size) {
  q.textFont(name);
  q.textWeight(name === NEUE ? 700 : 400);
  q.textSize(size);
}

// ---- primitives --------------------------------------------------------------------------------------------------

// comic paper gutter + black panel border around the inner rect inset by g px (g <= 0: full bleed)
export function panel(g, border = 5) {
  if (g <= -border) return;
  q.push();
  q.noStroke();
  q.fill(PAPER);
  if (g > 0) {
    q.rect(0, 0, SIZE, g); q.rect(0, SIZE - g, SIZE, g); q.rect(0, 0, g, SIZE); q.rect(SIZE - g, 0, g, SIZE);
  }
  q.noFill();
  q.stroke(INK);
  q.strokeWeight(border);
  q.strokeJoin(q.MITER);
  const o = g + border / 2;
  q.rect(o, o, SIZE - 2 * o, SIZE - 2 * o);
  q.pop();
}

// text lines block, centred at (0,0) in the current transform; returns nothing
function lines(strs, size, lead = 1.08) {
  const h = size * lead;
  const y0 = -((strs.length - 1) * h) / 2;
  strs.forEach((s, i) => q.text(s, 0, y0 + i * h + size * 0.04));
}

function measure(strs, size, name) {
  font(name, size);
  return Math.max(...strs.map((s) => q.textWidth(s)));
}

// a rectangular caption box (top-left anchored at x,y unless anchor given), slight tilt, hard ink shadow
function captionBox(x, y, strs, o = {}) {
  const size = o.size || 32, name = o.font || BANG, pad = o.pad || [14, 9];
  const lead = o.lead || 1.08;
  const sizes = o.sizes || strs.map(() => size);
  const w = Math.max(...strs.map((s, i) => measure([s], sizes[i], name))) + pad[0] * 2;
  const lh = sizes.map((z) => z * lead);
  const h = lh.reduce((p, v) => p + v, 0) + pad[1] * 2 - sizes[sizes.length - 1] * (lead - 1);
  const ax = o.anchor ? o.anchor[0] : 0, ay = o.anchor ? o.anchor[1] : 0;
  q.push();
  q.translate(x, y);
  q.rotate((o.tilt || 0) * RAD);
  q.scale(o.s ?? 1);
  alpha(o.a ?? 1);
  q.translate(-ax * w, -ay * h);
  q.noStroke();
  q.fill(INK);
  q.rect(6, 6, w, h);
  q.fill(o.fill || YELLOW);
  q.stroke(INK);
  q.strokeWeight(4);
  q.strokeJoin(q.MITER);
  q.rect(0, 0, w, h);
  q.noStroke();
  q.fill(o.ink || INK);
  const left = o.align === 'left';
  q.textAlign(left ? q.LEFT : q.CENTER, q.CENTER);
  const shown = o.typed !== undefined ? typeOn(strs, o.typed) : strs;
  let yy = pad[1];
  shown.forEach((s, i) => {
    font(name, sizes[i]);
    q.text(s, left ? pad[0] : w / 2, yy + sizes[i] / 2 + sizes[i] * 0.04);
    yy += lh[i];
  });
  q.pop();
  return { w, h };
}

// type-on: show the first n characters across the lines
function typeOn(strs, n) {
  const out = [];
  let left = Math.floor(n);
  for (const s of strs) { out.push(s.slice(0, Math.max(0, left))); left -= s.length; }
  return out;
}

// irregular ellipse outline points
function blobPts(cx, cy, rx, ry, seed, n = 72) {
  const r = rng(seed);
  const p1 = r() * 6.28, p2 = r() * 6.28, p3 = r() * 6.28;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + 0.03 * Math.sin(3 * a + p1) + 0.022 * Math.sin(5 * a + p2) + 0.012 * Math.sin(8 * a + p3);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}

// speech balloon at (cx,cy) radii rx/ry; tail towards (tx,ty) ending short of it by gap px; bend curves the tail
function balloon(cx, cy, rx, ry, strs, o = {}) {
  const size = o.size || 40, seed = o.seed || 1, s = o.s ?? 1;
  q.push();
  alpha(o.a ?? 1);
  // scale about the tail root so the balloon pops out of the speaker
  q.translate(cx, cy);
  q.scale(s);
  q.translate(-cx, -cy);
  const pts = blobPts(cx, cy, rx, ry, seed);
  let tail = null;
  if (o.tail) {
    let [tx, ty] = o.tail;
    const dx = tx - cx, dy = ty - cy, d = Math.hypot(dx, dy);
    const gap = o.gap ?? 20;
    tx = cx + dx * (d - gap) / d; ty = cy + dy * (d - gap) / d;
    const ang = Math.atan2(dy / ry, dx / rx);
    const spread = o.spread || 0.2;
    const b1 = [cx + Math.cos(ang - spread) * rx * 0.94, cy + Math.sin(ang - spread) * ry * 0.94];
    const b2 = [cx + Math.cos(ang + spread) * rx * 0.94, cy + Math.sin(ang + spread) * ry * 0.94];
    const nx = -dy / d, ny = dx / d, bend = (o.bend ?? 0.18) * d;
    const mx = (cx + tx) / 2 + nx * bend, my = (cy + ty) / 2 + ny * bend;
    tail = { b1, b2, tip: [tx, ty], c: [mx, my] };
  }
  const shape = () => {
    q.beginShape();
    for (const p of pts) q.vertex(p[0], p[1]);
    q.endShape(q.CLOSE);
    if (tail) {
      const { b1, b2, tip, c } = tail;
      q.beginShape();
      q.vertex(b1[0], b1[1]);
      q.quadraticVertex(lerp(c[0], b1[0], 0.25), lerp(c[1], b1[1], 0.25), tip[0], tip[1]);
      q.quadraticVertex(lerp(c[0], b2[0], 0.25), lerp(c[1], b2[1], 0.25), b2[0], b2[1]);
      q.endShape(q.CLOSE);
    }
  };
  // shadow, outline pass (double width), then fill pass: one merged outline
  q.strokeJoin(q.ROUND);
  q.push(); q.translate(5, 6); q.noStroke(); q.fill(0, 0, 0, 70); shape(); q.pop();
  q.noFill(); q.stroke(INK); q.strokeWeight(9); shape();
  q.noStroke(); q.fill(o.fill || '#ffffff'); shape();
  q.fill(INK);
  q.textAlign(q.CENTER, q.CENTER);
  font(o.font || BANG, size);
  q.push(); q.translate(cx + (o.tx || 0), cy + (o.ty || 0)); lines(strs, size, o.lead || 1.04); q.pop();
  q.pop();
}

function starPts(cx, cy, r1, r2, n, rot = 0, seed = 0) {
  const r = rng(seed + 3);
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * Math.PI * 2;
    const rr = i % 2 ? r2 : r1 * (seed ? lerp(0.82, 1.12, r()) : 1);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}
function poly(pts) {
  q.beginShape();
  for (const p of pts) q.vertex(p[0], p[1]);
  q.endShape(q.CLOSE);
}

// spiky burst with a halftone dot fill (behind the name stamp)
function burst(cx, cy, r1, r2, n, seed, col, s, a, rot, sy = 1) {
  q.push();
  alpha(a);
  q.translate(cx, cy); q.scale(s, s * sy); q.translate(-cx, -cy);
  const pts = starPts(cx, cy, r1, r2, n, rot, seed);
  q.stroke(INK); q.strokeWeight(5); q.strokeJoin(q.MITER); q.fill(col);
  poly(pts);
  // halftone dots, clipped to the burst, bigger towards the middle
  const c = ctx();
  c.save();
  c.beginPath();
  pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
  c.closePath();
  c.clip();
  q.noStroke();
  q.fill(255, 255, 255, 140);
  const step = 13;
  for (let y = cy - r1; y <= cy + r1; y += step) {
    for (let x = cx - r1; x <= cx + r1; x += step) {
      const ox = ((Math.round((y - cy) / step) & 1) * step) / 2;
      const d = Math.hypot(x + ox - cx, y - cy) / r1;
      const rr = (1 - d) * step * 0.42;
      if (rr > 0.6) q.circle(x + ox, y, rr * 2);
    }
  }
  c.restore();
  q.pop();
}

// SFX lettering: fill, thick ink outline, hard offset shadow
function sfx(str, x, y, size, o = {}) {
  q.push();
  alpha(o.a ?? 1);
  q.translate(x, y);
  q.rotate((o.rot || 0) * RAD);
  q.scale(o.s ?? 1);
  font(BANG, size);
  q.textAlign(q.CENTER, q.CENTER);
  q.strokeJoin(q.ROUND);
  const sw = o.sw || size * 0.16;
  // shadow
  q.fill(o.shadow || INK); q.stroke(o.shadow || INK); q.strokeWeight(sw);
  q.text(str, size * 0.07, size * 0.09);
  // outline + fill
  q.stroke(INK); q.strokeWeight(sw);
  if (o.grad) {
    const c = ctx();
    const g = c.createLinearGradient(0, -size * 0.45, 0, size * 0.45);
    o.grad.forEach((col, i) => g.addColorStop(i / (o.grad.length - 1), col));
    q.fill(o.grad[0]);
    q.text(str, 0, 0);
    q.noStroke();
    c.fillStyle = g;
    c.fillText(str, 0, 0);
  } else {
    q.fill(o.fill || '#ffffff');
    q.text(str, 0, 0);
  }
  if (o.inner) {
    q.noFill(); q.stroke(o.inner); q.strokeWeight(2);
    q.text(str, 0, 0);
  }
  q.pop();
}

// letters on an arc (centre cx,cy, radius R), centred on angle a0 (radians, 0 = right, +pi/2 = down)
function arcText(str, cx, cy, R, a0, size, o = {}) {
  font(BANG, size);
  const widths = [...str].map((ch) => q.textWidth(ch) * (o.track || 1.04));
  const total = widths.reduce((p, w) => p + w, 0);
  const dir = o.under ? -1 : 1; // under = text on the bottom of the circle, reading left to right
  let a = a0 - (dir * total / 2) / R;
  const pass = (fn) => {
    let aa = a;
    [...str].forEach((ch, i) => {
      const am = aa + (dir * widths[i] / 2) / R;
      const k = o.letterScale ? o.letterScale(i) : 1;
      q.push();
      q.translate(cx + Math.cos(am) * R, cy + Math.sin(am) * R);
      q.rotate(am + (o.under ? -Math.PI / 2 : Math.PI / 2));
      q.scale(k);
      fn(ch);
      q.pop();
      aa += (dir * widths[i]) / R;
    });
  };
  q.push();
  alpha(o.a ?? 1);
  q.textAlign(q.CENTER, q.CENTER);
  q.strokeJoin(q.ROUND);
  const sw = size * 0.17;
  pass((ch) => { q.fill(INK); q.stroke(INK); q.strokeWeight(sw); q.text(ch, size * 0.08, size * 0.1); });
  pass((ch) => { q.fill(INK); q.stroke(INK); q.strokeWeight(sw); q.text(ch, 0, 0); });
  pass((ch) => {
    const c = ctx();
    const g = c.createLinearGradient(0, -size * 0.42, 0, size * 0.42);
    g.addColorStop(0, '#fff27a'); g.addColorStop(0.45, '#ffc53a'); g.addColorStop(1, '#ff7a1a');
    q.noStroke();
    c.fillStyle = g;
    c.fillText(ch, 0, 0);
  });
  q.pop();
}

// radial speed lines from the frame edge inwards (thin ink wedges), re-rolled every 2 frames
function speedLines(cx, cy, inner, count, seed, a) {
  const r = rng(seed);
  q.push();
  alpha(a);
  q.noStroke();
  q.fill(INK);
  const R = SIZE * 0.9;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + (r() - 0.5) * 0.12;
    const w = lerp(0.004, 0.014, r());
    const ri = inner * lerp(1.0, 1.35, r());
    q.beginShape();
    q.vertex(cx + Math.cos(ang - w) * R, cy + Math.sin(ang - w) * R);
    q.vertex(cx + Math.cos(ang) * ri, cy + Math.sin(ang) * ri);
    q.vertex(cx + Math.cos(ang + w) * R, cy + Math.sin(ang + w) * R);
    q.endShape(q.CLOSE);
  }
  q.pop();
}

// tilted label chip with a star bullet, top-left anchored
function chip(x, y, strs, o) {
  const size = o.size || 30;
  const pad = [16, 9];
  const bullet = size * 1.25;
  const w = measure(strs, size, BANG) + pad[0] * 2 + bullet;
  const h = strs.length * size * 1.05 + pad[1] * 2 - size * 0.05;
  q.push();
  q.translate(x, y + h / 2);
  q.rotate((o.tilt || 0) * RAD);
  q.scale(o.s ?? 1);
  alpha(o.a ?? 1);
  q.translate(0, -h / 2);
  q.noStroke(); q.fill(INK); q.rect(6, 6, w, h, 6);
  q.fill(o.fill || '#ffffff'); q.stroke(INK); q.strokeWeight(4); q.rect(0, 0, w, h, 6);
  // star bullet
  q.push();
  q.translate(pad[0] + bullet * 0.38, h / 2);
  q.rotate(-0.3);
  q.fill(GOLD); q.stroke(INK); q.strokeWeight(3); q.strokeJoin(q.ROUND);
  poly(starPts(0, 0, size * 0.55, size * 0.24, 5, -Math.PI / 2));
  q.pop();
  q.noStroke(); q.fill(INK);
  font(BANG, size);
  q.textAlign(q.LEFT, q.CENTER);
  q.translate(pad[0] + bullet, h / 2);
  const lh = size * 1.05, y0 = -((strs.length - 1) * lh) / 2;
  strs.forEach((s, i) => q.text(s, 0, y0 + i * lh + size * 0.04));
  q.pop();
  return { w, h };
}

function flash(a) {
  if (a <= 0) return;
  q.push(); alpha(a); q.noStroke(); q.fill(255); q.rect(0, 0, SIZE, SIZE); q.pop();
}

// ---- the timeline --------------------------------------------------------------------------------------------------

export function gutterAt(t) {
  // intro: paper gutter 16 px, opens to full bleed as the panel comes alive; outro: slams back in
  if (t < CLIP_END) {
    const k = inOut(ramp(t, B.alive, B.aliveEnd));
    return lerp(16, -12, k);
  }
  return lerp(-12, 16, outBack(ramp(t, CLIP_END, CLIP_END + 0.2), 2.2));
}

export function drawOverlay(t, cam, trk, frame) {
  const sc = (p) => toScreen(cam, p[0] * SRC_W, p[1] * SRC_H);
  const mouth = sc(trk.mouth);

  // 1. intro caption (stays through the first line of dialogue)
  {
    const p = pop(t, B.caption[0], B.caption[1]);
    if (p.on) captionBox(36, 36, ['MEANWHILE, AT', 'GEISEL LIBRARY...'], { size: 33, tilt: -2.5, s: p.s, a: p.a, anchor: [0, 0], align: 'left' });
  }

  // 2. HEY EVERYONE!
  {
    const p = pop(t, B.hey[0], B.hey[1]);
    if (p.on) {
      const w = wob(t, 3, 0.7) * 2;
      balloon(566 + w, 292, 116, 72, ['HEY', 'EVERYONE!'], { size: 42, s: p.s, a: p.a, tail: mouth, gap: 60, seed: 4, bend: -0.12 });
    }
  }

  // 3. SECRET IDENTITY block (right side, over the crowd)
  if (t >= B.secret && t < B.cut) {
    const out = ramp(t, B.secretOut, B.secretOut + 0.14);
    const fade = 1 - out;
    const ps = pop(t, B.secret, 99);
    const slide = outCubic(ramp(t, B.secret, B.secret + 0.22));
    let st = 0;
    if (t >= B.name) {
      const k = t - B.name;
      st = k < 0.2 ? lerp(2.4, 1, outCubic(k / 0.2)) : 1 - 0.06 * Math.exp(-(k - 0.2) / 0.08) * Math.sin((k - 0.2) * 40);
      burst(538, 330, 128, 84, 13, 9, GOLD, outBack(ramp(t, B.name + 0.08, B.name + 0.3)) * (1 + 0.02 * wob(t, 2, 0.5)), fade, t * 0.15, 0.74);
    }
    captionBox(690 + (1 - slide) * 260, 236, ['SECRET IDENTITY:'], { size: 32, tilt: -2, a: fade * ps.a, anchor: [1, 0], fill: YELLOW });
    if (t >= B.name) sfx('YICHEN LIN', 536, 330, 60, { s: st * (1 - out * 0.3), a: fade * clamp((t - B.name) / 0.06), rot: -4, fill: YELLOW, shadow: NAVY, sw: 11 });
    if (t >= B.line1) {
      const p = pop(t, B.line1, 99);
      captionBox(690, 398, ['PH.D. STUDENT ·', 'UC SAN DIEGO CSE'], { size: 30, tilt: 1.5, s: p.s, a: fade, anchor: [1, 0], fill: '#ffffff', typed: (t - B.line1) * 35 });
    }
    if (t >= B.line2) {
      const p = pop(t, B.line2, 99);
      captionBox(690, 506, ['WITH PROF.', 'YUFEI DING'], { size: 30, tilt: -1.5, s: p.s, a: fade, anchor: [1, 0], fill: '#ffffff', typed: (t - B.line2) * 35 });
    }
  }

  // 4. hard cut: two-frame white flash
  if (t >= B.cut && t < B.cut + 0.1) flash(t < B.cut + 1 / 24 ? 0.85 : 0.35);

  // 5. GREAT TO BE HERE AT UC SAN DIEGO!
  {
    const p = pop(t, B.great[0], B.great[1]);
    if (p.on) {
      const head = sc(trk.head);
      balloon(566 + wob(t, 8, 0.6) * 2, 214, 112, 88, ['GREAT TO BE', 'HERE AT', 'UC SAN DIEGO!'], { size: 34, s: p.s, a: p.a, tail: head, gap: 34, seed: 12, bend: 0.16 });
    }
  }

  // 6. SHING! near the raised blade
  {
    const p = pop(t, B.shing[0], B.shing[1], 0.14, 0.12);
    if (p.on) {
      const tip = toScreen(cam, 0.262 * SRC_W, 0.13 * SRC_H);
      q.push();
      alpha(p.a);
      q.translate(tip[0], tip[1]);
      q.rotate(t * 2.2);
      q.fill('#ffffff'); q.stroke(INK); q.strokeWeight(3); q.strokeJoin(q.ROUND);
      poly(starPts(0, 0, 30 * p.s, 8 * p.s, 4));
      q.pop();
      sfx('SHING!', tip[0] + 104, tip[1] - 22, 52, { s: p.s, a: p.a, rot: -14, fill: '#ffffff', inner: GREEN, shadow: '#1d7a2a' });
    }
  }

  // 7. WHOOOSH! + speed lines during the spin
  {
    const p = pop(t, B.spin[0], B.spin[1], 0.22, 0.16);
    if (p.on) {
      const env = clamp(p.k / 0.2) * clamp((B.spin[1] - t) / 0.2);
      speedLines(360, 330, 300, 70, 100 + Math.floor(frame / 2), env * 0.9);
      const rot = (t - B.spin[0]) * 0.18;
      arcText('WHOOOSH!', 360, 250, 330, Math.PI / 2 - rot, 92, {
        under: true, a: p.a,
        letterScale: (i) => p.s * (1 + 0.08 * Math.sin(t * 14 - i * 0.9)),
      });
    }
  }

  // 8. *LIBRARY-VOLUME APPLAUSE* caption (top left, clear of the sign)
  {
    const p = pop(t, B.applause[0], B.applause[1]);
    if (p.on) captionBox(40, 40, ['*LIBRARY-VOLUME', 'APPLAUSE*'], { size: 30, tilt: -2, s: p.s, a: p.a, fill: YELLOW });
  }

  // 9. SHHH! from an unseen librarian (tail out of frame, right)
  {
    const p = pop(t, B.shhh[0], B.shhh[1]);
    if (p.on) balloon(600, 330, 76, 50, ['SHHH!'], { size: 42, s: p.s, a: p.a, tail: [770, 380], gap: 0, seed: 21, bend: -0.1, spread: 0.3 });
  }

  // 10. outro: flash, SUPERPOWERS + chips, TO BE CONTINUED
  if (t >= CLIP_END) {
    flash(t < CLIP_END + 1 / 24 ? 0.7 : 0);
    const ph = pop(t, B.powers, 99);
    if (ph.on) captionBox(44, 52, ['SUPERPOWERS:'], { size: 50, tilt: -3, s: ph.s, a: ph.a, fill: YELLOW });
    const items = [['AI FOR SCIENCE', '& CHIP DESIGN'], ['ARCHITECTURE FOR', 'AGENTIC WORKLOADS'], ['HARNESSES &', 'BENCHMARKS']];
    const tilts = [-2.5, 2, -1.5];
    items.forEach((it, i) => {
      const p = pop(t, B.chips[i], 99);
      if (p.on) chip(52 + i * 8, 158 + i * 118, it, { size: 33, tilt: tilts[i] + 0.6 * wob(t, 40 + i, 0.4), s: p.s, a: p.a });
    });
    const pc = pop(t, B.cont, 99);
    if (pc.on) {
      q.push();
      captionBox(44, 676, ['TO BE CONTINUED...', '(IN THE NEXT PAPER)'], { size: 36, sizes: [36, 29], tilt: -1, s: pc.s, a: pc.a, anchor: [0, 1], fill: YELLOW });
      q.pop();
    }
  }
}
