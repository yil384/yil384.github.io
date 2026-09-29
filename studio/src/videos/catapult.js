// catapult.js: V3 "CATAPULT", 12 s loop, bpm 120 (docs/STORYBOARD.md V3-A..C). Machine only: K-01 on a 32x32 tile floor,
// four wavefronts light the grid, the mech launches, the tiles cool, one tile stays alive, a brush wipe closes the loop.
(() => {
  BUDGET.maxStrokes = 800; BUDGET.maxFaces = 700;
  const flat = (pts, col, op = 255) => paint(pts, { wash: col, washOp: op, ink: null });
  const N = 32, TILE = 1.5, HALF = N / 2;
  const WAVES = [[1.5, 8], [2.5, 12], [3.3, 18], [3.9, 26]];               // [start s, tiles per s]
  const RAMP = [PAL.steel, mixCol(PAL.steel, PAL.amber, .35), PAL.amber, mixCol(PAL.amber, PAL.gold, .6), PAL.gold];
  const ramp = L => { const i = Math.min(3, Math.floor(L)); return mixCol(RAMP[i], RAMP[i + 1], L - i); };
  const onScreen = q => q.some(p => Number.isFinite(p[0]) && p[0] > -160 && p[0] < W + 160 && p[1] > -160 && p[1] < H + 160);

  // level of tile (i, j) at time t: 0 (dark steel) .. 4 (gold). `cool` (a diagonal index) turns the far side back to steel.
  function level(i, j, t, cool = Infinity) {
    const d = i + j; let L = 0;
    for (const [t0, sp] of WAVES) L += smoothstep01(((t - t0) * sp - d) / 2 + .5);
    if (d > cool) L *= 1 - smoothstep01((d - cool) / 5);            // reverse wave: tiles behind the returning front go dark
    return L;
  }
  function tiles(cam, t, o = {}) {
    boilSeed('tiles');
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = (i - HALF) * TILE, z = (j - HALF) * TILE, e = .06 * TILE;
      const q = [[x + e, z + e], [x + TILE - e, z + e], [x + TILE - e, z + TILE - e], [x + e, z + TILE - e]].map(([a, b]) => cam.project([a, 0, b]));
      if (q.some(p => !Number.isFinite(p[0])) || !onScreen(q)) continue;
      let col = o.only ? (i === HALF && j === HALF ? mixCol(PAL.steel, PAL.gold, o.only) : PAL.steel) : ramp(level(i, j, t, o.cool));
      if (!o.only) { const fr = WAVES.reduce((m, [t0, sp]) => Math.min(m, Math.abs((t - t0) * sp - (i + j))), 9); if (fr < 1.2) col = mixCol(col, PAL.cream, .35 * (1 - fr / 1.2)); }
      flat(q.map(p => [p[0], p[1]]), col);
    }
  }
  const lamps = cam => { for (const [x, z] of [[-21, -21], [21, -21], [-21, 21], [21, 21]]) billboard(cam, [x, 9, z], (sx, sy, s) => { flat(rectPts(sx - 6, sy - 5, 12, 10), PAL.cream); glow(sx, sy, 90 + s * 1.5, PAL.amber, .7); }); };

  const overview = (t, lt) => cam3({ pos: [0, kf(t, [[0, 46], [5.5, 38]], ease), -10], look: [0, 0, 2], fov: 40, roll: .14 * ease(seg(t, 0, 5.5)) });

  // ---- V3-A  0-5.5  Wavefronts ----
  function shotA(t, lt) {
    const cam = overview(t, lt), thr = ease(seg(t, 3.0, 5.5));
    paint(rectPts(-200, -200, W + 400, H + 400), { wash: PAL.night, ink: null });
    tiles(cam, t);
    lamps(cam);
    const mech = k01(K01_POSES.rest, { thrust: thr, visor: PAL.cyan, visorGlow: 1 });
    cel3dPaint(cam, mech.parts, { edges: 'all', light: [.3, 1, .2] });
    for (const s of ['nozzleL', 'nozzleR']) { const p = cam.project(mech.anchor(s)); if (Number.isFinite(p[0])) glow(p[0], p[1], 90 * thr, PAL.gold, .9 * thr); }
    if (lt < .3) brushWipe(.5 + lt / .6, [PAL.steel, PAL.cream]);
  }

  // ---- V3-B  5.5-9.0  Launch ----
  const HIT = 6.08;
  function shotB(t, lt) {
    const cam = cam3({ pos: [34, 6, 0], look: [0, 8, 0], fov: 40 });
    const [sx, sy] = t > HIT ? shakeXY(t, 14 * Math.exp(-(t - HIT) * 3.5)) : [0, 0], impact = t >= 6.0 && t < HIT;
    camBegin(960 + sx, 540 + sy, 1);
    paint(rectPts(-300, -300, W + 600, H + 600), { wash: impact ? PAL.cream : PAL.night, ink: null });
    if (!impact) { tiles(cam, t, { cool: 50 - (t - 7.5) * 30 }); lamps(cam); }
    const crouch = ease(seg(t, 5.5, 5.75));
    let pose = k01Blend(K01_POSES.rest, K01_POSES.crouch, crouch);
    const fly = ease(seg(t, HIT, HIT + .3)), rise = t > HIT ? Math.pow((t - HIT) * 14, 2) : 0;
    pose = k01Blend(pose, { ...K01_POSES.launch, rot: [.22, 0, 0] }, fly);
    pose = { ...pose, grounded: fly < .01, pos: [0, rise, 0], thrust: 1 };
    const mech = k01(pose, { visor: PAL.cyan, visorGlow: 1 });
    let parts = mech.parts; if (impact) parts = parts.map(p => ({ ...p, mesh: recolor({ verts: p.mesh.verts, faces: p.mesh.faces.map(f => ({ ...f, glow: 0 })) }, () => PAL.ink), noShade: true, ink: null }));
    cel3dPaint(cam, parts, { edges: impact ? 'none' : 'all', light: [.3, .8, .3] });
    const foot = cam.project([0, 0, 0]);
    if (impact) speedLines(foot[0], foot[1] - 40, 1, 48, PAL.ink, 2);
    if (t > 5.5 && !impact) for (const s of ['nozzleL', 'nozzleR']) { const p = cam.project(mech.anchor(s)); if (Number.isFinite(p[0])) glow(p[0], p[1], 110 * backOut(seg(t, 5.5, 5.9)) + 30, PAL.gold, .95); }
    if (t > HIT) {   // thruster ribbons trail below the rising mech
      boilSeed('trail');
      for (const s of ['nozzleL', 'nozzleR']) { const a = mech.anchor(s), pts = []; for (let k = 0; k < 6; k++) { const p = cam.project([a[0], a[1] - k * 3, a[2]]); if (Number.isFinite(p[0])) pts.push([p[0], p[1]]); } if (pts.length > 2) flat(ribbon(pts, 22, 3), PAL.gold, 230); }
      speedLines(960, 700, 1 - seg(t, HIT, 6.6), 48, PAL.ink, 1.6);
    }
    // dust ring at the feet: an expanding ink ring over a faint wash
    if (t > 6.1) {
      const rx = 900 * easeOut(seg(t, 6.1, 7.5)), fade = 1 - seg(t, 6.6, 7.6);
      if (fade > 0) {
        boilSeed('dust');
        flat(ellPts(foot[0], foot[1], rx, rx * .28, 32), PAL.bone, 50 * fade);
        const ring = ellPts(foot[0], foot[1], rx, rx * .28, 40); ring.push(ring[0]);
        inkLine(ring, 7 * fade + 1, PAL.bone, 'dry', .5);
        inkLine(ellPts(foot[0], foot[1], rx * .8, rx * .22, 36).concat([[foot[0] + rx * .8, foot[1]]]), 4 * fade + 1, PAL.mist, 'dry', .5);
      }
    }
    camEnd();
  }

  // ---- V3-C  9.0-12.0  One tile ----
  function shotC(t, lt, dur) {
    const cam = cam3({ pos: [0, 38 + .6 * Math.sin(lt * .6), -10], look: [0, 0, 2], fov: 40, roll: .14 });
    paint(rectPts(-200, -200, W + 400, H + 400), { wash: PAL.night, ink: null });
    const pl = pulse(t, 5);
    tiles(cam, t, { only: .35 + .65 * pl });
    const c = cam.project([0, 0, 0]);
    glow(c[0], c[1], 110 * pl + 30, PAL.gold, .9 * pl);
    for (const [x, z] of [[-21, -21], [21, -21], [-21, 21], [21, 21]]) billboard(cam, [x, 9, z], (sx, sy, s) => { flat(rectPts(sx - 6, sy - 5, 12, 10), PAL.cream, 255 * lerp(1, .3, seg(t, 9, 11))); glow(sx, sy, 90 + s * 1.5, PAL.amber, .7 * lerp(1, .3, seg(t, 9, 11))); });
    if (lt > dur - .3) brushWipe((lt - (dur - .3)) / .6, [PAL.steel, PAL.cream]);
  }

  movie('catapult', { duration: 12, bpm: 120, scale: 2 / 3 }, [[0, shotA], [5.5, shotB], [9.0, shotC]]);
})();
