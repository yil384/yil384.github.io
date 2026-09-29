# yil384.github.io

Personal research homepage of **Yichen Lin** (Ph.D. student, UC San Diego CSE), with an optional
playable RPG layer on desktop.

- **Read mode**: a clean, fast academic page (profile, education, toolkit, publications,
  experience, projects, links). Always used on phones/tablets.
- **Play mode** (desktop, toggle in the top bar): the page becomes a small world. Walk around,
  fight slimes and three bosses, catch monsters in the grass, let your buddy fight beside you,
  and earn the three runes that unseal the Secret Chamber.

No build step and no dependencies: plain HTML, CSS and native ES modules, deployed as-is to
GitHub Pages by `.github/workflows/deploy.yml`.

## Run locally

ES modules need to be served over HTTP (opening the file directly will not work):

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Layout

```
index.html                 content + invisible <span class="spawn"> anchors for the game layer
assets/css/site.css        design tokens, layout and the portfolio sections
assets/css/game.css        game layer: entities, effects, HUD, modals, arenas, hub
assets/img/                optimised photos (WebP + JPEG), favicon, social preview
assets/js/main.js          entry point
assets/js/site.js          splash, navigation, scroll-spy, reveal animations, photo flip
assets/js/sky.js           background starfield (+ weather in play mode)
assets/js/game/
  index.js                 bootstrap, main loop, input routing, read/play mode
  state.js                 save data (one versioned localStorage blob, migrates old saves)
  clock.js                 pausable game clock + game-time scheduler
  modal.js                 modal stack (any open modal pauses the world)
  world.js                 spawn anchors -> document coordinates, viewport info
  player.js, combat.js     movement/camera, stats, damage pipeline, spells, projectiles
  enemies.js, bosses.js    field enemies and the three bosses (runes)
  companion.js             the buddy that follows you and attacks (G = signature move)
  monsters.js              party, dex, mounts, evolution, grass encounters, rival duels
  npcs.js, minigames.js    NPC dialogs, shop, typing / memory / snake / breakout
  loot.js, progress.js     tokens, gear drops, achievements, quests, Secret Chamber
  hud.js, panels.js        HUD, minimap and menu panels
  sprites.js               pixel art as ASCII grids, rasterised to cached data URLs
  data.js                  items, enemies, species, type chart, rivals
```

## Editing content

All academic content lives in `index.html` as ordinary semantic HTML. Game entities are placed with
invisible anchors inside each section, e.g.

```html
<span class="spawn spawn--rm" data-spawn="npc" data-npc="pikachu" style="top:52%"></span>
```

`spawn--lm` / `spawn--rm` place an anchor in the left/right page gutter (centred in the margin on wide
screens, hugging the edge on narrow ones). Supported spawns: `player`, `door`, `coin` (`data-id` 1–8),
`enemy` (`data-kind`), `npc` (`data-npc`), `boss` (`data-boss`), `grass` (`data-biome`, `data-label`).

## Game rules worth knowing

- **Opening anything pauses the world.** Dialogs, the shop, battles, mini-games, menus and the game-over
  screen are modals; the game clock stops while one is open, so nothing can hit you, and you get a short
  grace period when play resumes.
- **Readers are never attacked.** Enemies and bosses only fight back for ~12 s after your last game input
  (move, attack, cast). Just scrolling and reading keeps the world calm.
- **Buddies fight with you.** The active party member follows you, auto-attacks with type matchups
  (Electric beats Flying, Fire beats Grass and Ice, Dragon beats Dragon, …), gains XP from field kills,
  and has a signature move on `G`. `T` swaps buddies.
- **The Secret Chamber is earned.** The rune door in the Profile Hall stays sealed until you hold the
  Frost, Shadow and Ember runes from the first defeats of the Ice Golem, the Shadow Mage and the Dragon
  King. The chest grants Mew, the Crown of Runes and permanent max HP/MP.

Controls: arrows or click to move · `Space` attack · `Q` `W` `E` `R` spells · `F` talk/interact ·
`G` buddy move · `T` swap buddy · `Esc` close. Progress is stored in `localStorage` under `yl.save.v2`.
