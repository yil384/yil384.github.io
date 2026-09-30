export default async ({ p, ev, sim, check }) => {
  const O = await ev(() => [window.__g.where.ox, window.__g.where.oz]);
  for (const [x, z] of [[-20, -9], [20, -19], [-12.5, -11], [9, 5], [-3, 1]]) {
    await ev(([x, z, O]) => { window.__g.teleport(x + O[0], z + O[1]); }, [x, z, O]);
    const r = await sim(0.4);
    console.log('LOG', x, z, JSON.stringify(r), await ev(() => JSON.stringify(window.__g.S.world.data.lark.picked || {})), await ev(() => window.__g.player.dead));
  }
  // elevator in real time
  await ev(([O]) => { window.__g.teleport(7.5 + O[0], 1.5 + O[1]); }, [O]);
  let maxY = 0;
  for (let i = 0; i < 15; i++) { await p.waitForTimeout(1000); const r = await sim(0.05); maxY = Math.max(maxY, r.y); }
  check('elevator reaches roof (real time)', maxY > 13, maxY);
};
