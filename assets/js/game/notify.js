// Toasts and centre-screen banners. Dependency-free so any system can notify.
import { h } from './util.js';

const MAX_TOASTS = 4;

export function toast(text, { icon = '✦', tone = '' } = {}) {
  const root = document.getElementById('toasts');
  if (!root) return;
  while (root.children.length >= MAX_TOASTS) root.firstElementChild.remove();
  const el = h('div', { class: `toast${tone ? ` toast--${tone}` : ''}` },
    h('span', { class: 'toast__icon', 'aria-hidden': 'true' }, icon),
    h('span', { class: 'toast__text' }, text),
  );
  root.append(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  setTimeout(() => {
    el.classList.remove('is-in');
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 300);
  }, 2800 + Math.min(2000, text.length * 18));
}

let bannerTimer = 0;
export function banner(title, sub = '', icon = '') {
  let el = document.getElementById('banner');
  if (!el) {
    el = h('div', { id: 'banner', class: 'banner', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.innerHTML = '';
  el.append(
    icon ? h('div', { class: 'banner__icon' }, icon) : '',
    h('div', { class: 'banner__title' }, title),
    sub ? h('div', { class: 'banner__sub' }, sub) : '',
  );
  el.classList.remove('is-in');
  void el.offsetWidth;
  el.classList.add('is-in');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.classList.remove('is-in'), 3200);
}
