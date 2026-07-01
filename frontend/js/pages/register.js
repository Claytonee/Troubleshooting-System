const RegisterPage = (() => {
  let schools = [];
  let step = 'form'; // form, submitting, pending, approved, rejected
  let requestId = null;
  let requestEmail = null;
  let errorMsg = '';
  let pollInterval = null;

  async function load() {
    try {
      const res = await fetch('/api/register/schools-list');
      schools = await res.json();
    } catch (e) { schools = []; }
  }

  function render() {
    if (step === 'pending') return renderPending();
    if (step === 'approved') return renderApproved();
    if (step === 'rejected') return renderRejected();
    return renderForm();
  }

  function renderForm() {
    return `
    <div class="reg-page">
      <div class="reg-card">
        <div class="reg-header">
          <div class="reg-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"/><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/></svg>
          </div>
          <h1 class="reg-title">School Admin Registration</h1>
          <p class="reg-sub">Register as a school administrator for Opportunity Education Tanzania technical support system</p>
        </div>
        ${errorMsg ? `<div class="reg-error">${errorMsg}</div>` : ''}
        <form class="reg-form" onsubmit="RegisterPage.submit(event)">
          <div class="reg-grid">
            <div class="reg-field">
              <label>Full Name <span class="req">*</span></label>
              <input type="text" id="reg-name" placeholder="Enter your full name" required minlength="3">
            </div>
            <div class="reg-field">
              <label>Email Address <span class="req">*</span></label>
              <input type="email" id="reg-email" placeholder="your.email@example.com" required>
            </div>
            <div class="reg-field">
              <label>Phone Number <span class="req">*</span></label>
              <input type="tel" id="reg-phone" placeholder="+255 7XX XXX XXX" required>
            </div>
            <div class="reg-field">
              <label>Your Role/Title</label>
              <input type="text" id="reg-title" placeholder="e.g. IT Coordinator, Head Teacher">
            </div>
            <div class="reg-field reg-full">
              <label>School <span class="req">*</span></label>
              <select id="reg-school" required>
                <option value="">Select your school</option>
                ${schools.map(s => `<option value="${s.id}">${s.name} (${s.zone || 'N/A'})</option>`).join('')}
              </select>
            </div>
            <div class="reg-field">
              <label>Password <span class="req">*</span></label>
              <input type="password" id="reg-password" placeholder="Minimum 8 characters" required minlength="8">
            </div>
            <div class="reg-field">
              <label>Confirm Password <span class="req">*</span></label>
              <input type="password" id="reg-confirm" placeholder="Re-enter password" required>
            </div>
          </div>
          <button type="submit" class="reg-btn" id="reg-submit-btn">
            <span>Submit Registration</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M13 18l6-6"/><path d="M13 6l6 6"/></svg>
          </button>
        </form>
        <div class="reg-footer">
          Already have an account? <a href="#" onclick="RegisterPage.goLogin()">Sign in</a>
        </div>
      </div>
    </div>`;
  }

  function renderPending() {
    return `
    <div class="reg-page">
      <div class="reg-card reg-card-status">
        <div class="reg-pending-anim">
          <div class="reg-pending-circle">
            <div class="reg-pending-ring"></div>
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="9"/></svg>
          </div>
        </div>
        <h1 class="reg-title">Registration Submitted</h1>
        <p class="reg-sub">Your registration is pending approval from<br><strong>Opportunity Education Tanzania</strong></p>
        <div class="reg-status-card">
          <div class="reg-status-row"><span>Status</span><span class="reg-badge pending">Pending Review</span></div>
          <div class="reg-status-row"><span>Request ID</span><span>#${requestId}</span></div>
          <div class="reg-status-row"><span>Email</span><span>${requestEmail}</span></div>
        </div>
        <p class="reg-hint">This page will automatically update when your request is reviewed. You can close this page and check back later.</p>
      </div>
    </div>`;
  }

  function renderApproved() {
    return `
    <div class="reg-page">
      <div class="reg-card reg-card-status">
        <div class="reg-success-anim">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><path d="M5 12l5 5l10 -10"/><circle cx="12" cy="12" r="9" stroke-opacity="0.3"/></svg>
        </div>
        <h1 class="reg-title" style="color:var(--green)">Registration Approved!</h1>
        <p class="reg-sub">Welcome! Your account has been approved. You now have access to the technical support system.</p>
        <button class="reg-btn" onclick="RegisterPage.goLogin()">
          <span>Go to Login</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M13 18l6-6"/><path d="M13 6l6 6"/></svg>
        </button>
      </div>
    </div>`;
  }

  function renderRejected() {
    return `
    <div class="reg-page">
      <div class="reg-card reg-card-status">
        <div class="reg-reject-anim">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
        </div>
        <h1 class="reg-title" style="color:var(--red)">Registration Not Approved</h1>
        <p class="reg-sub">Unfortunately, your registration was not approved at this time.</p>
        <div class="reg-status-card">
          <div class="reg-status-row"><span>Reason</span><span style="color:var(--text2)">${errorMsg || 'Not specified'}</span></div>
        </div>
        <p class="reg-sub" style="margin-top:16px">If you believe this is an error, you may submit an appeal:</p>
        <button class="reg-btn reg-btn-outline" onclick="RegisterPage.showAppeal()">
          <span>Submit Appeal</span>
        </button>
        <div id="appeal-form" style="display:none;margin-top:20px;width:100%">
          <form onsubmit="RegisterPage.submitAppeal(event)" style="display:flex;flex-direction:column;gap:12px">
            <div class="reg-field"><label>Full Name</label><input type="text" id="appeal-name" required></div>
            <div class="reg-field"><label>Email</label><input type="email" id="appeal-email" value="${requestEmail || ''}" required></div>
            <div class="reg-field"><label>Message</label><textarea id="appeal-msg" rows="4" placeholder="Explain why you should be approved..." required minlength="10" style="width:100%;padding:10px;background:var(--bg1);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--font);font-size:13px;resize:vertical"></textarea></div>
            <button type="submit" class="reg-btn"><span>Send Appeal</span></button>
          </form>
        </div>
        <div class="reg-footer" style="margin-top:20px">
          <a href="#" onclick="RegisterPage.goLogin()">Back to Login</a>
        </div>
      </div>
    </div>`;
  }

  async function submit(e) {
    e.preventDefault();
    errorMsg = '';

    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const school_id = document.getElementById('reg-school').value;
    const title = document.getElementById('reg-title').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;

    if (password !== confirm) {
      errorMsg = 'Passwords do not match.';
      App.render(); return;
    }

    const btn = document.getElementById('reg-submit-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="chat-spinner"></span> Submitting...'; }

    try {
      const res = await fetch('/api/register/school-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name, email, phone, school_id: parseInt(school_id), title, password })
      });
      const data = await res.json();

      if (!res.ok) {
        errorMsg = data.error || 'Registration failed.';
        App.render(); return;
      }

      requestId = data.request_id;
      requestEmail = email;
      step = 'pending';
      App.render();
      startPolling();
    } catch (err) {
      errorMsg = 'Network error. Please try again.';
      App.render();
    }
  }

  function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/register/status/${requestId}?email=${encodeURIComponent(requestEmail)}`);
        const data = await res.json();
        if (data.status === 'approved') {
          step = 'approved';
          clearInterval(pollInterval);
          App.render();
        } else if (data.status === 'rejected') {
          step = 'rejected';
          errorMsg = data.rejection_reason || '';
          clearInterval(pollInterval);
          App.render();
        }
      } catch (e) {}
    }, 10000);
  }

  function showAppeal() {
    const el = document.getElementById('appeal-form');
    if (el) el.style.display = 'block';
  }

  async function submitAppeal(e) {
    e.preventDefault();
    const name = document.getElementById('appeal-name').value.trim();
    const email = document.getElementById('appeal-email').value.trim();
    const message = document.getElementById('appeal-msg').value.trim();

    try {
      const res = await fetch('/api/register/appeal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, full_name: name, email, message })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Appeal submitted successfully');
        step = 'pending';
        App.render();
        startPolling();
      } else {
        showToast(data.error || 'Failed to submit appeal');
      }
    } catch (err) {
      showToast('Network error');
    }
  }

  function goLogin() {
    if (pollInterval) clearInterval(pollInterval);
    step = 'form'; errorMsg = ''; requestId = null; requestEmail = null;
    window.location.hash = '';
    window.location.reload();
  }

  function afterRender() {}

  return { load, render, afterRender, submit, showAppeal, submitAppeal, goLogin };
})();
