/**
 * Audit Log Page (platform-admin only)
 * Read-only trail of who changed what, when (Tier 1 #5).
 */
const AuditPage = (() => {
  let entries = [];
  let filterEntity = 'all';
  let search = '';

  const ENTITY_LABELS = {
    error: 'Errors',
    school_admin: 'School Admins',
    sub_admin: 'Sub-Admins',
    school: 'Schools'
  };

  const ACTION_META = {
    'error.created': { ic: 'ti-plus', color: 'var(--accent)' },
    'error.updated': { ic: 'ti-edit', color: 'var(--amber)' },
    'error.status_changed': { ic: 'ti-arrows-exchange', color: 'var(--amber)' },
    'error.note_added': { ic: 'ti-message', color: 'var(--text2)' },
    'error.deleted': { ic: 'ti-trash', color: 'var(--red)' },
    'school_admin.created': { ic: 'ti-user-plus', color: 'var(--green)' },
    'school_admin.updated': { ic: 'ti-user-edit', color: 'var(--amber)' },
    'school_admin.password_reset': { ic: 'ti-key', color: 'var(--purple)' },
    'school_admin.deleted': { ic: 'ti-user-minus', color: 'var(--red)' },
    'sub_admin.created': { ic: 'ti-user-plus', color: 'var(--green)' },
    'sub_admin.updated': { ic: 'ti-user-edit', color: 'var(--amber)' },
    'sub_admin.deleted': { ic: 'ti-user-minus', color: 'var(--red)' }
  };

  function actionMeta(action) {
    return ACTION_META[action] || { ic: 'ti-point', color: 'var(--text3)' };
  }

  async function load() {
    try {
      const params = {};
      if (filterEntity !== 'all') params.entity_type = filterEntity;
      if (search.trim()) params.search = search.trim();
      entries = await API.getAuditLog(params);
    } catch (e) { entries = []; }
  }

  async function setFilter(entity) {
    filterEntity = entity;
    await load();
    App.render();
  }

  let searchTimer = null;
  function setSearch(v) {
    search = v;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      await load();
      const main = document.querySelector('main');
      if (main) main.innerHTML = render();
      const box = main && main.querySelector('input[placeholder^="Search audit"]');
      if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
    }, 300);
  }

  function render() {
    const chips = ['all', ...Object.keys(ENTITY_LABELS)].map(k =>
      `<button class="chip ${k === filterEntity ? 'chip-active' : ''}" onclick="AuditPage.setFilter('${k}')">${k === 'all' ? 'All Activity' : ENTITY_LABELS[k]}</button>`
    ).join('');

    const rows = entries.length ? entries.map(e => {
      const m = actionMeta(e.action);
      return `<div class="card" style="padding:12px 14px;margin-bottom:8px">
        <div style="display:flex;align-items:flex-start;gap:12px">
          <div style="width:34px;height:34px;border-radius:9px;background:${m.color}15;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="ti ${m.ic}" style="font-size:17px;color:${m.color}"></i>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;color:var(--text);line-height:1.5">${esc(e.summary || e.action)}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:3px">
              <span style="font-weight:600">${esc(e.actor_name || 'System')}</span>
              ${e.actor_role ? ` · ${esc(e.actor_role)}` : ''}
              · <code style="font-size:10px">${esc(e.action)}</code>
              · ${relTime(e.created_at)}
            </div>
          </div>
        </div>
      </div>`;
    }).join('') : `<div class="empty"><i class="ti ti-history"></i>No activity recorded yet</div>`;

    return `
    <div class="section-header">
      <div>
        <div class="section-title">Audit Log</div>
        <div class="section-sub">Who changed what &amp; when — accountability across the team</div>
      </div>
    </div>

    <div style="margin-bottom:14px">
      <input type="text" placeholder="Search audit (summary or person)..." value="${esc(search)}"
        oninput="AuditPage.setSearch(this.value)" style="width:100%;max-width:420px;padding:9px 12px">
    </div>

    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap">${chips}</div>

    ${rows}`;
  }

  return { load, render, setFilter, setSearch };
})();
