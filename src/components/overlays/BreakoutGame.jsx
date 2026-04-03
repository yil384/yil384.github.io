import { useState, useEffect, useRef } from 'react';

export default function BreakoutGame({ engine }) {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [msg, setMsg] = useState('Arrow keys or mouse. Press Play!');
  const stateRef = useRef({ active: false, paddle: { x: 125, w: 50, h: 8 }, ball: { x: 150, y: 180, vx: 2, vy: -2, r: 3 }, bricks: [], broken: 0 });

  useEffect(() => {
    const handler = (e) => {
      const s = stateRef.current;
      if (!s.active) return;
      if (e.key === 'ArrowLeft') s.paddle.x = Math.max(0, s.paddle.x - 20);
      else if (e.key === 'ArrowRight') s.paddle.x = Math.min(250, s.paddle.x + 20);
    };
    const mouseHandler = (e) => {
      const s = stateRef.current;
      if (!s.active) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      s.paddle.x = Math.max(0, Math.min(250, (e.clientX - r.left) - s.paddle.w / 2));
    };
    document.addEventListener('keydown', handler);
    document.addEventListener('mousemove', mouseHandler);
    return () => { document.removeEventListener('keydown', handler); document.removeEventListener('mousemove', mouseHandler); };
  }, []);

  function startGame() {
    const s = stateRef.current;
    s.active = true;
    s.paddle = { x: 125, w: 50, h: 8 };
    s.ball = { x: 150, y: 180, vx: 1.5 + Math.random(), vy: -2, r: 3 };
    s.bricks = [];
    s.broken = 0;
    const colors = ['#ef4444', '#f97316', '#4ade80'];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 8; col++) {
        s.bricks.push({ x: col * 36 + 6, y: row * 16 + 20, w: 32, h: 12, alive: true, color: colors[row] });
      }
    }
    setScore(0); setMsg('');

    function loop() {
      if (!s.active) return;
      const b = s.ball;
      b.x += b.vx; b.y += b.vy;
      if (b.x <= b.r || b.x >= 300 - b.r) b.vx = -b.vx;
      if (b.y <= b.r) b.vy = -b.vy;
      if (b.y >= 192 - b.r - s.paddle.h && b.y < 192 && b.x >= s.paddle.x && b.x <= s.paddle.x + s.paddle.w) {
        b.vy = -Math.abs(b.vy);
        b.vx += (b.x - (s.paddle.x + s.paddle.w / 2)) * 0.05;
      }
      if (b.y > 200) { endGame(); return; }
      s.bricks.forEach(brick => {
        if (!brick.alive) return;
        if (b.x >= brick.x && b.x <= brick.x + brick.w && b.y >= brick.y && b.y <= brick.y + brick.h) {
          brick.alive = false; b.vy = -b.vy; s.broken++; setScore(s.broken);
        }
      });
      if (s.bricks.every(br => !br.alive)) { endGame(); return; }
      draw();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  function endGame() {
    const s = stateRef.current;
    s.active = false;
    setMsg('Game Over! Bricks: ' + s.broken);
    engine.completeBreakoutGame(s.broken);
  }

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const s = stateRef.current;
    ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, 300, 200);
    s.bricks.forEach(brick => { if (!brick.alive) return; ctx.fillStyle = brick.color; ctx.fillRect(brick.x, brick.y, brick.w, brick.h); });
    ctx.fillStyle = '#60a5fa'; ctx.fillRect(s.paddle.x, 192 - s.paddle.h, s.paddle.w, s.paddle.h);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, s.ball.r, 0, Math.PI * 2); ctx.fill();
  }

  return (
    <div className="overlay overlay-darker" id="breakout-game">
      <div style={{ textAlign: 'center' }}>
        <div className="pixel-font" style={{ color: 'var(--blue)', fontSize: '12px' }}>BREAKOUT</div>
        <div className="pixel-font" style={{ fontSize: '8px', color: 'var(--blue)', margin: '8px 0' }}>Bricks: {score}</div>
        <canvas ref={canvasRef} className="breakout-canvas" width={300} height={200} />
        <div className="pixel-font" style={{ fontSize: '8px', color: 'var(--text)', margin: '8px' }}>{msg}</div>
        <button className="game-btn" onClick={startGame}>Play</button>
        <button className="game-btn" onClick={() => { stateRef.current.active = false; engine.closeOverlay('breakout'); }}>Close</button>
      </div>
    </div>
  );
}
