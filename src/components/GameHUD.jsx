export default function GameHUD({ coins, totalCoins, score, weather, dayPhase, onAchievements, onLeaderboard, onEquipment, onCrafting, onWaves, waveActive, waveNumber, materials }) {
  const weatherIcons = { normal: '\u2600\uFE0F Clear', rain: '\u{1F327}\uFE0F Rain', snow: '\u2744\uFE0F Snow', aurora: '\u{1F30C} Aurora' };
  const dayIcons = { dawn: '\u{1F305}', day: '\u2600\uFE0F', dusk: '\u{1F307}', night: '\u{1F319}' };

  return (
    <div id="game-hud" aria-hidden="true" style={{ pointerEvents: 'auto' }}>
      <span className="hud-line">
        {'\u{1FA99}'} {coins}/{totalCoins}{' '}
        <button className="hud-btn" onClick={onAchievements} title="Achievements">{'\u{1F3C6}'}</button>
        <button className="hud-btn" onClick={onLeaderboard} title="Leaderboard">{'\u{1F3C5}'}</button>
        <button className="hud-btn" onClick={onEquipment} title="Equipment">{'\u{1F392}'}</button>
        <button className="hud-btn" onClick={onCrafting} title="Crafting">{'\u2692\uFE0F'}</button>
        <button className="hud-btn" onClick={onWaves} title="Wave Survival" disabled={waveActive}>{'\u{1F30A}'}</button>
      </span>
      <span className="hud-line">SCORE: {score}</span>
      <span className="hud-line">{weatherIcons[weather] || '\u2600\uFE0F Clear'}</span>
      <span className="hud-line day-indicator">{dayIcons[dayPhase] || '\u2600\uFE0F'} {dayPhase?.toUpperCase()}{dayPhase === 'night' ? ' (+loot!)' : ''}</span>
      {waveActive && <span className="hud-line" style={{ color: 'var(--red)' }}>WAVE {waveNumber}/5</span>}
      <span className="hud-line" style={{ fontSize: '6px', color: 'var(--text-muted)' }}>
        {'\u{1F48E}'}{materials?.crystal || 0} {'\u{1F5A4}'}{materials?.darkEssence || 0} {'\u{1F409}'}{materials?.dragonScale || 0}
      </span>
    </div>
  );
}
