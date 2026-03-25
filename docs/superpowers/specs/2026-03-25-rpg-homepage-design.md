# RPG Interactive Academic Homepage — Design Spec

## Overview

Transform Yichen Lin's static academic homepage into a pixel-art RPG-themed interactive website. All academic information is preserved and immediately visible via scrolling. Optional game-like interactions (keyboard-controlled pixel character, clickable elements) layer on top as easter eggs.

**Tech stack:** Single `index.html` file with inline CSS/JS. No build tools. Hosted on GitHub Pages. Uses Google Fonts (Press Start 2P for pixel text), no other external dependencies.

## Design Decisions

- **Theme:** Classic 8-bit pixel RPG (Undertale / Dragon Quest aesthetic)
- **Color palette:** Dark night adventure — `#0f0f23` background, `#ffd700` gold accents, `#4ade80` green HP, `#818cf8` purple-blue magic, `#60a5fa` blue info, `#f97316` orange highlights
- **Interaction model:** Info-first scrollable page with optional game elements. No interaction required to view all content.
- **Content mapping:** Personal info → Character Card, Education → Skill Tree, Publications → Achievements, Internships → Quest Log, Projects → Equipment, Skills → Attributes, Contact → Portals

## Page Structure (top to bottom)

### 1. Title Screen (full viewport)

Full-screen RPG title screen, the first thing visitors see.

- Dark background with animated twinkling star particles (CSS + minimal JS)
- "YICHEN LIN" in large pixel font with golden glow/text-shadow animation
- "PhD Student · UCSD CSE" subtitle in purple-blue
- "— PRESS ENTER —" blinking prompt at bottom
- Click anywhere, press Enter, or wait 3 seconds to auto-dismiss
- Smooth transition: title screen slides up / fades out to reveal main content
- Background music toggle button in corner (off by default, just the UI element — no actual audio file needed initially)

### 2. Fixed Status Bar (sticky top nav)

Stays fixed at top after title screen dismisses.

- RPG-styled bar with pixel font: `HP ████░░ | MP ████░░ | EXP ████░░ | Lv.25`
- EXP bar fills proportionally to page scroll progress (0% at top → 100% at bottom)
- HP and MP are decorative, fixed at ~85% and ~65%
- Level number displayed at right
- Doubles as navigation: clicking HP/MP/EXP labels or a small menu icon opens a RPG-style menu overlay listing all sections (Character, Skills, Achievements, Quests, Equipment, Portal) — clicking a menu item smooth-scrolls to that section
- Gold border, semi-transparent dark background with backdrop-filter blur

### 3. Character Card Section

Displays personal information as an RPG character sheet.

- Left: Profile photo with pixel-art border (CSS `image-rendering: pixelated` on a slightly downscaled version, hover to reveal full-res original). Gold ornamental border.
- Right: Character info panel
  - Name: "YICHEN LIN" in gold pixel font
  - Class: "Scholar" with star rating
  - Guild: "UC San Diego · CSE Dept"
  - Mentor: "Prof. Yufei Ding"
  - Contact: email displayed as RPG-style "messenger pigeon" item
- Phone number included as a secondary detail
- Scroll-triggered entrance animation: the card "materializes" with a pixel dissolve effect

### 4. Skill Tree Section (Education)

Education history as a horizontal skill tree / progression path.

- Two nodes connected by an animated golden line: "Tsinghua University (2021–2025)" → "UC San Diego (2025–Now)"
- Each node is a pixel-styled badge with school name, degree, and details
- The connecting line animates (draws itself) when scrolling into view
- Tsinghua node: "B.S. Computer Science and Technology"
- UCSD node: "Ph.D. Computer Science and Engineering · Advisor: Prof. Yufei Ding"
- Nodes glow on hover, clicking expands additional details

### 5. Attributes Section (Programming Skills)

Technical skills displayed as RPG attribute/stat bars.

- Each skill is a row: `SKILL_NAME [████████░░] Lv.X`
- Skills and approximate levels (visual only, for relative comparison):
  - Python Lv.9 (90%)
  - C++ Lv.8 (85%)
  - Rust Lv.7 (75%)
  - Go Lv.7 (70%)
  - TypeScript Lv.6 (65%)
  - JavaScript Lv.6 (60%)
  - Verilog Lv.5 (50%)
- Tools subsection with smaller pills/badges: Linux, Vim, LaTeX, WebSocket, Django, MongoDB
- Bars animate from 0 to target value when scrolling into viewport (IntersectionObserver)
- Each bar has a distinct color

### 6. Achievements Section (Publications)

Publications displayed as unlocked achievement badges.

- Each publication is an achievement card with:
  - Trophy/medal icon (gold for published, silver for in-submission)
  - Achievement name (shortened paper title) in pixel font
  - Description line (venue, year)
  - Author list with user's name highlighted in gold
- Cards have a golden glow/shimmer effect on hover
- Scroll-triggered "Achievement Unlocked!" animation for each card (pixel notification popup style)
- Publications:
  1. "TritonGym" — Yue Guan*, **Yichen Lin***, et al. — In submission to ICLR 2026 (🏆 gold)
  2. "(Re)²H₂O" — Haoyi Niu*, Kun Ren*, **Yichen Lin**, et al. — IV 2023 (🎖️ gold)

### 7. Quest Log Section (Internships)

Internship experiences as completed quest entries.

- Each internship is a quest card with:
  - Quest icon (⚔️)
  - Company name as quest title in blue pixel font
  - Role and date as quest metadata
  - Description bullets as quest objectives
  - "✓ COMPLETE" badge in green
- Quests listed chronologically (newest first):
  1. Picasso Lab (UCSD CSE) — Research Intern (Mar 2024 – Feb 2025)
  2. Metabit — Quantitative Developer Intern (Sep 2024 – Nov 2024)
  3. Tencent Timi Studio — Game Developer Intern (Jun 2024 – Jul 2024)
  4. Disney+ Hotstar — Algorithm Developer Intern (Mar 2024 – Jun 2024)
  5. ByteDance Lark — Backend Developer Intern (Jun 2023 – Nov 2023)
- Cards stagger-animate into view when scrolling (each appears 100ms after previous)
- Clicking a quest expands/collapses the detail bullets

### 8. Equipment Section (Projects)

Projects displayed as RPG equipment/inventory items.

- 2x2 grid of equipment cards
- Each card has:
  - Item icon (weapon/shield/scroll emoji)
  - Item name in purple pixel font (rare item color)
  - Short description
  - Rarity border color (purple = epic, blue = rare)
- Cards flip on hover to reveal back side with more details + GitHub link
- Projects:
  1. 🗡️ Starry-Next — Monolithic Kernel OS (link to GitHub)
  2. 🛡️ IM System — WebSocket + Django Chat (link to GitHub)
  3. 📜 CST-OJ — Rust Code Evaluation (link to GitHub)
  4. ⚡ TritonGym — LLM Agent Flow (no link)

### 9. Portal Section (Contact / External Links)

Contact links as magical teleportation portals.

- Three portal items in a row: GitHub, LinkedIn, Google Scholar
- Each portal has a spinning/pulsing animation (CSS keyframes)
- Purple-blue glow effect, intensifies on hover
- Clicking opens link in new tab
- Pixel art border around each portal

### 10. Footer

- Simple pixel-style footer: "© 2025 Yichen Lin | Crafted with ⚔️ and ✨"
- Small text: "Use arrow keys to move the adventurer!"

## Interactive Elements

### Pixel Character (Easter Egg)

- A small (32x32 CSS pixel art) character rendered on the page
- Controlled with arrow keys (←→↑↓), moves freely over the page content
- Character has idle animation (slight bounce) and walk animation (alternating frames via CSS)
- Purely decorative — doesn't block content, doesn't affect navigation
- Starts at bottom-right corner after title screen dismisses
- Z-index above content but pointer-events: none on the character (clicks pass through to content below)
- Character is a simple pixel scholar/mage figure (built with CSS box-shadow pixel art or a small inline SVG)

### Scroll Animations

All sections use IntersectionObserver for entrance animations:
- Character Card: pixel dissolve/materialize
- Skill Tree: line draws itself connecting the nodes
- Attributes: bars fill from 0 to target
- Achievements: "Achievement Unlocked!" notification popup
- Quest Log: stagger fade-in (100ms intervals)
- Equipment: cards slide up with slight rotation
- Portals: spin-in animation

### Hover Effects

- Character Card photo: pixelated → clear transition
- Attribute bars: show exact percentage tooltip
- Achievement cards: golden shimmer
- Equipment cards: flip to reveal details
- Portal links: glow intensifies, slight scale up

## Responsive Design

- Mobile: single column, smaller pixel fonts, character controller hidden (touch not practical)
- Tablet: similar to desktop but slightly compressed
- Desktop: full experience with pixel character
- Title screen works on all sizes
- Status bar collapses to show only EXP bar on very small screens

## Performance

- No external JS libraries — vanilla JS only
- CSS animations preferred over JS where possible
- Star particles: limited to ~50 elements, CSS-only twinkle
- IntersectionObserver for lazy animation triggers (no scroll event listeners)
- Single HTML file, all CSS/JS inline — one network request
- Google Fonts: Press Start 2P (pixel font), loaded async

## File Structure

Single file: `index.html` containing all HTML, CSS, and JavaScript inline. Profile image at `static/selfpic_yichenlin.jpg` (existing).

No build system, no npm, no frameworks. Pure vanilla HTML/CSS/JS.
