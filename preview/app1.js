const DEST_META = {
    PAN: { city: 'Panama City', state: 'FL', short: 'Panama City', etaBase: '3:16 PM', drive: 3.76 },
    COL: { city: 'Columbus', state: 'GA', short: 'Columbus', etaBase: '4:02 PM', drive: 4.10 },
    MOB: { city: 'Mobile', state: 'AL', short: 'Mobile', etaBase: '5:10 PM', drive: 4.50 }
  };

  const DRIVER_POOL = [
    { id: 'jr', name: 'JR Mesi', initials: 'JM' },
    { id: 'gg', name: 'Gabriel Gooch', initials: 'GG' },
    { id: 'mh', name: 'Marcus Hale', initials: 'MH' },
    { id: 'tb', name: 'Tina Brooks', initials: 'TB' },
    { id: 'dp', name: 'Dev Patel', initials: 'DP' },
    { id: 'an', name: 'Amy Nguyen', initials: 'AN' },
    { id: 'cr', name: 'Carlos Ruiz', initials: 'CR' },
    { id: 'sk', name: 'Sara Klein', initials: 'SK' },
    { id: 'bo', name: 'Ben Ortiz', initials: 'BO' },
    { id: 'np', name: 'Nina Park', initials: 'NP' },
    { id: 'la', name: 'Luke Anders', initials: 'LA' },
    { id: 'ps', name: 'Priya Shah', initials: 'PS' },
    { id: 'od', name: 'Omar Diaz', initials: 'OD' },
    { id: 'kf', name: 'Kelly Frost', initials: 'KF' },
    { id: 'wh', name: 'Wes Harper', initials: 'WH' },
    { id: 'jq', name: 'Jade Quinn', initials: 'JQ' },
    { id: 'rb', name: 'Ron Blake', initials: 'RB' },
    { id: 'mt', name: 'Mia Torres', initials: 'MT' },
    { id: 'cv', name: 'Chris Vance', initials: 'CV' }
  ];

  let state = {
    pan: 1,
    col: 1,
    mob: 0,
    dc: 'Montgomery DC',
    dateStr: 'May 20, 2025',
    dateISO: '2025-05-20',
    needsOpen: false,
    unusedOpen: false,
    editOpen: false,
    showAll: false,
    committed: false,
    rerunTick: 0,
    selectedLoadId: null,
    pendingDriverId: null,
    issues: [
      { id: 'i1', tag: 'warn', label: 'HOURS', text: 'Hour spread 7.5h (JR Mesi) vs 0.0h unused — expected on a 2-load plan' },
      { id: 'i2', tag: 'info', label: 'INFO', text: 'Mobile, Leroy, Valparaiso… still disabled — excluded from plan' }
    ],
    assignments: []
  };

  const $ = (id) => document.getElementById(id);

  function toast(msg, kind) {
    const wrap = $('toastWrap');
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.innerHTML = '<span></span><button type="button" class="toast-x" aria-label="Dismiss">×</button>';
    el.querySelector('span').textContent = msg;
    el.querySelector('.toast-x').onclick = () => el.remove();
    wrap.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 2800);
  }

  function initials(name) {
    return name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
  }

  function totalLoads() {
    return (Number(state.pan) || 0) + (Number(state.col) || 0) + (Number(state.mob) || 0);
  }

  function buildLoadList() {
    const loads = [];
    for (let i = 1; i <= state.pan; i++) loads.push({ id: 'PAN-' + i, type: 'PAN', num: i });
    for (let i = 1; i <= state.col; i++) loads.push({ id: 'COL-' + i, type: 'COL', num: i });
    for (let i = 1; i <= state.mob; i++) loads.push({ id: 'MOB-' + i, type: 'MOB', num: i });
    return loads;
  }

  function etaFor(type, tick) {
    const base = DEST_META[type].etaBase;
    if (!tick) return base;
    // nudge minutes slightly
    const m = base.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return base;
    let h = parseInt(m[1], 10);
    let min = parseInt(m[2], 10) + tick * 3;
    const ap = m[3].toUpperCase();
    while (min >= 60) { min -= 60; h += 1; }
    if (h > 12) h -= 12;
    return h + ':' + String(min).padStart(2, '0') + ' ' + ap;
  }

  function makeAssignment(driver, load, tick) {
    const meta = DEST_META[load.type];
    const drive = (meta.drive + (tick || 0) * 0.02).toFixed(2);
    return {
      driverId: driver.id,
      name: driver.name,
      initials: driver.initials || initials(driver.name),
      loadId: load.id,
      type: load.type,
      dest: meta.city + ', ' + meta.state,
      destShort: meta.short,
      eta: etaFor(load.type, tick || 0),
      drive: drive + 'h',
      hours: (parseFloat(drive) + 4.2 + (tick || 0) * 0.03).toFixed(2) + ' hrs',
      status: 'Pending',
      badge: 'RUN'
    };
  }

  function regenerateAssignments() {
    const loads = buildLoadList();
    const pool = DRIVER_POOL.slice();
    const next = [];
    loads.forEach((load, idx) => {
      const driver = pool[idx % pool.length];
      next.push(makeAssignment(driver, load, state.rerunTick));
    });
    state.assignments = next;
    // Update hours issue text if still present
    const hoursIssue = state.issues.find(i => i.id === 'i1');
    if (hoursIssue && next.length) {
      const hrs = (7.5 + state.rerunTick * 0.1).toFixed(1);
      hoursIssue.text = 'Hour spread ' + hrs + 'h (' + next[0].name + ') vs 0.0h unused — expected on a ' + loads.length + '-load plan';
    }
  }

  function assignedDriverIds() {
    return new Set(state.assignments.map(a => a.driverId));
  }

  function unusedDrivers() {
    const used = assignedDriverIds();
    return DRIVER_POOL.filter(d => !used.has(d.id));
  }

  function unassignedLoads() {
    const assignedLoadIds = new Set(state.assignments.map(a => a.loadId));
    return buildLoadList().filter(l => !assignedLoadIds.has(l.id));
  }

  function overflow() {
    return Math.max(0, totalLoads() - DRIVER_POOL.length);
  }

  // —— Render ——
  function renderChips() {
    const t = totalLoads();
    const parts = [];
    parts.push('<span class="chip em">' + t + ' load' + (t === 1 ? '' : 's') + '</span>');
    if (state.pan > 0) parts.push('<span class="chip fill">PAN</span>');
    if (state.col > 0) {
      parts.push('<span class="chip muted">' + state.col + ' COL <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6"/></svg></span>');
    }
    if (state.mob > 0) parts.push('<span class="chip muted">' + state.mob + ' MOB</span>');
    $('loadChips').innerHTML = parts.join('');
  }

  function renderMetrics() {
    const t = totalLoads();
    const used = state.assignments.length;
    $('mTotal').textContent = String(t);
    $('mDrivers').textContent = String(used);
    $('mOverflow').textContent = String(overflow());
    $('mDot').textContent = 'OK';
  }

  function renderNeeds() {
    const n = state.issues.length;
    const sec = $('needsSec');
    if (n === 0) {
      sec.classList.add('hidden');
      return;
    }
    sec.classList.remove('hidden');
    sec.classList.toggle('open', state.needsOpen);
    $('needsToggle').setAttribute('aria-expanded', state.needsOpen ? 'true' : 'false');
    $('needsPill').textContent = n + ' item' + (n === 1 ? '' : 's');
    $('needsSub').textContent = n + ' unassigned or conflicted item' + (n === 1 ? '' : 's') + ' require review.';
    $('needsBody').innerHTML = state.issues.map(function (iss) {
      return '<div class="needs-item" data-id="' + iss.id + '">' +
        '<span class="tag ' + iss.tag + '">' + iss.label + '</span>' +
        '<span>' + iss.text + '</span>' +
        '<button type="button" class="dismiss" data-dismiss="' + iss.id + '" title="Dismiss" aria-label="Dismiss">×</button>' +
        '</div>';
    }).join('');
  }

  function renderUnused() {
    const unused = unusedDrivers();
    const sec = $('unusedSec');
    sec.classList.toggle('open', state.unusedOpen);
    $('unusedToggle').setAttribute('aria-expanded', state.unusedOpen ? 'true' : 'false');
    $('unusedCountLabel').textContent = unused.length + ' driver' + (unused.length === 1 ? '' : 's');
    $('unusedChips').innerHTML = unused.map(function (d) {
      return '<button type="button" class="unused-chip" data-driver="' + d.id + '">' +
        '<span class="av">' + (d.initials || initials(d.name)) + '</span>' + d.name + '</button>';
    }).join('') || '<span style="font-size:12px;color:var(--gray-400)">All drivers assigned</span>';
  }

  function renderUnassignedLoads() {
    const loads = unassignedLoads();
    const wrap = $('unassignedLoads');
    if (loads.length === 0) {
      wrap.classList.remove('visible');
      wrap.innerHTML = '<span class="ulabel">UNASSIGNED LOADS</span>';
      return;
    }
    wrap.classList.add('visible');
    wrap.innerHTML = '<span class="ulabel">UNASSIGNED LOADS</span>' + loads.map(function (l) {
      const sel = state.selectedLoadId === l.id ? ' selected' : '';
      return '<button type="button" class="load-chip-draggable' + sel + '" draggable="true" data-load="' + l.id + '" data-type="' + l.type + '">' +
        l.id + ' · ' + DEST_META[l.type].short + '</button>';
    }).join('');
  }

  function renderDrivers(flashIds) {
    const list = $('driverList');
    const unused = unusedDrivers();
    const hasEmpty = unused.length > 0;
    $('showAllWrap').style.display = hasEmpty ? '' : 'none';

    const assigned = state.assignments;
    $('assignedSub').textContent = assigned.length + ' driver' + (assigned.length === 1 ? '' : 's') + ' assigned' +
      (unassignedLoads().length === 0 && totalLoads() > 0 ? ' • All loads placed' :
        (unassignedLoads().length ? ' • ' + unassignedLoads().length + ' load' + (unassignedLoads().length === 1 ? '' : 's') + ' unassigned' : ''));

    let html = '';
    if (assigned.length === 0 && !state.showAll) {
      html = '<div class="empty-state">No assignments — open Daily Load Input or assign from Unused Drivers.</div>';
    }

    assigned.forEach(function (a) {
      const flash = flashIds && flashIds.has(a.driverId) ? ' flash' : '';
      const badgeClass = a.status === 'Out' ? 'out' : 'run';
      const badgeText = a.status === 'Out' ? 'OUT' : 'RUN';
      const btnClass = a.status === 'Out' ? ' is-out' : '';
      const btnLabel = a.status === 'Out' ? 'Out' : 'Pending';
      html += '<article class="driver-card' + flash + '" data-driver="' + a.driverId + '">' +
        '<div class="avatar">' + a.initials + '</div>' +
        '<div class="driver-info">' +
          '<div class="driver-name-row"><strong>' + a.name + '</strong><span class="badge ' + badgeClass + '">' + badgeText + '</span></div>' +
          '<div class="loc"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>' + a.destShort + '</div>' +
        '</div>' +
        '<div class="driver-divider"></div>' +
        '<div class="driver-status">' +
          '<div class="dot-ok"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg> DOT OK</div>' +
          '<div class="load-id">Load: ' + a.loadId + '</div>' +
        '</div>' +
        '<button type="button" class="status-btn' + btnClass + ' editable-only" data-toggle-status="' + a.driverId + '">' + btnLabel + '</button>' +
        '<button type="button" class="unassign-btn editable-only" data-unassign="' + a.driverId + '" title="Unassign load">×</button>' +
        '</article>';
    });

    if (state.showAll) {
      unused.forEach(function (d) {
        html += '<article class="driver-card empty" data-empty-driver="' + d.id + '" data-drop-target="' + d.id + '">' +
          '<div class="avatar">' + (d.initials || initials(d.name)) + '</div>' +
          '<div class="driver-info">' +
            '<div class="driver-name-row"><strong>' + d.name + '</strong></div>' +
            '<div class="empty-drop-hint">Drop a load here · or click an unassigned load chip first</div>' +
          '</div></article>';
      });
    }

    list.innerHTML = html;
  }

  function renderDetails() {
    const body = $('detailsBody');
    const rows = state.assignments;
    body.innerHTML = rows.map(function (a) {
      return '<tr><td>' + a.name + '</td><td>' + a.loadId + '</td><td>' + a.destShort + '</td><td>' + a.eta +
        '</td><td class="status-cell ' + a.status + '">' + a.status + '</td></tr>';
    }).join('') || '<tr><td colspan="5" style="color:var(--gray-400)">No assignments</td></tr>';
  }

  function refresh(flashIds) {
    renderChips();
    renderMetrics();
    renderNeeds();
    renderUnused();
    renderUnassignedLoads();
    renderDrivers(flashIds);
    renderDetails();
    document.body.classList.toggle('committed', state.committed);
  }

  // —— Assign helpers ——
  function assignLoadToDriver(loadId, driverId) {
    if (state.committed) return;
    const load = buildLoadList().find(l => l.id === loadId);
    const driver = DRIVER_POOL.find(d => d.id === driverId);
    if (!load || !driver) return;
    // Remove existing assignment for this load or this driver
    state.assignments = state.assignments.filter(a => a.loadId !== loadId && a.driverId !== driverId);
    state.assignments.push(makeAssignment(driver, load, state.rerunTick));
    state.selectedLoadId = null;
    state.pendingDriverId = null;
    refresh(new Set([driverId]));
    toast('Assigned ' + loadId + ' → ' + driver.name, 'success');
  }

  function openAssignModal(driverId) {
    const loads = unassignedLoads();
    if (loads.length === 0) {
      toast('No unassigned loads — raise counts in Daily Load Input', 'warn');
      return;
    }
    const driver = DRIVER_POOL.find(d => d.id === driverId);
    state.pendingDriverId = driverId;
    $('assignModalTitle').textContent = 'Assign ' + (driver ? driver.name : 'driver');
    $('assignModalSub').textContent = 'Select an unassigned load.';
    $('assignModalLoads').innerHTML = loads.map(function (l) {
      return '<button type="button" data-pick-load="' + l.id + '">' + l.id + ' · ' + DEST_META[l.type].short + '</button>';
    }).join('');
    $('assignModal').classList.add('open');
  }

  function closeAssignModal() {
    $('assignModal').classList.remove('open');
    state.pendingDriverId = null;
  }
