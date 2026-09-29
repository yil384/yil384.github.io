# Studio animation guide

The studio renders short 3D-anime / sci-fi shonen videos with p5.js + p5.brush, offline, in headless Chromium, and
encodes them with ffmpeg. It is a port of the ClaudeAnimationBase engine (MIT, see LICENSE-ClaudeAnimationBase) with a
cel-3D painter on top. This file is the contract for anyone writing a video: read all of it before writing a shot.

## 1. Files

| file | role |
|---|---|
| `studio.html` | loads p5, p5.brush, the engine, then `src/videos/<?video=name>.js`; `?loop=name`, `?t=sec`, `?render` |
| `src/core.js` | world, palette, timing, camera, effects, geometry, `paint`/`inkLine`, letters, paper/grain, `renderAt` |
| `src/timeline.js` | `movie()`, shot dispatch, `brushWipe`, `smashCut`, standalone `LOOPS` |
| `src/cel3d.js` | 3D camera, meshes, 3-tone cel painter, billboards, grid floor, motion streaks |
| `src/cast.js` | the painted 2D characters (key views, emotions, hooks) |
| `src/props.js` | cel-3D props (mech, ships, hangar, consoles) built from the mesh primitives |
| `src/videos/*.js` | one file per video; `_test.js`, `_bench.js`, `_wipe.js` are engine checks |
| `render.mjs` | Playwright renderer: contact sheets, stills, frame ranges, parallel workers, ffmpeg encode |

Everything is a plain script (no modules): every function in `core.js`, `cel3d.js`, `timeline.js`, `cast.js`, `props.js`
is a global. p5 globals are also present, so never name a function `box`, `cylinder`, `cone`, `quad`, `VIDEO`, `plane`,
`sphere`, `line`, `text`, `image`, `color`: p5 owns those.

## 2. The frame model

* World is **1920 × 1080**, drawn scaled by `PROJECT.scale` (default 2/3 → 1280 × 720 pixels). Coordinates are world px.
* A video is `movie(name, { duration, bpm, offset?, scale?, fps? }, [[t0, shotFn], [t1, shotFn], ...])`.
  Each shot is `fn(t, lt, dur)`: `t` video time, `lt` time since the shot began, `dur` the shot's length. The shot paints
  the whole frame: background first, then set, actors, effects, letters.
* **Frames are pure functions of time.** `render.mjs` draws frames in parallel and out of order. No state between frames,
  no `frameCount`, no accumulators, no `Math.random()` (use `hash(i)`, `jit(a)` after a `boilSeed(key)`).
* **Boil**: `boilSeed(key)` reseeds p5's random from a key plus a 12 Hz frame bucket. Call it before every element that
  uses `jit()`/`random()`; the same key gives the same wobble for that element between boil ticks, so lines shiver at
  12 Hz like a hand-drawn cel instead of buzzing at 24. Use one key per actor/prop (`boilSeed('mech')`).
* `onTwos(t)` snaps time to 12 fps: use it for character poses (animate on twos), never for camera moves or effects.
* Beat helpers: `bpOf(t)` beat position, `beatN(t)`, `pulse(t, k)` (decays after each beat), `pulse2` (half beats).
  Timing helpers: `seg(t, a, b)` 0→1 between a and b; `kf(t, [[t0, v0], [t1, v1], ...], easeFn)` keyframes (numbers or
  arrays); `ease/easeIn/easeOut/backOut/elasticOut`; `spring(t, t0, k, w)`, `ring(t, [t0, t1...])` decaying wobbles;
  `jump(t, t0, t1, h)` → `{dy, sq}` (anticipation squash, arc, landing squash); `take(t, t0, amt)` → `{sq, dy}` a
  surprise take; `stroll(t, t0, t1, x0, x1, u)` → `{x, walk, view, flip, dy}`; `arcPt(p0, p1, h, k)`.

## 3. Painting

* `paint(pts, opts)`: `pts` is a closed polygon `[[x, y], ...]`.
  * `wash: col, washOp` flat pigment fill (cheap: use freely).
  * `fill: col, fillOp, bleed, tex, border` watercolour fill (**expensive**, ≤ 3 per frame; never on shapes larger than
    the frame).
  * `hatch: { d, a, o, b, c, w }` hatching (spacing d, angle a). **Never** hatch big shapes with a fine brush; a hatch of long
    lines is millions of stamps and freezes the renderer.
  * `ink: col | null, sw, br, curv`: the outline (`null` = no outline). `br` is a brush name: `ink` (bold), `inkfine`,
    `dry` (rough, translucent), `neon` (clean, opaque). `curv` 0 = straight, 0.3–0.6 = curvy.
* `inkLine(pts, sw, col, br, curv)`: an open stroke. Two points → a straight line; more → a spline. Lines are clipped
  to the frame ± 240 px in screen space, so off-screen geometry costs nothing.
* Geometry: `rectPts(x, y, w, h, jit)`, `ellPts(cx, cy, rx, ry, n, jit, rot)`, `rrPts(x, y, w, h, r)`, `starPts(cx, cy,
  r, inner, n, rot)`, `polyPts(cx, cy, r, n, rot)`, `through(P, n)` smooth polyline through points, `ribbon(P, w0, w1)`
  a stroke polygon along a path, `offsetPts`, `scalePts`.
* Light cannot be painted with pigment (p5.brush mixes like paint), so light is additive: `glow(x, y, r, col, a)`,
  `streak(x, y, len, thick, col, a, rot)`. Both flush the brush queue; group them after the paint of a layer.
* Whole-frame effects: `flash(k, col)`, `impactFrame(k, col)` (two-colour frame), `letterbox(k, h)`, `iris(cx, cy, r)`,
  `irisShape(pts)`, `speedLines(cx, cy, k, n, col, sw)`.
* Camera: `camBegin(cx, cy, zoom, rot)` … `camEnd()`. Everything painted in between is seen through a 2D camera
  centred at `(cx, cy)`. `shakeXY(t, amt)` returns an offset for hits; `letter()` compensates automatically. Nest nothing:
  one camera per shot.
* Letters (Bebas Neue / Anton, composited over paint, under grain): `letter(txt, x, y, size, col, { tracking, rot, alpha,
  stroke, strokeW, ink:false, align })` and `sfx(txt, x, y, size, col, age, { life, rot })` for painted sound effects.
  **No text in videos** except the name card and a few SFX (`DON`, `ZAAA`, `GO`).

## 4. Cel-3D

* Camera: `const cam = cam3({ pos, look, fov, roll })`. `cam.project(p)` → `[sx, sy, depth]` (NaN behind the near plane),
  `cam.projectSeg(a, b)` → clipped 2D segment or null, `cam.scaleAt(p)` px per world unit.
* Meshes: `boxMesh(w, h, d, col, { base: true })`, `prismMesh(profile2D, depth, col)`, `latheMesh([[r, y], ...], n, col)`,
  `cylMesh(r, h, n, col)`, `coneMesh(r, h, n, col)`, `quadMesh(w, d, col)`, `mergeMesh(...)`, `placeMesh(mesh, xf({ pos,
  rot: [rx, ry, rz], scale }))`. Faces may carry `{ col, glow: true, op }`. Keep a part ≤ ~120 faces, a frame ≤ ~400.
* Paint: `cel3dPaint(cam, parts, { edges: 'silhouette' | 'all' | 'none', light: [x, y, z], fog: true, fogColor,
  jitter })`, where a part is `{ mesh, at: xf(...), key: 'boilKey', ink: col | null, sw, glow, noShade, op, crease,
  brush, thresholds, shadow: [x, y, z, r] }`. Parts sort far → near by centroid; faces sort within a part (convex parts
  only; split concave props into several parts). Shading is 3-tone from the light vector; `edges:'all'` adds crease ink
  (`crease` = cosine threshold, default .72).
* `billboard(cam, p, (sx, sy, scale, depth) => ...)`: draw a 2D character or sprite at a 3D point (scale = px per unit).
* `gridFloor(cam, y, step, n, col, sw)`, `motionStreaks(sx, sy, vx, vy, len, n, col, sw)`.
* Set the light per shot (`light: [.5, .6, .7]` = key from upper-right-front); keep it constant within a shot.

## 5. Transitions

* `brushWipe(p, [c1, c2])`: fat strokes sweep in (p 0 → .5) and drag off (.5 → 1). Cut under full cover:
  end of shot A: `if (lt > dur - .3) brushWipe((lt - (dur - .3)) / .6);` start of shot B: `if (lt < .3) brushWipe(.5 + lt / .6);`
* `smashCut(lt, dur, col)`: a 2-frame flash on the cut.
* `iris(cx, cy, r)` close-in / open-out; `flash(k)` for impacts; `letterbox(k)` for "cinema" moments.
* Costs: a wipe frame ≈ 0.75 s, a normal frame ≈ 0.3 s at 1280 × 720 on the render box.

## 6. Direction rules (from the ClaudeAnimationBase guide, kept)

1. **One read per shot.** Every shot has one thing the eye must get; everything else is quiet. 0.6–1.2 s per read.
2. **Anticipation → action → settle.** Squash before a jump, hold on the pose, overshoot and ring on landing.
3. **Smears and multiples on fast moves** (`motionStreaks`, a second ghost copy at 40 % opacity), never motion blur.
4. **Cuts on the beat.** Shot boundaries fall on `bpOf(t)` integers; impacts on the downbeat; hold the still 6 frames after.
5. **Camera is a character.** Slow push-ins on faces, whip pans (`camBegin` rotation + speedLines) into action, no drift.
6. **Colour arc.** Each video moves through 2–3 palettes (night → amber ignition → cyan burn). Wash the background with
   the current palette; keep character key colours constant so they read across cuts.
7. **Hold the money frame.** The EVENT (launch, hit, reveal) gets an impact frame (2 frames), a flash, then a 12-frame hold.
8. **Silhouette first.** Characters and mechs must read as black shapes. Test with `ink` only.
9. **No text, no UI, no lorem.** The name card is the only lettering (plus ≤ 3 SFX per video).
10. **Loops** must close: `LOOPS.name = t => ...` with `t` in `[0, duration)` and the last frame flowing into the first.

## 7. Rendering

```
node render.mjs --video=hangar --sheet=0,1,2,3,4,5,6,7,8   # contact sheet → out/sheets/hangar.jpg
node render.mjs --video=hangar --stills=2.5,6.0            # single frames
node render.mjs --video=hangar --frames --workers=3 --encode --out=../assets/video/hangar   # MP4 + WebM + poster
```

Review every contact sheet with the Read tool before rendering frames. A frame that throws `paint(): non-finite point`
means a point went behind the 3D camera without clipping (use `projectSeg`/`billboard`, not raw `project`).
