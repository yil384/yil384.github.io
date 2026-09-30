// The stage: everything on the island that stands for a part of the page, plus the sky.
// It owns
//   - landmarks (built from landmarks.js, placed via layout.js) and their highlight state,
//   - anchors (named points) and shots (authored camera poses + where the scholar stands),
//   - pickables (things the reader can point at; each may link to a data-focus element on the page).
// The director (director.js) reads shots/pickables and drives the camera; index.js calls update().
import * as THREE from 'three/webgpu';
import { voxelize } from '../three/voxel.js';
import { ART } from '../three/art.js';
import { makeActor, spriteBatch } from './actors.js';
import { LAYOUT, snakePoints } from './layout.js';
import { buildSky } from './sky.js';
import { voxBuild, bakeInstanced } from './props.js';
import * as L from './landmarks.js';
import { reducedMotion } from '../three/boot.js';

const TAU = Math.PI * 2;

export function buildStage(world, scene, { lowfx = false, parent = scene } = {}) {
  const group = new THREE.Group();
  parent.add(group);
  const sky = buildSky(scene, { lowfx });

  // Keep every authored point on the island: step toward the centre until the ground is walkable.
  const nudge = (o) => {
    for (let i = 0; i < 40 && !(world.height(o.x, o.z) > -Infinity); i++) { o.x -= Math.sign(o.x) * 0.5; o.z -= Math.sign(o.z) * 0.5; }
    return o;
  };
  for (const k of Object.keys(LAYOUT.monuments)) nudge(LAYOUT.monuments[k]);
  [LAYOUT.sungod, LAYOUT.mailbox, ...LAYOUT.seals, LAYOUT.camp.tent, LAYOUT.camp.fire, LAYOUT.camp.bench, ...LAYOUT.flags].forEach(nudge);

  const anchors = {};
  const items = {};          // id -> { obj, hi, tgt, hover }
  const pickables = [];
  const updaters = [];
  const surface = (x, z) => world.surfaceY(x, z);
  const anchor = (id, x, z, dy = 0) => (anchors[id] = { x, z, y: surface(x, z) + dy });

  function put(obj, x, z, { yaw = 0, dy = 0 } = {}) {
    obj.group.position.set(x, surface(x, z) + 0.5 + dy, z);
    obj.group.rotation.y = yaw;
    group.add(obj.group);
    if (obj.update) updaters.push(obj.update);
    return obj;
  }
  function blockRect(cx, cz, hx, hz) {
    for (let x = Math.round(cx - hx); x <= Math.round(cx + hx); x++) for (let z = Math.round(cz - hz); z <= Math.round(cz + hz); z++) world.block(x, z);
  }
  /** Register a landmark: it can be highlighted (by focus or hover) and, optionally, picked. */
  function register(id, obj, { label = '', pick = true, egg = null, meshes = obj.meshes || [], link = id } = {}) {
    items[id] = { id, obj, meshes, hi: 0, tgt: 0, hover: 0, focus: 0 };
    if (pick) {
      obj.group.userData.pickId = id;
      pickables.push({ id, root: obj.group, label, link, egg });
    }
    return items[id];
  }

  // ---------------------------------------------------------------- UC San Diego
  const T = LAYOUT.tower;
  const tower = L.buildTower();
  put(tower, T.x, T.z);
  anchor('tower', T.x, T.z);
  anchors.towerTop = { x: T.x, z: T.z, y: surface(T.x, T.z) + tower.topY + 2 };
  register('tower', tower, { label: 'Geisel Library', egg: 'geisel', link: 'library' });

  // the striped hat that appears on the tower (Geisel is named for Dr. Seuss)
  const hat = makeActor('hat', { scale: 0.7, maxHalf: 3 });
  hat.position.set(T.x, anchors.towerTop.y + 3.2, T.z);
  hat.scale.setScalar(0);
  hat.visible = false;
  group.add(hat);

  // CSE building with the fallen house on its roof
  const C = LAYOUT.cse;
  const cse = L.buildCSE();
  put(cse, C.x, C.z, { yaw: C.yaw });
  blockRect(C.x, C.z, 7, 3.5);
  anchor('cse', C.x, C.z);
  register('cse', cse, { label: 'UC San Diego · CSE', link: 'cse' });
  const star = L.buildFallenStar();
  star.group.position.set(cse.hw - 2.4, cse.roofY + 1.6, -0.8);
  star.group.rotation.set(0.1, 0.25, -0.5);
  cse.group.add(star.group);
  updaters.push(star.update);
  star.group.userData.pickId = 'fallen';
  pickables.push({ id: 'fallen', root: star.group, label: 'Fallen Star', egg: 'fallen' });

  // Tsinghua's gate
  const G = LAYOUT.gate;
  const gate = L.buildGate();
  put(gate, G.x, G.z, { yaw: G.yaw });
  anchor('gate', G.x, G.z);
  {
    const c = Math.cos(G.yaw), s = Math.sin(G.yaw);
    for (const [u, v] of gate.pillars) world.block(G.x + u * c + v * s, G.z - u * s + v * c);
  }
  register('gate', gate, { label: 'Tsinghua · 二校门', link: 'gate', egg: 'gate' });

  // King Triton (the Tritons' mascot) stands for TritonGym
  const M = LAYOUT.monuments;
  const plinthTriton = L.buildPlinth({ hw: 3, hd: 2, h: 3, top: '#9db4d6' });
  put(plinthTriton, M.triton.x, M.triton.z, { yaw: M.triton.yaw });
  const triton = makeActor('triton', { scale: 0.62, maxHalf: 2 });
  triton.position.set(M.triton.x, surface(M.triton.x, M.triton.z) + 3.5, M.triton.z);
  triton.rotation.y = M.triton.yaw;
  group.add(triton);
  blockRect(M.triton.x, M.triton.z, 2, 2);
  anchor('mon-triton', M.triton.x, M.triton.z, 3);
  items['mon-triton'] = { id: 'mon-triton', obj: { group: triton }, meshes: plinthTriton.meshes, hi: 0, tgt: 0, hover: 0, focus: 0, sprite: triton, spriteScale: 0.62 };
  triton.userData.pickId = 'mon-triton';
  pickables.push({ id: 'mon-triton', root: triton, label: 'TritonGym · Go Tritons!', link: 'mon-triton', egg: 'triton' });

  // The Sun God on its lawn
  const SG = LAYOUT.sungod;
  const plinthSun = L.buildPlinth({ hw: 2, hd: 2, h: 2, top: '#b5bdca' });
  put(plinthSun, SG.x, SG.z, { yaw: SG.yaw });
  const sungod = makeActor('sungod', { scale: 0.55, maxHalf: 2 });
  sungod.position.set(SG.x, surface(SG.x, SG.z) + 2.5, SG.z);
  sungod.rotation.y = SG.yaw;
  group.add(sungod);
  blockRect(SG.x, SG.z, 1.5, 1.5);
  anchor('sungod', SG.x, SG.z, 3);
  sungod.userData.pickId = 'sungod';
  pickables.push({ id: 'sungod', root: sungod, label: 'The Sun God', egg: 'sungod' });

  // ---------------------------------------------------------------- experience trail
  for (const f of LAYOUT.flags) {
    const flag = L.buildFlag(f.colour);
    flag.group.scale.setScalar(0.66);
    put(flag, f.x, f.z, { yaw: 0.1 });
    world.block(f.x, f.z);
    anchor(f.id, f.x, f.z, 4);
    register(f.id, flag, { label: FLAG_LABELS[f.id] });
  }

  // ---------------------------------------------------------------- camp / projects
  const camp = LAYOUT.camp;
  const tent = L.buildTent('#c2571a');
  put(tent, camp.tent.x, camp.tent.z, { yaw: camp.tent.yaw });
  blockRect(camp.tent.x, camp.tent.z, 3, 4);
  const fire = L.buildCampfire();
  put(fire, camp.fire.x, camp.fire.z);
  world.block(camp.fire.x, camp.fire.z);
  const bench = L.buildWorkbench();
  put(bench, camp.bench.x, camp.bench.z, { yaw: camp.bench.yaw });
  blockRect(camp.bench.x, camp.bench.z, 2, 1);
  anchor('camp', camp.unit7.x, camp.unit7.z);
  anchor('workbench', camp.bench.x, camp.bench.z, 3);
  register('workbench', bench, { label: 'The workbench', pick: false });

  const starry = L.buildMonolith();
  put(starry, M.starry.x, M.starry.z, { yaw: M.starry.yaw });
  blockRect(M.starry.x, M.starry.z, 1.5, 1);
  anchor('mon-starry', M.starry.x, M.starry.z, 6);
  register('mon-starry', starry, { label: 'Starry-Next · a kernel with a network stack' });

  const chat = L.buildChat();
  put(chat, M.im.x, M.im.z, { yaw: M.im.yaw });
  blockRect(M.im.x, M.im.z, 5, 1);
  anchor('mon-im', M.im.x, M.im.z, 5);
  register('mon-im', chat, { label: 'IM System · chat over WebSocket' });

  const judge = L.buildJudge();
  put(judge, M.oj.x, M.oj.z, { yaw: M.oj.yaw });
  blockRect(M.oj.x, M.oj.z, 3, 2);
  anchor('mon-oj', M.oj.x, M.oj.z, 4);
  register('mon-oj', judge, { label: 'CST-OJ · click for a verdict', egg: 'judge' });

  // ---------------------------------------------------------------- meadow / contact
  const MB = LAYOUT.mailbox;
  const mailbox = L.buildMailbox();
  put(mailbox, MB.x, MB.z, { yaw: MB.yaw });
  world.block(MB.x, MB.z);
  anchor('mailbox', MB.x, MB.z, 5);
  register('mailbox', mailbox, { label: 'Write to me', egg: 'mailbox' });

  const P = LAYOUT.pier;
  const pier = L.buildPier(18);
  put(pier, P.x, P.z, { yaw: 0, dy: 0.5 });
  const deckY = surface(P.x, P.z) + 0.5;
  anchors.pier = { x: P.x + 14, z: P.z, y: deckY + 2 };
  anchors.pierEnd = { x: P.x + 22, z: P.z, y: deckY + 3 };
  register('pier', pier, { label: 'Scripps-style pier', pick: false });

  const rocks = L.buildRocks();
  const rockGroups = [];
  let snakeMesh = null;
  const seals = [];
  LAYOUT.seals.forEach((sl, i) => {
    const r = i === 0 ? rocks : L.buildRocks();
    put(r, sl.x, sl.z);
    rockGroups.push(r);
    const seal = makeActor('sealion', { scale: 0.22, maxHalf: 2 });
    seal.position.set(sl.x, surface(sl.x, sl.z) + 2.0, sl.z);
    seal.rotation.y = i ? -1.3 : 1.6;
    seal.userData.pickId = `sealion-${i}`;
    group.add(seal);
    pickables.push({ id: `sealion-${i}`, root: seal, label: 'A sea lion', egg: 'sealion' });
    seals.push(seal);
  });
  anchor('seals', LAYOUT.seals[0].x, LAYOUT.seals[0].z, 2);

  // Snake Path, laid into the ground south-west of the tower (the trail of flags follows it)
  {
    const pts = snakePoints;
    const cells = L.snakeCells(pts).map(([x, y, z, c, g]) => [x, surface(x, z) - 0.42 + y * 0.6, z, c, g]);
    const snake = voxBuild(cells, { shadow: false });
    snakeMesh = snake;
    const m = new THREE.Matrix4();
    for (let i = 0; i < cells.length; i++) { m.makeScale(1, 0.18, 1).setPosition(cells[i][0], cells[i][1], cells[i][2]); snake.setMatrixAt(i, m); }
    snake.instanceMatrix.needsUpdate = true;
    group.add(snake);
    const head = pts[pts.length - 1];
    anchors.snakeHead = { x: head[0], z: head[1], y: surface(head[0], head[1]) };
  }

  // ---------------------------------------------------------------- paragliders, tomes, orbiters
  const gliders = [];
  for (let i = 0; i < 3; i++) {
    const g = makeActor('paraglider', { scale: 0.42, maxHalf: 1 });
    g.userData.orbit = { r: 68 + i * 8, a: i * 2.1 + 0.4, y: 18 + i * 7, w: (0.028 + i * 0.006) * (i % 2 ? -1 : 1) };
    for (const f of g.userData.frames) f.castShadow = false;
    g.userData.pickId = `glider-${i}`;
    pickables.push({ id: `glider-${i}`, root: g, label: 'A paraglider', egg: 'glider' });
    group.add(g);
    gliders.push(g);
  }

  const tomes = [];
  const tomeDefs = [
    { id: 'book-triton', label: 'TritonGym (under review)', over: { C: '#0d9488', c: '#115e59' }, at: [-11, 18, 4.5] },
    { id: 'book-reh2o', label: '(Re)²H₂O · IEEE IV 2023', over: { C: '#7c3aed', c: '#5b21b6' }, at: [11.2, 22, 3.5] },
  ];
  for (const d of tomeDefs) {
    const g = voxelize(ART.book, { maxHalf: 2, bevel: 0, overrides: d.over, glow: { G: 1.8, P: 0.25, p: 0.15 } });
    g.scale.setScalar(0.62);
    g.position.set(T.x + d.at[0], surface(T.x, T.z) + d.at[1], T.z + d.at[2]);
    g.userData.base = g.position.clone();
    g.userData.pickId = d.id;
    group.add(g);
    anchors[d.id] = { x: g.position.x, y: g.position.y, z: g.position.z };
    tomes.push(g);
    items[d.id] = { id: d.id, obj: { group: g }, meshes: [g], hi: 0, tgt: 0, hover: 0, focus: 0, isTome: true };
    pickables.push({ id: d.id, root: g, label: d.label, link: d.id });
  }
  // books and crystals circling the tower: two batched meshes, moved through light proxies
  const orbit = new THREE.Group();
  const orbiters = [];
  for (let i = 0; i < 4; i++) { const o = new THREE.Object3D(); o.userData = { a: (i / 4) * TAU, r: 10.5 + (i % 2) * 2.5 }; orbiters.push(o); }
  for (let i = 0; i < 3; i++) { const o = new THREE.Object3D(); o.userData = { a: (i / 3) * TAU + 1, r: 14.5, crystal: true }; orbiters.push(o); }
  const bookBatch = spriteBatch('book', 4, { maxHalf: 1, scale: 0.16 });
  const crystalBatch = spriteBatch('crystal', 3, { maxHalf: 1, scale: 0.26, glow: { V: 2.5, v: 1.5, W: 4 } });
  orbit.add(bookBatch.mesh, crystalBatch.mesh);
  orbit.position.set(T.x, surface(T.x, T.z) + 4, T.z);
  group.add(orbit);

  // the moon is a clickable egg; it hangs low behind the island as seen from the opening shot
  sky.placeMoon(-0.45, 0.3);
  sky.moonHit.userData.pickId = 'moon';
  pickables.push({ id: 'moon', root: sky.moonHit, label: 'Make a wish', egg: 'moon' });

  // ---------------------------------------------------------------- static props -> one mesh
  // (props that never animate and never light up for the page: one draw call instead of seven)
  {
    group.updateMatrixWorld(true);
    const bakeList = [tent.meshes[0], fire.meshes[0], rocks.meshes[0], pier.meshes[0], plinthSun.meshes[0], snakeMesh];
    for (const r of rockGroups) if (r !== rocks) bakeList.push(r.meshes[0]);
    const baked = bakeInstanced(bakeList.filter(Boolean));
    baked.name = 'landmark-statics';
    for (const m of bakeList) m?.parent?.remove(m);
    group.add(baked);
  }

  // ---------------------------------------------------------------- focus beam
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.9, 26, 12, 1, true),
    new THREE.MeshBasicNodeMaterial({ color: '#ffe08a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
  );
  beam.visible = false;
  group.add(beam);

  // ---------------------------------------------------------------- shots
  const A = anchors;
  const sub = (a, dy = 0) => [A[a].x, A[a].y + dy, A[a].z];
  const shots = {
    // the whole island, a diorama in the night sea, Geisel at the heart
    hero:    { look: [3, A.tower.y + 1, 5], yaw: -0.45, pitch: 0.5, dist: 150, shiftX: 0.13, fov: 34, stand: [2.2, 5.6], face: 0.4 },
    about:   { look: [1.5, A.tower.y + 4.5, 5.5], yaw: -0.3, pitch: 0.34, dist: 40, shiftX: 0.2, fov: 34, stand: [1.5, 6.4], face: 0.2 },
    // one steady shot of both campuses: the scholar beams from the Second Gate to CSE, and the camera
    // looks at that arc side-on (from the south-south-west), framed in the half the card leaves free
    edu:     { look: [(G.x + C.x) / 2 - 2, A.tower.y + 6, (G.z + C.z) / 2 + 1], yaw: -0.585, pitch: 0.62, dist: 90, shiftX: 0.32, fov: 36, stand: [4.5, 5.5], face: 0.5 },
    cse:     { look: sub('cse', 8), yaw: 0.35, pitch: 0.22, dist: 38, shiftX: 0.2, fov: 34, stand: [C.x - 3, C.z + 6.5], face: 0.2 },
    gate:    { look: sub('gate', 4.5), yaw: 3.45, pitch: 0.3, dist: 34, shiftX: 0.2, fov: 34, stand: [G.x + 2.5, G.z - 4], face: 3.14 },
    library: { item: 'tower', look: [T.x, A.tower.y + 15, T.z], yaw: -0.55, pitch: 0.16, dist: 72, shiftX: 0.2, fov: 36, stand: [0.4, 4.2], face: 0.1 },
    'book-triton': { look: sub('book-triton'), yaw: -0.6, pitch: 0.14, dist: 34, shiftX: 0.2, fov: 34, stand: [-3.5, 5], face: -0.6 },
    'book-reh2o':  { look: sub('book-reh2o'), yaw: 0.2, pitch: 0.14, dist: 34, shiftX: 0.2, fov: 34, stand: [3.5, 5], face: 0.6 },
    trail:   { look: [0.5, A['flag-tencent'].y + 3, A['flag-tencent'].z - 1], yaw: -0.35, pitch: 0.24, dist: 46, shiftX: 0.33, fov: 36, stand: [6.5, -4], face: 0.9 },
    workshop:{ look: [15, A.camp.y + 5, -16], yaw: 3.5, pitch: 0.4, dist: 52, shiftX: 0.2, fov: 36, stand: [camp.unit7.x + 2, camp.unit7.z + 3], face: 3.0 },
    workbench:{ look: sub('workbench', 1.5), yaw: 3.3, pitch: 0.6, dist: 19, shiftX: 0.2, fov: 34, stand: [camp.bench.x - 3, camp.bench.z + 1.5], face: 1.6 },
    meadow:  { look: [20, A.sungod.y + 3, 8], yaw: 0.85, pitch: 0.3, dist: 64, shiftX: 0.2, fov: 36, stand: [MB.x - 2, MB.z + 1.5], face: 1.5 },
    sungod:  { look: sub('sungod', 3), yaw: 0.3, pitch: 0.26, dist: 34, shiftX: 0.2, fov: 34, stand: [SG.x - 4, SG.z + 2], face: 1.2 },
    pier:    { look: [P.x + 12, A.pier.y + 2, P.z], yaw: 0.78, pitch: 0.24, dist: 46, shiftX: 0.2, fov: 34, stand: [P.x - 1.5, P.z + 1.5], face: 1.5 },
    mailbox: { look: sub('mailbox', 0), yaw: 0.75, pitch: 0.34, dist: 34, shiftX: 0.2, fov: 34, stand: [MB.x - 2, MB.z + 1], face: 1.5 },
  };
  for (const f of LAYOUT.flags) {
    shots[f.id] = { look: sub(f.id, -1.5), yaw: -0.1, pitch: 0.32, dist: 30, shiftX: 0.2, fov: 34, stand: [f.x + 1.6, f.z + 2.2], face: 0.3 };
  }
  // (the Warren Mall buildings stand behind the monuments now: these look down a little more)
  shots['mon-starry'] = { look: sub('mon-starry', 1), yaw: 3.3, pitch: 0.42, dist: 34, shiftX: 0.2, fov: 34, stand: [M.starry.x - 0.5, M.starry.z - 4.5], face: 3.14 };
  shots['mon-im'] = { look: sub('mon-im', 1), yaw: 3.14, pitch: 0.42, dist: 34, shiftX: 0.2, fov: 34, stand: [M.im.x - 1, M.im.z - 4.5], face: 3.14 };
  shots['mon-oj'] = { look: sub('mon-oj', 1), yaw: 3.0, pitch: 0.42, dist: 34, shiftX: 0.2, fov: 34, stand: [M.oj.x - 1, M.oj.z - 5], face: 3.1 };
  shots['mon-triton'] = { look: sub('mon-triton', 3), yaw: 2.95, pitch: 0.46, dist: 36, shiftX: 0.2, fov: 34, stand: [M.triton.x - 3, M.triton.z - 4.5], face: 3.14 };

  // ---------------------------------------------------------------- highlight state
  let focusId = null;
  let hoverId = null;
  function setFocus(id) { focusId = id; }
  function setHover(id) { hoverId = id; }

  // tower liftoff (Geisel takes off) and tomes
  let lift = 0, liftT = -1;
  const liftBeam = new THREE.Mesh(
    new THREE.ConeGeometry(9, 30, 24, 1, true),
    new THREE.MeshBasicNodeMaterial({ color: '#a5f3fc', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
  );
  liftBeam.visible = false;
  group.add(liftBeam);

  let hatT = -1;
  let fallT = -1;
  let fly = null;                     // { t, dur, at(i) -> {x,y,z} }
  const _fly = new THREE.Vector3();

  const stage = {
    group, sky, anchors, shots, pickables, items, hat, sungod, triton, mailbox, judge, tower, cse, seals,
    setFocus, setHover,
    get hover() { return hoverId; },
    /** The tower takes off for a few seconds. */
    liftoff() { if (liftT < 0) liftT = 0; },
    /** `rm -rf /`: the island shudders, drops into the void, and floats back. */
    collapse() { if (fallT < 0) fallT = 0; },
    get collapsing() { return fallT >= 0; },
    /** Something scripted is moving (liftoff, collapse, hat, flyby): the tour loop keeps full frame rate. */
    get animating() { return liftT >= 0 || fallT >= 0 || hatT >= 0 || !!fly; },
    /** The striped hat pops onto the tower (and off again). */
    hatTrick() { hat.visible = true; hatT = 0; },
    /** The paragliders swoop to `at(i)` (a world point per glider, read every frame) for `seconds`, then return to their orbits. */
    flyby(at, seconds = 7) { if (!fly && typeof at === 'function') fly = { t: 0, dur: Math.max(2, seconds), at }; },
    get gliderCount() { return gliders.length; },
    find(id) { return pickables.find((p) => p.id === id) || null; },
    /**
     * Ray test against everything pickable plus `extra` roots (actors that carry userData.pickId).
     * Returns { id, pickable|null, point, label } or null.
     */
    hit(raycaster, extra = []) {
      const roots = [...pickables.map((p) => p.root), ...extra];
      const hits = raycaster.intersectObjects(roots, true);
      for (const h of hits) {
        let o = h.object;
        while (o && !o.userData?.pickId) o = o.parent;
        if (!o) continue;
        const id = o.userData.pickId;
        const pickable = pickables.find((p) => p.id === id) || null;
        return { id, pickable, point: h.point, label: pickable?.label || o.userData.pickLabel || '' };
      }
      return null;
    },
    update(dt, t) {
      const calm = reducedMotion.matches;
      sky.update(dt);
      for (const u of updaters) u(t, dt);
      // highlight easing
      for (const it of Object.values(items)) {
        const want = it.id === focusId ? 1 : it.id === hoverId ? 0.85 : 0;
        it.hi += (want - it.hi) * Math.min(1, dt * 7);
        for (const m of it.meshes) m.userData?.setHi?.(it.hi);
        if (it.isTome) it.obj.group.scale.setScalar(0.62 * (1 + it.hi * 0.18));
        if (it.sprite) it.sprite.scale.setScalar(it.spriteScale * (1 + it.hi * 0.07));
      }
      // beam over the focused landmark
      const fa = focusId && anchors[focusId];
      const showBeam = !!fa && !calm;
      if (showBeam) {
        beam.position.set(fa.x, fa.y + 12, fa.z);
        beam.material.opacity += (0.16 + Math.sin(t * 2.4) * 0.04 - beam.material.opacity) * Math.min(1, dt * 5);
        beam.visible = true;
      } else if (beam.visible) {
        beam.material.opacity -= dt * 0.6;
        if (beam.material.opacity <= 0.01) beam.visible = false;
      }
      // tomes bob and turn; orbiters circle the tower
      tomes.forEach((g, i) => {
        if (calm) return;
        g.position.y = g.userData.base.y + Math.sin(t * 1.2 + i * 2) * 0.5;
        g.rotation.y = Math.sin(t * 0.5 + i) * 0.35 + (i ? -0.4 : 0.4);
        g.rotation.z = Math.sin(t * 0.9 + i) * 0.06;
      });
      for (const c of orbiters) {
        if (!calm) c.userData.a += dt * (c.userData.crystal ? 0.28 : 0.2);
        const a = c.userData.a;
        c.position.set(Math.cos(a) * c.userData.r, (c.userData.crystal ? 12 : 8) + Math.sin(a * 3) * 1.2, Math.sin(a) * c.userData.r);
        if (!calm) c.rotation.y += dt * 1.2;
      }
      bookBatch.sync(orbiters.slice(0, 4));
      crystalBatch.sync(orbiters.slice(4));
      // paragliders drift around the island, banking into the turn
      // (a flyby pulls them off their orbit toward points the caller supplies, then lets them drift back)
      let flyW = 0;
      if (fly) {
        fly.t += dt;
        const k = fly.t / fly.dur;
        if (k >= 1) fly = null;
        else { const e = Math.min(1, k / 0.3, (1 - k) / 0.3); flyW = e * e * (3 - 2 * e) * 0.92; }
      }
      gliders.forEach((g, i) => {
        const o = g.userData.orbit;
        if (!calm) o.a += dt * o.w;
        g.position.set(Math.cos(o.a) * o.r, o.y + Math.sin(t * 0.6 + o.a * 3) * 0.8, Math.sin(o.a) * o.r);
        g.rotation.y = -o.a + (o.w > 0 ? 0 : Math.PI) + Math.PI / 2;
        g.rotation.z = (o.w > 0 ? -1 : 1) * 0.22;
        const p = flyW > 0 ? fly?.at(i) : null;
        if (p) {
          g.position.lerp(_fly.set(p.x, p.y + Math.sin(t * 1.3 + i) * 0.4, p.z), flyW);
          g.rotation.z *= 1 - flyW;
        }
      });
      // sun god sways, seals breathe
      if (!calm) {
        sungod.rotation.z = Math.sin(t * 1.1) * 0.03;
        seals.forEach((s, i) => { s.userData.setFrame(Math.floor(t * 0.8 + i) % 2); });
      }
      // liftoff: rise, hover with a beam, settle
      if (liftT >= 0) {
        liftT += dt;
        const T1 = 2.4, T2 = 5.2, T3 = 7.6;
        lift = liftT < T1 ? (liftT / T1) ** 2 : liftT < T2 ? 1 : liftT < T3 ? 1 - ((liftT - T2) / (T3 - T2)) ** 2 : 0;
        const shake = liftT < T1 || (liftT > T2 && liftT < T3) ? 0.06 : 0.015;
        tower.group.position.set(T.x + (Math.random() - 0.5) * shake * 10, surface(T.x, T.z) + 0.5 + lift * 16, T.z + (Math.random() - 0.5) * shake * 10);
        liftBeam.visible = lift > 0.1;
        liftBeam.position.set(T.x, surface(T.x, T.z) + 6 + lift * 6, T.z);
        liftBeam.material.opacity = 0.22 * Math.min(1, lift * 1.5) * (0.85 + 0.15 * Math.sin(t * 20));
        if (liftT >= T3) { liftT = -1; lift = 0; tower.group.position.set(T.x, surface(T.x, T.z) + 0.5, T.z); liftBeam.visible = false; }
      }
      // collapse: the whole island (not the sky) falls, waits in the dark, then floats back
      if (fallT >= 0) {
        fallT += dt;
        const shake = fallT < 1.6 ? 0.25 * (fallT / 1.6) : 0;
        let y = 0;
        if (fallT >= 1.6 && fallT < 4.6) y = -0.5 * 34 * (fallT - 1.6) ** 2;
        else if (fallT >= 4.6 && fallT < 6.4) y = -0.5 * 34 * 9;
        else if (fallT >= 6.4 && fallT < 8.6) { const k = 1 - (fallT - 6.4) / 2.2; y = -0.5 * 34 * 9 * k * k * (3 - 2 * k) ; }
        scene.position.set((Math.random() - 0.5) * shake, y, (Math.random() - 0.5) * shake);
        sky.group.position.y = -y;
        if (fallT >= 8.6) { fallT = -1; scene.position.set(0, 0, 0); sky.group.position.y = 0; }
      }
      // hat pop
      if (hatT >= 0) {
        hatT += dt;
        const k = hatT < 0.35 ? hatT / 0.35 : hatT < 4.2 ? 1 : Math.max(0, 1 - (hatT - 4.2) / 0.4);
        const bounce = hatT < 0.35 ? 1 + Math.sin(k * Math.PI) * 0.25 : 1;
        hat.scale.setScalar(0.7 * k * bounce);
        hat.rotation.z = Math.sin(hatT * 5) * 0.08 * k;
        if (hatT >= 4.6) { hatT = -1; hat.visible = false; }
      }
    },
  };
  for (const [k, a] of Object.entries(anchors)) if (![a.x, a.y, a.z].every(Number.isFinite)) console.warn('[stage] anchor off the island:', k, a);
  for (const [k, sh] of Object.entries(shots)) if (![...sh.look, ...sh.stand].every(Number.isFinite)) console.warn('[stage] shot with a bad point:', k);
  return stage;
}

const FLAG_LABELS = {
  'flag-samsung': 'Samsung Semiconductor',
  'flag-picasso': 'Picasso Lab · UCSD CSE',
  'flag-metabit': 'Metabit',
  'flag-tencent': 'Tencent · TiMi Studio',
  'flag-hotstar': 'Disney+ Hotstar',
  'flag-lark': 'ByteDance · Lark',
};
