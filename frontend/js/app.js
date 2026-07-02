/**
 * Main Application Controller
 * Coordinates pages, routing, and data loading
 */
const App = (() => {
  const pages = {
    dashboard: DashboardPage,
    report: ReportPage,
    tracker: TrackerPage,
    followup: FollowUpPage,
    weekly: WeeklyPage,
    schools: SchoolsPage,
    troubleshoot: GuidesPage,
    manuals: ManualsPage,
    analytics: AnalyticsPage,
    schooladmins: SchoolAdminsPage,
    branding: BrandingPage,
    audit: AuditPage,
    search: SearchPage,
    chat: ChatPage,
    help: HelpPage,
    approvals: ApprovalsPage,
    teachers: TeachersPage,
  };

  async function init() {
    Router.applyRoleVisibility();
    await loadAndRender();
    updateBadges();
    setInterval(updateBadges, 30000);
  }

  async function updateBadges() {
    try {
      const d = await API.getDashboard();
      if (d.type === 'teacher') return;
      const open = parseInt(d.errors.open_count) || 0;
      const crit = parseInt(d.errors.critical_open) || 0;
      const fuCount = open;
      const navCrit = document.getElementById('nav-crit');
      const navTrack = document.getElementById('nav-track');
      const navFu = document.getElementById('nav-fu');
      if (navCrit) { navCrit.textContent = crit > 0 ? crit : ''; navCrit.style.display = crit > 0 ? 'inline-block' : 'none'; }
      if (navTrack) { navTrack.textContent = open > 0 ? open : ''; navTrack.style.display = open > 0 ? 'inline-block' : 'none'; }
      if (navFu) { navFu.textContent = fuCount > 0 ? fuCount : ''; navFu.style.display = fuCount > 0 ? 'inline-block' : 'none'; }

      const user = API.getUser();
      const token = API.getToken();
      const headers = { 'Authorization': `Bearer ${token}` };

      // Admin: approval badge in sidebar
      if (user && user.role === 'admin') {
        try {
          const res = await fetch('/api/register/approvals/pending', { headers });
          if (res.ok) {
            const pending = await res.json();
            const navApprovals = document.getElementById('nav-approvals');
            if (navApprovals) {
              navApprovals.textContent = pending.length > 0 ? pending.length : '';
              navApprovals.style.display = pending.length > 0 ? 'inline-block' : 'none';
            }
          }
        } catch (e) {}
      }

      // School admin: pending teachers badge
      if (user && user.role === 'school') {
        try {
          const res = await fetch('/api/register/teacher-approvals/pending', { headers });
          if (res.ok) {
            const pending = await res.json();
            const navTeachers = document.getElementById('nav-teachers');
            if (navTeachers) {
              navTeachers.textContent = pending.length > 0 ? pending.length : '';
              navTeachers.style.display = pending.length > 0 ? 'inline-block' : 'none';
            }
          }
        } catch (e) {}
      }

      // Refresh notification bell
      Notifications.refresh();
    } catch (e) {}
  }

  async function loadAndRender() {
    const page = Router.getCurrentPage();
    const handler = pages[page];
    if (handler && handler.load) await handler.load();
    render();
  }

  function render() {
    Router.applyRoleVisibility();
    const page = Router.getCurrentPage();
    const handler = pages[page];
    const main = $('main');

    main.classList.toggle('chat-active', page === 'chat');

    if (handler && handler.render) {
      main.innerHTML = handler.render();
      if (handler.afterRender) handler.afterRender();
    } else {
      main.innerHTML = `<div class="empty"><i class="ti ti-hammer"></i>Page "${page}" coming soon</div>`;
    }
    initScrollReveal();
  }

  function initScrollReveal() {
    const main = document.querySelector('.main');
    if (!main) return;

    // Sticky header elevation on scroll
    const header = main.querySelector('.section-header');
    if (header) {
      main.addEventListener('scroll', () => {
        header.classList.toggle('elevated', main.scrollTop > 10);
      }, { passive: true });
    }

    // Reveal cards/stat-cards on scroll into view
    const els = main.querySelectorAll('.card, .stat-card, .alert-banner');
    if (!els.length) return;
    els.forEach(el => el.classList.add('reveal'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { root: main, threshold: 0.1 });
    els.forEach(el => observer.observe(el));
  }

  return { init, render, loadAndRender };
})();

/**
 * Error Detail Modal
 */
const ErrorDetailModal = (() => {
  async function open(id) {
    try {
      const e = await API.getError(id);
      const pri = PRI[e.priority] || PRI.medium;
      const stat = STAT[e.status] || STAT.open;
      const breach = slaState(e) === 'breach';

      const csatBlock = e.status === 'resolved' ? `
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
          <div style="font-size:11px;font-weight:600;color:var(--text3);margin-bottom:8px">SATISFACTION</div>
          ${e.csat_rating != null
            ? `<div style="font-size:13px;color:var(--text2)">Rated <strong style="color:var(--amber)">${e.csat_rating}/5</strong>${e.csat_comment ? ` — &ldquo;${esc(e.csat_comment)}&rdquo;` : ''}</div>`
            : (e.csat_token
                ? `<div style="font-size:12px;color:var(--text3);margin-bottom:6px">How well was this resolved?</div>
                   <div style="display:flex;gap:6px">${[1, 2, 3, 4, 5].map(n => `<button class="btn btn-secondary btn-sm" style="padding:4px 10px" onclick="ErrorDetailModal.rate('${e.csat_token}', ${n})">${n}&#9733;</button>`).join('')}</div>`
                : '<div style="font-size:12px;color:var(--text3)">No feedback recorded.</div>')}
        </div>` : '';

      const body = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <span class="badge ${pri.badge}">${pri.label}</span>
          <span class="badge ${stat.badge}">${stat.label}</span>
          ${breach ? '<span class="badge badge-red">SLA Breach</span>' : ''}
          <span style="margin-left:auto" class="error-id">${e.error_code}</span>
        </div>
        <div style="font-size:16px;font-weight:600;margin-bottom:4px">${esc(e.title)}</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:16px">${esc(e.school_name)} · ${e.category} · age ${ageStr(e.hours_open)}</div>
        <div style="background:var(--bg3);border-radius:8px;padding:12px;font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:14px">${esc(e.description || 'No description')}</div>
        ${e.escalation_level === 'platform' ? `<div style="background:rgba(155,125,255,0.08);border:1px solid rgba(155,125,255,0.2);border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
          <i class="ti ti-arrow-up-right" style="font-size:16px;color:var(--purple)"></i>
          <div style="font-size:12px;color:var(--purple);font-weight:500">Escalated to Opportunity Education Tanzania</div>
        </div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:12px;color:var(--text2)">
          <div><div style="color:var(--text3);font-size:11px">ASSIGNED TO</div>${esc(e.assigned_name || 'Unassigned')}</div>
          ${e.reporter_name ? `<div><div style="color:var(--text3);font-size:11px">REPORTED BY</div>${esc(e.reporter_name)}</div>` : ''}
          ${e.location ? `<div><div style="color:var(--text3);font-size:11px">LOCATION</div>${esc(e.location)}</div>` : ''}
        </div>
        ${(e.updates && e.updates.length) ? `<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)"><div style="font-size:11px;font-weight:600;color:var(--text3);margin-bottom:10px">UPDATES</div>
          ${e.updates.map(u => `<div style="background:var(--bg3);border-radius:6px;padding:8px 10px;margin-bottom:6px;font-size:12px"><span style="color:var(--text)">${esc(u.recorded_by)}</span> <span style="color:var(--text3)">· ${relTime(u.created_at)}</span><div style="color:var(--text2);margin-top:4px">${esc(u.note)}</div></div>`).join('')}
        </div>` : ''}
        ${csatBlock}`;

      const user = API.getUser();
      const canEscalate = e.status !== 'resolved' && e.escalation_level !== 'platform' && user && user.role === 'school';
      const canResolve = e.status !== 'resolved';

      let footer = '';
      if (canResolve || canEscalate) {
        footer += '<div style="display:flex;gap:10px;width:100%;align-items:center">';
        if (canEscalate) {
          footer += `<button class="btn btn-danger btn-sm" style="display:inline-flex;align-items:center;gap:6px" data-tip="Escalate to OE · Forward this error to Opportunity Education platform team for immediate support and resolution" data-tip-color="red" onclick="ErrorDetailModal.escalate(${e.id})"><i class="ti ti-arrow-up-right"></i> Escalate to OE</button>`;
        }
        footer += '<div style="flex:1"></div>';
        if (canResolve) {
          footer += `<button class="btn btn-success" data-tip="Mark Resolved · Close this error as resolved — the reporter will be notified and asked for satisfaction feedback" data-tip-color="green" onclick="ErrorDetailModal.resolve(${e.id})"><i class="ti ti-check"></i> Mark Resolved</button>`;
        }
        footer += '</div>';
      } else {
        footer = `<button class="btn btn-secondary" onclick="Modal.close()">Close</button>`;
      }
      Modal.open('Error Detail', body, footer, { wide: true });
    } catch (err) {
      showToast('Failed to load error details');
    }
  }

  async function resolve(id) {
    try {
      await API.updateErrorStatus(id, 'resolved');
      Modal.close();
      showToast('Error resolved');
      await App.loadAndRender();
    } catch (e) { showToast('Failed to resolve'); }
  }

  async function escalate(id) {
    const body = `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="background:var(--bg3);border-radius:8px;padding:14px;border-left:3px solid var(--amber)">
          <div style="font-size:12px;color:var(--text3);margin-bottom:4px">What happens next</div>
          <div style="font-size:13px;color:var(--text2);line-height:1.6">This error will be forwarded to <strong style="color:var(--text)">Opportunity Education Tanzania</strong> platform admin for immediate attention. No changes needed — the full error details will be sent as-is.</div>
        </div>
        <div class="form-group">
          <label>Reason for escalation <span style="color:var(--red)">*</span></label>
          ${Dropdown.render('esc-reason', 'Select reason', [
            'Beyond school capacity',
            'Requires hardware replacement',
            'Needs vendor/ISP intervention',
            'Recurring unresolved issue',
            'SLA breach — needs urgent help',
            'Policy or accounts issue'
          ])}
        </div>
        <div class="form-group">
          <label>Additional note (optional)</label>
          <textarea id="esc-note" rows="2" placeholder="Any context for the platform team..." style="font-size:13px"></textarea>
        </div>
      </div>`;
    const footer = `
      <button class="btn btn-secondary" onclick="ErrorDetailModal.open(${id})">Cancel</button>
      <button class="btn btn-danger" id="esc-submit" data-tip="Escalate · Send this error to OE Tanzania platform team — they'll take over from here" data-tip-color="red" onclick="ErrorDetailModal.submitEscalation(${id})"><i class="ti ti-arrow-up-right"></i> Escalate to OE</button>`;
    Modal.open('Escalate Error', body, footer);
  }

  async function submitEscalation(id) {
    const reason = Dropdown.getValue('esc-reason');
    if (!reason) { showToast('Please select a reason'); return; }
    const note = document.getElementById('esc-note') ? document.getElementById('esc-note').value.trim() : '';
    const btn = document.getElementById('esc-submit');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Escalating...'; }
    try {
      await API.escalateError(id, { reason, note });
      Modal.close();
      showToast('Error escalated to Opportunity Education');
      await App.loadAndRender();
    } catch (e) {
      showToast(e.error || 'Escalation failed');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-arrow-up-right"></i> Escalate to OE'; }
    }
  }

  async function rate(token, rating) {
    try {
      await API.submitCsat(token, { rating });
      Modal.close();
      showToast('Thank you for your feedback!');
      await App.loadAndRender();
    } catch (e) { showToast('Could not submit feedback'); }
  }

  return { open, resolve, escalate, submitEscalation, rate };
})();

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  Modal.init();
  Auth.init();
  API.initSessionMonitor();
  Router.initHashListener();

  // Handle public teacher registration URL
  const teacherRegMatch = window.location.pathname.match(/\/register\/teacher\/([a-f0-9]+)/);
  if (teacherRegMatch) {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app-container').style.display = 'none';
    const regPage = document.getElementById('register-page');
    regPage.style.display = 'flex';
    await TeacherRegisterPage.init();
    document.getElementById('register-content').innerHTML = TeacherRegisterPage.render();
    return;
  }

  // Handle #register hash directly
  if (window.location.hash === '#register') {
    Auth.goRegister();
    return;
  }

  if (Auth.checkSession()) {
    App.init();
  }

  // Navigation clicks
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.addEventListener('click', () => {
      Router.navigate(el.dataset.page);
      App.loadAndRender();
    });
  });
});
