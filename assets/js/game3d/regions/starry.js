// regions/starry.js: the Starry-Next kernel (a networking stack for a monolithic-kernel OS, in Rust; Yichen's
// graduation project). The island is a crater of privilege rings:
//   - arrive in ring 3 (user space) on the rim and walk down the south stairs, ring 3 → 2 → 1 → 0
//   - ring 0 is the kernel core, where the Jumbo Frame lumbers about wearing four layers of headers
//   - the north arcs of the rings are the network stack, climbed the way a received packet travels:
//     NIC (ring 0) → IP (ring 1) → TCP (ring 2) → socket (ring 3, back in user space). Bringing up each
//     layer strips one header off the Jumbo Frame (25% → full damage) and lets the packet stream climb higher
//   - side quest: Frag, a datagram split by a small MTU, wants its five fragments back (IP reassembly)
import * as THREE from 'three/webgpu';
import {
  terrain, props, registerArt, registerEnemyKind, spawnEnemy, spawnBoss, spawnNpc, interactable, trigger,
  pickup, portal, quest, egg, say, banner, toast, sfx, onUpdate, onEnter, onLeave, dialog, hash3, hasItem,
  cinematic,
} from '../regions.js';
import { STARRY_ART } from './art-starry.js';

const RUST = '#e2703a';
const H = [3, 6, 9, 12];                         // ring 0, 1, 2, 3 floor heights
const tierOf = (r) => (r < 10 ? 0 : r < 15 ? 1 : r < 20 ? 2 : 3);
const BOSS_HOME = { x: 0, z: 2 };
const NIC = { x: 3.5, z: -7.2 }, IP = { x: 4, z: -12.5 }, SOCK = { x: 4, z: -21.6 };
const PADS = [[-6.5, -16, 'SYN'], [-3.5, -17.5, 'SYN-ACK'], [3.5, -17.5, 'ACK']];
const LOOP = { x: 21, z: 7 };
const LAYER_NAMES = ['NIC', 'IP', 'TCP', 'socket'];
const HEADER_NAMES = ['Ethernet', 'IP', 'TCP', 'socket buffer'];
const HEADER_COL = ['#fb923c', '#3b82f6', '#22c55e', '#f8fafc'];
const LAYER_Z = [-8, -12.5, -17.5, -22];         // where the packet stream reaches with k layers up
const SKY = { tint: '#a5b4fc', ground: '#0a0620', fog: '#07051a', density: 0.0068, background: '#050314', sun: 1.7 };

/** Which stair band a cell is on (north/south stairs |x| <= 1, east stairs |z| <= 1): the axis distance, or null. */
const band = (x, z) => (Math.abs(x) <= 1 ? Math.abs(z) : Math.abs(z) <= 1 && x > 0 ? x : null);
function groundH(x, z) {
  const r = Math.hypot(x, z);
  if (r > 24.5) return null;
  const b = band(x, z);
  if (b != null) {
    for (const edge of [10, 15, 20]) if (b >= edge - 2 && b < edge) return H[tierOf(edge - 1)] + 1 + (b - (edge - 2));
    return H[tierOf(b)];
  }
  return H[tierOf(r)];
}

export default {
  id: 'starry',
  name: 'Starry-Next kernel',
  subtitle: 'A network stack for a monolithic kernel · Rust · graduation project',
  size: 52,
  spawn: [0, 20.5],
  sky: SKY,
  zones: {
    user: { x: 0, z: 21, r: 5, label: 'Ring 3 · user space' },
    core: { x: 0, z: 0, r: 9.5, label: 'Ring 0 · kernel core' },
    nic: { x: NIC.x, z: NIC.z, r: 3, label: 'Net stack · NIC' },
    ip: { x: 2, z: -12.5, r: 4, label: 'Net stack · IP' },
    tcp: { x: -2, z: -17, r: 5.5, label: 'Net stack · TCP' },
    socket: { x: 2, z: -21.8, r: 4, label: 'Net stack · socket' },
    monolith: { x: -21, z: 0, r: 4, label: 'The monolith' },
    loopback: { x: LOOP.x, z: LOOP.z, r: 3, label: '127.0.0.1' },
  },

  build(ctx) {
    for (const [name, art] of Object.entries(STARRY_ART)) registerArt(name, art, name === 'st-irq' ? { Y: 1.2 } : name === 'st-dupack' ? { G: 0.5 } : name === 'st-proc' ? { C: 0.6 } : null);
    const st = ctx.state;
    st.layers = st.layers || 0;
    let lastT = 0;

    // ================================================================ terrain: the crater of rings
    terrain(ctx, {
      size: 52,
      height: groundH,
      type: (x, z) => {
        const b = band(x, z);
        if (b != null && groundH(x, z) !== H[tierOf(b)]) return 'stair';
        const r = Math.hypot(x, z), t = tierOf(b ?? r);
        const north = z < -2 && Math.abs(x) < -z * 1.1;
        if (t === 0) return north && z < -6 ? 'nic' : (Math.round(x) % 4 === 0 || Math.round(z) % 4 === 0) ? 'trace' : 'core';
        if (north) return ['nic', 'ip', 'tcp', 'sock'][t];
        return ['core', 'r1', 'r2', 'r3'][t] + (hash3(x, 0, z) < 0.07 ? 'x' : '');
      },
      palette: {
        core: ['#3b0d14', '#420f18', '#361017'], trace: ['#7f1d1d', '#8b2020'], nic: ['#9a3412', '#a3401a'],
        r1: ['#2e1065', '#34126e'], r1x: ['#6d28d9', '#7c3aed'], ip: ['#1e3a8a', '#223f94'],
        r2: ['#172554', '#1a2b60'], r2x: ['#3b82f6', '#2563eb'], tcp: ['#14532d', '#166534'],
        r3: ['#134e4a', '#115e59', '#0f4f4a'], r3x: ['#2dd4bf', '#5eead4'], sock: ['#57534e', '#615c57'],
        stair: ['#94a3b8', '#a3b0c2'],
      },
    });

    // ================================================================ props
    const solid = [], deco = [], glow = [];
    // the monolith (west rim): obsidian with stars in it
    for (let y = H[3] + 1; y <= H[3] + 8; y++) for (const z of [-1, 0, 1]) for (const x of [-22, -21]) solid.push([x, y, z, hash3(x, y, z) < 0.12 ? '#e0e7ff' : '#0b0a14', hash3(x, y, z) < 0.12 ? 2 : 0]);
    for (let y = H[3] + 9; y <= H[3] + 10; y++) glow.push([-21.5, y, 0, RUST, 1.6]);
    // loopback arch (east rim)
    for (let y = H[3] + 1; y <= H[3] + 4; y++) solid.push([LOOP.x, y, LOOP.z - 2, '#475569'], [LOOP.x, y, LOOP.z + 2, '#475569']);
    for (let dz = -2; dz <= 2; dz += 1) glow.push([LOOP.x, H[3] + 5, LOOP.z + dz, '#22d3ee', 1.4]);
    // plaque pedestal at the spawn
    solid.push([3, H[3] + 1, 21, '#78716c']);
    glow.push([3, H[3] + 2, 21, RUST, 0.8]);
    // the NIC: a green board with a gold edge connector and a blinking link light
    for (let x = 5; x <= 8; x++) for (let y = 4; y <= 5; y++) solid.push([x, y, -7, y === 4 && x % 2 ? '#fbbf24' : '#166534']);
    glow.push([8, 6, -7, '#4ade80', 2]);
    // IP: a router with two antennas
    for (let x = 6; x <= 7; x++) solid.push([x, 7, -12, '#1e293b'], [x, 7, -13, '#1e293b']);
    deco.push([6, 8, -12, '#94a3b8'], [6, 9, -12, '#94a3b8'], [7, 8, -13, '#94a3b8'], [7, 9, -13, '#94a3b8']);
    // socket: a wall socket block on the rim
    for (let x = 6; x <= 7; x++) for (let y = 13; y <= 15; y++) solid.push([x, y, -22, '#e7e5e4']);
    deco.push([6, 14, -21, '#1c1917'], [7, 14, -21, '#1c1917']);
    // ring 0: a circle of glowing syscall-table pins round the core
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, x = Math.round(Math.cos(a) * 8.6), z = Math.round(Math.sin(a) * 8.6);
      if (Math.abs(x) <= 1 || (Math.abs(z) <= 1 && x > 0)) continue;
      deco.push([x, 4, z, '#1c1917']);
      glow.push([x, 5, z, RUST, 1.2]);
    }
    // user space: a few terminals on the rim
    for (const [x, z] of [[-9, 20.5], [11, 18.5], [-16, -14], [15, -15]]) { solid.push([x, 13, z, '#334155']); glow.push([x, 14, z, '#5eead4', 0.9]); }
    props(ctx, solid, { block: true });
    props(ctx, deco);
    const glowMesh = props(ctx, glow, { shadow: false });

    // ================================================================ instanced dynamics: stars, packet stream, layer lamps, pads, header shells
    const basic = (color, extra = {}) => new THREE.MeshBasicNodeMaterial({ color, ...extra });
    const inst = (geo, n, mat) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false; ctx.group.add(m); return m; };
    const _m = new THREE.Matrix4(), col = new THREE.Color();
    // a starry sky (it's in the name)
    const N_STAR = 160;
    const stars = inst(new THREE.BoxGeometry(0.5, 0.5, 0.5), N_STAR, basic('#ffffff', { fog: false }));
    for (let i = 0; i < N_STAR; i++) {
      const a = hash3(i, 1, 7) * Math.PI * 2, rr = 50 + hash3(i, 2, 7) * 90, y = 36 + hash3(i, 3, 7) * 50;
      _m.makeScale(0.6 + hash3(i, 4, 7), 0.6 + hash3(i, 4, 7), 0.6 + hash3(i, 4, 7)).setPosition(Math.cos(a) * rr + ctx.ox, y, Math.sin(a) * rr + ctx.oz);
      stars.setMatrixAt(i, _m);
      stars.setColorAt(i, col.set(hash3(i, 5, 7) < 0.2 ? '#fde68a' : hash3(i, 5, 7) < 0.35 ? '#a5b4fc' : '#ffffff'));
    }
    // the packet stream up the north stairs
    const N_PK = 14;
    const pk = inst(new THREE.BoxGeometry(0.45, 0.35, 0.6), N_PK, basic('#ffffff'));
    for (let i = 0; i < N_PK; i++) pk.setColorAt(i, col.set(['#fb923c', '#60a5fa', '#fde047'][i % 3]));
    const pkS = Array.from({ length: N_PK }, (_, i) => i / N_PK);
    // layer lamps: 5 per layer along its floor
    const lamps = inst(new THREE.BoxGeometry(0.5, 0.5, 0.5), 20, basic('#ffffff'));
    const LAMP_AT = [[[-6, -8], [-7, -5], [6, -5], [-4, -9], [4, -9]], [[-8, -11], [-10, -8], [9, -9], [-5, -13], [10, -7]], [[-9, -14.5], [-12, -11], [12, -11], [8, -15], [-13, -9]], [[-9, -20.5], [-14, -17], [14, -17], [9, -20.5], [-3, -22.5]]];
    LAMP_AT.forEach((list, k) => list.forEach(([x, z], j) => { _m.makeTranslation(x + ctx.ox, H[k] + 0.9, z + ctx.oz); lamps.setMatrixAt(k * 5 + j, _m); }));
    const paintLamps = () => { for (let k = 0; k < 4; k++) for (let j = 0; j < 5; j++) lamps.setColorAt(k * 5 + j, col.set(st.layers > k ? HEADER_COL[k] : '#3f3f46')); lamps.instanceColor.needsUpdate = true; };
    paintLamps();
    // handshake pads
    const pads = inst(new THREE.BoxGeometry(2.2, 0.12, 2.2), 3, basic('#ffffff'));
    PADS.forEach(([x, z], i) => { _m.makeTranslation(x + ctx.ox, H[2] + 0.56, z + ctx.oz); pads.setMatrixAt(i, _m); });
    let hs = 0;                                   // handshake progress 0..3
    const paintPads = (flash = -1) => { PADS.forEach((p, i) => pads.setColorAt(i, col.set(st.layers >= 3 || i < hs ? '#22c55e' : i === flash ? '#f87171' : '#94a3b8'))); pads.instanceColor.needsUpdate = true; };
    paintPads();
    // the Jumbo Frame's header shells
    const shells = HEADER_COL.map((c, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(3.4 + i * 0.7, 4.4 + i * 0.7, 3.4 + i * 0.7), basic(c, { wireframe: true, transparent: true, opacity: 0.55, depthWrite: false })); m.visible = false; ctx.group.add(m); return m; });

    // ================================================================ enemies
    const kinds = {
      'starry-packet': { name: 'Stray Packet', sprite: 'st-packet', hp: 18, speed: 4.8, dmg: 5, type: 'Electric', xp: 10, gold: 10, behaviour: 'swarm', scale: 0.18, color: '#60a5fa' },
      'starry-irq': { name: 'Interrupt Storm', sprite: 'st-irq', hp: 34, speed: 3.4, dmg: 9, type: 'Electric', xp: 20, gold: 18, behaviour: 'charge', rate: 3000, scale: 0.22, color: '#facc15' },
      'starry-dupack': { name: 'Duplicate ACK', sprite: 'st-dupack', hp: 26, speed: 2.8, dmg: 7, type: 'Ghost', xp: 18, gold: 16, behaviour: 'ranged', rate: 1900, proj: 'pulse', flying: true, scale: 0.2, color: '#c4b5fd' },
      'starry-zombie': { name: 'Zombie Process', sprite: 'st-zombie', hp: 40, speed: 2.2, dmg: 8, type: 'Ghost', xp: 22, gold: 20, behaviour: 'chase', scale: 0.22, color: '#86efac',
        onDeath: () => { findReap(); if (lastT - (st._reapT || 0) > 8) { st._reapT = lastT; toast('Reaped. Its exit status finally got read.', { icon: 'check' }); } } },
      'starry-proc': { name: 'User Process', sprite: 'st-proc', hp: 6, speed: 1.4, dmg: 0, type: 'Normal', xp: 1, gold: 1, behaviour: 'wander', scale: 0.16, color: '#67e8f9' },
    };
    for (const [id, k] of Object.entries(kinds)) registerEnemyKind(id, k);
    const put = (kind, list) => { for (const [x, z] of list) spawnEnemy(ctx, { kind, x, z }); };
    put('starry-zombie', [[14, 15], [-15, 15], [16, -14]]);
    put('starry-irq', [[12, -10], [-13, 8]]);
    put('starry-dupack', [[-11, -5], [9, -9]]);
    put('starry-packet', [[-5, 3], [5, 4], [-6, -3]]);
    put('starry-proc', [[8, 21], [-10, -21], [22, -3]]);

    // ================================================================ boss: the Jumbo Frame
    const headers = () => 4 - Math.min(4, st.layers);
    const boss = spawnBoss(ctx, {
      id: 'starry-jumbo', name: 'The Jumbo Frame', sprite: 'st-jumbo', scale: 0.3, x: BOSS_HOME.x, z: BOSS_HOME.z,
      hp: 460, type: 'Electric', r: 1.9, color: '#fb923c', contact: 11, speed: 1.1, aggro: 10,
      pattern: ['fan', 'summon', 'rings'],
      phases: [{ below: 0.5, pattern: ['volley', 'summon', 'nova', 'charge'] }],
      minion: 'starry-packet', reward: { gold: 360, xp: 130 }, drop: 'relic-starry', respawn: 45000,
      onDefeat: (b, { first }) => {
        findRelic();
        banner('Frame delivered', first ? 'Starry-Next Relic earned. Every header parsed, the payload handed to user space.' : 'Delivered again. Packets keep arriving; that is networking.', 'gem-pendant');
        say('me', first ? 'Received, decapsulated, delivered.' : 'Another one for the socket.');
      },
    });
    const bossHit = boss.hit.bind(boss);
    let hintAt = 0;
    boss.hit = (dmg, info) => {
      const n = headers();
      if (n && lastT - hintAt > 5) { hintAt = lastT; toast(`Still wrapped in ${n} header${n > 1 ? 's' : ''}: ${Math.round((1 - n * 0.2) * 100)}% damage. Bring up the stack on the north side: NIC → IP → TCP → socket.`, { icon: 'shield-check', tone: 'bad' }); }
      return bossHit(Math.max(1, Math.round(dmg * (1 - n * 0.2))), info);
    };
    let introShown = false;
    trigger(ctx, { x: 0, z: 0, r: 9, maxY: H[0] + 1.5, onEnter: () => {
      findRing0();
      if (!boss.alive || introShown) return;
      introShown = true;
      cinematic(ctx, { x: BOSS_HOME.x, y: 5, z: BOSS_HOME.z, pitch: 0.45, dist: 17, seconds: 2 });
      banner('THE JUMBO FRAME', headers() ? `Far bigger than the MTU and wrapped in ${headers()} headers. Bring up the net stack (north) to strip them.` : 'Fully decapsulated. Deliver it!', 'shield-check');
      sfx('encounter');
    } });

    // ================================================================ the network stack, layer by layer
    function layerUp(k, how) {
      if (st.layers !== k) return;
      st.layers = k + 1; ctx.save();
      paintLamps(); paintPads();
      sfx('achievement');
      banner(`${LAYER_NAMES[k]} is up`, `${how} The ${HEADER_NAMES[k]} header comes off the Jumbo Frame (${4 - st.layers} left).`, 'lightning-branches');
      if (st.layers === 4) { findStack(); setTimeout(() => say('bit', 'All four layers up. That frame down in ring 0 is just data now!'), 2500); }
    }
    const needs = (k) => {
      if (st.layers >= k) return false;
      toast(`No packets reach this floor yet: bring up ${LAYER_NAMES[st.layers]} first (${['ring 0, north edge', 'ring 1, north', 'ring 2, north', 'ring 3, north'][st.layers]}).`, { icon: 'lock' });
      return true;
    };
    interactable(ctx, { x: NIC.x, z: NIC.z, r: 2.3, label: 'NIC · eth0', prompt: 'E · configure', onInteract: () => {
      dialog({
        text: st.layers > 0 ? 'eth0: link up. Frames arrive in the receive ring, get DMA\'d into memory, and head up the stack.' : 'eth0: link DOWN. The frames are piling up at the door. The driver is not loaded.',
        choices: [
          ...(st.layers > 0 ? [] : [{ label: 'Load the driver', icon: 'cpu', action: () => layerUp(0, 'Driver loaded, link up.') }, { label: 'Turn it off and on again', action: () => layerUp(0, 'Classic. It worked.') }]),
          { label: 'Inspect the receive ring', next: () => { findWrongRing(); return { text: 'It is a ring buffer: a circular queue of frame descriptors, head chasing tail. Not to be confused with ring 0, the privilege level you are standing in. Kernel people love rings.', choices: [{ label: 'So many rings' }] }; } },
          { label: 'Leave' },
        ],
      }, { name: 'NIC · eth0', sprite: 'st-packet' });
    } });
    interactable(ctx, { x: IP.x, z: IP.z, r: 2.3, label: 'IP layer · routing', prompt: 'E · route', onInteract: () => {
      if (needs(1)) return;
      if (st.layers > 1) { toast('Routing table: 10.0.0.2 → this host. Datagrams are going up to TCP.', { icon: 'check' }); return; }
      const wrong = (t) => ({ text: t, choices: [{ label: 'Try again', next: ask }, { label: 'Leave' }] });
      function ask() {
        return {
          text: 'A datagram arrives. Header: src 10.0.0.1 → dst 10.0.0.2. This host is 10.0.0.2. What do you do?',
          choices: [
            { label: 'Forward it to the gateway', next: () => wrong('It went to the gateway, which sent it back, which sent it to the gateway… TTL expired while sightseeing.') },
            { label: 'Deliver it locally, up to TCP', action: () => { findRoute(); layerUp(1, 'The destination is us: deliver locally.'); } },
            { label: 'Drop it', next: () => wrong('Dropped. It was going to say something nice, too.') },
          ],
        };
      }
      dialog(ask, { name: 'IP layer', sprite: 'st-frag' });
    } });
    PADS.forEach(([x, z, label], i) => {
      trigger(ctx, { x, z, w: 2.2, d: 2.2, minY: H[2] - 0.5, onEnter: () => {
        if (st.layers >= 3) return;
        if (st.layers < 2) { if (i === 0) needs(2); return; }
        if (i === hs) {
          hs++; sfx('tick'); paintPads();
          toast(`${label} ${['→ sent', '← received', '→ sent'][i]}`, { icon: 'link' });
          if (hs === 3) { findHandshake(); layerUp(2, 'SYN, SYN-ACK, ACK: connection established.'); }
        } else if (i > hs) {
          hs = 0; sfx('error'); paintPads(i);
          toast(`${label} out of order: RST. Connection reset; start again with SYN.`, { icon: 'rotate-ccw', tone: 'bad' });
          setTimeout(paintPads, 700);
        }
      } });
    });
    interactable(ctx, { x: -1.5, z: -15.6, r: 1.8, label: 'TCP · the three-way handshake', prompt: 'E · read', onInteract: () => dialog({ text: 'Step on the pads in order: SYN (you ask), SYN-ACK (the other side agrees), ACK (you agree that it agreed). Out of order and the connection is reset. Nothing personal. It is TCP.', choices: [{ label: 'SYN' }] }, { name: 'Sign', sprite: 'book' }) });
    interactable(ctx, { x: SOCK.x, z: SOCK.z, r: 2.3, label: 'Socket · port 8080', prompt: 'E · syscall', onInteract: () => {
      if (needs(3)) return;
      if (st.layers > 3) { toast('The socket is connected. Bytes arrive; user space reads them. Very civilised.', { icon: 'check' }); return; }
      const node = () => ({
        text: 'The connection is established and waiting in the accept queue. User space should call…',
        choices: [
          { label: 'listen()', next: () => ({ text: 'It is already listening. It has been listening this whole time. Very patient socket.', choices: [{ label: 'Back', next: node }] }) },
          { label: 'accept()', action: () => layerUp(3, 'accept() returned a connection; the payload reaches user space.') },
          { label: 'close()', next: () => ({ text: 'Closed. …Just kidding, it is back. There is a whole TIME_WAIT for moments like this.', choices: [{ label: 'Back', next: node }] }) },
        ],
      });
      dialog(node, { name: 'Socket', sprite: 'st-proc' });
    } });

    // ================================================================ NPCs
    spawnNpc(ctx, {
      id: 'st-borrow', name: 'The Borrow Checker', sprite: 'st-borrow', x: 6.5, z: 20, face: 3.8,
      news: () => !st.metBorrow,
      talk: () => {
        st.metBorrow = true; ctx.save();
        return {
          text: hasItem('relic-starry')
            ? 'The Jumbo Frame was delivered and freed exactly once. No double free. I have stamped it "APPROVED". I have never stamped anything "APPROVED" before.'
            : 'HALT. I am the Borrow Checker. Nothing in this kernel moves while someone else is holding it. State your business.',
          choices: [
            { label: 'What is this place?', icon: 'circle-help', next: () => { findRust(); return { text: 'Starry-Next: the networking stack for a monolithic-kernel operating system. Yichen built it as his graduation project. It is written in Rust, which is why I am employed here. Outer rings are user space; the core is ring 0; the north side is the network stack.', choices: [{ label: 'Got it' }] }; } },
            { label: 'Can I borrow your stamp?', next: () => { findE0499(); return { text: 'You may borrow it immutably: look, do not touch. You already have a mutable borrow on your sword, and you want the stamp mutably too? error[E0499]: cannot borrow as mutable more than once at a time. Denied. Lovingly.', choices: [{ label: 'Fair' }] }; } },
            { label: 'How do I beat the big packet?', icon: 'swords', next: { text: 'The Jumbo Frame in the core is wrapped in four headers: Ethernet, IP, TCP, and a socket buffer. Each one soaks up your hits. Go north and bring the stack up in order: NIC in ring 0, IP in ring 1, TCP in ring 2, the socket in ring 3. Every layer you bring up strips one header.', choices: [{ label: 'On it' }] } },
            { label: 'Bye' },
          ],
        };
      },
    });
    spawnNpc(ctx, {
      id: 'st-frag', name: 'Frag · a fragmented datagram', sprite: 'st-frag', x: -5, z: -12, face: 0.6,
      news: () => !st.metFrag || ((st.frags || 0) >= 5 && !st.reassembled),
      talk: () => {
        st.metFrag = true; ctx.save();
        const n = st.frags || 0;
        if (st.reassembled) return { text: 'Offset 0 to the end, no gaps, no overlaps, checksum good. I feel whole. The IP layer is the best layer; I may be biased.', choices: [{ label: 'You look great' }] };
        if (n >= 5) {
          st.reassembled = true; ctx.save();
          sfx('achievement');
          findReasm();
          banner('Reassembled', 'Five fragments, one datagram again. The IP layer puts things back together.', 'check');
          return { text: 'All five! Sorting by offset… 0, 1480, 2960… no gaps… More-fragments flag off on the last one… REASSEMBLED. I am one datagram again!', choices: [{ label: 'Welcome back' }] };
        }
        return {
          text: `I was one datagram. Then I met a link with a small MTU and got split into five fragments, flung all over the rings. The IP layer can put me back together, but only with every piece. You have ${n} of 5.`,
          choices: [
            { label: 'Where are they?', next: { text: 'One in the kernel core (careful, the big frame lives there). Two in ring 1, east and west. One out in ring 2 to the west. One on the rim in user space, east side.', choices: [{ label: 'On it' }] } },
            { label: 'On it' },
          ],
        };
      },
    });

    // ================================================================ interactables, triggers, pickups
    interactable(ctx, { x: 3, z: 20, r: 2, label: 'Plaque · Starry-Next', prompt: 'E · read', onInteract: () => {
      findGrad();
      dialog({ text: 'STARRY-NEXT. A networking stack for a monolithic-kernel operating system, written in Rust. Undergraduate graduation project. Walk down from ring 3 to ring 0, then follow a packet back up the stack. Mind the Jumbo Frame.', choices: [{ label: 'Descend' }] }, { name: 'Plaque', sprite: 'book' });
    } });
    interactable(ctx, { x: -19.8, z: 0, r: 2.4, label: 'The monolith', prompt: 'E · touch', onInteract: () => {
      findMono();
      dialog({ text: 'A monolithic kernel: the scheduler, the file systems, the drivers and the network stack all live together in kernel space, in one big binary. No message passing between servers; just function calls. The monolith hums. It is one big piece, and proud of it.', choices: [{ label: 'Solid' }] }, { name: 'The monolith', sprite: 'st-proc' });
    } });
    trigger(ctx, { x: LOOP.x, z: LOOP.z, r: 1.1, minY: H[3] - 0.5, onEnter: () => {
      sfx('portal');
      findLoop();
      toast('You sent yourself to 127.0.0.1. You arrived exactly where you were. Loopback works.', { icon: 'rotate-ccw' });
      say('me', 'There\'s no place like 127.0.0.1.');
    } });
    for (const [id, x, z] of [['starry-frag-1', -3, 6], ['starry-frag-2', -12, -3], ['starry-frag-3', 8, 12], ['starry-frag-4', -18, 8], ['starry-frag-5', 20, -6]]) {
      pickup(ctx, { id, x, z, sprite: 'st-fragment', scale: 0.16, onPick: () => {
        st.frags = (st.frags || 0) + 1; ctx.save();
        toast(st.frags < 5 ? `IP fragment (${st.frags}/5). Offset noted.` : 'All 5 fragments! Take them to Frag on the IP floor (ring 1, north).', { icon: 'scroll-text' });
      } });
    }
    portal(ctx, { x: -8, z: 21, to: 'hub', color: RUST });
    trigger(ctx, { x: 0, z: 16, r: 2.5, once: true, onEnter: () => say('bit', 'Stairs down into the kernel! Ring 3, 2, 1… and 0 at the bottom.') });

    // ================================================================ quests + eggs
    quest({
      id: 'starry-stack', title: 'Bring up the stack',
      steps: [
        { id: 'nic', text: 'Bring up the NIC (ring 0, north edge)', done: () => st.layers >= 1 },
        { id: 'ip', text: 'Route the datagram at the IP layer (ring 1)', done: () => st.layers >= 2 },
        { id: 'tcp', text: 'Complete the TCP handshake (ring 2)', done: () => st.layers >= 3 },
        { id: 'sock', text: 'accept() at the socket (ring 3, north)', done: () => st.layers >= 4 },
        { id: 'boss', text: 'Deliver the Jumbo Frame (ring 0)', done: () => boss.defeated },
      ],
      reward: { gold: 150, xp: 60 },
    });
    quest({
      id: 'starry-frag', title: 'Reassembly',
      steps: [
        { id: 'meet', text: 'Talk to Frag on the IP floor (ring 1, north)', done: () => !!st.metFrag },
        { id: 'find', text: 'Find the 5 IP fragments', done: () => (st.frags || 0) >= 5 },
        { id: 'back', text: 'Bring them back to Frag', done: () => !!st.reassembled },
      ],
      reward: { gold: 160, xp: 70 },
    });
    const findGrad = egg('starry-grad', 'Graduation project', 'Read the plaque where you arrive in the Starry-Next kernel.', 'Starry-Next: a network stack for a monolithic-kernel OS, Yichen\'s graduation project.');
    const findRust = egg('starry-rust', 'Written in Rust', 'Ask the Borrow Checker what this place is.', 'Starry-Next is written in Rust. Hence the Borrow Checker.');
    const findE0499 = egg('starry-e0499', 'error[E0499]', 'Try to borrow the Borrow Checker\'s stamp.', 'Cannot borrow as mutable more than once at a time.');
    const findRing0 = egg('starry-ring0', 'Trap to ring 0', 'Walk down into the kernel core.', 'User space → kernel space. The privilege rings, 3 to 0.');
    const findWrongRing = egg('starry-rxring', 'The other kind of ring', 'Inspect the NIC\'s receive ring.', 'A ring buffer is not a privilege ring. Kernel people love rings.');
    const findRoute = egg('starry-route', 'Deliver locally', 'Route the datagram correctly at the IP layer.', 'dst = this host: up the stack it goes.');
    const findHandshake = egg('starry-handshake', 'SYN, SYN-ACK, ACK', 'Complete the TCP three-way handshake.', 'Connection established.');
    const findStack = egg('starry-stack', 'NIC → IP → TCP → socket', 'Bring up all four layers of the network stack.', 'The receive path of a network stack, walked on foot.');
    const findLoop = egg('starry-loopback', '127.0.0.1', 'Walk through the loopback arch on the east rim.', 'There\'s no place like it.');
    const findMono = egg('starry-monolith', 'Monolithic', 'Touch the monolith on the west rim.', 'Everything in kernel space, including the network stack.');
    const findReap = egg('starry-reap', 'Reaped', 'Defeat a Zombie Process in user space.', 'Its parent never called wait(). You did it for them.');
    const findReasm = egg('starry-reassembly', 'Reassembly', 'Bring Frag all five IP fragments.', 'Fragments in, datagram out.');
    const findRelic = egg('starry-relic', 'Frame delivered', 'Defeat the Jumbo Frame in ring 0.', 'Starry-Next Relic earned.');

    // ================================================================ per frame
    let wasAlive = boss.alive;
    onUpdate(ctx, (dt, t) => {
      lastT = t;
      glowMesh.userData.setHi(0.2 + 0.2 * Math.sin(t * 1.7));
      // packets flow up the north stairs as far as the stack is up (they pile up at the NIC while it is down)
      const endZ = LAYER_Z[Math.min(3, st.layers)], z0 = -6.5;
      const span = st.layers ? z0 - endZ : 1.2;
      for (let i = 0; i < N_PK; i++) {
        pkS[i] = (pkS[i] + dt * (st.layers ? 0.09 : 0.25)) % 1;
        const z = z0 - pkS[i] * span, x = (i % 3) - 1;
        const y = (ctx.heightAt(x, z) > -Infinity ? ctx.heightAt(x, z) : H[0]) + 0.75 + (st.layers ? 0 : (i % 4) * 0.4);
        _m.makeTranslation(x * 0.8 + ctx.ox, y, z + ctx.oz);
        pk.setMatrixAt(i, _m);
      }
      pk.instanceMatrix.needsUpdate = true;
      // the boss: revive resets the intro; shells follow it; the name shows what it still wears
      if (boss.alive && !wasAlive) introShown = false;
      wasAlive = boss.alive;
      const n = headers();
      for (let i = 0; i < 4; i++) {
        const on = boss.alive && i >= 4 - n;
        shells[i].visible = on;
        if (on) { shells[i].position.set(boss.x, boss.y + 2.2, boss.z); shells[i].rotation.y = t * (0.4 + i * 0.15) * (i % 2 ? -1 : 1); }
      }
      if (boss.alive) boss.name = n ? `The Jumbo Frame · ${n} header${n > 1 ? 's' : ''}` : 'The Jumbo Frame · payload exposed';
    });

    onEnter(ctx, () => {
      if (!st.visited) { st.visited = true; ctx.save(); setTimeout(() => say('bit', 'A kernel! Those glowing rings go all the way down to ring 0.'), 900); }
      if (!hasItem('relic-starry')) setTimeout(() => say('st-borrow', 'HALT. State your business.'), 2400);
    });
    onLeave(ctx, () => { if (st.layers < 3) { hs = 0; paintPads(); } if (boss.alive) { boss.hp = boss.maxHp; introShown = false; } });
  },
};
