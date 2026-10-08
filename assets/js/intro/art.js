// Image art for the opening: the user's LEGO Ninjago renders (sources in assets/img/intro/src/, exported to WebP by
// tools/dev/introart.py, which also prints the anchors used here). The intro plays only once every CORE slot has
// decoded (play.js waits a moment for them; if they do not make it, the visitor goes straight to the page). The drawn
// stand-ins in scene.js (an original green ninja and "Lord Deadline") are kept for tests only (?introArt=0). The VS
// portraits may still be on their way at the VS card: until they arrive it shows the fight images. Fractions are of
// each image's own width / height. Tests can swap any src via window.__introArt ({ slot: url }, null turns it off).
// Bump V when a file changes (index.html's preload list carries the same ?v=).
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

/** The slots the fight needs (index.html preloads these files while the page parses: keep the two lists in step). */
export const CORE = ['hero', 'heroJump', 'villain', 'skyline', 'moon'];
/** Needed only at the VS card, fetched once the CORE art is in (until they arrive the card uses the fight images). */
const LATE = ['heroVs', 'villainVs'];

/**
 * Start loading the art. Returns { art, core, late }: `art` fills in (slot -> decoded image) as files arrive; `core`
 * resolves true once every CORE slot has decoded (false if one fails); `late()` starts the VS portraits.
 * Images are decoded off the main thread into ImageBitmaps (fetch -> blob -> createImageBitmap): an <img> that is only
 * decode()d gets decoded again, synchronously, the first time it is drawn, which stalls the frame it first appears in.
 */
export function loadArt() {
  const over = window.__introArt || {};
  const art = {};
  const get = (k, priority) => {
    const src = k in over ? over[k] : ART[k]?.src;
    if (!src) return Promise.resolve(false);
    return decode(src, priority).then((im) => { art[k] = im; return true; })
      .catch((err) => { console.warn(`[intro] art "${k}" did not load:`, src, err?.message || err); return false; });
  };
  const core = Promise.all(CORE.map((k) => get(k, 'high'))).then((ok) => ok.every(Boolean));
  let late = null;
  return { art, core, late: () => (late ??= Promise.all(LATE.map((k) => get(k, 'low')))) };
}

async function decode(src, priority) {
  if (typeof window.createImageBitmap === 'function' && typeof window.fetch === 'function') {
    let blob = null;
    try {
      // the request index.html's head script already started for this file, if any
      const early = window.__ylArt?.[src];
      if (early) delete window.__ylArt[src];
      const r = await (early || window.fetch(src, { priority }));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      blob = await r.blob();
    } catch (err) { if (/^HTTP/.test(err?.message)) throw err; }
    if (blob) {
      try { return await window.createImageBitmap(blob); } catch { /* a browser that cannot: the <img> way below */ }
    }
  }
  const im = new Image();
  im.decoding = 'async';
  im.src = src;
  await im.decode();
  return im;
}
