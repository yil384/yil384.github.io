// _wipe.js: isolates which part of the brush wipe leaves the renderer slow afterwards.
(() => {
  const base = () => { boilSeed('bg'); paint(rectPts(-200, -200, W + 400, H + 400), { wash: PAL.night, ink: null }); boilSeed('l'); for (let i = 0; i < 40; i++) inkLine([[100 + i * 40, 100], [200 + i * 40, 900]], 1.2, PAL.cream, 'ink', 0); };
  function stroke(p, o) {
    const n = 5, bh = (H + 420) / n + 40;
    push(); translate(W / 2, H / 2); rotate(-.1); translate(-W / 2, -H / 2);
    for (let i = 0; i < n; i++) {
      const y0 = -230 + i * (H + 420) / n, x0 = -300, x1 = lerp(-300, W + 400, p);
      const pts = []; for (let k = 0; k <= 8; k++) pts.push([lerp(x0, x1, k / 8), y0 + Math.sin(k * .9 + i) * 14]);
      for (let k = 1; k < 9; k++) pts.push([x1 + 40, y0 + bh * k / 9]);
      for (let k = 8; k >= 0; k--) pts.push([lerp(x0, x1, k / 8), y0 + bh + Math.sin(k * .8 + i * 2) * 14]);
      paint(pts, o(i));
    }
    pop();
  }
  const shots = [
    ['base', () => base()],
    ['full wipe', () => { base(); stroke(.3, i => ({ wash: PAL.indigo, washOp: 255, fill: PAL.night, fillOp: 70, bleed: .05, tex: .8, border: .6, ink: null, hatch: { d: 44, a: 0, o: { rand: .6, gradient: .5 }, b: 'charcoal', c: PAL.mist, w: .8 } })); }],
    ['wipe fill only', () => { base(); stroke(.3, i => ({ fill: PAL.night, fillOp: 70, bleed: .05, tex: .8, border: .6, ink: null })); }],
    ['wipe wash only', () => { base(); stroke(.3, i => ({ wash: PAL.indigo, washOp: 255, ink: null })); }],
    ['wipe hatch only', () => { base(); stroke(.3, i => ({ hatch: { d: 44, a: 0, o: { rand: .6, gradient: .5 }, b: 'charcoal', c: PAL.mist, w: .8 }, ink: null })); }],
    ['wipe clipped (inside canvas)', () => { base(); stroke(.3, i => ({ wash: PAL.indigo, washOp: 255, fill: PAL.night, fillOp: 70, bleed: .05, tex: .8, border: .6, ink: null })); }],
  ];
  movie('_wipe', { duration: shots.length, bpm: 120, scale: 2 / 3 }, shots.map((s, i) => [i, () => s[1]()]));
})();
