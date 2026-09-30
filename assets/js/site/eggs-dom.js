// Page-level easter eggs (they work without the 3D world): Konami code, the portrait, the name,
// tab-away, reaching the bottom, speed-reading, printing, copying the email, the DevTools console,
// and the keys that open the terminal or hand over the controls.
import { found, foundCount, total, EGGS } from './eggs.js';
import { on } from '../game3d/bus.js';
import { spriteUrl } from '../game3d/pixelart.js';
import { toggleTerminal } from './terminal.js';
import { openNotes } from './notes.js';

const editable = (t) => t instanceof Element && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export function confetti(n = 90) {
  const colors = ['#f2b84b', '#a78bfa', '#38bdf8', '#4ade80', '#f472b6', '#fde047', '#fb923c'];
  const frag = document.createDocumentFragment();
  const bits = [];
  for (let i = 0; i < n; i++) {
    const el = document.createElement('i');
    el.className = 'confetti';
    el.style.left = `${Math.random() * 100}vw`;
    el.style.background = colors[i % colors.length];
    el.style.borderRadius = Math.random() < 0.4 ? '50%' : '2px';
    frag.append(el);
    bits.push({ el, x: 0, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, r: Math.random() * 360, vr: (Math.random() - 0.5) * 14 });
  }
  document.body.append(frag);
  let t = 0;
  (function tick() {
    t++;
    let alive = 0;
    for (const b of bits) {
      b.y += b.vy; b.x += b.vx; b.vy += 0.06; b.r += b.vr;
      b.el.style.transform = `translate(${b.x}px, ${b.y}px) rotate(${b.r}deg)`;
      if (b.y < innerHeight + 40) alive++;
    }
    if (alive && t < 600) requestAnimationFrame(tick);
    else bits.forEach((b) => b.el.remove());
  })();
}

export function initDomEggs(getWorld) {
  const say = (who, text) => getWorld()?.say(who, text);

  // ---- Konami
  const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  let ki = 0;

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (editable(e.target)) return;
    const k = e.key.toLowerCase();
    ki = k === KONAMI[ki] ? ki + 1 : (k === KONAMI[0] ? 1 : 0);
    if (ki === KONAMI.length) {
      ki = 0;
      confetti(140);
      if (found('konami')) say('me', 'Thirty lives! All to be spent on rebuttals.');
      getWorld()?.stage.sky.shower(6);
      return;
    }
    if (e.key === '`' || e.key === '~') { e.preventDefault(); toggleTerminal(getWorld); return; }
    if (document.querySelector('.notes.is-open, .term.is-open') || document.documentElement.classList.contains('modal-open')) return;
    if ('wasd'.includes(k) && k.length === 1 && !e.repeat) {
      const w = getWorld();
      if (w && matchMedia('(min-width: 900px) and (pointer: fine)').matches && !w.playing) { e.preventDefault(); w.enterPlay(); }
    }
  });

  // ---- the portrait turns into the little scholar (and back)
  const portrait = document.getElementById('portrait');
  const img = portrait?.querySelector('img');
  if (portrait && img) {
    const original = img.src;
    let clicks = 0, last = 0, voxel = false;
    portrait.addEventListener('click', () => {
      const now = performance.now();
      clicks = now - last < 1500 ? clicks + 1 : 1;
      last = now;
      if (clicks >= 5) {
        clicks = 0;
        voxel = !voxel;
        img.src = voxel ? spriteUrl('scholar') : original;
        portrait.classList.toggle('is-voxel', voxel);
        if (voxel) { found('portrait'); say('me', 'Oh no. They found the low-poly one.'); }
      }
    });
  }

  // ---- the name cycles through aliases
  const name = document.getElementById('name');
  if (name) {
    const aliases = ['yil384', "Bit's human", 'Reviewer #2 (kidding)', 'Yichen Lin'];
    const original = name.textContent;
    let n = 0, clicks = 0, last = 0;
    name.addEventListener('click', () => {
      const now = performance.now();
      clicks = now - last < 1200 ? clicks + 1 : 1;
      last = now;
      if (clicks >= 3) { name.textContent = aliases[n % aliases.length]; if (aliases[n % aliases.length] === 'Yichen Lin') name.textContent = original; n++; found('alias'); clicks = 0; }
    });
  }

  // ---- leaving the tab and coming back
  const title = document.title;
  let away = 0, flip = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      away = performance.now();
      document.title = '👀 Come back!';
      flip = setInterval(() => { document.title = document.title.startsWith('👀') ? title : '👀 Come back!'; }, 1600);
    } else {
      clearInterval(flip);
      document.title = title;
      if (away && performance.now() - away > 4000) found('tabaway');
    }
  });

  // ---- reaching the end, quickly or not
  const born = performance.now();
  let bottomDone = false;
  on('progress', (p) => {
    if (bottomDone || p < 0.995) return;
    bottomDone = true;
    confetti(70);
    found('bottom');
    if (performance.now() - born < 16000) found('skim');
  });
  // fallback when the world (and its progress events) never started
  addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (max > 0 && scrollY / max > 0.995 && !bottomDone) { bottomDone = true; found('bottom'); if (performance.now() - born < 16000) found('skim'); }
  }, { passive: true });

  // ---- a patient reader
  let visibleSeconds = 0;
  setInterval(() => { if (!document.hidden && ++visibleSeconds === 180) found('patient'); }, 1000);

  // ---- printing, copying
  addEventListener('beforeprint', () => found('print'));
  document.addEventListener('copy', () => {
    const sel = String(getSelection() || '');
    if (/yil384|858/.test(sel)) found('copy');
  });
  document.getElementById('mail-link')?.addEventListener('click', () => found('copy'));

  // ---- the console
  const help = () => {
    found('console');
    const lines = [
      'yichen.help()      this list',
      'yichen.about()     one paragraph about me',
      'yichen.eggs()      how many eggs you have found',
      'yichen.hint()      a hint for an egg you have not found',
      'yichen.play()      take the controls',
    ];
    console.log(`%c${lines.join('\n')}`, 'font: 13px monospace; color: #a3e635');
    return 'Have fun. Eggs are saved in this browser.';
  };
  window.yichen = {
    help,
    about: () => { found('console'); return 'Ph.D. student at UC San Diego CSE, working on systems, compilers and GPU code generation. Also: the island is hand-made.'; },
    eggs: () => { found('console'); return `${foundCount()} / ${total()} eggs`; },
    hint: () => { found('console'); const e = EGGS.find((x) => !foundEgg(x.id) && (x.kind === 'page')); return e ? e.hint : 'You have found every page-level egg. The world has more.'; },
    play: () => { found('console'); getWorld()?.enterPlay(); return 'W A S D'; },
    notes: openNotes,
  };
  console.log('%c  ____ ____  _____\n / ___/ ___|| ____|   hello, curious person.\n| |   \\___ \\|  _|     type yichen.help()\n| |___ ___) | |___\n \\____|____/|_____|', 'font: 12px monospace; color: #f2b84b');
}

import { has as foundEgg } from './eggs.js';
