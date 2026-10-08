// The opening: about four seconds of the Green Ninja against Lord Deadline over a UC San Diego / ninja-city
// skyline (scene.js, a 2D canvas), then the screen cracks around the hit and shatters like glass into the real
// page (shatter3d.js in three.js, or drawShards2D on the 2D canvas when three.js is not there or is late).
//
// Whether it plays is decided before first paint by the inline script in index.html (html.intro-on: once per
// browser session, not in Reviewer mode, not with reduced motion, not on deep links or automated browsers;
// ?intro=1 forces it, ?intro=0 turns it off). Any click, tap, key or scroll skips straight to the impact;
// a second one (or Esc) ends it. The page under it is complete the whole time; the 3D world waits for
// window.__intro.done so the two never fight over the main thread. Test hooks: ?introAt=<s> freezes the clock
// there, ?intro3d=0|1 forces the 2D / three.js shatter, window.__intro.seek(s) / .hold(s).
import { createScene, BEAT, rng } from './scene.js';
import { fracture, shardMotion, drawShards2D } from './fracture.js';
import { probeGPU } from '../three/env.js';
import { loadArt } from './art.js';

const html = document.documentElement;
const q = new URLSearchParams(location.search);
let resolveDone;
const state = { done: new Promise((r) => { resolveDone = r; }), playing: false, phase: 'off', t: 0, seek: null, mode: '' };
window.__intro = state;

if (html.classList.contains('intro-on')) {
  run().catch((err) => {
    console.warn('[intro] skipped:', err);
    if (state.stop) state.stop();
    else {
      document.querySelector('.intro')?.remove();
      html.classList.remove('intro-on', 'intro-live');
      state.phase = 'over';
      resolveDone();
    }
  });
} else resolveDone();

async function run() {
  state.playing = true;
  try { window.sessionStorage.setItem('yl.intro', '1'); } catch { /* storage blocked: it may play again */ }

  const root = document.createElement('div');
  root.className = 'intro';
  const c2 = document.createElement('canvas');
  c2.className = 'intro__c';
  c2.setAttribute('aria-hidden', 'true');
  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'intro__skip';
  const touch = matchMedia('(pointer: coarse)').matches;
  skipBtn.innerHTML = `${touch ? 'Tap to skip' : 'Skip'} <span aria-hidden="true">▸▸</span>`;
  skipBtn.setAttribute('aria-label', 'Skip the opening animation');
  root.append(c2, skipBtn);
  document.body.append(root);
  html.classList.add('intro-live');

  const w = root.clientWidth || innerWidth, h = root.clientHeight || innerHeight;
  const dpr = window.devicePixelRatio || 1;
  const R = Math.min(dpr, touch ? 1.6 : 1.5, Math.sqrt(2.4e6 / (w * h)));
  c2.width = Math.round(w * R);
  c2.height = Math.round(h * R);

  // the titles use the pixel fonts and the characters are images (art.js): give them a moment (the opening is black
  // for the first beat anyway, and a cached visit has them at once). If the fight's images are not all there by then,
  // the scene draws its own stand-ins for this visit.
  const art = loadArt();
  const fontWait = Promise.all(['700 20px Silkscreen', '20px "Press Start 2P"'].map((f) => (document.fonts ? document.fonts.load(f).catch(() => null) : null)));
  await Promise.race([Promise.all([fontWait, art.core]), new Promise((r) => setTimeout(r, art.any ? 1500 : 350))]);

  const scene = createScene(c2, { w, h, R, art: art.art });
  const ctx = c2.getContext('2d');
  const [ix, iy] = scene.impact();
  const fr = shardMotion(fracture(w, h, ix, iy, rng(4242)), rng(777));
  scene.setFracture(fr);
  const snap = document.createElement('canvas');
  snap.width = c2.width; snap.height = c2.height;

  // three.js for the shatter, loading while the fight plays (the world needs the same modules next)
  let gl = null, glState = 'off';
  const probe = probeGPU();
  const want3d = q.get('intro3d') === '1' || (q.get('intro3d') !== '0' && probe.ok && !probe.software && navigator.connection?.saveData !== true);
  let c3 = null;
  if (want3d) {
    glState = 'loading';
    c3 = document.createElement('canvas');
    c3.className = 'intro__c';
    c3.setAttribute('aria-hidden', 'true');
    root.insertBefore(c3, skipBtn);
    import('./shatter3d.js')
      .then((m) => m.createShatter3D(c3, { w, h, dpr: Math.min(dpr, 1.5), fr, snap, rand: rng(99) }))
      .then((x) => { if (state.phase === 'over') x.dispose(); else { gl = x; glState = 'ready'; } })
      .catch((err) => { console.warn('[intro] three.js shatter unavailable, using 2D:', err); glState = 'failed'; c3?.remove(); c3 = null; });
  }

  let freeze = q.has('introAt') ? Math.max(0, parseFloat(q.get('introAt')) || 0) : Infinity;
  let t = 0, speed = 1, last = 0, raf = 0, wait = 0, shatterAt = 0, watchdog = 0;
  state.phase = 'stage';
  state.seek = (s) => { t = s; };
  state.hold = (s) => { freeze = s; };

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (!watchdog && freeze === Infinity) watchdog = setTimeout(stop, 16000);
    const dt = last ? Math.min(0.1, Math.max(0, (now - last) / 1000)) : 1 / 60;
    last = now;
    const t0 = performance.now();
    try {
      if (state.phase === 'stage') {
        if (t < freeze) t = Math.min(freeze, t + dt * speed);
        if (t > 0.15) scene.prepare();
        if (t >= BEAT.shatter) {
          // hold the cracked frame for three.js a little (up to 1.4 s), then go without it
          if (glState === 'loading' && wait < 1.4) { wait += dt; t = BEAT.shatter; }
          else { shatter(); return; }
        }
        scene.draw(Math.min(t, BEAT.shatter - 1e-3), dt);
      } else if (state.phase === 'shatter') {
        if (t < freeze) t = Math.min(freeze, t + dt * speed);
        const ts = t - shatterAt;
        const alive = gl ? gl.render(ts) : drawShards2D(ctx, snap, fr, ts, w, h, R);
        if (!alive) stop();
      }
      state.t = t;
      const ms = performance.now() - t0;
      state.ms = state.ms ? state.ms * 0.9 + ms * 0.1 : ms;
      state.maxMs = Math.max(state.maxMs || 0, ms);
    } catch (err) {
      console.warn('[intro] stopped:', err);
      stop();
    }
  };

  function shatter() {
    snap.getContext('2d').drawImage(c2, 0, 0);
    root.classList.add('is-shattering');
    html.classList.remove('intro-on');
    state.phase = 'shatter';
    shatterAt = t;
    if (gl) {
      state.mode = '3d';
      gl.upload();
      gl.render(0);
      c2.style.visibility = 'hidden';
    } else {
      state.mode = '2d';
      c3?.remove();
      drawShards2D(ctx, snap, fr, 0, w, h, R);
    }
  }

  function skip() {
    if (state.phase === 'stage') {
      if (t < BEAT.impact - 0.04) t = BEAT.impact - 0.04;
      speed = 1.6;
    } else if (state.phase === 'shatter') stop();
  }

  const onKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key === 'Tab' || e.key === 'Shift') return;
    e.stopImmediatePropagation();
    if (e.key === ' ' || e.key.startsWith('Arrow') || e.key.startsWith('Page')) e.preventDefault();
    if (e.key === 'Escape') stop(); else skip();
  };
  const onPoint = (e) => { if (!skipBtn.contains(e.target)) skip(); };
  const onScroll = () => skip();
  const onResize = () => {
    if (Math.abs(root.clientWidth - w) > 2 || Math.abs(root.clientHeight - h) > 140) stop();
  };
  skipBtn.addEventListener('click', (e) => { e.stopPropagation(); if (state.phase === 'stage') skip(); else stop(); });
  root.addEventListener('pointerdown', onPoint);
  addEventListener('keydown', onKey, true);
  addEventListener('wheel', onScroll, { passive: true });
  addEventListener('touchmove', onScroll, { passive: true });
  addEventListener('resize', onResize);

  function stop() {
    if (state.phase === 'over') return;
    state.phase = 'over';
    state.playing = false;
    cancelAnimationFrame(raf);
    clearTimeout(watchdog);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('wheel', onScroll);
    window.removeEventListener('touchmove', onScroll);
    window.removeEventListener('resize', onResize);
    html.classList.remove('intro-on', 'intro-live');
    root.classList.add('is-shattering', 'is-out');
    setTimeout(() => {
      root.remove();
      if (gl) {
        gl.dispose();
        try { c3?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* already gone */ }
        gl = null;
      }
      resolveDone();
    }, 260);
    // let the stage's canvases go
    state.seek = state.hold = state.stop = null;
  }
  state.stop = stop;

  raf = requestAnimationFrame(frame);
}
