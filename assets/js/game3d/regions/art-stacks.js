// regions/art-stacks.js: sprite grids for the Geisel Stacks (original designs).
// Every row of every frame has the same width; '.' is transparent; very dark colours become
// front-only details (eyes, pupils).
export const STACKS_ART = {
  // Quire, the Stacks librarian: a bookworm in a cardigan, round glasses, hair in a bun
  'sx-quire': {
    pal: { h: '#a78bfa', G: '#86c46a', g: '#5e9c48', O: '#fbbf24', k: '#0b0f19', W: '#e0f2fe', m: '#b45309', C: '#b0413e', c: '#8c2f2c', B: '#fde68a' },
    frames: [
      [
        '....hhhh....',
        '...hhhhhh...',
        '..GGGGGGGG..',
        '.GOOOGGOOOG.',
        '.GOkWOOkWOG.',
        '.GOOOGGOOOG.',
        '..GGGmmGGG..',
        '...GGGGGG...',
        '..CCCCCCCC..',
        '.CCCcBBcCCC.',
        '.CCCcCCcCCC.',
        '..CCcBBcCC..',
        '...gg..gg...',
        '..ggg..ggg..',
      ],
      [
        '....hhhh....',
        '...hhhhhh...',
        '..GGGGGGGG..',
        '.GOOOGGOOOG.',
        '.GOkWOOkWOG.',
        '.GOOOGGOOOG.',
        '..GGGGGGGG..',
        '...GGGGGG...',
        '..CCCGGCCC..',
        '.CCCcGGcCCC.',
        '.CCCcCCcCCC.',
        '..CCcBBcCC..',
        '...gg..gg...',
        '...gg..gg...',
      ],
    ],
  },
  // Rebutta, the author-response clerk: a penguin with a lanyard and a 5000-character counter
  'sx-rebutta': {
    pal: { N: '#2f3e63', n: '#24324f', W: '#f8fafc', k: '#0b0f19', Y: '#f59e0b', R: '#ef4444', L: '#60a5fa' },
    frames: [
      [
        '...NNNN...',
        '..NNNNNN..',
        '.NNWWWWNN.',
        '.NWkWWkWN.',
        '.NWWYYWWN.',
        'NNWWWWWWNN',
        'NNWLWWLWNN',
        'NNWWRRWWNN',
        '.NWWRRWWN.',
        '..NWWWWN..',
        '..YY..YY..',
      ],
      [
        '...NNNN...',
        '..NNNNNN..',
        '.NNWWWWNN.',
        '.NWkWWkWN.',
        '.NWWYYWWN.',
        'NNWWWWWWNN',
        'NNWLWWLWN.',
        'NNWWRRWWNN',
        '.NWWRRWWN.',
        '..NWWWWN..',
        '.YY....YY.',
      ],
    ],
  },
  // SCENE-GEN: the scenario generator, a hovering monitor that rolls dice full of traffic
  'sx-scenegen': {
    pal: { S: '#94a3b8', s: '#64748b', C: '#22d3ee', c: '#0e7490', k: '#0b0f19', Y: '#fde047', R: '#f43f5e' },
    frames: [
      [
        '....YY....',
        'SSSSSSSSSS',
        'SCCCCCCCCS',
        'SCkCCCCkCS',
        'SCCCCCCCCS',
        'SCCcccccCS',
        'SSSSSSSSSS',
        '...ssss...',
        '..RRssYY..',
        '...s..s...',
      ],
      [
        '....RR....',
        'SSSSSSSSSS',
        'SCCCCCCCCS',
        'SCCkCCkCCS',
        'SCCCCCCCCS',
        'SCcccccCCS',
        'SSSSSSSSSS',
        '...ssss...',
        '..YYssRR..',
        '...s..s...',
      ],
    ],
  },
  // Reviewer 3: a hooded figure made of printed paper, wielding a red pen. Confidence: 5.
  'sx-reviewer3': {
    pal: { P: '#e7e5e4', p: '#a8a29e', L: '#57534e', k: '#0b0f19', E: '#f43f5e', R: '#dc2626', r: '#7f1d1d', Y: '#fbbf24' },
    frames: [
      [
        '......PPPP......',
        '....PPPPPPPP....',
        '...PPpppppPPP...',
        '..PPpkkkkkkpPP..',
        '..PPpkEkkEkpPP..',
        '..PPpkkkkkkpPP..',
        '...PPpkkkkpPP...',
        '..PPPPPPPPPPPP..',
        '.PPLLLLPPLLLLPP.',
        'PPPPPPPYYPPPPPPR',
        'PPLLLLPYYPLLLPRR',
        'PPPPPPPPYPPPPRRP',
        '.PPLLLPYYPLLRRP.',
        '.PPPPPPPPPPrrPP.',
        '..PPLLLLLLPPPP..',
        '..PPPPPPPPPPPP..',
        '..pp.pp..pp.pp..',
        '.pp..pp..pp..pp.',
      ],
      [
        '......PPPP......',
        '....PPPPPPPP....',
        '...PPpppppPPP...',
        '..PPpkkkkkkpPP..',
        '..PPpkEkkEkpPP..',
        '..PPpkkkkkkpPP..',
        '...PPpkkkkpPP...',
        '..PPPPPPPPPPPP.R',
        '.PPLLLLPPLLLLPRR',
        'PPPPPPPYYPPPPRRP',
        'PPLLLLPYYPLLrrPP',
        'PPPPPPPPYPPPPPPP',
        '.PPLLLPYYPLLLPP.',
        '.PPPPPPPPPPPPPP.',
        '..PPLLLLLLPPPP..',
        '..PPPPPPPPPPPP..',
        '.pp..pp..pp..pp.',
        '..pp.pp..pp.pp..',
      ],
    ],
  },
  // Nitpick: a tiny red squiggle that underlines everything
  'sx-nitpick': {
    pal: { R: '#ef4444', r: '#991b1b', W: '#fff1f2', k: '#0b0f19' },
    frames: [
      ['.RR...', 'RWkR..', 'RRRR.R', '.RRRRr', '..r.r.'],
      ['...RR.', '..RWkR', 'R.RRRR', 'rRRRR.', '.r.r..'],
    ],
  },
  // Overdue Notice: a flying slip of paper, very late and very angry
  'sx-overdue': {
    pal: { W: '#fef9c3', w: '#fde68a', R: '#dc2626', k: '#0b0f19' },
    frames: [
      ['W......W', 'WWWWWWWW', 'WkWWWWkW', 'WWWRRWWW', 'WRRRRRRW', 'WwwwwwwW', '.w....w.'],
      ['.W....W.', 'WWWWWWWW', 'WkWWWWkW', 'WWWRRWWW', 'WRRRRRRW', 'WwwwwwwW', 'w......w'],
    ],
  },
  // Dust Bunny: lives behind the least-borrowed books
  'sx-dust': {
    pal: { D: '#9ca3af', d: '#6b7280', P: '#f9a8d4', k: '#0b0f19' },
    frames: [
      ['.D...D..', '.DD.DD..', 'DDDDDDD.', 'DkDDDkDD', 'DDDPDDDD', '.DDDDDDd', '..d..d..'],
      ['..D...D.', '..DD.DD.', '.DDDDDDD', 'DDkDDDkD', 'DDDDPDDD', 'dDDDDDD.', '.d..d...'],
    ],
  },
  // Late Fee: a coin that charges interest
  'sx-latefee': {
    pal: { Y: '#fbbf24', y: '#b45309', k: '#0b0f19', W: '#f8fafc' },
    frames: [
      ['..YYY..', '.YYYYY.', 'YYkYkYY', 'YYYYYYY', 'YYkkkYY', '.YYYYY.', '..yyy..', '...W...'],
      ['..YYY..', '.YYYYY.', 'YkYYYkY', 'YYYYYYY', 'YYkkkYY', '.YYYYY.', '..yyy..', '..W.W..'],
    ],
  },
  // Paper Cut: a folded crane with a very sharp edge
  'sx-papercut': {
    pal: { W: '#f1f5f9', w: '#cbd5e1', R: '#f43f5e', k: '#0b0f19' },
    frames: [
      ['W.......W', 'WW.....WW', '.WWWWWWW.', '..WkWWW..', '...WWWR..', '...wWw...', '....w....'],
      ['.........', 'WW.....WW', 'WWWWWWWWW', '..WkWWW..', '...WWWR..', '...wWw...', '....w....'],
    ],
  },
  // Silverfish: harmless, extremely well read
  'sx-silverfish': {
    pal: { S: '#cbd5e1', s: '#94a3b8', k: '#0b0f19' },
    frames: [
      ['s......s', '.SSSSSS.', 'SkSSSSSS', '.s.s.s.s'],
      ['.s....s.', '.SSSSSS.', 'SkSSSSSS', 's.s.s.s.'],
    ],
  },
  // a runaway book cart
  'sx-cart': {
    pal: { M: '#64748b', m: '#334155', R: '#ef4444', B: '#3b82f6', G: '#22c55e', Y: '#eab308', k: '#1f2937' },
    frames: [
      ['.RBGYRB..', 'MMMMMMMMM', '.GYRBGY..', 'MMMMMMMMM', '.M.....M.', 'MMMMMMMMM', '.k.....k.'],
      ['.RBGYRB..', 'MMMMMMMMM', '.GYRBGY..', 'MMMMMMMMM', '.M.....M.', 'MMMMMMMMM', 'k.......k'],
    ],
  },
  // a generated "adversarial" car, front view, headlights for eyes
  'sx-rogue': {
    pal: { R: '#f43f5e', r: '#9f1239', G: '#a5f3fc', Y: '#fef08a', k: '#0b0f19', T: '#374151' },
    frames: [
      ['..RRRRRR..', '.RGGGGGGR.', 'RRRRRRRRRR', 'RYkRRRRkYR', 'RRRrrrrRRR', 'TT......TT'],
      ['..RRRRRR..', '.RGGGGGGR.', 'RRRRRRRRRR', 'RYYRRRRYYR', 'RRRrrrrRRR', 'TT......TT'],
    ],
  },
  // a reviewer comment, rolled up with red ink
  'sx-comment': {
    pal: { W: '#fef3c7', w: '#d6b36a', R: '#dc2626' },
    frames: [['wWWWWw', 'WRRRRW', 'WWWWWW', 'WRRRWW', 'WWWWWW', 'WRRRRW', 'wWWWWw']],
  },
  // an equal-contribution asterisk
  'sx-asterisk': {
    pal: { Y: '#fde047', y: '#ca8a04' },
    frames: [['Y.Y.Y', '.YYY.', 'YYyYY', '.YYY.', 'Y.Y.Y']],
  },
};
export const STACKS_GLOW = {
  'sx-scenegen': { C: 1.2, Y: 1.5, R: 1.2 },
  'sx-reviewer3': { E: 2.4 },
  'sx-rogue': { Y: 2.2, G: 0.6 },
  'sx-asterisk': { Y: 1.8 },
  'sx-comment': { R: 0.8 },
  'sx-latefee': { Y: 0.6 },
};
