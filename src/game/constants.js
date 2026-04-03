// Game constants, colors, enemy data, NPC data, equipment pools

export const COLORS = {
  bg: '#0f0f23',
  bgCard: 'rgba(255,255,255,0.03)',
  border: '#334155',
  gold: '#ffd700',
  goldDim: 'rgba(255,215,0,0.15)',
  green: '#4ade80',
  blue: '#60a5fa',
  purple: '#818cf8',
  orange: '#f97316',
  red: '#ef4444',
  text: '#e2e8f0',
  textDim: '#94a3b8',
  textMuted: '#64748b',
};

export const ENEMY_TYPES = {
  'slime-green': { hp: 30, speed: 1, damage: 10, spriteClass: 'enemy-slime-green', xp: 30, score: 50 },
  'slime-red': { hp: 40, speed: 1.5, damage: 10, spriteClass: 'enemy-slime-red', xp: 30, score: 50 },
  'bat': { hp: 25, speed: 2.5, damage: 10, spriteClass: 'enemy-bat', xp: 30, score: 50 },
  'skeleton': { hp: 50, speed: 1.5, damage: 10, spriteClass: 'enemy-skeleton', xp: 30, score: 50 },
  'slime-dark': { hp: 45, speed: 1.5, damage: 10, spriteClass: 'enemy-slime-dark', xp: 30, score: 50 },
};

export const ENEMY_PLACEMENTS = [
  { type: 'slime-green', section: 'character', style: { right: '30px', top: '40%' } },
  { type: 'slime-red', section: 'attributes', style: { left: '30px', top: '50%' } },
  { type: 'bat', section: 'achievements', style: { right: '60px', top: '30%' } },
  { type: 'skeleton', section: 'quests', style: { right: '20px', top: '25%' } },
  { type: 'slime-dark', section: 'equipment', style: { left: '20px', top: '35%' } },
];

export const NPC_DATA = [
  { id: '1', type: 'pikachu', section: 'attributes', style: { right: '20px', top: '60px' }, bubble: 'Pika pika! Python Lv.9... that\'s super effective! \u26A1' },
  { id: '2', type: 'charmander', section: 'skill-tree', style: { left: '50%', bottom: '20px', marginLeft: '30px' }, bubble: 'Char! \u{1F525} From Tsinghua to UCSD \u2014 evolution complete!' },
  { id: '3', type: 'squirtle', section: 'achievements', style: { left: '10px', top: '120px' }, bubble: 'Squirtle! \u{1F4A7} These publications are a real splash!' },
  { id: '4', type: 'mario', section: 'quests', style: { left: '10px', top: '66%' }, bubble: 'It\'s-a me! So many quests completed... Mamma mia! \u{1F344}' },
  { id: '5', type: 'kirby', section: 'equipment', style: { right: '10px', bottom: '20px' }, bubble: 'Poyo~! \u2B50 These legendary items look delicious!' },
  { id: '6', type: 'link', section: 'portals', style: { right: '10px', top: '30px' }, bubble: 'Hyaa! \u{1F5E1}\uFE0F The portals lead to other worlds... shall we go?' },
];

export const COIN_PLACEMENTS = [
  { id: '1', section: 'character', style: { right: '30px', top: '60px' } },
  { id: '2', section: 'skill-tree', style: { left: '50%', top: '80px', marginLeft: '-10px' } },
  { id: '3', section: 'attributes', style: { right: '20px', top: '20px' } },
  { id: '4', section: 'achievements', style: { left: '10px', top: '80px' } },
  { id: '5', section: 'quests', style: { left: '10px', top: '33%' } },
  { id: '6', section: 'quests', style: { right: '10px', top: '66%' } },
  { id: '7', section: 'equipment', style: { left: '50%', top: '50%', marginLeft: '-10px' } },
  { id: '8', section: 'portals', style: { left: '50%', top: '20px', marginLeft: '-10px' } },
];

export const SKILLS = {
  fireball: { key: 'q', name: 'Fireball', icon: '\u{1F525}', mp: 20, cd: 3000, damage: 30, desc: '30 dmg to target \u00B7 20 MP \u00B7 3s cd' },
  heal: { key: 'w', name: 'Heal', icon: '\u{1F49A}', mp: 30, cd: 8000, healAmount: 40, desc: 'Restore 40 HP \u00B7 30 MP \u00B7 8s cd' },
  lightning: { key: 'e', name: 'Lightning', icon: '\u26A1', mp: 40, cd: 10000, damage: 25, desc: '25 dmg all visible \u00B7 40 MP \u00B7 10s cd' },
  ultimate: { key: 'r', name: 'Meteor Storm', icon: '\u2604\uFE0F', mp: 80, cd: 30000, damage: 50, desc: '50 dmg area x5 \u00B7 80 MP \u00B7 30s cd' },
};

export const SHOP_ITEMS = [
  { id: 'potion', name: 'Health Potion', cost: 50, desc: 'Restore 50 HP' },
  { id: 'mana', name: 'Mana Crystal', cost: 30, desc: 'Restore 50 MP' },
  { id: 'power', name: 'Power Boost', cost: 100, desc: '2x damage 30s' },
  { id: 'shield', name: 'Shield', cost: 80, desc: 'Block 3 hits' },
];

export const TYPING_SNIPPETS = [
  'def hello_world():',
  'for i in range(10):',
  'console.log("GG")',
  'fn main() -> Result',
  'git push origin main',
  'import torch.nn as nn',
];

export const MEMORY_SYMBOLS = ['\u{1F40D}', '\u2699\uFE0F', '\u{1F980}', '\u{1F537}', '\u{1F4DC}', '\u26A1'];

export const EQUIPMENT_POOL = [
  { name: 'Iron Sword', type: 'weapon', rarity: 'common', icon: '\u{1F5E1}\uFE0F', stat: 'atk', value: 3 },
  { name: 'Fire Sword', type: 'weapon', rarity: 'rare', icon: '\u{1F5E1}\uFE0F', stat: 'atk', value: 6 },
  { name: 'Dark Blade', type: 'weapon', rarity: 'epic', icon: '\u2694\uFE0F', stat: 'atk', value: 10 },
  { name: 'Excalibur', type: 'weapon', rarity: 'legendary', icon: '\u2694\uFE0F', stat: 'atk', value: 15 },
  { name: 'Oak Staff', type: 'staff', rarity: 'common', icon: '\u{1FA84}', stat: 'spellDmg', value: 5 },
  { name: 'Arcane Staff', type: 'staff', rarity: 'rare', icon: '\u{1FA84}', stat: 'spellDmg', value: 10 },
  { name: 'Void Staff', type: 'staff', rarity: 'epic', icon: '\u{1F52E}', stat: 'spellDmg', value: 15 },
  { name: 'Leather Armor', type: 'armor', rarity: 'common', icon: '\u{1F6E1}\uFE0F', stat: 'def', value: 2 },
  { name: 'Chain Mail', type: 'armor', rarity: 'rare', icon: '\u{1F6E1}\uFE0F', stat: 'def', value: 5 },
  { name: 'Dragon Armor', type: 'armor', rarity: 'legendary', icon: '\u{1F6E1}\uFE0F', stat: 'def', value: 10 },
  { name: 'Copper Ring', type: 'ring', rarity: 'common', icon: '\u{1F48D}', stat: 'mpRegen', value: 1 },
  { name: 'Mana Ring', type: 'ring', rarity: 'rare', icon: '\u{1F48D}', stat: 'mpRegen', value: 3 },
  { name: 'Sage Ring', type: 'ring', rarity: 'epic', icon: '\u{1F48D}', stat: 'mpRegen', value: 5 },
];

export const ACHIEVEMENT_DEFS = {
  firstBlood: { name: 'First Blood', icon: '\u{1F5E1}\uFE0F', desc: 'Defeat your first enemy' },
  coinCollector: { name: 'Coin Collector', icon: '\u{1FA99}', desc: 'Collect 4 coins' },
  treasureHunter: { name: 'Treasure Hunter', icon: '\u{1F48E}', desc: 'Collect all 8 coins' },
  dragonSlayer: { name: 'Dragon Slayer', icon: '\u{1F409}', desc: 'Defeat the Dragon King' },
  speedTyper: { name: 'Speed Typer', icon: '\u2328\uFE0F', desc: 'Type challenge < 3 seconds' },
  shoppingSoree: { name: 'Shopping Spree', icon: '\u{1F6D2}', desc: 'Buy 3 items' },
  level5: { name: 'Level 5', icon: '\u2B50', desc: 'Reach level 5' },
  level10: { name: 'Level 10', icon: '\u{1F31F}', desc: 'Reach level 10' },
  spellMaster: { name: 'Spell Master', icon: '\u{1F52E}', desc: 'Use all 4 skills' },
  critical: { name: 'Critical!', icon: '\u{1F4A5}', desc: 'Land a critical hit' },
  survivor: { name: 'Survivor', icon: '\u{1F480}', desc: 'Respawn after game over' },
  explorer: { name: 'Explorer', icon: '\u{1F5FA}\uFE0F', desc: 'Talk to all 6 NPCs' },
  waveMaster: { name: 'Wave Master', icon: '\u{1F30A}', desc: 'Survive all 5 waves' },
};

export const NPC_DIALOGS = {
  '1': {
    speaker: 'Pikachu',
    text: 'Pika pika! You look strong, adventurer!',
    choices: [
      { text: 'Thanks! Any tips?', response: 'Focus your training on one skill... or spread it wide. Here, take this!', reward: { type: 'score', value: 50 } },
      { text: 'Want to battle?', response: "Pika! I'm too cute to fight. But here's some energy!", reward: { type: 'mp', value: 20 } },
    ],
  },
  '3': {
    speaker: 'Squirtle',
    text: 'Those are some impressive achievements!',
    choices: [
      { text: 'I worked hard for them', response: 'Hard work always pays off. Take this potion!', reward: { type: 'hp', value: 30 } },
      { text: "There's more to come", response: "That's the spirit! Here's a bonus!", reward: { type: 'score', value: 80 } },
    ],
  },
  '6': {
    speaker: 'Link',
    text: 'The portals shimmer with power...',
    choices: [
      { text: 'Where do they lead?', response: 'To worlds of code and knowledge. Hyaa!', reward: { type: 'xp', value: 30 } },
      { text: "I'm not ready yet", response: 'A wise adventurer knows when to prepare. Take this shield!', reward: { type: 'shield', value: 1 } },
    ],
  },
};

export const MINI_BOSSES = {
  ice: {
    name: 'Ice Golem', hp: 120, attackInterval: 4000, scoreReward: 200, xpReward: 50,
    spriteClass: 'ice-golem-sprite', hpGradient: 'linear-gradient(90deg,#60a5fa,#93c5fd)',
    zone: '~ ICE CAVERN ~', zoneColor: '#8ec5e8', moveSpeed: 0.3, moveRange: 60,
  },
  shadow: {
    name: 'Shadow Mage', hp: 100, attackInterval: 3000, scoreReward: 250, xpReward: 60,
    spriteClass: 'shadow-mage-sprite', hpGradient: 'linear-gradient(90deg,#7c3aed,#c084fc)',
    zone: '~ SHADOW REALM ~', zoneColor: '#c084fc', teleportInterval: 5000,
  },
};

// Wave Survival definitions
export const WAVE_DEFS = [
  { enemies: [{ type: 'slime-green', count: 3 }], reward: 100 },
  { enemies: [{ type: 'slime-green', count: 4 }, { type: 'bat', count: 1 }], reward: 200 },
  { enemies: [{ type: 'slime-red', count: 2 }, { type: 'bat', count: 2 }, { type: 'skeleton', count: 1 }], reward: 300 },
  { enemies: [{ type: 'slime-dark', count: 3 }, { type: 'skeleton', count: 2 }, { type: 'bat', count: 1 }], reward: 400 },
  { enemies: [{ type: 'slime-red', count: 3 }, { type: 'skeleton', count: 2 }, { type: 'slime-dark', count: 2 }, { type: 'bat', count: 1 }], reward: 500 },
];

// Crafting recipes
export const CRAFTING_RECIPES = [
  { name: 'Health Potion', result: 'healthPotion', materials: { crystal: 3 }, desc: 'Restore 50 HP', icon: '\u{1F9EA}' },
  { name: 'Mana Potion', result: 'manaPotion', materials: { darkEssence: 3 }, desc: 'Restore 50 MP', icon: '\u{1F9EA}' },
  { name: 'Dragon Sword', result: 'dragonSword', materials: { dragonScale: 1, crystal: 2 }, desc: 'Legendary weapon, +20 ATK', icon: '\u2694\uFE0F', rarity: 'legendary', equipment: { name: 'Dragon Sword', type: 'weapon', rarity: 'legendary', icon: '\u2694\uFE0F', stat: 'atk', value: 20 } },
  { name: 'Shadow Cloak', result: 'shadowCloak', materials: { darkEssence: 2, crystal: 1 }, desc: 'Epic armor, +8 DEF', icon: '\u{1F9E5}', rarity: 'epic', equipment: { name: 'Shadow Cloak', type: 'armor', rarity: 'epic', icon: '\u{1F9E5}', stat: 'def', value: 8 } },
];

// Day/Night cycle
export const DAY_PHASES = ['dawn', 'day', 'dusk', 'night'];
export const DAY_CYCLE_DURATION = 120000; // 120 seconds total cycle
