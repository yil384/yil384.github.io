// Screenshot + console report for a page.  node tools/qa/shot.mjs <url> <out.png> [--w=1440] [--h=900] [--webgpu] [--wait=4000]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const a = process.argv.slice(2), url = a[0], out = a[1];
const opt = Object.fromEntries(a.slice(2).map(s => { const [k, v] = s.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const gl = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const gpu = opt.webgpu ? ['--enable-unsafe-webgpu', '--enable-features=Vulkan,UseSkiaRenderer', '--use-vulkan=swiftshader'] : [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: [...gl, ...gpu] });
const page = await browser.newPage({ viewport: { width: +(opt.w || 1440), height: +(opt.h || 900) } });
const log = [];
page.on('console', m => log.push(`[${m.type()}] ${m.text().slice(0, 400)}`));
page.on('pageerror', e => log.push(`[pageerror] ${e.message.slice(0, 400)}`));
await page.goto(url, { waitUntil: 'load' });
// --ready='<js expr>' waits for it; --pause='<js>' runs it before the screenshot (e.g. stop the render loop so the compositor is free)
if (opt.ready) await page.waitForFunction(opt.ready, null, { timeout: +(opt.timeout || 90000) }).catch(e => log.push('[timeout] ' + opt.ready));
else await page.waitForTimeout(+(opt.wait || 4000));
if (opt.pause) { await page.evaluate(opt.pause); await page.waitForTimeout(500); }
if (opt.eval) console.log('eval:', JSON.stringify(await page.evaluate(opt.eval)));
await page.screenshot({ path: out });
console.log(log.join('\n') || '(no console output)');
await browser.close();
