// Pixel-art ASCII grid -> voxel InstancedMesh (one instance per voxel, per-instance colour
// and per-instance emissive for selective bloom). Works on WebGPU and the WebGL2 fallback.
import * as THREE from 'three/webgpu';
import { instancedBufferAttribute, float, vec3 } from 'three/tsl';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const _geo = new Map();
function cubeGeometry(bevel) {
  const k = String(bevel);
  if (!_geo.has(k)) {
    _geo.set(k, bevel > 0 ? new RoundedBoxGeometry(1, 1, 1, 2, bevel) : new THREE.BoxGeometry(1, 1, 1));
  }
  return _geo.get(k);
}

const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; // linear luminance

/**
 * @param {{pal:Object, frames:string[][]}} art  sprite definition from sprites.js
 * @param {Object} opts
 *   frame      frame index
 *   overrides  palette overrides (variants)
 *   maxHalf    max half-thickness in voxels (1 = flat card, 2-3 = chunky/rounded)
 *   glow       { paletteKey: intensity } -> emissive (goes to bloom via MRT)
 *   bevel      rounded-box bevel radius (0 = hard cubes)
 */
export function voxelize(art, { frame = 0, overrides = null, maxHalf = 2, glow = {}, bevel = 0.08, material = null } = {}) {
  const grid = art.frames[frame];
  const pal = { ...art.pal, ...overrides };
  const h = grid.length;
  const w = Math.max(...grid.map((r) => r.length));
  const at = (x, y) => (y >= 0 && y < h && x >= 0 && x < w ? grid[y][x] : '.');
  const solid = (x, y) => { const ch = at(x, y); return ch !== '.' && ch !== undefined && !!pal[ch]; };

  // 4-neighbour distance to the silhouette edge (BFS from every transparent cell / outside).
  const dist = new Int16Array(w * h).fill(-1);
  const queue = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!solid(x, y)) continue;
    if (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1)) { dist[y * w + x] = 1; queue.push([x, y]); }
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const [x, y] = queue[qi];
    const d = dist[y * w + x];
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (solid(nx, ny) && dist[ny * w + nx] === -1) { dist[ny * w + nx] = d + 1; queue.push([nx, ny]); }
    }
  }

  const colors = {};
  for (const [k, v] of Object.entries(pal)) colors[k] = new THREE.Color(v); // sRGB hex -> linear

  // "Detail" pixels (eyes, mouths): dark pixels inside the silhouette. Only the front voxel
  // keeps the detail colour; the rest of the stack takes the dominant neighbour colour so the
  // back of the head is not covered in eyes.
  const detailFill = (x, y) => {
    const counts = {};
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1], [x + 1, y + 1], [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1]]) {
      const ch = at(nx, ny);
      if (ch !== '.' && pal[ch] && lum(colors[ch]) > 0.02) counts[ch] = (counts[ch] || 0) + 1;
    }
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return best ? best[0] : at(x, y);
  };

  const voxels = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!solid(x, y)) continue;
    const ch = at(x, y);
    const half = Math.min(dist[y * w + x], maxHalf); // 1 -> single layer
    const isDetail = lum(colors[ch]) < 0.02 && dist[y * w + x] > 1;
    const back = isDetail ? detailFill(x, y) : ch;
    for (let z = -(half - 1); z <= half - 1; z++) {
      const key = z === half - 1 ? ch : back;
      voxels.push({ x: x - w / 2 + 0.5, y: h - 1 - y + 0.5, z, key });
    }
  }

  const mat = material || new THREE.MeshStandardNodeMaterial({ roughness: 0.72, metalness: 0.0 });
  const mesh = new THREE.InstancedMesh(cubeGeometry(bevel), mat, voxels.length);
  const glowArr = new Float32Array(voxels.length * 3);
  const m = new THREE.Matrix4();
  voxels.forEach((v, i) => {
    m.makeTranslation(v.x, v.y, v.z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, colors[v.key]);
    const g = glow[v.key] || 0;
    glowArr[i * 3] = colors[v.key].r * g; glowArr[i * 3 + 1] = colors[v.key].g * g; glowArr[i * 3 + 2] = colors[v.key].b * g;
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  if (!material) {
    const glowAttr = new THREE.InstancedBufferAttribute(glowArr, 3);
    mat.emissiveNode = instancedBufferAttribute(glowAttr, 'vec3');
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { w, h, count: voxels.length };
  return mesh;
}

/** All frames of a sprite as meshes inside a Group; call group.userData.setFrame(i). */
export function voxelSprite(art, opts = {}) {
  const group = new THREE.Group();
  const frames = art.frames.map((_, i) => voxelize(art, { ...opts, frame: i }));
  frames.forEach((f, i) => { f.visible = i === 0; group.add(f); });
  group.userData = { frames, w: frames[0].userData.w, h: frames[0].userData.h, setFrame(i) { frames.forEach((f, j) => { f.visible = j === i % frames.length; }); } };
  return group;
}
