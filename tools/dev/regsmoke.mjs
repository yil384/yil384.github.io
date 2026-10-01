import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const base = process.env.BASE || 'http://localhost:8000/';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const id of process.argv.slice(2)) {
  const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
  const logs = [];
  p.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && !/WebGPU|GPU stall|GL Driver/.test(m.text()))) logs.push(m.type() + ': ' + m.text().slice(0, 200)); });
  p.on('pageerror', (e) => logs.push('PAGEERR ' + e.message.slice(0, 200)));
  await p.goto(`${base}?force=1&dpr=1&intro=0&lowfx=1&region=${id}`);
  await p.waitForFunction(() => document.body.classList.contains('world-live'), null, { timeout: 150000 }).catch(() => logs.push('TIMEOUT'));
  await p.waitForTimeout(4000);
  const r = await p.evaluate(() => { try { window.__g?.sim?.(5); } catch (e) { return 'SIMERR ' + e.message; } return 'ok'; });
  console.log(id, r, logs.length ? logs.join(' | ') : 'clean');
  await p.close();
}
await b.close();
