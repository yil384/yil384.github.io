// ui/contact.js: CONTACT as the Sun God Lawn by the pier (SPEC §4.8, SECTIONS-C).
// The address, phone, affiliation and profile links stay plain HTML (mailto / tel / https). The game adds a
// pixel mailbox whose flag the 3D mailbox mirrors, a Copy button that sends a pigeon, a ringing phone,
// spinning portals around the profile links, quick-subject chips, a save point and a sleeping sea lion.
import { pixSvg } from './pubs.js';
import { outlined, icon } from './equip.js';
import { saveNow, canPersist } from './pstate.js';

const MAILBOX = {
  rows: [
    '..............',
    '...MMMMMMM....',
    '..MmmmmmmmM...',
    '.MmmmmmmmmmM..',
    '.DmmmmmmmmmM..',
    '.DmmmmmmmmmM..',
    '.DMMMMMMMMMM..',
    '......PP......',
    '......PP......',
    '......PP......',
    '....GGGGGG....',
  ],
  pal: { M: '#5b6b86', m: '#8193b2', D: '#3b4a63', P: '#9a5a2a', G: '#22c55e', o: '#0b1020' },
};
const PHONE = {
  rows: [
    '..A.......',
    '..A.......',
    '.KKKKKK...',
    '.KSSSSK...',
    '.KSSSSK...',
    '.KKKKKK...',
    '.KbKbKK...',
    '.KKbKbK...',
    '.KbKbKK...',
    '.KKKKKK...',
  ],
  pal: { A: '#94a3b8', K: '#334155', S: '#7dd3fc', b: '#cbd5e1', o: '#0b1020' },
};
const EMAIL = 'yil384@ucsd.edu';

export function init(ctx) {
  const { kit, hud } = ctx;
  const { $, $$, h } = kit;
  const sec = $('#contact');
  if (!sec) return;
  const card = sec.querySelector(':scope > .card');
  const game = () => kit.isGame();

  // ---------------------------------------------------------------- mailbox flag + email + Copy
  const line = $('.mailline', sec);
  const box = $('.mailbox', sec);
  const mail = $('#mail-link', sec);
  const copyBtn = $('[data-copy="email"]', sec);
  let flagUp = false, stay = false, toggles = 0;
  if (box && !box.querySelector('svg')) box.prepend(pixSvg(outlined(MAILBOX.rows), MAILBOX.pal, { scale: 2, cls: 'mailbox__body' }));
  const setFlag = (up, { emit = true } = {}) => {
    flagUp = up;
    box?.classList.toggle('is-up', up);
    box?.setAttribute('aria-pressed', String(up));
    if (emit) kit.emit('page:mailbox', { up });
  };
  box?.addEventListener('click', () => {
    if (!game()) return;
    setFlag(!flagUp);
    kit.sfx('open');
    kit.echo();
    toggles++;
    if (flagUp) kit.bubble(box, `Flag up. Write to me: ${EMAIL}`, { place: 'above', ms: 3000 });
    kit.live(flagUp ? 'Mailbox flag up.' : 'Mailbox flag down.');
    if (toggles >= 3) kit.found('mailbox');
  });
  if (line && box) kit.primary(line, () => box.click()); // E on the focused mail line toggles the flag
  const hoverMail = (on) => {
    if (!game()) return;
    if (on) kit.emit('page:mailbox', { up: true });
    else if (!stay && !flagUp) kit.emit('page:mailbox', { up: false });
    line?.classList.toggle('is-hot', on);
  };
  if (mail) {
    mail.addEventListener('pointerenter', () => hoverMail(true));
    mail.addEventListener('pointerleave', () => hoverMail(false));
    mail.addEventListener('focus', () => hoverMail(true));
    mail.addEventListener('blur', () => hoverMail(false));
  }
  let copyT = 0;
  copyBtn?.addEventListener('click', async () => {
    const ok = await kit.copyText(EMAIL, { selectEl: mail });
    clearTimeout(copyT);
    copyBtn.dataset.label ||= copyBtn.textContent;
    if (!ok) {
      copyBtn.textContent = 'Press Ctrl/Cmd+C';
      kit.live('Clipboard blocked. The address is selected: press Ctrl or Cmd plus C.');
      copyT = setTimeout(() => { copyBtn.textContent = copyBtn.dataset.label; }, 2600);
      return;
    }
    copyBtn.textContent = 'Copied ✓';
    copyBtn.classList.add('is-ok');
    copyT = setTimeout(() => { copyBtn.textContent = copyBtn.dataset.label; copyBtn.classList.remove('is-ok'); }, 1800);
    kit.live('Email address copied.');
    if (!game()) return;
    pigeon(copyBtn);
    kit.sfx('purchase');
    stay = true;
    setFlag(true);
    kit.found('copy');
  });

  function pigeon(from) {
    if (kit.rm() || !card) return;
    const a = from.getBoundingClientRect(), c = card.getBoundingClientRect();
    const bird = h('span', { class: 'pigeon', 'aria-hidden': 'true' }, h('span', { class: 'pigeon__b' }, icon('pigeon', 3)));
    bird.style.left = `${a.left + a.width / 2}px`;
    bird.style.top = `${a.top}px`;
    document.body.append(bird);
    const dx = c.right + 60 - (a.left + a.width / 2), dy = c.top - 90 - a.top;
    const anim = bird.animate([
      { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.25}px), calc(-50% + ${dy * 0.15 - 30}px)) scale(1)`, opacity: 1, offset: 0.2 },
      { transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% + ${dy * 0.55}px)) scale(0.95)`, opacity: 1, offset: 0.65 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.7)`, opacity: 0 },
    ], { duration: 1000, easing: 'cubic-bezier(.4,.1,.5,1)' });
    const end = () => bird.remove();
    anim.onfinish = end; anim.oncancel = end;
    setTimeout(end, 1300);
  }

  // ---------------------------------------------------------------- the phone rings
  const phone = $('a.phone', sec);
  if (phone && !phone.querySelector('.phone__i')) phone.prepend(h('span', { class: 'phone__i', 'data-game': '', 'aria-hidden': 'true' }, pixSvg(outlined(PHONE.rows), PHONE.pal, { scale: 2 })));
  let ringAt = 0;
  const ring = () => {
    if (!game()) return;
    const now = performance.now();
    phone.classList.remove('is-ring'); void phone.offsetWidth; phone.classList.add('is-ring');
    setTimeout(() => phone.classList.remove('is-ring'), 900);
    if (now - ringAt > 2000) { ringAt = now; kit.sfx('ring'); }
  };
  phone?.addEventListener('pointerenter', ring);
  phone?.addEventListener('focus', ring);

  // ---------------------------------------------------------------- portals
  const portals = $$('.portal', sec);
  const hopped = new Set();
  let warpAt = 0;
  const lastEmit = {};
  for (const a of portals) {
    const name = a.dataset.portal;
    const ringEl = a.querySelector('.portal__ring');
    if (ringEl && !ringEl.querySelector('.portal__core')) ringEl.append(h('span', { class: 'portal__core' }));
    // the label text node → a span so the tile can lay it out (text unchanged)
    const txt = [...a.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (txt) txt.replaceWith(h('span', { class: 'portal__l' }, txt.textContent));
    const hot = () => {
      if (!game()) return;
      const now = performance.now();
      if (now - warpAt > 2000) { warpAt = now; kit.sfx('warp'); }
      if (!lastEmit[name] || now - lastEmit[name] > 1200) { lastEmit[name] = now; kit.emit('page:portal', { name }); }
      if (!hopped.has(name)) {
        hopped.add(name);
        if (hopped.size >= 3) kit.found('portalhop');
      }
    };
    a.addEventListener('pointerenter', hot);
    a.addEventListener('focus', hot);
    a.addEventListener('pointerdown', () => {
      if (!game() || kit.rm()) return;
      a.classList.remove('is-warp'); void a.offsetWidth; a.classList.add('is-warp');
      setTimeout(() => a.classList.remove('is-warp'), 400);
    });
  }

  // ---------------------------------------------------------------- quick subjects
  for (const chip of $$('.compose .chip', sec)) {
    chip.addEventListener('click', () => {
      if (!game()) return;
      kit.sfx('open');
      kit.found('subject');
    });
  }

  // ---------------------------------------------------------------- save point
  const sp = $('.savepoint', sec);
  const crystal = $('.savepoint__crystal', sec);
  const spText = $('.savepoint__t', sec);
  if (crystal && !crystal.querySelector('img')) crystal.append(kit.spriteImg('crystal', 3));
  if (spText && !canPersist()) spText.textContent = 'Save point · progress lasts for this visit';
  crystal?.addEventListener('click', () => {
    if (!game()) return;
    try { saveNow(); } catch { /* storage off: the session copy stays */ }
    hud?.refillFocus?.();
    kit.sfx('heal');
    sp.classList.remove('is-saved'); void sp.offsetWidth; sp.classList.add('is-saved');
    kit.burst(crystal, { n: 10, kind: 'spark', colors: ['#4ADE80', '#bbf7d0', '#00C6D7'] });
    const msg = canPersist() ? 'Game saved. HP and FOCUS restored.' : 'Progress kept for this visit (storage is off in this browser).';
    if (spText) kit.typewriter(spText, msg, { cps: 60, sound: false });
    kit.live(msg);
    kit.emit('page:save');
    kit.echo();
    kit.found('savepoint');
  });

  // ---------------------------------------------------------------- the sea lion
  const seal = $('.sealion', sec);
  if (seal && !seal.querySelector('img')) seal.append(kit.spriteImg('sealion', 3), h('span', { class: 'sealion__z', 'aria-hidden': 'true' }, 'z'));
  let wakeT = 0;
  seal?.addEventListener('click', () => {
    if (!game()) return;
    clearTimeout(wakeT);
    seal.classList.remove('is-awake'); void seal.offsetWidth; seal.classList.add('is-awake');
    kit.sfx('squeak');
    kit.bubble(seal, 'Arf.', { place: 'above', ms: 1800 });
    kit.live('The sea lion wakes up: Arf.');
    kit.found('sealion');
    wakeT = setTimeout(() => seal.classList.remove('is-awake'), 2600);
  });
}
