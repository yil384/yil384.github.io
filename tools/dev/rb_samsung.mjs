export default async ({ p, ev, sim, check, shot }) => {
  const O = await ev(() => [window.__g.where.ox, window.__g.where.oz]);
  const tp = (x, z) => ev(([x, z, O]) => { window.__g.teleport(x + O[0], z + O[1]); window.__g.player.hp = 999; }, [x, z, O]);
  const E = async () => { await p.keyboard.press('KeyE'); await p.waitForTimeout(300); };
  const close = () => ev(() => window.__g.closeAllModals());
  // swarm
  await tp(-16, 3.5); await sim(0.3); await E(); await p.waitForTimeout(2800); await sim(3);
  await shot('swarm', 2000);
  // simulator
  await tp(20.5, 9.5); await sim(0.3); await E(); await sim(1);
  // tessa
  await ev(() => { const g = window.__g; g.talk(g.npcs.find((n) => n.id === 'sg-tessa')); }); await p.waitForTimeout(2500);
  await p.click('.talk__choice >> nth=0', { force: true }).catch((e) => console.log('LOG', e.message)); await p.waitForTimeout(400); await close();
  // probe
  await ev(() => { const g = window.__g; g.talk(g.npcs.find((n) => n.id === 'sg-probe')); }); await p.waitForTimeout(2500);
  await p.click('.talk__choice >> nth=0', { force: true }).catch((e) => console.log('LOG', e.message)); await p.waitForTimeout(400); await close();
  // chips
  for (const [x, z] of [[-18, -1], [-6, -21], [17, -16], [-20, 20], [21, 18]]) { await tp(x, z); await sim(0.4); }
  // podium
  await tp(-16, 15); await sim(0.3); await E(); await p.waitForTimeout(1500);
  await p.click('.talk__choice >> nth=1', { force: true }).catch((e) => console.log('LOG', e.message)); await p.waitForTimeout(400); await close();
  // memory palace: start, read the sequence from state by watching, then step
  await tp(17, 3.2); await sim(0.3); await E();
  // boss arena: shield reduces damage, then solve tiles by walking onto the diagonal
  await tp(0, -6); await sim(1.5);
  await shot('boss', 2000);
  const d0 = await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'samsung-agent-loop'); const h = b.hp; b.hit(40); return [h - b.hp, b.name]; });
  check('unsolved: 25% damage', d0[0] === 10, JSON.stringify(d0));
  for (const [x, z] of [[-3, -10], [3, -16], [0, -13]]) { await tp(x, z); await sim(0.15); await tp(6, -8); await sim(0.1); }
  const d1 = await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'samsung-agent-loop'); const h = b.hp; b.hit(40); return [h - b.hp, b.name]; });
  check('solved: full damage', d1[0] === 40, JSON.stringify(d1));
  await tp(0, -12); await sim(2);
  await shot('boss2', 2000);
  const names = [];
  for (let i = 0; i < 18; i++) { const n = await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'samsung-agent-loop'); if (b.alive) b.hit(30); window.__g.player.hp = 999; return b.name; }); names.push(n); await sim(0.8); }
  console.log('LOG names', [...new Set(names)].join(' | '));
  const after = await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'samsung-agent-loop'); return { alive: b.alive, defeated: b.defeated }; });
  check('boss defeated', after.defeated && !after.alive, JSON.stringify(after));
  await sim(1.2);
  const st = await ev(() => ({ state: window.__g.S.world.data.samsung, quests: window.__g.S.world.quests, road: window.__g.S.world.road, eggs: Object.keys(window.__g.S.eggs).filter((k) => k.startsWith('samsung')) }));
  console.log('LOG state', JSON.stringify(st));
  check('badge', !!st.road['badge-samsung']);
  check('quest done', st.quests['samsung-themes'] === 'done');
};
