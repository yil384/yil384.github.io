// A small visitor map in the footer: a dotted world with a glowing dot for every city that opened this page.
// Same design and data model as the Picasso Lab map (Yichen's own), stored in its own Supabase table.
// Privacy: no IP addresses are stored or shown. The visitor's browser asks a geo-IP service for an
// approximate location, rounds it to 0.1° (about 10 km) and stores only city, country and that rounded point.
// One-time setup of the table: see docs/dev/VISITORS.md.
const SUPABASE_URL = 'https://azkluwobpiaymxsfukly.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7RvwCJocbr90jF63Zgpajw_MVlH3K7S';
const TABLE = 'home_visits';
const LIVE_HOST = 'yil384.github.io';          // local test servers never write visits

// 220 x 100 land mask (1 bit per cell, Mercator between 80°N and 58°S)
const MASK_B64 = 'AAAAAAACC/4D////wAAEiAAAAAAA6AAAAAAAAAAAAAAGCQLD/////AAAOQAAAAAAAAAAAAAAAAAAAAAOEs98H////6AAAAAAAAMAAA7AAAAAAAAAAAAAP6W/gAH///oAAAAAAAYAAP/+AAPcAAAAAAAAPgCuQAAP//3AAAAAAAGAAD//QAAIAAAAAAAAB7/OmzAA///IAAAAAAAwDF////+B8AAAgAIAAAP8Gf/AAf//gAAABAABgd9////9/+QAEAP/8H0f4MMfgN//8AAABfwAAZ37///////wvMD/////BC8xeAH/wAAAAv/8Rv/r//////////6B////////B/B/+AAAAD//5f/9//////////99///////+wHoD/AG8AAf34//////////////wAP//////9wfgP4AHAAD+/3/////////////+AH///////BAIAfAAAAAfn///////////////8Af9/////4A8AA8AAAAF8f/////////////L8AC/8f////AB4gAAAAAAP8j////////////wQAAAMAL///+AP3AAAAAAB3D///////////+AGAAABAAf///+Af8AAAAAeAcX///////////gA4AAAYAAP///+B/4AAAAAYHh///////////8AHgAAEAAA/////f/4AAAAGwAv///////////wAcAAAAAAF////+//wAAAA3H/////////////wBgAEAAAAD////7//AAAACe//////////////QCAAAAAAAP//////kAAAABH/////////////9AAAAAAAAAH/////Y4AAAAB//////////////wAAAAAAAAA//////AgAAAAP/////////////+AAAAAAAAAD//////gAAAAAf//6f/////////wAAAAAAAAAP/////sAAAAAB///B/////////+AAAAAAAAAA/////4AAAAAB3TP4D/////////w4AAAAAAAAD/////gAAAAAH8WPgH////////4BAAAAAAAAAP////4AAAAAAfhGy/////////3gAAAAAAAAAA/////AAAAAAD8EDP////////+kAgAAAAAAAAB////4AAAAAAHwCGf////////44EAAAAAAAAAH////wAAAAAAIfgAr////////xhwAAAAAAAAAP///+AAAAAAA3+AQv///////+GfAAAAAAAAAAP///wAAAAAAD/wAA////////8BAAAAAAAAAAA///+AAAAAAA//4wH////////wQAAAAAAAAAABf//wAAAAAAD//77/////////AAAAAAAAAAAAF/9hAAAAAAAP/////3//////+AAAAAAAAAAAAL/gGAAAAAAF////3/f//////wAAAAAAAAAAAA3+AIAAAAAAP////v8X/////+AAAAAAAAAAAABf4AgAAAAAB////+/4P/////4AAAAAAAAAAAAC/AAoAAAAAH////9/+B/////AAAAAAAAAAAAAB8AYAAAAAA/////z/8B////pAAAAAAAAQAAAADwYIAAAAAD/////v/wH/j/0AAAAAAAAAAAAAAPhgQAAAAAP////+f+AP+H+QAAAAAAAAAAAAAAfcAMAAAAA/////5/4AfwP6AAAAAAAAAAAAAAA/wAAAAAAD/////z/AB8A/gCAAAAAAAAAAAAAAHQAAAAAAP/////vwAHwA/AQAAAAAAAAAAAAAAPgAAAAAA/////+8AAeAD+AAAAAAAAAAAAAAAAGAAAAAAD//////AAA4AL4BAAAAAAAAAAAAAAAYAAAAAAH/////wAADgAngCAAAAAAAAAAAAAAAg/YAAAAf/////+AAGACYAIAAAAAAAAAAAAAABP/gAAAA//////4AAUAIAAAAAAAAAAAAAAAAAA//AAAAD//////AAAQAAACAAAAAAAAAAAAAAAB/+AAAAD+f///8AABABgEIAAAAAAAAAAAAAAAH//AAAAEB////gAAAA2AwAAAAAAAAAAAAAAAAf/+AAAAAA///+AAAABoHAAAAAAAAAAAAAAAAD//4AAAAAD///wAAAADQ8AAAAAAAAAAAAAAAAf//gAAAAAP//+AAAAAGH3AAAAAAAAAAAAAACB///AAAAAB///wAAAAAYfAEAAAAAAAAAAAAAAH///gAAAAD//+AAAAAAx5ASAAAAAAAAAAAAAAf///wAAAAH//wAAAAAHgmV/AAAAAAAAAAAAAD////gAAAAf//AAAAAAGAYA+AAAAAAAAAAAAAH////gAAAA//8AAAAAAEAAB9AAAAAAAAAAAAAf///+AAAAD//wAAAAAAOAAPwAAAAAAAAAAAAA////wAAAAP//AAAAAAABCAMgAAAAAAAAAAAAD////AAAAA//+AAAAAAAAAAAAAAAAAAAAAAAAH///4AAAAD//6AAAAAAAAEAAAAAAAAAAAAAAAf///AAAAAP//ggAAAAAAAOEAAAAAAAAAAAAAA///8AAAAA//+GAAAAAAAN4wAAAAAAAAAAAAAB///wAACAH//4wAAAAAAA/zgAAAAAAAAAAAAAD///AAAAAf/+HAAAAAAAD/uAAAAAAAAAAAAAAH//8AAAAB//wcAAAAAAA//4AAAAAAAAAAAAAAf//gAAAAD/+BwAAAAAAH//4AAAAAAAAAAAAAB//+AAAAAP/4HAAAAAAB///gAAAAAAAAAAAAAH//wAAAAAf/w4AAAAAAP///AAAAAAAAAAAAAAf/4AAAAAB//BgAAAAAB///+AAAAAAAAAAAAAB//AAAAAAH/wAAAAAAAD///8AAAAAAAAAAAAAH/8AAAAAAf/AAAAAAAAP///wAAAAAAAAAAAAA//wAAAAAA/8AAAAAAAA////AAAAAAAAAAAAAD/+AAAAAAD/gAAAAAAAD///8AAAAAAAAAAAAAP/4AAAAAAH8AAAAAAAAP///wAAAAAAAAAAAAA//AAAAAAAfwAAAAAAAAfg/+AAAAAAAAAAAAAD/4AAAAAAB8AAAAAAAAD0B/wAAAAAAAAAAAAAP+AAAAAAAAAAAAAAAAAAAB/AAIAAAAAAAAAAB/4AAAAAAAAAAAAAAAAAAAH8AAgAAAAAAAAAAH/gAAAAAAAAAAAAAAAAAAANAABgAAAAAAAAAAfwAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAB/AAAAAAAAAAAAAAAAAAAAAgABQAAAAAAAAAADwAAAAAAAAAAAAAAAAAAAABAAEAAAAAAAAAAAfAAAAAAAAAAAAAAAAAAAAAEAAwAAAAAAAAAAB8AAAAAAAAAAAAAAAAAAAAAAAOAAAAAAAAAAAPgAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAA/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4AAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const GW = 220, GH = 100, LAT_MAX = 80, LAT_MIN = -58;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const ASPECT = (2 * Math.PI) / (mercY(LAT_MAX) - mercY(LAT_MIN));
let bits = null;
const land = (c, r) => { const i = r * GW + c; return (bits[i >> 3] >> (7 - (i & 7))) & 1; };

const round = (x) => Math.round(x * 10) / 10;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ago = (ms) => { const s = Math.max(0, (Date.now() - ms) / 1000); return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : `${Math.floor(s / 86400)} d ago`; };
const headers = (json = false) => ({ apikey: SUPABASE_KEY, ...(json ? { 'Content-Type': 'application/json', Prefer: 'return=minimal' } : {}) });

async function geoIP() {
  const tries = [
    async () => { const d = await (await window.fetch('https://ipwho.is/')).json(); if (!d || d.success === false) throw 0; return { lat: d.latitude, lon: d.longitude, city: d.city, country: d.country }; },
    async () => { const d = await (await window.fetch('https://ipapi.co/json/')).json(); if (!d || d.error) throw 0; return { lat: d.latitude, lon: d.longitude, city: d.city, country: d.country_name }; },
    async () => { const d = await (await window.fetch('https://get.geojs.io/v1/ip/geo.json')).json(); if (!d || !d.latitude) throw 0; return { lat: +d.latitude, lon: +d.longitude, city: d.city, country: d.country }; },
  ];
  for (const t of tries) { try { return await t(); } catch { /* next service */ } }
  return null;
}
async function loadRows() {
  const r = await window.fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?select=lat,lon,city,country,created_at&order=created_at.desc&limit=20000`, { headers: headers() });
  if (!r.ok) throw new Error(`visits ${r.status}`);
  return r.json();
}
async function record(v) {
  const body = { lat: round(v.lat), lon: round(v.lon), city: v.city || '', country: v.country || '' };
  const r = await window.fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, { method: 'POST', headers: headers(true), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`record ${r.status}`);
}

export function initVisitorMap(root) {
  if (!root || root.dataset.ready) return;
  root.dataset.ready = '1';
  root.innerHTML = '<canvas class="vmap__c" role="img" aria-label="Map of where visitors come from"></canvas>'
    + '<p class="vmap__stats" title="City-level and approximate. No IP addresses are stored or shown."><span class="vmap__live" aria-hidden="true"></span>'
    + '<b data-v="n">–</b> visits · <b data-v="c">–</b> regions</p>'
    + '<p class="vmap__latest">latest: <span data-v="l">–</span></p>'
    + '<div class="vmap__tip" hidden></div>';
  // the site's own palette: gold for the newest visits, teal for the rest, navy land
  const css = window.getComputedStyle(document.documentElement);
  const GOLD = css.getPropertyValue('--gold').trim() || '#ffcd00', TEAL = css.getPropertyValue('--teal').trim() || '#00c6d7';
  const cv = root.querySelector('canvas'), tip = root.querySelector('.vmap__tip');
  const set = (k, v) => { root.querySelector(`[data-v="${k}"]`).textContent = v; };
  bits = bits || Uint8Array.from(window.atob(MASK_B64), (ch) => ch.charCodeAt(0));
  let pings = [], lay = null, t0 = performance.now(), raf = 0;

  function layout() {
    const w = cv.clientWidth, h = Math.round(w / ASPECT), dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.height = `${h}px`; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    // the land dots once per size, into an offscreen canvas; frames only add the visitor dots on top
    const base = document.createElement('canvas'); base.width = cv.width; base.height = cv.height;
    const g = base.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cw = w / GW, ch = h / GH, r = Math.max(0.6, Math.min(cw, ch) * 0.34);
    g.fillStyle = 'rgba(120, 160, 225, 0.30)';
    lay = { w, h, dpr, base };
    // mask rows are evenly spaced in latitude; place each cell through the same Mercator projection as the dots
    for (let y = 0; y < GH; y++) {
      const [, py] = project(0, LAT_MAX - ((y + 0.5) / GH) * (LAT_MAX - LAT_MIN));
      for (let x = 0; x < GW; x++) if (land(x, y)) { g.beginPath(); g.arc((x + 0.5) * cw, py, r, 0, 6.283); g.fill(); }
    }
  }
  const project = (lon, lat) => [((lon + 180) / 360) * lay.w, ((mercY(LAT_MAX) - mercY(Math.max(LAT_MIN, Math.min(LAT_MAX, lat)))) / (mercY(LAT_MAX) - mercY(LAT_MIN))) * lay.h];
  function draw(now) {
    if (!lay) return;
    const g = cv.getContext('2d'), { dpr } = lay;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(lay.base, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = (now - t0) / 1000;
    for (const p of pings) {
      const [x, y] = project(p.lon, p.lat), rad = Math.min(2.8, 1.1 + Math.sqrt(p.n) * 0.35);
      if (p.live) { const k = (t * 0.6 + p.phase) % 1; g.globalAlpha = 0.55 * (1 - k); g.strokeStyle = GOLD; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, rad + k * 6, 0, 6.283); g.stroke(); g.globalAlpha = 1; }
      g.shadowColor = p.live ? GOLD : TEAL; g.shadowBlur = 6;
      g.fillStyle = p.live ? GOLD : TEAL;
      g.beginPath(); g.arc(x, y, rad, 0, 6.283); g.fill();
      g.shadowBlur = 0;
    }
  }
  let onScreen = true;
  new window.IntersectionObserver((es) => { onScreen = es.some((e) => e.isIntersecting); if (onScreen) kick(); }).observe(cv);
  const loop = (now) => { draw(now); raf = pings.some((p) => p.live) && onScreen && !matchMedia('(prefers-reduced-motion: reduce)').matches ? requestAnimationFrame(loop) : 0; };
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

  function show(rows) {
    const agg = new Map(), countries = new Set();
    for (const r of rows) {
      if (r.country) countries.add(r.country);
      if (r.lat == null || r.lon == null) continue;
      const k = `${round(r.lat)},${round(r.lon)}`, t = Date.parse(r.created_at) || 0;
      const a = agg.get(k) || { lat: round(r.lat), lon: round(r.lon), n: 0, t: 0, where: (r.city ? `${r.city}, ` : '') + (r.country || 'somewhere') };
      a.n++; a.t = Math.max(a.t, t); agg.set(k, a);
    }
    pings = [...agg.values()].sort((a, b) => b.t - a.t);
    pings.forEach((p, i) => { p.live = i < 3; p.phase = i * 0.33; });
    set('n', rows.length.toLocaleString('en-US')); set('c', countries.size);
    set('l', pings[0] ? pings[0].where : '–');
    kick();
  }

  cv.addEventListener('pointermove', (e) => {
    if (!lay) return;
    const b = cv.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top;
    let hit = null, hd = 14;
    for (const p of pings) { const [x, y] = project(p.lon, p.lat), d = Math.hypot(x - mx, y - my); if (d < hd) { hd = d; hit = p; } }
    if (!hit) { tip.hidden = true; return; }
    tip.innerHTML = `<b>${esc(hit.where)}</b> ${hit.n} visit${hit.n > 1 ? 's' : ''}${hit.t ? ` · ${ago(hit.t)}` : ''}`;
    tip.hidden = false;   // sits just above the widget (CSS)
  });
  cv.addEventListener('pointerleave', () => { tip.hidden = true; });
  new window.ResizeObserver(() => { layout(); draw(performance.now()); }).observe(cv);
  layout();

  (async () => {
    let rows = [];
    try { rows = await loadRows(); } catch (err) { console.info('[visitors] map offline:', err.message); }
    show(rows);
    // one visit per browser session, only on the real site
    let seen = true;
    try { seen = !!window.sessionStorage.getItem('yl-visit'); } catch { /* private mode */ }
    if (seen || location.hostname !== LIVE_HOST) return;
    const v = await geoIP();
    if (!v) return;
    try { window.sessionStorage.setItem('yl-visit', '1'); } catch { /* private mode */ }
    try { await record(v); rows = await loadRows(); } catch { rows = [{ ...v, created_at: new Date().toISOString() }, ...rows]; }
    show(rows);
  })();
}
