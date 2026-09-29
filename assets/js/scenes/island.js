// scenes/island.js — home base: the voxel-style island seen from the sky at dawn (painted sky, toon sea, K-01 parked on the plaza).
// The island is built at scale 4 so the 18 u mech fits its plaza (same numbers as the V4 video). Plaza top is y = 0.98.
import * as THREE from 'three/webgpu';
import { toonSea } from '../engine/materials.js';
import { buildK01, staticGroup } from '../props/loader.js';

const S = 4, PLAZA = new THREE.Vector3(0.6 * S, 0.245 * S, 0.8 * S);

export function build({ props, mats, tier }) {
  const group = new THREE.Group();
  group.name = 'island';
  const hemi = new THREE.HemisphereLight('#cfe8ff', '#3A2E6B', 0.9);
  const sun = new THREE.DirectionalLight('#fff0cf', 2.3);
  sun.position.set(30, 44, 14);
  group.add(hemi, sun);

  const rig = new THREE.Group();   // island + landmark bob together
  const isl = staticGroup(props.island, mats, 'island');
  isl.scale.setScalar(S);
  const mech = buildK01(props, mats);
  mech.root.position.copy(PLAZA).setY(PLAZA.y + 0.02);
  mech.root.rotation.y = -0.9;
  rig.add(isl, mech.root);
  group.add(rig);

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), toonSea());
  sea.rotation.x = -Math.PI / 2; sea.position.y = -34;
  group.add(sea);

  return {
    group, mech, plaza: PLAZA, sun,
    setDusk(k) { sun.color.set('#fff0cf').lerp(new THREE.Color('#F2B84B'), k); sun.intensity = 2.3 - 1.1 * k; hemi.intensity = 0.9 - 0.35 * k; },
    update(t) {
      mech.joints.head.rotation.y = 0.3 * Math.sin(t * 0.25);
      rig.position.y = 0.35 * Math.sin(t * 0.4);
    },
  };
}
