/**
 * API Client Module
 * Handles all communication with the backend server
 */
const API = (() => {
  const BASE = '/api';
  const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes inactivity
  let _inactivityTimer = null;

  function getToken() { return localStorage.getItem('qft_token'); }
  function setToken(t) { localStorage.setItem('qft_token', t); resetInactivityTimer(); }
  function clearToken() { localStorage.removeItem('qft_token'); clearInactivityTimer(); }
  function getUser() { const u = localStorage.getItem('qft_user'); return u ? JSON.parse(u) : null; }
  function setUser(u) { localStorage.setItem('qft_user', JSON.stringify(u)); }
  function clearUser() { localStorage.removeItem('qft_user'); }
  function isLoggedIn() { return !!getToken(); }

  // When a GET was served from the service-worker cache, keyed by path — a
  // single shared value let one endpoint's staleness mislabel another's data.
  const _cachedAt = new Map();
  function lastCachedAt(path) { return path ? (_cachedAt.get(path) || null) : null; }

  function resetInactivityTimer() {
    clearInactivityTimer();
    if (!getToken()) return;
    _inactivityTimer = setTimeout(() => {
      clearToken();
      clearUser();
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }, SESSION_TIMEOUT);
  }

  function clearInactivityTimer() {
    if (_inactivityTimer) { clearTimeout(_inactivityTimer); _inactivityTimer = null; }
  }

  function initSessionMonitor() {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(ev => document.addEventListener(ev, () => {
      if (getToken()) resetInactivityTimer();
    }, { passive: true }));
    if (getToken()) resetInactivityTimer();
  }

  async function request(method, path, body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    const token = getToken();
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body && method !== 'GET') opts.body = JSON.stringify(body);

    let res;
    try {
      res = await fetch(BASE + path, opts);
    } catch (err) {
      // The request never reached the server — a dead uplink, not a rejection.
      // Callers branch on this to queue writes (js/offline.js).
      throw { status: 0, offline: true, error: 'No connection to the server.', cause: err };
    }
    const data = await res.json().catch(() => ({}));

    // The service worker stamps a cached fallback so pages can label stale
    // data instead of presenting it as live (docs/features/02-offline-pwa.md).
    const cachedAt = res.headers.get('X-OE-Cached-At');
    if (cachedAt) _cachedAt.set(path, cachedAt); else if (res.ok) _cachedAt.delete(path);

    if (res.status === 401 && !path.includes('/auth/login')) {
      clearToken();
      clearUser();
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    if (!res.ok) throw { status: res.status, ...data };
    return data;
  }

  async function upload(path, formData) {
    const opts = { method: 'POST', headers: {} };
    const token = getToken();
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    opts.body = formData;
    const res = await fetch(BASE + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { status: res.status, ...data };
    return data;
  }

  return {
    getToken, setToken, clearToken, getUser, setUser, clearUser, isLoggedIn, lastCachedAt,
    login: (username, password) => request('POST', '/auth/login', { username, password }),
    getProfile: () => request('GET', '/auth/profile'),
    updateProfile: (data) => request('PUT', '/auth/profile', data),
    uploadAvatar: (formData) => {
      const token = getToken();
      if (!token) return Promise.reject({ error: 'Not authenticated — please log in again' });
      return fetch('/api/auth/profile/avatar', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: formData
      }).then(async r => {
        const text = await r.text();
        let d;
        try { d = JSON.parse(text); } catch (e) { throw { error: `Server error (${r.status})` }; }
        if (!r.ok) throw d;
        return d;
      });
    },
    changePassword: (data) => request('PUT', '/auth/change-password', data),
    getDashboard: () => request('GET', '/dashboard'),
    getSchools: () => request('GET', '/schools'),
    getSchool: (id) => request('GET', `/schools/${id}`),
    createSchool: (data) => request('POST', '/schools', data),
    updateSchool: (id, data) => request('PUT', `/schools/${id}`, data),
    deleteSchool: (id) => request('DELETE', `/schools/${id}`),
    reassignSchoolAdmin: (id, adminId) => request('PATCH', `/schools/${id}/assign`, { admin_id: adminId }),
    getSchoolForms: (id) => request('GET', `/schools/${id}/forms`),
    saveSchoolForms: (id, forms) => request('PUT', `/schools/${id}/forms`, { forms }),
    bulkImportSchools: (schools) => request('POST', '/schools/bulk-import', { schools }),
    getErrors: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request('GET', '/errors' + (qs ? '?' + qs : '')); },
    getError: (id) => request('GET', `/errors/${id}`),
    getErrorStats: () => request('GET', '/errors/stats'),
    createError: (data) => request('POST', '/errors', data),
    updateErrorStatus: (id, status) => request('PATCH', `/errors/${id}/status`, { status }),
    escalateError: (id, data) => request('POST', `/errors/${id}/escalate`, data),
    assignError: (id, data) => request('PATCH', `/errors/${id}/assign`, data),
    addErrorUpdate: (id, data) => request('POST', `/errors/${id}/updates`, data),
    getTeam: () => request('GET', '/team'),
    getTeamMember: (id) => request('GET', `/team/${id}`),
    createTeamMember: (data) => request('POST', '/team', data),
    updateTeamMember: (id, data) => request('PUT', `/team/${id}`, data),
    removeTeamMember: (id, reassignTo) => request('DELETE', `/team/${id}`, { reassign_to: reassignTo }),
    resetTeamPassword: (id, password) => request('PATCH', `/team/${id}/reset-password`, { password }),
    getSchoolAdmins: () => request('GET', '/school-admins'),
    getSchoolAdmin: (id) => request('GET', `/school-admins/${id}`),
    createSchoolAdmin: (data) => request('POST', '/school-admins', data),
    updateSchoolAdmin: (id, data) => request('PUT', `/school-admins/${id}`, data),
    resetSchoolAdminPassword: (id, newPassword) => request('PATCH', `/school-admins/${id}/password`, { new_password: newPassword }),
    deleteSchoolAdmin: (id) => request('DELETE', `/school-admins/${id}`),
    getCheckins: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request('GET', '/checkins' + (qs ? '?' + qs : '')); },
    getSchoolCheckins: (schoolId) => request('GET', `/checkins/school/${schoolId}`),
    createCheckin: (data) => request('POST', '/checkins', data),
    getGuides: () => request('GET', '/guides'),
    createGuide: (data) => request('POST', '/guides', data),
    updateGuide: (id, data) => request('PUT', `/guides/${id}`, data),
    deleteGuide: (id) => request('DELETE', `/guides/${id}`),
    escalateGuide: (id) => request('POST', `/guides/${id}/escalate`),
    getManuals: () => request('GET', '/manuals'),
    uploadManual: (formData) => upload('/manuals', formData),
    addManualLink: (data) => request('POST', '/manuals/link', data),
    getManualDownload: (id) => request('GET', `/manuals/${id}/download`),
    deleteManual: (id) => request('DELETE', `/manuals/${id}`),
    getCommunications: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request('GET', '/communications' + (qs ? '?' + qs : '')); },
    createCommunication: (data) => request('POST', '/communications', data),
    getSettings: () => request('GET', '/settings'),
    updateSettings: (data) => request('PUT', '/settings', data),
    getAuditLog: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request('GET', '/audit' + (qs ? '?' + qs : '')); },
    search: (q) => request('GET', '/search?q=' + encodeURIComponent(q)),
    getAiChats: () => request('GET', '/ai/chats'),
    getAiChat: (id) => request('GET', `/ai/chats/${id}`),
    deleteAiChat: (id) => request('DELETE', `/ai/chats/${id}`),
    submitCsat: (token, data) => request('POST', `/errors/csat/${token}`, data),
    exportErrorsCsv: async (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(BASE + '/errors/export' + (qs ? '?' + qs : ''), { headers: { 'Authorization': `Bearer ${getToken()}` } });
      if (!res.ok) throw { status: res.status };
      return res.blob();
    },
    getInventory: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request('GET', '/inventory' + (qs ? '?' + qs : '')); },
    getInventoryStats: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request('GET', '/inventory/stats' + (qs ? '?' + qs : '')); },
    getRefreshPlan: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request('GET', '/inventory/refresh-plan' + (qs ? '?' + qs : '')); },
    getDeviceBatches: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request('GET', '/inventory/batches' + (qs ? '?' + qs : '')); },
    getDevice: (id) => request('GET', `/inventory/${id}`),
    createDevice: (data) => request('POST', '/inventory', data),
    updateDevice: (id, data) => request('PUT', `/inventory/${id}`, data),
    assignDevice: (id, data) => request('PATCH', `/inventory/${id}/assign`, data),
    changeDeviceStatus: (id, data) => request('PATCH', `/inventory/${id}/status`, data),
    bulkImportDevices: (data) => request('POST', '/inventory/bulk-import', data),
    deleteDevice: (id) => request('DELETE', `/inventory/${id}`),
    exportInventoryCsv: async (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(BASE + '/inventory/export' + (qs ? '?' + qs : ''), { headers: { 'Authorization': `Bearer ${getToken()}` } });
      if (!res.ok) throw { status: res.status };
      return res.blob();
    },

    // LRS Inventory (admin-only)
    getLRS: () => request('GET', '/lrs'),
    getLRSStats: () => request('GET', '/lrs/stats'),
    getLRSDevice: (id) => request('GET', `/lrs/${id}`),
    createLRS: (data) => request('POST', '/lrs', data),
    updateLRS: (id, data) => request('PUT', `/lrs/${id}`, data),
    changeLRSStatus: (id, data) => request('PATCH', `/lrs/${id}/status`, data),
    deleteLRS: (id) => request('DELETE', `/lrs/${id}`),

    initSessionMonitor,
  };
})();
