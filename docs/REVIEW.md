# REVIEW.md — status of the SORTIE rebuild

Branch `claude/optimistic-heisenberg-obfas4` (built on the handoff branch `claude/eager-cannon-f09edl`). Nothing here is merged to `main`; the site
that is live today is the one from PR #2.

## Verified (with the tools named)

| what | how | result |
|---|---|---|
| Engine lab (`lab/engine.html`) on WebGL2 and WebGPU, full and cheap post | `tools/qa/px.mjs`, `?still=` mode | renders, zero console errors. Found and fixed: an impact frame turned the whole frame white (`post.js`) |
| Live director (`lab/director.html`), all seven stations | `tools/qa/director-shots.mjs`, both backends | same picture on both backends, zero console errors |
| Island game after the restyle | `tools/qa/game-check.mjs`, both backends | opens, WASD moves, attack, seven zones visited, closes, zero console errors |
| Module imports | `tools/qa/check-imports.mjs` | 0 problems |

Sandbox notes: the only GPU is SwiftShader. WebGPU needs `--use-vulkan=swiftshader` (without `--disable-vulkan-surface`) and `?shim=swizzle`;
WebGPU canvases cannot be screenshotted, so the QA hooks (`?still=`, `director.snap()`) copy the canvas inside the render task.

## Not verified

* Real-GPU performance and any WebGPU-only visual difference (the head shading differs slightly between backends in one shot).
* The four game regression scenarios from `docs/ARCH.md` §8.4 (modal pauses the world, buddy behaviour, chamber sealed until 3 runes,
  no hits during dialog): only the smoke test above exists.
* Safari, Firefox, mobile hardware. The 390 px layout was checked in Chromium only.

## Deliberate cuts against docs/DESIGN.md

No live p5.brush ink overlay (the title underline is CSS), no ops room or armory sets (S2 to S4 reuse the hangar with camera moves;
the T0 poster tier covers them), no live catapult tile floor, WebM dropped (larger than MP4 here), impact/zoom-blur distortion only on
the full tier.
