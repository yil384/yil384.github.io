// Page chrome: the top bar (zone, progress, nav highlight, egg counter, sound, play), card reveals,
// and the boot sequence. Talks to the world only through the shared event bus and the api object
// handed to attachWorld().
import { S } from '../game3d/state.js';
import { on, emit } from '../game3d/bus.js';
import { setSound, audioReady, scrollWind } from '../game3d/audio.js';
import { onChange, foundCount, total } from './eggs.js';
import { openNotes } from './notes.js';
import { say, observe } from './ui/kit.js';

const $ = (id) => document.getElementById(id);

export function initChrome() {
  const body = document.body;
  const bar = { zone: $('zone-name'), progress: $('progress'), eggs: $('eggs-btn'), count: $('eggs-count'), total: $('eggs-total'), lineCount: $('eggs-line-count'), lineTotal: $('eggs-line-total'), sound: $('sound-btn'), play: $('play-btn') };
  let world = null;

  // ---- egg counter
  let lastCount = foundCount();
  const renderEggs = () => {
    const n = foundCount(), t = total();
    bar.count.textContent = n; bar.total.textContent = t; bar.lineCount.textContent = n; bar.lineTotal.textContent = t;
    if (n !== lastCount) { bar.eggs.classList.remove('is-pop'); void bar.eggs.offsetWidth; bar.eggs.classList.add('is-pop'); lastCount = n; }
  };
  onChange(renderEggs);
  renderEggs();
  bar.eggs.addEventListener('click', () => openNotes());
  $('eggs-line')?.addEventListener('click', () => openNotes());

  // ---- sound
  const renderSound = () => {
    const on_ = !!S.settings.sound;
    bar.sound.setAttribute('aria-pressed', String(on_));
    bar.sound.title = `Sound effects: ${on_ ? 'on' : 'off'}`;
    bar.sound.querySelector('img').src = `assets/icons/ui/${on_ ? 'volume-2' : 'volume-x'}.svg`;
  };
  bar.sound.addEventListener('click', () => {
    const first = !S.settings.soundTouched;
    S.settings.soundTouched = true;
    setSound(!S.settings.sound);
    renderSound();
    if (S.settings.sound && first) say('bit', 'Ooh, speakers.');
  });
  renderSound();
  on('mode', renderSound);
  // browsers keep a page silent until the first tap / click / key: say so once, when the reader starts scrolling
  let hinted = false;
  const hint = () => {
    if (hinted || !S.settings.sound || audioReady() || scrollY < 200) return;
    hinted = true;
    window.removeEventListener('scroll', hint);
    say('bit', 'This island has sound. Tap or click anywhere to wake the speakers (the speaker button mutes it).');
  };
  window.addEventListener('scroll', hint, { passive: true });
  // the wind: scroll speed, smoothed, drives a filtered-noise gust (audio.js scrollWind); it dies down when you stop
  let lastY = scrollY, lastT = performance.now(), v = 0, windRaf = 0, tickT = 0;
  const windTick = (now) => {
    const dt = Math.min(0.1, (now - (tickT || now)) / 1000); tickT = now;
    v *= Math.exp(-dt / 0.22);                        // the gust dies down within ~half a second of stopping
    scrollWind(document.documentElement.classList.contains('is-play') ? 0 : v);
    if (v > 8) windRaf = requestAnimationFrame(windTick); else { v = 0; scrollWind(0); windRaf = 0; tickT = 0; }
  };
  window.addEventListener('scroll', () => {
    const now = performance.now(), dt = Math.max(12, now - lastT);
    const inst = Math.min(12000, Math.abs(scrollY - lastY) / dt * 1000);
    lastY = scrollY; lastT = now;
    v = dt > 400 ? inst * 0.5 : v + (inst - v) * 0.4;   // a fresh start after a pause ramps in, it never pops
    if (!windRaf) windRaf = requestAnimationFrame(windTick);
  }, { passive: true });
  on('ui:sound', renderSound);

  // ---- section cards fade in as they arrive (through kit's shared observer)
  document.querySelectorAll('.card').forEach((c) => observe(c, { threshold: 0.12 }, () => c.classList.add('is-in')));

  // ---- nav highlight, zone name, side of the screen the text is on
  const links = [...document.querySelectorAll('.bar__nav a')];
  let lastSection = '';
  on('shot', ({ el, zone }) => {
    const sec = el.closest('section');
    const side = sec?.dataset.side || 'left';
    body.dataset.side = side;
    if (zone && bar.zone.textContent !== zone) {
      bar.zone.style.opacity = '0';
      setTimeout(() => { bar.zone.textContent = zone; bar.zone.style.opacity = '1'; }, 160);
    }
    const id = sec?.id || '';
    if (id !== lastSection) {
      lastSection = id;
      for (const a of links) a.classList.toggle('is-active', a.getAttribute('href') === `#${id}`);
    }
    document.querySelectorAll('[data-focus].is-current').forEach((n) => n.classList.remove('is-current'));
    if (el.dataset.focus) el.classList.add('is-current');
  });
  on('progress', (p) => bar.progress.style.setProperty('--p', p.toFixed(4)));
  document.querySelectorAll('.bar__nav a').forEach((a) => a.addEventListener('click', () => { $('nav-toggle').checked = false; }));

  // Without the world there are no director events: a small scroll spy keeps the nav, zone name and
  // progress bar honest.
  let spying = false;
  // Reviewer mode pauses the world and its director: the scroll spy keeps the bar honest meanwhile
  on('page:plain', (plain) => { if (plain) startSpy(); });
  if (document.documentElement.classList.contains('is-plain')) queueMicrotask(startSpy);
  function startSpy() {
    if (spying) return;
    spying = true;
    const secs = [...document.querySelectorAll('main section[data-shot]')];
    let queued = false;
    const tick = () => {
      queued = false;
      const mid = innerHeight * 0.45;
      let best = null, bd = Infinity;
      for (const sec of secs) {
        const r = sec.getBoundingClientRect();
        const d = mid >= r.top && mid <= r.bottom ? 0 : Math.min(Math.abs(mid - r.top), Math.abs(mid - r.bottom));
        if (d < bd) { bd = d; best = sec; }
      }
      if (best) {
        body.dataset.side = best.dataset.side || 'left';
        if (best.dataset.zone && bar.zone.textContent !== best.dataset.zone) bar.zone.textContent = best.dataset.zone;
        for (const a of links) a.classList.toggle('is-active', a.getAttribute('href') === `#${best.id}`);
      }
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      emit('progress', Math.min(1, scrollY / max));
    };
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(tick); } }, { passive: true });
    addEventListener('resize', tick);
    tick();
  }

  // ---- boot: reveal once fonts are ready (never wait longer than a beat)
  const reveal = () => document.documentElement.classList.remove('is-booting');
  Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 900))]).then(() => setTimeout(reveal, 60));

  // ---- the boot log under the hero: status() appends a line (the last 3 stay), done() fades it out
  const status = $('boot-status');
  const lines = status ? status.textContent.split('\n').filter(Boolean) : [];
  let fadeT = 0;
  const log = (msg) => {
    if (!status || !msg) return;
    const m = String(msg);
    if (lines[lines.length - 1] === m) return;
    // progress updates of the same step replace the previous line instead of stacking ("loading… 40%")
    const stem = (x) => x.replace(/[\d.%/]+|…|\.\.\./g, '').trim();
    if (lines.length && stem(lines[lines.length - 1]) === stem(m)) lines[lines.length - 1] = m;
    else lines.push(m);
    while (lines.length > 3) lines.shift();
    status.textContent = lines.join('\n');
    status.hidden = false;
    status.classList.remove('is-done');
  };
  const done = (last) => {
    log(last);
    log('ready.');
    clearTimeout(fadeT);
    fadeT = setTimeout(() => status?.classList.add('is-done'), 3000);
  };

  return {
    status: log,
    attachWorld(api) {
      world = api;
      done('waking the islanders… 9/9');
      body.classList.add('world-live');
      // play mode runs everywhere the world does (phones get touch controls and the low-fx renderer)
      const canPlay = true;
      if (canPlay) bar.play.hidden = false;
      bar.play.addEventListener('click', () => api.enterPlay());
      return canPlay;
    },
    worldFailed(reason) {
      body.classList.add('no-world');
      done('island asleep (no WebGL): poster mode');
      console.info('[world] not started:', reason);
      startSpy();
    },
    get world() { return world; },
  };
}
