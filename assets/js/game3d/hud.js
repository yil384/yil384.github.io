// Heads-up display: vitals, companion chip, action bar, quest tracker, minimap, zone name, boss bar.
import { S, save } from './state.js';
import { clock } from './clock.js';
import { SIZE, ZONES } from './world.js';
import { SPECIES, TYPE_COLOR, buddyXpNeeded, BUDDY_MAX_LEVEL } from './data.js';
import { player, maxHp, maxMp, xpNeeded, powered } from './player.js';
import { SPELLS, cooldownLeft } from './combat.js';
import { buddy, sigCooldown } from './companion.js';
import { activeId, buddyLevel, buddyXp } from './monsters.js';
import { quests } from './progress.js';
import { activeBoss } from './bosses.js';
import { spriteImg } from './pixelart.js';
import { h, fmt, icon } from './util.js';

const els = {};
const cache = {};
let hudRoot = null;
let markers = () => ({});
let world = null;
let mapBase = null;
let lastBuddy = null;
let lastQuestKey = '';
let lastZone = null;

const TYPE_ICON = { Electric: 'lightning-branches', Fire: 'fire-ring', Water: 'ball-glow', Dragon: 'dragon-head', Normal: 'star-swirl', Psychic: 'crystal-ball' };

export function initHud(root, actions, opts) {
  hudRoot = root;
  world = opts.world;
  markers = opts.markers;

  const bar = (cls, label) => {
    const fill = h('span', { class: 'hbar__fill' });
    const txt = h('em', { class: 'hbar__text' });
    return { node: h('div', { class: `hbar hbar--${cls}` }, h('span', { class: 'hbar__label' }, label), h('span', { class: 'hbar__track' }, fill), txt), fill, txt };
  };
  els.hp = bar('hp', 'HP');
  els.mp = bar('mp', 'MP');
  els.xp = bar('xp', 'XP');
  els.level = h('b');
  els.gold = h('b');
  els.buffs = h('span', { class: 'hud-buffs' });
  els.buddySprite = h('span', { class: 'hud-buddy__sprite' });
  els.buddyName = h('b');
  els.buddyLv = h('span', { class: 'hud-buddy__lv' });
  els.buddyType = h('span', { class: 'type-chip' });
  els.buddyXp = h('span');

  const card = h('div', { class: 'hud-card hud-player' },
    h('div', { class: 'hud-player__top' },
      h('span', { class: 'hud-lv' }, 'Lv ', els.level),
      h('span', { class: 'hud-gold', title: 'Gold' }, icon('two-coins', { size: 14 }), els.gold),
      els.buffs,
    ),
    els.hp.node, els.mp.node, els.xp.node,
    h('button', { type: 'button', class: 'hud-buddy', title: 'Party (G = signature move, T = swap)', onclick: actions.party },
      els.buddySprite,
      h('span', { class: 'hud-buddy__info' },
        h('span', null, els.buddyName, ' ', els.buddyLv),
        h('span', { class: 'hud-buddy__meta' }, els.buddyType, h('span', { class: 'mini-bar' }, els.buddyXp)),
      ),
    ),
  );

  // Action bar
  const slots = [
    { id: 'attack', key: 'Space', icon: 'crossed-swords', name: 'Attack', desc: 'Hit everything in range', run: actions.attack },
    ...Object.entries(SPELLS).map(([id, s]) => ({ id, key: s.key, icon: s.icon, name: s.name, desc: `${s.desc} · ${s.mp} MP`, cost: s.mp, run: () => actions.spell(id) })),
    { id: 'sig', key: 'G', icon: 'star-swirl', name: 'Signature move', desc: 'Your companion\'s signature move', run: actions.signature },
    { id: 'swap', key: 'T', icon: 'body-swapping', name: 'Swap companion', desc: 'Cycle your party', run: actions.swap },
  ];
  els.slots = {};
  const actionBar = h('div', { class: 'hud-actions', role: 'toolbar', 'aria-label': 'Actions' },
    ...slots.map((s) => {
      const cd = h('span', { class: 'slot__cd' });
      const ic = icon(s.icon, { size: 22, cls: 'slot__icon' });
      const node = h('button', { type: 'button', class: `slot${s.id === 'attack' ? ' slot--wide' : ''}`, title: `${s.name} — ${s.desc}`, 'aria-label': s.name, onclick: s.run },
        ic, h('kbd', { class: 'slot__key' }, s.key), s.cost ? h('span', { class: 'slot__cost' }, s.cost) : null, cd,
      );
      els.slots[s.id] = { node, cd, icon: ic, cost: s.cost };
      return node;
    }),
    h('span', { class: 'hud-actions__gap' }),
    menuBtn('trophy', 'Achievements', actions.achievements),
    menuBtn('backpack', 'Inventory', actions.inventory),
    menuBtn('circle-help', 'Controls & settings', actions.help),
  );

  // Tracker
  els.runes = h('span', { class: 'hud-runes', title: 'Runes for the sealed door' },
    ...[['ice', 'snowflake-2'], ['shadow', 'evil-moon'], ['dragon', 'fire-ring']].map(([r, ic]) => icon(ic, { size: 14, cls: 'hud-rune', label: '' })).map((el, i) => { el.dataset.r = ['ice', 'shadow', 'dragon'][i]; return el; }));
  els.quests = h('ol', { class: 'hud-quests' });
  const collapsed = !!S.settings.trackerCollapsed;
  const tracker = h('div', { class: `hud-card hud-tracker${collapsed ? ' is-collapsed' : ''}` });
  const head = h('button', {
    type: 'button', class: 'hud-tracker__head', 'aria-expanded': String(!collapsed), title: 'Show / hide quests',
    onclick: () => {
      const c = tracker.classList.toggle('is-collapsed');
      head.setAttribute('aria-expanded', String(!c));
      S.settings.trackerCollapsed = c;
      save();
    },
  }, h('span', null, 'Quests ', icon('chevron-down', { size: 14, cls: 'hud-tracker__caret' })), els.runes);
  tracker.append(head, els.quests);

  // Top bar: zone name, boss bar, close
  els.zone = h('div', { class: 'hud-zone' });
  els.bossName = h('span', { class: 'hud-boss__name' });
  els.bossFill = h('span', { class: 'hud-boss__fill' });
  els.boss = h('div', { class: 'hud-boss', hidden: true }, els.bossName, h('span', { class: 'hud-boss__track' }, els.bossFill));
  const close = h('button', { type: 'button', class: 'hud-close', title: 'Back to the page (Esc)', onclick: actions.leave }, icon('x', { size: 16 }), 'Back to page ', h('kbd', null, 'Esc'));
  const top = h('div', { class: 'hud-top' }, h('div', { class: 'hud-top__mid' }, els.zone, els.boss), close);

  // Minimap
  els.minimap = h('canvas', { class: 'hud-map', width: SIZE * 3, height: SIZE * 3, 'aria-label': 'Minimap' });
  buildMapBase();
  const mapWrap = h('div', { class: 'hud-card hud-map-wrap' }, els.minimap);

  els.help = h('div', { class: 'hud-help' }, h('kbd', null, 'W'), h('kbd', null, 'A'), h('kbd', null, 'S'), h('kbd', null, 'D'), ' move · right-drag look · ', h('kbd', null, 'E'), ' talk');
  hudRoot.append(top, card, actionBar, tracker, mapWrap, els.help);
  // Mouse clicks on HUD controls must not leave them focused (Space would re-trigger them).
  hudRoot.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
}

function menuBtn(ic, label, fn) {
  return h('button', { type: 'button', class: 'hud-btn', title: label, 'aria-label': label, onclick: fn }, icon(ic, { size: 18 }));
}

function set(key, el, prop, value) {
  if (cache[key] === value) return;
  cache[key] = value;
  if (prop === 'text') el.textContent = value;
  else if (prop === 'scale') el.style.transform = `scaleX(${value})`;
  else if (prop === 'cd') el.style.setProperty('--cd', value);
}

// ---------------------------------------------------------------- per-frame update
export function updateHud() {
  if (!hudRoot) return;
  const mh = maxHp(), mm = maxMp();
  set('hpS', els.hp.fill, 'scale', (player.hp / mh).toFixed(3));
  set('hpT', els.hp.txt, 'text', `${Math.ceil(player.hp)} / ${mh}`);
  set('mpS', els.mp.fill, 'scale', (player.mp / mm).toFixed(3));
  set('mpT', els.mp.txt, 'text', `${Math.floor(player.mp)} / ${mm}`);
  set('xpS', els.xp.fill, 'scale', (S.player.level >= 99 ? 1 : S.player.xp / xpNeeded()).toFixed(3));
  set('xpT', els.xp.txt, 'text', `${S.player.xp} / ${xpNeeded()}`);
  set('lv', els.level, 'text', String(S.player.level));
  set('gold', els.gold, 'text', fmt(S.player.gold));
  const low = player.hp / mh < 0.3;
  if (cache.low !== low) { cache.low = low; els.hp.node.classList.toggle('is-low', low); }

  const buffs = [];
  if (powered()) buffs.push(`×2 ATK ${Math.ceil((player.powerUntil - clock.t) / 1000)}s`);
  if (player.shield > 0) buffs.push(`Barrier ×${player.shield}`);
  set('buffs', els.buffs, 'text', buffs.join(' · '));

  // companion chip
  const id = activeId();
  if (id !== lastBuddy) {
    lastBuddy = id;
    els.buddySprite.replaceChildren(spriteImg(SPECIES[id].sprite, 2));
    els.buddyType.textContent = SPECIES[id].type;
    els.buddyType.style.setProperty('--tc', TYPE_COLOR[SPECIES[id].type]);
    els.slots.sig.node.title = `${SPECIES[id].field.sig.name} — ${SPECIES[id].name}'s signature move (G)`;
    els.slots.sig.icon.src = `assets/icons/game/${TYPE_ICON[SPECIES[id].type] || 'star-swirl'}.svg`;
  }
  set('bn', els.buddyName, 'text', SPECIES[id].name);
  const blv = buddyLevel(id);
  set('bl', els.buddyLv, 'text', `Lv.${blv}`);
  set('bx', els.buddyXp, 'scale', blv >= BUDDY_MAX_LEVEL ? '1' : (buddyXp(id) / buddyXpNeeded(blv)).toFixed(3));

  // cooldowns
  for (const name of Object.keys(SPELLS)) {
    const s = els.slots[name];
    set(`cd-${name}`, s.cd, 'cd', cooldownLeft(name).toFixed(3));
    const poor = player.mp < s.cost;
    if (cache[`poor-${name}`] !== poor) { cache[`poor-${name}`] = poor; s.node.classList.toggle('is-poor', poor); }
  }
  set('cd-sig', els.slots.sig.cd, 'cd', sigCooldown().toFixed(3));

  for (const r of els.runes.children) {
    const lit = !!S.runes[r.dataset.r];
    if (r.classList.contains('is-lit') !== lit) r.classList.toggle('is-lit', lit);
  }

  // zone + boss
  const zone = world.zoneAt(player.x, player.z);
  if (zone !== lastZone) {
    lastZone = zone;
    if (zone) {
      els.zone.textContent = ZONES[zone].label;
      els.zone.classList.remove('is-in');
      void els.zone.offsetWidth;
      els.zone.classList.add('is-in');
    }
  }
  const boss = activeBoss();
  const showBoss = !!boss;
  if (cache.boss !== showBoss) { cache.boss = showBoss; els.boss.hidden = !showBoss; }
  if (boss) {
    set('bossN', els.bossName, 'text', `${boss.name} · Lv.${boss.round}`);
    set('bossS', els.bossFill, 'scale', Math.max(0, boss.hp / boss.maxHp).toFixed(3));
  }

  if (clock.frame % 20 === 0) updateTracker();
  if (clock.frame % 4 === 0) drawMinimap();
}

function updateTracker() {
  const list = quests().filter((q) => !q.done).slice(0, 3);
  const key = list.map((q) => q.id + q.detail).join('|');
  if (key === lastQuestKey) return;
  lastQuestKey = key;
  els.quests.replaceChildren(...(list.length ? list : [{ icon: 'trophy', label: 'Everything cleared', detail: 'Bosses keep levelling up to Lv.10.' }])
    .map((q) => h('li', { class: q.hot ? 'is-hot' : '' }, icon(q.icon, { size: 16 }), h('span', null, h('b', null, q.label), h('small', null, q.detail)))));
}

// ---------------------------------------------------------------- minimap
const MAP_COLOR = { 1: '#3f7d52', 2: '#6f4622', 3: '#3b4455', 4: '#a9c8e6', 5: '#3a3563', 6: '#5a3a3a', 7: '#b9a874', 8: '#8f8168' };
function buildMapBase() {
  const c = document.createElement('canvas');
  c.width = SIZE * 3; c.height = SIZE * 3;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(6,10,20,0.55)';
  g.fillRect(0, 0, c.width, c.height);
  const half = SIZE / 2;
  for (let z = -half; z < half; z++) for (let x = -half; x < half; x++) {
    const t = world.typeAt(x, z);
    if (!t || world.height(x, z) === -Infinity) continue;
    g.fillStyle = MAP_COLOR[t] || '#555';
    g.fillRect((x + half) * 3, (z + half) * 3, 3, 3);
  }
  mapBase = c;
}
function drawMinimap() {
  const c = els.minimap;
  const g = c.getContext('2d');
  const half = SIZE / 2;
  g.clearRect(0, 0, c.width, c.height);
  g.drawImage(mapBase, 0, 0);
  const dot = (x, z, r, color) => { g.fillStyle = color; g.beginPath(); g.arc((x + half) * 3 + 1.5, (z + half) * 3 + 1.5, r, 0, Math.PI * 2); g.fill(); };
  const m = markers();
  for (const p of m.tokens || []) dot(p.x, p.z, 2, '#f2b84b');
  for (const p of m.npcs || []) dot(p.x, p.z, 2.4, p.news ? '#93c5fd' : '#60a5fa');
  for (const p of m.enemies || []) dot(p.x, p.z, 2, '#f87171');
  for (const p of m.bosses || []) dot(p.x, p.z, 3.4, '#ef4444');
  if (m.door) dot(m.door.x, m.door.z, 3, m.door.open ? '#e9d5ff' : m.door.ready ? '#e879f9' : '#7c3aed');
  dot(buddy.x, buddy.z, 2, '#86efac');
  dot(player.x, player.z, 3, '#ffffff');
}

export function flashSlot(id) {
  const s = els.slots?.[id];
  if (!s) return;
  s.node.classList.remove('is-denied');
  void s.node.offsetWidth;
  s.node.classList.add('is-denied');
}
