// Ice Golem, Shadow Mage and Dragon King. Each lives in its arena section, levels up to round 10,
// and the first defeat of each drops one of the three runes that unseal the Secret Chamber.
import { S, save } from './state.js';
import { clock, later } from './clock.js';
import { emit } from './bus.js';
import { spawnOf, onMeasure } from './world.js';
import { addTarget, spawnProjectile } from './combat.js';
import { player, engaged, hurt, reward } from './player.js';
import { applySprite } from './sprites.js';
import { h, dist, rand } from './util.js';
import * as fx from './fx.js';
import { sfx } from './audio.js';

export const MAX_ROUND = 10;
const RESPAWN_MS = 20000;

const CONFIG = {
  ice: {
    name: 'Ice Golem', type: 'Ice', sprite: 'golem', scale: 4, r: 30, hp: 140, hpGrowth: 0.4,
    reward: { gold: 220, xp: 60 }, aggro: 430, contact: 12, color: '#93c5fd', rune: 'Frost Rune',
  },
  shadow: {
    name: 'Shadow Mage', type: 'Ghost', sprite: 'mage', scale: 4, r: 28, hp: 120, hpGrowth: 0.4,
    reward: { gold: 260, xp: 70 }, aggro: 470, contact: 10, color: '#c084fc', rune: 'Shadow Rune',
  },
  dragon: {
    name: 'Dragon King', type: 'Dragon', sprite: 'dragon', scale: 5, r: 44, hp: 260, hpGrowth: 0.5,
    reward: { gold: 500, xp: 110 }, aggro: 560, contact: 18, color: '#f87171', rune: 'Ember Rune',
  },
};

export const bosses = {};

class Boss {
  constructor(id, spawn) {
    const c = CONFIG[id];
    this.cfg = c;
    this.id = id;
    this.boss = true;
    this.name = c.name;
    this.type = c.type;
    this.r = c.r;
    this.spawn = spawn;
    this.ox = 0; this.oy = 0;
    this.alive = true;
    this.active = spawn.active;
    this.respawnAt = 0;
    this.nextAttack = 0;
    this.lastContact = -1e9;
    this.volleys = 0;
    this.hazards = [];
    this.arena = document.querySelector(`[data-boss="${id}"].arena`);
    this.hpBar = this.arena?.querySelector('[data-boss-hp]');
    this.roundEl = this.arena?.querySelector('[data-boss-round]');

    this.body = h('div', { class: 'boss__body' });
    this.el = h('div', { class: `ent boss boss--${id}` }, h('div', { class: 'ent__shadow' }), this.body);
    applySprite(this.body, c.sprite, c.scale);
    document.getElementById('world').append(this.el);
    this.setRound(S.bosses[id].round);
    this.sync();
    addTarget(this);
  }

  get x() { return this.spawn.x + this.ox; }
  get y() { return this.spawn.y + this.oy; }
  get round() { return S.bosses[this.id].round; }

  setRound(r) {
    S.bosses[this.id].round = Math.min(MAX_ROUND, Math.max(1, r));
    this.maxHp = Math.round(this.cfg.hp * (1 + (this.round - 1) * this.cfg.hpGrowth));
    this.hp = this.maxHp;
    this.updateBar();
  }

  updateBar() {
    if (this.hpBar) this.hpBar.style.transform = `scaleX(${Math.max(0, this.hp / this.maxHp)})`;
    if (this.roundEl) this.roundEl.textContent = `Lv.${this.round}${this.round >= MAX_ROUND ? ' · MAX' : ''}`;
    this.arena?.classList.toggle('is-down', !this.alive);
  }

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
    this.updateBar();
    if (this.hp <= 0) {
      this.defeat();
      return true;
    }
    return false;
  }

  defeat() {
    this.alive = false;
    this.clearHazards();
    this.el.classList.add('is-dead');
    const round = this.round;
    const mult = 1 + (round - 1) * 0.3;
    reward({ gold: this.cfg.reward.gold * mult, xp: this.cfg.reward.xp * mult });
    S.bosses[this.id].kills++;
    S.stats.bossKills++;
    sfx('victory');
    fx.flash(`${this.cfg.color}55`);
    fx.shake(10, 450);
    fx.ring(this.x, this.y, this.cfg.color, 220);
    fx.confetti(this.x, this.y, 36);

    const firstRune = !S.runes[this.id];
    if (firstRune) S.runes[this.id] = true;
    if (round < MAX_ROUND) S.bosses[this.id].round = round + 1;
    else S.bosses[this.id].conquered = true;
    this.respawnAt = clock.t + RESPAWN_MS;
    this.updateBar();
    save();
    emit('boss:defeated', { id: this.id, name: this.name, round, rune: firstRune ? this.cfg.rune : null });
  }

  revive() {
    this.alive = true;
    this.ox = 0; this.oy = 0;
    this.el.classList.remove('is-dead');
    this.setRound(this.round);
    this.nextAttack = clock.t + 2000;
    emit('boss:returned', { id: this.id, name: this.name, round: this.round });
  }

  clearHazards() {
    for (const z of this.hazards) z.el.remove();
    this.hazards.length = 0;
  }

  /** Hostile behaviour only runs while the player is actively playing and close by. */
  threat() {
    return engaged() && !player.dead && dist(this.x, this.y, player.x, player.y) < this.cfg.aggro;
  }

  update(dt) {
    if (!this.active) return;
    if (!this.alive) {
      if (clock.t >= this.respawnAt) this.revive();
      return;
    }
    this.move(dt);
    const threat = this.threat();
    if (threat && clock.t >= this.nextAttack) this.attack();
    this.updateHazards();
    if (threat && dist(this.x, this.y, player.x, player.y) < this.r + 14 && clock.t - this.lastContact > 1000) {
      this.lastContact = clock.t;
      hurt(this.cfg.contact + this.round, this.name);
    }
    this.el.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
    this.el.classList.toggle('is-left', player.x < this.x);
  }

  move() {}
  attack() {}
  updateHazards() {}
}

class IceGolem extends Boss {
  move(dt) {
    this.t = (this.t || 0) + dt;
    this.ox = Math.sin(this.t * 0.6) * 80;
  }
  attack() {
    const r = this.round;
    this.nextAttack = clock.t + (r >= 5 ? 3000 : 3800);
    const fields = r >= 4 ? 2 : 1;
    for (let i = 0; i < fields; i++) {
      const lead = i === 0 ? 0 : 70;
      const x = player.x + rand(-24, 24) + (player.walking ? player.facing * lead : rand(-lead, lead));
      const y = player.y + rand(-24, 24);
      this.frostField(x, y);
    }
  }
  frostField(x, y) {
    const el = fx.worldEl('hazard hazard--frost is-arming', x, y);
    const z = { el, x, y, r: 36, armAt: clock.t + 700, until: clock.t + 3300, tick: 0 };
    this.hazards.push(z);
  }
  updateHazards() {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const z = this.hazards[i];
      if (clock.t >= z.until) { z.el.remove(); this.hazards.splice(i, 1); continue; }
      if (clock.t < z.armAt) continue;
      z.el.classList.remove('is-arming');
      if (engaged() && dist(z.x, z.y, player.x, player.y) < z.r && clock.t - z.tick > 800) {
        z.tick = clock.t;
        hurt(10 + this.round, 'frost');
      }
    }
  }
}

class ShadowMage extends Boss {
  move() {
    if (!this.nextBlink || clock.t >= this.nextBlink) {
      this.nextBlink = clock.t + 5000;
      if (this.threat()) {
        this.el.classList.add('is-blink');
        later(180, () => {
          this.ox = rand(-150, 150);
          this.oy = rand(-18, 18);
          this.el.classList.remove('is-blink');
        });
      }
    }
  }
  attack() {
    const r = this.round;
    this.nextAttack = clock.t + (r >= 6 ? 2400 : 3000);
    const n = r >= 4 ? 5 : 3;
    const base = Math.atan2(player.y - this.y, player.x - this.x);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.32;
      spawnProjectile({
        x: this.x, y: this.y, tx: this.x + Math.cos(a) * 100, ty: this.y + Math.sin(a) * 100,
        speed: 170, damage: 9 + r, radius: 8, ttl: 3200, cls: 'proj--orb',
      });
    }
  }
}

class DragonKing extends Boss {
  move(dt) {
    this.t = (this.t || 0) + dt;
    this.oy = Math.sin(this.t * 1.4) * 8;
    this.ox = Math.sin(this.t * 0.35) * 50;
  }
  attack() {
    const r = this.round;
    this.nextAttack = clock.t + (r >= 6 ? 2200 : 2800);
    this.volleys++;
    const dmg = 14 + r * 2;
    if (r >= 4 && this.volleys % 4 === 0) {
      // Nova ring
      sfx('boom');
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        spawnProjectile({ x: this.x, y: this.y, tx: this.x + Math.cos(a), ty: this.y + Math.sin(a), speed: 160, damage: dmg, radius: 10, ttl: 3500, cls: 'proj--dragonfire' });
      }
      return;
    }
    const n = r >= 6 ? 5 : r >= 3 ? 3 : 1;
    const base = Math.atan2(player.y - this.y, player.x - this.x);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.22;
      spawnProjectile({ x: this.x, y: this.y + 10, tx: this.x + Math.cos(a) * 100, ty: this.y + 10 + Math.sin(a) * 100, speed: 210, damage: dmg, radius: 10, ttl: 3500, cls: 'proj--dragonfire' });
    }
  }
}

const CLASSES = { ice: IceGolem, shadow: ShadowMage, dragon: DragonKing };

export function initBosses() {
  for (const id of Object.keys(CLASSES)) {
    const sp = spawnOf('boss', 'boss', id);
    if (sp) bosses[id] = new CLASSES[id](id, sp);
  }
  onMeasure(() => Object.values(bosses).forEach((b) => b.sync()));
}

export function updateBosses(dt) {
  for (const b of Object.values(bosses)) b.update(dt);
}

export function clearBossHazards() {
  for (const b of Object.values(bosses)) b.clearHazards();
}
