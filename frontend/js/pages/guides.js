/**
 * Troubleshooting Guides Page
 */
const GuidesPage = (() => {
  let guides = [];
  let activeCategory = 'all';
  let searchQuery = '';
  let expandedId = null;
  let completedSteps = {};

  async function load() {
    try { guides = await API.getGuides(); } catch (e) { guides = []; }
  }

  function setCategory(cat) { activeCategory = cat; expandedId = null; App.render(); }
  function setSearch(q) { searchQuery = q.toLowerCase(); App.render(); }
  function toggleGuide(id) { expandedId = expandedId === id ? null : id; App.render(); }

  function toggleStep(guideId, stepIdx) {
    const key = `${guideId}`;
    if (!completedSteps[key]) completedSteps[key] = [];
    const idx = completedSteps[key].indexOf(stepIdx);
    if (idx >= 0) completedSteps[key].splice(idx, 1);
    else completedSteps[key].push(stepIdx);
    App.render();
  }

  function resetProgress(guideId) {
    delete completedSteps[`${guideId}`];
    App.render();
  }

  function getCategories() { return [...new Set(guides.map(g => g.category))].sort(); }

  const catMeta = {
    'Connectivity': { icon: 'ti-wifi', color: '#4f7cff' },
    'Hardware': { icon: 'ti-device-desktop', color: '#f5a623' },
    'Platform': { icon: 'ti-apps', color: '#9b7dff' },
    'Power': { icon: 'ti-bolt', color: '#ff5263' },
    'Other': { icon: 'ti-tools', color: '#36d9cc' }
  };

  function getMeta(cat) { return catMeta[cat] || catMeta['Other']; }

  function getFilteredGuides() {
    return guides.filter(g => {
      if (activeCategory !== 'all' && g.category !== activeCategory) return false;
      if (searchQuery && !g.title.toLowerCase().includes(searchQuery) && !g.category.toLowerCase().includes(searchQuery) && !g.steps.some(s => s.toLowerCase().includes(searchQuery))) return false;
      return true;
    });
  }

  function render() {
    const categories = getCategories();
    const filtered = getFilteredGuides();

    return `
    <div class="section-header">
      <div>
        <div class="section-title">Troubleshooting Guides</div>
        <div class="section-sub">${guides.length} articles · step-by-step resolution</div>
      </div>
    </div>

    <div class="card reveal" style="padding:12px 16px;margin-bottom:14px">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <div style="position:relative;flex:1;min-width:180px">
          <i class="ti ti-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:14px"></i>
          <input type="text" placeholder="Search guides..." value="${esc(searchQuery)}" oninput="GuidesPage.setSearch(this.value)" style="width:100%;padding:8px 10px 8px 32px;background:var(--bg1);border:1px solid var(--border);border-radius:6px;color:var(--text1);font-size:12px">
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn btn-sm ${activeCategory === 'all' ? 'btn-primary' : ''}" onclick="GuidesPage.setCategory('all')" style="padding:5px 10px;font-size:11px">All</button>
          ${categories.map(cat => {
            const m = getMeta(cat);
            return `<button class="btn btn-sm ${activeCategory === cat ? 'btn-primary' : ''}" onclick="GuidesPage.setCategory('${esc(cat)}')" style="padding:5px 10px;font-size:11px;gap:4px"><i class="ti ${m.icon}" style="font-size:12px;${activeCategory !== cat ? 'color:' + m.color : ''}"></i>${esc(cat)}</button>`;
          }).join('')}
        </div>
      </div>
    </div>

    ${!filtered.length ? '<div class="card reveal" style="padding:40px;text-align:center"><i class="ti ti-file-search" style="font-size:28px;color:var(--text3);display:block;margin-bottom:8px"></i><div style="font-size:12px;color:var(--text3)">No matching guides</div></div>' : `
    <div style="display:flex;flex-direction:column;gap:6px">
      ${filtered.map(g => renderGuideCard(g)).join('')}
    </div>`}`;
  }

  function renderGuideCard(g) {
    const isExpanded = expandedId === g.id;
    const m = getMeta(g.category);
    const done = (completedSteps[`${g.id}`] || []);
    const hasProgress = done.length > 0;
    const isComplete = done.length === g.steps.length;
    const pct = Math.round((done.length / g.steps.length) * 100);

    return `<div class="card reveal" style="padding:0;overflow:hidden;border-left:3px solid ${m.color}">
      <div style="padding:12px 16px;cursor:pointer;display:flex;align-items:center;gap:12px" onclick="GuidesPage.toggleGuide(${g.id})">
        <div style="width:34px;height:34px;background:${m.color}12;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="ti ${g.icon || m.icon}" style="color:${m.color};font-size:17px"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:500;font-size:13px;color:var(--text1)">${esc(g.title)}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:2px">
            <span style="font-size:10px;padding:1px 6px;border-radius:3px;background:${m.color}12;color:${m.color};font-weight:500">${esc(g.category)}</span>
            <span style="font-size:10px;color:var(--text3)">${g.steps.length} steps · ~${g.steps.length * 2}min</span>
            ${isComplete ? '<span style="font-size:10px;color:var(--green);font-weight:500"><i class="ti ti-check" style="font-size:10px"></i> Done</span>' : ''}
            ${hasProgress && !isComplete ? `<span style="font-size:10px;color:var(--green)">${pct}%</span>` : ''}
          </div>
        </div>
        ${hasProgress && !isComplete ? `<svg viewBox="0 0 36 36" style="width:26px;height:26px;transform:rotate(-90deg);flex-shrink:0"><circle cx="18" cy="18" r="15" fill="none" stroke="var(--border)" stroke-width="3"/><circle cx="18" cy="18" r="15" fill="none" stroke="var(--green)" stroke-width="3" stroke-dasharray="${pct * 0.942} 100" stroke-linecap="round"/></svg>` : ''}
        <i class="ti ti-chevron-${isExpanded ? 'up' : 'down'}" style="color:var(--text3);font-size:14px;flex-shrink:0"></i>
      </div>
      ${isExpanded ? renderSteps(g) : ''}
    </div>`;
  }

  function renderSteps(g) {
    const done = completedSteps[`${g.id}`] || [];
    const m = getMeta(g.category);
    const allDone = done.length === g.steps.length;

    return `<div style="padding:0 16px 14px;border-top:1px solid var(--border)">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0 8px">
        <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text3)">Steps</span>
        <div style="display:flex;align-items:center;gap:8px">
          ${done.length > 0 ? `<button class="btn btn-sm" onclick="event.stopPropagation();GuidesPage.resetProgress(${g.id})" style="font-size:10px;padding:3px 8px"><i class="ti ti-refresh" style="font-size:11px"></i> Reset</button>` : ''}
          <span style="font-size:10px;color:var(--text3)">${done.length}/${g.steps.length}</span>
        </div>
      </div>
      <div style="position:relative;padding-left:16px">
        <div style="position:absolute;left:11px;top:8px;bottom:8px;width:1.5px;background:var(--border)"></div>
        ${g.steps.map((step, i) => {
          const isChecked = done.includes(i);
          const isNext = !isChecked && (i === 0 || done.includes(i - 1));
          return `<div style="position:relative;display:flex;align-items:flex-start;gap:10px;padding:6px 0;cursor:pointer" onclick="event.stopPropagation();GuidesPage.toggleStep(${g.id},${i})">
            <div style="position:relative;z-index:1;width:22px;height:22px;border-radius:50%;border:2px solid ${isChecked ? 'var(--green)' : isNext ? m.color : 'var(--border)'};background:${isChecked ? 'var(--green)' : 'var(--bg2)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
              ${isChecked ? '<i class="ti ti-check" style="color:#fff;font-size:11px"></i>' : `<span style="font-size:9px;font-weight:600;color:${isNext ? m.color : 'var(--text3)'}">${i + 1}</span>`}
            </div>
            <div style="padding-top:2px;flex:1">
              <span style="font-size:12px;line-height:1.5;color:${isChecked ? 'var(--text3)' : 'var(--text1)'};${isChecked ? 'text-decoration:line-through' : ''}${isNext ? ';font-weight:500' : ''}">${esc(step)}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
      ${allDone ? `<div style="margin-top:10px;padding:8px 12px;background:rgba(45,217,138,0.06);border:1px solid rgba(45,217,138,0.15);border-radius:6px;display:flex;align-items:center;gap:8px">
        <i class="ti ti-circle-check-filled" style="color:var(--green);font-size:16px"></i>
        <span style="font-size:11px;color:var(--green);font-weight:500">Resolved — all steps completed</span>
      </div>` : ''}
      <div style="margin-top:10px;display:flex;justify-content:flex-end">
        <button class="btn btn-sm" onclick="event.stopPropagation();Router.navigate('report')" style="font-size:11px;padding:5px 10px"><i class="ti ti-alert-triangle" style="font-size:12px;color:var(--amber)"></i> Escalate</button>
      </div>
    </div>`;
  }

  return { load, render, setCategory, setSearch, toggleGuide, toggleStep, resetProgress };
})();
