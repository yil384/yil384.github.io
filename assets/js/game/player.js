// The player character: stats, movement, camera follow, damage and progression.
import { S, save } from './state.js';
import { clock } from './clock.js';
import { emit } from './bus.js';
import { view, spawnOf } from './world.js';
import { ITEMS, SPECIES, RARITY_COLOR } from './data.js';
import { applySprite } from './sprites.js';
import { clamp, h } from './util.js';
import * as fx from './fx.js';
import { sfx } from './audio.js';
import { modalOpen } from './modal.js';

const BASE_SPEED = 230;          // px / s
const ENGAGE_MS = 12000;         // hostiles only fight a player who is actively playing
const HIT_IFRAMES = 450;         // brief invulnerability after each hit
const MARGIN_TOP = 36;           // below the top bar
const MARGIN_BOTTOM = 96;        // above the action bar

export const player = {
  x: 0, y: 0,
  hp: 100, mp: 100,
  facing: 1,
  walking: false,
  target: null,                 // click-to-move target { x, y, onArrive }
  invulnUntil: 0,
  lastHitAt: -1e9,
  lastActionAt: -1e9,
  powerUntil: 0,
  shield: 0,
  dead: false,
  el: null,
  mountEl: null,
  placed: false,
};

// ---------------------------------------------------------------- stats
export function equipped(slot) { return ITEMS[S.equipment[slot]] || null; }

export function gearStats() {
  const out = { atk: 0, spell: 0, def: 0, regen: 0 };
  for (const id of Object.values(S.equipment)) {
    const it = ITEMS[id];
    if (!it) continue;
    out.atk += it.atk || 0;
    out.spell += it.spell || 0;
    out.def += it.def || 0;
    out.regen += it.regen || 0;
  }
  return out;
}

export const level = () => S.player.level;
export const maxHp = () => 100 + (S.player.level - 1) * 6 + S.player.bonusHp;
export const maxMp = () => 100 + (S.player.level - 1) * 4 + S.player.bonusMp;
export const xpNeeded = (lv = S.player.level) => lv * 50;
export const attackRange = () => Math.min(56 + S.player.level * 8, 190);
export const powered = () => clock.t < player.powerUntil;

export function attackPower() {
  const base = 10 + Math.floor(S.player.level * 0.8) + gearStats().atk;
  return powered() ? base * 2 : base;
}
export function spellBonus() {
  return gearStats().spell + Math.floor(S.player.level * 0.5);
}

export function engaged() { return clock.t - player.lastActionAt < ENGAGE_MS; }
export function markAction() { player.lastActionAt = clock.t; }

export function mountSpecies() {
  const id = S.trainer.mount;
  return id && SPECIES[id]?.mount && S.trainer.captured[id] ? id : null;
}

// ---------------------------------------------------------------- setup
export function initPlayer() {
  const layer = document.getElementById('world');
  player.mountEl = h('div', { class: 'mount' });
  player.el = h('div', { class: 'ent player' }, h('div', { class: 'ent__shadow' }), h('div', { class: 'player__body' }));
  layer.append(player.mountEl, player.el);
  player.hp = maxHp();
  player.mp = maxMp();
  refreshLook();
}

/** Robe/hat colours follow the equipped armour/weapon rarity. */
export function refreshLook() {
  const w = equipped('weapon');
  const a = equipped('armor');
  const hat = w ? RARITY_COLOR[w.rarity] : '#8b93ff';
  const robe = a ? RARITY_COLOR[a.rarity] : '#3b82f6';
  applySprite(player.el.querySelector('.player__body'), 'player', 3, {
    H: hat, h: shade(hat, -0.3), B: robe, b: shade(robe, -0.3),
  });
  const m = mountSpecies();
  player.mountEl.classList.toggle('is-on', !!m);
  if (m) applySprite(player.mountEl, m, 3);
  lastRender = '';
  render();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => clamp(Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt)), 0, 255);
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function placeAtSpawn() {
  const sp = spawnOf('player');
  if (sp && sp.active) placeAt(sp.x, sp.y);
  else placeAt(view.vw / 2, view.sy + view.vh * 0.7);
}

export function placeAt(x, y) {
  player.x = x;
  player.y = y;
  player.target = null;
  player.placed = true;
  render();
}

/** Keep the player inside the visible viewport (used after fast travel / mode switches). */
export function placeInView() {
  const minY = view.sy + view.top + MARGIN_TOP + 20;
  const maxY = view.sy + view.vh - MARGIN_BOTTOM;
  if (player.y < minY || player.y > maxY) placeAt(clamp(player.x, 40, view.vw - 40), view.sy + view.vh * 0.62);
}

// ---------------------------------------------------------------- per-frame
export function updatePlayer(dt, keys) {
  if (player.dead) return;
  let dx = 0, dy = 0;
  if (keys.has('ArrowLeft')) dx -= 1;
  if (keys.has('ArrowRight')) dx += 1;
  if (keys.has('ArrowUp')) dy -= 1;
  if (keys.has('ArrowDown')) dy += 1;

  const m = mountSpecies();
  const speed = BASE_SPEED + (m ? SPECIES[m].mount.bonus * 55 : 0);
  let moved = false;
  let steeredY = 0;

  if (dx || dy) {
    player.target = null;
    const len = Math.hypot(dx, dy);
    player.x += (dx / len) * speed * dt;
    player.y += (dy / len) * speed * dt;
    steeredY = dy;
    moved = true;
    markAction();
  } else if (player.target) {
    const tx = player.target.x - player.x;
    const ty = player.target.y - player.y;
    const d = Math.hypot(tx, ty);
    const reach = player.target.reach || 4;
    if (d <= Math.max(reach, speed * dt)) {
      if (!player.target.reach) { player.x = player.target.x; player.y = player.target.y; }
      const cb = player.target.onArrive;
      player.target = null;
      cb?.();
    } else {
      player.x += (tx / d) * speed * dt;
      player.y += (ty / d) * speed * dt;
      steeredY = Math.sign(ty);
      moved = true;
    }
  }
  if (dx) player.facing = dx;
  else if (player.target) player.facing = Math.sign(player.target.x - player.x) || player.facing;

  // Camera: walking into the viewport edge scrolls the page; scrolling the page drags the player along.
  const topEdge = view.sy + view.top + MARGIN_TOP;
  const botEdge = view.sy + view.vh - MARGIN_BOTTOM;
  if (player.y < topEdge) {
    if (moved && steeredY < 0 && view.sy > 0) window.scrollTo(view.sx, Math.max(0, player.y - view.top - MARGIN_TOP));
    else player.y = topEdge;
  } else if (player.y > botEdge) {
    const maxScroll = view.dh - view.vh;
    if (moved && steeredY > 0 && view.sy < maxScroll) window.scrollTo(view.sx, Math.min(maxScroll, player.y - view.vh + MARGIN_BOTTOM));
    else player.y = botEdge;
  }
  player.x = clamp(player.x, 16, view.vw - 16);
  player.y = clamp(player.y, view.top + 20, view.dh - 30);

  player.walking = moved;

  // Regeneration: MP always, HP once out of combat for a few seconds.
  const g = gearStats();
  player.mp = Math.min(maxMp(), player.mp + (1.5 + g.regen) * dt);
  if (clock.t - player.lastHitAt > 6000) player.hp = Math.min(maxHp(), player.hp + 3 * dt);

  render();
}

let lastRender = '';
export function render() {
  if (!player.el) return;
  const flicker = clock.t < player.invulnUntil && Math.floor(clock.t / 90) % 2 === 0;
  const mounted = player.mountEl.classList.contains('is-on');
  const key = `${player.x | 0},${player.y | 0},${player.facing},${player.walking},${flicker},${player.shield > 0},${powered()},${mounted}`;
  if (key === lastRender) return;
  lastRender = key;
  player.el.style.transform = `translate3d(${player.x}px, ${player.y}px, 0)`;
  player.el.classList.toggle('is-walking', player.walking);
  player.el.classList.toggle('is-left', player.facing < 0);
  player.el.classList.toggle('is-flicker', flicker);
  player.el.classList.toggle('has-shield', player.shield > 0);
  player.el.classList.toggle('is-powered', powered());
  player.el.classList.toggle('is-mounted', mounted);
  if (mounted) {
    player.mountEl.style.transform = `translate3d(${player.x}px, ${player.y}px, 0) scaleX(${player.facing < 0 ? -1 : 1})`;
  }
}

// ---------------------------------------------------------------- combat hooks
/** Damage the player. Returns true if damage landed. */
export function hurt(amount, source = '') {
  if (player.dead || clock.t < player.invulnUntil || modalOpen()) return false;
  if (player.shield > 0) {
    player.shield--;
    player.invulnUntil = clock.t + HIT_IFRAMES;
    fx.text(player.x, player.y - 46, 'BLOCK', 'block');
    sfx('block');
    return false;
  }
  const dmg = Math.max(1, Math.round(amount - gearStats().def));
  player.hp = Math.max(0, player.hp - dmg);
  player.lastHitAt = clock.t;
  player.invulnUntil = clock.t + HIT_IFRAMES;
  fx.text(player.x, player.y - 46, `-${dmg}`, 'hurt');
  fx.flash('rgba(248,113,113,0.16)');
  sfx('hurt');
  emit('player:hurt', { dmg, source });
  if (player.hp <= 0) {
    player.dead = true;
    player.target = null;
    emit('player:dead', { source });
  }
  return true;
}

/** Short invulnerability window (used when the world resumes after a modal). */
export function grace(ms = 1200) {
  player.invulnUntil = Math.max(player.invulnUntil, clock.t + ms);
}

export function heal(n, silent = false) {
  const before = player.hp;
  player.hp = Math.min(maxHp(), player.hp + n);
  const got = Math.round(player.hp - before);
  if (!silent && got > 0) fx.text(player.x, player.y - 46, `+${got} HP`, 'heal');
  return got;
}

export function restoreMp(n, silent = false) {
  const before = player.mp;
  player.mp = Math.min(maxMp(), player.mp + n);
  const got = Math.round(player.mp - before);
  if (!silent && got > 0) fx.text(player.x, player.y - 46, `+${got} MP`, 'mp');
  return got;
}

export function fullRestore() {
  player.hp = maxHp();
  player.mp = maxMp();
}

export function gainXp(n) {
  if (n <= 0 || S.player.level >= 99) return;
  S.player.xp += Math.round(n);
  let leveled = false;
  while (S.player.level < 99 && S.player.xp >= xpNeeded()) {
    S.player.xp -= xpNeeded();
    S.player.level++;
    leveled = true;
  }
  if (leveled) {
    fullRestore();
    sfx('levelup');
    fx.ring(player.x, player.y - 20, '#f5c542', 120);
    fx.burst(player.x, player.y - 20, '#fde68a', 16, 70);
    emit('levelup', { level: S.player.level });
  }
  save();
}

/** Grant a bundle of rewards: { gold, xp, score }. Score never decreases; gold is spendable. */
export function reward({ gold = 0, xp = 0, score = gold } = {}) {
  if (gold) S.player.gold += Math.round(gold);
  if (score) S.player.score += Math.round(score);
  if (xp) gainXp(xp);
  save();
  emit('reward', { gold, xp, score });
}

export function spendGold(n) {
  if (S.player.gold < n) return false;
  S.player.gold -= n;
  save();
  return true;
}

export function revive() {
  player.dead = false;
  fullRestore();
  player.invulnUntil = clock.t + 2500;
  player.powerUntil = 0;
  player.shield = 0;
}
