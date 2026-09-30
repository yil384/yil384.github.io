// Illustrated maps, drawn from the terrain itself: the hub as seen from straight above (ground by
// terrain type with hillshade and cliff edges, rooftops and tree crowns from the static scenery, the
// sea shaded by depth with a line of surf, the strata rim of the diorama), and the same for regions
// from their grids. The world map (M) and the HUD minimap share these canvases.
import { DISTRICTS, ZONES } from './world.js';

let hubCache = null;
const regionCache = {};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hexRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixRgb = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** The hub base map, `px` pixels per cell. Returns { canvas, px, half, size }. Cached per px. */
export function hubMapCanvas(world, px = 4) {
  if (hubCache?.[px]) return hubCache[px];
  const hub = world.hub, G = hub.grid;
  const { HV, T, D, LAND, seaD, SIZE, HALF, VOID, idx, PAL, DECO, DISC } = G;
  // the highest static voxel over each column (roofs, crowns, umbrellas)
  const topY = new Int16Array(SIZE * SIZE).fill(-999), topC = new Array(SIZE * SIZE);
  for (const c of hub.statics) {
    const x = Math.round(c[0]), z = Math.round(c[2]);
    if (x < -HALF || x >= HALF || z < -HALF || z >= HALF) continue;
    const i = idx(x, z);
    if (c[1] > topY[i]) { topY[i] = c[1]; topC[i] = c[3]; }
  }
  const hv = (x, z) => (x >= -HALF && x < HALF && z >= -HALF && z < HALF ? HV[idx(x, z)] : VOID);
  const top = (x, z) => { if (x < -HALF || x >= HALF || z < -HALF || z >= HALF) return VOID; const i = idx(x, z); return HV[i] === VOID ? VOID : Math.max(HV[i], topY[i]); };
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE * px;
  const g = canvas.getContext('2d');
  const img = g.createImageData(SIZE * px, SIZE * px);
  const deep = hexRgb('#0b2240'), shallow = hexRgb('#2c8fb0'), foam = hexRgb('#cfeaf7'), rim = hexRgb('#2a2432');
  const grey = hexRgb('#8e97a8');
  for (let z = -HALF; z < HALF; z++) for (let x = -HALF; x < HALF; x++) {
    const i = idx(x, z);
    const h = HV[i];
    let rgb = null;
    const r = Math.hypot(x, z);
    if (h === VOID) { if (r < DISC + 1.2) rgb = rim; }
    else if (LAND[i]) {
      const built = topY[i] > h;
      if (built) rgb = hexRgb(topC[i]);
      else if (hub.isBlocked(x, z)) rgb = grey;
      else rgb = hexRgb(D[i] ? DECO[D[i]] : (PAL[T[i]] || ['#888888'])[0]);
      // light from the north-west, a touch brighter with height, dark cliff edges
      const t0 = built ? topY[i] : h;
      const nwTop = top(x - 1, z - 1);
      const nw = nwTop === VOID ? t0 : nwTop;
      let f = 1 + clamp((t0 - nw) * 0.1, -0.28, 0.2) + clamp(h, 0, 12) * 0.012;
      let drop = 0;
      for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const n = hv(x + dx, z + dz); if (n !== VOID) drop = Math.max(drop, h - n); }
      if (drop >= 2 && !built) f *= 0.72;
      rgb = rgb.map((v) => v * f);
    } else {
      const sd = seaD[i];
      rgb = mixRgb(shallow, deep, clamp((sd - 1) / 7, 0, 1));
      if (sd <= 1) rgb = mixRgb(rgb, foam, 0.45);
    }
    if (!rgb) continue;
    const X0 = (x + HALF) * px, Z0 = (z + HALF) * px;
    for (let py = 0; py < px; py++) for (let pxx = 0; pxx < px; pxx++) {
      const o = ((Z0 + py) * SIZE * px + X0 + pxx) * 4;
      img.data[o] = clamp(rgb[0], 0, 255); img.data[o + 1] = clamp(rgb[1], 0, 255); img.data[o + 2] = clamp(rgb[2], 0, 255); img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  hubCache = hubCache || {};
  hubCache[px] = { canvas, px, half: HALF, size: SIZE, ox: 0, oz: 0 };
  return hubCache[px];
}

/** A region's base map from its grids (as the HUD always did), fitted into `pixels`. */
export function regionMapCanvas(world, def, pixels = 168) {
  const key = `${def.id}:${pixels}`;
  if (regionCache[key]) return regionCache[key];
  const half = Math.ceil(Math.max(def.size || 48, 16) / 2) + 2;
  const scale = pixels / (half * 2);
  const c = document.createElement('canvas');
  c.width = c.height = pixels;
  const g = c.getContext('2d');
  const [ox, oz] = def.origin;
  for (let z = -half; z < half; z++) for (let x = -half; x < half; x++) {
    const wx = ox + x, wz = oz + z;
    const h = world.height(wx, wz);
    if (h === -Infinity) continue;
    let colr = null;
    for (const gr of world.grids) if (gr.colorAt && wx >= gr.x0 && wx < gr.x1 && wz >= gr.z0 && wz < gr.z1) { colr = gr.colorAt(wx, wz); if (colr) break; }
    const nw = world.height(wx - 1, wz - 1);
    const f = 1 + clamp(((nw === -Infinity ? h : h - nw)) * 0.09, -0.25, 0.2);
    const rgb = hexRgb(colr || '#64748b').map((v) => clamp(v * f, 0, 255));
    g.fillStyle = `rgb(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0})`;
    g.fillRect((x + half) * scale, (z + half) * scale, Math.ceil(scale), Math.ceil(scale));
  }
  regionCache[key] = { canvas: c, px: scale, half, size: half * 2, ox, oz };
  return regionCache[key];
}
export function forgetRegionMap(id) { for (const k of Object.keys(regionCache)) if (k.startsWith(`${id}:`)) delete regionCache[k]; }

/** The hub map with roads highlighted and district names, for the world map (M). */
export function hubIllustrated(world, px = 5) {
  const base = hubMapCanvas(world, px);
  const c = document.createElement('canvas');
  c.width = c.height = base.canvas.width;
  const g = c.getContext('2d');
  g.drawImage(base.canvas, 0, 0);
  const P = (x, z) => [(x + base.half + 0.5) * px, (z + base.half + 0.5) * px];
  // the shuttle loop, traced over the asphalt
  const loop = world.hub.loop;
  g.lineWidth = px * 0.5; g.strokeStyle = 'rgba(242, 193, 78, 0.55)'; g.setLineDash([px * 1.6, px * 1.4]);
  g.beginPath();
  loop.forEach((p, i) => { const [a, b] = P(p.x, p.z); if (i) g.lineTo(a, b); else g.moveTo(a, b); });
  g.closePath(); g.stroke(); g.setLineDash([]);
  // district names
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [k, name] of DISTRICTS) {
    const zn = ZONES[k];
    if (!zn) continue;
    const [a, b] = P(zn.x, zn.z);
    const big = ['forest', 'price', 'rimac', 'warren', 'libwalk', 'plaza'].includes(k);
    g.font = `${big ? 700 : 600} ${Math.round(px * (big ? 2.4 : 2))}px system-ui, "Segoe UI", sans-serif`;
    g.lineWidth = px * 0.9; g.strokeStyle = 'rgba(5, 9, 20, 0.85)'; g.lineJoin = 'round';
    g.strokeText(name.toUpperCase(), a, b);
    g.fillStyle = big ? '#fff4d6' : '#dbe4f5';
    g.fillText(name.toUpperCase(), a, b);
  }
  return { canvas: c, px, half: base.half, size: base.size };
}
