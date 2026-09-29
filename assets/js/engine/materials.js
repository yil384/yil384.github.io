// engine/materials.js — stylised sci-fi/anime materials (three r186 TSL, WebGL2-safe).
//
// Exports
//   hologramMaterial({ tint, lines, speed })   additive unlit: fresnel edge + scanlines + sweep + flicker
//   neonMaterial(color, intensity)             unlit emissive; `.neon = { color, intensity }` uniforms.
//                                              Feeds the MRT `emissive` slot -> selective bloom in post.js
//   animeGround({ base, line, cell, major, fadeNear, fadeFar })
//                                              MeshStandardNodeMaterial grid floor with distance fade;
//                                              major lines glow (emissive)
//   energyShield({ color, power, pulse })      additive fresnel bubble; `.shield = { color, power, pulse, hit }`
//   safeAnisotropy(renderer)                   max anisotropy or 1 when the driver reports 0
//
// All unlit materials assign `emissiveNode` explicitly (0 or the glow) so the emissive MRT
// attachment is never left uninitialised in GLSL.
import * as THREE from 'three/webgpu';
import {
  Fn, float, vec3, vec4, uniform, mix, smoothstep, step, floor, fract, abs, max, min, sin, saturate, hash,
  time, normalView, positionViewDirection, positionWorld, positionView, fwidth, color,
} from 'three/tsl';

export function hologramMaterial({ tint = '#37e2ff', lines = 90, speed = 1.5 } = {}) {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const c = uniform(new THREE.Color(tint));
  const fresnel = float(1).sub(saturate(normalView.dot(positionViewDirection))).pow(2.0);
  const scan = sin(positionWorld.y.mul(lines).add(time.mul(4))).mul(0.5).add(0.5).step(0.55); // 0/1 hard lines
  const band = fract(positionWorld.y.mul(0.35).sub(time.mul(speed * 0.25))); // sweeping 0..1 ramp
  const sweep = smoothstep(0.85, 1.0, band); // bright leading edge
  const flicker = hash(floor(time.mul(24))).mul(0.15).add(0.85); // 24 Hz flicker
  const glitch = step(0.97, hash(floor(time.mul(8)).add(floor(positionWorld.y.mul(20))))); // sparse row jitter
  const intensity = fresnel.mul(1.4).add(scan.mul(0.25)).add(sweep.mul(1.2)).add(glitch.mul(0.6)).mul(flicker);
  m.colorNode = c.mul(intensity);
  m.opacityNode = intensity.saturate();
  m.emissiveNode = c.mul(sweep).mul(2.0).mul(intensity.saturate()); // lands in the MRT emissive -> bloom (masked)
  m.holo = { tint: c };
  return m;
}

export function neonMaterial(colorIn = '#ff3fd8', intensity = 3) {
  const c = uniform(colorIn instanceof THREE.Color ? colorIn : new THREE.Color(colorIn));
  const k = uniform(intensity);
  const m = new THREE.MeshBasicNodeMaterial();
  m.colorNode = c;
  m.emissiveNode = c.mul(k); // unlit + bright = neon; bloom reads this via MRT
  m.neon = { color: c, intensity: k };
  return m;
}

export function animeGround({ base = '#20183a', line = '#5ec8ff', cell = 1, major = 5, fadeNear = 15, fadeFar = 60 } = {}) {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 1, metalness: 0 }); // receives real shadows
  const cBase = uniform(new THREE.Color(base));
  const cLine = uniform(new THREE.Color(line));
  const gridLine = Fn(([p, size, width]) => { // anti-aliased grid, 0..1
    const g = abs(fract(p.div(size).sub(0.5)).sub(0.5)).div(fwidth(p.div(size)));
    const l = min(g.x, g.y);
    return float(1).sub(min(l.div(width), 1));
  });
  const p = positionWorld.xz;
  const minor = gridLine(p, float(cell), float(1.0)).mul(0.35);
  const big = gridLine(p, float(cell * major), float(1.5));
  const grid = max(minor, big);
  // 1 near the camera -> 0 at fadeFar (edges ascend; never smoothstep with edge0 > edge1)
  const fade = positionView.z.negate().smoothstep(fadeNear, fadeFar).oneMinus();
  m.colorNode = mix(cBase, cLine, grid.mul(fade).mul(0.8));
  m.emissiveNode = cLine.mul(big).mul(fade).mul(0.6); // major lines glow into bloom
  m.ground = { base: cBase, line: cLine };
  return m;
}

export function energyShield({ color: col = '#7fe9ff', power = 3, pulse = 1.5 } = {}) {
  const c = uniform(new THREE.Color(col));
  const uPower = uniform(power);
  const uPulse = uniform(pulse);
  const uHit = uniform(0); // 0..1 flash the whole bubble (set from JS on impact)
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide });
  const fresnel = float(1).sub(saturate(normalView.dot(positionViewDirection))).pow(uPower);
  const ripple = sin(positionWorld.y.mul(6).sub(time.mul(uPulse.mul(2)))).mul(0.5).add(0.5).mul(0.25);
  const hex = fract(positionWorld.xz.mul(3)).sub(0.5).abs(); // faint cell grid
  const cells = smoothstep(0.42, 0.5, max(hex.x, hex.y)).mul(0.35);
  const a = fresnel.add(ripple.mul(fresnel)).add(cells.mul(fresnel)).add(uHit).saturate();
  m.colorNode = c.mul(a);
  m.opacityNode = a;
  m.emissiveNode = c.mul(fresnel.mul(1.5).add(uHit.mul(0.8)));
  m.shield = { color: c, power: uPower, pulse: uPulse, hit: uHit };
  return m;
}

/** `renderer.getMaxAnisotropy()` returns 0 on some software rasterisers; use this for texture.anisotropy. */
export function safeAnisotropy(renderer) {
  try { return Math.max(1, renderer.getMaxAnisotropy() || 1); } catch { return 1; }
}
