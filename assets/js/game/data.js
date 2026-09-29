// Static game data: items, enemies, monster species, type matchups.

export const ITEMS = {
  'iron-sword':    { name: 'Iron Sword',     slot: 'weapon', rarity: 'common',    icon: '🗡️', atk: 3 },
  'fire-sword':    { name: 'Fire Sword',     slot: 'weapon', rarity: 'rare',      icon: '🗡️', atk: 6 },
  'dark-blade':    { name: 'Dark Blade',     slot: 'weapon', rarity: 'epic',      icon: '⚔️', atk: 10 },
  'excalibur':     { name: 'Excalibur',      slot: 'weapon', rarity: 'legendary', icon: '⚔️', atk: 15 },
  'oak-staff':     { name: 'Oak Staff',      slot: 'staff',  rarity: 'common',    icon: '🪄', spell: 5 },
  'arcane-staff':  { name: 'Arcane Staff',   slot: 'staff',  rarity: 'rare',      icon: '🪄', spell: 10 },
  'void-staff':    { name: 'Void Staff',     slot: 'staff',  rarity: 'epic',      icon: '🔮', spell: 15 },
  'leather-armor': { name: 'Leather Armor',  slot: 'armor',  rarity: 'common',    icon: '🥋', def: 2 },
  'chain-mail':    { name: 'Chain Mail',     slot: 'armor',  rarity: 'rare',      icon: '🛡️', def: 5 },
  'dragon-armor':  { name: 'Dragon Armor',   slot: 'armor',  rarity: 'legendary', icon: '🛡️', def: 10 },
  'copper-ring':   { name: 'Copper Ring',    slot: 'ring',   rarity: 'common',    icon: '💍', regen: 1 },
  'mana-ring':     { name: 'Mana Ring',      slot: 'ring',   rarity: 'rare',      icon: '💍', regen: 3 },
  'sage-ring':     { name: 'Sage Ring',      slot: 'ring',   rarity: 'epic',      icon: '💍', regen: 5 },
  // Secret chamber exclusive
  'rune-crown':    { name: 'Crown of Runes', slot: 'ring',   rarity: 'mythic',    icon: '👑', regen: 8, atk: 4, spell: 8 },
};

export const SLOTS = ['weapon', 'staff', 'armor', 'ring'];
export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic'];
export const RARITY_COLOR = { common: '#94a3b8', rare: '#60a5fa', epic: '#c084fc', legendary: '#f5c542', mythic: '#f472b6' };

export function itemPower(item) {
  if (!item) return 0;
  return (item.atk || 0) + (item.spell || 0) * 0.8 + (item.def || 0) * 1.4 + (item.regen || 0) * 2.5;
}

export const ENEMY_KINDS = {
  'slime-green': { name: 'Green Slime', hp: 30, speed: 42, dmg: 8,  type: 'Grass',  xp: 20, gold: 25, sprite: 'slime-green' },
  'slime-red':   { name: 'Ember Slime', hp: 40, speed: 55, dmg: 10, type: 'Fire',   xp: 24, gold: 30, sprite: 'slime-red' },
  'bat':         { name: 'Cave Bat',    hp: 26, speed: 95, dmg: 8,  type: 'Flying', xp: 22, gold: 30, sprite: 'bat', flying: true },
  'skeleton':    { name: 'Skeleton',    hp: 52, speed: 55, dmg: 12, type: 'Ghost',  xp: 30, gold: 40, sprite: 'skeleton' },
  'slime-dark':  { name: 'Void Slime',  hp: 46, speed: 62, dmg: 12, type: 'Dark',   xp: 30, gold: 40, sprite: 'slime-dark' },
};

// Attack type -> defender type -> multiplier. Unlisted pairs are 1.0.
export const TYPE_CHART = {
  Fire:     { Grass: 1.5, Ice: 1.5, Water: 0.6, Fire: 0.6, Dragon: 0.6 },
  Water:    { Fire: 1.5, Grass: 0.6, Water: 0.6, Dragon: 0.6 },
  Electric: { Water: 1.5, Flying: 1.5, Grass: 0.6, Electric: 0.6, Dragon: 0.6 },
  Dragon:   { Dragon: 1.5 },
  Normal:   { Ghost: 0.6 },
  Psychic:  { Ghost: 1.5, Psychic: 0.6, Dark: 0.6 },
  Ice:      { Grass: 1.5, Flying: 1.5, Dragon: 1.5, Fire: 0.6, Ice: 0.6 },
};

export function typeMult(attack, defend) {
  return (TYPE_CHART[attack] && TYPE_CHART[attack][defend]) || 1;
}

export const TYPE_COLOR = {
  Normal: '#e2c290', Electric: '#fde047', Fire: '#fb923c', Water: '#60a5fa', Dragon: '#818cf8',
  Psychic: '#f472b6', Grass: '#4ade80', Flying: '#a5b4fc', Ghost: '#a78bfa', Dark: '#64748b', Ice: '#67e8f9',
};

/**
 * Monster species. `moves` power turn-based encounters; `field` powers the companion that
 * follows the player on the page (auto-attack projectile + a signature move on G).
 */
export const SPECIES = {
  eevee: {
    name: 'Eevee', type: 'Normal', maxHp: 76, captureRate: 0.25,
    desc: 'Starter scout. Balanced stats and a reliable finisher.',
    moves: [
      { name: 'Quick Attack', power: 18, text: 'Eevee rushed in with Quick Attack!' },
      { name: 'Charm Pulse', power: 10, heal: 10, text: 'Eevee softened the target and restored a little HP.' },
    ],
    field: { power: 7, interval: 1050, range: 250, proj: 'star', sig: { name: 'Swift', kind: 'volley', count: 5, power: 9, cd: 11000 } },
  },
  pikachu: {
    name: 'Pikachu', type: 'Electric', maxHp: 62, captureRate: 0.34,
    mount: { name: 'Volt Dash', bonus: 1.1 },
    desc: 'Fast opener. Zaps flying and aquatic foes.',
    moves: [
      { name: 'Thunder Jolt', power: 22, text: 'Pikachu fired a crackling Thunder Jolt!' },
      { name: 'Static Field', power: 14, text: 'Pikachu spread static across the arena!' },
    ],
    field: { power: 6, interval: 800, range: 260, proj: 'spark', sig: { name: 'Thunderbolt', kind: 'chain', count: 3, power: 22, cd: 10000 } },
  },
  raichu: {
    name: 'Raichu', type: 'Electric', maxHp: 90, captureRate: 0.16,
    mount: { name: 'Storm Surfer', bonus: 2.5 },
    desc: 'Evolved electric ace. Chains lightning through whole packs.',
    moves: [
      { name: 'Volt Crash', power: 30, text: 'Raichu crashed forward in a storm of electricity!' },
      { name: 'Charge Bloom', power: 16, heal: 10, text: 'Raichu stored charge and stabilised itself.' },
    ],
    field: { power: 10, interval: 800, range: 280, proj: 'spark', sig: { name: 'Thunder Storm', kind: 'chain', count: 6, power: 30, cd: 10000 } },
  },
  growlithe: {
    name: 'Growlithe', type: 'Fire', maxHp: 74, captureRate: 0.31,
    mount: { name: 'Blaze Runner', bonus: 2.2 },
    desc: 'Loyal fire pup. Melts slimes and ice.',
    moves: [
      { name: 'Flame Wheel', power: 24, text: 'Growlithe burst forward in a spinning flame wheel!' },
      { name: 'Howl Guard', power: 12, heal: 12, text: 'Growlithe howled, boosting morale and HP.' },
    ],
    field: { power: 8, interval: 1100, range: 240, proj: 'ember', sig: { name: 'Flamethrower', kind: 'burst', radius: 90, power: 28, cd: 11000 } },
  },
  arcanine: {
    name: 'Arcanine', type: 'Fire', maxHp: 96, captureRate: 0.16,
    mount: { name: 'Royal Gallop', bonus: 2.8 },
    desc: 'Evolved fire legend with premier riding speed.',
    moves: [
      { name: 'Inferno Rush', power: 32, text: 'Arcanine barrelled through with Inferno Rush!' },
      { name: 'Guardian Roar', power: 14, heal: 16, text: 'Arcanine let out a guardian roar and recovered HP.' },
    ],
    field: { power: 12, interval: 1000, range: 260, proj: 'ember', sig: { name: 'Inferno Rush', kind: 'burst', radius: 130, power: 40, cd: 11000 } },
  },
  lapras: {
    name: 'Lapras', type: 'Water', maxHp: 88, captureRate: 0.28,
    mount: { name: 'Aqua Glide', bonus: 1.5 },
    desc: 'Gentle support. Douses fire and heals the trainer.',
    moves: [
      { name: 'Bubble Beam', power: 20, text: 'Lapras launched a broad Bubble Beam!' },
      { name: 'Ocean Song', power: 8, heal: 18, text: 'Lapras sang a restorative ocean hymn.' },
    ],
    field: { power: 7, interval: 1300, range: 260, proj: 'bubble', sig: { name: 'Ocean Song', kind: 'heal', heal: 45, power: 14, radius: 140, cd: 14000 } },
  },
  dragonair: {
    name: 'Dragonair', type: 'Dragon', maxHp: 92, captureRate: 0.2,
    mount: { name: 'Sky Ribbon', bonus: 1.7 },
    desc: 'Elegant late-game bruiser. The Dragon King fears it.',
    moves: [
      { name: 'Dragon Pulse', power: 28, text: 'Dragonair released a compressed Dragon Pulse!' },
      { name: 'Mist Guard', power: 12, heal: 14, text: 'Dragonair summoned a veil of mist and recovered HP.' },
    ],
    field: { power: 10, interval: 1200, range: 300, proj: 'pulse', sig: { name: 'Dragon Pulse', kind: 'beam', power: 48, cd: 12000 } },
  },
  charmander: {
    name: 'Charmander', type: 'Fire', maxHp: 70, captureRate: 0,
    desc: 'Joined after you beat the Dragon King. Small flame, big heart.',
    moves: [
      { name: 'Ember', power: 22, text: 'Charmander spat a burst of embers!' },
      { name: 'Smokescreen', power: 10, heal: 12, text: 'Charmander hid in smoke and caught its breath.' },
    ],
    field: { power: 9, interval: 1000, range: 240, proj: 'ember', sig: { name: 'Flame Burst', kind: 'burst', radius: 100, power: 30, cd: 10000 } },
  },
  mew: {
    name: 'Mew', type: 'Psychic', maxHp: 100, captureRate: 0,
    desc: 'Mythical. Waits in the Secret Chamber for someone who earned all three runes.',
    moves: [
      { name: 'Psystrike', power: 34, text: 'Mew bent space around the target with Psystrike!' },
      { name: 'Ancient Power', power: 20, heal: 18, text: 'Mew drew on ancient power and glowed brighter.' },
    ],
    field: { power: 13, interval: 850, range: 320, proj: 'psy', sig: { name: 'Psystrike', kind: 'nova', power: 36, shield: 2, cd: 12000 } },
  },
};

export const WILD_TABLES = {
  'spark-field': ['pikachu', 'eevee', 'pikachu'],
  'camp-route': ['growlithe', 'eevee', 'lapras'],
  'forge-wilds': ['growlithe', 'dragonair', 'pikachu'],
  'research-garden': ['eevee', 'lapras', 'pikachu', 'dragonair'],
};

export const EVOLUTIONS = { pikachu: 'raichu', growlithe: 'arcanine' };
export const EVOLVE_LEVEL = 5;
export const BUDDY_MAX_LEVEL = 20;
export const buddyXpNeeded = (lv) => 40 + lv * 20;

export const RIVALS = {
  mika: {
    name: 'Researcher Mika', roster: ['lapras', 'pikachu'],
    reward: { gold: 260, xp: 70, capsules: 2 }, badge: 'logic', levelBump: -1, dmgScale: 0.75,
    blurb: 'An analytic rival built around control and sustain.',
    intro: 'Researcher Mika challenges you to a structured battle!',
  },
  tao: {
    name: 'Ranger Tao', roster: ['growlithe', 'dragonair', 'arcanine'],
    reward: { gold: 420, xp: 110, potions: 2 }, badge: 'wild', requires: 'logic', levelBump: 0, dmgScale: 0.9,
    blurb: 'Aggressive fire-and-dragon pressure. Beat Mika first.',
    intro: 'Ranger Tao blocks the route with an elite field squad!',
  },
};

export const BADGES = { logic: 'Logic Badge', wild: 'Wild Badge' };
