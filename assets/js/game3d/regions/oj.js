// regions/oj.js: the CST-OJ tower (an online judge for data-structure coursework, in Rust, with sandboxed
// grading and a submission queue). Every floor of the tower is a test case:
//   - plaza (the judge machine, the submission queue, the TA-bot) → floor 1 WA → floor 2 TLE → floor 3 MLE →
//     floor 4 RE → the top, where the Hidden Test Case waits. Clear a floor's verdict monsters and its test
//     passes: its lamps turn green and the gate on the stairs up opens
//   - the toy judge (plaza and top floor): type code for "A + B" (or pick a canned submission) and get a
//     verdict: AC, WA, TLE, MLE, RE, CE, or a sandbox refusal. Only an Accepted solution exposes the Hidden
//     Test Case (25% damage until then). Beat it and the top floor reads AC
//   - side quest: Stu's linked list fails hidden tests; bring back three edge cases from floors 1–3
import * as THREE from 'three/webgpu';
import {
  terrain, props, registerArt, registerEnemyKind, spawnEnemy, spawnBoss, spawnNpc, interactable, trigger,
  pickup, portal, quest, egg, say, banner, toast, sfx, onUpdate, onEnter, onLeave, dialog, hasItem, cinematic,
  block, unblock,
} from '../regions.js';
import { openModal } from '../modal.js';
import { h } from '../util.js';
import { OJ_ART } from './art-oj.js';

const C = -1;                                     // the tower's centre z
const HW = [23, 19, 16, 13, 10, 7];               // half-widths: plaza, floors 1–4, top
const HT = [2, 5, 8, 11, 14, 17];                 // floor heights
const SIDES = ['S', 'E', 'N', 'W', 'S'];          // where the stairs up from each tier are
const VERDICT = ['', 'WA', 'TLE', 'MLE', 'RE'];
const FLOOR_COL = ['', '#ef4444', '#f59e0b', '#22c55e', '#facc15'];
const TEAL = '#2dd4bf';
const JUDGE = { x: 7.5, z: 21 };
const SKY = { tint: '#cbd5e1', ground: '#0e1116', fog: '#0a0d12', density: 0.0072, sun: 2.1 };

const inIsland = (x, z) => {
  const ax = Math.abs(x), az = Math.abs(z - C);
  if (ax > 23 || az > 23) return false;
  const ex = Math.max(0, ax - 18), ez = Math.max(0, az - 18);
  return ex * ex + ez * ez <= 26;
};
const tierAt = (x, z) => { const c = Math.max(Math.abs(x), Math.abs(z - C)); let k = 0; while (k < 5 && c <= HW[k + 1]) k++; return k; };
/** For tier k's stairs: [d, u] = distance out from the centre along the stair side, and the offset across it. */
function stairDU(k, x, z) {
  const dz = z - C;
  switch (SIDES[k]) { case 'S': return [dz, x]; case 'N': return [-dz, x]; case 'E': return [x, dz]; default: return [-x, dz]; }
}
function groundH(x, z) {
  if (!inIsland(x, z)) return null;
  const k = tierAt(x, z);
  if (k < 5) {
    const [d, u] = stairDU(k, x, z);
    if (Math.abs(u) <= 1 && d >= HW[k + 1] + 1 && d <= HW[k + 1] + 2) return HT[k] + (HW[k + 1] + 3 - d);
  }
  return HT[k];
}
const onStair = (x, z) => { const k = tierAt(x, z); return k < 5 && groundH(x, z) !== HT[k]; };
/** The three cells of the top step of the stairs from tier k up to k + 1 (local x, z). */
function gateCells(k) {
  const d = HW[k + 1] + 1, out = [];
  for (let u = -1; u <= 1; u++) {
    switch (SIDES[k]) { case 'S': out.push([u, C + d]); break; case 'N': out.push([u, C - d]); break; case 'E': out.push([d, C + u]); break; default: out.push([-d, C + u]); }
  }
  return out;
}
const FONT = {
  A: ['.###.', '#...#', '#####', '#...#', '#...#'],
  C: ['.####', '#....', '#....', '#....', '.####'],
  '?': ['.###.', '#...#', '...#.', '.....', '..#..'],
};

/** The toy judge: a verdict for "A + B" from a heuristic look at the code (nothing is ever run). */
function verdict(src) {
  const t = src.toLowerCase().replace(/\s+/g, '');
  if (!t) return ['CE', 'Compilation Error', 'The submission is empty. The compiler has nothing to complain about, and it is complaining anyway.'];
  if (/rm-rf|os\.system|subprocess|std::process|fork\(|exec\(|system\(|socket\(|\/etc\/passwd|curl|wget|reboot|shutdown/.test(t)) return ['SV', 'Blocked by the sandbox', 'Syscall denied. Your code runs in a sandbox with no network, no files and no shell. Nice try, though. Everyone tries.'];
  if (/while\(true\)|whiletrue|while1|while\(1\)|loop\{|for\(;;\)|sleep|goto/.test(t)) return ['TLE', 'Time Limit Exceeded', 'Your program is still running. It will be running long after the heat death of the course.'];
  if (/\d{8,}|10\*\*9|1e9|vec!\[0;|\[0\]\*\d{6,}|malloc\(|newint\[\d{6,}/.test(t)) return ['MLE', 'Memory Limit Exceeded', 'You asked for more memory than the whole judge has. It is flattered, but no.'];
  if (/panic|unwrap\(\)|\/0(?![.\d])|segfault|\[-1\]|undefined|nullptr|throw|raise/.test(t)) return ['RE', 'Runtime Error', 'thread \'main\' panicked. On the bright side: in Rust, at least it panicked politely.'];
  if (/print\w*!?\(["']?3["']?\)|cout<<3|console\.log\(3\)|return3;|puts\(["']3/.test(t)) return ['WA-H', 'Wrong Answer on test #2', 'Passed the sample (1 2 → 3). Failed the hidden test (5 7 → 12). You printed 3 for everything. Bold.'];
  if (/a\+b|b\+a|sum\(|\.add\(/.test(t)) return ['AC', 'Accepted', 'All tests passed, the hidden one included. Green across the board.'];
  if (/a-b|a\*b|a\/b|b-a|a%b|a\^b/.test(t)) return ['WA', 'Wrong Answer on test #1', 'Right idea, wrong operator. The problem is A + B.'];
  return ['WA', 'Wrong Answer on test #1', 'Expected 3, got something else. (The problem is A + B. It is always A + B.)'];
}

export default {
  id: 'oj',
  name: 'CST-OJ tower',
  subtitle: 'An online judge for data-structure coursework · Rust · sandboxed grading',
  size: 50,
  spawn: [0, 21.5],
  sky: SKY,
  zones: {
    plaza: { x: 0, z: 20.5, r: 6, label: 'Judge plaza · the submission queue' },
    f1: { x: -17.5, z: C, r: 3, label: 'Floor 1 · test #1 (WA)' },
    f1b: { x: 17.5, z: C + 8, r: 3, label: 'Floor 1 · test #1 (WA)' },
    f2: { x: 0, z: C - 14.5, r: 3, label: 'Floor 2 · test #2 (TLE)' },
    f3: { x: 0, z: C + 11.5, r: 3, label: 'Floor 3 · test #3 (MLE)' },
    f4: { x: 8.5, z: C, r: 2.6, label: 'Floor 4 · test #4 (RE)' },
    top: { x: 0, z: C, r: 7, label: 'Top floor · the hidden test' },
  },

  build(ctx) {
    for (const [name, art] of Object.entries(OJ_ART)) registerArt(name, art, name === 'oj-hidden' ? { Y: 2, W: 1.5 } : name === 'oj-edge' ? { G: 1, W: 1.5 } : name === 'oj-ta' ? { C: 0.6 } : null);
    const st = ctx.state;
    st.passed = st.passed || [false, false, false, false, false];
    let lastT = 0;

    // ================================================================ terrain: the tower
    terrain(ctx, {
      size: 50,
      height: groundH,
      type: (x, z) => {
        if (onStair(x, z)) return 'stair';
        const k = tierAt(x, z);
        if (k === 0) return (Math.round(x) + Math.round(z)) & 1 ? 'plazaA' : 'plazaB';
        if (k === 5) return (Math.round(x) % 3 === 0 || Math.round(z - C) % 3 === 0) ? 'topLine' : 'top';
        const c = Math.max(Math.abs(x), Math.abs(z - C));
        return `f${k}${c > HW[k] - 0.6 ? 'e' : ''}`;
      },
      palette: {
        plazaA: ['#334155', '#384860'], plazaB: ['#2a3546', '#2e3a4d'], stair: ['#94a3b8', '#a3b0c2'],
        f1: ['#3f1d1d', '#451f1f'], f1e: ['#b91c1c', '#dc2626'], f2: ['#3d2a12', '#432e14'], f2e: ['#b45309', '#d97706'],
        f3: ['#16301f', '#183523'], f3e: ['#15803d', '#16a34a'], f4: ['#3a3410', '#403912'], f4e: ['#a16207', '#ca8a04'],
        top: ['#1e1b4b', '#221f55'], topLine: ['#4338ca', '#4f46e5'],
      },
    });

    // ================================================================ props
    const solid = [], deco = [], glow = [];
    // the judge machine on the plaza: a server cabinet with a screen and a slot for submissions
    for (let x = 6; x <= 9; x++) for (let y = 3; y <= 6; y++) solid.push([x, y, 22, y === 6 ? '#0f172a' : '#1e293b']);
    for (let x = 6; x <= 9; x++) glow.push([x, 5, 21, x % 2 ? TEAL : '#99f6e4', 1.4]);
    deco.push([10, 3, 21, '#020617']);
    // a matching terminal on the top floor
    for (const x of [5, 6]) solid.push([x, HT[5] + 1, C - 5, '#1e293b']);
    glow.push([5, HT[5] + 2, C - 5, TEAL, 1.4], [6, HT[5] + 2, C - 5, TEAL, 1.4]);
    // the queue board
    for (let z = 17; z <= 19; z++) for (let y = 3; y <= 5; y++) (y === 3 ? solid : glow).push([15, y, z, y === 3 ? '#475569' : (z + y) % 2 ? '#1e3a8a' : '#60a5fa', 0.8]);
    // plaza benches for students waiting on their verdicts
    for (const [x, z] of [[-14, 21], [-17, 21], [-14, -22], [13, -22]]) for (let dx = 0; dx <= 1; dx++) solid.push([x + dx, 3, z, '#78350f']);
    props(ctx, solid, { block: true });
    props(ctx, deco);
    const glowMesh = props(ctx, glow, { shadow: false });
    // gates on the stairs (one mesh each), and the top floor's letters: "??" until it is Accepted
    const gates = [1, 2, 3, 4].map((k) => {
      const cells = gateCells(k), top = HT[k] + 2;
      const mesh = props(ctx, cells.flatMap(([x, z]) => [[x, top + 1, z, FLOOR_COL[k], 0.9], [x, top + 2, z, '#7f1d1d', 0.4], [x, top + 3, z, FLOOR_COL[k], 0.9]]));
      const set = (openNow) => { mesh.visible = !openNow; for (const [x, z] of cells) (openNow ? unblock : block)(ctx, x, z); };
      set(!!st.passed[k]);
      return { cells, set };
    });
    const letters = (text, color) => {
      const cells = [];
      [...text].forEach((ch, i) => FONT[ch].forEach((row, r) => [...row].forEach((c, j) => { if (c === '#') cells.push([-5 + i * 6 + j, HT[5] + 6 - r, C - 6.5, color, 1.6]); })));
      return props(ctx, cells, { shadow: false });
    };
    const lettersQ = letters('??', '#a78bfa'), lettersAC = letters('AC', '#4ade80');
    const showLetters = () => { const ac = hasItem('relic-oj'); lettersAC.visible = ac; lettersQ.visible = !ac; };
    showLetters();

    // ================================================================ instanced: floor lamps, the submission queue
    const _m = new THREE.Matrix4(), col = new THREE.Color();
    const basic = (c) => new THREE.MeshBasicNodeMaterial({ color: c });
    const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.9, 0.6), basic('#ffffff'), 16);
    lamps.castShadow = false; lamps.frustumCulled = false;
    ctx.group.add(lamps);
    for (let k = 1; k <= 4; k++) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], j) => { const d = HW[k] - 0.8; _m.makeTranslation(sx * d + ctx.ox, HT[k] + 0.95, C + sz * d + ctx.oz); lamps.setMatrixAt((k - 1) * 4 + j, _m); });
    const paintLamps = () => { for (let k = 1; k <= 4; k++) for (let j = 0; j < 4; j++) lamps.setColorAt((k - 1) * 4 + j, col.set(st.passed[k] ? '#4ade80' : '#ef4444')); lamps.instanceColor.needsUpdate = true; };
    paintLamps();
    const N_Q = 9;
    const queue = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 0.75, 0.08), basic('#ffffff'), N_Q);
    queue.castShadow = false; queue.frustumCulled = false;
    ctx.group.add(queue);
    for (let i = 0; i < N_Q; i++) queue.setColorAt(i, col.set(i % 4 === 0 ? '#bfdbfe' : '#f8fafc'));
    const qS = Array.from({ length: N_Q }, (_, i) => i / N_Q);

    // ================================================================ enemies: verdicts, floor by floor
    const kinds = {
      'oj-wa': { name: 'Wrong Answer', sprite: 'oj-wa', hp: 30, speed: 3.4, dmg: 8, type: 'Fire', xp: 18, gold: 16, behaviour: 'chase', scale: 0.22, color: '#ef4444', respawn: false },
      'oj-tle': { name: 'Time Limit Exceeded', sprite: 'oj-tle', hp: 44, speed: 1.5, dmg: 10, type: 'Normal', xp: 22, gold: 20, behaviour: 'charge', rate: 4200, scale: 0.24, color: '#fbbf24', respawn: false },
      'oj-mle': { name: 'Memory Limit Exceeded', sprite: 'oj-mle', hp: 70, speed: 1.9, dmg: 10, type: 'Grass', xp: 26, gold: 24, behaviour: 'chase', scale: 0.24, color: '#22c55e', respawn: false },
      'oj-re': { name: 'Runtime Error', sprite: 'oj-re', hp: 34, speed: 2.8, dmg: 8, type: 'Electric', xp: 22, gold: 20, behaviour: 'ranged', rate: 2200, proj: 'ember', scale: 0.22, color: '#facc15', respawn: false },
      'oj-ce': { name: 'Compile Error (missing ;)', sprite: 'oj-ce', hp: 26, dmg: 6, type: 'Normal', xp: 14, gold: 14, behaviour: 'turret', rate: 2700, proj: 'spark', aggro: 8, scale: 0.24, color: '#f43f5e' },
      'oj-sub': { name: 'Submission', sprite: 'oj-sub', hp: 4, speed: 1.3, dmg: 0, type: 'Normal', xp: 1, gold: 1, behaviour: 'wander', scale: 0.16, color: '#f8fafc' },
      'oj-wa-minion': { name: 'Wrong Answer', sprite: 'oj-wa', hp: 22, speed: 3.6, dmg: 7, type: 'Fire', xp: 8, gold: 8, behaviour: 'chase', scale: 0.2, color: '#ef4444' },
    };
    for (const [id, k] of Object.entries(kinds)) registerEnemyKind(id, k);
    const FLOOR_FOES = [null, [[-17.5, C - 3], [17.5, C + 10]], [[-14.5, C + 6], [10, C - 14.5]], [[-11.5, C + 5], [11.5, C - 6]], [[-8.5, C - 6], [8.5, C + 4]]];
    const floorFoes = FLOOR_FOES.map((list, k) => (list ? list.map(([x, z]) => spawnEnemy(ctx, { kind: ['', 'oj-wa', 'oj-tle', 'oj-mle', 'oj-re'][k], x, z, leash: 9 })) : null));
    for (const [x, z] of [[-20, C - 18], [20, C - 18]]) spawnEnemy(ctx, { kind: 'oj-ce', x, z });
    for (const [x, z] of [[-12, 20.5], [12, 21.5]]) spawnEnemy(ctx, { kind: 'oj-sub', x, z });
    function passFloor(k) {
      if (st.passed[k]) return;
      st.passed[k] = true; ctx.save();
      gates[k - 1].set(true);
      paintLamps();
      sfx('achievement');
      const all = [1, 2, 3, 4].every((i) => st.passed[i]);
      banner(`Test #${k}: passed`, all ? 'Four for four. Only the hidden test is left, at the top.' : `No more ${VERDICT[k]} on floor ${k}. The gate upstairs is open.`, 'check');
      if (all) findFloors();
    }

    // ================================================================ boss: the Hidden Test Case
    const boss = spawnBoss(ctx, {
      id: 'oj-hidden', name: 'The Hidden Test Case', sprite: 'oj-hidden', scale: 0.3, x: 0, z: C,
      hp: 460, type: 'Psychic', r: 1.8, color: '#a78bfa', contact: 11, speed: 1.2, aggro: 8.5, move: 'blink',
      pattern: ['fan', 'summon', 'rings'],
      phases: [{ below: 0.5, pattern: ['volley', 'nova', 'summon', 'charge'] }],
      minion: 'oj-wa-minion', reward: { gold: 360, xp: 135 }, drop: 'relic-oj', respawn: 45000,
      onDefeat: (b, { first }) => {
        findRelic();
        showLetters();
        banner('Accepted', first ? 'CST-OJ Relic earned. All tests passed, including the one nobody could see.' : 'Accepted again. Regression tests pass.', 'gem-pendant');
        say('me', first ? 'AC. Finally.' : 'Still AC.');
      },
    });
    const bossHit = boss.hit.bind(boss);
    let hintAt = 0;
    boss.hit = (dmg, info) => {
      if (!st.solved && lastT - hintAt > 5) { hintAt = lastT; toast('Your code has not passed the hidden test: 25% damage. Submit an Accepted solution at the judge terminal on this floor (E).', { icon: 'file-code-2', tone: 'bad' }); }
      return bossHit(st.solved ? dmg : Math.max(1, Math.round(dmg * 0.25)), info);
    };
    let introShown = false;
    trigger(ctx, { x: 0, z: C, w: 14, d: 14, minY: HT[5] - 0.5, onEnter: () => {
      if (!boss.alive || introShown) return;
      introShown = true;
      cinematic(ctx, { x: 0, y: HT[5] + 2, z: C, pitch: 0.4, dist: 15, seconds: 2 });
      banner('THE HIDDEN TEST CASE', st.solved ? 'Your solution is Accepted: it cannot hide from you now.' : 'It passes the samples, then fails you. Only an Accepted submission exposes it: use the terminal here.', 'circle-help');
      sfx('encounter');
    } });
    trigger(ctx, { x: 0, z: C, r: 2, minY: HT[5] - 0.5, onEnter: () => { if (hasItem('relic-oj') && !boss.alive) findTop(); } });

    // ================================================================ the toy judge
    function openJudge() {
      const input = h('input', { class: 'typing__input', type: 'text', maxlength: '200', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Your code', placeholder: 'print(a + b)   ·   any language, one line' });
      let handle = null;
      const go = (code) => { handle.close(); judge(code); };
      const canned = (label, code) => h('button', { type: 'button', class: 'btn', onclick: () => go(code) }, label);
      handle = openModal({
        id: 'oj-judge', title: 'CST-OJ · Problem 1000: A + B', className: 'game-panel',
        body: (b) => b.append(
          h('p', { class: 'game__hint' }, 'Read two integers a and b. Print a + b. Sample: "1 2" → "3". Any language. Your code never runs: this judge only reads it, which is the safest sandbox of all.'),
          input,
          h('div', { class: 'modal__actions' }, h('button', { type: 'button', class: 'btn', onclick: () => go(input.value) }, 'Submit')),
          h('p', { class: 'game__hint' }, 'Or submit something from the pile of old homework:'),
          h('div', { class: 'modal__actions' }, canned('print(a + b)', 'print(a + b)'), canned('while True: pass', 'while True: pass'), canned('print(3)', 'print(3)'), canned('os.system("rm -rf /")', 'os.system("rm -rf /")')),
        ),
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(input.value); } });
    }
    ctx.debug = { judge: (code) => judge(code) };
    function judge(code) {
      const [v, title, text] = verdict(String(code || ''));
      st.subs = (st.subs || 0) + 1; ctx.save();
      const n = st.subs;
      sfx('tick');
      toast(`Submission #${n} queued. Position in the submission queue: ${1 + (n % 3)}.`, { icon: 'hourglass' });
      setTimeout(() => { sfx('tick'); toast('Judging in the sandbox… test 1… test 2… hidden test…', { icon: 'cpu' }); }, 900);
      setTimeout(() => {
        const ac = v === 'AC';
        sfx(ac ? 'achievement' : 'error');
        banner(`${v === 'WA-H' ? 'WA' : v} · ${title}`, text, ac ? 'check' : v === 'SV' ? 'lock' : 'x');
        ({ AC: findAC, TLE: findTLE, SV: findSandbox, 'WA-H': findHardcode, CE: findCE, MLE: findMLE, RE: findRE }[v])?.();
        if (ac && !st.solved) {
          st.solved = true; ctx.save();
          if (boss.alive) setTimeout(() => banner('The Hidden Test Case is exposed', 'Your Accepted solution covers it. Full damage.', 'eye'), 2600);
        }
      }, 2000);
    }
    for (const [x, z, label] of [[JUDGE.x, JUDGE.z - 1.6, 'CST-OJ judge'], [5.5, C - 3.8, 'Judge terminal']]) {
      interactable(ctx, { x, z, r: 2.2, label, prompt: 'E · submit code', onInteract: () => openJudge() });
    }
    interactable(ctx, { x: 13.8, z: 18, r: 2.2, label: 'Submission queue', prompt: 'E · read', onInteract: () => {
      findQueue();
      dialog({ text: 'SUBMISSION QUEUE. Submissions line up here and the judge takes them one at a time, each in its own sandbox. Now judging: someone\'s binary search tree. Waiting: 3. Status of the student who submitted eleven times in a minute: seen.', choices: [{ label: 'First in, first judged' }] }, { name: 'Submission queue', sprite: 'oj-sub' });
    } });

    // ================================================================ NPCs
    spawnNpc(ctx, {
      id: 'oj-ta', name: 'TA-bot', sprite: 'oj-ta', x: -4, z: 20, face: 3.3,
      news: () => !st.metTA,
      talk: () => {
        st.metTA = true; ctx.save();
        findCourse();
        return {
          text: hasItem('relic-oj')
            ? 'You got Accepted on the hidden test! I will put that on the course page. Anonymously. As "a student".'
            : 'Welcome to CST-OJ, the online judge for the data-structure course! Submissions wait in the queue, run in a sandbox, and get a verdict. I am the TA-bot. I have seen things.',
          choices: [
            { label: 'What is this tower?', icon: 'circle-help', next: { text: 'Every floor is a test case. Floor 1 is haunted by Wrong Answers, floor 2 by Time Limit Exceededs (they are slow, then suddenly not), floor 3 by Memory Limit Exceededs, floor 4 by Runtime Errors. Clear a floor and its test passes; the gate up opens. The Hidden Test Case waits at the top.', choices: [{ label: 'Got it' }] } },
            { label: 'What is it written in?', next: () => { findRust(); return { text: 'Rust. The judge core, the grading, the queue. Fast, and the compiler rejects half of the bugs before they ever reach me. The other half reach me.', choices: [{ label: 'Respect' }] }; } },
            { label: 'Let me submit something', icon: 'file-code-2', action: () => openJudge() },
            { label: 'Office hours?', next: { text: 'Stu is on floor 1, west side, staring at a linked list that fails the hidden tests. Help them find their edge cases, would you? I have 300 other submissions to look at.', choices: [{ label: 'Sure' }] } },
            { label: 'Bye' },
          ],
        };
      },
    });
    spawnNpc(ctx, {
      id: 'oj-stu', name: 'Stu · student', sprite: 'oj-stu', x: -17.5, z: C + 3, face: 1.4,
      news: () => !st.metStu || ((st.edges || 0) >= 3 && !st.edgeDone),
      talk: () => {
        st.metStu = true; ctx.save();
        const n = st.edges || 0;
        if (st.edgeDone) return { text: 'Accepted! My linked list survives an empty list, one node and the biggest input. I am never touching pointers again. (I am touching pointers again tomorrow, the next assignment is a tree.)', choices: [{ label: 'Good luck' }] };
        if (n >= 3) {
          st.edgeDone = true; ctx.save();
          sfx('achievement'); findEdge();
          banner('Office hours: success', 'Three edge cases handled. Stu\'s submission: Accepted.', 'check');
          return { text: 'An empty list, a single node, and the maximum size. Adding the checks… resubmitting… it\'s in the queue… judging… ACCEPTED! Thank you!!', choices: [{ label: 'You did the work' }] };
        }
        return {
          text: `My linked list passes the samples but gets Wrong Answer on the hidden tests. I must be missing edge cases. I heard there is one lying around on each of the first three floors. You have ${n} of 3.`,
          choices: [
            { label: 'Which edge cases?', next: { text: 'The usual suspects: the empty input, a single element, and the maximum size. Floors 1, 2 and 3. I would go myself but the Wrong Answers keep chasing me.', choices: [{ label: 'On it' }] } },
            { label: 'On it' },
          ],
        };
      },
    });
    for (const [id, x, z, what] of [['oj-edge-1', -17.5, C - 11, 'the empty input'], ['oj-edge-2', 14.5, C + 10, 'a single element'], ['oj-edge-3', -11.5, C - 8, 'the maximum size']]) {
      pickup(ctx, { id, x, z, sprite: 'oj-edge', scale: 0.16, onPick: () => {
        st.edges = (st.edges || 0) + 1; ctx.save();
        toast(st.edges < 3 ? `Edge case (${st.edges}/3): ${what}.` : `Edge case (3/3): ${what}. Back to Stu on floor 1!`, { icon: 'list-checks' });
      } });
    }
    portal(ctx, { x: -8, z: 21.5, to: 'hub', color: TEAL });
    trigger(ctx, { x: 0, z: 17, r: 2.5, once: true, onEnter: () => say('bit', 'A tower of test cases… and the top one is hidden. Classic.') });

    // ================================================================ quests + eggs
    quest({
      id: 'oj-climb', title: 'All tests passed',
      steps: [
        ...[1, 2, 3, 4].map((k) => ({ id: `f${k}`, text: `Floor ${k}: clear the ${VERDICT[k]}s`, done: () => !!st.passed[k] })),
        { id: 'ac', text: 'Get an Accepted at a judge terminal', done: () => !!st.solved },
        { id: 'boss', text: 'Beat the Hidden Test Case (top floor)', done: () => boss.defeated },
      ],
      reward: { gold: 150, xp: 60 },
    });
    quest({
      id: 'oj-edges', title: 'Office hours',
      steps: [
        { id: 'meet', text: 'Talk to Stu on floor 1', done: () => !!st.metStu },
        { id: 'find', text: 'Find 3 edge cases (floors 1–3)', done: () => (st.edges || 0) >= 3 },
        { id: 'back', text: 'Bring them to Stu', done: () => !!st.edgeDone },
      ],
      reward: { gold: 160, xp: 70 },
    });
    const findCourse = egg('oj-course', 'Data-structure coursework', 'Talk to the TA-bot on the CST-OJ plaza.', 'CST-OJ: an online judge built for a data-structure course.');
    const findRust = egg('oj-rust', 'Judged in Rust', 'Ask the TA-bot what CST-OJ is written in.', 'The judge is written in Rust.');
    const findAC = egg('oj-ac', 'Accepted', 'Get an AC from the toy judge.', 'print(a + b). The most satisfying word in competitive programming.');
    const findTLE = egg('oj-tle', 'Time Limit Exceeded', 'Submit an infinite loop to the toy judge.', 'It is still running somewhere.');
    const findMLE = egg('oj-mle', 'Memory Limit Exceeded', 'Ask the toy judge for a billion of something.', 'The judge declined, politely.');
    const findRE = egg('oj-re', 'Runtime Error', 'Make your submission panic.', 'thread \'main\' panicked. Politely.');
    const findCE = egg('oj-ce', 'Compilation Error', 'Submit nothing at all.', 'Empty file, full complaints.');
    const findHardcode = egg('oj-hardcode', 'Hardcoded the sample', 'Submit print(3).', 'Passes the sample, fails the hidden test. Every student tries it once.');
    const findSandbox = egg('oj-sandbox', 'Sandboxed', 'Try to break out of the judge.', 'Sandboxed grading: no shell, no network, no files. Nice try.');
    const findQueue = egg('oj-queue', 'The submission queue', 'Read the queue board on the plaza.', 'Submissions wait their turn; the judge takes them one by one.');
    const findFloors = egg('oj-floors', '4 / 4 tests passed', 'Clear the verdict monsters on all four floors.', 'WA, TLE, MLE, RE: all green.');
    const findEdge = egg('oj-edges', 'Edge cases', 'Bring Stu the three edge cases.', 'Empty, one, maximum. The holy trinity of hidden tests.');
    const findRelic = egg('oj-relic', 'All tests passed', 'Defeat the Hidden Test Case.', 'CST-OJ Relic earned.');
    const findTop = egg('oj-top', 'AC', 'Stand in the middle of the top floor after it is Accepted.', 'Green, at last. Screenshot it for the group chat.');

    // ================================================================ per frame
    let wasAlive = boss.alive, flick = 0;
    onUpdate(ctx, (dt, t) => {
      lastT = t;
      glowMesh.userData.setHi(0.2 + 0.2 * Math.sin(t * 2.2));
      // the submission queue shuffles into the judge
      for (let i = 0; i < N_Q; i++) {
        qS[i] = (qS[i] + dt * 0.05) % 1;
        const x = 14 - qS[i] * 4.4, hop = Math.abs(Math.sin((t + i) * 5)) * 0.18;
        _m.makeTranslation(x + ctx.ox, 2.95 + hop, 20.5 + ctx.oz);
        queue.setMatrixAt(i, _m);
      }
      queue.instanceMatrix.needsUpdate = true;
      // floors pass when their verdicts are gone
      for (let k = 1; k <= 4; k++) if (!st.passed[k] && floorFoes[k].every((f) => !f.alive)) passFloor(k);
      // the boss flickers while it is still hidden
      if (boss.alive && !wasAlive) introShown = false;
      wasAlive = boss.alive;
      if (boss.alive) {
        flick -= dt;
        if (!st.solved && flick <= 0) { flick = 0.15 + Math.random() * 0.5; boss.mesh.visible = Math.random() > 0.3; }
        if (st.solved) boss.mesh.visible = true;
        boss.name = st.solved ? 'The Hidden Test Case · exposed' : 'Test #? · hidden';
      }
    });

    onEnter(ctx, () => {
      showLetters();
      if (!st.visited) { st.visited = true; ctx.save(); setTimeout(() => say('bit', 'Every floor is a test case. Up there it just says "??".'), 900); }
      if (!hasItem('relic-oj')) setTimeout(() => say('oj-ta', 'Submissions this way!'), 2500);
    });
    onLeave(ctx, () => { if (boss.alive) { boss.hp = boss.maxHp; introShown = false; } });
  },
};
