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
  { id: 'tabaway',  kind: 'page',  name: 'Defeated by Claude', hint: 'Leave the tab for a bit. Watch its title. Then return.', done: 'You wandered off. The tab title had a whole saga without you.' },
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
  { id: 'flags',    kind: 'world', name: 'Flag collector', hint: 'Touch every flag on the trail.', done: 'Six flags, six jobs, one very tired scholar.' },
  { id: 'pet',      kind: 'world', name: 'Good Bit', hint: 'The blue one likes attention.', done: 'Bit purrs in binary.' },
  { id: 'poke',     kind: 'world', name: 'Ask the scholar', hint: 'Poke the little one a few times.', done: 'You have heard the whole repertoire of excuses.' },
  { id: 'wasd',     kind: 'game',  name: 'Player One', hint: 'Take the controls.', done: 'Game on.' },
  { id: 'chef',     kind: 'game',  name: 'Green eggs and ham', hint: 'Somebody is cooking near the camp.', done: 'You do like them! Best cook in the building.' },
  { id: 'oom',      kind: 'game',  name: 'RuntimeError: CUDA out of memory', hint: 'The cold aisle has a tenant.', done: 'You freed 2 GB. It had 80.' },
  { id: 'reviewer2', kind: 'game', name: 'Accept with minor revisions', hint: 'The eucalyptus grove has a reviewer.', done: 'Reviewer #2 is gone. Reviewer #3 is loading.' },
  { id: 'deadline', kind: 'game',  name: 'Made the deadline', hint: 'Something breathes down your neck on the bluff.', done: 'Slain, until next conference.' },
  { id: 'oracle',   kind: 'game',  name: 'The Oracle', hint: 'Three runes, one door.', done: 'The secret chamber gave up its companion.' },
  // ---- the interactive CV (page game, round 3): all work without WebGL
  { id: "start", kind: 'page', src: 'cv', name: "Press Start", hint: "The title screen is waiting for a key.", done: "Press Start to continue. You did." },
  { id: "blocks", kind: 'page', src: 'cv', name: "Load-bearing letters", hint: "The big name looks bumpable.", done: "Every block bumped. No mushrooms, sorry." },
  { id: "typename", kind: 'page', src: 'cv', name: "Autocomplete", hint: "Type his name anywhere.", done: "yichen, lin and yil384 all resolve." },
  { id: "continue", kind: 'page', src: 'cv', name: "Save file found", hint: "Come back another day.", done: "Continue? ▶ YES" },
  { id: "specialist", kind: 'page', src: 'cv', name: "Full respec", hint: "Try every research interest.", done: "Build respec: all four trees. Very Ph.D." },
  { id: "zhuo", kind: 'page', src: 'cv', name: "Dinner is served", hint: "The best cook in the building has a pan.", done: "Tomato and egg, the Tsinghua classic." },
  { id: "seagull", kind: 'page', src: 'cv', name: "Apex predator", hint: "Something on Library Walk wants your fries.", done: "Seagull 0, scholar 1." },
  { id: "zerogap", kind: 'page', src: 'cv', name: "No gap year", hint: "Look between the two campuses.", done: "0 days between the gates." },
  { id: "thesis", kind: 'page', src: 'cv', name: "Patience", hint: "Some doors open for the persistent.", done: "Patience is also a skill." },
  { id: "offbyone", kind: 'page', src: 'cv', name: "Off by one", hint: "Bonk the slime near Education. Twice.", done: "i < n, not i <= n." },
  { id: "overfill", kind: 'page', src: 'cv', name: "CUDA OOM", hint: "Python looks like it could take more.", done: "Tried to allocate 2.00 GiB." },
  { id: "vimslot", kind: 'page', src: 'cv', name: ":q", hint: "Use Vim on the workbench, then leave.", done: "You escaped. Few do." },
  { id: "tex", kind: 'page', src: 'cv', name: "Badness 10000", hint: "LaTeX has opinions about boxes.", done: "Overfull \\hbox. Again." },
  { id: "hotbar", kind: 'page', src: 'cv', name: "Hotbar hero", hint: "Use every tool on the workbench.", done: "Every tool used once. Ship it." },
  { id: "cite", kind: 'page', src: 'cv', name: "Cite me", hint: "Copy a BibTeX.", done: "Cited. h-index +0.0001." },
  { id: "rebuttal", kind: 'page', src: 'cv', name: "Rebuttal", hint: "Answer Reviewer #2.", done: "Score unchanged. Classic." },
  { id: "refresh", kind: 'page', src: 'cv', name: "F5", hint: "Refresh the review status. A lot.", done: "Decisions are out when they are out." },
  { id: "asterisk", kind: 'page', src: 'cv', name: "Equal contribution", hint: "Stars travel in pairs.", done: "Two names, one star." },
  { id: "h2o", kind: 'page', src: 'cv', name: "Stay hydrated", hint: "Water has a subscript.", done: "(Re)²H₂O. Drink some water." },
  { id: "nan", kind: 'page', src: 'cv', name: "NaN !== NaN", hint: "A strange slime in the library.", done: "Your cash was briefly not a number." },
  { id: "questlog", kind: 'page', src: 'cv', name: "Quest log complete", hint: "Turn in every quest.", done: "Every quest turned in. The trail is complete." },
  { id: "multithread", kind: 'page', src: 'cv', name: "Parallel quests", hint: "Find where the quests overlap.", done: "Please don't tell the scheduler." },
  { id: "lark", kind: 'page', src: 'cv', name: "A lark", hint: "The Lark logo looks like it could fly.", done: "It flew toward Library Walk." },
  { id: "teammate", kind: 'page', src: 'cv', name: "Voice chat", hint: "Talk to a voice-controlled teammate.", done: "…which monster?" },
  { id: "legacy", kind: 'page', src: 'cv', name: "Legacy code", hint: "Something on the trail should not be touched.", done: "Refactored. Tests still pass (there were none)." },
  { id: "loadout", kind: 'page', src: 'cv', name: "Full set", hint: "Equip every project.", done: "Full set bonus: +10% chance a reviewer reads the appendix." },
  { id: "pingpong", kind: 'page', src: 'cv', name: "Keep-alive", hint: "Ping the IM server. Keep going.", done: "Connection upgraded to friendship." },
  { id: "panic", kind: 'page', src: 'cv', name: "Kernel panic", hint: "Don't interrupt a boot.", done: "not syncing: you clicked too fast." },
  { id: "jit", kind: 'page', src: 'cv', name: "@triton.jit", hint: "Run TritonGym twice.", done: "Compiled. Eventually." },
  { id: "segfault", kind: 'page', src: 'cv', name: "Null Pointer", hint: "A bat in the workshop dodges.", done: "Pointer dereferenced safely." },
  { id: "portalhop", kind: 'page', src: 'cv', name: "Frequent traveller", hint: "Point at every portal on the lawn.", done: "Three portals, zero teleport fees." },
  { id: "subject", kind: 'page', src: 'cv', name: "Good subject line", hint: "Use a quick subject on the lawn.", done: "Clear subject lines get replies." },
  { id: "savepoint", kind: 'page', src: 'cv', name: "Save point", hint: "A crystal on the lawn.", done: "Game saved. HP and FOCUS restored." },
  { id: "lamplighter", kind: 'page', src: 'cv', name: "Lamplighter", hint: "Walk the trail between chapters.", done: "Six lanterns. The trail is lit." },
  { id: "tokens", kind: 'page', src: 'cv', name: "Token collector", hint: "Twelve Triton tokens are tucked around the page.", done: "Twelve tokens. Redeemable for nothing." },
  { id: "cleared", kind: 'page', src: 'cv', name: "Cover to cover", hint: "Read every chapter.", done: "Six chapters cleared. Reviewer #1 would be proud." },
  { id: "exterminator", kind: 'page', src: 'cv', name: "Bug bash", hint: "Bonk all five critters.", done: "Five bugs fixed. Four new ones filed." },
  { id: "invincible", kind: 'page', src: 'cv', name: "God mode", hint: "Poke your HP.", done: "God mode was on the whole time." },
  { id: "manual", kind: 'page', src: 'cv', name: "RTFM", hint: "Press ?", done: "Nobody reads the manual. You did." },
  { id: "vimnav", kind: 'page', src: 'cv', name: "j and k", hint: "Navigate without a mouse.", done: "You navigated a CV with j and k. Unit-7 is proud." },
  { id: "reviewermode", kind: 'page', src: 'cv', name: "Plain text", hint: "Switch to Reviewer mode.", done: "One column, no nonsense. Recommend: accept." },
  { id: "phd", kind: 'page', src: 'cv', name: "Dr. (Honorary)", hint: "Keep reading. Keep clicking.", done: "Degree conferred. Not accredited." },
  { id: "credits", kind: 'page', src: 'cv', name: "Post-credits scene", hint: "Stay until the credits end.", done: "You stayed for the post-credits scene." },
  { id: "newgame", kind: 'page', src: 'cv', name: "New Game+", hint: "Finish, then start again.", done: "New Game+: same CV, more confident." },
];

const byId = Object.fromEntries(EGGS.map((e) => [e.id, e]));
let worldLive = false;
let playable = false;
const listeners = new Set();

/**
 * Add an egg at runtime (e.g. walk mode's `speedrun`, only when that module ships).
 * { id, kind = 'page', name, hint, done }. Returns false if the id already exists.
 */
export function registerEgg(egg) {
  if (!egg?.id || byId[egg.id]) return false;
  const e = { kind: 'page', src: 'cv', ...egg };
  EGGS.push(e);
  byId[e.id] = e;
  listeners.forEach((f) => f());
  return true;
}

const svgEgg = () => {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '26'); s.setAttribute('height', '26'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<path d="M12 2.5c-3.6 0-6.6 5.2-6.6 10.1A6.6 6.6 0 0 0 12 19.2c3.7 0 6.6-2.7 6.6-6.6C18.6 7.7 15.6 2.5 12 2.5Z" fill="currentColor"/><path d="M9 13.4c.4 1.6 1.4 2.6 3 2.9" stroke="#0a0d14" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".55"/>';
  return s;
};
export const eggIcon = svgEgg;

export const has = (id) => !!S.eggs[id];
/** Eggs the reader can currently reach on this device (plus any already found, e.g. world eggs reached from the page). */
export const available = () => EGGS.filter((e) => e.kind === 'page' || (e.kind === 'world' && worldLive) || (e.kind === 'game' && playable) || S.eggs[e.id]);
export const foundCount = () => EGGS.filter((e) => S.eggs[e.id]).length;
export const total = () => available().length;
export const byKind = (kind) => EGGS.filter((e) => e.kind === kind);
export const egg = (id) => byId[id] || null;
export function setCapabilities({ world, play }) { worldLive = !!world; playable = !!play; listeners.forEach((f) => f()); }
export const capabilities = () => ({ world: worldLive, play: playable });
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

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

let toastRoot = null;
/** Shared toast stack (top-right under the bar, at most 3). Used by eggs and by kit.toast(). */
export function pushToast(el, ms = 5200) {
  toastRoot = toastRoot || document.getElementById('egg-toasts');
  if (!toastRoot) return null;
  while (toastRoot.children.length >= 3) toastRoot.firstElementChild.remove();
  el.classList.add('egg-toast');
  el.setAttribute('role', 'status');
  toastRoot.append(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  setTimeout(() => { el.classList.remove('is-in'); el.classList.add('is-out'); setTimeout(() => el.remove(), 400); }, ms);
  return el;
}

function toastEgg(egg, say) {
  const el = document.createElement('div');
  const body = document.createElement('div');
  body.innerHTML = '<div class="egg-toast__k"></div><div class="egg-toast__t"></div><div class="egg-toast__s"></div>';
  body.querySelector('.egg-toast__k').textContent = `Egg found · ${foundCount()} / ${total()}`;
  body.querySelector('.egg-toast__t').textContent = egg.name;
  body.querySelector('.egg-toast__s').textContent = say || egg.done || '';
  el.append(svgEgg(), body);
  pushToast(el);
}
