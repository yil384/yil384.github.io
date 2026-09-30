// regions/sandbox.js: the developer sandbox. It exists to prove (and document by example) every call
// of the region API in regions.js. No hub door leads here; open it with ?region=sandbox, or
// __g.travel('sandbox') from the console. Copy this file to start a new region.
import {
  terrain, props, block, scatter, sprite, platform, registerEnemyKind, spawnEnemy, spawnBoss, spawnNpc,
  interactable, trigger, pickup, portal, quest, egg, say, banner, toast, sfx, setSky, onUpdate, onEnter,
  cinematic, ride, dismount, dialog, boxCells,
} from '../regions.js';

// An inline sprite for a region-only enemy: a floppy disk that bites. '.' is transparent; the other
// characters index `pal`. Two frames = a walk/idle cycle. (Real regions keep grids in regions/art-<id>.js.)
const FLOPPY = {
  pal: { B: '#2563eb', b: '#1e3a8a', L: '#e5e7eb', S: '#94a3b8', e: '#0b1020' },
  frames: [
    ['.BBBBBBBB.', '.BLLLLLbB.', '.BLLLLLbB.', '.BBBBBBBB.', '.BBeBBeBB.', '.BBBBBBBB.', '.BSSSSSSB.', '.BS.SS.SB.'],
    ['.BBBBBBBB.', '.BLLLLLbB.', '.BLLLLLbB.', '.BBBBBBBB.', '.BBeBBeBB.', '.BBBBBBBB.', '.BSSSSSSB.', '.B.SSSS.B.'],
  ],
};

export default {
  id: 'sandbox',
  name: 'Sandbox',
  subtitle: 'Every API call of the region framework, in one small island',
  size: 44,
  spawn: [0, 14],
  sky: { tint: '#bfdbfe', ground: '#10223f', fog: '#0a1428', density: 0.007, sun: 2.4 },
  zones: {
    steps: { x: -12, z: 4, r: 7, label: 'Step test' },
    arena: { x: 8, z: -10, r: 9, label: 'Boss pit' },
  },

  build(ctx) {
    // ---- terrain: a round island with a plateau, 1- and 2-block steps and a pit
    const T = terrain(ctx, {
      size: 44,
      height: (x, z) => {
        const d = Math.hypot(x, z);
        if (d > 20 + Math.sin(x * 0.4) * 1.5) return null;                 // null = no ground (the void)
        if (x < -8 && x > -17 && z > -2 && z < 10) return 2 + Math.max(0, Math.floor((-8 - x) / 2)); // stairs up (1 block each)
        if (x > 12 && z > 4 && z < 10) return 5;                            // a 2-block ledge above the 3-high lawn
        if (Math.hypot(x - 8, z + 10) < 8) return 1;                        // the boss pit
        return 3;
      },
      type: (x, z) => (Math.hypot(x - 8, z + 10) < 8 ? 'sand' : Math.abs(x) < 2 ? 'path' : 'grass'),
      palette: { grass: ['#4fb56b', '#46a562', '#3f9d5a'], sand: ['#d9c58a', '#c9b478'], path: ['#9b8c72', '#a3947a'] },
    });

    // ---- props: a wall that blocks, a scatter of grass, a single sprite, a moving platform
    const wall = [];
    for (let x = -4; x <= 4; x++) for (let y = 4; y <= 6; y++) wall.push([x, y, -2, y === 6 ? '#f2b84b' : '#475569', y === 6 ? 0.6 : 0]);
    props(ctx, wall, { block: true });
    const marker = props(ctx, boxCells(14, 15, 6, 7, 6, 7, '#7dd3fc', { glow: 1.2 }));    // a glowing marker on the high ledge
    block(ctx, 14, 6);
    scatter(ctx, 'grass', Array.from({ length: 30 }, (_, i) => ({ x: -6 + (i % 6) * 1.6, z: 6 + Math.floor(i / 6) * 1.4, scale: 0.1 })), { maxHalf: 3 });
    sprite(ctx, 'sungod', { x: 0, z: -14, scale: 0.35, face: 0 });
    const lift = platform(ctx, { x: 16, z: 0, w: 3, d: 3, y: 4, color: '#a78bfa', glow: 0.4, move: (t) => 4 + 3 * (0.5 + 0.5 * Math.sin(t * 0.8)) });
    void lift;

    // ---- enemies: one inline-art kind, one reused hub kind, a ranged turret
    registerEnemyKind('floppy', { name: 'Floppy Disk', art: FLOPPY, hp: 24, speed: 4.2, dmg: 6, type: 'Normal', xp: 12, gold: 15, behaviour: 'swarm', scale: 0.2 });
    registerEnemyKind('sandbox-turret', { name: 'Linter', sprite: 'crystal', hp: 30, dmg: 6, behaviour: 'turret', rate: 2400, aggro: 11, proj: 'spark', scale: 0.3, type: 'Electric' });
    spawnEnemy(ctx, { kind: 'floppy', x: -3, z: 2 });
    spawnEnemy(ctx, { kind: 'floppy', x: 3, z: 3 });
    spawnEnemy(ctx, { kind: 'slime-green', x: 6, z: 8, name: 'Sandbox Slime' });
    spawnEnemy(ctx, { kind: 'sandbox-turret', x: -14, z: -8 });

    // ---- a pattern boss in the pit
    const boss = spawnBoss(ctx, {
      id: 'sandbox-golem', name: 'Test Golem', sprite: 'golem', scale: 0.3, x: 8, z: -11, hp: 160, type: 'Ice',
      pattern: ['rings', 'fan'], phases: [{ below: 0.5, pattern: ['summon', 'nova', 'charge'] }], minion: 'floppy',
      reward: { gold: 100, xp: 40 }, respawn: 20000, color: '#93c5fd',
      onDefeat: (b, { first }) => { say('me', first ? 'Unit tests passing.' : 'Still passing.'); findBoss(); },
    });

    // ---- an NPC with a branching dialog
    spawnNpc(ctx, {
      id: 'sandbox-bot', name: 'Test Bot', sprite: 'robot', x: 4, z: 12, face: 3.1,
      news: () => !ctx.state.metBot,
      talk: () => {
        ctx.state.metBot = true;
        ctx.save();
        return {
          text: 'Beep. I exist to prove the dialog format works. Want a demonstration?',
          choices: [
            { label: 'Branch, please', next: () => ({ text: 'This is a nested node. Branches can return functions.', choices: [{ label: 'Neat' }] }) },
            { label: 'Say something in the world', action: () => say('sandbox-bot', 'Hello from a speech bubble!') },
            { label: 'Show me the boss', action: () => cinematic(ctx, { x: 8, y: 3, z: -11, pitch: 0.45, dist: 20, seconds: 2.2 }) },
            { label: 'Bye' },
          ],
        };
      },
    });

    // ---- interactables: a sign (dialog), a bike (ride), a chest (once)
    interactable(ctx, {
      x: -2, z: 14, label: 'Sign', prompt: 'E · read',
      onInteract: () => dialog({ text: 'Sandbox. Stairs to the west (1 block each), a 2-block ledge to the east, a boss in the pit to the north.', choices: [{ label: 'OK' }] }, { name: 'Sign', sprite: 'book' }),
    });
    interactable(ctx, {
      x: 6, z: 15, label: 'Bicycle', prompt: 'E · ride',
      onInteract: (it) => {
        if (ctx.player.vehicle) { toast('Park the vehicle first (V).'); return; }
        if (it.riding) { dismount(); it.riding = false; it.setPrompt('E · ride'); return; }
        ride({ name: 'Bicycle', speed: 1.7 });
        it.riding = true;
        it.setPrompt('E · get off');
      },
    });
    interactable(ctx, {
      x: 15, z: 8, label: 'Chest on the ledge', prompt: 'E · open', once: true, sprite: 'chest', spriteScale: 0.14,
      onInteract: () => { sfx('victory'); banner('Ledge reached', 'Two blocks up: the jump works.', 'open-treasure-chest'); findLedge(); },
    });

    // ---- a trigger, a pickup, a portal home
    trigger(ctx, { x: 8, z: -10, r: 7, once: true, onEnter: () => toast('The pit. Something large is testing its patterns.', { icon: 'triangle-alert' }) });
    pickup(ctx, { id: 'sandbox-token', x: -15, z: 5, onPick: () => { ctx.state.token = true; ctx.save(); toast('Picked up a sandbox token (stays picked up).', { icon: 'two-coins' }); } });
    portal(ctx, { x: 0, z: 18, to: 'hub', face: 0 });

    // ---- a quest, eggs
    quest({
      id: 'sandbox-tour', title: 'Sandbox tour',
      steps: [
        { id: 'bot', text: 'Talk to the Test Bot', done: () => !!ctx.state.metBot },
        { id: 'token', text: 'Pick up the token at the top of the stairs', done: () => !!ctx.state.token },
        { id: 'boss', text: 'Beat the Test Golem', done: () => boss.defeated },
      ],
      reward: { gold: 50, xp: 20 },
    });
    const findBoss = egg('sandbox-golem', 'Green CI', 'Beat the sandbox golem.', 'All patterns tested. Coverage: 100% (of one golem).');
    const findLedge = egg('sandbox-ledge', 'Two blocks up', 'Reach the chest on the high ledge.', 'Coyote time and jump buffering: verified.');

    // ---- per-frame + lifecycle hooks
    // (the marker on the ledge pulses; onEnter re-applies a custom sky, e.g. for a night-time egg)
    onUpdate(ctx, (dt, t) => { marker.userData.setHi(0.5 + 0.5 * Math.sin(t * 2)); });
    onEnter(ctx, () => { setSky({ tint: '#bfdbfe', ground: '#10223f', fog: '#0a1428', density: 0.007, sun: 2.4 }); say('bit', 'A sandbox! Everything here is a test.'); });
    void T;
    // Road to Dr. items are given with award('badge-lark') (or a boss's `drop`); the sandbox gives none.
  },
};
