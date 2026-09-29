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

export function openHelp({ onLeave }) {
  openModal({
    id: 'help',
    title: 'Controls & settings',
    className: 'wide-panel',
    body: (b) => {
      const row = (keys, text) => h('div', { class: 'keys__row' }, h('span', null, ...keys.map((k) => h('kbd', null, k))), h('span', null, text));
      b.append(
        h('div', { class: 'keys' },
          row(['W', 'A', 'S', 'D'], 'Move (arrow keys work too)'),
          row(['Right drag'], 'Look around · wheel to zoom'),
          row(['Space'], 'Attack everything in range'),
          row(['1', '2', '3', '4'], 'Fireball · Mend · Lightning · Meteor'),
          row(['G'], 'Companion signature move'),
          row(['T'], 'Swap companion'),
          row(['E'], 'Talk / interact (islanders, the door, the chest)'),
          row(['Esc'], 'Close menus, or leave the island'),
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
        h('p', { class: 'muted' }, stats.cause ? `Defeated by ${stats.cause}.` : 'You were defeated.'),
        h('dl', { class: 'stat-grid' },
          ...[['Level', S.player.level], ['Score', fmt(S.player.score)], ['Foes cleared', S.stats.kills], ['Bosses beaten', S.stats.bossKills], ['Tokens', `${S.tokens.length}/8`], ['Achievements', `${achievementCount()}/${ACHIEVEMENTS.length}`]]
            .map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, String(v)))),
        ),
        h('p', { class: 'muted small' }, `Respawning at the plaza costs 10% of your gold (${fmt(Math.floor(S.player.gold * 0.1))}). You keep everything else.`),
        h('div', { class: 'modal__actions' },
          h('button', { type: 'button', class: 'btn btn--primary modal__primary', onclick: () => { closeModal('gameover'); onRespawn(); } }, 'Respawn'),
        ),
      );
    },
  });
}
