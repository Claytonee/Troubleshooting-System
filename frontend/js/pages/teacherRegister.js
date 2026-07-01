const TeacherRegisterPage = (() => {
  let schoolInfo = null;
  let token = '';
  let step = 'loading'; // loading, form, submitted, error
  let errorMsg = '';

  async function init() {
    const path = window.location.pathname;
    const match = path.match(/\/register\/teacher\/([a-f0-9]+)/);
    if (!match) { step = 'error'; errorMsg = 'Invalid registration link.'; return; }

    token = match[1];
    try {
      const res = await fetch(`/api/register/verify/${token}`);
      if (!res.ok) {
        const data = await res.json();
        step = 'error';
        errorMsg = data.error || 'Invalid or expired link.';
        return;
      }
      schoolInfo = await res.json();
      step = 'form';
    } catch (e) {
      step = 'error';
      errorMsg = 'Unable to verify registration link.';
    }
  }

  function render() {
    if (step === 'loading') return '<div class="reg-page"><div class="chat-spinner" style="width:32px;height:32px;border-width:3px"></div></div>';
    if (step === 'error') return renderError();
    if (step === 'submitted') return renderSubmitted();
    return renderForm();
  }

  function renderForm() {
    return `
    <div class="reg-page">
      <div class="reg-card">
        <div class="reg-header">
          <div class="reg-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 9l-10 -4l-10 4l10 4l10 -4v6"/><path d="M6 14.2v4c0 1 2.6 2.8 6 2.8s6-1.8 6-2.8v-4"/></svg>
          </div>
          <h1 class="reg-title">Teacher Registration</h1>
          <p class="reg-sub">Register as a teacher at <strong>${esc(schoolInfo.school_name)}</strong></p>
          ${schoolInfo.school_zone ? `<p class="reg-sub" style="margin-top:4px">${esc(schoolInfo.school_zone)}</p>` : ''}
        </div>
        ${errorMsg ? `<div class="reg-error">${errorMsg}</div>` : ''}
        <form class="reg-form" onsubmit="TeacherRegisterPage.submit(event)">
          <div class="reg-field">
            <label>Full Name <span class="req">*</span></label>
            <input type="text" id="tr-name" placeholder="Your full name" required minlength="3">
          </div>
          <div class="reg-field">
            <label>Email Address <span class="req">*</span></label>
            <input type="email" id="tr-email" placeholder="your.email@example.com" required>
          </div>
          <div class="reg-field">
            <label>Phone Number</label>
            <input type="tel" id="tr-phone" placeholder="+255 7XX XXX XXX">
          </div>
          <div class="reg-field">
            <label>Subject / Department</label>
            <input type="text" id="tr-subject" placeholder="e.g. Mathematics, Science">
          </div>
          <div class="reg-field">
            <label>Employee ID (if any)</label>
            <input type="text" id="tr-empid" placeholder="Optional">
          </div>
          <div class="reg-field">
            <label>Password <span class="req">*</span></label>
            <input type="password" id="tr-password" placeholder="Minimum 8 characters" required minlength="8">
          </div>
          <div class="reg-field">
            <label>Confirm Password <span class="req">*</span></label>
            <input type="password" id="tr-confirm" placeholder="Re-enter password" required>
          </div>
          <button type="submit" class="reg-btn" id="tr-submit-btn">
            <span>Register</span>
          </button>
        </form>
      </div>
    </div>`;
  }

  function renderSubmitted() {
    return `
    <div class="reg-page">
      <div class="reg-card reg-card-status">
        <div class="reg-success-anim">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><path d="M5 12l5 5l10 -10"/><circle cx="12" cy="12" r="9" stroke-opacity="0.3"/></svg>
        </div>
        <h1 class="reg-title" style="color:var(--green)">Registration Submitted!</h1>
        <p class="reg-sub">Your registration has been sent to your school administrator for approval. You will be able to log in once approved.</p>
      </div>
    </div>`;
  }

  function renderError() {
    return `
    <div class="reg-page">
      <div class="reg-card reg-card-status">
        <div class="reg-reject-anim">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
        </div>
        <h1 class="reg-title" style="color:var(--red)">Registration Unavailable</h1>
        <p class="reg-sub">${errorMsg}</p>
      </div>
    </div>`;
  }

  async function submit(e) {
    e.preventDefault();
    errorMsg = '';

    const password = document.getElementById('tr-password').value;
    const confirm = document.getElementById('tr-confirm').value;
    if (password !== confirm) {
      errorMsg = 'Passwords do not match.';
      document.querySelector('.reg-error')?.remove();
      const form = document.querySelector('.reg-form');
      if (form) form.insertAdjacentHTML('beforebegin', `<div class="reg-error">${errorMsg}</div>`);
      return;
    }

    const btn = document.getElementById('tr-submit-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="chat-spinner"></span>'; }

    try {
      const res = await fetch(`/api/register/teacher/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: document.getElementById('tr-name').value.trim(),
          email: document.getElementById('tr-email').value.trim(),
          phone: document.getElementById('tr-phone').value.trim(),
          subject: document.getElementById('tr-subject').value.trim(),
          employee_id: document.getElementById('tr-empid').value.trim(),
          password
        })
      });
      const data = await res.json();
      if (res.ok) {
        step = 'submitted';
        renderPage();
      } else {
        errorMsg = data.error || 'Registration failed.';
        if (btn) { btn.disabled = false; btn.innerHTML = '<span>Register</span>'; }
        document.querySelector('.reg-error')?.remove();
        const form = document.querySelector('.reg-form');
        if (form) form.insertAdjacentHTML('beforebegin', `<div class="reg-error">${errorMsg}</div>`);
      }
    } catch (err) {
      errorMsg = 'Network error. Try again.';
      if (btn) { btn.disabled = false; btn.innerHTML = '<span>Register</span>'; }
    }
  }

  function renderPage() {
    const main = document.getElementById('main');
    if (main) main.innerHTML = render();
  }

  return { init, render, submit };
})();
