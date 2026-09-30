// Merged voxel meshes: a list of unit cells becomes ONE BufferGeometry that only carries the faces
// you can see (faces between two filled cells are dropped) with baked per-vertex ambient occlusion,
// so a whole district of buildings and trees is a single draw call with a fraction of the triangles
// an InstancedMesh of cubes would need. Cells sit on integer coordinates (a cell spans ±0.5).
import * as THREE from 'three/webgpu';
import { attribute } from 'three/tsl';

// For each face: the normal, the two in-plane axes and the 4 corners (unit-cube offsets, CCW seen from outside).
const FACES = [
  { n: [-1, 0, 0], c: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]] },
  { n: [1, 0, 0], c: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]] },
  { n: [0, -1, 0], c: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]] },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]] },
];
export const AO = [1, 0.8, 0.66, 0.54];

/** Integer cell key (x, y, z within ±511). */
export const vkey = (x, y, z) => ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);

/** Growable typed-array geometry writer (positions, normals, colours, optional glow). */
export class GeoWriter {
  constructor(glow = false) {
    this.p = new Float32Array(1 << 14); this.nm = new Float32Array(1 << 14); this.c = new Float32Array(1 << 14);
    this.g = glow ? new Float32Array(1 << 14) : null;
    this.idx = new Uint32Array(1 << 13);
    this.v = 0; this.i = 0;
  }
  grow() {
    const up = (a) => { const b = new a.constructor(a.length * 2); b.set(a); return b; };
    this.p = up(this.p); this.nm = up(this.nm); this.c = up(this.c); if (this.g) this.g = up(this.g);
  }
  growIdx() { const b = new Uint32Array(this.idx.length * 2); b.set(this.idx); this.idx = b; }
  /** One vertex. */
  vert(x, y, z, nx, ny, nz, r, g, b, er = 0, eg = 0, eb = 0) {
    if ((this.v + 1) * 3 > this.p.length) this.grow();
    const o = this.v * 3;
    this.p[o] = x; this.p[o + 1] = y; this.p[o + 2] = z;
    this.nm[o] = nx; this.nm[o + 1] = ny; this.nm[o + 2] = nz;
    this.c[o] = r; this.c[o + 1] = g; this.c[o + 2] = b;
    if (this.g) { this.g[o] = er; this.g[o + 1] = eg; this.g[o + 2] = eb; }
    return this.v++;
  }
  /** Two triangles over 4 vertices a b c d (corner order as in FACES); `flip` picks the other diagonal. */
  quad(a, flip = false) {
    if (this.i + 6 > this.idx.length) this.growIdx();
    const I = this.idx;
    if (!flip) { I[this.i++] = a; I[this.i++] = a + 1; I[this.i++] = a + 2; I[this.i++] = a + 2; I[this.i++] = a + 1; I[this.i++] = a + 3; }
    else { I[this.i++] = a; I[this.i++] = a + 1; I[this.i++] = a + 3; I[this.i++] = a; I[this.i++] = a + 3; I[this.i++] = a + 2; }
  }
  geometry() {
    const geo = new THREE.BufferGeometry();
    const n = this.v * 3;
    geo.setAttribute('position', new THREE.BufferAttribute(this.p.slice(0, n), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(this.nm.slice(0, n), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.c.slice(0, n), 3));
    if (this.g) geo.setAttribute('glow', new THREE.BufferAttribute(this.g.slice(0, n), 3));
    geo.setIndex(new THREE.BufferAttribute(this.idx.slice(0, this.i), 1));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }
}

const _c = new THREE.Color();
const colCache = new Map();
/** '#hex' -> [r, g, b] in the linear working space (cached). */
export function rgb(hex) {
  let v = colCache.get(hex);
  if (!v) { _c.set(hex); v = [_c.r, _c.g, _c.b]; colCache.set(hex, v); }
  return v;
}

/**
 * cells: [[x, y, z, '#colour', glow?], ...] on integer coordinates (later duplicates win).
 * solidExtra(x, y, z): optional extra occupancy (e.g. terrain) used for face culling and AO.
 * Returns a THREE.Mesh (vertex colours, emissive from the `glow` attribute when any cell glows).
 */
export function voxMesh(cells, { roughness = 0.85, metalness = 0, shadow = true, solidExtra = null, ao = true } = {}) {
  const map = new Map();
  let anyGlow = false;
  for (const c of cells) {
    const x = Math.round(c[0]), y = Math.round(c[1]), z = Math.round(c[2]);
    map.set(vkey(x, y, z), c);
    if (c[4]) anyGlow = true;
  }
  const solid = solidExtra
    ? (x, y, z) => map.has(vkey(x, y, z)) || solidExtra(x, y, z)
    : (x, y, z) => map.has(vkey(x, y, z));
  const w = new GeoWriter(anyGlow);
  for (const c of map.values()) {
    const x = Math.round(c[0]), y = Math.round(c[1]), z = Math.round(c[2]);
    const [r, g, b] = rgb(c[3]);
    const gl = c[4] || 0;
    for (const f of FACES) {
      const [nx, ny, nz] = f.n;
      if (solid(x + nx, y + ny, z + nz)) continue;
      const base = w.v;
      const occ = [0, 0, 0, 0];
      for (let k = 0; k < 4; k++) {
        const cc = f.c[k];
        let o = 0;
        if (ao) {
          // the two in-plane directions of this corner
          const d = [cc[0] * 2 - 1, cc[1] * 2 - 1, cc[2] * 2 - 1];
          const ax = nx ? [0, d[1], 0] : [d[0], 0, 0];
          const bx = nz ? [0, d[1], 0] : ny ? [0, 0, d[2]] : [0, 0, d[2]];
          const px = x + nx, py = y + ny, pz = z + nz;
          const s1 = solid(px + ax[0], py + ax[1], pz + ax[2]) ? 1 : 0;
          const s2 = solid(px + bx[0], py + bx[1], pz + bx[2]) ? 1 : 0;
          const cr = solid(px + ax[0] + bx[0], py + ax[1] + bx[1], pz + ax[2] + bx[2]) ? 1 : 0;
          o = s1 && s2 ? 3 : s1 + s2 + cr;
        }
        occ[k] = o;
        const a = AO[o];
        w.vert(x + cc[0] - 0.5, y + cc[1] - 0.5, z + cc[2] - 0.5, nx, ny, nz, r * a, g * a, b * a, r * gl, g * gl, b * gl);
      }
      w.quad(base, occ[0] + occ[3] < occ[1] + occ[2]);
    }
  }
  const geo = w.geometry();
  const mat = new THREE.MeshStandardNodeMaterial({ roughness, metalness, vertexColors: true });
  if (anyGlow) mat.emissiveNode = attribute('glow', 'vec3');
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  mesh.userData.faces = w.i / 6;
  return mesh;
}
