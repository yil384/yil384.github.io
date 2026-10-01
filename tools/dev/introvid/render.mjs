// Offline render of the portrait-flip intro video (assets/video/intro.mp4 + intro.webm + intro-poster.jpg) from the
// user's clip (tools/dev/introvid/source.mp4): extracts the source frames, serves the repo on :8123, renders every
// output frame in Chromium (three.js comic shader + virtual camera, q5 overlays; see index.html), builds the audio
// and encodes. Self-contained: needs only ffmpeg, Playwright and the bundled Chromium.
// usage (from anywhere):
//   node tools/dev/introvid/render.mjs                    full render + encode into assets/video/ + QA sheets
//   node tools/dev/introvid/render.mjs --from 5 --to 8 --step 6    partial render (seconds, every 6th frame), no encode
//   node tools/dev/introvid/render.mjs --shots 1.5,3.5,6.5         single frames -> /tmp/yl/introvid/qa/t_<s>.png (+ _340)
//   node tools/dev/introvid/render.mjs --serve                     only serve on :8123 (open /tools/dev/introvid/?t=6.5)
//   --no-encode (render frames only), --encode-only (reuse /tmp/yl/introvid/out), --vbr <kbps> (video bitrate, 1250)
import http from 'http';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const ROOT = path.resolve(new URL('../../../', import.meta.url).pathname);
const DIR = path.join(ROOT, 'tools/dev/introvid');
const WORK = '/tmp/yl/introvid';
const SRC = path.join(WORK, 'src');
const OUT = path.join(WORK, 'out');
const QA = path.join(WORK, 'qa');
const VIDEO = path.join(ROOT, 'assets/video');
const PORT = 8123;
const FPS = 24;
const FRAMES = 336;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

for (const d of [SRC, OUT, QA]) fs.mkdirSync(d, { recursive: true });
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });

// 1. source frames (once)
if (!fs.existsSync(path.join(SRC, '0240.jpg'))) {
  console.log('extracting source frames...');
  ff(['-i', path.join(DIR, 'source.mp4'), '-q:v', '1', '-qmin', '1', path.join(SRC, '%04d.jpg')]);
}

// 2. static server: the repo + the extracted frames
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let file;
  if (p.startsWith('/__introvid_src/')) file = path.join(SRC, path.basename(p));
  else { if (p.endsWith('/')) p += 'index.html'; file = path.join(ROOT, path.normalize(p)); }
  if (!file.startsWith(ROOT) && !file.startsWith(SRC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(PORT, r));
console.log(`serving ${ROOT} on http://localhost:${PORT}/tools/dev/introvid/`);
if (flag('--serve')) await new Promise(() => {});

async function withPage(fn) {
  const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const p = await (await b.newContext({ viewport: { width: 1500, height: 800 }, deviceScaleFactor: 1 })).newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(`http://localhost:${PORT}/tools/dev/introvid/`);
    await p.evaluate(() => window.ready);
    await fn(p);
    if (errors.length) console.log('page errors:', errors.slice(0, 5));
  } finally { await b.close(); }
}
const savePng = (dataUrl, file) => fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
const pad = (i) => String(i).padStart(4, '0');

// 3. render
const shots = opt('--shots');
if (shots) {
  await withPage(async (p) => {
    for (const s of shots.split(',')) {
      const i = Math.min(FRAMES - 1, Math.round(parseFloat(s) * FPS));
      const f = path.join(QA, `t_${s}.png`);
      savePng(await p.evaluate((k) => window.renderFrame(k), i), f);
      ff(['-i', f, '-vf', 'scale=340:340:flags=lanczos', path.join(QA, `t_${s}_340.png`)]);
      console.log('wrote', f);
    }
  });
  server.close();
  process.exit(0);
}

const encodeOnly = flag('--encode-only');
const from = Math.max(0, Math.round(parseFloat(opt('--from', '0')) * FPS));
const to = Math.min(FRAMES, Math.round(parseFloat(opt('--to', String(FRAMES / FPS))) * FPS));
const step = parseInt(opt('--step', '1'), 10);
const partial = from > 0 || to < FRAMES || step > 1;
if (!encodeOnly) {
  const t0 = Date.now();
  await withPage(async (p) => {
    for (let i = from; i < to; i += step) {
      savePng(await p.evaluate((k) => window.renderFrame(k), i), path.join(OUT, `${pad(i)}.png`));
      if (i % 24 === 0) console.log(`frame ${i}/${FRAMES} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
  });
  console.log(`rendered in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
server.close();

// QA contact sheet of the rendered frames (every 12th frame, 240 px tiles, timestamps)
function sheetFromFrames(file) {
  const list = [];
  for (let i = from; i < to; i += Math.max(step, 12)) if (fs.existsSync(path.join(OUT, `${pad(i)}.png`))) list.push(i);
  const tmp = path.join(WORK, 'sheet_list.txt');
  fs.writeFileSync(tmp, list.map((i) => `file '${path.join(OUT, pad(i) + '.png')}'\nduration 1`).join('\n') + '\n');
  const cols = 6, rows = Math.ceil(list.length / cols);
  ff(['-f', 'concat', '-safe', '0', '-i', tmp, '-vf',
    `scale=240:240,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='%{eif\\:n*12/24+${from / FPS}\\:d\\:1}s':x=4:y=4:fontsize=13:fontcolor=white:box=1:boxcolor=black@0.7,tile=${cols}x${rows}`,
    '-frames:v', '1', file]);
  console.log('wrote', file);
}
if (partial && !encodeOnly) { if (step < 12) sheetFromFrames(path.join(WORK, 'partial_sheet.png')); process.exit(0); }
if (flag('--no-encode')) { sheetFromFrames(path.join(WORK, 'qa_sheet.png')); process.exit(0); }

// 4. audio: source delayed 1.0 s, applause extended under the outro by cross-faded loops of the clip's tail, faded
// out by the end, loudness-normalised to about -18 LUFS
const wav = path.join(WORK, 'audio.wav');
const srcMp4 = path.join(DIR, 'source.mp4');
const loops = [8.72, 8.86, 8.66, 8.8];
const fc = ['[0:a]atrim=0:10,asetpts=PTS-STARTPTS,aresample=48000[m0]'];
loops.forEach((s, i) => fc.push(`[0:a]atrim=${s}:10,asetpts=PTS-STARTPTS,aresample=48000[s${i}]`));
loops.forEach((_, i) => fc.push(`[${i ? 'm' + i : 'm0'}][s${i}]acrossfade=d=0.45:c1=qsin:c2=qsin[m${i + 1}]`));
// (timestamps are rebuilt from sample counts: atrim after adelay/apad otherwise cuts at the wrong place)
const fit = `asetpts=N/SR/TB,apad=whole_dur=${FRAMES / FPS},atrim=end_sample=${(FRAMES / FPS) * 48000}`;
fc.push(`[m${loops.length}]adelay=1000:all=1,${fit},afade=t=out:st=12.2:d=1.8,loudnorm=I=-18:TP=-1.5:LRA=11,aresample=48000,${fit}[a]`);
ff(['-i', srcMp4, '-filter_complex', fc.join(';'), '-map', '[a]', '-ac', '1', '-ar', '48000', wav]);

// 5. encode (two-pass, size-targeted: both files <= 2.5 MB)
const vbr = parseInt(opt('--vbr', '1250'), 10);
const frames = ['-framerate', String(FPS), '-i', path.join(OUT, '%04d.png')];
const mp4 = path.join(VIDEO, 'intro.mp4'), webm = path.join(VIDEO, 'intro.webm');
const x264 = ['-c:v', 'libx264', '-profile:v', 'high', '-level:v', '3.2', '-preset', 'veryslow', '-b:v', `${vbr}k`, '-maxrate', `${Math.round(vbr * 2)}k`, '-bufsize', `${vbr * 4}k`, '-pix_fmt', 'yuv420p', '-g', '48', '-x264-params', 'aq-mode=3'];
ff([...frames, ...x264, '-pass', '1', '-passlogfile', path.join(WORK, 'x264'), '-an', '-f', 'mp4', '/dev/null']);
ff([...frames, '-i', wav, ...x264, '-pass', '2', '-passlogfile', path.join(WORK, 'x264'), '-c:a', 'aac', '-b:a', '64k', '-ac', '1', '-ar', '48000', '-movflags', '+faststart', '-shortest', mp4]);
const vp9 = ['-c:v', 'libvpx-vp9', '-b:v', `${vbr}k`, '-minrate', `${Math.round(vbr * 0.5)}k`, '-maxrate', `${Math.round(vbr * 1.6)}k`, '-pix_fmt', 'yuv420p', '-row-mt', '1', '-tile-columns', '1', '-g', '96', '-auto-alt-ref', '1', '-lag-in-frames', '25', '-deadline', 'good'];
ff([...frames, ...vp9, '-cpu-used', '4', '-pass', '1', '-passlogfile', path.join(WORK, 'vp9'), '-an', '-f', 'webm', '/dev/null']);
ff([...frames, '-i', wav, ...vp9, '-cpu-used', '1', '-pass', '2', '-passlogfile', path.join(WORK, 'vp9'), '-c:a', 'libopus', '-b:a', '64k', '-ac', '1', '-shortest', webm]);

// 6. poster (= output frame 0) under 90 KB
const poster = path.join(VIDEO, 'intro-poster.jpg');
for (const qv of [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16]) {
  ff(['-i', path.join(OUT, '0000.png'), '-q:v', String(qv), poster]);
  if (fs.statSync(poster).size <= 90 * 1024) break;
}

// 7. QA: contact sheets (rendered frames, and the final mp4 decoded back with timestamps) + 340 px stills
sheetFromFrames(path.join(WORK, 'qa_sheet.png'));
ff(['-i', mp4, '-vf', "fps=2,scale=240:240,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='%{pts\\:hms}':x=4:y=4:fontsize=13:fontcolor=white:box=1:boxcolor=black@0.7,tile=7x4", '-frames:v', '1', path.join(WORK, 'final_sheet.png')]);
for (const s of [1.5, 3.5, 6.5, 9.0, 12.8]) ff(['-ss', String(s), '-i', mp4, '-frames:v', '1', '-vf', 'scale=340:340:flags=lanczos', path.join(WORK, `final_${s}_340.png`)]);
for (const f of [mp4, webm, poster]) console.log(path.relative(ROOT, f), (fs.statSync(f).size / 1024).toFixed(0), 'KB');
