# Route Optimizer — REVAMP PREVIEW (offline-first)

This preview ships the **real production Route Optimizer** with **revamp packaging chrome** already baked into `app.html` (assembled from `app.part*` files). It is **not** the thin offline stub.

It keeps auth, Supabase, DC switcher, Daily Load Input, templates, generate algorithm, Drivers / History / Settings, print/CSV, multi-DC, etc.

It does **not** replace the production deploy until you choose to promote it. Default live behavior on `main` is unchanged.

## How to open (ZIP) — FAST, no network

1. On GitHub: branch `preview/revamp-dashboard` → **Code** → **Download ZIP**
2. Unzip and open the `preview` folder
3. **Windows:** double-click `join.bat`  
   **Mac / Linux:** run `sh join.sh`
4. Open `app.html` in Chrome / Edge / Firefox

**No Python. Network is not required** after the ZIP download — the app is already in the part files.

If `app.html` is already present in the folder, you can skip the join step and open it directly.

## What the packaging changes

Feature-flagged with `REVAMP_PREVIEW = true`. Implemented as CSS + small JS wrappers — optimizer logic is not rewritten.

1. **UNIFIED test banner hidden** by default (black PREVIEW banner instead)
2. **Sticky action bar** after generate: **Commit Day** primary, **Re-run** secondary (Generate demoted when a plan exists)
3. **Needs Attention** compact strip (restyles Plan Quality; long unused-driver lists collapse)
4. **Assigned pass-out cards first**; **Show all drivers** toggle when empty cards exist

## Use Montgomery Test DC

When signing in / switching DCs, pick **Montgomery Test** so you do not touch live Montgomery DC data while evaluating the chrome.

## Files

| Path | Role |
|------|------|
| `app.part01` … `app.part19` | Baked app chunks (join → `app.html`) |
| `join.bat` / `join.sh` | One-click join (Windows / Mac-Linux) — no Python |
| `app.html` | Full offline app (after join, or if shipped) |
| `index.html` | Landing page — points to FAST offline path; network fetch is optional only |
| `css/revamp.css` | Revamp packaging styles (also inlined in `app.html`) |
| `js/revamp.js` | Packaging wrappers (also inlined in `app.html`) |

## Optional network fallback

`index.html` does **not** auto-fetch from jsDelivr/GitHub. There is an optional “Fetch from network” control only if local parts are missing. Prefer the FAST offline path.

## Branch note

Update **only** `preview/revamp-dashboard`. Do not change `main` / live `index.html` as the default deploy from this work.
