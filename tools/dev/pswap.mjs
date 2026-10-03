// Portrait swap probe (assets/js/site/portrait-swap.js): one click on the About photo builds the minifigure
// (assets/img/portrait-lego.webp) out of 5x5 bricks, the next click pops them off and the photo is back. Checks, per
// scenario: the minifigure is not fetched on load; a single click/tap swaps (bricks appear, then go, img src / alt /
// aria-label follow, egg 'minifig' found); a second one swaps back; a double-click opens the flip card (showing the
// current face) and does not swap; 5 quick clicks still toggle the voxel portrait and do not swap, 5 more restore
// the face it had; reduced motion fades instead of moving bricks; no console errors.
// usage: node pswap.mjs [scenarios=desk,plain,phone,rm] [outPrefix=/tmp/yl/ps]
//   desk 1280x800 game look, ?world=0   plain Reviewer mode (R key)   phone 390x844 touch   rm reduced motion
//   world 1280x800 with the 3D world (slow on the software GPU)
// Serve the repo first: python3 -m http.server 8000 (BASE=... to point elsewhere). Prints a JSON report.
// Screenshots: <out>-<scenario>-build.png (bricks frozen mid-build), -lego.png, -pop.png (frozen mid-pop), -photo.png.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, list = 'desk,plain,phone,rm', out = '/tmp/yl/ps'] = process.argv;
const base = process.env.BASE || 'http://localhost:8000/';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = {};

const SC = {
  desk: { w: 1280, h: 800, q: '?world=0&intro=0' },
  world: { w: 1280, h: 800, q: '?force=1&webgl=1&lowfx=1&dpr=0.5&intro=0', world: true },
  plain: { w: 1280, h: 800, q: '?world=0&intro=0', plain: true },
  phone: { w: 390, h: 844, q: '?world=0&intro=0', touch: true },
  rm: { w: 1280, h: 800, q: '?world=0&intro=0', rm: true },
};

for (const name of list.split(',')) {
  const sc = SC[name];
  if (!sc) continue;
  const res = { problems: [] };
  report[name] = res;
  const bad = (m) => res.problems.push(m);
  const ctx = await b.newContext({ viewport: { width: sc.w, height: sc.h }, hasTouch: !!sc.touch, isMobile: !!sc.touch, deviceScaleFactor: sc.touch ? 2 : 1, reducedMotion: sc.rm ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  const cdp = sc.touch ? await ctx.newCDPSession(p) : null;
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error' && !/WebGPU/.test(m.text())) errors.push(m.text().slice(0, 240)); });
  p.on('pageerror', (e) => errors.push(`PAGEERR: ${e.message.slice(0, 300)}`));
  const reqs = [];
  p.on('request', (r) => { if (/portrait-lego/.test(r.url())) reqs.push(r.url()); });
  try {
    await p.goto(base + sc.q, { waitUntil: 'load' });
    if (sc.world) await p.waitForFunction(() => document.body.classList.contains('world-live'), null, { timeout: 150000 }).catch(() => bad('world never went live'));
    await p.waitForTimeout(1500);
    if (sc.plain) { await p.keyboard.press('r'); await p.waitForTimeout(600); }
    await p.evaluate(() => document.getElementById('portrait').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await p.waitForTimeout(1500);
    if (reqs.length) bad('minifigure fetched before the pointer reached the portrait');

    const center = () => p.evaluate(() => { const r = document.getElementById('portrait').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    const tap = async (x, y) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
      await p.waitForTimeout(40);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const clicks = async (n) => {
      const [x, y] = await center();
      if (n === 2 && !sc.touch) { await p.mouse.dblclick(x, y); return; }
      for (let i = 0; i < n; i++) {
        if (sc.touch) await tap(x, y); else { await p.mouse.move(x, y); await p.mouse.down({ clickCount: i + 1 }); await p.mouse.up({ clickCount: i + 1 }); }
        if (i < n - 1) await p.waitForTimeout(70);
      }
    };
    const state = () => p.evaluate(async () => {
      const pt = document.getElementById('portrait');
      const img = pt.querySelector('img');
      const eggs = await import('/assets/js/site/eggs.js');
      return { src: img.src.replace(/.*\//, '').replace(/\?.*/, ''), alt: img.alt, label: pt.getAttribute('aria-label'), bricks: !!pt.querySelector('.portrait__bricks'), voxel: pt.classList.contains('is-voxel'), egg: eggs.has('minifig') };
    });
    // freeze every brick animation at the same moment (t ms after the swap began) for a screenshot
    const freeze = async (t, file) => {
      const ok = await p.waitForFunction(() => document.querySelector('.portrait__bricks')?.getAnimations({ subtree: true }).length || document.querySelector('.portrait__bricks')?.firstChild?.getAnimations().length, null, { timeout: 3000, polling: 'raf' }).then(() => true, () => false);
      if (!ok) { bad(`no brick animations for ${file}`); return null; }
      const info = await p.evaluate((t) => {
        const wall = document.querySelector('.portrait__bricks');
        const as = [wall, ...wall.children].flatMap((el) => el.getAnimations());
        as.forEach((a) => { a.pause(); a.currentTime = t; });
        return { n: as.length, kf: as[as.length - 1].effect.getKeyframes().map((k) => k.transform || `opacity ${k.opacity}`) };
      }, t);
      await p.waitForTimeout(120);
      const [x, y] = await center();
      const r = sc.touch ? 70 : 110;
      await p.screenshot({ path: `${out}-${name}-${file}.png`, clip: { x: Math.max(0, x - r * 1.6), y: Math.max(0, y - r), width: r * 3.2, height: r * 2 } });
      await p.evaluate(() => document.querySelector('.portrait__bricks') && [document.querySelector('.portrait__bricks'), ...document.querySelector('.portrait__bricks').children].flatMap((el) => el.getAnimations()).forEach((a) => a.play()));
      return info;
    };
    const settled = () => p.waitForFunction(() => !document.querySelector('.portrait__bricks'), null, { timeout: 4000 }).catch(() => bad('bricks never cleared'));

    // ---- one click: the minifigure is built
    const s0 = await state();
    if (s0.src !== 'portrait.webp') bad(`starts on ${s0.src}`);
    await clicks(1);
    const build = await freeze(sc.rm ? 120 : 420, 'build');
    res.build = build && { n: build.n, kf: build.kf };
    if (build && sc.rm && build.kf.some((k) => /translate|rotate/.test(k))) bad('reduced motion moves the bricks');
    if (build && !sc.rm && build.n !== 25) bad(`expected 25 brick animations, got ${build.n}`);
    await settled();
    const s1 = await state();
    res.lego = s1;
    if (s1.src !== 'portrait-lego.webp') bad(`after one click the src is ${s1.src}`);
    if (!/minifigure/.test(s1.alt) || !/minifigure/.test(s1.label)) bad('alt / aria-label did not follow');
    if (!s1.egg) bad("egg 'minifig' not found");
    await p.waitForTimeout(300);
    const [cx, cy] = await center();
    await p.screenshot({ path: `${out}-${name}-lego.png`, clip: { x: Math.max(0, cx - 180), y: Math.max(0, cy - 110), width: 360, height: 220 } });

    // ---- one more: the bricks pop off, the photo is back
    await p.waitForTimeout(500);
    await clicks(1);
    await freeze(sc.rm ? 120 : 330, 'pop');
    await settled();
    const s2 = await state();
    if (s2.src !== 'portrait.webp' || s2.alt !== 'Yichen Lin') bad(`second click left ${s2.src} / ${s2.alt}`);
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}-${name}-photo.png`, clip: { x: Math.max(0, cx - 180), y: Math.max(0, cy - 110), width: 360, height: 220 } });

    // ---- minifigure again, then a double-click: the flip card shows it, nothing swaps
    await p.waitForTimeout(500);
    await clicks(1);
    await settled();
    await p.waitForTimeout(500);
    await clicks(2);
    await p.waitForFunction(() => document.querySelector('.pflip'), null, { timeout: 2000 }).catch(() => bad('double-click did not open the card'));
    res.cardFront = await p.evaluate(() => document.querySelector('.pflip__front img')?.src.replace(/.*\//, '').replace(/\?.*/, ''));
    if (res.cardFront !== 'portrait-lego.webp') bad(`card front shows ${res.cardFront}`);
    await p.waitForTimeout(900);
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('.pflip'), null, { timeout: 3000 }).catch(() => bad('Esc did not close'));
    await p.waitForTimeout(800);
    const s3 = await state();
    if (s3.src !== 'portrait-lego.webp' || s3.bricks) bad(`the double-click swapped too (${s3.src}, bricks ${s3.bricks})`);

    // ---- 5 quick clicks: voxel, no bricks; 5 more: the minifigure again
    await p.waitForTimeout(1700);
    await clicks(5);
    await p.waitForTimeout(700);
    const s4 = await state();
    if (!s4.voxel) bad('5 clicks did not turn the portrait voxel');
    if (s4.bricks) bad('5 clicks started a swap');
    await p.waitForTimeout(1700);
    await clicks(5);
    await p.waitForTimeout(700);
    const s5 = await state();
    if (s5.voxel || s5.src !== 'portrait-lego.webp') bad(`5 more clicks left voxel=${s5.voxel} src=${s5.src}`);

    // ---- a click in the middle of a build lands it at once and swaps back
    await p.waitForTimeout(1700);
    await clicks(1);                                  // lego -> photo
    await p.waitForTimeout(500);
    await clicks(1);                                  // photo -> lego while the first one may still run
    await p.waitForTimeout(450);                      // the lone-click wait (350 ms), then the build starts
    await settled();
    const s6 = await state();
    if (s6.src !== 'portrait-lego.webp') bad(`interrupted swaps ended on ${s6.src}`);
    res.requests = reqs.length;
  } catch (err) { bad(`crash: ${err.message.slice(0, 300)}`); }
  res.errors = errors;
  if (errors.length) bad(`${errors.length} console errors`);
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(report, null, 1));
