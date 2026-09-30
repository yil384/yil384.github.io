export default async ({ p, ev, sim, check, shot }) => {
  const O = await ev(() => [window.__g.where.ox, window.__g.where.oz]);
  const tp = (x, z) => ev(([x, z, O]) => { window.__g.teleport(x + O[0], z + O[1]); window.__g.player.hp = 999; }, [x, z, O]);
  const E = async () => { await p.keyboard.press('KeyE'); await p.waitForTimeout(400); };
  const close = () => ev(() => window.__g.closeAllModals());
  const pick = async (n) => { await p.click(`.talk__choice >> nth=${n}`, { force: true }).catch((e) => console.log('LOG click', e.message.split('\n')[0])); await p.waitForTimeout(350); };
  const talk = async (id) => { await ev((id) => { const g = window.__g; g.talk(g.npcs.find((n) => n.id === id)); }, id); await p.waitForTimeout(600); };
  const st = () => ev(() => window.__g.S.world.data.starry);
  // plaque, borrow checker
  await tp(3, 19.5); await sim(0.3); await E(); await close();
  await talk('st-borrow'); await pick(0); await close();
  await talk('st-borrow'); await pick(1); await close();
  // monolith, loopback
  await tp(-19, 0); await sim(0.3); await E(); await close();
  await tp(18, 7); await sim(0.2); await tp(21, 7); await sim(0.3);
  // descend: ring 0
  await tp(0, 12); await sim(0.3); await tp(0, 5); await sim(0.5);
  await shot('boss', 2000);
  const d0 = await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'starry-jumbo'); const h = b.hp; b.hit(50); return [h - b.hp, b.name]; });
  check('4 headers: 20% damage', d0[0] === 10, JSON.stringify(d0));
  // IP before NIC: refused
  await tp(IPX(), -12.5); await sim(0.3); await E(); await close();
  check('IP needs NIC', (await st()).layers === 0);
  // NIC
  await tp(3.5, -6.5); await sim(0.3); await E(); await pick(2); await close();
  await E(); await pick(0); await close();
  check('NIC up', (await st()).layers === 1);
  // IP
  await tp(4, -11.8); await sim(0.3); await E(); await pick(0); await pick(0); await pick(1); await close();
  check('IP up', (await st()).layers === 2, JSON.stringify(await st()));
  // TCP: wrong order first, then right
  await tp(-1.5, -14.5); await sim(0.2);
  await tp(3.5, -17.5); await sim(0.2); await tp(-1.5, -14.5); await sim(0.2);
  for (const [x, z] of [[-6.5, -16], [-3.5, -17.5], [3.5, -17.5]]) { await tp(x, z); await sim(0.2); await tp(-1.5, -14.5); await sim(0.2); }
  check('TCP up', (await st()).layers === 3, JSON.stringify(await st()));
  // socket
  await tp(4, -20.8); await sim(0.3); await E(); await pick(0); await pick(0); await pick(1); await close();
  check('socket up', (await st()).layers === 4, JSON.stringify(await st()));
  // frag quest
  await talk('st-frag'); await close();
  for (const [x, z] of [[-3, 6], [-12, -3], [8, 12], [-18, 8], [20, -6]]) { await tp(x, z); await sim(0.4); }
  await talk('st-frag'); await close();
  // zombie
  await ev(() => { const f = window.__g.foes.find((f) => f.kindId === 'starry-zombie' && f.alive); f.hit(9999); });
  // boss
  await tp(0, 6); await sim(1);
  await shot('boss2', 1500);
  const d1 = await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'starry-jumbo'); const h = b.hp; b.hit(50); return [h - b.hp, b.name]; });
  check('no headers: full damage', d1[0] === 50, JSON.stringify(d1));
  for (let i = 0; i < 16; i++) { const a = await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'starry-jumbo'); if (b.alive) b.hit(40); window.__g.player.hp = 999; return b.alive; }); if (!a) break; await sim(0.6); }
  await close(); await sim(1.2); await close(); await sim(0.6);
  const s = await ev(() => ({ state: window.__g.S.world.data.starry, quests: window.__g.S.world.quests, road: window.__g.S.world.road, eggs: Object.keys(window.__g.S.eggs).filter((k) => k.startsWith('starry')) }));
  console.log('LOG state', JSON.stringify(s));
  check('relic', !!s.road['relic-starry']);
  check('quest frag done', s.quests['starry-frag'] === 'done');
  check('quest stack done', s.quests['starry-stack'] === 'done');
  check('eggs >= 12', s.eggs.length >= 12, s.eggs.length);
};
function IPX() { return 4; }
