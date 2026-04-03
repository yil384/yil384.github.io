export default function GameOver({ engine, state }) {
  const secs = Math.floor((Date.now() - state.gameStartTime) / 1000);
  const mins = Math.floor(secs / 60);
  const timeStr = mins + ':' + String(secs % 60).padStart(2, '0');

  return (
    <div className="overlay game-over-overlay" id="game-over" style={{ zIndex: 300 }}>
      <div style={{ textAlign: 'center' }}>
        <div className="game-over-title">GAME OVER</div>
        <p className="pixel-font" style={{ fontSize: '9px', marginTop: '16px', color: 'var(--text-dim)' }}>You were defeated!</p>
        <div className="game-over-stats">
          <div>Enemies Defeated: <span style={{ color: 'var(--gold)' }}>{state.enemiesDefeated}</span></div>
          <div>Coins Collected: <span style={{ color: 'var(--gold)' }}>{state.coins}</span></div>
          <div>Score: <span style={{ color: 'var(--gold)' }}>{state.score}</span></div>
          <div>Level: <span style={{ color: 'var(--gold)' }}>{state.player.level}</span></div>
          <div>Time Played: <span style={{ color: 'var(--gold)' }}>{timeStr}</span></div>
          <div>Achievements: <span style={{ color: 'var(--gold)' }}>{engine.getAchievementCount()}</span>/13</div>
        </div>
        <button className="respawn-btn pixel-font" onClick={() => engine.respawn()}>RESPAWN</button>
      </div>
    </div>
  );
}
