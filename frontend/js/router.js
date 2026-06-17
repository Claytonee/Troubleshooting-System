/**
 * Router Module
 * Handles page navigation with hash-based routing for persistence
 */
const Router = (() => {
  const validPages = ['dashboard', 'report', 'tracker', 'followup', 'weekly', 'schools', 'troubleshoot', 'manuals', 'analytics', 'team', 'schooladmins', 'branding', 'audit', 'search'];

  function getPageFromHash() {
    const hash = window.location.hash.replace('#', '');
    return validPages.includes(hash) ? hash : 'dashboard';
  }

  let currentPage = getPageFromHash();

  function navigate(page) {
    currentPage = page;
    window.location.hash = page;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
    if (window.innerWidth <= 920) closeSidebar();
    document.getElementById('main').scrollTop = 0;
  }

  function getCurrentPage() { return currentPage; }

  function toggleSidebar() {
    $('sidebar').classList.toggle('open');
    $('sb-backdrop').classList.toggle('show');
  }

  function closeSidebar() {
    $('sidebar').classList.remove('open');
    $('sb-backdrop').classList.remove('show');
  }

  function applyRoleVisibility() {
    const user = API.getUser();
    const hideAdmin = !user || user.role !== 'admin';
    document.querySelectorAll('[data-role="admin"]').forEach(el => el.classList.toggle('nav-hidden', hideAdmin));
    if (hideAdmin && ['analytics', 'team', 'schooladmins', 'branding', 'audit'].includes(currentPage)) {
      navigate('dashboard');
    }
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === currentPage));
  }

  function initHashListener() {
    window.addEventListener('hashchange', () => {
      const page = getPageFromHash();
      if (page !== currentPage) {
        currentPage = page;
        document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
        App.loadAndRender();
      }
    });
  }

  return { navigate, getCurrentPage, toggleSidebar, closeSidebar, applyRoleVisibility, initHashListener };
})();
