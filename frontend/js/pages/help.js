/**
 * Help / User Guide — School Admin Documentation
 * Professional interactive documentation with visual feature cards
 */
const HelpPage = (() => {
  let activeSection = 'overview';

  function load() { return Promise.resolve(); }

  const sections = [
    { id: 'overview', icon: 'ti-home', title: 'Getting Started', color: '#4f7cff' },
    { id: 'dashboard', icon: 'ti-layout-dashboard', title: 'Dashboard', color: '#4f7cff' },
    { id: 'report', icon: 'ti-bug', title: 'Report Error', color: '#ff5263' },
    { id: 'tracker', icon: 'ti-list-check', title: 'Error Tracker', color: '#f5a623' },
    { id: 'followup', icon: 'ti-headset', title: 'Follow-Up Center', color: '#9b7dff' },
    { id: 'weekly', icon: 'ti-calendar-week', title: 'Weekly Check-Ins', color: '#36d9cc' },
    { id: 'schools', icon: 'ti-school', title: 'School Profiles', color: '#2dd98a' },
    { id: 'troubleshoot', icon: 'ti-tools', title: 'Troubleshooting', color: '#f5a623' },
    { id: 'manuals', icon: 'ti-books', title: 'Resource Library', color: '#9b7dff' },
    { id: 'account', icon: 'ti-user-circle', title: 'My Account', color: '#36d9cc' },
    { id: 'faq', icon: 'ti-help-circle', title: 'FAQ', color: '#FFAE00' },
  ];

  function setSection(id) { activeSection = id; App.render(); }

  function render() {
    const nav = sections.map(s => {
      const active = activeSection === s.id;
      return `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:${active ? '600' : '400'};transition:all .15s;background:${active ? s.color + '15' : 'transparent'};color:${active ? s.color : 'var(--text2)'};border-left:3px solid ${active ? s.color : 'transparent'}" onclick="HelpPage.setSection('${s.id}')">
        <i class="ti ${s.icon}" style="font-size:15px"></i>${s.title}
      </div>`;
    }).join('');

    return `
    <div class="section-header">
      <div>
        <div class="section-title">User Guide</div>
        <div class="section-sub">School Admin &mdash; System Documentation</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="HelpPage.setSection('faq')"><i class="ti ti-help-circle"></i> FAQ</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:200px 1fr;gap:16px;align-items:start">
      <div class="card reveal" style="position:sticky;top:76px;padding:10px 8px">
        ${nav}
      </div>
      <div>
        ${getContent(activeSection)}
      </div>
    </div>`;
  }

  function getContent(id) {
    const c = content[id];
    return c ? c() : '<div class="empty"><i class="ti ti-file-search"></i>Section not found</div>';
  }

  function featureCard(icon, color, title, desc) {
    return `<div class="card reveal" style="padding:16px;display:flex;align-items:flex-start;gap:14px">
      <div style="width:38px;height:38px;background:${color}25;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <i class="ti ${icon}" style="color:${color};font-size:18px"></i>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px">${title}</div>
        <div style="font-size:12px;color:var(--text3);line-height:1.5">${desc}</div>
      </div>
    </div>`;
  }

  function stepCard(num, title, desc) {
    return `<div style="display:flex;align-items:flex-start;gap:12px;padding:12px 0;${num > 1 ? 'border-top:1px solid var(--border)' : ''}">
      <div style="width:26px;height:26px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${num}</div>
      <div><div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:2px">${title}</div><div style="font-size:12px;color:var(--text3);line-height:1.5">${desc}</div></div>
    </div>`;
  }

  function infoBox(text, type) {
    const cfg = type === 'warn'
      ? { bg: 'rgba(255,82,99,0.06)', border: 'rgba(255,82,99,0.2)', icon: 'ti-alert-triangle', color: 'var(--red)' }
      : { bg: 'rgba(79,124,255,0.06)', border: 'rgba(79,124,255,0.2)', icon: 'ti-info-circle', color: 'var(--accent)' };
    return `<div style="background:${cfg.bg};border:1px solid ${cfg.border};border-radius:8px;padding:12px 14px;margin:12px 0;font-size:12px;line-height:1.6;display:flex;align-items:flex-start;gap:10px;color:var(--text2)">
      <i class="ti ${cfg.icon}" style="color:${cfg.color};font-size:16px;flex-shrink:0;margin-top:1px"></i><div>${text}</div></div>`;
  }

  function sectionTitle(text, sub) {
    return `<div style="margin-bottom:16px"><div style="font-size:16px;font-weight:600;color:var(--text)">${text}</div>${sub ? `<div style="font-size:12px;color:var(--text3);margin-top:3px">${sub}</div>` : ''}</div>`;
  }

  function subTitle(text) { return `<div style="font-size:13px;font-weight:600;color:var(--text);margin:16px 0 8px">${text}</div>`; }

  const content = {
    overview: () => `
      ${sectionTitle('Welcome to QFT Technical Support', 'Your complete guide to using the system effectively')}
      <div class="card reveal" style="padding:20px;margin-bottom:16px;border-left:3px solid var(--accent)">
        <div style="font-size:13px;color:var(--text2);line-height:1.7">
          This system helps you <strong style="color:var(--text)">report</strong>, <strong style="color:var(--text)">track</strong>, and <strong style="color:var(--text)">resolve</strong> technical issues at your school.
          Below are all the features available to you as a School Admin.
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-bottom:20px">
        ${featureCard('ti-layout-dashboard', '#4f7cff', 'Dashboard', 'Real-time overview of your school\'s technical health and open issues')}
        ${featureCard('ti-bug', '#ff5263', 'Report Error', 'Submit new technical issues for the support team to resolve')}
        ${featureCard('ti-list-check', '#f5a623', 'Error Tracker', 'Monitor all reported issues, their status, and resolution progress')}
        ${featureCard('ti-headset', '#9b7dff', 'Follow-Up Center', 'Track SLA compliance, escalations, and team communication')}
        ${featureCard('ti-calendar-week', '#36d9cc', 'Weekly Check-Ins', 'Submit weekly device and connectivity status reports')}
        ${featureCard('ti-school', '#2dd98a', 'School Profiles', 'View your school details, equipment inventory, and history')}
        ${featureCard('ti-tools', '#f5a623', 'Troubleshooting', 'Step-by-step guides to fix common issues without waiting for support')}
        ${featureCard('ti-books', '#9b7dff', 'Resource Library', 'Download manuals, training materials, and reference documents')}
      </div>

      <div class="card reveal" style="padding:18px">
        ${subTitle('Quick Start Guide')}
        ${stepCard(1, 'Check your Dashboard', 'After logging in, review open issues and school health status')}
        ${stepCard(2, 'Try Troubleshooting first', 'For common issues (no internet, tablet not charging), follow the step-by-step guides')}
        ${stepCard(3, 'Report if unresolved', 'If troubleshooting didn\'t help, submit a detailed error report')}
        ${stepCard(4, 'Track progress', 'Monitor your report in the Error Tracker until it\'s resolved')}
        ${stepCard(5, 'Complete Weekly Check-Ins', 'Every week, submit your school\'s device and connectivity status')}
      </div>

      ${infoBox('The sidebar on the left is your main navigation. On mobile, tap the <strong>&#9776;</strong> menu icon to open it.')}
    `,

    dashboard: () => `
      ${sectionTitle('Dashboard', 'Your school\'s technical health at a glance')}
      <div class="card reveal" style="padding:18px;margin-bottom:14px">
        <div style="font-size:12px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;font-weight:600;margin-bottom:12px">Stat Cards Explained</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div style="background:var(--bg3);border-radius:8px;padding:12px;border-left:3px solid var(--red)">
            <div style="font-size:12px;font-weight:600;color:var(--text)">Open Errors</div>
            <div style="font-size:11px;color:var(--text3);margin-top:3px">Total unresolved issues. Red number = critical priority</div>
          </div>
          <div style="background:var(--bg3);border-radius:8px;padding:12px;border-left:3px solid var(--amber)">
            <div style="font-size:12px;font-weight:600;color:var(--text)">In Progress</div>
            <div style="font-size:11px;color:var(--text3);margin-top:3px">Issues currently being worked on by the support team</div>
          </div>
          <div style="background:var(--bg3);border-radius:8px;padding:12px;border-left:3px solid var(--green)">
            <div style="font-size:12px;font-weight:600;color:var(--text)">Resolved (24h)</div>
            <div style="font-size:11px;color:var(--text3);margin-top:3px">Issues fixed in the last 24 hours</div>
          </div>
          <div style="background:var(--bg3);border-radius:8px;padding:12px;border-left:3px solid var(--teal)">
            <div style="font-size:12px;font-weight:600;color:var(--text)">School Health</div>
            <div style="font-size:11px;color:var(--text3);margin-top:3px">Whether your school has zero critical/high issues</div>
          </div>
        </div>
      </div>

      <div class="card reveal" style="padding:18px;margin-bottom:14px">
        ${subTitle('Alert Banner')}
        <div style="font-size:12px;color:var(--text2);line-height:1.6">If there are <strong style="color:var(--red)">critical errors</strong>, a red banner appears at the top of the dashboard. Click <strong>View</strong> to see them immediately.</div>
      </div>

      <div class="card reveal" style="padding:18px">
        ${subTitle('Priority Table & Categories')}
        <div style="font-size:12px;color:var(--text2);line-height:1.6">The table shows active issues sorted by urgency. Click any row to see full details. The category breakdown on the right helps you spot patterns (e.g., rising connectivity issues may mean network equipment needs checking).</div>
      </div>

      ${infoBox('The dashboard refreshes automatically each time you navigate to it. For the latest data, simply click <strong>Dashboard</strong> in the sidebar.')}
    `,

    report: () => `
      ${sectionTitle('Report Error', 'Submit a new technical issue for resolution')}

      <div class="card reveal" style="padding:18px;margin-bottom:14px">
        ${subTitle('Required Information')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
          <div style="background:var(--bg3);border-radius:6px;padding:10px 12px;font-size:12px"><i class="ti ti-school" style="color:var(--accent);margin-right:6px"></i><strong>School</strong> — Auto-filled for you</div>
          <div style="background:var(--bg3);border-radius:6px;padding:10px 12px;font-size:12px"><i class="ti ti-category" style="color:var(--accent);margin-right:6px"></i><strong>Category</strong> — Type of issue</div>
          <div style="background:var(--bg3);border-radius:6px;padding:10px 12px;font-size:12px"><i class="ti ti-flag" style="color:var(--accent);margin-right:6px"></i><strong>Priority</strong> — How urgent</div>
          <div style="background:var(--bg3);border-radius:6px;padding:10px 12px;font-size:12px"><i class="ti ti-pencil" style="color:var(--accent);margin-right:6px"></i><strong>Title + Description</strong></div>
        </div>
      </div>

      <div class="card reveal" style="padding:18px;margin-bottom:14px">
        ${subTitle('Priority Levels & Response Times (SLA)')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
          <div style="background:rgba(255,82,99,0.08);border-radius:8px;padding:12px;border-left:3px solid var(--red)">
            <div style="font-size:12px;font-weight:600;color:var(--red)">Critical</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">School cannot operate</div>
            <div style="font-size:13px;font-weight:700;color:var(--text);margin-top:4px">&le; 2 hours</div>
          </div>
          <div style="background:rgba(245,166,35,0.08);border-radius:8px;padding:12px;border-left:3px solid var(--amber)">
            <div style="font-size:12px;font-weight:600;color:var(--amber)">High</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">Major disruption</div>
            <div style="font-size:13px;font-weight:700;color:var(--text);margin-top:4px">&le; 8 hours</div>
          </div>
          <div style="background:rgba(79,124,255,0.08);border-radius:8px;padding:12px;border-left:3px solid var(--accent)">
            <div style="font-size:12px;font-weight:600;color:var(--accent)">Medium</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">Partial disruption</div>
            <div style="font-size:13px;font-weight:700;color:var(--text);margin-top:4px">&le; 24 hours</div>
          </div>
          <div style="background:rgba(45,217,138,0.08);border-radius:8px;padding:12px;border-left:3px solid var(--green)">
            <div style="font-size:12px;font-weight:600;color:var(--green)">Low</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">Minor issue</div>
            <div style="font-size:13px;font-weight:700;color:var(--text);margin-top:4px">&le; 72 hours</div>
          </div>
        </div>
      </div>

      ${infoBox('Only use <strong>Critical</strong> when the entire school or a whole class cannot work. Overusing critical priority may delay response to genuinely urgent issues.', 'warn')}

      <div class="card reveal" style="padding:18px;margin-bottom:14px">
        ${subTitle('How to Submit a Report')}
        ${stepCard(1, 'Go to Report Error', 'Click "Report Error" in the sidebar')}
        ${stepCard(2, 'Fill required fields', 'Category, Priority, Title, and a detailed Description')}
        ${stepCard(3, 'Add context', 'Include: when it started, error messages, what you tried already')}
        ${stepCard(4, 'Submit', 'Click "Submit Report" — you\'ll get a tracking code (e.g., QFT-0042)')}
      </div>

      <div class="card reveal" style="padding:16px;background:var(--bg3);border-left:3px solid var(--accent)">
        <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:6px"><i class="ti ti-phone" style="margin-right:6px;color:var(--accent)"></i>Support Hotline</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          Phone: <strong>+255 658 066 983</strong><br>
          Email: support@opportunityeducation.or.tz<br>
          Hours: Mon&ndash;Fri, 7:30 AM &ndash; 5:00 PM
        </div>
      </div>
    `,

    tracker: () => `
      ${sectionTitle('Error Tracker', 'Monitor all reported issues and their resolution')}

      <div class="card reveal" style="padding:18px;margin-bottom:14px">
        ${subTitle('Status Filters')}
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
          <span style="padding:5px 12px;border-radius:20px;font-size:11px;font-weight:500;background:rgba(79,124,255,0.12);color:var(--accent)">All</span>
          <span style="padding:5px 12px;border-radius:20px;font-size:11px;font-weight:500;background:rgba(255,82,99,0.12);color:var(--red)">Open</span>
          <span style="padding:5px 12px;border-radius:20px;font-size:11px;font-weight:500;background:rgba(245,166,35,0.12);color:var(--amber)">In Progress</span>
          <span style="padding:5px 12px;border-radius:20px;font-size:11px;font-weight:500;background:rgba(155,125,255,0.12);color:var(--purple)">Escalated</span>
          <span style="padding:5px 12px;border-radius:20px;font-size:11px;font-weight:500;background:rgba(45,217,138,0.12);color:var(--green)">Resolved</span>
        </div>
        <div style="font-size:12px;color:var(--text3);margin-top:10px;line-height:1.5">Click any filter chip to narrow the list. Use the search box to find issues by title, code, or school name.</div>
      </div>

      <div class="card reveal" style="padding:18px;margin-bottom:14px">
        ${subTitle('What You Can Do')}
        <div style="font-size:12px;color:var(--text2);line-height:1.7">
          <div style="margin-bottom:6px"><i class="ti ti-eye" style="color:var(--accent);margin-right:6px"></i><strong>Click any row</strong> to see full error details, description, and updates</div>
          <div style="margin-bottom:6px"><i class="ti ti-check" style="color:var(--green);margin-right:6px"></i><strong>Mark as resolved</strong> directly from the detail view when the issue is fixed</div>
          <div style="margin-bottom:6px"><i class="ti ti-download" style="color:var(--text2);margin-right:6px"></i><strong>Export CSV</strong> to download the error list for school management reports</div>
        </div>
      </div>

      ${infoBox('Each error has a unique code (e.g., QFT-0042). Use this code when communicating with the support team about a specific issue.')}
    `,

    followup: () => `
      ${sectionTitle('Follow-Up Center', 'Track SLA compliance, escalations, and team communication')}

      <div class="card reveal" style="padding:18px;margin-bottom:14px">
        ${subTitle('Three Panels')}
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:8px">
          <div style="background:rgba(255,82,99,0.06);border-radius:8px;padding:12px;text-align:center">
            <i class="ti ti-clock-exclamation" style="font-size:22px;color:var(--red);display:block;margin-bottom:6px"></i>
            <div style="font-size:11px;font-weight:600;color:var(--text)">SLA Breaches</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">Overdue issues needing attention</div>
          </div>
          <div style="background:rgba(79,124,255,0.06);border-radius:8px;padding:12px;text-align:center">
            <i class="ti ti-users" style="font-size:22px;color:var(--accent);display:block;margin-bottom:6px"></i>
            <div style="font-size:11px;font-weight:600;color:var(--text)">Team Status</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">Engineers and their workload</div>
          </div>
          <div style="background:rgba(155,125,255,0.06);border-radius:8px;padding:12px;text-align:center">
            <i class="ti ti-messages" style="font-size:22px;color:var(--purple);display:block;margin-bottom:6px"></i>
            <div style="font-size:11px;font-weight:600;color:var(--text)">Comms Log</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">All notes and updates</div>
          </div>
        </div>
      </div>

      <div class="card reveal" style="padding:18px;margin-bottom:14px">
        ${subTitle('Actions You Can Take')}
        <div style="font-size:12px;color:var(--text2);line-height:1.7">
          <div style="margin-bottom:6px"><i class="ti ti-eye" style="color:var(--accent);margin-right:6px"></i><strong>View</strong> — See full details of any active issue</div>
          <div style="margin-bottom:6px"><i class="ti ti-arrow-up" style="color:var(--red);margin-right:6px"></i><strong>Escalate</strong> — Raise to senior support if SLA is breaching</div>
          <div style="margin-bottom:6px"><i class="ti ti-check" style="color:var(--green);margin-right:6px"></i><strong>Resolve</strong> — Mark as fixed if the problem is solved</div>
        </div>
      </div>

      ${infoBox('If an issue has been "Open" for more than 4 hours without any update, <strong>Escalate</strong> it or call the support hotline directly.', 'warn')}
    `,

    weekly: () => `
      ${sectionTitle('Weekly Check-Ins', 'Submit your school\'s weekly status report')}

      <div class="card reveal" style="padding:18px;margin-bottom:14px">
        ${subTitle('How to Complete Your Check-In')}
        ${stepCard(1, 'Select the week', 'Click the correct week tab (W1 to W10) at the top')}
        ${stepCard(2, 'Find your school', 'Look for your school in the table')}
        ${stepCard(3, 'Click Check-In', 'If it says "Due", click the Check-In button')}
        ${stepCard(4, 'Rate each area', 'Set status for Connectivity, Tablets, Platform, and Power')}
        ${stepCard(5, 'Set overall status', 'Green (OK), Amber (minor issues), or Red (critical)')}
        ${stepCard(6, 'Submit', 'Add any notes and click Submit Check-In')}
      </div>

      <div class="card reveal" style="padding:18px;margin-bottom:14px">
        ${subTitle('Status Colors')}
        <div style="display:flex;gap:10px;margin-top:8px">
          <div style="flex:1;background:rgba(45,217,138,0.08);border-radius:8px;padding:12px;text-align:center;border-top:3px solid var(--green)">
            <div style="font-size:12px;font-weight:700;color:var(--green)">Green</div>
            <div style="font-size:10px;color:var(--text3);margin-top:3px">All systems working normally</div>
          </div>
          <div style="flex:1;background:rgba(245,166,35,0.08);border-radius:8px;padding:12px;text-align:center;border-top:3px solid var(--amber)">
            <div style="font-size:12px;font-weight:700;color:var(--amber)">Amber</div>
            <div style="font-size:10px;color:var(--text3);margin-top:3px">Minor issues, school operational</div>
          </div>
          <div style="flex:1;background:rgba(255,82,99,0.08);border-radius:8px;padding:12px;text-align:center;border-top:3px solid var(--red)">
            <div style="font-size:12px;font-weight:700;color:var(--red)">Red</div>
            <div style="font-size:10px;color:var(--text3);margin-top:3px">Critical problems affecting learning</div>
          </div>
        </div>
      </div>

      ${infoBox('Complete your check-in early in the week (Monday or Tuesday). This gives the support team time to address any issues before they escalate.')}
      ${infoBox('Missing check-ins appear as "Due" and may trigger follow-up from the support team.', 'warn')}
    `,

    schools: () => `
      ${sectionTitle('School Profiles', 'View your school details and equipment inventory')}

      <div class="card reveal" style="padding:18px;margin-bottom:14px">
        ${subTitle('What You\'ll See')}
        <div style="font-size:12px;color:var(--text2);line-height:1.7">
          <div style="margin-bottom:6px"><i class="ti ti-info-circle" style="color:var(--accent);margin-right:6px"></i><strong>Overview</strong> — Contact info, student count, zone/district</div>
          <div style="margin-bottom:6px"><i class="ti ti-device-tablet" style="color:var(--teal);margin-right:6px"></i><strong>Equipment</strong> — Tablets, routers, and other devices assigned</div>
          <div style="margin-bottom:6px"><i class="ti ti-bug" style="color:var(--red);margin-right:6px"></i><strong>Error History</strong> — All past issues reported for your school</div>
          <div style="margin-bottom:6px"><i class="ti ti-calendar-check" style="color:var(--green);margin-right:6px"></i><strong>Check-In History</strong> — Weekly check-in records</div>
        </div>
      </div>

      ${infoBox('If your school\'s information is incorrect (wrong contact, outdated tablet count, etc.), report it to the system administrator for correction.')}
    `,

    troubleshoot: () => `
      ${sectionTitle('Troubleshooting Guides', 'Fix common issues without waiting for support')}

      <div class="card reveal" style="padding:18px;margin-bottom:14px;border-left:3px solid var(--green)">
        <div style="font-size:12px;font-weight:600;color:var(--green);margin-bottom:6px"><i class="ti ti-bulb" style="margin-right:4px"></i>Pro Tip</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.6">Always try the Troubleshooting guides <strong>before</strong> reporting an error. Many issues can be fixed on-site in minutes!</div>
      </div>

      <div class="card reveal" style="padding:18px;margin-bottom:14px">
        ${subTitle('How to Use')}
        ${stepCard(1, 'Find the guide', 'Browse by category or search for keywords')}
        ${stepCard(2, 'Follow each step', 'Complete steps in order, checking them off as you go')}
        ${stepCard(3, 'Issue resolved?', 'Great! No need to report anything')}
        ${stepCard(4, 'Still stuck?', 'Click "Escalate Issue" to submit an error report automatically')}
      </div>

      <div class="card reveal" style="padding:18px;margin-bottom:14px">
        ${subTitle('Categories')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
          <div style="background:var(--bg3);border-radius:6px;padding:10px;font-size:12px;display:flex;align-items:center;gap:8px"><i class="ti ti-wifi" style="color:#4f7cff"></i>Connectivity</div>
          <div style="background:var(--bg3);border-radius:6px;padding:10px;font-size:12px;display:flex;align-items:center;gap:8px"><i class="ti ti-cpu" style="color:#f5a623"></i>Hardware</div>
          <div style="background:var(--bg3);border-radius:6px;padding:10px;font-size:12px;display:flex;align-items:center;gap:8px"><i class="ti ti-app-window" style="color:#9b7dff"></i>Platform</div>
          <div style="background:var(--bg3);border-radius:6px;padding:10px;font-size:12px;display:flex;align-items:center;gap:8px"><i class="ti ti-bolt" style="color:#ff5263"></i>Power</div>
          <div style="background:var(--bg3);border-radius:6px;padding:10px;font-size:12px;display:flex;align-items:center;gap:8px"><i class="ti ti-user-circle" style="color:#36d9cc"></i>Accounts</div>
        </div>
      </div>

      ${infoBox('Your progress is saved automatically. If you leave and come back, the system remembers which steps you completed.')}
    `,

    manuals: () => `
      ${sectionTitle('Resource Library', 'Download manuals, training materials, and references')}

      <div class="card reveal" style="padding:18px;margin-bottom:14px">
        ${subTitle('What You Can Do')}
        <div style="font-size:12px;color:var(--text2);line-height:1.7">
          <div style="margin-bottom:6px"><i class="ti ti-eye" style="color:var(--accent);margin-right:6px"></i><strong>Preview</strong> — View images, videos, and documents in-browser</div>
          <div style="margin-bottom:6px"><i class="ti ti-download" style="color:var(--green);margin-right:6px"></i><strong>Download</strong> — Save any file to your device</div>
          <div style="margin-bottom:6px"><i class="ti ti-filter" style="color:var(--text2);margin-right:6px"></i><strong>Filter</strong> — Narrow by category (General, Training, Technical, etc.)</div>
        </div>
      </div>

      <div class="card reveal" style="padding:18px;margin-bottom:14px">
        ${subTitle('Supported File Types')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;font-size:11px;color:var(--text2)">
          <div style="background:var(--bg3);border-radius:6px;padding:8px 10px"><i class="ti ti-file-type-pdf" style="color:var(--red);margin-right:4px"></i>PDF, Word, PowerPoint, Excel</div>
          <div style="background:var(--bg3);border-radius:6px;padding:8px 10px"><i class="ti ti-photo" style="color:var(--purple);margin-right:4px"></i>PNG, JPG, GIF, SVG</div>
          <div style="background:var(--bg3);border-radius:6px;padding:8px 10px"><i class="ti ti-video" style="color:var(--red);margin-right:4px"></i>MP4, WebM, MOV</div>
          <div style="background:var(--bg3);border-radius:6px;padding:8px 10px"><i class="ti ti-music" style="color:var(--teal);margin-right:4px"></i>MP3, WAV, OGG</div>
        </div>
      </div>

      ${infoBox('Only administrators can upload new resources. If you need a document that isn\'t available, ask the support team to add it.')}
    `,

    account: () => `
      ${sectionTitle('My Account', 'Manage your profile and security settings')}

      <div class="card reveal" style="padding:18px;margin-bottom:14px">
        ${subTitle('Profile Menu')}
        <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:10px">Click your avatar in the <strong>top-right corner</strong> to access:</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.7">
          <div style="margin-bottom:6px"><i class="ti ti-user" style="color:var(--accent);margin-right:6px"></i><strong>My Profile</strong> — View your name, email, role, and zone</div>
          <div style="margin-bottom:6px"><i class="ti ti-key" style="color:var(--amber);margin-right:6px"></i><strong>Change Password</strong> — Update your login password</div>
          <div style="margin-bottom:6px"><i class="ti ti-logout" style="color:var(--red);margin-right:6px"></i><strong>Sign Out</strong> — Log out securely</div>
        </div>
      </div>

      <div class="card reveal" style="padding:18px;margin-bottom:14px">
        ${subTitle('Changing Your Password')}
        ${stepCard(1, 'Click your avatar', 'Top-right corner of the screen')}
        ${stepCard(2, 'Select "Change Password"', 'From the dropdown menu')}
        ${stepCard(3, 'Enter current password', 'For verification')}
        ${stepCard(4, 'Set new password', 'At least 6 characters with letters + numbers')}
        ${stepCard(5, 'Confirm and save', 'Click "Update Password"')}
      </div>

      ${infoBox('Choose a strong password: at least 8 characters with a mix of letters, numbers, and symbols. <strong>Never share your password.</strong>', 'warn')}

      <div class="card reveal" style="padding:16px;background:var(--bg3);border-left:3px solid var(--teal)">
        <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:4px"><i class="ti ti-shield-lock" style="margin-right:6px;color:var(--teal)"></i>Session Security</div>
        <div style="font-size:12px;color:var(--text3);line-height:1.6">You are automatically signed out after <strong>15 minutes of inactivity</strong>. Always sign out manually on shared computers.</div>
      </div>
    `,

    faq: () => `
      ${sectionTitle('Frequently Asked Questions', 'Quick answers to common questions')}

      <div style="display:flex;flex-direction:column;gap:10px">
        ${faqItem('I reported an error but nothing is happening. What do I do?', 'Check the <strong>Error Tracker</strong> for your issue\'s status. If it\'s still "Open" after 4 hours, go to the <strong>Follow-Up Center</strong> and click <strong>Escalate</strong>. You can also call <strong>+255 658 066 983</strong>.')}
        ${faqItem('I can\'t log in. What should I do?', 'Make sure you\'re using the correct username and password. If you forgot your password, contact the system administrator to reset it. Check your internet connection.')}
        ${faqItem('The internet is down. Can I still use this system?', 'No — the system requires internet. Try the <strong>Troubleshooting</strong> guide for connectivity issues first. If it can\'t be fixed, call the support hotline to report by phone.')}
        ${faqItem('How do I know if my issue is Critical or Medium?', '<strong>Critical:</strong> School cannot teach (total outage, all tablets dead).<br><strong>High:</strong> Large group affected, school partially operational.<br><strong>Medium:</strong> Some users affected, work continues.<br><strong>Low:</strong> Minor inconvenience.')}
        ${faqItem('What is the Weekly Check-In?', 'A quick status report you submit each week about your school\'s devices, connectivity, and overall health. Schools that check in consistently get faster support.')}
        ${faqItem('Can I see who is fixing my issue?', 'Yes! In the <strong>Error Tracker</strong>, click your issue and look for the "Assigned To" field.')}
        ${faqItem('The system looks different on my phone.', 'Yes — the system is responsive. On small screens, the sidebar becomes a slide-out menu (tap &#9776;). All features work the same way.')}
      </div>

      <div class="card reveal" style="padding:16px;margin-top:14px;background:var(--bg3);border-left:3px solid var(--accent)">
        <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:4px"><i class="ti ti-headset" style="margin-right:6px;color:var(--accent)"></i>Still need help?</div>
        <div style="font-size:12px;color:var(--text3);line-height:1.8">
          Phone: <strong style="color:var(--text)">+255 658 066 983</strong><br>
          Email: support@opportunityeducation.or.tz<br>
          Hours: Mon&ndash;Fri, 7:30 AM &ndash; 5:00 PM
        </div>
      </div>
    `,
  };

  function faqItem(q, a) {
    return `<div class="card reveal" style="padding:14px 16px">
      <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px;display:flex;align-items:flex-start;gap:8px">
        <i class="ti ti-help-circle" style="color:var(--amber);font-size:16px;flex-shrink:0;margin-top:1px"></i>${q}
      </div>
      <div style="font-size:12px;color:var(--text2);line-height:1.6;padding-left:24px">${a}</div>
    </div>`;
  }

  return { load, render, setSection };
})();
