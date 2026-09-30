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
import { ROAD, hasItem } from './road.js';
import { clearHostileProjectiles } from './combat.js';
import { clearFoeHazards } from './foes.js';

export const HUB_SPAWN = { x: 1.5, z: 6 };
const HUB_BOUND = 70;

// Hub landmark -> region. Positions are world coordinates on the island; `walk` doors fire when you
// pass through (the gate's centre arch), the rest on E.
function doorList() {
  const M = LAYOUT.monuments, flag = (id) => LAYOUT.flags.find((f) => f.id === id);
  const G = LAYOUT.gate, C = LAYOUT.cse;
  return [
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
      interactable(env.hubCtx, { x: d.x, z: d.z, r: d.r + 1.2, label: d.label, prompt: 'walk through · or E', plateY: d.plateY, onInteract: () => travel(d.to, null, { via: 'door' }) });
    } else {
      interactable(env.hubCtx, { x: d.x, z: d.z, r: d.r, label: d.label, prompt: d.prompt, plateY: d.plateY ?? 3, onInteract: () => travel(d.to, null, { via: 'door' }) });
    }
  }
  // the Torrey Pines bluff summit hands out the glider (so does waving at a paraglider from the page)
  const peak = env.world.hub.ZONES.peak;
  trigger(env.hubCtx, { x: peak.x, z: peak.z, r: 3.2, minY: 8, onEnter: () => unlockGlider() });
  on('egg', (id) => { if (id === 'glider') unlockGlider(); });
  if (S.eggs.glider && !S.world.glider) { S.world.glider = true; save(); }
  // the boat at the end of the Scripps pier
  const P = LAYOUT.pier;
  interactable(env.hubCtx, { x: P.x + 20.5, z: P.z + 3, r: 2.4, label: 'The boat', prompt: 'E · where to?', plateY: 3, onInteract: () => openMap({ boat: true }) });

  // ---------------------------------------------------------------- map
  function openMap({ boat = false } = {}) {
    const ids = ['hub', ...Object.keys(REGIONS).filter((id) => id !== 'sandbox' || S.world.discovered.sandbox)];
    const xs = ids.map((id) => (id === 'hub' ? 0 : REGIONS[id].origin[0])), zs = ids.map((id) => (id === 'hub' ? 0 : REGIONS[id].origin[1]));
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const pos = (id) => {
      const [x, z] = id === 'hub' ? [0, 0] : REGIONS[id].origin;
      return { left: `${8 + ((x - minX) / Math.max(1, maxX - minX)) * 84}%`, top: `${10 + ((z - minZ) / Math.max(1, maxZ - minZ)) * 78}%` };
    };
    const itemFor = (id) => ROAD.filter((r) => r.region === id);
    openModal({
      id: 'map', title: boat ? 'The boat · where to?' : 'World map', className: 'wide-panel map-panel',
      body: (b) => {
        b.append(h('p', { class: 'muted small' }, boat ? 'The skipper knows every island you have already visited.' : 'Discovered places: click to travel. Undiscovered ones open from their door on the island.'));
        const map = h('div', { class: 'wmap', role: 'list' });
        for (const id of ids) {
          const known = !!S.world.discovered[id];
          const here = where.id === id;
          const items = itemFor(id);
          const got = items.filter((r) => hasItem(r.id)).length;
          const node = h('button', {
            type: 'button', role: 'listitem', class: `wmap__isle${known ? ' is-known' : ''}${here ? ' is-here' : ''}${id === 'hub' ? ' is-hub' : ''}`,
            style: pos(id), disabled: !known || here,
            title: known ? `${regionName(id)}${here ? ' (you are here)' : ''}` : `Undiscovered · door: ${REGIONS[id]?.door || ''}`,
            onclick: () => { closeModal('map'); travel(id, null, { via: boat ? 'boat' : 'map' }); },
          }, h('b', null, known ? regionName(id) : '? ? ?'), items.length ? h('small', null, `${got}/${items.length} ${items[0].kind.toLowerCase()}${items.length > 1 ? 's' : ''}`) : null);
          map.append(node);
        }
        b.append(map);
        const got = ROAD.filter((r) => hasItem(r.id)).length;
        b.append(h('p', { class: 'wmap__legend' }, icon('graduation-cap', { size: 16 }), ` Road to Dr. · ${got} / ${ROAD.length}`, h('span', { class: 'muted' }, ` · you are at ${regionName(where.id)}`)));
      },
    });
  }

  return { travel, respawnHere, openMap, activate, spawnOf, doors, get busy() { return busy; } };
}

