const LRSPage = (() => {
  let devices = [], stats = null, schools = [];
  let filters = { status: '', search: '' };

  async function load() {
    try {
      [devices, stats, schools] = await Promise.all([
        API.getLRS(),
        API.getLRSStats(),
        API.getSchools()
      ]);
    } catch (e) { devices = []; stats = null; schools = []; }
  }

  function render() {
    const total = +stats?.total || 0;
    const online = +stats?.online || 0;
    const offline = +stats?.offline || 0;
    const errorCount = +stats?.error_count || 0;
    const maintenance = +stats?.maintenance || 0;
    const syncIssues = +stats?.sync_issues || 0;
    const healthPct = total ? Math.round((online / total) * 100) : 0;

    const filtered = filterDevices();

    return `
  <div class="section-header">
    <div style="display:flex;align-items:center;gap:14px">
      <div style="width:38px;height:38px;border-radius:10px;background:rgba(54,217,204,.12);display:flex;align-items:center;justify-content:center"><i class="ti ti-server" style="font-size:20px;color:var(--teal)"></i></div>
      <div>
        <div class="section-title" style="margin:0">LRS Inventory</div>
        <div class="section-sub" style="margin:0">${total} devices · ${healthPct}% online</div>
      </div>
    </div>
    <div class="lrs-header-actions">
      <div class="lrs-header-stats">
        <div style="padding:4px 10px;border-radius:6px;background:rgba(45,217,138,.1);font-size:11px;font-weight:600;color:var(--green)">${online} <span style="font-weight:400;opacity:.7">Online</span></div>
        <div style="padding:4px 10px;border-radius:6px;background:rgba(255,82,99,.1);font-size:11px;font-weight:600;color:var(--red)">${offline} <span style="font-weight:400;opacity:.7">Offline</span></div>
        <div style="padding:4px 10px;border-radius:6px;background:rgba(245,166,35,.1);font-size:11px;font-weight:600;color:var(--amber)">${errorCount} <span style="font-weight:400;opacity:.7">Error</span></div>
        <div style="padding:4px 10px;border-radius:6px;background:rgba(155,125,255,.1);font-size:11px;font-weight:600;color:var(--purple)">${maintenance} <span style="font-weight:400;opacity:.7">Maint</span></div>
      </div>
      <button class="btn btn-primary" onclick="LRSPage.openAdd()"><i class="ti ti-plus"></i> Add LRS</button>
    </div>
  </div>

  <div class="lrs-toolbar">
    <div style="min-width:150px">${Dropdown.render('lrs-status', 'All Statuses', [
      {value:'',label:'All Statuses'},
      {value:'Online',label:'Online'},
      {value:'Offline',label:'Offline'},
      {value:'Syncing',label:'Syncing'},
      {value:'Error',label:'Error'},
      {value:'Maintenance',label:'Maintenance'}
    ], {defaultValue: filters.status, onSelect: "LRSPage.onStatusSelect()"})}</div>
    <div style="flex:1;position:relative;min-width:160px">
      <i class="ti ti-search" style="position:absolute;left:9px;top:50%;transform:translateY(-50%);font-size:13px;color:var(--text3)"></i>
      <input type="text" id="lrs-search" placeholder="Search IP, tag, school, hostname..." value="${filters.search}" onkeyup="LRSPage.debounceSearch(this.value)" style="width:100%;padding:7px 10px 7px 30px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text);font-size:12px">
    </div>
    <span style="font-size:11px;color:var(--text3);white-space:nowrap">${filtered.length} shown</span>
  </div>

  ${syncIssues > 0 ? `<div class="alert-banner" style="margin:14px 20px 0;padding:10px 14px;border-radius:8px;border:1px solid rgba(245,166,35,.3);background:rgba(245,166,35,.06);display:flex;align-items:center;gap:10px;font-size:12px;color:var(--amber)"><i class="ti ti-alert-triangle" style="font-size:16px"></i><span><strong>${syncIssues}</strong> device${syncIssues > 1 ? 's' : ''} with sync issues — records may not be reaching cloud</span></div>` : ''}

  <div class="lrs-grid">
    ${filtered.length ? filtered.map(d => deviceCard(d)).join('') : '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text3)"><i class="ti ti-server-off" style="font-size:40px;opacity:.4;display:block;margin-bottom:10px"></i>No LRS devices found</div>'}
  </div>`;
  }

  function filterDevices() {
    let list = devices;
    if (filters.status) list = list.filter(d => d.status === filters.status);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(d =>
        (d.ip_address || '').toLowerCase().includes(q) ||
        (d.asset_tag || '').toLowerCase().includes(q) ||
        (d.hostname || '').toLowerCase().includes(q) ||
        (d.school_name || '').toLowerCase().includes(q) ||
        (d.serial_number || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  function deviceCard(d) {
    const statusColors = { 'Online': 'green', 'Offline': 'red', 'Syncing': 'amber', 'Error': 'red', 'Maintenance': 'purple' };
    const syncColors = { 'Synced': 'green', 'Syncing': 'amber', 'Behind': 'amber', 'Failed': 'red' };
    const borderColor = `var(--${statusColors[d.status] || 'accent'})`;

    return `<div class="card reveal" onclick="LRSPage.openDetail(${d.id})" style="cursor:pointer;border-left:3px solid ${borderColor};padding:12px 14px;transition:all .15s;overflow:hidden" onmouseenter="this.style.background='var(--bg3)'" onmouseleave="this.style.background=''">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:8px;min-width:0">
          <i class="ti ti-server" style="font-size:16px;color:${borderColor};flex-shrink:0"></i>
          <div style="font-weight:600;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.school_name}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <span style="font-size:10px;padding:2px 7px;border-radius:4px;background:rgba(${statusColors[d.status] === 'green' ? '45,217,138' : statusColors[d.status] === 'red' ? '255,82,99' : statusColors[d.status] === 'amber' ? '245,166,35' : '155,125,255'},.12);color:var(--${statusColors[d.status] || 'accent'});font-weight:600">${d.status}</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:11px;color:var(--text3);margin-bottom:6px">
        <div><i class="ti ti-network" style="font-size:11px;margin-right:3px;color:var(--accent)"></i>${d.ip_address}${d.port && d.port !== 3000 ? ':' + d.port : ''}</div>
        <div><i class="ti ti-tag" style="font-size:11px;margin-right:3px;color:var(--amber)"></i>${d.asset_tag || '—'}</div>
        <div><i class="ti ti-refresh" style="font-size:11px;margin-right:3px;color:var(--${syncColors[d.sync_status] || 'text3'})"></i>${d.sync_status || 'Unknown'}${d.records_pending > 0 ? ` (${d.records_pending} pending)` : ''}</div>
        <div><i class="ti ti-clock" style="font-size:11px;margin-right:3px;color:var(--teal)"></i>${d.last_sync ? timeAgo(d.last_sync) : 'Never synced'}</div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:10px;color:var(--text3)">${d.hostname || ''} ${d.lrs_version ? '· v' + d.lrs_version : ''}</div>
        <button class="btn-icon" onclick="event.stopPropagation();LRSPage.openEdit(${d.id})" title="Edit" style="width:26px;height:26px;flex-shrink:0"><i class="ti ti-pencil" style="font-size:13px"></i></button>
      </div>
    </div>`;
  }

  function timeAgo(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }

  function afterRender() {
    document.querySelectorAll('#main .card.reveal').forEach(c => c.classList.add('visible'));
  }

  // --- Filters ---
  let searchTimeout;
  function debounceSearch(val) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { filters.search = val; App.render(); }, 300);
  }
  function onStatusSelect() {
    const sel = document.querySelector('#lrs-status-dropdown .dd-selected');
    filters.status = sel?.dataset?.value || '';
    App.render();
  }

  // --- Detail Modal ---
  async function openDetail(id) {
    try {
      const d = await API.getLRSDevice(id);
      const statusColors = { 'Online': 'green', 'Offline': 'red', 'Syncing': 'amber', 'Error': 'red', 'Maintenance': 'purple' };
      const sc = statusColors[d.status] || 'accent';

      const html = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="width:36px;height:36px;border-radius:8px;background:rgba(54,217,204,.12);display:flex;align-items:center;justify-content:center"><i class="ti ti-server" style="font-size:18px;color:var(--teal)"></i></div>
          <div>
            <div style="font-size:15px;font-weight:600;color:var(--text)">${d.school_name}</div>
            <span style="font-size:11px;padding:2px 8px;border-radius:4px;background:rgba(var(--${sc}-rgb,0),.12);color:var(--${sc});font-weight:600">${d.status}</span>
          </div>
        </div>

        <table style="width:100%;border-collapse:separate;border-spacing:0;background:var(--bg3);border-radius:10px;border:1px solid var(--border);overflow:hidden">
          <tr>
            <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-network" style="font-size:13px;color:var(--accent)"></i>IP Address</span></td>
            <td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text);font-family:var(--font-mono)">${d.ip_address}:${d.port || 3000}</td>
            <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-tag" style="font-size:13px;color:var(--amber)"></i>Asset Tag</span></td>
            <td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${d.asset_tag || '—'}</td>
          </tr>
          <tr><td colspan="4" style="padding:0;height:1px;background:var(--border)"></td></tr>
          <tr>
            <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-cpu" style="font-size:13px;color:var(--purple)"></i>Hostname</span></td>
            <td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text);font-family:var(--font-mono)">${d.hostname || '—'}</td>
            <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-barcode" style="font-size:13px;color:var(--teal)"></i>Serial</span></td>
            <td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text);font-family:var(--font-mono)">${d.serial_number || '—'}</td>
          </tr>
          <tr><td colspan="4" style="padding:0;height:1px;background:var(--border)"></td></tr>
          <tr>
            <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-device-desktop" style="font-size:13px;color:var(--green)"></i>Model</span></td>
            <td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${d.device_model || '—'}</td>
            <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-wifi" style="font-size:13px;color:var(--accent)"></i>Connection</span></td>
            <td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${d.connection_type || 'ethernet'}</td>
          </tr>
          <tr><td colspan="4" style="padding:0;height:1px;background:var(--border)"></td></tr>
          <tr>
            <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-brand-ubuntu" style="font-size:13px;color:var(--amber)"></i>OS</span></td>
            <td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${d.os_version || '—'}</td>
            <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-database" style="font-size:13px;color:var(--teal)"></i>LRS Version</span></td>
            <td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${d.lrs_version || '—'}</td>
          </tr>
          <tr><td colspan="4" style="padding:0;height:1px;background:var(--border)"></td></tr>
          <tr>
            <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-disc" style="font-size:13px;color:var(--purple)"></i>Storage</span></td>
            <td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${d.storage_gb ? d.storage_gb + ' GB' : '—'}</td>
            <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-cpu-2" style="font-size:13px;color:var(--green)"></i>RAM</span></td>
            <td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${d.ram_gb ? d.ram_gb + ' GB' : '—'}</td>
          </tr>
          <tr><td colspan="4" style="padding:0;height:1px;background:var(--border)"></td></tr>
          <tr>
            <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-plug" style="font-size:13px;color:var(--amber)"></i>Power</span></td>
            <td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${d.power_type || 'adapter'}</td>
            <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-network-off" style="font-size:13px;color:var(--red)"></i>MAC</span></td>
            <td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text);font-family:var(--font-mono)">${d.mac_address || '—'}</td>
          </tr>
          <tr><td colspan="4" style="padding:0;height:1px;background:var(--border)"></td></tr>
          <tr>
            <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-refresh" style="font-size:13px;color:var(--teal)"></i>Sync</span></td>
            <td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${d.sync_status || '—'}${d.records_pending > 0 ? ' (' + d.records_pending + ' pending)' : ''}</td>
            <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-clock" style="font-size:13px;color:var(--accent)"></i>Last Sync</span></td>
            <td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${d.last_sync ? new Date(d.last_sync).toLocaleString() : 'Never'}</td>
          </tr>
          <tr><td colspan="4" style="padding:0;height:1px;background:var(--border)"></td></tr>
          <tr>
            <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-calendar" style="font-size:13px;color:var(--green)"></i>Installed</span></td>
            <td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${d.installed_at || '—'}</td>
            <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-clock-hour-4" style="font-size:13px;color:var(--purple)"></i>Uptime</span></td>
            <td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${d.uptime_hours ? d.uptime_hours + 'h' : '—'}</td>
          </tr>
          ${d.notes ? `<tr><td colspan="4" style="padding:0;height:1px;background:var(--border)"></td></tr><tr><td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)"><i class="ti ti-notes" style="font-size:13px;color:var(--text3)"></i>Notes</span></td><td colspan="3" style="padding:9px 12px;font-size:13px;color:var(--text2)">${d.notes}</td></tr>` : ''}
        </table>

        ${d.history && d.history.length ? `
        <div style="margin-top:16px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);margin-bottom:8px;font-weight:600">History</div>
          <div style="max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:4px">
            ${d.history.map(h => `<div style="font-size:11px;padding:6px 10px;background:var(--bg2);border-radius:6px;border:1px solid var(--border);display:flex;align-items:center;gap:8px">
              <span style="color:var(--text3)">${new Date(h.created_at).toLocaleDateString()}</span>
              <span style="color:var(--text)">${h.action.replace('_', ' ')}</span>
              ${h.old_value && h.new_value ? `<span style="color:var(--red)">${h.old_value}</span><i class="ti ti-arrow-right" style="font-size:10px;color:var(--text3)"></i><span style="color:var(--green)">${h.new_value}</span>` : ''}
              ${h.actor_name ? `<span style="margin-left:auto;color:var(--text3)">${h.actor_name}</span>` : ''}
            </div>`).join('')}
          </div>
        </div>` : ''}

        <div style="display:flex;gap:8px;margin-top:14px;justify-content:space-between">
          <button onclick="LRSPage.openEdit(${d.id})" style="padding:8px 16px;font-size:12px;background:rgba(79,124,255,.12);color:var(--accent);border:1px solid rgba(79,124,255,.25);border-radius:8px;cursor:pointer">Edit</button>
          <div style="display:flex;gap:8px">
            <button onclick="LRSPage.openStatusChange(${d.id},'${d.status}')" style="padding:8px 16px;font-size:12px;background:rgba(54,217,204,.12);color:var(--teal);border:1px solid rgba(54,217,204,.25);border-radius:8px;cursor:pointer">Change Status</button>
            <button onclick="LRSPage.confirmDelete(${d.id},'${d.school_name}')" style="padding:8px 16px;font-size:12px;background:rgba(255,82,99,.08);color:var(--red);border:1px solid rgba(255,82,99,.2);border-radius:8px;cursor:pointer">Remove</button>
          </div>
        </div>`;

      Modal.open('LRS Device — ' + d.school_name, html, '', true);
    } catch (e) { Toast.show('Failed to load device details', 'error'); }
  }

  // --- Add/Edit Modal ---
  async function openEdit(id) {
    try {
      const d = await API.getLRSDevice(id);
      openForm(d);
    } catch (e) { Toast.show('Failed to load device', 'error'); }
  }

  function openAdd() {
    const schoolItems = schools.map(s => ({value: s.id, label: s.name, tag: s.zone || ''}));
    Modal.open('Add LRS Device', `
      <form id="lrs-form" onsubmit="LRSPage.submitForm(event,null)">
        <div class="form-group"><label>School *</label>${Dropdown.render('lrs-school', 'Select school...', schoolItems, {})}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group"><label>IP Address *</label><input name="ip_address" required placeholder="192.168.1.100"></div>
          <div class="form-group"><label>Port</label><input name="port" type="number" value="3000"></div>
          <div class="form-group"><label>Asset Tag</label><input name="asset_tag" placeholder="LRS-001"></div>
          <div class="form-group"><label>Device Model</label><input name="device_model" placeholder="Raspberry Pi 4B"></div>
        </div>
        <div class="form-group"><label>Notes</label><textarea name="notes" rows="2"></textarea></div>
        <div style="text-align:center;margin-top:14px"><button type="submit" style="padding:11px 28px;display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:600;border-radius:10px;border:1.5px solid rgba(54,217,204,.4);background:rgba(54,217,204,.08);color:var(--teal);cursor:pointer;transition:all .15s;font-family:var(--font)" onmouseenter="this.style.background='rgba(54,217,204,.15)'" onmouseleave="this.style.background='rgba(54,217,204,.08)'"><i class="ti ti-server-bolt"></i> Add LRS Device</button></div>
      </form>`, '', false);
  }

  function openForm(d) {
    const schoolItems = schools.map(s => ({value: s.id, label: s.name, tag: s.zone || ''}));

    Modal.open('Edit LRS Device', `
      <form id="lrs-form" onsubmit="LRSPage.submitForm(event,${d.id})">
        <div class="form-group"><label>School</label>${Dropdown.render('lrs-school', 'Select school...', schoolItems, {defaultValue: d.school_id})}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group"><label>IP Address *</label><input name="ip_address" required value="${d.ip_address || ''}" placeholder="192.168.1.100"></div>
          <div class="form-group"><label>Port</label><input name="port" type="number" value="${d.port || 3000}"></div>
          <div class="form-group"><label>Asset Tag</label><input name="asset_tag" value="${d.asset_tag || ''}" placeholder="LRS-001"></div>
          <div class="form-group"><label>Hostname</label><input name="hostname" value="${d.hostname || ''}" placeholder="lrs-schoolname"></div>
          <div class="form-group"><label>Serial Number</label><input name="serial_number" value="${d.serial_number || ''}"></div>
          <div class="form-group"><label>Device Model</label><input name="device_model" value="${d.device_model || ''}" placeholder="Raspberry Pi 4B"></div>
          <div class="form-group"><label>MAC Address</label><input name="mac_address" value="${d.mac_address || ''}" placeholder="00:11:22:33:44:55"></div>
          <div class="form-group"><label>Connection</label><select name="connection_type">
            <option value="ethernet" ${d.connection_type === 'ethernet' ? 'selected' : ''}>Ethernet</option>
            <option value="wifi" ${d.connection_type === 'wifi' ? 'selected' : ''}>WiFi</option>
            <option value="cellular" ${d.connection_type === 'cellular' ? 'selected' : ''}>Cellular</option></select></div>
          <div class="form-group"><label>Storage (GB)</label><input name="storage_gb" type="number" value="${d.storage_gb || ''}" placeholder="32"></div>
          <div class="form-group"><label>RAM (GB)</label><input name="ram_gb" type="number" value="${d.ram_gb || ''}" placeholder="4"></div>
          <div class="form-group"><label>Power Type</label><select name="power_type">
            <option value="adapter" ${d.power_type === 'adapter' ? 'selected' : ''}>AC Adapter</option>
            <option value="poe" ${d.power_type === 'poe' ? 'selected' : ''}>PoE</option>
            <option value="ups" ${d.power_type === 'ups' ? 'selected' : ''}>UPS/Battery</option>
            <option value="solar" ${d.power_type === 'solar' ? 'selected' : ''}>Solar</option></select></div>
          <div class="form-group"><label>Installed Date</label><input name="installed_at" type="date" value="${d.installed_at ? d.installed_at.split('T')[0] : ''}"></div>
          <div class="form-group"><label>OS Version</label><input name="os_version" value="${d.os_version || ''}" placeholder="Raspbian 11"></div>
          <div class="form-group"><label>LRS Version</label><input name="lrs_version" value="${d.lrs_version || ''}" placeholder="2.1.0"></div>
        </div>
        <div class="form-group"><label>Notes</label><textarea name="notes" rows="2">${d.notes || ''}</textarea></div>
        <div style="text-align:center;margin-top:14px"><button type="submit" style="padding:11px 28px;display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:600;border-radius:10px;border:1.5px solid rgba(79,124,255,.4);background:rgba(79,124,255,.08);color:var(--accent);cursor:pointer;transition:all .15s;font-family:var(--font)" onmouseenter="this.style.background='rgba(79,124,255,.15)'" onmouseleave="this.style.background='rgba(79,124,255,.08)'"><i class="ti ti-device-floppy"></i> Save Changes</button></div>
      </form>`, '', true);
  }

  async function submitForm(e, id) {
    if (e && e.preventDefault) e.preventDefault();
    const form = document.getElementById('lrs-form');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const fd = new FormData(form);
    const data = Object.fromEntries(fd);
    data.port = parseInt(data.port) || 3000;
    if (data.storage_gb) data.storage_gb = parseInt(data.storage_gb);
    if (data.ram_gb) data.ram_gb = parseInt(data.ram_gb);
    const schoolVal = document.getElementById('lrs-school')?.value;
    if (!schoolVal) { Toast.show('Please select a school', 'error'); return; }
    data.school_id = parseInt(schoolVal);

    try {
      if (id) {
        await API.updateLRS(id, data);
        Toast.show('LRS device updated', 'success');
      } else {
        await API.createLRS(data);
        Toast.show('LRS device added', 'success');
      }
      Modal.close();
      await load();
      App.render();
    } catch (e) {
      Toast.show(e.error || 'Failed to save', 'error');
    }
  }

  // --- Status Change ---
  function openStatusChange(id, current) {
    const statuses = ['Online', 'Offline', 'Syncing', 'Error', 'Maintenance'];
    const html = `<div style="display:flex;flex-direction:column;gap:10px">
      <label style="font-size:12px;color:var(--text3)">New Status</label>
      <select id="lrs-new-status" style="padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--text);font-size:13px">
        ${statuses.map(s => `<option value="${s}" ${s === current ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      <label style="font-size:12px;color:var(--text3)">Note (optional)</label>
      <input id="lrs-status-note" placeholder="Reason for change..." style="padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--text);font-size:13px">
    </div>`;
    Modal.open('Change LRS Status', html, `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button><button class="btn btn-primary" onclick="LRSPage.doStatusChange(${id})">Update</button>`, false);
  }

  async function doStatusChange(id) {
    const status = document.getElementById('lrs-new-status').value;
    const note = document.getElementById('lrs-status-note').value;
    try {
      await API.changeLRSStatus(id, { status, note });
      Toast.show('Status updated', 'success');
      Modal.close();
      await load();
      App.render();
    } catch (e) { Toast.show(e.error || 'Failed to update status', 'error'); }
  }

  // --- Delete ---
  function confirmDelete(id, name) {
    Modal.open('Remove LRS Device', `<p style="font-size:13px;color:var(--text2)">Are you sure you want to remove the LRS device at <strong>${name}</strong>? This action cannot be undone.</p>`, `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button><button class="btn" style="background:var(--red);color:#fff" onclick="LRSPage.doDelete(${id})">Remove</button>`, false);
  }

  async function doDelete(id) {
    try {
      await API.deleteLRS(id);
      Toast.show('LRS device removed', 'success');
      Modal.close();
      await load();
      App.render();
    } catch (e) { Toast.show(e.error || 'Failed to remove', 'error'); }
  }

  return { load, render, afterRender, openAdd, openEdit, openDetail, openForm, submitForm, openStatusChange, doStatusChange, confirmDelete, doDelete, debounceSearch, onStatusSelect };
})();
