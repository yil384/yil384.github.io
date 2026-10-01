// Intro video compositor: three.js (WebGPURenderer, WebGL backend) renders the source frame through the comic shader
// with the virtual camera; q5 composites that frame and draws every overlay. render.mjs drives window.renderFrame(i).
import * as THREE from 'three/webgpu';
import { FPS, SIZE, SRC_W, SRC_H, FRAMES, CLIP_END, B, srcIndex, inOut, ramp } from './timeline.js';
import { initCamera, cameraAt, trackAt } from './camera.js';
import { comicMaterial } from './shader.js';
import { initOverlay, drawOverlay, gutterAt, panel } from './overlay.js';

const params = new URLSearchParams(location.search);
const SRC_URL = params.get('src') || '/__introvid_src/';

const info = document.getElementById('info');
const say = (m) => { info.textContent = m; };

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to load ' + url));
    img.src = url;
  });
}

// comic strength: full for the intro panel, fades as it comes alive, clean clip, full again for the outro panel
export function strengthAt(t) {
  if (t < CLIP_END) return 1 - inOut(ramp(t, B.alive, B.aliveEnd));
  return 1;
}

async function setup() {
  await Promise.all([document.fonts.load('400 40px Bangers'), document.fonts.load('700 30px "Comic Neue"')]);
  const track = await (await window.fetch('track.json')).json();
  initCamera(track);

  // three.js: an orthographic window over the source plane (world units = source px, y up)
  const renderer = new THREE.WebGPURenderer({ antialias: false, forceWebGL: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // raw values in, raw values out
  document.getElementById('three').appendChild(renderer.domElement);
  await renderer.init();

  const tex = new THREE.Texture();
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.flipY = true;
  const { mat, uStrength } = comicMaterial(tex);
  const scene = new THREE.Scene();
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(SRC_W, SRC_H), mat);
  plane.position.set(SRC_W / 2, SRC_H / 2, 0);
  scene.add(plane);
  const cam = new THREE.OrthographicCamera(-SIZE / 2, SIZE / 2, SIZE / 2, -SIZE / 2, 0.1, 100);
  cam.position.z = 10;
  const rt = new THREE.RenderTarget(SIZE, SIZE, { depthBuffer: false });
  rt.texture.colorSpace = THREE.NoColorSpace;

  // q5: the composed 720x720 frame
  const Q5 = window.Q5;
  Q5.canvasOptions = { alpha: false, colorSpace: 'srgb' };
  const q = new Q5('instance', document.getElementById('comp'));
  q.createCanvas(SIZE, SIZE);
  q.pixelDensity(1);
  q.noLoop();
  initOverlay(q);
  const shot = document.createElement('canvas');
  shot.width = shot.height = SIZE;
  const shotCtx = shot.getContext('2d');
  const imgData = shotCtx.createImageData(SIZE, SIZE);

  let curSrc = -1;
  async function renderAt(frame) {
    const t = frame / FPS;
    const si = srcIndex(t);
    if (si !== curSrc) {
      tex.image = await loadImage(`${SRC_URL}${String(si + 1).padStart(4, '0')}.jpg`);
      tex.needsUpdate = true;
      curSrc = si;
    }
    const c = cameraAt(t);
    const zoom = c.z;
    cam.left = -SIZE / 2 / zoom; cam.right = SIZE / 2 / zoom; cam.top = SIZE / 2 / zoom; cam.bottom = -SIZE / 2 / zoom;
    cam.position.set(c.cx, SRC_H - c.cy, 10);
    cam.rotation.set(0, 0, c.roll);
    cam.updateProjectionMatrix();
    uStrength.value = strengthAt(t);
    renderer.setRenderTarget(rt);
    await renderer.renderAsync(scene, cam);
    renderer.setRenderTarget(null);
    const px = await renderer.readRenderTargetPixelsAsync(rt, 0, 0, SIZE, SIZE);
    // WebGL reads bottom-up: flip rows into the 2D canvas
    const row = SIZE * 4;
    for (let y = 0; y < SIZE; y++) imgData.data.set(px.subarray((SIZE - 1 - y) * row, (SIZE - y) * row), y * row);
    shotCtx.putImageData(imgData, 0, 0);

    q.push();
    q.drawingContext.setTransform(1, 0, 0, 1, 0, 0);
    q.drawingContext.globalAlpha = 1;
    q.drawingContext.drawImage(shot, 0, 0);
    q.pop();
    drawOverlay(t, c, trackAt(t), frame);
    // the comic panel border sits on top of everything in the intro/outro
    const g = gutterAt(t);
    if (g > -6) panel(g);
    say(`frame ${frame} t=${t.toFixed(3)} src=${si} z=${c.z.toFixed(3)} cx=${c.cx.toFixed(0)} cy=${c.cy.toFixed(0)}`);
    return q.canvas;
  }

  window.renderFrame = async (i, type = 'image/png', quality) => (await renderAt(i)).toDataURL(type, quality);
  window.FRAMES = FRAMES;
  const t0 = params.get('t');
  if (t0 !== null) await renderAt(Math.round(parseFloat(t0) * FPS));
  return true;
}

window.ready = setup().catch((e) => { say('ERROR ' + e.message); console.error(e); throw e; });
