// Cold first-load jank probe: node coldload.mjs [desk|phone] [throttle=1] [runs=1] [extraQuery] [port=8000]
// Each run uses a fresh browser context with the HTTP cache disabled (a first visit), optional CPU throttling
// (CDP Emulation.setCPUThrottlingRate: 4 or 6 mimic phones), and scrolls the page while the world downloads,
// builds and starts. It records, from navigation start until 10 s after the world is live (one JSON line per run):
//   lfBlock / lfTotal / lfLongest / lf50 / lf100: long animation frames (LoAF, > 50 ms between two paints: the jank
//     a reader sees); lfBlock sums their blockingDuration (main-thread time past 50 ms per task)
//   preLf*: the same, before the world went live
//   ltTotal / ltLongest / lt50: long tasks (the longtask API; Chrome leaves scheduler.yield() continuations out, so
//     these undercount)
//   tScroll: end of the last > 100 ms frame not followed by 3 s without one ("time to smooth scrolling")
//   tLive: body.world-live (the first world frame is drawn; the poster crossfades)
// then the world build phases (performance.mark / measure 'yl:*' from game3d/index.js: end time, +wall time, the
// longest long task inside) and the longest frames up to 1 s after tLive with the scripts that ran in them. A rAF
// loop runs in the page (as a live page would) and its gaps / scroll-to-frame delays are kept in the raw data.
// The median of all runs closes the output when runs > 1.
// OUT=<label> saves the raw entries to /tmp/yl/coldload-<label>-<kind>-x<throttle>-<run>.json.
// Add perf=1&norender=1 to the query to stop drawing after the first frame (SwiftShader frames take seconds and
// would otherwise swamp everything after tLive); pre* fields cover only the time before the world went live.
// WEBGPU=1 runs the WebGPU backend (SwiftShader Vulkan + the test-only ?shim=swizzle); the default is WebGL2, as
// headless Chromium has no WebGPU adapter otherwise. Phones always get WebGL2 (index.js).
// PROFILE=1 adds a CDP sampling CPU profile and prints the self time inside long tasks per script / function
// (the profiler adds overhead: compare numbers only between runs with the same setting).
// The test GPU is SwiftShader: always pass force=1 (added here); judge main-thread CPU work, not fps.
// Serve the repo first (python3 -m http.server 8000). Examples:
//   node tools/dev/coldload.mjs desk 4 2 "dpr=0.5&perf=1&norender=1"
//   WEBGPU=1 node tools/dev/coldload.mjs desk 1 2 "dpr=0.5"      node tools/dev/coldload.mjs phone 4 2 "dpr=0.5"
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const [,, kind = 'desk', thr = '1', runsArg = '1', extra = '', port = '8000'] = process.argv;
const PROFILE = process.env.PROFILE === '1';
const WEBGPU = process.env.WEBGPU === '1';
const phone = kind === 'phone';
const throttle = Number(thr) || 1;
const runs = Number(runsArg) || 1;

function initProbe() {
  const R = { lt: [], loaf: [], gaps: [], marks: {}, live: 0, scrollLat: [] };
  window.__cold = R;
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) R.lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
  } catch { /* no longtask */ }
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        R.loaf.push({ t: e.startTime, d: e.duration, block: e.blockingDuration, render: e.renderStart ? e.startTime + e.duration - e.renderStart : 0,
          scripts: (e.scripts || []).map((s) => ({ d: s.duration, src: (s.sourceURL || '').replace(/^.*\/assets\//, ''), fn: s.sourceFunctionName, inv: s.invoker, type: s.invokerType, style: s.forcedStyleAndLayoutDuration })) });
      }
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch { /* no LoAF */ }
  new MutationObserver(() => { if (!R.live && document.body?.classList.contains('world-live')) R.live = performance.now(); })
    .observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
  let last = 0;
  const raf = (t) => { if (last && t - last > 50) R.gaps.push([last, t - last]); last = t; requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  // scroll-to-next-frame latency: the time from a scroll event to the next animation frame
  addEventListener('scroll', () => { const a = performance.now(); requestAnimationFrame(() => R.scrollLat.push(performance.now() - a)); }, { passive: true });
}

function summarize(R, horizon) {
  // long frames (LoAF, > 50 ms between two paints) are the jank a reader sees; long tasks (the longtask API) are
  // reported too, but Chrome does not report scheduler.yield() continuations there, so they undercount
  const stats = (list) => ({ total: Math.round(list.reduce((a, [, d]) => a + d, 0)), longest: Math.round(list.reduce((a, [, d]) => Math.max(a, d), 0)), n: list.length, n100: list.filter(([, d]) => d > 100).length });
  const lf = R.loaf.map((l) => [l.t, l.d]).filter(([st]) => st < horizon);
  const lt = R.lt.filter(([st]) => st < horizon);
  const pre = (list) => list.filter(([st]) => !R.live || st < R.live);
  // tScroll: the end of the last long frame (> 100 ms) that is not followed by 3 s without one
  let tScroll = 0;
  const big = lf.filter(([, d]) => d > 100).map(([st, d]) => [st, st + d]).sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < big.length; i++) {
    tScroll = big[i][1];
    const next = big[i + 1];
    if (!next || next[0] - tScroll >= 3000) break;
  }
  const a = stats(lf), b = stats(pre(lf)), c = stats(lt);
  const block = R.loaf.filter((l) => l.t < horizon).reduce((x, l) => x + (l.block || 0), 0);
  return {
    lfBlock: Math.round(block), lfTotal: a.total, lfLongest: a.longest, lf50: a.n, lf100: a.n100,
    preLfTotal: b.total, preLfLongest: b.longest, preLf50: b.n,
    ltTotal: c.total, ltLongest: c.longest, lt50: c.n,
    tScroll: Math.round(tScroll), tLive: Math.round(R.live),
  };
}

// node coldload.mjs --summarize <raw.json>... : re-summarize saved runs (OUT=...) with the current metrics
if (kind === '--summarize') {
  const fs = await import('node:fs');
  for (const f of process.argv.slice(3)) {
    const R = JSON.parse(fs.readFileSync(f, 'utf8'));
    console.log(f.replace(/^.*coldload-/, ''), JSON.stringify(summarize(R, (R.live || 60000) + 10000)));
  }
  process.exit(0);
}
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    ...(WEBGPU ? ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader'] : [])],
});

const all = [];
for (let run = 0; run < runs; run++) {
  const ctx = await browser.newContext(phone
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36' }
    : { viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  if (PROFILE) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
  await page.addInitScript(initProbe);
  const url = `http://localhost:${port}/?force=1${WEBGPU ? '&shim=swizzle' : ''}${extra ? `&${extra}` : ''}`;
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'commit' });
  // scroll during load: a reader flicking down the page, then back up (instant steps, 120 ms apart)
  const scroller = (async () => {
    await page.waitForTimeout(600);
    for (let i = 0; i < 120 && Date.now() - t0 < 60000; i++) {
      const dy = i % 60 < 30 ? 90 : -90;
      if (phone) await page.mouse.wheel(0, dy).catch(() => {}); else await page.mouse.wheel(0, dy).catch(() => {});
      await page.waitForTimeout(120);
    }
  })();
  await page.waitForFunction(() => window.__cold?.live > 0, null, { timeout: 180000, polling: 250 }).catch(() => errs.push('world never went live'));
  await page.waitForTimeout(10000);
  await scroller;
  const R = await page.evaluate(() => {
    const marks = {};
    for (const m of performance.getEntriesByType('mark')) if (m.name.startsWith('yl:')) marks[m.name.slice(3)] = Math.round(m.startTime);
    const measures = {};
    for (const m of performance.getEntriesByType('measure')) if (m.name.startsWith('yl:')) measures[m.name.slice(3)] = Math.round(m.duration);
    return { ...window.__cold, marks, measures };
  });
  const horizon = (R.live || 60000) + 10000;
  if (process.env.OUT) {
    const fs = await import('node:fs');
    fs.mkdirSync('/tmp/yl', { recursive: true });
    fs.writeFileSync(`/tmp/yl/coldload-${process.env.OUT}-${kind}-x${throttle}-${run + 1}.json`, JSON.stringify(R));
  }
  const s = summarize(R, horizon);
  all.push(s);
  console.log(`\n[${kind} x${throttle} run ${run + 1}] ${JSON.stringify(s)}`);
  if (Object.keys(R.marks).length) {
    // each build phase: when it ended, and the longest task inside it
    const ms = Object.entries(R.marks).sort((a, b) => a[1] - b[1]);
    console.log('  phases', ms.map(([k, t], i) => {
      const from = i ? ms[i - 1][1] : 0;
      const worst = R.lt.filter(([st, d]) => st < t && st + d > from).reduce((a, [, d]) => Math.max(a, d), 0);
      return `${k}@${t}${i ? `(+${t - from}, task ${Math.round(worst)})` : ''}`;
    }).join(' '));
  }
  if (Object.keys(R.measures).length) console.log('measures', JSON.stringify(R.measures));
  // the longest frames before the world went live (+ the first second after), with the scripts that ran in them
  const lfs = R.loaf.filter((l) => l.t < (R.live || horizon) + 1000).sort((a, b) => b.d - a.d).slice(0, 14);
  for (const l of lfs.sort((a, b) => a.t - b.t)) {
    const sc = l.scripts.filter((x) => x.d > 8).sort((a, b) => b.d - a.d).slice(0, 4).map((x) => `${x.src.replace(/^https?:\/\/[^/]+\//, '')}:${x.fn || x.inv}(${Math.round(x.d)}${x.style > 5 ? `,layout ${Math.round(x.style)}` : ''})`).join(' ');
    console.log(`  frame @${Math.round(l.t)} ${Math.round(l.d)} ms (render ${Math.round(l.render)}) ${sc}`);
  }
  if (PROFILE) {
    const { profile } = await cdp.send('Profiler.stop');
    // map samples to wall time (profile times are in us since an arbitrary origin; align on the first sample ~ navigation)
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const navStart = await page.evaluate(() => performance.timeOrigin);
    const startUs = profile.startTime;
    // performance.timeOrigin is wall ms; profiler time is monotonic us: align using a probe sample
    const nowPerf = await page.evaluate(() => performance.now());
    void navStart; void nowPerf;
    const self = new Map();
    let t = startUs;
    const ltAbs = [...R.lt, ...R.loaf.map((l) => [l.t, l.d])];
    const offset = profile.endTime / 1000 - nowPerf;   // monotonic ms at perf time 0 (approx.)
    for (let i = 0; i < profile.samples.length; i++) {
      t += profile.timeDeltas[i];
      const pt = t / 1000 - offset;
      if (!ltAbs.some(([st, d]) => pt >= st && pt <= st + d)) continue;
      const n = byId.get(profile.samples[i]);
      const cf = n.callFrame;
      const k = cf.url ? `${cf.url.replace(/^.*\/assets\//, '')} ${cf.functionName || '(anon)'}:${cf.lineNumber + 1}` : `(${cf.functionName || 'native'})`;
      self.set(k, (self.get(k) || 0) + (profile.timeDeltas[i + 1] ?? 500) / 1000);
    }
    const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
    console.log('  self time inside long tasks / long frames (ms):');
    for (const [k, v] of top) console.log(`    ${v.toFixed(0).padStart(6)}  ${k}`);
    // and by file
    const byFile = new Map();
    for (const [k, v] of self) { const f = k.split(' ')[0]; byFile.set(f, (byFile.get(f) || 0) + v); }
    console.log('  by file:', [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([f, v]) => `${f} ${v.toFixed(0)}`).join(' | '));
  }
  console.log(errs.length ? `  errors: ${errs.slice(0, 5).join(' || ')}` : '  no console errors');
  await ctx.close();
}
if (runs > 1) {
  const keys = Object.keys(all[0]);
  const med = {};
  for (const k of keys) { const v = all.map((x) => x[k]).filter((x) => x != null).sort((a, b) => a - b); med[k] = v[v.length >> 1]; }
  console.log(`\n[${kind} x${throttle} median of ${runs}] ${JSON.stringify(med)}`);
}
await browser.close();
