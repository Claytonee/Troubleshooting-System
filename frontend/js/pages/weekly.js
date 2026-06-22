const WeeklyPage = (() => {
  let schools = [], checkins = [];
  let selectedWeek = 4;

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
    return checkins.find(c => c.school_id === schoolId && c.week_number === week);
  }

  function render() {
    const weeks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const weekTabs = weeks.map(w => `<button class="chip ${w === selectedWeek ? 'chip-active' : ''}" onclick="WeeklyPage.setWeek(${w})">W${w}</button>`).join('');

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
        <td>${c ? esc(c.note || '—') : '—'}</td>
        <td>${!c ? `<button class="btn btn-primary btn-sm" onclick="WeeklyPage.openCheckin(${s.id})"><i class="ti ti-clipboard-check"></i> Check-In</button>` : `<button class="btn btn-secondary btn-sm" onclick="WeeklyPage.viewCheckin(${s.id})"><i class="ti ti-eye"></i> View</button>`}</td>
      </tr>`;
    }).join('');

    const doneCount = schools.filter(s => getCheckin(s.id, selectedWeek)).length;
    const totalCount = schools.length;

    return `
    <div class="section-header">
      <div><div class="section-title">Weekly Check-Ins</div><div class="section-sub">Term 2 · 2026 — structured weekly support visit per school</div></div>
    </div>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      ${weekTabs}
      <span style="margin-left:auto;font-size:12px;color:var(--text3)">${doneCount}/${totalCount} complete</span>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>School</th><th>Contact</th><th>Status</th><th>Note</th><th>Action</th></tr></thead>
          <tbody>${schoolRows}</tbody>
        </table>
      </div>
    </div>`;
  }

  function setWeek(w) {
    selectedWeek = w;
    App.render();
  }

  function openCheckin(schoolId) {
    const school = schools.find(s => s.id === schoolId);
    const body = `
      <div class="form-grid">
        <div class="form-group"><label>School</label><input type="text" value="${esc(school?.name || '')}" disabled></div>
        <div class="form-group"><label>Week</label><input type="text" value="Week ${selectedWeek}" disabled></div>
        <div class="form-group"><label>Connectivity</label><select id="ci-conn"><option value="ok">OK</option><option value="issue">Issue</option><option value="na">N/A</option></select></div>
        <div class="form-group"><label>Tablets</label><select id="ci-tab"><option value="ok">OK</option><option value="issue">Issue</option><option value="na">N/A</option></select></div>
        <div class="form-group"><label>Platform</label><select id="ci-plat"><option value="ok">OK</option><option value="issue">Issue</option><option value="na">N/A</option></select></div>
        <div class="form-group"><label>Power</label><select id="ci-power"><option value="ok">OK</option><option value="issue">Issue</option><option value="na">N/A</option></select></div>
        <div class="form-group full"><label>Overall Status</label><select id="ci-status"><option value="green">Green — All OK</option><option value="amber">Amber — Minor Issues</option><option value="red">Red — Critical</option></select></div>
        <div class="form-group full"><label>Notes</label><textarea id="ci-note" rows="3" placeholder="Any observations..."></textarea></div>
      </div>`;
    const footer = `<button class="btn btn-primary" onclick="WeeklyPage.submitCheckin(${schoolId})"><i class="ti ti-check"></i> Submit Check-In</button>`;
    Modal.open('Weekly Check-In', body, footer);
  }

  async function submitCheckin(schoolId) {
    const data = {
      school_id: schoolId,
      week_number: selectedWeek,
      term: 'Term 2 · 2026',
      status: document.getElementById('ci-status').value,
      connectivity: document.getElementById('ci-conn').value,
      tablets: document.getElementById('ci-tab').value,
      platform: document.getElementById('ci-plat').value,
      power: document.getElementById('ci-power').value,
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
