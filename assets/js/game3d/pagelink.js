// Page -> world: the page's game UI (site/ui/*) announces what the reader did on the bus as
// `page:*` events (SPEC §2.12); this module makes the island answer. Every reaction is small,
// throttled so a reader hammering a button never floods the scene, wrapped so a failure can never
// reach the page, and a no-op while the world is paused (Reviewer mode). Nothing here moves the
// camera; the one shake is skipped in play mode.
import { on } from './bus.js';
import { LAYOUT } from './layout.js';
import { reducedMotion } from '../three/env.js';

const GOLD = '#f2b84b';
const GREEN = '#4ade80';

/** Who speaks when a chapter is cleared, and what they say. */
const CLEAR_LINES = {
  about: ['ash', 'Character sheet read. I will put you on the map.'],
  edu: ['ash', 'Both schools charted. The path is on the map now.'],
  library: ['nell', 'Both shelves read. Library card stamped.'],
  trail: ['me', 'Six flags, one trail. Quest log complete.'],
  workshop: ['unit7', 'Workshop inventory reviewed. Nothing is on fire.'],
  meadow: ['fern', 'You found the meadow. The mailbox is always open.'],
  footer: ['bit', 'You read all the way down!'],
};
/** Section keys that have no anchor of their own: the landmark that stands for them. */
const STANDS_FOR = { footer: 'pier', contact: 'mailbox', projects: 'workbench', skills: 'workbench' };

export function initPageLink(api) {
  const { stage, director, fx, player, buddy, rig } = api;
  const flagColour = Object.fromEntries(LAYOUT.flags.map((f) => [f.id, f.colour]));

  // ---- helpers ----
  const last = new Map();
  /** true at most once per `ms` for `name` */
  const gate = (name, ms) => {
    const now = performance.now();
    if (now - (last.get(name) ?? -Infinity) < ms) return false;
    last.set(name, now);
    return true;
  };
  /** A world point for a page key: a landmark anchor, a shot's look point, or the scholar. */
  function where(key) {
    const k = STANDS_FOR[key] || key;
    const a = stage.anchors[k] || stage.anchors[stage.shots[k]?.item];
    if (a) return { x: a.x, y: a.y, z: a.z };
    const s = stage.shots[k];
    if (s) return { x: s.look[0], y: s.look[1], z: s.look[2] };
    return feet();
  }
  const feet = () => ({ x: player.x, y: player.y, z: player.z });
  const say = (who, text, ms) => director.say(who, text, ms);
  const colourOk = (c) => typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c);
  const wake = () => api.invalidate?.();

  /** Subscribe `fn` to a page event: skipped while paused, never throws, wakes the loop. */
  function react(event, fn, { minGap = 0 } = {}) {
    on(event, (payload) => {
      if (api.paused) return;
      if (minGap && !gate(event, minGap)) return;
      try { fn(payload ?? {}); wake(); } catch (err) { console.warn(`[pagelink] ${event}`, err); }
    });
  }

  // ---- reactions ----
  react('page:open', ({ key }) => {
    if (!key) return;
    if (!gate(`open:${key}`, 400)) return;
    director.pulse?.(key, 1500);
    const p = where(key);
    fx.burst(p.x, p.y + 2, p.z, GOLD, 10, 4, 0.7, 0.7);
  }, { minGap: 150 });

  react('page:clear', ({ shot }) => {
    if (!shot || !gate(`clear:${shot}`, 5000)) return;
    const p = where(shot);
    fx.ring(p.x, p.y, p.z, GOLD, 3.2, 0.9);
    const line = CLEAR_LINES[shot];
    if (line) say(line[0], line[1], 5200);
  });

  react('page:bonk', ({ kind, key }) => {
    const p = key ? where(key) : feet();
    fx.burst(p.x, p.y + 1.5, p.z, BONK_COLOUR[kind] || '#a3e635', 6, 3, 0.5, 0.55);
  }, { minGap: 250 });

  react('page:coin', () => {
    fx.ring(player.x, player.y, player.z, GOLD, 1.4, 0.5);
  }, { minGap: 300 });

  // rewards: coalesce into at most one floating "+N" per second
  let pend = { xp: 0, cash: 0 }, pendTimer = 0;
  function flushReward() {
    pendTimer = 0;
    if (api.paused) { pend = { xp: 0, cash: 0 }; return; }
    const { xp, cash } = pend;
    pend = { xp: 0, cash: 0 };
    last.set('reward', performance.now());
    const y = player.y + 4.6;
    if (xp > 0) fx.text(player.x, y, player.z, `+${xp} XP`, 'xp');
    if (cash > 0) fx.text(player.x + 0.8, y - 0.6, player.z, `+${cash} ◈`, 'gold');
    wake();
  }
  react('page:reward', ({ xp = 0, cash = 0 }) => {
    pend.xp += Math.max(0, Math.round(+xp) || 0);
    pend.cash += Math.max(0, Math.round(+cash) || 0);
    if (!pend.xp && !pend.cash) return;
    if (pendTimer) return;
    const wait = Math.max(0, 1000 - (performance.now() - (last.get('reward') ?? -Infinity)));
    pendTimer = setTimeout(flushReward, wait);
  });

  react('page:levelup', ({ level, title }) => {
    if (level == null) return;
    say('bit', title ? `Level ${level}! ${title}.` : `Level ${level}!`, 5200);
    fx.burst(buddy.x, buddy.y + 2, buddy.z, '#c4b5fd', 12, 4, 0.8, 0.7);
  }, { minGap: 1500 });

  react('page:hat', () => {
    stage.hatTrick();
    stage.sky.shower(8);
  }, { minGap: 5000 });

  react('page:sky', ({ n }) => {
    stage.sky.shower(Math.max(1, Math.min(10, +n || 3)));
  }, { minGap: 1000 });

  react('page:stamp', ({ key }) => {
    if (!key || !stage.anchors[key]) return;
    const a = stage.anchors[key];
    const c = flagColour[key] || GOLD;
    fx.ring(a.x, a.y - 4, a.z, c, 2.4, 0.7);
    fx.burst(a.x, a.y + 1, a.z, c, 10, 4, 0.7, 0.7);
  }, { minGap: 200 });

  react('page:equip', ({ key, on: equipped }) => {
    if (key) director.pulse?.(key, 2000);
    if (equipped && gate('equip-line', 8000)) say('unit7', 'Equipped. Please do not feed the gear.', 4200);
  }, { minGap: 200 });

  react('page:judge', (v) => {
    if (!v || typeof v.text !== 'string') return;
    const verdict = { text: v.text.slice(0, 40), colour: colourOk(v.colour) ? v.colour : (v.ok ? GREEN : '#f87171'), ok: !!v.ok };
    stage.judge.judge(verdict);
    const a = stage.anchors['mon-oj'];
    if (a && gate('judge-text', 1000)) fx.text(a.x, a.y + 5, a.z, verdict.text, verdict.ok ? 'heal' : 'hurt');
  }, { minGap: 150 });

  react('page:mailbox', ({ up }) => {
    stage.mailbox.raise(up ? 1 : 0);
  });

  react('page:classchange', () => {
    const a = stage.anchors.cse;
    fx.ring(a.x, a.y, a.z, GOLD, 6, 1);
    fx.burst(a.x, a.y + 10, a.z, GOLD, 14, 5, 0.9, 0.8);
    say('ash', 'Two gates, one path. Welcome to La Jolla.', 5600);
  }, { minGap: 5000 });

  react('page:oom', () => {
    if (!api.playing && !reducedMotion.matches) fx.shake(0.3, 250);
    say('unit7', 'The cold aisle is getting crowded…', 4600);
  }, { minGap: 2000 });

  react('page:portal', () => {
    const a = stage.anchors.sungod;
    fx.ring(a.x, a.y - 3, a.z, '#fde68a', 3, 0.7);
  }, { minGap: 400 });

  react('page:save', () => {
    fx.ring(player.x, player.y, player.z, GREEN, 2.2, 0.8);
    say('me', 'Saved. Also hydrated.', 4200);
  }, { minGap: 2000 });

  react('page:checkpoint', ({ to }) => {
    if (!to || !stage.shots[to]) return;
    fx.ring(player.x, player.y, player.z, '#a5b4fc', 1.2, 0.45);
  }, { minGap: 800 });

  react('page:start', () => {
    fx.ring(player.x, player.y, player.z, GOLD, 2, 0.7);
    say('me', 'Off we go!', 3600);
  }, { minGap: 3000 });

  react('page:credits', () => {
    const cam = rig?.cam;
    if (!cam || !stage.flyby || reducedMotion.matches || api.playing) { stage.sky.shower(4); return; }
    // three points in front of the camera, spread across the frame, read every frame so they follow a scroll
    const fwd = { x: 0, y: 0, z: 0 };
    stage.flyby((i) => {
      const e = cam.matrixWorld.elements;          // columns: right (0..2), up (4..6), back (8..10)
      fwd.x = -e[8]; fwd.y = -e[9]; fwd.z = -e[10];
      // scaled to the current shot so they read as "close" without filling the frame; upper third of the view
      const d = Math.max(30, (rig.cur?.dist ?? 60) * 0.6) + i * 6;
      const side = (i - 1) * d * 0.3, lift = d * (0.16 - Math.abs(i - 1) * 0.05);
      return {
        x: cam.position.x + fwd.x * d + e[0] * side + e[4] * lift,
        y: cam.position.y + fwd.y * d + e[1] * side + e[5] * lift,
        z: cam.position.z + fwd.z * d + e[2] * side + e[6] * lift,
      };
    }, 7);
    stage.sky.shower(2);
  }, { minGap: 8000 });

  react('bit:pet', () => {
    buddy.hop = 0.5;
  }, { minGap: 350 });

  // Reviewer mode: the world sleeps. Not gated by `paused` (it is the switch).
  on('page:plain', (plain) => {
    try { api.setPaused(!!plain); } catch (err) { console.warn('[pagelink] page:plain', err); }
  });
  // the page may already be plain when the world finishes loading
  if (document.documentElement.classList.contains('is-plain')) api.setPaused(true);
}

// critter kinds (site/ui/critters.js), under the names the page may use for them
const BONK_COLOUR = {
  seagull: '#e5e7eb',
  slime: '#a3e635', offbyone: '#a3e635', 'off-by-one': '#a3e635',
  nan: '#f472b6', 'nan-slime': '#f472b6',
  legacy: '#a8a29e', 'legacy-code': '#a8a29e',
  segfault: '#94a3b8', null: '#94a3b8', 'null-pointer': '#94a3b8', bat: '#94a3b8',
};
