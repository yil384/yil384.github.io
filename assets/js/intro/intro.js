// The opening animation, the part every page view loads (small): whether it plays was decided before first paint by
// the inline script in index.html (html.intro-on: once per browser session, a session cookie shared by all tabs; not
// in Reviewer mode, with reduced motion, on deep links or in automated browsers; ?intro=1 forces it, ?intro=0 turns it
// off). When it plays, this puts the black overlay up at once and owns every input from that moment (Skip and Esc
// work even while the art is still arriving), then hands over to play.js (the fight and the glass), which is only
// fetched when it plays. Any click, tap, key or scroll skips to the impact; a later one (or Esc) ends it. One gesture
// counts once (a trackpad flick sends wheel events for a second, a held key repeats) and nothing reaches the page
// under the overlay: no scrolling, no shortcuts, Tab stays on Skip. The 3D world waits for window.__intro.done.
// Test hooks (play.js): ?introAt=<s> holds the clock there, ?intro3d=0|1, ?introArt=0, window.__intro.seek/hold(s).
const html = document.documentElement;
const q = new URLSearchParams(location.search);
let resolveDone;
const state = { done: new Promise((r) => { resolveDone = r; }), playing: false, phase: 'off', t: 0, mode: '' };
window.__intro = state;

if (html.classList.contains('intro-on')) start();
else resolveDone();

function start() {
  state.playing = true;
  state.phase = 'wait';
  try { document.cookie = 'yl_intro=1; path=/; SameSite=Lax'; } catch { /* cookies off: it may play again */ }
  // ?intro=1 (the terminal's `intro`, tests) is a one-off: a reload or Back must not replay it
  if (q.get('intro') === '1') {
    try {
      const u = new window.URL(location.href);
      u.searchParams.delete('intro');
      window.history.replaceState(window.history.state, '', u.href);
    } catch { /* keep the URL */ }
  }

  const root = document.createElement('div');
  root.className = 'intro';
  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'intro__skip';
  const touch = matchMedia('(pointer: coarse)').matches;
  const label = touch ? 'Tap to skip' : 'Skip';
  skipBtn.innerHTML = `${label} <span aria-hidden="true">▸▸</span>`;
  skipBtn.setAttribute('aria-label', `${label} the opening animation`);
  // shown only if the wait for the art runs long (intro.css fades it in after 0.4 s; gone once the fight starts)
  const wait = document.createElement('p');
  wait.className = 'intro__wait';
  wait.setAttribute('aria-hidden', 'true');
  wait.textContent = 'Loading Ninjago City';
  root.append(wait, skipBtn);
  document.body.append(root);
  html.classList.add('intro-live');
  // the hero's entrance waits under the black and plays as the glass falls
  const hero = document.querySelector('.hero');
  hero?.classList.add('is-held');
  // the page under the overlay is out of reach until it shows again
  const inerted = [...document.body.children].filter((el) => el !== root && !el.inert);
  inerted.forEach((el) => { el.inert = true; });
  try { skipBtn.focus({ preventScroll: true }); } catch { /* old browser */ }

  // ---- inputs. ctl.skip / ctl.stop are play.js's once it runs; until then a skip is remembered.
  const ctl = { pending: null, skip: () => { ctl.pending = 'skip'; }, stop: () => end(), onEnd: null, release: null };
  let lastInput = -1e9, lastWheel = -1e9;
  const input = () => {
    const now = performance.now();
    if (now - lastInput < 450) return;
    lastInput = now;
    ctl.skip();
  };
  const NAV = new Set([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']);
  const onKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key === 'Shift') return;
    e.stopImmediatePropagation();
    if (e.key === 'Tab') { e.preventDefault(); if (state.phase !== 'shatter') skipBtn.focus({ preventScroll: true }); return; }
    if (e.target === skipBtn && (e.key === 'Enter' || e.key === ' ')) return;   // the button's own click
    if (NAV.has(e.key)) e.preventDefault();
    if (e.repeat) return;
    if (e.key === 'Escape') { e.preventDefault(); ctl.stop(); return; }
    input();
  };
  const onWheel = (e) => {
    const now = performance.now(), sameGesture = now - lastWheel < 300;
    if (state.phase === 'over') {
      // the gesture that ended it may still be coasting (trackpad momentum): it must not scroll the page that just
      // came back; the next one does
      if (!sameGesture) { window.removeEventListener('wheel', onWheel); return; }
      lastWheel = now;
      e.preventDefault();
      return;
    }
    e.preventDefault();
    lastWheel = now;
    if (!sameGesture) input();
  };
  const onPoint = (e) => { if (!skipBtn.contains(e.target)) input(); };
  const onTouchMove = (e) => { if (e.cancelable) e.preventDefault(); };
  skipBtn.addEventListener('click', (e) => { e.stopPropagation(); input(); });
  root.addEventListener('pointerdown', onPoint);
  addEventListener('keydown', onKey, true);
  addEventListener('wheel', onWheel, { passive: false });
  root.addEventListener('touchmove', onTouchMove, { passive: false });

  /** The page shows again (the glass starts falling): the bar and the hero's entrance play. */
  function reveal() {
    hero?.classList.remove('is-held');
    html.classList.remove('intro-on');
    window.__ylPreload?.();
  }
  /** The page is in reach again (after the glass: lifting `inert` restyles the whole page, not a thing to do mid-shatter). */
  function unlock() {
    inerted.forEach((el) => { el.inert = false; });
    inerted.length = 0;
    html.classList.remove('intro-art');
  }
  /** The one way out, from any phase. */
  function end() {
    if (state.phase === 'over') return;
    const early = state.phase === 'wait';
    state.phase = 'over';
    state.playing = false;
    window.removeEventListener('keydown', onKey, true);
    try { ctl.onEnd?.(); } catch (err) { console.warn('[intro]', err); }
    reveal();
    html.classList.remove('intro-live');
    root.classList.add('is-out');
    if (document.activeElement === skipBtn) skipBtn.blur();
    setTimeout(() => {
      root.remove();
      unlock();
      try { ctl.release?.(); } catch (err) { console.warn('[intro] release:', err); } finally { resolveDone(); }
    }, early ? 0 : 260);
    state.seek = state.hold = state.stop = null;   // let the stage's canvases go
  }
  state.stop = end;

  import('./play.js')
    .then((m) => m.play({ root, skipBtn, state, ctl, reveal, end, q, touch }))
    .catch((err) => { console.warn('[intro] skipped:', err); end(); });
}
