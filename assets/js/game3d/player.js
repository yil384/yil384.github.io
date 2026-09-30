// The player on the island: stats, progression, damage. Movement lives in index.js.
import { S, save } from './state.js';
import { clock } from './clock.js';
import { emit } from './bus.js';
import { ITEMS, SPECIES, RARITY_COLOR } from './data.js';
import { makeActor } from './actors.js';
import { voxBuild } from './props.js';
import { voxelSprite } from '../three/voxel.js';
import { ART } from '../three/art.js';
import { sfx } from './audio.js';
import { modalOpen } from './modal.js';
import { mode } from './mode.js';
import * as fx from './fx.js';
import { initMoveState } from './move.js';

const HIT_IFRAMES = 450;

export const player = {
  x: 0, y: 0, z: 6, yaw: 0, speed: 8.5, walking: false, t: 0,
  hp: 100, mp: 100,
  invulnUntil: 0, lastHitAt: -1e9, lastActionAt: -1e9,
  powerUntil: 0, shield: 0, dead: false,
  mesh: null,
};

export function initPlayer(scene) {
  player.mesh = makeActor('scholar', { scale: 0.22, ...SCHOLAR_DEPTH });
  player.mesh.userData.pickId = 'scholar';
  scene.add(player.mesh);
  initMoveState();
  player.hp = maxHp();
  player.mp = maxMp();
  refreshLook();
}

export const equipped = (slot) => ITEMS[S.equipment[slot]] || null;
export function gearStats() {
  const out = { atk: 0, spell: 0, def: 0, regen: 0 };
  for (const id of Object.values(S.equipment)) {
    const it = ITEMS[id];
    if (!it) continue;
    out.atk += it.atk || 0; out.spell += it.spell || 0; out.def += it.def || 0; out.regen += it.regen || 0;
  }
  return out;
}
export const level = () => S.player.level;
export const maxHp = () => 100 + (S.player.level - 1) * 6 + S.player.bonusHp;
export const maxMp = () => 100 + (S.player.level - 1) * 4 + S.player.bonusMp;
export const xpNeeded = (lv = S.player.level) => lv * 50;
export const attackRange = () => Math.min(3.2 + S.player.level * 0.15, 7);
export const powered = () => clock.t < player.powerUntil;
export const attackPower = () => {
  const base = 10 + Math.floor(S.player.level * 0.8) + gearStats().atk;
  return powered() ? base * 2 : base;
};
export const spellBonus = () => gearStats().spell + Math.floor(S.player.level * 0.5);
export const markAction = () => { player.lastActionAt = clock.t; };

export function mountSpecies() {
  const id = S.trainer.mount;
  return id && SPECIES[id]?.mount && S.trainer.captured[id] ? id : null;
}
export function moveSpeed() {
  const m = mountSpecies();
  return player.speed + (m ? SPECIES[m].mount.bonus * 1.6 : 0);
}

/** Gear shows on the avatar: the weapon's rarity tints the shirt accent, the armour's the backpack straps. */
export function refreshLook() {
  const w = equipped('weapon'), a = equipped('armor');
  const accent = w ? RARITY_COLOR[w.rarity] : '#f2b84b';
  const strap = a ? shade(RARITY_COLOR[a.rarity], -0.35) : '#34343f';
  const old = player.mesh;
  const scene = old?.parent;
  if (!scene) return;
  const g = voxelSprite(ART.scholar, { glow: { G: 0.35, A: 0.5 }, overrides: { A: accent, R: strap }, bevel: 0, ...SCHOLAR_DEPTH });
  g.add(backpack(strap));
  g.scale.setScalar(0.22);
  g.userData.name = 'scholar';
  g.userData.pickId = 'scholar';
  g.userData.pickLabel = 'Yichen (yes, that one)';
  g.userData.height = 16 * 0.22;
  for (const f of g.userData.frames) f.castShadow = true;
  g.position.copy(old.position);
  g.rotation.copy(old.rotation);
  g.visible = old.visible;
  scene.remove(old);
  scene.add(g);
  player.mesh = g;
  emit('player:look', g);
}
/** How thick the scholar is front to back: the head and torso get ~7 voxels, arms and legs 3-5. */
const SCHOLAR_DEPTH = {
  maxHalf: 4, minHalf: 2,
  rear: { rows: [0, 8], map: { S: 'K', s: 'K', G: 'K', e: 'K', m: 'K', k: 'K' } }, // back of the head is hair
};
/** The black backpack behind the torso (sprite voxel units; the sprite faces +z). */
function backpack(strap) {
  const cells = [];
  const b = -SCHOLAR_DEPTH.maxHalf; // first layer behind the back
  for (let x = -2.5; x <= 2.5; x++) for (let y = 2.5; y <= 5.5; y++) for (const z of [b, b - 1]) {
    const zip = z === b - 1 && y === 4.5 && Math.abs(x) < 2;
    cells.push([x, y, z, zip ? strap : (x + y) % 2 ? '#1b1b23' : '#23232d', 0]);
  }
  for (let x = -1.5; x <= 1.5; x++) cells.push([x, 6.5, b, '#23232d', 0]);
  cells.push([-2.5, 3.5, b - 2, '#1b1b23', 0], [2.5, 3.5, b - 2, '#1b1b23', 0]);
  const m = voxBuild(cells, { roughness: 0.9 });
  m.userData.backpack = true;
  return m;
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function tickPlayer(dt) {
  const g = gearStats();
  player.mp = Math.min(maxMp(), player.mp + (1.5 + g.regen) * dt);
  if (clock.t - player.lastHitAt > 6000) player.hp = Math.min(maxHp(), player.hp + 3 * dt);
}

/** Damage the player. Returns true if it landed. */
export function hurt(amount, source = '') {
  if (!mode.play || player.dead || clock.t < player.invulnUntil || modalOpen()) return false;
  if (player.shield > 0) {
    player.shield--;
    player.invulnUntil = clock.t + HIT_IFRAMES;
    fx.text(player.x, player.y + 3.6, player.z, 'BLOCK', 'block');
    sfx('block');
    return false;
  }
  const dmg = Math.max(1, Math.round(amount - gearStats().def));
  player.hp = Math.max(0, player.hp - dmg);
  player.lastHitAt = clock.t;
  player.invulnUntil = clock.t + HIT_IFRAMES;
  fx.text(player.x, player.y + 3.6, player.z, `-${dmg}`, 'hurt');
  sfx('hurt');
  emit('player:hurt', { dmg, source });
  if (player.hp <= 0) {
    player.dead = true;
    emit('player:dead', { source });
  }
  return true;
}
export const grace = (ms = 1200) => { player.invulnUntil = Math.max(player.invulnUntil, clock.t + ms); };
export function heal(n, silent = false) {
  const before = player.hp;
  player.hp = Math.min(maxHp(), player.hp + n);
  const got = Math.round(player.hp - before);
  if (!silent && got > 0) fx.text(player.x, player.y + 3.6, player.z, `+${got} HP`, 'heal');
  return got;
}
export function restoreMp(n, silent = false) {
  const before = player.mp;
  player.mp = Math.min(maxMp(), player.mp + n);
  const got = Math.round(player.mp - before);
  if (!silent && got > 0) fx.text(player.x, player.y + 3.6, player.z, `+${got} MP`, 'mp');
  return got;
}
export function fullRestore() { player.hp = maxHp(); player.mp = maxMp(); }

export function gainXp(n) {
  if (n <= 0 || S.player.level >= 99) return;
  S.player.xp += Math.round(n);
  let up = false;
  while (S.player.level < 99 && S.player.xp >= xpNeeded()) { S.player.xp -= xpNeeded(); S.player.level++; up = true; }
  if (up) {
    fullRestore();
    sfx('levelup');
    fx.ring(player.x, player.y, player.z, '#f2b84b', 3);
    fx.burst(player.x, player.y + 1.5, player.z, '#fde68a', 18, 6);
    emit('levelup', { level: S.player.level });
  }
  save();
}
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
