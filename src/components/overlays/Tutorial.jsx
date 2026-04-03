const steps = [
  { text: 'Use ARROW KEYS or CLICK to move!', step: '1/5' },
  { text: 'Press SPACE to attack enemies!', step: '2/5' },
  { text: 'Press Q/W/E/R to cast spells!', step: '3/5' },
  { text: 'Collect coins and talk to NPCs!', step: '4/5' },
  { text: 'Challenge the Dragon King!', step: '5/5' },
];

import { useEffect, useRef } from 'react';

export default function Tutorial({ engine, step }) {
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => engine.advanceTutorial(), 3000);
    return () => clearTimeout(timerRef.current);
  }, [step]);

  if (step >= 5) return null;
  const s = steps[step] || steps[0];

  return (
    <div id="tutorial-overlay" style={{ position: 'fixed', inset: 0, zIndex: 250, pointerEvents: 'none', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '100px' }}>
      <div className="tutorial-box" style={{ pointerEvents: 'auto' }}>
        <div className="tutorial-text">{s.text}</div>
        <div className="pixel-font" style={{ fontSize: '7px', color: 'var(--text-muted)' }}>Step {s.step}</div>
        <button className="tutorial-skip" onClick={() => engine.completeTutorial()}>Skip Tutorial (ESC)</button>
      </div>
    </div>
  );
}
