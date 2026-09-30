// Voxel prop builder used by the landmarks. A prop is a list of cells [x, y, z, colour, glow?]
// turned into one InstancedMesh with per-instance colour and emissive. Every prop carries a
// `hi` uniform (0..1) that the stage uses to light a landmark up when the page points at it.
import * as THREE from 'three/webgpu';
import { instancedBufferAttribute, uniform } from 'three/tsl';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const _m = new THREE.Matrix4();
const _c = new THREE.Color();

/**
 * @param {Array<[number, number, number, string, number?]>} cells  local voxel cells; glow is an
 *        emissive multiplier applied to the cell's own colour (0 / undefined = matte).
 * @param {{roughness?:number, metalness?:number, shadow?:boolean}} opts
 * @returns {THREE.InstancedMesh} with userData.hi (a TSL uniform) and userData.setHi(v)
 */
export function voxBuild(cells, { roughness = 0.85, metalness = 0, shadow = true } = {}) {
  const n = Math.max(1, cells.length);
  const glowArr = new Float32Array(n * 3);
  const hiArr = new Float32Array(n * 3);
  const mat = new THREE.MeshStandardNodeMaterial({ roughness, metalness });
  const mesh = new THREE.InstancedMesh(BOX, mat, n);
  cells.forEach((cell, i) => {
    const [x, y, z, col, glow = 0] = cell;
    _m.makeTranslation(x, y, z);
    mesh.setMatrixAt(i, _m);
    _c.set(col);
    mesh.setColorAt(i, _c);
    glowArr[i * 3] = _c.r * glow; glowArr[i * 3 + 1] = _c.g * glow; glowArr[i * 3 + 2] = _c.b * glow;
    hiArr[i * 3] = _c.r * 0.35; hiArr[i * 3 + 1] = _c.g * 0.35; hiArr[i * 3 + 2] = _c.b * 0.35;
  });
  mesh.count = cells.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  const hi = uniform(0);
  const glowNode = instancedBufferAttribute(new THREE.InstancedBufferAttribute(glowArr, 3), 'vec3');
  const hiNode = instancedBufferAttribute(new THREE.InstancedBufferAttribute(hiArr, 3), 'vec3');
  mat.emissiveNode = glowNode.mul(hi.mul(1.5).add(1)).add(hiNode.mul(hi));
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  mesh.userData.hi = hi;
  mesh.userData.setHi = (v) => { hi.value = v; };
  return mesh;
}

/** Cells for a solid or hollow axis-aligned box, [x0..x1] × [y0..y1] × [z0..z1] inclusive. */
export function boxCells(x0, x1, y0, y1, z0, z1, col, { hollow = false, glow = 0, pick = null } = {}) {
  const out = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    if (hollow && x > x0 && x < x1 && z > z0 && z < z1 && y > y0 && y < y1) continue;
    const c = pick ? pick(x, y, z) : col;
    out.push([x, y, z, c, glow]);
  }
  return out;
}

/** Cells for a horizontal ring (square, hollow) at height y with half-width hw around (cx, cz). */
export function ringCells(cx, cz, hw, y, col, { glow = 0 } = {}) {
  const out = [];
  for (let x = -hw; x <= hw; x++) for (let z = -hw; z <= hw; z++) {
    if (Math.abs(x) !== hw && Math.abs(z) !== hw) continue;
    const c = typeof col === 'function' ? col(x, z) : col;
    out.push([cx + x, y, cz + z, c, glow]);
  }
  return out;
}

/** Deterministic tiny hash in 0..1, for stable per-cell colour variation. */
export const hash3 = (x, y, z) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export const shade = (hex, amt) => {
  _c.set(hex);
  const f = (v) => Math.max(0, Math.min(1, v + (amt < 0 ? v * amt : (1 - v) * amt)));
  _c.setRGB(f(_c.r), f(_c.g), f(_c.b));
  return `#${_c.getHexString()}`;
};
