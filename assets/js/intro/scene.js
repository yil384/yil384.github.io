// The intro's 2D stage: a night skyline where UC San Diego meets a ninja city, Lord Deadline rising behind it,
// a fighting-game VS card, the Green Ninja's tornado against the deadline beam, impact frames, a SUBMITTED
// stamp and the cracks the glass breaks along (intro.js then hands the last frame to the shatter).
// Everything is drawn here, no image files: the static layers are painted once into offscreen canvases
// (parallax planes), characters into sprites, and the effects live, every frame, in "units" where the
// screen is 1000 units tall. All characters are original.
import { drawCracks } from './fracture.js';
import { ART } from './art.js';

const TAU = Math.PI * 2;
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const eo = (x) => 1 - (1 - x) ** 3;
const ei = (x) => x * x * x;
const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const wave = (t, a, b) => Math.sin(t * a + b);

/** The beats, in seconds. */
export const BEAT = {
  slash: 0.1, open: 0.42, rise: 0.82, warn: 1.12, eyes: 1.4, bolt: 1.5, vs: 1.74, vsOut: 2.44, vsEnd: 2.56,
  leap: 2.5, spin: 2.72, comets: 2.78, beamL: 2.98, beamN: 3.1, impact: 3.58, flash: 3.72, stamp: 3.76,
  crack: 3.86, shatter: 4.1,
};

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mk = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
};

const RGB = {
  white: '255,255,255', green: '61,255,143', purple: '180,77,255', red: '255,44,60', orange: '255,140,40',
  cyan: '120,225,255', gold: '255,201,74', pink: '255,130,190', blue: '95,150,255',
};

function glowSprite(rgb, hot) {
  const c = mk(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  if (hot) { gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, `rgba(${rgb},0.9)`); }
  else gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(0.42, `rgba(${rgb},0.28)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return c;
}

// ---------------------------------------------------------------- shapes shared by the painters
function roof(g, cx, y, w, h) {
  g.beginPath();
  g.moveTo(cx - w / 2, y - h * 0.3);
  g.quadraticCurveTo(cx - w * 0.4, y + h * 0.06, cx - w * 0.26, y);
  g.lineTo(cx + w * 0.26, y);
  g.quadraticCurveTo(cx + w * 0.4, y + h * 0.06, cx + w / 2, y - h * 0.3);
  g.quadraticCurveTo(cx + w * 0.22, y - h * 0.32, cx + w * 0.09, y - h);
  g.lineTo(cx - w * 0.09, y - h);
  g.quadraticCurveTo(cx - w * 0.22, y - h * 0.32, cx - w / 2, y - h * 0.3);
  g.fill();
}

function windows(g, rand, x, y, w, h, rgb, p, sw = 3, sh = 4, gx = 8, gy = 11) {
  for (let yy = y; yy < y + h - sh; yy += gy) {
    for (let xx = x; xx < x + w - sw; xx += gx) {
      if (rand() > p) continue;
      g.fillStyle = `rgba(${rgb},${(0.3 + rand() * 0.6).toFixed(2)})`;
      g.fillRect(xx, yy, sw, sh);
    }
  }
}

function spike(g, x, y, a, len, wid) {
  const dx = Math.sin(a), dy = -Math.cos(a), nx = -dy, ny = dx;
  g.beginPath();
  g.moveTo(x + nx * wid / 2, y + ny * wid / 2);
  g.lineTo(x + dx * len, y + dy * len);
  g.lineTo(x - nx * wid / 2, y - ny * wid / 2);
  g.fill();
}

function boltPath(x1, y1, x2, y2, disp, rand, depth = 5) {
  let pts = [[x1, y1], [x2, y2]];
  let d = disp;
  for (let k = 0; k < depth; k++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const l = Math.hypot(bx - ax, by - ay) || 1;
      const o = (rand() - 0.5) * d;
      next.push([(ax + bx) / 2 + (-(by - ay) / l) * o, (ay + by) / 2 + ((bx - ax) / l) * o], pts[i + 1]);
    }
    pts = next;
    d *= 0.55;
  }
  return pts;
}

function strokePts(g, pts) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.stroke();
}

// ---------------------------------------------------------------- the Green Ninja (original character)
const POSE = {
  ready: { hip: [0, -44], chest: [5, -67], head: [10, -84], kF: [15, -25], fF: [26, 0], kB: [-13, -23], fB: [-28, 0],
    sF: [9, -68], eF: [21, -58], hF: [31, -61], sB: [1, -68], eB: [-11, -57], hB: [-21, -50], tip: [70, -84] },
  leap: { hip: [0, -48], chest: [7, -70], head: [13, -87], kF: [17, -42], fF: [7, -26], kB: [-5, -34], fB: [-17, -20],
    sF: [10, -72], eF: [22, -82], hF: [31, -91], sB: [3, -71], eB: [-10, -79], hB: [-19, -71], tip: [60, -121] },
};

function ninjaFigure(g, P, col) {
  g.strokeStyle = g.fillStyle = col;
  g.lineCap = g.lineJoin = 'round';
  const limb = (a, b, c, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.stroke(); };
  limb(P.sB, P.eB, P.hB, 6);
  limb(P.hip, P.kB, P.fB, 7.6);
  const dx = P.chest[0] - P.hip[0], dy = P.chest[1] - P.hip[1], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
  g.beginPath();
  g.moveTo(P.chest[0] + nx * 9.5, P.chest[1] + ny * 9.5); g.lineTo(P.chest[0] - nx * 9.5, P.chest[1] - ny * 9.5);
  g.lineTo(P.hip[0] - nx * 7, P.hip[1] - ny * 7); g.lineTo(P.hip[0] + nx * 7, P.hip[1] + ny * 7);
  g.fill();
  g.beginPath(); g.arc(P.head[0], P.head[1], 8.8, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(P.head[0] - 4, P.head[1] - 7); g.lineTo(P.head[0] - 15, P.head[1] - 3); g.lineTo(P.head[0] - 6, P.head[1] + 5); g.fill();
  limb(P.hip, P.kF, P.fF, 7.6);
  limb(P.sF, P.eF, P.hF, 6);
}

function paintNinja(g, P) {
  g.save(); g.translate(1.5, -1.3); ninjaFigure(g, P, '#5dffa4'); g.restore();
  ninjaFigure(g, P, '#06140d');
  // sword: a pale blade with a green edge
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(61,255,143,0.35)'; g.lineWidth = 7;
  g.beginPath(); g.moveTo(P.hF[0], P.hF[1]); g.lineTo(P.tip[0], P.tip[1]); g.stroke();
  g.strokeStyle = '#e4fff0'; g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(P.hF[0], P.hF[1]); g.lineTo(P.tip[0], P.tip[1]); g.stroke();
  // sash and eyes
  g.strokeStyle = '#e8333f'; g.lineWidth = 3.4;
  g.beginPath(); g.moveTo(P.hip[0] - 7, P.hip[1] - 3); g.lineTo(P.hip[0] + 7, P.hip[1] - 4); g.stroke();
  g.strokeStyle = '#eafff2'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(P.head[0] + 2, P.head[1] - 1.5); g.lineTo(P.head[0] + 8.4, P.head[1] - 2.6); g.stroke();
}

// the VS-card portrait: hooded, masked, eyes lit, a Triton trident on the chest
function paintNinjaBust(g) {
  const sil = (col) => {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(-158, 40); g.lineTo(-70, -228); g.lineTo(-40, -218); g.lineTo(-122, 52); g.fill();
    g.beginPath(); g.moveTo(-290, 460); g.lineTo(-262, 150); g.quadraticCurveTo(-246, 66, -160, 42); g.lineTo(-62, 18);
    g.quadraticCurveTo(0, 40, 62, 16); g.lineTo(164, 38); g.quadraticCurveTo(256, 60, 274, 152); g.lineTo(300, 460); g.fill();
    g.beginPath(); g.moveTo(-110, -36); g.quadraticCurveTo(-158, -186, -74, -286); g.quadraticCurveTo(10, -350, 100, -288);
    g.quadraticCurveTo(156, -236, 150, -132); g.quadraticCurveTo(146, -58, 92, -18); g.quadraticCurveTo(12, 14, -62, -8); g.fill();
    g.beginPath(); g.moveTo(-96, -196); g.quadraticCurveTo(-190, -250, -282, -238); g.quadraticCurveTo(-200, -214, -110, -170); g.fill();
    g.beginPath(); g.moveTo(-96, -180); g.quadraticCurveTo(-180, -170, -268, -120); g.quadraticCurveTo(-180, -140, -104, -158); g.fill();
  };
  g.save(); g.translate(9, -6); sil('#c9ffe0'); g.restore();
  sil('#0a2416');
  // katana handle over the far shoulder
  g.save();
  g.strokeStyle = '#151515'; g.lineWidth = 26; g.lineCap = 'butt';
  g.beginPath(); g.moveTo(-136, 20); g.lineTo(-62, -214); g.stroke();
  g.strokeStyle = '#d7a640'; g.lineWidth = 3;
  for (let k = 0.1; k < 0.95; k += 0.12) {
    const x = lerp(-136, -62, k), y = lerp(20, -214, k);
    g.beginPath(); g.moveTo(x - 11, y - 4); g.lineTo(x + 11, y + 4); g.stroke();
  }
  g.fillStyle = '#2a2a2a'; g.beginPath(); g.ellipse(-140, 34, 34, 11, -1.27, 0, TAU); g.fill();
  g.restore();
  // body: the gi, lit from the right
  const gi = g.createLinearGradient(-290, 0, 300, 0);
  gi.addColorStop(0, '#0d4527'); gi.addColorStop(0.55, '#1d8a4c'); gi.addColorStop(1, '#3acb74');
  g.fillStyle = gi;
  g.beginPath(); g.moveTo(-290, 460); g.lineTo(-262, 150); g.quadraticCurveTo(-246, 66, -160, 42); g.lineTo(-62, 18);
  g.quadraticCurveTo(0, 40, 62, 16); g.lineTo(164, 38); g.quadraticCurveTo(256, 60, 274, 152); g.lineTo(300, 460); g.fill();
  g.fillStyle = '#0a3a20';
  g.beginPath(); g.moveTo(-58, 20); g.lineTo(18, 210); g.lineTo(66, 18); g.fill();
  g.strokeStyle = '#0c4426'; g.lineWidth = 6;
  g.beginPath(); g.moveTo(-60, 22); g.quadraticCurveTo(-10, 120, 30, 230); g.stroke();
  // strap
  g.strokeStyle = '#24160d'; g.lineWidth = 36; g.lineCap = 'butt';
  g.beginPath(); g.moveTo(-190, 50); g.lineTo(230, 470); g.stroke();
  g.strokeStyle = 'rgba(255,220,160,0.18)'; g.lineWidth = 2; g.setLineDash([8, 7]);
  g.beginPath(); g.moveTo(-180, 40); g.lineTo(240, 458); g.stroke();
  g.setLineDash([]);
  // shoulder plates with gold trim
  const plate = (path, fill) => { g.fillStyle = fill; g.beginPath(); path(); g.fill(); g.strokeStyle = '#e8b64a'; g.lineWidth = 5; g.stroke(); };
  plate(() => { g.moveTo(132, 46); g.quadraticCurveTo(232, 14, 286, 112); g.quadraticCurveTo(298, 160, 274, 190); g.quadraticCurveTo(204, 156, 136, 118); g.closePath(); }, '#16673c');
  plate(() => { g.moveTo(150, 92); g.quadraticCurveTo(230, 82, 280, 160); g.quadraticCurveTo(206, 140, 150, 126); g.closePath(); }, '#12572f');
  plate(() => { g.moveTo(-150, 48); g.quadraticCurveTo(-232, 34, -262, 120); g.quadraticCurveTo(-210, 116, -138, 104); g.closePath(); }, '#0f4d2b');
  // the Triton trident medallion
  g.save(); g.translate(64, 252);
  g.fillStyle = '#0a2c18'; g.beginPath(); g.arc(0, 0, 44, 0, TAU); g.fill();
  g.strokeStyle = '#f1c34f'; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.stroke();
  g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 28); g.lineTo(0, -26); g.moveTo(-17, -22); g.lineTo(-17, -4); g.quadraticCurveTo(-17, 6, 0, 6); g.quadraticCurveTo(17, 6, 17, -4); g.lineTo(17, -22); g.stroke();
  g.fillStyle = '#f1c34f';
  for (const x of [-17, 0, 17]) { g.beginPath(); g.moveTo(x - 6, x ? -20 : -24); g.lineTo(x, x ? -31 : -36); g.lineTo(x + 6, x ? -20 : -24); g.fill(); }
  g.restore();
  // scarf wrap at the neck
  g.fillStyle = '#167140';
  g.beginPath(); g.moveTo(-74, 30); g.quadraticCurveTo(0, 74, 82, 24); g.lineTo(76, -34); g.quadraticCurveTo(0, -12, -70, -28); g.fill();
  g.strokeStyle = '#0d4d2a'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(-60, 4); g.quadraticCurveTo(0, 36, 70, 2); g.stroke();
  // the hood
  const hood = g.createRadialGradient(80, -190, 10, 20, -150, 210);
  hood.addColorStop(0, '#45dc86'); hood.addColorStop(0.45, '#1c8b4c'); hood.addColorStop(1, '#0b3d22');
  g.fillStyle = hood;
  g.beginPath(); g.moveTo(-110, -36); g.quadraticCurveTo(-158, -186, -74, -286); g.quadraticCurveTo(10, -350, 100, -288);
  g.quadraticCurveTo(156, -236, 150, -132); g.quadraticCurveTo(146, -58, 92, -18); g.quadraticCurveTo(12, 14, -62, -8); g.closePath(); g.fill();
  g.strokeStyle = '#0d4a28'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(-40, -300); g.quadraticCurveTo(-118, -210, -86, -60); g.stroke();
  g.beginPath(); g.moveTo(-6, -128); g.quadraticCurveTo(60, -112, 140, -118); g.stroke();
  g.strokeStyle = 'rgba(8,50,26,0.6)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(40, -96); g.quadraticCurveTo(80, -74, 120, -72); g.stroke();
  // headband with the knot tails
  g.fillStyle = '#d9a63a';
  g.beginPath(); g.moveTo(-88, -232); g.quadraticCurveTo(30, -262, 146, -226); g.lineTo(150, -204); g.quadraticCurveTo(30, -238, -84, -206); g.fill();
  g.beginPath(); g.moveTo(-96, -226); g.quadraticCurveTo(-190, -262, -282, -238); g.quadraticCurveTo(-196, -232, -104, -206); g.fill();
  g.beginPath(); g.moveTo(-98, -210); g.quadraticCurveTo(-182, -186, -268, -120); g.quadraticCurveTo(-176, -160, -100, -192); g.fill();
  g.fillStyle = '#b98422'; g.beginPath(); g.arc(-98, -216, 15, 0, TAU); g.fill();
  // the eye slit: shadow, then two lit eyes
  g.fillStyle = '#04120a';
  g.beginPath(); g.moveTo(-14, -192); g.quadraticCurveTo(52, -206, 134, -194); g.quadraticCurveTo(140, -164, 132, -146);
  g.quadraticCurveTo(54, -156, -8, -146); g.quadraticCurveTo(-24, -170, -14, -192); g.fill();
  g.save();
  g.shadowColor = 'rgba(61,255,143,1)'; g.shadowBlur = 26 * g.getTransform().a;
  g.fillStyle = '#effff5';
  g.beginPath(); g.moveTo(70, -170); g.quadraticCurveTo(96, -186, 124, -182); g.quadraticCurveTo(110, -162, 76, -160); g.fill();
  g.beginPath(); g.moveTo(4, -168); g.quadraticCurveTo(22, -180, 42, -178); g.quadraticCurveTo(34, -162, 8, -160); g.fill();
  g.restore();
  // shading: a little darker on the left, comic dots in the shadow
  g.globalCompositeOperation = 'source-atop';
  const sh = g.createLinearGradient(-300, 0, 120, 0);
  sh.addColorStop(0, 'rgba(0,10,4,0.5)'); sh.addColorStop(1, 'rgba(0,10,4,0)');
  g.fillStyle = sh; g.fillRect(-320, -360, 640, 840);
  g.fillStyle = 'rgba(0,30,12,0.28)';
  for (let y = -340; y < 470; y += 11) for (let x = -320 + ((y / 11) % 2) * 5.5; x < -60; x += 11) {
    const r = 3.6 * clamp01((-60 - x) / 260);
    if (r > 0.4) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  }
  g.globalCompositeOperation = 'source-over';
}

// ---------------------------------------------------------------- Lord Deadline (original character)
function lordShape(g, col) {
  g.fillStyle = g.strokeStyle = col;
  g.lineCap = g.lineJoin = 'round';
  // cape
  g.beginPath(); g.moveTo(-150, -150);
  g.bezierCurveTo(-270, -30, -350, 220, -420, 540);
  for (let x = -420, i = 0; x < 420; x += 60, i++) { g.lineTo(x + 30, 476 + ((i * 37) % 50)); g.lineTo(x + 60, 540); }
  g.bezierCurveTo(350, 220, 270, -30, 150, -150); g.closePath(); g.fill();
  for (const sx of [-1, 1]) lordArm(g, sx, [168, -150], [332, -236], [294, -384], 76, 56);
  g.beginPath(); g.moveTo(-174, -166); g.lineTo(174, -166);
  g.bezierCurveTo(184, -40, 158, 90, 112, 210); g.lineTo(128, 540); g.lineTo(-128, 540); g.lineTo(-112, 210);
  g.bezierCurveTo(-158, 90, -184, -40, -174, -166); g.fill();
  g.fillRect(-58, -232, 116, 84);
  for (const sx of [-1, 1]) lordArm(g, sx, [150, -54], [302, 34], [238, 166], 64, 48);
  for (const sx of [-1, 1]) {
    g.save(); g.scale(sx, 1);
    g.beginPath(); g.moveTo(92, -196);
    g.bezierCurveTo(140, -262, 262, -246, 292, -160);
    g.bezierCurveTo(306, -108, 280, -66, 236, -60);
    g.bezierCurveTo(190, -54, 140, -84, 104, -116); g.closePath(); g.fill();
    spike(g, 150, -236, -0.45, 84, 28); spike(g, 212, -242, 0.02, 104, 30); spike(g, 266, -204, 0.5, 84, 26);
    g.restore();
  }
  for (const sx of [-1, 1]) {
    g.save(); g.scale(sx, 1);
    g.beginPath(); g.moveTo(56, -312);
    g.bezierCurveTo(150, -330, 238, -362, 248, -505);
    g.bezierCurveTo(214, -412, 150, -322, 74, -262);
    g.closePath(); g.fill();
    g.beginPath(); g.moveTo(72, -252); g.lineTo(122, -214); g.lineTo(68, -190); g.fill();
    g.restore();
  }
  g.beginPath(); g.moveTo(-80, -200);
  g.bezierCurveTo(-98, -292, -64, -352, 0, -356);
  g.bezierCurveTo(64, -352, 98, -292, 80, -200);
  g.lineTo(56, -168); g.lineTo(0, -144); g.lineTo(-56, -168); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-16, -346); g.lineTo(0, -456); g.lineTo(16, -346); g.fill();
}

function lordArm(g, sx, s, e, h, w1, w2) {
  const S = [s[0] * sx, s[1]], E = [e[0] * sx, e[1]], H = [h[0] * sx, h[1]];
  g.lineWidth = w1; g.beginPath(); g.moveTo(S[0], S[1]); g.lineTo(E[0], E[1]); g.stroke();
  g.lineWidth = w2; g.beginPath(); g.moveTo(E[0], E[1]); g.lineTo(H[0], H[1]); g.stroke();
  g.beginPath(); g.arc(H[0], H[1], w2 * 0.66, 0, TAU); g.fill();
  const a0 = Math.atan2(H[1] - E[1], H[0] - E[0]);
  for (let i = -1.5; i <= 1.5; i += 1) {
    const a = a0 + i * 0.36;
    const bx = H[0] + Math.cos(a) * w2 * 0.4, by = H[1] + Math.sin(a) * w2 * 0.4;
    const tx = H[0] + Math.cos(a + 0.22 * sx) * w2 * 1.55, ty = H[1] + Math.sin(a + 0.22 * sx) * w2 * 1.55;
    const nx = -Math.sin(a) * w2 * 0.16, ny = Math.cos(a) * w2 * 0.16;
    g.beginPath(); g.moveTo(bx + nx, by + ny); g.quadraticCurveTo((bx + tx) / 2 + nx * 1.6, (by + ty) / 2 + ny * 1.6, tx, ty); g.lineTo(bx - nx, by - ny); g.fill();
  }
}

function paintLord(g) {
  g.save(); g.translate(7, -7); lordShape(g, '#d06cff'); g.restore();
  g.save(); g.translate(-3, 4); g.globalAlpha = 0.6; lordShape(g, '#5b1b8a'); g.restore();
  lordShape(g, '#0d0613');
  const plate = '#2a1346';
  g.strokeStyle = plate; g.lineWidth = 6; g.lineCap = 'round';
  // armour lines: chest V, ribs, belt
  g.beginPath(); g.moveTo(-160, -150); g.quadraticCurveTo(-60, -70, 0, -76); g.quadraticCurveTo(60, -70, 160, -150); g.stroke();
  for (const y of [100, 140]) { g.beginPath(); g.moveTo(-120, y); g.quadraticCurveTo(0, y + 22, 120, y); g.stroke(); }
  g.fillStyle = '#1b0b2b'; g.fillRect(-120, 200, 240, 34);
  g.fillStyle = plate; g.fillRect(-26, 196, 52, 42);
  // bracers with a spike
  for (const sx of [-1, 1]) {
    for (const [e, h] of [[[332, -236], [294, -384]], [[302, 34], [238, 166]]]) {
      const x = lerp(e[0], h[0], 0.62) * sx, y = lerp(e[1], h[1], 0.62);
      const a = Math.atan2(h[1] - e[1], (h[0] - e[0]) * sx);
      g.strokeStyle = plate; g.lineWidth = 16;
      g.beginPath(); g.moveTo(x - Math.sin(a) * 34, y + Math.cos(a) * 34); g.lineTo(x + Math.sin(a) * 34, y - Math.cos(a) * 34); g.stroke();
    }
  }
  // horn ridges, pauldron rims
  g.strokeStyle = plate; g.lineWidth = 4;
  for (const sx of [-1, 1]) {
    for (const k of [0.3, 0.55]) {
      g.beginPath(); g.moveTo(sx * lerp(60, 150, k), lerp(-300, -330, k)); g.lineTo(sx * lerp(78, 140, k), lerp(-262, -300, k)); g.stroke();
    }
    g.beginPath(); g.moveTo(sx * 98, -190); g.bezierCurveTo(sx * 140, -248, sx * 254, -236, sx * 282, -160); g.stroke();
  }
  // the visor: a T of darkness for the eyes
  g.fillStyle = '#030106';
  g.beginPath(); g.moveTo(-58, -280); g.lineTo(58, -280); g.lineTo(46, -238); g.lineTo(14, -228); g.lineTo(0, -176); g.lineTo(-14, -228); g.lineTo(-46, -238); g.closePath(); g.fill();
  g.strokeStyle = '#6a0f1d'; g.lineWidth = 4;
  for (const y of [-204, -192, -180]) { g.beginPath(); g.moveTo(-26 + (y + 204) * 0.4, y); g.lineTo(26 - (y + 204) * 0.4, y); g.stroke(); }
  // the clock on his chest (hands are drawn live)
  g.fillStyle = '#1d0b2c'; g.beginPath(); g.arc(0, 0, 74, 0, TAU); g.fill();
  g.fillStyle = '#0a0310'; g.beginPath(); g.arc(0, 0, 62, 0, TAU); g.fill();
  g.strokeStyle = '#7d1424'; g.lineWidth = 4;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU, r0 = i % 3 ? 50 : 44;
    g.beginPath(); g.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0); g.lineTo(Math.sin(a) * 58, -Math.cos(a) * 58); g.stroke();
  }
  // moonlight from above
  g.globalCompositeOperation = 'source-atop';
  const lit = g.createLinearGradient(0, -520, 0, 300);
  lit.addColorStop(0, 'rgba(120,70,190,0.35)'); lit.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = lit; g.fillRect(-470, -540, 940, 860);
  g.globalCompositeOperation = 'source-over';
}

// ---------------------------------------------------------------- titles
function paintVS(g) {
  g.save();
  g.transform(1, 0, -0.2, 1, 0, 0);
  const fill = g.createLinearGradient(0, -96, 0, 96);
  fill.addColorStop(0, '#fffbd6'); fill.addColorStop(0.42, '#ffc63d'); fill.addColorStop(0.58, '#ff8a1f'); fill.addColorStop(1, '#d2252e');
  const V = () => { g.beginPath(); g.moveTo(-160, -92); g.lineTo(-100, -92); g.lineTo(-62, 34); g.lineTo(-22, -92); g.lineTo(38, -92); g.lineTo(-30, 94); g.lineTo(-92, 94); g.closePath(); };
  const S = () => {
    g.beginPath(); g.moveTo(150, -58);
    g.bezierCurveTo(130, -104, 52, -98, 56, -48);
    g.bezierCurveTo(60, -6, 150, -14, 150, 36);
    g.bezierCurveTo(150, 96, 60, 98, 48, 52);
  };
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = '#1a0420'; g.lineWidth = 18; V(); g.stroke(); S(); g.lineWidth = 56; g.stroke();
  g.fillStyle = fill; V(); g.fill();
  g.strokeStyle = fill; g.lineWidth = 36; S(); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(-150, -84); g.lineTo(-104, -84); g.stroke();
  g.beginPath(); g.moveTo(-14, -84); g.lineTo(30, -84); g.stroke();
  g.beginPath(); g.moveTo(132, -66); g.bezierCurveTo(118, -90, 70, -88, 70, -56); g.stroke();
  g.restore();
}

function paintStamp(g) {
  const col = '#45ff98';
  g.save();
  g.shadowColor = 'rgba(61,255,143,0.9)'; g.shadowBlur = 22 * g.getTransform().a;
  g.strokeStyle = col; g.fillStyle = col;
  const rr = (x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); g.stroke(); };
  g.lineWidth = 9; rr(-226, -74, 452, 148, 20);
  g.lineWidth = 3; rr(-210, -58, 420, 116, 12);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '38px "Press Start 2P", Silkscreen, monospace';
  g.fillText('SUBMITTED', 0, -14);
  g.font = '15px "Press Start 2P", Silkscreen, monospace';
  g.fillText('23:59:59 AoE', -18, 32);
  g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(112, 30); g.lineTo(124, 42); g.lineTo(150, 14); g.stroke();
  // rubber-stamp wear
  g.globalCompositeOperation = 'destination-out';
  const r = rng(77);
  for (let i = 0; i < 180; i++) { g.globalAlpha = 0.3 + r() * 0.7; g.beginPath(); g.arc(-230 + r() * 460, -78 + r() * 156, 0.6 + r() * 2.6, 0, TAU); g.fill(); }
  g.restore();
}

// ---------------------------------------------------------------- the stage
/**
 * @param canvas the visible 2D canvas
 * @param opt { w, h: CSS px, R: canvas px per CSS px }
 */
export function createScene(canvas, { w, h, R, art = {} }) {
  const c = canvas.getContext('2d');
  const U = h / 1000, W = w / U, px = U * R;
  const portrait = W < 820;
  const mU = Math.round(W * 0.05 + 36);
  const rand = rng(20251007);
  const L = portrait ? {
    moon: { x: W * 0.64, y: 205, r: 88 },
    lord: { x: W * 0.58, y: 372, s: Math.min(0.5, W / 1000) },
    ninja: { x: W * 0.22, y: 911, s: 1.25 },
    spin: { x: W * 0.25, y: 846, s: 0.8 },
    clash: { x: W * 0.45, y: 566 },
    tip: W * 0.66, ridge: 905,
  } : {
    moon: { x: W * 0.735, y: 222, r: 120 },
    lord: { x: W * 0.7, y: 500, s: 0.8 },
    ninja: { x: W * 0.2, y: 875, s: 1.6 },
    spin: { x: W * 0.3, y: 640, s: 1 },
    clash: { x: W * 0.49, y: 452 },
    tip: W * 0.41, ridge: 868,
  };
  L.W = W; L.U = U; L.portrait = portrait;

  const glow = {}, hot = {};
  for (const [k, v] of Object.entries(RGB)) { glow[k] = glowSprite(v); hot[k] = glowSprite(v, true); }

  // a parallax plane covering units [-mU, W+mU] x [y0, 1000+mU]
  const layer = (y0, paint) => {
    const cv = mk((W + 2 * mU) * px, (1000 + mU - y0) * px);
    const g = cv.getContext('2d');
    g.setTransform(px, 0, 0, px, mU * px, -y0 * px);
    paint(g);
    return { cv, y0 };
  };
  // a sprite in local units: extents [x0, x1] x [y0, y1] painted at k canvas px per unit
  const sprite = (x0, y0, x1, y1, k, paint) => {
    const cv = mk((x1 - x0) * k, (y1 - y0) * k);
    const g = cv.getContext('2d');
    g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    paint(g);
    return { cv, x0, y0, x1, y1 };
  };
  const put = (sp, x, y, s, sx = 1) => {
    if (sx === 1) { c.drawImage(sp.cv, x + sp.x0 * s, y + sp.y0 * s, (sp.x1 - sp.x0) * s, (sp.y1 - sp.y0) * s); return; }
    c.save(); c.translate(x, y); c.scale(sx, 1);
    c.drawImage(sp.cv, sp.x0 * s, sp.y0 * s, (sp.x1 - sp.x0) * s, (sp.y1 - sp.y0) * s);
    c.restore();
  };

  // ---- sky: gradient, stars, the moon
  const sky = layer(-mU, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 1000);
    gr.addColorStop(0, '#02031a'); gr.addColorStop(0.34, '#0b0b31'); gr.addColorStop(0.58, '#22104a');
    gr.addColorStop(0.76, '#4a1552'); gr.addColorStop(0.9, '#6c1d56'); gr.addColorStop(1, '#3a0f33');
    g.fillStyle = gr; g.fillRect(-mU, -mU, W + 2 * mU, 1000 + 2 * mU);
    const hz = g.createRadialGradient(W * 0.5, 900, 0, W * 0.5, 900, Math.max(W, 900) * 0.7);
    hz.addColorStop(0, 'rgba(255,100,150,0.2)'); hz.addColorStop(1, 'rgba(255,100,150,0)');
    g.fillStyle = hz; g.fillRect(-mU, -mU, W + 2 * mU, 1000 + 2 * mU);
    const n = Math.round(W * 0.14);
    for (let i = 0; i < n; i++) {
      const x = rand() * (W + 2 * mU) - mU, y = rand() * 680 - mU * 0.5;
      const r = 0.5 + rand() ** 3 * 1.7;
      g.fillStyle = `rgba(255,${235 + rand() * 20 | 0},${215 + rand() * 40 | 0},${((0.35 + rand() * 0.65) * (1 - y / 760)).toFixed(2)})`;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    const { x, y, r } = L.moon;
    const halo = g.createRadialGradient(x, y, r * 0.8, x, y, r * 3.6);
    halo.addColorStop(0, 'rgba(255,232,205,0.36)'); halo.addColorStop(0.4, 'rgba(230,170,220,0.12)'); halo.addColorStop(1, 'rgba(230,170,220,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(x, y, r * 3.6, 0, TAU); g.fill();
    const disc = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    disc.addColorStop(0, '#fffbf0'); disc.addColorStop(0.7, '#f6e3c0'); disc.addColorStop(1, '#e7c896');
    g.fillStyle = disc; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    for (const [dx, dy, cr] of [[-0.32, -0.18, 0.2], [0.28, 0.12, 0.16], [0.05, 0.42, 0.12], [-0.45, 0.3, 0.09], [0.4, -0.38, 0.08], [0.1, -0.05, 0.07]]) {
      g.fillStyle = 'rgba(196,160,118,0.32)'; g.beginPath(); g.arc(x + dx * r, y + dy * r, cr * r, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,250,235,0.3)'; g.beginPath(); g.arc(x + dx * r - cr * r * 0.2, y + dy * r - cr * r * 0.2, cr * r * 0.7, 0, TAU); g.fill();
    }
    for (const [dx, dy, len, th, al] of [[0.3, 0.5, 2.8, 0.1, 0.55], [-0.5, 0.72, 2.2, 0.07, 0.45]]) {
      const cx = x + dx * r, cy = y + dy * r;
      g.save(); g.translate(cx, cy); g.scale(1, th * 2 / len);
      const cl = g.createRadialGradient(0, 0, 0, 0, 0, r * len / 2);
      cl.addColorStop(0, `rgba(30,12,52,${al})`); cl.addColorStop(0.6, `rgba(30,12,52,${al * 0.5})`); cl.addColorStop(1, 'rgba(30,12,52,0)');
      g.fillStyle = cl; g.beginPath(); g.arc(0, 0, r * len / 2, 0, TAU); g.fill();
      g.restore();
    }
  });
  const bloodMoon = sprite(-L.moon.r * 3, -L.moon.r * 3, L.moon.r * 3, L.moon.r * 3, px, (g) => {
    const r = L.moon.r;
    const gl = g.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 3);
    gl.addColorStop(0, 'rgba(255,40,60,0.45)'); gl.addColorStop(1, 'rgba(255,40,60,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(0, 0, r * 3, 0, TAU); g.fill();
    const d = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    d.addColorStop(0, 'rgba(255,170,150,0.9)'); d.addColorStop(0.7, 'rgba(230,50,60,0.85)'); d.addColorStop(1, 'rgba(150,15,40,0.9)');
    g.fillStyle = d; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  });

  // ---- far: the ninja city, stacked towers in the haze
  const farBase = portrait ? 832 : 800;
  const far = layer(140, (g) => {
    const col = '#1c1446';
    g.fillStyle = col; g.fillRect(-mU, farBase - 4, W + 2 * mU, 1000 + mU - farBase + 4);
    for (let x = -mU; x < W + mU;) {
      const bw = 34 + rand() * 76;
      const lordGap = Math.abs(x - L.lord.x) < (portrait ? 70 : 160) ? 0.45 : 1;
      const bh = (60 + rand() * 210 * (0.45 + 0.55 * Math.sin(x * 0.0045 + 0.7) ** 2)) * lordGap;
      const top = farBase - bh, kind = rand();
      g.fillStyle = col;
      if (kind < 0.34) { g.fillRect(x + bw * 0.12, top, bw * 0.76, bh + 4); roof(g, x + bw / 2, top + 3, bw * 1.2, bw * 0.36); }
      else if (kind < 0.72) { g.fillRect(x, top, bw, bh + 4); g.fillRect(x + bw * 0.22, top - 14, bw * 0.56, 16); if (rand() < 0.5) g.fillRect(x + bw * 0.48, top - 40, 2.5, 28); }
      else { g.fillRect(x, top + 14, bw, bh - 10); g.beginPath(); g.ellipse(x + bw / 2, top + 15, bw / 2, 20, 0, Math.PI, TAU); g.fill(); }
      windows(g, rand, x + 5, top + 12, bw - 10, bh - 16, '255,190,140', 0.12);
      x += bw * (0.72 + rand() * 0.38);
    }
    const spires = portrait ? [[0.1, 300, 66], [0.93, 330, 60]] : [[0.11, 236, 92], [0.47, 214, 84], [0.94, 262, 88]];
    for (const [fx, top, sw] of spires) {
      const cx = W * fx;
      let y = farBase, ww = sw;
      const n = 7, lh = (farBase - top) / (n + 1.2);
      for (let i = 0; i < n; i++) {
        const bw = ww * 0.7;
        g.fillStyle = col; g.fillRect(cx - bw / 2, y - lh, bw, lh + 2);
        if (rand() < 0.65) {
          const aw = ww * (0.22 + rand() * 0.22), ah = lh * (0.5 + rand() * 0.4), left = rand() < 0.5;
          const ax = left ? cx - bw / 2 - aw + 2 : cx + bw / 2 - 2;
          g.fillRect(ax, y - ah, aw, ah); roof(g, ax + aw / 2, y - ah + 2, aw * 1.35, aw * 0.42);
          windows(g, rand, ax + 3, y - ah + 8, aw - 6, ah - 10, '255,150,120', 0.3);
        }
        windows(g, rand, cx - bw / 2 + 4, y - lh + 10, bw - 8, lh - 14, '255,175,125', 0.3);
        g.fillStyle = col; roof(g, cx, y - lh + 4, ww * 1.06, lh * 0.42);
        y -= lh; ww *= 0.86;
      }
      g.fillRect(cx - 2, y - lh * 1.3, 4, lh * 1.3 + 4);
      const orb = g.createRadialGradient(cx, y - lh * 1.3, 0, cx, y - lh * 1.3, 18);
      orb.addColorStop(0, 'rgba(170,255,210,1)'); orb.addColorStop(0.3, 'rgba(61,255,143,0.5)'); orb.addColorStop(1, 'rgba(61,255,143,0)');
      g.fillStyle = orb; g.beginPath(); g.arc(cx, y - lh * 1.3, 18, 0, TAU); g.fill();
    }
    g.globalCompositeOperation = 'source-atop';
    const hz = g.createLinearGradient(0, 260, 0, farBase);
    hz.addColorStop(0, 'rgba(110,60,170,0)'); hz.addColorStop(1, 'rgba(150,80,175,0.42)');
    g.fillStyle = hz; g.fillRect(-mU, 140, W + 2 * mU, farBase - 130);
    g.globalCompositeOperation = 'source-over';
  });

  // ---- mid: UC San Diego (Geisel, the eucalyptus, the Sun God, the Fallen Star) among pagodas and neon
  const midBase = portrait ? 928 : 906;
  const midCol = '#100b25';
  const neon = (g, x, y, text, rgb, vertical, size) => {
    g.save();
    g.font = `700 ${size}px Silkscreen, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const chars = vertical ? [...text] : [text];
    const lh = size * 1.08;
    const bw = vertical ? size * 1.55 : g.measureText(text).width + size * 1.1;
    const bh = vertical ? lh * chars.length + size * 0.55 : size * 1.7;
    g.fillStyle = 'rgba(9,5,20,0.95)'; g.fillRect(x - bw / 2, y - bh / 2, bw, bh);
    g.strokeStyle = `rgba(${rgb},0.5)`; g.lineWidth = 1.5; g.strokeRect(x - bw / 2 + 2.5, y - bh / 2 + 2.5, bw - 5, bh - 5);
    const at = (i) => (vertical ? y - bh / 2 + size * 0.3 + lh * (i + 0.5) : y + size * 0.05);
    g.shadowColor = `rgb(${rgb})`; g.shadowBlur = 14 * px; g.fillStyle = `rgb(${rgb})`;
    chars.forEach((ch, i) => g.fillText(ch, x, at(i)));
    g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,0.7)';
    chars.forEach((ch, i) => g.fillText(ch, x, at(i)));
    g.restore();
  };
  const pagoda = (g, cx, base, bw, tiers, th) => {
    let y = base, ww = bw;
    g.fillStyle = midCol; g.fillRect(cx - ww * 0.42, y - th * 0.4, ww * 0.84, th * 0.4 + 6);
    y -= th * 0.4;
    for (let i = 0; i < tiers; i++) {
      const cw = ww * 0.6, ch = th * 0.62;
      g.fillStyle = midCol; g.fillRect(cx - cw / 2, y - ch, cw, ch + 2);
      for (let k = -1; k <= 1; k++) {
        if (rand() < 0.75) { g.fillStyle = `rgba(255,${120 + rand() * 60 | 0},70,${(0.55 + rand() * 0.4).toFixed(2)})`; g.fillRect(cx + k * cw * 0.28 - 4, y - ch * 0.78, 8, ch * 0.5); }
      }
      y -= ch;
      g.fillStyle = midCol; roof(g, cx, y + th * 0.06, ww, th * 0.42);
      g.strokeStyle = 'rgba(200,140,255,0.28)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(cx - ww / 2, y + th * 0.06 - th * 0.42 * 0.3); g.quadraticCurveTo(cx - ww * 0.4, y + th * 0.08, cx - ww * 0.26, y + th * 0.06); g.lineTo(cx + ww * 0.26, y + th * 0.06); g.quadraticCurveTo(cx + ww * 0.4, y + th * 0.08, cx + ww / 2, y + th * 0.06 - th * 0.42 * 0.3); g.stroke();
      y -= th * 0.3; ww *= 0.84;
    }
    g.fillStyle = midCol; g.fillRect(cx - 2.5, y - th * 0.95, 5, th * 0.95 + 4);
    for (let k = 0; k < 4; k++) g.fillRect(cx - 6, y - th * 0.3 - k * th * 0.14, 12, 3);
    return y - th * 0.95;
  };
  const euc = (g, x, base, hh) => {
    g.strokeStyle = g.fillStyle = '#0b071b'; g.lineCap = 'round';
    const lean = (rand() - 0.5) * 34, topX = x + lean, topY = base - hh;
    g.lineWidth = 5.5; g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x - lean * 0.4, base - hh * 0.5, topX, topY); g.stroke();
    g.lineWidth = 2.5;
    for (let k = 0; k < 4; k++) {
      const bx = lerp(x, topX, 0.45 + k * 0.13), by = lerp(base, topY, 0.45 + k * 0.13), d = k % 2 ? 1 : -1;
      g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + d * 18, by - 10, bx + d * (30 + rand() * 20), by - 30 - rand() * 20); g.stroke();
    }
    for (let i = 0; i < 34; i++) {
      const a = rand() * TAU, r = Math.sqrt(rand());
      g.beginPath(); g.ellipse(topX + Math.cos(a) * r * hh * 0.3, topY + 10 + Math.sin(a) * r * hh * 0.17, 9 + rand() * 13, 4 + rand() * 6, rand() * Math.PI, 0, TAU); g.fill();
    }
  };
  const palm = (g, x, base, hh) => {
    g.strokeStyle = g.fillStyle = '#0a0619'; g.lineCap = 'round';
    const tx = x + (rand() - 0.3) * 40, ty = base - hh;
    g.lineWidth = 5; g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + (tx - x) * 0.2, base - hh * 0.6, tx, ty); g.stroke();
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (i - 3.5) * 0.42, len = 46 + rand() * 18;
      const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.55 + len * 0.45;
      g.lineWidth = 3.4; g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.7 - 10, ex, ey); g.stroke();
      g.lineWidth = 1.2;
      for (let k = 0.3; k < 1; k += 0.14) {
        const qx = lerp(tx, ex, k), qy = lerp(ty, ey, k) - Math.sin(k * Math.PI) * 10;
        g.beginPath(); g.moveTo(qx, qy); g.lineTo(qx + Math.cos(a + 1.2) * 9, qy + 9); g.moveTo(qx, qy); g.lineTo(qx + Math.cos(a - 1.2) * 9, qy + 9); g.stroke();
      }
    }
  };
  const geisel = (g, cx, base, s) => {
    const aura = g.createRadialGradient(cx, base - 170 * s, 0, cx, base - 170 * s, 300 * s);
    aura.addColorStop(0, 'rgba(255,190,120,0.2)'); aura.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = aura; g.beginPath(); g.arc(cx, base - 170 * s, 300 * s, 0, TAU); g.fill();
    g.save(); g.translate(cx, base); g.scale(s, s);
    const slab = '#2e2758', glass = '#120c28';
    g.fillStyle = '#0c0820'; g.fillRect(-62, -86, 124, 86);
    for (let x = -54; x <= 54; x += 18) {
      g.fillStyle = 'rgba(255,200,130,0.35)'; g.fillRect(x + 4, -70, 9, 54);
      g.fillStyle = slab; g.fillRect(x - 3, -86, 6, 86);
    }
    const F = [[-86, -118, 198], [-118, -150, 248], [-150, -182, 292], [-182, -214, 322], [-214, -244, 334], [-244, -270, 278], [-270, -290, 198]];
    for (const [b, t, fw] of F) {
      g.fillStyle = glass; g.fillRect(-fw / 2 + 6, t, fw - 12, b - t);
      for (let x = -fw / 2 + 11; x < fw / 2 - 14; x += 9) {
        if (rand() < 0.66) { g.fillStyle = `rgba(255,${205 + rand() * 30 | 0},${125 + rand() * 45 | 0},${(0.45 + rand() * 0.5).toFixed(2)})`; g.fillRect(x, t + 4, 6, b - t - 14); }
      }
      g.fillStyle = slab; g.fillRect(-fw / 2, b - 9, fw, 9);
    }
    g.fillRect(-100, -298, 200, 10);
    g.fillStyle = 'rgba(210,180,255,0.35)'; g.fillRect(-100, -298, 200, 2);
    g.strokeStyle = slab; g.lineWidth = 10; g.lineCap = 'butt';
    for (const sx of [-1, 1]) {
      g.beginPath(); g.moveTo(sx * 56, -86); g.lineTo(sx * 152, -214); g.stroke();
      g.beginPath(); g.moveTo(sx * 28, -86); g.lineTo(sx * 98, -182); g.stroke();
    }
    g.restore();
  };
  const fallenStar = (g, x, base, bw, bh) => {
    g.fillStyle = '#120c29'; g.fillRect(x - bw / 2, base - bh, bw, bh + 4);
    windows(g, rand, x - bw / 2 + 6, base - bh + 10, bw - 12, bh - 16, '170,205,255', 0.32, 5, 3, 9, 9);
    g.save(); g.translate(x - bw / 2 + 10, base - bh + 1); g.rotate(-0.17);
    g.fillStyle = '#3d5596'; g.fillRect(-28, -24, 36, 23);
    g.fillStyle = '#2b3d73'; g.beginPath(); g.moveTo(-33, -23); g.lineTo(-10, -42); g.lineTo(13, -23); g.fill();
    g.fillStyle = '#ffe9a8'; g.fillRect(-20, -17, 8, 8); g.fillRect(-4, -17, 6, 12);
    g.restore();
  };
  const sunGod = (g, x, base, s) => {
    g.save(); g.translate(x, base); g.scale(s, s);
    g.fillStyle = '#17112f';
    g.beginPath(); g.moveTo(-42, 0); g.lineTo(-32, -62); g.quadraticCurveTo(0, -98, 32, -62); g.lineTo(42, 0); g.lineTo(27, 0);
    g.lineTo(19, -54); g.quadraticCurveTo(0, -76, -19, -54); g.lineTo(-27, 0); g.closePath(); g.fill();
    const part = (col, f) => { g.fillStyle = col; g.beginPath(); f(); g.fill(); };
    part('#2f62a8', () => { g.moveTo(-8, -104); g.quadraticCurveTo(-46, -128, -60, -160); g.quadraticCurveTo(-30, -150, -4, -118); });
    part('#e2b23a', () => { g.moveTo(8, -104); g.quadraticCurveTo(46, -128, 62, -158); g.quadraticCurveTo(30, -150, 4, -118); });
    part('#c73a37', () => { g.ellipse(0, -100, 20, 24, 0, 0, TAU); });
    part('#3c9a5c', () => { g.ellipse(2, -94, 11, 14, 0, 0, TAU); });
    part('#c73a37', () => { g.arc(6, -128, 9, 0, TAU); });
    part('#e2b23a', () => { g.moveTo(13, -130); g.lineTo(24, -126); g.lineTo(13, -123); });
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(16,10,40,0.45)'; g.fillRect(-70, -170, 140, 80);
    g.restore();
  };
  const block = (g, x, base, bw, bh, rgb) => {
    g.fillStyle = midCol; g.fillRect(x - bw / 2, base - bh, bw, bh + 4);
    g.fillRect(x - bw * 0.3, base - bh - 12, bw * 0.6, 14);
    windows(g, rand, x - bw / 2 + 6, base - bh + 10, bw - 12, bh - 16, rgb || '255,200,140', 0.3, 4, 5, 10, 12);
  };
  const mid = layer(420, (g) => {
    g.fillStyle = midCol; g.fillRect(-mU, midBase - 6, W + 2 * mU, 1000 + mU - midBase + 6);
    for (let x = -mU; x < W + mU;) {
      const bw = 40 + rand() * 70, bh = 30 + rand() * 70;
      g.fillStyle = midCol; g.fillRect(x, midBase - bh, bw, bh + 6);
      windows(g, rand, x + 4, midBase - bh + 8, bw - 8, bh - 10, '255,190,130', 0.18);
      x += bw * (0.8 + rand() * 0.3);
    }
    if (portrait) {
      euc(g, W * 0.05, midBase, 230); euc(g, W * 0.13, midBase, 190);
      geisel(g, W * 0.37, midBase, 0.7);
      fallenStar(g, W * 0.68, midBase, 70, 170); neon(g, W * 0.68 + 26, midBase - 104, 'TRITONS', '110,220,255', true, 11);
      pagoda(g, W * 0.9, midBase, 100, 4, 56);
      palm(g, W * 1.0, midBase, 170);
    } else {
      sunGod(g, W * 0.052, midBase - 4, 0.9);
      palm(g, W * 0.09, midBase, 175); palm(g, W * 0.113, midBase, 140);
      const top = pagoda(g, W * 0.165, midBase, 124, 4, 64);
      neon(g, W * 0.165 + 40, top + 150, 'NINJA', '61,255,143', true, 13);
      euc(g, W * 0.232, midBase, 240); euc(g, W * 0.258, midBase, 280); euc(g, W * 0.285, midBase, 215);
      geisel(g, W * 0.37, midBase, 1);
      euc(g, W * 0.455, midBase, 250); euc(g, W * 0.48, midBase, 205);
      fallenStar(g, W * 0.555, midBase, 104, 214); neon(g, W * 0.555 + 40, midBase - 132, 'TRITONS', '110,220,255', true, 13);
      block(g, W * 0.635, midBase, 124, 130); neon(g, W * 0.635, midBase - 160, 'RAMEN', '255,110,180', false, 15);
      pagoda(g, W * 0.75, midBase, 152, 5, 64);
      block(g, W * 0.845, midBase, 92, 176, '255,170,120');
      palm(g, W * 0.9, midBase, 190);
      pagoda(g, W * 0.965, midBase, 104, 3, 58);
    }
  });

  // ---- near: the rooftop the ninja stands on
  const near = layer(760, (g) => {
    const tip = L.tip, yR = L.ridge, col = '#06040c';
    const top = () => {
      g.moveTo(-mU, yR + 4);
      g.quadraticCurveTo(tip * 0.5, yR + 14, tip - 46, yR + 6);
      g.quadraticCurveTo(tip - 10, yR + 2, tip + 20, yR - 36);
    };
    g.fillStyle = col;
    g.beginPath(); top(); g.quadraticCurveTo(tip + 8, yR - 8, tip - 6, yR + 24); g.lineTo(tip - 34, 1000 + mU); g.lineTo(-mU, 1000 + mU); g.closePath(); g.fill();
    g.save(); g.clip();
    g.strokeStyle = 'rgba(150,110,210,0.1)'; g.lineWidth = 2;
    for (let x = -mU; x < tip; x += 16) { g.beginPath(); g.moveTo(x, yR + 10); g.quadraticCurveTo(x - 6, yR + 60, x - 16, 1000 + mU); g.stroke(); }
    g.strokeStyle = 'rgba(150,110,210,0.06)';
    for (let y = yR + 28; y < 1000 + mU; y += 22) { g.beginPath(); g.moveTo(-mU, y); g.lineTo(tip, y + 4); g.stroke(); }
    g.restore();
    g.strokeStyle = '#120c22'; g.lineWidth = 10; g.lineCap = 'round';
    g.beginPath(); top(); g.stroke();
    g.save(); g.translate(0, -4.5);
    g.strokeStyle = 'rgba(200,150,255,0.5)'; g.lineWidth = 1.8;
    g.beginPath(); top(); g.stroke();
    g.restore();
    g.strokeStyle = col; g.lineWidth = 5;
    g.beginPath(); g.moveTo(tip + 18, yR - 34); g.quadraticCurveTo(tip + 34, yR - 52, tip + 22, yR - 60); g.quadraticCurveTo(tip + 10, yR - 62, tip + 14, yR - 50); g.stroke();
  });

  // ---- a blossom branch in the top corner (frames the moon)
  const branch = sprite(-420, -40, 60, 240, px, (g) => {
    g.strokeStyle = g.fillStyle = '#07040e'; g.lineCap = 'round';
    const pts = [[60, -10], [-60, 30], [-170, 48], [-280, 92], [-380, 110]];
    for (let i = 0; i < pts.length - 1; i++) {
      g.lineWidth = 15 - i * 3; g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[i + 1][0], pts[i + 1][1]); g.stroke();
    }
    const twigs = [];
    for (let i = 0; i < 9; i++) {
      const k = 0.1 + rand() * 0.85, p = Math.min(pts.length - 2, Math.floor(k * (pts.length - 1)));
      const f = k * (pts.length - 1) - p;
      const x = lerp(pts[p][0], pts[p + 1][0], f), y = lerp(pts[p][1], pts[p + 1][1], f);
      const ex = x - 20 - rand() * 50, ey = y + 30 + rand() * 80;
      g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - 6, (y + ey) / 2, ex, ey); g.stroke();
      twigs.push([ex, ey], [lerp(x, ex, 0.5), lerp(y, ey, 0.5)]);
    }
    twigs.push(...pts.slice(1));
    for (const [x, y] of twigs) {
      for (let i = 0; i < 9; i++) {
        const a = rand() * TAU, r = rand() * 20;
        g.fillStyle = rand() < 0.5 ? 'rgba(255,150,200,0.85)' : rand() < 0.6 ? 'rgba(255,205,228,0.9)' : 'rgba(120,40,90,0.9)';
        g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 2.2 + rand() * 3, 0, TAU); g.fill();
      }
    }
  });

  const lordK = Math.max(L.lord.s, portrait ? 0.7 : W * 0.4 / 640);

  // image art (art.js) replaces the drawn stand-ins; each slot is decided the first time it is drawn
  const chosen = {};
  const pic = (k) => (k in chosen ? chosen[k] : (chosen[k] = art[k]?.naturalWidth ? art[k] : null));
  const drawPic = (im, x, y, hU, ax, ay, flip) => {
    const wU = hU * (im.naturalWidth || im.width) / (im.naturalHeight || im.height);
    c.save(); c.translate(x, y); if (flip) c.scale(-1, 1);
    c.drawImage(im, -ax * wU, -ay * hU, wU, hU);
    c.restore();
  };
  // the villain rises out of the city: his image fades out toward its lower edge so no cut ever shows
  let villainCv;
  const villainPic = () => {
    if (villainCv !== undefined) return villainCv;
    const im = pic('villain');
    if (!im) return (villainCv = null);
    const cv = mk(im.naturalWidth, im.naturalHeight), g = cv.getContext('2d');
    g.drawImage(im, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    const fade = g.createLinearGradient(0, 0, 0, cv.height);
    fade.addColorStop(0, '#000'); fade.addColorStop(0.72, '#000'); fade.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fade; g.fillRect(0, 0, cv.width, cv.height);
    return (villainCv = cv);
  };
  const villainBox = (lx, ly) => {
    const v = ART.villain, hU = 1000 * L.lord.s * v.h, wU = hU * villainCv.width / villainCv.height, sx = v.flip ? -1 : 1;
    return { hU, wU, at: (f) => [lx + (f[0] - v.anchor[0]) * wU * sx, ly + (f[1] - v.anchor[1]) * hU] };
  };
  const heroAir = (x, y, k) => {
    const jump = pic('heroJump'), im = jump || pic('hero');
    if (!im) return false;
    const cfg = jump ? ART.heroJump : ART.hero, hU = L.ninja.s * 100 * cfg.h * k;
    drawPic(im, x, y - hU / 2, hU, 0.5, 0.5, cfg.flip);
    return true;
  };
  // a skyline image: with a transparent sky it is a layer in front of the villain, otherwise the whole backdrop
  let skyMode = null;
  const skyPic = () => {
    const im = pic('skyline');
    if (im && !skyMode) {
      try {
        const cv = mk(32, 32), g = cv.getContext('2d', { willReadFrequently: true });
        g.drawImage(im, 0, 0, 32, 32);
        const d = g.getImageData(0, 0, 32, 4).data;
        let a = 0;
        for (let i = 3; i < d.length; i += 4) a += d[i];
        skyMode = a / (d.length / 4) < 128 ? 'layer' : 'backdrop';
      } catch { skyMode = 'backdrop'; }
    }
    return im;
  };
  const drawSkyline = (im) => {
    const tall = skyMode === 'layer' ? (portrait ? 640 : 560) : 1000 + 2 * mU;
    const sc = Math.max((W + 2 * mU) / im.naturalWidth, tall / im.naturalHeight);
    const iw = im.naturalWidth * sc, ih = im.naturalHeight * sc;
    c.drawImage(im, W / 2 - iw / 2, 1000 + mU - ih, iw, ih);
  };
  const lord = sprite(-470, -520, 470, 548, px * lordK, paintLord);
  const ninja = {
    ready: sprite(-48, -128, 92, 10, px * L.ninja.s, (g) => paintNinja(g, POSE.ready)),
    leap: sprite(-48, -128, 92, 10, px * L.ninja.s, (g) => paintNinja(g, POSE.leap)),
  };
  // painted a moment later, while the opening plays: the VS card and the stamp need the pixel font
  const late = {};
  const vsBustS = portrait ? Math.min(0.62, W / 700) : 1.05;
  const lateJobs = [
    () => { late.bust = sprite(-330, -360, 320, 470, px * vsBustS, paintNinjaBust); },
    () => { late.vs = sprite(-200, -110, 190, 110, px * (portrait ? 0.9 : 1.25), paintVS); },
    () => { late.stamp = sprite(-260, -106, 260, 106, px * (portrait ? 0.78 : 1), paintStamp); },
    () => {
      const sz = portrait ? 28 : 46;
      late.warn = sprite(-sz * 5, -sz, sz * 5, sz, px, (g) => {
        g.font = pixelFont(sz); g.textAlign = 'center'; g.textBaseline = 'middle';
        g.shadowColor = '#ff2f45'; g.shadowBlur = 18 * px; g.fillStyle = '#ff3b50';
        g.fillText('WARNING', 0, 0); g.shadowBlur = 0; g.fillText('WARNING', 0, 0);
      });
    },
    () => {
      const t = mk(12, 12), g = t.getContext('2d');
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.arc(3, 3, 2, 0, TAU); g.arc(9, 9, 2, 0, TAU); g.fill();
      late.dots = c.createPattern(t, 'repeat');
    },
  ];
  const vignette = (() => {
    const cv = mk(256, 256), g = cv.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 60, 128, 128, 182);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    return cv;
  })();

  // ---------------------------------------------------------------- particles
  const P = [];
  const MAXP = portrait ? 420 : 760;
  const emit = (o) => { if (P.length < MAXP) P.push({ age: 0, rot: 0, vr: 0, drag: 0, grav: 0, a: 1, layer: 1, ...o }); };
  const auraPts = [[-248, -500], [248, -500], [-300, -384], [300, -384], [-212, -342], [212, -342], [-266, -206], [266, -206], [-150, -238], [150, -238], [-320, -150], [320, -150], [0, -456], [-238, 166], [238, 166], [-60, -330], [60, -330]];
  let lastT = 0;
  function step(t, dt) {
    // ambient: embers and petals all along, lanterns drifting up
    const amb = t > BEAT.open - 0.1 && t < BEAT.shatter;
    if (amb && Math.random() < dt * (portrait ? 22 : 40)) {
      emit({ k: 'ember', x: rand() * W, y: 1010, vx: (Math.random() - 0.4) * 40, vy: -60 - Math.random() * 120, life: 2 + Math.random() * 2, size: 3 + Math.random() * 5, col: Math.random() < 0.7 ? 'orange' : 'gold' });
    }
    if (amb && Math.random() < dt * 9) {
      const fromBranch = Math.random() < 0.6;
      emit({ k: 'petal', x: fromBranch ? W - Math.random() * (portrait ? W * 0.3 : 320) : Math.random() * W, y: fromBranch ? 60 + Math.random() * 120 : -20, vx: -50 - Math.random() * 70, vy: 50 + Math.random() * 60, life: 3, size: 4 + Math.random() * 4, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 8 });
    }
    if (amb && t < BEAT.vs && Math.random() < dt * 2.2) {
      emit({ k: 'lantern', x: Math.random() * W, y: 900, vx: (Math.random() - 0.5) * 12, vy: -38 - Math.random() * 20, life: 6, size: 6 + Math.random() * 5, layer: 0.5 });
    }
    // the lord's aura once he is up
    const up = seg(t, BEAT.rise, BEAT.rise + 0.7);
    if (up > 0 && t < BEAT.flash) {
      const rate = (portrait ? 70 : 140) * up;
      for (let n = 0; n < rate * dt; n++) {
        let [ax, ay] = auraPts[Math.floor(Math.random() * auraPts.length)];
        const s = L.lord.s;
        if (villainCv) { const b = villainBox(0, 0); ax = (Math.random() - 0.5) * b.wU * 0.9 / s; ay = (-Math.random() * ART.villain.anchor[1] * b.hU + 40) / s; }
        emit({ k: 'aura', x: L.lord.x + (ax + (Math.random() - 0.5) * 60) * s, y: L.lord.y + lordRise(t) + (ay + (Math.random() - 0.5) * 50) * s, vx: (Math.random() - 0.5) * 40, vy: -70 - Math.random() * 110, life: 0.6 + Math.random() * 0.6, size: (40 + Math.random() * 60) * s, col: Math.random() < 0.8 ? 'purple' : 'red', layer: 0, a: 0.55 });
      }
    }
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.age += dt;
      if (p.age >= p.life) { P[i] = P[P.length - 1]; P.pop(); continue; }
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.k === 'petal') p.vx += Math.sin(t * 3 + p.y * 0.02) * 30 * dt;
    }
  }
  function drawParticles(layerId) {
    for (const p of P) {
      if (p.layer !== layerId) continue;
      const k = 1 - p.age / p.life;
      if (p.k === 'petal') {
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = Math.min(1, k * 2) * 0.9;
        c.fillStyle = '#ffb3d4';
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(1, Math.abs(Math.sin(p.rot * 1.3)) * 0.8 + 0.2);
        c.beginPath(); c.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, TAU); c.fill();
        c.restore();
        continue;
      }
      c.globalCompositeOperation = 'lighter';
      if (p.k === 'spark') {
        c.globalAlpha = k;
        c.strokeStyle = `rgba(${RGB[p.col]},1)`; c.lineWidth = p.size;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); c.stroke();
        continue;
      }
      if (p.k === 'chunk') {
        c.globalCompositeOperation = 'source-over'; c.globalAlpha = Math.min(1, k * 3);
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = '#3a2412'; c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        c.strokeStyle = '#ffc94a'; c.lineWidth = 1.5; c.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size); c.restore();
        continue;
      }
      if (p.k === 'lantern') {
        c.globalAlpha = Math.min(1, p.age * 2, k * 3) * 0.9;
        c.drawImage(glow.orange, p.x - p.size * 2.5, p.y - p.size * 2.5, p.size * 5, p.size * 5);
        c.globalCompositeOperation = 'source-over';
        c.fillStyle = '#ffb35c'; c.fillRect(p.x - p.size * 0.45, p.y - p.size * 0.6, p.size * 0.9, p.size * 1.2);
        continue;
      }
      let s = p.size, a = p.a;
      if (p.k === 'ember') { a *= (0.6 + 0.4 * Math.sin(p.age * 20 + p.x)) * Math.min(1, k * 2); }
      else if (p.k === 'aura') { s *= 0.6 + (1 - k) * 0.7; a *= Math.sin(k * Math.PI); }
      else a *= k;
      c.globalAlpha = Math.max(0, Math.min(1, a));
      c.drawImage(p.hot ? hot[p.col] : glow[p.col], p.x - s / 2, p.y - s / 2, s, s);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------- the camera
  const cam = { zoom: 1, fx: W / 2, fy: 500, panX: 0, shakeX: 0, shakeY: 0, roll: 0 };
  function camera(t) {
    const open = eo(seg(t, BEAT.open, BEAT.rise + 0.9));
    const fight = eio(seg(t, BEAT.vsEnd, BEAT.impact));
    cam.zoom = lerp(1.24, 1, open) + 0.08 * fight + 0.1 * Math.exp(-Math.max(0, t - BEAT.impact) * 9) * (t > BEAT.impact ? 1 : 0);
    cam.fx = lerp(W / 2, L.clash.x, fight); cam.fy = lerp(560, L.clash.y, fight);
    cam.panX = lerp(-26, 10, seg(t, BEAT.open, BEAT.impact));
    let amp = 0;
    if (t > BEAT.rise && t < BEAT.rise + 0.8) amp += 3.5 * Math.sin(seg(t, BEAT.rise, BEAT.rise + 0.8) * Math.PI);
    if (t > BEAT.bolt) amp += 11 * Math.exp(-(t - BEAT.bolt) * 10);
    if (t > BEAT.comets) amp += lerp(1.5, 8, seg(t, BEAT.comets, BEAT.impact)) * (t < BEAT.impact ? 1 : 0);
    if (t > BEAT.impact) amp += 24 * Math.exp(-(t - BEAT.impact) * 7);
    if (t > BEAT.stamp) amp += 8 * Math.exp(-(t - BEAT.stamp) * 14);
    cam.shakeX = amp * (wave(t, 71, 0) * 0.6 + wave(t, 113, 1.3) * 0.4);
    cam.shakeY = amp * (wave(t, 83, 2.1) * 0.6 + wave(t, 127, 0.4) * 0.4);
    cam.roll = amp * 0.0009 * wave(t, 37, 0.7);
  }
  // f: depth (0 = sky, 1 = foreground)
  function view(f) {
    const z = 1 + (cam.zoom - 1) * (0.3 + 0.7 * f);
    c.setTransform(px, 0, 0, px, 0, 0);
    c.translate(cam.fx + cam.shakeX * (0.4 + 0.6 * f), cam.fy + cam.shakeY * (0.4 + 0.6 * f));
    c.rotate(cam.roll * f);
    c.scale(z, z);
    c.translate(-cam.fx - cam.panX * f, -cam.fy);
  }
  const drawLayer = (ly) => c.drawImage(ly.cv, -mU, ly.y0, W + 2 * mU, 1000 + mU - ly.y0);
  const screen = () => c.setTransform(px, 0, 0, px, 0, 0);

  // ---------------------------------------------------------------- the actors' timelines
  function lordRise(t) { return lerp(640 * L.lord.s + 200, 0, eo(seg(t, BEAT.rise, BEAT.rise + 0.78))); }
  function ninjaAt(t) {
    // standing on the roof, then a leap arc up to the spin point
    const k = seg(t, BEAT.leap, BEAT.spin + 0.04);
    if (k <= 0) return { x: L.ninja.x, y: L.ninja.y, pose: 'ready' };
    const e = eo(k);
    return { x: lerp(L.ninja.x, L.spin.x, e), y: lerp(L.ninja.y, L.spin.y, e) - Math.sin(k * Math.PI) * 60, pose: 'leap' };
  }
  const scarf = (x, y, t, s, dir) => {
    c.strokeStyle = '#1fd16b'; c.lineCap = 'round';
    for (const off of [0, 1]) {
      let px0 = x, py0 = y;
      for (let i = 1; i <= 8; i++) {
        const nx = x + (dir[0] * i * 7 + Math.sin(t * 15 + i * 0.9 + off * 2) * i * 0.8) * s;
        const ny = y + (dir[1] * i * 7 + off * i * 1.6 + Math.cos(t * 13 + i * 0.8 + off) * i * 0.6) * s;
        c.lineWidth = (5 - i * 0.45) * s;
        c.beginPath(); c.moveTo(px0, py0); c.lineTo(nx, ny); c.stroke();
        px0 = nx; py0 = ny;
      }
    }
  };

  // the four elements the green one gathers before the clash
  const COMETS = [
    { col: 'orange', from: [-80, 120], bend: [180, -60], t0: 0, kind: 'fire' },
    { col: 'blue', from: [W * 0.28, -80], bend: [-160, 40], t0: 0.05, kind: 'bolt' },
    { col: 'cyan', from: [-80, 1060], bend: [220, 60], t0: 0.09, kind: 'ice' },
    { col: 'gold', from: [W * 0.62, 1080], bend: [-120, 120], t0: 0.13, kind: 'earth' },
  ];
  const quad = (a, b, ctl, k) => [lerp(lerp(a[0], ctl[0], k), lerp(ctl[0], b[0], k), k), lerp(lerp(a[1], ctl[1], k), lerp(ctl[1], b[1], k), k)];

  function beam(x1, y1, x2, y2, wd, col, t, hotCore = true) {
    const n = 22, dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n, o = (Math.sin(t * 40 + i * 1.7) + Math.sin(t * 63 + i * 2.9)) * wd * 0.12 * Math.sin(k * Math.PI);
      pts.push([x1 + dx * k + nx * o, y1 + dy * k + ny * o]);
    }
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = `rgba(${RGB[col]},0.22)`; c.lineWidth = wd * 2.6; strokePts(c, pts);
    c.strokeStyle = `rgba(${RGB[col]},0.6)`; c.lineWidth = wd * 1.2; strokePts(c, pts);
    if (hotCore) { c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = wd * 0.42; strokePts(c, pts); }
    c.globalCompositeOperation = 'source-over';
  }

  function drawLightning(pts, col, wd) {
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = `rgba(${RGB[col]},0.35)`; c.lineWidth = wd * 3.2; strokePts(c, pts);
    c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = wd; strokePts(c, pts);
    c.globalCompositeOperation = 'source-over';
  }

  function tornado(t, x, y, s) {
    const form = eo(seg(t, BEAT.spin, BEAT.spin + 0.16));
    const boost = seg(t, BEAT.comets + 0.3, BEAT.comets + 0.45);
    const H = 250 * s, r0 = 12 * s, r1 = (92 + 26 * boost) * s * form, base = y + 20 * s;
    const sway = (hh) => Math.sin(t * 7 + hh * 4) * 12 * hh * s;
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = (0.5 + 0.3 * boost) * form;
    const gs = (300 + 90 * boost) * s;
    c.drawImage(glow.green, x - gs / 2, base - H * 0.55 - gs / 2, gs, gs);
    // the funnel's body: a pale cone, brighter at the rim
    const body = c.createLinearGradient(x - r1, 0, x + r1, 0);
    body.addColorStop(0, 'rgba(61,255,143,0.2)'); body.addColorStop(0.3, 'rgba(61,255,143,0.03)');
    body.addColorStop(0.7, 'rgba(61,255,143,0.03)'); body.addColorStop(1, 'rgba(61,255,143,0.2)');
    c.globalAlpha = form;
    c.fillStyle = body;
    c.beginPath();
    c.moveTo(x - r0 + sway(0), base);
    for (let k = 1; k <= 8; k++) { const hh = k / 8; c.lineTo(x + sway(hh) - lerp(r0, r1, hh ** 0.85), base - hh * H); }
    c.ellipse(x + sway(1), base - H, r1, r1 * 0.26, 0, Math.PI, 0, true);
    for (let k = 7; k >= 0; k--) { const hh = k / 8; c.lineTo(x + sway(hh) + lerp(r0, r1, hh ** 0.85), base - hh * H); }
    c.fill();
    c.globalAlpha = 1;
    const N = portrait ? 80 : 130;
    const cols = ['61,255,143', '210,255,230', '61,255,143', '120,255,190'];
    const ecol = ['255,140,40', '95,150,255', '120,225,255', '255,201,74'];
    c.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      if (pass === 1) {
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = 0.9 - form * 0.35;
        if (!heroAir(x + sway(0.3), y - 10 * s, s * 0.8)) put(ninja.leap, x + sway(0.3), y - 10 * s, L.ninja.s * s * 0.8);
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'lighter';
      }
      for (let i = 0; i < N; i++) {
        const hh = (i * 0.618034) % 1;
        const a = t * (12 + ((i * 7) % 9)) + i * 2.39996;
        const front = Math.sin(a) > 0;
        if (front !== (pass === 1)) continue;
        const r = lerp(r0, r1, hh ** 0.85) * (0.82 + 0.36 * ((i * 13) % 7) / 7);
        const cy = base - hh * H;
        const col = boost > 0 && i % 5 === 0 ? ecol[i % 4] : cols[i % 4];
        c.strokeStyle = `rgba(${col},${(pass ? 0.95 : 0.4) * form})`;
        c.lineWidth = (pass ? 2.8 : 1.8) * s * (0.7 + hh * 0.6);
        c.beginPath(); c.ellipse(x + sway(hh), cy, Math.max(1, r), Math.max(0.5, r * 0.26), 0, a - 0.9, a); c.stroke();
      }
    }
    c.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------- screen-space pieces
  const pixelFont = (size) => `${size}px "Press Start 2P", Silkscreen, monospace`;
  function caption(t) {
    const k = seg(t, BEAT.open + 0.2, BEAT.open + 0.35), out = seg(t, BEAT.vs - 0.15, BEAT.vs);
    if (k <= 0 || out >= 1) return;
    const lines = ['UC SAN DIEGO · NINJA CITY', 'LA JOLLA · 23:59 AoE'];
    const chars = Math.floor((t - BEAT.open - 0.2) * 72);
    const x = portrait ? 26 : 58, y = portrait ? 96 : 92;
    c.globalAlpha = k * (1 - out);
    c.fillStyle = 'rgba(5,4,16,0.55)';
    c.fillRect(x - 12, y - 30, portrait ? 300 : 420, 76);
    c.fillStyle = '#ffd36b'; c.fillRect(x - 12, y - 30, 4, 76);
    c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    c.font = `700 ${portrait ? 19 : 24}px Silkscreen, monospace`;
    c.fillStyle = '#f4ecff';
    c.fillText(lines[0].slice(0, chars), x, y);
    c.font = pixelFont(portrait ? 11 : 13);
    c.fillStyle = '#ffd36b';
    const c2 = Math.max(0, chars - lines[0].length);
    c.fillText(lines[1].slice(0, c2) + (Math.floor(t * 6) % 2 ? '_' : ''), x, y + 30);
    c.globalAlpha = 1;
  }

  function warning(t) {
    const a = seg(t, BEAT.warn, BEAT.warn + 0.09), z = seg(t, BEAT.vs - 0.12, BEAT.vs - 0.02);
    const open = a * (1 - z);
    if (open <= 0) return;
    const y = portrait ? 700 : 640, hh = (portrait ? 100 : 124) * open;
    c.save();
    c.fillStyle = 'rgba(20,0,6,0.78)'; c.fillRect(0, y - hh / 2, W, hh);
    c.beginPath(); c.rect(0, y - hh / 2, W, hh); c.clip();
    const sh = (t * 160) % 40;
    for (const yy of [y - hh / 2, y + hh / 2 - 12]) {
      c.fillStyle = '#ffcc33'; c.fillRect(0, yy, W, 12);
      c.fillStyle = '#1a0006';
      for (let x = -40 + (yy > y ? sh : -sh); x < W + 40; x += 40) { c.beginPath(); c.moveTo(x, yy); c.lineTo(x + 20, yy); c.lineTo(x + 8, yy + 12); c.lineTo(x - 12, yy + 12); c.fill(); }
    }
    const flick = Math.floor(t * 14) % 2 ? 1 : 0.55;
    c.globalAlpha = open * flick;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (late.warn) put(late.warn, W / 2, y - (portrait ? 10 : 12), 1);
    c.font = pixelFont(portrait ? 9 : 13);
    c.fillStyle = '#ffe1e5';
    c.fillText('A DEADLINE IS APPROACHING FAST', W / 2, y + (portrait ? 20 : 26));
    c.restore();
    c.globalAlpha = 1;
  }

  function vsCard(t) {
    const k = t - BEAT.vs;
    if (k < 0 || t > BEAT.vsEnd) return;
    const inn = eo(clamp01(k / 0.13)), out = ei(seg(t, BEAT.vsOut, BEAT.vsEnd));
    const slideA = (1 - inn) * -1 + out * -1.1, slideB = (1 - inn) + out * 1.1;
    c.save();
    // two panels split along a slanted cut
    const cut = portrait
      ? { a: [0, 560], b: [W, 440] }
      : { a: [W * 0.56, 0], b: [W * 0.44, 1000] };
    const panel = (side, slide) => {
      c.save();
      if (portrait) c.translate(0, slide * 1000); else c.translate(slide * W, 0);
      c.beginPath();
      if (portrait) {
        if (side === 0) { c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(cut.b[0], cut.b[1]); c.lineTo(cut.a[0], cut.a[1]); }
        else { c.moveTo(cut.a[0], cut.a[1]); c.lineTo(cut.b[0], cut.b[1]); c.lineTo(W, 1000); c.lineTo(0, 1000); }
      } else if (side === 0) { c.moveTo(0, 0); c.lineTo(cut.a[0], 0); c.lineTo(cut.b[0], 1000); c.lineTo(0, 1000); }
      else { c.moveTo(cut.a[0], 0); c.lineTo(W, 0); c.lineTo(W, 1000); c.lineTo(cut.b[0], 1000); }
      c.closePath();
      c.clip();
      const ninjaSide = portrait ? side === 1 : side === 0;
      const gr = portrait ? c.createLinearGradient(0, side ? 1000 : 0, 0, 500) : c.createLinearGradient(side ? W : 0, 0, W / 2, 0);
      if (ninjaSide) { gr.addColorStop(0, '#062b17'); gr.addColorStop(1, '#13a052'); }
      else { gr.addColorStop(0, '#1a0526'); gr.addColorStop(1, '#7a1fa0'); }
      c.fillStyle = gr; c.fillRect(0, 0, W, 1000);
      if (late.dots) { c.globalAlpha = 0.5; c.fillStyle = late.dots; c.fillRect(0, 0, W, 1000); c.globalAlpha = 1; }
      // speed lines
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = 'rgba(255,255,255,0.13)';
      const r = rng(9 + side);
      for (let i = 0; i < 26; i++) {
        const len = 120 + r() * 260, wd = 1 + r() * 4, sp = 1400 + r() * 900;
        c.lineWidth = wd;
        if (portrait) { const x = r() * W, y = ((r() * 1400 + (side ? -1 : 1) * k * sp) % 1400 + 1400) % 1400 - 200; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + len); c.stroke(); }
        else { const y = r() * 1000, x = ((r() * (W + 400) + (side ? 1 : -1) * k * sp) % (W + 400) + W + 400) % (W + 400) - 200; c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y); c.stroke(); }
      }
      c.globalCompositeOperation = 'source-over';
      const drift = k * 26;
      const hv = ninjaSide && pic('heroVs'), vv = !ninjaSide && pic('villainVs');
      if (hv) {
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5;
        const gx = portrait ? W * 0.4 : W * 0.25, gy = portrait ? 760 : 520, gs = portrait ? 560 : 1000;
        c.drawImage(glow.green, gx - gs / 2, gy - gs / 2, gs, gs);
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
        if (portrait) drawPic(hv, W * 0.42 - drift * 0.4, 1008, 600 * ART.heroVs.h, 0.5, 1, ART.heroVs.flip);
        else drawPic(hv, W * 0.25 + drift, 1008, 1000 * ART.heroVs.h, 0.5, 1, ART.heroVs.flip);
      } else if (ninjaSide && late.bust) {
        const s = vsBustS;
        if (portrait) put(late.bust, W * 0.36 - drift * 0.4, 1000 - 470 * s + 52, s);
        else put(late.bust, W * 0.24 + drift, 1000 - 470 * s + 30, s);
      } else if (!ninjaSide) {
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.6;
        const gx = portrait ? W * 0.62 : W * 0.74, gy = portrait ? 250 : 380, gs = portrait ? 520 : 900;
        c.drawImage(glow.purple, gx - gs / 2, gy - gs / 2, gs, gs);
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
        if (vv) {
          if (portrait) drawPic(vv, W * 0.6 + drift * 0.4, 600, 600 * ART.villainVs.h, 0.5, 1, ART.villainVs.flip);
          else drawPic(vv, W * 0.76 - drift, 1008, 1000 * ART.villainVs.h, 0.5, 1, ART.villainVs.flip);
        } else {
          if (portrait) put(lord, W * 0.64 + drift * 0.4, 360, 0.7);
          else put(lord, W * 0.76 - drift, 640, W * 0.4 / 640);
          eyes(portrait ? W * 0.64 + drift * 0.4 : W * 0.76 - drift, portrait ? 360 : 640, portrait ? 0.7 : W * 0.4 / 640, 1, t);
        }
      }
      c.restore();
    };
    panel(0, slideA);
    panel(1, slideB);
    // the cut itself: a lightning seam
    if (inn > 0.6 && out < 0.3) {
      const r = rng(Math.floor(t * 30));
      const pts = portrait ? boltPath(-20, cut.a[1], W + 20, cut.b[1], 40, r) : boltPath(cut.a[0], -20, cut.b[0], 1020, 60, r);
      drawLightning(pts, 'white', 3);
    }
    // VS slams in, the names slide in
    const vk = seg(t, BEAT.vs + 0.14, BEAT.vs + 0.26);
    if (vk > 0 && late.vs && out < 1) {
      const sc = lerp(3.2, 1, eo(vk)) * (1 + 0.04 * Math.sin(k * 30) * (vk >= 1 ? 1 : 0));
      const vx = W / 2, vy = 500;
      c.save();
      c.globalAlpha = Math.min(1, vk * 2) * (1 - out);
      c.translate(vx, vy); c.rotate((1 - eo(vk)) * -0.5); c.scale(sc, sc);
      const vs = portrait ? 0.9 : 1.25;
      put(late.vs, portrait ? W * 0.12 : 0, 0, vs);
      c.restore();
      const ring = seg(t, BEAT.vs + 0.26, BEAT.vs + 0.5);
      if (ring > 0 && ring < 1) {
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = `rgba(255,230,160,${(1 - ring) * 0.8})`; c.lineWidth = 14 * (1 - ring);
        c.beginPath(); c.arc(vx, vy, 60 + ring * 380, 0, TAU); c.stroke();
        c.globalCompositeOperation = 'source-over';
      }
    }
    const nk = eo(seg(t, BEAT.vs + 0.2, BEAT.vs + 0.36));
    if (nk > 0 && out < 1) {
      const plate = (x, y, big, small, rgb, dir) => {
        c.save();
        c.translate(x + (1 - nk) * dir * 300, y);
        c.globalAlpha = nk * (1 - out);
        c.transform(1, 0, -0.25, 1, 0, 0);
        c.font = pixelFont(portrait ? 17 : 28);
        const bw = c.measureText(big).width + (portrait ? 30 : 46);
        const x0 = dir < 0 ? 0 : -bw;
        c.fillStyle = 'rgba(4,2,10,0.85)'; c.fillRect(x0, -(portrait ? 30 : 44), bw, portrait ? 62 : 88);
        c.fillStyle = `rgb(${rgb})`; c.fillRect(x0, -(portrait ? 30 : 44), bw, 5);
        c.textBaseline = 'middle'; c.textAlign = dir < 0 ? 'left' : 'right';
        const tx = dir < 0 ? (portrait ? 15 : 23) : -(portrait ? 15 : 23);
        c.fillStyle = '#ffffff'; c.fillText(big, tx, portrait ? -6 : -10);
        c.font = pixelFont(portrait ? 8 : 11); c.fillStyle = `rgb(${rgb})`;
        c.fillText(small, tx, portrait ? 17 : 24);
        c.restore();
      };
      const N = ART.names, foe = pic('villainVs') || pic('villain') ? N.villainArt : N.villain;
      if (portrait) {
        plate(16, 920, N.hero[0], N.hero[2], '61,255,143', -1);
        plate(W - 16, 80, foe[0], foe[1], '200,110,255', 1);
      } else {
        plate(48, 880, N.hero[0], N.hero[1], '61,255,143', -1);
        plate(W - 48, 120, foe[0], foe[1], '200,110,255', 1);
      }
    }
    // a white pop when the panels meet
    const pop = 1 - seg(t, BEAT.vs + 0.1, BEAT.vs + 0.2);
    if (k > 0.1 && pop > 0) { c.fillStyle = `rgba(255,255,255,${pop * 0.6})`; c.fillRect(0, 0, W, 1000); }
    c.restore();
  }

  function eyes(x, y, s, k, t) {
    if (k <= 0) return;
    const ex = 30 * s, ey = -258 * s;
    c.globalCompositeOperation = 'lighter';
    const flick = 0.85 + 0.15 * Math.sin(t * 31);
    for (const sx of [-1, 1]) {
      const gx = x + sx * ex, gy = y + ey;
      c.globalAlpha = k * flick;
      const gs = 150 * s;
      c.drawImage(hot.red, gx - gs / 2, gy - gs / 2, gs, gs);
      c.fillStyle = '#ffd9dc';
      c.beginPath(); c.moveTo(gx - sx * 18 * s, gy + 7 * s); c.lineTo(gx + sx * 2 * s, gy - 4 * s); c.lineTo(gx + sx * 24 * s, gy - 10 * s); c.lineTo(gx + sx * 6 * s, gy + 8 * s); c.fill();
    }
    // the flare when they light up
    const fl = Math.exp(-Math.max(0, t - BEAT.eyes) * 5) * (t > BEAT.eyes ? 1 : 0);
    if (fl > 0.01) {
      c.globalAlpha = fl * k;
      c.drawImage(glow.red, x - 700 * s, y + ey - 9 * s, 1400 * s, 18 * s);
      c.drawImage(hot.red, x - 260 * s, y + ey - 4 * s, 520 * s, 8 * s);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  function clockHands(x, y, s, t) {
    // 23:59 creeping to midnight: the minute hand reaches 12 on impact
    const mins = 59 - 5 * (1 - seg(t, BEAT.rise, BEAT.impact)) + 1 * seg(t, BEAT.impact - 0.05, BEAT.impact);
    const ma = (mins / 60) * TAU, ha = ((11 + mins / 60) / 12) * TAU;
    const a0 = c.globalAlpha;
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.85 * a0;
    const gs = 260 * s;
    c.drawImage(glow.red, x - gs / 2, y - gs / 2, gs, gs);
    c.globalAlpha = a0;
    c.strokeStyle = '#ff4757'; c.lineCap = 'round';
    c.lineWidth = 7 * s; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(ha) * 34 * s, y - Math.cos(ha) * 34 * s); c.stroke();
    c.lineWidth = 4.5 * s; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(ma) * 52 * s, y - Math.cos(ma) * 52 * s); c.stroke();
    c.strokeStyle = 'rgba(255,60,80,0.8)'; c.lineWidth = 3 * s; c.beginPath(); c.arc(x, y, 64 * s, 0, TAU); c.stroke();
    c.globalCompositeOperation = 'source-over';
  }

  function focusLines(cx, cy, col, n, r0) {
    const r = rng(Math.floor(performance.now() / 45));
    c.fillStyle = col;
    const R0 = Math.hypot(W, 1000);
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, wd = 0.004 + r() * 0.016, rr = r0 * (0.7 + r() * 0.6);
      c.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      c.lineTo(cx + Math.cos(a - wd) * R0, cy + Math.sin(a - wd) * R0);
      c.lineTo(cx + Math.cos(a + wd) * R0, cy + Math.sin(a + wd) * R0);
      c.closePath();
    }
    c.fill();
  }

  let lastBurst = -1;
  const burstAt = (x, y, n, cols, speed, hotOn) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = speed * (0.3 + Math.random());
      const spark = Math.random() < 0.75;
      emit({ k: spark ? 'spark' : 'glow', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2.5, grav: 300, life: 0.35 + Math.random() * 0.5, size: spark ? 1.6 + Math.random() * 2.2 : 8 + Math.random() * 14, col: cols[i % cols.length], hot: hotOn && !spark });
    }
  };

  // ---------------------------------------------------------------- one frame
  let fr = null, fracReach = 0;
  function draw(t, dt) {
    step(t, dt);
    camera(t);
    const lt = lastT; lastT = t;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    const s = L.lord.s;
    const rise = lordRise(t);
    const lx = L.lord.x, ly = L.lord.y + rise;
    const defeated = seg(t, BEAT.flash, BEAT.shatter);

    // sky + blood moon + lightning
    const sk = skyPic();
    const blood = seg(t, BEAT.rise + 0.2, BEAT.rise + 0.8) * (1 - defeated * 0.7);
    if (sk && skyMode === 'backdrop') {
      view(0.15); drawSkyline(sk);
      if (blood > 0) { c.fillStyle = `rgba(120,10,60,${blood * 0.28})`; c.fillRect(-mU, -mU, W + 2 * mU, 1000 + 2 * mU); }
    } else {
      view(0.04); drawLayer(sky);
      if (blood > 0) { c.globalAlpha = blood * 0.85; put(bloodMoon, L.moon.x, L.moon.y, 1); c.globalAlpha = 1; }
    }
    const boltK = t > BEAT.bolt && t < BEAT.bolt + 0.22;
    if (boltK) {
      const r = rng(Math.floor(t * 40));
      const k = 1 - (t - BEAT.bolt) / 0.22;
      c.fillStyle = `rgba(200,150,255,${0.25 * k})`; c.fillRect(-mU, -mU, W + 2 * mU, 1000 + 2 * mU);
      drawLightning(boltPath(lx + 248 * s + 120, -40, lx + 248 * s, ly - 505 * s, 140, r), 'purple', 3.2 * k + 1);
      drawLightning(boltPath(lx - 300 * s - 160, -40, lx - 248 * s, ly - 505 * s, 120, r), 'purple', 2.2 * k + 0.6);
    }

    // Lord Deadline behind the city
    view(0.12);
    if (rise < 640 * s + 199) {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.5 * seg(t, BEAT.rise, BEAT.rise + 0.6) * (1 - defeated);
      const gs = 1300 * s;
      c.drawImage(glow.purple, lx - gs / 2, ly - 200 * s - gs / 2, gs, gs);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      drawParticles(0);
      c.globalAlpha = 1 - defeated * 0.75;
      const vi = villainPic();
      if (vi) drawPic(vi, lx, ly, 1000 * s * ART.villain.h, ART.villain.anchor[0], ART.villain.anchor[1], ART.villain.flip);
      else put(lord, lx, ly, s);
      c.globalAlpha = 1;
      if (t > BEAT.flash) {
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = (1 - defeated) * 0.8;
        c.drawImage(glow.white, lx - 500 * s, ly - 600 * s, 1000 * s, 1000 * s);
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      }
      if (!vi) {
        c.globalAlpha = 1 - defeated * 0.8;
        clockHands(lx, ly, s, t);
        c.globalAlpha = 1;
        eyes(lx, ly, s, seg(t, BEAT.eyes - 0.04, BEAT.eyes + 0.06) * (1 - defeated), t);
      } else if (ART.villain.eyes) {
        const b = villainBox(lx, ly), k = seg(t, BEAT.eyes - 0.04, BEAT.eyes + 0.06) * (1 - defeated);
        const fl = t > BEAT.eyes ? Math.exp(-(t - BEAT.eyes) * 5) : 0;
        c.globalCompositeOperation = 'lighter';
        for (const e of ART.villain.eyes) {
          const [ex, ey] = b.at(e);
          c.globalAlpha = k * 0.9; c.drawImage(hot.red, ex - 50 * s, ey - 50 * s, 100 * s, 100 * s);
          if (fl > 0.01) { c.globalAlpha = k * fl; c.drawImage(glow.red, ex - 520 * s, ey - 8 * s, 1040 * s, 16 * s); }
        }
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      }
    } else drawParticles(0);

    if (sk && skyMode === 'layer') { view(0.35); drawSkyline(sk); }
    else if (!sk) { view(0.25); drawLayer(far); view(0.5); drawLayer(mid); }
    view(0.5);
    // lantern strings between the buildings
    const strings = sk ? [] : portrait ? [[W * 0.04, 760, W * 0.24, 790, 36]] : [[W * 0.165, 770, W * 0.24, 742, 30], [W * 0.555, 712, W * 0.75, 740, 44], [W * 0.75, 690, W * 0.845, 740, 30]];
    c.lineWidth = 1.4; c.strokeStyle = 'rgba(10,6,20,0.9)';
    for (const [x1, y1, x2, y2, sag] of strings) {
      const sw = Math.sin(t * 2 + x1) * 4;
      c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo((x1 + x2) / 2 + sw, (y1 + y2) / 2 + sag * 2, x2, y2); c.stroke();
      for (let k = 1; k < 8; k++) {
        const q = k / 8, x = lerp(lerp(x1, (x1 + x2) / 2 + sw, q), lerp((x1 + x2) / 2 + sw, x2, q), q);
        const y = lerp(lerp(y1, (y1 + y2) / 2 + sag * 2, q), lerp((y1 + y2) / 2 + sag * 2, y2, q), q);
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.55;
        c.drawImage(glow.orange, x - 14, y + 2 - 14, 28, 28);
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
        c.fillStyle = k % 3 ? '#ff5a3c' : '#ffb347';
        c.beginPath(); c.ellipse(x, y + 6, 4.5, 6, 0, 0, TAU); c.fill();
      }
    }
    drawParticles(0.5);

    view(1); drawLayer(near);
    // the paper lantern swinging at the eave
    {
      const ax = L.tip + 20, ay = L.ridge - 36, sw = Math.sin(t * 2.2) * 0.12;
      const bx = ax + Math.sin(sw) * 40, by = ay + Math.cos(sw) * 40;
      c.strokeStyle = '#0a0612'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.8;
      c.drawImage(glow.orange, bx - 46, by + 14 - 46, 92, 92);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#e8402f'; c.beginPath(); c.ellipse(bx, by + 14, 11, 15, 0, 0, TAU); c.fill();
      c.fillStyle = '#ffb35c'; c.beginPath(); c.ellipse(bx, by + 14, 6, 11, 0, 0, TAU); c.fill();
      c.fillStyle = '#140a12'; c.fillRect(bx - 6, by - 2, 12, 3); c.fillRect(bx - 6, by + 27, 12, 3);
    }
    put(branch, W + 8, 0, portrait ? 0.75 : 1);

    // the Green Ninja
    const n = ninjaAt(t);
    const spinning = t >= BEAT.spin;
    const heroImg = pic('hero');
    if (!spinning && heroImg) {
      const leapK = n.pose === 'leap';
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.45;
      const gs = 260 * L.ninja.s;
      c.drawImage(glow.green, n.x - gs / 2, n.y - 60 * L.ninja.s - gs / 2, gs, gs);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      if (!leapK || !heroAir(n.x, n.y, 1)) drawPic(heroImg, n.x, n.y, L.ninja.s * 100 * ART.hero.h, ART.hero.foot[0], ART.hero.foot[1], ART.hero.flip);
    } else if (!spinning) {
      const ns = L.ninja.s;
      const P0 = POSE[n.pose];
      scarf(n.x + (P0.head[0] - 12) * ns, n.y + (P0.head[1] - 2) * ns, t, ns, n.pose === 'leap' ? [-0.55, 0.85] : [-1, 0.12]);
      if (t > BEAT.open) {
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5;
        const gs = 120 * ns;
        c.drawImage(glow.green, n.x + P0.tip[0] * ns * 0.7 - gs / 2, n.y + P0.tip[1] * ns * 0.8 - gs / 2, gs, gs);
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      }
      put(ninja[n.pose], n.x, n.y, L.ninja.s);
    }

    // comets, beams, the clash
    view(0.85);
    const sx = L.spin.x, sy = L.spin.y, ss = L.spin.s;
    const torTop = [sx, sy - 190 * ss];
    if (spinning && t < BEAT.flash) tornado(t, sx, sy, ss);
    if (t > BEAT.comets && t < BEAT.impact) {
      for (const cm of COMETS) {
        const k = seg(t, BEAT.comets + cm.t0, BEAT.comets + cm.t0 + 0.3);
        if (k <= 0 || k >= 1) {
          if (k >= 1 && !cm.hit) { cm.hit = true; burstAt(sx, sy - 100 * ss, portrait ? 14 : 24, [cm.col, 'white'], 520, true); }
          continue;
        }
        const target = [sx, sy - 100 * ss];
        const ctl = [(cm.from[0] + target[0]) / 2 + cm.bend[0], (cm.from[1] + target[1]) / 2 + cm.bend[1]];
        const e = ei(k) * 0.6 + k * 0.4;
        const [hx, hy] = quad(cm.from, target, ctl, e);
        const [qx, qy] = quad(cm.from, target, ctl, Math.max(0, e - 0.08));
        c.globalCompositeOperation = 'lighter';
        c.drawImage(glow[cm.col], hx - 80, hy - 80, 160, 160);
        c.drawImage(hot[cm.col], hx - 24, hy - 24, 48, 48);
        c.globalCompositeOperation = 'source-over';
        if (cm.kind === 'bolt') drawLightning(boltPath(qx, qy, hx, hy, 30, Math.random), 'blue', 2);
        const nEmit = Math.ceil(dt * 120);
        for (let i = 0; i < nEmit; i++) {
          const f = Math.random();
          const ex = lerp(qx, hx, f), ey = lerp(qy, hy, f);
          if (cm.kind === 'earth' && Math.random() < 0.25) emit({ k: 'chunk', x: ex, y: ey, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, grav: 500, life: 0.6, size: 4 + Math.random() * 6, rot: Math.random() * 3, vr: 8 });
          else emit({ k: cm.kind === 'ice' && Math.random() < 0.4 ? 'spark' : 'glow', x: ex, y: ey, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80, drag: 3, life: 0.25 + Math.random() * 0.3, size: cm.kind === 'ice' ? 2.4 : 22 + Math.random() * 26, col: cm.kind === 'ice' ? (Math.random() < 0.5 ? 'white' : 'cyan') : cm.col });
        }
      }
    }
    const cx = L.clash.x + Math.sin(t * 9) * 8, cy = L.clash.y + Math.cos(t * 7) * 4;
    if (t > BEAT.beamL && t < BEAT.impact) {
      const k = eo(seg(t, BEAT.beamL, BEAT.beamL + 0.14));
      const meet = t > BEAT.beamN + 0.1;
      const ex = meet ? cx : lerp(lx, cx + (cx - lx) * 0.35, k), ey = meet ? cy : lerp(ly, cy + (cy - ly) * 0.35, k);
      const [bx, by] = villainCv ? villainBox(lx, ly).at(ART.villain.beam) : [lx, ly];
      beam(bx, by, ex, ey, 26 * (0.6 + 0.4 * k), 'purple', t);
      beam(bx, by, ex, ey, 10, 'red', t + 1, false);
    }
    if (t > BEAT.beamN && t < BEAT.impact) {
      const k = eo(seg(t, BEAT.beamN, BEAT.beamN + 0.1));
      beam(torTop[0], torTop[1], lerp(torTop[0], cx, k), lerp(torTop[1], cy, k), 24 * (0.6 + 0.4 * k), 'green', t + 3);
    }
    if (t > BEAT.beamN + 0.08 && t < BEAT.impact) {
      const k = seg(t, BEAT.beamN + 0.08, BEAT.impact);
      const rr = lerp(18, portrait ? 70 : 96, eo(k)) * (0.9 + 0.1 * Math.sin(t * 50));
      c.globalCompositeOperation = 'lighter';
      c.drawImage(glow.purple, cx - rr * 3.2 + rr * 0.6, cy - rr * 3.2, rr * 6.4, rr * 6.4);
      c.drawImage(glow.green, cx - rr * 3.2 - rr * 0.6, cy - rr * 3.2, rr * 6.4, rr * 6.4);
      c.drawImage(hot.white, cx - rr * 1.3, cy - rr * 1.3, rr * 2.6, rr * 2.6);
      c.globalCompositeOperation = 'source-over';
      const r = rng(Math.floor(t * 30));
      for (let i = 0; i < 3; i++) {
        const a = r() * TAU, len = rr * (1.4 + r() * 2.2);
        drawLightning(boltPath(cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len, len * 0.35, r, 4), r() < 0.5 ? 'purple' : 'green', 1.6);
      }
      if (Math.random() < 0.9) burstAt(cx, cy, Math.ceil(dt * (portrait ? 90 : 160)), ['white', 'green', 'purple', 'gold'], 700, false);
    }
    // the blast after the impact frames
    if (t >= BEAT.flash && t < BEAT.shatter) {
      if (lastBurst < 0) { lastBurst = t; burstAt(L.clash.x, L.clash.y, portrait ? 60 : 120, ['white', 'green', 'purple', 'gold', 'cyan'], 1300, true); }
      const k = seg(t, BEAT.flash, BEAT.shatter);
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = (1 - k) * 0.75;
      const gs = lerp(420, 900, eo(k)) * (portrait ? 0.7 : 1);
      c.drawImage(glow.white, L.clash.x - gs / 2, L.clash.y - gs / 2, gs, gs);
      c.globalAlpha = (1 - k) * 0.35;
      c.drawImage(glow.green, L.clash.x - gs * 0.7, L.clash.y - gs * 0.7, gs * 1.4, gs * 1.4);
      c.globalAlpha = 1;
      c.strokeStyle = `rgba(220,255,235,${(1 - k) * 0.9})`; c.lineWidth = 18 * (1 - k);
      c.beginPath(); c.arc(L.clash.x, L.clash.y, 40 + eo(k) * 900, 0, TAU); c.stroke();
      c.globalCompositeOperation = 'source-over';
      // the ninja hangs in the air, lit
      if (!heroAir(sx, sy - 10, ss * 0.8)) put(ninja.leap, sx, sy - 10, L.ninja.s * ss * 0.8);
    }

    view(1);
    drawParticles(1);

    // grade, vignette, letterbox, titles
    screen();
    c.drawImage(vignette, -W * 0.08, -80, W * 1.16, 1160);
    if (!portrait) {
      const lb = 46 * eo(seg(t, BEAT.open, BEAT.open + 0.4));
      c.fillStyle = '#000'; c.fillRect(0, 0, W, lb); c.fillRect(0, 1000 - lb, W, lb);
    }
    caption(t);
    warning(t);
    vsCard(t);

    // impact frames: a negative, a black frame, a white one
    if (t >= BEAT.impact && t < BEAT.flash) {
      const f = Math.floor((t - BEAT.impact) / 0.045);
      if (f === 0) {
        c.globalCompositeOperation = 'difference'; c.fillStyle = '#fff'; c.fillRect(0, 0, W, 1000);
        c.globalCompositeOperation = 'saturation'; c.fillStyle = '#808080'; c.fillRect(0, 0, W, 1000);
        c.globalCompositeOperation = 'multiply'; c.fillStyle = '#ff9aa6'; c.fillRect(0, 0, W, 1000);
        c.globalCompositeOperation = 'source-over';
        focusLines(L.clash.x, L.clash.y, 'rgba(0,0,0,0.9)', 90, portrait ? 150 : 230);
      } else if (f === 1) {
        c.fillStyle = '#05010a'; c.fillRect(0, 0, W, 1000);
        focusLines(L.clash.x, L.clash.y, 'rgba(255,255,255,0.95)', 110, portrait ? 110 : 170);
        c.globalCompositeOperation = 'lighter';
        c.drawImage(hot.white, L.clash.x - 160, L.clash.y - 160, 320, 320);
        c.globalCompositeOperation = 'source-over';
      } else {
        c.fillStyle = '#fff'; c.fillRect(0, 0, W, 1000);
        focusLines(L.clash.x, L.clash.y, 'rgba(10,0,20,0.85)', 70, portrait ? 200 : 300);
      }
    }
    if (t >= BEAT.flash && t < BEAT.shatter) {
      const k = 1 - eo(seg(t, BEAT.flash, BEAT.flash + 0.22));
      if (k > 0) { c.fillStyle = `rgba(255,255,255,${k})`; c.fillRect(0, 0, W, 1000); }
    }
    // SUBMITTED, stamped onto the glass
    if (t >= BEAT.stamp && late.stamp) {
      const k = seg(t, BEAT.stamp, BEAT.stamp + 0.08);
      const sc = lerp(2.3, 1, eo(k));
      c.save();
      c.translate(L.clash.x, L.clash.y + (portrait ? 0 : 6));
      c.rotate(-0.16);
      c.scale(sc, sc);
      c.globalAlpha = Math.min(1, k * 1.6);
      put(late.stamp, 0, 0, portrait ? 0.78 : 1);
      c.restore();
    }
    // the cracks
    if (t >= BEAT.crack && fr) {
      fracReach = eo(seg(t, BEAT.crack, BEAT.shatter - 0.04));
      c.setTransform(R, 0, 0, R, 0, 0);
      drawCracks(c, fr, fracReach);
      screen();
    }

    // the opening: a slash across the dark, then the dark falls apart along it
    if (t < BEAT.rise) {
      const a = portrait ? [-60, 650] : [-60, 770], b = portrait ? [W + 60, 330] : [W + 60, 210];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
      if (t > BEAT.open && t < BEAT.open + 0.2) { c.fillStyle = `rgba(220,255,235,${0.4 * (1 - seg(t, BEAT.open, BEAT.open + 0.2))})`; c.fillRect(0, 0, W, 1000); }
      const part = eio(seg(t, BEAT.open, BEAT.rise)) * 760;
      if (part < 760) {
        c.fillStyle = '#000';
        for (const sgn of [-1, 1]) {
          const ox = nx * part * sgn, oy = ny * part * sgn, far = 3000 * sgn;
          c.beginPath();
          c.moveTo(a[0] - dx + ox, a[1] - dy + oy); c.lineTo(b[0] + dx + ox, b[1] + dy + oy);
          c.lineTo(b[0] + dx + ox + nx * far, b[1] + dy + oy + ny * far); c.lineTo(a[0] - dx + ox + nx * far, a[1] - dy + oy + ny * far);
          c.closePath(); c.fill();
        }
      }
      const draw0 = eo(seg(t, BEAT.slash, BEAT.open - 0.06));
      const fade = 1 - seg(t, BEAT.open, BEAT.open + 0.25);
      if (draw0 > 0 && fade > 0) {
        const hx = lerp(a[0], b[0], draw0), hy = lerp(a[1], b[1], draw0);
        const wid = t > BEAT.open - 0.06 ? 1 + 3 * (1 - fade) : 1;
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = fade;
        c.lineCap = 'round';
        c.strokeStyle = 'rgba(61,255,143,0.35)'; c.lineWidth = 16 * wid; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(hx, hy); c.stroke();
        c.strokeStyle = 'rgba(220,255,235,1)'; c.lineWidth = 3.2 * wid; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(hx, hy); c.stroke();
        if (draw0 < 1) {
          c.drawImage(hot.green, hx - 70, hy - 70, 140, 140);
          if (lt < t) for (let i = 0; i < 3; i++) emit({ k: 'spark', x: hx, y: hy, vx: (Math.random() - 0.3) * 600, vy: (Math.random() - 0.5) * 600, drag: 3, grav: 900, life: 0.35, size: 2, col: Math.random() < 0.5 ? 'green' : 'white' });
        }
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      }
      if (t < BEAT.open) { view(1); drawParticles(1); screen(); }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }

  return {
    L,
    /** the hit point in CSS px */
    impact: () => [L.clash.x * U, L.clash.y * U],
    setFracture(f) { fr = f; },
    /** paint one deferred sprite; false when there is nothing left */
    prepare() { const job = lateJobs.shift(); if (job) job(); return lateJobs.length > 0; },
    draw,
  };
}
