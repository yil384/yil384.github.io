// Play-mode see-through: scenery that stands between the third-person camera and the scholar (a tree
// crown, a lamp, a one-cell wall, a sign) is dithered away in a cone around the line of sight, so the
// scholar always shows. The camera (camera.js) only pulls in for thick solid ground; everything thinner
// is cut here, on the GPU, with no raycasts:
//   - a fragment between the camera and the scholar (t along the ray in 0..end), above the scholar's
//     feet, inside a cone that reaches `rad` at the scholar, is discarded in a screen-space dither
//     (about 85 % gone at the centre, feathered to nothing at the rim);
//   - anything within ~1.3 units of the lens is dithered away too (no near-plane slices of leaves/walls).
// Shadows are untouched (maskShadowNode), and with `on` = 0 (tour, first person) nothing changes.
// applyCutout(root) patches the opaque node materials under a group once; actors (anything with
// userData.setFrame: the scholar, NPCs, foes) and objects with userData.noCut are left alone. Terrain
// (name 'terrain') gets the cone only: the ground under a low camera must not dither away.
import * as THREE from 'three/webgpu';
import { uniform, positionWorld, cameraPosition, screenCoordinate, smoothstep, max, fract, dot, vec2, float, bool } from 'three/tsl';

export const CUT = { MAX: 0.85, NEAR0: 0.5, NEAR1: 1.3, FEATHER: 0.7, FEET: 0.5 };
/** Shared uniforms, driven by camera.js every frame. */
export const cut = {
  on: uniform(0),                       // 0..1 strength
  target: uniform(new THREE.Vector3()), // the scholar's middle (the camera's look point)
  feet: uniform(-1e5),                  // world y of the soles (nothing below is cut: floors stay)
  end: uniform(0.9),                    // t (0 camera .. 1 target) where the cut stops (just in front of the body)
  fe: uniform(0.02),                    // ... feathered over this much t (a fixed width in world units)
  rad: uniform(2.6),                    // cone radius at the scholar, world units (it is ~3.2 tall)
};

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const _d = new THREE.Vector3(), _q = new THREE.Vector3();
/** CPU mirror of the mask: 0 drawn .. 1 fully cut (before the dither), for a world point seen from camera c. */
export function cutAlpha(p, c, terrain = false) {
  const on = cut.on.value;
  if (!on) return 0;
  const T = cut.target.value;
  _d.subVectors(T, c);
  const L2 = Math.max(_d.lengthSq(), 1e-4);
  const t = _q.subVectors(p, c).dot(_d) / L2;
  const perp = _q.subVectors(p, c).addScaledVector(_d, -t).length();
  const R = cut.rad.value * Math.min(1, Math.max(0, t)) + 0.15;
  const cone = smooth(R, R * CUT.FEATHER, perp) * smooth(cut.end.value, cut.end.value - cut.fe.value, t) * smooth(0, 0.02, t) * smooth(cut.feet.value, cut.feet.value + CUT.FEET, p.y);
  const near = terrain ? 0 : smooth(CUT.NEAR1, CUT.NEAR0, p.distanceTo(c));
  return Math.max(cone * CUT.MAX, near) * on;
}

let maskNode = null, coneNode = null, keepShadow = null;
function mask(terrain) {
  if (maskNode) return terrain ? coneNode : maskNode;
  const C = cameraPosition, P = positionWorld;
  const D = cut.target.sub(C);
  const L2 = max(dot(D, D), float(1e-4));
  const PC = P.sub(C);
  const t = dot(PC, D).div(L2);
  const perp = PC.sub(D.mul(t)).length();
  const R = cut.rad.mul(t.clamp(0, 1)).add(0.15);
  // (smoothstep needs edge0 < edge1 on the GPU: a falling ramp is 1 - smoothstep)
  const fall = (lo, hi, x) => float(1).sub(smoothstep(lo, hi, x));
  const cone = fall(R.mul(CUT.FEATHER), R, perp)
    .mul(fall(cut.end.sub(cut.fe), cut.end, t))
    .mul(smoothstep(0, 0.02, t))
    .mul(smoothstep(cut.feet, cut.feet.add(CUT.FEET), P.y));
  const near = fall(CUT.NEAR0, CUT.NEAR1, PC.length());
  // interleaved gradient noise: a fine, stable screen-door pattern
  const n = fract(float(52.9829189).mul(fract(dot(screenCoordinate.xy, vec2(0.06711056, 0.00583715)))));
  maskNode = n.greaterThanEqual(max(cone.mul(CUT.MAX), near).mul(cut.on));
  coneNode = n.greaterThanEqual(cone.mul(CUT.MAX).mul(cut.on));
  keepShadow = bool(true);
  return terrain ? coneNode : maskNode;
}

const skip = (o) => o.userData?.setFrame || o.userData?.noCut || o.userData?.actor;
/** Give every opaque scenery material under `root` the see-through mask (idempotent). */
export function applyCutout(root) {
  if (!root) return 0;
  mask();
  let n = 0;
  const visit = (o) => {
    if (skip(o)) return;
    if ((o.isMesh || o.isInstancedMesh) && !o.isSprite) {
      const m = mask(o.name === 'terrain');
      for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!mat || !mat.isNodeMaterial || mat.transparent || mat.userData.cutout || mat.maskNode) continue;
        mat.maskNode = m;
        mat.maskShadowNode = keepShadow;
        mat.userData.cutout = o.name === 'terrain' ? 'terrain' : true;
        mat.needsUpdate = true;
        n++;
      }
    }
    for (const c of o.children) visit(c);
  };
  visit(root);
  return n;
}
