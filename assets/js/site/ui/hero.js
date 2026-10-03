/* global MutationObserver */
// HERO: the title screen (SPEC §4.1). The big name becomes nine bumpable letter blocks, the links become
// skill slots (keys 1-5), a JRPG title menu with a sliding pixel-hand cursor, PRESS START, and a boot log
// typed as the island wakes up. Everything here is game-only chrome: the h1 text, the role line and the
// links stay the real, readable HTML.
import { capabilities, onChange as onEggs } from '../eggs.js';
import { registerKey } from './keys.js';
import { save } from './pstate.js';

const CHAPTER = {
  about: ['01', 'Library Walk'], education: ['02', 'Two campuses'], publications: ['03', 'Geisel Library'],
  experience: ['04', 'The trail'], projects: ['05', 'Jacobs Yard'], contact: ['06', 'Sun God Lawn'],
};
const ME_LINES = ['Careful, those are load-bearing letters.'];

export function init({ kit, progress, mode, P }) {
  const { $, $$, h, on, emit, found, sfx, say, burst, rm, isGame, world, observe, toast, typewriter, onSection } = kit;
  const hero = $('#top');
  const name = $('#name');
  if (!hero || !name) return;
  const blocksEl = $('.hero__blocks', name);
  const textEl = $('.hero__name-t', name);
  const behavior = () => (rm() ? 'auto' : 'smooth');

  // ------------------------------------------------------------ letter blocks
  const ORIGINAL = textEl?.textContent || 'Yichen Lin';
  const bumped = new Set();
  let bumps = 0;
  let aliasOn = false;
  function buildBlocks(text) {
    if (!blocksEl) return;
    let i = 0;
    const words = text.split(' ');
    blocksEl.replaceChildren(...words.flatMap((w, wi) => {
      const word = h('span', { class: 'hero__word' }, ...[...w].map((ch) => h('span', { class: 'hero__blk', 'data-i': String(i++), 'data-l': ch }, ch)));
      return wi < words.length - 1 ? [word, h('span', { class: 'hero__gap' }, ' ')] : [word];
    }));
  }
  buildBlocks(ORIGINAL);
  name.addEventListener('ui:alias', (e) => {
    aliasOn = !e.detail?.original;
    buildBlocks(e.detail?.text || ORIGINAL);
    name.classList.toggle('is-aliasblk', aliasOn);
  });

  function bump(blk, { quiet = false } = {}) {
    if (!blk) return;
    blk.classList.remove('is-bump');
    void blk.offsetWidth;
    blk.classList.add('is-bump');
    setTimeout(() => blk.classList.remove('is-bump'), 260);
    if (!quiet) sfx('block');
  }
  blocksEl?.addEventListener('click', (e) => {
    const blk = e.target.closest?.('.hero__blk');
    if (!blk || !isGame()) return;
    bump(blk);
    burst(blk, { n: 4, kind: 'spark' });
    // every block position counts, whichever alias the name is wearing right now
    const i = +blk.dataset.i;
    const first = !bumped.has(i);
    if (i < 9) bumped.add(i);
    bumps++;
    // the dot of the first "i" hides a token
    if (!aliasOn && i === 1 && first && !P.tokens.t1) {
      blk.classList.add('is-dotpop');
      setTimeout(() => blk.classList.remove('is-dotpop'), 700);
      progress.token('t1', blk);
    }
    if (bumps === 3) say('me', ME_LINES[0]);
    if (bumped.size >= [...ORIGINAL.replace(/\s/g, '')].length && found('blocks')) {
      wave();
    }
  });

  function wave() {
    const all = $$('.hero__blk', name);
    if (rm()) return;
    all.forEach((b, j) => setTimeout(() => bump(b, { quiet: j % 3 !== 0 }), j * 70));
  }

  // Konami also sends a wave through the letters
  const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  let ki = 0;
  let typed = '';
  let flickerT = 0;
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || kit.isEditable(e.target)) return;
    const k = e.key.toLowerCase();
    ki = k === KONAMI[ki] ? ki + 1 : (k === KONAMI[0] ? 1 : 0);
    if (ki === KONAMI.length) { ki = 0; if (isGame()) setTimeout(wave, 200); }
    // typing his name anywhere
    if (k.length !== 1 || document.querySelector('.notes.is-open, .term.is-open')) return;
    typed = (typed + k).slice(-8);
    const hit = ['yichen', 'yil384', 'lin'].find((w) => typed.endsWith(w));
    if (!hit || !isGame()) return;
    typed = '';
    name.classList.remove('is-typename');
    void name.offsetWidth;
    name.classList.add('is-typename');
    clearTimeout(flickerT);
    flickerT = setTimeout(() => name.classList.remove('is-typename'), 900);
    sfx('signature');
    emit('page:sky', { n: 2 });
    found('typename');
  });

  // ------------------------------------------------------------ skill slots (links 1-5)
  const links = $$('.hero__links a', hero);
  let heroVisible = true;
  observe(hero, { threshold: 0.5, once: false }, (_e, ok) => { heroVisible = ok; });
  links.forEach((a, i) => {
    registerKey(String(i + 1), () => {
      a.focus();
      a.classList.remove('is-slot-hit'); void a.offsetWidth; a.classList.add('is-slot-hit');
      sfx('buddy');
      return true;
    }, { when: () => isGame() && heroVisible && !world()?.playing });
  });
  const mail = links.find((a) => a.href.startsWith('mailto:'));
  if (mail) {
    const hi = () => { try { world()?.stage?.setHover('mailbox'); } catch { /* no world */ } };
    const lo = () => { try { world()?.stage?.setHover(null); } catch { /* no world */ } };
    mail.addEventListener('pointerenter', hi); mail.addEventListener('focus', hi);
    mail.addEventListener('pointerleave', lo); mail.addEventListener('blur', lo);
  }

  // ------------------------------------------------------------ title menu
  const menu = $('.title-menu', hero);
  const cursor = $('.title-menu__cursor', menu || hero);
  const items = () => $$('.title-menu__i', menu).filter((b) => !b.hidden);
  let curItem = null;
  function point(item, { sound = true } = {}) {
    if (!item || !cursor || item.hidden) return;
    const y = item.offsetTop + item.offsetHeight / 2;
    cursor.style.setProperty('--y', `${Math.round(y)}px`);
    cursor.classList.add('is-on');
    items().forEach((b) => b.classList.toggle('is-cur', b === item));
    if (sound && item !== curItem) sfx('buddy');
    curItem = item;
  }
  function refreshMenu() {
    if (!menu) return;
    requestAnimationFrame(() => point(curItem && !curItem.hidden ? curItem : items()[0], { sound: false }));
  }
  if (menu) {
    menu.addEventListener('pointerover', (e) => { const it = e.target.closest?.('.title-menu__i'); if (it) point(it); });
    menu.addEventListener('focusin', (e) => { const it = e.target.closest?.('.title-menu__i'); if (it) point(it); });
    // arrow keys move inside the menu like a real title screen
    menu.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const list = items();
      const i = list.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length].focus();
    });
    addEventListener('resize', refreshMenu);
    document.fonts?.ready?.then(refreshMenu);
    refreshMenu();
  }
  const act = (a) => $(`.title-menu__i[data-act="${a}"]`, menu || hero);

  function startTour(src) {
    const about = $('#about');
    if (!about) return;
    sfx('open');
    about.scrollIntoView({ behavior: behavior(), block: 'start' });
    emit('page:start');
    if (src) src.classList.add('is-chosen');
    setTimeout(() => src?.classList.remove('is-chosen'), 600);
  }
  act('start')?.addEventListener('click', (e) => {
    if (!isGame()) return; // plain link behaviour
    e.preventDefault();
    startTour(e.currentTarget);
  });

  // Continue: a save from an earlier day, left somewhere past the hero
  P.hero = P.hero && typeof P.hero === 'object' ? P.hero : {};
  const resume = P.hero.resume;
  const laterDay = P.firstVisit && new Date(P.firstVisit).toDateString() !== new Date().toDateString();
  const cont = act('continue');
  const q = new URLSearchParams(location.search);
  if (cont && resume && CHAPTER[resume] && document.getElementById(resume) && (laterDay || q.get('continue') === '1')) {
    const [n, zone] = CHAPTER[resume];
    const slot = $('[data-slot="continue"]', cont);
    if (slot) slot.textContent = `Chapter ${n} · ${zone}`;
    cont.hidden = false;
    cont.addEventListener('click', () => {
      sfx('open');
      document.getElementById(resume)?.scrollIntoView({ behavior: behavior(), block: 'start' });
      found('continue');
      toast('Save file loaded.', `Welcome back, Lv ${progress.level()} ${progress.title()}.`, { kind: 'info', k: 'Continue' });
    });
  }
  // remember where the reader actually stayed (not every section a jump flies past)
  let resumeT = 0;
  onSection((cur) => {
    clearTimeout(resumeT);
    if (!cur?.id || !CHAPTER[cur.id]) return;
    resumeT = setTimeout(() => { if (kit.currentSection()?.id === cur.id) { P.hero.resume = cur.id; save(); } }, 2000);
  });

  // Take control (only where the 3D play mode can run)
  const play = act('play');
  const syncPlay = () => {
    if (!play) return;
    const can = !!capabilities().play && !!world();
    if (play.hidden === can) { play.hidden = !can; refreshMenu(); }
  };
  play?.addEventListener('click', () => { try { world()?.enterPlay(); } catch (err) { console.warn('[hero] play', err); } });
  onEggs(syncPlay);
  syncPlay();

  act('plain')?.addEventListener('click', () => mode.setPlain(true));

  // Walk the page (only if the walk module announces itself)
  const walk = act('walk');
  const showWalk = () => { if (walk && walk.hidden) { walk.hidden = false; refreshMenu(); } };
  if (walk) {
    on('walk:ready', showWalk);
    if (document.documentElement.classList.contains('has-walk')) showWalk();
    walk.addEventListener('click', () => emit('walk:toggle'));
  }

  // ------------------------------------------------------------ PRESS START
  const press = $('.press-start', hero);
  let startedByKey = false;
  document.addEventListener('keydown', (e) => {
    if (startedByKey || !isGame() || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const ae = document.activeElement;
    if (ae && ae !== document.body && ae !== document.documentElement) return;
    if (scrollY > innerHeight * 0.25 || world()?.playing) return;
    e.preventDefault();
    startedByKey = true;
    press?.classList.add('is-pressed');
    sfx('signature');
    found('start');
    setTimeout(() => { press?.classList.remove('is-pressed'); startTour(null); }, rm() ? 0 : 520);
  });

  // ------------------------------------------------------------ boot log (typed, then it fades)
  const status = $('#boot-status');
  if (status) {
    const log = h('pre', { class: 'hero__bootlog', 'data-game': '', 'aria-hidden': 'true' });
    status.after(log);
    const lines = [];
    let busy = Promise.resolve();
    let finished = false;
    const render = () => { log.replaceChildren(...lines.map((l) => h('span', { class: `bl${l.cls ? ` bl--${l.cls}` : ''}` }, h('i', null, '>'), l.el))); };
    const push = (text, cls = '') => {
      busy = busy.then(async () => {
        const el = h('b');
        lines.push({ el, cls });
        while (lines.length > 3) lines.shift();
        render();
        await typewriter(el, text, { cps: 55, sound: false });
        await new Promise((r) => setTimeout(r, rm() ? 0 : 120));
      });
      return busy;
    };
    const replaceLast = (text) => { const l = lines[lines.length - 1]; if (l) l.el.textContent = text; };
    push('mounting campus… ok');
    let worldLine = '';
    const read = () => {
      const all = status.textContent.split('\n').map((s) => s.trim()).filter(Boolean);
      const ready = all.includes('ready.');
      const mid = all.filter((s) => s !== 'ready.' && !/^waking up the island/.test(s)).pop() || '';
      if (mid && mid !== worldLine) {
        const same = worldLine && worldLine.replace(/[\d.%/]+/g, '') === mid.replace(/[\d.%/]+/g, '');
        worldLine = mid;
        if (same) busy = busy.then(() => replaceLast(mid));
        else push(mid, /asleep/.test(mid) ? 'dim' : '');
      }
      if (ready && !finished) {
        finished = true;
        push('checking deadlines… always tonight (AoE)', 'warn');
        push('ready.', 'ok').then(() => setTimeout(() => log.classList.add('is-done'), 3000));
      }
    };
    new MutationObserver(read).observe(status, { childList: true, characterData: true, subtree: true });
    read();
  }

  // hint for the key slots under the tiles: only on devices that have keys
  hero.classList.toggle('has-keys', matchMedia('(pointer: fine)').matches);
}
