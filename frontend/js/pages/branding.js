/**
 * Branding Settings Page (Admin Only)
 */
const BrandingPage = (() => {
  let settings = {};

  async function load() {
    try { settings = await API.getSettings(); } catch (e) { settings = {}; }
  }

  function render() {
    const logoPreview = settings.brand_logo_url
      ? `<img src="${esc(settings.brand_logo_url)}" style="max-height:60px;max-width:200px;border-radius:8px">`
      : `<div class="brand-dot" style="width:60px;height:60px;font-size:22px;background:${esc(settings.brand_color || '#FFAE00')}">${esc(settings.brand_short || 'QF')}</div>`;

    return `
    <div class="section-header">
      <div><div class="section-title">Branding & Appearance</div><div class="section-sub">Customize how the system looks for all users</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 360px;gap:24px;align-items:start">
      <div class="card">
        <div class="card-title">System Identity</div>
        <div class="form-grid" style="gap:18px">
          <div class="form-group">
            <label>Organization Name</label>
            <input type="text" id="br-name" value="${esc(settings.brand_name || '')}" placeholder="Quest Forward Tanzania">
          </div>
          <div class="form-group">
            <label>Short Name (2-3 chars)</label>
            <input type="text" id="br-short" value="${esc(settings.brand_short || '')}" placeholder="QF" maxlength="3">
          </div>
          <div class="form-group">
            <label>Subtitle</label>
            <input type="text" id="br-subtitle" value="${esc(settings.brand_subtitle || '')}" placeholder="Technical Support">
          </div>
          <div class="form-group">
            <label>Brand Color</label>
            <div style="display:flex;gap:10px;align-items:center">
              <input type="color" id="br-color" value="${settings.brand_color || '#FFAE00'}" style="width:44px;height:36px;padding:2px;cursor:pointer;border-radius:8px">
              <input type="text" id="br-color-text" value="${esc(settings.brand_color || '#FFAE00')}" style="width:100px;font-family:var(--mono)" oninput="document.getElementById('br-color').value=this.value">
            </div>
          </div>
          <div class="form-group full">
            <label>Logo URL (optional — leave empty to use short name as logo)</label>
            <input type="text" id="br-logo" value="${esc(settings.brand_logo_url || '')}" placeholder="https://example.com/logo.png">
          </div>
          <div class="form-group full">
            <label>Loading Text</label>
            <input type="text" id="br-loader" value="${esc(settings.loader_text || '')}" placeholder="Loading system...">
          </div>
        </div>
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);display:flex;gap:10px">
          <button class="btn btn-primary" data-tip="${TIP.SAVE_BRANDING}" onclick="BrandingPage.save()"><i class="ti ti-check"></i> Save Changes</button>
          <button class="btn btn-secondary" data-tip="${TIP.RESET_BRANDING}" onclick="BrandingPage.reset()"><i class="ti ti-refresh"></i> Reset to Default</button>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card">
          <div class="card-title">Live Preview</div>
          <div style="background:var(--bg);border-radius:12px;padding:16px;border:1px solid var(--border)">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)">
              ${logoPreview}
              <div>
                <div style="font-weight:600;font-size:14px">${esc(settings.brand_name || 'Quest Forward Tanzania')}</div>
                <div style="font-size:11px;color:var(--text3)">/ ${esc(settings.brand_subtitle || 'Technical Support')}</div>
              </div>
            </div>
            <div style="font-size:11px;color:var(--text3);text-align:center;padding:12px 0">${esc(settings.loader_text || 'Loading system...')}</div>
          </div>
        </div>
        <div class="card" style="font-size:12px;color:var(--text3);line-height:1.8">
          <div class="card-title">Tips</div>
          <div><i class="ti ti-info-circle" style="margin-right:4px;color:var(--accent)"></i> Logo URL should be a direct link to an image (PNG/SVG)</div>
          <div><i class="ti ti-info-circle" style="margin-right:4px;color:var(--accent)"></i> Brand color affects the topbar logo background</div>
          <div><i class="ti ti-info-circle" style="margin-right:4px;color:var(--accent)"></i> Changes apply immediately for all users</div>
        </div>
      </div>
    </div>`;
  }

  async function save() {
    const data = {
      brand_name: document.getElementById('br-name').value.trim(),
      brand_short: document.getElementById('br-short').value.trim(),
      brand_subtitle: document.getElementById('br-subtitle').value.trim(),
      brand_color: document.getElementById('br-color').value,
      brand_logo_url: document.getElementById('br-logo').value.trim(),
      loader_text: document.getElementById('br-loader').value.trim()
    };

    try {
      await API.updateSettings(data);
      showToast('Branding updated successfully');
      applyBranding(data);
      await load();
      App.render();
    } catch (e) {
      showToast(e.error || 'Failed to save settings');
    }
  }

  function reset() {
    document.getElementById('br-name').value = 'Quest Forward Tanzania';
    document.getElementById('br-short').value = 'QF';
    document.getElementById('br-subtitle').value = 'Technical Support';
    document.getElementById('br-color').value = '#FFAE00';
    document.getElementById('br-color-text').value = '#FFAE00';
    document.getElementById('br-logo').value = '';
    document.getElementById('br-loader').value = 'Loading system...';
  }

  return { load, render, save, reset };
})();

function applyBranding(s) {
  if (!s) return;
  const dot = document.querySelector('.topbar .brand-dot');
  const nameEl = document.querySelector('.topbar .brand span');
  const subEl = document.querySelector('.topbar > span');

  if (dot) {
    if (s.brand_logo_url) {
      dot.innerHTML = `<img src="${s.brand_logo_url}" style="width:100%;height:100%;object-fit:contain;border-radius:6px">`;
    } else {
      dot.textContent = s.brand_short || 'QF';
      dot.style.background = `radial-gradient(circle at 30% 30%, ${s.brand_color || '#FFAE00'}, ${darkenColor(s.brand_color || '#FFAE00')})`;
    }
  }
  if (nameEl) nameEl.textContent = s.brand_name || 'Quest Forward Tanzania';
  if (subEl) subEl.textContent = '/ ' + (s.brand_subtitle || 'Technical Support');
  document.title = (s.brand_name || 'Quest Forward Tanzania') + ' — ' + (s.brand_subtitle || 'Technical Support');
}

function darkenColor(hex) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - 40);
  const g = Math.max(0, ((num >> 8) & 0x00FF) - 40);
  const b = Math.max(0, (num & 0x0000FF) - 40);
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}
