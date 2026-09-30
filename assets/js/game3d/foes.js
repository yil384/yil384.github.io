// Generic enemies and pattern bosses, for the hub and every region.
//
// Enemy kinds are data (registerEnemyKind); a spawned Foe runs one behaviour:
//   chase    wanders near home, chases the player inside `aggro`, gives up past `leash` (the classic slime)
//   wander   harmless ambient life: never attacks, can still be hit
//   ranged   keeps its distance and shoots projectiles
//   charge   closes in, telegraphs (flash + ground ring), then dashes through where you stood
//   swarm    fast and fragile, circles you and darts in
//   turret   never moves, shoots when you are in range
// Every foe can be knocked back (the melee combo does it), respects the current region (only live
// region foes update, show, or can be targeted) and never touches the player outside play mode.
//
// Bosses (spawnPatternBoss) attack with reusable patterns, cycled in order:
//   rings   frost fields under / ahead of the player that arm after 0.7 s (the CUDA OOM Golem)
//   fan     a fan of slow orbs to sidestep (Reviewer #2)
//   volley  aimed fireballs, 1-3-5 (the Deadline Dragon)
//   nova    a ring of 12 orbs in every direction
//   summon  2-3 minions of `minion` kind (at most 4 alive)
//   charge  telegraphed dash at the player ending in a shockwave
// `phases: [{ below: 0.5, pattern, every, speed }]` swaps patterns as its HP drops.
import { S, save } from './state.js';
import { clock } from './clock.js';
import { emit } from './bus.js';
import { ENEMY_KINDS } from './data.js';
import { addTarget, removeTarget, spawnProjectile } from './combat.js';
import { player, hurt, reward } from './player.js';
import { mode } from './mode.js';
import { makeActor, flash, makeRing } from './actors.js';
import { isLive, where } from './where.js';
import * as fx from './fx.js';
import { sfx } from './audio.js';

// ---------------------------------------------------------------- kinds
export const KINDS = {};
const DEFAULTS = { hp: 30, speed: 3.5, dmg: 8, type: 'Normal', xp: 20, gold: 25, behaviour: 'chase', aggro: 7, leash: 12, scale: 0.2, rate: 2200, proj: 'orb', projSpeed: 8, respawn: 15000 };
/**
 * registerEnemyKind(id, { name, hp, speed, dmg, type, xp, gold, sprite, flying, behaviour, aggro, leash,
 *   scale, rate, proj, projSpeed, respawn, color }). Re-registering an id replaces it.
 */
export function registerEnemyKind(id, def) {
  KINDS[id] = { ...DEFAULTS, sprite: id, ...def, id };
  return KINDS[id];
}
for (const [id, k] of Object.entries(ENEMY_KINDS)) registerEnemyKind(id, { ...k, behaviour: 'chase' });

// ---------------------------------------------------------------- foes
export const foes = [];

export class Foe {
  /**
   * @param world   composite world
   * @param parent  THREE parent (hub group or a region's group)
   * @param kindId  registered kind
   * @param x, z    home (world coordinates)
   * @param opts    per-spawn overrides of any kind field, plus { region, onDeath(foe), transient }
   */
  constructor(world, parent, kindId, x, z, opts = {}) {
    const base = KINDS[kindId];
    if (!base) throw new Error(`unknown enemy kind ${kindId}`);
    this.kind = { ...base, ...opts };
    this.kindId = kindId;
    this.name = this.kind.name || kindId;
    this.type = this.kind.type;
    this.region = opts.region || 'hub';
    this.world = world;
    this.parent = parent;
    this.hx = x; this.hz = z;
    this.x = x; this.z = z; this.y = world.surfaceY(x, z);
    this.r = this.kind.r || 0.9;
    this.alive = true;
    this.respawnAt = 0;
    this.lastContact = -1e9;
    this.lastShot = clock.t + Math.random() * 800;
    this.wanderT = Math.random() * 6;
    this.tx = x; this.tz = z;
    this.kbx = 0; this.kbz = 0;
    this.anim = Math.random() * 6;
    this.state = 'idle'; this.stateT = 0;
    this.orbit = Math.random() * Math.PI * 2;
    this.mesh = makeActor(this.kind.sprite, { scale: this.kind.scale });
    this.h = this.mesh.userData.height;
    this.hover = this.kind.flying ? 2.2 : 0;
    parent.add(this.mesh);
    this.scale();
    this.hp = this.maxHp;
    addTarget(this);
    foes.push(this);
  }
  get active() { return isLive(this.region); }
  scale() {
    const lv = S.player.level;
    this.maxHp = Math.round(this.kind.hp * (1 + (lv - 1) * 0.06));
    this.damage = Math.round(this.kind.dmg + (lv - 1) * 0.5);
  }
  hit(dmg) {
    if (!this.alive) return false;
    this.hp -= dmg;
    flash(this.mesh);
    if (this.hp <= 0) {
      this.alive = false;
      this.mesh.visible = false;
      fx.burst(this.x, this.y + 1, this.z, this.kind.color || '#f2b84b', 14, 5, 0.6, 0.7);
      if (this.kind.respawn === false || this.kind.transient) this.respawnAt = Infinity;
      else this.respawnAt = clock.t + this.kind.respawn;
      try { this.kind.onDeath?.(this); } catch (err) { console.warn('[foes] onDeath', err); }
      return true;
    }
    return false;
  }
  /** Push away along (dx, dz) (unit vector) with `power` units/s; decays quickly. */
  knock(dx, dz, power) {
    if (this.kind.behaviour === 'turret') return;
    this.kbx += dx * power; this.kbz += dz * power;
    this.state = 'idle'; this.stateT = 0;
  }
  canStep(x, z) {
    const h = this.world.height(x, z);
    return h > -Infinity && !this.world.isBlocked(x, z) && Math.abs(h - this.world.height(this.x, this.z)) <= 1;
  }
  stepTo(gx, gz, speed, dt) {
    const dx = gx - this.x, dz = gz - this.z, len = Math.hypot(dx, dz);
    if (len < 0.2) return;
    const nx = this.x + (dx / len) * speed * dt, nz = this.z + (dz / len) * speed * dt;
    if (this.canStep(nx, this.z)) this.x = nx;
    if (this.canStep(this.x, nz)) this.z = nz;
    this.mesh.rotation.y = Math.atan2(dx, dz);
  }
  remove() {
    this.alive = false;
    this.respawnAt = Infinity;
    this.parent.remove(this.mesh);
    removeTarget(this);
    const i = foes.indexOf(this);
    if (i >= 0) foes.splice(i, 1);
  }
  update(dt) {
    if (!this.alive) {
      if (clock.t >= this.respawnAt) {
        this.scale(); this.hp = this.maxHp; this.alive = true; this.x = this.hx; this.z = this.hz; this.mesh.visible = true; this.state = 'idle';
      }
      return;
    }
    const k = this.kind;
    const d = Math.hypot(player.x - this.x, player.z - this.z);
    const dy = Math.abs(player.y - this.y);
    const home = Math.hypot(this.hx - this.x, this.hz - this.z);
    const canFight = mode.play && !player.dead && k.behaviour !== 'wander';
    const engaged = canFight && d < k.aggro && home < k.leash && dy < 6;
    this.anim += dt * (engaged ? 8 : 4);
    // knockback first
    if (this.kbx || this.kbz) {
      const nx = this.x + this.kbx * dt, nz = this.z + this.kbz * dt;
      if (this.canStep(nx, this.z)) this.x = nx;
      if (this.canStep(this.x, nz)) this.z = nz;
      const f = Math.exp(-7 * dt);
      this.kbx *= f; this.kbz *= f;
      if (Math.hypot(this.kbx, this.kbz) < 0.3) this.kbx = this.kbz = 0;
    } else if (!engaged) this.idleMove(dt);
    else this.fight(dt, d);
    this.y = this.world.surfaceY(this.x, this.z);
    const bob = k.flying ? Math.sin(this.anim * 0.6) * 0.3 : Math.abs(Math.sin(this.anim)) * 0.15;
    this.mesh.position.set(this.x, this.y + this.hover + bob, this.z);
    this.mesh.userData.setFrame(Math.floor(this.anim / 2) % 2);
    // contact damage (not for turrets / ranged at a distance; not while the player flies high above)
    const touchDmg = k.behaviour === 'charge' && this.state === 'dash' ? this.damage * 1.5 : this.damage;
    if (engaged && k.behaviour !== 'turret' && d < this.r + 0.9 && dy < 2.5 && clock.t - this.lastContact > 1000) {
      this.lastContact = clock.t;
      hurt(touchDmg, this.name);
    }
  }
  idleMove(dt) {
    if (this.kind.behaviour === 'turret') return;
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = 2 + Math.random() * 4;
      const a = Math.random() * Math.PI * 2, r = Math.random() * 3.5;
      this.tx = this.hx + Math.cos(a) * r; this.tz = this.hz + Math.sin(a) * r;
    }
    this.stepTo(this.tx, this.tz, this.kind.speed * 0.45, dt);
    this.state = 'idle';
  }
  shoot(spread = 0) {
    const k = this.kind;
    const a = Math.atan2(player.x - this.x, player.z - this.z) + spread;
    spawnProjectile({ x: this.x, y: this.y + this.hover + this.h * 0.6, z: this.z, tx: this.x + Math.sin(a) * 10, ty: player.y + 1.4, tz: this.z + Math.cos(a) * 10, speed: k.projSpeed, damage: this.damage, radius: 0.55, ttl: 3000, kind: k.proj, size: 0.9 });
  }
  fight(dt, d) {
    const k = this.kind;
    const face = () => { this.mesh.rotation.y = Math.atan2(player.x - this.x, player.z - this.z); };
    switch (k.behaviour) {
      case 'ranged': {
        if (d < 4.5) this.stepTo(this.x * 2 - player.x, this.z * 2 - player.z, k.speed * 0.8, dt);
        else if (d > 8) this.stepTo(player.x, player.z, k.speed * 0.7, dt);
        face();
        if (clock.t - this.lastShot > k.rate) { this.lastShot = clock.t; this.shoot(); }
        break;
      }
      case 'turret': {
        face();
        if (clock.t - this.lastShot > k.rate) { this.lastShot = clock.t; this.shoot(); if (k.burst) { this.shoot(0.25); this.shoot(-0.25); } }
        break;
      }
      case 'charge': {
        this.stateT -= dt;
        if (this.state === 'idle' || this.state === 'approach') {
          this.state = 'approach';
          if (d > 6) this.stepTo(player.x, player.z, k.speed, dt);
          face();
          if (d <= 7 && clock.t - this.lastShot > k.rate) {
            this.state = 'wind'; this.stateT = 0.6; this.lastShot = clock.t;
            this.dashX = player.x; this.dashZ = player.z;
            fx.ring(this.x, this.y, this.z, '#f87171', 1.6, 0.6);
            flash(this.mesh, 500);
          }
        } else if (this.state === 'wind') {
          face();
          if (this.stateT <= 0) { this.state = 'dash'; this.stateT = 0.55; const a = Math.atan2(this.dashX - this.x, this.dashZ - this.z); this.dashX = this.x + Math.sin(a) * 30; this.dashZ = this.z + Math.cos(a) * 30; }
        } else if (this.state === 'dash') {
          this.stepTo(this.dashX, this.dashZ, k.speed * 3.2, dt);
          if (this.stateT <= 0) { this.state = 'approach'; }
        }
        break;
      }
      case 'swarm': {
        this.orbit += dt * 2.4;
        const dart = Math.sin(this.anim * 0.35) > 0.6;
        const r = dart ? 0.6 : 2.6;
        this.stepTo(player.x + Math.cos(this.orbit) * r, player.z + Math.sin(this.orbit) * r, k.speed, dt);
        break;
      }
      default: // chase
        this.stepTo(player.x, player.z, k.speed, dt);
    }
  }
}

// ---------------------------------------------------------------- pattern bosses
export const patternBosses = [];

const PATTERNS = {
  rings(b) {
    const n = b.enraged ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const lead = i === 0 ? 0 : 2.5;
      const x = player.x + (Math.random() - 0.5) * 1.5 + (player.walking ? Math.sin(player.yaw) * lead : 0);
      const z = player.z + (Math.random() - 0.5) * 1.5 + (player.walking ? Math.cos(player.yaw) * lead : 0);
      b.hazard(x, z, 1.7, b.cfg.color || '#a5f3fc');
    }
    return 3600;
  },
  fan(b) {
    const n = b.enraged ? 5 : 3;
    const base = Math.atan2(player.x - b.x, player.z - b.z);
    for (let i = 0; i < n; i++) b.orb(base + (i - (n - 1) / 2) * 0.32, 7, 'orb');
    return 2800;
  },
  volley(b) {
    b.volleys = (b.volleys || 0) + 1;
    const n = b.enraged ? 5 : b.volleys % 2 ? 1 : 3;
    const base = Math.atan2(player.x - b.x, player.z - b.z);
    for (let i = 0; i < n; i++) b.orb(base + (i - (n - 1) / 2) * 0.22, 9, 'dragonfire', '#f97316');
    return 2600;
  },
  nova(b) {
    sfx('boom');
    const n = 12, off = Math.random() * 0.5;
    for (let i = 0; i < n; i++) b.orb(off + (i / n) * Math.PI * 2, 6.5, 'pulse');
    return 3400;
  },
  summon(b) {
    b.minions = b.minions.filter((m) => m.alive);
    const room = 4 - b.minions.length;
    const n = Math.min(room, b.enraged ? 3 : 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      let x = b.x + Math.cos(a) * 3, z = b.z + Math.sin(a) * 3;
      if (!b.world.walkable(x, z) || b.world.isBlocked(x, z)) { x = b.x; z = b.z; }
      const m = new Foe(b.world, b.parent, b.cfg.minion || 'slime-green', x, z, { region: b.region, transient: true, respawn: false, aggro: 20, leash: 40 });
      fx.burst(x, m.y + 1, z, b.cfg.color || '#c084fc', 10, 4, 0.5, 0.6);
      b.minions.push(m);
    }
    if (n) sfx('encounter');
    return 4200;
  },
  charge(b) {
    b.dash = { state: 'wind', t: 0.8, tx: player.x, tz: player.z };
    b.hazard(player.x, player.z, 2.2, '#f87171', 800, 900);
    flash(b.mesh, 700);
    return 3800;
  },
};
export const PATTERN_NAMES = Object.keys(PATTERNS);

export class PatternBoss {
  /**
   * cfg: { id, name, x, z (world), sprite, scale, hp, type, pattern: name | [names], every (ms between
   * attacks, default per pattern), phases: [{ below, pattern, every, speed }], move: 'lumber' | 'hover' |
   * 'blink' | 'static', speed, aggro, contact, color, minion, reward: { gold, xp }, respawn (ms | false),
   * onDefeat(boss), region, r }
   */
  constructor(world, parent, cfg) {
    this.cfg = { aggro: 13, contact: 12, speed: 1.4, move: 'lumber', scale: 0.34, r: 1.6, hp: 200, type: 'Normal', respawn: 30000, reward: { gold: 300, xp: 80 }, ...cfg };
    this.id = cfg.id; this.boss = true; this.name = cfg.name || cfg.id; this.type = this.cfg.type; this.r = this.cfg.r;
    this.region = cfg.region || 'hub';
    this.world = world; this.parent = parent;
    this.hx = cfg.x; this.hz = cfg.z; this.x = cfg.x; this.z = cfg.z; this.y = world.surfaceY(cfg.x, cfg.z);
    this.alive = !(this.cfg.respawn === false && S.world?.bossKills?.[this.id]);
    this.respawnAt = this.alive ? 0 : Infinity;
    this.nextAttack = 0; this.lastContact = -1e9; this.hazards = []; this.minions = []; this.anim = 0; this.pi = 0; this.dash = null;
    this.mesh = makeActor(this.cfg.sprite, { scale: this.cfg.scale, maxHalf: 3 });
    this.h = this.mesh.userData.height;
    this.mesh.visible = this.alive;
    parent.add(this.mesh);
    this.maxHp = this.cfg.hp; this.hp = this.maxHp;
    this.round = 1;
    addTarget(this);
    patternBosses.push(this);
  }
  get active() { return isLive(this.region); }
  get defeated() { return !!S.world?.bossKills?.[this.id]; }
  get phase() {
    const f = this.hp / this.maxHp;
    let ph = null;
    for (const p of this.cfg.phases || []) if (f <= p.below && (!ph || p.below < ph.below)) ph = p;
    return ph;
  }
  get enraged() { return this.hp / this.maxHp < 0.5; }
  hit(dmg) {
    if (!this.alive) return false;
    this.hp -= dmg;
    flash(this.mesh);
    if (this.hp <= 0) { this.defeat(); return true; }
    return false;
  }
  knock() {}
  orb(a, speed, kind, trail = null) {
    spawnProjectile({ x: this.x, y: this.y + this.h * 0.55, z: this.z, tx: this.x + Math.sin(a) * 10, ty: player.y + 1.5, tz: this.z + Math.cos(a) * 10, speed, damage: this.cfg.contact, radius: 0.65, ttl: 3500, kind, size: 1.15, trail });
  }
  hazard(x, z, r, color, arm = 700, life = 3300) {
    const m = makeRing(color, r);
    m.position.set(x, this.world.surfaceY(x, z) + 0.05, z);
    m.material.opacity = 0.35;
    this.parent.add(m);
    this.hazards.push({ m, x, z, r, armAt: clock.t + arm, until: clock.t + life, tick: 0 });
  }
  clearHazards() { for (const z of this.hazards) this.parent.remove(z.m); this.hazards.length = 0; this.dash = null; }
  threat() { return mode.play && !player.dead && this.active && Math.hypot(this.x - player.x, this.z - player.z) < this.cfg.aggro && Math.abs(player.y - this.y) < 8; }
  defeat() {
    this.alive = false;
    this.clearHazards();
    for (const m of this.minions) if (m.alive) m.hit(9999);
    this.mesh.visible = false;
    if (!S.world.bossKills) S.world.bossKills = {};
    const first = !S.world.bossKills[this.id];
    S.world.bossKills[this.id] = (S.world.bossKills[this.id] || 0) + 1;
    S.stats.bossKills++;
    reward({ gold: this.cfg.reward.gold || 0, xp: this.cfg.reward.xp || 0 });
    sfx('victory');
    fx.ring(this.x, this.y, this.z, this.cfg.color || '#f2b84b', 6, 0.9);
    fx.burst(this.x, this.y + 2, this.z, this.cfg.color || '#f2b84b', 40, 9, 1.1, 1);
    fx.shake(0.5, 500);
    this.respawnAt = this.cfg.respawn === false ? Infinity : clock.t + this.cfg.respawn;
    save();
    emit('boss:defeated', { id: this.id, name: this.name, region: this.region, first });
    try { this.cfg.onDefeat?.(this, { first }); } catch (err) { console.warn('[foes] onDefeat', err); }
  }
  revive() {
    this.alive = true; this.x = this.hx; this.z = this.hz; this.mesh.visible = true; this.hp = this.maxHp; this.pi = 0;
    this.nextAttack = clock.t + 2500;
  }
  update(dt) {
    if (!this.alive) { if (clock.t >= this.respawnAt) this.revive(); return; }
    this.anim += dt;
    const threat = this.threat();
    const ph = this.phase;
    const speed = ph?.speed ?? this.cfg.speed;
    // movement
    if (this.dash) {
      const D = this.dash;
      D.t -= dt;
      if (D.state === 'wind' && D.t <= 0) { D.state = 'go'; D.t = 0.6; }
      else if (D.state === 'go') {
        const dx = D.tx - this.x, dz = D.tz - this.z, l = Math.hypot(dx, dz);
        if (l > 0.5) { const s = Math.min(l, 18 * dt); const nx = this.x + dx / l * s, nz = this.z + dz / l * s; if (this.world.walkable(nx, nz) && !this.world.isBlocked(nx, nz)) { this.x = nx; this.z = nz; } }
        if (D.t <= 0 || l <= 0.5) { this.dash = null; fx.ring(this.x, this.y, this.z, '#f87171', 3.5, 0.6); fx.shake(0.3, 250); if (Math.hypot(player.x - this.x, player.z - this.z) < 3.5) hurt(this.cfg.contact + 4, this.name); }
      }
    } else if (threat) {
      const mv = this.cfg.move;
      if (mv === 'lumber') {
        const dx = player.x - this.x, dz = player.z - this.z, l = Math.hypot(dx, dz);
        if (l > 3) { const nx = this.x + (dx / l) * speed * dt, nz = this.z + (dz / l) * speed * dt; if (this.world.walkable(nx, nz) && !this.world.isBlocked(nx, nz) && Math.abs(this.world.height(nx, nz) - this.world.height(this.x, this.z)) <= 1) { this.x = nx; this.z = nz; } }
      } else if (mv === 'hover') this.x = this.hx + Math.sin(this.anim * 0.35) * 2;
      else if (mv === 'blink' && (!this.nextBlink || clock.t >= this.nextBlink)) {
        this.nextBlink = clock.t + 5000;
        fx.burst(this.x, this.y + 1.5, this.z, this.cfg.color || '#c084fc', 12, 4, 0.5, 0.6);
        const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 4;
        const nx = this.hx + Math.cos(a) * r, nz = this.hz + Math.sin(a) * r;
        if (this.world.walkable(nx, nz) && !this.world.isBlocked(nx, nz)) { this.x = nx; this.z = nz; }
      }
    } else if (Math.hypot(this.hx - this.x, this.hz - this.z) > 0.5 && this.cfg.move !== 'static') {
      const dx = this.hx - this.x, dz = this.hz - this.z, l = Math.hypot(dx, dz);
      this.x += dx / l * speed * dt; this.z += dz / l * speed * dt;
    }
    // attacks
    if (threat && clock.t >= this.nextAttack && !this.dash) {
      const list = [].concat(ph?.pattern || this.cfg.pattern || 'fan');
      const name = list[this.pi++ % list.length];
      const wait = (PATTERNS[name] || PATTERNS.fan)(this);
      this.nextAttack = clock.t + (ph?.every ?? this.cfg.every ?? wait) * (this.enraged ? 0.85 : 1);
    }
    // hazards
    for (const z of this.hazards.slice()) {
      if (clock.t >= z.until) { this.parent.remove(z.m); this.hazards.splice(this.hazards.indexOf(z), 1); continue; }
      const armed = clock.t >= z.armAt;
      z.m.material.opacity = armed ? 0.85 : 0.35;
      z.m.scale.setScalar(armed ? 1 + Math.sin(clock.t / 120) * 0.06 : 1.2);
      if (armed && Math.hypot(z.x - player.x, z.z - player.z) < z.r && Math.abs(player.y - z.m.position.y) < 2 && clock.t - z.tick > 800) { z.tick = clock.t; hurt(Math.round(this.cfg.contact * 0.8), this.name); }
    }
    const d = Math.hypot(this.x - player.x, this.z - player.z);
    if (threat && d < this.r + 1 && Math.abs(player.y - this.y) < 3 && clock.t - this.lastContact > 1000) { this.lastContact = clock.t; hurt(this.cfg.contact, this.name); }
    this.y = this.world.surfaceY(this.x, this.z);
    this.mesh.position.set(this.x, this.y + Math.sin(this.anim * 1.6) * 0.12 + (this.cfg.flying ? 2 : 0), this.z);
    if (threat) this.mesh.rotation.y = Math.atan2(player.x - this.x, player.z - this.z);
  }
}

// ---------------------------------------------------------------- loop
export function updateFoes(dt) {
  for (let i = 0; i < foes.length; i++) {
    const f = foes[i];
    const live = f.active;
    if (!live) { if (f.mesh.visible && f.region !== where.id) f.mesh.visible = false; continue; }
    if (f.alive && !f.mesh.visible) f.mesh.visible = true;
    f.update(dt);
  }
  // transient minions that died are removed for good
  for (let i = foes.length - 1; i >= 0; i--) if (foes[i].kind.transient && !foes[i].alive) foes[i].remove();
  for (const b of patternBosses) if (b.active) b.update(dt);
}
export function clearFoeHazards() { for (const b of patternBosses) b.clearHazards(); }
/** The pattern boss currently fighting the player (for the HUD bar), or null. */
export function activePatternBoss() {
  for (const b of patternBosses) if (b.alive && b.threat()) return b;
  return null;
}
