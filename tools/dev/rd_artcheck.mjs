for (const f of process.argv.slice(2)) {
  const m = await import(f);
  for (const [k, v] of Object.entries(m)) {
    if (!v || typeof v !== 'object') continue;
    for (const [name, art] of Object.entries(v)) {
      if (!art.frames) continue;
      const w = art.frames[0][0].length;
      art.frames.forEach((fr, i) => fr.forEach((r, j) => { if (r.length !== w) console.log('WIDTH', name, i, j, r.length, w); for (const ch of r) if (ch !== '.' && !art.pal[ch]) console.log('PAL', name, ch); }));
      if (art.frames.some((fr) => fr.length !== art.frames[0].length)) console.log('ROWS', name);
    }
  }
}
console.log('art ok');
