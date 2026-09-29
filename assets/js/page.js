// Page behaviour for the SORTIE homepage. Everything here is progressive: the HTML/CSS page is finished on its own.
//   1. tier decision (T0 poster / T1 lite / T2 full) BEFORE any heavy import
//   2. nav, station indicator + section observer, tile-wave dividers
//   3. the opening film (V1) with the session rule, skip, and the name stamp
//   4. a generic video controller for the loop panels (V2 to V4)
//   5. the director seam (assets/js/director/director.js, optional) and the island game
// Each block is wrapped so an exception never blanks the page.

const root = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const q = new URLSearchParams(location.search);
const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
const dispatch = (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch { /* ignore */ } };
const guard = (name, fn) => { try { return fn(); } catch (err) { console.warn(`[page] ${name} failed:`, err); return undefined; } };

// page.js is running: the head script's failsafe (reveal after 4 s) is no longer needed.
delete root.dataset.boot;

let heroCtl = null; // the director's controller, when one is mounted (also what the game pauses and resumes)
let game = null;

/* ---------------------------------------------------------------- 1. tier */

// Same logic as probeGPU() in three/boot.js, inlined because that module imports three (heavy) at the top.
function probeWebGL() {
  const out = { ok: false, software: false, renderer: '', reason: '' };
  try {
    const strict = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    const gl = strict || document.createElement('canvas').getContext('webgl2');
    if (!gl) { out.reason = 'no-webgl2'; return out; }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    out.renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    out.software = !strict || /swiftshader|llvmpipe|software|basic render/i.test(out.renderer);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    out.ok = true;
  } catch (e) { out.reason = String(e); }
  return out;
}

function decideTier() {
  const force = q.get('force') === '1';
  const webglOnly = q.get('webgl') === '1';
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const gpu = probeWebGL();
  const cores = navigator.hardwareConcurrency || 4;
  const override = q.get('tier');
  let tier; let why;
  if (override === '0' || override === '1' || override === '2') { tier = +override; why = 'override'; }
  else if (reducedMQ.matches) { tier = 0; why = 'reduced-motion'; }
  else if (saveData) { tier = 0; why = 'save-data'; }
  else if (!gpu.ok) { tier = 0; why = gpu.reason || 'no-webgl2'; }
  else if (gpu.software && !force) { tier = 0; why = 'software-gpu'; }
  else if (navigator.gpu && !webglOnly && cores >= 6 && innerWidth >= 900) { tier = 2; why = 'webgpu'; }
  else { tier = 1; why = webglOnly ? 'webgl-forced' : (!navigator.gpu ? 'webgl2' : (cores < 6 ? 'few-cores' : 'narrow-viewport')); }
  const backend = tier === 0 ? 'none' : (navigator.gpu && !webglOnly ? 'webgpu' : 'webgl2');
  return { tier, why, backend, force, saveData, gpu };
}

const decided = guard('tier', decideTier) || { tier: 0, why: 'error', backend: 'none', force: false, saveData: false, gpu: { ok: false, software: false } };

// The public surface for the director and for QA.
const site = {
  version: 1,
  tier: decided.tier,
  why: decided.why,
  backend: decided.backend, // a hint ('webgpu' | 'webgl2' | 'none'); the director reports what it really got through stats()
  force: decided.force,
  saveData: decided.saveData,
  gpu: decided.gpu,
  get reducedMotion() { return reducedMQ.matches; },
  section: 'top', s: 0, scene: 'hangar', label: '00 / COLD OPEN',
  opening: 'idle', // idle | playing | done
  openingReason: '',
  get director() { return heroCtl; },
  sections: [],
  setTelemetry(text) { const el = $('#hud-tel'); if (el && el.textContent !== text) el.textContent = text; },
  dropToPoster(reason = 'lost') { dropToPoster(reason); },
};
window.__site = site;
root.dataset.tier = String(site.tier);
window.__page = { get heroCtl() { return heroCtl; }, get game() { return game; } };

/* ---------------------------------------------------------------- 2. nav, sections, dividers */

function initNav() {
  const nav = $('#nav'); const btn = $('#nav-burger'); const links = $('#nav-links');
  if (!nav || !btn || !links) return;
  const set = (open) => { nav.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open)); };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  links.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { set(false); btn.focus(); } });
  document.addEventListener('click', (e) => { if (nav.classList.contains('is-open') && !nav.contains(e.target)) set(false); });
  matchMedia('(min-width: 861px)').addEventListener?.('change', (e) => { if (e.matches) set(false); });
}

function initSections() {
  const secs = $$('.st[data-s]');
  if (!secs.length) return;
  site.sections = secs.map((el) => ({ id: el.id, s: +el.dataset.s, scene: el.dataset.scene, label: el.dataset.label, el }));
  const indicator = $('#hud-station');
  const navLinks = new Map($$('.nav__links a[href^="#"]').map((a) => [a.getAttribute('href').slice(1), a]));
  let cur = null;
  const activate = (sec) => {
    if (!sec || sec === cur) return;
    cur = sec;
    for (const s of secs) { if (s === sec) s.setAttribute('data-active', 'true'); else s.removeAttribute('data-active'); }
    const label = sec.dataset.label || sec.id;
    if (indicator) indicator.textContent = label;
    root.dataset.station = sec.dataset.s;
    navLinks.forEach((a, id) => { if (id === sec.id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    Object.assign(site, { section: sec.id, s: +sec.dataset.s, scene: sec.dataset.scene, label });
    guard('director.setSection', () => heroCtl?.setSection?.(sec.id, 0));
    dispatch('site:section', { id: sec.id, s: +sec.dataset.s, scene: sec.dataset.scene, label });
  };
  // A thin band at 45 % of the viewport height decides which station is "current".
  const io = new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) activate(e.target); }, { rootMargin: '-45% 0px -54% 0px' });
  secs.forEach((s) => io.observe(s));
  activate(secs[0]);
}

function initTilewaves() {
  const waves = $$('.tilewave');
  if (!waves.length) return;
  if (reducedMQ.matches) return; // CSS rests them in the final state
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-run'); io.unobserve(e.target); }
  }, { threshold: 0.6 });
  waves.forEach((w) => io.observe(w));
}

/* ---------------------------------------------------------------- 3. the opening film (V1) */

function initOpening() {
  const video = $('#sortie');
  const skipBtn = $('#opening-skip');
  const replayBtns = $$('[data-replay]');
  const setTitle = (v) => { root.dataset.title = v; };
  const setBars = (on) => { root.dataset.bars = on ? 'on' : 'off'; };
  const setPhase = (p) => { site.opening = p; root.dataset.opening = p; dispatch('site:opening', { phase: p, reason: site.openingReason }); };
  const showReplay = (on) => replayBtns.forEach((b) => { b.hidden = !on; });
  const seen = () => { try { return !!sessionStorage.getItem('sortie'); } catch { return false; } };
  const markSeen = () => { try { sessionStorage.setItem('sortie', '1'); } catch { /* private mode */ } };

  if (!video) { setTitle('done'); setBars(false); setPhase('idle'); return; }

  let phase = 'idle';
  let started = false;
  let unavailable = false;
  let raf = 0;
  let began = 0;
  let timers = [];
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); };
  const canPlay = () => !!video.canPlayType && video.canPlayType('video/mp4') !== '';

  const idleState = () => { // poster with all HTML visible, plus the replay pill
    setTitle('done'); setBars(false); setPhase('idle');
    showReplay(!unavailable && canPlay());
    if (skipBtn) skipBtn.hidden = true;
  };

  function stamp() {
    setTitle('stamp');
    timers.push(setTimeout(() => setBars(false), 1000)); // letterbox retracts at T0 + 1.0 s
  }

  function tick() {
    if (phase !== 'playing') return;
    const d = video.duration;
    const t0 = Number.isFinite(d) && d > 0 ? Math.min(22, Math.max(0, d - 3.5)) : 22; // DESIGN 3.5: currentTime >= 22.0
    if (started && root.dataset.title === 'wait' && video.currentTime >= t0) stamp();
    raf = requestAnimationFrame(tick);
  }

  function finish(reason) {
    if (phase !== 'playing') return;
    clearTimers();
    try { video.pause(); } catch { /* ignore */ }
    phase = 'done';
    site.openingReason = reason;
    setPhase('done');
    setBars(false);
    if (root.dataset.title === 'wait') setTitle('stamp'); // the copy still arrives as the end card
    const hadFocus = document.activeElement === skipBtn;
    if (skipBtn) skipBtn.hidden = true;
    showReplay(!unavailable && canPlay());
    if (hadFocus) replayBtns[0]?.focus();
  }

  function begin() {
    clearTimers();
    phase = 'playing'; started = false; began = performance.now(); site.openingReason = '';
    setPhase('playing'); setTitle('wait'); setBars(true);
    if (skipBtn) skipBtn.hidden = false;
    showReplay(false);
    markSeen();
    try { video.currentTime = 0; } catch { /* metadata not loaded yet */ }
    video.muted = true;
    const p = video.play();
    if (p && p.catch) p.catch(() => finish('blocked'));
    timers.push(setTimeout(() => finish('timeout'), 28000)); // the page opens by itself after 28 s
    timers.push(setTimeout(() => { if (!started) finish('stalled'); }, 9000)); // and if the film never starts
    raf = requestAnimationFrame(tick);
  }

  video.addEventListener('playing', () => { started = true; });
  video.addEventListener('ended', () => finish('ended'));
  // <source> errors do not bubble, so listen in the capture phase (a missing or undecodable file lands here).
  video.addEventListener('error', () => { unavailable = true; if (phase === 'playing') finish('error'); else showReplay(false); }, true);

  skipBtn?.addEventListener('click', () => finish('skip'));
  replayBtns.forEach((b) => b.addEventListener('click', () => {
    if (phase === 'playing') return;
    if (scrollY > 8) window.scrollTo({ top: 0, behavior: 'auto' });
    begin();
  }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && phase === 'playing') finish('skip'); });
  document.addEventListener('visibilitychange', () => {
    if (phase !== 'playing' || !started) return;
    if (document.hidden) video.pause(); else video.play().catch(() => {});
  });
  reducedMQ.addEventListener?.('change', (e) => { if (e.matches && phase === 'playing') finish('reduced-motion'); });
  // The island overlay covers the page: hold the film while it is open.
  new MutationObserver(() => {
    if (phase !== 'playing' || !started) return;
    if (root.classList.contains('g-open')) video.pause(); else video.play().catch(() => {});
  }).observe(root, { attributes: true, attributeFilter: ['class'] });

  const auto = site.tier > 0 && !reducedMQ.matches && !site.saveData && canPlay() && !seen() && !location.hash;
  if (!auto) { idleState(); return; }

  // First visit of the session at T1/T2: an IntersectionObserver starts the film once the hero is at least half visible.
  setTitle('wait'); setBars(true); setPhase('idle');
  const hero = $('#top');
  let first = true;
  const io = new IntersectionObserver(([e]) => {
    if (phase === 'idle' && first) {
      first = false;
      if (e.isIntersecting && e.intersectionRatio >= 0.5) begin();
      else idleState(); // loaded away from the top: no film, the page is simply open
    } else if (phase === 'playing' && performance.now() - began > 800 && e.intersectionRatio < 0.35) {
      finish('scroll'); // scrolling on before the end cuts to the end card
    }
  }, { threshold: [0, 0.35, 0.5, 1] });
  io.observe(hero);
}

/* ---------------------------------------------------------------- 4. loop panels (V2 to V4) */

function initVideos() {
  const panels = $$('[data-video]');
  if (!panels.length) return;
  const autoOK = () => site.tier > 0 && !reducedMQ.matches && !site.saveData;
  const gameOpen = () => root.classList.contains('g-open');
  const mp4 = (() => { const v = document.createElement('video'); return !!v.canPlayType && v.canPlayType('video/mp4') !== ''; })();
  const items = panels.map((panel) => {
    const video = $('video', panel); const btn = $('.vbtn', panel);
    const name = (btn?.getAttribute('aria-label') || '').replace(/^(Play|Pause)\s+/, '');
    return { panel, video, btn, name, inView: false, userPaused: false, off: !mp4 };
  }).filter((it) => it.video);

  const paint = (it) => {
    const paused = it.video.paused;
    it.panel.dataset.state = it.off ? 'off' : (paused ? 'paused' : 'playing');
    if (it.btn && it.name) it.btn.setAttribute('aria-label', `${paused ? 'Play' : 'Pause'} ${it.name}`);
  };
  const play = (it) => {
    if (it.off) return;
    const p = it.video.play();
    if (p && p.catch) p.catch((err) => { if (err && err.name === 'NotSupportedError') { it.off = true; paint(it); } });
  };
  const pause = (it) => { if (!it.video.paused) it.video.pause(); };
  const settle = (it) => { // start when in view and allowed, stop otherwise
    if (it.inView && autoOK() && !it.userPaused && !document.hidden && !gameOpen()) play(it); else if (!it.inView || document.hidden || gameOpen()) pause(it);
  };

  for (const it of items) {
    const { video, btn } = it;
    video.muted = true;
    for (const ev of ['play', 'playing', 'pause', 'ended']) video.addEventListener(ev, () => paint(it));
    video.addEventListener('error', () => { it.off = true; paint(it); }, true);
    btn?.addEventListener('click', () => {
      if (video.paused) {
        it.userPaused = false;
        if (video.ended) { try { video.currentTime = 0; } catch { /* ignore */ } }
        it.off = false; play(it);
      } else { it.userPaused = true; video.pause(); }
    });
    paint(it);
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const it = items.find((x) => x.video === e.target); if (!it) continue;
      if (e.isIntersecting && e.intersectionRatio >= 0.5) { it.inView = true; settle(it); }
      else if (!e.isIntersecting) { it.inView = false; settle(it); }
    }
  }, { threshold: [0, 0.5] });
  items.forEach((it) => io.observe(it.video));

  // Warm the poster/metadata just before a panel arrives (T1/T2 only; T0 never touches them).
  if (autoOK()) {
    const near = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { if (e.target.preload === 'none') e.target.preload = 'metadata'; near.unobserve(e.target); }
    }, { rootMargin: '500px 0px' });
    items.forEach((it) => near.observe(it.video));
  }

  const resync = () => items.forEach(settle);
  document.addEventListener('visibilitychange', resync);
  new MutationObserver(resync).observe(root, { attributes: true, attributeFilter: ['class'] });
  reducedMQ.addEventListener?.('change', (e) => { if (e.matches) items.forEach(pause); else resync(); });
}

/* ---------------------------------------------------------------- 5. director seam, telemetry, game */

function setTelemetryFromDirector() {
  if (!heroCtl || typeof heroCtl.stats !== 'function') return;
  const s = guard('director.stats', () => heroCtl.stats());
  if (!s) return;
  const backend = String(s.backend || site.backend || '').toUpperCase();
  const ms = [s.ms, s.avgMs, s.frameMs, s.p50].find((v) => typeof v === 'number' && Number.isFinite(v));
  const tier = Number.isInteger(s.tier) ? s.tier : site.tier;
  if (tier !== site.tier) { site.tier = tier; root.dataset.tier = String(tier); dispatch('site:tier', { tier }); }
  if (s.backend) site.backend = String(s.backend).toLowerCase();
  site.setTelemetry(`${backend || 'GPU'} · ${ms === undefined ? '—' : ms.toFixed(1)} MS · T${tier}`);
}

let telemetryTimer = 0;
function dropToPoster(reason) {
  clearInterval(telemetryTimer);
  const ctl = heroCtl; heroCtl = null;
  guard('director.dispose', () => ctl?.dispose?.());
  const stage = $('#stage'); if (stage) stage.hidden = true;
  root.dataset.director = 'off';
  site.tier = 0; root.dataset.tier = '0';
  site.setTelemetry('POSTER · —');
  console.warn('[page] dropped to poster tier:', reason);
  dispatch('site:tier', { tier: 0, reason });
}

async function mountDirector() {
  if (site.tier === 0) return; // T0: never load anything heavy
  const stage = $('#stage');
  if (!stage) return;
  try {
    const mod = await import('./director/director.js'); // optional module: absent means the page runs from posters
    if (!mod || typeof mod.mount !== 'function') return;
    const ctl = await mod.mount(stage, { tier: site.tier, force: site.force, backend: site.backend, onLost: () => dropToPoster('device-lost') });
    if (!ctl) return;
    heroCtl = ctl;
    stage.hidden = false;
    root.dataset.director = 'on';
    guard('director.setSection', () => ctl.setSection?.(site.section, 0));
    setTelemetryFromDirector();
    telemetryTimer = setInterval(() => { if (!document.hidden) setTelemetryFromDirector(); }, 500);
  } catch (err) {
    heroCtl = null;
    stage.hidden = true;
    console.info('[page] no director, running from posters:', err && err.message ? err.message : err);
  }
}

function initGame() {
  const btns = $$('[data-play]');
  const desk = matchMedia('(min-width: 900px) and (pointer: fine)');
  const sync = () => btns.forEach((b) => { b.hidden = !(desk.matches && site.gpu && site.gpu.ok); });
  sync();
  desk.addEventListener?.('change', sync);

  async function play() {
    if (game) { game.open(); return; }
    btns.forEach((b) => { b.disabled = true; });
    try {
      const mod = await import('./game3d/index.js');
      game = await mod.createGame({ root: document.getElementById('game-root'), heroCtl });
      game.open();
    } catch (err) {
      console.error('[game] failed to start', err);
    } finally {
      btns.forEach((b) => { b.disabled = false; });
    }
  }
  btns.forEach((b) => b.addEventListener('click', play));
  // ?play=1 opens the island straight away (used by the QA scripts).
  if (q.get('play') === '1') window.addEventListener('load', () => setTimeout(play, 300));
}

/* ---------------------------------------------------------------- boot */

guard('nav', initNav);
guard('sections', initSections);
guard('tilewaves', initTilewaves);
try { initOpening(); } catch (err) { console.warn('[page] opening failed:', err); root.dataset.title = 'done'; root.dataset.bars = 'off'; }
guard('videos', initVideos);
guard('game', initGame);

if (site.tier > 0) {
  if ('requestIdleCallback' in window) requestIdleCallback(() => mountDirector(), { timeout: 1200 });
  else setTimeout(mountDirector, 200);
}
