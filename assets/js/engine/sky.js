// engine/sky.js — background nodes and a starfield (three r186 TSL, WebGL2-safe).
//
// Exports
//   paintedSky({ zenith, horizon, sun, sunDir })  stepped gradient + fbm cloud bands + sun disc.
//        Returns a Node for `scene.backgroundNode`; `node.uniforms = { zenith, horizon, sun, sunDir }`.
//   warpSky({ speed, colorA, colorB })            "light speed" radial rays (verbatim from the r186
//        webgpu_animation_retargeting example) dodge-blended over a hue-cycling vignette.
//        `speed` may be a number or a uniform(); `node.uniforms.speed` is the uniform actually used.
//   starfield(count, { radius, colorA, colorB })   Sprite with count instances (attribute seeds, no
//        compute); soft twinkling points, additive. `scene.add(starfield(4000))`.
//
// Usage: scene.backgroundNode = paintedSky(); scene.backgroundIntensity = 1;
import * as THREE from 'three/webgpu';
import {
  Fn, float, vec2, vec3, vec4, uniform, mix, floor, sin, cos, pow, sub, mul, length, atan, time, color, hue,
  blendDodge, screenUV, normalWorldGeometry, mx_fractal_noise_float, instancedBufferAttribute, uv, TWO_PI,
} from 'three/tsl';

const asUniform = (v) => (v && v.isNode ? v : uniform(v));

export function paintedSky({ zenith = '#1a1440', horizon = '#ff8fb1', sun = '#fff1c1', sunDir = new THREE.Vector3(0.3, 0.25, -1) } = {}) {
  const cZ = uniform(new THREE.Color(zenith));
  const cH = uniform(new THREE.Color(horizon));
  const cS = uniform(new THREE.Color(sun));
  const sunU = uniform(sunDir.clone().normalize());
  const node = Fn(() => {
    const d = normalWorldGeometry; // view ray direction inside backgroundNode
    const h = d.y.smoothstep(-0.05, 0.55);
    // 3-step "painted" gradient: quantise the ramp, then soften each step edge a little
    const stepped = floor(h.mul(3.999)).div(3).mix(h, 0.35);
    const sky = mix(cH, cZ, stepped).toVar();
    // brushy cloud bands: fbm on a slowly drifting direction, thresholded to 2 tones
    const n = mx_fractal_noise_float(d.mul(vec3(3, 6, 3)).add(vec3(time.mul(0.02), 0, 0)), 4, 2, 0.5, 1);
    const cloud = n.smoothstep(0.15, 0.2).mul(d.y.smoothstep(0.0, 0.3));
    sky.assign(mix(sky, cH.mul(1.3), cloud.mul(0.6)));
    // sun disc + halo
    const s = d.dot(sunU);
    sky.addAssign(cS.mul(s.smoothstep(0.995, 0.998)));
    sky.addAssign(cS.mul(s.smoothstep(0.90, 1.0).pow(3).mul(0.35)));
    return vec4(sky, 1);
  })();
  node.uniforms = { zenith: cZ, horizon: cH, sun: cS, sunDir: sunU };
  return node;
}

// forked from https://www.shadertoy.com/view/7ly3D1 (as shipped in three's webgpu_animation_retargeting)
const lightSpeed = /*#__PURE__*/ Fn(([suv_immutable, t_immutable]) => {
  const suv = vec2(suv_immutable);
  const t = float(t_immutable);
  const uvp = vec2(length(suv), atan(suv.y, suv.x));
  const offset = float(float(.1).mul(sin(uvp.y.mul(10.).sub(t.mul(.6)))).mul(cos(uvp.y.mul(48.).add(t.mul(.3)))).mul(cos(uvp.y.mul(3.7).add(t))));
  const rays = vec3(vec3(sin(uvp.y.mul(150.).add(t)).mul(.5).add(.5)).mul(vec3(sin(uvp.y.mul(80.).sub(t.mul(0.6))).mul(.5).add(.5))).mul(vec3(sin(uvp.y.mul(45.).add(t.mul(0.8))).mul(.5).add(.5))).mul(vec3(sub(1., cos(uvp.y.add(mul(22., t).sub(pow(uvp.x.add(offset), .3).mul(60.))))))).mul(vec3(uvp.x.mul(2.))));
  return rays;
}).setLayout({
  name: 'lightSpeed',
  type: 'vec3',
  inputs: [{ name: 'suv', type: 'vec2' }, { name: 't', type: 'float' }],
});

export function warpSky({ speed = 1, colorA = 0x0175ad, colorB = 0x02274f } = {}) {
  const uSpeed = asUniform(speed);
  const t = time.mul(uSpeed);
  const coloredVignette = screenUV.distance(.5).mix(hue(color(colorA), t.mul(.1)), hue(color(colorB), t.mul(.5)));
  const lightSpeedEffect = lightSpeed(normalWorldGeometry.xy, t).clamp();
  const lightSpeedSky = normalWorldGeometry.y.remapClamp(-.1, 1).mix(0, lightSpeedEffect);
  const node = blendDodge(coloredVignette, lightSpeedSky);
  node.uniforms = { speed: uSpeed };
  return node;
}

export function starfield(count = 4000, { radius = 80, colorA = '#9db4ff', colorB = '#fff1d0' } = {}) {
  const a = new Float32Array(count * 4);
  for (let i = 0; i < a.length; i++) a[i] = Math.random();
  const seed = instancedBufferAttribute(new THREE.InstancedBufferAttribute(a, 4)); // vec4 in [0,1)
  const th = seed.x.mul(TWO_PI);
  const ph = seed.y.mul(2).sub(1).acos(); // uniform on sphere
  const r = float(radius).mul(seed.z.mul(0.5).add(0.5));
  const p = vec3(sin(ph).mul(cos(th)), cos(ph), sin(ph).mul(sin(th))).mul(r);
  const twinkle = sin(time.mul(seed.w.mul(4).add(1)).add(seed.x.mul(100))).mul(0.5).add(0.5);
  const m = new THREE.PointsNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false });
  m.positionNode = p;
  m.sizeNode = seed.w.mul(2.5).add(1).mul(twinkle.mul(0.6).add(0.7)); // pixels
  m.colorNode = vec4(mix(color(colorA), color(colorB), seed.z), 1);
  // soft disc without MSAA dependence (edges ascend, then invert)
  const disc = uv().sub(0.5).length().smoothstep(0.3, 0.5).oneMinus();
  m.opacityNode = disc.mul(twinkle.mul(0.5).add(0.5));
  m.emissiveNode = vec3(0);
  const mesh = new THREE.Sprite(m);
  mesh.count = count;
  mesh.frustumCulled = false;
  mesh.name = 'starfield';
  return mesh;
}
