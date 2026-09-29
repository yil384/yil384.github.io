// Static-shell QA for the SORTIE page.   node tools/qa/site-check.mjs [--base=http://localhost:8000] [--quick]
// Loads / and /?force=1 at 1440x900 and 390x844 (plus reduced-motion and no-JS passes), and fails on:
//   console errors, page errors, failed requests that are not an allowed missing asset, horizontal overflow at 390,
//   a <video> without poster + mp4 source (or with autoplay), a poster/source that must exist but is not on disk.
// Also checks the nav burger, the section observer, the session rule for the opening film, reduced motion and no-JS.
// Screenshots go to tools/qa/out/ (git-ignored). Serve the repo root first: python3 -m http.server 8000
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'tools/qa/out');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const BASE = (args.base || 'http://localhost:8000').replace(/\/$/, '');
fs.mkdirSync(OUT, { recursive: true });

// Media that must be on disk. Every other file under assets/video is allowed to be absent (and is listed).
const REQUIRED = new Set(['assets/video/catapult.jpg', 'assets/video/catapult.mp4']);
const onDisk = (rel) => fs.existsSync(path.join(ROOT, rel));

const failures = []; const warnings = []; const missing = new Set(); const notes = [];
const fail = (where, msg) => failures.push(`[${where}] ${msg}`);
const warn = (where, msg) => warnings.push(`[${where}] ${msg}`);

const launchArgs = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: launchArgs });

const rel = (url) => { try { const u = new URL(url); return u.origin === BASE ? decodeURIComponent(u.pathname.replace(/^\//, '')) : url; } catch { return url; } };

async function run(label, { url, w, h, reduced = false, js = true, director = true }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: reduced ? 'reduce' : 'no-preference', javaScriptEnabled: js });
  const page = await ctx.newPage();
  const errors = []; const bad = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource/.test(m.text())) return; // classified below from the response log
    errors.push(m.text().slice(0, 240));
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 240)));
  page.on('response', (r) => { if (r.status() >= 400) bad.push({ url: r.url(), status: r.status() }); });
  page.on('requestfailed', (r) => { if (!/net::ERR_ABORTED/.test(r.failure()?.errorText || '')) bad.push({ url: r.url(), status: r.failure()?.errorText }); });

  await page.goto(`${BASE}${url}`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  if (js && director) {
    const hasSite = await page.evaluate(() => !!window.__site);
    if (hasSite) {
      const t = await page.evaluate(() => window.__site.tier);
      if (t > 0) await page.waitForFunction(() => window.__site.director || document.documentElement.dataset.director === 'off', null, { timeout: 60000 }).catch(() => warn(label, 'director did not mount within 60 s'));
    }
  }
  // free the compositor (SwiftShader frames are slow) before screenshots and layout reads
  await page.evaluate(() => { try { window.__site && window.__site.director && window.__site.director.pause(); } catch { /* none */ } });

  const info = await page.evaluate(() => {
    const d = document.documentElement;
    const videos = [...document.querySelectorAll('video')].map((v) => ({
      id: v.id, poster: v.getAttribute('poster'), sources: [...v.querySelectorAll('source')].map((s) => ({ src: s.getAttribute('src'), type: s.getAttribute('type') })),
      muted: v.hasAttribute('muted'), playsinline: v.hasAttribute('playsinline'), loop: v.hasAttribute('loop'), autoplay: v.hasAttribute('autoplay'),
      preload: v.getAttribute('preload'), w: v.getAttribute('width'), h: v.getAttribute('height'), label: v.getAttribute('aria-label'), playing: !v.paused,
    }));
    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
    const dupIds = ids.filter((x, i) => ids.indexOf(x) !== i);
    const noAlt = [...document.querySelectorAll('img:not([alt])')].length;
    const blank = [...document.querySelectorAll('a[target="_blank"]:not([rel~="noopener"])')].length;
    const h1 = document.querySelector('h1');
    const cs = h1 && getComputedStyle(h1.querySelector('.hero__ink') || h1);
    return {
      overflowX: d.scrollWidth - innerWidth, tier: d.dataset.tier, title: d.dataset.title, opening: d.dataset.opening, director: d.dataset.director,
      site: window.__site ? { tier: window.__site.tier, why: window.__site.why, backend: window.__site.backend, opening: window.__site.opening, reason: window.__site.openingReason, section: window.__site.section } : null,
      tel: document.getElementById('hud-tel')?.textContent, station: document.getElementById('hud-station')?.textContent,
      videos, dupIds, noAlt, blank, sections: [...document.querySelectorAll('section[data-scene][data-s]')].map((s) => `${s.dataset.s}:${s.id}:${s.dataset.scene}`),
      h1Text: h1 && h1.textContent.replace(/\s+/g, ' ').trim(), h1Opacity: cs && cs.opacity,
      skipTarget: !!document.querySelector(document.querySelector('.skip')?.getAttribute('href') || '#none'),
    };
  });
  notes.push(`${label}: tier=${info.tier} (${info.site?.why ?? 'no js'}) opening=${info.opening ?? '-'}${info.site?.reason ? '/' + info.site.reason : ''} director=${info.director ?? '-'} tel="${info.tel}" station="${info.station}"`);

  for (const e of errors) fail(label, 'console/page error: ' + e);
  for (const b of bad) {
    const r = rel(b.url);
    const allowedAbsent = (r.startsWith('assets/video/') || r === 'assets/js/director/director.js') && !onDisk(r) && !REQUIRED.has(r);
    if (allowedAbsent) missing.add(r);
    else fail(label, `request failed: ${b.status} ${r}`);
  }
  if (w <= 420 && info.overflowX > 0) fail(label, `horizontal overflow at ${w}px: ${info.overflowX}px`);
  if (info.dupIds.length) fail(label, 'duplicate ids: ' + info.dupIds.join(', '));
  if (info.noAlt) fail(label, `${info.noAlt} <img> without alt`);
  if (info.blank) fail(label, `${info.blank} target=_blank links without rel=noopener`);
  if (!info.skipTarget) fail(label, 'skip link target missing');
  if (info.sections.join() !== '0:top:hangar,1:about:hangar,2:publications:catapult,3:experience:ops,4:projects:armory,5:island:island,6:contact:comms') fail(label, 'unexpected section map: ' + info.sections.join(' '));
  if (!/yichen lin/i.test(info.h1Text || '')) fail(label, 'h1 text missing');
  for (const v of info.videos) {
    const at = `${label} video#${v.id}`;
    if (!v.poster) fail(at, 'no poster');
    if (!v.sources.some((s) => s.type === 'video/mp4' && s.src)) fail(at, 'no video/mp4 source');
    if (v.autoplay) fail(at, 'has autoplay attribute');
    if (!v.muted || !v.playsinline) fail(at, 'must be muted + playsinline');
    if (v.w !== '1280' || v.h !== '720') fail(at, `width/height must be 1280x720 (got ${v.w}x${v.h})`);
    if (!v.label) fail(at, 'no aria-label');
    const wantsLoop = v.id !== 'sortie';
    if (v.loop !== wantsLoop) fail(at, wantsLoop ? 'missing loop' : 'V1 must not loop');
    // loop panels ship preload="none"; page.js may raise it to "metadata" just before a panel arrives (T1/T2)
    if (v.id === 'sortie' ? v.preload !== 'metadata' : !['none', 'metadata'].includes(v.preload)) fail(at, `preload="${v.preload}"`);
    for (const f of [v.poster, ...v.sources.map((s) => s.src)].filter(Boolean)) {
      if (onDisk(f)) continue;
      if (REQUIRED.has(f)) fail(at, `required file missing on disk: ${f}`); else missing.add(f);
    }
    if (reduced && v.playing) fail(at, 'playing under reduced motion');
  }
  return { page, ctx, info };
}

// Software GL caps a raster tile at 8192 px, so a single full-page capture of a tall mobile page wraps around at the bottom.
// Pages taller than 8000 px are written as name.png (top) + name-p2.png, ... in 6000 px chunks instead.
const shot = async (page, name) => {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  if (height <= 8000) { await page.screenshot({ path: path.join(OUT, name), fullPage: true }); return; }
  const width = await page.evaluate(() => innerWidth);
  for (let y = 0, i = 1; y < height; y += 6000, i++) {
    await page.screenshot({ path: path.join(OUT, i === 1 ? name : name.replace('.png', `-p${i}.png`)), fullPage: true, clip: { x: 0, y, width, height: Math.min(6000, height - y) } });
  }
};

/* ---- main passes: both URLs at both viewports ---- */
const passes = [];
for (const [w, h] of [[1440, 900], [390, 844]]) {
  for (const [tag, url] of [['force', '/?force=1'], ['plain', '/']]) {
    const label = `${tag}@${w}`;
    const { page, ctx, info } = await run(label, { url, w, h });
    passes.push({ label, info });
    // section observer: every station becomes current when scrolled to
    for (const id of ['about', 'publications', 'experience', 'projects', 'island', 'contact', 'top']) {
      await page.evaluate((i) => document.getElementById(i).scrollIntoView({ behavior: 'instant' }), id);
      await page.waitForFunction((i) => window.__site && window.__site.section === i, id, { timeout: 12000 }).catch(async () => {
        fail(label, `section observer: scrolled to #${id}, __site.section = ${await page.evaluate(() => window.__site && window.__site.section)}`);
      });
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, `site-${tag}-${w}.png`);
    if (w === 390 && tag === 'plain') {
      // burger: expanded state, tap target size, closes on link click
      const b = page.locator('#nav-burger');
      const box = await b.boundingBox();
      if (!box || box.width < 44 || box.height < 44) fail(label, `burger tap target ${box && Math.round(box.width)}x${box && Math.round(box.height)} < 44`);
      await b.click();
      if ((await b.getAttribute('aria-expanded')) !== 'true') fail(label, 'burger did not expand');
      if (!(await page.locator('#nav-links a[href="#about"]').isVisible())) fail(label, 'nav links hidden after opening burger');
      await page.screenshot({ path: path.join(OUT, 'site-menu-390.png') });
      await page.locator('#nav-links a[href="#about"]').click();
      if ((await b.getAttribute('aria-expanded')) !== 'false') fail(label, 'burger did not close on link click');
      // tap targets on mobile: every visible link/button that is not inline prose
      const small = await page.evaluate(() => [...document.querySelectorAll('a, button')].filter((e) => {
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height || e.closest('.prose, .foot__text, .hero__role, .lede') || e.classList.contains('skip')) return false;
        return r.height < 43.5 || r.width < 43.5;
      }).map((e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${(e.className || '').toString().split(' ')[0]} "${(e.textContent || '').trim().slice(0, 24)}" ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
      for (const s of small) warn(label, 'small tap target: ' + s);
    }
    await ctx.close();
  }
}

/* ---- session rule: first visit plays (or opens by itself), later visits show the replay pill ---- */
{
  const label = 'session@1440';
  const { page, ctx, info } = await run(label, { url: '/?force=1&tier=1', w: 1440, h: 900, director: false });
  if (!['playing', 'done'].includes(info.site?.opening)) fail(label, `first visit should start or finish the opening, got ${info.site?.opening}`);
  if (info.videos.find((v) => v.id === 'sortie') && !onDisk('assets/video/sortie.mp4')) {
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => ({ o: window.__site.opening, title: document.documentElement.dataset.title }));
    if (st.o !== 'done' || st.title === 'wait') fail(label, `sortie.mp4 missing: the page must open by itself, got opening=${st.o} title=${st.title}`);
  }
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);
  const again = await page.evaluate(() => ({ o: window.__site.opening, title: document.documentElement.dataset.title, flag: sessionStorage.getItem('sortie') }));
  if (again.flag !== '1') fail(label, 'sessionStorage.sortie not set after the first visit');
  if (again.o !== 'idle' || again.title !== 'done') fail(label, `second visit should be idle with the copy visible, got ${JSON.stringify(again)}`);
  await ctx.close();
}

/* ---- reduced motion: posters only, copy visible at once, nothing plays ---- */
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const label = `reduced@${w}`;
  const { page, ctx, info } = await run(label, { url: '/?force=1', w, h, reduced: true });
  if (info.tier !== '0') fail(label, `reduced motion must land on tier 0, got ${info.tier}`);
  if (info.title !== 'done') fail(label, `title state should be done, got ${info.title}`);
  if (info.h1Opacity !== '1') fail(label, `name not visible (opacity ${info.h1Opacity})`);
  const anim = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
  if (anim) fail(label, `${anim} animations running under reduced motion`);
  await shot(page, `site-reduced-${w}.png`);
  await ctx.close();
}

/* ---- no JS: the page is complete and readable ---- */
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const label = `nojs@${w}`;
  const { page, ctx, info } = await run(label, { url: '/', w, h, js: false, director: false });
  if (info.h1Opacity !== '1') fail(label, `name not visible without JS (opacity ${info.h1Opacity})`);
  const hidden = await page.evaluate(() => ['#about', '#publications', '#experience', '#projects', '#contact'].filter((s) => !document.querySelector(s + ' .st__title')?.offsetParent));
  if (hidden.length) fail(label, 'stations not rendered without JS: ' + hidden.join(', '));
  const navVisible = await page.locator('#nav-links a[href="#contact"]').isVisible();
  if (!navVisible) fail(label, 'nav links not visible without JS');
  await shot(page, `site-nojs-${w}.png`);
  await ctx.close();
}

await browser.close();

/* ---- summary ---- */
console.log('\n=== site-check summary ===');
for (const n of notes) console.log('  ' + n);
if (missing.size) console.log('\nAllowed-but-absent assets (produce them before launch):\n  ' + [...missing].sort().join('\n  '));
if (warnings.length) console.log('\nWarnings (' + warnings.length + '):\n  ' + [...new Set(warnings)].join('\n  '));
console.log(`\nScreenshots: ${path.relative(ROOT, OUT)}/site-*.png`);
if (failures.length) { console.log('\nFAIL (' + failures.length + '):\n  ' + [...new Set(failures)].join('\n  ')); process.exit(1); }
console.log('\nPASS');
