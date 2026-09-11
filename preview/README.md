# Route Optimizer — REVAMP PREVIEW (real app + packaging)

This preview is the **real production Route Optimizer** (`main/index.html`) with **revamp chrome only** — not the thin offline stub.

It keeps auth, Supabase, DC switcher, Daily Load Input, templates, generate algorithm, Drivers / History / Settings, print/CSV, multi-DC, etc.

It does **not** replace the production deploy until you choose to promote it. Default live behavior on `main` is unchanged.

## What the packaging changes

Feature-flagged with `REVAMP_PREVIEW = true` (top of `js/prod-01.js`). Implemented as CSS + small JS wrappers (`css/revamp.css`, `js/revamp.js`) — optimizer logic is not rewritten.

1. **UNIFIED test banner hidden** by default (black PREVIEW banner instead)
2. **Sticky action bar** after generate: **Commit Day** primary, **Re-run** secondary (Generate demoted when a plan exists)
3. **Needs Attention** compact strip (restyles Plan Quality; long unused-driver lists collapse)
4. **Assigned pass-out cards first**; **Show all drivers** toggle when empty cards exist

## Use Montgomery Test DC

When signing in / switching DCs, pick **Montgomery Test** so you do not touch live Montgomery DC data while evaluating the chrome.

## Files

| Path | Role |
|------|------|
| `index.html` | Entry — production HTML shell + links to CSS/JS |
| `css/prod.css` | Production styles (extracted from `main/index.html`) |
| `css/revamp.css` | Revamp packaging styles |
| `js/prod-01.js` … `prod-06.js` | Production app JS (split for GitHub size limits) |
| `js/revamp.js` | Packaging wrappers (sticky bar, Needs Attention, card filter) |

## How to open (ZIP — no Python required)

1. On GitHub: branch `preview/revamp-dashboard` → **Code** → **Download ZIP**
2. Unzip and open `preview/index.html` in Chrome / Edge / Firefox  
   (`File → Open`, or double-click the file)

Relative `css/` and `js/` loads work from `file://` when the folder structure is kept.

### Optional local server

```bash
cd preview
python3 -m http.server 8765
# then http://localhost:8765/
```

## Branch note

Update **only** `preview/revamp-dashboard`. Do not change `main` / live `index.html` as the default deploy from this work.
