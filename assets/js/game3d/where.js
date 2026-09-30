// Which part of the world is live. The UCSD island ("hub") sits at the origin; every region is a
// separate island far away in the same scene. Only the current one is visible and updated.
// Tiny on purpose: every system can import it without pulling in the region framework.

export const where = {
  id: 'hub',          // current region id ('hub' for the island)
  ox: 0, oz: 0,       // its origin in world coordinates
  near: false,        // the camera is close enough to read name plates (set by index.js)
};

/** true when entities that belong to `region` should update / show. */
export const isLive = (region) => (region || 'hub') === where.id;
