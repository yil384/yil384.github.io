import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameEngine } from './hooks/useGameEngine';
import TitleScreen from './components/TitleScreen';
import StatusBar from './components/StatusBar';
import GameHUD from './components/GameHUD';
import SkillBar from './components/SkillBar';
import MiniMap from './components/MiniMap';
import GameWorld from './components/GameWorld';
import PixelCharacter from './components/PixelCharacter';
import CharacterCard from './components/sections/CharacterCard';
import SkillTree from './components/sections/SkillTree';
import Attributes from './components/sections/Attributes';
import AchievementsSection from './components/sections/AchievementsSection';
import QuestLog from './components/sections/QuestLog';
import EquipmentSection from './components/sections/EquipmentSection';
import BossArea from './components/sections/BossArea';
import Portals from './components/sections/Portals';
import Footer from './components/sections/Footer';
import NavMenu from './components/overlays/NavMenu';
import ShopMenu from './components/overlays/ShopMenu';
import TypingGame from './components/overlays/TypingGame';
import MemoryGame from './components/overlays/MemoryGame';
import SnakeGame from './components/overlays/SnakeGame';
import BreakoutGame from './components/overlays/BreakoutGame';
import AchievementPanel from './components/overlays/AchievementPanel';
import LeaderboardPanel from './components/overlays/LeaderboardPanel';
import EquipmentPanel from './components/overlays/EquipmentPanel';
import GameOver from './components/overlays/GameOver';
import Tutorial from './components/overlays/Tutorial';
import DialogBox from './components/DialogBox';
import CraftingPanel from './components/overlays/CraftingPanel';

export default function App() {
  const { engine, state } = useGameEngine();
  const [menuOpen, setMenuOpen] = useState(false);

  // Global key/click handlers
  useEffect(() => {
    if (!engine) return;
    const onKeyDown = (e) => engine.handleKeyDown(e);
    const onKeyUp = (e) => engine.handleKeyUp(e);
    const onClick = (e) => {
      if (e.target.closest('#shop-menu, #typing-game, #game-over, .nav-menu-overlay, #achievement-panel, #memory-game, #dialog-box, #snake-game, #breakout-game, #equip-panel, #equip-compare, #leaderboard, #crafting-panel, .quest-header, .equip-card, .portal-link, a, button, #status-bar, #skill-bar, #game-hud, #minimap')) return;
      engine.handleClick(e.clientX, e.clientY);
    };
    const onContext = (e) => {
      if (engine.getState().gameOver || !engine.getState().titleDismissed) return;
      if (window.innerWidth < 768) return;
      e.preventDefault();
      engine.handleClick(e.clientX, e.clientY);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('click', onClick);
    document.addEventListener('contextmenu', onContext);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('click', onClick);
      document.removeEventListener('contextmenu', onContext);
    };
  }, [engine]);

  // Parallax scroll handler
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const bgFar = document.getElementById('world-bg-far');
      const bgMid = document.getElementById('world-bg-mid');
      const bgPart = document.getElementById('world-particles');
      if (bgFar) bgFar.style.transform = `translateY(${y * 0.1}px)`;
      if (bgMid) bgMid.style.transform = `translateY(${y * 0.3}px)`;
      if (bgPart) bgPart.style.transform = `translateY(${y * 0.15}px)`;
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Wait for engine initialization
  if (!state || !engine) return null;

  return (
    <>
      {/* Title Screen */}
      {!state.titleDismissed && (
        <TitleScreen
          onDismiss={() => engine.dismissTitle()}
          onToggleMusic={() => engine.toggleMusic()}
        />
      )}

      {/* Game World Background */}
      {state.titleDismissed && (
        <>
          <GameWorld weather={state.weather} dayPhase={state.dayPhase} />

          {/* Status Bar */}
          <StatusBar
            hp={state.player.hp}
            maxHp={state.player.maxHp}
            mp={state.player.mp}
            maxMp={state.player.maxMp}
            xp={state.player.xp}
            xpNeeded={engine.getXpNeeded()}
            level={state.player.level}
            onMenuClick={() => setMenuOpen(true)}
          />

          {/* Main Content */}
          <div id="main-content">
            <CharacterCard />
            <div className="section-divider"><span className="divider-icon">{'\u2694\uFE0F'}</span></div>
            <SkillTree />
            <div className="section-divider"><span className="divider-icon">{'\u2726'}</span></div>
            <Attributes />
            <div className="section-divider"><span className="divider-icon">{'\u{1F52E}'}</span></div>
            <AchievementsSection />
            <div className="section-divider"><span className="divider-icon">{'\u2726'}</span></div>
            <QuestLog />
            <div className="section-divider"><span className="divider-icon">{'\u2694\uFE0F'}</span></div>
            <EquipmentSection />
            <div className="section-divider"><span className="divider-icon">{'\u2726'}</span></div>
            <BossArea
              bossHp={state.bossHp}
              bossMaxHp={state.bossMaxHp}
              bossDefeated={state.bossDefeated}
            />
            <div className="section-divider"><span className="divider-icon">{'\u{1F52E}'}</span></div>
            <Portals />
            <Footer
              level={state.player.level}
              score={state.score}
              enemiesDefeated={state.enemiesDefeated}
              achievementCount={engine.getAchievementCount()}
            />
          </div>

          {/* Game HUD */}
          <GameHUD
            coins={state.coins}
            totalCoins={state.totalCoins}
            score={state.score}
            weather={state.weather}
            dayPhase={state.dayPhase}
            onAchievements={() => engine.toggleAchievementPanel()}
            onLeaderboard={() => engine.toggleLeaderboard()}
            onEquipment={() => engine.toggleEquipPanel()}
            onCrafting={() => engine.toggleCrafting()}
            onWaves={() => engine.startWaveSurvival()}
            waveActive={state.waveActive}
            waveNumber={state.waveNumber}
            materials={state.materials}
          />

          {/* Skill Bar */}
          <SkillBar
            skills={state.skills}
            mp={state.player.mp}
            onCast={(name) => engine.castSkill(name)}
          />

          {/* Mini Map */}
          <MiniMap />

          {/* Pixel Character */}
          <PixelCharacter
            x={state.player.x}
            y={state.player.y}
            walking={state.player.walking}
            visible={state.player.visible}
          />

          {/* Buff Indicator */}
          {(state.powerBoostActive || state.shieldHits > 0) && (
            <div className="buff-indicator">
              {state.powerBoostActive && <div style={{ color: 'var(--orange)' }}>PWR 2x</div>}
              {state.shieldHits > 0 && <div style={{ color: 'var(--blue)' }}>SHIELD x{state.shieldHits}</div>}
            </div>
          )}

          {/* Notifications */}
          {state.notifications.length > 0 && (
            <div className="notification-stack">
              {state.notifications.map((n, i) => (
                <div key={n.time + '-' + i} className="notification-item">{n.text}</div>
              ))}
            </div>
          )}

          {/* Overlays */}
          {menuOpen && <NavMenu onClose={() => setMenuOpen(false)} />}
          {state.shopOpen && <ShopMenu engine={engine} score={state.score} />}
          {state.typingOpen && <TypingGame engine={engine} typingBest={state.typingBest} />}
          {state.memoryOpen && <MemoryGame engine={engine} />}
          {state.snakeOpen && <SnakeGame engine={engine} />}
          {state.breakoutOpen && <BreakoutGame engine={engine} />}
          {state.achievementPanelOpen && <AchievementPanel engine={engine} achievements={state.achievements} />}
          {state.leaderboardOpen && <LeaderboardPanel engine={engine} leaderboard={state.leaderboard} />}
          {state.equipPanelOpen && <EquipmentPanel engine={engine} equipment={state.equipment} />}
          {state.craftingOpen && <CraftingPanel engine={engine} materials={state.materials} />}
          {state.gameOver && <GameOver engine={engine} state={state} />}
          {state.dialogOpen && <DialogBox engine={engine} npcId={engine.currentDialogNpcId} />}
          {!state.tutorialDone && !state.isMobile && <Tutorial engine={engine} step={state.tutorialStep} />}
        </>
      )}
    </>
  );
}
