// props.js: cel-3D props for the site's videos (DESIGN.md §5): the K-01 mech, gantry + cradle, work lamp, launch tunnel and
// blast doors, Unit-7, the island, the sealed chamber door. Everything is built from the mesh primitives in cel3d.js (convex
// parts only, so the painter's per-part face sort is exact) in a rest pose, and posed per frame by composing joint transforms.
//
// Conventions: world x right (when looking along -z), y up, K-01 stands with its feet centred on the origin FACING +z. Its
// LEFT side is +x, its RIGHT side is -x, so a camera behind it (negative z, looking +z) sees the mech's right on screen right.
// The mech is 18 units tall (a foot is person-height; the pilot is 1.75 u).
//
//   k01(pose, opts) -> { parts, anchor(name) -> world point, faces }        parts feed straight into cel3dPaint(cam, parts, ...)
//   K01_POSES.rest | crouch | launch | flight | landing | parked ; k01Blend(a, b, k) ; k01Pose(name, over)
//   gantry(o), workLamp(), tunnelRing(), blastDoors(open), unit7(o), island(), sealedDoor(), tileWaveColor(i, j, front)
//
// Pose (all angles radians; every field optional, defaults = standing at rest):
//   pos [x,y,z] root translation, rot [rx,ry,rz] root rotation about `pivot` (default [0,9,0]; rx>0 pitches the head forward)
//   leg | legL | legR: { hip (thigh forward +), knee (bend +, shin goes backward), ankle (extra toe-up +), abd (out +) }
//   torso [lean fwd +, twist left +, tilt], head [nod down +, turn left +, tilt], arm | armL | armR: { flex (forward +), abd (out +), elbow (bend +) }
//   thrust 0..1 (nozzle glow), grounded true = pos.y is set so the feet stay on y = 0 (crouches)
// opts: { tone(name, col) -> col   (per-part recolour: light arriving, silhouettes), ink, sw, key, visor (colour), visorGlow }

Object.assign(PAL, { hull: '#4E7DD1', hullShadow: '#2C3E77', shadowTint: '#3A2E6B', skin: '#F1C9A5' });
CEL.shadeTint = PAL.shadowTint;

// ---------- mesh helpers ----------
// A box that widens or narrows from base (y = 0, w0 x d0) to top (y = h, w1 x d1); ox/oz shift the top.
function taper(w0, d0, w1, d1, h, col = PAL.slate, o = {}) {
  const b = [w0 / 2, d0 / 2], t = [w1 / 2, d1 / 2], ox = o.ox || 0, oz = o.oz || 0;
  const V = [[-b[0], 0, b[1]], [b[0], 0, b[1]], [t[0] + ox, h, t[1] + oz], [-t[0] + ox, h, t[1] + oz],
             [-b[0], 0, -b[1]], [b[0], 0, -b[1]], [t[0] + ox, h, -t[1] + oz], [-t[0] + ox, h, -t[1] + oz]];
  const F = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]];
  return makeMesh(V, F.map(i => ({ i, ...o.face })), col);
}
const mirrorX = m => ({ verts: m.verts.map(([x, y, z]) => [-x, y, z]), faces: m.faces.map(f => ({ ...f, i: f.i.slice().reverse() })) });
const moveMesh = (m, x, y, z) => placeMesh(m, xf({ pos: [x, y, z] }));
// A prism whose 2D profile lives in the side view: points are [z forward, y up], extruded along x (width w, centred on x = 0).
const sidePrism = (profile, w, col, o) => { convexOrWarn(profile, 'sidePrism'); return placeMesh(prismMesh(profile, w, col, o), xf({ rot: [0, -Math.PI / 2, 0] })); };
// A prism with the profile in the front view: [x, y], extruded along z (depth d, centred on z = 0).
const frontPrism = (profile, d, col, o) => { convexOrWarn(profile, 'frontPrism'); return prismMesh(profile, d, col, o); };
function convexOrWarn(p, name) {
  let sign = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], c = p[(i + 2) % p.length], cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cr) < 1e-9) continue;
    if (!sign) sign = Math.sign(cr); else if (Math.sign(cr) !== sign) { console.warn(`[props] ${name}: profile is not convex at vertex ${(i + 1) % p.length}`); return; }
  }
  if (sign < 0) console.warn(`[props] ${name}: profile is clockwise (faces will point inward)`);
}
const recolor = (m, fn) => ({ verts: m.verts, faces: m.faces.map(f => f.glow ? f : { ...f, col: fn(f.col) }) });
const countFaces = parts => parts.reduce((s, p) => s + p.mesh.faces.length, 0);
// Joint: rotate about a pivot given in rest coordinates.
const about = (pv, rot) => { const r = xf({ rot }); return p => { const q = r([p[0] - pv[0], p[1] - pv[1], p[2] - pv[2]]); return [q[0] + pv[0], q[1] + pv[1], q[2] + pv[2]]; }; };
const IDENT = p => p;

// ---------- K-01 ----------
const K01 = (() => {
  const C = { hull: PAL.hull, sh: PAL.hullShadow, steel: PAL.steel, slate: PAL.slate, trim: PAL.cream, visor: PAL.cyan, gold: PAL.gold, dark: '#1B2340' };
  const LEG_X = 1.9, ARM_X = 4.3;
  const HIP = [0, 10.4, 0], WAIST = [0, 11.6, 0], NECK = [0, 15.4, 0.2];
  const P = [];          // { name, mesh, chain: [joint names, outermost first] }
  const add = (name, mesh, chain) => P.push({ name, mesh, chain });

  for (const [s, side] of [[1, 'L'], [-1, 'R']]) {
    const x = s * LEG_X;
    add('foot' + side, moveMesh(sidePrism([[-1.5, 0], [2.7, 0], [3.0, .55], [2.3, 1.2], [-.3, 1.5], [-1.5, 1.1]], 2.5, C.steel), x, 0, 0), ['root', 'pelvis', 'hip' + side, 'knee' + side, 'ankle' + side]);
    add('shin' + side, moveMesh(sidePrism([[-1.1, 1.4], [1.0, 1.4], [1.4, 3.2], [1.7, 6.0], [1.4, 6.8], [-1.0, 6.8], [-1.5, 4.6]], 2.2, C.hull), x, 0, 0), ['root', 'pelvis', 'hip' + side, 'knee' + side]);
    add('kneeGuard' + side, moveMesh(taper(1.9, 1.0, 1.5, .6, 1.3, mixCol(C.hull, C.trim, .35)), x, 5.9, 1.9), ['root', 'pelvis', 'hip' + side, 'knee' + side]);
    add('thigh' + side, moveMesh(sidePrism([[-1.4, 6.6], [1.3, 6.6], [1.6, 8.4], [1.3, 10.6], [-1.3, 10.6], [-1.6, 8.4]], 2.7, C.sh), x, 0, 0), ['root', 'pelvis', 'hip' + side]);
    // arm: upper arm, forearm (flared gauntlet), hand
    const ax = s * ARM_X;
    add('upperArm' + side, moveMesh(taper(1.7, 2.0, 2.1, 2.2, 3.6, C.sh), ax, 10.7, 0), ['root', 'pelvis', 'torso', 'shoulder' + side]);
    add('forearm' + side, moveMesh(taper(2.1, 2.2, 1.7, 1.9, 3.6, C.hull), ax, 7.2, 0), ['root', 'pelvis', 'torso', 'shoulder' + side, 'elbow' + side]);
    add('hand' + side, moveMesh(taper(1.3, 1.6, 1.5, 1.7, 1.5, C.steel), ax, 5.8, .1), ['root', 'pelvis', 'torso', 'shoulder' + side, 'elbow' + side]);
    // thruster pods on the backpack
    add('thruster' + side, placeMesh(cylMesh(1.0, 4.2, 8, C.steel), xf({ pos: [x, 12.6, -3.9], rot: [.5, 0, 0] })), ['root', 'pelvis', 'torso']);
    add('nozzle' + side, placeMesh(cylMesh(.82, .18, 8, C.gold, { face: { glow: 1 } }), xf({ pos: [x, 10.75, -4.85], rot: [.5, 0, 0] })), ['root', 'pelvis', 'torso']);
  }
  const pauldron = frontPrism([[3.0, 13.4], [5.7, 13.4], [6.1, 14.6], [5.5, 15.7], [3.3, 15.9], [2.9, 14.7]], 3.6, C.hull);
  add('pauldronL', pauldron, ['root', 'pelvis', 'torso']);
  add('pauldronR', mirrorX(pauldron), ['root', 'pelvis', 'torso']);
  add('pelvis', frontPrism([[-2.7, 9.9], [2.7, 9.9], [3.0, 10.7], [2.5, 11.7], [-2.5, 11.7], [-3.0, 10.7]], 3.6, C.steel), ['root', 'pelvis']);
  add('groin', moveMesh(taper(2.6, .7, 2.0, .5, 1.5, C.sh), 0, 9.2, 1.9), ['root', 'pelvis']);
  add('torso', frontPrism([[-2.1, 11.7], [2.1, 11.7], [3.4, 13.3], [3.7, 14.7], [2.9, 15.5], [-2.9, 15.5], [-3.7, 14.7], [-3.4, 13.3]], 3.8, C.slate), ['root', 'pelvis', 'torso']);
  add('chestPlate', moveMesh(taper(5.2, .9, 4.6, .7, 2.9, C.hull), 0, 12.4, 2.1), ['root', 'pelvis', 'torso']);
  add('chestFin', moveMesh(sidePrism([[2.4, 13.4], [3.2, 13.9], [3.2, 15.3], [2.4, 14.9]], .35, C.trim), 0, 0, 0), ['root', 'pelvis', 'torso']);
  add('backpack', moveMesh(taper(4.6, 1.9, 4.2, 1.7, 3.8, C.sh), 0, 11.5, -2.85), ['root', 'pelvis', 'torso']);
  add('neck', moveMesh(cylMesh(.8, .7, 6, C.steel), 0, 15.5, 0), ['root', 'pelvis', 'torso']);
  add('head', frontPrism([[-1.1, 15.5], [1.1, 15.5], [1.4, 16.1], [1.3, 17.2], [.6, 17.9], [-.6, 17.9], [-1.3, 17.2], [-1.4, 16.1]], 2.6, C.hull), ['root', 'pelvis', 'torso', 'head']);
  add('visor', moveMesh(boxMesh(2.3, .8, .3, C.visor, { face: { glow: 1 } }), 0, 16.55, 1.36), ['root', 'pelvis', 'torso', 'head']);
  add('earL', placeMesh(cylMesh(.55, .5, 8, C.steel), xf({ pos: [1.6, 16.3, 0], rot: [0, 0, Math.PI / 2] })), ['root', 'pelvis', 'torso', 'head']);
  add('earR', placeMesh(cylMesh(.55, .5, 8, C.steel), xf({ pos: [-1.6, 16.3, 0], rot: [0, 0, Math.PI / 2] })), ['root', 'pelvis', 'torso', 'head']);

  // anchors: [chain, local rest point]
  const A = {
    visor: [['root', 'pelvis', 'torso', 'head'], [0, 16.55, 1.55]], head: [['root', 'pelvis', 'torso', 'head'], [0, 16.7, 0]],
    chest: [['root', 'pelvis', 'torso'], [0, 13.7, 2.5]], pauldronL: [['root', 'pelvis', 'torso'], [6.05, 14.5, 0]], pauldronR: [['root', 'pelvis', 'torso'], [-6.05, 14.5, 0]],
    nozzleL: [['root', 'pelvis', 'torso'], [LEG_X, 10.6, -5.0]], nozzleR: [['root', 'pelvis', 'torso'], [-LEG_X, 10.6, -5.0]],
    handL: [['root', 'pelvis', 'torso', 'shoulderL', 'elbowL'], [ARM_X, 5.9, 0]], handR: [['root', 'pelvis', 'torso', 'shoulderR', 'elbowR'], [-ARM_X, 5.9, 0]],
    footL: [['root', 'pelvis', 'hipL', 'kneeL', 'ankleL'], [LEG_X, .5, .8]], footR: [['root', 'pelvis', 'hipR', 'kneeR', 'ankleR'], [-LEG_X, .5, .8]],
    core: [['root', 'pelvis', 'torso'], [0, 13.4, 0]],
  };

  const leg = (pose, side) => ({ hip: 0, knee: 0, ankle: 0, abd: 0, ...(pose.leg || {}), ...(pose['leg' + side] || {}) });
  const arm = (pose, side) => ({ flex: 0, abd: .08, elbow: 0, ...(pose.arm || {}), ...(pose['arm' + side] || {}) });

  function build(pose = {}, opts = {}) {
    const rootPivot = pose.pivot || [0, 9, 0], rr = pose.rot || [0, 0, 0], pp = pose.pos || [0, 0, 0];
    const lg = { L: leg(pose, 'L'), R: leg(pose, 'R') }, ar = { L: arm(pose, 'L'), R: arm(pose, 'R') };
    let py = pp[1];
    if (pose.grounded) { // keep the lower foot on the floor: hip height from the two-bone leg
      const h = side => { const l = lg[side]; return 3.8 * Math.cos(l.hip) + 5.3 * Math.cos(l.knee - l.hip); };
      py += Math.min(h('L'), h('R')) - 9.1;
    }
    const J = { root: compose(xf({ pos: [pp[0], py, pp[2]] }), about(rootPivot, rr)), pelvis: about(HIP, pose.pelvis || [0, 0, 0]) };
    const t = pose.torso || [0, 0, 0], hd = pose.head || [0, 0, 0];
    J.torso = about(WAIST, [t[0], t[1], t[2]]);
    J.head = about(NECK, [hd[0], hd[1], hd[2]]);
    for (const [side, s] of [['L', 1], ['R', -1]]) {
      const l = lg[side], a = ar[side];
      J['hip' + side] = about([s * LEG_X, 10.4, 0], [-l.hip, 0, s * l.abd]);
      J['knee' + side] = about([s * LEG_X, 6.7, 0], [l.knee, 0, 0]);
      J['ankle' + side] = about([s * LEG_X, 1.4, -.2], [l.hip - l.knee + l.ankle, 0, 0]);   // keeps the sole level unless `ankle` says otherwise
      J['shoulder' + side] = about([s * ARM_X, 14.2, 0], [-a.flex, 0, s * a.abd]);
      J['elbow' + side] = about([s * ARM_X, 10.9, 0], [-a.elbow, 0, 0]);
    }
    const chainAt = names => compose(...names.map(n => J[n] || IDENT));
    const thrust = pose.thrust || 0;
    const tone = opts.tone || ((n, c) => c);
    const parts = P.map(p => {
      let mesh = p.mesh;
      if (p.name === 'visor' && opts.visor !== undefined) mesh = { verts: mesh.verts, faces: mesh.faces.map(f => ({ ...f, col: opts.visor, glow: opts.visorGlow ? 1 : 0 })) };
      else if (p.name.startsWith('nozzle')) mesh = { verts: mesh.verts, faces: mesh.faces.map(f => ({ ...f, col: mixCol(C.dark, C.gold, thrust), glow: thrust > .05 ? 1 : 0 })) };
      else mesh = recolor(mesh, c => tone(p.name, c));
      const curved = /^(thruster|nozzle|neck|ear)/.test(p.name);
      return { mesh, at: chainAt(p.chain), key: (opts.key || 'mech') + '.' + p.name, ink: opts.ink === undefined ? PAL.ink : opts.ink, sw: opts.sw ?? 1.1, crease: curved ? -2 : .72 };
    });
    return { parts, faces: countFaces(parts), anchor: name => { const [chain, pt] = A[name]; return chainAt(chain)(pt); } };
  }
  return { build, anchors: Object.keys(A) };
})();
const k01 = (pose, opts) => K01.build(pose, opts);

const K01_POSES = {
  rest: {},
  crouch: { grounded: true, leg: { hip: .62, knee: 1.15 }, torso: [.2, 0, 0], head: [-.1, 0, 0], arm: { flex: .25, elbow: .5, abd: .12 } },
  launch: { pos: [0, 0, 0], leg: { hip: -.1, knee: .05 }, torso: [-.08, 0, 0], arm: { flex: -.55, abd: .3, elbow: .1 }, thrust: 1 },
  flight: { rot: [1.3, 0, 0], leg: { hip: -.05, knee: .1 }, torso: [-.15, 0, 0], head: [-.85, 0, 0], arm: { flex: -.05, abd: .16, elbow: .05 }, thrust: 1 },
  landing: { grounded: true, leg: { hip: .5, knee: .85 }, torso: [.12, 0, 0], arm: { flex: .35, abd: .32, elbow: .3 }, thrust: .5 },
  parked: { leg: { hip: 0, knee: 0 }, arm: { flex: 0, abd: .07, elbow: .05 }, head: [.05, .25, 0] },
};
function k01Blend(a, b, k) {
  const mix = (x, y) => {
    if (typeof x === 'number' || typeof y === 'number') return lerp(x ?? 0, y ?? 0, k);
    if (Array.isArray(x) || Array.isArray(y)) { const n = Math.max((x || y).length, (y || x).length); return Array.from({ length: n }, (_, i) => lerp((x || [])[i] ?? 0, (y || [])[i] ?? 0, k)); }
    if (x && typeof x === 'object' || y && typeof y === 'object') { const o = {}; for (const key of new Set([...Object.keys(x || {}), ...Object.keys(y || {})])) o[key] = mix((x || {})[key], (y || {})[key]); return o; }
    return y ?? x;
  };
  const out = mix(a, b); out.grounded = k < .5 ? a.grounded : b.grounded; out.pivot = k < .5 ? a.pivot : b.pivot; return out;
}
const k01Pose = (name, over = {}) => ({ ...K01_POSES[name], ...over });

// ---------- gantry + cradle ----------
// Four pillars at x = +-6, z = +-4 (20 u), two overhead beams, two cradle arms at y = 8 (rot = arm swing about the pillar, radians).
function gantry(o = {}) {
  const col = o.col || PAL.steel, dark = mixCol(PAL.steel, PAL.night, .35), parts = [];
  const add = (name, mesh, at) => parts.push({ mesh, at, key: 'gantry.' + name, ink: PAL.ink, sw: .9 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(`pillar${sx}${sz}`, mergeMesh(boxMesh(1.4, 21, 1.4, col, { base: true }), moveMesh(taper(2.6, 2.6, 1.6, 1.6, .8, dark), 0, 0, 0)), xf({ pos: [sx * 6, 0, sz * 4] }));
  }
  for (const sx of [-1, 1]) add('beam' + sx, boxMesh(.9, .9, 9.4, dark), xf({ pos: [sx * 6, 20.2, 0] }));
  add('crossbeam', boxMesh(12.9, .8, .8, dark), xf({ pos: [0, 20.6, 4] }));
  const swing = o.swing || [0, 0];
  [[1, 0], [-1, 1]].forEach(([s, i]) => {
    const pv = [s * 6, 8, 0], arm = mergeMesh(boxMesh(3.6, .9, 1.7, col), moveMesh(taper(1.2, 2.2, 1.6, 2.6, .9, PAL.slate), s * 1.6, -.45, 0));
    add('cradle' + s, placeMesh(arm, xf({ pos: [s * 4.4, 8, 0] })), compose(about(pv, [0, 0, swing[i] || 0])));
  });
  for (const sx of [-1, 1]) add('tray' + sx, boxMesh(1.2, .35, 26, dark, { base: true }), xf({ pos: [sx * 9, 0, -6] }));
  return parts;
}

// ---------- hangar walls: ribs at x = +-14.5 every 8 u from z0 to z1 and a lamp rail at y = 9 ----------
function hangarWalls(o = {}) {
  const col = o.col || mixCol(PAL.steel, PAL.night, .45), z0 = o.z0 ?? -36, z1 = o.z1 ?? 68, parts = [];
  for (const sx of [-1, 1]) {
    for (let z = z0; z <= z1; z += 8) parts.push({ mesh: boxMesh(.9, 24, 1.1, col, { base: true }), at: xf({ pos: [sx * 14.5, 0, z] }), key: `wall.${sx}.${z}`, ink: PAL.ink, sw: .8, jitter: .8 });
    parts.push({ mesh: boxMesh(.5, .6, z1 - z0, mixCol(col, PAL.slate, .3)), at: xf({ pos: [sx * 14.2, 9, (z0 + z1) / 2] }), key: 'wall.rail' + sx, ink: PAL.ink, sw: .8, jitter: .8 });
  }
  return parts;
}

// ---------- work lamp (3D version for the live site; the videos draw lamps as billboards) ----------
const workLamp = (col = PAL.steel) => mergeMesh(boxMesh(.7, .6, .6, col, { base: true }), moveMesh(coneMesh(.5, .9, 8, PAL.amber, { face: { glow: 1 } }), 0, .95, 0));

// ---------- launch tunnel + blast doors ----------
// An octagonal tube seen from the inside (faces point at the axis) between z0 and z1, plus its rim facing -z.
function tubeMesh(r, z0, z1, n = 8, col = PAL.steel) {
  const V = [], F = [];
  for (let k = 0; k < n; k++) { const a = k / n * TAU; V.push([Math.cos(a) * r, Math.sin(a) * r, z0], [Math.cos(a) * r, Math.sin(a) * r, z1]); }
  for (let k = 0; k < n; k++) {
    const k2 = (k + 1) % n, a = 2 * k, b = 2 * k + 1, c = 2 * k2 + 1, d = 2 * k2;
    const q = [V[a], V[b], V[c]], nrm = vcross(vsub(q[1], q[0]), vsub(q[2], q[0])), mid = vmul(vadd(V[a], V[c]), .5);
    F.push({ i: vdot(nrm, [-mid[0], -mid[1], 0]) > 0 ? [a, b, c, d] : [d, c, b, a] });
  }
  return makeMesh(V, F, col);
}
function tunnelRing(o = {}) {
  const r = o.r || 15, len = o.len || 8, col = o.col || PAL.steel;
  return [{ mesh: tubeMesh(r, 0, len, 8, col), at: xf({ pos: [0, o.y ?? 12, o.z ?? 0] }), key: 'tunnel.' + (o.z ?? 0), ink: PAL.ink, sw: .9, jitter: .8 }];
}
// Two door slabs at z (default 70): open 0..1 slides them apart (each 14 u wide, 26 u tall).
function blastDoors(open = 0, o = {}) {
  const z = o.z ?? 70, slab = frontPrism([[0, 0], [15, 0], [15, 24], [13, 26], [0, 26]], 2.4, o.col || PAL.steel), gap = 14 * open;
  return [
    { mesh: slab, at: xf({ pos: [-15 - gap + .5, 0, z] }), key: 'door.L', ink: PAL.ink, sw: 1, thresholds: [.3, .6] },
    { mesh: mirrorX(slab), at: xf({ pos: [15 + gap - .5, 0, z] }), key: 'door.R', ink: PAL.ink, sw: 1, thresholds: [.3, .6] },
  ];
}

// ---------- Unit-7: deck-crew robot, 1.7 u, ~60 faces ----------
function unit7(o = {}) {
  const hull = PAL.slate, sh = PAL.steel, p = o.pos || [0, 0, 0], tilt = o.tilt || 0, at = xf({ pos: p, rot: [0, o.yaw || 0, 0] });
  const headAt = compose(at, about([0, 1.3, 0], [0, 0, tilt]));
  const parts = [
    { mesh: boxMesh(1.7, .4, 1.5, sh, { base: true }), key: 'u7.tread', at },
    { mesh: boxMesh(1.1, .9, .9, hull, { base: true }), at: compose(at, xf({ pos: [0, .4, 0] })), key: 'u7.torso' },
    { mesh: cylMesh(.5, .45, 18, hull), at: compose(headAt, xf({ pos: [0, 1.52, 0] })), key: 'u7.head' },
    { mesh: coneMesh(.09, .3, 8, PAL.amber, { capBottom: false }), at: compose(headAt, xf({ pos: [0, 1.9, 0] })), key: 'u7.ant', ink: PAL.ink },
    { mesh: boxMesh(.36, .07, .04, PAL.amber, { face: { glow: 1 } }), at: compose(headAt, xf({ pos: [-.18, 1.55, .5] })), key: 'u7.eyeL', ink: null },
    { mesh: boxMesh(.36, .07, .04, PAL.amber, { face: { glow: 1 } }), at: compose(headAt, xf({ pos: [.18, 1.55, .5] })), key: 'u7.eyeR', ink: null },
  ];
  for (const s of [-1, 1]) parts.push({ mesh: cylMesh(.12, .8, 8, sh), at: compose(at, about([s * .7, 1.2, 0], [o.armFlex || 0, 0, s * (o.armAbd ?? .25)]), xf({ pos: [s * .7, .8, 0] })), key: 'u7.arm' + s });
  return parts;
}

// ---------- island (78-ish faces): floating body, plaza slab, library, three trees ----------
function island(o = {}) {
  const S = o.scale || 1, at = xf({ pos: o.pos || [0, 0, 0], scale: S, rot: [0, o.yaw || 0, 0] });
  const body = latheMesh([[0, -7], [3.0, -3.6], [5.4, -1.1], [6.2, 0]], 8, PAL.steel);
  body.faces.forEach((f, i) => { f.col = f.i.length === 8 ? PAL.sap : (i % 3 === 0 ? mixCol(PAL.teal, PAL.steel, .5) : i % 3 === 1 ? PAL.steel : PAL.slate); });
  const lib = mergeMesh(boxMesh(2.5, 1.7, 2.0, PAL.bone, { base: true }), moveMesh(prismMesh([[-1.4, 0], [1.4, 0], [0, 1.0]], 2.2, PAL.rose), 0, 1.7, 0));
  const parts = [
    { mesh: body, key: 'isl.body', ink: PAL.ink, sw: 1.1 },
    { mesh: cylMesh(2.7, .25, 8, PAL.bone), at: xf({ pos: [.6, .12, .8] }), key: 'isl.plaza', ink: PAL.ink },
    { mesh: lib, at: xf({ pos: [-2.6, 0, -1.6] }), key: 'isl.lib', ink: PAL.ink },
  ];
  [[3.2, -1.2, 1.2], [-3.6, 1.6, 1.0], [2.0, -3.2, .9]].forEach(([x, z, s], i) => parts.push({ mesh: coneMesh(.75 * s, 2.1 * s, 4, PAL.sap), at: xf({ pos: [x, 1.05 * s, z] }), key: 'isl.tree' + i, ink: PAL.ink }));
  return parts.map(p => ({ ...p, at: p.at ? compose(at, p.at) : at }));
}

// ---------- sealed chamber door (12 faces) ----------
function sealedDoor(o = {}) {
  const at = xf({ pos: o.pos || [0, 0, 0], rot: [0, o.yaw || 0, 0] });
  const slab = frontPrism([[-1.5, 0], [1.5, 0], [1.5, 2.6], [.8, 3.6], [-.8, 3.6], [-1.5, 2.6]], .6, PAL.steel);
  return [{ mesh: slab, at, key: 'door.slab', ink: PAL.ink, sw: 1.1 }, { mesh: boxMesh(4.0, .5, 1.0, PAL.slate, { base: true }), at: compose(at, xf({ pos: [0, 3.5, 0] })), key: 'door.lintel', ink: PAL.ink }];
}

// ---------- tile wave (the motif) ----------
// Tile (i, j) colour for a wavefront at `front` (in tile-index units): steel ahead of the wave, gold at the front, amber cooling
// behind it, steel again after `cool` tiles. Same rule everywhere (DESIGN §1).
function tileWaveColor(i, j, front, o = {}) {
  const d = front - (i + j), cool = o.cool ?? 6;
  if (d < 0) return PAL.steel;
  const lit = smoothstep01(d / 2);
  const c = mixCol(PAL.steel, PAL.gold, lit);
  return d > 2 ? mixCol(c, PAL.amber, clamp((d - 2) / 2, 0, .5) + (o.warm ?? 0) * clamp((d - 2) / cool, 0, 1)) : c;
}
const smoothstep01 = x => { x = clamp(x); return x * x * (3 - 2 * x); };
