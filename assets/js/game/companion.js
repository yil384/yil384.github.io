// The active party buddy follows the player around the page and fights alongside:
// typed auto-attacks (type matchups matter), plus a signature move on G.
import { S } from './state.js';
import { clock } from './clock.js';
import { on } from './bus.js';
import { SPECIES, TYPE_COLOR } from './data.js';
import { player, engaged, heal, markAction, mountSpecies } from './player.js';
import {
  nearestTarget, targetsWithin, visibleTargets, dealDamage, spawnProjectile,
} from './combat.js';
import { activeId, buddyLevel, grantBuddyXp } from './monsters.js';
import { applySprite } from './sprites.js';
import { h, smooth, dist } from './util.js';
import * as fx from './fx.js';
import { sfx } from './audio.js';
import { toast } from './notify.js';

export const buddy = {
  id: null,
  x: 0, y: 0,
  lastShot: -1e9,
  sigReadyAt: 0,
  el: null,
  tag: null,
  body: null,
};

export function initCompanion() {
  buddy.body = h('div', { class: 'buddy__body' });
  buddy.tag = h('div', { class: 'buddy__tag' });
  buddy.el = h('div', { class: 'ent buddy' }, h('div', { class: 'ent__shadow' }), buddy.tag, buddy.body);
  document.getElementById('world').append(buddy.el);
  refreshBuddy();
  on('buddy:changed', () => {
    refreshBuddy();
    fx.ring(buddy.x, buddy.y, TYPE_COLOR[SPECIES[buddy.id].type], 70);
    sfx('buddy');
  });
  on('buddy:levelup', ({ id }) => { if (id === buddy.id) refreshBuddy(); });
  on('mount:changed', refreshBuddy);
  // Buddies grow from field kills, not just from turn-based battles.
  on('kill', ({ target, source }) => {
    const id = activeId();
    const xp = target.boss ? 60 : source === 'buddy' ? 16 : 8;
    grantBuddyXp(id, xp);
  });
}

export function refreshBuddy() {
  buddy.id = activeId();
  const sp = SPECIES[buddy.id];
  applySprite(buddy.body, buddy.id, 3);
  buddy.tag.textContent = `${sp.name} · Lv.${buddyLevel(buddy.id)}`;
  buddy.el.style.setProperty('--tc', TYPE_COLOR[sp.type]);
  // When you ride your own buddy it carries you instead of trailing behind.
  buddy.el.classList.toggle('is-ridden', mountSpecies() === buddy.id);
}

export function placeBuddy() {
  buddy.x = player.x - 44 * player.facing;
  buddy.y = player.y + 6;
}

const power = (sp) => sp.field.power * (1 + (buddyLevel(buddy.id) - 1) * 0.1);

export function updateCompanion(dt) {
  const sp = SPECIES[buddy.id];
  if (!sp) return;
  const ridden = mountSpecies() === buddy.id;
  // Follow: trail behind the player, a little to the side.
  const tx = ridden ? player.x : player.x - 46 * player.facing;
  const ty = ridden ? player.y : player.y + 8;
  const k = smooth(ridden ? 30 : 5.5, dt);
  buddy.x += (tx - buddy.x) * k;
  buddy.y += (ty - buddy.y) * k;
  const far = dist(buddy.x, buddy.y, player.x, player.y) > 600;
  if (far) placeBuddy();

  // Auto-attack the nearest threat while the player is in the fight.
  if (engaged() && !player.dead && clock.t - buddy.lastShot >= sp.field.interval) {
    const t = nearestTarget(buddy.x, buddy.y, sp.field.range);
    if (t) {
      buddy.lastShot = clock.t;
      shoot(sp, t);
    }
  }
  buddy.el.style.transform = `translate3d(${buddy.x}px, ${buddy.y}px, 0)`;
  buddy.el.classList.toggle('is-left', (player.x - buddy.x) < -4 || (ridden && player.facing < 0));
  buddy.el.classList.toggle('is-moving', player.walking);
}

function shoot(sp, t) {
  buddy.el.classList.remove('is-attacking');
  void buddy.el.offsetWidth;
  buddy.el.classList.add('is-attacking');
  spawnProjectile({
    x: buddy.x, y: buddy.y - 8, tx: t.x, ty: t.y, target: t, homing: 6,
    speed: 380, friendly: true, damage: power(sp), radius: 9, element: sp.type,
    source: 'buddy', cls: `proj--${sp.field.proj}`, trail: TYPE_COLOR[sp.type],
  });
}

export function sigCooldown() {
  const sp = SPECIES[buddy.id];
  if (!sp) return 0;
  return Math.max(0, (buddy.sigReadyAt - clock.t) / sp.field.sig.cd);
}

/** G: the buddy's signature move. */
export function signature() {
  const sp = SPECIES[buddy.id];
  if (!sp || player.dead) return false;
  if (clock.t < buddy.sigReadyAt) return false;
  const sig = sp.field.sig;
  const lvBoost = 1 + (buddyLevel(buddy.id) - 1) * 0.1;
  const color = TYPE_COLOR[sp.type];
  const opts = { source: 'buddy', element: sp.type };
  markAction();

  const shout = () => fx.text(buddy.x, buddy.y - 40, `${sig.name}!`, 'super');

  if (sig.kind === 'chain') {
    let from = { x: buddy.x, y: buddy.y };
    const hit = new Set();
    for (let i = 0; i < sig.count; i++) {
      const next = nearestFrom(from.x, from.y, 420, hit);
      if (!next) break;
      hit.add(next);
      fx.beam(from.x, from.y, next.x, next.y, 'fx-beam--electric', 380);
      fx.burst(next.x, next.y, color, 8, 30);
      dealDamage(next, sig.power * lvBoost * (1 - i * 0.08), opts);
      from = next;
    }
    if (!hit.size) return noTarget();
  } else if (sig.kind === 'volley') {
    const list = visibleTargets(0);
    if (!list.length) return noTarget();
    for (let i = 0; i < sig.count; i++) {
      const t = list[i % list.length];
      spawnProjectile({
        x: buddy.x, y: buddy.y - 10, tx: buddy.x + Math.cos(i) * 60, ty: buddy.y - 80, target: t, homing: 9,
        speed: 360, friendly: true, damage: sig.power * lvBoost, radius: 10, element: sp.type, source: 'buddy',
        cls: 'proj--star', trail: color, ttl: 3000,
      });
    }
  } else if (sig.kind === 'burst') {
    const t = nearestTarget(buddy.x, buddy.y, 360);
    if (!t) return noTarget();
    fx.beam(buddy.x, buddy.y, t.x, t.y, 'fx-beam--fire', 420);
    fx.ring(t.x, t.y, color, sig.radius * 2);
    fx.burst(t.x, t.y, color, 16, sig.radius);
    fx.shake(5, 180);
    for (const v of targetsWithin(t.x, t.y, sig.radius)) dealDamage(v, sig.power * lvBoost, opts);
  } else if (sig.kind === 'beam') {
    const t = nearestTarget(buddy.x, buddy.y, 520);
    if (!t) return noTarget();
    fx.beam(buddy.x, buddy.y, t.x, t.y, 'fx-beam--dragon', 520);
    fx.ring(t.x, t.y, color, 110);
    fx.shake(6, 200);
    dealDamage(t, sig.power * lvBoost, opts);
  } else if (sig.kind === 'heal') {
    heal(sig.heal + buddyLevel(buddy.id) * 2);
    fx.ring(player.x, player.y, '#60a5fa', 160);
    fx.burst(player.x, player.y, '#93c5fd', 14, 60);
    for (const v of targetsWithin(buddy.x, buddy.y, sig.radius)) dealDamage(v, sig.power * lvBoost, opts);
  } else if (sig.kind === 'nova') {
    const list = visibleTargets(0);
    fx.ring(buddy.x, buddy.y, color, 260);
    fx.flash('rgba(244,114,182,0.18)');
    for (const v of list) {
      fx.beam(buddy.x, buddy.y, v.x, v.y, 'fx-beam--psy', 420);
      dealDamage(v, sig.power * lvBoost, opts);
    }
    player.shield = Math.max(player.shield, sig.shield || 0);
  }

  shout();
  sfx('signature');
  buddy.sigReadyAt = clock.t + sig.cd;
  S.stats.signatures = (S.stats.signatures || 0) + 1;
  return true;
}

function nearestFrom(x, y, range, exclude) {
  let best = null;
  let bd = range;
  for (const t of visibleTargets(80)) {
    if (exclude.has(t)) continue;
    const d = dist(x, y, t.x, t.y);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

function noTarget() {
  toast(`${SPECIES[buddy.id].name} doesn't see any targets nearby.`, { icon: '👀' });
  return false;
}
