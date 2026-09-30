// Easter eggs that live in the 3D world. They react to picks (clicks on landmarks and actors) that
// the director publishes on the bus, and to a few game events. Each one is a small, self-contained
// joke; the registry in site/eggs.js keeps score.
import { on } from './bus.js';
import { found, has, available } from '../site/eggs.js';
import { VERDICTS } from './landmarks.js';
import { S } from './state.js';
import { reducedMotion } from '../three/env.js';

const rand = (a) => a[Math.floor(Math.random() * a.length)];

export function initWorldEggs(world) {
  const { stage, director, fx, player } = world;
  const flash = (x, y, z, color = '#f2b84b', n = 14) => fx.burst(x, y, z, color, n, 5, 0.8, 0.7);

  // ---- Geisel: a hat first, then liftoff
  const towerClicks = [];
  let seussLine = 0;
  const SEUSS = ['Geisel Library is named for Dr. Seuss. Of course there is a hat.', 'Yes, the hat again.', 'Careful. It only takes one more.'];
  function onTower() {
    const now = performance.now();
    towerClicks.push(now);
    while (towerClicks.length && now - towerClicks[0] > 7000) towerClicks.shift();
    if (towerClicks.length >= 3) {
      towerClicks.length = 0;
      stage.liftoff();
      found('geisel');
      director.say('me', 'That is not in the brochure.', 6000);
      fx.shake(0.5, 900);
      return;
    }
    stage.hatTrick();
    found('hat');
    director.say('me', SEUSS[Math.min(seussLine++, SEUSS.length - 1)], 4200);
  }

  // ---- OJ verdicts: it is always test 3
  let judged = 0;
  function onJudge() {
    const v = judged++ === 0 ? VERDICTS[1] : rand(VERDICTS);
    stage.judge.judge(v);
    const a = world.stage.anchors['mon-oj'];
    fx.text(a.x, a.y + 5, a.z, v.text, v.ok ? 'heal' : 'hurt');
    found('judge');
    if (v.ok) found('accepted', { say: 'Accepted. It ran in 0 ms, which is suspicious.' });
  }

  // ---- flags: touch all six
  const touched = new Set();
  function onFlag(id) {
    const a = stage.anchors[id];
    flash(a.x, a.y + 2, a.z, '#fde68a', 10);
    touched.add(id);
    if (touched.size >= 6) found('flags');
  }

  // ---- pokes and pets
  let pokes = 0, pets = 0;
  on('scholar:poke', () => { if (++pokes >= 5) found('poke'); });
  on('bit:pet', () => { if (++pets >= 7) found('pet'); });

  on('pick', ({ id, egg, point }) => {
    if (!egg && !id.startsWith('flag-')) return;
    if (id.startsWith('flag-')) return onFlag(id);
    switch (egg) {
      case 'geisel': onTower(); break;
      case 'moon':
        stage.sky.shower(7);
        found('moon');
        director.say('me', 'I wish for reviewers who read the appendix.', 5200);
        break;
      case 'triton': {
        const a = stage.anchors['mon-triton'];
        flash(a.x, a.y + 4, a.z, '#38bdf8', 22);
        fx.ring(a.x, a.y - 3, a.z, '#38bdf8', 4, 0.8);
        fx.text(a.x, a.y + 8, a.z, 'GO TRITONS!', 'super');
        found('triton');
        break;
      }
      case 'sungod': {
        const a = stage.anchors.sungod;
        for (const c of ['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#ec4899']) flash(a.x, a.y + 3, a.z, c, 12);
        stage.sungod.rotation.y += Math.PI * 2;
        fx.text(a.x, a.y + 8, a.z, 'SUN GOD FESTIVAL', 'super');
        found('sungod');
        director.say('me', 'Wrong week for the festival. Nobody told the statue.', 5200);
        break;
      }
      case 'sealion': {
        const p = point;
        fx.text(p.x, p.y + 2, p.z, 'ARF! ARF!', 'gold');
        flash(p.x, p.y + 1, p.z, '#a98461', 8);
        found('sealion');
        break;
      }
      case 'glider': {
        const p = point;
        flash(p.x, p.y, p.z, '#fca5a5', 10);
        fx.text(p.x, p.y + 2, p.z, 'wave!', 'info');
        found('glider');
        break;
      }
      case 'judge': onJudge(); break;
      case 'mailbox':
        stage.mailbox.raise(1);
        setTimeout(() => stage.mailbox.raise(0), 5200);
        found('mailbox');
        director.say('me', 'Flag is up. It is yil384@ucsd.edu, in case the pigeons get lost.', 6000);
        break;
      case 'gate':
        found('gate');
        director.say('me', '自强不息，厚德载物. Self-discipline and social commitment.', 6500);
        break;
      case 'fallen': {
        const a = stage.anchors.cse;
        flash(a.x, a.y + 24, a.z, '#fff3b0', 18);
        fx.text(a.x, a.y + 26, a.z, 'Fallen Star', 'super');
        found('fallen');
        director.say('me', 'It has been there since before I arrived. Nobody has knocked.', 5200);
        break;
      }
      default: break;
    }
  });

  // ---- game events
  on('mode', (m) => { if (m === 'play') found('wasd'); });
  on('boss:defeated', ({ id }) => {
    if (id === 'ice') found('oom');
    if (id === 'shadow') found('reviewer2');
    if (id === 'dragon') found('deadline');
  });
  on('secret:chest', () => found('oracle'));
  if (S.secret.chest) found('oracle');
  if (S.bosses.ice.kills) found('oom');
  if (S.bosses.shadow.kills) found('reviewer2');
  if (S.bosses.dragon.kills) found('deadline');

  // ---- Bit whispers a hint for an egg you have not found, if you have been idle for a while
  let lastHint = 0;
  setInterval(() => {
    const idle = performance.now() - lastActive;
    if (world.playing || world.paused || document.hidden || asleep || idle < 24000 || performance.now() - lastHint < 45000) return;
    const pool = available().filter((e) => e.kind !== 'game' && !has(e.id) && e.id !== 'sleep');
    if (!pool.length) return;
    lastHint = performance.now();
    director.say('bit', `psst… ${rand(pool).hint}`, 7000);
  }, 2000);

  // ---- the scholar nods off if left alone
  let lastActive = performance.now();
  let asleep = false;
  let zzz = 0;
  const wake = () => {
    lastActive = performance.now();
    if (!asleep) return;
    asleep = false;
    player.mesh.rotation.z = 0;
    player.mesh.position.x = player.x;
    director.say('me', 'I was just resting my eyes.', 3600);
  };
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart']) window.addEventListener(ev, wake, { passive: true });
  window.addEventListener('pointermove', (e) => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) wake(); }, { passive: true });
  setInterval(() => {
    if (world.playing || world.paused || document.hidden) { lastActive = performance.now(); return; }
    if (!asleep && performance.now() - lastActive > 55000 && !world.tour.busy) {
      asleep = true;
      zzz = 0;
      director.say('me', 'Zzz…', 4200);
      found('sleep');
    } else if (asleep && ++zzz % 6 === 0) director.say('me', rand(['Zzz…', 'zzz… one more epoch…', 'Zzz… accepted… zzz…']), 3800);
  }, 1000);
  // lying down: a small tilt each frame while asleep (placeActors only sets yaw); the loop only runs while asleep
  let tilting = false;
  const tilt = () => {
    if (!asleep) { tilting = false; return; }
    if (!reducedMotion.matches) player.mesh.rotation.z += (1.35 - player.mesh.rotation.z) * 0.08;
    requestAnimationFrame(tilt);
  };
  setInterval(() => { if (asleep && !tilting) { tilting = true; requestAnimationFrame(tilt); } }, 1000);

  world.eggs = { has };
  if (window.__g) window.__g.eggs = world.eggs;
}
