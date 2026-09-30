// REGIONS-D: the Defense, start to credits to the page (node rd.mjs finale 1 $S/rd_finale.mjs)
export default async ({ p, ev, sim, check, shot }) => {
  const O = await ev(() => [window.__g.where.ox, window.__g.where.oz]);
  const tp = (x, z) => ev(([x, z, O]) => { window.__g.teleport(x + O[0], z + O[1]); window.__g.player.hp = 999; }, [x, z, O]);
  const E = async () => { await p.keyboard.press('KeyE'); await p.waitForTimeout(350); };
  const close = () => ev(() => window.__g.closeAllModals());
  const pick = async (n) => { await p.click(`.talk__choice >> nth=${n}`, { force: true }).catch((e) => console.log('LOG click', e.message.split('\n')[0])); await p.waitForTimeout(300); };
  const talk = async (id) => { await ev((id) => { const g = window.__g; g.talk(g.npcs.find((n) => n.id === id)); }, id); await p.waitForTimeout(500); };
  const F = () => ev(() => { const d = window.__g.regions.builtRegion('finale').debug; return { gradT: d.F.gradT, phase: d.F.phase, active: d.F.active?.id || null, q: !!d.QS.m, pose: d.F.pose }; });
  const eggs = () => ev(() => Object.keys(window.__g.S.eggs).filter((k) => k.startsWith('finale-')));

  // the full Road first (debug helper lives in the Stacks)
  await ev(() => window.__g.ensureRegion('stacks'));
  await ev(() => window.__g.regions.builtRegion('stacks').debug.grantAll());
  await p.waitForTimeout(4200); await close();
  check('road complete', await ev(() => window.__g.regions.ROAD.every((r) => window.__g.S.world.road[r.id])));

  // side stuff: Paws, the slides, the Sun God
  await talk('finale-paws'); await pick(0); await close();
  await tp(0, -12.2); await sim(0.2); await E(); await pick(0); await close();
  await tp(-10, 11.2); await sim(0.2); await E(); await close();
  await shot('hall', 600);

  // the lectern → "Any questions?" → the defense
  await tp(7, -10.4); await sim(0.2); await E();
  await pick(0); await pick(0); await pick(0); await pick(0); await pick(0);
  check('silence phase', (await F()).phase === 'silence', JSON.stringify(await F()));
  await tp(0, -2); await sim(5);
  let f = await F();
  check('first member steps up', f.phase === 'member' && f.active === 'finale-fn-chair', JSON.stringify(f));
  const turn = await ev(() => { const b = window.__g.patternBosses.find((x) => x.id === 'finale-fn-systems'); return b.hit(50); });
  check('not their turn: no damage', turn === false);
  for (let m = 0; m < 3; m++) {
    // wait for a question, then answer it at the right stand
    for (let i = 0; i < 30 && !(await F()).q; i++) { await sim(0.5); await ev(() => { window.__g.player.hp = 999; }); }
    const hp0 = await ev(() => window.__g.regions.builtRegion('finale').debug.F.active.hp);
    const ri = await ev(() => window.__g.regions.builtRegion('finale').debug.right());
    const ANS = [[-8, -1.5], [0, 2], [8, -1.5]];
    await tp(ANS[ri][0], ANS[ri][1]); await sim(0.1); await E();
    const hp1 = await ev(() => window.__g.regions.builtRegion('finale').debug.F.active?.hp);
    check(`member ${m}: right answer hurts`, hp1 < hp0, `${hp0} → ${hp1}`);
    if (m === 0) await shot('member', 300);
    await tp(0, -2); await sim(1);
    await ev(() => { const d = window.__g.regions.builtRegion('finale').debug; d.F.active.hit(9999); });
    await sim(0.2); await p.waitForTimeout(2900); await sim(1.5);
    f = await F(); console.log('LOG after member', m, JSON.stringify(f));
  }
  check('one more experiment', f.phase === 'exp', JSON.stringify(f));
  await sim(3); await shot('experiment', 300);
  const e0 = await ev(() => window.__g.regions.builtRegion('finale').debug.exp.name);
  await sim(8);
  const e1 = await ev(() => window.__g.regions.builtRegion('finale').debug.exp.name);
  console.log('LOG exp', e0, '→', e1);
  check('experiment progresses on its own', e0 !== e1);
  for (let i = 0; i < 70 && (await F()).phase === 'exp'; i++) { await sim(1); await ev(() => { window.__g.player.hp = 999; }); }
  f = await F(); check('experiment finished by surviving', f.phase === 'verdict' || f.phase === 'grad', JSON.stringify(f));
  // deliberation → travel to the lawn → ceremony
  await p.waitForFunction(() => { const d = window.__g.regions.builtRegion('finale').debug; return d.F.pose === 'grad' && d.F.gradT >= 0; }, null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(600); await sim(0.1);
  f = await F(); check('graduation pose', f.pose === 'grad' && f.phase === 'grad', JSON.stringify(f));
  await sim(5.5); await shot('graduation', 200);
  await sim(6);
  await p.waitForSelector('[data-credits="page"]', { timeout: 8000 }).catch(() => {});
  check('credits open', await ev(() => !!document.querySelector('[data-credits="page"]')));
  check('title set', (await ev(() => window.__g.S.world.title)) === 'Dr. (Honorary)');
  await p.waitForTimeout(2500); await shot('credits', 100);
  const txt = await ev(() => document.querySelector('.modal__body').innerText);
  for (const k of ['Samsung Semiconductor', 'TritonGym', 'under review, ICML 2026', 'IEEE Intelligent Vehicles Symposium', 'Tsinghua University', 'Starry-Next', 'CST-OJ', 'Thanks for playing', 'Prof. Yufei Ding']) check(`credits mention ${k}`, txt.includes(k));
  await p.click('[data-credits="skip"]'); await p.waitForTimeout(400);
  await shot('credits_end', 100);
  const e = await eggs(); console.log('LOG eggs', e.length, e.join(','));
  check('finale eggs >= 8', e.length >= 8, e.length);
  await p.click('[data-credits="page"]'); await p.waitForTimeout(1500);
  const after = await ev(() => ({ playing: window.__g.playing, where: window.__g.where.id }));
  check('back to the page', !after.playing && after.where === 'hub', JSON.stringify(after));
  // NG+: back into the finale, the lectern offers a rematch
  await ev(() => { window.__g.enterPlay({ dive: false }); return window.__g.travel('finale', null, { instant: true }); });
  await p.waitForTimeout(1500); await close();
  await tp(7, -10.4); await sim(0.2); await E(); await p.waitForTimeout(900); await pick(0); await p.waitForTimeout(1500);
  const again = await ev(() => document.querySelector('.talk__text, .modal__body')?.innerText || '');
  check('NG+: defend again leads to the silence', again.includes('Any questions'), again.slice(0, 80));
  await close();
  return 'exited';
};
