/**
 * Error Tracker Page
 */
const TrackerPage = (() => {
  let errors = [];
  let filter = 'all';
  let search = '';

  async function load() {
    try {
      errors = await API.getErrors();
    } catch (e) { errors = []; }
  }

  function setFilter(f) { filter = f; refreshTable(); updateChips(); }
  function setSearch(v) { search = v; refreshTable(); }

  function updateChips() {
    document.querySelectorAll('.tracker-chip').forEach(el => {
      el.classList.toggle('active', el.dataset.filter === filter);
    });
  }

  function render() {
    const counts = {
      all: errors.length,
      open: errors.filter(e => e.status === 'open').length,
      progress: errors.filter(e => e.status === 'progress').length,
      escalated: errors.filter(e => e.status === 'escalated').length,
      resolved: errors.filter(e => e.status === 'resolved').length
    };
    const chips = [['all', 'All'], ['open', 'Open'], ['progress', 'In Progress'], ['escalated', 'Escalated'], ['resolved', 'Resolved']];

    // Stale data must never look live, and a queued report must stay visible
    // until it is actually filed (docs/features/02-offline-pwa.md).
    const cachedAt = errors.length ? API.lastCachedAt('/errors') : null;
    const staleNote = cachedAt
      ? `<div class="alert-banner" style="background:rgba(99,106,130,0.10);border-color:var(--border)">
           <i class="ti ti-cloud-off" style="font-size:16px;color:var(--text3);flex-shrink:0"></i>
           <div class="alert-banner-text" style="flex:1;min-width:0;font-size:12px;color:var(--text2)">
             Showing saved data from ${relTime(cachedAt)} (${fmtDate(cachedAt)}) — no connection to the server.
           </div>
         </div>`
      : '';

    return `
    <div id="offline-queue-banner"></div>
    ${staleNote}
    <div class="tracker-sticky-header">
      <div class="section-header" style="position:static;margin:0;padding:0 0 14px;background:none;backdrop-filter:none">
        <div><div class="section-title">Error Tracker</div><div class="section-sub">All reported issues</div></div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <input type="text" placeholder="Search errors…" class="tracker-search" id="search-input" value="${esc(search)}" oninput="TrackerPage.setSearch(this.value)">
          ${API.getUser() && ['admin','subadmin'].includes(API.getUser().role) ? `<button class="btn btn-secondary btn-sm" data-tip="${TIP.EXPORT_CSV}" onclick="TrackerPage.exportCsv()"><i class="ti ti-download"></i> Export</button>` : ''}
          <button class="btn btn-primary btn-sm" onclick="Router.navigate('report');App.loadAndRender()"><i class="ti ti-plus"></i> New</button>
        </div>
      </div>
      <div class="chip-group">
        ${chips.map(([k, l]) => `<div class="chip tracker-chip ${filter === k ? 'active' : ''}" data-filter="${k}" onclick="TrackerPage.setFilter('${k}')">${l} (${counts[k]})</div>`).join('')}
      </div>
    </div>
    <div class="card" style="padding:0"><div class="table-wrap"><table>
      <thead><tr><th>ID</th><th>Error / School</th><th class="hide-mobile">Category</th><th>Priority</th><th>Status</th><th class="hide-mobile">Assigned</th><th class="hide-mobile">Reported</th><th>Action</th></tr></thead>
      <tbody id="error-tbody"></tbody>
    </table></div></div>`;
  }

  function refreshTable() {
    const tbody = document.getElementById('error-tbody');
    if (!tbody) return;
    const q = search.toLowerCase();
    let list = errors.filter(e => {
      const ms = filter === 'all' || e.status === filter;
      const mq = !q || e.title.toLowerCase().includes(q) || e.school_name.toLowerCase().includes(q) || e.error_code.toLowerCase().includes(q);
      return ms && mq;
    });

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty"><i class="ti ti-search-off"></i>No matching errors</div></td></tr>';
      return;
    }

    tbody.innerHTML = list.map(e => {
      const pri = PRI[e.priority] || PRI.medium;
      const stat = STAT[e.status] || STAT.open;
      const breach = slaState(e) === 'breach';
      return `<tr style="cursor:pointer" onclick="ErrorDetailModal.open(${e.id})">
        <td><span class="error-id">${e.error_code}</span></td>
        <td><span style="font-weight:500;font-size:13px">${esc(e.title)}</span><br><span style="font-size:11px;color:var(--text3)">${esc(e.school_name)}</span></td>
        <td class="hide-mobile"><span style="font-size:12px;color:var(--text2)"><i class="ti ${(CAT_META[e.category] || CAT_META.Other).ic}" style="color:${(CAT_META[e.category] || CAT_META.Other).color};font-size:13px;vertical-align:-2px;margin-right:4px"></i>${e.category}</span></td>
        <td><span class="badge ${pri.badge}">${pri.label}</span></td>
        <td><span class="badge ${stat.badge}">${stat.label}</span></td>
        <td class="hide-mobile" style="font-size:12px;color:var(--text2)">${e.assigned_name ? esc(e.assigned_name) : '<span style="color:var(--text3)">Unassigned</span>'}</td>
        <td class="hide-mobile" style="font-size:12px">
          <div style="color:var(--text2);font-weight:500">${e.created_at ? fmtDate(e.created_at) : '—'}</div>
          <div style="color:${breach ? 'var(--red)' : 'var(--text3)'};margin-top:2px">${ageStr(e.hours_open)}${breach ? ' <i class="ti ti-alert-triangle" style="font-size:11px"></i>' : ''}</div>
        </td>
        <td onclick="event.stopPropagation()"><div style="display:flex;gap:4px">
          ${e.status !== 'resolved' ? `<button class="btn btn-success btn-sm" style="padding:3px 8px" data-tip="${TIP.RESOLVE}" onclick="TrackerPage.resolve(${e.id})"><i class="ti ti-check" style="font-size:12px"></i></button>` : ''}
        </div></td></tr>`;
    }).join('');
  }

  async function resolve(id) {
    try {
      await API.updateErrorStatus(id, 'resolved');
      showToast('Error marked as resolved');
      await load();
      App.render();
    } catch (e) { showToast('Failed to resolve error'); }
  }

  async function exportCsv() {
    try {
      const params = {};
      if (filter !== 'all') params.status = filter;
      if (search.trim()) params.search = search.trim();
      const blob = await API.exportErrorsCsv(params);
      if (!blob || blob.size === 0) { showToast('No data to export'); return; }
      downloadBlob(blob, 'errors-export.csv');
      showToast('Export downloaded');
    } catch (e) {
      const msg = e && e.status === 403 ? 'Permission denied' : e && e.status === 401 ? 'Session expired — login again' : 'Export failed';
      showToast(msg);
    }
  }

  async function afterRender() {
    refreshTable();
    const slot = document.getElementById('offline-queue-banner');
    if (slot) slot.innerHTML = await Offline.banner();
  }

  return { load, render, afterRender, setFilter, setSearch, resolve, exportCsv };
})();
