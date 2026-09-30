import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--disable-gpu', '--disable-webgl', '--disable-3d-apis'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 200)); });
p.on('pageerror', e => logs.push('PAGEERR: ' + e.message.slice(0, 300)));
await p.goto('http://localhost:8000/', { waitUntil: 'load' });
await p.waitForTimeout(3500);
console.log('body class:', await p.evaluate(() => document.body.className), '| canvas:', await p.evaluate(() => !!document.querySelector('#world canvas')), '| play btn hidden:', await p.evaluate(() => document.getElementById('play-btn').hidden));
await p.evaluate(() => window.scrollTo(0, 1000)); await p.waitForTimeout(1200);
await p.screenshot({ path: process.argv[2] + '_nogl.png' });
// DOM eggs still work
await p.keyboard.press('`'); await p.waitForTimeout(300); await p.keyboard.type('sudo x'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
console.log('eggs:', await p.evaluate(async () => { const m = await import('/assets/js/site/eggs.js'); const s = await import('/assets/js/game3d/state.js'); return Object.keys(s.S.eggs).join(',') + ' | total ' + m.total(); }));
console.log(logs.join('\n') || 'no console problems');
await b.close();
