// Persistent save data: one versioned JSON blob in localStorage.
// Saves from the two earlier versions of this page (scattered rpg_* keys, and the v2 blob that
// still used borrowed creature names) are migrated once onto the island's own roster.

const KEY = 'yl.save.v2';

function defaults() {
  return {
    v: 2,
    island: { v: 1 },
    settings: { sound: true, music: false, tutorial: false, trackerCollapsed: false },
    player: { level: 1, xp: 0, gold: 0, score: 0, bonusHp: 0, bonusMp: 0 },
    tokens: [],
    npcsMet: [],
    dialogRewards: {},
    equipment: {},
    bosses: {
      ice: { round: 1, kills: 0 },
      shadow: { round: 1, kills: 0 },
      dragon: { round: 1, kills: 0 },
    },
    runes: { ice: false, shadow: false, dragon: false },
    secret: { unsealed: false, chest: false },
    achievements: {},
    stats: { kills: 0, bossKills: 0, crits: 0, purchases: 0, deaths: 0, superEffective: 0, captures: 0, signatures: 0, playMs: 0, spells: {} },
    best: { typing: 0, memory: 0, snake: 0, breakout: 0 },
    leaderboard: [],
    trainer: {
      captured: { bit: true },
      seen: { bit: true },
      party: ['bit'],
      active: 'bit',
      mount: null,
      levels: { bit: 1 },
      xp: { bit: 0 },
      bag: { capsules: 6, potions: 3 },
      badges: [],
      wins: {},
      restockAt: 0,
    },
  };
}

/** Deep-merge saved data onto defaults so new fields always exist. */
function merge(base, saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(base)) return saved ?? base;
  const out = { ...base };
  for (const k of Object.keys(saved)) {
    const b = base[k];
    const s = saved[k];
    out[k] = b && typeof b === 'object' && !Array.isArray(b) && s && typeof s === 'object' && !Array.isArray(s)
      ? merge(b, s)
      : s;
  }
  return out;
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------- id maps
// Creature, rival, badge and item ids used by the previous versions of the game.
const SPECIES_MAP = {
  eevee: 'bit', pikachu: 'sparkit', raichu: 'voltrix', growlithe: 'emberling', arcanine: 'pyrelion',
  lapras: 'tidefin', dragonair: 'wyrmlet', charmander: 'emberling', mew: 'oracle',
};
const BADGE_MAP = { logic: 'library', wild: 'forge', 'logic-badge': 'library', 'wild-badge': 'forge' };
const RIVAL_MAP = { mika: 'nell', tao: 'unit7', researcher_mika: 'nell', ranger_tao: 'unit7' };
const ITEM_MAP = {
  'fire-sword': 'ember-sabre', 'dark-blade': 'relic-blade', excalibur: 'sword-in-stone',
  'arcane-staff': 'crystal-wand', 'void-staff': 'void-orb', 'dragon-armor': 'scale-mail',
};
const NPC_MAP = { pikachu: 'unit7', charmander: 'fern', squirtle: 'tide', mario: 'mo', kirby: 'nell', link: 'ash' };
const NPC_BY_OLD_ID = { 1: 'unit7', 2: 'fern', 3: 'tide', 4: 'mo', 5: 'nell', 6: 'ash' };
const ITEM_BY_OLD_NAME = {
  'Iron Sword': 'iron-sword', 'Fire Sword': 'ember-sabre', 'Dark Blade': 'relic-blade', Excalibur: 'sword-in-stone',
  'Oak Staff': 'oak-staff', 'Arcane Staff': 'crystal-wand', 'Void Staff': 'void-orb',
  'Leather Armor': 'leather-armor', 'Chain Mail': 'chain-mail', 'Dragon Armor': 'scale-mail',
  'Copper Ring': 'copper-ring', 'Mana Ring': 'mana-ring', 'Sage Ring': 'sage-ring',
};

function remapKeys(obj, map) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const nk = map[k] || k;
    out[nk] = typeof v === 'number' && typeof out[nk] === 'number' ? Math.max(out[nk], v) : (out[nk] ?? v);
  }
  return out;
}

/** v2 saves written before the island: rename everything onto the current roster. */
function migrateV2(s) {
  const t = s.trainer;
  t.captured = remapKeys(t.captured, SPECIES_MAP);
  t.seen = remapKeys(t.seen, SPECIES_MAP);
  t.levels = remapKeys(t.levels, SPECIES_MAP);
  t.xp = remapKeys(t.xp, SPECIES_MAP);
  t.party = [...new Set((t.party || []).map((id) => SPECIES_MAP[id] || id))];
  if (!t.party.length) t.party = ['bit'];
  t.active = SPECIES_MAP[t.active] || t.active;
  if (!t.party.includes(t.active)) t.active = t.party[0];
  t.mount = t.mount ? SPECIES_MAP[t.mount] || t.mount : null;
  t.badges = [...new Set((t.badges || []).map((b) => BADGE_MAP[b] || b))];
  t.wins = remapKeys(t.wins, RIVAL_MAP);
  for (const slot of Object.keys(s.equipment || {})) s.equipment[slot] = ITEM_MAP[s.equipment[slot]] || s.equipment[slot];
  s.npcsMet = [...new Set((s.npcsMet || []).map((id) => NPC_MAP[id] || id))];
  s.dialogRewards = remapKeys(s.dialogRewards, NPC_MAP);
  s.island = { v: 1 };
}

/** Import progress from the original single-file version of the site. */
function migrateLegacy(s) {
  let found = false;
  const num = (k) => {
    const v = localStorage.getItem(k);
    if (v == null) return null;
    found = true;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const level = num('rpg_level');
  if (level) s.player.level = Math.max(1, Math.min(99, level));
  const xp = num('rpg_xp');
  if (xp != null) s.player.xp = Math.max(0, xp);
  const score = num('rpg_score');
  if (score != null) { s.player.gold = Math.max(0, score); s.player.score = Math.max(0, score); }
  const coins = readJSON('rpg_coin_ids', null);
  if (Array.isArray(coins)) { found = true; s.tokens = [...new Set(coins.map(String))]; }
  const npcs = readJSON('rpg_npcs', null);
  if (Array.isArray(npcs)) { found = true; s.npcsMet = [...new Set(npcs.map((id) => NPC_BY_OLD_ID[id]).filter(Boolean))]; }
  const rewards = readJSON('rpg_dialog_rewards', null);
  if (rewards && typeof rewards === 'object') {
    found = true;
    for (const [id, v] of Object.entries(rewards)) if (v && NPC_BY_OLD_ID[id]) s.dialogRewards[NPC_BY_OLD_ID[id]] = true;
  }
  const equip = readJSON('rpg_equipment', null);
  if (equip && typeof equip === 'object') {
    found = true;
    for (const [slot, item] of Object.entries(equip)) {
      const id = item && ITEM_BY_OLD_NAME[item.name];
      if (id) s.equipment[slot] = id;
    }
  }
  const dragonRound = num('rpg_boss_round');
  if (dragonRound) s.bosses.dragon.round = Math.min(10, dragonRound);
  const iceRound = num('rpg_miniboss_ice_round');
  if (iceRound) s.bosses.ice.round = Math.min(10, iceRound);
  const shadowRound = num('rpg_miniboss_shadow_round');
  if (shadowRound) s.bosses.shadow.round = Math.min(10, shadowRound);
  const ach = readJSON('rpg_achievements', null);
  if (ach && typeof ach === 'object') {
    found = true;
    for (const [k, v] of Object.entries(ach)) if (v) s.achievements[k === 'shoppingSoree' ? 'shoppingSpree' : k] = true;
  }
  const kills = num('rpg_enemies_defeated');
  if (kills != null) s.stats.kills = kills;
  const purchases = num('rpg_purchases');
  if (purchases != null) s.stats.purchases = purchases;
  const spells = readJSON('rpg_skills_used', null);
  if (spells && typeof spells === 'object') {
    found = true;
    for (const [k, v] of Object.entries(spells)) if (v) s.stats.spells[k === 'ultimate' ? 'meteor' : k] = true;
  }
  const typing = num('rpg_typing_best');
  if (typing) s.best.typing = typing;
  const lb = readJSON('rpg_leaderboard', null);
  if (Array.isArray(lb)) { found = true; s.leaderboard = lb.slice(0, 5).map((e) => ({ score: e.score | 0, level: e.level | 0, date: e.date || '' })); }
  if (localStorage.getItem('rpg_tutorial_done') === 'true') { found = true; s.settings.tutorial = true; }

  const old = readJSON('monster_trainer_state', null);
  if (old && typeof old === 'object') {
    found = true;
    const t = s.trainer;
    if (old.captured) t.captured = { ...t.captured, ...remapKeys(old.captured, SPECIES_MAP) };
    if (old.seen) t.seen = { ...t.seen, ...remapKeys(old.seen, SPECIES_MAP) };
    if (Array.isArray(old.party) && old.party.length) t.party = [...new Set(old.party.map((id) => SPECIES_MAP[id] || id))];
    if (old.activeBuddy) t.active = SPECIES_MAP[old.activeBuddy] || old.activeBuddy;
    if (old.activeMount) t.mount = SPECIES_MAP[old.activeMount] || old.activeMount;
    if (old.buddyLevels) t.levels = { ...t.levels, ...remapKeys(old.buddyLevels, SPECIES_MAP) };
    if (old.bag) t.bag = { capsules: old.bag.capsules | 0, potions: old.bag.potions | 0 };
    if (Array.isArray(old.badges)) t.badges = [...new Set(old.badges.map((b) => BADGE_MAP[b] || b))];
    if (old.battleWins) for (const [k, v] of Object.entries(old.battleWins)) if (v) t.wins[RIVAL_MAP[k] || k] = true;
    if (!t.party.includes(t.active)) t.active = t.party[0];
    for (const id of t.party) { if (!t.levels[id]) t.levels[id] = 1; if (!t.xp[id]) t.xp[id] = 0; }
  }
  if (localStorage.getItem('rpg_pet_active') === 'true') {
    found = true;
    const t = s.trainer;
    t.captured.emberling = true;
    t.seen.emberling = true;
    if (!t.party.includes('emberling')) t.party.push('emberling');
    t.levels.emberling = t.levels.emberling || 1;
    t.xp.emberling = t.xp.emberling || 0;
  }
  for (const b of Object.values(s.bosses)) b.kills = Math.max(b.kills, b.round - 1);
  // The secret chamber is intentionally not migrated: it used to open at the spawn point.
  // It now sits behind the three boss runes and starts sealed for everyone.
  return found;
}

function load() {
  const saved = readJSON(KEY, null);
  if (saved && saved.v === 2) {
    const s = merge(defaults(), saved);
    if (!saved.island) { try { migrateV2(s); } catch (err) { console.warn('[save] v2 migration failed', err); } }
    return s;
  }
  const s = defaults();
  try { migrateLegacy(s); } catch (err) { console.warn('[save] legacy migration failed', err); }
  return s;
}

export const S = load();

let timer = 0;
export function save() {
  clearTimeout(timer);
  timer = setTimeout(saveNow, 250);
}

export function saveNow() {
  clearTimeout(timer);
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage full or blocked */ }
}

export function resetSave() {
  const keep = { ...S.settings, tutorial: true };
  const fresh = defaults();
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, fresh, { settings: keep });
  saveNow();
}

window.addEventListener('pagehide', saveNow);
