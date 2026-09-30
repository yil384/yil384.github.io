// Text signs painted into one canvas atlas and drawn as ONE mesh: district boards, stand menus,
// shuttle stops and the signposts at every door. A sign is a quad (two for a double-sided board)
// that shows one atlas slot; redraw(id) repaints a slot (a door sign ticks when you have been there).
import * as THREE from 'three/webgpu';
import { texture, uv, float, vec2 } from 'three/tsl';

const COLS = 4, ROWS = 16, SW = 256, SH = 64;          // 64 slots of 256 x 64 px

/**
 * signs: [{ id, text, sub?, colour?, x, y, z, yaw = 0, w = 4, h = 1, back = true, style? }]
 * y is the board centre. yaw turns the readable face toward +z rotated by yaw (three.js rotation.y).
 */
export function buildSigns(signs) {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * SW; canvas.height = ROWS * SH;
  const g = canvas.getContext('2d');
  const slot = new Map();
  signs.slice(0, COLS * ROWS).forEach((s, i) => slot.set(s.id, { i, s }));

  function paint(i, s) {
    const cx = (i % COLS) * SW, cy = Math.floor(i / COLS) * SH;
    g.save();
    g.beginPath(); g.rect(cx, cy, SW, SH); g.clip();
    const dark = s.style !== 'light';
    g.fillStyle = dark ? '#101828' : '#f6f1e3';
    g.fillRect(cx, cy, SW, SH);
    g.fillStyle = s.colour || '#f2c14e';
    g.fillRect(cx, cy, 10, SH);
    g.fillRect(cx + 10, cy + SH - 5, SW - 10, 5);
    g.strokeStyle = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)';
    g.lineWidth = 3;
    g.strokeRect(cx + 1.5, cy + 1.5, SW - 3, SH - 3);
    g.fillStyle = dark ? '#f8fafc' : '#1f2937';
    g.textBaseline = 'middle';
    const pad = 20, maxW = SW - pad - 14;
    let size = s.sub ? 26 : 34;
    g.font = `700 ${size}px system-ui, "Segoe UI", sans-serif`;
    while (g.measureText(s.text).width > maxW && size > 14) { size -= 1; g.font = `700 ${size}px system-ui, "Segoe UI", sans-serif`; }
    g.fillText(s.text, cx + pad, cy + (s.sub ? 23 : SH / 2 - 1), maxW);
    if (s.sub) {
      g.font = '600 16px system-ui, "Segoe UI", sans-serif';
      g.fillStyle = dark ? (s.subColour || '#cbd5e1') : '#475569';
      g.fillText(s.sub, cx + pad, cy + 48, maxW);
    }
    g.restore();
  }
  for (const { i, s } of slot.values()) paint(i, s);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;

  // geometry: a quad per face, uv into the slot
  const pos = [], uvs = [], ind = [];
  let v = 0;
  const quad = (s, i, flip) => {
    const c = Math.cos(s.yaw || 0), sn = Math.sin(s.yaw || 0);
    const w = (s.w || 4) / 2, hh = (s.h || 1) / 2;
    const off = flip ? -0.06 : 0.06;                  // a hair in front of the board's voxels
    const u0 = (i % COLS) / COLS, u1 = u0 + 1 / COLS;
    const v1 = 1 - Math.floor(i / COLS) / ROWS, v0 = v1 - 1 / ROWS;
    // local (lx, ly, lz) -> world, facing +z when yaw = 0
    const P = (lx, ly) => [s.x + (lx * c + off * sn), s.y + ly, s.z + (-lx * sn + off * c)];
    const L = flip ? [w, -w] : [-w, w];
    const corners = [[L[0], -hh, u0, v0], [L[1], -hh, u1, v0], [L[0], hh, u0, v1], [L[1], hh, u1, v1]];
    for (const [lx, ly, uu, vv] of corners) { pos.push(...P(lx, ly)); uvs.push(uu, vv); }
    ind.push(v, v + 1, v + 2, v + 2, v + 1, v + 3);
    v += 4;
  };
  for (const { i, s } of slot.values()) {
    quad(s, i, false);
    if (s.back !== false) quad(s, i, true);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(ind);
  geo.computeBoundingSphere();
  const mat = new THREE.MeshBasicNodeMaterial({ side: THREE.FrontSide });
  mat.colorNode = texture(tex, vec2(uv().x, uv().y)).mul(float(0.92));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'signs';

  return {
    mesh, canvas,
    /** Repaint a sign with new fields (text, sub, colour). */
    redraw(id, patch = {}) {
      const e = slot.get(id);
      if (!e) return;
      Object.assign(e.s, patch);
      paint(e.i, e.s);
      tex.needsUpdate = true;
    },
    has: (id) => slot.has(id),
  };
}
