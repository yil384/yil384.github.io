// Static game data for the island: companions, enemies, items, rivals, type chart.
// All creatures and islanders are original to this site.

export const ITEMS = {
  'iron-sword':    { name: 'Iron Sword',     slot: 'weapon', rarity: 'common',    icon: 'broadsword',      atk: 3 },
  'ember-sabre':   { name: 'Ember Sabre',    slot: 'weapon', rarity: 'rare',      icon: 'sparkling-sabre', atk: 6 },
  'relic-blade':   { name: 'Relic Blade',    slot: 'weapon', rarity: 'epic',      icon: 'relic-blade',     atk: 10 },
  'sword-in-stone':{ name: 'Founder\'s Sword', slot: 'weapon', rarity: 'legendary', icon: 'sword-in-stone', atk: 15 },
  'oak-staff':     { name: 'Oak Staff',      slot: 'staff',  rarity: 'common',    icon: 'wizard-staff',    spell: 5 },
  'crystal-wand':  { name: 'Crystal Wand',   slot: 'staff',  rarity: 'rare',      icon: 'crystal-wand',    spell: 10 },
  'void-orb':      { name: 'Void Orb',       slot: 'staff',  rarity: 'epic',      icon: 'crystal-ball',    spell: 15 },
  'leather-armor': { name: 'Leather Armor',  slot: 'armor',  rarity: 'common',    icon: 'leather-armor',   def: 2 },
  'chain-mail':    { name: 'Chain Mail',     slot: 'armor',  rarity: 'rare',      icon: 'chain-mail',      def: 5 },
  'scale-mail':    { name: 'Dragon Scale',   slot: 'armor',  rarity: 'legendary', icon: 'scale-mail',      def: 10 },
  'copper-ring':   { name: 'Copper Ring',    slot: 'ring',   rarity: 'common',    icon: 'ring',            regen: 1 },
  'mana-ring':     { name: 'Mana Ring',      slot: 'ring',   rarity: 'rare',      icon: 'ring',            regen: 3 },
  'sage-ring':     { name: 'Sage Ring',      slot: 'ring',   rarity: 'epic',      icon: 'ring',            regen: 5 },
  'rune-crown':    { name: 'Crown of Runes', slot: 'ring',   rarity: 'mythic',    icon: 'jewel-crown',     regen: 8, atk: 4, spell: 8 },
};
export const SLOTS = ['weapon', 'staff', 'armor', 'ring'];
export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic'];
export const RARITY_COLOR = { common: '#9aa3b2', rare: '#60a5fa', epic: '#c084fc', legendary: '#f2b84b', mythic: '#f472b6' };
export const itemPower = (it) => (it ? (it.atk || 0) + (it.spell || 0) * 0.8 + (it.def || 0) * 1.4 + (it.regen || 0) * 2.5 : 0);

export const ENEMY_KINDS = {
  'slime-green': { name: 'Off-by-one Slime', hp: 30, speed: 3.2, dmg: 8,  type: 'Grass',  xp: 20, gold: 25, sprite: 'slime-green' },
  'slime-red':   { name: 'NaN Slime', hp: 40, speed: 3.8, dmg: 10, type: 'Fire',   xp: 24, gold: 30, sprite: 'slime-red' },
  'bat':         { name: 'Seagull',     hp: 26, speed: 5.5, dmg: 8,  type: 'Flying', xp: 22, gold: 30, sprite: 'seagull', flying: true },
  'skeleton':    { name: 'Legacy Code',  hp: 52, speed: 3.6, dmg: 12, type: 'Ghost',  xp: 30, gold: 40, sprite: 'skeleton' },
  'slime-dark':  { name: 'Null Pointer', hp: 46, speed: 4.0, dmg: 12, type: 'Dark',   xp: 30, gold: 40, sprite: 'slime-dark' },
};

export const TYPE_CHART = {
  Fire:     { Grass: 1.5, Ice: 1.5, Water: 0.6, Fire: 0.6, Dragon: 0.6 },
  Water:    { Fire: 1.5, Grass: 0.6, Water: 0.6, Dragon: 0.6 },
  Electric: { Water: 1.5, Flying: 1.5, Grass: 0.6, Electric: 0.6, Dragon: 0.6 },
  Dragon:   { Dragon: 1.5 },
  Normal:   { Ghost: 0.6 },
  Psychic:  { Ghost: 1.5, Psychic: 0.6, Dark: 0.6 },
  Ice:      { Grass: 1.5, Flying: 1.5, Dragon: 1.5, Fire: 0.6, Ice: 0.6 },
};
export const typeMult = (a, d) => (TYPE_CHART[a] && TYPE_CHART[a][d]) || 1;
export const TYPE_COLOR = {
  Normal: '#e2c290', Electric: '#fde047', Fire: '#fb923c', Water: '#38bdf8', Dragon: '#818cf8',
  Psychic: '#f472b6', Grass: '#4ade80', Flying: '#a5b4fc', Ghost: '#a78bfa', Dark: '#64748b', Ice: '#67e8f9',
};

/**
 * Companions. `moves` power the turn-based battles; `field` powers the companion following the
 * player on the island (auto-attack projectile + a signature move on G).
 */
export const SPECIES = {
  bit: {
    name: 'Bit', type: 'Normal', maxHp: 76, captureRate: 0.25, sprite: 'bit',
    desc: 'Your first companion. Curious, round, and surprisingly sturdy.',
    moves: [
      { name: 'Headbutt', power: 18, text: 'Bit charged in headfirst!' },
      { name: 'Reboot', power: 10, heal: 10, text: 'Bit shook itself off and patched a little HP.' },
    ],
    field: { power: 7, interval: 1050, range: 9, proj: 'star', sig: { name: 'Bit Storm', kind: 'volley', count: 5, power: 9, cd: 11000 } },
  },
  sparkit: {
    name: 'Sparkit', type: 'Electric', maxHp: 62, captureRate: 0.34, sprite: 'sparkit',
    mount: { name: 'Static Dash', bonus: 1.1 },
    desc: 'A fox kit that crackles when excited. Fast, fragile, zaps bats.',
    moves: [
      { name: 'Jolt', power: 22, text: 'Sparkit loosed a crackling jolt!' },
      { name: 'Static Field', power: 14, text: 'Sparkit spread static across the ground!' },
    ],
    field: { power: 6, interval: 800, range: 10, proj: 'spark', sig: { name: 'Chain Jolt', kind: 'chain', count: 3, power: 22, cd: 10000 } },
  },
  voltrix: {
    name: 'Voltrix', type: 'Electric', maxHp: 90, captureRate: 0.16, sprite: 'voltrix',
    mount: { name: 'Storm Runner', bonus: 2.5 },
    desc: 'Sparkit grown into a storm. Chains lightning through whole packs.',
    moves: [
      { name: 'Volt Crash', power: 30, text: 'Voltrix crashed forward in a storm of sparks!' },
      { name: 'Charge Up', power: 16, heal: 10, text: 'Voltrix stored charge and steadied itself.' },
    ],
    field: { power: 10, interval: 800, range: 11, proj: 'spark', sig: { name: 'Thunderhead', kind: 'chain', count: 6, power: 30, cd: 10000 } },
  },
  emberling: {
    name: 'Emberling', type: 'Fire', maxHp: 74, captureRate: 0.31, sprite: 'emberling',
    mount: { name: 'Ember Trot', bonus: 2.2 },
    desc: 'A salamander with a candle tail. Melts slimes and ice.',
    moves: [
      { name: 'Flame Dash', power: 24, text: 'Emberling dashed through in a streak of flame!' },
      { name: 'Warm Up', power: 12, heal: 12, text: 'Emberling warmed itself and recovered.' },
    ],
    field: { power: 8, interval: 1100, range: 9, proj: 'ember', sig: { name: 'Flame Fan', kind: 'burst', radius: 3.5, power: 28, cd: 11000 } },
  },
  pyrelion: {
    name: 'Pyrelion', type: 'Fire', maxHp: 96, captureRate: 0.16, sprite: 'pyrelion',
    mount: { name: 'Blaze Gallop', bonus: 2.8 },
    desc: 'Emberling with a mane of fire. The fastest thing on the island.',
    moves: [
      { name: 'Inferno Rush', power: 32, text: 'Pyrelion barrelled through in a wall of fire!' },
      { name: 'Roar', power: 14, heal: 16, text: 'Pyrelion roared and shook off the damage.' },
    ],
    field: { power: 12, interval: 1000, range: 10, proj: 'ember', sig: { name: 'Inferno', kind: 'burst', radius: 5, power: 40, cd: 11000 } },
  },
  tidefin: {
    name: 'Tidefin', type: 'Water', maxHp: 88, captureRate: 0.28, sprite: 'tidefin',
    mount: { name: 'Tide Glide', bonus: 1.5 },
    desc: 'A gentle water creature. Douses fire and looks after the trainer.',
    moves: [
      { name: 'Bubble Jet', power: 20, text: 'Tidefin fired a broad bubble jet!' },
      { name: 'Tide Song', power: 8, heal: 18, text: 'Tidefin hummed a restoring tide song.' },
    ],
    field: { power: 7, interval: 1300, range: 10, proj: 'bubble', sig: { name: 'Tide Song', kind: 'heal', heal: 45, power: 14, radius: 5, cd: 14000 } },
  },
  wyrmlet: {
    name: 'Wyrmlet', type: 'Dragon', maxHp: 92, captureRate: 0.2, sprite: 'wyrmlet',
    mount: { name: 'Sky Ribbon', bonus: 1.7 },
    desc: 'A young serpent dragon. The Deadline Dragon fears its own kind.',
    moves: [
      { name: 'Dragon Pulse', power: 28, text: 'Wyrmlet released a compressed dragon pulse!' },
      { name: 'Mist Coil', power: 12, heal: 14, text: 'Wyrmlet coiled into mist and recovered.' },
    ],
    field: { power: 10, interval: 1200, range: 12, proj: 'pulse', sig: { name: 'Dragon Pulse', kind: 'beam', power: 48, cd: 12000 } },
  },
  oracle: {
    name: 'Oracle', type: 'Psychic', maxHp: 100, captureRate: 0, sprite: 'oracle',
    desc: 'Waited in the chamber for someone who earned all three runes.',
    moves: [
      { name: 'Mind Lance', power: 34, text: 'Oracle bent space around the target!' },
      { name: 'Foresight', power: 20, heal: 18, text: 'Oracle glimpsed ahead and glowed brighter.' },
    ],
    field: { power: 13, interval: 850, range: 12, proj: 'psy', sig: { name: 'Mind Nova', kind: 'nova', power: 36, shield: 2, cd: 12000 } },
  },
};

export const WILD_TABLES = {
  // Bit is Yichen's one-of-a-kind companion, never a wild monster (it used to fight itself)
  meadow: ['sparkit', 'emberling', 'sparkit', 'tidefin'],
  camp: ['emberling', 'tidefin', 'sparkit'],
  shadow: ['tidefin', 'wyrmlet', 'sparkit'],
  peak: ['wyrmlet', 'emberling', 'wyrmlet'],
};

export const EVOLUTIONS = { sparkit: 'voltrix', emberling: 'pyrelion' };
export const EVOLVE_LEVEL = 5;
export const BUDDY_MAX_LEVEL = 20;
export const buddyXpNeeded = (lv) => 40 + lv * 20;

export const RIVALS = {
  nell: {
    name: 'Archivist Nell', roster: ['tidefin', 'sparkit'],
    reward: { gold: 260, xp: 70, capsules: 2 }, badge: 'library', levelBump: -1, dmgScale: 0.75,
    blurb: 'Patient and methodical. Wears you down with sustain.',
    intro: 'Archivist Nell closes her book. "Show me what you have learned."',
  },
  unit7: {
    name: 'Unit-7', roster: ['emberling', 'wyrmlet', 'pyrelion'],
    reward: { gold: 420, xp: 110, potions: 2 }, badge: 'forge', requires: 'library', levelBump: 0, dmgScale: 0.9,
    blurb: 'Runs hot. Fire and dragon pressure from the first turn.',
    intro: 'Unit-7 spins up its fans. "Calibration duel: begin."',
  },
};
export const BADGES = { library: 'Library Badge', forge: 'Forge Badge' };

export const NPC_NAMES = { owl: 'Archivist Nell', robot: 'Unit-7', merchant: 'Mo', frog: 'Tide', sprout: 'Fern', cartographer: 'Ash' };
