/**
 * Team (Sub-Admins) Page — Manage field engineers
 */
const TeamPage = (() => {
  let team = [];
  const REGIONS = [
    'Arusha', 'Dar es Salaam', 'Dodoma', 'Geita', 'Iringa', 'Kagera', 'Katavi',
    'Kigoma', 'Kilimanjaro', 'Lindi', 'Manyara', 'Mara', 'Mbeya', 'Morogoro',
    'Mtwara', 'Mwanza', 'Njombe', 'Pemba Kaskazini', 'Pemba Kusini', 'Pwani',
    'Rukwa', 'Ruvuma', 'Shinyanga', 'Simiyu', 'Singida', 'Songwe', 'Tabora',
    'Tanga', 'Unguja Kaskazini', 'Unguja Kusini', 'Unguja Mjini Magharibi', 'Remote / HQ'
  ];

  function isAdmin() { const u = API.getUser(); return u && u.role === 'admin'; }

  async function load() {
    try { team = await API.getTeam(); } catch (e) { team = []; }
  }

  function render() {
    return `
    <div class="section-header">
      <div>
        <div class="section-title">Sub-Admins</div>
        <div class="section-sub">Field engineers · ${team.length} members</div>
      </div>
      <button onclick="TeamPage.openAdd()" style="padding:8px 16px;font-size:12px;background:rgba(79,124,255,.12);color:var(--accent);border:1px solid rgba(79,124,255,.25);border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><i class="ti ti-plus" style="font-size:13px"></i> Add Sub-Admin</button>
    </div>

    ${!team.length ? emptyState() : `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px">
      ${team.map(t => renderCard(t)).join('')}
    </div>`}`;
  }

  function renderCard(t) {
    const colors = { active: ['var(--green)', 'Active'], inactive: ['var(--red)', 'Inactive'], onsite: ['var(--amber)', 'On Site'] };
    const [statusColor, statusLabel] = colors[t.status] || ['var(--text3)', t.status || 'Active'];

    return `<div class="card reveal" style="padding:18px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div style="width:42px;height:42px;border-radius:50%;background:${t.color || 'var(--accent)'}20;color:${t.color || 'var(--accent)'};display:flex;align-items:center;justify-content:center;font-weight:600;font-size:14px;flex-shrink:0">${initials(t.full_name)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;color:var(--text1)">${esc(t.full_name)}</div>
          <div style="font-size:11px;color:var(--text3)">${esc(t.title || 'Field Engineer')}</div>
        </div>
        <span style="font-size:10px;padding:3px 8px;border-radius:4px;background:${statusColor}15;color:${statusColor};font-weight:500">${statusLabel}</span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
        <div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:20px;font-weight:600;color:var(--text1)">${t.school_count || 0}</div>
          <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Schools</div>
        </div>
        <div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:20px;font-weight:600;color:${(t.open_errors || 0) > 0 ? 'var(--amber)' : 'var(--green)'}">${t.open_errors || 0}</div>
          <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Open Issues</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:separate;border-spacing:0;background:var(--bg3);border-radius:8px;border:1px solid var(--border);overflow:hidden">
        <tr>
          <td style="padding:7px 10px"><span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--text3)"><i class="ti ti-at" style="font-size:11px;color:var(--accent)"></i>Email</span></td>
          <td style="padding:7px 10px;font-size:12px;font-weight:500;color:var(--text1)">${esc(t.email)}</td>
        </tr>
        <tr><td colspan="2" style="padding:0;height:1px;background:var(--border)"></td></tr>
        <tr>
          <td style="padding:7px 10px"><span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--text3)"><i class="ti ti-phone" style="font-size:11px;color:var(--green)"></i>Phone</span></td>
          <td style="padding:7px 10px;font-size:12px;font-weight:500;color:var(--text1)">${esc(t.phone || '—')}</td>
        </tr>
        <tr><td colspan="2" style="padding:0;height:1px;background:var(--border)"></td></tr>
        <tr>
          <td style="padding:7px 10px"><span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--text3)"><i class="ti ti-map-pin" style="font-size:11px;color:var(--teal)"></i>Zone</span></td>
          <td style="padding:7px 10px;font-size:12px;font-weight:500;color:var(--text1)">${esc(t.zone || '—')}</td>
        </tr>
      </table>

      <div style="display:flex;gap:8px;margin-top:14px;justify-content:space-between;flex-wrap:wrap">
        <button onclick="TeamPage.openEdit(${t.id})" style="padding:7px 14px;font-size:11px;background:rgba(79,124,255,.12);color:var(--accent);border:1px solid rgba(79,124,255,.25);border-radius:7px;cursor:pointer;display:inline-flex;align-items:center;gap:4px"><i class="ti ti-pencil" style="font-size:12px"></i> Edit</button>
        <button onclick="TeamPage.resetPassword(${t.id})" style="padding:7px 14px;font-size:11px;background:rgba(245,166,35,.08);color:var(--amber);border:1px solid rgba(245,166,35,.2);border-radius:7px;cursor:pointer;display:inline-flex;align-items:center;gap:4px"><i class="ti ti-key" style="font-size:12px"></i> Reset Pass</button>
        <button onclick="TeamPage.remove(${t.id})" style="padding:7px 14px;font-size:11px;background:rgba(255,82,99,.08);color:var(--red);border:1px solid rgba(255,82,99,.2);border-radius:7px;cursor:pointer;display:inline-flex;align-items:center;gap:4px"><i class="ti ti-trash" style="font-size:12px"></i> Remove</button>
      </div>
    </div>`;
  }

  function emptyState() {
    return `<div class="card reveal" style="padding:50px 20px;text-align:center">
      <i class="ti ti-users-group" style="font-size:36px;color:var(--text3);display:block;margin-bottom:10px"></i>
      <div style="font-size:14px;color:var(--text2);margin-bottom:4px">No sub-admins yet</div>
      <div style="font-size:12px;color:var(--text3)">Add field engineers to assign them schools and manage errors</div>
    </div>`;
  }

  function openAdd() {
    const body = formHtml();
    const footer = `
      <button onclick="Modal.close()" style="padding:8px 16px;font-size:12px;background:var(--bg3);color:var(--text2);border:1px solid var(--border);border-radius:8px;cursor:pointer">Cancel</button>
      <button id="team-submit" onclick="TeamPage.submitAdd()" style="padding:8px 16px;font-size:12px;background:rgba(79,124,255,.12);color:var(--accent);border:1px solid rgba(79,124,255,.25);border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><i class="ti ti-plus" style="font-size:12px"></i> Create</button>`;
    Modal.open('Add Sub-Admin', body, footer, true);
  }

  function openEdit(id) {
    const t = team.find(x => x.id === id);
    if (!t) return;
    const body = formHtml(t);
    const footer = `
      <button onclick="Modal.close()" style="padding:8px 16px;font-size:12px;background:var(--bg3);color:var(--text2);border:1px solid var(--border);border-radius:8px;cursor:pointer">Cancel</button>
      <button id="team-submit" onclick="TeamPage.submitEdit(${id})" style="padding:8px 16px;font-size:12px;background:rgba(79,124,255,.12);color:var(--accent);border:1px solid rgba(79,124,255,.25);border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><i class="ti ti-check" style="font-size:12px"></i> Save Changes</button>`;
    Modal.open('Edit Sub-Admin', body, footer, true);
  }

  function formHtml(t) {
    const isEdit = !!t;
    return `<div class="form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div class="form-group">
        <label>Full Name <span style="color:var(--red)">*</span></label>
        <input type="text" id="tm-name" placeholder="e.g. John Doe" value="${isEdit ? esc(t.full_name) : ''}">
      </div>
      <div class="form-group">
        <label>Username ${isEdit ? '' : '<span style="color:var(--red)">*</span>'}</label>
        <input type="text" id="tm-username" placeholder="e.g. jdoe" value="${isEdit ? esc(t.username || '') : ''}" ${isEdit ? 'disabled style="opacity:.6"' : ''}>
      </div>
      <div class="form-group">
        <label>Email <span style="color:var(--red)">*</span></label>
        <input type="email" id="tm-email" placeholder="e.g. john@example.com" value="${isEdit ? esc(t.email) : ''}">
      </div>
      <div class="form-group">
        <label>Phone</label>
        <input type="text" id="tm-phone" placeholder="+255..." value="${isEdit ? esc(t.phone || '') : ''}">
      </div>
      <div class="form-group">
        <label>Zone / Location</label>
        ${Dropdown.render('tm-zone', 'Select region...', REGIONS.map(z => ({ value: z, label: z })), { defaultValue: isEdit ? (t.zone || '') : '' })}
      </div>
      <div class="form-group">
        <label>Title</label>
        <input type="text" id="tm-title" placeholder="e.g. Field Engineer" value="${isEdit ? esc(t.title || '') : 'Field Engineer'}">
      </div>
      ${!isEdit ? `<div class="form-group" style="grid-column:1/-1">
        <label>Password</label>
        <input type="text" id="tm-password" placeholder="Leave blank for default (changeme123)">
        <div style="font-size:10px;color:var(--text3);margin-top:4px">Sub-admin should change this on first login</div>
      </div>` : ''}
    </div>`;
  }

  async function submitAdd() {
    const full_name = document.getElementById('tm-name').value.trim();
    const username = document.getElementById('tm-username').value.trim();
    const email = document.getElementById('tm-email').value.trim();
    const phone = document.getElementById('tm-phone').value.trim();
    const zone = Dropdown.getValue('tm-zone') || '';
    const title = document.getElementById('tm-title').value.trim();
    const password = document.getElementById('tm-password').value.trim();

    if (!full_name || !username || !email) { showToast('Name, username, and email are required'); return; }

    const btn = document.getElementById('team-submit');
    btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Creating...';

    try {
      await API.createTeamMember({ full_name, username, email, phone, zone, title, password: password || undefined });
      Modal.close();
      showToast('Sub-admin created successfully');
      await load();
      App.render();
    } catch (e) {
      showToast(e.error || 'Could not create sub-admin');
      btn.disabled = false; btn.innerHTML = '<i class="ti ti-plus" style="font-size:12px"></i> Create';
    }
  }

  async function submitEdit(id) {
    const full_name = document.getElementById('tm-name').value.trim();
    const email = document.getElementById('tm-email').value.trim();
    const phone = document.getElementById('tm-phone').value.trim();
    const zone = Dropdown.getValue('tm-zone') || '';
    const title = document.getElementById('tm-title').value.trim();

    if (!full_name || !email) { showToast('Name and email are required'); return; }

    const btn = document.getElementById('team-submit');
    btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Saving...';

    try {
      await API.updateTeamMember(id, { full_name, email, phone, zone, title });
      Modal.close();
      showToast('Sub-admin updated');
      await load();
      App.render();
    } catch (e) {
      showToast(e.error || 'Could not update sub-admin');
      btn.disabled = false; btn.innerHTML = '<i class="ti ti-check" style="font-size:12px"></i> Save Changes';
    }
  }

  function resetPassword(id) {
    const t = team.find(x => x.id === id);
    if (!t) return;
    const body = `<div style="display:flex;flex-direction:column;gap:14px">
      <div style="font-size:13px;color:var(--text2)">Reset password for <strong>${esc(t.full_name)}</strong></div>
      <div class="form-group">
        <label>New Password</label>
        <input type="text" id="tm-reset-pw" placeholder="Leave blank for default (changeme123)">
        <div style="font-size:10px;color:var(--text3);margin-top:4px">The sub-admin should change this on next login</div>
      </div>
    </div>`;
    const footer = `
      <button onclick="Modal.close()" style="padding:8px 16px;font-size:12px;background:var(--bg3);color:var(--text2);border:1px solid var(--border);border-radius:8px;cursor:pointer">Cancel</button>
      <button id="tm-reset-btn" onclick="TeamPage.doResetPassword(${id})" style="padding:8px 16px;font-size:12px;background:rgba(245,166,35,.1);color:var(--amber);border:1px solid rgba(245,166,35,.25);border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><i class="ti ti-key" style="font-size:12px"></i> Reset Password</button>`;
    Modal.open('Reset Password', body, footer);
  }

  async function doResetPassword(id) {
    const password = document.getElementById('tm-reset-pw').value.trim();
    const btn = document.getElementById('tm-reset-btn');
    btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Resetting...';
    try {
      const res = await API.resetTeamPassword(id, password || undefined);
      Modal.close();
      showToast(`Password reset to: ${res.password || 'changeme123'}`);
    } catch (e) {
      showToast(e.error || 'Could not reset password');
      btn.disabled = false; btn.innerHTML = '<i class="ti ti-key" style="font-size:12px"></i> Reset Password';
    }
  }

  async function remove(id) {
    const t = team.find(x => x.id === id);
    if (!t) return;
    const warn = (t.school_count || 0) > 0 ? `\n\nTheir ${t.school_count} assigned school(s) will become unassigned.` : '';
    if (!confirm(`Delete sub-admin "${t.full_name}"?${warn}\n\nThis cannot be undone.`)) return;
    try {
      await API.removeTeamMember(id);
      showToast('Sub-admin removed');
      await load();
      App.render();
    } catch (e) { showToast(e.error || 'Could not delete sub-admin'); }
  }

  function afterRender() {
    const main = document.querySelector('.main');
    if (main) main.querySelectorAll('.reveal').forEach(c => c.classList.add('visible'));
  }

  return { load, render, afterRender, openAdd, openEdit, submitAdd, submitEdit, resetPassword, doResetPassword, remove };
})();
