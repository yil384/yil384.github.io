// Bakes the studio's cel-3D props into assets/js/props/props.json so the live site draws the SAME geometry as the videos.
//   node tools/export-props.mjs
// K-01 is exported per part with its joint chain (outermost first) and the joint pivots, so the site can rebuild the joint
// hierarchy; everything else is baked to world coordinates. Faces are convex polygons { i: [...], col, glow }.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
const HERE = dirname(new URL(import.meta.url).pathname), ROOT = resolve(HERE, '..');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-accelerated-2d-canvas'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('[page error]', e.message));
await page.goto(pathToFileURL(resolve(ROOT, 'studio/studio.html')).href + '?render&video=_mech');
await page.waitForFunction('window.ready === true && window.videoLoaded === true', null, { timeout: 90000 });
const data = await page.evaluate(() => {
  const r = v => v.map(n => Math.round(n * 1000) / 1000);
  const faces = m => m.faces.map(f => ({ i: f.i, col: f.col, ...(f.glow ? { glow: 1 } : {}) }));
  const bake = p => ({ key: p.key, verts: p.mesh.verts.map(p.at || (q => q)).map(r), faces: faces(p.mesh) });
  const mech = k01({});
  return {
    palette: PAL,
    k01: { pivots: K01_PIVOTS, parts: mech.parts.map(p => ({ name: p.key.split('.').pop(), chain: p.chain, verts: p.mesh.verts.map(r), faces: faces(p.mesh) })), anchors: Object.fromEntries(mech.anchors ? [] : Object.keys(K01.anchorDefs).map(n => [n, r(mech.anchor(n))])) },
    gantry: gantry().map(bake), walls: hangarWalls().map(bake), island: island({ scale: 1 }).map(bake), unit7: unit7({}).map(bake),
    doors: blastDoors(0).map(bake), sealedDoor: sealedDoor({}).map(bake),
    lamp: { verts: workLamp().verts.map(r), faces: faces(workLamp()) },
  };
});
const out = resolve(ROOT, 'assets/js/props/props.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(data));
const n = Object.entries(data).map(([k, v]) => `${k}:${Array.isArray(v) ? v.length : Object.keys(v).length}`).join(' ');
console.log(`wrote ${out} (${(JSON.stringify(data).length / 1024).toFixed(0)} KB)  ${n}`);
await browser.close();
