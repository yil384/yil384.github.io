export default async ({ p, ev, sim, check, shot }) => {
  const O = await ev(() => [window.__g.where.ox, window.__g.where.oz]);
  const tp = (x, z) => ev(([x, z, O]) => { window.__g.teleport(x + O[0], z + O[1]); window.__g.player.hp = 999; }, [x, z, O]);
  const E = async () => { await p.keyboard.press('KeyE'); await p.waitForTimeout(400); };
  const close = () => ev(() => window.__g.closeAllModals());
  const pick = async (n) => { await p.click(`.talk__choice >> nth=${n}`, { force: true }).catch((e) => console.log('LOG click', e.message.split('\n')[0])); await p.waitForTimeout(350); };
  const talk = async (id) => { await ev((id) => { const g = window.__g; g.talk(g.npcs.find((n) => n.id === id)); }, id); await p.waitForTimeout(600); };
  const st = () => ev(() => window.__g.S.world.data.oj);
  const C = -1;
  // TA-bot, queue board
  await talk('oj-ta'); await pick(1); await close();
  await tp(13, 18); await sim(0.3); await E(); await close();
  // gate 1 blocks before floor 1 passes
  const g0 = await ev(([O]) => window.__g.world.isBlocked(17 + O[0], -1 + O[1]), [O]);
  check('gate 1 closed', g0);
  // boss before AC: 25%
  await tp(0, C + 4); await sim(1);
  await shot('top', 1500);
  const d0 = await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'oj-hidden'); const h = b.hp; b.hit(40); return [h - b.hp, b.name]; });
  check('hidden: 25% damage', d0[0] === 10, JSON.stringify(d0));
  // judge UI: canned hardcode, then typed AC via the input
  await tp(7.5, 19.2); await sim(0.3); await E(); await p.waitForTimeout(300);
  const opened = await ev(() => !!document.querySelector('.typing__input'));
  check('judge modal opens', opened);
  await shot('judge', 800);
  await p.click('button.btn >> text=print(3)', { force: true }).catch((e) => console.log('LOG', e.message.split('\n')[0]));
  await p.waitForTimeout(2600);
  await E(); await p.waitForTimeout(300);
  await p.fill('.typing__input', 'a, b = map(int, input().split()); print(a + b)');
  await p.keyboard.press('Enter'); await p.waitForTimeout(2600);
  check('solved via typed AC', !!(await st()).solved);
  const verdicts = await ev(() => { const d = window.__g.regions.builtRegion('oj').debug; for (const c of ['', 'while True: pass', 'v = vec![0; 1000000000]', 'panic!("x")', 'os.system("rm -rf /")', 'print(a - b)']) d.judge(c); return true; });
  void verdicts;
  await p.waitForTimeout(2600);
  // floors
  for (let k = 1; k <= 4; k++) {
    await ev((k) => { const kind = ['', 'oj-wa', 'oj-tle', 'oj-mle', 'oj-re'][k]; for (const f of window.__g.foes.filter((f) => f.kindId === kind)) f.hit(9999); }, k);
    await sim(0.3);
  }
  const s1 = await st();
  check('all floors passed', [1, 2, 3, 4].every((k) => s1.passed[k]), JSON.stringify(s1.passed));
  const gates = await ev(([O]) => [[17, -1], [0, -15], [-11, -1], [0, 7]].map(([x, z]) => window.__g.world.isBlocked(x + O[0], z + O[1])), [O]);
  check('gates open', gates.every((b) => !b), JSON.stringify(gates));
  // walk up the south stairs from the plaza to floor 1 (checks the stair heights)
  await tp(0, 21.4); await ev(() => { window.__g.rig.yaw = 0; });
  await p.keyboard.down('KeyW'); const w = await sim(1.6); await p.keyboard.up('KeyW');
  console.log('LOG walk', JSON.stringify(w));
  check('climbed to floor 1', w.y >= 5.4, JSON.stringify(w));
  // Stu
  await talk('oj-stu'); await close();
  for (const [x, z] of [[-17.5, C - 11], [14.5, C + 10], [-11.5, C - 8]]) { await tp(x, z); await sim(0.4); }
  await talk('oj-stu'); await close();
  // boss, full damage now
  await tp(0, C + 5); await sim(0.5);
  const d1 = await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'oj-hidden'); const h = b.hp; b.hit(40); return [h - b.hp, b.name]; });
  check('exposed: full damage', d1[0] === 40, JSON.stringify(d1));
  for (let i = 0; i < 16; i++) { const a = await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'oj-hidden'); if (b.alive) b.hit(40); window.__g.player.hp = 999; return b.alive; }); if (!a) break; await sim(0.6); }
  await close(); await sim(1.2); await close(); await sim(0.6);
  await tp(0, C + 5); await sim(0.3); await tp(0, C); await sim(0.3);
  await shot('ac', 2000);
  const s = await ev(() => ({ state: window.__g.S.world.data.oj, quests: window.__g.S.world.quests, road: window.__g.S.world.road, eggs: Object.keys(window.__g.S.eggs).filter((k) => k.startsWith('oj-')) }));
  console.log('LOG state', JSON.stringify(s));
  console.log('LOG steps', JSON.stringify(await ev(async () => { const m = await import('/assets/js/game3d/road.js'); const q = m.QUESTS.find((q) => q.id === 'oj-climb'); return q.steps.map((s) => [s.id, s.done()]); })));
  console.log('LOG player', JSON.stringify(await ev(() => { const g = window.__g; return [g.player.x, g.player.y, g.player.z, g.player.dead, g.mode.play]; })));
  check('relic', !!s.road['relic-oj']);
  check('quest edges done', s.quests['oj-edges'] === 'done');
  check('quest climb done', s.quests['oj-climb'] === 'done');
  check('eggs >= 12', s.eggs.length >= 12, s.eggs.length);
};
