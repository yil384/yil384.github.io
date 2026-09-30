// Perf probe: node perf.mjs <label> [extraQuery]
// Measures per-frame JS time (sum of rAF callbacks), DOM mutations per frame, draw calls and
// triangles per frame, and frames per second, in three scenarios: tour settled, tour scrolling, play walking.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, label = 'run', extra = 'lowfx=1', port = '8000'] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
const logs = [];
p.on('console', (m) => { if (m.type() === 'error') logs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
p.on('pageerror', (e) => logs.push(`PAGEERR: ${e.message.slice(0, 300)}`));
await p.addInitScript(() => {
  const M = { frames: 0, js: 0, muts: 0, calls: 0, tris: 0, t0: 0, on: false, jsMax: 0 };
  window.__M = M;
  const raf = window.requestAnimationFrame.bind(window);
  let pending = [];
  let scheduled = false;
  const run = (ts) => {
    scheduled = false;
    const list = pending; pending = [];
    const r = window.__g?.renderer;
    if (r && M.on) { r.info.autoReset = false; r.info.reset(); }
    const a = performance.now();
    for (const cb of list) { try { cb(ts); } catch (e) { setTimeout(() => { throw e; }); } }
    const d = performance.now() - a;
    if (M.on) {
      M.frames++; M.js += d; M.jsMax = Math.max(M.jsMax, d);
      if (r) { M.calls += r.info.render.drawCalls; M.tris += r.info.render.triangles; }
    }
  };
  window.requestAnimationFrame = (cb) => { pending.push(cb); if (!scheduled) { scheduled = true; raf(run); } return pending.length; };
  new MutationObserver((l) => { if (M.on) M.muts += l.length; }).observe(document, { subtree: true, attributes: true, childList: true, characterData: true });
});
await p.goto(`http://localhost:${port}/?force=1&dpr=1&intro=0&perf=1&${extra}`, { waitUntil: 'load' });
await p.waitForFunction(() => document.body.classList.contains('world-live'), null, { timeout: 150000 });
await p.waitForTimeout(3000);
const measure = async (ms) => {
  await p.evaluate(() => { window.__perf.reset(); Object.assign(window.__M, { frames: 0, js: 0, muts: 0, calls: 0, tris: 0, jsMax: 0, on: true, t0: performance.now() }); });
  await p.waitForTimeout(ms);
  return p.evaluate(() => { const M = window.__M; M.on = false; const P = window.__perf; const s = (performance.now() - M.t0) / 1000; const f = Math.max(1, P.n);
    return { rafPerS: +(M.frames / s).toFixed(1), renderedPerS: +(P.n / s).toFixed(1), simMs: +(P.sim / f).toFixed(2), renderSubmitMs: +(P.render / f).toFixed(1), domMutsPerFrame: +(M.muts / f).toFixed(1), drawCalls: Math.round(P.calls / f), trisK: +(P.tris / f / 1000).toFixed(1) }; });
};
const out = {};
await p.evaluate(() => document.querySelector('#about')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
await p.waitForTimeout(5000);
out.tourSettled = await measure(5000);
const scrolling = p.evaluate(async () => { for (let i = 0; i < 40; i++) { window.scrollBy(0, 60); await new Promise((r) => setTimeout(r, 100)); } });
out.tourScroll = await measure(4000);
await scrolling;
await p.evaluate(() => window.__g.enterPlay());
await p.waitForTimeout(1500);
await p.evaluate(() => document.querySelector('.g__coach button')?.click());
await p.keyboard.down('w');
out.playWalk = await measure(4000);
await p.keyboard.up('w');
console.log(label, JSON.stringify(out, null, 1));
console.log(logs.slice(0, 10).join('\n') || 'no console errors');
await b.close();
