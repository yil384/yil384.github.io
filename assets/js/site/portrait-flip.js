// The portrait's secret identity: a clean double-click (or double-tap) on #portrait flips the photo over,
// like a trading card, and the back plays a short comic-style intro video (assets/video/intro.*, rendered by
// tools/dev/introvid/render.mjs). When the video ends (or on close / Esc / backdrop / tab hidden / error) the
// card flips back into the portrait's slot. Page-level: no WebGL, works in Reviewer mode and on phones.
// Nothing is fetched until the first double-click. Under html.rm the card crossfades instead of flipping.
import { S } from '../game3d/state.js';
import { found } from './eggs.js';
import { h, live } from './ui/kit.js';

const SRC = [
  ['assets/video/intro.mp4', 'video/mp4; codecs="avc1.640020, mp4a.40.2"'],
  ['assets/video/intro.webm', 'video/webm; codecs="vp9, opus"'],
];
const POSTER = 'assets/video/intro-poster.jpg';
const LINES = [
  'Meanwhile, at Geisel Library...', 'Hey everyone!',
  'Secret identity: Yichen Lin, Ph.D. student, UC San Diego CSE, with Prof. Yufei Ding',
  'Great to be here at UC San Diego!', 'Shing! Whoosh!', 'Shhh!', 'Library-volume applause',
  'Superpowers: AI for science & chip design; architecture for agentic workloads; harnesses & benchmarks',
  'To be continued... (in the next paper)',
];
const DOUBLE_MS = 350;   // max gap between the two clicks
const QUIET_MS = 280;    // then this long without a third (3+ clicks = the 5-click voxel egg instead)
const START_MS = 6000;   // the video must be playing by then, or the card quietly flips back
const OPEN_MS = 720, CLOSE_MS = 560;
const EASE = 'cubic-bezier(0.45, 0, 0.2, 1)';
const ICON = {
  close: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  on: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  off: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

const html = document.documentElement;
const reduced = () => html.classList.contains('rm') || matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Wire the flip onto the portrait button. onOpen runs when the card comes out (eggs-dom resets its
 * 5-click counter). Returns { isOpen } so the voxel egg can ignore clicks while the card is out.
 */
export function initPortraitFlip(portrait, { onOpen } = {}) {
  let ui = null;        // the overlay, built on first use and kept (detached) for the next time
  let open = null;      // the live session: { close(instant) }
  let n = 0, last = 0, quiet = 0;

  // no text selection on double-click, no double-tap zoom (CSS sets touch-action: manipulation)
  portrait.addEventListener('mousedown', (e) => { if (e.detail > 1) e.preventDefault(); });
  portrait.addEventListener('click', () => {
    if (open) return;
    const now = performance.now();
    n = now - last < DOUBLE_MS ? n + 1 : 1;
    last = now;
    clearTimeout(quiet);
    // the timer stays well inside the browsers' user-activation window, so play() still counts as the gesture
    if (n === 2) quiet = setTimeout(() => { if (n === 2 && !open) { n = 0; start(); } }, QUIET_MS);
  });

  function build() {
    const video = h('video', {
      class: 'pflip__video', playsinline: '', 'webkit-playsinline': '', preload: 'auto', poster: POSTER,
      'aria-label': 'Intro video: Yichen Lin as a green ninja minifigure in Geisel Library', 'aria-describedby': 'pflip-desc',
      disablepictureinpicture: '', disableremoteplayback: '',
    }, ...SRC.map(([src, type]) => h('source', { src, type })));
    const desc = h('div', { class: 'sr', id: 'pflip-desc' }, 'On-screen text: ', h('ul', null, ...LINES.map((l) => h('li', null, l))));
    const close = h('button', { type: 'button', class: 'pflip__btn pflip__close', 'aria-label': 'Close the intro video', html: ICON.close });
    const mute = h('button', { type: 'button', class: 'pflip__btn pflip__mute', 'aria-pressed': 'false', html: ICON.off });
    const bar = h('span', { class: 'pflip__bar', 'aria-hidden': 'true' }, h('i'));
    const frontImg = h('img', { alt: '', draggable: 'false' });
    const frontPx = h('canvas', { class: 'pflip__px', width: 48, height: 48 });
    const front = h('div', { class: 'pflip__face pflip__front', 'aria-hidden': 'true' }, frontImg, frontPx);
    const back = h('div', { class: 'pflip__face pflip__back' }, video, bar, h('span', { class: 'pflip__btns' }, mute, close), desc);
    const card = h('div', { class: 'pflip__card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Secret identity: intro video' }, front, back);
    const backdrop = h('div', { class: 'pflip__backdrop' });
    const root = h('div', { class: 'pflip' }, backdrop, card);
    return { root, backdrop, card, front, frontImg, frontPx, back, video, close, mute, bar: bar.firstChild };
  }

  // the square the card grows into: min(92vw, 72vh, 480px), centred, ≥14px inside the viewport
  function target() {
    const W = html.clientWidth, H = innerHeight;
    const s = Math.round(Math.max(120, Math.min(W * 0.92, H * 0.72, 480, W - 28, H - 28)));
    return { x: Math.round((W - s) / 2), y: Math.round((H - s) / 2), s };
  }
  // transform that puts the target square exactly on the portrait's current box
  function fromPortrait(t) {
    const r = portrait.getBoundingClientRect();
    if (!r.width) return `translate(0px, ${innerHeight}px) scale(0.3)`;
    const dx = r.left + r.width / 2 - (t.x + t.s / 2), dy = r.top + r.height / 2 - (t.y + t.s / 2);
    return `translate(${dx}px, ${dy}px) scale(${r.width / t.s})`;
  }
  // the front face shows what the portrait shows right now (photo, voxel sprite, or the game's pixel version)
  // (photo: the portrait is about to get focus back, and focus shows the photo)
  function paintFront(photo = false) {
    const img = portrait.querySelector('img');
    ui.frontImg.src = img?.currentSrc || img?.src || '';
    ui.front.classList.toggle('is-voxel', portrait.classList.contains('is-voxel'));
    const px = portrait.querySelector('.portrait__px');
    const showPx = html.classList.contains('is-game') && portrait.classList.contains('has-px') && !photo && !portrait.classList.contains('is-photo') && !portrait.classList.contains('is-voxel');
    ui.front.classList.toggle('has-px', !!(showPx && px));
    if (showPx && px) { try { const g = ui.frontPx.getContext('2d'); g.clearRect(0, 0, 48, 48); g.drawImage(px, 0, 0, 48, 48); } catch { /* tainted or empty: the photo shows */ } }
  }

  function start() {
    ui = ui || build();
    const { root, card, video, mute, close, backdrop } = ui;
    const t = target();
    const rmode = reduced();
    const focusBack = document.activeElement === portrait || portrait.contains(document.activeElement);
    paintFront();
    const place = () => Object.assign(card.style, { left: `${t.x}px`, top: `${t.y}px`, width: `${t.s}px`, height: `${t.s}px` });
    place();
    root.classList.toggle('is-rm', rmode);
    root.classList.remove('is-out');
    document.body.append(root);
    portrait.classList.add('is-flipped');
    onOpen?.();

    // ---- playback: started right here, inside the gesture path (iOS needs that for sound)
    let started = false, closing = false, raf = 0;
    const setMute = (m) => {
      video.muted = m;
      mute.innerHTML = m ? ICON.off : ICON.on;
      mute.setAttribute('aria-pressed', String(m));
      mute.setAttribute('aria-label', m ? 'Unmute the intro video' : 'Mute the intro video');
    };
    setMute(!S.settings.sound);
    video.currentTime = 0;
    if (video.readyState === 0 || video.error) video.load();
    const play = () => {
      const p = video.play();
      if (p?.catch) {
        p.catch((err) => {
          if (closing) return;
          // autoplay with sound refused: carry on muted, the toggle is right there
          if (!video.muted && err?.name === 'NotAllowedError') { setMute(true); play(); return; }
          console.warn('[portrait] intro video:', err?.name || err);
          end(true);
        });
      }
    };
    play();
    const tick = () => {
      if (video.duration) ui.bar.style.transform = `scaleX(${Math.min(1, video.currentTime / video.duration)})`;
      raf = requestAnimationFrame(tick);
    };
    ui.bar.style.transform = 'scaleX(0)';
    raf = requestAnimationFrame(tick);
    const watchdog = setTimeout(() => { if (!started) { console.warn('[portrait] intro video never started'); end(true); } }, START_MS);

    // ---- the flip out
    const out = [{ transform: `perspective(1400px) ${fromPortrait(t)} rotateY(0deg)` }, { transform: 'perspective(1400px) translate(0px, 0px) scale(1) rotateY(180deg)' }];
    const anims = [];
    if (rmode) {
      card.style.transform = 'none';   // .is-rm shows the back face flat (opacity < 1 would flatten a 3D card anyway)
      anims.push(card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' }));
    } else {
      card.style.transform = 'perspective(1400px) rotateY(180deg)';
      anims.push(card.animate(out, { duration: OPEN_MS, easing: EASE }));
      // swap the faces at exactly 90° (same eased progress), a fallback for engines with flaky backface-visibility
      anims.push(ui.front.animate([{ visibility: 'visible' }, { visibility: 'visible', offset: 0.5 }, { visibility: 'hidden', offset: 0.5001 }, { visibility: 'hidden' }], { duration: OPEN_MS, easing: EASE }));
      anims.push(ui.back.animate([{ visibility: 'hidden' }, { visibility: 'hidden', offset: 0.5 }, { visibility: 'visible', offset: 0.5001 }, { visibility: 'visible' }], { duration: OPEN_MS, easing: EASE }));
    }
    anims.push(backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: rmode ? 200 : OPEN_MS, easing: 'ease-out' }));
    // focus moves to the close button once the back face is showing (a hidden button cannot take focus)
    const focusIn = () => { if (!closing) close.focus({ preventScroll: true }); };
    if (rmode) focusIn(); else anims[0].finished.then(focusIn, () => {});
    live('Intro video playing. Escape closes it.');

    // ---- input while the card is out: Esc closes, page shortcuts stay quiet, the page does not scroll
    const onKey = (e) => {
      if (e.key === 'Tab') {
        // keep focus on the card's two buttons
        e.preventDefault();
        (document.activeElement === close ? mute : close).focus();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.stopImmediatePropagation();
      if (e.key === 'Escape') { e.preventDefault(); end(); }
      else if (!root.contains(e.target) || !/^( |Enter|Spacebar)$/.test(e.key)) e.preventDefault();
    };
    const noScroll = (e) => e.preventDefault();
    const onResize = () => { Object.assign(t, target()); place(); };   // phone rotation, window resize
    const onVis = () => { if (document.hidden) end(false, true); };
    const onPlaying = () => { started = true; clearTimeout(watchdog); };
    const onEnded = () => end();
    const onError = () => { if (!closing) { console.warn('[portrait] intro video failed to load'); end(true); } };
    const lastSource = video.querySelector('source:last-of-type');
    window.addEventListener('keydown', onKey, true);
    root.addEventListener('wheel', noScroll, { passive: false });
    root.addEventListener('touchmove', noScroll, { passive: false });
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', onResize);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    lastSource?.addEventListener('error', onError);
    const onClose = () => end();
    const onBackdrop = () => end();
    const onMute = () => { setMute(!video.muted); if (video.paused && !video.ended) play(); };
    close.addEventListener('click', onClose);
    backdrop.addEventListener('click', onBackdrop);
    mute.addEventListener('click', onMute);

    // ---- the flip back. failed: quietly (no egg). instant: no animation (tab hidden)
    function end(failed = false, instant = false) {
      if (closing) return;
      closing = true;
      clearTimeout(watchdog);
      cancelAnimationFrame(raf);
      const watched = video.ended || video.currentTime >= 3;
      video.pause();
      window.removeEventListener('keydown', onKey, true);
      root.removeEventListener('wheel', noScroll);
      root.removeEventListener('touchmove', noScroll);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', onResize);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
      lastSource?.removeEventListener('error', onError);
      close.removeEventListener('click', onClose);
      backdrop.removeEventListener('click', onBackdrop);
      mute.removeEventListener('click', onMute);
      anims.forEach((a) => a.cancel());
      const refocus = focusBack || root.contains(document.activeElement);
      root.classList.add('is-out');
      const finish = () => {
        root.getAnimations({ subtree: true }).forEach((a) => a.cancel());
        root.remove();
        portrait.classList.remove('is-flipped');
        if (refocus) portrait.focus({ preventScroll: true });
        open = null;
        n = 0;
        if (!failed && watched) found('secret');
        live('Intro video closed.');
      };
      if (instant || !root.isConnected) { finish(); return; }
      paintFront(refocus);
      const back = [];
      if (rmode) back.push(card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-in', fill: 'forwards' }));
      else {
        back.push(card.animate([out[1], { transform: `perspective(1400px) ${fromPortrait(t)} rotateY(0deg)` }], { duration: CLOSE_MS, easing: EASE, fill: 'forwards' }));
        back.push(ui.front.animate([{ visibility: 'hidden' }, { visibility: 'hidden', offset: 0.5 }, { visibility: 'visible', offset: 0.5001 }, { visibility: 'visible' }], { duration: CLOSE_MS, easing: EASE, fill: 'forwards' }));
        back.push(ui.back.animate([{ visibility: 'visible' }, { visibility: 'visible', offset: 0.5 }, { visibility: 'hidden', offset: 0.5001 }, { visibility: 'hidden' }], { duration: CLOSE_MS, easing: EASE, fill: 'forwards' }));
      }
      back.push(backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: rmode ? 180 : CLOSE_MS, easing: 'ease-in', fill: 'forwards' }));
      // the timer is the backstop: finished promises stall while the tab is hidden
      let done = false;
      const once = () => { if (!done) { done = true; finish(); } };
      back[0].finished.then(once, once);
      setTimeout(once, (rmode ? 180 : CLOSE_MS) + 250);
    }
    open = { close: end };
  }

  return { isOpen: () => !!open, close: () => open?.close() };
}
