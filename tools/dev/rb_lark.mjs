export default async ({ p, ev, sim, check, shot }) => {
  const O = await ev(() => [window.__g.where.ox, window.__g.where.oz]);
  const tp = (x, z) => ev(([x, z, O]) => { window.__g.teleport(x + O[0], z + O[1]); window.__g.player.hp = 999; }, [x, z, O]);
  // dialog choices only appear once the typewriter finishes: click the text to finish it, then pick
  const pick = async (n) => {
    await p.click('.modal.is-open .talk__text', { force: true, timeout: 5000 }).catch(() => {});
    await p.click(`.modal.is-open .talk__choice >> nth=${n}`, { force: true, timeout: 10000 }).catch((e) => console.log('LOG click fail', e.message));
  };
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
  // elevator: stand in the shaft at the bottom and wait up to a cycle (13 s). The elevator follows the
  // region's clock `t`, which __g.sim takes from performance.now(), so it must be waited out in real time.
  await tp(7.5, 1.5); let maxY = 0;
  for (let i = 0; i < 15; i++) { await p.waitForTimeout(1000); const r = await sim(0.05); maxY = Math.max(maxY, r.y); }
  check('elevator reaches roof', maxY > 13, maxY);
  await shot('elevator', 2000);
  // boss: consumers
  await tp(0, 1); await sim(1);
  await shot('boss', 2000);
  const hp0 = await ev(() => window.__g.patternBosses.find((x) => x.id === 'lark-backlog').hp);
  // active consumers = drain beams drawn (2 vertices each), refreshed every frame while the boss is up
  const beamsOn = () => ev(() => { const g = window.__g; const b = g.scene.getObjectByName('region:lark').children.find((c) => c.isLineSegments); return b.visible ? b.geometry.drawRange.count / 2 : 0; });
  for (const [x, z] of [[-5, -6], [5, -6], [-5, 2]]) {
    const dx = 0 - x, dz = -2 - z, l = Math.hypot(dx, dz);
    const before = await beamsOn();
    await tp(x + dx / l * 1.5, z + dz / l * 1.5); await sim(0.2); await E(); await sim(0.05);
    const after = await beamsOn();
    console.log('LOG consumer', x, z, before, '->', after, await ev(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).slice(-1)[0]));
  }
  check('three consumers online', (await beamsOn()) === 3, await beamsOn());
  await tp(0, 1.5); await sim(0.1);
  const hpA = await ev(() => window.__g.patternBosses.find((x) => x.id === 'lark-backlog').hp);
  await sim(4);
  const hp1 = await ev(() => window.__g.patternBosses.find((x) => x.id === 'lark-backlog').hp);
  // 3 consumers x 3 HP every 0.5 s while you are on the roof = ~72 HP in 4 s
  check('consumers drain boss', hp1 < hpA - 40, `${hp0} -> ${hpA} -> ${hp1}`);
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
  await p.waitForTimeout(400); await pick(3); await p.waitForTimeout(300); // "Who built you?"
  await ev(() => window.__g.closeAllModals());
  await tp(-6, 18); await sim(0.2); await E(); await ev(() => window.__g.closeAllModals());
  await sim(1.2);
  const st = await ev(() => ({ state: window.__g.S.world.data.lark, quests: window.__g.S.world.quests, road: window.__g.S.world.road, eggs: Object.keys(window.__g.S.eggs).filter((k) => k.startsWith('lark')) }));
  console.log('LOG state', JSON.stringify(st));
  check('badge', !!st.road['badge-lark']);
  check('quest done', st.quests['lark-mail'] === 'done');
};
