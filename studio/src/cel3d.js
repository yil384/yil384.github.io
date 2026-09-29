// cel3d.js: a 3D-to-2D painterly renderer for the "3D anime" look. Models are lists of flat polygons; each frame
// they are transformed, projected through a perspective camera, back-face culled, sorted far-to-near and painted with
// p5.brush as flat cel washes (three tone bands from one light) with ink silhouettes and creases. Everything stays
// hand-painted and boils like the rest of the frame; there is no rasteriser, no z-buffer and no textures.
//
// Coordinates: world x right, y UP, z toward the viewer (right-handed). Screen space is the 1920x1080 frame, y down.
// Units are whatever the scene wants (a mech ~ 10 units tall works well with a camera 30-60 units away).

// ---------- vectors ----------
const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vmul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vlen = a => Math.hypot(a[0], a[1], a[2]);
const vnorm = a => { const l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const vlerp = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

// ---------- transforms ----------
// xf({ pos, rot: [rx, ry, rz] (radians, applied x then y then z), scale }) returns a function point -> point.
function xf(o = {}) {
  const [rx, ry, rz] = o.rot || [0, 0, 0], s = o.scale == null ? [1, 1, 1] : (typeof o.scale === 'number' ? [o.scale, o.scale, o.scale] : o.scale), p = o.pos || [0, 0, 0];
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  return ([x, y, z]) => {
    x *= s[0]; y *= s[1]; z *= s[2];
    let y1 = y * cx - z * sx, z1 = y * sx + z * cx, x1 = x;              // rotate x
    let x2 = x1 * cy + z1 * sy, z2 = -x1 * sy + z1 * cy, y2 = y1;        // rotate y
    let x3 = x2 * cz - y2 * sz, y3 = x2 * sz + y2 * cz, z3 = z2;         // rotate z
    return [x3 + p[0], y3 + p[1], z3 + p[2]];
  };
}
const compose = (...fs) => p => fs.reduceRight((q, f) => f(q), p);   // compose(outer, inner)(p) = outer(inner(p))

// ---------- meshes ----------
// A mesh (makeMesh) is { verts: [[x,y,z]...], faces: [{ i: [a,b,c,...], col, ink, glow, flat }] }. Faces are counter-clockwise
// when seen from outside. col: base colour; ink: outline colour (null = none); glow: emissive (no shading, 0..1 halo).
function makeMesh(verts, faces, col = PAL.slate) { return { verts, faces: faces.map(f => Array.isArray(f) ? { i: f, col } : { col, ...f }) }; }
function boxMesh(w, h, d, col = PAL.slate, o = {}) {
  const x = w / 2, y = h / 2, z = d / 2, oy = o.base ? h / 2 : 0;
  const V = [[-x, -y + oy, z], [x, -y + oy, z], [x, y + oy, z], [-x, y + oy, z], [-x, -y + oy, -z], [x, -y + oy, -z], [x, y + oy, -z], [-x, y + oy, -z]];
  const F = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]];
  return makeMesh(V, F.map(i => ({ i, ...o.face })), col);
}
// A prism: a 2D profile [[x, y], ...] (counter-clockwise, y up) extruded along z from -d/2 to d/2.
function prismMesh(profile, d, col = PAL.slate, o = {}) {
  const n = profile.length, V = [], F = [];
  for (const [x, y] of profile) V.push([x, y, d / 2]);
  for (const [x, y] of profile) V.push([x, y, -d / 2]);
  F.push({ i: profile.map((_, k) => k) });
  F.push({ i: profile.map((_, k) => n + (n - 1 - k)) });
  for (let k = 0; k < n; k++) { const a = k, b = (k + 1) % n; F.push({ i: [b, a, n + a, n + b] }); }
  return makeMesh(V, F.map(f => ({ ...f, ...o.face })), col);
}
// A lathe: a profile [[r, y], ...] revolved around the y axis in n steps (cylinders, cones, domes, thrusters).
function latheMesh(profile, n = 10, col = PAL.slate, o = {}) {
  const V = [], F = [], m = profile.length;
  for (let k = 0; k < n; k++) { const a = k / n * TAU; for (const [r, y] of profile) V.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
  for (let k = 0; k < n; k++) {
    const k2 = (k + 1) % n;
    for (let j = 0; j < m - 1; j++) {
      const a = k * m + j, b = k2 * m + j, c = k2 * m + j + 1, d = k * m + j + 1;
      if (profile[j][0] === 0) F.push({ i: [a, d, c] }); else if (profile[j + 1][0] === 0) F.push({ i: [a, b, d] }); else F.push({ i: [a, b, c, d] });
    }
  }
  if (o.capBottom !== false && profile[0][0] > 0) F.push({ i: Array.from({ length: n }, (_, k) => (n - 1 - k) * m) });
  if (o.capTop !== false && profile[m - 1][0] > 0) F.push({ i: Array.from({ length: n }, (_, k) => k * m + m - 1) });
  return makeMesh(V, F.map(f => ({ ...f, ...o.face })), col);
}
const cylMesh = (r, h, n = 10, col = PAL.slate, o = {}) => latheMesh([[r, -h / 2], [r, h / 2]], n, col, o);
const coneMesh = (r, h, n = 10, col = PAL.slate, o = {}) => latheMesh([[r, -h / 2], [0, h / 2]], n, col, o);
// A flat quad in the xz plane (ground tiles, decks, floors).
const quadMesh = (w, d, col = PAL.slate, o = {}) => makeMesh([[-w / 2, 0, d / 2], [w / 2, 0, d / 2], [w / 2, 0, -d / 2], [-w / 2, 0, -d / 2]], [{ i: [0, 1, 2, 3], ...o.face }], col);
// Merge several meshes into one part (they then sort together).
function mergeMesh(...ms) {
  const verts = [], faces = [];
  for (const m of ms) { const off = verts.length; verts.push(...m.verts); for (const f of m.faces) faces.push({ ...f, i: f.i.map(k => k + off) }); }
  return { verts, faces };
}
// Apply a transform to a mesh's vertices (returns a new mesh).
const placeMesh = (m, t) => ({ verts: m.verts.map(t), faces: m.faces });

// ---------- camera ----------
// cam3({ pos, look, fov (deg), up, roll }). toCam(p) -> camera space [x, y, z] (z = depth, > 0 in front);
// projectCam(c) -> [sx, sy, z] in frame px; project(p) does both (NaN when behind the near plane).
function cam3({ pos = [0, 10, 40], look = [0, 5, 0], fov = 40, up = [0, 1, 0], roll = 0, near = .5 } = {}) {
  const f = vnorm(vsub(look, pos));
  let r = vnorm(vcross(f, up)); let u = vcross(r, f);
  if (roll) { const c = Math.cos(roll), s = Math.sin(roll); const r2 = vadd(vmul(r, c), vmul(u, s)); u = vadd(vmul(u, c), vmul(r, -s)); r = r2; }
  const F = (H / 2) / Math.tan(fov * Math.PI / 360);
  const toCam = p => { const d = vsub(p, pos); return [vdot(d, r), vdot(d, u), vdot(d, f)]; };
  const projectCam = c => c[2] < near * .999 ? [NaN, NaN, c[2]] : [W / 2 + F * c[0] / Math.max(c[2], near), H / 2 - F * c[1] / Math.max(c[2], near), c[2]];
  const project = p => projectCam(toCam(p));
  const scaleAt = p => { const vz = vdot(vsub(p, pos), f); return vz > near ? F / vz : 0; };
  // A segment clipped to the near plane, projected: [[sx, sy], [sx, sy]] or null when fully behind the camera.
  const projectSeg = (a, b) => {
    let ca = toCam(a), cb = toCam(b);
    if (ca[2] < near && cb[2] < near) return null;
    const nz = near * 1.001;
    if (ca[2] < nz) ca = vlerp(ca, cb, (nz - ca[2]) / (cb[2] - ca[2]));
    else if (cb[2] < nz) cb = vlerp(cb, ca, (nz - cb[2]) / (ca[2] - cb[2]));
    const p = projectCam(ca), q = projectCam(cb);
    return [[p[0], p[1]], [q[0], q[1]]];
  };
  // Sutherland-Hodgman against z = near, in camera space.
  const clipPoly = cs => {
    const out = [];
    for (let i = 0; i < cs.length; i++) {
      const nz = near * 1.001, a = cs[i], b = cs[(i + 1) % cs.length], ia = a[2] >= nz, ib = b[2] >= nz;
      if (ia) out.push(a);
      if (ia !== ib) out.push(vlerp(a, b, (nz - a[2]) / (b[2] - a[2])));
    }
    return out;
  };
  return { pos, look, f, r, u, F, fov, near, toCam, projectCam, project, projectSeg, clipPoly, scaleAt };
}

// ---------- shading ----------
// Three tone bands from half-Lambert n.l, plus a cool rim toward the sky and a warm key. Colours derive from the
// face's own colour so every part keeps its identity: shadow = colour toward ink + shade tint, light = toward cream.
const CEL = { light: [.5, .6, .7], thresholds: [.42, .72], shadeTint: PAL.indigo, lightTint: PAL.cream, fog: PAL.night, fogNear: 60, fogFar: 200, fogAmount: .6 };
function celColor(col, n, o = {}) {
  const L = vnorm(o.light || CEL.light), v = vdot(n, L) * .5 + .5, [t0, t1] = o.thresholds || CEL.thresholds;
  const shade = mixCol(mixCol(col, o.shadeTint || CEL.shadeTint, .45), PAL.ink, .25), light = mixCol(col, o.lightTint || CEL.lightTint, .28);
  return v < t0 ? shade : v < t1 ? col : light;
}

// ---------- painting ----------
// cel3dPaint(cam, parts, o): parts = [{ mesh, at: transform fn (optional), key: boil key, ink, sw, glow, noShade, shadow }]
//   o.light: light direction; o.fog: true for depth fog; o.edges: 'silhouette' | 'all' | 'none'; o.jitter: boil px.
// Paints far-to-near by part centroid depth, then faces within a part far-to-near, then the part's ink edges.
function cel3dPaint(cam, parts, o = {}) {
  const jitter = o.jitter ?? 1.6, edgesMode = o.edges || 'silhouette';
  const list = [];
  for (const part of parts) {
    const t = part.at || (p => p), m = part.mesh;
    const wv = m.verts.map(t);
    const cv = wv.map(cam.toCam);
    if (cv.every(c => c[2] < cam.near)) continue;   // entirely behind the camera
    let cz = 0; for (const c of cv) cz += Math.max(c[2], cam.near); cz /= cv.length;
    list.push({ part, wv, cv, cz });
  }
  list.sort((a, b) => b.cz - a.cz);
  for (const { part, wv, cv, cz } of list) {
    const m = part.mesh, key = part.key || 'part' + cz.toFixed(2);
    boilSeed(key);
    const J = jitter * (part.jitter ?? 1);
    const faces = [];
    for (const f of m.faces) {
      const a = wv[f.i[0]], b = wv[f.i[1]], c = wv[f.i[2]];
      const n = vnorm(vcross(vsub(b, a), vsub(c, a)));
      const front = vdot(n, vsub(cam.pos, a)) > 0;
      let depth = 0; for (const k of f.i) depth += Math.max(cv[k][2], cam.near); depth /= f.i.length;
      faces.push({ f, n, front, depth });
    }
    const vis = faces.filter(x => x.front).sort((a, b) => b.depth - a.depth);
    if (typeof BUDGET !== 'undefined') BUDGET.faces += vis.length;
    if (part.shadow) {
      const g = cam.project([part.shadow[0], part.shadow[1], part.shadow[2]]), s = cam.scaleAt(part.shadow);
      if (Number.isFinite(g[0])) paint(ellPts(g[0], g[1], part.shadow[3] * s, part.shadow[3] * s * .28, 22), { fill: PAL.ink, fillOp: 110, bleed: .25, tex: .3, border: .1, ink: null });
    }
    for (const { f, n, depth } of vis) {
      let cs = f.i.map(k => cv[k]);
      if (cs.some(c => c[2] < cam.near)) { cs = cam.clipPoly(cs); if (cs.length < 3) continue; }
      const pts = cs.map(c => { const p = cam.projectCam(c); return [clamp(p[0], -3000, W + 3000) + jit(J), clamp(p[1], -3000, H + 3000) + jit(J)]; });
      if (!pts.some(inFrame)) { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } if (x1 < CLIP.x0 || x0 > CLIP.x1 || y1 < CLIP.y0 || y0 > CLIP.y1) continue; }
      let col = f.glow || part.glow ? f.col : (part.noShade ? f.col : celColor(f.col, n, { light: o.light, thresholds: part.thresholds }));
      if (o.fog) col = mixCol(col, o.fogColor || CEL.fog, CEL.fogAmount * seg(depth, CEL.fogNear, CEL.fogFar));
      paint(pts, { wash: col, washOp: f.op ?? part.op ?? 255, ink: null });
    }
    if (edgesMode !== 'none' && part.ink !== null) {
      const edge = new Map();
      faces.forEach((x, fi) => { const n = x.f.i.length; for (let k = 0; k < n; k++) { const a = x.f.i[k], b = x.f.i[(k + 1) % n], id = a < b ? a + ':' + b : b + ':' + a; (edge.get(id) || edge.set(id, []).get(id)).push(fi); } });
      const sw = (part.sw ?? 1) * clamp(cam.scaleAt(wv[0]) * .06, .5, 2.2), col = part.ink || PAL.ink;
      for (const [id, fs] of edge) {
        const [a, b] = id.split(':').map(Number);
        let draw = false;
        if (fs.length === 1) draw = faces[fs[0]].front;
        else { const A = faces[fs[0]], B = faces[fs[1]]; draw = A.front !== B.front || (edgesMode === 'all' && A.front && B.front && vdot(A.n, B.n) < (part.crease ?? .72)); }
        if (!draw) continue;
        const s = cam.projectSeg(wv[a], wv[b]);
        if (!s || Math.hypot(s[0][0] - s[1][0], s[0][1] - s[1][1]) < 3) continue;
        inkLine([[s[0][0] + jit(J), s[0][1] + jit(J)], [s[1][0] + jit(J), s[1][1] + jit(J)]], sw, col, part.brush || 'ink', 0);
      }
    }
  }
}

// A billboard hook: place a 2D drawing at a 3D point. draw(sx, sy, scale) gets the screen position and the
// pixels-per-unit scale, so a painted 2D character can stand inside a cel-3D set.
function billboard(cam, p, draw) { const s = cam.project(p); if (Number.isFinite(s[0])) draw(s[0], s[1], cam.scaleAt(p), s[2]); }

// Ground grid in perspective (hangar floors, runways): lines every `step` units over [-n, n], fading with distance.
function gridFloor(cam, y, step, n, col = PAL.steel, sw = .7) {
  boilSeed('grid');
  for (let i = -n; i <= n; i += step) {
    const a = cam.projectSeg([i, y, -n], [i, y, n]); if (a) inkLine(a, sw, col, 'inkfine', 0);
    const b = cam.projectSeg([-n, y, i], [n, y, i]); if (b) inkLine(b, sw, col, 'inkfine', 0);
  }
}

// Motion streaks behind a moving part: n ink lines trailing opposite the velocity in screen space.
function motionStreaks(sx, sy, vx, vy, len = 120, n = 6, col = PAL.mist, sw = 1) {
  const l = Math.hypot(vx, vy) || 1, dx = -vx / l, dy = -vy / l;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 14, px = sx - dy * off, py = sy + dx * off, k = .5 + hash(i) * .8;
    inkLine([[px, py], [px + dx * len * k, py + dy * len * k]], sw * (.5 + hash(i + 3)), col, 'inkfine', 0);
  }
}
