const TeacherRegisterPage = (() => {
  let schoolInfo = null;
  let token = '';
  let step = 'loading'; // loading, form, submitted, error
  let errorMsg = '';

  const oeIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 30 30" fill="#ffae00"><path d="M24.33,10c-.54-1.27.49-3,1.84-4.71A14.81,14.81,0,0,1,29.76,12C27.32,11.83,24.94,11.43,24.33,10ZM13.21,5.57c1.47-.63,1.93-2.75,2.1-5h-.68A14.79,14.79,0,0,0,7.28,2.91C9.27,4.65,11.5,6.3,13.21,5.57ZM24.59,3.84A14.81,14.81,0,0,0,17.27.7c.23,2.15.8,4.14,2.42,4.79S23,5.16,24.59,3.84ZM24.41,16.5c-.78,2,1.69,4.33,3.74,6.39a14.79,14.79,0,0,0,2-8.12c0-.2,0-.39,0-.58C27.59,14.4,25.07,14.86,24.41,16.5Zm-15.65.19c-.55-2-8-1.77-8.32-1.68,0,.36,0,.72,0,1.08A14.79,14.79,0,0,0,3.59,24.6C5.35,22.59,9.31,18.7,8.76,16.69Zm-.08-6.48c.71-1.76-1.16-4.08-3-6.1a14.87,14.87,0,0,0-4.91,8.2C3.8,12.17,7.83,12.34,8.68,10.21Zm11.2,10.94c-2.19.94-1.68,7.26-1.59,8.85a14.83,14.83,0,0,0,8.32-4.93C24.4,23,21.78,20.33,19.88,21.14Zm-6.48.08c-2.8-1-7.6,4.91-7.94,5.36a14.81,14.81,0,0,0,9.76,3.72C15.25,29.12,16.2,22.21,13.4,21.22Z"/></svg>`;
  const oeLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 31" width="160" height="17"><path d="M24.33,10c-.54-1.27.49-3,1.84-4.71A14.81,14.81,0,0,1,29.76,12C27.32,11.83,24.94,11.43,24.33,10ZM13.21,5.57c1.47-.63,1.93-2.75,2.1-5h-.68A14.79,14.79,0,0,0,7.28,2.91C9.27,4.65,11.5,6.3,13.21,5.57ZM24.59,3.84A14.81,14.81,0,0,0,17.27.7c.23,2.15.8,4.14,2.42,4.79S23,5.16,24.59,3.84ZM24.41,16.5c-.78,2,1.69,4.33,3.74,6.39a14.79,14.79,0,0,0,2-8.12c0-.2,0-.39,0-.58C27.59,14.4,25.07,14.86,24.41,16.5Zm-15.65.19c-.55-2-8-1.77-8.32-1.68,0,.36,0,.72,0,1.08A14.79,14.79,0,0,0,3.59,24.6C5.35,22.59,9.31,18.7,8.76,16.69Zm-.08-6.48c.71-1.76-1.16-4.08-3-6.1a14.87,14.87,0,0,0-4.91,8.2C3.8,12.17,7.83,12.34,8.68,10.21Zm11.2,10.94c-2.19.94-1.68,7.26-1.59,8.85a14.83,14.83,0,0,0,8.32-4.93C24.4,23,21.78,20.33,19.88,21.14Zm-6.48.08c-2.8-1-7.6,4.91-7.94,5.36a14.81,14.81,0,0,0,9.76,3.72C15.25,29.12,16.2,22.21,13.4,21.22Z" fill="#ffae00"/><path d="M37.84,14.59a8.8,8.8,0,1,1,8.77,8.66A8.57,8.57,0,0,1,37.84,14.59Zm14.08,0a5.28,5.28,0,1,0-10.56,0,5.28,5.28,0,1,0,10.56,0Z" fill="#fff"/><path d="M70.64,16.73a6.23,6.23,0,0,1-6.15,6.54,5.16,5.16,0,0,1-3.91-1.74v6.56H57.37V10.52h3.2V12a5.08,5.08,0,0,1,4-1.85A6.22,6.22,0,0,1,70.64,16.73Zm-3.24,0a3.44,3.44,0,1,0-6.88,0,3.44,3.44,0,1,0,6.88,0Z" fill="#fff"/><path d="M85.69,16.73a6.23,6.23,0,0,1-6.15,6.54,5.16,5.16,0,0,1-3.91-1.74v6.56H72.41V10.52h3.2V12a5.08,5.08,0,0,1,4-1.85A6.22,6.22,0,0,1,85.69,16.73Zm-3.24,0a3.44,3.44,0,1,0-6.88,0,3.44,3.44,0,1,0,6.88,0Z" fill="#fff"/><path d="M86.75,16.73a6.67,6.67,0,0,1,13.34,0,6.67,6.67,0,0,1-13.34,0Zm10.12,0a3.45,3.45,0,1,0-3.45,3.56A3.47,3.47,0,0,0,96.87,16.73Z" fill="#fff"/><path d="M101.81,10.52h3.08v1.67a3.73,3.73,0,0,1,3.43-2,4.58,4.58,0,0,1,1.51.27l-.28,3.08a4.93,4.93,0,0,0-1.48-.25c-1.69,0-3,1.05-3,3.77V23h-3.22Z" fill="#fff"/><path d="M120.94,22.24a6.91,6.91,0,0,1-3.68,1c-2.86,0-4.34-1.69-4.34-4.91V13.21h-2v-2.7h2.06V6.11h3.2v4.41h4.11v2.7h-4.11v4.94c0,1.44.55,2.19,1.76,2.19A4.21,4.21,0,0,0,120,19.7Z" fill="#fff"/><path d="M122.24,17.72v-7.2h3.22v7.2a2.49,2.49,0,1,0,5,0v-7.2h3.22v7.2c0,3.54-2.19,5.55-5.71,5.55S122.24,21.23,122.24,17.72Z" fill="#fff"/><path d="M135.95,10.52h3.15v1.74A4.36,4.36,0,0,1,143,10.18c2.51,0,4.87,1.67,4.87,5.19V23h-3.22V16.23c0-2-1.07-3.08-2.63-3.08a2.87,2.87,0,0,0-2.86,3.15V23h-3.22Z" fill="#fff"/><path d="M149.79,7.14a2,2,0,1,1,2,2A1.94,1.94,0,0,1,149.79,7.14ZM150.16,23V10.52h3.22V23Z" fill="#fff"/><path d="M165.12,22.24a6.91,6.91,0,0,1-3.68,1c-2.86,0-4.34-1.69-4.34-4.91V13.21h-2v-2.7h2.06V6.11h3.2v4.41h4.11v2.7h-4.11v4.94c0,1.44.55,2.19,1.76,2.19a4.21,4.21,0,0,0,2.08-.64Z" fill="#fff"/><path d="M179,10.52l-5,13.07c-1.19,3.06-2.74,4.68-5.28,4.68a4.55,4.55,0,0,1-2.4-.62l.55-2.7a3.75,3.75,0,0,0,1.6.41c1,0,1.78-.59,2.42-2l.25-.57L165.7,10.52h3.72l3.22,8.11,2.83-8.11Z" fill="#fff"/><path d="M185.72,6.14h11.45V9.29h-8v3.63h7.45v3.15h-7.45v3.79h8V23H185.72Z" fill="#fff"/><path d="M211.66,5.66V23H208.5V21.49a4.8,4.8,0,0,1-3.86,1.83,6.21,6.21,0,0,1-6.17-6.54,6.25,6.25,0,0,1,6.17-6.53A4.81,4.81,0,0,1,208.43,12V5.66Zm-3.06,11.13a3.46,3.46,0,1,0-6.92,0,3.46,3.46,0,1,0,6.92,0Z" fill="#fff"/><path d="M214,17.77v-7.2h3.22v7.2a2.49,2.49,0,1,0,5,0v-7.2h3.22v7.2c0,3.54-2.19,5.55-5.71,5.55S214,21.29,214,17.77Z" fill="#fff"/><path d="M226.92,16.79a6.35,6.35,0,0,1,6.69-6.53,6.21,6.21,0,0,1,5.81,3.47l-2.58,1.42a3.71,3.71,0,0,0-3.18-1.9,3.46,3.46,0,0,0-3.54,3.54,3.44,3.44,0,0,0,3.47,3.56,3.68,3.68,0,0,0,3.18-1.87l2.6,1.53a6.5,6.5,0,0,1-5.85,3.29A6.3,6.3,0,0,1,226.92,16.79Z" fill="#fff"/><path d="M253.27,10.57V23h-3.06V21.59a5.28,5.28,0,0,1-4,1.74c-3.61,0-6.17-2.88-6.17-6.58a6.15,6.15,0,0,1,6.17-6.49,5.21,5.21,0,0,1,4,1.8V10.57Zm-3,6.22a3.49,3.49,0,1,0-7,0,3.49,3.49,0,1,0,7,0Z" fill="#fff"/><path d="M265.12,22.3a6.91,6.91,0,0,1-3.68,1c-2.86,0-4.34-1.69-4.34-4.91V13.27h-2v-2.7h2.06V6.16h3.2v4.41h4.11v2.7h-4.11V18.2c0,1.44.55,2.19,1.76,2.19a4.21,4.21,0,0,0,2.08-.64Z" fill="#fff"/><path d="M266.34,7.19a2,2,0,1,1,2,2A1.94,1.94,0,0,1,266.34,7.19ZM266.7,23V10.57h3.22V23Z" fill="#fff"/><path d="M271.54,16.79a6.67,6.67,0,0,1,13.34,0,6.67,6.67,0,0,1-13.34,0Zm10.12,0a3.45,3.45,0,1,0-3.45,3.56A3.47,3.47,0,0,0,281.66,16.79Z" fill="#fff"/><path d="M286.6,10.57h3.15v1.74a4.36,4.36,0,0,1,3.91-2.08c2.51,0,4.87,1.67,4.87,5.19V23H295.3V16.29c0-2-1.07-3.08-2.63-3.08a2.87,2.87,0,0,0-2.86,3.15V23H286.6Z" fill="#fff"/></svg>`;

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
      <div class="reg-card" style="max-width:520px;width:100%">
        <div class="reg-header">
          <div class="oe-icon" style="margin:0 auto 12px">${oeIconSvg}</div>
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
        <div class="oe-footer-logo">${oeLogoSvg}</div>
      </div>
    </div>`;
  }

  function renderSubmitted() {
    return `
    <div class="reg-page">
      <div class="reg-card reg-card-status" style="max-width:520px;width:100%">
        <div class="oe-icon" style="margin:0 auto 12px">${oeIconSvg}</div>
        <div class="reg-success-anim">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><path d="M5 12l5 5l10 -10"/><circle cx="12" cy="12" r="9" stroke-opacity="0.3"/></svg>
        </div>
        <h1 class="reg-title" style="color:var(--green)">Registration Submitted!</h1>
        <p class="reg-sub">Your registration has been sent to your school administrator for approval. You will be able to log in once approved.</p>
        <div class="oe-footer-logo">${oeLogoSvg}</div>
      </div>
    </div>`;
  }

  function renderError() {
    return `
    <div class="reg-page">
      <div class="reg-card reg-card-status" style="max-width:520px;width:100%">
        <div class="oe-icon" style="margin:0 auto 12px">${oeIconSvg}</div>
        <div class="reg-reject-anim">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
        </div>
        <h1 class="reg-title" style="color:var(--red)">Registration Unavailable</h1>
        <p class="reg-sub">${errorMsg}</p>
        <div class="oe-footer-logo">${oeLogoSvg}</div>
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
