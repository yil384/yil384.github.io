// localStorage wrapper for all game state persistence

const PREFIX = 'rpg_';

function get(key, defaultValue) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

function set(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full or not available
  }
}

function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

// Convenience getters/setters
export const Storage = {
  get,
  set,
  remove,

  getInt(key, def = 0) { return parseInt(get(key, def)) || def; },
  getFloat(key, def = 0) { return parseFloat(get(key, def)) || def; },
  getBool(key, def = false) { return get(key, def) === true || get(key, def) === 'true'; },
  getArray(key, def = []) { return get(key, def); },
  getObject(key, def = {}) { return get(key, def); },

  // Game-specific helpers
  loadProgress() {
    return {
      coins: this.getInt('coins', 0),
      score: this.getInt('score', 0),
      level: this.getInt('level', 1),
      xp: this.getInt('xp', 0),
      coinIds: this.getArray('coin_ids', []),
      talkedNpcs: this.getArray('npcs', []),
      bossDefeated: this.getBool('boss_dead', false),
      typingBest: this.getFloat('typing_best', 0),
      achievements: this.getObject('achievements', {}),
      enemiesDefeated: this.getInt('enemies_defeated', 0),
      purchases: this.getInt('purchases', 0),
      skillsUsed: this.getObject('skills_used', {}),
      equipment: this.getObject('equipment', {}),
      petActive: this.getBool('pet_active', false),
      tutorialDone: this.getBool('tutorial_done', false),
      minibossIceDead: this.getBool('miniboss_ice_dead', false),
      minibossShadowDead: this.getBool('miniboss_shadow_dead', false),
      secretChest: this.getBool('secret_chest', false),
      leaderboard: this.getArray('leaderboard', []),
      dialogRewards: this.getObject('dialog_rewards', {}),
      materials: this.getObject('materials', { crystal: 0, darkEssence: 0, dragonScale: 0 }),
    };
  },

  saveProgress(state) {
    this.set('coins', state.coins);
    this.set('score', state.score);
    this.set('level', state.level);
    this.set('xp', state.xp);
    this.set('coin_ids', state.coinIds);
    this.set('npcs', [...state.talkedNpcs]);
    this.set('boss_dead', state.bossDefeated);
    this.set('enemies_defeated', state.enemiesDefeated);
    this.set('purchases', state.purchases);
    this.set('skills_used', state.skillsUsed);
    this.set('equipment', state.equipment);
    this.set('pet_active', state.petActive);
    this.set('tutorial_done', state.tutorialDone);
    this.set('miniboss_ice_dead', state.minibossIceDead);
    this.set('miniboss_shadow_dead', state.minibossShadowDead);
    this.set('secret_chest', state.secretChest);
    this.set('dialog_rewards', state.dialogRewards);
    this.set('achievements', state.achievements);
    this.set('materials', state.materials);
  },
};
