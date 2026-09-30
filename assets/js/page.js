// Page boot: chrome first (bar, nav, cards, DOM easter eggs), then the 3D world when the device can
// run it. The page is fully usable, and the poster stays behind it, if the world never starts.
import { probeGPU } from './three/env.js';
import { initChrome } from './site/chrome.js';
import { setCapabilities } from './site/eggs.js';
import { initDomEggs } from './site/eggs-dom.js';

const q = new URLSearchParams(location.search);
const chrome = initChrome();
let world = null;
initDomEggs(() => world);

async function mountWorld() {
  const probe = probeGPU();
  const saveData = navigator.connection?.saveData === true;
  const force = q.get('force') === '1';
  if (q.get('world') === '0') return chrome.worldFailed('disabled by ?world=0');
  if (!force && (!probe.ok || probe.software || saveData)) return chrome.worldFailed(probe.ok ? (saveData ? 'save-data' : 'software renderer') : probe.reason);
  try {
    chrome.status('loading the island…');
    const { createGame } = await import('./game3d/index.js');
    world = await createGame({
      worldEl: document.getElementById('world'),
      root: document.getElementById('game-root'),
      progress: chrome.status,
    });
    const canPlay = chrome.attachWorld(world);
    setCapabilities({ world: true, play: canPlay });
    if (q.get('play') === '1') setTimeout(() => world.enterPlay(), 400);
    const { initWorldEggs } = await import('./game3d/eggs3d.js');
    initWorldEggs(world);
  } catch (err) {
    console.warn('[world] failed to start:', err);
    chrome.worldFailed(String(err?.message || err));
  }
}

window.__page = { chrome, get world() { return world; } };
const start = () => mountWorld();
if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 900 });
else setTimeout(start, 120);
