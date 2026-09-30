// Where the landmarks stand. world.js flattens the ground under each plot before it meshes the
// terrain; stage.js builds the landmark on top. Coordinates are world units (x, z), y is up.
// Yaw follows three.js: rotation.y = yaw turns a prop's local +z toward (sin yaw, cos yaw).

const PI = Math.PI;

export const LAYOUT = {
  // Ground that is levelled and paved (or sanded) before the terrain is meshed.
  plots: [
    { id: 'cse',  cx: 16,  cz: 1,  hx: 8,  hz: 5,  h: 3, type: 'PATH' },
    { id: 'gate', cx: -13, cz: -4, hx: 9,  hz: 3,  h: 3, type: 'GRASS' },
    { id: 'pier', cx: 28.5, cz: 7, hx: 2.5, hz: 4, h: 2, type: 'SAND' },
    { id: 'sun',  cx: 18,  cz: 12, hx: 4,  hz: 4,  h: 3, type: 'GRASS' },
    // the outer campus (heights follow the ground: `auto` takes the median of what was there)
    { id: 'libwalk', cx: -8, cz: 22, hx: 3, hz: 8.5, h: 3, type: 'PAVE', auto: true, ramp: 3 },
    { id: 'price', cx: -9, cz: 41, hx: 11, hz: 6, h: 3, type: 'PAVE', auto: true, ramp: 3 },
    { id: 'rimac', cx: -18, cz: -39, hx: 12, hz: 5, h: 4, type: 'PAVE', auto: true, ramp: 3 },
    { id: 'warren', cx: 13, cz: -42.5, hx: 13, hz: 5.5, h: 4, type: 'PAVE', auto: true, ramp: 3 },
    { id: 'glider', cx: 40, cz: -28, hx: 4, hz: 3, h: 10, type: 'DIRT', ramp: 0 },
  ],

  tower: { x: 0, z: -1 },
  cse: { x: 16, z: 1, yaw: 0 },                    // faces south, onto the Sun God lawn
  gate: { x: -13, z: -4, yaw: Math.PI },           // faces north, out toward the door and the cold aisle

  camp: {
    tent: { x: 9.5, z: -12.5, yaw: PI / 2 },
    fire: { x: 14, z: -15.5 },
    bench: { x: 19, z: -13, yaw: PI },
    unit7: { x: 14, z: -12 },
  },

  // Project monuments in an arc behind the camp.
  monuments: {
    starry: { x: 5,    z: -20,   yaw: PI },
    im:     { x: 12.5, z: -21.5, yaw: PI },
    oj:     { x: 20,   z: -20,   yaw: PI },
    triton: { x: 26,   z: -14.5, yaw: PI - 0.5 },
  },

  sungod: { x: 18, z: 12, yaw: -0.4 },
  mailbox: { x: 14, z: 7.5, yaw: PI / 2 },
  pier: { x: 28, z: 7 },                          // built along +x, out into the Scripps cove
  seals: [{ x: 29.5, z: 13.5 }, { x: 30, z: 0.5 }],

  // ---- the outer campus (districts.js builds them; world.js shapes the ground) ----
  libwalk: { x0: -11, x1: -5, z0: 14, z1: 30 },   // Library Walk runs south from the plaza
  price: { x: -9, z: 41 },                        // Price Center plaza (food stands, tables)
  rimac: { x: -13, z: -40, field: { x: -25, z: -39 } },
  warren: { x: 13, z: -42.5 },                    // Warren Mall, Jacobs School buildings
  mesa: { x0: 34, z1: -20, h: 10 },               // the Torrey Pines mesa (cliffs to Black's Beach)
  stairs: { z0: -41, z1: -37 },                   // from Warren Mall up to the mesa
  gliderport: { x: 40, z: -28 },
  blacks: { x: 46, z: -33 },
  // the campus shuttle loop (closed; Catmull-Rom through these points)
  loop: [[30, -28], [31, -14], [27, -6], [25, 2], [25, 14], [23, 24], [14, 31], [0, 33], [-14, 33], [-28, 30],
    [-38, 20], [-42, 4], [-40, -12], [-29, -23], [-18, -30], [-4, -31], [12, -32], [24, -32]],
  stops: [{ at: 4, name: 'Scripps Pier' }, { at: 8, name: 'Price Center' }, { at: 15, name: 'RIMAC' }, { at: 17, name: 'Warren' }],

};

// Snake Path: a mosaic snake laid across the open field south-west of the plaza, running east to
// west with a gentle S. The experience flags are planted along it, newest job first, so scrolling
// walks back in time.
const SNAKE = { x: 7, z: 6.5, dx: -21, dz: 3, wiggle: 2.2, turns: 7, n: 44 };
export const snakePoints = [];
for (let i = 0; i < SNAKE.n; i++) {
  const t = i / (SNAKE.n - 1);
  snakePoints.push([Math.round(SNAKE.x + SNAKE.dx * t), Math.round(SNAKE.z + SNAKE.dz * t + Math.sin(t * SNAKE.turns) * SNAKE.wiggle)]);
}
// Experience trail: six flags along the Snake Path on the plaza's south side. East is the present
// (the CSE building, Picasso Lab), west is the past (the Tsinghua gate), so scrolling down walks back
// in time. Each flag stands a step south of the path.
const FLAG_DEFS = [
  ['flag-samsung', '#6e8bff'], ['flag-picasso', '#a78bfa'], ['flag-metabit', '#2dd4bf'], ['flag-tencent', '#38bdf8'], ['flag-hotstar', '#6366f1'], ['flag-lark', '#22d3ee'],
];
LAYOUT.flags = FLAG_DEFS.map(([id, colour], i) => {
  const tx = 6 - i * 3.6;
  const [px, pz] = snakePoints.reduce((best, q) => (Math.abs(q[0] - tx) < Math.abs(best[0] - tx) ? q : best), snakePoints[0]);
  return { id, colour, x: px, z: pz + 3 };
});

/** The shuttle loop as a closed polyline sampled about every `step` units (centripetal-ish Catmull-Rom). */
export function loopPath(step = 1) {
  const P = LAYOUT.loop, n = P.length, out = [];
  const cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const k = Math.max(2, Math.ceil(len / step));
    for (let j = 0; j < k; j++) {
      const t = j / k;
      out.push({ x: cr(p0[0], p1[0], p2[0], p3[0], t), z: cr(p0[1], p1[1], p2[1], p3[1], t), seg: i });
    }
  }
  return out;
}
