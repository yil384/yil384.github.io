# studio

Offline video studio for the site's 3D-anime clips: p5.js + p5.brush paint each frame in headless Chromium, ffmpeg encodes MP4.
Nothing here ships to the browser; the rendered clips live in `../assets/video/`.

* `ANIMATION_GUIDE.md`: the authoring contract (frame model, painting API, cel-3D, direction rules, rendering, known traps).
* `studio.html?video=<name>`: live preview with a scrubber (serve the repo root with any static server).
* `node render.mjs --video=<name> --sheet=0,1,2 …`: contact sheets; `--frames`, then `--encode`, for the final clip.
* `src/props.js`: K-01, gantry, hangar, tunnel, doors, Unit-7, island. `src/cast.js`: the Pilot, Bit and the islanders.
  `../tools/export-props.mjs` bakes the props into `assets/js/props/props.json` for the live site.

| video | length | file | poster | plays |
|---|---|---|---|---|
| V1 Sortie | 26 s | `src/videos/sortie.js` | 20.5 s | hero, once per session |
| V2 Cradle | 10 s loop | `src/videos/cradle.js` | 3.6 s | About panel |
| V3 Catapult | 12 s loop | `src/videos/catapult.js` | 4.8 s | Research panel |
| V4 Home base | 12 s | `src/videos/homebase.js` | 7.5 s | island teaser |

```
node render.mjs --video=sortie --frames --workers=3          # resumable; ~4 s/frame effective on 4 cores
node render.mjs --video=sortie --encode --poster=20.5 --out=../assets/video/sortie
```

Frames are cached in `out/frames/<video>` (git-ignored): after editing a shot, delete only the frames of that time range.
Engine ported from ClaudeAnimationBase (MIT, `LICENSE-ClaudeAnimationBase`); fonts from Fontsource (OFL).
