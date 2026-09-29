// Knowledge tokens (the 8 collectibles scattered over the island), gear drops, and the
// equip-compare prompt.
import { S, save } from './state.js';
import { clock } from './clock.js';
import { emit, on } from './bus.js';
import { ZONES } from './world.js';
import { ITEMS, RARITY_COLOR, RARITY_ORDER, itemPower } from './data.js';
import { player, reward, refreshLook } from './player.js';
import { openModal, closeModal, isModalOpen } from './modal.js';
import { toast, banner } from './notify.js';
import { h, pick, icon } from './util.js';
import { makeActor, makeOrb } from './actors.js';
import * as fx from './fx.js';
import { sfx } from './audio.js';

let world = null, scene = null;

// ---------------------------------------------------------------- tokens
const TOKEN_SPOTS = [
  ['1', 'plaza', -7, -2], ['2', 'meadow', 6, 5], ['3', 'meadow', -5, -6], ['4', 'camp', -4, 4],
  ['5', 'shadow', 5, -5], ['6', 'ice', -5, 3], ['7', 'peak', -6, 4], ['8', 'door', 3, 3],
];
const tokens = [];
let combo = 0;
let lastTokenAt = -1e9;

export function initLoot(w, s) {
  world = w; scene = s;
  for (const [id, zone, ox, oz] of TOKEN_SPOTS) {
    const zn = ZONES[zone];
    let x = zn.x + ox, z = zn.z + oz;
    for (let t = 0; t < 40 && (!world.walkable(x, z) || world.isBlocked(x, z)); t++) { x += (Math.random() - 0.5) * 3; z += (Math.random() - 0.5) * 3; }
    if (!world.walkable(x, z)) continue;
    const mesh = makeActor('token', { scale: 0.16, maxHalf: 1 });
    mesh.position.set(x, world.surfaceY(x, z) + 1, z);
    mesh.visible = !S.tokens.includes(id);
    scene.add(mesh);
    tokens.push({ id, x, z, y: world.surfaceY(x, z), mesh, taken: S.tokens.includes(id), ox: 0, oz: 0, anim: Math.random() * 6 });
  }
  on('kill', ({ target }) => maybeDrop(target));
}

export const tokenMarkers = () => tokens.filter((t) => !t.taken).map((t) => ({ x: t.x, z: t.z }));

export function updateLoot(dt) {
  for (const t of tokens) {
    if (t.taken) continue;
    t.anim += dt * 2;
    const cx = t.x + t.ox, cz = t.z + t.oz;
    const d = Math.hypot(player.x - cx, player.z - cz);
    if (d < 3.5) {
      const k = Math.min(1, dt * 8);
      t.ox += (player.x - cx) * k;
      t.oz += (player.z - cz) * k;
    } else if (t.ox || t.oz) {
      t.ox *= 0.85; t.oz *= 0.85;
    }
    t.mesh.position.set(t.x + t.ox, t.y + 1 + Math.sin(t.anim) * 0.2, t.z + t.oz);
    t.mesh.rotation.y = t.anim;
    if (d < 1.1) collect(t);
  }
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    if (clock.t > d.expires) { remove(d); drops.splice(i, 1); continue; }
    d.anim += dt * 3;
    d.mesh.position.y = d.y + 0.6 + Math.sin(d.anim) * 0.12;
    d.mesh.rotation.y += dt;
    d.tag.classList.toggle('is-expiring', d.expires - clock.t < 4000);
    if (Math.hypot(player.x - d.x, player.z - d.z) < 1.4) pickUp(d);
  }
}

function collect(t) {
  t.taken = true;
  t.mesh.visible = false;
  if (!S.tokens.includes(t.id)) S.tokens.push(t.id);
  combo = clock.t - lastTokenAt < 2500 ? combo + 1 : 1;
  lastTokenAt = clock.t;
  const gold = 100 * Math.max(1, combo);
  reward({ gold, xp: 10 });
  sfx('coin');
  fx.burst(t.x + t.ox, t.y + 1, t.z + t.oz, '#f2b84b', 12, 4, 0.6, 0.6);
  fx.text(t.x + t.ox, t.y + 2.2, t.z + t.oz, combo > 1 ? `Combo ×${combo}  +${gold}` : `+${gold}`, 'gold');
  save();
  emit('token', { count: S.tokens.length });
  if (S.tokens.length === 8) {
    reward({ gold: 500, xp: 60 });
    sfx('victory');
    banner('All eight tokens found', '+500 bonus gold', 'gems');
  } else {
    toast(`Knowledge token ${S.tokens.length} / 8`, { icon: 'two-coins' });
  }
}

// ---------------------------------------------------------------- equipment drops
const drops = [];
const DROP_TABLE = { common: 0.5, rare: 0.3, epic: 0.15, legendary: 0.05 };

function rollItem() {
  const r = Math.random();
  let acc = 0, rarity = 'common';
  for (const [k, p] of Object.entries(DROP_TABLE)) { acc += p; if (r < acc) { rarity = k; break; } }
  return pick(Object.entries(ITEMS).filter(([, it]) => it.rarity === rarity))[0];
}

function maybeDrop(target) {
  const chance = target.boss ? 1 : 0.22;
  if (Math.random() > chance) return;
  let id = rollItem();
  if (target.boss) {
    // Bosses always drop something rare or better.
    id = pick(Object.entries(ITEMS).filter(([, it]) => RARITY_ORDER.indexOf(it.rarity) >= 1 && it.rarity !== 'mythic'))[0];
  }
  const it = ITEMS[id];
  const mesh = makeOrb(RARITY_COLOR[it.rarity], 1.1);
  const y = world.surfaceY(target.x, target.z);
  mesh.position.set(target.x, y + 0.6, target.z);
  scene.add(mesh);
  const tag = h('div', { class: 'g__tag', style: { '--rc': RARITY_COLOR[it.rarity] } }, icon(it.icon, { size: 14 }), it.name);
  const d = { id, x: target.x, y, z: target.z, mesh, tag, expires: clock.t + 22000, anim: 0 };
  d.unpin = fx.pin(tag, () => ({ x: d.x, y: d.y + 1.4, z: d.z }));
  drops.push(d);
}

function remove(d) { scene.remove(d.mesh); d.unpin(); }

function pickUp(d) {
  const i = drops.indexOf(d);
  if (i < 0) return;
  drops.splice(i, 1);
  remove(d);
  const it = ITEMS[d.id];
  const current = ITEMS[S.equipment[it.slot]];
  sfx('coin');
  if (!current || itemPower(it) > itemPower(current)) offerEquip(d.id);
  else { reward({ gold: 15 }); fx.text(d.x, d.y + 1.6, d.z, `Salvaged ${it.name} +15`, 'gold'); }
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
    h('span', { class: 'item-card__icon' }, it ? icon(it.icon, { size: 30 }) : '—'),
    h('b', null, it ? it.name : 'Nothing equipped'),
    h('small', null, it ? `${it.rarity} ${it.slot}` : ''),
    h('span', { class: 'item-card__stats' }, statLine(it)),
  );
}

// Offers queue so two drops picked up together are both shown; closing without choosing salvages.
const offers = [];
function offerEquip(id) {
  offers.push(id);
  if (!isModalOpen('equip')) showNextOffer();
}
function showNextOffer() {
  const id = offers.shift();
  if (!id) return;
  const it = ITEMS[id];
  const cur = S.equipment[it.slot];
  let decided = false;
  const equip = () => {
    decided = true;
    S.equipment[it.slot] = id;
    save();
    refreshLook();
    sfx('purchase');
    toast(`Equipped ${it.name}.`, { icon: it.icon, tone: 'good' });
    emit('equip', id);
    closeModal('equip');
  };
  const salvage = () => { decided = true; reward({ gold: 15 }); closeModal('equip'); };
  openModal({
    id: 'equip',
    title: offers.length ? `New gear (${offers.length} more)` : 'New gear',
    className: 'equip-panel',
    onClose: () => {
      if (!decided) { reward({ gold: 15 }); toast(`Salvaged ${it.name} for 15 gold.`, { icon: 'two-coins' }); }
      if (offers.length) setTimeout(showNextOffer, 180);
    },
    body: (b) => b.append(
      h('div', { class: 'compare' }, itemCard(cur || null, 'Equipped'), h('span', { class: 'compare__arrow' }, '→'), itemCard(id, 'Found')),
      h('div', { class: 'modal__actions' },
        h('button', { type: 'button', class: 'btn btn--primary modal__primary', onclick: equip }, 'Equip'),
        h('button', { type: 'button', class: 'btn', onclick: salvage }, 'Salvage (+15 gold)'),
      ),
    ),
  });
}

export function clearDrops() {
  for (const d of drops) remove(d);
  drops.length = 0;
}
