// engine/particles.js — attribute-based GPU particles (NO compute shaders; WebGL2-safe).
//
// Every effect is closed-form: per-instance random seeds live in an InstancedBufferAttribute and
// the shader evaluates position(t) from a `uTime` uniform that update(t, dt) sets, so the JS clock
// and the shader clock are the same number (bursts are exact, frames are reproducible).
// Each factory returns { object, update(t, dt), uniforms }.
//
// Exports
//   sparks({ count = 400, gravity = -9.8, life = 0.9, color = '#ff7a1a', hot = '#fff2a0', speed = 6, spread = 0.7 })
//        burst emitter: `.burst(origin: Vector3, dir?: Vector3)` re-fires the whole slot at the last update() time.
//        Stretched additive sprites (rotated along view-space velocity), emissive -> bloom.
//   aura({ count = 1500, radius = 1, height = 2.5, colorA = '#ffffff', colorB = '#2fd8ff', center })
//        orbiting glow sprites around `uniforms.center` (Vector3), curl-noise wobble.
//   streaks({ count = 120, length = 30, radius = 6, color = '#ffffff' })
//        motion streak quads flying along `uniforms.dir` past `uniforms.center`; `uniforms.speed` (0 = still).
//   shockwave({ size = 12, color = '#8ff4ff' })
//        flat ring mesh driven by `uniforms.t` (0..1). `.play(duration)` lets update() drive t for you.
//
// Pitfalls handled: Sprite.count instancing (frustumCulled=false), no smoothstep(edge0>edge1),
// every material assigns emissiveNode so the post MRT emissive slot is always defined.
import * as THREE from 'three/webgpu';
import {
  Fn, float, vec2, vec3, vec4, uniform, uv, mix, select, sin, cos, atan, fract, length, smoothstep, pcurve,
  instancedBufferAttribute, cameraViewMatrix, mx_noise_float, normalize, color, PI, TWO_PI,
} from 'three/tsl';
import { curlNoise } from 'three/addons/tsl/math/curlNoise.js';

/** vec4 of per-instance randoms in [0,1). */
export function seedAttribute(n, k = 4) {
  const a = new Float32Array(n * k);
  for (let i = 0; i < a.length; i++) a[i] = Math.random();
  return instancedBufferAttribute(new THREE.InstancedBufferAttribute(a, k));
}

function sprite(material, n, name) {
  const s = new THREE.Sprite(material);
  s.count = n;
  s.frustumCulled = false;
  s.name = name;
  return s;
}

const toColor = (c) => (c instanceof THREE.Color ? c : new THREE.Color(c));

export function sparks({ count = 400, gravity = -9.8, life = 0.9, color: cold = '#ff7a1a', hot = '#fff2a0', speed = 6, spread = 0.7 } = {}) {
  const seed = seedAttribute(count);
  const uTime = uniform(0);
  const uT0 = uniform(-100); // time of the burst
  const uOrigin = uniform(new THREE.Vector3());
  const uDir = uniform(new THREE.Vector3(0, 1, 0));
  const uGravity = uniform(gravity);
  const uLife = uniform(life);
  const uSpeed = uniform(speed);
  const uSpread = uniform(spread);
  const cCold = uniform(toColor(cold));
  const cHot = uniform(toColor(hot));

  const lifeMax = uLife.mul(seed.w.mul(0.6).add(0.7));
  const t = uTime.sub(uT0).max(0).toVar();
  const th = seed.x.mul(TWO_PI);
  const ph = seed.y.mul(PI);
  const rnd = vec3(sin(ph).mul(cos(th)), cos(ph), sin(ph).mul(sin(th)));
  const v0 = normalize(uDir.add(rnd.mul(uSpread))).mul(uSpeed.mul(seed.z.mul(0.7).add(0.5)));
  const g = vec3(0, uGravity, 0);
  const p = uOrigin.add(v0.mul(t)).add(g.mul(t.mul(t).mul(0.5)));
  const lifeN = t.div(lifeMax).oneMinus(); // 1 -> 0
  const alive = select(lifeN.greaterThan(0), float(1), float(0));
  const vel = v0.add(g.mul(t));
  const vView = cameraViewMatrix.mul(vec4(vel, 0)).xyz;

  const m = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  m.positionNode = vec3(p.x, p.y.max(uOrigin.y.sub(50)), p.z);
  m.rotationNode = atan(vView.y, vView.x);
  m.scaleNode = vec2(vView.length().mul(0.02).add(0.05), 0.03).mul(lifeN.saturate()).mul(alive);
  const tint = mix(cCold, cHot, lifeN.saturate());
  const mask = uv().x.mul(alive); // fade along the streak (tail transparent)
  m.colorNode = tint;
  m.opacityNode = mask;
  m.emissiveNode = tint.mul(2.5).mul(mask); // HDR for bloom; masked because MRT emissive ignores opacity

  const object = sprite(m, count, 'sparks');
  let lastT = 0;
  return {
    object,
    uniforms: { time: uTime, t0: uT0, origin: uOrigin, dir: uDir, gravity: uGravity, life: uLife, speed: uSpeed, spread: uSpread },
    update(tNow) { lastT = tNow; uTime.value = tNow; },
    burst(origin, dir) {
      if (origin) uOrigin.value.copy(origin);
      if (dir) uDir.value.copy(dir).normalize();
      uT0.value = lastT;
    },
  };
}

export function aura({ count = 1500, radius = 1, height = 2.5, colorA = '#ffffff', colorB = '#2fd8ff', center = new THREE.Vector3() } = {}) {
  const seed = seedAttribute(count);
  const uTime = uniform(0);
  const uCenter = uniform(center.clone());
  const uRadius = uniform(radius);
  const uHeight = uniform(height);
  const cA = uniform(toColor(colorA));
  const cB = uniform(toColor(colorB));
  const life = uTime.mul(seed.w.mul(0.6).add(0.6)).add(seed.x.mul(10)).fract(); // 0->1 loop, per-particle phase & speed
  const ang = seed.y.mul(TWO_PI).add(uTime.mul(1.5)); // orbit
  const r = uRadius.mul(seed.z.mul(0.5).add(0.7)).mul(life.mul(0.5).add(0.8));
  const y = life.mul(uHeight).sub(uHeight.mul(0.2));
  const base = vec3(cos(ang).mul(r), y, sin(ang).mul(r));
  const wobble = curlNoise(base.mul(2).add(uTime.mul(0.5))).mul(0.15); // vertex-stage curl: WebGL2 OK
  const m = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  m.positionNode = uCenter.add(base).add(wobble);
  m.scaleNode = pcurve(life, 1.5, 3).mul(0.08).add(0.01).mul(uRadius);
  const tint = mix(cA, cB, life);
  const disc = uv().sub(0.5).length().smoothstep(0.25, 0.5).oneMinus();
  const mask = disc.mul(life.oneMinus().smoothstep(0, 0.3));
  m.colorNode = tint;
  m.opacityNode = mask;
  m.emissiveNode = tint.mul(1.5).mul(mask);
  const object = sprite(m, count, 'aura');
  return {
    object,
    uniforms: { time: uTime, center: uCenter, radius: uRadius, height: uHeight, colorA: cA, colorB: cB },
    update(tNow) { uTime.value = tNow; },
  };
}

export function streaks({ count = 120, length: len = 30, radius = 6, color: col = '#ffffff', center = new THREE.Vector3(), dir = new THREE.Vector3(0, 0, 1) } = {}) {
  const seed = seedAttribute(count);
  const uTime = uniform(0);
  const uSpeed = uniform(1); // cycles/sec scale; 0 = frozen
  const uPhase = uniform(0); // accumulated phase (so speed changes never pop)
  const uCenter = uniform(center.clone());
  const uDir = uniform(dir.clone().normalize());
  const uRadius = uniform(radius);
  const uLen = uniform(len);
  const c = uniform(toColor(col));
  // orthonormal frame around uDir (computed in-shader so uDir can be animated)
  const up = select(uDir.y.abs().greaterThan(0.9), vec3(1, 0, 0), vec3(0, 1, 0));
  const ax = normalize(up.cross(uDir));
  const ay = uDir.cross(ax);
  const cyc = uPhase.mul(seed.w.mul(0.5).add(0.75)).add(seed.x).fract(); // 0..1 along the run
  const ang = seed.y.mul(TWO_PI);
  const rr = uRadius.mul(seed.z.sqrt()); // uniform in the disc
  const along = cyc.mul(uLen).sub(uLen.mul(0.5));
  const pos = uCenter.add(ax.mul(cos(ang).mul(rr))).add(ay.mul(sin(ang).mul(rr))).add(uDir.mul(along));
  const vView = cameraViewMatrix.mul(vec4(uDir, 0)).xyz;
  const fade = cyc.smoothstep(0, 0.15).mul(cyc.smoothstep(0.85, 1).oneMinus());
  const m = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  m.positionNode = pos;
  m.rotationNode = atan(vView.y, vView.x);
  m.scaleNode = vec2(uSpeed.mul(1.2).add(0.2).mul(seed.w.add(0.5)), 0.035);
  const mask = uv().x.pow(2).mul(fade).mul(uSpeed.min(1));
  m.colorNode = c;
  m.opacityNode = mask;
  m.emissiveNode = c.mul(0.8).mul(mask);
  const object = sprite(m, count, 'streaks');
  return {
    object,
    uniforms: { time: uTime, speed: uSpeed, phase: uPhase, center: uCenter, dir: uDir, radius: uRadius, length: uLen, color: c },
    update(tNow, dt = 0) { uTime.value = tNow; uPhase.value += dt * uSpeed.value * 0.5; },
  };
}

export function shockwave({ size = 12, color: col = '#8ff4ff' } = {}) {
  const uT = uniform(1); // 0..1; outside (0,1) nothing is drawn
  const uColor = uniform(toColor(col));
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  m.emissiveNode = vec3(0);
  m.outputNode = Fn(() => {
    const t = uT.toVar();
    const alive = select(t.greaterThan(0).and(t.lessThan(1)), float(1), float(0));
    const p = uv().sub(0.5).mul(2);
    const ang = atan(p.y, p.x);
    const r = p.length().add(mx_noise_float(vec3(ang.mul(3), t.mul(4), 0), 1, 0).mul(0.08)); // jagged edge
    const radius = pcurve(t.clamp(0.001, 0.999), 0.5, 2.5); // ease-out expansion
    const thickness = float(0.12).mul(t.oneMinus()).add(0.02);
    const ring = r.sub(radius).abs().smoothstep(0, thickness).oneMinus();
    const inner = r.lessThan(radius).select(t.oneMinus().pow(3).mul(0.35), float(0)); // brief inner flash
    const a = ring.add(inner).mul(t.oneMinus().pow(0.5)).mul(alive);
    return vec4(uColor.mul(2.5), a);
  })();
  const g = new THREE.PlaneGeometry(size, size);
  g.rotateX(-Math.PI / 2);
  const object = new THREE.Mesh(g, m);
  object.name = 'shockwave';
  let playing = null;
  return {
    object,
    uniforms: { t: uT, color: uColor },
    play(duration = 0.7) { playing = { start: null, duration }; },
    update(tNow) {
      if (!playing) return;
      if (playing.start === null) playing.start = tNow;
      const k = (tNow - playing.start) / playing.duration;
      uT.value = Math.min(1, k);
      if (k >= 1) playing = null;
    },
  };
}
