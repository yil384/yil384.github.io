import { useState, useEffect, useRef } from 'react';

const GRID = 20, CELL = 10;

export default function SnakeGame({ engine }) {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [msg, setMsg] = useState('Arrow keys to move. Press Play!');
  const [active, setActive] = useState(false);
  const stateRef = useRef({ body: [], food: null, dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 }, score: 0, active: false });

  useEffect(() => {
    const handler = (e) => {
      const s = stateRef.current;
      if (!s.active) return;
      if (e.key === 'ArrowUp' && s.dir.y !== 1) s.nextDir = { x: 0, y: -1 };
      else if (e.key === 'ArrowDown' && s.dir.y !== -1) s.nextDir = { x: 0, y: 1 };
      else if (e.key === 'ArrowLeft' && s.dir.x !== 1) s.nextDir = { x: -1, y: 0 };
      else if (e.key === 'ArrowRight' && s.dir.x !== -1) s.nextDir = { x: 1, y: 0 };
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  function placeFood(body) {
    let x, y;
    do { x = Math.floor(Math.random() * GRID); y = Math.floor(Math.random() * GRID); }
    while (body.some(s => s.x === x && s.y === y));
    return { x, y };
  }

  function startGame() {
    const body = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    const food = placeFood(body);
    const s = stateRef.current;
    s.body = body; s.food = food; s.dir = { x: 1, y: 0 }; s.nextDir = { x: 1, y: 0 }; s.score = 0; s.active = true;
    setScore(0); setMsg(''); setActive(true);

    const timer = setInterval(() => {
      const st = stateRef.current;
      if (!st.active) { clearInterval(timer); return; }
      st.dir = st.nextDir;
      const head = { x: st.body[0].x + st.dir.x, y: st.body[0].y + st.dir.y };
      if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID || st.body.some(s => s.x === head.x && s.y === head.y)) {
        st.active = false; setActive(false); clearInterval(timer);
        setMsg('Game Over! Score: ' + st.score);
        engine.completeSnakeGame(st.score);
        return;
      }
      st.body.unshift(head);
      if (head.x === st.food.x && head.y === st.food.y) {
        st.score += 10; setScore(st.score);
        st.food = placeFood(st.body);
      } else { st.body.pop(); }
      draw(st);
    }, 150);

    return () => clearInterval(timer);
  }

  function draw(st) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, 200, 200);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(st.food.x * CELL, st.food.y * CELL, CELL - 1, CELL - 1);
    st.body.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? '#4ade80' : '#22c55e';
      ctx.fillRect(s.x * CELL, s.y * CELL, CELL - 1, CELL - 1);
    });
  }

  return (
    <div className="overlay overlay-darker" id="snake-game">
      <div style={{ textAlign: 'center' }}>
        <div className="pixel-font" style={{ color: 'var(--green)', fontSize: '12px' }}>SNAKE GAME</div>
        <div className="pixel-font" style={{ fontSize: '8px', color: 'var(--green)', margin: '8px 0' }}>Score: {score}</div>
        <canvas ref={canvasRef} className="snake-canvas" width={200} height={200} />
        <div className="pixel-font" style={{ fontSize: '8px', color: 'var(--text)', margin: '8px' }}>{msg}</div>
        <button className="game-btn" onClick={startGame}>Play</button>
        <button className="game-btn" onClick={() => { stateRef.current.active = false; engine.closeOverlay('snake'); }}>Close</button>
      </div>
    </div>
  );
}
