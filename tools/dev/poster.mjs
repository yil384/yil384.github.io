// Re-bake the page's loading poster (and the social preview) from the live hero shot, so the first
// paint shows the same island the 3D world fades in on. Run after changing the hub or the hero shot.
// usage: node poster.mjs   (writes assets/img/world-poster.jpg, world-poster-tall.jpg, og.jpg; needs :8000)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const OUT = new URL('../../assets/img/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const shots = [
  // name, viewport, query (the desktop look: full effects; phones use the tall one)
  ['world-poster', 1920, 1080, 'fullfx=1&dpr=1'],
  // phones: rendered through the phone path itself (touch, low effects, the phone framing), at 2x pixels
  ['world-poster-tall', 390, 844, 'dpr=2', true],
  ['og', 1200, 630, 'fullfx=1&dpr=1'],
];
for (const [name, w, h, q, phone = false] of shots) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: phone, isMobile: phone, deviceScaleFactor: phone ? 2 : 1 })).newPage();
  await p.goto(`http://localhost:8000/?force=1&intro=0&webgl=1&${q}`);
  await p.waitForFunction(() => document.body.classList.contains('world-live'), null, { timeout: 200000 });
  // settle the hero shot completely (the software GPU renders ~1 fps)
  await p.evaluate(() => { window.scrollTo({ top: 0, behavior: 'instant' }); window.__g.rig.settle?.(); });
  for (let i = 0; i < 40; i++) { await p.waitForTimeout(1000); if ((await p.evaluate(() => window.__g.rig.motion)) < 0.01 && i > 6) break; }
  await p.waitForTimeout(3000);
  // only the 3D canvas: the page, the bar, labels, bubbles and the text scrim all stay out of the picture
  await p.addStyleTag({ content: 'body > :not(#world), #world > :not(canvas), #world::after { visibility: hidden !important; opacity: 0 !important; }' });
  await p.waitForTimeout(1500);
  const png = `/tmp/yl/poster_${name}.png`;
  await p.locator('#world canvas').screenshot({ path: png });
  // jpeg via the browser: draw the png into a canvas and export
  const data = fs.readFileSync(png).toString('base64');
  const jpg = await p.evaluate(async (d) => {
    const img = new Image(); img.src = `data:image/png;base64,${d}`; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/jpeg', 0.82).split(',')[1];
  }, data);
  fs.writeFileSync(`${OUT}${name}.jpg`, Buffer.from(jpg, 'base64'));
  console.log(name, `${w}x${h}`, Math.round(Buffer.from(jpg, 'base64').length / 1024), 'KB');
  await p.close();
}
await b.close();
