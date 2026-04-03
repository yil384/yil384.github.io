import { useState, useEffect, useRef } from 'react';
import { GameEngine } from '../game/GameEngine';

export function useGameEngine() {
  const engineRef = useRef(null);
  const [gameState, setGameState] = useState(null);

  useEffect(() => {
    const engine = new GameEngine();
    engineRef.current = engine;
    const unsub = engine.subscribe(setGameState);
    engine.start();
    // Initial emit
    setGameState(engine.getState());
    return () => {
      engine.stop();
      unsub();
    };
  }, []);

  return { engine: engineRef.current, state: gameState };
}
