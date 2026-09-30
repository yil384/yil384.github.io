export default async ({ p, ev, sim, check }) => {
  const voice = async (text) => {
    await ev(() => { const g = window.__g; g.talk(g.npcs.find((n) => n.id === 'tm-mochi')); });
    await p.waitForTimeout(2500);
    await p.click('.talk__choice >> nth=0', { force: true });
    await p.waitForTimeout(500);
    await p.fill('.modal.is-open .typing__input', text);
    await p.keyboard.press('Enter');
    await p.waitForTimeout(300); await sim(0.3);
    return ev(() => [...document.querySelectorAll('.g__bubble, [class*=bubble]')].map((e) => e.textContent).filter(Boolean).slice(-3));
  };
  console.log('LOG blorp', JSON.stringify(await voice('blorp')));
  console.log('LOG zh', JSON.stringify(await voice('冲')));
  console.log('LOG heal', JSON.stringify(await voice('mochi heal me')));
  console.log('LOG who', JSON.stringify(await voice('who made you?')));
  await ev(() => { const g = window.__g; g.talk(g.npcs.find((n) => n.id === 'tm-pan')); }); await p.waitForTimeout(600); await ev(() => window.__g.closeAllModals());
  const eggs = await ev(() => Object.keys(window.__g.S.eggs).filter((k) => k.startsWith('timi')));
  console.log('LOG eggs', eggs.join(','));
  check('unknown + bilingual eggs', eggs.includes('timi-unknown') && eggs.includes('timi-bilingual'));
};
