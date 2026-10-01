// Boot of the interactive CV (SPEC §5.2). Foundation systems first (modes, status strip, keys,
// chapters), then every section / companion module in a fixed order, each in its own try/catch: a
// missing or broken module never takes the page down. In Reviewer mode at boot the section modules
// wait until the reader switches to the game (they are not needed for a plain CV).
import * as kit from './kit.js';
import * as progress from './progress.js';
import * as mode from './mode.js';
import { hud, initHud } from './hud.js';
import { initKeys } from './keys.js';
import { initChapters } from './chapters.js';
import { P } from './pstate.js';
import { yieldToPaint } from '../../game3d/util.js';

const MODULES = ['hero', 'about', 'edu', 'trail', 'pubs', 'quests', 'equip', 'attrs', 'contact', 'credits', 'bit', 'critters', 'walk'];
const ctx = { kit, progress, hud, mode, P };

function safe(label, fn) {
  try { fn(); } catch (err) { console.error(`[ui] ${label} failed:`, err); }
}

safe('mode', () => mode.initMode());
safe('hud', () => initHud());
safe('keys', () => initKeys());
safe('chapters', () => initChapters());

let loaded = false;
async function loadSections() {
  if (loaded) return;
  loaded = true;
  // fetch in parallel, initialise in order
  const mods = await Promise.all(MODULES.map((name) => import(`./${name}.js`).catch((err) => { console.error(`[ui] ${name}.js failed to load:`, err); return null; })));
  for (let i = 0; i < MODULES.length; i++) {
    try { await mods[i]?.init?.(ctx); } catch (err) { console.error(`[ui] ${MODULES[i]}.js failed:`, err); }
    await yieldToPaint();  // one module per frame: a first visit keeps scrolling while the sections wake up
  }
  kit.emit('ui:ready', ctx);
}

if (!mode.isPlain()) loadSections();
else {
  const off = mode.onMode((st) => { if (!st.plain) { off(); loadSections(); } });
}

export { ctx };
