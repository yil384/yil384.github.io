# yil384.github.io

Personal homepage of Yichen Lin (Ph.D. student, UC San Diego CSE).

The page **is** a small night-time UC San Diego. A three.js voxel island is always rendered behind the
page; the CV sections are glass panels floating over it. Scrolling walks a little scholar between
landmarks (Geisel Library, the CSE building, the Tsinghua gate, a trail of flags, a workshop with four
monuments, the Sun God lawn and a Scripps-style pier). Press <kbd>W A S D</kbd> at any time to take the
controls and play the full game; <kbd>Esc</kbd> returns to the page. There are a lot of easter eggs
(the counter in the top bar keeps score; the backtick key opens a terminal).

The CV itself is game UI (`assets/js/site/ui/`, `assets/css/ui/`): a title screen, a party sheet (About),
a class-change path (Education), an achievements hall (Publications), a quest log (Experience),
equipment cards (Projects), attribute bars (Skills), portals and a save point (Contact) and a credits roll.
An RPG status strip (level, HP, focus, progress, Triton Cash) rides under the bar; Bit and harmless
critters live on the cards; <kbd>P</kbd> lets the scholar walk and jump across the page. Every fact stays plain
HTML: <kbd>R</kbd> (or `?plain=1`) switches to Reviewer mode, a calm one-column CV, which is also what print
and no-JS get. <kbd>?</kbd> lists the keys.

Plain HTML/CSS and native ES modules, no build step. three.js r186 (WebGPU with a WebGL2 fallback).
Devices without a usable GPU, `prefers-reduced-motion` and `?world=0` keep the baked poster behind a
fully working page.

```
index.html                     the page (all CV content lives here, as plain HTML)
assets/css/site.css            page styles: glass cards, top bar, hero, responsive, print
assets/css/game.css            world labels, speech bubbles, play-mode HUD and dialogs
assets/js/page.js              boot: chrome first, then the world if the device can run it
assets/js/site/                page-side scripts
  chrome.js                    top bar (zone, progress, nav, sound, play), card reveals, scroll spy
  eggs.js                      easter-egg registry, persistence, toasts
  eggs-dom.js                  page-level eggs (Konami, portrait, name, tab-away, bottom, print, console)
  notes.js                     the Field Notes panel
  terminal.js                  the backtick terminal
assets/js/game3d/              the world
  index.js                     runtime: one renderer, tour mode and play mode
  stage.js                     landmarks, sky, anchors, camera shots, highlights (the "set")
  layout.js                    where everything stands; terrain is levelled under the plots
  landmarks.js  props.js       voxel builders (tower, CSE, gate, flags, monuments, pier, ...)
  sky.js                       gradient dome, stars, moon, clouds, shooting stars
  camera.js                    one damped camera: authored shots (tour) or follow (play)
  director.js                  page <-> world: scroll picks the shot, hover/click links both ways
  tour.js                      the scholar walking to wherever the page points
  eggs3d.js                    world-level eggs
  dossier.js                   islanders open the real CV sections in a game window
  ...                          the game systems (combat, companions, bosses, NPCs, mini-games)
assets/js/three/               pixel-art definitions, voxel extrusion, renderer bootstrap, GPU probe
assets/vendor/three/           three.js (MIT), minified builds + the addons used
assets/img/world-poster.jpg    baked hero frame (fallback + first paint), og.jpg share image
```

## How the page drives the world

Markup carries the choreography; no JavaScript needs editing to change what is said or where the
camera goes for a section:

| attribute | on | meaning |
| --- | --- | --- |
| `data-shot="hero"` | `<section>` | camera shot (a key in `stage.js` → `shots`) while the section is centred |
| `data-side="left\|right"` | `<section>` | which side the card sits on; the world shifts to the other |
| `data-zone="Geisel Plaza"` | `<section>` | name shown in the top bar |
| `data-focus="mon-oj"` | card / row | finer shot and landmark highlight while that row is centred or hovered |
| `data-say="nell: Two shelves so far."` | section / card | an islander (`nell`, `ash`, `unit7`, `fern`, `me`, `bit`) says it |

Unknown `data-focus` keys fall back to the section's shot, so new rows work without touching the world.
Hovering a landmark lights up its card and clicking it scrolls to the card; hovering a card lights the
landmark. Clicking the ground sends the scholar there.

## URL switches (for testing)

`?world=0` no 3D · `?force=1` run on software GPUs · `?lowfx=1` no shadows/bloom · `?fullfx=1` force them
on · `?dpr=1` fixed pixel ratio (disables adaptive resolution) · `?intro=0` skip the opening fly-in ·
`?play=1` start in play mode.

Run locally with any static server, e.g. `python3 -m http.server 8000`.

## Credits

Logos belong to their organisations (shown for identification). Icons: Simple Icons (CC0), Lucide (ISC),
game-icons.net (CC BY 3.0). Not affiliated with UC San Diego or Tsinghua University; the campus is a
fond, wonky tribute.
