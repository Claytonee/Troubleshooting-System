/**
 * How It Works — the two processes people ask about most, drawn and written (D35).
 *
 *   1. Joining: a school administrator registers, head office approves, the
 *      school admin opens a registration link for their teachers (with a cap),
 *      and approves each teacher who uses it.
 *   2. A fault: from the teacher who reports it, through the school admin and
 *      head office (OE), to the field engineer who fixes it.
 *
 * Every step here was checked against the code before it was written, and
 * `backend/scripts/verify-workflows.js` keeps it that way: each number in FACTS
 * is compared with the constant it describes, each button named with ui() must
 * exist in the frontend, and each hop in a diagram must be a drawn edge.
 * Writing this guide is what found FLOW-001 (escalations that rang no bell).
 *
 * The diagram reuses the Security Overview's flow styles. GSAP moves the
 * packet when it is available and motion is allowed; otherwise the end state
 * is drawn at once. The numbered list under it is the text equivalent.
 */
const WorkflowsPage = (() => {
  /** Numbers the guide states. verify-workflows.js compares each with the code. */
  const FACTS = {
    linkDays: 7,
    capMin: 1,
    capMax: 500,
    capSuggestExtra: 5,
    passwordMin: 8,
    photos: 5,
    ratingMax: 5,
    sla: { critical: 4, high: 24, medium: 72, low: 168 },
    categories: ['Connectivity', 'Hardware', 'Platform', 'Power', 'Accounts', 'Other'],
    reasons: [
      'Beyond school capacity',
      'Requires hardware replacement',
      'Needs vendor/ISP intervention',
      'Recurring unresolved issue',
      'SLA breach — needs urgent help',
      'Policy or accounts issue'
    ]
  };

  const WHO = {
    school:   { label: 'School admin', c: 'var(--amber)', bg: 'rgba(245,166,35,.12)' },
    head:     { label: 'Head office', c: 'var(--purple)', bg: 'rgba(155,125,255,.12)' },
    teacher:  { label: 'Teacher', c: 'var(--accent)', bg: 'rgba(79,124,255,.12)' },
    engineer: { label: 'Field engineer', c: 'var(--teal)', bg: 'rgba(54,217,204,.12)' },
    anyone:   { label: 'Anyone who resolves', c: 'var(--green)', bg: 'rgba(45,217,138,.12)' }
  };

  /** A button or screen name exactly as the app shows it (checked by the suite). */
  const ui = (s) => `<b class="wf-ui">${s}</b>`;
  const who = (k) => `<span class="wf-who" style="color:${WHO[k].c};background:${WHO[k].bg}">${WHO[k].label}</span>`;
  const slaText = () => `critical ${FACTS.sla.critical} hours, high ${FACTS.sla.high} hours, medium ${FACTS.sla.medium / 24} days, low ${FACTS.sla.low / 24} days`;

  /* ------------------------------------------------------------------ *
   * The two guides. Nodes, edges, two layouts (wide / narrow) and the
   * scenarios. A step with `from` travels the edge from→at; one without
   * starts a new packet at `at`. `stop` draws a refusal.
   * ------------------------------------------------------------------ */
  const GUIDES = {
    join: {
      id: 'join',
      tab: 'Joining: schools and teachers',
      icon: 'ti-user-plus',
      title: 'From a registration form to a teacher who can sign in',
      nodes: {
        form:     { t: 'Register here', s: 'school admin · public', c: 'var(--accent)' },
        pending:  { t: 'Waiting page', s: 'checks by itself', c: 'var(--amber)' },
        review:   { t: 'Head office', s: 'Approvals page', c: 'var(--purple)' },
        appeal:   { t: 'Appeal', s: 'after a rejection', c: 'var(--red)' },
        account:  { t: 'School admin', s: 'account · signs in', c: 'var(--green)' },
        link:     { t: 'Registration link', s: `${FACTS.linkDays} days · up to ${FACTS.capMax}`, c: 'var(--teal)' },
        tform:    { t: 'Teacher registers', s: 'school set by the link', c: 'var(--accent)' },
        tapprove: { t: 'School admin', s: 'approves the teacher', c: 'var(--amber)' },
        teacher:  { t: 'Teacher', s: 'account · signs in', c: 'var(--green)' }
      },
      edges: [['form', 'pending'], ['pending', 'review'], ['review', 'account'], ['review', 'appeal'],
        ['appeal', 'pending'], ['account', 'link'], ['link', 'tform'], ['tform', 'tapprove'], ['tapprove', 'teacher']],
      layouts: {
        wide: { w: 1032, h: 212, nw: 150, nh: 58, pos: {
          form: [16, 20], pending: [184, 20], review: [352, 20], account: [520, 20], link: [688, 20], tform: [856, 20],
          appeal: [268, 134], teacher: [688, 134], tapprove: [856, 134] } },
        narrow: { w: 360, h: 454, nw: 150, nh: 54, force: { 'appeal-pending': 'v' }, pos: {
          form: [16, 16], pending: [194, 16], appeal: [16, 108], review: [194, 108],
          link: [16, 200], account: [194, 200], tform: [16, 292], tapprove: [194, 292], teacher: [194, 384] } }
      },
      scenarios: [
        { id: 'school', label: 'A school admin joins', icon: 'ti-building-community', steps: [
          { at: 'form', note: `On the sign-in page, ${ui('Register here')}: name, email, phone, title, the school, and a password (${FACTS.passwordMin}+ characters, not a common one).` },
          { from: 'form', at: 'pending', note: 'The request waits. The page checks by itself and moves on when head office decides. No account exists yet.' },
          { from: 'pending', at: 'review', note: `Head office sees it on the bell and on ${ui('Approvals')}, then chooses ${ui('Approve')} or ${ui('Reject')} with a reason.` },
          { from: 'review', at: 'account', note: 'Approved: the account is made with the password they chose. They sign in with their email.' }
        ] },
        { id: 'appeal', label: 'Rejected, then an appeal', icon: 'ti-message-report', steps: [
          { at: 'form', note: 'The school admin registers as above.' },
          { from: 'form', at: 'pending', note: 'The request waits for head office.' },
          { from: 'pending', at: 'review', stop: true, note: 'Rejected, with a reason. The waiting page shows it.' },
          { from: 'review', at: 'appeal', note: `${ui('Submit an Appeal')}: the same email, and why it should be approved. One appeal at a time.` },
          { from: 'appeal', at: 'pending', note: `The request goes back to Pending and appears on the ${ui('Appeals')} tab and the bell.` },
          { from: 'pending', at: 'review', note: 'Head office looks again.' },
          { from: 'review', at: 'account', note: 'Approving it creates the account and closes the appeal.' }
        ] },
        { id: 'teachers', label: 'Teachers join through a link', icon: 'ti-link', steps: [
          { at: 'account', note: `The school admin opens ${ui('Teachers')} and presses ${ui('Generate Registration Link')}.` },
          { from: 'account', at: 'link', note: `They choose how many teachers may use it (${FACTS.capMin}–${FACTS.capMax}; the box suggests teachers on file + ${FACTS.capSuggestExtra}). It expires after ${FACTS.linkDays} days either way. ${ui('Copy')} it and share it.` },
          { from: 'link', at: 'tform', note: 'Each teacher opens it. The school comes from the link, never from the teacher.' },
          { from: 'tform', at: 'tapprove', note: `It waits on the school admin's bell and under ${ui('Teachers')} → ${ui('Pending')}.` },
          { from: 'tapprove', at: 'teacher', note: `${ui('Approve')}: the teacher can sign in. ${ui('Reject')}: the account stays closed and the teacher sees the reason.` }
        ] },
        { id: 'refused', label: 'The link says no', icon: 'ti-link-off', steps: [
          { at: 'account', note: 'The school admin shared a link earlier.' },
          { from: 'account', at: 'link', note: 'It has a limit and an expiry date.' },
          { from: 'link', at: 'tform', stop: true, note: `A teacher is refused when the link is full, expired or deactivated. Raise the limit with ${ui('Change limit')} (never below the number already registered), or generate a new link.` }
        ] }
      ]
    },

    fault: {
      id: 'fault',
      tab: 'A fault: classroom to engineer',
      icon: 'ti-route-2',
      title: 'Where a fault goes, and who holds it at each step',
      nodes: {
        teacher:  { t: 'Teacher', s: 'reports the fault', c: 'var(--accent)' },
        school:   { t: 'School admin', s: 'bell · triage', c: 'var(--amber)' },
        oe:       { t: 'Head office (OE)', s: 'bell · Assign', c: 'var(--purple)' },
        engineer: { t: 'Field engineer', s: "school's sub-admin", c: 'var(--teal)' },
        resolved: { t: 'Resolved', s: 'the reporter rates it', c: 'var(--green)' }
      },
      edges: [['teacher', 'school'], ['school', 'resolved'], ['school', 'oe'], ['teacher', 'oe'],
        ['oe', 'engineer'], ['engineer', 'resolved']],
      layouts: {
        wide: { w: 1032, h: 196, nw: 150, nh: 58, pos: {
          teacher: [16, 118], school: [236, 20], oe: [456, 118], engineer: [676, 118], resolved: [866, 20] } },
        narrow: { w: 360, h: 362, nw: 150, nh: 54, pos: {
          teacher: [16, 16], school: [194, 108], oe: [16, 200], engineer: [16, 292], resolved: [194, 292] } }
      },
      scenarios: [
        { id: 'triage', label: 'Fixed at the school', icon: 'ti-tool', steps: [
          { at: 'teacher', note: `A teacher files it on ${ui('Report Error')} (or over WhatsApp, USSD or SMS). It is Open, at school level, and nobody is assigned yet.` },
          { from: 'teacher', at: 'school', note: "It rings the school admin's bell, because they can walk to the room." },
          { from: 'school', at: 'resolved', note: `Fixed on site: the school admin presses ${ui('Mark Resolved')}. The teacher who reported it is asked to rate the fix.` }
        ] },
        { id: 'escalate', label: 'The school escalates', icon: 'ti-arrow-up-right', steps: [
          { at: 'teacher', note: 'A teacher reports the fault.' },
          { from: 'teacher', at: 'school', note: "It rings the school admin's bell. It is more than the school can fix." },
          { from: 'school', at: 'oe', note: `${ui('Escalate to OE')}, with a reason. It becomes Escalated, at platform level, and rings head office's bell.` },
          { from: 'oe', at: 'engineer', note: "The school's own field engineer is assigned automatically and their bell rings. If the school has none, head office's bell says so in red." },
          { from: 'engineer', at: 'resolved', note: 'The engineer fixes it, on a visit if needed, and marks it resolved. The reporter rates it.' }
        ] },
        { id: 'critical', label: 'A critical fault', icon: 'ti-alert-octagon', steps: [
          { at: 'teacher', note: 'Priority critical: the school cannot teach today.' },
          { from: 'teacher', at: 'oe', note: 'It waits for nobody. It is filed at platform level at once.' },
          { from: 'oe', at: 'engineer', note: "It is assigned to the school's field engineer, whose bell rings immediately." },
          { from: 'teacher', at: 'school', note: 'The school admin is still told, and told why.' },
          { from: 'engineer', at: 'resolved', note: 'Fixed and marked resolved, then rated.' }
        ] },
        { id: 'own', label: 'The school admin reports', icon: 'ti-user-shield', steps: [
          { at: 'school', note: "A school admin's own report skips triage, because they are the school level." },
          { from: 'school', at: 'oe', note: 'It is filed at platform level.' },
          { from: 'oe', at: 'engineer', note: "It is assigned to the school's field engineer, whose bell rings." },
          { from: 'engineer', at: 'resolved', note: 'Fixed, resolved, rated.' }
        ] },
        { id: 'assign', label: 'Head office assigns', icon: 'ti-user-share', steps: [
          { at: 'oe', note: 'Head office opens any fault from the tracker or the bell.' },
          { from: 'oe', at: 'engineer', note: `${ui('Assign')}: pick any field engineer and add a note. Only head office has this button. Open becomes In Progress, and the chosen engineer's bell rings.` },
          { from: 'engineer', at: 'resolved', note: 'The engineer fixes it and marks it resolved.' }
        ] }
      ]
    }
  };

  /* ------------------------------------------------------------------ *
   * Step-by-step: what each person presses, in order.
   * ------------------------------------------------------------------ */
  const HOWTO = {
    join: [
      { icon: 'ti-forms', who: 'school', t: 'Register as a school administrator', body: `
        <ol>
          <li>On the sign-in page, press ${ui('Register here')} under "School Administrator?".</li>
          <li>Fill in full name, email, phone, your role or title, and choose your school from the list.</li>
          <li>Choose a password of at least ${FACTS.passwordMin} characters that is not a common or published one.</li>
          <li>Submit. The waiting page checks for a decision by itself.</li>
        </ol>
        <p>If you close the page, sign in with the email and password you registered with. It opens the waiting page again.
        An email that already has an account, or already has a request waiting, is refused.</p>` },
      { icon: 'ti-user-check', who: 'head', t: 'Approve or reject the school admin', body: `
        <ol>
          <li>The bell shows "<i>name</i> wants to register". Open ${ui('Approvals')}.</li>
          <li>Check the name, email and school on the request.</li>
          <li>${ui('Approve')} creates the account with the password they chose, and they can sign in at once with their email. Nobody sends them a password.</li>
          <li>${ui('Reject')} asks for a reason. They see it on their waiting page.</li>
        </ol>
        <p>Every approval is recorded in the audit log (<code>registration.approved</code>).</p>` },
      { icon: 'ti-message-report', who: 'school', t: 'After a rejection: the appeal', body: `
        <ol>
          <li>The waiting page shows the reason and ${ui('Submit an Appeal')}.</li>
          <li>Give your full name, the <b>same email</b> you registered with, and why it should be approved, then ${ui('Send Appeal')}.</li>
          <li>The request returns to head office's Pending list, and the appeal appears on the ${ui('Appeals')} tab and the bell.</li>
        </ol>
        <p>One appeal can wait at a time. Approving the request closes the appeal.</p>` },
      { icon: 'ti-link', who: 'school', t: "Create your teachers' registration link", body: `
        <ol>
          <li>Open ${ui('Teachers')} and press ${ui('Generate Registration Link')}.</li>
          <li>Enter how many teachers may register with it: ${FACTS.capMin} to ${FACTS.capMax}. The box suggests the number of teachers on file plus ${FACTS.capSuggestExtra}.</li>
          <li>Press ${ui('Generate Link')}, then ${ui('Copy')}, and share it, for example in the staff WhatsApp group.</li>
        </ol>
        <p>The link closes when the limit is reached, and after <b>${FACTS.linkDays} days</b> either way. It is tied to your school: a teacher cannot choose another one.
        Every teacher who uses it still needs your approval.</p>` },
      { icon: 'ti-adjustments', who: 'school', t: 'Manage links: limit, expiry, switch off', body: `
        <ol>
          <li>${ui('Teachers')} → ${ui('Reg. Links')} lists each link: how many have used it out of its limit, and when it expires.</li>
          <li>${ui('Change limit')} raises or lowers the cap (${FACTS.capMin}–${FACTS.capMax}). It can never go below the number already registered.</li>
          <li>${ui('Deactivate')} stops a link at once, for example one shared by mistake.</li>
        </ol>
        <p>A full link keeps both buttons, because a full link is exactly when the cap needs raising.</p>` },
      { icon: 'ti-school', who: 'teacher', t: 'Register from the link', body: `
        <ol>
          <li>Open the link. The form shows your school's name.</li>
          <li>Fill in name, email, phone, subject, employee ID if you have one, and a password.</li>
          <li>Submit. You see "pending approval from your School Administrator".</li>
        </ol>
        <p>Signing in before you are approved shows that page again. If you were rejected, it shows the reason.</p>` },
      { icon: 'ti-user-check', who: 'school', t: 'Approve the teacher', body: `
        <ol>
          <li>The bell shows "<i>name</i> wants to join". Open ${ui('Teachers')} → ${ui('Pending')}.</li>
          <li>${ui('Approve')}: the teacher can sign in with their email and password.</li>
          <li>${ui('Reject')} with a reason: the account stays closed. They may register again through a link.</li>
        </ol>` },
      { icon: 'ti-user-plus', who: 'school', t: 'Adding a teacher without a link', body: `
        <ol>
          <li>${ui('Teachers')} → ${ui('Add Teacher')}. The teacher is approved at once.</li>
          <li>Leave the password blank and the system makes a temporary one. It is shown <b>once</b>, so give it to the teacher.</li>
          <li>They must choose their own password the first time they sign in.</li>
        </ol>` }
    ],
    fault: [
      { icon: 'ti-bug', who: 'teacher', t: 'Report the fault', body: `
        <ol>
          <li>${ui('Report Error')}: a short title, the category (${FACTS.categories.join(', ')}), the sub-category, the priority, and what happened.</li>
          <li>Guides that match appear above the description. If one fixes it, press "This fixed it" and nothing is filed.</li>
          <li>Add up to ${FACTS.photos} photos. With no internet, the report waits on the device and sends itself when the connection returns.</li>
        </ol>
        <p>Teachers see their own reports in ${ui('Error Tracker')}. A teacher reports and rates, and cannot close a fault. Faults also arrive over WhatsApp, USSD and SMS, and follow the same route.</p>` },
      { icon: 'ti-bell-ringing', who: 'school', t: "Triage: the school admin's bell", body: `
        <ol>
          <li>A teacher's fault rings your bell. Press it to open the fault.</li>
          <li>If you can fix it on site, fix it and press ${ui('Mark Resolved')}.</li>
          <li>If you cannot, press ${ui('Escalate to OE')}, as in the next step.</li>
        </ol>
        <p>Until you act, the fault is at school level and assigned to nobody. That is deliberate: an assignee makes a fault look handled.</p>` },
      { icon: 'ti-arrow-up-right', who: 'school', t: 'Escalate to OE', body: `
        <ol>
          <li>In the fault, press ${ui('Escalate to OE')}.</li>
          <li>Choose a reason: ${FACTS.reasons.map(r => `"${r}"`).join(', ')}. Add a note if it helps.</li>
          <li>The fault becomes <b>Escalated</b> at platform level, and it is assigned to your school's field engineer.</li>
          <li>Head office's bell and the engineer's bell ring. Email and SMS go too, where they are set up.</li>
        </ol>
        <p>Each fault is escalated once. The reason goes into its update trail and the audit log.</p>` },
      { icon: 'ti-alert-octagon', who: 'teacher', t: 'Critical faults skip the queue', body: `
        <p>A fault marked <b>critical</b> goes straight to the field engineer at platform level, and their bell rings.
        The school admin is still told, and the notice says it is critical. A school admin's own report also goes
        straight to the engineer, because there is nobody below them to triage it.</p>` },
      { icon: 'ti-user-share', who: 'head', t: 'Head office: assign or reassign', body: `
        <ol>
          <li>Escalations ring your bell. A <b style="color:var(--red)">red</b> one means the school has no field engineer, so nobody holds the fault.</li>
          <li>Open the fault and press ${ui('Assign')}. Choose a field engineer, add a note, and press ${ui('Assign')} again.</li>
          <li>An Open fault becomes In Progress, the engineer's bell rings, and the trail records who assigned whom.</li>
        </ol>
        <p>Only head office has ${ui('Assign')}, and it works on any fault, including one already held by someone else.</p>` },
      { icon: 'ti-map-pin-cog', who: 'head', t: "Set each school's field engineer", body: `
        <ol>
          <li>Engineers are created on ${ui('Sub-Admins')} → ${ui('Add Sub-Admin')}.</li>
          <li>${ui('School Profiles')} → the school → ${ui('Edit')} → ${ui('Assigned Sub-Admin (Field Engineer)')}.</li>
        </ol>
        <p>This is who an escalation goes to automatically. A school without one lands on head office's bell in red.</p>` },
      { icon: 'ti-route', who: 'engineer', t: 'The field engineer', body: `
        <ol>
          <li>Your bell shows "assigned to you" or "escalated to you". Press it to open the fault.</li>
          <li>${ui('Visit Planner')} groups your open faults by school and builds the visit sheet: what to carry, the faults, and the checks that are due.</li>
          <li>When it works again, mark it resolved.</li>
        </ol>` },
      { icon: 'ti-star', who: 'anyone', t: 'Resolution, rating and time limits', body: `
        <p>A school admin, the field engineer or head office can mark a fault resolved. A teacher cannot.
        Then the teacher who reported it, or their school admin, rates the fix from 1 to ${FACTS.ratingMax}. Nobody else is offered the rating.</p>
        <p>Every fault has a response target from its priority: ${slaText()}. ${ui('Follow-Up Center')} lists the ones past it.</p>` }
    ]
  };

  let tab = null;
  let scenarioId = {};
  let layout = null;
  let tl = null;
  let gsapPromise = null;
  let resizeTimer = null;

  const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const guide = () => GUIDES[tab];
  const scenario = () => guide().scenarios.find(s => s.id === scenarioId[tab]) || guide().scenarios[0];

  function load() {
    if (!tab) {
      const u = API.getUser();
      tab = u && u.role === 'subadmin' ? 'fault' : 'join';
    }
    return Promise.resolve();
  }

  function loadGsap() {
    if (typeof gsap !== 'undefined') return Promise.resolve(true);
    if (gsapPromise) return gsapPromise;
    const own = document.querySelector('script[src*="pages/workflows.js"]');
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

  /* ---------------------------- drawing ---------------------------- */

  /** A curve between two nodes, leaving the side that faces the other, in either direction. */
  function edgePath(L, a, b) {
    const [ax, ay] = L.pos[a], [bx, by] = L.pos[b], w = L.nw, h = L.nh;
    const acx = ax + w / 2, acy = ay + h / 2, bcx = bx + w / 2, bcy = by + h / 2;
    const forced = L.force && L.force[a + '-' + b];
    const horizontal = forced ? forced === 'h' : Math.abs(bcx - acx) >= Math.abs(bcy - acy);
    if (horizontal) {
      const right = bcx >= acx;
      const x1 = right ? ax + w : ax, x2 = right ? bx : bx + w, m = (x1 + x2) / 2;
      return `M${x1},${acy} C${m},${acy} ${m},${bcy} ${x2},${bcy}`;
    }
    const down = bcy >= acy;
    const y1 = down ? ay + h : ay, y2 = down ? by : by + h, m = (y1 + y2) / 2;
    return `M${acx},${y1} C${acx},${m} ${bcx},${m} ${bcx},${y2}`;
  }

  function svg(g, L) {
    const edges = g.edges.map(([a, b]) => `<path class="flow-edge" data-edge="${a}-${b}" d="${edgePath(L, a, b)}"/>`).join('');
    const nodes = Object.keys(g.nodes).map(k => {
      const n = g.nodes[k], [x, y] = L.pos[k], w = L.nw, h = L.nh;
      return `<g class="flow-node" data-node="${k}">
        <rect class="flow-box" x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/>
        <rect x="${x}" y="${y + 10}" width="3" height="${h - 20}" rx="1.5" fill="${n.c}"/>
        <text class="flow-t" x="${x + 16}" y="${y + h / 2 - 3}">${esc(n.t)}</text>
        <text class="flow-s" x="${x + 16}" y="${y + h / 2 + 14}">${esc(n.s)}</text>
        <g class="flow-mark flow-ok" transform="translate(${x + w - 6},${y + 6})"><circle r="9"/><path d="M-4,0 L-1,3 L4,-3"/></g>
        <g class="flow-mark flow-no" transform="translate(${x + w - 6},${y + 6})"><circle r="9"/><path d="M-3.5,-3.5 L3.5,3.5 M3.5,-3.5 L-3.5,3.5"/></g>
      </g>`;
    }).join('');
    return `<svg class="flow-svg flow-${L === g.layouts.wide ? 'wide' : 'narrow'}" viewBox="0 0 ${L.w} ${L.h}"
      role="img" aria-label="${esc(g.title)}. The numbered steps below describe the same path in words.">
      <g>${edges}</g><g>${nodes}</g><g class="flow-packets"></g></svg>`;
  }

  function stepsHtml(sc, g) {
    return sc.steps.map((s, i) => `<li class="flow-step" data-step="${i}">
      <span class="flow-step-ic ${s.stop ? 'no' : 'ok'}"><i class="ti ${s.stop ? 'ti-x' : (s.from ? 'ti-check' : 'ti-point-filled')}"></i></span>
      <span><strong>${esc(g.nodes[s.at].t)}</strong> — ${s.note}</span>
    </li>`).join('');
  }

  function chipsHtml(g) {
    const cur = scenario().id;
    return g.scenarios.map(s => `<button class="chip flow-chip ${s.id === cur ? 'chip-active' : ''}" aria-pressed="${s.id === cur}"
      onclick="WorkflowsPage.setScenario('${s.id}')"><i class="ti ${s.icon}"></i>${esc(s.label)}</button>`).join('');
  }

  const q = (sel) => document.querySelector('#wf-stage ' + sel);
  const nodeEl = (k) => q(`[data-node="${k}"]`);
  const edgeEl = (a, b) => q(`[data-edge="${a}-${b}"]`);
  function mark(k, stop) {
    const n = nodeEl(k);
    if (!n) return;
    n.classList.remove('is-pass', 'is-stop');
    n.classList.add(stop ? 'is-stop' : 'is-pass');
  }
  const light = (i) => { const li = document.querySelector(`#wf-steps [data-step="${i}"]`); if (li) li.classList.add('on'); };

  function reset() {
    if (tl) { tl.kill(); tl = null; }
    document.querySelectorAll('#wf-stage .flow-node').forEach(n => n.classList.remove('is-pass', 'is-stop'));
    document.querySelectorAll('#wf-stage .flow-edge').forEach(e => e.classList.remove('lit', 'lit-stop'));
    const p = q('.flow-packets');
    if (p) p.innerHTML = '';
    document.querySelectorAll('#wf-steps .flow-step').forEach(s => s.classList.remove('on'));
  }

  /** The whole path at once: without motion, without GSAP, and after a resize. */
  function showEnd(sc) {
    reset();
    sc.steps.forEach((s, i) => {
      if (s.from) { const e = edgeEl(s.from, s.at); if (e) e.classList.add(s.stop ? 'lit-stop' : 'lit'); }
      mark(s.at, !!s.stop);
      light(i);
    });
  }

  function play(sc) {
    reset();
    const layer = q('.flow-packets');
    if (!layer) return;
    const t = gsap.timeline();
    let dot = null, at = null;
    const newDot = () => {
      const d = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      d.setAttribute('r', '6'); d.setAttribute('class', 'flow-dot'); d.style.opacity = '0';
      layer.appendChild(d);
      return d;
    };
    sc.steps.forEach((s, i) => {
      if (!s.from || s.from !== at) {
        // A new packet: the story starts (again) at this node.
        if (dot) { const old = dot; t.to(old, { opacity: 0, duration: 0.25 }); }
        dot = newDot();
        if (!s.from) {
          t.call(() => { mark(s.at, !!s.stop); light(i); });
          t.to({}, { duration: 0.45 });
          at = s.at;
          return;
        }
      }
      const path = edgeEl(s.from, s.at);
      if (!path) { mark(s.at, !!s.stop); light(i); at = s.at; return; }
      const len = path.getTotalLength(), prog = { t: 0 }, d = dot;
      t.to(prog, {
        t: 1, duration: 0.8, ease: 'power1.inOut',
        onStart: () => { d.style.opacity = '1'; path.classList.add(s.stop ? 'lit-stop' : 'lit'); },
        onUpdate: () => { const pt = path.getPointAtLength(prog.t * len); d.setAttribute('cx', pt.x); d.setAttribute('cy', pt.y); }
      });
      t.call(() => { mark(s.at, !!s.stop); light(i); });
      if (s.stop) {
        t.call(() => d.classList.add('stop'));
        t.to(d, { attr: { r: 11 }, opacity: 0, duration: 0.5, ease: 'power2.out' });
        dot = null;
      }
      t.to({}, { duration: 0.35 });
      at = s.at;
    });
    if (dot) t.to(dot, { opacity: 0, duration: 0.35 });
    t.call(() => document.querySelectorAll('#wf-steps .flow-step').forEach(s => s.classList.add('on')));
    tl = t;
  }

  async function run() {
    const sc = scenario(), g = guide();
    if (reducedMotion()) return showEnd(sc);
    const ok = await loadGsap();
    if (guide() !== g || scenario() !== sc || !document.getElementById('wf-stage')) return;
    ok ? play(sc) : showEnd(sc);
  }

  function pickLayout() {
    const stage = document.getElementById('wf-stage');
    return stage && stage.clientWidth < 720 ? guide().layouts.narrow : guide().layouts.wide;
  }

  function mount() {
    const stage = document.getElementById('wf-stage');
    if (!stage) return;
    layout = pickLayout();
    stage.innerHTML = svg(guide(), layout);
    run();
  }

  /* ---------------------------- the page ---------------------------- */

  function tabsHtml() {
    return Object.values(GUIDES).map(g => `<button class="tab-btn ${g.id === tab ? 'active' : ''}" aria-pressed="${g.id === tab}"
      onclick="WorkflowsPage.setTab('${g.id}')"><i class="ti ${g.icon}" style="margin-right:6px"></i>${esc(g.tab)}</button>`).join('');
  }

  function factsHtml() {
    const row = (icon, color, label, value) => `<tr>
      <td class="wf-fact-l"><span><i class="ti ${icon}" style="color:${color}"></i>${label}</span></td>
      <td class="wf-fact-v">${value}</td></tr>`;
    const sep = '<tr><td colspan="2" class="wf-fact-sep"></td></tr>';
    const rows = tab === 'join' ? [
      row('ti-link', 'var(--teal)', 'Registration link lasts', `${FACTS.linkDays} days`),
      row('ti-users', 'var(--accent)', 'Teachers per link', `${FACTS.capMin}–${FACTS.capMax}, chosen by the school admin (suggested: on file + ${FACTS.capSuggestExtra})`),
      row('ti-lock', 'var(--red)', 'Password', `${FACTS.passwordMin}+ characters, not a common or published one`),
      row('ti-user-check', 'var(--purple)', 'Approves a school admin', 'Head office (platform admin) only'),
      row('ti-user-check', 'var(--amber)', 'Approves a teacher', "That school's administrator only")
    ] : [
      row('ti-clock', 'var(--amber)', 'Response targets', slaText()),
      row('ti-photo', 'var(--accent)', 'Photos per report', `up to ${FACTS.photos}`),
      row('ti-arrow-up-right', 'var(--purple)', 'Who can escalate', 'The school admin, once per fault'),
      row('ti-user-share', 'var(--teal)', 'Who can Assign', 'Head office (platform admin) only'),
      row('ti-star', 'var(--green)', 'Who rates the fix', `The reporting teacher or their school admin, 1–${FACTS.ratingMax}`)
    ];
    return `<table class="wf-facts">${rows.join(sep)}</table>`;
  }

  function howtoHtml() {
    return HOWTO[tab].map((h, i) => `<details class="sec-guide-item wf-howto"${i === 0 ? ' open' : ''}>
      <summary><i class="ti ${h.icon}" style="color:${WHO[h.who].c}"></i><span><span class="wf-num">${i + 1}</span>${esc(h.t)}</span>${who(h.who)}<i class="ti ti-chevron-down sec-guide-chev"></i></summary>
      <div class="wf-howto-body">${h.body}</div>
    </details>`).join('');
  }

  function content() {
    const g = guide();
    return `
      <div class="card flow-card wf-card">
        <div class="card-title">
          <span><i class="ti ${g.icon}" style="margin-right:6px"></i>${esc(g.title)}</span>
          <button class="sec-btn sec-btn-teal flow-replay" onclick="WorkflowsPage.replay()"><i class="ti ti-player-play"></i>Replay</button>
        </div>
        <div class="flow-chips" id="wf-chips">${chipsHtml(g)}</div>
        <div class="flow-stage" id="wf-stage"></div>
        <ol class="flow-steps" id="wf-steps">${stepsHtml(scenario(), g)}</ol>
      </div>
      <div class="wf-grid">
        <div class="card wf-card">
          <div class="card-title"><span><i class="ti ti-list-numbers" style="margin-right:6px"></i>Step by step</span></div>
          <div class="wf-howto-list">${howtoHtml()}</div>
        </div>
        <div class="card wf-card">
          <div class="card-title"><span><i class="ti ti-info-circle" style="margin-right:6px"></i>Worth knowing</span></div>
          ${factsHtml()}
        </div>
      </div>`;
  }

  function render() {
    return `
      <div class="section-header">
        <div>
          <div class="section-title">How It Works</div>
          <div class="section-sub">Joining the system, and where a fault goes · for school admins, field engineers and head office</div>
        </div>
      </div>
      <div class="tab-row wf-tabs" id="wf-tabs">${tabsHtml()}</div>
      <div id="wf-content">${content()}</div>`;
  }

  function reveal() {
    const el = document.getElementById('wf-content');
    if (el) el.querySelectorAll('.card').forEach(c => c.classList.add('reveal', 'visible'));
  }

  function afterRender() { reveal(); mount(); }

  /** In-place swap: the page does not re-render. */
  function setTab(id) {
    if (!GUIDES[id]) return;
    tab = id;
    const tabs = document.getElementById('wf-tabs'), body = document.getElementById('wf-content');
    if (!tabs || !body) return App.render();
    tabs.innerHTML = tabsHtml();
    body.innerHTML = content();
    reveal();
    mount();
  }

  function setScenario(id) {
    if (!guide().scenarios.some(s => s.id === id)) return;
    scenarioId[tab] = id;
    const chips = document.getElementById('wf-chips'), steps = document.getElementById('wf-steps');
    if (!chips || !steps) return;
    chips.innerHTML = chipsHtml(guide());
    steps.innerHTML = stepsHtml(scenario(), guide());
    run();
  }

  function replay() { run(); }

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const stage = document.getElementById('wf-stage');
      if (!stage || !tab || pickLayout() === layout) return;
      layout = pickLayout();
      stage.innerHTML = svg(guide(), layout);
      showEnd(scenario());
    }, 200);
  });

  return { load, render, afterRender, setTab, setScenario, replay, _defs: { GUIDES, HOWTO, FACTS } };
})();
