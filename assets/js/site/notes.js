// Field Notes: the panel listing every egg, found ones spelled out, unfound ones as riddles.
import { EGGS, has, foundCount, total, available, eggIcon, onChange, found } from './eggs.js';

let root = null;
let list = null;
let meter = null;
let bar = null;
let sub = null;

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
      <div class="notes__meter"><span class="notes__count"></span><span class="notes__bar"><i></i></span></div>
      <div class="notes__list"></div>
      <p class="notes__foot">Eggs are saved in this browser. Some need the 3D island, some need you to take the controls (W A S D).</p>
    </div>`;
  document.body.append(root);
  list = root.querySelector('.notes__list');
  meter = root.querySelector('.notes__count');
  bar = root.querySelector('.notes__bar');
  sub = root.querySelector('.notes__sub');
  root.querySelector('.notes__x').addEventListener('click', closeNotes);
  root.addEventListener('mousedown', (e) => { if (e.target === root) closeNotes(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('is-open')) closeNotes(); });
  onChange(render);
}

function render() {
  if (!root) return;
  const avail = new Set(available().map((e) => e.id));
  const n = foundCount(), t = total();
  meter.textContent = `${n} / ${t}`;
  bar.style.setProperty('--p', t ? (n / t).toFixed(3) : 0);
  sub.textContent = n === 0 ? 'Do you like green eggs? Nothing found yet.' : n === t ? 'Every egg. You are unstoppable.' : 'Hints are riddles. Found eggs get the joke explained.';
  list.replaceChildren(...EGGS.filter((e) => avail.has(e.id) || has(e.id)).map((e) => {
    const f = has(e.id);
    const li = document.createElement('div');
    li.className = `note${f ? ' is-found' : ''}`;
    const body = document.createElement('div');
    body.innerHTML = '<div class="note__t"></div><div class="note__s"></div>';
    body.firstChild.textContent = f ? e.name : '? ? ?';
    body.lastChild.textContent = f ? e.done : e.hint;
    li.append(eggIcon(), body);
    return li;
  }));
}

let prevFocus = null;
export function openNotes() {
  if (!root) build();
  render();
  prevFocus = document.activeElement;
  root.classList.add('is-open');
  root.querySelector('.notes__x').focus({ preventScroll: true });
  found('notes');
}
export function closeNotes() {
  root?.classList.remove('is-open');
  prevFocus?.focus?.({ preventScroll: true });
}
