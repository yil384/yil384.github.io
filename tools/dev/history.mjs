// Screenshots of past versions of the site for the README's history section (docs/history/).
// Each commit is served straight from git objects (nothing is checked out), opened in Chromium at 1440x900 and
// saved as a 1000 px WebP. The phone number is blurred (screenshots stay in git history for good).
//   node tools/dev/history.mjs <outdir> <sha>:<name>[:option...] ...
// options: enter (press Enter past a title screen), wait=<ms> (default 4000), scroll=<px>,
//          introAt=<s> (an opening-animation frame: ?intro=1&introAt=<s>)
// e.g. node tools/dev/history.mjs docs/history 725582b:2025-10-23-725582b 27d9288:2026-09-30-27d9288:wait=9000
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', ico: 'image/x-icon', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', mp4: 'video/mp4', webm: 'video/webm', wasm: 'application/wasm' };

/** A static server for one commit, on a free port. */
function serve(sha) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
    if (p === '' || p.endsWith('/')) p += 'index.html';
    try {
      const buf = execFileSync('git', ['-C', REPO, 'cat-file', 'blob', `${sha}:${p}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
      res.writeHead(200, { 'Content-Type': TYPES[p.split('.').pop().toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    } catch { res.writeHead(404); res.end(); }
  });
  return new Promise((r) => srv.listen(0, () => r(srv)));
}

// blur the old phone number wherever it appears as text
const redact = () => {
  const RX = /\(?858\)?[\s.-]*319[\s.-]*7361/;
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const hits = [];
  for (let n = walk.nextNode(); n; n = walk.nextNode()) if (RX.test(n.data)) hits.push(n);
  for (const n of hits) {
    const m = RX.exec(n.data), r = document.createRange();
    r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
    const s = document.createElement('span');
    s.style.filter = 'blur(5px)';
    r.surroundContents(s);
  }
  return hits.length;
};

const [outDir, ...specs] = process.argv.slice(2);
if (!outDir || !specs.length) { console.error('usage: node tools/dev/history.mjs <outdir> <sha>:<name>[:option...] ...'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
for (const spec of specs) {
  const [sha, name, ...opts] = spec.split(':');
  const o = Object.fromEntries(opts.map((x) => x.split('=')).map(([k, v]) => [k, v ?? true]));
  const srv = await serve(sha);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('rpg_tutorial_done', 'true'); } catch { /* 2D versions: no tutorial */ } });
  const page = await ctx.newPage();
  const q = o.introAt ? `?intro=1&introAt=${o.introAt}` : '?intro=0';
  await page.goto(`http://localhost:${srv.address().port}/${q}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  if (o.introAt) {
    await page.waitForFunction((a) => window.__intro && (window.__intro.phase === 'over' || window.__intro.t >= a - 0.01), +o.introAt, { timeout: 60000, polling: 100 });
    await page.waitForTimeout(400);
  } else {
    if (o.enter) { await page.waitForTimeout(800); await page.keyboard.press('Enter'); }
    await page.waitForTimeout(+(o.wait || 4000));
    if (o.scroll) { await page.mouse.wheel(0, +o.scroll); await page.waitForTimeout(5000); }
  }
  const blurred = await page.evaluate(redact);
  if (blurred) await page.waitForTimeout(100);
  const png = await page.screenshot();
  // downscale and encode in the browser (no image tooling needed)
  const webp = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 1000; c.height = Math.round(img.height * 1000 / img.width);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/webp', 0.8).split(',')[1];
  }, png.toString('base64'));
  const file = path.join(outDir, `${name}.webp`);
  fs.writeFileSync(file, Buffer.from(webp, 'base64'));
  console.log(file, `${Math.round(fs.statSync(file).size / 1024)} KB`, blurred ? `(${blurred} phone number${blurred > 1 ? 's' : ''} blurred)` : '');
  await ctx.close();
  srv.close();
}
await browser.close();
