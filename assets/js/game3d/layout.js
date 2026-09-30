// Where the landmarks stand. world.js flattens the ground under each plot before it meshes the
// terrain; stage.js builds the landmark on top. Coordinates are world units (x, z), y is up.
// Yaw follows three.js: rotation.y = yaw turns a prop's local +z toward (sin yaw, cos yaw).

const PI = Math.PI;

export const LAYOUT = {
  // Ground that is levelled and paved (or sanded) before the terrain is meshed.
  plots: [
    { id: 'cse',  cx: 16,  cz: 1,  hx: 8,  hz: 5,  h: 3, type: 'PATH' },
    { id: 'gate', cx: -13, cz: -4, hx: 9,  hz: 3,  h: 3, type: 'GRASS' },
    { id: 'pier', cx: 26,  cz: 7,  hx: 3,  hz: 4,  h: 2, type: 'SAND' },
    { id: 'sun',  cx: 18,  cz: 12, hx: 4,  hz: 4,  h: 3, type: 'GRASS' },
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
  pier: { x: 25, z: 7 },                          // built along +x, out to sea
  seals: [{ x: 24.5, z: 12.5 }, { x: 27, z: 3 }],

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
// Experience trail: five flags along the Snake Path on the plaza's south side. East is the present
// (the CSE building, Picasso Lab), west is the past (the Tsinghua gate), so scrolling down walks back
// in time. Each flag stands a step south of the path.
const FLAG_DEFS = [
  ['flag-picasso', '#a78bfa'], ['flag-metabit', '#2dd4bf'], ['flag-tencent', '#38bdf8'], ['flag-hotstar', '#6366f1'], ['flag-lark', '#22d3ee'],
];
LAYOUT.flags = FLAG_DEFS.map(([id, colour], i) => {
  const tx = 5.5 - i * 3.9;
  const [px, pz] = snakePoints.reduce((best, q) => (Math.abs(q[0] - tx) < Math.abs(best[0] - tx) ? q : best), snakePoints[0]);
  return { id, colour, x: px, z: pz + 3 };
});
