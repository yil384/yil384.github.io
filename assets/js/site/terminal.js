// A tiny pretend shell, opened with the backtick key. It is mostly jokes, but it is also a real way
// to navigate the page (ls / cat / play) and the hiding place of three eggs: sudo, rm -rf /, vim.
import { found, foundCount, total } from './eggs.js';

let root = null;
let out = null;
let input = null;
let getWorld = () => null;
const history = [];
let hi = 0;
let mode = 'shell';          // 'shell' | 'vim'
let busy = false;

const FILES = {
  'about.md': () => 'Ph.D. student at UC San Diego CSE (advisor: Yufei Ding). AI for science and chip design, architecture for agentic workloads, harnesses and benchmarks. Previously Tsinghua, CS.',
  'contact.txt': () => 'yil384@ucsd.edu · (858) 319-7361 · La Jolla, CA',
  'publications.bib': () => '@inproceedings{tritongym2026,\n  title = {TritonGym: A Benchmark for Agentic LLM Workflows in Triton GPU Code Generation},\n  note  = {Under review, ICML 2026}\n}\n@inproceedings{reh2o2023,\n  title = {(Re)^2H_2O: Autonomous Driving Scenario Generation ...},\n  booktitle = {IEEE IV}, year = {2023}\n}',
  'stack.txt': () => 'Python  C++  Rust  Go  TypeScript  JavaScript  Verilog\nLinux  Vim  LaTeX  WebSocket  Django  MongoDB',
  'todo.txt': () => '[x] write the paper\n[x] rebuttal\n[ ] sleep\n[ ] reply to Reviewer #2 politely\n[ ] find all the eggs',
  'secrets.txt': () => 'permission denied. (nice try.)',
};
const DIRS = { '~': ['about.md', 'contact.txt', 'publications.bib', 'stack.txt', 'todo.txt', 'secrets.txt', 'ucsd/'], 'ucsd': ['geisel/', 'cse/', 'sun_god/', 'scripps_pier/'] };
let cwd = '~';

const FORTUNES = [
  'Your paper will be accepted, pending three rounds of minor revisions.',
  'A wild reviewer appears. It asks for one more baseline.',
  'You will soon debug something that has been correct all along.',
  'The bug is in the last place you looked, because you stopped looking.',
  'Reject and resubmit to a better venue. It will be fine.',
  'Today is a good day to write the related-work section first.',
  'NaN. But you already knew.',
];

function print(text = '', cls = '') {
  const el = document.createElement('div');
  if (cls) el.className = cls;
  el.textContent = text;
  out.append(el);
  out.scrollTop = out.scrollHeight;
}

function build() {
  root = document.createElement('div');
  root.className = 'term';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Terminal');
  root.innerHTML = `
    <div class="term__bar"><span class="term__dots"><i title="close"></i><i></i><i></i></span><span>visitor@island: ~ — press \` to close</span></div>
    <div class="term__out" aria-live="polite"></div>
    <label class="term__in"><span class="term__ps"></span><input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Terminal input"></label>`;
  document.body.append(root);
  out = root.querySelector('.term__out');
  input = root.querySelector('input');
  root.querySelector('.term__dots i').addEventListener('click', close);
  if (matchMedia('(pointer: coarse)').matches) {
    root.querySelector('.term__bar > span:last-child').textContent = 'visitor@island: ~';
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'term__x'; x.setAttribute('aria-label', 'Close the terminal'); x.textContent = '×';
    x.addEventListener('click', close);
    root.querySelector('.term__bar').append(x);
  }
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const line = input.value; input.value = ''; run(line); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) input.value = history[--hi] || ''; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (hi < history.length - 1) input.value = history[++hi]; else { hi = history.length; input.value = ''; } }
    else if (e.key === 'Tab') { e.preventDefault(); complete(); }
    else if (e.key === 'Escape' || e.key === '`') { e.preventDefault(); close(); }
  });
  root.addEventListener('mousedown', (e) => { if (!e.target.closest('.term__bar')) setTimeout(() => input.focus(), 0); });
  print('Welcome to the island shell. Type `help`.', 'dim');
  setPS();
}

const COMMANDS = ['help', 'ls', 'cd', 'pwd', 'cat', 'whoami', 'sudo', 'rm', 'vim', 'nvidia-smi', 'ping', 'git', 'fortune', 'geisel', 'tritons', 'hire', 'play', 'eggs', 'clear', 'exit', 'coffee', 'make', 'echo', 'date', 'uname', 'top', 'intro'];
function complete() {
  const v = input.value;
  const parts = v.split(' ');
  const last = parts.pop();
  const pool = parts.length ? (DIRS[cwd] || []).map((f) => f.replace(/\/$/, '')) : COMMANDS;
  const hits = pool.filter((c) => c.startsWith(last));
  if (hits.length === 1) input.value = [...parts, hits[0]].join(' ') + ' ';
  else if (hits.length > 1) print(hits.join('  '), 'dim');
}
function setPS() { root.querySelector('.term__ps').textContent = mode === 'vim' ? ':' : `visitor@island:${cwd}$`; }

function open() {
  if (!root) build();
  root.classList.add('is-open');
  setTimeout(() => input.focus(), 60);
  found('terminal');
}
function close() { root?.classList.remove('is-open'); }
export function toggleTerminal(gw) {
  if (gw) getWorld = gw;
  if (!root || !root.classList.contains('is-open')) open(); else close();
}

async function run(raw) {
  if (busy) return;
  const line = raw.trim();
  if (mode === 'vim') {
    print(`:${line}`, 'cmd');
    if (/^:?(q!?|wq!?|x)$/.test(line) || /^:(q|wq|x)!?$/.test(line)) { mode = 'shell'; setPS(); print('(you escaped, this time)', 'dim'); }
    else print(line.startsWith(':') ? 'E492: Not an editor command' : '-- INSERT -- (type :q! and Enter to leave)', 'err');
    return;
  }
  print(`visitor@island:${cwd}$ ${raw}`, 'cmd');
  if (!line) return;
  history.push(line); hi = history.length;
  const [cmd, ...args] = line.split(/\s+/);
  const rest = args.join(' ');
  switch (cmd) {
    case 'help':
      print('help ls cd pwd cat whoami sudo vim nvidia-smi ping git fortune geisel tritons hire play eggs intro coffee clear exit\n(and one or two you should not run)', 'dim');
      break;
    case 'ls': {
      const target = args[0] && !args[0].startsWith('-') ? args[0].replace(/\/$/, '') : cwd;
      const list = DIRS[target === '~' || target === '..' ? '~' : target];
      print(list ? list.join('  ') : `ls: cannot access '${target}': No such file or directory`, list ? '' : 'err');
      break;
    }
    case 'cd': {
      const t = (args[0] || '~').replace(/\/$/, '');
      if (t === '~' || t === '..' || t === '') cwd = '~';
      else if (DIRS[t]) cwd = t;
      else print(`cd: ${t}: No such file or directory`, 'err');
      setPS();
      break;
    }
    case 'pwd': print(cwd === '~' ? '/home/visitor' : `/home/visitor/${cwd}`); break;
    case 'cat': {
      const f = args[0];
      if (!f) print('cat: missing operand', 'err');
      else if (FILES[f]) print(FILES[f](), f === 'secrets.txt' ? 'err' : '');
      else print(`cat: ${f}: No such file or directory`, 'err');
      break;
    }
    case 'whoami': print('visitor (not yichen)'); break;
    case 'uname': print('Island 5.26-lowpoly x86_64 GNU/Voxel'); break;
    case 'date': print(new Date().toString()); break;
    case 'echo': print(rest); break;
    case 'top': print('PID  USER      %CPU  COMMAND\n  1  reviewer2  99.9  ./ask_for_more_baselines\n  7  yichen    0.3   sleep 1000000\n 42  bit       12.0  hop.sh', 'dim'); break;
    case 'sudo':
      if (/sandwich/.test(rest)) print('Okay.');
      else { print('visitor is not in the sudoers file. This incident will be reported.', 'err'); found('sudo'); }
      break;
    case 'rm':
      if ((/\s-[a-z]*r[a-z]*\b/.test(line) && /\s\/\*?(\s|$)/.test(line)) || /--no-preserve-root/.test(line)) await rmrf();
      else print(args.length ? `rm: cannot remove '${args.at(-1)}': Permission denied` : 'rm: missing operand', 'err');
      break;
    case 'vim': case 'vi': case 'nano': case 'emacs':
      mode = 'vim'; setPS(); found('vim');
      print('~\n~\n~                VIM - Vi IMproved\n~\n~       type :q! and press Enter to exit\n~\n~', 'dim');
      break;
    case 'nvidia-smi': nvidia(); break;
    case 'ping':
      print(`PING ${rest || 'reviewer2'} (0.0.0.0): 56 data bytes`);
      print('Request timeout for icmp_seq 0\nRequest timeout for icmp_seq 1\n--- reviewer2 ping statistics ---\n2 packets transmitted, 0 received, 100% packet loss (they are "carefully reading")', 'dim');
      break;
    case 'git':
      if (args[0] === 'blame') print('^a3f9e1c (Reviewer #2) 2026-01-02  "you should really cite my work"');
      else if (args[0] === 'log') print('commit 8c1d2fa  fix: attention is not all you need\ncommit 51b0e77  add one more baseline (again)\ncommit 00a17c3  initial commit: hope', 'dim');
      else if (args[0] === 'checkout' || args[0] === 'stash') print('Already up to date. The island was never gone.', 'dim');
      else print('git: I only know blame and log here.', 'dim');
      break;
    case 'fortune': print(FORTUNES[Math.floor(Math.random() * FORTUNES.length)]); break;
    case 'coffee': print('HTTP 418: I am a teapot.'); break;
    case 'make': print(rest === 'coffee' ? 'HTTP 418: I am a teapot.' : `make: *** No rule to make target '${rest || 'all'}'.  Stop.`, rest === 'coffee' ? '' : 'err'); break;
    case 'geisel': {
      const w = getWorld();
      if (w) { w.stage.liftoff(); found('geisel'); print('Geisel Library has left the chat.'); } else print('The island is not running on this device.', 'err');
      break;
    }
    case 'tritons': case 'gotritons':
      print('GO TRITONS!');
      getWorld()?.say('me', 'GO TRITONS!');
      break;
    case 'hire': case 'hire-me': print('Yichen is a Ph.D. student, not a job posting. But: yil384@ucsd.edu.'); break;
    case 'play': { const w = getWorld(); if (w) { close(); w.enterPlay(); } else print('The island is not running on this device.', 'err'); break; }
    case 'eggs': print(`${foundCount()} / ${total()} eggs found.`); break;
    case 'intro': {
      // the opening animation again: reload with ?intro=1 (intro/intro.js)
      print('Rewinding to 23:59 AoE…', 'dim');
      const u = new window.URL(location.href);
      u.searchParams.set('intro', '1');
      u.hash = '';
      setTimeout(() => location.assign(u.href), 450);
      break;
    }
    // phones have no arrow keys and nowhere to type a name: the shell takes both
    case 'yichen': case 'lin': case 'yil384': print(found('typename') ? 'Autocomplete: yichen → Yichen Lin, Ph.D. student, UC San Diego.' : 'Yes, that is him.'); break;
    case 'konami': case 'uuddlrlrba': case '↑↑↓↓←→←→ba': print(found('konami') ? 'Thirty lives granted. All of them will be spent on rebuttals.' : 'You already have thirty lives.'); break;
    case 'clear': out.replaceChildren(); break;
    case 'exit': close(); break;
    default: print(`${cmd}: command not found. Try \`help\`.`, 'err');
  }
}

function nvidia() {
  found('nvidia');
  const row = (i) => `|   ${i}  NVIDIA H100 80GB HBM3    On  | 00000000:${(i * 16 + 10).toString(16).toUpperCase().padStart(2, '0')}:00.0 Off |                    0 |\n| N/A   ${60 + i * 2}C    P0   ${610 + i * 7}W / 700W |  79812MiB / 81559MiB |    99%      Default |`;
  print(`Mon Jan  1 00:00:00 2026\n+---------------------------------------------------------------------------------------+\n| NVIDIA-SMI 550.54   Driver Version: 550.54   CUDA Version: 12.4                         |\n|-----------------------------------------+----------------------+----------------------+\n${[0, 1, 2, 3].map(row).join('\n|-----------------------------------------+----------------------+----------------------+\n')}\n+-----------------------------------------+----------------------+----------------------+\n| Processes:                                                                             |\n|    0-3   N/A  N/A   31337   C   python train.py --please-converge         79800MiB    |\n|   (the other GPUs belong to someone else's job. yours is in the queue)                |\n+---------------------------------------------------------------------------------------+`, 'dim');
}

async function rmrf() {
  const w = getWorld();
  found('rmrf');
  busy = true;
  for (const l of ['rm: removing /usr ...', 'rm: removing /home/yichen/thesis ...', 'rm: removing /island ...']) { print(l, 'err'); await sleep(420); }
  if (w) {
    w.stage.collapse();
    print('The island shudders.', 'hi');
    await sleep(5200);
    print('...\nrestoring from backup (there was a backup, right?)', 'dim');
    await sleep(2600);
    print('Restored. Never do that again.', 'hi');
  } else print('Nothing happened. (There was no island to lose.)', 'dim');
  busy = false;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
