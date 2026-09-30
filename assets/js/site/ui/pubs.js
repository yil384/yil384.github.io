// ui/pubs.js: PUBLICATIONS as an achievements hall (SPEC §4.5, SECTIONS-B).
// Facts stay the static HTML of index.html; this module only adds game-only chrome ([data-game]) and
// feedback: medallions that unlock once per save, a shelf, BibTeX copy with a CITED stamp, "Visit the
// shelf", the simulated Reviewer #2 panel, and the asterisk / H2O / squared micro-eggs.
const NS = 'http://www.w3.org/2000/svg';

/** A crisp pixel-art <svg> from rows of palette keys ('.' = empty). Runs are merged into one rect. */
export function pixSvg(rows, pal, { scale = 2, cls = '' } = {}) {
  const w = Math.max(...rows.map((r) => r.length)), ht = rows.length;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${ht}`);
  svg.setAttribute('width', String(w * scale));
  svg.setAttribute('height', String(ht * scale));
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (cls) svg.setAttribute('class', cls);
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      if (!pal[c]) { x++; continue; }
      let x2 = x;
      while (x2 < row.length && row[x2] === c) x2++;
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', String(x)); r.setAttribute('y', String(y));
      r.setAttribute('width', String(x2 - x)); r.setAttribute('height', '1');
      r.setAttribute('fill', pal[c]);
      svg.append(r);
      x = x2;
    }
  });
  return svg;
}

const TROPHY = [
  '..YYYYYYYY..',
  'YYYWYYYYYOYY',
  'Y.YWYYYYYO.Y',
  'Y.YWYYYYYO.Y',
  '.YYWYYYYYOY.',
  '...YYYYYO...',
  '....YYYO....',
  '.....YO.....',
  '.....YO.....',
  '....YYYO....',
  '...BBBBBB...',
  '...BBBBBB...',
];
const BOLT = [
  '......DDDD.',
  '.....DDDD..',
  '....DDDD...',
  '...DDDD....',
  '..DDDDDDDD.',
  '.....DDDD..',
  '....DDDD...',
  '...DDD.....',
  '..DDD......',
  '.DD........',
];
const HOURGLASS = [
  'GGGGGGG',
  '.GSSSG.',
  '..GSG..',
  '...G...',
  '..G.G..',
  '.GSSSG.',
  'GGGGGGG',
];
const REFRESH = [
  '..XXXX.X.',
  '.X....XX.',
  'X....XXX.',
  'X........',
  'X.......X',
  'X.......X',
  '.X.....X.',
  '..XXXXX..',
];

// Per paper: game-only extras (never facts; the status pill / venue in the HTML stay the source).
const PUBS = {
  'pub-tritongym': {
    tier: 'Silver', glyph: () => pixSvg(BOLT, { D: '#182B49' }, { scale: 3 }),
    stage: 3, steps: ['Written', 'Submitted', 'Under review', 'Decision'], stageLabel: 'Under review',
    banner: 'Achievement in progress', toastK: 'Achievement in progress', toastT: 'Submitted to ICML 2026',
  },
  'pub-reh2o': {
    tier: 'Gold', glyph: () => pixSvg(TROPHY, { Y: '#9a6400', W: '#d49a10', O: '#5b3a00', B: '#3b2600' }, { scale: 3 }),
    stage: 4, steps: ['Written', 'Submitted', 'Accepted', 'Published'], stageLabel: 'Published',
    banner: 'Achievement unlocked', toastK: 'Achievement unlocked', toastT: 'Published at IEEE IV 2023',
  },
};

const COMMENTS = [
  'The authors should compare against a baseline from 1987.',
  'Please cite the following 14 papers (all mine).',
  'Weak reject. The benchmark is too benchmark-like.',
  'I did not read the appendix, but it is wrong.',
  'Accept if the authors run it on my laptop.',
  'The kernels are fast, but are they fast enough?',
  'Missing related work: my thesis.',
  'Novelty unclear; clarity also unclear.',
];
const VERDICT = ['', 'Strong reject', 'Strong reject', 'Reject', 'Weak reject', 'Borderline', 'Weak accept', 'Accept', 'Accept', 'Strong accept', 'Award'];

export function init(ctx) {
  const { kit, progress, P } = ctx;
  const { $, $$, h } = kit;
  const sec = $('#publications');
  if (!sec) return;
  const card = sec.querySelector(':scope > .card');
  const pubs = $$('.pub.ach', sec);
  if (!pubs.length) return;
  const game = () => kit.isGame();

  // ---------------------------------------------------------------- shelf of spines next to the heading
  const h2 = card?.querySelector('h2');
  if (h2 && !card.querySelector('.pshelf')) {
    const shelf = h('div', { class: 'pshelf', 'data-game': '', 'aria-hidden': 'true' });
    const row = h('div', { class: 'pshelf__row' });
    for (const li of pubs) {
      const sp = h('span', { class: `pshelf__book pshelf__book--${li.classList.contains('ach--gold') ? 'gold' : 'silver'}`, title: li.querySelector('.pub__title')?.textContent.split(':')[0] || '' });
      sp.addEventListener('click', () => {
        li.scrollIntoView({ block: 'center', behavior: kit.rm() ? 'auto' : 'smooth' });
        li.focus({ preventScroll: true });
        li.classList.remove('is-ping'); void li.offsetWidth; li.classList.add('is-ping');
      });
      row.append(sp);
    }
    for (let i = 0; i < 3; i++) row.append(h('span', { class: 'pshelf__slot' }, '·'));
    const got = pubs.filter((li) => li.classList.contains('ach--gold')).length;
    shelf.append(row, h('span', { class: 'pshelf__plank' }), h('p', { class: 'pshelf__k' }, `${got} unlocked · ${pubs.length - got} in progress`));
    h2.before(shelf);
  }

  for (const li of pubs) {
    const conf = PUBS[li.id] || { tier: 'Silver', glyph: () => null, stage: 1, steps: ['Written'], stageLabel: '', banner: 'Achievement unlocked', toastK: 'Achievement', toastT: '' };
    const key = li.dataset.focus;
    const medal = li.querySelector('.ach__medal');
    const icon = medal?.querySelector('.ach__icon');

    // ---- medallion glyph (+ hourglass for the one in review)
    if (icon && !icon.firstChild) {
      const g = conf.glyph();
      if (g) icon.append(g);
      if (li.classList.contains('ach--review')) medal.append(h('span', { class: 'ach__hg' }, pixSvg(HOURGLASS, { G: '#FFCD00', S: '#fff3b0' }, { scale: 2 })));
    }

    // ---- top strip (tier + stage meter) with the unlock banner that slides over it
    if (!li.querySelector('.ach__top')) {
      const segs = h('span', { class: 'ach__segs' });
      conf.steps.forEach((s, i) => segs.append(h('i', { class: i + 1 < conf.stage ? 'is-done' : i + 1 === conf.stage ? (conf.stage === conf.steps.length ? 'is-done' : 'is-now') : '' })));
      const top = h('div', { class: 'ach__top', 'data-game': '', 'aria-hidden': 'true' },
        h('span', { class: 'ach__tier' }, h('i', { class: 'ach__gem' }), `${conf.tier} achievement`),
        h('span', { class: 'ach__stage', title: conf.steps.map((s, i) => `${i + 1}. ${s}`).join(' · ') }, segs, `Stage ${conf.stage}/${conf.steps.length} · ${conf.stageLabel}`),
        h('span', { class: 'ach__banner' }, h('i', { class: 'ach__banner-star' }, '★'), h('b', null, conf.banner), h('i', { class: 'ach__banner-star' }, '★')));
      li.prepend(top);
    }

    // ---- unlock: once per save, the first time the card is ≥60% visible
    const onceKey = `ach:${li.id}`;
    const unlock = (animate) => {
      li.classList.add('is-unlocked');
      if (!animate) return;
      if (!kit.rm()) {
        icon?.classList.remove('is-spin'); void icon?.offsetWidth; icon?.classList.add('is-spin');
        setTimeout(() => icon?.classList.remove('is-spin'), 1000);
      }
      li.classList.add('is-banner');
      setTimeout(() => li.classList.remove('is-banner'), 350 + 2500);
      kit.burst(icon || li, { n: 6, kind: 'spark' });
      kit.sfx('achievement');
      kit.toast(conf.toastT, li.querySelector('.pub__title')?.textContent.split(':')[0], { kind: 'ach', k: conf.toastK });
      progress.award({ id: onceKey, xp: 10, why: conf.toastK, from: icon || li });
      kit.emit('page:open', { key, what: 'unlock' });
      kit.echo();
      kit.live(`${conf.toastK}: ${conf.toastT}.`);
    };
    if (P.once[`o:${onceKey}`]) unlock(false);
    else {
      const off = kit.observe(li, { threshold: 0.6, once: false }, (_e, ok) => {
        if (!ok || !game()) return;
        off();
        if (kit.once(onceKey)) unlock(true); else unlock(false);
      });
    }

    // ---- details: sound + XP once each; the (Re)2H2O BibTeX reveals token t4
    for (const d of $$('details.more', li)) {
      const kind = d.classList.contains('more--code') ? 'bib' : 'summary';
      d.addEventListener('toggle', () => {
        if (!d.open || !game()) return;
        kit.sfx('open');
        progress.markOpened(`${li.id}-${kind}`, d.querySelector('summary'));
        kit.emit('page:open', { key, what: kind });
        const tok = d.querySelector('.token[data-token]');
        if (tok && tok.hidden && !P.tokens[tok.dataset.token]) {
          tok.hidden = false;
          if (!kit.rm()) tok.classList.add('is-drop');
        }
      });
    }
    const tok = li.querySelector('.token[data-token]');
    if (tok) {
      tok.addEventListener('click', () => {
        if (progress.token(tok.dataset.token, tok)) { tok.classList.add('is-got'); setTimeout(() => { tok.hidden = true; }, 560); }
      });
    }

    // ---- BibTeX: colour the fields (spans only; textContent unchanged), copy + CITED stamp
    const code = li.querySelector('.more--code code');
    if (code && !code.dataset.hl) {
      code.dataset.hl = '1';
      const src = code.textContent;
      const frag = document.createDocumentFragment();
      src.split('\n').forEach((line, i, arr) => {
        let m;
        if ((m = line.match(/^(@\w+)(\{)([^,]*)(,?)$/))) frag.append(h('span', { class: 'bib-at' }, m[1]), m[2], h('span', { class: 'bib-key' }, m[3]), m[4]);
        else if ((m = line.match(/^(\s*)(\w+)(\s*=\s*)(\{.*\})(,?)$/))) frag.append(m[1], h('span', { class: 'bib-f' }, m[2]), m[3], h('span', { class: 'bib-v' }, m[4]), m[5]);
        else frag.append(line);
        if (i < arr.length - 1) frag.append('\n');
      });
      code.replaceChildren(frag);
      if (code.textContent !== src) code.textContent = src; // paranoia: never alter what gets copied
    }
    const copyBtn = li.querySelector('[data-copy]');
    const citeSlot = li.querySelector('.stamp-slot[data-stamp="cite"]');
    let copyT = 0;
    const copy = async () => {
      const c = copyBtn && $(`#${copyBtn.dataset.copy}`);
      if (!c) return;
      const bibD = c.closest('details');
      if (bibD && !bibD.open) bibD.open = true;
      const ok = await kit.copyText(c.textContent, { selectEl: c });
      clearTimeout(copyT);
      copyBtn.dataset.label ||= copyBtn.textContent;
      if (!ok) {
        copyBtn.textContent = 'Press Ctrl/Cmd+C';
        kit.live('Clipboard blocked. The BibTeX is selected: press Ctrl or Cmd plus C.');
        copyT = setTimeout(() => { copyBtn.textContent = copyBtn.dataset.label; }, 2600);
        return;
      }
      copyBtn.textContent = 'Copied · cite away';
      copyBtn.classList.add('is-ok');
      copyT = setTimeout(() => { copyBtn.textContent = copyBtn.dataset.label; copyBtn.classList.remove('is-ok'); }, 1600);
      kit.live('BibTeX copied.');
      if (!game()) return;
      kit.stamp(citeSlot, 'Cited', { tone: 'red', rot: -10 });
      kit.float(copyBtn, '+1 citation (in spirit)', { tone: 'red' });
      progress.award({ id: `bib:${li.id}`, xp: 5, why: 'BibTeX copied', from: citeSlot || copyBtn });
      kit.found('cite');
    };
    copyBtn?.setAttribute('title', 'Copy BibTeX (C on a focused paper)');
    copyBtn?.addEventListener('click', copy);
    li.addEventListener('ui:copy', (e) => { e.preventDefault(); copy(); });

    // ---- E: toggle the summary
    kit.primary(li, () => {
      const d = li.querySelector('details.more:not(.more--code)');
      if (d) d.open = !d.open;
    });

    // ---- small icons on the action buttons + Visit the shelf
    const visit = li.querySelector('[data-act="visit"]');
    if (visit && !visit.querySelector('img')) visit.prepend(kit.spriteImg('book', 1, 'gbtn__i'));
    visit?.addEventListener('click', () => {
      const k = visit.dataset.key || key;
      try { kit.world()?.stage?.setHover?.(k); } catch { /* world not ready */ }
      kit.emit('page:open', { key: k, what: 'visit' });
      kit.echo();
      kit.sfx('buddy');
      const line = (li.dataset.say || '').replace(/^\s*\w+\s*:\s*/, '');
      if (line) kit.say('nell', line);
    });

    // ---- equal contribution: both starred names light up together
    const asts = $$('.ast', li);
    if (asts.length > 1) {
      const names = asts.map((a) => {
        const prev = a.previousSibling;
        if (!prev) return null;
        if (prev.nodeType === 1) { prev.classList.add('pub__au'); return prev; }
        const txt = prev.textContent;
        const lead = txt.match(/^[\s,]*/)[0];
        if (lead) prev.before(lead);
        const sp = h('span', { class: 'pub__au' }, txt.slice(lead.length));
        prev.replaceWith(sp);
        return sp;
      }).filter(Boolean);
      const au = li.querySelector('.pub__authors');
      let t = 0;
      asts.forEach((a) => {
        kit.upgradeButton(a, 'Asterisk: equal contribution');
        a.addEventListener('click', () => {
          if (!game()) return;
          clearTimeout(t);
          au.classList.remove('is-pair'); void au.offsetWidth; au.classList.add('is-pair');
          names.forEach((n) => n.classList.add('is-star'));
          t = setTimeout(() => { au.classList.remove('is-pair'); names.forEach((n) => n.classList.remove('is-star')); }, 2600);
          asts.forEach((x) => kit.burst(x, { n: 4, kind: 'spark' }));
          kit.sfx('pop');
          kit.bubble(a, 'Equal contribution. Two names, one star.', { place: 'above', ms: 2600 });
          kit.found('asterisk');
        });
      });
    }

    // ---- (Re)2H2O: the subscript is water, the square is a wink
    const sub = li.querySelector('.sub2');
    if (sub) {
      kit.upgradeButton(sub, 'Subscript two');
      sub.addEventListener('click', () => {
        if (!game()) return;
        kit.burst(sub, { n: 7, kind: 'drop' });
        kit.sfx('pop');
        kit.say('bit', 'Stay hydrated.');
        kit.emit('page:sky', { n: 2 });
        kit.found('h2o');
      });
    }
    const sq = li.querySelector('.sq');
    if (sq) {
      kit.upgradeButton(sq, 'Superscript two');
      let t = 0;
      sq.addEventListener('click', () => {
        if (!game()) return;
        const title = li.querySelector('.pub__title');
        clearTimeout(t);
        // "(Re)²H₂O" → "(Re)²H₂O²" for a moment: a game-only ² after the O (split, then merged back)
        const after = sub?.nextSibling;
        if (after?.nodeType === 3 && !title.querySelector('.pub__sq2')) {
          const rest = after.splitText(1);
          rest.before(h('span', { class: 'pub__sq2', 'aria-hidden': 'true' }, '²'));
        }
        kit.bubble(sq, 'Squared twice. Still water.', { place: 'above', ms: 2200 });
        kit.sfx('pop');
        t = setTimeout(() => { title.querySelector('.pub__sq2')?.remove(); title.normalize(); }, 2200);
      });
    }

    // ---- Reviewer #2 (TritonGym only)
    const reqBtn = li.querySelector('[data-act="review"]');
    const panel = li.querySelector('#r2, .r2');
    if (reqBtn && panel) setupReview(ctx, li, reqBtn, panel, key);
  }

}

function setupReview(ctx, li, reqBtn, panel, key) {
  const { kit } = ctx;
  const { h } = kit;
  if (!reqBtn.querySelector('img')) reqBtn.prepend(kit.spriteImg('mage', 1, 'gbtn__i'));
  const reqLabel = reqBtn.lastChild?.nodeType === 3 ? reqBtn.lastChild : null;

  // --- build the panel once
  const needle = document.createElementNS(NS, 'g');
  const dial = document.createElementNS(NS, 'svg');
  dial.setAttribute('viewBox', '0 0 120 70');
  dial.setAttribute('class', 'r2__dial-svg');
  dial.setAttribute('aria-hidden', 'true');
  const cx = 60, cy = 62, R = 48;
  const cols = ['#F87171', '#F87171', '#fb923c', '#fb923c', '#FBBF24', '#FBBF24', '#a3e635', '#a3e635', '#4ADE80', '#4ADE80'];
  for (let i = 0; i < 10; i++) {
    const a0 = Math.PI - (i / 10) * Math.PI + 0.03, a1 = Math.PI - ((i + 1) / 10) * Math.PI - 0.03;
    const p = (a, r) => `${(cx + Math.cos(a) * r).toFixed(1)} ${(cy - Math.sin(a) * r).toFixed(1)}`;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', `M${p(a0, R)} A${R} ${R} 0 0 1 ${p(a1, R)} L${p(a1, R - 10)} A${R - 10} ${R - 10} 0 0 0 ${p(a0, R - 10)}Z`);
    path.setAttribute('fill', cols[i]);
    path.setAttribute('class', 'r2__seg');
    dial.append(path);
  }
  const nl = document.createElementNS(NS, 'path');
  nl.setAttribute('d', `M${cx - 2.5} ${cy} L${cx} ${cy - R + 4} L${cx + 2.5} ${cy}Z`);
  nl.setAttribute('fill', '#eef0f5');
  const hub = document.createElementNS(NS, 'rect');
  hub.setAttribute('x', String(cx - 4)); hub.setAttribute('y', String(cy - 4)); hub.setAttribute('width', '8'); hub.setAttribute('height', '8');
  hub.setAttribute('fill', '#FFCD00');
  needle.append(nl);
  needle.setAttribute('class', 'r2__needle');
  dial.append(needle, hub);

  const scoreN = h('b', null, '–');
  const verdict = h('span', { class: 'r2__verdict' }, 'Reading…');
  const comment = h('p', { class: 'r2__comment' });
  const log = h('div', { class: 'r2__log', 'aria-live': 'polite' });
  const status = h('span', { class: 'r2__status' }, 'Status: Under review');
  const stampSlot = h('span', { class: 'stamp-slot r2__stamp' });
  const refresh = h('button', { type: 'button', class: 'gbtn gbtn--ghost gbtn--sm r2__refresh', 'aria-label': 'Refresh the review status', title: 'Refresh status' },
    pixSvg(REFRESH, { X: 'currentColor' }, { scale: 2 }));
  const rebut = h('button', { type: 'button', class: 'gbtn gbtn--gold gbtn--sm r2__rebut' }, 'Write rebuttal');
  const av = h('span', { class: 'r2__av' }, kit.spriteImg('mage', 2));
  panel.replaceChildren(h('div', { class: 'r2__card' },
    h('div', { class: 'r2__head' },
      av,
      h('div', { class: 'r2__who' }, h('p', { class: 'r2__name' }, 'Reviewer #2'), h('p', { class: 'r2__label' }, 'Simulated review · a joke, not a real review')),
      refresh),
    h('div', { class: 'r2__body' },
      h('div', { class: 'r2__dial' }, dial, h('p', { class: 'r2__score' }, scoreN, h('small', null, '/10')), verdict),
      h('div', { class: 'r2__text' }, h('p', { class: 'r2__k' }, 'Comments to the authors'), comment)),
    log,
    h('div', { class: 'r2__foot' }, rebut, status, stampSlot)));

  let score = 0, rebuttals = 0, busy = false;
  const setScore = (s) => {
    score = s;
    needle.style.setProperty('--a', `${-90 + (s / 10) * 180}deg`);
    scoreN.textContent = String(s);
    verdict.textContent = VERDICT[s] || '';
  };
  const logLine = (who, cls) => {
    const p = h('p', { class: `r2__line ${cls || ''}` }, who ? h('b', null, `${who}: `) : null);
    const t = h('span');
    p.append(t);
    log.append(p);
    while (log.children.length > 4) log.firstElementChild.remove();
    return t;
  };

  const openReview = async () => {
    const open = await kit.expand(panel);
    if (reqLabel) reqLabel.data = open ? 'Close review' : 'Request review';
    if (!open) return;
    kit.sfx('open');
    kit.emit('page:open', { key: key || 'book-triton', what: 'review' });
    kit.echo();
    if (kit.world()) kit.say('nell', 'Oh no. Reviewer #2 found the library.');
    // fresh review each time the panel opens: needle from 0 swings to 3–5 with a wobble
    needle.style.setProperty('--a', '-90deg');
    needle.classList.remove('is-swing');
    scoreN.textContent = '–'; verdict.textContent = 'Reading…';
    void needle.getBoundingClientRect();
    requestAnimationFrame(() => {
      needle.classList.add('is-swing');
      setScore(3 + Math.floor(Math.random() * 3));
    });
    kit.typewriter(comment, `“${COMMENTS[Math.floor(Math.random() * COMMENTS.length)]}”`, { cps: 60 });
  };
  reqBtn.addEventListener('click', () => { if (kit.isGame()) openReview(); });

  rebut.addEventListener('click', async () => {
    if (busy) return;
    busy = true; rebut.disabled = true;
    rebuttals++;
    if (rebuttals >= 3) {
      await kit.typewriter(logLine('', 'r2__line--sys'), 'Reviewer #3 is loading…', { cps: 30 });
      kit.say('bit', 'The real one lives in the eucalyptus grove (press W).');
      rebut.textContent = 'Reviewer #3 loading…';
      busy = false;
      return;
    }
    const mine = rebuttals === 1
      ? 'We thank the reviewer for their insightful comments. We have addressed all concerns, including the baseline from 1987.'
      : 'We thank the reviewer again. The baseline from 1987 now has its own appendix.';
    await kit.typewriter(logLine('Authors'), mine, { cps: 40 });
    await new Promise((r) => setTimeout(r, kit.rm() ? 0 : 500));
    if (rebuttals === 1) {
      await kit.typewriter(logLine('Reviewer #2', 'r2__line--r2'), 'I have read the rebuttal. Score unchanged.', { cps: 40 });
      kit.stamp(stampSlot, 'Score unchanged', { tone: 'ink', rot: -6, size: 'sm' });
      kit.found('rebuttal');
    } else {
      needle.classList.add('is-swing');
      setScore(Math.min(10, score + 1));
      await kit.typewriter(logLine('Reviewer #2', 'r2__line--r2'), 'Borderline. I remain unconvinced but tired.', { cps: 40 });
      kit.stamp(stampSlot, `Score ${score}`, { tone: 'gold', rot: -6, size: 'sm' });
    }
    busy = false; rebut.disabled = false;
    rebut.textContent = 'Write another rebuttal';
  });

  let spinT = 0;
  refresh.addEventListener('click', () => {
    refresh.classList.remove('is-spin'); void refresh.offsetWidth; refresh.classList.add('is-spin');
    clearTimeout(spinT); spinT = setTimeout(() => refresh.classList.remove('is-spin'), 520);
    kit.sfx('tick');
    status.classList.remove('is-blink'); void status.offsetWidth; status.classList.add('is-blink');
    kit.typewriter(status, 'Status: Under review', { cps: 80, sound: false });
  });
  kit.clicks(refresh, 5, 10000, () => {
    kit.typewriter(logLine('', 'r2__line--sys'), 'Please stop refreshing. Decisions are out when they are out.', { cps: 50 });
    kit.found('refresh');
  });
}
