// Game smoke test (NOT the full regression contract): the overlay opens, every zone can be visited without console errors or
// page errors, WASD moves the player, Space attacks without throwing, closing works.  node tools/qa/game-check.mjs [--webgpu]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const opt = Object.fromEntries(process.argv.slice(2).map(a => [a.replace(/^--/, ''), true]));
const gl = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const gpu = opt.webgpu ? ['--enable-unsafe-webgpu', '--enable-features=Vulkan,UseSkiaRenderer', '--use-vulkan=swiftshader'] : [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: [...gl, ...gpu] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /THREE|three/.test(m.text()) && !/WebGPU is not available/.test(m.text()))) errors.push(`[${m.type()}] ${m.text().slice(0, 200)}`); });
page.on('pageerror', e => errors.push(`[pageerror] ${e.message.slice(0, 200)}`));
await page.goto(`http://localhost:8000/lab/game.html${opt.webgpu ? '?shim=swizzle' : '?webgl=1'}`);
await page.waitForFunction('window.__ready || window.__failed', null, { timeout: 120000 });
const results = [];
const ok = (name, pass, info = '') => { results.push({ name, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} ${info}`); };
ok('game created', !(await page.evaluate('window.__failed')));
await page.evaluate('window.__g.S.settings.tutorial = true'); // skip the coach card
await page.waitForTimeout(800);
const x0 = await page.evaluate('window.__g.player.x + "," + window.__g.player.z');
await page.keyboard.down('d'); await page.waitForTimeout(1500); await page.keyboard.up('d');
const x1 = await page.evaluate('window.__g.player.x + "," + window.__g.player.z');
ok('WASD moves the player', x0 !== x1, `${x0} -> ${x1}`);
await page.keyboard.press('Space'); await page.waitForTimeout(400);
ok('attack does not throw', errors.length === 0);
for (const z of ['plaza', 'meadow', 'camp', 'ice', 'shadow', 'peak', 'door']) {
  const r = await page.evaluate(zn => { const Z = window.__g.ZONES[zn]; window.__g.teleport(Z.x, Z.z); return [window.__g.player.x, window.__g.player.z]; }, z).catch(e => ['err', String(e)]);
  await page.waitForTimeout(700);
  ok(`zone ${z}`, errors.length === 0, JSON.stringify(r));
}
const st = await page.evaluate('({ hp: window.__g.S.player.hp, dead: window.__g.player.dead, backend: window.__g.backend })');
ok('player alive, backend ' + st.backend, !st.dead);
await page.evaluate('window.__g.close()');
ok('close hides the overlay', await page.evaluate("document.querySelector('.g').hidden === true"));
console.log(errors.length ? errors.join('\n') : '(no console errors)');
await browser.close();
process.exit(results.every(r => r.pass) && !errors.length ? 0 : 1);
