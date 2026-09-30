// The island, always on. It renders full-viewport behind the page ("tour": the camera follows the
// page's scroll, the scholar walks between landmarks, everything is harmless). The credits' "Enter
// the world", the title menu, W/A/S/D or the Play button hand the reader the controls ("play": an
// open world: the UCSD hub plus one region per CV entry, reached through doors, portals, the map or
// the boat; combat, vehicles, quests and the Road to Dr.).
//
// Key rule of play mode: the world only advances while no modal is open. Dialogs, the shop,
// battles, panels, mini-games and game-over are all modals, so hostile AI, projectiles, hazards
// and every timer freeze while they are up, and the player gets a short grace window afterwards.
//
// Frame budget: in tour mode, once the camera has settled and nothing is animating, the world is
// drawn at most ~30 times a second and the shadow map is refreshed every other frame; play mode and
// any camera motion run at full rate. Hidden regions are neither drawn nor updated.
import * as THREE from 'three/webgpu';
import { pass, mrt, output, emissive } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { createRobustRenderer, probeGPU, reducedMotion } from '../three/boot.js';
import { S, save } from './state.js';
import { clock, advance } from './clock.js';
import { on, emit } from './bus.js';
import { mode } from './mode.js';
import { where } from './where.js';
import { buildWorld, ZONES } from './world.js';
import { createComposite } from './worldgrid.js';
import { buildStage } from './stage.js';
import { LAYOUT } from './layout.js';
import { createCamera } from './camera.js';
import { createInput } from './input.js';
import { createTour } from './tour.js';
import { createDirector } from './director.js';
import * as fx from './fx.js';
import { initModals, modalOpen, modalKey, closeAllModals, isModalOpen } from './modal.js';
import { initNotify, toast, banner } from './notify.js';
import { player, initPlayer, tickPlayer, grace, revive, reward as giveReward } from './player.js';
import { createMover } from './move.js';
import { createVehicles, VEHICLES } from './vehicles.js';
import { initWeapon, attack as swingWeapon, updateWeapon, hitstop, spinYaw, setViewModel } from './weapon.js';
import { initCombat, castSpell, updateProjectiles, clearHostileProjectiles, clearAllProjectiles, liveTargets } from './combat.js';
import { initEnemies, updateEnemies, enemies, liveFoes } from './enemies.js';
import { clearFoeHazards, patternBosses, foes } from './foes.js';
import { initBosses, updateBosses, clearBossHazards, bosses } from './bosses.js';
import { initNpcs, updateNpcs, nearestNpc, talk, npcs, npcMarkers } from './npcs.js';
import { initLoot, updateLoot, tokenMarkers } from './loot.js';
import { initMonsters, updateGrass, cycleActive, onTravel } from './monsters.js';
import { initCompanion, updateCompanion, placeBuddy, signature, buddy } from './companion.js';
import { initProgress, initSecret, updateSecret, interactDoor, nearChest, openChest, recordRun, doorMarker } from './progress.js';
import { initHud, updateHud, flashSlot, setHudFlags } from './hud.js';
import { openAchievements, openInventory, openParty, openHelp, openGameOver } from './panels.js';
import { initRegions, makeCtx, updateRegions, nearestInteractable, useInteractable, regionName, ensureRegion, REGIONS, dismount } from './regions.js';
import * as regionsApi from './regions.js';
import { createTravel, HUB_SPAWN } from './travel.js';
import { checkQuests, openQuestLog, roadCount, ROAD } from './road.js';
import { createTouch } from './touch.js';
import { sfx, startMusic, stopMusic } from './audio.js';
import { h } from './util.js';
import { registerEgg, found } from '../site/eggs.js';
import { initPageLink } from './pagelink.js';

const BG = '#070a12';
const SKY = { tint: '#c7d2fe', ground: '#0b1024', fog: BG, density: 0.0085, background: BG, sun: 2.2 };

// engine eggs (the controls themselves): kind 'game', grouped under the island in Field Notes
const ENGINE_EGGS = [
  { id: 'combo', name: 'Three-hit combo', hint: 'Keep swinging (J, J, J).', done: 'Slash, backslash, spin. Reviewer #2 was not ready.' },
  { id: 'mk35', name: 'Suit up', hint: 'Press V until something heavy arrives.', done: 'Mk-35 Triton exosuit online. Fiat lux, and thrust.' },
  { id: 'yujian', name: '御剑飞行', hint: 'A sword is also a vehicle, if you believe hard enough.', done: 'Flying on your own sword. Cultivation stage: first-year Ph.D.' },
  { id: 'honk', name: 'Honk if you love GPUs', hint: 'The car has a horn.', done: 'Beep beep. Everything nearby politely moved.' },
  { id: 'glasses', name: 'Through his glasses', hint: 'Zoom all the way in.', done: 'Round, thin and silver. Everything looks sharper now.' },
  { id: 'faceplant', name: 'Gravity is a reviewer', hint: 'Step off the edge of an island.', done: 'A friendly breeze put you back. No damage, no desk reject.' },
];

/**
 * @param {{ worldEl: HTMLElement, root: HTMLElement, progress?: (msg: string) => void }} opts
 *   worldEl  the fixed full-viewport layer behind the page (gets the canvas and the world labels)
 *   root     the overlay for HUD, dialogs and toasts
 */
export async function createGame({ worldEl, root, progress = () => {} }) {
  const q = new URLSearchParams(location.search);
  const probe = probeGPU();
  const coarse = matchMedia('(pointer: coarse)').matches;
  const lowfx = q.get('fullfx') === '1' ? false : (probe.software || q.get('lowfx') === '1' || coarse);
  const fixedDpr = q.get('dpr') ? Number(q.get('dpr')) : null;
  for (const e of ENGINE_EGGS) registerEgg({ ...e, kind: 'game', src: 'world', region: 'hub', regionName: 'UC San Diego island' });

  root.innerHTML = '';
  root.classList.add('g');
  const noticesEl = h('div', { class: 'g__notices' });
  const hudEl = h('div', { class: 'g__hud' });
  const modalsEl = h('div', { class: 'g__modals' });
  const fadeEl = h('div', { class: 'g__fade', 'aria-hidden': 'true' });
  root.append(noticesEl, hudEl, fadeEl, modalsEl);
  let canvas = h('canvas', { class: 'g__canvas', 'aria-hidden': 'true' });
  worldEl.append(canvas);

  progress('lighting the island');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.FogExp2(BG, 0.0085);
  const hemi = new THREE.HemisphereLight(SKY.tint, SKY.ground, 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe7c2', SKY.sun);
  sun.position.set(-30, 46, 24);
  sun.castShadow = !lowfx;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 140 });
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);

  progress('growing the campus');
  const hub = new THREE.Group();               // everything that belongs to the UCSD island
  hub.name = 'hub';
  scene.add(hub);
  const island = buildWorld(7);
  hub.add(island.group);
  const world = createComposite(island);
  addPierDeck(world);
  const stage = buildStage(world, scene, { lowfx, parent: hub });
  const rig = createCamera();
  // camera collision: terrain, plus blocked cells (buildings, statues, trunks) as ~9-voxel obstacles
  rig.setGround((x, z) => world.surfaceY(x, z) + (world.isBlocked(x, z) ? 9 : 0), (x, z) => world.surfaceY(x, z));
  const input = createInput(worldEl);
  const tour = createTour(world);

  // ---- systems ----
  fx.initFx({ scene, camera: rig.cam, root: worldEl });
  initModals(modalsEl);
  initNotify(noticesEl);
  initCombat(scene);
  initPlayer(scene);
  player.x = HUB_SPAWN.x; player.z = HUB_SPAWN.z; player.y = world.surfaceY(player.x, player.z);
  initEnemies(world, hub, ZONES);
  initBosses(world, hub, ZONES);
  initLoot(world, hub, scene);
  initMonsters(world, hub);
  initNpcs(world, hub);
  initCompanion(scene, world);
  placeBuddy();
  initSecret(world, hub);
  initProgress();
  initWeapon(scene);

  let visY = player.y;           // the scholar mesh's smoothed height (step-ups)
  let glider = null;             // the Torrey Pines paraglider over his head while gliding
  const hubCtx = makeCtx('hub', { id: 'hub', name: 'UC San Diego', size: 64 }, hub, 0, 0);
  let travelApi = null;
  let director = null;
  initRegions({
    scene, world, hubCtx,
    travel: (to, at, opts) => travelApi.travel(to, at, opts),
    say: (who, text, ms) => director?.say(who, text, ms),
    setSky: (sky) => applySky(sky),
    cinematic: (pose) => rig.cinematic(pose, pose.seconds),
  });
  // a graduate keeps the (game) Dr. title across reloads, wherever they are
  if (S.world.title) import('./regions/finale.js').then((m) => m.installDrTitle()).catch(() => {});
  const mover = createMover({ world, input, rig, onFallOut: () => { found('faceplant'); travelApi.respawnHere('fall'); } });
  const vehicles = createVehicles({ scene, world, input, rig, mover, onOut: () => travelApi.respawnHere('fall') });
  travelApi = createTravel({
    world, hubGroup: hub, scene, rig, placeBuddy, fadeEl, hubCtx,
    setSkyOrigin(ox, oz) {
      stage.sky.group.position.set(ox, 0, oz);
      sun.position.set(ox - 30, 46, oz + 24);
      sun.target.position.set(ox, 0, oz);
      if (sun.castShadow) sun.shadow.needsUpdate = true;
    },
    applySky: (sky) => applySky(sky),
  });
  function applySky(sky) {
    const s = { ...SKY, ...(sky || {}) };
    if (sky && sky.background == null && sky.fog) s.background = sky.fog;
    hemi.color.set(s.tint);
    hemi.groundColor.set(s.ground);
    scene.fog.color.set(s.fog);
    scene.fog.density = s.density;
    scene.background.set(s.background ?? s.fog);
    sun.intensity = s.sun;
  }

  const touch = coarse ? createTouch(hudEl, input, {
    attack: () => doAttack(), interact: () => interact(), spell: () => doSpell('fireball'),
    vehicle: () => doVehicle(), map: () => travelApi.openMap(), view: () => toggleView(),
  }) : null;

  initHud(hudEl, {
    attack: doAttack, spell: doSpell, signature: doSignature, swap: () => { if (!modalOpen()) cycleActive(); },
    achievements: openAchievements, inventory: openInventory, party: openParty,
    help: () => openHelp({ onLeave: exitPlay }), leave: () => exitPlay(),
    map: () => travelApi.openMap(), questlog: openQuestLog, vehicle: () => doVehicle(),
  }, { world, markers: minimapData });

  director = createDirector({
    worldEl, overlayEl: root, stage, rig, tour, world, player, buddy, npcs, camera: rig.cam,
    hooks: {
      onPick(hit) {
        if (hit.id === 'scholar') scholarQuip();
        else if (hit.id === 'bit') { emit('bit:pet'); director.say('bit', petLine()); fx.burst(buddy.x, buddy.y + 2, buddy.z, '#f9a8d4', 8, 3, 0.7, 0.6); }
        else if (hit.id.startsWith('npc:')) { const n = npcs.find((q) => `npc:${q.id}` === hit.id); if (n) talk(n); }
      },
    },
  });

  // ---- renderer ----
  progress('compiling shaders');
  let pipeline;
  function build(r) {
    r.toneMapping = THREE.NeutralToneMapping;
    r.shadowMap.enabled = !lowfx;
    r.shadowMap.type = THREE.PCFShadowMap;
    const p = new THREE.RenderPipeline(r);
    const sp = pass(scene, rig.cam);
    if (lowfx) { p.outputNode = sp; return p; }
    sp.setMRT(mrt({ output, emissive }));
    // BloomNode already renders at half resolution (its default resolutionScale is 0.5)
    p.outputNode = sp.getTextureNode('output').add(bloom(sp.getTextureNode('emissive'), 0.9, 0.5, 0));
    return p;
  }
  function resize(r) {
    const w = worldEl.clientWidth || window.innerWidth;
    const hh = worldEl.clientHeight || window.innerHeight;
    rig.resize(w, hh);
    fx.setViewSize(w, hh);
    r.setSize(w, hh, false);
    rig.update(player, null, 0, 0);
  }
  let smoked = false;
  const { renderer, backend } = await createRobustRenderer(
    () => {
      const c = h('canvas', { class: 'g__canvas', 'aria-hidden': 'true' });
      canvas.replaceWith(c);
      canvas = c;
      return c;
    },
    async (r) => {
      resize(r);
      director.retarget();
      tour.stand(shotStand().x, shotStand().z, shotStand().face, { instant: true });
      placeActors(0);
      placeBuddy();
      rig.settle();
      stage.update(0, 0);
      await r.compileAsync(scene, rig.cam);
      pipeline = build(r);
      pipeline.render();
      smoked = true;
    },
    { maxDpr: coarse ? 1.25 : 1.5, antialias: false, alpha: false },
  );
  if (fixedDpr) renderer.setPixelRatio(fixedDpr);
  const maxPr = renderer.getPixelRatio();
  function shotStand() {
    const s = stage.shots[director.currentKey] || stage.shots.hero;
    return { x: s.stand?.[0] ?? HUB_SPAWN.x, z: s.stand?.[1] ?? HUB_SPAWN.z, face: s.face ?? 0 };
  }

  // ---- actors on screen ----
  function placeActors(dt) {
    const m = player.mesh;
    const veh = player.vehicle;
    const inside = veh === 'car' || veh === 'mech';
    m.visible = !player.dead && !inside;
    // smooth the step-ups (physics snaps a whole voxel), follow jumps and falls exactly
    visY = player.grounded && Math.abs(player.y - visY) < 1.2 ? visY + (player.y - visY) * Math.min(1, dt * 22 || 1) : player.y;
    const bob = player.walking && player.grounded && !veh ? Math.abs(Math.sin(player.t)) * 0.22 : 0;
    const roll = player.roll || 0;
    m.position.set(player.x, visY + bob + (roll ? Math.sin(roll / 2) * 1.1 : 0) + (veh === 'sword' ? 0.05 : 0), player.z);
    m.rotation.set(roll, player.yaw + spinYaw(), 0);
    m.userData.setFrame(player.walking ? Math.floor(player.t / 1.6) % 2 : 0);
    // first person: only the blade stays visible (the camera sits inside the head)
    const fp = mode.play && rig.firstPerson;
    if (fp) for (const c of m.children) if (c.isInstancedMesh) c.visible = false;
    for (const c of m.children) if (c.userData.backpack) c.visible = !fp;
    // the Torrey Pines glider
    if (player.gliding) {
      if (!glider) { glider = regionsApi.sprite(hubCtx, 'paraglider', { scale: 0.34 }); scene.add(glider); }
      glider.visible = true;
      glider.position.set(player.x, player.y + 3.4, player.z);
      glider.rotation.set(0, player.yaw + Math.PI / 2, 0);
    } else if (glider?.visible) glider.visible = false;
  }
  function teleport(x, z) {
    player.x = x; player.z = z; player.y = world.surfaceY(x, z);
    player.vx = player.vz = player.vy = 0; player.grounded = true;
    placeBuddy();
    rig.snap(player);
    grace(1500);
  }
  onTravel((x, z) => { if (where.id !== 'hub') travelApi.travel('hub', [x, z]); else teleport(x, z); });

  // ---- the play simulation (also used by __g.sim for tests) ----
  let questT = 0;
  function tickPlay(dt, t) {
    if (modalOpen()) return;
    advance(dt * 1000);
    if (hitstop() <= 0) {
      if (player.vehicle) vehicles.step(dt); else mover.step(dt);
      tickPlayer(dt);
      updateCompanion(dt);
      updateEnemies(dt);
      if (where.id === 'hub') { updateBosses(dt); updateSecret(dt); updateGrass(); }
      updateProjectiles(dt);
      updateLoot(dt);
      updateNpcs(dt);
      updateRegions(dt, t);
      questT -= dt;
      if (questT <= 0) { questT = 0.5; checkQuests(); }
    }
    S.stats.playMs += dt * 1000;
    input.endFrame();
  }

  // ---- loop ----
  let awakeUntil = performance.now() + 2500;   // under reduced motion, render only while something is happening
  let last = performance.now();
  let lastRaf = last, lastRender = 0, slowT = 0, fastT = 0, frameNo = 0;
  // ?perf=1: per-frame probe (simulation ms, render-submit ms, draw calls, triangles) on window.__perf
  const perf = q.get('perf') === '1' ? { n: 0, sim: 0, render: 0, calls: 0, tris: 0, reset() { Object.assign(this, { n: 0, sim: 0, render: 0, calls: 0, tris: 0 }); } } : null;
  if (perf) window.__perf = perf;
  const noRender = !!perf && q.get('norender') === '1';   // measure the CPU side alone (software GPUs)
  function frame(dt, t) {
    const t0 = perf ? performance.now() : 0;
    if (perf) { renderer.info.autoReset = false; renderer.info.reset(); }
    frameNo++;
    if (mode.play) {
      tickPlay(dt, t);
      updateHud();
      setHudFlags({ fp: rig.firstPerson, vehicle: player.vehicle });
      touch?.sync({ flying: player.vehicle === 'sword' || player.vehicle === 'mech' });
    } else {
      tour.update(dt);
      updateCompanion(dt);
      updateEnemies(dt);
      updateBosses(dt);
      updateLoot(dt);
      updateNpcs(dt);
      updateRegions(dt, t);
      director.update(dt);
    }
    stage.update(dt, t);
    updateWeapon(modalOpen() ? 0 : dt, { vehicle: player.vehicle });
    placeActors(dt);
    rig.update(player, mode.play ? input : null, dt, t, { eye: vehicleEye() });
    // islander name plates only show when the camera is close enough to read them
    const near = mode.play || rig.cur.dist < 48;
    if (near !== where.near) { where.near = near; worldEl.classList.toggle('is-near', near); }
    const sh = fx.shakeOffset();
    if (sh && !reducedMotion.matches) { rig.cam.position.x += (Math.random() - 0.5) * sh; rig.cam.position.y += (Math.random() - 0.5) * sh; }
    fx.updateFx(modalOpen() ? 0 : dt);
    // shadows: the full map every frame in play; a 1024 map refreshed every other frame in tour
    if (sun.castShadow) {
      sun.shadow.autoUpdate = mode.play;
      if (!mode.play && frameNo % 2 === 0) sun.shadow.needsUpdate = true;
    }
    const t1 = perf ? performance.now() : 0;
    if (!noRender) pipeline.render();
    if (perf) { perf.n++; perf.sim += t1 - t0; perf.render += performance.now() - t1; perf.calls += renderer.info.render.drawCalls; perf.tris += renderer.info.render.triangles; }
  }
  function vehicleEye() {
    if (!rig.firstPerson) return null;
    if (player.vehicle === 'mech') return { x: player.x, y: player.y + 4.7, z: player.z };
    if (player.vehicle === 'car') return { x: player.x + Math.sin(player.yaw) * 1.4, y: player.y + 1.9, z: player.z + Math.cos(player.yaw) * 1.4 };
    return null;
  }
  /** Nothing moves: the tour camera has settled, nobody walks, no effect or scripted animation runs. */
  const idle = () => !mode.play && rig.motion < 0.02 && !tour.busy && !fx.busy() && !stage.animating;
  function step() {
    const now = performance.now();
    const rafDt = now - lastRaf;
    lastRaf = now;
    // adaptive resolution, driven by the real display cadence: ~1.5 s of slow frames drops the pixel
    // ratio 20 %; ~4 s of smooth frames earns it back
    if (!fixedDpr && smoked && rafDt < 250) {
      if (rafDt > 34) { slowT += rafDt / 1000; fastT = 0; } else if (rafDt < 20) { fastT += rafDt / 1000; slowT = Math.max(0, slowT - rafDt / 3000); }
      const pr = renderer.getPixelRatio();
      if (slowT > 1.5 && pr > 0.6) { slowT = 0; setPr(Math.max(0.6, pr * 0.8)); }
      else if (fastT > 4 && pr < maxPr) { fastT = 0; setPr(Math.min(maxPr, pr * 1.15)); }
    }
    if (reducedMotion.matches && !mode.play && now > awakeUntil && !tour.busy) return;
    // tour at rest: at most ~30 fps
    if (idle() && now - lastRender < 31) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    lastRender = now;
    frame(dt, now / 1000);
  }
  function setPr(pr) {
    renderer.setPixelRatio(pr);
    renderer.setSize(worldEl.clientWidth, worldEl.clientHeight, false);
  }
  renderer.setAnimationLoop(step);
  const wake = () => { awakeUntil = performance.now() + 1800; };
  on('progress', wake);
  on('shot', wake);
  window.addEventListener('pointermove', wake, { passive: true });
  window.addEventListener('resize', () => { resize(renderer); wake(); });

  // ---- actions (play) ----
  let combo = 0, comboAt = 0;
  function doAttack() {
    if (modalOpen() || player.dead) return;
    if (vehicles.fire()) { if (player.vehicle === 'car') toast('Hands on the wheel. Drive into them instead.', { icon: 'crossed-swords' }); return; }
    swingWeapon();
  }
  on('player:swing', (step) => {
    const now = performance.now();
    combo = step === 0 ? 1 : now - comboAt < 900 ? combo + 1 : 1;
    comboAt = now;
    if (step === 2 && combo >= 3) found('combo');
  });
  function doSpell(id) { if (modalOpen()) return; if (!castSpell(id)) flashSlot(id); }
  function doSignature() { if (modalOpen()) return; if (!signature()) flashSlot('sig'); }
  function doVehicle() {
    if (modalOpen() || player.dead) return;
    const v = vehicles.cycle();
    toast(v.id ? `${v.name} · ${v.hint}` : 'On foot.', { icon: 'horse-head' });
  }
  function toggleView() {
    rig.toggleView();
    setViewModel(rig.firstPerson);
    if (rig.firstPerson) found('glasses');
  }
  function interact() {
    if (modalOpen() || player.dead) return;
    const npc = nearestNpc(4);
    const it = nearestInteractable();
    const npcScore = npc ? Math.hypot(player.x - npc.x, player.z - npc.z) / 4 : Infinity;
    if (it && it.d <= npcScore) { useInteractable(it.it); return; }
    if (npc) { talk(npc); return; }
    if (player.ride) { dismount(); toast('Back on foot.', { icon: 'footprint' }); return; }
    if (where.id === 'hub') {
      if (interactDoor()) return;
      if (nearChest()) { openChest(); return; }
    }
    toast('Nothing to use here. Walk up to someone or something with a name plate.', { icon: 'conversation' });
  }
  input.onKey = (key, e) => {
    if (modalOpen()) { if (modalKey(e)) return true; return key !== 'Escape'; }
    switch (e.code) {
      case 'KeyJ': doAttack(); return true;
      case 'Digit1': doSpell('fireball'); return true;
      case 'Digit2': doSpell('heal'); return true;
      case 'Digit3': doSpell('lightning'); return true;
      case 'Digit4': doSpell('meteor'); return true;
      case 'KeyG': doSignature(); return true;
      case 'KeyT': cycleActive(); return true;
      case 'KeyE': interact(); return true;
      case 'KeyV': doVehicle(); return true;
      case 'KeyM': travelApi.openMap(); return true;
      case 'KeyL': openQuestLog(); return true;
      case 'KeyH': if (vehicles.honk()) { found('honk'); return true; } return false;
      case 'KeyC': case 'F5': toggleView(); return true;
      default: break;
    }
    if (key === '?') { openHelp({ onLeave: exitPlay }); return true; }
    return false;
  };
  input.onPrimary = () => doAttack();
  input.onEscape = () => { if (!modalOpen()) exitPlay(); };
  worldEl.addEventListener('click', (e) => {
    const plate = e.target.closest('.g__plate');
    if (!plate || modalOpen()) return;
    const npc = npcs.find((n) => n.plate === plate);
    if (npc && (!mode.play || Math.hypot(player.x - npc.x, player.z - npc.z) < 6)) talk(npc);
  });
  // in tour mode a modal (an islander's dialog) also locks the page scroll behind it
  on('pause', (paused) => {
    document.documentElement.classList.toggle('modal-open', paused);
    if (!mode.play) return;
    input.clear();
    if (paused) { input.unlock(); clearHostileProjectiles(); clearBossHazards(); clearFoeHazards(); }
    else grace(1200);
  });
  on('kill', ({ target }) => {
    if (target.boss) return;
    S.stats.kills++;
    if (target.kind) giveReward({ gold: target.kind.gold, xp: target.kind.xp });
  });
  let lastDeathCause = '';
  on('player:dead', ({ source }) => {
    sfx('error');
    recordRun();
    lastDeathCause = source;
    queueMicrotask(showGameOver);
  });
  on('levelup', ({ level }) => banner(`Level ${level}`, 'HP and MP fully restored.', 'upgrade'));
  on('boss:defeated', ({ name, round, rune, region }) => {
    if (region && region !== 'hub') return;
    if (!rune) toast(`${name} Lv.${round} defeated. It will return stronger.`, { icon: 'trophy', tone: 'gold' });
    if (name === 'Deadline Dragon' && !S.trainer.captured.tidefin) setTimeout(() => toast('Fern on the lawn has news for you.', { icon: 'conversation' }), 3500);
  });
  on('boss:returned', ({ name, round }) => toast(`${name} Lv.${round} has returned.`, { icon: 'triangle-alert' }));
  on('spell:nomp', () => toast('Not enough MP.', { icon: 'crystal-shine' }));
  on('buddy:changed', () => placeBuddy());
  on('vehicle:first', (kind) => { if (kind === 'mech') found('mk35'); if (kind === 'sword') found('yujian'); });
  on('vehicle', () => placeBuddy());
  on('travel', () => { placeBuddy(); visY = player.y; });

  function showGameOver() {
    if (!mode.play || !player.dead || isModalOpen('gameover')) return;
    openGameOver({ stats: { cause: lastDeathCause, where: regionName(where.id) }, onRespawn: respawn });
  }
  function respawn() {
    S.stats.deaths++;
    revive();
    clearAllProjectiles();
    clearBossHazards();
    clearFoeHazards();
    vehicles.set(null);
    travelApi.respawnHere('death');
    save();
    emit('respawn');
    toast(`Back on your feet at ${where.id === 'hub' ? 'the plaza' : 'the portal'}. Nothing lost.`, { icon: 'heart-plus' });
  }
  function minimapData() {
    return {
      tokens: where.id === 'hub' ? tokenMarkers() : [],
      npcs: npcMarkers(),
      enemies: liveFoes(),
      bosses: [...Object.values(bosses).filter((b) => b.alive && where.id === 'hub'), ...patternBosses.filter((b) => b.alive && b.active)],
      door: where.id === 'hub' ? doorMarker() : null,
      doors: where.id === 'hub' ? travelApi.doors : [],
    };
  }

  // ---- small talk ----
  const QUIPS = [
    'One more experiment and then I will write it up.',
    'The camera-ready deadline is in… never mind.',
    'Reviewer #2 asked for more baselines. Again.',
    'It works on my GPU.',
    'I only came here for the free coffee.',
    'Have you tried turning the loss function off and on again?',
    'This is fine. The loss is going down. Somewhere.',
  ];
  let quip = 0;
  function scholarQuip() {
    player.walking = false;
    director.say('me', QUIPS[quip++ % QUIPS.length]);
    fx.burst(player.x, player.y + 3.6, player.z, '#f2b84b', 6, 3, 0.6, 0.6);
    emit('scholar:poke', quip);
  }
  let pets = 0;
  const PET = ['Bit purrs in binary.', 'Bit does a little hop.', 'Bit wiggles its antenna.', 'Bit is very pleased.'];
  const petLine = () => PET[pets++ % PET.length];

  // ---- first-run coach ----
  let coach = null;
  function showCoach() {
    const k = (t) => h('kbd', null, t);
    coach = h('div', { class: 'g__coach', role: 'dialog', 'aria-label': 'How to play' },
      h('p', { class: 'g__coach-title' }, 'You have the controls'),
      coarse
        ? h('p', null, 'Left thumb: move · drag on the right: look · buttons: attack, jump, E to use, dodge, vehicle, map.')
        : h('p', null, k('W'), k('A'), k('S'), k('D'), ' move · click: mouse look · ', k('Space'), ' jump · ', k('Shift'), ' sprint · ', k('K'), ' dodge · ', k('J'), '/click attack (combo) · ', k('E'), ' use · ', k('V'), ' vehicle · ', k('M'), ' map · ', k('C'), ' first person · ', k('Esc'), ' back to the page'),
      h('p', { class: 'muted small' }, `Your journey, the Road to Dr.: collect a diploma, 6 badges, 4 relics and 2 seals (${roadCount()} / ${ROAD.length}). Every landmark on the island is a door: the gate, the CSE building, the flags, the monuments, Geisel. The boat on the pier goes anywhere you have been.`),
      h('button', { type: 'button', class: 'btn btn--small btn--primary', onclick: () => { S.settings.tutorial4 = true; save(); coach.remove(); coach = null; } }, 'Let’s go'),
    );
    hudEl.append(coach);
  }

  // ---- modes ----
  function enterPlay({ dive = true } = {}) {
    if (mode.play || paused) return;
    mode.play = true;
    document.documentElement.classList.add('is-play');
    director.setEnabled(false);
    tour.stand(player.x, player.z, null, { instant: true });
    player.vx = player.vz = player.vy = 0; player.grounded = true; visY = player.y;
    input.attach();
    rig.setPlay(true, player);
    if (dive) rig.dive(1.2);
    if (!S.settings.soundTouched) { S.settings.sound = true; }
    grace(1500);
    if (S.settings.music) startMusic();
    if (!S.settings.tutorial4 && !coach) showCoach();
    if (player.dead) queueMicrotask(showGameOver);
    placeBuddy();
    touch?.show(true);
    emit('mode', 'play');
    worldEl.focus?.();
    const r = S.world.resume;
    if (r?.id && REGIONS[r.id] && !coach) setTimeout(() => { if (mode.play && where.id === 'hub') toast(`Last time you were at ${regionName(r.id)}. M opens the map.`, { icon: 'treasure-map' }); }, 1600);
  }
  function exitPlay() {
    if (!mode.play) return;
    closeAllModals();
    input.detach();
    touch?.show(false);
    stopMusic();
    clearAllProjectiles();
    clearBossHazards();
    clearFoeHazards();
    vehicles.set(null);
    player.ride = null;
    if (rig.firstPerson) { rig.setFirstPerson(false); setViewModel(false); }
    if (player.dead) revive();
    mode.play = false;
    document.documentElement.classList.remove('is-play');
    rig.setPlay(false);
    // the page always talks about the island: come home (the map remembers where you were)
    if (where.id !== 'hub') {
      travelApi.activate('hub');
      const s = shotStand();
      tour.stand(s.x, s.z, s.face, { instant: true });
      placeBuddy();
      visY = player.y;
    }
    director.setEnabled(true);
    director.retarget();
    if (where.id === 'hub' && rig.cur.look.distanceTo(rig.want.look) > 200) rig.settle();
    save();
    emit('mode', 'tour');
    wake();
  }

  // ---- the opening fly-in ----
  function intro() {
    const s = stage.shots.hero;
    rig.jump({ look: [s.look[0] - 6, s.look[1] + 8, s.look[2]], yaw: s.yaw + 1.5, pitch: 0.62, dist: s.dist * 2.1, fov: 34, shiftX: 0 });
    rig.tourRate = 0.75;
    setTimeout(() => { rig.tourRate = 2.2; }, 3600);
  }
  if (q.get('intro') !== '0' && !reducedMotion.matches) intro();
  wake();

  // ---- pause (the page's Reviewer mode): stop rendering and the director, resume where the page is ----
  let paused = false;
  function setPaused(on) {
    on = !!on;
    if (on === paused) return;
    if (on) {
      if (mode.play) exitPlay();
      paused = true;
      renderer.setAnimationLoop(null);
      director.setPaused(true);
      fx.clearFx();                     // floating labels would otherwise freeze on screen
    } else {
      paused = false;
      director.setPaused(false);
      last = performance.now();
      resize(renderer);
      renderer.setAnimationLoop(step);
      wake();
    }
  }

  /** Test harness: run the play simulation for `seconds` at 60 Hz without rendering. */
  function sim(seconds = 1) {
    const n = Math.round(seconds * 60);
    for (let i = 0; i < n; i++) {
      const t = performance.now() / 1000 + i / 60;
      if (mode.play) tickPlay(1 / 60, t);
      updateWeapon(1 / 60, { vehicle: player.vehicle });
      placeActors(1 / 60);
      rig.update(player, mode.play ? input : null, 1 / 60, t, { eye: vehicleEye() });
    }
    return { x: +player.x.toFixed(2), y: +player.y.toFixed(2), z: +player.z.toFixed(2), grounded: player.grounded, vehicle: player.vehicle, region: where.id };
  }

  const api = {
    world, stage, director, rig, tour, renderer, backend, lowfx, scene,
    enterPlay, exitPlay, setPaused,
    get playing() { return mode.play; },
    get paused() { return paused; },
    get region() { return where.id; },
    say: (who, text, ms) => director.say(who, text, ms),
    travel: (to, at, opts) => travelApi.travel(to, at, opts),
    openMap: () => travelApi.openMap(),
    talk, npcs, player, buddy, fx, toast, banner,
    invalidate: wake,
    dispose() { renderer.setAnimationLoop(null); },
  };
  window.__g = { S, player, buddy, clock, world, stage, rig, director, scene, renderer, backend, lowfx, bosses, enemies, foes, patternBosses, npcs, liveTargets, emit, on, modalOpen, closeAllModals, teleport, mode, ZONES, where, input, vehicles, VEHICLES, sim, regions: regionsApi, ensureRegion, travelApi, ...api };
  try { initPageLink(api); } catch (err) { console.warn('[pagelink] failed to start:', err); }
  // ?region=<id>: jump straight into a region (for region authors); implies play
  const startRegion = q.get('region');
  if (startRegion) setTimeout(() => { enterPlay({ dive: false }); travelApi.travel(startRegion, null, { instant: true }); }, 300);
  return api;
}

/** The Scripps pier is walkable: a deck grid over the sea, with a step up from the sand and the hut blocked. */
function addPierDeck(world) {
  const P = LAYOUT.pier;
  const base = world.hub.height(P.x, P.z);
  const deck = base + 1.5;                 // stage.js puts the deck 1.5 above the sand (top at base + 2)
  const L = 18;
  world.addGrid({
    id: 'pier', region: 'hub', x0: P.x - 1.5, x1: P.x + L + 5.5, z0: P.z - 3.5, z1: P.z + 3.5,
    height(x, z) {
      const xi = Math.round(x), zi = Math.round(z), u = xi - P.x, v = zi - P.z;
      if (u === -1 && Math.abs(v) <= 1) return base + 0.75;          // a step onto the planks
      if (u >= 0 && u < L && Math.abs(v) <= 2) return deck;          // the walkway (rails at |v| = 2 are solid)
      if (u >= L && u < L + 6 && Math.abs(v) <= 3) return deck;      // the end platform
      return -Infinity;
    },
    isBlocked(x, z) {
      const u = Math.round(x) - P.x, v = Math.round(z) - P.z;
      if (u >= 0 && u < L && Math.abs(v) === 2) return true;         // the rails
      return u >= L + 1 && u <= L + 4 && Math.abs(v) <= 2;          // the hut
    },
  });
}
