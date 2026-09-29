// Load a page, wait for a ready expression, pause, and report mean colour + a few sample pixels of the screenshot.
// node tools/qa/px.mjs <url> <out.png> --ready=... --pause=... [--w --h --webgpu]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';
const a = process.argv.slice(2), url = a[0], out = a[1];
const opt = Object.fromEntries(a.slice(2).map(s => { const i = s.indexOf('='); return i < 0 ? [s.replace(/^--/, ''), true] : [s.slice(2, i), s.slice(i + 1)]; }));
const gl = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const gpu = opt.webgpu ? ['--enable-unsafe-webgpu', '--enable-features=Vulkan,UseSkiaRenderer', '--use-vulkan=swiftshader'] : [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: [...gl, ...gpu] });
const page = await browser.newPage({ viewport: { width: +(opt.w || 640), height: +(opt.h || 360) } });
const log = [];
page.on('console', m => { if (m.type() !== 'info') log.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
page.on('pageerror', e => log.push(`[pageerror] ${e.message.slice(0, 300)}`));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(opt.ready, null, { timeout: +(opt.timeout || 90000) }).catch(() => log.push('[timeout] ' + opt.ready));
if (opt.pause) { await page.evaluate(opt.pause); await page.waitForTimeout(400); }
if (opt.snap) { // save window.__lab.snapshot (a data URL grabbed in the render task) instead of a compositor screenshot
  const url = await page.evaluate('window.__lab.snapshot');
  (await import('node:fs')).writeFileSync(out, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
} else await page.screenshot({ path: out });
console.log(log.slice(0, 8).join('\n') || '(quiet)');
await browser.close();
