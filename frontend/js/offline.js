/**
 * Offline queue and sync. Design: docs/features/02-offline-pwa.md
 *
 * Queues writes that fail for network reasons and replays them later.
 *
 * Note on the trigger: this keys on a *failed request*, not on
 * `navigator.onLine`. In these schools the LAN is frequently up while the
 * uplink is dead — the tablet is happily associated to the router, so
 * `navigator.onLine` reports true and would have queued nothing. A request
 * that cannot reach the server is the only honest signal.
 *
 * Every queued item carries a client-generated `client_ref`; the server
 * returns the existing row when it sees one twice, so a reply lost after the
 * server committed cannot file the same fault again on replay.
 */
const Offline = (() => {
  const DB_NAME = 'oe-offline';
  const DB_VERSION = 1;
  const STORE = 'queue';
  let dbPromise = null;
  let flushing = false;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'client_ref' });
          store.createIndex('queued_at', 'queued_at');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const result = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(result && result.result !== undefined ? result.result : result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  function newRef() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'ref-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  /** True for "the request never reached the server", false for a real HTTP error. */
  function isNetworkFailure(err) {
    return err instanceof TypeError || (err && err.name === 'TypeError') || (err && err.offline === true);
  }

  function currentUserId() {
    const u = API.getUser();
    return u && u.id != null ? u.id : null;
  }

  async function enqueue(item) {
    const record = {
      client_ref: item.client_ref || newRef(),
      // Whose report this is. School tablets are shared, so a queued item must
      // never replay under whoever happens to be signed in next.
      user_id: currentUserId(),
      kind: item.kind,
      method: item.method || 'POST',
      path: item.path,
      body: item.body,
      label: item.label || item.kind,
      queued_at: new Date().toISOString(),
      attempts: 0,
      last_error: null
    };
    await tx('readwrite', s => s.put(record));
    notifyChange();
    requestSync();
    return record;
  }

  /** Items belonging to the signed-in user, oldest first. */
  async function list() {
    const items = await tx('readonly', s => s.getAll());
    const uid = currentUserId();
    return (items || [])
      .filter(i => i.user_id == null || i.user_id === uid)
      .sort((a, b) => (a.queued_at < b.queued_at ? -1 : 1));
  }

  /** Everything in the store, regardless of owner — for maintenance only. */
  async function listAll() {
    const items = await tx('readonly', s => s.getAll());
    return items || [];
  }

  /**
   * Called on logout. Drops the service-worker copies of role-scoped API
   * responses so the next account on this device cannot read them. The queue
   * itself is kept: a report someone wrote is theirs, and it will file when
   * they sign back in.
   */
  async function forgetUserData() {
    if (!('caches' in window)) return;
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('oe-data-')).map(n => caches.delete(n)));
  }

  async function count() { return (await list()).length; }

  async function remove(ref) {
    await tx('readwrite', s => s.delete(ref));
    notifyChange();
  }

  async function markFailed(ref, message) {
    const items = await list();
    const item = items.find(i => i.client_ref === ref);
    if (!item) return;
    item.attempts = (item.attempts || 0) + 1;
    item.last_error = message;
    await tx('readwrite', s => s.put(item));
    notifyChange();
  }

  /**
   * Replays the queue oldest-first. Stops at the first network failure so the
   * order is preserved and a dead link does not burn through every item.
   * A rejection by the server (4xx) is kept, not dropped, with the reason
   * visible — a sync that silently loses a report destroys trust permanently.
   */
  async function flush() {
    if (flushing) return { sent: 0, kept: 0 };
    flushing = true;
    let sent = 0, kept = 0;
    try {
      for (const item of await list()) {
        try {
          const res = await fetch(item.path, {
            method: item.method,
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + API.getToken() },
            body: JSON.stringify({ ...item.body, client_ref: item.client_ref })
          });
          if (res.ok) {
            await remove(item.client_ref);
            sent++;
          } else if (res.status === 401 || res.status >= 500) {
            kept++;                       // session or server problem: retry later
            await markFailed(item.client_ref, 'Server said ' + res.status + '. Will retry.');
            break;
          } else {
            const detail = await res.json().catch(() => ({}));
            kept++;                       // rejected on its merits: keep it visible
            await markFailed(item.client_ref, detail.error || ('Rejected (' + res.status + ')'));
          }
        } catch (err) {
          if (isNetworkFailure(err)) { kept++; break; }
          kept++;
          await markFailed(item.client_ref, err.message || 'Unknown error');
        }
      }
    } finally {
      flushing = false;
    }
    if (sent) {
      showToast(sent === 1 ? '1 queued report synced' : sent + ' queued reports synced');
      if (typeof App !== 'undefined' && App.loadAndRender) App.loadAndRender();
    }
    notifyChange();
    return { sent, kept };
  }

  function requestSync() {
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready
        .then(reg => reg.sync && reg.sync.register('oe-flush-queue'))
        .catch(() => {});
    }
  }

  // --- pending badge -------------------------------------------------------

  const listeners = new Set();
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  async function notifyChange() {
    const n = await count().catch(() => 0);
    document.querySelectorAll('[data-offline-count]').forEach(el => {
      el.textContent = n;
      el.style.display = n ? '' : 'none';
    });
    listeners.forEach(fn => { try { fn(n); } catch {} });
  }

  /** Rendered into the pending-sync banner on the tracker and dashboard. */
  async function banner() {
    const items = await list();
    if (!items.length) return '';
    const failed = items.filter(i => i.last_error);
    return `
      <div class="alert-banner" style="background:rgba(245,166,35,0.08);border-color:rgba(245,166,35,0.25)">
        <i class="ti ti-cloud-off" style="font-size:18px;color:var(--amber);flex-shrink:0"></i>
        <div class="alert-banner-text" style="flex:1;min-width:0">
          <strong style="color:var(--amber)">${items.length} ${items.length === 1 ? 'report' : 'reports'} waiting to sync</strong>
          — saved on this device, not yet filed.
          ${failed.length ? `<div style="font-size:11px;color:var(--text3);margin-top:3px">${esc(failed[0].last_error)}</div>` : ''}
        </div>
        <button class="btn btn-secondary btn-sm" onclick="Offline.flush()"><i class="ti ti-refresh"></i> Retry now</button>
      </div>`;
  }

  /**
   * Pull the reference data the offline paths depend on, so it is cached before
   * it is needed rather than only if the user happened to visit that page while
   * online. Testing found the report form unusable offline without this: the
   * school dropdown was empty and the form could not be submitted.
   * Best-effort and silent — a warm failure is not a user-facing problem.
   */
  async function warm() {
    if (!API.getToken()) return;
    // Wait until the worker actually controls this page. On a first visit it
    // installs but does not control immediately, and a fetch issued in that
    // window bypasses the worker entirely — so it is never cached. Measured:
    // warming on login cached nothing the first time, and everything on the
    // second. The teacher's first offline attempt is the one that matters.
    await controlled();
    await Promise.all(['/api/schools', '/api/guides', '/api/settings', '/api/errors'].map(p =>
      fetch(p, { headers: { Authorization: 'Bearer ' + API.getToken() } }).catch(() => {})
    ));
  }

  /** Resolves once a service worker is controlling this page (or is absent). */
  function controlled() {
    if (!('serviceWorker' in navigator)) return Promise.resolve();
    if (navigator.serviceWorker.controller) return Promise.resolve();
    return new Promise(resolve => {
      const done = () => { navigator.serviceWorker.removeEventListener('controllerchange', done); resolve(); };
      navigator.serviceWorker.addEventListener('controllerchange', done);
      navigator.serviceWorker.ready.then(() => { if (navigator.serviceWorker.controller) done(); });
      setTimeout(done, 5000);   // never block warming forever
    });
  }

  function init() {
    // Any regained connectivity is a chance to drain the queue.
    window.addEventListener('online', flush);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) flush(); });
    notifyChange();
    flush();
    warm();
  }

  return {
    enqueue, list, listAll, count, remove, flush, banner, init, warm,
    forgetUserData, onChange, newRef, isNetworkFailure
  };
})();
