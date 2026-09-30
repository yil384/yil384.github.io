// regions/art-samsung.js: sprite grids for the agent fab (original designs; no logos, no product art).
const agent = (body, dark) => ({
  pal: { B: body, b: dark, W: '#f8fafc', k: '#0f172a', A: '#fde047' },
  frames: [
    ['...A....', '..BBBB..', '.BWkWkB.', '.BBBBBB.', '..bbbb..', '.B.BB.B.', '..b..b..'],
    ['...A....', '..BBBB..', '.BWkWkB.', '.BBBBBB.', '..bbbb..', 'B..BB..B', '.b....b.'],
  ],
});

export const SAMSUNG_ART = {
  // helper agents: undifferentiated, then planner / tool-caller / critic once roles emerge
  'sg-agent': agent('#94a3b8', '#64748b'),
  'sg-agent-b': agent('#60a5fa', '#1d4ed8'),
  'sg-agent-o': agent('#fb923c', '#c2410c'),
  'sg-agent-g': agent('#4ade80', '#15803d'),
  // Tool-call Stall: an hourglass holding a wrench, waiting on a response
  'sg-stall': {
    pal: { G: '#94a3b8', g: '#475569', S: '#fde68a', W: '#f1f5f9', k: '#0f172a', O: '#f97316' },
    frames: [
      ['gggggggg', '.GWWWWG.', '.GWkWkG.', '..GSSG..', '...SS...', '..GSSG..', '.GSSSSG.', '.GSSSSGO', 'ggggggOO'],
      ['gggggggg', '.GWWWWG.', '.GWkWkG.', '..GWSG..', '...SS...', '..GSSG..', '.GSSSSG.', 'OGSSSSG.', 'OOgggggg'],
    ],
  },
  // KV-cache Bloat: every token it has ever seen, kept forever, just in case
  'sg-kv': {
    pal: { T: '#2dd4bf', t: '#0f766e', K: '#fde047', V: '#f472b6', W: '#f0fdfa', k: '#042f2e' },
    frames: [
      [
        '..TTTTTTTT..',
        '.TTKTTVTTKT.',
        'TTTTTTTTTTTT',
        'TVTWkTTWkTVT',
        'TTTkkTTkkTTT',
        'TKTTTTTTTTKT',
        'TTTTkkkkTTTT',
        'TTVTTTTTTVTT',
        '.TTTKTTKTTT.',
        '..tt.tt.tt..',
      ],
      [
        '.TTTTTTTTTT.',
        'TTTKTTVTTKTT',
        'TTTTTTTTTTTT',
        'TVTWkTTWkTVT',
        'TTTkkTTkkTTT',
        'TKTTTTTTTTKT',
        'TTTTTkkTTTTT',
        'TTVTTTTTTVTT',
        '.TTTKTTKTTT.',
        '.tt.tt.tt...',
      ],
    ],
  },
  // Context-window Overflow: a scroll with more tokens than it can hold, spilling
  'sg-overflow': {
    pal: { P: '#fef3c7', p: '#d6b56b', L: '#78716c', k: '#1c1917', R: '#ef4444' },
    frames: [
      ['pPPPPPPp', 'pPkPPkPp', 'pPPPPPPp', 'pLLLLLPp', 'pLLLPPPp', 'pLLLLLLp', 'pLLRLLLL', '.pPPPPLL', '..LL..L.'],
      ['pPPPPPPp', 'pPkPPkPp', 'pPPPPPPp', 'pLLLLLPp', 'pLLLPPPp', 'pLLLLLLp', 'pLLRLLLp', 'LLPPPPp.', '.L..LL..'],
    ],
  },
  // Hallucination Wisp: pretty, glowing, and completely made up
  'sg-wisp': {
    pal: { V: '#c084fc', v: '#7e22ce', W: '#faf5ff', k: '#3b0764', Y: '#fde047' },
    frames: [
      ['...Y....', '..VVVV..', '.VWkWkV.', 'VVVVVVVV', 'VVVkkVVV', '.VVVVVV.', '..vVVv..', '...v.v..'],
      ['....Y...', '..VVVV..', '.VWkWkV.', 'VVVVVVVV', 'VVVVVVVV', '.VVkkVV.', '..VvvV..', '..v..v..'],
    ],
  },
  // a stray electron (ambient)
  'sg-spark': {
    pal: { C: '#67e8f9', W: '#ffffff' },
    frames: [['.C.', 'CWC', '.C.'], ['C.C', '.W.', 'C.C']],
  },
  // a research-theme chip (pickup)
  'sg-chip': {
    pal: { D: '#1e293b', G: '#fbbf24', B: '#6e8bff', W: '#e0e7ff' },
    frames: [['G.G.G.', 'DDDDDD', 'DBBBBD', 'DBWWBD', 'DBBBBD', 'DDDDDD', 'G.G.G.']],
  },
  // The Agent Loop: a looping arrow with a planner's eye, a tool arm and a critic's monocle
  'sg-loop': {
    pal: { B: '#6e8bff', b: '#3730a3', C: '#22d3ee', W: '#ffffff', k: '#0b1026', O: '#fb923c', G: '#4ade80', Y: '#fde047' },
    frames: [
      [
        '......BBBBBBB.......',
        '....BBBBBBBBBBB.....',
        '...BBB.......BBBY...',
        '..BBB.........BYYY..',
        '..BB..WWW..WWW.BY...',
        '.BBB..WkW..WkG.BB...',
        '.BB...WWW..WGG..BB..',
        '.BB.............BB..',
        '.BB....kkkkk....BB..',
        '.BB.............BB.O',
        '.BBB...........BBBOO',
        '..BB..........BBBOO.',
        '..BBB........BBB....',
        '...BBBB....BBBB.....',
        '....bBBBBBBBBb......',
        '.....bbBBBBbb.......',
        '......CC..CC........',
        '.....CCC..CCC.......',
      ],
      [
        '......BBBBBBB.......',
        '....BBBBBBBBBBB.....',
        '...BBB.......BBB....',
        '..BBB.........BBY...',
        '..BB..WWW..WWW.BYYY.',
        '.BBB..WkW..WkG.BBY..',
        '.BB...WWW..WGG..BB..',
        '.BB.............BB..',
        '.BB.....kkk.....BB.O',
        '.BB....k...k....BBOO',
        '.BBB...........BBBO.',
        '..BB..........BBB...',
        '..BBB........BBB....',
        '...BBBB....BBBB.....',
        '....bBBBBBBBBb......',
        '.....bbBBBBbb.......',
        '.....CC....CC.......',
        '....CCC....CCC......',
      ],
    ],
  },
  // Probe: a wafer-probe drone that shows visitors around the die
  'sg-probe': {
    pal: { S: '#cbd5e1', s: '#64748b', B: '#6e8bff', W: '#ffffff', k: '#0f172a', Y: '#fde047' },
    frames: [
      ['ss......ss', '.ssSSSSss.', '..SBBBBS..', '.SBWkkWBS.', '.SBBBBBBS.', '..SSSSSS..', '....ss....', '....Y.....'],
      ['.s......s.', 'sssSSSSsss', '..SBBBBS..', '.SBWkkWBS.', '.SBBBBBBS.', '..SSSSSS..', '....ss....', '.....Y....'],
    ],
  },
  // Tessa-7: a test-debug robot for MLOps that files its own bug reports
  'sg-tessa': {
    pal: { W: '#e2e8f0', w: '#94a3b8', G: '#4ade80', R: '#ef4444', k: '#0f172a', C: '#fef3c7', c: '#a16207' },
    frames: [
      [
        '....GR......',
        '..wwwwwww...',
        '.wWWWWWWWw..',
        '.wWkGWWkGw..',
        '.wWWWWWWWw..',
        '..wwkkkww...',
        '.WWWWWWWWcc.',
        'WWWWWWWWcCCc',
        'W.WWWWWW.cCc',
        '..WWWWWW.cc.',
        '..ww..ww....',
      ],
      [
        '....RG......',
        '..wwwwwww...',
        '.wWWWWWWWw..',
        '.wWkGWWkGw..',
        '.wWWWWWWWw..',
        '..wwkkkww...',
        '.WWWWWWWWcc.',
        'WWWWWWWWcCCc',
        'W.WWWWWW.cCc',
        '..WWWWWW.cc.',
        '...ww..ww...',
      ],
    ],
  },
};
