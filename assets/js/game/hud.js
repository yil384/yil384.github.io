// Heads-up display: vitals, buddy card, action bar, quest tracker, minimap and zone banner.
import { S, save } from './state.js';
import { clock } from './clock.js';
import { view } from './world.js';
import { SPECIES, TYPE_COLOR, buddyXpNeeded, BUDDY_MAX_LEVEL } from './data.js';
import { player, maxHp, maxMp, xpNeeded, engaged, powered } from './player.js';
import { SPELLS, cooldownLeft } from './combat.js';
import { buddy, sigCooldown } from './companion.js';
import { activeId, buddyLevel, buddyXp } from './monsters.js';
import { quests } from './progress.js';
import { applySprite } from './sprites.js';
import { h, fmt } from './util.js';

const els = {};
let minimapSource = () => ({});
let lastBuddy = null;
let lastQuestKey = '';
let hudRoot = null;

export function setMinimapSource(fn) { minimapSource = fn; }

export function initHud(actions) {
  hudRoot = document.getElementById('hud');
  const bar = (cls, label) => {
    const fill = h('span', { class: 'hbar__fill' });
    const txt = h('em', { class: 'hbar__text' });
    return { node: h('div', { class: `hbar hbar--${cls}` }, h('span', { class: 'hbar__label' }, label), h('span', { class: 'hbar__track' }, fill), txt), fill, txt };
  };
  const hp = bar('hp', 'HP');
  const mp = bar('mp', 'MP');
  const xp = bar('xp', 'XP');
  els.hp = hp; els.mp = mp; els.xp = xp;
  els.level = h('b');
  els.gold = h('b');
  els.status = h('span', { class: 'hud-status' });
  els.buffs = h('span', { class: 'hud-buffs' });

  els.buddySprite = h('span', { class: 'hud-buddy__sprite' });
  els.buddyName = h('b');
  els.buddyLv = h('span', { class: 'hud-buddy__lv' });
  els.buddyType = h('span', { class: 'type-chip' });
  els.buddyXp = h('span');

  const card = h('div', { class: 'hud-card hud-player' },
    h('div', { class: 'hud-player__top' },
      h('span', { class: 'hud-lv' }, 'Lv ', els.level),
      h('span', { class: 'hud-gold', title: 'Gold (spend it at Mario\'s shop)' }, '◆ ', els.gold),
      els.status,
    ),
    hp.node, mp.node, xp.node,
    els.buffs,
    h('div', { class: 'hud-buddy', title: 'Your active buddy follows you and attacks. G = signature move, T = swap.' },
      els.buddySprite,
      h('div', { class: 'hud-buddy__info' },
        h('div', null, els.buddyName, ' ', els.buddyLv),
        h('div', { class: 'hud-buddy__meta' }, els.buddyType, h('span', { class: 'mini-bar' }, els.buddyXp)),
      ),
    ),
  );

  // Action bar
  const slots = [
    { key: 'Space', icon: '⚔️', name: 'Attack', desc: 'Hit everything in range', run: actions.attack },
    ...Object.entries(SPELLS).map(([id, s]) => ({ id, key: s.key.toUpperCase(), icon: s.icon, name: s.name, desc: `${s.desc} · ${s.mp} MP`, cost: s.mp, run: () => actions.spell(id) })),
    { id: 'sig', key: 'G', icon: '✦', name: 'Buddy move', desc: 'Signature move', run: actions.signature },
    { id: 'swap', key: 'T', icon: '⇄', name: 'Swap buddy', desc: 'Cycle your party', run: actions.swap },
  ];
  els.slots = {};
  const actionBar = h('div', { class: 'hud-actions', role: 'toolbar', 'aria-label': 'Actions' },
    ...slots.map((s) => {
      const cd = h('span', { class: 'slot__cd' });
      const icon = h('span', { class: 'slot__icon' }, s.icon);
      const node = h('button', { type: 'button', class: `slot${s.key === 'Space' ? ' slot--wide' : ''}`, title: `${s.name} — ${s.desc}`, onclick: s.run },
        icon, h('kbd', { class: 'slot__key' }, s.key), s.cost ? h('span', { class: 'slot__cost' }, s.cost) : null, cd,
      );
      els.slots[s.id || 'attack'] = { node, cd, icon, cost: s.cost };
      return node;
    }),
  );

  // Tracker (top right)
  els.runes = h('div', { class: 'hud-runes', title: 'Runes for the Secret Chamber' },
    ...['ice', 'shadow', 'dragon'].map((r) => h('span', { class: 'hud-rune', dataset: { r } }, { ice: '❄', shadow: '☾', dragon: '✹' }[r])));
  els.quests = h('ol', { class: 'hud-quests' });
  const collapsed = S.settings.trackerCollapsed ?? window.innerWidth < 1300;
  const tracker = h('div', { class: `hud-card hud-tracker${collapsed ? ' is-collapsed' : ''}` });
  const head = h('button', {
    type: 'button', class: 'hud-tracker__head', 'aria-expanded': String(!collapsed), title: 'Show / hide quests',
    onclick: () => {
      const c = tracker.classList.toggle('is-collapsed');
      head.setAttribute('aria-expanded', String(!c));
      S.settings.trackerCollapsed = c;
      save();
    },
  }, h('span', null, 'Quests ', h('i', { class: 'hud-tracker__caret', 'aria-hidden': 'true' }, '▾')), els.runes);
  tracker.append(head, els.quests);

  // Corner: minimap + menu buttons
  els.minimap = h('canvas', { class: 'minimap', width: 76, height: 190, title: 'Minimap — click to jump' });
  els.minimap.addEventListener('click', (e) => {
    const r = els.minimap.getBoundingClientRect();
    const y = ((e.clientY - r.top) / r.height) * view.dh - view.vh / 2;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  });
  const btn = (icon, label, fn) => h('button', { type: 'button', class: 'hud-btn', title: label, 'aria-label': label, onclick: fn }, icon);
  const corner = h('div', { class: 'hud-corner' },
    els.minimap,
    h('div', { class: 'hud-buttons' },
      btn('🏆', 'Achievements', actions.achievements),
      btn('🎒', 'Inventory', actions.inventory),
      btn('🐾', 'Party', actions.party),
      btn('❔', 'Controls & help', actions.help),
    ),
  );

  els.zone = h('div', { class: 'zone-banner' });
  hudRoot.replaceChildren(card, actionBar, tracker, corner, els.zone);
  // Mouse clicks on HUD controls should not leave them focused (Space would re-trigger them).
  hudRoot.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
}

// ---------------------------------------------------------------- per-frame update
const cache = {};
function set(key, el, prop, value) {
  if (cache[key] === value) return;
  cache[key] = value;
  if (prop === 'text') el.textContent = value;
  else if (prop === 'scale') el.style.transform = `scaleX(${value})`;
  else if (prop === 'cd') el.style.setProperty('--cd', value);
}

export function updateHud() {
  if (!hudRoot) return;
  const mh = maxHp();
  const mm = maxMp();
  set('hpS', els.hp.fill, 'scale', (player.hp / mh).toFixed(3));
  set('hpT', els.hp.txt, 'text', `${Math.ceil(player.hp)} / ${mh}`);
  set('mpS', els.mp.fill, 'scale', (player.mp / mm).toFixed(3));
  set('mpT', els.mp.txt, 'text', `${Math.floor(player.mp)} / ${mm}`);
  set('xpS', els.xp.fill, 'scale', (S.player.level >= 99 ? 1 : S.player.xp / xpNeeded()).toFixed(3));
  set('xpT', els.xp.txt, 'text', `${S.player.xp} / ${xpNeeded()}`);
  set('lv', els.level, 'text', String(S.player.level));
  set('gold', els.gold, 'text', fmt(S.player.gold));
  const fighting = engaged();
  set('status', els.status, 'text', fighting ? '⚔ Engaged' : '☮ Calm');
  if (cache.statusCls !== fighting) {
    cache.statusCls = fighting;
    els.status.classList.toggle('is-fighting', fighting);
    els.status.title = fighting
      ? 'You are playing: enemies and bosses fight back.'
      : 'Calm: enemies stay passive while you just read. Move, attack or cast to engage.';
  }
  const low = player.hp / mh < 0.3;
  if (cache.low !== low) { cache.low = low; els.hp.node.classList.toggle('is-low', low); }

  const buffs = [];
  if (powered()) buffs.push(`💪 ×2 ${Math.ceil((player.powerUntil - clock.t) / 1000)}s`);
  if (player.shield > 0) buffs.push(`🛡 ×${player.shield}`);
  set('buffs', els.buffs, 'text', buffs.join('  '));

  // Buddy card
  const id = activeId();
  if (id !== lastBuddy) {
    lastBuddy = id;
    applySprite(els.buddySprite, id, 2);
    els.buddyType.textContent = SPECIES[id].type;
    els.buddyType.style.setProperty('--tc', TYPE_COLOR[SPECIES[id].type]);
    els.slots.sig.node.title = `${SPECIES[id].field.sig.name} — ${SPECIES[id].name}'s signature move`;
  }
  set('bn', els.buddyName, 'text', SPECIES[id].name);
  const blv = buddyLevel(id);
  set('bl', els.buddyLv, 'text', `Lv.${blv}`);
  set('bx', els.buddyXp, 'scale', blv >= BUDDY_MAX_LEVEL ? '1' : (buddyXp(id) / buddyXpNeeded(blv)).toFixed(3));

  // Cooldowns
  for (const name of Object.keys(SPELLS)) {
    const s = els.slots[name];
    set(`cd-${name}`, s.cd, 'cd', cooldownLeft(name).toFixed(3));
    const poor = player.mp < s.cost;
    if (cache[`poor-${name}`] !== poor) { cache[`poor-${name}`] = poor; s.node.classList.toggle('is-poor', poor); }
  }
  set('cd-sig', els.slots.sig.cd, 'cd', sigCooldown().toFixed(3));
  if (buddy.id) set('sigIcon', els.slots.sig.icon, 'text', { Electric: '⚡', Fire: '🔥', Water: '💧', Dragon: '🐉', Normal: '✦', Psychic: '🔮' }[SPECIES[buddy.id].type] || '✦');

  // Runes
  for (const r of els.runes.children) {
    const lit = !!S.runes[r.dataset.r];
    if (r.classList.contains('is-lit') !== lit) r.classList.toggle('is-lit', lit);
  }

  if (clock.frame % 20 === 0) updateTracker();
  if (clock.frame % 6 === 0) drawMinimap();
}

function updateTracker() {
  const list = quests().filter((q) => !q.done).slice(0, 3);
  const key = list.map((q) => q.id + q.detail).join('|');
  if (key === lastQuestKey) return;
  lastQuestKey = key;
  els.quests.replaceChildren(...(list.length ? list : [{ icon: '🏆', label: 'Everything cleared!', detail: 'Bosses keep levelling up to Lv.10.' }])
    .map((q) => h('li', { class: q.hot ? 'is-hot' : '' }, h('span', null, q.icon), h('span', null, h('b', null, q.label), h('small', null, q.detail)))));
}

function drawMinimap() {
  const c = els.minimap;
  const g = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  const sy = H / Math.max(1, view.dh);
  const sx = W / Math.max(1, view.vw);
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(6,10,20,0.75)';
  g.fillRect(0, 0, W, H);
  const src = minimapSource();
  for (const s of src.sections || []) {
    g.fillStyle = s.boss ? 'rgba(248,113,113,0.12)' : 'rgba(148,163,184,0.08)';
    g.fillRect(2, s.y * sy, W - 4, Math.max(2, s.h * sy - 2));
  }
  // viewport
  g.strokeStyle = 'rgba(245,197,66,0.8)';
  g.lineWidth = 1;
  g.strokeRect(0.5, view.sy * sy + 0.5, W - 1, Math.max(4, view.vh * sy) - 1);
  const dot = (x, y, r, color) => { g.fillStyle = color; g.fillRect(Math.round(x * sx - r), Math.round(y * sy - r), r * 2, r * 2); };
  for (const p of src.coins || []) dot(p.x, p.y, 1.5, '#f5c542');
  for (const p of src.npcs || []) dot(p.x, p.y, 1.5, '#60a5fa');
  for (const p of src.enemies || []) dot(p.x, p.y, 1.5, '#f87171');
  for (const p of src.bosses || []) dot(p.x, p.y, 3, '#ef4444');
  if (src.door) dot(src.door.x, src.door.y, 2.5, src.door.ready ? '#e879f9' : '#7c3aed');
  dot(buddy.x, buddy.y, 1.5, '#86efac');
  dot(player.x, player.y, 2.5, '#ffffff');
}

// ---------------------------------------------------------------- zone banner
let zoneTimer = 0;
export function showZone(name) {
  if (!els.zone || !name) return;
  els.zone.textContent = `~ ${name} ~`;
  els.zone.classList.remove('is-in');
  void els.zone.offsetWidth;
  els.zone.classList.add('is-in');
  clearTimeout(zoneTimer);
  zoneTimer = setTimeout(() => els.zone.classList.remove('is-in'), 1800);
}

export function flashSlot(id) {
  const s = els.slots?.[id];
  if (!s) return;
  s.node.classList.remove('is-denied');
  void s.node.offsetWidth;
  s.node.classList.add('is-denied');
}
