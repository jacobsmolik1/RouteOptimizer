// —— Events ——
  $('needsToggle').onclick = function () {
    state.needsOpen = !state.needsOpen;
    refresh();
  };

  $('needsBody').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-dismiss]');
    if (!btn || state.committed) return;
    const id = btn.getAttribute('data-dismiss');
    state.issues = state.issues.filter(i => i.id !== id);
    refresh();
    toast('Issue dismissed', 'info');
  });

  $('unusedToggle').onclick = function () {
    state.unusedOpen = !state.unusedOpen;
    refresh();
  };

  $('unusedChips').addEventListener('click', function (e) {
    const chip = e.target.closest('[data-driver]');
    if (!chip || state.committed) return;
    const driverId = chip.getAttribute('data-driver');
    if (state.selectedLoadId) {
      assignLoadToDriver(state.selectedLoadId, driverId);
      return;
    }
    openAssignModal(driverId);
  });

  $('unassignedLoads').addEventListener('click', function (e) {
    const chip = e.target.closest('[data-load]');
    if (!chip || state.committed) return;
    const loadId = chip.getAttribute('data-load');
    state.selectedLoadId = state.selectedLoadId === loadId ? null : loadId;
    renderUnassignedLoads();
    if (state.selectedLoadId) toast('Load selected — click an unused driver or empty card', 'info');
  });

  $('unassignedLoads').addEventListener('dragstart', function (e) {
    const chip = e.target.closest('[data-load]');
    if (!chip) return;
    e.dataTransfer.setData('text/load-id', chip.getAttribute('data-load'));
    e.dataTransfer.effectAllowed = 'move';
    chip.classList.add('dragging');
  });
  $('unassignedLoads').addEventListener('dragend', function (e) {
    const chip = e.target.closest('[data-load]');
    if (chip) chip.classList.remove('dragging');
  });

  $('driverList').addEventListener('dragover', function (e) {
    const card = e.target.closest('[data-drop-target]');
    if (!card) return;
    e.preventDefault();
    card.classList.add('drag-over');
  });
  $('driverList').addEventListener('dragleave', function (e) {
    const card = e.target.closest('[data-drop-target]');
    if (card) card.classList.remove('drag-over');
  });
  $('driverList').addEventListener('drop', function (e) {
    const card = e.target.closest('[data-drop-target]');
    if (!card) return;
    e.preventDefault();
    card.classList.remove('drag-over');
    const loadId = e.dataTransfer.getData('text/load-id') || state.selectedLoadId;
    if (loadId) assignLoadToDriver(loadId, card.getAttribute('data-drop-target'));
  });

  $('driverList').addEventListener('click', function (e) {
    const unBtn = e.target.closest('[data-unassign]');
    if (unBtn && !state.committed) {
      const id = unBtn.getAttribute('data-unassign');
      const a = state.assignments.find(x => x.driverId === id);
      if (a) {
        const loadId = a.loadId;
        state.assignments = state.assignments.filter(x => x.driverId !== id);
        refresh();
        toast('Unassigned ' + loadId + ' — drag or click to reassign', 'info');
      }
      return;
    }
    const statusBtn = e.target.closest('[data-toggle-status]');
    if (statusBtn && !state.committed) {
      const id = statusBtn.getAttribute('data-toggle-status');
      const a = state.assignments.find(x => x.driverId === id);
      if (a) {
        a.status = a.status === 'Out' ? 'Pending' : 'Out';
        a.badge = a.status === 'Out' ? 'OUT' : 'RUN';
        refresh();
      }
      return;
    }
    const empty = e.target.closest('[data-empty-driver]');
    if (empty && !state.committed) {
      const driverId = empty.getAttribute('data-empty-driver');
      if (state.selectedLoadId) {
        assignLoadToDriver(state.selectedLoadId, driverId);
      } else {
        openAssignModal(driverId);
      }
    }
  });

  $('assignModalLoads').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-pick-load]');
    if (!btn) return;
    const loadId = btn.getAttribute('data-pick-load');
    const driverId = state.pendingDriverId;
    closeAssignModal();
    if (driverId) assignLoadToDriver(loadId, driverId);
  });
  $('assignModalCancel').onclick = closeAssignModal;
  $('assignModal').addEventListener('click', function (e) {
    if (e.target === $('assignModal')) closeAssignModal();
  });

  $('btnLoadInput').onclick = function () {
    state.editOpen = !state.editOpen;
    $('editPanel').classList.toggle('open', state.editOpen);
    if (state.editOpen) {
      $('inpPan').value = state.pan;
      $('inpCol').value = state.col;
      $('inpMob').value = state.mob;
    }
  };
  $('btnCancelEdit').onclick = function () {
    state.editOpen = false;
    $('editPanel').classList.remove('open');
  };
  $('btnApplyEdit').onclick = function () {
    state.pan = Math.max(0, parseInt($('inpPan').value, 10) || 0);
    state.col = Math.max(0, parseInt($('inpCol').value, 10) || 0);
    state.mob = Math.max(0, parseInt($('inpMob').value, 10) || 0);
    state.editOpen = false;
    $('editPanel').classList.remove('open');
    regenerateAssignments();
    refresh();
    toast('Loads applied — assignments regenerated', 'success');
  };

  $('showAllDrivers').onchange = function () {
    state.showAll = this.checked;
    renderDrivers();
  };

  // DC dropdown
  $('dcBtn').onclick = function (e) {
    e.stopPropagation();
    const open = $('dcMenu').classList.toggle('open');
    $('dcBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  $('dcMenu').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-dc]');
    if (!btn) return;
    state.dc = btn.getAttribute('data-dc');
    $('dcLabel').textContent = state.dc;
    $('brandSub').textContent = btn.getAttribute('data-sub');
    $('dcMenu').querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
    $('dcMenu').classList.remove('open');
    toast('Switched to ' + state.dc, 'info');
  });
  document.addEventListener('click', function () {
    $('dcMenu').classList.remove('open');
  });

  // Date
  $('dateBtn').onclick = function () {
    if (state.committed) return;
    try {
      $('dateInput').showPicker();
    } catch (err) {
      $('dateInput').click();
    }
  };
  $('dateInput').onchange = function () {
    const v = this.value;
    if (!v) return;
    state.dateISO = v;
    const d = new Date(v + 'T12:00:00');
    state.dateStr = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    $('dateVal').textContent = state.dateStr;
  };

  // Re-run
  $('btnRerun').onclick = function () {
    if (state.committed) return;
    state.rerunTick += 1;
    // Reshuffle: rotate drivers among current loads
    const loads = state.assignments.map(a => ({ id: a.loadId, type: a.type }));
    if (loads.length === 0) {
      regenerateAssignments();
    } else {
      const unused = unusedDrivers();
      const pool = state.assignments.map(a => DRIVER_POOL.find(d => d.id === a.driverId)).concat(unused);
      // rotate
      const rot = state.rerunTick % pool.length;
      const rotated = pool.slice(rot).concat(pool.slice(0, rot));
      const next = [];
      const usedIds = new Set();
      loads.forEach(function (load, i) {
        let driver = rotated[i % rotated.length];
        let guard = 0;
        while (usedIds.has(driver.id) && guard < rotated.length) {
          driver = rotated[(i + guard + 1) % rotated.length];
          guard++;
        }
        usedIds.add(driver.id);
        next.push(makeAssignment(driver, load, state.rerunTick));
      });
      state.assignments = next;
    }
    const flash = new Set(state.assignments.map(a => a.driverId));
    refresh(flash);
    toast('Optimizer re-ran — assignments reshuffled', 'info');
  };

  $('btnPrint').onclick = function () {
    window.print();
  };

  $('btnCsv').onclick = function () {
    const rows = [['Driver', 'Load', 'Destination', 'ETA', 'Status', 'Hours']];
    state.assignments.forEach(function (a) {
      rows.push([a.name, a.loadId, a.dest, a.eta, a.status, a.hours]);
    });
    const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'route-optimizer-' + state.dateISO + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('CSV downloaded', 'success');
  };

  $('btnCommit').onclick = function () {
    state.committed = true;
    state.editOpen = false;
    $('editPanel').classList.remove('open');
    refresh();
    toast('Day committed (offline) — edits locked until Unlock', 'success');
  };
  $('btnUnlock').onclick = function () {
    state.committed = false;
    refresh();
    toast('Day unlocked — editing enabled', 'info');
  };

  // Init
  regenerateAssignments();
  refresh();
