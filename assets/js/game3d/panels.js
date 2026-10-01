// Menu panels opened from the HUD: achievements, inventory, party, help/settings, game over.
import { S, save, resetSave } from './state.js';
import { SLOTS } from './data.js';
import { gearStats, attackPower, attackRange, maxHp, maxMp } from './player.js';
import { ACHIEVEMENTS, achievementCount } from './progress.js';
import { partyList, dexList } from './monsters.js';
import { itemCard } from './loot.js';
import { openModal, closeModal } from './modal.js';
import { setSound, startMusic, stopMusic } from './audio.js';
import { h, fmt, icon } from './util.js';

export function openAchievements() {
  openModal({
    id: 'achievements',
    title: `Achievements · ${achievementCount()} / ${ACHIEVEMENTS.length}`,
    className: 'wide-panel',
    body: (b) => {
      b.append(h('div', { class: 'ach-grid' }, ...ACHIEVEMENTS.map((a) => {
        const on = !!S.achievements[a.id];
        return h('div', { class: `ach${on ? ' is-on' : ''}` },
          icon(on ? a.icon : 'lock', { size: 22, cls: 'ach__icon' }),
          h('b', null, a.name),
          h('small', null, a.desc),
        );
      })));
      b.append(h('h3', { class: 'modal__sub' }, 'Best runs'));
      const lb = S.leaderboard;
      b.append(lb.length
        ? h('ol', { class: 'runs' }, ...lb.map((e, i) => h('li', null, h('span', null, `#${i + 1}`), h('b', null, fmt(e.score)), h('span', null, `Lv.${e.level}`), h('small', null, e.date))))
        : h('p', { class: 'muted' }, 'No runs recorded yet. Defeat a boss or survive a game over to log one.'));
    },
  });
}

export function openInventory() {
  const g = gearStats();
  openModal({
    id: 'inventory',
    title: 'Inventory',
    className: 'wide-panel',
    body: (b) => {
      b.append(
        h('div', { class: 'gear-grid' }, ...SLOTS.map((slot) => itemCard(S.equipment[slot], slot))),
        h('dl', { class: 'stat-grid' },
          ...[
            ['Attack', attackPower()], ['Range', `${attackRange().toFixed(1)} m`], ['Spell bonus', `+${g.spell}`],
            ['Defense', g.def], ['MP regen', `+${(1.5 + g.regen).toFixed(1)}/s`], ['Max HP / MP', `${maxHp()} / ${maxMp()}`],
          ].map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, String(v)))),
        ),
        h('h3', { class: 'modal__sub' }, 'Bag'),
        h('div', { class: 'bag-row' },
          h('span', null, icon('potion-ball', { size: 16 }), ` ${S.trainer.bag.capsules} capsules`),
          h('span', null, icon('heart-bottle', { size: 16 }), ` ${S.trainer.bag.potions} companion potions`),
          h('span', null, icon('two-coins', { size: 16 }), ` ${fmt(S.player.gold)} gold`),
          h('span', null, icon('gems', { size: 16 }), ` ${S.tokens.length}/8 tokens`),
        ),
        h('h3', { class: 'modal__sub' }, 'Runes'),
        h('div', { class: 'bag-row' },
          ...[['ice', 'snowflake-2', 'Frost'], ['shadow', 'evil-moon', 'Shadow'], ['dragon', 'fire-ring', 'Ember']].map(([k, ic, l]) =>
            h('span', { class: S.runes[k] ? 'rune-on' : 'muted' }, icon(ic, { size: 16 }), ` ${l} ${S.runes[k] ? '✓' : '—'}`)),
        ),
        h('p', { class: 'muted small' }, 'Enemies drop gear (bosses always do). Better gear replaces your current piece; the rest can be salvaged for gold.'),
      );
    },
  });
}

export function openParty() {
  openModal({
    id: 'party',
    title: 'Party',
    className: 'wide-panel',
    body: (b) => {
      b.append(
        h('p', { class: 'muted small' }, 'Your active companion follows you and attacks nearby enemies on its own. Match its type to the enemy for super-effective hits. G uses its signature move, T swaps to the next one. Catch more in the tall grass.'),
        partyList(),
        h('h3', { class: 'modal__sub' }, 'Creatures'),
        dexList(),
      );
    },
  });
}

export function openHelp({ onLeave, touch = false }) {
  openModal({
    id: 'help',
    title: 'Controls & settings',
    className: 'wide-panel',
    body: (b) => {
      const row = (keys, text) => h('div', { class: 'keys__row' }, h('span', null, ...keys.map((k) => h('kbd', null, k))), h('span', null, text));
      b.append(
        touch ? h('div', { class: 'keys' },
          row(['Left thumb'], 'Move: put it down anywhere on the left half and push (all the way out to sprint)'),
          row(['Right side'], 'Drag to look around · pinch to zoom (all the way in: first person) · tap a name plate to talk'),
          row(['⚔'], 'Attack · keep tapping for the 3-hit combo'),
          row(['⤒'], 'Jump (hold for higher; hold while falling to glide once you have the glider; climb while flying)'),
          row(['E'], 'Talk / use. It lights up when someone or something is in reach'),
          row(['Spell'], 'Tap to cast · hold to pick Fireball, Mend, Lightning, Meteor or your buddy’s move'),
          row(['Dodge'], 'Roll, invulnerable for a moment'),
          row(['o/'], 'Emotes: wave, dance, think, bow (islanders and the crowd react)'),
          row(['Top row'], 'Map · vehicle (flying sword → exosuit → car → on foot) · first / third person · menu'),
        ) : h('div', { class: 'keys' },
          row(['W', 'A', 'S', 'D'], 'Move where the camera looks (arrow keys work too)'),
          row(['Click'], 'Mouse look (pointer lock; Esc releases it) · or right-drag'),
          row(['Wheel'], 'Zoom · all the way in for first person'),
          row(['C', 'F5'], 'First / third person'),
          row(['Space'], 'Jump (hold for higher; hold while falling to glide once you have the glider)'),
          row(['Shift'], 'Sprint'),
          row(['K'], 'Dodge roll (or double-tap a direction), invulnerable for a moment'),
          row(['X'], 'Emotes: then 1 wave · 2 dance · 3 think · 4 bow (islanders and the crowd react)'),
          row(['J', 'Click'], 'Attack · press again for the 3-hit combo'),
          row(['1', '2', '3', '4'], 'Fireball · Mend · Lightning · Meteor'),
          row(['G'], 'Companion signature move · T swaps companion'),
          row(['E'], 'Talk / use (islanders, doors, signs, the boat)'),
          row(['V'], 'Vehicle: flying sword → exosuit → car → on foot'),
          row(['Space', 'Shift'], 'Flying: climb / descend · F boost · J fires the exosuit cannon'),
          row(['W', 'S', 'Space'], 'Car: drive / reverse / drift · Shift boost · H honk'),
          row(['M'], 'World map (travel to any place you have discovered)'),
          row(['L'], 'Quest log and the Road to Dr. trophy board'),
          row(['Esc'], 'Close menus, or go back to the page'),
        ),
        h('p', { class: 'muted small' }, 'Dialogs, shops, battles and mini-games pause the world completely: nothing can hit you while a window is open.'),
        h('div', { class: 'settings' },
          toggle('Sound effects', S.settings.sound, (v) => setSound(v)),
          toggle('Music', S.settings.music, (v) => { S.settings.music = v; save(); if (v) startMusic(); else stopMusic(); }),
        ),
        h('div', { class: 'modal__actions' },
          h('button', { type: 'button', class: 'btn', onclick: () => { closeModal('help'); onLeave(); } }, 'Back to the page'),
          h('button', {
            type: 'button', class: 'btn btn--danger',
            onclick: (e) => {
              const btn = e.currentTarget;
              if (btn.dataset.armed) { resetSave(); location.reload(); return; }
              btn.dataset.armed = '1';
              btn.textContent = 'Click again to wipe progress';
            },
          }, 'Reset progress'),
        ),
      );
    },
  });
}

function toggle(label, value, onChange) {
  const input = h('input', { type: 'checkbox', checked: value });
  input.addEventListener('change', () => onChange(input.checked));
  return h('label', { class: 'switch' }, input, h('span', { class: 'switch__ui', 'aria-hidden': 'true' }), label);
}

/** Phones: everything the keyboard reaches directly, in one sheet (plus the way back to the page). */
export function openMenu(a) {
  const go = (fn) => () => { closeModal('menu'); fn(); };
  const item = (ic, label, fn, sub = '') => h('button', { type: 'button', class: 'gmenu__item', onclick: go(fn) }, icon(ic, { size: 22 }), h('span', null, h('b', null, label), sub ? h('small', null, sub) : null));
  openModal({
    id: 'menu',
    title: 'Menu',
    className: 'menu-panel',
    body: (b) => {
      const spells = h('div', { class: 'gmenu__spells', role: 'group', 'aria-label': 'Spell button' },
        ...Object.entries(a.spells).map(([id, s]) => {
          const btn = h('button', { type: 'button', class: `gmenu__spell${id === a.spell ? ' is-on' : ''}`, 'aria-pressed': String(id === a.spell) }, icon(s.icon, { size: 20 }), h('small', null, s.name), h('i', null, `${s.mp} MP`));
          btn.addEventListener('click', () => {
            a.onSpell(id);
            for (const x of spells.children) { const on = x === btn; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on)); }
          });
          return btn;
        }));
      b.append(
        h('div', { class: 'gmenu' },
          item('tied-scroll', 'Quest log', a.questlog, 'Road to Dr.'),
          item('treasure-map', 'World map', a.map, 'travel'),
          item('backpack', 'Inventory', a.inventory, 'gear, bag'),
          item('paw-print', 'Party', a.party, 'companions'),
          item('body-swapping', 'Swap buddy', a.swap),
          item('trophy', 'Achievements', a.achievements),
          item('circle-help', 'Controls & settings', a.help, 'sound, music'),
          h('button', { type: 'button', class: 'gmenu__item gmenu__item--leave', onclick: go(a.leave) }, icon('x', { size: 22 }), h('span', null, h('b', null, 'Back to the page'), h('small', null, 'the CV'))),
        ),
        h('p', { class: 'modal__sub' }, 'Spell button'),
        spells,
      );
    },
  });
}

export function openGameOver({ onRespawn, stats }) {
  openModal({
    id: 'gameover',
    title: '',
    variant: 'center',
    className: 'gameover-panel',
    dismissible: false,
    label: 'Game over',
    body: (b) => {
      b.append(
        h('p', { class: 'gameover__title' }, 'Game over'),
        h('p', { class: 'muted' }, stats.cause ? `Defeated by ${stats.cause}${stats.where ? ` at ${stats.where}` : ''}.` : 'You were defeated.'),
        h('dl', { class: 'stat-grid' },
          ...[['Level', S.player.level], ['Score', fmt(S.player.score)], ['Foes cleared', S.stats.kills], ['Bosses beaten', S.stats.bossKills], ['Tokens', `${S.tokens.length}/8`], ['Achievements', `${achievementCount()}/${ACHIEVEMENTS.length}`]]
            .map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, String(v)))),
        ),
        h('p', { class: 'muted small' }, 'You get back up at this place’s portal. You keep everything.'),
        h('div', { class: 'modal__actions' },
          h('button', { type: 'button', class: 'btn btn--primary modal__primary', onclick: () => { closeModal('gameover'); onRespawn(); } }, 'Respawn'),
        ),
      );
    },
  });
}
