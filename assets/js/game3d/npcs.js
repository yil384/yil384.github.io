// The islanders. Walk up and press E (or click them) to talk. Dialogs are modals, so the world
// pauses while you read: nothing can hit you mid-conversation. Mini-games, the shop, rival duels
// and fast travel all open from here.
import { S, save } from './state.js';
import { clock } from './clock.js';
import { emit, on } from './bus.js';
import { ZONES } from './world.js';
import { player, heal, restoreMp, reward, spendGold } from './player.js';
import { openModal, closeModal, isModalOpen } from './modal.js';
import { capture, setActive, startRival, evolveActive, restock, restoreAtStation, travelList, canEvolve, activeId, mountList } from './monsters.js';
import { spriteImg } from './pixelart.js';
import { makeActor } from './actors.js';
import { toast } from './notify.js';
import { h, icon } from './util.js';
import { sfx } from './audio.js';
import * as fx from './fx.js';
import * as games from './minigames.js';
import { SPECIES } from './data.js';
import { openDossier } from './dossier.js';
import { found } from '../site/eggs.js';
import { isLive } from './where.js';

// id -> where they stand (zone + offset), sprite, name, and what they say.
const NPCS = {
  nell: {
    name: 'Archivist Nell', sprite: 'owl', zone: 'plaza', dx: -6, dz: 3, face: 0.6,
    talk: () => ({
      text: 'The library keeps every page anyone has ever forgotten. I keep the library. Want to test your memory, or your companion?',
      choices: [
        { label: 'What has Yichen published?', icon: 'scroll-text', action: () => openDossier('publications') },
        { label: 'Memory match', icon: 'book-open', action: games.openMemory },
        { label: 'Duel for the Library Badge', icon: 'ribbon-medal', action: () => startRival('nell') },
        { label: 'How do companions work?', next: once('nell', {
          text: 'Your active companion follows you and attacks on its own. Match its type to the enemy: Electric hits Flying, Fire melts Grass and Ice, Dragon scares Dragon. G is its signature move, T swaps to the next one. Take these for the road.',
          gift: { gold: 50 },
        }, 'Electric beats Flying, Fire beats Grass and Ice, Dragon beats Dragon. G for the signature move, T to swap.') },
        { label: 'Bye' },
      ],
    }),
  },
  unit7: {
    name: 'Unit-7', sprite: 'robot', zone: 'camp', dx: 0, dz: 0, face: 2.6,
    talk: () => {
      const id = activeId();
      const evo = canEvolve(id);
      return {
        text: evo
          ? `Field station online. ${SPECIES[id].name} has reached the threshold: I can run the evolution now.`
          : 'Field station online. I calibrate companions, restock bags, and rest trainers. Duel me when you hold the Library Badge.',
        choices: [
          { label: 'What has Yichen built?', icon: 'file-code-2', action: () => openDossier('projects') },
          evo ? { label: `Evolve ${SPECIES[id].name}`, icon: 'dna2', action: evolveActive } : null,
          { label: 'Rest (restore HP & MP)', icon: 'camping-tent', action: restoreAtStation },
          { label: 'Restock the bag', icon: 'backpack', action: restock },
          { label: 'Calibration sprint (typing)', icon: 'keyboard', action: games.openTyping },
          { label: 'Duel for the Forge Badge', icon: 'ribbon-medal', action: () => startRival('unit7') },
          { label: 'Bye' },
        ].filter(Boolean),
      };
    },
  },
  mo: {
    name: 'Mo', sprite: 'merchant', zone: 'plaza', dx: 6, dz: 3, face: -0.6,
    talk: () => ({
      text: 'Potions, crystals, capsules. Everything a trainer runs out of at the worst moment. Have a look?',
      choices: [
        { label: 'How do I reach Yichen?', icon: 'mail', action: () => openDossier('contact') },
        { label: 'Open the shop', icon: 'shop', action: openShop },
        { label: 'Bye' },
      ],
    }),
  },
  tide: {
    name: 'Tide', sprite: 'frog', zone: 'meadow', dx: -6, dz: 6, face: 1.2,
    talk: () => ({
      text: 'The pond is mine, the bricks are yours. Want to knock some down?',
      choices: [
        { label: 'Play breakout', icon: 'ball-glow', action: games.openBreakout },
        { label: 'Any advice?', next: once('tide', {
          text: 'Reviewer #2 in the eucalyptus grove fans its objections out sideways: step through the gaps, never backwards. Here, a drink to keep you going.',
          gift: { gold: 60, heal: 40 },
        }, 'Sidestep Reviewer #2\'s objections. Mo sells potions if the grove goes badly.') },
        { label: 'Bye' },
      ],
    }),
  },
  fern: {
    name: 'Fern', sprite: 'sprout', zone: 'meadow', dx: 4, dz: -5, face: 3.4,
    talk: () => {
      if (S.bosses.dragon.kills > 0 && !S.trainer.captured.tidefin) {
        return {
          text: 'You went up the peak and came back down. Tidefin has been hiding in my pond since the dragon woke; it would rather travel with you.',
          choices: [
            { label: 'Welcome Tidefin', icon: 'paw-print', action: () => { capture('tidefin'); setActive('tidefin', true); sfx('achievement'); toast('Tidefin joined your party.', { icon: 'paw-print', tone: 'gold' }); } },
            { label: 'Maybe later' },
          ],
        };
      }
      return {
        text: 'Things grow if you leave them alone. Snakes too. Want to play in the garden?',
        choices: [
          { label: 'Where did Yichen study?', icon: 'graduation-cap', action: () => openDossier('education') },
          { label: 'Play snake', icon: 'snail', action: games.openSnake },
          { label: 'Where do wild creatures live?', next: once('fern', {
            text: 'Walk through the tall grass around the meadow, the station, the grove and the peak. Throw a capsule when their HP is low. Keep this to start.',
            gift: { xp: 40 },
          }, 'Tall grass: meadow, station, grove, peak. Low HP, then a capsule.') },
          { label: 'Bye' },
        ],
      };
    },
  },
  zhuo: {
    name: 'Chef Zhuo', sprite: 'chef', zone: 'camp', dx: 3, dz: -3.5, face: 3.5,
    talk: () => ({
      text: "Order up. Today's special is green eggs and ham. Yichen says I am the best cook in the building; I have never corrected him.",
      choices: [
        { label: 'Try the green eggs and ham', icon: 'health-potion', action: eatSpecial },
        { label: 'Who are you?', next: () => ({ text: "Zhuo Chen. Tsinghua Yao Class alumnus, Yichen's labmate and roommate, and the reason nobody in the building orders takeout.", choices: [{ label: 'Impressive' }] }) },
        { label: 'Bye' },
      ],
    }),
  },
  ash: {
    name: 'Ash', sprite: 'cartographer', zone: 'plaza', dx: -3, dz: 8, face: 3.14,
    talk: () => ({
      text: 'I map the island. Some of it I can send you to directly, once you have earned the way in.',
      choices: [
        { label: 'Tell me about Yichen', icon: 'book-open', next: () => ({ text: 'Which chapter?', choices: [
          { label: 'About', icon: 'conversation', action: () => openDossier('about') },
          { label: 'Education', icon: 'graduation-cap', action: () => openDossier('education') },
          { label: 'Experience', icon: 'briefcase', action: () => openDossier('experience') },
        ] }) },
        { label: 'Fast travel', icon: 'magic-portal', action: openTravel },
        { label: 'Ride a companion', icon: 'horse-head', action: openMounts },
        { label: 'Tell me about the sealed door', next: once('ash', {
          text: 'Three runes: frost, shadow, ember. The CUDA OOM Golem, Reviewer #2 and the Deadline Dragon each keep one. Bring all three to the door on the north-west cliff and the chamber behind it opens.',
          gift: { xp: 40 },
        }, 'CUDA OOM Golem, Reviewer #2, Deadline Dragon. Three runes, one door, north-west cliff.') },
        { label: 'Bye' },
      ],
    }),
  },
};

function eatSpecial() {
  heal(200, true);
  restoreMp(200, true);
  sfx('heal');
  toast('Well fed: HP and MP restored. You do like them.', { icon: 'health-potion', tone: 'good' });
  found('chef');
}

/** A dialog branch that gives a gift only the first time. */
function once(npcId, first, repeat) {
  return () => {
    if (S.dialogRewards[npcId]) return { text: repeat, choices: [{ label: 'Thanks' }] };
    S.dialogRewards[npcId] = true;
    save();
    const g = first.gift || {};
    reward({ gold: g.gold || 0, xp: g.xp || 0 });
    if (g.heal) heal(g.heal, true);
    const bits = [g.gold && `+${g.gold} gold`, g.xp && `+${g.xp} XP`, g.heal && `+${g.heal} HP`].filter(Boolean).join(', ');
    sfx('purchase');
    return { text: first.text, note: bits, choices: [{ label: 'Thanks' }] };
  };
}

// ---------------------------------------------------------------- entities
export const npcs = [];
let world = null;

export function initNpcs(w, scene) {
  world = w;
  for (const [id, cfg] of Object.entries(NPCS)) {
    const zn = ZONES[cfg.zone];
    let x = zn.x + cfg.dx, z = zn.z + cfg.dz;
    for (let t = 0; t < 30 && (!world.walkable(x, z) || world.isBlocked(x, z)); t++) { x += (Math.random() - 0.5) * 2; z += (Math.random() - 0.5) * 2; }
    addNpc({ id, cfg, x, z, parent: scene, region: 'hub' });
  }
  on('boss:defeated', syncNpcs);
  on('capture', syncNpcs);
  syncNpcs();
}

/**
 * Add an islander. cfg = { name, sprite, face, talk: () => node, scale? }; world coordinates.
 * Region NPCs (regions.js spawnNpc) use this too, so E-to-talk, plates, bubbles and dialogs all work.
 */
export function addNpc({ id, cfg, x, z, parent, region = 'hub', mesh = null }) {
  const m = mesh || makeActor(cfg.sprite, { scale: cfg.scale || 0.2 });
  const y = world.surfaceY(x, z);
  m.position.set(x, y, z);
  m.rotation.y = cfg.face || 0;
  m.userData.pickId = `npc:${id}`;
  m.userData.pickLabel = cfg.name;
  parent.add(m);
  const npc = { id, cfg, x, y, z, mesh: m, near: false, anim: Math.random() * 6, h: m.userData.height || 3, region };
  npc.plate = h('div', { class: 'g__plate' },
    h('span', { class: 'g__plate-mark', 'aria-hidden': 'true' }, '!'),
    h('b', null, cfg.name),
    h('span', { class: 'g__plate-hint' }, h('kbd', null, 'E'), ' talk'),
  );
  npc.unpin = fx.pin(npc.plate, () => ({ x: npc.x, y: npc.y + npc.h + 0.9, z: npc.z }), { region, nearOnly: true });
  npcs.push(npc);
  syncNpcs();
  return npc;
}

function hasNews(id) {
  if (id === 'fern') return S.bosses.dragon.kills > 0 && !S.trainer.captured.tidefin;
  return !S.npcsMet.includes(id);
}
function syncNpcs() {
  for (const n of npcs) n.plate.classList.toggle('has-news', n.cfg.news ? !!n.cfg.news() : hasNews(n.id));
}

export function updateNpcs(dt) {
  for (const n of npcs) {
    if (!isLive(n.region)) continue;
    n.anim += dt * 2;
    n.mesh.position.y = n.y + Math.abs(Math.sin(n.anim)) * 0.08;
    const near = Math.hypot(player.x - n.x, player.z - n.z) < 4;
    if (near !== n.near) { n.near = near; n.plate.classList.toggle('is-near', near); }
    if (near) n.mesh.rotation.y = Math.atan2(player.x - n.x, player.z - n.z);
  }
}

export function nearestNpc(range = 4) {
  let best = null, bd = range;
  for (const n of npcs) {
    if (!isLive(n.region)) continue;
    const d = Math.hypot(player.x - n.x, player.z - n.z);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

export const npcMarkers = () => npcs.filter((n) => isLive(n.region)).map((n) => ({ x: n.x, z: n.z, news: n.cfg.news ? !!n.cfg.news() : hasNews(n.id) }));

// ---------------------------------------------------------------- dialog
let typer = 0;

let chaining = false;              // a choice's action is running: it may open the next dialog
export function talk(npc) {
  if (isModalOpen('dialog') && !chaining) return;
  if (npc.region === 'hub' && !S.npcsMet.includes(npc.id)) {
    S.npcsMet.push(npc.id);
    save();
    emit('npc:met', npc.id);
  } else if (npc.region !== 'hub') emit('npc:talk', { id: npc.id, region: npc.region });
  syncNpcs();
  sfx('open');
  let state = null;
  const handle = openModal({
    id: 'dialog',
    variant: 'dialog',
    label: `Conversation with ${npc.cfg.name}`,
    className: 'talk-panel',
    dismissible: true,
    body: (b) => {
      b.append(h('div', { class: 'talk' },
        h('div', { class: 'talk__face' }, spriteImg(npc.cfg.sprite, 5)),
        h('div', { class: 'talk__main' },
          h('div', { class: 'talk__name' }, npc.cfg.name),
          h('p', { class: 'talk__text', onclick: () => finishTyping() }),
          h('p', { class: 'talk__note' }),
          h('div', { class: 'talk__choices' }),
        ),
      ));
    },
    onKey: (e) => {
      if (!state) return false;
      if ((e.key === 'Enter' || e.key === ' ') && state.typing) { e.preventDefault(); finishTyping(); return true; }
      const n = Number(e.key);
      if (n >= 1 && n <= state.node.choices.length && !state.typing) { e.preventDefault(); choose(n - 1); return true; }
      return false;
    },
    onClose: () => clearInterval(typer),
  });

  const textEl = handle.body.querySelector('.talk__text');
  const noteEl = handle.body.querySelector('.talk__note');
  const choicesEl = handle.body.querySelector('.talk__choices');

  function show(node) {
    state = { node, typing: true, i: 0 };
    choicesEl.replaceChildren();
    noteEl.textContent = node.note || '';
    textEl.textContent = '';
    clearInterval(typer);
    typer = setInterval(() => {
      state.i += 2;
      textEl.textContent = node.text.slice(0, state.i);
      if (state.i >= node.text.length) finishTyping();
    }, 22);
  }
  function finishTyping() {
    if (!state || !state.typing) return;
    clearInterval(typer);
    state.typing = false;
    textEl.textContent = state.node.text;
    choicesEl.replaceChildren(...state.node.choices.map((c, i) => h('button', {
      type: 'button', class: 'talk__choice', onclick: () => choose(i),
    }, h('kbd', null, String(i + 1)), c.icon ? icon(c.icon, { size: 16 }) : null, c.label)));
    choicesEl.querySelector('button')?.focus({ preventScroll: true });
  }
  function choose(i) {
    const c = state.node.choices[i];
    if (!c) return;
    if (c.next) { show(typeof c.next === 'function' ? c.next() : c.next); return; }
    // the action opens its own modal first (so the world stays paused); if that is another dialog it
    // has already replaced this one, otherwise close this one now
    if (c.action) { chaining = true; try { c.action(); } finally { chaining = false; } }
    if (handle.isOpen()) handle.close();
    syncNpcs();
  }
  show(npc.cfg.talk());
}

// ---------------------------------------------------------------- shop
const SHOP = [
  { icon: 'health-potion', name: 'Health Potion', desc: 'Restore 60 HP', price: 40, buy: () => heal(60, true) },
  { icon: 'crystal-shine', name: 'Mana Crystal', desc: 'Restore 60 MP', price: 30, buy: () => restoreMp(60, true) },
  { icon: 'biceps', name: 'Power Boost', desc: 'Double attack damage for 30 s', price: 100, buy: () => { player.powerUntil = clock.t + 30000; } },
  { icon: 'magic-shield', name: 'Barrier', desc: 'Block the next 3 hits', price: 80, buy: () => { player.shield = Math.max(player.shield, 3); } },
  { icon: 'potion-ball', name: 'Capture Capsules ×3', desc: 'For wild encounters in the grass', price: 90, buy: () => { S.trainer.bag.capsules += 3; } },
  { icon: 'heart-bottle', name: 'Companion Potions ×2', desc: 'Heal your companion mid-battle', price: 60, buy: () => { S.trainer.bag.potions += 2; } },
];

export function openShop() {
  const handle = openModal({ id: 'shop', title: "Mo's shop", className: 'shop-panel', body: (b) => render(b) });
  function render(b) {
    b.replaceChildren(
      h('p', { class: 'shop__gold' }, icon('two-coins', { size: 16 }), ' ', h('b', null, Math.floor(S.player.gold).toLocaleString('en-US')), ' gold'),
      h('div', { class: 'shop__list' }, ...SHOP.map((it) => h('div', { class: 'shop__item' },
        icon(it.icon, { size: 28, cls: 'shop__icon' }),
        h('span', { class: 'shop__info' }, h('b', null, it.name), h('small', null, it.desc)),
        h('button', {
          type: 'button', class: 'btn btn--small', disabled: S.player.gold < it.price,
          onclick: () => {
            if (!spendGold(it.price)) { sfx('error'); return; }
            it.buy();
            S.stats.purchases++;
            save();
            sfx('purchase');
            toast(`Bought ${it.name}.`, { icon: it.icon, tone: 'good' });
            emit('purchase', it.name);
            render(handle.body);
          },
        }, `${it.price} g`),
      ))),
    );
  }
}

function openTravel() {
  openModal({
    id: 'travel', title: 'Fast travel', className: 'wide-panel',
    body: (b) => b.append(h('p', { class: 'muted small' }, 'Badges and runes open the far ends of the island.'), travelList()),
  });
}
function openMounts() {
  openModal({
    id: 'mounts', title: 'Mounts', className: 'wide-panel',
    body: (b) => b.append(h('p', { class: 'muted small' }, 'Riding a companion makes you faster and quieter in the grass.'), mountList()),
  });
}
