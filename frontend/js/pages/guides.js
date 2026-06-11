/**
 * Troubleshooting Guides Page
 */
const GuidesPage = (() => {
  let guides = [];
  let selected = null;

  async function load() {
    try { guides = await API.getGuides(); } catch (e) { guides = []; }
  }

  function selectGuide(idx) { selected = idx; App.render(); }

  function render() {
    return `
    <div class="section-header">
      <div><div class="section-title">Troubleshooting Guides</div><div class="section-sub">Step-by-step resolution for common issues</div></div>
    </div>
    <div class="two-col" style="align-items:start">
      <div style="display:flex;flex-direction:column;gap:12px">
        ${guides.map((g, i) => `<div class="card" style="cursor:pointer;${selected === i ? 'border-color:var(--accent)' : ''}" onclick="GuidesPage.selectGuide(${i})">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:38px;height:38px;background:rgba(79,124,255,0.1);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="ti ${g.icon}" style="color:var(--accent);font-size:18px"></i></div>
            <div><div style="font-weight:500;font-size:13px">${esc(g.title)}</div><div style="font-size:11px;color:var(--text3)">${esc(g.category)} · ${g.steps.length} steps</div></div>
            <i class="ti ti-chevron-right" style="margin-left:auto;color:var(--text3)"></i>
          </div></div>`).join('')}
      </div>
      <div class="card">${selected == null || !guides[selected] ? '<div class="empty"><i class="ti ti-tools"></i>Select a guide to view steps</div>' : (() => {
        const g = guides[selected];
        return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border)">
          <div style="width:44px;height:44px;background:rgba(79,124,255,0.1);border-radius:10px;display:flex;align-items:center;justify-content:center"><i class="ti ${g.icon}" style="color:var(--accent);font-size:20px"></i></div>
          <div style="flex:1"><div style="font-weight:600;font-size:15px">${esc(g.title)}</div><div style="font-size:12px;color:var(--text3)">${esc(g.category)} · ${g.steps.length} steps</div></div></div>
        <div style="display:flex;flex-direction:column;gap:10px">${g.steps.map((st, i) => `<div style="display:flex;gap:12px;align-items:flex-start">
          <div style="width:24px;height:24px;border-radius:50%;background:rgba(79,124,255,0.15);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--accent);flex-shrink:0">${i + 1}</div>
          <div style="font-size:13px;line-height:1.6;color:var(--text2)">${esc(st)}</div></div>`).join('')}</div>
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
          <button class="btn btn-primary btn-sm" onclick="Router.navigate('report')"><i class="ti ti-bug"></i> Still broken? Report it</button></div>`;
      })()}</div>
    </div>`;
  }

  return { load, render, selectGuide };
})();
