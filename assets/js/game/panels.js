// Menu panels opened from the HUD: achievements, inventory, party, help/settings, game over.
import { S, save, resetSave } from './state.js';
import { SLOTS } from './data.js';
import { gearStats, attackPower, attackRange, maxHp, maxMp } from './player.js';
import { ACHIEVEMENTS, achievementCount } from './progress.js';
import { partyList } from './monsters.js';
import { itemCard } from './loot.js';
import { openModal, closeModal } from './modal.js';
import { setSound, startMusic, stopMusic } from './audio.js';
import { h, fmt } from './util.js';

export function openAchievements() {
  openModal({
    id: 'achievements',
    title: `Achievements · ${achievementCount()} / ${ACHIEVEMENTS.length}`,
    className: 'wide-panel',
    body: (b) => {
      b.append(h('div', { class: 'ach-grid' }, ...ACHIEVEMENTS.map((a) => {
        const on = !!S.achievements[a.id];
        return h('div', { class: `ach${on ? ' is-on' : ''}` },
          h('span', { class: 'ach__icon' }, on ? a.icon : '🔒'),
          h('b', null, a.name),
          h('small', null, a.desc),
        );
      })));
      b.append(h('h3', { class: 'modal__sub' }, 'Best runs'));
      const lb = S.leaderboard;
      b.append(lb.length
        ? h('ol', { class: 'runs' }, ...lb.map((e, i) => h('li', null, h('span', null, `#${i + 1}`), h('b', null, fmt(e.score)), h('span', null, `Lv.${e.level}`), h('small', null, e.date))))
        : h('p', { class: 'muted' }, 'No runs recorded yet — defeat a boss or survive a game over to log one.'));
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
            ['Attack', attackPower()], ['Range', `${attackRange()}px`], ['Spell bonus', `+${g.spell}`],
            ['Defense', g.def], ['MP regen', `+${(1.5 + g.regen).toFixed(1)}/s`], ['Max HP / MP', `${maxHp()} / ${maxMp()}`],
          ].map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, String(v)))),
        ),
        h('h3', { class: 'modal__sub' }, 'Bag'),
        h('div', { class: 'bag-row' },
          h('span', null, `🧿 ${S.trainer.bag.capsules} capsules`),
          h('span', null, `🧪 ${S.trainer.bag.potions} buddy potions`),
          h('span', null, `◆ ${fmt(S.player.gold)} gold`),
          h('span', null, `🪙 ${S.tokens.length}/8 tokens`),
        ),
        h('h3', { class: 'modal__sub' }, 'Runes'),
        h('div', { class: 'bag-row' },
          ...[['ice', '❄ Frost'], ['shadow', '☾ Shadow'], ['dragon', '✹ Ember']].map(([k, l]) => h('span', { class: S.runes[k] ? 'rune-on' : 'muted' }, `${l} ${S.runes[k] ? '✓' : '—'}`)),
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
        h('p', { class: 'muted small' }, 'Your active buddy follows you across the page and attacks nearby enemies automatically. Match its type to the enemy for super-effective hits. G uses its signature move, T swaps to the next buddy. Catch more in the tall grass.'),
        partyList(),
      );
    },
  });
}

export function openHelp({ onReadMode }) {
  openModal({
    id: 'help',
    title: 'Controls & settings',
    className: 'wide-panel',
    body: (b) => {
      const row = (keys, text) => h('div', { class: 'keys__row' }, h('span', null, ...keys.map((k) => h('kbd', null, k))), h('span', null, text));
      b.append(
        h('div', { class: 'keys' },
          row(['←', '↑', '↓', '→'], 'Move (or click / right-click the page)'),
          row(['Space'], 'Attack everything in range'),
          row(['Q', 'W', 'E', 'R'], 'Fireball · Heal · Lightning · Meteor'),
          row(['G'], 'Buddy signature move'),
          row(['T'], 'Swap buddy'),
          row(['F'], 'Talk / interact (NPCs, rune door, chest)'),
          row(['Esc'], 'Close menus and dialogs'),
        ),
        h('p', { class: 'muted small' }, 'Enemies stay calm while you just read or scroll. They only fight back for a few seconds after you move, attack or cast. Dialogs, shops, battles and mini-games pause the world completely.'),
        h('div', { class: 'settings' },
          toggle('Sound effects', S.settings.sound, (v) => setSound(v)),
          toggle('Chiptune music', S.settings.music, (v) => { S.settings.music = v; save(); if (v) startMusic(); else stopMusic(); }),
        ),
        h('div', { class: 'modal__actions' },
          h('button', { type: 'button', class: 'btn', onclick: () => { closeModal('help'); onReadMode(); } }, '📖 Switch to reading mode'),
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
        h('p', { class: 'gameover__title' }, 'GAME OVER'),
        h('p', { class: 'muted' }, stats.cause ? `Defeated by ${stats.cause}.` : 'You were defeated.'),
        h('dl', { class: 'stat-grid' },
          ...[['Level', S.player.level], ['Score', fmt(S.player.score)], ['Foes cleared', S.stats.kills], ['Bosses beaten', S.stats.bossKills], ['Tokens', `${S.tokens.length}/8`], ['Achievements', `${achievementCount()}/${ACHIEVEMENTS.length}`]]
            .map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, String(v)))),
        ),
        h('p', { class: 'muted small' }, `Respawning costs 10% of your gold (${fmt(Math.floor(S.player.gold * 0.1))}). You keep everything else.`),
        h('div', { class: 'modal__actions' },
          h('button', { type: 'button', class: 'btn btn--primary modal__primary', onclick: () => { closeModal('gameover'); onRespawn(); } }, 'Respawn'),
        ),
      );
    },
  });
}
