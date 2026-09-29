// scenes/hangar.js — the carrier hangar at night: K-01 in its gantry, wall ribs, twelve amber work lamps, a tile floor, Unit-7, dust,
// and the blast doors at z = +70 (open 0..1). Geometry is the studio's (props.json). World units ~ metres; K-01 is 18 u tall, faces +z.
import * as THREE from 'three/webgpu';
import { uv, vec3, float, time, sin, cos, fract, mix, color } from 'three/tsl';
import { buildK01, staticGroup, meshGroup } from '../props/loader.js';
import { animeGround } from '../engine/materials.js';
import { seedAttribute } from '../engine/particles.js';

function haloMaterial(color = '#F2B84B') {
  const m = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const d = uv().sub(0.5).length().mul(2).oneMinus().clamp(0, 1);
  const a = d.mul(d);
  m.colorNode = vec3(new THREE.Color(color));
  m.opacityNode = a.mul(0.3);
  m.emissiveNode = vec3(new THREE.Color(color)).mul(a).mul(0.35);
  return m;
}

export function build({ props, mats, tier }) {
  const group = new THREE.Group();
  group.name = 'hangar';

  // lights: cold key from the front-left, cool hemisphere, two amber fills
  const hemi = new THREE.HemisphereLight('#8FA3C7', '#1E2A5E', 0.32);
  const key = new THREE.DirectionalLight('#dfe8ff', 1.05);
  key.position.set(-14, 26, 22);
  const warmA = new THREE.PointLight('#F2B84B', 45, 46, 1.6), warmB = new THREE.PointLight('#F2B84B', 45, 46, 1.6);
  warmA.position.set(-10, 10, -6); warmB.position.set(10, 10, 8);
  const back = new THREE.DirectionalLight('#F2B84B', 0.8), rear = new THREE.DirectionalLight('#F2B84B', 0.8);   // amber contre-jour from the door end, and from behind the mech
  back.position.set(10, 14, 40); rear.position.set(-8, 16, -40);
  group.add(hemi, key, back, rear, warmA, warmB);

  // the machine and its set
  const mech = buildK01(props, mats);
  group.add(mech.root);
  group.add(staticGroup(props.gantry, mats, 'gantry'));
  group.add(staticGroup(props.walls, mats, 'walls'));
  const unit7 = staticGroup(props.unit7, mats, 'unit7');
  unit7.position.set(4.6, 0, 3.6); unit7.rotation.y = -2.6;
  group.add(unit7);

  // blast doors: baked closed; slide apart by 14 u * open
  const doorL = meshGroup(props.doors[0], mats), doorR = meshGroup(props.doors[1], mats);
  group.add(doorL, doorR);
  // the morning beyond the door: an emissive plane just behind the slabs, only visible through the gap (blooms into a flood)
  const glareMat = new THREE.MeshBasicNodeMaterial({ color: '#F4EEDF' });
  glareMat.emissiveNode = vec3(new THREE.Color('#F4EEDF')).mul(1.6);
  const glare = new THREE.Mesh(new THREE.PlaneGeometry(36, 30), glareMat);
  glare.position.set(0, 13, 72.5); glare.rotation.y = Math.PI;
  group.add(glare);

  // floor: steel grid on night, tile-sized cells (1.5 u), major lines every 6
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(29, 112), animeGround({ base: '#0F1530', line: '#3B4A6B', cell: 1.5, major: 4, fadeNear: 30, fadeFar: 110 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 18);
  group.add(floor);

  // lamps: 6 pairs on the wall rail, emissive lamp mesh + additive halo
  const halo = haloMaterial('#F2B84B'), halos = [];
  for (let k = 0; k < 6; k++) for (const sx of [-1, 1]) {
    const lamp = new THREE.Group();
    lamp.position.set(sx * 12, 9, -30 + 6 * k);
    lamp.add(meshGroup({ verts: props.lamp.verts, faces: props.lamp.faces }, mats));
    lamp.rotation.z = sx * 0.9; lamp.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
    const h = new THREE.Sprite(halo); h.scale.setScalar(5); h.position.copy(lamp.position);
    halos.push(h);
    group.add(lamp, h);
  }

  // dust in the lamp light: tiny additive motes drifting up through the hangar (closed-form, no compute)
  const N = tier >= 2 ? 2600 : 1000, seed = seedAttribute(N);
  const life = time.mul(seed.w.mul(0.03).add(0.02)).add(seed.x.mul(7)).fract();
  const dp = vec3(seed.x.mul(26).sub(13).add(sin(time.mul(0.2).add(seed.z.mul(30))).mul(0.6)), life.mul(22), seed.y.mul(100).sub(34).add(cos(time.mul(0.17).add(seed.x.mul(20))).mul(0.6)));
  const dm = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const disc = uv().sub(0.5).length().mul(2).oneMinus().clamp(0, 1);
  dm.positionNode = dp;
  dm.scaleNode = seed.z.mul(0.07).add(0.035);
  dm.colorNode = mix(color('#F2B84B'), color('#F4EEDF'), seed.w);
  dm.opacityNode = disc.mul(life.sub(0.5).abs().mul(2).oneMinus().smoothstep(0, 0.4)).mul(0.55);
  dm.emissiveNode = vec3(0);
  const dust = new THREE.Sprite(dm); dust.count = N; dust.frustumCulled = false; dust.name = 'dust';
  group.add(dust);

  const head = mech.joints.head, torso = mech.joints.torso;
  return {
    group, mech,
    setDoor(open) { doorL.position.x = -14 * open; doorR.position.x = 14 * open; },
    update(t, dt) {
      head.rotation.y = 0.32 * Math.sin(t * 0.31) + 0.1 * Math.sin(t * 0.9);
      head.rotation.x = 0.04 * Math.sin(t * 0.5);
      torso.position.y = 0.05 * Math.sin(t * 1.6);
      halos.forEach((h, i) => h.scale.setScalar(4.7 + 0.4 * Math.sin(t * 2 + i)));
    },
  };
}
