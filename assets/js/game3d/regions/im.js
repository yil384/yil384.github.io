// regions/im.js: the IM chat maze (IM System: real-time chat over WebSocket, a Django backend and a TypeScript
// front end). A phone-shaped island:
//   - the lobby (south): Ping, Echo the echo server, and the server-room plaque
//   - the maze of message bubbles (a perfect maze, the same for everyone): three WebSocket handshake doors
//     sit on the only route north; answer the upgrade request correctly (101 Switching Protocols) to open them
//   - #general (north): the Group Chat (99+ unread) is shielded by three Spam Relays; each relay you take
//     down lets more of your hits land, and its name bar warns you when it "is typing…"
//   - side quest: carry Ping's message through the maze to Pong, then bring Pong's ACK back (reliable delivery)
import * as THREE from 'three/webgpu';
import {
  terrain, props, registerArt, registerEnemyKind, spawnEnemy, spawnBoss, spawnNpc, interactable, trigger,
  portal, quest, egg, say, banner, toast, sfx, onUpdate, onEnter, onLeave, dialog, hash3, hasItem, cinematic,
  sprite, block, unblock,
} from '../regions.js';
import { clock } from '../clock.js';
import { IM_ART } from './art-im.js';

const GREEN = '#4ade80';
const NX = 9, NZ = 8, X0 = -18, Z0 = -14, CELL = 4;
const ENTRY = [4, NZ - 1], EXIT = [4, 0];
const BOSS_HOME = { x: 0, z: -19.5 };
const RELAYS = [[-11, -19], [11, -19], [0, -23]];
const GY = 3;
const SKY = { tint: '#bbf7d0', ground: '#06201a', fog: '#06140f', density: 0.0072, sun: 2.1 };
const cx = (i) => X0 + i * CELL + CELL / 2, cz = (j) => Z0 + j * CELL + CELL / 2;

function inIsland(x, z) {
  if (z < -24 || z > 24) return false;
  const hw = z < Z0 ? 16 : 18;
  if (Math.abs(x) > hw) return false;
  // rounded corners at both ends (the phone)
  const ez = z > 19 ? z - 19 : z < -19 ? -19 - z : 0, ex = Math.max(0, Math.abs(x) - (hw - 5));
  return ex * ex + ez * ez <= 26;
}

/** A perfect maze from a deterministic PRNG: walls V[i][j] (west side of cell i, j; i = 0..NX) and W[i][j] (north side of cell i, j; j = 0..NZ). */
function makeMaze(rand) {
  const V = Array.from({ length: NX + 1 }, () => Array(NZ).fill(true));
  const W = Array.from({ length: NX }, () => Array(NZ + 1).fill(true));
  const seen = Array.from({ length: NX }, () => Array(NZ).fill(false));
  const stack = [ENTRY];
  seen[ENTRY[0]][ENTRY[1]] = true;
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const next = [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].filter(([a, b]) => a >= 0 && a < NX && b >= 0 && b < NZ && !seen[a][b]);
    if (!next.length) { stack.pop(); continue; }
    const [a, b] = next[Math.floor(rand() * next.length)];
    if (a !== i) V[Math.max(a, i)][j] = false; else W[i][Math.max(b, j)] = false;
    seen[a][b] = true;
    stack.push([a, b]);
  }
  W[ENTRY[0]][NZ] = false;          // the way in (south)
  W[EXIT[0]][0] = false;            // the way out (north, into #general)
  return { V, W };
}
const open = (M, i, j, a, b) => (a !== i ? !M.V[Math.max(a, i)][j] : !M.W[i][Math.max(b, j)]);
function bfs(M, from) {
  const dist = Array.from({ length: NX }, () => Array(NZ).fill(-1)), prev = {};
  const q = [from];
  dist[from[0]][from[1]] = 0;
  while (q.length) {
    const [i, j] = q.shift();
    for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) {
      if (a < 0 || a >= NX || b < 0 || b >= NZ || dist[a][b] >= 0 || !open(M, i, j, a, b)) continue;
      dist[a][b] = dist[i][j] + 1; prev[`${a},${b}`] = [i, j]; q.push([a, b]);
    }
  }
  return { dist, prev };
}

export default {
  id: 'im',
  name: 'IM chat maze',
  subtitle: 'Real-time chat · WebSocket + Django + TypeScript',
  size: 50,
  spawn: [0, 21],
  sky: SKY,
  zones: {
    lobby: { x: 0, z: 21.5, r: 5, label: 'Lobby · connecting…' },
    maze: { x: 0, z: 2, r: 16, label: 'The chat maze' },
    general: { x: 0, z: -19.5, r: 6, label: '#general' },
  },

  build(ctx) {
    for (const [name, art] of Object.entries(IM_ART)) registerArt(name, art, name === 'im-relay' ? { R: 2, W: 1.5, Y: 1 } : name === 'im-echo' ? { R: 1.2 } : name === 'im-note' ? { G: 0.6 } : null);
    const st = ctx.state;
    st.doors = st.doors || [false, false, false];
    let lastT = 0;
    const M = makeMaze(ctx.rand);
    const { dist, prev } = bfs(M, ENTRY);
    // the unique route entry → exit; doors go on three walls along it
    const path = [EXIT];
    while (path[0][0] !== ENTRY[0] || path[0][1] !== ENTRY[1]) path.unshift(prev[`${path[0][0]},${path[0][1]}`]);
    const doorWalls = [0.28, 0.58, 0.86].map((f) => { const k = Math.max(1, Math.min(path.length - 1, Math.round(f * (path.length - 1)))); return [path[k - 1], path[k]]; });
    // Pong waits in the cell farthest from the entrance; dead ends get stray messages
    let far = ENTRY;
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) if (dist[i][j] > dist[far[0]][far[1]]) far = [i, j];
    const deadEnds = [];
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      if ((i === far[0] && j === far[1]) || (i === ENTRY[0] && j === ENTRY[1]) || (i === EXIT[0] && j === EXIT[1])) continue;
      const exits = [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].filter(([a, b]) => a >= 0 && a < NX && b >= 0 && b < NZ && open(M, i, j, a, b)).length;
      if (exits === 1) deadEnds.push([i, j, hash3(i, 3, j)]);
    }
    deadEnds.sort((a, b) => a[2] - b[2]);

    // ================================================================ terrain
    terrain(ctx, {
      size: 50,
      height: (x, z) => (inIsland(x, z) ? GY : null),
      type: (x, z) => {
        if (z > Z0 + NZ * CELL) return (x + z) & 1 ? 'lobbyA' : 'lobbyB';
        if (z < Z0) return Math.hypot(x - BOSS_HOME.x, z - BOSS_HOME.z) < 3.2 ? 'badge' : (x + z) & 1 ? 'genA' : 'genB';
        return hash3(x, 1, z) < 0.05 ? 'chatDot' : (x + z) & 1 ? 'chatA' : 'chatB';
      },
      palette: {
        lobbyA: ['#334155', '#3a4960'], lobbyB: ['#2b3748', '#303d50'],
        chatA: ['#0f1c24', '#122029'], chatB: ['#13232d', '#162833'], chatDot: ['#1f5f46', '#236b4f'],
        genA: ['#3b1d4a', '#40204f'], genB: ['#321840', '#371b46'], badge: ['#b91c1c', '#dc2626'],
      },
    });

    // ================================================================ the maze walls: rows of message bubbles
    const walls = [], posts = [], deco = [], glow = [];
    const isDoor = (i, j, vertical) => doorWalls.findIndex(([a, b]) => (vertical ? a[1] === b[1] && a[1] === j && Math.max(a[0], b[0]) === i : a[0] === b[0] && a[0] === i && Math.max(a[1], b[1]) === j));
    const doorCells = [[], [], []];
    const bubble = (x, y, z, s) => {
      const sent = hash3(s, 7, 1) < 0.5;
      const c = sent ? (hash3(s, 8, 1) < 0.5 ? '#22c55e' : '#16a34a') : '#e5e7eb';
      walls.push([x, y, z, y === GY + 2 ? (sent ? '#86efac' : '#f8fafc') : c]);
    };
    for (let i = 0; i <= NX; i++) for (let j = 0; j < NZ; j++) {
      if (!M.V[i][j]) continue;
      const x = X0 + i * CELL, d = isDoor(i, j, true);
      for (let k = 1; k < CELL; k++) for (let y = GY + 1; y <= GY + 2; y++) {
        if (d >= 0) doorCells[d].push([x, y, Z0 + j * CELL + k]); else bubble(x, y, Z0 + j * CELL + k, i * 31 + j);
      }
    }
    for (let i = 0; i < NX; i++) for (let j = 0; j <= NZ; j++) {
      if (!M.W[i][j]) continue;
      const z = Z0 + j * CELL, d = isDoor(i, j, false);
      for (let k = 1; k < CELL; k++) for (let y = GY + 1; y <= GY + 2; y++) {
        if (d >= 0) doorCells[d].push([X0 + i * CELL + k, y, z]); else bubble(X0 + i * CELL + k, y, z, i * 17 + j * 5 + 3);
      }
    }
    for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) {
      const x = X0 + i * CELL, z = Z0 + j * CELL;
      for (let y = GY + 1; y <= GY + 3; y++) posts.push([x, y, z, y === GY + 3 ? '#94a3b8' : '#334155']);
    }
    // #general: benches and a notification bell; the lobby: a router and a desk
    for (let x = -14; x <= -12; x++) deco.push([x, GY + 1, -15.5, '#6b21a8']);
    for (let x = 12; x <= 14; x++) deco.push([x, GY + 1, -15.5, '#6b21a8']);
    for (let y = GY + 1; y <= GY + 2; y++) deco.push([-13, y, 22, '#1e293b'], [-12, y, 22, '#1e293b']);
    glow.push([-13, GY + 3, 22, GREEN, 1.8], [-12, GY + 3, 22, '#22d3ee', 1.8]);
    for (let x = -3; x <= 3; x++) glow.push([x, GY + 4, Z0, x % 2 ? GREEN : '#bbf7d0', 1.2]);        // the #general sign over the exit
    props(ctx, walls, { block: true });
    props(ctx, posts, { block: true });
    props(ctx, deco, { block: true });
    const glowMesh = props(ctx, glow, { shadow: false });
    // doors: one mesh each so they can open
    const doors = doorCells.map((cells, k) => {
      const mesh = props(ctx, cells.map(([x, y, z]) => [x, y, z, y === GY + 2 ? '#fde047' : (x + y + z) % 2 ? '#a16207' : '#ca8a04', 0.5]));
      const setOpen = (on) => { mesh.visible = !on; for (const [x, , z] of cells) (on ? unblock : block)(ctx, x, z); };
      setOpen(!!st.doors[k]);
      const [a, b] = doorWalls[k];
      const x = a[0] === b[0] ? cx(a[0]) : X0 + Math.max(a[0], b[0]) * CELL;
      const z = a[1] === b[1] ? cz(a[1]) : Z0 + Math.max(a[1], b[1]) * CELL;
      return { mesh, cells, setOpen, x, z };
    });

    // ================================================================ ambient: messages in flight above the maze
    const N_MSG = 22;
    const msgs = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.5, 0.2), new THREE.MeshBasicNodeMaterial({ color: '#ffffff' }), N_MSG);
    msgs.castShadow = false; msgs.frustumCulled = false;
    ctx.group.add(msgs);
    const _m = new THREE.Matrix4(), col = new THREE.Color();
    const msgS = Array.from({ length: N_MSG }, (_, i) => ({ x: -16 + hash3(i, 1, 4) * 32, z: -12 + hash3(i, 2, 4) * 28, y: hash3(i, 3, 4) * 10, v: 0.8 + hash3(i, 5, 4) }));
    msgS.forEach((m, i) => msgs.setColorAt(i, col.set(i % 3 ? '#e5e7eb' : GREEN)));

    // ================================================================ enemies
    let spamKills = 0;
    const kinds = {
      'im-spam': { name: 'Spam Bot', sprite: 'im-spam', hp: 16, speed: 4.8, dmg: 5, type: 'Normal', xp: 9, gold: 9, behaviour: 'swarm', scale: 0.18, color: '#fef3c7',
        onDeath: () => { spamKills++; if (spamKills === 10) findUnsub(); else if (spamKills === 1) toast('Marked as spam. It will be back with a new address.', { icon: 'mail' }); } },
      'im-typing': { name: 'Typing Indicator', sprite: 'im-typing', hp: 30, speed: 3.6, dmg: 9, type: 'Normal', xp: 18, gold: 16, behaviour: 'charge', rate: 3200, scale: 0.22, color: '#e5e7eb',
        onDeath: () => { findTyping(); } },
      'im-unread': { name: 'Unread Badge', sprite: 'im-unread', hp: 34, speed: 3.1, dmg: 8, type: 'Fire', xp: 18, gold: 18, behaviour: 'chase', scale: 0.2, color: '#ef4444' },
      'im-drop': { name: 'Dropped Connection', sprite: 'im-drop', hp: 26, speed: 2.8, dmg: 7, type: 'Ghost', xp: 18, gold: 16, behaviour: 'ranged', rate: 2400, proj: 'spark', flying: true, scale: 0.2, color: '#cbd5e1' },
      'im-relay': { name: 'Spam Relay', sprite: 'im-relay', hp: 60, dmg: 7, type: 'Electric', xp: 24, gold: 22, behaviour: 'turret', rate: 2600, proj: 'bubble', aggro: 9, scale: 0.26, color: '#f43f5e', respawn: false,
        onDeath: () => relayDown() },
      'im-thumb': { name: 'Thumbs-up Reaction', sprite: 'im-thumb', hp: 4, speed: 1.6, dmg: 0, type: 'Normal', xp: 1, gold: 1, behaviour: 'wander', scale: 0.16, color: '#facc15' },
    };
    for (const [id, k] of Object.entries(kinds)) registerEnemyKind(id, k);
    const inCell = (f, g) => [cx(f), cz(g)];
    const put = (kind, list) => list.map(([x, z]) => spawnEnemy(ctx, { kind, x, z }));
    const pick = (n, salt) => { const out = []; for (let k = 0; out.length < n && k < 60; k++) { const i = Math.floor(hash3(k, salt, 2) * NX), j = 1 + Math.floor(hash3(k, salt, 3) * (NZ - 2)); if (!out.some(([a, b]) => a === i && b === j) && !(i === far[0] && j === far[1])) out.push([i, j]); } return out.map(([i, j]) => inCell(i, j)); };
    put('im-spam', pick(4, 1));
    put('im-typing', pick(2, 2));
    put('im-unread', pick(2, 3));
    put('im-drop', pick(2, 4));
    put('im-thumb', [[-8, 21], [9, 22]]);
    const relays = put('im-relay', RELAYS);

    // ================================================================ boss: the Group Chat (99+)
    const alive = () => relays.filter((r) => r.alive).length;
    const MULT = [1, 0.7, 0.45, 0.25];
    const boss = spawnBoss(ctx, {
      id: 'im-groupchat', name: 'The Group Chat', sprite: 'im-group', scale: 0.3, x: BOSS_HOME.x, z: BOSS_HOME.z,
      hp: 440, type: 'Normal', r: 1.9, color: GREEN, contact: 11, speed: 1.2, aggro: 11,
      pattern: ['fan', 'summon', 'volley'],
      phases: [{ below: 0.5, pattern: ['nova', 'summon', 'charge', 'fan'] }],
      minion: 'im-spam', reward: { gold: 340, xp: 125 }, drop: 'relic-im', respawn: 45000,
      onDefeat: (b, { first }) => {
        findRelic();
        banner('Chat muted', first ? 'IM System Relic earned. 0 unread. Notifications: off. Peace: on.' : 'Muted again. Someone will @everyone soon.', 'gem-pendant');
        say('me', first ? 'Mark all as read.' : 'Muted. Again.');
      },
    });
    const bossHit = boss.hit.bind(boss);
    let hintAt = 0;
    boss.hit = (dmg, info) => {
      const n = alive();
      if (n && lastT - hintAt > 5) { hintAt = lastT; toast(`${n} Spam Relay${n > 1 ? 's' : ''} still forwarding its messages: ${Math.round(MULT[n] * 100)}% damage. Take them down!`, { icon: 'triangle-alert', tone: 'bad' }); }
      return bossHit(Math.max(1, Math.round(dmg * MULT[n])), info);
    };
    function relayDown() {
      const n = alive();
      sfx('zap');
      if (n) toast(`Relay down. ${n} left forwarding spam to the Group Chat.`, { icon: 'check', tone: 'good' });
      else { banner('Rate-limited', 'All three relays are down. The Group Chat is on its own now.', 'shield-check'); findRate(); }
    }
    const beamPos = new Float32Array(3 * 2 * 3), beamGeo = new THREE.BufferGeometry();
    beamGeo.setAttribute('position', new THREE.BufferAttribute(beamPos, 3));
    const beams = new THREE.LineSegments(beamGeo, new THREE.LineBasicNodeMaterial({ color: '#f43f5e' }));
    beams.frustumCulled = false;
    ctx.group.add(beams);
    let introShown = false;
    trigger(ctx, { x: 0, z: -19, w: 32, d: 10, onEnter: () => {
      if (!boss.alive || introShown) return;
      introShown = true;
      cinematic(ctx, { x: BOSS_HOME.x, y: 5, z: BOSS_HOME.z, pitch: 0.4, dist: 17, seconds: 2 });
      banner('THE GROUP CHAT', `99+ unread, and ${alive() || 'no'} Spam Relay${alive() === 1 ? '' : 's'} feeding it. Watch for "is typing…": that is its tell.`, 'messages-square');
      sfx('encounter');
    } });

    // ================================================================ handshake doors
    const ORDER = [['200 OK', '101 Switching Protocols', '418 I\'m a teapot', '404 Not Found'], ['101 Switching Protocols', '404 Not Found', '200 OK', '418 I\'m a teapot'], ['418 I\'m a teapot', '200 OK', '404 Not Found', '101 Switching Protocols']];
    const REPLY = {
      '200 OK': 'The server answers 200 OK and sends… a web page. A perfectly nice page. The door is still a door.',
      '404 Not Found': 'The door is right in front of you. It is very much found.',
      '418 I\'m a teapot': 'The door is now short and stout. It has a handle and a spout. It does not open.',
    };
    doors.forEach((d, k) => {
      const it = interactable(ctx, { x: d.x, z: d.z, r: 2.4, label: `Handshake door ${k + 1}/3`, prompt: 'E · GET /chat (Upgrade: websocket)', y: GY + 0.5, onInteract: () => {
        if (st.doors[k]) return;
        const node = () => ({
          text: 'Client → server: "GET /chat HTTP/1.1 · Upgrade: websocket · Connection: Upgrade". How does a WebSocket server answer?',
          choices: ORDER[k].map((label) => ({
            label,
            ...(label.startsWith('101') ? { action: () => openDoor(k, it) } : { next: () => { if (label.startsWith('418')) findTeapot(); sfx('error'); return { text: REPLY[label], choices: [{ label: 'Try again', next: node }, { label: 'Leave' }] }; } }),
          })),
        });
        dialog(node, { name: `Handshake door ${k + 1}`, sprite: 'im-note' });
      } });
      if (st.doors[k]) it.remove();
    });
    function openDoor(k, it) {
      st.doors[k] = true; ctx.save();
      doors[k].setOpen(true);
      it.remove();
      sfx('door');
      find101();
      banner('101 Switching Protocols', k < 2 ? 'Upgraded to WebSocket. The door is full-duplex now: it swings both ways.' : 'Last door open. #general is just ahead.', 'link');
    }

    // ================================================================ NPCs and the delivery quest
    const note = sprite(ctx, 'im-note', { x: 0, z: 21, scale: 0.13 });
    note.visible = false;
    spawnNpc(ctx, {
      id: 'im-ping', name: 'Ping', sprite: 'im-ping', x: -5, z: 21, face: 0.3,
      news: () => !st.carrying && !st.acked,
      talk: () => {
        if (st.acked) return { text: 'We are connected! Full duplex, messages both ways, in order, none lost. Delivered, and I KNOW it was delivered. Best feeling in networking.', choices: [{ label: 'Keep chatting' }] };
        if (st.carrying === 'ack') {
          st.carrying = null; st.acked = true; ctx.save();
          sfx('achievement'); findDelivered();
          banner('Delivered ✓✓', 'Message sent, delivered, acknowledged. Reliable delivery, on foot.', 'check');
          return { text: 'An ACK from Pong! "Got it, message 1, all good." Now I know it arrived, not just that I sent it. That is the whole trick of reliable delivery.', choices: [{ label: 'Any time' }] };
        }
        if (st.carrying === 'msg') return { text: 'Pong is somewhere deep in the maze, the farthest corner from here. Take the message there, please!', choices: [{ label: 'On my way' }] };
        return {
          text: 'I\'m Ping! My friend Pong is somewhere deep in the maze and our connection keeps dropping. Could you carry a message over? By hand. Very old-fashioned, very reliable.',
          choices: [
            { label: 'Hand it over', icon: 'mail', action: () => { st.carrying = 'msg'; st.metPing = true; ctx.save(); sfx('pop'); toast('Carrying message #1: "hey, you up?" Find Pong in the farthest corner of the maze.', { icon: 'mail' }); } },
            { label: 'Not now' },
          ],
        };
      },
    });
    spawnNpc(ctx, {
      id: 'im-pong', name: 'Pong', sprite: 'im-pong', x: cx(far[0]), z: cz(far[1]), face: 0,
      news: () => st.carrying === 'msg',
      talk: () => {
        if (st.carrying === 'msg') {
          st.carrying = 'ack'; ctx.save(); sfx('coin');
          toast('Carrying Pong\'s ACK back to Ping in the lobby.', { icon: 'mail' });
          return { text: '"hey, you up?" …from Ping! Yes! Tell Ping I got it. Here, take my ACK back, otherwise Ping will just keep resending it forever.', choices: [{ label: 'ACK it is' }] };
        }
        if (st.carrying === 'ack') return { text: 'My ACK! Take it to Ping in the lobby, please.', choices: [{ label: 'Going' }] };
        return { text: st.acked ? 'Ping and I are connected! Thank you, human transport layer.' : 'Pong. I\'m waiting for a message. Any day now. Very patiently. Deep in a maze.', choices: [{ label: 'Bye' }] };
      },
    });
    let echoes = 0;
    spawnNpc(ctx, {
      id: 'im-echo', name: 'Echo · echo server', sprite: 'im-echo', x: 5, z: 21, face: -0.3,
      talk: () => {
        const node = (said) => ({
          text: said || 'Echo server online. Say something.',
          choices: ['Hello?', 'Are you just repeating me?', 'Testing, testing', 'This is a WebSocket, right?'].map((label) => ({ label, next: () => { echoes++; if (echoes >= 3) findEcho(); return node(label); } })).concat([{ label: 'Bye' }]),
        });
        return node(null);
      },
    });
    trigger(ctx, { x: cx(far[0]), z: cz(far[1]), r: 2.4, onEnter: () => { if (st.carrying === 'msg') say('im-pong', 'Is that… a message for me?'); } });

    ctx.debug = { doors: doors.map((d) => [d.x, d.z]), pong: [cx(far[0]), cz(far[1])], strays: deadEnds.slice(0, 3).map(([i, j]) => [cx(i), cz(j)]) };

    // ================================================================ interactables
    interactable(ctx, { x: -12.5, z: 20.5, r: 2.2, label: 'Server room', prompt: 'E · read', onInteract: () => {
      findStack();
      dialog({ text: 'IM SYSTEM. Real-time chat. Django runs the backend, WebSocket keeps a live connection open both ways, and the front end is TypeScript. The design goal written on the whiteboard: reliable message delivery. Underneath, someone added: "and a maze, apparently".', choices: [{ label: 'Full stack' }] }, { name: 'Server room', sprite: 'im-echo' });
    } });
    const STRAYS = [
      ['Seen ✓✓', () => { st.seen = (st.seen || 0) + 1; ctx.save(); if (st.seen >= 3) { findSeen(); return 'Seen ✓✓. Still no reply. You have been left on read, three times, by a wall.'; } return 'Seen ✓✓. No reply. Maybe try again?'; }],
      ['This message was deleted', () => 'This message was deleted. Whatever it said, it has been thinking about it ever since.'],
      ['"Are you free for a quick call?"', () => 'Sent three hours ago. The call was not quick. There was no call. There is only the maze.'],
    ];
    STRAYS.forEach(([label, text], k) => {
      const de = deadEnds[k];
      if (!de) return;
      interactable(ctx, { x: cx(de[0]), z: cz(de[1]), r: 2, label, prompt: 'E · open', onInteract: () => dialog({ text: text(), choices: [{ label: 'OK' }] }, { name: label, sprite: 'im-note' }) });
    });
    interactable(ctx, { x: 0, z: 18.6, r: 2, label: 'Maze · read me', prompt: 'E · read', onInteract: () => dialog({ text: 'Three handshake doors stand between you and #general. Each one wants the right answer to a WebSocket upgrade request. Hint: it is not a teapot. (It is never a teapot.)', choices: [{ label: 'Upgrade me' }] }, { name: 'Sign', sprite: 'book' }) });
    portal(ctx, { x: 11, z: 21.5, to: 'hub', color: GREEN });
    trigger(ctx, { x: 0, z: 17, r: 2.5, once: true, onEnter: () => say('bit', 'A maze made of chat bubbles. Some of those doors look… handshake-y.') });

    // ================================================================ quest + eggs
    quest({
      id: 'im-delivery', title: 'Reliable delivery',
      steps: [
        { id: 'ping', text: 'Take Ping\'s message (lobby)', done: () => !!st.metPing },
        { id: 'pong', text: 'Deliver it to Pong, deep in the maze', done: () => st.carrying === 'ack' || !!st.acked },
        { id: 'ack', text: 'Bring Pong\'s ACK back to Ping', done: () => !!st.acked },
      ],
      reward: { gold: 170, xp: 70 },
    });
    const find101 = egg('im-101', '101 Switching Protocols', 'Open a WebSocket handshake door in the chat maze.', 'HTTP in, WebSocket out: the upgrade handshake.');
    const findTeapot = egg('im-teapot', 'I\'m a teapot', 'Answer a handshake door with 418.', 'Short and stout. Not a WebSocket.');
    const findStack = egg('im-stack', 'Django · WebSocket · TypeScript', 'Read the server-room plaque in the IM lobby.', 'The IM System: a Django backend, WebSocket, a TypeScript front end.');
    const findEcho = egg('im-echo', 'Echo server', 'Say three things to Echo.', 'The first thing anyone runs on a fresh WebSocket.');
    const findSeen = egg('im-seen', 'Left on read', 'Open the "Seen" message in the maze three times.', 'Delivered, read, ignored. The rarest delivery guarantee.');
    const findDelivered = egg('im-delivered', 'Delivered ✓✓', 'Carry Ping\'s message to Pong and bring back the ACK.', 'Reliable message delivery, the IM System\'s whole point.');
    const findUnsub = egg('im-unsubscribe', 'Unsubscribe', 'Defeat 10 Spam Bots in one visit.', 'You have been removed from this mailing list. (You have not.)');
    const findTyping = egg('im-typing', '… is typing', 'Defeat a Typing Indicator.', 'They were never going to send it.');
    const findRate = egg('im-ratelimit', 'Rate-limited', 'Take down all three Spam Relays in #general.', '429 Too Many Requests, but for spam.');
    const findRelic = egg('im-relic', 'Chat muted', 'Defeat the Group Chat in #general.', 'IM System Relic earned.');

    // ================================================================ per frame
    let wasAlive = boss.alive;
    onUpdate(ctx, (dt, t) => {
      lastT = t;
      glowMesh.userData.setHi(0.2 + 0.2 * Math.sin(t * 2.4));
      for (let i = 0; i < N_MSG; i++) {
        const m = msgS[i];
        m.y += dt * m.v;
        if (m.y > 12) m.y = 0;
        _m.makeTranslation(m.x + ctx.ox, GY + 5 + m.y, m.z + Math.sin(t * 0.6 + i) * 0.4 + ctx.oz);
        msgs.setMatrixAt(i, _m);
      }
      msgs.instanceMatrix.needsUpdate = true;
      // the carried message bobs over your head
      note.visible = !!st.carrying && ctx.playing;
      if (note.visible) note.position.set(ctx.player.x + ctx.ox, ctx.player.y + 2.6 + Math.sin(t * 4) * 0.12, ctx.player.z + ctx.oz);
      // boss: relays revive with it; beams; the name shows the unread count and the typing tell
      if (boss.alive && !wasAlive) { introShown = false; for (const r of relays) if (!r.alive) r.respawnAt = 0; }
      wasAlive = boss.alive;
      let nb = 0;
      if (boss.alive) {
        for (const r of relays) {
          if (!r.alive) continue;
          beamPos.set([r.x, r.y + 2.6, r.z, boss.x, boss.y + 2.4, boss.z], nb * 6);
          nb++;
        }
        const unread = Math.max(1, Math.ceil((boss.hp / boss.maxHp) * 99));
        const typing = boss.threat() && boss.nextAttack - clock.t < 1100 && !boss.dash;
        boss.name = `The Group Chat · ${unread === 99 ? '99+' : unread} unread${typing ? ' · is typing…' : ''}`;
      }
      beamGeo.setDrawRange(0, nb * 2);
      beamGeo.attributes.position.needsUpdate = true;
      beams.visible = nb > 0;
    });

    onEnter(ctx, () => {
      if (!st.visited) { st.visited = true; ctx.save(); setTimeout(() => say('bit', 'Everything here is a chat bubble. Even the walls. Especially the walls.'), 900); }
      if (!hasItem('relic-im')) setTimeout(() => say('im-ping', 'Hey! Over here! Can you deliver something?'), 2600);
    });
    onLeave(ctx, () => { if (boss.alive) { boss.hp = boss.maxHp; introShown = false; } });
  },
};
