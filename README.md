# yil384.github.io

Personal homepage of Yichen Lin (Ph.D. student, UC San Diego CSE).

Plain HTML/CSS and native ES modules, no build step. The hero is a three.js (r186, WebGPU with
WebGL2 fallback) scene: a floating voxel island rendered from pixel-art definitions in
`assets/js/three/art.js`. Devices without a usable GPU keep a static poster.

```
index.html                 the page
assets/css/site.css        styles
assets/js/page.js          mounts the hero scene, wires the Play button
assets/js/three/           hero scene, voxel builder, renderer bootstrap, pixel art
assets/vendor/three/       three.js r0.186.1 (MIT), minified builds + the addons used
assets/logos/              organisation logos (belong to their owners; shown for identification)
assets/icons/              Simple Icons (CC0), Lucide (ISC), game-icons.net (CC BY 3.0)
assets/img/                favicon (rendered from the scholar sprite), photos, share image
```

Run locally with any static server, e.g. `python3 -m http.server 8000`.
