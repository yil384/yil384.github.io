// Field enemies placed by <span class="spawn" data-spawn="enemy">. They wander near their anchor
// and only chase / hurt the player while the player is actively playing (see player.engaged()).
import { S } from './state.js';
import { clock } from './clock.js';
import { spawnsOf, onMeasure, view } from './world.js';
import { ENEMY_KINDS } from './data.js';
import { addTarget } from './combat.js';
import { player, engaged, hurt } from './player.js';
import { applySprite } from './sprites.js';
import { h, dist, rand, clamp } from './util.js';
import * as fx from './fx.js';

const RESPAWN_MS = 15000;
const AGGRO = 170;
const LEASH = 230;

export const enemies = [];

class FieldEnemy {
  constructor(spawn) {
    const kind = ENEMY_KINDS[spawn.data.kind] || ENEMY_KINDS['slime-green'];
    this.spawn = spawn;
    this.kind = kind;
    this.id = `enemy-${spawn.data.kind}-${enemies.length}`;
    this.name = kind.name;
    this.type = kind.type;
    this.r = 16;
    this.ox = 0; this.oy = 0;          // offset from anchor
    this.phase = rand(0, Math.PI * 2);
    this.alive = true;
    this.active = spawn.active;
    this.respawnAt = 0;
    this.lastContact = -1e9;
    this.scale();
    this.hp = this.maxHp;

    this.hpFill = h('span');
    this.body = h('div', { class: `enemy__body${kind.flying ? ' is-flying' : ''}` });
    this.el = h('div', { class: 'ent enemy' },
      h('div', { class: 'ent__shadow' }),
      h('div', { class: 'enemy__hp' }, this.hpFill),
      this.body,
    );
    applySprite(this.body, kind.sprite, 3);
    document.getElementById('world').append(this.el);
    this.sync();
    addTarget(this);
  }

  /** Enemies grow a little tougher as the player levels, so later areas still bite. */
  scale() {
    const lv = S.player.level;
    this.maxHp = Math.round(this.kind.hp * (1 + (lv - 1) * 0.06));
    this.damage = Math.round(this.kind.dmg + (lv - 1) * 0.5);
  }

  get x() { return this.spawn.x + this.ox; }
  get y() { return this.spawn.y + this.oy; }

  sync() {
    this.active = this.spawn.active;
    this.el.hidden = !this.active;
  }

  hit(dmg) {
    if (!this.alive) return false;
    this.hp -= dmg;
    this.el.classList.remove('is-hit');
    void this.el.offsetWidth;
    this.el.classList.add('is-hit');
    this.hpFill.style.transform = `scaleX(${Math.max(0, this.hp / this.maxHp)})`;
    if (this.hp <= 0) {
      this.alive = false;
      this.respawnAt = clock.t + RESPAWN_MS;
      this.el.classList.add('is-dead');
      fx.burst(this.x, this.y, '#f5c542', 10, 36);
      return true;
    }
    return false;
  }

  update(dt) {
    if (!this.active) return;
    if (!this.alive) {
      if (clock.t >= this.respawnAt) {
        this.scale();
        this.hp = this.maxHp;
        this.alive = true;
        this.ox = 0; this.oy = 0;
        this.hpFill.style.transform = 'scaleX(1)';
        this.el.classList.remove('is-dead');
      }
      return;
    }
    const d = dist(this.x, this.y, player.x, player.y);
    const home = Math.hypot(this.ox, this.oy);
    const fight = engaged() && !player.dead;
    if (fight && d < AGGRO && home < LEASH) {
      const k = (this.kind.speed * dt) / Math.max(d, 1);
      this.ox += (player.x - this.x) * k;
      this.oy += (player.y - this.y) * k;
    } else {
      // Wander in a lazy loop, drifting back towards the anchor.
      this.phase += dt * 0.9;
      const tx = Math.cos(this.phase) * 60;
      const ty = Math.sin(this.phase * 1.7) * 14;
      this.ox += (tx - this.ox) * Math.min(1, dt * 1.2);
      this.oy += (ty - this.oy) * Math.min(1, dt * 1.2);
    }
    // Never wander off the visible page width (matters on narrow screens with no gutters).
    this.ox = clamp(this.spawn.x + this.ox, 26, view.vw - 26) - this.spawn.x;
    if (fight && d < this.r + 14 && clock.t - this.lastContact > 1000) {
      this.lastContact = clock.t;
      hurt(this.damage, this.name);
    }
    this.el.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
    this.el.classList.toggle('is-left', player.x < this.x);
  }
}

export function initEnemies() {
  for (const sp of spawnsOf('enemy')) enemies.push(new FieldEnemy(sp));
  onMeasure(() => enemies.forEach((e) => e.sync()));
}

export function updateEnemies(dt) {
  for (const e of enemies) e.update(dt);
}
