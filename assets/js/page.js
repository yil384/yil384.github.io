// Page behaviour: mount the hero scene when the device can run it, and wire the Play button.

const hero = document.querySelector('.hero');
const canvas = document.getElementById('hero-canvas');
const playBtn = document.getElementById('play-btn');
const hint = document.getElementById('hero-hint');

let heroCtl = null;
let game = null;

async function mount() {
  try {
    const { mountHero } = await import('./three/hero.js');
    heroCtl = await mountHero(canvas, { heroEl: hero, force: new URLSearchParams(location.search).get('force') === '1' });
  } catch (err) {
    console.warn('[hero] 3D unavailable:', err);
    heroCtl = null;
  }
  if (heroCtl) {
    hero.classList.add('is-3d');
    if (matchMedia('(min-width: 900px) and (pointer: fine)').matches) {
      playBtn.hidden = false;
      hint.hidden = false;
    }
  } else {
    canvas.remove();
  }
}

async function play() {
  if (game) { game.open(); return; }
  playBtn.disabled = true;
  try {
    const mod = await import('./game3d/index.js');
    game = await mod.createGame({ root: document.getElementById('game-root'), heroCtl });
    game.open();
  } catch (err) {
    console.error('[game] failed to start', err);
  } finally {
    playBtn.disabled = false;
  }
}

playBtn?.addEventListener('click', play);
// ?play=1 opens the island straight away (used by the QA scripts).
if (new URLSearchParams(location.search).get('play') === '1') window.addEventListener('load', () => setTimeout(play, 300));

if ('requestIdleCallback' in window) requestIdleCallback(mount, { timeout: 1200 });
else setTimeout(mount, 200);

window.__page = { get heroCtl() { return heroCtl; }, get game() { return game; } };
