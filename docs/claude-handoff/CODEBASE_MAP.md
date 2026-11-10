# RouteOptimizer — Codebase Map (grounded audit)

**Source:** `jacobsmolik1/RouteOptimizer` main branch  
**Primary file:** `index.html` (492 268 bytes) — **byte-identical** to `index-unified.html`  
**Also audited:** `supabase-schema.sql`, `supabase-rpc.sql`  
**Legacy/sibling HTML (not the live product):** `index-montgomery.html`, `index-tifton.html`, `index-birmingham.html`, `index-multi-dc.html`  

This map describes the **real product** as coded. No mockup speculation.

---

## 1. App architecture

### Single-page HTML app
- One self-contained SPA: HTML + CSS + JS in `index.html`.
- Modules are IIFE closures re-exported to globals for incremental extraction:
  - `StateManager`, `SupabaseSync`, `Optimizer`, `DcConfig`, `TimeUtils`, `TemplatesAndHistory` (commented regions).
- PWA bits: `manifest.json`, `sw.js` (network-first auto-update).

### Tabs
Visible tab bar (`switchTab`):
| Tab ID | Label | Purpose |
|--------|-------|---------|
| `tab-dashboard` | Dashboard | Daily load input → Generate → metrics / workload / shoreline / plan-quality / driver cards / assignments |
| `tab-fleet` | Drivers | Roster CRUD, vacation toggle, rules panel |
| `tab-history` | History | Committed days + efficiency re-run |

`tab-settings` exists in DOM but is **hidden** (`display:none!important`); settings open via `openSettings()` modal. Kept “for JS `switchTab` compatibility.”

### Auth gate
- `#auth-gate` overlays until Supabase session exists (`startupAuth` → `SupabaseSync.init`).
- Sign-in / sign-up: `handleSignIn` → `SupabaseSync.signIn` / `signUp`.
- Offline / unconfigured: `db` may be `null`; comments say auth gate can skip — app still works on localStorage.
- Access control: `user_dc_access` + RPCs; client filters pickers with `_accessible_dc_slugs`; `enforceDcAccess()` / `amIAdmin()` for UI gating.

### DC selection
- Built-ins in `ALL_DC_CONFIGS`: `montgomery`, `tifton`, `birmingham`.
- Seed rosters in `ALL_DC_DRIVERS` keyed by same ids.
- Active DC: `localStorage._active_dc` → `DC_CONFIG = ALL_DC_CONFIGS[_activeDcId]`.
- `selectDC(id)` writes `_active_dc` and **`location.reload()`**.
- No DC selected → `#dc-selector-screen` overlay; auth gate hidden; init throws `RouteOptimizer: awaiting DC selection`.
- Custom DCs: `_custom_dcs` cache + `create_dc` / `save_dc_config` RPCs; merged into `ALL_DC_CONFIGS` before resolve.
- Per-DC localStorage prefix: `DC_CONFIG.storagePrefix` (`ccu_`, `tif_`, `bhm_` / `{slug}_`).

### External carrier naming
- Montgomery: `externalCarrier: 'SHORELINE'`
- Tifton / Birmingham: `'COWAN'`
- UI still uses “shoreline” as the generic label for external-carrier panels (`renderShoreline`, `#shoreline-panel`).

---

## 2. State — what `StateManager` holds

`StateManager.load()` returns / initializes global `let state = StateManager.load()`:

| Key | Meaning | Persist |
|-----|---------|---------|
| `drivers` | Live roster | localStorage `{P}drivers` + Supabase `drivers` via `save_drivers_for_dc` |
| `destinations` | Dest codes, miles, carrier, windows, `disabled` | `{P}dests` + config sync |
| `settings` | Speed, DOT max, minimizeShoreline, windows, toggles, blends, cardSort | `{P}settings` + day sync + config sync |
| `phases` | Build order: `{label, dest, dispatchTime, buildDay?}` | `{P}phases` + config sync |
| `loads` | Parallel array of per-phase counts | `{P}loads` + day sync |
| `templates` | Weekday load templates | `{P}templates` + day sync |
| `lastResult` | `{assignments, workload, snapshot?}` from optimizer | `{P}lastresult` + day sync |
| `returned` | Map driverId → returned-to-DC flag | `{P}returned` + day sync |
| `history` | Last 60 committed day summaries | `{P}history` (+ loaded from DB committed rows) |
| `whatIf` | Per-driver day overrides (`inactive`, `restriction`) | `{P}whatif` + day sync |
| `bucketAsgn` | Manual pre-assignments before/around generate | `{P}basgn` + day sync |
| `adhocMoves` | Extra trailer moves (consume DOT hours) | `{P}adhoc` + day sync |

### Persistence rules (real code)
- **localStorage is the working store.** Every `save*` writes LS first.
- **Supabase day sync** (`queueSync` → debounced `_syncDay` → RPC `save_dispatch_day`): loads, lastResult, settings, adhoc, bucket, returned, whatIf, templates. Keyed by **local calendar date** `todayLocal()`, not UTC.
- **Driver sync** (`queueDriverSync` → `_syncDrivers` → `save_drivers_for_dc`): full roster upsert; deletions of IDs not in payload.
- **Config sync** (`queueConfigSync` → `save_dc_config`): structural dests/phases/settings/restrictions (admins). Built-in DCs stay code-defined; custom DCs cache in `_custom_dcs`.
- **History** `saveHistory()` is **localStorage only**; DB commit is separate (`commit_dispatch_day`). Pull: `get_history_for_dc`.
- Phase-count mismatch resets phases/loads/templates to defaults (index-coupled).

### Startup hydrate order (`startupAuth` / post-signin)
1. `SupabaseSync.init()` session  
2. `refreshDcConfigs()` (may reload)  
3. `enforceDcAccess()`  
4. `loadDayFromDB()` (newer `updated_at` wins; null-result wipe guarded if local has locks/out-times)  
5. `syncDriversFromDB()` (DB roster **replaces** `state.drivers` if non-empty)  
6. `autoRolloverDay()` (if `planDate` < today → `commitToHistory(oldDate)` + `resetLoads`)  
7. `renderAll()` if anything changed  

---

## 3. Drivers roster

### `ALL_DC_DRIVERS`
Hardcoded seed arrays for `montgomery` (D001–D019), `tifton` (T001–T023), `birmingham` (B001–B015). Used only as `DEFAULT_DRIVERS` when LS empty / first load.

### Fields that matter for assignment
| Field | Role |
|-------|------|
| `id` | Stable key (per-DC; PK is `(dc_id, id)` in DB) |
| `name` | Assignment identity (`autoDriver` / overrides match by **name**) |
| `restriction` | Looked up via `getResDef` → type `only` / `onlyGroup` / `assist` / `first` / `any` |
| `onVacation` | Excluded from `getAvailableDrivers()` |
| `arrivalTime` | Earliest availability (minutes); seeds `returnMinutes` |
| `deadheadMiles` | Morning/evening DH hours = miles / `avgSpeed` |
| `domicileDest` | Home dest code → reserved home pass, one-way last leg, `homeReturn` |
| `homeFirst` | If true: home dest assigned in first-pass instead of reserved home queue |
| `priority` | Dispatch tier (1 = fill first; `>1` = overflow; drives `packOverflow`) |
| `notes` | Display only |

### `syncDriversFromDB` / `save_drivers_for_dc`
- Pull maps snake_case DB columns → camelCase state (see `_syncDrivers` / `syncDriversFromDB`).
- Push sends: `id, name, home_base, restriction, max_loads:99, deadhead_miles, domicile_dest, on_vacation, arrival_time, priority, notes, active:true`.
- **Not synced to Supabase:** `homeFirst` (UI/edit + optimizer use it; DB schema has no `home_first` column). After a DB pull, `homeFirst` can be lost unless still in LS before overwrite — pull **replaces** the whole roster array without merging `homeFirst`.

### Vacation behavior
- `toggleVacation(id, val)` → `d.onVacation = val` → `saveDrivers()` → `markResultStale` → fleet/rules/metrics/bucket/cards refresh.
- Fleet UI: “Toggle Vacation to remove a driver from load assignments.”
- `getAvailableDrivers()`: `!onVacation && !whatIf[id].inactive`; may overlay what-if restriction.
- Bucket pre-assignments for vacationed/inactive drivers are **ignored** (slots return to optimizer).
- Locked loads on vacationed drivers are **not** preservable (`isPreservableLock`) — full re-plan picks them up.
- Workload panel lists vacationed drivers separately; cards exclude vacationed.

---

## 4. Generate pipeline (real algorithm)

### Entrypoints
1. **`generateAssignments()`** (Generate button)  
2. **`rerunRemaining()`** (keep preservable locks / Re-run buttons)  
3. Both call **`runOptimizer(adjustedLoads, minimizeShoreline, preLoads)`** then **`rebalanceFairness()`** and render.

### `generateAssignments` orchestration
1. Reject if sum(`state.loads`) === 0.  
2. If any `isPreservableLock` in `lastResult` → delegate to `rerunRemaining()` (same lock predicate).  
3. Build `preLoads` from `bucketAsgn` (hours, destCounts, assist `colCount`, `returnMinutes`) + `adhocMoves` hours.  
4. Zero loads for `disabled` destinations; subtract bucket counts per phase.  
5. `result = runOptimizer(...)` → `state.lastResult = result` → `rebalanceFairness()` → `saveResult()`.  
6. Render: `renderMetrics`, `renderWorkload`, `renderShoreline`, `renderDriverCards`, `renderAssignmentsTable`, `renderLoadBucket`; collapse input card.

### Restriction types (`DC_CONFIG.restrictions` + `getResDef`)
| type | Behavior in optimizer |
|------|------------------------|
| `only` | `findExclusive` only; never general pool; no home reservation (they always run that dest via exclusive path) |
| `onlyGroup` | General pool but only for `destCodes`; **do** get reserved home slot |
| `assist` | After exclusive fail: `findAssist` with per-driver `cap` (default 1) on assist dest (`colCount`) |
| `first` | Pre-assign required dest first; while those loads remain, block first-restricted drivers from other dests until they have a load (`aubLoadsRemain`) |
| `any` | General pool |

Helpers: `driverCanTakeDest`, `destCanExternal`, `destIsExternalOnly`, `getExclusivePhaseCapRule` (e.g. Montgomery COL “Small Store” max 1/driver).

### `runOptimizer` phase / pass order (plain language + function names)

**Setup**
- `available = getAvailableDrivers()`; per-driver accumulator `ds[id]` (hours, morningDH/eveningDH, loadCount, colCount, destCounts, phaseCapCounts, homeHrs, reservedSlot, returnMinutes).
- Morning deadhead charged upfront; evening reserved then settled later.
- Window helpers: `getReceiverWindow`, `wouldMissReceiverWindow`, `wouldExceedWindow`, `getCandidateTiming`, `timingAllowed`, `homeReturnStaysFeasible` (if `protectHomeReturn`).
- Settings in play: `dotMaxHours`, `protectHomeReturn`, `protectWindows` (defaults **true** via `?? true` — **not** the DEFAULT_SETTINGS key `windowProtect`), `packOverflow`, `minimizeShoreline` (arg), `rescueStranded`, delivery/receiver windows.

**Pass A — Reserve home slots**  
For each available driver with `domicileDest`, not `homeFirst`, not external-only home, not type `only`: decrement one matching phase count; add to `reservedForHome` / `homePassQueue`; set `reservedSlot = 1`.

**Pass B — First-run pre-assign**  
`first` restriction dest **or** `homeFirst` domicile: take one load at full RT hours if DOT + midnight OK; push assignment.

**Pass C — Main load sequence**  
- Build `phaseOrder`: sort by (internal-only first if `prioritizeInternalOnlyDestinations`), then full-day rank, then dispatch time.  
- Expand via `buildBlendedLoadSequence` (optional `settings.blends` chunk interleave).  
- Per load, try in order:
  1. `only` → `findExclusive` (or phase-cap special filter)
  2. `assist` → `findAssist`
  3. `findGeneral` (if not ext-only; and for external-eligible dests only if `assignExternalEligibleToInternal`)
  4. `findAnyAvailable` (same gate)
  5. Else `autoDriver = externalCarrier` or `'UNASSIGNED'` + `externalReason` from `getExternalReason` (`restriction` / `dot_limit` / `schedule` / `carrier_only`)

**`findGeneral` / `findAnyAvailable` sort (abbreviated)**  
Window fit (`protectWindows`) → `driverPriority` → `packOverflow` for priority>1 → earliest available → delivery-window pack → route package packing → receiver window → home-extra → DOT-tight → effective load count → hours.

**Pass D — Home pass** (`homePassQueue`)  
Assign reserved home as final run (`homePass: true`) if DOT + midnight OK; else try `findGeneral`/`findAnyAvailable` fallback; else external/UNASSIGNED.

**Pass E — Rescue stranded internal-only** (if `settings.rescueStranded ?? optimizer.rescueStrandedInternal`)  
For each `UNASSIGNED` load: yield an overflow-eligible internal load to carrier (`rescueYielded`), free capacity, place stranded via finders; revert if no valid placement.

**Pass F — Deadhead / home-return settle**  
If last load (or homePass) is domicile dest → `homeReturn: true`, subtract evening DH; else add evening DH. Bucket-only home return also cancels evening DH.

**Pass G — Minimize shoreline** (if `minimizeShoreline`)  
Sweep carrier assignments (skip `rescueYielded`); pull onto Any/assist drivers with remaining DOT/midnight/`homeReturnStaysFeasible`.

**Return** `{ assignments, workload }`.

### Post-optimizer: `rebalanceFairness`
- If `settings.fairnessEnabled ?? fairness.enabled !== false`, swap/move loads to shrink hour spread under DOT/rules; respects locks.

### DOT / home / packOverflow / windowProtect (actual names)
- **DOT:** hard filter `(hours + trip + homeHrs) <= dotMaxHours` in finders; home pass uses one-way; display adds `BREAK_HRS = 0.5` **display-only**.
- **Home base / deadhead:** `deadheadMiles`, `domicileDest`, reserved home pass, `protectHomeReturn` / `toggleProtectHome`.
- **`packOverflow`:** `state.settings.packOverflow` — pack started overflow-tier trucks before opening new ones (`driverPriority > 1`). Default `false` in `DEFAULT_SETTINGS`; used in finders (no dedicated toggle name found beyond settings object).
- **Window protect:** UI toggle `toggleWindowProtect` writes **`state.settings.protectWindows`**. Optimizer reads `protectWindows ?? true`. Legacy comment: old key `windowProtect:false` must not force off — hence the rename. `DEFAULT_SETTINGS.windowProtect` is **stale/unused** by the live path.

---

## 5. Post-generate UI

After generate, Dashboard shows:

| UI | Function | DOM |
|----|----------|-----|
| Metrics | `renderMetrics` | `#metrics-grid`, `#m-total`, `#m-internal`, `#m-shore`, `#m-dot-ok`, … |
| Workload / DOT bars | `renderWorkload` | `#workload-list`, return toggles `toggleReturned` |
| External carrier panel | `renderShoreline` | `#shoreline-panel` / `#shoreline-content` |
| Domicile warnings | `renderDomicileWarnings` / `getDomicileRuleViolations` | `#domicile-warning-panel` |
| Plan quality | `getPlanQualityWarnings` → `renderPlanQuality` | `#plan-quality-panel` |
| Driver cards | `renderDriverCards` | `#driver-cards-section`, `#driver-cards-grid`, cards `drv-card-${id}` |
| Assignments table | `renderAssignmentsTable` | `#assignments-table` |
| Load bucket review | `renderLoadBucket` | `#load-bucket-panel` |
| Commit | `commitToHistory()` | `#commit-day-btn`, `#commit-badge` |

### Driver cards
- Group optimizer + bucket + ad-hoc runs; shared ETAs via `computeRunTimings`.
- Manual reorder (`moveRun`, drag/drop), out-time stamp (`openOutModal` / `saveOutTime`), what-if inactive, reassign modals.
- Shoreline / UNASSIGNED get their own pseudo-cards.

### `commitToHistory` / Supabase day sync
1. Build history entry: totals, shoreline count, `driverHours` from workload, `driverRuns` via `buildDriverRuns`, `loads`, `snapshot` (`buildPlanSnapshot`).  
2. Upsert into `state.history` (max 60) → `saveHistory()` (LS).  
3. Best-effort `SupabaseSync.commitDay(date)` → RPC `commit_dispatch_day` sets `status='committed'`.  
4. Ongoing edits already debounce through `save_dispatch_day` (draft).

---

## 6. Morning dispatcher loop (as coded)

See also `MORNING_FLOW.md`. Coded path:

1. Open app → DC from `_active_dc` (or pick DC → reload).  
2. `init()` → local `state` from LS → UI → `startupAuth()`.  
3. Auth → pull day + drivers → optional rollover (commit yesterday, clear sheet).  
4. Enter phase load counts (`#phase-input-${idx}` / templates / bucket pre-assigns).  
5. Optional: vacation/what-if, settings toggles (minimize shoreline, rescue, protect home, window protect, fairness).  
6. **Generate** → `generateAssignments` → review metrics / cards / shoreline / plan-quality.  
7. Manual fixes: overrides, locks/out-times, bucket, ad-hoc, reassign shoreline to returned.  
8. Further changes with locks → **Re-run** (`rerunRemaining`).  
9. **Commit Day** → local history + DB committed status.  
10. Autosave to Supabase draft continuously while working.

---

## 7. Fragile points for a UI-only revamp

Packaging/UI must **not** rename or drop these without updating all call sites (mostly inline `onclick=` and `getElementById`).

### Global functions (onclick / entrypoints) — do not break
`generateAssignments`, `rerunRemaining`, `commitToHistory`, `switchTab`, `selectDC`, `toggleVacation`, `saveDriver`, `openEditDriver`, `openAddDriver`, `renderFleetTable`, `handleSignIn`, `handleSignOut`, `openSettings`, `saveSettings`, `toggleRescueStranded`, `toggleProtectHome`, `toggleWindowProtect`, `toggleFairness`, `reassignShorelineToReturned`, `toggleReturned`, `loadTemplate`, `saveTemplate`, `exportCSV`, `exportSheet`, `resetLoads` / clear-day helpers, drag helpers (`handleDragStart`, `moveRun`, …), bucket pick helpers, etc. (~82 onclick entrypoints).

### Critical DOM IDs
`auth-gate`, `auth-form`, `auth-email`, `auth-password`, `tab-dashboard`, `tab-fleet`, `tab-history`, `phase-inputs`, `phase-input-*`, `metrics-grid`, `m-*`, `workload-list`, `shoreline-panel`, `shoreline-content`, `plan-quality-panel`, `plan-quality-content`, `driver-cards-section`, `driver-cards-grid`, `assignments-table`, `load-bucket-panel`, `commit-day-btn`, `commit-badge`, `sync-indicator`, `stale-result-banner`, `fleet-tbody`, `history-content`, `template-days`, `rescue-stranded-toggle`, `protect-home-toggle`, `window-protect-toggle`, `fairness-toggle`, `drv-*` modal fields, `input-toggle-btn`.

### Algorithm / state contracts
- Assignment identity is **driver `name` string**, not id — renames must rewrite bucket/adhoc/result.  
- `state.loads[i]` ↔ `state.phases[i]` index coupling.  
- Lock semantics: `actualOutTime` or `locked`; preservable via `isPreservableLock`.  
- `DC_CONFIG.id` must match Supabase `dcs.slug`.  
- `externalCarrier` string must match assignment `autoDriver` and destination `carrier` text matching.  
- Settings key mismatch: UI/runtime use `protectWindows`; seed still has unused `windowProtect`.  
- `homeFirst` not in Supabase schema — DB pull drops it.  
- `nextId()` only scans numeric suffix after `'D'` — weak for T/B prefixes.  
- Fairness / rescue / minimize shoreline order after generate is load-bearing; UI wrappers must still call `generateAssignments` / `rerunRemaining` / `rebalanceFairness` chain.  
- `index.html` ≡ `index-unified.html` — dual publish must stay in sync.

### localStorage keys (per DC prefix `P`)
`drivers`, `dests`, `settings`, `phases`, `loads`, `templates`, `lastresult`, `returned`, `history`, `whatif`, `basgn`, `adhoc`, `planDate`, `_dbsync`, `_cfgsync`  
Global: `_active_dc`, `_accessible_dc_slugs`, `_custom_dcs`.

### Supabase RPCs the client expects
`get_dispatch_day`, `save_dispatch_day`, `commit_dispatch_day`, `get_history_for_dc`, `get_drivers_for_dc`, `save_drivers_for_dc`, `list_accessible_dcs`, `save_dc_config`, `create_dc`, `list_dc_members`, `grant_dc_access`, `revoke_dc_access`, `am_i_dc_admin`.

---

## File sizes / identity (verified)

| File | Size |
|------|------|
| `index.html` | 492 268 |
| `index-unified.html` | 492 268 (identical) |
| `supabase-schema.sql` | 13 046 |
| `supabase-rpc.sql` | 19 380 |

