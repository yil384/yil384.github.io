// The opening animation, frame by frame: one page load, the intro clock held at each time in turn
// (window.__intro.hold), a screenshot per stop. Also reports console errors and the shatter mode used.
// usage: node intro.mjs [w=1440] [h=900] [times=0.3,...] [extra query, e.g. &intro3d=1] [outPrefix=/tmp/yl/intro]
// Times past 4.1 s are inside the shatter. The test Chromium is a software GPU: add &intro3d=1 to force three.js.
// ART='{"hero":"path.png",...}' tries image art (art.js slots) before it is switched on in the repo.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, w = '1440', h = '900', times = '0.3,0.55,1.0,1.45,1.9,2.2,2.65,3.0,3.3,3.5,3.6,3.65,3.8,4.05,4.3,4.6', extra = '', out = '/tmp/yl/intro'] = process.argv;
const port = process.env.PORT || 8000;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const mobile = +w < 700;
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: 1 });
if (process.env.ART) await ctx.addInitScript((a) => { window.__introArt = JSON.parse(a); }, process.env.ART);
const p = await ctx.newPage();
const logs = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
p.on('pageerror', (e) => logs.push(`PAGEERR: ${e.message.slice(0, 400)}`));
const list = times.split(',').map(Number);
await p.goto(`http://localhost:${port}/?intro=1&world=0&introAt=${list[0]}${extra}`, { waitUntil: 'load' });
let i = 0;
for (const t of list) {
  await p.evaluate((s) => window.__intro?.hold?.(s), t);
  const ok = await p.waitForFunction((s) => !window.__intro || window.__intro.phase === 'over' || window.__intro.t >= s - 1e-4, t, { timeout: 60000 }).then(() => true).catch(() => false);
  await p.waitForTimeout(250);
  const st = await p.evaluate(() => ({ t: window.__intro?.t, phase: window.__intro?.phase, mode: window.__intro?.mode }));
  await p.screenshot({ path: `${out}_${String(i++).padStart(2, '0')}.png` });
  console.log(`t=${t}`, ok ? '' : 'TIMEOUT', JSON.stringify(st));
}
console.log(logs.slice(0, 30).join('\n') || 'no console errors');
await b.close();
