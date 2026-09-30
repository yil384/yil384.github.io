// The director connects the page to the world.
//   page -> world:  which section / card is in the middle of the screen decides the camera shot,
//                   where the scholar stands, which landmark glows and what the islanders say.
//   world -> page:  hovering a landmark lights up its card; clicking it scrolls the card into view.
//   plus:           click-to-walk on the ground, pointer parallax, speech bubbles.
// Page markup drives it: sections carry data-shot / data-side / data-zone, cards carry data-focus,
// and data-say="npc: line" makes an islander (or "me:" the scholar, "bit:" the companion) speak.
import * as THREE from 'three/webgpu';
import { emit } from './bus.js';
import * as fx from './fx.js';
import { h } from './util.js';
import { reducedMotion } from '../three/boot.js';
import { sfx } from './audio.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createDirector({ worldEl, overlayEl, stage, rig, tour, world, player, buddy, npcs, camera, hooks = {} }) {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const compactMQ = matchMedia('(max-width: 860px)');

  let enabled = true;
  let paused = false;                 // the page asked the world to sleep (Reviewer mode)
  let pulseTimer = 0;
  let prePulse = null;
  let sections = [];
  let focusEls = [];
  let lastSect = null;
  const STEADY = new Set(['edu']);
  let currentEl = null;
  let currentKey = null;
  let currentSig = '';
  let hoverEl = null;
  let hoverTimer = 0;
  let evalQueued = false;
  let lastPointer = { x: 0, y: 0, cx: 0, cy: 0, moved: false, at: 0 };
  let ptr = { x: 0, y: 0 };
  let hovered = null;                 // { id, pickable }
  let litEl = null;
  let progress = -1;
  let maxScroll = 1;
  const measure = () => { maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight); };
  new ResizeObserver(measure).observe(document.body);
  const sayCooldown = new WeakMap();

  // ---------------------------------------------------------------- tooltip + speech bubbles
  const tip = h('div', { class: 'g__tip', hidden: true });
  overlayEl.append(tip);
  const bubbles = new Map();

  function actorPos(who) {
    if (who === 'me') return () => ({ x: player.x, y: player.y + 4.2, z: player.z });
    if (who === 'bit') return () => ({ x: buddy.x, y: buddy.y + 3.2, z: buddy.z });
    const n = npcs.find((q) => q.id === who);
    if (n) return () => ({ x: n.x, y: n.y + n.h + 1.4, z: n.z });
    return null;
  }
  /** A short speech bubble above an actor: 'me' (scholar), 'bit', or an npc id. */
  function say(who, text, ms = 5200) {
    if (paused) return;                 // nothing would move the bubble while the loop is stopped
    const pos = actorPos(who);
    if (!pos || !text) return;
    bubbles.get(who)?.remove();
    const el = h('div', { class: `g__say g__say--${who === 'me' ? 'me' : who === 'bit' ? 'bit' : 'npc'}` }, text);
    const unpin = fx.pin(el, pos, { clamp: true });
    const done = () => { el.classList.remove('is-in'); setTimeout(() => { unpin(); }, 260); };
    const rec = { remove() { clearTimeout(rec.t); unpin(); bubbles.delete(who); }, t: 0 };
    rec.t = setTimeout(() => { done(); bubbles.delete(who); }, ms);
    bubbles.set(who, rec);
    requestAnimationFrame(() => el.classList.add('is-in'));
  }

  // ---------------------------------------------------------------- scanning the page
  function scan() {
    sections = [...document.querySelectorAll('main [data-shot]')];   // not the HUD's chapter pips, which carry data-shot too
    focusEls = [...document.querySelectorAll('[data-focus]')];
  }

  function sideOf(el) {
    return el.closest('[data-side]')?.dataset.side === 'right' ? 'right' : 'left';
  }

  function pickTarget() {
    if (hoverEl) return hoverEl;
    const H = innerHeight;
    const mid = H * (compactMQ.matches ? 0.36 : 0.5);
    let best = null, bd = Infinity;
    for (const el of focusEls) {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > H) continue;
      if (!(r.top < H * 0.66 && r.bottom > H * 0.3)) continue;
      const d = Math.abs((r.top + r.bottom) / 2 - mid);
      if (d < bd) { bd = d; best = el; }
    }
    if (best) return best;
    let sec = null, sd = Infinity;
    for (const el of sections) {
      if (el.hasAttribute('data-focus')) continue;
      const r = el.getBoundingClientRect();
      const d = mid >= r.top && mid <= r.bottom ? 0 : Math.min(Math.abs(mid - r.top), Math.abs(mid - r.bottom));
      if (d < sd) { sd = d; sec = el; }
    }
    return sec;
  }

  function apply(el, { force = false, restand = false } = {}) {
    if (!el) return;
    const key = el.dataset.focus || el.dataset.shot;
    // The Education section holds one wide shot of both campuses (its rows only highlight their
    // landmark): swinging between the gate and CSE on every row made the camera and the scholar lurch.
    const sectKey = el.closest('[data-shot]')?.dataset.shot;
    const steady = STEADY.has(sectKey);
    const shot = steady ? stage.shots[sectKey] : stage.shots[key] || stage.shots[sectKey];
    if (!shot) return;
    const side = sideOf(el);
    const compact = compactMQ.matches;
    const aspect = innerWidth / Math.max(1, worldEl.clientHeight || innerHeight);   // the world layer ignores browser bars
    const sig = `${key}|${side}|${compact}|${Math.round(aspect * 8)}`;
    if (!force && sig === currentSig) return;
    const changed = key !== currentKey;
    currentSig = sig;
    currentKey = key;
    currentEl = el;

    // portrait screens see a narrower slice of the world: back off just enough to keep the subject in frame
    const distK = compact ? clamp(0.85 / aspect, 1, 1.9) : clamp(1.45 / aspect, 1, 1.5);
    rig.shot({
      ...shot,
      dist: shot.dist * distK,
      shiftX: compact ? 0 : (side === 'right' ? -1 : 1) * (shot.shiftX ?? 0.2),
      shiftY: compact ? -0.17 : 0,
    });
    stage.setFocus(steady ? key : shot.item ?? key);
    const enteredSect = sectKey !== lastSect;
    // the soundtrack of reading: a whoosh and a chime for a new section, a soft blip for each new row
    if (!force) { if (enteredSect) sfx('whoosh'); else if (changed) sfx('blip'); }
    lastSect = sectKey;
    if (changed || restand) {
      if (sectKey === 'edu' && enteredSect && !restand) eduWarp();
      else if (steady && !restand) { /* rows inside a steady section: the scholar stays put */ }
      else if (shot.stand) tour.stand(shot.stand[0], shot.stand[1], shot.face ?? null);
      const sect = el.closest('[data-shot]') || el;
      emit('shot', { key, el, zone: sect.dataset.zone || '', index: sections.indexOf(sect) });
      const line = el.dataset.say;
      if (line) {
        const last = sayCooldown.get(el) || 0;
        if (performance.now() - last > 20000) {
          sayCooldown.set(el, performance.now());
          const i = line.indexOf(':');
          setTimeout(() => { if (currentEl === el) say(line.slice(0, i).trim(), line.slice(i + 1).trim()); }, 900);
        }
      }
    }
  }

  // Tsinghua -> UC San Diego: entering Education teleports the scholar from the Second Gate to CSE
  // (at most every 10 s; otherwise they are simply already there)
  let lastWarp = -1e9;
  function eduWarp() {
    const g = stage.shots.gate?.stand, c = stage.shots.cse?.stand, cf = stage.shots.cse?.face ?? null;
    if (!g || !c) { const e = stage.shots.edu; if (e?.stand) tour.stand(e.stand[0], e.stand[1], e.face ?? null); return; }
    if (performance.now() - lastWarp < 10000) { tour.stand(c[0], c[1], cf); return; }
    lastWarp = performance.now();
    tour.warp({ x: g[0], z: g[1] }, { x: c[0], z: c[1] }, cf, () => {
      if (lastSect === 'edu') say('me', 'Tsinghua → UC San Diego. Jet lag: 15 hours. Worth it.');
    });
  }

  function evaluate() {
    evalQueued = false;
    if (!enabled) return;
    apply(pickTarget());
  }
  function queueEval() {
    if (evalQueued) return;
    evalQueued = true;
    requestAnimationFrame(evaluate);
  }

  // ---------------------------------------------------------------- page -> world
  function onScroll() { queueEval(); }
  function onResize() { measure(); queueEval(); }
  function onOver(e) {
    const el = e.target instanceof Element ? e.target.closest('[data-focus]') : null;
    if (!el || el === hoverEl) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => { hoverEl = el; stage.setHover(el.dataset.focus); queueEval(); }, 260);
  }
  function onOut(e) {
    const el = e.target instanceof Element ? e.target.closest('[data-focus]') : null;
    if (!el) return;
    if (e.relatedTarget instanceof Element && el.contains(e.relatedTarget)) return;
    clearTimeout(hoverTimer);
    if (hoverEl === el) { hoverEl = null; stage.setHover(null); queueEval(); }
  }

  // ---------------------------------------------------------------- world -> page
  function setNdc(e) {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / (worldEl.clientHeight || innerHeight)) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  const extraRoots = () => [player.mesh, buddy.mesh, ...npcs.map((n) => n.mesh)].filter(Boolean);
  function hitTest() {
    return stage.hit(ray, extraRoots());
  }
  function elFor(link) {
    if (!link) return null;
    return document.querySelector(`[data-focus="${link}"]`) || document.querySelector(`[data-shot="${link}"]`);
  }
  function setLit(el) {
    if (litEl === el) return;
    litEl?.classList.remove('is-lit');
    litEl = el;
    litEl?.classList.add('is-lit');
  }
  let lastHover = 0;
  function hoverWorld(e) {
    if (!enabled) return;
    if (!tip.hidden) tip.style.transform = `translate(${Math.min(innerWidth - 220, e.clientX + 16)}px, ${e.clientY + 18}px)`;
    const now = performance.now();
    if (now - lastHover < 50) return;
    lastHover = now;
    setNdc(e);
    const hit = hitTest();
    const id = hit?.id || null;
    if (id !== hovered?.id) {
      hovered = hit ? { id, pickable: hit.pickable, label: hit.label } : null;
      stage.setHover(stage.items[id] ? id : (stage.items[hit?.pickable?.link] ? hit.pickable.link : null));
      worldEl.style.cursor = hit ? 'pointer' : '';
      setLit(hit ? elFor(hit.pickable?.link) : null);
      const label = hit?.label || hit?.pickable?.label;
      tip.hidden = !label;
      if (label) tip.textContent = label;
    }
  }
  function clickWorld(e) {
    if (!enabled) return;
    if (e.target instanceof Element && e.target.closest('.g__plate')) return;
    setNdc(e);
    const hit = hitTest();
    if (hit) {
      emit('pick', { id: hit.id, egg: hit.pickable?.egg || null, point: hit.point });
      if (hit.pickable?.link) {
        const el = elFor(hit.pickable.link);
        if (el) {
          el.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
          el.classList.remove('is-ping'); void el.offsetWidth; el.classList.add('is-ping');
        }
      }
      hooks.onPick?.(hit);
      return;
    }
    // the ground: send the scholar there
    const p = groundPoint();
    if (p) {
      fx.ring(p.x, p.y, p.z, '#f2b84b', 1.2, 0.5);
      tour.stand(p.x, p.z, null);
      emit('ground', p);
    }
  }
  function groundPoint() {
    const o = ray.ray.origin, d = ray.ray.direction;
    for (let t = 2; t < 220; t += 0.6) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      const gh = world.height(x, z);
      if (gh > -Infinity && y <= gh + 0.5) {
        const sx = Math.round(x), sz = Math.round(z);
        if (world.isBlocked(sx, sz)) return null;
        return { x, y: gh + 0.5, z };
      }
    }
    return null;
  }
  function onPointerMove(e) {
    lastPointer.moved = true;
    lastPointer.cx = e.clientX; lastPointer.cy = e.clientY;
    lastPointer.at = performance.now();
    lastPointer.x = (e.clientX / innerWidth) * 2 - 1;
    lastPointer.y = (e.clientY / innerHeight) * 2 - 1;
  }

  worldEl.addEventListener('pointermove', hoverWorld);
  worldEl.addEventListener('pointerleave', () => { hovered = null; tip.hidden = true; worldEl.style.cursor = ''; setLit(null); stage.setHover(null); });
  worldEl.addEventListener('click', clickWorld);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  document.addEventListener('pointerover', onOver);
  document.addEventListener('pointerout', onOut);
  document.addEventListener('focusin', (e) => { const el = e.target instanceof Element ? e.target.closest('[data-focus]') : null; if (el) stage.setHover(el.dataset.focus); });
  document.addEventListener('focusout', (e) => { const el = e.target instanceof Element ? e.target.closest('[data-focus]') : null; if (el && !hoverEl) stage.setHover(null); });
  compactMQ.addEventListener?.('change', queueEval);

  scan();
  measure();
  queueEval();

  const api = {
    say,
    scan,
    walkTo(x, z) { tour.stand(x, z, null); },
    /** Re-apply the current target (after play mode, or when layout changed). */
    retarget() { currentSig = ''; scan(); apply(pickTarget(), { force: true, restand: true }); },
    focus(key) {
      const el = document.querySelector(`[data-focus="${key}"], [data-shot="${key}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    setEnabled(on) {
      enabled = on;
      if (!on) { clearTimeout(pulseTimer); tip.hidden = true; setLit(null); stage.setHover(null); worldEl.style.cursor = ''; }
      else { currentSig = ''; queueEval(); }
    },
    /** Light a landmark for `ms` as if hovered, then hand hover back to the pointer. A newer pulse replaces the older. */
    pulse(key, ms = 1500) {
      if (!enabled || !key) return;
      if (!pulseTimer) prePulse = stage.hover ?? null;
      clearTimeout(pulseTimer);
      stage.setHover(key);
      pulseTimer = setTimeout(() => {
        pulseTimer = 0;
        // hand back to the pointer, or to whoever held the hover before (e.g. walk mode), unless it moved on
        if (enabled && stage.hover === key) stage.setHover(hoverEl?.dataset.focus || prePulse);
      }, ms);
    },
    /** The page went plain: stop reacting, drop bubbles. On resume the shot is re-applied. */
    setPaused(on) {
      if (on === paused) return;
      paused = on;
      if (on) {
        for (const b of [...bubbles.values()]) b.remove();
        api.setEnabled(false);
      } else {
        api.setEnabled(true);
        api.retarget();
      }
    },
    get paused() { return paused; },
    get currentKey() { return currentKey; },
    get pointerIdleMs() { return performance.now() - lastPointer.at; },
    update(dt) {
      // pointer parallax, smoothed
      const k = 1 - Math.exp(-4 * dt);
      ptr.x += (lastPointer.x - ptr.x) * k;
      ptr.y += (lastPointer.y - ptr.y) * k;
      rig.pointer.x = ptr.x; rig.pointer.y = ptr.y;
      stage.sky.setScroll(scrollY);
      const p = clamp(scrollY / maxScroll, 0, 1);
      if (Math.abs(p - progress) > 0.002) { progress = p; emit('progress', p); }
    },
  };
  return api;
}
