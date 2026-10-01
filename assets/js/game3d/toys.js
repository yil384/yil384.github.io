// Hub toys for play mode: two Triton-blue-and-gold balls you kick by walking (or driving) into them
// or swing at (one by the plaza, one on the RIMAC field, where the goals count), the Price Center food
// stands (E · order, on the house), and the Library Walk club tables handing out joke flyers.
// Never punishing: a ball that rolls into the sea comes home, food only restores, nothing costs gold.
import * as THREE from 'three/webgpu';
import { on } from './bus.js';
import { player, heal, restoreMp } from './player.js';
import { mode } from './mode.js';
import { LAYOUT } from './layout.js';
import { voxBuild } from './props.js';
import { interactable, dialog, onUpdate, trigger, say, banner } from './regions.js';
import { bitSay } from './emotes.js';
import { sfx } from './audio.js';
import * as fx from './fx.js';
import { registerEgg, found } from '../site/eggs.js';

const EGGS = [
  { id: 'goal', name: 'Golazo', hint: 'A ball waits by the plaza, and the RIMAC field has goals.', done: 'Tritons 1, Reviewer #2 0.' },
  { id: 'foodcourt', name: 'Balanced diet', hint: 'Order something at every Price Center stand.', done: 'Tacos, boba, coffee, noodles: the four food groups of a Ph.D.' },
  { id: 'flyers', name: 'Free snacks', hint: 'The Library Walk club tables hand out flyers. Collect them all.', done: 'Six flyers, zero clubs joined. Classic.' },
];

const FLYERS = [
  'SLEEP CLUB. Meetings: never. Attendance: perfect.',
  'ROCK CLIMBING CLUB. Your step-up is one block. Ours is six.',
  'FREE PIZZA at the department seminar! (The seminar is the price.)',
  'RUBBER DUCK DEBUGGING SOCIETY. The duck is president. The duck has never been wrong.',
  'BENCHMARK APPRECIATION CLUB. We measure everything, including this flyer (A4, 80 gsm, 0.3 s to read).',
  'OFFICE HOURS SURVIVORS. Bring snacks, not questions.',
];

const R = 0.46;                  // ball radius (world units)
const G = 24;

export function createToys({ hubCtx, ambient = null }) {
  const world = hubCtx.world;
  for (const e of EGGS) registerEgg({ ...e, kind: 'game', src: 'world', region: 'hub', regionName: 'UC San Diego island' });
  const st = hubCtx.state;

  // ---------------------------------------------------------------- balls
  const F = LAYOUT.rimac.field;
  const fieldY = world.height(F.x, F.z);
  const goals = [{ x: F.x - 4, dir: -1 }, { x: F.x + 4, dir: 1 }];       // dir: the way the ball crosses the line to score
  const cells = [];
  for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) for (let z = -2; z <= 2; z++) {
    if (x * x + y * y + z * z > 5.6) continue;
    const band = Math.abs(y) <= 0 ? '#f8fafc' : (x + z + 8) % 4 < 2 ? '#1f4fa8' : '#f2b84b';
    cells.push([x, y, z, band, band === '#f2b84b' ? 0.15 : 0]);
  }
  const balls = [];
  function addBall(hx, hz, name) {
    const mesh = voxBuild(cells, { roughness: 0.5 });
    mesh.scale.setScalar(0.19);
    mesh.name = name;
    hubCtx.group.add(mesh);
    const b = { hx, hz, x: hx, z: hz, y: 0, vx: 0, vy: 0, vz: 0, mesh, asleep: false, kickAt: -1e9, scored: false, hinted: false, name };
    home(b);
    balls.push(b);
    return b;
  }
  function floorAt(x, z) { const g = world.height(x, z); return g === -Infinity ? -Infinity : g + 0.5; }
  function home(b) {
    b.x = b.hx; b.z = b.hz; b.vx = b.vy = b.vz = 0;
    b.y = floorAt(b.x, b.z) + R;
    b.scored = false; b.asleep = true;
    b.mesh.position.set(b.x, b.y, b.z);
  }
  // a wall for the ball: a blocked column, or ground more than half a block above its bottom
  const wall = (x, z, y) => world.isBlocked(x, z) || floorAt(x, z) > y - R + 0.55;
  addBall(3.5, 3.5, 'ball-plaza');                // on the plaza, a few steps from where play starts
  addBall(F.x + 1.5, F.z, 'ball-field');

  function kick(b, dx, dz, power, up) {
    const l = Math.hypot(dx, dz) || 1;
    b.vx = (dx / l) * power; b.vz = (dz / l) * power; b.vy = up;
    b.asleep = false;
    b.kickAt = tNow;
    if (mode.play) sfx('pop');
    fx.burst(b.x, b.y - R + 0.1, b.z, '#e2e8f0', 5, 2.5, 0.35, 0.5);
  }
  // the sword sends it flying (a lob in the direction you face)
  on('player:swing', (step) => {
    if (!mode.play || !hubCtx.live) return;
    for (const b of balls) {
      const dx = b.x - player.x, dz = b.z - player.z, d = Math.hypot(dx, dz);
      if (d > 2.8 || Math.abs(b.y - player.y - 1) > 2.5) continue;
      const a = Math.atan2(dx, dz) - player.yaw;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > 1.3 && d > 1.2) continue;
      kick(b, Math.sin(player.yaw), Math.cos(player.yaw), step === 2 ? 15 : 11, step === 2 ? 9 : 6.5);
      fx.text(b.x, b.y + 1, b.z, step === 2 ? 'SMASH' : 'thwack', 'info');
    }
  });

  let px = player.x, pz = player.z;
  let tNow = 0;                  // seconds of hub time (the game clock only runs in play; the tour nudges balls too)
  onUpdate(hubCtx, (dt) => {
    if (!dt) return;
    tNow += dt;
    // the player's real velocity (feet, car or exosuit alike)
    const pvx = (player.x - px) / dt, pvz = (player.z - pz) / dt;
    px = player.x; pz = player.z;
    const playing = mode.play && !player.dead;
    for (const b of balls) {
      // ---- touch: walking (or driving) into the ball kicks it (the page's walking scholar nudges it too)
      if (playing || (!mode.play && player.walking)) {
        const dx = b.x - player.x, dz = b.z - player.z, d = Math.hypot(dx, dz);
        const reach = player.vehicle === 'car' ? 2.3 : player.vehicle === 'mech' ? 2.1 : 1.05;
        const speed = Math.min(30, Math.hypot(pvx, pvz));
        if (d < reach && Math.abs(b.y - R - player.y) < 1.6 && tNow - b.kickAt > 0.22) {
          // half where you were going, half away from you: the ball never ends up inside the scholar
          const ux = dx / (d || 1), uz = dz / (d || 1);
          const vx = speed > 0.5 ? pvx / speed : 0, vz = speed > 0.5 ? pvz / speed : 0;
          const power = speed < 0.5 ? 2.2 : 2.5 + speed * (player.vehicle === 'car' ? 1.3 : 1.15);
          kick(b, ux + vx, uz + vz, power, player.sprinting || player.vehicle ? 5.5 : speed > 0.5 ? 3 : 1.5);
          if (playing && !st.kicked) { st.kicked = true; hubCtx.save(); }
        }
        if (playing && !b.hinted && d < 5 && !st.kicked) { b.hinted = true; bitSay('That ball is asking to be kicked. Walk into it. The goals are on the RIMAC field.'); }
      }
      if (b.asleep) continue;
      // ---- physics: gravity, bounces off walls and the ground, rolling friction
      b.vy -= G * dt;
      const ox = b.x;
      const nx = b.x + b.vx * dt;
      if (wall(nx, b.z, b.y)) { b.vx = -b.vx * 0.55; if (Math.abs(b.vx) > 2 && mode.play) sfx('tick'); } else b.x = nx;
      const nz = b.z + b.vz * dt;
      if (wall(b.x, nz, b.y)) { b.vz = -b.vz * 0.55; if (Math.abs(b.vz) > 2 && mode.play) sfx('tick'); } else b.z = nz;
      b.y += b.vy * dt;
      const floor = floorAt(b.x, b.z);
      let grounded = false;
      if (floor > -Infinity && b.y - R <= floor) {
        b.y = floor + R;
        if (b.vy < -3) b.vy = -b.vy * 0.45; else { b.vy = 0; grounded = true; }
      }
      if (grounded) { const k = Math.exp(-1.7 * dt); b.vx *= k; b.vz *= k; }
      const hs = Math.hypot(b.vx, b.vz);
      if (hs > 0.01) b.mesh.rotateOnWorldAxis(AXIS.set(b.vz / hs, 0, -b.vx / hs), (hs * dt) / R);
      b.mesh.position.set(b.x, b.y, b.z);
      if (grounded && hs < 0.12) { b.vx = b.vz = 0; b.asleep = true; }
      // ---- the sea: it comes home
      if (b.y < -14) {
        home(b);
        fx.burst(b.x, b.y, b.z, '#f2b84b', 10, 3, 0.6, 0.6);
        if (playing) bitSay('The ball has been returned to its home institution.', { force: true });
      }
      // ---- goals on the RIMAC field (under the crossbar, between the posts)
      if (!b.scored && Math.abs(b.z - F.z) < 1.45 && b.y < fieldY + 3.4) {
        for (const g of goals) {
          if ((g.dir < 0 && ox > g.x && b.x <= g.x) || (g.dir > 0 && ox < g.x && b.x >= g.x)) score(b, g);
        }
      }
    }
  });
  function score(b) {
    b.scored = true;
    st.goals = (st.goals || 0) + 1;
    hubCtx.save();
    sfx('victory');
    for (const c of ['#1f4fa8', '#f2b84b', '#f8fafc']) fx.burst(b.x, b.y + 1, b.z, c, 14, 7, 0.9, 0.8);
    fx.shake(0.18, 200);
    banner('GOAL!', st.goals === 1 ? 'Tritons 1, Reviewer #2 0.' : `That is ${st.goals}. The scouts are in the stands. (There are no stands.)`, 'trophy');
    if (mode.play) {
      found('goal');
      say('me', st.goals === 1 ? 'GOOOAL! Fiat lux!' : 'And another one!', 3200);
      setTimeout(() => bitSay(st.goals === 1 ? 'I have filed this under "results".' : 'Statistically significant.', { force: true }), 1600);
      if (ambient) ambient.react(player.x, player.z, 14, 'dance', 2.5, 10);
    }
    setTimeout(() => { home(b); fx.burst(b.x, b.y, b.z, '#f8fafc', 8, 3, 0.5, 0.5); }, 2200);
  }

  // ---------------------------------------------------------------- Price Center food stands
  const Pp = LAYOUT.plots.find((p) => p.id === 'price');
  const px0 = Math.ceil(Pp.cx - Pp.hx), pz0 = Math.ceil(Pp.cz - Pp.hz);
  const FOOD = [
    { name: 'Tacos', hp: 30, lines: ['Al pastor, extra salsa. The salsa has opinions.', 'Two tacos. One for me, one for my reviewer.'] },
    { name: 'Boba', mp: 30, lines: ['Milk tea, extra pearls. Bit is now 30% tapioca.', 'Boba. A drink you chew. Research has questions.'] },
    { name: 'Coffee', mp: 45, lines: ['Fuel for paper deadlines. I suddenly want to rewrite the abstract.', 'Espresso. My GPU utilisation just went up.'] },
    { name: 'Noodles', hp: 30, lines: ['Hot, fast, cheap. Like a good baseline.', 'Noodles: the original streaming workload.'] },
  ];
  st.food = st.food || {};
  FOOD.forEach((f, i) => {
    const x = px0 + 5 + i * 4, z = pz0 + 3.3;
    interactable(hubCtx, {
      x, z, r: 1.9, label: `${f.name} stand`, prompt: 'E · order (on the house)', plateY: 3.4,
      onInteract() {
        if (f.hp) heal(f.hp); else restoreMp(f.mp);
        sfx('purchase');
        fx.burst(player.x, player.y + 2.4, player.z, '#fde68a', 8, 3, 0.5, 0.5);
        say('me', f.lines[(st.food[f.name] || 0) % f.lines.length], 3800);
        st.food[f.name] = (st.food[f.name] || 0) + 1;
        hubCtx.save();
        if (FOOD.every((q) => st.food[q.name]) && found('foodcourt')) setTimeout(() => bitSay('All four stands. Truly a balanced diet.', { force: true }), 2000);
      },
    });
  });
  trigger(hubCtx, { x: Pp.cx, z: Pp.cz, r: 8, once: true, onEnter: () => bitSay('Price Center! The stands are open late, and today they are free.') });

  // ---------------------------------------------------------------- Library Walk flyers
  const LW = LAYOUT.libwalk;
  st.flyers = Array.isArray(st.flyers) ? st.flyers : [];
  [[LW.x0 + 1, LW.z0 + 4], [LW.x1 - 1, LW.z0 + 7], [LW.x0 + 1, LW.z0 + 10], [LW.x1 - 1, LW.z0 + 12]].forEach(([x, z]) => {
    interactable(hubCtx, {
      x, z: z + 0.5, r: 2, label: 'Club table', prompt: 'E · take a flyer', plateY: 3,
      onInteract() {
        const fresh = FLYERS.map((_, i) => i).filter((i) => !st.flyers.includes(i));
        const i = fresh.length ? fresh[0] : Math.floor(Math.random() * FLYERS.length);
        if (!st.flyers.includes(i)) { st.flyers.push(i); hubCtx.save(); }
        sfx('flip');
        const n = st.flyers.length;
        dialog({ text: FLYERS[i], note: `Flyer ${n} / ${FLYERS.length}`, choices: [{ label: n >= FLYERS.length ? 'Pocket it (the set is complete)' : 'Pocket it' }] }, { name: 'Club flyer', sprite: 'book' });
        if (n >= FLYERS.length) found('flyers');
      },
    });
  });
  trigger(hubCtx, { x: (LW.x0 + LW.x1) / 2, z: (LW.z0 + LW.z1) / 2, r: 6, once: true, onEnter: () => bitSay('Library Walk. The club tables hand out flyers. Some of them even mention snacks.') });

  return { balls };
}

const AXIS = new THREE.Vector3();
