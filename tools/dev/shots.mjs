// Render every authored shot with the page hidden. usage: node shots.mjs <outPrefix> [keys,comma,separated] [side]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, out, keys = '', side = 'left'] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 300)));
await p.goto('http://localhost:8000/?force=1&dpr=1&intro=0&lowfx=1', { waitUntil: 'load' });
await p.waitForFunction(() => document.body.classList.contains('world-live'), null, { timeout: 120000 });
await p.addStyleTag({ content: '.page,.bar,.foot,.g__fx .g__plate{display:none!important}' });
await p.evaluate(() => window.__g.director.setEnabled(false));
const all = await p.evaluate(() => Object.keys(window.__g.stage.shots));
const list = keys ? keys.split(',') : all;
console.log('keys:', all.join(' '));
for (const k of list) {
  await p.evaluate(([k, side]) => { const g = window.__g; const s = g.stage.shots[k]; g.rig.shot({ ...s, shiftX: (side === 'right' ? -1 : 1) * (s.shiftX ?? 0.2) }); g.stage.setFocus(s.item ?? k); g.tour.stand(s.stand[0], s.stand[1], s.face, { instant: true }); g.rig.settle(); g.invalidate(); }, [k, side]);
  await p.waitForTimeout(1600);
  await p.screenshot({ path: `${out}_${k}.png` });
}
await b.close();
