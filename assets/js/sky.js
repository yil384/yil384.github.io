// Background sky: twinkling stars on one canvas (cheap, ~30 fps, paused when hidden).
// In play mode it also cycles light weather: rain, snow, aurora and fireflies.

let canvas = null;
let g = null;
let W = 0;
let H = 0;
let dpr = 1;
let stars = [];
let particles = [];
let weather = 'clear';
let weatherOn = false;
let weatherTimer = 0;
let raf = 0;
let last = 0;
const still = window.matchMedia('(prefers-reduced-motion: reduce)');
const CYCLE = ['clear', 'fireflies', 'rain', 'clear', 'snow', 'aurora'];

export function initSky() {
  canvas = document.getElementById('sky');
  if (!canvas) return;
  g = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(performance.now()); });
  loop(performance.now());
}

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const n = Math.round((W * H) / 9000);
  stars = Array.from({ length: Math.min(260, n) }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() < 0.08 ? 1.6 : Math.random() * 0.9 + 0.4,
    p: Math.random() * Math.PI * 2,
    s: 0.4 + Math.random() * 1.4,
    c: Math.random() < 0.12 ? '#ffe08a' : Math.random() < 0.2 ? '#c7d2fe' : '#ffffff',
  }));
  if (still.matches) draw(0);
}

export function setWeatherActive(on) {
  weatherOn = on && !still.matches;
  clearInterval(weatherTimer);
  if (!weatherOn) { setWeather('clear'); return; }
  let i = 0;
  setWeather(CYCLE[i]);
  weatherTimer = setInterval(() => { i = (i + 1) % CYCLE.length; setWeather(CYCLE[i]); }, 75000);
}

function setWeather(kind) {
  weather = kind;
  particles = [];
  const n = kind === 'rain' ? 110 : kind === 'snow' ? 90 : kind === 'fireflies' ? 26 : 0;
  for (let i = 0; i < n; i++) particles.push(spawn(true));
}

function spawn(anywhere) {
  const y = anywhere ? Math.random() * H : -10;
  if (weather === 'rain') return { x: Math.random() * W, y, v: 520 + Math.random() * 260, l: 10 + Math.random() * 10 };
  if (weather === 'snow') return { x: Math.random() * W, y, v: 30 + Math.random() * 40, r: 1 + Math.random() * 2, d: Math.random() * Math.PI * 2 };
  return { x: Math.random() * W, y: Math.random() * H, d: Math.random() * Math.PI * 2, r: 1.5 + Math.random() * 1.5 };
}

function loop(now) {
  cancelAnimationFrame(raf);
  if (still.matches || document.hidden) return;
  raf = requestAnimationFrame(loop);
  if (now - last < 33) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  draw(now / 1000, dt);
}

function draw(t, dt = 0) {
  g.clearRect(0, 0, W, H);
  const drift = (window.scrollY * 0.04) % H;
  for (const s of stars) {
    const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.s + s.p));
    g.globalAlpha = a;
    g.fillStyle = s.c;
    let y = s.y - drift;
    if (y < 0) y += H;
    g.fillRect(s.x, y, s.r, s.r);
  }
  g.globalAlpha = 1;
  if (!weatherOn) return;

  if (weather === 'aurora') {
    for (let i = 0; i < 3; i++) {
      const grad = g.createLinearGradient(0, 0, W, 0);
      const hue = (t * 8 + i * 60) % 360;
      grad.addColorStop(0, `hsla(${150 + i * 40}, 80%, 60%, 0)`);
      grad.addColorStop(0.5, `hsla(${(hue + 160) % 360}, 80%, 65%, 0.08)`);
      grad.addColorStop(1, `hsla(${230 + i * 30}, 80%, 60%, 0)`);
      g.fillStyle = grad;
      g.beginPath();
      const base = H * (0.12 + i * 0.08);
      g.moveTo(0, base);
      for (let x = 0; x <= W; x += 40) g.lineTo(x, base + Math.sin(x / 180 + t * 0.6 + i) * 30);
      g.lineTo(W, base + 120);
      g.lineTo(0, base + 120);
      g.fill();
    }
    return;
  }
  for (const p of particles) {
    if (weather === 'rain') {
      p.y += p.v * dt;
      p.x -= p.v * dt * 0.12;
      if (p.y > H) Object.assign(p, spawn(false));
      g.strokeStyle = 'rgba(147,197,253,0.35)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x + p.l * 0.12, p.y - p.l);
      g.stroke();
    } else if (weather === 'snow') {
      p.y += p.v * dt;
      p.d += dt;
      p.x += Math.sin(p.d) * 0.4;
      if (p.y > H) Object.assign(p, spawn(false));
      g.fillStyle = 'rgba(241,245,249,0.8)';
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      g.fill();
    } else if (weather === 'fireflies') {
      p.d += dt * 0.8;
      p.x += Math.cos(p.d) * 12 * dt;
      p.y += Math.sin(p.d * 1.3) * 10 * dt;
      const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + p.d));
      g.fillStyle = `rgba(253,230,138,${a})`;
      g.shadowColor = '#fde68a';
      g.shadowBlur = 8;
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
    }
  }
}
