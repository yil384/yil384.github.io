export default async ({ p, ev, sim, check, shot }) => {
  const O = await ev(() => [window.__g.where.ox, window.__g.where.oz]);
  const tp = (x, z) => ev(([x, z, O]) => { window.__g.teleport(x + O[0], z + O[1]); window.__g.player.hp = 999; }, [x, z, O]);
  const E = async () => { await p.keyboard.press('KeyE'); await p.waitForTimeout(400); };
  const close = () => ev(() => window.__g.closeAllModals());
  const pick = async (n) => { await p.click(`.talk__choice >> nth=${n}`, { force: true }).catch((e) => console.log('LOG click', e.message.split('\n')[0])); await p.waitForTimeout(350); };
  const talk = async (id) => { await ev((id) => { const g = window.__g; g.talk(g.npcs.find((n) => n.id === id)); }, id); await p.waitForTimeout(600); };
  const st = () => ev(() => window.__g.S.world.data.im);
  const dbg = await ev(() => window.__g.regions.builtRegion('im').debug);
  console.log('LOG debug', JSON.stringify(dbg));
  // a free spot next to a local point
  const near = (x, z) => ev(([x, z, O]) => { const w = window.__g.world; for (const [dx, dz] of [[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]]) { const X = x + dx + O[0], Z = z + dz + O[1]; if (w.walkable(X, Z) && !w.isBlocked(X, Z)) return [x + dx, z + dz]; } return [x, z]; }, [x, z, O]);
  // lobby: plaque, echo, ping
  await tp(-12.5, 19.5); await sim(0.3); await E(); await close();
  await talk('im-echo'); await pick(0); await pick(1); await pick(2); await close();
  await talk('im-ping'); await pick(0); await close();
  check('carrying msg', (await st()).carrying === 'msg');
  await shot('lobby', 1500);
  // doors: the first with a teapot detour
  const idx = [1, 0, 3];
  for (let k = 0; k < 3; k++) {
    const [x, z] = await near(...dbg.doors[k]);
    await tp(x, z); await sim(0.3); await E();
    if (k === 0) { await pick(2); await pick(0); }
    await pick(idx[k]); await close();
  }
  check('doors open', (await st()).doors.every(Boolean), JSON.stringify((await st()).doors));
  const blocked = await ev(([d, O]) => d.doors.map(([x, z]) => window.__g.world.isBlocked(x + O[0], z + O[1])), [dbg, O]);
  check('door cells unblocked', blocked.every((b) => !b), JSON.stringify(blocked));
  // pong
  await tp(...(await near(...dbg.pong))); await sim(0.4);
  await talk('im-pong'); await close();
  check('carrying ack', (await st()).carrying === 'ack');
  // strays: seen x3 (whichever is the Seen one is stray 0)
  for (let i = 0; i < 3; i++) { await tp(...dbg.strays[0]); await sim(0.2); await E(); await close(); }
  await talk('im-ping'); await close();
  // typing + spam kills
  await ev(() => { const g = window.__g; g.foes.find((f) => f.kindId === 'im-typing' && f.alive)?.hit(9999); });
  // boss
  await tp(0, -15); await sim(1.2);
  await shot('boss', 2000);
  const d0 = await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'im-groupchat'); const h = b.hp; b.hit(40); return [h - b.hp, b.name]; });
  check('3 relays: 25% damage', d0[0] === 10, JSON.stringify(d0));
  await ev(() => { for (const f of window.__g.foes.filter((f) => f.kindId === 'im-relay')) f.hit(9999); });
  await sim(0.3);
  const d1 = await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'im-groupchat'); const h = b.hp; b.hit(40); return [h - b.hp, b.name]; });
  check('no relays: full damage', d1[0] === 40, JSON.stringify(d1));
  const names = new Set();
  for (let i = 0; i < 18; i++) {
    const r = await ev(() => { const g = window.__g; const b = g.patternBosses.find((x) => x.id === 'im-groupchat'); g.player.hp = 999; for (const f of g.foes.filter((f) => f.kindId === 'im-spam' && f.alive)) f.hit(9999); const n = b.name; if (b.alive && Math.random() < 0.6) b.hit(40); return [b.alive, n]; });
    names.add(r[1]); if (!r[0]) break; await sim(0.5);
  }
  console.log('LOG names', [...names].slice(0, 8).join(' | '));
  await close(); await sim(1.2); await close(); await sim(0.6);
  const s = await ev(() => ({ state: window.__g.S.world.data.im, quests: window.__g.S.world.quests, road: window.__g.S.world.road, eggs: Object.keys(window.__g.S.eggs).filter((k) => k.startsWith('im-')) }));
  console.log('LOG state', JSON.stringify(s));
  check('relic', !!s.road['relic-im']);
  check('quest done', s.quests['im-delivery'] === 'done');
  check('eggs >= 9', s.eggs.length >= 9, s.eggs.length);
};
