// sortie.js: V1 "SORTIE", 26 s, bpm 120, the site's opening film (docs/STORYBOARD.md V1-A .. V1-H).
// Corrections to the storyboard, found while authoring against the real geometry:
//  * K-01 faces +z and the hangar door is at z = +70, so every camera at negative z sees the mech from BEHIND; V1-H therefore
//    looks at the head from the front (z > 0), and V1-G shows the flight in profile (the storyboard's from-behind view
//    would foreshorten the mech to a blob).
//  * The V1-F orbit runs behind -> profile (a: 0 -> -80 deg), matching the note beside it.
(() => {
  BUDGET.maxStrokes = 800; BUDGET.maxFaces = 700;   // dense frames, measured ~0.3-0.7 s each
  const flat = (pts, col, op = 255) => paint(pts, { wash: col, washOp: op, ink: null });
  const full = col => flat(rectPts(-200, -200, W + 400, H + 400), col);
  const bands = (y0, y1, cols, n = 9) => {
    const h = (y1 - y0) / n;
    for (let i = 0; i < n; i++) { const k = i / (n - 1), c = cols.length === 2 ? mixCol(cols[0], cols[1], k) : k < .5 ? mixCol(cols[0], cols[1], k * 2) : mixCol(cols[1], cols[2], k * 2 - 1); flat(rectPts(-200, y0 + i * h, W + 400, h + 3), c); }
  };
  const dimParts = (parts, k, amt = .8) => parts.map(p => ({ ...p, mesh: recolor(p.mesh, c => mixCol(c, PAL.ink, amt * (1 - k))) }));
  const silhouette = parts => parts.map(p => ({ ...p, mesh: recolor({ verts: p.mesh.verts, faces: p.mesh.faces.map(f => ({ ...f, glow: 0 })) }, () => PAL.ink), noShade: true, ink: null }));
  const havePilot = typeof pilot === 'function', haveBit = typeof bit === 'function';
  const PI = Math.PI;

  // ---- the set ----
  const LAMPS = []; for (let k = 0; k < 6; k++) for (const sx of [-1, 1]) LAMPS.push({ k, pos: [sx * 12, 9, -30 + 6 * k], floor: [sx * 10, 0, -30 + 6 * k] });
  const lampOn = (t, k, t0 = 1.0) => t >= t0 + .25 * k;
  function drawLamps(cam, t, allOn = false, t0 = 1.0) {
    boilSeed('lamps');
    for (const L of LAMPS) {
      const tk = t0 + .25 * L.k, on = allOn || t >= tk, pop = allOn ? 1 : backOut(seg(t, tk, tk + .2));
      if (on) {
        const fp = cam.project(L.floor), fs = cam.scaleAt(L.floor);
        if (Number.isFinite(fp[0]) && fs > 0) flat(ellPts(fp[0], fp[1], 5 * fs * pop, 5 * fs * pop * .26, 22), mixCol(PAL.amber, PAL.ember, .8), 42);
      }
      billboard(cam, L.pos, (sx, sy, s) => {
        const w = Math.max(6, .8 * s), h = Math.max(5, .6 * s);
        flat(rectPts(sx - w / 2, sy - h / 2, w, h), on ? PAL.cream : PAL.steel, on ? 255 : 200);
        if (on) glow(sx, sy, Math.max(20, s * 2.2) * pop, PAL.amber, .9);
      });
    }
  }
  const setParts = (o = {}) => [...gantry({ swing: o.swing }), ...hangarWalls(o.walls)];

  // ---- V1-A  0.0-3.0  Light arrives ----
  function shotA(t, lt) {
    const cam = cam3({ pos: [0, 4, -44 + 2 * ease(seg(t, 0, 3))], look: [0, 8, 10], fov: 50 });
    full(PAL.night);
    flat(ellPts(960, 560, 1500, 420, 32), PAL.indigo, 70);
    gridFloor(cam, 0, 3, 30, PAL.steel, .5);
    const litK = .5 * ease(seg(t, 2.0, 2.3)) + .5 * ease(seg(t, 2.25, 2.6));
    const mech = k01(K01_POSES.rest, { tone: (n, c) => mixCol(c, PAL.ink, .86 * (1 - litK)), visor: PAL.night });
    const lampK = clamp(seg(t, 1.0, 2.25) * .8);
    cel3dPaint(cam, [...mech.parts, ...dimParts(setParts(), lampK * .5, .8)], { edges: 'all', light: [.4, .8, .2], fog: false });
    drawLamps(cam, t);
    flash(1 - seg(t, 0, .5), PAL.paper);
  }

  // ---- V1-B  3.0-6.5  Scale ----
  function shotB(t, lt) {
    const look = kf(t, [[3.0, [0, 1.6, 0]], [3.8, [0, 1.6, 0]], [6.0, [0, 16.4, 0]]], easeOut);
    const cam = cam3({ pos: [7.5, 1.4, 14], look, fov: 42 });
    full(PAL.night);
    flat(ellPts(960, 420, 1500, 520, 32), PAL.indigo, 70);
    gridFloor(cam, 0, 3, 30, PAL.steel, .5);
    const mech = k01(K01_POSES.rest, { visor: PAL.night });
    const u7 = unit7({ pos: [4.4, 0, 4.6], yaw: 2.7, tilt: .28 * spring(t, 3.4, .8, 9) });
    cel3dPaint(cam, [...mech.parts, ...u7, ...hangarWalls()], { edges: 'all', light: [.35, .7, .6], fog: false });
    drawLamps(cam, t, true);
    // Bit floats across, scan lamp sweeping the hull
    const k = seg(t, 4.0, 6.3);
    if (k > 0 && k < 1) {
      const bp = [lerp(7, -6, k), lerp(5, 11, k) + 2 * 4 * k * (1 - k), lerp(8, 7, k)];
      billboard(cam, bp, (sx, sy, s) => {
        const r = Math.max(24, .55 * s);
        if (haveBit) bit(sx, sy, r, { view: 'q', flip: true, emo: 'neutral', t, lamp: true, beam: Math.PI + .5, beamLen: r * 5 }); else placeholderBit(sx, sy, r, t);
      });
    }
  }
  function placeholderBit(x, y, r, t) { flat(ellPts(x, y + 6 * Math.sin(t * 6), r, r, 24), PAL.cyan); flat(ellPts(x - r * .3, y, r * .16, r * .22, 12), PAL.ink); flat(ellPts(x + r * .3, y, r * .16, r * .22, 12), PAL.ink); }

  // ---- V1-C  6.5-9.5  The Pilot decides ----
  const PILOT_H = 430, FLOOR_Y = 820;
  function pilotAt(t) {
    const s = stroll(t, 6.5, 7.8, -300, 760, 22), tt = onTwos(t);
    const lookUp = seg(t, 7.8, 8.05), turnK = ease(seg(t, 8.0, 8.25));
    const emo = t < 8.8 ? 'calm' : 'resolve';
    const view = t < 7.8 ? s.view : 'q', yaw = t < 7.8 ? undefined : lerp(.70, PI - .70, turnK);
    return { x: s.x, y: FLOOR_Y + s.dy * 6, view, yaw, flip: s.flip, walk: onTwos(s.walk * 2) / 2, moving: t < 7.8 && s.view === 'q', emo, sq: .06 * ring(t, [7.8], 6, 16), armL: -.9 * easeOut(seg(t, 9.2, 9.5)), look: t < 7.8 ? 0 : -.6 * lookUp * (1 - turnK), lean: -.03 * lookUp };
  }
  const CAM_C = { pos: [-6, 1.6, -14], look: [0, 2.6, 0], fov: 38 }, DEPTH_C = 7.4;
  // the pilot stands on the 3D floor: a point DEPTH_C in front of the camera, slid sideways by his screen-x
  function pilotWorld(cam, px) { const fwd = vnorm([cam.f[0], 0, cam.f[2]]), sc = cam.F / DEPTH_C; return vadd(vadd(cam.pos, vmul(fwd, DEPTH_C)), vadd(vmul(cam.r, (px - 960) / sc), [0, -cam.pos[1], 0])); }
  function pilotOpts(P, t) { return { view: P.view, yaw: P.yaw, flip: P.flip, walk: P.walk, moving: P.moving, emo: P.emo, sq: P.sq, armL: P.armL, look: P.look, lean: P.lean, hold: 'helmet', coat: true, t }; }
  function shotC(t, lt) {
    const cam = cam3({ ...CAM_C });
    camBegin(960 + 18 * Math.sin(lt * .8), 540, 1);
    full(PAL.night);
    flat(ellPts(960, 640, 1500, 420, 32), PAL.indigo, 70);
    gridFloor(cam, 0, 3, 30, PAL.steel, .5);
    const mech = k01(K01_POSES.rest, { visor: PAL.night, tone: (n, c) => mixCol(c, PAL.ink, .6) });
    cel3dPaint(cam, [...mech.parts, ...dimParts(hangarWalls(), 0, .35)], { edges: 'all', light: [.5, .7, -.3], fog: false });
    drawLamps(cam, t, true);
    const P = pilotAt(t), wp = pilotWorld(cam, P.x);
    glow(...cam.project(vadd(wp, [0, 1.2, 1.5])).slice(0, 2), 520, PAL.amber, .32);            // warm spill behind him
    billboard(cam, wp, (px, py, s) => {
      boilSeed('pilot');
      if (havePilot) pilot(px, py, 1.75 * s, pilotOpts(P, t));
      else { const h = 1.75 * s; flat(rrPts(px - h * .16, py - h, h * .32, h, h * .1), PAL.hull); flat(ellPts(px, py - h - h * .1, h * .12, h * .14, 16), PAL.skin); }
    });
    // Bit orbits the Pilot once (6.5-8.0), then settles at his shoulder
    const ang = -2.2 + TAU * ease(seg(t, 6.5, 8.0)), rem = 1 - ease(seg(t, 7.4, 8.0)), enter = easeOut(seg(t, 6.5, 7.4));
    const bp = vadd(vadd(wp, vmul(cam.r, lerp(-3.5, -.95, enter) + Math.cos(ang) * 1.2 * rem)), [0, 1.35 + Math.sin(ang) * .35 * rem + .08 * Math.sin(t * 6), 0]);
    billboard(cam, bp, (px, py, s) => { const r = .3 * s; if (haveBit) bit(px, py, r, { view: 'q', emo: t > 8.8 ? 'alert' : 'neutral', t }); else placeholderBit(px, py, r, t); });
    camEnd();
  }
  // the helmet visor's screen point at the end of C (via pilotAnchors, pure), handed to D as its iris centre
  function helmetPoint() {
    const cam = cam3({ ...CAM_C }), P = pilotAt(9.5), wp = pilotWorld(cam, P.x), sp = cam.project(wp);
    if (typeof pilotAnchors === 'function') { const a = pilotAnchors(sp[0], sp[1], 1.75 * cam.scaleAt(wp), pilotOpts(P, 9.5)); if (a.visor) return a.visor; }
    return [sp[0] - 30, sp[1] - 1.75 * cam.scaleAt(wp) * .45];
  }

  // ---- V1-D  9.5-13.0  Compile ----
  function tileBar(t, cx, cy) {
    const front = (onTwos(t) - 11.5) * 26;
    for (let i = 0; i < 24; i++) {
      const x = cx - (23 - i) * 46, c = mixCol(PAL.steel, PAL.gold, smoothstep01((front - i) / 2));
      paint(rectPts(x - 22, cy - 22, 44, 44), { wash: front - i > 2 ? mixCol(c, PAL.amber, .35) : c, washOp: front > i - 2 ? 255 : 150, ink: PAL.ink, sw: .8, br: 'inkfine' });
    }
  }
  function shotD(t, lt) {
    full(PAL.night);
    boilSeed('hud');
    flat(ellPts(960, 540, 1300, 700, 32), PAL.indigo, 90);
    // the visor: a slab descends, a reflection band sweeps down behind it
    const closeK = easeOut(seg(t, 9.5, 10.3));
    flat(rectPts(-100, -100 - 900 * (1 - closeK), W + 200, 1080 + 200), mixCol(PAL.night, PAL.ink, .3));
    if (t < 10.5) { const by = lerp(-200, 1100, ease(seg(t, 9.55, 10.4))); paint([[-100, by], [W + 100, by - 90], [W + 100, by + 40], [-100, by + 130]], { wash: PAL.cream, washOp: 90, ink: null }); }
    glow(960, 540, 900, PAL.cyan, .12 + .08 * seg(t, 10.3, 11.5));
    // corner brackets + reticle, then three rings draw themselves
    const bk = easeOut(seg(t, 10.2, 10.6));
    if (bk > 0) for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const cx = 960 + sx * 700 * bk, cy = 540 + sy * 380 * bk;
      inkLine([[cx, cy], [cx - sx * 90, cy]], 2.4, PAL.cyan, 'neon', 0); inkLine([[cx, cy], [cx, cy - sy * 70]], 2.4, PAL.cyan, 'neon', 0);
    }
    for (const [x0, x1] of [[-420, -110], [110, 420]]) inkLine([[960 + x0 * bk, 540], [960 + x1 * bk, 540]], 1.4, mixCol(PAL.cyan, PAL.night, .35), 'neon', 0);
    for (let i = 0; i < 3; i++) {
      const r = 260 + 80 * i, k = seg(t, 10.3 + .3 * i, 10.7 + .3 * i);
      if (k <= 0) continue;
      const n = Math.max(3, Math.floor(64 * k));
      inkLine(ellPts(960, 540, r, r, 64, 0, -Math.PI / 2 + i).slice(0, n), 2.2, PAL.cyan, 'neon', .5);
      for (let m = 0; m < 8; m++) { const a = m / 8 * TAU + i * .2, p0 = [960 + Math.cos(a) * (r - 10), 540 + Math.sin(a) * (r - 10)], p1 = [960 + Math.cos(a) * (r + 14), 540 + Math.sin(a) * (r + 14)]; if (k > m / 8) inkLine([p0, p1], 1.6, PAL.cyan, 'neon', 0); }
    }
    if (t > 11.5) tileBar(t, 960, 540);
    const pl = pulse(t, 6);
    if (t > 12.5) glow(960, 540, 120 * pl + 60, PAL.gold, .9);
    if (t > 12.5) { boilSeed('eyes'); if (typeof faceDecal === 'function') faceDecal(960, 400, 300, 'resolve', { op: 110 }); else { for (const dx of [-90, 90]) flat(rectPts(960 + dx - 50, 400, 100, 16), PAL.cream, 110); } }
    // iris opening from the helmet visor
    if (t < 9.95) { const hv = helmetPoint(); iris(hv[0], hv[1], lerp(0, 1500, easeIn(seg(t, 9.5, 9.95)))); }
  }

  // ---- V1-E  13.0-16.5  Launch ----
  const HIT = 15.125;
  function shotE(t, lt) {
    const gap = easeOut(seg(t, 13.0, 14.2)), half = 14 * gap + .5;
    const cam = cam3({ pos: [0, 6, -30], look: [0, 8, 40], fov: 42 });
    const [sx, sy] = t > HIT ? shakeXY(t, 18 * Math.exp(-(t - HIT) * 3.5)) : [0, 0], whip = easeIn(seg(t, 15.4, 15.9));
    const impact = t >= 15.0 && t < HIT;
    camBegin(960 + sx, 540 + sy, 1, whip * 1.2);
    full(impact ? PAL.cream : PAL.night);
    // the light in the door gap
    const corner = (x, y) => cam.project([x, y, 70]);
    if (!impact) {
      const gp = [corner(-half, 0), corner(half, 0), corner(half, 26), corner(-half, 26)].map(p => [p[0], p[1]]);
      paint(gp, { wash: mixCol(PAL.night, PAL.cream, .55 * gap), washOp: 255, fill: PAL.cream, fillOp: 60 + 150 * gap, bleed: .3, tex: .4, ink: null });
      const hp = [corner(-half - 3, -2), corner(half + 3, -2), corner(half + 3, 29), corner(-half - 3, 29)].map(p => [p[0], p[1]]);
      paint(hp, { fill: PAL.cream, fillOp: 60, bleed: .35, tex: .5, ink: null });
    }
    { const gc = cam.project([0, 13, 70]); glow(gc[0], gc[1], 1500 * gap + 60, PAL.cream, .95 * gap); }
    // the mech
    const crouchK = ease(seg(t, 14.2, 14.45)) * (1 - ease(seg(t, 14.9, 15.0)));
    const flyK = ease(seg(t, HIT, HIT + .35));
    let pose = k01Blend(K01_POSES.rest, K01_POSES.crouch, crouchK);
    pose = k01Blend(pose, K01_POSES.flight, flyK);
    const fz = t > HIT ? Math.pow((t - HIT) * 16, 2) : 0;
    pose = { ...pose, grounded: flyK < .01, pos: [0, 4 * flyK, fz], thrust: seg(t, 14.6, 15.0) };
    const darkK = clamp(.4 + .58 * gap);
    const mech = k01(pose, { tone: (n, c) => mixCol(c, PAL.ink, darkK), ink: mixCol(PAL.ink, PAL.cream, gap * .3), visor: PAL.night });
    const rocking = ring(t, [HIT], 4, 18) * .22;
    let parts = [...mech.parts, ...blastDoors(gap), ...gantry({ swing: [rocking, -rocking] }), ...hangarWalls()];
    if (impact) parts = silhouette(parts.filter(p => p.key.startsWith('mech')));
    cel3dPaint(cam, parts, { edges: impact ? 'none' : 'all', light: [0, .3, 1], fog: false });
    if (impact) speedLines(...cam.project(mech.anchor('chest')).slice(0, 2), 1, 64, PAL.ink, 2);
    // lights
    glow(960, 540, 120 * (1 - seg(t, 13.0, 13.3)), PAL.gold, .9);
    if (!impact) {

      for (const side of ['nozzleL', 'nozzleR']) { const p = cam.project(mech.anchor(side)); if (Number.isFinite(p[0]) && t > 14.6) glow(p[0], p[1], 80 * backOut(seg(t, 14.6, 15.0)) + 20, PAL.gold, .9); }
      if (t > HIT) trailFor(cam, mech, t);
    }
    // whip: streak bars
    if (whip > 0) for (let i = 0; i < 16; i++) flat(rectPts(-400, 60 + hash(i) * 960, 2700, 6 + 22 * hash(i + 4)), i % 2 ? PAL.mist : PAL.cream, 210 * whip);
    camEnd();
    flash(.5 * whip, PAL.cream);
  }
  // thruster ribbons: two gold strips trailing behind the nozzles in world space
  function trailFor(cam, mech, t) {
    boilSeed('trail');
    for (const side of ['nozzleL', 'nozzleR']) {
      const a = mech.anchor(side), pts = [];
      for (let k = 0; k < 6; k++) { const p = cam.project([a[0], a[1], a[2] - k * 7]); if (!Number.isFinite(p[0])) return; pts.push([p[0], p[1]]); }
      flat(ribbon(pts, 26, 4), PAL.gold, 230);
    }
  }

  // ---- V1-F  16.5-20.0  The world ----
  function shotF(t, lt) {
    const a = -(80 * Math.PI / 180) * ease(seg(t, 17.4, 19.2));
    const lookY = lerp(9, -5, ease(seg(t, 18.2, 20.0)));
    const e2 = ease(seg(t, 17.4, 19.6)), dist = lerp(34, 46, e2), fov = lerp(36, 52, e2);
    const cam = cam3({ pos: [dist * Math.sin(a), 10, -dist * Math.cos(a)], look: [0, lookY, 0], fov });
    const pitch = Math.atan2(10 - lookY, dist), hy = 540 - (540 / Math.tan(fov * Math.PI / 360)) * Math.tan(pitch);   // horizon row
    bands(-200, hy, [PAL.indigo, PAL.cyan, PAL.cream], 10);
    const sun = kf(t, [[16.5, [1350, hy - 150]], [20.0, [960, 300]]], ease);
    glow(sun[0], sun[1], 420, PAL.gold, .8);
    paint(ellPts(960, hy, 1500, 140, 30, 10), { fill: PAL.cream, fillOp: 130, bleed: .3, tex: .5, ink: null });   // fill 1: horizon haze
    bands(hy, 1300, [PAL.teal, PAL.indigo], 6);
    paint(ellPts(560 + 60 * Math.sin(t * .3), hy - 160, 520, 90, 26, 12), { fill: PAL.cream, fillOp: 120, bleed: .4, tex: .5, ink: null }); // fill 2: cloud bank
    boilSeed('sea');
    for (let i = 0; i < 16; i++) { const y = lerp(hy + 30, 1080, hash(i * 3.1)), spd = 2400 + 1600 * hash(i), x = ((-(t - 16.5) * spd - i * 190) % 3000 + 3000) % 3000 - 500; inkLine([[x, y], [x + 160 + 260 * hash(i + 7), y]], 1.2, PAL.mist, 'inkfine', 0); }
    // world: tunnel mouth receding, island sliding in below
    const isl = [-2, -17, 6 + (20 - t) * 14], S = 2.2;
    const mech = k01(K01_POSES.flight, { tone: (n, c) => mixCol(c, PAL.ink, .12), visor: PAL.cyan, visorGlow: 1 });
    const parts = [...mech.parts, ...tunnelRing({ z: -20 - (t - 16.5) * 30, len: 8, y: 6 }), ...island({ pos: isl, scale: S })];
    cel3dPaint(cam, parts, { edges: 'all', light: [.6, .8, -.2], fog: true });
    trailFor(cam, mech, t);
    for (const side of ['nozzleL', 'nozzleR']) { const p = cam.project(mech.anchor(side)); if (Number.isFinite(p[0])) glow(p[0], p[1], 90, PAL.gold, .9); }
    // plaza tiles catch the wave 19.2-20.0
    const front = (t - 19.2) * 18, n = 6, cw = S * .42, c0 = [isl[0] + S * .6, isl[1] + S * .25, isl[2] + S * .8];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const q = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([u, v]) => cam.project([c0[0] + (u - n / 2) * cw, c0[1] + .05, c0[2] + (v - n / 2) * cw]));
      if (q.some(p => !Number.isFinite(p[0]))) continue;
      flat(q.map(p => [p[0], p[1]]), t > 19.2 ? tileWaveColor(i, j, front) : PAL.steel, 200);
    }
    if (t > 19.2) { const gp = cam.project(c0); if (Number.isFinite(gp[0])) paint(ellPts(gp[0], gp[1], 240, 90, 24), { fill: PAL.gold, fillOp: 90 * seg(t, 19.2, 19.9), bleed: .3, tex: .4, ink: null }); }   // fill 3: plaza glow
    // carried whip streaks dissolving
    const dis = 1 - seg(t, 16.5, 16.75);
    if (dis > 0) for (let i = 0; i < 16; i++) flat(rectPts(-400, 60 + hash(i) * 960, 2700, 6 + 22 * hash(i + 4)), i % 2 ? PAL.mist : PAL.cream, 210 * dis);
  }

  // ---- V1-G  20.0-24.0  The name (carried by the page's HTML title) ----
  function shotG(t, lt) {
    const cam = cam3({ pos: [-80, 8, 40], look: [0, 3, 40], fov: 40 });   // aimed low: the mech rides high in the frame
    camBegin(960 + 10 * Math.sin(lt * .5), 540 + 6 * Math.sin(lt * .35), 1);
    bands(-200, 700, [PAL.cream, PAL.gold, PAL.rose], 9);
    bands(700, 1300, [PAL.rose, PAL.indigo], 5);
    paint(ellPts(960, 300, 260, 260, 40), { wash: PAL.gold, washOp: 255, fill: PAL.gold, fillOp: 80, bleed: .2, ink: null });
    paint(ellPts(960, 440, 700, 140, 30, 10), { fill: PAL.cream, fillOp: 110, bleed: .3, tex: .5, ink: null });
    glow(960, 300, 520, PAL.gold, .7);
    const tip = .06 * spring(t, 23.0, .6, 7);
    const mech = k01({ ...K01_POSES.flight, rot: [1.3 + tip, 0, 0], pos: [0, 10 - 9 + 0, 40], thrust: 1 });
    cel3dPaint(cam, silhouette(mech.parts), { edges: 'none', light: [0, 1, 0] });
    for (const side of ['nozzleL', 'nozzleR']) { const p = cam.project(mech.anchor(side)); if (Number.isFinite(p[0])) glow(p[0], p[1], 46, PAL.gold, .95); }
    camEnd();
    // No painted name card: the page stamps the real HTML title over this shot from 22.0 s (DESIGN §3.5), so the name stays
    // sharp text at every viewport. The lower-left of the frame is left open for it.
  }

  // ---- V1-H  24.0-26.0  Glint ----
  function shotH(t, lt) {
    const cam = cam3({ pos: [0, 16.5, 9], look: [0, 16.4, 0], fov: 30 });
    full(mixCol(PAL.night, PAL.indigo, .5));
    flat(ellPts(960, 540, 1200, 600, 32), PAL.indigo, 120);
    const mech = k01(K01_POSES.rest, { visor: PAL.cyan, visorGlow: 1 });
    cel3dPaint(cam, mech.parts, { edges: 'all', light: [.5, .6, .7] });
    const vc = cam.project(mech.anchor('visor'));
    // a cream glint sweeps across the visor
    const v = [cam.project([-1.15, 16.95, 1.5]), cam.project([1.15, 16.95, 1.5]), cam.project([1.15, 16.15, 1.5]), cam.project([-1.15, 16.15, 1.5])], x0 = v[0][0], x1 = v[1][0], y0 = v[0][1], y1 = v[3][1];
    const gx = lerp(x0 - 80, x1 + 80, easeOut(seg(t, 24.0, 24.8))), bw = (x1 - x0) * .09, sl = (y1 - y0) * .5, cl = x => clamp(x, x0, x1);
    if (t < 24.85) paint([[cl(gx - bw + sl), y0], [cl(gx + bw + sl), y0], [cl(gx + bw - sl), y1], [cl(gx - bw - sl), y1]], { wash: PAL.cream, washOp: 230, ink: null });
    glow(vc[0], vc[1], 160 * (1 - .5 * seg(t, 24.8, 25.5)), PAL.cyan, .85);
    if (t >= 24.8) iris(vc[0], vc[1], lerp(1500, 3, easeIn(seg(t, 24.8, 25.5))));
    letterbox(1);
  }

  const shots = [[0, shotA], [3.0, shotB], [6.5, shotC], [9.5, shotD], [13.0, shotE], [16.5, shotF], [20.0, shotG], [24.0, shotH]];
  window.SORTIE = { pilotAt, helmetPoint };
  movie('sortie', { duration: 26, bpm: 120, scale: 2 / 3 }, shots);
})();
