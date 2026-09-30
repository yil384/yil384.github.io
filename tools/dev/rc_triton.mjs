export default async ({ p, ev, sim, check, shot }) => {
  const O = await ev(() => [window.__g.where.ox, window.__g.where.oz]);
  const tp = (x, z) => ev(([x, z, O]) => { window.__g.teleport(x + O[0], z + O[1]); window.__g.player.hp = 999; }, [x, z, O]);
  const E = async () => { await p.keyboard.press('KeyE'); await p.waitForTimeout(400); };
  const close = () => ev(() => window.__g.closeAllModals());
  const pick = async (n) => { await p.click(`.talk__choice >> nth=${n}`, { force: true }).catch((e) => console.log('LOG click', e.message.split('\n')[0])); await p.waitForTimeout(350); };
  const talk = async (id) => { await ev((id) => { const g = window.__g; g.talk(g.npcs.find((n) => n.id === id)); }, id); await p.waitForTimeout(600); };
  const dbg = () => ev(() => { const d = window.__g.regions.builtRegion('triton').debug; return { vram: d.vram, stun: d.stunT }; });
  // entrance: jit arch, paper, statue
  await tp(0, 15); await sim(0.2); await tp(0, 13); await sim(0.3); await tp(0, 11); await sim(0.2);
  await tp(-7.5, 13.8); await sim(0.3); await E(); await close();
  await tp(9.5, 13.6); await sim(0.3); await E(); await close();
  await tp(19, 5.5); await sim(0.3); await E(); await close();
  // Kernie: softmax all the way, python; coach
  await talk('tg-kernie'); await pick(0); await pick(0); await pick(0); await pick(0); await pick(0); await close();
  await talk('tg-kernie'); await pick(1); await close();
  await talk('tg-coach'); await pick(1); await close();
  // tools
  for (const [x, z] of [[-19.5, -12.5], [17, -5], [18.5, 11.5], [-18, -19]]) { await tp(x, z); await sim(0.4); }
  await talk('tg-kernie'); await close();
  // a warp + the idle thread
  await ev(() => { const g = window.__g; const t = g.foes.filter((f) => f.kindId === 'triton-thread').slice(0, 4); for (const f of t) f.hit(9999); g.foes.find((f) => f.kindId === 'triton-idle').hit(9999); });
  // boss: 40% before OOM
  await tp(0, 5); await sim(1.5);
  await shot('ring', 1500);
  const d0 = await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'triton-oom-golem'); const h = b.hp; b.hit(50); return [h - b.hp, b.name]; });
  check('cached: 40% damage', d0[0] === 20, JSON.stringify(d0));
  const v0 = await dbg();
  // pull levers until OOM
  for (const [x, z] of [[0, 6.3], [9.3, -3], [-9.3, -3], [0, -12.3]]) { await tp(x, z); await sim(0.15); await E(); const v = await dbg(); console.log('LOG vram', JSON.stringify(v)); if (v.stun) break; }
  const v1 = await dbg();
  check('OOM reached', v1.stun > 0, JSON.stringify([v0, v1]));
  await shot('oom', 1200);
  const d1 = await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'triton-oom-golem'); const h = b.hp; b.hit(50); return [h - b.hp, b.name]; });
  check('OOM: x3 damage', d1[0] === 150, JSON.stringify(d1));
  // stun expires
  await tp(0, 6); await sim(7.5);
  const v2 = await dbg();
  check('recovered after stun', v2.stun === 0, JSON.stringify(v2));
  for (let i = 0; i < 30; i++) {
    const a = await ev(() => { const g = window.__g; const b = g.patternBosses.find((x) => x.id === 'triton-oom-golem'); g.player.hp = 999; if (b.alive) b.hit(60); return b.alive; });
    if (!a) break;
    const v = await dbg(); if (!v.stun && i % 3 === 2) { await tp(0, 6.3); await sim(0.1); await E(); }
    await sim(0.5);
  }
  await close(); await sim(1.2); await close(); await sim(0.6);
  const s = await ev(() => ({ state: window.__g.S.world.data.triton, quests: window.__g.S.world.quests, road: window.__g.S.world.road, eggs: Object.keys(window.__g.S.eggs).filter((k) => k.startsWith('triton-')) }));
  console.log('LOG state', JSON.stringify(s));
  check('relic', !!s.road['relic-triton']);
  check('quest done', s.quests['triton-tools'] === 'done');
  check('eggs >= 11', s.eggs.length >= 11, s.eggs.length);
};
