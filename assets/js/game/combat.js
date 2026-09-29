// Combat core: a single target registry for field enemies and bosses, one damage pipeline,
// projectiles (friendly and hostile) and the player's attack + Q/W/E/R spells.
import { S, save } from './state.js';
import { clock, later } from './clock.js';
import { emit } from './bus.js';
import { view, onScreen } from './world.js';
import { typeMult, TYPE_COLOR } from './data.js';
import {
  player, attackPower, attackRange, spellBonus, heal, markAction, hurt,
} from './player.js';
import * as fx from './fx.js';
import { sfx } from './audio.js';
import { dist, rand, pick } from './util.js';

// ---------------------------------------------------------------- targets
/**
 * A target is any object with:
 *   { id, name, x, y, r, hp, maxHp, type, alive, boss?, hit(dmg, info) -> killed:boolean }
 */
const targets = new Set();
export const addTarget = (t) => targets.add(t);
export const removeTarget = (t) => targets.delete(t);
export const liveTargets = () => [...targets].filter((t) => t.alive && t.active !== false);

export function nearestTarget(x, y, maxDist = Infinity) {
  let best = null;
  let bd = maxDist;
  for (const t of targets) {
    if (!t.alive || t.active === false) continue;
    const d = dist(x, y, t.x, t.y) - t.r;
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

export function targetsWithin(x, y, radius) {
  return liveTargets().filter((t) => dist(x, y, t.x, t.y) - t.r <= radius);
}

export function visibleTargets(margin = 0) {
  return liveTargets().filter((t) => onScreen(t.x, t.y, margin));
}

// ---------------------------------------------------------------- damage pipeline
/**
 * opts: { source: 'player' | 'spell' | 'buddy', element?: type, canCrit?: boolean, quiet?: boolean }
 * Returns the damage dealt (0 if the target was already dead).
 */
export function dealDamage(target, base, opts = {}) {
  if (!target || !target.alive) return 0;
  const { source = 'player', element = null, canCrit = source !== 'buddy', quiet = false } = opts;
  let dmg = base;
  let mult = 1;
  if (element) {
    mult = typeMult(element, target.type);
    dmg *= mult;
  }
  const crit = canCrit && Math.random() < 0.15;
  if (crit) dmg *= 2;
  dmg = Math.max(1, Math.round(dmg));

  const killed = target.hit(dmg, { source, crit, element });
  if (!quiet) {
    const kind = crit ? 'crit' : source === 'buddy' ? 'buddy' : 'dmg';
    fx.text(target.x, target.y - target.r - 10, crit ? `${dmg}!` : `${dmg}`, kind);
    if (source === 'buddy' && mult > 1) fx.text(target.x, target.y - target.r - 30, 'Super effective!', 'super');
    else if (source === 'buddy' && mult < 1) fx.text(target.x, target.y - target.r - 30, 'Not very effective…', 'info');
  }
  if (crit) {
    S.stats.crits++;
    sfx('crit');
    emit('crit');
  }
  if (source === 'buddy' && mult > 1) {
    S.stats.superEffective++;
    emit('super-effective');
  }
  emit('damage', { target, dmg, crit, source });
  if (killed) {
    emit('kill', { target, source });
    save();
  }
  return dmg;
}

// ---------------------------------------------------------------- projectiles
const projectiles = [];

/**
 * spawnProjectile({ x, y, tx, ty, target?, speed, cls, friendly, damage, radius, ttl, homing, element, source, onHit })
 */
export function spawnProjectile(p) {
  const ang = Math.atan2((p.ty ?? p.y) - p.y, (p.tx ?? p.x + 1) - p.x);
  const proj = {
    x: p.x, y: p.y,
    vx: Math.cos(ang) * (p.speed || 300),
    vy: Math.sin(ang) * (p.speed || 300),
    speed: p.speed || 300,
    target: p.target || null,
    homing: p.homing || 0,
    friendly: !!p.friendly,
    damage: p.damage || 10,
    radius: p.radius || 10,
    born: clock.t,
    ttl: p.ttl || 2600,
    element: p.element || null,
    source: p.source || 'player',
    onHit: p.onHit || null,
    trail: p.trail || null,
    el: fx.worldEl(`proj ${p.cls || ''}`, p.x, p.y),
  };
  projectiles.push(proj);
  return proj;
}

export function updateProjectiles(dt) {
  // Iterate a snapshot: a hit can kill the player, which pauses the world and clears
  // hostile projectiles while we are still looping.
  for (const p of projectiles.slice()) {
    if (!projectiles.includes(p)) continue;
    if (p.target && p.homing && p.target.alive) {
      const want = Math.atan2(p.target.y - p.y, p.target.x - p.x);
      const cur = Math.atan2(p.vy, p.vx);
      let diff = want - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = Math.max(-p.homing * dt, Math.min(p.homing * dt, diff));
      const a = cur + turn;
      p.vx = Math.cos(a) * p.speed;
      p.vy = Math.sin(a) * p.speed;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${Math.atan2(p.vy, p.vx)}rad)`;
    if (p.trail && clock.frame % 3 === 0) fx.burst(p.x, p.y, p.trail, 1, 8, 4);

    let done = clock.t - p.born > p.ttl;
    if (!done && p.friendly) {
      for (const t of targets) {
        if (!t.alive || t.active === false) continue;
        if (dist(p.x, p.y, t.x, t.y) < t.r + p.radius) {
          if (p.onHit) p.onHit(t, p);
          else dealDamage(t, p.damage, { source: p.source, element: p.element });
          done = true;
          break;
        }
      }
    } else if (!done && !p.friendly) {
      if (dist(p.x, p.y, player.x, player.y) < 16 + p.radius) {
        hurt(p.damage, 'projectile');
        fx.burst(p.x, p.y, '#fb923c', 6, 24, 4);
        done = true;
      }
    }
    if (!done && (p.y < view.sy - 400 || p.y > view.sy + view.vh + 400)) done = true;
    if (done) {
      p.el.remove();
      const i = projectiles.indexOf(p);
      if (i >= 0) projectiles.splice(i, 1);
    }
  }
}

/** Fade out hostile projectiles (used when the world pauses so nothing is waiting on resume). */
export function clearHostileProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (p.friendly) continue;
    p.el.classList.add('proj--fade');
    const el = p.el;
    setTimeout(() => el.remove(), 250);
    projectiles.splice(i, 1);
  }
}

export function clearAllProjectiles() {
  for (const p of projectiles) p.el.remove();
  projectiles.length = 0;
}

// ---------------------------------------------------------------- player attack
let lastAttack = -1e9;

export function playerAttack() {
  if (player.dead || clock.t - lastAttack < 380) return;
  lastAttack = clock.t;
  markAction();
  sfx('swing');
  fx.ring(player.x, player.y, '#f5c542', 46, 'fx-ring--slash');

  const range = attackRange();
  const hits = targetsWithin(player.x, player.y, range);
  const dmg = attackPower();
  for (const t of hits) {
    const d = dist(player.x, player.y, t.x, t.y);
    if (d > 70) fx.beam(player.x, player.y, t.x, t.y, 'fx-beam--laser');
    else fx.burst(t.x, t.y, '#fde68a', 5, 18, 4);
    dealDamage(t, dmg, { source: 'player' });
  }
  if (hits.length) sfx('hit');
}

// ---------------------------------------------------------------- spells
export const SPELLS = {
  fireball:  { key: 'q', name: 'Fireball',     icon: '🔥', mp: 20, cd: 3000,  desc: '30 dmg homing bolt' },
  heal:      { key: 'w', name: 'Heal',         icon: '💚', mp: 30, cd: 8000,  desc: 'Restore 40+ HP' },
  lightning: { key: 'e', name: 'Lightning',    icon: '⚡', mp: 40, cd: 10000, desc: '25 dmg to everything on screen' },
  meteor:    { key: 'r', name: 'Meteor Storm', icon: '☄️', mp: 80, cd: 30000, desc: '5 meteors, 50 dmg each' },
};
const lastCast = { fireball: -1e9, heal: -1e9, lightning: -1e9, meteor: -1e9 };

export function cooldownLeft(name) {
  const s = SPELLS[name];
  return Math.max(0, (lastCast[name] + s.cd - clock.t) / s.cd);
}

export function castSpell(name) {
  const s = SPELLS[name];
  if (!s || player.dead) return false;
  if (clock.t - lastCast[name] < s.cd) return false;
  if (player.mp < s.mp) {
    emit('spell:nomp', name);
    sfx('error');
    return false;
  }
  player.mp -= s.mp;
  lastCast[name] = clock.t;
  markAction();
  S.stats.spells[name] = true;
  save();
  SPELL_FX[name]();
  emit('spell', name);
  return true;
}

const SPELL_FX = {
  fireball() {
    sfx('fireball');
    const t = nearestTarget(player.x, player.y, 650);
    const tx = t ? t.x : player.x + player.facing * 300;
    const ty = t ? t.y : player.y;
    spawnProjectile({
      x: player.x, y: player.y, tx, ty, target: t, homing: 5, speed: 420,
      friendly: true, damage: 30 + spellBonus(), radius: 12, source: 'spell', cls: 'proj--fireball', trail: '#fb923c',
      onHit: (hit, p) => {
        fx.ring(p.x, p.y, '#fb923c', 70);
        fx.burst(p.x, p.y, '#fb923c', 10, 40);
        dealDamage(hit, p.damage, { source: 'spell' });
      },
    });
  },
  heal() {
    sfx('heal');
    heal(40 + S.player.level * 2);
    fx.ring(player.x, player.y, '#4ade80', 80);
    fx.burst(player.x, player.y, '#86efac', 12, 40);
  },
  lightning() {
    sfx('zap');
    fx.flash('rgba(191,219,254,0.35)');
    fx.shake(5, 180);
    const list = visibleTargets(20);
    for (const t of list) {
      fx.bolt(t.x, t.y);
      fx.burst(t.x, t.y, '#93c5fd', 6, 26, 4);
      dealDamage(t, 25 + spellBonus(), { source: 'spell' });
    }
  },
  meteor() {
    sfx('meteor');
    fx.flash('rgba(15,10,40,0.35)');
    for (let i = 0; i < 5; i++) {
      later(i * 260, () => {
        if (player.dead) return;
        const pool = visibleTargets(0);
        const aim = pool.length ? pick(pool) : null;
        const x = aim ? aim.x + rand(-40, 40) : view.sx + rand(80, view.vw - 80);
        const y = aim ? aim.y + rand(-30, 30) : view.sy + rand(view.vh * 0.3, view.vh * 0.8);
        const m = fx.worldEl('meteor', x, y);
        later(420, () => {
          m.remove();
          sfx('boom');
          fx.ring(x, y, '#f5c542', 150);
          fx.burst(x, y, '#fbbf24', 14, 70);
          fx.shake(6, 160);
          for (const t of targetsWithin(x, y, 110)) dealDamage(t, 50 + spellBonus(), { source: 'spell' });
        });
      });
    }
  },
};

export { TYPE_COLOR };
