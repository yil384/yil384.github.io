// Toasts and centre-screen banners inside the overlay.
import { h, icon } from './util.js';

const MAX_TOASTS = 4;
let root = null;
let bannerEl = null;

export function initNotify(hud) {
  root = h('div', { class: 'g__toasts', 'aria-live': 'polite' });
  bannerEl = h('div', { class: 'g__banner', 'aria-live': 'polite' });
  hud.append(root, bannerEl);
}

/** toast(text, { icon: 'coins', tone: 'good' | 'gold' | 'bad' }) */
export function toast(text, { icon: name = 'sparkle', tone = '' } = {}) {
  if (!root) return;
  while (root.children.length >= MAX_TOASTS) root.firstElementChild.remove();
  const el = h('div', { class: `toast${tone ? ` toast--${tone}` : ''}` }, icon(name, { size: 18, cls: 'toast__icon' }), h('span', { class: 'toast__text' }, text));
  root.append(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  setTimeout(() => {
    el.classList.remove('is-in');
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 300);
  }, 2800 + Math.min(2000, text.length * 18));
}

let bannerTimer = 0;
export function banner(title, sub = '', name = '') {
  if (!bannerEl) return;
  bannerEl.replaceChildren(
    name ? icon(name, { size: 30, cls: 'banner__icon' }) : '',
    h('div', { class: 'banner__title' }, title),
    sub ? h('div', { class: 'banner__sub' }, sub) : '',
  );
  bannerEl.classList.remove('is-in');
  void bannerEl.offsetWidth;
  bannerEl.classList.add('is-in');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => bannerEl.classList.remove('is-in'), 3200);
}
