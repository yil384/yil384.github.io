// Field enemies wander near their home spot and chase the player when close.
import { S } from './state.js';
import { clock } from './clock.js';
import { ENEMY_KINDS } from './data.js';
import { addTarget } from './combat.js';
import { player, hurt } from './player.js';
import { makeActor, flash } from './actors.js';
import * as fx from './fx.js';

const RESPAWN_MS = 15000;
const AGGRO = 7;
const LEASH = 12;
export const enemies = [];

// home positions per zone (x, z)
const SPAWNS = [
  ['slime-green', 'meadow', 2, 2], ['slime-green', 'meadow', -3, 3], ['bat', 'meadow', 3, -3],
  ['slime-red', 'camp', -2, 2], ['bat', 'camp', 2, -2],
  ['skeleton', 'shadow', 2, 2], ['skeleton', 'shadow', -2, -3], ['slime-dark', 'shadow', 3, -2], ['bat', 'shadow', -3, 2],
  ['slime-red', 'peak', -4, -5], ['slime-dark', 'peak', 4, -5],
  ['bat', 'ice', 3, 4],
];

class Enemy {
  constructor(world, scene, kindId, hx, hz) {
    this.kind = ENEMY_KINDS[kindId];
    this.kindId = kindId;
    this.name = this.kind.name;
    this.type = this.kind.type;
    this.world = world;
    this.hx = hx; this.hz = hz;
    this.x = hx; this.z = hz; this.y = world.surfaceY(hx, hz);
    this.r = 0.9;
    this.alive = true;
    this.respawnAt = 0;
    this.lastContact = -1e9;
    this.wanderT = Math.random() * 6;
    this.tx = hx; this.tz = hz;
    this.anim = Math.random() * 6;
    this.mesh = makeActor(this.kind.sprite, { scale: 0.2 });
    this.h = this.mesh.userData.height;
    this.hover = this.kind.flying ? 2.2 : 0;
    scene.add(this.mesh);
    this.scale();
    this.hp = this.maxHp;
    addTarget(this);
  }
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
      this.respawnAt = clock.t + RESPAWN_MS;
      this.mesh.visible = false;
      fx.burst(this.x, this.y + 1, this.z, '#f2b84b', 14, 5, 0.6, 0.7);
      return true;
    }
    return false;
  }
  canStep(x, z) {
    const h = this.world.height(x, z);
    return h > -Infinity && !this.world.isBlocked(x, z) && Math.abs(h - this.world.height(this.x, this.z)) <= 1;
  }
  update(dt) {
    if (!this.alive) {
      if (clock.t >= this.respawnAt) {
        this.scale(); this.hp = this.maxHp; this.alive = true; this.x = this.hx; this.z = this.hz; this.mesh.visible = true;
      }
      return;
    }
    const d = Math.hypot(player.x - this.x, player.z - this.z);
    const home = Math.hypot(this.hx - this.x, this.hz - this.z);
    const chase = !player.dead && d < AGGRO && home < LEASH;
    let gx, gz, speed;
    if (chase) { gx = player.x; gz = player.z; speed = this.kind.speed; }
    else {
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = 2 + Math.random() * 4;
        const a = Math.random() * Math.PI * 2, r = Math.random() * 3.5;
        this.tx = this.hx + Math.cos(a) * r; this.tz = this.hz + Math.sin(a) * r;
      }
      gx = this.tx; gz = this.tz; speed = this.kind.speed * 0.45;
    }
    const dx = gx - this.x, dz = gz - this.z, len = Math.hypot(dx, dz);
    if (len > 0.3) {
      const nx = this.x + (dx / len) * speed * dt, nz = this.z + (dz / len) * speed * dt;
      if (this.canStep(nx, this.z)) this.x = nx;
      if (this.canStep(this.x, nz)) this.z = nz;
      this.mesh.rotation.y = Math.atan2(dx, dz);
    }
    this.y = this.world.surfaceY(this.x, this.z);
    this.anim += dt * (chase ? 8 : 4);
    const bob = this.kind.flying ? Math.sin(this.anim * 0.6) * 0.3 : Math.abs(Math.sin(this.anim)) * 0.15;
    this.mesh.position.set(this.x, this.y + this.hover + bob, this.z);
    this.mesh.userData.setFrame(Math.floor(this.anim / 2) % 2);
    if (chase && d < this.r + 0.9 && clock.t - this.lastContact > 1000) {
      this.lastContact = clock.t;
      hurt(this.damage, this.name);
    }
  }
}

export function initEnemies(world, scene, ZONES) {
  for (const [kind, zone, ox, oz] of SPAWNS) {
    const zn = ZONES[zone];
    let x = zn.x + ox, z = zn.z + oz;
    // nudge onto walkable ground
    for (let tries = 0; tries < 20 && (!world.walkable(x, z) || world.isBlocked(x, z)); tries++) { x += (Math.random() - 0.5) * 3; z += (Math.random() - 0.5) * 3; }
    if (!world.walkable(x, z)) continue;
    enemies.push(new Enemy(world, scene, kind, x, z));
  }
}
export function updateEnemies(dt) { for (const e of enemies) e.update(dt); }
