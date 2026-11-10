# Responsive Wave R1 — 2026-09-16

**When:** 2026-09-16 ~5:57 PM ET (box bake UTC 2026-09-16T21:57:49Z)  
**Surface:** packaging only — `preview/css/revamp.css`, `preview/js/revamp.js`, re-baked `preview/app.html`  
**Not done:** git push / gh-pages publish (parent reviews first)  
**Engine:** Generate / Commit / optimizer / production `main` **untouched**  
**Keep:** `REVAMP_SW_KILL`, prior Wave 2 / Pages UI / Expand·Assign fixes

## Bake

| Field | Value |
|-------|--------|
| Bytes | 820036 |
| SHA-256 | `919876baf4a681174ac1b324b344443c5b0181328a90782b6c17a66a2fd49c9d` |
| Markers | `REVAMP_SW_KILL` kept; `style#revamp-css` + `script#revamp-preview-js` re-inlined |
| `node --check` | OK on `revamp.js` and extracted baked script |

## Goal

Morning dispatch works on **phone and desktop**. Jacob wants **Generate + load counts on phone** (not glance-only chips).

## Breakpoints

| Name | Width | Intent |
|------|-------|--------|
| phone | max-width **640px** | 1-col pass-out; editable counts; sticky thumb actions |
| tablet | **641–960px** | 2-col cards; scroll assignments |
| desktop | **961px+** | Keep dense Belize multi-col; **no regression** |

## Before → after (phone ≤640)

| Area | Before (dense desktop chrome) | After (R1) |
|------|-------------------------------|------------|
| Header | Tall cluster; date/email/Dispatchers compete with DC chip | Compact; **DC chip** ≥44px; utilities fold behind **More** |
| Today's loads | Chip glance / cramped phase rows | **Edit counts** expands; phases label + **+/− steppers** ≥44px; Done usable |
| Generate | Mid button OK width; sticky cramped row | Mid **full-width**; sticky **stacked** + safe-area; Commit full-width |
| Pass-out | 3-col grid (unusable squash) | **1 column**; filters wrap; Shore Expand/Out reachable |
| Assignments | 9-col forced squash | **Horizontal scroll** + **sticky first column** |
| Touch | Hover-only Lock / tiny chevrons | Coarse-pointer Lock visible; reorder stable ≥22–28px |

Desktop ≥961: steppers hide (+/− only); More hidden; 3-col cards unchanged.

## Files touched

- `/workspace/routeopt-revamp/preview/css/revamp.css` — media queries + touch + stepper/More chrome
- `/workspace/routeopt-revamp/preview/js/revamp.js` — viewport classes, header More, phase +/− enhancers (calls existing `updateLoad`)
- `/workspace/routeopt-revamp/preview/app.html` (bake)
- `/workspace/routeopt-revamp/preview/BUILD_META.json`
- `/workspace/routeopt-revamp/preview/CHANGELOG_PACKAGING.md`

## Test checklist (parent / browser)

Use hard refresh after gh-pages. Prefer Montgomery Test DC.

### 375 × 812 (phone)

- [ ] Header: DC chip tappable; **More** reveals date / Dispatchers / email / Sign out; Less folds again
- [ ] No-plan: **Generate** full-width, not overlapping cards
- [ ] **Edit counts**: phases stack; **+/−** and number field ≥44px; change a count; **Done** returns to chips
- [ ] Has-plan sticky: status + Re-run / Generate fresh / **Commit Day** usable with thumb; safe-area clears home indicator
- [ ] Pass-out: **one column**; filter tokens wrap/scroll; Assigned / Show all / dest chips tappable
- [ ] Shore: **Expand · set Out times** then **Out** reachable
- [ ] Reorder chevrons: no layout thrash on tap
- [ ] Assignments · detailed: swipe horizontally; first column stays sticky; headers sentence-case (not ALL CAPS)

### 768 × 1024 (tablet)

- [ ] Pass-out **2 columns**
- [ ] Sticky usable; assignments scroll if needed
- [ ] Desktop density not fully applied (OK)

### 1280 × 800 (desktop)

- [ ] Pass-out **3-col** dense Belize (no regression)
- [ ] No **More** button; no +/− steppers (number input only)
- [ ] Sticky single row status left · actions right · Commit primary
- [ ] Prior fixes intact: filter tokens, Shore expand, Commit sticky, SW kill

## Honesty / out of scope

- No live signed-in browser resize session in this executor pass — CSS/JS + bake verified statically.
- Stacked assignment **row cards** deferred; R1 uses scroll + sticky first col.
- Engine HTML for phase rows / Out buttons unchanged; packaging only wraps/enhances.
- Parent pushes gh-pages after review.

