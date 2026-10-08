// Image art for the opening: the user's LEGO Ninjago renders (sources in assets/img/intro/src/, exported to WebP by
// tools/dev/introart.py, which also prints the anchors used here). The look is all or nothing: the scene uses the
// images only if every CORE slot has decoded when the intro starts; otherwise scene.js draws its own stand-ins (an
// original green ninja and "Lord Deadline") for that whole visit, never a mix. The VS portraits may still be on their
// way then: until they arrive the VS card shows the fight images. Fractions are of each image's own width / height.
// Tests can swap any src via window.__introArt ({ slot: url }, null turns a slot off).
const DIR = 'assets/img/intro/';
const V = '?v=1';

export const ART = {
  // the Green Ninja on the rooftop; foot = the balance point between the feet; h = height / the drawn ninja's
  hero: { src: `${DIR}hero.webp${V}`, foot: [0.532, 0.992], h: 1.5 },
  // mid-leap with the energy swirl, drawn centred on the leap arc and inside the tornado
  heroJump: { src: `${DIR}hero-jump.webp${V}`, centre: [0.509, 0.513], h: 1.65 },
  // VS card, left panel, bottom-anchored; h = share of the panel height
  heroVs: { src: `${DIR}hero-vs.webp${V}`, h: 0.96 },
  // Garmadon rising behind the city. beam = the energy ball between his lower hands (his attack starts there and it
  // is what the layout parks above the rooftops), eyes = the two red eyes, horns = the helmet tips (lightning)
  villain: { src: `${DIR}garmadon.webp${V}`, beam: [0.497, 0.717], eyes: [[0.454, 0.36], [0.524, 0.359]], horns: [[0.31, 0.02], [0.69, 0.02]] },
  // VS card, right panel
  villainVs: { src: `${DIR}garmadon-vs.webp${V}`, h: 0.98 },
  // LEGO Ninjago City and UC San Diego with a transparent sky; the moon was cut out of it into its own sprite so the
  // villain can rise between the two. moon.at = the moon's centre and radius in the skyline (fractions of its width
  // and height, radius of its width); the sprite is the whole disc with a 6 px rim, drawn at the skyline's scale.
  skyline: { src: `${DIR}skyline.webp${V}` },
  moon: { src: `${DIR}moon.webp${V}`, at: [0.6539, 0.2767, 0.1075] },
  names: {
    hero: ['THE GREEN NINJA', 'YICHEN LIN · PH.D. STUDENT · UC SAN DIEGO', 'YICHEN LIN · UC SAN DIEGO'],
    villain: ['LORD DEADLINE', 'FOUR ARMS. INFINITE DUE DATES.'],
    villainArt: ['LORD GARMADON', 'FOUR ARMS. INFINITE DUE DATES.'],
    place: ['UC SAN DIEGO · NINJA CITY', 'LA JOLLA · 23:59 AoE'],
    placeArt: ['UC SAN DIEGO · NINJAGO CITY', 'LA JOLLA · 23:59 AoE'],
  },
};

/** The slots the scene needs before it switches to the images. */
export const CORE = ['hero', 'heroJump', 'villain', 'skyline', 'moon'];

/**
 * Start loading every slot that has a file. Returns { art, core, all, any }: `art` fills in (slot -> decoded image) as
 * each one arrives; `core` resolves when the CORE slots have all arrived or one has failed; `all` when every slot is
 * settled.
 */
export function loadArt() {
  const over = (typeof window !== 'undefined' && window.__introArt) || {};
  const art = {};
  const jobs = {};
  for (const k of Object.keys(ART)) {
    if (!ART[k] || typeof ART[k] !== 'object' || !('src' in ART[k])) continue;
    const src = k in over ? over[k] : ART[k].src;
    if (!src) continue;
    const im = new Image();
    im.decoding = 'async';
    if ('fetchPriority' in im) im.fetchPriority = 'high';
    im.src = src;
    jobs[k] = im.decode().then(() => { art[k] = im; return true; }).catch(() => { console.warn(`[intro] art "${k}" did not load:`, src); return false; });
  }
  const core = CORE.every((k) => jobs[k])
    ? new Promise((res) => {
      let left = CORE.length;
      for (const k of CORE) jobs[k].then((ok) => { if (!ok) res(false); else if (--left === 0) res(true); });
    })
    : Promise.resolve(false);
  return { art, core, all: Promise.all(Object.values(jobs)), any: Object.keys(jobs).length > 0 };
}
