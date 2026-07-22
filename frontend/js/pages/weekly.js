const WeeklyPage = (() => {
  let schools = [], checkins = [];
  let selectedWeek = 0; // 0 = not chosen yet; defaults to the current week of the year on first render

  async function load() {
    try {
      const [schoolData, checkinData] = await Promise.all([
        API.getSchools(),
        API.getCheckins()
      ]);
      schools = schoolData || [];
      checkins = checkinData || [];
    } catch (e) { schools = []; checkins = []; }
  }

  function getCheckin(schoolId, week) {
    // Prefer this year's record; fall back to older term-based rows so past data stays visible.
    const yr = String(new Date().getFullYear());
    const matches = checkins.filter(c => c.school_id === schoolId && c.week_number === week);
    return matches.find(c => c.term === yr) || matches[0];
  }

  function fmtDay(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ISO week number (Mon-based) of a date.
  function weekOfYear(d = new Date()) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + 3);
    const firstThu = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
    firstThu.setUTCDate(firstThu.getUTCDate() - ((firstThu.getUTCDay() + 6) % 7) + 3);
    return 1 + Math.round((date - firstThu) / (7 * 86400000));
  }

  // "12 Jan – 18 Jan" range for an ISO week of the given year.
  function weekRange(week, year) {
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const f = d => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
    return `${f(monday)} – ${f(sunday)}`;
  }

  function render() {
    const year = new Date().getFullYear();
    const currentWeek = Math.min(52, Math.max(1, weekOfYear()));
    if (!selectedWeek) selectedWeek = currentWeek;

    const weekItems = [];
    for (let w = 1; w <= 52; w++) {
      weekItems.push({ value: w, label: `Week ${w}`, desc: weekRange(w, year), tag: w === currentWeek ? 'Now' : '' });
    }
    const weekSelector = `
      <button class="btn btn-secondary btn-sm" onclick="WeeklyPage.setWeek(${selectedWeek - 1})" ${selectedWeek <= 1 ? 'disabled style="opacity:.4;cursor:default"' : ''} title="Previous week"><i class="ti ti-chevron-left"></i></button>
      <div style="width:270px">${Dropdown.render('wk-select', `Week ${selectedWeek} <span style="color:var(--text3);font-weight:400">· ${weekRange(selectedWeek, year)}</span>`, weekItems, { defaultValue: String(selectedWeek), onSelect: "WeeklyPage.setWeek(parseInt(Dropdown.getValue('wk-select')))" })}</div>
      <button class="btn btn-secondary btn-sm" onclick="WeeklyPage.setWeek(${selectedWeek + 1})" ${selectedWeek >= 52 ? 'disabled style="opacity:.4;cursor:default"' : ''} title="Next week"><i class="ti ti-chevron-right"></i></button>
      ${selectedWeek !== currentWeek ? `<button class="btn btn-secondary btn-sm" onclick="WeeklyPage.setWeek(${currentWeek})"><i class="ti ti-calendar-pin"></i> This Week</button>` : ''}`;

    const schoolRows = schools.map(s => {
      const c = getCheckin(s.id, selectedWeek);
      const status = c ? c.status : 'pending';
      const dot = status === 'green' ? 'dot-green' : status === 'amber' ? 'dot-amber' : status === 'red' ? 'dot-red' : 'dot-gray';
      const label = c ? (status === 'green' ? 'Done' : status === 'amber' ? 'Issues' : 'Critical') : 'Due';
      return `<tr>
        <td><div style="display:flex;align-items:center;gap:10px">
          <span class="dot ${dot}"></span>
          <div><div style="font-weight:500">${esc(s.name)}</div><div style="font-size:11px;color:var(--text3)">${esc(s.zone || '')}</div></div>
        </div></td>
        <td>${esc(s.contact_name || '—')}</td>
        <td><span class="badge ${status === 'green' ? 'badge-green' : status === 'amber' ? 'badge-amber' : status === 'red' ? 'badge-red' : 'badge-gray'}">${label}</span></td>
        <td>${c ? fmtDay(c.checkin_date || c.created_at) : '—'}</td>
        <td>${c ? esc(c.note || '—') : '—'}</td>
        <td>${!c ? `<button class="btn btn-primary btn-sm" data-tip="${TIP.CHECKIN}" onclick="WeeklyPage.openCheckin(${s.id})"><i class="ti ti-clipboard-check"></i> Check-In</button>` : `<button class="btn btn-secondary btn-sm" onclick="WeeklyPage.viewCheckin(${s.id})"><i class="ti ti-eye"></i> View</button>`}</td>
      </tr>`;
    }).join('');

    const doneCount = schools.filter(s => getCheckin(s.id, selectedWeek)).length;
    const totalCount = schools.length;

    return `
    <div class="section-header">
      <div><div class="section-title">Weekly Check-Ins</div><div class="section-sub">${year} · Week ${selectedWeek} of 52 — structured weekly support visit per school</div></div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      ${weekSelector}
      <span style="margin-left:auto;font-size:12px;color:var(--text3)">${doneCount}/${totalCount} complete</span>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>School</th><th>Contact</th><th>Status</th><th>Date</th><th>Note</th><th>Action</th></tr></thead>
          <tbody>${schoolRows}</tbody>
        </table>
      </div>
    </div>`;
  }

  function setWeek(w) {
    selectedWeek = Math.min(52, Math.max(1, parseInt(w) || 1));
    App.render();
  }

  function openCheckin(schoolId) {
    const school = schools.find(s => s.id === schoolId);
    const statusOpts = [
      { value: 'ok', label: 'OK', tag: 'Good' },
      { value: 'issue', label: 'Issue', tag: 'Problem' },
      { value: 'na', label: 'N/A', tag: 'Skip' }
    ];
    const overallOpts = [
      { value: 'green', label: 'Green', desc: '— All OK' },
      { value: 'amber', label: 'Amber', desc: '— Minor Issues' },
      { value: 'red', label: 'Red', desc: '— Critical' }
    ];
    const body = `
      <div class="form-grid">
        <div class="form-group"><label>School</label><input type="text" value="${esc(school?.name || '')}" disabled></div>
        <div class="form-group"><label>Check-In Date <span style="color:var(--text3);font-weight:400">(Week ${selectedWeek})</span></label><input type="date" id="ci-date" value="${todayStr()}" max="${todayStr()}"></div>
        <div class="form-group"><label>Connectivity</label>${Dropdown.render('ci-conn', 'OK', statusOpts, { defaultValue: 'ok' })}</div>
        <div class="form-group"><label>Tablets</label>${Dropdown.render('ci-tab', 'OK', statusOpts, { defaultValue: 'ok' })}</div>
        <div class="form-group"><label>Platform</label>${Dropdown.render('ci-plat', 'OK', statusOpts, { defaultValue: 'ok' })}</div>
        <div class="form-group"><label>Power</label>${Dropdown.render('ci-power', 'OK', statusOpts, { defaultValue: 'ok' })}</div>
        <div class="form-group full"><label>Overall Status</label>${Dropdown.render('ci-status', 'Green — All OK', overallOpts, { defaultValue: 'green' })}</div>
        <div class="form-group full"><label>Notes</label><textarea id="ci-note" rows="3" placeholder="Any observations..."></textarea></div>
      </div>`;
    const footer = `<button class="btn btn-primary" data-tip="${TIP.SUBMIT_CHECKIN}" onclick="WeeklyPage.submitCheckin(${schoolId})"><i class="ti ti-check"></i> Submit Check-In</button>`;
    Modal.open('Weekly Check-In', body, footer);
  }

  async function submitCheckin(schoolId) {
    const dateVal = (document.getElementById('ci-date')?.value || '').trim();
    if (!dateVal) { showToast('Please select the check-in date'); return; }
    const data = {
      school_id: schoolId,
      week_number: selectedWeek,
      term: String(new Date().getFullYear()),
      checkin_date: dateVal,
      status: Dropdown.getValue('ci-status') || 'green',
      connectivity: Dropdown.getValue('ci-conn') || 'ok',
      tablets: Dropdown.getValue('ci-tab') || 'ok',
      platform: Dropdown.getValue('ci-plat') || 'ok',
      power: Dropdown.getValue('ci-power') || 'ok',
      note: document.getElementById('ci-note').value.trim()
    };
    try {
      await API.createCheckin(data);
      Modal.close();
      showToast('Check-in recorded');
      await load(); App.render();
    } catch (e) { showToast(e.error || 'Failed'); }
  }

  function viewCheckin(schoolId) {
    const c = getCheckin(schoolId, selectedWeek);
    if (!c) return;
    const school = schools.find(s => s.id === schoolId);
    const body = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">
        <div><strong>School:</strong> ${esc(school?.name || '')}</div>
        <div><strong>Week:</strong> ${selectedWeek}</div>
        <div><strong>Date:</strong> ${fmtDay(c.checkin_date || c.created_at)}</div>
        <div><strong>Status:</strong> <span class="badge badge-${c.status}">${c.status}</span></div>
        <div><strong>Checked by:</strong> ${esc(c.checked_by || '—')}</div>
        <div><strong>Connectivity:</strong> ${c.connectivity}</div>
        <div><strong>Tablets:</strong> ${c.tablets}</div>
        <div><strong>Platform:</strong> ${c.platform}</div>
        <div><strong>Power:</strong> ${c.power}</div>
      </div>
      ${c.note ? `<div style="margin-top:12px;padding:10px;background:var(--bg3);border-radius:8px;font-size:12px">${esc(c.note)}</div>` : ''}`;
    Modal.open('Check-In Details', body, '<button class="btn btn-secondary" onclick="Modal.close()">Close</button>');
  }

  return { load, render, setWeek, openCheckin, submitCheckin, viewCheckin };
})();
