// Pixel-art sprites defined as ASCII grids, rasterised once to <canvas> and cached as data URLs.
// '.' is transparent; every other character maps to a palette colour.

const ART = {
  player: {
    pal: { H: '#8b93ff', h: '#5b61d6', G: '#f5c542', S: '#f6cfa0', k: '#3b2a20', e: '#1b1b2f', B: '#3b82f6', b: '#1d4ed8', L: '#475569', f: '#1f2937' },
    frames: [
      [
        '.....HH.....',
        '....HHHH....',
        '...HHHHHH...',
        '...HHGHHH...',
        '..hhhhhhhh..',
        '...kSSSSk...',
        '...SeSSeS...',
        '...SSSSSS...',
        '....SSSS....',
        '..BBBGGBBB..',
        '.SBBBGGBBBS.',
        '.SbBBBBBBbS.',
        '..bBBBBBBb..',
        '..BBB..BBB..',
        '..LL....LL..',
        '..ff....ff..',
      ],
      [
        '.....HH.....',
        '....HHHH....',
        '...HHHHHH...',
        '...HHGHHH...',
        '..hhhhhhhh..',
        '...kSSSSk...',
        '...SeSSeS...',
        '...SSSSSS...',
        '....SSSS....',
        '..BBBGGBBB..',
        '.SBBBGGBBBS.',
        '.SbBBBBBBbS.',
        '..bBBBBBBb..',
        '..BBBBBBBB..',
        '...LL..LL...',
        '...ff..ff...',
      ],
    ],
  },

  // ---------- NPCs / monsters ----------
  pikachu: {
    pal: { Y: '#ffd84a', y: '#d9a300', k: '#2a2320', e: '#1d1d2b', R: '#ef4444' },
    frames: [[
      'k..........k',
      'Yk........kY',
      'YY........YY',
      'YYY......YYY',
      '.YYYYYYYYYY.',
      'YYYYYYYYYYYY',
      'YYeYYYYYYeYY',
      'YRRYYkkYYRRY',
      'YYYYYyyYYYYY',
      '.YYYYYYYYYY.',
      '..YYYYYYYY..',
      '..YY....YY..',
      '..yy....yy..',
    ]],
  },
  raichu: {
    pal: { O: '#f59e0b', o: '#b45309', b: '#3b2a20', Y: '#fde047', C: '#fde68a', e: '#1d1d2b', k: '#3b2a20' },
    frames: [[
      'b...........b',
      'Ob.........bO',
      'OOb.......bOO',
      '.OOO.....OOO.',
      '.OOOOOOOOOOO.',
      'OOeOOOOOOOeOO',
      'OYYOOkkkOOYYO',
      '.OOOOOOOOOOO.',
      '..OOCCCCCOO..',
      '..OCCCCCCCO..',
      '..OOCCCCCOO..',
      '..oo.....oo..',
    ]],
  },
  charmander: {
    pal: { O: '#fb923c', o: '#c2410c', C: '#fde68a', e: '#1d1d2b', w: '#ffffff', r: '#9a3412', F: '#ef4444', f: '#fde047' },
    frames: [[
      '....OOOO.....',
      '...OOOOOO....',
      '..OOOOOOOO...',
      '..OwOOOOwO...',
      '..OeOOOOeO...',
      '..OOOOOOOO...',
      '...OOrrOO....',
      '..oOOOOOOo..f',
      '.OOOCCCCOOO.F',
      '.O.OCCCCO.O.F',
      '...OCCCCO..o.',
      '...OOOOOOoo..',
      '...OO..OO....',
      '...oo..oo....',
    ]],
  },
  squirtle: {
    pal: { B: '#7dd3fc', b: '#0284c7', S: '#b45309', s: '#78350f', C: '#fde68a', e: '#1d1d2b' },
    frames: [[
      '...BBBBBB...',
      '..BBBBBBBB..',
      '..BeBBBBeB..',
      '..BBBBBBBB..',
      '...BBbbBB...',
      '.SSBBBBBBSS.',
      'SsSCCCCCCSsS',
      'BSSCCCCCCSSB',
      '.SsCCCCCCsS.',
      '..SSCCCCSS..',
      '..BB....BB..',
      '..bb....bb..',
    ]],
  },
  mario: {
    pal: { R: '#ef4444', S: '#f6cfa0', k: '#5b3a1a', e: '#1d1d2b', B: '#2563eb', Y: '#fde047', s: '#5b3a1a' },
    frames: [[
      '...RRRRR....',
      '..RRRRRRRRR.',
      '..kkkSSeS...',
      '.kSkSSSeSSS.',
      '.kSkkSSSkSSS',
      '.kkSSSSkkkk.',
      '...SSSSSSS..',
      '..RRBRRR....',
      '.RRRBRRBRRR.',
      'RRRRBBBBRRRR',
      'SSRBYBBYBRSS',
      'SSBBBBBBBBSS',
      '..BBB..BBB..',
      '.sss....sss.',
    ]],
  },
  kirby: {
    pal: { P: '#f9a8d4', p: '#f472b6', e: '#1e3a8a', R: '#e11d48' },
    frames: [[
      '....PPPP....',
      '..PPPPPPPP..',
      '.PPPPPPPPPP.',
      '.PPPePPePPP.',
      'PPPPePPePPPP',
      'PPpPePPePpPP',
      'PPPPPPPPPPPP',
      'PPPPPppPPPPP',
      '.PPPPPPPPPP.',
      '..PPPPPPPP..',
      '.RRRR..RRRR.',
      '.RRRR..RRRR.',
    ]],
  },
  link: {
    pal: { G: '#16a34a', H: '#fbbf24', S: '#f6cfa0', e: '#1d1d2b', B: '#92400e', s: '#60a5fa', L: '#e7e5e4', k: '#5b3a1a' },
    frames: [[
      '...GGGGG....',
      '..GGGGGGG...',
      '.GGGGGGGGGG.',
      '.HHSSSSSHH..',
      '.HSeSSSeSH..',
      '..SSSSSSS...',
      '...SSSSS....',
      '.sGGGGGGGG..',
      'ssGGGGGGGGS.',
      'ssGGBBBBGGS.',
      'ssGGGGGGGG..',
      '.sGGGGGGGG..',
      '..LL...LL...',
      '..kk...kk...',
    ]],
  },
  eevee: {
    pal: { B: '#b7793f', b: '#7c4a1e', C: '#f3e3c3', e: '#1d1d2b', n: '#3b2a20' },
    frames: [[
      'B...........B',
      'BB.........BB',
      'BbB.......BbB',
      'BbBB.....BBbB',
      '.BBBBBBBBBBB.',
      '.BBeBBBBBeBB.',
      '.BBBBBnBBBBB.',
      '..BBBBBBBBB..',
      '.CCCCBBBCCCC.',
      'CCCCCBBBCCCCC',
      '.CCCBBBBBCCC.',
      '..BB.BBB.BB..',
      '..bb.....bb..',
    ]],
  },
  growlithe: {
    pal: { O: '#f97316', k: '#1f1f1f', C: '#fde7c2', e: '#1d1d2b' },
    frames: [[
      '..CC.....CC..',
      '.OOCC...CCOO.',
      '.OOOOOOOOOOO.',
      'OOOeOOOOOeOOO',
      'OOOOOkkkOOOOO',
      '.OOCCCCCCCOO.',
      '..CCCCCCCCC..',
      '.OkOOOOOOOkO.',
      'OOOkOOOOOkOOO',
      '.OOOOOOOOOOO.',
      '.OO.OO.OO.OO.',
      '.CC.CC.CC.CC.',
    ]],
  },
  arcanine: {
    pal: { O: '#f97316', k: '#1f1f1f', C: '#fde7c2', e: '#1d1d2b' },
    frames: [[
      '..CCC.....CCC..',
      '.CCCCC...CCCCC.',
      '.CCOOOOOOOOOCC.',
      'CCOOeOOOOOeOOCC',
      'CCOOOOOkOOOOOCC',
      'CCCOOCCCCCOOCCC',
      '.CCCCCCCCCCCCC.',
      '..OkOOOOOOOkO..',
      '.OOOkOOOOOkOOO.',
      'OOOOOOOOOOOOOOO',
      '.OOOkOOOOOkOOO.',
      '.OO..OO.OO..OO.',
      '.CC..CC.CC..CC.',
    ]],
  },
  lapras: {
    pal: { L: '#60a5fa', l: '#1d4ed8', S: '#cbd5e1', s: '#64748b', C: '#fef3c7', e: '#1d1d2b' },
    frames: [[
      '.....LLL......',
      '....LLLLL.....',
      '....LeLLLL....',
      '....LLLLL.....',
      '.....LLL......',
      '.....LCL......',
      '..SSSLCLSS....',
      '.SsSSsCSsSS...',
      'SSSsSSSSSsSSL.',
      'LSSSSsSSSSSLLL',
      '.LLLLLLLLLLLL.',
      '..llCCCCCCll..',
      '...ll....ll...',
    ]],
  },
  dragonair: {
    pal: { D: '#7dd3fc', d: '#0ea5e9', W: '#f0f9ff', e: '#1d1d2b', O: '#3b82f6' },
    frames: [[
      '..W.....W.....',
      '..WW...WW.....',
      '...WDDDW......',
      '...DDDDD......',
      '...DeDDD......',
      '....DDDO......',
      '.....DDD......',
      '......DDD.....',
      '.......DDD....',
      '......DDD.....',
      '....DDDD......',
      '...DDD........',
      '...DDDDDDD....',
      '.......ODDd...',
    ]],
  },
  mew: {
    pal: { P: '#f9a8d4', p: '#ec4899', e: '#1e3a8a' },
    frames: [[
      '.P........P.',
      '.PP......PP.',
      '.PPPPPPPPPP.',
      'PPPePPPPePPP',
      'PPPePPPPePPP',
      '.PPPPPPPPPP.',
      '..PPPPPPPP..',
      '.p.PPPPPP...',
      '...PPPPPP.p.',
      '...PP..PP..p',
      '..........pP',
      '.........PP.',
    ]],
  },

  // ---------- enemies ----------
  slime: {
    pal: { O: '#14532d', M: '#22c55e', L: '#86efac', W: '#ffffff', k: '#0f172a' },
    frames: [[
      '....OOOO....',
      '..OOMMMMOO..',
      '.OMMLLMMMMO.',
      '.OMLLMMMMMO.',
      'OMMWkMMWkMMO',
      'OMMWWMMWWMMO',
      'OMMMMMMMMMMO',
      'OMMMMMMMMMMO',
      '.OMMMMMMMMO.',
      '..OOOOOOOO..',
    ]],
  },
  bat: {
    pal: { P: '#6b21a8', p: '#7c3aed', W: '#fde047' },
    frames: [
      [
        'P............P',
        'PP..........PP',
        'PPP.pppppp.PPP',
        '.PPPpWppWpPPP.',
        '..PPpppppppP..',
        '....pppppp....',
        '.....p..p.....',
        '..............',
      ],
      [
        '..............',
        '....pppppp....',
        '...PpWppWpP...',
        '.PPPppppppPPP.',
        'PPP.pppppp.PPP',
        'PP...pppp...PP',
        'P.....pp.....P',
        '..............',
      ],
    ],
  },
  skeleton: {
    pal: { W: '#e5e7eb', k: '#1f2937', R: '#ef4444', g: '#94a3b8' },
    frames: [[
      '...WWWWWW...',
      '..WWWWWWWW..',
      '..WkkWWkkW..',
      '..WkRWWkRW..',
      '..WWWWWWWW..',
      '...WgWgWg...',
      '....WWWW....',
      '..gWWWWWWg..',
      '.g.WgWWgW.g.',
      '.g.WWWWWW.g.',
      '...WgWWgW...',
      '...WW..WW...',
      '...WW..WW...',
      '..ggg..ggg..',
    ]],
  },

  // ---------- bosses ----------
  golem: {
    pal: { A: '#93c5fd', W: '#e0f2fe', B: '#60a5fa', k: '#1e3a8a', C: '#22d3ee', D: '#3b82f6' },
    frames: [[
      '.....AAAAAA.....',
      '....AWWWWWWA....',
      '...AWWWWWWWWA...',
      '...AWkkWWkkWA...',
      '...AWCkWWCkWA...',
      '...AWWWWWWWWA...',
      '..AAAWWkkWWAAA..',
      '.ABBAAWWWWAABBA.',
      'ABBBBAAAAAABBBBA',
      'ABBWBBAAAABBWBBA',
      'ABBBBAAAAAABBBBA',
      '.AAA.AAAAAA.AAA.',
      '.....AAAAAA.....',
      '....AAA..AAA....',
      '...DDDD..DDDD...',
      '...DDDD..DDDD...',
    ]],
  },
  mage: {
    pal: { P: '#5b21b6', p: '#2e1065', D: '#0b0616', G: '#f0abfc', o: '#c084fc', O: '#f5d0fe' },
    frames: [[
      '.......PP.......',
      '......PPPP......',
      '.....PPPPPP.....',
      '....PPPPPPPP....',
      '...pppppppppp...',
      '....DDDDDDDD....',
      '....DGDDDDGD....',
      '....DDDDDDDD....',
      '...PDDDDDDDDP...',
      '..PPPDDDDDDPPP..',
      '.oPPPPDDDDPPPPo.',
      '.OPPPPPPPPPPPPO.',
      '..PPPPPPPPPPPP..',
      '..PPPPPPPPPPPP..',
      '...PPPPPPPPPP...',
      '...pPPPPPPPPp...',
      '....pPpPPpPp....',
      '.....p.pp.p.....',
    ]],
  },
  dragon: {
    pal: { H: '#fde68a', R: '#dc2626', r: '#450a0a', Y: '#fbbf24', k: '#111111', W: '#991b1b', T: '#ffffff', d: '#78350f' },
    frames: [[
      '..HH............HH..',
      '...HH..........HH...',
      '....RRRRRRRRRRRR....',
      'W..RRRRRRRRRRRRRR..W',
      'WW.RRYkRRRRRRYkRR.WW',
      'WWWRRRRRRRRRRRRRRWWW',
      'WWWWRRRRrrrrRRRRWWWW',
      'WWWWWRRrTrrTrRRWWWWW',
      '.WWWWRRRRRRRRRRWWWW.',
      '..WWRRRYYYYYYRRRWW..',
      '...WRRYYYYYYYYRRW...',
      '....RRYYYYYYYYRR....',
      '....RRRYYYYYYRRR....',
      '.....RRRRRRRRRR.....',
      '.....RR.RRRR.RR.....',
      '....ddd..dd..ddd....',
    ]],
  },

  // ---------- props ----------
  chest: {
    pal: { W: '#92400e', w: '#78350f', G: '#f5c542', g: '#b45309', k: '#1f2937' },
    frames: [[
      '..WWWWWWWWWW..',
      '.WwwwwwwwwwwW.',
      'WGWWWWWWWWWWGW',
      'WGwwwwwwwwwwGW',
      'GGGGGGkkGGGGGG',
      'GGGGGkGGkGGGGG',
      'WGWWWkkkkWWWGW',
      'WGwwwwwwwwwwGW',
      'WGWWWWWWWWWWGW',
      'WGwwwwwwwwwwGW',
      'GGGGGGGGGGGGGG',
      '.gggggggggggg.',
    ]],
  },
  'chest-open': {
    pal: { W: '#92400e', w: '#78350f', G: '#f5c542', g: '#b45309', Y: '#fff3b0', y: '#fde047' },
    frames: [[
      '.WWWWWWWWWWWW.',
      'WGwwwwwwwwwwGW',
      'GGGGGGGGGGGGGG',
      '..............',
      '.YyYYyYYyYYyY.',
      'WyYYYYYYYYYYyW',
      'WGWWWWWWWWWWGW',
      'WGwwwwwwwwwwGW',
      'WGWWWWWWWWWWGW',
      'WGwwwwwwwwwwGW',
      'GGGGGGGGGGGGGG',
      '.gggggggggggg.',
    ]],
  },
};

// Palette swaps for enemy variants.
const VARIANTS = {
  'slime-green': ['slime', {}],
  'slime-red': ['slime', { O: '#7f1d1d', M: '#ef4444', L: '#fca5a5' }],
  'slime-dark': ['slime', { O: '#020617', M: '#334155', L: '#64748b', W: '#e9d5ff', k: '#a855f7' }],
};

const cache = new Map();

function validate(name, frames) {
  const w = frames[0][0].length;
  for (const f of frames) for (const row of f) {
    if (row.length !== w) console.warn(`[sprites] ${name}: row "${row}" is ${row.length} wide, expected ${w}`);
  }
}

/**
 * Returns { url, w, h, frames } for a sprite. `overrides` recolours palette entries.
 */
export function sprite(name, overrides = null) {
  const key = overrides ? name + JSON.stringify(overrides) : name;
  if (cache.has(key)) return cache.get(key);

  let base = name;
  let pal = null;
  if (VARIANTS[name]) { base = VARIANTS[name][0]; pal = VARIANTS[name][1]; }
  const art = ART[base];
  if (!art) throw new Error(`Unknown sprite ${name}`);
  validate(base, art.frames);
  const colors = { ...art.pal, ...pal, ...overrides };
  const h = art.frames[0].length;
  const w = Math.max(...art.frames[0].map((r) => r.length));
  const n = art.frames.length;

  const canvas = document.createElement('canvas');
  canvas.width = w * n;
  canvas.height = h;
  const g = canvas.getContext('2d');
  art.frames.forEach((frame, fi) => {
    frame.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = colors[row[x]];
        if (!c) continue;
        g.fillStyle = c;
        g.fillRect(fi * w + x, y, 1, 1);
      }
    });
  });
  const out = { url: canvas.toDataURL('image/png'), w, h, frames: n };
  cache.set(key, out);
  return out;
}

/** Paint a sprite onto an element (as a pixelated background) at an integer scale. */
export function applySprite(el, name, scale = 3, overrides = null) {
  const s = sprite(name, overrides);
  el.style.width = `${s.w * scale}px`;
  el.style.height = `${s.h * scale}px`;
  el.style.backgroundImage = `url(${s.url})`;
  el.style.backgroundSize = `${s.w * s.frames * scale}px ${s.h * scale}px`;
  el.style.setProperty('--fw', `${s.w * scale}px`);
  el.style.setProperty('--frames', s.frames);
  el.classList.add('sprite');
  el.classList.toggle('sprite--anim', s.frames > 1);
  return s;
}

export function hasSprite(name) {
  return !!(ART[name] || VARIANTS[name]);
}
