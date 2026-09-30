export default async ({ p, ev, sim, check, shot }) => {
  const O = await ev(() => [window.__g.where.ox, window.__g.where.oz]);
  const tp = (x, z) => ev(([x, z, O]) => { window.__g.teleport(x + O[0], z + O[1]); window.__g.player.hp = 999; }, [x, z, O]);
  const E = async () => { await p.keyboard.press('KeyE'); await p.waitForTimeout(300); };
  // walk the stairs: S1 from plaza up
  await tp(0, 15); await sim(0.3);
  await ev(() => { window.__g.rig.yaw = 0; });
  await p.keyboard.down('KeyW'); const s1 = await sim(1.2); await p.keyboard.up('KeyW');
  check('climbs S1 stairs to floor 1', s1.y >= 5.4, JSON.stringify(s1));
  // redis twice
  await tp(-12.4, -2); await sim(0.3); await E(); await sim(2.5); await p.waitForTimeout(2000); await E();
  // publish
  await tp(-7.5, -9); await sim(0.3); await E(); await sim(9);
  // elevator: stand in shaft at bottom and wait up to a cycle
  await tp(7.5, 1.5); let maxY = 0;
  for (let i = 0; i < 14; i++) { const r = await sim(1); maxY = Math.max(maxY, r.y); }
  check('elevator reaches roof', maxY > 13, maxY);
  await shot('elevator', 2000);
  // boss: consumers
  await tp(0, 1); await sim(1);
  await shot('boss', 2000);
  const hp0 = await ev(() => window.__g.patternBosses.find((x) => x.id === 'lark-backlog').hp);
  for (const [x, z] of [[-5, -6], [5, -6], [-5, 2]]) { const dx = 0 - x, dz = -2 - z, l = Math.hypot(dx, dz); await tp(x + dx / l * 1.5, z + dz / l * 1.5); await sim(0.2); await E(); }
  await tp(0, 1.5); await sim(4);
  const hp1 = await ev(() => window.__g.patternBosses.find((x) => x.id === 'lark-backlog').hp);
  check('consumers drain boss', hp1 < hp0 - 20, `${hp0} -> ${hp1}`);
  await shot('beams', 2000);
  await sim(16);
  for (let i = 0; i < 20; i++) { await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'lark-backlog'); if (b.alive) b.hit(30); window.__g.player.hp = 999; }); await sim(0.6); }
  const after = await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'lark-backlog'); return { alive: b.alive, defeated: b.defeated }; });
  check('boss defeated', after.defeated && !after.alive, JSON.stringify(after));
  // mail
  for (const [x, z] of [[-20, -9], [20, -19], [-12.5, -11], [9, 5], [-3, 1]]) { await tp(x, z); await sim(0.4); }
  await ev(() => { const g = window.__g; g.talk(g.npcs.find((n) => n.id === 'lk-larkin')); });
  await p.waitForTimeout(500); await ev(() => window.__g.closeAllModals());
  await ev(() => { const g = window.__g; g.talk(g.npcs.find((n) => n.id === 'lk-askai')); });
  await p.waitForTimeout(2500); await p.click('.talk__choice >> nth=3', { force: true }).catch((e) => console.log('LOG', e.message)); await p.waitForTimeout(300);
  await ev(() => window.__g.closeAllModals());
  await tp(-6, 18); await sim(0.2); await E(); await ev(() => window.__g.closeAllModals());
  await sim(1.2);
  const st = await ev(() => ({ state: window.__g.S.world.data.lark, quests: window.__g.S.world.quests, road: window.__g.S.world.road, eggs: Object.keys(window.__g.S.eggs).filter((k) => k.startsWith('lark')) }));
  console.log('LOG state', JSON.stringify(st));
  check('badge', !!st.road['badge-lark']);
  check('quest done', st.quests['lark-mail'] === 'done');
};
