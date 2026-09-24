/**
 * Security Overview (platform admin only).
 *
 * How this system protects school data, in words a platform admin can repeat
 * to a head teacher, a funder or the regional office — next to live facts from
 * GET /api/security/overview so the explanation can be checked, not just read.
 *
 * Rules this page keeps:
 *  - Every layer says HOW WE KNOW it is in place: an automated test, a code
 *    review, or the hosting record. "In place" is never asserted on hope.
 *  - Gaps are shown as gaps. A briefing that hides them is the one that
 *    collapses at the first hard question.
 *  - A signal the system does not collect is shown as "not recorded", never 0.
 */
const SecurityPage = (() => {
  let data = null;
  let loadError = null;
  let pollTimer = null;

  const STATUS = {
    in:         { label: 'In place',   color: 'var(--green)',  bg: 'rgba(45,217,138,.12)' },
    partial:    { label: 'Partial',    color: 'var(--amber)',  bg: 'rgba(245,166,35,.12)' },
    planned:    { label: 'Planned',    color: 'var(--accent)', bg: 'rgba(79,124,255,.12)' },
    unverified: { label: 'Unverified', color: 'var(--text3)',  bg: 'var(--bg3)' }
  };
  const EVIDENCE = {
    tested:     { icon: 'ti-test-pipe', label: 'Automated test' },
    code:       { icon: 'ti-code',      label: 'Code review' },
    documented: { icon: 'ti-file-text', label: 'Hosting record' },
    none:       { icon: 'ti-question-mark', label: 'Not yet verified' }
  };

  // The layers, outermost first. Status and evidence reflect the 2026-09-24
  // review (docs/engineering/security-program/SECURITY_BASELINE.md).
  const LAYERS = [
    { icon: 'ti-lock', color: 'var(--accent)', title: 'Encrypted connection', status: 'in', evidence: 'code',
      plain: 'Everything between a phone or laptop and the system travels encrypted, so nobody on the school Wi-Fi or on the internet can read it on the way.',
      tech: 'HTTPS only — plain HTTP is redirected in production; HSTS for one year; Let\'s Encrypt certificate on the host.' },
    { icon: 'ti-key', color: 'var(--purple)', title: 'Personal sign-in', status: 'in', evidence: 'code',
      plain: 'Every person has their own account. Passwords are stored scrambled one way, so nobody — head office included — can read them back. Repeated guessing is slowed down automatically.',
      tech: 'bcrypt hashes (cost 10–12). Per 15 minutes: 20 attempts per account from one network, 60 per account from anywhere, 120 per network — all tested, and every throttled attempt recorded.' },
    { icon: 'ti-clock-shield', color: 'var(--teal)', title: 'Sessions', status: 'in', evidence: 'tested',
      plain: 'After sign-in the browser holds a signed pass that expires after 7 days. Changing a password signs out every other device; anyone can sign out everywhere from their profile menu; a suspended account stays signed out even when it is reactivated.',
      tech: 'Signed JWT carrying the account\'s session version, re-checked on every request (SEC-005, 19 tested assertions). Remaining gap: the pass is kept in browser storage, so escaping everything rendered stays essential.' },
    { icon: 'ti-building-community', color: 'var(--green)', title: 'Roles and school isolation', status: 'in', evidence: 'tested',
      plain: 'A teacher sees their own reports, a school administrator sees their own school, a field engineer sees the schools assigned to them, and only head office sees every school. The server decides this on every request — hiding a button is never the protection.',
      tech: 'Role check on every API router plus a per-record school check. 196 automated assertions across the role matrix (125) and the security suite (71).' },
    { icon: 'ti-code', color: 'var(--amber)', title: 'Safe handling of what people type', status: 'partial', evidence: 'tested',
      plain: 'Text one person types is always shown to others as text and never run as code. Database commands and data are kept apart, so typed text cannot change a query.',
      tech: 'Parameterised SQL throughout; output escaped; fixed-choice fields validated on the server; Content-Security-Policy blocks scripts from other sites. Gap: the policy still allows inline scripts.' },
    { icon: 'ti-file-certificate', color: 'var(--accent)', title: 'File uploads', status: 'partial', evidence: 'code',
      plain: 'Only known document, image, audio and video types are accepted, and files are kept on a separate storage service — never run on our server.',
      tech: 'Extension allow-list; 15 MB per fault attachment (tested); stored on Cloudinary, a different web origin. Gap: no malware scan.' },
    { icon: 'ti-plug-connected', color: 'var(--teal)', title: 'Connections from other systems', status: 'in', evidence: 'tested',
      plain: 'WhatsApp, SMS/USSD, school servers and the deployment hook must present a secret key or signature. Without it the request is refused — and if the key is not configured, the door stays shut rather than open.',
      tech: 'HMAC-SHA256 with timing-safe comparison on WhatsApp and deploy; shared keys on heartbeat and phone intake; all fail closed.' },
    { icon: 'ti-database', color: 'var(--purple)', title: 'Database', status: 'in', evidence: 'documented',
      plain: 'The database sits on the same server as the application and is not reachable from the internet.',
      tech: 'MySQL on localhost of the hosting account; credentials only in the hosting panel.' },
    { icon: 'ti-history', color: 'var(--amber)', title: 'Accountability', status: 'partial', evidence: 'tested',
      plain: 'Important administrative actions are written to an audit trail, and every refused request — a wrong password, a page outside a person\'s role, another school\'s record, a message without its key — is recorded as evidence.',
      tech: 'audit_log for administrative writes; security_events for every 401/403/429 since 24 September 2026 (no passwords, tokens or typed usernames — tested). Gaps: nothing alerts on them yet; neither log is tamper-evident.' },
    { icon: 'ti-radar-2', color: 'var(--red)', title: 'Detection and alerting', status: 'planned', evidence: 'none',
      plain: 'Automatic detection of attacks, alerts to head office, and blocking of hostile addresses.',
      tech: 'Security Center — event log, detection rules, alerts, reviewed IP blocking. Next phase; nothing will block live traffic without your approval.' },
    { icon: 'ti-database-export', color: 'var(--text3)', title: 'Backup and recovery', status: 'unverified', evidence: 'none',
      plain: 'Copies of the data kept so the system can be restored after a failure or an attack.',
      tech: 'Hosting backups; targets of 24 hours of data and 4 hours to recover. The restore drill passes on a copy of the database; until it has run on a production backup, recovery is unverified.' }
  ];

  // DECISIONS.md D22: every limit is labelled with the kind of limit it is.
  const LIMIT_KIND = {
    planned:    { label: 'Planned',     color: 'var(--accent)', bg: 'rgba(79,124,255,.12)' },
    partial:    { label: 'Partly done', color: 'var(--amber)',  bg: 'rgba(245,166,35,.12)' },
    impossible: { label: 'Impossible — alternative in place', color: 'var(--red)', bg: 'rgba(255,82,99,.12)' },
    constraint: { label: 'Constraint — handled by design', color: 'var(--teal)', bg: 'rgba(54,217,204,.12)' }
  };
  const LIMITS = [
    { kind: 'planned', title: 'No second sign-in factor yet.',
      text: 'A stolen platform admin password is enough to sign in today. Next: a code from an authenticator app for the platform admin — not SMS, which a stolen SIM defeats.' },
    { kind: 'partial', title: 'Attacks are recorded, not yet alerted on.',
      text: 'Every refusal has been kept as evidence since 24 September 2026. Rules that recognise an attack and alert head office come next.' },
    { kind: 'impossible', title: 'No website can see a device\'s hardware (MAC) address.',
      text: 'It never leaves the school\'s network — the router replaces it, and modern phones randomise it. We block by account, by session and by network address instead; device-level blocking belongs in the school\'s own Wi-Fi router.' },
    { kind: 'constraint', title: 'A whole school shares one internet address.',
      text: 'So we refuse by account first, never block a school\'s known address automatically, and keep any automatic block short and reviewed.' },
    { kind: 'partial', title: 'Recovery is proven on a copy, not yet on a production backup.',
      text: 'The restore drill exists and passes; its first run on a real backup from the host is due.' }
  ];

  const ROLES = [
    { role: 'Teacher', icon: 'ti-user', color: 'var(--green)', sees: 'Their own fault reports, guides, their school\'s inventory (read-only unless granted)' },
    { role: 'School admin', icon: 'ti-school', color: 'var(--teal)', sees: 'Their own school only — faults, teachers, inventory, check-ins' },
    { role: 'Field engineer', icon: 'ti-tool', color: 'var(--amber)', sees: 'The schools assigned to them, and visits they are running' },
    { role: 'Platform admin', icon: 'ti-shield-lock', color: 'var(--red)', sees: 'Every school; accounts, approvals, audit trail, this page' }
  ];

  const STANDARDS = [
    { name: 'NIST CSF 2.0 — Govern', status: 'in', note: 'A written security policy is adopted: one accountable owner (the platform admin), access rules, change control and a quarterly access review.' },
    { name: 'NIST CSF 2.0 — Identify', status: 'in', note: 'Every endpoint, role, threat and item of personal data is inventoried — and a test fails if the endpoint list drifts from the code.' },
    { name: 'NIST CSF 2.0 — Protect', status: 'in', note: 'Access control, encryption, input and output safety, signed integrations. Next: a second sign-in factor.' },
    { name: 'NIST CSF 2.0 — Detect', status: 'partial', note: 'Every refusal is recorded since 24 September 2026. Nothing raises an alert on it yet — detection rules come next.' },
    { name: 'NIST CSF 2.0 — Respond', status: 'partial', note: 'Incident runbook adopted, including when to tell the Data Protection Commission. First rehearsal due within 30 days.' },
    { name: 'NIST CSF 2.0 — Recover', status: 'partial', note: 'Targets set: data at most 24 hours old, service back within 4 hours. The restore drill is proven on a copy; the first drill on a production backup is due.' },
    { name: 'OWASP ASVS 5.0', status: 'partial', note: 'Target: every Level 1 requirement, and Level 2 for sign-in, sessions and access. Not a certification — no outside party has assessed the system.' },
    { name: 'OWASP API Security Top 10 (2023)', status: 'partial', note: 'All ten risks mapped. Object-level access (API1) and the endpoint inventory (API9) are tested on every release. Open: second factor, upload size.' },
    { name: 'Tanzania Personal Data Protection Act, 2022', status: 'partial', note: 'Personal data, processors, transfers abroad and retention are documented, and the AI assistant no longer sends anyone\'s name abroad. Registering with the PDPC is a step for head office.' }
  ];

  const CHECK_LABELS = {
    https_enforced: 'HTTPS enforced on this deployment',
    signing_secret_strong: 'Sign-in passes signed with a strong secret',
    deploy_webhook_signed: 'Deployment hook requires a signature',
    heartbeat_key_set: 'School-server heartbeat requires a key',
    whatsapp_signature_set: 'WhatsApp messages require a signature',
    phone_intake_key_set: 'SMS / USSD callbacks require a key',
    database_url_absent: 'Database target set only by DB_* variables',
    email_alerts_configured: 'Email configured for notifications'
  };

  // ---- data ---------------------------------------------------------------
  async function load() {
    try { data = await API.getSecurityOverview(); loadError = null; }
    catch (e) { data = null; loadError = e.error || 'Could not load the live checks.'; }
    schedulePoll();
  }

  /** The default-password scan runs in the background; ask again once it has had time. */
  function schedulePoll() {
    clearTimeout(pollTimer);
    if (!data || data.accounts.on_default_password !== null) return;
    pollTimer = setTimeout(async () => {
      if (Router.getCurrentPage() !== 'security') return;
      await load();
      const el = document.getElementById('sec-stats');
      if (el) el.innerHTML = statCards();
      const banner = document.getElementById('sec-banner');
      if (banner) banner.innerHTML = alertBanner();
    }, 10000);
  }

  function reviewCounts() {
    const f = (data && data.review && data.review.findings) || [];
    return { total: f.length, fixed: f.filter(x => x.status === 'fixed').length, open: f.filter(x => x.status !== 'fixed') };
  }

  // ---- pieces -------------------------------------------------------------
  function chip(status) {
    const s = STATUS[status] || STATUS.unverified;
    return `<span class="sec-chip" style="background:${s.bg};color:${s.color}">${s.label}</span>`;
  }

  function statCards() {
    const inPlace = LAYERS.filter(l => l.status === 'in').length;
    const partial = LAYERS.filter(l => l.status === 'partial').length;
    const rc = reviewCounts();
    const dp = data ? data.accounts.on_default_password : undefined;
    const dpVal = dp === undefined ? '—' : dp === null ? '…' : dp;
    const dpColor = dp > 0 ? 'var(--red)' : dp === 0 ? 'var(--green)' : 'var(--text3)';
    const dpSub = dp === undefined ? 'live check unavailable' : dp === null ? 'checking accounts…'
      : `of ${data.accounts.checked_for_default_password} active accounts`;
    const audit = data ? data.audit.events_last_30_days : '—';
    return `
      <div class="stat-card g">
        <div class="stat-label">Protection layers</div>
        <div class="stat-val" style="color:var(--green)">${inPlace}<span class="sec-stat-of">/${LAYERS.length}</span></div>
        <div class="stat-sub">in place · ${partial} partial</div>
      </div>
      <div class="stat-card ${rc.open.length ? 'a' : 'g'}">
        <div class="stat-label">Latest review</div>
        <div class="stat-val" style="color:var(--amber)">${rc.fixed}<span class="sec-stat-of">/${rc.total}</span></div>
        <div class="stat-sub">findings fixed · ${data ? esc(fmtDay(data.review.date)) : '—'}</div>
      </div>
      <div class="stat-card ${dp > 0 ? 'r' : 't'}">
        <div class="stat-label">Default passwords</div>
        <div class="stat-val" style="color:${dpColor}">${dpVal}</div>
        <div class="stat-sub">${esc(dpSub)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Audit events</div>
        <div class="stat-val" style="color:var(--accent)">${audit}</div>
        <div class="stat-sub">last 30 days</div>
      </div>`;
  }

  function alertBanner() {
    if (!data) return '';
    const dp = data.accounts.on_default_password;
    if (dp > 0) {
      return `<div class="alert-banner"><i class="ti ti-alert-triangle"></i>
        <div class="alert-banner-text"><strong>${dp} active account${dp === 1 ? '' : 's'} still accept${dp === 1 ? 's' : ''} the default password.</strong>
        Anyone who knows the default can sign in as them. Reset those passwords from Sub-Admins or School Admins.</div></div>`;
    }
    return '';
  }

  function fmtDay(iso) {
    const d = new Date(iso + (String(iso).length === 10 ? 'T00:00:00' : ''));
    return isNaN(d) ? String(iso) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function briefingText() {
    const rc = reviewCounts();
    const date = data ? fmtDay(data.review.date) : '';
    return [
      'The Technical Support System protects school information in layers.',
      'Every connection between a phone or laptop and the system is encrypted, so nobody can read the information on the way.',
      'Every person signs in with their own account, and the server — not the screen — decides what each person may see: a teacher sees their own reports, a school administrator sees only their own school, and only head office sees every school.',
      'Passwords are stored scrambled so that nobody, including us, can read them, and repeated password guessing is slowed down automatically.',
      'Messages from WhatsApp, SMS and the school servers must carry a secret key or signature before they are accepted, and important administrative changes are written to an audit trail.',
      rc.total ? `We review the system against international standards (OWASP ASVS 5.0, NIST CSF 2.0) and Tanzania's Personal Data Protection Act, 2022. The latest review (${date}) found ${rc.total} issues: ${rc.fixed} are fixed and ${rc.total - rc.fixed} are being worked on, including automatic attack detection and alerting.` : ''
    ].filter(Boolean);
  }

  function briefing() {
    return briefingText().map(p => `<p>${esc(p)}</p>`).join('');
  }

  function layerRows() {
    return LAYERS.map((l, i) => {
      const ev = EVIDENCE[l.evidence];
      return `<div class="sec-layer" data-layer="${i}" onmouseenter="SecurityPage.hlLayer(${i})" onmouseleave="SecurityPage.hlLayer(-1)">
        <div class="sec-layer-n">${i + 1}</div>
        <div class="sec-layer-icon" style="color:${l.color};background:color-mix(in srgb, ${l.color} 14%, transparent)"><i class="ti ${l.icon}"></i></div>
        <div class="sec-layer-body">
          <div class="sec-layer-head"><span class="sec-layer-title">${esc(l.title)}</span>${chip(l.status)}</div>
          <div class="sec-layer-plain">${esc(l.plain)}</div>
          <div class="sec-layer-tech">${esc(l.tech)}</div>
          <div class="sec-evidence"><i class="ti ${ev.icon}"></i>How we know: ${esc(ev.label)}</div>
        </div>
      </div>`;
    }).join('');
  }

  function roleTable() {
    const counts = {};
    ((data && data.accounts.by_role) || []).forEach(r => { counts[r.role] = r.active; });
    const key = { 'Teacher': 'teacher', 'School admin': 'school', 'Field engineer': 'subadmin', 'Platform admin': 'admin' };
    const rows = ROLES.map((r, i) => `
      ${i ? '<tr><td colspan="2" class="sec-sep"></td></tr>' : ''}
      <tr>
        <td class="sec-role-cell"><span class="sec-role"><i class="ti ${r.icon}" style="color:${r.color}"></i>${esc(r.role)}</span>
          ${data ? `<span class="sec-role-count">${counts[key[r.role]] || 0} active</span>` : ''}</td>
        <td class="sec-role-sees">${esc(r.sees)}</td>
      </tr>`).join('');
    return `<table class="sec-table">${rows}</table>`;
  }

  function standardRows() {
    return STANDARDS.map(s => `<div class="sec-std">
      <div class="sec-std-head"><span>${esc(s.name)}</span>${chip(s.status)}</div>
      <div class="sec-std-note">${esc(s.note)}</div>
    </div>`).join('');
  }

  function checkRows() {
    if (!data) return `<div class="sec-muted">${esc(loadError || 'Live checks unavailable.')}</div>`;
    const rows = Object.keys(CHECK_LABELS).map(k => {
      const v = data.checks[k];
      return `<div class="sec-check"><i class="ti ${v ? 'ti-circle-check' : 'ti-circle-x'}" style="color:${v ? 'var(--green)' : 'var(--amber)'}"></i>
        <span>${esc(CHECK_LABELS[k])}</span></div>`;
    }).join('');
    const nc = (data.not_collected || []).map(n => `<div class="sec-check"><i class="ti ti-circle-dashed" style="color:var(--text3)"></i>
      <span>${esc(n.why)}</span></div>`).join('');
    return `${rows}${nc}
      <div class="sec-foot">Running build <code>${esc(data.build)}</code> · checked ${esc(relTime(data.generated_at))}</div>`;
  }

  function reviewTable() {
    if (!data) return `<div class="sec-muted">${esc(loadError || 'Review summary unavailable.')}</div>`;
    const sev = { P0: 'var(--red)', P1: 'var(--red)', P2: 'var(--amber)', P3: 'var(--text3)' };
    const rows = data.review.findings.map(f => `<tr>
      <td class="sec-mono">${esc(f.id)}</td>
      <td><span class="sec-sev" style="color:${sev[f.severity] || 'var(--text3)'}">${esc(f.severity)}</span></td>
      <td>${esc(f.title)}</td>
      <td>${f.status === 'fixed' ? chip('in').replace('In place', 'Fixed') : chip('planned').replace('Planned', 'Open')}</td>
    </tr>`).join('');
    return `<div class="sec-review-meta"><i class="ti ti-calendar-event"></i>${esc(fmtDay(data.review.date))} · ${esc(data.review.scope)}</div>
      <div class="table-wrap"><table class="sec-review">
        <thead><tr><th>ID</th><th>Level</th><th>Finding</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <div class="sec-foot">P1 high · P2 medium · P3 low. Full evidence and fixes: <code>docs/engineering/security-program/ISSUE_REGISTER.md</code></div>`;
  }

  // ---- layers as rings ----------------------------------------------------
  // Outermost ring = layer 1. School data sits in the middle: everything an
  // attacker wants is behind every ring, and no ring is trusted alone.
  const RING = { cx: 150, cy: 150, inner: 44, step: 9.6, width: 6.4 };
  const RING_COLOR = { in: 'var(--green)', partial: 'var(--amber)', planned: 'var(--accent)', unverified: 'var(--text3)' };

  function layersRing() {
    const n = LAYERS.length;
    const rings = LAYERS.map((l, i) => {
      const r = RING.inner + (n - 1 - i) * RING.step;
      const dash = (l.status === 'planned' || l.status === 'unverified') ? ' stroke-dasharray="3 4"' : '';
      return `<circle class="sec-ring" data-layer="${i}" cx="${RING.cx}" cy="${RING.cy}" r="${r}"
        stroke="${RING_COLOR[l.status]}" stroke-width="${RING.width}"${dash}
        onmouseenter="SecurityPage.hlLayer(${i})" onmouseleave="SecurityPage.hlLayer(-1)"><title>${i + 1}. ${esc(l.title)} — ${STATUS[l.status].label}</title></circle>`;
    }).join('');
    return `<svg class="sec-ring-svg" viewBox="0 0 300 300" role="img" aria-label="${n} layers of protection drawn as rings around the school data; the list beside it describes each">
      ${rings}
      <circle cx="${RING.cx}" cy="${RING.cy}" r="${RING.inner - 8}" class="sec-ring-core"/>
      <text x="${RING.cx}" y="${RING.cy - 2}" class="sec-ring-t">School</text>
      <text x="${RING.cx}" y="${RING.cy + 13}" class="sec-ring-t">data</text>
    </svg>`;
  }

  /** Ring and row light together, whichever one the pointer is on. -1 clears. */
  function hlLayer(i) {
    document.querySelectorAll('.sec-ring, .sec-layer').forEach(el => {
      el.classList.toggle('hl', Number(el.dataset.layer) === i);
      el.classList.toggle('dim', i >= 0 && Number(el.dataset.layer) !== i && el.classList.contains('sec-ring'));
    });
  }

  function drawRings() {
    const rings = [...document.querySelectorAll('.sec-ring')];
    if (!rings.length || reducedMotion() || typeof gsap === 'undefined') return;
    rings.forEach(c => {
      const len = 2 * Math.PI * Number(c.getAttribute('r'));
      c.dataset.dash = c.getAttribute('stroke-dasharray') || '';
      c.setAttribute('stroke-dasharray', `${len} ${len}`);
      c.setAttribute('stroke-dashoffset', len);
    });
    gsap.to(rings, {
      attr: { 'stroke-dashoffset': 0 }, duration: 0.9, ease: 'power2.out', stagger: 0.07,
      onComplete() { rings.forEach(c => { c.dataset.dash ? c.setAttribute('stroke-dasharray', c.dataset.dash) : c.removeAttribute('stroke-dasharray'); c.removeAttribute('stroke-dashoffset'); }); }
    });
  }

  // ---- the journey of a request (animated) --------------------------------
  //
  // One diagram, several scenarios: a packet leaves a device (or an outside
  // system) and passes each checkpoint the real server applies, in the real
  // order, until it is saved or refused. Every refusal shown here is one the
  // code makes and a test asserts — the diagram is not allowed to promise more.
  //
  // GSAP is loaded on this page only (72 KB; school bandwidth is scarce) and
  // from our own origin (the CSP allows no CDN). Without it — or with reduced
  // motion — the diagram shows the end state and the step list tells the story.

  const NODES = {
    device:   { t: 'Phone or laptop', s: 'staff and teachers', c: 'var(--accent)' },
    partner:  { t: 'Outside systems', s: 'WhatsApp · SMS · LRS', c: 'var(--teal)' },
    https:    { t: 'Encrypted link', s: 'HTTPS · HSTS', c: 'var(--accent)' },
    gate:     { t: 'Front gate', s: 'rate limits', c: 'var(--amber)' },
    sig:      { t: 'Signature check', s: 'HMAC · shared key', c: 'var(--teal)' },
    identity: { t: 'Who are you?', s: 'signed pass · status', c: 'var(--purple)' },
    role:     { t: 'Role allowed?', s: '4 roles, server-side', c: 'var(--green)' },
    school:   { t: 'Your school?', s: 'record-level check', c: 'var(--green)' },
    data:     { t: 'Database', s: 'parameterised SQL', c: 'var(--purple)' }
  };
  const EDGES = [['device', 'https'], ['partner', 'https'], ['https', 'gate'], ['https', 'sig'],
    ['gate', 'identity'], ['identity', 'role'], ['role', 'school'], ['school', 'data'], ['sig', 'data']];
  const LAYOUTS = {
    wide: { w: 1032, h: 272, nw: 140, nh: 58, pos: {
      device: [16, 56], partner: [16, 176], https: [188, 116], gate: [360, 56], sig: [360, 176],
      identity: [532, 56], role: [704, 56], school: [876, 56], data: [876, 176] } },
    narrow: { w: 360, h: 640, nw: 150, nh: 54, pos: {
      device: [16, 16], partner: [194, 16], https: [105, 108], gate: [16, 200], sig: [194, 200],
      identity: [16, 292], role: [16, 384], school: [16, 476], data: [105, 568] } }
  };
  const PASS_NOTE = {
    https: 'Encrypted on the way — nobody on the school Wi-Fi can read it.',
    gate: 'Within normal limits, so it is let through.',
    sig: 'The signature matches the shared secret.',
    identity: 'The signed pass is genuine and the account is active.',
    role: 'This role is allowed to do this.',
    school: 'The record belongs to the person\'s own school.',
    data: 'Written with parameterised SQL — typed text can never change the command.'
  };
  const FLOWS = [
    { id: 'normal', label: 'A teacher reports a fault', icon: 'ti-circle-check', packets: [
      { route: ['device', 'https', 'gate', 'identity', 'role', 'school', 'data'],
        notes: { data: 'Saved. Only this school, its field engineer and head office can see it.' } }] },
    { id: 'guess', label: 'Password guessing', icon: 'ti-password', packets: [
      { route: ['device', 'https', 'gate', 'identity'], stopAt: 'identity',
        notes: { identity: 'Wrong password — refused. Each try counts against this account.' } },
      { route: ['device', 'https', 'gate', 'identity'], stopAt: 'identity', quiet: true, fast: true },
      { route: ['device', 'https', 'gate', 'identity'], stopAt: 'identity', quiet: true, fast: true },
      { route: ['device', 'https', 'gate'], stopAt: 'gate', quiet: true,
        notes: { gate: 'After 20 wrong tries in 15 minutes the gate refuses this account from this network before any password is checked. Every try is recorded as evidence.' } }] },
    { id: 'cross', label: 'Opening another school\'s record', icon: 'ti-arrows-exchange', packets: [
      { route: ['device', 'https', 'gate', 'identity', 'role', 'school'], stopAt: 'school',
        notes: { role: 'Teachers may read faults — so the role check passes.',
          school: 'Refused (403): the record belongs to another school. This exact attempt is in the automated tests for every role.' } }] },
    { id: 'stolen', label: 'Stolen laptop, account suspended', icon: 'ti-device-laptop-off', packets: [
      { route: ['device', 'https', 'gate', 'identity'], stopAt: 'identity',
        notes: { identity: 'The pass is still signed, but the account is suspended — refused on the very next request.' } }] },
    { id: 'forged', label: 'Forged WhatsApp message', icon: 'ti-brand-whatsapp', packets: [
      { route: ['partner', 'https', 'sig'], stopAt: 'sig',
        notes: { sig: 'No valid signature — discarded before it can file or read anything.' } }] },
    { id: 'partner', label: 'A genuine WhatsApp report', icon: 'ti-message-check', packets: [
      { route: ['partner', 'https', 'sig', 'data'],
        notes: { data: 'Filed for the school it names. An unknown number can report, but never read anything back.' } }] }
  ];

  let flowId = 'normal';
  let flowLayout = null;
  let flowTl = null;
  let gsapPromise = null;
  let resizeTimer = null;

  const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const flowById = (id) => FLOWS.find(f => f.id === id) || FLOWS[0];

  function loadGsap() {
    if (typeof gsap !== 'undefined') return Promise.resolve(true);
    if (gsapPromise) return gsapPromise;
    const own = document.querySelector('script[src*="pages/security.js"]');
    const v = own && own.getAttribute('src').match(/[?&]v=(\d+)/);
    gsapPromise = new Promise(resolve => {
      const s = document.createElement('script');
      s.src = 'js/vendor/gsap.min.js' + (v ? '?v=' + v[1] : '');
      s.onload = () => resolve(typeof gsap !== 'undefined');
      s.onerror = () => { gsapPromise = null; resolve(false); };
      document.head.appendChild(s);
    });
    return gsapPromise;
  }

  /** A curve between two nodes, leaving the side that faces the other one. */
  function edgePath(L, a, b) {
    const [ax, ay] = L.pos[a], [bx, by] = L.pos[b], w = L.nw, h = L.nh;
    const acx = ax + w / 2, acy = ay + h / 2, bcx = bx + w / 2, bcy = by + h / 2;
    if (Math.abs(bcx - acx) >= Math.abs(bcy - acy)) {
      const x1 = ax + w, x2 = bx, m = (x1 + x2) / 2;
      return `M${x1},${acy} C${m},${acy} ${m},${bcy} ${x2},${bcy}`;
    }
    const y1 = ay + h, y2 = by, m = (y1 + y2) / 2;
    return `M${acx},${y1} C${acx},${m} ${bcx},${m} ${bcx},${y2}`;
  }

  function flowSvg(L) {
    const edges = EDGES.map(([a, b]) =>
      `<path class="flow-edge" data-edge="${a}-${b}" d="${edgePath(L, a, b)}"/>`).join('');
    const nodes = Object.keys(NODES).map(k => {
      const n = NODES[k], [x, y] = L.pos[k], w = L.nw, h = L.nh;
      return `<g class="flow-node" data-node="${k}">
        <rect class="flow-box" x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/>
        <rect x="${x}" y="${y + 10}" width="3" height="${h - 20}" rx="1.5" fill="${n.c}"/>
        <text class="flow-t" x="${x + 16}" y="${y + h / 2 - 3}">${esc(n.t)}</text>
        <text class="flow-s" x="${x + 16}" y="${y + h / 2 + 14}">${esc(n.s)}</text>
        <g class="flow-mark flow-ok" transform="translate(${x + w - 6},${y + 6})">
          <circle r="9"/><path d="M-4,0 L-1,3 L4,-3"/></g>
        <g class="flow-mark flow-no" transform="translate(${x + w - 6},${y + 6})">
          <circle r="9"/><path d="M-3.5,-3.5 L3.5,3.5 M3.5,-3.5 L-3.5,3.5"/></g>
      </g>`;
    }).join('');
    return `<svg class="flow-svg flow-${L === LAYOUTS.wide ? 'wide' : 'narrow'}" viewBox="0 0 ${L.w} ${L.h}"
      role="img" aria-label="Diagram: the checkpoints a request passes on its way to the database">
      <g>${edges}</g><g>${nodes}</g><g class="flow-packets"></g></svg>`;
  }

  /**
   * The story as text: one line per checkpoint reached, in order, plus a map
   * from [packet][route index] to the line it lights (-1: lights nothing).
   * A "quiet" packet adds no pass lines; a quiet refusal at the same place as
   * the line before folds into it as "×N tries" instead of repeating it.
   */
  function flowSteps(f) {
    const steps = [], map = [];
    f.packets.forEach((p, pi) => {
      map[pi] = [-1];
      p.route.forEach((node, ni) => {
        if (!ni) return;
        const stop = p.stopAt === node;
        if (p.quiet && !stop) { map[pi][ni] = -1; return; }
        const last = steps[steps.length - 1];
        if (p.quiet && last && last.stop && last.node === node) {
          last.repeat++; map[pi][ni] = steps.length - 1; return;
        }
        const note = (p.notes && p.notes[node]) || (stop ? 'Refused.' : PASS_NOTE[node]);
        steps.push({ node, stop, note, repeat: 0 });
        map[pi][ni] = steps.length - 1;
      });
    });
    return { steps, map };
  }

  function flowStepsHtml(f) {
    return flowSteps(f).steps.map((s, i) => `<li class="flow-step" data-step="${i}">
      <span class="flow-step-ic ${s.stop ? 'no' : 'ok'}"><i class="ti ${s.stop ? 'ti-x' : 'ti-check'}"></i></span>
      <span><strong>${esc(NODES[s.node].t)}</strong>${s.repeat ? ` <span class="flow-rep">×${s.repeat + 1} tries</span>` : ''} — ${esc(s.note)}</span>
    </li>`).join('');
  }

  function flowChips() {
    return FLOWS.map(f => `<button class="chip flow-chip ${f.id === flowId ? 'chip-active' : ''}" aria-pressed="${f.id === flowId}"
      onclick="SecurityPage.setFlow('${f.id}')"><i class="ti ${f.icon}"></i>${esc(f.label)}</button>`).join('');
  }

  function flowCard() {
    return `<div class="card flow-card">
      <div class="card-title">
        <span><i class="ti ti-route" style="margin-right:6px"></i>How every request is checked</span>
        <button class="sec-btn sec-btn-teal flow-replay" onclick="SecurityPage.replayFlow()"><i class="ti ti-player-play"></i>Replay</button>
      </div>
      <div class="flow-chips" id="flow-chips">${flowChips()}</div>
      <div class="flow-stage" id="flow-stage"></div>
      <ol class="flow-steps" id="flow-steps">${flowStepsHtml(flowById(flowId))}</ol>
    </div>`;
  }

  function pickLayout() {
    const stage = document.getElementById('flow-stage');
    return stage && stage.clientWidth < 720 ? LAYOUTS.narrow : LAYOUTS.wide;
  }

  function nodeEl(k) { return document.querySelector(`#flow-stage [data-node="${k}"]`); }
  function edgeEl(a, b) { return document.querySelector(`#flow-stage [data-edge="${a}-${b}"]`); }

  function resetFlow() {
    if (flowTl) { flowTl.kill(); flowTl = null; }
    document.querySelectorAll('#flow-stage .flow-node').forEach(n => n.classList.remove('is-pass', 'is-stop'));
    document.querySelectorAll('#flow-stage .flow-edge').forEach(e => e.classList.remove('lit', 'lit-stop'));
    const packets = document.querySelector('#flow-stage .flow-packets');
    if (packets) packets.innerHTML = '';
    document.querySelectorAll('#flow-steps .flow-step').forEach(s => s.classList.remove('on'));
  }

  /** The end state of a scenario, drawn at once. Used without motion or without GSAP. */
  function showFlowEnd(f) {
    resetFlow();
    f.packets.forEach(p => p.route.forEach((k, i) => {
      if (i) {
        const e = edgeEl(p.route[i - 1], k);
        if (e) e.classList.add(p.stopAt === k ? 'lit-stop' : 'lit');
      }
      const n = nodeEl(k);
      if (!n || i === 0) return;
      if (p.stopAt === k) { n.classList.remove('is-pass'); n.classList.add('is-stop'); }
      else if (!n.classList.contains('is-stop')) n.classList.add('is-pass');
    }));
    document.querySelectorAll('#flow-steps .flow-step').forEach(s => s.classList.add('on'));
  }

  function playFlow(f) {
    resetFlow();
    const layer = document.querySelector('#flow-stage .flow-packets');
    if (!layer) return;
    const { map } = flowSteps(f);
    const lightStep = (si) => {
      const li = si >= 0 && document.querySelector(`#flow-steps [data-step="${si}"]`);
      if (li) li.classList.add('on');
    };
    const tl = gsap.timeline();
    f.packets.forEach((p, pi) => {
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('r', '6');
      dot.setAttribute('class', 'flow-dot');
      dot.style.opacity = '0';
      layer.appendChild(dot);
      const speed = p.fast ? 0.28 : 0.62;
      if (pi) tl.to({}, { duration: p.fast ? 0.05 : 0.25 });
      for (let k = 1; k < p.route.length; k++) {
        const a = p.route[k - 1], b = p.route[k];
        const path = edgeEl(a, b);
        if (!path) continue;
        const len = path.getTotalLength();
        const prog = { t: 0 };
        const stop = p.stopAt === b;
        tl.to(prog, {
          t: 1, duration: speed, ease: 'power1.inOut',
          onStart: () => { dot.style.opacity = '1'; path.classList.add(stop ? 'lit-stop' : 'lit'); },
          onUpdate: () => {
            const pt = path.getPointAtLength(prog.t * len);
            dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
          }
        });
        tl.call(() => {
          const n = nodeEl(b);
          if (n) { n.classList.remove('is-pass'); n.classList.add(stop ? 'is-stop' : 'is-pass'); }
          lightStep(map[pi][k]);
        });
        if (stop) {
          tl.call(() => dot.classList.add('stop'));
          tl.to(dot, { attr: { r: 11 }, opacity: 0, duration: 0.5, ease: 'power2.out' });
          break;
        }
        tl.to({}, { duration: p.fast ? 0.02 : 0.28 });
      }
      if (!p.stopAt) tl.to(dot, { opacity: 0, duration: 0.35, ease: 'power1.out' });
    });
    tl.call(() => document.querySelectorAll('#flow-steps .flow-step').forEach(s => s.classList.add('on')));
    flowTl = tl;
  }

  async function runFlow() {
    const f = flowById(flowId);
    if (reducedMotion()) return showFlowEnd(f);
    const ok = await loadGsap();
    if (flowById(flowId) !== f) return;            // the scenario changed while GSAP loaded
    if (!document.getElementById('flow-stage')) return;
    ok ? playFlow(f) : showFlowEnd(f);
  }

  function mountFlow() {
    const stage = document.getElementById('flow-stage');
    if (!stage) return;
    flowLayout = pickLayout();
    stage.innerHTML = flowSvg(flowLayout);
    runFlow();
  }

  /** In-place swap: chips, steps and the stage change; the page does not re-render. */
  function setFlow(id) {
    flowId = flowById(id).id;
    const chips = document.getElementById('flow-chips');
    const steps = document.getElementById('flow-steps');
    if (!chips || !steps) return;
    chips.innerHTML = flowChips();
    steps.innerHTML = flowStepsHtml(flowById(flowId));
    runFlow();
  }

  function replayFlow() { runFlow(); }

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!document.getElementById('flow-stage') || pickLayout() === flowLayout) return;
      flowLayout = pickLayout();
      document.getElementById('flow-stage').innerHTML = flowSvg(flowLayout);
      showFlowEnd(flowById(flowId));
    }, 200);
  });

  // ---- what the system refused (security_events) ---------------------------
  const SIGNALS = [
    { type: 'auth.login_failed', label: 'Wrong passwords', icon: 'ti-password', color: 'var(--amber)' },
    { type: 'auth.login_throttled', label: 'Sign-ins stopped at the front gate', icon: 'ti-hourglass-high', color: 'var(--red)' },
    { type: 'authz.refused', label: 'Records refused — not theirs', icon: 'ti-building-community', color: 'var(--red)' },
    { type: 'authz.role_refused', label: 'Pages refused for the role', icon: 'ti-user-shield', color: 'var(--purple)' },
    { type: 'webhook.rejected', label: 'Outside messages without a valid key', icon: 'ti-plug-x', color: 'var(--teal)' },
    { type: 'auth.token_rejected', label: 'Expired or invalid sign-in passes', icon: 'ti-key-off', color: 'var(--text3)' },
    { type: 'api.rate_limited', label: 'Requests slowed for volume', icon: 'ti-gauge', color: 'var(--accent)' },
    { type: 'auth.login_refused', label: 'Pending or deactivated accounts', icon: 'ti-user-pause', color: 'var(--text3)' },
    { type: 'events.dropped', label: 'Events dropped under load', icon: 'ti-alert-triangle', color: 'var(--red)' }
  ];

  function signalsCard() {
    if (!data || !data.signals) {
      return `<div class="card"><div class="card-title"><span><i class="ti ti-eye" style="margin-right:6px"></i>What the system refused</span></div>
        <div class="sec-muted">${esc(loadError || 'Signals unavailable.')}</div></div>`;
    }
    const by = {};
    data.signals.by_type.forEach(r => { by[r.event_type] = r; });
    const shown = SIGNALS.filter(s => s.type !== 'events.dropped' || by[s.type]);
    const max = Math.max(1, ...shown.map(s => (by[s.type] || {}).count || 0));
    const rows = shown.map(s => {
      const r = by[s.type] || { count: 0, sources: 0 };
      const pct = r.count ? Math.max(2, Math.round(r.count / max * 100)) : 0;
      return `<div class="sig-row">
        <div class="sig-label"><i class="ti ${s.icon}" style="color:${s.color}"></i>${esc(s.label)}</div>
        <div class="sig-track"><div class="sig-bar" data-w="${pct}" style="background:${s.color}"></div></div>
        <div class="sig-num">${r.count.toLocaleString()}<span>${r.count ? `from ${r.sources} address${r.sources === 1 ? '' : 'es'}` : ''}</span></div>
      </div>`;
    }).join('');
    const since = data.signals.recording_since;
    return `<div class="card">
      <div class="card-title"><span><i class="ti ti-eye" style="margin-right:6px"></i>What the system refused · last ${data.signals.window_days} days</span></div>
      <div class="sig-rows">${rows}</div>
      <div class="sec-foot">${since ? 'Recording since ' + esc(fmtDay(String(since).slice(0, 10))) + '. ' : 'Recording has started; nothing refused yet. '}Repeats within a minute count once per row but are all added up here. A school shares one address, so "addresses" counts networks, not people. Nothing here raises an alert yet.</div>
    </div>`;
  }

  function growBars() {
    const bars = document.querySelectorAll('.sig-bar');
    requestAnimationFrame(() => bars.forEach(b => { b.style.width = b.dataset.w + '%'; }));
  }

  // ---- page ---------------------------------------------------------------
  function render() {
    return `
    <div class="section-header">
      <div>
        <div class="section-title">Security Overview</div>
        <div class="section-sub">How this system protects school data · written to be explained to stakeholders</div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="sec-btn" onclick="SecurityPage.copyBriefing()"><i class="ti ti-copy"></i>Copy briefing</button>
        <button class="sec-btn sec-btn-teal" onclick="Router.navigate('audit');App.loadAndRender()"><i class="ti ti-history"></i>Audit Log</button>
      </div>
    </div>

    <div class="sec-body">
    <div id="sec-banner">${alertBanner()}</div>

    <div class="stats-grid sec-stats" id="sec-stats">${statCards()}</div>

    ${flowCard()}

    ${signalsCard()}

    <div class="card sec-briefing-card">
      <div class="card-title">
        <span><i class="ti ti-speakerphone" style="margin-right:6px"></i>The short version</span>
      </div>
      <div class="sec-briefing" id="sec-briefing">${briefing()}</div>
    </div>

    <div class="card">
      <div class="card-title"><span><i class="ti ti-stack-2" style="margin-right:6px"></i>Layers of protection</span></div>
      <div class="sec-layer-intro">No single safeguard is trusted on its own. Each layer assumes the one before it might fail — the approach Google, Microsoft and AWS publish as defence in depth and "assume breach".</div>
      <div class="sec-layers-wrap">
        <div class="sec-ring-box">${layersRing()}
          <div class="sec-ring-legend">
            <span><i style="background:var(--green)"></i>In place</span><span><i style="background:var(--amber)"></i>Partial</span>
            <span><i class="dash" style="border-color:var(--accent)"></i>Planned</span><span><i class="dash" style="border-color:var(--text3)"></i>Unverified</span>
          </div>
        </div>
        <div class="sec-layers" id="sec-layers">${layerRows()}</div>
      </div>
    </div>

    <div class="two-col sec-two">
      <div class="card">
        <div class="card-title"><span><i class="ti ti-users" style="margin-right:6px"></i>Who can see what</span></div>
        ${roleTable()}
        <div class="sec-foot">Enforced by the server on every request, and re-tested automatically before release.</div>
      </div>
      <div class="card">
        <div class="card-title"><span><i class="ti ti-activity-heartbeat" style="margin-right:6px"></i>Live checks on this deployment</span></div>
        ${checkRows()}
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span><i class="ti ti-certificate" style="margin-right:6px"></i>Standards we measure against</span></div>
      <div class="sec-std-grid">${standardRows()}</div>
    </div>

    <div class="card">
      <div class="card-title"><span><i class="ti ti-clipboard-check" style="margin-right:6px"></i>Latest security review</span></div>
      ${reviewTable()}
    </div>

    <div class="card">
      <div class="card-title"><span><i class="ti ti-alert-octagon" style="margin-right:6px"></i>Honest limits</span></div>
      <div class="sec-layer-intro">Each limit says which kind it is — so "we cannot" is never confused with "we have not yet".</div>
      <ul class="sec-limits">${LIMITS.map(l => `<li><span class="sec-limit-tag" style="color:${LIMIT_KIND[l.kind].color};background:${LIMIT_KIND[l.kind].bg}">${LIMIT_KIND[l.kind].label}</span>
        <div><strong>${esc(l.title)}</strong> ${esc(l.text)}</div></li>`).join('')}
      </ul>
    </div>
    </div>`;
  }

  /**
   * Selection copy first, synchronously inside the click: it works on the older
   * tablet WebViews, and in an embedded browser the async clipboard was seen to
   * stay pending forever — no copy and no message. The async API is the fallback.
   */
  function copyBriefing() {
    const text = briefingText().join('\n\n');
    const done = () => showToast('Briefing copied');
    const fail = () => showToast('Could not copy — select the text and copy it manually');
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    if (ok) return done();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fail);
    else fail();
  }

  function afterRender() {
    const main = document.querySelector('main');
    if (main) main.querySelectorAll('.card, .stat-card, .alert-banner').forEach(c => c.classList.add('reveal', 'visible'));
    mountFlow();
    growBars();
    if (!reducedMotion()) loadGsap().then(ok => { if (ok) drawRings(); });
  }

  return { load, render, afterRender, copyBriefing, setFlow, replayFlow, hlLayer };
})();
