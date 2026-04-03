export default function Footer({ level, score, enemiesDefeated, achievementCount }) {
  return (
    <footer className="site-footer">
      <p className="footer-stats">
        {'\u2694\uFE0F'} SESSION STATS: Lv.{level} | Score: {score} | Enemies Defeated: {enemiesDefeated} | Achievements: {achievementCount}/13
      </p>
      <p className="pixel-font">&copy; 2025&ndash;2026 Yichen Lin | Crafted with {'\u2694\uFE0F'} and {'\u2728'} | Use QWER to cast spells!</p>
      <p className="footer-hint pixel-font">Use arrow keys or click to move the adventurer!</p>
    </footer>
  );
}
