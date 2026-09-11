# Route Optimizer — REVAMP PREVIEW

Offline, self-contained interactive preview of the Route Optimizer dashboard revamp packaging.

**This does not replace live `index.html`.** Open only the files under `preview/`.

## Files

- `index.html` — single-file app (inline CSS/JS, no build step)
- This README

## How to open

**Option A — GitHub**

Browse to `preview/index.html` on this branch and use Raw, or clone this branch and open the file locally.

**Option B — local static server**

```bash
cd preview
python3 -m http.server 8765
```

Then visit http://localhost:8765/

## What this is

- **Offline sample data** only (Montgomery Test / Montgomery DC).
- **Not connected** to live `routes.jacobsmolik.com` or Supabase.
- Sticky actions (Re-run, Print, CSV, Commit Day) show **toasts**; Commit does **not** persist anything.
- Intended for UX review of hierarchy, collapsed input, Needs Attention, assigned-first cards, and sticky Commit primary.

## Interactions to try

1. **Edit counts** → change loads → **Apply** (chips + metrics update)
2. **Show all drivers** → empty drop-zone cards for unused pool
3. Unused drivers in Needs Attention → expand/collapse
4. **DETAILS** → expand assignment table
5. Sticky bar: Re-run / Print / CSV / Commit Day toasts
