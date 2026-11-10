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
        '<strong id="revamp-sticky-title">Plan ready</strong>' +
        '<span id="revamp-sticky-sub">Review pass-outs, then commit the day</span>' +
      '</div>' +
      '<div class="actions">' +
        '<button type="button" class="btn-ghost" onclick="window.print()">Print</button>' +
        '<button type="button" class="btn-ghost" onclick="typeof exportCSV===\'function\'&&exportCSV()">CSV</button>' +
        '<button type="button" class="btn-rerun" id="revamp-rerun-btn">Re-run</button>' +
        '<button type="button" class="btn-commit-primary" id="revamp-commit-btn">Commit Day</button>' +
      '</div>';
    document.body.appendChild(sticky);
  }

  var showAllState = { value: false };

  function planExists() {
    try { return !!(window.state && state.lastResult); }
    catch (e) { return false; }
  }

  function syncSticky() {
    var has = planExists();
    document.body.classList.toggle('has-plan', has);
    var title = document.getElementById('revamp-sticky-title');
    var sub = document.getElementById('revamp-sticky-sub');
    if (title) title.textContent = has ? 'Plan ready' : 'No plan yet';
    if (sub) {
      try {
        var n = (state.lastResult && state.lastResult.assignments) ? state.lastResult.assignments.length : 0;
        sub.textContent = has
          ? (n + ' load' + (n === 1 ? '' : 's') + ' assigned - review, then commit')
          : 'Generate assignments to unlock commit';
      } catch (e) {
        sub.textContent = 'Review pass-outs, then commit the day';
      }
    }
    var commitBtn = document.getElementById('revamp-commit-btn');
    if (commitBtn && typeof window.SupabaseSync !== 'undefined') {
      try {
        commitBtn.textContent = (SupabaseSync.isCommitted && SupabaseSync.isCommitted())
          ? 'Committed'
          : 'Commit Day';
      } catch (e) {}
    }
  }

  var rerunBtn = document.getElementById('revamp-rerun-btn');
  if (rerunBtn) rerunBtn.addEventListener('click', function () {
    if (typeof rerunRemaining === 'function' && planExists()) rerunRemaining();
    else if (typeof generateAssignments === 'function') generateAssignments();
  });
  var commitBtnEl = document.getElementById('revamp-commit-btn');
  if (commitBtnEl) commitBtnEl.addEventListener('click', function () {
    if (typeof commitToHistory === 'function') commitToHistory();
  });

  function ensureCardsToolbar() {
    var grid = document.getElementById('driver-cards-grid');
    if (!grid || document.getElementById('revamp-cards-toolbar')) return;
    var bar = document.createElement('div');
    bar.id = 'revamp-cards-toolbar';
    bar.className = 'revamp-cards-toolbar no-print';
    bar.innerHTML =
      '<div class="hint">Assigned pass-out cards first</div>' +
      '<label><input type="checkbox" id="revamp-show-all"> Show all drivers (incl. empty)</label>';
    grid.parentNode.insertBefore(bar, grid);
    bar.querySelector('#revamp-show-all').addEventListener('change', function (e) {
      showAllState.value = !!e.target.checked;
      applyEmptyCardFilter();
    });
  }

  function realRuns(card) {
    return Array.prototype.filter.call(card.querySelectorAll('.run-row'), function (r) {
      return !r.classList.contains('drop-hint');
    });
  }

  function applyEmptyCardFilter() {
    var grid = document.getElementById('driver-cards-grid');
    var toolbar = document.getElementById('revamp-cards-toolbar');
    if (!grid) return;
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.driver-card'));
    var emptyCount = 0;
    var assigned = [];
    var empties = [];
    var specials = [];
    cards.forEach(function (card) {
      var isSpecial = card.classList.contains('is-unassigned') || card.classList.contains('is-shore');
      var isEmpty = !isSpecial && realRuns(card).length === 0;
      if (isEmpty) emptyCount++;
      card.classList.toggle('revamp-empty-hidden', isEmpty && !showAllState.value);
      if (isSpecial) specials.push(card);
      else if (isEmpty) empties.push(card);
      else assigned.push(card);
    });
    if (!showAllState.value) {
      specials.concat(assigned, empties).forEach(function (c) { grid.appendChild(c); });
    }
    if (toolbar) {
      toolbar.classList.toggle('visible', emptyCount > 0);
      var cb = toolbar.querySelector('#revamp-show-all');
      if (cb) cb.checked = showAllState.value;
    }
  }

  function restylePlanQuality() {
    var panel = document.getElementById('plan-quality-panel');
    var content = document.getElementById('plan-quality-content');
    if (!panel || !content) return;
    panel.classList.add('revamp-needs');

    var hd = panel.querySelector('.revamp-needs-hd');
    if (!hd) {
      Array.prototype.slice.call(panel.children).forEach(function (ch) {
        if (ch !== content && !ch.classList.contains('revamp-needs-hd')) ch.remove();
      });
      hd = document.createElement('button');
      hd.type = 'button';
      hd.className = 'revamp-needs-hd';
      hd.innerHTML =
        '<div class="needs-title">Needs Attention <span class="needs-pill" id="revamp-needs-count">0</span></div>' +
        '<span class="needs-sub" id="revamp-needs-sub">Plan quality</span>' +
        '<span class="needs-chevron">></span>';
      panel.insertBefore(hd, content);
      hd.addEventListener('click', function () { panel.classList.toggle('is-open'); });
      panel.classList.add('is-open');
    }

    Array.prototype.slice.call(content.querySelectorAll('.pq-row')).forEach(function (row) {
      if (!row.classList.contains('pq-unused')) return;
      if (row.querySelector('.pq-unused-collapsed')) return;
      var text = row.textContent || '';
      var m = text.match(/^Unused:\s*(.*)$/i);
      if (!m) return;
      var names = m[1].split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      if (names.length <= 4) return;
      var shown = names.slice(0, 3).join(', ');
      var rest = names.slice(3);
      row.innerHTML = 'Unused: ' + shown +
        ' <button type="button" class="pq-unused-collapsed">+' + rest.length + ' more</button>' +
        '<div class="pq-unused-extra">' + rest.join(', ') + '</div>';
      var btn = row.querySelector('.pq-unused-collapsed');
      var extra = row.querySelector('.pq-unused-extra');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = extra.classList.toggle('show');
        btn.textContent = open ? 'Show less' : ('+' + rest.length + ' more');
      });
    });

    var count = content.querySelectorAll('.pq-row').length;
    var pill = document.getElementById('revamp-needs-count');
    var sub = document.getElementById('revamp-needs-sub');
    if (pill) pill.textContent = String(count);
    if (sub) sub.textContent = count ? (count + ' issue' + (count === 1 ? '' : 's') + ' to review') : 'All clear';
    var visible = panel.style.display !== 'none' && count > 0;
    panel.classList.toggle('is-visible', visible);
    if (!visible) panel.classList.remove('is-open');
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

  function afterGenerate() {
    syncSticky();
    ensureCardsToolbar();
    applyEmptyCardFilter();
    restylePlanQuality();
  }

  wrap('generateAssignments', afterGenerate);
  wrap('rerunRemaining', afterGenerate);
  wrap('renderDriverCards', function () {
    syncSticky();
    ensureCardsToolbar();
    applyEmptyCardFilter();
  });
  wrap('renderPlanQuality', restylePlanQuality);
  wrap('commitToHistory', syncSticky);
  wrap('renderAll', function () {
    syncSticky();
    ensureCardsToolbar();
    applyEmptyCardFilter();
    restylePlanQuality();
  });

  var section = document.getElementById('driver-cards-section');
  if (section && typeof MutationObserver !== 'undefined') {
    new MutationObserver(function () {
      syncSticky();
      if (section.style.display !== 'none') {
        ensureCardsToolbar();
        applyEmptyCardFilter();
        restylePlanQuality();
      }
    }).observe(section, { attributes: true, attributeFilter: ['style', 'class'] });
  }

  syncSticky();
  ensureCardsToolbar();
  applyEmptyCardFilter();
  restylePlanQuality();

  console.info('[REVAMP_PREVIEW] packaging layer active - production features unchanged');
})();
