// Portrait flip probe (assets/js/site/portrait-flip.js): double-click the About photo, the card flips over and plays
// the intro video, then flips back on 'ended'. Checks, per scenario: 3 quick clicks do nothing; 5 quick clicks still
// toggle the voxel portrait (and do not open the video); a double-click (desktop) / real CDP double-tap (phone) opens
// the card, it grows to a square inside the viewport, the video's currentTime advances; the rest plays at 4x to
// 'ended' -> card flips back, overlay removed, portrait visible again (focus back on it), egg 'secret' found; a second
// open closes early on Esc, and neither Esc nor W reaches the page's own key handlers; no console errors.
// usage: node pflip.mjs [scenarios=desk,world,plain,phone,rm] [outPrefix=/tmp/yl/pf]
//   desk  1280x800 game look, ?world=0        world  1280x800 with the 3D world (?force=1&webgl=1&lowfx=1&dpr=0.5)
//   plain Reviewer mode (R key), ?world=0      phone  390x844 touch emulation, ?world=0      rm  reduced motion, ?world=0
// Serve the repo first: python3 -m http.server 8000 (BASE=... to point elsewhere). Prints a JSON report.
// Screenshots: <out>-<scenario>-flip.png (mid-flip, animations paused at 22%), -play.png (~3 s in), -back.png (mid
// flip-back), -after.png (portrait restored). Note: this Chromium has no H.264, so it plays the WebM source.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, list = 'desk,world,plain,phone,rm', out = '/tmp/yl/pf'] = process.argv;
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
  const res = { problems: [], notes: [] };
  report[name] = res;
  const bad = (m) => res.problems.push(m);
  const ctx = await b.newContext({ viewport: { width: sc.w, height: sc.h }, hasTouch: !!sc.touch, isMobile: !!sc.touch, deviceScaleFactor: 1, reducedMotion: sc.rm ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  const cdp = sc.touch ? await ctx.newCDPSession(p) : null;
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error' && !/WebGPU/.test(m.text())) errors.push(m.text().slice(0, 240)); });
  p.on('pageerror', (e) => errors.push(`PAGEERR: ${e.message.slice(0, 300)}`));
  const reqs = [];
  p.on('request', (r) => { if (/assets\/video\//.test(r.url())) reqs.push(r.url().replace(/.*assets\/video\//, '')); });
  try {
    await p.goto(base + sc.q, { waitUntil: 'load' });
    if (sc.world) await p.waitForFunction(() => document.body.classList.contains('world-live'), null, { timeout: 150000 }).catch(() => bad('world never went live'));
    await p.waitForTimeout(1500);
    if (sc.plain) { await p.keyboard.press('r'); await p.waitForTimeout(600); if (!(await p.evaluate(() => document.documentElement.classList.contains('is-plain')))) bad('R did not turn on Reviewer mode'); }
    res.classes = await p.evaluate(() => document.documentElement.className);
    // bring the portrait on screen (the tour may still be scrolling the camera: give it a moment)
    await p.evaluate(() => document.getElementById('portrait').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await p.waitForTimeout(1500);
    if (reqs.length) bad(`video fetched before any double-click: ${reqs.join(', ')}`);
    const center = () => p.evaluate(() => { const r = document.getElementById('portrait').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    const tap = async (x, y) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
      await p.waitForTimeout(40);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    // n quick clicks/taps ~110 ms apart (a double is two of these)
    const clicks = async (n, synth = false) => {
      // the software-rendered world makes every real input round trip take ~1 s, longer than the click windows:
      // there the 3/5-click runs are dispatched inside the page in one go (the double-click stays real input)
      if (synth) {
        await p.evaluate((n) => { const el = document.getElementById('portrait'); for (let i = 0; i < n; i++) el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: i + 1 })); }, n);
        return;
      }
      const [x, y] = await center();
      if (n === 2 && !sc.touch) { await p.mouse.dblclick(x, y); return; }
      for (let i = 0; i < n; i++) {
        if (sc.touch) await tap(x, y); else { await p.mouse.move(x, y); await p.mouse.down({ clickCount: i + 1 }); await p.mouse.up({ clickCount: i + 1 }); }
        if (i < n - 1) await p.waitForTimeout(70);
      }
    };
    const isOpen = () => p.evaluate(() => !!document.querySelector('.pflip'));
    const voxel = () => p.evaluate(() => document.getElementById('portrait').classList.contains('is-voxel'));

    // ---- 3 clicks: nothing
    await clicks(3, !!sc.world);
    await p.waitForTimeout(800);
    if (await isOpen()) bad('3 clicks opened the video');
    if (await voxel()) bad('3 clicks turned the portrait voxel');
    await p.waitForTimeout(1700); // let the 5-click window (1.5 s) lapse
    // ---- 5 clicks: the voxel egg, no video; 5 more: back to the photo
    await clicks(5, !!sc.world);
    await p.waitForTimeout(800);
    if (await isOpen()) bad('5 clicks opened the video');
    if (!(await voxel())) bad('5 clicks did not turn the portrait voxel');
    await p.waitForTimeout(1700);
    await clicks(5, !!sc.world);
    await p.waitForTimeout(800);
    if (await isOpen()) bad('5 more clicks opened the video');
    if (await voxel()) bad('5 more clicks did not turn the portrait back');
    await p.waitForTimeout(1700);
    if (reqs.length) bad(`video fetched by the 3/5-click runs: ${reqs.join(', ')}`);

    // ---- double-click: the card comes out
    const pr0 = await p.evaluate(() => { const r = document.getElementById('portrait').getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); });
    await clicks(2);
    await p.waitForFunction(() => document.querySelector('.pflip'), null, { timeout: 2000 }).catch(() => bad('double-click did not open the card'));
    // freeze the opening at 22% for a screenshot (the software GPU is too slow to catch it live)
    const anim = await p.evaluate(() => {
      const card = document.querySelector('.pflip__card');
      const as = document.querySelector('.pflip').getAnimations({ subtree: true });
      as.forEach((a) => { a.pause(); a.currentTime = a.effect.getTiming().duration * 0.22; });
      const kf = card.getAnimations()[0]?.effect.getKeyframes().map((k) => k.transform || `opacity ${k.opacity}`);
      return { n: as.length, kf, sel: getComputedStyle(document.getElementById('portrait')).visibility };
    });
    res.openKeyframes = anim.kf;
    if (sc.rm && anim.kf?.some((k) => /rotate|translate/.test(k))) bad('reduced motion still rotates/travels');
    if (!sc.rm && !anim.kf?.some((k) => /rotateY\(0deg\)/.test(k))) bad('no flip keyframes');
    if (anim.sel !== 'hidden') bad(`portrait not hidden while the card is out (${anim.sel})`);
    await p.waitForTimeout(150);
    await p.screenshot({ path: `${out}-${name}-flip.png` });
    await p.evaluate(() => document.querySelector('.pflip')?.getAnimations({ subtree: true }).forEach((a) => a.play()));
    // the software GPU is slow: wait for the opening to finish (focus moves to the close button at the end)
    await p.waitForFunction(() => !document.querySelector('.pflip__card')?.getAnimations().length && document.activeElement?.closest?.('.pflip'), null, { timeout: 4000 }).catch(() => {});
    const box = await p.evaluate(() => {
      const r = document.querySelector('.pflip__card').getBoundingClientRect();
      const v = document.querySelector('.pflip__video');
      return { r: [r.left, r.top, r.width, r.height].map(Math.round), W: document.documentElement.clientWidth, H: innerHeight, src: v.currentSrc.replace(/.*\//, ''), muted: v.muted, focus: document.activeElement?.className, label: v.getAttribute('aria-label'), desc: document.getElementById(v.getAttribute('aria-describedby'))?.textContent.length };
    });
    res.card = box; res.portraitBox = pr0;
    const [x, y, w, hh] = box.r;
    if (Math.abs(w - hh) > 2) bad(`card not square ${w}x${hh}`);
    if (x < 12 || y < 12 || x + w > box.W - 12 || y + hh > box.H - 12) bad(`card outside the 12px margins: ${box.r}`);
    if (w < Math.min(box.W * 0.92, box.H * 0.72, 480) - 4) bad(`card smaller than expected: ${w}`);
    if (!/pflip__close/.test(box.focus || '')) bad(`focus not on the close button (${box.focus})`);
    if (!box.label || !(box.desc > 100)) bad('video has no accessible name/description');
    // ---- playing
    const t0 = await p.evaluate(() => document.querySelector('.pflip__video').currentTime);
    await p.waitForFunction(() => document.querySelector('.pflip__video')?.currentTime > 3, null, { timeout: 20000 }).catch(() => bad('video did not reach 3 s'));
    const t1 = await p.evaluate(() => document.querySelector('.pflip__video')?.currentTime);
    res.times = [t0, t1].map((t) => +(+t).toFixed(2));
    await p.screenshot({ path: `${out}-${name}-play.png` });
    // the mute toggle flips video.muted and its aria-pressed, both ways
    const m0 = await p.evaluate(() => document.querySelector('.pflip__video').muted);
    for (let i = 0; i < 2; i++) {
      await p.evaluate(() => document.querySelector('.pflip__mute').click());
      const m = await p.evaluate(() => [document.querySelector('.pflip__video').muted, document.querySelector('.pflip__mute').getAttribute('aria-pressed')]);
      if (m[0] !== (i === 0 ? !m0 : m0) || m[1] !== String(m[0])) bad(`mute toggle ${i + 1}: ${m}`);
    }
    // ---- run to the end. python's http.server has no Range support, so Chromium cannot seek (it restarts at 0):
    // play the rest at 4x instead (set FULL=1 to watch it at normal speed)
    res.duration = await p.evaluate((full) => { const v = document.querySelector('.pflip__video'); if (!full) v.playbackRate = 4; return +v.duration.toFixed(2); }, !!process.env.FULL);
    await p.waitForFunction(() => document.querySelector('.pflip.is-out'), null, { timeout: 30000 }).catch(() => bad("no flip back after 'ended'"));
    if (!sc.rm) {
      await p.evaluate(() => document.querySelector('.pflip')?.getAnimations({ subtree: true }).forEach((a) => { a.pause(); a.currentTime = a.effect.getTiming().duration * 0.75; }));
      await p.waitForTimeout(150);
      await p.screenshot({ path: `${out}-${name}-back.png` });
      await p.evaluate(() => document.querySelector('.pflip')?.getAnimations({ subtree: true }).forEach((a) => a.play()));
    }
    await p.waitForFunction(() => !document.querySelector('.pflip'), null, { timeout: 4000 }).catch(() => bad('overlay not removed'));
    const after = await p.evaluate(async () => {
      const pt = document.getElementById('portrait');
      const eggs = await import('/assets/js/site/eggs.js');
      return { vis: getComputedStyle(pt).visibility, cls: pt.className, egg: eggs.has('secret'), focus: document.activeElement?.id };
    });
    res.after = after;
    if (after.vis !== 'visible') bad('portrait not visible again');
    if (!after.egg) bad("egg 'secret' not found");
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}-${name}-after.png` });

    // ---- open again, Esc closes early and does not leak
    await p.evaluate(() => { window.__escLeak = 0; document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.__escLeak++; }); });
    await p.waitForTimeout(600);
    await clicks(2);
    await p.waitForFunction(() => document.querySelector('.pflip__video')?.currentTime > 0.5, null, { timeout: 10000 }).catch(() => bad('second open did not play'));
    // keys other than Esc must not reach the page either (W would take the controls)
    await p.keyboard.press('w');
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('.pflip'), null, { timeout: 3000 }).catch(() => bad('Esc did not close'));
    const esc = await p.evaluate(() => ({ leak: window.__escLeak, play: document.documentElement.classList.contains('is-play'), vis: getComputedStyle(document.getElementById('portrait')).visibility }));
    if (esc.leak) bad('Escape leaked to document handlers');
    if (esc.play) bad('W entered play mode while the card was out');
    if (esc.vis !== 'visible') bad('portrait hidden after Esc');
    res.requests = [...new Set(reqs)];
    if (res.requests.some((r) => /mp4/.test(r))) res.notes.push('fetched mp4 (unexpected in this Chromium)');
  } catch (err) { bad(`crash: ${err.message.slice(0, 300)}`); }
  res.errors = errors;
  if (errors.length) bad(`${errors.length} console errors`);
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(report, null, 1));
