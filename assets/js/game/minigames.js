// Mini-games. Each one is a modal, so the world is paused while you play: no boss fireballs,
// no frost fields, and the arrow keys drive the game instead of the character.
import { S, save } from './state.js';
import { emit } from './bus.js';
import { reward } from './player.js';
import { openModal, isModalOpen } from './modal.js';
import { h, pick } from './util.js';
import { sfx } from './audio.js';

function finish(name, text, gold, xp) {
  if (gold || xp) reward({ gold, xp });
  save();
  emit('minigame', name);
  return `${text}${gold ? ` +${gold} gold` : ''}${xp ? `, +${xp} XP` : ''}`;
}

// ================================================================= typing sprint
const SNIPPETS = [
  'def forward(self, x):',
  'import torch.nn as nn',
  'tl.store(out_ptr + offs, acc)',
  'for i in range(num_warps):',
  'fn main() -> Result<()>',
  'git push origin main',
  'cudaDeviceSynchronize();',
  'let mut buf = Vec::new();',
  'SELECT * FROM papers;',
  'make -j$(nproc) && ./run',
];

export function openTyping() {
  let target = '';
  let start = 0;
  let timer = 0;
  let done = false;
  const handle = openModal({
    id: 'typing',
    title: "Pikachu's coding sprint",
    className: 'game-panel',
    onClose: () => clearInterval(timer),
    body: (b) => {
      b.append(
        h('p', { class: 'game__hint' }, 'Type the line exactly. The clock starts on your first key.'),
        h('pre', { class: 'typing__target' }),
        h('input', { class: 'typing__input', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Type the code line', autofocus: true }),
        h('div', { class: 'game__stats' },
          h('span', null, 'Time ', h('b', { 'data-t': '' }, '0.0'), 's'),
          h('span', null, 'Best ', h('b', { 'data-best': '' }, S.best.typing ? `${S.best.typing.toFixed(1)}s` : '—')),
        ),
        h('p', { class: 'game__result', 'aria-live': 'polite' }),
        h('div', { class: 'modal__actions' },
          h('button', { type: 'button', class: 'btn', 'data-next': '' }, 'New line'),
        ),
      );
    },
  });
  const body = handle.body;
  const input = body.querySelector('input');
  const tgt = body.querySelector('.typing__target');
  const tEl = body.querySelector('[data-t]');
  const result = body.querySelector('.game__result');

  function next() {
    target = pick(SNIPPETS.filter((s) => s !== target));
    start = 0;
    done = false;
    clearInterval(timer);
    tEl.textContent = '0.0';
    result.textContent = '';
    input.value = '';
    input.disabled = false;
    input.className = 'typing__input';
    paint('');
    input.focus();
  }

  function paint(v) {
    tgt.replaceChildren(...[...target].map((ch, i) => {
      const cls = i < v.length ? (v[i] === ch ? 'ok' : 'bad') : i === v.length ? 'cur' : '';
      return h('span', { class: cls }, ch);
    }));
  }

  const block = (e) => { e.preventDefault(); result.textContent = 'No pasting — type it out! ⌨️'; };
  input.addEventListener('paste', block);
  input.addEventListener('drop', block);
  input.addEventListener('input', (e) => {
    if (done) return;
    if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') { input.value = ''; paint(''); return; }
    const v = input.value;
    if (!start && v.length) {
      start = performance.now();
      timer = setInterval(() => { tEl.textContent = ((performance.now() - start) / 1000).toFixed(1); }, 100);
    }
    paint(v);
    input.classList.toggle('is-wrong', !target.startsWith(v));
    if (v === target) {
      done = true;
      clearInterval(timer);
      const secs = (performance.now() - start) / 1000;
      tEl.textContent = secs.toFixed(1);
      input.disabled = true;
      input.classList.add('is-right');
      const cpm = Math.round((target.length / secs) * 60);
      // ~20 keystrokes per second is beyond human; treat it as a macro and pay nothing.
      if (target.length / secs > 20) {
        result.textContent = `${secs.toFixed(1)}s? Suspiciously fast… no reward this time.`;
        body.querySelector('[data-next]').focus();
        return;
      }
      const gold = secs < 4 ? 200 : secs < 6 ? 120 : secs < 9 ? 60 : 25;
      if (!S.best.typing || secs < S.best.typing) {
        S.best.typing = Math.round(secs * 10) / 10;
        body.querySelector('[data-best]').textContent = `${S.best.typing.toFixed(1)}s`;
      }
      sfx('achievement');
      result.textContent = finish('typing', `${secs.toFixed(1)}s · ${cpm} chars/min!`, gold, 20);
      body.querySelector('[data-next]').focus();
    }
  });
  body.querySelector('[data-next]').addEventListener('click', next);
  next();
}

// ================================================================= memory match
const CARDS = [['🐍', 'Python'], ['⚙️', 'C++'], ['🦀', 'Rust'], ['🐹', 'Go'], ['🟦', 'TypeScript'], ['⚡', 'Triton']];

export function openMemory() {
  let flipped = [];
  let matched = 0;
  let lock = false;
  let start = 0;
  let timer = 0;
  let moves = 0;
  let dealId = 0;
  const handle = openModal({
    id: 'memory',
    title: "Kirby's memory match",
    className: 'game-panel',
    onClose: () => clearInterval(timer),
    body: (b) => b.append(
      h('p', { class: 'game__hint' }, 'Match the language pairs.'),
      h('div', { class: 'memory' }),
      h('div', { class: 'game__stats' },
        h('span', null, 'Time ', h('b', { 'data-t': '' }, '0.0'), 's'),
        h('span', null, 'Pairs ', h('b', { 'data-p': '' }, '0'), '/6'),
        h('span', null, 'Best ', h('b', { 'data-best': '' }, S.best.memory ? `${S.best.memory.toFixed(1)}s` : '—')),
      ),
      h('p', { class: 'game__result', 'aria-live': 'polite' }),
      h('div', { class: 'modal__actions' }, h('button', { type: 'button', class: 'btn', 'data-new': '' }, 'Shuffle')),
    ),
  });
  const body = handle.body;
  const grid = body.querySelector('.memory');
  const result = body.querySelector('.game__result');

  function deal() {
    const deck = CARDS.flatMap((c, i) => [{ i, face: c[0], label: c[1] }, { i, face: c[0], label: c[1] }]);
    for (let k = deck.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [deck[k], deck[j]] = [deck[j], deck[k]];
    }
    dealId++;
    flipped = []; matched = 0; lock = false; start = 0; moves = 0;
    clearInterval(timer);
    body.querySelector('[data-t]').textContent = '0.0';
    body.querySelector('[data-p]').textContent = '0';
    result.textContent = '';
    grid.replaceChildren(...deck.map((c) => {
      const card = h('button', { type: 'button', class: 'memory__card', 'aria-label': 'Hidden card' },
        h('span', { class: 'memory__back' }, '?'),
        h('span', { class: 'memory__face' }, h('span', null, c.face), h('small', null, c.label)),
      );
      card.addEventListener('click', () => flip(card, c));
      return card;
    }));
  }

  function flip(card, c) {
    if (lock || card.classList.contains('is-up')) return;
    if (!start) {
      start = performance.now();
      timer = setInterval(() => { body.querySelector('[data-t]').textContent = ((performance.now() - start) / 1000).toFixed(1); }, 100);
    }
    card.classList.add('is-up');
    card.setAttribute('aria-label', c.label);
    flipped.push({ card, c });
    if (flipped.length < 2) return;
    moves++;
    const [a, b] = flipped;
    if (a.c.i === b.c.i) {
      a.card.classList.add('is-matched');
      b.card.classList.add('is-matched');
      flipped = [];
      matched++;
      sfx('coin');
      body.querySelector('[data-p]').textContent = String(matched);
      if (matched === CARDS.length) {
        clearInterval(timer);
        const secs = (performance.now() - start) / 1000;
        if (!S.best.memory || secs < S.best.memory) {
          S.best.memory = Math.round(secs * 10) / 10;
          body.querySelector('[data-best]').textContent = `${S.best.memory.toFixed(1)}s`;
        }
        const gold = secs < 25 ? 160 : secs < 45 ? 100 : 60;
        sfx('achievement');
        result.textContent = finish('memory', `Cleared in ${secs.toFixed(1)}s and ${moves} moves!`, gold, 20);
      }
    } else {
      lock = true;
      const deal = dealId;
      setTimeout(() => {
        if (deal !== dealId) return;
        a.card.classList.remove('is-up');
        b.card.classList.remove('is-up');
        a.card.setAttribute('aria-label', 'Hidden card');
        b.card.setAttribute('aria-label', 'Hidden card');
        flipped = [];
        lock = false;
      }, 750);
    }
  }
  body.querySelector('[data-new]').addEventListener('click', deal);
  deal();
}

// ================================================================= snake
export function openSnake() {
  const N = 20;
  const CELL = 14;
  let snake, dir, nextDir, food, score, timer = 0, running = false, speed;
  const handle = openModal({
    id: 'snake',
    title: "Link's snake trial",
    className: 'game-panel',
    onClose: () => clearInterval(timer),
    onKey: (e) => {
      const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
      const m = map[e.key];
      if (m) {
        e.preventDefault();
        if (!running) { begin(); return true; }
        if (m[0] !== -dir[0] || m[1] !== -dir[1]) nextDir = m;
        return true;
      }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!running) begin(); return true; }
      return false;
    },
    body: (b) => b.append(
      h('p', { class: 'game__hint' }, 'Arrow keys or WASD. Eat the gold, avoid the walls and yourself.'),
      h('canvas', { class: 'game__canvas', width: N * CELL, height: N * CELL }),
      h('div', { class: 'game__stats' },
        h('span', null, 'Score ', h('b', { 'data-s': '' }, '0')),
        h('span', null, 'Best ', h('b', { 'data-best': '' }, String(S.best.snake || 0))),
      ),
      h('p', { class: 'game__result', 'aria-live': 'polite' }, 'Press an arrow key or Start.'),
      h('div', { class: 'modal__actions' }, h('button', { type: 'button', class: 'btn btn--primary modal__primary', 'data-go': '' }, 'Start')),
    ),
  });
  const body = handle.body;
  const cv = body.querySelector('canvas');
  const g = cv.getContext('2d');
  const result = body.querySelector('.game__result');

  function place() {
    do { food = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)]; }
    while (snake.some((s) => s[0] === food[0] && s[1] === food[1]));
  }

  function begin() {
    snake = [[10, 10], [9, 10], [8, 10]];
    dir = [1, 0]; nextDir = dir; score = 0; speed = 140;
    place();
    running = true;
    result.textContent = '';
    body.querySelector('[data-s]').textContent = '0';
    clearInterval(timer);
    timer = setInterval(tick, speed);
    draw();
  }

  function tick() {
    if (!isModalOpen('snake')) { clearInterval(timer); return; }
    dir = nextDir;
    const head = [snake[0][0] + dir[0], snake[0][1] + dir[1]];
    if (head[0] < 0 || head[0] >= N || head[1] < 0 || head[1] >= N || snake.some((s) => s[0] === head[0] && s[1] === head[1])) {
      running = false;
      clearInterval(timer);
      sfx('error');
      if (score > (S.best.snake || 0)) {
        S.best.snake = score;
        body.querySelector('[data-best]').textContent = String(score);
      }
      result.textContent = finish('snake', `Game over — ${score} points.`, score * 2, Math.min(40, score));
      draw(true);
      return;
    }
    snake.unshift(head);
    if (head[0] === food[0] && head[1] === food[1]) {
      score += 10;
      sfx('coin');
      body.querySelector('[data-s]').textContent = String(score);
      place();
      if (speed > 70) { speed -= 5; clearInterval(timer); timer = setInterval(tick, speed); }
    } else {
      snake.pop();
    }
    draw();
  }

  function draw(dead = false) {
    g.fillStyle = '#070b16';
    g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = 'rgba(148,163,184,0.06)';
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if ((x + y) % 2) g.fillRect(x * CELL, y * CELL, CELL, CELL);
    if (food) {
      g.fillStyle = '#f5c542';
      g.fillRect(food[0] * CELL + 3, food[1] * CELL + 3, CELL - 6, CELL - 6);
    }
    (snake || []).forEach((s, i) => {
      g.fillStyle = dead ? '#f87171' : i === 0 ? '#86efac' : '#22c55e';
      g.fillRect(s[0] * CELL + 1, s[1] * CELL + 1, CELL - 2, CELL - 2);
    });
  }
  body.querySelector('[data-go]').addEventListener('click', begin);
  snake = [[10, 10], [9, 10], [8, 10]];
  draw();
}

// ================================================================= breakout
export function openBreakout() {
  const W = 320, H = 220;
  let paddle, ball, bricks, broken, raf = 0, running = false, lives;
  const keys = new Set();
  const dirOf = (k) => (k === 'ArrowLeft' || k === 'a' ? 'L' : k === 'ArrowRight' || k === 'd' ? 'R' : null);
  const onUp = (e) => { const d = dirOf(e.key); if (d) keys.delete(d); };
  document.addEventListener('keyup', onUp);
  const handle = openModal({
    id: 'breakout',
    title: "Squirtle's breakout",
    className: 'game-panel',
    onClose: () => { cancelAnimationFrame(raf); document.removeEventListener('keyup', onUp); },
    onKey: (e) => {
      const d = dirOf(e.key);
      if (d) {
        e.preventDefault();
        keys.add(d);
        if (!running) begin();
        return true;
      }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!running) begin(); return true; }
      return false;
    },
    body: (b) => b.append(
      h('p', { class: 'game__hint' }, 'Mouse or ← → to move the paddle. Three lives.'),
      h('canvas', { class: 'game__canvas', width: W, height: H }),
      h('div', { class: 'game__stats' },
        h('span', null, 'Bricks ', h('b', { 'data-s': '' }, '0')),
        h('span', null, 'Lives ', h('b', { 'data-l': '' }, '3')),
        h('span', null, 'Best ', h('b', { 'data-best': '' }, String(S.best.breakout || 0))),
      ),
      h('p', { class: 'game__result', 'aria-live': 'polite' }, 'Press Start.'),
      h('div', { class: 'modal__actions' }, h('button', { type: 'button', class: 'btn btn--primary modal__primary', 'data-go': '' }, 'Start')),
    ),
  });
  const body = handle.body;
  const cv = body.querySelector('canvas');
  const g = cv.getContext('2d');
  const result = body.querySelector('.game__result');

  cv.addEventListener('mousemove', (e) => {
    if (!paddle) return;
    const r = cv.getBoundingClientRect();
    paddle.x = Math.max(0, Math.min(W - paddle.w, ((e.clientX - r.left) / r.width) * W - paddle.w / 2));
  });

  function resetBall() {
    ball = { x: W / 2, y: H - 40, vx: (Math.random() < 0.5 ? -1 : 1) * 150, vy: -190, r: 4 };
  }

  function begin() {
    paddle = { x: W / 2 - 30, w: 60, h: 8 };
    resetBall();
    const colors = ['#f87171', '#fb923c', '#f5c542', '#4ade80'];
    bricks = [];
    for (let row = 0; row < 4; row++) for (let col = 0; col < 8; col++) {
      bricks.push({ x: col * 39 + 6, y: row * 16 + 22, w: 34, h: 11, alive: true, c: colors[row] });
    }
    broken = 0; lives = 3; running = true;
    body.querySelector('[data-s]').textContent = '0';
    body.querySelector('[data-l]').textContent = '3';
    result.textContent = '';
    cancelAnimationFrame(raf);
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      step(dt);
      draw();
      if (running) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  function end(won) {
    running = false;
    cancelAnimationFrame(raf);
    if (broken > (S.best.breakout || 0)) {
      S.best.breakout = broken;
      body.querySelector('[data-best]').textContent = String(broken);
    }
    sfx(won ? 'victory' : 'error');
    result.textContent = finish('breakout', won ? `Cleared all ${broken} bricks!` : `Out of lives — ${broken} bricks.`, broken * 6 + (won ? 150 : 0), Math.min(50, broken * 2));
  }

  function step(dt) {
    if (keys.has('L')) paddle.x = Math.max(0, paddle.x - 420 * dt);
    if (keys.has('R')) paddle.x = Math.min(W - paddle.w, paddle.x + 420 * dt);
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.x < ball.r) { ball.x = ball.r; ball.vx *= -1; }
    if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx *= -1; }
    if (ball.y < ball.r) { ball.y = ball.r; ball.vy *= -1; }
    const py = H - 14;
    if (ball.vy > 0 && ball.y + ball.r >= py && ball.y < py + paddle.h && ball.x >= paddle.x - 3 && ball.x <= paddle.x + paddle.w + 3) {
      ball.vy = -Math.abs(ball.vy) * 1.02;
      ball.vx = ((ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2)) * 220;
      sfx('hit');
    }
    if (ball.y > H + 10) {
      lives--;
      body.querySelector('[data-l]').textContent = String(lives);
      if (lives <= 0) { end(false); return; }
      resetBall();
    }
    for (const b of bricks) {
      if (!b.alive) continue;
      if (ball.x > b.x - ball.r && ball.x < b.x + b.w + ball.r && ball.y > b.y - ball.r && ball.y < b.y + b.h + ball.r) {
        b.alive = false;
        broken++;
        body.querySelector('[data-s]').textContent = String(broken);
        const fromSide = ball.x < b.x || ball.x > b.x + b.w;
        if (fromSide) ball.vx *= -1; else ball.vy *= -1;
        sfx('coin');
        break;
      }
    }
    if (bricks.every((b) => !b.alive)) end(true);
  }

  function draw() {
    g.fillStyle = '#070b16';
    g.fillRect(0, 0, W, H);
    for (const b of bricks || []) {
      if (!b.alive) continue;
      g.fillStyle = b.c;
      g.fillRect(b.x, b.y, b.w, b.h);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(b.x, b.y, b.w, 2);
    }
    if (paddle) {
      g.fillStyle = '#60a5fa';
      g.fillRect(paddle.x, H - 14, paddle.w, paddle.h);
    }
    if (ball) {
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      g.fill();
    }
  }
  body.querySelector('[data-go]').addEventListener('click', begin);
  g.fillStyle = '#070b16';
  g.fillRect(0, 0, W, H);
}
