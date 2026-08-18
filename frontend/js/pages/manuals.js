const ManualsPage = (() => {
  let manuals = [];
  let filterCategory = 'all';
  let uploadMode = 'file'; // 'file' | 'url'

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
    if (mimetype === 'url' || mimetype === 'text/uri-list') return { ic: 'ti-world', color: 'var(--accent)' };
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
    if (mimetype === 'url' || mimetype === 'text/uri-list') return 'Webpage';
    if (mimetype === 'text/html') return 'HTML';
    if (mimetype.startsWith('image/')) return 'Image';
    if (mimetype.startsWith('video/')) return 'Video';
    if (mimetype.startsWith('audio/')) return 'Audio';
    if (mimetype.includes('pdf')) return 'PDF';
    if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) return 'Presentation';
    if (mimetype.includes('word') || mimetype.includes('document')) return 'Document';
    if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return 'Spreadsheet';
    return 'File';
  }

  // Maps a mimetype to how we render its in-app preview.
  function previewKind(mimetype) {
    const ft = mimetype || '';
    if (ft === 'url' || ft === 'text/uri-list') return 'url';
    if (ft.startsWith('image/')) return 'image';
    if (ft.startsWith('video/')) return 'video';
    if (ft.startsWith('audio/')) return 'audio';
    if (ft.includes('pdf')) return 'pdf';
    if (/(powerpoint|presentation|msword|wordprocessing|officedocument|ms-excel|ms-word)/.test(ft)) return 'office';
    if (ft.startsWith('text/') || ft === 'application/json' || ft === 'application/xml' || ft.includes('csv')) return 'text';
    return 'none';
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
      return `<div class="card" style="padding:16px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:42px;height:42px;border-radius:10px;background:${icon.color}15;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="ti ${icon.ic}" style="font-size:20px;color:${icon.color}"></i>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.title)}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${type} · ${formatSize(m.file_size)} · ${esc(m.category)} · by ${esc(m.uploaded_by)}</div>
          </div>
          <div class="manual-actions" style="display:flex;gap:8px;flex-shrink:0;align-items:center">
            <button data-tip="${TIP.PREVIEW}" onclick="ManualsPage.preview(${m.id})" style="display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:6px;border:1px solid var(--border2);background:var(--bg3);color:var(--text2);font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;font-family:var(--font)" onmouseover="this.style.background='var(--bg4)';this.style.color='var(--text)'" onmouseout="this.style.background='var(--bg3)';this.style.color='var(--text2)'"><i class="ti ti-eye" style="font-size:14px"></i><span class="btn-label"> Preview</span></button>
            <button data-tip="${TIP.DOWNLOAD}" onclick="ManualsPage.download(${m.id})" style="display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:6px;border:none;background:var(--accent);color:#fff;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;font-family:var(--font)" onmouseover="this.style.background='var(--accent2)'" onmouseout="this.style.background='var(--accent)'"><i class="ti ti-download" style="font-size:14px"></i><span class="btn-label"> Download</span></button>
            ${isAdmin ? `<button data-tip="${TIP.DELETE}" data-tip-color="red" onclick="ManualsPage.remove(${m.id})" style="display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:6px;border:1px solid rgba(255,82,99,0.3);background:rgba(255,82,99,0.08);color:var(--red);font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;font-family:var(--font)" onmouseover="this.style.background='rgba(255,82,99,0.18)'" onmouseout="this.style.background='rgba(255,82,99,0.08)'"><i class="ti ti-trash" style="font-size:14px"></i><span class="btn-label"> Delete</span></button>` : ''}
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
      ${isAdmin ? `<button data-tip="${TIP.UPLOAD}" class="btn btn-primary" onclick="ManualsPage.openUpload()"><i class="ti ti-upload"></i> Upload Resource</button>` : ''}
    </div>

    <div class="stats-grid manuals-stats">
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
    uploadMode = 'file';
    const catDropdown = Dropdown.render('mu-category', 'Select category', CATEGORIES, { defaultValue: 'General' });
    const tabBtn = (mode, label, icon) => `<button type="button" id="mu-tab-${mode}" onclick="ManualsPage.setUploadMode('${mode}')" style="flex:1;padding:9px;border-radius:8px;border:1px solid var(--border2);background:${mode === 'file' ? 'var(--accent)' : 'var(--bg3)'};color:${mode === 'file' ? '#fff' : 'var(--text2)'};font-weight:600;font-size:12.5px;cursor:pointer;font-family:var(--font);display:inline-flex;align-items:center;justify-content:center;gap:6px"><i class="ti ${icon}"></i> ${label}</button>`;
    const body = `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;gap:10px">${tabBtn('file', 'Upload File', 'ti-upload')}${tabBtn('url', 'Webpage / URL', 'ti-world')}</div>
        <div class="form-group" id="mu-file-section">
          <label>File <span style="color:var(--red)">*</span></label>
          <input type="file" id="mu-file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.html,.htm,.png,.jpg,.jpeg,.gif,.webp,.svg,.mp4,.webm,.mov,.avi,.mkv,.mp3,.wav,.ogg,.m4a,.aac" style="padding:8px">
          <div style="font-size:11px;color:var(--text3);margin-top:4px">Accepted: PDF, DOC, PPT, XLS, images, video, audio, HTML (max 100MB)</div>
        </div>
        <div class="form-group" id="mu-url-section" style="display:none">
          <label>Webpage URL <span style="color:var(--red)">*</span></label>
          <input type="url" id="mu-url" placeholder="https://example.com/page">
          <div style="font-size:11px;color:var(--text3);margin-top:4px">Link to an external webpage or online resource.</div>
        </div>
        <div class="form-group">
          <label>Title (optional — defaults to filename / URL)</label>
          <input type="text" id="mu-title" placeholder="e.g. Tablet User Manual v2">
        </div>
        <div class="form-group">
          <label>Category</label>
          ${catDropdown}
        </div>
        <div id="mu-progress" style="display:none">
          <div style="font-size:12px;color:var(--text2);margin-bottom:6px">Saving...</div>
          <div class="progress"><div class="progress-fill" id="mu-bar" style="width:0%;background:var(--accent)"></div></div>
        </div>
      </div>`;
    const footer = `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" id="mu-submit" onclick="ManualsPage.submitUpload()"><i class="ti ti-upload"></i> Add Resource</button>`;
    Modal.open('Add Resource', body, footer);
  }

  function setUploadMode(mode) {
    uploadMode = mode;
    const fileSec = document.getElementById('mu-file-section');
    const urlSec = document.getElementById('mu-url-section');
    if (fileSec) fileSec.style.display = mode === 'file' ? 'block' : 'none';
    if (urlSec) urlSec.style.display = mode === 'url' ? 'block' : 'none';
    ['file', 'url'].forEach(m => {
      const b = document.getElementById('mu-tab-' + m);
      if (b) { const active = m === mode; b.style.background = active ? 'var(--accent)' : 'var(--bg3)'; b.style.color = active ? '#fff' : 'var(--text2)'; }
    });
    const submit = document.getElementById('mu-submit');
    if (submit) submit.innerHTML = mode === 'url' ? '<i class="ti ti-link"></i> Add Link' : '<i class="ti ti-upload"></i> Add Resource';
  }

  async function submitUpload() {
    const title = document.getElementById('mu-title').value.trim();
    const category = Dropdown.getValue('mu-category') || 'General';
    const btn = document.getElementById('mu-submit');

    // Webpage / URL mode — no file upload.
    if (uploadMode === 'url') {
      const url = document.getElementById('mu-url').value.trim();
      if (!url) { showToast('Please enter a URL'); return; }
      btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Saving...';
      try {
        await API.addManualLink({ title, url, category });
        Modal.close();
        showToast('Webpage added successfully');
        await load(); App.render();
      } catch (e) {
        showToast(e.error || 'Could not add link');
        btn.disabled = false; btn.innerHTML = '<i class="ti ti-link"></i> Add Link';
      }
      return;
    }

    // File upload mode.
    const fileInput = document.getElementById('mu-file');
    const progress = document.getElementById('mu-progress');
    if (!fileInput.files.length) { showToast('Please select a file'); return; }

    const file = fileInput.files[0];
    if (file.size > 104857600) { showToast('File too large (max 100MB)'); return; }

    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader"></i> Uploading...';
    if (progress) progress.style.display = 'block';

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
      btn.innerHTML = '<i class="ti ti-upload"></i> Add Resource';
      if (progress) progress.style.display = 'none';
    }
  }

  async function download(id) {
    try {
      const data = await API.getManualDownload(id);
      if (data.url) {
        // fl_attachment makes Cloudinary send Content-Disposition: attachment, so the
        // browser saves the file (with its real name) instead of rendering it inline.
        let dlUrl = data.url;
        if (/res\.cloudinary\.com\/.+\/upload\//.test(dlUrl)) {
          dlUrl = dlUrl.replace('/upload/', '/upload/fl_attachment/');
        }
        window.open(dlUrl, '_blank');
      }
    } catch (e) { showToast('Download failed'); }
  }

  async function preview(id) {
    const manual = manuals.find(m => m.id === id);
    if (!manual) return;

    const url = manual.stored_filename;
    const kind = previewKind(manual.file_type);
    let content = '';

    if (kind === 'image') {
      content = `<div style="text-align:center;background:var(--bg);border-radius:8px;padding:8px"><img src="${esc(url)}" alt="${esc(manual.title)}" style="max-width:100%;max-height:72vh;border-radius:6px"></div>`;
    } else if (kind === 'video') {
      content = `<video controls autoplay style="width:100%;max-height:72vh;border-radius:8px;background:#000"><source src="${esc(url)}" type="${esc(manual.file_type)}">Your browser does not support video playback.</video>`;
    } else if (kind === 'audio') {
      content = `<div style="padding:40px 20px;text-align:center"><i class="ti ti-music" style="font-size:56px;color:var(--teal);display:block;margin-bottom:20px"></i><audio controls autoplay style="width:100%"><source src="${esc(url)}" type="${esc(manual.file_type)}">Your browser does not support audio playback.</audio></div>`;
    } else if (kind === 'pdf') {
      content = `<div id="mp-pdf-box" style="width:100%;height:74vh;border:1px solid var(--border);border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:12px">Loading preview…</div>`;
    } else if (kind === 'office') {
      // Microsoft Office web viewer renders PPT/DOC/XLS from a public https URL.
      const viewerUrl = 'https://view.officeapps.live.com/op/embed.aspx?src=' + encodeURIComponent(url);
      content = `<iframe src="${esc(viewerUrl)}" style="width:100%;height:74vh;border:none;border-radius:8px;background:#fff" title="${esc(manual.title)}"></iframe>`;
    } else if (kind === 'text') {
      content = `<div id="mp-text-box" style="width:100%;height:74vh;border:1px solid var(--border);border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:12px">Loading preview…</div>`;
    } else if (kind === 'url') {
      content = `<div style="font-size:11px;color:var(--text3);margin-bottom:8px"><i class="ti ti-info-circle"></i> Some websites block embedding — if it stays blank, use "Open in new tab".</div>
        <iframe src="${esc(url)}" style="width:100%;height:72vh;border:1px solid var(--border);border-radius:8px;background:#fff" title="${esc(manual.title)}"></iframe>`;
    } else {
      const icon = getFileIcon(manual.file_type);
      content = `<div style="padding:48px 24px;text-align:center;background:var(--bg);border-radius:8px">
        <div style="width:72px;height:72px;border-radius:16px;background:${icon.color}15;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px"><i class="ti ${icon.ic}" style="font-size:36px;color:${icon.color}"></i></div>
        <div style="font-size:14px;font-weight:600;margin-bottom:6px">No in-app preview for this file type</div>
        <div style="font-size:12px;color:var(--text3)">${getFileType(manual.file_type)} · ${formatSize(manual.file_size)} — download or open it to view.</div>
      </div>`;
    }

    const meta = `<div style="margin-bottom:12px;font-size:12px;color:var(--text3);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <span>${esc(manual.original_filename)}</span><span>·</span><span>${getFileType(manual.file_type)}</span><span>·</span><span>${formatSize(manual.file_size)}</span><span>·</span><span>${esc(manual.category)}</span>
    </div>`;
    const footer = `
      <button class="btn btn-secondary" onclick="Modal.close()">Close</button>
      <button class="btn btn-secondary" onclick="ManualsPage.openInNewTab(${id})"><i class="ti ti-external-link"></i> Open in new tab</button>
      <button class="btn btn-primary" onclick="ManualsPage.download(${id})"><i class="ti ti-download"></i> Download</button>`;
    Modal.open(manual.title, meta + content, footer, true);
    const box = document.getElementById('modal-box');
    if (box) box.classList.add('preview');

    if (kind === 'pdf') {
      // Cloudinary delivers PDFs as "raw" assets with a download disposition, so an
      // <iframe src> pointed at the URL stays blank. Fetch the bytes and hand the
      // browser's PDF viewer a blob URL instead (same approach as text previews).
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('fetch failed');
        const buf = await res.arrayBuffer();
        const blobUrl = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }));
        const container = document.getElementById('mp-pdf-box');
        if (!container) return;
        const iframe = document.createElement('iframe');
        iframe.src = blobUrl + '#view=FitH';
        iframe.style.cssText = 'width:100%;height:74vh;border:none;border-radius:8px;background:#fff';
        iframe.title = manual.title;
        container.replaceWith(iframe);
      } catch (e) {
        const container = document.getElementById('mp-pdf-box');
        if (container) container.innerHTML = '<div style="text-align:center;padding:20px"><i class="ti ti-alert-triangle" style="font-size:28px;color:var(--amber)"></i><div style="margin-top:8px;font-size:12px;color:var(--text3)">Could not load preview — try "Open in new tab" or Download instead.</div></div>';
      }
      return;
    }

    if (kind === 'text') {
      // Cloudinary serves raw HTML/SVG/text files with Content-Disposition: attachment
      // (an anti-XSS safeguard), so pointing an <iframe src> at the URL just triggers a
      // download and leaves the preview blank. Fetch the bytes instead and inject via
      // srcdoc, which isn't affected by that header.
      const isHtml = manual.file_type === 'text/html';
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('fetch failed');
        const text = await res.text();
        const container = document.getElementById('mp-text-box');
        if (!container) return;
        const iframe = document.createElement('iframe');
        iframe.setAttribute('sandbox', '');
        iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:8px;background:#fff';
        iframe.title = manual.title;
        iframe.srcdoc = isHtml ? text : `<pre style="white-space:pre-wrap;word-break:break-word;font-family:monospace;font-size:12px;padding:12px;margin:0">${esc(text)}</pre>`;
        container.replaceWith(iframe);
      } catch (e) {
        const container = document.getElementById('mp-text-box');
        if (container) container.innerHTML = '<div style="text-align:center;padding:20px"><i class="ti ti-alert-triangle" style="font-size:28px;color:var(--amber)"></i><div style="margin-top:8px;font-size:12px;color:var(--text3)">Could not load preview — try "Open in new tab" or Download instead.</div></div>';
      }
    }
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

  async function openInNewTab(id) {
    const manual = manuals.find(m => m.id === id);
    if (!manual) return;
    const url = manual.stored_filename;
    const kind = previewKind(manual.file_type);
    if (kind === 'image' || kind === 'video' || kind === 'audio') {
      window.open(url, '_blank');
      return;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch failed');
      const buf = await res.arrayBuffer();
      const mimeType = manual.file_type || 'application/octet-stream';
      const blobUrl = URL.createObjectURL(new Blob([buf], { type: mimeType }));
      window.open(blobUrl, '_blank');
    } catch (e) {
      window.open(url, '_blank');
    }
  }

  return { load, render, setFilter, openUpload, setUploadMode, submitUpload, download, preview, remove, openInNewTab };
})();
