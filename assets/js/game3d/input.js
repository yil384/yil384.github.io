// Keyboard, mouse, wheel and touch input for play mode. Attached only while playing.
// Keys are tracked by KeyboardEvent.code (layout-independent, and Shift does not turn "1" into "!"
// or "w" into "W"). `pressed(code)` is edge-triggered (true once per press, consumed by the reader).
// Touch controls (touch.js) feed the same channels through `stick` and `setVirtual`.
//
// Mouse look: the first click on the world takes pointer lock (Esc gives it back); right-drag also looks.
// Deliberately NOT bound: Ctrl (Ctrl+W closes the tab while you are walking forward).

const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
const DOUBLE_TAP_MS = 260;

export function createInput(el) {
  const keys = new Set();          // physical keys held
  const virt = new Set();          // touch buttons held
  const edges = new Set();         // pressed since last read
  let dragging = false;
  let last = null;
  let dragDelta = { dx: 0, dy: 0 };
  let wheelDelta = 0;
  let lastTap = { code: '', at: 0 };
  let doubleTap = null;            // [dx, dz] of a double-tapped direction, until read
  const handlers = {};
  const api = {
    onEscape: null,
    onKey: null,           // (key, event) -> true if consumed (one-shot actions)
    onPrimary: null,       // left click on the world (attack)
    onLockChange: null,
    locked: false,         // pointer lock (mouse look) active
    lockable: matchMedia('(pointer: fine)').matches,
    unlock() { if (document.pointerLockElement === el) document.exitPointerLock?.(); api.locked = false; },
    stick: { x: 0, y: 0 }, // touch joystick, -1..1
    attach() {
      handlers.kd = (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const editable = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
        if (editable && e.key !== 'Escape') return;
        if (!e.repeat && api.onKey?.(e.key, e)) { e.preventDefault(); return; }
        if (editable) return;
        if (e.key === 'Escape') { api.onEscape?.(); return; }
        if (!e.repeat) {
          edges.add(e.code);
          if (MOVE[e.code]) {
            const now = performance.now();
            if (lastTap.code === e.code && now - lastTap.at < DOUBLE_TAP_MS) { doubleTap = MOVE[e.code]; lastTap = { code: '', at: 0 }; }
            else lastTap = { code: e.code, at: now };
          }
        }
        keys.add(e.code);
        if (/^Arrow/.test(e.key) || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
      };
      handlers.ku = (e) => keys.delete(e.code);
      handlers.blur = () => { keys.clear(); virt.clear(); };
      handlers.md = (e) => {
        if (e.pointerType === 'touch') return;                 // touch.js owns touches
        if (e.button === 2 || e.button === 1) { dragging = true; last = { x: e.clientX, y: e.clientY }; e.preventDefault(); return; }
        if (e.button !== 0) return;
        if (api.locked) { api.onPrimary?.(e); return; }
        if (e.target instanceof Element && e.target.closest('button, a, input, .g__plate, .modal, .hud-card, .touch, .wmap')) return;
        // the first click on the world captures the mouse for mouse look (Esc releases it)
        if (api.lockable && el.requestPointerLock) { try { const r = el.requestPointerLock(); r?.catch?.(() => {}); } catch { /* not allowed */ } return; }
        api.onPrimary?.(e);
      };
      handlers.mm = (e) => {
        if (api.locked) { dragDelta.dx += e.movementX || 0; dragDelta.dy += e.movementY || 0; return; }
        if (!dragging) return;
        dragDelta.dx += e.clientX - last.x; dragDelta.dy += e.clientY - last.y; last = { x: e.clientX, y: e.clientY };
      };
      handlers.plc = () => { api.locked = document.pointerLockElement === el; api.onLockChange?.(api.locked); };
      document.addEventListener('pointerlockchange', handlers.plc);
      handlers.mu = () => { dragging = false; };
      handlers.cm = (e) => e.preventDefault();
      handlers.wh = (e) => { if (e.target.closest('.modal, .hud-card, .hud-quests, .wmap')) return; wheelDelta += e.deltaY; e.preventDefault(); };
      window.addEventListener('keydown', handlers.kd);
      window.addEventListener('keyup', handlers.ku);
      window.addEventListener('blur', handlers.blur);
      el.addEventListener('pointerdown', handlers.md);
      window.addEventListener('pointermove', handlers.mm);
      window.addEventListener('pointerup', handlers.mu);
      el.addEventListener('contextmenu', handlers.cm);
      el.addEventListener('wheel', handlers.wh, { passive: false });
    },
    detach() {
      window.removeEventListener('keydown', handlers.kd);
      window.removeEventListener('keyup', handlers.ku);
      window.removeEventListener('blur', handlers.blur);
      el.removeEventListener('pointerdown', handlers.md);
      window.removeEventListener('pointermove', handlers.mm);
      window.removeEventListener('pointerup', handlers.mu);
      el.removeEventListener('contextmenu', handlers.cm);
      el.removeEventListener('wheel', handlers.wh);
      document.removeEventListener('pointerlockchange', handlers.plc);
      api.unlock();
      api.clear();
      dragging = false;
    },
    clear() { keys.clear(); virt.clear(); edges.clear(); dragDelta = { dx: 0, dy: 0 }; wheelDelta = 0; doubleTap = null; api.stick.x = api.stick.y = 0; },
    /** Held? (keyboard code, or a virtual touch button with the same name) */
    down: (code) => keys.has(code) || virt.has(code),
    /** Pressed since the last call for this code (edge). */
    pressed(code) { if (!edges.has(code)) return false; edges.delete(code); return true; },
    /** Touch buttons: press/release a virtual code (e.g. 'Space', 'KeyJ'). */
    setVirtual(code, on) { if (on) { if (!virt.has(code)) edges.add(code); virt.add(code); } else virt.delete(code); },
    tapVirtual(code) { edges.add(code); },
    endFrame() { edges.clear(); },
    axis() {
      let x = api.stick.x, y = api.stick.y;
      for (const [code, [dx, dy]] of Object.entries(MOVE)) if (keys.has(code)) { x += dx; y += dy; }
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      return { x, y };
    },
    sprint: () => keys.has('ShiftLeft') || keys.has('ShiftRight') || virt.has('Sprint'),
    takeDoubleTap() { const d = doubleTap; doubleTap = null; return d; },
    drag() {
      if (!dragDelta.dx && !dragDelta.dy) return null;
      const d = dragDelta;
      dragDelta = { dx: 0, dy: 0 };
      return d;
    },
    addDrag(dx, dy) { dragDelta.dx += dx; dragDelta.dy += dy; dragDelta.touch = true; },
    wheel() { const w = wheelDelta; wheelDelta = 0; return w; },
    /** Touch pinch: zoom like the mouse wheel (positive = out). */
    addWheel(d) { wheelDelta += d; },
  };
  return api;
}
