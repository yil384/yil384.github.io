// Fast page screenshots for UI work.
// usage: node snap.mjs <url> <outPrefix> [w=1440] [h=900] [targets=top]
//   targets: comma list of CSS selectors (scrolled to centre) or pixel offsets; "top" = y 0.
//   Add ?world=0 to the URL to skip the 3D world (much faster), or force=1&dpr=1&intro=0&lowfx=1 to include it.
//   Env ACTIONS='[["click","#sel"],["hover","#sel"],["wait",800],["key","ArrowUp"],["eval","js code"]]' runs before each shot.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, url, out, w = '1440', h = '900', targets = 'top'] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const mobile = +w < 700;
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const logs = [];
p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/WebGPU/.test(m.text())) logs.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
p.on('pageerror', (e) => logs.push(`PAGEERR: ${e.message.slice(0, 400)}`));
await p.goto(url, { waitUntil: 'load' });
await p.waitForFunction(() => document.body.classList.contains('world-live') || document.body.classList.contains('no-world') || !document.getElementById('world'), null, { timeout: 150000 }).catch(() => logs.push('TIMEOUT waiting for world/no-world'));
await p.waitForTimeout(1500);
const actions = process.env.ACTIONS ? JSON.parse(process.env.ACTIONS) : [];
let i = 0;
for (const t of targets.split(',')) {
  if (t === 'top') await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  else if (/^\d+$/.test(t)) await p.evaluate((y) => window.scrollTo({ top: +y, behavior: 'instant' }), t);
  else await p.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'center', behavior: 'instant' }), t);
  await p.waitForTimeout(900);
  for (const [kind, arg] of actions) {
    try {
      if (kind === 'click') await p.click(arg, { timeout: 4000 });
      else if (kind === 'hover') await p.hover(arg, { timeout: 4000 });
      else if (kind === 'wait') await p.waitForTimeout(+arg);
      else if (kind === 'key') await p.keyboard.press(arg);
      else if (kind === 'eval') console.log('eval:', JSON.stringify(await p.evaluate(arg)));
    } catch (e) { logs.push(`ACTION ${kind} ${arg} failed: ${e.message.split('\n')[0]}`); }
  }
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}_${i++}.png` });
}
console.log(logs.slice(0, 30).join('\n') || 'no console errors');
await b.close();
