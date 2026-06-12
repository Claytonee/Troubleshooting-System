const ManualsPage = (() => {
  let manuals = [];
  let filterCategory = 'all';

  const CATEGORIES = ['General', 'User Guide', 'Training', 'Technical', 'Policy', 'Other'];

  const FILE_ICONS = {
    'application/pdf': { ic: 'ti-file-type-pdf', color: 'var(--red)' },
    'application/vnd.ms-powerpoint': { ic: 'ti-file-type-ppt', color: 'var(--amber)' },
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': { ic: 'ti-file-type-ppt', color: 'var(--amber)' },
    'application/msword': { ic: 'ti-file-type-doc', color: 'var(--accent)' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ic: 'ti-file-type-doc', color: 'var(--accent)' },
    'application/vnd.ms-excel': { ic: 'ti-file-spreadsheet', color: 'var(--green)' },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ic: 'ti-file-spreadsheet', color: 'var(--green)' },
    'text/plain': { ic: 'ti-file-text', color: 'var(--text2)' },
    'text/html': { ic: 'ti-file-code', color: 'var(--teal)' }
  };

  function getFileIcon(mimetype) {
    if (FILE_ICONS[mimetype]) return FILE_ICONS[mimetype];
    if (mimetype.startsWith('image/')) return { ic: 'ti-photo', color: 'var(--purple)' };
    if (mimetype.startsWith('video/')) return { ic: 'ti-video', color: 'var(--red)' };
    if (mimetype.startsWith('audio/')) return { ic: 'ti-music', color: 'var(--teal)' };
    return { ic: 'ti-file', color: 'var(--text2)' };
  }

  function formatSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(1) + ' GB';
  }

  function getFileType(mimetype) {
    if (mimetype.startsWith('image/')) return 'Image';
    if (mimetype.startsWith('video/')) return 'Video';
    if (mimetype.startsWith('audio/')) return 'Audio';
    if (mimetype.includes('pdf')) return 'PDF';
    if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) return 'Presentation';
    if (mimetype.includes('word') || mimetype.includes('document')) return 'Document';
    if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return 'Spreadsheet';
    return 'File';
  }

  async function load() {
    try {
      manuals = await API.getManuals();
    } catch (e) { manuals = []; }
  }

  function render() {
    const user = API.getUser();
    const isAdmin = user && user.role === 'admin';
    const filtered = filterCategory === 'all' ? manuals : manuals.filter(m => m.category === filterCategory);

    const categoryChips = ['all', ...CATEGORIES].map(c =>
      `<button class="chip ${c === filterCategory ? 'chip-active' : ''}" onclick="ManualsPage.setFilter('${c}')">${c === 'all' ? 'All Files' : c}</button>`
    ).join('');

    const fileCards = filtered.length ? filtered.map(m => {
      const icon = getFileIcon(m.file_type);
      const type = getFileType(m.file_type);
      const isMedia = m.file_type.startsWith('image/') || m.file_type.startsWith('video/') || m.file_type.startsWith('audio/');
      return `<div class="card" style="padding:16px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:42px;height:42px;border-radius:10px;background:${icon.color}15;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="ti ${icon.ic}" style="font-size:20px;color:${icon.color}"></i>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.title)}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${type} · ${formatSize(m.file_size)} · ${esc(m.category)} · by ${esc(m.uploaded_by)}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            ${isMedia ? `<button class="btn btn-secondary btn-sm" onclick="ManualsPage.preview(${m.id})"><i class="ti ti-eye"></i></button>` : ''}
            <button class="btn btn-primary btn-sm" onclick="ManualsPage.download(${m.id})"><i class="ti ti-download"></i></button>
            ${isAdmin ? `<button class="btn btn-danger btn-sm" onclick="ManualsPage.remove(${m.id})"><i class="ti ti-trash"></i></button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('') : '<div class="empty"><i class="ti ti-files"></i>No files uploaded yet</div>';

    const stats = {
      total: manuals.length,
      docs: manuals.filter(m => !m.file_type.startsWith('image/') && !m.file_type.startsWith('video/') && !m.file_type.startsWith('audio/')).length,
      media: manuals.filter(m => m.file_type.startsWith('image/') || m.file_type.startsWith('video/') || m.file_type.startsWith('audio/')).length,
      size: manuals.reduce((a, m) => a + (m.file_size || 0), 0)
    };

    return `
    <div class="section-header">
      <div>
        <div class="section-title">Resource Library</div>
        <div class="section-sub">User manuals, training videos, guides & reference documents</div>
      </div>
      ${isAdmin ? `<button class="btn btn-primary" onclick="ManualsPage.openUpload()"><i class="ti ti-upload"></i> Upload Resource</button>` : ''}
    </div>

    <div class="stats-grid" style="grid-template-columns:repeat(4, 1fr)">
      <div class="stat-card"><div class="stat-label">Total Files</div><div class="stat-val">${stats.total}</div><div class="stat-sub">all categories</div></div>
      <div class="stat-card a"><div class="stat-label">Documents</div><div class="stat-val" style="color:var(--amber)">${stats.docs}</div><div class="stat-sub">PDF, PPT, DOC, XLS</div></div>
      <div class="stat-card t"><div class="stat-label">Media</div><div class="stat-val" style="color:var(--teal)">${stats.media}</div><div class="stat-sub">images, video, audio</div></div>
      <div class="stat-card"><div class="stat-label">Total Size</div><div class="stat-val">${formatSize(stats.size)}</div><div class="stat-sub">cloud storage</div></div>
    </div>

    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      ${categoryChips}
    </div>

    ${fileCards}`;
  }

  function setFilter(cat) {
    filterCategory = cat;
    App.render();
  }

  function openUpload() {
    const catOptions = CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
    const body = `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="form-group">
          <label>File <span style="color:var(--red)">*</span></label>
          <input type="file" id="mu-file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.html,.png,.jpg,.jpeg,.gif,.webp,.svg,.mp4,.webm,.mov,.avi,.mkv,.mp3,.wav,.ogg,.m4a,.aac" style="padding:8px">
          <div style="font-size:11px;color:var(--text3);margin-top:4px">Accepted: PDF, DOC, PPT, XLS, images, video, audio (max 100MB)</div>
        </div>
        <div class="form-group">
          <label>Title (optional — defaults to filename)</label>
          <input type="text" id="mu-title" placeholder="e.g. Tablet User Manual v2">
        </div>
        <div class="form-group">
          <label>Category</label>
          <select id="mu-category">${catOptions}</select>
        </div>
        <div id="mu-progress" style="display:none">
          <div style="font-size:12px;color:var(--text2);margin-bottom:6px">Uploading...</div>
          <div class="progress"><div class="progress-fill" id="mu-bar" style="width:0%;background:var(--accent)"></div></div>
        </div>
      </div>`;
    const footer = `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" id="mu-submit" onclick="ManualsPage.submitUpload()"><i class="ti ti-upload"></i> Upload</button>`;
    Modal.open('Upload Resource', body, footer);
  }

  async function submitUpload() {
    const fileInput = document.getElementById('mu-file');
    const title = document.getElementById('mu-title').value.trim();
    const category = document.getElementById('mu-category').value;
    const btn = document.getElementById('mu-submit');
    const progress = document.getElementById('mu-progress');

    if (!fileInput.files.length) { showToast('Please select a file'); return; }

    const file = fileInput.files[0];
    if (file.size > 104857600) { showToast('File too large (max 100MB)'); return; }

    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader"></i> Uploading...';
    progress.style.display = 'block';

    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    formData.append('category', category);

    try {
      await API.uploadManual(formData);
      Modal.close();
      showToast('Resource uploaded successfully');
      await load();
      App.render();
    } catch (e) {
      showToast(e.error || 'Upload failed');
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-upload"></i> Upload';
      progress.style.display = 'none';
    }
  }

  async function download(id) {
    try {
      const data = await API.getManualDownload(id);
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (e) { showToast('Download failed'); }
  }

  async function preview(id) {
    const manual = manuals.find(m => m.id === id);
    if (!manual) return;

    let content = '';
    const url = manual.stored_filename;

    if (manual.file_type.startsWith('image/')) {
      content = `<div style="text-align:center"><img src="${esc(url)}" style="max-width:100%;max-height:60vh;border-radius:8px"></div>`;
    } else if (manual.file_type.startsWith('video/')) {
      content = `<video controls style="width:100%;max-height:60vh;border-radius:8px"><source src="${esc(url)}" type="${esc(manual.file_type)}">Your browser does not support video playback.</video>`;
    } else if (manual.file_type.startsWith('audio/')) {
      content = `<div style="padding:20px;text-align:center"><i class="ti ti-music" style="font-size:48px;color:var(--teal);display:block;margin-bottom:16px"></i><audio controls style="width:100%"><source src="${esc(url)}" type="${esc(manual.file_type)}">Your browser does not support audio playback.</audio></div>`;
    }

    const body = `
      <div style="margin-bottom:12px;font-size:12px;color:var(--text3)">${esc(manual.original_filename)} · ${formatSize(manual.file_size)}</div>
      ${content}`;
    const footer = `
      <button class="btn btn-secondary" onclick="Modal.close()">Close</button>
      <button class="btn btn-primary" onclick="ManualsPage.download(${id})"><i class="ti ti-download"></i> Download</button>`;
    Modal.open(manual.title, body, footer);
  }

  async function remove(id) {
    if (!confirm('Delete this resource permanently?')) return;
    try {
      await API.deleteManual(id);
      showToast('Resource deleted');
      await load();
      App.render();
    } catch (e) { showToast('Delete failed'); }
  }

  return { load, render, setFilter, openUpload, submitUpload, download, preview, remove };
})();
