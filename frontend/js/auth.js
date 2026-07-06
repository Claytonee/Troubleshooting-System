/**
 * Authentication Module
 * Handles login, logout, session management, profile
 */
const Auth = (() => {
  function showLogin() {
    $('app-container').style.display = 'none';
    const regPage = document.getElementById('register-page');
    if (regPage) regPage.style.display = 'none';
    $('login-page').style.display = 'flex';
    $('login-error').classList.remove('show');
    closeProfileMenu();
  }

  function showApp() {
    $('login-page').style.display = 'none';
    $('app-container').style.display = 'grid';
    updateUserDisplay();
  }

  function updateUserDisplay() {
    const user = API.getUser();
    if (!user) return;
    const name = user.full_name || user.username;
    const ini = initials(name);
    const roleLabel = user.role === 'admin' ? 'Administrator' : user.role === 'subadmin' ? 'Field Engineer' : user.role === 'teacher' ? 'Teacher' : 'School';

    $('user-display').textContent = name;
    $('user-role-display').textContent = roleLabel;

    // Topbar avatar — show photo if available
    const tbAvatar = $('topbar-avatar');
    if (tbAvatar) {
      if (user.avatar_url) {
        tbAvatar.innerHTML = '';
        tbAvatar.style.backgroundImage = `url(${user.avatar_url})`;
        tbAvatar.style.backgroundSize = 'cover';
        tbAvatar.style.backgroundPosition = 'center';
      } else {
        tbAvatar.textContent = ini;
        tbAvatar.style.backgroundImage = '';
      }
    }

    const sidebarUser = document.getElementById('sidebar-user');
    if (sidebarUser) sidebarUser.textContent = name;
    const sidebarRole = document.getElementById('sidebar-role');
    if (sidebarRole) sidebarRole.textContent = roleLabel;
    const sidebarAvatar = document.getElementById('sidebar-avatar');
    if (sidebarAvatar) {
      if (user.avatar_url) {
        sidebarAvatar.innerHTML = '';
        sidebarAvatar.style.backgroundImage = `url(${user.avatar_url})`;
        sidebarAvatar.style.backgroundSize = 'cover';
        sidebarAvatar.style.backgroundPosition = 'center';
      } else {
        sidebarAvatar.textContent = ini;
        sidebarAvatar.style.backgroundImage = '';
      }
    }

    const ddAvatar = document.getElementById('dd-avatar');
    const ddName = document.getElementById('dd-name');
    const ddEmail = document.getElementById('dd-email');
    if (ddAvatar) {
      if (user.avatar_url) {
        ddAvatar.innerHTML = '';
        ddAvatar.style.backgroundImage = `url(${user.avatar_url})`;
        ddAvatar.style.backgroundSize = 'cover';
        ddAvatar.style.backgroundPosition = 'center';
      } else {
        ddAvatar.textContent = ini;
        ddAvatar.style.backgroundImage = '';
      }
    }
    if (ddName) ddName.textContent = name;
    if (ddEmail) ddEmail.textContent = user.email || '—';
    const ddRole = document.getElementById('dd-role-badge');
    if (ddRole) ddRole.textContent = roleLabel;

    populateRoleSwitch();
  }

  async function populateRoleSwitch() {
    const list = document.getElementById('role-select-list');
    if (!list) return;
    const user = API.getUser();
    if (!user || user.role !== 'admin') {
      const sw = document.getElementById('role-switch');
      if (sw) sw.style.display = 'none';
      return;
    }
    try {
      const team = await API.getTeam();
      let html = `<div class="reg-dropdown-item" data-value="admin::" onclick="Auth.selectRole('admin::','System Admin (all)')"><span class="reg-dropdown-name">System Admin (all)</span><span class="reg-dropdown-zone">Admin</span></div>`;
      if (team && team.length) {
        team.forEach(t => { html += `<div class="reg-dropdown-item" data-value="subadmin::${t.id}" onclick="Auth.selectRole('subadmin::${t.id}','${esc(t.full_name)}')"><span class="reg-dropdown-name">${esc(t.full_name)}</span><span class="reg-dropdown-zone">${esc(t.zone || 'Sub-Admin')}</span></div>`; });
      }
      list.innerHTML = html;
    } catch (e) {
      list.innerHTML = `<div class="reg-dropdown-item" data-value="admin::" onclick="Auth.selectRole('admin::','System Admin (all)')"><span class="reg-dropdown-name">System Admin (all)</span></div>`;
    }
  }

  function toggleRoleDrop(e) {
    e.stopPropagation();
    const dd = document.getElementById('role-select-dd');
    if (!dd) return;
    const isOpen = dd.style.display !== 'none';
    dd.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      const input = dd.querySelector('input[type="text"]');
      if (input) { input.value = ''; filterRoleDrop(''); input.focus(); }
      setTimeout(() => {
        const close = (ev) => {
          if (!dd.contains(ev.target) && ev.target.id !== 'role-select-trigger') {
            dd.style.display = 'none';
            document.removeEventListener('click', close);
          }
        };
        document.addEventListener('click', close);
      }, 0);
    }
  }

  function filterRoleDrop(q) {
    const list = document.getElementById('role-select-list');
    if (!list) return;
    const query = q.toLowerCase();
    list.querySelectorAll('.reg-dropdown-item').forEach(item => {
      item.style.display = item.textContent.toLowerCase().includes(query) ? 'flex' : 'none';
    });
  }

  function selectRole(val, label) {
    const text = document.getElementById('role-select-text');
    if (text) text.textContent = label;
    document.getElementById('role-select-dd').style.display = 'none';
    switchRole(val);
  }

  function switchRole(val) {
    App.loadAndRender();
  }

  function toggleProfileMenu() {
    const dd = $('profile-dropdown');
    const isOpen = dd.classList.contains('open');
    if (isOpen) {
      closeProfileMenu();
    } else {
      dd.classList.add('open');
      setTimeout(() => document.addEventListener('click', outsideClickHandler), 10);
    }
  }

  function closeProfileMenu() {
    const dd = document.getElementById('profile-dropdown');
    if (dd) dd.classList.remove('open');
    document.removeEventListener('click', outsideClickHandler);
  }

  function outsideClickHandler(e) {
    const profile = document.getElementById('topbar-profile');
    const dd = document.getElementById('profile-dropdown');
    if (profile && !profile.contains(e.target) && dd && !dd.contains(e.target)) {
      closeProfileMenu();
    }
  }

  async function showProfile() {
    closeProfileMenu();
    let user = API.getUser();
    if (!user) return;
    try { user = await API.getProfile(); API.setUser(user); } catch (e) { /* use cached */ }
    _renderProfileModal(user, false);
  }

  function _roleLabel(role) {
    return role === 'admin' ? 'Administrator' : role === 'subadmin' ? 'Field Engineer' : role === 'teacher' ? 'Teacher' : 'School Staff';
  }

  function _avatarHtml(user, size = 64, editable = false) {
    const ini = initials(user.full_name || user.username);
    const img = user.avatar_url
      ? `<img src="${esc(user.avatar_url)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;display:block;margin:${editable ? '0' : '0 auto'}">`
      : `<div class="topbar-avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size*0.3)}px;flex-shrink:0;${editable ? '' : 'margin:0 auto'}">${ini}</div>`;
    if (!editable) return img;
    return `<div style="position:relative;width:${size}px;height:${size}px;flex-shrink:0;cursor:pointer" onclick="document.getElementById('avatar-file-input').click()">
      ${img}
      <div style="position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s" class="avatar-hover-overlay">
        <i class="ti ti-camera" style="font-size:18px;color:#fff"></i>
      </div>
      <input type="file" id="avatar-file-input" accept="image/*" style="display:none" onchange="Auth._onAvatarFile(this)">
    </div>`;
  }

  function _renderProfileModal(user, editMode) {
    const rl = _roleLabel(user.role);
    const memberSince = user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

    const viewBody = `
      <div style="text-align:center;padding-bottom:16px;border-bottom:1px solid var(--border);margin-bottom:16px">
        ${_avatarHtml(user, 64, false)}
        <div style="font-size:16px;font-weight:700;margin-top:10px">${esc(user.full_name)}</div>
        <div style="font-size:12px;color:var(--text3);margin-top:2px">${esc(user.title || rl)}</div>
        <div style="margin-top:8px;display:inline-flex;gap:6px">
          <span class="pd-role-badge" style="font-size:10px;padding:3px 8px">${rl}</span>
          ${user.zone ? `<span style="font-size:10px;padding:3px 8px;border-radius:20px;background:rgba(54,217,204,0.12);color:var(--teal);border:1px solid rgba(54,217,204,0.25)">${esc(user.zone)}</span>` : ''}
        </div>
      </div>
      ${user.bio ? `<div style="background:var(--bg3);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--text2);line-height:1.5;margin-bottom:12px;border:1px solid var(--border)">${esc(user.bio)}</div>` : ''}
      <table style="width:100%;border-collapse:separate;border-spacing:0;background:var(--bg3);border-radius:10px;border:1px solid var(--border);overflow:hidden">
        <tbody>
          ${_infoRow('ti-at','Email', user.email || '—', 'var(--accent)')}
          <tr><td colspan="2" style="padding:0;height:1px;background:var(--border)"></td></tr>
          ${_infoRow('ti-phone','Phone', user.phone || '—', 'var(--green)')}
          <tr><td colspan="2" style="padding:0;height:1px;background:var(--border)"></td></tr>
          ${_infoRow('ti-id-badge','Username', user.username, 'var(--purple)')}
          <tr><td colspan="2" style="padding:0;height:1px;background:var(--border)"></td></tr>
          ${_infoRow('ti-calendar','Member since', memberSince, 'var(--amber)')}
        </tbody>
      </table>`;

    const editBody = `
      <div style="display:flex;align-items:center;gap:14px;padding-bottom:14px;border-bottom:1px solid var(--border);margin-bottom:14px">
        ${_avatarHtml(user, 56, true)}
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--text)">Profile Photo</div>
          <div style="font-size:11px;color:var(--text3)">Click photo to change · max 5MB</div>
          <div id="avatar-upload-status" style="font-size:11px;margin-top:3px"></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group" style="margin:0">
          <label>Full Name *</label>
          <input type="text" id="pf-fullname" value="${esc(user.full_name)}" placeholder="Your full name">
        </div>
        <div class="form-group" style="margin:0">
          <label>Email *</label>
          <input type="email" id="pf-email" value="${esc(user.email || '')}" placeholder="your@email.com">
        </div>
        <div class="form-group" style="margin:0">
          <label>Phone</label>
          <input type="text" id="pf-phone" value="${esc(user.phone || '')}" placeholder="+255 700 000 000">
        </div>
        <div class="form-group" style="margin:0">
          <label>Job Title</label>
          <input type="text" id="pf-title" value="${esc(user.title || '')}" placeholder="e.g. IT Coordinator">
        </div>
        <div class="form-group" style="margin:0;grid-column:1/-1">
          <label>Zone / Region</label>
          <input type="text" id="pf-zone" value="${esc(user.zone || '')}" placeholder="e.g. Dar es Salaam">
        </div>
        <div class="form-group" style="margin:0;grid-column:1/-1">
          <label>Bio</label>
          <textarea id="pf-bio" rows="2" placeholder="Short description about yourself..." style="resize:vertical">${esc(user.bio || '')}</textarea>
        </div>
      </div>`;

    const viewFooter = `
      <div style="display:flex;gap:8px;width:100%">
        <button class="btn btn-secondary" onclick="Modal.close()">Close</button>
        <div style="flex:1"></div>
        <button class="btn btn-secondary" onclick="Auth.showChangePassword()"><i class="ti ti-lock"></i> Password</button>
        <button class="btn btn-primary" onclick="Auth._switchToEditProfile()"><i class="ti ti-pencil"></i> Edit</button>
      </div>`;

    const editFooter = `
      <div style="display:flex;gap:8px;width:100%">
        <button class="btn btn-secondary" onclick="Auth.showProfile()">Cancel</button>
        <div style="flex:1"></div>
        <button class="btn btn-primary" id="pf-save-btn" onclick="Auth._saveProfile()"><i class="ti ti-check"></i> Save</button>
      </div>`;

    Modal.open('My Profile', editMode ? editBody : viewBody, editMode ? editFooter : viewFooter);

    if (editMode) {
      document.querySelectorAll('.avatar-hover-overlay').forEach(el => {
        el.closest('div[onclick]').addEventListener('mouseenter', () => el.style.opacity = '1');
        el.closest('div[onclick]').addEventListener('mouseleave', () => el.style.opacity = '0');
      });
    }
  }

  function _infoRow(icon, label, value, color) {
    return `<tr>
      <td style="padding:9px 12px;white-space:nowrap">
        <span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)">
          <i class="ti ${icon}" style="font-size:13px;color:${color}"></i>${label}
        </span>
      </td>
      <td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">${esc(String(value))}</td>
    </tr>`;
  }

  function _switchToEditProfile() {
    const user = API.getUser();
    if (user) _renderProfileModal(user, true);
  }

  async function _onAvatarFile(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('File too large — max 5MB'); return; }
    if (!file.type.startsWith('image/')) { showToast('Only image files allowed'); return; }
    const status = document.getElementById('avatar-upload-status');
    if (status) status.innerHTML = '<span style="color:var(--teal)"><i class="ti ti-loader" style="animation:spin 1s linear infinite"></i> Uploading…</span>';
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await API.uploadAvatar(fd);
      const user = API.getUser();
      user.avatar_url = res.avatar_url;
      API.setUser(user);
      updateUserDisplay();
      if (status) status.innerHTML = '<span style="color:var(--green)"><i class="ti ti-check"></i> Photo updated!</span>';
      const wrap = document.querySelector('[onclick*="avatar-file-input"]');
      if (wrap) {
        const img = wrap.querySelector('img');
        if (img) { img.src = res.avatar_url; }
        else {
          const av = wrap.querySelector('.topbar-avatar');
          if (av) { av.outerHTML = `<img src="${res.avatar_url}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;display:block">`; }
        }
      }
    } catch (e) {
      const msg = e && e.error ? e.error : 'Upload failed — check connection';
      if (status) status.innerHTML = `<span style="color:var(--red)">${esc(msg)}</span>`;
    }
  }

  async function _saveProfile() {
    const btn = document.getElementById('pf-save-btn');
    const full_name = document.getElementById('pf-fullname')?.value.trim();
    const email = document.getElementById('pf-email')?.value.trim();
    const phone = document.getElementById('pf-phone')?.value.trim();
    const title = document.getElementById('pf-title')?.value.trim();
    const zone = document.getElementById('pf-zone')?.value.trim();
    const bio = document.getElementById('pf-bio')?.value.trim();

    if (!full_name) { showToast('Full name is required'); return; }
    if (!email) { showToast('Email is required'); return; }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Saving…'; }
    try {
      const updated = await API.updateProfile({ full_name, email, phone, title, zone, bio });
      API.setUser(updated);
      updateUserDisplay();
      showToast('Profile updated successfully');
      _renderProfileModal(updated, false);
    } catch (e) {
      showToast(e.error || 'Failed to save profile');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Save Changes'; }
    }
  }

  function showChangePassword() {
    closeProfileMenu();
    const body = `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="form-group">
          <label>Current Password</label>
          <input type="password" id="cp-current" placeholder="Enter current password">
        </div>
        <div class="form-group">
          <label>New Password</label>
          <input type="password" id="cp-new" placeholder="At least 6 characters">
        </div>
        <div class="form-group">
          <label>Confirm New Password</label>
          <input type="password" id="cp-confirm" placeholder="Repeat new password">
        </div>
      </div>`;
    const footer = `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="Auth.submitPasswordChange()"><i class="ti ti-check"></i> Update Password</button>`;
    Modal.open('Change Password', body, footer);
  }

  async function submitPasswordChange() {
    const current = document.getElementById('cp-current').value;
    const newPw = document.getElementById('cp-new').value;
    const confirm = document.getElementById('cp-confirm').value;

    if (!current || !newPw) { showToast('Please fill in all fields'); return; }
    if (newPw.length < 6) { showToast('Password must be at least 6 characters'); return; }
    if (newPw !== confirm) { showToast('Passwords do not match'); return; }

    try {
      await API.changePassword({ current_password: current, new_password: newPw });
      Modal.close();
      showToast('Password changed successfully');
    } catch (e) {
      showToast(e.error || 'Failed to change password');
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    const username = $('login-username').value.trim();
    const password = $('login-password').value;
    const btn = $('login-btn');
    const errorEl = $('login-error');

    if (!username || !password) {
      errorEl.textContent = 'Please enter username and password.';
      errorEl.classList.add('show');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader"></i> Signing in...';
    errorEl.classList.remove('show');

    try {
      const data = await API.login(username, password);
      API.setToken(data.token);
      API.setUser(data.user);
      showApp();
      App.init();
    } catch (err) {
      if (err.error === 'pending_approval' || err.error === 'registration_rejected') {
        RegisterPage.showStatus(err.error, err.request_id, err.email, err.rejection_reason);
        $('login-page').style.display = 'none';
        $('app-container').style.display = 'none';
        $('register-page').style.display = 'flex';
        $('register-content').innerHTML = RegisterPage.render();
      } else if (err.error === 'teacher_pending' || err.error === 'teacher_rejected') {
        TeacherRegisterPage.showStatus(err.error, err.user_id, err.email, err.rejection_reason);
        $('login-page').style.display = 'none';
        $('app-container').style.display = 'none';
        $('register-page').style.display = 'flex';
        $('register-content').innerHTML = TeacherRegisterPage.render();
      } else {
        errorEl.textContent = err.error || 'Login failed. Check your credentials.';
        errorEl.classList.add('show');
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-login"></i> Sign In';
    }
  }

  function logout() {
    closeProfileMenu();
    API.clearToken();
    API.clearUser();
    showLogin();
  }

  function checkSession() {
    if (API.isLoggedIn()) {
      showApp();
      return true;
    }
    showLogin();
    return false;
  }

  function init() {
    $('login-form').addEventListener('submit', handleLogin);
    window.addEventListener('auth:expired', () => {
      const regPage = document.getElementById('register-page');
      if (regPage && regPage.style.display !== 'none') return;
      const loginPage = document.getElementById('login-page');
      if (loginPage && loginPage.style.display !== 'none') return;
      showToast('Session expired. Please login again.');
      showLogin();
    });
  }

  async function goRegister() {
    API.clearToken();
    API.clearUser();
    $('login-page').style.display = 'none';
    $('app-container').style.display = 'none';
    $('register-page').style.display = 'flex';
    await RegisterPage.load();
    $('register-content').innerHTML = RegisterPage.render();
  }

  return { init, showLogin, showApp, logout, checkSession, toggleProfileMenu, showProfile, showChangePassword, submitPasswordChange, switchRole, toggleRoleDrop, filterRoleDrop, selectRole, goRegister, _switchToEditProfile, _saveProfile, _onAvatarFile };
})();
