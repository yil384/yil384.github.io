// Small shared helpers for the island.

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (lo, hi) => lo + Math.random() * (hi - lo);
export const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

/**
 * Tiny element builder: h('div', { class: 'x', onclick: fn }, 'text', child)
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [prop, val] of Object.entries(v)) {
          if (prop.startsWith('--')) el.style.setProperty(prop, val);
          else el.style[prop] = val;
        }
      }
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// Interface icons come from Lucide (assets/icons/ui); everything game-flavoured from
// game-icons.net (assets/icons/game). Both sets are single-colour SVGs tinted with CSS.
const UI = new Set([
  'arrow-up-right', 'backpack', 'book-open', 'briefcase', 'building-2', 'check', 'chevron-down', 'circle-help', 'cpu',
  'download', 'external-link', 'eye', 'file-code-2', 'file-text', 'flask-conical', 'gamepad-2', 'gauge', 'graduation-cap',
  'heart-plus', 'hourglass', 'keyboard', 'link', 'list-checks', 'lock', 'mail', 'map-pin', 'maximize-2', 'menu',
  'messages-square', 'minimize-2', 'mouse-pointer-click', 'paw-print', 'phone', 'play', 'rotate-ccw', 'scroll-text',
  'shield-check', 'sparkle', 'square', 'swords', 'triangle-alert', 'trophy', 'volume-2', 'volume-x', 'x',
]);
export const iconUrl = (name) => `assets/icons/${UI.has(name) ? 'ui' : 'game'}/${name}.svg`;

/** An inline icon <img>. Decorative by default; pass a label to make it meaningful. */
export function icon(name, { size = 18, cls = '', label = '' } = {}) {
  return h('img', { class: `ico${cls ? ` ${cls}` : ''}`, src: iconUrl(name), alt: label, width: size, height: size, draggable: 'false' });
}

export function isEditable(target) {
  if (!target || !(target instanceof Element)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

export function fmt(n) {
  return Math.round(n).toLocaleString('en-US');
}
