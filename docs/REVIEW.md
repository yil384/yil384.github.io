# REVIEW.md

## Handoff status
- Done: research digests, concept judging, final docs/DESIGN.md, STORYBOARD.md (4 videos, 60 s), ARCH.md.
- Studio verified: p5.brush pipeline renders (studio/render.mjs, ~0.3–0.8 s/frame), budget counters render OK; studio/ANIMATION_GUIDE.md written.
- Unverified: assets/js/engine/* and lab/engine.html (engine agent stopped mid-QA; no clean console/screenshot pass on WebGL2 or WebGPU yet).
- Not started: studio/src/cast.js + props.js (K-01 mech, gantry, Unit-7, Pilot, Bit), the 4 videos, director/scenes, new index.html, game restyle.
- Next: 1) run lab/engine.html with ?webgl=1 and WebGPU via Playwright, fix errors; 2) build props.js/cast.js per DESIGN §4–5;
  3) author V1 "Sortie" per STORYBOARD, contact-sheet review, encode to assets/video; 4) director + scenes per ARCH.md;
  5) rebuild index.html, keep game regression contract (repo-audit §2.4); 6) QA both backends, 390 px, reduced motion; PR to main.
