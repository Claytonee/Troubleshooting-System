/**
 * Troubleshooting Guides — Knowledge Base
 * Design inspired by Zendesk Guide, ServiceNow KB, Intercom Articles
 */
const GuidesPage = (() => {
  let guides = [];
  let activeCategory = 'all';
  let searchQuery = '';
  let selectedId = null;
  let completedSteps = {};
  let editingId = null;

  async function load() {
    try { guides = await API.getGuides(); } catch (e) { guides = []; }
  }

  function setCategory(cat) { activeCategory = cat; selectedId = null; App.render(); }
  function setSearch(q) { searchQuery = q.toLowerCase(); App.render(); }

  function selectGuide(id) {
    selectedId = selectedId === id ? null : id;
    App.render();
    if (selectedId) setTimeout(() => { const el = document.getElementById('guide-detail'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
  }

  function toggleStep(guideId, stepIdx) {
    const key = `${guideId}`;
    if (!completedSteps[key]) completedSteps[key] = [];
    const idx = completedSteps[key].indexOf(stepIdx);
    if (idx >= 0) completedSteps[key].splice(idx, 1);
    else completedSteps[key].push(stepIdx);
    App.render();
  }

  function resetProgress(guideId) { delete completedSteps[`${guideId}`]; App.render(); }

  function getCategories() { return [...new Set(guides.map(g => g.category))].sort(); }

  const catMeta = {
    'Connectivity': { icon: 'ti-wifi', color: '#4f7cff', label: 'Network & Internet' },
    'Hardware': { icon: 'ti-cpu', color: '#f5a623', label: 'Devices & Equipment' },
    'Platform': { icon: 'ti-app-window', color: '#9b7dff', label: 'Software & Platform' },
    'Power': { icon: 'ti-bolt', color: '#ff5263', label: 'Power & Electrical' },
    'Accounts': { icon: 'ti-user-circle', color: '#36d9cc', label: 'User Accounts' },
    'Other': { icon: 'ti-tools', color: '#36d9cc', label: 'General' }
  };

  // Custom categories get a deterministic color from the palette and a generic icon.
  const catPalette = ['#4f7cff', '#f5a623', '#9b7dff', '#36d9cc', '#2dd98a', '#ff5263'];
  function getMeta(cat) {
    if (catMeta[cat]) return catMeta[cat];
    let h = 0;
    for (const c of String(cat)) h = (h * 31 + c.charCodeAt(0)) % 997;
    return { icon: 'ti-tools', color: catPalette[h % catPalette.length], label: cat };
  }

  function getFilteredGuides() {
    return guides.filter(g => {
      if (activeCategory !== 'all' && g.category !== activeCategory) return false;
      if (searchQuery && !g.title.toLowerCase().includes(searchQuery) && !g.category.toLowerCase().includes(searchQuery) && !g.steps.some(s => s.toLowerCase().includes(searchQuery))) return false;
      return true;
    });
  }

  function getRelatedGuides(current) {
    return guides.filter(g => g.id !== current.id && g.category === current.category).slice(0, 2);
  }

  function render() {
    const categories = getCategories();
    const filtered = getFilteredGuides();
    const selected = guides.find(g => g.id === selectedId);
    const user = API.getUser();
    const isAdmin = user && user.role === 'admin';

    if (selected) {
      return `
      <div class="section-header">
        <div style="display:flex;align-items:center;gap:10px">
          <button onclick="GuidesPage.selectGuide(null)" style="padding:7px 14px;font-size:12px;background:rgba(79,124,255,.12);color:var(--accent);border:1px solid rgba(79,124,255,.25);border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><i class="ti ti-arrow-left" style="font-size:13px"></i> All Guides</button>
          <span style="font-size:11px;color:var(--text3)">/ ${esc(selected.category)} / ${esc(selected.title)}</span>
        </div>
        ${isAdmin ? `<button onclick="GuidesPage.openEdit(${selected.id})" style="padding:7px 14px;font-size:12px;background:rgba(79,124,255,.12);color:var(--accent);border:1px solid rgba(79,124,255,.25);border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><i class="ti ti-pencil" style="font-size:12px"></i> Edit</button>` : ''}
      </div>
      ${renderDetailView(selected)}`;
    }

    return `
    <div class="section-header">
      <div>
        <div class="section-title">Troubleshooting Guides</div>
        <div class="section-sub">Knowledge base · ${guides.length} articles</div>
      </div>
      ${isAdmin ? `<button class="btn btn-primary" data-tip="${TIP.ADD_GUIDE}" onclick="GuidesPage.openAdd()"><i class="ti ti-plus"></i> Add Guide</button>` : ''}
    </div>
    ${renderListView(categories, filtered)}`;
  }

  function renderListView(categories, filtered) {
    const catCounts = {};
    guides.forEach(g => { catCounts[g.category] = (catCounts[g.category] || 0) + 1; });

    return `
    <div class="card reveal" style="padding:14px 18px;margin-bottom:16px">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <div style="position:relative;flex:1;min-width:200px">
          <i class="ti ti-search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:15px"></i>
          <input type="text" placeholder="Search by issue, keyword, or step..." value="${esc(searchQuery)}" oninput="GuidesPage.setSearch(this.value)" style="width:100%;padding:9px 12px 9px 34px;background:var(--bg1);border:1px solid var(--border);border-radius:6px;color:var(--text1);font-size:13px">
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap">
          <button class="btn btn-sm ${activeCategory === 'all' ? 'btn-primary' : ''}" onclick="GuidesPage.setCategory('all')" style="padding:6px 12px;font-size:11px">All <span style="opacity:.7;margin-left:2px">${guides.length}</span></button>
          ${categories.map(cat => {
            const m = getMeta(cat);
            return `<button class="btn btn-sm ${activeCategory === cat ? 'btn-primary' : ''}" onclick="GuidesPage.setCategory('${esc(cat)}')" style="padding:6px 12px;font-size:11px;gap:5px"><i class="ti ${m.icon}" style="font-size:12px;${activeCategory !== cat ? 'color:' + m.color : ''}"></i>${esc(cat)} <span style="opacity:.6">${catCounts[cat] || 0}</span></button>`;
          }).join('')}
        </div>
      </div>
    </div>

    ${!filtered.length ? renderEmptyState() : `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(320px,100%),1fr));gap:12px">
      ${filtered.map(g => renderArticleCard(g)).join('')}
    </div>`}`;
  }

  function renderArticleCard(g) {
    const m = getMeta(g.category);
    const done = (completedSteps[`${g.id}`] || []);
    const isComplete = done.length === g.steps.length && done.length > 0;
    const hasProgress = done.length > 0 && !isComplete;
    const pct = g.steps.length ? Math.round((done.length / g.steps.length) * 100) : 0;
    const readTime = Math.max(2, Math.ceil(g.steps.length * 1.5));

    return `<div class="card reveal" style="padding:18px 20px;cursor:pointer;border-left:3px solid ${m.color};transition:all .15s" onclick="GuidesPage.selectGuide(${g.id})" onmouseover="this.style.borderColor='${m.color}';this.style.background='var(--bg3)'" onmouseout="this.style.background='';this.style.borderColor=''">
      <div style="display:flex;align-items:flex-start;gap:14px">
        <div style="width:40px;height:40px;background:${m.color}30;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="ti ${g.icon || m.icon}" style="color:#fff;font-size:19px"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;color:var(--text1);margin-bottom:6px;line-height:1.4">${esc(g.title)}</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:10px;padding:2px 7px;border-radius:4px;background:${m.color}22;color:${m.color};font-weight:500">${esc(g.category)}</span>
            <span style="font-size:10px;color:var(--text3);display:flex;align-items:center;gap:3px"><i class="ti ti-list-numbers" style="font-size:11px"></i>${g.steps.length} steps</span>
            <span style="font-size:10px;color:var(--text3);display:flex;align-items:center;gap:3px"><i class="ti ti-clock" style="font-size:11px"></i>${readTime} min</span>
          </div>
          ${hasProgress ? `<div style="margin-top:8px;display:flex;align-items:center;gap:8px"><div style="flex:1;height:3px;background:var(--border);border-radius:2px;overflow:hidden"><div style="width:${pct}%;height:100%;background:var(--green);border-radius:2px"></div></div><span style="font-size:10px;color:var(--green);font-weight:500">${pct}%</span></div>` : ''}
          ${isComplete ? `<div style="margin-top:8px;font-size:10px;color:var(--green);font-weight:500;display:flex;align-items:center;gap:4px"><i class="ti ti-circle-check-filled" style="font-size:12px"></i>Completed</div>` : ''}
        </div>
        <i class="ti ti-arrow-right" style="color:var(--text3);font-size:14px;margin-top:2px;flex-shrink:0"></i>
      </div>
    </div>`;
  }

  function renderDetailView(g) {
    const m = getMeta(g.category);
    const user = API.getUser();
    const isAdmin = user && user.role === 'admin';
    const done = completedSteps[`${g.id}`] || [];
    const allDone = done.length === g.steps.length;
    const pct = g.steps.length ? Math.round((done.length / g.steps.length) * 100) : 0;
    const readTime = Math.max(2, Math.ceil(g.steps.length * 1.5));
    const related = getRelatedGuides(g);

    return `
    <div id="guide-detail">
      <div class="guide-detail-grid">
        <!-- Main content -->
        <div class="card" style="padding:0;overflow:hidden">
          <div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:14px">
            <div style="width:38px;height:38px;background:${m.color}20;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <i class="ti ${g.icon || m.icon}" style="color:${m.color};font-size:18px"></i>
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:14px;color:var(--text1);line-height:1.3">${esc(g.title)}</div>
              <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
                <span style="font-size:10px;padding:2px 7px;border-radius:4px;background:${m.color}15;color:${m.color};font-weight:500">${esc(g.category)}</span>
                <span style="font-size:10px;color:var(--text3)"><i class="ti ti-list-numbers" style="font-size:10px"></i> ${g.steps.length} steps</span>
                <span style="font-size:10px;color:var(--text3)"><i class="ti ti-clock" style="font-size:10px"></i> ${readTime} min</span>
              </div>
            </div>
          </div>

          ${allDone ? `<div style="padding:10px 22px;background:rgba(45,217,138,0.05);border-bottom:1px solid rgba(45,217,138,0.12);display:flex;align-items:center;gap:8px">
            <i class="ti ti-circle-check-filled" style="color:var(--green);font-size:16px"></i>
            <span style="font-size:12px;font-weight:500;color:var(--green)">All steps completed — issue resolved</span>
          </div>` : ''}

          <div style="padding:16px 22px">
            ${g.steps.map((step, i) => {
              const isChecked = done.includes(i);
              const isNext = !isChecked && (i === 0 || done.includes(i - 1));
              return `<div style="display:flex;align-items:center;gap:12px;padding:9px 10px;margin:1px 0;border-radius:6px;cursor:pointer;transition:background .12s;background:${isNext ? m.color + '08' : 'transparent'}" onclick="GuidesPage.toggleStep(${g.id},${i})" onmouseover="this.style.background='${isNext ? m.color + '10' : 'var(--bg3)'}'" onmouseout="this.style.background='${isNext ? m.color + '08' : 'transparent'}'">
                <div style="width:24px;height:24px;border-radius:50%;border:2px solid ${isChecked ? 'var(--green)' : isNext ? m.color : 'var(--border)'};background:${isChecked ? 'var(--green)' : 'var(--bg1)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s">
                  ${isChecked ? '<i class="ti ti-check" style="color:#fff;font-size:11px"></i>' : `<span style="font-size:10px;font-weight:700;color:${isNext ? m.color : 'var(--text3)'}">${i + 1}</span>`}
                </div>
                <div style="flex:1;font-size:13px;color:${isChecked ? 'var(--text3)' : 'var(--text1)'};${isChecked ? 'text-decoration:line-through' : ''}${isNext ? 'font-weight:500' : ''}">${esc(step)}</div>
                ${isNext ? `<span style="font-size:9px;padding:2px 6px;border-radius:3px;background:${m.color}18;color:${m.color};font-weight:600;text-transform:uppercase;letter-spacing:.3px">Next</span>` : ''}
              </div>`;
            }).join('')}
          </div>

          <div style="padding:12px 22px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px">
            <button id="guide-escalate-btn" onclick="GuidesPage.escalate(${g.id})" style="padding:8px 16px;font-size:12px;background:rgba(245,166,35,.1);color:var(--amber);border:1px solid rgba(245,166,35,.25);border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><i class="ti ti-alert-triangle" style="font-size:12px"></i> Escalate</button>
            <!-- Says where it actually goes: a teacher's escalation reaches their
                 own school administrator, everyone else's reaches support. -->
            <span style="font-size:10px;color:var(--text3);margin-left:auto">${(API.getUser() || {}).role === 'teacher'
              ? 'Still stuck? Escalate to your school administrator'
              : 'Still stuck? Escalate for engineer follow-up'}</span>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="guide-sidebar">
          <!-- Progress card -->
          <div class="card" style="padding:16px">
            <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);margin-bottom:10px">Progress</div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <div style="position:relative;width:44px;height:44px;flex-shrink:0">
                <svg viewBox="0 0 36 36" style="width:44px;height:44px;transform:rotate(-90deg)">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border)" stroke-width="3"/>
                  <circle cx="18" cy="18" r="15" fill="none" stroke="${allDone ? 'var(--green)' : m.color}" stroke-width="3" stroke-dasharray="${pct * 0.94} 100" stroke-linecap="round"/>
                </svg>
                <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${allDone ? 'var(--green)' : 'var(--text1)'}">${pct}%</div>
              </div>
              <div>
                <div style="font-size:18px;font-weight:600;color:var(--text1)">${done.length}<span style="font-size:12px;color:var(--text3);font-weight:400">/${g.steps.length}</span></div>
                <div style="font-size:10px;color:var(--text3)">steps done</div>
              </div>
            </div>
            ${done.length > 0 ? `<button onclick="GuidesPage.resetProgress(${g.id})" style="width:100%;padding:7px 12px;font-size:11px;background:rgba(54,217,204,.1);color:var(--teal);border:1px solid rgba(54,217,204,.2);border-radius:7px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px"><i class="ti ti-refresh" style="font-size:12px"></i> Reset Progress</button>` : `<div style="font-size:11px;color:var(--text3);text-align:center;padding:4px 0">Click steps to mark complete</div>`}
          </div>

          <!-- Info card -->
          <div class="card" style="padding:16px">
            <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);margin-bottom:10px">Info</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              <div style="display:flex;align-items:center;justify-content:space-between">
                <span style="font-size:11px;color:var(--text3)">Category</span>
                <span style="font-size:11px;font-weight:500;color:${m.color}">${esc(g.category)}</span>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between">
                <span style="font-size:11px;color:var(--text3)">Difficulty</span>
                <span style="font-size:11px;font-weight:500;color:var(--text1)">${g.steps.length <= 3 ? 'Easy' : g.steps.length <= 6 ? 'Medium' : 'Advanced'}</span>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between">
                <span style="font-size:11px;color:var(--text3)">Est. Time</span>
                <span style="font-size:11px;font-weight:500;color:var(--text1)">${readTime} min</span>
              </div>
            </div>
          </div>

          ${related.length ? `
          <!-- Related -->
          <div class="card" style="padding:16px">
            <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);margin-bottom:10px">Related Guides</div>
            ${related.map(r => {
              const rm = getMeta(r.category);
              return `<div style="display:flex;align-items:center;gap:9px;padding:8px;margin:0 -8px;border-radius:6px;cursor:pointer;transition:background .12s" onclick="GuidesPage.selectGuide(${r.id})" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background=''">
                <div style="width:28px;height:28px;background:${rm.color}20;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="ti ${r.icon || rm.icon}" style="color:${rm.color};font-size:13px"></i></div>
                <div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:500;color:var(--text1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.title)}</div><div style="font-size:9px;color:var(--text3)">${r.steps.length} steps</div></div>
              </div>`;
            }).join('')}
          </div>` : ''}
        </div>
      </div>
    </div>`;
  }

  // ---- Add Guide (admin) ----

  function stepRowHtml(i, value = '') {
    return `<div class="ag-step-row" style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <div class="ag-step-num" style="width:26px;height:26px;border-radius:50%;border:2px solid var(--border);background:var(--bg2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:700;color:var(--text3)">${i + 1}</div>
      <input type="text" class="ag-step-input" placeholder="Describe step ${i + 1}..." value="${esc(value)}" style="flex:1;padding:9px 12px;background:var(--bg1);border:1px solid var(--border);border-radius:6px;color:var(--text1);font-size:13px">
      <button type="button" title="Remove step" onclick="GuidesPage.removeStepRow(this)" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:var(--bg3);color:var(--text3);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--text3)'"><i class="ti ti-x" style="font-size:13px"></i></button>
    </div>`;
  }

  function renumberSteps() {
    const rows = document.querySelectorAll('#ag-steps .ag-step-row');
    rows.forEach((row, i) => {
      row.querySelector('.ag-step-num').textContent = i + 1;
      row.querySelector('.ag-step-input').placeholder = `Describe step ${i + 1}...`;
    });
  }

  function addStepRow() {
    const container = document.getElementById('ag-steps');
    if (!container) return;
    const count = container.querySelectorAll('.ag-step-row').length;
    container.insertAdjacentHTML('beforeend', stepRowHtml(count));
    const inputs = container.querySelectorAll('.ag-step-input');
    inputs[inputs.length - 1].focus();
  }

  function removeStepRow(btn) {
    const container = document.getElementById('ag-steps');
    if (!container || container.querySelectorAll('.ag-step-row').length <= 1) { showToast('A guide needs at least one step'); return; }
    btn.closest('.ag-step-row').remove();
    renumberSteps();
  }

  function openForm(g) {
    editingId = g ? g.id : null;
    // Built-in categories plus any custom ones already used by guides.
    const categories = [...new Set([...Object.keys(catMeta), ...getCategories()])];
    const items = [...categories.map(c => ({ value: c, label: c })), { value: '__new__', label: '+ New Category…' }];
    const catDropdown = Dropdown.render('ag-category', g ? esc(g.category) : 'Select category', items, { defaultValue: g ? g.category : 'Other', onSelect: 'GuidesPage.onCategorySelect()' });
    const stepsHtml = g ? g.steps.map((s, i) => stepRowHtml(i, s)).join('') : stepRowHtml(0) + stepRowHtml(1);
    const submitLabel = g ? '<i class="ti ti-check"></i> Save Changes' : '<i class="ti ti-plus"></i> Create Guide';
    const body = `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="form-group">
          <label>Guide Title <span style="color:var(--red)">*</span></label>
          <input type="text" id="ag-title" placeholder="e.g. Projector shows no signal" value="${g ? esc(g.title) : ''}">
        </div>
        <div class="form-group">
          <label>Category</label>
          ${catDropdown}
        </div>
        <div class="form-group" id="ag-newcat-group" style="display:none">
          <label>New Category Name <span style="color:var(--red)">*</span></label>
          <input type="text" id="ag-newcat" placeholder="e.g. Printing">
          <div style="font-size:11px;color:var(--text3);margin-top:4px">The category appears as a filter chip once this guide is saved.</div>
        </div>
        <div class="form-group">
          <label>Resolution Steps <span style="color:var(--red)">*</span></label>
          <div id="ag-steps" style="margin-top:6px">${stepsHtml}</div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="GuidesPage.addStepRow()" style="gap:5px;margin-top:2px;align-self:flex-start"><i class="ti ti-plus" style="font-size:13px"></i> Add Step</button>
          <div style="font-size:11px;color:var(--text3);margin-top:6px">Steps appear as a numbered checklist users follow in order.</div>
        </div>
      </div>`;
    const footer = `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" id="ag-submit" onclick="GuidesPage.submitForm()">${submitLabel}</button>`;
    Modal.open(g ? 'Edit Troubleshooting Guide' : 'Add Troubleshooting Guide', body, footer, true);
  }

  function openAdd() { openForm(null); }

  // Shows the name input when "+ New Category…" is picked in the guide form.
  function onCategorySelect() {
    const grp = document.getElementById('ag-newcat-group');
    if (!grp) return;
    const isNew = Dropdown.getValue('ag-category') === '__new__';
    grp.style.display = isNew ? 'flex' : 'none';
    if (isNew) document.getElementById('ag-newcat').focus();
  }

  function openEdit(id) {
    const g = guides.find(x => x.id === id);
    if (g) openForm(g);
  }

  async function submitForm() {
    const title = document.getElementById('ag-title').value.trim();
    let category = Dropdown.getValue('ag-category') || 'Other';
    if (category === '__new__') {
      category = document.getElementById('ag-newcat').value.trim();
      if (!category) { showToast('Please enter the new category name'); return; }
    }
    const steps = [...document.querySelectorAll('#ag-steps .ag-step-input')].map(i => i.value.trim()).filter(Boolean);

    if (!title) { showToast('Please enter a guide title'); return; }
    if (!steps.length) { showToast('Please add at least one step'); return; }

    const editing = editingId != null ? guides.find(x => x.id === editingId) : null;
    // Keep a guide's existing icon unless its category changed.
    const icon = editing && editing.category === category ? (editing.icon || getMeta(category).icon) : getMeta(category).icon;

    const btn = document.getElementById('ag-submit');
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader"></i> Saving...';

    try {
      if (editing) {
        await API.updateGuide(editingId, { title, category, icon, steps });
        // Drop step progress that may point at steps that no longer exist.
        delete completedSteps[`${editingId}`];
      } else {
        await API.createGuide({ title, category, icon, steps });
      }
      Modal.close();
      showToast(editing ? 'Guide updated successfully' : 'Guide created successfully');
      await load();
      App.render();
    } catch (e) {
      showToast(e.error || (editing ? 'Could not update guide' : 'Could not create guide'));
      btn.disabled = false;
      btn.innerHTML = editing ? '<i class="ti ti-check"></i> Save Changes' : '<i class="ti ti-plus"></i> Create Guide';
    }
  }

  /**
   * "Escalate Issue" — sends the guide up the chain the user actually belongs to.
   *
   * A teacher's escalation goes to their own school administrator, in the app;
   * everyone else's goes to the support mailbox. The server decides and says
   * which route it used, so this only has to report it honestly — and if the
   * teacher's school has no administrator on file, it says that too rather than
   * implying somebody at the school was told.
   */
  async function escalate(id) {
    const btn = document.getElementById('guide-escalate-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Sending...'; }
    try {
      const r = await API.escalateGuide(id);
      if (r.routed_to === 'school_admin') {
        showToast(r.message || 'Your school administrator has been notified', 5000);
        if (btn) { btn.innerHTML = '<i class="ti ti-check" style="font-size:13px;color:var(--green)"></i> Sent to your school admin'; }
      } else if (r.sent) {
        showToast(r.no_school_admin
          ? 'Your school has no administrator on file, so support was emailed directly'
          : 'Support has been notified by email', r.no_school_admin ? 5500 : 3200);
        if (btn) { btn.innerHTML = '<i class="ti ti-check" style="font-size:13px;color:var(--green)"></i> Escalated'; }
      } else {
        showToast('Could not send the escalation — please report the issue instead');
        Router.navigate('report');
      }
    } catch (e) {
      showToast(e.error || 'Could not send escalation');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-alert-triangle" style="font-size:13px;color:var(--amber)"></i> Escalate Issue'; }
    }
  }

  function afterRender() {
    const main = document.querySelector('.main');
    if (main) main.querySelectorAll('.reveal').forEach(c => c.classList.add('visible'));
  }

  function renderEmptyState() {
    return `<div class="card reveal" style="padding:50px 20px;text-align:center">
      <i class="ti ti-file-search" style="font-size:36px;color:var(--text3);display:block;margin-bottom:10px"></i>
      <div style="font-size:14px;color:var(--text2);margin-bottom:4px">No guides found</div>
      <div style="font-size:12px;color:var(--text3)">Try a different search or category filter</div>
    </div>`;
  }

  return { load, render, afterRender, canGoBack: () => selectedId !== null, goBack: () => selectGuide(null),
    setCategory, setSearch, selectGuide, toggleGuide: selectGuide, toggleStep, resetProgress, openAdd, openEdit, onCategorySelect, addStepRow, removeStepRow, submitForm, escalate };
})();
