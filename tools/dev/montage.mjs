// usage: node montage.mjs out.png cols img1.png img2.png ...  (labels = file basenames)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
const [,, out, cols, ...files] = process.argv;
const c = +cols, rows = Math.ceil(files.length / c);
const cw = Math.floor(1600 / c), ch = Math.round(cw * 9 / 16);
const html = `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${c},${cw}px);gap:4px;width:${cw*c + 4*(c-1)}px">` +
  files.map(f => `<div style="position:relative"><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}" style="width:${cw}px;height:${ch}px;display:block"><span style="position:absolute;left:6px;top:4px;color:#fff;font:600 13px sans-serif;text-shadow:0 1px 3px #000">${path.basename(f, '.png')}</span></div>`).join('') + '</body>';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: cw * c + 4 * (c - 1), height: ch * rows + 4 * (rows - 1) } });
await p.setContent(html);
await p.screenshot({ path: out });
await b.close();
