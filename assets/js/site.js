// Portfolio behaviours that work in every mode (and on phones): splash, navigation,
// scroll-spy, reveal animations, reading progress and the profile photo flip.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initSite() {
  splash();
  nav();
  reveals();
  progress();
  avatar();
}

// ---------------------------------------------------------------- splash
function splash() {
  const el = $('#splash');
  const root = document.documentElement;
  if (!el || root.dataset.splash === 'seen') return;
  try { sessionStorage.setItem('yl.splash', '1'); } catch { /* private mode */ }
  const name = $('#splash-name');
  const full = name.textContent;
  name.textContent = '';
  let i = 0;
  const type = setInterval(() => {
    name.textContent = full.slice(0, ++i);
    if (i >= full.length) clearInterval(type);
  }, still() ? 0 : 55);
  let gone = false;
  const dismiss = () => {
    if (gone) return;
    gone = true;
    clearInterval(type);
    el.classList.add('is-gone');
    setTimeout(() => el.remove(), 600);
    window.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); dismiss(); } };
  el.addEventListener('click', dismiss);
  window.addEventListener('keydown', onKey);
  setTimeout(dismiss, still() ? 300 : 1700);
}

// ---------------------------------------------------------------- navigation
function nav() {
  const navEl = $('#nav');
  const toggle = $('#nav-toggle');
  toggle?.addEventListener('click', () => {
    const open = navEl.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  // Smooth in-page scrolling without CSS scroll-behavior (which would fight the game camera).
  document.addEventListener('click', (e) => {
    const a = e.target instanceof Element && e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target || target.hidden) return;
    e.preventDefault();
    navEl.classList.remove('is-open');
    toggle?.setAttribute('aria-expanded', 'false');
    target.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);
  });

  // Scroll-spy
  const links = new Map($$('a', navEl).map((a) => [a.getAttribute('href').slice(1), a]));
  const spy = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const id = en.target.id;
      if (!links.has(id)) continue;
      for (const a of links.values()) a.classList.toggle('is-active', a === links.get(id));
    }
  }, { rootMargin: '-40% 0px -55% 0px' });
  $$('main > section[id]').forEach((s) => spy.observe(s));
}

// ---------------------------------------------------------------- reveal on scroll
function reveals() {
  const targets = [...$$('.reveal'), ...$$('.timeline'), ...$$('.toolkit')];
  if (!('IntersectionObserver' in window) || still()) {
    targets.forEach((t) => t.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      en.target.classList.add('is-in');
      io.unobserve(en.target);
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  targets.forEach((t) => io.observe(t));
}

// ---------------------------------------------------------------- reading progress
function progress() {
  const bar = $('#read-progress');
  if (!bar) return;
  let queued = false;
  const paint = () => {
    queued = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.setProperty('--p', max > 0 ? (window.scrollY / max).toFixed(4) : '0');
  };
  window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(paint); } }, { passive: true });
  paint();
}

// ---------------------------------------------------------------- avatar flip
function avatar() {
  const btn = $('#avatar-btn');
  const img = $('#avatar-img');
  const source = $('#avatar-picture source');
  if (!btn || !img) return;
  const photos = [
    { webp: 'assets/img/portrait.webp', jpg: 'assets/img/portrait.jpg', alt: 'Portrait of Yichen Lin', pos: '50% 50%' },
    { webp: 'assets/img/michelin.webp', jpg: 'assets/img/michelin.jpg', alt: 'Yichen Lin posing next to the Michelin mascot at night', pos: '50% 40%' },
  ];
  let i = 0;
  let busy = false;
  const flip = () => {
    if (busy) return;
    busy = true;
    i = (i + 1) % photos.length;
    const p = photos[i];
    const pre = new Image();
    pre.src = p.jpg;
    btn.classList.add('is-flipping');
    setTimeout(() => {
      if (source) source.srcset = p.webp;
      img.src = p.jpg;
      img.alt = p.alt;
      img.style.objectPosition = p.pos;
    }, 240);
    setTimeout(() => { btn.classList.remove('is-flipping'); busy = false; }, 520);
  };
  btn.addEventListener('click', flip);
  if (!still()) {
    setInterval(() => {
      if (document.hidden) return;
      const r = btn.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) flip();
    }, 15000);
  }
}
