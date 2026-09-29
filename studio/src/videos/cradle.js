// cradle.js: V2 "CRADLE", 10 s loop, bpm 120 (docs/STORYBOARD.md V2-A). One shot. The machine rests in its gantry, the Pilot
// reads on the cradle arm, Unit-7 holds the diagnostic cable on the other arm, Bit does the rounds with its scan lamp.
// Every periodic term divides 10 s, so the frame at t = 10 equals t = 0.
// Framing differs from the storyboard where its numbers put the actors off-frame: the camera is on the FRONT side of the mech
// (the visor must be visible) and closer, and Unit-7 stands on the left cradle arm instead of at the foot (below the crop).
(() => {
  BUDGET.maxStrokes = 800; BUDGET.maxFaces = 700;
  const DUR = 10, PI = Math.PI;
  const flat = (pts, col, op = 255) => paint(pts, { wash: col, washOp: op, ink: null });
  const CAM = { pos: [-10, 10.5, 21], look: [-1.2, 12.6, 0], fov: 36 };
  const SEAT = [-4.6, 8.45, .4], U7 = [4.1, 8.45, .8];
  const PALS = [[-12, 9, -6], [12, 9, -6], [-12, 9, 6], [12, 9, 6]];

  function bitPath(lt) { const p = lt / DUR * TAU; return [-5.2 + 6.8 * Math.sin(p), 12 + 2.2 * Math.sin(2 * p), 3.4 * Math.cos(p) + 1.5]; }

  function shot(t, lt) {
    const cam = cam3({ ...CAM });
    camBegin(960 + 18 * Math.sin(lt * TAU / DUR), 540, 1);
    flat(rectPts(-400, -200, W + 800, H + 400), PAL.night);
    flat(ellPts(960, 480, 1500, 520, 32), PAL.indigo, 80);
    // the floor lamp pool is this shot's one watercolour fill
    const fp = cam.project([0, 0, 4]); const fs = cam.scaleAt([0, 0, 4]);
    if (Number.isFinite(fp[0])) paint(ellPts(960, 1010, 900, 150, 30, 8), { fill: mixCol(PAL.amber, PAL.ember, .7), fillOp: 55 + 10 * pulse(t, 4), bleed: .3, tex: .5, ink: null });
    // set + machine
    const flick = seg(t, 8.0, 8.08) - seg(t, 8.08, 8.17);                       // 2-frame visor flicker: it is "listening"
    const mech = k01(k01Pose('parked', { head: [.05, .12, 0] }), { visor: PAL.cyan, visorGlow: 1, tone: (n, c) => mixCol(c, PAL.ink, .12 - .1 * flick) });
    const u7 = unit7({ pos: U7, yaw: -2.6, tilt: .18 * (spring(t, 1.0, 1.2, 7) - spring(t, 9.0, .8, 8) + .3 * Math.sin(lt * TAU / DUR)), armFlex: -.5, armAbd: .05 });
    const rig = gantry().filter(p => p.key !== 'gantry.pillar-11' && p.key !== 'gantry.pillar11');       // the near pillars would slice the frame
    cel3dPaint(cam, [...mech.parts, ...rig, ...u7, ...hangarWalls({ z0: -20, z1: 20 })], { edges: 'all', light: [.4, .8, .3], fog: false });
    // lamps breathe on the beat
    boilSeed('lamps');
    for (const [x, y, z] of PALS) billboard(cam, [x, y, z], (sx, sy, s) => { flat(rectPts(sx - 5, sy - 4, 10, 8), PAL.cream); glow(sx, sy, (40 + s * 3) * (1 + .08 * pulse(t, 4)), PAL.amber, .85); });
    // diagnostic cable: Unit-7 -> the mech's hip
    const hand = cam.project(vadd(U7, [-.7, 1.0, .1])), hip = cam.project([1.6, 10.6, .9]), mid = cam.project([2.8, 8.3, 1.4]);
    if ([hand, hip, mid].every(p => Number.isFinite(p[0]))) { boilSeed('cable'); inkLine(through([[hand[0], hand[1]], [mid[0], mid[1]], [(mid[0] + hip[0]) / 2 + 10, (mid[1] + hip[1]) / 2 + 30], [hip[0], hip[1]]], 8), 2.2, PAL.steel, 'ink', .4); }
    // the Pilot, seated on the right cradle arm, reading
    const lookK = ease(seg(t, 4.5, 4.7)) * (1 - ease(seg(t, 6.0, 6.2)));
    billboard(cam, SEAT, (px, py, s) => {
      boilSeed('pilot');
      if (typeof pilot === 'function') pilot(px, py, 1.75 * s, { view: 'seated', flip: true, hold: 'paper', emo: t >= 4.5 && t < 6.2 ? 'curious' : 'calm', yaw: lerp(PI / 2, PI / 2 - .8, lookK), t, look: 0 });
      else { const h = 1.75 * s * .75; flat(rrPts(px - h * .2, py - h, h * .4, h, h * .1), PAL.hull); }
    });
    // Bit on its closed path, scan-lamp beam sweeping the right shoulder panel
    const bp = bitPath(lt), ph = lt / DUR * TAU;
    billboard(cam, bp, (px, py, s) => {
      const r = .32 * s, sh = cam.project([-6.05, 14.4, .4]), aim = Number.isFinite(sh[0]) ? Math.atan2(sh[1] - py, sh[0] - px) : 0, on = seg(t, 2.0, 2.4) * (1 - seg(t, 4.3, 4.6));
      if (typeof bit === 'function') bit(px, py, r, { view: 'q', flip: Math.cos(ph) < 0, emo: t >= 3.4 && t < 4.6 ? 'excited' : 'neutral', t, lamp: on > .01, beam: aim, beamLen: r * 4 * on });
      else flat(ellPts(px, py, r, r, 20), PAL.cyan);
    });
    // spark burst at 3.5 s, 20 radial flicks for half a second
    if (t >= 3.5 && t < 4.0) {
      const sc = cam.project([-6.05, 14.4, .9]); boilSeed('spark');
      if (Number.isFinite(sc[0])) for (let i = 0; i < 20; i++) { const a = i / 20 * TAU + hash(i) * .3, k = frac((t - 3.5) * 2 + hash(i) * .05), r0 = 14 + 70 * k, r1 = r0 + 26 * (1 - k); inkLine([[sc[0] + Math.cos(a) * r0, sc[1] + Math.sin(a) * r0], [sc[0] + Math.cos(a) * r1, sc[1] + Math.sin(a) * r1]], 2.2 * (1 - k) + .6, i % 2 ? PAL.cream : PAL.amber, 'inkfine', 0); }
      glow(sc[0], sc[1], 70 * (1 - seg(t, 3.5, 4.0)), PAL.cream, .8);
    }
    // a tile wave crosses the floor under Bit, 6.5-9.0
    if (t > 6.5 && t < 9.4) {
      const front = (t - 6.5) * 12, n = 8, cw = 1.6;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const e = .08, q = [[i + e, j + e], [i + 1 - e, j + e], [i + 1 - e, j + 1 - e], [i + e, j + 1 - e]].map(([u, v]) => cam.project([(u - n / 2) * cw, 0, (v - n / 2) * cw + 1]));
        if (q.some(p => !Number.isFinite(p[0]))) continue;
        const d = front - (i + j) * 1.2; if (d < -1 || d > 9) continue;
        flat(q.map(p => [p[0], p[1]]), tileWaveColor(i, j, front / 1.2, { cool: 4 }), 210 * (1 - seg(d, 6, 9)));
      }
    }
    if (flick > .01) { const vp = cam.project(mech.anchor('visor')); glow(vp[0], vp[1], 120, PAL.cyan, .9 * flick); }
    camEnd();
  }
  movie('cradle', { duration: DUR, bpm: 120, scale: 2 / 3 }, [[0, shot]]);
})();
