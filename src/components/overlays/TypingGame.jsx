import { useState, useEffect, useRef } from 'react';
import { TYPING_SNIPPETS } from '../../game/constants';

export default function TypingGame({ engine, typingBest }) {
  const [snippet, setSnippet] = useState('');
  const [value, setValue] = useState('');
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState('');
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => { startNew(); return () => clearInterval(timerRef.current); }, []);

  function startNew() {
    const s = TYPING_SNIPPETS[Math.floor(Math.random() * TYPING_SNIPPETS.length)];
    setSnippet(s);
    setValue('');
    setStartTime(0);
    setElapsed(0);
    setDone(false);
    setResult('');
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function handleInput(e) {
    const v = e.target.value;
    setValue(v);
    if (startTime === 0) {
      const now = Date.now();
      setStartTime(now);
      timerRef.current = setInterval(() => {
        setElapsed((Date.now() - now) / 1000);
      }, 100);
    }
    if (v === snippet) {
      setDone(true);
      clearInterval(timerRef.current);
      const t = (Date.now() - (startTime || Date.now())) / 1000;
      setElapsed(t);
      let reward = 0;
      if (t < 3) reward = 200;
      else if (t < 5) reward = 100;
      else if (t < 8) reward = 50;
      else reward = 20;
      setResult(`${t.toFixed(1)}s! +${reward} coins`);
      engine.completeTypingGame(t, reward);
    }
  }

  const inputClass = done ? 'typing-input correct' : (!snippet.startsWith(value) && value ? 'typing-input wrong' : 'typing-input');

  return (
    <div className="overlay overlay-darker" id="typing-game">
      <div className="typing-inner pixel-border">
        <div className="typing-title pixel-font">PIKACHU'S CODING CHALLENGE</div>
        <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px' }}>Type this code as fast as you can!</p>
        <div className="typing-prompt">{snippet}</div>
        <input
          ref={inputRef}
          className={inputClass}
          type="text"
          autoComplete="off"
          spellCheck="false"
          placeholder="Start typing..."
          value={value}
          onChange={handleInput}
          disabled={done}
        />
        <div className="typing-stats pixel-font">
          Time: {elapsed.toFixed(1)}s | Best: {typingBest > 0 ? typingBest.toFixed(1) + 's' : '--'}
        </div>
        {result && <div className="pixel-font" style={{ marginTop: '12px', fontSize: '10px', color: 'var(--green)' }}>{result}</div>}
        {done && <button className="overlay-close pixel-font" style={{ display: 'inline-block', marginTop: '12px' }} onClick={startNew}>Next Challenge</button>}
        <button className="overlay-close pixel-font" onClick={() => engine.closeOverlay('typing')}>Close</button>
      </div>
    </div>
  );
}
