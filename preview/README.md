# Route Optimizer — REVAMP PREVIEW

Offline interactive preview matching the liked concept mockup (`route-optimizer-revamp-concept.png`).

## Files on this branch

- `index.html` — small loader (fetches + gunzips the payload in-browser)
- `index.html.gz.b64` — gzip+base64 of the exact single-file v2 HTML from disk  
  (sha256 `a609e0a47a8843179aa6875c631cffa89562eea6e9c2982123d6731b7a1db4f6`)
- This README

> Open via a local static server (not `file://`) so `fetch('index.html.gz.b64')` works.

## What works (real client-side state — not toasts-only)

1. **Needs Attention** — expand/collapse; dismiss an issue updates the count / hides the banner when empty  
2. **Unused Drivers** — expand/collapse name chips; click a chip to assign to an unassigned load (modal picker)  
3. **Daily Load Input** — open panel, change PAN/COL/MOB, Apply regenerates assignment cards from the driver pool  
4. **Assigned driver cards** — click Pending ↔ Out; badge color and Details table update  
5. **Click / drag assign** — × on a card unassigns a load; then select/drag load chips onto unused drivers or empty cards (Show all)
6. **Show all / empty cards** — toggle appears when unused drivers exist; default is assigned-only  
7. **Re-run Optimizer** — reshuffles assignments among drivers with a flash animation; nudges ETAs  
8. **Print Pass-outs** — `window.print()` with print CSS that hides chrome  
9. **Export CSV** — downloads a real `.csv` of current assignments  
10. **Commit Day** — locks edits + shows committed pill; **Unlock Day** re-enables editing (still offline)  
11. **DC dropdown** — Montgomery DC / Montgomery Test (label + subtitle)  
12. **Date control** — changes the header date string  

## How to open

```bash
cd preview   # or clone this branch and cd into preview/
python3 -m http.server 8765
```

Then visit http://localhost:8765/

Requires a recent Chrome / Firefox / Safari (`DecompressionStream`).

## What this is

- **Offline sample data** only (Montgomery DC / Montgomery Test).
- **Not connected** to live `routes.jacobsmolik.com` or Supabase.
- Visual target: red Coca-Cola UNITED top bar, metric cards with icons, yellow Needs Attention banner, assigned-driver row cards, sticky Commit Day bar.
- Black **PREVIEW** banner stays on screen.
