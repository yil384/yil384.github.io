// usage: node tour.mjs <outPrefix> [w] [h] [query] [scrollY,scrollY,...|#id,#id]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, out, w='1440', h='900', query='force=1&dpr=1&intro=0&lowfx=1', ys='0'] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, hasTouch: +w < 700, isMobile: +w < 700 });
const p = await ctx.newPage();
const logs = [];
p.on('console', m => { if (m.type() !== 'info' && !/WebGPU/.test(m.text())) logs.push(m.type()+': '+m.text().slice(0,300)); });
p.on('pageerror', e => logs.push('PAGEERR: '+e.message.slice(0,400)));
await p.goto('http://localhost:8000/?' + query, { waitUntil: 'load' });
await p.waitForFunction(() => document.body.classList.contains('world-live') || document.body.classList.contains('no-world'), null, { timeout: 120000 }).catch(() => logs.push('TIMEOUT waiting for world'));
await p.waitForTimeout(2500);
let i = 0;
for (const y of ys.split(',')) {
  const before = await p.evaluate(() => window.__g?.director.currentKey);
  if (y.startsWith('#')) await p.evaluate((sel) => { const el = document.querySelector(sel); el.scrollIntoView({ block: 'center', behavior: 'instant' }); }, y);
  else await p.evaluate((y) => window.scrollTo({ top: +y, behavior: 'instant' }), y);
  // wait for the director to pick a new target (slow software rendering), then land the camera on it
  await p.waitForFunction((b) => window.__g && (window.__g.director.currentKey !== b || b === undefined), before, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(600);
  await p.evaluate(() => { const g = window.__g; g?.rig.settle(); g?.tour.stand(g.tour.goal?.x ?? 0, g.tour.goal?.z ?? 0, g.tour.goal?.face, { instant: true }); g?.invalidate(); });
  await p.waitForTimeout(1600);
  await p.screenshot({ path: `${out}_${i++}.png` });
}
console.log(logs.slice(0, 20).join('\n') || 'no console warnings');
await b.close();
