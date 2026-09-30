import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:8000/?force=1&dpr=1&intro=0&lowfx=1&webgl=1&perf=1&region=stacks', { waitUntil: 'load' });
await p.waitForFunction(() => document.body.classList.contains('world-live') && window.__g?.where?.id === 'stacks', null, { timeout: 150000 });
await p.waitForTimeout(2000);
await p.evaluate(() => { window.__g.closeAllModals(); document.querySelector('.g__coach button')?.click(); });
const measure = async (name, setup) => {
  await p.evaluate(setup);
  await p.waitForTimeout(2500);
  await p.evaluate(() => window.__perf.reset());
  await p.waitForTimeout(4000);
  console.log(name, JSON.stringify(await p.evaluate(() => { const q = window.__perf; return { frames: q.n, calls: +(q.calls / q.n).toFixed(1), tris: Math.round(q.tris / q.n) }; })));
};
await measure('arena', () => { const g = window.__g; g.teleport(g.where.ox - 18.5, g.where.oz - 4); g.player.hp = 999; g.sim(6); g.player.hp = 999; });
await measure('track', () => { const g = window.__g; const d = g.regions.builtRegion('stacks').debug; g.teleport(g.where.ox + 18, g.where.oz - 4); g.vehicles.set('car'); g.player.hp = 999; d.SC.run = -1; });
await p.evaluate(() => { const g = window.__g; const d = g.regions.builtRegion('stacks').debug; g.closeAllModals(); });
// start the hybrid scenario through the suite
await p.evaluate(() => { const g = window.__g; g.S.world.data.stacks.scen = 2; });
await p.evaluate(() => { const g = window.__g; g.teleport(g.where.ox + 17.5, g.where.oz + 5.2); });
await p.keyboard.press('KeyE'); await p.waitForTimeout(800);
await p.click('.talk__choice >> nth=0', { force: true }).catch(() => {});
await measure('hybrid', () => { const g = window.__g; g.teleport(g.where.ox + 18, g.where.oz - 6); g.player.hp = 999; g.sim(7); g.player.hp = 999; });
console.log(errs.join('\n') || 'no errors');
await b.close();
