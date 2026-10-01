// REGIONS-B test: node rb.mjs <region> [shots=0] [script.mjs]
// Loads ?region=<id>, sims, runs optional per-region checks (export default async ({ p, ev, sim, check, shot }) => {}).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, region, shots = '0', script] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const logs = [];
p.on('console', (m) => { const t = m.text(); if ((m.type() === 'error' || m.type() === 'warning') && !/WebGPU|GPU stall|powerPreference/.test(t)) logs.push(`${m.type()}: ${t.slice(0, 400)}`); else if (t.startsWith('LOG')) console.log(t); });
p.on('pageerror', (e) => logs.push(`PAGEERR: ${e.message.slice(0, 400)} ${(e.stack || '').split('\n').slice(1, 4).join(' | ')}`));
const ok = [], bad = [];
const check = (name, cond, info = '') => { (cond ? ok : bad).push(name); console.log(cond ? 'PASS' : 'FAIL', name, info); };
const ev = (fn, arg) => p.evaluate(fn, arg);
const sim = (s) => ev((s) => window.__g.sim(s), s);
const S = '/tmp/yl';
const shot = async (name, wait = 2500) => { if (shots === '0') return; await p.waitForTimeout(wait); await p.screenshot({ path: `${S}/rb_${region}_${name}.png` }); };
await p.goto(`${process.env.BASE || "http://localhost:8000/"}?force=1&dpr=1&intro=0&lowfx=1&webgl=1&region=${region}`, { waitUntil: 'load' });
await p.waitForFunction(() => document.body.classList.contains('world-live'), null, { timeout: 150000 });
await p.waitForFunction((r) => window.__g?.where?.id === r, region, { timeout: 60000 }).catch(() => logs.push('never arrived'));
await p.waitForTimeout(1500);
await ev(() => { window.__g.closeAllModals(); document.querySelector('.g__coach button')?.click(); });
const info = await ev((r) => {
  const g = window.__g;
  return { where: g.where.id, foes: g.foes.filter((f) => f.region === r).length, bosses: g.patternBosses.filter((x) => x.region === r).map((x) => x.id), npcs: g.npcs.filter((n) => n.region === r).map((n) => n.id), pos: [g.player.x, g.player.y, g.player.z], children: g.scene.getObjectByName(`region:${r}`)?.children.length };
}, region);
console.log('info', JSON.stringify(info));
check('arrived', info.where === region);
const s1 = await sim(2);
check('sim runs, grounded at spawn', s1.grounded && s1.region === region, JSON.stringify(s1));
await shot('arrive', 3000);
if (script) { const mod = await import(script); await mod.default({ p, ev, sim, check, shot, region, logs }); }
// leave and come back
await ev(() => window.__g.travel('hub', null, { instant: true })); await p.waitForTimeout(1500); await sim(0.5);
check('travel to hub', (await ev(() => window.__g.where.id)) === 'hub');
await ev((r) => window.__g.travel(r, null, { instant: true }), region); await p.waitForTimeout(1500); await sim(0.5);
check('travel back', (await ev(() => window.__g.where.id)) === region);
console.log(logs.slice(0, 30).join('\n') || 'no console errors');
console.log(`${ok.length} pass, ${bad.length} fail`, bad.join('; '));
await b.close();
