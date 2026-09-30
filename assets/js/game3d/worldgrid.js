// The composite world: the hub island's heightmap plus any number of other height grids (the pier
// deck, every region's terrain) and moving platforms, behind the SAME API the game has always used:
//   height(x, z)    top voxel y of the column at (x, z), or -Infinity over the void
//   surfaceY(x, z)  height + 0.5 (where feet stand)
//   walkable, isBlocked, block, unblock, zoneAt, typeAt
// Everything that walks (player, enemies, companion, loot, camera) keeps calling world.height() and
// never needs to know which island it is on. Where grids overlap, the highest ground wins.

/**
 * @param hub  the island from world.js buildWorld()
 * @returns composite world (hub properties such as group, gate, sealChamber, TYPE, rand pass through)
 */
export function createComposite(hub) {
  const grids = [];
  const platforms = [];
  const inside = (g, x, z) => x >= g.x0 && x < g.x1 && z >= g.z0 && z < g.z1;

  /**
   * A height grid in WORLD coordinates. g = { id, region, x0, z0, x1, z1, height(x,z), isBlocked?(x,z),
   * block?(x,z), unblock?(x,z), typeAt?(x,z), zoneAt?(x,z) -> { key, label } | null }
   */
  function addGrid(g) { grids.push(g); return () => { const i = grids.indexOf(g); if (i >= 0) grids.splice(i, 1); }; }
  addGrid({
    id: 'hub', region: 'hub', ...(hub.bounds || { x0: -40, z0: -40, x1: 40, z1: 40 }),
    height: hub.height, colorAt: hub.colorAt, isBlocked: hub.isBlocked, block: hub.block, unblock: hub.unblock, typeAt: hub.typeAt,
    zoneAt: (x, z) => { const k = hub.zoneAt(x, z); return k ? { key: k, label: hub.ZONES?.[k]?.label || k } : null; },
  });

  /** A box you can stand on: { x0, z0, x1, z1, top, region }; `top` (feet y) may change every frame. */
  function addPlatform(p) { platforms.push(p); return () => { const i = platforms.indexOf(p); if (i >= 0) platforms.splice(i, 1); }; }

  function height(x, z) {
    let best = -Infinity;
    for (let i = 0; i < grids.length; i++) {
      const g = grids[i];
      if (!inside(g, x, z)) continue;
      const hh = g.height(x, z);
      if (hh > best) best = hh;
    }
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      if (p.off || x < p.x0 || x >= p.x1 || z < p.z0 || z >= p.z1) continue;
      if (p.top - 0.5 > best) best = p.top - 0.5;
    }
    return best;
  }
  const isBlocked = (x, z) => {
    for (const g of grids) if (inside(g, x, z) && g.isBlocked?.(x, z)) return true;
    return false;
  };
  const firstGrid = (x, z) => grids.find((g) => inside(g, x, z) && g.block) || grids[0];
  const typeAt = (x, z) => { for (const g of grids) if (inside(g, x, z)) { const t = g.typeAt?.(x, z); if (t) return t; } return 0; };
  /** { key, label } of the named area at (x, z), or null. */
  const zoneInfo = (x, z) => { for (const g of grids) if (inside(g, x, z)) { const zn = g.zoneAt?.(x, z); if (zn) return zn; } return null; };
  /** The region id whose grid covers (x, z) (the first registered one), or null over open sea. */
  const regionAt = (x, z) => { for (const g of grids) if (inside(g, x, z)) return g.region; return null; };

  return {
    ...hub,
    hub,
    grids,
    platforms,
    addGrid,
    addPlatform,
    height,
    walkable: (x, z) => height(x, z) > -Infinity,
    surfaceY: (x, z) => height(x, z) + 0.5,
    isBlocked,
    block: (x, z) => firstGrid(x, z).block(x, z),
    unblock: (x, z) => firstGrid(x, z).unblock?.(x, z),
    typeAt,
    zoneAt: (x, z) => zoneInfo(x, z)?.key || null,
    zoneInfo,
    regionAt,
  };
}

/** A blocked-cell set keyed by rounded cell, for grids that need one. */
export function cellSet() {
  const s = new Set();
  const k = (x, z) => `${Math.round(x)},${Math.round(z)}`;
  return { has: (x, z) => s.has(k(x, z)), add: (x, z) => s.add(k(x, z)), delete: (x, z) => s.delete(k(x, z)), set: s };
}
