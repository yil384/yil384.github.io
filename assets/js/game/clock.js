// Game clock: only advances while the world is running and not paused.
// Every cooldown, respawn timer and attack interval is measured against it,
// so opening a dialog or mini-game truly freezes the world.

export const clock = {
  t: 0,      // ms of unpaused game time
  dt: 0,     // seconds elapsed in the current frame
  frame: 0,
};

const queue = [];

export function advance(ms) {
  clock.dt = ms / 1000;
  clock.t += ms;
  clock.frame++;
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i].at <= clock.t) {
      const [job] = queue.splice(i, 1);
      try { job.fn(); } catch (err) { console.error(err); }
    }
  }
}

/** Run fn after `ms` of game time (pauses with the world). */
export function later(ms, fn) {
  queue.push({ at: clock.t + ms, fn });
}

export const since = (t) => clock.t - t;
