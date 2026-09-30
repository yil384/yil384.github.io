// regions/art-oj.js: sprite grids for the CST-OJ tower (original designs).
export const OJ_ART = {
  // WA: Wrong Answer, a red blob with X-ed out eyes
  'oj-wa': {
    pal: { R: '#ef4444', r: '#991b1b', k: '#1c0a0a' },
    frames: [
      ['..RRRR..', '.RRRRRR.', 'RkRkkRkR', 'RRkRRkRR', 'RkRkkRkR', 'RRRRRRRR', '.rRRRRr.'],
      ['........', '..RRRR..', 'RRRRRRRR', 'RkRkkRkR', 'RRkRRkRR', 'RkRkkRkR', 'rRRRRRRr'],
    ],
  },
  // TLE: Time Limit Exceeded, a sleepy hourglass that gets there eventually
  'oj-tle': {
    pal: { g: '#78350f', G: '#a8a29e', Y: '#fbbf24', k: '#292524', W: '#fef3c7' },
    frames: [
      ['ggggggg', '.GkYkG.', '.GYYYG.', '..GYG..', '...Y...', '..GWG..', '.GWYWG.', '.GYYYG.', 'ggggggg'],
      ['ggggggg', '.GkWkG.', '.GYYYG.', '..GYG..', '...W...', '..GYG..', '.GYYYG.', '.GYYYG.', 'ggggggg'],
    ],
  },
  // MLE: Memory Limit Exceeded, a RAM stick that ate too much
  'oj-mle': {
    pal: { G: '#15803d', g: '#14532d', k: '#0a0a0a', W: '#dcfce7', Y: '#facc15' },
    frames: [
      ['GGGGGGGGGG', 'GkkGkkGkkG', 'GkkGkkGkkG', 'GGWkGGWkGG', 'GGGGGGGGGG', 'GGGkkkkGGG', 'gGGGGGGGGg', 'Y.Y.Y.Y.Y.'],
      ['GGGGGGGGGG', 'GkkGkkGkkG', 'GkkGkkGkkG', 'GGWkGGWkGG', 'GGGGGGGGGG', 'GGGGkkGGGG', 'gGGGGGGGGg', '.Y.Y.Y.Y.Y'],
    ],
  },
  // RE: Runtime Error, a warning sign that panics and throws
  'oj-re': {
    pal: { Y: '#facc15', y: '#a16207', k: '#1c1917' },
    frames: [
      ['....Y....', '...YYY...', '..YYkYY..', '..YYkYY..', '.YYYkYYY.', '.YYYYYYY.', 'YYYYkYYYY', 'YYYYYYYYY', '.y.....y.'],
      ['....Y....', '...YYY...', '..YYkYY..', '..YYkYY..', '.YYYkYYY.', '.YYYYYYY.', 'YYYYkYYYY', 'YYYYYYYYY', '..y...y..'],
    ],
  },
  // CE: Compile Error, a missing semicolon (well, the semicolon found it)
  'oj-ce': {
    pal: { R: '#f43f5e', r: '#9f1239', k: '#1c0a0a' },
    frames: [
      ['.RRR.', 'RkRkR', '.RRR.', '.....', '.RRR.', '.RRR.', '..RR.', '..r..'],
      ['.RRR.', 'RkRkR', '.RRR.', '.....', '.RRR.', '.RRR.', '.RR..', '.r...'],
    ],
  },
  // a submission walking to the judge (ambient)
  'oj-sub': {
    pal: { W: '#f8fafc', w: '#cbd5e1', k: '#334155', B: '#60a5fa' },
    frames: [
      ['WWWWw.', 'WBBWWw', 'WWWWWW', 'WkkkWW', 'WWWWWW', '.w..w.'],
      ['WWWWw.', 'WBBWWw', 'WWWWWW', 'WkkkWW', 'WWWWWW', 'w....w'],
    ],
  },
  // The Hidden Test Case: hooded, unknowable, question mark on its chest
  'oj-hidden': {
    pal: { V: '#4c1d95', v: '#2e1065', k: '#0b0616', W: '#e9d5ff', Y: '#fbbf24' },
    frames: [
      [
        '....vvvvvv....',
        '...vVVVVVVv...',
        '..vVVkkkkVVv..',
        '..vVkWkkWkVv..',
        '..vVVkkkkVVv..',
        '...vVVVVVVv...',
        '..vVVVYYYVVVv.',
        '.vVVVYVVVYVVv.',
        '.vVVVVVVVYVVv.',
        '.vVVVVVVYVVVv.',
        '.vVVVVVYVVVVv.',
        '.vVVVVVVVVVVv.',
        'vVVVVVVYVVVVVv',
        'vVVVVVVVVVVVVv',
        'vvVVVvvvvVVVvv',
        'v.vv.v..v.vv.v',
      ],
      [
        '....vvvvvv....',
        '...vVVVVVVv...',
        '..vVVkkkkVVv..',
        '..vVkkWkkWVv..',
        '..vVVkkkkVVv..',
        '...vVVVVVVv...',
        '..vVVVYYYVVVv.',
        '.vVVVYVVVYVVv.',
        '.vVVVVVVVYVVv.',
        '.vVVVVVVYVVVv.',
        '.vVVVVVYVVVVv.',
        '.vVVVVVVVVVVv.',
        'vVVVVVVYVVVVVv',
        'vVVVVVVVVVVVVv',
        'vvVVVvvvvVVVvv',
        '.v.vv.vv.vv.v.',
      ],
    ],
  },
  // TA-bot: a teaching-assistant robot with a mortarboard and a clipboard
  'oj-ta': {
    pal: { k: '#111827', Y: '#facc15', S: '#94a3b8', C: '#a7f3d0', B: '#3b82f6', b: '#1e3a8a', W: '#f8fafc' },
    frames: [
      ['..kkkkkk..', '.kkkkkkkkY', '..SSSSSS.Y', '.SCCCCCCS.', '.SCkCCkCS.', '.SCCkkCCS.', '..SSSSSS..', '.BBBBBBWW.', 'BBBBBBBWkW', 'B.BBBB.WWW', '..b..b....'],
      ['..kkkkkk..', '.kkkkkkkkY', '..SSSSSSY.', '.SCCCCCCS.', '.SCkCCkCS.', '.SCCkkCCS.', '..SSSSSS..', '.BBBBBBWW.', 'BBBBBBBWkW', 'B.BBBB.WWW', '...b..b...'],
    ],
  },
  // Stu: a student with a hoodie and a laptop, stuck on a linked list
  'oj-stu': {
    pal: { H: '#1f2937', s: '#f5d0b0', k: '#111827', P: '#a855f7', L: '#94a3b8', b: '#334155' },
    frames: [
      ['..HHHH..', '.HHHHHH.', '.HssssH.', '.skssks.', '..ssss..', '.PPPPPP.', 'PPPPPPPP', 'PsLLLLsP', '.PLLLLP.', '.PP..PP.', '.bb..bb.'],
      ['..HHHH..', '.HHHHHH.', '.HssssH.', '.skssks.', '..ssss..', '.PPPPPP.', 'PPPPPPPP', 'PsLLLLsP', '.PLLLLP.', '.PP..PP.', 'bb....bb'],
    ],
  },
  // an edge case (pickup)
  'oj-edge': {
    pal: { G: '#4ade80', g: '#15803d', W: '#f0fdf4' },
    frames: [['..G..', '.GWG.', 'GGGGG', '.GgG.', '..G..']],
  },
};
