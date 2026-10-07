// Image art for the opening (generated outside the repo: prompts and file specs in docs/dev/INTRO_ART.md).
// A slot with src: null is drawn by scene.js itself; once its file is in assets/img/intro/ and src is set, the image is
// used instead (unless it fails or is still loading when the intro first needs it: then the drawn stand-in stays for
// that visit). Fractions are of the image's own width / height. Tests can override any src via window.__introArt.
export const ART = {
  // the Green Ninja, standing on the rooftop (full body, transparent background); foot = the point between the feet
  hero: { src: null, foot: [0.5, 0.97], h: 1.15, flip: false },
  // mid-leap / spinning (full body, transparent); drawn centred on the leap arc and inside the tornado
  heroJump: { src: null, h: 1.1, flip: false },
  // VS card, left panel (waist-up, transparent); h = fraction of the panel height, bottom-anchored
  heroVs: { src: null, h: 0.94, flip: false },
  // the villain rising behind the city (waist-up, transparent); anchor goes where the drawn one has its chest,
  // beam = where his attack starts, h = height relative to the drawn one
  villain: { src: null, anchor: [0.5, 0.5], beam: [0.5, 0.5], h: 1.0, flip: false },
  // VS card, right panel (waist-up, transparent)
  villainVs: { src: null, h: 0.98, flip: false },
  // the city (wide). Transparent sky: it replaces the drawn far/mid city and the villain still rises behind it.
  // Opaque: it replaces the whole backdrop and the villain stands in front of it.
  skyline: { src: null },
  // name plates: the villain's follow the villain art in use
  names: {
    hero: ['THE GREEN NINJA', 'YICHEN LIN · PH.D. STUDENT · UC SAN DIEGO', 'YICHEN LIN · UC SAN DIEGO'],
    villain: ['LORD DEADLINE', 'FOUR ARMS. INFINITE DUE DATES.'],
    villainArt: ['LORD GARMADON', 'FOUR ARMS. INFINITE DUE DATES.'],
  },
};

/**
 * Start loading every slot that has a file. Returns { art, ready }: `art` fills in (slot -> decoded image) as each one
 * arrives, `ready` resolves when all have arrived or failed.
 */
export function loadArt() {
  const over = (typeof window !== 'undefined' && window.__introArt) || {};
  const art = {};
  const jobs = [];
  for (const k of Object.keys(ART)) {
    const src = ART[k] && typeof ART[k] === 'object' && 'src' in ART[k] ? (over[k] ?? ART[k].src) : null;
    if (!src) continue;
    const im = new Image();
    im.decoding = 'async';
    im.src = src;
    jobs.push(im.decode().then(() => { art[k] = im; }).catch(() => console.warn(`[intro] art "${k}" did not load:`, src)));
  }
  return { art, ready: Promise.all(jobs), any: jobs.length > 0 };
}
