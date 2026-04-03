import { Storage } from './Storage.js';
import { AudioManager } from './AudioManager.js';
import {
  ENEMY_TYPES, SKILLS, EQUIPMENT_POOL, ACHIEVEMENT_DEFS,
  WAVE_DEFS, CRAFTING_RECIPES, DAY_PHASES, DAY_CYCLE_DURATION,
} from './constants.js';

export class GameEngine {
  constructor() {
    this.audio = new AudioManager();
    this.listeners = new Set();
    this.running = false;
    this.isMobile = window.innerWidth < 768;

    // Load saved progress
    const saved = Storage.loadProgress();

    // Player state
    this.player = {
      hp: 100, maxHp: 100,
      mp: 100, maxMp: 100,
      level: saved.level,
      xp: saved.xp,
      x: window.innerWidth - 72,
      y: window.innerHeight - 72,
      walking: false,
      visible: false,
    };

    // Game state
    this.score = saved.score;
    this.coins = saved.coins;
    this.coinIds = new Set(saved.coinIds);
    this.talkedNpcs = new Set(saved.talkedNpcs);
    this.totalCoins = 8;
    this.bossDefeated = saved.bossDefeated;
    this.bossHp = saved.bossDefeated ? 0 : 200;
    this.bossMaxHp = 200;
    this.gameOver = false;
    this.titleDismissed = false;
    this.enemiesDefeated = saved.enemiesDefeated;
    this.purchases = saved.purchases;
    this.gameStartTime = Date.now();

    // Skill system
    this.skills = {};
    Object.entries(SKILLS).forEach(([name, def]) => {
      this.skills[name] = { ...def, lastCast: 0 };
    });
    this.skillsUsed = saved.skillsUsed;

    // Buffs
    this.shieldHits = 0;
    this.powerBoostActive = false;
    this.powerBoostTimer = null;

    // Movement
    this.keysHeld = {};
    this.moveTargetX = null;
    this.moveTargetY = null;
    this.isClickMoving = false;
    this.charSpeed = 4;

    // Combo system
    this.lastCoinTime = 0;
    this.comboCount = 0;
    this.lastAttackTime = 0;

    // Enemy states (managed via DOM refs passed in)
    this.enemyStates = [];
    this.fireballs = [];

    // Achievements
    this.achievements = {};
    Object.keys(ACHIEVEMENT_DEFS).forEach(key => {
      this.achievements[key] = saved.achievements[key] || false;
    });

    // Equipment
    this.equipment = saved.equipment;

    // Companion pet
    this.petActive = saved.petActive;
    this.petX = 0;
    this.petY = 0;
    this.petOffered = false;

    // Mini-bosses
    this.miniBosses = {
      ice: { hp: 120, maxHp: 120, dead: saved.minibossIceDead, lastAttack: 0, moveOffset: 0, moveDir: 1, frostZones: [] },
      shadow: { hp: 100, maxHp: 100, dead: saved.minibossShadowDead, lastAttack: 0, lastTeleport: 0, shadowOrbs: [], offset: 0 },
    };

    // Overlays
    this.shopOpen = false;
    this.typingOpen = false;
    this.memoryOpen = false;
    this.snakeOpen = false;
    this.breakoutOpen = false;
    this.dialogOpen = false;
    this.equipCompareOpen = false;
    this.leaderboardOpen = false;
    this.achievementPanelOpen = false;
    this.equipPanelOpen = false;
    this.craftingOpen = false;
    this.waveMode = false;

    // Tutorial
    this.tutorialDone = saved.tutorialDone;
    this.tutorialStep = 0;

    // Secret room
    this.secretRoomOpened = false;
    this.secretChestOpened = saved.secretChest;

    // Dialog
    this.dialogRewards = saved.dialogRewards;
    this.npcDialogCooldown = {};

    // Typing game best
    this.typingBest = saved.typingBest;

    // Leaderboard
    this.leaderboard = saved.leaderboard;

    // Equipment compare
    this.pendingEquip = null;

    // Loot drops (transient, managed by react components via callbacks)
    this.lootDrops = [];

    // Weather
    this.weatherTypes = ['normal', 'rain', 'snow', 'aurora'];
    this.weatherIndex = 0;
    this.weather = 'normal';
    this.lastWeatherChange = Date.now();

    // Day/Night cycle (NEW)
    this.dayPhaseIndex = 1; // start at day
    this.dayPhase = 'day';
    this.dayCycleStart = Date.now();

    // Wave survival (NEW)
    this.waveActive = false;
    this.waveNumber = 0;
    this.waveEnemies = [];
    this.waveBreakTimer = 0;
    this.waveBreakActive = false;

    // Crafting materials (NEW)
    this.materials = saved.materials;

    // Notifications queue
    this.notifications = [];

    // MP regen interval
    this._mpRegenInterval = null;
    this._weatherInterval = null;

    // Victory
    this.victoryTriggered = this.coins >= this.totalCoins;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  emit() {
    const state = this.getState();
    this.listeners.forEach(cb => cb(state));
  }

  getState() {
    return {
      player: { ...this.player },
      score: this.score,
      coins: this.coins,
      coinIds: [...this.coinIds],
      talkedNpcs: [...this.talkedNpcs],
      totalCoins: this.totalCoins,
      bossDefeated: this.bossDefeated,
      bossHp: this.bossHp,
      bossMaxHp: this.bossMaxHp,
      gameOver: this.gameOver,
      titleDismissed: this.titleDismissed,
      enemiesDefeated: this.enemiesDefeated,
      skills: { ...this.skills },
      skillsUsed: { ...this.skillsUsed },
      shieldHits: this.shieldHits,
      powerBoostActive: this.powerBoostActive,
      achievements: { ...this.achievements },
      equipment: { ...this.equipment },
      petActive: this.petActive,
      petX: this.petX,
      petY: this.petY,
      miniBosses: {
        ice: { ...this.miniBosses.ice, frostZones: [] },
        shadow: { ...this.miniBosses.shadow, shadowOrbs: [] },
      },
      shopOpen: this.shopOpen,
      typingOpen: this.typingOpen,
      memoryOpen: this.memoryOpen,
      snakeOpen: this.snakeOpen,
      breakoutOpen: this.breakoutOpen,
      dialogOpen: this.dialogOpen,
      equipCompareOpen: this.equipCompareOpen,
      leaderboardOpen: this.leaderboardOpen,
      achievementPanelOpen: this.achievementPanelOpen,
      equipPanelOpen: this.equipPanelOpen,
      craftingOpen: this.craftingOpen,
      tutorialDone: this.tutorialDone,
      tutorialStep: this.tutorialStep,
      secretRoomOpened: this.secretRoomOpened,
      secretChestOpened: this.secretChestOpened,
      dialogRewards: { ...this.dialogRewards },
      typingBest: this.typingBest,
      leaderboard: [...this.leaderboard],
      pendingEquip: this.pendingEquip,
      weather: this.weather,
      dayPhase: this.dayPhase,
      notifications: [...this.notifications],
      victoryTriggered: this.victoryTriggered,
      waveActive: this.waveActive,
      waveNumber: this.waveNumber,
      waveBreakActive: this.waveBreakActive,
      materials: { ...this.materials },
      isMobile: this.isMobile,
      purchases: this.purchases,
      gameStartTime: this.gameStartTime,
    };
  }

  start() {
    this.running = true;
    this._mpRegenInterval = setInterval(() => {
      if (this.gameOver) return;
      if (this.player.mp < this.player.maxMp) {
        this.player.mp = Math.min(this.player.maxMp, this.player.mp + 1);
        // Equipment MP regen bonus
        const stats = this.getEquipStats();
        if (stats.mpRegen > 0) {
          this.player.mp = Math.min(this.player.maxMp, this.player.mp + stats.mpRegen);
        }
        this.emit();
      }
    }, 1000);
    this._weatherInterval = setInterval(() => {
      this.weatherIndex = (this.weatherIndex + 1) % this.weatherTypes.length;
      this.weather = this.weatherTypes[this.weatherIndex];
      this.emit();
    }, 60000);
    this.loop();
  }

  stop() {
    this.running = false;
    if (this._mpRegenInterval) clearInterval(this._mpRegenInterval);
    if (this._weatherInterval) clearInterval(this._weatherInterval);
    if (this.powerBoostTimer) clearTimeout(this.powerBoostTimer);
    this.audio.stopMusic();
  }

  loop() {
    if (!this.running) return;
    this.update();
    this.emit();
    requestAnimationFrame(() => this.loop());
  }

  update() {
    if (this.isMobile) return;
    if (!this.titleDismissed) return;

    this.updatePlayer();
    this.updateDayNight();

    if (this.gameOver) return;

    // Pet follows player
    if (this.petActive) {
      this.petX += (this.player.x - 30 - this.petX) * 0.08;
      this.petY += (this.player.y + 5 - this.petY) * 0.08;
    }
  }

  updatePlayer() {
    if (this.gameOver) return;
    let moved = false;
    const anyKey = this.keysHeld['ArrowUp'] || this.keysHeld['ArrowDown'] || this.keysHeld['ArrowLeft'] || this.keysHeld['ArrowRight'];
    if (anyKey) this.isClickMoving = false;

    if (this.keysHeld['ArrowUp']) { this.player.y -= this.charSpeed; moved = true; }
    if (this.keysHeld['ArrowDown']) { this.player.y += this.charSpeed; moved = true; }
    if (this.keysHeld['ArrowLeft']) { this.player.x -= this.charSpeed; moved = true; }
    if (this.keysHeld['ArrowRight']) { this.player.x += this.charSpeed; moved = true; }

    if (this.isClickMoving && this.moveTargetX !== null) {
      const dx = this.moveTargetX - this.player.x;
      const dy = this.moveTargetY - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < this.charSpeed + 2) {
        this.player.x = this.moveTargetX;
        this.player.y = this.moveTargetY;
        this.isClickMoving = false;
        this.moveTargetX = null;
        this.moveTargetY = null;
      } else {
        this.player.x += (dx / dist) * this.charSpeed;
        this.player.y += (dy / dist) * this.charSpeed;
        moved = true;
      }
    }

    // Edge scrolling
    if (this.player.y < 40 && (this.keysHeld['ArrowUp'] || (this.isClickMoving && this.moveTargetY < this.player.y))) {
      window.scrollBy(0, -this.charSpeed * 2);
    }
    if (this.player.y > window.innerHeight - 60 && (this.keysHeld['ArrowDown'] || (this.isClickMoving && this.moveTargetY > this.player.y))) {
      window.scrollBy(0, this.charSpeed * 2);
    }

    this.player.x = Math.max(0, Math.min(this.player.x, window.innerWidth - 32));
    this.player.y = Math.max(8, Math.min(this.player.y, window.innerHeight - 40));
    this.player.walking = moved;
  }

  updateDayNight() {
    const elapsed = (Date.now() - this.dayCycleStart) % DAY_CYCLE_DURATION;
    const phaseLen = DAY_CYCLE_DURATION / 4;
    const newIdx = Math.floor(elapsed / phaseLen);
    if (newIdx !== this.dayPhaseIndex) {
      this.dayPhaseIndex = newIdx;
      this.dayPhase = DAY_PHASES[newIdx];
    }
  }

  // ---- INPUT HANDLERS ----
  handleKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      this.keysHeld[e.key] = true;
    }
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      this.playerAttack();
    }
    if (!e.target.matches('input, textarea, select')) {
      const key = e.key.toLowerCase();
      if (key === 'q') this.castSkill('fireball');
      else if (key === 'w') this.castSkill('heal');
      else if (key === 'e') this.castSkill('lightning');
      else if (key === 'r') this.castSkill('ultimate');
    }
    if (e.key === 'Escape') this.handleEscape();
  }

  handleKeyUp(e) {
    delete this.keysHeld[e.key];
  }

  handleClick(x, y) {
    if (this.gameOver || !this.titleDismissed || this.isMobile) return;
    this.moveTargetX = x - 16;
    this.moveTargetY = y - 16;
    this.isClickMoving = true;
  }

  handleEscape() {
    if (this.dialogOpen) this.closeDialog();
    else if (this.snakeOpen) this.closeOverlay('snake');
    else if (this.breakoutOpen) this.closeOverlay('breakout');
    else if (this.leaderboardOpen) this.toggleLeaderboard();
    else if (this.equipCompareOpen) this.dismissEquipCompare();
    else if (this.equipPanelOpen) this.toggleEquipPanel();
    else if (this.achievementPanelOpen) this.toggleAchievementPanel();
    else if (this.craftingOpen) this.toggleCrafting();
    else if (this.shopOpen) this.closeShop();
    else if (this.typingOpen) this.closeOverlay('typing');
    else if (this.memoryOpen) this.closeOverlay('memory');
  }

  // ---- TITLE SCREEN ----
  dismissTitle() {
    if (this.titleDismissed) return;
    this.titleDismissed = true;
    this.player.visible = true;
    this.emit();
  }

  // ---- COMBAT ----
  playerAttack() {
    if (this.gameOver || this.anyOverlayOpen()) return;
    const now = Date.now();
    if (now - this.lastAttackTime < 400) return;
    this.lastAttackTime = now;
    this.audio.playAttack();
    this.emit();
    // Actual enemy damage is handled by React components checking proximity
  }

  isAttacking() {
    return Date.now() - this.lastAttackTime < 400;
  }

  takeDamage(amount) {
    if (this.gameOver) return;
    // Defense reduction from equipment
    const stats = this.getEquipStats();
    amount = Math.max(1, amount - stats.def);

    // Night bonus for enemies
    if (this.dayPhase === 'night') {
      amount = Math.floor(amount * 1.5);
    }

    if (this.shieldHits > 0) {
      this.shieldHits--;
      this.addNotification('BLOCK!');
      this.emit();
      return;
    }
    this.player.hp = Math.max(0, this.player.hp - amount);
    this.audio.playHit();
    if (this.player.hp <= 0) {
      this.triggerGameOver();
    }
    this.emit();
  }

  triggerGameOver() {
    this.gameOver = true;
    this.checkLeaderboard();
    this.emit();
  }

  respawn() {
    this.gameOver = false;
    this.player.hp = this.player.maxHp;
    this.player.mp = this.player.maxMp;
    this.score = Math.max(0, this.score - 100);
    this.unlockAchievement('survivor');
    this.saveProgress();
    this.emit();
  }

  // ---- XP / LEVEL ----
  gainXP(amount) {
    if (this.player.level >= 99) return;
    this.player.xp += amount;
    let xpNeeded = this.player.level * 50;
    while (this.player.xp >= xpNeeded && this.player.level < 99) {
      this.player.xp -= xpNeeded;
      this.player.level++;
      xpNeeded = this.player.level * 50;
      this.audio.playLevelUp();
      this.addNotification('LEVEL UP! Lv.' + this.player.level);
      this.checkAchievements();
    }
    this.saveProgress();
  }

  getXpNeeded() {
    return this.player.level * 50;
  }

  // ---- COINS ----
  collectCoin(coinId) {
    if (this.coinIds.has(coinId)) return;
    this.coinIds.add(coinId);
    this.coins++;
    const now = Date.now();
    if (now - this.lastCoinTime < 2000) {
      this.comboCount++;
    } else {
      this.comboCount = 1;
    }
    this.lastCoinTime = now;
    const multiplier = this.comboCount >= 2 ? this.comboCount : 1;
    this.score += 100 * multiplier;
    this.gainXP(10);
    this.audio.playCoin();
    this.checkAchievements();
    if (this.coins >= this.totalCoins && !this.victoryTriggered) {
      this.victoryTriggered = true;
      this.score += 500;
      this.audio.playComplete();
      this.addNotification('ALL COINS COLLECTED! +500 BONUS');
    }
    this.saveProgress();
    this.emit();
  }

  // ---- NPC INTERACTION ----
  talkToNpc(npcId) {
    if (!this.talkedNpcs.has(npcId)) {
      this.talkedNpcs.add(npcId);
      this.checkAchievements();
      this.saveProgress();
    }
  }

  // ---- ENEMY DEFEAT ----
  onEnemyKilled(dropX, dropY, enemyType) {
    this.enemiesDefeated++;
    this.score += 50;
    this.gainXP(30);
    this.audio.playDefeat();
    this.unlockAchievement('firstBlood');

    // Material drops (NEW)
    if (enemyType === 'slime-dark' || enemyType === 'skeleton') {
      this.materials.darkEssence = (this.materials.darkEssence || 0) + 1;
      this.addNotification('+1 Dark Essence');
    } else {
      this.materials.crystal = (this.materials.crystal || 0) + 1;
      this.addNotification('+1 Crystal');
    }

    // Night bonus loot
    if (this.dayPhase === 'night') {
      this.materials.crystal = (this.materials.crystal || 0) + 1;
    }

    // Equipment drop
    const item = this.rollEquipmentDrop();
    if (item) {
      this.lootDrops.push({ item, x: dropX, y: dropY, born: Date.now() });
    }

    this.checkAchievements();
    this.saveProgress();
    this.emit();
  }

  // ---- BOSS ----
  damageBoss(amount) {
    if (this.bossDefeated) return;
    const dmg = 10;
    this.bossHp = Math.max(0, this.bossHp - dmg);
    if (this.bossHp <= 0) {
      this.bossDefeated = true;
      this.audio.playBossVictory();
      this.score += 500;
      this.gainXP(100);
      this.unlockAchievement('dragonSlayer');
      this.materials.dragonScale = (this.materials.dragonScale || 0) + 1;
      this.addNotification('+1 Dragon Scale');
      this.checkLeaderboard();
      this.saveProgress();
    }
    this.emit();
  }

  // ---- MINI-BOSSES ----
  damageMiniBoss(id, amount) {
    const mb = this.miniBosses[id];
    if (!mb || mb.dead) return;
    mb.hp -= amount;
    if (mb.hp <= 0) {
      mb.dead = true;
      this.audio.playBossVictory();
      const defs = { ice: { score: 200, xp: 50 }, shadow: { score: 250, xp: 60 } };
      const def = defs[id];
      this.score += def.score;
      this.gainXP(def.xp);
      if (id === 'ice') Storage.set('miniboss_ice_dead', true);
      else Storage.set('miniboss_shadow_dead', true);
      this.saveProgress();
    }
    this.emit();
  }

  // ---- SKILLS ----
  castSkill(name) {
    if (this.gameOver || this.anyOverlayOpen() || !this.titleDismissed || this.isMobile) return;
    const skill = this.skills[name];
    if (!skill) return;
    const now = Date.now();
    if (now - skill.lastCast < skill.cd) return;
    if (this.player.mp < skill.mp) return;

    this.player.mp -= skill.mp;
    skill.lastCast = now;
    this.skillsUsed[name] = true;
    this.checkAchievements();

    if (name === 'heal') {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 40);
      this.audio.playHeal();
    } else if (name === 'fireball') {
      this.audio.playAttack();
    } else if (name === 'lightning') {
      this.audio.playLightning();
    } else if (name === 'ultimate') {
      // Sound handled in component
    }

    this.saveProgress();
    this.emit();
  }

  isSkillOnCooldown(name) {
    const skill = this.skills[name];
    if (!skill) return true;
    return Date.now() - skill.lastCast < skill.cd;
  }

  // ---- SHOP ----
  openShop() { this.shopOpen = true; this.emit(); }
  closeShop() { this.shopOpen = false; this.emit(); }

  buyItem(type) {
    const costs = { potion: 50, mana: 30, power: 100, shield: 80 };
    const cost = costs[type];
    if (this.score < cost) {
      this.addNotification('Not enough coins!');
      return;
    }
    this.score -= cost;
    this.purchases++;
    this.audio.playPurchase();

    if (type === 'potion') {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 50);
    } else if (type === 'mana') {
      this.player.mp = Math.min(this.player.maxMp, this.player.mp + 50);
    } else if (type === 'power') {
      this.powerBoostActive = true;
      if (this.powerBoostTimer) clearTimeout(this.powerBoostTimer);
      this.powerBoostTimer = setTimeout(() => { this.powerBoostActive = false; this.emit(); }, 30000);
      this.addNotification('Power Boost active for 30s!');
    } else if (type === 'shield') {
      this.shieldHits = 3;
      this.addNotification('Shield: 3 hits blocked!');
    }
    this.checkAchievements();
    this.saveProgress();
    this.emit();
  }

  // ---- TYPING GAME ----
  openTypingGame() { this.typingOpen = true; this.emit(); }
  closeOverlay(type) {
    if (type === 'typing') this.typingOpen = false;
    else if (type === 'memory') this.memoryOpen = false;
    else if (type === 'snake') this.snakeOpen = false;
    else if (type === 'breakout') this.breakoutOpen = false;
    this.emit();
  }
  completeTypingGame(elapsed, reward) {
    this.score += reward;
    this.gainXP(20);
    if (elapsed < 3) this.unlockAchievement('speedTyper');
    if (elapsed < this.typingBest || this.typingBest === 0) {
      this.typingBest = elapsed;
      Storage.set('typing_best', elapsed.toFixed(1));
    }
    this.saveProgress();
    this.emit();
  }

  // ---- MEMORY GAME ----
  openMemoryGame() { this.memoryOpen = true; this.emit(); }
  completeMemoryGame(elapsed) {
    let reward, xpReward;
    if (elapsed < 30) { reward = 150; xpReward = 20; }
    else { reward = 80; xpReward = 10; }
    this.score += reward;
    this.gainXP(xpReward);
    this.audio.playComplete();
    this.saveProgress();
    this.emit();
    return { reward, xpReward };
  }

  // ---- SNAKE / BREAKOUT ----
  openSnakeGame() { this.snakeOpen = true; this.emit(); }
  openBreakoutGame() { this.breakoutOpen = true; this.emit(); }
  completeSnakeGame(snakeScore) {
    const reward = snakeScore * 2;
    if (reward > 0) { this.score += reward; this.gainXP(15); }
    this.saveProgress();
    this.emit();
  }
  completeBreakoutGame(bricksBroken) {
    const reward = bricksBroken * 5;
    const xp = bricksBroken * 2;
    if (reward > 0) { this.score += reward; this.gainXP(xp); }
    this.saveProgress();
    this.emit();
  }

  // ---- DIALOG ----
  openDialog(npcId) { this.dialogOpen = true; this.currentDialogNpcId = npcId; this.emit(); }
  closeDialog() { this.dialogOpen = false; this.currentDialogNpcId = null; this.emit(); }
  giveDialogReward(npcId, reward) {
    if (this.dialogRewards[npcId]) return;
    this.dialogRewards[npcId] = true;
    if (reward.type === 'score') { this.score += reward.value; this.addNotification('+' + reward.value + ' Score!'); }
    else if (reward.type === 'hp') { this.player.hp = Math.min(this.player.maxHp, this.player.hp + reward.value); }
    else if (reward.type === 'mp') { this.player.mp = Math.min(this.player.maxMp, this.player.mp + reward.value); }
    else if (reward.type === 'xp') { this.gainXP(reward.value); }
    else if (reward.type === 'shield') { this.shieldHits += reward.value; }
    this.saveProgress();
    this.emit();
  }

  // ---- SECRET ROOM ----
  openSecretRoom() { this.secretRoomOpened = true; this.addNotification('Secret entrance discovered!'); this.emit(); }
  openSecretChest() {
    if (this.secretChestOpened) return;
    this.secretChestOpened = true;
    this.score += 500;
    this.gainXP(100);
    this.player.hp = this.player.maxHp;
    this.player.mp = this.player.maxMp;
    this.audio.playComplete();
    this.addNotification('Legendary reward claimed!');
    this.saveProgress();
    this.emit();
  }

  // ---- LEADERBOARD ----
  toggleLeaderboard() { this.leaderboardOpen = !this.leaderboardOpen; if (this.leaderboardOpen) this.checkLeaderboard(); this.emit(); }
  checkLeaderboard() {
    const lb = [...this.leaderboard];
    if (lb.length < 5 || this.score > (lb[lb.length - 1]?.score ?? 0)) {
      lb.push({ name: 'Yichen', level: this.player.level, score: this.score, date: new Date().toLocaleDateString() });
      lb.sort((a, b) => b.score - a.score);
      if (lb.length > 5) lb.length = 5;
      this.leaderboard = lb;
      Storage.set('leaderboard', lb);
    }
  }
  resetLeaderboard() { this.leaderboard = []; Storage.remove('leaderboard'); this.emit(); }

  // ---- ACHIEVEMENTS ----
  toggleAchievementPanel() { this.achievementPanelOpen = !this.achievementPanelOpen; this.emit(); }

  unlockAchievement(key) {
    if (!ACHIEVEMENT_DEFS[key] || this.achievements[key]) return;
    this.achievements[key] = true;
    this.audio.playAchievement();
    this.addNotification('Achievement Unlocked: ' + ACHIEVEMENT_DEFS[key].name + '!');
    this.saveProgress();
  }

  checkAchievements() {
    if (this.coins >= 4) this.unlockAchievement('coinCollector');
    if (this.coins >= 8) this.unlockAchievement('treasureHunter');
    if (this.player.level >= 5) this.unlockAchievement('level5');
    if (this.player.level >= 10) this.unlockAchievement('level10');
    if (this.talkedNpcs.size >= 6) this.unlockAchievement('explorer');
    if (this.skillsUsed.fireball && this.skillsUsed.heal && this.skillsUsed.lightning && this.skillsUsed.ultimate) {
      this.unlockAchievement('spellMaster');
    }
    if (this.purchases >= 3) this.unlockAchievement('shoppingSoree');
  }

  getAchievementCount() {
    return Object.values(this.achievements).filter(Boolean).length;
  }

  // ---- EQUIPMENT ----
  toggleEquipPanel() { this.equipPanelOpen = !this.equipPanelOpen; this.emit(); }

  getEquipStats() {
    let atk = 0, spellDmg = 0, def = 0, mpRegen = 0;
    Object.values(this.equipment).forEach(item => {
      if (!item) return;
      if (item.stat === 'atk') atk += item.value;
      else if (item.stat === 'spellDmg') spellDmg += item.value;
      else if (item.stat === 'def') def += item.value;
      else if (item.stat === 'mpRegen') mpRegen += item.value;
    });
    return { atk, spellDmg, def, mpRegen };
  }

  rollEquipmentDrop() {
    if (Math.random() > 0.25) return null;
    const r = Math.random();
    let rarity;
    if (r < 0.5) rarity = 'common';
    else if (r < 0.8) rarity = 'rare';
    else if (r < 0.95) rarity = 'epic';
    else rarity = 'legendary';
    const pool = EQUIPMENT_POOL.filter(e => e.rarity === rarity);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  pickupLoot(index) {
    if (index < 0 || index >= this.lootDrops.length) return;
    const loot = this.lootDrops[index];
    this.lootDrops.splice(index, 1);
    const item = loot.item;
    const currentItem = this.equipment[item.type];
    if (!currentItem || item.value > currentItem.value) {
      this.pendingEquip = item;
      this.equipCompareOpen = true;
    } else {
      this.score += 10;
      this.addNotification('Salvaged ' + item.name + ' for +10 score');
    }
    this.emit();
  }

  acceptEquip() {
    if (this.pendingEquip) {
      this.equipment[this.pendingEquip.type] = this.pendingEquip;
      this.addNotification('Equipped ' + this.pendingEquip.name + '!');
      this.pendingEquip = null;
    }
    this.equipCompareOpen = false;
    this.saveProgress();
    this.emit();
  }

  dismissEquipCompare() {
    this.equipCompareOpen = false;
    this.pendingEquip = null;
    this.emit();
  }

  // ---- PET ----
  activatePet() {
    this.petActive = true;
    this.petX = this.player.x - 30;
    this.petY = this.player.y + 5;
    this.saveProgress();
    this.emit();
  }

  // ---- WAVE SURVIVAL (NEW) ----
  startWaveSurvival() {
    if (this.waveActive) return;
    this.waveActive = true;
    this.waveNumber = 1;
    this.waveBreakActive = false;
    this.addNotification('Wave 1 incoming!');
    this.emit();
  }

  completeWave() {
    const waveDef = WAVE_DEFS[this.waveNumber - 1];
    if (waveDef) {
      this.score += waveDef.reward;
      this.gainXP(this.waveNumber * 10);
    }
    if (this.waveNumber >= 5) {
      this.waveActive = false;
      this.waveNumber = 0;
      this.score += 1000;
      this.unlockAchievement('waveMaster');
      this.addNotification('WAVE MASTER! +1000 Score!');
    } else {
      this.waveBreakActive = true;
      this.waveBreakTimer = Date.now();
      this.addNotification('Wave ' + this.waveNumber + ' complete! Break time...');
      setTimeout(() => {
        this.waveBreakActive = false;
        this.waveNumber++;
        this.addNotification('Wave ' + this.waveNumber + ' incoming!');
        this.emit();
      }, 30000);
    }
    this.saveProgress();
    this.emit();
  }

  // ---- CRAFTING (NEW) ----
  toggleCrafting() { this.craftingOpen = !this.craftingOpen; this.emit(); }

  craft(recipeIndex) {
    const recipe = CRAFTING_RECIPES[recipeIndex];
    if (!recipe) return;
    // Check materials
    for (const [mat, count] of Object.entries(recipe.materials)) {
      if ((this.materials[mat] || 0) < count) {
        this.addNotification('Not enough materials!');
        return;
      }
    }
    // Consume materials
    for (const [mat, count] of Object.entries(recipe.materials)) {
      this.materials[mat] -= count;
    }
    // Apply result
    if (recipe.result === 'healthPotion') {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 50);
      this.addNotification('Crafted Health Potion! +50 HP');
    } else if (recipe.result === 'manaPotion') {
      this.player.mp = Math.min(this.player.maxMp, this.player.mp + 50);
      this.addNotification('Crafted Mana Potion! +50 MP');
    } else if (recipe.equipment) {
      this.pendingEquip = recipe.equipment;
      this.equipCompareOpen = true;
      this.addNotification('Crafted ' + recipe.name + '!');
    }
    this.audio.playPurchase();
    this.saveProgress();
    this.emit();
  }

  // ---- RESET GAME ----
  resetGame() {
    Storage.clearAll();
    window.location.reload();
  }

  // ---- TUTORIAL ----
  completeTutorial() {
    this.tutorialDone = true;
    Storage.set('tutorial_done', true);
    this.emit();
  }
  advanceTutorial() {
    this.tutorialStep++;
    if (this.tutorialStep >= 5) this.completeTutorial();
    this.emit();
  }

  // ---- NOTIFICATIONS ----
  addNotification(text) {
    this.notifications.push({ text, time: Date.now() });
    // Keep only last 5
    if (this.notifications.length > 5) this.notifications.shift();
    // Auto-remove after 3s
    setTimeout(() => {
      this.notifications = this.notifications.filter(n => Date.now() - n.time < 3000);
      this.emit();
    }, 3100);
  }

  // ---- HELPERS ----
  anyOverlayOpen() {
    return this.shopOpen || this.typingOpen || this.memoryOpen || this.dialogOpen || this.snakeOpen || this.breakoutOpen || this.equipCompareOpen || this.craftingOpen;
  }

  getAttackDamage() {
    const base = this.powerBoostActive ? 20 : 10;
    const stats = this.getEquipStats();
    return base + stats.atk + (this.comboCount >= 2 ? 5 : 0);
  }

  isCriticalHit() {
    const crit = Math.random() < 0.15;
    if (crit) this.unlockAchievement('critical');
    return crit;
  }

  toggleMusic() {
    return this.audio.toggleMusic();
  }

  saveProgress() {
    Storage.saveProgress({
      coins: this.coins,
      score: this.score,
      level: this.player.level,
      xp: this.player.xp,
      coinIds: [...this.coinIds],
      talkedNpcs: [...this.talkedNpcs],
      bossDefeated: this.bossDefeated,
      enemiesDefeated: this.enemiesDefeated,
      purchases: this.purchases,
      skillsUsed: this.skillsUsed,
      equipment: this.equipment,
      petActive: this.petActive,
      tutorialDone: this.tutorialDone,
      minibossIceDead: this.miniBosses.ice.dead,
      minibossShadowDead: this.miniBosses.shadow.dead,
      secretChest: this.secretChestOpened,
      dialogRewards: this.dialogRewards,
      achievements: this.achievements,
      materials: this.materials,
    });
  }
}
