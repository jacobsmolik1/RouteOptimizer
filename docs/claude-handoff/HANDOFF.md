# Route Optimizer — Claude / AI handoff (post–UI revamp)

**Audience:** Claude (or any coding agent) picking up after the 2026-09 Belize × Coke packaging revamp.  
**Owner:** Jacob Smolik · Repo: `jacobsmolik1/RouteOptimizer`  
**Rule:** Prefer this file + the live tree over any prior chat memory of the old UI.

---

## 1. What this product is

Multi-DC morning dispatch SPA for Coca-Cola Bottling (CCBCU). One self-contained HTML app (historically `index.html` on `main`). Supabase auth + day/driver/config sync; localStorage is the working store.

**Live today (production):** `https://routes.jacobsmolik.com` — still the pre-revamp / `main` shell unless Jacob has promoted since this doc was written.

**Preview today (revamp bake):** `https://jacobsmolik1.github.io/RouteOptimizer/revamp/` — packaging overlay on production brain. Source of bake: `preview/app.html` (inlined `style#revamp-css` + `script#revamp-preview-js` from `preview/css/revamp.css` + `preview/js/revamp.js`).

---

## 2. Sacred vs packaging (do not confuse)

### Sacred — same brain (do not rewrite unless fixing a real bug)
- `generateAssignments` / optimizer core
- Drivers roster CRUD, vacation, rules
- `commitToHistory` / Commit Day RPC path
- Supabase sync (`queueSync`, drivers, config, `commit_dispatch_day`)
- Assignment / lock / Out / Ad Hoc / What-if mechanics
- DC configs, phases, destinations data model

### Packaging — chrome only (safe to iterate)
- `preview/css/revamp.css` + `preview/js/revamp.js` (then re-bake into `app.html`)
- Visual: Belize density + Coke red accents (not SAP blue)
- Sticky Commit family, Needs Attention strip, filter tokens, Shore Expand affordances
- Responsive R1 (phone ≤640 includes Generate + load counts)
- `REVAMP_SW_KILL` (unregister service workers on preview)
- Emoji purge / plain badges / Assignments table skin

**Jacob’s bar:** “same look, same brain” — preferred UI chrome with real Generate/Drivers/Commit underneath. Not a stub mockup.

---

## 3. How the revamp is layered

```
Production index.html (engine + DOM)
    + body.revamp-preview / html.revamp-preview
    + inlined #revamp-css
    + inlined #revamp-preview-js (wraps/polishes DOM; MutationObservers)
    + window.REVAMP_PREVIEW = true
```

Key globals / hooks:
- `REVAMP_PREVIEW` / `body.revamp-preview`
- `#driver-cards-grid`, `.driver-card`, `.is-shore`, `.is-unassigned`
- `#assignments-section`, `#revamp-filter-bar`
- Sticky actions / mid Generate twin
- `toggleShoreCard()` / `shoreExpanded` (engine); packaging adds Expand CTAs + collapsed-row click
- Pass-out filters: Assigned / Show all / Near limit / dest chips (match **dest codes**, e.g. EVG)

**Bake process:** edit `preview/css/revamp.css` + `preview/js/revamp.js` → re-inline into `preview/app.html` (`style#revamp-css`, `script#revamp-preview-js`, escape `</script>`) → `node --check` → update `preview/BUILD_META.json` + `CHANGELOG_PACKAGING.md`.

---

## 4. What changed vs “old Claude context” (2026-09 wave)

If your prior context is pre–Sept 2026 UI, assume it is **stale** for chrome. Engine modules in CODEBASE_MAP are still the right mental model for data/sync/optimizer.

| Area | Old assumption | Now |
|------|----------------|-----|
| Visual | Heavier / emoji-heavy / SAP-ish | Belize density, Coke red, plain text badges |
| Commit | Mid-page primary | Sticky Commit family + mid Sheet/Start Over |
| Pass-out | Checkbox “show all” | Filter tokens (Assigned / Show all / Near / dest) |
| Shore overflow | Header-only expand | Expand CTA + **collapsed summary rows also expand** |
| Assignments table | Loud uppercase / pink shore rows | Sentence-case headers, neutral zebra |
| Mobile | Barely usable | R1: 1-col cards, sticky actions, counts+Generate, table H-scroll |
| PWA | Aggressive SW cache | Preview kills SW; gh-pages `sw.js` was replaced with self-unregister safety SW on Pages branch |

Detailed packaging log: `preview/CHANGELOG_PACKAGING.md`  
Responsive: `/workspace/ux-review/RESPONSIVE_R1_2026-09-16.md` (also copy under this folder if present)

---

## 5. Enterprise gaps (still open — UI ship ≠ SoR)

Do **not** claim these are done when promoting UI:
1. Multi-dispatcher concurrency / LWW (design spike only: day_version CAS)
2. `homeFirst` not in Supabase SoR + dest audit scaffolding only
3. Commit audit = **localStorage** chrome (“local / not cloud SoR”)
4. Dual auth / role-gate Settings & Danger Zone
5. Preview vs `main` promotion process

See also: `HOMEFIRST_SYNC_GAP.md`, `CONCURRENCY_DESIGN_SPIKE.md` under ux-review.

---

## 6. How to brief yourself (Claude) on day one

1. Read this `HANDOFF.md` fully.  
2. Read `CODEBASE_MAP.md` for engine/sync truth.  
3. Skim `preview/CHANGELOG_PACKAGING.md` (latest entries first).  
4. Diff against `main` once packaging is merged — **do not invent** old class names from memory.  
5. For UI work: touch packaging files first; only edit optimizer/Commit if Jacob names a **behavior bug**.  
6. Never reintroduce emoji-heavy chrome or SAP blue accents unless Jacob asks.

Paste-ready prompt: see `BRIEF_CLAUDE.md` in this folder.

---

## 7. Promote-to-live (high level)

See `PROMOTE_TO_LIVE.md`. Summary: freeze bake → PR packaging onto `main` `index.html` → one-DC pilot → smoke on live data → widen. Do not big-bang all DCs. Keep SW under control on production host.

---

## 8. Contacts / agents (Jacob’s Grok Bot staff)

- **Chief of Staff** — coordination  
- **UX bot** — visual critique  
- **Bug Squasher** — QA  
- **Transportation Program Developer** / **Freight Research** — domain  

GitHub: `jacobsmolik1` · Preview Pages path: `/RouteOptimizer/revamp/`

---

*Generated 2026-09-16 for handoff after packaging waves + responsive R1. Update this file when packaging lands on `main`.*
