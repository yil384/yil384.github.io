// "Road to Dr.": the main quest, and the quest registry every region uses.
// Collect the Tsinghua Diploma, five internship Badges, four project Relics and two paper Seals; each
// is earned by finishing that region's boss or puzzle (regions call award(id)). With all twelve the
// Geisel "Defense" opens (the finale package listens for 'road:complete').
// Side quests: registerQuest({ id, title, region, steps: [{ id, text, done: () => bool }], reward }).
// The HUD tracker shows the Road and the quests of the region you stand in; L opens the Quest log
// with the trophy board.
import { S, save } from './state.js';
import { emit } from './bus.js';
import { reward as giveReward } from './player.js';
import { openModal } from './modal.js';
import { banner, toast } from './notify.js';
import { sfx } from './audio.js';
import { h, icon } from './util.js';
import { where } from './where.js';

export const ROAD = [
  { id: 'diploma', kind: 'Diploma', name: 'Tsinghua Diploma', region: 'tsinghua', icon: 'graduation-cap', note: 'B.S. Computer Science & Technology, 2021–2025' },
  { id: 'badge-picasso', kind: 'Badge', name: 'Picasso Lab Badge', region: 'picasso', icon: 'ribbon-medal', note: 'Research intern, UCSD CSE' },
  { id: 'badge-metabit', kind: 'Badge', name: 'Metabit Badge', region: 'metabit', icon: 'ribbon-medal', note: 'Quant developer intern' },
  { id: 'badge-timi', kind: 'Badge', name: 'TiMi Studio Badge', region: 'timi', icon: 'ribbon-medal', note: 'Game dev intern, Tencent' },
  { id: 'badge-hotstar', kind: 'Badge', name: 'Disney+ Hotstar Badge', region: 'hotstar', icon: 'ribbon-medal', note: 'Algorithm intern' },
  { id: 'badge-lark', kind: 'Badge', name: 'Lark Badge', region: 'lark', icon: 'ribbon-medal', note: 'Backend intern, ByteDance' },
  { id: 'relic-starry', kind: 'Relic', name: 'Starry-Next Relic', region: 'starry', icon: 'gem-pendant', note: 'A network stack for a monolithic kernel' },
  { id: 'relic-im', kind: 'Relic', name: 'IM System Relic', region: 'im', icon: 'gem-pendant', note: 'Real-time chat over WebSocket' },
  { id: 'relic-oj', kind: 'Relic', name: 'CST-OJ Relic', region: 'oj', icon: 'gem-pendant', note: 'An online judge in Rust' },
  { id: 'relic-triton', kind: 'Relic', name: 'TritonGym Relic', region: 'triton', icon: 'gem-pendant', note: 'The benchmark harness' },
  { id: 'seal-tritongym', kind: 'Seal', name: 'TritonGym Seal · Under review', region: 'stacks', icon: 'tied-scroll', note: 'Under review, ICML 2026' },
  { id: 'seal-reh2o', kind: 'Seal', name: '(Re)²H₂O Seal · Published', region: 'stacks', icon: 'tied-scroll', note: 'IEEE IV 2023' },
];
const byId = Object.fromEntries(ROAD.map((r) => [r.id, r]));

export const hasItem = (id) => !!S.world.road[id];
export const roadCount = () => ROAD.filter((r) => S.world.road[r.id]).length;
export const roadComplete = () => roadCount() === ROAD.length;

/** Give a Road to Dr. item (idempotent). Returns true the first time. */
export function award(id) {
  const it = byId[id];
  if (!it) { console.warn('[road] unknown item', id); return false; }
  if (S.world.road[id]) return false;
  S.world.road[id] = Date.now();
  save();
  sfx('achievement');
  banner(`${it.kind} obtained: ${it.name}`, `Road to Dr. · ${roadCount()} / ${ROAD.length}`, it.icon);
  emit('road:item', { id, item: it, count: roadCount() });
  if (roadComplete()) setTimeout(() => { banner('The committee is ready', 'All twelve collected. The Defense awaits in Geisel.', 'graduation-cap'); emit('road:complete'); }, 3600);
  return true;
}

// ---------------------------------------------------------------- side quests
export const QUESTS = [];
/**
 * registerQuest({ id, title, region, steps: [{ id, text, done: () => bool }], reward: { gold, xp, item }, hidden })
 * Steps are polled (twice a second while playing); when all are done the reward is given once.
 * Re-registering an id replaces it (safe on region rebuild).
 */
export function registerQuest(def) {
  if (!def?.id || !Array.isArray(def.steps)) throw new Error('registerQuest: id and steps are required');
  const i = QUESTS.findIndex((q) => q.id === def.id);
  const q = { region: where.id, reward: {}, ...def };
  if (i >= 0) QUESTS[i] = q; else QUESTS.push(q);
  return q;
}
const stepDone = (s) => { try { return !!s.done(); } catch { return false; } };
export const questDone = (q) => S.world.quests[q.id] === 'done';

/** Poll quests; hand out rewards for newly finished ones. */
export function checkQuests() {
  for (const q of QUESTS) {
    if (questDone(q)) continue;
    if (!q.steps.every(stepDone)) continue;
    S.world.quests[q.id] = 'done';
    const r = q.reward || {};
    giveReward({ gold: r.gold || 0, xp: r.xp || 0 });
    if (r.item) award(r.item);
    save();
    sfx('victory');
    toast(`Quest complete: ${q.title}${r.gold ? ` · +${r.gold} gold` : ''}${r.xp ? ` · +${r.xp} XP` : ''}`, { icon: 'trophy', tone: 'gold' });
    emit('quest:done', q.id);
  }
}

/** Tracker lines for the HUD: the Road, then the open quests of the current region (next step each). */
export function trackerLines() {
  const lines = [{ id: 'road', icon: 'graduation-cap', label: 'Road to Dr.', detail: `${roadCount()} / ${ROAD.length} · diploma, badges, relics, seals`, hot: roadComplete() }];
  for (const q of QUESTS) {
    if (q.hidden || questDone(q) || q.region !== where.id) continue;
    const next = q.steps.find((s) => !stepDone(s));
    lines.push({ id: q.id, icon: 'tied-scroll', label: q.title, detail: next ? next.text : 'Done' });
  }
  return lines;
}

// ---------------------------------------------------------------- quest log + trophy board
export function openQuestLog() {
  openModal({
    id: 'questlog', title: `Quest log · Road to Dr. ${roadCount()} / ${ROAD.length}`, className: 'wide-panel',
    body: (b) => {
      b.append(
        h('p', { class: 'muted small' }, 'Finish each place’s boss or puzzle to earn its item. All twelve open the Defense in Geisel.'),
        h('div', { class: 'trophies' }, ...ROAD.map((r) => {
          const got = hasItem(r.id);
          return h('div', { class: `trophy${got ? ' is-on' : ''}`, title: got ? r.note : `Found in ${r.region}` },
            icon(got ? r.icon : 'lock', { size: 22 }),
            h('b', null, r.kind),
            h('small', null, got ? r.name : '? ? ?'));
        })),
      );
      const list = QUESTS.filter((q) => !q.hidden);
      b.append(h('h3', { class: 'modal__sub' }, 'Side quests'));
      b.append(list.length ? h('div', { class: 'qlog' }, ...list.map((q) => h('div', { class: `qlog__q${questDone(q) ? ' is-done' : ''}` },
        h('b', null, q.title, h('small', null, ` · ${q.region}`)),
        h('ul', null, ...q.steps.map((s) => h('li', { class: stepDone(s) || questDone(q) ? 'is-done' : '' }, s.text))),
      ))) : h('p', { class: 'muted' }, 'No quests yet. Doors on the island lead to the places in Yichen’s CV; each has one.'));
    },
  });
}
