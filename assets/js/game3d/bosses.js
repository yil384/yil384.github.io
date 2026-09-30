// The CUDA OOM Golem (cold aisle), Reviewer #2 (eucalyptus grove) and the Deadline Dragon (Torrey Pines
// bluff). Each guards a zone and drops one rune on its first defeat.
import { S, save } from './state.js';
import { clock, later } from './clock.js';
import { emit } from './bus.js';
import { addTarget, spawnProjectile } from './combat.js';
import { player, hurt, reward } from './player.js';
import { mode } from './mode.js';
import { makeActor, flash, makeRing } from './actors.js';
import * as fx from './fx.js';
import { sfx } from './audio.js';

export const MAX_ROUND = 10;
const RESPAWN_MS = 20000;

const CONFIG = {
  ice:    { name: 'CUDA OOM Golem',   type: 'Ice',    sprite: 'golem',  scale: 0.34, r: 1.6, hp: 140, hpGrowth: 0.4, reward: { gold: 220, xp: 60 }, aggro: 11, contact: 12, color: '#93c5fd', rune: 'Frost Rune', zone: 'ice' },
  shadow: { name: 'Reviewer #2', type: 'Ghost',  sprite: 'mage',   scale: 0.32, r: 1.4, hp: 120, hpGrowth: 0.4, reward: { gold: 260, xp: 70 }, aggro: 12, contact: 10, color: '#c084fc', rune: 'Shadow Rune', zone: 'shadow' },
  dragon: { name: 'Deadline Dragon', type: 'Dragon', sprite: 'dragon', scale: 0.4,  r: 2.2, hp: 260, hpGrowth: 0.5, reward: { gold: 500, xp: 110 }, aggro: 13, contact: 18, color: '#f87171', rune: 'Ember Rune', zone: 'peak' },
};
export const bosses = {};

class Boss {
  constructor(id, world, scene, zn) {
    const c = CONFIG[id];
    this.cfg = c; this.id = id; this.boss = true; this.name = c.name; this.type = c.type; this.r = c.r;
    this.world = world; this.scene = scene;
    this.hx = zn.x; this.hz = zn.z;
    this.x = zn.x; this.z = zn.z; this.y = world.surfaceY(zn.x, zn.z);
    this.alive = true; this.respawnAt = 0; this.nextAttack = 0; this.lastContact = -1e9; this.volleys = 0; this.hazards = [];
    this.anim = 0;
    this.mesh = makeActor(c.sprite, { scale: c.scale, maxHalf: 3 });
    this.h = this.mesh.userData.height;
    scene.add(this.mesh);
    this.setRound(S.bosses[id].round);
    addTarget(this);
  }
  get round() { return S.bosses[this.id].round; }
  setRound(r) {
    S.bosses[this.id].round = Math.min(MAX_ROUND, Math.max(1, r));
    this.maxHp = Math.round(this.cfg.hp * (1 + (this.round - 1) * this.cfg.hpGrowth));
    this.hp = this.maxHp;
  }
  hit(dmg) {
    if (!this.alive) return false;
    this.hp -= dmg;
    flash(this.mesh);
    if (this.hp <= 0) { this.defeat(); return true; }
    return false;
  }
  defeat() {
    this.alive = false;
    this.clearHazards();
    this.mesh.visible = false;
    const round = this.round;
    const mult = 1 + (round - 1) * 0.3;
    reward({ gold: this.cfg.reward.gold * mult, xp: this.cfg.reward.xp * mult });
    S.bosses[this.id].kills++;
    S.stats.bossKills++;
    sfx('victory');
    fx.ring(this.x, this.y, this.z, this.cfg.color, 6, 0.9);
    fx.burst(this.x, this.y + 2, this.z, this.cfg.color, 40, 9, 1.1, 1);
    const firstRune = !S.runes[this.id];
    if (firstRune) S.runes[this.id] = true;
    if (round < MAX_ROUND) S.bosses[this.id].round = round + 1;
    this.respawnAt = clock.t + RESPAWN_MS;
    save();
    emit('boss:defeated', { id: this.id, name: this.name, round, rune: firstRune ? this.cfg.rune : null });
  }
  revive() {
    this.alive = true; this.x = this.hx; this.z = this.hz; this.mesh.visible = true;
    this.setRound(this.round);
    this.nextAttack = clock.t + 2500;
    emit('boss:returned', { id: this.id, name: this.name, round: this.round });
  }
  clearHazards() { for (const z of this.hazards) this.scene.remove(z.m); this.hazards.length = 0; }
  threat() { return mode.play && !player.dead && Math.hypot(this.x - player.x, this.z - player.z) < this.cfg.aggro; }
  update(dt) {
    if (!this.alive) { if (clock.t >= this.respawnAt) this.revive(); return; }
    this.anim += dt;
    this.move(dt);
    const threat = this.threat();
    if (threat && clock.t >= this.nextAttack) this.attack();
    this.updateHazards();
    const d = Math.hypot(this.x - player.x, this.z - player.z);
    if (threat && d < this.r + 1 && clock.t - this.lastContact > 1000) { this.lastContact = clock.t; hurt(this.cfg.contact + this.round, this.name); }
    this.y = this.world.surfaceY(this.x, this.z);
    this.mesh.position.set(this.x, this.y + Math.sin(this.anim * 1.6) * 0.12, this.z);
    if (threat) this.mesh.rotation.y = Math.atan2(player.x - this.x, player.z - this.z);
  }
  move() {}
  attack() {}
  updateHazards() {}
}

class IceGolem extends Boss {
  move(dt) {
    if (!this.threat()) return;
    // lumbers slowly toward the player
    const dx = player.x - this.x, dz = player.z - this.z, l = Math.hypot(dx, dz);
    if (l > 3) { const nx = this.x + (dx / l) * 1.4 * dt, nz = this.z + (dz / l) * 1.4 * dt; if (this.world.walkable(nx, nz)) { this.x = nx; this.z = nz; } }
  }
  attack() {
    const r = this.round;
    this.nextAttack = clock.t + (r >= 5 ? 3000 : 3800);
    const fields = r >= 4 ? 2 : 1;
    for (let i = 0; i < fields; i++) {
      const lead = i === 0 ? 0 : 2.5;
      const x = player.x + (Math.random() - 0.5) * 1.5 + (player.walking ? Math.sin(player.yaw) * lead : 0);
      const z = player.z + (Math.random() - 0.5) * 1.5 + (player.walking ? Math.cos(player.yaw) * lead : 0);
      const m = makeRing('#a5f3fc', 1.6);
      m.position.set(x, this.world.surfaceY(x, z) + 0.05, z);
      m.material.opacity = 0.35;
      this.scene.add(m);
      this.hazards.push({ m, x, z, r: 1.6, armAt: clock.t + 700, until: clock.t + 3300, tick: 0 });
    }
  }
  updateHazards() {
    for (const z of this.hazards.slice()) {
      if (!this.hazards.includes(z)) continue;
      if (clock.t >= z.until) { this.scene.remove(z.m); this.hazards.splice(this.hazards.indexOf(z), 1); continue; }
      const armed = clock.t >= z.armAt;
      z.m.material.opacity = armed ? 0.85 : 0.35;
      z.m.scale.setScalar(armed ? 1 + Math.sin(clock.t / 120) * 0.06 : 1.2);
      if (armed && Math.hypot(z.x - player.x, z.z - player.z) < z.r && clock.t - z.tick > 800) { z.tick = clock.t; hurt(10 + this.round, 'frost'); }
    }
  }
}

class ShadowMage extends Boss {
  move() {
    if (!this.nextBlink || clock.t >= this.nextBlink) {
      this.nextBlink = clock.t + 5000;
      if (this.threat()) {
        fx.burst(this.x, this.y + 1.5, this.z, '#c084fc', 12, 4, 0.5, 0.6);
        later(180, () => {
          const a = Math.random() * Math.PI * 2, d = 3 + Math.random() * 4;
          const nx = this.hx + Math.cos(a) * d, nz = this.hz + Math.sin(a) * d;
          if (this.world.walkable(nx, nz) && !this.world.isBlocked(nx, nz)) { this.x = nx; this.z = nz; }
          fx.burst(this.x, this.y + 1.5, this.z, '#c084fc', 12, 4, 0.5, 0.6);
        });
      }
    }
  }
  attack() {
    const r = this.round;
    this.nextAttack = clock.t + (r >= 6 ? 2400 : 3000);
    const n = r >= 4 ? 5 : 3;
    const base = Math.atan2(player.x - this.x, player.z - this.z);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.32;
      spawnProjectile({ x: this.x, y: this.y + 2.2, z: this.z, tx: this.x + Math.sin(a) * 10, ty: player.y + 1.5, tz: this.z + Math.cos(a) * 10, speed: 7, damage: 9 + r, radius: 0.6, ttl: 3200, kind: 'orb' });
    }
  }
}

class DragonKing extends Boss {
  move(dt) {
    // hovers slightly around its perch
    this.x = this.hx + Math.sin(this.anim * 0.35) * 2;
  }
  attack() {
    const r = this.round;
    this.nextAttack = clock.t + (r >= 6 ? 2200 : 2800);
    this.volleys++;
    const dmg = 14 + r * 2;
    if (r >= 4 && this.volleys % 4 === 0) {
      sfx('boom');
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        spawnProjectile({ x: this.x, y: this.y + 2, z: this.z, tx: this.x + Math.sin(a) * 10, ty: this.y + 1.5, tz: this.z + Math.cos(a) * 10, speed: 6.5, damage: dmg, radius: 0.7, ttl: 3500, kind: 'dragonfire', size: 1.2 });
      }
      return;
    }
    const n = r >= 6 ? 5 : r >= 3 ? 3 : 1;
    const base = Math.atan2(player.x - this.x, player.z - this.z);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.22;
      spawnProjectile({ x: this.x, y: this.y + 2.6, z: this.z, tx: this.x + Math.sin(a) * 10, ty: player.y + 1.6, tz: this.z + Math.cos(a) * 10, speed: 9, damage: dmg, radius: 0.7, ttl: 3500, kind: 'dragonfire', size: 1.2, trail: '#f97316' });
    }
  }
}

const CLASSES = { ice: IceGolem, shadow: ShadowMage, dragon: DragonKing };
export function initBosses(world, scene, ZONES) {
  for (const id of Object.keys(CLASSES)) bosses[id] = new CLASSES[id](id, world, scene, ZONES[CONFIG[id].zone]);
}
export function updateBosses(dt) { for (const b of Object.values(bosses)) b.update(dt); }
export function clearBossHazards() { for (const b of Object.values(bosses)) b.clearHazards(); }
export function activeBoss() {
  for (const b of Object.values(bosses)) if (b.alive && b.threat()) return b;
  return null;
}
