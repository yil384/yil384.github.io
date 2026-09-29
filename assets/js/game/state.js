// Persistent save data. One versioned JSON blob instead of ~25 scattered localStorage keys.
// Older saves (rpg_* keys + monster_trainer_state) are migrated once on first load.

const KEY = 'yl.save.v2';

function defaults() {
  return {
    v: 2,
    settings: { mode: 'play', sound: true, music: false, tutorial: false },
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
    stats: { kills: 0, bossKills: 0, crits: 0, purchases: 0, deaths: 0, superEffective: 0, captures: 0, playMs: 0, spells: {} },
    best: { typing: 0, memory: 0, snake: 0, breakout: 0 },
    leaderboard: [],
    trainer: {
      captured: { eevee: true },
      seen: { eevee: true },
      party: ['eevee'],
      active: 'eevee',
      mount: null,
      levels: { eevee: 1 },
      xp: { eevee: 0 },
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

const NPC_BY_OLD_ID = { 1: 'pikachu', 2: 'charmander', 3: 'squirtle', 4: 'mario', 5: 'kirby', 6: 'link' };
const ITEM_BY_OLD_NAME = {
  'Iron Sword': 'iron-sword', 'Fire Sword': 'fire-sword', 'Dark Blade': 'dark-blade', Excalibur: 'excalibur',
  'Oak Staff': 'oak-staff', 'Arcane Staff': 'arcane-staff', 'Void Staff': 'void-staff',
  'Leather Armor': 'leather-armor', 'Chain Mail': 'chain-mail', 'Dragon Armor': 'dragon-armor',
  'Copper Ring': 'copper-ring', 'Mana Ring': 'mana-ring', 'Sage Ring': 'sage-ring',
};

/** Import progress from the previous single-file version of the site. */
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
  if (Array.isArray(npcs)) { found = true; s.npcsMet = npcs.map((id) => NPC_BY_OLD_ID[id]).filter(Boolean); }

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
  if (spells && typeof spells === 'object') { found = true; s.stats.spells = spells; }
  const typing = num('rpg_typing_best');
  if (typing) s.best.typing = typing;
  const lb = readJSON('rpg_leaderboard', null);
  if (Array.isArray(lb)) { found = true; s.leaderboard = lb.slice(0, 5).map((e) => ({ score: e.score | 0, level: e.level | 0, date: e.date || '' })); }
  if (localStorage.getItem('rpg_tutorial_done') === 'true') { found = true; s.settings.tutorial = true; }

  const old = readJSON('monster_trainer_state', null);
  if (old && typeof old === 'object') {
    found = true;
    const t = s.trainer;
    if (old.captured) t.captured = { ...t.captured, ...old.captured };
    if (old.seen) t.seen = { ...t.seen, ...old.seen };
    if (Array.isArray(old.party) && old.party.length) t.party = [...new Set(old.party)];
    if (old.activeBuddy) t.active = old.activeBuddy;
    if (old.activeMount) t.mount = old.activeMount;
    if (old.buddyLevels) t.levels = { ...t.levels, ...old.buddyLevels };
    if (old.bag) t.bag = { capsules: old.bag.capsules | 0, potions: old.bag.potions | 0 };
    const BADGE = { 'logic-badge': 'logic', 'wild-badge': 'wild' };
    const RIVAL = { researcher_mika: 'mika', ranger_tao: 'tao' };
    if (Array.isArray(old.badges)) t.badges = [...new Set(old.badges.map((b) => BADGE[b] || b))];
    if (old.battleWins) for (const [k, v] of Object.entries(old.battleWins)) if (v) t.wins[RIVAL[k] || k] = true;
    for (const id of t.party) { if (!t.levels[id]) t.levels[id] = 1; if (!t.xp[id]) t.xp[id] = 0; }
  }
  // The old companion pet was a Charmander; bring it into the party system.
  if (localStorage.getItem('rpg_pet_active') === 'true') {
    found = true;
    s.trainer.captured.charmander = true;
    s.trainer.seen.charmander = true;
    if (!s.trainer.party.includes('charmander')) s.trainer.party.push('charmander');
    s.trainer.levels.charmander = s.trainer.levels.charmander || 1;
    s.trainer.xp.charmander = s.trainer.xp.charmander || 0;
  }
  // Earlier boss rounds imply earlier victories.
  for (const b of Object.values(s.bosses)) b.kills = Math.max(b.kills, b.round - 1);
  // Note: the secret chamber is intentionally NOT migrated. It used to trigger right at the
  // spawn point; it is now gated behind the three boss runes and starts sealed again.
  return found;
}

function load() {
  const saved = readJSON(KEY, null);
  if (saved && saved.v === 2) return merge(defaults(), saved);
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
