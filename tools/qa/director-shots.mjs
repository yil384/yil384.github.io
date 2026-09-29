// Renders the live director at fixed rail positions and saves PNGs.  node tools/qa/director-shots.mjs [--webgpu] [--tier=1] [--w=960 --h=540] [--s=0,1.4,...] [--out=tools/qa/out/director]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const opt = Object.fromEntries(process.argv.slice(2).map(a => { const i = a.indexOf('='); return i < 0 ? [a.replace(/^--/, ''), true] : [a.slice(2, i), a.slice(i + 1)]; }));
const S = String(opt.s || '0.1,1.1,1.8,2.6,3.4,4.3,5.3,6.3').split(',').map(Number), out = opt.out || 'tools/qa/out/director';
mkdirSync(out, { recursive: true });
const gl = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const gpu = opt.webgpu ? ['--enable-unsafe-webgpu', '--enable-features=Vulkan,UseSkiaRenderer', '--use-vulkan=swiftshader'] : [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: [...gl, ...gpu] });
const page = await browser.newPage({ viewport: { width: +(opt.w || 960), height: +(opt.h || 540) } });
const log = [];
page.on('console', m => { if (m.type() !== 'info' || /director/.test(m.text())) log.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
page.on('pageerror', e => log.push(`[pageerror] ${e.message.slice(0, 300)}`));
const url = `http://localhost:8000/lab/director.html?tier=${opt.tier || 1}${opt.webgpu ? '&shim=swizzle' : '&webgl=1'}`;
await page.goto(url);
await page.waitForFunction('window.__ready || window.__failed', null, { timeout: 240000 });
if (await page.evaluate('window.__failed')) { console.log(log.join('\n')); process.exit(1); }
const paths = [];
for (const s of S) {
  const t0 = Date.now(), data = await page.evaluate(v => window.__dir.snap(v), s);
  const f = `${out}/s${String(s).replace('.', '_')}${opt.webgpu ? '_gpu' : ''}.png`;
  writeFileSync(f, Buffer.from(data.slice(data.indexOf(',') + 1), 'base64')); paths.push(f);
  console.log(`s=${s} -> ${f}  (${Date.now() - t0} ms)`);
}
console.log(await page.evaluate('JSON.stringify(window.__dir.stats())'));
console.log(log.slice(0, 12).join('\n') || '(no console output)');
await browser.close();
