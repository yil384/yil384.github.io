# CLAUDE.md

Yichen Lin's homepage: a real CV fused with a voxel open-world game (vanilla ES modules + three.js, no build step).

- Start with `docs/dev/HANDOFF.md` (status, TODO, testing toolkit, lessons), then `docs/dev/GAME_SPEC.md` (allowed
  facts, tone) and `docs/dev/REGIONS_API.md` (region API).
- The user wants every finished, verified change merged straight into `main` (no PR): `git push origin <sha>:main`.
  GitHub Pages deploys ~40 s later.
- Never invent facts about Yichen. Every CV fact stays in HTML. Phone, reduced motion, no-WebGL and Reviewer mode
  must keep working. Original characters only. Never punish the player.
- Research focus: AI for science and chip design; architecture for agentic workloads; harnesses and benchmarks.
- Test locally: `python3 -m http.server 8000`, tools in `tools/dev/` (outputs to `/tmp/yl`).
- Lint: `npx eslint -c tools/dev/eslint.config.mjs "assets/js/**/*.js" --ignore-pattern "assets/vendor/**"`.
