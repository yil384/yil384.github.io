// Ground audit: does what is DRAWN under an actor's feet agree with the collision heightmap?
// usage: node ground.mjs [ids=hub,<every region>]
//   BASE=http://localhost:8001/ (default 8000). Output: summary on stdout, details in /tmp/yl/ground/<id>.json.
//
// In the browser it collects every horizontal triangle of the static scenery (the hub island and the live
// region's group; actors, fx, signs, the sea and other transparent things are skipped), buckets them per
// 1x1 cell, and casts a vertical ray at the centre and four inner points of every cell of every height grid.
// Each sample compares the drawn faces with world.surfaceY (where feet stand) and world.isBlocked:
//   SINK      an up-facing face 0.35..3 above the feet with no down-facing face between: the feet are inside
//             a solid that rises from the ground (a prop or terrain step drawn on a walkable, unblocked cell)
//   FLOAT     nothing drawn at the feet: the highest face at or below them is > 0.35 lower (or missing)
//   LOW       an overhang (down-facing face) less than 1.6 above the feet: the scholar's chest in the leaves
// It also checks the places code puts actors: every tour stand spot (through tour.stand), a tour walk
// between consecutive stand spots (player.y must follow the ground every step), NPCs, enemies, bosses,
// the companion and loot tokens (their y against surfaceY and the column under them).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8000/';
const OUT = '/tmp/yl/ground';
mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2);
const ALL = ['hub', 'tsinghua', 'picasso', 'metabit', 'timi', 'hotstar', 'lark', 'samsung', 'starry', 'im', 'oj', 'triton', 'stacks', 'finale'];
const ids = (args.find((a) => !a.startsWith('--')) || ALL.join(',')).split(',');

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const logs = [];
p.on('pageerror', (e) => logs.push('PAGEERR ' + e.message.slice(0, 200)));
await p.goto(`${BASE}?force=1&dpr=0.5&intro=0&lowfx=1&perf=1&norender=1`);
await p.waitForFunction(() => document.body.classList.contains('world-live') && window.__g, null, { timeout: 180000 });
await p.waitForTimeout(1500);

// ---------------------------------------------------------------- page-side helpers
await p.evaluate(async () => {
  const THREE = await import('three/webgpu');
  const g = window.__g;
  const SKIP = new Set(['signs', 'door-rings', 'door-beacons', 'ambient-crowd', 'shuttle', 'tokens', 'sea']);
  const isActor = (o) => !!o.userData?.setFrame;
  window.__ground = {
    /** Bucket the horizontal triangles of the visible static scenery under `roots`. */
    collect(rootNames) {
      const buckets = new Map();
      const meshes = [], objs = [], snaps = [];
      const key = (x, z) => x * 100003 + z;
      const a = new THREE.Vector3(), bb = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
      const m = new THREE.Matrix4(), im = new THREE.Matrix4(), nm = new THREE.Matrix3(), v1 = new THREE.Vector3();
      const roots = g.scene.children.filter((o) => rootNames.includes(o.name));
      for (const r of roots) r.updateMatrixWorld(true);
      const visit = (o) => {
        if (!o.visible || isActor(o) || SKIP.has(o.name)) return;
        if (o.isMesh && !o.isSprite) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          if (!mats.some((mm) => mm.transparent || mm.opacity < 1)) addMesh(o);
        }
        for (const ch of o.children) visit(ch);
      };
      const addMesh = (o) => {
        const geo = o.geometry, pos = geo.attributes.position, nor = geo.attributes.normal, ix = geo.index;
        if (!pos) return;
        const id = meshes.length;
        objs.push(o);
        snaps.push({ v: o.instanceMatrix?.version ?? 0, m: o.matrixWorld.elements.slice() });
        const bs = new THREE.Box3().setFromObject(o);
        let lab = o.name, q = o;
        while (!lab && q.parent) { q = q.parent; lab = q.name || (q.userData.pickId ? `pick:${q.userData.pickId}` : ''); }
        meshes.push({ name: `${lab || o.type}#${meshes.length}`, info: `${o.isInstancedMesh ? `inst x${o.count}` : 'merged'}${o.userData.setHi ? ' voxBuild' : ''}${o.geometry.type === 'BoxGeometry' && !o.userData.setHi ? ' sprites' : ''}`, inst: !!o.isInstancedMesh, box: [bs.min.x, bs.min.y, bs.min.z, bs.max.x, bs.max.y, bs.max.z].map((v) => +v.toFixed(1)) });
        const count = o.isInstancedMesh ? o.count : 1;
        const nt = (ix ? ix.count : pos.count) / 3;
        for (let k = 0; k < count; k++) {
          if (o.isInstancedMesh) { o.getMatrixAt(k, im); m.multiplyMatrices(o.matrixWorld, im); } else m.copy(o.matrixWorld);
          nm.getNormalMatrix(m);
          for (let t = 0; t < nt; t++) {
            const i0 = ix ? ix.getX(t * 3) : t * 3, i1 = ix ? ix.getX(t * 3 + 1) : t * 3 + 1, i2 = ix ? ix.getX(t * 3 + 2) : t * 3 + 2;
            a.fromBufferAttribute(pos, i0).applyMatrix4(m); bb.fromBufferAttribute(pos, i1).applyMatrix4(m); c.fromBufferAttribute(pos, i2).applyMatrix4(m);
            // facing from the vertex normals when there are any (winding is not reliable across writers)
            if (nor) n.fromBufferAttribute(nor, i0).add(v1.fromBufferAttribute(nor, i1)).add(v1.fromBufferAttribute(nor, i2)).applyMatrix3(nm);
            else n.subVectors(bb, a).cross(v1.subVectors(c, a));
            const len = n.length();
            if (len < 1e-9 || Math.abs(n.y / len) < 0.5) continue;      // walls are parallel to a vertical ray
            const tri = [a.x, a.y, a.z, bb.x, bb.y, bb.z, c.x, c.y, c.z, n.y > 0 ? 1 : -1, id];
            const x0 = Math.round(Math.min(a.x, bb.x, c.x)), x1 = Math.round(Math.max(a.x, bb.x, c.x));
            const z0 = Math.round(Math.min(a.z, bb.z, c.z)), z1 = Math.round(Math.max(a.z, bb.z, c.z));
            for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
              const kk = key(x, z);
              let l = buckets.get(kk);
              if (!l) buckets.set(kk, (l = []));
              l.push(tri);
            }
          }
        }
      };
      for (const r of roots) visit(r);
      this.buckets = buckets; this.meshes = meshes; this.key = key; this.objs = objs; this.snaps = snaps;
      return { meshes: meshes.length, buckets: buckets.size };
    },
    /** After some game time: meshes that moved (packets, lifts, streams) are left out of the audit. */
    markDynamic() {
      let n = 0;
      for (const r of g.scene.children) r.updateMatrixWorld(true);
      this.objs.forEach((o, i) => {
        const s0 = this.snaps[i];
        if ((o.instanceMatrix?.version ?? 0) !== s0.v || o.matrixWorld.elements.some((e, k) => Math.abs(e - s0.m[k]) > 1e-6)) { this.meshes[i].dynamic = true; n++; }
      });
      return n;
    },
    /** Every face crossing the vertical line at (x, z): [{ y, up, mesh }] sorted by y (moving meshes left out). */
    column(x, z) {
      const l = this.buckets.get(this.key(Math.round(x), Math.round(z))) || [];
      const hits = [];
      for (const t of l) {
        const [ax, ay, az, bx, by, bz, cx, cy, cz, up, id] = t;
        if (this.meshes[id].dynamic) continue;
        const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(d) < 1e-12) continue;
        const w0 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
        const w1 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        hits.push({ y: w0 * ay + w1 * by + w2 * cy, up, mesh: id });
      }
      return hits.sort((p1, p2) => p1.y - p2.y);
    },
    /** Classify one point for feet at `feet` (default surfaceY). */
    judge(x, z, feet = g.world.surfaceY(x, z)) {
      const hits = this.column(Math.round(x) + (x - Math.round(x)) * 0.998, Math.round(z) + (z - Math.round(z)) * 0.998);
      const out = [];
      // support: the highest up-face at (or just above) the feet
      const below = hits.filter((h) => h.up > 0 && h.y <= feet + 0.35);
      const sup = below.length ? below[below.length - 1].y : -Infinity;
      if (feet - sup > 0.35) out.push({ kind: 'FLOAT', d: +(feet - sup).toFixed(2), mesh: below.length ? below[below.length - 1].mesh : -1 });
      // sink: an up-face above the feet whose solid starts at or below them
      let sink = null, low = null;
      for (const h of hits) {
        if (h.y <= feet + 0.35) continue;
        if (h.up < 0) { if (!low && h.y - feet < 1.6) low = h; break; }
        if (h.y - feet <= 3) sink = h;
        break;
      }
      if (sink) out.push({ kind: 'SINK', d: +(sink.y - feet).toFixed(2), mesh: sink.mesh });
      if (low) out.push({ kind: 'LOW', d: +(low.y - feet).toFixed(2), mesh: low.mesh });
      return out;
    },
    /** Audit a grid's cells: centre plus four inner points per cell. */
    grid(x0, z0, x1, z1) {
      const w = g.world, res = [];
      for (let z = Math.ceil(z0); z < z1; z++) for (let x = Math.ceil(x0); x < x1; x++) {
        if (w.height(x, z) === -Infinity || w.isBlocked(x, z)) continue;
        if (w.platforms.some((q) => !q.off && x >= q.x0 - 0.5 && x < q.x1 + 0.5 && z >= q.z0 - 0.5 && z < q.z1 + 0.5)) continue;   // moving platforms
        const feet = w.surfaceY(x, z);
        // the centre decides; something only under the inner corners is an EDGE (a prop overlapping the cell a little)
        const pick = (l) => l.reduce((a, r) => (!a || (r.kind !== 'LOW' && (a.kind === 'LOW' || r.d > a.d)) ? r : a), null);
        let worst = pick(this.judge(x, z, feet));
        if (!worst || worst.kind === 'LOW') {
          for (const [ox, oz] of [[0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]]) {
            if (w.isBlocked(x + ox, z + oz) || w.height(x + ox, z + oz) === -Infinity) continue;
            const r = pick(this.judge(x + ox, z + oz, w.surfaceY(x + ox, z + oz)).filter((q) => q.kind !== 'LOW'));
            if (r && (!worst || worst.kind === 'LOW' || r.d > worst.d)) worst = { ...r, kind: 'EDGE', ox, oz };
          }
        }
        if (worst) res.push({ x, z, feet, ...worst, name: this.meshes[worst.mesh]?.name, info: this.meshes[worst.mesh]?.info, box: this.meshes[worst.mesh]?.box });
      }
      return res;
    },
    /** Actors: their y against surfaceY and their column. */
    actors() {
      const w = g.world, res = [];
      const check = (who, o, hover = 0) => {
        if (!o || !Number.isFinite(o.x) || !Number.isFinite(o.y)) return;
        const s = w.surfaceY(o.x, o.z);
        if (s === -Infinity) { res.push({ who, x: o.x, z: o.z, y: o.y, issue: 'over the void' }); return; }
        if (w.isBlocked(o.x, o.z)) res.push({ who, x: +o.x.toFixed(2), z: +o.z.toFixed(2), issue: 'stands on a blocked cell' });
        const dy = o.y - hover - s;
        if (Math.abs(dy) > 0.3) res.push({ who, x: +o.x.toFixed(2), z: +o.z.toFixed(2), y: +o.y.toFixed(2), surf: s, issue: `y off ground by ${dy.toFixed(2)}` });
        const j = this.judge(o.x, o.z, s).filter((r) => r.kind !== 'LOW');
        if (j.length) res.push({ who, x: +o.x.toFixed(2), z: +o.z.toFixed(2), issue: j.map((r) => `${r.kind} ${r.d} (${this.meshes[r.mesh]?.name})`).join(', ') });
      };
      const here = (o) => g.world.regionAt?.(o.x, o.z) === g.where.id;
      for (const n of g.npcs || []) if (here(n) && !n.flying) check(`npc ${n.id || n.name || ''}`, n);
      for (const e of new Set([...(g.enemies || []), ...(g.foes || [])])) if (!e.dead && here(e) && !e.flying && !e.kind?.flying) check(`enemy ${typeof e.kind === 'string' ? e.kind : e.kind?.id || e.type || ''}`, e);
      for (const bo of [...Object.values(g.bosses || {}), ...(g.patternBosses || [])]) if (!bo.dead && here(bo) && !bo.flying) check(`boss ${bo.id || bo.kind || ''}`, bo);
      return res;
    },
  };
});

// EVAL='js': print the result of a page expression after the audit of the given ids (window.__ground is
// collected for the last one); with HUBEVAL=1 right after the hub is collected, skipping the audit
if (process.env.EVAL && process.env.HUBEVAL) {
  await p.evaluate(() => window.__ground.collect(['hub']));
  console.log(JSON.stringify(await p.evaluate(process.env.EVAL), null, 1));
  await b.close();
  process.exit(0);
}
const summary = [];
const pause = (ms) => p.waitForTimeout(ms);
for (const id of ids) {
  if (id === 'hub') {
    // tour first (the page starts in tour mode on the hub)
    await p.evaluate(() => window.__ground.collect(['hub']));
    const cells = await p.evaluate(() => window.__ground.grid(-64, -64, 64, 64));
    const extra = await p.evaluate(() => {
      const g = window.__g, G = window.__ground, res = [];
      const shots = g.stage.shots, keys = Object.keys(shots);
      // every stand spot, placed the way the director places it
      for (const k of keys) {
        const s = shots[k];
        if (!s.stand) continue;
        g.tour.stand(s.stand[0], s.stand[1], s.face, { instant: true });
        const pl = g.player, surf = g.world.surfaceY(pl.x, pl.z);
        if (Math.abs(pl.y - surf) > 0.05) res.push({ who: `stand ${k}`, x: pl.x, z: pl.z, issue: `y ${pl.y} vs surface ${surf}` });
        for (const r of G.judge(pl.x, pl.z, pl.y)) if (r.kind !== 'LOW') res.push({ who: `stand ${k}`, x: +pl.x.toFixed(2), z: +pl.z.toFixed(2), issue: `${r.kind} ${r.d} (${G.meshes[r.mesh]?.name})` });
      }
      // the tour walker between consecutive stand spots: feet must follow the ground on every step
      let worstWalk = 0, walkAt = null, steps = 0;
      for (let i = 0; i + 1 < keys.length; i++) {
        const a = shots[keys[i]], bS = shots[keys[i + 1]];
        if (!a.stand || !bS.stand) continue;
        g.tour.stand(a.stand[0], a.stand[1], null, { instant: true });
        g.tour.stand(bS.stand[0], bS.stand[1], null);
        for (let f = 0; f < 600 && g.tour.busy; f++) {
          g.tour.update(1 / 60); steps++;
          if (g.tour.warping) continue;
          const d = Math.abs(g.player.y - g.world.surfaceY(g.player.x, g.player.z));
          if (d > worstWalk) { worstWalk = d; walkAt = { from: keys[i], to: keys[i + 1], x: +g.player.x.toFixed(2), z: +g.player.z.toFixed(2), y: g.player.y, surf: g.world.surfaceY(g.player.x, g.player.z) }; }
        }
      }
      if (worstWalk > 0.05) res.push({ who: 'tour walker', ...walkAt, issue: `feet ${worstWalk.toFixed(2)} off the ground (${steps} steps)` });
      // the companion, loot tokens
      const bd = g.buddy;
      if (bd && Number.isFinite(bd.y)) { const s = g.world.surfaceY(bd.x, bd.z); if (bd.y < s - 0.05) res.push({ who: 'buddy', x: bd.x, z: bd.z, issue: `below ground by ${(s - bd.y).toFixed(2)}` }); }
      res.push(...G.actors());
      return res;
    });
    // hub doors: the trigger point must not be walled in (some unblocked cell within its radius)
    extra.push(...await p.evaluate(async () => {
      const { doorList } = await import(new URL('assets/js/game3d/travel.js', document.baseURI).href);
      const w = window.__g.world, res = [];
      for (const d of doorList()) {
        let free = 0;
        for (let z = Math.floor(d.z - d.r); z <= Math.ceil(d.z + d.r); z++) for (let x = Math.floor(d.x - d.r); x <= Math.ceil(d.x + d.r); x++) {
          if (Math.hypot(x - d.x, z - d.z) <= d.r && w.height(x, z) > -Infinity && !w.isBlocked(x, z)) free++;
        }
        if (!free || (d.walk && w.isBlocked(d.x, d.z))) res.push({ who: `door ${d.to}`, x: d.x, z: d.z, issue: `walled in (${free} free cells, centre blocked: ${w.isBlocked(d.x, d.z)})` });
      }
      return res;
    }));
    summary.push(report(id, cells, extra));
    continue;
  }
  const ok = await p.evaluate(async (rid) => {
    const g = window.__g;
    if (!g.mode.play) g.enterPlay({ dive: false });
    await g.travel(rid, null, { instant: true });
    for (let i = 0; i < 40 && g.where.id !== rid; i++) await new Promise((r) => setTimeout(r, 100));
    return g.where.id === rid;
  }, id);
  await pause(800);
  if (!ok) { console.log(`${id}: could not travel`); continue; }
  await p.evaluate(() => window.__g.sim(2));
  await p.evaluate((rid) => window.__ground.collect([`region:${rid}`]), id);
  await p.evaluate(() => window.__g.sim(1));
  const dyn = await p.evaluate(() => window.__ground.markDynamic());
  const { cells, extra } = await p.evaluate((rid) => {
    const g = window.__g, G = window.__ground;
    const cellsR = [];
    for (const gr of g.world.grids) if (gr.region === rid && !gr.id.endsWith(':props')) cellsR.push(...G.grid(gr.x0, gr.z0, gr.x1, gr.z1));
    const res = G.actors();
    const pl = g.player, s = g.world.surfaceY(pl.x, pl.z);
    if (Math.abs(pl.y - s) > 0.05 && pl.grounded) res.push({ who: 'player after travel', x: pl.x, z: pl.z, issue: `y ${pl.y} vs ${s}` });
    for (const r of G.judge(pl.x, pl.z, s)) if (r.kind !== 'LOW') res.push({ who: 'player after travel', x: +pl.x.toFixed(2), z: +pl.z.toFixed(2), issue: `${r.kind} ${r.d} (${G.meshes[r.mesh]?.name})` });
    return { cells: cellsR, extra: res };
  }, id);
  const settled = await p.evaluate(async (rid) => (await import(new URL('assets/js/game3d/regions.js', document.baseURI).href)).builtRegion(rid)?.settled, id);
  summary.push(report(`${id} (props settled: ${settled ?? '?'} cells, ${dyn} moving meshes skipped)`, cells, extra, id));
}

function report(label, cells, extra, id = label) {
  const by = (k) => cells.filter((c) => c.kind === k);
  const sink = by('SINK'), flt = by('FLOAT'), low = by('LOW'), edge = by('EDGE');
  const big = (l, t) => l.filter((c) => c.d >= t);
  writeFileSync(`${OUT}/${id}.json`, JSON.stringify({ sink, float: flt, edge, low, extra }, null, 1));
  const top = (l) => l.slice().sort((a, c) => c.d - a.d).slice(0, 6).map((c) => `(${c.x},${c.z}) ${c.d} ${c.name}`).join('; ');
  let s = `${label}: SINK ${sink.length} (>=0.9: ${big(sink, 0.9).length})  FLOAT ${flt.length} (>=0.9: ${big(flt, 0.9).length})  EDGE ${edge.length}  LOW ${low.length}  actor issues ${extra.length}`;
  if (sink.length) s += `\n   sink: ${top(sink)}`;
  if (flt.length) s += `\n   float: ${top(flt)}`;
  for (const e of extra.slice(0, 8)) s += `\n   actor: ${JSON.stringify(e)}`;
  console.log(s);
  return s;
}

if (process.env.EVAL) console.log(JSON.stringify(await p.evaluate(process.env.EVAL), null, 1));
if (logs.length) console.log(logs.slice(0, 10).join('\n'));
await b.close();
