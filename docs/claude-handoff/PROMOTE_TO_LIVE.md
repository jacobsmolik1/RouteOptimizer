# Promote revamp packaging → live (`routes.jacobsmolik.com`)

## Goal
Ship packaging onto production `main` / live host **without** rewriting the engine, and **without** surprising Claude (or humans) about what changed.

## Preconditions
- [ ] Jacob signs off on current preview bake (Pages `/revamp/` or frozen sha in `BUILD_META.json`)
- [ ] Claude handoff pack committed on the promote branch (`docs/claude-handoff/*`)
- [ ] Smoke on preview with **live-like** Montgomery (or pilot DC) data: auth, Generate, filters, Shore expand/Out, Commit, History, phone + desktop
- [ ] Explicit decision: UI promote only — concurrency / homeFirst SoR / cloud Commit audit still deferred

## Steps
1. **Branch** from `main` (e.g. `promote/revamp-packaging`).
2. **Apply packaging** to production `index.html` the same way as preview bake (inline or linked `revamp.css`/`revamp.js`). Prefer keeping sources maintainable (`css/`, `js/`) + build step if possible.
3. **SW:** ensure production `sw.js` cache name bumps and does not pin an old shell across users; test hard refresh + returning user.
4. **PR** with HANDOFF.md link in description; list sacred vs packaging; attach smoke checklist.
5. **Pilot:** one DC (Montgomery Test → one real DC) via allowlist or limited rollout if available; else short maintenance window + clear comms.
6. **Smoke on live URL** with real auth/data (checklist below).
7. **Widen** to all DCs; watch first two mornings.
8. **Brief Claude** with `BRIEF_CLAUDE.md` on the post-merge tree.

## Live smoke checklist
- [ ] Sign-in / DC access / switcher
- [ ] Load counts edit + Generate + Generate fresh / Re-run
- [ ] Pass-out filters (Assigned / Near / dest code)
- [ ] Shore/overflow expand → Out / Lock
- [ ] Commit Day + History strip
- [ ] Drivers vacation + roster
- [ ] Phone ~375 and desktop ~1280
- [ ] No stuck service worker (controller null or new cache after reload)

## Rollback
- Revert the promote PR / redeploy previous `index.html` + prior `sw.js` cache bump.
- Preview Pages can remain as fallback URL during pilot.

## Out of scope for this promote
- day_version CAS concurrency
- homeFirst cloud SoR
- Commit audit cloud
- Full role-gate Settings
