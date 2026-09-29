// engine/post.js — the "anime post stack" as a RenderPipeline graph (three r186, WebGPU + WebGL2).
//
// Export
//   createAnimePipeline(renderer, scene, camera, {
//     quality: 'full' | 'cheap',
//     outline:  { color = '#0a0a12', thickness = 0.003 },   // toonOutlinePass (only toon materials get lines)
//     bloom:    { strength = 1.2, radius = 0.6, threshold = 0 },
//     scanlines: false,                                      // build the scanline term at all
//   }) -> { pipeline, scenePass, bloomPass, render(), setSize(w, h), setQuality(q), quality,
//           uniforms: { impact, shake, aberration, speedLines, vignette, scanlines, flash } }
//
// Graph (full):  toonOutlinePass(MRT output+emissive) -> bloom(emissive) added in linear HDR
//                -> ONE rtt (convertToTexture) -> shake + chromatic aberration + zoom blur (18 taps)
//                -> renderOutput() (tone map + sRGB) -> speed lines, scanlines, vignette, impact frame,
//                flash (all arithmetic) -> vec4(rgb,1) -> fxaa (last, needs sRGB: one more rtt).
// Graph (cheap): toonOutlinePass -> bloom at 1/4 res -> renderOutput -> vignette, impact, flash -> fxaa.
//                (shake / aberration / speedLines / scanlines uniforms exist but are no-ops here.)
//
// Rules the caller must follow
//   * `await renderer.init()` before calling; create the renderer with `antialias: false`
//     (MRT + MSAA on the WebGL2 backend needs an extension and warns) — FXAA is applied last anyway.
//   * Set `renderer.toneMapping` (e.g. THREE.NeutralToneMapping) BEFORE calling.
//   * Call `render()` instead of renderer.render(); `setSize()` instead of renderer.setSize().
//   * Drive the effects by mutating `uniforms.*.value` (impact is binary: hold 1 for 2-3 frames).
//   * Only materials with an emissive term bloom (neonMaterial, emissiveNode, MeshStandard emissive).
//   * The emissive MRT output ignores opacityNode and is written with alpha 1: transparent glow
//     materials must use AdditiveBlending and multiply their emissiveNode by their own opacity mask.
//   * Materials without any emissive leave the attachment uninitialised in GLSL; WebGL (ANGLE)
//     zero-initialises locals, WGSL always does. Engine materials still set emissiveNode = 0 explicitly.
//   * `impact` is binary: hold it for a fixed clock time (~0.1 s), not a frame count.
import * as THREE from 'three/webgpu';
import {
  Fn, float, vec2, vec3, vec4, uniform, uv, mix, length, step, smoothstep, luminance, hash, atan, fract,
  screenUV, screenSize, screenCoordinate, interleavedGradientNoise, convertToTexture, mrt, output, emissive,
  toonOutlinePass, time, PI, TWO_PI,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { scanlines as crtScanlines } from 'three/addons/tsl/display/CRT.js';

/** Drawn manga speed lines (0/1-ish mask radiating from the centre); pure arithmetic. */
const speedLineMask = Fn(([amount, inner, count]) => {
  const p = uv().sub(0.5).mul(vec2(screenSize.x.div(screenSize.y), 1)); // aspect-correct
  const ang = atan(p.y, p.x).add(PI).div(TWO_PI); // 0..1 around
  const r = p.length();
  const seg = ang.mul(count).floor();
  const phase = hash(seg.add(1000)); // per-line random
  const jitter = hash(seg.add(time.mul(24).floor().mul(7))); // flicker at 24 fps
  const inStripe = ang.mul(count).fract().sub(0.5).abs().mul(2); // 0 at stripe centre .. 1
  const width = phase.mul(0.5).add(0.15).mul(jitter.mul(0.5).add(0.5));
  const stripe = inStripe.smoothstep(width.sub(0.15), width).oneMinus();
  const start = inner.add(phase.mul(0.3));
  const radial = r.smoothstep(start, start.add(0.25));
  return stripe.mul(radial).mul(amount);
});

export function createAnimePipeline(renderer, scene, camera, {
  quality = 'full',
  outline = {},
  bloom: bloomOpts = {},
  scanlines: withScanlines = false,
  debug = {}, // QA only: noBlendMode, noOutlineEmissive, noBloom, noFinish, noFxaa, noVignette
} = {}) {
  const { color: outlineColor = '#0a0a12', thickness: outlineThickness = 0.003 } = outline;
  const { strength = 1.2, radius = 0.6, threshold = 0 } = bloomOpts;

  // 1. beauty (+ toon outlines baked in) with emissive MRT
  const scenePass = toonOutlinePass(scene, camera, new THREE.Color(outlineColor), outlineThickness, 1);
  // The outline material is a bare NodeMaterial: give it an explicit emissive so the MRT
  // emissive attachment never contains uninitialised fragments on GLSL.
  const createOutlineMaterial = scenePass._createMaterial.bind(scenePass);
  if (!debug.noOutlineEmissive) scenePass._createMaterial = () => { const m = createOutlineMaterial(); m.emissiveNode = vec3(0); return m; };
  // Non-`output` MRT attachments default to NoBlending (overwrite) on WebGPU, while WebGL2 without
  // OES_draw_buffers_indexed blends every attachment with the material's state. Use the material
  // blending for `emissive` on both, so additive glow sprites add and never erase the glow behind.
  const mrtNode = mrt({ output, emissive });
  scenePass.setMRT(debug.noBlendMode ? mrtNode : mrtNode.setBlendMode('emissive', new THREE.BlendMode(THREE.MaterialBlending)));
  const beauty = scenePass.getTextureNode('output');
  const emissTex = scenePass.getTextureNode('emissive');

  // 2. bloom on the emissive attachment only (threshold 0 -> everything emissive blooms)
  const bloomPass = bloom(emissTex, debug.noBloom ? 0 : strength, radius, threshold);

  // uniforms the page animates
  const impact = uniform(0); // 0/1 manga impact frame (binary)
  const shake = uniform(new THREE.Vector2()); // screen offset in UV units (~0.03 on hit)
  const aberration = uniform(0); // chromatic aberration strength (0.004 idle .. 0.02 hit)
  const speedLines = uniform(0); // 0..1 drawn speed lines + zoom blur
  const vignette = uniform(0.35); // 0..1
  const scanlinesU = uniform(withScanlines ? 0.1 : 0); // intensity (only built when scanlines:true)
  const flash = uniform(0); // 0..1 white flash
  const uniforms = { impact, shake, aberration, speedLines, vignette, scanlines: scanlinesU, flash };

  const vig = screenUV.distance(.5).remap(.6, 1).mul(2).clamp().oneMinus(); // 1 centre -> 0 corners

  const ldrFinish = (ldr, { full }) => {
    if (debug.noFinish) return vec4(ldr.rgb, 1);
    let c = ldr;
    if (full) c = mix(c, vec4(1), speedLineMask(speedLines, float(0.25), float(140)));
    if (full && withScanlines) c = crtScanlines(c, scanlinesU, screenSize.y.mul(0.5), float(0));
    if (!debug.noVignette) c = c.mul(mix(float(1), vig, vignette));
    // impact frame (binary two-tone: bright -> ink, dark -> paper) + flash, forced opaque.
    // Plain node expressions, no Fn() wrapper (fxaa() renders its input to a texture first).
    const g = luminance(c.rgb);
    const inv = vec3(step(0.5, g).oneMinus());
    const out = mix(mix(c.rgb, inv, step(0.01, impact)), vec3(1), flash.clamp(0, 1));
    return vec4(out, 1);
  };

  // FULL: hdr composite -> one RTT -> distortion group -> LDR finish -> FXAA
  const buildFull = () => {
    const hdrTex = convertToTexture(beauty.add(bloomPass)); // exactly one extra pass (HalfFloat)
    const N = 6;
    const distorted = Fn(() => {
      const zoomSafe = float(1).sub(length(shake).mul(2)); // keep the clamped border off-screen while shaking
      const p = uv().sub(0.5).mul(zoomSafe).add(0.5).add(shake);
      const dir = p.sub(0.5);
      const off = dir.mul(aberration).mul(length(dir).mul(2)); // stronger at the edges
      const zd = dir.negate().mul(speedLines.mul(0.06));
      const j = interleavedGradientNoise(screenCoordinate).div(N);
      const acc = vec3(0).toVar();
      for (let i = 0; i < N; i++) {
        const q = p.add(zd.mul(float((i + 0.5) / N).add(j)));
        acc.addAssign(vec3(hdrTex.sample(q.add(off)).r, hdrTex.sample(q).g, hdrTex.sample(q.sub(off)).b));
      }
      return vec4(acc.div(N), 1);
    })();
    const fin = ldrFinish(distorted.renderOutput(), { full: true });
    return debug.noFxaa ? fin : fxaa(fin);
  };

  // CHEAP: no RTT for distortion; bloom at quarter res
  const buildCheap = () => { const fin = ldrFinish(beauty.add(bloomPass).renderOutput(), { full: false }); return debug.noFxaa ? fin : fxaa(fin); };

  const pipeline = new THREE.RenderPipeline(renderer);
  pipeline.outputColorTransform = false; // we call renderOutput() ourselves (before the LDR effects)
  const graphs = {};
  let current = null;
  const setQuality = (q) => {
    if (q !== 'cheap') q = 'full';
    if (!graphs[q]) graphs[q] = q === 'full' ? buildFull() : buildCheap();
    bloomPass.setResolutionScale(q === 'full' ? 0.5 : 0.25);
    pipeline.outputNode = graphs[q];
    pipeline.needsUpdate = true;
    current = q;
    api.quality = q;
  };

  const api = {
    pipeline, scenePass, bloomPass, uniforms, quality,
    render() { pipeline.render(); },
    setSize(w, h, updateStyle = false) {
      renderer.setSize(w, h, updateStyle);
      if (camera.isPerspectiveCamera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
    },
    setQuality,
    bloom: { strength: bloomPass.strength, radius: bloomPass.radius, threshold: bloomPass.threshold },
    get current() { return current; },
  };
  setQuality(quality);
  return api;
}
