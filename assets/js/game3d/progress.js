// Achievements, the quest list, the rune door and the secret chamber, and the local best-runs board.
//
// The chamber used to open as soon as the player brushed the spawn point, so its full-restore
// reward landed on a full-health player. It is now a walled room on the north-west cliff, sealed
// until all three boss runes are in hand, and the chest inside grants permanent rewards.
import { S, save } from './state.js';
import { emit, on } from './bus.js';
import { ZONES } from './world.js';
import { SPECIES } from './data.js';
import { player, reward, refreshLook, fullRestore } from './player.js';
import { capture, setActive } from './monsters.js';
import { makeActor, makeOrb } from './actors.js';
import { toast, banner } from './notify.js';
import { h } from './util.js';
import * as fx from './fx.js';
import { sfx } from './audio.js';

// ---------------------------------------------------------------- achievements
export const ACHIEVEMENTS = [
  { id: 'firstBlood', icon: 'sword-wound', name: 'First Blood', desc: 'Defeat your first enemy', test: () => S.stats.kills >= 1 },
  { id: 'coinCollector', icon: 'two-coins', name: 'Token Collector', desc: 'Collect 4 knowledge tokens', test: () => S.tokens.length >= 4 },
  { id: 'treasureHunter', icon: 'gems', name: 'Treasure Hunter', desc: 'Collect all 8 tokens', test: () => S.tokens.length >= 8 },
  { id: 'explorer', icon: 'treasure-map', name: 'Explorer', desc: 'Talk to all 7 islanders', test: () => S.npcsMet.length >= 7 },
  { id: 'level5', icon: 'upgrade', name: 'Level 5', desc: 'Reach level 5', test: () => S.player.level >= 5 },
  { id: 'level10', icon: 'star-swirl', name: 'Level 10', desc: 'Reach level 10', test: () => S.player.level >= 10 },
  { id: 'spellMaster', icon: 'crystal-ball', name: 'Spell Master', desc: 'Cast all four spells', test: () => ['fireball', 'heal', 'lightning', 'meteor'].every((k) => S.stats.spells[k]) },
  { id: 'critical', icon: 'crossed-swords', name: 'Critical', desc: 'Land a critical hit', test: () => S.stats.crits >= 1 },
  { id: 'survivor', icon: 'skull-crossed-bones', name: 'Survivor', desc: 'Get back up after a game over', test: () => S.stats.deaths >= 1 },
  { id: 'shoppingSpree', icon: 'shopping-cart', name: 'Shopping Spree', desc: "Buy 3 items at Mo's shop", test: () => S.stats.purchases >= 3 },
  { id: 'speedTyper', icon: 'keyboard', name: 'Speed Typer', desc: 'Finish a calibration sprint in under 5 s', test: () => S.best.typing > 0 && S.best.typing < 5 },
  { id: 'runeSeeker', icon: 'rune-stone', name: 'Rune Seeker', desc: 'Obtain your first rune', test: () => Object.values(S.runes).some(Boolean) },
  { id: 'dragonSlayer', icon: 'dragon-head', name: 'Deadline Slayer', desc: 'Defeat the Deadline Dragon', test: () => S.bosses.dragon.kills >= 1 },
  { id: 'secretKeeper', icon: 'boss-key', name: 'Secret Keeper', desc: 'Open the chest in the secret chamber', test: () => S.secret.chest },
  { id: 'collector', icon: 'paw-print', name: 'Collector', desc: 'Catch 5 different creatures', test: () => Object.values(S.trainer.captured).filter(Boolean).length >= 5 },
  { id: 'bestFriends', icon: 'heart-inside', name: 'Best Friends', desc: 'Raise a companion to Lv.10', test: () => Object.values(S.trainer.levels).some((l) => l >= 10) },
  { id: 'typeMaster', icon: 'lightning-branches', name: 'Type Master', desc: 'Land 25 super-effective companion hits', test: () => S.stats.superEffective >= 25 },
  { id: 'champion', icon: 'ribbon-medal', name: 'Champion', desc: 'Earn both rival badges', test: () => S.trainer.badges.length >= 2 },
];

export const achievementCount = () => ACHIEVEMENTS.filter((a) => S.achievements[a.id]).length;

let checkQueued = false;
export function checkAchievements() {
  if (checkQueued) return;
  checkQueued = true;
  queueMicrotask(() => {
    checkQueued = false;
    for (const a of ACHIEVEMENTS) {
      if (S.achievements[a.id]) continue;
      let ok = false;
      try { ok = a.test(); } catch { ok = false; }
      if (!ok) continue;
      S.achievements[a.id] = true;
      save();
      sfx('achievement');
      toast(`Achievement: ${a.name}`, { icon: a.icon, tone: 'gold' });
      emit('achievement', a.id);
    }
  });
}

// ---------------------------------------------------------------- quests
const runeCount = () => Object.values(S.runes).filter(Boolean).length;

export function quests() {
  const t = S.trainer;
  const list = [];
  const runes = runeCount();
  if (runes === 3 && !S.secret.unsealed) list.push({ id: 'door', icon: 'locked-door', label: 'Return to the rune door', detail: 'North-west cliff · press E', hot: true });
  if (S.secret.unsealed && !S.secret.chest) list.push({ id: 'chest', icon: 'open-treasure-chest', label: 'Open the chest', detail: 'Inside the secret chamber', hot: true });
  if (S.bosses.dragon.kills > 0 && !t.captured.tidefin) list.push({ id: 'tidefin', icon: 'paw-print', label: 'Tidefin wants to join', detail: 'Talk to Fern in the meadow', hot: true });
  list.push(
    { id: 'tokens', icon: 'two-coins', label: 'Collect knowledge tokens', detail: `${S.tokens.length} / 8`, done: S.tokens.length >= 8, progress: S.tokens.length / 8 },
    { id: 'npcs', icon: 'conversation', label: 'Meet the islanders', detail: `${S.npcsMet.length} / 7`, done: S.npcsMet.length >= 7, progress: S.npcsMet.length / 7 },
    { id: 'rune-ice', icon: 'snowflake-2', label: 'Frost Rune', detail: 'Defeat the CUDA OOM Golem (the cold aisle)', done: S.runes.ice },
    { id: 'rune-shadow', icon: 'evil-moon', label: 'Shadow Rune', detail: 'Defeat Reviewer #2 (eucalyptus grove)', done: S.runes.shadow },
    { id: 'rune-dragon', icon: 'fire-ring', label: 'Ember Rune', detail: 'Defeat the Deadline Dragon (Torrey Pines bluff)', done: S.runes.dragon },
    { id: 'secret', icon: 'boss-key', label: 'The secret chamber', detail: S.secret.chest ? 'Opened' : S.secret.unsealed ? 'Unsealed' : `Sealed · ${runes}/3 runes`, done: S.secret.chest },
    { id: 'duels', icon: 'ribbon-medal', label: 'Rival duels', detail: `${t.badges.length} / 2 badges`, done: t.badges.length >= 2, progress: t.badges.length / 2 },
  );
  return list;
}

// ---------------------------------------------------------------- leaderboard
export function recordRun() {
  const entry = { score: Math.round(S.player.score), level: S.player.level, date: new Date().toLocaleDateString() };
  const lb = S.leaderboard.filter((e) => e.score !== entry.score);
  lb.push(entry);
  lb.sort((a, b) => b.score - a.score);
  S.leaderboard = lb.slice(0, 5);
  save();
}

// ---------------------------------------------------------------- rune door + secret chamber
export const door = { x: 0, y: 0, z: 0, mesh: null, runes: [], near: false, plate: null };
export const chest = { x: 0, y: 0, z: 0, mesh: null, near: false, plate: null };
let world = null, scene = null;
const RUNE_COLOR = { ice: '#93c5fd', shadow: '#c084fc', dragon: '#f87171' };

export function initSecret(w, s) {
  world = w; scene = s;
  const gate = world.gate;
  door.x = gate.x; door.z = gate.z; door.y = world.surfaceY(gate.x, gate.z);
  door.mesh = makeActor('door', { scale: 0.32, maxHalf: 2, glow: { R: 1.2 } });
  door.mesh.position.set(door.x, door.y, door.z);
  door.mesh.rotation.y = gate.facing;
  scene.add(door.mesh);
  // three rune sockets above the arch, spread along the wall
  door.runes = ['ice', 'shadow', 'dragon'].map((id, i) => {
    const orb = makeOrb(RUNE_COLOR[id], 0.7);
    orb.position.set(door.x + (i - 1) * 1.1 * Math.cos(gate.facing), door.y + 4.6, door.z - (i - 1) * 1.1 * Math.sin(gate.facing));
    orb.userData.id = id;
    scene.add(orb);
    return orb;
  });
  door.plate = h('div', { class: 'g__plate g__plate--door' }, h('b', null, 'Sealed door'), h('span', { class: 'g__plate-hint' }));
  fx.pin(door.plate, () => ({ x: door.x, y: door.y + 5.6, z: door.z }));

  const zc = ZONES.chamber;
  chest.x = zc.x; chest.z = zc.z; chest.y = world.surfaceY(zc.x, zc.z);
  chest.mesh = makeActor(S.secret.chest ? 'chest-open' : 'chest', { scale: 0.16 });
  chest.mesh.position.set(chest.x, chest.y, chest.z);
  scene.add(chest.mesh);
  chest.plate = h('div', { class: 'g__plate g__plate--chest' }, h('b', null, 'Chest'), h('span', { class: 'g__plate-hint' }, h('kbd', null, 'E'), ' open'));
  fx.pin(chest.plate, () => ({ x: chest.x, y: chest.y + 2.6, z: chest.z }));

  world.sealChamber(!S.secret.unsealed);
  syncDoor();
  on('boss:defeated', ({ rune }) => {
    if (!rune) return;
    sfx('rune');
    const n = runeCount();
    banner(`${rune} obtained`, n < 3 ? `${n} of 3 runes. The sealed door on the north-west cliff stirs.` : 'All three runes. Return to the door on the north-west cliff.', 'rune-stone');
    syncDoor();
  });
}

function syncDoor() {
  for (const orb of door.runes) {
    const lit = !!S.runes[orb.userData.id];
    orb.material.emissiveIntensity = lit ? 2.6 : 0.15;
    orb.material.opacity = 1;
  }
  door.mesh.visible = !S.secret.unsealed;
  door.plate.classList.toggle('is-ready', runeCount() === 3 && !S.secret.unsealed);
  door.plate.classList.toggle('is-open', S.secret.unsealed);
  door.plate.querySelector('b').textContent = S.secret.unsealed ? 'Secret chamber' : 'Sealed door';
  chest.plate.hidden = S.secret.chest || !S.secret.unsealed;
}

export function updateSecret(dt) {
  const dd = Math.hypot(player.x - door.x, player.z - door.z);
  const near = dd < 4.5;
  if (near !== door.near) { door.near = near; door.plate.classList.toggle('is-near', near); }
  if (near) {
    const n = runeCount();
    const hint = door.plate.querySelector('.g__plate-hint');
    const text = S.secret.unsealed ? 'Open' : n === 3 ? 'E · unseal' : `${n}/3 runes`;
    if (hint.textContent !== text) hint.textContent = text;
  }
  for (const orb of door.runes) orb.position.y = door.y + 4.6 + Math.sin(performance.now() / 600 + orb.userData.id.length) * 0.1;
  const cd = Math.hypot(player.x - chest.x, player.z - chest.z);
  const cnear = cd < 3 && S.secret.unsealed && !S.secret.chest;
  if (cnear !== chest.near) { chest.near = cnear; chest.plate.classList.toggle('is-near', cnear); }
}

/** Returns true if the door handled the interaction. */
export function interactDoor() {
  if (Math.hypot(player.x - door.x, player.z - door.z) > 4.5) return false;
  if (S.secret.unsealed) return false;
  const n = runeCount();
  if (n < 3) {
    sfx('error');
    const missing = [!S.runes.ice && 'Frost (CUDA OOM Golem)', !S.runes.shadow && 'Shadow (Reviewer #2)', !S.runes.dragon && 'Ember (Deadline Dragon)'].filter(Boolean);
    toast(`The door will not move. Missing runes: ${missing.join(', ')}.`, { icon: 'lock' });
    return true;
  }
  unseal();
  return true;
}

function unseal() {
  S.secret.unsealed = true;
  save();
  sfx('door');
  fx.shake(0.6, 700);
  fx.ring(door.x, door.y, door.z, '#c084fc', 5, 0.9);
  fx.burst(door.x, door.y + 2, door.z, '#e9d5ff', 30, 6, 1, 0.9);
  world.sealChamber(false);
  syncDoor();
  banner('The secret chamber opens', 'Three runes, one door. Something waits inside.', 'boss-key');
  emit('secret:unsealed');
}

export function nearChest() {
  return S.secret.unsealed && !S.secret.chest && Math.hypot(player.x - chest.x, player.z - chest.z) < 3;
}

export function openChest() {
  if (!nearChest()) return false;
  S.secret.chest = true;
  S.player.bonusHp += 25;
  S.player.bonusMp += 25;
  const had = S.trainer.captured.oracle;
  capture('oracle', { quiet: true });
  setActive('oracle', true);
  const prevRing = S.equipment.ring;
  S.equipment.ring = 'rune-crown';
  refreshLook();
  reward({ gold: 1000, xp: 300 });
  fullRestore();
  save();
  scene.remove(chest.mesh);
  chest.mesh = makeActor('chest-open', { scale: 0.16 });
  chest.mesh.position.set(chest.x, chest.y, chest.z);
  scene.add(chest.mesh);
  fx.ring(chest.x, chest.y, chest.z, '#f2b84b', 5, 1);
  fx.burst(chest.x, chest.y + 1, chest.z, '#fde68a', 50, 7, 1.2, 1);
  fx.shake(0.4, 400);
  sfx('victory');
  syncDoor();
  banner('Chest opened', `${had ? 'Oracle returns to your side' : 'Oracle joined your party'} · Crown of Runes${prevRing ? ' (replaced your ring)' : ''} · +25 max HP & MP`, 'jewel-crown');
  emit('secret:chest');
  emit('buddy:changed', 'oracle');
  return true;
}

export const doorMarker = () => ({ x: door.x, z: door.z, ready: runeCount() === 3 && !S.secret.unsealed, open: S.secret.unsealed });

// ---------------------------------------------------------------- wiring
export function initProgress() {
  ['kill', 'token', 'levelup', 'boss:defeated', 'npc:met', 'spell', 'crit', 'purchase', 'capture', 'buddy:levelup',
    'badge', 'secret:chest', 'secret:unsealed', 'respawn', 'super-effective', 'minigame'].forEach((e) => on(e, checkAchievements));
  on('boss:defeated', recordRun);
  checkAchievements();
}
