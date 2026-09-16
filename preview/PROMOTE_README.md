# Promote: revamp packaging → main

Status: **sources + frozen bake staged — `index.html` on main NOT replaced yet.**

## Contents
- `preview/css/revamp.css`, `preview/js/revamp.js` — packaging sources
- `preview/app.html` — frozen bake (sha in BUILD_META.json)
- Packaging changelog

## Before live
1. Merge docs PR (#2) Claude handoff pack.
2. Bake packaging into production `index.html` (or link css/js) with **REVAMP banner removed/disabled for prod**.
3. Bump `sw.js` cache name; verify returning users get new shell.
4. Open PR, one-DC pilot, smoke checklist in `docs/claude-handoff/PROMOTE_TO_LIVE.md`.

Do not merge this branch to main until Jacob signs off on the index.html swap.
