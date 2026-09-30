// Combat on the island: target registry, damage pipeline, 3D projectiles, player attack and spells.
import { S, save } from './state.js';
import { clock, later } from './clock.js';
import { emit } from './bus.js';
import { typeMult } from './data.js';
import { player, attackPower, attackRange, spellBonus, heal, markAction, hurt } from './player.js';
import { makeOrb } from './actors.js';
import * as fx from './fx.js';
import { sfx } from './audio.js';

let scene = null;
export function initCombat(s) { scene = s; }

// ---------------------------------------------------------------- targets
const targets = new Set();
export const addTarget = (t) => targets.add(t);
export const removeTarget = (t) => targets.delete(t);
export const liveTargets = () => [...targets].filter((t) => t.alive && t.active !== false);
const hdist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

export function nearestTarget(x, z, maxDist = Infinity) {
  let best = null, bd = maxDist;
  for (const t of targets) {
    if (!t.alive || t.active === false) continue;
    const d = hdist(x, z, t.x, t.z) - t.r;
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}
export const targetsWithin = (x, z, radius) => liveTargets().filter((t) => hdist(x, z, t.x, t.z) - t.r <= radius);

// ---------------------------------------------------------------- damage
export function dealDamage(target, base, opts = {}) {
  if (!target || !target.alive) return 0;
  const { source = 'player', element = null, canCrit = source !== 'buddy', quiet = false } = opts;
  let dmg = base, mult = 1;
  if (element) { mult = typeMult(element, target.type); dmg *= mult; }
  const crit = canCrit && Math.random() < 0.15;
  if (crit) dmg *= 2;
  dmg = Math.max(1, Math.round(dmg));
  const killed = target.hit(dmg, { source, crit, element });
  if (!quiet) {
    const kind = crit ? 'crit' : source === 'buddy' ? 'buddy' : 'dmg';
    fx.text(target.x, target.y + target.h + 0.4, target.z, crit ? `${dmg}!` : `${dmg}`, kind);
    if (source === 'buddy' && mult > 1) fx.text(target.x, target.y + target.h + 1.4, target.z, 'Super effective', 'super');
    else if (source === 'buddy' && mult < 1) fx.text(target.x, target.y + target.h + 1.4, target.z, 'Not very effective', 'info');
  }
  if (crit) { S.stats.crits++; sfx('crit'); emit('crit'); }
  if (source === 'buddy' && mult > 1) { S.stats.superEffective++; emit('super-effective'); }
  emit('damage', { target, dmg, crit, source });
  if (killed) { emit('kill', { target, source }); save(); }
  return dmg;
}

// ---------------------------------------------------------------- projectiles
const projectiles = [];
const PROJ_COLOR = { fireball: '#fb923c', orb: '#c084fc', dragonfire: '#ef4444', spark: '#fde047', ember: '#fb923c', bubble: '#7dd3fc', pulse: '#818cf8', star: '#fde68a', psy: '#f472b6' };

export function spawnProjectile(p) {
  const dx = (p.tx ?? p.x + 1) - p.x, dy = (p.ty ?? p.y) - p.y, dz = (p.tz ?? p.z) - p.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  const speed = p.speed || 12;
  const mesh = makeOrb(PROJ_COLOR[p.kind] || '#fff', p.size || 1);
  mesh.position.set(p.x, p.y, p.z);
  scene.add(mesh);
  const proj = {
    x: p.x, y: p.y, z: p.z, vx: (dx / len) * speed, vy: (dy / len) * speed, vz: (dz / len) * speed, speed,
    target: p.target || null, homing: p.homing || 0, friendly: !!p.friendly, damage: p.damage || 10, radius: p.radius || 0.6,
    born: clock.t, ttl: p.ttl || 2600, element: p.element || null, source: p.source || 'player', onHit: p.onHit || null,
    trail: p.trail || null, mesh, kind: p.kind,
  };
  projectiles.push(proj);
  return proj;
}

export function updateProjectiles(dt) {
  for (const p of projectiles.slice()) {
    if (!projectiles.includes(p)) continue;
    if (p.target && p.homing && p.target.alive) {
      const ty = p.target.y + p.target.h * 0.5;
      const want = [p.target.x - p.x, ty - p.y, p.target.z - p.z];
      const wl = Math.hypot(...want) || 1;
      const k = Math.min(1, p.homing * dt);
      p.vx += ((want[0] / wl) * p.speed - p.vx) * k;
      p.vy += ((want[1] / wl) * p.speed - p.vy) * k;
      p.vz += ((want[2] / wl) * p.speed - p.vz) * k;
    }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.mesh.position.set(p.x, p.y, p.z);
    if (p.trail && clock.frame % 2 === 0) fx.burst(p.x, p.y, p.z, p.trail, 1, 1.5, 0.35, 0.6);
    let done = clock.t - p.born > p.ttl;
    if (!done && p.friendly) {
      for (const t of targets) {
        if (!t.alive || t.active === false) continue;
        if (hdist(p.x, p.z, t.x, t.z) < t.r + p.radius && p.y > t.y - 0.5 && p.y < t.y + t.h + 1.5) {
          if (p.onHit) p.onHit(t, p);
          else dealDamage(t, p.damage, { source: p.source, element: p.element });
          done = true;
          break;
        }
      }
    } else if (!done && !p.friendly) {
      if (hdist(p.x, p.z, player.x, player.z) < 0.9 + p.radius && p.y > player.y - 0.5 && p.y < player.y + 4) {
        hurt(p.damage, 'projectile');
        fx.burst(p.x, p.y, p.z, '#fb923c', 6, 3, 0.4, 0.5);
        done = true;
      }
    }
    if (!done && p.y < -8) done = true;
    if (done) { scene.remove(p.mesh); const i = projectiles.indexOf(p); if (i >= 0) projectiles.splice(i, 1); }
  }
}
export function clearHostileProjectiles() {
  for (const p of projectiles.slice()) { if (p.friendly) continue; scene.remove(p.mesh); projectiles.splice(projectiles.indexOf(p), 1); }
}
export function clearAllProjectiles() { for (const p of projectiles) scene.remove(p.mesh); projectiles.length = 0; }

// ---------------------------------------------------------------- player attack
/**
 * One melee swing lands (weapon.js calls this at the swing's hit moment). Hits every live target in
 * front of the scholar: within attackRange() × range, within ±arc of `yaw`, and roughly at his height.
 * Returns how many were hit. Each target is pushed back (target.knock(dx, dz, power) when it has one).
 */
export function swingHit({ step = 0, arc = 1.2, range = 1, mult = 1, knock = 5, yaw = player.yaw } = {}) {
  if (player.dead) return 0;
  const reach = attackRange() * range;
  const hits = targetsWithin(player.x, player.z, reach).filter((t) => {
    if (Math.abs((t.y + (t.h || 2) * 0.5) - (player.y + 1.5)) > 3.5 + (t.h || 2) * 0.5) return false;
    if (arc >= Math.PI) return true;
    const a = Math.atan2(t.x - player.x, t.z - player.z);
    const d = Math.abs(((a - yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
    return d <= arc || hdist(player.x, player.z, t.x, t.z) < t.r + 0.8;
  });
  const dmg = attackPower() * mult;
  for (const t of hits) {
    const dx = t.x - player.x, dz = t.z - player.z, l = Math.hypot(dx, dz) || 1;
    fx.burst(t.x, t.y + t.h * 0.5, t.z, step === 2 ? '#fde68a' : '#bae6fd', 7, 4, 0.4, 0.55);
    dealDamage(t, dmg, { source: 'player' });
    t.knock?.(dx / l, dz / l, t.boss ? knock * 0.15 : knock);
  }
  if (hits.length) sfx('hit');
  return hits.length;
}
/** Kept for callers from before the combo: one plain swing's worth of damage, no animation. */
export function playerAttack() { markAction(); return swingHit({}); }

// ---------------------------------------------------------------- spells
export const SPELLS = {
  fireball:  { key: '1', name: 'Fireball',  icon: 'fireball',           mp: 20, cd: 3000,  desc: '30 dmg homing bolt' },
  heal:      { key: '2', name: 'Mend',      icon: 'healing',            mp: 30, cd: 8000,  desc: 'Restore 40+ HP' },
  lightning: { key: '3', name: 'Lightning', icon: 'lightning-branches', mp: 40, cd: 10000, desc: '25 dmg to everything nearby' },
  meteor:    { key: '4', name: 'Meteor',    icon: 'burning-meteor',     mp: 80, cd: 30000, desc: '5 meteors, 50 dmg each' },
};
const lastCast = { fireball: -1e9, heal: -1e9, lightning: -1e9, meteor: -1e9 };
export const cooldownLeft = (n) => Math.max(0, (lastCast[n] + SPELLS[n].cd - clock.t) / SPELLS[n].cd);

export function castSpell(name) {
  const s = SPELLS[name];
  if (!s || player.dead) return false;
  if (clock.t - lastCast[name] < s.cd) return false;
  if (player.mp < s.mp) { emit('spell:nomp', name); sfx('error'); return false; }
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
    const t = nearestTarget(player.x, player.z, 22);
    const tx = t ? t.x : player.x + Math.sin(player.yaw) * 10;
    const tz = t ? t.z : player.z + Math.cos(player.yaw) * 10;
    const ty = t ? t.y + t.h * 0.5 : player.y + 1.5;
    spawnProjectile({
      x: player.x, y: player.y + 2, z: player.z, tx, ty, tz, target: t, homing: 5, speed: 16,
      friendly: true, damage: 30 + spellBonus(), radius: 0.8, source: 'spell', kind: 'fireball', trail: '#fb923c', size: 1.3,
      onHit: (hit, p) => { fx.ring(p.x, hit.y, p.z, '#fb923c', 2.2); fx.burst(p.x, p.y, p.z, '#fb923c', 14, 5); dealDamage(hit, p.damage, { source: 'spell' }); },
    });
  },
  heal() {
    sfx('heal');
    heal(40 + S.player.level * 2);
    fx.ring(player.x, player.y, player.z, '#4ade80', 2.4);
    fx.burst(player.x, player.y + 1.5, player.z, '#86efac', 14, 4, 0.8, 0.5);
  },
  lightning() {
    sfx('zap');
    for (const t of targetsWithin(player.x, player.z, 14)) {
      fx.beam(t.x, t.y + 14, t.z, t.x, t.y + t.h * 0.5, t.z, '#93c5fd', 0.14, 0.3);
      fx.burst(t.x, t.y + t.h * 0.5, t.z, '#93c5fd', 8, 4, 0.5, 0.5);
      dealDamage(t, 25 + spellBonus(), { source: 'spell' });
    }
  },
  meteor() {
    sfx('meteor');
    for (let i = 0; i < 5; i++) {
      later(i * 260, () => {
        if (player.dead) return;
        const pool = targetsWithin(player.x, player.z, 16);
        const aim = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
        const x = aim ? aim.x + (Math.random() - 0.5) * 2 : player.x + (Math.random() - 0.5) * 10;
        const z = aim ? aim.z + (Math.random() - 0.5) * 2 : player.z + (Math.random() - 0.5) * 10;
        const gy = (aim ? aim.y : player.y);
        const m = makeOrb('#fbbf24', 2.2);
        m.position.set(x, gy + 18, z);
        scene.add(m);
        const start = clock.t;
        const fall = () => {
          const k = Math.min(1, (clock.t - start) / 420);
          m.position.y = gy + 18 - k * 18;
          if (k < 1) later(16, fall);
          else {
            scene.remove(m);
            sfx('boom');
            fx.ring(x, gy, z, '#f2b84b', 4);
            fx.burst(x, gy + 0.5, z, '#fbbf24', 20, 7, 0.7, 0.8);
            for (const t of targetsWithin(x, z, 3.5)) dealDamage(t, 50 + spellBonus(), { source: 'spell' });
          }
        };
        fall();
      });
    }
  },
};
