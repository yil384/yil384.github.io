// The comic-print shader (TSL node material): Sobel ink lines, posterised light, halftone dots in the shadows and a
// little saturation punch, blended with the clean clip by a strength uniform (1 = printed comic panel, 0 = clean).
import * as THREE from 'three/webgpu';
import { Fn, texture, uniform, uv, vec2, vec3, float, dot, mix, smoothstep, clamp, floor, fract, length, max, screenCoordinate, sin, cos } from 'three/tsl';

export function comicMaterial(tex) {
  const uStrength = uniform(0);
  const uTexel = uniform(new THREE.Vector2(1 / 1280, 1 / 720));
  const uCell = uniform(7.0); // halftone cell in output px
  const uInk = uniform(1.0); // ink line weight multiplier

  const LW = vec3(0.299, 0.587, 0.114);
  const lumAt = (p) => dot(texture(tex, p).rgb, LW);

  const node = Fn(() => {
    const st = uv();
    const c = texture(tex, st).rgb;
    const o = uTexel.mul(1.35).mul(uInk);
    // Sobel on luminance
    const tl = lumAt(st.add(vec2(o.x.negate(), o.y))), tc = lumAt(st.add(vec2(0, o.y))), tr = lumAt(st.add(o));
    const ml = lumAt(st.add(vec2(o.x.negate(), 0))), mr = lumAt(st.add(vec2(o.x, 0)));
    const bl = lumAt(st.sub(o)), bc = lumAt(st.sub(vec2(0, o.y))), br = lumAt(st.add(vec2(o.x, o.y.negate())));
    const gx = tr.add(mr.mul(2)).add(br).sub(tl).sub(ml.mul(2)).sub(bl);
    const gy = tl.add(tc.mul(2)).add(tr).sub(bl).sub(bc.mul(2)).sub(br);
    const edge = length(vec2(gx, gy));
    const ink = smoothstep(0.22, 0.5, edge);

    // saturation punch + posterised light (hue kept, light quantised into soft bands)
    const l = dot(c, LW);
    const sat = clamp(mix(vec3(l), c, 1.45), 0, 1);
    const levels = float(4.0);
    const q = l.mul(levels);
    const band = floor(q).add(smoothstep(0.42, 0.58, fract(q))).div(levels);
    const lq = clamp(band.mul(0.92).add(0.1), 0.06, 1.0);
    const post = clamp(sat.mul(lq.div(max(l, 0.04))), 0, 1);

    // halftone in output pixels, 45 deg screen: dot radius grows with darkness, only in the shadows/mid-tones
    const sc = screenCoordinate.xy;
    const a = 0.785;
    const rp = vec2(sc.x.mul(cos(a)).sub(sc.y.mul(sin(a))), sc.x.mul(sin(a)).add(sc.y.mul(cos(a)))).div(uCell);
    const d = length(fract(rp).sub(0.5));
    const rad = clamp(float(0.5).sub(l).mul(1.0), 0, 0.45);
    const dotMask = float(1).sub(smoothstep(rad.sub(0.07), rad.add(0.07), d)).mul(smoothstep(0.0, 0.05, rad));
    let comic = mix(post, post.mul(0.4), dotMask.mul(0.8));

    // paper: the brightest areas go to warm paper white
    const paper = vec3(1.0, 0.992, 0.957);
    comic = mix(comic, paper, smoothstep(0.82, 0.95, l).mul(0.85));
    // ink
    comic = mix(comic, vec3(0.067, 0.067, 0.067), ink.mul(0.95));
    return mix(c, comic, uStrength);
  })();

  const mat = new THREE.MeshBasicNodeMaterial();
  mat.colorNode = node;
  mat.toneMapped = false;
  return { mat, uStrength, uTexel, uCell, uInk };
}

