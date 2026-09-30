// REGIONS-D: full Stacks playthrough (node rd.mjs stacks 1 $S/rd_stacks.mjs)
export default async ({ p, ev, sim, check, shot }) => {
  const O = await ev(() => [window.__g.where.ox, window.__g.where.oz]);
  const tp = (x, z) => ev(([x, z, O]) => { window.__g.teleport(x + O[0], z + O[1]); window.__g.player.hp = 999; }, [x, z, O]);
  const E = async () => { await p.keyboard.press('KeyE'); await p.waitForTimeout(350); };
  const close = () => ev(() => window.__g.closeAllModals());
  const pick = async (n) => { await p.click(`.talk__choice >> nth=${n}`, { force: true }).catch((e) => console.log('LOG click', e.message.split('\n')[0])); await p.waitForTimeout(300); };
  const talk = async (id) => { await ev((id) => { const g = window.__g; g.talk(g.npcs.find((n) => n.id === id)); }, id); await p.waitForTimeout(500); };
  const dbg = () => window.__g.regions.builtRegion('stacks').debug;
  const eggs = () => ev(() => Object.keys(window.__g.S.eggs).filter((k) => k.startsWith('stacks-')));
  const st = () => ev(() => window.__g.S.world.data.stacks);

  // ---- eggs around the atrium
  await tp(-20, 15.4); await sim(0.2); await E(); await close();                      // Seuss hat
  await tp(15, 14.2); await sim(0.2); await E(); await pick(0); await close();         // card catalog → BibTeX
  await tp(0, 12); await sim(0.3);                                                      // stand on the desk
  await tp(0, 14.5); await sim(1.2);
  await ev(() => { window.__g.vehicles.set('car'); }); await p.keyboard.press('KeyH'); await sim(0.2); await ev(() => window.__g.vehicles.set(null));
  await talk('stacks-scenegen'); await pick(2); await close();                          // name egg
  await tp(0, -18.2); await sim(0.3); await E(); await close();                         // the door
  check('door sealed before the Road', !(await st()).doorOpen);
  // ---- side quest: overdue books
  await talk('stacks-quire'); await pick(0); await close();
  await tp(-5, -8); await sim(0.5);                                                     // top of a shelf
  const onShelf = await ev(() => window.__g.player.y);
  check('stood on the shelf top', onShelf > 9, onShelf);
  await tp(1.4, -14); await sim(0.2); await E(); await close();                         // fiat lux → spawns the Vim book
  await tp(8, -14); await sim(0.5);
  await tp(-23.5, -16); await sim(0.5);
  await tp(22.5, -19); await sim(0.5);
  await tp(-24, 1); await sim(0.4); await tp(24.5, 5); await sim(0.4);                 // asterisks
  await talk('stacks-quire'); await pick(0); await close(); await sim(1);
  const s1 = await st();
  check('overdue quest done', (await ev(() => window.__g.S.world.quests['stacks-overdue'])) === 'done', JSON.stringify(s1.picked));
  await shot('stacks', 800);

  // ---- the rebuttal
  await tp(-18.5, -3.5); await sim(1.5);
  await shot('boss', 1200);
  const d0 = await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'stacks-reviewer3'); const h = b.hp; b.hit(50); return h - b.hp; });
  check('shield: ~10% damage', d0 === 5, d0);
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < 20; i++) { await sim(0.5); await ev(() => { window.__g.player.hp = 999; }); if ((await ev(() => window.__g.regions.builtRegion('stacks').debug.R3.live.length)) > 0) break; }
    const pos = await ev(() => { const p = window.__g.regions.builtRegion('stacks').debug.R3.live[0]; return p ? [p.x, p.z] : null; });
    if (!pos) { console.log('LOG R3 no live comment this round'); continue; }
    await tp(pos[0], pos[1]); await sim(0.1); await p.waitForTimeout(400);
    const gi = await ev(() => window.__g.regions.builtRegion('stacks').debug.R3.goodIdx);
    await pick(gi); await close();
    console.log('LOG R3', JSON.stringify(await ev(() => { const r = window.__g.regions.builtRegion('stacks').debug.R3; return { shield: r.shield, open: r.open, score: r.score, right: r.right }; })));
  }
  const r3 = await ev(() => window.__g.regions.builtRegion('stacks').debug.R3);
  check('shield broken by rebuttals', r3.shield === 0 && r3.open > 0, JSON.stringify({ s: r3.shield, o: r3.open }));
  const d1 = await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'stacks-reviewer3'); const h = b.hp; b.hit(40); return h - b.hp; });
  check('open: 125% damage', d1 === 50, d1);
  await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'stacks-reviewer3'); b.hit(9999); });
  await sim(0.5); await close();
  const road1 = await ev(() => window.__g.S.world.road);
  check('seal-tritongym awarded', !!road1['seal-tritongym']);
  check('seal name says Under review', await ev(() => window.__g.regions.ROAD.find((r) => r.id === 'seal-tritongym').name.includes('Under review')));

  // ---- the scenario suite (car)
  await tp(17.5, 5.2); await sim(0.2); await E(); await p.waitForTimeout(300); await pick(0); await close();
  check('in the car', (await ev(() => window.__g.player.vehicle)) === 'car');
  await tp(18, -6); await sim(0.2);
  let hits = 0, lanes = 0;
  for (let sc = 0; sc < 3; sc++) {
    for (let i = 0; i < 12; i++) {
      await sim(2); await ev(() => { window.__g.player.hp = 999; }); await close();   // a toast-modal (egg) can pause the world mid-scenario
      const d = await ev(() => { const s = window.__g.regions.builtRegion('stacks').debug; return { run: s.SC.run, next: s.SC.nextIn, t: s.SC.t, hits: s.SC.hits, lane: s.lane(), rogues: s.SC.rogues.length }; });
      lanes = Math.max(lanes, d.lane); hits = Math.max(hits, d.hits);
      if (i === 3 && sc === 2) await shot('track', 200);
      if (i === 3 && sc === 1) { check('online: rogues spawned', d.rogues > 0, d.rogues); }
      if (d.run < 0 && !(d.next > 0)) { console.log('LOG scenario', sc, 'done after', i, JSON.stringify(d)); break; }
    }
    await sim(3.2);
  }
  check('traffic ran', lanes > 0, lanes);
  await close(); await sim(0.5); await close();
  const s2 = await st();
  check('scenario suite passed', s2.scen === 3, s2.scen);
  check('seal-reh2o awarded', !!(await ev(() => window.__g.S.world.road['seal-reh2o'])));
  await ev(() => window.__g.vehicles.set(null));

  // ---- the Defense: grant the Road (debug), road:complete opens the door
  await tp(0, -15); await sim(0.3);
  await ev(() => window.__g.regions.builtRegion('stacks').debug.grantAll());
  await p.waitForTimeout(4200); await close(); await sim(0.3);
  check('door open after road:complete', !!(await st()).doorOpen);
  await shot('door', 1500);
  await tp(0, -21); await sim(0.4); await tp(0, -23.5); await sim(0.3);
  await p.waitForFunction(() => window.__g.where.id === 'finale', null, { timeout: 15000 }).catch(() => {});
  check('portal into the finale', (await ev(() => window.__g.where.id)) === 'finale');
  await ev(() => window.__g.travel('stacks', null, { instant: true })); await p.waitForTimeout(1200);
  const e = await eggs();
  console.log('LOG eggs', e.length, e.join(','));
  check('eggs >= 14', e.length >= 14, e.length);
};
