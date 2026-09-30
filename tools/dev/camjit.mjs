import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const logs = []; p.on('pageerror', (e) => logs.push(e.message));
await p.goto('http://localhost:8002/?force=1&dpr=0.5&intro=0&lowfx=1&norender=1');
await p.waitForFunction(() => document.body.classList.contains('world-live'), null, { timeout: 150000 });
await p.evaluate(() => { window.__g.enterPlay?.() ?? window.__page?.world?.enterPlay(); });
await p.waitForTimeout(1500);
const r = await p.evaluate(async () => {
  const g = window.__g; const cam = g.rig.cam || g.rig.camera;
  document.querySelectorAll('button').forEach((b) => { if (/Let.s go/.test(b.textContent)) b.click(); });
  g.closeAllModals?.();
  const key = (k, d) => dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { key: k, code: 'Key' + k.toUpperCase(), bubbles: true }));
  const out = {};
  for (const [k, secs] of [['w', 4], ['a', 3], ['s', 4], ['d', 3]]) {
    key(k, 1);
    const ds = [], ys = [], oc = [], li = [], cd = [], py = [];
    for (let i = 0; i < secs * 60; i++) { g.sim(1 / 60); const dx = cam.position.x - g.player.x, dz = cam.position.z - g.player.z; const D = g.rig.debug; ds.push(cam.position.distanceTo(D.look)); ys.push(cam.position.y); oc.push(D.occ ?? D.dist); li.push(D.lift); cd.push(D.dist); py.push(g.player.y); }
    key(k, 0);
    const flips = (a) => { let f = 0; for (let i = 2; i < a.length; i++) { const d1 = a[i - 1] - a[i - 2], d2 = a[i] - a[i - 1]; if (Math.abs(d1) > 0.02 && Math.abs(d2) > 0.02 && Math.sign(d1) !== Math.sign(d2)) f++; } return f; };
    const maxJump = (a) => Math.max(...a.slice(1).map((v, i) => Math.abs(v - a[i])));
    out[k] = { distFlips: flips(ds), yFlips: flips(ys), maxDistJump: +maxJump(ds).toFixed(3), maxYJump: +maxJump(ys).toFixed(3), occFlips: flips(oc), occJump: +maxJump(oc).toFixed(3), liftJump: +maxJump(li).toFixed(3), zoomJump: +maxJump(cd).toFixed(3), playerYJump: +maxJump(py).toFixed(3), playerYFlips: flips(py), pos: [g.player.x.toFixed(1), g.player.z.toFixed(1)] };
  }
  return out;
});
console.log(JSON.stringify(r, null, 1)); console.log(logs.join('\n') || 'no errors'); await b.close();
