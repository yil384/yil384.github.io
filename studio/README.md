# studio

Offline video studio for the site's 3D-anime clips: p5.js + p5.brush paint each frame in headless Chromium, ffmpeg
encodes MP4/WebM. Nothing here ships to the browser; the rendered clips live in `../assets/video/`.

* `ANIMATION_GUIDE.md`: the authoring contract (frame model, painting API, cel-3D, direction rules, rendering).
* `studio.html?video=<name>`: live preview with a scrubber (serve the repo root with any static server).
* `node render.mjs --video=<name> --sheet=0,1,2 …`: contact sheets; `--frames --encode` for the final clip.

Engine ported from ClaudeAnimationBase (MIT, `LICENSE-ClaudeAnimationBase`); fonts from Fontsource (OFL).
