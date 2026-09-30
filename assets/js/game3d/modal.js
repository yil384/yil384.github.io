// Modal stack. Any open modal pauses the world (see index.js), which is what keeps bosses and
// field enemies from attacking during dialogs, shops, battles, panels and mini-games.
import { h, icon } from './util.js';
import { emit } from './bus.js';

const stack = [];
let root = null;

export function initModals(el) {
  root = el;
}

/**
 * openModal({ id, title, variant, className, body, onClose, onKey, dismissible, label })
 *  - body: Node | string (HTML) | (bodyEl, panelEl) => void
 *  - onKey(e): return true when the key was handled
 * Returns { id, el, panel, body, close(), isOpen() }.
 */
export function openModal(opts) {
  const {
    id = `m${Date.now()}`,
    title = '',
    variant = 'center',
    className = '',
    body,
    onClose,
    onKey,
    dismissible = true,
    label,
  } = opts;

  // replacing a modal with the same id (a dialog that leads to another dialog) must not un-pause the
  // world for the moment in between
  const same = stack.findIndex((m) => m.id === id);
  if (same >= 0) closeModal(id, { replacing: true });

  const previousFocus = document.activeElement;
  const panel = h('div', { class: `modal__panel ${className}` });
  const wrap = h('div', {
    class: `modal modal--${variant}`,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': label || title || 'Dialog',
  });

  if (title || dismissible) {
    panel.append(h('div', { class: 'modal__head' },
      title ? h('h2', { class: 'modal__title' }, title) : h('span'),
      dismissible ? h('button', { type: 'button', class: 'modal__x', 'aria-label': 'Close', onclick: () => closeModal(id) }, icon('x', { size: 16 })) : null,
    ));
  }
  const bodyEl = h('div', { class: 'modal__body' });
  panel.append(bodyEl);
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body instanceof Node) bodyEl.append(body);
  else if (typeof body === 'function') body(bodyEl, panel);

  wrap.append(panel);
  if (dismissible) wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) closeModal(id); });
  root.append(wrap);
  void wrap.offsetWidth; // commit the closed state so the open transition plays
  wrap.classList.add('is-open');

  const entry = { id, wrap, panel, body: bodyEl, onClose, onKey, dismissible, previousFocus };
  stack.push(entry);
  if (stack.length === 1) emit('pause', true);

  setTimeout(() => {
    if (!wrap.isConnected) return;
    const target = panel.querySelector('[autofocus], input, .modal__primary, button:not(.modal__x)') || panel.querySelector('button');
    target?.focus({ preventScroll: true });
  }, 30);

  return {
    id,
    el: wrap,
    panel,
    body: bodyEl,
    close: () => closeModal(id),
    isOpen: () => stack.includes(entry),
  };
}

export function closeModal(id, { replacing = false } = {}) {
  const idx = id == null ? stack.length - 1 : stack.findIndex((m) => m.id === id);
  if (idx < 0) return;
  const wasTop = idx === stack.length - 1;
  const [entry] = stack.splice(idx, 1);
  entry.wrap.classList.remove('is-open');
  entry.wrap.classList.add('is-closing');
  setTimeout(() => entry.wrap.remove(), 160);
  try { entry.onClose?.(); } catch (err) { console.error(err); }
  // Only hand focus back when the closed modal was on top; a modal opened from this one
  // (dialog -> mini-game) keeps its focus.
  if (wasTop && entry.previousFocus && document.contains(entry.previousFocus)) {
    entry.previousFocus.focus?.({ preventScroll: true });
  }
  if (stack.length === 0 && !replacing) emit('pause', false);
}

export function closeAllModals() {
  while (stack.length) closeModal();
}

export const modalOpen = () => stack.length > 0;
export const isModalOpen = (id) => stack.some((m) => m.id === id);

/** Route a keydown to the top-most modal. Returns true if consumed. */
export function modalKey(e) {
  const top = stack[stack.length - 1];
  if (!top) return false;
  if (top.onKey && top.onKey(e)) return true;
  if (e.key === 'Escape' && top.dismissible) {
    closeModal(top.id);
    return true;
  }
  return false;
}
