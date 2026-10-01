// regions/stacks.js: the Geisel Stacks, the floors under Geisel Library (named for Theodor Geisel: Dr.
// Seuss). The papers live down here.
//   - south: the lower-level atrium (arrive from the hub), the circulation desk and Quire, the Stacks
//     librarian (inside voices, please), the card catalog, the Seuss corner
//   - centre: towering stacks with a central aisle; one aisle is unlit (Fiat lux)
//   - west: the TritonGym wing. Reviewer 3 (not Reviewer #2: that one lives in the hub's grove) holds a
//     rebuttal shield; pick up its comments and answer them to crack it (→ seal-tritongym, "Under review")
//   - east: the (Re)²H₂O wing, a driving-scenario track. SCENE-GEN generates traffic: offline (replayed
//     from a log), online (adapts to you), hybrid (both); survive each (→ seal-reh2o, "Published IEEE IV 2023")
//   - north: the Defense door, sealed until the Road to Dr. is complete; then a portal to the finale
//   - side quest: four overdue books lost in the stacks
import * as THREE from 'three/webgpu';
import {
  terrain, props, platform, registerArt, registerEnemyKind, spawnEnemy, spawnBoss, spawnNpc, interactable,
  trigger, pickup, portal, quest, egg, say, banner, toast, sfx, onUpdate, onEnter, onLeave, dialog, cinematic,
  sprite, hash3, hasItem, award, ROAD, block, unblock, regionName,
} from '../regions.js';
import { on } from '../bus.js';
import { player, hurt } from '../player.js';
import { S } from '../state.js';
import * as fx from '../fx.js';
import { h } from '../util.js';
import { STACKS_ART, STACKS_GLOW } from './art-stacks.js';
import { installDrTitle } from './finale.js';

// ---------------------------------------------------------------- layout (region-local cells)
const R = 26;
const inIsland = (x, z) => (Math.abs(x) / R) ** 8 + (Math.abs(z) / R) ** 8 <= 1;
const SHELF_Z = [4, 0, -4, -8, -12, -16];
const ARENA = { x: -18.5, z: -9, r: 6.5 };               // TritonGym wing: the rebuttal ring
const TRACK = { x0: 13, x1: 23, z0: -20, z1: 2 };        // (Re)²H₂O wing: the scenario track (interior)
const LANES = [{ x: 15, dir: -1 }, { x: 18, dir: 1 }, { x: 21, dir: -1 }];
const DESK = { x: 0, z: 12 };
const QUIRE = { x: 0, z: 10.4 };

const SOLID = new Map();
const solid = (x, z, hh, t) => SOLID.set(`${x},${z}`, { h: hh, t });
for (const z of SHELF_Z) for (let x = 2; x <= 9; x++) { solid(x, z, 9, 'shelf'); solid(-x, z, 9, 'shelf'); }
for (let z = -26; z <= 5; z++) {                                                   // wing walls, two doorways each
  if ((z >= 1 && z <= 3) || (z >= -7 && z <= -5)) continue;
  solid(11, z, 9, 'wall'); solid(-11, z, 9, 'wall');
}
for (let x = -10; x <= 10; x++) if (Math.abs(x) > 2) solid(x, -20, 11, 'stone');   // the Defense wall
for (let x = -4; x <= 4; x++) solid(x, DESK.z, 3, 'desk');                          // the circulation desk
for (let z = TRACK.z0 - 1; z <= TRACK.z1 + 1; z++) { solid(TRACK.x0 - 1, z, 4, 'curb'); solid(TRACK.x1 + 1, z, 4, 'curb'); }
for (let x = TRACK.x0 - 1; x <= TRACK.x1 + 1; x++) { solid(x, TRACK.z0 - 1, 4, 'curb'); if (x < 16 || x > 19) solid(x, TRACK.z1 + 1, 4, 'curb'); }
for (const [x, z] of [[-20, 17], [-21, 17], [-19, 17]]) solid(x, z, 4, 'shelf');     // the Seuss corner's little shelf

const inTrack = (x, z) => x >= TRACK.x0 - 0.5 && x <= TRACK.x1 + 0.5 && z >= TRACK.z0 - 0.5 && z <= TRACK.z1 + 0.5;
function heightAt(x, z) {
  if (!inIsland(x, z)) return null;
  const so = SOLID.get(`${x},${z}`);
  return so ? so.h : 2;
}
function typeAt(x, z) {
  const so = SOLID.get(`${x},${z}`);
  if (so) return so.t;
  if (z < -20) return (x + z) & 1 ? 'marble' : 'marble2';
  if (inTrack(x, z)) return (x === 16 || x === 20) && ((z & 3) < 2) ? 'lane' : 'asphalt';
  const ad = Math.hypot(x - ARENA.x, z - ARENA.z);
  if (ad < ARENA.r) return ad > ARENA.r - 1 ? 'rim' : ((x + z) & 1 ? 'tileA' : 'tileB');
  if (Math.abs(x) > 11 && z < 6) return (x + z) & 1 ? 'wing' : 'wing2';
  if (z >= 6) return Math.abs(x) <= 1 || (z === 17 && Math.abs(x) < 12) ? 'runner' : ((Math.floor(x / 2) + Math.floor(z / 2)) & 1 ? 'carpet' : 'carpet2');
  return Math.abs(x) <= 1 ? 'runner' : 'aisle';
}
const PALETTE = {
  carpet: ['#6b2737', '#632332'], carpet2: ['#5a1f2d', '#541c2a'], runner: ['#1f5b5b', '#1b5252'],
  aisle: ['#5b4636', '#544032', '#604a39'], shelf: ['#6b4423', '#5f3b1f'], wall: ['#3b3f4c', '#363a46'],
  stone: ['#57534e', '#4f4b47'], desk: ['#8a5a2b', '#7c5026'], marble: ['#d6d3d1'], marble2: ['#c4c0bb'],
  wing: ['#2c3548', '#28303f'], wing2: ['#303a4f'], tileA: ['#1e293b'], tileB: ['#243049'], rim: ['#f43f5e', '#e11d48'],
  asphalt: ['#2b2d31', '#303236', '#27292d'], lane: ['#f8fafc'], curb: ['#e5e7eb', '#f43f5e'],
};

// ---------------------------------------------------------------- the rebuttal: Reviewer 3's comments
// Every good answer is grounded in the paper's page summary; the bad ones are (clearly) jokes.
const COMMENTS = [
  { id: 'demo', c: 'W1. The results look like cherry-picked demo prompts.', good: 'TritonGym measures systems behavior: does the kernel compile, is it correct, is it fast. No demo-only wins.', bad: ['Our demos are very good, though.', 'Did you watch the video? Twice?'] },
  { id: 'cite', c: 'W2. Missing reference to [a paper the reviewer definitely did not write].', good: 'Thank you. We have added the citation.', bad: ['That paper is unrelated and we both know who wrote it.', 'Nice try, Reviewer 3.'] },
  { id: 'triton', c: 'W3. Why Triton, specifically?', good: 'Triton is where agentic code generation meets real GPU kernels, so it is a good place to measure agents.', bad: ['It shares a name with our mascot.', 'Why not?'] },
  { id: 'bench', c: 'W4. Isn’t this “just” a benchmark?', good: 'On purpose: a benchmark is how you measure tool-augmented LLM workflows fairly.', bad: ['Just? JUST?', 'It is also a lifestyle.'] },
  { id: 'star', c: 'W5. What do the asterisks on the author list mean?', good: 'Yue Guan* and Yichen Lin* contributed equally; the asterisk marks equal contribution.', bad: ['They are decorative.', 'Asterisks are free, so we used some.'] },
  { id: 'status', c: 'Q1. Has this work already been accepted somewhere?', good: 'Not yet: it is under review at ICML 2026. That is why we are both here.', bad: ['Obviously.', 'It will be, right after this rebuttal.'] },
  { id: 'typo', c: 'W6. There are typos.', good: 'Fixed. Thank you for the careful reading.', bad: ['Those are features.', '(no response)'] },
  { id: 'agent', c: 'W7. How do you know the agent did anything real?', good: 'The harness checks what actually happens to each kernel: it compiles, it is correct, it is fast. Or it isn’t.', bad: ['Vibes.', 'The agent told us so, very confidently.'] },
];
const SCORE = { 3: 'Weak Reject', 4: 'Borderline', 5: 'Weak Accept', 6: 'Accept (pending AC)' };

const OVERDUE = [
  { id: 'stacks-book-rust', x: -5, z: -8, title: 'Rust for the Impatient', note: 'Borrowed in 2023. The borrow checker never let it go.' },
  { id: 'stacks-book-vim', x: 8, z: -14, title: 'Vim: How to Exit', note: 'Never returned. We believe the borrower is still inside, typing :q.' },
  { id: 'stacks-book-latex', x: -23.5, z: -16, title: 'LaTeX and the Missing Brace', note: 'Returned once. Compiled with 214 warnings. Checked out again.' },
  { id: 'stacks-book-rl', x: 22.5, z: -19, title: 'Offline and Online: A Love Story (RL)', note: 'Found on the test track. It was learning to drive.' },
];

export default {
  id: 'stacks',
  name: 'Geisel Stacks',
  subtitle: 'The floors under Geisel Library, where the papers live · inside voices, please',
  size: 54,
  spawn: [0, 20.5],
  sky: { tint: '#fcd9a8', ground: '#1a0f0a', fog: '#120c09', density: 0.011, sun: 1.4 },
  zones: {
    atrium: { x: 0, z: 18, r: 8, label: 'Geisel · lower level' },
    desk: { x: 0, z: 11.5, r: 3.5, label: 'Circulation desk (inside voices)' },
    seuss: { x: -20, z: 18, r: 4.5, label: 'The Seuss corner' },
    catalog: { x: 15, z: 16, r: 4, label: 'The card catalog' },
    stacks: { x: 0, z: -6, r: 10, label: 'The stacks' },
    dark: { x: 5.5, z: -14, r: 3, label: 'An unlit aisle' },
    tg: { x: ARENA.x, z: ARENA.z, r: 8.5, label: 'TritonGym wing · under review, ICML 2026' },
    reh: { x: 18, z: -9, r: 9, label: '(Re)²H₂O wing · IEEE IV 2023' },
    door: { x: 0, z: -18.5, r: 3.5, label: 'The Defense' },
    ante: { x: 0, z: -23, r: 3.5, label: 'The Defense · antechamber' },
  },

  build(ctx) {
    for (const [name, art] of Object.entries(STACKS_ART)) registerArt(name, art, STACKS_GLOW[name] || null);
    const st = ctx.state;
    let lastT = 0;
    const rate = {};                                           // simple per-key rate limiter (seconds)
    const every = (k, s) => { if (lastT - (rate[k] ?? -1e9) < s) return false; rate[k] = lastT; return true; };
    const lp = (x, z) => Math.hypot(ctx.player.x - x, ctx.player.z - z);

    // ================================================================ terrain
    terrain(ctx, { size: 54, height: heightAt, type: typeAt, palette: PALETTE, skirt: 8 });

    // ================================================================ scenery
    const D = [], B = [], G = [];            // decorative, blocked, glowing
    const put = (list, x, y, z, c, g = 0) => list.push([x, y, z, c, g]);
    const SPINES = ['#b91c1c', '#1d4ed8', '#15803d', '#a16207', '#6d28d9', '#0f766e', '#be185d', '#e5e7eb', '#78350f', '#334155'];
    // book spines on both faces of every shelf (a thin skin over the shelf columns)
    for (const z of SHELF_Z) for (let ax = 2; ax <= 9; ax++) for (const x of [ax, -ax]) for (let y = 3; y <= 8; y++) for (const s of [-1, 1]) {
      if (hash3(x, y, z * s) < 0.12) continue;
      put(D, x, y, z + s * 0.08, SPINES[Math.floor(hash3(x * 3, y, z + s) * SPINES.length)]);
    }
    // call-number labels on the shelf ends facing the central aisle
    for (const z of SHELF_Z) for (const s of [-1, 1]) put(G, s * 1.94, 6, z, s < 0 ? '#fde68a' : '#bae6fd', 0.8);
    // hanging lamps over the aisles (the unlit aisle's lamps are separate)
    for (let z = 2; z >= -14; z -= 4) for (const x of [-5.5, 5.5]) if (!(x > 0 && z === -14)) put(G, x, 12, z, '#fde68a', 2.2);
    for (const z of [18, 14, 9]) for (const x of [-8, 8, -16, 16]) put(G, x, 12, z, '#fde68a', 2);
    // study tables with green banker's lamps (atrium)
    for (const [x, z] of [[-15, 10], [-15, 14], [-8, 20], [8, 20], [15, 10]]) {
      for (let dx = -1; dx <= 1; dx++) put(B, x + dx, 3, z, '#7c5026');
      put(G, x, 4, z, '#22c55e', 1.4); put(D, x + 1, 4, z, '#e5e7eb');
    }
    // the circulation desk: a sign and a bell
    for (let x = -3; x <= 3; x++) put(D, x, 3.5, DESK.z + 0.45, '#5b3a1c');
    put(G, 2.5, 4, DESK.z, '#fbbf24', 1.2);
    for (let x = -2; x <= 2; x++) put(G, x, 6.5, DESK.z - 1.6, x ? '#f8fafc' : '#fde68a', 0.6);
    // TritonGym wing: a banner, paper stacks, the lectern
    for (let x = -22; x <= -15; x++) put(G, x, 9, -1.4, x % 2 ? '#4ade80' : '#0ea5e9', 1.1);
    for (const [x, z] of [[-24, -4], [-13, -15], [-24, -14], [-13, -3]]) for (let y = 3; y <= 4 + (hash3(x, 1, z) * 3 | 0); y++) put(B, x, y, z, y % 2 ? '#f5f5f4' : '#e7e5e4');
    // (Re)²H₂O wing: traffic cones, a start line, a banner
    for (const [x, z] of [[12.4, 6], [13.6, 7.5], [22.5, 6], [24, 8.4]]) { put(D, x, 3, z, '#f97316'); put(D, x, 3.6, z, '#f8fafc'); }
    for (let x = TRACK.x0; x <= TRACK.x1; x++) put(D, x, 2.06, TRACK.z1 - 1, (x & 1) ? '#f8fafc' : '#111827');
    for (let x = 14; x <= 22; x++) put(G, x, 9, 9.5, x % 2 ? '#f43f5e' : '#38bdf8', 1);
    // the Defense door: dark wood, a gold mortarboard emblem
    const door = [];
    for (let x = -2; x <= 2; x++) for (let y = 3; y <= 10; y++) {
      const emblem = (y === 8 && Math.abs(x) <= 2) || (y === 7 && Math.abs(x) <= 1) || (x === 2 && y === 6);
      door.push([x, y, -20, emblem ? '#fbbf24' : (x + y) & 1 ? '#5b2b12' : '#6b3416', emblem ? 1.4 : 0]);
    }
    for (let x = -3; x <= 3; x++) put(G, x, 11.5, -19.4, '#fbbf24', 0.9);
    // the antechamber: two torches and a rug
    for (const x of [-3, 3]) { put(B, x, 3, -24, '#44403c'); put(G, x, 4, -24, '#f97316', 2.6); }
    for (let z = -25; z <= -21; z++) put(D, 0, 2.06, z, '#7c3aed');

    props(ctx, D, { shadow: false });
    props(ctx, B, { block: true });
    const glowMesh = props(ctx, G, { shadow: false });
    const doorMesh = props(ctx, door, { block: true, shadow: false });
    // the unlit aisle's lamps (off until someone finds the switch)
    const darkLamps = props(ctx, [[5.5, 12, -14, '#fde68a', 2.4], [3, 12, -14, '#fde68a', 2], [8, 12, -14, '#fde68a', 2]], { shadow: false });
    darkLamps.visible = !!st.lux;

    // ================================================================ enemies and library life
    const kinds = {
      'sx-overdue': { name: 'Overdue Notice', hp: 16, speed: 5, dmg: 5, type: 'Flying', xp: 10, gold: 9, behaviour: 'swarm', flying: true, scale: 0.16, color: '#fef9c3' },
      'sx-dust': { name: 'Dust Bunny', hp: 32, speed: 3.2, dmg: 7, type: 'Normal', xp: 16, gold: 14, behaviour: 'chase', scale: 0.17, color: '#9ca3af' },
      'sx-latefee': { name: 'Late Fee', hp: 26, speed: 2.6, dmg: 7, type: 'Electric', xp: 18, gold: 25, behaviour: 'ranged', proj: 'star', rate: 2400, scale: 0.17, color: '#fbbf24' },
      'sx-papercut': { name: 'Paper Cut', hp: 28, speed: 4, dmg: 8, type: 'Flying', xp: 18, gold: 14, behaviour: 'charge', rate: 2800, scale: 0.18, color: '#f1f5f9' },
      'sx-silverfish': { name: 'Silverfish (harmless, well read)', hp: 8, speed: 1.6, behaviour: 'wander', xp: 1, gold: 1, scale: 0.12, color: '#cbd5e1' },
      'sx-cart': { name: 'Runaway Book Cart', hp: 20, speed: 1.8, behaviour: 'wander', xp: 2, gold: 3, scale: 0.16, color: '#64748b' },
      'sx-nitpick': { name: 'Nitpick', hp: 12, speed: 5.5, dmg: 4, type: 'Psychic', xp: 5, gold: 4, behaviour: 'swarm', scale: 0.14, respawn: false, color: '#ef4444' },
      'sx-rogue': { name: 'Generated Traffic (adversarial)', hp: 30, speed: 4.6, dmg: 7, type: 'Normal', xp: 12, gold: 10, behaviour: 'charge', rate: 2300, aggro: 30, leash: 60, scale: 0.2, respawn: false, color: '#f43f5e' },
    };
    for (const [id, k] of Object.entries(kinds)) registerEnemyKind(id, k);
    for (const [kind, list] of [
      ['sx-overdue', [[-6, 2], [6, -10]]], ['sx-dust', [[5, -2], [-6, -14]]], ['sx-latefee', [[18, 14], [-20, 11]]],
      ['sx-papercut', [[-16, -19]]], ['sx-silverfish', [[3, -6], [-3, 7.5]]], ['sx-cart', [[-10, 13]]],
    ]) for (const [x, z] of list) spawnEnemy(ctx, { kind, x, z });

    // ================================================================ NPCs
    const need = () => ROAD.filter((r) => !hasItem(r.id));
    const booksHeld = () => OVERDUE.filter((b) => st.picked?.[b.id]).length;
    spawnNpc(ctx, {
      id: 'stacks-quire', name: 'Quire · Stacks librarian', sprite: 'sx-quire', x: QUIRE.x, z: QUIRE.z, face: 0,
      news: () => !st.metQuire || (booksHeld() >= 4 && !st.returned),
      talk: () => {
        st.metQuire = true; ctx.save();
        const n = booksHeld();
        const books = st.returned
          ? { label: 'Any more overdue books?', next: { text: 'All four are home. The Vim one is still warm. Whoever had it must have been in there a while.', choices: [{ label: 'Poor soul' }] } }
          : n >= 4
            ? { label: `Return the books (${n}/4)`, icon: 'book-open', action: () => returnBooks() }
            : { label: st.askedBooks ? `Overdue books (${n}/4)` : 'Can I help with anything?', icon: 'book-open', next: () => { st.askedBooks = true; ctx.save(); return { text: 'Four books went overdue and wandered off into the stacks. One is on top of a shelf (someone used the step stools, unsafely). One is in the unlit aisle on the east side. One went to the TritonGym wing, one to the test track. No late fees. I just want them home.', note: `Found so far: ${n}/4.`, choices: [{ label: 'I’ll bring them back' }] }; } };
        return {
          text: 'Welcome to the Stacks, the floors under Geisel Library. The papers live down here. Inside voices, please.',
          choices: [
            books,
            { label: 'What is this place?', next: { text: 'Geisel Library is named for Theodor Geisel, known to the world as Dr. Seuss. Down here: the TritonGym wing to the west (under review, ICML 2026) and the (Re)²H₂O wing to the east (IEEE IV 2023). North: the Defense.', choices: [{ label: 'Thank you (quietly)' }] } },
            { label: 'What is behind the big door?', next: () => defenseNode() },
            { label: 'Why so quiet?', next: { text: 'Shhh. It is a library. Swords are fine. Honking is not. Sprinting past my desk is… noted.', choices: [{ label: '(whispering) Okay' }] } },
            { label: 'Bye' },
          ],
        };
      },
    });
    spawnNpc(ctx, {
      id: 'stacks-rebutta', name: 'Rebutta · author response desk', sprite: 'sx-rebutta', x: ARENA.x, z: 4.6, face: Math.PI,
      news: () => !st.metRebutta,
      talk: () => {
        st.metRebutta = true; ctx.save();
        return {
          text: 'Author response period is open! Reviewer 3 is waiting in the ring. It sheds comments like confetti: pick one up and answer it. Good answers crack its shield. Bad answers are safe: it just “maintains its score”.',
          choices: [
            { label: 'Any rebuttal tips?', next: { text: 'Say thank you. Answer the question that was asked. Point at evidence. Never write “the reviewer is wrong”, even when the reviewer is wrong.', choices: [{ label: 'Polite. Specific. Evidence.' }] } },
            { label: 'Which paper is this?', next: { text: 'TritonGym: A Benchmark for Agentic LLM Workflows in Triton GPU Code Generation. Yue Guan*, Yichen Lin*, et al. (* equal contribution). Status: under review, ICML 2026. So the seal you can win here says exactly that.', choices: [{ label: 'An honest seal' }] } },
            { label: 'Is that Reviewer #2?', next: { text: 'No! Reviewer #2 lives in the eucalyptus grove on the island. This is Reviewer 3. Different reviewer, same energy, confidence 5.', choices: [{ label: 'Same energy' }] } },
            { label: 'Show me the ring', action: () => cinematic(ctx, { x: ARENA.x, y: 4, z: ARENA.z, pitch: 0.45, dist: 16, seconds: 2.2 }) },
            { label: 'Bye' },
          ],
        };
      },
    });
    spawnNpc(ctx, {
      id: 'stacks-scenegen', name: 'SCENE-GEN · scenario generator', sprite: 'sx-scenegen', x: 21.5, z: 6.5, face: Math.PI,
      news: () => !st.metGen,
      talk: () => {
        st.metGen = true; ctx.save();
        return {
          text: 'BEEP. I generate driving scenarios for autonomous cars to survive. In the paper, (Re)²H₂O, that is autonomous-driving scenario generation via reversely regularized hybrid offline-and-online reinforcement learning. Haoyi Niu*, Kun Ren*, Yichen Lin, et al. IEEE Intelligent Vehicles Symposium, 2023.',
          choices: [
            { label: 'Start the scenario suite', icon: 'crossed-swords', next: () => startNode() },
            { label: 'How does it work here?', next: { text: 'Three scenarios, 20 seconds each, on the track. OFFLINE: traffic replayed from a log, same every time. ONLINE: traffic that adapts and comes for you. HYBRID: both at once. The clock only runs while you are on the track. Collisions are data, not failures. The sports car is recommended.', choices: [{ label: 'Understood' }] } },
            { label: 'Why that name?', next: () => { findName(); return { text: 'My reading of the title: Re + Re = Reversely Regularized, H + 2 + O = Hybrid Offline-and-Online. No chemistry was involved. Please do not pour water on me.', choices: [{ label: 'H₂O, noted' }] }; } },
            { label: 'Bye' },
          ],
        };
      },
    });

    // ================================================================ the Defense door
    const itemName = (r) => `${r.name} (${regionName(r.region)})`;
    function defenseNode() {
      findDoor();
      const miss = need();
      if (st.doorOpen || !miss.length) return { text: S.world.data.finale?.graduated ? 'The Defense: passed. The committee is happy to reconvene whenever you like. They miss you. They will not say so.' : 'The Defense is open. The committee is ready. Walk through the door when you are.', choices: [{ label: 'Deep breath' }] };
      return {
        text: `The Defense. Sealed until the Road to Dr. is complete: ${ROAD.length - miss.length} of ${ROAD.length} collected, ${miss.length} still missing.`,
        note: `Missing: ${miss.slice(0, 6).map(itemName).join(' · ')}${miss.length > 6 ? ` · and ${miss.length - 6} more` : ''}. L shows the full trophy board.`,
        choices: [{ label: 'I’ll be back' }],
      };
    }
    let finalePortal = null;
    function openDoor(fanfare) {
      if (!st.doorOpen) { st.doorOpen = true; ctx.save(); }
      doorMesh.visible = false;
      for (let x = -2; x <= 2; x++) unblock(ctx, x, -20);
      if (!finalePortal) finalePortal = portal(ctx, { x: 0, z: -23.5, to: 'finale', label: 'The Defense', color: '#fbbf24' });
      if (fanfare && ctx.live) {
        sfx('door');
        cinematic(ctx, { x: 0, y: 6, z: -21, yaw: 0, pitch: 0.3, dist: 16, seconds: 2.6 });
        banner('The Defense is open', 'All thirteen collected. The committee awaits, deep in the Stacks.', 'graduation-cap');
        setTimeout(() => say('stacks-quire', 'Good luck in there. Speak up. It is the one room where you are allowed to.'), 2800);
      }
    }
    interactable(ctx, { x: 0, z: -18.2, r: 2.4, label: 'The Defense', prompt: 'E · read the door', plateY: 9.5, onInteract: () => dialog(defenseNode, { name: 'The Defense', sprite: 'book' }) });
    trigger(ctx, { x: 0, z: -18, r: 3, onEnter: () => {
      if (st.doorOpen || !every('door', 20)) return;
      const miss = need();
      toast(`Sealed: ${ROAD.length - miss.length} / ${ROAD.length}. ${miss.length} item${miss.length === 1 ? '' : 's'} missing on the Road to Dr.`, { icon: 'lock' });
    } });
    if (st.doorOpen || !need().length) openDoor(false);
    on('road:complete', () => openDoor(true));

    // ================================================================ TritonGym wing: the rebuttal
    const R3 = { shield: 3, open: 0, score: 3, cd: 3, right: 0, wrong: 0, queue: [], live: [] };
    const refill = () => { R3.queue = COMMENTS.map((c) => c).sort(() => ctx.rand() - 0.5); };
    const boss = spawnBoss(ctx, {
      id: 'stacks-reviewer3', name: 'Reviewer 3', sprite: 'sx-reviewer3', scale: 0.28, x: ARENA.x, z: ARENA.z,
      hp: 360, type: 'Ghost', r: 1.5, color: '#f43f5e', contact: 10, speed: 1.2, aggro: 12, move: 'blink',
      pattern: ['fan', 'rings', 'fan', 'summon'], phases: [{ below: 0.5, pattern: ['volley', 'rings', 'summon', 'fan'] }],
      minion: 'sx-nitpick', reward: { gold: 420, xp: 170 }, drop: 'seal-tritongym', respawn: 120000,
      onDefeat: (b, { first }) => {
        clearComments();
        findSealTG();
        if (R3.wrong === 0 && R3.right >= 3) findPolite();
        banner(first ? 'Seal obtained: TritonGym · Under review' : 'Review updated (again)', 'Reviewer 3 raised its score and passed it to the Area Chair. Final decision: pending. Status: under review, ICML 2026. An honest seal.', 'tied-scroll');
        setTimeout(() => say('me', first ? 'No decision yet. That is fine. That is honest.' : 'Rebuttal round two: survived.'), 1200);
      },
    });
    const bossHit = boss.hit.bind(boss);
    boss.hit = (dmg, info) => {
      if (R3.open > 0) return bossHit(Math.round(dmg * 1.25), info);
      if (every('shield', 6)) toast('Unconvinced: its shield takes almost nothing. Pick up its red comments and answer them to crack the shield.', { icon: 'magic-shield', tone: 'bad' });
      return bossHit(Math.max(1, Math.round(dmg * 0.1)), info);
    };
    function clearComments() { for (const p of R3.live) { p.remove(); ctx.group.remove(p.mesh); } R3.live.length = 0; }
    function dropComment() {
      for (let i = 0; i < 10; i++) {
        const a = ctx.rand() * Math.PI * 2, r = 1.5 + ctx.rand() * (ARENA.r - 2.2);
        const x = ARENA.x + Math.cos(a) * r, z = ARENA.z + Math.sin(a) * r;
        if (lp(x, z) < 2) continue;
        const p = pickup(ctx, { x, z, sprite: 'sx-comment', scale: 0.13, onPick: () => {
          R3.live.splice(R3.live.indexOf(p), 1);
          setTimeout(() => ctx.group.remove(p.mesh), 0);
          rebut();
        } });
        R3.live.push(p);
        fx.burst(p.mesh.position.x, p.base, p.mesh.position.z, '#fca5a5', 8, 3, 0.4, 0.5);
        return;
      }
    }
    function rebut() {
      if (!R3.queue.length) refill();
      const c = R3.queue.pop();
      const opts = [{ label: c.good, good: true }, ...c.bad.map((b) => ({ label: b, good: false }))].sort(() => ctx.rand() - 0.5);
      R3.goodIdx = opts.findIndex((o) => o.good);
      dialog({
        text: `Reviewer 3 writes: “${c.c}”`,
        note: 'Your response (take your time: the world waits):',
        choices: opts.map((o) => ({ label: o.label, action: () => grade(c, o.good) })),
      }, { name: 'Author response', sprite: 'sx-comment' });
    }
    function grade(c, good) {
      if (!boss.alive) return;
      if (!good) {
        R3.wrong++;
        R3.queue.unshift(c);
        sfx('error');
        toast('Reviewer 3: “Thank you for your response. I maintain my score.” (Nothing else happens. Try another comment.)', { icon: 'scroll-text' });
        return;
      }
      R3.right++;
      if (c.id === 'cite') findCite();
      sfx('stamp');
      bossHit(Math.ceil(boss.maxHp * 0.06));
      if (R3.open > 0) { toast('Well argued. It is already convinced; hit it!', { icon: 'check', tone: 'good' }); return; }
      R3.shield = Math.max(0, R3.shield - 1);
      if (R3.shield > 0) { toast(`Good rebuttal. Its shield cracks (${R3.shield} left).`, { icon: 'check', tone: 'good' }); return; }
      R3.open = 10;
      R3.score = Math.min(6, R3.score + 1);
      clearComments();
      sfx('boom');
      banner(`Score raised: ${R3.score} (${SCORE[R3.score]})`, 'Its shield is down for 10 seconds. Everything lands now!', 'magic-shield');
    }
    let introAt = -1e9;
    trigger(ctx, { x: ARENA.x, z: ARENA.z, r: ARENA.r, onEnter: () => {
      if (!boss.alive || lastT - introAt < 60) return;
      introAt = lastT;
      cinematic(ctx, { x: ARENA.x, y: 4, z: ARENA.z, pitch: 0.45, dist: 15, seconds: 2 });
      banner('REVIEWER 3', 'Not Reviewer #2. Confidence: 5. Pick up its red comments and answer them to crack its shield.', 'scroll-text');
      sfx('encounter');
    } });

    // ================================================================ (Re)²H₂O wing: the scenario track
    const _m = new THREE.Matrix4(), _c = new THREE.Color();
    const inst = (geo, n, mat) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.castShadow = false; ctx.group.add(m); return m; };
    const NCAR = 8;
    const bodies = inst(new THREE.BoxGeometry(1.7, 0.9, 3.2), NCAR, new THREE.MeshStandardNodeMaterial({ roughness: 0.4, metalness: 0.3 }));
    const cabins = inst(new THREE.BoxGeometry(1.4, 0.7, 1.5), NCAR, new THREE.MeshStandardNodeMaterial({ roughness: 0.2, metalness: 0.2 }));
    const lamps = inst(new THREE.BoxGeometry(0.8, 0.8, 0.8), LANES.length, new THREE.MeshBasicNodeMaterial());
    const CAR_COL = ['#38bdf8', '#f472b6', '#facc15', '#a3e635', '#fb923c', '#e5e7eb', '#c084fc', '#2dd4bf'];
    const cars = Array.from({ length: NCAR }, (_, i) => ({ on: false, lane: 0, z: 0, speed: 0, i }));
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < NCAR; i++) { bodies.setMatrixAt(i, _m); cabins.setMatrixAt(i, _m); bodies.setColorAt(i, _c.set(CAR_COL[i])); cabins.setColorAt(i, _c.set('#bae6fd')); }
    LANES.forEach((ln, i) => { _m.makeTranslation(ln.x + ctx.ox, 4.9, (ln.dir > 0 ? TRACK.z0 - 1 : TRACK.z1 + 1) + ctx.oz); lamps.setMatrixAt(i, _m); lamps.setColorAt(i, _c.set('#14532d')); block(ctx, ln.x, ln.dir > 0 ? TRACK.z0 - 1 : TRACK.z1 + 1); });
    const laneStart = (ln) => (ln.dir > 0 ? TRACK.z0 + 0.5 : TRACK.z1 - 0.5);
    const laneEnd = (ln) => (ln.dir > 0 ? TRACK.z1 + 0.2 : TRACK.z0 - 0.2);
    const sealion = sprite(ctx, 'sealion', { x: TRACK.x1, z: -9, scale: 0.16, face: -Math.PI / 2 });
    sealion.visible = false;

    const SCN = [
      { key: 'OFFLINE', title: 'Scenario 1 · OFFLINE', sub: 'Replayed from a driving log: the same traffic, every time. Watch the lane lights, learn the pattern.' },
      { key: 'ONLINE', title: 'Scenario 2 · ONLINE', sub: 'The generator is learning from you now. Adversarial traffic adapts, telegraphs, and charges. Dodge, or bowl it over with the car.' },
      { key: 'HYBRID', title: 'Scenario 3 · HYBRID', sub: 'Offline and online at once. Regularized to stay realistic. Mostly.' },
    ];
    const LOG = [0, 2, 1, 0, 1, 2, 2, 0, 1];                  // the replayed log (lane order)
    const SC = { run: -1, t: 0, spawnT: 1.2, logI: 0, pend: [], rogues: [], lion: 0, off: 0, hits: 0, nextIn: 0, nextI: 0 };
    const DUR = 20;
    function startNode() {
      if (SC.run >= 0) return { text: 'SCENE-GEN: A scenario is already running. Get on the track!', choices: [{ label: 'On it' }] };
      if (ctx.player.vehicle === 'car') return { text: 'SCENE-GEN: Test car detected. Generating traffic…', choices: [{ label: 'Go', icon: 'crossed-swords', action: () => startSuite() }, { label: 'Not yet' }] };
      return {
        text: 'SCENE-GEN: Recommended vehicle for this suite: the sports car. You can also go on foot. I will not judge. I will log it.',
        choices: [
          { label: 'Take the test car', icon: 'horse-head', action: () => { getInCar(); startSuite(); } },
          { label: 'On foot (brave)', action: () => startSuite() },
          { label: 'Not yet' },
        ],
      };
    }
    function getInCar() {
      const v = window.__g?.vehicles;
      if (v?.set) { v.set('car'); toast('Test car: W/S drive · A/D steer · Space drift · Shift boost · H honk (please don’t, it is a library).', { icon: 'horse-head' }); }
      else toast('Press V until the sports car appears.', { icon: 'horse-head' });
    }
    function startSuite() {
      SC.nextIn = 0;
      const from = st.scen >= 3 ? 0 : (st.scen || 0);
      beginScenario(from);
    }
    function beginScenario(i) {
      SC.run = i; SC.t = 0; SC.spawnT = 1.5; SC.logI = 0; SC.pend.length = 0; SC.lion = i === 2 ? 1 : 0; SC.off = 0; SC.hits = 0;
      sfx('encounter');
      banner(SCN[i].title, SCN[i].sub, 'hazard-sign');
      if (i >= 1) for (let k = 0; k < (i === 1 ? 3 : 2); k++) spawnRogue(k);
    }
    function spawnRogue(k) {
      const x = TRACK.x0 + 1.5 + ((k * 4.3 + ctx.rand() * 3) % (TRACK.x1 - TRACK.x0 - 3));
      const z = TRACK.z0 + 2 + ctx.rand() * 8;
      const f = spawnEnemy(ctx, { kind: 'sx-rogue', x, z, onDeath: () => {
        if (player.vehicle === 'car') findBowl();
        const i = SC.rogues.indexOf(f); if (i >= 0) SC.rogues.splice(i, 1);
        setTimeout(() => { f.remove(); if (SC.run >= 1 && SC.rogues.length < (SC.run === 1 ? 3 : 2)) spawnRogue(k + 1); }, 2500);
      } });
      fx.burst(f.x, f.y + 1, f.z, '#f43f5e', 12, 4, 0.5, 0.6);
      SC.rogues.push(f);
    }
    function stopTraffic() {
      for (const c of cars) c.on = false;
      SC.pend.length = 0;
      for (const f of SC.rogues.splice(0)) f.remove();
      sealion.visible = false;
      _m.makeScale(0, 0, 0);
      for (let i = 0; i < NCAR; i++) { bodies.setMatrixAt(i, _m); cabins.setMatrixAt(i, _m); }
      bodies.instanceMatrix.needsUpdate = cabins.instanceMatrix.needsUpdate = true;
      LANES.forEach((ln, i) => lamps.setColorAt(i, _c.set('#14532d')));
      lamps.instanceColor.needsUpdate = true;
    }
    function endScenario(ok, why = '') {
      const i = SC.run;
      stopTraffic();
      SC.run = -1;
      if (!ok) { if (why) toast(why, { icon: 'rotate-ccw' }); return; }
      sfx('victory');
      if ((st.scen || 0) < i + 1) { st.scen = i + 1; ctx.save(); }
      if (i === 0) findOffline();
      if (i < 2) {
        toast(`${SCN[i].key} scenario survived${SC.hits ? ` (${SC.hits} collision${SC.hits > 1 ? 's' : ''} logged as data)` : ' without a scratch'}. Next one in 3 s…`, { icon: 'check', tone: 'good' });
        SC.nextIn = 3; SC.nextI = i + 1;
        return;
      }
      findSuite();
      const first = award('seal-reh2o');
      banner(first ? 'Seal obtained: (Re)²H₂O · Published' : 'Scenario suite passed (again)', 'IEEE Intelligent Vehicles Symposium (IV), 2023. Offline, online, hybrid: survived.', 'tied-scroll');
      setTimeout(() => say('stacks-scenegen', first ? 'BEEP. Suite passed. Logging you as “robust”. Also as “honked twice”.' : 'BEEP. Robust, again.'), 1500);
    }
    function queueCar(lane) { SC.pend.push({ lane, at: SC.t + 1.2 }); }
    function launch(lane) {
      const c = cars.find((q) => !q.on);
      if (!c) return;
      const ln = LANES[lane];
      Object.assign(c, { on: true, lane, z: laneStart(ln), speed: SC.run === 0 ? 8 : 9 + ctx.rand() * 2 });
    }
    interactable(ctx, { x: 17.5, z: 5.2, r: 2.4, label: 'Scenario suite', prompt: 'E · generate scenarios', onInteract: () => dialog(startNode, { name: 'SCENE-GEN', sprite: 'sx-scenegen' }) });
    interactable(ctx, { x: 14, z: 7.5, r: 2, label: 'Test car (parked)', prompt: 'E · get in', onInteract: () => getInCar() });
    const board = h('div', { class: 'g__plate', style: { pointerEvents: 'none', fontWeight: '600' } }, '');
    let boardText = '';
    fx.pin(board, () => (ctx.playing && (SC.run >= 0 || lp(18, 4) < 16) ? { x: 18 + ctx.ox, y: 10.5, z: 9.5 + ctx.oz } : null), { region: 'stacks', nearOnly: true });

    // ================================================================ interactables, pickups, eggs
    const findSeuss = egg('stacks-seuss', 'The only Dr. down here', 'Something striped was left on a shelf in the Seuss corner.', 'Geisel Library is named for Theodor Geisel: Dr. Seuss. So far, the only Dr. in the building.');
    const findLux = egg('stacks-fiatlux', 'Fiat lux', 'One aisle in the stacks has no light. Find the switch.', '“Let there be light”: the University of California motto.');
    const findShush = egg('stacks-shush', 'Shhh!', 'Make some noise near the circulation desk.', 'Quire shushed you. It is a library. (Swords are fine, apparently.)');
    const findHonk = egg('stacks-honk', 'Honk in a library', 'The car has a horn. The library has a librarian.', 'The loudest shush in the history of Geisel.');
    const findDesk = egg('stacks-desk', 'Off the desk', 'Stand somewhere you should not, near the circulation desk.', 'Quire would like you to get down. Now. Quietly.');
    const findBib = egg('stacks-bibtex', 'Cite me', 'Look something up in the card catalog.', 'Two BibTeX entries: guan2026tritongym and niu2023re2h2o.');
    const findStars = egg('stacks-asterisks', 'Equal contribution', 'Two asterisks are loose in the wings. Find both.', 'Yue Guan* and Yichen Lin* (TritonGym); Haoyi Niu* and Kun Ren* ((Re)²H₂O). Asterisks: equal contribution.');
    const findCite = egg('stacks-cite', 'We have added the citation', 'Answer the comment every author has seen.', 'The oldest move in the rebuttal book.');
    const findPolite = egg('stacks-polite', 'Polite, specific, evidence-based', 'Beat Reviewer 3 without a single bad answer.', 'A textbook rebuttal. Reviewer 3 is touched. It will not say so.');
    const findSealTG = egg('stacks-underreview', 'Under review', 'Win the rebuttal against Reviewer 3.', 'TritonGym: under review at ICML 2026. The seal says so, because that is the truth.');
    const findOffline = egg('stacks-offline', 'Replayed from the log', 'Survive the OFFLINE scenario on the test track.', 'Offline data: the same traffic every time. Easy once you have seen it.');
    const findSuite = egg('stacks-iv2023', 'IEEE IV 2023', 'Survive all three generated scenarios.', '(Re)²H₂O: autonomous-driving scenario generation, published at the IEEE Intelligent Vehicles Symposium 2023.');
    const findBowl = egg('stacks-bowl', 'Adversarial, meet adversarial', 'Knock out generated traffic with your own car.', 'The generator made them to test you. You tested them back.');
    const findLion = egg('stacks-cornercase', 'Corner case', 'Something rare crosses the track during the HYBRID scenario.', 'A sea lion on the road. UCSD has sea lions; scenario generators should, too.');
    const findName = egg('stacks-h2o', 'H₂O, but make it RL', 'Ask SCENE-GEN about its name.', 'Reversely Regularized (Re²), Hybrid Offline-and-Online (H₂O). No chemistry involved.');
    const findDoor = egg('stacks-door', 'Thirteen seals on a door', 'Read the Defense door.', 'A diploma, six badges, four relics and two seals: the Road to Dr.');
    const findOverdue = egg('stacks-overdue', 'Returned, eventually', 'Help Quire with the overdue books.', 'Rust, Vim, LaTeX and RL: all home. No late fees (this once).');

    interactable(ctx, { x: -20, z: 17, r: 2.4, label: 'A striped hat, left on a shelf', prompt: 'E · look', sprite: 'hat', spriteScale: 0.13, plateY: 2.4, onInteract: () => {
      findSeuss();
      dialog({ text: 'A tall striped hat on a small shelf. The label reads: “Property of the building’s namesake.” Geisel Library is named for Theodor Geisel, better known as Dr. Seuss.', note: 'So far, the only Dr. down here. That could change.', choices: [{ label: 'Leave it be' }] }, { name: 'The Seuss corner', sprite: 'hat' });
    } });
    const bibNode = () => ({
      text: 'CARD CATALOG · two entries under “Lin, Yichen”.',
      choices: [
        { label: 'guan2026tritongym', next: () => { findBib(); return { text: '@misc{guan2026tritongym, title = {TritonGym: A Benchmark for Agentic LLM Workflows in Triton GPU Code Generation}, author = {Guan, Yue and Lin, Yichen and others}, note = {Under review at ICML 2026}, year = {2026}}', note: 'Shelved in the west wing.', choices: [{ label: 'Back', next: bibNode }, { label: 'Close' }] }; } },
        { label: 'niu2023re2h2o', next: () => { findBib(); return { text: '@inproceedings{niu2023re2h2o, title = {(Re)$^2$H$_2$O: Autonomous Driving Scenario Generation via Reversely Regularized Hybrid Offline-and-Online Reinforcement Learning}, author = {Niu, Haoyi and Ren, Kun and Lin, Yichen and others}, booktitle = {IEEE Intelligent Vehicles Symposium (IV)}, year = {2023}}', note: 'Shelved in the east wing, next to the test track.', choices: [{ label: 'Back', next: bibNode }, { label: 'Close' }] }; } },
        { label: 'Close' },
      ],
    });
    props(ctx, [...[14, 15, 16].flatMap((x) => [[x, 3, 16, '#7c5026'], [x, 4, 16, '#8a5a2b']]), [15, 5, 16, '#22d3ee', 1.2]], { block: true });
    interactable(ctx, { x: 15, z: 14.6, r: 2.2, label: 'Card catalog', prompt: 'E · look up', onInteract: () => dialog(bibNode, { name: 'Card catalog', sprite: 'book' }) });
    // the unlit aisle
    interactable(ctx, { x: 1.4, z: -14, r: 1.6, label: st.lux ? 'Light switch (on)' : 'Light switch', prompt: 'E · flip', onInteract: (hh) => {
      sfx('flip');
      if (!st.lux) {
        st.lux = true; ctx.save(); darkLamps.visible = true; findLux(); hh.setLabel('Light switch (on)');
        banner('Fiat lux', 'Let there be light: the University of California motto. The aisle lights up, and so does an overdue book.', 'sparkle');
        spawnBook(OVERDUE[1]);
      } else toast('It is on. Fiat lux stays lux.', { icon: 'sparkle' });
    } });
    // the step stools up to a shelf top (the Rust book)
    platform(ctx, { x: -3, z: -6, w: 1, d: 1, y: 4, color: '#a16207' });
    platform(ctx, { x: -5, z: -6, w: 1, d: 1, y: 6, color: '#b45309' });
    platform(ctx, { x: -7, z: -6, w: 1, d: 1, y: 8, color: '#c2410c' });
    // overdue books
    function spawnBook(b) {
      if (st.picked?.[b.id]) return;
      pickup(ctx, { id: b.id, x: b.x, z: b.z, sprite: 'book', scale: 0.12, onPick: () => toast(`Overdue book (${booksHeld()}/4): “${b.title}”. ${b.note}`, { icon: 'book-open' }) });
    }
    for (const b of OVERDUE) if (b !== OVERDUE[1] || st.lux) spawnBook(b);
    function returnBooks() {
      st.returned = true; ctx.save();
      sfx('achievement'); findOverdue();
      banner('Books returned', 'Rust, Vim, LaTeX, RL. The stacks are whole again. No late fees (this once).', 'book-open');
      say('stacks-quire', 'Thank you. Here: a library card. It opens exactly nothing, but it is very shiny.');
    }
    quest({
      id: 'stacks-overdue', title: 'Overdue, not forgotten',
      steps: [
        { id: 'ask', text: 'Ask Quire if she needs help (circulation desk)', done: () => !!st.askedBooks },
        { id: 'find', get text() { return `Find the 4 overdue books (${booksHeld()}/4)`; }, done: () => booksHeld() >= 4 },
        { id: 'back', text: 'Return them to Quire', done: () => !!st.returned },
      ],
      reward: { gold: 180, xp: 80 },
    });
    // asterisks
    const starCount = () => ['stacks-star-1', 'stacks-star-2'].filter((id) => st.picked?.[id]).length;
    pickup(ctx, { id: 'stacks-star-1', x: -24, z: 1, sprite: 'sx-asterisk', scale: 0.14, onPick: () => { toast('An asterisk: Yue Guan*, Yichen Lin*. Equal contribution (TritonGym).', { icon: 'sparkle' }); if (starCount() >= 2) findStars(); } });
    pickup(ctx, { id: 'stacks-star-2', x: 24.5, z: 5, sprite: 'sx-asterisk', scale: 0.14, onPick: () => { toast('An asterisk: Haoyi Niu*, Kun Ren*. Equal contribution ((Re)²H₂O).', { icon: 'sparkle' }); if (starCount() >= 2) findStars(); } });
    // signs
    interactable(ctx, { x: -12.5, z: 2, r: 2, label: 'TritonGym wing', prompt: 'E · read', onInteract: () => dialog({ text: 'TRITONGYM WING. TritonGym: A Benchmark for Agentic LLM Workflows in Triton GPU Code Generation. Yue Guan*, Yichen Lin*, et al. Status: under review, ICML 2026. Author response in progress: please do not feed the reviewer.', choices: [{ label: 'Understood' }] }, { name: 'Wing sign', sprite: 'book' }) });
    interactable(ctx, { x: 12.5, z: 2, r: 2, label: '(Re)²H₂O wing', prompt: 'E · read', onInteract: () => dialog({ text: '(RE)²H₂O WING. Autonomous Driving Scenario Generation via Reversely Regularized Hybrid Offline-and-Online Reinforcement Learning. Haoyi Niu*, Kun Ren*, Yichen Lin, et al. IEEE Intelligent Vehicles Symposium (IV), 2023. Published. Test track open: mind the generated traffic.', choices: [{ label: 'Mind the traffic' }] }, { name: 'Wing sign', sprite: 'book' }) });
    // standing on the circulation desk
    trigger(ctx, { x: DESK.x, z: DESK.z, w: 9, d: 1.2, minY: 3.3, onEnter: () => { findDesk(); shush('Off the desk. Now. Quietly.'); } });
    // noise near the desk
    function shush(line) {
      if (!every('shush', 5)) return;
      say('stacks-quire', line || ['Shhh!', 'SHHHH.', 'Inside voices. Inside swords.', 'This is a library, not a boss arena. (That is the next wing over.)'][Math.floor(ctx.rand() * 4)]);
      findShush();
    }
    on('vehicle:honk', () => { if (!ctx.live) return; findHonk(); rate.shush = -1e9; shush('SHHHHHHH! Did you just HONK? In GEISEL?'); });
    on('kill', () => { if (ctx.live && lp(QUIRE.x, QUIRE.z) < 12) shush(); });
    on('player:land', (impact) => { if (ctx.live && impact > 15 && lp(QUIRE.x, QUIRE.z) < 8) shush('Shh! Some of us are reading.'); });

    // ================================================================ the way home, arrival lines
    portal(ctx, { x: 0, z: 23.8, to: 'hub', label: 'Up to Geisel (UC San Diego)' });
    trigger(ctx, { x: 0, z: 17, r: 2.5, once: true, onEnter: () => say('bit', '(whispering) It’s a library. The papers are down here. And a very serious door up north.') });

    // debugging: grant the whole Road (only via ?region=…&road=all or __g.regions.builtRegion('stacks').debug)
    function grantAll() { for (const r of ROAD) award(r.id); }
    ctx.debug = { grantAll, get R3() { return R3; }, get SC() { return SC; }, boss, openDoor, lane: () => cars.filter((c) => c.on).length };
    const q = new URLSearchParams(location.search);
    if (q.get('region') && q.get('road') === 'all') setTimeout(grantAll, 1200);
    if (S.world.title) installDrTitle();

    // ================================================================ per frame
    let wasAlive = boss.alive, lx = ctx.player.x, lz = ctx.player.z;
    onUpdate(ctx, (dt, t) => {
      lastT = t;
      glowMesh.userData.setHi(0.25 + 0.15 * Math.sin(t * 1.3) + (Math.sin(t * 17) > 0.97 ? 0.3 : 0));
      // noise: sprinting past the desk
      const moved = Math.hypot(ctx.player.x - lx, ctx.player.z - lz) / Math.max(dt, 1e-3);
      lx = ctx.player.x; lz = ctx.player.z;
      if (player.sprinting && moved > 9 && lp(QUIRE.x, QUIRE.z) < 6) shush('Walk. Do not run. Especially not with a sword.');

      // ---- Reviewer 3
      if (boss.alive && !wasAlive) { Object.assign(R3, { shield: 2, open: 0, score: 3, cd: 3, right: 0, wrong: 0 }); }
      wasAlive = boss.alive;
      if (boss.alive) {
        if (R3.open > 0) {
          R3.open -= dt;
          if (R3.open <= 0) { R3.open = 0; R3.shield = 2; toast('Discussion phase: Reviewer 3 has new concerns. Shield back up (2).', { icon: 'magic-shield' }); }
        } else if (lp(ARENA.x, ARENA.z) < ARENA.r + 1) {
          R3.cd -= dt;
          if (R3.cd <= 0 && R3.live.length < 2) { R3.cd = 5; dropComment(); }
        } else if (R3.live.length && lp(ARENA.x, ARENA.z) > ARENA.r + 6) clearComments();
        boss.name = `Reviewer 3 · ${R3.open > 0 ? `CONVINCED (${Math.ceil(R3.open)} s)` : `shield ${'◆'.repeat(R3.shield)}`} · score ${R3.score} (${SCORE[R3.score]})`;
      }

      // ---- the scenario track
      if (SC.run < 0 && SC.nextIn > 0) { SC.nextIn -= dt; if (SC.nextIn <= 0) beginScenario(SC.nextI); }
      if (SC.run >= 0) {
        if (player.dead) { endScenario(false, 'Scenario reset. Collisions are data, not failures. Talk to SCENE-GEN to go again (progress kept).'); }
        else {
          const on = inTrack(ctx.player.x, ctx.player.z);
          if (on) { SC.t += dt; SC.off = 0; } else { SC.off += dt; if (SC.off > 25) endScenario(false, 'You left the track, so the scenario stopped. Progress kept: talk to SCENE-GEN to continue.'); }
          if (SC.run >= 0) {
            // offline / hybrid traffic from the log
            if (SC.run !== 1) {
              SC.spawnT -= on ? dt : 0;
              if (SC.spawnT <= 0) { SC.spawnT = SC.run === 0 ? 1.45 : 2.3; queueCar(LOG[SC.logI++ % LOG.length]); }
            }
            for (let i = SC.pend.length - 1; i >= 0; i--) if (SC.t >= SC.pend[i].at) { launch(SC.pend[i].lane); SC.pend.splice(i, 1); }
            // the sea lion: a rare corner case, crosses slowly, and nobody hits it
            if (SC.lion === 1 && SC.t > 6) { SC.lion = 2; sealion.visible = true; sealion.position.set(TRACK.x1 + ctx.ox, 2.5, -9 + ctx.oz); toast('Corner case generated: a sea lion is crossing the road. Yield!', { icon: 'hazard-sign' }); }
            if (SC.lion === 2) {
              const sx = sealion.position.x - ctx.ox;
              const wait = Math.hypot(ctx.player.x - sx, ctx.player.z + 9) < 3;
              if (!wait) sealion.position.x -= dt * 1.5;
              if (sx < TRACK.x0) { SC.lion = 3; sealion.visible = false; findLion(); toast('The sea lion made it across. Corner case: handled.', { icon: 'check', tone: 'good' }); }
            }
            if (SC.t >= DUR) endScenario(true);
          }
        }
      }
      // traffic: move, draw, collide
      let any = false;
      for (const c of cars) {
        if (!c.on) continue;
        any = true;
        const ln = LANES[c.lane];
        c.z += ln.dir * c.speed * dt;
        if ((ln.dir > 0 && c.z > laneEnd(ln)) || (ln.dir < 0 && c.z < laneEnd(ln))) { c.on = false; _m.makeScale(0, 0, 0); bodies.setMatrixAt(c.i, _m); cabins.setMatrixAt(c.i, _m); continue; }
        _m.makeTranslation(ln.x + ctx.ox, 2.95, c.z + ctx.oz); bodies.setMatrixAt(c.i, _m);
        _m.makeTranslation(ln.x + ctx.ox, 3.75, c.z - ln.dir * 0.3 + ctx.oz); cabins.setMatrixAt(c.i, _m);
        const dx = ctx.player.x - ln.x, dz = ctx.player.z - c.z;
        if (Math.abs(dx) < 1.3 && Math.abs(dz) < 2.1 && ctx.player.y < 5 && ctx.playing) {
          if (hurt(7, 'Generated traffic')) {
            SC.hits++;
            player.vx += (dx >= 0 ? 1 : -1) * 9;
            if (player.vehicle === 'car') player.carSpeed = (player.carSpeed || 0) * 0.3;
            fx.burst(player.x, player.y + 1, player.z, '#fde68a', 10, 4, 0.4, 0.5);
          }
        }
      }
      if (any || SC.run >= 0) { bodies.instanceMatrix.needsUpdate = true; cabins.instanceMatrix.needsUpdate = true; }
      if (SC.run >= 0) {
        LANES.forEach((ln, i) => {
          const warn = SC.pend.some((p) => p.lane === i);
          const busy = cars.some((c) => c.on && c.lane === i);
          lamps.setColorAt(i, _c.set(warn ? (Math.floor(t * 8) % 2 ? '#fbbf24' : '#78350f') : busy ? '#ef4444' : '#22c55e'));
        });
        lamps.instanceColor.needsUpdate = true;
      }
      // the billboard
      const txt = SC.run >= 0
        ? `${SCN[SC.run].title} · ${Math.max(0, Math.ceil(DUR - SC.t))} s${inTrack(ctx.player.x, ctx.player.z) ? '' : ' · paused: get on the track'}`
        : (st.scen >= 3 ? 'Scenario suite: passed · E at the start line to replay' : `Scenario suite · ${st.scen || 0} / 3 survived · E at the start line`);
      if (txt !== boardText) { boardText = txt; board.textContent = txt; }
    });

    const LINES = [
      '(whispering) Geisel’s basement. It smells like paper and deadlines.',
      '(whispering) West: TritonGym, under review. East: (Re)²H₂O, published. North: the big door.',
      '(whispering) Quire is watching us. Walk, don’t run.',
    ];
    let visit = 0;
    onEnter(ctx, () => {
      if (!st.visited) { st.visited = true; ctx.save(); }
      setTimeout(() => say('bit', LINES[visit++ % LINES.length]), 1100);
      if (!st.doorOpen && !need().length) openDoor(false);
    });
    onLeave(ctx, () => {
      if (SC.run >= 0) endScenario(false);
      SC.nextIn = 0;
      clearComments();
      if (boss.alive) { boss.hp = boss.maxHp; Object.assign(R3, { shield: 3, open: 0, score: 3, cd: 3 }); }
    });
  },
};
