// Third-person follow camera. Right-drag orbits, wheel zooms; the target is the player.
import * as THREE from 'three/webgpu';

export function createCamera() {
  const cam = new THREE.PerspectiveCamera(42, 1, 0.5, 400);
  const state = {
    cam,
    yaw: 0.35,          // orbit angle around the player
    pitch: 0.95,        // radians down from horizontal
    dist: 24,
    look: new THREE.Vector3(),
    pos: new THREE.Vector3(),
    snap(p) {
      state.look.set(p.x, p.y + 1.5, p.z);
      place(1);
    },
    update(p, input, dt) {
      const d = input.drag();
      if (d) { state.yaw -= d.dx * 0.006; state.pitch = clamp(state.pitch - d.dy * 0.004, 0.45, 1.35); }
      const w = input.wheel();
      if (w) state.dist = clamp(state.dist * (1 + w * 0.0012), 12, 40);
      const k = Math.min(1, dt * 6);
      state.look.x += (p.x - state.look.x) * k;
      state.look.y += (p.y + 1.5 - state.look.y) * k;
      state.look.z += (p.z - state.look.z) * k;
      place(k);
    },
  };
  function place(k) {
    const { yaw, pitch, dist, look } = state;
    const ox = Math.sin(yaw) * Math.cos(pitch) * dist;
    const oz = Math.cos(yaw) * Math.cos(pitch) * dist;
    const oy = Math.sin(pitch) * dist;
    state.pos.set(look.x + ox, look.y + oy, look.z + oz);
    cam.position.lerp(state.pos, k);
    cam.lookAt(look);
  }
  return state;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
