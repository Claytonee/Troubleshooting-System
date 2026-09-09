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
    team: TeamPage,
    schooladmins: SchoolAdminsPage,
    branding: BrandingPage,
    audit: AuditPage,
    search: SearchPage,
    chat: ChatPage,
    help: HelpPage,
    fieldguide: FieldGuidePage,
    approvals: ApprovalsPage,
    teachers: TeachersPage,
    inventory: InventoryPage,
    lrs: LRSPage,
    visits: VisitsPage,
  };

  async function init() {
    Router.applyRoleVisibility();
    initPullToRefresh();
    await loadAndRender();
    updateBadges();
    setInterval(updateBadges, 30000);
  }

  /** Brand click — back to the dashboard. */
  function goHome() {
    if (Router.getCurrentPage() === 'dashboard') { const m = $('main'); if (m) m.scrollTop = 0; return; }
    Router.navigate('dashboard');
    loadAndRender();
  }

  /**
   * Topbar back arrow. A page showing an in-page detail view (a school, a guide)
   * closes that first, so one tap never skips past it to the previous page.
   */
  function goBack() {
    const handler = pages[Router.getCurrentPage()];
    if (handler && handler.canGoBack && handler.canGoBack()) { handler.goBack(); syncBackButton(); return; }
    Router.goBack();
  }

  function syncBackButton() {
    const btn = $('topbar-back');
    if (!btn) return;
    const handler = pages[Router.getCurrentPage()];
    const inDetail = !!(handler && handler.canGoBack && handler.canGoBack());
    btn.hidden = !(inDetail || Router.canGoBack());
  }

  /**
   * Pull-to-refresh. .main is the scroll container and the document itself never
   * scrolls, so the browser's native gesture never fires — this reproduces it.
   */
  function initPullToRefresh() {
    const main = $('main');
    const ind = $('ptr');
    if (!main || !ind || !('ontouchstart' in window)) return;

    const THRESHOLD = 68;   // pull distance that triggers a refresh
    const MAX = 96;         // furthest the indicator travels
    let startY = 0, pull = 0, tracking = false, busy = false;

    const place = y => { ind.style.transform = 'translate(-50%,' + y + 'px)'; };

    main.addEventListener('touchstart', e => {
      if (busy || e.touches.length !== 1 || main.scrollTop > 0) { tracking = false; return; }
      startY = e.touches[0].clientY;
      pull = 0;
      tracking = true;
    }, { passive: true });

    main.addEventListener('touchmove', e => {
      if (!tracking) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || main.scrollTop > 0) { if (pull) { pull = 0; ind.classList.remove('visible'); place(0); } return; }
      e.preventDefault();                       // hold the page still while pulling
      pull = Math.min(dy * 0.5, MAX);           // resistance, so it feels like a pull
      ind.classList.add('visible');
      ind.classList.toggle('ready', pull >= THRESHOLD);
      place(pull);
      ind.style.opacity = Math.min(pull / THRESHOLD, 1);
    }, { passive: false });

    const release = async () => {
      if (!tracking) return;
      tracking = false;
      const trigger = pull >= THRESHOLD;
      pull = 0;
      if (!trigger) { ind.classList.remove('visible', 'ready'); place(0); ind.style.opacity = ''; return; }
      busy = true;
      ind.classList.add('spinning');
      place(THRESHOLD);
      ind.style.opacity = 1;
      try { await loadAndRender(); await updateBadges(); }
      finally {
        ind.classList.remove('spinning', 'ready', 'visible');
        place(0);
        ind.style.opacity = '';
        busy = false;
      }
    };
    main.addEventListener('touchend', release, { passive: true });
    main.addEventListener('touchcancel', release, { passive: true });
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
    syncBackButton();
    initScrollReveal();
    mountQueueBanner();
  }

  /**
   * "N reports waiting to sync" belongs on every page, not just the tracker.
   *
   * It used to be rendered by tracker.js alone, so the two people most likely
   * to be offline never saw it: a teacher was sent to the dashboard after
   * queueing (and had no tracker at all), and a school admin working anywhere
   * else had no sign the queue existed — which is what "offline haifanyi kazi"
   * looked like from the outside (reported 2026-09-09). The queue is a property
   * of the device, so the banner is mounted by the shell.
   */
  function mountQueueBanner() {
    if (typeof Offline === 'undefined') return;
    const main = $('main');
    if (!main) return;
    // A page that carries its own slot (tracker) keeps filling that one, so the
    // banner does not appear twice.
    if (main.querySelector('#offline-queue-banner')) return;
    Offline.banner().then(html => {
      if (!html) {
        const stale = main.querySelector('#offline-queue-banner-global');
        if (stale) stale.remove();
        return;
      }
      let slot = main.querySelector('#offline-queue-banner-global');
      if (!slot) {
        slot = document.createElement('div');
        slot.id = 'offline-queue-banner-global';
        const header = main.querySelector('.section-header, .tracker-sticky-header');
        if (header && header.parentNode === main) main.insertBefore(slot, header.nextSibling);
        else main.insertBefore(slot, main.firstChild);
      }
      slot.innerHTML = html;
    }).catch(() => {});
  }

  function initScrollReveal() {
    const main = document.querySelector('.main');
    if (!main) return;

    // Sticky header elevation on scroll. Bound once — render() runs on every
    // navigation, and re-adding the listener each time leaked one per page view.
    if (!main.dataset.elevationBound) {
      main.dataset.elevationBound = '1';
      main.addEventListener('scroll', () => {
        const h = main.querySelector('.section-header');
        if (h) h.classList.toggle('elevated', main.scrollTop > 10);
      }, { passive: true });
    }
    const header = main.querySelector('.section-header');
    if (header) header.classList.toggle('elevated', main.scrollTop > 10);

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

  return { init, render, loadAndRender, goHome, goBack, syncBackButton, refreshQueueBanner: mountQueueBanner };
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

      const user = API.getUser();
      // Rating a resolution belongs to the school: the teacher who reported it
      // and their school administrator. The server decides (can_rate) and only
      // hands the token to them — a platform admin scoring their own team's
      // work is not feedback.
      const csatBlock = e.status === 'resolved' ? `
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
          <div style="font-size:11px;font-weight:600;color:var(--text3);margin-bottom:8px">SATISFACTION</div>
          ${e.csat_rating != null
            ? `<div style="font-size:13px;color:var(--text2)">Rated <strong style="color:var(--amber)">${e.csat_rating}/5</strong>${e.csat_comment ? ` — &ldquo;${esc(e.csat_comment)}&rdquo;` : ''}</div>`
            : (e.can_rate && e.csat_token
                ? `<div style="font-size:12px;color:var(--text3);margin-bottom:6px">How well was this resolved?</div>
                   <div style="display:flex;gap:6px;flex-wrap:wrap">${[1, 2, 3, 4, 5].map(n => `<button class="btn btn-secondary btn-sm" style="padding:4px 10px" onclick="ErrorDetailModal.rate('${e.csat_token}', ${n})">${n}&#9733;</button>`).join('')}</div>`
                : '<div style="font-size:12px;color:var(--text3)">Not yet rated. The teacher who reported it, or the school administrator, can rate it.</div>')}
        </div>` : '';

      const body = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <span class="badge ${pri.badge}">${pri.label}</span>
          <span class="badge ${stat.badge}">${stat.label}</span>
          ${breach ? '<span class="badge badge-red">SLA Breach</span>' : ''}
          <span style="margin-left:auto" class="error-id">${e.error_code}</span>
        </div>
        <div style="font-size:16px;font-weight:600;margin-bottom:4px">${esc(e.title)}</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:16px">${esc(e.school_name)} · ${e.category} · Reported ${e.created_at ? fmtDate(e.created_at) : ageStr(e.hours_open)}${intakeLabel(e)}</div>
        <div style="background:var(--bg3);border-radius:8px;padding:12px;font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:14px">${esc(e.description || 'No description')}</div>
        ${e.escalation_level === 'platform' ? `<div style="background:rgba(155,125,255,0.08);border:1px solid rgba(155,125,255,0.2);border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
          <i class="ti ti-arrow-up-right" style="font-size:16px;color:var(--purple)"></i>
          <div style="font-size:12px;color:var(--purple);font-weight:500">Escalated to Opportunity Education Tanzania</div>
        </div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:12px;color:var(--text2)">
          ${e.assigned_to != user.id ? `<div><div style="color:var(--text3);font-size:11px">ASSIGNED TO</div>${esc(e.assigned_name || 'Unassigned')}</div>` : ''}
          ${e.reporter_name ? `<div><div style="color:var(--text3);font-size:11px">REPORTED BY</div>${esc(e.reporter_name)}</div>` : ''}
          ${e.location ? `<div><div style="color:var(--text3);font-size:11px">LOCATION</div>${esc(e.location)}</div>` : ''}
        </div>
        ${(e.attachments && e.attachments.length) ? `<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)"><div style="font-size:11px;font-weight:600;color:var(--text3);margin-bottom:10px">ATTACHMENTS</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${e.attachments.map(a => {
            if (a.file_type && a.file_type.startsWith('image/')) {
              return `<a href="${a.stored_url}" target="_blank" style="display:block;width:80px;height:80px;border-radius:8px;overflow:hidden;border:1px solid var(--border)"><img src="${a.stored_url}" style="width:100%;height:100%;object-fit:cover" alt="${esc(a.original_filename)}"></a>`;
            } else if (a.file_type && a.file_type.startsWith('audio/')) {
              return `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:11px"><i class="ti ti-music" style="color:var(--green);margin-right:4px"></i>${esc(a.original_filename)}<audio controls style="display:block;margin-top:6px;height:28px;width:200px"><source src="${a.stored_url}" type="${a.file_type}"></audio></div>`;
            } else if (a.file_type && a.file_type.startsWith('video/')) {
              return `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px;width:200px"><video controls style="width:100%;border-radius:6px;max-height:120px"><source src="${a.stored_url}" type="${a.file_type}"></video><div style="font-size:10px;color:var(--text3);margin-top:4px">${esc(a.original_filename)}</div></div>`;
            } else {
              return `<a href="${a.stored_url}" target="_blank" style="display:flex;align-items:center;gap:6px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:12px;color:var(--accent);text-decoration:none"><i class="ti ti-file-download"></i>${esc(a.original_filename)}</a>`;
            }
          }).join('')}
          </div>
        </div>` : ''}
        ${(e.updates && e.updates.length) ? `<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)"><div style="font-size:11px;font-weight:600;color:var(--text3);margin-bottom:10px">UPDATES</div>
          ${e.updates.map(u => { let note = u.note || ''; if (e.assigned_to == user.id) { const prefix = 'Assigned to ' + (e.assigned_name || ''); if (note.startsWith(prefix + '.')) note = note.substring(prefix.length + 1).trim(); else if (note === prefix) note = ''; } return `<div style="background:var(--bg3);border-radius:6px;padding:8px 10px;margin-bottom:6px;font-size:12px"><span style="color:var(--text)">${esc(u.recorded_by)}</span> <span style="color:var(--text3)">· ${relTime(u.created_at)}</span>${note ? `<div style="color:var(--text2);margin-top:4px">${esc(note)}</div>` : ''}</div>`; }).join('')}
        </div>` : ''}
        ${csatBlock}`;

      const isAdminUser = user && user.role === 'admin';
      const canEscalate = e.status !== 'resolved' && e.escalation_level !== 'platform' && user && user.role === 'school';
      // A teacher reports and rates; they do not close the ticket. Closing it
      // was the one action they had, and it skipped the person who fixes it.
      const canResolve = e.status !== 'resolved' && !(user && user.role === 'teacher');
      const canAssign = isAdminUser && e.status !== 'resolved';

      let footer = '';
      if (canResolve || canEscalate || canAssign) {
        footer += '<div style="display:flex;gap:10px;width:100%;align-items:center">';
        if (canEscalate) {
          footer += `<button class="btn btn-danger btn-sm" style="display:inline-flex;align-items:center;gap:6px" data-tip="Escalate to OE · Forward this error to Opportunity Education platform team for immediate support and resolution" data-tip-color="red" onclick="ErrorDetailModal.escalate(${e.id})"><i class="ti ti-arrow-up-right"></i> Escalate to OE</button>`;
        }
        if (canAssign) {
          footer += `<button class="btn btn-secondary btn-sm" style="display:inline-flex;align-items:center;gap:6px" onclick="ErrorDetailModal.openAssign(${e.id})"><i class="ti ti-user-share"></i> Assign</button>`;
        }
        footer += '<div style="flex:1"></div>';
        if (canResolve) {
          footer += `<button class="btn btn-success" data-tip="Mark Resolved · Close this error as resolved — the reporter will be notified and asked for satisfaction feedback" data-tip-color="green" onclick="ErrorDetailModal.resolve(${e.id})"><i class="ti ti-check"></i> Mark Resolved</button>`;
        }
        footer += '</div>';
      } else {
        footer = `<button class="btn btn-secondary" onclick="Modal.close()">Close</button>`;
      }
      Modal.open('Error Detail', body, footer);
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

  async function openAssign(id) {
    let team = [];
    try { team = await API.getTeam(); } catch (e) {}
    const items = team.map(t => ({ value: t.id, label: t.full_name, tag: t.zone || '' }));
    const body = `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="font-size:13px;color:var(--text2)">Select a sub-admin (field engineer) to handle this error.</div>
        <div class="form-group">
          <label>Assign to</label>
          ${Dropdown.render('assign-to', 'Select sub-admin', items)}
        </div>
        <div class="form-group">
          <label>Note (optional)</label>
          <textarea id="assign-note" rows="2" placeholder="Instructions or context for the assignee..." style="font-size:13px"></textarea>
        </div>
      </div>`;
    const footer = `
      <button class="btn btn-secondary" onclick="ErrorDetailModal.open(${id})">Cancel</button>
      <button class="btn btn-primary" id="assign-submit" onclick="ErrorDetailModal.submitAssign(${id})"><i class="ti ti-user-share"></i> Assign</button>`;
    Modal.open('Assign Error', body, footer);
  }

  async function submitAssign(id) {
    const assignedTo = Dropdown.getValue('assign-to');
    if (!assignedTo) { showToast('Please select a sub-admin'); return; }
    const note = document.getElementById('assign-note') ? document.getElementById('assign-note').value.trim() : '';
    const btn = document.getElementById('assign-submit');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Assigning...'; }
    try {
      await API.assignError(id, { assigned_to: assignedTo, note });
      Modal.close();
      showToast('Error assigned successfully');
      await App.loadAndRender();
    } catch (e) {
      showToast(e.error || 'Assignment failed');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-user-share"></i> Assign'; }
    }
  }

  return { open, resolve, escalate, submitEscalation, rate, openAssign, submitAssign };
})();

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  Modal.init();
  Auth.init();
  API.initSessionMonitor();
  Router.initHashListener();
  // Drains anything queued while offline, and keeps the pending badge current.
  // Guarded with typeof, not window.Offline: offline.js declares Offline with
  // const, which is a script-scope binding and never a window property.
  if (typeof Offline !== 'undefined') {
    Offline.init();
    // Keep the shell's banner honest without waiting for a navigation: it must
    // appear the moment something is queued and vanish the moment it drains.
    Offline.onChange(() => App.refreshQueueBanner());
  }

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
