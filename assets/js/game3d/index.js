// The island, playable. Opens as a full-screen overlay above the page; Esc returns to the page.
//
// Key rule: the world only advances while no modal is open. Dialogs, the shop, battles, panels,
// mini-games and game-over are all modals, so hostile AI, projectiles, hazards and every timer
// freeze while they are up, and the player gets a short grace window when play resumes.
import * as THREE from 'three/webgpu';
import { pass, mrt, output, emissive } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { createRobustRenderer, runLoop, probeGPU } from '../three/boot.js';
import { S, save } from './state.js';
import { clock, advance } from './clock.js';
import { on, emit } from './bus.js';
import { buildWorld, ZONES } from './world.js';
import { createCamera } from './camera.js';
import { createInput } from './input.js';
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

export async function createGame({ root, heroCtl } = {}) {
  // Software rasterisers (and ?lowfx=1) skip shadows and bloom.
  const probe = probeGPU();
  const lowfx = probe.software || new URLSearchParams(location.search).get('lowfx') === '1';
  root.innerHTML = '';
  const overlay = h('div', { class: 'g', hidden: true });
  let canvas = h('canvas', { class: 'g__canvas', 'aria-label': 'The island' });
  const hudEl = h('div', { class: 'g__hud' });
  const modalsEl = h('div', { class: 'g__modals' });
  overlay.append(canvas, hudEl, modalsEl);
  root.append(overlay);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.FogExp2(BG, 0.012);
  scene.add(new THREE.HemisphereLight('#c7d2fe', '#0b1024', 1.0));
  const sun = new THREE.DirectionalLight('#ffe7c2', 2.2);
  sun.position.set(-30, 46, 24);
  sun.castShadow = !lowfx;
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 140 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  const world = buildWorld(7);
  scene.add(world.group);
  const camera = createCamera();
  const input = createInput(overlay);

  // ---- systems ----
  fx.initFx({ scene, camera: camera.cam, root: overlay });
  overlay.insertBefore(overlay.querySelector('.g__fx'), hudEl); // labels sit under the HUD
  initModals(modalsEl);
  initNotify(hudEl);
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
    help: () => openHelp({ onLeave: close }), leave: () => close(),
  }, { world, markers: minimapData });

  // ---- renderer ----
  let pipeline;
  function build(r) {
    r.toneMapping = THREE.NeutralToneMapping;
    r.shadowMap.enabled = !lowfx;
    r.shadowMap.type = THREE.PCFShadowMap;
    const p = new THREE.RenderPipeline(r);
    const sp = pass(scene, camera.cam);
    if (lowfx) { p.outputNode = sp; return p; }
    sp.setMRT(mrt({ output, emissive }));
    p.outputNode = sp.getTextureNode('output').add(bloom(sp.getTextureNode('emissive'), 0.9, 0.5, 0));
    return p;
  }
  function resize(r) {
    const w = overlay.clientWidth || window.innerWidth;
    const hh = overlay.clientHeight || window.innerHeight;
    camera.cam.aspect = w / hh;
    camera.cam.updateProjectionMatrix();
    r.setSize(w, hh, false);
  }
  const { renderer, backend } = await createRobustRenderer(
    () => {
      const c = h('canvas', { class: 'g__canvas', 'aria-label': 'The island' });
      canvas.replaceWith(c);
      canvas = c;
      return c;
    },
    async (r) => {
      overlay.hidden = false;
      resize(r);
      placeActors(0);
      camera.snap(player);
      await r.compileAsync(scene, camera.cam);
      pipeline = build(r);
      pipeline.render();
      overlay.hidden = true;
    },
    { maxDpr: 1.5, antialias: false, alpha: false },
  );

  // ---- movement ----
  function move(dt) {
    const v = input.axis();
    let moved = false;
    if (v.x || v.y) {
      const yaw = camera.yaw;
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
    camera.snap(player);
    grace(1500);
  }
  onTravel(teleport);

  // ---- loop ----
  let open = false;
  function frame(dt) {
    if (!open) return;
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
    placeActors(dt);
    camera.update(player, input, dt);
    const sh = fx.shakeOffset();
    if (sh) { camera.cam.position.x += (Math.random() - 0.5) * sh; camera.cam.position.y += (Math.random() - 0.5) * sh; }
    fx.updateFx(modalOpen() ? 0 : dt);
    updateHud();
    pipeline.render();
  }
  const loop = runLoop(renderer, frame);
  loop.setEnabled(false);
  const onResize = () => resize(renderer);

  // ---- actions ----
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
      case '?': openHelp({ onLeave: close }); return true;
      default: return false;
    }
  };
  input.onEscape = () => { if (!modalOpen()) close(); };
  overlay.addEventListener('click', (e) => {
    const plate = e.target.closest('.g__plate');
    if (!plate || modalOpen()) return;
    const npc = npcs.find((n) => n.plate === plate);
    if (npc && Math.hypot(player.x - npc.x, player.z - npc.z) < 6) talk(npc);
  });

  // ---- events ----
  on('pause', (paused) => {
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
    if (name === 'Dragon King' && !S.trainer.captured.tidefin) setTimeout(() => toast('Fern in the meadow has news for you.', { icon: 'conversation' }), 3500);
  });
  on('boss:returned', ({ name, round }) => toast(`${name} Lv.${round} has returned.`, { icon: 'triangle-alert' }));
  on('spell:nomp', () => toast('Not enough MP.', { icon: 'crystal-shine' }));
  on('buddy:changed', () => placeBuddy());

  function showGameOver() {
    if (!open || !player.dead || isModalOpen('gameover')) return;
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

  // ---- first-run coach ----
  let coach = null;
  function showCoach() {
    coach = h('div', { class: 'g__coach', role: 'dialog', 'aria-label': 'How to play' },
      h('p', { class: 'g__coach-title' }, 'Welcome to the island'),
      h('p', null, h('kbd', null, 'W'), h('kbd', null, 'A'), h('kbd', null, 'S'), h('kbd', null, 'D'), ' move · ', h('kbd', null, 'Space'), ' attack · ', h('kbd', null, '1'), '–', h('kbd', null, '4'), ' spells · ', h('kbd', null, 'E'), ' talk · ', h('kbd', null, 'G'), ' companion move'),
      h('p', { class: 'muted small' }, 'Bit follows you and fights on its own. Talk to the islanders at the plaza first; the tall grass hides more companions.'),
      h('button', { type: 'button', class: 'btn btn--small btn--primary', onclick: () => { S.settings.tutorial = true; save(); coach.remove(); coach = null; } }, 'Got it'),
    );
    hudEl.append(coach);
  }

  // ---- open / close ----
  function openGame() {
    if (open) return;
    open = true;
    overlay.hidden = false;
    document.documentElement.classList.add('g-open');
    heroCtl?.pause();
    resize(renderer);
    window.addEventListener('resize', onResize);
    input.attach();
    loop.setEnabled(true);
    grace(1500);
    if (S.settings.music) startMusic();
    if (!S.settings.tutorial && !coach) showCoach();
    if (player.dead) queueMicrotask(showGameOver);
    overlay.focus?.();
  }
  function close() {
    if (!open) return;
    open = false;
    closeAllModals();
    loop.setEnabled(false);
    input.detach();
    stopMusic();
    window.removeEventListener('resize', onResize);
    overlay.hidden = true;
    document.documentElement.classList.remove('g-open');
    heroCtl?.resume();
    save();
  }

  window.__g = { S, player, buddy, clock, world, camera, scene, renderer, backend, lowfx, loop, bosses, enemies, npcs, liveTargets, emit, on, modalOpen, teleport, open: openGame, close, ZONES };
  return { open: openGame, close, get isOpen() { return open; } };
}
