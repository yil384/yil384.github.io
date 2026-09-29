// _test.js: exercises the engine end to end (cel-3D part, ink, glow, speed lines, letters, wipe). Not a real video.
(() => {
  const mechBody = mergeMesh(
    placeMesh(boxMesh(6, 7, 4, PAL.slate), xf({ pos: [0, 8, 0] })),
    placeMesh(boxMesh(3, 3, 3, PAL.steel), xf({ pos: [0, 13, 0] })),
    placeMesh(boxMesh(2, 6, 2.4, PAL.slate), xf({ pos: [-4.6, 8, 0], rot: [0, 0, .15] })),
    placeMesh(boxMesh(2, 6, 2.4, PAL.slate), xf({ pos: [4.6, 8, 0], rot: [0, 0, -.15] })),
    placeMesh(boxMesh(2.4, 5, 3, PAL.steel), xf({ pos: [-1.8, 2.5, 0] })),
    placeMesh(boxMesh(2.4, 5, 3, PAL.steel), xf({ pos: [1.8, 2.5, 0] })),
    placeMesh(latheMesh([[1.2, 0], [1.2, 2.5], [0, 3]], 8, PAL.ember, { face: { glow: 1 } }), xf({ pos: [0, 8, -2.6], rot: [Math.PI / 2, 0, 0] })),
  );
  function shot(t, lt, dur) {
    const cam = cam3({ pos: [Math.sin(t * .5) * 34, 12 + 3 * Math.sin(t * .3), Math.cos(t * .5) * 34], look: [0, 7, 0], fov: 38 });
    boilSeed('bg');
    paint(rectPts(-200, -200, W + 400, H + 800), { wash: PAL.night, ink: null });
    paint(ellPts(960, 300, 1300, 500, 30, 12), { fill: PAL.indigo, fillOp: 120, bleed: .3, tex: .6, ink: null });
    gridFloor(cam, 0, 4, 40, mixCol(PAL.steel, PAL.night, .3), .6);
    glow(960, 180, 400, PAL.amber, .5);
    cel3dPaint(cam, [
      { mesh: mechBody, key: 'mech', ink: PAL.ink, sw: 1.1, shadow: [0, 0, 0, 6] },
      { mesh: boxMesh(30, 1, 30, PAL.steel), at: xf({ pos: [0, -.5, 0] }), key: 'deck', ink: PAL.ink, sw: .8 },
    ], { edges: 'all', light: [.4, .7, .6], fog: true });
    billboard(cam, [0, 8, -2.6], (x, y, s) => streak(x, y, 40 * s, 12 * s, PAL.ember, .9 * pulse(t, 4)));
    speedLines(960, 540, seg(lt, 1, 1.4) * (1 - seg(lt, 2.2, 2.6)), 40);
    if (lt > 2.5) letter('CEL 3D TEST', 960, 900, 120, PAL.cream, { pop: (lt - 2.5) * 3, tracking: 6 });
    letterbox(seg(lt, 0, 1));
    if (lt > dur - .3) brushWipe((lt - (dur - .3)) / .6);
  }
  movie('_test', { duration: 6, bpm: 128, scale: 2 / 3 }, [[0, shot]]);
})();
