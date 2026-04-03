export default function StatusBar({ hp, maxHp, mp, maxMp, xp, xpNeeded, level, onMenuClick }) {
  const hpPct = Math.max(0, hp / maxHp * 100);
  const mpPct = Math.max(0, mp / maxMp * 100);
  const xpPct = Math.min(xp / xpNeeded * 100, 100);

  return (
    <nav id="status-bar">
      <div className="status-bar-inner">
        <span className="bar-group">
          <span className="bar-label green pixel-font">HP</span>
          <span className="bar-track">
            <span className="bar-fill hp-bar-fill" style={{ width: hpPct + '%' }} />
          </span>
          <span className="bar-numbers">{Math.round(hp)}/{maxHp}</span>
        </span>
        <span className="bar-group">
          <span className="bar-label purple pixel-font">MP</span>
          <span className="bar-track">
            <span className="bar-fill mp-bar-fill" style={{ width: mpPct + '%' }} />
          </span>
          <span className="bar-numbers">{Math.round(mp)}/{maxMp}</span>
        </span>
        <span className="bar-group">
          <span className="bar-label gold pixel-font">EXP</span>
          <span className="bar-track">
            <span className="bar-fill exp-bar-fill" style={{ width: xpPct + '%' }} />
          </span>
        </span>
        <span className="level-badge pixel-font">Lv.{level}</span>
        <button id="menu-btn" className="pixel-font" onClick={onMenuClick} aria-label="Menu">{'\u2630'}</button>
      </div>
    </nav>
  );
}
