# Paste-ready first message for Claude

Copy everything below the line into a **new** Claude chat (or Project) after the revamp is on the branch Claude will edit.

---

You are working on **jacobsmolik1/RouteOptimizer** (Coca-Cola Bottling Route Optimizer).

**Ignore any prior memory of the old UI chrome.** The product engine (Generate / Drivers / Commit / Supabase sync / optimizer) is largely the same; the **UI packaging was overhauled** in 2026-09 (Belize × Coke, sticky Commit, pass-out filters, Shore expand affordances, Assignments skin, responsive phone morning path including Generate + load counts).

### Required reading (in order)
1. `preview/docs/claude-handoff/HANDOFF.md` (or `docs/claude-handoff/HANDOFF.md` once promoted)
2. `CODEBASE_MAP.md` — engine, state, sync truth
3. `preview/CHANGELOG_PACKAGING.md` — what packaging changed (latest first)
4. `preview/docs/claude-handoff/UI_SURFACE_CHANGELOG.md`
5. Current `index.html` / packaging sources on **this branch** — trust the tree, not chat history

### Hard rules from Jacob
- **Same look, same brain** — do not replace Generate/Commit/optimizer with stubs or rewrites unless fixing a named bug.
- Packaging lives in `preview/css/revamp.css` + `preview/js/revamp.js` (bake into `app.html` / eventually `index.html`). Prefer CSS/JS polish over structural engine edits.
- Coke **red** accents; Belize density — not SAP blue, not emoji-heavy chrome.
- Phone ≤640 must keep Generate + load counts usable; desktop density must not regress.
- Enterprise SoR gaps (concurrency CAS, homeFirst cloud, Commit cloud audit) are **open** — don’t claim they’re done.

### When I ask for a feature
1. Say whether it is **packaging** or **engine/sync**.  
2. Touch the smallest surface.  
3. Re-bake / verify if packaging; smoke Generate → filter → Shore expand → Out → Commit if behavior-adjacent.

Confirm you’ve read HANDOFF.md and state the current packaging entrypoint files before editing.
