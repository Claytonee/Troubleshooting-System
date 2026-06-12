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
    analytics: AnalyticsPage,
    team: TeamPage,
    branding: BrandingPage,
  };

  async function init() {
    Router.applyRoleVisibility();
    await loadAndRender();
    updateBadges();
  }

  async function updateBadges() {
    try {
      const d = await API.getDashboard();
      const open = parseInt(d.errors.open_count) || 0;
      const crit = parseInt(d.errors.critical_open) || 0;
      const fuCount = open;
      const navCrit = document.getElementById('nav-crit');
      const navTrack = document.getElementById('nav-track');
      const navFu = document.getElementById('nav-fu');
      if (navCrit) navCrit.textContent = crit > 0 ? crit : '';
      if (navTrack) navTrack.textContent = open > 0 ? open : '';
      if (navFu) navFu.textContent = fuCount > 0 ? fuCount : '';
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

    if (handler && handler.render) {
      main.innerHTML = handler.render();
      if (handler.afterRender) handler.afterRender();
    } else {
      main.innerHTML = `<div class="empty"><i class="ti ti-hammer"></i>Page "${page}" coming soon</div>`;
    }
    initScrollReveal();
  }

  function initScrollReveal() {
    const main = document.getElementById('main') || document.querySelector('.main');
    if (!main) return;
    const header = main.querySelector('.section-header');
    if (!header) return;
    main.onscroll = () => {
      header.classList.toggle('elevated', main.scrollTop > 20);
    };
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
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:12px;color:var(--text2)">
          <div><div style="color:var(--text3);font-size:11px">ASSIGNED TO</div>${esc(e.assigned_name || 'Unassigned')}</div>
          ${e.reporter_name ? `<div><div style="color:var(--text3);font-size:11px">REPORTED BY</div>${esc(e.reporter_name)}</div>` : ''}
          ${e.location ? `<div><div style="color:var(--text3);font-size:11px">LOCATION</div>${esc(e.location)}</div>` : ''}
        </div>
        ${(e.updates && e.updates.length) ? `<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)"><div style="font-size:11px;font-weight:600;color:var(--text3);margin-bottom:10px">UPDATES</div>
          ${e.updates.map(u => `<div style="background:var(--bg3);border-radius:6px;padding:8px 10px;margin-bottom:6px;font-size:12px"><span style="color:var(--text)">${esc(u.recorded_by)}</span> <span style="color:var(--text3)">· ${relTime(u.created_at)}</span><div style="color:var(--text2);margin-top:4px">${esc(u.note)}</div></div>`).join('')}
        </div>` : ''}`;

      const footer = e.status !== 'resolved'
        ? `<button class="btn btn-success" onclick="ErrorDetailModal.resolve(${e.id})"><i class="ti ti-check"></i> Mark Resolved</button>`
        : `<button class="btn btn-secondary" onclick="Modal.close()">Close</button>`;
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

  return { open, resolve };
})();

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  Modal.init();
  Auth.init();
  Router.initHashListener();
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
