# Opening animation: image art (Ninjago look)

The user (2026-10-07): the intro's ninja must not be drawn in code, it should look exactly like LEGO Ninjago
(幻影忍者) and fight Lord Garmadon (加满都), from images the user generates in the GPT web chat (no Codex / OpenAI key in
the cloud sessions). This is a deliberate exception to "original characters only", for the opening only.

Until the files exist, `assets/js/intro/scene.js` draws stand-ins (an original green ninja and "Lord Deadline"). The
slots live in `assets/js/intro/art.js`: when a file arrives, convert it to WebP, set `src`, tune the anchors (feet,
chest, beam point, eye points) and the `h` factors, check with `ART='{"hero":"…"}' node tools/dev/intro.mjs …`
(the env var tries files before they are switched on), then switch them on. With villain art the plate reads
LORD GARMADON (`ART.names.villainArt`).

| file (upload to `assets/img/intro/`) | slot | size | background |
|---|---|---|---|
| `hero.png` | `hero`: on the rooftop, full body | 1024x1536 | transparent |
| `hero-jump.png` | `heroJump`: mid-leap / spinning, full body | 1024x1536 | transparent |
| `hero-vs.png` | `heroVs`: VS card, waist up | 1024x1536 | transparent |
| `garmadon.png` | `villain`: rising behind the city, waist up | 1024x1536 | transparent |
| `garmadon-vs.png` | `villainVs`: VS card, waist up | 1024x1536 | transparent |
| `skyline.png` (optional) | `skyline`: the city | 1536x1024 | transparent sky preferred |

References worth attaching in the chat: the user's own green-ninja minifigure (`assets/video/intro-poster.jpg`) and
LEGO face (`assets/img/portrait-lego.webp`).

Style line, appended to every prompt: "3D LEGO minifigure render in the style of The LEGO Ninjago Movie, glossy
plastic, cinematic night lighting, strong rim light, crisp edges, no text, no watermark."

1. hero.png - "Lloyd, the Green Ninja from LEGO Ninjago, as a LEGO minifigure, exactly like the official design
   (green ninja suit, green hood and mask, gold trim, the gold dragon emblem), full body, standing in a low ready
   stance facing right, katana drawn and glowing green, green energy rim light from the right. Transparent
   background, whole figure in frame with a little margin, feet at the bottom."
2. hero-jump.png - "The same Lloyd minifigure leaping through the air facing right, knees tucked, katana raised,
   a swirl of green Spinjitzu energy around him. Transparent background, whole figure in frame."
3. hero-vs.png - "The same Lloyd minifigure, waist-up portrait for a fighting-game VS screen, 3/4 view facing
   right, confident pose, glowing green eyes behind the mask, green rim light. Transparent background, the body
   cut at the waist at the bottom edge."
4. garmadon.png - "Lord Garmadon from The LEGO Ninjago Movie as a LEGO minifigure, exactly like the official
   design (four arms, black skin, glowing red eyes, sharp grin, black spiked armour and helmet), waist-up, front
   view, giant and menacing, the upper arms raised with open hands, the lower hands together at his chest charging
   a ball of purple energy, purple rim light. Transparent background, body cut at the waist at the bottom edge."
5. garmadon-vs.png - "The same Lord Garmadon minifigure, waist-up portrait for a fighting-game VS screen, 3/4
   view facing left, arms crossed (all four), evil grin, red eyes, purple rim light. Transparent background, body
   cut at the waist at the bottom edge."
6. skyline.png - "Night skyline of LEGO Ninjago City merged with UC San Diego, built from LEGO bricks: the
   stacked vertical Ninjago City towers and pagoda roofs with paper lanterns and neon signs, and in the middle
   UC San Diego's Geisel Library (a brutalist inverted stepped pyramid of concrete floors with glowing window bands
   on a narrow base) with eucalyptus trees, a huge full moon. Wide shot from a rooftop, no characters. If possible a
   transparent sky above the buildings."
