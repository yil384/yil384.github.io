export default function LeaderboardPanel({ engine, leaderboard }) {
  return (
    <div className="overlay overlay-dark" id="leaderboard" onClick={(e) => { if (e.target === e.currentTarget) engine.toggleLeaderboard(); }}>
      <div className="lb-inner pixel-border">
        <div className="lb-title pixel-font gold">HIGH SCORES</div>
        {leaderboard.length === 0 ? (
          <div className="pixel-font" style={{ fontSize: '8px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>No scores yet</div>
        ) : (
          leaderboard.map((e, i) => (
            <div key={i} className="lb-entry">
              <span className="lb-rank">#{i + 1}</span>
              <span>{e.name} Lv.{e.level}</span>
              <span className="lb-score">{e.score}</span>
              <span className="lb-date">{e.date}</span>
            </div>
          ))
        )}
        <button className="overlay-close pixel-font" style={{ display: 'inline-block', marginRight: '8px' }} onClick={() => engine.toggleLeaderboard()}>Close</button>
        <button className="overlay-close pixel-font" style={{ display: 'inline-block' }} onClick={() => engine.resetLeaderboard()}>Reset</button>
      </div>
    </div>
  );
}
