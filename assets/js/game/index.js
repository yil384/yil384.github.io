// Game bootstrap and main loop.
//
// Key rule: the world only advances while no modal is open. Dialogs, the shop, battles, panels,
// mini-games and game-over are all modals, so hostile AI, projectiles, hazards and every timer
// freeze while they are up, and the player gets a short grace window when play resumes.
import { S, save } from './state.js';
import { clock, advance } from './clock.js';
import { on, emit } from './bus.js';
import { initWorld, measure, readView, readScroll, onMeasure, scheduleMeasure } from './world.js';
import * as fx from './fx.js';
import { initModals, modalOpen, modalKey, closeAllModals } from './modal.js';
import {
  player, initPlayer, updatePlayer, placeAtSpawn, placeInView, markAction, grace, revive, render as renderPlayer,
  reward as giveReward,
} from './player.js';
import {
  playerAttack, castSpell, updateProjectiles, clearHostileProjectiles, clearAllProjectiles, liveTargets,
} from './combat.js';
import { initEnemies, updateEnemies, enemies } from './enemies.js';
import { initBosses, updateBosses, clearBossHazards, bosses } from './bosses.js';
import { initNpcs, updateNpcs, nearestNpc, talk, npcs } from './npcs.js';
import { initLoot, updateLoot, coinMarkers } from './loot.js';
import { initMonsters, updateGrass, cycleActive, renderHub } from './monsters.js';
import { initCompanion, updateCompanion, placeBuddy, signature, refreshBuddy } from './companion.js';
import {
  initProgress, initSecret, updateSecret, interactDoor, door, nearChest, openChest, recordRun, achievementCount, ACHIEVEMENTS,
} from './progress.js';
import { initHud, updateHud, setMinimapSource, showZone, flashSlot } from './hud.js';
import { openAchievements, openInventory, openParty, openHelp, openGameOver } from './panels.js';
import { toast, banner } from './notify.js';
import { sfx, setSound, startMusic, stopMusic } from './audio.js';
import { setWeatherActive } from '../sky.js';
import { isEditable, h, fmt, $, $$ } from './util.js';

const root = document.documentElement;
const playQuery = window.matchMedia('(min-width: 900px) and (pointer: fine)');
const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const keys = new Set();

let built = false;
let running = false;
let raf = 0;
let lastFrame = 0;
let coach = null;

export const canPlay = () => playQuery.matches;

// ---------------------------------------------------------------- public entry
export function initGame() {
  initWorld();
  fx.initFx();
  initModals();

  for (const b of $$('[data-set-mode]')) b.addEventListener('click', () => setMode(b.dataset.setMode));
  const soundBtn = $('#sound-btn');
  const paintSound = () => {
    soundBtn.querySelector('span').textContent = S.settings.sound ? '🔊' : '🔇';
    soundBtn.setAttribute('aria-pressed', String(S.settings.sound));
  };
  soundBtn?.addEventListener('click', () => { setSound(!S.settings.sound); paintSound(); });
  if (soundBtn) paintSound();

  playQuery.addEventListener('change', () => {
    root.dataset.canPlay = canPlay() ? 'yes' : 'no';
    applyMode();
  });
  applyMode();
}

export function setMode(mode) {
  if (mode === 'play' && !canPlay()) return;
  S.settings.mode = mode;
  save();
  applyMode();
  if (mode === 'play') toast('Play mode on. Enemies stay calm until you move, attack or cast.', { icon: '🎮' });
  else toast('Reading mode: the game layer is hidden.', { icon: '📖' });
}

function applyMode() {
  const mode = canPlay() ? S.settings.mode : 'read';
  root.dataset.mode = mode;
  if (mode === 'play') start();
  else stop();
}

// ---------------------------------------------------------------- lifecycle
function build() {
  if (built) return;
  built = true;
  measure();
  initPlayer();
  initEnemies();
  initBosses();
  initLoot();
  initMonsters();
  initNpcs();
  initCompanion();
  initSecret();
  initProgress();
  initHud({
    attack: () => doAttack(),
    spell: (id) => doSpell(id),
    signature: () => doSignature(),
    swap: () => cycleActive(),
    achievements: openAchievements,
    inventory: openInventory,
    party: openParty,
    help: () => openHelp({ onReadMode: () => setMode('read') }),
  });
  setMinimapSource(minimapData);
  wireEvents();
  wireInput();
  wireZones();
  setInterval(updateFooter, 2000);
}

function start() {
  if (running) return;
  build();
  running = true;
  measure();
  if (!player.placed) placeAtSpawn();
  else placeInView();
  placeBuddy();
  refreshBuddy();
  renderHub();
  setWeatherActive(true);
  if (S.settings.music) startMusic();
  lastFrame = performance.now();
  raf = requestAnimationFrame(frame);
  if (!S.settings.tutorial) showCoach();
  updateFooter();
}

function stop() {
  if (!running) {
    setWeatherActive(false);
    return;
  }
  running = false;
  cancelAnimationFrame(raf);
  closeAllModals();
  keys.clear();
  clearHostileProjectiles();
  clearAllProjectiles();
  clearBossHazards();
  stopMusic();
  setWeatherActive(false);
  coach?.remove();
  coach = null;
  scheduleMeasure();
}

function frame(now) {
  if (!running) return;
  const ms = Math.min(50, now - lastFrame);
  lastFrame = now;
  readScroll();
  if (!modalOpen() && !document.hidden) {
    advance(ms);
    const dt = clock.dt;
    updatePlayer(dt, keys);
    updateCompanion(dt);
    updateEnemies(dt);
    updateBosses(dt);
    updateProjectiles(dt);
    updateLoot(dt);
    updateNpcs();
    updateSecret();
    updateGrass();
    S.stats.playMs += ms;
  } else {
    renderPlayer();
  }
  updateHud();
  raf = requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- actions
function doAttack() {
  if (modalOpen()) return;
  playerAttack();
}

function doSpell(id) {
  if (modalOpen()) return;
  if (!castSpell(id)) flashSlot(id);
}

function doSignature() {
  if (modalOpen()) return;
  if (!signature()) flashSlot('sig');
}

function interact() {
  const npc = nearestNpc(90);
  if (npc) { talk(npc); return; }
  if (door.sp && interactDoor()) return;
  if (nearChest()) { openChest(); return; }
  toast('Nothing to interact with here. Walk up to an NPC (look for the name tag).', { icon: '💬' });
}

// ---------------------------------------------------------------- input
function wireInput() {
  document.addEventListener('keydown', (e) => {
    if (!running) return;
    if (modalOpen()) {
      if (modalKey(e)) e.preventDefault();
      return;
    }
    if (isEditable(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    // Let keyboard users activate focused buttons/links normally.
    if ((k === ' ' || k === 'Enter') && e.target instanceof Element && e.target.closest('button, a, summary, [role="button"]')) return;
    if (ARROWS.has(k)) {
      e.preventDefault();
      keys.add(k);
      markAction();
      return;
    }
    if (k === ' ') { e.preventDefault(); doAttack(); return; }
    switch (k.toLowerCase()) {
      case 'q': doSpell('fireball'); break;
      case 'w': doSpell('heal'); break;
      case 'e': doSpell('lightning'); break;
      case 'r': doSpell('meteor'); break;
      case 'g': doSignature(); break;
      case 't': cycleActive(); break;
      case 'f': interact(); break;
      case '?': openHelp({ onReadMode: () => setMode('read') }); break;
      default: return;
    }
    e.preventDefault();
  });
  document.addEventListener('keyup', (e) => keys.delete(e.key));
  window.addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', () => keys.clear());

  const NO_MOVE = 'a, button, input, textarea, select, label, summary, img, [role="button"], .topbar, #hud, #modal-root, #toasts, #splash, .npc, .door, .drop, .coach';
  const moveTo = (e) => {
    if (!running || modalOpen() || player.dead) return false;
    if (!(e.target instanceof Element) || e.target.closest(NO_MOVE)) return false;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return false;
    player.target = { x: e.pageX, y: e.pageY };
    markAction();
    fx.ring(e.pageX, e.pageY, '#4ade80', 26, 'fx-ring--target');
    return true;
  };
  document.addEventListener('click', (e) => { if (e.button === 0) moveTo(e); });
  document.addEventListener('contextmenu', (e) => { if (moveTo(e)) e.preventDefault(); });
}

// ---------------------------------------------------------------- events
function wireEvents() {
  on('pause', (paused) => {
    keys.clear();
    if (paused) {
      player.target = null;
      clearHostileProjectiles();
      clearBossHazards();
    } else {
      grace(1200);
    }
  });

  on('kill', ({ target }) => {
    if (!target.boss) {
      S.stats.kills++;
      reward(target);
    }
  });

  on('player:dead', ({ source }) => {
    sfx('error');
    recordRun();
    openGameOver({ stats: { cause: source }, onRespawn: respawn });
  });

  on('levelup', ({ level }) => banner(`Level ${level}!`, 'HP and MP fully restored.', '⭐'));

  on('boss:defeated', ({ name, round, rune }) => {
    if (!rune) toast(`${name} Lv.${round} defeated! It will return stronger.`, { icon: '🏆', tone: 'gold' });
    if (name === 'Dragon King' && !S.trainer.captured.charmander) {
      setTimeout(() => toast('Charmander in Education wants to talk to you…', { icon: '🔥' }), 3500);
    }
  });
  on('boss:returned', ({ name, round }) => toast(`${name} Lv.${round} has returned!`, { icon: '⚠️' }));
  on('spell:nomp', () => toast('Not enough MP.', { icon: '🔷' }));
}

/** Field enemy kill rewards (bosses pay out in bosses.js). */
function reward(target) {
  if (target.kind) giveReward({ gold: target.kind.gold, xp: target.kind.xp });
}

function respawn() {
  S.player.gold = Math.floor(S.player.gold * 0.9);
  S.stats.deaths++;
  revive();
  clearAllProjectiles();
  clearBossHazards();
  window.scrollTo(0, 0);
  readView();
  placeAtSpawn();
  placeBuddy();
  save();
  emit('respawn');
  toast('Back on your feet in the Profile Hall.', { icon: '💫' });
}

// ---------------------------------------------------------------- zones, footer, minimap
function wireZones() {
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting && running) showZone(en.target.dataset.zone);
    }
  }, { threshold: 0, rootMargin: '-45% 0px -50% 0px' });
  $$('section[data-zone]').forEach((s) => io.observe(s));
}

function updateFooter() {
  const el = $('#footer-stats');
  if (!el || !built) return;
  el.textContent = `Adventure: Lv.${S.player.level} · score ${fmt(S.player.score)} · ${S.stats.kills} foes cleared · ${achievementCount()}/${ACHIEVEMENTS.length} achievements`;
}

let sectionCache = null;
onMeasure(() => { sectionCache = null; });

function minimapData() {
  if (!sectionCache) {
    sectionCache = $$('main > section').filter((s) => s.offsetParent !== null).map((s) => ({
      y: s.offsetTop, h: s.offsetHeight, boss: s.classList.contains('arena'),
    }));
  }
  return {
    sections: sectionCache,
    coins: coinMarkers(),
    npcs: npcs.filter((n) => n.sp.active).map((n) => n.sp),
    enemies: enemies.filter((e) => e.alive && e.active),
    bosses: Object.values(bosses).filter((b) => b.alive && b.active),
    door: door.sp?.active ? { x: door.sp.x, y: door.sp.y, ready: Object.values(S.runes).every(Boolean) } : null,
  };
}

// ---------------------------------------------------------------- first-run coachmark
function showCoach() {
  coach = h('div', { class: 'coach', role: 'dialog', 'aria-label': 'How to play' },
    h('p', { class: 'coach__title' }, 'Play mode'),
    h('p', null, 'Arrows or click to move · ', h('kbd', null, 'Space'), ' attack · ', h('kbd', null, 'Q'), h('kbd', null, 'W'), h('kbd', null, 'E'), h('kbd', null, 'R'), ' spells · ', h('kbd', null, 'F'), ' talk · ', h('kbd', null, 'G'), ' buddy move'),
    h('p', { class: 'muted small' }, 'Your buddy Eevee fights beside you. Enemies stay calm while you just read.'),
    h('div', { class: 'coach__actions' },
      h('button', { type: 'button', class: 'btn btn--small btn--primary', onclick: () => dismissCoach() }, 'Got it'),
      h('button', { type: 'button', class: 'btn btn--small', onclick: () => { dismissCoach(); setMode('read'); } }, 'Just read'),
    ),
  );
  document.body.append(coach);
  requestAnimationFrame(() => coach?.classList.add('is-in'));
}

function dismissCoach() {
  S.settings.tutorial = true;
  save();
  coach?.remove();
  coach = null;
}

// Expose a tiny debug hook for manual testing in the console.
window.__game = { S, player, clock, liveTargets, bosses, enemies, npcs, door, setMode, emit, on, modalOpen, measure };
