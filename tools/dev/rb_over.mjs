// overview shots: env VIEWS='[[x,z,yaw,pitch,dist],...]' (local coords)
export default async ({ p, ev, sim, shot, region }) => {
  const views = JSON.parse(process.env.VIEWS || '[[0,0,0.6,0.9,42]]');
  let i = 0;
  for (const [x, z, yaw, pitch, dist] of views) {
    await ev(([x, z, yaw, pitch, dist, r]) => { const g = window.__g; const ox = g.where.ox, oz = g.where.oz; g.teleport(x + ox, z + oz); g.rig.yaw = yaw; g.rig.pitch = pitch; g.rig.dist = dist; g.player.hp = 999; }, [x, z, yaw, pitch, dist, region]);
    await sim(0.4);
    await ev(([yaw, pitch, dist]) => { const g = window.__g; g.rig.yaw = yaw; g.rig.pitch = pitch; g.rig.dist = dist; }, [yaw, pitch, dist]);
    await shot(`view${i++}`, 3500);
  }
};
