// regions/art-triton.js: sprite grids for the TritonGym arena (original designs).
export const TRITON_ART = {
  // a GPU thread: small, green, marches in lockstep with its warp
  'tg-thread': {
    pal: { G: '#4ade80', g: '#15803d', k: '#052e16', W: '#f0fdf4' },
    frames: [
      ['..G..', '.GGG.', 'GWkWk', 'GGGGG', '.GGG.', '.g.g.'],
      ['..G..', '.GGG.', 'GWkWk', 'GGGGG', '.GGG.', 'g...g'],
    ],
  },
  // Bank Conflict: two threads, one memory bank, zero patience
  'tg-bank': {
    pal: { B: '#60a5fa', b: '#1d4ed8', R: '#f87171', r: '#b91c1c', k: '#0f172a' },
    frames: [
      ['.BBB..RRR.', 'BBkBBRRkRR', 'BBBBBRRRRR', 'BkkBBRRkkR', 'BBBBBRRRRR', '.b.b..r.r.'],
      ['.BBB.RRR..', 'BBkBBRkRR.', 'BBBBRRRRR.', 'BkkBRRkkR.', 'BBBBBRRRR.', 'b.b...r.r.'],
    ],
  },
  // Race Condition: whoever gets there first wins, and it is never you
  'tg-race': {
    pal: { O: '#fb923c', o: '#9a3412', W: '#ffffff', k: '#1c1917', L: '#fde68a' },
    frames: [
      ['....OOOO.', 'LL.OOWkOO', '...OOOOOO', 'LLLOOOOkO', '...OOOOO.', '...o.o.o.'],
      ['....OOOO.', '.LLOOWkOO', '...OOOOOO', '.LLLOOOkO', '...OOOOO.', '..o.o.o..'],
    ],
  },
  // Uncoalesced Access: its memory requests go everywhere at once
  'tg-uncoal': {
    pal: { M: '#c084fc', m: '#7e22ce', k: '#2e1065' },
    frames: [
      ['M...M...M', '.........', '..MMMMM..', 'M.MkMkM.M', '..MMMMM..', '.M.mmm.M.', '...M.M...', 'M.......M'],
      ['.M..M..M.', 'M.......M', '..MMMMM..', '.MMkMkMM.', '..MMMMM..', 'M..mmm..M', '..M...M..', '.M..M..M.'],
    ],
  },
  // an activation tensor the golem allocates (and never frees)
  'tg-tensor': {
    pal: { T: '#22d3ee', t: '#0e7490', k: '#083344' },
    frames: [
      ['TTTTTTT', 'TtTtTtT', 'TTTTTTT', 'TkTTTkT', 'TTTTTTT', 'TtTtTtT', '.T...T.'],
      ['TTTTTTT', 'TtTtTtT', 'TTTTTTT', 'TkTTTkT', 'TTTTTTT', 'TtTtTtT', 'T.....T'],
    ],
  },
  // Kernie: an LLM agent that writes Triton kernels (a terminal for a head, a trident for an antenna)
  'tg-kernie': {
    pal: { Y: '#fbbf24', S: '#cbd5e1', k: '#0b1220', G: '#4ade80', B: '#0ea5e9', b: '#075985' },
    frames: [
      ['...Y.Y.Y..', '...YYYYY..', '.....Y....', '..SSSSSS..', '.SkkkkkkS.', '.SkGkkGkS.', '.SkkGGkkS.', '..SSSSSS..', '.BBBBBBBB.', 'B.BBBBBB.B', '..BBBBBB..', '..b....b..'],
      ['...Y.Y.Y..', '...YYYYY..', '.....Y....', '..SSSSSS..', '.SkkkkkkS.', '.SkGkkGkS.', '.SkGkkGkS.', '..SSSSSS..', '.BBBBBBBB.', 'B.BBBBBB.B', '..BBBBBB..', '...b..b...'],
    ],
  },
  // Coach Warp: whistle, cap, tracksuit, opinions about divergence
  'tg-coach': {
    pal: { R: '#dc2626', s: '#e0ac69', k: '#1c1917', Y: '#facc15', G: '#15803d', W: '#f8fafc' },
    frames: [
      ['..RRRRR..', '.RRRRRRRR', '..sssss..', '..sksks..', '..sssss..', '...sYs...', '.GGGGGGG.', 'GGWGGGWGG', 'sGWGGGWGs', '.GGGGGGG.', '.GG...GG.', '.kk...kk.'],
      ['..RRRRR..', '.RRRRRRRR', '..sssss..', '..sksks..', '..sssss..', '...sYs...', '.GGGGGGG.', 'GGWGGGWGG', 'sGWGGGWGs', '.GGGGGGG.', '.GG...GG.', 'kk.....kk'],
    ],
  },
  // the agent's tools (pickups): compiler, profiler, test oracle
  'tg-wrench': { pal: { S: '#cbd5e1' }, frames: [['.S.S.', '.SSS.', '..S..', '..S..', '..S..']] },
  'tg-watch': { pal: { Y: '#fbbf24', W: '#f8fafc', k: '#0f172a' }, frames: [['..Y..', '.WWW.', 'WWkWW', 'WkWWW', '.WWW.']] },
  'tg-check': { pal: { G: '#4ade80' }, frames: [['....G', '...GG', 'G.GG.', 'GGG..', '.G...']] },
};
