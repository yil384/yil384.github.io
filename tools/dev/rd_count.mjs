import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto('http://localhost:8000/?force=1&dpr=1&intro=0&lowfx=1&webgl=1&region=hub', { waitUntil: 'load' });
await p.waitForFunction(() => document.body.classList.contains('world-live'), null, { timeout: 150000 });
for (const r of process.argv.slice(2)) {
  await p.evaluate((r) => window.__g.ensureRegion(r), r);
  const res = await p.evaluate((r) => { const g = window.__g.scene.getObjectByName(`region:${r}`); let n = 0, tri = 0; const big = []; g.traverse((o) => { if (o.isMesh) { n++; const c = o.isInstancedMesh ? o.count : 1; const t = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * c; tri += t; if (t > 5000) big.push([o.name || o.type, c, Math.round(t)]); } }); return { meshes: n, tri: Math.round(tri), big }; }, r);
  console.log(r, JSON.stringify(res));
}
await b.close();
