/**
 * Knowledge-base Search results page (Tier 1 #3).
 * Searches troubleshooting guides + resource library. Reached via the topbar search box.
 */
const SearchPage = (() => {
  let query = '';
  let data = { guides: [], resources: [] };

  function run(q) {
    query = (q || '').trim();
    if (query.length < 2) { showToast('Type at least 2 characters'); return; }
    Router.navigate('search');
    App.loadAndRender();
  }

  async function load() {
    if (query.length < 2) { data = { guides: [], resources: [] }; return; }
    try { data = await API.search(query); } catch (e) { data = { guides: [], resources: [] }; }
  }

  function guideCard(g) {
    return `<div class="card" style="padding:14px 16px;margin-bottom:10px;cursor:pointer"
      onclick="Router.navigate('troubleshoot');App.loadAndRender()">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:38px;height:38px;border-radius:9px;background:var(--accent)15;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="ti ${esc(g.icon || 'ti-tools')}" style="font-size:18px;color:var(--accent)"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px">${esc(g.title)}</div>
          <div style="font-size:11px;color:var(--text3)">Guide · ${esc(g.category || 'General')}</div>
        </div>
        <span class="badge badge-blue">Guide</span>
      </div>
    </div>`;
  }

  function resourceCard(r) {
    return `<div class="card" style="padding:14px 16px;margin-bottom:10px;cursor:pointer"
      onclick="window.open('${esc(r.url)}','_blank')">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:38px;height:38px;border-radius:9px;background:var(--purple)15;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="ti ti-file" style="font-size:18px;color:var(--purple)"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px">${esc(r.title)}</div>
          <div style="font-size:11px;color:var(--text3)">Resource · ${esc(r.category || 'General')}</div>
        </div>
        <span class="badge badge-purple">Resource</span>
      </div>
    </div>`;
  }

  function render() {
    if (query.length < 2) {
      return `<div class="section-header"><div><div class="section-title">Search</div>
        <div class="section-sub">Find troubleshooting guides &amp; resources</div></div></div>
        <div class="empty"><i class="ti ti-search"></i>Type in the search box above to find guides and resources</div>`;
    }
    const total = data.guides.length + data.resources.length;
    const body = total ? `
      ${data.guides.length ? `<div class="section-sub" style="margin:8px 0">Guides (${data.guides.length})</div>${data.guides.map(guideCard).join('')}` : ''}
      ${data.resources.length ? `<div class="section-sub" style="margin:14px 0 8px">Resources (${data.resources.length})</div>${data.resources.map(resourceCard).join('')}` : ''}
    ` : `<div class="empty"><i class="ti ti-mood-empty"></i>No guides or resources match "${esc(query)}"</div>`;

    return `
    <div class="section-header">
      <div><div class="section-title">Search results</div>
      <div class="section-sub">${total} result${total === 1 ? '' : 's'} for "${esc(query)}"</div></div>
    </div>
    ${body}`;
  }

  function afterRender() {
    const box = document.getElementById('global-search');
    if (box && box.value !== query) box.value = query;
  }

  return { run, load, render, afterRender };
})();
