// ui/quests.js: EXPERIENCE as a quest log (SPEC §4.6, SECTIONS-B).
// Facts stay the static rows of index.html. This module adds game-only chrome and feedback: a gantt
// built from data-start / data-end, COMPLETE stamps as rows cross the viewport centre (the section's one
// auto-celebration), ticking objective checklists, reward chips, Turn in quest, the Tencent teammate gag,
// the Lark bird + token t5, the parallel-quests egg, and 3D flag picks.
import { pixSvg } from './pubs.js';

const NS = 'http://www.w3.org/2000/svg';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ym = (s) => { const [y, m] = String(s || '').split('-').map(Number); return y && m ? y * 12 + (m - 1) : NaN; };
const fmt = (i) => `${MON[i % 12]} ${Math.floor(i / 12)}`;

const LARK = [
  '....KKK.....',
  '...KBBBK....',
  '..KBWBBBK...',
  '.KBBBBBBBOO.',
  'KBBBBBBBK...',
  '.KWWWBBBBK..',
  '..KWWWBBBBK.',
  '...KKWWBBBBK',
  '.....KKKKKK.',
  '.....O..O...',
];
const LARK_PAL = { K: '#0f1d33', B: '#3aa0ff', W: '#e8f4ff', O: '#f59e0b' };

export function init(ctx) {
  const { kit, progress, hud, P } = ctx;
  const { $, $$, h } = kit;
  const sec = $('#experience');
  if (!sec) return;
  const card = sec.querySelector(':scope > .card');
  const rows = $$('.quest[data-focus]', sec);
  if (!rows.length) return;
  const game = () => kit.isGame();
  const qid = (row) => row.dataset.focus.replace(/^flag-/, '');
  const orgOf = (row) => (row.querySelector('.row__title')?.firstChild?.textContent || '').trim();
  P.quests ||= {};

  // ---------------------------------------------------------------- quest log header + gantt
  const map = $('.qmap', card);
  const bars = new Map();
  let counts = null;
  if (map && !map.firstChild) {
    const spans = rows.map((row) => ({ row, a: ym(row.dataset.start), b: ym(row.dataset.end) })).filter((s) => !Number.isNaN(s.a) && !Number.isNaN(s.b));
    const lo = Math.floor(Math.min(...spans.map((s) => s.a)) / 12) * 12;
    const hi = Math.max(...spans.map((s) => s.b)) + 3;
    const N = hi - lo;
    const pct = (i) => `${((i - lo) / N) * 100}%`;

    // densest month (the parallel quests egg)
    let peakM = lo, peakN = 0;
    for (let m = lo; m < hi; m++) {
      const n = spans.filter((s) => s.a <= m && m <= s.b).length;
      if (n > peakN) { peakN = n; peakM = m; }
    }

    const nDone = h('b', null, '0'), nTurn = h('b', null, '0');
    counts = { nDone, nTurn };
    const read = h('span', { class: 'qmap__read' }, 'Hover a bar');
    const chart = h('div', { class: 'qmap__chart', style: { '--lanes': spans.length } });
    for (let y = lo / 12; y * 12 < hi; y++) {
      chart.append(h('span', { class: 'qmap__year', style: { left: pct(y * 12) } }, h('i', null, String(y))));
    }
    const peak = h('span', { class: 'qmap__peak', style: { left: pct(peakM), width: `${(1 / N) * 100}%` } }, h('i', null, `×${peakN}`));
    if (peakN > 1) chart.append(peak);
    spans.forEach((s, i) => {
      const who = orgOf(s.row);
      const bar = h('button', { type: 'button', class: 'qmap__bar', tabindex: '-1', style: { left: pct(s.a), width: `calc(${((s.b - s.a + 1) / N) * 100}% - 2px)`, top: `${i * 11}px`, '--org': s.row.style.getPropertyValue('--org') || 'var(--gold)' }, title: who },
        h('i', { class: 'qmap__flag' }));
      const name = h('i', { class: 'qmap__name', style: { top: `${i * 11}px`, '--org': bar.style.getPropertyValue('--org') } }, s.row.dataset.focus.replace(/^flag-/, ''));
      chart.append(name);
      const when = s.row.querySelector('.row__when')?.textContent || `${fmt(s.a)} – ${fmt(s.b)}`;
      const show = () => {
        read.textContent = `${who} · ${when} · ${s.b - s.a + 1} mo`;
        s.row.dataset.match = 'On the map';
        s.row.classList.remove('is-match'); void s.row.offsetWidth; s.row.classList.add('is-match');
        kit.sfx('buddy');
      };
      bar.addEventListener('pointerenter', show);
      bar.addEventListener('pointerenter', () => name.classList.add('is-on'));
      bar.addEventListener('pointerleave', () => name.classList.remove('is-on'));
      bar.addEventListener('focus', show);
      bar.addEventListener('pointerleave', () => { read.textContent = 'Hover a bar'; });
      bar.addEventListener('click', () => {
        s.row.scrollIntoView({ block: 'center', behavior: kit.rm() ? 'auto' : 'smooth' });
        s.row.focus({ preventScroll: true });
      });
      chart.append(bar);
      bars.set(s.row, bar);
    });
    const peakHit = () => {
      read.textContent = `Parallel quests: ${peakN} at once · ${fmt(peakM)}`;
      peak.classList.add('is-hot');
      for (const s of spans) if (s.a <= peakM && peakM <= s.b) bars.get(s.row)?.classList.add('is-hot');
      kit.found('multithread');
    };
    const peakOff = () => { peak.classList.remove('is-hot'); bars.forEach((b) => b.classList.remove('is-hot')); read.textContent = 'Hover a bar'; };
    peak.addEventListener('pointerenter', peakHit);
    peak.addEventListener('pointerleave', peakOff);
    peak.addEventListener('click', peakHit);

    map.append(
      h('div', { class: 'qmap__top' },
        h('span', { class: 'qmap__k' }, `${spans.length} quests`),
        h('span', { class: 'qmap__c' }, 'Complete ', nDone, `/${spans.length}`),
        h('span', { class: 'qmap__c' }, 'Turned in ', nTurn, `/${spans.length}`),
        read),
      chart);
  }
  const refreshCounts = () => {
    if (!counts) return;
    counts.nDone.textContent = String(rows.filter((r) => r.classList.contains('is-complete')).length);
    counts.nTurn.textContent = String(rows.filter((r) => P.quests[qid(r)] === 'done').length);
  };

  // ---------------------------------------------------------------- per quest
  const stampRow = (row, animate) => {
    if (row.classList.contains('is-complete')) return;
    row.classList.add('is-complete');
    const slot = row.querySelector('.quest__stamp');
    kit.stamp(slot, 'Complete', { tone: 'ok', rot: -8, silent: !animate || kit.rm() });
    if (animate) kit.emit('page:stamp', { key: row.dataset.focus });
    refreshCounts();
  };

  let lastHotstar = 0, lastTencent = 0;
  for (const row of rows) {
    const id = qid(row);
    const org = orgOf(row);
    const d = row.querySelector('details.quest__more');
    const bar = bars.get(row);

    // row ↔ gantt bar
    row.addEventListener('pointerenter', () => bar?.classList.add('is-row'));
    row.addEventListener('pointerleave', () => bar?.classList.remove('is-row'));
    row.addEventListener('focusin', () => {
      bar?.classList.add('is-row');
      const now = performance.now();
      if (id === 'hotstar') lastHotstar = now;
      if (id === 'tencent') lastTencent = now;
      if (game() && lastHotstar && lastTencent && Math.abs(lastHotstar - lastTencent) < 10000) kit.found('multithread');
    });
    row.addEventListener('focusout', () => bar?.classList.remove('is-row'));

    // COMPLETE stamp: restored silently, or thumped once when the row crosses the viewport centre
    const sKey = `qstamp:${id}`;
    if (P.once[`o:${sKey}`]) stampRow(row, false);
    else {
      const off = kit.observe(row, { threshold: 0, once: false, rootMargin: '-45% 0px -45% 0px' }, (e) => {
        if (!e.isIntersecting || !game()) return;
        off();
        kit.once(sKey);
        stampRow(row, true);
      });
    }

    // checklist: an svg tick per objective (decorative)
    const objs = $$('.quest__objs > li', row);
    for (const li of objs) {
      if (li.querySelector('.quest__tick')) continue;
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 12 12');
      svg.setAttribute('class', 'quest__tick');
      svg.setAttribute('aria-hidden', 'true');
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', 'M2 6.5 L5 9.2 L10.2 2.6');
      p.setAttribute('pathLength', '1');
      svg.append(p);
      li.prepend(svg);
    }
    const chips = $$('.chip--reward', row);
    chips.forEach((c, i) => c.style.setProperty('--i', String(i)));

    const tick = async () => {
      row.classList.remove('is-ticked');
      objs.forEach((li) => li.classList.remove('is-on'));
      if (kit.rm()) { objs.forEach((li) => li.classList.add('is-on')); row.classList.add('is-ticked'); return; }
      for (const li of objs) {
        await new Promise((r) => setTimeout(r, 160));
        if (!d.open) return;
        li.classList.add('is-on');
        kit.sfx('coin');
      }
      await new Promise((r) => setTimeout(r, 120));
      row.classList.add('is-ticked');
    };
    if (d) {
      d.addEventListener('toggle', () => {
        if (!game()) return;
        if (!d.open) { row.classList.remove('is-ticked'); objs.forEach((li) => li.classList.remove('is-on')); return; }
        kit.sfx('open');
        tick();
        progress.markOpened(`quest-${id}`, d.querySelector('summary'));
        kit.emit('page:open', { key: row.dataset.focus, what: 'objectives' });
      });
      if (d.open && game()) { objs.forEach((li) => li.classList.add('is-on')); row.classList.add('is-ticked'); }
    }
    kit.primary(row, () => { if (d) d.open = !d.open; });

    // reward chips: obtained-from tooltip; click → ghost flies into the HUD cash (no reward)
    for (const c of chips) {
      c.title = `Obtained from: ${org}`;
      if (game()) kit.upgradeButton(c, `${c.textContent}, obtained from ${org}`);
      c.addEventListener('click', () => {
        if (!game()) return;
        kit.sfx('pop');
        kit.flyTo(c, hud?.target?.('cash'), { html: `<span class="chip chip--reward qfly">${c.textContent}</span>`, ms: 620 })
          .then(() => kit.bubble(c, 'Added to inventory (you already had it).', { place: 'above', ms: 2200 }));
      });
    }

    // Turn in quest
    const turn = row.querySelector('.quest__turnin');
    const markDone = () => {
      row.classList.add('is-done');
      if (turn) { turn.disabled = true; turn.textContent = 'Turned in ✓'; }
      refreshCounts();
    };
    if (P.quests[id] === 'done') markDone();
    turn?.addEventListener('click', () => {
      if (P.quests[id] === 'done' || !game()) return;
      P.quests[id] = 'done';
      kit.burst(turn, { n: kit.rm() ? 0 : 20, kind: 'coin' });
      if (kit.rm()) kit.float(turn, '+10 XP · +5 ◈');
      kit.sfx('coin');
      progress.award({ id: `turnin-${id}`, xp: 10, cash: 5, why: 'Quest turned in', from: turn });
      kit.flyTo(turn, hud?.target?.('cash'));
      stampRow(row, true);
      markDone();
      kit.live(`Quest turned in: ${org}.`);
      if (rows.every((r) => P.quests[qid(r)] === 'done')) {
        kit.found('questlog');
        kit.emit('page:sky', { n: 6 });
        kit.toast('Quest log complete', 'Every quest turned in. The trail is complete.', { kind: 'ach', k: 'Quest log' });
      }
    });
  }

  // ---------------------------------------------------------------- Tencent: the voice-controlled teammate
  const mic = $('.quest__mic', card);
  if (mic && !mic.querySelector('svg')) {
    mic.querySelector('.quest__mic-i')?.replaceWith(pixSvg([
      '..XXX..',
      '.XWWWX.',
      '.XWWWX.',
      '.XWWWX.',
      'X.XXX.X',
      '.X...X.',
      '..XXX..',
      '...X...',
      '.XXXXX.',
    ], { X: 'currentColor', W: 'rgba(255,255,255,.35)' }, { scale: 2, cls: 'quest__mic-i' }));
  }
  let talking = false;
  mic?.addEventListener('click', () => {
    if (talking || !game()) return;
    talking = true;
    mic.classList.add('is-live');
    kit.sfx('buddy');
    kit.bubble(mic, 'Teammate: Roger! Moving to the monster.', { place: 'above', ms: 1500 });
    setTimeout(() => {
      kit.bubble(mic, 'Teammate: …which monster?', { place: 'above', ms: 2600 });
      kit.sfx('buddy');
      kit.found('teammate');
      mic.classList.remove('is-live');
      talking = false;
    }, 1500);
  });

  // ---------------------------------------------------------------- Lark: the logo takes flight (×3)
  const larkRow = rows.find((r) => qid(r) === 'lark');
  const hit = larkRow?.querySelector('.quest__logo-hit');
  const tok = larkRow?.querySelector('.token[data-token]');
  const logo = larkRow?.querySelector('.row__logo');
  if (tok && logo && tok.parentElement !== logo) logo.append(tok);
  tok?.addEventListener('click', () => {
    if (progress.token(tok.dataset.token, tok)) { tok.classList.add('is-got'); setTimeout(() => { tok.hidden = true; }, 560); }
  });
  let flown = false;
  hit?.addEventListener('click', () => {
    if (!game() || flown) return;
    logo.classList.remove('is-chirp'); void logo.offsetWidth; logo.classList.add('is-chirp');
    kit.sfx('squeak');
  });
  if (hit) kit.clicks(hit, 3, 2500, () => { if (game() && !flown) { flown = true; flyLark(); } });

  function flyLark() {
    const img = logo.querySelector('img');
    const from = (img || logo).getBoundingClientRect();
    const bitEl = document.querySelector('.bit:not([hidden])');
    const br = bitEl?.getClientRects().length ? bitEl.getBoundingClientRect() : null;
    const cr = card.getBoundingClientRect();
    const to = br && br.bottom > 0 && br.top < innerHeight
      ? { x: br.left + br.width / 2, y: br.top - 6 }
      : { x: cr.right - 40, y: Math.max(cr.top - 60, -40) };
    const bird = h('div', { class: 'qlark', 'aria-hidden': 'true' }, pixSvg(LARK, LARK_PAL, { scale: 2 }));
    const x0 = from.left + from.width / 2, y0 = from.top + from.height / 2;
    bird.style.left = `${x0}px`; bird.style.top = `${y0}px`;
    document.body.append(bird);
    img?.classList.add('is-flown');
    kit.sfx('squeak');
    const dx = to.x - x0, dy = to.y - y0;
    const land = () => {
      if (bitEl && br) {
        const rb = bitEl.getBoundingClientRect();
        bird.remove();
        const perch = h('span', { class: 'qlark qlark--perch', 'aria-hidden': 'true' }, pixSvg(LARK, LARK_PAL, { scale: 2 }));
        perch.style.left = `${rb.width / 2}px`;
        bitEl.append(perch);
        setTimeout(() => perch.remove(), 12000);
      } else {
        bird.classList.add('is-gone');
        setTimeout(() => bird.remove(), 600);
      }
      setTimeout(() => img?.classList.remove('is-flown'), 900);
    };
    if (kit.rm()) { land(); }
    else {
      const a = bird.animate([
        { transform: 'translate(-50%, -50%) scaleX(1)' },
        { transform: `translate(calc(-50% + ${dx * 0.2 - 60}px), calc(-50% + ${-90}px)) scaleX(1)`, offset: 0.3 },
        { transform: `translate(calc(-50% + ${dx * 0.6}px), calc(-50% + ${dy * 0.5 - 80}px)) scaleX(1)`, offset: 0.65 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scaleX(1)` },
      ], { duration: 1200, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'forwards' });
      a.onfinish = land;
    }
    // token t5 drops where it took off
    if (tok && !P.tokens[tok.dataset.token]) {
      tok.hidden = false;
      if (!kit.rm()) tok.classList.add('is-drop');
    }
    setTimeout(() => {
      kit.say('bit', 'It flew toward Library Walk.');
      kit.found('lark');
    }, kit.rm() ? 0 : 1200);
    kit.emit('page:open', { key: 'flag-lark', what: 'lark' });
  }

  // ---------------------------------------------------------------- 3D: picking a flag stamps and opens its quest
  kit.on('pick', ({ id } = {}) => {
    if (!id || !String(id).startsWith('flag-') || !game()) return;
    const row = rows.find((r) => r.dataset.focus === id);
    if (!row) return;
    kit.once(`qstamp:${qid(row)}`);
    stampRow(row, true);
    const d = row.querySelector('details.quest__more');
    if (d && !d.open) d.open = true;
  });

  refreshCounts();
}
