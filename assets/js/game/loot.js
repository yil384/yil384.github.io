// Knowledge tokens (the 8 collectibles), equipment drops and the equip-compare prompt.
import { S, save } from './state.js';
import { clock } from './clock.js';
import { emit, on } from './bus.js';
import { spawnsOf, onMeasure } from './world.js';
import { ITEMS, RARITY_COLOR, RARITY_ORDER, itemPower } from './data.js';
import { player, reward, refreshLook, markAction } from './player.js';
import { openModal, closeModal } from './modal.js';
import { toast, banner } from './notify.js';
import { h, dist, pick } from './util.js';
import * as fx from './fx.js';
import { sfx } from './audio.js';

// ---------------------------------------------------------------- tokens
const coins = [];
let combo = 0;
let lastCoinAt = -1e9;

export function initLoot() {
  const layer = document.getElementById('world');
  for (const sp of spawnsOf('coin')) {
    const id = String(sp.data.id);
    const el = h('div', { class: 'coin', title: 'Knowledge token' });
    layer.append(el);
    coins.push({ id, sp, el, taken: S.tokens.includes(id), ox: 0, oy: 0 });
  }
  onMeasure(syncCoins);
  syncCoins();
  on('kill', ({ target }) => maybeDrop(target));
}

function syncCoins() {
  for (const c of coins) {
    c.el.hidden = c.taken || !c.sp.active;
    c.el.style.transform = `translate3d(${c.sp.x + c.ox}px, ${c.sp.y + c.oy}px, 0)`;
  }
}

export const coinMarkers = () => coins.filter((c) => !c.taken && c.sp.active).map((c) => ({ x: c.sp.x, y: c.sp.y }));

export function updateLoot(dt) {
  for (const c of coins) {
    if (c.taken || !c.sp.active) continue;
    const cx = c.sp.x + c.ox;
    const cy = c.sp.y + c.oy;
    const d = dist(player.x, player.y, cx, cy);
    if (d < 70) {
      // Magnet pull towards the player.
      const k = Math.min(1, dt * 9);
      c.ox += (player.x - cx) * k;
      c.oy += (player.y - cy) * k;
      c.el.style.transform = `translate3d(${c.sp.x + c.ox}px, ${c.sp.y + c.oy}px, 0)`;
    } else if (c.ox || c.oy) {
      c.ox *= 0.85; c.oy *= 0.85;
      if (Math.abs(c.ox) < 0.5 && Math.abs(c.oy) < 0.5) { c.ox = 0; c.oy = 0; }
      c.el.style.transform = `translate3d(${c.sp.x + c.ox}px, ${c.sp.y + c.oy}px, 0)`;
    }
    if (d < 22) collect(c);
  }
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    if (clock.t > d.expires) { d.el.remove(); drops.splice(i, 1); continue; }
    d.el.classList.toggle('is-expiring', d.expires - clock.t < 4000);
    if (dist(player.x, player.y, d.x, d.y) < 26) pickUp(d);
  }
}

function collect(c) {
  c.taken = true;
  c.el.classList.add('is-taken');
  setTimeout(() => { c.el.hidden = true; }, 350);
  if (!S.tokens.includes(c.id)) S.tokens.push(c.id);
  combo = clock.t - lastCoinAt < 2500 ? combo + 1 : 1;
  lastCoinAt = clock.t;
  const gold = 100 * Math.max(1, combo);
  reward({ gold, xp: 10 });
  sfx('coin');
  fx.burst(c.sp.x + c.ox, c.sp.y + c.oy, '#f5c542', 10, 34);
  fx.text(c.sp.x, c.sp.y - 20, combo > 1 ? `COMBO ×${combo}  +${gold}` : `+${gold}`, 'gold');
  markAction();
  save();
  emit('coin', { count: S.tokens.length });
  if (S.tokens.length === 8) {
    reward({ gold: 500, xp: 60 });
    sfx('victory');
    banner('All knowledge tokens collected!', '+500 bonus gold', '💎');
  } else {
    toast(`Knowledge token ${S.tokens.length} / 8`, { icon: '🪙' });
  }
}

// ---------------------------------------------------------------- equipment drops
const drops = [];
const DROP_TABLE = { common: 0.5, rare: 0.3, epic: 0.15, legendary: 0.05 };

function rollItem() {
  const r = Math.random();
  let acc = 0;
  let rarity = 'common';
  for (const [k, p] of Object.entries(DROP_TABLE)) { acc += p; if (r < acc) { rarity = k; break; } }
  const pool = Object.entries(ITEMS).filter(([, it]) => it.rarity === rarity);
  return pick(pool)[0];
}

function maybeDrop(target) {
  const chance = target.boss ? 1 : 0.22;
  if (Math.random() > chance) return;
  let id = rollItem();
  if (target.boss) {
    // Bosses always drop something rare or better.
    const better = Object.entries(ITEMS).filter(([, it]) => RARITY_ORDER.indexOf(it.rarity) >= 1 && it.rarity !== 'mythic');
    id = pick(better)[0];
  }
  const it = ITEMS[id];
  const el = h('button', { type: 'button', class: 'drop', title: `${it.name} (${it.rarity})`, style: { '--rc': RARITY_COLOR[it.rarity] } }, it.icon);
  el.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
  const d = { id, x: target.x, y: target.y, el, expires: clock.t + 22000 };
  el.addEventListener('click', () => {
    player.target = { x: d.x, y: d.y, onArrive: () => pickUp(d) };
  });
  document.getElementById('world').append(el);
  drops.push(d);
}

function pickUp(d) {
  const i = drops.indexOf(d);
  if (i < 0) return;
  drops.splice(i, 1);
  d.el.remove();
  const it = ITEMS[d.id];
  const current = ITEMS[S.equipment[it.slot]];
  sfx('coin');
  if (!current || itemPower(it) > itemPower(current)) {
    offerEquip(d.id);
  } else {
    reward({ gold: 15 });
    fx.text(d.x, d.y - 20, `Salvaged ${it.name} +15`, 'gold');
  }
}

export function statLine(it) {
  if (!it) return 'Empty';
  const parts = [];
  if (it.atk) parts.push(`+${it.atk} ATK`);
  if (it.spell) parts.push(`+${it.spell} spell`);
  if (it.def) parts.push(`+${it.def} DEF`);
  if (it.regen) parts.push(`+${it.regen} MP/s`);
  return parts.join(' · ');
}

export function itemCard(id, label) {
  const it = ITEMS[id];
  return h('div', { class: 'item-card', style: { '--rc': it ? RARITY_COLOR[it.rarity] : '#475569' } },
    h('span', { class: 'item-card__label' }, label),
    h('span', { class: 'item-card__icon' }, it ? it.icon : '—'),
    h('b', null, it ? it.name : 'Nothing equipped'),
    h('small', null, it ? `${it.rarity} ${it.slot}` : ''),
    h('span', { class: 'item-card__stats' }, statLine(it)),
  );
}

function offerEquip(id) {
  const it = ITEMS[id];
  const cur = S.equipment[it.slot];
  const equip = () => {
    S.equipment[it.slot] = id;
    save();
    refreshLook();
    sfx('purchase');
    toast(`Equipped ${it.name}.`, { icon: it.icon, tone: 'good' });
    emit('equip', id);
    closeModal('equip');
  };
  openModal({
    id: 'equip',
    title: 'New gear!',
    className: 'equip-panel',
    body: (b) => {
      b.append(
        h('div', { class: 'compare' }, cur ? itemCard(cur, 'Equipped') : itemCard(null, 'Equipped'), h('span', { class: 'compare__arrow' }, '→'), itemCard(id, 'Found')),
        h('div', { class: 'modal__actions' },
          h('button', { type: 'button', class: 'btn btn--primary modal__primary', onclick: equip }, 'Equip'),
          h('button', { type: 'button', class: 'btn', onclick: () => { reward({ gold: 15 }); closeModal('equip'); } }, 'Salvage (+15 gold)'),
        ),
      );
    },
  });
}

export function clearDrops() {
  for (const d of drops) d.el.remove();
  drops.length = 0;
}
