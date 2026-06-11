/**
 * Frontend API Client - Include this script in the HTML frontend
 * to replace localStorage persistence with real backend API calls.
 *
 * Usage: Add <script src="/backend/src/utils/apiClient.js"></script> to the HTML
 * This provides a global `API` object for all backend interactions.
 */

const API = (() => {
  const BASE = '/api';
  let token = localStorage.getItem('qft_token') || null;

  function setToken(t) { token = t; localStorage.setItem('qft_token', t); }
  function clearToken() { token = null; localStorage.removeItem('qft_token'); }
  function getToken() { return token; }

  async function request(method, path, body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body && method !== 'GET') opts.body = JSON.stringify(body);

    const res = await fetch(BASE + path, opts);
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      clearToken();
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }

    if (!res.ok) throw { status: res.status, ...data };
    return data;
  }

  async function upload(path, formData) {
    const opts = {
      method: 'POST',
      headers: {}
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    opts.body = formData;

    const res = await fetch(BASE + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { status: res.status, ...data };
    return data;
  }

  return {
    setToken, clearToken, getToken,

    // Auth
    login: (username, password) => request('POST', '/auth/login', { username, password }),
    register: (data) => request('POST', '/auth/register', data),
    getProfile: () => request('GET', '/auth/profile'),
    changePassword: (data) => request('PUT', '/auth/change-password', data),

    // Dashboard
    getDashboard: () => request('GET', '/dashboard'),

    // Schools
    getSchools: () => request('GET', '/schools'),
    getSchool: (id) => request('GET', `/schools/${id}`),
    createSchool: (data) => request('POST', '/schools', data),
    updateSchool: (id, data) => request('PUT', `/schools/${id}`, data),
    reassignSchoolAdmin: (id, adminId) => request('PATCH', `/schools/${id}/assign`, { admin_id: adminId }),
    deleteSchool: (id) => request('DELETE', `/schools/${id}`),

    // Errors
    getErrors: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', '/errors' + (qs ? '?' + qs : ''));
    },
    getError: (id) => request('GET', `/errors/${id}`),
    getErrorStats: () => request('GET', '/errors/stats'),
    createError: (data) => request('POST', '/errors', data),
    updateError: (id, data) => request('PUT', `/errors/${id}`, data),
    updateErrorStatus: (id, status) => request('PATCH', `/errors/${id}/status`, { status }),
    addErrorUpdate: (id, data) => request('POST', `/errors/${id}/updates`, data),
    deleteError: (id) => request('DELETE', `/errors/${id}`),

    // Team
    getTeam: () => request('GET', '/team'),
    getTeamMember: (id) => request('GET', `/team/${id}`),
    createTeamMember: (data) => request('POST', '/team', data),
    updateTeamMember: (id, data) => request('PUT', `/team/${id}`, data),
    assignSchools: (id, schoolIds) => request('PATCH', `/team/${id}/schools`, { school_ids: schoolIds }),
    removeTeamMember: (id, reassignTo) => request('DELETE', `/team/${id}`, { reassign_to: reassignTo }),

    // Check-ins
    getCheckins: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', '/checkins' + (qs ? '?' + qs : ''));
    },
    getSchoolCheckins: (schoolId) => request('GET', `/checkins/school/${schoolId}`),
    getCheckinStats: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', '/checkins/stats' + (qs ? '?' + qs : ''));
    },
    createCheckin: (data) => request('POST', '/checkins', data),

    // Guides
    getGuides: () => request('GET', '/guides'),
    getGuide: (id) => request('GET', `/guides/${id}`),
    createGuide: (data) => request('POST', '/guides', data),
    updateGuide: (id, data) => request('PUT', `/guides/${id}`, data),
    deleteGuide: (id) => request('DELETE', `/guides/${id}`),

    // Manuals
    getManuals: () => request('GET', '/manuals'),
    uploadManual: (formData) => upload('/manuals', formData),
    downloadManual: (id) => `${BASE}/manuals/${id}/download`,
    deleteManual: (id) => request('DELETE', `/manuals/${id}`),

    // Communications
    getCommunications: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', '/communications' + (qs ? '?' + qs : ''));
    },
    createCommunication: (data) => request('POST', '/communications', data),
    deleteCommunication: (id) => request('DELETE', `/communications/${id}`),

    // Health
    health: () => request('GET', '/health')
  };
})();
