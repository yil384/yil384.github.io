// ui/credits.js: the ending (SPEC §4.9, SECTIONS-C). A game-only section after Contact: "The end?", a
// rolling credits list, a results plate (chapters, details, quests, bugs, tokens, eggs, time, level, rank),
// a post-credits scene on the pier, and New Game+ / Back to title / Open field notes. Hidden in Reviewer
// mode, print and without JS ([data-game]); the footer below stays plain.
import { EGGS, has, foundCount, total, capabilities, onChange as onEggs } from '../eggs.js';
import { openNotes } from '../notes.js';
import { CHAPTER_SHOTS } from './chapters.js';
import { TOKENS_TOTAL, DETAILS_TOTAL } from './progress.js';
import { spriteImg } from '../../game3d/pixelart.js';

const CH_NAME = { about: 'About', edu: 'Education', library: 'Publications', trail: 'Experience', workshop: 'Projects', meadow: 'Contact' };
const RANKS = {
  S: 'Legendary reader',
  A: 'Thorough explorer',
  B: 'Curious reader',
  C: 'Careful reader',
};

const pad = (n) => String(n).padStart(2, '0');
const fmtTime = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };

export function init(ctx) {
  const { kit, progress, P } = ctx;
  const { $, h } = kit;
  const sec = $('#credits');
  if (!sec) return;
  const roll = $('.credits__roll', sec);
  const listEl = $('.credits__list', sec);
  const results = $('#results', sec);
  const post = $('.postcredits', sec);
  const confirmEl = $('.credits__confirm', sec);
  const game = () => kit.isGame();
  const born = performance.now();

  // ---------------------------------------------------------------- stats
  function stats() {
    const cleared = CHAPTER_SHOTS.filter((s) => P.cleared?.[s]);
    const opened = Object.keys(P.opened || {}).length;
    const quests = Object.values(P.quests || {}).filter((v) => v === 'done').length;
    const bonks = P.stats?.bonks | 0;
    const tokens = Object.keys(P.tokens || {}).length;
    const pageEggs = EGGS.filter((e) => e.kind === 'page' && has(e.id)).length;
    const eggs = foundCount(), eggsTotal = total();
    const ms = Math.max(P.stats?.ms | 0, performance.now() - born);
    const lv = progress.level(), title = progress.title();
    let rank = 'C';
    if (cleared.length >= 6 && tokens >= 10 && pageEggs >= 25) rank = 'S';
    else if (cleared.length >= 5 && tokens >= 5 && pageEggs >= 12) rank = 'A';
    else if (cleared.length >= 3 || pageEggs >= 5) rank = 'B';
    return { cleared, opened, quests, bonks, tokens, pageEggs, eggs, eggsTotal, ms, lv, title, rank };
  }

  function row(k, valueNode, hint, { done = false, cls = '' } = {}) {
    const dd = h('dd', null, valueNode);
    if (hint) dd.append(h('span', { class: 'results__hint' }, hint));
    return h('div', { class: `results__row ${done ? 'is-done' : ''} ${cls}`.trim() }, h('dt', null, k), dd);
  }
  const num = (v, of) => h('span', { class: 'results__v' }, h('b', { 'data-to': String(v) }, String(v)), of != null ? h('small', null, ` / ${of}`) : null);

  function render(animate) {
    if (!results) return null;
    const s = stats();
    const missing = CHAPTER_SHOTS.filter((c) => !s.cleared.includes(c)).map((c) => CH_NAME[c]);
    const tokLeft = TOKENS_TOTAL - s.tokens;
    const rankEl = h('div', { class: `results__rank rank--${s.rank}` },
      h('span', { class: 'results__rank-k' }, 'Rank'),
      h('b', { class: 'results__rank-l' }, s.rank),
      h('span', { class: 'results__rank-t' }, RANKS[s.rank]));
    results.replaceChildren(
      row('Chapters cleared', num(s.cleared.length, 6), missing.length ? `Still to read: ${missing.join(', ')}` : '', { done: !missing.length }),
      row('Details opened', num(s.opened, DETAILS_TOTAL), s.opened < DETAILS_TOTAL ? 'Try Inspect, Summary and Objectives' : '', { done: s.opened >= DETAILS_TOTAL }),
      row('Quests turned in', num(s.quests, 5), s.quests < 5 ? 'Open a quest’s objectives, then turn it in' : '', { done: s.quests >= 5 }),
      row('Bugs bonked', num(s.bonks), s.bonks ? '' : 'Critters wander the ribbon rows (key B)', { done: s.bonks > 0 }),
      row('Tokens', num(s.tokens, TOKENS_TOTAL), tokLeft > 0 ? `${tokLeft} left: try the trail signs` : '', { done: tokLeft <= 0 }),
      row('Eggs', num(s.eggs, s.eggsTotal), s.eggs < s.eggsTotal ? 'Field notes has hints' : '', { done: s.eggs >= s.eggsTotal }),
      row('Time', h('span', { class: 'results__v' }, h('b', { class: 'results__time' }, fmtTime(s.ms)))),
      row('Level', h('span', { class: 'results__v' }, h('b', { 'data-to': String(s.lv) }, String(s.lv)), h('small', null, ` · ${s.title}`)), '', { cls: 'results__row--lv' }),
    );
    results.append(rankEl);
    results.setAttribute('aria-label', `Run summary. Rank ${s.rank}, ${RANKS[s.rank]}.`);
    if (animate && !kit.rm()) countUp();
    return s;
  }
  // numbers count up from 0 (setTimeout steps, ~0.9s; no rAF loop)
  function countUp() {
    const bs = [...results.querySelectorAll('b[data-to]')];
    const steps = 14;
    bs.forEach((b) => { b.textContent = '0'; });
    let i = 0;
    const tick = () => {
      i++;
      for (const b of bs) b.textContent = String(Math.round((+b.dataset.to * i) / steps));
      if (i % 2) kit.sfx('tick');
      if (i < steps) setTimeout(tick, 60);
    };
    setTimeout(tick, 200);
  }

  // ---------------------------------------------------------------- entering the credits
  let rolled = false, postShown = false, clock = 0;
  const tickTime = () => {
    if (document.hidden) return;
    const t = results?.querySelector('.results__time');
    if (t) t.textContent = fmtTime(Math.max(P.stats?.ms | 0, performance.now() - born));
  };
  kit.observe(sec, { threshold: 0, once: false }, (_e, vis) => {
    clearInterval(clock); clock = 0;
    if (vis) clock = setInterval(tickTime, 1000);
  });
  let inside = false;
  kit.observe(sec, { threshold: 0.25, once: false }, (_e, ok) => {
    if (!ok) { inside = false; return; }
    if (inside || !game()) return;
    inside = true;
    const s = render(kit.sessionOnce('credits-enter'));
    if (!rolled) {
      rolled = true;
      sec.classList.add('is-rolling');
      kit.sfx('victory');
      progress.award({ id: 'finish', xp: 20, why: 'Finished the page', from: $('.credits__end', sec) });
      kit.emit('page:clear', { shot: 'footer' });
      if (kit.rm()) setTimeout(showPost, 12000);
      if (s?.rank === 'S' && kit.once('rank-s')) kit.toast('Rank S', 'Reviewer #1 would like a word (a good one).', { kind: 'ach', k: 'Results' });
    }
  });
  listEl?.addEventListener('animationend', (e) => { if (e.target === listEl) showPost(); });
  // rolled but scrolled away: the roll pauses (CSS, .is-live); coming back continues it

  function showPost() {
    if (postShown || !post || !game()) return;
    postShown = true;
    post.replaceChildren(
      h('div', { class: 'pier', 'aria-hidden': 'true' },
        h('span', { class: 'pier__sea' }),
        h('span', { class: 'pier__deck' }),
        h('span', { class: 'pier__legs' }),
        h('span', { class: 'pier__me' }, spriteImg('scholar', 2)),
        h('span', { class: 'pier__bit' }, spriteImg('bit', 2))),
      h('p', { class: 'postcredits__t' }, h('b', null, 'Bit: '), 'See you next conference.'));
    post.hidden = false;
    sec.classList.add('has-post');
    const bit = post.querySelector('.pier__bit');
    if (bit) setTimeout(() => kit.bubble(bit, 'See you next conference.', { who: 'bit', place: 'above', ms: 4200 }), 350);
    kit.emit('page:credits');
    kit.found('credits');
  }

  // ---------------------------------------------------------------- enter the world (round 4)
  // After reading the page, the reader can walk into it: the camera dives to the scholar and the game
  // begins. Only where the 3D world runs; the CV above never depends on it.
  const btnRow = $('.credits__btns', sec);
  if (btnRow && !$('.credits__enter', sec)) {
    const enter = h('div', { class: 'credits__enter', hidden: true },
      h('button', { type: 'button', class: 'gbtn gbtn--hero', 'data-act': 'enter' }, 'Enter the world ▶'),
      h('p', { class: 'credits__enter-sub' }, matchMedia('(pointer: coarse)').matches ? 'An open world behind this page: every place in the CV is a door. The ☰ menu brings you back here.' : 'An open world behind this page: every place in the CV is a door. Esc brings you back here.'));
    btnRow.before(enter);
    const sync = () => { enter.hidden = !(capabilities().play && kit.world()); };
    onEggs(sync);
    sync();
    const go = () => { try { kit.world()?.enterPlay({ dive: true }); } catch (err) { console.warn('[credits] enter', err); } };
    enter.querySelector('button').addEventListener('click', () => { cancelAuto(); autoDone = true; go(); });

    // Reaching the very bottom starts the adventure by itself: a short countdown that pushing on
    // (scrolling down again) skips, and "Stay here" (or scrolling back up) cancels. Once per visit;
    // never in Reviewer mode or with reduced motion.
    const cd = h('p', { class: 'credits__auto', hidden: true, role: 'status' },
      h('span', { class: 'credits__auto-t' }), ' ',
      h('button', { type: 'button', class: 'gbtn gbtn--sm', 'data-act': 'stay' }, 'Stay here'));
    enter.append(cd);
    let timer = 0, dwell = 0, left = 0, autoDone = false, pushes = 0;
    const html = document.documentElement;
    // "the end": the Enter panel is on screen (the page can still grow below it, e.g. the post-credits pier)
    const atBottom = () => { const r = enter.getBoundingClientRect(); return r.height > 0 && r.top < innerHeight - 30 && r.bottom > 0; };
    // phones: never pull a reader into play by itself (a flick past the credits is not a decision); the button does it
    const coarse = matchMedia('(pointer: coarse)').matches;
    const eligible = () => !coarse && !autoDone && !enter.hidden && !kit.rm() && !html.classList.contains('is-plain') && !kit.world()?.playing
      && !document.querySelector('.modal.is-open, .notes.is-open, .term.is-open');
    function tick() {
      if (!eligible() || !atBottom()) { cancelAuto(); return; }
      if (left <= 0) { cancelAuto(); autoDone = true; go(); return; }
      cd.firstChild.textContent = `Entering the world in ${left}…`;
      left--;
      timer = setTimeout(tick, 1000);
    }
    function startAuto() {
      if (timer || !eligible()) return;
      left = 3; cd.hidden = false; tick();
    }
    function cancelAuto() { clearTimeout(timer); clearTimeout(dwell); timer = 0; dwell = 0; pushes = 0; cd.hidden = true; }
    cd.querySelector('button').addEventListener('click', () => { cancelAuto(); autoDone = true; });
    addEventListener('scroll', () => {
      if (!atBottom()) { if (timer) cancelAuto(); clearTimeout(dwell); dwell = 0; return; }
      if (!dwell && !timer && eligible()) dwell = setTimeout(startAuto, 1200);
    }, { passive: true });
    // pushing past the end: two more "down" gestures at the bottom go straight in
    const push = () => {
      if (!atBottom() || !eligible()) return;
      if (++pushes >= 2) { cancelAuto(); autoDone = true; go(); } else startAuto();
    };
    addEventListener('wheel', (e) => { if (e.deltaY > 20) push(); }, { passive: true });
    let ty = null;
    addEventListener('touchstart', (e) => { ty = e.touches[0]?.clientY ?? null; }, { passive: true });
    addEventListener('touchend', (e) => { const y = e.changedTouches[0]?.clientY; if (ty != null && y != null && ty - y > 60) push(); ty = null; }, { passive: true });
    addEventListener('keydown', (e) => { if (['ArrowDown', 'PageDown', 'End', ' '].includes(e.key) && !e.target.closest?.('input, textarea, [contenteditable]')) push(); });
  }

  // ---------------------------------------------------------------- buttons
  const btn = (a) => sec.querySelector(`[data-act="${a}"]`);
  const behavior = () => (kit.rm() ? 'auto' : 'smooth');
  btn('title')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: behavior() });
    const start = document.querySelector('.title-menu__i[data-act="start"]') || document.getElementById('name');
    setTimeout(() => start?.focus({ preventScroll: true }), kit.rm() ? 0 : 500);
  });
  btn('notes')?.addEventListener('click', () => openNotes({ tab: 'progress' }));
  btn('ngplus')?.addEventListener('click', () => {
    if (!confirmEl) return;
    confirmEl.hidden = false;
    btn('ngplus').setAttribute('aria-expanded', 'true');
    btn('ng-no')?.focus({ preventScroll: true });
  });
  btn('ng-no')?.addEventListener('click', () => {
    confirmEl.hidden = true;
    btn('ngplus')?.setAttribute('aria-expanded', 'false');
    btn('ngplus')?.focus({ preventScroll: true });
  });
  btn('ng-yes')?.addEventListener('click', () => {
    confirmEl.hidden = true;
    btn('ngplus')?.setAttribute('aria-expanded', 'false');
    progress.resetPage();
    kit.sfx('levelup');
    window.scrollTo({ top: 0, behavior: behavior() });
    setTimeout(() => {
      bounceHero(kit);
      kit.toast('New Game+', 'Same CV, more confident.', { kind: 'info', k: `NG+ ${P.ngplus | 0}` });
      kit.found('newgame');
      document.querySelector('.title-menu__i[data-act="start"]')?.focus({ preventScroll: true });
    }, kit.rm() ? 50 : 700);
    render(false);
  });
  kit.on('page:ngplus', () => { if (sec.classList.contains('is-live')) render(false); });

  // accessible text for the credits (the rolling copy is aria-hidden)
  if (roll && !sec.querySelector('.credits__sr')) {
    const items = [...(listEl?.children || [])].map((li) => li.textContent.trim()).join('. ');
    roll.after(h('p', { class: 'sr credits__sr' }, `Credits: ${items}.`));
  }
}

/** The hero letters hop once, one after another (Web Animations; nothing under reduced motion). */
function bounceHero(kit) {
  if (kit.rm()) return;
  const blocks = [...document.querySelectorAll('#name .hero__blk')];
  const els = blocks.length ? blocks : [document.getElementById('name')].filter(Boolean);
  els.forEach((el, i) => {
    el.animate?.([
      { transform: 'translateY(0)' },
      { transform: 'translateY(-18px)', offset: 0.4 },
      { transform: 'translateY(0)', offset: 0.7 },
      { transform: 'translateY(-4px)', offset: 0.85 },
      { transform: 'translateY(0)' },
    ], { duration: 620, delay: i * 45, easing: 'ease-out' });
  });
}
