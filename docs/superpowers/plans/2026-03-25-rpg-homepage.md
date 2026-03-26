# RPG Interactive Academic Homepage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform a static academic homepage into a pixel-art RPG-themed interactive single-page website.

**Architecture:** Single `index.html` file with all CSS in a `<style>` block and all JS in a `<script>` block at the end of body. No build tools, no frameworks. Incremental construction — each task produces a viewable page.

**Tech Stack:** Vanilla HTML/CSS/JS, Google Fonts (Press Start 2P), GitHub Pages hosting.

**Spec:** `docs/superpowers/specs/2026-03-25-rpg-homepage-design.md`

**Existing files:**
- `index.html` — current site (will be fully rewritten)
- `static/selfpic_yichenlin.jpg` — profile photo (keep as-is)

---

### Task 1: Base Scaffold and CSS Foundation

**Files:**
- Rewrite: `index.html`

Build the empty page shell with all CSS custom properties, the pixel font, reset styles, and the dark theme. No visible content sections yet — just a dark page with the font loaded.

- [ ] **Step 1: Write the base HTML shell**

Replace `index.html` with the document skeleton:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yichen Lin | RPG Portfolio</title>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
  <style>
    /* -- Reset & Base -- */
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #0f0f23;
      --bg-card: rgba(255,255,255,0.03);
      --border: #334155;
      --gold: #ffd700;
      --gold-dim: rgba(255,215,0,0.15);
      --green: #4ade80;
      --blue: #60a5fa;
      --purple: #818cf8;
      --orange: #f97316;
      --red: #ef4444;
      --text: #e2e8f0;
      --text-dim: #94a3b8;
      --text-muted: #64748b;
      --font-pixel: 'Press Start 2P', monospace;
      --font-body: 'Segoe UI', system-ui, sans-serif;
    }
    html { scroll-behavior: smooth; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-body);
      overflow-x: hidden;
      line-height: 1.6;
    }
    /* -- Utility -- */
    .pixel-font { font-family: var(--font-pixel); }
    .gold { color: var(--gold); }
    .section {
      max-width: 800px;
      margin: 0 auto;
      padding: 60px 24px;
    }
    .section-title {
      font-family: var(--font-pixel);
      font-size: 14px;
      color: var(--gold);
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .section-title::after {
      content: '';
      flex: 1;
      height: 2px;
      background: linear-gradient(90deg, var(--gold), transparent);
    }
    .pixel-border {
      border: 2px solid var(--border);
      background: var(--bg-card);
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <!-- Content sections will be added in subsequent tasks -->
  <script>
    // JS will be added in subsequent tasks
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify in browser**

Open `index.html` in a browser. Confirm: dark background (#0f0f23), no content visible, no console errors, pixel font loads (check Network tab).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: scaffold RPG homepage with CSS foundation and dark theme"
```

---

### Task 2: Title Screen

**Files:**
- Modify: `index.html`

Add the full-screen RPG title screen with twinkling stars, golden name, and blinking "PRESS ENTER" prompt. The title screen covers the viewport and dismisses on click/Enter/3-second timeout.

- [ ] **Step 1: Add title screen HTML**

Insert before the `<script>` tag:

```html
<!-- Title Screen -->
<div id="title-screen">
  <div id="stars"></div>
  <div class="title-content">
    <h1 class="title-name">YICHEN LIN</h1>
    <p class="title-subtitle">PhD Student · UCSD CSE</p>
    <p class="title-prompt">— PRESS ENTER —</p>
  </div>
  <button id="music-toggle" class="pixel-font" aria-label="Toggle music" title="Music (no audio loaded)">🔇</button>
</div>

<!-- Main Content (hidden initially) -->
<div id="main-content" style="display:none;">
</div>
```

- [ ] **Step 2: Add title screen CSS**

Add inside the `<style>` block:

```css
/* -- Title Screen -- */
#title-screen {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: radial-gradient(ellipse at center, #1a1a3e 0%, var(--bg) 70%);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.8s ease, transform 0.8s ease;
}
#title-screen.dismissed {
  opacity: 0;
  transform: translateY(-40px);
  pointer-events: none;
}
#stars {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.star {
  position: absolute;
  width: 2px;
  height: 2px;
  background: white;
  border-radius: 50%;
  animation: twinkle var(--duration) ease-in-out infinite;
}
@keyframes twinkle {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 1; }
}
.title-content { text-align: center; z-index: 1; }
.title-name {
  font-family: var(--font-pixel);
  font-size: clamp(20px, 5vw, 36px);
  color: var(--gold);
  text-shadow: 0 0 20px rgba(255,215,0,0.4), 0 0 60px rgba(255,215,0,0.2);
  animation: glow 3s ease-in-out infinite;
}
@keyframes glow {
  0%, 100% { text-shadow: 0 0 20px rgba(255,215,0,0.4), 0 0 60px rgba(255,215,0,0.2); }
  50% { text-shadow: 0 0 30px rgba(255,215,0,0.6), 0 0 80px rgba(255,215,0,0.3); }
}
.title-subtitle {
  font-family: var(--font-pixel);
  font-size: clamp(8px, 2vw, 12px);
  color: var(--purple);
  margin-top: 16px;
}
.title-prompt {
  font-family: var(--font-pixel);
  font-size: clamp(8px, 1.5vw, 11px);
  color: var(--text-muted);
  margin-top: 40px;
  animation: blink 1.2s step-end infinite;
}
#music-toggle {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 16px;
  padding: 6px 10px;
  cursor: pointer;
  border-radius: 4px;
  z-index: 1;
}
#music-toggle:hover { border-color: var(--gold); color: var(--gold); }
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
```

- [ ] **Step 3: Add title screen JS**

Add inside the `<script>` block:

```javascript
// -- Stars --
(function createStars() {
  const container = document.getElementById('stars');
  for (let i = 0; i < 50; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.setProperty('--duration', (2 + Math.random() * 3) + 's');
    star.style.animationDelay = Math.random() * 3 + 's';
    container.appendChild(star);
  }
})();

// -- Title Screen Dismiss --
let titleDismissed = false;
const onTitleDismissCallbacks = [];
function dismissTitle() {
  if (titleDismissed) return;
  titleDismissed = true;
  const ts = document.getElementById('title-screen');
  const mc = document.getElementById('main-content');
  ts.classList.add('dismissed');
  mc.style.display = 'block';
  setTimeout(() => ts.style.display = 'none', 800);
  onTitleDismissCallbacks.forEach(cb => cb());
}

document.getElementById('title-screen').addEventListener('click', dismissTitle);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !titleDismissed) dismissTitle();
});
setTimeout(dismissTitle, 3000);
```

- [ ] **Step 4: Verify in browser**

Open page. Confirm: full-screen dark background with twinkling stars, "YICHEN LIN" in gold pixel font with glow, subtitle in purple, blinking "PRESS ENTER". Click or press Enter — screen fades out. Auto-dismisses after 3 seconds.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add RPG title screen with stars and dismissal"
```

---

### Task 3: Fixed Status Bar

**Files:**
- Modify: `index.html`

Add the sticky RPG status bar with HP/MP/EXP bars. EXP fills based on scroll progress. Includes a menu button that opens a navigation overlay.

- [ ] **Step 1: Add status bar HTML**

Insert at the beginning of `#main-content`:

```html
<!-- Status Bar -->
<nav id="status-bar">
  <div class="status-bar-inner">
    <span class="bar-group"><span class="bar-label green">HP</span><span class="bar-track"><span class="bar-fill" id="hp-bar" style="width:85%;background:var(--green);"></span></span></span>
    <span class="bar-group"><span class="bar-label purple">MP</span><span class="bar-track"><span class="bar-fill" id="mp-bar" style="width:65%;background:var(--purple);"></span></span></span>
    <span class="bar-group"><span class="bar-label gold">EXP</span><span class="bar-track"><span class="bar-fill" id="exp-bar" style="width:0%;background:var(--gold);"></span></span></span>
    <span class="level-badge pixel-font">Lv.25</span>
    <button id="menu-btn" class="pixel-font" aria-label="Menu">☰</button>
  </div>
</nav>

<!-- Navigation Menu Overlay -->
<div id="nav-menu" class="hidden">
  <div class="nav-menu-inner pixel-border">
    <div class="nav-menu-title pixel-font gold">MENU</div>
    <a href="#character" class="nav-item" data-close>▶ Character</a>
    <a href="#skill-tree" class="nav-item" data-close>▶ Skill Tree</a>
    <a href="#attributes" class="nav-item" data-close>▶ Attributes</a>
    <a href="#achievements" class="nav-item" data-close>▶ Achievements</a>
    <a href="#quests" class="nav-item" data-close>▶ Quest Log</a>
    <a href="#equipment" class="nav-item" data-close>▶ Equipment</a>
    <a href="#portals" class="nav-item" data-close>▶ Portals</a>
  </div>
</div>
```

- [ ] **Step 2: Add status bar CSS**

```css
/* -- Status Bar -- */
#status-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(15,15,35,0.85);
  backdrop-filter: blur(8px);
  border-bottom: 2px solid var(--gold);
  padding: 8px 16px;
}
.status-bar-inner {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
}
.bar-group { display: flex; align-items: center; gap: 6px; flex: 1; }
.bar-label {
  font-family: var(--font-pixel);
  font-size: 8px;
  min-width: 24px;
}
.bar-label.green { color: var(--green); }
.bar-label.purple { color: var(--purple); }
.bar-label.gold { color: var(--gold); }
.bar-track {
  flex: 1;
  height: 8px;
  background: #1e293b;
  border-radius: 2px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}
.level-badge {
  font-size: 9px;
  color: var(--gold);
  white-space: nowrap;
}
#menu-btn {
  background: none;
  border: 1px solid var(--border);
  color: var(--gold);
  font-size: 12px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
}
#menu-btn:hover { border-color: var(--gold); }

/* -- Nav Menu -- */
#nav-menu {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease;
}
#nav-menu.hidden { display: none; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.nav-menu-inner {
  padding: 24px 32px;
  min-width: 240px;
}
.nav-menu-title {
  font-size: 12px;
  text-align: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.nav-item {
  display: block;
  font-family: var(--font-pixel);
  font-size: 10px;
  color: var(--text);
  text-decoration: none;
  padding: 10px 8px;
  border-radius: 4px;
  transition: background 0.15s;
}
.nav-item:hover {
  background: var(--gold-dim);
  color: var(--gold);
}
```

- [ ] **Step 3: Add status bar JS**

Add to the `<script>` block:

```javascript
// -- EXP bar scroll tracking --
window.addEventListener('scroll', () => {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = docHeight > 0 ? Math.min(scrollTop / docHeight * 100, 100) : 0;
  document.getElementById('exp-bar').style.width = progress + '%';
});

// -- Menu toggle --
const menuBtn = document.getElementById('menu-btn');
const navMenu = document.getElementById('nav-menu');
menuBtn.addEventListener('click', () => navMenu.classList.toggle('hidden'));
navMenu.addEventListener('click', (e) => {
  if (e.target === navMenu || e.target.hasAttribute('data-close')) {
    navMenu.classList.add('hidden');
  }
});
```

- [ ] **Step 4: Verify in browser**

Dismiss title screen. Confirm: gold-bordered status bar at top with HP (green, 85%), MP (purple, 65%), EXP (gold, starts at 0%). Menu button opens overlay with section links. (Sections don't exist yet so links won't scroll anywhere.)

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add sticky RPG status bar with EXP scroll tracking and nav menu"
```

---

### Task 4: Character Card Section

**Files:**
- Modify: `index.html`

Add the character sheet section with pixelated avatar, name, class, guild info, and contact details.

- [ ] **Step 1: Add character card HTML**

Insert inside `#main-content`, after the nav-menu div:

```html
<!-- Character Card -->
<section id="character" class="section anim-target">
  <div class="section-title">CHARACTER</div>
  <div class="char-card pixel-border">
    <div class="char-avatar-wrap">
      <img src="./static/selfpic_yichenlin.jpg" alt="Yichen Lin" class="char-avatar">
      <div class="char-avatar-border"></div>
    </div>
    <div class="char-info">
      <div class="char-name pixel-font gold">YICHEN LIN</div>
      <div class="char-class"><span class="purple">Class:</span> Scholar ✦✦✦</div>
      <div class="char-detail"><span class="text-dim">Guild:</span> UC San Diego · CSE Dept</div>
      <div class="char-detail"><span class="text-dim">Mentor:</span> Prof. Yufei Ding</div>
      <div class="char-detail"><span class="text-dim">Phone:</span> (858) 319-7361</div>
      <div class="char-detail"><span class="blue">✉</span> <a href="mailto:yil384@ucsd.edu" class="char-link">yil384@ucsd.edu</a></div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add character card CSS**

```css
/* -- Character Card -- */
.char-card {
  display: flex;
  gap: 24px;
  padding: 24px;
  align-items: center;
}
.char-avatar-wrap {
  position: relative;
  width: 120px;
  height: 120px;
  flex-shrink: 0;
}
.char-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
  image-rendering: pixelated;
  filter: contrast(1.1);
  transition: image-rendering 0.3s, filter 0.3s;
}
.char-avatar-wrap:hover .char-avatar {
  image-rendering: auto;
  filter: none;
}
.char-avatar-border {
  position: absolute;
  inset: -4px;
  border: 3px solid var(--gold);
  border-radius: 6px;
  pointer-events: none;
  box-shadow: 0 0 12px rgba(255,215,0,0.2);
}
.char-info { flex: 1; }
.char-name { font-size: 16px; margin-bottom: 12px; }
.char-class { font-family: var(--font-pixel); font-size: 10px; margin-bottom: 8px; color: var(--text); }
.char-detail { font-size: 14px; margin-bottom: 4px; color: var(--text); }
.char-link { color: var(--blue); text-decoration: none; }
.char-link:hover { text-decoration: underline; }
.text-dim { color: var(--text-dim); }
.purple { color: var(--purple); }
.blue { color: var(--blue); }
```

- [ ] **Step 3: Verify in browser**

Dismiss title, scroll down. Confirm: character card with pixelated photo (clears on hover), gold border, name in gold pixel font, class/guild/contact info. Links work.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add RPG character card section with pixelated avatar"
```

---

### Task 5: Skill Tree Section (Education)

**Files:**
- Modify: `index.html`

Add education history as two connected nodes with an animated golden line.

- [ ] **Step 1: Add skill tree HTML**

Insert after the character section:

```html
<!-- Skill Tree (Education) -->
<section id="skill-tree" class="section anim-target">
  <div class="section-title">SKILL TREE</div>
  <div class="tree-path">
    <div class="tree-node pixel-border">
      <div class="tree-node-icon">🏛️</div>
      <div class="tree-node-name pixel-font">Tsinghua University</div>
      <div class="tree-node-detail">B.S. Computer Science and Technology</div>
      <div class="tree-node-date">2021 – 2025</div>
    </div>
    <div class="tree-line">
      <div class="tree-line-fill"></div>
      <div class="tree-arrow">▶</div>
    </div>
    <div class="tree-node pixel-border">
      <div class="tree-node-icon">🔬</div>
      <div class="tree-node-name pixel-font">UC San Diego</div>
      <div class="tree-node-detail">Ph.D. Computer Science and Engineering</div>
      <div class="tree-node-detail">Advisor: Prof. Yufei Ding</div>
      <div class="tree-node-date">2025 – Now</div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add skill tree CSS**

```css
/* -- Skill Tree -- */
.tree-path {
  display: flex;
  align-items: center;
  gap: 0;
}
.tree-node {
  flex: 1;
  padding: 20px;
  text-align: center;
  transition: box-shadow 0.3s;
}
.tree-node:hover { box-shadow: 0 0 16px rgba(255,215,0,0.2); }
.tree-node-icon { font-size: 28px; margin-bottom: 8px; }
.tree-node-name { font-size: 10px; color: var(--gold); margin-bottom: 8px; }
.tree-node-detail { font-size: 13px; color: var(--text-dim); margin-bottom: 4px; }
.tree-node-date { font-family: var(--font-pixel); font-size: 8px; color: var(--text-muted); margin-top: 8px; }
.tree-line {
  width: 80px;
  display: flex;
  align-items: center;
  position: relative;
  flex-shrink: 0;
}
.tree-line-fill {
  height: 3px;
  background: var(--gold);
  width: 0%;
  transition: width 1s ease;
  box-shadow: 0 0 8px rgba(255,215,0,0.4);
}
.tree-line.animated .tree-line-fill { width: 100%; }
.tree-arrow {
  color: var(--gold);
  font-size: 12px;
  position: absolute;
  right: -4px;
  opacity: 0;
  transition: opacity 0.3s ease 0.8s;
}
.tree-line.animated .tree-arrow { opacity: 1; }

@media (max-width: 600px) {
  .tree-path { flex-direction: column; }
  .tree-line {
    width: 3px;
    height: 40px;
    flex-direction: column;
    justify-content: center;
  }
  .tree-line-fill { width: 3px; height: 0%; }
  .tree-line.animated .tree-line-fill { height: 100%; }
  .tree-arrow { right: auto; bottom: -4px; transform: rotate(90deg); }
}
```

- [ ] **Step 3: Verify in browser**

Confirm: two nodes side by side (Tsinghua → UCSD), gold connecting line (static for now — animation will be wired in Task 11). Nodes glow on hover. Stacks vertically on mobile.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add education skill tree with connected nodes"
```

---

### Task 6: Attributes Section (Programming Skills)

**Files:**
- Modify: `index.html`

Add programming skill bars and tool badges.

- [ ] **Step 1: Add attributes HTML**

Insert after skill tree section:

```html
<!-- Attributes (Skills) -->
<section id="attributes" class="section anim-target">
  <div class="section-title">ATTRIBUTES</div>
  <div class="pixel-border" style="padding:24px;">
    <div class="attr-row" data-level="90">
      <span class="attr-name pixel-font">Python</span>
      <span class="attr-bar"><span class="attr-fill" style="--color:var(--green);"></span></span>
      <span class="attr-lv pixel-font">Lv.9</span>
    </div>
    <div class="attr-row" data-level="85">
      <span class="attr-name pixel-font">C++</span>
      <span class="attr-bar"><span class="attr-fill" style="--color:var(--blue);"></span></span>
      <span class="attr-lv pixel-font">Lv.8</span>
    </div>
    <div class="attr-row" data-level="70">
      <span class="attr-name pixel-font">Go</span>
      <span class="attr-bar"><span class="attr-fill" style="--color:var(--purple);"></span></span>
      <span class="attr-lv pixel-font">Lv.7</span>
    </div>
    <div class="attr-row" data-level="75">
      <span class="attr-name pixel-font">Rust</span>
      <span class="attr-bar"><span class="attr-fill" style="--color:var(--orange);"></span></span>
      <span class="attr-lv pixel-font">Lv.7</span>
    </div>
    <div class="attr-row" data-level="65">
      <span class="attr-name pixel-font">TypeScript</span>
      <span class="attr-bar"><span class="attr-fill" style="--color:#06b6d4;"></span></span>
      <span class="attr-lv pixel-font">Lv.6</span>
    </div>
    <div class="attr-row" data-level="60">
      <span class="attr-name pixel-font">JavaScript</span>
      <span class="attr-bar"><span class="attr-fill" style="--color:#eab308;"></span></span>
      <span class="attr-lv pixel-font">Lv.6</span>
    </div>
    <div class="attr-row" data-level="50">
      <span class="attr-name pixel-font">Verilog</span>
      <span class="attr-bar"><span class="attr-fill" style="--color:var(--red);"></span></span>
      <span class="attr-lv pixel-font">Lv.5</span>
    </div>

    <div class="tool-badges">
      <span class="tool-badge pixel-font">Linux</span>
      <span class="tool-badge pixel-font">Vim</span>
      <span class="tool-badge pixel-font">LaTeX</span>
      <span class="tool-badge pixel-font">WebSocket</span>
      <span class="tool-badge pixel-font">Django</span>
      <span class="tool-badge pixel-font">MongoDB</span>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add attributes CSS**

```css
/* -- Attributes -- */
.attr-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.attr-name { font-size: 8px; color: var(--text-dim); min-width: 90px; }
.attr-bar { flex: 1; height: 12px; background: #1e293b; border-radius: 2px; overflow: hidden; }
.attr-fill {
  height: 100%;
  width: 0%;
  background: var(--color);
  border-radius: 2px;
  transition: width 1.2s ease;
}
.attr-lv { font-size: 8px; color: var(--gold); min-width: 36px; text-align: right; }
.tool-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.tool-badge {
  font-size: 7px;
  color: var(--text-dim);
  border: 1px solid var(--border);
  padding: 4px 10px;
  border-radius: 2px;
  transition: border-color 0.2s, color 0.2s;
}
.tool-badge:hover { border-color: var(--gold); color: var(--gold); }
```

- [ ] **Step 3: Verify in browser**

Confirm: 7 skill bars with labels and levels, each a different color. Bars at 0% width (animation wired in Task 11). Tool badges below in a flex row. Hover highlights badges.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add attributes section with skill bars and tool badges"
```

---

### Task 7: Achievements Section (Publications)

**Files:**
- Modify: `index.html`

Add publications as achievement badge cards with trophy icons.

- [ ] **Step 1: Add achievements HTML**

Insert after attributes section:

```html
<!-- Achievements (Publications) -->
<section id="achievements" class="section anim-target">
  <div class="section-title">ACHIEVEMENTS</div>
  <div class="achievement-list">
    <div class="achievement-card pixel-border anim-target" data-rarity="silver">
      <div class="ach-icon">🥈</div>
      <div class="ach-body">
        <div class="ach-name pixel-font">TRITONGYM</div>
        <div class="ach-desc">A Benchmark for Agentic LLM Workflows in Triton GPU Code Generation</div>
        <div class="ach-authors">Yue Guan*, <span class="gold">Yichen Lin*</span>, et al.</div>
        <div class="ach-venue pixel-font">In submission to ICLR 2026</div>
      </div>
    </div>
    <div class="achievement-card pixel-border anim-target" data-rarity="gold">
      <div class="ach-icon">🏆</div>
      <div class="ach-body">
        <div class="ach-name pixel-font">(Re)²H₂O</div>
        <div class="ach-desc">Autonomous Driving Scenario Generation via Reversely Regularized Hybrid Offline-and-Online RL</div>
        <div class="ach-authors">Haoyi Niu*, Kun Ren*, <span class="gold">Yichen Lin</span>, et al.</div>
        <div class="ach-venue pixel-font">IEEE IV 2023</div>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add achievements CSS**

```css
/* -- Achievements -- */
.achievement-list { display: flex; flex-direction: column; gap: 16px; }
.achievement-card {
  display: flex;
  gap: 16px;
  padding: 20px;
  transition: box-shadow 0.3s;
  position: relative;
  overflow: hidden;
}
.achievement-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 40%, rgba(255,215,0,0.06) 45%, transparent 50%);
  background-size: 250% 100%;
  transition: background-position 0.6s;
}
.achievement-card:hover::after { background-position: -100% 0; }
.achievement-card:hover { box-shadow: 0 0 20px rgba(255,215,0,0.15); }
.achievement-card[data-rarity="gold"] { border-color: rgba(255,215,0,0.3); }
.achievement-card[data-rarity="silver"] { border-color: rgba(192,192,192,0.3); }
.ach-icon { font-size: 36px; flex-shrink: 0; }
.ach-body { flex: 1; }
.ach-name { font-size: 10px; color: var(--gold); margin-bottom: 8px; }
.ach-desc { font-size: 13px; color: var(--text); margin-bottom: 6px; line-height: 1.5; }
.ach-authors { font-size: 12px; color: var(--text-dim); margin-bottom: 6px; }
.ach-venue { font-size: 8px; color: var(--text-muted); }
```

- [ ] **Step 3: Verify in browser**

Confirm: two achievement cards — TritonGym with silver medal, (Re)²H₂O with gold medal. Golden shimmer sweep on hover. Author's name highlighted in gold.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add achievements section for publications"
```

---

### Task 8: Quest Log Section (Internships)

**Files:**
- Modify: `index.html`

Add internships as expandable quest cards with completion badges.

- [ ] **Step 1: Add quest log HTML**

Insert after achievements section:

```html
<!-- Quest Log (Internships) -->
<section id="quests" class="section anim-target">
  <div class="section-title">QUEST LOG</div>
  <div class="quest-list">
    <div class="quest-card pixel-border anim-target">
      <div class="quest-header" onclick="this.parentElement.classList.toggle('expanded')">
        <span class="quest-icon">⚔️</span>
        <div class="quest-meta">
          <div class="quest-name pixel-font">PICASSO LAB (UCSD CSE)</div>
          <div class="quest-role">Research Intern · <span class="text-dim">Mar 2024 – Feb 2025</span></div>
        </div>
        <span class="quest-badge quest-complete pixel-font">✓ COMPLETE</span>
      </div>
      <div class="quest-details">
        <ul>
          <li>Developed a CXL system simulator for large model communication.</li>
          <li>Helped set up lab websites and use RAG to parse academic papers.</li>
        </ul>
      </div>
    </div>
    <div class="quest-card pixel-border anim-target">
      <div class="quest-header" onclick="this.parentElement.classList.toggle('expanded')">
        <span class="quest-icon">⚔️</span>
        <div class="quest-meta">
          <div class="quest-name pixel-font">METABIT</div>
          <div class="quest-role">Quantitative Developer Intern · <span class="text-dim">Sep 2024 – Nov 2024</span></div>
        </div>
        <span class="quest-badge quest-complete pixel-font">✓ COMPLETE</span>
      </div>
      <div class="quest-details">
        <ul>
          <li>Optimized data parsing and added streaming read support for AI Platform.</li>
        </ul>
      </div>
    </div>
    <div class="quest-card pixel-border anim-target">
      <div class="quest-header" onclick="this.parentElement.classList.toggle('expanded')">
        <span class="quest-icon">⚔️</span>
        <div class="quest-meta">
          <div class="quest-name pixel-font">TENCENT (TIMI STUDIO)</div>
          <div class="quest-role">Game Developer Intern · <span class="text-dim">Jun 2024 – Jul 2024</span></div>
        </div>
        <span class="quest-badge quest-complete pixel-font">✓ COMPLETE</span>
      </div>
      <div class="quest-details">
        <ul>
          <li>Developed Monster Hunter mobile game client with voice-controlled teammates.</li>
        </ul>
      </div>
    </div>
    <div class="quest-card pixel-border anim-target">
      <div class="quest-header" onclick="this.parentElement.classList.toggle('expanded')">
        <span class="quest-icon">⚔️</span>
        <div class="quest-meta">
          <div class="quest-name pixel-font">DISNEY+ HOTSTAR</div>
          <div class="quest-role">Algorithm Developer Intern · <span class="text-dim">Mar 2024 – Jun 2024</span></div>
        </div>
        <span class="quest-badge quest-complete pixel-font">✓ COMPLETE</span>
      </div>
      <div class="quest-details">
        <ul>
          <li>Optimized search page, fine-tuned recommendation model for TPUs.</li>
        </ul>
      </div>
    </div>
    <div class="quest-card pixel-border anim-target">
      <div class="quest-header" onclick="this.parentElement.classList.toggle('expanded')">
        <span class="quest-icon">⚔️</span>
        <div class="quest-meta">
          <div class="quest-name pixel-font">BYTEDANCE LARK</div>
          <div class="quest-role">Backend Developer Intern · <span class="text-dim">Jun 2023 – Nov 2023</span></div>
        </div>
        <span class="quest-badge quest-complete pixel-font">✓ COMPLETE</span>
      </div>
      <div class="quest-details">
        <ul>
          <li>Developed AskAI assistant using Redis and RocketMQ for sales data analysis.</li>
        </ul>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add quest log CSS**

```css
/* -- Quest Log -- */
.quest-list { display: flex; flex-direction: column; gap: 12px; }
.quest-card { overflow: hidden; }
.quest-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  cursor: pointer;
  transition: background 0.2s;
}
.quest-header:hover { background: rgba(255,255,255,0.02); }
.quest-icon { font-size: 20px; flex-shrink: 0; }
.quest-meta { flex: 1; }
.quest-name { font-size: 9px; color: var(--blue); margin-bottom: 4px; }
.quest-role { font-size: 13px; color: var(--text); }
.quest-badge {
  font-size: 7px;
  padding: 4px 10px;
  border-radius: 2px;
  white-space: nowrap;
  flex-shrink: 0;
}
.quest-complete {
  background: rgba(74,222,128,0.12);
  color: var(--green);
  border: 1px solid rgba(74,222,128,0.25);
}
.quest-details {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease, padding 0.3s ease;
  padding: 0 16px;
}
.quest-card.expanded .quest-details {
  max-height: 200px;
  padding: 0 16px 16px;
}
.quest-details ul {
  list-style: none;
  padding-left: 32px;
}
.quest-details li {
  position: relative;
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 6px;
  line-height: 1.5;
}
.quest-details li::before {
  content: '▸';
  position: absolute;
  left: -16px;
  color: var(--gold);
}
```

- [ ] **Step 3: Verify in browser**

Confirm: five quest cards stacked vertically, each showing company name in blue, role, and green "COMPLETE" badge. Clicking a card expands to show bullet points. Clicking again collapses.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add quest log section with expandable internship cards"
```

---

### Task 9: Equipment Section (Projects)

**Files:**
- Modify: `index.html`

Add projects as flippable RPG equipment cards in a 2x2 grid.

- [ ] **Step 1: Add equipment HTML**

Insert after quest log section:

```html
<!-- Equipment (Projects) -->
<section id="equipment" class="section anim-target">
  <div class="section-title">EQUIPMENT</div>
  <div class="equip-grid">
    <div class="equip-card anim-target">
      <div class="equip-inner">
        <div class="equip-front pixel-border">
          <div class="equip-icon">🗡️</div>
          <div class="equip-name pixel-font">Starry-Next</div>
          <div class="equip-desc">Monolithic Kernel OS</div>
          <div class="equip-rarity pixel-font epic">EPIC</div>
        </div>
        <div class="equip-back pixel-border">
          <div class="equip-back-title pixel-font gold">Starry-Next</div>
          <p class="equip-back-desc">Implemented networking component as a graduation project for a monolithic kernel OS.</p>
          <a href="https://github.com/yil384/Starry-Next" target="_blank" class="equip-link pixel-font">→ GitHub</a>
        </div>
      </div>
    </div>
    <div class="equip-card anim-target">
      <div class="equip-inner">
        <div class="equip-front pixel-border">
          <div class="equip-icon">🛡️</div>
          <div class="equip-name pixel-font">IM System</div>
          <div class="equip-desc">Real-time Chat Platform</div>
          <div class="equip-rarity pixel-font rare">RARE</div>
        </div>
        <div class="equip-back pixel-border">
          <div class="equip-back-title pixel-font gold">IM System</div>
          <p class="equip-back-desc">Built real-time chat website with WebSocket and Django.</p>
          <a href="https://github.com/yil384/Instant-messaging-system-frontend" target="_blank" class="equip-link pixel-font">→ GitHub</a>
        </div>
      </div>
    </div>
    <div class="equip-card anim-target">
      <div class="equip-inner">
        <div class="equip-front pixel-border">
          <div class="equip-icon">📜</div>
          <div class="equip-name pixel-font">CST-OJ</div>
          <div class="equip-desc">Rust Code Evaluation</div>
          <div class="equip-rarity pixel-font rare">RARE</div>
        </div>
        <div class="equip-back pixel-border">
          <div class="equip-back-title pixel-font gold">CST-OJ</div>
          <p class="equip-back-desc">Built Rust-based platform for data structure assignment grading.</p>
          <a href="https://github.com/yil384/CST-OJ-Rust" target="_blank" class="equip-link pixel-font">→ GitHub</a>
        </div>
      </div>
    </div>
    <div class="equip-card anim-target">
      <div class="equip-inner">
        <div class="equip-front pixel-border">
          <div class="equip-icon">⚡</div>
          <div class="equip-name pixel-font">TritonGym</div>
          <div class="equip-desc">LLM Agent Flow</div>
          <div class="equip-rarity pixel-font legendary">LEGENDARY</div>
        </div>
        <div class="equip-back pixel-border">
          <div class="equip-back-title pixel-font gold">TritonGym</div>
          <p class="equip-back-desc">Proposed new algorithm for tool-augmented LLMs in GPU code generation.</p>
          <span class="equip-link pixel-font" style="color:var(--text-muted);">Research Project</span>
        </div>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add equipment CSS**

```css
/* -- Equipment -- */
.equip-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.equip-card {
  perspective: 600px;
  height: 200px;
}
.equip-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.6s ease;
  transform-style: preserve-3d;
}
.equip-card:hover .equip-inner { transform: rotateY(180deg); }
.equip-front, .equip-back {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
}
.equip-back { transform: rotateY(180deg); }
.equip-icon { font-size: 36px; margin-bottom: 8px; }
.equip-name { font-size: 9px; color: var(--purple); margin-bottom: 6px; }
.equip-desc { font-size: 12px; color: var(--text-dim); }
.equip-rarity { font-size: 7px; margin-top: 8px; padding: 2px 8px; border-radius: 2px; }
.equip-rarity.epic { color: #c084fc; background: rgba(192,132,252,0.12); border: 1px solid rgba(192,132,252,0.25); }
.equip-rarity.rare { color: var(--blue); background: rgba(96,165,250,0.12); border: 1px solid rgba(96,165,250,0.25); }
.equip-rarity.legendary { color: var(--gold); background: var(--gold-dim); border: 1px solid rgba(255,215,0,0.25); }
.equip-back-title { font-size: 10px; margin-bottom: 12px; }
.equip-back-desc { font-size: 12px; color: var(--text-dim); line-height: 1.5; margin-bottom: 12px; }
.equip-link { font-size: 8px; color: var(--blue); text-decoration: none; }
.equip-link:hover { text-decoration: underline; }

@media (max-width: 500px) {
  .equip-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 3: Verify in browser**

Confirm: 2x2 grid of equipment cards. Each shows icon, name in purple, description, and rarity badge (EPIC purple, RARE blue, LEGENDARY gold). Hovering flips the card to show detailed description and GitHub link.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add equipment section with flippable project cards"
```

---

### Task 10: Portal Section and Footer

**Files:**
- Modify: `index.html`

Add portal links with pulsing animations and the pixel-style footer.

- [ ] **Step 1: Add portal and footer HTML**

Insert after equipment section:

```html
<!-- Portals (Contact Links) -->
<section id="portals" class="section anim-target">
  <div class="section-title">PORTALS</div>
  <div class="portal-row">
    <a href="https://github.com/yil384" target="_blank" class="portal-link pixel-border anim-target">
      <div class="portal-glow"></div>
      <div class="portal-icon">🌀</div>
      <div class="portal-name pixel-font">GitHub</div>
    </a>
    <a href="https://www.linkedin.com/in/yichen-lin-206293384" target="_blank" class="portal-link pixel-border anim-target">
      <div class="portal-glow"></div>
      <div class="portal-icon">🌀</div>
      <div class="portal-name pixel-font">LinkedIn</div>
    </a>
    <a href="https://scholar.google.com/citations?user=itFHNzoAAAAJ" target="_blank" class="portal-link pixel-border anim-target">
      <div class="portal-glow"></div>
      <div class="portal-icon">🌀</div>
      <div class="portal-name pixel-font">Scholar</div>
    </a>
  </div>
</section>

<!-- Footer -->
<footer class="site-footer">
  <p class="pixel-font">&copy; 2025&ndash;2026 Yichen Lin | Crafted with ⚔️ and ✨</p>
  <p class="footer-hint pixel-font">Use arrow keys to move the adventurer!</p>
</footer>
```

- [ ] **Step 2: Add portal and footer CSS**

```css
/* -- Portals -- */
.portal-row {
  display: flex;
  gap: 20px;
  justify-content: center;
}
.portal-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 24px 32px;
  text-decoration: none;
  border-color: var(--purple);
  position: relative;
  overflow: hidden;
  transition: transform 0.3s, box-shadow 0.3s;
}
.portal-link:hover {
  transform: scale(1.05);
  box-shadow: 0 0 24px rgba(129,140,248,0.3);
}
.portal-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(129,140,248,0.1), transparent 70%);
  animation: portalPulse 2s ease-in-out infinite;
}
@keyframes portalPulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
}
.portal-icon {
  font-size: 32px;
  animation: portalSpin 4s linear infinite;
}
@keyframes portalSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.portal-name { font-size: 9px; color: var(--purple); }

/* -- Footer -- */
.site-footer {
  text-align: center;
  padding: 40px 24px 60px;
  border-top: 1px solid var(--border);
  max-width: 800px;
  margin: 0 auto;
}
.site-footer p { font-size: 8px; color: var(--text-muted); }
.footer-hint { margin-top: 8px; font-size: 7px; }

@media (max-width: 500px) {
  .portal-row { flex-direction: column; align-items: center; }
}
```

- [ ] **Step 3: Verify in browser**

Confirm: three portal links in a row with spinning emoji icons and purple glow pulse. Hover scales them up with box shadow. Links open correct URLs in new tab. Footer at bottom with copyright and arrow key hint.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add portal links section and pixel-style footer"
```

---

### Task 11: Scroll Animations

**Files:**
- Modify: `index.html`

Wire up all IntersectionObserver-based scroll animations: section fade-ins, skill bar fills, tree line animation, quest stagger, achievement notification.

- [ ] **Step 1: Add animation CSS**

Add to the `<style>` block:

```css
/* -- Scroll Animations -- */
.anim-target { opacity: 0; transform: translateY(20px); transition: opacity 0.6s ease, transform 0.6s ease; }
.anim-target.visible { opacity: 1; transform: translateY(0); }

/* Achievement unlock notification */
.ach-unlock {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%) translateY(-20px);
  font-family: var(--font-pixel);
  font-size: 10px;
  color: var(--gold);
  background: rgba(15,15,35,0.95);
  border: 2px solid var(--gold);
  padding: 10px 24px;
  border-radius: 4px;
  z-index: 150;
  opacity: 0;
  transition: opacity 0.3s, transform 0.3s;
  pointer-events: none;
}
.ach-unlock.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* Quest stagger */
.quest-card.anim-target { transition-delay: var(--stagger); }
```

- [ ] **Step 2: Add achievement unlock notification HTML**

Insert just before the `<script>` tag:

```html
<div id="ach-unlock" class="ach-unlock">🏆 Achievement Unlocked!</div>
```

- [ ] **Step 3: Add scroll animation JS**

Add to the `<script>` block:

```javascript
// -- Scroll Animations (IntersectionObserver) --
const animObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      animObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('.anim-target').forEach(el => animObserver.observe(el));

// -- Skill bar fill animation --
const attrObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelectorAll('.attr-row').forEach(row => {
        const level = row.dataset.level;
        row.querySelector('.attr-fill').style.width = level + '%';
      });
      attrObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.2 });
const attrSection = document.getElementById('attributes');
if (attrSection) attrObserver.observe(attrSection);

// -- Tree line animation --
const treeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelector('.tree-line')?.classList.add('animated');
      treeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.3 });
const treeSection = document.getElementById('skill-tree');
if (treeSection) treeObserver.observe(treeSection);

// -- Quest stagger delays --
document.querySelectorAll('.quest-card.anim-target').forEach((card, i) => {
  card.style.setProperty('--stagger', (i * 0.1) + 's');
});

// -- Achievement unlock notification --
let achNotifyTimeout;
const achObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const notif = document.getElementById('ach-unlock');
      notif.classList.add('show');
      clearTimeout(achNotifyTimeout);
      achNotifyTimeout = setTimeout(() => notif.classList.remove('show'), 2000);
      achObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.3 });
const achSection = document.getElementById('achievements');
if (achSection) achObserver.observe(achSection);
```

- [ ] **Step 4: Verify in browser**

Scroll through the entire page. Confirm:
- All sections fade in from below when entering viewport
- Skill tree golden line animates from left to right
- Attribute bars fill from 0% to their target widths
- "Achievement Unlocked!" notification pops up when scrolling to publications
- Quest cards appear one after another with stagger delay
- EXP bar in status bar fills as you scroll

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add scroll animations with IntersectionObserver"
```

---

### Task 12: Pixel Character Easter Egg

**Files:**
- Modify: `index.html`

Add a small pixel character that can be controlled with arrow keys, moving freely over the page.

- [ ] **Step 1: Add pixel character HTML**

Insert before the `<script>` tag:

```html
<!-- Pixel Character -->
<div id="pixel-char" aria-hidden="true"></div>
```

- [ ] **Step 2: Add pixel character CSS**

```css
/* -- Pixel Character -- */
#pixel-char {
  position: fixed;
  bottom: 40px;
  right: 40px;
  width: 32px;
  height: 32px;
  z-index: 90;
  pointer-events: none;
  transition: none;
  image-rendering: pixelated;
}
/* Pixel art using box-shadow (scholar/mage character) */
#pixel-char::after {
  content: '';
  display: block;
  width: 4px;
  height: 4px;
  /* 8x8 pixel art: a small mage/scholar character */
  box-shadow:
    /* hat */
    8px 0 0 var(--purple), 12px 0 0 var(--purple), 16px 0 0 var(--purple),
    4px 4px 0 var(--purple), 8px 4px 0 var(--purple), 12px 4px 0 var(--purple), 16px 4px 0 var(--purple), 20px 4px 0 var(--purple),
    /* head */
    8px 8px 0 #fcd7a0, 12px 8px 0 #fcd7a0, 16px 8px 0 #fcd7a0,
    8px 12px 0 #fcd7a0, 12px 12px 0 #333, 16px 12px 0 #fcd7a0,
    /* body */
    4px 16px 0 var(--blue), 8px 16px 0 var(--blue), 12px 16px 0 var(--blue), 16px 16px 0 var(--blue), 20px 16px 0 var(--blue),
    8px 20px 0 var(--blue), 12px 20px 0 var(--gold), 16px 20px 0 var(--blue),
    /* legs */
    8px 24px 0 #555, 16px 24px 0 #555,
    8px 28px 0 #444, 16px 28px 0 #444;
  animation: charIdle 1s step-end infinite;
}
@keyframes charIdle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}
#pixel-char.walking::after {
  animation: charWalk 0.3s step-end infinite;
}
@keyframes charWalk {
  0% { transform: translateY(0); }
  25% { transform: translateY(-2px) translateX(1px); }
  50% { transform: translateY(0); }
  75% { transform: translateY(-2px) translateX(-1px); }
}
#pixel-char.hidden { display: none; }
```

- [ ] **Step 3: Add pixel character JS**

Add to the `<script>` block:

```javascript
// -- Pixel Character Movement --
const pixelChar = document.getElementById('pixel-char');
let charX = window.innerWidth - 72;
let charY = window.innerHeight - 72;
const charSpeed = 4;
const keysHeld = {};
let charWalking = false;

document.addEventListener('keydown', (e) => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
    e.preventDefault();
    keysHeld[e.key] = true;
  }
});
document.addEventListener('keyup', (e) => {
  delete keysHeld[e.key];
});

function updateChar() {
  let moved = false;
  if (keysHeld['ArrowUp'])    { charY -= charSpeed; moved = true; }
  if (keysHeld['ArrowDown'])  { charY += charSpeed; moved = true; }
  if (keysHeld['ArrowLeft'])  { charX -= charSpeed; moved = true; }
  if (keysHeld['ArrowRight']) { charX += charSpeed; moved = true; }

  // Clamp to viewport
  charX = Math.max(0, Math.min(charX, window.innerWidth - 32));
  charY = Math.max(0, Math.min(charY, window.innerHeight - 32));

  pixelChar.style.left = charX + 'px';
  pixelChar.style.top = charY + 'px';
  pixelChar.style.bottom = 'auto';
  pixelChar.style.right = 'auto';

  if (moved && !charWalking) {
    pixelChar.classList.add('walking');
    charWalking = true;
  } else if (!moved && charWalking) {
    pixelChar.classList.remove('walking');
    charWalking = false;
  }

  requestAnimationFrame(updateChar);
}

// Start after title screen dismisses
pixelChar.classList.add('hidden');
onTitleDismissCallbacks.push(() => {
  pixelChar.classList.remove('hidden');
  requestAnimationFrame(updateChar);
});

// Hide on mobile
if (window.innerWidth < 768) {
  pixelChar.style.display = 'none';
}
```

- [ ] **Step 4: Verify in browser**

Dismiss title screen. Confirm: small pixel mage character visible at bottom-right. Arrow keys move it around the screen. Character has an idle bounce animation and a walk animation while keys are held. Character does not block clicks. Not visible on mobile viewport widths.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add keyboard-controlled pixel character easter egg"
```

---

### Task 13: Responsive Design Polish

**Files:**
- Modify: `index.html`

Add remaining responsive breakpoints and ensure everything works well on mobile, tablet, and desktop.

- [ ] **Step 1: Add responsive CSS**

Add to the end of the `<style>` block:

```css
/* -- Responsive -- */
@media (max-width: 768px) {
  .section { padding: 40px 16px; }
  .section-title { font-size: 11px; }
  .char-card { flex-direction: column; text-align: center; }
  .char-avatar-wrap { width: 100px; height: 100px; }
  .char-name { font-size: 13px; }
  .attr-name { min-width: 70px; font-size: 7px; }
  .quest-header { flex-wrap: wrap; }
  .quest-badge { margin-top: 4px; }
  .achievement-card { flex-direction: column; text-align: center; }
  .footer-hint { display: none; } /* no arrow key hint on mobile */
}

@media (max-width: 500px) {
  .status-bar-inner { gap: 6px; }
  .bar-group:nth-child(1), .bar-group:nth-child(2) { display: none; } /* show only EXP on very small */
  .level-badge { font-size: 8px; }
  .title-name { font-size: 18px; }
}
```

- [ ] **Step 2: Verify responsive behavior**

Test at 3 widths using browser dev tools:
- **375px (mobile):** Title screen fits, status bar shows EXP only, character card stacks vertically, quest cards wrap, equipment is single column, portals stack, pixel character hidden, footer hint hidden.
- **768px (tablet):** Most elements show, skill tree may stack vertically at 600px breakpoint.
- **1200px (desktop):** Full experience.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add responsive design for mobile and tablet"
```

---

### Task 14: Final Polish and Visual QA

**Files:**
- Modify: `index.html`

Final pass: fix any visual bugs, check all links, ensure smooth scroll, add `prefers-reduced-motion` support, verify the page loads in one request.

- [ ] **Step 1: Add reduced motion support**

Add at the beginning of the `<style>` block, after the `:root` definition:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Full visual QA checklist**

Open in browser and verify each item:

1. Title screen: stars twinkle, name glows, "PRESS ENTER" blinks, auto-dismiss works
2. Status bar: sticks to top, EXP fills on scroll, menu opens/closes, menu links scroll to sections
3. Character card: photo pixelated by default, clears on hover, all info correct
4. Skill tree: two nodes connected, line animates on scroll, responsive stacking
5. Attributes: bars animate to correct widths, tool badges visible
6. Achievements: two cards, correct icons (silver/gold), shimmer on hover, notification popup
7. Quest log: 5 cards, expand/collapse works, stagger animation
8. Equipment: 4 cards in 2x2, flip on hover, correct links
9. Portals: 3 links spinning, correct URLs, hover glow
10. Footer: copyright text, adventurer hint
11. Pixel character: moves with arrow keys, idle/walk animation
12. No console errors

- [ ] **Step 3: Fix any issues found in QA**

Address any bugs discovered in the QA checklist above.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: final polish with reduced-motion support and visual QA fixes"
```
