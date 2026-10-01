// The active companion follows the player, auto-attacks with type matchups, and has a signature move (G).
import { S } from './state.js';
import { clock } from './clock.js';
import { on } from './bus.js';
import { SPECIES, TYPE_COLOR } from './data.js';
import { player, heal, markAction } from './player.js';
import { mode } from './mode.js';
import { nearestTarget, targetsWithin, liveTargets, dealDamage, spawnProjectile } from './combat.js';
import { activeId, buddyLevel, grantBuddyXp } from './monsters.js';
import { makeActor } from './actors.js';
import * as fx from './fx.js';
import { sfx } from './audio.js';
import { toast } from './notify.js';

export const buddy = { id: null, x: 0, y: 0, z: 0, lastShot: -1e9, sigReadyAt: 0, mesh: null, anim: 0, hop: 0 };
let scene = null;
let world = null;

export function initCompanion(s, w) {
  scene = s; world = w;
  refreshBuddy();
  on('buddy:changed', () => { refreshBuddy(); fx.ring(buddy.x, buddy.y, buddy.z, TYPE_COLOR[SPECIES[buddy.id].type], 2); sfx('buddy'); });
  on('kill', ({ target, source }) => grantBuddyXp(activeId(), target.boss ? 60 : source === 'buddy' ? 16 : 8));
}

export function refreshBuddy() {
  const id = activeId();
  if (buddy.mesh && buddy.id === id) return;
  if (buddy.mesh) scene.remove(buddy.mesh);
  buddy.id = id;
  buddy.mesh = makeActor(SPECIES[id].sprite, { scale: 0.2 });
  buddy.mesh.userData.pickId = 'bit';
  buddy.mesh.userData.pickLabel = SPECIES[id].name;
  scene.add(buddy.mesh);
}

export function placeBuddy() {
  // behind the scholar, or beside, or (last resort) right there: never inside a wall, a tree or a prop
  for (const a of [0, 0.8, -0.8, 1.6, -1.6, Math.PI]) {
    const x = player.x - Math.sin(player.yaw + a) * 1.6, z = player.z - Math.cos(player.yaw + a) * 1.6;
    if (world.walkable(x, z) && !world.isBlocked(x, z)) { buddy.x = x; buddy.z = z; return; }
  }
  buddy.x = player.x; buddy.z = player.z;
}

const power = (sp) => sp.field.power * (1 + (buddyLevel(buddy.id) - 1) * 0.1);

export function updateCompanion(dt) {
  const sp = SPECIES[buddy.id];
  if (!sp) return;
  const tx = player.x - Math.sin(player.yaw) * 1.6 - Math.cos(player.yaw) * 0.7;
  const tz = player.z - Math.cos(player.yaw) * 1.6 + Math.sin(player.yaw) * 0.7;
  const k = Math.min(1, dt * 5);
  // slide along walls and props like everyone else (out of one freely, if it ever starts inside)
  const nx = buddy.x + (tx - buddy.x) * k, nz = buddy.z + (tz - buddy.z) * k;
  const stuck = world.isBlocked(buddy.x, buddy.z);
  if (stuck || !world.isBlocked(nx, buddy.z)) buddy.x = nx;
  if (stuck || !world.isBlocked(buddy.x, nz)) buddy.z = nz;
  if (Math.hypot(buddy.x - player.x, buddy.z - player.z) > 20) placeBuddy();
  if (!world.walkable(buddy.x, buddy.z)) placeBuddy();
  buddy.y = world.surfaceY(buddy.x, buddy.z);
  buddy.anim += dt * (player.walking ? 7 : 3);
  const t = nearestTarget(buddy.x, buddy.z, sp.field.range);
  if (mode.play && t && !player.dead && clock.t - buddy.lastShot >= sp.field.interval) {
    buddy.lastShot = clock.t;
    spawnProjectile({
      x: buddy.x, y: buddy.y + 1.4, z: buddy.z, tx: t.x, ty: t.y + t.h * 0.5, tz: t.z, target: t, homing: 6, speed: 13,
      friendly: true, damage: power(sp), radius: 0.7, element: sp.type, source: 'buddy', kind: sp.field.proj, trail: TYPE_COLOR[sp.type], size: 0.8,
    });
  }
  // a pet from the page makes Bit hop (buddy.hop counts down from 0.5 s)
  let hop = 0;
  if (buddy.hop > 0) { buddy.hop = Math.max(0, buddy.hop - dt); hop = Math.sin((1 - buddy.hop / 0.5) * Math.PI) * 1.4; }
  buddy.mesh.position.set(buddy.x, buddy.y + Math.abs(Math.sin(buddy.anim)) * 0.2 + hop, buddy.z);
  buddy.mesh.rotation.y = t ? Math.atan2(t.x - buddy.x, t.z - buddy.z) : Math.atan2(player.x - buddy.x, player.z - buddy.z);
  buddy.mesh.userData.setFrame(Math.floor(buddy.anim / 2) % 2);
}

export function sigCooldown() {
  const sp = SPECIES[buddy.id];
  return sp ? Math.max(0, (buddy.sigReadyAt - clock.t) / sp.field.sig.cd) : 0;
}

export function signature() {
  const sp = SPECIES[buddy.id];
  if (!sp || player.dead || clock.t < buddy.sigReadyAt) return false;
  const sig = sp.field.sig;
  const lvBoost = 1 + (buddyLevel(buddy.id) - 1) * 0.1;
  const color = TYPE_COLOR[sp.type];
  const opts = { source: 'buddy', element: sp.type };
  const by = buddy.y + 1.4;
  markAction();
  const noTarget = () => { toast(`${sp.name} sees nothing to hit.`, { icon: 'eye' }); return false; };

  if (sig.kind === 'chain') {
    let from = { x: buddy.x, y: by, z: buddy.z };
    const hit = new Set();
    for (let i = 0; i < sig.count; i++) {
      let next = null, bd = 12;
      for (const t of liveTargets()) { if (hit.has(t)) continue; const d = Math.hypot(t.x - from.x, t.z - from.z); if (d < bd) { bd = d; next = t; } }
      if (!next) break;
      hit.add(next);
      fx.beam(from.x, from.y, from.z, next.x, next.y + next.h * 0.5, next.z, color, 0.12, 0.35);
      fx.burst(next.x, next.y + next.h * 0.5, next.z, color, 8, 4, 0.5, 0.5);
      dealDamage(next, sig.power * lvBoost * (1 - i * 0.08), opts);
      from = { x: next.x, y: next.y + next.h * 0.5, z: next.z };
    }
    if (!hit.size) return noTarget();
  } else if (sig.kind === 'volley') {
    const list = targetsWithin(buddy.x, buddy.z, 14);
    if (!list.length) return noTarget();
    for (let i = 0; i < sig.count; i++) {
      const t = list[i % list.length];
      spawnProjectile({ x: buddy.x, y: by + 1, z: buddy.z, tx: buddy.x + Math.cos(i) * 3, ty: by + 4, tz: buddy.z + Math.sin(i) * 3, target: t, homing: 9, speed: 12, friendly: true, damage: sig.power * lvBoost, radius: 0.8, element: sp.type, source: 'buddy', kind: 'star', trail: color, ttl: 3000 });
    }
  } else if (sig.kind === 'burst') {
    const t = nearestTarget(buddy.x, buddy.z, 12);
    if (!t) return noTarget();
    fx.beam(buddy.x, by, buddy.z, t.x, t.y + t.h * 0.5, t.z, color, 0.3, 0.4);
    fx.ring(t.x, t.y, t.z, color, sig.radius);
    fx.burst(t.x, t.y + 1, t.z, color, 24, 6, 0.8, 0.8);
    for (const v of targetsWithin(t.x, t.z, sig.radius)) dealDamage(v, sig.power * lvBoost, opts);
  } else if (sig.kind === 'beam') {
    const t = nearestTarget(buddy.x, buddy.z, 16);
    if (!t) return noTarget();
    fx.beam(buddy.x, by, buddy.z, t.x, t.y + t.h * 0.5, t.z, color, 0.4, 0.5);
    fx.ring(t.x, t.y, t.z, color, 3);
    dealDamage(t, sig.power * lvBoost, opts);
  } else if (sig.kind === 'heal') {
    heal(sig.heal + buddyLevel(buddy.id) * 2);
    fx.ring(player.x, player.y, player.z, '#38bdf8', 4);
    fx.burst(player.x, player.y + 1.5, player.z, '#7dd3fc', 16, 4, 0.8, 0.5);
    for (const v of targetsWithin(buddy.x, buddy.z, sig.radius)) dealDamage(v, sig.power * lvBoost, opts);
  } else if (sig.kind === 'nova') {
    const list = targetsWithin(buddy.x, buddy.z, 14);
    fx.ring(buddy.x, buddy.y, buddy.z, color, 8, 0.8);
    for (const v of list) { fx.beam(buddy.x, by, buddy.z, v.x, v.y + v.h * 0.5, v.z, color, 0.1, 0.4); dealDamage(v, sig.power * lvBoost, opts); }
    player.shield = Math.max(player.shield, sig.shield || 0);
  }
  fx.text(buddy.x, buddy.y + 3, buddy.z, `${sig.name}!`, 'super');
  sfx('signature');
  buddy.sigReadyAt = clock.t + sig.cd;
  S.stats.signatures = (S.stats.signatures || 0) + 1;
  return true;
}
