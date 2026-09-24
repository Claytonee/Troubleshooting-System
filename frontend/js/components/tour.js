/**
 * Guided tours — a spotlight and a bubble that walk a newcomer through the few
 * places they will actually use (DECISIONS.md D27, docs/features/12-guided-tour.md).
 *
 * What the research says, and what this does about it:
 *  - Tours people choose finish twice as often as tours pushed on them (Chameleon:
 *    67% vs 31%). So a first sign-in OFFERS the tour — "Show me around" or
 *    "Not now" — and never starts it unasked.
 *  - Completion falls off a cliff after a handful of steps (3–4 steps ~72–74%,
 *    7+ steps 16%). Every tour here has at most five stops.
 *  - Front-loaded tutorials are forgotten (NN/g); help that appears where the
 *    work happens is not. So besides the one role tour there are page tours,
 *    started from a "Show me how" button on the page they explain.
 *  - Always dismissible, always retrievable: Esc or "Skip tour" ends it, and
 *    "Product tour" in the profile menu brings it back.
 *
 * Progress is per ACCOUNT (GET/PUT /api/auth/tour), not per device: school
 * tablets are shared, and browser storage would show the tour to the first
 * teacher on a tablet and to nobody after.
 *
 * Accessibility: the bubble is a labelled dialog; focus moves into it and stays
 * there (Tab cycles), Esc skips, arrow keys step, focus returns where it was
 * when the tour ends. Each step is announced. Motion follows
 * prefers-reduced-motion.
 */
const Tour = (() => {
  const nav = (page) => `.nav-item[data-page="${page}"]`;
  const PROFILE = {
    target: '#topbar-profile', placement: 'bottom',
    title: 'Whenever you need it',
    body: 'This tour lives in your profile menu under <b>Product tour</b>. Your profile, password and sign-out are there too.'
  };

  // At most five stops each. Targets are the sidebar and topbar, which exist on
  // every page and in every data state, so a tour never depends on what a
  // school happens to have in its tables today.
  const ROLE_TOURS = {
    teacher: {
      intro: 'This is where you report a device that is not working and follow it until it is fixed.',
      steps: [
        { target: nav('report'), title: 'Report a problem',
          body: 'A tablet, the projector or the school server not working? Start here. Your report goes to your school administrator first, who can often fix it the same day.' },
        { target: nav('troubleshoot'), title: 'Try a guide first',
          body: 'Step-by-step fixes for the most common problems. Many take a few minutes, and the guides open even when the internet is down.' },
        { target: nav('tracker'), title: 'Follow your reports',
          body: 'Everything you have reported and where it stands. When a repair is done, open it and say whether it really worked.' },
        { target: nav('chat'), title: 'Ask the assistant',
          body: 'Describe what you see in your own words. It suggests what to try first and helps you write a clear report.' },
        PROFILE
      ]
    },
    school: {
      intro: 'You look after your school\'s devices here: your teachers\' reports, your tablets and your teachers\' accounts.',
      steps: [
        { target: nav('tracker'), title: 'Your school\'s faults',
          body: 'Reports from your teachers arrive here first, with you. Fix what you can on site; <b>Escalate</b> hands a fault to your field engineer.' },
        { target: nav('teachers'), title: 'Your teachers',
          body: 'Add teachers, share a registration link, approve new sign-ups, and choose who may update the tablet inventory.' },
        { target: nav('inventory'), title: 'Every tablet',
          body: 'The devices your school has, who is using each one, and each one\'s repair history.' },
        { target: '#notif-wrapper', placement: 'bottom', title: 'What needs you',
          body: 'New reports from your teachers, and sign-ups waiting for your approval, ring here.' },
        PROFILE
      ]
    },
    subadmin: {
      intro: 'You keep your schools running: what is late, which school to visit, and what to take with you.',
      steps: [
        { target: nav('followup'), title: 'What is late',
          body: 'Faults past their deadline and escalations, most urgent first. A good place to start the day.' },
        { target: nav('visits'), title: 'Plan a visit',
          body: 'Open faults grouped by school, so one trip fixes several. Each visit comes with a list of what to carry and the checks that are due.' },
        { target: nav('schools'), title: 'Your schools',
          body: 'The schools assigned to you, with their contacts, devices and fault history.' },
        { target: '#notif-wrapper', placement: 'bottom', title: 'Handed to you',
          body: 'When a fault is assigned to you — including one a school escalates — it rings here.' },
        PROFILE
      ]
    },
    admin: {
      intro: 'You run the platform: who gets access, how support is going, and how the system is kept safe.',
      steps: [
        { target: nav('approvals'), title: 'New school administrators',
          body: 'People who register for a school wait here until you approve them.' },
        { target: nav('analytics'), title: 'How support is going',
          body: 'Deadlines met, faults by school and by category, and the trend over time.' },
        { target: nav('team'), title: 'Field engineers',
          body: 'Create field-engineer accounts and give each one their schools.' },
        { target: nav('security'), title: 'Security, in plain words',
          body: 'How the system protects school data, written so you can explain it to a head teacher or a funder. Security alerts ring on the bell.' },
        { ...PROFILE, title: 'Your account',
          body: 'Two-step sign-in, <b>Sign Out Everywhere</b> and this tour are all in your profile menu.' }
      ]
    }
  };

  // Page tours: started by the "Show me how" button on the page itself.
  const PAGE_TOURS = {
    'page:report': {
      page: 'report',
      steps: [
        { target: () => fieldOf('f-category'), title: 'Say what kind of problem',
          body: 'The category decides who is best placed to fix it, and brings up guides that match.' },
        { target: () => fieldOf('f-title'), title: 'Name it in a few words',
          body: 'As you type, matching guides appear just below. If one solves it, press <b>This fixed it</b> — no report needed.' },
        { target: '#attach-zone', title: 'Show, don\'t describe',
          body: 'A photo of the screen or the error message can save a visit. Large photos are made smaller before they are sent.' },
        { target: '#report-submit-btn', placement: 'top', title: 'Works without internet',
          body: 'If the connection is down, the report waits safely on this device and sends itself when the network is back.' }
      ]
    }
  };

  const fieldOf = (id) => { const el = document.getElementById(id); return el ? (el.closest('.form-group') || el) : null; };

  let tours = null;          // this account's progress, from the server; null = unknown
  let offered = false;       // offer at most once per page load
  let run = null;            // { id, steps, i, returnFocus, openedDrawer }
  let els = null;
  let raf = 0;

  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = () => window.innerWidth <= 520;

  // ---- state -------------------------------------------------------------
  async function loadState() {
    try { tours = (await API.getTours()).tours || {}; }
    catch (e) { tours = null; }      // offline or refused: unknown, so never nag
    return tours;
  }

  function save(id, status, step) {
    if (tours) tours[id] = { status, step, at: new Date().toISOString() };
    API.saveTour(id, { status, step }).then(r => { if (r && r.tours) tours = r.tours; }).catch(() => {});
  }

  /** Called by App.init after the first render: offer the role tour once, if never offered. */
  async function boot() {
    const user = API.getUser();
    if (!user || user.must_change_password || offered || !ROLE_TOURS[user.role]) return;
    await loadState();
    if (!tours || tours.role) return;               // unknown, or already offered once
    offered = true;
    setTimeout(() => {
      // Never on top of something the person is already doing.
      const modalOpen = document.getElementById('modal')?.classList.contains('open');
      if (!run && !modalOpen && API.getUser()) start('role', { welcome: true });
    }, 900);
  }

  function forget() { stop(false); tours = null; offered = false; }

  // ---- running -------------------------------------------------------------
  function start(id, opts = {}) {
    const user = API.getUser();
    if (!user) return;
    const def = id === 'role' ? ROLE_TOURS[user.role] : PAGE_TOURS[id];
    if (!def) return;
    closeProfileMenu();
    stop(false);
    const steps = def.steps.map(s => ({ ...s, page: s.page || def.page }));
    if (opts.welcome) {
      const first = (user.full_name || '').trim().split(/\s+/)[0];
      steps.unshift({ welcome: true, title: `Welcome${first ? ', ' + first : ''}`,
        body: `${def.intro} Would you like a one-minute look around? It is ${def.steps.length} stops.` });
    }
    run = { id, steps, i: -1, returnFocus: document.activeElement, openedDrawer: false, total: def.steps.length, saved: false };
    mount();
    go(0, 1);
  }

  async function go(i, dir) {
    if (!run) return;
    if (i < 0) i = 0;
    if (i >= run.steps.length) return finish('completed');
    const step = run.steps[i];
    run.i = i;
    const token = run;

    if (step.welcome) { place(null, step); return; }
    // Recorded only once a real stop is reached: a welcome card closed by a reload,
    // or never answered, must not use up the one offer this account gets.
    if (!run.saved) { run.saved = true; save(run.id, 'started', 0); }

    if (step.page && Router.getCurrentPage() !== step.page) {
      run.navigating = true;
      Router.navigate(step.page);
      await App.loadAndRender();
      if (run !== token) return;
      run.navigating = false;
    }
    let el = resolve(step.target);
    // Nav items live in the drawer on tablets and phones: open it for them.
    const inSidebar = (x) => x && x.closest && x.closest('#sidebar');
    if (el && inSidebar(el) && window.innerWidth <= 920 && !$('sidebar').classList.contains('open')) {
      Router.toggleSidebar(); run.openedDrawer = true;
      await wait(reduced() ? 30 : 320);
    } else if (el && !inSidebar(el) && run.openedDrawer) {
      Router.closeSidebar(); run.openedDrawer = false;
      await wait(reduced() ? 30 : 280);
    }
    el = await waitFor(step.target, 4000);
    if (run !== token) return;
    if (!el) return go(i + dir, dir);                 // not on this account's screen: skip it
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    await wait(reduced() ? 30 : 320);
    if (run !== token) return;
    place(el, step);
  }

  function next() { if (run) go(run.i + 1, 1); }
  function back() { if (run) go(run.i - 1, -1); }
  function skip() { finish('dismissed'); }

  function finish(status) {
    if (!run) return;
    // The welcome card is not a stop: "Not now" on it is step 0.
    const offset = run.steps[0] && run.steps[0].welcome ? 1 : 0;
    save(run.id, status, Math.max(0, Math.min(run.i - offset + 1, run.total)));
    stop(true);
  }

  function stop(restoreFocus) {
    if (!run) { unmount(); return; }
    const r = run;
    run = null;
    if (r.openedDrawer) Router.closeSidebar();
    unmount();
    if (restoreFocus && r.returnFocus && document.contains(r.returnFocus) && r.returnFocus.focus) {
      try { r.returnFocus.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  // ---- DOM ---------------------------------------------------------------
  function mount() {
    if (els) return;
    const root = document.createElement('div');
    root.className = 'tour-root' + (reduced() ? ' tour-still' : '');
    root.innerHTML = `
      <div class="tour-veil" data-tour="veil"></div>
      <div class="tour-spot" data-tour="spot" aria-hidden="true"></div>
      <div class="tour-bubble" data-tour="bubble" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body" tabindex="-1">
        <div class="tour-arrow" data-tour="arrow" aria-hidden="true"></div>
        <div data-tour="content"></div>
      </div>
      <div class="sr-only" aria-live="polite" data-tour="live"></div>`;
    document.body.appendChild(root);
    els = {
      root,
      veil: root.querySelector('[data-tour="veil"]'),
      spot: root.querySelector('[data-tour="spot"]'),
      bubble: root.querySelector('[data-tour="bubble"]'),
      arrow: root.querySelector('[data-tour="arrow"]'),
      content: root.querySelector('[data-tour="content"]'),
      live: root.querySelector('[data-tour="live"]')
    };
    // A stray tap on the page should not throw the tour away on a tablet.
    els.veil.addEventListener('click', () => els.bubble.focus({ preventScroll: true }));
    els.content.addEventListener('click', onAction);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', schedule, true);
    window.addEventListener('hashchange', onHash);
    window.addEventListener('auth:expired', onExpired);
  }

  function unmount() {
    if (!els) return;
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', schedule);
    document.removeEventListener('scroll', schedule, true);
    window.removeEventListener('hashchange', onHash);
    window.removeEventListener('auth:expired', onExpired);
    cancelAnimationFrame(raf);
    els.root.remove();
    els = null;
  }

  function place(el, step) {
    if (!run || !els) return;
    const s = run.steps[run.i];
    const n = run.steps.filter(x => !x.welcome).length;
    const pos = run.steps.slice(0, run.i + 1).filter(x => !x.welcome).length;   // 1-based stop number
    const last = run.i === run.steps.length - 1;

    els.content.innerHTML = s.welcome ? `
      <div class="tour-welcome-icon"><i class="ti ti-route"></i></div>
      <div class="tour-title" id="tour-title">${esc(s.title)}</div>
      <div class="tour-body" id="tour-body">${s.body}</div>
      <div class="tour-actions">
        <button type="button" class="tour-btn ghost" data-act="skip">Not now</button>
        <button type="button" class="tour-btn primary" data-act="next"><i class="ti ti-player-play"></i>Show me around</button>
      </div>
      <div class="tour-foot-note">You can find it later under <b>Product tour</b> in your profile menu.</div>`
    : `
      <div class="tour-head">
        <span class="tour-count">${pos} of ${n}</span>
        <button type="button" class="tour-x" data-act="skip" aria-label="Skip tour"><i class="ti ti-x"></i></button>
      </div>
      <div class="tour-title" id="tour-title">${esc(s.title)}</div>
      <div class="tour-body" id="tour-body">${s.body}</div>
      <div class="tour-actions">
        <div class="tour-dots" aria-hidden="true">${Array.from({ length: n }, (_, k) => `<span class="${k < pos ? 'on' : ''}"></span>`).join('')}</div>
        <div class="tour-nav">
          ${pos > 1 ? '<button type="button" class="tour-btn ghost" data-act="back"><i class="ti ti-arrow-left"></i>Back</button>' : '<button type="button" class="tour-btn ghost" data-act="skip">Skip tour</button>'}
          <button type="button" class="tour-btn primary" data-act="next">${last ? '<i class="ti ti-check"></i>Done' : 'Next<i class="ti ti-arrow-right"></i>'}</button>
        </div>
      </div>`;
    run.el = el;
    els.root.classList.toggle('tour-centered', !el);
    position();
    els.live.textContent = s.welcome ? s.title : `Step ${pos} of ${n}: ${s.title}`;
    const primary = els.content.querySelector('[data-act="next"]');
    if (primary) primary.focus({ preventScroll: true });
  }

  function schedule() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(position);
  }

  /** Spotlight on the target; bubble beside it where it fits, docked at the bottom on a phone. */
  function position() {
    if (!run || !els) return;
    const el = run.el;
    const vw = window.innerWidth, vh = window.innerHeight, G = 16;
    const b = els.bubble;
    b.style.width = Math.min(340, vw - 2 * G) + 'px';
    if (!el || !document.contains(el)) {
      els.spot.style.opacity = '0';
      els.arrow.style.display = 'none';
      b.style.left = Math.round((vw - b.offsetWidth) / 2) + 'px';
      b.style.top = Math.max(G, Math.round((vh - b.offsetHeight) / 2)) + 'px';
      return;
    }
    const r = el.getBoundingClientRect();
    const pad = 6;
    Object.assign(els.spot.style, {
      opacity: '1',
      left: (r.left - pad) + 'px', top: (r.top - pad) + 'px',
      width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px'
    });
    const bw = b.offsetWidth, bh = b.offsetHeight, gap = 14;

    if (narrow()) {
      // A phone has no room beside anything: dock the bubble to the half the target is not in.
      const bottom = r.top + r.height / 2 < vh / 2;
      b.style.left = G + 'px';
      b.style.top = (bottom ? vh - bh - G - 24 : 64) + 'px';
      els.arrow.style.display = 'none';
      return;
    }
    const fits = {
      right: r.right + gap + bw <= vw - G,
      left: r.left - gap - bw >= G,
      bottom: r.bottom + gap + bh <= vh - G,
      top: r.top - gap - bh >= 56 + G
    };
    const order = [run.steps[run.i].placement, 'right', 'bottom', 'top', 'left'].filter(Boolean);
    const side = order.find(p => fits[p]) || 'bottom';
    let x, y;
    if (side === 'right' || side === 'left') {
      x = side === 'right' ? r.right + gap : r.left - gap - bw;
      y = clamp(r.top + r.height / 2 - bh / 2, 56 + G, vh - bh - G);
    } else {
      y = side === 'bottom' ? r.bottom + gap : r.top - gap - bh;
      x = clamp(r.left + r.width / 2 - bw / 2, G, vw - bw - G);
      y = clamp(y, G, vh - bh - G);
    }
    b.style.left = Math.round(x) + 'px';
    b.style.top = Math.round(y) + 'px';
    // The arrow points at the middle of the target, wherever the bubble was clamped to.
    const a = els.arrow;
    a.style.display = 'block';
    a.className = 'tour-arrow ' + side;
    if (side === 'right' || side === 'left') {
      a.style.top = clamp(r.top + r.height / 2 - y - 6, 14, bh - 26) + 'px';
      a.style.left = '';
    } else {
      a.style.left = clamp(r.left + r.width / 2 - x - 6, 14, bw - 26) + 'px';
      a.style.top = '';
    }
  }

  // ---- events ------------------------------------------------------------
  function onAction(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'next') next(); else if (act === 'back') back(); else if (act === 'skip') skip();
  }

  function onKey(e) {
    if (!run || !els) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); skip(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); back(); return; }
    if (e.key === 'Tab') {
      // Keep focus inside the bubble while the page behind it is covered.
      const f = [...els.bubble.querySelectorAll('button')];
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus({ preventScroll: true });
    }
  }

  // The person navigated away themselves (browser back): the tour no longer fits.
  function onHash() { if (run && !run.navigating) finish('dismissed'); }
  function onExpired() { stop(false); }

  // ---- helpers -------------------------------------------------------------
  function resolve(t) {
    const el = typeof t === 'function' ? t() : document.querySelector(t);
    if (!el || el.closest('.nav-hidden')) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? el : null;
  }

  async function waitFor(t, ms) {
    const until = Date.now() + ms;
    for (;;) {
      const el = resolve(t);
      if (el || Date.now() > until) return el;
      await wait(80);
    }
  }

  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, Math.max(lo, hi)));

  function closeProfileMenu() {
    if (typeof Auth !== 'undefined' && Auth.closeProfileMenu) Auth.closeProfileMenu();
  }

  // One delegated listener instead of inline onclick attributes: the strict script
  // policy (D24) is waiting for the inline handlers to go, so none are added here.
  // [data-tour-start="role"] is the profile menu item; "page:<name>" a page button.
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', (e) => {
      const t = e.target.closest && e.target.closest('[data-tour-start]');
      if (t) { e.preventDefault(); start(t.dataset.tourStart); }
    });
    // The profile item is a div with role="button": Enter and Space must work too.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const t = e.target.closest && e.target.closest('[data-tour-start][role="button"]');
      if (t) { e.preventDefault(); start(t.dataset.tourStart); }
    });
  }

  /** "Product tour" in the profile menu. */
  function replay() { start('role'); }

  /** For a page's "Show me how" button — rendered only where a page tour exists. */
  function pageButton(page) {
    return PAGE_TOURS['page:' + page]
      ? `<button type="button" class="tour-page-btn" data-tour-start="page:${page}"><i class="ti ti-help-circle"></i>Show me how</button>`
      : '';
  }

  return { boot, start, replay, next, back, skip, forget, pageButton, isRunning: () => !!run, _defs: { ROLE_TOURS, PAGE_TOURS } };
})();
