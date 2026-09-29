import { initSite } from './site.js';
import { initSky } from './sky.js';
import { initGame } from './game/index.js';

initSite();
initSky();
try {
  initGame();
} catch (err) {
  // The portfolio must stay usable even if the optional game layer fails.
  console.error('[game] failed to start', err);
  document.documentElement.dataset.mode = 'read';
}
