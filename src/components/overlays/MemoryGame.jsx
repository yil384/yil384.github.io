import { useState, useEffect, useRef } from 'react';
import { MEMORY_SYMBOLS } from '../../game/constants';

export default function MemoryGame({ engine }) {
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState(new Set());
  const [locked, setLocked] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [pairs, setPairs] = useState(0);
  const [result, setResult] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    startNew();
    return () => clearInterval(timerRef.current);
  }, []);

  function startNew() {
    const deck = [];
    MEMORY_SYMBOLS.forEach(sym => { deck.push(sym); deck.push(sym); });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    setCards(deck);
    setFlipped([]);
    setMatched(new Set());
    setLocked(false);
    setStartTime(0);
    setElapsed(0);
    setPairs(0);
    setResult('');
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function flipCard(idx) {
    if (locked) return;
    if (flipped.includes(idx) || matched.has(idx)) return;
    if (flipped.length >= 2) return;

    if (startTime === 0) {
      const now = Date.now();
      setStartTime(now);
      timerRef.current = setInterval(() => setElapsed((Date.now() - now) / 1000), 100);
    }

    const newFlipped = [...flipped, idx];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      const [a, b] = newFlipped;
      if (cards[a] === cards[b]) {
        const newMatched = new Set(matched);
        newMatched.add(a);
        newMatched.add(b);
        setMatched(newMatched);
        const newPairs = pairs + 1;
        setPairs(newPairs);
        setFlipped([]);
        if (newPairs === 6) {
          clearInterval(timerRef.current);
          const t = (Date.now() - (startTime || Date.now())) / 1000;
          setElapsed(t);
          const { reward, xpReward } = engine.completeMemoryGame(t);
          setResult(`${t.toFixed(1)}s! +${reward} coins, +${xpReward} XP`);
        }
      } else {
        setLocked(true);
        setTimeout(() => {
          setFlipped([]);
          setLocked(false);
        }, 800);
      }
    }
  }

  return (
    <div className="overlay overlay-darker" id="memory-game">
      <div className="memory-inner">
        <div className="memory-title">KIRBY'S MEMORY MATCH</div>
        <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px' }}>Match the programming language pairs!</p>
        <div className="memory-grid">
          {cards.map((sym, idx) => {
            const isFlipped = flipped.includes(idx);
            const isMatched = matched.has(idx);
            return (
              <div
                key={idx}
                className={`memory-card${isFlipped ? ' flipped' : ''}${isMatched ? ' matched' : ''}`}
                onClick={() => flipCard(idx)}
              >
                {(isFlipped || isMatched) ? sym : '?'}
              </div>
            );
          })}
        </div>
        <div className="pixel-font" style={{ fontSize: '8px', color: 'var(--text-dim)' }}>
          Time: {elapsed.toFixed(1)}s | Pairs: {pairs}/6
        </div>
        {result && <div className="pixel-font" style={{ marginTop: '8px', fontSize: '10px', color: 'var(--green)' }}>{result}</div>}
        <button className="overlay-close pixel-font" onClick={() => engine.closeOverlay('memory')}>Close</button>
      </div>
    </div>
  );
}
