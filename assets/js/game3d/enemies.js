// The hub's field enemies: the classic slimes, seagulls, Legacy Code and Null Pointers around the
// UCSD island. They are ordinary foes (foes.js, behaviour 'chase'); regions spawn theirs through
// regions.js. `enemies` is the hub list (minimap, tour mode); updateEnemies ticks every live foe.
import { Foe, foes, updateFoes } from './foes.js';

// home positions per zone (x, z)
const SPAWNS = [
  ['slime-green', 'meadow', 2, 2], ['slime-green', 'meadow', -3, 3], ['bat', 'meadow', 3, -3],
  ['slime-red', 'camp', -2, 2], ['bat', 'camp', 2, -2],
  ['skeleton', 'shadow', 2, 2], ['skeleton', 'shadow', -2, -3], ['slime-dark', 'shadow', 3, -2], ['bat', 'shadow', -3, 2],
  ['slime-red', 'peak', -4, -5], ['slime-dark', 'peak', 4, -5],
  ['bat', 'ice', 3, 4],
];
export const enemies = [];

export function initEnemies(world, parent, ZONES) {
  for (const [kind, zone, ox, oz] of SPAWNS) {
    const zn = ZONES[zone];
    let x = zn.x + ox, z = zn.z + oz;
    // nudge onto walkable ground
    for (let tries = 0; tries < 20 && (!world.walkable(x, z) || world.isBlocked(x, z)); tries++) { x += (Math.random() - 0.5) * 3; z += (Math.random() - 0.5) * 3; }
    if (!world.walkable(x, z)) continue;
    enemies.push(new Foe(world, parent, kind, x, z, { region: 'hub' }));
  }
}
export function updateEnemies(dt) { updateFoes(dt); }
/** Every live foe in the current region (minimap). */
export const liveFoes = () => foes.filter((f) => f.alive && f.active);
