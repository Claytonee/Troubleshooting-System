/**
 * Router Module
 * Handles page navigation with hash-based routing for persistence
 */
const Router = (() => {
  const validPages = ['dashboard', 'report', 'tracker', 'followup', 'weekly', 'schools', 'troubleshoot', 'manuals', 'analytics', 'team', 'schooladmins', 'branding', 'audit', 'search', 'chat', 'help', 'fieldguide', 'approvals', 'teachers', 'inventory', 'lrs', 'visits'];

  function getPageFromHash() {
    const hash = window.location.hash.replace('#', '');
    return validPages.includes(hash) ? hash : 'dashboard';
  }

  let currentPage = getPageFromHash();

  // Pages visited before the current one, most recent last. Drives the topbar
  // back arrow — the browser's own history is not enough, because in-page detail
  // views (a school, a guide) never push a hash entry.
  const pageStack = [];

  function navigate(page) {
    if (page !== currentPage) pageStack.push(currentPage);
    currentPage = page;
    window.location.hash = page;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
    if (window.innerWidth <= 920) closeSidebar();
    document.getElementById('main').scrollTop = 0;
  }

  function canGoBack() { return pageStack.length > 0 || currentPage !== 'dashboard'; }

  // Pops one entry, falling back to the dashboard so the arrow is never a dead end.
  function goBack() {
    const target = pageStack.pop() || 'dashboard';
    currentPage = target;
    window.location.hash = target;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === target));
    if (window.innerWidth <= 920) closeSidebar();
    const main = document.getElementById('main');
    if (main) main.scrollTop = 0;
    App.loadAndRender();
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

    const isSubadmin = role === 'subadmin';
    // Whoever goes out to schools. Not "staff", which includes school admins.
    const isField = isAdmin || isSubadmin;

    document.querySelectorAll('[data-role="admin"]').forEach(el => el.classList.toggle('nav-hidden', !isAdmin));
    document.querySelectorAll('[data-role="school"]').forEach(el => el.classList.toggle('nav-hidden', !isSchool));
    document.querySelectorAll('[data-role="school-teacher"]').forEach(el => el.classList.toggle('nav-hidden', !isSchool && !isTeacher));
    document.querySelectorAll('[data-role="staff"]').forEach(el => el.classList.toggle('nav-hidden', !isStaff));
    document.querySelectorAll('[data-role="subadmin"]').forEach(el => el.classList.toggle('nav-hidden', !isSubadmin));
    document.querySelectorAll('[data-role="field"]').forEach(el => el.classList.toggle('nav-hidden', !isField));
    document.querySelectorAll('[data-role="no-admin"]').forEach(el => el.classList.toggle('nav-hidden', isAdmin));

    const adminPages = ['analytics', 'schooladmins', 'branding', 'audit', 'approvals', 'lrs'];
    const schoolPages = ['help', 'teachers'];
    const subadminPages = ['fieldguide'];
    const staffPages = ['tracker', 'followup', 'weekly', 'schools'];
    const fieldPages = ['visits'];

    if (!isAdmin && adminPages.includes(currentPage)) navigate('dashboard');
    if (!isSchool && schoolPages.includes(currentPage)) navigate('dashboard');
    if (!isSubadmin && subadminPages.includes(currentPage)) navigate('dashboard');
    if (!isStaff && staffPages.includes(currentPage)) navigate('dashboard');
    if (!isField && fieldPages.includes(currentPage)) navigate('dashboard');


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
        // Browser back/forward: keep our own stack in step rather than growing it.
        if (pageStack[pageStack.length - 1] === page) pageStack.pop();
        else pageStack.push(currentPage);
        currentPage = page;
        document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
        App.loadAndRender();
      }
    });
  }

  return { navigate, getCurrentPage, toggleSidebar, closeSidebar, applyRoleVisibility, initHashListener, canGoBack, goBack };
})();
