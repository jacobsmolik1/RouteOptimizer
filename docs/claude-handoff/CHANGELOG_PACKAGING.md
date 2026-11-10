## 2026-09-16 — Responsive Wave R1 (packaging)
Chrome/CSS + small revamp.js viewport helpers only — Generate / Commit / optimizer / assignment engine untouched. No GitHub `main` / production touch; parent pushes gh-pages.

- **Breakpoints:** phone ≤640 · tablet 641–960 · desktop ≥961 (dense Belize multi-col preserved; media queries only tighten small screens).
- **Phone header:** compact; DC chip ≥44px; utilities fold behind **More** / Less; safe-area top padding.
- **Load counts:** Edit counts / Done / Expand usable; phases grid (label + steppers); packaging **+/−** steppers ≥44px (desktop keeps input-only); not horizontally clipped.
- **Generate / sticky:** mid Generate full-width; sticky bar stacks with safe-area; Commit full-width primary; Re-run / Generate fresh 2-col; Print/CSV demoted on phone sticky.
- **Pass-out:** 1-column cards; filter tokens wrap + min 44px; Shore Expand/Out ≥44px; reorder chevrons stable (no hover thrash).
- **Assignments · detailed:** horizontal scroll + sticky first column (no 9-col squash); sentence-case headers kept.
- **Touch:** `(hover:none)/(pointer:coarse)` reduces hover-only Lock opacity; fleet action opacity lifted.
- **Keep:** `REVAMP_SW_KILL`, prior UI fixes (shore expand, filter tokens, Commit sticky, ready-gate, etc.).

### Bake
- `app.html` re-inlined `style#revamp-css` + `script#revamp-preview-js` (`</script>` escaped); `node --check` OK.
- Doc: `/workspace/ux-review/RESPONSIVE_R1_2026-09-16.md`

## 2026-09-16 — FIX_EXPAND_ASSIGN (Shore expand + Assignments table)
Packaging only — optimizer / Generate / Commit / production `main` untouched; no push (parent gh-pages).

- **Shore expand:** collapsed DEST × N summary `.run-row`s now click + keyboard → `toggleShoreCard()` (same as header / Expand CTA). Expanded Out/Lock + drag-to-reassign rows untouched. CSS ensures `.is-shore .driver-card-runs` stays visible when expanded.
- **Assignments table:** `thead th` + `tr.col-key td` `text-transform: none !important` (kill ALL CAPS); `tr.row-shore` pink/purple → white/#fafafa zebra + thin Coke left accent; quieter `.badge-shore` (truck emoji stripped); tighter td padding; denser red `phase-group-hdr`.

### Bake
- `app.html` re-inlined `style#revamp-css` + `script#revamp-preview-js` (`</script>` escaped); `node --check` OK.
- See `BUILD_META.json` + `/workspace/ux-review/pages-bugs-2026-09-16/jacob-still-broken/FIX_EXPAND_ASSIGN.md`.

## 2026-09-16 — Round2 Jacob screenshot packaging (preview only / not live)
Chrome/CSS + revamp.js packaging only — optimizer / Generate / Commit engine untouched; production `main` untouched.

- **Reorder:** drop opacity/visibility hover tricks; `.run-reorder` always visible; `.run-move` empty + CSS triangles (`data-dir`); run-row tooltip → `Reorder runs · Click row to reassign` (no ▲▼).
- **Assignments · detailed:** kill prod `.card-header { text-transform: uppercase }` on `#assignments-section`; inject `.revamp-assignments-title`; Details toggle sentence-case; Trailer/Carrier emoji already stripped.
- **DOT badges:** `card-dot-status` → plain `Near Limit` / `DOT OK` / `Over DOT limit` (no ⚡/✓/⚠️).
- **Pass-out densify:** tighter Belize headers / run rows / footer chips (packaging only).
- **Keep:** `REVAMP_SW_KILL` at top of `revamp.js`.
- **Bake:** `app.html` re-inlined `style#revamp-css` + `script#revamp-preview-js`; `node --check` OK; see `BUILD_META.json` + `/workspace/ux-review/pages-bugs-2026-09-16/jacob-still-broken/FIX_ROUND2.md`.

## 2026-09-16 — UI bugfixes (Pages triage): reorder / filters / shore / Assignments / emoji (preview only / not live)
Chrome/CSS + revamp.js packaging only — optimizer / Generate / Commit engine untouched; production `main` untouched.

- **Reorder flash:** `.run-reorder` no longer collapses `width:0` at rest — reserves 18px; opacity/visibility fade only (stops hover layout thrash). MO still childList-only; hover is CSS-only (no re-render loop).
- **Card filters:** `buildDestMaps` + `tagRunRowDests` (`data-dest`) so dest tokens match phase **codes** (EVG) via label map / run-label, not label substring alone. Assigned/Near hints clarified.
- **Shore expand → Out:** loud `Expand · set Out times` CTA (header + collapsed footer); still calls `toggleShoreCard`; Out controls unchanged (expanded only).
- **Assignments / Details:** Belize×Coke table chrome on `#assignments-section`; title → **Assignments · detailed**; `📋` stripped from Trailer/Carrier toggle.
- **Emoji purge:** Commit / DOT print-note / vacation tip / lock·Out / shore status / History legend — plain text (Lock/Unlock/Out); sticky Commit already clean.
- **Bake:** `app.html` re-inlined `style#revamp-css` + `script#revamp-preview-js`; `node --check` OK; see `BUILD_META.json`. Verify: `/workspace/ux-review/PAGES_UI_FIXES_2026-09-16.md`.

## 2026-09-16 — Wave 3 / TP ready-gate must-fix: empty vs vacation + Commit mute (preview only / not live)
Chrome/CSS + revamp.js packaging only — hard-gate rules unchanged; optimizer / production `main` untouched.

- **Copy split:** 0 available drivers → `no-drivers-empty` when `state.drivers.length === 0` (title **No drivers on this DC**, body add ≥1 driver, CTA **Open Drivers · + Add Driver**); else `no-drivers-unavailable` (title **No drivers available**, vacation/inactive body, CTA **Open Drivers** only). no-dests + soft 0-loads unchanged; DC-agnostic.
- **Fiction sticky Commit:** soft-disable Commit Day same as Generate when ready-gate blocked + plan exists — muted / demoted primary (`revamp-commit-not-ready`), click resurfaces quiet not-ready msg; no Commit until real ready plan.
- **Bake:** `app.html` re-inlined `style#revamp-css` + `script#revamp-preview-js`; `node --check` OK; fixtures 200 / 200b / 203 / **203b** under `qa-shots/ready-gate/`.

## 2026-09-16 — Wave 3 / TP#5: Commit audit package chrome (preview only / not live)
Chrome/CSS + revamp.js packaging only — optimizer / production `main` untouched; **no DB / Commit RPC**.

- **Local audit log:** on successful `commitToHistory` wrap, append/replace `{storagePrefix}revamp-commit-audit` in localStorage (`date`, `committedAt`, `committedBy` from `#hdr-user-email`/session, `generatedBy/At` + `countsEditedBy/At` from local stamps, `overflowCount` / `unassignedCount`, short `reasonChips` from plan-quality when present, `exclusivePhaseCapDead`). Supporting stamps: `revamp-last-generate` (after Generate) · `revamp-last-counts-edit` (`saveLoads` / Edit-counts path). Honest “not attributed” / placeholders — **no invented names**.
- **UI:** sticky chip + Commit `title` **Audit preview (local only)**; History day cards get audit strip (or placeholder); Settings Optimizer quiet note when `exclusivePhaseCap` exists — dead “Small Store” vs current phase labels → **policy in code — not editable in UI**.
- **Bake:** `app.html` re-inlined `style#revamp-css` + `script#revamp-preview-js`; `node --check` OK; shots 220–223 under `qa-shots/commit-audit/`. Ready-gate + homeFirst + Wave 2 intact.

## 2026-09-16 — Wave 3 / TP#2: homeFirst visibility + dest/carrier audit chrome (preview only / not live)
Chrome/CSS + revamp.js packaging only — optimizer / production `main` untouched; **no DB columns / migrations**.

- **homeFirst:** Quiet Drivers note `#revamp-homefirst-gap` when local roster has `homeFirst`; modal hint under `#drv-homefirst-group`. Sync drop path documented in `/workspace/ux-review/HOMEFIRST_SYNC_GAP.md` (`_syncDrivers` omits field; `syncDriversFromDB` replaces roster without merge).
- **Dest/carrier audit scaffolding:** Settings Destinations quiet strip `#revamp-dest-audit` — shows **Last changed** if any timestamp/user already exists in state (dest fields / destMeta / `_cfgsync`); else placeholder **Audit log coming — edits are not yet attributed** (honest; no fake names).
- **Bake:** `app.html` re-inlined `style#revamp-css` + `script#revamp-preview-js`; `node --check` OK; shots 210–212 under `qa-shots/enterprise-audit/`. Ready-gate / Wave 2 unchanged.

## 2026-09-16 — Wave 3 / TP#3: DC go-live ready-gate (preview only / not live)
Chrome/CSS + revamp.js packaging only — optimizer / production `main` untouched.

- **Detect not-ready:** 0 available drivers (`getAvailableDrivers` / vacation+what-if) **or** 0 enabled destinations (`!disabled`). Optional 0-loads soft warn (does not block).
- **UI:** `#revamp-dc-ready-gate` Fiori IM lite banner above Generate — headline + guidance + one CTA (Drivers / Settings → Destinations).
- **Soft-block Generate:** body `revamp-dc-not-ready`; `.btn-generate` + sticky Re-run / Generate fresh `aria-disabled`; wraps on `generateAssignments` / `rerunRemaining`; click re-shows banner.
- **Fiction sticky:** South Metro-style empty roster no longer shows happy “Plan ready · N loads”; status = not-ready copy. Soft-warn Commit if somehow planned.
- **Bake:** `app.html` re-inlined `style#revamp-css` + `script#revamp-preview-js`; `node --check` OK; shots 200–203 under `qa-shots/ready-gate/` + packaging-verify `READY_GATE_VERIFY.md`.

## 2026-09-16 — Bug Squasher S2: Unassigned empty chrome under Assigned
Chrome/CSS + revamp.js only — optimizer / prod card HTML untouched (`unassignedLoads.length > 0` gate left alone).

- **Root cause:** prod `renderDriverCards` omits `.is-unassigned` when there are 0 UNASSIGNED loads; Assigned filter already kept specials, but there was no card to keep.
- **Fix:** `ensureUnassignedCalmCard()` injects calm empty `.driver-card.is-unassigned.revamp-unassigned-calm` (`data-revamp-unassigned-empty=1`) after plan when missing; placed before Shore; IM lite body “No unassigned loads” / status “None waiting” via existing `syncUnassignedEmpty`.
- **Filter:** Assigned explicitly never hides specials (`hide = isSpecial ? false : …`); Shore still visible; no fake loads.
- **Bake:** `app.html` re-inlined; `node --check` OK; see `BUILD_META.json`.

## 2026-09-16 — Wave2 smoke packaging fixes (S1-1 / S1-2 / S2-1)
Chrome/CSS + revamp.js orchestration only — optimizer core untouched; production `main` / `index.html` untouched.

- **S2-1 Print:** `@media print` forces `.driver-card.revamp-empty-hidden { display: block !important }` so Assigned-filter hide does not omit empty cards from print sheets.
- **S1-1 Generate fresh:** `#revamp-fresh-btn` clears preservable locks (`locked` + `actualOutTime` via `isPreservableLock`) + `saveResult`, then `generateAssignments()`. Re-run keeps locks.
- **S1-2 Commit while stale:** `revamp-plan-stale` body class from `markResultStale` / `clearStaleBanner`; sticky Commit muted + quiet status “Re-run or Generate fresh before Commit”; `commitToHistory` wrap early-returns when stale.
- **Bake:** `app.html` re-inlined `style#revamp-css` + `script#revamp-preview-js` (`</script>` escaped); `node --check` OK; see `BUILD_META.json`.

# Packaging changelog (REVAMP preview)

Additive CSS/JS chrome only — optimizer logic untouched.

## 2026-09-12

### Sticky commit bar (P0 hierarchy)
- Shows whenever `state.lastResult` exists (`body.has-plan`), including Drivers/History tabs.
- Actions order: **Re-run** (lock-preserving → `rerunRemaining` when plan exists, else `generateAssignments`) · **Generate fresh** (always `generateAssignments`) · **Print** · **CSV** · **Commit Day** primary.
- Sticky sub: `N loads · D DOT issues · review pass-outs`; hint: `Re-run keeps locks · Generate fresh rebuilds all`.
- Mid-page `.btn-generate` / in-card Commit stay hidden once a plan exists; sticky exposes both Re-run and Generate fresh.

### Single 4-up metrics
- `#revamp-plan-summary`: Total Loads · Drivers Used · Overflow/Shore · DOT OK (prefers live `#m-*` DOM from `renderMetrics`).
- Production `#metrics-grid` hidden when `has-plan` to avoid duplicate tiles.

### Morning-path collapses (has-plan)
- Full assignments table collapsed by default; **▶ Details** expands `#assignments-section` table wrap.
- Driver Workload collapsed by default; **▶ Driver Workload** expands `#workload-list` wrap.

### Assigned-first empty cards
- Empty-card filter + toolbar; specials (`is-unassigned` / `is-shore`) never treated as empty.
- Copy: label `Show all drivers`; hint `N assigned · empty cards hidden`.

### Needs Attention
- `#plan-quality-panel` restyled as collapsible “Needs Attention”, relocated above `#driver-cards-section`.
- Unused rows → compact typed chip `N unused ▾` accordion (expand shows names).
- Hour-spread / soft rebalance rows → `HOURS — Spread … (OK when loads ≪ roster)` when sourced from the soft “no safe rebalance…” message. Content still from plan-quality only.

### Daily Load Input compact (has-plan)
- Forces existing `toggleInputCard` / `input-card-collapsed` collapse when a plan exists.
- `#revamp-input-chips` chip row: `N loads · DEST n · … · Weekday` + red **Edit counts** (expands real `#phase-inputs`).
- No plan → chips hidden; normal Daily Load Input visible.

### Tuck Templates + Manual Assignments (has-plan)
- Load Templates card + `#load-bucket-panel` get `.revamp-setup-tuck` (hidden) while has-plan.
- Optional **Show templates / manual** link (`#revamp-setup-untuck`) reveals them; **Edit counts** also untucks.

### Pass-out section
- Driver-cards header retitled to `PASS-OUT · N ASSIGNED` (N from assigned driver cards / workload).
- Mid-page Print + CSV in that header hidden when has-plan (sticky owns Print/CSV; Start Over / Sheet kept; mid Commit already hidden).

### Other
- Preview banner kept; Drivers/History tabs never hidden.
- Soft-highlight for active `.tab-btn`.
- Fragile production IDs/functions unchanged (see `CODEBASE_MAP.md`).


### Chrome nibble — single chip + absorb banners (2026-09-12)
- **Single Edit counts row:** keep `#revamp-input-chips.is-visible` only; `#collapsed-summary` forced `display:none !important` under `body.revamp-input-compact`; removed `#revamp-edit-counts-summary` logic (no duplicate Edit counts).
- **Domicile → Needs Attention:** when `has-plan`, hide `#domicile-warning-panel` from pass-out canvas; `syncExceptions()` mirrors live `.warning-row` text as `DOMICILE — …` rows (no invented violations).
- **Disabled lanes → Needs Attention:** when `has-plan`, hide `#disabled-loc-banner`; mirror as `INFO — {names} still off — Re-enable in Settings → Destinations` when banner text present.
- **Needs Attention pill:** counts typed issue rows (HOURS / DOMICILE / INFO / etc.); unused accordion excluded from pill.


### Concept look-pass (2026-09-12 afternoon)
Chrome/CSS/JS packaging only — optimizer untouched. Targets `dashboard-revamp.html` concept.

- **Page:** `body.revamp-preview` background `#f7f8fb` (concept gray-50).
- **Collapsed Daily Load Input:** hide black `card-header` under `revamp-input-compact`; white rounded chip card with title `DAILY LOAD INPUT · COLLAPSED`, pill chips (`N loads` red-tint em, dest chips, weekday), red linkish **Edit counts**.
- **4-up metrics:** `#revamp-plan-summary` is a 4-column grid of separate white `.metric` cards — large ~26px value, uppercase label, hint (`% internal` / `of N available` / `external` / `0 over hours`). DOT STATUS shows `OK` (green) or over count.
- **Needs Attention:** yellow card; rows use left typed tag chips `HOURS` / `DOMICILE` / `INFO`; unused drivers moved to right-side header control `N unused ▾` (accordion), not a body row.
- **Sticky bar:** one-line status `Plan ready · N loads · D DOT issues`; Re-run ghost/text; Print/CSV outlined; Generate fresh dashed secondary; Commit Day solid red primary.
- **PASS-OUT:** section header de-boxed; driver cards radius 12px, softer shadow, hide red top stripe under black headers.
- **Header:** translucent **DC chip** (`#revamp-dc-chip`) from `DC_CONFIG.name` beside DOT Compliant subtitle.
- Preview banner kept; has-plan / Edit counts / templates tuck / sticky wiring / tabs unchanged.

### Rebuild / bake
- `app.html` self-contained: `style#revamp-css` + `script#revamp-preview-js` inlined by string find (no external css/js links).
- `node --check` on baked revamp script; script depth before revamp = 0.

### Belize × Coke look-pass (2026-09-12 evening)
Chrome/CSS packaging only — optimizer + revamp.js untouched. Emulates SAP Belize calm with Coca-Cola brand.

**Palette / tokens**
- Page: `#f5f6f7` / `#eff1f2` (Belize shell)
- Borders: `#d9dde0` / soft `#e5e9ec`
- Surface: `#ffffff`
- Text: `#32363a` primary · `#6a6d70` secondary · `#89919a` muted
- Primary action: Coke red `#E61D2B` (hover `#C41220`) — not SAP blue
- Dark slate (driver headers): `#354a5f` with red avatar
- OK green: `#107e3e` · warn amber strip: `#fef7e8` / `#e8d5a3` / `#8a6d00`
- Radius: `6px` (sm `4px`); rhythms ~0.5–0.75rem; shadows removed in favor of 1px borders

**Chrome**
- Header: thinner solid Coke red bar (52px), no gradient/heavy shadow
- Preview banner: quiet navy strip, lighter weight
- Tabs: underline active in red; muted inactive; no soft fill
- Metrics: flat white tiles, clear label/value hierarchy
- Needs Attention: soft amber strip (not loud card)
- Sticky bar: flat white + top border; ghost / secondary / primary Commit hierarchy
- Driver cards: `#354a5f` headers, red avatars, cleaner borders (radius 6)
- Soft-scoped production `.card` / stack / tables / `.btn*` under `body.revamp-preview`

**Behavior preserved**
- has-plan, chips/Edit counts, tuck templates, sticky actions, PASS-OUT title, mid Print/CSV hide, Needs Attention typed tags, domicile/info fold, Drivers tabs

### Rebuild / bake
- `app.html` re-inlined via string find on `style#revamp-css` (JS unchanged — no `node --check` needed this pass).

### Quiet packaging pass (Jacob priority)
- CSS-only: quieter Needs Attention (pale `#fffbeb`/`#f5e6c8`, flat rows, smaller tags), near-white preview banner, shorter header, flatter sticky (Commit only loud), more air on metrics/chips/pass-out, tighter driver cards; has-plan preserved; `app.html` re-inlined on `style#revamp-css`.

### Daily Load Input — Belize Edit counts + compact restore (2026-09-12 night)
Chrome/CSS/JS packaging only — optimizer untouched.

**Collapsed (has-plan, not editing)**
- Quiet white chip card only: title `Today's loads` (sentence case), pill chips, Coke-red **Edit counts**
- Forces `input-card-collapsed` + `revamp-input-compact`; hides black header, phase grid, totals bar, production `#collapsed-summary` / Expand

**Expanded / Edit counts**
- Body class `revamp-input-editing` while `inputForcedExpand`
- White Belize panel: header `Today's loads` + ghost **Done** (no black bar; “N-phase build order” subtitle killed)
- Slim rows: dest label + count + capacity warn primary; `#` badge / ▲▼ / time / hrs / Same Day behind **Advanced** disclosure
- Quiet gray footer `N loads · ~Xh est.` (not black TOTAL LOADS bar)
- `disabled-loc` banner allowed while editing; still absorbed into Needs Attention when compact
- **No auto-untuck** of templates on Edit counts — **Show templates / manual** only

**Done / Collapse restore (repro fix)**
- Clears `inputForcedExpand`, removes `revamp-input-editing` / `revamp-input-advanced`
- Re-adds `revamp-input-compact`, forces `input-card-collapsed`, shows `#revamp-input-chips`, hides production collapsed-summary
- Wrapped `toggleInputCard` + button listener belt-and-suspenders so legacy cs-chips never stick after Edit counts

**Tokens**
- Border `#d9d9d9`, radius `8px`, shadow max `0 1px 2px rgba(0,0,0,.06)`

### Rebuild / bake
- `app.html` re-inlined `style#revamp-css` + `script#revamp-preview-js`
- `node --check` on preview/js/revamp.js and inlined script: OK

## 2026-09-12 — Drivers + History Belize shell (packaging)
Chrome/CSS (+ tiny revamp.js DOM hooks) only — optimizer / Generate / Commit / assignment untouched.

- **Drivers (`#tab-fleet`):** quiet “Driver Roster” title; vacation tip → calm INFO banner (light blue/gray, not amber warn); white card + light Belize thead (no black bar); softer Available/Vacation badges + toggles; + Add Driver solid Coke primary; Edit/Copy ghost; delete quiet danger icon; rules panel quiet card chrome.
- **History (`#tab-history`):** quiet “Daily Log”; Clear Log demoted (outline danger, tucked under title); white day cards + calm date bar (not red/black); softened chips / efficiency / committed; ⚡/⚠ legend injected under subtitle; empty state white card quiet.
- Scoped under `body.revamp-preview` / `#tab-fleet` / `#tab-history`. `app.html` re-inlined `style#revamp-css` + `script#revamp-preview-js`.

### Pass-out cards calm densify (UX sprint #2 packaging)
Chrome/CSS + revamp.js DOM hooks only — drag/lock/Out/Ad Hoc/What-if/optimizer untouched.

**Header choice:** Belize light header + Coke red initial (not black/navy gradient; matches Drivers/History quieter shell).
- Header: `page-alt` / `#32363a` text / border-bottom `#d9dde0`; circular red `.drv-initial`
- Shoreline: same light header + violet left border / violet initial (not full purple bar)
- Unassigned: same light header + danger accent; inline red header overridden via `!important`
- Arrives time: secondary text (not white-on-navy)

**Other chrome**
- Ad Hoc + What-if parked under `···` `.revamp-card-more` disclosure (MutationObserver / after-render densify on `#driver-cards-grid`); original onclick preserved; default closed
- Out remains clear primary row action; lock quieter secondary
- DOT OK / Near Limit / Over as soft Belize chips in footer
- Deadhead muted secondary line (not amber shout)
- Run rows / what-if panel / modified border softened (no thick amber shout)

**Bake:** `app.html` re-inlined `style#revamp-css` + `script#revamp-preview-js`; `node --check` OK.

## 2026-09-12 — One Commit family (packaging sprint #3)
CSS + revamp.js chrome only — Generate / Commit / optimizer logic untouched; onclick handlers preserved.

- **Single sticky:** mid-page pass-out header keeps **Start Over + Sheet** only; Commit / Print / CSV / Generate·Re-run twins hidden under `has-plan` (DOM nodes kept).
- **Sentence-case** pass-out section label (`Pass-out · N assigned`); kill shouty all-caps micro-header + toolbar hint uppercase.
- **Drivers/History soft sticky:** `body.revamp-sticky-soft` via `syncStickyTabMode` + `switchTab` wrap; status like `Dashboard plan ready · open Dashboard to review pass-outs · N loads`; hide Re-run / Generate fresh / Print / CSV / Commit; quiet **Open Dashboard** text button (`switchTab('dashboard')`).
- Dashboard + has-plan: full sticky restored (Commit primary).
- Bake: `app.html` re-inlined `style#revamp-css` + `script#revamp-preview-js`; `node --check` OK.

## 2026-09-15 — Needs Attention actionable (packaging sprint #4)
Chrome/CSS + revamp.js restyle only — optimizer / Generate / Commit / assignment untouched.

- **Title:** quieter sentence-case `Needs attention` (pill unchanged); soft amber Belize strip preserved.
- **INFO → Settings:** mirrored disabled-loc / Hypothetical rows make `Settings → Destinations` a real `.pq-jump` / `.pq-settings-link` that calls existing `openSettings()`, then scrolls Destinations (`settings-section-title` / `#dest-tbody`) into view.
- **DOMICILE → driver card:** parse driver name from mirrored domicile text; quiet **View** jump → `switchTab('dashboard')` + `scrollIntoView` on `#drv-card-<id>` (or name match via `getState().drivers`) + 2s `revamp-card-flash` outline.
- **Typed chips:** free-prose plan-quality rows classified via regex → short Belize tags `SHORE` / `WINDOW` / `DOCK` (plus existing `HOURS` / `DOMICILE` / `INFO` / `DOT`). Same `.pq-tag` chip pattern.
- **Unused:** still header-only accordion (`N unused ▾`); body unused rows stay hidden — no regress.
- Idempotent `data-revamp-pq` restyle; event delegation on `#plan-quality-content` (no MutationObserver loop).
- Dashboard sticky: light white + `#32363a` text; Coke only on Commit Day — CSS `!important` unchanged.

### Bake
- `app.html` re-inlined `style#revamp-css` + `script#revamp-preview-js` (`</script>` escaped); `node --check` OK.

## 2026-09-15 — Header + DC chip (packaging sprint #5)
Chrome/CSS + revamp.js DOM hooks only — optimizer / Generate / Commit / assignment untouched.

- **`#revamp-dc-chip` primary DC switcher:** pill + readable DC name + chevron; click calls existing `toggleDCSwitcher(event)`. Dropdown relocated into `#revamp-dc-slot` beside the chip (not nested in the button).
- **⇄ demoted:** `#dc-switcher` shell + gear-style ⇄ hidden (`revamp-dc-switcher-demoted`); chip owns switching.
- **Quieter utilities:** `#hdr-dispatchers-btn`, `#hdr-logout-btn`, `.hdr-date` / `#hdr-day`, `#hdr-user-email` muted (smaller, lower contrast, less button-like). Settings gear stays accessible but quieter. Coke red header brand kept.
- **#4 nits folded:** soft-amber `.pq-tag` family (DOCK no longer blue/`info`; WINDOW/SHORE/DOMICILE/HOURS share amber); clear **View** text on DOMICILE rows. SHORE/External Overflow left alone.

### Bake
- `app.html` re-inlined `style#revamp-css` + `script#revamp-preview-js` (`</script>` escaped); `node --check` OK.

## 2026-09-16 — Pass-out scan densify (Wave 2 #6 packaging)
Chrome/CSS only — Generate / Drivers / Commit / optimizer logic untouched; no densifyCardHeaders / MutationObserver changes this pass.

- **Softer card headers:** Belize gray `#f3f4f5`; `.drv-name` weight 600 / secondary; Arrives muted — runs dominate over chrome. Coke red `.drv-initial` kept; Shoreline light header + violet left border kept.
- **Run line scan-first:** `.run-phase` + `.run-hrs` primary (`DEST · ETA · hrs`); nested ETA flattened inline with middot; `.run-label` (RUN/MANUAL/AD HOC) demoted opacity.
- **Lock muted until hover / focus-within** (Out stays primary; stamped lock still quiet at rest).
- **Reorder ▲▼ on hover / focus-within only** (collapsed width at rest).
- **Quieter What-if:** `.wi-label` + banner title muted (panel fill already soft).
- **Drivers action icons:** Edit / Copy / Delete opacity ~0.42 at rest; full on row hover/focus (folded nit).
- Keep: Out primary, Ad Hoc/What-if under ···, DOT soft chips, Commit sticky untouched.

### Bake
- `app.html` re-inlined `style#revamp-css` + `script#revamp-preview-js` (`</script>` escaped); `node --check` OK.

## 2026-09-16 — Pass-out filter tokens (Wave 2 #7 packaging)
Chrome/CSS + revamp.js filter chrome only — Generate / Commit / optimizer / assignment logic untouched.

- **Token bar** replaces Show-all checkbox chrome above `#driver-cards-grid` (Fiori Filter Bar lite).
- Tokens: **Assigned** (default — hide empty/unused) · **Show all** · **Near limit** (`.card-dot-warn` / near-limit / near DOT text) · optional **dest** chips from plan loads (`deriveInputChipParts`, max 6 + “+N more”).
- Live client filter via existing `revamp-empty-hidden` / `display:none`; no backend.
- Empty match: quiet “No drivers match” under tokens.
- Legacy `#revamp-show-all` kept hidden + synced for jump-to-driver “Show all” path (`setPassOutFilter('all')`).
- Keep: #6 densify, Needs Attention, DC chip, Commit sticky.

### Bake
- `app.html` re-inlined `style#revamp-css` + `script#revamp-preview-js` (`</script>` escaped); `node --check` OK.

## 2026-09-16 — Empty states (Wave 2 #8 packaging)
Chrome/CSS + revamp.js empty chrome only — Generate / Commit / optimizer / assignment untouched.

- **Illustrated Message lite** (text-first): `.revamp-empty-im` headline + one-line guidance + optional single CTA; no big illustration in small cards.
- **Unassigned:** calm empty body inside `.is-unassigned` when no runs; fixture/host for “No unassigned loads” spot-check (no persistent happy-path banner).
- **No-plan Dashboard:** quieter `#revamp-noplan-empty` guidance above Generate when `!has-plan`.
- **Drivers empty / History empty:** sentence-case headline + next step; Drivers points at existing **+ Add Driver** (no duplicate loud CTA); History **Open Dashboard** text link.
- **#7 fold-in:** filter empty match → “No drivers match” + **Clear filters** (or Show all) CTA → Assigned; mode tokens (Assigned / Show all / Near limit) soft Coke-tint fill; dest tokens outline when selected.
- Belize text `#6a6d70` / `#32363a`; no emoji art dumps.
- Keep: #6 densify, #7 filter tokens, Needs Attention, DC chip, Commit sticky.

### Bake
- `app.html` re-inlined `style#revamp-css` + `script#revamp-preview-js` (`</script>` escaped); `node --check` OK.

## 2026-09-16 — Needs Attention strip finish (Wave 2 #9 packaging)
Chrome/CSS + revamp.js Needs Attention chrome only — Generate / Commit / optimizer / assignment untouched.

- **Soft strip icon:** optional calm warning glyph on Needs Attention header (Fiori Message Strip lite) — not a loud alert.
- **View link amber/brown:** strengthen `.pq-view-driver` to strip family `#9a7b2f` / `#6b5a2e` (underline + weight). Removed domicile Coke-ish `#9a5555` override.
- **DOCK verify scaffolding:** no demo/fake DOCK row inject found in `revamp.js`; tightened classifier to real dock-wait prose only (`truck waits for dock`) — dropped bare `arrive before`. DOCK chip uses `.pq-tag.dock` in soft-amber family (not blue).
- Keep: soft-amber `.pq-tag` family; typed chips; Settings→Destinations + DOMICILE View jump; soft amber Belize strip overall.
- **#8 nits folded:** empty Unassigned → calm gray avatar/left stripe (`.revamp-unassigned-calm`); ambiguous footer **Clear** chip → **None waiting**; filter empty = two lines (“No drivers match” + Clear filters link).
- Keep: #6 densify, #7 filter tokens, #8 empty states, DC chip, Commit sticky.

### Bake
- `app.html` re-inlined `style#revamp-css` + `script#revamp-preview-js` (`</script>` escaped); `node --check` OK.

## 2026-09-16 — Shell calm + keyboard/focus (Wave 2 #10 packaging)
Chrome/CSS + revamp.js shell only — Generate / Commit / optimizer / assignment untouched.

- **Dispatchers muted:** strip purple 👥 emoji → plain “Dispatchers” text matching Sign Out quiet treatment on Coke red header.
- **`:focus-visible` rings:** Belize/Coke soft outline (`2px solid rgba(230,29,43,~0.5)`, `outline-offset: 2px`) on `#revamp-dc-chip`, tab buttons, Edit counts, sticky actions (Commit/Re-run/Generate/Print/CSV), Needs Attention jumps/Settings links, filter tokens (+ empty CTA).
- **Esc closes:** DC switcher `#dc-switcher-dropdown.open` → remove `open` (sync chip aria); Settings `#settings-modal.open` → existing `closeSettings()` (no new modals).
- **Clear Log:** slightly quieter (lower opacity / softer border) — History only.
- **#9 constraints kept:** INFO `.pq-tag.info` stays blue-gray (not amber); Dashboard sticky remains status left · actions right · Commit (`space-between` / `margin-left: auto`) — no center-shift.
- **Watch-outs folded (capacity):** soft sticky **Open Dashboard** unmistakable (outlined chip + ←); locked (`.stamped`) lock opacity lifted at rest (~0.58 vs unlocked 0.14); Double-Generate busy chrome (`revamp-gen-busy` disables sticky Re-run/Generate fresh + mid `.btn-generate`). Shore carrier rename deferred (not touching Shore labels this pass). Assigned-filter severity + HOURS soft-copy deferred.
- Keep: #6 densify, #7 filter tokens, #8 empty states, #9 Needs strip, DC chip click, Commit sticky.

### Bake
- `app.html` re-inlined `style#revamp-css` + `script#revamp-preview-js` (`</script>` escaped); `node --check` OK.

## 2026-09-16 — Settings quieting (Wave 2 #11 packaging)
Chrome/CSS + revamp.js Settings chrome only — Generate / Commit / optimizer / assignment / role gating untouched. Keep `openSettings()` + Destinations scroll from INFO Needs Attention.

- **Object-page hierarchy:** Settings drawer tiers — Destinations primary list-report block; Phases / Operational secondary; Optimizer Tuning · Data · Load Blending demoted; Danger Zone outline demote. Flat Coke header (no gradient).
- **Destinations list-report:** white card + Belize `#f7f7f7` thead; quieter help + Save/Add chrome.
- **Deferred TP folded:** SHORE/Shore/Shoreline labels → `DC_CONFIG.externalCarrier` (Needs chips, shore card headers, plan-summary hint, Settings carrier display polish). Assigned filter keeps overflow + idle-domicile severity cards glanceable. HOURS soft copy “(OK when loads ≪ roster)” only when soft-rebalance prose is present.
- Keep: #6 densify, #7 filter tokens, #8 empty states, #9 Needs strip, #10 shell focus/Esc, DC chip, Commit sticky.

### Bake
- `app.html` re-inlined `style#revamp-css` + `script#revamp-preview-js` (`</script>` escaped); `node --check` OK.

## 2026-09-16 — Compact density polish (Wave 2 #12 packaging)
Chrome/CSS only — Generate / Commit / optimizer / assignment untouched; Out + phase-input steppers + Commit Day primary sizes locked.

- **Tighter gaps:** pass-out `.driver-cards-grid` gap 10→6; sticky padding/action gaps denser; header utilities gap 8→5; stack/tab-content less air.
- **Slight densify (still breathing):** metrics margin/gap/padding nudge; Needs Attention margin; card header/footer/run-row padding slightly tighter — scan line + Out size unchanged.
- **Hard constraints:** Out button, Edit-counts `phase-input`, Commit Day primary — not shrunk.
- **Optional capacity/stops chip:** skipped (no planned-vs-remaining / fulfillment in card-header DOM).
- **Gen-busy:** already disables real `.btn-generate` (CSS + JS); confirmed, no change.
- Keep: #6 densify, #7 filter tokens, #8 empty states, #9 Needs strip, #10 shell focus/Esc, #11 Settings quieting, DC chip, Commit sticky.

### Bake
- `app.html` re-inlined `style#revamp-css` (JS unchanged); `node --check` OK.
