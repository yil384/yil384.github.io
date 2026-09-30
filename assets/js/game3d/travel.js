// Getting between the hub and the regions.
//   travel(to, at)   fade out, build the region if needed, switch what is visible/updated, move the
//                    sky and sun, drop the player on safe ground, snap the camera, bring the companion,
//                    fade in. `at`: arrival point (region-local; world coordinates for the hub).
//   hub doors        every CV landmark on the island opens onto its region (see DOORS)
//   map (M)          the hub and every discovered region; click one to travel there
//   boat (pier)      the same list, from the end of the Scripps pier
//   respawnHere()    falling off an island / game over: back to this region's spawn, nothing lost
import { S, save } from './state.js';
import { emit, on } from './bus.js';
import { where } from './where.js';
import { player, grace } from './player.js';
import { LAYOUT } from './layout.js';
import { openModal, closeModal, closeAllModals } from './modal.js';
import { toast, banner } from './notify.js';
import { sfx } from './audio.js';
import { h, icon } from './util.js';
import { REGIONS, ensureRegion, regionDef, regionName, regionEntered, regionLeft, interactable, trigger, allBuilt, unlockGlider } from './regions.js';
import { hubIllustrated, regionMapCanvas } from './mapart.js';
import { ROAD, hasItem } from './road.js';
import { clearHostileProjectiles } from './combat.js';
import { clearFoeHazards } from './foes.js';

export const HUB_SPAWN = { x: 1.5, z: 6 };
const HUB_BOUND = 100;

// Hub landmark -> region. Positions are world coordinates on the island; `walk` doors fire when you
// pass through (the gate's centre arch), the rest on E.
/** Door colours (the flags use their own cloth colour). */
export const DOOR_COLOURS = {
  tsinghua: '#b98cff', picasso: '#a78bfa', stacks: '#fbbf24',
  starry: '#fb923c', im: '#34d399', oj: '#f472b6', triton: '#60a5fa',
};
export function doorList() {
  const M = LAYOUT.monuments, flag = (id) => LAYOUT.flags.find((f) => f.id === id);
  const G = LAYOUT.gate, C = LAYOUT.cse;
  const list = [
    { to: 'tsinghua', x: G.x, z: G.z - 0.5, r: 1.4, walk: true, label: '二校门 · to Tsinghua', plateY: 10.5 },
    { to: 'picasso', x: C.x, z: C.z + 4.6, r: 2.4, label: 'CSE · Picasso Lab', prompt: 'E · enter the lab' },
    ...[['samsung', 'flag-samsung'], ['metabit', 'flag-metabit'], ['timi', 'flag-tencent'], ['hotstar', 'flag-hotstar'], ['lark', 'flag-lark']].map(([to, id]) => {
      const f = flag(id);
      return { to, x: f.x, z: f.z, r: 2.6, label: `${regionName(to)}`, prompt: 'E · touch the flag', plateY: 5.2 };
    }),
    { to: 'starry', x: M.starry.x, z: M.starry.z, r: 4.2, label: 'Starry-Next', prompt: 'E · descend into the kernel', plateY: 9 },
    { to: 'im', x: M.im.x, z: M.im.z, r: 5.8, label: 'IM System', prompt: 'E · open a WebSocket', plateY: 8 },
    { to: 'oj', x: M.oj.x, z: M.oj.z, r: 4.2, label: 'CST-OJ', prompt: 'E · submit yourself', plateY: 8 },
    { to: 'triton', x: M.triton.x, z: M.triton.z, r: 4.2, label: 'TritonGym', prompt: 'E · enter the arena', plateY: 9.5 },
    { to: 'stacks', x: LAYOUT.tower.x, z: LAYOUT.tower.z + 4.2, r: 2.4, label: 'Geisel · the Stacks', prompt: 'E · go down to the stacks', plateY: 4 },
  ];
  const flagFor = { samsung: 'flag-samsung', metabit: 'flag-metabit', timi: 'flag-tencent', hotstar: 'flag-hotstar', lark: 'flag-lark' };
  for (const d of list) d.colour = flagFor[d.to] ? flag(flagFor[d.to]).colour : DOOR_COLOURS[d.to] || '#a78bfa';
  return list;
}

export function createTravel(env) {
  // env: { world, hubGroup, scene, setSkyOrigin(ox, oz), applySky(sky|null), rig, placeBuddy, fadeEl, freeze(bool), hubCtx }
  let busy = false;

  function safeSpot(x, z) {
    const ok = (px, pz) => env.world.height(px, pz) > -Infinity && !env.world.isBlocked(px, pz);
    if (ok(x, z)) return { x, z };
    for (let r = 1; r <= 14; r += 0.5) for (let a = 0; a < 16; a++) {
      const px = x + Math.cos((a / 16) * Math.PI * 2) * r, pz = z + Math.sin((a / 16) * Math.PI * 2) * r;
      if (ok(px, pz)) return { x: px, z: pz };
    }
    return { x, z };
  }
  function spawnOf(id) {
    if (id === 'hub') return { x: HUB_SPAWN.x, z: HUB_SPAWN.z };
    const def = regionDef(id);
    const [ox, oz] = def.origin;
    return { x: ox + (def.spawn?.[0] ?? 0), z: oz + (def.spawn?.[1] ?? 0) };
  }
  function fade(on) {
    return new Promise((res) => {
      if (!env.fadeEl) return res();
      env.fadeEl.classList.toggle('is-on', on);
      setTimeout(res, on ? 240 : 0);
    });
  }

  /** Make `id` the live region (visibility, sky, bounds). No player movement. */
  function activate(id) {
    const from = where.id;
    if (from !== id) regionLeft(from);
    const def = id === 'hub' ? null : regionDef(id);
    where.id = id;
    where.ox = def ? def.origin[0] : 0;
    where.oz = def ? def.origin[1] : 0;
    where.bound = def ? (def.bound || def.size * 0.5 + 40) : HUB_BOUND;
    env.hubGroup.visible = id === 'hub';
    for (const ctx of allBuilt()) ctx.group.visible = ctx.id === id;
    env.setSkyOrigin(where.ox, where.oz);
    env.applySky(def?.sky || null);
    player.ride = null;
  }

  /**
   * travel(to, at?, { instant, via }) -> Promise<boolean>
   * `at`: [x, z] arrival (local to the target region; world coordinates for the hub).
   */
  async function travel(to, at = null, { instant = false, via = '' } = {}) {
    if (busy) return false;
    if (to !== 'hub' && !REGIONS[to] && !regionDef(to)) { console.warn('[travel] unknown region', to); return false; }
    busy = true;
    try {
      closeAllModals();
      let ctx = null;
      if (to !== 'hub') {
        const slow = setTimeout(() => toast(`Travelling to ${regionName(to)}…`, { icon: 'magic-portal' }), 350);
        ctx = await ensureRegion(to);
        clearTimeout(slow);
        if (!ctx) {
          sfx('error');
          toast(`${regionName(to)} is still under construction. Come back soon!`, { icon: 'hazard-sign' });
          return false;
        }
      }
      if (!instant) { sfx('portal'); await fade(true); }
      const from = where.id;
      activate(to);
      const def = to === 'hub' ? null : regionDef(to);
      let dest = at ? { x: at[0] + (def ? def.origin[0] : 0), z: at[1] + (def ? def.origin[1] : 0) } : spawnOf(to);
      dest = safeSpot(dest.x, dest.z);
      player.x = dest.x; player.z = dest.z; player.y = env.world.surfaceY(dest.x, dest.z);
      player.vx = player.vz = player.vy = 0;
      player.grounded = true;
      if (player.vehicle && player.vehicle !== 'car') { player.y += 1; player.grounded = false; }
      env.placeBuddy();
      env.rig.snap(player);
      grace(1500);
      clearHostileProjectiles();
      clearFoeHazards();
      if (!S.world.discovered[to]) { S.world.discovered[to] = true; emit('region:discovered', to); }
      S.world.resume = to === 'hub' ? null : { id: to, x: player.x - where.ox, z: player.z - where.oz };
      save();
      regionEntered(to);
      emit('travel', { from, to, via });
      if (!instant) {
        setTimeout(() => fade(false), 60);
        if (from !== to) banner(regionName(to), to === 'hub' ? 'The UCSD island' : (def?.subtitle || 'M · map  ·  every region has a portal home'), to === 'hub' ? 'magic-portal' : 'treasure-map');
      }
      return true;
    } finally {
      busy = false;
    }
  }

  /** Back to the live region's spawn (fell off, or got up after a game over). Nothing is lost. */
  function respawnHere(reason = 'fall') {
    const id = where.id;
    const sp = spawnOf(id);
    const go = () => {
      const d = safeSpot(sp.x, sp.z);
      player.x = d.x; player.z = d.z; player.y = env.world.surfaceY(d.x, d.z);
      player.vx = player.vz = player.vy = 0; player.grounded = true;
      if (player.vehicle && player.vehicle !== 'car') player.y += 1;
      env.placeBuddy();
      env.rig.snap(player);
      grace(2000);
      fade(false);
      if (reason === 'fall') toast('Caught by a friendly breeze. Back at the portal.', { icon: 'magic-portal' });
    };
    fade(true).then(go);
  }

  // ---------------------------------------------------------------- hub doors
  const doors = doorList();
  for (const d of doors) {
    if (d.walk) {
      trigger(env.hubCtx, { x: d.x, z: d.z, r: d.r, onEnter: () => travel(d.to, null, { via: 'door' }) });
      interactable(env.hubCtx, { x: d.x, z: d.z, r: d.r + 1.2, label: d.label, prompt: 'walk through · or E', plateY: d.plateY, see: 1.5, onInteract: () => travel(d.to, null, { via: 'door' }) });
    } else {
      // (the signpost names the door from afar; the plate only appears once you are at it)
      interactable(env.hubCtx, { x: d.x, z: d.z, r: d.r, label: d.label, prompt: d.prompt, plateY: d.plateY ?? 3, see: 0.8, onInteract: () => travel(d.to, null, { via: 'door' }) });
    }
  }
  // the Torrey Pines bluff summit hands out the glider (so does waving at a paraglider from the page)
  const peak = env.world.hub.ZONES.peak;
  trigger(env.hubCtx, { x: peak.x, z: peak.z, r: 3.2, minY: 8, onEnter: () => unlockGlider() });
  // …and so does the Torrey Pines Gliderport on the mesa (the cliff down to Black's Beach is right there)
  const GP = LAYOUT.gliderport;
  trigger(env.hubCtx, { x: GP.x, z: GP.z, r: 6, minY: 9, onEnter: () => unlockGlider() });
  on('egg', (id) => { if (id === 'glider') unlockGlider(); });
  if (S.eggs.glider && !S.world.glider) { S.world.glider = true; save(); }
  // the boat at the end of the Scripps pier
  const P = LAYOUT.pier;
  interactable(env.hubCtx, { x: P.x + 20.5, z: P.z + 3, r: 2.4, label: 'The boat', prompt: 'E · where to?', plateY: 3, onInteract: () => openMap({ boat: true }) });

  // ---------------------------------------------------------------- map
  // Left: an illustrated map of where you are (the island drawn from its terrain: districts, the
  // shuttle loop, every door with its colour and a tick once visited, you). Right: every region,
  // discovered or not, with its Road to Dr. items, and the Road to Dr. itself.
  function openMap({ boat = false } = {}) {
    const ids = ['hub', ...Object.keys(REGIONS).filter((id) => id !== 'sandbox' || S.world.discovered.sandbox)];
    const itemFor = (id) => ROAD.filter((r) => r.region === id);
    const go = (id) => { closeModal('map'); travel(id, null, { via: boat ? 'boat' : 'map' }); };
    const colourOf = Object.fromEntries(doors.map((d) => [d.to, d.colour]));
    openModal({
      id: 'map', title: boat ? 'The boat · where to?' : 'World map', className: 'wide-panel map-panel',
      body: (b) => {
        const inHub = where.id === 'hub';
        const def = inHub ? null : regionDef(where.id);
        const art = inHub ? hubIllustrated(env.world, 5) : def ? regionMapCanvas(env.world, def, 480) : null;
        const map = h('div', { class: `wmap2__map${inHub ? '' : ' is-region'}` });
        if (art) {
          const cv = h('canvas', { class: 'wmap2__canvas', width: art.canvas.width, height: art.canvas.height, 'aria-label': `Map of ${regionName(where.id)}` });
          cv.getContext('2d').drawImage(art.canvas, 0, 0);
          map.append(cv);
          const at = (x, z) => ({ left: `${((x - (art.ox || 0) + art.half + 0.5) / art.size) * 100}%`, top: `${((z - (art.oz || 0) + art.half + 0.5) / art.size) * 100}%` });
          if (inHub) {
            for (const d of doors) {
              const known = !!S.world.discovered[d.to];
              const items = itemFor(d.to), got = items.filter((r) => hasItem(r.id)).length;
              map.append(h('button', {
                type: 'button', class: `wmap2__door${known ? ' is-known' : ''}${items.length && got === items.length ? ' is-done' : ''}`,
                style: { ...at(d.x, d.z), '--dc': d.colour },
                title: `${regionName(d.to)} · ${known ? 'visited: click to travel' : `not visited yet: ${REGIONS[d.to]?.door || 'find its door'}`}`,
                'aria-label': `${regionName(d.to)}${known ? '' : ' (not visited yet)'}`,
                onclick: (e) => {
                  // touch: the first tap names the door (no hover on a phone), the second one travels
                  const b = e.currentTarget;
                  if (matchMedia('(pointer: coarse)').matches && !b.classList.contains('is-picked')) {
                    for (const o of map.querySelectorAll('.wmap2__door.is-picked')) o.classList.remove('is-picked');
                    b.classList.add('is-picked');
                    return;
                  }
                  if (known) go(d.to); else toast(`Find it on the island: ${REGIONS[d.to]?.door || 'its door'}. Walk there and press E.`, { icon: 'treasure-map' }); },
              }, h('span', { class: 'wmap2__door-dot' }, known ? '✓' : ''), h('span', { class: 'wmap2__door-name' }, regionName(d.to))));
            }
            const P = LAYOUT.pier;
            map.append(h('span', { class: 'wmap2__boat', style: at(P.x + 20.5, P.z + 3), title: 'The boat: sails to every place you have visited' }, icon('treasure-map', { size: 14 })));
          }
          map.append(h('span', { class: 'wmap2__me', style: { ...at(player.x, player.z), transform: `translate(-50%, -50%) rotate(${Math.PI - player.yaw}rad)` }, title: 'You are here' }));
        }
        const legend = inHub
          ? h('p', { class: 'wmap2__legend muted small' },
            h('span', { class: 'wmap2__key wmap2__key--door' }), ' door (✓ visited) ',
            h('span', { class: 'wmap2__key wmap2__key--me' }), ' you ',
            h('span', { class: 'wmap2__key wmap2__key--loop' }), ' shuttle loop')
          : h('p', { class: 'wmap2__legend muted small' }, h('span', { class: 'wmap2__key wmap2__key--me' }), ` you · ${regionName(where.id)} · every region has a portal home`);
        // the regions, and the Road to Dr.
        const list = h('ul', { class: 'wmap2__list', role: 'list' });
        for (const id of ids) {
          const known = !!S.world.discovered[id] || id === 'hub';
          const here = where.id === id;
          const items = itemFor(id), got = items.filter((r) => hasItem(r.id)).length;
          const sub = here ? 'you are here' : !known ? `door: ${REGIONS[id]?.door || ''}` : items.length ? `${got}/${items.length} ${items[0].kind.toLowerCase()}${items.length > 1 ? 's' : ''}` : id === 'hub' ? 'the UCSD island' : 'visited';
          list.append(h('li', null, h('button', {
            type: 'button', class: `wmap2__row${known ? ' is-known' : ''}${here ? ' is-here' : ''}${id === 'hub' ? ' is-hub' : ''}${items.length && got === items.length ? ' is-done' : ''}`,
            style: { '--dc': id === 'hub' ? '#f2c14e' : colourOf[id] || '#94a3b8' }, disabled: !known || here,
            title: known ? `${regionName(id)}${here ? ' (you are here)' : ''}` : `Undiscovered · door: ${REGIONS[id]?.door || ''}`,
            onclick: () => go(id),
          }, h('span', { class: 'wmap2__dot' }), h('b', null, known ? regionName(id) : '? ? ?'), h('small', null, sub))));
        }
        const gotAll = ROAD.filter((r) => hasItem(r.id)).length;
        const road = h('div', { class: 'wmap2__road' },
          h('p', { class: 'wmap2__road-head' }, icon('graduation-cap', { size: 16 }), h('b', null, ' Road to Dr. '), h('span', { class: 'muted' }, `${gotAll} / ${ROAD.length}`)),
          h('div', { class: 'wmap2__bar' }, h('i', { style: { width: `${(gotAll / ROAD.length) * 100}%` } })),
          h('div', { class: 'wmap2__items' }, ...ROAD.map((r) => h('span', { class: `wmap2__item${hasItem(r.id) ? ' is-got' : ''}`, title: `${r.name}${hasItem(r.id) ? ' · collected' : ` · ${regionName(r.region)}`}` }, icon(r.icon, { size: 16 })))));
        b.append(h('div', { class: 'wmap2' },
          h('div', { class: 'wmap2__left' }, map, legend),
          h('div', { class: 'wmap2__side' },
            h('p', { class: 'muted small' }, boat ? 'The skipper knows every island you have already visited.' : `You are at ${regionName(where.id)}. Click a visited place to travel; new ones open from their door on the island.`),
            list, road)));
      },
    });
  }

  return { travel, respawnHere, openMap, activate, spawnOf, doors, get busy() { return busy; } };
}

