/**
 * Authentication Module
 * Handles login, logout, session management, profile
 */
const Auth = (() => {
  function showLogin() {
    $('app-container').style.display = 'none';
    const regPage = document.getElementById('register-page');
    if (regPage) regPage.style.display = 'none';
    const recoveryPage = document.getElementById('recovery-page');
    if (recoveryPage) recoveryPage.style.display = 'none';
    $('login-page').style.display = 'flex';
    $('login-error').classList.remove('show');
    closeProfileMenu();
  }

  function showApp() {
    $('login-page').style.display = 'none';
    const recoveryPage = document.getElementById('recovery-page');
    if (recoveryPage) recoveryPage.style.display = 'none';
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
          <input type="password" id="cp-new" placeholder="At least 8 characters">
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
    if (newPw.length < 8) { showToast('Password must be at least 8 characters'); return; }
    if (newPw !== confirm) { showToast('Passwords do not match'); return; }

    try {
      const res = await API.changePassword({ current_password: current, new_password: newPw });
      // The server ended every other session (SEC-005) and issued this device a new token.
      if (res && res.token) API.setToken(res.token);
      Modal.close();
      showToast('Password changed — your other devices have been signed out', 4500);
    } catch (e) {
      showToast(e.error || 'Failed to change password');
    }
  }

  // Forced first-login password change: the account was seeded with a default
  // password (must_change_password = 1). The modal cannot be dismissed until a
  // new password is set; the current password is prefilled from the login form.
  function showForcedPasswordChange(currentPw) {
    const body = `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="font-size:13px;color:var(--text2);background:rgba(245,166,35,.1);border:1px solid rgba(245,166,35,.25);border-radius:8px;padding:10px 12px">
          <i class="ti ti-shield-lock" style="color:var(--amber);margin-right:6px"></i>
          For security you must set a new password before continuing.
        </div>
        <div class="form-group">
          <label>Current Password</label>
          <input type="password" id="fp-current" value="${esc(currentPw || '')}" placeholder="Enter current password">
        </div>
        <div class="form-group">
          <label>New Password</label>
          <input type="password" id="fp-new" placeholder="At least 8 characters">
        </div>
        <div class="form-group">
          <label>Confirm New Password</label>
          <input type="password" id="fp-confirm" placeholder="Repeat new password">
        </div>
      </div>`;
    const footer = `
      <button class="btn btn-primary" onclick="Auth.submitForcedPasswordChange()"><i class="ti ti-check"></i> Set Password &amp; Continue</button>`;
    Modal.open('Set a New Password', body, footer);
    Modal.lock();
  }

  async function submitForcedPasswordChange() {
    const current = document.getElementById('fp-current').value;
    const newPw = document.getElementById('fp-new').value;
    const confirm = document.getElementById('fp-confirm').value;

    if (!current || !newPw) { showToast('Please fill in all fields'); return; }
    if (newPw.length < 8) { showToast('Password must be at least 8 characters'); return; }
    if (newPw !== confirm) { showToast('Passwords do not match'); return; }

    try {
      const res = await API.changePassword({ current_password: current, new_password: newPw });
      if (res && res.token) API.setToken(res.token);
      const user = API.getUser();
      if (user) { user.must_change_password = false; API.setUser(user); }
      Modal.unlock();
      Modal.close();
      showToast('Password updated');
      showApp();
      App.init();
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
      // Two-step sign-in on: the password earned a ticket, not a session (SEC-007).
      if (data.mfa_required) { showMfaStep(data.mfa_ticket, password); return; }
      completeSignIn(data, password);
    } catch (err) {
      if (err.error === 'pending_approval' || err.error === 'registration_rejected') {
        RegisterPage.showStatus(err.error, err.request_id, err.email, err.rejection_reason);
        $('login-page').style.display = 'none';
        $('app-container').style.display = 'none';
        $('register-page').style.display = 'flex';
        $('register-content').innerHTML = RegisterPage.render();
    PasswordField.enhanceAll($('register-content'));
      } else if (err.error === 'teacher_pending' || err.error === 'teacher_rejected') {
        TeacherRegisterPage.showStatus(err.error, err.user_id, err.email, err.rejection_reason, err.status_token);
        $('login-page').style.display = 'none';
        $('app-container').style.display = 'none';
        $('register-page').style.display = 'flex';
        $('register-content').innerHTML = TeacherRegisterPage.render();
        PasswordField.enhanceAll($('register-content'));
      } else {
        errorEl.textContent = err.error || 'Login failed. Check your credentials.';
        errorEl.classList.add('show');
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-login"></i> Sign In';
    }
  }

  function recoveryFrame(content) {
    return `<div class="login-box recovery-box">
      <div class="recovery-mark" aria-hidden="true"><i class="ti ti-shield-lock"></i></div>
      ${content}
      <div class="recovery-trust"><i class="ti ti-lock-check"></i><span>The reset link works once, expires after 15 minutes, and never disables two-step sign-in.</span></div>
    </div>`;
  }

  function openRecoveryPage(html) {
    $('login-page').style.display = 'none';
    $('app-container').style.display = 'none';
    const regPage = document.getElementById('register-page');
    if (regPage) regPage.style.display = 'none';
    const page = $('recovery-page');
    page.style.display = 'flex';
    $('recovery-content').innerHTML = recoveryFrame(html);
    PasswordField.enhanceAll($('recovery-content'));
  }

  function bindRecoveryBack() {
    const back = $('recovery-back');
    if (back) back.addEventListener('click', backToLogin);
  }

  function showRecoveryRequest(updateHash = true) {
    if (updateHash && window.location.hash !== '#forgot-password') window.location.hash = 'forgot-password';
    openRecoveryPage(`
      <div class="recovery-kicker">Platform Admin recovery</div>
      <h1 class="recovery-title">Reset your password safely</h1>
      <p class="recovery-copy">Enter the username or email already registered to your Platform Admin account. We will send a private reset link if the account is eligible.</p>
      <div class="login-error" id="recovery-error" role="alert"></div>
      <form id="recovery-request-form">
        <div class="form-group recovery-field"><label for="recovery-identifier">Username or email</label>
          <input id="recovery-identifier" type="text" autocomplete="username" maxlength="255" required placeholder="Platform Admin username or email">
        </div>
        <button class="btn btn-primary recovery-primary" type="submit" id="recovery-request-btn"><i class="ti ti-mail-forward"></i> Send recovery link</button>
      </form>
      <button type="button" class="recovery-back" id="recovery-back"><i class="ti ti-arrow-left"></i> Back to sign in</button>
      <div class="recovery-fallback"><i class="ti ti-server-cog"></i><div><strong>No recovery email?</strong><span>Use the protected hosting-terminal recovery procedure. A public page can never reset an administrator without proof of ownership.</span></div></div>`);
    $('recovery-request-form').addEventListener('submit', submitRecoveryRequest);
    bindRecoveryBack();
    $('recovery-identifier').focus();
  }

  async function submitRecoveryRequest(e) {
    e.preventDefault();
    const identifier = $('recovery-identifier').value.trim();
    const error = $('recovery-error');
    const button = $('recovery-request-btn');
    error.classList.remove('show');
    if (identifier.length < 3) {
      error.textContent = 'Enter your Platform Admin username or email.';
      error.classList.add('show');
      return;
    }
    button.disabled = true;
    button.innerHTML = '<i class="ti ti-loader-2 spin"></i> Sending…';
    try {
      await API.requestPasswordRecovery(identifier);
      openRecoveryPage(`
        <div class="recovery-status success"><i class="ti ti-mail-check"></i></div>
        <div class="recovery-kicker">Request received</div>
        <h1 class="recovery-title">Check your administrator email</h1>
        <p class="recovery-copy">If this is an active Platform Admin account and email recovery is available, a link has been sent. It expires in 15 minutes.</p>
        <div class="recovery-fallback"><i class="ti ti-info-circle"></i><div><strong>Nothing after five minutes?</strong><span>Check spam, then use the protected hosting-terminal recovery procedure. For privacy, this page never confirms whether an account exists.</span></div></div>
        <button type="button" class="recovery-back" id="recovery-back"><i class="ti ti-arrow-left"></i> Back to sign in</button>`);
      bindRecoveryBack();
    } catch (err) {
      error.textContent = err.error || 'Recovery is temporarily unavailable. Use the protected hosting recovery procedure.';
      error.classList.add('show');
      button.disabled = false;
      button.innerHTML = '<i class="ti ti-mail-forward"></i> Send recovery link';
    }
  }

  function showRecoveryReset(token) {
    openRecoveryPage(`
      <div class="recovery-kicker">Verified recovery link</div>
      <h1 class="recovery-title">Choose a new password</h1>
      <p class="recovery-copy">This changes only your password. Your authenticator and recovery codes remain active.</p>
      <div class="login-error" id="recovery-error" role="alert"></div>
      <form id="recovery-reset-form">
        <div class="form-group recovery-field"><label for="recovery-password">New password</label>
          <input id="recovery-password" type="password" autocomplete="new-password" minlength="8" maxlength="1024" required placeholder="At least 8 characters">
        </div>
        <div class="form-group recovery-field"><label for="recovery-confirm">Confirm new password</label>
          <input id="recovery-confirm" type="password" autocomplete="new-password" minlength="8" maxlength="1024" required placeholder="Type it again">
        </div>
        <button class="btn btn-primary recovery-primary" type="submit" id="recovery-reset-btn"><i class="ti ti-key"></i> Set new password</button>
      </form>
      <button type="button" class="recovery-back" id="recovery-back"><i class="ti ti-arrow-left"></i> Cancel and return to sign in</button>`);
    $('recovery-reset-form').addEventListener('submit', e => submitRecoveryReset(e, token));
    bindRecoveryBack();
    $('recovery-password').focus();
  }

  async function submitRecoveryReset(e, token) {
    e.preventDefault();
    const password = $('recovery-password').value;
    const confirmation = $('recovery-confirm').value;
    const error = $('recovery-error');
    const button = $('recovery-reset-btn');
    error.classList.remove('show');
    if (password !== confirmation) {
      error.textContent = 'The passwords do not match.';
      error.classList.add('show');
      $('recovery-confirm').focus();
      return;
    }
    if (password.length < 8) {
      error.textContent = 'Password must be at least 8 characters.';
      error.classList.add('show');
      return;
    }
    button.disabled = true;
    button.innerHTML = '<i class="ti ti-loader-2 spin"></i> Securing account…';
    try {
      await API.resetPasswordWithToken(token, password);
      history.replaceState(null, '', window.location.pathname + window.location.search);
      openRecoveryPage(`
        <div class="recovery-status success"><i class="ti ti-shield-check"></i></div>
        <div class="recovery-kicker">Account secured</div>
        <h1 class="recovery-title">Your password is updated</h1>
        <p class="recovery-copy">Every previous session has been signed out. Sign in with the new password and complete two-step sign-in as usual.</p>
        <button type="button" class="btn btn-primary recovery-primary" id="recovery-back"><i class="ti ti-login"></i> Continue to sign in</button>`);
      bindRecoveryBack();
    } catch (err) {
      error.textContent = err.error || 'This reset link is invalid or has expired. Request a new one.';
      error.classList.add('show');
      button.disabled = false;
      button.innerHTML = '<i class="ti ti-key"></i> Set new password';
    }
  }

  function backToLogin() {
    history.replaceState(null, '', window.location.pathname + window.location.search);
    showLogin();
    $('login-username').focus();
  }

  function routeRecovery() {
    const hash = window.location.hash.slice(1);
    if (hash === 'forgot-password') { showRecoveryRequest(false); return true; }
    if (hash.startsWith('reset-password?')) {
      const token = new URLSearchParams(hash.slice(hash.indexOf('?') + 1)).get('token');
      // Take the one-time token out of the address bar and history at once, so
      // it is not left on screen, in a shared tab, or behind the Back button.
      history.replaceState(null, '', window.location.pathname + window.location.search + '#forgot-password');
      if (token) showRecoveryReset(token);
      else showRecoveryRequest(false);
      return true;
    }
    return false;
  }

  function logout() {
    closeProfileMenu();
    API.clearToken();
    API.clearUser();
    // Pages that hold a transcript or draft in module state must forget it —
    // the next person to sign in on this device must not inherit it.
    // This was guarded with window.ChatPage, which is always undefined: chat.js
    // declares ChatPage with const, a script-scope binding rather than a window
    // property, so the reset had never once run.
    if (typeof ChatPage !== 'undefined' && ChatPage.reset) ChatPage.reset();
    // A tour belongs to the account that started it, not to the shared tablet.
    if (typeof Tour !== 'undefined') Tour.forget();
    // Cached API responses are role-scoped, so they belong to the account that
    // fetched them, not to the device.
    if (typeof Offline !== 'undefined') Offline.forgetUserData();
    showLogin();
  }

  /**
   * End this account's session on every device, this one included (SEC-005).
   * For a lost phone or a borrowed tablet someone forgot to sign out of.
   */
  async function signOutEverywhere() {
    closeProfileMenu();
    if (!confirm('Sign out on every device, including this one?\n\nUse this if a phone was lost or you signed in on a shared tablet.')) return;
    try {
      await API.revokeAllSessions();
      showToast('Signed out on every device', 4000);
    } catch (e) {
      showToast(e.error || 'Could not reach the server — try again');
      return;
    }
    logout();
  }

  function checkSession() {
    if (API.isLoggedIn()) {
      showApp();
      return true;
    }
    showLogin();
    return false;
  }

  /** What happens after a successful sign-in, whether it took one step or two. */
  function completeSignIn(data, password) {
    API.setToken(data.token);
    API.setUser(data.user);
    if (data.user.must_change_password) {
      showForcedPasswordChange(password);
      return;
    }
    showApp();
    App.init();
    // Offline.init() runs before a token exists, so warm the offline
    // reference caches here — otherwise the report form's school list is
    // missing the first time the network drops.
    if (typeof Offline !== 'undefined') Offline.warm();
    if (typeof data.recovery_codes_left === 'number') {
      showToast(`Signed in with a recovery code — ${data.recovery_codes_left} left. Make new ones under Two-Step Sign-In.`, 7000);
    } else if (data.user.role === 'admin' && !data.user.mfa_enabled) {
      // D4: the reminder before it becomes mandatory.
      setTimeout(() => showToast('Two-step sign-in becomes required for platform admins on 8 October — set it up from your profile menu.', 7000), 1200);
    }
  }

  // ---- Two-step sign-in (SEC-007, DECISIONS.md D4) ---------------------------
  let mfaTicket = null, mfaPassword = null, mfaUseRecovery = false;

  /** The second step of signing in: a 6-digit code, or a recovery code. */
  function showMfaStep(ticket, password) {
    mfaTicket = ticket; mfaPassword = password; mfaUseRecovery = false;
    Modal.open('Two-Step Sign-In', mfaStepBody(), `
      <button class="btn btn-secondary" onclick="Auth.cancelMfaStep()">Cancel</button>
      <button class="btn btn-primary" id="mfa-verify-btn" onclick="Auth.submitMfaStep()"><i class="ti ti-shield-check"></i> Verify</button>`);
    Modal.lock();
    focusMfaInput();
  }

  function mfaStepBody() {
    return `<div style="display:flex;flex-direction:column;gap:14px">
      <div style="font-size:13px;color:var(--text2);line-height:1.6">${mfaUseRecovery
        ? 'Enter one of the recovery codes you saved when you set up two-step sign-in. Each works once.'
        : 'Open your authenticator app and enter the 6-digit code shown for <strong>OE Technical Support</strong>.'}</div>
      <div class="form-group">
        <label>${mfaUseRecovery ? 'Recovery code' : 'Code'}</label>
        <input id="mfa-code" ${mfaUseRecovery
          ? 'placeholder="xxxx-xxxx-xxxx" autocomplete="off" autocapitalize="off" spellcheck="false"'
          : 'inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="123456" autocomplete="one-time-code"'}
          style="font-family:var(--font-mono);font-size:18px;letter-spacing:${mfaUseRecovery ? '1px' : '6px'};text-align:center"
          onkeydown="if(event.key==='Enter'){event.preventDefault();Auth.submitMfaStep()}">
      </div>
      <button type="button" class="mfa-link" onclick="Auth.toggleMfaRecovery()">${mfaUseRecovery ? 'Use a code from my app instead' : 'Lost your phone? Use a recovery code'}</button>
    </div>`;
  }

  function focusMfaInput() { setTimeout(() => { const i = document.getElementById('mfa-code'); if (i) i.focus(); }, 60); }

  function toggleMfaRecovery() {
    mfaUseRecovery = !mfaUseRecovery;
    const body = document.querySelector('.modal-body');
    if (body) { body.innerHTML = mfaStepBody(); focusMfaInput(); }
  }

  async function submitMfaStep() {
    const input = document.getElementById('mfa-code');
    const code = input ? input.value.trim() : '';
    if (!code) { showToast(mfaUseRecovery ? 'Enter a recovery code' : 'Enter the 6-digit code'); return; }
    const btn = document.getElementById('mfa-verify-btn');
    if (btn) btn.disabled = true;
    try {
      const data = await API.mfaVerify(mfaTicket, code);
      Modal.unlock(); Modal.close();
      const pw = mfaPassword;
      mfaTicket = null; mfaPassword = null;
      completeSignIn(data, pw);
    } catch (e) {
      if (e.code === 'MFA_TICKET_INVALID') {
        cancelMfaStep();
        showToast('That sign-in took too long — enter your password again.', 5000);
      } else {
        showToast(e.error || 'That code is not right.');
        if (input) { input.value = ''; input.focus(); }
      }
    } finally { if (btn) btn.disabled = false; }
  }

  function cancelMfaStep() {
    mfaTicket = null; mfaPassword = null;
    Modal.unlock(); Modal.close();
  }

  /** Lazily fetch the vendored QR library — only this screen needs it. */
  let qrLoading = null;
  function loadQr() {
    if (typeof qrcode !== 'undefined') return Promise.resolve(true);
    if (qrLoading) return qrLoading;
    const own = document.querySelector('script[src*="js/auth.js"]');
    const v = own && own.getAttribute('src').match(/[?&]v=(\d+)/);
    qrLoading = new Promise(resolve => {
      const s = document.createElement('script');
      s.src = 'js/vendor/qrcode.js' + (v ? '?v=' + v[1] : '');
      s.onload = () => resolve(typeof qrcode !== 'undefined');
      s.onerror = () => { qrLoading = null; resolve(false); };
      document.head.appendChild(s);
    });
    return qrLoading;
  }

  /** The Two-Step Sign-In screen: status, setup, recovery codes, turn off. */
  async function showMfa(opts = {}) {
    closeProfileMenu();
    let st;
    try { st = await API.mfaStatus(); } catch (e) { showToast(e.error || 'Could not load two-step sign-in'); return; }
    const forced = !!opts.forced || st.must_enrol_now;
    const when = st.required_from ? new Date(st.required_from).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Dar_es_Salaam' }) : '';
    let body, footer;
    if (!st.enabled) {
      body = `<div style="display:flex;flex-direction:column;gap:14px">
        ${forced ? `<div class="mfa-note amber"><i class="ti ti-shield-lock"></i>Two-step sign-in is required for platform admins${when ? ' since ' + esc(when) : ''}. Set it up to continue.</div>` : ''}
        <div style="font-size:13px;color:var(--text2);line-height:1.65">After your password, you will also enter a 6-digit code from an
          authenticator app on your phone (Google Authenticator, Microsoft Authenticator, Authy…). A stolen password on its own is then
          not enough to get in.${st.required_for_role && !forced && when ? ` <strong>Required for platform admins from ${esc(when)}.</strong>` : ''}</div>
        <div class="mfa-note"><i class="ti ti-info-circle"></i>No SMS codes: a stolen or swapped SIM card would defeat them.</div>
      </div>`;
      footer = `${forced ? '' : '<button class="btn btn-secondary" onclick="Modal.close()">Not now</button>'}
        <button class="btn btn-primary" onclick="Auth.startMfaSetup(${forced})"><i class="ti ti-qrcode"></i> Set up</button>`;
    } else {
      const since = st.enrolled_at ? new Date(st.enrolled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Dar_es_Salaam' }) : '';
      body = `<div style="display:flex;flex-direction:column;gap:14px">
        <div class="mfa-note green"><i class="ti ti-shield-check"></i>Two-step sign-in is on${since ? ' since ' + esc(since) : ''}.</div>
        <div style="font-size:13px;color:var(--text2)">Recovery codes left: <strong style="color:${st.recovery_codes_left < 3 ? 'var(--red)' : 'var(--text)'}">${st.recovery_codes_left}</strong> of 10.
          ${st.recovery_codes_left < 3 ? ' Make new ones now — when they run out, a lost phone locks you out.' : ''}</div>
        <div class="form-group"><label>Current code from your app</label>
          <input id="mfa-manage-code" inputmode="numeric" maxlength="6" placeholder="123456" autocomplete="one-time-code" style="font-family:var(--font-mono);letter-spacing:4px"></div>
        ${st.required_for_role ? '' : `<div class="form-group"><label>Password (only to turn it off)</label><input type="password" id="mfa-manage-pw" autocomplete="current-password"></div>`}
      </div>`;
      footer = `${st.required_for_role ? '' : '<button class="btn btn-secondary" onclick="Auth.disableMfa()" style="color:var(--red)">Turn off</button>'}
        <button class="btn btn-primary" onclick="Auth.regenerateRecovery()"><i class="ti ti-refresh"></i> New recovery codes</button>`;
    }
    Modal.open('Two-Step Sign-In', body, footer);
    if (forced) Modal.lock();
  }

  async function startMfaSetup(forced) {
    let s;
    try { s = await API.mfaSetup(); } catch (e) { showToast(e.error || 'Could not start the setup'); return; }
    const qrOk = await loadQr();
    let qrSvg = '';
    if (qrOk) {
      const q = qrcode(0, 'M'); q.addData(s.otpauth); q.make();
      qrSvg = q.createSvgTag({ cellSize: 5, margin: 3, scalable: true });
    }
    const grouped = String(s.secret).replace(/(.{4})/g, '$1 ').trim();
    const body = `<div class="mfa-setup">
      <div class="mfa-steps">
        <div><span>1</span>Open your authenticator app and add an account.</div>
        <div><span>2</span>Scan this code${qrOk ? '' : ' (the QR image could not load — use the key below)'}, or type the key.</div>
        <div><span>3</span>Enter the 6-digit code it shows.</div>
      </div>
      ${qrOk ? `<div class="mfa-qr">${qrSvg}</div>` : ''}
      <div class="mfa-key"><label>Key</label><code>${esc(grouped)}</code></div>
      <div class="form-group"><label>Code from the app</label>
        <input id="mfa-setup-code" inputmode="numeric" maxlength="6" placeholder="123456" autocomplete="one-time-code"
          style="font-family:var(--font-mono);font-size:18px;letter-spacing:6px;text-align:center"
          onkeydown="if(event.key==='Enter'){event.preventDefault();Auth.confirmMfaSetup(${!!forced})}"></div>
    </div>`;
    Modal.unlock();
    Modal.open('Set Up Two-Step Sign-In', body, `
      ${forced ? '' : '<button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>'}
      <button class="btn btn-primary" onclick="Auth.confirmMfaSetup(${!!forced})"><i class="ti ti-check"></i> Confirm</button>`);
    if (forced) Modal.lock();
    setTimeout(() => { const i = document.getElementById('mfa-setup-code'); if (i) i.focus(); }, 60);
  }

  async function confirmMfaSetup(forced) {
    const code = (document.getElementById('mfa-setup-code') || {}).value || '';
    if (!/^\d{6}$/.test(code.trim())) { showToast('Enter the 6-digit code from the app'); return; }
    try {
      const r = await API.mfaEnable(code.trim());
      if (r.token) API.setToken(r.token);
      const u = API.getUser(); if (u) { u.mfa_enabled = true; API.setUser(u); }
      showRecoveryCodes(r.recovery_codes, forced);
    } catch (e) { showToast(e.error || 'That code is not right'); }
  }

  let shownCodes = [];
  function showRecoveryCodes(codes, forced) {
    shownCodes = codes || [];
    Modal.unlock();
    Modal.open('Save Your Recovery Codes', `<div style="display:flex;flex-direction:column;gap:12px">
      <div class="mfa-note amber"><i class="ti ti-alert-triangle"></i>Each code gets you in once if you lose your phone. They will not be shown again — save them somewhere safe, away from the phone.</div>
      <div class="mfa-codes">${shownCodes.map(c => `<code>${esc(c)}</code>`).join('')}</div>
      <div style="font-size:12px;color:var(--text3)">Other devices were signed out when two-step sign-in was turned on.</div>
    </div>`, `
      <button class="btn btn-secondary" onclick="Auth.copyRecovery()"><i class="ti ti-copy"></i> Copy</button>
      <button class="btn btn-secondary" onclick="Auth.downloadRecovery()"><i class="ti ti-download"></i> Download</button>
      <button class="btn btn-primary" onclick="Auth.finishMfa(${!!forced})"><i class="ti ti-check"></i> I saved them</button>`);
    Modal.lock();
  }

  function recoveryText() {
    return 'OE Technical Support — two-step sign-in recovery codes\n'
      + `Account: ${(API.getUser() || {}).username || ''}\nCreated: ${new Date().toLocaleString('en-GB')}\n\n`
      + shownCodes.join('\n') + '\n\nEach code works once. Keep this away from your phone.\n';
  }

  function copyRecovery() {
    const ta = document.createElement('textarea');
    ta.value = recoveryText(); ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    showToast(ok ? 'Recovery codes copied' : 'Copy failed — use Download instead');
  }

  function downloadRecovery() {
    downloadBlob(new Blob([recoveryText()], { type: 'text/plain;charset=utf-8' }), 'oe-support-recovery-codes.txt');
  }

  function finishMfa(forced) {
    shownCodes = [];
    Modal.unlock(); Modal.close();
    showToast('Two-step sign-in is on', 4000);
    // An admin blocked by enforcement can now use the app.
    if (forced && typeof App !== 'undefined') App.loadAndRender();
  }

  async function regenerateRecovery() {
    const code = (document.getElementById('mfa-manage-code') || {}).value || '';
    if (!/^\d{6}$/.test(code.trim())) { showToast('Enter a current 6-digit code first'); return; }
    try {
      const r = await API.mfaRecoveryCodes(code.trim());
      showRecoveryCodes(r.recovery_codes, false);
    } catch (e) { showToast(e.error || 'Could not make new codes'); }
  }

  async function disableMfa() {
    const code = (document.getElementById('mfa-manage-code') || {}).value || '';
    const pw = (document.getElementById('mfa-manage-pw') || {}).value || '';
    if (!pw || !code.trim()) { showToast('Your password and a current code are both needed'); return; }
    if (!confirm('Turn off two-step sign-in? Your password alone will then be enough to sign in.')) return;
    try {
      const r = await API.mfaDisable(pw, code.trim());
      if (r.token) API.setToken(r.token);
      const u = API.getUser(); if (u) { u.mfa_enabled = false; API.setUser(u); }
      Modal.close();
      showToast('Two-step sign-in is off. Other devices were signed out.', 5000);
    } catch (e) { showToast(e.error || 'Could not turn it off'); }
  }

  function init() {
    $('login-form').addEventListener('submit', handleLogin);
    $('forgot-password-link').addEventListener('click', () => showRecoveryRequest());
    window.addEventListener('hashchange', () => {
      if (routeRecovery()) return;
      const page = document.getElementById('recovery-page');
      if (page && page.style.display !== 'none' && !API.isLoggedIn()) showLogin();
    });
    // The server refused a request because this platform admin must enrol first (D4).
    window.addEventListener('mfa:required', () => {
      if (document.querySelector('.mfa-setup') || document.querySelector('.mfa-codes')) return;
      showMfa({ forced: true });
    });
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
    PasswordField.enhanceAll($('register-content'));
  }

  return { init, showLogin, showApp, logout, signOutEverywhere, showMfa, startMfaSetup, confirmMfaSetup, submitMfaStep, cancelMfaStep, toggleMfaRecovery, copyRecovery, downloadRecovery, finishMfa, regenerateRecovery, disableMfa, checkSession, toggleProfileMenu, closeProfileMenu, showProfile, showChangePassword, submitPasswordChange, showForcedPasswordChange, submitForcedPasswordChange, goRegister, showRecoveryRequest, routeRecovery, _switchToEditProfile, _saveProfile, _onAvatarFile };
})();
