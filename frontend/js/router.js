/**
 * Router Module
 * Handles page navigation with hash-based routing for persistence
 */
const Router = (() => {
  const validPages = ['dashboard', 'report', 'tracker', 'followup', 'weekly', 'schools', 'troubleshoot', 'manuals', 'analytics', 'schooladmins', 'branding', 'audit', 'search', 'chat', 'help', 'approvals', 'teachers', 'inventory'];

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
    const role = user ? user.role : '';
    const isAdmin = role === 'admin';
    const isSchool = role === 'school';
    const isTeacher = role === 'teacher';
    const isStaff = isAdmin || role === 'subadmin' || isSchool;

    document.querySelectorAll('[data-role="admin"]').forEach(el => el.classList.toggle('nav-hidden', !isAdmin));
    document.querySelectorAll('[data-role="school"]').forEach(el => el.classList.toggle('nav-hidden', !isSchool));
    document.querySelectorAll('[data-role="school-teacher"]').forEach(el => el.classList.toggle('nav-hidden', !isSchool && !isTeacher));
    document.querySelectorAll('[data-role="staff"]').forEach(el => el.classList.toggle('nav-hidden', !isStaff));
    document.querySelectorAll('[data-role="no-admin"]').forEach(el => el.classList.toggle('nav-hidden', isAdmin));

    const adminPages = ['analytics', 'schooladmins', 'branding', 'audit', 'approvals'];
    const schoolPages = ['help', 'teachers'];
    const staffPages = ['tracker', 'followup', 'weekly', 'schools'];

    if (!isAdmin && adminPages.includes(currentPage)) navigate('dashboard');
    if (!isSchool && schoolPages.includes(currentPage)) navigate('dashboard');
    if (!isStaff && staffPages.includes(currentPage)) navigate('dashboard');
    if ((isAdmin || role === 'subadmin') && currentPage === 'chat') navigate('dashboard');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === currentPage));
  }

  function initHashListener() {
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'register') {
        Auth.goRegister();
        return;
      }
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
