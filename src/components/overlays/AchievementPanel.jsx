import { ACHIEVEMENT_DEFS } from '../../game/constants';

export default function AchievementPanel({ engine, achievements }) {
  const count = Object.values(achievements).filter(Boolean).length;
  const total = Object.keys(ACHIEVEMENT_DEFS).length;

  return (
    <div className="overlay overlay-darker" id="achievement-panel" onClick={(e) => { if (e.target === e.currentTarget) engine.toggleAchievementPanel(); }}>
      <div className="ach-panel-inner">
        <div className="ach-panel-title">ACHIEVEMENTS</div>
        <div className="ach-grid">
          {Object.entries(ACHIEVEMENT_DEFS).map(([key, def]) => (
            <div key={key} className={`ach-item${achievements[key] ? ' unlocked' : ''}`}>
              <div className="ach-item-icon">{def.icon}</div>
              <div className="ach-item-name">{def.name}</div>
              <div className="ach-item-desc">{def.desc}</div>
            </div>
          ))}
        </div>
        <div className="pixel-font" style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '12px' }}>
          {count} / {total} Unlocked
        </div>
        <button className="overlay-close pixel-font" onClick={() => engine.toggleAchievementPanel()}>Close</button>
      </div>
    </div>
  );
}
