// TRAIL: the strips between chapters (SPEC §2.5, §4.10). As a strip crosses the middle of the screen
// (once per visit each) an Octopath-style zone title card draws itself, the lantern on the post lights and
// footprints appear. The signpost is a fast-travel button; each strip holds a Triton token. Game-only.

const NEXT_NAME = { about: 'About', education: 'Education', publications: 'Publications', experience: 'Experience', projects: 'Projects', contact: 'Contact' };
const SHOT = { about: 'about', education: 'edu', publications: 'library', experience: 'trail', projects: 'workshop', contact: 'meadow' };

export function init({ kit, progress, P }) {
  const { $, $$, h, emit, found, sfx, toast, rm, isGame, world, observe, on } = kit;
  const strips = $$('main > .trail');
  if (!strips.length) return;
  const lit = new Set();

  const signTitle = (sign) => {
    const to = sign.dataset.go;
    const cleared = !!P.cleared[SHOT[to]];
    sign.title = `Fast travel to ${NEXT_NAME[to] || to}${cleared ? ' · chapter cleared ✓' : ' · not read yet'}`;
    sign.classList.toggle('is-cleared', cleared);
  };

  strips.forEach((strip, idx) => {
    const id = strip.dataset.trail;
    strip.classList.add(idx % 2 ? 'trail--r' : 'trail--l');
    const sub = $('.trail__sub', strip);
    if (sub && (P.ngplus | 0) > 0 && !$('.trail__ng', sub)) sub.append(h('span', { class: 'trail__ng' }, ' · NG+'));
    // lantern: a post light with a flame inside
    const lantern = $('.trail__lantern', strip);
    if (lantern && !lantern.firstChild) lantern.append(h('i', { class: 'trail__flame' }));

    // signpost: fast travel to the next chapter
    const sign = $('.trail__sign', strip);
    if (sign) {
      signTitle(sign);
      sign.addEventListener('pointerenter', () => signTitle(sign));
      sign.addEventListener('focus', () => signTitle(sign));
      sign.addEventListener('click', () => {
        const target = document.getElementById(sign.dataset.go);
        if (!target) return;
        sfx('buddy');
        target.scrollIntoView({ behavior: rm() ? 'auto' : 'smooth', block: 'start' });
        const hd = target.querySelector('h2');
        if (hd) { hd.tabIndex = -1; setTimeout(() => hd.focus({ preventScroll: true }), rm() ? 0 : 600); }
      });
    }

    // the token on the path
    const tok = $('.token[data-token]', strip);
    if (tok) {
      const tid = tok.dataset.token;
      if (P.tokens[tid]) tok.hidden = true;
      tok.addEventListener('click', () => {
        if (!isGame()) return;
        progress.token(tid, tok);
        tok.classList.add('is-got');
        setTimeout(() => { tok.hidden = true; }, 520);
      });
    }

    // g3: the tiny house on a roof
    const house = $('.trail__house', strip);
    house?.addEventListener('click', () => {
      sfx('pop');
      toast('A tiny house on a roof', 'It has been there since before you arrived.', { kind: 'info', k: 'Fallen Star' });
      const w = world();
      if (w && document.body.classList.contains('world-live')) { try { w.director?.focus('cse'); } catch { /* old world */ } } else found('fallen');
    });

    // crossing the middle of the screen: title card, lantern, footprints, checkpoint
    observe(strip, { threshold: 0.5, once: true }, () => {
      if (!isGame()) return;
      strip.classList.add('is-arrived');
      lantern?.classList.add('is-lit');
      sfx('open');
      setTimeout(() => sfx('buddy'), rm() ? 0 : 420);
      lit.add(id);
      if (lit.size >= strips.length) found('lamplighter');
      emit('page:checkpoint', { from: strip.dataset.from, to: strip.dataset.to });
      if (sign) signTitle(sign);
    });
  });

  // New Game+ marks and cleared marks on the signs
  on('page:clear', () => strips.forEach((s) => { const sg = $('.trail__sign', s); if (sg) signTitle(sg); }));
  progress.onProgress?.((st) => {
    if (!st.reset) return;
    strips.forEach((s) => {
      const t = $('.token[data-token]', s);
      if (t) { t.hidden = false; t.classList.remove('is-got'); }
      const sub = $('.trail__sub', s);
      if (sub && !$('.trail__ng', sub)) sub.append(h('span', { class: 'trail__ng' }, ' · NG+'));
    });
  });
}
