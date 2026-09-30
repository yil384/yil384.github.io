import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const S = '/tmp/yl';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const logs = []; p.on('pageerror', (e) => logs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
await p.goto('http://localhost:8000/?force=1&dpr=0.6&intro=0&lowfx=1');
await p.waitForFunction(() => document.body.classList.contains('world-live'), null, { timeout: 150000 });
await p.waitForTimeout(2000);
await p.evaluate(() => document.getElementById('education').scrollIntoView({ block: 'start', behavior: 'instant' }));
const pos = () => p.evaluate(() => { const g = window.__g; return [g.player.x.toFixed(1), g.player.z.toFixed(1), g.player.mesh.scale.y.toFixed(3)].join(','); });
for (let i = 0; i < 12; i++) { await p.waitForTimeout(2500); console.log(i, await pos()); if (i === 5 || i === 8 || i === 11) await p.screenshot({ path: `${S}/warp_${i}.png` }); }
console.log(logs.join('\n') || 'no errors'); await b.close();
