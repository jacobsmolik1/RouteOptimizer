/* REVAMP_SW_KILL */
(function revampKillServiceWorkers() {
  try {
    if (typeof REVAMP_PREVIEW === 'undefined' || !REVAMP_PREVIEW) return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      return Promise.all(regs.map(function (r) { return r.unregister(); }));
    }).then(function () {
      if (!window.caches || !caches.keys) return;
      return caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      });
    }).catch(function () {});
  } catch (e) {}
})();

/* REVAMP PREVIEW wrappers - packaging only; does not rewrite optimizer */
(function () {
  'use strict';
  var REVAMP_PREVIEW = true;
  window.REVAMP_PREVIEW = REVAMP_PREVIEW;
  if (!REVAMP_PREVIEW) return;

  document.documentElement.classList.add('revamp-preview');
  document.body.classList.add('revamp-preview');

  if (!document.querySelector('.revamp-preview-banner')) {
    var b = document.createElement('div');
    b.className = 'revamp-preview-banner no-print';
    b.innerHTML = 'REVAMP PREVIEW - real production app + packaging chrome | use <span>Montgomery Test</span> DC | does not replace live deploy';
    document.body.insertBefore(b, document.body.firstChild);
  }

  document.querySelectorAll('.test-banner').forEach(function (el) {
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
  });

  var sticky = document.getElementById('revamp-sticky-bar');
  if (!sticky) {
    sticky = document.createElement('div');
    sticky.id = 'revamp-sticky-bar';
    sticky.className = 'revamp-sticky-bar no-print';
    sticky.innerHTML =
      '<div class="left">' +
        '<span id="revamp-sticky-status">Plan ready</span>' +
        '<strong id="revamp-sticky-title" style="display:none">Plan ready</strong>' +
        '<span id="revamp-sticky-sub" style="display:none"></span>' +
        '<span class="revamp-sticky-hint" id="revamp-sticky-hint" style="display:none"></span>' +
      '</div>' +
      '<div class="actions">' +
        '<button type="button" class="btn-rerun" id="revamp-rerun-btn" title="Lock-preserving re-run">Re-run</button>' +
        '<button type="button" class="btn-fresh" id="revamp-fresh-btn" title="Full regenerate — clears lock-preserving path">Generate fresh</button>' +
        '<button type="button" class="btn-ghost" id="revamp-print-btn">Print</button>' +
        '<button type="button" class="btn-ghost" id="revamp-csv-btn">CSV</button>' +
        '<button type="button" class="btn-commit-primary" id="revamp-commit-btn">Commit Day</button>' +
        '<button type="button" class="btn-open-dashboard" id="revamp-open-dashboard-btn">Open Dashboard</button>' +
      '</div>';
    document.body.appendChild(sticky);
  }
  // Harden: older sticky DOM may lack Open Dashboard soft action
  (function ensureOpenDashBtn() {
    var bar = document.getElementById('revamp-sticky-bar');
    if (!bar) return;
    var actions = bar.querySelector('.actions');
    if (!actions) return;
    if (!document.getElementById('revamp-open-dashboard-btn')) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn-open-dashboard';
      b.id = 'revamp-open-dashboard-btn';
      b.textContent = 'Open Dashboard';
      actions.appendChild(b);
    }
  })();

  var showAllState = { value: false };
  /* Pass-out filter tokens: assigned | all | near | dest:<code> */
  var filterState = { mode: 'assigned', dest: null };
  var filterBusy = false;
  var DEST_TOKEN_MAX = 6;
  var gridMoTimer = null;
  var detailsOpen = false;
  var workloadOpen = false;
  var setupUntuck = false; // optional reveal of templates/manual while has-plan
  var inputForcedExpand = false; // Edit counts expanded while has-plan
  var DAY_KEYS_REVAMP = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];


  function getExternalCarrierLabel() {
    try {
      if (typeof DC_CONFIG !== 'undefined' && DC_CONFIG && DC_CONFIG.externalCarrier) {
        return String(DC_CONFIG.externalCarrier).trim();
      }
    } catch (e) {}
    return '';
  }

  function pqChipLabel(kind) {
    var k = (kind || '').toUpperCase();
    if (k === 'SHORE') {
      var c = getExternalCarrierLabel();
      // Needs tags: show DC external carrier (e.g. COWAN) instead of SHORE/Shoreline
      return c ? c.toUpperCase() : 'OVERFLOW';
    }
    if (k === 'OVERFLOW') return pqChipLabel('SHORE');
    return k;
  }

  function stripEmojiChars(s) {
    return String(s || '')
      .replace(/📋/g, '')
      .replace(/📅/g, '')
      .replace(/⚖️/g, '')
      .replace(/⚠️/g, '')
      .replace(/⚠︎/g, '')
      .replace(/⚠/g, '')
      .replace(/☀️/g, '')
      .replace(/☀/g, '')
      .replace(/🔒/g, '')
      .replace(/🔓/g, '')
      .replace(/⏱/g, '')
      .replace(/👆/g, '')
      .replace(/👥/g, '')
      .replace(/⚡/g, '')
      .replace(/✓/g, '')
      .replace(/✔/g, '')
      .replace(/▲/g, '')
      .replace(/▼/g, '')
      .replace(/[\uFE0F\u200D]/g, '')
      .replace(/[ \t]{2,}/g, ' ');
  }

  function getState() {
    try {
      if (typeof state !== 'undefined' && state) {
        try { window.state = state; } catch (e1) {}
        return state;
      }
      if (window.state) return window.state;
      if (typeof StateManager !== 'undefined' && StateManager && typeof StateManager.load === 'function') {
        // last resort — don't replace live state, only read if global missing
      }
    } catch (e) {}
    return null;
  }

  function planExists() {
    try {
      var st = getState();
      if (st && st.lastResult) return true;
      // DOM fallback if state binding is odd across script scopes
      var cards = document.getElementById('driver-cards-section');
      if (cards && cards.style.display !== 'none' && cards.querySelector('.driver-card')) return true;
      var mg = document.getElementById('metrics-grid');
      if (mg && mg.style.display !== 'none' && mg.querySelector('.metric-card, .m-card, [id^="m-"]')) {
        var mt = document.getElementById('m-total');
        if (mt && /\d/.test(mt.textContent || '')) return true;
      }
    } catch (e) {}
    return false;
  }

  function countDotIssues() {
    try {
      var st0 = getState(); var result = st0 && st0.lastResult;
      if (!result || !result.workload) return 0;
      var n = 0;
      for (var i = 0; i < result.workload.length; i++) {
        if (result.workload[i].status === 'over') n++;
      }
      return n;
    } catch (e) { return 0; }
  }

  function getDailyInputCard() {
    return document.querySelector('#tab-dashboard .stack > .card');
  }

  function getTemplatesCard() {
    var days = document.getElementById('template-days');
    if (!days) return null;
    return days.closest ? days.closest('.card') : (function () {
      var el = days;
      while (el && el !== document.body) {
        if (el.classList && el.classList.contains('card')) return el;
        el = el.parentNode;
      }
      return null;
    })();
  }

  function collapseDailyInputCard() {
    var card = getDailyInputCard();
    if (!card) return;
    if (!card.classList.contains('input-card-collapsed')) {
      if (typeof toggleInputCard === 'function') {
        toggleInputCard();
      } else {
        card.classList.add('input-card-collapsed');
        var btn = document.getElementById('input-toggle-btn');
        if (btn) btn.textContent = 'Expand';
        if (typeof buildCollapsedSummary === 'function') buildCollapsedSummary();
      }
    } else if (typeof buildCollapsedSummary === 'function') {
      try { buildCollapsedSummary(); } catch (e) {}
    }
  }

  function expandDailyInputCard() {
    var card = getDailyInputCard();
    if (!card) return;
    if (card.classList.contains('input-card-collapsed')) {
      if (typeof toggleInputCard === 'function') {
        toggleInputCard();
      } else {
        card.classList.remove('input-card-collapsed');
        var btn = document.getElementById('input-toggle-btn');
        if (btn) btn.textContent = (inputForcedExpand && planExists()) ? 'Done' : 'Collapse';
      }
    }
  }

  function deriveInputChipParts() {
    var parts = { total: 0, dests: [], day: DAY_KEYS_REVAMP[new Date().getDay()] };
    try {
      var st = getState();
      if (!st) return parts;
      var loads = st.loads || [];
      var phases = st.phases || [];
      var byDest = {};
      var total = 0;
      for (var i = 0; i < loads.length; i++) {
        var n = loads[i] || 0;
        total += n;
        var dest = (phases[i] && phases[i].dest) || ('P' + i);
        if (n > 0) byDest[dest] = (byDest[dest] || 0) + n;
      }
      parts.total = total;
      Object.keys(byDest).forEach(function (code) {
        parts.dests.push({ code: code, n: byDest[code] });
      });
      if (typeof DAY_KEYS !== 'undefined' && DAY_KEYS && DAY_KEYS.length) {
        parts.day = DAY_KEYS[new Date().getDay()];
      }
    } catch (e) {}
    return parts;
  }

  function ensureInputChips() {
    var card = getDailyInputCard();
    if (!card) return null;
    var chips = document.getElementById('revamp-input-chips');
    if (!chips) {
      chips = document.createElement('div');
      chips.id = 'revamp-input-chips';
      chips.className = 'revamp-input-chips no-print';
      chips.innerHTML =
        '<div class="revamp-chips-left">' +
          '<div class="revamp-chips-title">Today\'s loads</div>' +
          '<div class="revamp-chips-row" id="revamp-chips-row"></div>' +
          '<div class="revamp-chip-text" id="revamp-chip-text" hidden></div>' +
        '</div>' +
        '<button type="button" class="revamp-edit-counts" id="revamp-edit-counts">Edit counts</button>';
      var header = card.querySelector('.card-header');
      if (header && header.nextSibling) {
        card.insertBefore(chips, header.nextSibling);
      } else if (header) {
        header.appendChild(chips);
      } else {
        card.insertBefore(chips, card.firstChild);
      }
      var editBtn = chips.querySelector('#revamp-edit-counts');
      if (editBtn) {
        editBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          inputForcedExpand = true;
          document.body.classList.add('revamp-input-editing');
          document.body.classList.remove('revamp-input-advanced');
          expandDailyInputCard();
          syncDailyLoadChips();
          // Templates stay tucked — use Show templates / manual only
          syncSetupTuck();
        });
      }
    }
    return chips;
  }

  function syncInputToggleLabel() {
    var btn = document.getElementById('input-toggle-btn');
    if (!btn) return;
    var card = getDailyInputCard();
    var collapsed = card && card.classList.contains('input-card-collapsed');
    if (collapsed) {
      btn.textContent = 'Expand';
    } else if (inputForcedExpand && planExists()) {
      btn.textContent = 'Done';
    } else {
      btn.textContent = 'Collapse';
    }
  }

  function syncDailyLoadHeaderChrome() {
    var card = getDailyInputCard();
    if (!card) return;
    var header = card.querySelector(':scope > .card-header') || card.querySelector('.card-header');
    if (!header) return;
    // Retitle first text node in the flex row to “Today's loads”
    var row = header.children && header.children[0];
    if (row) {
      for (var i = 0; i < row.childNodes.length; i++) {
        var n = row.childNodes[i];
        if (n.nodeType === 3 && /Daily Load Input|Today/.test(n.nodeValue || '')) {
          n.nodeValue = "Today's loads";
          break;
        }
      }
      // If the label was only in textContent mash, ensure button still present
      if (row.childNodes.length === 1 && row.firstChild && row.firstChild.id === 'input-toggle-btn') {
        row.insertBefore(document.createTextNode("Today's loads"), row.firstChild);
      }
    }
    ensureAdvancedToggle(header);
    syncInputToggleLabel();
  }

  function ensureAdvancedToggle(header) {
    var existing = document.getElementById('revamp-input-advanced-toggle');
    if (existing) return existing;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'revamp-input-advanced-toggle';
    btn.className = 'revamp-input-advanced-toggle no-print';
    btn.textContent = 'Advanced';
    btn.title = 'Show reorder, dispatch time, and build-day controls';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var on = document.body.classList.toggle('revamp-input-advanced');
      btn.textContent = on ? 'Hide advanced' : 'Advanced';
    });
    // Place beside Done in the header flex row
    var row = header && header.children && header.children[0];
    var toggle = document.getElementById('input-toggle-btn');
    if (row && toggle && toggle.parentNode === row) {
      row.insertBefore(btn, toggle);
    } else if (header) {
      header.appendChild(btn);
    }
    return btn;
  }

  function syncDailyLoadChips() {
    ensureInputChips();
    var chips = document.getElementById('revamp-input-chips');
    var has = planExists();
    var showChips = has && !inputForcedExpand;
    var editing = !!(has && inputForcedExpand);
    if (chips) chips.classList.toggle('is-visible', showChips);
    document.body.classList.toggle('revamp-input-compact', showChips);
    document.body.classList.toggle('revamp-input-editing', editing);
    if (!editing) document.body.classList.remove('revamp-input-advanced');

    if (has && !inputForcedExpand) {
      collapseDailyInputCard();
      // Harden: never leave legacy collapsed chrome after Edit counts → Done
      var cardFix = getDailyInputCard();
      if (cardFix) cardFix.classList.add('input-card-collapsed');
      document.body.classList.add('revamp-input-compact');
      document.body.classList.remove('revamp-input-editing');
      document.body.classList.remove('revamp-input-advanced');
      if (chips) chips.classList.add('is-visible');
      var cs = document.getElementById('collapsed-summary');
      if (cs) cs.style.setProperty('display', 'none', 'important');
      var adv = document.getElementById('revamp-input-advanced-toggle');
      if (adv) adv.textContent = 'Advanced';
    }
    if (!has) {
      inputForcedExpand = false;
      document.body.classList.remove('revamp-input-compact');
      document.body.classList.remove('revamp-input-editing');
      document.body.classList.remove('revamp-input-advanced');
      if (chips) chips.classList.remove('is-visible');
    }

    syncDailyLoadHeaderChrome();

    var textEl = document.getElementById('revamp-chip-text');
    var rowEl = document.getElementById('revamp-chips-row');
    var p = null;
    try { p = deriveInputChipParts(); } catch (e) { p = { total: 0, dests: [], day: 'Day' }; }
    if (showChips && p) {
      var bits = [p.total + ' loads'];
      p.dests.forEach(function (d) { bits.push(d.code + ' ' + d.n); });
      bits.push(p.day);
      if (textEl) textEl.textContent = bits.join(' · ');
      if (rowEl) {
        var html = '<span class="revamp-chip em">' + p.total + ' loads</span>';
        p.dests.forEach(function (d) {
          html += '<span class="revamp-chip">' + d.code + ' ' + d.n + '</span>';
        });
        html += '<span class="revamp-chip">' + p.day + '</span>';
        rowEl.innerHTML = html;
      }
    }
    // Single chip row only: remove any legacy summary Edit counts button
    var staleEdit = document.getElementById('revamp-edit-counts-summary');
    if (staleEdit) staleEdit.remove();
  }

  function ensureSetupUntuckLink() {
    var link = document.getElementById('revamp-setup-untuck');
    if (link) return link;
    var gen = document.querySelector('#tab-dashboard .btn-generate');
    link = document.createElement('button');
    link.type = 'button';
    link.id = 'revamp-setup-untuck';
    link.className = 'revamp-setup-untuck no-print';
    link.textContent = 'Show templates / manual';
    link.addEventListener('click', function () {
      setupUntuck = true;
      syncSetupTuck();
    });
    if (gen && gen.parentNode) {
      gen.parentNode.insertBefore(link, gen.nextSibling);
    } else {
      var stack = document.querySelector('#tab-dashboard .stack');
      if (stack) stack.appendChild(link);
    }
    return link;
  }

  function syncSetupTuck() {
    var has = planExists();
    // Templates only via Show templates / manual — never auto-untuck on Edit counts
    var tuck = has && !setupUntuck;
    document.body.classList.toggle('revamp-setup-untucked', !!(has && setupUntuck));
    var tpl = getTemplatesCard();
    if (tpl) {
      tpl.classList.toggle('revamp-setup-tuck', tuck);
      tpl.style.setProperty('display', tuck ? 'none' : '', 'important');
    }
    var bucket = document.getElementById('load-bucket-panel');
    if (bucket) {
      bucket.classList.toggle('revamp-setup-tuck', tuck);
      if (tuck) bucket.style.setProperty('display', 'none', 'important');
      else if (bucket.classList.contains('has-items') || (bucket.querySelector && bucket.querySelector('.bucket-item'))) {
        bucket.style.removeProperty('display');
      } else if (!has) {
        bucket.style.removeProperty('display');
      } else {
        bucket.style.removeProperty('display');
      }
    }
    ensureSetupUntuckLink();
    var link = document.getElementById('revamp-setup-untuck');
    if (link) {
      link.classList.toggle('is-visible', !!(has && tuck));
      link.style.display = (has && tuck) ? 'inline-block' : 'none';
    }
    if (!has) {
      setupUntuck = false;
      if (tpl) {
        tpl.classList.remove('revamp-setup-tuck');
        tpl.style.removeProperty('display');
      }
      if (bucket) {
        bucket.classList.remove('revamp-setup-tuck');
        bucket.style.removeProperty('display');
      }
      if (link) {
        link.classList.remove('is-visible');
        link.style.display = 'none';
      }
    }
  }

  function markPassOutHeaderButtons() {
    var section = document.getElementById('driver-cards-section');
    if (!section) return;
    var header = section.querySelector('.card-header') || section;
    var has = planExists();
    Array.prototype.slice.call(header.querySelectorAll('button')).forEach(function (btn) {
      var oc = btn.getAttribute('onclick') || '';
      var label = (btn.textContent || '').toLowerCase();
      var id = btn.id || '';
      if (id === 'commit-day-btn' || oc.indexOf('commitToHistory') >= 0 || label.indexOf('commit') >= 0) {
        btn.classList.add('revamp-mid-commit');
        if (has) btn.style.setProperty('display', 'none', 'important');
        else btn.style.removeProperty('display');
        return;
      }
      if (oc.indexOf('print') >= 0 || label.indexOf('print') >= 0) {
        btn.classList.add('revamp-mid-print');
        if (has) btn.style.setProperty('display', 'none', 'important');
        else btn.style.removeProperty('display');
        return;
      }
      if (oc.indexOf('exportCSV') >= 0 || (label.indexOf('csv') >= 0 && oc.indexOf('exportSheet') < 0 && label.indexOf('sheet') < 0)) {
        btn.classList.add('revamp-mid-csv');
        if (has) btn.style.setProperty('display', 'none', 'important');
        else btn.style.removeProperty('display');
        return;
      }
      // Hide mid-page Generate / Re-run twins in pass-out header (sticky owns them)
      if (oc.indexOf('generateAssignments') >= 0 || oc.indexOf('rerunRemaining') >= 0 ||
          /\bre-?run\b/.test(label) || /generate/.test(label)) {
        btn.classList.add('revamp-mid-gen-twin');
        if (has) btn.style.setProperty('display', 'none', 'important');
        else btn.style.removeProperty('display');
        return;
      }
      // Start Over + Sheet stay visible mid-page
      if (oc.indexOf('exportSheet') >= 0 || label.indexOf('sheet') >= 0) {
        btn.classList.add('revamp-mid-sheet');
      }
      if (oc.indexOf('openClearDayModal') >= 0 || label.indexOf('start over') >= 0) {
        btn.classList.add('revamp-mid-startover');
      }
    });
  }

  function syncPassOutHeader() {
    markPassOutHeaderButtons();
    var section = document.getElementById('driver-cards-section');
    if (!section) return;
    var header = section.querySelector('.card-header');
    if (!header) return;
    var titleSpan = header.querySelector(':scope > span') || header.querySelector('span');
    // Prefer the direct text span that held "Driver Assignments — Pass-Out Sheet"
    var spans = header.querySelectorAll(':scope > span');
    if (spans.length) titleSpan = spans[0];
    if (!titleSpan) return;
    var has = planExists();
    if (!titleSpan.getAttribute('data-revamp-passout-orig')) {
      titleSpan.setAttribute('data-revamp-passout-orig', titleSpan.textContent || '');
    }
    if (has) {
      var stats = computePlanStats();
      var n = stats.assignedCards || 0;
      // Prefer live assigned-card count from grid when available
      try {
        var grid = document.getElementById('driver-cards-grid');
        if (grid) {
          var assigned = 0;
          Array.prototype.slice.call(grid.querySelectorAll('.driver-card')).forEach(function (card) {
            var isSpecial = card.classList.contains('is-unassigned') || card.classList.contains('is-shore');
            if (!isSpecial && realRuns(card).length > 0) assigned++;
          });
          if (assigned > 0) n = assigned;
        }
      } catch (e) {}
      titleSpan.textContent = 'Pass-out · ' + n + ' assigned';
    } else {
      titleSpan.textContent = titleSpan.getAttribute('data-revamp-passout-orig') || titleSpan.textContent;
    }
  }


  function ensureDcChip() {
    try {
      var sub = document.getElementById('hdr-dc-subtitle');
      if (!sub) return;
      var chip = document.getElementById('revamp-dc-chip');
      var name = '';
      try {
        if (typeof DC_CONFIG !== 'undefined' && DC_CONFIG && DC_CONFIG.name) name = DC_CONFIG.name;
      } catch (e0) {}
      if (!name) {
        // Prefer existing name label inside chip if already built
        var nameEl0 = chip && chip.querySelector('.revamp-dc-chip-name');
        if (nameEl0 && (nameEl0.textContent || '').trim()) {
          name = (nameEl0.textContent || '').trim();
        } else {
          var raw = (sub.textContent || '').trim();
          // "Montgomery Test · DOT Compliant" or similar
          var m = raw.replace(/\s*·\s*DOT Compliant.*/i, '').trim();
          // Strip chevron / leftover chip chrome if reading raw subtitle
          m = m.replace(/\s*[▾▼⇄].*$/, '').trim();
          if (m) name = m;
        }
      }
      if (!name) name = 'DC';
      if (!chip) {
        chip = document.createElement('button');
        chip.type = 'button';
        chip.id = 'revamp-dc-chip';
        chip.className = 'revamp-dc-chip no-print';
        chip.setAttribute('title', 'Switch DC');
        chip.setAttribute('aria-haspopup', 'listbox');
        chip.setAttribute('aria-expanded', 'false');
        // Keep remaining subtitle text (DOT Compliant) after chip
        var rest = document.createElement('span');
        rest.id = 'revamp-hdr-sub-rest';
        rest.textContent = 'DOT Compliant';
        sub.textContent = '';
        sub.appendChild(chip);
        sub.appendChild(rest);
      }
      // Promote span→button if an older chip exists
      if (chip.tagName === 'SPAN') {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = chip.id;
        btn.className = chip.className;
        btn.setAttribute('title', 'Switch DC');
        btn.setAttribute('aria-haspopup', 'listbox');
        btn.setAttribute('aria-expanded', chip.getAttribute('aria-expanded') || 'false');
        while (chip.firstChild) btn.appendChild(chip.firstChild);
        chip.parentNode.replaceChild(btn, chip);
        chip = btn;
      }
      // Name + chevron (idempotent)
      var nameEl = chip.querySelector('.revamp-dc-chip-name');
      var chevEl = chip.querySelector('.revamp-dc-chip-chevron');
      if (!nameEl) {
        chip.textContent = '';
        nameEl = document.createElement('span');
        nameEl.className = 'revamp-dc-chip-name';
        chip.appendChild(nameEl);
      }
      if (!chevEl) {
        chevEl = document.createElement('span');
        chevEl.className = 'revamp-dc-chip-chevron';
        chevEl.setAttribute('aria-hidden', 'true');
        chevEl.textContent = '▾';
        chip.appendChild(chevEl);
      }
      nameEl.textContent = name;
      chip.setAttribute('title', 'Switch DC — ' + name);

      // Wrap chip + dropdown in a relative slot (dropdown must NOT nest inside <button>).
      var slot = document.getElementById('revamp-dc-slot');
      if (!slot) {
        slot = document.createElement('span');
        slot.id = 'revamp-dc-slot';
        slot.className = 'revamp-dc-slot no-print';
        chip.parentNode.insertBefore(slot, chip);
        slot.appendChild(chip);
      } else if (chip.parentNode !== slot) {
        slot.appendChild(chip);
      }
      var dd = document.getElementById('dc-switcher-dropdown');
      if (dd && dd.parentNode !== slot) {
        slot.appendChild(dd);
      }
      // Hide empty #dc-switcher shell (⇄ demoted; chip owns switching)
      var switcher = document.getElementById('dc-switcher');
      if (switcher) {
        switcher.classList.add('revamp-dc-switcher-demoted');
        switcher.setAttribute('aria-hidden', 'true');
      }

      // Wire once → existing toggleDCSwitcher(event)
      if (chip.getAttribute('data-revamp-dc-wired') !== '1') {
        chip.setAttribute('data-revamp-dc-wired', '1');
        chip.addEventListener('click', function (ev) {
          try {
            if (typeof toggleDCSwitcher === 'function') toggleDCSwitcher(ev);
            var open = !!(dd && dd.classList.contains('open'));
            chip.setAttribute('aria-expanded', open ? 'true' : 'false');
            chip.classList.toggle('is-open', open);
          } catch (e1) {}
        });
      }

      // Keep aria/open class in sync if dropdown closed by document click
      if (dd && dd.getAttribute('data-revamp-dc-obs') !== '1') {
        dd.setAttribute('data-revamp-dc-obs', '1');
        try {
          var mo = new MutationObserver(function () {
            var open = dd.classList.contains('open');
            chip.setAttribute('aria-expanded', open ? 'true' : 'false');
            chip.classList.toggle('is-open', open);
          });
          mo.observe(dd, { attributes: true, attributeFilter: ['class'] });
        } catch (e2) {}
      }

      var restEl = document.getElementById('revamp-hdr-sub-rest');
      if (restEl && !(restEl.textContent || '').trim()) restEl.textContent = 'DOT Compliant';
    } catch (e) {}
  }

  function syncSticky() {
    var has = planExists();
    document.body.classList.toggle('has-plan', has);
    ensureDcChip();
    // Harden: some layouts leave Generate visible if class races with paint
    document.querySelectorAll('.btn-generate').forEach(function (btn) {
      btn.style.display = has ? 'none' : '';
    });
    var inPageCommit = document.getElementById('commit-day-btn');
    if (inPageCommit) inPageCommit.style.display = has ? 'none' : '';
    var metricsGrid = document.getElementById('metrics-grid');
    if (metricsGrid) metricsGrid.style.display = has ? 'none' : metricsGrid.style.display;
    // revampHideMetrics
    var stickyEl = document.getElementById('revamp-sticky-bar');
    if (stickyEl) stickyEl.style.display = has ? 'flex' : 'none';

    var title = document.getElementById('revamp-sticky-title');
    var sub = document.getElementById('revamp-sticky-sub');
    var hint = document.getElementById('revamp-sticky-hint');
    var statusEl = document.getElementById('revamp-sticky-status');
    var nLoads = 0;
    var dIssues = 0;
    try {
      var stN = getState();
      var lrN = stN && stN.lastResult;
      nLoads = (lrN && lrN.assignments) ? lrN.assignments.length : 0;
      dIssues = countDotIssues();
    } catch (e) {}
    var readyInfo = null;
    try { readyInfo = getDcReadiness(); } catch (eR) { readyInfo = null; }
    var fictionPlan = !!(has && readyInfo && readyInfo.blockGenerate);
    if (statusEl) {
      if (fictionPlan) {
        var copyS = readyGateCopy(readyInfo.reason || 'no-drivers');
        statusEl.textContent = copyS.title + (nLoads ? (' · ' + nLoads + ' loads unplanned') : '');
      } else {
        statusEl.textContent = has
          ? ('Plan ready · ' + nLoads + ' loads · ' + dIssues + ' DOT issue' + (dIssues === 1 ? '' : 's'))
          : 'No plan yet';
      }
    }
    if (title) title.textContent = fictionPlan ? 'Not ready' : (has ? 'Plan ready' : 'No plan yet');
    if (sub) {
      if (fictionPlan) {
        var fr = (readyInfo && readyInfo.reason) || '';
        if (fr === 'no-drivers-unavailable') {
          sub.textContent = 'Clear vacation or re-enable drivers before Commit';
        } else if (fr === 'no-dests') {
          sub.textContent = 'Enable destinations before Commit';
        } else {
          sub.textContent = 'Add drivers or enable destinations before Commit';
        }
      } else {
        sub.textContent = has
          ? (nLoads + ' loads · ' + dIssues + ' DOT issue' + (dIssues === 1 ? '' : 's'))
          : 'Generate assignments to unlock commit';
      }
    }
    if (hint) hint.style.display = 'none';
    var commitBtn = document.getElementById('revamp-commit-btn');
    if (commitBtn && typeof window.SupabaseSync !== 'undefined') {
      try {
        commitBtn.textContent = (SupabaseSync.isCommitted && SupabaseSync.isCommitted())
          ? 'Committed'
          : 'Commit Day';
      } catch (e) {}
    }
    syncCommitStaleGate();
    syncCommitNotReadyGate(!!(readyInfo && readyInfo.blockGenerate && has));
    syncDetailsCollapse();
    syncWorkloadCollapse();
    syncDailyLoadChips();
    syncSetupTuck();
    syncPassOutHeader();
    syncStickyTabMode(has, nLoads, dIssues);
    try { syncDcReadyGate(); } catch (eGate) {}
    try { syncCommitAuditPreviewChrome(); } catch (eAudChip) {}
  }

  function getActiveTabName() {
    try {
      if (document.getElementById('tab-fleet') && document.getElementById('tab-fleet').classList.contains('active')) return 'fleet';
      if (document.getElementById('tab-history') && document.getElementById('tab-history').classList.contains('active')) return 'history';
      if (document.getElementById('tab-dashboard') && document.getElementById('tab-dashboard').classList.contains('active')) return 'dashboard';
      var activeBtn = document.querySelector('.tab-btn.active');
      if (activeBtn) {
        var oc = activeBtn.getAttribute('onclick') || '';
        var m = oc.match(/switchTab\(['"](\w+)['"]/);
        if (m) return m[1];
      }
    } catch (e) {}
    return 'dashboard';
  }

  function syncStickyTabMode(has, nLoads, dIssues) {
    if (typeof has === 'undefined') has = planExists();
    if (typeof nLoads !== 'number') {
      nLoads = 0;
      try {
        var stN = getState();
        var lrN = stN && stN.lastResult;
        nLoads = (lrN && lrN.assignments) ? lrN.assignments.length : 0;
      } catch (e0) {}
    }
    var tab = getActiveTabName();
    var soft = !!(has && (tab === 'fleet' || tab === 'history'));
    document.body.classList.toggle('revamp-sticky-soft', soft);

    var statusEl = document.getElementById('revamp-sticky-status');
    if (soft && statusEl) {
      var copy = 'Dashboard plan ready · open Dashboard to review pass-outs';
      if (nLoads > 0) copy += ' · ' + nLoads + ' loads';
      statusEl.textContent = copy;
    }

    // Soft: hide loud action cluster; keep quiet Open Dashboard
    var ids = ['revamp-rerun-btn', 'revamp-fresh-btn', 'revamp-print-btn', 'revamp-csv-btn', 'revamp-commit-btn'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (!el) continue;
      if (soft) el.style.setProperty('display', 'none', 'important');
      else el.style.removeProperty('display');
    }
    var openDash = document.getElementById('revamp-open-dashboard-btn');
    if (openDash) {
      if (soft) openDash.style.removeProperty('display');
      else openDash.style.setProperty('display', 'none', 'important');
    }
  }

  var printBtn = document.getElementById('revamp-print-btn');
  if (printBtn) printBtn.addEventListener('click', function () { window.print(); });
  var csvBtn = document.getElementById('revamp-csv-btn');
  if (csvBtn) csvBtn.addEventListener('click', function () {
    if (typeof exportCSV === 'function') exportCSV();
  });
  // Lock-preserving when a plan exists; otherwise full generate
  var rerunBtn = document.getElementById('revamp-rerun-btn');
  if (rerunBtn) rerunBtn.addEventListener('click', function () {
    if (typeof rerunRemaining === 'function' && planExists()) rerunRemaining();
    else if (typeof generateAssignments === 'function') generateAssignments();
  });
  // S1-1: clear preservable locks (locked + out-stamps) then full generate — Re-run keeps locks
  function clearPreservableLocksForFresh() {
    try {
      var st = getState();
      if (!st || !st.lastResult || !Array.isArray(st.lastResult.assignments)) return false;
      var changed = false;
      st.lastResult.assignments.forEach(function (a) {
        if (!a) return;
        var preservable = (typeof isPreservableLock === 'function')
          ? isPreservableLock(a)
          : !!(a.locked || a.actualOutTime);
        if (!preservable) return;
        if (a.locked) { a.locked = false; changed = true; }
        if (a.actualOutTime) { a.actualOutTime = null; changed = true; }
      });
      if (changed && typeof saveResult === 'function') saveResult();
      return changed;
    } catch (e) {
      console.warn('[revamp] clearPreservableLocksForFresh', e);
      return false;
    }
  }
  function isPlanStale() {
    try {
      if (document.body.classList.contains('revamp-plan-stale')) return true;
      var banner = document.getElementById('stale-result-banner');
      if (!banner) return false;
      var d = (banner.style.display || '').toLowerCase();
      return d === 'flex' || d === 'block';
    } catch (e) { return false; }
  }
  function syncCommitStaleGate() {
    try {
      var stale = isPlanStale();
      document.body.classList.toggle('revamp-plan-stale', stale);
      var btn = document.getElementById('revamp-commit-btn');
      if (!btn) return;
      if (stale) {
        btn.setAttribute('aria-disabled', 'true');
        btn.title = 'Re-run or Generate fresh before Commit';
      } else if (!(btn.getAttribute('data-revamp-commit-not-ready') === '1')) {
        btn.removeAttribute('aria-disabled');
        if ((btn.getAttribute('title') || '') === 'Re-run or Generate fresh before Commit') {
          btn.removeAttribute('title');
        }
      }
    } catch (e) {}
  }

  /** Soft-disable Commit on fiction sticky / ready-gate blocked (same mute as Generate). */
  function syncCommitNotReadyGate(forceBlock) {
    try {
      var block = !!forceBlock;
      if (typeof forceBlock === 'undefined') {
        var r = getDcReadiness();
        block = !!(r && r.blockGenerate && planExists());
      }
      var btn = document.getElementById('revamp-commit-btn');
      if (!btn) return;
      if (block) {
        btn.setAttribute('aria-disabled', 'true');
        btn.setAttribute('data-revamp-commit-not-ready', '1');
        btn.classList.add('revamp-commit-not-ready');
        btn.title = 'Finish DC setup before Commit';
      } else {
        btn.removeAttribute('data-revamp-commit-not-ready');
        btn.classList.remove('revamp-commit-not-ready');
        if ((btn.getAttribute('title') || '') === 'Finish DC setup before Commit') {
          btn.removeAttribute('title');
        }
        // Leave aria-disabled if stale gate still owns it
        if (!isPlanStale()) btn.removeAttribute('aria-disabled');
      }
    } catch (e) {}
  }
  function showCommitStaleQuiet() {
    var statusEl = document.getElementById('revamp-sticky-status');
    if (!statusEl) return;
    statusEl.textContent = 'Re-run or Generate fresh before Commit';
    statusEl.classList.add('revamp-stale-commit-msg');
    clearTimeout(showCommitStaleQuiet._t);
    showCommitStaleQuiet._t = setTimeout(function () {
      statusEl.classList.remove('revamp-stale-commit-msg');
      try { syncSticky(); } catch (e) {}
    }, 2800);
  }
  var freshBtn = document.getElementById('revamp-fresh-btn');
  if (freshBtn) freshBtn.addEventListener('click', function () {
    clearPreservableLocksForFresh();
    if (typeof generateAssignments === 'function') generateAssignments();
  });
  var commitBtnEl = document.getElementById('revamp-commit-btn');
  if (commitBtnEl) commitBtnEl.addEventListener('click', function () {
    if (isPlanStale()) {
      showCommitStaleQuiet();
      return;
    }
    try {
      var rClick = getDcReadiness();
      if (rClick && rClick.blockGenerate) {
        showCommitNotReadyQuiet();
        return;
      }
    } catch (eNrClick) {}
    if (typeof commitToHistory === 'function') commitToHistory();
  });
  var openDashBtn = document.getElementById('revamp-open-dashboard-btn');
  if (openDashBtn && !openDashBtn.__revampOpenDash) {
    openDashBtn.__revampOpenDash = true;
    openDashBtn.addEventListener('click', function () {
      var dashBtn = document.querySelector('.tab-btn[onclick*="dashboard"]');
      if (typeof switchTab === 'function') {
        switchTab('dashboard', dashBtn ? { currentTarget: dashBtn } : null);
      } else if (dashBtn) {
        dashBtn.click();
      }
      syncSticky();
    });
  }

  function readMetricText(id) {
    var el = document.getElementById(id);
    if (!el) return '';
    return (el.textContent || '').trim();
  }

  function computePlanStats() {
    var stats = { total: '—', drivers: '—', shore: '—', dot: '—', assignedCards: 0 };
    try {
      var st0 = getState(); var result = st0 && st0.lastResult;
      if (!result) return stats;
      var asg = result.assignments || [];
      var total = asg.length;
      var shore = 0;
      var driverSet = {};
      for (var i = 0; i < asg.length; i++) {
        var a = asg[i];
        if (a.internal) {
          var d = a.override || a.autoDriver;
          if (d) driverSet[d] = true;
        } else {
          shore++;
        }
      }
      var driversUsed = 0;
      if (result.workload && result.workload.length) {
        for (var w = 0; w < result.workload.length; w++) {
          if (result.workload[w].loads > 0) driversUsed++;
        }
      } else {
        driversUsed = Object.keys(driverSet).length;
      }
      var dotOver = countDotIssues();
      var dotOk = result.workload ? (result.workload.length - dotOver) : 0;
      stats.total = String(total);
      stats.drivers = String(driversUsed);
      stats.shore = String(shore);
      stats.dot = dotOver > 0 ? ('⚠ ' + dotOver + ' Over') : ('✓ ' + dotOk + ' OK');
      stats.dotOver = dotOver;
      stats.assignedCards = driversUsed;
    } catch (e) {
      var mt = readMetricText('m-total');
      var ms = readMetricText('m-shore');
      var md = readMetricText('m-drivers-used');
      var mdot = readMetricText('m-dot-ok');
      if (mt && mt !== '—') stats.total = mt;
      if (ms && ms !== '—') stats.shore = ms;
      if (md) {
        var dm = md.match(/(\d+)/);
        if (dm) stats.drivers = dm[1];
      }
      if (mdot) stats.dot = mdot;
    }
    return stats;
  }

  function ensurePlanSummary() {
    var section = document.getElementById('driver-cards-section');
    if (!section || !section.parentNode) return null;
    var el = document.getElementById('revamp-plan-summary');
    if (!el) {
      el = document.createElement('div');
      el.id = 'revamp-plan-summary';
      el.className = 'revamp-plan-summary no-print';
      // Concept 4-up: Total Loads · Drivers Used · Overflow/Shore · DOT OK
      // Values prefer live #m-* DOM when present (production renderMetrics fills them)
      el.innerHTML =
        '<div class="rps-item metric" id="revamp-ps-total-wrap">' +
          '<div class="rps-lbl label">TOTAL LOADS</div>' +
          '<div class="rps-val value" id="revamp-ps-total">—</div>' +
          '<div class="rps-hint hint" id="revamp-ps-total-hint"></div>' +
        '</div>' +
        '<div class="rps-item metric" id="revamp-ps-drivers-wrap">' +
          '<div class="rps-lbl label">DRIVERS USED</div>' +
          '<div class="rps-val value" id="revamp-ps-drivers">—</div>' +
          '<div class="rps-hint hint" id="revamp-ps-drivers-hint"></div>' +
        '</div>' +
        '<div class="rps-item metric" id="revamp-ps-shore-wrap">' +
          '<div class="rps-lbl label">OVERFLOW</div>' +
          '<div class="rps-val value" id="revamp-ps-shore">—</div>' +
          '<div class="rps-hint hint" id="revamp-ps-shore-hint">external</div>' +
        '</div>' +
        '<div class="rps-item metric" id="revamp-ps-dot-wrap">' +
          '<div class="rps-lbl label">DOT STATUS</div>' +
          '<div class="rps-val value" id="revamp-ps-dot">—</div>' +
          '<div class="rps-hint hint" id="revamp-ps-dot-hint"></div>' +
        '</div>';
      section.parentNode.insertBefore(el, section);
    }
    return el;
  }

  function updatePlanSummary() {
    ensurePlanSummary();
    var stats = computePlanStats();
    // Prefer production metric tiles when populated (single source of truth)
    var mt = readMetricText('m-total');
    var ms = readMetricText('m-shore');
    var md = readMetricText('m-drivers-used');
    var mdot = readMetricText('m-dot-ok');
    var t = document.getElementById('revamp-ps-total');
    var d = document.getElementById('revamp-ps-drivers');
    var s = document.getElementById('revamp-ps-shore');
    var dot = document.getElementById('revamp-ps-dot');
    var totalVal = (mt && mt !== '—') ? mt : stats.total;
    var shoreVal = (ms && ms !== '—') ? ms : stats.shore;
    var driversVal = stats.drivers;
    if (md) {
      var dm = md.match(/(\d+)/);
      if (dm) driversVal = dm[1];
    }
    if (t) t.textContent = totalVal;
    if (s) s.textContent = shoreVal;
    if (d) d.textContent = driversVal;

    var th = document.getElementById('revamp-ps-total-hint');
    var dh = document.getElementById('revamp-ps-drivers-hint');
    var sh = document.getElementById('revamp-ps-shore-hint');
    var doth = document.getElementById('revamp-ps-dot-hint');
    var dotWrap = document.getElementById('revamp-ps-dot-wrap');
    var totN = parseInt(String(totalVal).replace(/[^0-9]/g, ''), 10);
    var shoreN = parseInt(String(shoreVal).replace(/[^0-9]/g, ''), 10);
    if (th) {
      if (!isNaN(totN) && totN > 0 && !isNaN(shoreN)) {
        var pct = Math.round(((totN - shoreN) / totN) * 100);
        th.textContent = pct + '% internal';
      } else {
        th.textContent = '';
      }
    }
    if (dh) {
      var avail = '';
      try {
        var ma = document.getElementById('m-drivers-avail') || document.getElementById('m-available');
        if (ma) {
          var am = (ma.textContent || '').match(/(\d+)/);
          if (am) avail = am[1];
        }
        if (!avail) {
          var stA = getState();
          if (stA && stA.drivers && stA.drivers.length) {
            var active = 0;
            for (var ai = 0; ai < stA.drivers.length; ai++) {
              if (stA.drivers[ai] && stA.drivers[ai].active !== false && !stA.drivers[ai].onVacation) active++;
            }
            avail = String(active || stA.drivers.length);
          }
        }
      } catch (eA) {}
      dh.textContent = avail ? ('of ' + avail + ' available') : '';
    }
    if (sh) {
      var carrierHint = getExternalCarrierLabel();
      sh.textContent = carrierHint ? carrierHint : 'external';
    }
    var shoreLbl = document.querySelector('#revamp-ps-shore-wrap .rps-lbl, #revamp-ps-shore-wrap .label');
    if (shoreLbl) {
      var carrierLbl = getExternalCarrierLabel();
      shoreLbl.textContent = carrierLbl ? carrierLbl.toUpperCase() : 'OVERFLOW';
    }

    var over = stats.dotOver || 0;
    if (mdot && /Over/i.test(mdot)) {
      var om = mdot.match(/(\d+)/);
      if (om) over = parseInt(om[1], 10) || over;
    }
    if (dot) {
      if (over > 0) {
        dot.textContent = String(over);
        dot.classList.add('rps-warn');
        dot.classList.remove('rps-ok');
        if (dotWrap) dotWrap.classList.remove('good');
        if (doth) doth.textContent = 'over hours';
      } else {
        dot.textContent = 'OK';
        dot.classList.add('rps-ok');
        dot.classList.remove('rps-warn');
        if (dotWrap) dotWrap.classList.add('good');
        if (doth) doth.textContent = '0 over hours';
      }
    }
  }

  /* ── Collapse Full Assignments (Details) when has-plan ── */
  function ensureDetailsToggle() {
    var section = document.getElementById('assignments-section');
    if (!section) return;
    var header = section.querySelector('.card-header');
    if (!header) return;
    var btn = document.getElementById('revamp-details-toggle');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'revamp-details-toggle';
      btn.className = 'revamp-collapse-toggle no-print';
      btn.addEventListener('click', function () {
        detailsOpen = !detailsOpen;
        syncDetailsCollapse();
      });
      header.insertBefore(btn, header.firstChild);
    }
  }

  function syncDetailsCollapse() {
    ensureDetailsToggle();
    var section = document.getElementById('assignments-section');
    if (!section) return;
    var has = planExists();
    section.classList.toggle('revamp-collapsed', has && !detailsOpen);
    var btn = document.getElementById('revamp-details-toggle');
    if (btn) {
      btn.textContent = (has && !detailsOpen) ? 'Details' : 'Hide details';
      btn.setAttribute('aria-expanded', (has && detailsOpen) ? 'true' : 'false');
    }
    polishAssignmentsChrome();
  }

  function polishAssignmentsChrome() {
    try {
      var section = document.getElementById('assignments-section');
      if (!section) return;
      section.classList.add('revamp-assignments');
      var header = section.querySelector('.card-header');
      if (header) {
        header.style.textTransform = 'none';
        header.style.letterSpacing = '0.01em';
        var titleEl = header.querySelector('.revamp-assignments-title');
        if (!titleEl) {
          titleEl = document.createElement('span');
          titleEl.className = 'revamp-assignments-title';
          titleEl.textContent = 'Assignments · detailed';
          var toggle = document.getElementById('revamp-details-toggle');
          if (toggle && toggle.parentNode === header) {
            if (toggle.nextSibling) header.insertBefore(titleEl, toggle.nextSibling);
            else header.appendChild(titleEl);
          } else {
            header.insertBefore(titleEl, header.firstChild);
          }
        } else {
          titleEl.textContent = 'Assignments · detailed';
        }
        // Strip leftover prod title text nodes / emoji bullets
        Array.prototype.forEach.call(header.childNodes, function (n) {
          if (n === titleEl) return;
          if (n.nodeType === 3) {
            var tx = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
            if (!tx || /Full Load Assignments|Assignments|Detailed View|ASSIGNMENTS/i.test(tx)) {
              n.nodeValue = ' ';
            }
          } else if (n.nodeType === 1 && n.tagName !== 'BUTTON' &&
              !(n.classList && (n.classList.contains('revamp-collapse-toggle') ||
                n.classList.contains('revamp-assignments-title') ||
                n.id === 'detail-toggle-btn' || n.id === 'revamp-details-toggle'))) {
            var ht = (n.textContent || '').replace(/\s+/g, ' ').trim();
            if (/Full Load Assignments|ASSIGNMENTS|Detailed View/i.test(ht) &&
                !n.querySelector('button, input, table')) {
              n.textContent = '';
            }
          }
        });
      }
      var detBtn = document.getElementById('detail-toggle-btn');
      if (detBtn) {
        var raw = (detBtn.textContent || '').replace(/\s+/g, ' ').trim();
        var cleaned = stripEmojiChars(raw).trim();
        if (/hide/i.test(cleaned)) detBtn.textContent = 'Hide Trailer / Carrier';
        else detBtn.textContent = 'Show Trailer / Carrier';
      }
      var detailsToggle = document.getElementById('revamp-details-toggle');
      if (detailsToggle) {
        var dtx = (detailsToggle.textContent || '').replace(/\s+/g, ' ').trim();
        if (/hide/i.test(dtx)) detailsToggle.textContent = 'Hide details';
        else if (/detail/i.test(dtx) || /▶|▼|▾/.test(dtx)) detailsToggle.textContent = 'Details';
      }
      // Quiet Shoreline DRIVER cells (drop truck emoji) + zebra classes for CSS
      var shoreRows = section.querySelectorAll('tbody tr.row-shore');
      var zi = 0;
      Array.prototype.forEach.call(shoreRows, function (tr) {
        tr.classList.toggle('revamp-zebra-b', (zi % 2) === 1);
        tr.classList.toggle('revamp-zebra-a', (zi % 2) === 0);
        zi++;
        Array.prototype.forEach.call(tr.querySelectorAll('.badge-shore'), function (badge) {
          var raw = (badge.textContent || '').replace(/\s+/g, ' ').trim();
          var clean = stripEmojiChars(raw).trim();
          if (clean && clean !== raw) badge.textContent = clean;
          badge.classList.add('revamp-badge-shore-quiet');
        });
      });
      // Sentence-case repeated col-key labels (prod paints Title Case then CSS uppercases)
      Array.prototype.forEach.call(section.querySelectorAll('tr.col-key td'), function (td) {
        td.style.textTransform = 'none';
      });
    } catch (eA) {}
  }

  /* ── Collapse Driver Workload from morning path when has-plan ── */
  function ensureWorkloadCollapse() {
    var list = document.getElementById('workload-list');
    if (!list || !list.parentNode) return;
    var wrap = list.parentNode;
    if (!wrap.classList.contains('revamp-workload-wrap')) {
      wrap.classList.add('revamp-workload-wrap');
    }
    var toggle = document.getElementById('revamp-workload-toggle');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.id = 'revamp-workload-toggle';
      toggle.className = 'revamp-collapse-toggle revamp-workload-toggle no-print';
      toggle.addEventListener('click', function () {
        workloadOpen = !workloadOpen;
        syncWorkloadCollapse();
      });
      wrap.insertBefore(toggle, wrap.firstChild);
    }
  }

  function syncWorkloadCollapse() {
    ensureWorkloadCollapse();
    var wrap = document.querySelector('.revamp-workload-wrap');
    if (!wrap) return;
    var has = planExists();
    wrap.classList.toggle('revamp-collapsed', has && !workloadOpen);
    var toggle = document.getElementById('revamp-workload-toggle');
    if (toggle) {
      toggle.textContent = (has && !workloadOpen) ? 'Driver Workload' : 'Hide workload';
      toggle.setAttribute('aria-expanded', (has && workloadOpen) ? 'true' : 'false');
    }
  }

  function relocatePlanQualityOnce() {
    var panel = document.getElementById('plan-quality-panel');
    var section = document.getElementById('driver-cards-section');
    if (!panel || !section || !section.parentNode) return;
    if (panel.getAttribute('data-revamp-moved') === '1') return;
    section.parentNode.insertBefore(panel, section);
    panel.setAttribute('data-revamp-moved', '1');
  }

  function ensureCardsToolbar() {
    var grid = document.getElementById('driver-cards-grid');
    if (!grid) return;
    var bar = document.getElementById('revamp-cards-toolbar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'revamp-cards-toolbar';
      bar.className = 'revamp-cards-toolbar no-print';
      bar.innerHTML =
        '<div class="revamp-filter-bar" id="revamp-filter-bar">' +
          '<div class="revamp-filter-tokens" id="revamp-filter-tokens" role="toolbar" aria-label="Pass-out filters"></div>' +
          '<div class="revamp-filter-empty" id="revamp-filter-empty" hidden>' +
            '<span class="revamp-filter-empty-msg">No drivers match</span>' +
            '<button type="button" class="revamp-filter-empty-cta" data-revamp-clear-filters>Clear filters</button>' +
          '</div>' +
        '</div>' +
        '<div class="hint" id="revamp-empty-hint"></div>' +
        '<input type="checkbox" id="revamp-show-all" class="revamp-show-all-legacy" tabindex="-1" aria-hidden="true">';
      grid.parentNode.insertBefore(bar, grid);
      bar.addEventListener('click', function (e) {
        var clearBtn = e.target && e.target.closest ? e.target.closest('[data-revamp-clear-filters]') : null;
        if (clearBtn) {
          e.preventDefault();
          var clearMode = clearBtn.getAttribute('data-revamp-clear-mode') || 'assigned';
          setPassOutFilter(clearMode === 'all' ? 'all' : 'assigned', null);
          return;
        }
        var btn = e.target && e.target.closest ? e.target.closest('.revamp-filter-token') : null;
        if (!btn || btn.disabled) return;
        e.preventDefault();
        var mode = btn.getAttribute('data-mode') || 'assigned';
        var dest = btn.getAttribute('data-dest') || null;
        setPassOutFilter(mode, dest);
      });
      var legacy = bar.querySelector('#revamp-show-all');
      if (legacy) {
        legacy.addEventListener('change', function (e) {
          setPassOutFilter(e.target.checked ? 'all' : 'assigned', null);
        });
      }
    }
    syncFilterTokenBar();
  }

  function setPassOutFilter(mode, dest) {
    if (mode === 'dest' && dest) {
      filterState.mode = 'dest';
      filterState.dest = dest;
      showAllState.value = false;
    } else if (mode === 'all') {
      filterState.mode = 'all';
      filterState.dest = null;
      showAllState.value = true;
    } else if (mode === 'near') {
      filterState.mode = 'near';
      filterState.dest = null;
      showAllState.value = false;
    } else {
      filterState.mode = 'assigned';
      filterState.dest = null;
      showAllState.value = false;
    }
    syncFilterTokenBar();
    applyEmptyCardFilter();
  }

  function cardIsNearLimit(card) {
    if (!card) return false;
    var status = card.querySelector('.card-dot-status');
    if (status) {
      if (status.classList.contains('card-dot-warn')) return true;
      var st = status.textContent || '';
      if (/\(near limit\)|near DOT|Near Limit|near limit/i.test(st)) return true;
    }
    var hrs = card.querySelector('.card-total-hrs');
    if (hrs && /\(near limit\)|near DOT/i.test(hrs.textContent || '')) return true;
    // Plan-quality near-limit prose sometimes mirrored on card text
    var blob = (card.textContent || '');
    if (/\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?h\s*\(near limit\)/i.test(blob)) return true;
    return false;
  }

  /* Dest filter: tokens use phase.dest codes (EVG); cards show phase.label (Evergreen). */
  function buildDestMaps() {
    var labelToCode = {};
    var codeToLabel = {};
    try {
      var st = getState();
      var phases = (st && st.phases) || [];
      for (var i = 0; i < phases.length; i++) {
        var ph = phases[i];
        if (!ph || !ph.dest) continue;
        var code = String(ph.dest).toUpperCase();
        var label = String(ph.label || '').trim();
        if (label) {
          labelToCode[label.toLowerCase()] = code;
          codeToLabel[code] = label;
        } else if (!codeToLabel[code]) {
          codeToLabel[code] = code;
        }
      }
      var dests = (st && st.destinations) || [];
      for (var j = 0; j < dests.length; j++) {
        var d = dests[j];
        if (!d || !d.code) continue;
        var c = String(d.code).toUpperCase();
        var name = String((d.name || '').split(',')[0] || '').trim();
        if (name) {
          if (!labelToCode[name.toLowerCase()]) labelToCode[name.toLowerCase()] = c;
          if (!codeToLabel[c]) codeToLabel[c] = name;
        }
      }
    } catch (eMaps) {}
    return { labelToCode: labelToCode, codeToLabel: codeToLabel };
  }

  function phaseHeadText(phaseEl) {
    if (!phaseEl) return '';
    var raw = (phaseEl.childNodes[0] && phaseEl.childNodes[0].nodeType === 3)
      ? (phaseEl.childNodes[0].nodeValue || '')
      : (phaseEl.textContent || '');
    return raw.split(/[—\-\n]/)[0].trim();
  }

  function tagRunRowDests() {
    var grid = document.getElementById('driver-cards-grid');
    if (!grid) return;
    var maps = buildDestMaps();
    Array.prototype.forEach.call(grid.querySelectorAll('.run-row'), function (row) {
      if (row.classList.contains('drop-hint')) return;
      var code = '';
      var lab = row.querySelector('.run-label');
      if (lab) {
        var lt = (lab.textContent || '').trim().toUpperCase();
        // Shore/unassigned paint dest code; normal cards paint "RUN 1"
        if (/^[A-Z][A-Z0-9]{1,4}$/.test(lt) && lt.indexOf('RUN') !== 0) code = lt;
      }
      if (!code) {
        var head = phaseHeadText(row.querySelector('.run-phase'));
        if (head) {
          var mapped = maps.labelToCode[head.toLowerCase()];
          if (mapped) code = mapped;
          else if (/^[A-Za-z][A-Za-z0-9]{1,4}$/.test(head)) code = head.toUpperCase();
        }
      }
      if (code) {
        if (row.getAttribute('data-dest') !== code) row.setAttribute('data-dest', code);
      }
    });
  }

  function cardHasDest(card, dest) {
    if (!card || !dest) return false;
    var needle = String(dest).toUpperCase();
    var needleLow = needle.toLowerCase();
    // Prefer packaging-tagged data-dest on run rows
    var tagged = card.querySelectorAll('[data-dest]');
    for (var t = 0; t < tagged.length; t++) {
      if (String(tagged[t].getAttribute('data-dest') || '').toUpperCase() === needle) return true;
    }
    // Shore/unassigned .run-label is often the dest code
    var labels = card.querySelectorAll('.run-label');
    for (var li = 0; li < labels.length; li++) {
      var lt = (labels[li].textContent || '').trim().toUpperCase();
      if (lt === needle) return true;
    }
    var maps = buildDestMaps();
    var wantLabel = String(maps.codeToLabel[needle] || '').toLowerCase();
    var phases = card.querySelectorAll('.run-phase');
    for (var i = 0; i < phases.length; i++) {
      var head = phaseHeadText(phases[i]).toLowerCase();
      var rawLow = (phases[i].textContent || '').toLowerCase();
      if (!head && !rawLow) continue;
      if (head === needleLow || head.indexOf(needleLow) === 0) return true;
      if (wantLabel && (head === wantLabel || head.indexOf(wantLabel) === 0)) return true;
      var mapped = maps.labelToCode[head];
      if (mapped && mapped === needle) return true;
      // "Evergreen × 2 loads" collapsed shore summaries
      if (wantLabel && rawLow.indexOf(wantLabel) !== -1) return true;
      if (rawLow.indexOf(needleLow) !== -1) return true;
    }
    return false;
  }

  function collectDestTokens() {
    var parts = deriveInputChipParts();
    var list = (parts.dests || []).slice();
    list.sort(function (a, b) { return (b.n || 0) - (a.n || 0); });
    return list;
  }

  function syncFilterTokenBar() {
    var tokensEl = document.getElementById('revamp-filter-tokens');
    if (!tokensEl) return;
    var dests = collectDestTokens();
    var shown = dests.slice(0, DEST_TOKEN_MAX);
    var more = dests.length - shown.length;
    var html = '';
    function tok(label, mode, dest, selected) {
      return '<button type="button" class="revamp-filter-token' + (selected ? ' is-selected' : '') + '"' +
        ' data-mode="' + mode + '"' +
        (dest ? ' data-dest="' + String(dest).replace(/"/g, '&quot;') + '"' : '') +
        ' aria-pressed="' + (selected ? 'true' : 'false') + '">' + label + '</button>';
    }
    html += tok('Assigned', 'assigned', null, filterState.mode === 'assigned');
    html += tok('Show all', 'all', null, filterState.mode === 'all');
    html += tok('Near limit', 'near', null, filterState.mode === 'near');
    for (var i = 0; i < shown.length; i++) {
      var d = shown[i];
      var code = d.code || ('P' + i);
      var sel = filterState.mode === 'dest' && filterState.dest === code;
      html += tok(code, 'dest', code, sel);
    }
    if (more > 0) {
      html += '<span class="revamp-filter-more" title="Additional destinations not shown as tokens">+' + more + ' more</span>';
    }
    tokensEl.innerHTML = html;
    var legacy = document.getElementById('revamp-show-all');
    if (legacy) legacy.checked = !!showAllState.value;
  }

  function realRuns(card) {
    return Array.prototype.filter.call(card.querySelectorAll('.run-row'), function (r) {
      return !r.classList.contains('drop-hint');
    });
  }


  function collectDomicileSeverityNames() {
    var names = {};
    function add(n) {
      if (!n) return;
      var key = String(n).trim().toLowerCase();
      if (key) names[key] = true;
    }
    try {
      var domContent = document.getElementById('domicile-warning-content');
      if (domContent) {
        Array.prototype.forEach.call(domContent.querySelectorAll('.warning-row'), function (wr) {
          var strong = wr.querySelector('strong');
          if (strong && (strong.textContent || '').trim()) add(strong.textContent);
          else add(parseDomicileDriverName((wr.textContent || '').replace(/^\u26a0\ufe0f?\s*/, '').replace(/^⚠\s*/, '').trim()));
        });
      }
    } catch (e0) {}
    try {
      var pq = document.getElementById('plan-quality-content');
      if (pq) {
        Array.prototype.forEach.call(pq.querySelectorAll('.pq-row'), function (row) {
          var kind = (row.getAttribute('data-pq-kind') || row.getAttribute('data-revamp-mirror') || '').toUpperCase();
          if (kind !== 'DOMICILE' && !row.classList.contains('pq-domicile')) return;
          var dn = row.getAttribute('data-pq-driver') || '';
          if (!dn) {
            var msg = row.querySelector('.pq-msg');
            dn = parseDomicileDriverName(msg ? (msg.textContent || '') : (row.textContent || ''));
          }
          add(dn);
        });
      }
    } catch (e1) {}
    return names;
  }

  function cardDriverName(card) {
    if (!card) return '';
    var nm = card.querySelector('.drv-name');
    if (nm && (nm.textContent || '').trim()) return (nm.textContent || '').trim();
    var id = card.id || '';
    var m = id.match(/^drv-card-(.+)$/);
    return m ? m[1] : '';
  }

  function cardHasIdleDomicileSeverity(card, nameSet) {
    if (!card || !nameSet) return false;
    var name = cardDriverName(card);
    if (!name) return false;
    if (nameSet[name.toLowerCase()]) return true;
    // Partial match (first token) for "Name CARRIER" quirks
    var first = name.split(/\s+/)[0].toLowerCase();
    if (first && nameSet[first]) return true;
    for (var k in nameSet) {
      if (!Object.prototype.hasOwnProperty.call(nameSet, k)) continue;
      if (name.toLowerCase().indexOf(k) !== -1 || k.indexOf(name.toLowerCase()) !== -1) return true;
    }
    return false;
  }

  function applyEmptyCardFilter() {
    if (filterBusy) return;
    var grid = document.getElementById('driver-cards-grid');
    var toolbar = document.getElementById('revamp-cards-toolbar');
    if (!grid) return;
    filterBusy = true;
    try {
      ensureCardsToolbar();
      // Tag run rows with dest codes before filter (label vs code)
      try { tagRunRowDests(); } catch (eTag) {}
      // S2: inject calm Unassigned chrome before filter so Assigned keeps it glanceable
      try { ensureUnassignedCalmCard(); } catch (eUn) {}
      var cards = Array.prototype.slice.call(grid.querySelectorAll('.driver-card'));
      var emptyCount = 0;
      var assignedCount = 0;
      var visibleCount = 0;
      var assigned = [];
      var empties = [];
      var specials = [];
      var mode = filterState.mode || 'assigned';
      var dest = filterState.dest;
      // Idle-domicile severity names — keep those empty cards glanceable under Assigned
      var domicileSeverity = (mode === 'assigned') ? collectDomicileSeverityNames() : {};
      cards.forEach(function (card) {
        // Preserve unassigned / shore (overflow) special cards — never treat as "empty"
        var isSpecial = card.classList.contains('is-unassigned') || card.classList.contains('is-shore');
        var isEmpty = !isSpecial && realRuns(card).length === 0;
        var idleDom = isEmpty && cardHasIdleDomicileSeverity(card, domicileSeverity);
        card.classList.toggle('revamp-severity-keep', !!idleDom);
        if (isEmpty) emptyCount++;
        else if (!isSpecial) assignedCount++;
        if (isSpecial) specials.push(card);
        else if (isEmpty) empties.push(card);
        else assigned.push(card);

        var hide = false;
        if (mode === 'all') {
          hide = false;
        } else if (mode === 'near') {
          hide = !cardIsNearLimit(card);
        } else if (mode === 'dest') {
          hide = !cardHasDest(card, dest);
        } else {
          // assigned (default): hide empty/unused; keep Unassigned/Shore specials + idle-domicile
          hide = isSpecial ? false : (isEmpty && !idleDom);
        }
        card.classList.toggle('revamp-empty-hidden', hide);
        if (!hide) visibleCount++;
      });
      if (mode !== 'all') {
        // Assigned-first order for filtered views
        specials.concat(assigned, empties).forEach(function (c) { grid.appendChild(c); });
      }
      if (toolbar) {
        var showBar = cards.length > 0 && planExists();
        toolbar.classList.toggle('visible', showBar);
        var cb = toolbar.querySelector('#revamp-show-all');
        if (cb) cb.checked = !!showAllState.value;
        var hint = document.getElementById('revamp-empty-hint');
        if (hint) {
          if (mode === 'all') {
            hint.textContent = assignedCount + ' assigned · Show all reveals unused drivers';
          } else if (mode === 'near') {
            hint.textContent = visibleCount
              ? (visibleCount + ' near limit')
              : 'No drivers near DOT limit on this plan';
          } else if (mode === 'dest') {
            hint.textContent = visibleCount + ' with ' + (dest || 'dest');
          } else {
            hint.textContent = assignedCount + ' assigned · empty cards hidden (Show all for unused)';
          }
        }
        var emptyMsg = document.getElementById('revamp-filter-empty');
        if (emptyMsg) {
          var showEmpty = showBar && visibleCount === 0;
          emptyMsg.hidden = !showEmpty;
          if (showEmpty) {
            var cta = emptyMsg.querySelector('[data-revamp-clear-filters]');
            if (cta) {
              // Near/dest → Clear filters (back to Assigned); Assigned-with-zero is rare
              cta.textContent = (mode === 'assigned') ? 'Show all' : 'Clear filters';
              cta.setAttribute('data-revamp-clear-mode', (mode === 'assigned') ? 'all' : 'assigned');
            }
          }
        }
      }
      syncPassOutHeader();
      densifyCardHeaders();
      syncUnassignedEmpty();
    } finally {
      filterBusy = false;
    }
  }

  var pqRestyleBusy = false;
  var pqJumpBound = false;

  function pqTagClass(kind) {
    var k = (kind || '').toUpperCase();
    // Soft-amber family for issue chips; INFO stays calm blue-gray (settings).
    if (k === 'INFO') return 'info';
    if (k === 'DOMICILE') return 'dom';
    if (k === 'SHORE') return 'shore';
    if (k === 'WINDOW') return 'window';
    if (k === 'DOCK') return 'dock';
    return 'warn';
  }

  function pqRowClass(kind) {
    var k = (kind || '').toUpperCase();
    if (k === 'INFO') return 'pq-info';
    if (k === 'DOMICILE') return 'pq-domicile';
    if (k === 'HOURS') return 'pq-hours';
    if (k === 'SHORE') return 'pq-shore';
    if (k === 'WINDOW') return 'pq-window';
    if (k === 'DOCK') return 'pq-dock';
    if (k === 'DOT') return 'pq-dot';
    return 'pq-hours';
  }

  /* Classify free-prose plan-quality rows into short Belize tags. */
  function classifyPqKind(raw) {
    var t = (raw || '').replace(/^\u26a0\ufe0f?\s*/, '').replace(/^⚠\s*/, '').replace(/^⚡\s*/, '').trim();
    if (!t) return null;
    var pref = t.match(/^(HOURS|DOMICILE|INFO|DOT|SHORE|WINDOW|DOCK|OVERFLOW)\s*[—-]\s*/i);
    if (pref) return pref[1].toUpperCase() === 'OVERFLOW' ? 'SHORE' : pref[1].toUpperCase();
    if (/Hour spread:/i.test(t) || /no safe rebalance found/i.test(t)) return 'HOURS';
    if (/after window close|window close|deliveries span|wider than the .+ spread target|delivery window/i.test(t)) return 'WINDOW';
    // Real dock-wait prose only (no verify/demo scaffold inject; no bare "arrive before")
    if (/before .+ \(truck waits for dock\)|truck waits for dock/i.test(t)) return 'DOCK';
    if (/Overflow trucks used|overflow load/i.test(t) || /→\s*.+/.test(t) && /carrier-only|DOT limit|restriction|schedule\/reserved|external/i.test(t)) return 'SHORE';
    if (/→\s*/.test(t) && /\b(carrier-only|DOT limit|restriction|schedule)/i.test(t)) return 'SHORE';
    if (/\d+\s*→\s*/.test(t) || /external overflow|shoreline/i.test(t)) return 'SHORE';
    if (/\(near limit\)|near DOT|\/\s*\d+(\.\d+)?h\s*\(near limit\)/i.test(t)) return 'DOT';
    if (/could not be covered|internal-only load/i.test(t)) return 'INFO';
    return null;
  }

  function stripPqPrefix(raw) {
    return (raw || '')
      .replace(/^\u26a0\ufe0f?\s*/, '')
      .replace(/^⚠\s*/, '')
      .replace(/^⚡\s*/, '')
      .replace(/^(HOURS|DOMICILE|INFO|DOT|SHORE|WINDOW|DOCK|OVERFLOW)\s*[—-]\s*/i, '')
      .trim();
  }

  function parseDomicileDriverName(label) {
    var t = (label || '').trim();
    // "Name — last load ends at …" or "Name - last load…"
    var m = t.match(/^(.+?)\s+[—-]\s+last load/i);
    if (m) return m[1].trim();
    m = t.match(/^(.+?)\s+[—-]\s+/);
    if (m) return m[1].replace(/:$/, '').trim();
    return '';
  }

  function findDriverCard(driverName) {
    if (!driverName) return null;
    var st = getState();
    var drivers = (st && st.drivers) ? st.drivers : [];
    var needle = driverName.toLowerCase();
    var match = null;
    var i;
    // Prefer exact name match first
    for (i = 0; i < drivers.length; i++) {
      if ((drivers[i].name || '').toLowerCase() === needle) { match = drivers[i]; break; }
    }
    if (!match) {
      for (i = 0; i < drivers.length; i++) {
        var n = (drivers[i].name || '').toLowerCase();
        if (n.indexOf(needle) !== -1 || needle.indexOf(n) !== -1) { match = drivers[i]; break; }
      }
    }
    if (match && match.id) {
      var byId = document.getElementById('drv-card-' + match.id);
      if (byId) return byId;
    }
    var cards = document.querySelectorAll('[id^="drv-card-"], .driver-card');
    for (var j = 0; j < cards.length; j++) {
      var txt = (cards[j].textContent || '').toLowerCase();
      if (txt.indexOf(needle) !== -1) return cards[j];
    }
    return null;
  }

  function flashDriverCard(el) {
    if (!el) return;
    try { el.style.display = ''; el.hidden = false; } catch (eF) {}
    el.classList.remove('revamp-card-flash');
    void el.offsetWidth;
    el.classList.add('revamp-card-flash');
    setTimeout(function () { el.classList.remove('revamp-card-flash'); }, 2000);
  }

  function jumpToDriverCard(driverName) {
    try {
      if (typeof switchTab === 'function') switchTab('dashboard');
    } catch (e0) {}
    setTimeout(function () {
      var card = findDriverCard(driverName);
      if (!card) {
        // Empty-card filter may hide unused/domicile cards — try Show all
        try { setPassOutFilter('all', null); } catch (e1) {}
        card = findDriverCard(driverName);
      }
      if (card && typeof card.scrollIntoView === 'function') {
        try { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        catch (e2) { try { card.scrollIntoView(true); } catch (e3) {} }
      }
      flashDriverCard(card);
    }, 80);
  }

  function openSettingsDestinations() {
    try {
      if (typeof openSettings === 'function') openSettings();
    } catch (e1) {}
    try { ensureSettingsQuieting(); } catch (eQ) {}
    setTimeout(function () {
      var modal = document.getElementById('settings-modal');
      var body = modal && modal.querySelector('.settings-body');
      var destTitle = null;
      if (modal) {
        Array.prototype.slice.call(modal.querySelectorAll('.settings-section-title')).forEach(function (el) {
          if (/Destinations/i.test(el.textContent || '')) destTitle = el;
        });
      }
      var target = destTitle || document.getElementById('dest-tbody') ||
        (modal && modal.querySelector('#dest-tbody'));
      var scroller = body || modal;
      if (target && scroller && typeof target.scrollIntoView === 'function') {
        try { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e2) {
          try { target.scrollIntoView(true); } catch (e3) {}
        }
      } else if (target && scroller) {
        try { scroller.scrollTop = Math.max(0, target.offsetTop - 12); } catch (e4) {}
      }
    }, 80);
  }

  function buildPqMsgHtml(kind, label) {
    var msg = document.createElement('span');
    msg.className = 'pq-msg';
    if (kind === 'INFO' && /Settings\s*→\s*Destinations/i.test(label)) {
      var parts = label.split(/(Settings\s*→\s*Destinations)/i);
      parts.forEach(function (part) {
        if (/^Settings\s*→\s*Destinations$/i.test(part)) {
          var a = document.createElement('button');
          a.type = 'button';
          a.className = 'pq-jump pq-settings-link';
          a.setAttribute('data-pq-action', 'settings-dest');
          a.textContent = part;
          msg.appendChild(a);
        } else if (part) {
          msg.appendChild(document.createTextNode(part));
        }
      });
    } else {
      msg.textContent = label;
    }
    return msg;
  }

  function appendPqJump(row, kind, label) {
    if (!row) return;
    var existing = row.querySelector('.pq-jump[data-pq-action="view-driver"], .pq-jump.pq-view-driver');
    if (kind === 'DOMICILE') {
      var name = parseDomicileDriverName(label);
      if (!name) return;
      row.setAttribute('data-pq-driver', name);
      if (existing) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pq-jump pq-view-driver';
      btn.setAttribute('data-pq-action', 'view-driver');
      btn.setAttribute('data-pq-driver', name);
      btn.textContent = 'View';
      row.appendChild(btn);
      return;
    }
    if (existing) existing.remove();
  }

  function applyTypedPqRow(row, kind, label) {
    if (!row || !kind) return;
    var kindU = String(kind).toUpperCase();
    if (kindU === 'OVERFLOW') kindU = 'SHORE';
    row.className = 'pq-row ' + pqRowClass(kindU);
    if (row.getAttribute('data-revamp-mirror')) {
      /* keep mirror attr */
    }
    row.innerHTML = '';
    var tag = document.createElement('span');
    tag.className = 'pq-tag ' + pqTagClass(kindU);
    tag.textContent = pqChipLabel(kindU);
    row.appendChild(tag);
    row.appendChild(buildPqMsgHtml(kindU, label));
    appendPqJump(row, kindU, label);
    row.setAttribute('data-revamp-pq', '1');
    row.setAttribute('data-pq-kind', kindU);
  }

  function ensurePqJumpDelegation(content) {
    if (!content || content.getAttribute('data-revamp-pq-jump') === '1') return;
    content.setAttribute('data-revamp-pq-jump', '1');
    content.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var jump = t.closest('.pq-jump, .pq-settings-link, .pq-view-driver');
      if (!jump || !content.contains(jump)) return;
      e.preventDefault();
      e.stopPropagation();
      var action = jump.getAttribute('data-pq-action') || '';
      if (action === 'settings-dest' || jump.classList.contains('pq-settings-link')) {
        openSettingsDestinations();
        return;
      }
      if (action === 'view-driver' || jump.classList.contains('pq-view-driver')) {
        var name = jump.getAttribute('data-pq-driver') ||
          (jump.closest('.pq-row') && jump.closest('.pq-row').getAttribute('data-pq-driver')) || '';
        jumpToDriverCard(name);
      }
    });
  }

  /* Mirror production domicile / disabled-loc banners into Needs Attention (has-plan). */
  function syncExceptions(content) {
    if (!content) return;

    var desired = []; // { kind, cls, label }

    if (planExists()) {
      var domPanel = document.getElementById('domicile-warning-panel');
      var domContent = document.getElementById('domicile-warning-content');
      if (domPanel && domContent && domPanel.style.display !== 'none') {
        Array.prototype.slice.call(domContent.querySelectorAll('.warning-row')).forEach(function (wr) {
          var label = (wr.textContent || '').replace(/^\u26a0\ufe0f?\s*/, '').replace(/^⚠\s*/, '').trim();
          if (label) desired.push({ kind: 'DOMICILE', cls: 'pq-domicile', label: label });
        });
      }

      var ban = document.getElementById('disabled-loc-banner');
      if (ban && ban.style.display !== 'none') {
        var raw = (ban.textContent || '').trim().replace(/^🧪\s*/, '').trim();
        if (raw) {
          var namesM = raw.match(/Hypothetical:\s*(.+?)\s+disabled/i);
          var infoMsg = namesM
            ? (namesM[1].trim() + ' still off — Re-enable in Settings → Destinations')
            : raw.replace(/^Hypothetical:\s*/i, '');
          if (infoMsg) desired.push({ kind: 'INFO', cls: 'pq-info', label: infoMsg });
        }
      }
    }

    var existing = Array.prototype.slice.call(content.querySelectorAll('.pq-row[data-revamp-mirror]'));
    var keyOf = function (kind, label) { return kind + '\0' + label; };
    var wantKeys = desired.map(function (d) { return keyOf(d.kind, d.label); });
    var haveKeys = existing.map(function (r) {
      var kind = (r.getAttribute('data-revamp-mirror') || '').toUpperCase();
      var msgEl = r.querySelector('.pq-msg');
      var label = '';
      if (msgEl) {
        // Prefer text without the View jump control
        var clone = msgEl.cloneNode(true);
        Array.prototype.slice.call(clone.querySelectorAll('.pq-jump')).forEach(function (j) { j.remove(); });
        label = (clone.textContent || '').trim();
      } else {
        label = (r.textContent || '').trim();
        if (label.indexOf(kind + ' — ') === 0) label = label.slice(kind.length + 3);
        if (kind && label.indexOf(kind) === 0) {
          label = label.slice(kind.length).replace(/^\s*[—-]\s*/, '').trim();
        }
        label = label.replace(/\s*View\s*$/, '').trim();
      }
      return keyOf(kind, label);
    });
    // Idempotent: skip DOM writes when already mirrored correctly (avoids MO loop)
    if (wantKeys.join('|') === haveKeys.join('|')) {
      // Still ensure jumps exist on mirrored rows
      existing.forEach(function (r) {
        var kind = (r.getAttribute('data-revamp-mirror') || '').toUpperCase();
        var msgEl = r.querySelector('.pq-msg');
        var label = msgEl ? (msgEl.textContent || '').trim() : '';
        if (kind === 'INFO' && msgEl && /Settings\s*→\s*Destinations/i.test(label) && !msgEl.querySelector('.pq-settings-link')) {
          applyTypedPqRow(r, 'INFO', label);
          r.setAttribute('data-revamp-mirror', 'info');
        } else if (kind === 'DOMICILE') {
          appendPqJump(r, 'DOMICILE', label);
        }
      });
      return;
    }

    existing.forEach(function (r) { r.remove(); });
    desired.forEach(function (d) {
      var already = Array.prototype.some.call(content.querySelectorAll('.pq-row'), function (row) {
        if (row.getAttribute('data-revamp-mirror')) return false;
        var t = (row.textContent || '').trim();
        return (t.indexOf(d.kind) === 0 || t.indexOf(d.kind + ' —') === 0) && t.indexOf(d.label) !== -1;
      });
      if (already) return;
      var div = document.createElement('div');
      div.setAttribute('data-revamp-mirror', d.kind.toLowerCase());
      applyTypedPqRow(div, d.kind, d.label);
      content.appendChild(div);
    });
  }

  function restylePlanQuality() {
    if (pqRestyleBusy) return;
    pqRestyleBusy = true;
    try {
      relocatePlanQualityOnce();
      var panel = document.getElementById('plan-quality-panel');
      var content = document.getElementById('plan-quality-content');
      if (!panel || !content) return;
      panel.classList.add('revamp-needs');
      ensurePqJumpDelegation(content);

      var hd = panel.querySelector('.revamp-needs-hd');
      if (!hd) {
        Array.prototype.slice.call(panel.children).forEach(function (ch) {
          if (ch !== content && !ch.classList.contains('revamp-needs-hd') && !ch.classList.contains('needs-unused-extra')) ch.remove();
        });
        hd = document.createElement('div');
        hd.className = 'revamp-needs-hd';
        hd.setAttribute('role', 'button');
        hd.setAttribute('tabindex', '0');
        hd.innerHTML =
          '<div class="needs-title"><span class="needs-strip-ico" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false"><path fill="currentColor" d="M8 1.5L1.2 13.2c-.3.5.1 1.1.7 1.1h12.2c.6 0 1-.6.7-1.1L8 1.5zm0 3.2c.4 0 .7.4.7.8v3.2c0 .4-.3.8-.7.8s-.7-.4-.7-.8V5.5c0-.4.3-.8.7-.8zm0 6.2c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9z"/></svg></span>Needs attention <span class="needs-pill" id="revamp-needs-count">0</span></div>' +
          '<span class="needs-sub" id="revamp-needs-sub" hidden>Plan quality</span>' +
          '<button type="button" class="needs-unused-btn" id="revamp-needs-unused" hidden>0 unused ▾</button>' +
          '<span class="needs-chevron">▸</span>';
        panel.insertBefore(hd, content);
        var unusedExtra = document.createElement('div');
        unusedExtra.className = 'needs-unused-extra';
        unusedExtra.id = 'revamp-needs-unused-extra';
        panel.insertBefore(unusedExtra, content);
        function toggleNeedsOpen() { panel.classList.toggle('is-open'); }
        hd.addEventListener('click', function (e) {
          if (e.target && (e.target.id === 'revamp-needs-unused' || (e.target.closest && e.target.closest('#revamp-needs-unused')))) return;
          toggleNeedsOpen();
        });
        hd.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleNeedsOpen(); }
        });
        panel.classList.add('is-open');
        var unusedBtn = hd.querySelector('#revamp-needs-unused');
        if (unusedBtn) {
          unusedBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var ex = document.getElementById('revamp-needs-unused-extra');
            if (!ex) return;
            var open = ex.classList.toggle('show');
            var n = unusedBtn.getAttribute('data-count') || '0';
            unusedBtn.textContent = n + ' unused ' + (open ? '▴' : '▾');
          });
        }
      } else {
        // Prefer quieter sentence-case title (idempotent) + soft strip icon
        var titleEl = hd.querySelector('.needs-title');
        if (titleEl) {
          var pill = titleEl.querySelector('.needs-pill');
          var textNode = null;
          for (var ti = 0; ti < titleEl.childNodes.length; ti++) {
            if (titleEl.childNodes[ti].nodeType === 3 && (titleEl.childNodes[ti].textContent || '').trim()) {
              textNode = titleEl.childNodes[ti];
              break;
            }
          }
          var cur = textNode ? textNode.textContent.trim() : '';
          if (/^NEEDS ATTENTION$/i.test(cur) || cur === 'NEEDS ATTENTION') {
            textNode.textContent = 'Needs attention ';
          } else if (!pill) {
            titleEl.innerHTML = '<span class="needs-strip-ico" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false"><path fill="currentColor" d="M8 1.5L1.2 13.2c-.3.5.1 1.1.7 1.1h12.2c.6 0 1-.6.7-1.1L8 1.5zm0 3.2c.4 0 .7.4.7.8v3.2c0 .4-.3.8-.7.8s-.7-.4-.7-.8V5.5c0-.4.3-.8.7-.8zm0 6.2c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9z"/></svg></span>Needs attention <span class="needs-pill" id="revamp-needs-count">0</span>';
          } else if (!/Needs attention/i.test(titleEl.textContent || '')) {
            titleEl.innerHTML = '';
            titleEl.insertAdjacentHTML('afterbegin', '<span class="needs-strip-ico" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false"><path fill="currentColor" d="M8 1.5L1.2 13.2c-.3.5.1 1.1.7 1.1h12.2c.6 0 1-.6.7-1.1L8 1.5zm0 3.2c.4 0 .7.4.7.8v3.2c0 .4-.3.8-.7.8s-.7-.4-.7-.8V5.5c0-.4.3-.8.7-.8zm0 6.2c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9z"/></svg></span>');
            titleEl.appendChild(document.createTextNode('Needs attention '));
            titleEl.appendChild(pill);
          }
          if (!titleEl.querySelector('.needs-strip-ico')) {
            titleEl.insertAdjacentHTML('afterbegin', '<span class="needs-strip-ico" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false"><path fill="currentColor" d="M8 1.5L1.2 13.2c-.3.5.1 1.1.7 1.1h12.2c.6 0 1-.6.7-1.1L8 1.5zm0 3.2c.4 0 .7.4.7.8v3.2c0 .4-.3.8-.7.8s-.7-.4-.7-.8V5.5c0-.4.3-.8.7-.8zm0 6.2c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9z"/></svg></span>');
          }
        }
      }

      var unusedNames = [];
      // Prefer names already parked in the header accordion (idempotent re-entry)
      var unusedExtraPrefill = document.getElementById('revamp-needs-unused-extra');
      if (unusedExtraPrefill && unusedExtraPrefill.textContent) {
        unusedNames = unusedExtraPrefill.textContent.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      }
      Array.prototype.slice.call(content.querySelectorAll('.pq-row')).forEach(function (row) {
        if (row.getAttribute('data-revamp-pq') === '1') {
          // still harvest unused names from already-polished rows
          if (row.classList.contains('pq-unused') || row.querySelector('.pq-unused-collapsed')) {
            var ex0 = row.querySelector('.pq-unused-extra');
            if (ex0 && ex0.textContent) {
              unusedNames = ex0.textContent.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
            } else if (!unusedNames.length) {
              var btn0 = row.querySelector('.pq-unused-collapsed');
              var bm = btn0 && (btn0.textContent || '').match(/^(\d+)\s+unused/i);
              if (bm) {
                row.setAttribute('data-unused-count', bm[1]);
              }
            }
          } else {
            // Ensure jumps / typed chips stay actionable on already-polished rows
            var kind0 = (row.getAttribute('data-pq-kind') || row.getAttribute('data-revamp-mirror') || '').toUpperCase();
            var msg0 = row.querySelector('.pq-msg');
            var label0 = msg0 ? (msg0.textContent || '').trim() : '';
            if (!kind0 && msg0) {
              var tag0 = row.querySelector('.pq-tag');
              kind0 = tag0 ? (tag0.textContent || '').trim().toUpperCase() : '';
            }
            if (kind0 === 'INFO' && msg0 && /Settings\s*→\s*Destinations/i.test(label0) && !msg0.querySelector('.pq-settings-link')) {
              applyTypedPqRow(row, 'INFO', label0);
              if (row.getAttribute('data-revamp-mirror')) row.setAttribute('data-revamp-mirror', 'info');
            } else if (kind0 === 'DOMICILE') {
              appendPqJump(row, 'DOMICILE', label0);
            }
          }
          return;
        }
        var raw = (row.textContent || '').trim();

        // Unused → harvest for header accordion; hide body row
        if (row.classList.contains('pq-unused') || /^Unused:\s*/i.test(raw)) {
          var m = raw.match(/^Unused:\s*(.*)$/i);
          if (m) {
            unusedNames = m[1].split(',').map(function (s) { return s.trim(); }).filter(Boolean);
            unusedNames = unusedNames.filter(function (n) { return !/^\+\d+\s+more$/i.test(n) && n !== 'Show less'; });
          }
          row.classList.add('pq-unused');
          row.innerHTML = '<button type="button" class="pq-unused-collapsed" tabindex="-1">' +
            (unusedNames.length || 0) + ' unused</button>';
          row.setAttribute('data-revamp-pq', '1');
          return;
        }

        // Hour spread / soft rebalance → typed HOURS tag
        // Soften copy ONLY when plan-quality soft-rebalance prose is present
        if (/Hour spread:/i.test(raw) || /no safe rebalance found/i.test(raw) || /^HOURS\b/i.test(raw)) {
          var soft = /no safe rebalance found under current rules/i.test(raw);
          var spreadM = raw.match(/Hour spread:\s*([\d.]+h)\s*\(([^)]+)\)/i);
          var msg;
          if (spreadM) {
            msg = 'Hour spread ' + spreadM[1] + ' (' + spreadM[2] + ') vs unused';
          } else if (/^HOURS\s*[—-]\s*/i.test(raw)) {
            msg = raw.replace(/^HOURS\s*[—-]\s*/i, '');
          } else {
            msg = raw.replace(/^Hour spread:\s*/i, 'Hour spread ').replace(/\s*—\s*no safe rebalance found under current rules/i, '');
          }
          // Strip any pre-baked soften phrasing when condition is NOT soft
          if (!soft) {
            msg = msg
              .replace(/\s*[—(]\s*OK when loads\s*≪\s*roster\)?/gi, '')
              .replace(/\s*—\s*expected when loads\s*≪\s*roster/gi, '')
              .trim();
          } else if (!/loads\s*≪\s*roster/i.test(msg)) {
            msg += ' (OK when loads ≪ roster)';
          }
          applyTypedPqRow(row, 'HOURS', msg);
          if (soft) row.setAttribute('data-pq-soft', '1');
          else row.removeAttribute('data-pq-soft');
          return;
        }

        // Typed chips: WINDOW / DOCK / SHORE / DOT / DOMICILE / INFO (+ prefixed)
        var kindNew = classifyPqKind(raw);
        if (kindNew) {
          applyTypedPqRow(row, kindNew, stripPqPrefix(raw));
          return;
        }
      });

      syncExceptions(content);

      // Header unused control (preserve prior accordion names on idempotent re-entry)
      var unusedBtn = document.getElementById('revamp-needs-unused');
      var unusedExtra = document.getElementById('revamp-needs-unused-extra');
      if (unusedBtn) {
        if (!unusedNames.length && unusedExtra && unusedExtra.textContent) {
          unusedNames = unusedExtra.textContent.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        }
        if (!unusedNames.length) {
          var countFallback = 0;
          Array.prototype.slice.call(content.querySelectorAll('.pq-row')).forEach(function (ur) {
            if (!(ur.classList.contains('pq-unused') || ur.querySelector('.pq-unused-collapsed'))) return;
            var dc = ur.getAttribute('data-unused-count');
            if (dc) countFallback = Math.max(countFallback, parseInt(dc, 10) || 0);
            var bt = ur.querySelector('.pq-unused-collapsed');
            var mm = bt && (bt.textContent || '').match(/^(\d+)\s+unused/i);
            if (mm) countFallback = Math.max(countFallback, parseInt(mm[1], 10) || 0);
          });
          var prevC = parseInt(unusedBtn.getAttribute('data-count') || '0', 10) || 0;
          if (!countFallback && prevC) countFallback = prevC;
          if (countFallback && !unusedNames.length) {
            // Keep accordion visible with count; names unknown on re-entry without extra
            unusedBtn.hidden = false;
            unusedBtn.setAttribute('data-count', String(countFallback));
            var isOpenUF = unusedExtra && unusedExtra.classList.contains('show');
            unusedBtn.textContent = countFallback + ' unused ' + (isOpenUF ? '▴' : '▾');
          } else if (!countFallback) {
            unusedBtn.hidden = true;
            if (unusedExtra) {
              unusedExtra.classList.remove('show');
              unusedExtra.textContent = '';
            }
          }
        }
        if (unusedNames.length) {
          // Drop placeholder-only lists
          var realNames = unusedNames.filter(function (n) { return n && n !== 'driver'; });
          if (realNames.length) unusedNames = realNames;
          unusedBtn.hidden = false;
          unusedBtn.setAttribute('data-count', String(unusedNames.length));
          var isOpenU = unusedExtra && unusedExtra.classList.contains('show');
          unusedBtn.textContent = unusedNames.length + ' unused ' + (isOpenU ? '▴' : '▾');
          if (unusedExtra && realNames.length) unusedExtra.textContent = unusedNames.join(', ');
        }
      }

      // Pill = typed issue rows (HOURS, DOMICILE, INFO, DOT, …); exclude unused accordion
      var count = 0;
      Array.prototype.slice.call(content.querySelectorAll('.pq-row')).forEach(function (row) {
        if (row.classList.contains('pq-unused') || row.querySelector('.pq-unused-collapsed')) return;
        count++;
      });
      var pill = document.getElementById('revamp-needs-count');
      var sub = document.getElementById('revamp-needs-sub');
      if (pill) pill.textContent = String(count);
      if (sub) {
        sub.textContent = count ? (count + ' issue' + (count === 1 ? '' : 's') + ' to review') : 'All clear';
        sub.hidden = true; // unused control owns the right side
      }
      // Show whenever we have typed issues OR unused drivers to surface
      var unusedCountAttr = 0;
      if (unusedBtn) unusedCountAttr = parseInt(unusedBtn.getAttribute('data-count') || '0', 10) || 0;
      var visible = count > 0 || unusedNames.length > 0 || unusedCountAttr > 0 || (unusedBtn && !unusedBtn.hidden);
      panel.classList.toggle('is-visible', visible);
      if (!visible) panel.classList.remove('is-open');
    } finally {
      pqRestyleBusy = false;
    }
  }

  function wrap(name, after) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig.__revampWrapped) return;
    var wrapped = function () {
      var ret = orig.apply(this, arguments);
      try { after(ret); } catch (e) { console.warn('[revamp]', name, e); }
      return ret;
    };
    wrapped.__revampWrapped = true;
    wrapped.__revampOrig = orig;
    window[name] = wrapped;
  }


  /* ═══ Wave 3 / TP#3 — DC go-live ready-gate (preview only) ═══
     Prevent fiction networks: switcher works but Generate must not run on
     empty/placeholder rosters (0 available drivers or 0 enabled destinations).
     Soft-block Generate; soft-warn Commit if a plan somehow exists. */
  function countAvailableDrivers() {
    try {
      if (typeof getAvailableDrivers === 'function') {
        return getAvailableDrivers().length;
      }
    } catch (e0) {}
    try {
      var st = getState();
      if (!st || !Array.isArray(st.drivers)) return -1; // unknown
      var wi = st.whatIf || {};
      var n = 0;
      for (var i = 0; i < st.drivers.length; i++) {
        var d = st.drivers[i];
        if (!d) continue;
        if (d.onVacation) continue;
        if (d.active === false) continue;
        if (wi[d.id] && wi[d.id].inactive) continue;
        n++;
      }
      return n;
    } catch (e1) { return -1; }
  }

  /** Roster size (any driver records), independent of vacation / what-if. -1 = unknown. */
  function countRosterDrivers() {
    try {
      var st = getState();
      if (!st || !Array.isArray(st.drivers)) return -1;
      return st.drivers.length;
    } catch (e) { return -1; }
  }

  function countEnabledDestinations() {
    try {
      var st = getState();
      if (!st || !Array.isArray(st.destinations)) return -1;
      var n = 0;
      for (var i = 0; i < st.destinations.length; i++) {
        var d = st.destinations[i];
        if (d && !d.disabled) n++;
      }
      return n;
    } catch (e) { return -1; }
  }

  function countDailyLoads() {
    try {
      var st = getState();
      if (!st || !Array.isArray(st.loads)) return -1;
      var sum = 0;
      for (var i = 0; i < st.loads.length; i++) sum += (Number(st.loads[i]) || 0);
      return sum;
    } catch (e) { return -1; }
  }

  /** @returns {{ready:boolean, blockGenerate:boolean, reason:string|null, softLoads:boolean, activeDrivers:number, rosterDrivers:number, enabledDests:number, totalLoads:number}} */
  function getDcReadiness() {
    var activeDrivers = countAvailableDrivers();
    var rosterDrivers = countRosterDrivers();
    var enabledDests = countEnabledDestinations();
    var totalLoads = countDailyLoads();
    var out = {
      ready: true,
      blockGenerate: false,
      reason: null,
      softLoads: false,
      activeDrivers: activeDrivers,
      rosterDrivers: rosterDrivers,
      enabledDests: enabledDests,
      totalLoads: totalLoads
    };
    // Unknown state during boot → do not block
    if (activeDrivers < 0 && enabledDests < 0) return out;
    if (activeDrivers === 0) {
      out.ready = false;
      out.blockGenerate = true;
      // Empty roster vs everyone vacation/inactive (must-fix copy split)
      out.reason = (rosterDrivers === 0) ? 'no-drivers-empty' : 'no-drivers-unavailable';
    } else if (enabledDests === 0) {
      out.ready = false;
      out.blockGenerate = true;
      out.reason = 'no-dests';
    }
    if (totalLoads === 0) out.softLoads = true;
    return out;
  }

  function readyGateCopy(reason) {
    if (reason === 'no-drivers-empty' || reason === 'no-drivers') {
      return {
        title: 'No drivers on this DC',
        body: 'Add at least one driver before generating a plan.',
        cta: 'Open Drivers \u00b7 + Add Driver',
        action: 'drivers-add'
      };
    }
    if (reason === 'no-drivers-unavailable') {
      return {
        title: 'No drivers available',
        body: 'Everyone is on vacation or inactive \u2014 clear vacation or re-enable before Generate.',
        cta: 'Open Drivers',
        action: 'drivers'
      };
    }
    if (reason === 'no-dests') {
      return {
        title: 'No destinations enabled',
        body: 'Turn on at least one destination in Settings so Generate has lanes to plan.',
        cta: 'Settings \u2192 Destinations',
        action: 'dests'
      };
    }
    if (reason === 'no-loads') {
      return {
        title: 'No loads entered yet',
        body: 'You can explore the sheet, but enter today\u2019s counts before a useful Generate.',
        cta: null,
        action: null
      };
    }
    return {
      title: 'This DC is not ready',
      body: 'Finish roster and destinations setup before generating.',
      cta: null,
      action: null
    };
  }

  function openDriversTabForReadyGate(scrollToAdd) {
    try {
      if (typeof switchTab === 'function') {
        var fleetBtn = document.querySelector('.tab-btn[onclick*="fleet"]');
        try { switchTab('fleet', fleetBtn ? { currentTarget: fleetBtn } : null); }
        catch (e1) { try { switchTab('fleet'); } catch (e2) {} }
      }
    } catch (e) {}
    if (!scrollToAdd) return;
    // Empty-roster CTA: mild scroll toward Add Driver if present
    setTimeout(function () {
      try {
        var addBtn = document.querySelector('#tab-fleet button[onclick*="openDriverModal"], #tab-fleet button[onclick*="addDriver"], #tab-fleet .btn-primary');
        if (addBtn && typeof addBtn.scrollIntoView === 'function') {
          try { addBtn.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e3) {}
        }
      } catch (e4) {}
    }, 80);
  }

  function ensureDcReadyGateBanner() {
    var gen = document.querySelector('#tab-dashboard .btn-generate');
    if (!gen || !gen.parentNode) return null;
    var el = document.getElementById('revamp-dc-ready-gate');
    if (!el) {
      el = document.createElement('div');
      el.id = 'revamp-dc-ready-gate';
      el.className = 'revamp-dc-ready-gate no-print';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.innerHTML =
        '<span class="revamp-dc-ready-gate__icon" aria-hidden="true">!</span>' +
        '<div class="revamp-dc-ready-gate__body">' +
          '<div class="revamp-dc-ready-gate__title"></div>' +
          '<p class="revamp-dc-ready-gate__text"></p>' +
          '<div class="revamp-dc-ready-gate__cta" hidden>' +
            '<button type="button" class="revamp-dc-ready-gate__link" data-revamp-ready-cta></button>' +
          '</div>' +
        '</div>';
      // Place above Generate (and above no-plan empty if present)
      var noplan = document.getElementById('revamp-noplan-empty');
      if (noplan && noplan.parentNode === gen.parentNode) {
        gen.parentNode.insertBefore(el, noplan);
      } else {
        gen.parentNode.insertBefore(el, gen);
      }
      if (!el.__revampReadyCta) {
        el.__revampReadyCta = true;
        el.addEventListener('click', function (e) {
          var btn = e.target && e.target.closest ? e.target.closest('[data-revamp-ready-cta]') : null;
          if (!btn) return;
          e.preventDefault();
          var action = btn.getAttribute('data-revamp-ready-cta') || '';
          if (action === 'drivers-add') openDriversTabForReadyGate(true);
          else if (action === 'drivers') openDriversTabForReadyGate(false);
          else if (action === 'dests') openSettingsDestinations();
        });
      }
    }
    return el;
  }

  function applyGenerateNotReadyAttrs(block) {
    var nodes = [];
    Array.prototype.forEach.call(document.querySelectorAll('.btn-generate'), function (b) { nodes.push(b); });
    ['revamp-rerun-btn', 'revamp-fresh-btn'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) nodes.push(el);
    });
    nodes.forEach(function (b) {
      if (block) {
        b.setAttribute('aria-disabled', 'true');
        b.classList.add('revamp-dc-not-ready');
        b.title = 'Finish DC setup before generating';
      } else {
        b.removeAttribute('aria-disabled');
        b.classList.remove('revamp-dc-not-ready');
        if ((b.getAttribute('title') || '') === 'Finish DC setup before generating') {
          b.removeAttribute('title');
        }
      }
    });
  }

  function showReadyGateAttention() {
    var gate = ensureDcReadyGateBanner();
    if (!gate) return;
    gate.classList.add('is-visible');
    try {
      if (typeof gate.scrollIntoView === 'function') {
        gate.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch (e) {}
    gate.classList.remove('revamp-ready-gate-flash');
    // force reflow for flash
    void gate.offsetWidth;
    gate.classList.add('revamp-ready-gate-flash');
    var statusEl = document.getElementById('revamp-sticky-status');
    if (statusEl) {
      var r = getDcReadiness();
      var copy = readyGateCopy(r.reason || 'no-drivers');
      statusEl.textContent = copy.title;
      statusEl.classList.add('revamp-ready-gate-msg');
      clearTimeout(showReadyGateAttention._t);
      showReadyGateAttention._t = setTimeout(function () {
        statusEl.classList.remove('revamp-ready-gate-msg');
        try { syncSticky(); } catch (e2) {}
      }, 2800);
    }
  }

  function syncDcReadyGate() {
    try {
      var r = getDcReadiness();
      var block = !!r.blockGenerate;
      document.body.classList.toggle('revamp-dc-not-ready', block);
      applyGenerateNotReadyAttrs(block);

      var gate = ensureDcReadyGateBanner();
      if (!gate) return r;

      var showHard = block;
      var showSoft = !block && r.softLoads && !planExists();
      if (showHard || showSoft) {
        var reason = showHard ? r.reason : 'no-loads';
        var copy = readyGateCopy(reason);
        gate.classList.toggle('is-soft', !!showSoft && !showHard);
        gate.classList.add('is-visible');
        var titleEl = gate.querySelector('.revamp-dc-ready-gate__title');
        var textEl = gate.querySelector('.revamp-dc-ready-gate__text');
        var ctaWrap = gate.querySelector('.revamp-dc-ready-gate__cta');
        var ctaBtn = gate.querySelector('[data-revamp-ready-cta]');
        if (titleEl) titleEl.textContent = copy.title;
        if (textEl) textEl.textContent = copy.body;
        if (ctaWrap && ctaBtn) {
          if (copy.cta && copy.action) {
            ctaWrap.hidden = false;
            ctaBtn.textContent = copy.cta;
            ctaBtn.setAttribute('data-revamp-ready-cta', copy.action);
          } else {
            ctaWrap.hidden = true;
            ctaBtn.removeAttribute('data-revamp-ready-cta');
          }
        }
        // Prefer ready-gate over generic no-plan empty when blocking
        if (showHard) {
          var noplan = document.getElementById('revamp-noplan-empty');
          if (noplan) noplan.hidden = true;
        }
      } else {
        gate.classList.remove('is-visible', 'is-soft');
      }
      try { syncCommitNotReadyGate(!!(r.blockGenerate && planExists())); } catch (eCn) {}
      return r;
    } catch (e) {
      console.warn('[revamp] syncDcReadyGate', e);
      return { ready: true, blockGenerate: false, reason: null };
    }
  }

  function guardGenerateIfNotReady() {
    var r = getDcReadiness();
    if (r.blockGenerate) {
      showReadyGateAttention();
      try { syncDcReadyGate(); } catch (e) {}
      return true; // blocked
    }
    return false;
  }

  function showCommitNotReadyQuiet() {
    var statusEl = document.getElementById('revamp-sticky-status');
    if (!statusEl) return;
    var r = getDcReadiness();
    var copy = readyGateCopy(r.reason || 'no-drivers');
    statusEl.textContent = copy.title + ' — fix roster before Commit';
    statusEl.classList.add('revamp-ready-gate-msg');
    clearTimeout(showCommitNotReadyQuiet._t);
    showCommitNotReadyQuiet._t = setTimeout(function () {
      statusEl.classList.remove('revamp-ready-gate-msg');
      try { syncSticky(); } catch (e) {}
    }, 3200);
    showReadyGateAttention();
  }

  function setGenerateBusy(on) {
    try {
      document.body.classList.toggle('revamp-gen-busy', !!on);
      var ids = ['revamp-rerun-btn', 'revamp-fresh-btn'];
      for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (!el) continue;
        if (on) {
          el.setAttribute('disabled', 'disabled');
          el.setAttribute('aria-busy', 'true');
        } else {
          el.removeAttribute('disabled');
          el.removeAttribute('aria-busy');
        }
      }
      // Mid-page Generate when visible (no-plan path)
      Array.prototype.forEach.call(document.querySelectorAll('.btn-generate'), function (b) {
        if (on) { b.setAttribute('disabled', 'disabled'); b.setAttribute('aria-busy', 'true'); }
        else { b.removeAttribute('disabled'); b.removeAttribute('aria-busy'); }
      });
    } catch (e) {}
  }

  function afterGenerate() {
    // Fresh full generate resets collapse defaults for morning path
    detailsOpen = false;
    workloadOpen = false;
    inputForcedExpand = false;
    setupUntuck = false;
    document.body.classList.remove('revamp-input-editing');
    document.body.classList.remove('revamp-input-advanced');
    document.body.classList.remove('revamp-plan-stale');
    setGenerateBusy(false);
    syncCommitStaleGate();
    syncSticky();
    updatePlanSummary();
    ensureCardsToolbar();
    applyEmptyCardFilter();
    restylePlanQuality();
    syncEmptyStates();
    syncDcReadyGate();
    try { stampRevampLastGenerate(); } catch (eGenAudit) {}
    try { syncCommitAuditPreviewChrome(); } catch (eCap) {}
  }

  // Double-Generate guard: busy chrome around generate/rerun (sync; clears in after).
  // Depth allows generateAssignments → rerunRemaining nesting (prod lock-preserving path)
  // without the inner wrap seeing revamp-gen-busy and no-op'ing.
  var genBusyDepth = 0;
  (function wrapGenerateBusy(name) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig.__revampGenBusy) return;
    var wrapped = function () {
      // Nested call from the other wrapped generate entry (same sync stack)
      if (genBusyDepth > 0) {
        return orig.apply(this, arguments);
      }
      // TP#3 ready-gate: soft-block fiction Generate (0 drivers / 0 dests)
      if (guardGenerateIfNotReady()) return;
      if (document.body.classList.contains('revamp-gen-busy')) return;
      setGenerateBusy(true);
      genBusyDepth++;
      var ret;
      try {
        ret = orig.apply(this, arguments);
      } catch (err) {
        genBusyDepth = 0;
        setGenerateBusy(false);
        throw err;
      }
      genBusyDepth = 0;
      try { afterGenerate(ret); } catch (e) { console.warn('[revamp]', name, e); setGenerateBusy(false); }
      return ret;
    };
    wrapped.__revampWrapped = true;
    wrapped.__revampGenBusy = true;
    wrapped.__revampOrig = orig.__revampOrig || orig;
    window[name] = wrapped;
  })('generateAssignments');
  (function wrapGenerateBusy(name) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig.__revampGenBusy) return;
    var wrapped = function () {
      if (genBusyDepth > 0) {
        return orig.apply(this, arguments);
      }
      if (guardGenerateIfNotReady()) return;
      if (document.body.classList.contains('revamp-gen-busy')) return;
      setGenerateBusy(true);
      genBusyDepth++;
      var ret;
      try {
        ret = orig.apply(this, arguments);
      } catch (err) {
        genBusyDepth = 0;
        setGenerateBusy(false);
        throw err;
      }
      genBusyDepth = 0;
      try { afterGenerate(ret); } catch (e) { console.warn('[revamp]', name, e); setGenerateBusy(false); }
      return ret;
    };
    wrapped.__revampWrapped = true;
    wrapped.__revampGenBusy = true;
    wrapped.__revampOrig = orig.__revampOrig || orig;
    window[name] = wrapped;
  })('rerunRemaining');
  wrap('switchTab', function () {
    syncSticky();
    syncEmptyStates();
  });
  wrap('renderDriverCards', function () {
    syncSticky();
    updatePlanSummary();
    ensureCardsToolbar();
    applyEmptyCardFilter();
    syncEmptyStates();
    try { purgePackagingEmojis(); } catch (eP) {}
    try { polishRunReorderChrome(); } catch (eR) {}
  });
  wrap('toggleDetailCols', function () {
    try { polishAssignmentsChrome(); } catch (eD) {}
  });
  wrap('renderAssignments', function () {
    try { polishAssignmentsChrome(); purgePackagingEmojis(); } catch (eT) {}
  });
  wrap('renderPlanQuality', restylePlanQuality);
  wrap('renderDomicileWarnings', restylePlanQuality);
  wrap('openSettings', function () { try { ensureSettingsQuieting(); } catch (eS) {} });
  wrap('updateDisabledBanner', function () { restylePlanQuality(); try { syncDcReadyGate(); } catch (e) {} });
  wrap('renderMetrics', updatePlanSummary);
  // S1-2: packaging gate — block Commit while stale banner/body class active
  (function wrapCommitStaleGate() {
    var orig = window.commitToHistory;
    if (typeof orig !== 'function' || orig.__revampCommitStale) return;
    var wrapped = function () {
      if (isPlanStale()) {
        showCommitStaleQuiet();
        return;
      }
      // Soft-warn Commit if fiction network somehow planned (0 drivers / 0 dests)
      try {
        var rCommit = getDcReadiness();
        if (rCommit.blockGenerate) {
          showCommitNotReadyQuiet();
          return;
        }
      } catch (eNr) {}
      var ret = orig.apply(this, arguments);
      try {
        // TP#5: local-only commit audit snapshot (no RPC / DB change)
        var dateArg = arguments.length ? arguments[0] : undefined;
        appendRevampCommitAudit(dateArg);
      } catch (eAud) { console.warn('[revamp] commit audit', eAud); }
      try {
        syncSticky();
        syncEmptyStates();
        syncDcReadyGate();
        syncHistoryAuditChrome();
        syncCommitAuditPreviewChrome();
      } catch (e) { console.warn('[revamp] commitToHistory', e); }
      return ret;
    };
    wrapped.__revampWrapped = true;
    wrapped.__revampCommitStale = true;
    wrapped.__revampOrig = orig.__revampOrig || orig;
    window.commitToHistory = wrapped;
  })();
  wrap('markResultStale', function () {
    var banner = document.getElementById('stale-result-banner');
    var shown = !!(banner && (banner.style.display || '').toLowerCase() === 'flex');
    document.body.classList.toggle('revamp-plan-stale', shown);
    syncCommitStaleGate();
  });
  wrap('clearStaleBanner', function () {
    document.body.classList.remove('revamp-plan-stale');
    syncCommitStaleGate();
  });
  wrap('renderFleetTable', function () { syncDriversEmpty(); try { syncDcReadyGate(); } catch (e) {} try { syncHomeFirstGapNote(); } catch (eHf) {} try { purgePackagingEmojis(); } catch (eP) {} });
  wrap('renderHistoryTab', function () {
    syncHistoryEmpty();
    try { syncHistoryAuditChrome(); } catch (eHa) {}
  });
  wrap('renderAll', function () {
    syncSticky();
    updatePlanSummary();
    ensureCardsToolbar();
    applyEmptyCardFilter();
    restylePlanQuality();
    syncEmptyStates();
  });
  wrap('renderPhaseInputs', function () {
    syncDailyLoadChips();
    try { syncDcReadyGate(); } catch (e) {}
  });
  function restoreCompactAfterDone() {
    if (!planExists()) return;
    inputForcedExpand = false;
    document.body.classList.remove('revamp-input-editing');
    document.body.classList.remove('revamp-input-advanced');
    var card = getDailyInputCard();
    if (card) card.classList.add('input-card-collapsed');
    syncDailyLoadChips();
    syncSetupTuck();
  }

  wrap('toggleInputCard', function () {
    var card = getDailyInputCard();
    var collapsed = !!(card && card.classList.contains('input-card-collapsed'));
    if (collapsed && planExists()) {
      // Done / Collapse while has-plan → restore quiet chip row (never legacy cs-chips)
      restoreCompactAfterDone();
    } else if (!collapsed && planExists() && inputForcedExpand) {
      document.body.classList.add('revamp-input-editing');
      syncInputToggleLabel();
      syncDailyLoadHeaderChrome();
    } else {
      syncInputToggleLabel();
      syncDailyLoadHeaderChrome();
    }
  });

  // Belt-and-suspenders: intrinsic onclick + wrap can race; catch Done/Collapse on the button
  (function armInputToggleRestore() {
    var btn = document.getElementById('input-toggle-btn');
    if (!btn || btn.__revampDoneArm) return;
    btn.__revampDoneArm = true;
    btn.addEventListener('click', function () {
      setTimeout(function () {
        var card = getDailyInputCard();
        var collapsed = !!(card && card.classList.contains('input-card-collapsed'));
        if (collapsed && planExists()) {
          restoreCompactAfterDone();
        } else if (!collapsed && planExists() && inputForcedExpand) {
          document.body.classList.add('revamp-input-editing');
          syncInputToggleLabel();
        }
      }, 0);
    });
  })();
  wrap('renderLoadBucket', function () {
    syncSetupTuck();
  });

  var section = document.getElementById('driver-cards-section');
  if (section && typeof MutationObserver !== 'undefined') {
    new MutationObserver(function () {
      syncSticky();
      updatePlanSummary();
      if (section.style.display !== 'none') {
        ensureCardsToolbar();
        applyEmptyCardFilter();
        restylePlanQuality();
      }
    }).observe(section, { attributes: true, attributeFilter: ['style', 'class'] });
  }

  // Re-apply assigned-first / empty filter after card DOM mutations (debounced; skips self-reorders)
  function armGridObserver() {
    var grid = document.getElementById('driver-cards-grid');
    if (!grid || typeof MutationObserver === 'undefined' || grid.__revampMo) return;
    grid.__revampMo = new MutationObserver(function () {
      if (filterBusy) return;
      if (gridMoTimer) clearTimeout(gridMoTimer);
      gridMoTimer = setTimeout(function () {
        ensureCardsToolbar();
        applyEmptyCardFilter();
        densifyCardHeaders();
      }, 40);
    });
    grid.__revampMo.observe(grid, { childList: true, subtree: true });
  }
  armGridObserver();

  syncSticky();
  updatePlanSummary();
  ensureCardsToolbar();
  applyEmptyCardFilter();
  restylePlanQuality();

  // delayed packaging sync after async Supabase hydrate
  setTimeout(function () { syncSticky(); ensureCardsToolbar(); applyEmptyCardFilter(); restylePlanQuality(); updatePlanSummary(); }, 0);
  setTimeout(function () { syncSticky(); restylePlanQuality(); updatePlanSummary(); }, 800);
  setTimeout(function () { syncSticky(); restylePlanQuality(); updatePlanSummary(); }, 2000);
  setTimeout(function () { syncSticky(); restylePlanQuality(); updatePlanSummary(); }, 4000);
  try {
    var pq = document.getElementById('plan-quality-content');
    if (pq && typeof MutationObserver !== 'undefined' && !pq.__revampMo) {
      pq.__revampMo = new MutationObserver(function () {
        setTimeout(restylePlanQuality, 30);
      });
      pq.__revampMo.observe(pq, { childList: true, subtree: true, characterData: true });
    }
  } catch (e) {}



  /* Pass-out card densify: park Ad Hoc / What-if under ··· (preserve onclick) */
  function closeAllCardMore(except) {
    Array.prototype.forEach.call(document.querySelectorAll('.revamp-card-more.is-open'), function (el) {
      if (except && el === except) return;
      el.classList.remove('is-open');
      var b = el.querySelector('.revamp-card-more-btn');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }

  function densifyCardHeaders() {
    var grid = document.getElementById('driver-cards-grid');
    if (!grid) return;
    try { tagRunRowDests(); } catch (eTag2) {}

    // Shore/Shoreline card chrome → DC_CONFIG.externalCarrier (display only)
    try {
      var carrier = getExternalCarrierLabel();
      if (carrier) {
        Array.prototype.forEach.call(grid.querySelectorAll('.driver-card.is-shore .drv-name'), function (el) {
          var t = el.textContent || '';
          if (/Shoreline|\bSHORE\b|\bShore\b/i.test(t)) {
            el.textContent = t
              .replace(/Shoreline/gi, carrier)
              .replace(/\bSHORE\b/g, carrier)
              .replace(/\bShore\b/g, carrier);
          }
        });
      }
    } catch (eShore) {}

    // Soft-class deadhead notes in footers (inline amber/green → muted via CSS)
    Array.prototype.forEach.call(grid.querySelectorAll('.driver-card-footer > span'), function (sp) {
      if (sp.classList.contains('card-total-hrs') || sp.classList.contains('card-dot-status')) return;
      var t = sp.textContent || '';
      if (/deadhead/i.test(t)) sp.classList.add('revamp-deadhead');
    });

    Array.prototype.forEach.call(grid.querySelectorAll('.driver-card-header'), function (hdr) {
      if (hdr.querySelector('.revamp-card-more')) return;
      var adhoc = hdr.querySelector(':scope > .btn-adhoc-add, :scope > div .btn-adhoc-add');
      var wi = hdr.querySelector(':scope > .wi-toggle-btn, :scope > div .wi-toggle-btn');
      // Fallback without :scope for older engines
      if (!adhoc) adhoc = hdr.querySelector('.btn-adhoc-add');
      if (!wi) wi = hdr.querySelector('.wi-toggle-btn');
      if (!adhoc && !wi) return;

      var wrap = document.createElement('div');
      wrap.className = 'revamp-card-more no-print';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'revamp-card-more-btn';
      btn.setAttribute('aria-label', 'More card actions');
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = '\u00b7\u00b7\u00b7';
      var menu = document.createElement('div');
      menu.className = 'revamp-card-more-menu';
      menu.setAttribute('role', 'menu');

      var group = null;
      if (adhoc && adhoc.parentElement && adhoc.parentElement !== hdr) group = adhoc.parentElement;
      else if (wi && wi.parentElement && wi.parentElement !== hdr) group = wi.parentElement;

      var buttons = [];
      if (group && (group.querySelector('.btn-adhoc-add') || group.querySelector('.wi-toggle-btn'))) {
        buttons = Array.prototype.slice.call(group.querySelectorAll('.btn-adhoc-add, .wi-toggle-btn'));
        buttons.forEach(function (b) { menu.appendChild(b); });
        if (group.parentNode) group.parentNode.replaceChild(wrap, group);
        else hdr.appendChild(wrap);
      } else {
        if (adhoc) menu.appendChild(adhoc);
        if (wi && wi.parentNode) menu.appendChild(wi);
        hdr.appendChild(wrap);
      }
      wrap.appendChild(btn);
      wrap.appendChild(menu);

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var willOpen = !wrap.classList.contains('is-open');
        closeAllCardMore(wrap);
        wrap.classList.toggle('is-open', willOpen);
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });

      // Keep menu items calling original handlers; close after click
      Array.prototype.forEach.call(menu.querySelectorAll('button'), function (item) {
        item.addEventListener('click', function () {
          setTimeout(function () { closeAllCardMore(); }, 0);
        });
      });
    });

    try { polishShoreExpandAffordance(); } catch (eSh) {}
    try { polishCardEmojiChrome(); } catch (eEm) {}
  }

  function polishShoreExpandAffordance() {
    var shore = document.querySelector('#driver-cards-grid .driver-card.is-shore');
    if (!shore) return;
    var expanded = false;
    try { expanded = !!(typeof shoreExpanded !== 'undefined' && shoreExpanded); } catch (e0) {}
    // DOM fallback: expanded shore has Out / Lock buttons or draggable load rows
    if (shore.querySelector('.out-btn[onclick*="openOutModal"], .out-btn[onclick*="openBucketOutModal"], .out-btn[onclick*="toggleLock"], .run-row[draggable="true"]')) {
      expanded = true;
    }
    shore.classList.toggle('is-shore-expanded', !!expanded);

    function activateShoreExpand(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (typeof toggleShoreCard === 'function') toggleShoreCard();
    }

    var hdr = shore.querySelector('.driver-card-header');
    if (hdr) {
      hdr.style.cursor = 'pointer';
      if (!hdr.getAttribute('title') || /Click to expand|Collapse/i.test(hdr.getAttribute('title') || '')) {
        hdr.setAttribute('title', expanded
          ? 'Collapse overflow card'
          : 'Expand to set Out times / drag loads onto drivers');
      }
      var cta = hdr.querySelector('.revamp-shore-expand-cta');
      if (!cta) {
        cta = document.createElement('button');
        cta.type = 'button';
        cta.className = 'revamp-shore-expand-cta no-print';
        cta.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof toggleShoreCard === 'function') toggleShoreCard();
        });
        hdr.appendChild(cta);
      }
      cta.setAttribute('data-expanded', expanded ? '1' : '0');
      cta.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      cta.innerHTML = expanded
        ? '<span class="revamp-shore-chev" aria-hidden="true">▲</span> Collapse'
        : '<span class="revamp-shore-chev" aria-hidden="true">▼</span> Expand · set Out times';
    }

    var footer = shore.querySelector('.driver-card-footer');
    if (footer) {
      var status = footer.querySelector('.card-dot-status');
      if (status) {
        status.textContent = expanded ? 'Drag to reassign' : 'External · expand to stamp Out';
      }
      var fcta = footer.querySelector('.revamp-shore-footer-cta');
      if (!expanded) {
        if (!fcta) {
          fcta = document.createElement('button');
          fcta.type = 'button';
          fcta.className = 'revamp-shore-footer-cta no-print';
          fcta.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof toggleShoreCard === 'function') toggleShoreCard();
          });
          footer.appendChild(fcta);
        }
        fcta.textContent = 'Expand to stamp Out times';
      } else if (fcta) {
        fcta.remove();
      }
    }

    // Collapsed DEST × N summary rows look interactive but had no expand handler —
    // only header / Expand CTA called toggleShoreCard(). Wire click + keyboard.
    // When expanded, leave individual load rows alone (Out/Lock + drag-to-reassign).
    var runs = shore.querySelectorAll('.driver-card-runs .run-row');
    Array.prototype.forEach.call(runs, function (row) {
      if (expanded) {
        row.classList.remove('revamp-shore-summary');
        row.removeAttribute('data-revamp-shore-summary');
        if (row.getAttribute('role') === 'button' && !row.getAttribute('draggable')) {
          row.removeAttribute('role');
          row.removeAttribute('tabindex');
        }
        return;
      }
      // Summary rows: no Out/Lock, not draggable, no openReassignModal
      var isLoad = row.getAttribute('draggable') === 'true' ||
        !!row.querySelector('.out-btn') ||
        /openReassignModal|openOutModal|toggleLock/.test(row.getAttribute('onclick') || '');
      if (isLoad) return;
      row.classList.add('revamp-shore-summary');
      row.setAttribute('data-revamp-shore-summary', '1');
      row.style.cursor = 'pointer';
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.setAttribute('title', 'Expand to set Out times / drag loads onto drivers');
      if (row.getAttribute('data-revamp-shore-bound') === '1') return;
      row.setAttribute('data-revamp-shore-bound', '1');
      row.addEventListener('click', activateShoreExpand);
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') activateShoreExpand(e);
      });
    });
  }

  function polishRunReorderChrome() {
    var grid = document.getElementById('driver-cards-grid');
    if (!grid) return;
    Array.prototype.forEach.call(grid.querySelectorAll('.run-row'), function (row) {
      var tip = row.getAttribute('title') || '';
      var hasReorder = !!row.querySelector('.run-reorder, .run-move');
      if (hasReorder || /reorder|reassign|▲|▼/i.test(tip)) {
        row.setAttribute('title', 'Reorder runs · Click row to reassign');
      }
      Array.prototype.forEach.call(row.querySelectorAll('.run-move'), function (btn) {
        var t = (btn.getAttribute('title') || '') + ' ' + (btn.textContent || '');
        var later = /later|\+|▼|down/i.test(t) || /moveRun\([^,]+,\s*1\)/.test(btn.getAttribute('onclick') || '') ||
          /moveAdhoc\([^,]+,\s*1\)/.test(btn.getAttribute('onclick') || '');
        var earlier = /earlier|-|▲|up/i.test(t) || /moveRun\([^,]+,\s*-1\)/.test(btn.getAttribute('onclick') || '') ||
          /moveAdhoc\([^,]+,\s*-1\)/.test(btn.getAttribute('onclick') || '');
        if (later) {
          btn.setAttribute('data-dir', 'later');
          btn.setAttribute('title', 'Move later');
          btn.setAttribute('aria-label', 'Move later');
        } else if (earlier) {
          btn.setAttribute('data-dir', 'earlier');
          btn.setAttribute('title', 'Move earlier');
          btn.setAttribute('aria-label', 'Move earlier');
        }
        // Empty visible text — CSS triangles via ::before
        if ((btn.textContent || '').trim() !== '') btn.textContent = '';
      });
    });
  }

  function polishCardEmojiChrome() {
    var grid = document.getElementById('driver-cards-grid');
    if (!grid) return;
    Array.prototype.forEach.call(grid.querySelectorAll('.out-btn'), function (btn) {
      var oc = btn.getAttribute('onclick') || '';
      var raw = (btn.textContent || '').replace(/\s+/g, ' ').trim();
      var clean = stripEmojiChars(raw).trim();
      if (/toggleLock/.test(oc)) {
        var locked = btn.classList.contains('stamped');
        if (/🔒/.test(raw)) locked = true;
        else if (/🔓/.test(raw)) locked = false;
        else if (/^unlock$/i.test(clean)) locked = false;
        else if (/^lock$/i.test(clean)) locked = true;
        var label = locked ? 'Lock' : 'Unlock';
        if (btn.textContent !== label) btn.textContent = label;
      } else if (/openOutModal|openBucketOutModal|openAdhocOutModal/.test(oc) || /\bOut\b/i.test(raw)) {
        var stamped = btn.classList.contains('stamped') || /^✓/.test(raw);
        var next = 'Out'; // plain text; stamped class keeps green chrome
        if (btn.textContent !== next) btn.textContent = next;
        if (stamped) btn.classList.add('stamped');
      }
    });
    // DOT / Near Limit / Over — plain text badges only (no ⚡ ✓ ⚠️)
    Array.prototype.forEach.call(grid.querySelectorAll('.card-dot-status'), function (el) {
      if (el.getAttribute('data-revamp-status-calm') === '1') return;
      var raw = (el.textContent || '').replace(/\s+/g, ' ').trim();
      var clean = stripEmojiChars(raw).replace(/[✓✔⚡⚠︎⚠️]/g, '').replace(/\s+/g, ' ').trim();
      var next = clean;
      if (/over/i.test(clean)) next = 'Over DOT limit';
      else if (/near/i.test(clean)) next = 'Near Limit';
      else if (/dot\s*ok|sitting out|^ok$/i.test(clean)) next = /sitting/i.test(clean) ? 'Sitting out' : 'DOT OK';
      else if (/needs a driver/i.test(clean)) next = 'Needs a driver';
      else if (/external|drag to reassign/i.test(clean)) next = /drag/i.test(clean) ? 'Drag to reassign' : 'External';
      else if (/none waiting/i.test(clean)) next = 'None waiting';
      if (next && el.textContent !== next) el.textContent = next;
    });
    // drv-base locked count emoji
    Array.prototype.forEach.call(grid.querySelectorAll('.driver-card.is-shore .drv-base'), function (el) {
      var t = el.textContent || '';
      if (/🔒|📋|👆/.test(t)) el.textContent = stripEmojiChars(t).replace(/·\s*$/,'').trim();
    });
    try { polishRunReorderChrome(); } catch (eR) {}
  }

  if (!document.documentElement.__revampCardMoreDoc) {
    document.documentElement.__revampCardMoreDoc = true;
    document.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('.revamp-card-more')) return;
      closeAllCardMore();
    });
  }

  /* ── Wave 2 #8 empty states (chrome only) ── */
  function emptyImHtml(opts) {
    opts = opts || {};
    var html = '<div class="revamp-empty-im' + (opts.extraClass ? (' ' + opts.extraClass) : '') + '"' +
      (opts.id ? (' id="' + opts.id + '"') : '') + '>';
    html += '<div class="revamp-empty-im__title">' + (opts.title || '') + '</div>';
    if (opts.body) html += '<p class="revamp-empty-im__body">' + opts.body + '</p>';
    if (opts.linkLabel && opts.linkAttr) {
      html += '<div class="revamp-empty-im__cta"><button type="button" class="revamp-empty-im__link" ' +
        opts.linkAttr + '>' + opts.linkLabel + '</button></div>';
    }
    if (opts.hint) html += '<div class="revamp-empty-im__hint">' + opts.hint + '</div>';
    html += '</div>';
    return html;
  }

  function syncNoPlanEmpty() {
    var has = planExists();
    var gen = document.querySelector('#tab-dashboard .btn-generate');
    if (!gen || !gen.parentNode) return;
    var el = document.getElementById('revamp-noplan-empty');
    if (has) {
      if (el) el.hidden = true;
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'revamp-noplan-empty';
      el.className = 'revamp-noplan-empty revamp-empty-im revamp-empty-im--inline no-print';
      el.innerHTML =
        '<div class="revamp-empty-im__title">No plan yet</div>' +
        '<p class="revamp-empty-im__body">Set today\u2019s load counts, then generate assignments.</p>' +
        '<div class="revamp-empty-im__hint">Use Generate Load Assignments below when counts look right.</div>';
      gen.parentNode.insertBefore(el, gen);
    }
    el.hidden = false;
  }

  /** Packaging: keep Unassigned chrome after plan even when prod omits the card (0 loads). */
  function ensureUnassignedCalmCard() {
    var grid = document.getElementById('driver-cards-grid');
    if (!grid) return null;
    var existing = grid.querySelector('.driver-card.is-unassigned');
    var injected = grid.querySelector('.driver-card.is-unassigned[data-revamp-unassigned-empty="1"]');
    if (!planExists()) {
      if (injected) injected.remove();
      return null;
    }
    if (existing) return existing;
    var card = document.createElement('div');
    card.className = 'driver-card is-unassigned revamp-unassigned-calm';
    card.setAttribute('data-revamp-unassigned-empty', '1');
    card.innerHTML =
      '<div class="driver-card-header">' +
        '<div class="drv-initial">U</div>' +
        '<div style="flex:1;">' +
          '<div class="drv-name">UNASSIGNED</div>' +
          '<div class="drv-base">Nothing waiting to assign</div>' +
        '</div>' +
      '</div>' +
      '<div class="driver-card-runs"></div>' +
      '<div class="driver-card-footer">' +
        '<span class="card-total-hrs">0.00 hrs</span>' +
        '<span class="card-dot-status" data-revamp-status-calm="1">None waiting</span>' +
      '</div>';
    var shore = grid.querySelector('.driver-card.is-shore');
    if (shore) grid.insertBefore(card, shore);
    else grid.appendChild(card);
    return card;
  }

  function syncUnassignedEmpty() {
    var grid = document.getElementById('driver-cards-grid');
    if (!grid) return;
    // S2: always present Unassigned chrome after plan (calm empty when 0 loads)
    ensureUnassignedCalmCard();
    var unCard = grid.querySelector('.driver-card.is-unassigned');
    var el = document.getElementById('revamp-unassigned-empty');

    // Edge: unassigned card present but no run rows → calm body (not loud empty box)
    if (unCard) {
      var runs = realRuns(unCard);
      var bodyEmpty = runs.length === 0;
      var cardIm = unCard.querySelector('.revamp-empty-im--card');
      if (bodyEmpty && !cardIm) {
        var runsWrap = unCard.querySelector('.driver-card-runs');
        if (runsWrap) {
          runsWrap.insertAdjacentHTML('beforeend',
            emptyImHtml({
              extraClass: 'revamp-empty-im--card',
              title: 'No unassigned loads',
              body: 'Nothing waiting here — drag a run onto a driver when needed.'
            })
          );
        }
      } else if (!bodyEmpty && cardIm) {
        cardIm.remove();
      }
      // #8 nits: calm gray chrome when empty; drop/rename ambiguous Clear status chip
      unCard.classList.toggle('revamp-unassigned-calm', bodyEmpty);
      var status = unCard.querySelector('.card-dot-status');
      if (status) {
        if (bodyEmpty) {
          var st = (status.textContent || '').trim();
          if (/^Clear$/i.test(st) || /Needs a driver/i.test(st) || /Sitting out/i.test(st) ||
              status.getAttribute('data-revamp-status-calm') === '1') {
            status.textContent = 'None waiting';
            status.classList.remove('card-dot-ok', 'card-dot-warn', 'card-dot-over');
            status.removeAttribute('style');
            status.setAttribute('data-revamp-status-calm', '1');
          }
        }
      }
      if (el) el.hidden = true;
      return;
    }

    // No plan / no card: hide optional fixture banner unless forced for spot-check
    if (el && !el.getAttribute('data-revamp-force-show')) el.hidden = true;
  }

  /** Optional host for Unassigned empty spot-check (fixture or forced demo). */
  function ensureUnassignedEmptyHost(force) {
    var grid = document.getElementById('driver-cards-grid');
    if (!grid) return null;
    var el = document.getElementById('revamp-unassigned-empty');
    if (!el) {
      el = document.createElement('div');
      el.id = 'revamp-unassigned-empty';
      el.className = 'revamp-unassigned-empty revamp-empty-im revamp-empty-im--flush no-print';
      el.innerHTML =
        '<div class="revamp-empty-im__title">No unassigned loads</div>' +
        '<p class="revamp-empty-im__body">Every load is on a driver card or overflow. Nothing waiting to assign.</p>';
      var toolbar = document.getElementById('revamp-cards-toolbar');
      if (toolbar && toolbar.parentNode) toolbar.parentNode.insertBefore(el, toolbar.nextSibling);
      else grid.parentNode.insertBefore(el, grid);
    }
    if (force) {
      el.setAttribute('data-revamp-force-show', '1');
      el.hidden = false;
    }
    return el;
  }

  function syncDriversEmpty() {
    var fleet = document.getElementById('tab-fleet');
    var tbody = document.getElementById('fleet-tbody');
    if (!fleet || !tbody) return;
    var rows = tbody.querySelectorAll('tr');
    var empty = rows.length === 0;
    fleet.classList.toggle('revamp-fleet-empty', empty);
    var card = fleet.querySelector('.card');
    var el = document.getElementById('revamp-drivers-empty');
    if (!empty) {
      if (el) el.hidden = true;
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'revamp-drivers-empty';
      el.className = 'revamp-empty-im revamp-empty-im--drivers no-print';
      el.innerHTML =
        '<div class="revamp-empty-im__title">No drivers yet</div>' +
        '<p class="revamp-empty-im__body">Add a driver to build your roster before generating a plan.</p>' +
        '<div class="revamp-empty-im__hint">Use + Add Driver above — that\u2019s the primary action.</div>';
      if (card) card.appendChild(el);
      else fleet.appendChild(el);
    }
    el.hidden = false;
  }

  function syncHistoryEmpty() {
    var hist = document.getElementById('history-content');
    if (!hist) return;
    var empty = hist.querySelector('.empty-state');
    if (!empty) return;
    // Already IM-shaped?
    if (empty.classList.contains('revamp-empty-im') && empty.querySelector('.revamp-empty-im__title')) return;
    empty.classList.add('revamp-empty-im');
    empty.removeAttribute('style');
    empty.innerHTML =
      '<div class="revamp-empty-im__title">No days committed yet</div>' +
      '<p class="revamp-empty-im__body">Generate a plan on the Dashboard, then commit the day to start this log.</p>' +
      '<div class="revamp-empty-im__cta">' +
        '<button type="button" class="revamp-empty-im__link" data-revamp-open-dashboard>Open Dashboard</button>' +
      '</div>';
    if (!hist.__revampEmptyClick) {
      hist.__revampEmptyClick = true;
      hist.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('[data-revamp-open-dashboard]') : null;
        if (!btn) return;
        e.preventDefault();
        if (typeof switchTab === 'function') {
          var dashBtn = document.querySelector('.tab-btn[onclick*="dashboard"]');
          try { switchTab('dashboard', dashBtn ? { currentTarget: dashBtn } : null); } catch (err) {
            try { switchTab('dashboard'); } catch (e2) {}
          }
        }
      });
    }
  }

  function syncEmptyStates() {
    try { syncNoPlanEmpty(); } catch (e) {}
    try { syncUnassignedEmpty(); } catch (e) {}
    try { syncDriversEmpty(); } catch (e) {}
    try { syncHistoryEmpty(); } catch (e) {}
  }

    // ── Wave 2 #10 — Shell calm + keyboard/focus (packaging) ──
  // Mute purple 👥 on Dispatchers → header-gray text like Sign Out
  function muteDispatchersHeader() {
    try {
      var btn = document.getElementById('hdr-dispatchers-btn');
      if (!btn || btn.getAttribute('data-revamp-disp-mute') === '1') return;
      var raw = (btn.textContent || '').replace(/\s+/g, ' ').trim();
      var label = raw;
      var idx = raw.toLowerCase().indexOf('dispatchers');
      if (idx >= 0) label = raw.slice(idx);
      else label = 'Dispatchers';
      btn.textContent = label;
      btn.setAttribute('data-revamp-disp-mute', '1');
      if (!btn.getAttribute('title')) btn.setAttribute('title', 'Manage Dispatchers');
    } catch (e) {}
  }
  muteDispatchersHeader();
  setTimeout(muteDispatchersHeader, 0);
  setTimeout(muteDispatchersHeader, 800);
  setTimeout(muteDispatchersHeader, 2000);

  function purgePackagingEmojis() {
    try {
      // Commit Day (in-page; sticky already clean)
      var commit = document.getElementById('commit-day-btn');
      if (commit) {
        var ct = (commit.textContent || '').replace(/\s+/g, ' ').trim();
        if (/commit/i.test(ct)) {
          commit.textContent = /committed/i.test(ct) ? 'Committed' : 'Commit Day';
        }
      }
      // DOT compliance / print note
      var banners = document.querySelectorAll(
        '#tab-dashboard .warn-banner, #driver-cards-section .warn-banner, .print-dot-note, #tab-dashboard [class*="dot"]'
      );
      Array.prototype.forEach.call(banners, function (el) {
        var tx = el.innerHTML || '';
        if (/⚖️|⚠️|⚠|DOT COMPLIANCE/i.test(tx)) {
          el.innerHTML = tx
            .replace(/⚖️\s*/g, '')
            .replace(/⚠️\s*/g, '')
            .replace(/⚠\s*/g, '')
            .replace(/DOT COMPLIANCE:/i, 'DOT compliance:');
        }
      });
      // Explicit DOT banner text node walk
      Array.prototype.forEach.call(document.querySelectorAll('#tab-dashboard .card, #driver-cards-section'), function (root) {
        Array.prototype.forEach.call(root.querySelectorAll('*'), function (el) {
          if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
            var v = el.childNodes[0].nodeValue || '';
            if (/⚖️|⚠️|📅|📋|☀️/.test(v)) {
              el.childNodes[0].nodeValue = stripEmojiChars(v);
            }
          }
        });
      });
      // Drivers vacation tip + badges
      var fleet = document.getElementById('tab-fleet');
      if (fleet) {
        Array.prototype.forEach.call(fleet.querySelectorAll('.warn-banner, .revamp-info-banner'), function (el) {
          var html = el.innerHTML || '';
          if (/☀️|☀/.test(html)) {
            el.innerHTML = html.replace(/☀️\s*/g, '').replace(/☀\s*/g, '');
          }
        });
        Array.prototype.forEach.call(fleet.querySelectorAll('.badge-vac, .badge-avail, td'), function (el) {
          var t = el.textContent || '';
          if (/☀️|☀|🔒/.test(t) && !el.querySelector('input, button, select')) {
            var cleaned = stripEmojiChars(t).trim();
            if (cleaned && el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
              el.textContent = cleaned;
            } else if (el.classList.contains('badge-vac') || el.classList.contains('badge-avail')) {
              el.textContent = cleaned || el.textContent;
            }
          }
        });
      }
      // History empty / commit copy
      var hist = document.getElementById('tab-history');
      if (hist) {
        Array.prototype.forEach.call(hist.querySelectorAll('strong, p, div'), function (el) {
          if (el.children.length) return;
          var t = el.textContent || '';
          if (/📅|🔒/.test(t)) el.textContent = stripEmojiChars(t).trim();
        });
      }
      // History legend icons → plain text markers
      var leg = document.getElementById('revamp-hist-legend');
      if (leg) {
        leg.innerHTML =
          '<span class="revamp-leg-item revamp-leg-warn"><span class="revamp-leg-ico" aria-hidden="true">!</span> Near DOT limit</span>' +
          '<span class="revamp-leg-item revamp-leg-over"><span class="revamp-leg-ico" aria-hidden="true">!!</span> Over hours</span>';
      }
      polishAssignmentsChrome();
      polishCardEmojiChrome();
    } catch (ePurge) {}
  }
  purgePackagingEmojis();
  setTimeout(purgePackagingEmojis, 0);
  setTimeout(purgePackagingEmojis, 800);
  setTimeout(purgePackagingEmojis, 2000);


  /* Wave 2 #11 — Settings object-page hierarchy (chrome only; save/onclick untouched) */
  function classifySettingsTier(titleText) {
    var t = (titleText || '').replace(/\s+/g, ' ').trim();
    if (/^Destinations$/i.test(t)) return 'primary';
    if (/^Danger Zone$/i.test(t)) return 'danger';
    if (/^(Load Blending|Optimizer Tuning|Data)$/i.test(t)) return 'advanced';
    if (/^(Phases|Receiver Windows|Operational)/i.test(t)) return 'secondary';
    return 'secondary';
  }

  function polishShoreLabelsInSettings(modal) {
    if (!modal) return;
    var carrier = getExternalCarrierLabel();
    if (!carrier) return;
    Array.prototype.forEach.call(modal.querySelectorAll('option'), function (opt) {
      var tx = opt.textContent || '';
      if (/Shoreline|SHORE(?![A-Z])/i.test(tx) || /Internal\s*\/\s*Shore/i.test(tx)) {
        opt.textContent = tx
          .replace(/Shoreline/gi, carrier)
          .replace(/\bSHORE\b/g, carrier)
          .replace(/\bShore\b/g, carrier);
      }
    });
    Array.prototype.forEach.call(modal.querySelectorAll('.dest-settings-table td'), function (td) {
      if (td.querySelector('input, select, button, textarea')) return;
      var tx = td.textContent || '';
      if (/Shoreline/i.test(tx)) {
        td.textContent = tx.replace(/Shoreline/gi, carrier);
      }
    });
  }

  function quietSettingsChrome() {
    var modal = document.getElementById('settings-modal');
    if (!modal) return;
    modal.classList.add('revamp-settings');
    var body = modal.querySelector('.settings-body');
    if (!body) return;

    var hdr = modal.querySelector('.settings-header h2');
    if (hdr) {
      var ht = (hdr.textContent || '').replace(/\s+/g, ' ').trim();
      if (/⚙|Settings/i.test(ht) && ht !== 'Settings') hdr.textContent = 'Settings';
    }

    // Mark section titles with tiers (idempotent)
    Array.prototype.forEach.call(body.querySelectorAll('.settings-section-title'), function (el) {
      var tier = classifySettingsTier(el.textContent || '');
      el.setAttribute('data-revamp-tier', tier);
    });

    // Wrap each section (title → next divider/title/end) into tiered blocks once
    if (body.getAttribute('data-revamp-settings-wrap') !== '1') {
      body.setAttribute('data-revamp-settings-wrap', '1');
      var kids = Array.prototype.slice.call(body.childNodes);
      var i = 0;
      while (i < kids.length) {
        var node = kids[i];
        if (!node || node.nodeType !== 1 || !node.classList || !node.classList.contains('settings-section-title')) {
          i++;
          continue;
        }
        var tier = node.getAttribute('data-revamp-tier') || classifySettingsTier(node.textContent || '');
        var block = document.createElement('div');
        block.className = 'revamp-settings-block';
        block.setAttribute('data-revamp-tier', tier);
        body.insertBefore(block, node);
        // Move title + following siblings until divider or next title
        var cur = node;
        while (cur) {
          var next = cur.nextSibling;
          // stop before a divider that precedes another section, or next title
          if (cur !== node && cur.nodeType === 1) {
            if (cur.classList && cur.classList.contains('settings-section-title')) break;
            if (cur.classList && cur.classList.contains('divider')) {
              // leave divider outside block for breathing room
              break;
            }
          }
          block.appendChild(cur);
          cur = next;
          if (cur && cur.nodeType === 1 && cur.classList && cur.classList.contains('settings-section-title')) break;
          if (cur && cur.nodeType === 1 && cur.classList && cur.classList.contains('divider')) break;
        }
        // Destinations list-report wrap
        if (tier === 'primary') {
          var tbl = block.querySelector('.dest-settings-table');
          var tw = tbl && tbl.closest ? tbl.closest('.tbl-wrap') : null;
          if (tw) tw.classList.add('revamp-settings-list-report');
          else if (tbl && tbl.parentNode) {
            var wrap = document.createElement('div');
            wrap.className = 'tbl-wrap revamp-settings-list-report';
            tbl.parentNode.insertBefore(wrap, tbl);
            wrap.appendChild(tbl);
          }
        }
        // refresh kids snapshot after moves
        kids = Array.prototype.slice.call(body.childNodes);
        i = kids.indexOf(block) + 1;
        if (i <= 0) i = kids.length;
      }
    } else {
      // Ensure Destinations list-report class persists
      var destTbl = body.querySelector('.dest-settings-table');
      var destWrap = destTbl && destTbl.closest ? destTbl.closest('.tbl-wrap') : null;
      if (destWrap) destWrap.classList.add('revamp-settings-list-report');
    }

    polishShoreLabelsInSettings(modal);
  }

  function ensureSettingsQuieting() {
    quietSettingsChrome();
    try { syncDestCarrierAuditStrip(); } catch (eA) {}
    try { syncExclusivePhaseCapNote(); } catch (eEp) {}
    // Re-polish after production openSettings fills dest table
    setTimeout(quietSettingsChrome, 0);
    setTimeout(function () { try { syncDestCarrierAuditStrip(); } catch (eA2) {} }, 0);
    setTimeout(function () { try { syncExclusivePhaseCapNote(); } catch (eEp2) {} }, 0);
    setTimeout(function () { polishShoreLabelsInSettings(document.getElementById('settings-modal')); }, 60);
    setTimeout(function () { polishShoreLabelsInSettings(document.getElementById('settings-modal')); }, 200);
    setTimeout(function () { try { syncDestCarrierAuditStrip(); } catch (eA3) {} }, 200);
    setTimeout(function () { try { syncExclusivePhaseCapNote(); } catch (eEp3) {} }, 200);
  }


  // Esc closes DC switcher dropdown + Settings modal (wire to existing close)
  if (!window.__revampEscShell) {
    window.__revampEscShell = true;
    document.addEventListener('keydown', function (e) {
      if (!e || (e.key !== 'Escape' && e.keyCode !== 27)) return;
      try {
        var dd = document.getElementById('dc-switcher-dropdown');
        if (dd && dd.classList.contains('open')) {
          dd.classList.remove('open');
          var chip = document.getElementById('revamp-dc-chip');
          if (chip) {
            chip.setAttribute('aria-expanded', 'false');
            chip.classList.remove('is-open');
          }
          e.preventDefault();
          return;
        }
      } catch (e0) {}
      try {
        var modal = document.getElementById('settings-modal');
        if (modal && modal.classList.contains('open')) {
          if (typeof closeSettings === 'function') {
            // closeSettings() with no args always closes (existing API)
            closeSettings();
          } else {
            modal.classList.remove('open');
          }
          e.preventDefault();
        }
      } catch (e1) {}
    }, true);
  }

  // One-time Drivers + History chrome hooks (CSS owns look; no optimizer changes)
  function skinDriversHistoryTabs() {
    var fleet = document.getElementById('tab-fleet');
    if (fleet && !fleet.__revampFleetSkin) {
      fleet.__revampFleetSkin = true;
      var tip = fleet.querySelector('.warn-banner');
      if (tip) tip.classList.add('revamp-info-banner');
    }

    var hist = document.getElementById('tab-history');
    if (hist && !hist.__revampHistSkin) {
      hist.__revampHistSkin = true;
      var row = hist.querySelector(':scope > div > .flex-between');
      if (!row) row = hist.querySelector('.flex-between');
      var titleCol = row ? row.querySelector(':scope > div') : null;
      var clearBtn = hist.querySelector('button[onclick*="clearHistory"]');
      if (clearBtn) {
        clearBtn.classList.add('revamp-clear-log');
        // Tuck under title column so it is not a title-peer primary
        if (titleCol && clearBtn.parentNode === row) {
          var wrap = document.createElement('div');
          wrap.className = 'revamp-clear-log-wrap';
          titleCol.appendChild(wrap);
          wrap.appendChild(clearBtn);
        }
      }
      if (titleCol && !document.getElementById('revamp-hist-legend')) {
        var leg = document.createElement('div');
        leg.id = 'revamp-hist-legend';
        leg.className = 'revamp-hist-legend';
        leg.innerHTML =
          '<span class="revamp-leg-item revamp-leg-warn"><span class="revamp-leg-ico" aria-hidden="true">!</span> Near DOT limit</span>' +
          '<span class="revamp-leg-item revamp-leg-over"><span class="revamp-leg-ico" aria-hidden="true">!!</span> Over hours</span>';
        // Place legend after subtitle, before tucked Clear Log wrap
        var tuck = titleCol.querySelector('.revamp-clear-log-wrap');
        if (tuck) titleCol.insertBefore(leg, tuck);
        else titleCol.appendChild(leg);
      }
    }
  }
  skinDriversHistoryTabs();
  setTimeout(skinDriversHistoryTabs, 0);
  densifyCardHeaders();
  setTimeout(densifyCardHeaders, 0);
  setTimeout(densifyCardHeaders, 800);
  setTimeout(densifyCardHeaders, 2000);
  syncEmptyStates();
  setTimeout(syncEmptyStates, 0);
  setTimeout(syncEmptyStates, 800);
  setTimeout(syncEmptyStates, 2000);


  // Settings quieting when gear opens modal (role gating untouched)
  (function bindSettingsGear() {
    function bind() {
      var gear = document.querySelector('.hdr-settings-btn, #hdr-settings-btn, button[onclick*="openSettings"]');
      if (!gear || gear.getAttribute('data-revamp-settings-bind') === '1') return;
      gear.setAttribute('data-revamp-settings-bind', '1');
      gear.addEventListener('click', function () {
        setTimeout(function () { try { ensureSettingsQuieting(); } catch (e) {} }, 0);
        setTimeout(function () { try { ensureSettingsQuieting(); } catch (e) {} }, 80);
      }, true);
    }
    bind();
    setTimeout(bind, 500);
  })();

  // TP#3: click on aria-disabled Generate surfaces ready-gate banner
  if (!window.__revampReadyGateClick) {
    window.__revampReadyGateClick = true;
    document.addEventListener('click', function (e) {
      try {
        if (!document.body.classList.contains('revamp-dc-not-ready')) return;
        var t = e.target && e.target.closest
          ? e.target.closest('.btn-generate, #revamp-rerun-btn, #revamp-fresh-btn')
          : null;
        if (!t) return;
        if (t.getAttribute('aria-disabled') !== 'true') return;
        e.preventDefault();
        e.stopPropagation();
        showReadyGateAttention();
      } catch (err) {}
    }, true);
  }

  // Re-sync ready-gate after fleet / dest toggles
  wrap('toggleDestEnabled', function () { try { syncDcReadyGate(); syncEmptyStates(); } catch (e) {} });
  wrap('saveDrivers', function () { try { syncDcReadyGate(); } catch (e) {} try { syncHomeFirstGapNote(); } catch (eHf) {} });

  syncDcReadyGate();
  setTimeout(syncDcReadyGate, 0);
  setTimeout(syncDcReadyGate, 800);
  setTimeout(syncDcReadyGate, 2000);
  setTimeout(syncDcReadyGate, 4000);


  /* ═══ Wave 3 / TP#2 — homeFirst visibility + dest/carrier audit (preview only) ═══
     Packaging chrome only — no DB columns / migrations. Documents sync gap; surfaces
     quiet notes when local homeFirst would be dropped on cloud pull. */
  function listHomeFirstDrivers() {
    var out = [];
    try {
      var st = getState();
      if (!st || !Array.isArray(st.drivers)) return out;
      for (var i = 0; i < st.drivers.length; i++) {
        var d = st.drivers[i];
        if (d && d.homeFirst) out.push(d);
      }
    } catch (e) {}
    return out;
  }

  function syncHomeFirstGapNote() {
    try {
      var fleet = document.getElementById('tab-fleet');
      if (!fleet) return;
      var list = listHomeFirstDrivers();
      var el = document.getElementById('revamp-homefirst-gap');
      if (!list.length) {
        if (el) el.hidden = true;
        return;
      }
      if (!el) {
        el = document.createElement('div');
        el.id = 'revamp-homefirst-gap';
        el.className = 'revamp-quiet-note revamp-homefirst-gap no-print';
        el.setAttribute('role', 'status');
        el.innerHTML =
          '<span class="revamp-quiet-note__mark" aria-hidden="true">i</span>' +
          '<div class="revamp-quiet-note__body">' +
            '<div class="revamp-quiet-note__title"></div>' +
            '<p class="revamp-quiet-note__text"></p>' +
          '</div>';
        var ban = fleet.querySelector('.warn-banner, .revamp-info-banner');
        if (ban && ban.parentNode) ban.parentNode.insertBefore(el, ban.nextSibling);
        else {
          var card = fleet.querySelector('.card');
          if (card && card.parentNode) card.parentNode.insertBefore(el, card);
          else fleet.appendChild(el);
        }
      }
      var n = list.length;
      var names = list.slice(0, 3).map(function (d) { return d.name || d.id || '?'; });
      var nameBit = names.join(', ') + (n > 3 ? (' +' + (n - 3) + ' more') : '');
      var titleEl = el.querySelector('.revamp-quiet-note__title');
      var textEl = el.querySelector('.revamp-quiet-note__text');
      if (titleEl) {
        titleEl.textContent = n === 1
          ? 'Home-first set locally (1 driver)'
          : ('Home-first set locally (' + n + ' drivers)');
      }
      if (textEl) {
        textEl.textContent = nameBit +
          ' — preference is local-only today. A cloud roster pull replaces drivers without homeFirst, so this flag can be dropped. See HOMEFIRST_SYNC_GAP.';
      }
      el.hidden = false;
    } catch (e) {
      console.warn('[revamp] syncHomeFirstGapNote', e);
    }
  }

  function syncHomeFirstModalNote() {
    try {
      var group = document.getElementById('drv-homefirst-group');
      if (!group) return;
      var note = group.querySelector('.revamp-homefirst-modal-note');
      var visible = group.style.display !== 'none';
      if (!visible) {
        if (note) note.hidden = true;
        return;
      }
      if (!note) {
        note = document.createElement('div');
        note.className = 'revamp-homefirst-modal-note no-print';
        note.textContent =
          'Local only — homeFirst is not stored in Supabase. A roster pull can clear this.';
        group.appendChild(note);
      }
      note.hidden = false;
    } catch (e) {}
  }

  function readDestAuditMeta() {
    // Honest scan only — do not invent attribution.
    var best = null;
    function consider(ts, who, source) {
      if (ts == null || ts === '' || ts === 0) return;
      var ms = typeof ts === 'number' ? ts : Date.parse(ts);
      if (!isFinite(ms)) return;
      if (!best || ms > best.ms) {
        best = { ms: ms, who: who || '', source: source || '' };
      }
    }
    try {
      var st = getState();
      if (st && Array.isArray(st.destinations)) {
        for (var i = 0; i < st.destinations.length; i++) {
          var d = st.destinations[i];
          if (!d || typeof d !== 'object') continue;
          var who = d.updatedBy || d.editedBy || d.changedBy || d.lastChangedBy ||
            d.modifiedBy || d.auditUser || d.user || '';
          consider(d.updatedAt || d.lastChanged || d.modifiedAt || d.editedAt ||
            d.changedAt || d.updated_at || d.last_changed, who, 'destination');
        }
      }
      if (st && st.destAudit && typeof st.destAudit === 'object') {
        consider(st.destAudit.at || st.destAudit.updatedAt || st.destAudit.ts,
          st.destAudit.by || st.destAudit.user || '', 'destAudit');
      }
      if (st && st.destMeta && typeof st.destMeta === 'object') {
        consider(st.destMeta.updatedAt || st.destMeta.lastChanged || st.destMeta.ts,
          st.destMeta.by || st.destMeta.user || '', 'destMeta');
      }
    } catch (e0) {}
    try {
      if (typeof DC_CONFIG !== 'undefined' && DC_CONFIG) {
        consider(DC_CONFIG.configUpdatedAt || DC_CONFIG.config_updated_at ||
          DC_CONFIG.updatedAt, DC_CONFIG.updatedBy || '', 'dc_config');
        var P = DC_CONFIG.storagePrefix || '';
        if (P) {
          var syncRaw = localStorage.getItem(P + '_cfgsync');
          if (syncRaw) consider(parseInt(syncRaw, 10) || syncRaw, '', 'cfgsync');
        }
      }
    } catch (e1) {}
    return best;
  }

  function formatAuditWhen(ms) {
    try {
      var d = new Date(ms);
      if (!isFinite(d.getTime())) return '';
      return d.toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit'
      });
    } catch (e) { return ''; }
  }

  function syncDestCarrierAuditStrip() {
    try {
      var modal = document.getElementById('settings-modal');
      if (!modal) return;
      var body = modal.querySelector('.settings-body');
      if (!body) return;
      var block = body.querySelector('.revamp-settings-block[data-revamp-tier="primary"]') || body;
      var title = null;
      Array.prototype.forEach.call(block.querySelectorAll('.settings-section-title'), function (el) {
        if (!title && /^Destinations$/i.test((el.textContent || '').trim())) title = el;
      });
      if (!title) {
        Array.prototype.forEach.call(body.querySelectorAll('.settings-section-title'), function (el) {
          if (!title && /^Destinations$/i.test((el.textContent || '').trim())) title = el;
        });
      }
      if (!title) return;

      var strip = document.getElementById('revamp-dest-audit');
      if (!strip) {
        strip = document.createElement('div');
        strip.id = 'revamp-dest-audit';
        strip.className = 'revamp-quiet-note revamp-dest-audit no-print';
        strip.setAttribute('role', 'status');
        strip.innerHTML =
          '<span class="revamp-quiet-note__mark" aria-hidden="true">i</span>' +
          '<div class="revamp-quiet-note__body">' +
            '<div class="revamp-quiet-note__title"></div>' +
            '<p class="revamp-quiet-note__text"></p>' +
          '</div>';
        // Place after Destinations blurb (first <p> after title) or directly after title
        var anchor = title.nextElementSibling;
        if (anchor && anchor.tagName === 'P') {
          anchor.parentNode.insertBefore(strip, anchor.nextSibling);
        } else {
          title.parentNode.insertBefore(strip, title.nextSibling);
        }
      }

      var meta = readDestAuditMeta();
      var titleEl = strip.querySelector('.revamp-quiet-note__title');
      var textEl = strip.querySelector('.revamp-quiet-note__text');
      if (meta && meta.ms) {
        strip.classList.remove('revamp-quiet-note--placeholder');
        var when = formatAuditWhen(meta.ms);
        if (titleEl) titleEl.textContent = 'Last changed';
        var bits = [];
        if (when) bits.push(when);
        if (meta.who) bits.push('by ' + meta.who);
        if (meta.source === 'cfgsync') bits.push('(config sync timestamp — not edit attribution)');
        else if (meta.source === 'dc_config') bits.push('(DC config)');
        if (textEl) textEl.textContent = bits.join(' · ') || when;
      } else {
        strip.classList.add('revamp-quiet-note--placeholder');
        if (titleEl) titleEl.textContent = 'Audit log coming';
        if (textEl) textEl.textContent = 'edits are not yet attributed';
      }
      strip.hidden = false;
    } catch (e) {
      console.warn('[revamp] syncDestCarrierAuditStrip', e);
    }
  }

  wrap('openEditDriver', function () { try { syncHomeFirstModalNote(); } catch (e) {} });
  wrap('openAddDriver', function () { try { syncHomeFirstModalNote(); } catch (e) {} });
  wrap('updateHomefirstVisibility', function () { try { syncHomeFirstModalNote(); } catch (e) {} });
  wrap('saveDriver', function () { try { syncHomeFirstGapNote(); syncHomeFirstModalNote(); } catch (e) {} });
  wrap('renderDestinations', function () { try { syncDestCarrierAuditStrip(); } catch (e) {} });
  wrap('saveDestinations', function () { try { syncDestCarrierAuditStrip(); } catch (e) {} });

  syncHomeFirstGapNote();
  setTimeout(syncHomeFirstGapNote, 0);
  setTimeout(syncHomeFirstGapNote, 800);
  setTimeout(syncHomeFirstGapNote, 2000);


  /* ═══ Wave 3 / TP#5 — Commit audit package chrome (preview only) ═══
     Local-only compliance snapshot at Commit time. DC-prefixed localStorage
     key `revamp-commit-audit`. No DB / Commit RPC changes. Honest placeholders
     when email or plan-quality chips are absent — never invent user names. */

  function getRevampStoragePrefix() {
    try {
      if (typeof DC_CONFIG !== 'undefined' && DC_CONFIG && DC_CONFIG.storagePrefix) {
        return String(DC_CONFIG.storagePrefix);
      }
    } catch (e) {}
    return 'ccu_';
  }

  function getSessionEmailHonest() {
    // Prefer visible header email, then known session globals — never invent.
    try {
      var el = document.getElementById('hdr-user-email');
      if (el) {
        var t = (el.textContent || el.value || '').trim();
        if (t && t.indexOf('@') >= 0) return t;
      }
    } catch (e0) {}
    try {
      if (typeof _user !== 'undefined' && _user && _user.email) return String(_user.email);
    } catch (e1) {}
    try {
      if (window._user && window._user.email) return String(window._user.email);
    } catch (e2) {}
    try {
      if (typeof SupabaseSync !== 'undefined' && SupabaseSync && typeof SupabaseSync.currentUser === 'function') {
        var u = SupabaseSync.currentUser();
        if (u && u.email) return String(u.email);
      }
    } catch (e3) {}
    return '';
  }

  function auditLsGet(key) {
    try { return localStorage.getItem(getRevampStoragePrefix() + key); } catch (e) { return null; }
  }
  function auditLsSet(key, val) {
    try { localStorage.setItem(getRevampStoragePrefix() + key, val); } catch (e) {}
  }

  function readRevampCommitAuditLog() {
    var raw = auditLsGet('revamp-commit-audit');
    if (!raw) return [];
    try {
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function writeRevampCommitAuditLog(arr) {
    try {
      // Cap like history — last 60
      var slim = (arr || []).slice(-60);
      auditLsSet('revamp-commit-audit', JSON.stringify(slim));
    } catch (e) {}
  }

  function stampRevampLastGenerate() {
    var email = getSessionEmailHonest();
    auditLsSet('revamp-last-generate', JSON.stringify({
      at: new Date().toISOString(),
      by: email || ''
    }));
  }

  function stampRevampLastCountsEdit() {
    var email = getSessionEmailHonest();
    auditLsSet('revamp-last-counts-edit', JSON.stringify({
      at: new Date().toISOString(),
      by: email || ''
    }));
  }

  function readStamp(key) {
    var raw = auditLsGet(key);
    if (!raw) return null;
    try {
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return null;
      return { at: o.at || '', by: o.by || '' };
    } catch (e) { return null; }
  }

  function shortReasonFromPqText(text) {
    var t = (text || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    // Keep chip short — first clause / 72 chars
    var cut = t.split(/[—–]/)[0].trim();
    if (cut.length > 72) cut = cut.slice(0, 69) + '…';
    return cut;
  }

  function collectPlanQualityReasonChips() {
    var chips = [];
    var seen = {};
    function push(kind, text) {
      var k = (kind || 'INFO').toUpperCase();
      var short = shortReasonFromPqText(text);
      if (!short) return;
      var key = k + '|' + short;
      if (seen[key]) return;
      seen[key] = 1;
      chips.push({ kind: k, text: short });
    }
    try {
      var pq = document.getElementById('plan-quality-content');
      if (pq) {
        var rows = pq.querySelectorAll('.pq-row, [data-revamp-pq]');
        Array.prototype.forEach.call(rows, function (row) {
          var txt = (row.textContent || '').trim();
          if (!txt) return;
          // Prefer existing typed chip label if present
          var tagEl = row.querySelector('.pq-tag, .revamp-pq-tag');
          var kind = '';
          if (tagEl) kind = (tagEl.textContent || '').trim().toUpperCase();
          if (!kind && typeof classifyPqKind === 'function') {
            try { kind = classifyPqKind(txt) || ''; } catch (eK) {}
          }
          if (!kind) {
            // Fallback: mirror packaging classifier regex lightly
            if (/overflow|shoreline|→\s*.+/i.test(txt)) kind = 'SHORE';
            else if (/unassigned|could not be covered|internal-only load/i.test(txt)) kind = 'GAP';
            else if (/unused|no loads/i.test(txt)) kind = 'INFO';
            else kind = 'INFO';
          }
          // Only surface overflow / unassigned / gap style reasons for audit strip
          if (/SHORE|OVERFLOW|GAP|UNASSIGN|COWAN|SHORELINE/i.test(kind) ||
              /overflow|unassigned|could not be covered|shoreline|external/i.test(txt)) {
            push(kind === 'OVERFLOW' ? 'SHORE' : kind, txt);
          }
        });
      }
    } catch (e0) {}
    // Counts from lastResult when DOM empty
    try {
      var st = getState();
      var lr = st && st.lastResult;
      if (lr && Array.isArray(lr.assignments)) {
        var un = 0, shore = 0;
        var carrier = '';
        try {
          if (typeof DC_CONFIG !== 'undefined' && DC_CONFIG) carrier = DC_CONFIG.externalCarrier || '';
        } catch (eC) {}
        for (var i = 0; i < lr.assignments.length; i++) {
          var a = lr.assignments[i];
          if (!a) continue;
          var who = a.override || a.autoDriver || '';
          if (who === 'UNASSIGNED') un++;
          else if (carrier && who === carrier) shore++;
        }
        if (shore && !chips.some(function (c) { return /SHORE|OVERFLOW|COWAN/i.test(c.kind); })) {
          push('SHORE', shore + ' overflow/external load(s)');
        }
        if (un && !chips.some(function (c) { return /GAP|UNASSIGN/i.test(c.kind); })) {
          push('GAP', un + ' unassigned load(s)');
        }
      }
    } catch (e1) {}
    return chips.slice(0, 6);
  }

  function countOverflowUnassigned() {
    var out = { overflow: 0, unassigned: 0 };
    try {
      var st = getState();
      var lr = st && st.lastResult;
      if (!lr || !Array.isArray(lr.assignments)) return out;
      var carrier = '';
      try {
        if (typeof DC_CONFIG !== 'undefined' && DC_CONFIG) carrier = DC_CONFIG.externalCarrier || '';
      } catch (eC) {}
      for (var i = 0; i < lr.assignments.length; i++) {
        var a = lr.assignments[i];
        if (!a) continue;
        var who = a.override || a.autoDriver || '';
        if (who === 'UNASSIGNED') out.unassigned++;
        else if (carrier && who === carrier) out.overflow++;
      }
    } catch (e) {}
    return out;
  }

  function findDeadExclusivePhaseCapRules() {
    var dead = [];
    try {
      var rules = (typeof DC_CONFIG !== 'undefined' && DC_CONFIG && DC_CONFIG.optimizer &&
        Array.isArray(DC_CONFIG.optimizer.specialRules)) ? DC_CONFIG.optimizer.specialRules : [];
      var phases = [];
      try {
        var st = getState();
        if (st && Array.isArray(st.phases)) phases = st.phases;
        else if (DC_CONFIG && Array.isArray(DC_CONFIG.phases)) phases = DC_CONFIG.phases;
      } catch (eP) {}
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        if (!r || r.type !== 'exclusivePhaseCap') continue;
        var needle = r.phaseLabelIncludes || '';
        var matched = false;
        if (needle) {
          for (var j = 0; j < phases.length; j++) {
            var ph = phases[j];
            if (!ph) continue;
            if (r.destCode && ph.dest !== r.destCode) continue;
            if (String(ph.label || '').indexOf(needle) >= 0) { matched = true; break; }
          }
        } else {
          // No label filter — treat as live if dest exists in phases
          matched = phases.some(function (ph) { return ph && ph.dest === r.destCode; });
        }
        if (!matched) {
          dead.push({
            destCode: r.destCode || '',
            phaseLabelIncludes: needle,
            maxLoadsPerDriver: r.maxLoadsPerDriver
          });
        }
      }
    } catch (e) {}
    return dead;
  }

  function resolveCommitDateKey(dateOverride) {
    if (dateOverride) return String(dateOverride);
    try {
      if (typeof todayLocal === 'function') return todayLocal();
    } catch (e) {}
    try {
      var d = new Date();
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    } catch (e2) { return ''; }
  }

  function buildRevampCommitAuditRecord(dateOverride) {
    var date = resolveCommitDateKey(dateOverride);
    var email = getSessionEmailHonest();
    var gen = readStamp('revamp-last-generate');
    var counts = readStamp('revamp-last-counts-edit');
    var counts2 = countOverflowUnassigned();
    var chips = collectPlanQualityReasonChips();
    var dead = findDeadExclusivePhaseCapRules();
    var dayLabel = '';
    try {
      var st = getState();
      if (st && Array.isArray(st.history)) {
        for (var i = st.history.length - 1; i >= 0; i--) {
          if (st.history[i] && st.history[i].date === date) {
            dayLabel = st.history[i].dayLabel || '';
            break;
          }
        }
      }
    } catch (eH) {}
    return {
      date: date,
      dayLabel: dayLabel,
      committedAt: new Date().toISOString(),
      committedBy: email || '',
      generatedBy: (gen && gen.by) || '',
      generatedAt: (gen && gen.at) || '',
      countsEditedBy: (counts && counts.by) || '',
      countsEditedAt: (counts && counts.at) || '',
      overflowCount: counts2.overflow,
      unassignedCount: counts2.unassigned,
      reasonChips: chips,
      exclusivePhaseCapDead: dead,
      preview: true,
      localOnly: true
    };
  }

  function appendRevampCommitAudit(dateOverride) {
    var rec = buildRevampCommitAuditRecord(dateOverride);
    if (!rec.date) return null;
    var log = readRevampCommitAuditLog();
    // Replace same-date entry (mirrors history commit replace)
    var idx = -1;
    for (var i = 0; i < log.length; i++) {
      if (log[i] && log[i].date === rec.date) { idx = i; break; }
    }
    if (idx >= 0) log[idx] = rec;
    else log.push(rec);
    writeRevampCommitAuditLog(log);
    return rec;
  }

  function formatAuditWho(email) {
    if (email) return email;
    return 'not attributed';
  }

  function formatAuditWhenIso(iso) {
    if (!iso) return '';
    try {
      var ms = Date.parse(iso);
      if (!isFinite(ms)) return '';
      return formatAuditWhen(ms);
    } catch (e) { return ''; }
  }

  function syncCommitAuditPreviewChrome() {
    try {
      var has = planExists();
      var commitBtn = document.getElementById('revamp-commit-btn');
      if (commitBtn) {
        var baseTitle = commitBtn.getAttribute('data-revamp-base-title') || '';
        if (!commitBtn.getAttribute('data-revamp-base-title')) {
          commitBtn.setAttribute('data-revamp-base-title', commitBtn.getAttribute('title') || '');
          baseTitle = commitBtn.getAttribute('data-revamp-base-title') || '';
        }
        var tip = 'Audit preview (local only)';
        commitBtn.setAttribute('title', baseTitle ? (baseTitle + ' · ' + tip) : tip);
        commitBtn.setAttribute('data-revamp-audit-tip', tip);
      }
      var sticky = document.getElementById('revamp-sticky-bar');
      if (!sticky) return;
      var left = sticky.querySelector('.left');
      if (!left) return;
      var chip = document.getElementById('revamp-audit-preview-chip');
      if (!chip) {
        chip = document.createElement('span');
        chip.id = 'revamp-audit-preview-chip';
        chip.className = 'revamp-audit-preview-chip no-print';
        chip.setAttribute('title', 'On Commit, a local audit snapshot is stored in this browser (DC-prefixed localStorage). Not a compliance export / not synced.');
        chip.textContent = 'Audit preview (local only)';
        var status = document.getElementById('revamp-sticky-status');
        if (status && status.parentNode === left) {
          status.insertAdjacentElement('afterend', chip);
        } else {
          left.appendChild(chip);
        }
      }
      chip.hidden = !has;
    } catch (e) {
      console.warn('[revamp] syncCommitAuditPreviewChrome', e);
    }
  }

  function findHistEntryDate(entryEl) {
    if (!entryEl) return '';
    try {
      if (entryEl.getAttribute('data-date')) return entryEl.getAttribute('data-date');
      var bar = entryEl.querySelector('.hist-date-bar');
      if (!bar) return '';
      // Production puts date in a muted span inside the right cluster
      var spans = bar.querySelectorAll('span');
      for (var i = 0; i < spans.length; i++) {
        var t = (spans[i].textContent || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
      }
    } catch (e) {}
    return '';
  }

  function renderAuditStripHtml(rec) {
    if (!rec) {
      return (
        '<div class="revamp-commit-audit revamp-commit-audit--placeholder revamp-quiet-note no-print" role="status">' +
          '<span class="revamp-quiet-note__mark" aria-hidden="true">i</span>' +
          '<div class="revamp-quiet-note__body">' +
            '<div class="revamp-quiet-note__title">Audit preview' +
              '<span class="revamp-audit-local-badge">local only</span></div>' +
            '<p class="revamp-quiet-note__text">No local audit snapshot for this day yet. Commit again from this browser to capture who / when / overflow chips.</p>' +
          '</div>' +
        '</div>'
      );
    }
    var when = formatAuditWhenIso(rec.committedAt) || rec.committedAt || '';
    var committedBy = formatAuditWho(rec.committedBy);
    var generatedBy = formatAuditWho(rec.generatedBy);
    var countsBy = formatAuditWho(rec.countsEditedBy);
    var genWhen = formatAuditWhenIso(rec.generatedAt);
    var countsWhen = formatAuditWhenIso(rec.countsEditedAt);
    var metaBits = [];
    metaBits.push('<span><strong>Committed</strong> ' + (when || '—') +
      ' · <span class="revamp-commit-audit__who">' + committedBy + '</span></span>');
    metaBits.push('<span><strong>Generated</strong> ' +
      (genWhen || (rec.generatedBy ? '—' : 'not recorded')) +
      ' · <span class="revamp-commit-audit__who">' + generatedBy + '</span></span>');
    metaBits.push('<span><strong>Counts edited</strong> ' +
      (countsWhen || (rec.countsEditedBy ? '—' : 'not recorded')) +
      ' · <span class="revamp-commit-audit__who">' + countsBy + '</span></span>');
    var countBits = [];
    if (typeof rec.overflowCount === 'number') {
      countBits.push('<span class="revamp-audit-chip revamp-audit-chip--shore"><span class="revamp-audit-chip__tag">Overflow</span> ' +
        rec.overflowCount + '</span>');
    }
    if (typeof rec.unassignedCount === 'number') {
      countBits.push('<span class="revamp-audit-chip revamp-audit-chip--gap"><span class="revamp-audit-chip__tag">Unassigned</span> ' +
        rec.unassignedCount + '</span>');
    }
    var reasonHtml = '';
    if (rec.reasonChips && rec.reasonChips.length) {
      reasonHtml = rec.reasonChips.map(function (c) {
        var kind = (c.kind || 'INFO').toUpperCase();
        var cls = /SHORE|OVERFLOW|COWAN/i.test(kind) ? 'shore' :
          /GAP|UNASSIGN/i.test(kind) ? 'gap' : 'info';
        var label = kind;
        try {
          if (typeof pqChipLabel === 'function' && (kind === 'SHORE' || kind === 'OVERFLOW')) {
            label = pqChipLabel(kind);
          }
        } catch (eL) {}
        return '<span class="revamp-audit-chip revamp-audit-chip--' + cls + '">' +
          '<span class="revamp-audit-chip__tag">' + label + '</span> ' +
          String(c.text || '').replace(/</g, '&lt;') + '</span>';
      }).join('');
    }
    return (
      '<div class="revamp-commit-audit revamp-quiet-note no-print" role="status" data-revamp-audit-date="' +
        String(rec.date || '').replace(/"/g, '') + '">' +
        '<span class="revamp-quiet-note__mark" aria-hidden="true">i</span>' +
        '<div class="revamp-quiet-note__body">' +
          '<div class="revamp-quiet-note__title">Audit snapshot' +
            '<span class="revamp-audit-local-badge">local only</span></div>' +
          '<div class="revamp-commit-audit__meta">' + metaBits.join('') + '</div>' +
          (countBits.length || reasonHtml
            ? ('<div class="revamp-commit-audit__chips">' + countBits.join('') + reasonHtml + '</div>')
            : '<p class="revamp-quiet-note__text">No overflow / Unassigned reason chips on plan-quality at Commit.</p>') +
        '</div>' +
      '</div>'
    );
  }

  function syncHistoryAuditChrome() {
    try {
      var hist = document.getElementById('history-content');
      if (!hist) return;
      var log = readRevampCommitAuditLog();
      var byDate = {};
      for (var i = 0; i < log.length; i++) {
        if (log[i] && log[i].date) byDate[log[i].date] = log[i];
      }
      var entries = hist.querySelectorAll('.hist-entry');
      if (!entries.length) return;
      Array.prototype.forEach.call(entries, function (entry) {
        var date = findHistEntryDate(entry);
        if (date) entry.setAttribute('data-date', date);
        var existing = entry.querySelector('.revamp-commit-audit');
        if (existing) existing.parentNode.removeChild(existing);
        var rec = date ? byDate[date] : null;
        // Show strip for every card: real snapshot or honest placeholder
        var wrap = document.createElement('div');
        wrap.innerHTML = renderAuditStripHtml(rec || null);
        var strip = wrap.firstChild;
        // Insert after metrics row (or after date bar)
        var metrics = entry.querySelector('.hist-metrics-row');
        if (metrics && metrics.parentNode) {
          metrics.parentNode.insertBefore(strip, metrics.nextSibling);
        } else {
          var bar = entry.querySelector('.hist-date-bar');
          if (bar && bar.parentNode) bar.parentNode.insertBefore(strip, bar.nextSibling);
          else entry.insertBefore(strip, entry.firstChild);
        }
      });
    } catch (e) {
      console.warn('[revamp] syncHistoryAuditChrome', e);
    }
  }

  function syncExclusivePhaseCapNote() {
    try {
      var modal = document.getElementById('settings-modal');
      if (!modal) return;
      var body = modal.querySelector('.settings-body');
      if (!body) return;
      var dead = findDeadExclusivePhaseCapRules();
      // Also surface if rule exists at all (even if somehow matched) as code-only policy
      var anyCap = [];
      try {
        var rules = (DC_CONFIG && DC_CONFIG.optimizer && DC_CONFIG.optimizer.specialRules) || [];
        anyCap = rules.filter(function (r) { return r && r.type === 'exclusivePhaseCap'; });
      } catch (eR) {}
      if (!anyCap.length) {
        var gone = document.getElementById('revamp-exclusive-phase-cap-note');
        if (gone) gone.hidden = true;
        return;
      }
      var title = null;
      Array.prototype.forEach.call(body.querySelectorAll('.settings-section-title'), function (el) {
        var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!title && /^(Optimizer Tuning|Load Blending|Operational)/i.test(t)) title = el;
      });
      if (!title) {
        // Fallback: first advanced tier block title
        title = body.querySelector('.revamp-settings-block[data-revamp-tier="advanced"] .settings-section-title') ||
          body.querySelector('.settings-section-title');
      }
      if (!title) return;
      var note = document.getElementById('revamp-exclusive-phase-cap-note');
      if (!note) {
        note = document.createElement('div');
        note.id = 'revamp-exclusive-phase-cap-note';
        note.className = 'revamp-quiet-note revamp-exclusive-phase-cap-note no-print';
        note.setAttribute('role', 'status');
        note.innerHTML =
          '<span class="revamp-quiet-note__mark" aria-hidden="true">i</span>' +
          '<div class="revamp-quiet-note__body">' +
            '<div class="revamp-quiet-note__title"></div>' +
            '<p class="revamp-quiet-note__text"></p>' +
          '</div>';
        var anchor = title.nextElementSibling;
        if (anchor && anchor.tagName === 'P') {
          anchor.parentNode.insertBefore(note, anchor.nextSibling);
        } else {
          title.parentNode.insertBefore(note, title.nextSibling);
        }
      }
      var titleEl = note.querySelector('.revamp-quiet-note__title');
      var textEl = note.querySelector('.revamp-quiet-note__text');
      var r0 = dead[0] || anyCap[0];
      var label = (r0 && r0.phaseLabelIncludes) || 'Small Store';
      var dest = (r0 && r0.destCode) || 'COL';
      if (titleEl) titleEl.textContent = 'exclusivePhaseCap in code';
      if (textEl) {
        if (dead.length) {
          textEl.innerHTML =
            'Rule <code>' + dest + '</code> · phase label includes <code>' + label +
            '</code> does not match current phase labels — dead policy. ' +
            '<strong>policy in code — not editable in UI</strong>.';
        } else {
          textEl.innerHTML =
            'Rule <code>' + dest + '</code> · <code>' + label +
            '</code> is applied by the optimizer. <strong>policy in code — not editable in UI</strong>.';
        }
      }
      note.hidden = false;
    } catch (e) {
      console.warn('[revamp] syncExclusivePhaseCapNote', e);
    }
  }

  // Stamp counts-edit when loads are saved (Edit counts / phase inputs)
  (function wrapCountsEditStamp() {
    var names = ['saveLoads', 'updateLoadCount', 'updatePhaseLoad'];
    for (var i = 0; i < names.length; i++) {
      (function (name) {
        var orig = window[name];
        if (typeof orig !== 'function' || orig.__revampCountsAudit) return;
        var wrapped = function () {
          var ret = orig.apply(this, arguments);
          try { stampRevampLastCountsEdit(); } catch (e) {}
          return ret;
        };
        wrapped.__revampWrapped = true;
        wrapped.__revampCountsAudit = true;
        wrapped.__revampOrig = orig.__revampOrig || orig;
        window[name] = wrapped;
      })(names[i]);
    }
  })();

  // Also stamp when markResultStale fires after count edits (packaging path)
  (function wrapStaleCountsHint() {
    var orig = window.markResultStale;
    if (typeof orig !== 'function' || orig.__revampCountsAuditStale) return;
    // markResultStale may already be wrapped — chain honestly
    var wrapped = function () {
      var ret = orig.apply(this, arguments);
      try {
        // Only stamp if Edit counts / input editing is active (avoid generate noise)
        if (document.body.classList.contains('revamp-input-editing') || inputForcedExpand) {
          stampRevampLastCountsEdit();
        }
      } catch (e) {}
      return ret;
    };
    wrapped.__revampWrapped = true;
    wrapped.__revampCountsAuditStale = true;
    wrapped.__revampOrig = orig.__revampOrig || orig;
    window.markResultStale = wrapped;
  })();

  syncCommitAuditPreviewChrome();
  setTimeout(syncCommitAuditPreviewChrome, 0);
  setTimeout(syncCommitAuditPreviewChrome, 800);
  setTimeout(syncHistoryAuditChrome, 0);
  setTimeout(syncHistoryAuditChrome, 800);
  setTimeout(syncHistoryAuditChrome, 2000);


  /* ── Responsive Wave R1 (packaging): sticky phone bar / filter wrap / touch steppers ── */
  function ensureRevampResponsiveR1() {
    syncRevampViewportClasses();
    ensureHdrMoreToggle();
    enhancePhaseSteppers();
  }

  function syncRevampViewportClasses() {
    var w = window.innerWidth || document.documentElement.clientWidth || 0;
    var phone = w <= 640;
    var tablet = w > 640 && w <= 960;
    document.body.classList.toggle('revamp-vp-phone', phone);
    document.body.classList.toggle('revamp-vp-tablet', tablet);
    document.body.classList.toggle('revamp-vp-desktop', w >= 961);
    try {
      var coarse = window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches;
      document.body.classList.toggle('revamp-touch', !!coarse);
    } catch (e) {}
    // Extra bottom padding when sticky visible on phone (cards clear bar)
    if (phone && document.body.classList.contains('has-plan')) {
      document.body.style.setProperty('--revamp-sticky-pad', '128px');
    }
  }

  function ensureHdrMoreToggle() {
    var header = document.querySelector('body.revamp-preview header') || document.querySelector('header');
    if (!header) return;
    var right = header.querySelector('.hdr-right') || header.querySelector('.hdr-actions') || header;
    var btn = document.getElementById('revamp-hdr-more');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'revamp-hdr-more';
      btn.className = 'revamp-hdr-more no-print';
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'More header utilities');
      btn.textContent = 'More';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var open = document.body.classList.toggle('revamp-hdr-utils-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.textContent = open ? 'Less' : 'More';
      });
      // Prefer after DC chip / settings cluster
      var settings = header.querySelector('.hdr-settings-btn');
      if (settings && settings.parentNode) {
        settings.parentNode.insertBefore(btn, settings.nextSibling);
      } else if (right) {
        right.appendChild(btn);
      } else {
        header.appendChild(btn);
      }
    }
  }

  function enhancePhaseSteppers() {
    var root = document.getElementById('phase-inputs');
    if (!root) return;
    var inputs = root.querySelectorAll('input.phase-input');
    for (var i = 0; i < inputs.length; i++) {
      (function (inp) {
        if (inp.__revampStepper) return;
        inp.__revampStepper = true;
        // Skip if already wrapped
        if (inp.parentNode && inp.parentNode.classList && inp.parentNode.classList.contains('revamp-phase-stepper')) {
          return;
        }
        var wrap = document.createElement('div');
        wrap.className = 'revamp-phase-stepper no-print';
        wrap.setAttribute('data-revamp-r1', '1');
        var minus = document.createElement('button');
        minus.type = 'button';
        minus.className = 'revamp-step-btn';
        minus.setAttribute('aria-label', 'Decrease load count');
        minus.textContent = '−';
        var plus = document.createElement('button');
        plus.type = 'button';
        plus.className = 'revamp-step-btn';
        plus.setAttribute('aria-label', 'Increase load count');
        plus.textContent = '+';
        var parent = inp.parentNode;
        parent.insertBefore(wrap, inp);
        wrap.appendChild(minus);
        wrap.appendChild(inp);
        wrap.appendChild(plus);

        function bump(delta) {
          var id = inp.id || '';
          var m = id.match(/phase-input-(\d+)/);
          var idx = m ? parseInt(m[1], 10) : -1;
          var cur = Math.max(0, parseInt(inp.value, 10) || 0);
          var next = Math.max(0, Math.min(99, cur + delta));
          inp.value = String(next);
          if (idx >= 0 && typeof window.updateLoad === 'function') {
            window.updateLoad(idx, next);
          } else {
            try {
              inp.dispatchEvent(new Event('input', { bubbles: true }));
              inp.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (e2) {}
          }
        }
        minus.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          bump(-1);
        });
        plus.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          bump(1);
        });
      })(inputs[i]);
    }
  }

  // Re-enhance steppers when phase inputs re-render (engine untouched)
  (function watchPhaseInputsForSteppers() {
    var root = document.getElementById('phase-inputs');
    if (!root || root.__revampStepperMo) return;
    try {
      var mo = new MutationObserver(function () {
        enhancePhaseSteppers();
      });
      mo.observe(root, { childList: true, subtree: true });
      root.__revampStepperMo = mo;
    } catch (e) {}
  })();

  // Also wrap renderPhaseInputs if present (belt)
  (function wrapRenderPhaseInputsR1() {
    var orig = window.renderPhaseInputs;
    if (typeof orig !== 'function' || orig.__revampR1Steppers) return;
    var wrapped = function () {
      var ret = orig.apply(this, arguments);
      try { enhancePhaseSteppers(); } catch (e) {}
      return ret;
    };
    wrapped.__revampWrapped = true;
    wrapped.__revampR1Steppers = true;
    wrapped.__revampOrig = orig.__revampOrig || orig;
    window.renderPhaseInputs = wrapped;
  })();

  ensureRevampResponsiveR1();
  window.addEventListener('resize', function () {
    syncRevampViewportClasses();
  });
  setTimeout(ensureRevampResponsiveR1, 0);
  setTimeout(ensureRevampResponsiveR1, 400);
  setTimeout(enhancePhaseSteppers, 800);

  console.info('[REVAMP_PREVIEW] packaging layer active - production features unchanged · ready-gate TP#3 · enterprise-audit TP#2 · commit-audit TP#5');
})();

