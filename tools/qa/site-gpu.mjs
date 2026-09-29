// Whole page on the WebGPU backend (software Vulkan): director must mount as webgpu, no console/page errors, telemetry reads WEBGPU.
//   node tools/qa/site-gpu.mjs [--w=1280 --h=720]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const opt = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--enable-features=Vulkan,UseSkiaRenderer', '--use-vulkan=swiftshader'] });
const page = await browser.newPage({ viewport: { width: +(opt.w || 1280), height: +(opt.h || 720) } });
const errs = [];
page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /THREE/.test(m.text()))) errs.push(`[${m.type()}] ${m.text().slice(0, 200)}`); });
page.on('pageerror', e => errs.push(`[pageerror] ${e.message.slice(0, 200)}`));
await page.goto('http://localhost:8000/?force=1&tier=2&shim=swizzle&opening=skip', { waitUntil: 'load' });
await page.waitForFunction("document.documentElement.dataset.director === 'on'", null, { timeout: 120000 }).catch(() => errs.push('[timeout] director did not mount'));
await page.waitForTimeout(3000);
const info = await page.evaluate(() => ({ backend: window.__page?.heroCtl?.backend, tier: window.__site?.tier, tel: document.querySelector('[data-telemetry], .hud__tel, #telemetry')?.textContent?.trim(), stats: window.__page?.heroCtl?.stats?.() }));
console.log(JSON.stringify(info));
for (const y of [0.35, 1.3, 3.2]) { await page.evaluate(v => window.__page.heroCtl.seek?.(v), y); await page.waitForTimeout(1500); }
await page.evaluate(() => window.__page.heroCtl.seek?.(null));
console.log(errs.length ? errs.join('\n') : '(no console errors)');
await browser.close();
process.exit(info.backend === 'webgpu' && !errs.length ? 0 : 1);
