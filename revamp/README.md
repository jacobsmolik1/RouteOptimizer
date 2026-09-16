# REVAMP PREVIEW — GitHub Pages (`gh-pages` / `revamp/`)

## Public URL (after Pages source = `gh-pages` / root)
https://jacobsmolik1.github.io/RouteOptimizer/revamp/

## What is live here
- `index.html` — bootstrap that loads production `main/index.html` via jsDelivr and sets `REVAMP_PREVIEW=true`.
- Full Wave3 **baked** `app.html` (~765KB, sha256 `aa16f222…`) was **not** uploaded in one MCP call (tool payload size). To publish the exact bake:
  1. Open branch `gh-pages` → folder `revamp/`
  2. Upload your local `preview/app.html` as **`index.html`** (replace the bootstrap)
  3. Hard-refresh the Pages URL

## Production safety
- Branch `main` / `index.html` (sha `50c22590…`) was **not** modified.
- Root of `gh-pages` still mirrors production `index.html` from main tip at branch creation.

## Pages settings
Repo → **Settings → Pages**:
- Source: **Deploy from a branch**
- Branch: **`gh-pages`** / folder **`/` (root)**
- Save

Until you switch Pages off `main`, github.io root keeps serving production from `main`.

## Supabase auth allowlist
Add origin: `https://jacobsmolik1.github.io`
(project `ryqsxtnjdrltuocqszge`)
