export default async ({ p, ev, sim, check, shot }) => {
  // dialog choices only appear once the typewriter finishes: click the text to finish it, then pick
  const pick = async (n) => {
    await p.click('.modal.is-open .talk__text', { force: true, timeout: 5000 }).catch(() => {});
    await p.click(`.modal.is-open .talk__choice >> nth=${n}`, { force: true, timeout: 10000 }).catch((e) => console.log('LOG click fail', e.message));
    await p.waitForTimeout(300);
  };
  // candles move
  const c0 = await ev(() => window.__g.world.platforms.filter((q) => q.region === 'metabit').map((q) => q.top.toFixed(2)));
  await sim(1);
  const c1 = await ev(() => window.__g.world.platforms.filter((q) => q.region === 'metabit').map((q) => q.top.toFixed(2)));
  check('candles move', c0.join() !== c1.join(), `${c0.join(',')} -> ${c1.join(',')}`);
  // stand on candle 0: teleport onto it and sim; should be carried
  const o = await ev(() => { const g = window.__g; g.teleport(14, 400 + 11); g.player.y = 12; return true; });
  await sim(1.5);
  const onC = await ev(() => { const g = window.__g; const pl = g.world.platforms.find((q) => q.region === 'metabit'); return { y: g.player.y, top: pl.top, grounded: g.player.grounded }; });
  check('player rides candle 0', Math.abs(onC.y - onC.top) < 0.3 && onC.grounded, JSON.stringify(onC));
  // fall into the abyss -> respawn + sell-low egg
  await ev(() => { const g = window.__g; g.teleport(18, 400 + 0); g.player.y = 3; });
  await sim(3);
  const fell = await ev(() => ({ pos: [window.__g.player.x - 0, window.__g.player.z - 400], egg: JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /egg/i.test(k))) || '{}') }));
  console.log('LOG after fall', JSON.stringify(fell.pos));
  // interact: AI Platform stream, desk, breaker via E key near them
  const useAt = async (x, z) => { await ev(([x, z]) => { const g = window.__g; g.teleport(x, 400 + z); }, [x, z]); await sim(0.3); await p.keyboard.press('KeyE'); await p.waitForTimeout(400); };
  await useAt(-15.5, 16);
  const dlg = await ev(() => document.querySelector('.modal.is-open')?.textContent?.slice(0, 120));
  check('AI platform dialog opens', /AI PLATFORM/.test(dlg || ''), dlg);
  await pick(1); // "Stream it, chunk by chunk"
  await ev(() => window.__g.closeAllModals());
  await useAt(7, 16.5); await ev(() => window.__g.closeAllModals());
  await useAt(10, 13); await ev(() => window.__g.closeAllModals());
  // talk to Hedge (quest step 'hedge')
  await ev(() => { const g = window.__g; g.talk(g.npcs.find((n) => n.id === 'metabit-hedge')); });
  await p.waitForTimeout(400); await pick(3); await ev(() => window.__g.closeAllModals());
  // kill rows
  await ev(() => { const g = window.__g; for (const f of g.foes.filter((f) => f.region === 'metabit' && f.kindId === 'metabit-row')) f.hit(9999); for (const f of g.foes.filter((f) => f.region === 'metabit' && f.kindId === 'metabit-blob').slice(0, 1)) f.hit(9999); });
  await sim(0.6);
  const chunks = await ev(() => window.__g.foes.filter((f) => f.kindId === 'metabit-chunk').length);
  check('blob splits into chunks', chunks >= 3, chunks);
  // ring the bell
  await useAt(19, -19);
  await sim(0.2);
  const bs = await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'metabit-flash-crash'); return { alive: b.alive, vis: b.mesh.visible }; });
  check('bell summons boss', bs.alive && bs.vis, JSON.stringify(bs));
  await ev(() => { const g = window.__g; g.teleport(-8, 400 - 7); });
  await sim(4);
  await shot('boss', 2500);
  // fight: hit with real damage and sim to see phases
  for (let i = 0; i < 12; i++) { await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'metabit-flash-crash'); if (b.alive) b.hit(35); window.__g.player.hp = 999; }); await sim(1); }
  const after = await ev(() => { const g = window.__g; const b = g.patternBosses.find((x) => x.id === 'metabit-flash-crash'); return { alive: b.alive, defeated: b.defeated, road: JSON.stringify(g.S.road || g.S.world.road || null), hp: b.hp }; });
  check('boss defeated', after.defeated && !after.alive, JSON.stringify(after));
  await sim(1.2);
  const st = await ev(() => ({ state: window.__g.S.world.data.metabit, quests: window.__g.S.world.quests, road: window.__g.S.world.road, eggs: Object.keys(window.__g.S.eggs).filter((k) => k.startsWith('metabit')) }));
  console.log('LOG state', JSON.stringify(st));
  check('badge awarded', !!st.road['badge-metabit']);
  check('quest done', st.quests['metabit-feed'] === 'done');
};
