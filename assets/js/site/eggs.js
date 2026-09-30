// The easter-egg registry. Every egg on the site (page-level or in the 3D world) is declared here,
// found via found(id), persisted in the save blob, and announced with a toast. The bar counter and
// the Field Notes panel both read from this file.
import { S, save } from '../game3d/state.js';
import { emit } from '../game3d/bus.js';
import { sfx } from '../game3d/audio.js';

/** kind: 'page' works without WebGL, 'world' needs the 3D island, 'game' needs play mode. */
export const EGGS = [
  // ---- on the page
  { id: 'notes',    kind: 'page',  name: 'Green eggs', hint: 'Open the field notes. Do you like them here or there?', done: 'You opened the notebook. Ham not included.' },
  { id: 'konami',   kind: 'page',  name: 'Thirty lives', hint: '↑ ↑ ↓ ↓ ← → ← → B A', done: 'All thirty lives spent on rebuttals.' },
  { id: 'terminal', kind: 'page',  name: 'Shell person', hint: 'Some people prefer a shell. Try the key under Esc.', done: 'You opened the terminal with `.' },
  { id: 'sudo',     kind: 'page',  name: 'Sudoers', hint: 'The terminal knows who you are not.', done: 'This incident has been reported. To no one.' },
  { id: 'rmrf',     kind: 'page',  name: 'Scorched earth', hint: 'Never run this. (A reload fixes it.)', done: 'The island noticed. It has since recovered.' },
  { id: 'vim',      kind: 'page',  name: 'Trapped', hint: 'A famous trap for the unwary.', done: 'Still inside. Try :q!' },
  { id: 'nvidia',   kind: 'page',  name: 'GPU-poor', hint: 'Ask the terminal about graphics cards.', done: 'Eight of them, apparently. All busy.' },
  { id: 'portrait', kind: 'page',  name: 'Say cheese', hint: 'Click the photo. More than once.', done: 'The photo became a little voxel scholar.' },
  { id: 'alias',    kind: 'page',  name: 'Who is yil384?', hint: 'Click the big name a few times.', done: 'A name is just a handle with better fonts.' },
  { id: 'tabaway',  kind: 'page',  name: 'Come back', hint: 'Leave the tab for a bit. Then return.', done: 'You wandered off. The island waited.' },
  { id: 'bottom',   kind: 'page',  name: 'Camera-ready', hint: 'Reach the very end of the page.', done: 'Submitted with four minutes to spare.' },
  { id: 'skim',     kind: 'page',  name: 'Reviewer #2, is that you?', hint: 'Read faster than anyone should.', done: 'Skimmed the whole page in seconds. Recommend: reject.' },
  { id: 'patient',  kind: 'page',  name: 'Thorough reader', hint: 'Stay a while.', done: 'You read carefully. Reviewer #1 approves.' },
  { id: 'print',    kind: 'page',  name: 'Dead trees', hint: 'Print the page.', done: 'A tree was planted in the game. (Not really.)' },
  { id: 'copy',     kind: 'page',  name: 'Message pigeon', hint: 'Copy the email address.', done: 'A pigeon is on its way.' },
  { id: 'console',  kind: 'page',  name: 'Curiosity console', hint: 'Open DevTools and say hello.', done: 'yichen.help() at your service.' },
  { id: 'sleep',    kind: 'world', name: 'Zzz', hint: 'Leave the scholar alone for a while.', done: 'Nodded off mid-proof.' },
  // ---- in the world
  { id: 'hat',      kind: 'world', name: 'A tall striped hat', hint: 'The library is named after someone who wrote in rhyme.', done: 'Geisel Library is named for Dr. Seuss, so of course.' },
  { id: 'geisel',   kind: 'world', name: 'Geisel takes off', hint: 'Give the tower a few more clicks.', done: 'Nobody has ever seen it leave. Nobody has ever seen it stay.' },
  { id: 'moon',     kind: 'world', name: 'Make a wish', hint: 'The moon is closer than it looks.', done: 'You wished for an accepted paper. Reviewer #2 heard.' },
  { id: 'triton',   kind: 'world', name: 'Go Tritons!', hint: 'Greet the mascot.', done: 'King Triton approves of your benchmark.' },
  { id: 'sungod',   kind: 'world', name: 'Sun God Festival', hint: 'The big grinning statue on the lawn.', done: 'It turned out the whole lawn was a stage.' },
  { id: 'sealion',  kind: 'world', name: 'Arf arf', hint: 'Something on the rocks below the pier.', done: 'The sea lion is unimpressed but polite.' },
  { id: 'glider',   kind: 'world', name: 'Torrey Pines glider', hint: 'Look up, way up.', done: 'A paraglider waves back. Thermals are free.' },
  { id: 'judge',    kind: 'world', name: 'Wrong Answer', hint: 'Ask the online judge for a verdict.', done: 'Wrong Answer on test 3. It is always test 3.' },
  { id: 'accepted', kind: 'world', name: 'Accepted!', hint: 'Keep resubmitting.', done: 'Accepted. Green on the first try, apparently.' },
  { id: 'mailbox',  kind: 'world', name: "You've got mail", hint: 'The mailbox has a flag.', done: 'Flag up. Write to me: yil384@ucsd.edu.' },
  { id: 'gate',     kind: 'world', name: 'The Second Gate', hint: 'The white gate on the west side.', done: '自强不息，厚德载物.' },
  { id: 'fallen',   kind: 'world', name: 'Fallen Star', hint: 'A house sits oddly on the roof.', done: 'It has been there since before you arrived.' },
  { id: 'flags',    kind: 'world', name: 'Flag collector', hint: 'Touch every flag on the trail.', done: 'Five flags, five jobs, one very tired scholar.' },
  { id: 'pet',      kind: 'world', name: 'Good Bit', hint: 'The blue one likes attention.', done: 'Bit purrs in binary.' },
  { id: 'poke',     kind: 'world', name: 'Ask the scholar', hint: 'Poke the little one a few times.', done: 'You have heard the whole repertoire of excuses.' },
  { id: 'wasd',     kind: 'game',  name: 'Player One', hint: 'Take the controls.', done: 'Game on.' },
  { id: 'chef',     kind: 'game',  name: 'Green eggs and ham', hint: 'Somebody is cooking near the camp.', done: 'You do like them! Best cook in the building.' },
  { id: 'oom',      kind: 'game',  name: 'RuntimeError: CUDA out of memory', hint: 'The cold aisle has a tenant.', done: 'You freed 2 GB. It had 80.' },
  { id: 'reviewer2', kind: 'game', name: 'Accept with minor revisions', hint: 'The eucalyptus grove has a reviewer.', done: 'Reviewer #2 is gone. Reviewer #3 is loading.' },
  { id: 'deadline', kind: 'game',  name: 'Made the deadline', hint: 'Something breathes down your neck on the bluff.', done: 'Slain, until next conference.' },
  { id: 'oracle',   kind: 'game',  name: 'The Oracle', hint: 'Three runes, one door.', done: 'The secret chamber gave up its companion.' },
];

const byId = Object.fromEntries(EGGS.map((e) => [e.id, e]));
let worldLive = false;
let playable = false;
const listeners = new Set();

const svgEgg = () => {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '26'); s.setAttribute('height', '26'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<path d="M12 2.5c-3.6 0-6.6 5.2-6.6 10.1A6.6 6.6 0 0 0 12 19.2c3.7 0 6.6-2.7 6.6-6.6C18.6 7.7 15.6 2.5 12 2.5Z" fill="currentColor"/><path d="M9 13.4c.4 1.6 1.4 2.6 3 2.9" stroke="#0a0d14" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".55"/>';
  return s;
};
export const eggIcon = svgEgg;

export const has = (id) => !!S.eggs[id];
/** Eggs the reader can currently reach on this device. */
export const available = () => EGGS.filter((e) => e.kind === 'page' || (e.kind === 'world' && worldLive) || (e.kind === 'game' && playable));
export const foundCount = () => EGGS.filter((e) => S.eggs[e.id]).length;
export const total = () => available().length;
export function setCapabilities({ world, play }) { worldLive = !!world; playable = !!play; listeners.forEach((f) => f()); }
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

let toastRoot = null;
/**
 * Mark an egg as found. Returns true the first time. `say` overrides the toast subtitle.
 */
export function found(id, { say } = {}) {
  const egg = byId[id];
  if (!egg || S.eggs[id]) return false;
  S.eggs[id] = Date.now();
  save();
  sfx('achievement');
  toastEgg(egg, say);
  emit('egg', id);
  listeners.forEach((f) => f());
  if (foundCount() === EGGS.length) setTimeout(() => toastEgg({ name: 'Every egg', done: 'All of them. Genuinely impressive. Please write to me: I owe you a coffee.' }), 2200);
  return true;
}

function toastEgg(egg, say) {
  toastRoot = toastRoot || document.getElementById('egg-toasts');
  if (!toastRoot) return;
  while (toastRoot.children.length > 3) toastRoot.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = 'egg-toast';
  el.setAttribute('role', 'status');
  const body = document.createElement('div');
  body.innerHTML = '<div class="egg-toast__k"></div><div class="egg-toast__t"></div><div class="egg-toast__s"></div>';
  body.querySelector('.egg-toast__k').textContent = `Egg found · ${foundCount()} / ${total()}`;
  body.querySelector('.egg-toast__t').textContent = egg.name;
  body.querySelector('.egg-toast__s').textContent = say || egg.done || '';
  el.append(svgEgg(), body);
  toastRoot.append(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  setTimeout(() => { el.classList.remove('is-in'); el.classList.add('is-out'); setTimeout(() => el.remove(), 400); }, 5200);
}
