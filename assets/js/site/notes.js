// Field Notes: two tabs. Eggs lists every egg (grouped Page / World / Game; found ones spelled out,
// unfound ones as riddles). Progress shows the visitor's run on the page: level, meters, chapters,
// details, quests, tokens, critters, time, and the settings (Reviewer mode, reduced motion, critters,
// sound, New Game+, reset).
import { S, resetSave } from '../game3d/state.js';
import { setSound } from '../game3d/audio.js';
import { emit } from '../game3d/bus.js';
import { EGGS, has, foundCount, total, available, eggIcon, onChange, found } from './eggs.js';
import { P, save, canPersist } from './ui/pstate.js';
import * as progress from './ui/progress.js';

let root = null;
let tab = 'eggs';
let els = {};
let confirmNg = false;
let confirmReset = false;

const CHAPTERS = [['about', 'about', 'About'], ['edu', 'education', 'Education'], ['library', 'publications', 'Publications'], ['trail', 'experience', 'Experience'], ['workshop', 'projects', 'Projects'], ['meadow', 'contact', 'Contact']];
const TOKEN_HINTS = ['one on every trail sign', 'a pan', 'a class change', 'a citation', 'a bird', 'an Accepted'];
const CRITTERS = [['seagull', 'Seagull'], ['offbyone', 'Off-by-one Slime'], ['nan', 'NaN Slime'], ['legacy', 'Legacy Code'], ['segfault', 'Null Pointer']];
const GROUPS = [['page', 'On the page'], ['world', 'On the island'], ['game', 'With the controls']];

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const fmtTime = (ms) => { const s = Math.round(ms / 1000); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h} h ${m} min` : `${m} min ${s % 60} s`; };

function build() {
  root = document.createElement('div');
  root.className = 'notes';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'notes-title');
  root.innerHTML = `
    <div class="notes__panel">
      <div class="notes__head">
        <div><h2 class="notes__title" id="notes-title">Field notes</h2><p class="notes__sub"></p></div>
        <button type="button" class="notes__x" aria-label="Close"><img src="assets/icons/ui/x.svg" alt="" width="16" height="16"></button>
      </div>
      <div class="notes__tabs" role="tablist" aria-label="Field notes">
        <button type="button" role="tab" class="notes__tab" id="notes-tab-eggs" aria-controls="notes-eggs" data-tab="eggs">Eggs</button>
        <button type="button" role="tab" class="notes__tab" id="notes-tab-progress" aria-controls="notes-progress" data-tab="progress">Progress</button>
      </div>
      <div class="notes__pane" id="notes-eggs" role="tabpanel" aria-labelledby="notes-tab-eggs">
        <div class="notes__meter"><span class="notes__count"></span><span class="notes__bar"><i></i></span></div>
        <div class="notes__groups"></div>
        <p class="notes__foot">Eggs are saved in this browser. Some need the 3D island, some need you to take the controls (W A S D).</p>
      </div>
      <div class="notes__pane" id="notes-progress" role="tabpanel" aria-labelledby="notes-tab-progress" hidden></div>
    </div>`;
  document.body.append(root);
  els = {
    groups: root.querySelector('.notes__groups'), meter: root.querySelector('.notes__count'), bar: root.querySelector('.notes__bar'),
    sub: root.querySelector('.notes__sub'), prog: root.querySelector('#notes-progress'), eggs: root.querySelector('#notes-eggs'),
    tabs: [...root.querySelectorAll('.notes__tab')],
  };
  root.querySelector('.notes__x').addEventListener('click', closeNotes);
  root.addEventListener('mousedown', (e) => { if (e.target === root) closeNotes(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('is-open')) closeNotes(); });
  els.tabs.forEach((t) => {
    t.addEventListener('click', () => setTab(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const other = els.tabs.find((x) => x !== t);
      setTab(other.dataset.tab); other.focus();
    });
  });
  onChange(render);
  progress.onProgress(() => { if (root.classList.contains('is-open') && tab === 'progress') renderProgress(); });
}

function setTab(t) {
  tab = t === 'progress' ? 'progress' : 'eggs';
  els.tabs.forEach((b) => { const on = b.dataset.tab === tab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; b.classList.toggle('is-on', on); });
  els.eggs.hidden = tab !== 'eggs';
  els.prog.hidden = tab !== 'progress';
  render();
}

function render() {
  if (!root) return;
  const avail = new Set(available().map((e) => e.id));
  const n = foundCount(), t = total();
  els.meter.textContent = `${n} / ${t}`;
  els.bar.style.setProperty('--p', t ? (n / t).toFixed(3) : 0);
  els.sub.textContent = tab === 'progress'
    ? `Lv ${progress.level()} · ${progress.title()} · a run through this page, saved in this browser.`
    : n === 0 ? 'Do you like green eggs? Nothing found yet.' : n === t ? 'Every egg. You are unstoppable.' : 'Hints are riddles. Found eggs get the joke explained.';
  if (tab === 'eggs') renderEggs(avail); else renderProgress();
}

function renderEggs(avail) {
  els.groups.replaceChildren(...GROUPS.map(([kind, label]) => {
    const list = EGGS.filter((e) => e.kind === kind && (avail.has(e.id) || has(e.id)));
    if (!list.length) return null;
    const sec = el('section', 'notes__group');
    const got = list.filter((e) => has(e.id)).length;
    sec.append(el('h3', 'notes__gh', `${label} · ${got} / ${list.length}`));
    const grid = el('div', 'notes__list');
    grid.append(...list.map((e) => {
      const f = has(e.id);
      const li = el('div', `note${f ? ' is-found' : ''}`);
      const body = el('div');
      body.append(el('div', 'note__t', f ? e.name : '? ? ?'), el('div', 'note__s', f ? e.done : e.hint));
      li.append(eggIcon(), body);
      return li;
    }));
    sec.append(grid);
    return sec;
  }).filter(Boolean));
}

// ---------------------------------------------------------------- progress tab
function meter(label, v, max, cls) {
  const row = el('div', `np__meter ${cls || ''}`);
  const tr = el('span', 'np__track'); const i = el('i'); i.style.setProperty('--v', Math.max(0, Math.min(1, v / max)).toFixed(3)); tr.append(i);
  row.append(el('span', 'np__k', label), tr, el('span', 'np__v', `${Math.round(v)}/${max}`));
  return row;
}
function toggle(label, on, fn, hint) {
  const b = el('button', 'np__toggle');
  b.type = 'button';
  b.setAttribute('aria-pressed', String(!!on));
  b.append(el('span', 'np__sw'), el('span', 'np__tl', label));
  if (hint) b.title = hint;
  b.addEventListener('click', () => { fn(!(b.getAttribute('aria-pressed') === 'true')); renderProgress(); });
  return b;
}
function stat(k, v) { const d = el('div', 'np__stat'); d.append(el('dt', null, k), el('dd', null, v)); return d; }

async function mode() { return import('./ui/mode.js'); }

function renderProgress() {
  const p = els.prog;
  const st = progress.state();
  const lo = progress.THRESHOLDS[st.level - 1];
  const head = el('div', 'np__head');
  const lv = el('div', 'np__lv');
  lv.append(el('span', 'np__lvn', `Lv ${st.level}`), el('span', 'np__lvt', st.title));
  const xpRow = meter('XP', st.next == null ? 1 : st.xp - lo, st.next == null ? 1 : st.next - lo, 'np__meter--xp');
  if (st.next == null) xpRow.querySelector('.np__v').textContent = `${st.xp} XP · max`;
  head.append(lv, xpRow,
    meter('HP', 100, 100, 'np__meter--hp'),
    meter('Focus', Math.max(0, Math.min(100, P.focus | 0)), 100, 'np__meter--focus'));
  const cash = el('p', 'np__cash'); cash.append(el('b', null, `◈ ${st.cash}`), document.createTextNode(' Triton Cash (shared with the island shop; spends on nothing important)'));
  head.append(cash);

  // chapters
  const ch = el('section', 'np__sec');
  ch.append(el('h3', 'notes__gh', `Chapters · ${CHAPTERS.filter(([s]) => P.cleared[s]).length} / 6 cleared`));
  const ul = el('ul', 'np__chapters');
  CHAPTERS.forEach(([shot, id, name], i) => {
    const li = el('li', P.cleared[shot] ? 'is-done' : '');
    li.append(el('span', 'np__box', P.cleared[shot] ? '✓' : ''), el('span', 'np__cn', `${String(i + 1).padStart(2, '0')} · ${name}`));
    const go = el('button', 'np__go', 'Go'); go.type = 'button'; go.setAttribute('aria-label', `Go to ${name}`);
    go.addEventListener('click', () => { closeNotes(); document.getElementById(id)?.scrollIntoView({ block: 'start' }); });
    li.append(go);
    ul.append(li);
  });
  ch.append(ul);

  // run stats
  const quests = Object.values(P.quests || {}).filter((v) => v === 'done').length;
  const tokens = progress.tokenCount();
  const dl = el('dl', 'np__stats');
  dl.append(
    stat('Details opened', `${Object.keys(P.opened).length} / ${progress.DETAILS_TOTAL}`),
    stat('Quests turned in', `${quests} / 5`),
    stat('Triton tokens', `${tokens} / ${progress.TOKENS_TOTAL}`),
    stat('Time on page', fmtTime(P.stats.ms | 0)),
  );
  const tok = el('p', 'np__hint', tokens < progress.TOKENS_TOTAL ? `Tokens hide in plain sight: ${TOKEN_HINTS.join(', ')}…` : 'All twelve tokens. Redeemable for nothing.');
  const bugs = el('ul', 'np__bugs');
  bugs.append(...CRITTERS.map(([k, name]) => { const li = el('li', P.bonks[k] ? 'is-done' : ''); li.append(el('span', null, name), el('b', null, P.bonks[k] ? `×${P.bonks[k]}` : '–')); return li; }));
  const run = el('section', 'np__sec');
  run.append(el('h3', 'notes__gh', 'This run'), dl, tok, el('h3', 'notes__gh', 'Bugs bonked (harmless, all of them)'), bugs);

  // settings
  const html = document.documentElement;
  const set = el('section', 'np__sec');
  set.append(el('h3', 'notes__gh', 'Settings'));
  const tg = el('div', 'np__toggles');
  tg.append(
    toggle('Reviewer mode', html.classList.contains('is-plain'), async (on) => { (await mode()).setPlain(on); renderProgress(); }, 'A plain one-column CV (R)'),
    toggle('Reduce motion', html.classList.contains('rm'), async (on) => { (await mode()).setRm(on); renderProgress(); }),
    toggle('Critters', P.critters !== false, (on) => { P.critters = !!on; save(); emit('page:critters', !!on); }),
    toggle('Sound', !!S.settings.sound, (on) => { S.settings.soundTouched = true; setSound(on); emit('ui:sound', on); }),
  );
  set.append(tg);
  const btns = el('div', 'np__btns');
  if (!confirmNg) {
    const ng = el('button', 'gbtn', 'New Game+'); ng.type = 'button';
    ng.addEventListener('click', () => { confirmNg = true; renderProgress(); btns.querySelector('[data-yes]')?.focus(); });
    btns.append(ng);
  } else {
    const q = el('span', 'np__confirm', 'Reset page progress? Eggs and ◈ are kept. ');
    const y = el('button', 'gbtn gbtn--sm', 'Yes'); y.type = 'button'; y.dataset.yes = '1';
    const n = el('button', 'gbtn gbtn--sm', 'No'); n.type = 'button';
    y.addEventListener('click', () => { confirmNg = false; progress.resetPage(); found('newgame'); renderProgress(); });
    n.addEventListener('click', () => { confirmNg = false; renderProgress(); });
    q.append(y, document.createTextNode(' '), n);
    btns.append(q);
  }
  if (!confirmReset) {
    const r = el('button', 'gbtn gbtn--ghost', 'Reset everything'); r.type = 'button';
    r.addEventListener('click', () => { confirmReset = true; renderProgress(); });
    btns.append(r);
  } else {
    const q = el('span', 'np__confirm np__confirm--red', 'Erase every egg, level and ◈ in this browser? ');
    const y = el('button', 'gbtn gbtn--sm', 'Erase'); y.type = 'button';
    const n = el('button', 'gbtn gbtn--sm', 'Keep'); n.type = 'button';
    y.addEventListener('click', () => { resetSave(); location.reload(); });
    n.addEventListener('click', () => { confirmReset = false; renderProgress(); });
    q.append(y, document.createTextNode(' '), n);
    btns.append(q);
  }
  set.append(btns, el('p', 'notes__foot', canPersist() ? 'Saved in this browser. Nothing leaves it.' : 'Storage is off in this browser: progress lasts for this visit only.'));

  p.replaceChildren(head, ch, run, set);
}

let prevFocus = null;
/** Open Field Notes. { tab: 'eggs' | 'progress' } */
export function openNotes({ tab: t } = {}) {
  if (!root) build();
  setTab(t || tab);
  prevFocus = document.activeElement;
  root.classList.add('is-open');
  root.querySelector('.notes__x').focus({ preventScroll: true });
  found('notes');
}
export function closeNotes() {
  root?.classList.remove('is-open');
  prevFocus?.focus?.({ preventScroll: true });
}
