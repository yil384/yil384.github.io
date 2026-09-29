// render.mjs: renders studio.html in headless Chromium (Playwright) and encodes with ffmpeg.
//
//   Look at it (open the images with an image viewer / the Read tool):
//     node render.mjs --video=opening --sheet=0.5,1,1.5,2 [--cols=4] [--w=480] --out=out/check/a.jpg   contact sheet
//     node render.mjs --video=opening --strip=2.0:2.5 [--cols=6] [--w=320] --out=out/check/strip.jpg   every frame of a stretch
//     node render.mjs --video=opening --sheet=2.1,2.2 --crop=760,300,400,400 --w=600 --out=out/check/face.jpg   crops (world px)
//     node render.mjs --video=opening --stills=1.2,3.4 --out=out/stills                                 full-res PNGs
//   Make the video:
//     node render.mjs --video=opening --frames [--range=0:8] --workers=3       JPEG frames -> out/frames/<video> (parallel, resumable)
//     node render.mjs --video=opening --encode --out=../assets/video/opening   -> opening.mp4 (H.264) + opening.webm (VP9) + opening.jpg (poster)
//   Loops: add --loop=<name> to any of the above (times are loop times).
//   Flags: --fps=24 (must match PROJECT.fps), --scale=0.6667 overrides PROJECT.scale, --chromium=<path>.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const VIDEO_NAME = args.video || 'opening';
const fps = +(args.fps || 24);
const FRAMES_DIR = `out/frames/${VIDEO_NAME}`;
const HERE = dirname(new URL(import.meta.url).pathname);
function ffmpegPath() {
  if (args.ffmpeg) return args.ffmpeg;
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { return execFileSync('python3', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim(); } catch { return 'ffmpeg'; }
}
const run = (cmd, a) => new Promise((ok, bad) => { const p = spawn(cmd, a, { stdio: 'inherit' }); p.on('close', c => c ? bad(new Error(cmd + ' exited ' + c)) : ok()); });
const times = s => String(s).split(',').map(Number);
const span = s => String(s).split(':').map(Number);

if (args.encode) {
  const ff = ffmpegPath(), n = readdirSync(FRAMES_DIR).filter(f => f.endsWith('.jpg')).length;
  const out = args.out || `../assets/video/${VIDEO_NAME}`; mkdirSync(dirname(resolve(HERE, out)), { recursive: true });
  const base = resolve(HERE, out);
  console.log(`encoding ${n} frames from ${FRAMES_DIR} -> ${base}.mp4 / .webm / .jpg`);
  const input = ['-framerate', String(fps), '-i', `${FRAMES_DIR}/f%05d.jpg`];
  await run(ff, ['-y', '-loglevel', 'error', '-stats', ...input, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(args.crf || 20), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', `${base}.mp4`]);
  await run(ff, ['-y', '-loglevel', 'error', '-stats', ...input, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(args.vcrf || 33), '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', '-an', `${base}.webm`]);
  const poster = `${FRAMES_DIR}/f${String(Math.min(n - 1, Math.round(+(args.poster ?? 0.5) * fps))).padStart(5, '0')}.jpg`;
  copyFileSync(poster, `${base}.jpg`);
  for (const ext of ['mp4', 'webm', 'jpg']) console.log(`${base}.${ext}  ${(statSync(`${base}.${ext}`).size / 1024).toFixed(0)} KB`);
  process.exit(0);
}

// Software GL (SwiftShader) for WebGL, and a SOFTWARE 2D canvas: with the accelerated 2D canvas, p5.brush's watercolour
// fill masks make Chromium's GPU process slower with every fill until a frame takes tens of seconds (measured here:
// 4 fills/frame -> 60 ms for five frames, then 15-40 s). Software canvas 2D is a steady ~130 ms per fill.
const gpu = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas',
  ...(process.env.CHROME_EXTRA ? process.env.CHROME_EXTRA.split(' ') : [])];
const browser = await chromium.launch({ executablePath: args.chromium, args: [...gpu, '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
async function openPage(tag = '') {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/INVALID_OPERATION|GroupMarker/.test(m.text())) console.log(`[page${tag}]`, m.text().slice(0, 300)); });
  page.on('pageerror', e => console.log(`[page error${tag}]`, e.message));
  const url = pathToFileURL(resolve(HERE, 'studio.html')).href + `?render&video=${VIDEO_NAME}` + (args.loop ? `&loop=${args.loop}` : '') + (args.scale ? `&scale=${args.scale}` : '');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction('window.ready === true && window.videoLoaded === true', null, { timeout: 90000 });
  if (args.loop) {
    const ok = await page.evaluate(() => !!window.LOOP);
    if (!ok) { console.error(`no loop named "${args.loop}"`); process.exit(1); }
  }
  return page;
}
const frameOf = async (page, t, type, q) => {
  const url = await page.evaluate(({ t, type, q }) => window.renderAt(t, type, q), { t, type, q });
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
};
const lengthOf = page => page.evaluate(() => window.LOOP ? window.LOOP.len : DUR);

if (args.sheet || args.strip) {
  const page = await openPage(), out = resolve(HERE, args.out || 'out/sheet.jpg'); mkdirSync(dirname(out), { recursive: true });
  let ts;
  if (args.strip) { const [a, b] = span(args.strip); ts = []; for (let i = Math.round(a * fps); i <= Math.round(b * fps); i++) ts.push(i / fps); }
  else ts = times(args.sheet);
  const crop = args.crop ? times(args.crop) : null, at = args['crop-at'] ? times(args['crop-at']) : null;
  const { url, ms } = await page.evaluate(({ ts, c, w, crop, at }) => window.renderSheet(ts, c, w, crop, at), { ts, c: +(args.cols || (args.strip ? 6 : 3)), w: +(args.w || (args.strip ? 320 : 640)), crop, at });
  writeFileSync(out, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
  console.log(`${out}  (${ts.length} frames)  ms/frame: ${ms.join(' ')}`);
} else if (args.stills) {
  const page = await openPage(), out = resolve(HERE, args.out || 'out/stills'); mkdirSync(out, { recursive: true });
  console.log('GPU:', await page.evaluate(() => window.gpuInfo()));
  for (const s of times(args.stills)) {
    const t0 = Date.now(), buf = await frameOf(page, s, 'image/png');
    const f = `${out}/${VIDEO_NAME}_t${s.toFixed(2).replace('.', '_')}.png`; writeFileSync(f, buf);
    console.log(`${f}  ${Date.now() - t0} ms`);
  }
} else if (args.frames) {
  const probe = await openPage(), len = await lengthOf(probe), info = await probe.evaluate(() => window.projectInfo()); await probe.close();
  if (info.fps && info.fps !== fps) console.warn(`PROJECT.fps=${info.fps} but rendering at ${fps}`);
  const [a, b] = args.range ? span(args.range) : [0, len], workers = +(args.workers || 3);
  const dir = resolve(HERE, FRAMES_DIR); mkdirSync(dir, { recursive: true });
  const first = Math.round(a * fps), last = Math.min(Math.ceil(len * fps) - 1, Math.round(b * fps) - 1);
  const todo = []; for (let i = first; i <= last; i++) { const f = `${dir}/f${String(i).padStart(5, '0')}.jpg`; if (!existsSync(f) || statSync(f).size < 1000) todo.push(i); }
  console.log(`${VIDEO_NAME}: ${todo.length} frames to render (${last - first + 1 - todo.length} already done), ${workers} workers, ${len}s @ ${fps}fps, ${info.CW}x${info.CH}`);
  let next = 0, done = 0; const start = Date.now();
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const page = await openPage('#' + w);
    while (next < todo.length) {
      const i = todo[next++], f = `${dir}/f${String(i).padStart(5, '0')}.jpg`;
      const buf = await frameOf(page, i / fps, 'image/jpeg', .93);
      writeFileSync(f + '.tmp', buf); renameSync(f + '.tmp', f);
      if (++done % 24 === 0 || done === todo.length) {
        const el = (Date.now() - start) / 1000;
        console.log(`frame ${done}/${todo.length}  ${(el / done * 1000).toFixed(0)} ms/frame effective  eta ${((todo.length - done) * el / done / 60).toFixed(1)} min`);
      }
    }
  }));
} else {
  console.log('nothing to do: see the usage notes at the top of render.mjs');
}
await browser.close();
