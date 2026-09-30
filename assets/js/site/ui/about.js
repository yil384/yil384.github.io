// ABOUT: the party screen / character sheet (SPEC §4.2). A pixelated portrait that crossfades to the photo,
// a nameplate with the party row, interest (affinity) chips that light up matching items all over the page,
// and Chef Zhuo as a party member with a pan. Facts stay in the prose and the <dl>; this adds game chrome.

const ZHUO = ['Tomato and egg. Eat before you debug.', 'Dinner is at seven. Bring a benchmark.', 'The secret ingredient is a deadline.'];
const AFF_NAME = { systems: 'Systems', compilers: 'Compilers', gpu: 'GPU code generation', agents: 'LLM agent tooling' };

export function init({ kit, progress, hud, P }) {
  const { $, $$, h, emit, found, sfx, say, bubble, burst, rm, isGame, spriteImg, echo } = kit;
  const sec = $('#about');
  if (!sec) return;

  // ------------------------------------------------------------ portrait: 48px pixel version, photo on hover
  const portrait = $('#portrait');
  const img = portrait && $('img', portrait);
  const cv = portrait && $('.portrait__px', portrait);
  if (img && cv) {
    const draw = () => {
      if (!img.naturalWidth || portrait.classList.contains('is-voxel')) return;
      try {
        const N = 48;
        cv.width = N; cv.height = N;
        const g = cv.getContext('2d');
        g.imageSmoothingEnabled = true;
        const s = Math.min(img.naturalWidth, img.naturalHeight);
        g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, N, N);
        // a gentle 5-bit posterise so it reads as sprite art, not a blurry photo
        const d = g.getImageData(0, 0, N, N);
        for (let i = 0; i < d.data.length; i += 4) for (let c = 0; c < 3; c++) d.data[i + c] = Math.min(255, Math.round(d.data[i + c] / 24) * 24 + 6);
        g.putImageData(d, 0, 0);
        portrait.classList.add('has-px');
      } catch (err) { console.warn('[about] portrait', err); }
    };
    img.loading = 'eager';
    if (img.complete) draw(); else img.addEventListener('load', draw, { once: true });
    // the portrait egg (eggs-dom) swaps the src: redraw only for the real photo
    img.addEventListener('load', () => { if (!portrait.classList.contains('is-voxel')) draw(); });
    const show = (on) => portrait.classList.toggle('is-photo', on);
    portrait.addEventListener('pointerenter', () => show(true));
    portrait.addEventListener('pointerleave', () => show(false));
    portrait.addEventListener('focus', () => show(true));
    portrait.addEventListener('blur', () => show(false));
    // taps on phones: the first tap shows the photo (the egg still counts every click)
    portrait.addEventListener('click', () => { if (matchMedia('(pointer: coarse)').matches) show(true); });
  }

  // ------------------------------------------------------------ nameplate party row (built here, game-only)
  const plate = $('.sheet__plate', sec);
  let partyRow = null;
  if (plate) {
    partyRow = h('span', { class: 'sheet__party', 'aria-hidden': 'true' },
      h('span', { class: 'sheet__member sheet__member--me', title: 'Yichen (party leader)' }, spriteImg('scholar', 2)));
    plate.append(partyRow);
  }
  const addChef = (animate) => {
    if (!partyRow || $('.sheet__member--zhuo', partyRow)) return;
    const m = h('span', { class: `sheet__member sheet__member--zhuo${animate && !rm() ? ' is-join' : ''}`, title: 'Chef Zhuo' }, spriteImg('chef', 2));
    partyRow.append(m);
  };

  // ------------------------------------------------------------ affinity chips
  const chips = $$('.affinity', sec);
  const out = $('.affinities__out', sec);
  const label = (el) => {
    const t = el.querySelector('.pub__title, .row__title');
    let s = (t?.querySelector('a')?.textContent || t?.firstChild?.textContent || '').trim();
    s = s.split(':')[0].trim();
    if (s.length > 18 && s.includes(',')) s = s.split(',')[0].trim();
    const kind = el.classList.contains('pub') ? 'paper' : el.classList.contains('equip__item') ? 'project' : el.classList.contains('quest') ? 'quest' : 'item';
    return `${s} (${kind})`;
  };
  let clearT = 0;
  const unmatch = () => $$('.is-match[data-match]').forEach((el) => { if (el.dataset.affinityMatch) { el.classList.remove('is-match'); delete el.dataset.match; delete el.dataset.affinityMatch; } });
  function pick(chip) {
    const k = chip.dataset.affinity;
    const was = chip.getAttribute('aria-pressed') === 'true';
    chips.forEach((c) => c.setAttribute('aria-pressed', 'false'));
    unmatch();
    clearTimeout(clearT);
    if (was) { if (out) out.replaceChildren(); return; }
    chip.setAttribute('aria-pressed', 'true');
    sfx('pop');
    const matches = $$('[data-tags]').filter((el) => (el.dataset.tags || '').split(/\s+/).includes(k));
    for (const el of matches) {
      el.classList.remove('is-match'); void el.offsetWidth;
      el.dataset.match = `matches: ${AFF_NAME[k]}`;
      el.dataset.affinityMatch = '1';
      el.classList.add('is-match');
    }
    clearT = setTimeout(unmatch, 2100);
    if (out) {
      out.replaceChildren(
        h('span', { class: 'affinities__k' }, matches.length ? `${matches.length} match${matches.length > 1 ? 'es' : ''}` : 'No matches yet'),
        ...matches.map((el) => h('button', {
          type: 'button', class: 'affinities__link',
          onclick: () => {
            el.scrollIntoView({ behavior: rm() ? 'auto' : 'smooth', block: 'center' });
            el.focus?.({ preventScroll: true });
            el.classList.remove('is-match'); void el.offsetWidth;
            el.dataset.match = `matches: ${AFF_NAME[k]}`; el.dataset.affinityMatch = '1';
            el.classList.add('is-match');
            setTimeout(unmatch, 2100);
          },
        }, label(el))),
      );
    }
    const key = matches.find((el) => el.dataset.focus)?.dataset.focus;
    emit('page:open', { key: key || 'about', what: 'affinity' });
    if (!key) echo();
    progress.award({ id: `aff-${k}`, xp: 2, why: 'Interest explored', from: chip });
    if (chips.every((c) => P.once[`aff-${c.dataset.affinity}`])) found('specialist');
  }
  chips.forEach((c) => c.addEventListener('click', () => { if (isGame()) pick(c); }));

  // ------------------------------------------------------------ party member: Chef Zhuo
  const party = $('.party', sec);
  if (party) {
    const spriteSlot = $('.party__sprite', party);
    if (spriteSlot && !spriteSlot.firstChild) spriteSlot.append(spriteImg(spriteSlot.dataset.sprite || 'chef', 4));
    // the pan (CSS pixel art) and its contents
    const pan = h('span', { class: 'party__pan', 'aria-hidden': 'true' }, h('i', { class: 'party__food' }), h('b', { class: 'party__steam' }, h('i'), h('i'), h('i')));
    spriteSlot?.after(pan);
    // a little frame: a party card with a class label
    party.prepend(h('span', { class: 'party__k', 'aria-hidden': 'true' }, 'Party member'));
    const panBtn = $('[data-act="pan"]', party);
    const invite = $('[data-act="invite"]', party);
    const tok = $('.token[data-token="t2"]', party);
    let flips = 0;
    panBtn?.addEventListener('click', () => {
      if (!isGame()) return;
      flips++;
      pan.classList.remove('is-flip'); void pan.offsetWidth; pan.classList.add('is-flip');
      sfx('pop');
      hud.refillFocus?.();
      say('zhuo', ZHUO[(flips - 1) % ZHUO.length]);
      if (flips === 1 && tok && !P.tokens.t2) {
        setTimeout(() => { tok.hidden = false; tok.classList.add('is-pop'); }, rm() ? 0 : 280);
      }
      if (flips === 3) found('zhuo');
    });
    tok?.addEventListener('click', () => {
      progress.token('t2', tok);
      tok.classList.add('is-got');
      setTimeout(() => { tok.hidden = true; }, 520);
    });
    const joined = () => {
      if (!invite) return;
      invite.textContent = 'In party ✓';
      invite.disabled = true;
      party.classList.add('is-joined');
      addChef(false);
    };
    if (P.aboutParty) joined();
    invite?.addEventListener('click', () => {
      if (!isGame() || invite.disabled) return;
      P.aboutParty = true;
      addChef(true);
      invite.textContent = 'In party ✓';
      invite.disabled = true;
      party.classList.add('is-joined');
      sfx('purchase');
      burst(plate || invite, { n: 8, kind: 'spark' });
      bubble(invite, 'I only join parties that have snacks.', { who: 'zhuo', place: 'below' });
      emit('page:open', { key: 'about', what: 'invite' });
      echo();
    });
    // New Game+ clears the party
    progress.onProgress?.((st) => {
      if (!st.reset || !invite) return;
      invite.textContent = 'Invite to party'; invite.disabled = false; party.classList.remove('is-joined');
      $('.sheet__member--zhuo', partyRow || sec)?.remove();
      if (tok && !P.tokens.t2) tok.hidden = true;
    });
  }
}
