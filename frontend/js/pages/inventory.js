const InventoryPage = (() => {
  let devices = [], stats = null, schools = [];
  let filters = { status: '', form: '', search: '', school_id: '' };
  const user = () => API.getUser();
  const isAdmin = () => ['admin','subadmin'].includes(user()?.role);

  async function load() {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.form) params.form = filters.form;
      if (filters.search) params.search = filters.search;
      if (filters.school_id) params.school_id = filters.school_id;
      [devices, stats] = await Promise.all([
        API.getInventory(params),
        API.getInventoryStats(params.school_id ? { school_id: params.school_id } : {})
      ]);
      if (isAdmin()) schools = await API.getSchools();
    } catch (e) { devices = []; stats = null; }
  }

  function render() {
    const s = stats?.summary || {};
    const total = +s.total || 0;
    const working = +s.working || 0;
    const faulty = +s.faulty || 0;
    const inRepair = +s.in_repair || 0;
    const lostMissing = +s.lost_missing || 0;
    const assigned = +s.assigned || 0;
    const healthPct = total ? Math.round((working / total) * 100) : 0;

    return `
  <div class="section-header">
    <div style="display:flex;align-items:center;gap:14px">
      <div style="width:38px;height:38px;border-radius:10px;background:rgba(79,124,255,.12);display:flex;align-items:center;justify-content:center"><i class="ti ti-device-tablet" style="font-size:20px;color:var(--accent)"></i></div>
      <div>
        <div class="section-title" style="margin:0">Tablet Inventory</div>
        <div class="section-sub" style="margin:0">${total} devices · ${healthPct}% fleet health</div>
      </div>
    </div>
    <div class="inv-header-actions">
      <div class="inv-header-stats">
        <div style="padding:4px 10px;border-radius:6px;background:rgba(45,217,138,.1);font-size:11px;font-weight:600;color:var(--green)">${working} <span style="font-weight:400;opacity:.7">OK</span></div>
        <div style="padding:4px 10px;border-radius:6px;background:rgba(255,82,99,.1);font-size:11px;font-weight:600;color:var(--red)">${faulty} <span style="font-weight:400;opacity:.7">Faulty</span></div>
        <div style="padding:4px 10px;border-radius:6px;background:rgba(245,166,35,.1);font-size:11px;font-weight:600;color:var(--amber)">${inRepair} <span style="font-weight:400;opacity:.7">Repair</span></div>
        <div style="padding:4px 10px;border-radius:6px;background:rgba(155,125,255,.1);font-size:11px;font-weight:600;color:var(--purple)">${lostMissing} <span style="font-weight:400;opacity:.7">Lost</span></div>
      </div>
      <button class="btn btn-ghost" onclick="InventoryPage.openImport()" title="Import CSV"><i class="ti ti-upload"></i></button>
      <button class="btn btn-ghost" onclick="InventoryPage.exportCsv()" title="Export"><i class="ti ti-download"></i></button>
      <button class="btn btn-primary" onclick="InventoryPage.openAdd()"><i class="ti ti-plus"></i> Add</button>
    </div>
  </div>

  <div class="inv-toolbar">
    ${isAdmin() ? `<div style="min-width:200px">${Dropdown.render('inv-school', 'All Schools', [{value:'',label:'All Schools'},...schools.map(sc => ({value:sc.id,label:sc.name,tag:sc.zone||''}))], {defaultValue: filters.school_id, onSelect: "InventoryPage.onSchoolSelect()"})}</div>` : ''}
    <div style="min-width:150px">${Dropdown.render('inv-status', 'All Statuses', [
      {value:'',label:'All Statuses'},
      {value:'Working',label:'Working'},
      {value:'Needs Setup',label:'Needs Setup'},
      {value:'In Repair',label:'In Repair'},
      {value:'Faulty',label:'Faulty'},
      {value:'Lost/Missing',label:'Lost/Missing'}
    ], {defaultValue: filters.status, onSelect: "InventoryPage.onStatusSelect()"})}</div>
    <div style="min-width:130px">${Dropdown.render('inv-form', 'All Forms', [
      {value:'',label:'All Forms'},
      {value:'Form 1',label:'Form 1'},
      {value:'Form 2',label:'Form 2'},
      {value:'Form 3',label:'Form 3'},
      {value:'Form 4',label:'Form 4'}
    ], {defaultValue: filters.form, onSelect: "InventoryPage.onFormSelect()"})}</div>
    <div style="flex:1;position:relative;min-width:160px">
      <i class="ti ti-search" style="position:absolute;left:9px;top:50%;transform:translateY(-50%);font-size:13px;color:var(--text3)"></i>
      <input type="text" id="inv-search" placeholder="Search serial, tag, student..." value="${filters.search}" onkeyup="InventoryPage.debounceSearch(this.value)" style="width:100%;padding:7px 10px 7px 30px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text);font-size:12px">
    </div>
    <span style="font-size:11px;color:var(--text3);white-space:nowrap">${devices.length} shown</span>
  </div>

  <div class="inv-grid">
    ${devices.length ? devices.map(d => deviceCard(d)).join('') : '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text3)"><i class="ti ti-device-tablet-off" style="font-size:40px;opacity:.4;display:block;margin-bottom:10px"></i>No devices found</div>'}
  </div>`;
  }

  function deviceCard(d) {
    const statusColors = { 'Working': 'green', 'Needs Setup': 'amber', 'In Repair': 'amber', 'Faulty': 'red', 'Lost/Missing': 'purple' };
    const borderColor = `var(--${statusColors[d.status] || 'accent'})`;
    return `<div class="card reveal" onclick="InventoryPage.openDetail(${d.id})" style="cursor:pointer;border-left:3px solid ${borderColor};padding:12px 14px;transition:all .15s;overflow:hidden" onmouseenter="this.style.background='var(--bg3)'" onmouseleave="this.style.background=''">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">
        <div style="font-family:var(--font-mono);font-size:13px;font-weight:600;color:var(--text);white-space:nowrap">${d.asset_tag || d.serial_number}</div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          ${d.form ? `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:var(--bg3);color:var(--text3)">${d.form}${d.stream ? ' '+d.stream : ''}</span>` : ''}
          ${statusBadge(d.status)}
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div style="min-width:0;flex:1">
          <div style="font-size:11px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.serial_number}${d.model ? ' · ' + d.model : ''}</div>
          <div style="font-size:12px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${d.student_name ? 'var(--text2)' : 'var(--text3)'}"><i class="ti ti-user" style="font-size:12px;margin-right:4px"></i>${d.student_name || 'Unassigned'}${d.admission_no ? ' · ' + d.admission_no : ''}</div>
        </div>
        <button class="btn-icon" onclick="event.stopPropagation();InventoryPage.openEdit(${d.id})" title="Edit" style="width:26px;height:26px;flex-shrink:0"><i class="ti ti-pencil" style="font-size:13px"></i></button>
      </div>
    </div>`;
  }

  function afterRender() {
    document.querySelectorAll('.main .stats-grid, .main .card').forEach(c => c.classList.add('reveal', 'visible'));
  }

  function statusBadge(status) {
    const colors = { 'Working': 'green', 'Needs Setup': 'amber', 'In Repair': 'amber', 'Faulty': 'red', 'Lost/Missing': 'purple' };
    return `<span class="badge-${colors[status] || 'accent'}" style="font-size:11px">${status}</span>`;
  }

  let _searchTimeout;
  function debounceSearch(val) {
    clearTimeout(_searchTimeout);
    _searchTimeout = setTimeout(() => { filters.search = val; reload(); }, 400);
  }
  function filterStatus(val) { filters.status = val; reload(); }
  function filterForm(val) { filters.form = val; reload(); }
  function filterSchool(val) { filters.school_id = val; reload(); }
  function onSchoolSelect() { filters.school_id = Dropdown.getValue('inv-school') || ''; reload(); }
  function onStatusSelect() { filters.status = Dropdown.getValue('inv-status') || ''; reload(); }
  function onFormSelect() { filters.form = Dropdown.getValue('inv-form') || ''; reload(); }

  async function reload() {
    await load();
    const main = document.querySelector('.main');
    if (main) { main.innerHTML = render(); afterRender(); }
  }

  function openAdd() {
    const schoolSelect = isAdmin() ? `<div class="form-group"><label>School</label><select id="dev-school" required>
      <option value="">Select school</option>${schools.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select></div>` : '';
    Modal.open('Add Device', `
      <form id="add-device-form" onsubmit="InventoryPage.submitAdd(event)">
        ${schoolSelect}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group"><label>Serial Number *</label><input id="dev-serial" required></div>
          <div class="form-group"><label>Asset Tag</label><input id="dev-tag"></div>
          <div class="form-group"><label>Model</label><input id="dev-model"></div>
          <div class="form-group"><label>Year First Used</label><input id="dev-year" type="number" min="2015" max="2030"></div>
          <div class="form-group"><label>Form</label><select id="dev-form">
            <option value="">—</option><option>Form 1</option><option>Form 2</option><option>Form 3</option><option>Form 4</option></select></div>
          <div class="form-group"><label>Stream</label><select id="dev-stream">
            <option value="">—</option><option>A</option><option>B</option><option>C</option></select></div>
          <div class="form-group"><label>Status</label><select id="dev-status">
            <option>Working</option><option>Needs Setup</option><option>In Repair</option><option>Faulty</option><option>Lost/Missing</option></select></div>
          <div class="form-group"><label>Last Checked</label><input id="dev-checked" type="date"></div>
        </div>
        <div style="border-top:1px solid var(--border);margin:14px 0;padding-top:14px">
          <div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--text2)">Student Assignment (optional)</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group"><label>Student Name</label><input id="dev-student"></div>
            <div class="form-group"><label>Admission No.</label><input id="dev-admission"></div>
          </div>
        </div>
        <div class="form-group"><label>Notes</label><textarea id="dev-notes" rows="2"></textarea></div>
        <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px">Add Device</button>
      </form>
    `, '', true);
  }

  async function submitAdd(e) {
    e.preventDefault();
    const data = {
      serial_number: document.getElementById('dev-serial').value.trim(),
      asset_tag: document.getElementById('dev-tag').value.trim(),
      model: document.getElementById('dev-model').value.trim(),
      year_first_used: document.getElementById('dev-year').value ? +document.getElementById('dev-year').value : null,
      form: document.getElementById('dev-form').value,
      stream: document.getElementById('dev-stream').value,
      status: document.getElementById('dev-status').value,
      last_checked: document.getElementById('dev-checked').value || null,
      student_name: document.getElementById('dev-student').value.trim(),
      admission_no: document.getElementById('dev-admission').value.trim(),
      notes: document.getElementById('dev-notes').value.trim(),
    };
    if (isAdmin()) data.school_id = document.getElementById('dev-school')?.value;
    try {
      await API.createDevice(data);
      Modal.close();
      Toast.show('Device added successfully', 'success');
      reload();
    } catch (err) { Toast.show(err.error || 'Failed to add device', 'error'); }
  }

  function openEdit(id) {
    const d = devices.find(x => x.id === id);
    if (!d) return;
    const schoolSelect = isAdmin() ? `<div class="form-group"><label>School</label><select id="dev-school">
      ${schools.map(s => `<option value="${s.id}" ${s.id===d.school_id?'selected':''}>${s.name}</option>`).join('')}</select></div>` : '';
    Modal.open('Edit Device', `
      <form id="edit-device-form" onsubmit="InventoryPage.submitEdit(event, ${id})">
        ${schoolSelect}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group"><label>Serial Number *</label><input id="dev-serial" value="${esc(d.serial_number)}" required></div>
          <div class="form-group"><label>Asset Tag</label><input id="dev-tag" value="${esc(d.asset_tag||'')}"></div>
          <div class="form-group"><label>Model</label><input id="dev-model" value="${esc(d.model||'')}"></div>
          <div class="form-group"><label>Year First Used</label><input id="dev-year" type="number" min="2015" max="2030" value="${d.year_first_used||''}"></div>
          <div class="form-group"><label>Form</label><select id="dev-form">
            <option value="">—</option>${['Form 1','Form 2','Form 3','Form 4'].map(f => `<option ${d.form===f?'selected':''}>${f}</option>`).join('')}</select></div>
          <div class="form-group"><label>Stream</label><select id="dev-stream">
            <option value="">—</option>${['A','B','C'].map(s => `<option ${d.stream===s?'selected':''}>${s}</option>`).join('')}</select></div>
          <div class="form-group"><label>Status</label><select id="dev-status">
            ${['Working','Needs Setup','In Repair','Faulty','Lost/Missing'].map(s => `<option ${d.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
          <div class="form-group"><label>Last Checked</label><input id="dev-checked" type="date" value="${d.last_checked ? d.last_checked.split('T')[0] : ''}"></div>
        </div>
        <div style="border-top:1px solid var(--border);margin:14px 0;padding-top:14px">
          <div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--text2)">Student Assignment</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group"><label>Student Name</label><input id="dev-student" value="${esc(d.student_name||'')}"></div>
            <div class="form-group"><label>Admission No.</label><input id="dev-admission" value="${esc(d.admission_no||'')}"></div>
          </div>
        </div>
        <div class="form-group"><label>Notes</label><textarea id="dev-notes" rows="2">${esc(d.notes||'')}</textarea></div>
        <div style="display:flex;gap:10px;margin-top:10px">
          <button type="submit" class="btn btn-primary" style="flex:1">Save Changes</button>
          ${isAdmin() ? `<button type="button" class="btn btn-danger" onclick="InventoryPage.confirmDelete(${id})">Delete</button>` : ''}
        </div>
      </form>
    `, '', true);
  }

  async function submitEdit(e, id) {
    e.preventDefault();
    const data = {
      serial_number: document.getElementById('dev-serial').value.trim(),
      asset_tag: document.getElementById('dev-tag').value.trim(),
      model: document.getElementById('dev-model').value.trim(),
      year_first_used: document.getElementById('dev-year').value ? +document.getElementById('dev-year').value : null,
      form: document.getElementById('dev-form').value,
      stream: document.getElementById('dev-stream').value,
      status: document.getElementById('dev-status').value,
      last_checked: document.getElementById('dev-checked').value || null,
      student_name: document.getElementById('dev-student').value.trim(),
      admission_no: document.getElementById('dev-admission').value.trim(),
      notes: document.getElementById('dev-notes').value.trim(),
    };
    try {
      await API.updateDevice(id, data);
      Modal.close();
      Toast.show('Device updated', 'success');
      reload();
    } catch (err) { Toast.show(err.error || 'Failed to update', 'error'); }
  }

  async function openDetail(id) {
    try {
      const d = await API.getDevice(id);
      const history = d.history || [];
      Modal.open('Device Detail', `
        <div>
          <table class="detail-info-table" style="width:100%;border-collapse:separate;border-spacing:0;background:var(--bg3);border-radius:10px;border:1px solid var(--border);overflow:hidden">
            <tr><td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-hash" style="font-size:13px;color:var(--accent)"></i>Asset Tag</span></td><td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${esc(d.asset_tag||'-')}</td>
                <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-barcode" style="font-size:13px;color:var(--teal)"></i>Serial</span></td><td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text);font-family:var(--font-mono)">${esc(d.serial_number)}</td></tr>
            <tr><td colspan="4" style="padding:0;height:1px;background:var(--border)"></td></tr>
            <tr><td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-device-tablet" style="font-size:13px;color:var(--purple)"></i>Model</span></td><td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${esc(d.model||'-')}</td>
                <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-calendar" style="font-size:13px;color:var(--amber)"></i>Year</span></td><td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${d.year_first_used||'-'}</td></tr>
            <tr><td colspan="4" style="padding:0;height:1px;background:var(--border)"></td></tr>
            <tr><td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-school" style="font-size:13px;color:var(--green)"></i>Form</span></td><td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${d.form||'-'} ${d.stream||''}</td>
                <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-activity" style="font-size:13px;color:${d.status==='Working'?'var(--green)':'var(--red)'}"></i>Status</span></td><td style="padding:9px 12px;font-weight:500;font-size:13px">${statusBadge(d.status)}</td></tr>
            <tr><td colspan="4" style="padding:0;height:1px;background:var(--border)"></td></tr>
            <tr><td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-user" style="font-size:13px;color:var(--accent)"></i>Student</span></td><td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${esc(d.student_name||'Unassigned')}</td>
                <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-id" style="font-size:13px;color:var(--purple)"></i>Adm. No</span></td><td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${esc(d.admission_no||'-')}</td></tr>
            ${d.notes ? `<tr><td colspan="4" style="padding:0;height:1px;background:var(--border)"></td></tr><tr><td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-note" style="font-size:13px;color:var(--amber)"></i>Notes</span></td><td colspan="3" style="padding:9px 12px;font-size:13px;color:var(--text2)">${esc(d.notes)}</td></tr>` : ''}
          </table>
        </div>
        ${history.length ? `
        <div style="margin-top:16px">
          <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);margin-bottom:8px">History</div>
          <div style="max-height:200px;overflow-y:auto">
            ${history.map(h => `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px">
              <span style="color:var(--text3);min-width:80px">${new Date(h.created_at).toLocaleDateString()}</span>
              <span style="color:var(--text2)">${historyLabel(h)}</span>
              <span style="margin-left:auto;color:var(--text3)">${esc(h.actor_name||'')}</span>
            </div>`).join('')}
          </div>
        </div>` : ''}
        <div style="display:flex;gap:8px;margin-top:14px;justify-content:space-between">
          <button class="btn" onclick="InventoryPage.openEdit(${d.id})" style="padding:8px 16px;font-size:12px;background:rgba(79,124,255,.12);color:var(--accent);border:1px solid rgba(79,124,255,.25);border-radius:8px"><i class="ti ti-pencil"></i> Edit</button>
          <button class="btn" onclick="InventoryPage.openStatusChange(${d.id},'${d.status}')" style="padding:8px 16px;font-size:12px;background:rgba(54,217,204,.12);color:var(--teal);border:1px solid rgba(54,217,204,.25);border-radius:8px"><i class="ti ti-refresh"></i> Change Status</button>
        </div>
      `, '', true);
    } catch (err) { Toast.show('Failed to load device details', 'error'); }
  }

  function historyLabel(h) {
    if (h.action === 'created') return 'Device added to inventory';
    if (h.action === 'status_change') return `Status: ${h.old_value} → <strong>${h.new_value}</strong>`;
    if (h.action === 'assigned') return `Assigned: ${h.old_value} → <strong>${h.new_value}</strong>`;
    return h.action + (h.note ? ` — ${h.note}` : '');
  }

  function openStatusChange(id, currentStatus) {
    Modal.open('Change Status', `
      <form onsubmit="InventoryPage.submitStatus(event, ${id})">
        <div class="form-group"><label>New Status</label><select id="st-status">
          ${['Working','Needs Setup','In Repair','Faulty','Lost/Missing'].map(s => `<option ${s===currentStatus?'selected':''}>${s}</option>`).join('')}
        </select></div>
        <div class="form-group"><label>Note (optional)</label><textarea id="st-note" rows="2" placeholder="Reason for status change..."></textarea></div>
        <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px">Update Status</button>
      </form>
    `);
  }

  async function submitStatus(e, id) {
    e.preventDefault();
    try {
      await API.changeDeviceStatus(id, {
        status: document.getElementById('st-status').value,
        note: document.getElementById('st-note').value.trim()
      });
      Modal.close();
      Toast.show('Status updated', 'success');
      reload();
    } catch (err) { Toast.show(err.error || 'Failed to update status', 'error'); }
  }

  function confirmDelete(id) {
    if (confirm('Are you sure you want to permanently delete this device from inventory?')) {
      API.deleteDevice(id).then(() => {
        Modal.close();
        Toast.show('Device removed', 'success');
        reload();
      }).catch(err => Toast.show(err.error || 'Failed to delete', 'error'));
    }
  }

  function openImport() {
    Modal.open('Import Devices from CSV', `
      <div style="margin-bottom:12px">
        <p style="font-size:13px;color:var(--text2);margin:0 0 10px">Upload a CSV file with tablet inventory data. Required column: <strong>serial_number</strong>.</p>
        <button class="btn btn-ghost" onclick="InventoryPage.downloadTemplate()" style="font-size:12px"><i class="ti ti-download"></i> Download Template</button>
      </div>
      <div class="form-group">
        <input type="file" id="csv-file" accept=".csv" onchange="InventoryPage.previewCsv(this)">
      </div>
      <div id="csv-preview" style="display:none;margin-top:12px">
        <div style="font-size:12px;color:var(--text3);margin-bottom:6px"><span id="csv-count">0</span> devices found</div>
        <div style="max-height:200px;overflow:auto;border:1px solid var(--border);border-radius:6px">
          <table id="csv-table" style="font-size:11px;width:100%"></table>
        </div>
        <button class="btn btn-primary" onclick="InventoryPage.submitImport()" style="width:100%;margin-top:12px"><i class="ti ti-upload"></i> Import All</button>
      </div>
    `, '', true);
  }

  function downloadTemplate() {
    const csv = 'serial_number,asset_tag,form,stream,model,year_first_used,status,student_name,admission_no,last_checked,notes\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tablet_inventory_template.csv';
    a.click();
  }

  let _csvData = [];
  function previewCsv(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      _csvData = parseCsv(e.target.result);
      const preview = document.getElementById('csv-preview');
      const count = document.getElementById('csv-count');
      const table = document.getElementById('csv-table');
      if (!_csvData.length) { preview.style.display = 'none'; return; }
      preview.style.display = 'block';
      count.textContent = _csvData.length;
      const cols = ['serial_number','asset_tag','form','status','student_name'];
      table.innerHTML = `<thead><tr>${cols.map(c => `<th style="padding:4px 6px;text-align:left">${c}</th>`).join('')}</tr></thead>
        <tbody>${_csvData.slice(0, 10).map(r => `<tr>${cols.map(c => `<td style="padding:4px 6px">${esc(r[c]||'')}</td>`).join('')}</tr>`).join('')}
        ${_csvData.length > 10 ? `<tr><td colspan="${cols.length}" style="padding:6px;text-align:center;color:var(--text3)">...and ${_csvData.length - 10} more</td></tr>` : ''}
        </tbody>`;
    };
    reader.readAsText(file);
  }

  function parseCsv(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
    const colMap = {
      serial_number: headers.findIndex(h => h.includes('serial')),
      asset_tag: headers.findIndex(h => h.includes('asset') || h.includes('tag') || h.includes('device_no')),
      form: headers.findIndex(h => h === 'form' || h.includes('class')),
      stream: headers.findIndex(h => h.includes('stream')),
      model: headers.findIndex(h => h.includes('model') || h.includes('brand')),
      year_first_used: headers.findIndex(h => h.includes('year')),
      status: headers.findIndex(h => h.includes('status') || h.includes('condition')),
      student_name: headers.findIndex(h => h.includes('student') || h.includes('name')),
      admission_no: headers.findIndex(h => h.includes('admission') || h.includes('adm')),
      last_checked: headers.findIndex(h => h.includes('checked') || h.includes('date')),
      notes: headers.findIndex(h => h.includes('note') || h.includes('remark') || h.includes('comment')),
    };
    return lines.slice(1).filter(l => l.trim()).map(line => {
      const vals = splitCsvLine(line);
      const row = {};
      for (const [field, idx] of Object.entries(colMap)) {
        if (idx >= 0 && vals[idx]) row[field] = vals[idx].trim().replace(/^"|"$/g, '');
      }
      return row;
    }).filter(r => r.serial_number);
  }

  function splitCsvLine(line) {
    const result = []; let current = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
      else { current += ch; }
    }
    result.push(current);
    return result;
  }

  async function submitImport() {
    if (!_csvData.length) return;
    const data = { devices: _csvData };
    if (isAdmin() && filters.school_id) data.school_id = filters.school_id;
    try {
      const res = await API.bulkImportDevices(data);
      Modal.close();
      Toast.show(`Imported: ${res.created} new, ${res.updated} updated${res.errors?.length ? `, ${res.errors.length} errors` : ''}`, 'success');
      reload();
    } catch (err) { Toast.show(err.error || 'Import failed', 'error'); }
  }

  async function exportCsv() {
    try {
      const params = {};
      if (filters.school_id) params.school_id = filters.school_id;
      const blob = await API.exportInventoryCsv(params);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'tablet_inventory.csv';
      a.click();
      Toast.show('Export downloaded', 'success');
    } catch (err) { Toast.show('Export failed', 'error'); }
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  return {
    load, render, afterRender,
    openAdd, submitAdd, openEdit, submitEdit, openDetail,
    openStatusChange, submitStatus, confirmDelete,
    openImport, downloadTemplate, previewCsv, submitImport, exportCsv,
    filterStatus, filterForm, filterSchool, debounceSearch,
    onSchoolSelect, onStatusSelect, onFormSelect,
  };
})();
