// Display + gameplay self-check sweep: the things regsmoke / snap / mplay / pflip / the playthroughs don't cover.
// usage: node sweep.mjs [scenarios=layout,overlays,tour,play,cam,portals,save,rm,trap,spawns] [outPrefix=/tmp/yl/sw/sw]
//   layout    ?world=0, every section at 1280x800, 1440x900, 390x844, 844x390 (touch on the phones): sideways scroll,
//             text clipped at the viewport edge or inside its box, fixed UI off screen; one screenshot per viewport+section
//             on the phones (-layout-<w>x<h>-<section>.png).
//   overlays  ?world=0 1280x800 + 390x844: Field Notes, the terminal (~), the ? sheet and the portrait flip card opened on
//             top of each other; each closes with Esc, nothing stays stuck (html.modal-open, overflow), the page scrolls.
//   tour      world, 1280x800: each [data-shot] (rig.settle()); camera above the ground and outside walls, bubbles on
//             screen; screenshot per shot (-tour-<i>_<id>.png).
//   play      world, 1280x800, 1440x900, 844x390 touch: HUD overlap audit (with and without the coach); desktop: M / L
//             open and close with Esc (other keys are reported if they open nothing), V cycles every vehicle back to on
//             foot, C toggles first person, spells 1-4 cast and cool down, Esc back to the page, Reviewer mode (R) on
//             and off, play again, W still walks.
//   cam       world: hub + every region (REGIONS=a,b to pick), the player dropped on CAMN (40) random walkable cells,
//             random yaw, 1.5 s sim: camera under the terrain, inside a blocked cell, or a raycast head -> camera hitting
//             scene geometry (the scholar hidden). CAMV=n prints n cases per region; CAMSHOTS=0 skips the screenshots.
//   portals   every region: spawn on open ground, falling off the island respawns in the region, walking into the
//             region's portal arches reaches the hub.
//   save      travel to a region, reload: discovered regions and the resume hint survive, the page reloads on the hub.
//   rm        prefers-reduced-motion: tour sections render, play walks in real time, Esc leaves play.
//   trap      fly over a building (interior blocked cells) and get off the vehicle: the scholar must not end up inside.
//   spawns    every region: foes, pattern bosses and NPCs on open ground at spawn and after 4 s of play.
// Serve the repo first (python3 -m http.server 8000; BASE=http://localhost:8002/ to point elsewhere).
// The software GPU is slow: run one scenario group at a time. Prints a JSON report per scenario (problems first).
// Console errors / warnings are collected everywhere (minus ERR_CERT_*: the sandbox proxy blocking the visitor map APIs).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, list = 'layout,overlays,tour,play,cam,portals,save,rm,trap,spawns', out = '/tmp/yl/sw/sw'] = process.argv;
const base = process.env.BASE || 'http://localhost:8000/';
const WORLDQ = '?force=1&webgl=1&lowfx=1&dpr=0.5&intro=0';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = {};

async function open(w, h, q, { touch = w < 900 && h < 900 && (w < 700 || h < 500), rm = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1, reducedMotion: rm ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  const logs = [];
  p.on('console', (m) => { const t = m.text(); if ((m.type() === 'error' || m.type() === 'warning') && !/WebGPU|GPU stall|GL Driver|swiftshader|Automatic fallback|ERR_CERT_/i.test(t)) logs.push(`${m.type()}: ${t.slice(0, 260)}`); });
  p.on('pageerror', (e) => logs.push(`PAGEERR: ${e.message.slice(0, 300)}`));
  await p.goto(base + q, { waitUntil: 'load' });
  await p.waitForFunction(() => document.body.classList.contains('world-live') || document.body.classList.contains('no-world') || !document.getElementById('world') || /world=0/.test(location.search), null, { timeout: 150000 }).catch(() => logs.push('TIMEOUT waiting for the world'));
  await p.waitForTimeout(1200);
  return { ctx, p, logs, close: () => ctx.close() };
}
const key = (p, k) => p.keyboard.press(k);
const sleep = (p, ms) => p.waitForTimeout(ms);

// ---------------------------------------------------------------- page layout audit (runs in the page)
function layoutAudit(label) {
  const W = innerWidth, H = innerHeight, res = [];
  const de = document.documentElement;
  if (de.scrollWidth > W + 1) res.push(`${label}: page scrolls sideways (${de.scrollWidth} > ${W})`);
  const vis = (e) => { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const name = (e) => (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') || e.tagName.toLowerCase();
  const path = (e) => { const a = []; for (let x = e; x && x !== document.body && a.length < 3; x = x.parentElement) a.unshift(name(x)); return a.join(' > '); };
  const hiddenAnc = (e) => { for (let a = e; a; a = a.parentElement) { const s = getComputedStyle(a); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) return true; if (a.hidden || a.getAttribute('aria-hidden') === 'true' && a.classList.contains('sr')) return true; } return false; };
  const clippedBy = (e, r) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a); if (/(auto|scroll|hidden|clip)/.test(o.overflowX + o.overflowY)) { const ar = a.getBoundingClientRect(); if (r.right > ar.right + 1 || r.left < ar.left - 1) return a; } } return null; };
  let n = 0;
  for (const e of document.body.querySelectorAll('*')) {
    if (n > 25) break;
    if (e.closest('.sr, .sr-only, [aria-hidden=true], svg, canvas, #game-root, .skip, .walk-layer')) continue;
    const own = [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim().length > 1);
    if (!own) continue;
    const r = e.getBoundingClientRect();
    if (r.bottom < 0 || r.top > H || !r.width) continue;
    if (hiddenAnc(e)) continue;
    const s = getComputedStyle(e);
    // text past the viewport's side edges
    if (r.right > W + 1 || r.left < -1) {
      const clip = clippedBy(e, r);
      if (!clip || clip === document.documentElement) { res.push(`${label}: text past the viewport edge ${path(e)} [${Math.round(r.left)}..${Math.round(r.right)}] "${e.textContent.trim().slice(0, 40)}"`); n++; continue; }
    }
    // text clipped inside its own box (no ellipsis)
    if (/(hidden|clip)/.test(s.overflowX) && s.textOverflow !== 'ellipsis' && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 2 && r.height > 2) { res.push(`${label}: clipped text ${path(e)} (${e.scrollWidth} > ${e.clientWidth}) "${e.textContent.trim().slice(0, 40)}"`); n++; }
  }
  // fixed UI that leaves the viewport
  for (const e of document.body.querySelectorAll('*')) {
    const s = getComputedStyle(e);
    if (s.position !== 'fixed' || !vis(e) || e.closest('#game-root, .skip')) continue;
    if (s.pointerEvents === 'none' && !e.textContent.trim()) continue;
    const r = e.getBoundingClientRect();
    if (r.right > W + 2 || r.left < -2 || r.bottom > H + 2 || r.top < -2) {
      if (r.width >= W - 2 && r.height >= H - 2) continue;   // full-screen layers
      res.push(`${label}: fixed UI off screen ${path(e)} [${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}]`);
    }
  }
  return res;
}

// ---------------------------------------------------------------- scenarios
async function layout() {
  const res = { problems: [], logs: [] };
  for (const [w, h] of [[1280, 800], [1440, 900], [390, 844], [844, 390]]) {
    const s = await open(w, h, '?world=0&intro=0');
    const ids = await s.p.evaluate(() => [...document.querySelectorAll('main section[id], body > section[id], footer')].filter((e) => !e.hidden).map((e) => e.id || e.tagName.toLowerCase()));
    for (const id of ['top', ...ids]) {
      await s.p.evaluate((id) => { const e = id === 'top' ? null : (document.getElementById(id) || document.querySelector(id)); if (e) e.scrollIntoView({ block: 'start', behavior: 'instant' }); else scrollTo({ top: 0, behavior: 'instant' }); }, id);
      await sleep(s.p, 450);
      res.problems.push(...await s.p.evaluate(layoutAudit, `${w}x${h} ${id}`));
      if (w < 900) await s.p.screenshot({ path: `${out}-layout-${w}x${h}-${id}.png` });
    }
    res.logs.push(...s.logs.map((l) => `${w}x${h} ${l}`));
    await s.close();
  }
  res.problems = [...new Set(res.problems)];
  return res;
}

async function overlays() {
  const res = { problems: [], notes: [], logs: [] };
  for (const [w, h] of [[1280, 800], [390, 844]]) {
    const s = await open(w, h, '?world=0&intro=0');
    const { p } = s;
    const st = () => p.evaluate(() => ({
      notes: !!document.querySelector('.notes.is-open'),
      term: !!document.querySelector('.term.is-open'),
      sheet: !!document.querySelector('#keys-sheet:not([hidden])'),
      flip: !!document.querySelector('.pflip'),
      modalOpen: document.documentElement.classList.contains('modal-open'),
      bodyOverflow: getComputedStyle(document.body).overflow + '/' + getComputedStyle(document.documentElement).overflow,
      active: document.activeElement?.tagName + (document.activeElement?.id ? '#' + document.activeElement.id : ''),
    }));
    const base0 = await st();
    res.notes.push(`${w}x${h} base ${JSON.stringify(base0)}`);
    const dbl = async () => {
      await p.evaluate(() => document.getElementById('portrait')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await sleep(p, 300);
      const r = await p.evaluate(() => { const e = document.getElementById('portrait'); const r = e?.getBoundingClientRect(); return r && r.width ? [r.left + r.width / 2, r.top + r.height / 2] : null; });
      if (!r) return false;
      const top = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e?.closest('#portrait') ? 'portrait' : (e ? e.className || e.tagName : 'none'); }, r);
      if (top !== 'portrait') return `covered by ${top}`;
      await p.mouse.dblclick(r[0], r[1]);
      await sleep(p, 1400);
      return true;
    };
    const openNotes = async () => p.evaluate(() => { const b = document.querySelector('#eggs-btn'); b?.click(); return !!b; });
    const openTerm = async () => { await p.evaluate(() => document.activeElement?.blur?.()); await key(p, 'Backquote'); };
    // 1. flip, then try the terminal and notes while it is out (keys must stay with the card), Esc closes
    let r1 = await dbl();
    let a = await st();
    if (r1 !== true) res.problems.push(`${w}x${h}: double-click on the portrait: ${r1}`);
    else if (!a.flip) res.problems.push(`${w}x${h}: flip card did not open`);
    await openTerm(); await sleep(p, 300);
    a = await st();
    if (a.term) res.problems.push(`${w}x${h}: ~ opened the terminal under the flip card`);
    await key(p, 'Escape'); await sleep(p, 1000);
    a = await st();
    if (a.flip) res.problems.push(`${w}x${h}: Esc did not close the flip card`);
    // 2. terminal open, then flip (portrait may be visible above the terminal)
    await openTerm(); await sleep(p, 500);
    a = await st();
    res.notes.push(`${w}x${h} terminal: ${JSON.stringify(a)}`);
    await p.screenshot({ path: `${out}-ov-${w}-term.png` });
    r1 = await dbl();
    a = await st();
    res.notes.push(`${w}x${h} terminal+flip: dbl=${r1} ${JSON.stringify(a)}`);
    if (a.flip) {
      await p.screenshot({ path: `${out}-ov-${w}-term-flip.png` });
      await key(p, 'Escape'); await sleep(p, 900);
      a = await st();
      if (a.flip) res.problems.push(`${w}x${h}: flip over terminal stuck after Esc`);
      if (!a.term) res.notes.push(`${w}x${h}: closing the flip card also closed the terminal`);
    }
    await key(p, 'Escape'); await sleep(p, 400);
    // close the terminal (Esc in its input, or ~ again)
    a = await st();
    if (a.term) { await p.evaluate(() => document.querySelector('.term input')?.focus()); await key(p, 'Escape'); await sleep(p, 400); a = await st(); }
    if (a.term) res.problems.push(`${w}x${h}: terminal does not close with Esc`);
    // 3. notes open, try the flip (the notes modal should cover the portrait), Esc closes notes
    const hadNotes = await openNotes(); await sleep(p, 600);
    a = await st();
    res.notes.push(`${w}x${h} notes(btn=${hadNotes}): ${JSON.stringify(a)}`);
    if (a.notes) {
      await p.screenshot({ path: `${out}-ov-${w}-notes.png` });
      r1 = await dbl();
      a = await st();
      if (a.flip) { res.notes.push(`${w}x${h}: flip opened over Field Notes`); await key(p, 'Escape'); await sleep(p, 900); }
      await key(p, 'Escape'); await sleep(p, 600);
      a = await st();
      if (a.notes) res.problems.push(`${w}x${h}: Field Notes did not close with Esc`);
    }
    // 4. ? sheet
    if (w > 700) {
      await p.evaluate(() => document.activeElement?.blur?.());
      await key(p, 'Shift+Slash'); await sleep(p, 400);
      a = await st();
      res.notes.push(`${w}x${h} sheet: ${a.sheet}`);
      await key(p, 'Escape'); await sleep(p, 300);
      a = await st();
      if (a.sheet) res.problems.push(`${w}x${h}: ? sheet does not close with Esc`);
    }
    a = await st();
    if (a.modalOpen || a.flip || a.term || a.notes || a.bodyOverflow !== base0.bodyOverflow) res.problems.push(`${w}x${h}: stuck state after all overlays closed ${JSON.stringify(a)}`);
    // the page must scroll again
    const y0 = await p.evaluate(() => scrollY);
    await p.mouse.move(w / 2, h / 2); await p.mouse.wheel(0, 600); await sleep(p, 800);
    if (await p.evaluate(() => scrollY) === y0) res.problems.push(`${w}x${h}: the page no longer scrolls after the overlays`);
    res.logs.push(...s.logs.map((l) => `${w}x${h} ${l}`));
    await s.close();
  }
  return res;
}

// camera checks (in page): under the ground, inside a blocked cell, line of sight head -> camera
async function camProbeInit(p) {
  await p.evaluate(async () => {
    const THREE = await import('three/webgpu');
    const g = window.__g;
    const rc = new THREE.Raycaster();
    const tmp = new THREE.Vector3(), dir = new THREE.Vector3();
    const skip = (o) => { for (let x = o; x; x = x.parent) { if (x.visible === false) return true; if (x === g.scene) return false; } return true; };
    window.__camcheck = () => {
      const cam = g.rig.cam, look = g.rig.cur.look, w = g.world;
      const c = cam.position;
      const gy = w.surfaceY(c.x, c.z);
      const res = { under: c.y < gy - 0.45 + 0.5 - 0.1 && gy > -1e9, blocked: w.isBlocked(c.x, c.z) && c.y < gy + 6, hit: null, dist: +c.distanceTo(look).toFixed(2), fp: g.rig.firstPerson };
      if (res.fp) return res;
      // raycast from the head to the camera: anything solid in between hides the scholar
      tmp.set(look.x, look.y, look.z);
      dir.subVectors(c, tmp); const L = dir.length(); dir.normalize();
      rc.set(tmp, dir); rc.near = 0.9; rc.far = Math.max(0, L - 0.15);
      const objs = [];
      g.scene.traverseVisible((o) => { if ((o.isMesh || o.isInstancedMesh) && !o.isSprite && o.material && !o.material.transparent && o.geometry && !o.userData.noCam) objs.push(o); });
      const hits = rc.intersectObjects(objs, false).filter((h) => !skip(h.object));
      // ignore actors (player, buddy, enemies): they're small and move
      const solid = hits.filter((h) => { let x = h.object; for (; x; x = x.parent) if (x.userData?.actor || x.name === 'player' || /scholar|buddy|enemy|npc/i.test(x.name || '')) return false; return true; });
      if (solid.length) { const h = solid[0]; res.hit = { at: +h.distance.toFixed(2), of: L.toFixed(2), name: (h.object.name || h.object.parent?.name || h.object.type), inst: h.instanceId ?? null, p: [h.point.x, h.point.y, h.point.z].map((v) => +v.toFixed(1)), blk: w.isBlocked(h.point.x, h.point.z), gy: +w.surfaceY(h.point.x, h.point.z).toFixed(1), pc: [c.x, c.y, c.z].map((v) => +v.toFixed(1)) }; }
      return res;
    };
  });
}

async function cam() {
  const res = { problems: [], notes: [], worst: [], logs: [] };
  const s = await open(960, 600, WORLDQ);
  const { p } = s;
  await p.evaluate(() => { window.__g.enterPlay({ dive: false }); document.querySelector('.g__coach button')?.click(); });
  await sleep(p, 800);
  await camProbeInit(p);
  const regions = (process.env.REGIONS || 'hub,tsinghua,picasso,samsung,metabit,timi,hotstar,lark,starry,im,oj,triton,stacks,finale').split(',');
  const N = +(process.env.CAMN || 40);
  for (const id of regions) {
    const r = await p.evaluate(async ({ id, N }) => {
      const g = window.__g;
      for (let k = 0; k < 20 && g.where.id !== id; k++) { if (!await g.travelApi.travel(id, null, { instant: true })) await new Promise((r) => setTimeout(r, 500)); }
      g.closeAllModals();
      const def = id === 'hub' ? { origin: [0, 0], size: 150 } : g.regions.regionDef(id);
      if (!def) return { n: 0, under: 0, blocked: 0, hidden: 0, cases: [{ error: 'no region ' + id }] };
      const [ox, oz] = def.origin, half = (def.size || 48) / 2 + 4;
      let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const out = { n: 0, under: 0, blocked: 0, hidden: 0, cases: [] };
      for (let i = 0, tries = 0; i < N && tries < N * 30; tries++) {
        const x = ox + (rnd() * 2 - 1) * half, z = oz + (rnd() * 2 - 1) * half;
        if (!g.world.walkable(x, z) || g.world.isBlocked(x, z)) continue;
        i++;
        g.teleport(x, z);
        g.rig.want.yaw = rnd() * Math.PI * 2; g.rig.cur.yaw = g.rig.want.yaw;
        g.sim(1.5);
        if (g.modalOpen()) g.closeAllModals();
        if (g.where.id !== id) { out.cases.push({ x, z, left: g.where.id }); await g.travelApi.travel(id, null, { instant: true }); continue; }
        const c = window.__camcheck();
        out.n++;
        if (c.under) out.under++;
        if (c.blocked) out.blocked++;
        if (c.hit) out.hidden++;
        if (c.under || c.blocked || (c.hit && c.hit.at < 0.7 * +c.hit.of)) out.cases.push({ x: +x.toFixed(1), z: +z.toFixed(1), yaw: +g.rig.cur.yaw.toFixed(2), ...c });
      }
      return out;
    }, { id, N });
    res.notes.push(`${id}: n=${r.n} under=${r.under} inWall=${r.blocked} hiddenByGeometry=${r.hidden}`);
    console.log(`  cam ${res.notes.at(-1)} ${JSON.stringify(r.cases.slice(0, +(process.env.CAMV || 2)))}`);
    if (r.under || r.blocked) res.problems.push(`${id}: camera under ground ${r.under} / inside a blocked cell ${r.blocked} of ${r.n}`);
    for (const c of r.cases.slice(0, 3)) res.worst.push({ id, ...c });
    // screenshot the first bad case of this region
    const bad = r.cases.find((c) => c.under || c.blocked) || r.cases.find((c) => c.hit);
    if (bad && bad.yaw != null && process.env.CAMSHOTS !== '0') {
      await p.evaluate(({ x, z, yaw }) => { const g = window.__g; g.teleport(x, z); g.rig.want.yaw = g.rig.cur.yaw = yaw; g.sim(1.5); }, bad);
      await sleep(p, 2500);
      await p.screenshot({ path: `${out}-cam-${id}.png`, timeout: 120000 }).catch(() => res.notes.push(`${id}: screenshot timed out`));
    }
  }
  res.logs = s.logs;
  await s.close();
  return res;
}

async function tour() {
  const res = { problems: [], notes: [], logs: [] };
  const s = await open(1280, 800, WORLDQ);
  const { p } = s;
  await camProbeInit(p);
  const ids = await p.evaluate(() => [...document.querySelectorAll('[data-shot]')].map((e, i) => (e.hidden ? null : `${i}:${e.id || e.dataset.shot}`)).filter(Boolean));
  for (const id of ids) {
    await p.evaluate((id) => document.querySelectorAll('[data-shot]')[parseInt(id, 10)].scrollIntoView({ block: 'start', behavior: 'instant' }), id);
    await sleep(p, 600);
    await p.evaluate(() => { const g = window.__g; g.director.retarget?.(); g.rig.settle?.(); });
    await sleep(p, 5000);
    const c = await p.evaluate(() => {
      const g = window.__g, cam = g.rig.cam.position;
      const gy = g.world.surfaceY(cam.x, cam.z);
      const bubbles = [...document.querySelectorAll('.g__bubble, .bubble, .g__say')].filter((e) => e.getBoundingClientRect().width).map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; });
      return { cam: [cam.x, cam.y, cam.z].map((v) => +v.toFixed(1)), ground: +gy.toFixed(1), blocked: g.world.isBlocked(cam.x, cam.z), region: g.where.id, bubbles, W: innerWidth, H: innerHeight };
    });
    if (c.cam[1] < c.ground + 0.3) res.problems.push(`tour ${id}: camera under the ground ${JSON.stringify(c)}`);
    if (c.blocked && c.cam[1] < c.ground + 8) res.problems.push(`tour ${id}: camera inside a blocked cell ${JSON.stringify(c)}`);
    for (const r of c.bubbles) if (r[0] < -2 || r[1] < -2 || r[2] > c.W + 2 || r[3] > c.H + 2) res.problems.push(`tour ${id}: speech bubble off screen ${r}`);
    res.notes.push(`${id}: ${JSON.stringify(c)}`);
    await p.screenshot({ path: `${out}-tour-${id.replace(/\W/g, '_')}.png` });
  }
  res.logs = s.logs;
  await s.close();
  return res;
}

function hudAudit(label) {
  const res = [];
  const W = innerWidth, H = innerHeight;
  const vis = (e) => { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const name = (e) => (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') || e.tagName;
  const root = document.getElementById('game-root') || document.body;
  // top-level HUD blocks: direct visible children of the HUD layers
  const blocks = [];
  for (const layer of root.querySelectorAll('.hud, .g__hud, #hud, .g')) for (const e of layer.children) {
    if (!vis(e) || e.matches('.g__plate, .g__fade, canvas, .fx, .g__pins, .g__plates, .touch__look, .hud-top')) continue;
    const s = getComputedStyle(e);
    if (s.position !== 'absolute' && s.position !== 'fixed') continue;
    const r = e.getBoundingClientRect();
    if (r.width >= W - 4 && r.height >= H - 4) continue;
    blocks.push([e, r]);
    if (r.right > W + 1 || r.left < -1 || r.bottom > H + 1 || r.top < -1) res.push(`${label}: HUD off screen ${name(e)} [${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}]`);
  }
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    const [a, ra] = blocks[i], [c, rc] = blocks[j];
    if (a.contains(c) || c.contains(a)) continue;
    const ix = Math.min(ra.right, rc.right) - Math.max(ra.left, rc.left), iy = Math.min(ra.bottom, rc.bottom) - Math.max(ra.top, rc.top);
    if (ix > 6 && iy > 6) res.push(`${label}: HUD overlap ${name(a)} x ${name(c)} (${Math.round(ix)}x${Math.round(iy)})`);
  }
  return res;
}

async function play() {
  const res = { problems: [], notes: [], logs: [] };
  for (const [w, h] of [[1280, 800], [1440, 900], [844, 390]]) {
    const touch = h < 500;
    const s = await open(w, h, WORLDQ);
    const { p } = s;
    const st = () => p.evaluate(() => { const g = window.__g; return { play: g.mode.play, modal: g.modalOpen(), veh: g.player.vehicle, region: g.where.id, paused: g.paused, plain: document.documentElement.classList.contains('plain') || document.documentElement.classList.contains('is-plain'), modalOpenCls: document.documentElement.classList.contains('modal-open') }; });
    await p.evaluate(() => window.__g.enterPlay({ dive: false }));
    await sleep(p, 1500);
    res.problems.push(...await p.evaluate(hudAudit, `${w}x${h} play+coach`));
    await p.screenshot({ path: `${out}-play-${w}x${h}-coach.png` });
    await p.evaluate(() => document.querySelector('.g__coach button')?.click());
    await sleep(p, 300);
    await p.evaluate(() => window.__g.sim(1));
    res.problems.push(...await p.evaluate(hudAudit, `${w}x${h} play`));
    await p.screenshot({ path: `${out}-play-${w}x${h}.png` });
    if (!touch) {
      for (const [k, what] of [['m', 'map'], ['l', 'quest log'], ['i', 'bag'], ['p', 'panel P'], ['b', 'panel B'], ['Tab', 'Tab'], ['h', 'help']]) {
        await key(p, k); await sleep(p, 600);
        let a = await st();
        if (a.modal) {
          await p.screenshot({ path: `${out}-play-${w}x${h}-${what.replace(/\W/g, '')}.png` });
          res.problems.push(...await p.evaluate((l) => { const r = []; for (const m of document.querySelectorAll('.modal.is-open .modal__panel')) { const b = m.getBoundingClientRect(); if (b.right > innerWidth + 1 || b.bottom > innerHeight + 1 || b.left < -1 || b.top < -1) r.push(`${l}: modal panel off screen [${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}x${Math.round(b.height)}]`); } return r; }, `${w}x${h} ${what}`));
          await key(p, 'Escape'); await sleep(p, 500);
          a = await st();
          if (a.modal) res.problems.push(`${w}x${h}: ${what} did not close on Esc`);
          if (!a.play) res.problems.push(`${w}x${h}: Esc on ${what} also left play`);
          if (!a.play) { await p.evaluate(() => window.__g.enterPlay({ dive: false })); await sleep(p, 500); }
        } else res.notes.push(`${w}x${h}: key ${k} opened nothing`);
      }
      // vehicles: V cycles; must always come back to on foot
      const seq = [];
      for (let i = 0; i < 5; i++) { await key(p, 'v'); await p.evaluate(() => window.__g.sim(1.2)); seq.push((await st()).veh); if (await p.evaluate(() => window.__g.modalOpen())) { await key(p, 'Escape'); } }
      res.notes.push(`${w}x${h} V cycle: ${seq.join(' > ')}`);
      if (!seq.includes(null)) res.problems.push(`${w}x${h}: V never returned to on foot (${seq})`);
      while ((await st()).veh) { await key(p, 'v'); await p.evaluate(() => window.__g.sim(0.8)); if (seq.length++ > 12) break; }
      // first person on / off
      await key(p, 'c'); await p.evaluate(() => window.__g.sim(0.5));
      const fp = await p.evaluate(() => window.__g.rig.firstPerson);
      await key(p, 'c'); await p.evaluate(() => window.__g.sim(0.5));
      if (!fp || await p.evaluate(() => window.__g.rig.firstPerson)) res.problems.push(`${w}x${h}: C did not toggle first person (${fp})`);
      // spells: cast, cooldowns run out
      const mp0 = await p.evaluate(() => window.__g.player.mp);
      for (const k of ['1', '2', '3', '4']) { await key(p, k); await p.evaluate(() => window.__g.sim(0.3)); }
      const mp1 = await p.evaluate(() => window.__g.player.mp);
      await p.evaluate(() => window.__g.sim(20));
      await sleep(p, 1500);
      const cds = await p.evaluate(() => [...document.querySelectorAll('#game-root [style*="--cd"]')].map((e) => e.style.getPropertyValue('--cd')));
      res.notes.push(`${w}x${h} spells mp ${mp0} -> ${mp1}; after 20 s: ${cds.join(' ; ')}`);
      if (!cds.length || cds.some((c) => +c > 0)) res.problems.push(`${w}x${h}: a spell is still cooling down after 20 s`);
      // Esc back to the page, Reviewer mode on and off, play again
      await key(p, 'Escape'); await sleep(p, 900);
      let a = await st();
      if (a.play) res.problems.push(`${w}x${h}: Esc did not return to the page`);
      await p.evaluate(() => document.activeElement?.blur?.());
      await key(p, 'r'); await sleep(p, 900);
      a = await st();
      res.notes.push(`${w}x${h} after R: ${JSON.stringify(a)}`);
      await p.screenshot({ path: `${out}-play-${w}x${h}-reviewer.png` });
      await key(p, 'r'); await sleep(p, 1500);
      a = await st();
      if (a.paused) res.problems.push(`${w}x${h}: world still paused after leaving Reviewer mode`);
      await p.evaluate(() => window.__g.enterPlay({ dive: false }));
      await sleep(p, 600);
      a = await st();
      if (!a.play) res.problems.push(`${w}x${h}: could not play again after Reviewer mode`);
      // the walk keys still move the scholar after all of that
      const x0 = await p.evaluate(() => [window.__g.player.x, window.__g.player.z]);
      await p.keyboard.down('w'); await p.evaluate(() => window.__g.sim(1)); await p.keyboard.up('w');
      const x1 = await p.evaluate(() => [window.__g.player.x, window.__g.player.z]);
      if (Math.hypot(x1[0] - x0[0], x1[1] - x0[1]) < 1) res.problems.push(`${w}x${h}: W does not move the scholar after Reviewer round trip`);
    }
    res.logs.push(...s.logs.map((l) => `${w}x${h} ${l}`));
    await s.close();
  }
  return res;
}

async function portals() {
  const res = { problems: [], notes: [], logs: [] };
  const s = await open(1000, 640, WORLDQ.replace('dpr=0.5', 'dpr=0.5&norender=1&perf=1'));
  const { p } = s;
  await p.evaluate(() => { window.__g.enterPlay({ dive: false }); document.querySelector('.g__coach button')?.click(); });
  const ids = (process.env.REGIONS || 'tsinghua,picasso,samsung,metabit,timi,hotstar,lark,starry,im,oj,triton,stacks,finale').split(',');
  for (const id of ids) {
    const r = await p.evaluate(async (id) => {
      const g = window.__g, out = { id };
      g.closeAllModals();
      await g.travelApi.travel(id, null, { instant: true });
      g.sim(0.5); g.closeAllModals();
      out.spawn = { x: +g.player.x.toFixed(1), z: +g.player.z.toFixed(1), h: g.world.height(g.player.x, g.player.z), blocked: g.world.isBlocked(g.player.x, g.player.z) };
      // the region's home portals: plates named "Back to UC San Diego" are pinned over them; find their meshes instead
      const ctx = g.regions.builtRegion(id);
      const arches = [];
      ctx.group.traverse((o) => { if (o.isMesh && o.material?.transparent && o.material.opacity > 0.55 && o.material.opacity < 0.95 && o.parent === ctx.group && (o.count ?? 0) >= 30 && (o.count ?? 0) <= 40) arches.push(o); });
      out.arches = arches.length;
      // fall off the island: respawn
      g.teleport(ctx.ox + 999, ctx.oz + 999);
      g.player.y = -40;
      for (let i = 0; i < 120 && g.player.y < -10; i++) g.sim(0.05);
      await new Promise((r) => setTimeout(r, 700));
      g.sim(0.2);
      out.afterFall = { region: g.where.id, y: +g.player.y.toFixed(1), h: g.world.height(g.player.x, g.player.z) };
      // walk into each arch until one goes home
      out.home = false;
      for (const a of arches) {
        const ax = a.position.x, az = a.position.z;
        g.teleport(ax + Math.cos(a.rotation.y) * 0 , az + 3.5);
        g.sim(0.4);
        g.player.x = ax; g.player.z = az; g.player.y = g.world.surfaceY(ax, az);
        g.sim(0.3);
        await new Promise((r) => setTimeout(r, 900));
        g.sim(0.2);
        if (g.where.id === 'hub') { out.home = { at: [+(ax - ctx.ox).toFixed(1), +(az - ctx.oz).toFixed(1)] }; break; }
        if (g.where.id !== id) { out.other = (out.other || []).concat(g.where.id); await g.travelApi.travel(id, null, { instant: true }); }
      }
      if (g.where.id !== 'hub') await g.travelApi.travel('hub', null, { instant: true });
      return out;
    }, id);
    res.notes.push(JSON.stringify(r));
    if (r.spawn.h === -Infinity || r.spawn.blocked) res.problems.push(`${id}: spawn not on open ground ${JSON.stringify(r.spawn)}`);
    if (r.afterFall.region !== id || r.afterFall.h === -Infinity) res.problems.push(`${id}: falling off did not respawn in the region ${JSON.stringify(r.afterFall)}`);
    if (!r.home) res.problems.push(`${id}: no portal took the player home (arches found: ${r.arches})`);
  }
  res.logs = s.logs;
  await s.close();
  return res;
}

async function save() {
  const res = { problems: [], notes: [], logs: [] };
  const s = await open(1000, 640, WORLDQ);
  const { p } = s;
  await p.evaluate(async () => { const g = window.__g; g.enterPlay({ dive: false }); document.querySelector('.g__coach button')?.click(); await g.travelApi.travel('oj', null, { instant: true }); g.sim(1); });
  const before = await p.evaluate(() => ({ region: window.__g.where.id, resume: window.__g.S.world.resume, disc: Object.keys(window.__g.S.world.discovered) }));
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => document.body.classList.contains('world-live'), null, { timeout: 150000 }).catch(() => res.problems.push('world never went live after reload'));
  await sleep(p, 1500);
  const after = await p.evaluate(() => ({ region: window.__g.where.id, play: window.__g.mode.play, resume: window.__g.S.world.resume, disc: Object.keys(window.__g.S.world.discovered) }));
  res.notes.push(JSON.stringify({ before, after }));
  if (!after.disc.includes('oj')) res.problems.push('discovered regions lost on reload');
  if (after.region !== 'hub') res.problems.push(`page reloaded into region ${after.region} instead of the hub`);
  await p.evaluate(() => window.__g.enterPlay({ dive: false }));
  await sleep(p, 2500);
  const toast = await p.evaluate(() => [...document.querySelectorAll('.g__toast, .toast, .hud-toast')].map((e) => e.textContent.trim()).join(' | '));
  res.notes.push(`resume toast: ${toast}`);
  await p.screenshot({ path: `${out}-save-resume.png` });
  // map: travel back via the map
  await p.evaluate(() => window.__g.openMap());
  await sleep(p, 800);
  await p.screenshot({ path: `${out}-save-map.png` });
  res.logs = s.logs;
  await s.close();
  return res;
}

async function rm() {
  const res = { problems: [], notes: [], logs: [] };
  const s = await open(1280, 800, WORLDQ, { rm: true });
  const { p } = s;
  for (const id of ['about', 'experience']) {
    await p.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'start', behavior: 'instant' }), id);
    await sleep(p, 3500);
    await p.screenshot({ path: `${out}-rm-${id}.png` });
  }
  await p.evaluate(() => window.__g.enterPlay({ dive: false }));
  await sleep(p, 1200);
  await p.evaluate(() => document.querySelector('.g__coach button')?.click());
  const x0 = await p.evaluate(() => [window.__g.player.x, window.__g.player.z]);
  await p.keyboard.down('w'); await sleep(p, 2500); await p.keyboard.up('w');
  const x1 = await p.evaluate(() => [window.__g.player.x, window.__g.player.z]);
  res.notes.push(`rm walk ${x0} -> ${x1}`);
  if (Math.hypot(x1[0] - x0[0], x1[1] - x0[1]) < 0.5) res.problems.push('reduced motion: holding W did not move the scholar in real time');
  await p.screenshot({ path: `${out}-rm-play.png` });
  await key(p, 'Escape'); await sleep(p, 800);
  if (await p.evaluate(() => window.__g.mode.play)) res.problems.push('reduced motion: Esc did not leave play');
  res.logs = s.logs;
  await s.close();
  return res;
}

// leave a vehicle over a building (blocked cells): the scholar must not end up inside it, unable to walk
async function trap() {
  const res = { problems: [], notes: [], logs: [] };
  const s = await open(1000, 640, WORLDQ.replace('dpr=0.5', 'dpr=0.5&norender=1&perf=1'));
  const { p } = s;
  await p.evaluate(() => { window.__g.enterPlay({ dive: false }); document.querySelector('.g__coach button')?.click(); });
  for (const id of (process.env.REGIONS || 'hub,tsinghua,picasso,lark,stacks').split(',')) {
    const r = await p.evaluate(async (id) => {
      const g = window.__g, w = g.world, out = { id, tested: 0, stuck: [], inside: 0 };
      if (g.where.id !== id) await g.travelApi.travel(id, null, { instant: true });
      g.closeAllModals();
      const def = id === 'hub' ? { origin: [0, 0], size: 150 } : g.regions.regionDef(id);
      const [ox, oz] = def.origin, half = (def.size || 48) / 2;
      // blocked cells whose 4 neighbours are blocked too (the inside of a building footprint)
      const cells = [];
      for (let x = Math.round(ox - half); x <= ox + half; x++) for (let z = Math.round(oz - half); z <= oz + half; z++) {
        if (w.isBlocked(x, z) && w.walkable(x, z) && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, c]) => w.isBlocked(x + a, z + c))) cells.push([x, z]);
      }
      out.interior = cells.length;
      for (let i = 0; i < cells.length && out.tested < 6; i += Math.max(1, Math.floor(cells.length / 6))) {
        const [x, z] = cells[i];
        for (const to of [null, 'car', 'mech']) {
          g.vehicles.set('sword');
          g.player.x = x; g.player.z = z; g.player.y = w.surfaceY(x, z) + 6; g.player.vx = g.player.vz = g.player.vy = 0;
          g.sim(0.2);
          g.vehicles.set(to);
          g.sim(2);
          out.tested++;
          const inB = w.isBlocked(g.player.x, g.player.z) && g.player.y < w.surfaceY(g.player.x, g.player.z) + 2;
          if (inB) out.inside++;
          // try to walk out (on foot) in 4 directions
          if (inB) {
            g.vehicles.set(null);
            const x0 = g.player.x, z0 = g.player.z;
            let moved = 0;
            for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
              window.dispatchEvent(new KeyboardEvent('keydown', { code: k, key: k.slice(3).toLowerCase() }));
              g.sim(1.2);
              window.dispatchEvent(new KeyboardEvent('keyup', { code: k, key: k.slice(3).toLowerCase() }));
              moved = Math.max(moved, Math.hypot(g.player.x - x0, g.player.z - z0));
            }
            if (moved < 1.5) out.stuck.push({ x, z, to });
          }
        }
      }
      g.vehicles.set(null);
      return out;
    }, id);
    res.notes.push(JSON.stringify(r));
    if (r.inside) res.problems.push(`${id}: ${r.inside}/${r.tested} vehicle exits over a building left the scholar inside it${r.stuck.length ? `, ${r.stuck.length} unable to walk out` : ''}`);
  }
  res.logs = s.logs;
  await s.close();
  return res;
}

// enemies / bosses / NPCs standing inside blocked cells or over the void, at spawn and after 4 s of play
async function spawns() {
  const res = { problems: [], notes: [], logs: [] };
  const s = await open(1000, 640, WORLDQ.replace('dpr=0.5', 'dpr=0.5&norender=1&perf=1'));
  const { p } = s;
  await p.evaluate(() => { window.__g.enterPlay({ dive: false }); document.querySelector('.g__coach button')?.click(); });
  for (const id of (process.env.REGIONS || 'hub,tsinghua,picasso,samsung,metabit,timi,hotstar,lark,starry,im,oj,triton,stacks,finale').split(',')) {
    const r = await p.evaluate(async (id) => {
      const g = window.__g, w = g.world;
      for (let k = 0; k < 20 && g.where.id !== id; k++) { if (!await g.travelApi.travel(id, null, { instant: true })) await new Promise((r) => setTimeout(r, 500)); }
      g.closeAllModals();
      const bad = (o) => w.height(o.x, o.z) === -Infinity ? 'void' : w.isBlocked(o.x, o.z) ? 'blocked' : null;
      const scan = (tag) => {
        const out = [];
        for (const f of g.foes) if (f.region === id && f.alive) { const b = bad(f); if (b) out.push(`${tag} foe ${f.kindId} @${f.x.toFixed(1)},${f.z.toFixed(1)} ${b}`); }
        for (const f of g.patternBosses) if (f.region === id && f.alive !== false) { const b = bad(f); if (b) out.push(`${tag} boss ${f.name} @${f.x.toFixed(1)},${f.z.toFixed(1)} ${b}`); }
        for (const n of g.npcs) if ((n.region || 'hub') === id) { const b = bad(n); if (b === 'void') out.push(`${tag} npc ${n.name || n.id} @${n.x.toFixed(1)},${n.z.toFixed(1)} ${b}`); }
        return out;
      };
      const a = scan('spawn');
      // stand still far from everyone (grace) and let the world run: wanderers must stay on open ground
      g.player.invulnUntil = 1e15;
      g.sim(4);
      g.closeAllModals();
      const b2 = scan('t+4s');
      return { id, foes: g.foes.filter((f) => f.region === id).length, problems: [...a, ...b2] };
    }, id);
    res.notes.push(`${id}: ${r.foes} foes`);
    res.problems.push(...r.problems.slice(0, 8).map((x) => `${id}: ${x}`));
  }
  res.logs = s.logs;
  await s.close();
  return res;
}

const SC = { layout, overlays, tour, play, cam, portals, save, rm, trap, spawns };
for (const name of list.split(',')) {
  if (!SC[name]) { console.log(`unknown scenario ${name}`); continue; }
  const t0 = Date.now();
  try { report[name] = await SC[name](); } catch (e) { report[name] = { problems: [`CRASH ${e.message.split('\n')[0]}`] }; }
  report[name].secs = Math.round((Date.now() - t0) / 1000);
  console.log(`=== ${name}`, JSON.stringify(report[name], null, 1));
}
await b.close();
