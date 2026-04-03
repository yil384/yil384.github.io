export default function BossArea({ bossHp, bossMaxHp, bossDefeated }) {
  const hpPct = bossMaxHp > 0 ? (bossHp / bossMaxHp * 100) : 0;

  return (
    <section id="boss-area" className="section" data-zone="~ DRAGON'S LAIR ~" style={{ position: 'relative', textAlign: 'center' }}>
      <div className="section-title" style={bossDefeated ? { color: 'var(--green)' } : {}}>
        {bossDefeated ? 'CONQUERED! \u2726' : 'DANGER ZONE'}
      </div>
      <div className="boss-container">
        <div className="boss-hp-bar">
          <div className="boss-hp-fill" style={{ width: hpPct + '%' }} />
        </div>
        <div className="pixel-font" style={{ color: 'var(--red)', fontSize: '10px', marginBottom: '8px' }}>DRAGON KING</div>
        <div className={`game-enemy boss-enemy${bossDefeated ? ' dead' : ''}`}>
          <div className="enemy-sprite boss-dragon" />
        </div>
        <p className="pixel-font" style={{ fontSize: '7px', color: 'var(--text-muted)', marginTop: '16px' }}>
          Press SPACE to attack!
        </p>
      </div>
    </section>
  );
}
