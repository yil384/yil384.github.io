// Every module import under assets/js resolves: relative paths exist on disk, bare specifiers are in the import map of index.html.
//   node tools/qa/check-imports.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });
const bare = s => { if (s in map) return map[s]; const k = Object.keys(map).filter(k => k.endsWith('/') && s.startsWith(k)).sort((a, b) => b.length - a.length)[0]; return k ? map[k] + s.slice(k.length) : null; };
let bad = 0, n = 0;
for (const f of walk(join(ROOT, 'assets/js'))) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/(?:^|[;\n}])\s*(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm)) {
    const spec = m[1] || m[2] || m[3]; n++;
    let target;
    if (spec.startsWith('.') || spec.startsWith('/')) target = resolve(dirname(f), spec);
    else { const b = bare(spec); if (!b) { console.log(`UNMAPPED  ${f.replace(ROOT + '/', '')}: ${spec}`); bad++; continue; } target = resolve(ROOT, b); }
    if (!existsSync(target)) { console.log(`MISSING   ${f.replace(ROOT + '/', '')}: ${spec}  ->  ${target.replace(ROOT + '/', '')}`); bad++; }
  }
}
console.log(`${n} imports checked, ${bad} problems`);
process.exit(bad ? 1 : 0);
