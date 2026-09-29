// props/loader.js — rebuilds the studio's baked cel-3D props (props.json, see tools/export-props.mjs) as three.js meshes, so the
// live site draws the same K-01, gantry, hangar and island as the videos. Faces are convex polygons with a colour each; geometry is
// non-indexed (flat normals) with vertex colours. Faces flagged `glow` go to a second, unlit + emissive mesh.
import * as THREE from 'three/webgpu';
import { vec3, vertexColor } from 'three/tsl';
import { CelNodeMaterial } from '../engine/cel.js';

let cache = null;
export async function loadProps() {
  if (!cache) cache = fetch(new URL('./props.json', import.meta.url)).then((r) => { if (!r.ok) throw new Error('props.json ' + r.status); return r.json(); });
  return cache;
}

/** Shared materials: one cel program for every solid, one emissive program for every glowing face. */
export function makeMaterials() {
  const solid = new CelNodeMaterial({ vertexColors: true }, { steps: 3, shadowTint: '#3A2E6B', rimStrength: 0.45, specStrength: 0.15 });
  solid.emissiveNode = vec3(0);
  const glow = new THREE.MeshBasicNodeMaterial({ vertexColors: true });
  glow.emissiveNode = vertexColor().mul(1.2);
  return { solid, glow };
}

const tmp = new THREE.Color();
/** verts: [[x,y,z]], faces: [{ i:[...], col, glow }], offset: subtracted from every vertex. Returns { solid, glow } geometries. */
export function geometriesFrom(verts, faces, offset = [0, 0, 0]) {
  const build = (list) => {
    if (!list.length) return null;
    const pos = [], col = [];
    for (const f of list) {
      tmp.set(f.col);
      for (let k = 1; k + 1 < f.i.length; k++) {
        for (const idx of [f.i[0], f.i[k], f.i[k + 1]]) {
          const v = verts[idx];
          pos.push(v[0] - offset[0], v[1] - offset[1], v[2] - offset[2]);
          col.push(tmp.r, tmp.g, tmp.b);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  };
  return { solid: build(faces.filter((f) => !f.glow)), glow: build(faces.filter((f) => f.glow)) };
}

/** A baked static part -> Group with solid (+ glow) meshes. */
export function meshGroup(part, mats, offset) {
  const g = new THREE.Group();
  g.name = part.key || part.name || 'part';
  const geo = geometriesFrom(part.verts, part.faces, offset);
  if (geo.solid) g.add(new THREE.Mesh(geo.solid, mats.solid));
  if (geo.glow) g.add(new THREE.Mesh(geo.glow, mats.glow));
  return g;
}

export function staticGroup(parts, mats, name = 'static') {
  const g = new THREE.Group();
  g.name = name;
  for (const p of parts) g.add(meshGroup(p, mats));
  return g;
}

/** K-01 as a joint hierarchy. Returns { root, joints: { name: Group }, parts: { name: Group } }. Y is up, the mech faces +z. */
export function buildK01(props, mats) {
  const { pivots, parts } = props.k01;
  const joints = { root: new THREE.Group() };
  joints.root.name = 'K01';
  const parentOf = {};
  for (const p of parts) p.chain.forEach((n, k) => { if (k && !(n in parentOf)) parentOf[n] = p.chain[k - 1]; });
  const abs = (n) => (n === 'root' ? [0, 0, 0] : pivots[n]);
  const joint = (n) => {
    if (joints[n]) return joints[n];
    const par = joint(parentOf[n]), g = new THREE.Group(), a = abs(n), b = abs(parentOf[n]);
    g.name = n;
    g.position.set(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    par.add(g);
    return (joints[n] = g);
  };
  const out = {};
  for (const p of parts) {
    const jn = p.chain[p.chain.length - 1], j = joint(jn), pv = abs(jn);
    const g = meshGroup({ name: p.name, verts: p.verts, faces: p.faces }, mats, pv);
    j.add(g);
    out[p.name] = g;
  }
  return { root: joints.root, joints, parts: out };
}
