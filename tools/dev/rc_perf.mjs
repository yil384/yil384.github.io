import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:8000/?force=1&dpr=1&intro=0&lowfx=1&webgl=1&perf=1&region=hub', { waitUntil: 'load' });
await p.waitForFunction(() => document.body.classList.contains('world-live'), null, { timeout: 150000 });
await p.waitForTimeout(2000);
await p.evaluate(() => { window.__g.enterPlay?.({ dive: false }); });
for (const r of process.argv.slice(2)) {
  await p.evaluate((r) => window.__g.travel(r, null, { instant: true }), r);
  await p.waitForFunction((r) => window.__g.where.id === r, r, { timeout: 60000 });
  await p.evaluate(() => { window.__g.closeAllModals(); const g = window.__g; g.teleport(g.where.ox, g.where.oz + 10); });
  await p.waitForTimeout(3000);
  await p.evaluate(() => window.__perf.reset());
  await p.waitForTimeout(5000);
  const res = await p.evaluate(() => { const q = window.__perf; return { frames: q.n, calls: +(q.calls / q.n).toFixed(1), tris: Math.round(q.tris / q.n), simMs: +(q.sim / q.n).toFixed(2) }; });
  console.log(r, JSON.stringify(res));
}
console.log(errs.slice(0, 10).join('\n') || 'no errors');
await b.close();
