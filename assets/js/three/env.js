// Environment checks that must not pull in three.js: the page asks these before deciding whether
// to download the 3D world at all.

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

/**
 * Cheap pre-flight BEFORE downloading/initialising anything heavy.
 * Returns { ok, reason, software } — `software` is true when only a software
 * rasteriser (SwiftShader / llvmpipe) is available; callers should then show a
 * static poster instead of a live scene (unless ?force=1).
 */
export function probeGPU() {
  const out = { ok: false, reason: '', software: false, renderer: '' };
  try {
    const c = document.createElement('canvas');
    const strict = c.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    const gl = strict || document.createElement('canvas').getContext('webgl2');
    if (!gl) { out.reason = 'no-webgl2'; return out; }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    out.renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    out.software = !strict || /swiftshader|llvmpipe|software|basic render/i.test(out.renderer);
    out.caveatNull = !strict;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    out.ok = true;
  } catch (e) { out.reason = String(e); }
  return out;
}
