// Monster trainer system: party & buddy progression, mounts, the hub panels, and
// turn-based encounters in the grass (plus rival duels).
import { S, save } from './state.js';
import { clock } from './clock.js';
import { emit } from './bus.js';
import { spawnsOf, onMeasure, readView } from './world.js';
import {
  SPECIES, TYPE_COLOR, WILD_TABLES, EVOLUTIONS, EVOLVE_LEVEL, BUDDY_MAX_LEVEL, buddyXpNeeded,
  RIVALS, BADGES, typeMult,
} from './data.js';
import { player, reward, fullRestore, refreshLook, placeInView } from './player.js';
import { openModal, closeModal } from './modal.js';
import { applySprite } from './sprites.js';
import { toast, banner } from './notify.js';
import { h, esc, pick, randInt, clamp, $ } from './util.js';
import { sfx } from './audio.js';

const T = () => S.trainer;

// ---------------------------------------------------------------- party helpers
export function activeId() {
  const t = T();
  if (!t.party.length) t.party = ['eevee'];
  if (!t.party.includes(t.active)) t.active = t.party[0];
  return t.active;
}
export const activeSpecies = () => SPECIES[activeId()];
export const buddyLevel = (id) => T().levels[id] || 1;
export const buddyXp = (id) => T().xp[id] || 0;

export function grantBuddyXp(id, n) {
  const t = T();
  if (!t.captured[id]) return;
  t.xp[id] = (t.xp[id] || 0) + Math.round(n);
  let lv = buddyLevel(id);
  let up = false;
  while (lv < BUDDY_MAX_LEVEL && t.xp[id] >= buddyXpNeeded(lv)) {
    t.xp[id] -= buddyXpNeeded(lv);
    lv++;
    up = true;
  }
  if (lv >= BUDDY_MAX_LEVEL) t.xp[id] = 0;
  t.levels[id] = lv;
  if (up) {
    toast(`${SPECIES[id].name} grew to Lv.${lv}!`, { icon: '⬆️', tone: 'good' });
    emit('buddy:levelup', { id, level: lv });
    if (canEvolve(id)) toast(`${SPECIES[id].name} can evolve! Visit the Evolution Lab in the Adventure hub.`, { icon: '✨', tone: 'gold' });
  }
  save();
  renderHub();
}

export function canEvolve(id) {
  const to = EVOLUTIONS[id];
  return !!to && buddyLevel(id) >= EVOLVE_LEVEL && !T().captured[to];
}

export function setActive(id, quiet = false) {
  const t = T();
  if (!t.party.includes(id)) return;
  t.active = id;
  save();
  if (!quiet) toast(`Go, ${SPECIES[id].name}!`, { icon: '🐾' });
  emit('buddy:changed', id);
  renderHub();
}

export function cycleActive() {
  const t = T();
  if (t.party.length < 2) {
    toast('Catch more monsters in the grass to swap buddies.', { icon: '🌿' });
    return;
  }
  const i = t.party.indexOf(activeId());
  setActive(t.party[(i + 1) % t.party.length]);
}

export function capture(id, { quiet = false } = {}) {
  const t = T();
  const fresh = !t.captured[id];
  t.captured[id] = true;
  t.seen[id] = true;
  if (!t.levels[id]) t.levels[id] = 1;
  if (!t.xp[id]) t.xp[id] = 0;
  if (!t.party.includes(id)) t.party.push(id);
  if (fresh) {
    S.stats.captures++;
    if (SPECIES[id].mount && !quiet) toast(`Mount unlocked: ${SPECIES[id].mount.name}!`, { icon: '🐎', tone: 'gold' });
  }
  save();
  emit('capture', { id, fresh });
  renderHub();
}

export function setMount(id) {
  T().mount = id || null;
  save();
  refreshLook();
  toast(id ? `Riding ${SPECIES[id].mount.name}.` : 'Back on foot.', { icon: id ? '🐎' : '🚶' });
  emit('mount:changed', id);
  renderHub();
}

export function evolveActive() {
  const id = activeId();
  if (!canEvolve(id)) {
    const to = EVOLUTIONS[id];
    toast(to ? `${SPECIES[id].name} evolves at Lv.${EVOLVE_LEVEL} (now Lv.${buddyLevel(id)}).` : `${SPECIES[id].name} has no evolution.`, { icon: '🧬' });
    return;
  }
  const to = EVOLUTIONS[id];
  const t = T();
  t.captured[to] = true;
  t.seen[to] = true;
  t.levels[to] = buddyLevel(id);
  t.xp[to] = buddyXp(id);
  t.party = t.party.map((p) => (p === id ? to : p));
  if (t.active === id) t.active = to;
  if (t.mount === id) t.mount = to;
  S.stats.captures++;
  save();
  sfx('levelup');
  banner(`${SPECIES[id].name} evolved!`, `Say hello to ${SPECIES[to].name}.`, '✨');
  refreshLook();
  emit('buddy:changed', to);
  emit('capture', { id: to, fresh: true });
  renderHub();
}

export function restock() {
  const now = Date.now();
  const t = T();
  if (now < t.restockAt) {
    toast(`Supplies arrive in ${Math.ceil((t.restockAt - now) / 1000)}s.`, { icon: '⏳' });
    return;
  }
  t.bag.capsules += 2;
  t.bag.potions += 1;
  t.restockAt = now + 90000;
  save();
  sfx('purchase');
  toast('Bag restocked: +2 capsules, +1 potion.', { icon: '🎒', tone: 'good' });
  renderHub();
}

export function restoreAtStation() {
  fullRestore();
  sfx('heal');
  toast('Rested at the field station. HP and MP restored.', { icon: '🏕️', tone: 'good' });
}

// ---------------------------------------------------------------- fast travel
export function travelSpots() {
  const t = T();
  return [
    { id: 'profile', label: 'Profile Hall', open: true },
    { id: 'adventure', label: 'Adventure Hub', open: t.badges.includes('logic'), need: 'Logic Badge' },
    { id: 'dragon-lair', label: 'Dragon Lair', open: t.badges.includes('wild'), need: 'Wild Badge' },
    { id: 'secret-chamber', label: 'Secret Chamber', open: S.secret.unsealed, need: 'three runes' },
  ];
}

export function travelTo(id) {
  const el = document.getElementById(id);
  if (!el || el.hidden) return;
  el.scrollIntoView({ behavior: 'instant', block: 'start' });
  readView();
  placeInView();
  toast(`Fast travelled to ${el.dataset.zone || id}.`, { icon: '🌀' });
}

// ---------------------------------------------------------------- hub rendering
function spriteNode(id, scale = 2, cls = '') {
  const n = h('span', { class: `mini-sprite ${cls}` });
  applySprite(n, id, scale);
  return n;
}

function typeChip(type) {
  return h('span', { class: 'type-chip', style: { '--tc': TYPE_COLOR[type] || '#94a3b8' } }, type);
}

export function partyList() {
  const t = T();
  const wrap = h('div', { class: 'party__list' });
  for (const id of t.party) {
    const sp = SPECIES[id];
    const lv = buddyLevel(id);
    const need = buddyXpNeeded(lv);
    const active = id === activeId();
    wrap.append(h('div', { class: `party__slot${active ? ' is-active' : ''}` },
      spriteNode(id, 2),
      h('div', { class: 'party__info' },
        h('div', { class: 'party__name' }, sp.name, h('span', { class: 'party__lv' }, `Lv.${lv}`)),
        h('div', { class: 'party__meta' }, typeChip(sp.type), h('span', { class: 'muted' }, sp.field.sig.name)),
        h('div', { class: 'mini-bar' }, h('span', { style: { transform: `scaleX(${lv >= BUDDY_MAX_LEVEL ? 1 : buddyXp(id) / need})` } })),
      ),
      h('button', {
        type: 'button', class: `btn btn--small${active ? ' is-on' : ''}`, disabled: active,
        onclick: () => setActive(id),
      }, active ? 'Active' : 'Set'),
    ));
  }
  return wrap;
}

export function renderHub() {
  const t = T();
  const party = $('#party-list');
  if (party) party.replaceChildren(partyList());

  const dex = $('#dex-grid');
  if (dex) {
    const ids = Object.keys(SPECIES);
    const seen = ids.filter((id) => t.seen[id]).length;
    const caught = ids.filter((id) => t.captured[id]).length;
    $('#dex-count').textContent = `${caught} caught · ${seen}/${ids.length} seen`;
    dex.replaceChildren(...ids.map((id) => {
      const sp = SPECIES[id];
      const s = t.seen[id];
      const c = t.captured[id];
      return h('div', { class: `dex__card${c ? ' is-caught' : s ? ' is-seen' : ''}` },
        s ? spriteNode(id, 2) : h('span', { class: 'dex__unknown' }, '?'),
        h('div', { class: 'dex__name' }, s ? sp.name : '???'),
        s ? typeChip(sp.type) : h('span', { class: 'muted' }, 'Unknown'),
        h('p', { class: 'dex__desc' }, s ? sp.desc : 'Not discovered yet.'),
        h('div', { class: 'dex__status' }, c ? `Caught · Lv.${buddyLevel(id)}` : s ? 'Seen' : '—'),
      );
    }));
  }

  const bag = $('#bag-list');
  if (bag) {
    bag.innerHTML = `
      <div class="bag__row"><span>🧿 Capture capsules</span><b>${t.bag.capsules}</b></div>
      <div class="bag__row"><span>🧪 Buddy potions</span><b>${t.bag.potions}</b></div>`;
  }

  const mounts = $('#mount-list');
  if (mounts) {
    const avail = Object.keys(t.captured).filter((id) => t.captured[id] && SPECIES[id]?.mount);
    mounts.replaceChildren(
      ...avail.map((id) => h('button', {
        type: 'button', class: `pill${t.mount === id ? ' is-on' : ''}`, onclick: () => setMount(t.mount === id ? null : id),
        title: `+${SPECIES[id].mount.bonus.toFixed(1)} speed`,
      }, `${SPECIES[id].mount.name}`)),
      h('button', { type: 'button', class: `pill${!t.mount ? ' is-on' : ''}`, onclick: () => setMount(null) }, 'On foot'),
    );
    if (!avail.length) mounts.prepend(h('span', { class: 'muted small' }, 'Catch Pikachu, Growlithe, Lapras or Dragonair to ride them. '));
  }

  const travel = $('#travel-list');
  if (travel) {
    travel.replaceChildren(...travelSpots().map((s) => h('button', {
      type: 'button', class: `pill${s.open ? '' : ' is-locked'}`, disabled: !s.open,
      title: s.open ? `Travel to ${s.label}` : `Requires ${s.need}`,
      onclick: () => travelTo(s.id),
    }, s.open ? s.label : `🔒 ${s.label}`)));
  }

  const duels = $('#duel-list');
  if (duels) {
    duels.replaceChildren(...Object.entries(RIVALS).map(([key, r]) => {
      const won = !!t.wins[key];
      const locked = r.requires && !t.badges.includes(r.requires);
      return h('div', { class: `duel${won ? ' is-won' : ''}` },
        h('div', { class: 'duel__roster' }, ...r.roster.map((id) => spriteNode(id, 2))),
        h('div', { class: 'duel__info' },
          h('div', { class: 'duel__name' }, r.name, won ? h('span', { class: 'duel__won' }, '✓ cleared') : null),
          h('p', { class: 'muted small' }, r.blurb),
        ),
        h('button', {
          type: 'button', class: 'btn btn--small', disabled: locked,
          title: locked ? `Requires ${BADGES[r.requires]}` : '',
          onclick: () => startRival(key),
        }, locked ? '🔒 Locked' : won ? 'Rematch' : 'Duel'),
      );
    }));
  }

  const badges = $('#badge-list');
  if (badges) {
    badges.replaceChildren(...Object.entries(BADGES).map(([k, label]) =>
      h('span', { class: `badge-chip${t.badges.includes(k) ? ' is-on' : ''}` }, `${t.badges.includes(k) ? '🏅' : '◌'} ${label}`)));
  }
  emit('hub:render');
}

// ---------------------------------------------------------------- grass & encounters
const grass = [];
let encounterCooldown = 0;
let lastStep = { x: 0, y: 0 };
let battle = null;

export function initMonsters() {
  activeId();
  const layer = document.getElementById('world');
  for (const sp of spawnsOf('grass')) {
    const el = h('div', { class: 'grass' }, h('span', { class: 'grass__label' }, sp.data.label || 'Tall grass'));
    layer.append(el);
    grass.push({ sp, el, w: 150, h: 64 });
  }
  const sync = () => {
    for (const g of grass) {
      g.el.hidden = !g.sp.active;
      g.el.style.transform = `translate3d(${g.sp.x}px, ${g.sp.y}px, 0)`;
    }
  };
  onMeasure(sync);
  document.querySelector('#hub')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const a = b.dataset.action;
    if (a === 'restore') restoreAtStation();
    else if (a === 'restock') restock();
    else if (a === 'evolve') evolveActive();
  });
  renderHub();
}

function grassAt(x, y) {
  for (const g of grass) {
    if (!g.sp.active) continue;
    if (Math.abs(x - g.sp.x) < g.w / 2 && Math.abs(y - g.sp.y) < g.h / 2) return g;
  }
  return null;
}

export function updateGrass() {
  if (battle || player.dead) return;
  const g = grassAt(player.x, player.y);
  for (const x of grass) x.el.classList.toggle('is-rustling', x === g && player.walking);
  if (!g || !player.walking || clock.t < encounterCooldown) {
    lastStep = { x: player.x, y: player.y };
    return;
  }
  if (Math.hypot(player.x - lastStep.x, player.y - lastStep.y) < 22) return;
  lastStep = { x: player.x, y: player.y };
  const m = S.trainer.mount ? SPECIES[S.trainer.mount]?.mount?.bonus || 0 : 0;
  if (Math.random() < Math.max(0.05, 0.11 - m * 0.012)) startWild(g.sp.data.biome);
}

// Both sides scale the same way with level, so a trained buddy actually feels stronger.
function levelFactor(lv) { return 1 + (lv - 1) * 0.08; }
const hpAt = (id, lv) => Math.round(SPECIES[id].maxHp * levelFactor(lv));

function allyState(id) {
  if (!battle.allies[id]) {
    const max = hpAt(id, buddyLevel(id));
    battle.allies[id] = { hp: max, max, pp: [10, 10] };
  }
  return battle.allies[id];
}

function startBattle(cfg) {
  const allyId = activeId();
  battle = {
    ...cfg,
    idx: 0,
    allies: {},
    allyId,
    busy: false,
    over: false,
  };
  loadEnemy(0);
  allyState(allyId);
  sfx('encounter');
  battle.modal = openModal({
    id: 'battle',
    variant: 'battle',
    title: cfg.mode === 'rival' ? cfg.rival.name : 'Wild encounter',
    label: 'Monster battle',
    className: 'battle-panel',
    dismissible: false,
    body: (b) => buildBattle(b),
    onKey: battleKey,
    onClose: () => {
      battle = null;
      encounterCooldown = clock.t + 3500;
      renderHub();
    },
  });
  log(cfg.intro);
  renderBattle();
}

function loadEnemy(i) {
  battle.idx = i;
  battle.enemyId = battle.roster[i];
  const avg = Math.round(S.trainer.party.reduce((s, id) => s + buddyLevel(id), 0) / S.trainer.party.length);
  const bump = battle.mode === 'rival' ? battle.rival.levelBump : randInt(-1, 0);
  battle.enemyLv = clamp(avg + bump, battle.mode === 'rival' ? 3 : 1, BUDDY_MAX_LEVEL);
  battle.enemyMax = hpAt(battle.enemyId, battle.enemyLv);
  battle.enemyHp = battle.enemyMax;
  S.trainer.seen[battle.enemyId] = true;
}

export function startWild(biome) {
  if (battle) return;
  const id = pick(WILD_TABLES[biome] || WILD_TABLES['research-garden']);
  startBattle({ mode: 'wild', biome, roster: [id], intro: `A wild ${SPECIES[id].name} jumped out of the ${biome.replace(/-/g, ' ')}!` });
}

export function startRival(key) {
  const r = RIVALS[key];
  if (!r || battle) return;
  if (r.requires && !S.trainer.badges.includes(r.requires)) {
    toast(`Earn the ${BADGES[r.requires]} first.`, { icon: '🔒' });
    return;
  }
  startBattle({ mode: 'rival', rival: { levelBump: 0, ...r }, key, roster: r.roster.slice(), intro: r.intro });
}

function buildBattle(body) {
  body.innerHTML = `
    <div class="battle">
      <div class="battle__top">
        <span class="battle__chip" data-b="mode"></span>
        <span class="battle__roster" data-b="roster"></span>
      </div>
      <div class="battle__field">
        <div class="fighter fighter--enemy">
          <div class="fighter__card">
            <div class="fighter__name"><span data-b="ename"></span><span class="fighter__lv" data-b="elv"></span></div>
            <div class="fighter__type" data-b="etype"></div>
            <div class="fighter__hp"><span data-b="ehp"></span></div>
            <div class="fighter__hptext" data-b="ehptext"></div>
          </div>
          <div class="fighter__sprite" data-b="esprite"></div>
        </div>
        <div class="fighter fighter--ally">
          <div class="fighter__sprite" data-b="asprite"></div>
          <div class="fighter__card">
            <div class="fighter__name"><span data-b="aname"></span><span class="fighter__lv" data-b="alv"></span></div>
            <div class="fighter__type" data-b="atype"></div>
            <div class="fighter__hp"><span data-b="ahp"></span></div>
            <div class="fighter__hptext" data-b="ahptext"></div>
          </div>
        </div>
      </div>
      <p class="battle__log" data-b="log" aria-live="polite"></p>
      <div class="battle__cmds">
        <button type="button" class="cmd cmd--move" data-cmd="m0"></button>
        <button type="button" class="cmd cmd--move" data-cmd="m1"></button>
        <button type="button" class="cmd" data-cmd="cap"></button>
        <button type="button" class="cmd" data-cmd="pot"></button>
        <button type="button" class="cmd" data-cmd="swap"><kbd>S</kbd> Swap buddy</button>
        <button type="button" class="cmd cmd--flee" data-cmd="flee"><kbd>F</kbd> Run</button>
      </div>
    </div>`;
  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cmd]');
    if (b && !b.disabled) command(b.dataset.cmd);
  });
}

const q = (k) => battle?.modal?.body.querySelector(`[data-b="${k}"]`);

function log(text) {
  const el = q('log');
  if (el) el.textContent = text;
}

function renderBattle() {
  if (!battle?.modal) return;
  const b = battle;
  const e = SPECIES[b.enemyId];
  const aId = b.allyId;
  const a = SPECIES[aId];
  const as = allyState(aId);
  const alv = buddyLevel(aId);
  q('mode').textContent = b.mode === 'rival' ? `RIVAL DUEL · ${b.idx + 1}/${b.roster.length}` : (b.biome || 'tall grass').replace(/-/g, ' ').toUpperCase();
  q('roster').innerHTML = b.roster.map((_, i) => `<i class="${i < b.idx ? 'is-down' : i === b.idx ? 'is-on' : ''}"></i>`).join('');
  q('ename').textContent = e.name;
  q('elv').textContent = `Lv.${b.enemyLv}`;
  q('etype').replaceChildren(typeChip(e.type));
  q('ehp').style.transform = `scaleX(${Math.max(0, b.enemyHp / b.enemyMax)})`;
  q('ehptext').textContent = `${Math.max(0, b.enemyHp)} / ${b.enemyMax}`;
  applySprite(q('esprite'), b.enemyId, 5);
  q('aname').textContent = a.name;
  q('alv').textContent = `Lv.${alv}`;
  q('atype').replaceChildren(typeChip(a.type));
  q('ahp').style.transform = `scaleX(${Math.max(0, as.hp / as.max)})`;
  q('ahptext').textContent = `${Math.max(0, as.hp)} / ${as.max}`;
  applySprite(q('asprite'), aId, 5);

  const body = battle.modal.body;
  a.moves.forEach((m, i) => {
    const btn = body.querySelector(`[data-cmd="m${i}"]`);
    const mult = typeMult(a.type, e.type);
    btn.innerHTML = `<kbd>${i + 1}</kbd> ${esc(m.name)} <small>PP ${as.pp[i]}/10${mult > 1 ? ' · <b class="good">super effective</b>' : mult < 1 ? ' · weak' : ''}</small>`;
    btn.disabled = b.busy || b.over || as.pp[i] <= 0;
  });
  const cap = body.querySelector('[data-cmd="cap"]');
  if (b.mode === 'rival') {
    cap.innerHTML = '<kbd>C</kbd> Capsule <small>not in duels</small>';
    cap.disabled = true;
  } else {
    cap.innerHTML = `<kbd>C</kbd> Capsule ×${S.trainer.bag.capsules} <small>${Math.round(captureChance() * 100)}% catch</small>`;
    cap.disabled = b.busy || b.over || S.trainer.bag.capsules <= 0;
  }
  const pot = body.querySelector('[data-cmd="pot"]');
  pot.innerHTML = `<kbd>P</kbd> Potion ×${S.trainer.bag.potions} <small>+30 HP</small>`;
  pot.disabled = b.busy || b.over || S.trainer.bag.potions <= 0 || as.hp >= as.max;
  const swap = body.querySelector('[data-cmd="swap"]');
  swap.disabled = b.busy || b.over || nextAlly() == null;
  body.querySelector('[data-cmd="flee"]').disabled = b.busy || b.over;
}

function captureChance() {
  const e = SPECIES[battle.enemyId];
  const hpFactor = 1 - battle.enemyHp / battle.enemyMax;
  return Math.min(0.92, e.captureRate + hpFactor * 0.55);
}

function nextAlly() {
  const party = S.trainer.party;
  const i = party.indexOf(battle.allyId);
  for (let k = 1; k < party.length; k++) {
    const id = party[(i + k) % party.length];
    if (allyState(id).hp > 0) return id;
  }
  return null;
}

function battleKey(e) {
  if (!battle) return false;
  const k = e.key.toLowerCase();
  const map = { 1: 'm0', 2: 'm1', c: 'cap', p: 'pot', s: 'swap', f: 'flee', escape: 'flee' };
  if (!map[k]) return false;
  e.preventDefault();
  const btn = battle.modal.body.querySelector(`[data-cmd="${map[k]}"]`);
  if (btn && !btn.disabled) command(map[k]);
  return true;
}

function command(cmd) {
  const b = battle;
  if (!b || b.busy || b.over) return;
  if (cmd === 'm0' || cmd === 'm1') allyMove(Number(cmd[1]));
  else if (cmd === 'cap') throwCapsule();
  else if (cmd === 'pot') usePotion();
  else if (cmd === 'swap') swapAlly();
  else if (cmd === 'flee') {
    b.over = true;
    renderBattle();
    log('You slipped away safely.');
    setTimeout(endBattle, 700);
  }
}

function shakeSprite(which) {
  const el = q(which === 'enemy' ? 'esprite' : 'asprite');
  el?.classList.remove('is-hit');
  void el?.offsetWidth;
  el?.classList.add('is-hit');
}

function allyMove(i) {
  const b = battle;
  const a = SPECIES[b.allyId];
  const as = allyState(b.allyId);
  const m = a.moves[i];
  if (as.pp[i] <= 0) return;
  b.busy = true;
  as.pp[i]--;
  const mult = typeMult(a.type, SPECIES[b.enemyId].type);
  const dmg = Math.round((m.power + randInt(0, 6)) * mult * levelFactor(buddyLevel(b.allyId)));
  b.enemyHp = Math.max(0, b.enemyHp - dmg);
  if (m.heal) as.hp = Math.min(as.max, as.hp + m.heal);
  shakeSprite('enemy');
  sfx('hit');
  log(`${m.text} ${dmg} damage.${mult > 1 ? ' It was super effective!' : mult < 1 ? ' It was resisted.' : ''}`);
  renderBattle();
  if (b.enemyHp <= 0) {
    setTimeout(enemyFainted, 750);
    return;
  }
  setTimeout(enemyTurn, 800);
}

function enemyTurn() {
  const b = battle;
  if (!b || b.over) return;
  const e = SPECIES[b.enemyId];
  const a = SPECIES[b.allyId];
  const as = allyState(b.allyId);
  const m = pick(e.moves);
  const mult = typeMult(e.type, a.type);
  const ease = b.mode === 'wild' ? 0.85 : (b.rival.dmgScale ?? 1);
  const dmg = Math.round((m.power + randInt(0, 7)) * mult * levelFactor(b.enemyLv) * ease);
  as.hp = Math.max(0, as.hp - dmg);
  if (m.heal) b.enemyHp = Math.min(b.enemyMax, b.enemyHp + m.heal);
  shakeSprite('ally');
  sfx('hurt');
  log(`${m.text} ${a.name} took ${dmg}.${mult > 1 ? ' Super effective!' : mult < 1 ? ' Resisted.' : ''}`);
  if (as.hp <= 0) {
    const next = nextAlly();
    if (next) {
      setTimeout(() => {
        if (!battle) return;
        battle.allyId = next;
        log(`${a.name} fainted! Go, ${SPECIES[next].name}!`);
        b.busy = false;
        renderBattle();
      }, 800);
    } else {
      b.over = true;
      setTimeout(() => {
        if (!battle) return;
        log('Your whole party fainted… you retreat to catch your breath.');
        player.hp = Math.max(1, player.hp - 15);
        renderBattle();
        setTimeout(endBattle, 1300);
      }, 800);
    }
    renderBattle();
    return;
  }
  b.busy = false;
  renderBattle();
}

function enemyFainted() {
  const b = battle;
  if (!b) return;
  grantBuddyXp(b.allyId, b.mode === 'rival' ? 45 : 35);
  if (b.idx < b.roster.length - 1) {
    // A knockout rallies your buddy a little, so a small party can still take a full roster.
    const as = allyState(b.allyId);
    const rally = Math.round(as.max * 0.25);
    as.hp = Math.min(as.max, as.hp + rally);
    loadEnemy(b.idx + 1);
    log(`${SPECIES[b.allyId].name} rallies (+${rally} HP)! ${b.rival.name} sent out ${SPECIES[b.enemyId].name}!`);
    b.busy = false;
    renderBattle();
    return;
  }
  b.over = true;
  if (b.mode === 'rival') {
    const r = b.rival;
    reward({ gold: r.reward.gold, xp: r.reward.xp });
    S.trainer.bag.capsules += r.reward.capsules || 0;
    S.trainer.bag.potions += r.reward.potions || 0;
    const firstWin = !S.trainer.wins[b.key];
    S.trainer.wins[b.key] = true;
    if (!S.trainer.badges.includes(r.badge)) S.trainer.badges.push(r.badge);
    save();
    sfx('victory');
    log(`${r.name} was defeated! +${r.reward.gold} gold${firstWin ? ` and the ${BADGES[r.badge]}` : ''}.`);
    if (firstWin) emit('badge', r.badge);
  } else {
    reward({ gold: 60, xp: 20 });
    sfx('coin');
    log(`The wild ${SPECIES[b.enemyId].name} fainted. +60 gold.`);
  }
  renderBattle();
  setTimeout(endBattle, 1500);
}

function throwCapsule() {
  const b = battle;
  if (b.mode === 'rival' || S.trainer.bag.capsules <= 0) return;
  b.busy = true;
  S.trainer.bag.capsules--;
  save();
  const chance = captureChance();
  const e = SPECIES[b.enemyId];
  log('You threw a capture capsule…');
  q('esprite')?.classList.add('is-capturing');
  renderBattle();
  setTimeout(() => {
    if (!battle) return;
    q('esprite')?.classList.remove('is-capturing');
    if (Math.random() < chance) {
      b.over = true;
      const fresh = !S.trainer.captured[b.enemyId];
      capture(b.enemyId);
      reward({ gold: 100, xp: 35 });
      grantBuddyXp(b.allyId, 25);
      sfx('achievement');
      log(`Gotcha! ${e.name} joined your party${fresh ? '' : ' (again)'}!`);
      renderBattle();
      setTimeout(endBattle, 1500);
    } else {
      log(`${e.name} broke free!`);
      setTimeout(enemyTurn, 650);
    }
  }, 1000);
}

function usePotion() {
  const b = battle;
  const a = SPECIES[b.allyId];
  const as = allyState(b.allyId);
  if (S.trainer.bag.potions <= 0 || as.hp >= as.max) return;
  b.busy = true;
  S.trainer.bag.potions--;
  save();
  as.hp = Math.min(as.max, as.hp + 30);
  sfx('heal');
  log(`${a.name} recovered 30 HP.`);
  renderBattle();
  setTimeout(enemyTurn, 700);
}

function swapAlly() {
  const b = battle;
  const next = nextAlly();
  if (!next) return;
  b.busy = true;
  b.allyId = next;
  log(`${SPECIES[next].name}, I choose you!`);
  renderBattle();
  setTimeout(enemyTurn, 700);
}

function endBattle() {
  if (!battle) return;
  closeModal('battle');
}

export const inBattle = () => !!battle;
export { typeChip, spriteNode };
