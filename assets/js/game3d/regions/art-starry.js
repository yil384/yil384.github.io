// regions/art-starry.js: sprite grids for the Starry-Next kernel (original designs).
export const STARRY_ART = {
  // Stray Packet: a little frame with an orange header, a blue body and a yellow payload stripe
  'st-packet': {
    pal: { O: '#fb923c', B: '#60a5fa', W: '#ffffff', k: '#0f172a', Y: '#fde047', b: '#1e40af' },
    frames: [
      ['OOOOOOOO', 'OBBBBBBO', 'BWkBBWkB', 'BBBBBBBB', 'BYYYYYYB', 'BBBBBBBB', '.b....b.'],
      ['OOOOOOOO', 'OBBBBBBO', 'BWkBBWkB', 'BBBBBBBB', 'BYYYYYYB', 'BBBBBBBB', '..b..b..'],
    ],
  },
  // Interrupt Storm: a spiky, shouting IRQ
  'st-irq': {
    pal: { Y: '#facc15', y: '#ca8a04', W: '#ffffff', k: '#1c1917' },
    frames: [
      ['Y..Y..Y', '.YYYYY.', 'YWkYWkY', '.YYYYY.', 'YYkkkYY', '.yYYYy.', 'Y..Y..Y'],
      ['.Y.Y.Y.', 'YYYYYYY', '.WkYWk.', 'YYYYYYY', '.YkkkY.', 'YyYYYyY', '.Y.Y.Y.'],
    ],
  },
  // Duplicate ACK: a ghost that keeps acknowledging the same thing
  'st-dupack': {
    pal: { G: '#c4b5fd', g: '#7c3aed', W: '#ffffff', k: '#2e1065' },
    frames: [
      ['..GGGG..', '.GGGGGG.', 'GGWkGWkG', 'GGGGGGGG', 'GGgggGGG', 'GGGGGGGG', 'GG.GG.GG', 'G...G..G'],
      ['..GGGG..', '.GGGGGG.', 'GGWkGWkG', 'GGGGGGGG', 'GGGgggGG', 'GGGGGGGG', 'G.GG.GG.', '..G..G.G'],
    ],
  },
  // Zombie Process: a defunct terminal still shuffling around user space
  'st-zombie': {
    pal: { S: '#64748b', g: '#1f2937', R: '#f87171', G: '#86efac', s: '#334155' },
    frames: [
      ['.SSSSSSS.', '.SgggggS.', '.SgRgRgS.', '.SgggggS.', '.SgRRRgS.', '.SSSSSSS.', 'GG.SSS.GG', '...s.s...', '..ss.ss..'],
      ['.SSSSSSS.', '.SgggggS.', '.SgRgRgS.', '.SgggggS.', '.SgRRRgS.', '.SSSSSSS.', '.GGSSSGG.', '...s.s...', '...s..ss.'],
    ],
  },
  // a user-space process (ambient)
  'st-proc': {
    pal: { C: '#67e8f9', c: '#0e7490', W: '#ffffff', k: '#083344' },
    frames: [
      ['.CCCC.', 'CWkWkC', 'CCCCCC', 'CcCCcC', '.C..C.'],
      ['.CCCC.', 'CWkWkC', 'CCCCCC', 'CCccCC', 'C....C'],
    ],
  },
  // The Jumbo Frame: an enormous packet wearing all four layers of headers
  'st-jumbo': {
    pal: { O: '#fb923c', o: '#c2410c', B: '#3b82f6', b: '#1d4ed8', G: '#22c55e', g: '#15803d', W: '#f8fafc', k: '#0f172a' },
    frames: [
      [
        '..OOOOOOOOOOOO..',
        '.OOoOOoOOoOOoOO.',
        '.BBBBBBBBBBBBBB.',
        '.BbBBbBBbBBbBBB.',
        '.GGGGGGGGGGGGGG.',
        '.GgGGgGGgGGgGGG.',
        '.WWWWWWWWWWWWWW.',
        '.WWkkWWWWWWkkWW.',
        '.WWkkWWWWWWkkWW.',
        '.WWWWWWWWWWWWWW.',
        '.WWWWkkkkkkWWWW.',
        '.WWWkWWWWWWkWWW.',
        '.WWWWWWWWWWWWWW.',
        '.OOOOOOOOOOOOOO.',
        '..oo........oo..',
        '.ooo........ooo.',
      ],
      [
        '..OOOOOOOOOOOO..',
        '.OoOOoOOoOOoOOO.',
        '.BBBBBBBBBBBBBB.',
        '.BBbBBbBBbBBbBB.',
        '.GGGGGGGGGGGGGG.',
        '.GGgGGgGGgGGgGG.',
        '.WWWWWWWWWWWWWW.',
        '.WWkkWWWWWWkkWW.',
        '.WWkkWWWWWWkkWW.',
        '.WWWWWWWWWWWWWW.',
        '.WWWWWkkkkWWWWW.',
        '.WWWWkWWWWkWWWW.',
        '.WWWWWWWWWWWWWW.',
        '.OOOOOOOOOOOOOO.',
        '...oo......oo...',
        '..ooo......ooo..',
      ],
    ],
  },
  // The Borrow Checker: a rust-coloured clerk with a visor and a big rubber stamp
  'st-borrow': {
    pal: { R: '#b7410e', r: '#7c2d12', W: '#fde68a', k: '#1c1917', S: '#475569', s: '#1e293b', Y: '#facc15' },
    frames: [
      ['..rrrrrr..', '.RRRRRRRR.', '.RWWWWWWR.', '.RWkWWkWR.', '.RRRRRRRR.', '..RkkkkR..', '.SSSSSSSS.', 'SSSSSSSSYY', 'S.SSSSSS.Y', '..SSSSSS..', '..ss..ss..'],
      ['..rrrrrr..', '.RRRRRRRR.', '.RWWWWWWR.', '.RWkWWkWR.', '.RRRRRRRR.', '..RkkkkR..', '.SSSSSSSSY', 'SSSSSSSSYY', 'S.SSSSSS..', '..SSSSSS..', '..ss..ss..'],
    ],
  },
  // Frag: a datagram torn into pieces by a small MTU
  'st-frag': {
    pal: { O: '#fb923c', B: '#60a5fa', W: '#ffffff', k: '#0f172a', Y: '#fde047', b: '#1e40af' },
    frames: [
      ['OOOO.OOOO', 'OBBB.BBBO', 'BWkB.BWkB', 'BBBB.BBBB', 'BYYY.YYYB', 'BBB...BBB', '.b.....b.'],
      ['OOOO.OOOO', 'OBBB.BBBO', 'BWkB.BWkB', 'BBBB.BBBB', 'BYYY.YYYB', 'BB.....BB', 'b.......b'],
    ],
  },
  // an IP fragment (pickup)
  'st-fragment': {
    pal: { O: '#fb923c', B: '#60a5fa', Y: '#fde047' },
    frames: [['OO.O.', 'BBBB.', 'BYYB.', '.BBB.']],
  },
};
