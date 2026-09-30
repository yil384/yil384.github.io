export default async ({ p, ev, sim, check, shot }) => {
  const O = await ev(() => [window.__g.where.ox, window.__g.where.oz]);
  const tp = (x, z) => ev(([x, z, O]) => { window.__g.teleport(x + O[0], z + O[1]); window.__g.player.hp = 999; }, [x, z, O]);
  const voice = async (text) => {
    await tp(-3, 15.5); await sim(0.3);
    await p.keyboard.press('KeyE'); await p.waitForTimeout(2500);
    await p.click('.talk__choice >> nth=0', { force: true }).catch((e) => console.log('LOG click fail', e.message));
    await p.waitForTimeout(600);
    const has = await ev(() => !!document.querySelector('.modal.is-open .typing__input'));
    if (!has) { console.log('LOG no voice input'); return false; }
    await p.fill('.modal.is-open .typing__input', text);
    await p.keyboard.press('Enter');
    await p.waitForTimeout(400);
    await sim(0.5);
    return true;
  };
  check('voice modal', await voice('PIP, FOLLOW ME'));
  await voice('跟上');
  await voice('dance please');
  await voice('blorp');
  await voice('attack!');
  // walk toward snapdrakes; teammates should move/attack
  const m0 = await ev(() => window.__g.npcs.filter((n) => n.region === 'timi').map((n) => [n.id, n.x.toFixed(1), n.z.toFixed(1)]));
  await tp(0, -6); await sim(3);
  const m1 = await ev(() => window.__g.npcs.filter((n) => n.region === 'timi').map((n) => [n.id, n.x.toFixed(1), n.z.toFixed(1)]));
  console.log('LOG mates', JSON.stringify(m0), JSON.stringify(m1));
  check('teammates moved', JSON.stringify(m0) !== JSON.stringify(m1));
  await shot('mates', 2500);
  // quest board, monolith
  await tp(3.5, 14.5); await sim(0.2); await p.keyboard.press('KeyE'); await p.waitForTimeout(500); await ev(() => window.__g.closeAllModals());
  await tp(13, 13.8); await sim(0.2); await p.keyboard.press('KeyE'); await p.waitForTimeout(500); await ev(() => window.__g.closeAllModals());
  // boss
  await tp(0, -7); await sim(2);
  await shot('boss', 2500);
  for (let i = 0; i < 16; i++) { await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'timi-hitboxia'); if (b.alive) b.hit(32); window.__g.player.hp = 999; }); await sim(0.8); if (i === 6) await shot('boss2', 1500); }
  const after = await ev(() => { const g = window.__g; const b = g.patternBosses.find((x) => x.id === 'timi-hitboxia'); return { alive: b.alive, defeated: b.defeated }; });
  check('boss defeated', after.defeated && !after.alive, JSON.stringify(after));
  await ev(() => { const g = window.__g; for (const f of g.foes.filter((f) => f.region === 'timi' && /tpose|missing/.test(f.kindId))) f.hit(9999); });
  for (const [x, z] of [[15, -4], [18, -8], [13, -10]]) { await tp(x, z); await sim(0.3); }
  await sim(1.2);
  const st = await ev(() => ({ state: window.__g.S.world.data.timi, quests: window.__g.S.world.quests, road: window.__g.S.world.road, eggs: Object.keys(window.__g.S.eggs).filter((k) => k.startsWith('timi')) }));
  console.log('LOG state', JSON.stringify(st));
  check('badge', !!st.road['badge-timi']);
  check('quest done', st.quests['timi-playtest'] === 'done');
};
