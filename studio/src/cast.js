// cast.js: painted 2D characters (WIP, header API is written at the end of the work).
(() => {
'use strict';
const PI = Math.PI;

// ---------- palette ----------
const SKIN = '#F1C9A5', HULL = '#4E7DD1', HULLS = '#2C3E77', TINT = '#3A2E6B';
const SKIN_S = mixCol(SKIN, TINT, .30), SKIN_D = mixCol(SKIN, TINT, .55);
const HAIR = PAL.ink, HAIR_HI = mixCol(PAL.ink, HULL, .34);
const BOOT = mixCol(PAL.ink, HULLS, .45), BOOT_S = mixCol(PAL.ink, HULLS, .2);
const LIP = mixCol(PAL.ink, PAL.rose, .40), LIP2 = mixCol(SKIN, PAL.rose, .55);
const IRIS = mixCol(PAL.ink, HULLS, .35);
const HULL_M = mixCol(HULL, HULLS, .5);
const SHELL = PAL.cream, SHELL_S = mixCol(PAL.cream, TINT, .32);

// ---------- table interpolation (Hermite through rows [x, a, b, c...]) ----------
function sampleTab(tab, x) {
  const n = tab.length; let i = 0; while (i < n - 2 && x > tab[i + 1][0]) i++;
  const a = tab[i], b = tab[i + 1], p = tab[Math.max(0, i - 1)], q = tab[Math.min(n - 1, i + 2)];
  const dx = b[0] - a[0], u = clamp((x - a[0]) / dx, 0, 1), u2 = u * u, u3 = u2 * u, out = [x];
  for (let c = 1; c < a.length; c++) {
    const m0 = (b[c] - p[c]) / ((b[0] - p[0]) || 1) * dx, m1 = (q[c] - a[c]) / ((q[0] - a[0]) || 1) * dx;
    out.push((2 * u3 - 3 * u2 + 1) * a[c] + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * b[c] + (u3 - u2) * m1);
  }
  return out;
}

// ---------- ring lofts ----------
// A ring is { y, rx, df, db, xc, zc, ridge }: an ellipse-ish cross-section (half width rx, front depth df, back depth db)
// at height y. proj(X, Y, Z) -> [sx, sy, zs] is any affine projection. Returns the left/right extreme points of a ring.
function ext(proj, r) {
  const y = r.y, xc = r.xc || 0, zc = r.zc || 0, p0 = proj(xc, y, zc);
  const A = proj(xc + 1, y, zc)[0] - p0[0], B = proj(xc, y, zc + 1)[0] - p0[0];
  let lo = null, hi = null;
  const test = p => { if (!lo || p[0] < lo[0]) lo = p; if (!hi || p[0] > hi[0]) hi = p; };
  for (const [d, a0] of [[r.df, -PI / 2], [r.db, PI / 2]]) {
    const at = phi => test(proj(xc + r.rx * Math.sin(phi), y, zc + d * Math.cos(phi)));
    at(a0); at(a0 + PI);
    const ps = Math.atan2(A * r.rx, B * d);
    for (const c of [ps, ps + PI]) { const u = ((c - a0) % (2 * PI) + 2 * PI) % (2 * PI); if (u <= PI) at(a0 + u); }
  }
  if (r.ridge && r.ridge > r.df) test(proj(xc, y, zc + r.ridge));
  return [lo, hi];
}
// the near half of a ring as an arc from the right extreme to the left extreme (hems, chins, napes)
function nearArc(proj, r, n = 8) {
  const y = r.y, xc = r.xc || 0, zc = r.zc || 0, out = [];
  const zs0 = proj(xc, y, zc)[2];
  for (let k = 0; k <= 2 * n; k++) {
    const a = k / (2 * n) * 2 * PI, ca = Math.cos(a), p = proj(xc + r.rx * Math.sin(a), y, zc + (ca >= 0 ? r.df : r.db) * ca);
    if (p[2] >= zs0) out.push(p);
  }
  out.sort((a, b) => b[0] - a[0]);
  return out;
}
function edgePoly(proj, rings, arc = false) {
  const L = [], R = [];
  for (const r of rings) { const [lo, hi] = ext(proj, r); L.push(lo); R.push(hi); }
  const pts = R.map(p => [p[0], p[1]]);
  if (arc) { const a = nearArc(proj, rings[rings.length - 1]); for (const p of a) pts.push([p[0], p[1]]); }
  for (let i = L.length - 1; i >= 0; i--) pts.push([L[i][0], L[i][1]]);
  return { pts, L, R };
}
// a cel shadow strip along one side of a loft (side +1 = right edge)
function strip(L, R, side, k, wob = .14, ph = 0) {
  const n = L.length, pts = [];
  if (side > 0) {
    for (let i = 0; i < n; i++) pts.push([R[i][0], R[i][1]]);
    for (let i = n - 1; i >= 0; i--) { const w = R[i][0] - L[i][0], kk = k * (1 + wob * Math.sin(i * 1.9 + ph)); pts.push([R[i][0] - w * kk, R[i][1]]); }
  } else {
    for (let i = 0; i < n; i++) pts.push([L[i][0], L[i][1]]);
    for (let i = n - 1; i >= 0; i--) { const w = R[i][0] - L[i][0], kk = k * (1 + wob * Math.sin(i * 1.9 + ph)); pts.push([L[i][0] + w * kk, L[i][1]]); }
  }
  return pts;
}
function rowsOf(tab, y0, y1, n, fn) {           // rings from y1 (top) down to y0
  const out = [];
  for (let i = 0; i <= n; i++) {
    const y = y1 + (y0 - y1) * i / n, s = sampleTab(tab, y), r = { y, rx: Math.max(.003, s[1]), df: Math.max(.003, s[2]), db: Math.max(.003, s[3]), xc: 0, zc: 0, ridge: s[4] || 0 };
    if (fn) fn(r);
    out.push(r);
  }
  return out;
}
// a tube (limb, stroke) along 2D points with per-control-point widths and round caps
function tubePoly(P, ws, caps = true, n = 5) {
  const C = P.length > 2 ? through(P, n) : P.slice(), m = C.length, L = [], R = [], T = [];
  const wAt = i => { const u = P.length > 2 ? i / n : i, k = Math.min(ws.length - 1, Math.floor(u)), f = u - k; return lerp(ws[k], ws[Math.min(ws.length - 1, k + 1)], f) / 2; };
  for (let i = 0; i < m; i++) {
    const a = C[Math.max(0, i - 1)], b = C[Math.min(m - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, w = wAt(i);
    T.push([dx / d, dy / d, w]); L.push([C[i][0] - dy / d * w, C[i][1] + dx / d * w]); R.push([C[i][0] + dy / d * w, C[i][1] - dx / d * w]);
  }
  const out = L.slice();
  if (caps) { const [dx, dy, w] = T[m - 1], c = C[m - 1]; for (let k = 1; k < 5; k++) { const th = k / 5 * PI; out.push([c[0] - dy * w * Math.cos(th) + dx * w * Math.sin(th), c[1] + dx * w * Math.cos(th) + dy * w * Math.sin(th)]); } }
  for (let i = m - 1; i >= 0; i--) out.push(R[i]);
  if (caps) { const [dx, dy, w] = T[0], c = C[0]; for (let k = 1; k < 5; k++) { const th = k / 5 * PI; out.push([c[0] + dy * w * Math.cos(th) - dx * w * Math.sin(th), c[1] - dx * w * Math.cos(th) - dy * w * Math.sin(th)]); } }
  return out;
}
const ellP = (cx, cy, rx, ry, n = 14, rot = 0) => ellPts(cx, cy, rx, ry, n, 0, rot);

// ---------- painter context ----------
// One per character call. Everything is drawn in an unflipped frame and mirrored about x0 on output; every part is warped
// by a smooth boil field anchored to the character (so the wash and its ink outline always agree).
function mkQ(o, h, key, x0, y0) {
  const sil = o.sil ? (o.sil === true ? PAL.ink : o.sil) : null, tone = o.tone || null, kk = .8 * Math.pow(clamp(h / 430, .45, 2.6), .55);
  const fl = o.flip ? -1 : 1, op = o.op ?? 255;
  const Q = { h, kk, fl, sil, op, x0, y0 };
  let W = pts => pts;
  Q.c = col => sil ? sil : tone ? mixCol(col, tone[0], tone[1]) : col;
  Q.part = name => {
    boilSeed(key + '|' + name);
    const p1 = random() * TAU, p2 = random() * TAU, p3 = random() * TAU, p4 = random() * TAU, A = .9 * kk;
    W = pts => pts.map(([x, y]) => { const u = x - x0, v = y - y0; return [x + A * (Math.sin(v * .05 + p1) + .5 * Math.sin(u * .1 + p2)), y + A * (Math.sin(u * .055 + p3) + .5 * Math.sin(v * .09 + p4))]; });
  };
  Q.T = pts => { const w = W(pts); return fl < 0 ? w.map(p => [2 * x0 - p[0], p[1]]) : w; };
  Q.M = p => fl < 0 ? [2 * x0 - p[0], p[1]] : p;
  Q.fillP = (pts, col, opac) => paint(Q.T(pts), { wash: Q.c(col), washOp: opac ?? op, ink: null });
  Q.inkP = (pts, sw = 1.1, curv = .3, col = PAL.ink, br = 'ink') => paint(Q.T(pts), { ink: sil ? sil : col, sw: sw * kk, br, curv });
  Q.line = (pts, sw = .7, col = PAL.ink, br = 'inkfine', curv = .4) => { if (!sil) inkLine(Q.T(pts), sw * kk, Q.c(col), br, curv); };
  Q.shade = (pts, col) => { if (!sil) paint(Q.T(pts), { wash: Q.c(col), washOp: op, ink: null }); };
  return Q;
}

// ---------- pilot: proportions ----------
const HF = .155;                               // head height as a fraction of h
const CHIN_Y = .845;                           // chin height (fraction of h)
// head rings (head units; v = 0 chin .. 1 crown): v, rx, df, db, ridge
const SKULL = [
  [0.00, .050, .050, .040, 0], [0.05, .160, .170, .150, 0], [0.11, .245, .290, .250, 0], [0.19, .300, .340, .330, 0],
  [0.27, .335, .375, .400, .44], [0.34, .355, .385, .440, .535], [0.42, .370, .395, .460, .47], [0.50, .380, .400, .480, .41],
  [0.58, .385, .395, .490, .44], [0.68, .385, .380, .500, 0], [0.78, .375, .365, .505, 0], [0.88, .340, .335, .480, 0],
  [0.95, .270, .270, .420, 0], [1.00, .120, .120, .220, 0],
];
const HAIRT = [
  [0.20, .295, .335, .400, 0], [0.30, .340, .375, .450, 0], [0.40, .372, .385, .500, 0], [0.50, .402, .400, .530, 0], [0.60, .420, .420, .545, 0],
  [0.70, .432, .420, .560, 0], [0.80, .432, .410, .565, 0], [0.90, .410, .385, .540, 0], [0.97, .350, .330, .490, 0],
  [1.03, .240, .240, .400, 0], [1.07, .120, .130, .260, 0], [1.09, .030, .030, .080, 0],
];
const skullAt = v => sampleTab(SKULL, clamp(v, 0, 1));
// torso rings (fractions of h): y, rx, df, db
const COATT = [
  [.238, .125, .076, .072], [.300, .118, .072, .068], [.380, .110, .066, .060], [.470, .100, .060, .054], [.540, .092, .055, .049],
  [.600, .088, .053, .047], [.640, .092, .056, .048], [.690, .102, .060, .052], [.740, .110, .060, .052], [.775, .112, .056, .050],
  [.795, .104, .050, .046], [.815, .080, .046, .042], [.840, .050, .038, .036],
];
const ROBET = [
  [.100, .100, .056, .052], [.190, .104, .058, .054], [.280, .104, .058, .055], [.380, .100, .058, .054], [.470, .094, .056, .050],
  [.540, .086, .052, .046], [.600, .082, .050, .044], [.640, .085, .052, .045], [.690, .094, .056, .048], [.740, .102, .056, .050],
  [.775, .104, .052, .048], [.795, .096, .048, .044], [.815, .074, .044, .040], [.840, .046, .036, .034],
];
const COLLART = [[.79, .066, .048, .046], [.83, .056, .044, .042], [.88, .060, .046, .043]];
{ const narrow = (t, k) => t.forEach(r => { r[1] *= k; r[2] *= .96; r[3] *= .96; }); narrow(COATT, .92); narrow(ROBET, .93); }
const BOOTT = [[0, .028, .086, .030], [.012, .032, .085, .034], [.035, .034, .070, .034], [.060, .032, .040, .032], [.108, .030, .034, .030]];

const SEAT_LIFT = .058;
const YAWS = { front: 0, q: .70, side: PI / 2, qb: PI - .70, back: PI, seated: PI / 2 };
const EMO = {
  calm: { pit: 0, chin: 0, turn: 0, roll: 0 },
  resolve: { pit: .10, chin: .0093, turn: 0, roll: 0 },
  strain: { pit: .15, chin: .012, turn: 0, roll: 0 },
  joy: { pit: -.04, chin: -.003, turn: 0, roll: .035 },
  curious: { pit: 0, chin: 0, turn: .30, roll: .07 },
};

// projection: rig (X right, Y up, Z toward viewer at yaw 0; units of h) -> [screen x, screen y, depth]
function mkProj(x0, y0, h, yaw, lean, sq, dy) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cl = Math.cos(lean), sl = Math.sin(lean), kx = 1 + sq * .6, ky = 1 - sq, PITCH = .10;
  return (X, Y, Z) => {
    const Y1 = Y * cl - Z * sl, Z1 = Y * sl + Z * cl, xs = X * cy + Z1 * sy, zs = -X * sy + Z1 * cy;
    return [x0 + xs * h * kx, y0 + dy + (-Y1 + zs * PITCH) * h * ky, zs];
  };
}

// ---------- pilot: pose (pure; used by pilot() and pilotAnchors()) ----------
function pilotPose(x, y, h, o) {
  o = o || {};
  const view = o.view || 'front', seated = view === 'seated', fl = o.flip ? -1 : 1;
  const emo = EMO[o.emo] ? o.emo : 'calm', E = EMO[emo], t = o.t || 0;
  const walking = !seated && o.walk != null, phi = (o.walk || 0) * PI, sinP = Math.sin(phi), cosP = Math.cos(phi);
  const sq = o.sq || 0, lean = (o.lean || 0) + (seated ? .10 : 0);
  const yaw = (o.yaw ?? YAWS[view] ?? 0) + (walking ? .055 * sinP : 0);
  const bobPx = walking ? .007 * h * (1 - Math.abs(cosP)) : 0, dy = (o.dy || 0) + bobPx;
  const pr = mkProj(x, y, h, yaw, lean, sq, dy);
  const M = p => fl < 0 ? [2 * x - p[0], p[1], p[2]] : p;
  const br = Math.sin(bpOf(t) * PI), up = br * .0042;                        // breath, on the beat (period 2 beats)
  const sw = .0075 * Math.sin(t * 2.3) + .008 * (pulse(t, 5) - .15);         // hem sway
  const base = seated ? -.47 + SEAT_LIFT : 0;                              // seated: rig origin = the seat surface, hip joint SEAT_LIFT above it
  // head
  const look = (o.look || 0) * fl, lookY = o.lookY ?? (seated && o.hold !== 'helmet' ? -.6 : 0);
  const turn = E.turn * (yaw > 1.4 && yaw < 4.7 ? 1 : 1) + look * .22, pit = E.pit + (seated ? .18 : 0), roll = E.roll;
  const ct = Math.cos(turn), st = Math.sin(turn), cp = Math.cos(pit), sp = Math.sin(pit), cr = Math.cos(roll), sr = Math.sin(roll);
  const chinY = base + CHIN_Y + up - E.chin, zN = .010 + (seated ? .012 : 0);
  const hp = (X, v, Z) => {
    const yr = v - .5, y1 = yr * cp - Z * sp, z1 = yr * sp + Z * cp;
    const X2 = X * cr + y1 * sr, v2 = -X * sr + y1 * cr + .5;
    return pr((X2 * ct + z1 * st) * HF, chinY + v2 * HF, zN + (-X2 * st + z1 * ct) * HF);
  };
  const zs = (X, v) => { const s = skullAt(v), q = clamp(X / s[1], -.985, .985); return s[2] * Math.sqrt(1 - q * q); };
  const fm = (X, v, dz = .01) => hp(X, v, zs(X, v) + dz);
  const eyesP = M(fm(0, .478)), headP = M(hp(0, .5, 0));
  const P = { x, y, h, view, seated, fl, emo, E, t, walking, phi, sinP, cosP, sq, lean, yaw, dy, pr, M, br, up, sw, base, hp, fm, zs, look, lookY, turn, pit, roll, chinY, zN, ct, st };
  // arms + helmet / paper (rig coords)
  const hold = o.hold ?? null, coat = o.coat !== false;
  P.hold = hold; P.coat = coat;
  const armK = (v, k) => v == null ? null : v;
  const Sy = base + .772;
  const chain = (side, kind, param) => {
    const S = [side * .100, Sy + up, 0];
    if (kind === 'wave') {
      const a = clamp(-param, .05, 2.4), a2 = a + .75;
      const E1 = [S[0] + side * Math.sin(a) * .155, S[1] - Math.cos(a) * .155, .02], W1 = [E1[0] + side * Math.sin(a2) * .14, E1[1] - Math.cos(a2) * .14, .04];
      return { S, E: E1, W: W1 };
    }
    if (kind === 'helmet') {
      const k = clamp(-param / .9, 0, 1.3), H0 = [side * .135, base + .585, .048], H1 = [side * .105, base + .705, .105];
      const E0 = [side * .128, base + .625, -.012], E1 = [side * .135, base + .655, .0];
      const W0 = [side * .092, base + .600, .112], W1 = [side * .07, base + .715, .150];
      const mixv = (a, b) => a.map((v, i) => lerp(v, b[i], k));
      return { S, E: mixv(E0, E1), W: mixv(W0, W1), H: mixv(H0, H1) };
    }
    if (kind === 'paper') {
      return seated
        ? { S, E: [side * .118, base + .655, .075], W: [side * .085, base + .735, .175] }
        : { S, E: [side * .118, base + .655, .060], W: [side * .080, base + .705, .165] };
    }
    if (kind === 'rest') {   // seated, hand on the thigh
      return { S, E: [side * .125, base + .655, .045], W: [side * .085, base + .535, .175] };
    }
    // hang
    const th = param || 0, b1 = .07, ep = .18 + Math.max(0, th) * .6;
    const d1 = [side * Math.sin(b1), -Math.cos(b1) * Math.cos(th), Math.cos(b1) * Math.sin(th)];
    const E1 = [S[0] + d1[0] * .155, S[1] + d1[1] * .155, S[2] + d1[2] * .155], tf = th + ep, b2 = b1 * .5;
    const d2 = [side * Math.sin(b2), -Math.cos(b2) * Math.cos(tf), Math.cos(b2) * Math.sin(tf)];
    return { S, E: E1, W: [E1[0] + d2[0] * .14, E1[1] + d2[1] * .14, E1[2] + d2[2] * .14] };
  };
  const armSwing = (s) => walking ? -.42 * Math.sin(phi + (s > 0 ? PI : 0)) : 0;
  // L arm (screen-left at front) carries the helmet; R arm (screen-right) the paper
  P.armLd = {};
  if (hold === 'helmet') P.L = chain(-1, 'helmet', o.armL ?? 0);
  else if (o.armL != null) P.L = chain(-1, 'wave', o.armL);
  else P.L = seated ? chain(-1, 'rest') : chain(-1, 'hang', armSwing(-1));
  if (o.armR != null) P.R = chain(1, 'wave', o.armR);
  else if (hold === 'paper') P.R = chain(1, 'paper');
  else P.R = seated ? chain(1, 'rest') : chain(1, 'hang', armSwing(1));
  // helmet: centre, radius, visor yaw offset
  if (hold === 'helmet') {
    const H = P.L.H || [-.135, base + .585, .048], R = .078, eta = -.55 + (P.L.H ? 0 : 0);
    P.helmet = { c: H, R, eta };
    const vp = pr(H[0] + R * .98 * Math.sin(eta), H[1] + R * .06, H[2] + R * .98 * Math.cos(eta));
    P.visorRaw = vp; P.visorVis = vp[2] > .01;
  }
  P.anchors = { head: [headP[0], headP[1]], eyes: [eyesP[0], eyesP[1]], visor: P.visorRaw ? (p => [p[0], p[1]])(M(P.visorRaw)) : null, visorVisible: !!P.visorVis };
  return P;
}
function pilotAnchors(x, y, h, o) { return pilotPose(x, y, h, o).anchors; }


// ---------- face features (shared by the pilot head and faceDecal) ----------
const BROWD = {
  calm: [[0, 0, -.004], [0, 0, -.004]],
  resolve: [[-.050, -.042, -.030], [-.050, -.042, -.030]],
  strain: [[-.064, -.050, -.018], [-.064, -.050, -.018]],
  joy: [[.016, .038, .008], [.016, .038, .008]],
  curious: [[0, 0, -.004], [.032, .060, .048]],
};
const BROWT = { calm: 1, resolve: 1.12, strain: 1.18, joy: .92, curious: 1 };
const EYEO = { calm: .9, resolve: .36, strain: 0, joy: 1.05, curious: 1.2 };
const LIDT = { calm: 1, resolve: 1.25, strain: 1, joy: .9, curious: 1 };

// fm(X, v) -> [sx, sy, zs]: face-plane (X across in head units, v up from the chin) to the screen.
function faceFeatures(Q, fm, Hpx, emo, o) {
  const inkC = o.ink || PAL.ink, irisC = o.iris || IRIS, lipC = o.lip || LIP, lip2C = o.lip2 || LIP2, skinD = o.skinD || SKIN_D;
  const hi = o.hi ?? Hpx > 88;
  const stroke = (pts, ws, col, minW = 1.3) => {
    const P = pts.map(([X, v]) => fm(X, v));
    for (const p of P) if (p[2] < .012) return false;
    Q.fillP(tubePoly(P.map(p => [p[0], p[1]]), ws.map(w => Math.max(minW * Q.kk, w * Hpx)), true, 4), col);
    return true;
  };
  const poly = (pts, col) => { const P = pts.map(([X, v]) => fm(X, v)); for (const p of P) if (p[2] < .012) return false; Q.fillP(P.map(p => [p[0], p[1]]), col); return P; };
  // brows: thick and straight, they carry the emotion
  for (const s of [-1, 1]) {
    const d = BROWD[emo][s < 0 ? 0 : 1], th = BROWT[emo];
    stroke([[s * .070, .588 + d[0]], [s * .195, .603 + d[1]], [s * .330, .590 + d[2]]], [.040 * th, .054 * th, .036 * th], inkC, 1.8);
  }
  // eyes: an upper-lid stroke and an iris stroke each
  const op = EYEO[emo], lx = (o.look || 0) * .028, ly = (o.lookY || 0) * .018, lt = LIDT[emo];
  for (const s of [-1, 1]) {
    const X0 = s * .195, v0 = .478, ew = .088;
    if (op > .05) {
      const hT = .034 * op + .002, lidV = u => v0 + hT * Math.pow(Math.max(0, 1 - u * u), .75) - .010 * Math.max(0, u) - (u > 1 ? .006 : 0);
      if (hi) {   // sclera + lower lid at close-up scale
        const top = [], bot = [];
        for (const u of [-.95, -.5, 0, .5, .95]) { top.push([X0 + s * u * ew, lidV(u) - .004]); }
        for (const u of [.95, .5, 0, -.5, -.95]) { bot.push([X0 + s * u * ew, v0 - .022 * Math.max(op, .45) + .006 * (1 - u * u)]); }
        poly(top.concat(bot), PAL.cream);
      }
      const ir = clamp(op * 1.05 + .10, .35, 1.12), cx = X0 + lx, cv = v0 - .004 + ly, ip = [];
      for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; ip.push([cx + Math.cos(a) * .036, cv + Math.sin(a) * .046 * ir]); }
      poly(ip, irisC);
      if (hi && op > .5) poly([[cx - .004 + .006, cv + .014 * ir], [cx + .012, cv + .020 * ir], [cx + .014, cv + .008 * ir], [cx + .002, cv + .006 * ir]], PAL.cream);
      const path = [-1, -.5, 0, .5, 1, 1.18].map(u => [X0 + s * u * ew, lidV(u)]);
      stroke(path, [.020, .028, .030, .027, .021, .011].map(w => w * lt), inkC, 1.5);
      // lower lid: a thin line under the iris; the squint keeps it dark
      const lowLine = [-.7, -.2, .3, .85].map(u => [X0 + s * u * ew, v0 - .024 * Math.max(op, .5) + .006 * (1 - u * u)]);
      stroke(lowLine, [.006, .008, .008, .005], emo === 'resolve' ? inkC : mixCol(skinD, inkC, .35), 1.0);
    } else {
      const path = [-1, -.5, 0, .5, 1, 1.15].map(u => [X0 + s * u * ew, v0 - .014 + .010 * -u * -1 * 0 - .026 * Math.pow(Math.max(0, 1 - u * u), .8) + (-u) * .010]);
      stroke(path, [.016, .024, .026, .022, .016, .010], inkC, 1.5);
    }
  }
  if (o.eyesOnly) return;
  // nose mark (front); the profile nose is a silhouette bump
  stroke([[-.03, .318], [0, .308], [.03, .318]], [.004, .009, .004], skinD, 1.0);
  // mouth
  const vm = .178;
  if (emo === 'calm') {
    stroke([[-.078, vm], [-.03, vm + .003], [.03, vm + .003], [.078, vm]], [.010, .014, .014, .010], lipC, 1.2);
    stroke([[-.045, vm - .026], [0, vm - .030], [.045, vm - .026]], [.006, .010, .006], lip2C, 1.0);
  } else if (emo === 'resolve') {
    stroke([[-.092, vm - .003], [-.03, vm], [.03, vm], [.092, vm - .003]], [.012, .018, .018, .012], lipC, 1.4);
    stroke([[-.035, vm - .026], [.035, vm - .026]], [.006, .006], lip2C, 1.0);
  } else if (emo === 'strain') {
    const T = [[-.078, vm - .046], [-.078, vm + .012], [.078, vm + .012], [.078, vm - .046]], P = T.map(([X, v]) => fm(X, v));
    if (P.every(p => p[2] > .012)) {
      const cx = (P[0][0] + P[2][0]) / 2, cy = (P[0][1] + P[2][1]) / 2, hw = Math.abs(P[2][0] - P[0][0]) / 2, hh = Math.abs(P[1][1] - P[0][1]) / 2;
      Q.fillP(rrPts(cx - hw, cy - hh, hw * 2, hh * 2, Math.min(hw, hh) * .55), PAL.cream);
      Q.inkP(rrPts(cx - hw, cy - hh, hw * 2, hh * 2, Math.min(hw, hh) * .55), .55, 0, lipC, 'inkfine');
      stroke([[-.074, vm - .017], [.074, vm - .017]], [.007, .007], lipC, 1.0);
    }
  } else if (emo === 'joy') {
    stroke([[-.082, vm + .015], [-.04, vm - .007], [0, vm - .014], [.04, vm - .007], [.082, vm + .015]], [.008, .013, .014, .013, .008], lipC, 1.2);
    stroke([[-.090, vm + .011], [-.100, vm + .024]], [.006, .005], lipC, 1.0);
    stroke([[.090, vm + .011], [.100, vm + .024]], [.006, .005], lipC, 1.0);
  } else {
    stroke([[-.05, vm - .002], [0, vm], [.06, vm + .010]], [.010, .013, .010], lipC, 1.2);
    stroke([[-.02, vm - .027], [.03, vm - .024]], [.006, .006], lip2C, 1.0);
  }
}

// ---------- pilot: head ----------
const VHL = .735, VSB = .50, VLO = .22;
const TUFT = [0, .35, .05, .95, .25, 0, .7, 1, .3, .05, .45];
function drawHead(Q, P, o) {
  const { hp, fm, zs, h } = P, Hpx = h * HF, yawT = P.yaw + P.turn, ts = yawT >= 0 ? -1 : 1, sdU = P.sdU;
  Q.part('head');
  const hairRing = v => { const s = sampleTab(HAIRT, v); return { y: v, rx: s[1], df: s[2], db: s[3], xc: 0, zc: 0 }; };
  const vis = p => p[2] > .012;
  // 1. hair mass behind everything
  const HB = edgePoly(hp, rowsOf(HAIRT, VLO, 1.09, 24), true);
  Q.fillP(HB.pts, HAIR); Q.inkP(HB.pts, 1.1, .3);
  // 2. skin
  const SK = edgePoly(hp, rowsOf(SKULL, 0, 1, 22), true);
  Q.fillP(SK.pts, SKIN);
  Q.shade(strip(SK.L, SK.R, sdU, .17, .2, .7), SKIN_S);
  Q.inkP(SK.pts, .9, .3);
  // hairline geometry
  const xf = v => Math.min(lerp(.365, .318, clamp((v - .5) / .235)), .95 * skullAt(v)[1]);
  const edgeAt = dv => { const pts = []; for (let k = 0; k <= 10; k++) { const X = lerp(-xf(VHL), xf(VHL), k / 10), v = VHL - .002 - TUFT[k] * .034 + dv; pts.push(hp(X, v, zs(X, v) + .012)); } return pts; };
  const fe = edgeAt(0), fs = edgeAt(-.055);
  // 3. cast shadow under the fringe
  if (!Q.sil) {
    const idx = fe.map((p, i) => i).filter(i => vis(fe[i]) && vis(fs[i]));
    if (idx.length > 2) Q.shade(idx.map(i => [fe[i][0], fe[i][1]]).concat(idx.slice().reverse().map(i => [fs[i][0], fs[i][1]])), SKIN_S);
  }
  // 4. face
  const face = fm(0, .478);
  if (face[2] > .05) faceFeatures(Q, fm, Hpx, P.emo, { look: P.look, lookY: P.lookY });
  // nose in three-quarter views: a bridge and underside line
  const sY = Math.abs(Math.sin(yawT));
  if (sY > .25 && sY < .93 && !Q.sil) {
    const n3 = [[0, .52, .41], [0, .44, .46], [0, .35, .53], [0, .31, .48], [0, .275, .44]].map(([X, v, Z]) => hp(X, v, Z));
    if (n3.every(p => p[2] > .0)) Q.line(n3.map(p => [p[0], p[1]]), .75, mixCol(SKIN_D, PAL.ink, .45), 'inkfine', .4);
  }
  // 5. hair over the skin: crown + fringe + the side patch on the trailing side, sideburn on the leading side
  const cap = edgePoly(hp, rowsOf(HAIRT, VHL, 1.09, 12), false);
  Q.fillP(cap.pts, HAIR);
  const fi = fe.map((p, i) => i).filter(i => vis(fe[i]));
  if (fi.length > 2) {
    const top = fi.map(i => { const X = lerp(-xf(VHL), xf(VHL), i / 10), v = VHL + .03; const p = hp(X, v, zs(X, v) + .012); return [p[0], p[1]]; });
    const fpoly = fi.map(i => [fe[i][0], fe[i][1]]).concat(top.reverse());
    Q.fillP(fpoly, HAIR); Q.inkP(fpoly, .9, .15);
  }
  const rowsP = [[VHL, 'f'], [.70, 'f'], [.65, 'f'], [.60, 'f'], [.55, 'f'], [VSB, 'f'], [VSB - .03, 'm'], [VSB - .06, 'b'], [.40, 'b'], [.34, 'b'], [.28, 'b'], [VLO, 'b']];
  const bnd = [], edg = [];
  for (const [v, typ] of rowsP) {
    const [lo, hi2] = ext(hp, hairRing(v));
    let b;
    const fpt = () => { const X = ts * xf(Math.max(v, VSB)); return hp(X, v, zs(X, v) + .012); };
    const bpt = () => { const s = skullAt(v), X = ts * s[1] * .966; return hp(X, v, -s[3] * .259); };
    if (typ === 'f') b = fpt(); else if (typ === 'b') b = bpt(); else { const a1 = fpt(), a2 = bpt(); b = [(a1[0] + a2[0]) / 2, (a1[1] + a2[1]) / 2, (a1[2] + a2[2]) / 2]; }
    const e = ts < 0 ? lo : hi2, far = ts < 0 ? hi2 : lo, frontSeen = hp(0, v, zs(0, v))[2] > 0;
    // a hidden boundary means: face side visible -> no hair on this row (zero width); back of head visible -> hair to the far limb
    bnd.push(vis(b) ? b : (frontSeen ? e : far)); edg.push(e);
  }
  const lp = bnd.map(p => [p[0], p[1]]).concat(edg.slice().reverse().map(p => [p[0], p[1]]));
  if (Math.max(...bnd.map((b, i) => Math.abs(b[0] - edg[i][0]))) > 1.5) { Q.fillP(lp, HAIR); Q.inkP(lp, .9, .15); }
  // leading-side sideburn (visible only near the front view)
  const lead = [], leadE = [];
  for (const [v, typ] of rowsP) {
    if (typ !== 'f') break;
    const [lo, hi2] = ext(hp, hairRing(v)), X = -ts * xf(v), b = hp(X, v, zs(X, v) + .012);
    if (!vis(b)) { lead.length = 0; break; }
    lead.push(b); leadE.push(ts < 0 ? hi2 : lo);
  }
  if (lead.length > 2 && Math.max(...lead.map((b, i) => Math.abs(b[0] - leadE[i][0]))) > 1.5) {
    const pl = lead.map(p => [p[0], p[1]]).concat(leadE.slice().reverse().map(p => [p[0], p[1]]));
    Q.fillP(pl, HAIR); Q.inkP(pl, .9, .15);
  }
  // 6. ears
  const sEar = skullAt(.45)[1];
  for (const s of [-1, 1]) {
    const dot = -s * Math.sin(yawT);
    if (dot < -.3) continue;
    const c = hp(s * (sEar + .012), .445, -.03), hw = (.032 + .05 * Math.max(0, dot)) * Hpx, hh = .10 * Hpx;
    if (c[2] < -.03 && dot < .2) continue;
    const ep = ellP(c[0], c[1], hw, hh, 12);
    Q.fillP(ep, SKIN); if (dot > .35) Q.shade(ellP(c[0] + s * hw * .1, c[1] + hh * .1, hw * .55, hh * .6, 10), SKIN_S);
    Q.inkP(ep, .8, .3);
  }
  // 7. hair highlight, from the fixed light (upper-left of the screen)
  if (!Q.sil) {
    const Lx = -.5 * P.fl, Lz = .6, c = Math.cos(yawT), s = Math.sin(yawT), XL = Lx * c - Lz * s, ZL = Lx * s + Lz * c, phiL = Math.atan2(XL, ZL);
    const up = [], dn = [];
    for (let k = 0; k <= 7; k++) {
      const a = phiL + lerp(-.50, .40, k / 7), ca = Math.cos(a), tk = Math.sin(k / 7 * PI);
      for (const [arr, v, th] of [[up, .915, tk * .026], [dn, .865, tk * .012]]) {
        const s2 = sampleTab(HAIRT, v);
        arr.push(hp(s2[1] * Math.sin(a) * 1.01, v + th, (ca >= 0 ? s2[2] : s2[3]) * ca * 1.01));
      }
    }
    const ok = up.map((p, i) => i).filter(i => up[i][2] > .02 && dn[i][2] > .02);
    if (ok.length > 2) Q.shade(ok.map(i => [up[i][0], up[i][1]]).concat(ok.slice().reverse().map(i => [dn[i][0], dn[i][1]])), HAIR_HI);
  }
}

// ---------- pilot: standing ----------
const ellR = (cx, cy, rx, ry, rot, n = 12) => { const c = Math.cos(rot), s = Math.sin(rot), out = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry; out.push([cx + x * c - y * s, cy + x * s + y * c]); } return out; };
function surfPt(P, tab, y, X, mod) {           // a point on the front surface of a torso loft
  const s = sampleTab(tab, y), r = { y, rx: s[1], df: s[2], db: s[3], xc: 0, zc: 0 };
  if (mod) mod(r);
  const q = clamp(X / r.rx, -.98, .98);
  return P.pr(r.xc + X, r.y, r.zc + r.df * Math.sqrt(1 - q * q) + .002);
}
const visRun = (pts, min = .012) => pts.every(p => p[2] > min);

function drawArm(Q, P, side, ch, style) {
  const { pr, h } = P;
  Q.part('arm' + side);
  const S = pr(...ch.S), E = pr(...ch.E), W = pr(...ch.W);
  const dark = P.sdU * ((E[0] + W[0]) / 2 - P.x) > 0;
  const col = style.robe ? (dark ? HULLS : HULL) : (dark ? HULL_M : HULL);
  const ws = style.ws.map(w => w * h);
  const poly = tubePoly([[S[0], S[1]], [E[0], E[1]], [W[0], W[1]]], ws, true, 5);
  Q.fillP(poly, col); Q.inkP(poly, 1.0, .3);
  const dx = W[0] - E[0], dy = W[1] - E[1], dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl;
  const cuff = tubePoly([[W[0] - ux * .026 * h, W[1] - uy * .026 * h], [W[0], W[1]]], [ws[2] * 1.05, ws[2] * 1.05], false);
  Q.fillP(cuff, PAL.cream); Q.inkP(cuff, .7, .1);
  const hc = [W[0] + ux * .024 * h, W[1] + uy * .024 * h], hp2 = ellR(hc[0], hc[1], .030 * h, .022 * h, Math.atan2(uy, ux));
  Q.fillP(hp2, SKIN); Q.inkP(hp2, .8, .3);
  return { S, E, W, hc, u: [ux, uy] };
}

const HELMT = [[-1, .30, .30, .30], [-.90, .62, .64, .64], [-.6, .90, .94, .94], [-.1, 1, 1, 1], [.4, .95, .97, .97], [.8, .72, .74, .74], [.96, .38, .38, .38], [1, .12, .12, .12]];
function drawHelmet(Q, P, H) {
  const { pr } = P, { c, R, eta } = H;
  Q.part('helmet');
  const place = r => { r.y = c[1] + r.y * R; r.rx *= R; r.df *= R; r.db *= R; r.xc = c[0]; r.zc = c[2]; };
  const rows = rowsOf(HELMT, -1, 1, 12, place);
  const E = edgePoly(pr, rows, true);
  Q.fillP(E.pts, SHELL); Q.shade(strip(E.L, E.R, P.sdU, .36, .18, .4), SHELL_S);
  // neck seal band
  const band = rowsOf(HELMT, -.92, -.62, 3, r => { place(r); r.rx += .003; r.df += .003; r.db += .003; });
  const B = edgePoly(pr, band, true); Q.fillP(B.pts, HULLS); Q.inkP(B.pts, .7, .2);
  // visor: a patch on the surface around the visor direction eta
  const surf = (lam, yN) => { const s = sampleTab(HELMT, yN); return pr(c[0] + R * s[1] * 1.02 * Math.sin(lam), c[1] + yN * R, c[2] + R * s[2] * 1.02 * Math.cos(lam)); };
  const N = 10, top = [], bot = [];
  for (let k = 0; k <= N; k++) {
    const u = k / N, lam = eta + lerp(-.95, .95, u), bulge = Math.sin(u * PI);
    top.push([lam, .34 + .10 * bulge]); bot.push([lam, -.30 + .06 * bulge]);
  }
  const vp = top.map(([l, y]) => surf(l, y)), vb = bot.map(([l, y]) => surf(l, y));
  const idx = vp.map((p, i) => i).filter(i => vp[i][2] > .004 && vb[i][2] > .004);
  if (idx.length > 3) {
    const poly = idx.map(i => [vp[i][0], vp[i][1]]).concat(idx.slice().reverse().map(i => [vb[i][0], vb[i][1]]));
    Q.fillP(poly, PAL.cyan);
    const mid = idx.map(i => [lerp(vp[i][0], vb[i][0], .55), lerp(vp[i][1], vb[i][1], .55)]);
    Q.shade(mid.concat(idx.slice().reverse().map(i => [vb[i][0], vb[i][1]])), PAL.teal);
    Q.inkP(poly, .9, .25);
    // glint
    const g0 = idx[Math.max(0, Math.floor(idx.length * .25))], g1 = idx[Math.min(idx.length - 1, Math.floor(idx.length * .55))];
    if (!Q.sil) Q.fillP(tubePoly([[lerp(vp[g0][0], vb[g0][0], .22), lerp(vp[g0][1], vb[g0][1], .22)], [lerp(vp[g1][0], vb[g1][0], .12), lerp(vp[g1][1], vb[g1][1], .12)]], [.007 * P.h, .004 * P.h], true, 3), PAL.cream);
  }
  Q.inkP(E.pts, 1.15, .3);
}

function drawPaper(Q, P, C, a, pit, w, hgt) {
  const { pr } = P, u = [Math.cos(a), 0, Math.sin(a)], v = [0, Math.cos(pit), Math.sin(pit)];
  const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([i, j]) => pr(C[0] + u[0] * w / 2 * i + v[0] * hgt / 2 * j, C[1] + u[1] * w / 2 * i + v[1] * hgt / 2 * j, C[2] + u[2] * w / 2 * i + v[2] * hgt / 2 * j));
  const pts = corners.map(p => [p[0], p[1]]);
  Q.part('paper');
  Q.fillP(pts, PAL.cream); Q.inkP(pts, .8, 0);
  const lerpP = (a2, b2, k) => [lerp(a2[0], b2[0], k), lerp(a2[1], b2[1], k)];
  for (const k of [.25, .42, .59, .76]) Q.line([lerpP(pts[0], pts[3], k), lerpP(pts[1], pts[2], k)].map((p, i) => i ? lerpP(p, lerpP(pts[0], pts[3], k), .18) : lerpP(p, lerpP(pts[1], pts[2], k), .18)), .55, mixCol(PAL.cream, PAL.steel, .55), 'inkfine', 0);
}

function drawBody(Q, P, o) {
  const { pr, coat, h, sdU, seated } = P, items = [], add = (z, f) => items.push({ z, f });
  const yTop = .84, yBot = seated ? .47 : .238;
  const ringMod = r => {
    const f = seated ? 0 : clamp((.58 - r.y) / .34, 0, 1), g = f * f * (1.5 - .5 * f);
    r.xc = P.sw * g; r.zc = (P.walking ? -.014 : 0) * g;
    const spread = P.walking ? .020 * Math.abs(P.sinP) : 0;
    r.df += spread * g; r.db += spread * g * .7; r.rx += spread * .25 * g;
    if (r.y > .56) r.y += P.up * clamp((r.y - .56) / .25, 0, 1);
    r.y += P.base;
  };
  const TB = coat ? COATT : ROBET;
  const sPt = (y, X) => surfPt(P, TB, y, X, ringMod);
  // ---- lower body ----
  if (!seated) {
    const feet = [-1, 1].map(s => {
      const ph = P.phi + (s > 0 ? PI : 0), zf = P.walking ? .075 * Math.sin(ph) : 0, lift = P.walking ? .045 * Math.max(0, Math.cos(ph)) : 0;
      return { s, zf, lift, z: pr(s * .052, 0, zf)[2] };
    }).sort((a, b) => a.z - b.z);
    add(-1, () => {
      Q.part('boots');
      for (const f of feet) {
        const rows = rowsOf(BOOTT, 0, .108, 6, r => { r.xc = f.s * .052; r.zc = f.zf; r.y += f.lift; });
        const B = edgePoly(pr, rows, true);
        Q.fillP(B.pts, BOOT); Q.shade(strip(B.L, B.R, sdU, .35, .15, 1), BOOT_S); Q.inkP(B.pts, 1.0, .2);
      }
    });
    add(-.5, () => {
      Q.part('robe');
      const rows = rowsOf(ROBET, .100, coat ? .262 : .84, coat ? 8 : 26, ringMod), R = edgePoly(pr, rows, true);
      Q.fillP(R.pts, coat ? HULLS : HULL);
      Q.shade(strip(R.L, R.R, sdU, .34, .14, 2.1), coat ? mixCol(HULLS, PAL.ink, .32) : HULLS);
      Q.inkP(R.pts, 1.1, .2);
      const tr = rowsOf(ROBET, .100, .128, 3, r => { ringMod(r); r.rx += .003; r.df += .003; r.db += .003; }), T = edgePoly(pr, tr, true);
      Q.fillP(T.pts, PAL.cream); Q.shade(strip(T.L, T.R, sdU, .34, .1, 0), SHELL_S); Q.inkP(T.pts, .8, .15);
    });
  } else {
    // seated: back panel of the coat, then each leg (thigh under the coat, robe shin, boot)
    const B = P.base, wid = (.20 * Math.abs(Math.cos(P.yaw)) + .05 * Math.abs(Math.sin(P.yaw))) * h;
    add(-3, () => {
      Q.part('back');
      const pts = [[0, B + .47 - .01, -.055], [0, B + .47 - .08, -.068], [0, B + .47 - .14, -.064]].map(([X, Y, Z]) => pr(X, Y, Z));
      const tb = tubePoly(pts.map(p => [p[0], p[1]]), [wid, wid * 1.05, wid * 1.1], false, 4);
      Q.fillP(tb, coat ? HULLS : HULLS); Q.inkP(tb, 1.0, .2);
    });
    const legs = [-1, 1].map(s => {
      const X = s * .055, sw = .012 * Math.sin(P.t * 1.4 + (s > 0 ? 1.3 : 0));
      const hip = [X, SEAT_LIFT, 0], knee = [X, SEAT_LIFT + .008, .235], ank = [X, SEAT_LIFT - .245, .245 + sw];
      return { s, X, hip, knee, ank, z: pr(X, SEAT_LIFT + .008, .235)[2] };
    }).sort((a, b) => a.z - b.z);
    legs.forEach((L, li) => add(li ? .6 : -1.5, () => {
      Q.part('leg' + li);
      const dark = li === 0;
      const pp = q => { const p = pr(...q); return [p[0], p[1]]; };
      // boot
      const brows = rowsOf(BOOTT, 0, .108, 6, r => { r.xc = L.X; r.zc = L.ank[2]; r.y += L.ank[1] - .102; });
      const Bt = edgePoly(pr, brows, true);
      Q.fillP(Bt.pts, dark ? BOOT_S : BOOT); Q.shade(strip(Bt.L, Bt.R, sdU, .35, .15, 1), BOOT_S); Q.inkP(Bt.pts, 1.0, .2);
      // robe shin
      const sh = tubePoly([pp(L.knee), pp([L.X, L.knee[1] - .12, L.knee[2] + .01]), pp(L.ank)], [.088 * h, .082 * h, .078 * h], false, 4);
      Q.fillP(sh, dark ? mixCol(HULLS, PAL.ink, .3) : HULLS); Q.inkP(sh, 1.0, .2);
      const tr = tubePoly([pp([L.X, L.ank[1] + .04, L.ank[2] - .004]), pp([L.X, L.ank[1] + .008, L.ank[2]])], [.082 * h, .082 * h], false);
      Q.fillP(tr, PAL.cream); Q.inkP(tr, .7, .1);
      // thigh under the coat (or the robe without it)
      const th = tubePoly([pp(L.hip), pp([L.X, SEAT_LIFT + .02, .12]), pp(L.knee), pp([L.X, SEAT_LIFT - .06, L.knee[2] + .02]), pp([L.X, SEAT_LIFT - .105, L.knee[2] + .02])], [.118 * h, .116 * h, .104 * h, .098 * h, .096 * h], false, 4);
      Q.fillP(th, coat ? (dark ? HULL_M : HULL) : (dark ? HULLS : HULL)); Q.inkP(th, 1.1, .25);
      const cl = tubePoly([pp([L.X, SEAT_LIFT - .085, L.knee[2] + .022]), pp([L.X, SEAT_LIFT - .108, L.knee[2] + .022])], [.098 * h, .098 * h], false);
      if (coat) Q.shade(cl, HULLS);
    }));
  }
  // ---- torso: coat or robe ----
  const trunkCol = coat ? HULL : HULL, trunkSh = HULLS;
  add(0, () => {
    Q.part('coat');
    const rows = rowsOf(TB, yBot, yTop, 26, ringMod), C = edgePoly(pr, rows, true);
    Q.fillP(C.pts, trunkCol); Q.shade(strip(C.L, C.R, sdU, .30, .16, 1.1), trunkSh);
    if (coat && !seated) {   // lining band at the hem
      const hem = rowsOf(COATT, .238, .272, 3, ringMod), HB = edgePoly(pr, hem, true);
      Q.shade(HB.pts, HULL_M);
    }
    const ys = [.83, .74, .66, .56, .46, .36, .27].filter(y => y >= yBot - .001);
    const pl = ys.map(y => sPt(y, 0));
    if (coat && visRun(pl)) { const c = Math.max(.4, Math.cos(P.yaw)); Q.fillP(tubePoly(pl.map(p => [p[0], p[1]]), [.012 * h * c, .014 * h * c], false, 4), PAL.cream); }
    // belt and buckle
    const belt = rowsOf(TB, .585, .622, 3, r => { ringMod(r); r.rx += .004; r.df += .004; r.db += .004; }), Bt = edgePoly(pr, belt, false);
    Q.fillP(Bt.pts, HULLS); Q.inkP(Bt.pts, .8, .2);
    const bk = sPt(.603, 0);
    if (coat && bk[2] > .012) { const w = .026 * h * Math.max(.3, Math.cos(P.yaw)), q = rrPts(bk[0] - w / 2, bk[1] - .014 * h, w, .028 * h, Math.min(w, .028 * h) * .3); Q.fillP(q, PAL.cream); Q.inkP(q, .6, 0); }
    if (coat && !seated) {   // folds
      for (const X of [-.062, .020, .078]) {
        const pts = [.565, .49, .41, .34, .275].map(y => sPt(y, X * (1 + (.565 - y) * 1.5)));
        if (visRun(pts)) Q.line(pts.map(p => [p[0], p[1]]), .7, mixCol(HULLS, PAL.ink, .4), 'inkfine', .4);
      }
    }
    if (!coat) {   // scholar's clasp
      const cl = sPt(.735, 0);
      if (cl[2] > .01) { const e = ellP(cl[0], cl[1], .014 * h, .014 * h, 10); Q.fillP(e, PAL.amber); Q.inkP(e, .6, .2); }
    }
    Q.inkP(C.pts, 1.2, .25);
  });
  // ---- arms, helmet, paper ----
  const sleeve = coat ? { ws: [.060, .054, .047] } : { ws: [.064, .072, .094], robe: true };
  const armZ = ch => pr(...ch.E)[2];
  const armDraw = (side, ch) => () => drawArm(Q, P, side, ch, sleeve);
  if (P.helmet) {
    const hz = pr(...P.helmet.c)[2];
    add(hz, () => drawHelmet(Q, P, P.helmet));
    add(hz + .0005, armDraw(-1, P.L));
  } else add(armZ(P.L), armDraw(-1, P.L));
  if (o.hold === 'paper' && o.armR == null) {
    add(armZ(P.R) + (seated ? 1 : 0), () => {
      const info = drawArm(Q, P, 1, P.R, sleeve);
      drawPaper(Q, P, [P.R.W[0] + .004, P.R.W[1] + .05, P.R.W[2] + .03], seated ? -.85 : -.45, seated ? .35 : .2, .088, .120);
      const th = ellR(info.hc[0], info.hc[1] - .006 * h, .014 * h, .010 * h, 0); Q.fillP(th, SKIN); Q.inkP(th, .6, .3);
    });
  } else add(armZ(P.R), armDraw(1, P.R));
  // ---- neck + collar + head ----
  add(seated ? .3 : .05, () => {
    Q.part('neck');
    const nk = rowsOf([[.79, .034, .030, .030], [.87, .034, .030, .030]], .79, .87, 3, r => { r.y += P.up + P.base; }), N = edgePoly(pr, nk, false);
    Q.fillP(N.pts, SKIN_S);
    if (coat) {
      Q.part('collar');
      const rows = rowsOf(COLLART, .79, .88, 6, r => { r.y += P.up + P.base; }), C = edgePoly(pr, rows, true);
      Q.fillP(C.pts, HULL); Q.shade(strip(C.L, C.R, sdU, .32, .12, .5), HULLS);
      Q.inkP(C.pts, 1.0, .2);
      const arc = nearArc(pr, rows[0]).map(p => [p[0], p[1]]);
      if (arc.length > 2) Q.fillP(tubePoly(arc, [.010 * h, .012 * h, .010 * h], false, 3), PAL.cream);
      const chin = P.hp(0, .05, .1);
      Q.shade(ellP(chin[0], chin[1] + .012 * h, .040 * h, .016 * h, 12), HULLS);
    } else {
      const chin = P.hp(0, .04, .1);
      Q.shade(ellP(chin[0], chin[1] + .010 * h, .034 * h, .016 * h, 12), SKIN_D);
    }
    drawHead(Q, P, o);
  });
  items.sort((a, b) => a.z - b.z).forEach(it => it.f());
}

function pilot(x, y, h, o = {}) {
  const P = pilotPose(x, y, h, o), Q = mkQ(o, h, o.key || 'pilot', x, y);
  P.sdU = P.fl * (o.shadeSide === -1 ? -1 : 1);
  drawBody(Q, P, o);
  return P.anchors;
}

// =====================================================================================================================
// Bit
// =====================================================================================================================
const BIT = '#4FD6FF', BIT_S = PAL.teal, BIT_HI = mixCol(BIT, PAL.cream, .55), GOLD = '#FFD470';
const BIT_YAW = { front: 0, q: .75, side: 1.42 };

function bitPose(x, y, r, o) {
  o = o || {};
  const t = o.t || 0, k = r / 60, view = o.view || 'front', fl = o.flip ? -1 : 1, yaw = BIT_YAW[view] ?? 0, tilt = o.tilt || 0;
  const cx = x + 2 * k * Math.sin(TAU * t * .6 + 1), cy = y + 6 * k * Math.sin(TAU * t * .9);
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const T = (lx, ly) => { const X = fl * lx; return [cx + X * ct - ly * st, cy + X * st + ly * ct]; };
  const beam = o.beam ?? (fl < 0 ? PI : 0), bl = o.beamLen ?? 260 * k;
  // the lamp clips onto the rim in the direction of its beam
  const lampA = [cx + Math.cos(beam) * r * .93, cy + Math.sin(beam) * r * .93];
  const lens = [lampA[0] + Math.cos(beam) * r * .42, lampA[1] + Math.sin(beam) * r * .42];
  return { t, k, view, fl, yaw, tilt, cx, cy, T, beam, bl, lampA, lens, r, out: { x: cx, y: cy, lamp: [lens[0], lens[1]] } };
}
function bitAnchors(x, y, r, o) { return bitPose(x, y, r, o).out; }

function bit(x, y, r, o = {}) {
  const B = bitPose(x, y, r, o), { T, k, yaw, fl } = B, emo = o.emo || 'neutral';
  const Q = mkQ({ ...o, flip: false }, r * 7, o.key || 'bit', B.cx, B.cy);
  const ell = (lx, ly, rx, ry, rot = 0, n = 16) => { const c = Math.cos(rot), s = Math.sin(rot), out = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, X = Math.cos(a) * rx, Y = Math.sin(a) * ry; out.push(T(lx + X * c - Y * s, ly + X * s + Y * c)); } return out; };
  const sph = (lam, phi) => { const a = lam + yaw, cph = Math.cos(phi); return { x: r * cph * Math.sin(a), y: -r * Math.sin(phi), vis: Math.cos(a) * cph, c: Math.cos(a) }; };
  const bt = (t01) => o.t || 0;
  const bp = frac(bpOf(o.t || 0)), pl = pulse(o.t || 0, 5);
  Q.part('body');
  // feet (behind)
  for (const s of [-1, 1]) { const f = sph(s * .38, -1.1); if (f.vis > -.3) { const e = ell(f.x, f.y + r * .1, r * .17, r * .12); Q.fillP(e, BIT_S); Q.inkP(e, .8, .3); } }
  // tail nub, seen from the side and back
  { const tl = sph(PI, -.15); if (tl.c < .2) { const e = ell(tl.x * 1.06, tl.y, r * .17, r * .15); Q.fillP(e, BIT_S); Q.inkP(e, .8, .3); } }
  // arms: those on the far side go behind the body
  const armPose = emo === 'excited' ? .95 : emo === 'alert' ? -.15 : .25;
  const arms = [-1, 1].map(s => { const a = sph(s * 1.42, -.28); return { s, a }; });
  const drawArm = ({ s, a }) => {
    const rot = (s > 0 ? 1 : -1) * (1.15 - armPose) + (a.x >= 0 ? 0 : 0);
    const cxA = a.x * 1.06, cyA = a.y - armPose * r * .34, e = ell(cxA + s * r * .10 * Math.max(.35, Math.abs(a.c)), cyA, r * .34, r * .18, rot * -1 * (a.x >= 0 ? 1 : 1) + (armPose > .5 ? 0 : 0));
    Q.fillP(e, BIT); Q.shade(ell(cxA + s * r * .12 * Math.max(.35, Math.abs(a.c)), cyA + r * .05, r * .28, r * .09, rot * -1), BIT_S); Q.inkP(e, .9, .3);
  };
  arms.filter(a => a.a.c < 0).forEach(drawArm);
  // body
  const body = ell(0, 0, r, r * .95, 0, 30);
  Q.fillP(body, BIT);
  const crescent = (a0, a1, inset, col) => {
    const outer = [], inner = [];
    for (let i = 0; i <= 10; i++) { const a = lerp(a0, a1, i / 10); outer.push(T(Math.cos(a) * r, Math.sin(a) * r * .95)); }
    for (let i = 10; i >= 0; i--) { const a = lerp(a0, a1, i / 10), s = 1 - inset * Math.sin(i / 10 * PI) * 1.0; inner.push(T(Math.cos(a) * r * s - inset * r * .45, Math.sin(a) * r * .95 * s - inset * r * .45)); }
    Q.shade(outer.concat(inner), col);
  };
  crescent(-.35, 1.75, .30, BIT_S);
  crescent(3.55, 4.35, .10, BIT_HI);
  Q.inkP(body, 1.25, .2);
  // face on the sphere
  const eyeL = sph(-.46, -.06), eyeR = sph(.46, -.06);
  const ew = emo === 'excited' ? 1.22 : 1, eh = emo === 'excited' ? 1.28 : emo === 'alert' ? .14 : 1;
  for (const [E, s] of [[eyeL, -1], [eyeR, 1]]) {
    if (E.vis < .12) continue;
    const w = r * .175 * Math.max(.22, E.c) * ew, hh = r * .225 * eh;
    if (emo === 'alert') {
      const pts = tubePoly([T(E.x - w * 1.05, E.y - r * .03 * s * -1 - r * .035 * (s)), T(E.x + w * 1.05, E.y + r * .03 * s * -1 + r * .035 * (s))], [r * .10, r * .10], true, 3);
      Q.fillP(pts, PAL.ink);
    } else {
      Q.fillP(ell(E.x, E.y, w, hh, 0, 18), PAL.ink);
      const cw = Math.max(.35, E.c);
      Q.fillP(ell(E.x - w * .28, E.y - hh * .30, r * .062 * cw * ew, r * .062 * ew, 0, 10), PAL.cream);
      Q.fillP(ell(E.x + w * .30, E.y + hh * .34, r * .030 * cw, r * .030, 0, 8), PAL.cream);
    }
  }
  // mouth
  { const m = sph(0, -.42); if (m.vis > .2 && emo !== 'alert') {
    const w = r * .12 * Math.max(.3, m.c);
    if (emo === 'excited') { const e = ell(m.x, m.y, w * .9, r * .075, 0, 12); Q.fillP(e, mixCol(PAL.ink, PAL.rose, .3)); Q.shade(ell(m.x, m.y + r * .03, w * .6, r * .03), PAL.rose); }
    else Q.line([T(m.x - w, m.y - r * .01), T(m.x - w * .4, m.y + r * .03), T(m.x + w * .4, m.y + r * .03), T(m.x + w, m.y - r * .01)], .8, mixCol(PAL.ink, BIT_S, .3), 'inkfine', .4);
  } }
  // cheeks
  for (const s of [-1, 1]) { const c = sph(s * .8, -.26); if (c.vis > .3 && !Q.sil) Q.shade(ell(c.x, c.y, r * .085 * Math.max(.3, c.c), r * .05), mixCol(BIT, PAL.rose, .5)); }
  arms.filter(a => a.a.c >= 0).forEach(drawArm);
  // antenna: a gold stalk with a bulb that pulses on the beat
  const sp = emo === 'excited' ? Math.exp(-bp * 4) * Math.sin(bp * 26) : Math.sin(TAU * (o.t || 0) * .5) * .2, lean = emo === 'alert' ? 0 : .10;
  const ab = sph(.0, 1.2), bx = ab.x * .5, tipx = bx + r * (yaw * .06 + lean + sp * .30) * (emo === 'excited' ? 1.4 : 1), tipy = -r * (emo === 'alert' ? 1.72 : 1.55) + (emo === 'excited' ? -Math.abs(sp) * r * .06 : 0);
  const st = [T(bx, -r * .90), T(bx + r * (.08 + sp * .10), -r * 1.22), T(tipx, tipy)];
  Q.part('antenna');
  const stalk = tubePoly(st, [r * .075, r * .06, r * .05], true, 4);
  Q.fillP(stalk, GOLD); Q.inkP(stalk, .8, .3);
  const tr = r * .115 * (1 + .30 * pl), tip = st[2];
  const bulb = ellPts(tip[0], tip[1], tr, tr, 14, 0, 0);
  Q.fillP(bulb, GOLD); Q.fillP(ellPts(tip[0], tip[1], tr * .5, tr * .5, 10, 0, 0), PAL.cream); Q.inkP(bulb, .8, .3);
  // lamp
  if (o.lamp) {
    Q.part('lamp');
    const b = B.beam, dx = Math.cos(b), dy = Math.sin(b), nx = -dy, ny = dx;
    const A = B.lampA, L = r * .44, Wd = r * .20;
    const strap = tubePoly([[B.cx + Math.cos(b - .55) * r * .96, B.cy + Math.sin(b - .55) * r * .96], [B.cx + Math.cos(b) * r * .98, B.cy + Math.sin(b) * r * .98], [B.cx + Math.cos(b + .55) * r * .96, B.cy + Math.sin(b + .55) * r * .96]], [r * .10, r * .10, r * .10], false, 4);
    Q.fillP(strap, PAL.steel); Q.inkP(strap, .7, .3);
    const body2 = [[A[0] - nx * Wd, A[1] - ny * Wd], [A[0] + dx * L - nx * Wd * 1.15, A[1] + dy * L - ny * Wd * 1.15], [A[0] + dx * L + nx * Wd * 1.15, A[1] + dy * L + ny * Wd * 1.15], [A[0] + nx * Wd, A[1] + ny * Wd]];
    Q.fillP(body2, PAL.slate); Q.shade([body2[0], body2[1], [lerp(body2[1][0], body2[2][0], .5), lerp(body2[1][1], body2[2][1], .5)], [lerp(body2[0][0], body2[3][0], .5), lerp(body2[0][1], body2[3][1], .5)]], PAL.steel); Q.inkP(body2, .9, 0);
    const lens = B.lens, ring = ellR(lens[0], lens[1], Wd * .38, Wd * 1.2, b + PI / 2 - PI / 2 + PI / 2 - PI / 2);
    Q.fillP(ring, PAL.cream); Q.inkP(ring, .7, .3);
    Q.fillP(ellR(lens[0] + dx * 1, lens[1] + dy * 1, Wd * .22, Wd * .85, b - PI / 2 + PI / 2 - PI / 2 + PI / 2 - PI / 2 + PI / 2 - PI / 2), PAL.cyan);
  }
  // light: antenna glow, lamp beam
  if (!Q.sil) {
    glow(tip[0], tip[1], r * (.95 + 1.15 * pl), GOLD, .5 + .4 * pl);
    if (o.lamp) {
      const b = B.beam, L2 = B.bl, c = B.lens;
      glow(c[0], c[1], r * .5, PAL.cyan, .75);
      streak(c[0] + Math.cos(b) * L2 / 2, c[1] + Math.sin(b) * L2 / 2, L2, r * .62, PAL.cyan, .55, b);
      streak(c[0] + Math.cos(b) * L2 * .42, c[1] + Math.sin(b) * L2 * .42, L2 * .84, r * .18, mixCol(PAL.cyan, PAL.cream, .6), .8, b);
    }
  }
  return B.out;
}

// =====================================================================================================================
// Islanders (front view, tiny)
// =====================================================================================================================
const OWL = '#A16207', OWL_D = '#713F12', RACC = '#6B7280', RACC_D = '#374151', TUNIC = '#B45309', HOOD = '#78716C', HOOD_D = '#44403C', ROBE_A = '#57534E';
function islander(name, x, y, h, o = {}) {
  const t = o.t || 0, wv = clamp(o.wave || 0, 0, 1), ph = o.wavePhase || 0;
  const Q = mkQ({ ...o, flip: false }, h * 1.6, o.key || name, x, y);
  const sh = mixCol(PAL.bone, TINT, .32);
  const bob = Math.sin(bpOf(t) * PI) * .004 * h;
  const P = (lx, ly) => [x + lx * h, y + ly * h - bob * (ly < -.05 ? 1 : 0)];
  const PP = pts => pts.map(p => P(p[0], p[1]));
  const armCol = { nell: PAL.bone, mo: TUNIC, ash: ROBE_A }[name], armSh = { nell: sh, mo: mixCol(TUNIC, PAL.ink, .3), ash: mixCol(ROBE_A, PAL.ink, .3) }[name];
  const cuffCol = { nell: PAL.steel, mo: RACC, ash: HOOD }[name];
  const handCol = { nell: OWL, mo: RACC, ash: SKIN }[name];
  const shy = -.50, shx = .145;
  // the waving arm is screen-right; the other hangs
  const arm = (s, raise, sw) => {
    const a1 = s > 0 ? lerp(.16, 2.10, ease(raise)) + raise * .30 * sw : .12, a2 = a1 + (s > 0 ? .32 * raise + .10 : .35);
    const S = [s * shx, shy], E = [S[0] + s * Math.sin(a1) * .17, S[1] + Math.cos(a1) * .17 * (s > 0 ? -1 : 1) * (s > 0 ? 1 : -1) * -1], W = [E[0] + s * Math.sin(a2) * .15, E[1] - Math.cos(a2) * .15 * -1];
    return { S, E, W };
  };
  const sw = Math.sin(TAU * 2.2 * (t + ph));
  const armDraw = (s, raise) => {
    const a1 = s > 0 ? lerp(.14, 2.05, ease(raise)) + raise * .30 * sw : .10, a2 = s > 0 ? a1 + .30 * raise + .12 : .30;
    const S = [s * shx, shy], E = [S[0] + s * Math.sin(a1) * .165, S[1] + Math.cos(a1) * .165], W = [E[0] + s * Math.sin(a2) * .150, E[1] + Math.cos(a2) * .150];
    const poly = tubePoly(PP([S, E, W]), [.11 * h, .095 * h, .085 * h], true, 5);
    Q.fillP(poly, armCol); if (s > 0) Q.shade(poly, armCol); Q.inkP(poly, .9, .3);
    const hc = P(W[0] + s * Math.sin(a2) * .03, W[1] + Math.cos(a2) * .03);
    const hnd = ellP(hc[0], hc[1], .04 * h, .04 * h, 10); Q.fillP(hnd, handCol); Q.inkP(hnd, .7, .3);
    return { W, hc };
  };
  const face = (cx, cy, s) => ({ cx, cy, s });
  if (name === 'nell') {
    Q.part('nell');
    // feet, coat, book, arms, head
    for (const s of [-1, 1]) { const f = ellP(...P(s * .075, -.012), .06 * h, .028 * h, 10); Q.fillP(f, PAL.amber); Q.inkP(f, .7, .3); }
    const coat = PP([[-.13, -.53], [.13, -.53], [.17, -.40], [.205, -.22], [.215, -.055], [-.215, -.055], [-.205, -.22], [-.17, -.40]]);
    Q.fillP(coat, PAL.bone); Q.shade(PP([[.13, -.53], [.17, -.40], [.205, -.22], [.215, -.055], [.11, -.055], [.09, -.22], [.07, -.40], [.06, -.53]]), sh);
    const hem = PP([[-.215, -.055], [.215, -.055], [.212, -.09], [-.212, -.09]]); Q.fillP(hem, PAL.steel);
    Q.line(PP([[0, -.52], [0, -.09]]), .7, mixCol(PAL.bone, PAL.steel, .55), 'inkfine', 0);
    for (const yy of [-.44, -.34, -.24]) { const b = ellP(...P(0, yy), .012 * h, .012 * h, 8); Q.fillP(b, PAL.amber); }
    Q.inkP(coat, 1.1, .2);
    armDraw(-1, 0);
    const book = PP([[-.24, -.34], [-.13, -.36], [-.12, -.22], [-.23, -.20]]); Q.fillP(book, HULLS); Q.inkP(book, .8, 0);
    Q.fillP(PP([[-.23, -.335], [-.135, -.35], [-.13, -.235], [-.225, -.22]]), PAL.cream);
    armDraw(1, wv);
    // head: owl
    const hc = P(0, -.70), hw = .22 * h, hh = .195 * h;
    for (const s of [-1, 1]) { const ear = [P(s * .07, -.82), P(s * .21, -.94), P(s * .17, -.75)]; Q.fillP(ear, OWL_D); Q.inkP(ear, .9, 0); }
    const head = ellP(hc[0], hc[1], hw, hh, 22); Q.fillP(head, OWL); Q.shade(strip2(head, hc, 1, .28), OWL_D); Q.inkP(head, 1.1, .2);
    for (const s of [-1, 1]) {
      const disc = ellP(hc[0] + s * .085 * h, hc[1] + .005 * h, .088 * h, .092 * h, 16); Q.fillP(disc, PAL.cream); Q.inkP(disc, .7, .3);
      Q.fillP(ellP(hc[0] + s * .085 * h, hc[1] + .008 * h, .045 * h, .05 * h, 12), PAL.ink);
      Q.fillP(ellP(hc[0] + s * .085 * h - .012 * h, hc[1] - .012 * h, .014 * h, .014 * h, 8), PAL.cream);
    }
    const beak = [[hc[0] - .026 * h, hc[1] + .03 * h], [hc[0] + .026 * h, hc[1] + .03 * h], [hc[0], hc[1] + .085 * h]]; Q.fillP(beak, PAL.amber); Q.inkP(beak, .7, 0);
    for (const dx of [-.06, 0, .06]) Q.line([[hc[0] + dx * h, hc[1] - .17 * h], [hc[0] + dx * h * .9, hc[1] - .11 * h]], .8, OWL_D, 'inkfine', 0);
  } else if (name === 'mo') {
    Q.part('mo');
    // striped tail behind
    const tail = tubePoly(PP([[.13, -.10], [.26, -.16], [.30, -.30], [.24, -.42]]), [.09 * h, .11 * h, .11 * h, .08 * h], true, 4);
    Q.fillP(tail, RACC); Q.inkP(tail, .9, .3);
    for (const [a, b] of [[[.262, -.185], [.29, -.20]], [[.285, -.27], [.318, -.28]], [[.285, -.35], [.31, -.36]]]) Q.fillP(tubePoly(PP([a, b]), [.06 * h, .06 * h], false), RACC_D);
    for (const s of [-1, 1]) { const f = ellP(...P(s * .08, -.012), .062 * h, .03 * h, 10); Q.fillP(f, RACC_D); Q.inkP(f, .7, .3); }
    const legs = PP([[-.15, -.14], [.15, -.14], [.14, -.03], [-.14, -.03]]); Q.fillP(legs, RACC); Q.inkP(legs, .8, .2);
    const body = PP([[-.16, -.50], [.16, -.50], [.20, -.36], [.20, -.14], [-.20, -.14], [-.20, -.36]]);
    Q.fillP(body, TUNIC); Q.shade(PP([[.16, -.50], [.20, -.36], [.20, -.14], [.09, -.14], [.08, -.36], [.06, -.50]]), mixCol(TUNIC, PAL.ink, .3)); Q.inkP(body, 1.1, .2);
    // satchel strap and satchel
    Q.line(PP([[.12, -.50], [.02, -.34], [-.14, -.20]]), 1.6, mixCol(TUNIC, PAL.ink, .6), 'ink', .2);
    const bag = PP([[-.26, -.27], [-.13, -.29], [-.11, -.13], [-.25, -.11]]); Q.fillP(bag, '#78350F'); Q.inkP(bag, .8, .1);
    Q.fillP(PP([[-.26, -.27], [-.13, -.29], [-.135, -.235], [-.255, -.225]]), mixCol('#78350F', PAL.ink, .3));
    const bk = ellP(...P(-.19, -.22), .012 * h, .012 * h, 8); Q.fillP(bk, PAL.gold);
    armDraw(-1, 0);
    // scarf: ember band + hanging tail
    const sc = PP([[-.15, -.535], [.15, -.535], [.17, -.47], [.02, -.44], [-.17, -.47]]); Q.fillP(sc, PAL.ember); Q.shade(PP([[.15, -.535], [.17, -.47], [.02, -.44], [.03, -.5]]), mixCol(PAL.ember, PAL.ink, .3)); Q.inkP(sc, .9, .2);
    const st = PP([[.05, -.47], [.13, -.46], [.15, -.30], [.07, -.29]]); Q.fillP(st, PAL.ember); Q.inkP(st, .8, .1);
    armDraw(1, wv);
    // head: raccoon
    const hc = P(0, -.68);
    for (const s of [-1, 1]) { const ear = ellP(hc[0] + s * .15 * h, hc[1] - .14 * h, .065 * h, .075 * h, 12); Q.fillP(ear, RACC); Q.inkP(ear, .9, .3); Q.fillP(ellP(hc[0] + s * .15 * h, hc[1] - .135 * h, .035 * h, .045 * h, 10), RACC_D); }
    const head = ellP(hc[0], hc[1], .225 * h, .175 * h, 22); Q.fillP(head, RACC); Q.shade(strip2(head, hc, 1, .28), RACC_D); Q.inkP(head, 1.1, .2);
    const maskC = mixCol(PAL.ink, PAL.steel, .18);
    const mask = tubePoly([P(-.13, -.69), P(0, -.665), P(.13, -.69)], [.09 * h, .085 * h, .09 * h], true, 4); Q.fillP(mask, maskC);
    for (const s of [-1, 1]) { Q.fillP(ellP(hc[0] + s * .085 * h, hc[1] - .012 * h, .036 * h, .034 * h, 12), PAL.cream); Q.fillP(ellP(hc[0] + s * .085 * h, hc[1] - .008 * h, .019 * h, .022 * h, 10), PAL.ink); Q.fillP(ellP(hc[0] + s * .085 * h - .006 * h, hc[1] - .018 * h, .007 * h, .007 * h, 6), PAL.cream); }
    const mz = ellP(hc[0], hc[1] + .07 * h, .10 * h, .065 * h, 14); Q.fillP(mz, PAL.cream); Q.inkP(mz, .8, .3);
    Q.fillP(ellP(hc[0], hc[1] + .045 * h, .028 * h, .02 * h, 8), PAL.ink);
    Q.line([P(-.03, -.60), P(0, -.585), P(.03, -.60)], .7, PAL.ink, 'inkfine', .4);
  } else {   // ash
    Q.part('ash');
    for (const s of [-1, 1]) { const f = ellP(...P(s * .075, -.012), .06 * h, .028 * h, 10); Q.fillP(f, HOOD_D); Q.inkP(f, .7, .3); }
    const robe = PP([[-.14, -.53], [.14, -.53], [.17, -.40], [.20, -.22], [.205, -.04], [-.205, -.04], [-.20, -.22], [-.17, -.40]]);
    Q.fillP(robe, ROBE_A); Q.shade(PP([[.14, -.53], [.17, -.40], [.20, -.22], [.205, -.04], [.10, -.04], [.09, -.22], [.07, -.40], [.06, -.53]]), mixCol(ROBE_A, PAL.ink, .3)); Q.inkP(robe, 1.1, .2);
    // rolled map on the back, apron
    const mp = tubePoly(PP([[-.20, -.60], [-.10, -.45]]), [.05 * h, .05 * h], true, 3); Q.fillP(mp, PAL.cream); Q.inkP(mp, .7, .2);
    const ap = PP([[-.10, -.46], [.10, -.46], [.115, -.10], [-.115, -.10]]); Q.fillP(ap, PAL.steel); Q.shade(PP([[.10, -.46], [.115, -.10], [.04, -.10], [.04, -.46]]), mixCol(PAL.steel, PAL.ink, .3)); Q.inkP(ap, .9, .1);
    Q.line(PP([[-.07, -.46], [-.11, -.53]]), 1.1, PAL.steel, 'ink', 0); Q.line(PP([[.07, -.46], [.11, -.53]]), 1.1, PAL.steel, 'ink', 0);
    Q.fillP(PP([[-.06, -.30], [.06, -.30], [.06, -.20], [-.06, -.20]]), mixCol(PAL.steel, PAL.mist, .25)); Q.inkP(PP([[-.06, -.30], [.06, -.30], [.06, -.20], [-.06, -.20]]), .6, 0);
    // lantern in the left hand
    const lh = armDraw(-1, 0);
    const lp = [x + lh.W[0] * h - .03 * h, y + lh.W[1] * h + .02 * h];
    Q.line([[lp[0] + .03 * h, lp[1] - .05 * h], [lp[0] + .03 * h, lp[1]]], .8, PAL.ink, 'inkfine', 0);
    const lan = rrPts(lp[0], lp[1], .06 * h, .085 * h, .012 * h); Q.fillP(lan, PAL.gold); Q.inkP(lan, .8, 0);
    Q.line([[lp[0] + .03 * h, lp[1] + .01 * h], [lp[0] + .03 * h, lp[1] + .08 * h]], .7, mixCol(PAL.gold, PAL.ink, .5), 'inkfine', 0);
    armDraw(1, wv);
    // hood + face
    const hc = P(0, -.68);
    const hood = ellP(hc[0], hc[1], .225 * h, .225 * h, 24); Q.fillP(hood, HOOD); Q.shade(strip2(hood, hc, 1, .3), HOOD_D);
    const cowl = PP([[-.20, -.55], [.20, -.55], [.15, -.50], [-.15, -.50]]); Q.fillP(cowl, HOOD_D);
    Q.inkP(hood, 1.1, .2);
    const op = ellP(hc[0], hc[1] + .02 * h, .135 * h, .15 * h, 18); Q.fillP(op, mixCol(PAL.night, PAL.ink, .5));
    const fc = ellP(hc[0], hc[1] + .035 * h, .095 * h, .105 * h, 16); Q.fillP(fc, SKIN); Q.shade(strip2(fc, [hc[0], hc[1] + .035 * h], 1, .3), SKIN_S);
    for (const s of [-1, 1]) { Q.fillP(ellP(hc[0] + s * .04 * h, hc[1] + .0 * h, .012 * h, .014 * h, 8), PAL.ink); }
    Q.fillP(PP([[-.02, -.63], [.02, -.63], [0, -.615]]), SKIN_S);
    const beard = PP([[-.09, -.65], [.09, -.65], [.075, -.58], [0, -.55], [-.075, -.58]]); Q.fillP(beard, PAL.mist); Q.inkP(beard, .6, .3);
    Q.line(PP([[-.05, -.61], [.05, -.61]]), .6, PAL.slate, 'inkfine', .3);
    Q.inkP(op, .8, .2);
    if (!Q.sil) glow(lp[0] + .03 * h, lp[1] + .045 * h, .16 * h, PAL.gold, .55);
  }
  return { head: [x, y - .70 * h], hand: null };
}
function strip2(pts, c, side, k) {           // the shadow-side part of a rounded shape (points right of c[0] + w*(1-k))
  const xs = pts.map(p => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs), cut = x1 - (x1 - x0) * k;
  const out = pts.filter(p => p[0] >= cut);
  const ys = out.map(p => p[1]);
  return out.length > 2 ? out.concat([[cut, Math.max(...ys)], [cut, Math.min(...ys)]]).sort((a, b) => Math.atan2(a[1] - c[1], a[0] - c[0]) - Math.atan2(b[1] - c[1], b[0] - c[0])) : pts.slice(0, 3);
}

// =====================================================================================================================
// helpers: face decal and helmet prop
// =====================================================================================================================
function faceDecal(cx, cy, size, emo = 'calm', o = {}) {
  emo = EMO[emo] ? emo : 'calm';
  const col = o.col || PAL.cream, Q = mkQ({ op: o.op ?? 255, sil: false }, size, o.key || 'decal', cx, cy);
  Q.part('decal');
  faceFeatures(Q, (X, v) => [cx + X * size, cy - (v - .53) * size, 1], size, emo, { ink: col, iris: col, lip: col, lip2: col, skinD: col, look: o.look || 0, lookY: o.lookY || 0, hi: false, eyesOnly: o.eyesOnly !== false });
  return { x: cx, y: cy };
}
function helmetProp(x, y, s, rot = 0, o = {}) {
  const yaw = o.yaw ?? .35, cy = Math.cos(yaw), sy = Math.sin(yaw), cr = Math.cos(rot), sr = Math.sin(rot), hEq = s / .156;
  const pr = (X, Y, Z) => { const xs = X * cy + Z * sy, zs = -X * sy + Z * cy, dx = xs * hEq, dy = -Y * hEq + zs * .1 * hEq; return [x + dx * cr - dy * sr, y + dx * sr + dy * cr, zs]; };
  const P = { pr, h: hEq, sdU: o.shadeSide === -1 ? -1 : 1 }, Q = mkQ({ ...o, flip: false }, hEq, o.key || 'helmet', x, y), eta = o.eta ?? -.3;
  drawHelmet(Q, P, { c: [0, 0, 0], R: .078, eta });
  const vp = pr(.078 * .98 * Math.sin(eta), .078 * .06, .078 * .98 * Math.cos(eta));
  return { visor: [vp[0], vp[1]], visible: vp[2] > .004 };
}

Object.assign(window, { pilot, pilotAnchors, bit, bitAnchors, islander, faceDecal, helmetProp });
})();
