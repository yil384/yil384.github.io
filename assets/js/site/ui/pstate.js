// Page state for the interactive CV. Lives inside the shared save blob (yl.save.v2) as S.page, next to
// S.eggs (easter eggs) and S.player.gold (Triton Cash, shared with the 3D shop). game3d/state.js is not
// edited: this module only adds the page's own sub-object with defaults.
import { S, save, saveNow } from '../../game3d/state.js';

const D = () => ({
  v: 1, xp: 0, read: {}, cleared: {}, opened: {}, tokens: {}, bonks: {}, once: {}, equipped: [], quests: {},
  plain: false, rm: false, critters: true, firstVisit: 0, lastVisit: 0, lastSection: '', ngplus: 0, focus: 0,
  stats: { bonks: 0, opened: 0, ms: 0 },
});

const saved = S.page && typeof S.page === 'object' ? S.page : {};
S.page = Object.assign(D(), saved, { stats: Object.assign(D().stats, saved.stats || {}) });

export const P = S.page;
export { save, saveNow };
export const defaults = D;

let persist = null;
/** True when localStorage accepts writes (so "Saved in this browser" is honest). */
export function canPersist() {
  if (persist != null) return persist;
  try { localStorage.setItem('yl.probe', '1'); localStorage.removeItem('yl.probe'); persist = true; } catch { persist = false; }
  return persist;
}

// first / last visit bookkeeping (the previous lastVisit is kept for the hero's "Continue")
export const previousVisit = P.lastVisit || 0;
if (!P.firstVisit) P.firstVisit = Date.now();
P.lastVisit = Date.now();
save();
