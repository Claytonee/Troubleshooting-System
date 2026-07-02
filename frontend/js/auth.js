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
    const roleLabel = user.role === 'admin' ? 'Administrator' : user.role === 'subadmin' ? 'Field Engineer' : 'School';

    $('user-display').textContent = name;
    $('user-role-display').textContent = roleLabel;
    $('topbar-avatar').textContent = ini;
    $('sidebar-user').textContent = name;

    const ddAvatar = document.getElementById('dd-avatar');
    const ddName = document.getElementById('dd-name');
    const ddEmail = document.getElementById('dd-email');
    if (ddAvatar) ddAvatar.textContent = ini;
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

  function showProfile() {
    closeProfileMenu();
    const user = API.getUser();
    if (!user) return;
    const roleLabel = user.role === 'admin' ? 'Administrator' : user.role === 'subadmin' ? 'Field Engineer' : 'School Staff';
    const body = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
        <div class="topbar-avatar" style="width:56px;height:56px;font-size:18px">${initials(user.full_name)}</div>
        <div>
          <div style="font-size:17px;font-weight:700">${esc(user.full_name)}</div>
          <div style="font-size:12px;color:var(--text3);margin-top:2px">${esc(roleLabel)}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:13px">
        <div style="background:var(--bg3);border-radius:8px;padding:12px">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Username</div>
          <div style="font-weight:500">${esc(user.username)}</div>
        </div>
        <div style="background:var(--bg3);border-radius:8px;padding:12px">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Email</div>
          <div style="font-weight:500">${esc(user.email || '—')}</div>
        </div>
        <div style="background:var(--bg3);border-radius:8px;padding:12px">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Phone</div>
          <div style="font-weight:500">${esc(user.phone || '—')}</div>
        </div>
        <div style="background:var(--bg3);border-radius:8px;padding:12px">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Zone</div>
          <div style="font-weight:500">${esc(user.zone || '—')}</div>
        </div>
      </div>`;
    const footer = `<button class="btn btn-secondary" onclick="Modal.close()">Close</button>`;
    Modal.open('My Profile', body, footer);
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

  return { init, showLogin, showApp, logout, checkSession, toggleProfileMenu, showProfile, showChangePassword, submitPasswordChange, switchRole, toggleRoleDrop, filterRoleDrop, selectRole, goRegister };
})();
