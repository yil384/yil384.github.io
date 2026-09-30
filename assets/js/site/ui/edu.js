// EDUCATION: the class-change path (SPEC §4.3). Two hex badges (Tsinghua → UCSD), a track that draws
// itself the first time the chapter is reached while the scholar walks it and a CLASS CHANGE banner pops,
// Inspect backs, a waypoint between the gates and a locked future node. The two rows stay plain HTML.

const LOCKED = 'Locked. Requires: a thesis, a defense and 3 more deadlines.';

export function init({ kit, progress, P }) {
  const { $, $$, h, emit, found, sfx, bubble, burst, rm, isGame, world, echo, expand, primary, onSection, spriteImg, sessionOnce, once } = kit;
  const sec = $('#education');
  const path = sec && $('.path', sec);
  if (!path) return;
  const nodes = $$('.path__node', path);
  const ucsd = $('.path__node--ucsd', path);
  const thu = $('.path__node--thu', path);
  const track = $('.path__track', path);
  const walker = track && $('.path__walker', track);
  const banner = track && $('.path__banner', track);
  const tok = track && $('.token[data-token="t3"]', track);
  const line = track && $('.path__line', track);

  // the banner in two parts (big "Class change", small path) without changing its text
  if (banner && !banner.querySelector('b')) {
    const [a, ...b] = banner.textContent.split(' · ');
    banner.replaceChildren(h('b', null, a), h('span', null, b.join(' · ')));
  }
  if (walker && !walker.firstChild) walker.append(spriteImg('scholar', 2));
  // a small track shadow line under the drawn path, and a second "ghost" path for the undrawn state
  if (line) {
    const ghost = line.cloneNode();
    ghost.setAttribute('class', 'path__ghost');
    line.before(ghost);
    try { const L = line.getTotalLength(); line.style.setProperty('--len', String(Math.ceil(L))); } catch { line.style.setProperty('--len', '170'); }
  }

  // ------------------------------------------------------------ layout helper for phones (vertical track between rows)
  const place = () => {
    if (!track || !thu || !ucsd) return;
    if (matchMedia('(max-width: 899px)').matches) {
      const top = thu.offsetTop + thu.offsetHeight;
      const gap = ucsd.offsetTop - top;
      track.style.setProperty('--gap-top', `${top}px`);
      track.style.setProperty('--gap-h', `${Math.max(48, gap)}px`);
    } else {
      track.style.removeProperty('--gap-top');
      track.style.removeProperty('--gap-h');
    }
  };
  place();
  addEventListener('resize', place);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => requestAnimationFrame(place)).observe(path);

  // ------------------------------------------------------------ the class change (this chapter's one auto-celebration)
  let played = false;
  const endState = () => {
    path.classList.add('is-drawn', 'is-arrived', 'is-changed');
    if (tok && !P.tokens.t3) tok.hidden = false;
  };
  if (P.once['o:edu-classchange']) endState();
  const play = () => {
    if (played || !isGame()) return;
    played = true;
    if (!once('edu-classchange')) { endState(); return; }
    if (rm()) { endState(); celebrate(); return; }
    path.classList.add('is-drawing');
    setTimeout(() => { path.classList.add('is-drawn', 'is-walking'); }, 900);
    setTimeout(() => { path.classList.remove('is-walking'); path.classList.add('is-arrived'); celebrate(); }, 900 + 2400);
  };
  function celebrate() {
    path.classList.add('is-changed');
    ucsd?.classList.remove('is-flash'); void ucsd?.offsetWidth; ucsd?.classList.add('is-flash');
    banner?.classList.add('is-pop');
    sfx('levelup');
    if (banner) burst(banner, { n: 12, kind: 'confetti' });
    setTimeout(() => { if (tok && !P.tokens.t3) { tok.hidden = false; tok.classList.add('is-pop'); } }, rm() ? 0 : 450);
    emit('page:classchange');
    progress.award({ id: 'classchange', xp: 10, why: 'Class change', from: banner || track });
  }
  onSection((cur) => {
    if (cur?.id !== 'education' || !sessionOnce('edu-reveal')) return;
    // wait for the card to have faded in before the show starts
    setTimeout(play, rm() ? 0 : 450);
  });
  tok?.addEventListener('click', () => {
    progress.token('t3', tok);
    tok.classList.add('is-got');
    setTimeout(() => { tok.hidden = true; }, 520);
  });

  // ------------------------------------------------------------ Inspect backs
  const inspect = (node) => {
    const btn = $('.path__inspect', node);
    const back = btn && document.getElementById(btn.getAttribute('aria-controls'));
    if (!back || !isGame()) return;
    expand(back).then((open) => {
      btn.textContent = open ? 'Close' : 'Inspect';
      node.classList.toggle('is-open', open);
      if (!open) return;
      sfx('open');
      const isU = node === ucsd;
      progress.markOpened(isU ? 'edu-ucsd' : 'edu-thu', btn);
      emit('page:open', { key: node.dataset.focus, what: 'inspect' });
      if (!isU && !world()) found('gate');
      echo();
    });
  };
  for (const node of nodes) {
    $('.path__inspect', node)?.addEventListener('click', (e) => { e.stopPropagation(); inspect(node); });
    primary(node, () => inspect(node));
    // "Show me…"
    $('[data-act="visit"]', node)?.addEventListener('click', (e) => {
      const key = e.currentTarget.dataset.key;
      const w = world();
      sfx('buddy');
      if (w) { try { w.stage?.setHover(key); setTimeout(() => { try { w.stage?.setHover(null); } catch { /* gone */ } }, 2200); } catch { /* old world */ } }
      emit('page:open', { key, what: 'visit' });
      if (!w || !document.body.classList.contains('world-live')) {
        echo();
        bubble(e.currentTarget, 'The island is asleep on this device (poster mode). It is out there, promise.', { who: 'ash', place: 'below' });
      }
    });
    // ←/→ move between the two nodes (visual order: Tsinghua, then UCSD)
    node.addEventListener('keydown', (e) => {
      if (e.target !== node || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      if (!isGame()) return;
      const order = [thu, ucsd].filter(Boolean);
      const i = order.indexOf(node);
      const next = order[(e.key === 'ArrowRight' || e.key === 'ArrowDown') ? i + 1 : i - 1];
      if (next) { e.preventDefault(); next.focus(); }
    });
  }

  // ------------------------------------------------------------ waypoint
  const way = track && $('.path__waypoint', track);
  way?.addEventListener('click', () => {
    sfx('pop');
    bubble(way, '0 days between the gates. No side quests.', { who: 'ash', place: 'above' });
    way.classList.add('is-seen');
    found('zerogap');
  });

  // ------------------------------------------------------------ the locked node
  const lock = $('.path__locked', path);
  if (lock) {
    const inner = $('span', lock);
    const small = $('small', lock);
    let n = 0, openT = 0;
    lock.addEventListener('click', () => {
      if (!isGame() || lock.classList.contains('is-unlocked')) return;
      n++;
      if (n >= 7) {
        n = 0;
        lock.classList.add('is-unlocked');
        const was = [inner?.textContent, small?.textContent];
        if (inner) inner.textContent = 'Dr. Lin';
        if (small) small.textContent = '(coming soon)';
        sfx('achievement');
        burst(lock, { n: 14, kind: 'spark' });
        emit('page:sky', { n: 3 });
        found('thesis');
        bubble(lock, 'Patience is also a skill.', { who: 'me', place: 'below', ms: 3000 });
        clearTimeout(openT);
        openT = setTimeout(() => {
          lock.classList.remove('is-unlocked');
          if (inner) inner.textContent = was[0];
          if (small) small.textContent = was[1];
          sfx('block');
        }, 3000);
        return;
      }
      lock.classList.remove('is-shake'); void lock.offsetWidth; lock.classList.add('is-shake');
      sfx('error');
      lock.style.setProperty('--crack', String(Math.min(6, n)));
      bubble(lock, n >= 4 ? `${LOCKED} (${7 - n} more knocks?)` : LOCKED, { who: 'bit', place: 'below', ms: 2600 });
    });
  }
}
