// The outer campus around the old core: Library Walk (banners, club tables), Price Center (food
// stands, umbrellas), RIMAC Arena and its field, Warren Mall with the Jacobs School buildings, the
// Torrey Pines Gliderport on the mesa, a lifeguard tower on Black's Beach, the Scripps Pier sign, and
// the campus shuttle loop (lamps and stops). Every voxel goes into the island's static mesh (one
// draw call for all of it); every text board goes into one sign atlas (one more).
import { LAYOUT } from './layout.js';
import { buildSigns } from './signs.js';
import { doorSigns, buildDoorMarks } from './doors.js';
import { hash3 } from './props.js';

const PI = Math.PI;

export function buildDistricts(world, parent, { lowfx = false } = {}) {
  const hub = world.hub;
  const out = hub.statics;
  const put = (x, y, z, c, g = 0) => out.push([x, y, z, c, g]);
  const ground = (x, z) => hub.height(x, z);
  const block = (x0, x1, z0, z1) => { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) hub.block(x, z); };
  const plot = (id) => LAYOUT.plots.find((p) => p.id === id);
  const signs = [];
  const sign = (s) => signs.push({ back: true, ...s });
  const pick = (arr, x, y, z) => arr[Math.floor(hash3(x, y, z) * arr.length)];

  /** A hollow block with window bands; `lobby` ('n'|'s'|'e'|'w') gets a glass ground floor. */
  function building(x0, x1, z0, z1, y0, storeys, { wall = ['#d9dde5', '#cfd4de'], lit = '#ffd98a', dark = '#34405a', mullion = '#9aa3b2', roof = '#7b8494', litP = 0.72, lobby = null, glass = null, band = 3 } = {}) {
    const top = y0 + storeys * 2;
    for (let y = y0 + 1; y <= top; y++) {
      const row = y - y0;
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        if (x !== x0 && x !== x1 && z !== z0 && z !== z1) continue;
        const corner = (x === x0 || x === x1) && (z === z0 || z === z1);
        const side = z === z1 ? 's' : z === z0 ? 'n' : x === x1 ? 'e' : 'w';
        const along = side === 'n' || side === 's' ? x - x0 : z - z0;
        if (!corner && row <= 2 && lobby === side) { put(x, y, z, glass || '#ffe2a0', row === 1 && along % 4 === 2 ? 0.2 : 0.75); continue; }
        if (!corner && row % 2 === 0 && along % band !== 0) {
          const on = hash3(x, y, z) < litP;
          put(x, y, z, on ? lit : dark, on ? 0.8 : 0);
        } else put(x, y, z, row % 2 === 0 && !corner ? mullion : pick(wall, x, y, z));
      }
    }
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) put(x, top + 1, z, (x + z) % 7 ? roof : '#6a7282');
    // rooftop plant
    const mx = Math.round((x0 + x1) / 2), mz = Math.round((z0 + z1) / 2);
    for (const [dx, dz] of [[0, 0], [1, 0]]) put(mx + dx, top + 2, mz + dz, '#9ca3af');
    block(x0, x1, z0, z1);
    return top;
  }

  // ---------------------------------------------------------------- Library Walk
  {
    const LW = LAYOUT.libwalk, y = plot('libwalk').h;
    const BANNERS = [['#1f3b73', '#f2c14e'], ['#f2c14e', '#1f3b73'], ['#0e7490', '#e2e8f0'], ['#be123c', '#fde68a'], ['#15803d', '#f0fdf4']];
    let k = 0;
    for (const x of [LW.x0, LW.x1]) {
      const dir = x === LW.x0 ? 1 : -1;
      for (let z = LW.z0 + 3; z <= LW.z1 - 1; z += 5) {
        for (let yy = 1; yy <= 5; yy++) put(x, y + yy, z, '#394152');
        put(x, y + 6, z, '#ffe6a3', 1.8);
        const [a, b] = BANNERS[k++ % BANNERS.length];
        for (let yy = 3; yy <= 5; yy++) put(x + dir, y + yy, z, yy === 4 ? b : a, 0.12);
        hub.block(x, z);
      }
    }
    // the arch at the plaza end
    for (const x of [LW.x0, LW.x1]) { for (let yy = 1; yy <= 4; yy++) put(x, y + yy, LW.z0, '#e5e7eb'); hub.block(x, LW.z0); }
    for (let x = LW.x0; x <= LW.x1; x++) put(x, y + 5, LW.z0, x % 2 ? '#1f3b73' : '#f2c14e', 0.1);
    sign({ id: 'libwalk', text: 'Library Walk', sub: 'Fiat lux · clubs, flyers, free snacks', colour: '#f2c14e', x: (LW.x0 + LW.x1) / 2, y: y + 3.7, z: LW.z0 + 0.1, yaw: 0, w: 5.2, h: 1.3 });
    // club tables with coloured cloths
    const CLOTH = ['#ef4444', '#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#ec4899'];
    [[LW.x0 + 1, LW.z0 + 4], [LW.x1 - 1, LW.z0 + 7], [LW.x0 + 1, LW.z0 + 10], [LW.x1 - 1, LW.z0 + 12]].forEach(([x, z], i) => {
      for (const dz of [0, 1]) put(x, y + 1, z + dz, CLOTH[i % CLOTH.length]);
      void i;
      put(x, y + 2, z, '#f8fafc', 0.25);
      block(x, x, z, z + 1);
    });
  }

  // ---------------------------------------------------------------- Price Center
  {
    const P = plot('price'), y = P.h;
    const x0 = Math.ceil(P.cx - P.hx), x1 = Math.floor(P.cx + P.hx), z0 = Math.ceil(P.cz - P.hz), z1 = Math.floor(P.cz + P.hz);
    const SAND = ['#e8d7b6', '#dccaa6', '#efe0c2'];
    const top = building(x0 + 1, x1 - 6, z1 - 3, z1, y, 3, { wall: SAND, roof: '#8a7f6e', mullion: '#b8a88a', lobby: 'n', litP: 0.8 });
    building(x0, x0 + 3, z0 + 1, z1 - 4, y, 2, { wall: SAND, roof: '#8a7f6e', mullion: '#b8a88a', lobby: 'e', litP: 0.75 });
    sign({ id: 'price', text: 'Price Center', sub: 'Food court · open late', colour: '#f97316', x: (x0 + 1 + x1 - 6) / 2, y: top - 0.6, z: z1 - 3 - 0.55, yaw: PI, w: 7, h: 1.4, back: false });
    // food stands along the north edge, facing the plaza
    const FOOD = [['Tacos', '#ef4444', 'al pastor · veggie'], ['Boba', '#a855f7', 'milk tea · extra pearls'], ['Coffee', '#b45309', 'fuel for paper deadlines'], ['Noodles', '#f59e0b', 'hot, fast, cheap']];
    FOOD.forEach(([name, colour, sub], i) => {
      const cx = x0 + 5 + i * 4, zb = z0;
      for (let yy = 1; yy <= 3; yy++) {
        for (let x = cx - 1; x <= cx + 1; x++) put(x, y + yy, zb, '#475569');
        for (const x of [cx - 1, cx + 1]) put(x, y + yy, zb + 1, '#64748b');
      }
      for (let x = cx - 1; x <= cx + 1; x++) put(x, y + 1, zb + 2, '#ffcf6b', 0.55);
      for (let x = cx - 1; x <= cx + 1; x++) for (let z = zb; z <= zb + 3; z++) put(x, y + 4, z, (x + z) % 2 ? colour : '#f8fafc', 0.05);
      block(cx - 1, cx + 1, zb, zb + 2);
      sign({ id: `food-${i}`, text: name, sub, colour, x: cx, y: y + 5.4, z: zb + 1.5, yaw: 0, w: 3, h: 0.75 });
    });
    // tables and umbrellas
    const UMB = ['#14b8a6', '#fb7185', '#facc15', '#60a5fa', '#a3e635'];
    [[x0 + 5, z0 + 6], [x0 + 10, z0 + 7], [x0 + 15, z0 + 6], [x0 + 20, z0 + 7], [x0 + 8, z0 + 9], [x0 + 18, z0 + 9]].forEach(([x, z], i) => {
      if (x > x1 || z > z1 - 4) return;
      put(x, y + 1, z, '#e5e7eb');
      put(x, y + 2, z, '#6b7280'); put(x, y + 3, z, '#6b7280');
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (Math.abs(dx) + Math.abs(dz) < 2 || i % 2) put(x + dx, y + 4, z + dz, UMB[i % UMB.length]);
      hub.block(x, z);
    });
  }

  // ---------------------------------------------------------------- RIMAC Arena and its field
  {
    const R = plot('rimac'), y = R.h;
    const x0 = -19, x1 = Math.floor(R.cx + R.hx) - 1, z0 = Math.ceil(R.cz - R.hz), z1 = Math.floor(R.cz + R.hz) - 1;
    const WALL = ['#e5e7eb', '#d9dde4', '#cfd5de'];
    for (let yy = 1; yy <= 7; yy++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (x !== x0 && x !== x1 && z !== z0 && z !== z1) continue;
      const corner = (x === x0 || x === x1) && (z === z0 || z === z1);
      const entrance = z === z1 && yy <= 3 && x > x0 + 2 && x < x1 - 2;
      if (entrance) { put(x, y + yy, z, '#ffe2a0', yy === 3 ? 0.3 : 0.85); continue; }
      if (!corner && (yy === 5 || yy === 4) && (x + z) % 3) { put(x, y + yy, z, '#9fd3ff', 0.55); continue; }
      put(x, y + yy, z, yy === 7 ? '#1d4ed8' : pick(WALL, x, yy, z));
    }
    // the barrel roof, cresting down the middle
    const zc = (z0 + z1) / 2, half = (z1 - z0) / 2;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const lift = Math.round(3.2 * Math.cos(((z - zc) / (half + 0.5)) * (PI / 2)));
      for (let yy = 8; yy <= 8 + lift; yy++) {
        const edge = yy === 8 + lift;
        if (!edge && x !== x0 && x !== x1) continue;
        put(x, y + yy, z, edge ? (Math.abs(z - zc) < 0.6 ? '#f2c14e' : (x % 3 ? '#8b95a8' : '#7c869a')) : pick(WALL, x, yy, z));
      }
    }
    block(x0, x1, z0, z1);
    sign({ id: 'rimac', text: 'RIMAC Arena', sub: 'Go Tritons!', colour: '#1d4ed8', x: (x0 + x1) / 2, y: y + 6, z: z1 + 0.55, yaw: 0, w: 6.5, h: 1.35, back: false });
    // goals on the field (three blocks wide, with a net behind: toys.js scores a ball rolled in between the posts)
    const F = LAYOUT.rimac.field;
    for (const gx of [F.x - 4, F.x + 4]) {
      for (const gz of [F.z - 2, F.z + 2]) { put(gx, y + 1, gz, '#f8fafc'); put(gx, y + 2, gz, '#f8fafc'); hub.block(gx, gz); }
      for (let gz = F.z - 2; gz <= F.z + 2; gz++) put(gx, y + 3, gz, '#f8fafc');
      const nx = gx + Math.sign(gx - F.x);
      for (let gz = F.z - 1; gz <= F.z + 1; gz++) { for (let yy = 1; yy <= 2; yy++) put(nx, y + yy, gz, (gz + yy) % 2 ? '#cbd5e1' : '#94a3b8'); hub.block(nx, gz); }
    }
  }

  // ---------------------------------------------------------------- Warren Mall and the Jacobs School
  {
    const Wp = plot('warren'), y = Wp.h;
    const x0 = Math.ceil(Wp.cx - Wp.hx), x1 = Math.floor(Wp.cx + Wp.hx), z0 = Math.ceil(Wp.cz - Wp.hz), z1 = Math.floor(Wp.cz + Wp.hz);
    const CONC = ['#c9cfd8', '#bec5d0', '#d3d8e0'];
    const t1 = building(x0 + 1, x0 + 11, z0, z0 + 2, y, 3, { wall: CONC, lobby: 's', litP: 0.66 });
    building(x0 + 14, x1 - 1, z0, z0 + 2, y, 3, { wall: ['#b9c0cc', '#aeb6c3'], lobby: 's', litP: 0.6, band: 2 });
    building(x0 + 16, x1 - 1, z1 - 2, z1, y, 1, { wall: ['#d6c7ae', '#cbbca3'], lobby: 'n', litP: 0.7 });
    sign({ id: 'jacobs', text: 'Jacobs School', sub: 'of Engineering', colour: '#0ea5e9', x: x0 + 6, y: t1 - 0.4, z: z0 + 2 + 0.55, yaw: 0, w: 5.5, h: 1.3, back: false });
    // the mall: planters and a post at the west entrance
    for (let x = x0 + 2; x <= x0 + 12; x += 5) for (const z of [z1 - 2, z1 - 1]) { put(x, y + 1, z, '#6b7280'); put(x, y + 2, z, '#3f8f4f'); hub.block(x, z); }
    for (let yy = 1; yy <= 2; yy++) put(x0, y + yy, z0 + 6, '#394152');
    hub.block(x0, z0 + 6);
    sign({ id: 'warren', text: 'Warren Mall', sub: 'Engineering quad', colour: '#0ea5e9', x: x0, y: y + 3.1, z: z0 + 6, yaw: -PI / 2, w: 3.4, h: 0.85 });
  }

  // ---------------------------------------------------------------- the gliderport on the mesa
  {
    const Gp = plot('glider'), y = Gp.h;
    const gx = LAYOUT.gliderport.x, gz = LAYOUT.gliderport.z;
    for (let yy = 1; yy <= 3; yy++) for (let x = gx - 3; x <= gx - 1; x++) for (let z = gz - 3; z <= gz - 2; z++) {
      const win = yy === 2 && z === gz - 2 && x !== gx - 3;
      put(x, y + yy, z, win ? '#ffe6a3' : '#d6c1a0', win ? 0.8 : 0);
    }
    for (let x = gx - 4; x <= gx; x++) for (let z = gz - 4; z <= gz - 1; z++) put(x, y + 4, z, '#b45309');
    block(gx - 3, gx - 1, gz - 3, gz - 2);
    sign({ id: 'glider', text: 'Gliderport', sub: 'Torrey Pines · jump, then hold Space', colour: '#f97316', x: gx - 2, y: y + 5.3, z: gz - 1.5, yaw: 0, w: 4.2, h: 1 });
    // windsock
    const wx = gx + 3, wz = gz + 2;
    for (let yy = 1; yy <= 6; yy++) put(wx, y + yy, wz, '#9ca3af');
    for (let k = 1; k <= 3; k++) put(wx + k, y + 6, wz, k % 2 ? '#f97316' : '#f8fafc', 0.1);
    hub.block(wx, wz);
    // two wings laid out ready to fly
    for (const [ox, oz, a, b] of [[1, 0, '#ef4444', '#f8fafc'], [1, 3, '#2563eb', '#facc15']]) {
      for (let k = -3; k <= 3; k++) put(gx + ox + k, y + 1, gz + oz + Math.round(k * k * 0.18), Math.abs(k) % 2 ? a : b);
    }
  }

  // ---------------------------------------------------------------- Black's Beach
  {
    const [tx, tz] = [46, -30];
    const by = ground(tx, tz);
    if (by > -Infinity) {
      for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) for (let yy = 1; yy <= 2; yy++) put(tx + dx, by + yy, tz + dz, '#94a3b8');
      for (let yy = 3; yy <= 4; yy++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(tx + dx, by + yy, tz + dz, yy === 4 && (dx + dz) % 2 ? '#bfe3ff' : '#f8fafc', yy === 4 ? 0.3 : 0);
      for (let dx = -1; dx <= 2; dx++) for (let dz = -1; dz <= 2; dz++) put(tx + dx, by + 5, tz + dz, '#dc2626');
      block(tx, tx + 1, tz, tz + 1);
    }
    for (const [x, z, c] of [[44, -34, '#22d3ee'], [43, -36, '#f472b6'], [41, -38, '#facc15']]) {
      const gy = ground(x, z);
      if (!(gy > -Infinity) || gy > 3) continue;
      for (let yy = 1; yy <= 3; yy++) put(x, gy + yy, z, yy === 2 ? '#f8fafc' : c);
      hub.block(x, z);
    }
    const sx = 46, sz = -22, sy = ground(sx, sz);
    if (sy > -Infinity) {
      for (let yy = 1; yy <= 2; yy++) put(sx, sy + yy, sz, '#394152');
      hub.block(sx, sz);
      sign({ id: 'blacks', text: 'Black’s Beach', sub: 'Glide down (hold Space) or walk round from the cove', colour: '#38bdf8', x: sx, y: sy + 3.1, z: sz, yaw: PI / 2, w: 3.8, h: 0.95 });
    }
  }

  // ---------------------------------------------------------------- Scripps Pier
  {
    const P = LAYOUT.pier;
    const x = P.x - 1, z = P.z - 4;
    const gy = ground(x, z);
    if (gy > -Infinity) {
      for (let yy = 1; yy <= 2; yy++) put(x, gy + yy, z, '#394152');
      hub.block(x, z);
      sign({ id: 'scripps', text: 'Scripps Pier', sub: 'Boat at the end · E to sail', colour: '#0ea5e9', x, y: gy + 3.1, z, yaw: 0, w: 3.6, h: 0.9 });
    }
  }

  // ---------------------------------------------------------------- the shuttle loop: lamps and stops
  const loop = hub.loop;
  {
    let cx = 0, cz = 0;
    for (const p of loop) { cx += p.x; cz += p.z; }
    cx /= loop.length; cz /= loop.length;
    const out2 = (p, d) => { const dx = p.x - cx, dz = p.z - cz, l = Math.hypot(dx, dz) || 1; return [Math.round(p.x + (dx / l) * d), Math.round(p.z + (dz / l) * d)]; };
    const stopAt = new Map(LAYOUT.stops.map((s) => [loop.findIndex((p) => p.seg === s.at), s.name]));
    for (let i = 0; i < loop.length; i++) {
      const p = loop[i];
      if (stopAt.has(i)) {
        const [sx, sz] = out2(p, 3);
        const gy = ground(sx, sz);
        if (!(gy > -Infinity)) continue;
        const nx = Math.round(loop[(i + 2) % loop.length].x - loop[(i - 2 + loop.length) % loop.length].x), nz = Math.round(loop[(i + 2) % loop.length].z - loop[(i - 2 + loop.length) % loop.length].z);
        const l = Math.hypot(nx, nz) || 1, ux = Math.round(nx / l), uz = Math.round(nz / l);
        for (let k = -1; k <= 1; k++) { put(sx + ux * k, gy + 1, sz + uz * k, '#1e3a8a'); put(sx + ux * k, gy + 4, sz + uz * k, '#f2c14e', 0.1); hub.block(sx + ux * k, sz + uz * k); }
        for (const k of [-1, 1]) for (let yy = 2; yy <= 3; yy++) put(sx + ux * k, gy + yy, sz + uz * k, '#94a3b8');
        const yaw = Math.atan2(cx - p.x, cz - p.z);
        sign({ id: `stop-${i}`, text: 'Campus Loop', sub: `stop · ${stopAt.get(i)}`, colour: '#f2c14e', x: sx + (cx - sx) * 0.02, y: gy + 5.1, z: sz + (cz - sz) * 0.02, yaw, w: 3, h: 0.75 });
        continue;
      }
      if (i % (lowfx ? 18 : 13) !== 6) continue;
      const [lx, lz] = out2(p, 2.4);
      const gy = ground(lx, lz);
      if (!(gy > -Infinity) || hub.isBlocked(lx, lz)) continue;
      for (let yy = 1; yy <= 4; yy++) put(lx, gy + yy, lz, '#394152');
      put(lx, gy + 5, lz, '#fff1c9', 1.6);
      hub.block(lx, lz);
    }
  }

  // ---------------------------------------------------------------- doors
  const ds = doorSigns(world);
  out.push(...ds.cells);
  signs.push(...ds.signs.map((s) => ({ back: true, ...s })));

  const signsApi = buildSigns(signs);
  parent.add(signsApi.mesh);
  const doorMarks = buildDoorMarks(world, parent, signsApi);
  return { signs: signsApi, doorMarks, loop };
}
