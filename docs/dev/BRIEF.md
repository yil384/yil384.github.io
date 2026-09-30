# BRIEF — make the homepage content itself interactive (round 3)

Repo: /home/user/yil384.github.io (branch claude/ecstatic-mayer-xlwq56). Scratchpad (tools, references):
S=/tmp/yl

## What the user (Yichen Lin, Ph.D. student, UC San Diego CSE) asked

Round 1 (verbatim): 现在这个个人主页是有用到three.js了，但是这个要点击才出现，然后整体页面还是之前的CV朴素风，我感觉还不如最开始的那个 (eac566e) 直接开屏就是身临其境的那种感觉了……想想办法把我们用three.js做出来的内容直接和我们正经的内容融合……我要把我的个人主页做成"学术圈最好玩、彩蛋最多"的个人主页。 Follow-up: 主要更多的还是要UCSD这里的元素。

→ Round 2 (already built, on this branch): a persistent three.js night-time UCSD island behind the page; scroll moves the camera between landmarks; W/A/S/D = play mode; 38 easter eggs; terminal on the backtick key.

Round 3, now (verbatim): 怎么看起来和之前没有变化啊？……我说整个页面做的没有交互感，就是干巴巴的 About / Publications / Experience ……这些，不如之前的版本 (eac566e) 交互感强了都，听不懂吗？

Translation / diagnosis: the CV sections are still dry academic lists in glass cards (same rows as the plain CV), only the backdrop changed. The original eac566e felt interactive because **the content itself was game UI**: the profile was an RPG character card, education a skill tree with an animated path, skills attribute bars that fill, publications "achievement" cards with "Achievement Unlocked", internships a quest log with expandable objectives and COMPLETE badges, projects equipment cards that flip, links spinning portals, an always-on HP / FOCUS / PROGRESS status bar (progress = scroll), zone names, coins/NPCs/critters living *inside* the sections, a pixel character you could move over the page, a skill bar. The user wants that level of interactivity back, **in the content**, done at a much higher quality, and fused with the 3D UCSD island (keep it). Goal: the most fun academic homepage with the most easter eggs — still a credible homepage for professors/recruiters.

(Also: the live site is still `main`; this branch is not deployed yet. Not your concern.)

## Lessons from the original (do NOT repeat)
- Its enemies attacked the reader while they were only reading → full-screen GAME OVER over the CV (see $S/ref/orig_3.png … orig_7.png). **The page game must never punish or block reading.** Page critters are harmless; you bonk them for XP/coins.
- It used borrowed IP (Pikachu, Mario, Kirby…). Everything must be original (our cast: the scholar = Yichen's avatar, Bit the blue companion, islanders Archivist Nell (owl, library), Unit-7 (robot, workshop), Mo (raccoon merchant), Tide (frog), Fern (sprout), Ash (cartographer), Chef Zhuo (cook; Zhuo Chen is Yichen's real roommate/labmate, "best cook in the building"), King Triton statue, Sun God statue, sea lions, seagulls, paragliders; bosses CUDA OOM Golem, Reviewer #2, Deadline Dragon; enemies Off-by-one Slime, NaN Slime, Seagull, Legacy Code, Null Pointer).
- Tutorial popups sat on top of the content. Don't cover the CV with chrome.

## Hard constraints
1. Vanilla HTML/CSS/ES modules, **no build step, no frameworks, no CDNs** (everything self-hosted under assets/). three.js r186 is vendored.
2. **Every CV fact stays in the HTML** (SEO, no-JS, print, screen readers) and is readable top-to-bottom in ~60 s without playing. Interactions add flavour or *extra* detail (flip backs, BibTeX, objectives), never gate core facts (names, venues, dates, roles, links). A "plain reading" escape (e.g. a Reviewer/Plain mode toggle) is welcome.
3. **No invented facts.** Allowed facts = current index.html + the original site's copy (its skill levels: Python High 90, C++ High 85, Go Strong 70, Rust Strong 75, TypeScript Working 65, JavaScript Working 60, Verilog Familiar 50; its project back-texts and quest summaries in $S/orig_nob64.html; phone (858) 319-7361). Jokes are fine when obviously jokes. Tech "rewards" for a quest must come from that quest's own description (e.g. Lark → Redis, RocketMQ).
4. Works on phones (tap), desktop (mouse + keys), keyboard-only (real buttons, focus, Enter/Space), `prefers-reduced-motion`, and without WebGL (`?world=0` → baked poster behind the page).
5. Light on the CPU: the GPU already renders the 3D world. No per-frame layout thrash; animate transform/opacity; IntersectionObserver for reveals.
6. Keep the director contract so the 3D coupling keeps working: sections keep `data-shot` / `data-side` / `data-zone`; items keep their `data-focus` keys: cse, gate, book-triton, book-reh2o, flag-picasso, flag-metabit, flag-tencent, flag-hotstar, flag-lark, mon-starry, mon-im, mon-oj, mon-triton, workbench, mailbox. `data-say="npc: line"` makes an islander speak (npc ids: me, bit, nell, unit7, mo, tide, fern, ash, zhuo).
7. Pixel fonts are now self-hosted: 'Press Start 2P', 'Silkscreen' (400/700), 'Pixelify Sans' (400/600), plus Inter, Instrument Serif, JetBrains Mono.

## What exists (read these)
- index.html — the page. assets/css/site.css — page styles (glass cards, top bar). assets/css/game.css — world labels, play HUD, dialogs.
- assets/js/page.js — boot. assets/js/site/{chrome,eggs,eggs-dom,notes,terminal}.js — top bar, egg registry (`found(id)`, `EGGS`, `has`, `onChange`), DOM eggs, Field Notes, terminal.
- assets/js/game3d/* — the world. index.js (runtime, tour/play), stage.js (landmarks, shots, `stage.liftoff()`, `hatTrick()`, `collapse()`, `sky.shower(s)`, `judge.judge(verdict)`, `mailbox.raise(v)`), director.js (page↔world; `say(who,text)`, `focus(key)`), bus.js (`on`, `emit`; events: 'shot' {key, el, zone}, 'progress' p∈[0,1], 'pick' {id, egg}, 'mode' 'play'|'tour', 'egg' id, 'levelup', 'reward'…), state.js (`S` save blob in localStorage), audio.js (`sfx(name)`: coin, levelup, achievement, open, purchase, error, hit, kill…), util.js (`h()` element builder, `icon()`), pixelart.js (`spriteImg(name, scale)` renders any sprite in three/art.js as a crisp <img>: scholar, bit, owl, robot, merchant, frog, sprout, cartographer, chef, triton, sungod, sealion, token, chest, slime, bat, skeleton, golem, mage, dragon, crystal, book, grass…).
- The world API at runtime: `window.__page.world` (null without WebGL): `enterPlay()`, `exitPlay()`, `say(who, text)`, `stage`, `director`, `fx`, `playing`.
- Current look: $S/final1.png (desktop), $S/mob2.png (phone). Original look: $S/ref/orig_0.png … orig_7.png, $S/ref/orig_sheet.png. Original source: $S/orig_nob64.html (base64 stripped). Original design spec: docs/superpowers/specs/2026-03-25-rpg-homepage-design.md.

## Tooling
- Local servers: http://localhost:8000/ = this working tree; http://localhost:8001/ = the original eac566e.
- Fast screenshots: `node $S/snap.mjs "<url>" <outPrefix> [w] [h] [targets]` — targets = comma list of selectors / pixel offsets / `top`; env `ACTIONS='[["click","#x"],["hover","#y"],["wait",500],["key","Enter"],["eval","js"]]'` runs before each shot. Use `?world=0` for fast DOM iteration (~12 s). With the world: `?force=1&dpr=1&intro=0&lowfx=1` (~60-90 s, software GPU). Then Read the PNGs to look at them.
- `node $S/montage.mjs out.png <cols> a.png b.png …` tiles screenshots into one image.
- Lint: `eslint -c $S/eslint.config.mjs <files>` (no-undef / unused).
- Only 4 CPUs: don't run more than one browser at a time; close it when done.
- Do not `git commit`; the orchestrator commits. Only edit files you own (your prompt says which).
