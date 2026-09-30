// regions/art-finale.js: sprite grids for The Defense (original designs): three masked owl-scholars
// on the committee, the "one more experiment" GPU node, follow-up questions, a mortarboard and the
// graduate coordinator.
const owl = (F, f, M, extra) => ({
  pal: { K: '#3b3b52', T: '#fbbf24', F, f, M, W: '#fef3c7', k: '#0b0f19', Y: '#f59e0b', ...extra },
  frames: [
    [
      '...KKKKKKKK...',
      '.KKKKKKKKKKKK.',
      '...KKKKKKKKT..',
      '..FFFFFFFFFFT.',
      '.FMMMMFFMMMMF.',
      '.FMWkMMMMWkMF.',
      '.FMMMMFFMMMMF.',
      '.FFFFFYYFFFFF.',
      '..FFWWWWWWFF..',
      '.FFWWWWWWWWFF.',
      'FFfWWWWWWWWfFF',
      'FFfWWWWWWWWfFF',
      '.FfWWWWWWWWfF.',
      '..fFWWWWWWFf..',
      '...ffffffff...',
      '...YY....YY...',
    ],
    [
      '...KKKKKKKK...',
      '.KKKKKKKKKKKK.',
      '...KKKKKKKK.T.',
      '..FFFFFFFFFF.T',
      '.FMMMMFFMMMMF.',
      '.FMkWMMMMkWMF.',
      '.FMMMMFFMMMMF.',
      '.FFFFFYYFFFFF.',
      '..FFWWWWWWFF..',
      'FFFWWWWWWWWFFF',
      'FF.WWWWWWWW.FF',
      'F.fWWWWWWWWf.F',
      '..fWWWWWWWWf..',
      '..fFWWWWWWFf..',
      '...ffffffff...',
      '..YY......YY..',
    ],
  ],
});

export const FINALE_ART = {
  // Prof. Strix, Committee Chair: maroon feathers, a violet mask, asks about the degrees
  'fn-chair': owl('#9f3a4a', '#6d2533', '#7c3aed'),
  // Dr. Barn, the systems member: slate feathers, a teal mask, asks about the jobs
  'fn-systems': owl('#5b6b8c', '#3f4b66', '#0d9488'),
  // Dr. Tawny, the external member (Department of Owls): olive feathers, an orange mask, asks about the projects
  'fn-external': owl('#8a7a3a', '#5f5426', '#ea580c'),
  // One More Experiment: a GPU node with a progress bar that is always at 99%
  'fn-experiment': {
    pal: { S: '#475569', s: '#334155', G: '#4ade80', g: '#166534', R: '#f43f5e', Y: '#facc15', C: '#22d3ee', k: '#0b0f19' },
    frames: [
      [
        'SSSSSSSSSSSS',
        'SGgGgGgGgGgS',
        'SssssssssssS',
        'SCsCsCsCsCsS',
        'SssssssssssS',
        'SGGGGGGGGGYS',
        'SssssssssssS',
        'SkkRkkkkRkkS',
        'SssssssssssS',
        'SCsCsCsCsCsS',
        'SssssssssssS',
        'SGgGgGgGgGgS',
        'SSSSSSSSSSSS',
        '.s........s.',
      ],
      [
        'SSSSSSSSSSSS',
        'SgGgGgGgGgGS',
        'SssssssssssS',
        'SsCsCsCsCsCS',
        'SssssssssssS',
        'SGGGGGGGGGYS',
        'SssssssssssS',
        'SkkkRkkRkkkS',
        'SssssssssssS',
        'SsCsCsCsCsCS',
        'SssssssssssS',
        'SgGgGgGgGgGS',
        'SSSSSSSSSSSS',
        '.s........s.',
      ],
    ],
  },
  // a Follow-up Question: small, persistent, shaped like a question mark
  'fn-followup': {
    pal: { Q: '#c4b5fd', q: '#7c3aed', k: '#0b0f19' },
    frames: [
      ['.QQQQ.', 'QQkkQQ', '....QQ', '...QQ.', '..QQ..', '..QQ..', '......', '..qq..'],
      ['.QQQQ.', 'QkQQkQ', '....QQ', '...QQ.', '..QQ..', '..QQ..', '..qq..', '......'],
    ],
  },
  // a mortarboard with a gold tassel
  'fn-cap': {
    pal: { K: '#27273a', k: '#3b3b52', T: '#fbbf24' },
    frames: [['KKKKKKKKKK', '.KKKKKKKKT', '..kkkkkk.T', '..kkkkkk.T']],
  },
  // Paws, the graduate coordinator: a cat with a clipboard full of forms
  'fn-coord': {
    pal: { O: '#f59e0b', o: '#b45309', W: '#fef3c7', k: '#0b0f19', P: '#f9a8d4', B: '#a16207', b: '#f8fafc', G: '#22c55e' },
    frames: [
      [
        '.O......O.',
        '.OO....OO.',
        '.OOOOOOOO.',
        'OOkOOOOkOO',
        'OOOOPPOOOO',
        '.OOWWWWOO.',
        '..OOOOOO..',
        '.OOBBBBOO.',
        'OOOBbbBOOO',
        'OOOBbGBOOO',
        '.OOBBBBOO.',
        '..oo..oo..',
      ],
      [
        '.O......O.',
        '.OO....OO.',
        '.OOOOOOOO.',
        'OOOOOOOOOO',
        'OOOOPPOOOO',
        '.OOWWWWOO.',
        '..OOOOOO..',
        '.OOBBBBOO.',
        'OOOBbbBOOO',
        'OOOBbGBOOO',
        '.OOBBBBOO.',
        '..oo..oo..',
      ],
    ],
  },
};
export const FINALE_GLOW = {
  'fn-chair': { T: 0.8 },
  'fn-systems': { T: 0.8 },
  'fn-external': { T: 0.8 },
  'fn-experiment': { G: 1.6, C: 1.4, R: 2.2, Y: 2 },
  'fn-followup': { Q: 0.8 },
  'fn-cap': { T: 1.2 },
};
