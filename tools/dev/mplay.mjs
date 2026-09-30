// Phone play-mode probe: real touch input (CDP), layout audit, a few key screenshots.
// usage: node mplay.mjs [w=390] [h=844] [outPrefix=/tmp/yl/mp] [shots=play,map,battle,modal]
//   Loads the page as a touch phone, taps "Take control", then checks: the touch controls are on
//   screen and not covered, nothing overflows the viewport, the joystick moves the scholar, a right-side
//   drag turns the camera, jump / attack / E / map / vehicle buttons do something, the map, a battle
//   and a panel fit the screen. Prints a JSON report (problems first).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, W = '390', H = '844', out = '/tmp/yl/mp', shotList = 'play,map,battle,modal'] = process.argv;
const shots = new Set(shotList.split(','));
const base = process.env.BASE || 'http://localhost:8000/';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: +W, height: +H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
const logs = [];
const problems = [];
p.on('console', (m) => { if (m.type() === 'error' && !/WebGPU/.test(m.text())) logs.push(m.text().slice(0, 240)); });
p.on('pageerror', (e) => logs.push(`PAGEERR: ${e.message.slice(0, 300)}`));
await p.goto(`${base}?force=1&intro=0&webgl=1${process.env.Q || ''}`, { waitUntil: 'load' });
await p.waitForFunction(() => document.body.classList.contains('world-live'), null, { timeout: 150000 }).catch(() => problems.push('world never went live'));
await p.waitForTimeout(1200);

const touch = async (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
const tap = async (x, y) => { await touch('touchStart', [[x, y]]); await p.waitForTimeout(60); await touch('touchEnd', []); await p.waitForTimeout(120); };
const center = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? [r.left + r.width / 2, r.top + r.height / 2] : null; }, sel);
const tapSel = async (sel, what = sel) => { const c = await center(sel); if (!c) { problems.push(`not on screen: ${what}`); return false; } await tap(...c); return true; };

// layout audit: fixed/absolute UI that leaves the viewport, and touch controls covered by other UI
const audit = (label) => p.evaluate((label) => {
  const W = innerWidth, H = innerHeight, res = [];
  if (document.documentElement.scrollWidth > W + 1) res.push(`${label}: page scrolls sideways (${document.documentElement.scrollWidth} > ${W})`);
  const vis = (e) => { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const name = (e) => (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') || e.tagName;
  const root = document.getElementById('game-root');
  for (const e of root.querySelectorAll('*')) {
    if (!vis(e)) continue;
    const s = getComputedStyle(e);
    if (s.position !== 'fixed' && s.position !== 'absolute' && !e.matches('.modal, .hud-card, button')) continue;
    const r = e.getBoundingClientRect();
    if (e.closest('.touch__look')) continue;
    if (r.right > W + 1 || r.left < -1 || r.bottom > H + 1 || r.top < -1) {
      // clipped by a scrolling ancestor is fine
      let clip = false; for (let a = e.parentElement; a && a !== root; a = a.parentElement) { const o = getComputedStyle(a).overflow; if (/(auto|scroll|hidden)/.test(o)) { const ar = a.getBoundingClientRect(); if (ar.right <= W + 1 && ar.bottom <= H + 1 && ar.left >= -1 && ar.top >= -1) { clip = true; break; } } }
      if (!clip) res.push(`${label}: off-screen ${name(e)} [${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}]`);
    }
  }
  // tap targets: every touch button must be the topmost element at its centre
  for (const e of root.querySelectorAll('.touch.is-on .touch__btn, .touch.is-on .touch__stick')) {
    if (!vis(e)) continue;
    const r = e.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (top && !e.contains(top) && !top.contains(e)) res.push(`${label}: ${name(e)} covered by ${name(top)}`);
    if (r.width < 40) res.push(`${label}: small tap target ${name(e)} ${Math.round(r.width)}px`);
  }
  // HUD cards overlapping the touch controls
  const ctrls = [...root.querySelectorAll('.touch.is-on .touch__btn, .touch.is-on .touch__stick')].filter(vis).map((e) => [e, e.getBoundingClientRect()]);
  for (const e of root.querySelectorAll('.hud-card, .hud-top, .hud-zone, .hud-boss, .g__coach, .hud-minimap, .hud-map-wrap, .hud-quests')) {
    if (!vis(e)) continue;
    const r = e.getBoundingClientRect();
    for (const [c, cr] of ctrls) if (r.left < cr.right && r.right > cr.left && r.top < cr.bottom && r.bottom > cr.top) res.push(`${label}: ${name(e)} overlaps ${name(c)}`);
  }
  return res;
}, label);

const state = () => p.evaluate(() => { const g = window.__g; return { x: +g.player.x.toFixed(2), z: +g.player.z.toFixed(2), y: +g.player.y.toFixed(2), yaw: +(g.rig.want?.yaw ?? g.rig.yaw ?? 0).toFixed(3), play: g.mode.play, vehicle: g.player.vehicle, modal: g.modalOpen(), region: g.where.id }; });
const report = { viewport: `${W}x${H}` };

// 1. enter play by tapping the hero menu's "Take control" (fallback: the bar's play button)
await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await p.waitForTimeout(400);
const take = await p.evaluate(() => { const e = [...document.querySelectorAll('button, a, [role=menuitem]')].find((x) => /take control/i.test(x.textContent) && x.getBoundingClientRect().width); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
if (take) await tap(...take); else { problems.push('no visible "Take control"'); await tapSel('#play-btn'); }
await p.waitForTimeout(2500);
report.enter = await state();
if (!report.enter.play) { problems.push('tapping Take control did not start play'); await p.evaluate(() => window.__g.enterPlay({ dive: false })); await p.waitForTimeout(1500); }
report.coach = await p.evaluate(() => !!document.querySelector('.g__coach'));
problems.push(...await audit('play+coach'));
if (shots.has('play')) await p.screenshot({ path: `${out}_play.png` });
// dismiss the coach with a tap
if (report.coach) { const ok = await p.evaluate(() => { const e = [...document.querySelectorAll('.g__coach button')].pop(); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); if (ok) await tap(...ok); await p.waitForTimeout(300); if (await p.evaluate(() => !!document.querySelector('.g__coach'))) problems.push('coach did not close on tap'); }
problems.push(...await audit('play'));

// 2. joystick: hold up for 1.2 s (sim advances game time with the stick held)
const stick = await center('.touch__stick');
if (stick) {
  const s0 = await state();
  await touch('touchStart', [stick]);
  await touch('touchMove', [[stick[0], stick[1] - 45]]);
  await p.waitForTimeout(80);
  const ax = await p.evaluate(() => ({ ...window.__g.input.stick }));
  await p.evaluate(() => window.__g.sim(1.2));
  const s1 = await state();
  await touch('touchEnd', []);
  report.stick = { axis: ax, moved: +Math.hypot(s1.x - s0.x, s1.z - s0.z).toFixed(2) };
  if (report.stick.moved < 1) problems.push(`joystick did not move the scholar (${report.stick.moved})`);
  // two thumbs: stick + look at once
  const look = [+W * 0.72, +H * 0.45];
  const y0 = (await state()).yaw;
  await touch('touchStart', [stick, look]);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [[stick[0], stick[1] - 45], [look[0] - i * 18, look[1]]]); await p.waitForTimeout(30); }
  await p.evaluate(() => window.__g.sim(0.3));
  const y1 = (await state()).yaw;
  await touch('touchEnd', []);
  report.look = { dyaw: +(y1 - y0).toFixed(3) };
  if (Math.abs(y1 - y0) < 0.05) problems.push(`right-side drag did not turn the camera (dyaw ${report.look.dyaw})`);
} else problems.push('no joystick');

// 3. buttons
const btn = async (cls) => center(`.touch.is-on .touch__btn--${cls}`);
const jump = await btn('jump');
if (jump) {
  await touch('touchStart', [jump]); await p.waitForTimeout(50);
  const j = await p.evaluate(() => { const g = window.__g; const y0 = g.player.y; g.sim(0.25); return +(g.player.y - y0).toFixed(2); });
  await touch('touchEnd', []);
  await p.evaluate(() => window.__g.sim(1));
  report.jump = j;
  if (j < 0.3) problems.push(`jump button did not jump (dy ${j})`);
} else problems.push('no jump button');
const atk = await btn('attack');
if (atk) { await tap(...atk); report.attack = await p.evaluate(() => { const g = window.__g; return g.player.attackT ?? g.player.swing ?? g.player.combo ?? 'n/a'; }); } else problems.push('no attack button');

// 4. map
if (await tapSel('.touch.is-on .touch__btn--map', 'map button')) {
  await p.waitForTimeout(900);
  report.map = await p.evaluate(() => !!document.querySelector('.wmap, .modal'));
  if (!report.map) problems.push('map button opened nothing');
  problems.push(...await audit('map'));
  if (shots.has('map')) await p.screenshot({ path: `${out}_map.png` });
  await p.evaluate(() => window.__g.closeAllModals());
  await p.waitForTimeout(300);
}

// 5. a wild battle
const bat = await p.evaluate(async () => { try { const m = await import('/assets/js/game3d/monsters.js'); m.startWild('meadow'); return true; } catch (e) { return String(e); } });
await p.waitForTimeout(1200);
report.battle = bat;
problems.push(...await audit('battle'));
report.battleFit = await p.evaluate(() => { const e = document.querySelector('.battle-panel'); if (!e) return null; const r = e.getBoundingClientRect(); const m = e.closest('.modal') || e; return { w: Math.round(r.width), h: Math.round(r.height), scrollH: m.scrollHeight, clientH: m.clientHeight, btns: [...e.querySelectorAll('button')].filter((x) => x.getBoundingClientRect().width).map((x) => Math.round(x.getBoundingClientRect().height)) }; });
if (shots.has('battle')) await p.screenshot({ path: `${out}_battle.png` });
// run from the battle via the UI if possible
await p.evaluate(() => window.__g.closeAllModals());
await p.waitForTimeout(300);

// 6. a panel (help / controls) through the HUD
const opened = await p.evaluate(() => { const e = document.querySelector('.hud-menu button, .hud-actions button[title^="Controls"], button[title^="Controls"]'); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? [r.left + r.width / 2, r.top + r.height / 2] : 'hidden'; });
report.helpBtn = opened;
if (Array.isArray(opened)) { await tap(...opened); await p.waitForTimeout(800); problems.push(...await audit('help')); if (shots.has('modal')) await p.screenshot({ path: `${out}_modal.png` }); await p.evaluate(() => window.__g.closeAllModals()); }
else problems.push('no reachable Controls/help/leave button on phone');

// 7. vehicle
if (await tapSel('.touch.is-on .touch__btn--vehicle', 'vehicle button')) { await p.evaluate(() => window.__g.sim(0.5)); report.vehicle = (await state()).vehicle; }
// 8. leave play: is there a visible way back?
report.back = await p.evaluate(() => { const e = document.querySelector('.hud-close'); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : 'hidden'; });
report.perf = await p.evaluate(() => ({ dpr: window.__g.renderer.getPixelRatio?.(), lowfx: window.__g.lowfx }));
report.problems = [...new Set(problems)];
report.errors = logs.slice(0, 12);
console.log(JSON.stringify(report, null, 1));
await b.close();
