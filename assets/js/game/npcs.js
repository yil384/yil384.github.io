// NPCs: walk up and press F (or click them) to talk. Dialogs are modals, so the world pauses
// while you read — nothing can hit you mid-conversation. Mini-games and the shop open from here.
import { S, save } from './state.js';
import { clock } from './clock.js';
import { emit } from './bus.js';
import { spawnsOf, onMeasure, view } from './world.js';
import { player, heal, restoreMp, reward, spendGold } from './player.js';
import { openModal, closeModal, isModalOpen } from './modal.js';
import { capture, setActive } from './monsters.js';
import { applySprite } from './sprites.js';
import { toast } from './notify.js';
import { h, dist } from './util.js';
import { sfx } from './audio.js';
import * as games from './minigames.js';

const NPCS = {
  pikachu: {
    name: 'Pikachu',
    talk: () => ({
      text: "Pika pika! Python at 'High'… that's super effective! Want to race me in a coding sprint?",
      choices: [
        { label: '⌨️  Coding sprint', action: games.openTyping },
        { label: 'Any battle tips?', next: once('pikachu', {
          text: 'Match your buddy to the enemy! Electric zaps bats, Fire melts slimes and ice, Dragon scares the Dragon King. Press G for your buddy\'s signature move. Here — take some gold!',
          gift: { gold: 50 },
        }, "Electric beats Flying, Fire beats Grass and Ice, Dragon beats Dragon. Swap buddies with T!") },
        { label: 'Bye!' },
      ],
    }),
  },
  charmander: {
    name: 'Charmander',
    talk: () => {
      if (S.trainer.captured.charmander) {
        return { text: 'Char char! I\'m already in your party. Fire beats Grass and Ice — take me to the Ice Cavern!', choices: [{ label: 'Let\'s go!' }] };
      }
      if (S.bosses.dragon.kills > 0) {
        return {
          text: 'Char!! You actually beat the Dragon King! From Tsinghua to UCSD to dragon slayer… Can I join your party?',
          choices: [
            { label: '🔥  Welcome aboard!', action: () => {
              capture('charmander');
              setActive('charmander', true);
              sfx('achievement');
              toast('Charmander joined your party and is now your active buddy!', { icon: '🔥', tone: 'gold' });
            } },
            { label: 'Maybe later' },
          ],
        };
      }
      return {
        text: 'Char… From Tsinghua to UCSD — evolution complete! A Dragon King sleeps in the lair near the bottom of this page. Beat it once and I\'ll follow you anywhere.',
        choices: [{ label: 'I\'ll be back.' }],
      };
    },
  },
  squirtle: {
    name: 'Squirtle',
    talk: () => ({
      text: 'Squirtle! These publications are a real splash! Want to smash some bricks?',
      choices: [
        { label: '🧱  Play Breakout', action: games.openBreakout },
        { label: 'Any advice?', next: once('squirtle', {
          text: 'The Shadow Mage fans out orbs — keep moving sideways! Here, a splash of water to keep you going.',
          gift: { gold: 60, heal: 40 },
        }, 'Keep your HP up before the Shadow Realm. Mario sells potions!') },
        { label: 'Bye!' },
      ],
    }),
  },
  mario: {
    name: 'Mario',
    talk: () => ({
      text: "It's-a me! So many quests completed… Mamma mia! Need supplies for the road?",
      choices: [
        { label: '🛒  Open shop', action: openShop },
        { label: 'Bye!' },
      ],
    }),
  },
  kirby: {
    name: 'Kirby',
    talk: () => ({
      text: 'Poyo~! These legendary items look delicious! Play memory match with me?',
      choices: [
        { label: '🧠  Memory match', action: games.openMemory },
        { label: 'Bye!' },
      ],
    }),
  },
  link: {
    name: 'Link',
    talk: () => ({
      text: 'These portals lead to the external profiles… but legends speak of a sealed door in the Profile Hall.',
      choices: [
        { label: '🐍  Play Snake', action: games.openSnake },
        { label: 'Tell me about the door', next: once('link', {
          text: 'Three runes — frost, shadow and ember — are held by the Ice Golem, the Shadow Mage and the Dragon King. Bring all three to the door at the very top of the Profile Hall. Take this for the road.',
          gift: { xp: 40 },
        }, 'Ice Golem, Shadow Mage, Dragon King. Three runes, one door, top of the Profile Hall.') },
        { label: 'Bye!' },
      ],
    }),
  },
};

/** A dialog branch that gives a gift only the first time. */
function once(npcId, first, repeat) {
  return () => {
    if (S.dialogRewards[npcId]) return { text: repeat, choices: [{ label: 'Thanks!' }] };
    S.dialogRewards[npcId] = true;
    save();
    const g = first.gift || {};
    reward({ gold: g.gold || 0, xp: g.xp || 0 });
    if (g.heal) heal(g.heal, true);
    const bits = [g.gold && `+${g.gold} gold`, g.xp && `+${g.xp} XP`, g.heal && `+${g.heal} HP`].filter(Boolean).join(', ');
    sfx('purchase');
    return { text: first.text, note: bits, choices: [{ label: 'Thanks!' }] };
  };
}

// ---------------------------------------------------------------- entities
export const npcs = [];

export function initNpcs() {
  const layer = document.getElementById('world');
  for (const sp of spawnsOf('npc')) {
    const id = sp.data.npc;
    const cfg = NPCS[id];
    if (!cfg) continue;
    const body = h('div', { class: 'npc__body' });
    applySprite(body, id, 3);
    const el = h('div', { class: 'ent npc', title: `Talk to ${cfg.name}` },
      h('div', { class: 'ent__shadow' }),
      h('div', { class: 'npc__mark', 'aria-hidden': 'true' }, '!'),
      h('div', { class: 'prompt npc__prompt' }, h('b', null, cfg.name), ' · ', h('kbd', null, 'F'), ' talk'),
      body,
    );
    const npc = { id, cfg, sp, el, near: false };
    el.addEventListener('click', () => {
      player.target = { x: npc.sp.x, y: npc.sp.y, reach: 48, onArrive: () => talk(npc) };
    });
    layer.append(el);
    npcs.push(npc);
  }
  onMeasure(syncNpcs);
  syncNpcs();
}

function syncNpcs() {
  for (const n of npcs) {
    n.el.hidden = !n.sp.active;
    n.el.style.transform = `translate3d(${n.sp.x}px, ${n.sp.y}px, 0)`;
    n.el.classList.toggle('is-met', S.npcsMet.includes(n.id));
    n.el.classList.toggle('has-news', hasNews(n.id));
    // Keep the speech prompt on screen for NPCs standing in the page gutters.
    n.el.classList.toggle('is-edge-l', n.sp.x < 110);
    n.el.classList.toggle('is-edge-r', n.sp.x > view.vw - 110);
  }
}

function hasNews(id) {
  if (id === 'charmander') return S.bosses.dragon.kills > 0 && !S.trainer.captured.charmander;
  return !S.npcsMet.includes(id);
}

export function updateNpcs() {
  for (const n of npcs) {
    if (!n.sp.active) continue;
    const near = dist(player.x, player.y, n.sp.x, n.sp.y) < 80;
    if (near !== n.near) {
      n.near = near;
      n.el.classList.toggle('is-near', near);
    }
    n.el.classList.toggle('is-left', player.x < n.sp.x);
  }
}

export function nearestNpc(range = 90) {
  let best = null;
  let bd = range;
  for (const n of npcs) {
    if (!n.sp.active) continue;
    const d = dist(player.x, player.y, n.sp.x, n.sp.y);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

// ---------------------------------------------------------------- dialog
let typer = 0;

export function talk(npc) {
  if (isModalOpen('dialog')) return;
  if (!S.npcsMet.includes(npc.id)) {
    S.npcsMet.push(npc.id);
    save();
    emit('npc:met', npc.id);
  }
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
      const portrait = h('div', { class: 'talk__portrait' });
      applySprite(portrait, npc.id, 4);
      b.append(h('div', { class: 'talk' },
        h('div', { class: 'talk__face' }, portrait),
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
    }, 24);
  }

  function finishTyping() {
    if (!state || !state.typing) return;
    clearInterval(typer);
    state.typing = false;
    textEl.textContent = state.node.text;
    choicesEl.replaceChildren(...state.node.choices.map((c, i) => h('button', {
      type: 'button', class: 'talk__choice', onclick: () => choose(i),
    }, h('kbd', null, String(i + 1)), c.label)));
    choicesEl.querySelector('button')?.focus({ preventScroll: true });
  }

  function choose(i) {
    const c = state.node.choices[i];
    if (!c) return;
    if (c.next) {
      show(typeof c.next === 'function' ? c.next() : c.next);
      return;
    }
    if (c.action) c.action(); // opens its own modal on top first, so the world stays paused
    closeModal('dialog');
    syncNpcs();
  }

  show(npc.cfg.talk());
}

// ---------------------------------------------------------------- shop
const SHOP = [
  { icon: '🧪', name: 'Health Potion', desc: 'Restore 60 HP', price: 40, buy: () => heal(60, true) },
  { icon: '🔷', name: 'Mana Crystal', desc: 'Restore 60 MP', price: 30, buy: () => restoreMp(60, true) },
  { icon: '💪', name: 'Power Boost', desc: 'Double attack damage for 30 s', price: 100, buy: () => { player.powerUntil = clock.t + 30000; } },
  { icon: '🛡️', name: 'Barrier', desc: 'Block the next 3 hits', price: 80, buy: () => { player.shield = Math.max(player.shield, 3); } },
  { icon: '🧿', name: 'Capture Capsules ×3', desc: 'For wild encounters in the grass', price: 90, buy: () => { S.trainer.bag.capsules += 3; } },
  { icon: '🍯', name: 'Buddy Potions ×2', desc: 'Heal your buddy mid-battle', price: 60, buy: () => { S.trainer.bag.potions += 2; } },
];

export function openShop() {
  const handle = openModal({
    id: 'shop',
    title: "Mario's Shop",
    className: 'shop-panel',
    body: (b) => render(b),
  });
  function render(b) {
    b.replaceChildren(
      h('p', { class: 'shop__gold' }, 'Your gold: ', h('b', null, `◆ ${Math.floor(S.player.gold).toLocaleString('en-US')}`)),
      h('div', { class: 'shop__list' }, ...SHOP.map((it) => h('div', { class: 'shop__item' },
        h('span', { class: 'shop__icon' }, it.icon),
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
        }, `◆ ${it.price}`),
      ))),
    );
  }
}
