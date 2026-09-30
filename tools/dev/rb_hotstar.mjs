export default async ({ p, ev, sim, check, shot }) => {
  const O = await ev(() => [window.__g.where.ox, window.__g.where.oz]);
  const tp = (x, z) => ev(([x, z, O]) => { window.__g.teleport(x + O[0], z + O[1]); window.__g.player.hp = 999; }, [x, z, O]);
  // big screen spot
  await tp(0, 13); await sim(0.3); await tp(0, 10.5); await sim(0.5);
  await shot('spot', 2500);
  // search
  await tp(0, 9); await sim(0.3); await p.keyboard.press('KeyE'); await p.waitForTimeout(600);
  const has = await ev(() => !!document.querySelector('.modal.is-open input'));
  check('search modal', has);
  if (has) {
    await p.fill('.modal.is-open input', 'triton'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    const r1 = await ev(() => document.querySelector('.modal.is-open .modal__body').textContent.slice(0, 300));
    check('search finds TritonGym', /TritonGym/.test(r1), r1.slice(0, 120));
    await p.fill('.modal.is-open input', 'pizza'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    const r2 = await ev(() => document.querySelector('.modal.is-open .modal__body').textContent);
    check('did you mean', /Did you mean/.test(r2));
    await shot('search', 1500);
    await ev(() => window.__g.closeAllModals());
  }
  // new user
  await tp(-4, 11); await sim(0.3); await p.keyboard.press('KeyE'); await p.waitForTimeout(2500);
  await p.click('.talk__choice >> nth=1', { force: true }).catch((e) => console.log('LOG click fail', e.message));
  await p.waitForTimeout(400); await ev(() => window.__g.closeAllModals());
  // boss: overfit damage then racks
  await tp(0, 1); await sim(1.5);
  const hp0 = await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'hotstar-engine'); b.hit(50); return b.hp; });
  check('overfit reduces damage', hp0 >= 380, hp0);
  await shot('boss', 2500);
  for (const [rx, rz] of [[-7, -7], [0, -11], [7, -7]]) {
    const cx = rx + 0.5, cz = rz + 0.5, dx = 0 - cx, dz = -2 - cz, l = Math.hypot(dx, dz);
    await tp(cx + dx / l * 2, cz + dz / l * 2); await sim(0.3); await p.keyboard.press('KeyE'); await p.waitForTimeout(200); await sim(0.2);
  }
  const n = await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'hotstar-engine'); const h = b.hp; b.hit(50); return h - b.hp; });
  check('tuned full damage', n === 50, n);
  // kill 3 quickly for the wave
  await ev(() => { const g = window.__g; let k = 0; for (const f of g.foes.filter((f) => f.region === 'hotstar' && f.kindId === 'hotstar-cold' && f.alive)) { if (k++ < 4) { f.hit(9999); g.emit('kill', { target: f, source: 'player' }); } } });
  await sim(0.5);
  await shot('wave', 800);
  for (let i = 0; i < 14; i++) { await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'hotstar-engine'); if (b.alive) b.hit(40); window.__g.player.hp = 999; }); await sim(0.8); }
  const after = await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'hotstar-engine'); return { alive: b.alive, defeated: b.defeated }; });
  check('boss defeated', after.defeated && !after.alive, JSON.stringify(after));
  await tp(3, 16); await sim(12);
  await sim(1);
  const st = await ev(() => ({ state: window.__g.S.world.data.hotstar, quests: window.__g.S.world.quests, road: window.__g.S.world.road, eggs: Object.keys(window.__g.S.eggs).filter((k) => k.startsWith('hotstar')) }));
  console.log('LOG state', JSON.stringify(st));
  check('badge', !!st.road['badge-hotstar']);
  check('quest done', st.quests['hotstar-personalise'] === 'done');
};
