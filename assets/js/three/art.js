// Original pixel-art definitions used by the 3D layer. Each sprite is an ASCII grid; the voxel
// builder extrudes it into a small 3D model. '.' is transparent, other characters index `pal`.
// All characters here are original designs for this site (no third-party IP).

export const ART = {
  // The scholar: the site owner's avatar. Indigo hat, blue robe, gold clasp.
  scholar: {
    pal: { H: '#6d6ff0', h: '#4f51c9', G: '#f2b84b', S: '#f3cfa4', k: '#3b2a20', e: '#1b1b2f', B: '#2f6fe4', b: '#1f4fb0', L: '#3f4757', f: '#1c2230', W: '#ffffff' },
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

  // Bit: the starter companion. A round, curious blue creature with a single glowing antenna.
  bit: {
    pal: { B: '#4ea3ff', b: '#2b6fd6', d: '#1b4a9c', W: '#ffffff', e: '#101a33', A: '#ffd166', a: '#ff9f43' },
    frames: [
      [
        '.....A......',
        '.....a......',
        '...BBBBBB...',
        '..BBBBBBBB..',
        '.BBWWBBWWBB.',
        '.BBWeBBWeBB.',
        '.BBBBBBBBBB.',
        '.BBBBddBBBB.',
        '..BBBBBBBB..',
        '...bBBBBb...',
        '..bb....bb..',
        '..dd....dd..',
      ],
      [
        '.....A......',
        '.....a......',
        '...BBBBBB...',
        '..BBBBBBBB..',
        '.BBWWBBWWBB.',
        '.BBWeBBWeBB.',
        '.BBBBBBBBBB.',
        '.BBBBddBBBB.',
        '..BBBBBBBB..',
        '...bBBBBb...',
        '...bb..bb...',
        '...dd..dd...',
      ],
    ],
  },

  // A small floating book, for the hero island.
  book: {
    pal: { C: '#b5432f', c: '#8a2f22', P: '#f5efe0', p: '#d8cfb8', G: '#f2b84b' },
    frames: [[
      'CCCCCCCCCCCC',
      'CPPPPPCPPPPC',
      'CPppPPCPPppC',
      'CPPPPPCPPPPC',
      'CPppPPCPPppC',
      'CPPPPPCPPPPC',
      'CGGGGGCGGGGC',
      'cccccccccccc',
    ]],
  },

  // A glowing crystal (emissive).
  crystal: {
    pal: { V: '#a78bfa', v: '#7c3aed', W: '#ede9fe' },
    frames: [[
      '..W..',
      '.WVW.',
      '.VVV.',
      'VVvVV',
      '.VvV.',
      '.vvv.',
      '..v..',
    ]],
  },
};
