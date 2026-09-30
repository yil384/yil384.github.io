// ui/attrs.js: SKILLS as attributes on the workbench (SPEC §4.4, SECTIONS-C).
// The languages, their tier words and the tools stay static HTML (plain mode shows "Python · High"). In
// the game the bars fill once when the panel comes into view, each language runs a hello world in a tiny
// console, Python can be overfilled until CUDA runs out of memory, and the six tools in the bag each do
// one small thing (Vim is famously hard to leave).
import { icon, golemPeek } from './equip.js';
import { foundCount } from '../eggs.js';
import { save } from './pstate.js';

const HELLO = {
  python: ['python', 'print("hi from La Jolla")', 'hi from La Jolla'],
  cpp: ['c++', 'std::cout << "hi\\n";', 'hi'],
  rust: ['rust', 'fn main() { println!("hi"); }', 'hi'],
  go: ['go', 'fmt.Println("hi")', 'hi'],
  typescript: ['ts', 'console.log("hi" as const)', 'hi'],
  javascript: ['js', 'console.log("hi")', 'hi'],
  verilog: ['verilog', 'always @(posedge clk) led <= ~led;', 'led: 0 → 1'],
};
const TOOLS = ['linux', 'vim', 'latex', 'websocket', 'django', 'mongodb'];

export function init(ctx) {
  const { kit, progress, P } = ctx;
  const { $, $$, h } = kit;
  const box = $('#projects .toolbox.attrs');
  if (!box) return;
  const list = $('.attrs__list', box);
  const rows = $$('.attr', box);
  const slots = $$('.inv__slot', box);
  const pre = $('.attrs__console', box);
  const code = pre?.querySelector('code') || pre;
  const game = () => kit.isGame();
  const projects = (li) => (li.dataset.projects || '').split(/\s+/).filter(Boolean).map((k) => document.querySelector(`#projects .equip__item[data-focus="${k}"]`)).filter(Boolean);
  const pulse = (els) => els.forEach((el) => { el.classList.remove('is-affine'); void el.offsetWidth; el.classList.add('is-affine'); setTimeout(() => el.classList.remove('is-affine'), 1700); });
  P.tools = P.tools && typeof P.tools === 'object' ? P.tools : {};

  // ---- header: a wrench and a quiet how-to on the right
  const label = $('.toolbox__label', box);
  if (label && !label.querySelector('.attrs__wrench')) {
    label.prepend(h('span', { class: 'attrs__wrench', 'data-game': '', 'aria-hidden': 'true' }, icon('wrench', 2)));
    label.append(h('span', { class: 'attrs__how game-only', 'aria-hidden': 'true' }, 'Click a language · use a tool'));
  }

  // ---- rows: tooltip, end-of-bar sparkle, overflow cells, phone value, Verilog LED
  rows.forEach((li, i) => {
    li.style.setProperty('--i', String(i));
    const bar = li.querySelector('.attr__bar');
    const name = li.querySelector('.attr__name')?.textContent.trim() || li.dataset.lang;
    const tier = li.querySelector('.attr__tier')?.textContent.trim() || '';
    const val = +(bar?.getAttribute('aria-valuenow') || Math.round(parseFloat(li.style.getPropertyValue('--v')) * 100) || 0);
    li.dataset.tip = `${name} · ${val} / 100 · ${tier}`;
    li.dataset.name = name;
    if (bar && !li.querySelector('.attr__spark')) {
      bar.after(
        h('span', { class: 'attr__spark', 'data-game': '', 'aria-hidden': 'true' }),
        h('span', { class: 'attr__ovf', 'data-game': '', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
        h('span', { class: 'attr__val', 'data-game': '', 'aria-hidden': 'true' }, `${val}/100`),
      );
      if (li.dataset.lang === 'verilog') bar.after(h('span', { class: 'attr__led', 'data-game': '', 'aria-hidden': 'true' }));
    }
    const hit = li.querySelector('.attr__hit');
    if (hit) {
      hit.title = li.dataset.tip;
      const hover = () => { if (game()) pulse(projects(li).filter((p) => !p.classList.contains('is-affine'))); };
      hit.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hover(); });
      hit.addEventListener('focus', hover);
      hit.addEventListener('click', () => { if (game()) runLang(li); });
    }
  });

  // ---- E on the focused workbench: jump into the first language
  kit.primary(box, () => box.querySelector('.attr__hit')?.focus());

  // ---- bars fill once in view (rows staggered 80ms; a tick per row); rendered filled under reduced motion
  if (list) {
    kit.observe(list, { threshold: 0.5 }, () => {
      box.classList.add('is-filled');
      if (!game()) return;
      if (!kit.rm()) rows.forEach((_, i) => setTimeout(() => kit.sfx('tick'), 300 + i * 80));
      progress.award({ id: 'attrs-checked', xp: 5, why: 'Attributes checked', from: label || list });
    });
  }

  // ---- console: 3 lines max, older lines scroll off; outcomes announced through kit.live
  if (pre) pre.setAttribute('aria-live', 'off');
  let seq = 0;
  const con = {
    line(text, cls = '', { type = true, cps = 40 } = {}) {
      if (!code) return Promise.resolve(null);
      code.querySelector('.con-idle')?.remove();
      const s = h('span', { class: ['cl', ...cls.split(/\s+/).filter(Boolean).map((c) => `cl--${c}`)].join(' ') });
      code.append(s);
      while (code.children.length > 3) code.firstElementChild.remove();
      if (!type) { s.textContent = text; return Promise.resolve(s); }
      return kit.typewriter(s, text, { cps }).then(() => s);
    },
  };
  if (code && !code.querySelector('.cl')) code.replaceChildren(h('span', { class: 'cl con-idle' }, '$ ', h('i', { class: 'con-cur' })));

  // ---- a language: hello world (Python also overfills when clicked again within 3s)
  let lastLang = '', lastT = 0, over = 0, oomBusy = false;
  async function runLang(li) {
    const lang = li.dataset.lang;
    const now = performance.now();
    if (lang === 'python' && lastLang === 'python' && now - lastT < 3000) {
      lastT = now;
      overfill(li);
      return;
    }
    lastLang = lang; lastT = now; over = 0;
    const [tag, src, out] = HELLO[lang] || [lang, `print("hi")`, 'hi'];
    const my = ++seq;
    kit.sfx('open');
    await con.line(`${tag} › ${src}`, 'cmd');
    if (my !== seq) return;
    await con.line(out, 'out', { type: false });
    await new Promise((r) => setTimeout(r, kit.rm() ? 0 : 160));
    if (my !== seq) return;
    await con.line('ok · compiled once, at least', 'ok', { type: false });
    li.classList.remove('is-shimmer'); void li.offsetWidth; li.classList.add('is-shimmer');
    setTimeout(() => li.classList.remove('is-shimmer'), 700);
    kit.emit('page:open', { key: 'workbench', what: lang });
    kit.echo();
    pulse(projects(li));
    if (lang === 'verilog') { li.classList.add('is-led'); setTimeout(() => li.classList.remove('is-led'), 5000); }
    kit.live(`${li.dataset.name}: hello world printed ${out}. ok.`);
  }

  function overfill(li) {
    if (oomBusy) return;
    over = Math.min(3, over + 1);
    const cells = $$('.attr__ovf i', li);
    cells.forEach((c, i) => c.classList.toggle('is-on', i < over));
    li.classList.add('is-over');
    const bar = li.querySelector('.attr__bar') || li;
    kit.float(bar, `Python ${100 + over * 10}…`, { tone: 'red' });
    kit.sfx('pop');
    ++seq; // interrupt the hello world
    if (over < 3) { con.line(`python › level = ${100 + over * 10}`, 'warn', { type: false }); return; }
    oomBusy = true;
    con.line('RuntimeError: CUDA out of memory. Tried to allocate 2.00 GiB', 'err', { type: false });
    golemPeek(kit, box);
    kit.sfx('boom');
    kit.live('Simulated: CUDA out of memory. Tried to allocate 2.00 GiB.');
    setTimeout(() => {
      cells.forEach((c) => c.classList.remove('is-on'));
      li.classList.remove('is-over');
      li.classList.remove('is-snap'); void li.offsetWidth; li.classList.add('is-snap');
      setTimeout(() => li.classList.remove('is-snap'), 500);
      kit.float(bar, 'torch.cuda.empty_cache()', { tone: 'teal' });
      con.line('>>> torch.cuda.empty_cache()', 'dim', { type: false });
      kit.emit('page:oom');
      kit.found('overfill');
      over = 0; lastLang = ''; oomBusy = false;
    }, kit.rm() ? 400 : 1500);
  }

  // ---- the tool bag
  for (const slot of slots) {
    const tool = slot.dataset.tool;
    // wrap the label text so LaTeX can swap in its logo without touching the fact
    const txt = [...slot.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (txt && !slot.querySelector('.inv__name')) {
      const nm = h('span', { class: 'inv__name' }, txt.textContent.trim());
      txt.replaceWith(nm);
      if (tool === 'latex') nm.after(h('span', { class: 'inv__tex', 'aria-hidden': 'true' }, 'L', h('sup', null, 'a'), 'T', h('sub', null, 'e'), 'X'));
    }
    if (P.tools[tool]) slot.classList.add('is-used');
    if (tool === 'latex' && P.tools.latex) slot.classList.add('is-tex');
    slot.querySelector('.inv__hit')?.addEventListener('click', () => { if (game()) useTool(slot, tool); });
  }

  let vim = null;
  function stopVim(msg) {
    if (!vim) return;
    window.removeEventListener('keydown', vim.onKey, true);
    clearTimeout(vim.t);
    vim.q?.remove();
    box.classList.remove('is-vim');
    vim = null;
    if (msg) con.line(msg, 'dim', { type: false });
  }
  function startVim(slot) {
    stopVim();
    con.line('$ vim', 'cmd', { type: false });
    con.line('Entering vim… type :q to exit.', 'warn', { type: false });
    box.classList.add('is-vim');
    let buf = '';
    let cmdl = null;
    const show = () => {
      if (!cmdl || !cmdl.isConnected) cmdl = h('span', { class: 'cl cl--cmd' });
      if (!cmdl.isConnected) { code.append(cmdl); while (code.children.length > 3) code.firstElementChild.remove(); }
      cmdl.textContent = buf || ' ';
    };
    const escaped = () => {
      stopVim();
      if (cmdl) cmdl.textContent = ':q';
      con.line('You escaped. Few do.', 'ok', { type: false });
      kit.burst(slot, { n: 10, kind: 'confetti' });
      kit.live('You escaped Vim. Few do.');
      kit.found('vimslot');
    };
    const bad = () => {
      con.line(`E492: Not an editor command: ${buf.replace(/^:/, '') || buf}`, 'err', { type: false });
      kit.sfx('error');
      buf = ''; cmdl = null;
    };
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || kit.isEditable(e.target)) return;
      const k = e.key;
      if (k.length !== 1 && k !== 'Enter' && k !== 'Escape' && k !== 'Backspace') return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (k === 'Escape') { buf = ''; cmdl = null; con.line('-- NORMAL -- (Esc is not the way out)', 'dim', { type: false }); return; }
      if (k === 'Backspace') { buf = buf.slice(0, -1); show(); return; }
      if (k === 'Enter') { if (/^:(q!?|wq|x)$/.test(buf)) escaped(); else if (buf) bad(); return; }
      buf += k;
      show();
      if (buf === ':q') { setTimeout(() => { if (vim) escaped(); }, 120); return; }
      if (!':q'.startsWith(buf) && !/^:(w|wq|x)$/.test(buf)) bad();
    };
    window.addEventListener('keydown', onKey, true);
    // a tappable :q for phones (no keyboard to type it on)
    const q = matchMedia('(pointer: coarse)').matches ? h('button', { type: 'button', class: 'gbtn gbtn--sm attrs__q' }, ':q') : null;
    if (q) { q.addEventListener('click', () => { buf = ':q'; show(); escaped(); }); pre.after(q); }
    vim = { onKey, q, t: setTimeout(() => stopVim('vim is still running in another terminal. As always.'), 10000) };
  }

  function useTool(slot, tool) {
    kit.sfx('open');
    slot.classList.remove('is-bump'); void slot.offsetWidth; slot.classList.add('is-bump');
    if (tool !== 'vim') stopVim();
    ++seq;
    switch (tool) {
      case 'linux': {
        con.line('$ uptime', 'cmd', { type: false });
        con.line('uptime: longer than this Ph.D. so far', 'out').then((s) => {
          if (!s) return;
          s.append(h('i', { class: 'con-cur con-cur--block' }));
          setTimeout(() => s.querySelector('.con-cur')?.remove(), 6000);
        });
        kit.live('uptime: longer than this Ph.D. so far.');
        break;
      }
      case 'vim': startVim(slot); kit.live('Entering vim. Type colon q to exit.'); break;
      case 'latex':
        slot.classList.add('is-tex');
        con.line('$ pdflatex cv.tex', 'cmd', { type: false });
        con.line('Overfull \\hbox (badness 10000) in paragraph at lines 42--42', 'warn');
        kit.live('Overfull hbox, badness 10000.');
        kit.found('tex');
        break;
      case 'websocket': {
        con.line('$ wscat -c ws://workbench', 'cmd', { type: false });
        con.line('101 Switching Protocols', 'ok');
        const im = document.querySelector('#projects .equip__item[data-focus="mon-im"]');
        const r = im?.getBoundingClientRect();
        if (im && r && r.bottom > 0 && r.top < innerHeight) {
          kit.flyTo(slot, im.querySelector('.equip__icon') || im, { html: '<i class="ws-dot"></i>', ms: 700 }).then(() => pulse([im]));
        }
        kit.live('101 Switching Protocols.');
        break;
      }
      case 'django':
        con.line('$ python manage.py runserver', 'cmd', { type: false });
        con.line('Starting development server … ok', 'ok');
        kit.live('Django development server: ok.');
        break;
      case 'mongodb': {
        const n = foundCount();
        con.line('> db.eggs.countDocuments()', 'cmd', { type: false });
        con.line(String(n), 'out', { type: false });
        kit.live(`${n} eggs found so far.`);
        break;
      }
      default:
    }
    kit.emit('page:open', { key: 'workbench', what: tool });
    kit.echo();
    if (!P.tools[tool]) {
      P.tools[tool] = Date.now();
      slot.classList.add('is-used');
      save();
    }
    if (TOOLS.every((t) => P.tools[t])) kit.found('hotbar');
  }

  // ---- New Game+: the bag is fresh again
  kit.on('page:ngplus', () => {
    P.tools = {};
    for (const s of slots) s.classList.remove('is-used', 'is-tex');
  });
}
