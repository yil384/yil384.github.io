#!/usr/bin/env python3
"""Export the opening animation's image art (assets/img/intro/src/*.png, the user's GPT renders) to the WebP files
the page loads (assets/img/intro/*.webp), and print the anchors for assets/js/intro/art.js.

  python3 tools/dev/introart.py            # from the repo root

Per image: trim to the visible pixels (+ a small margin), scale to the size it is drawn at (bytes matter: the intro
loads these on a first visit), WebP with alpha. Anchors are fractions of the exported image:
  hero        foot = the balance point between the feet (bottom rows of the figure)
  hero-jump   centre of the body (opaque pixels, the energy swirl ignored)
  garmadon    beam = the energy ball between his lower hands (brightest blob), eyes = the two red eyes
The skyline's moon sits behind Geisel; the villain has to rise between the two, so the moon is cut out of the
skyline (skyline.webp) into its own sprite (moon.webp), placed by the same transform (moon = [cx, cy, r] of the
skyline). Geisel's roof and the trees in front of the disc stay in the skyline: in each column the moon ends at the
first dark pixel below its top part (the roof edge or a tree; the moon itself never gets that dark). The moon sprite
is a whole disc (the hidden part filled from the opposite side), so it also works away from the skyline.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'assets/img/intro/src')
OUT = os.path.join(ROOT, 'assets/img/intro')
Q = dict(quality=80, method=6, alpha_quality=85)


def load(name):
    return Image.open(os.path.join(SRC, name)).convert('RGBA')


def trim(im, margin=6, thresh=12):
    a = np.array(im)[..., 3]
    ys, xs = np.where(a > thresh)
    box = (max(0, xs.min() - margin), max(0, ys.min() - margin), min(im.width, xs.max() + 1 + margin), min(im.height, ys.max() + 1 + margin))
    return im.crop(box)


def fit_height(im, h):
    if im.height <= h:
        return im
    return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)


def save(im, name, **q):
    path = os.path.join(OUT, name)
    im.save(path, 'WEBP', **{**Q, **q})
    print(f'  {name:16s} {im.width}x{im.height}  {os.path.getsize(path) // 1024} KB')


def frac(x, y, im):
    return [round(float(x) / im.width, 3), round(float(y) / im.height, 3)]


def main():
    os.makedirs(OUT, exist_ok=True)
    anchors = {}

    hero = fit_height(trim(load('hero.png')), 640)
    a = np.array(hero)[..., 3]
    ys, xs = np.where(a > 200)
    bottom = ys.max()
    feet = xs[ys > bottom - hero.height * 0.05]
    anchors['hero.foot'] = frac(float(feet.mean()), bottom, hero)
    save(hero, 'hero.webp')

    jump = fit_height(trim(load('hero-jump.png')), 600)
    a = np.array(jump)
    solid = (a[..., 3] > 235) & (a[..., :3].astype(int).sum(2) < 600)   # the figure, not the glowing swirl
    ys, xs = np.where(solid)
    anchors['heroJump.centre'] = frac(np.median(xs), np.median(ys), jump)
    save(jump, 'hero-jump.webp', quality=74, alpha_quality=70)

    save(fit_height(trim(load('hero-vs.png'), margin=0), 1000), 'hero-vs.webp', quality=76)
    save(fit_height(trim(load('garmadon-vs.png'), margin=0), 1000), 'garmadon-vs.webp', quality=76)

    gar = fit_height(trim(load('garmadon.png'), margin=0), 1000)
    a = np.array(gar).astype(int)
    H = gar.height
    lum = a[..., :3].sum(2) / 3
    yy, xx = np.mgrid[0:H, 0:gar.width]
    ball = (lum > 235) & (a[..., 3] > 200) & (yy > H * 0.55) & (abs(xx - gar.width / 2) < gar.width * 0.2)
    anchors['villain.beam'] = frac(np.median(xx[ball]), np.median(yy[ball]), gar)
    red = (a[..., 0] > 200) & (a[..., 1] < 110) & (a[..., 2] < 110) & (a[..., 3] > 200) & (yy < H * 0.5)
    ex, ey = xx[red], yy[red]
    mid = np.median(ex)
    anchors['villain.eyes'] = [frac(ex[ex < mid].mean(), ey[ex < mid].mean(), gar), frac(ex[ex >= mid].mean(), ey[ex >= mid].mean(), gar)]
    save(gar, 'garmadon.webp', quality=76)

    # the skyline and its moon
    sky = load('skyline.png')
    s = np.array(sky).astype(float)
    lum = s[..., :3].mean(2)
    al = s[..., 3]
    pts = []
    for y in range(84, 262, 2):
        row = np.where((al[y] > 200) & (lum[y] > 115) & (np.arange(sky.width) > 860) & (np.arange(sky.width) < 1320))[0]
        if len(row):
            pts += [(row.min(), y), (row.max(), y)]
    P = np.array(pts, float)
    cx, cy, c = np.linalg.lstsq(np.c_[2 * P[:, 0], 2 * P[:, 1], np.ones(len(P))], (P ** 2).sum(1), rcond=None)[0]
    r = float(np.sqrt(c + cx * cx + cy * cy))
    yy, xx = np.mgrid[0:sky.height, 0:sky.width]
    d = np.hypot(xx - cx, yy - cy)
    disc = d < r + 6
    # in each column, the moon runs from the top of the disc down to the first dark pixel below y = cy (Geisel or trees)
    moon = np.zeros_like(disc)
    for x in range(int(cx - r - 3), int(cx + r + 4)):
        col = np.where(disc[:, x])[0]
        if not len(col):
            continue
        stop = col.max() + 1
        for y in col:
            # the roof edge (dark, or bluish where it is anti-aliased) or a tree; the moon is warm and bright
            if y > cy - r * 0.2 and al[y, x] > 200 and (lum[y, x] < 100 or s[y, x, 2] > s[y, x, 0] + 4):
                stop = y
                break
        moon[col.min():stop, x] = True
    moon &= disc
    # the cut takes the moon's soft rim too (a 3 px feather); the Geisel / tree side stays hard (drawn over anyway)
    edge = np.clip((r + 6 - d) / 3, 0, 1)
    keep = 1 - moon * edge
    out = s.copy()
    out[..., 3] = al * keep
    city = Image.fromarray(out.astype(np.uint8), 'RGBA')
    save(city, 'skyline.webp', quality=74)
    pad = 8
    box = (int(cx - r - pad), int(cy - r - pad), int(cx + r + pad + 1), int(cy + r + pad + 1))
    # the moon on its own is a whole disc: what Geisel and the trees hide is filled with the disc turned half a
    # turn (lit moon texture from the other side), so it can also hang anywhere in the sky (phones)
    m = s.copy()
    hidden = (disc & ~moon) | (disc & (lum < 110))   # what Geisel / the trees cover, and any dark speck they left
    hy, hx = np.where(hidden)
    ry = np.clip(np.round(2 * cy - hy).astype(int), 0, sky.height - 1)
    rx = np.clip(np.round(2 * cx - hx).astype(int), 0, sky.width - 1)
    m[hy, hx, :3] = s[ry, rx, :3]
    # soften the seam between the real moon and the fill (a blurred band along the boundary)
    band = np.zeros_like(hidden)
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            band |= np.roll(np.roll(hidden, dy, 0), dx, 1) & ~hidden
    band = (band | (hidden & ~np.roll(hidden, 3, 0)) | (hidden & ~np.roll(hidden, -3, 0))) & disc
    blurred = np.array(Image.fromarray(m[..., :3].astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2))).astype(float)
    m[band, :3] = blurred[band]
    m[..., 3] = 255 * np.clip((r + 1.5 - d) / 2.5, 0, 1)
    save(Image.fromarray(m.astype(np.uint8), 'RGBA').crop(box), 'moon.webp')
    anchors['skyline.moon'] = [round(float(cx) / sky.width, 4), round(float(cy) / sky.height, 4), round(r / sky.width, 4)]
    anchors['skyline.size'] = [sky.width, sky.height]

    print('anchors for art.js:')
    for k, v in anchors.items():
        print(f'  {k}: {v}')


if __name__ == '__main__':
    sys.exit(main())
