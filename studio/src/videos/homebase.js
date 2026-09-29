// homebase.js: V4 "HOME BASE", 12 s, bpm 120 (docs/STORYBOARD.md V4-A..C): the mech descends to the island, the scholar and
// Bit run in, the islanders wave, and the sealed chamber door pulses once.
// The island is built at scale S = 4 so the 18 u mech fits its plaza. Camera and character scales follow the storyboard's
// intent: V4-B is a LOW shot at the mech's feet (the head is out of frame) with the scholar and Bit in the foreground.
(() => {
  BUDGET.maxStrokes = 800; BUDGET.maxFaces = 700;
  const S = 4, ISL = { pos: [0, 0, 0], scale: S };
  const PLAZA = [.6 * S, .25 * S, .8 * S], TOP = .245 * S;                 // plaza centre (world) and plaza top height
  const haveChar = { pilot: typeof pilot === 'function', bit: typeof bit === 'function', islander: typeof islander === 'function' };
  const flat = (pts, col, op = 255) => paint(pts, { wash: col, washOp: op, ink: null });
  const full = col => flat(rectPts(-1200, -200, W + 2400, H + 400), col);
  const bands = (y0, y1, cols, n = 9) => { const h = (y1 - y0) / n; for (let i = 0; i < n; i++) { const k = i / (n - 1), c = cols.length === 2 ? mixCol(cols[0], cols[1], k) : k < .5 ? mixCol(cols[0], cols[1], k * 2) : mixCol(cols[1], cols[2], k * 2 - 1); flat(rectPts(-1200, y0 + i * h, W + 2400, h + 3), c); } };
  const horizonY = cam => 540 + cam.F * Math.tan(Math.asin(cam.f[1]));
  const SUN = [1180, 300];
  function skyAndSea(cam, t, o = {}) {
    const hy = clamp(horizonY(cam), -400, 1500);
    bands(-300, hy, [PAL.cyan, mixCol(PAL.cyan, PAL.cream, .5), PAL.cream], 9);
    glow(SUN[0], SUN[1], 460, PAL.gold, .75);
    if (o.haze !== false) paint(ellPts(960, hy, 1600, 130, 30, 10), { fill: PAL.cream, fillOp: 130, bleed: .3, tex: .5, ink: null });
    bands(hy, hy + 1400, [PAL.teal, PAL.indigo], 6);
    boilSeed('sea');
    for (let i = 0; i < 14; i++) { const y = lerp(hy + 30, 1080, hash(i * 3.1)); if (y > 1090) continue; const x = ((-(t) * (200 + 300 * hash(i)) - i * 210) % 2600 + 2600) % 2600 - 400; inkLine([[x, y], [x + 140 + 220 * hash(i + 7), y]], 1.2, PAL.mist, 'inkfine', 0); }
    return hy;
  }
  function plazaTiles(cam, front) {
    const n = 6, cw = .75 * S * .98, c0 = [PLAZA[0], TOP + .03, PLAZA[2]];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const e = .07, q = [[i + e, j + e], [i + 1 - e, j + e], [i + 1 - e, j + 1 - e], [i + e, j + 1 - e]].map(([u, v]) => cam.project([c0[0] + (u - n / 2) * cw, c0[1], c0[2] + (v - n / 2) * cw]));
      if (q.some(p => !Number.isFinite(p[0]))) continue;
      flat(q.map(p => [p[0], p[1]]), tileWaveColor(i, j, front, { cool: 4, warm: .5 }), 235);
    }
  }
  const mechAt = t => kf(t, [[0, [-30, 92, -70]], [4.0, [PLAZA[0], TOP + 6, PLAZA[2]]]], ease);

  // ---- V4-A  0.0-4.0  Descent ----
  function shotA(t, lt) {
    const m = mechAt(t), cam = cam3({ pos: [m[0] - 10, m[1] + 8, m[2] - 24], look: vadd(m, [0, 7, 0]), fov: 42 });
    skyAndSea(cam, t);
    paint(ellPts(500 + 40 * Math.sin(t * .4), 300, 520, 90, 26, 12), { fill: PAL.cream, fillOp: 120, bleed: .4, tex: .5, ink: null });
    const land = ease(seg(t, 2.6, 4.0));
    const pose = k01Blend(K01_POSES.flight, K01_POSES.landing, land);
    const mech = k01({ ...pose, grounded: false, pos: m, thrust: 1 }, { visor: PAL.cyan, visorGlow: 1 });
    cel3dPaint(cam, [...mech.parts, ...island(ISL)], { edges: 'all', light: [.6, .8, .2], fog: true });
    if (t > 3.0) plazaTiles(cam, (t - 3.0) * 10);
    trail(cam, mech);
    for (const s of ['nozzleL', 'nozzleR']) { const p = cam.project(mech.anchor(s)); if (Number.isFinite(p[0])) glow(p[0], p[1], 90, PAL.gold, .9); }
    if (t < .5) iris(SUN[0], SUN[1], lerp(0, 1500, easeIn(seg(t, 0, .5))));
  }
  function trail(cam, mech) {
    boilSeed('trail');
    for (const s of ['nozzleL', 'nozzleR']) { const a = mech.anchor(s), pts = []; for (let k = 0; k < 6; k++) { const p = cam.project([a[0] + k * 1.5, a[1] + k * 5, a[2] - k * 3]); if (Number.isFinite(p[0])) pts.push([p[0], p[1]]); } if (pts.length > 2) flat(ribbon(pts, 22, 3), PAL.gold, 220); }
  }

  // ---- V4-B  4.0-8.5  Home ----
  const CAM_B = { pos: [-16, 2.5, 14], look: [PLAZA[0] - 2, 6, PLAZA[2] - 2], fov: 40 };
  function shotB(t, lt) {
    const mA = mechAt(4.0), camA = { pos: [mA[0] - 10, mA[1] + 8, mA[2] - 24], look: vadd(mA, [0, 7, 0]) };
    const kk = easeOut(seg(t, 4.0, 4.6));
    const cam = cam3({ pos: vlerp(camA.pos, CAM_B.pos, kk), look: vlerp(camA.look, CAM_B.look, kk), fov: lerp(42, CAM_B.fov, kk) });
    const [sx, sy] = t > 5.0 ? shakeXY(t, 10 * Math.exp(-(t - 5.0) * 4)) : [0, 0];
    camBegin(960 + sx, 540 + sy, 1);
    skyAndSea(cam, t, { haze: true });
    const y = lerp(mA[1], TOP, easeOut(seg(t, 4.0, 5.0))), bounce = .35 * spring(t, 5.0, 5, 16);
    const pose = k01Blend(K01_POSES.landing, K01_POSES.parked, ease(seg(t, 5.0, 5.8)));
    const mech = k01({ ...pose, grounded: true, pos: [PLAZA[0], y - TOP + TOP + Math.max(0, bounce), PLAZA[2]], thrust: t < 5.0 ? .6 : 0 }, { visor: PAL.cyan, visorGlow: 1 });
    cel3dPaint(cam, [...mech.parts, ...island(ISL)], { edges: 'all', light: [.6, .8, .2], fog: false });
    plazaTiles(cam, (t - 3.0) * 10);
    // dust at the touchdown
    if (t > 5.0) { const foot = cam.project([PLAZA[0], TOP, PLAZA[2]]), fs = cam.scaleAt([PLAZA[0], TOP, PLAZA[2]]), k = easeOut(seg(t, 5.0, 6.2)), fade = 1 - seg(t, 5.4, 6.4); if (Number.isFinite(foot[0]) && fade > 0) { flat(ellPts(foot[0], foot[1], 8 * fs * k, 8 * fs * k * .3, 30), PAL.bone, 110 * fade); flat(ellPts(foot[0], foot[1], 5 * fs * k, 5 * fs * k * .3, 30), PAL.mist, 60 * fade); } }
    if (t >= 5.0 && t < 5.05) impactFrame(.8, PAL.cream);
    // the scholar and Bit run in along the plaza line, then the islanders wave
    const right = vnorm(vcross(cam.f, [0, 1, 0])), P0 = vadd(vadd(CAM_B.pos, vmul(vnorm([cam.f[0], 0, cam.f[2]]), 9.5)), [0, TOP - CAM_B.pos[1] + .2, 0]);
    const run = stroll(t, 5.2, 6.4, -5.5, 2.6, 20), sq = t > 6.4 ? .1 * Math.exp(-8 * (t - 6.4)) * Math.cos(20 * (t - 6.4)) : 0;
    const pp = vadd(P0, vmul(right, run.x));
    billboard(cam, pp, (px, py, s) => { const h = 1.75 * s; if (haveChar.pilot) pilot(px, py, h, { view: run.view, flip: run.flip, walk: onTwos(run.walk * 2) / 2, moving: run.view === 'q', emo: t > 6.8 ? 'joy' : 'calm', coat: false, sq, armR: t > 6.8 ? -1.3 + .4 * Math.sin(t * 12) : undefined, t }); else { flat(rrPts(px - h * .16, py - h, h * .32, h, h * .1), PAL.hull); flat(ellPts(px, py - h - h * .1, h * .12, h * .14, 16), PAL.skin); } });
    const bp = vadd(vadd(P0, vmul(right, run.x + 1.1)), [0, 2.4 + .2 * Math.sin(t * 6), 0]);
    billboard(cam, bp, (px, py, s) => { const r = .5 * s; if (haveChar.bit) bit(px, py, r, { view: 'q', emo: t > 6.8 ? 'excited' : 'neutral', t }); else { flat(ellPts(px, py, r, r, 20), PAL.cyan); } });
    if (t > 6.8) [['nell', -6.6, 0], ['mo', -4.6, .4], ['ash', -2.6, .8]].forEach(([nm, rs, ph], i) => {
      const wp = vadd(vadd(CAM_B.pos, vmul(vnorm([cam.f[0], 0, cam.f[2]]), 15)), vadd(vmul(right, rs + 3), [0, TOP - CAM_B.pos[1] + .2, 0]));
      billboard(cam, wp, (px, py, s) => { const h = 2.2 * s; if (haveChar.islander) islander(nm, px, py, h, { wave: 1, wavePhase: t + ph + hash(i) * .4 }); else flat(rrPts(px - h * .16, py - h, h * .32, h, h * .1), [PAL.bone, PAL.ember, PAL.steel][i]); });
    });
    camEnd();
  }

  // ---- V4-C  8.5-12.0  The sealed door ----
  const DOOR = { pos: [20, .4, -7], yaw: -.6 };
  function shotC(t, lt, dur) {
    const cam = cam3({ pos: [20.5, 2.3, 8], look: [20, 2.9, -7], fov: 44 });
    const pan = 660 * (1 - easeOut(seg(t, 8.5, 9.3)));
    camBegin(960 + pan, 540, 1);
    skyAndSea(cam, t, { haze: false });
    cel3dPaint(cam, [...island(ISL), ...sealedDoor(DOOR)], { edges: 'all', light: [.3, .6, -.5], fog: false });
    // the glyph: a violet polygon on the door's front quad
    const c = [DOOR.pos[0] + Math.sin(DOOR.yaw) * .33, DOOR.pos[1] + 1.6, DOOR.pos[2] + Math.cos(DOOR.yaw) * .33], rx = Math.cos(DOOR.yaw), rz = -Math.sin(DOOR.yaw);
    const poly = Array.from({ length: 6 }, (_, i) => { const a = i / 6 * TAU + .3, r = .95; return cam.project([c[0] + rx * Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2] + rz * Math.cos(a) * r]); });
    const gp = cam.project(c);
    if (poly.every(p => Number.isFinite(p[0]))) { boilSeed('glyph'); const ring = poly.map(p => [p[0], p[1]]); ring.push(ring[0]); inkLine(ring, 3, PAL.violet, 'neon', .2); }
    if (Number.isFinite(gp[0])) {
      const pl = t > 10.5 && t < 11.5 ? pulse(t - 10.5 + .0, 3) : 0;
      glow(gp[0], gp[1], 90 * pl + 20, PAL.violet, .8 * (.3 + .7 * pl));
      camEnd();
      if (t > 11.4) iris(gp[0] - pan * 0 + 0, gp[1], lerp(1500, 3, easeIn(seg(t, 11.4, 12.0))));
      return;
    }
    camEnd();
  }

  movie('homebase', { duration: 12, bpm: 120, scale: 2 / 3 }, [[0, shotA], [4.0, shotB], [8.5, shotC]]);
})();
