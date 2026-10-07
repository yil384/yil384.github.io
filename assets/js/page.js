// Page boot: chrome first (bar, nav, cards, DOM easter eggs), the interactive CV, then the 3D world when the device can
// run it. The page is fully usable, and the poster stays behind it, if the world never starts.
import { probeGPU } from './three/env.js';
import { initChrome } from './site/chrome.js';
import { setCapabilities } from './site/eggs.js';
import { initDomEggs } from './site/eggs-dom.js';

const q = new URLSearchParams(location.search);
const chrome = initChrome();
let world = null;
window.__page = { chrome, get world() { return world; } };
initDomEggs(() => world);
// the interactive CV (modes, status strip, keys, chapters, then every section module); never awaited
import('./site/ui/index.js').catch((err) => console.error('[ui] failed to start:', err));

async function mountWorld() {
  const probe = probeGPU();
  const saveData = navigator.connection?.saveData === true;
  const force = q.get('force') === '1';
  if (q.get('world') === '0') return chrome.worldFailed('disabled by ?world=0');
  if (!force && (!probe.ok || probe.software || saveData)) return chrome.worldFailed(probe.ok ? (saveData ? 'save-data' : 'software renderer') : probe.reason);
  try {
    chrome.status('loading the island…');
    // the egg module is small: fetch it alongside the world instead of after it
    const eggsReady = import('./game3d/eggs3d.js').catch((err) => { console.warn('[eggs] world eggs unavailable:', err); return null; });
    const { createGame } = await import('./game3d/index.js');
    world = await createGame({
      worldEl: document.getElementById('world'),
      root: document.getElementById('game-root'),
      progress: chrome.status,
    });
    const canPlay = chrome.attachWorld(world);
    setCapabilities({ world: true, play: canPlay });
    if (q.get('play') === '1') setTimeout(() => world.enterPlay(), 400);
    // an egg bug must never take the world down with it
    try { (await eggsReady)?.initWorldEggs(world); } catch (err) { console.warn('[eggs] failed to start:', err); }
  } catch (err) {
    console.warn('[world] failed to start:', err);
    chrome.worldFailed(String(err?.message || err));
  }
}

// the footer's visitor map: after everything else, and only once the footer is near
const vmapEl = document.getElementById('vmap');
if (vmapEl && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    io.disconnect();
    import('./site/visitors.js').then((m) => m.initVisitorMap(vmapEl)).catch((err) => console.warn('[visitors]', err));
  }, { rootMargin: '600px 0px' });
  io.observe(vmapEl.closest('footer') || vmapEl.parentElement);
}

// the opening animation (intro/intro.js) gets the main thread to itself: the world starts once it is over
const start = () => mountWorld();
const introDone = window.__intro?.done ?? Promise.resolve();
introDone.then(() => {
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 900 });
  else setTimeout(start, 120);
});
