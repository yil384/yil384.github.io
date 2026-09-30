// regions/art-im.js: sprite grids for the IM chat maze (original designs; no app logos).
const buddy = (body, dark) => ({
  pal: { B: body, b: dark, W: '#ffffff', k: '#0f172a', P: '#f9a8d4' },
  frames: [
    ['.BBBBBB.', 'BBBBBBBB', 'BWkBBWkB', 'BBBBBBBB', 'BPBkkBPB', 'BBBBBBBB', '.BBBBBB.', 'bB......', '.b.b..b.'],
    ['.BBBBBB.', 'BBBBBBBB', 'BWkBBWkB', 'BBBBBBBB', 'BPBkkBPB', 'BBBBBBBB', '.BBBBBB.', 'bB......', 'b...b.b.'],
  ],
});

export const IM_ART = {
  // Spam Bot: an envelope with a grin and an exclamation mark it did not earn
  'im-spam': {
    pal: { E: '#fef3c7', e: '#d6b56b', R: '#ef4444', k: '#1c1917', W: '#ffffff' },
    frames: [
      ['...R....', 'EEERREEE', 'EeEEEEeE', 'EEeWWeEE', 'EkEeeEkE', 'EEEEEEEE', 'EkkkkkkE', '.e....e.'],
      ['....R...', 'EEEERREE', 'EeEEEEeE', 'EEeWWeEE', 'EkEeeEkE', 'EEEEEEEE', 'EEkkkkEE', 'e......e'],
    ],
  },
  // Typing Indicator: a bubble with three dots, forever about to say something
  'im-typing': {
    pal: { G: '#e5e7eb', g: '#9ca3af', k: '#374151', D: '#6b7280' },
    frames: [
      ['.GGGGGGG.', 'GGGGGGGGG', 'GDGGkGGkG', 'GGGGGGGGG', '.GGGGGGG.', 'gG.......'],
      ['.GGGGGGG.', 'GGGGGGGGG', 'GkGGDGGkG', 'GGGGGGGGG', '.GGGGGGG.', 'gG.......'],
    ],
  },
  // Unread Badge: a red notification dot that follows you everywhere
  'im-unread': {
    pal: { R: '#ef4444', r: '#991b1b', W: '#ffffff', k: '#450a0a' },
    frames: [
      ['..RRR..', '.RRWRR.', 'RRRWRRR', 'RWkRWkR', 'RRRWRRR', '.RRRRR.', '..r.r..'],
      ['..RRR..', '.RRWRR.', 'RRRWRRR', 'RWkRWkR', 'RRRRRRR', '.RRWRR.', '.r...r.'],
    ],
  },
  // Dropped Connection: a ghostly plug, reconnecting…
  'im-drop': {
    pal: { S: '#cbd5e1', s: '#64748b', Y: '#fde047', W: '#ffffff', k: '#1e293b' },
    frames: [
      ['.s..s...', '.S..S...', 'SSSSSS..', 'SWkWkS.Y', 'SSSSSS.Y', 'SSkkSS..', 'S.SS.S..', '..S..S..'],
      ['..s..s..', '..S..S..', '.SSSSSS.', '.SWkWkSY', '.SSSSSS.', '.SSkkSSY', '.S.SS.S.', '.S..S...'],
    ],
  },
  // Spam Relay: a mast that forwards spam to everyone
  'im-relay': {
    pal: { M: '#64748b', m: '#334155', R: '#f43f5e', W: '#fecdd3', Y: '#fde047' },
    frames: [
      ['...R...', '..RWR..', '...M...', '.Y.M.Y.', 'Y..M..Y', '..MMM..', '...M...', '..MMM..', '.M.M.M.', '.M.M.M.', 'mmmmmmm'],
      ['...W...', '..RRR..', '...M...', 'Y..M..Y', '.Y.M.Y.', '..MMM..', '...M...', '..MMM..', '.M.M.M.', '.M.M.M.', 'mmmmmmm'],
    ],
  },
  // a thumbs-up reaction (ambient)
  'im-thumb': {
    pal: { Y: '#facc15', y: '#ca8a04', k: '#422006' },
    frames: [
      ['...Y..', '..YY..', 'YYYYYY', 'YkYkYy', 'YYYYYy', 'YYYYy.'],
      ['..Y...', '..YY..', 'YYYYYY', 'YkYkYy', 'YYYYYy', '.YYYy.'],
    ],
  },
  // The Group Chat: a giant bubble with a 99+ badge and opinions
  'im-group': {
    pal: { W: '#f8fafc', w: '#cbd5e1', R: '#ef4444', r: '#b91c1c', k: '#0f172a', G: '#4ade80', B: '#60a5fa', O: '#fb923c' },
    frames: [
      [
        '............RRRR..',
        '..WWWWWWWWWRRWWRR.',
        '.WWWWWWWWWWRRWWRR.',
        'WWWWWWWWWWWWRRRR..',
        'WWGGWWBBWWOOWWWWW.',
        'WWGGWWBBWWOOWWWWW.',
        'WWWWWWWWWWWWWWWWW.',
        'WWWkkWWWWWWWkkWWW.',
        'WWWkkWWWWWWWkkWWW.',
        'WWWWWWWWWWWWWWWWW.',
        'WWWWWkkkkkkkWWWWW.',
        'WWWWkWWWWWWWkWWWW.',
        '.WWWWWWWWWWWWWWW..',
        '..wWWWWWWWWWWWw...',
        '.wWw..............',
        'ww................',
      ],
      [
        '............RRRR..',
        '..WWWWWWWWWRRWWRR.',
        '.WWWWWWWWWWRRWWRR.',
        'WWWWWWWWWWWWRRRR..',
        'WWBBWWOOWWGGWWWWW.',
        'WWBBWWOOWWGGWWWWW.',
        'WWWWWWWWWWWWWWWWW.',
        'WWWkkWWWWWWWkkWWW.',
        'WWWkkWWWWWWWkkWWW.',
        'WWWWWWWWWWWWWWWWW.',
        'WWWWWWkkkkkWWWWWW.',
        'WWWWWkWWWWWkWWWWW.',
        '.WWWWWWWWWWWWWWW..',
        '..wWWWWWWWWWWWw...',
        '..wWw.............',
        '.ww...............',
      ],
    ],
  },
  'im-ping': buddy('#60a5fa', '#1d4ed8'),
  'im-pong': buddy('#fb923c', '#c2410c'),
  // Echo: an echo server, rings of sound around a small bubble
  'im-echo': {
    pal: { V: '#a78bfa', v: '#6d28d9', W: '#ffffff', k: '#1e1b4b', R: '#ddd6fe' },
    frames: [
      ['R.......R', '.R.VVV.R.', '..VVVVV..', 'R.VWkWkVR', '..VVVVV..', '..VVkVV..', '.R.VVV.R.', 'R..v....R'],
      ['.R.....R.', 'R..VVV..R', '..VVVVV..', '.RVWkWkV.', '..VVVVV..', '..VkkkV..', 'R..VVV..R', '.R.v...R.'],
    ],
  },
  // a message you are carrying (floats over your head) and message markers
  'im-note': {
    pal: { G: '#4ade80', g: '#15803d', W: '#f0fdf4' },
    frames: [['GGGGGG', 'GWWWWG', 'GWGGWG', 'GGGGGG', 'gG....']],
  },
};
