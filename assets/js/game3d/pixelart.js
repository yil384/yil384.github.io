// 2D renders of the pixel-art grids, for portraits in dialogs, battles and the HUD.
import { ART, VARIANTS } from '../three/art.js';

const cache = new Map();

/** Returns a data URL of the sprite's first frame at 1px per cell. */
export function spriteUrl(name) {
  if (cache.has(name)) return cache.get(name);
  const base = VARIANTS[name] ? VARIANTS[name][0] : name;
  const over = VARIANTS[name] ? VARIANTS[name][1] : null;
  const art = ART[base];
  if (!art) return '';
  const pal = { ...art.pal, ...over };
  const grid = art.frames[0];
  const w = Math.max(...grid.map((r) => r.length)), h = grid.length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });   // CPU-backed: toDataURL without a GPU readback
  grid.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const col = pal[row[x]]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } } });
  const url = c.toDataURL();
  cache.set(name, url);
  return url;
}

/** An <img> element showing the sprite at an integer scale, crisp. */
export function spriteImg(name, scale = 3, cls = '') {
  const base = VARIANTS[name] ? VARIANTS[name][0] : name;
  const art = ART[base];
  const img = document.createElement('img');
  img.className = `px ${cls}`.trim();
  img.alt = '';
  img.src = spriteUrl(name);
  if (art) { img.width = Math.max(...art.frames[0].map((r) => r.length)) * scale; img.height = art.frames[0].length * scale; }
  return img;
}
