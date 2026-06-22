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

  function getMeta(cat) { return catMeta[cat] || catMeta['Other']; }

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

    return `
    <div class="section-header">
      <div>
        <div class="section-title">Troubleshooting Guides</div>
        <div class="section-sub">Knowledge base · ${guides.length} articles</div>
      </div>
    </div>

    ${selected ? renderDetailView(selected) : renderListView(categories, filtered)}`;
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
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">
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
        <div style="width:40px;height:40px;background:${m.color}14;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="ti ${g.icon || m.icon}" style="color:${m.color};font-size:19px"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;color:var(--text1);margin-bottom:6px;line-height:1.4">${esc(g.title)}</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:10px;padding:2px 7px;border-radius:4px;background:${m.color}14;color:${m.color};font-weight:500">${esc(g.category)}</span>
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
    const done = completedSteps[`${g.id}`] || [];
    const allDone = done.length === g.steps.length;
    const pct = g.steps.length ? Math.round((done.length / g.steps.length) * 100) : 0;
    const readTime = Math.max(2, Math.ceil(g.steps.length * 1.5));
    const related = getRelatedGuides(g);

    return `
    <div id="guide-detail">
      <button class="btn btn-sm reveal" onclick="GuidesPage.selectGuide(null)" style="margin-bottom:14px;gap:5px"><i class="ti ti-arrow-left" style="font-size:13px"></i> All Guides</button>

      <div class="card reveal" style="padding:24px;border-left:4px solid ${m.color}">
        <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:20px">
          <div style="width:48px;height:48px;background:${m.color}14;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="ti ${g.icon || m.icon}" style="color:${m.color};font-size:24px"></i>
          </div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:16px;color:var(--text1);margin-bottom:6px">${esc(g.title)}</div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <span style="font-size:11px;padding:2px 8px;border-radius:4px;background:${m.color}14;color:${m.color};font-weight:500">${esc(g.category)}</span>
              <span style="font-size:11px;color:var(--text3);display:flex;align-items:center;gap:3px"><i class="ti ti-list-numbers" style="font-size:12px"></i>${g.steps.length} steps</span>
              <span style="font-size:11px;color:var(--text3);display:flex;align-items:center;gap:3px"><i class="ti ti-clock" style="font-size:12px"></i>${readTime} min read</span>
              ${done.length > 0 ? `<span style="font-size:11px;color:var(--green);font-weight:500">${pct}% complete</span>` : ''}
            </div>
          </div>
          ${done.length > 0 ? `<button class="btn btn-sm" onclick="GuidesPage.resetProgress(${g.id})" style="flex-shrink:0;font-size:11px"><i class="ti ti-refresh" style="font-size:12px"></i> Reset</button>` : ''}
        </div>

        ${allDone ? `<div style="padding:12px 16px;background:rgba(45,217,138,0.06);border:1px solid rgba(45,217,138,0.15);border-radius:8px;margin-bottom:20px;display:flex;align-items:center;gap:10px">
          <i class="ti ti-circle-check-filled" style="color:var(--green);font-size:20px"></i>
          <div><div style="font-size:13px;font-weight:500;color:var(--green)">Issue resolved</div><div style="font-size:11px;color:var(--text3)">All steps completed successfully</div></div>
        </div>` : ''}

        ${done.length > 0 && !allDone ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:18px"><div style="flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden"><div style="width:${pct}%;height:100%;background:var(--green);border-radius:2px;transition:width .3s"></div></div><span style="font-size:11px;color:var(--text3);white-space:nowrap">${done.length} of ${g.steps.length}</span></div>` : ''}

        <div style="margin-bottom:8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text3)">Resolution Steps</div>

        <div style="position:relative;padding-left:18px">
          <div style="position:absolute;left:14px;top:16px;bottom:16px;width:2px;background:var(--border);border-radius:1px"></div>
          ${g.steps.map((step, i) => {
            const isChecked = done.includes(i);
            const isNext = !isChecked && (i === 0 || done.includes(i - 1));
            return `<div style="position:relative;display:flex;align-items:flex-start;gap:14px;padding:10px 12px;margin:2px 0;border-radius:8px;cursor:pointer;transition:background .15s;background:${isNext ? m.color + '08' : 'transparent'}" onclick="GuidesPage.toggleStep(${g.id},${i})" onmouseover="if(!${isNext})this.style.background='var(--bg3)'" onmouseout="if(!${isNext})this.style.background='transparent'">
              <div style="position:relative;z-index:1;width:28px;height:28px;border-radius:50%;border:2px solid ${isChecked ? 'var(--green)' : isNext ? m.color : 'var(--border)'};background:${isChecked ? 'var(--green)' : 'var(--bg2)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s">
                ${isChecked ? '<i class="ti ti-check" style="color:#fff;font-size:13px"></i>' : `<span style="font-size:11px;font-weight:700;color:${isNext ? m.color : 'var(--text3)'}">${i + 1}</span>`}
              </div>
              <div style="flex:1;padding-top:4px">
                <div style="font-size:13px;line-height:1.6;color:${isChecked ? 'var(--text3)' : 'var(--text1)'};${isChecked ? 'text-decoration:line-through' : ''}${isNext ? ';font-weight:500' : ''}">${esc(step)}</div>
                ${isNext ? `<div style="font-size:10px;color:${m.color};margin-top:3px;font-weight:500;display:flex;align-items:center;gap:3px"><i class="ti ti-player-play-filled" style="font-size:9px"></i>Current step</div>` : ''}
              </div>
              ${isChecked ? '<i class="ti ti-check" style="color:var(--green);font-size:14px;margin-top:5px"></i>' : ''}
            </div>`;
          }).join('')}
        </div>

        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <button class="btn btn-sm" onclick="Router.navigate('report')" style="gap:5px"><i class="ti ti-alert-triangle" style="font-size:13px;color:var(--amber)"></i> Escalate Issue</button>
          <div style="margin-left:auto;font-size:11px;color:var(--text3)">Still stuck? Report for engineer follow-up</div>
        </div>
      </div>

      ${related.length ? `
      <div style="margin-top:16px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);margin-bottom:8px">Related Guides</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">
          ${related.map(r => {
            const rm = getMeta(r.category);
            return `<div class="card reveal" style="padding:14px 16px;cursor:pointer;border-left:3px solid ${rm.color}" onclick="GuidesPage.selectGuide(${r.id})">
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:32px;height:32px;background:${rm.color}14;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="ti ${r.icon || rm.icon}" style="color:${rm.color};font-size:15px"></i></div>
                <div><div style="font-size:12px;font-weight:500;color:var(--text1)">${esc(r.title)}</div><div style="font-size:10px;color:var(--text3)">${r.steps.length} steps</div></div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}
    </div>`;
  }

  function renderEmptyState() {
    return `<div class="card reveal" style="padding:50px 20px;text-align:center">
      <i class="ti ti-file-search" style="font-size:36px;color:var(--text3);display:block;margin-bottom:10px"></i>
      <div style="font-size:14px;color:var(--text2);margin-bottom:4px">No guides found</div>
      <div style="font-size:12px;color:var(--text3)">Try a different search or category filter</div>
    </div>`;
  }

  return { load, render, setCategory, setSearch, selectGuide, toggleGuide: selectGuide, toggleStep, resetProgress };
})();
