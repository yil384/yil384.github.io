// Keyboard, mouse and wheel input for the island. Attached only while the overlay is open.

export function createInput(el) {
  const keys = new Set();
  let dragging = false;
  let last = null;
  let dragDelta = { dx: 0, dy: 0 };
  let wheelDelta = 0;
  const handlers = {};
  const api = {
    onEscape: null,
    onKey: null,           // (key, event) -> true if consumed
    attach() {
      handlers.kd = (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const editable = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
        if (editable && e.key !== 'Escape') return;
        if (api.onKey?.(e.key, e)) { e.preventDefault(); return; }
        if (editable) return;
        if (e.key === 'Escape') { api.onEscape?.(); return; }
        keys.add(e.key.toLowerCase());
        if (/^Arrow/.test(e.key) || e.key === ' ') e.preventDefault();
      };
      handlers.ku = (e) => keys.delete(e.key.toLowerCase());
      handlers.blur = () => keys.clear();
      handlers.md = (e) => { if (e.button === 2 || e.button === 1) { dragging = true; last = { x: e.clientX, y: e.clientY }; e.preventDefault(); } };
      handlers.mm = (e) => { if (!dragging) return; dragDelta.dx += e.clientX - last.x; dragDelta.dy += e.clientY - last.y; last = { x: e.clientX, y: e.clientY }; };
      handlers.mu = () => { dragging = false; };
      handlers.cm = (e) => e.preventDefault();
      handlers.wh = (e) => { if (e.target.closest('.modal, .hud-card, .hud-quests')) return; wheelDelta += e.deltaY; e.preventDefault(); };
      window.addEventListener('keydown', handlers.kd);
      window.addEventListener('keyup', handlers.ku);
      window.addEventListener('blur', handlers.blur);
      el.addEventListener('mousedown', handlers.md);
      window.addEventListener('mousemove', handlers.mm);
      window.addEventListener('mouseup', handlers.mu);
      el.addEventListener('contextmenu', handlers.cm);
      el.addEventListener('wheel', handlers.wh, { passive: false });
    },
    detach() {
      window.removeEventListener('keydown', handlers.kd);
      window.removeEventListener('keyup', handlers.ku);
      window.removeEventListener('blur', handlers.blur);
      el.removeEventListener('mousedown', handlers.md);
      window.removeEventListener('mousemove', handlers.mm);
      window.removeEventListener('mouseup', handlers.mu);
      el.removeEventListener('contextmenu', handlers.cm);
      el.removeEventListener('wheel', handlers.wh);
      keys.clear();
      dragging = false;
    },
    clear() { keys.clear(); dragDelta = { dx: 0, dy: 0 }; wheelDelta = 0; },
    down: (k) => keys.has(k),
    axis() {
      let x = 0, y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      return { x, y };
    },
    drag() {
      if (!dragDelta.dx && !dragDelta.dy) return null;
      const d = dragDelta;
      dragDelta = { dx: 0, dy: 0 };
      return d;
    },
    wheel() { const w = wheelDelta; wheelDelta = 0; return w; },
  };
  return api;
}
