// ui/equip.js: PROJECTS as equipment cards (SPEC §4.7, SECTIONS-C).
// Facts stay the static HTML of index.html (title, link, sub, description, tech icons, the back text).
// This module adds game-only feedback: pixel item icons, pointer tilt, the Inspect flip (E key), Equip +
// the loadout bar, and one simulated "special move" per project that prints into a small terminal:
// Boot (kernel panic if interrupted), Ping (keep-alive), Submit (an online-judge verdict sequence that
// also flips the 3D board) and Run (CUDA OOM, then compiled). Nothing here shows benchmark numbers.
import { pixSvg } from './pubs.js';
import { save } from './pstate.js';

// ---------------------------------------------------------------- pixel art (fill only; outline added)
/** Adds a 1-cell dark outline ('o') around every filled cell (4-neighbours) of a pixel grid. */
export function outlined(rows) {
  const g = rows.map((r) => r.split(''));
  const H = g.length, W = Math.max(...rows.map((r) => r.length));
  const filled = (x, y) => y >= 0 && y < H && x >= 0 && x < W && g[y][x] && g[y][x] !== '.' && g[y][x] !== 'o';
  const out = g.map((r) => r.slice());
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (filled(x, y)) continue;
      if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) out[y][x] = 'o';
    }
  }
  return out.map((r) => r.join(''));
}

export const ART = {
  sword: {
    rows: [
      '................',
      '..............W.',
      '.............WS.',
      '............WSD.',
      '...........WSD..',
      '..........WSD...',
      '.........WSD....',
      '........WSD.....',
      '.......WSD......',
      '..Gg..WSD.......',
      '...GgWSD........',
      '....GRg.........',
      '...B.Gg.........',
      '..B...G.........',
      '.PP.............',
      '.P..............',
    ],
    pal: { W: '#ffffff', S: '#cbd5e1', D: '#7c8aa5', G: '#FFCD00', g: '#b8860b', R: '#c084fc', B: '#7c4a1e', P: '#B58CFF', o: '#0b1020' },
  },
  shield: {
    rows: [
      '................',
      '..SSSSSSSSSSSS..',
      '..SLLLLLBBBBBS..',
      '..SLLLLLBBBBBS..',
      '..SLLLLGBBBBBS..',
      '..SLLLGGGBBBBS..',
      '..SLLGGYGGBBBS..',
      '..SLLLGGGBBBBS..',
      '..SLLLLGBBBBBS..',
      '...SLLLLBBBBS...',
      '...SLLLLBBBBS...',
      '....SLLLBBBS....',
      '.....SLLBBS.....',
      '......SLBS......',
      '.......SS.......',
      '................',
    ],
    pal: { S: '#dbe4f3', L: '#5FB3FF', B: '#2f6fd6', G: '#FFCD00', Y: '#fff3b0', o: '#0b1020' },
  },
  gavel: {
    rows: [
      '................',
      '................',
      '..MwWWWWwM......',
      '..MwWWWWwM......',
      '..MwWWWWwM......',
      '..MwwwwwwM......',
      '......hw........',
      '.......hw.......',
      '........hw......',
      '.........hw.....',
      '..........hw....',
      '...........hw...',
      '..BBBBBB....hw..',
      '.BbbbbbbB.......',
      '.BBBBBBBB.......',
      '................',
    ],
    pal: { W: '#d8a060', w: '#9a5a2a', h: '#e0b27a', M: '#FFCD00', B: '#2f6fd6', b: '#5FB3FF', o: '#0b1020' },
  },
  trident: {
    rows: [
      '................',
      '...W...WW...W...',
      '...Y...YY...Y...',
      '..YY...YY...YY..',
      '...Yy..YY..yY...',
      '...YYYYYYYYYY...',
      '....yYYYYYYy....',
      '.......YY.......',
      '.......NN.......',
      '.......NN.......',
      '......GGGG......',
      '.......NN.......',
      '.......NN.......',
      '.......NN.......',
      '.......GG.......',
      '................',
    ],
    pal: { W: '#fffbe0', Y: '#FFCD00', y: '#b8860b', N: '#22406e', G: '#FFCD00', o: '#0b1020' },
  },
  wrench: {
    rows: [
      '............',
      '......S..S..',
      '......S..S..',
      '......SSSS..',
      '.......SS...',
      '......SS....',
      '.....SS.....',
      '....SS......',
      '...SS.......',
      '..SS........',
      '............',
    ],
    pal: { S: '#cbd5e1', o: '#0b1020' },
  },
  pigeon: {
    rows: [
      '............',
      '...ww.......',
      '....www.....',
      '.....www.HH.',
      '..GGGGGGGNeA',
      '.TGGGGGGGGH.',
      'TT.GGGGGG...',
      '....p..p....',
    ],
    pal: { w: '#e2e8f0', G: '#94a3b8', H: '#64748b', N: '#2dd4bf', e: '#0b1020', A: '#f59e0b', T: '#475569', p: '#f472b6' },
  },
};
/** A crisp pixel icon (svg) by name. */
export function icon(name, scale = 2, cls = '') {
  const a = ART[name];
  if (!a) return null;
  return pixSvg(a.noOutline ? a.rows : outlined(a.rows), a.pal, { scale, cls });
}

/** A CUDA OOM Golem head peeks in from the right edge of `box` for ~1.5s (decorative). */
export function golemPeek(kit, box) {
  if (!box?.isConnected || kit.rm()) return;
  if (box.querySelector(':scope > .golem-peek')) return;
  const g = kit.h('span', { class: 'golem-peek', 'aria-hidden': 'true', 'data-game': '' }, kit.spriteImg('golem', 2));
  box.append(g);
  setTimeout(() => g.remove(), 1700);
}

// ---------------------------------------------------------------- verdicts (colours = landmarks.js VERDICTS)
// landmarks.js imports three.js, so it is only imported when the 3D world is already running; without the
// world this identical copy is used (so a phone without WebGL never downloads three.js for a joke).
const VERDICTS_FALLBACK = [
  { text: 'Accepted', colour: '#4ade80', ok: true },
  { text: 'Wrong Answer on test 3', colour: '#f87171' },
  { text: 'Time Limit Exceeded', colour: '#fbbf24' },
  { text: 'Runtime Error (SIGSEGV)', colour: '#fb7185' },
  { text: 'Memory Limit Exceeded', colour: '#c084fc' },
  { text: 'Compile Error', colour: '#94a3b8' },
];
let VERDICTS = VERDICTS_FALLBACK;
let verdictsTried = false;
function loadVerdicts(kit) {
  if (verdictsTried || !kit.world()) return;
  verdictsTried = true;
  import('../../game3d/landmarks.js').then((m) => { if (Array.isArray(m.VERDICTS) && m.VERDICTS.length) VERDICTS = m.VERDICTS; }).catch(() => {});
}
const verdict = (name) => VERDICTS.find((v) => v.text.startsWith(name)) || VERDICTS_FALLBACK.find((v) => v.text.startsWith(name));

const RARITY_HEX = { common: '#9aa4b8', rare: '#5FB3FF', epic: '#B58CFF', legendary: '#FFCD00' };
const wait = (kit, ms) => new Promise((r) => setTimeout(r, kit.rm() ? Math.min(ms, 60) : ms));

export function init(ctx) {
  const { kit, progress, P } = ctx;
  const { $, $$, h } = kit;
  const sec = $('#projects');
  if (!sec) return;
  const items = $$('.equip__item', sec);
  if (!items.length) return;
  const game = () => kit.isGame();
  const byKey = new Map(items.map((li) => [li.dataset.focus, li]));
  const loadout = $('.loadout', sec);
  const fine = matchMedia('(pointer: fine)');
  if (!Array.isArray(P.equipped)) P.equipped = [];

  // ---- loadout bar extras: slot silhouettes + the set-bonus line
  let bonus = null;
  if (loadout && !loadout.querySelector('.loadout__bonus')) {
    for (const s of $$('.loadout__slot', loadout)) {
      const li = byKey.get(s.dataset.slot);
      const name = li?.querySelector('.row__title')?.firstChild?.textContent?.trim() || '';
      s.title = name;
      s.dataset.name = name;
    }
    bonus = h('span', { class: 'loadout__bonus', 'aria-live': 'polite' });
    loadout.append(bonus);
  }
  const renderBonus = () => {
    if (!bonus) return;
    const n = P.equipped.filter((k) => byKey.has(k)).length;
    bonus.textContent = n >= byKey.size ? 'Full set bonus: +10% chance a reviewer reads the appendix.' : `Set bonus ${n}/${byKey.size}`;
    loadout.classList.toggle('is-full', n >= byKey.size);
  };

  for (const li of items) {
    const key = li.dataset.focus;
    const card = li.querySelector('.equip__card');
    const front = li.querySelector('.equip__front');
    const back = li.querySelector('.equip__back');
    const iconEl = li.querySelector('.equip__icon');
    const btnInspect = li.querySelector('[data-act="inspect"]');
    const btnEquip = li.querySelector('[data-act="equip"]');
    const btnMove = li.querySelector('[data-act="move"]');
    const btnBack = li.querySelector('[data-act="back"]');
    const term = li.querySelector('.equip__term');
    const slot = loadout?.querySelector(`[data-slot="${key}"]`);
    const id = (back?.id || key).replace(/^back-/, '');
    if (!card || !front) continue;
    li.style.setProperty('--rarity', `var(--r-${li.dataset.rarity === 'legendary' ? 'legend' : li.dataset.rarity || 'common'})`);

    // ---- icon, E badge, and a mirrored strip + watermark on the back face
    const iconName = iconEl?.dataset.icon;
    if (iconEl && !iconEl.firstChild && ART[iconName]) iconEl.append(icon(iconName, 2));
    const strip = li.querySelector('.equip__rarity');
    const rarityLabel = strip?.textContent.trim() || '';
    if (strip && !strip.querySelector('.equip__badge')) {
      strip.prepend(h('i', { class: 'equip__gem' }));
      strip.append(h('span', { class: 'equip__badge', title: 'Equipped' }, 'E'));
    }
    if (back && !back.querySelector('.equip__wm') && ART[iconName]) {
      back.prepend(h('p', { class: 'equip__rarity equip__rarity--back game-only', 'aria-hidden': 'true' }, h('i', { class: 'equip__gem' }), `${rarityLabel} · Inspect`));
      back.append(h('span', { class: 'equip__wm', 'data-game': '', 'aria-hidden': 'true' }, icon(iconName, 5)));
    }

    if (li.dataset.rarity === 'legendary' && !front.querySelector('.equip__glint')) front.append(h('span', { class: 'equip__glint', 'data-game': '', 'aria-hidden': 'true' }));

    // ---- tilt (pointer:fine, not reduced motion; rAF only while hovered; rect measured on enter)
    let rect = null, raf = 0, lx = 0, ly = 0, tilting = false;
    const applyTilt = () => {
      raf = 0;
      if (!tilting || !rect) return;
      const px = Math.max(0, Math.min(1, (lx - rect.left) / rect.width));
      const py = Math.max(0, Math.min(1, (ly - rect.top) / rect.height));
      li.style.setProperty('--rx', `${((0.5 - py) * 10).toFixed(2)}deg`);
      li.style.setProperty('--ry', `${((px - 0.5) * 12).toFixed(2)}deg`);
      li.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
      li.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
    };
    li.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || !fine.matches || kit.rm() || !game()) return;
      rect = card.getBoundingClientRect();
      tilting = true;
      li.classList.add('is-tilt');
    });
    li.addEventListener('pointermove', (e) => {
      if (!tilting) return;
      lx = e.clientX; ly = e.clientY;
      if (!raf) raf = requestAnimationFrame(applyTilt);
    });
    li.addEventListener('pointerleave', () => {
      if (!tilting) return;
      tilting = false;
      cancelAnimationFrame(raf); raf = 0;
      li.classList.remove('is-tilt');
      for (const v of ['--rx', '--ry', '--gx', '--gy']) li.style.removeProperty(v);
    });

    // ---- Inspect / Back: flip; the hidden face leaves the tab order (both stay readable to AT)
    const focusables = (face) => $$('a[href], button', face);
    const setFaceTab = (face, on) => {
      for (const el of focusables(face)) {
        if (!on) { if (!el.hasAttribute('data-tab')) el.setAttribute('data-tab', el.getAttribute('tabindex') ?? ''); el.tabIndex = -1; }
        else if (el.hasAttribute('data-tab')) { const t = el.getAttribute('data-tab'); if (t === '') el.removeAttribute('tabindex'); else el.setAttribute('tabindex', t); el.removeAttribute('data-tab'); }
      }
    };
    const flipped = () => card.classList.contains('is-flipped');
    const flip = (on, { focus = true, from = btnInspect, force = false } = {}) => {
      if ((!game() && !force) || on === flipped()) return;
      card.classList.toggle('is-flipped', on);
      li.classList.add('is-flipping');
      clearTimeout(li._flipT);
      li._flipT = setTimeout(() => li.classList.remove('is-flipping'), 560);
      btnInspect?.setAttribute('aria-expanded', String(on));
      if (back) setFaceTab(back, on);
      setFaceTab(front, !on);
      if (force) return;
      kit.sfx('flip');
      if (on) {
        progress.markOpened(`equip-${id}`, from || li);
        kit.emit('page:open', { key, what: 'inspect' });
        kit.echo();
        if (focus) setTimeout(() => btnBack?.focus({ preventScroll: true }), kit.rm() ? 0 : 200);
        kit.live(`${li.querySelector('.row__title')?.firstChild?.textContent?.trim() || 'Project'}: details.`);
      } else if (focus) setTimeout(() => btnInspect?.focus({ preventScroll: true }), kit.rm() ? 0 : 200);
    };
    if (back) setFaceTab(back, false);
    btnInspect?.addEventListener('click', () => flip(!flipped()));
    btnBack?.addEventListener('click', () => flip(false));
    kit.primary(li, () => flip(!flipped()));
    back?.addEventListener('keydown', (e) => { if (e.key === 'Escape' && flipped()) { e.stopPropagation(); flip(false); } });
    li._flip = flip;

    // ---- Equip / unequip
    const renderEquip = (on) => {
      btnEquip?.setAttribute('aria-pressed', String(on));
      if (btnEquip) btnEquip.textContent = on ? 'Equipped' : 'Equip';
      li.classList.toggle('is-equipped', on);
      if (slot) {
        slot.classList.toggle('is-on', on);
        slot.replaceChildren(...(on && ART[iconName] ? [icon(iconName, 2)] : []));
      }
    };
    renderEquip(P.equipped.includes(key));
    btnEquip?.addEventListener('click', async () => {
      if (!game()) return;
      const on = !P.equipped.includes(key);
      P.equipped = on ? [...P.equipped.filter((k) => k !== key), key] : P.equipped.filter((k) => k !== key);
      save();
      if (on) {
        kit.sfx('purchase');
        btnEquip.setAttribute('aria-pressed', 'true');
        btnEquip.textContent = 'Equipped';
        li.classList.add('is-equipped');
        await kit.flyTo(iconEl || btnEquip, slot, { html: iconEl?.innerHTML });
        renderEquip(true);
        kit.burst(slot || btnEquip, { n: 6, kind: 'spark', colors: ['#FFCD00', RARITY_HEX[li.dataset.rarity] || '#ffffff'] });
      } else {
        kit.sfx('pop');
        renderEquip(false);
      }
      kit.emit('page:equip', { key, on });
      kit.echo();
      renderBonus();
      const n = P.equipped.filter((k) => byKey.has(k)).length;
      kit.live(on ? `Equipped. ${n} of ${byKey.size}.` : 'Unequipped.');
      if (on && n >= byKey.size) {
        kit.found('loadout');
        kit.burst(loadout, { n: 16, kind: 'confetti' });
      }
    });

    // ---- the special move + its terminal
    if (!btnMove || !term) continue;
    term.setAttribute('aria-live', 'off'); // typed char by char: announce outcomes through kit.live instead
    term.setAttribute('aria-label', 'Simulated output');
    let seq = 0;
    const show = () => { if (term.hidden) { term.hidden = false; li.classList.add('has-term'); } };
    const clear = () => term.replaceChildren();
    const trim = (max = 5) => { while (term.children.length > max) (term.querySelector(':scope > :not(.tl--pin)') || term.firstElementChild).remove(); };
    const line = (text, cls = '', { type = true, cps = 70, max = 5, title } = {}) => {
      const s = h('span', { class: ['tl', ...cls.split(/\s+/).filter(Boolean).map((c) => `tl--${c}`)].join(' '), title });
      term.append(s);
      trim(max);
      if (!type) { s.textContent = text; return Promise.resolve(s); }
      return kit.typewriter(s, text, { cps }).then(() => s);
    };
    const move = MOVES[btnMove.textContent.trim().toLowerCase()];
    if (!move) continue;
    const env = { kit, progress, P, li, term, btnMove, line, show, clear, trim, next: () => ++seq, alive: (my) => my === seq, id, key };
    move.setup?.(env);
    btnMove.addEventListener('click', () => { if (game()) move.run(env); });
  }
  renderBonus();

  // ---- 3D: picking a monitor flips its card to the back
  kit.on('pick', ({ id } = {}) => {
    const li = byKey.get(id);
    if (li && game()) li._flip?.(true, { focus: false, from: li });
  });
  // ---- Reviewer mode: every card back to its front (so no link keeps tabindex=-1)
  ctx.mode?.onMode?.((st) => { if (st?.plain) for (const li of items) li._flip?.(false, { focus: false, force: true }); });
  // ---- New Game+: loadout empties
  kit.on('page:ngplus', () => {
    for (const li of items) {
      li.classList.remove('is-equipped');
      const b = li.querySelector('[data-act="equip"]');
      b?.setAttribute('aria-pressed', 'false');
      if (b) b.textContent = 'Equip';
    }
    for (const s of $$('.loadout__slot', sec)) { s.classList.remove('is-on'); s.replaceChildren(); }
    renderBonus();
  });
}

// ---------------------------------------------------------------- special moves
const MOVES = {
  // Starry-Next: a boot log; interrupting it panics the kernel.
  boot: {
    setup(env) { env.state = { booting: false, panicked: false }; },
    async run(env) {
      const { kit, line, show, clear, state, btnMove, li } = env;
      show();
      if (state.booting) {
        env.next(); // cancel the boot in flight
        state.booting = false;
        state.panicked = true;
        clear();
        line('Kernel panic - not syncing: you clicked too fast', 'err', { type: false });
        line('---[ end Kernel panic - not syncing ]---', 'err dim', { type: false });
        li.classList.remove('is-panic'); void li.offsetWidth; li.classList.add('is-panic');
        setTimeout(() => li.classList.remove('is-panic'), 900);
        kit.sfx('error');
        btnMove.textContent = 'Reboot';
        kit.live('Kernel panic (simulated): you clicked too fast. Click Reboot.');
        kit.found('panic');
        return;
      }
      const my = env.next();
      state.booting = true;
      btnMove.textContent = 'Boot';
      clear();
      await line(state.panicked ? '# simulated · rebooting cleanly' : '# simulated', 'dim', { type: false });
      state.panicked = false;
      const log = ['[ 0.000] Starry-Next: booting', '[ 0.012] net: bringing up the stack', '[ 0.020] net: eth0 up', '[ 0.031] hello from ring 0'];
      for (const l of log) {
        await kit.typewriter(await line('', l.endsWith('ring 0') ? 'ok' : '', { type: false }), l, { cps: 55 });
        if (!env.alive(my)) return;
        await wait(kit, 180);
        if (!env.alive(my)) return;
      }
      state.booting = false;
      kit.live('Starry-Next booted (simulated): hello from ring 0.');
    },
  },

  // IM System: WebSocket ping / pong; the tenth ping upgrades the connection.
  ping: {
    setup(env) { env.state = { n: 0, busy: false }; },
    async run(env) {
      const { kit, line, show, state, btnMove } = env;
      if (state.busy) return;
      state.busy = true;
      show();
      state.n++;
      if (state.n === 1) await line('# simulated · GET /ws → 101 Switching Protocols', 'dim pin', { type: false, max: 5 });
      await line('ping', 'you', { type: false, max: 5 });
      await wait(kit, 260);
      const ms = 8 + Math.floor(Math.random() * 33);
      await line(`pong (${ms} ms)`, 'srv', { type: false, max: 5, title: 'Illustrative latency, not a measurement' });
      kit.sfx('pop');
      if (state.n === 10) {
        await wait(kit, 200);
        await line('connection upgraded to friendship ♥', 'srv heart', { type: false, max: 5 });
        kit.burst(btnMove, { n: 8, kind: 'heart' });
        kit.live('Server: connection upgraded to friendship.');
        kit.found('pingpong');
      } else if (state.n % 3 === 1) kit.live(`Pong, ${ms} milliseconds (illustrative).`);
      state.busy = false;
    },
  },

  // CST-OJ: pending → compiling → running → a verdict. The first is always WA on test 3; Accepted is
  // guaranteed between the 5th and 8th submission (seeded by the first visit).
  submit: {
    setup(env) {
      const seed = (env.P.firstVisit | 0) || Date.now();
      env.state = { n: 0, busy: false, acAt: 5 + (Math.abs(seed) % 4), accepted: false };
      const tok = env.li.querySelector('.token[data-token]');
      if (tok) {
        tok.addEventListener('click', () => {
          if (env.progress.token(tok.dataset.token, tok)) { tok.classList.add('is-got'); setTimeout(() => { tok.hidden = true; }, 560); }
        });
      }
    },
    async run(env) {
      const { kit, progress, line, show, clear, state, li, P } = env;
      if (state.busy) return;
      loadVerdicts(kit);
      state.busy = true;
      const my = env.next();
      show(); clear();
      state.n++;
      await line(`# simulated · submission #${state.n}`, 'dim', { type: false });
      const st = await line('Pending…', 'warn', { type: false });
      await wait(kit, 400); if (!env.alive(my)) return;
      st.textContent = 'Compiling…';
      await wait(kit, 500); if (!env.alive(my)) return;
      for (let t = 1; t <= 3; t++) { st.textContent = `Running on test ${t}…`; kit.sfx('tick'); await wait(kit, 280); }
      let v;
      if (state.n === 1) v = verdict('Wrong Answer');
      else if (!state.accepted && state.n >= state.acAt) v = verdict('Accepted');
      else if (state.accepted && Math.random() < 0.34) v = verdict('Accepted');
      else v = verdict(['Time Limit', 'Runtime Error', 'Memory Limit', 'Wrong Answer'][Math.floor(Math.random() * 4)]);
      st.textContent = v.ok ? 'Judged · 3 of 3 tests passed' : 'Judged · stopped on test 3';
      const badge = kit.h('span', { class: `tl tl--verdict${v.ok ? ' is-ok' : ''}`, style: { '--v': v.colour } }, kit.h('b', null, v.text));
      env.term.append(badge);
      kit.emit('page:judge', { text: v.text, colour: v.colour, ok: !!v.ok });
      kit.echo();
      kit.live(`Verdict (simulated): ${v.text}.`);
      if (v.ok) {
        kit.sfx('victory');
        kit.burst(badge, { n: 24, kind: 'confetti' });
        progress.award({ id: 'oj-ac', xp: 20, cash: 5, why: 'Accepted', from: badge });
        const tok = li.querySelector('.token[data-token]');
        if (tok && tok.hidden && !P.tokens[tok.dataset.token]) {
          tok.hidden = false;
          if (!kit.rm()) { tok.classList.remove('is-drop'); void tok.offsetWidth; tok.classList.add('is-drop'); }
        }
        state.accepted = true;
        kit.found('accepted');
      } else {
        kit.sfx('error');
        if (v.text.startsWith('Wrong')) kit.found('judge');
      }
      state.busy = false;
    },
  },

  // TritonGym: an agent submits a kernel; the first run runs out of memory, the second compiles.
  run: {
    setup(env) { env.state = { n: 0, busy: false }; },
    async run(env) {
      const { kit, line, show, clear, state, li } = env;
      if (state.busy) return;
      state.busy = true;
      const my = env.next();
      show(); clear();
      state.n++;
      await line('# simulated', 'dim', { type: false, max: 6 });
      for (const [t, c] of [['@triton.jit', 'kw'], ['def add_kernel(x_ptr, y_ptr, out_ptr, n, BLOCK: tl.constexpr):', ''], ['    ...', 'dim'], ['agent: submitting kernel…', 'warn']]) {
        await line(t, c, { cps: 90, max: 6 });
        if (!env.alive(my)) return;
      }
      await wait(kit, 420);
      if (state.n === 1) {
        await line('RuntimeError: CUDA out of memory', 'err', { type: false, max: 6 });
        kit.sfx('boom');
        golemPeek(kit, li.querySelector('.equip__front'));
        kit.emit('page:oom');
        kit.live('Simulated: CUDA out of memory. Try again.');
      } else {
        await line('compiled ✓ · results: see the paper (under review)', 'ok', { type: false, max: 6 });
        const go = kit.h('button', { type: 'button', class: 'gbtn gbtn--sm tl__btn' }, 'Read the paper card ↑');
        go.addEventListener('click', () => {
          const pub = document.getElementById('pub-tritongym');
          if (!pub) return;
          pub.scrollIntoView({ block: 'center', behavior: kit.rm() ? 'auto' : 'smooth' });
          pub.focus({ preventScroll: true });
        });
        const s = kit.h('span', { class: 'tl' }, go);
        env.term.append(s);
        env.trim(7);
        kit.sfx('victory');
        kit.live('Simulated: compiled. Results are in the paper, under review.');
        kit.found('jit');
      }
      state.busy = false;
    },
  },
};
