// Achievements, the quest log, runes and the Secret Chamber, and the local best-runs board.
//
// The Secret Chamber used to open as soon as the player brushed a brick next to the spawn point,
// so its "full restore" reward landed on a full-health player. It is now sealed behind three runes
// dropped by the Ice Golem, the Shadow Mage and the Dragon King, and the chest grants permanent
// rewards instead of a restore.
import { S, save } from './state.js';
import { emit, on } from './bus.js';
import { spawnOf, onMeasure, scheduleMeasure, docRect, readView } from './world.js';
import { SPECIES } from './data.js';
import { player, reward, refreshLook, fullRestore, placeInView } from './player.js';
import { capture, setActive } from './monsters.js';
import { applySprite } from './sprites.js';
import { toast, banner } from './notify.js';
import { h, dist, $ } from './util.js';
import * as fx from './fx.js';
import { sfx } from './audio.js';

// ---------------------------------------------------------------- achievements
export const ACHIEVEMENTS = [
  { id: 'firstBlood', icon: '🗡️', name: 'First Blood', desc: 'Defeat your first enemy', test: () => S.stats.kills >= 1 },
  { id: 'coinCollector', icon: '🪙', name: 'Token Collector', desc: 'Collect 4 knowledge tokens', test: () => S.tokens.length >= 4 },
  { id: 'treasureHunter', icon: '💎', name: 'Treasure Hunter', desc: 'Collect all 8 tokens', test: () => S.tokens.length >= 8 },
  { id: 'explorer', icon: '🗺️', name: 'Explorer', desc: 'Talk to all 6 NPCs', test: () => S.npcsMet.length >= 6 },
  { id: 'level5', icon: '⭐', name: 'Level 5', desc: 'Reach level 5', test: () => S.player.level >= 5 },
  { id: 'level10', icon: '🌟', name: 'Level 10', desc: 'Reach level 10', test: () => S.player.level >= 10 },
  { id: 'spellMaster', icon: '🔮', name: 'Spell Master', desc: 'Cast all four spells', test: () => ['fireball', 'heal', 'lightning', 'meteor'].every((k) => S.stats.spells[k]) },
  { id: 'critical', icon: '💥', name: 'Critical!', desc: 'Land a critical hit', test: () => S.stats.crits >= 1 },
  { id: 'survivor', icon: '💀', name: 'Survivor', desc: 'Get back up after a game over', test: () => S.stats.deaths >= 1 },
  { id: 'shoppingSpree', icon: '🛒', name: 'Shopping Spree', desc: "Buy 3 items at Mario's shop", test: () => S.stats.purchases >= 3 },
  { id: 'speedTyper', icon: '⌨️', name: 'Speed Typer', desc: 'Finish a coding sprint in under 5 s', test: () => S.best.typing > 0 && S.best.typing < 5 },
  { id: 'runeSeeker', icon: '🔷', name: 'Rune Seeker', desc: 'Obtain your first rune', test: () => Object.values(S.runes).some(Boolean) },
  { id: 'dragonSlayer', icon: '🐉', name: 'Dragon Slayer', desc: 'Defeat the Dragon King', test: () => S.bosses.dragon.kills >= 1 },
  { id: 'secretKeeper', icon: '🗝️', name: 'Secret Keeper', desc: 'Open the chest in the Secret Chamber', test: () => S.secret.chest },
  { id: 'collector', icon: '📘', name: 'Collector', desc: 'Catch 5 different monsters', test: () => Object.values(S.trainer.captured).filter(Boolean).length >= 5 },
  { id: 'bestFriends', icon: '🤝', name: 'Best Friends', desc: 'Raise a buddy to Lv.10', test: () => Object.values(S.trainer.levels).some((l) => l >= 10) },
  { id: 'typeMaster', icon: '🎯', name: 'Type Master', desc: 'Land 25 super-effective buddy hits', test: () => S.stats.superEffective >= 25 },
  { id: 'champion', icon: '🏅', name: 'Champion', desc: 'Earn both rival badges', test: () => S.trainer.badges.length >= 2 },
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
      toast(`Achievement unlocked: ${a.name}`, { icon: a.icon, tone: 'gold' });
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
  if (runes === 3 && !S.secret.unsealed) {
    list.push({ id: 'door', icon: '🚪', label: 'Return to the rune door', detail: 'Top-left of the Profile Hall · press F', done: false, hot: true });
  }
  if (S.secret.unsealed && !S.secret.chest) {
    list.push({ id: 'chest', icon: '🗝️', label: 'Open the legendary chest', detail: 'Secret Chamber, just below your profile', done: false, hot: true });
  }
  if (S.bosses.dragon.kills > 0 && !t.captured.charmander) {
    list.push({ id: 'charmander', icon: '🔥', label: 'Charmander wants to join', detail: 'Talk to it in Education', done: false, hot: true });
  }
  list.push(
    { id: 'tokens', icon: '🪙', label: 'Collect knowledge tokens', detail: `${S.tokens.length} / 8`, done: S.tokens.length >= 8, progress: S.tokens.length / 8 },
    { id: 'npcs', icon: '💬', label: 'Meet the locals', detail: `${S.npcsMet.length} / 6 talked to`, done: S.npcsMet.length >= 6, progress: S.npcsMet.length / 6 },
    { id: 'rune-ice', icon: '❄️', label: 'Frost Rune', detail: 'Defeat the Ice Golem (Ice Cavern)', done: S.runes.ice },
    { id: 'rune-shadow', icon: '🌑', label: 'Shadow Rune', detail: 'Defeat the Shadow Mage (Shadow Realm)', done: S.runes.shadow },
    { id: 'rune-dragon', icon: '🔥', label: 'Ember Rune', detail: 'Defeat the Dragon King (Dragon Lair)', done: S.runes.dragon },
    { id: 'secret', icon: '🗝️', label: 'The Secret Chamber', detail: S.secret.chest ? 'Opened' : S.secret.unsealed ? 'Unsealed' : `Sealed · ${runes}/3 runes`, done: S.secret.chest },
    { id: 'duels', icon: '🏅', label: 'Rival duels', detail: `${t.badges.length} / 2 badges`, done: t.badges.length >= 2, progress: t.badges.length / 2 },
  );
  return list;
}

export function renderQuestLog() {
  const el = $('#quest-list');
  if (!el) return;
  el.replaceChildren(...quests().map((q) => h('li', { class: `quest${q.done ? ' is-done' : ''}${q.hot ? ' is-hot' : ''}` },
    h('span', { class: 'quest__icon', 'aria-hidden': 'true' }, q.done ? '✓' : q.icon),
    h('span', { class: 'quest__text' }, h('b', null, q.label), h('small', null, q.detail)),
  )));
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
export const door = { el: null, sp: null, near: false };

export function initSecret() {
  door.sp = spawnOf('door');
  if (door.sp) {
    door.el = h('div', { class: 'ent door' },
      h('div', { class: 'door__arch' },
        h('span', { class: 'door__rune', dataset: { r: 'ice' } }, '❄'),
        h('span', { class: 'door__rune', dataset: { r: 'shadow' } }, '☾'),
        h('span', { class: 'door__rune', dataset: { r: 'dragon' } }, '✹'),
      ),
      h('div', { class: 'prompt door__prompt' }),
    );
    door.el.addEventListener('click', () => {
      player.target = { x: door.sp.x + 24, y: door.sp.y + 60, reach: 40, onArrive: interactDoor };
    });
    document.getElementById('world').append(door.el);
    onMeasure(syncDoor);
  }
  const chest = $('#secret-chest');
  if (chest) {
    applySprite(chest.querySelector('.chest__sprite'), S.secret.chest ? 'chest-open' : 'chest', 5);
    chest.addEventListener('click', openChest);
  }
  if (S.secret.unsealed) revealChamber(false);
  if (S.secret.chest) showChestRewards(false);
  on('boss:defeated', ({ rune }) => {
    if (!rune) return;
    sfx('rune');
    const n = runeCount();
    banner(`${rune} obtained!`, n < 3 ? `${n} of 3 runes. The sealed door in the Profile Hall stirs.` : 'All three runes! Return to the rune door at the top of the Profile Hall.', '🔷');
    syncDoor();
  });
  syncDoor();
}

function syncDoor() {
  if (!door.el || !door.sp) return;
  door.el.hidden = !door.sp.active;
  door.el.style.transform = `translate3d(${door.sp.x}px, ${door.sp.y}px, 0)`;
  for (const r of door.el.querySelectorAll('[data-r]')) r.classList.toggle('is-lit', !!S.runes[r.dataset.r]);
  door.el.classList.toggle('is-ready', runeCount() === 3 && !S.secret.unsealed);
  door.el.classList.toggle('is-open', S.secret.unsealed);
}

const doorCenter = () => ({ x: door.sp.x + 34, y: door.sp.y + 48 });

export function updateSecret() {
  if (!door.el || !door.sp?.active) return;
  const c = doorCenter();
  const near = dist(player.x, player.y, c.x, c.y) < 90;
  if (near !== door.near) {
    door.near = near;
    door.el.classList.toggle('is-near', near);
  }
  if (near) {
    const n = runeCount();
    const p = door.el.querySelector('.door__prompt');
    const text = S.secret.unsealed ? 'F · Enter the chamber' : n === 3 ? 'F · Unseal the door' : `Sealed · ${n}/3 runes`;
    if (p.textContent !== text) p.textContent = text;
  }
}

/** Returns true if the door handled the interaction. */
export function interactDoor() {
  if (!door.sp) return false;
  const c = doorCenter();
  if (dist(player.x, player.y, c.x, c.y) > 110) return false;
  if (S.secret.unsealed) {
    enterChamber();
    return true;
  }
  const n = runeCount();
  if (n < 3) {
    sfx('error');
    const missing = [!S.runes.ice && 'Frost (Ice Golem)', !S.runes.shadow && 'Shadow (Shadow Mage)', !S.runes.dragon && 'Ember (Dragon King)'].filter(Boolean);
    toast(`The door won't budge. Missing runes: ${missing.join(', ')}.`, { icon: '🔒' });
    return true;
  }
  unseal();
  return true;
}

function unseal() {
  S.secret.unsealed = true;
  save();
  sfx('door');
  fx.shake(8, 600);
  fx.flash('rgba(192,132,252,0.3)');
  const c = doorCenter();
  fx.ring(c.x, c.y, '#c084fc', 220);
  fx.burst(c.x, c.y, '#e9d5ff', 24, 90);
  syncDoor();
  banner('The Secret Chamber opens', 'Three runes, one door. Something legendary waits inside.', '🗝️');
  emit('secret:unsealed');
  setTimeout(() => revealChamber(true), 900);
}

function revealChamber(scroll) {
  const sec = $('#secret-chamber');
  if (!sec) return;
  sec.hidden = false;
  sec.classList.add('is-revealed');
  scheduleMeasure();
  if (scroll) setTimeout(enterChamber, 60);
}

function enterChamber() {
  const sec = $('#secret-chamber');
  if (!sec || sec.hidden) return;
  sec.scrollIntoView({ behavior: 'instant', block: 'start' });
  readView();
  placeInView();
}

export function nearChest() {
  const chest = $('#secret-chest');
  if (!chest || S.secret.chest || $('#secret-chamber')?.hidden) return false;
  const r = docRect(chest);
  return dist(player.x, player.y, r.x + r.w / 2, r.y + r.h / 2) < 160;
}

export function openChest() {
  if (!S.secret.unsealed || S.secret.chest) return;
  S.secret.chest = true;
  S.player.bonusHp += 25;
  S.player.bonusMp += 25;
  const hadMew = S.trainer.captured.mew;
  capture('mew', { quiet: true });
  setActive('mew', true);
  const prevRing = S.equipment.ring;
  S.equipment.ring = 'rune-crown';
  refreshLook();
  reward({ gold: 1000, xp: 300 });
  fullRestore();
  save();

  const chest = $('#secret-chest');
  applySprite(chest.querySelector('.chest__sprite'), 'chest-open', 5);
  chest.classList.add('is-open');
  const r = docRect(chest);
  fx.confetti(r.x + r.w / 2, r.y + r.h / 2, 60);
  fx.ring(r.x + r.w / 2, r.y + r.h / 2, '#f5c542', 260);
  fx.shake(6, 400);
  sfx('victory');
  banner('Legendary chest opened!', `${hadMew ? 'Mew returns to your side' : 'Mew joined your party'} · Crown of Runes · +25 max HP & MP`, '👑');
  showChestRewards(true, prevRing);
  emit('secret:chest');
  emit('buddy:changed', 'mew');
}

function showChestRewards(animate, prevRing) {
  const list = $('#chamber-rewards');
  const chest = $('#secret-chest');
  if (chest) {
    chest.classList.add('is-open');
    chest.querySelector('.chest__label').textContent = 'Opened';
    chest.disabled = true;
  }
  if (!list) return;
  const items = [
    ['🧬', `${SPECIES.mew.name} joined your party`, 'Mythical Psychic buddy · Psystrike nova + shield'],
    ['👑', 'Crown of Runes equipped', `Mythic ring: +8 MP regen, +4 ATK, +8 spell${prevRing ? ' (replaced your old ring)' : ''}`],
    ['❤️', '+25 max HP and +25 max MP', 'Permanent'],
    ['◆', '+1,000 gold and +300 XP', 'Spend it at Mario\'s shop'],
  ];
  list.replaceChildren(...items.map(([icon, title, sub], i) => {
    const li = h('li', { class: 'chamber__reward' }, h('span', { class: 'chamber__reward-icon' }, icon), h('span', null, h('b', null, title), h('small', null, sub)));
    if (animate) li.style.animationDelay = `${0.15 + i * 0.12}s`;
    return li;
  }));
  list.classList.toggle('is-animated', !!animate);
}

// ---------------------------------------------------------------- wiring
export function initProgress() {
  const recheck = () => { checkAchievements(); renderQuestLog(); };
  ['kill', 'coin', 'levelup', 'boss:defeated', 'npc:met', 'spell', 'crit', 'purchase', 'capture', 'buddy:levelup',
    'badge', 'secret:chest', 'secret:unsealed', 'respawn', 'super-effective', 'minigame', 'hub:render'].forEach((e) => on(e, recheck));
  on('boss:defeated', recordRun);
  renderQuestLog();
  checkAchievements();
}
