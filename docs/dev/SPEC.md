# SPEC — "The Triton Chronicle": the CV is the game UI (round 3)

Contract: `BRIEF.md` (same folder). This file is the build spec. Where this spec and the brief disagree, the brief wins.
Spine = design "RPG, done right". Grafts: from "The page is a level" the CLEARED stamps, Bit living on the card edge, the page↔world bus contract, fixed hand-placed tokens, walk mode (stretch). From "Academic delight, credible" the build conventions (`data-game`, native `<details>` for extras, one IntersectionObserver), Reviewer mode details, BibTeX, the simulated Reviewer #2 panel, the skills console, the project special moves, the quest gantt, visitor level titles.

Cut on purpose (they hide facts, punish, clutter or are shallow): caffeine meter (drains = punishment), seagull stealing coins, AoE clock and dragon in the bar, the pause menu (Field Notes gets a Progress tab instead), islander hosts peeking from card edges, footnote collectibles inside sentences, Mo's shop, dice roll, zone banner floating over the page, the per-section "Track" beacons, the d20, the glossary pop-ups.

---------------------------------------------------------------------------------------------------

## 0. Ground rules (every package obeys these)

1. **Facts are static HTML** that stays exactly as the current page states them (names, venues, dates, roles, links). Every `data-shot / data-side / data-zone / data-focus / data-say` stays on the same kind of element (sections; `li` rows; `.toolbox`; the contact `p`). Keys: cse, gate, book-triton, book-reh2o, flag-picasso, flag-metabit, flag-tencent, flag-hotstar, flag-lark, mon-starry, mon-im, mon-oj, mon-triton, workbench, mailbox.
2. **Extra detail** (quest objectives + notes, pub summary + BibTeX) is static native `<details class="more">`. Project back texts are a static `div.equip__back` (stacked under the front without JS / in plain mode, a flip face in game mode).
3. **Game-only DOM carries `data-game`.** It may be written in index.html by FOUNDATION (preferred, so markup lives in one place) or created by JS. CSS: `html:not(.is-game) [data-game] { display: none !important; }`.
4. **Mode classes on `<html>`** (set by FOUNDATION `site/ui/mode.js`):
   - `js` (already), `is-game` = JS running AND not plain AND not printing. All game-look CSS is scoped under `html.is-game` so no-JS, Reviewer mode and print fall back to today's clean CV styles in site.css for free.
   - `is-plain` = Reviewer mode. `rm` = reduced motion (mirrors the media query, JS sets it so JS and CSS agree).
   - Existing: `is-play` (3D play mode), `world-live` / `no-world` on body.
5. Utilities: `.plain-only` (visible outside `.is-game`; inside `.is-game` it becomes `.sr` visually-hidden, so screen readers still read the plain label), `.game-only` (rendered only in `.is-game`, always `aria-hidden="true"`).
6. **Never over text.** Critters, Bit, stamps, bubbles, floats live in reserved slots: card top edge (the ribbon row), the gutter outside the card, the reserved right column of a row, or the trail gaps between sections. Nothing fixed-position overlays the card column except toasts (top-right under the bar, max 3) and the level-up ribbon (inside the status strip).
7. **Never punish.** No HP loss, no timers that fail you, nothing stolen, nothing gated. At most **one auto-triggered celebration per section per session** (achievement unlock, class change, quest stamps count as the section's one); everything else is user-initiated.
8. **Performance.** transform/opacity only; one shared IntersectionObserver (kit.observe); rects measured on events (shot, resize, expand), never per frame; ≤40 live DOM particles; ≤2 critters animating; CSS animations of off-screen sections paused via `.is-live` on the section (set by kit's IO); rAF only for tilt (while hovered) and typewriter; `document.hidden` pauses timers.
9. **Input parity.** Every game object is a real `<button type="button">` (or `<a>`), 44×44 min hit area on touch, visible focus ring (2px `--gold`, offset 3px), Enter/Space parity, hover eggs also fire on focus and on tap. Critters use `tabindex="-1"` and are reached with the **B** key so Tab through the CV stays clean.
10. **Reduced motion** (`html.rm`): no walking/crawling/spinning/drops/tilt; flips become 150ms crossfades; bars render filled; typewriters print instantly; stamps appear at final scale with a 120ms fade; confetti becomes a static float.
11. **Copy.** Only facts from index.html + `orig_nob64.html` (quoted below verbatim where used) + phone. Jokes are obviously jokes and never sit inside a fact line. Everything labelled "simulated" where it could be misread.
12. No build, no frameworks, no CDNs. ES modules. Lint with `eslint -c $S/eslint.config.mjs`.

---------------------------------------------------------------------------------------------------

## 1. Visual language

### 1.1 Tokens (`assets/css/ui/tokens.css`, FOUNDATION)
```css
:root {
  /* existing site.css tokens stay (--bg, --ink*, --line*, --accent #f2b84b amber, --accent-2, --navy, --glass*, fonts) */
  --ucsd-navy: #182B49;  --ucsd-navy-2: #22406e;  --ucsd-navy-3: #0f1d33;
  --gold: #FFCD00;       --gold-a45: rgba(255,205,0,.45); --gold-a18: rgba(255,205,0,.18);
  --amber: #f2b84b;      /* warm light of the island, used for glows and XP */
  --teal: #00C6D7;       /* interactive / focus */
  --hp: #4ADE80; --focus: #818CF8; --xp: #FFCD00; --danger: #F87171; --warn: #FBBF24;
  --r-common: #9aa4b8; --r-rare: #5FB3FF; --r-epic: #B58CFF; --r-legend: #FFCD00;
  --ink-glass: rgba(8,11,22,.80);
  --px: 'Silkscreen', var(--mono);            /* labels, 11px uppercase, +.12em */
  --px-title: 'Pixelify Sans', var(--sans);   /* game titles 16–20px */
  --px-num: 'Press Start 2P', var(--mono);    /* tiny numerals 8–10px only */
  --ease: cubic-bezier(.2,.9,.2,1);
  --t-ui: 240ms; --t-reveal: 600ms; --t-stamp: 220ms;
  --z-crit: 3; --z-bit: 4; --z-bubble: 6; --z-toast: 90;
}
```
Fonts: body stays Inter 15.5–17px/1.6, headings Instrument Serif. Pixel fonts are **chrome only** (labels, chips, buttons, HUD, stamps, ribbons); they never set a sentence of CV prose.

### 1.2 Panels and frames (`assets/css/ui/kit.css`, FOUNDATION)
- **Card (game look):** `html.is-game .card` keeps the glass, background becomes `linear-gradient(180deg, rgba(14,19,33,.86), var(--ink-glass))`, border `1px solid var(--gold-a18)`, plus 8px **L-shaped corner brackets** in `--gold-a45` via `::before`/`::after` (two corners each, drawn with 2 linear-gradients, pointer-events none). Radius 14px (was 20). backdrop-filter only on `.card` (never on small elements).
- **Ribbon header** `.card-head` = `.tag` + `.seal-slot`. In game mode `.tag` becomes an angled ribbon: background `linear-gradient(90deg, var(--ucsd-navy), var(--ucsd-navy-2))`, `clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)`, padding `4px 26px 4px 6px`, `font: 11px var(--px)`, `letter-spacing:.12em`, text `--ink`. `.tag__n` becomes a gold square chapter numeral (`font: 10px var(--px-num)`, `color: var(--ucsd-navy)`, `background: var(--gold)`). The `.card-head` row is 32px tall and is the **critter floor** (critters walk on its baseline, to the right of the ribbon) and holds `.seal-slot` (48×48, right-aligned) for the CLEARED seal.
- **Pixel frame** `.px-frame`: `box-shadow: 0 0 0 2px var(--ucsd-navy-3), 0 0 0 4px var(--gold), 0 0 0 6px var(--ucsd-navy-3)` + notched corners `clip-path` with 4px notches. Used on portrait, badges, medallions, portals.
- **Buttons** `.gbtn` (game button): height 30px (44px touch), padding 0 12px, `font: 11px var(--px)`, uppercase, `background: rgba(24,43,73,.85)`, `border: 1px solid var(--gold-a45)`, radius 4px, inset highlight; hover `translateY(-1px)` + border `--gold`; `:active` translateY(1px); `[aria-pressed=true]` teal border + teal text. Variants `.gbtn--gold` (gold bg, navy text), `.gbtn--ghost`, `.gbtn--sm` (24px).
- **Chips** `.chip`: 22px, `font: 10px var(--px)`, 1px border `--line-2`, radius 3px. `.chip--reward` gold dashed border.
- **Stamp** `.stamp`: inline-grid, `font: 700 12px var(--px)`, 2px double border, padding 2px 8px, `rotate(var(--rot,-8deg))`, `opacity:.9`, tones `--ok` (#4ADE80), `--gold`, `--ink` (grey), `--red` (#F87171), `--violet` (#B58CFF). Mix-blend `screen` on dark.
- **Bubble** `.bubble`: max-width 240px, `font: 13px/1.35 var(--px-title)`, `background: #f7f3e8`, `color: #141821`, 2px navy border, pixel tail (8px square rotated 45deg), optional 20px speaker avatar sprite on the left.
- **Meter** `.meter`: track 6px (HUD) / 10px (attributes), segmented with `mask: repeating-linear-gradient(90deg, #000 0 calc(10% - 2px), transparent 0 10%)`, fill is `<i>` with `transform: scaleX(var(--v))`.
- **Float** `.float`: `font: 10px var(--px-num)`, gold with 1px navy text-shadow, animates translateY(-28px) + opacity 1→0, 700ms.
- **Toasts:** reuse `#egg-toasts`; add `.egg-toast--ach` (trophy medallion, gold) and `.egg-toast--info`.
- Critter/sprite images: `image-rendering: pixelated` (`.px` from pixelart.js).

### 1.3 Motion rules
- One curve `var(--ease)`; UI 240ms; reveals 600ms; stamps 220ms `steps(3)` for scale + final 1-frame nudge; sprite frames `steps(2)`.
- Card reveal (existing `.is-in`): in game mode a 500ms **pixel-dissolve** (`mask-image` of a 4×4 bayer pattern stepped in 8 steps via a CSS custom property animation; fallback plain fade). Reduced motion: plain `.is-in` with no transition.
- Only transform/opacity/clip-path/mask on animated elements; `will-change` only while animating.
- Sound (§2.9) always optional, off by default.

---------------------------------------------------------------------------------------------------

## 2. Global systems

### 2.1 Modes (`site/ui/mode.js`, FOUNDATION)
- `plain` source of truth: `?plain=1` or `?mode=cv` forces on (not persisted); else `S.page.plain`. Toggle: bar button `#plain-btn`, key **R**, hero title-menu item, Field Notes Progress tab.
- `setPlain(on)`: toggles `html.is-plain`, recomputes `is-game`, opens every `details.more` (remembering which were closed, restores on exit), emits `page:plain` (bool), announces via kit.live: "Reviewer mode on: plain CV, game hidden." / "Play mode on." Label of `#plain-btn` reads "Reviewer mode" when off and "Play mode" when on (aria-pressed mirrors). First turn-on → `found('reviewermode')`. In plain: W still works but shows toast "Leave Reviewer mode to take the controls" (FOUNDATION wraps the WASD path in eggs-dom.js).
- World in plain: `world?.setPaused?.(true)` (WORLD adds it); fallback CSS `html.is-plain #world { opacity:.25; filter: grayscale(.6) }` and the poster shows. Cards become one centred column max-width 760px, solid `#0e1117` background, no backdrop-filter.
- `beforeprint` → add `is-plain` temporarily (+ open details), `afterprint` → restore. `@media print` rules in plain.css duplicate the essentials (no JS print).
- `rm` class: mirror `matchMedia('(prefers-reduced-motion: reduce)')` + a Field Notes setting "Reduce motion" (`S.page.rm`).

### 2.2 Page state (`site/ui/pstate.js`, FOUNDATION)
Extends the shared save without editing game3d/state.js:
```js
import { S, save } from '../../game3d/state.js';
const D = { v:1, xp:0, read:{}, cleared:{}, opened:{}, tokens:{}, bonks:{}, once:{}, equipped:[], quests:{}, plain:false, rm:false, firstVisit:0, lastVisit:0, lastSection:'', ngplus:0, focus:0, stats:{ bonks:0, opened:0, ms:0 } };
S.page = Object.assign(structuredClone(D), S.page || {});
export const P = S.page; export { save };
```
If localStorage throws, S is already in-memory: everything still works for the session. Save point copy says "Saved in this browser" only when `localStorage.setItem` succeeded (pstate exports `canPersist()`).

### 2.3 Progression (`site/ui/progress.js`, FOUNDATION)
One system: **page XP → visitor level**, plus **Triton Cash ◈** (= `S.player.gold`, shared with the 3D shop; harmless).
- Levels (about the *visitor*, never Yichen): XP thresholds `[0, 30, 80, 150, 250, 400, 600]` → Lv1 Prospective Student, Lv2 Admitted, Lv3 First-year, Lv4 Quals Passed, Lv5 Candidate (ABD), Lv6 Dissertating, Lv7 Dr. (Honorary). Page XP never touches `S.player.level` (3D balance stays).
- `award({ id, xp=0, cash=0, why='', from=null })`: idempotent when `id` given (stored in `P.once[id]`); floats `+N XP` / `+N ◈` from `from` (kit.float), updates HUD, emits `page:reward {xp, cash, why}`; level-up → HUD ribbon "LEVEL UP · Lv 4 · Quals Passed" (1.6s, inside the strip), sfx levelup, emit `page:levelup {level, title}`. Reaching Lv7 → `found('phd')` + emit `page:hat` + toast "Degree conferred (honorary, non-transferable, not accredited)".
- Sources (each once unless noted): chapter cleared +10; detail opened (`details.more`, flip, node inspect) +5 per item; quest turned in +10 ◈5; achievement unlocked +10; BibTeX copied +5; egg found +20 (progress listens to `onChange` of eggs); critter bonk +2 XP +1 ◈ (repeatable, ≤3 per critter kind per session); token +2 XP +10 ◈; OJ Accepted +20 ◈5; deep focus +25; finish page +20. Reading everything with no clicks ≈ Lv2–3; a curious reader Lv4–5 by Contact; everything ≈ Lv7.
- API: `award`, `level()`, `title()`, `xp()`, `cash()`, `nextAt()`, `onProgress(fn)`, `markOpened(id, from)`, `token(id, fromEl)` (P.tokens, flies coin to HUD cash, sfx coin, `emit('page:coin',{id})`; 12/12 → `found('tokens')`), `bonk(kind, fromEl)` (P.bonks, stats; 5 distinct kinds → `found('exterminator')`), `resetPage()` (New Game+: clears P except eggs/plain/rm/firstVisit; `P.ngplus++`).
- **Chapter read/clear**: kit's IO marks a section *read* when ≥50% of its `.card` is visible for 3s cumulative (dwell timer pauses on `document.hidden`). On read: `P.cleared[shot]=Date.now()`, award +10 "Read §N", the section's `.seal-slot` gets a CLEARED seal (kit.stamp, gold, 48px round double-ring "CLEARED" + date in 7px), HUD pip fills, `emit('page:clear',{shot})`. All six (about, edu, library, trail, workshop, meadow) → `found('cleared')`. Reviewer mode: no seal (still counted). A seal click → wobble + bubble "Cleared in 0:42" (time since first visit this session).

### 2.4 Status strip (HUD) (`site/ui/hud.js` + `assets/css/ui/hud.css`, FOUNDATION)
Lives **inside `header#bar`** as a second row (26px) so it never floats over a card; replaces `.bar__progress`. Markup in §3.0. Left→right:
1. **Lv chip** `button#phud-lv`: "Lv 3" in `--px-num` 9px gold on navy + title "First-year" in Silkscreen 10px; below it a 3px XP line. Click → Field Notes on the Progress tab. aria-label "Level 3, First-year, 34 of 70 XP. Open progress."
2. **HP** `button#phud-hp` (green, always 100/100). title "HP 100/100. Nothing on this page can hurt you." 5 clicks within 4s → `found('invincible')` + bubble "God mode was on the whole time."
3. **FOCUS** (indigo): +1/s while a card is ≥50% visible and the tab is visible; −1 per 4s only while hidden; at 100 → pulse + toast "Deep focus: the page is yours" + award deepfocus +25 (once/session). Save point refills it.
4. **PROGRESS** (gold, = bus `progress` p, or the scroll spy without world): `scaleX(p)`; 6 **chapter pips** (real `<button>`s, aria-label "Chapter 3 · Publications, cleared") at each section's start fraction (computed on resize from offsetTop / scrollHeight); hollow = unseen, half = current, gold = cleared; click → `section.scrollIntoView({behavior})`. Right of the bar a paper-status label (≥1280px only): Draft 0 · Submitted .2 · Under review .4 · Rebuttal .6 · Accepted .8 · Camera-ready 1.0 (title attr: "Joke status that follows your scroll. The real TritonGym paper is under review at ICML 2026.").
5. **Cash** `button#phud-cash` "◈ 42" (tabular nums). Click → Field Notes Progress tab. `hud.flash('NaN')` shows a temp string for 800–1500ms (NaN Slime gag).
6. The existing `#zone` chip stays in `.bar__tools`, eggs counter, sound, `#plain-btn` (new), play.
- Level-up ribbon slides out of the Lv chip inside the strip (translateX, 1.6s).
- Phone (<720px): strip collapses to a 4px progress line (no pips), Lv chip moves into `.bar__tools` before the eggs button ("Lv3"), HP/FOCUS/cash only in Field Notes Progress tab.
- Plain: strip hidden except a neutral 2px progress line.
- JS API: `hud.target(name)` → element for flyTo ('cash'|'xp'|'eggs'|'lv'); `hud.flash(text, ms)`; `hud.refillFocus()`; `hud.pulse(name)`.

### 2.5 Trail segments and zone cards (between sections) — owned by SECTIONS-A
Markup written by FOUNDATION (§3.2). A 140px (phone 88px) in-flow strip between consecutive sections. As it crosses 50% of the viewport (kit.observe, threshold .5, once/session each):
- **Zone title card** (Octopath chapter card, inside the strip, never over a card): gold hairline draws from centre (scaleX 0→1, 380ms) → zone name in Instrument Serif 36px (26px phone) → Silkscreen sub "CHAPTER 02 · EDUCATION" → holds, then settles at 45% opacity as a quiet label. sfx open (gain via `sfx('open')`). Reduced motion: 200ms fade.
- **Lantern** on a post lights (opacity/scale) with sfx buddy; all 6 lit → `found('lamplighter')` ("Six lanterns. The trail is lit.").
- **Signpost** text (joke distances) is a `<button>`: click → scroll to the next section (fast travel), tooltip shows its CLEARED state. 
- **Token** (`button.token`, 20px sprite `token` at scale 2, 44px hit area, steps(2) spin): click → `progress.token('t7'…'t12')`.
- Footprints (inline SVG, 6 prints) fade in one by one in walking direction (60ms each) when the strip enters.
- Emits `page:checkpoint {from, to}`.
- Hidden in plain, print, no-JS.
Strip copy (g = gap):
| id | from→to | zone card | sub | signpost | token |
|---|---|---|---|---|---|
| g1 | hero→about | Library Walk | CHAPTER 01 · ABOUT | → Library Walk · 120 m | t7 |
| g2 | about→education | Two campuses | CHAPTER 02 · EDUCATION | → Two gates · ≈10,000 km, mostly ocean | t8 |
| g3 | education→publications | Geisel Library | CHAPTER 03 · PUBLICATIONS | → Geisel Library · 80 m | t9 |
| g4 | publications→experience | The trail | CHAPTER 04 · EXPERIENCE | → The trail · downhill | t10 |
| g5 | experience→projects | Jacobs Yard | CHAPTER 05 · PROJECTS | → Jacobs Yard · 0.4 mi | t11 |
| g6 | projects→contact | Sun God Lawn | CHAPTER 06 · CONTACT | → Sun God Lawn · follow the grin | t12 |
g3's post also carries a tiny "house on a roof" icon button (aria-label "A tiny house on a roof"): toast "It has been there since before you arrived." + `world ? director.focus('cse') : found('fallen')`.

### 2.6 Bit, the page companion (`site/ui/bit.js`) — COMPANIONS
- `button.bit` (aria-label "Bit, your companion. Pet or ask for a hint.") with `spriteImg('bit',3)` 36px, `position:absolute` child of the **current card**, perched on the card's top edge at the right, left of the seal slot (`top:-30px; right:64px`). On bus `shot` (or the scroll spy's section change without world) it is re-parented to the new section's card with a FLIP hop (measure before/after once, 420ms two-keyframe arc on transform). Idle: blink every 3–6s (2-frame), 2px bob. When a `[data-focus]` row is hovered/focused it slides along the top edge to that row's x (clamped), 300ms.
- Click/Enter → **tip bubble** (3 per section, then "I am out of hints. Try the terminal: ` "). Tips point at eggs without spoiling (§4 per section). Every click also counts as a **pet**: heart float, sfx buddy, `emit('bit:pet')` (world egg counts 7 when live); without world, 7 pets → `found('pet')`.
- Double-click → Bit curls and bowls along the top edge, bonking the card's critter if present.
- Idle 60s (no pointer/scroll/key) → Bit dozes ("z" float); without world, the first doze → `found('sleep')`.
- **Speech fallback:** `kit.say(who, text)` → if world live, `world.say(who,text)` (3D bubble); else Bit shows the bubble with the speaker's sprite avatar (npc → sprite: me→scholar, bit→bit, nell→owl, unit7→robot, mo→merchant, tide→frog, fern→sprout, ash→cartographer, zhuo→chef). Without world, section `data-say` lines also go through this (once per section per session).
- Phone: Bit docks at the card's top-left, does not wander; bubbles open above the card (bottom:100%).
- Plain / print: hidden. Reduced motion: no bob/hop, teleports with 150ms fade.

### 2.7 Page critters (`site/ui/critters.js`) — COMPANIONS
Harmless bugs from our own cast. Each is `<button class="critter critter--{kind}" tabindex="-1" data-game aria-label="{Name} (harmless). Bonk it.">` with a 28px sprite; a 44×44 hit area. **One per section**, spawned when the section becomes current and it has dwelt 4s; it walks the **card-head row** (the ribbon row, which has no body text), from right of the ribbon to left of the seal slot: CSS keyframe `translateX(0 → var(--w))`, 14s, alternate, `--w` set once at spawn. It never moves toward the cursor, never attacks, poofs after 40s if ignored, respawns on the next visit (≥45s later). ≤2 animating on the page. Key **B** bonks the critter nearest the viewport centre (aria-live announces "Bonked the NaN Slime").
Bonk = squash (scaleY .6 → 1.2 → 0, 180ms) + sfx hit then kill + `progress.bonk(kind, el)` (+2 XP +1 ◈, 3 coin sprites arc into HUD cash) + gag + `emit('page:bonk',{kind, key: section focus key})`.
| section | kind (sprite) | gag | egg |
|---|---|---|---|
| about | Seagull (`spriteImg('seagull',2)`, a VARIANT in three/art.js) | every ~40s in view it lands at the right end of the Zhuo aside's padding with a pixel fry; bonk → fry drops back, bubble "Seagull: UCSD's true apex predator." | seagull |
| education | Off-by-one Slime (`slime`) | first bonk misses: it hops 1 step and shows "i <= n?"; second lands; then every chapter numeral renumbers 00–05 for 2s | offbyone |
| publications | NaN Slime (`slime-dark` variant, "?" eye overlay) | cash shows "NaN" 1.5s (hud.flash), float "NaN !== NaN" | nan |
| experience | Legacy Code (`skeleton` in a grey crate frame with a "// TODO" tag) | clicks 1–4 bubbles "It works. Do not touch." / "Nobody knows why it works." / "Deprecated since 2009. Still in production." / "Please."; click 5 crumbles, +5 ◈ | legacy |
| projects | Null Pointer (`bat`) | clicks 1–2 blink it 40px away + margin bubble "Segmentation fault (core dumped)"; click 3 catches it: "+3 ◈ · pointer dereferenced safely" | segfault |
All five kinds bonked at least once → `found('exterminator')` ("Five bugs fixed. Four new ones filed."). NG+: critters wear a 1-px party hat. Plain, print, `saveData`: not created. Reduced motion: they sit still and blink, still clickable. Hover ≥600ms → Bit field-guide bubble ("Off-by-one Slime: appears at every loop boundary. Mostly harmless.").

### 2.8 Keyboard (`site/ui/keys.js`, FOUNDATION)
Ignored while typing (`isEditable`), while the terminal/notes/modal is open, and while `world.playing` (play mode owns keys; only Esc passes). Existing keys stay (\` terminal, W/A/S/D take control, Konami).
- **R** Reviewer mode. **?** controls sheet (a small plate anchored under the status strip, right; Esc closes; first open → `found('manual')` "Nobody reads the manual. You did."). **J / K** next / previous `[data-focus]` (focus + `scrollIntoView({block:'center'})`; first use → `found('vimnav')` "You navigated a CV with j and k. Unit-7 is proud."). **[ / ]** previous / next chapter. **B** bonk nearest critter. **E** on a focused item = its primary action (dispatch `ui:primary` CustomEvent on the item; sections handle it: quest → toggle details, project → Inspect, pub → Summary). **C** on a focused pub → copy BibTeX. **P** walk mode (stretch, §2.11).
- Controls sheet lists: J/K items · [ ] chapters · E action · B bonk · R reviewer mode · W take control · ` terminal · ? this sheet · Esc close.

### 2.9 Sound palette (FOUNDATION adds to `game3d/audio.js` SFX; additive only)
Off by default (existing toggle). Page code calls `kit.sfx(name)`, throttled to ≤6/s per name and ≤1 per 80ms for hover blips.
New entries (built with the existing `seq`):
```js
stamp:  () => seq([[110,0,0.06],[70,0.03,0.14]], { type:'square', gain:0.13 }),
flip:   () => seq([[620,0,0.04],[930,0.035,0.05]], { type:'triangle', gain:0.05 }),
tick:   () => seq([[1500 + Math.random()*300, 0, 0.012]], { gain:0.025 }),
pop:    () => seq([[880,0,0.05]], { type:'triangle', gain:0.07, slide:1320 }),
warp:   () => seq([[220,0,0.35]], { type:'sine', gain:0.08, slide:1760 }),
ring:   () => seq([[1320,0,0.05],[1320,0.1,0.05],[1320,0.2,0.05]], { gain:0.05 }),
squeak: () => seq([[520,0,0.05],[780,0.04,0.07]], { gain:0.07 }),
```
Mapping: hover menu item → buddy; open/expand → open; flip → flip; stamp/seal → stamp; coin/token → coin; achievement → achievement; level → levelup; bonk → squeak then kill; equip → purchase; verdict WA → error, AC → victory; portal hover → warp (≤1 per 2s); typewriter → tick every 3rd char; save point → heal; lantern → buddy; phone → ring; credits → victory. First time sound is switched on, `kit.say('bit','Ooh, speakers.')`.

### 2.10 Field Notes: Progress tab (FOUNDATION edits `site/notes.js`)
Add two tabs in the notes panel head: **Eggs** (existing list) and **Progress**. Progress shows: Lv + title + XP bar; HP 100/100, FOCUS n/100; ◈ cash; chapters cleared (6 checkboxes with names, each a "Go" button); details opened n/15; quests turned in n/5; tokens n/12 with location hints ("one on every trail sign", "a pan", "a class change", "a citation", "a bird", "an Accepted"); critters bonked by kind; time on page; toggles: Reviewer mode, Reduce motion, Critters on/off (`P.critters=false`), Sound; buttons: New Game+ (inline confirm), Reset everything (existing resetSave, confirm). `openNotes({tab:'progress'})`. The eggs list groups by kind: Page / World / Game, and shows the hint for unfound page eggs.

### 2.11 Walk mode (STRETCH, COMPANIONS, build last, skippable)
The successor of the original's movable pixel character. Toggle **P**, the hero title-menu item "Walk the page", or Field Notes. The scholar sprite (40px, `position:absolute` in a full-page overlay layer, transform only) spawns on the h1 baseline. Platforms = top edges of `.hero__name`, each `.card`, each `[data-focus]` row, each `.trail`; rects in page coordinates measured on entry and on resize / ResizeObserver of `main` / details toggle. ←/→ 180px/s, Space/↑ jump (0.45s arc), ↓ drop. Window auto-scrolls to keep him between 30–70% of the viewport. Landing on a `[data-focus]` row = hover it (`stage.setHover(key)`, Bit comes over). Touching a token collects it; landing on a critter bonks it. Esc/P/focus into a text field exits. Entering while 3D play is active → `world.exitPlay()` first. Hero→footer under 60s → `found('speedrun')`. Phones: tap a row → the scholar arcs there (no d-pad). Reduced motion: instant hops. Hidden in plain. aria-live on entry: "Walk mode on. Arrow keys to walk, Space to jump, Down to drop, Esc to stop."

### 2.12 Page ↔ world bus contract
Page → world (all emitted with `emit()` from `game3d/bus.js`; WORLD's `game3d/pagelink.js` reacts; all must be safe no-ops without world):
| event | payload | world reaction (pagelink.js) |
|---|---|---|
| `page:open` | `{key, what}` | `stage.setHover(key)` for 1.5s + `fx.burst` gold at `stage.anchors[key]` |
| `page:clear` | `{shot}` | `fx.ring` at the shot's look/anchor + owner line via `director.say` (about/edu→ash, library→nell, trail→me, workshop→unit7, meadow→fern), e.g. nell "Both shelves read. Library card stamped." |
| `page:bonk` | `{kind, key}` | small `fx.burst` in the critter colour at `anchors[key]` |
| `page:coin` | `{id}` | `fx.ring` gold at the scholar's feet |
| `page:reward` | `{xp, cash, why}` | `fx.text('+N', …)` at the scholar (≤1/s) |
| `page:levelup` | `{level, title}` | `director.say('bit', \`Level ${level}! ${title}.\`)` (NOT the 3D 'levelup' event) |
| `page:hat` | – | `stage.hatTrick()` + `stage.sky.shower(8)` |
| `page:sky` | `{n}` | `stage.sky.shower(n)` |
| `page:stamp` | `{key}` | flag at `key`: `fx.ring` in org colour + burst |
| `page:equip` | `{key, on}` | monitor `key` hover-glow 2s + `director.say('unit7', 'Equipped. Please do not feed the gear.')` (≤1/8s) |
| `page:judge` | `{text, colour, ok}` | `stage.judge.judge(v)` |
| `page:mailbox` | `{up}` | `stage.mailbox.raise(up ? 1 : 0)` |
| `page:classchange` | – | `fx.ring` over `anchors.cse` + ash "Two gates, one path. Welcome to La Jolla." |
| `page:oom` | – | `fx.shake(0.3, 250)` + unit7 "The cold aisle is getting crowded…" |
| `page:portal` | `{name}` | `fx.ring` at `anchors.sungod` |
| `page:save` | – | `fx.ring` green at the scholar + scholar says "Saved. Also hydrated." |
| `page:checkpoint` | `{from, to}` | nothing required (optional ring) |
| `page:plain` | `bool` | `world.setPaused(bool)` |
| `page:start` | – | scholar `fx.ring` at feet + `director.say('me','Off we go!')` |
| `page:credits` | – | launch paragliders toward the camera if the glider group supports it, else `sky.shower(4)` |
| `bit:pet` | – | existing world pet counter (eggs3d) + 3D Bit hop |
World → page (page listens): `shot` {key, el, zone, index}, `progress` p, `pick` {id} (page: if a `[data-focus=id]` exists, Bit hops to it; quest flag pick → that quest gets its COMPLETE stamp immediately; monitor pick → that project flips to its back), `mode` (hide page game layers while 'play'), `egg` (progress XP).
Without WebGL: the page systems all work; every emit is harmless; `kit.echo()` flashes `.world__poster` (400ms brightness 1.25) for `page:open/clear/stamp` so the click still "lands" somewhere.

### 2.13 Save state summary
Shared blob `yl.save.v2`: `S.eggs` (eggs), `S.player.gold` (◈), `S.page` (everything else, §2.2). New Game+ resets `S.page` progress but keeps eggs and ◈ gold (gold is shared with the 3D game; resetting it would punish). Continue: `P.lastSection` updated on section change; `P.lastVisit`.

---------------------------------------------------------------------------------------------------

## 3. index.html (FOUNDATION writes all of this; section packages do not edit index.html unless their brief says so, and then only inside their `<!-- region:name -->` … `<!-- /region:name -->` comments)

### 3.0 Head and bar
- Add stylesheets after game.css, in this order: `assets/css/ui/tokens.css, kit.css, hud.css, plain.css, hero.css, about.css, edu.css, pubs.css, quests.css, equip.css, attrs.css, contact.css, credits.css, trail.css, companions.css`. FOUNDATION creates every file (section ones as a one-line header comment stub).
- Early inline script: also read `?plain=1|?mode=cv` and a saved plain flag (try/catch parse of `localStorage['yl.save.v2']` → `.page.plain`) and set `is-plain` before first paint; set `is-game` when not plain.
- Bar tools: insert before `#sound-btn`:
```html
<button type="button" class="bar__btn bar__plain" id="plain-btn" aria-pressed="false" title="Reviewer mode: a plain one-column CV (R)"><img src="assets/icons/ui/book-open.svg" alt="" width="16" height="16"><span class="bar__plain-l">Reviewer mode</span></button>
```
- Replace `<div class="bar__progress">…` with:
```html
<div class="phud" id="phud">
  <button type="button" class="phud__lv" id="phud-lv" data-game><span class="phud__lvn">Lv 1</span><span class="phud__title">Prospective Student</span><span class="phud__xp"><i></i></span></button>
  <button type="button" class="phud__m phud__m--hp" id="phud-hp" data-game title="HP 100/100. Nothing on this page can hurt you."><span class="phud__k">HP</span><span class="phud__track"><i style="--v:1"></i></span></button>
  <span class="phud__m phud__m--focus" id="phud-focus" data-game title="Focus fills while you read."><span class="phud__k">Focus</span><span class="phud__track"><i></i></span></span>
  <div class="phud__m phud__m--prog"><span class="phud__k" data-game>Progress</span><span class="phud__track bar__progress" aria-hidden="true"><i id="progress"></i></span><span class="phud__pips" id="phud-pips" data-game></span><span class="phud__status" id="phud-status" data-game>Draft</span></div>
  <button type="button" class="phud__cash" id="phud-cash" data-game aria-label="Triton Cash">◈ <span id="phud-cash-n">0</span></button>
  <span class="phud__ribbon" id="phud-ribbon" aria-hidden="true" data-game></span>
</div>
<div class="phud__keys" id="keys-sheet" role="dialog" aria-label="Keyboard controls" hidden data-game></div>
```
(`#progress` keeps its id so chrome.js' progress code still works; in no-JS/plain the strip shows only the thin progress line.)

### 3.1 Sections (full markup)
Notation: attributes shown are required; `…` means "same as current index.html". Every section's first card child becomes:
```html
<div class="card-head"><p class="tag"><span class="tag__n">NN</span><span class="tag__t">{current tag text}</span><span class="tag__k game-only" aria-hidden="true">· {game word}</span></p><span class="seal-slot" data-game data-seal="{shot}" aria-hidden="true"></span></div>
```
game words: 01 Party, 02 Class path, 03 Achievements, 04 Quest log, 05 Equipment, 06 Portals.

#### HERO `<!-- region:hero -->`
```html
<section class="scene scene--hero" id="top" data-shot="hero" data-side="left" data-zone="Geisel Plaza" data-say="me: Hi! Scroll and I will walk you around campus.">
  <div class="hero">
    <p class="eyebrow"><span class="pip" aria-hidden="true"></span>Ph.D. student · UC San Diego · CSE</p>
    <h1 class="hero__name" id="name"><span class="hero__name-t">Yichen Lin</span><span class="hero__blocks" aria-hidden="true" data-game></span></h1>
    <p class="hero__class game-only" aria-hidden="true"><span class="hero__class-k">Class · Scholar</span> Systems · Compilers · GPU codegen · LLM agents</p>
    <p class="hero__role">… (unchanged, with the Prof. Yufei Ding link)</p>
    <ul class="hero__links" aria-label="Contact and profiles">   <!-- 4 li > a unchanged; add inside each a: -->
      <!-- <span class="slot-key" data-game aria-hidden="true">1</span> … 2 3 4 -->
    </ul>
    <nav class="title-menu" data-game aria-label="Title menu">
      <ul>
        <li><a class="title-menu__i" href="#about" data-act="start">Begin the tour</a></li>
        <li><button type="button" class="title-menu__i" data-act="continue" hidden>Continue · <span data-slot="continue"></span></button></li>
        <li><button type="button" class="title-menu__i" data-act="play" hidden>Take control <kbd>W</kbd></button></li>
        <li><button type="button" class="title-menu__i" data-act="plain">Read plainly · Reviewer mode <kbd>R</kbd></button></li>
        <li><button type="button" class="title-menu__i" data-act="walk" hidden>Walk the page <kbd>P</kbd></button></li>
      </ul>
      <span class="title-menu__cursor" aria-hidden="true"></span>
    </nav>
    <p class="hero__hint" id="hero-hint">… unchanged …</p>
    <pre class="hero__boot" id="boot-status" aria-live="polite">waking up the island…</pre>
  </div>
  <a class="scroll-cue" href="#about" aria-label="Scroll to About"><span></span><b class="press-start" data-game aria-hidden="true">Press start</b></a>
</section>
<div class="trail" data-game data-trail="g1" data-from="hero" data-to="about"> … §3.2 … </div>
```
`chrome.status(msg)` (FOUNDATION) appends lines to `#boot-status` instead of replacing them (keep last 3).

#### ABOUT `<!-- region:about -->`  (card gets `card--about card--wide`)
```html
<section class="scene" id="about" data-shot="about" data-side="right" data-zone="Library Walk" data-say="ash: New here? I map the island. Follow the scholar.">
  <div class="card card--about card--wide">
    {card-head 01 "Library Walk" · Party}
    <div class="sheet">
      <div class="sheet__main">
        <h2>About</h2>
        <div class="prose">  <!-- the four paragraphs, verbatim, including p.aside with the Zhuo Chen link --> </div>
        <ul class="affinities" data-game aria-label="Research interests: highlight related items">
          <li><button type="button" class="chip affinity" data-affinity="systems" aria-pressed="false">Systems</button></li>
          <li><button type="button" class="chip affinity" data-affinity="compilers" aria-pressed="false">Compilers</button></li>
          <li><button type="button" class="chip affinity" data-affinity="gpu" aria-pressed="false">GPU code generation</button></li>
          <li><button type="button" class="chip affinity" data-affinity="agents" aria-pressed="false">LLM agent tooling</button></li>
        </ul>
        <p class="affinities__out" data-game aria-live="polite"></p>
        <div class="party" data-game>
          <span class="party__sprite" data-sprite="chef" aria-hidden="true"></span>
          <p class="party__name">Zhuo Chen <span class="party__role">Roommate &amp; labmate · Tsinghua Yao Class · best cook in the building</span></p>
          <button type="button" class="gbtn gbtn--sm" data-act="pan">Flip the pan</button>
          <button type="button" class="gbtn gbtn--sm" data-act="invite">Invite to party</button>
          <button type="button" class="token" data-token="t2" hidden aria-label="Triton token"></button>
        </div>
      </div>
      <aside class="sheet__side">
        <button type="button" class="portrait" id="portrait" aria-label="Photo of Yichen Lin"><img src="assets/img/portrait.webp" alt="Yichen Lin" width="140" height="140" loading="lazy"><canvas class="portrait__px" data-game aria-hidden="true"></canvas></button>
        <p class="sheet__plate game-only" aria-hidden="true"><b>Yichen Lin</b><span>Scholar · party leader</span></p>
        <dl class="sheet__stats">
          <div><dt><span class="plain-only">Role</span><span class="game-only" aria-hidden="true">Class</span></dt><dd>Ph.D. student, CSE</dd></div>
          <div><dt><span class="plain-only">University</span><span class="game-only" aria-hidden="true">Guild</span></dt><dd>UC San Diego</dd></div>
          <div><dt><span class="plain-only">Advisor</span><span class="game-only" aria-hidden="true">Mentor</span></dt><dd><a href="https://cseweb.ucsd.edu/~yufeiding/" target="_blank" rel="noopener">Prof. Yufei Ding</a></dd></div>
          <div><dt><span class="plain-only">Undergrad</span><span class="game-only" aria-hidden="true">Origin</span></dt><dd>Tsinghua University, CS&amp;T</dd></div>
          <div><dt><span class="plain-only">Email</span><span class="game-only" aria-hidden="true">Pigeon</span></dt><dd><a href="mailto:yil384@ucsd.edu">yil384@ucsd.edu</a></dd></div>
          <div><dt>Phone</dt><dd><a href="tel:+18583197361">(858) 319-7361</a></dd></div>
        </dl>
      </aside>
    </div>
  </div>
</section>
```
Tags for affinity matching, added as `data-tags` on existing elements: pub TritonGym `compilers gpu agents`; project Starry-Next `systems`; CST-OJ `systems`; TritonGym project `compilers gpu agents`; quest Picasso `systems`; quest Lark `agents`.

#### EDUCATION `<!-- region:edu -->`  (card `card--wide`)
```html
<section class="scene" id="education" data-shot="edu" data-side="left" data-zone="Geisel Plaza" data-say="ash: Two gates, one path. Tsinghua on the left, UCSD on the right.">
  <div class="card card--wide">
    {card-head 02 "Two campuses" · Class path}
    <h2>Education</h2>
    <div class="path">
      <ul class="rows path__nodes">
        <li class="row path__node path__node--ucsd" data-focus="cse" tabindex="0" data-say="ash: The CSE building. Picasso Lab lives here. Yes, that is a house on the roof.">
          <span class="path__badge" data-game aria-hidden="true"></span>
          <div class="row__logo row__logo--mono">…ucsd-white.svg…</div>
          <div class="row__main">
            <p class="row__title">UC San Diego <span class="row__role">Ph.D., Computer Science and Engineering</span></p>
            <p class="row__desc">Advisor: Prof. Yufei Ding</p>
          </div>
          <p class="row__when">2025 – present</p>
          <p class="path__state game-only" aria-hidden="true">Current class</p>
          <button type="button" class="gbtn gbtn--sm path__inspect" data-game aria-expanded="false" aria-controls="edu-ucsd-back">Inspect</button>
          <div class="path__back" id="edu-ucsd-back" data-game hidden>
            <p><i>Fiat lux</i>, "let there be light": the University of California motto.</p>
            <p>Home base: the CSE building and Picasso Lab. Yes, there is a house on the roof.</p>
            <button type="button" class="gbtn gbtn--sm" data-act="visit" data-key="cse">Show me on the island</button>
          </div>
        </li>
        <li class="row path__node path__node--thu" data-focus="gate" tabindex="0" data-say="me: The Second Gate. Where the undergrad years started.">
          <span class="path__badge" data-game aria-hidden="true"></span>
          <div class="row__logo row__logo--mono">…tsinghua-white.png…</div>
          <div class="row__main"><p class="row__title">Tsinghua University <span class="row__role">B.S., Computer Science and Technology</span></p></div>
          <p class="row__when">2021 – 2025</p>
          <p class="path__state game-only" aria-hidden="true">Mastered ✓</p>
          <button type="button" class="gbtn gbtn--sm path__inspect" data-game aria-expanded="false" aria-controls="edu-thu-back">Inspect</button>
          <div class="path__back" id="edu-thu-back" data-game hidden>
            <p lang="zh">自强不息，厚德载物</p><p>"Self-discipline and social commitment": the Tsinghua motto.</p>
            <button type="button" class="gbtn gbtn--sm" data-act="visit" data-key="gate">Show me the Second Gate</button>
          </div>
        </li>
      </ul>
      <div class="path__track" data-game>
        <svg class="path__svg" viewBox="0 0 160 40" aria-hidden="true"><path class="path__line" d="M4 20 C 50 0, 110 40, 156 20"/></svg>
        <span class="path__walker" aria-hidden="true"></span>
        <button type="button" class="path__waypoint" aria-label="Waypoint between the two degrees">?</button>
        <p class="path__banner" aria-hidden="true">Class change · Undergraduate → Ph.D. scholar</p>
        <button type="button" class="token" data-token="t3" hidden aria-label="Triton token"></button>
      </div>
      <button type="button" class="path__locked" data-game aria-label="A locked future node (a joke)"><span aria-hidden="true">???</span><small>Next class: locked</small></button>
    </div>
  </div>
</section>
```
DOM order stays newest first (UCSD, Tsinghua); CSS `order` shows Tsinghua left → UCSD right on ≥900px.

#### PUBLICATIONS `<!-- region:pubs -->`
```html
<section class="scene" id="publications" data-shot="library" data-side="right" data-zone="Geisel Library" data-say="nell: Two shelves so far. The newer one is still under review.">
  <div class="card card--wide">
    {card-head 03 "The library" · Achievements}
    <h2>Publications</h2>
    <ol class="pubs">
      <li class="pub ach ach--review" id="pub-tritongym" data-focus="book-triton" tabindex="0" data-tags="compilers gpu agents" data-say="nell: TritonGym. Agents writing GPU kernels, graded honestly.">
        <div class="ach__medal" data-game aria-hidden="true"><span class="ach__icon"></span><span class="ach__ribbon">In review</span></div>
        <p class="pub__year">2026</p>
        <div class="ach__body">
          <p class="pub__title">TritonGym: A Benchmark for Agentic LLM Workflows in Triton GPU Code Generation</p>
          <p class="pub__authors">Yue Guan<span class="ast">*</span>, <b>Yichen Lin</b><span class="ast">*</span>, et al. <span class="pub__note">* equal contribution</span></p>
          <p class="pub__meta"><span class="pub__status">Under review</span> ICML 2026 <span class="chip pub__topic">Agentic LLMs</span></p>
          <div class="pub__more">
            <details class="more"><summary>Summary</summary><p>Benchmarks tool-augmented LLM workflows on Triton GPU code generation and frames the project around measurable systems behavior rather than demo-only prompting wins.</p></details>
            <details class="more more--code"><summary>BibTeX</summary><pre><code id="bib-tritongym">@misc{guan2026tritongym,
  title  = {TritonGym: A Benchmark for Agentic LLM Workflows in Triton GPU Code Generation},
  author = {Guan, Yue and Lin, Yichen and others},
  note   = {Under review at ICML 2026},
  year   = {2026}
}</code></pre><button type="button" class="gbtn gbtn--sm" data-game data-copy="bib-tritongym">Copy BibTeX</button></details>
          </div>
          <div class="ach__actions" data-game>
            <button type="button" class="gbtn gbtn--sm" data-act="visit" data-key="book-triton">Visit the shelf</button>
            <button type="button" class="gbtn gbtn--sm" data-act="review" aria-expanded="false" aria-controls="r2">Request review</button>
            <span class="stamp-slot" data-stamp="cite"></span>
          </div>
          <section class="r2" id="r2" data-game hidden aria-label="Simulated peer review, a joke">…built by JS…</section>
        </div>
      </li>
      <li class="pub ach ach--gold" id="pub-reh2o" data-focus="book-reh2o" tabindex="0" data-say="nell: Scenario generation for autonomous driving. A classic from the older shelf.">
        <div class="ach__medal" data-game aria-hidden="true"><span class="ach__icon"></span><span class="ach__ribbon">Unlocked 2023</span></div>
        <p class="pub__year">2023</p>
        <div class="ach__body">
          <p class="pub__title">(Re)<span class="sq">²</span>H<span class="sub2">₂</span>O: Autonomous Driving Scenario Generation via Reversely Regularized Hybrid Offline-and-Online Reinforcement Learning</p>
          <p class="pub__authors">Haoyi Niu*, Kun Ren*, <b>Yichen Lin</b>, et al.</p>
          <p class="pub__meta">IEEE Intelligent Vehicles Symposium (IV), 2023 <span class="chip pub__topic">Autonomous Driving</span></p>
          <div class="pub__more">
            <details class="more"><summary>Summary</summary><p>Explores scenario generation for autonomous driving with a hybrid offline-and-online reinforcement learning setup, focusing on robustness and controllable scenario construction.</p></details>
            <details class="more more--code"><summary>BibTeX</summary><pre><code id="bib-reh2o">@inproceedings{niu2023re2h2o,
  title     = {(Re)$^2$H$_2$O: Autonomous Driving Scenario Generation via Reversely Regularized Hybrid Offline-and-Online Reinforcement Learning},
  author    = {Niu, Haoyi and Ren, Kun and Lin, Yichen and others},
  booktitle = {IEEE Intelligent Vehicles Symposium (IV)},
  year      = {2023}
}</code></pre><button type="button" class="gbtn gbtn--sm" data-game data-copy="bib-reh2o">Copy BibTeX</button><button type="button" class="token" data-token="t4" hidden aria-label="Triton token"></button></details>
          </div>
          <div class="ach__actions" data-game><button type="button" class="gbtn gbtn--sm" data-act="visit" data-key="book-reh2o">Visit the shelf</button><span class="stamp-slot" data-stamp="cite"></span></div>
        </div>
      </li>
    </ol>
  </div>
</section>
```
(The `*` on TritonGym authors is in `.ast` spans; text reads identically.)

#### EXPERIENCE `<!-- region:quests -->`  (card `card--wide`)
```html
<section class="scene" id="experience" data-shot="trail" data-side="left" data-zone="The trail" data-say="me: Keep scrolling: every flag is a job, and we walk back in time.">
  <div class="card card--wide">
    {card-head 04 "The trail · newest first" · Quest log}
    <h2>Experience</h2>
    <div class="qmap" data-game aria-hidden="true"></div>   <!-- gantt, built by JS from data-start/data-end -->
    <ul class="rows quests">
      <!-- one li per quest; template: -->
      <li class="row quest" data-focus="flag-picasso" tabindex="0" data-start="2024-03" data-end="2025-02" data-kind="research" data-tags="systems" style="--org:#FFCD00">
        <div class="row__logo row__logo--mono">…(unchanged)…</div>
        <div class="row__main">
          <p class="quest__k game-only" aria-hidden="true">Research quest</p>
          <p class="row__title">Picasso Lab, UC San Diego CSE <span class="row__role">Research intern</span></p>
          <p class="row__desc">Built a CXL system simulator for large-model communication; set up lab websites and a RAG pipeline for reading papers.</p>
          <details class="more quest__more">
            <summary>Objectives <span class="quest__n">(2)</span></summary>
            <p class="quest__notes">Worked on systems support for large-model infrastructure and research tooling in an academic lab setting.</p>
            <ul class="quest__objs"><li>Developed a CXL system simulator for large model communication.</li><li>Helped set up lab websites and use RAG to parse academic papers.</li></ul>
            <p class="quest__rewards"><span class="plain-only">Keywords:</span><span class="game-only" aria-hidden="true">Rewards</span> <span class="chip chip--reward">CXL simulator</span> <span class="chip chip--reward">RAG</span> <span class="chip chip--reward">Lab websites</span></p>
            <button type="button" class="gbtn gbtn--gold quest__turnin" data-game>Turn in quest</button>
          </details>
        </div>
        <p class="row__when">Mar 2024 – Feb 2025</p>
        <span class="stamp-slot quest__stamp" data-game aria-hidden="true"></span>
      </li>
    </ul>
  </div>
</section>
```
The five quests (org colour · kind · notes · objectives · rewards · extras):
| focus | start/end | --org | kind | quest notes (orig, verbatim) | objectives (orig, verbatim) | rewards | extra game DOM |
|---|---|---|---|---|---|---|---|
| flag-picasso | 2024-03/2025-02 | #FFCD00 | Research quest | Worked on systems support for large-model infrastructure and research tooling in an academic lab setting. | Developed a CXL system simulator for large model communication. / Helped set up lab websites and use RAG to parse academic papers. | CXL simulator · RAG · Lab websites | – |
| flag-metabit | 2024-09/2024-11 | #00C6D7 | Industry quest | Focused on backend-facing performance and streaming improvements for an internal AI platform. | Optimized data parsing and added streaming read support for AI Platform. | Data parsing · Streaming reads | – |
| flag-tencent | 2024-06/2024-07 | #5FB3FF | Industry quest | Built gameplay-adjacent client features and explored voice-driven teammate interaction in a production game environment. | Developed Monster Hunter mobile game client with voice-controlled teammates. | Monster Hunter mobile · Voice-controlled teammates | `<button class="quest__mic gbtn gbtn--sm" data-game aria-label="Talk to your voice-controlled teammate (a joke)">🎙 Talk</button>` after the rewards → use a pixel mic icon, not emoji |
| flag-hotstar | 2024-03/2024-06 | #B58CFF | Industry quest | Worked on ranking and search quality, with emphasis on recommendation and serving efficiency. | Optimized search page, fine-tuned recommendation model for TPUs. | Search page · Recommendation model · TPUs | – |
| flag-lark | 2023-06/2023-11 | #4ADE80 | Industry quest | Implemented backend support for AskAI workflows using message queues and caching systems in a sales-analysis context. | Developed AskAI assistant using Redis and RocketMQ for sales data analysis. | AskAI · Redis · RocketMQ | `data-tags="agents"`; `<button class="quest__logo-hit" data-game aria-label="The Lark logo"></button>` overlaying `.row__logo`; `<button class="token" data-token="t5" hidden aria-label="Triton token">` |
Rows, titles, roles, descs, dates, logos: exactly as the current index.html.

#### PROJECTS + SKILLS `<!-- region:equip -->`  (card `card--wide card--xl`)
```html
<section class="scene" id="projects" data-shot="workshop" data-side="right" data-zone="Jacobs Yard" data-say="unit7: Workshop online. Four projects on display. Please do not feed the gear.">
  <div class="card card--wide card--xl">
    {card-head 05 "The workshop" · Equipment}
    <h2>Projects</h2>
    <ul class="rows equip">
      <!-- template -->
      <li class="row row--project equip__item" data-focus="mon-starry" tabindex="0" data-rarity="epic" data-tags="systems">
        <div class="equip__card">
          <div class="equip__front">
            <p class="equip__rarity game-only" aria-hidden="true">Epic · Weapon</p>
            <span class="equip__icon" data-game aria-hidden="true" data-icon="sword"></span>
            <div class="row__main">
              <p class="row__title"><a href="https://github.com/yil384/Starry-Next" target="_blank" rel="noopener">Starry-Next<img src="assets/icons/ui/arrow-up-right.svg" alt="" width="14" height="14"></a></p>
              <p class="equip__sub">Operating systems · networking · graduation project</p>
              <p class="row__desc">Networking stack for a monolithic-kernel operating system. Graduation project.</p>
            </div>
            <p class="row__tags">…unchanged icons…</p>
            <div class="equip__actions" data-game>
              <button type="button" class="gbtn gbtn--sm" data-act="inspect" aria-expanded="false" aria-controls="back-starry">Inspect</button>
              <button type="button" class="gbtn gbtn--sm" data-act="equip" aria-pressed="false">Equip</button>
              <button type="button" class="gbtn gbtn--sm gbtn--gold" data-act="move">Boot</button>
            </div>
            <pre class="equip__term" data-game hidden aria-live="polite"></pre>
          </div>
          <div class="equip__back" id="back-starry">
            <p class="equip__k"><span class="plain-only">Details</span><span class="game-only" aria-hidden="true">Focus</span></p>
            <p>Implemented the networking component for a monolithic kernel OS and treated the project as a systems-oriented graduation deliverable.</p>
            <p class="equip__type">Systems project</p>
            <button type="button" class="gbtn gbtn--sm" data-game data-act="back">Back</button>
          </div>
        </div>
      </li>
    </ul>
    <div class="loadout" data-game aria-label="Equipped items"><span class="loadout__k">Equipped</span><span class="loadout__slot" data-slot="mon-starry"></span><span class="loadout__slot" data-slot="mon-im"></span><span class="loadout__slot" data-slot="mon-oj"></span><span class="loadout__slot" data-slot="mon-triton"></span></div>
    <div class="toolbox attrs" data-focus="workbench" tabindex="0" data-say="unit7: The workbench. Everything on it was compiled at least once.">  … §SKILLS below … </div>
  </div>
</section>
```
The four items:
| focus | rarity (CSS var) · slot | icon | title/link | sub (orig) | desc (current) | back text (orig, verbatim) | type | move |
|---|---|---|---|---|---|---|---|---|
| mon-starry | epic · Weapon | sword | Starry-Next → github.com/yil384/Starry-Next | Operating systems · networking · graduation project | current | Implemented the networking component for a monolithic kernel OS and treated the project as a systems-oriented graduation deliverable. | Systems project | Boot |
| mon-im | rare · Shield | shield | IM System → github.com/yil384/Instant-messaging-system-frontend | Django · WebSocket · full-stack messaging | current | Built a real-time chat system around Django and WebSocket flows, with emphasis on reliable message delivery and practical web integration. | Full-stack project | Ping |
| mon-oj | rare · Tome | gavel | CST-OJ → github.com/yil384/CST-OJ-Rust | Rust · evaluation platform · teaching infrastructure | current | Built a grading and evaluation workflow for coursework submissions, using Rust to keep the platform lightweight and systems-oriented. | Systems tooling | Submit (+ `<button class="token" data-token="t6" hidden>`) |
| mon-triton | legendary · Relic | trident | TritonGym (no link; `<span class="equip__paper">Paper-linked</span>`) | LLM agents · Triton codegen · benchmarking | current (incl. the mascot sentence) | Frames GPU code generation as a measurable agentic workflow problem, with benchmarks meant to surface systems behavior rather than prompt-only demos. | Research project | Run |
`data-tags`: mon-starry `systems`, mon-oj `systems`, mon-triton `compilers gpu agents`. Item icons are CSS/SVG pixel art drawn by EQUIP (original art).

**SKILLS markup (inside .toolbox):**
```html
<p class="toolbox__label">On the workbench <span class="game-only" aria-hidden="true">· Attributes</span></p>
<ul class="tools attrs__list" aria-label="Languages">
  <li class="attr" data-lang="python" data-projects="mon-triton" style="--v:.9"><img src="assets/icons/brand/python.svg" alt="" width="18" height="18"><span class="attr__name">Python</span><span class="attr__bar" data-game role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="90" aria-valuetext="High" aria-label="Python level"><i></i></span><span class="attr__tier">High</span><button type="button" class="attr__hit" data-game aria-label="Python, High. Run hello world."></button></li>
  <!-- C++ .85 High (data-projects=""), Rust .75 Strong (mon-starry mon-oj), Go .70 Strong (""), TypeScript .65 Working (mon-im), JavaScript .60 Working (""), Verilog .50 Familiar ("", icon ui/cpu.svg) -->
</ul>
<ul class="tools inv" aria-label="Tools">
  <li class="inv__slot" data-tool="linux"><img …linux…>Linux<button type="button" class="inv__hit" data-game aria-label="Use Linux"></button></li>
  <!-- vim, latex, websocket, django, mongodb -->
</ul>
<pre class="attrs__console" data-game aria-live="polite"><code>$ _</code></pre>
```
The tier words are visible in every mode (plain shows "Python · High" chips). Values only as meter/tooltip.

#### CONTACT `<!-- region:contact -->`
```html
<section class="scene scene--last" id="contact" data-shot="meadow" data-side="left" data-zone="Sun God Lawn" data-say="fern: Come sit on the lawn. The mailbox is real; the sea lions are not fussy.">
  <div class="card">
    {card-head 06 "Sun God Lawn · by the pier" · Portals}
    <h2>Contact</h2>
    <div class="prose">
      <p class="mailline" data-focus="mailbox" tabindex="0"><button type="button" class="mailbox" data-game aria-pressed="false" aria-label="Mailbox flag"><span class="mailbox__flag"></span></button><a href="mailto:yil384@ucsd.edu" id="mail-link">yil384@ucsd.edu</a><button type="button" class="gbtn gbtn--sm" data-game data-copy="email">Copy</button> · <a href="tel:+18583197361" class="phone">(858) 319-7361</a></p>
      <p>Computer Science and Engineering, UC San Diego, La Jolla, CA.</p>
      <p class="aside">Questions, collaborations, or an egg I did not know about: please write. The mailbox has a flag for a reason.</p>
    </div>
    <ul class="hero__links hero__links--card portals" aria-label="Profiles">
      <li><a class="portal" data-portal="scholar" href="https://scholar.google.com/citations?user=itFHNzoAAAAJ" target="_blank" rel="noopener"><span class="portal__ring" data-game aria-hidden="true"></span><img src="assets/icons/brand/googlescholar.svg" alt="" width="18" height="18">Google Scholar</a></li>
      <!-- GitHub, LinkedIn likewise, data-portal="github" / "linkedin" -->
    </ul>
    <p class="compose" data-game><span class="compose__k">Quick subject</span>
      <a class="chip" href="mailto:yil384@ucsd.edu?subject=Collaboration">Collaboration</a>
      <a class="chip" href="mailto:yil384@ucsd.edu?subject=Question%20about%20TritonGym">Question about TritonGym</a>
      <a class="chip" href="mailto:yil384@ucsd.edu?subject=I%20found%20an%20egg">I found an egg</a></p>
    <div class="savepoint" data-game><button type="button" class="savepoint__crystal" aria-label="Save point"></button><p class="savepoint__t">Save point · progress lives in this browser</p></div>
    <span class="sealion" data-game aria-hidden="true"></span>
    <p class="eggline">… unchanged …</p>
  </div>
</section>
```

#### FOOTER `<!-- region:credits -->`
```html
<section class="credits" id="credits" data-game aria-label="Credits and run summary">
  <p class="credits__end">The end?</p>
  <div class="credits__roll" aria-hidden="true"><ol class="credits__list">
    <li><b>Starring</b> Yichen Lin as the Scholar</li>
    <li>Bit as Bit</li>
    <li>Chef Zhuo as himself (best cook in the building)</li>
    <li>Archivist Nell · Unit-7 · Mo · Tide · Fern · Ash</li>
    <li>King Triton (statue) · Sun God (statue) · the sea lions (unpaid)</li>
    <li>Reviewer #2 (uncredited)</li>
    <li>Built with three.js · no frameworks · no build step</li>
  </ol></div>
  <dl class="results" id="results"></dl>
  <div class="credits__btns"><button type="button" class="gbtn" data-act="title">Back to title</button><button type="button" class="gbtn" data-act="ngplus">New Game+</button><button type="button" class="gbtn" data-act="notes">Open field notes</button></div>
  <p class="credits__confirm" hidden>Reset page progress? Eggs are kept. <button type="button" class="gbtn gbtn--sm" data-act="ng-yes">Yes</button> <button type="button" class="gbtn gbtn--sm" data-act="ng-no">No</button></p>
  <div class="postcredits" hidden aria-live="polite"></div>
</section>
<footer class="foot"> … unchanged … </footer>
```
The credits section sits **inside `<main>`** after `#contact` (pointer-events auto on it).

### 3.2 Trail markup (each gap, between `</section>` and the next `<section>`; `<!-- region:trail -->` wraps none — TRAIL code owns behaviour only)
```html
<div class="trail" data-game data-trail="g1" data-from="hero" data-to="about">
  <div class="trail__card" aria-hidden="true"><span class="trail__line"></span><p class="trail__zone">Library Walk</p><p class="trail__sub">Chapter 01 · About</p></div>
  <div class="trail__post"><span class="trail__lantern" aria-hidden="true"></span><button type="button" class="trail__sign" data-go="about">→ Library Walk · 120 m</button></div>
  <button type="button" class="token" data-token="t7" aria-label="Triton token"></button>
  <svg class="trail__steps" viewBox="0 0 240 40" aria-hidden="true"><!-- 6 footprint paths class="trail__step" --></svg>
</div>
```
g3 additionally: `<button type="button" class="trail__house" aria-label="A tiny house on a roof"></button>` inside `.trail__post`.

---------------------------------------------------------------------------------------------------

## 4. Sections: behaviour

Format per section: **interactions** (trigger → effect → sound → egg / award), **modes** (reduced motion · phone · no-JS/plain), **world**. "award(open:…)" means `progress.markOpened(id, el)` (+5 XP once). `say(who, …)` means `kit.say`.

### 4.1 HERO — Title screen (SECTIONS-A: `ui/hero.js`, `ui/hero.css`)
Look: left column over Geisel, max-width 580px. h1 Instrument Serif 88px (52px phone) with a slow gold sheen (a pseudo-layer gradient `translateX`, every 9s). In `.is-game` the real `.hero__name-t` is `color: transparent` and `.hero__blocks` renders 9 letter spans (Y i c h e n L i n; space kept as gap) over it, same font/metrics. `.hero__class`: angled navy tag "CLASS · SCHOLAR" + Inter 15px line. Links become **skill slots**: 36px square pixel-framed icon tiles with the label beside and key hint 1–5 under the tile. Title menu: Pixelify Sans 18px items, a Bit-blue pixel hand cursor (`.title-menu__cursor`, 16px, CSS-drawn) slides to the hovered/focused item. `PRESS START` in Silkscreen 12px blinks (opacity steps(2), 1.2s) above the scroll-cue arrow. Boot log: JetBrains Mono 12px, 60% opacity, 3 lines typed as the world loads: "mounting campus… ok" / "waking the islanders… 9/9" (or "island asleep (no WebGL): poster mode") / "checking deadlines… always tonight (AoE)" → "ready." then fades after 3s.
Interactions:
- hover/focus a menu item → cursor translateY (240ms) → sfx buddy.
- **Begin the tour** (a link, works without JS) → smooth scroll to #about → sfx open → `emit('page:start')`.
- **Continue** (shown when `P.lastSection` exists and ≠ hero and the visit is a later day than `P.firstVisit`): label "Continue · Chapter 04 · The trail" → scroll there → toast "Save file loaded. Welcome back, Lv 3 First-year." → first time `found('continue')` ("Continue? ▶ YES").
- **Take control** (shown only when chrome says canPlay) → `world.enterPlay()`.
- **Read plainly** → `mode.setPlain(true)`.
- **Walk the page** (shown only if walk.js loaded) → walk mode.
- Enter or Space with focus on `body` before any scroll → PRESS START flashes white twice → sfx signature → scroll to About → `found('start')` ("Press Start to continue. You did.").
- Keys 1–5 while the hero is ≥50% in view focus link 1–5 (Enter opens).
- Click a name letter block → it bumps up 8px (120ms steps(2)) → sfx block. The dot of the first "i" on its first bump pops **token t1** (a coin rises from the letter, `progress.token('t1', el)`). All 9 bumped → `found('blocks')` ("Every block bumped. No mushrooms, sorry."). Bumps also count clicks for the existing `alias` egg (eggs-dom listens on `#name` click; blocks are inside #name, so it just works). Third bump in a session → `say('me','Careful, those are load-bearing letters.')`.
- Typing "yichen", "yil384" or "lin" anywhere (not in inputs) → the h1 swaps to Press Start 2P gold with a scanline flicker for 900ms → `emit('page:sky',{n:2})` → `found('typename')` ("Autocomplete: yichen, lin and yil384 all resolve.").
- Konami (existing) also sends a wave through the 9 letters (listen to `egg` 'konami' or hook the existing confetti).
Modes: reduced motion — no sheen, no blink, no typing, cursor jumps. Phone — menu full width, items 44px, key hints hidden, blocks still tappable. No-JS/plain — title menu, blocks, class line, PRESS START hidden; today's hero.
Bit tips (hero): "The letters look bumpable." / "Some keyboards know his name." / "Press start. Or Enter. Same thing."
World: data-say kept. Start → `page:start`. Email slot hover/focus → `world()?.stage.setHover('mailbox')`, cleared on leave (no event).

### 4.2 ABOUT — Party screen / character sheet (SECTIONS-A: `ui/about.js`, `ui/about.css`)
Look: card 760px, two columns: main (h2, prose, affinities, party) and a 200px side (portrait 160×160 in `.px-frame` with gold double frame; nameplate "YICHEN LIN" Pixelify 18px gold + "Scholar · party leader"; stat `<dl>` Silkscreen 10px labels / Inter 14px values in a 1-column list). Phone: side stacks above main; `dl` 2 columns.
Interactions:
- Portrait: in game mode the default look is **pixelated** (a 48px downscale drawn once into `canvas.portrait__px`, displayed upscaled with `image-rendering: pixelated`); hover/focus crossfades to the real photo (300ms). The existing portrait egg (5 quick clicks → voxel scholar) stays in eggs-dom.js.
- Affinity chip → aria-pressed toggles (one at a time); every element on the page with that tag in `data-tags` gets `.is-match` (2s teal outline pulse + a small "matches: Compilers" chip in its top-right via `::after content: attr(data-match)`); `.affinities__out` lists the matches as links ("Matches: TritonGym (paper), TritonGym (project)"); clicking one scrolls there. `emit('page:open',{key: first match focus key, what:'affinity'})`. sfx pop. First use of each chip +2 XP (`award({id:'aff-'+k, xp:2})`). All four used → `found('specialist')` ("Build respec: all four trees. Very Ph.D.").
- **Flip the pan** → pan sprite flips (rotate -30°→0, 300ms, 2 frames) + steam puff + sfx pop → HUD focus refills (`hud.refillFocus()`) → `say('zhuo', …)` cycling: "Tomato and egg. Eat before you debug." / "Dinner is at seven. Bring a benchmark." / "The secret ingredient is a deadline." The first flip reveals **token t2** jumping out of the pan. 3rd flip in a session → `found('zhuo')` ("Dinner is served: tomato and egg, the Tsinghua classic.").
- **Invite to party** → the chef sprite hops next to the nameplate (party row shows 2 sprites) → bubble "zhuo: I only join parties that have snacks." → `emit('page:open',{key:'about', what:'invite'})` (world: optional). Button becomes "In party ✓" (disabled).
- The stat-list email stays a plain mailto link (copying lives in Contact, so there is one copy behaviour).
- Seagull critter (COMPANIONS) uses the `.aside` right padding as its landing spot; ABOUT must reserve `padding-right: 56px` on `.prose .aside` in game mode.
Modes: reduced motion — no pan animation, direct crossfade. No-JS/plain — portrait photo, plain `dl` with plain labels, prose; affinities/party hidden.
Bit tips: "That photo has more than one face." / "Chef Zhuo keeps something in the pan." / "Try every interest chip."
World: data-say ash kept.

### 4.3 EDUCATION — Class-change path (SECTIONS-A: `ui/edu.js`, `ui/edu.css`)
Look (≥900px): Tsinghua node left, UCSD node right (CSS order), 168px track between them at badge height; badges are 120×104 hexagons (`clip-path: polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)`) — Tsinghua purple `#660874` ring, UCSD navy with gold rim — holding the existing white logo (the `.row__logo` is visually moved into the badge with grid areas). Under each: title/role/desc/when (the row text), then `.path__state` chip ("MASTERED ✓" green / "CURRENT CLASS" teal with pulse ring) and the Inspect button. The locked node is a small dim dashed hex tile below-right: "???" + "Next class: locked". Phone: vertical stack Tsinghua→UCSD (CSS order), the track becomes a vertical 48px line with the walker, locked tile last.
Interactions:
- First reveal (chapter becomes current, once per session; this is the section's one auto-celebration) → SVG path draws (stroke-dashoffset, 900ms) → the 24px scholar walker (`spriteImg('scholar',2)`, 2-frame bob) moves along the chord 2.4s (transform translateX + small sine translateY via keyframes) → at UCSD: badge border flashes gold, `.path__banner` "CLASS CHANGE · Undergraduate → Ph.D. scholar" pops (scale .6→1) → sfx levelup → **token t3** appears under the banner → `emit('page:classchange')` → award +10 ("Class change"). Later visits show the end state.
- Inspect (click/Enter/E) → `.path__back` expands under the node (hidden→shown, height via grid-rows 0fr→1fr) → sfx open → `award open:edu-ucsd / edu-thu` → `emit('page:open',{key:'cse'|'gate'})`. Thu back also `found('gate')` when there is no world (page route to the world egg).
- "Show me…" → `world ? director.focus` isn't enough (focus scrolls the page): call `world.stage.setHover(key)` + `emit('page:open',{key, what:'visit'})`; without world, `kit.echo()`.
- Waypoint "?" → bubble "0 days between the gates. No side quests." (B.S. ends 2025, Ph.D. starts 2025) → `found('zerogap')`.
- Locked node → shake (translateX ±3px ×3) + bubble "Locked. Requires: a thesis, a defense and 3 more deadlines." 7th click → it opens for 3s showing "Dr. Lin (coming soon)" with sparkle, then relocks → `emit('page:sky',{n:3})` → `found('thesis')` ("Patience is also a skill.").
- ←/→ while a node is focused moves focus between nodes.
Modes: reduced motion — path drawn, walker standing at UCSD, banner static. No-JS/plain — two plain rows as today (`.path__track`, badges, locked hidden; `.path__nodes` renders as `.rows`).
Bit tips: "Something sits between the two gates." / "Locked doors like persistence." / "Inspect the badges."
World: node hover → existing data-focus contract.

### 4.4 SKILLS — Attributes on the workbench (SECTIONS-C: `ui/attrs.js`, `ui/attrs.css`)
Look: sub-panel at the bottom of the Projects card, header strip "ON THE WORKBENCH · ATTRIBUTES" (Silkscreen) with a wrench sprite. 7 rows: icon 18px · name Inter 14px · 20-cell segmented bar 10px (colour per language: Python #4ADE80, C++ #60A5FA, Rust #F97316, Go #22D3EE, TypeScript #818CF8, JavaScript #FACC15, Verilog #F472B6) · tier word Silkscreen 10px. Inventory: 6 square 56px slots in a pixel bag grid (icon + label; "×∞" joke count in the corner). Console strip below: JetBrains Mono 12px, dark inset, 3 lines max (older lines scroll off).
Interactions:
- In view (IO .5, once) → bars fill left→right (scaleX, rows staggered 80ms, 700ms each), 1-cell sparkle at the end, soft sfx tick per row. Award +5 ("Attributes checked").
- hover/focus a row → tooltip "Python · 90 / 100 · High" + the projects in `data-projects` get `.is-match` pulse; Bit slides over.
- click/Enter a row → console types that language's hello world at 40 cps (sfx tick every 3rd char): Python `print("hi from La Jolla")`, C++ `std::cout << "hi\n";`, Rust `fn main() { println!("hi"); }`, Go `fmt.Println("hi")`, TypeScript `console.log("hi" as const)`, JavaScript `console.log("hi")`, Verilog `always @(posedge clk) led <= ~led;` → then "ok · compiled once, at least" → the row shimmers 600ms → `emit('page:open',{key:'workbench', what:lang})` (world: sparks) → projects in `data-projects` pulse; if any, Bit hops to the first. Verilog also blinks a 6px LED next to its bar (1Hz, 5s).
- **Overfill:** clicking the Python bar (not the row: the `.attr__bar` region; implement as: the 2nd+ consecutive click on Python within 3s) adds one red pulsing overflow cell beyond 100 ("Python 100… 110… 120"); at 3 overflow cells → console prints red `RuntimeError: CUDA out of memory. Tried to allocate 2.00 GiB` → a CUDA OOM Golem head (`spriteImg('golem',2)`) peeks from the panel's right edge 1.5s → sfx boom → bar snaps back → float "torch.cuda.empty_cache()" → `emit('page:oom')` → `found('overfill')`.
- Inventory: Vim → console "Entering vim… type :q to exit." and a 10s listener: typing `:q` → "You escaped. Few do." → `found('vimslot')`; other keys → "E492: Not an editor command". LaTeX → the label renders as a TeX logo (E lowered .2em) + console `Overfull \hbox (badness 10000) in paragraph at lines 42--42` → `found('tex')`. Linux → console "uptime: longer than this Ph.D. so far" + a tiny penguin-free pixel terminal cursor blinks. WebSocket → console "101 Switching Protocols" + a dot travels to the IM System card if in view. Django → "python manage.py runserver … ok". MongoDB → `db.eggs.countDocuments() → {live found count}`. Using all six → `found('hotbar')` ("Every tool used once. Ship it.").
Modes: reduced motion — bars filled, console prints instantly. Phone — bars 6px cells, value under the tier. No-JS/plain — the current `.tools` chips plus the tier word ("Python · High").
Bit tips: "Python looks like it could take more." / "One of those tools is famously hard to leave." / "LaTeX has opinions about boxes."
World: `.toolbox` hover → existing workbench focus.

### 4.5 PUBLICATIONS — Achievements hall (SECTIONS-B: `ui/pubs.js`, `ui/pubs.css`)
Look: each pub is an achievement card. Left rail 72px: round medallion in `.px-frame` (TritonGym silver with a lightning glyph and a slowly rotating hourglass steps(4) 4s + ribbon "IN REVIEW"; (Re)²H₂O gold trophy + ribbon "UNLOCKED 2023"), the year in Press Start 2P 10px below. Body: title Instrument Serif 20px, authors with **Yichen Lin** gold, meta line (status pill unchanged) + topic chip, then Summary / BibTeX `details` styled as small tab buttons (`summary` gets `.gbtn` look; `pre` JetBrains Mono 12px dark inset with horizontal scroll), then the action row. Card top padding reserves 28px for the unlock banner. A shelf of spines in the card head (2 filled books + 3 faint "···" slots), decorative.
Interactions:
- First time each card is ≥60% visible (once per save) → an "ACHIEVEMENT UNLOCKED" banner slides down inside the card's reserved top padding (350ms), holds 2.5s, slides back; the medallion does one rotateY 360°; 6 gold particles; sfx achievement; trophy toast: "Achievement unlocked · Published at IEEE IV 2023" / "Achievement in progress · Submitted to ICML 2026"; award +10; `emit('page:open',{key, what:'unlock'})`.
- hover card → gold shimmer sweeps the medallion (pseudo translateX).
- `details` toggle → sfx open → award open:pub-*-summary / -bib.
- **Copy BibTeX** (also key C on the focused pub) → `kit.copyText(code.textContent)` → button label "Copied · cite away" (1.6s) → a red **CITED** stamp thumps into the `.stamp-slot` (kit.stamp tone red) → float "+1 citation (in spirit)" → award +5 → `found('cite')` ("Cited. h-index +0.0001."). Clipboard blocked → select the code and label "Press Ctrl/Cmd+C". Opening the (Re)²H₂O BibTeX the first time reveals **token t4** after the code.
- **Visit the shelf** → `world?.stage.setHover(key)` + `emit('page:open',{key, what:'visit'})` + `say('nell', row data-say line)`.
- **Request review** (TritonGym) → `#r2` panel expands below the card body (grid-rows 0fr→1fr 300ms, user-initiated shift). Panel: Reviewer #2 sprite (`spriteImg('mage',2)`), label "SIMULATED REVIEW · a joke, not a real review", a pixel score dial 1–10 (needle swings to 3–5 with wobble), a random comment from the pool: "The authors should compare against a baseline from 1987." / "Please cite the following 14 papers (all mine)." / "Weak reject. The benchmark is too benchmark-like." / "I did not read the appendix, but it is wrong." / "Accept if the authors run it on my laptop." / "The kernels are fast, but are they fast enough?" / "Missing related work: my thesis." / "Novelty unclear; clarity also unclear." A refresh ↻ icon and a **Write rebuttal** button.
  - Write rebuttal → typewriter (40 cps, sfx tick) "We thank the reviewer for their insightful comments. We have addressed all concerns, including the baseline from 1987." → reply "I have read the rebuttal. Score unchanged." → grey SCORE UNCHANGED stamp → `found('rebuttal')` ("Score unchanged. Classic."). 2nd rebuttal: needle +1, "Borderline. I remain unconvinced but tired." 3rd: "Reviewer #3 is loading…" + Bit hint "The real one lives in the eucalyptus grove (press W)."
  - Refresh ↻ → spins, prints "Status: Under review". 5th within 10s → "Please stop refreshing. Decisions are out when they are out." → `found('refresh')`.
  - `emit('page:open',{key:'book-triton', what:'review'})`; world: `say('nell','Oh no. Reviewer #2 found the library.')`.
  The real status pill never changes.
- `.ast` (upgraded by JS to `role="button" tabindex="0"` in game mode) → both names highlight with a connecting underline + a tiny high-five spark; tooltip "equal contribution" → `found('asterisk')` ("Two names, one star.").
- `.sub2` (the ₂ in H₂O, upgraded the same way) → 6 water droplets rise (700ms) → `say('bit','Stay hydrated.')` → `emit('page:sky',{n:2})` → `found('h2o')`.
- `.sq` (the ²) → the title briefly shows "(Re)²H₂O²" joke tooltip "Squared twice. Still water." (no egg; small wink).
- Keyboard: E on a focused pub toggles its Summary.
Modes: reduced motion — banner fades, no flip, hourglass static, needle jumps. Phone — rail becomes a top row (medal 40px + year + ribbon inline), action buttons full width 44px. No-JS — plain rows with native details (collapsed). Plain — details forced open, no medals/actions.
Bit tips: "Stars travel in pairs." / "Water has a subscript." / "Reviewer #2 takes requests."
World: hover → existing `book-*` focus; `page:open` bursts at the book.

### 4.6 EXPERIENCE — Quest log (SECTIONS-B: `ui/quests.js`, `ui/quests.css`)
Look: `.qmap` gantt at the top (64px, 100% wide): year axis 2023 · 2024 · 2025, one 6px bar per quest positioned from `data-start/end` (month resolution), coloured `--org`; built by JS (no hardcoded dates). Quest cards: 6px left band in `--org`; logo; "RESEARCH QUEST" / "INDUSTRY QUEST" Silkscreen 10px; title/role/when/desc unchanged (Inter); Objectives `summary` styled as a gbtn "Objectives (2) ▾"; right column reserves 96px for the COMPLETE stamp (inline after the role on phones). Inside details: notes in italics, objectives as a pixel checklist (☐ boxes drawn in CSS), reward chips, Turn in button.
Interactions:
- Row crosses the viewport centre (IO rootMargin "-45% 0px -45% 0px", once per save per row; the section's auto-celebration) → green **COMPLETE** stamp thumps into `.quest__stamp` (scale 1.6→1, rotate -14°→-8°, 180ms, card nudge 1px) → sfx stamp → `emit('page:stamp',{key})` (world: the flag rings). Newest → oldest as you scroll.
- Open Objectives (summary click/Enter or E) → checkboxes tick one by one (120ms apart, stroke-dashoffset on the check only) with sfx coin per tick → reward chips pop (scale .6→1 stagger) → award open:quest-{id} (+5) → `emit('page:open',{key, what:'objectives'})`.
- **Turn in quest** → 20 coin particles from the button → award `{id:'turnin-'+id, xp:10, cash:5}` → button "Turned in ✓" (disabled) → `P.quests[id]='done'`. All five → `found('questlog')` ("Every quest turned in. The trail is complete.") + `emit('page:sky',{n:6})`.
- Reward chip hover → "Obtained from: {org}"; click → the chip ghost flies into the HUD cash (kit.flyTo) → bubble "Added to inventory (you already had it)." (no reward).
- Gantt: hover/focus a bar → matching row `.is-match`; click → scroll to row. Hover the densest overlap (computed: the month with max concurrent bars; Jun 2024 = 3 with current data) → label "Parallel quests: 3 at once" → `found('multithread')` ("Please don't tell the scheduler."). Since the gantt is aria-hidden, the same egg also fires when the keyboard user focuses the Tencent row within 10s of the Hotstar row (both concurrent with Picasso).
- Tencent **Talk** → bubble "Teammate: Roger! Moving to the monster." then 1.5s later "…which monster?" → sfx buddy → `found('teammate')`.
- Lark logo ×3 → a 24px pixel lark flies out along a curved path off the card top (1.2s) and lands on Bit's head; **token t5** drops where it took off → `say('bit','It flew toward Library Walk.')` → `found('lark')`.
- 3D `pick` of a flag-* → stamp that row immediately and open its details.
Modes: reduced motion — stamps static, checks instant, no confetti ("+10 XP · +5 ◈" float). Phone — gantt becomes 5 thin horizontal bars stacked with year ticks; stamp inline. No-JS — rows + native details. Plain — details open, no stamps/gantt/buttons; rewards read "Keywords: …".
Bit tips: "Some quests overlapped. Find when." / "The Lark logo looks like it could fly." / "Voice-controlled teammates take orders."
World: row hover → flag focus (existing); stamps → `page:stamp`.

### 4.7 PROJECTS — Equipment (SECTIONS-C: `ui/equip.js`, `ui/equip.css`)
Look: 2×2 grid (1 col phone), cards min-height 236px, notched pixel frame, rarity edge glow via `--rarity` (epic `--r-epic`, rare `--r-rare`, legendary `--r-legend` with a slow glint sweep every 6s). Front: rarity label Silkscreen 9px top-left, pixel item icon 32px top-right (CSS box-shadow pixel art: sword, shield, gavel-tome, trident), title Pixelify 20px (link), sub Silkscreen 10px, desc Inter 14px, tech icons, action row, output terminal (hidden until a move, 96px, JetBrains Mono 12px). Back: "FOCUS", back text, type line, Back button. Flip: `.equip__card` has `transform-style: preserve-3d`; `.is-flipped` → rotateY(180deg) 450ms; faces `backface-visibility: hidden`; card height fixed by the taller face (both faces in the same grid cell: `display:grid; > * {grid-area:1/1}`), so no layout shift.
Interactions:
- Pointer tilt (pointer:fine, not rm) → rotateX/Y ≤6° + moving glare, rAF-throttled, only while hovered.
- **Inspect** (or E) → flip + sfx flip → focus moves to the back's Back button → award open:equip-{id} → `emit('page:open',{key, what:'inspect'})`. Back → flip back, focus returns to Inspect. Tapping the card body never flips (links stay tappable).
- **Equip** → icon ghost flies into the matching `.loadout__slot` (kit.flyTo) → sfx purchase → card gets an "E" badge, aria-pressed=true → `P.equipped` → `emit('page:equip',{key, on:true})`. Unequip toggles back. All four equipped → `found('loadout')` ("Full set bonus: +10% chance a reviewer reads the appendix.").
- **Boot** (Starry-Next) → terminal types (flavour, first line "# simulated"): `[ 0.000] Starry-Next: booting` / `[ 0.012] net: bringing up the stack` / `[ 0.020] net: eth0 up` / `[ 0.031] hello from ring 0`. Clicking Boot again while it types → `Kernel panic - not syncing: you clicked too fast` + red border flash → `found('panic')`; the next click reboots cleanly.
- **Ping** (IM System) → first ping prints `101 Switching Protocols`, then bubbles "you: ping" / "server: pong (NN ms)" (NN 8–40, tooltip "illustrative"), keeps the last 4. 10th ping → "server: connection upgraded to friendship ♥" → `found('pingpong')`.
- **Submit** (CST-OJ) → "Pending…" 400ms → "Compiling…" 500ms → "Running on test 1… 2… 3…" → verdict badge. First submission always "Wrong Answer on test 3" (red); then random among Time Limit Exceeded / Runtime Error (SIGSEGV) / Memory Limit Exceeded / Wrong Answer on test 3; Accepted guaranteed between the 5th and 8th (seeded). Colours = landmarks.js VERDICTS. Each verdict `emit('page:judge', v)`; WA → sfx error; AC → sfx victory + confetti (24) + award `{id:'oj-ac', xp:20, cash:5}` + **token t6** pops out of the verdict. Page routes to world eggs: first WA → `found('judge')`, first AC → `found('accepted')` (idempotent with the world).
- **Run** (TritonGym) → terminal types `@triton.jit` + `def add_kernel(x_ptr, y_ptr, out_ptr, n, BLOCK: tl.constexpr):` + `    ...` + `agent: submitting kernel…`; first run ends `RuntimeError: CUDA out of memory` (+ Golem head peek 1.5s, `emit('page:oom')`); second run `compiled ✓ · results: see the paper (under review)` + a link-button "Read the paper card ↑" (focus #pub-tritongym) → `found('jit')` ("Compiled. Eventually."). Never shows numbers.
- 3D `pick` of a mon-* → that card flips to its back.
Modes: reduced motion — no tilt, flip = 150ms crossfade, typewriter instant. Phone — flip via button only, terminal 96px. No-JS/plain — front then `.equip__back` stacked as an indented "Details" paragraph; actions/terminal/loadout hidden.
Bit tips: "The judge accepts eventually." / "Don't interrupt a boot." / "Equip the whole set."
World: hover → `mon-*` focus; `page:judge` flips the 3D board; `page:equip` lights the monitor.

### 4.8 CONTACT — Portals, mailbox, save point (SECTIONS-C: `ui/contact.js`, `ui/contact.css`)
Look: email Inter 20px preceded by a 28px pixel mailbox (red flag) button and followed by a small Copy button; phone with a pixel phone icon. Portals: 96×96 tiles (88px phone, 3 in a row) — two conic-gradient pixel rings rotating in opposite directions (8s / 12s, paused unless the section `.is-live`) around the brand icon, label in Silkscreen under it; the whole tile is the `<a>`. Compose chips row. Save point: `spriteImg('crystal',3)` with a slow glow + text. A sleeping sea lion (`spriteImg('sealion',2)`, "z") on the card's bottom-right border.
Interactions:
- hover/focus the email → `emit('page:mailbox',{up:true})`; leave → down unless copied.
- **Copy** → `kit.copyText('yil384@ucsd.edu')` → "Copied ✓" → a grey pixel pigeon flies from the button off the card's top-right (1s) → sfx purchase → existing `found('copy')` → mailbox flag stays up for the session → `emit('page:mailbox',{up:true})`.
- Mailbox button → flag toggles (rotate 0→-90°) → sfx open → `emit('page:mailbox',{up})` → bubble "Flag up. Write to me: yil384@ucsd.edu" → 3rd toggle `found('mailbox')` (page route, idempotent).
- Phone hover → icon rings (rotate ±12°, 3 cycles) + sfx ring.
- Portal hover/focus → rings speed up (class swaps animation-duration), glow, icon scale 1.08, sfx warp; click navigates normally (new tab) after a 150ms white implode flash (do not delay navigation: flash is on pointerdown). Hovering/focusing all three in one visit → `found('portalhop')` ("Three portals, zero teleport fees.") → `emit('page:portal',{name})` each.
- Compose chip click → sfx open → `found('subject')` ("Clear subject lines get replies."); mailto opens normally.
- Save point → crystal pulse + sfx heal → `saveNow()` → `hud.refillFocus()` → text "Game saved. HP and FOCUS restored." (or "Progress kept for this visit (storage is off in this browser)." when `!canPersist()`) → `emit('page:save')` → `found('savepoint')`.
- Sea lion → wakes, "Arf.", flops off the border and back → `found('sealion')` (page route).
Modes: reduced motion — rings static with glow, no pigeon. No-JS/plain — today's contact card (links list).
Bit tips: "The mailbox has a flag." / "Portals are nicer with the pointer on them." / "Save often."
World: data-say fern; `page:mailbox` raises the 3D flag; `page:portal` rings the Sun God.

### 4.9 FOOTER — Credits and results (SECTIONS-C: `ui/credits.js`, `ui/credits.css`)
Look: centred column over the lawn: "THE END?" Instrument Serif 48px; the credits list rolls upward (translateY, 40s, only while in view; static under rm) inside a 180px masked window; results plate `dl.results` in Silkscreen with tabular numerals: CHAPTERS CLEARED n/6 · DETAILS OPENED n/15 · QUESTS TURNED IN n/5 · BUGS BONKED n · TOKENS n/12 · EGGS n/total · TIME mm:ss · LEVEL Lv n Title · RANK S/A/B/C (C = "Careful reader"; never framed as failure; S = all chapters + 10 tokens + 25 page eggs). Incomplete rows show a hint ("3 tokens left: try the trail signs").
Interactions:
- Credits enter the viewport → roll starts, values count up, sfx victory once; award `{id:'finish', xp:20}`; `emit('page:clear',{shot:'footer'})`. The existing `bottom` egg still fires from eggs-dom.
- Roll reaches the end (or 12s after entering under rm) → post-credits strip: scholar sprite + Bit sprite sit on a pixel pier; Bit: "See you next conference." → `emit('page:credits')` → `found('credits')` ("You stayed for the post-credits scene.").
- New Game+ → inline confirm → Yes → `progress.resetPage()` → scroll to top → the hero letters bounce → toast "New Game+: same CV, more confident." → `found('newgame')`. NG+ marks: critters wear party hats, zone cards show "NG+".
- Back to title → scroll to top, focus "Begin the tour".
- Open field notes → `openNotes({tab:'progress'})`.
- Rank S → toast "Rank S. Reviewer #1 would like a word (a good one)."
Modes: plain/no-JS/print — the credits section is hidden; the footer paragraphs are unchanged and always visible.

### 4.10 BETWEEN SECTIONS — trail (SECTIONS-A: `ui/trail.js`, `ui/trail.css`) — see §2.5.
Bit tip for trail gaps (when Bit is between cards, i.e. never; skip).

---------------------------------------------------------------------------------------------------

## 5. Shared component library (FOUNDATION) — section code must use these

### 5.1 `assets/js/site/ui/kit.js`
```js
export { h, isEditable } from '../../game3d/util.js';
export { spriteImg, spriteUrl } from '../../game3d/pixelart.js';
export { on, emit } from '../../game3d/bus.js';
export { found, has } from '../eggs.js';
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const world = () => window.__page?.world || null;          // null without WebGL / before ready
export const rm = () => document.documentElement.classList.contains('rm');
export const isGame = () => document.documentElement.classList.contains('is-game');
export const isPlain = () => document.documentElement.classList.contains('is-plain');
export function sfx(name) {}            // throttled wrapper around audio.sfx (≤6/s per name; 'buddy' ≤1/80ms)
export function say(who, text) {}       // world.say if live, else Bit bubble fallback (emits 'ui:say' {who,text})
export function bubble(anchor, text, { who, ms = 3200, place = 'auto' } = {}) {} // speech bubble in gutter / above; returns {close}
export function float(fromEl, text, { tone = 'gold' } = {}) {}                     // '+5 XP' etc.
export function stamp(slotEl, text, { tone = 'ok', rot = -8, size = 'md', silent = false } = {}) {} // puts .stamp into a slot, animates, sfx stamp; returns el
export function burst(fromEl, { n = 8, colors, kind = 'spark' } = {}) {}           // DOM particles, capped at 40 alive; kind 'coin'|'spark'|'drop'|'heart'|'confetti'
export function flyTo(fromEl, toEl, { sprite, html, ms = 520 } = {}) {}           // ghost element arcs from → to (FLIP), resolves Promise
export function typewriter(el, text, { cps = 40, sound = true, append = false } = {}) {} // Promise; instant under rm; one text node
export function toast(title, sub, { kind = 'info' | 'ach' } = {}) {}             // into #egg-toasts, max 3
export function live(msg) {}                                                         // one throttled aria-live polite region
export async function copyText(text, { selectEl } = {}) {}                          // clipboard → fallback select; returns boolean
export function clicks(el, n, windowMs, fn) {}                                      // n clicks within windowMs → fn(); returns counter reset fn
export function hold(el, ms, fn) {}                                                  // long press (pointer + Enter held)
export function observe(el, { threshold = 0.5, once = true, rootMargin } = {}, fn) {} // shared IO(s), fn(entry)
export function dwell(el, ms, fn) {}                                                 // ≥50% visible for ms cumulative (pauses when hidden)
export function onSection(fn) {}          // fn({ id, shot, el, card }) when the current section changes (bus 'shot' or scroll spy)
export function currentSection() {}
export function echo() {}                  // poster flash when no world
export function once(key) {}               // true the first time per save (P.once)
export function sessionOnce(key) {}        // true the first time per page load
export function upgradeButton(el, label) {} // gives a span role=button, tabindex=0, Enter/Space → click
export function expand(el, open) {}        // grid-rows 0fr→1fr expander for [hidden]-style panels, sets aria-expanded on its controller
export function primary(el, fn) {}         // handle the 'ui:primary' CustomEvent (E key) on an item
```
Also exported: `NPC_SPRITE = { me:'scholar', bit:'bit', nell:'owl', unit7:'robot', mo:'merchant', tide:'frog', fern:'sprout', ash:'cartographer', zhuo:'chef' }`.

### 5.2 Other FOUNDATION modules
- `site/ui/pstate.js` — §2.2 (`P`, `save`, `canPersist`).
- `site/ui/progress.js` — §2.3.
- `site/ui/hud.js` — §2.4 (`initHud()`, `hud.target/flash/refillFocus/pulse`).
- `site/ui/mode.js` — §2.1 (`initMode()`, `setPlain`, `isPlain`, `onMode(fn)`).
- `site/ui/keys.js` — §2.8 (`initKeys()`, `registerKey(key, fn, {when})` for section/companion keys like B and P).
- `site/ui/chapters.js` — read/clear logic, seals, `lastSection` (§2.3).
- `site/ui/index.js` — boot: `initMode(); initHud(); initKeys(); initChapters();` then dynamic-import each section module in order `hero, about, edu, trail, pubs, quests, equip, attrs, contact, credits, bit, critters, walk` and call `mod.init?.(ctx)` inside try/catch (a missing/failed module never breaks the page). `ctx = { kit, progress, hud, mode, P }`. Skipped entirely (except mode) when `is-plain` at boot; section modules must still work if plain is turned off later (init always runs; modules check `isGame()` at interaction time and listen to `onMode`).
- page.js: `import('./site/ui/index.js')` after `initDomEggs` (not awaited).
- Section module contract: `export function init(ctx) {}`; must not throw if its markup is absent; owns only its section's elements; talks to others via kit/bus only.

### 5.3 CSS classes (FOUNDATION `kit.css`)
`.card-head .seal-slot .seal .stamp .stamp--ok/--gold/--red/--ink/--violet .gbtn .gbtn--gold/--ghost/--sm .chip .chip--reward .px-frame .bubble .bubble__who .float .meter .token .is-match .is-live .plain-only .game-only .sr .spark .coin-fx .drop-fx .heart-fx .confetti-fx .keys-sheet .toast-ach .card--wide (--card-w: 720px) .card--xl (--card-w: 780px)`.
`.is-match` = 2s teal outline pulse + `::after` chip `content: attr(data-match)`.

---------------------------------------------------------------------------------------------------

## 6. New easter eggs (FOUNDATION registers all in `assets/js/site/eggs.js`, kind `'page'`)
38 existing + 44 new = 82. `found()` is idempotent; page routes to world eggs (gate, judge, accepted, mailbox, fallen, sleep, pet, sealion, copy) call the same id.
| id | name | hint | done |
|---|---|---|---|
| start | Press Start | The title screen is waiting for a key. | Press Start to continue. You did. |
| blocks | Load-bearing letters | The big name looks bumpable. | Every block bumped. No mushrooms, sorry. |
| typename | Autocomplete | Type his name anywhere. | yichen, lin and yil384 all resolve. |
| continue | Save file found | Come back another day. | Continue? ▶ YES |
| specialist | Full respec | Try every research interest. | Build respec: all four trees. Very Ph.D. |
| zhuo | Dinner is served | The best cook in the building has a pan. | Tomato and egg, the Tsinghua classic. |
| seagull | Apex predator | Something on Library Walk wants your fries. | Seagull 0, scholar 1. |
| zerogap | No gap year | Look between the two campuses. | 0 days between the gates. |
| thesis | Patience | Some doors open for the persistent. | Patience is also a skill. |
| offbyone | Off by one | Bonk the slime near Education. Twice. | i < n, not i <= n. |
| overfill | CUDA OOM | Python looks like it could take more. | Tried to allocate 2.00 GiB. |
| vimslot | :q | Use Vim on the workbench, then leave. | You escaped. Few do. |
| tex | Badness 10000 | LaTeX has opinions about boxes. | Overfull \hbox. Again. |
| hotbar | Hotbar hero | Use every tool on the workbench. | Every tool used once. Ship it. |
| cite | Cite me | Copy a BibTeX. | Cited. h-index +0.0001. |
| rebuttal | Rebuttal | Answer Reviewer #2. | Score unchanged. Classic. |
| refresh | F5 | Refresh the review status. A lot. | Decisions are out when they are out. |
| asterisk | Equal contribution | Stars travel in pairs. | Two names, one star. |
| h2o | Stay hydrated | Water has a subscript. | (Re)²H₂O. Drink some water. |
| nan | NaN !== NaN | A strange slime in the library. | Your cash was briefly not a number. |
| questlog | Quest log complete | Turn in every quest. | Every quest turned in. The trail is complete. |
| multithread | Parallel quests | Find where the quests overlap. | Please don't tell the scheduler. |
| lark | A lark | The Lark logo looks like it could fly. | It flew toward Library Walk. |
| teammate | Voice chat | Talk to a voice-controlled teammate. | …which monster? |
| legacy | Legacy code | Something on the trail should not be touched. | Refactored. Tests still pass (there were none). |
| loadout | Full set | Equip every project. | Full set bonus: +10% chance a reviewer reads the appendix. |
| pingpong | Keep-alive | Ping the IM server. Keep going. | Connection upgraded to friendship. |
| panic | Kernel panic | Don't interrupt a boot. | not syncing: you clicked too fast. |
| jit | @triton.jit | Run TritonGym twice. | Compiled. Eventually. |
| segfault | Null Pointer | A bat in the workshop dodges. | Pointer dereferenced safely. |
| portalhop | Frequent traveller | Point at every portal on the lawn. | Three portals, zero teleport fees. |
| subject | Good subject line | Use a quick subject on the lawn. | Clear subject lines get replies. |
| savepoint | Save point | A crystal on the lawn. | Game saved. HP and FOCUS restored. |
| lamplighter | Lamplighter | Walk the trail between chapters. | Six lanterns. The trail is lit. |
| tokens | Token collector | Twelve Triton tokens are tucked around the page. | Twelve tokens. Redeemable for nothing. |
| cleared | Cover to cover | Read every chapter. | Six chapters cleared. Reviewer #1 would be proud. |
| exterminator | Bug bash | Bonk all five critters. | Five bugs fixed. Four new ones filed. |
| invincible | God mode | Poke your HP. | God mode was on the whole time. |
| manual | RTFM | Press ? | Nobody reads the manual. You did. |
| vimnav | j and k | Navigate without a mouse. | You navigated a CV with j and k. Unit-7 is proud. |
| reviewermode | Plain text | Switch to Reviewer mode. | One column, no nonsense. Recommend: accept. |
| phd | Dr. (Honorary) | Keep reading. Keep clicking. | Degree conferred. Not accredited. |
| credits | Post-credits scene | Stay until the credits end. | You stayed for the post-credits scene. |
| newgame | New Game+ | Finish, then start again. | New Game+: same CV, more confident. |
(`speedrun` — "Speedrun" / "Walk the page, top to bottom, fast." / "Any% glitchless." — registered only if walk.js ships; COMPANIONS adds it by calling a FOUNDATION-exported `registerEgg()`; if not shipped, not listed.)

---------------------------------------------------------------------------------------------------

## 7. Work packages and file ownership

Rules: at most 2 agents at once; no two packages edit the same file; nobody edits a file they do not own. FOUNDATION finishes first and creates **every** file listed below (stubs for others' files with a header comment and `export function init() {}`), so later packages only fill their own files. Section packages must not edit index.html except within their `<!-- region:… -->` markers when a spec'd element is missing or a class must be added (they must not change facts or director attributes). Lint each file; screenshot with `?world=0` desktop 1440×900 and phone 390×844, plus `?plain=1` and reduced motion.

Order: **W1** FOUNDATION (alone). **W2** SECTIONS-A ∥ SECTIONS-B. **W3** SECTIONS-C ∥ COMPANIONS. **W4** WORLD (can also run in W2/W3 in place of either, since it only depends on FOUNDATION's bus contract).

1. **FOUNDATION** — owns: `index.html`, `assets/css/site.css`, `assets/css/ui/{tokens,kit,hud,plain}.css`, `assets/js/page.js`, `assets/js/site/{chrome,eggs,eggs-dom,notes}.js`, `assets/js/site/ui/{index,kit,pstate,progress,hud,mode,keys,chapters}.js`, `assets/js/game3d/audio.js` (additive SFX only); creates stubs for all other `ui/*` files.
2. **SECTIONS-A** (hero, about, education, trail) — owns `assets/js/site/ui/{hero,about,edu,trail}.js`, `assets/css/ui/{hero,about,edu,trail}.css`; regions hero/about/edu in index.html.
3. **SECTIONS-B** (publications, experience) — owns `assets/js/site/ui/{pubs,quests}.js`, `assets/css/ui/{pubs,quests}.css`; regions pubs/quests.
4. **SECTIONS-C** (projects, skills, contact, footer) — owns `assets/js/site/ui/{equip,attrs,contact,credits}.js`, `assets/css/ui/{equip,attrs,contact,credits}.css`; regions equip/contact/credits.
5. **COMPANIONS** (Bit, critters, speech fallback, walk mode stretch) — owns `assets/js/site/ui/{bit,critters,walk}.js`, `assets/css/ui/companions.css`.
6. **WORLD** — owns `assets/js/game3d/*` except audio.js: new `game3d/pagelink.js` (all §2.12 reactions, imported by index.js at the end of createGame), `index.js` (`setPaused(bool)` on the api: `renderer.setAnimationLoop(on ? null : step)` + resume; import pagelink), `director.js` (a `pulse(key, ms)` helper: setHover then clear; honour `page:plain` by `setEnabled(false)` while paused), `stage.js` only if a reaction needs a new hook (sky tint optional). Must keep every existing egg and the director contract; `levelup` 3D banner untouched.
