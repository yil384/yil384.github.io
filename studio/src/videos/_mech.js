// _mech.js: review sheet for props.js (K-01 poses from several cameras, gantry, Unit-7, island, door, tunnel). Not a real video.
(() => {
  const VIEWS = [
    // t: [pose name, camera pos, look, fov]
    ['rest', [0, 9, 46], [0, 9, 0], 38],            // 0 front
    ['rest', [0, 9, -46], [0, 9, 0], 38],           // 1 back
    ['rest', [46, 9, 0], [0, 9, 0], 38],            // 2 side
    ['crouch', [40, 8, 14], [0, 7, 0], 38],         // 3 crouch, 3/4
    ['launch', [-14, 8, -34], [0, 9, 0], 38],       // 4 launch stretch, from behind
    ['flight', [46, 6, 12], [0, 9, 0], 38],         // 5 flight, side
    ['landing', [-22, 6, 30], [0, 8, 0], 38],       // 6 landing
    ['parked', [12, 16, 14], [0, 15.5, 0], 34],     // 7 head and shoulders
  ];
  function shot(t, lt) {
    const [name, pos, look, fov] = VIEWS[Math.min(VIEWS.length - 1, Math.floor(t))];
    const cam = cam3({ pos, look, fov });
    boilSeed('bg'); paint(rectPts(-200, -200, W + 400, H + 800), { wash: PAL.night, ink: null });
    gridFloor(cam, 0, 3, 36, mixCol(PAL.steel, PAL.night, .3), .6);
    const mech = k01(k01Pose(name, name === 'flight' ? { pos: [0, 6, 0] } : {}));
    const parts = [...mech.parts, ...gantry({ swing: [0, 0] })];
    if (t < 3) parts.push(...unit7({ pos: [7, 0, 4], tilt: .2 }));
    cel3dPaint(cam, parts, { edges: 'all', light: [.4, .8, .3], fog: false });
    const a = mech.anchor('visor'), sp = cam.project(a);
    if (Number.isFinite(sp[0])) glow(sp[0], sp[1], 60, PAL.cyan, .6);
    letter(`${name}  faces ${mech.faces}`, 60, 1040, 44, PAL.cream, { align: 'left', ink: false });
  }
  function shot2(t, lt) { // set pieces
    const k = Math.floor(t) - 8, cams = [
      [[0, 14, -30], [0, 12, 70], 40], [[-16, 6, 22], [0, 2, 0], 40], [[10, 5, 14], [0, 2, 0], 34], [[0, 3, 10], [0, 2, 0], 40]];
    const [pos, look, fov] = cams[Math.max(0, Math.min(3, k))], cam = cam3({ pos, look, fov });
    boilSeed('bg'); paint(rectPts(-200, -200, W + 400, H + 800), { wash: PAL.night, ink: null });
    const parts = k === 0 ? [...blastDoors(.3), ...tunnelRing({ z: 40, len: 30 })] : k === 1 ? island() : k === 2 ? [...sealedDoor(), ...unit7({ pos: [3, 0, 2] })] : [...unit7({ tilt: .3 }), ...unit7({ pos: [2.5, 0, 0], yaw: .6 })];
    cel3dPaint(cam, parts, { edges: 'all', light: [.5, .7, .4] });
    letter(['blast doors + tunnel', 'island', 'sealed door + unit-7', 'unit-7 x2'][Math.max(0, Math.min(3, k))], 60, 1040, 44, PAL.cream, { align: 'left', ink: false });
  }
  function shot3(t) { // hero views, no gantry
    const k = Math.floor(t) - 12, V = [
      ['rest', [-24, 6, 30], [0, 9.5, 0], 36], ['rest', [22, 8, -30], [0, 10, 0], 36], ['launch', [0, 6, -34], [0, 10, 0], 34], ['flight', [50, 8, 6], [0, 9, 0], 32], ['flight', [0, 9, -44], [0, 9, 0], 32], ['flight', [-30, 12, -26], [0, 9, 0], 32],
    ][Math.max(0, Math.min(5, k))];
    const cam = cam3({ pos: V[1], look: V[2], fov: V[3] });
    boilSeed('bg'); paint(rectPts(-200, -200, W + 400, H + 800), { wash: PAL.night, ink: null });
    glow(960, 400, 700, PAL.amber, .35);
    gridFloor(cam, 0, 3, 36, mixCol(PAL.steel, PAL.night, .3), .6);
    const mech = k01(k01Pose(V[0], V[0] === 'flight' ? { pos: [0, 6, 0] } : {}));
    cel3dPaint(cam, mech.parts, { edges: 'all', light: [.5, .7, k === 1 || k === 2 ? -.4 : .5] });
    letter(`${V[0]}  faces ${mech.faces}`, 60, 1040, 44, PAL.cream, { align: 'left', ink: false });
  }
  movie('_mech', { duration: 18, bpm: 120, scale: 2 / 3 }, [[0, shot], [8, shot2], [12, shot3]]);
})();
