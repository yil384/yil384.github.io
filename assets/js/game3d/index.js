// The island, always on. It renders full-viewport behind the page ("tour": the camera follows the
// page's scroll, the scholar walks between landmarks, everything is harmless). W/A/S/D or the Play
// button hands the reader the controls ("play": the full game, including combat and encounters).
//
// Key rule of play mode: the world only advances while no modal is open. Dialogs, the shop,
// battles, panels, mini-games and game-over are all modals, so hostile AI, projectiles, hazards
// and every timer freeze while they are up, and the player gets a short grace window afterwards.
import * as THREE from 'three/webgpu';
import { pass, mrt, output, emissive } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { createRobustRenderer, probeGPU, reducedMotion } from '../three/boot.js';
import { S, save } from './state.js';
import { clock, advance } from './clock.js';
import { on, emit } from './bus.js';
import { mode } from './mode.js';
import { buildWorld, ZONES } from './world.js';
import { buildStage } from './stage.js';
import { createCamera } from './camera.js';
import { createInput } from './input.js';
import { createTour } from './tour.js';
import { createDirector } from './director.js';
import * as fx from './fx.js';
import { initModals, modalOpen, modalKey, closeAllModals, isModalOpen } from './modal.js';
import { initNotify, toast, banner } from './notify.js';
import { player, initPlayer, tickPlayer, moveSpeed, markAction, grace, revive, reward as giveReward } from './player.js';
import { initCombat, playerAttack, castSpell, updateProjectiles, clearHostileProjectiles, clearAllProjectiles, liveTargets } from './combat.js';
import { initEnemies, updateEnemies, enemies } from './enemies.js';
import { initBosses, updateBosses, clearBossHazards, bosses } from './bosses.js';
import { initNpcs, updateNpcs, nearestNpc, talk, npcs, npcMarkers } from './npcs.js';
import { initLoot, updateLoot, tokenMarkers } from './loot.js';
import { initMonsters, updateGrass, cycleActive, onTravel } from './monsters.js';
import { initCompanion, updateCompanion, placeBuddy, signature, buddy } from './companion.js';
import { initProgress, initSecret, updateSecret, interactDoor, nearChest, openChest, recordRun, doorMarker } from './progress.js';
import { initHud, updateHud, flashSlot } from './hud.js';
import { openAchievements, openInventory, openParty, openHelp, openGameOver } from './panels.js';
import { sfx, startMusic, stopMusic } from './audio.js';
import { h } from './util.js';

const BG = '#070a12';
const SPAWN = { x: 1.5, z: 6 };

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

  root.innerHTML = '';
  root.classList.add('g');
  const noticesEl = h('div', { class: 'g__notices' });
  const hudEl = h('div', { class: 'g__hud' });
  const modalsEl = h('div', { class: 'g__modals' });
  root.append(noticesEl, hudEl, modalsEl);
  let canvas = h('canvas', { class: 'g__canvas', 'aria-hidden': 'true' });
  worldEl.append(canvas);

  progress('lighting the island');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.FogExp2(BG, 0.0085);
  const hemi = new THREE.HemisphereLight('#c7d2fe', '#0b1024', 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe7c2', 2.2);
  sun.position.set(-30, 46, 24);
  sun.castShadow = !lowfx;
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 140 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  progress('growing the campus');
  const world = buildWorld(7);
  scene.add(world.group);
  const stage = buildStage(world, scene, { lowfx });
  const rig = createCamera();
  const input = createInput(worldEl);
  const tour = createTour(world);

  // ---- systems ----
  fx.initFx({ scene, camera: rig.cam, root: worldEl });
  initModals(modalsEl);
  initNotify(noticesEl);
  initCombat(scene);
  initPlayer(scene);
  player.x = SPAWN.x; player.z = SPAWN.z; player.y = world.surfaceY(player.x, player.z);
  initEnemies(world, scene, ZONES);
  initBosses(world, scene, ZONES);
  initLoot(world, scene);
  initMonsters(world, scene);
  initNpcs(world, scene);
  initCompanion(scene, world);
  placeBuddy();
  initSecret(world, scene);
  initProgress();
  initHud(hudEl, {
    attack: doAttack, spell: doSpell, signature: doSignature, swap: () => { if (!modalOpen()) cycleActive(); },
    achievements: openAchievements, inventory: openInventory, party: openParty,
    help: () => openHelp({ onLeave: exitPlay }), leave: () => exitPlay(),
  }, { world, markers: minimapData });

  const director = createDirector({
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
    p.outputNode = sp.getTextureNode('output').add(bloom(sp.getTextureNode('emissive'), 0.9, 0.5, 0));
    return p;
  }
  function resize(r) {
    const w = worldEl.clientWidth || window.innerWidth;
    const hh = worldEl.clientHeight || window.innerHeight;
    rig.resize(w, hh);
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
  function shotStand() {
    const s = stage.shots[director.currentKey] || stage.shots.hero;
    return { x: s.stand?.[0] ?? SPAWN.x, z: s.stand?.[1] ?? SPAWN.z, face: s.face ?? 0 };
  }

  // ---- movement (play) ----
  function move(dt) {
    const v = input.axis();
    let moved = false;
    if (v.x || v.y) {
      const yaw = rig.yaw;
      const dx = (v.x * Math.cos(yaw) - v.y * Math.sin(yaw));
      const dz = (v.x * Math.sin(yaw) + v.y * Math.cos(yaw));
      const len = Math.hypot(dx, dz) || 1;
      const sp = moveSpeed();
      const nx = player.x + (dx / len) * sp * dt;
      const nz = player.z + (dz / len) * sp * dt;
      if (canStand(nx, player.z)) player.x = nx;
      if (canStand(player.x, nz)) player.z = nz;
      player.yaw = Math.atan2(dx, dz);
      moved = true;
      markAction();
    }
    player.walking = moved;
    player.t += dt * (moved ? 8 : 2);
  }
  function canStand(x, z) {
    const hh = world.height(x, z);
    if (hh === -Infinity || world.isBlocked(x, z)) return false;
    return Math.abs(hh - world.height(player.x, player.z)) <= 1;
  }
  function placeActors(dt) {
    player.y += ((world.surfaceY(player.x, player.z)) - player.y) * Math.min(1, dt * 14 || 1);
    player.mesh.position.set(player.x, player.y + (player.walking ? Math.abs(Math.sin(player.t)) * 0.25 : 0), player.z);
    player.mesh.rotation.y = player.yaw;
    player.mesh.visible = !player.dead;
    player.mesh.userData.setFrame(player.walking ? Math.floor(player.t / 1.6) % 2 : 0);
  }
  function teleport(x, z) {
    player.x = x; player.z = z; player.y = world.surfaceY(x, z);
    placeBuddy();
    rig.snap(player);
    grace(1500);
  }
  onTravel(teleport);

  // ---- loop ----
  let nearLabels = false;
  let awakeUntil = performance.now() + 2500;   // under reduced motion, render only while something is happening
  let last = performance.now();
  let slow = 0;
  function frame(dt, t) {
    if (mode.play) {
      if (!modalOpen()) {
        advance(dt * 1000);
        move(dt);
        tickPlayer(dt);
        updateCompanion(dt);
        updateEnemies(dt);
        updateBosses(dt);
        updateProjectiles(dt);
        updateLoot(dt);
        updateNpcs(dt);
        updateSecret(dt);
        updateGrass();
        S.stats.playMs += dt * 1000;
      }
      updateHud();
    } else {
      tour.update(dt);
      updateCompanion(dt);
      updateEnemies(dt);
      updateBosses(dt);
      updateLoot(dt);
      updateNpcs(dt);
      director.update(dt);
    }
    stage.update(dt, t);
    placeActors(dt);
    rig.update(player, mode.play ? input : null, dt, t);
    // islander name plates only show when the camera is close enough to read them
    const near = mode.play || rig.cur.dist < 48;
    if (near !== nearLabels) { nearLabels = near; worldEl.classList.toggle('is-near', near); }
    const sh = fx.shakeOffset();
    if (sh) { rig.cam.position.x += (Math.random() - 0.5) * sh; rig.cam.position.y += (Math.random() - 0.5) * sh; }
    fx.updateFx(modalOpen() ? 0 : dt);
    pipeline.render();
  }
  function step() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (reducedMotion.matches && !mode.play) {
      if (performance.now() > awakeUntil && !tour.busy) return;
    }
    // adaptive resolution: a weak GPU trades pixels for smoothness
    if (!fixedDpr && smoked) {
      slow = dt > 0.034 ? slow + 1 : Math.max(0, slow - 2);
      if (slow > 90) {
        slow = 0;
        const pr = renderer.getPixelRatio();
        if (pr > 0.7) { renderer.setPixelRatio(Math.max(0.7, pr * 0.8)); renderer.setSize(worldEl.clientWidth, worldEl.clientHeight, false); }
      }
    }
    frame(dt, now / 1000);
  }
  renderer.setAnimationLoop(step);
  const wake = () => { awakeUntil = performance.now() + 1800; };
  on('progress', wake);
  on('shot', wake);
  window.addEventListener('pointermove', wake, { passive: true });
  window.addEventListener('resize', () => { resize(renderer); wake(); });

  // ---- actions (play) ----
  function doAttack() { if (!modalOpen()) playerAttack(); }
  function doSpell(id) { if (modalOpen()) return; if (!castSpell(id)) flashSlot(id); }
  function doSignature() { if (modalOpen()) return; if (!signature()) flashSlot('sig'); }
  function interact() {
    if (modalOpen() || player.dead) return;
    const npc = nearestNpc(4);
    if (npc) { talk(npc); return; }
    if (interactDoor()) return;
    if (nearChest()) { openChest(); return; }
    toast('Nothing to interact with here. Walk up to an islander.', { icon: 'conversation' });
  }
  input.onKey = (key, e) => {
    if (modalOpen()) { if (modalKey(e)) return true; return key !== 'Escape'; }
    switch (key) {
      case ' ': doAttack(); return true;
      case '1': doSpell('fireball'); return true;
      case '2': doSpell('heal'); return true;
      case '3': doSpell('lightning'); return true;
      case '4': doSpell('meteor'); return true;
      case 'g': case 'G': doSignature(); return true;
      case 't': case 'T': cycleActive(); return true;
      case 'e': case 'E': interact(); return true;
      case '?': openHelp({ onLeave: exitPlay }); return true;
      default: return false;
    }
  };
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
    if (paused) { clearHostileProjectiles(); clearBossHazards(); }
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
  on('boss:defeated', ({ name, round, rune }) => {
    if (!rune) toast(`${name} Lv.${round} defeated. It will return stronger.`, { icon: 'trophy', tone: 'gold' });
    if (name === 'Deadline Dragon' && !S.trainer.captured.tidefin) setTimeout(() => toast('Fern on the lawn has news for you.', { icon: 'conversation' }), 3500);
  });
  on('boss:returned', ({ name, round }) => toast(`${name} Lv.${round} has returned.`, { icon: 'triangle-alert' }));
  on('spell:nomp', () => toast('Not enough MP.', { icon: 'crystal-shine' }));
  on('buddy:changed', () => placeBuddy());

  function showGameOver() {
    if (!mode.play || !player.dead || isModalOpen('gameover')) return;
    openGameOver({ stats: { cause: lastDeathCause }, onRespawn: respawn });
  }
  function respawn() {
    S.player.gold = Math.floor(S.player.gold * 0.9);
    S.stats.deaths++;
    revive();
    clearAllProjectiles();
    clearBossHazards();
    teleport(SPAWN.x, SPAWN.z);
    save();
    emit('respawn');
    toast('Back on your feet at the plaza.', { icon: 'heart-plus' });
  }
  function minimapData() {
    return {
      tokens: tokenMarkers(),
      npcs: npcMarkers(),
      enemies: enemies.filter((e) => e.alive),
      bosses: Object.values(bosses).filter((b) => b.alive),
      door: doorMarker(),
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
    coach = h('div', { class: 'g__coach', role: 'dialog', 'aria-label': 'How to play' },
      h('p', { class: 'g__coach-title' }, 'You have the controls'),
      h('p', null, h('kbd', null, 'W'), h('kbd', null, 'A'), h('kbd', null, 'S'), h('kbd', null, 'D'), ' move · ', h('kbd', null, 'Space'), ' attack · ', h('kbd', null, '1'), '–', h('kbd', null, '4'), ' spells · ', h('kbd', null, 'E'), ' talk · ', h('kbd', null, 'G'), ' companion move · ', h('kbd', null, 'Esc'), ' back to the page'),
      h('p', { class: 'muted small' }, 'Bit follows you and fights on its own. Talk to the islanders first; the tall grass hides more companions.'),
      h('button', { type: 'button', class: 'btn btn--small btn--primary', onclick: () => { S.settings.tutorial = true; save(); coach.remove(); coach = null; } }, 'Got it'),
    );
    hudEl.append(coach);
  }

  // ---- modes ----
  function enterPlay() {
    if (mode.play) return;
    mode.play = true;
    document.documentElement.classList.add('is-play');
    director.setEnabled(false);
    tour.stand(player.x, player.z, null, { instant: true });
    input.attach();
    rig.setPlay(true, player);
    if (!S.settings.soundTouched) { S.settings.sound = true; }
    grace(1500);
    if (S.settings.music) startMusic();
    if (!S.settings.tutorial && !coach) showCoach();
    if (player.dead) queueMicrotask(showGameOver);
    placeBuddy();
    emit('mode', 'play');
    worldEl.focus?.();
  }
  function exitPlay() {
    if (!mode.play) return;
    closeAllModals();
    input.detach();
    stopMusic();
    clearAllProjectiles();
    clearBossHazards();
    if (player.dead) revive();
    mode.play = false;
    document.documentElement.classList.remove('is-play');
    rig.setPlay(false);
    director.setEnabled(true);
    director.retarget();
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

  const api = {
    world, stage, director, rig, tour, renderer, backend, lowfx, scene,
    enterPlay, exitPlay,
    get playing() { return mode.play; },
    say: (who, text, ms) => director.say(who, text, ms),
    talk, npcs, player, buddy, fx, toast, banner,
    invalidate: wake,
    dispose() { renderer.setAnimationLoop(null); },
  };
  window.__g = { S, player, buddy, clock, world, stage, rig, director, scene, renderer, backend, lowfx, bosses, enemies, npcs, liveTargets, emit, on, modalOpen, teleport, mode, ZONES, ...api };
  return api;
}
