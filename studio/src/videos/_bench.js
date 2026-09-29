// _bench.js: one feature per shot, to measure what costs what under this renderer (see ms/frame in the sheet log).
(() => {
  const bg = () => { boilSeed('bg'); paint(rectPts(-200, -200, W + 400, H + 400), { wash: PAL.night, ink: null }); };
  const mech = mergeMesh(
    placeMesh(boxMesh(6, 7, 4, PAL.slate), xf({ pos: [0, 8, 0] })), placeMesh(boxMesh(3, 3, 3, PAL.steel), xf({ pos: [0, 13, 0] })),
    placeMesh(boxMesh(2, 6, 2.4, PAL.slate), xf({ pos: [-4.6, 8, 0] })), placeMesh(boxMesh(2, 6, 2.4, PAL.slate), xf({ pos: [4.6, 8, 0] })),
    placeMesh(boxMesh(2.4, 5, 3, PAL.steel), xf({ pos: [-1.8, 2.5, 0] })), placeMesh(boxMesh(2.4, 5, 3, PAL.steel), xf({ pos: [1.8, 2.5, 0] })),
  );
  const cam = t => cam3({ pos: [Math.sin(t * .5) * 34, 12, Math.cos(t * .5) * 34], look: [0, 7, 0], fov: 38 });
  const shots = [
    ['wash only', () => bg()],
    ['+1 watercolor fill', t => { bg(); paint(ellPts(960, 300, 1300, 500, 30, 12), { fill: PAL.indigo, fillOp: 120, bleed: .3, tex: .6, ink: null }); }],
    ['+4 watercolor fills', t => { bg(); for (let i = 0; i < 4; i++) paint(ellPts(400 + i * 350, 400, 300, 200, 30, 12), { fill: PAL.indigo, fillOp: 120, bleed: .3, tex: .6, ink: null }); }],
    ['+40 ink lines', t => { bg(); boilSeed('l'); for (let i = 0; i < 40; i++) inkLine([[100 + i * 40, 100], [200 + i * 40, 900]], 1.2, PAL.cream, 'ink', 0); }],
    ['+200 ink lines', t => { bg(); boilSeed('l'); for (let i = 0; i < 200; i++) inkLine([[100 + i * 8, 100], [200 + i * 8, 900]], 1.2, PAL.cream, 'ink', 0); }],
    ['+40 wash polygons + ink', t => { bg(); boilSeed('p'); for (let i = 0; i < 40; i++) paint(polyPts(200 + (i % 10) * 160, 250 + Math.floor(i / 10) * 200, 60, 6), { wash: PAL.slate, ink: PAL.ink, sw: 1 }); }],
    ['mech (edges all)', t => { bg(); cel3dPaint(cam(t), [{ mesh: mech, key: 'mech', ink: PAL.ink, sw: 1.1 }], { edges: 'all' }); }],
    ['mech (silhouette)', t => { bg(); cel3dPaint(cam(t), [{ mesh: mech, key: 'mech', ink: PAL.ink, sw: 1.1 }], { edges: 'silhouette' }); }],
    ['+glow x3', t => { bg(); glow(600, 400, 300, PAL.amber, .6); glow(1200, 500, 200, PAL.cyan, .6); glow(900, 800, 250, PAL.rose, .6); }],
    ['+speed lines 48', t => { bg(); speedLines(960, 540, 1, 48); }],
    ['+hatch fill', t => { bg(); paint(rectPts(300, 200, 1300, 600), { wash: PAL.steel, hatch: { d: 30, a: .5, b: 'charcoal', c: PAL.ink, w: .8 }, ink: null }); }],
    ['+letters', t => { bg(); letter('BENCHMARK', 960, 540, 160, PAL.cream, { tracking: 8 }); }],
    ['brush wipe', t => { bg(); brushWipe(.3); }],
    ['grid floor', t => { bg(); gridFloor(cam(t), 0, 4, 40, PAL.steel, .6); }],
  ];
  movie('_bench', { duration: shots.length, bpm: 120, scale: 2 / 3 }, shots.map((s, i) => [i, (t, lt) => { s[1](t); }]));
  window.BENCH_NAMES = shots.map(s => s[0]);
})();
