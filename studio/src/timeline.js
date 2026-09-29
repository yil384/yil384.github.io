// timeline.js: the video registry, the shot list, standalone loops, and the brush-wipe transition.
//
// A video file calls movie(name, { duration, bpm, offset?, scale?, fps? }, [[t0, fn], [t1, fn], ...]). Each shot fn is
// called as fn(t, lt, dur): t = video time, lt = time since the shot started, dur = the shot's length. It paints the
// WHOLE frame and must be a pure function of t (frames render in parallel and out of order).

const SHOTS = [];
const LOOPS = {};
function movie(name, project, shots) {
  applyProject({ ...project, name });
  SHOTS.length = 0;
  SHOTS.push(...shots);
  SHOTS.sort((a, b) => a[0] - b[0]);
}
function shots(list) { SHOTS.push(...list); SHOTS.sort((a, b) => a[0] - b[0]); }

function drawWorld(t) {
  if (window.LOOP) window.LOOP(t);
  else if (!SHOTS.length) placeholder(t);
  else {
    let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1][0]) i++;
    const t0 = SHOTS[i][0], end = i + 1 < SHOTS.length ? SHOTS[i + 1][0] : DUR;
    SHOTS[i][1](t, t - t0, end - t0);
    CAM = null;
  }
  flushLetters();
}

function placeholder(t) {
  boilSeed('placeholder');
  paint(rectPts(-200, -200, W + 400, H + 400), { wash: PAL.night, ink: null });
  paint(ellPts(960, 540, 420 + 20 * Math.sin(t * 2), 260, 30, 12), { fill: PAL.indigo, fillOp: 120, bleed: .3, ink: PAL.cyan, sw: 1.2 });
  letter('NO VIDEO LOADED', 960, 540, 90, PAL.cream, { ink: false });
}

// ---------- brush wipe ----------
// Fat paint strokes sweep across to cover the frame (p 0 -> .5), then drag off (.5 -> 1). Cut under full cover:
//   end of shot A:   if (lt > dur - .3) brushWipe((lt - (dur - .3)) / .6);
//   start of shot B: if (lt < .3) brushWipe(.5 + lt / .6);
function brushWipe(p, cols = [PAL.indigo, PAL.night]) {
  if (p <= 0 || p >= 1) return;
  const [c1, c2] = cols, n = 5, bh = (H + 420) / n + 40;
  push(); translate(W / 2, H / 2); rotate(-.1); translate(-W / 2, -H / 2);
  for (let i = 0; i < n; i++) {
    const y0 = -230 + i * (H + 420) / n, d = [0, .14, .06, .18, .1][i];
    const q = p < .5 ? easeOut(clamp((p * 2 - d) / (1 - d))) : ease(clamp(((p - .5) * 2 - d) / (1 - d)));
    const x0 = p < .5 ? -300 : lerp(-300, W + 400, q), x1 = p < .5 ? lerp(-300, W + 400, q) : W + 400;
    if (x1 - x0 < 30) continue;
    const pts = [], rag = k => 40 + 50 * hash(i * 31 + k) + jit(12);
    for (let k = 0; k <= 8; k++) pts.push([lerp(x0, x1, k / 8), y0 + Math.sin(k * .9 + i) * 14 + jit(5)]);
    for (let k = 1; k < 9; k++) pts.push([x1 + rag(k) - 40, y0 + bh * k / 9]);
    for (let k = 8; k >= 0; k--) pts.push([lerp(x0, x1, k / 8), y0 + bh + Math.sin(k * .8 + i * 2) * 14 + jit(5)]);
    if (p >= .5) for (let k = 8; k > 0; k--) pts.push([x0 - rag(k + 20) + 40, y0 + bh * k / 9]);
    // flat wash + a soft watercolour body; texture comes from a few dry-brush streaks (never a hatch: a hatch of long
    // lines with a fine brush is millions of stamps and stalls the renderer for tens of seconds)
    paint(pts, { wash: i % 2 ? c1 : c2, washOp: 255, fill: i % 2 ? c2 : c1, fillOp: 70, bleed: .05, tex: .8, border: .6, ink: null });
    for (let k = 0; k < 3; k++) {
      const yy = y0 + bh * (.25 + .25 * k) + jit(10), xa = Math.max(x0, -240), xb = Math.min(x1, W + 240);
      if (xb - xa > 60) inkLine([[xa, yy], [xb, yy + jit(8)]], 1.2, mixCol(i % 2 ? c2 : c1, PAL.mist, .35), 'dry', 0);
    }
  }
  pop();
}

// Hard cut with an impact flash: 1-2 frames of a flat colour, used between action shots.
function smashCut(lt, dur, col = PAL.cream) {
  if (lt < 1 / 12) impactFrame(1 - lt * 12, col);
  if (lt > dur - 1 / 24) impactFrame(1, col);
}
