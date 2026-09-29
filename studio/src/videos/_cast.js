// _cast.js: the cast review sheet (movie `_cast`, 12 s @ 120 bpm). Not a real video: one shot that shows a different
// part of the cast by time, so contact sheets with --sheet=... cover everything.
//   t 0-1  pilot, 5 views on a floor line, helmet          t 5-6   Bit, 3 views x 3 emotions
//   t 1-2  5 emotions: head close-ups (h 900) + medium     t 6-7   Bit with the scan-lamp beam
//   t 2-3  pilot without the coat (front, q)               t 7-8   islanders waving (small + large)
//   t 3-4  seated, reading a paper                         t 8-9   scale check: pilot, Bit, a 1.75-unit box
//   t 4-5  walk cycle strip (--strip=4:5)                  t 9-10  silhouette test (ink only)
//   t 10-12 extra: big head turnaround, big emotions (front, q), seated turntable
(() => {
  const EMOS = ['calm', 'resolve', 'strain', 'joy', 'curious'];
  const VIEWS = ['front', 'q', 'side', 'qb', 'back'];
  const bg = (col = PAL.night, floorY = null, floorCol = PAL.indigo) => {
    boilSeed('bg');
    paint(rectPts(-200, -200, W + 400, H + 400), { wash: col, ink: null });
    if (floorY != null) paint(rectPts(-200, floorY, W + 400, H + 400 - floorY), { wash: floorCol, ink: null });
  };
  const slot = (i, n, pad = 220) => pad + i * (W - 2 * pad) / (n - 1);

  function s0(t) {   // five views, helmet under the left arm
    bg(PAL.night, 830);
    VIEWS.forEach((v, i) => pilot(slot(i, 5, 260), 830, 430, { view: v, hold: 'helmet', t, key: 'pilot' + i }));
  }
  function s1(t) {   // emotions: heads at h 900 (shoulders-up), the same five at the medium-shot size below
    bg(PAL.night);
    EMOS.forEach((e, i) => pilot(slot(i, 5, 230), 1010, 900, { view: 'front', emo: e, t, key: 'pilot' + i }));
    paint(rectPts(-50, 520, W + 100, 100), { wash: PAL.night, ink: null });
    paint(rectPts(-50, 600, W + 100, H), { wash: PAL.indigo, ink: null });
    EMOS.forEach((e, i) => pilot(slot(i, 5, 230), 1040, 430, { view: i % 2 ? 'q' : 'front', emo: e, hold: 'helmet', t, key: 'pilotm' + i }));
  }
  function s2(t) {   // scholar (no coat)
    bg(PAL.indigo, 900, PAL.night);
    pilot(560, 930, 640, { view: 'front', coat: false, t, key: 'p0' });
    pilot(1010, 930, 640, { view: 'q', coat: false, t, key: 'p1' });
    pilot(1400, 930, 640, { view: 'side', coat: false, hold: 'paper', t, key: 'p2' });
    pilot(1720, 930, 430, { view: 'back', coat: false, t, key: 'p3' });
  }
  function s3(t) {   // seated, reading; a cradle arm is a steel slab
    bg(PAL.night);
    paint(rectPts(-100, 640, 2200, 60), { wash: PAL.steel, ink: PAL.ink, sw: 1 });
    paint(rectPts(-100, 700, 2200, 380), { wash: PAL.indigo, ink: null });
    pilot(420, 640, 640, { view: 'seated', hold: 'paper', t, key: 'p0' });
    pilot(920, 640, 640, { view: 'seated', hold: 'paper', yaw: .75, emo: 'curious', t, key: 'p1' });
    pilot(1400, 640, 640, { view: 'seated', hold: 'paper', yaw: 1.5708, emo: 'calm', flip: true, t, key: 'p2' });
  }
  function s4(t) {   // walk cycle strip, on twos: q, side and front views walking in place
    bg(PAL.night, 800);
    const tq = onTwos(t), wk = (tq - 4) * 2.4;
    [['q', 480], ['side', 960], ['front', 1440]].forEach(([v, x], i) => pilot(x, 800, 520, { view: v, walk: wk, t: tq, hold: i === 0 ? 'helmet' : null, key: 'pw' + i }));
  }
  function s5(t) {   // Bit: 3 views x 3 emotions
    bg(PAL.indigo);
    ['neutral', 'excited', 'alert'].forEach((e, r) => ['front', 'q', 'side'].forEach((v, c) => bit(420 + c * 540, 210 + r * 330, 78, { view: v, emo: e, t, tilt: (c - 1) * .12 })));
  }
  function s6(t) {   // Bit with the scan lamp, beam sweeping a hull panel
    bg(PAL.night);
    paint(rectPts(1180, 200, 900, 800), { wash: mixCol(PAL.steel, PAL.night, .3), ink: PAL.ink, sw: 1.2 });
    paint(rectPts(1180, 200, 60, 800), { wash: PAL.slate, ink: null });
    const b = -.15 + .3 * Math.sin(t * 3);
    bit(560, 560 + 30 * Math.sin(t * 2), 95, { view: 'q', emo: 'alert', lamp: true, beam: b, beamLen: 620, t, tilt: .06 });
    bit(1000, 240, 60, { view: 'side', lamp: true, beam: 1.05, beamLen: 380, t: t + .3, flip: true, emo: 'neutral' });
  }
  function s7(t) {   // islanders waving, small (as used) and large (to judge the design)
    bg(PAL.indigo, 620, PAL.night);
    ['nell', 'mo', 'ash'].forEach((n, i) => {
      islander(n, 420 + i * 560, 590, 250, { wave: 1, wavePhase: i * .17, t });
      islander(n, 420 + i * 560, 1060, 430, { wave: i === 1 ? .5 : 1, wavePhase: i * .29, t });
    });
  }
  function s8(t) {   // scale: pilot 1.75 u = 430 px, Bit .6 u, a 1.75 u placeholder box (1 u = 245.7 px)
    const U = 430 / 1.75;
    bg(PAL.night, 830);
    for (let i = 0; i <= 3; i++) inkLine([[240 + i * U, 850], [240 + i * U, 866]], 1, PAL.slate, 'inkfine', 0);
    paint(rectPts(1180, 830 - 1.75 * U, 1.0 * U, 1.75 * U), { wash: PAL.steel, ink: PAL.ink, sw: 1.2 });
    paint(rectPts(1180, 830 - 1.75 * U, 1.0 * U, .1 * U), { wash: PAL.slate, ink: null });
    pilot(760, 830, 1.75 * U, { view: 'q', hold: 'helmet', t, key: 'pilot' });
    bit(980, 830 - 1.0 * U, .3 * U, { view: 'q', t, emo: 'neutral' });
  }
  function s9(t) {   // silhouette test: everything ink only on a light wash
    bg(mixCol(PAL.cream, PAL.mist, .35), 830, mixCol(PAL.cream, PAL.mist, .6));
    VIEWS.forEach((v, i) => pilot(200 + i * 210, 830, 430, { view: v, hold: 'helmet', sil: true, t, key: 'pilot' + i }));
    pilot(1290, 830, 430, { view: 'front', coat: false, sil: true, t, armR: -1.3 + .3 * Math.sin(t * 8), key: 'pilot5' });
    bit(1500, 700, 60, { view: 'q', sil: true, t });
    ['nell', 'mo', 'ash'].forEach((n, i) => islander(n, 1620 + i * 130, 830, 200, { sil: true, wave: i === 1 ? 0 : 1, t, wavePhase: i * .2 }));
  }
  function s10(t) {  // extra: turnaround of the head at h 1600
    bg(PAL.night);
    VIEWS.forEach((v, i) => pilot(200 + i * 380, 2000, 1600, { view: v, t, key: 'pilot' + i }));
  }
  function s11(t) {
    bg(PAL.night);
    EMOS.forEach((e, i) => pilot(200 + i * 380, 2000, 1600, { view: t < 11 ? 'front' : 'q', emo: e, t, key: 'pilot' + i }));
  }
  function s12(t) {  // seated turntable
    bg(PAL.night, 900, PAL.indigo);
    [0, .6, 1.5708, 2.5].forEach((yw, i) => pilot(260 + i * 480, 780, 700, { view: 'seated', yaw: yw, hold: i % 2 ? 'paper' : null, t, key: 'p' + i }));
  }

  function dev(t) {   // DEV (removed later): big full bodies
    bg(PAL.night, 1040);
    ['front', 'q', 'side', 'back'].forEach((v, i) => pilot(260 + i * 470, 1040, 1000, { view: v, hold: i < 3 ? 'helmet' : null, t, key: 'd' + i }));
  }
  function shot(t) {
    if (t >= 20) return dev(t);
    if (t < 1) s0(t); else if (t < 2) s1(t); else if (t < 3) s2(t); else if (t < 4) s3(t); else if (t < 5) s4(t);
    else if (t < 6) s5(t); else if (t < 7) s6(t); else if (t < 8) s7(t); else if (t < 9) s8(t); else if (t < 10) s9(t);
    else if (t < 10.5) s10(t); else if (t < 11.5) s11(t); else s12(t);
  }
  movie('_cast', { duration: 12, bpm: 120 }, [[0, shot]]);
})();
