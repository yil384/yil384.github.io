// The sea around the UCSD island: one merged mesh of water cells (exactly the cells that are not
// land, so it meets the voxel coast without gaps) plus a glassy wall down the rim of the diorama.
// A TSL material rolls gentle waves across it, tints the shallows turquoise and runs lines of surf
// in toward every beach (strongest where the swell meets the sand).
import * as THREE from 'three/webgpu';
import { attribute, time, positionLocal, sin, vec3, mix, color, float, smoothstep } from 'three/tsl';

/**
 * grid: { HV, LAND, seaD, idx, inRange, inDisc, SIZE, HALF, VOID, WATER }
 * Returns { mesh }.
 */
export function buildWater(grid) {
  const { HV, LAND, seaD, idx, inRange, inDisc, HALF, VOID, WATER } = grid;
  const pos = [], dat = [], ind = [];
  let v = 0;
  const isWater = (x, z) => inRange(x, z) && inDisc(x, z) && HV[idx(x, z)] !== VOID && !LAND[idx(x, z)];
  const RIM_BOTTOM = -3.6;
  // shore closeness per cell (1 at the sand, 0 out at sea), averaged onto the corners so the surf
  // lines follow the coast smoothly instead of stepping cell by cell
  const cellShore = (x, z) => {
    if (!inRange(x, z)) return 0;
    const i = idx(x, z);
    if (LAND[i]) return 1.12;
    return Math.max(0, 1 - (seaD[i] - 1) / 7);
  };
  const cornerShore = (cx, cz) => (cellShore(cx, cz) + cellShore(cx - 1, cz) + cellShore(cx, cz - 1) + cellShore(cx - 1, cz - 1)) / 4;
  for (let z = -HALF; z < HALF; z++) for (let x = -HALF; x < HALF; x++) {
    if (!isWater(x, z)) continue;
    const i = idx(x, z);
    const shore = Math.max(0, 1 - (seaD[i] - 1) / 7);
    const ph = 0;
    // the surface, one quad per cell (neighbouring quads share corner positions, so waves stay seamless)
    for (const [dx, dz] of [[-0.5, 0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, -0.5]]) {
      pos.push(x + dx, WATER, z + dz);
      dat.push(Math.min(1, cornerShore(x + dx + 0.5, z + dz + 0.5)), 1, Math.sin((x + dx) * 0.37) + Math.cos((z + dz) * 0.29), 1);
    }
    ind.push(v, v + 1, v + 2, v + 2, v + 1, v + 3);
    v += 4;
    // the rim: a wall of water down to the strata
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (isWater(x + nx, z + nz) || (inRange(x + nx, z + nz) && LAND[idx(x + nx, z + nz)])) continue;
      const ex = x + nx * 0.5, ez = z + nz * 0.5;
      const tx = nz, tz = -nx;                    // along the edge
      const a = [ex - tx * 0.5, ez - tz * 0.5], b = [ex + tx * 0.5, ez + tz * 0.5];
      pos.push(a[0], WATER, a[1]); dat.push(shore, 0, ph, 1);
      pos.push(b[0], WATER, b[1]); dat.push(shore, 0, ph, 1);
      pos.push(a[0], RIM_BOTTOM, a[1]); dat.push(shore, 0, ph, 0);
      pos.push(b[0], RIM_BOTTOM, b[1]); dat.push(shore, 0, ph, 0);
      ind.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
      v += 4;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('wdata', new THREE.Float32BufferAttribute(dat, 4));
  const normals = new Float32Array(pos.length);
  for (let k = 1; k < normals.length; k += 3) normals[k] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setIndex(v > 65535 ? new THREE.Uint32BufferAttribute(ind, 1) : new THREE.Uint16BufferAttribute(ind, 1));
  geo.computeBoundingSphere();

  const wd = attribute('wdata', 'vec4');
  const shore = wd.x, surface = wd.y, ph = wd.z, moves = wd.w;
  const p = positionLocal;
  const wave = sin(p.x.mul(0.31).add(time.mul(1.05))).mul(0.07)
    .add(sin(p.z.mul(0.23).sub(time.mul(0.83)).add(p.x.mul(0.07))).mul(0.06));
  const mat = new THREE.MeshStandardNodeMaterial({ transparent: true, depthWrite: false, roughness: 0.28, metalness: 0.05, side: THREE.DoubleSide });
  mat.positionNode = p.add(vec3(0, wave.mul(moves), 0));
  // surf: lines that roll in toward the shore, and a lapping white edge right at the sand
  const roll = sin(shore.mul(15).sub(time.mul(1.7)).add(ph.mul(1.1))).mul(0.5).add(0.5);
  const lines = smoothstep(0.8, 0.97, roll).mul(smoothstep(0.3, 0.85, shore));
  const lap = smoothstep(0.88, 1.0, shore).mul(sin(time.mul(2.1).add(ph.mul(2.2))).mul(0.3).add(0.7));
  const foam = lines.max(lap).mul(surface);
  const sea = mix(color('#0c2744'), color('#1f7391'), shore.mul(shore));
  const wall = mix(color('#040b16'), color('#0e2c4c'), smoothstep(float(-3.6), float(0.3), p.y));
  const body = mix(wall, sea, surface);
  mat.colorNode = mix(body, color('#eaf6ff'), foam.mul(0.85));
  mat.opacityNode = mix(mix(float(0.95), float(0.6), shore), float(0.9), float(1).sub(surface)).max(foam.mul(0.95));
  mat.emissiveNode = body.mul(0.18).add(color('#bfe3ff').mul(foam.mul(0.08)));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'sea';
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  return { mesh };
}
