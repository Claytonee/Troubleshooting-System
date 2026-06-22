/**
 * Help / User Guide Page — School Admin Documentation
 */
const HelpPage = (() => {
  let activeSection = 'overview';

  function load() { return Promise.resolve(); }

  const sections = [
    { id: 'overview', icon: 'ti-home', title: 'Getting Started' },
    { id: 'dashboard', icon: 'ti-layout-dashboard', title: 'Dashboard' },
    { id: 'report', icon: 'ti-bug', title: 'Report Error' },
    { id: 'tracker', icon: 'ti-list-check', title: 'Error Tracker' },
    { id: 'followup', icon: 'ti-headset', title: 'Follow-Up Center' },
    { id: 'weekly', icon: 'ti-calendar-week', title: 'Weekly Check-Ins' },
    { id: 'schools', icon: 'ti-school', title: 'School Profiles' },
    { id: 'troubleshoot', icon: 'ti-tools', title: 'Troubleshooting' },
    { id: 'manuals', icon: 'ti-books', title: 'Resource Library' },
    { id: 'account', icon: 'ti-user', title: 'My Account' },
    { id: 'faq', icon: 'ti-help-circle', title: 'FAQ' },
  ];

  function setSection(id) { activeSection = id; App.render(); }

  function render() {
    const nav = sections.map(s =>
      `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:var(--radius-sm);cursor:pointer;font-size:13px;transition:all .15s;${activeSection === s.id ? 'background:rgba(79,124,255,0.12);color:var(--accent);font-weight:500' : 'color:var(--text2)'}" onclick="HelpPage.setSection('${s.id}')">
        <i class="ti ${s.icon}" style="font-size:15px"></i>${s.title}
      </div>`
    ).join('');

    return `
    <div class="section-header">
      <div>
        <div class="section-title">User Guide</div>
        <div class="section-sub">School Admin Documentation &mdash; How to use the QFT Technical Support System</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:220px 1fr;gap:20px;align-items:start">
      <div class="card reveal" style="position:sticky;top:76px;padding:12px">
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);padding:4px 12px 8px">Contents</div>
        ${nav}
      </div>
      <div class="card reveal" style="padding:28px 32px;line-height:1.8;font-size:13px;color:var(--text2)">
        ${getContent(activeSection)}
      </div>
    </div>`;
  }

  function getContent(id) {
    const c = content[id];
    return c ? c() : '<div class="empty"><i class="ti ti-file-search"></i>Section not found</div>';
  }

  function h2(text) { return `<div style="font-size:16px;font-weight:600;color:var(--text);margin:24px 0 10px;padding-bottom:8px;border-bottom:1px solid var(--border)">${text}</div>`; }
  function h3(text) { return `<div style="font-size:14px;font-weight:600;color:var(--text);margin:18px 0 8px">${text}</div>`; }
  function p(text) { return `<p style="margin:0 0 12px">${text}</p>`; }
  function note(text) { return `<div style="background:rgba(79,124,255,0.06);border:1px solid rgba(79,124,255,0.15);border-radius:8px;padding:12px 16px;margin:12px 0;font-size:12px;display:flex;align-items:flex-start;gap:10px"><i class="ti ti-info-circle" style="color:var(--accent);font-size:16px;flex-shrink:0;margin-top:1px"></i><div>${text}</div></div>`; }
  function warn(text) { return `<div style="background:rgba(255,82,99,0.06);border:1px solid rgba(255,82,99,0.15);border-radius:8px;padding:12px 16px;margin:12px 0;font-size:12px;display:flex;align-items:flex-start;gap:10px"><i class="ti ti-alert-triangle" style="color:var(--red);font-size:16px;flex-shrink:0;margin-top:1px"></i><div>${text}</div></div>`; }
  function steps(list) { return `<ol style="margin:8px 0 16px;padding-left:20px">${list.map(s => `<li style="margin-bottom:6px">${s}</li>`).join('')}</ol>`; }
  function ul(list) { return `<ul style="margin:8px 0 16px;padding-left:20px">${list.map(s => `<li style="margin-bottom:4px">${s}</li>`).join('')}</ul>`; }
  function kbd(key) { return `<span style="background:var(--bg4);border:1px solid var(--border2);border-radius:4px;padding:1px 6px;font-family:var(--mono);font-size:11px">${key}</span>`; }

  const content = {
    overview: () => `
      ${h2('Welcome to the QFT Technical Support System')}
      ${p('This system helps you report, track, and resolve technical issues at your school. As a <strong>School Admin</strong>, you have access to the following features:')}
      ${ul([
        '<strong>Dashboard</strong> — Real-time overview of your school\'s technical health',
        '<strong>Report Error</strong> — Submit new technical issues for resolution',
        '<strong>Error Tracker</strong> — Monitor all reported issues and their status',
        '<strong>Follow-Up Center</strong> — Track SLA compliance and escalated issues',
        '<strong>Weekly Check-Ins</strong> — Complete weekly device and connectivity checks',
        '<strong>School Profiles</strong> — View school details and equipment inventory',
        '<strong>Troubleshooting</strong> — Step-by-step guides for common issues',
        '<strong>Resource Library</strong> — Download manuals, guides, and reference materials',
      ])}
      ${h3('Quick Start')}
      ${steps([
        'After logging in, you land on the <strong>Dashboard</strong> which shows overall status.',
        'If you encounter a technical problem, go to <strong>Report Error</strong> and fill in the form.',
        'Track your report\'s progress in the <strong>Error Tracker</strong>.',
        'For common issues (no internet, tablet not charging), try <strong>Troubleshooting</strong> first.',
        'Complete your <strong>Weekly Check-In</strong> every week to keep the system updated.',
      ])}
      ${note('The sidebar on the left is your main navigation. Click any item to go to that page. On mobile, tap the <strong>☰</strong> menu icon to open the sidebar.')}
    `,

    dashboard: () => `
      ${h2('Dashboard')}
      ${p('The Dashboard gives you a real-time snapshot of your school\'s technical status. It is the first page you see after logging in.')}
      ${h3('What You\'ll See')}
      ${ul([
        '<strong>Open Errors</strong> — Total unresolved issues (red = critical, needs immediate attention)',
        '<strong>In Progress</strong> — Issues currently being worked on by the support team',
        '<strong>Resolved (24h)</strong> — Issues fixed in the last 24 hours',
        '<strong>Schools Healthy</strong> — How many schools have zero open issues',
        '<strong>Weekly Check-Ins</strong> — Progress on this week\'s check-in completion',
      ])}
      ${h3('Alert Banner')}
      ${p('If there are <strong>critical errors</strong>, a red alert banner appears at the top. Click <strong>View</strong> to see the critical issues.')}
      ${h3('Priority Table')}
      ${p('The Active Priorities table shows the most recent issues sorted by urgency. Click any row to see full details.')}
      ${h3('Category Breakdown')}
      ${p('The right panel shows issues grouped by category (Connectivity, Hardware, Platform, Power, Accounts). This helps you spot patterns — if connectivity issues are rising, you can proactively check your network equipment.')}
      ${note('The dashboard refreshes automatically each time you navigate to it. For the latest data, simply click "Dashboard" in the sidebar.')}
    `,

    report: () => `
      ${h2('Report Error')}
      ${p('Use this page to submit a new technical issue. The more detail you provide, the faster the support team can resolve it.')}
      ${h3('Required Fields')}
      ${ul([
        '<strong>Reporting School</strong> — Select your school from the dropdown',
        '<strong>Category</strong> — Choose the type of issue (Connectivity, Hardware, Platform, Power, Accounts)',
        '<strong>Priority</strong> — How urgent is this issue?',
        '<strong>Error Title</strong> — Brief summary of the problem',
        '<strong>Detailed Description</strong> — Full explanation of what happened',
      ])}
      ${h3('Priority Levels & SLA Targets')}
      ${p('Choose the correct priority to ensure appropriate response time:')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0 16px;font-size:12px">
        <div style="background:rgba(255,82,99,0.08);border-radius:6px;padding:10px 14px"><strong style="color:var(--red)">Critical</strong> — School cannot operate. SLA: <strong>≤ 2 hours</strong></div>
        <div style="background:rgba(245,166,35,0.08);border-radius:6px;padding:10px 14px"><strong style="color:var(--amber)">High</strong> — Major disruption. SLA: <strong>≤ 8 hours</strong></div>
        <div style="background:rgba(79,124,255,0.08);border-radius:6px;padding:10px 14px"><strong style="color:var(--accent)">Medium</strong> — Partial disruption. SLA: <strong>≤ 24 hours</strong></div>
        <div style="background:rgba(45,217,138,0.08);border-radius:6px;padding:10px 14px"><strong style="color:var(--green)">Low</strong> — Minor issue. SLA: <strong>≤ 72 hours</strong></div>
      </div>
      ${warn('Only use <strong>Critical</strong> when the entire school or a whole class cannot work. Overusing critical priority may delay response to genuinely urgent issues.')}
      ${h3('How to Submit')}
      ${steps([
        'Navigate to <strong>Report Error</strong> in the sidebar.',
        'Select your school and fill in your name and contact details.',
        'Choose the correct Category and Priority.',
        'Write a clear title (e.g., "Internet down in Computer Lab 2").',
        'In the description, include: when it started, what you were doing, any error messages, and what you\'ve already tried.',
        'Click <strong>Submit Report</strong>.',
      ])}
      ${p('After submitting, you\'ll receive a unique <strong>Error Code</strong> (e.g., ERR-0042). Use this code to track your issue.')}
      ${h3('Support Hotline')}
      ${p('For urgent issues or if you can\'t access the system:')}
      ${ul([
        '<strong>Phone:</strong> +255 658 066 983',
        '<strong>Email:</strong> support@opportunityeducation.or.tz',
        '<strong>Hours:</strong> Monday–Friday, 7:30 AM – 5:00 PM',
      ])}
    `,

    tracker: () => `
      ${h2('Error Tracker')}
      ${p('The Error Tracker shows <strong>all reported issues</strong> across your school. Use it to check the status of your reports and monitor resolution progress.')}
      ${h3('Status Filters')}
      ${p('Use the filter chips at the top to narrow your view:')}
      ${ul([
        '<strong>All</strong> — Every reported issue',
        '<strong>Open</strong> — New reports waiting to be picked up',
        '<strong>In Progress</strong> — Currently being worked on',
        '<strong>Escalated</strong> — Raised to senior support for complex issues',
        '<strong>Resolved</strong> — Fixed and closed',
      ])}
      ${h3('Search')}
      ${p('Type in the search box to find issues by title, school name, or error code.')}
      ${h3('Viewing Details')}
      ${p('Click any row to open the <strong>Error Detail</strong> modal. There you\'ll see:')}
      ${ul([
        'Full description and location',
        'Who reported it and when',
        'Who is assigned to fix it',
        'Status updates and notes from the support team',
        'SLA status (whether response time is within target)',
      ])}
      ${h3('Export')}
      ${p('Click <strong>Export</strong> to download all visible errors as a CSV file. Useful for reporting to school management.')}
      ${note('You can mark an issue as resolved directly from the detail modal if the problem has been fixed. This helps keep the system accurate.')}
    `,

    followup: () => `
      ${h2('Follow-Up Center')}
      ${p('The Follow-Up Center is your command post for managing active issues. It shows SLA breaches, escalations, team activity, and communication logs.')}
      ${h3('SLA Breaches')}
      ${p('Issues displayed here have exceeded their response time target. They are highlighted in red and need immediate attention.')}
      ${ul([
        'Critical issues breaching SLA appear first',
        'Each card shows the error code, age, and assigned engineer',
        'Click <strong>View</strong> to see full details',
        'Click <strong>Escalate</strong> to raise it to senior support',
        'Click <strong>Resolve</strong> if the issue is already fixed',
      ])}
      ${h3('Team Status')}
      ${p('See which support engineers are active and their current workload. This helps you know who is handling your school\'s issues.')}
      ${h3('Communication Log')}
      ${p('All notes and updates about issues are logged here. You can see when an engineer last communicated about your case.')}
      ${warn('If an issue has been in "Open" status for more than 4 hours without any update, please <strong>Escalate</strong> it or contact the support hotline directly.')}
    `,

    weekly: () => `
      ${h2('Weekly Check-Ins')}
      ${p('Every week, each school must complete a check-in to report on device health, connectivity, and overall status. This is a core part of the QFT support process.')}
      ${h3('How It Works')}
      ${steps([
        'Select the current week from the tabs at the top (W1 to W10).',
        'Find your school in the table.',
        'If your check-in is <strong>Due</strong>, click the <strong>Check-In</strong> button.',
        'Fill in the status for each category: Connectivity, Tablets, Platform, Power.',
        'Set the Overall Status: Green (all OK), Amber (minor issues), or Red (critical).',
        'Add any notes about observations or concerns.',
        'Click <strong>Submit Check-In</strong>.',
      ])}
      ${h3('Status Meanings')}
      ${ul([
        '<strong style="color:var(--green)">Green</strong> — Everything is working normally',
        '<strong style="color:var(--amber)">Amber</strong> — Minor issues present but school is operational',
        '<strong style="color:var(--red)">Red</strong> — Critical problems affecting teaching and learning',
      ])}
      ${h3('Viewing Past Check-Ins')}
      ${p('If your school already submitted a check-in for a particular week, you\'ll see a <strong>View</strong> button instead. Click it to review what was reported.')}
      ${note('Complete your check-in early in the week (ideally Monday or Tuesday). This gives the support team time to address any issues before they escalate.')}
      ${warn('Missing check-ins appear as "Due" and may trigger follow-up from the support team. Please complete them on time.')}
    `,

    schools: () => `
      ${h2('School Profiles')}
      ${p('This page displays all schools in the system. As a School Admin, you can view details about each school including equipment inventory, contact information, and issue history.')}
      ${h3('School Cards')}
      ${p('Each school card shows:')}
      ${ul([
        'School name and zone/district',
        'Number of students',
        'Number of tablets',
        'Open error count',
        'Health status (Healthy or Issues)',
        'Assigned admin',
      ])}
      ${h3('School Detail View')}
      ${p('Click any school card to see the full profile:')}
      ${ul([
        '<strong>Overview</strong> — Contact info, student count, equipment',
        '<strong>Error History</strong> — All past issues reported for this school',
        '<strong>Check-In History</strong> — Weekly check-in records',
        '<strong>Assigned Equipment</strong> — Tablets, routers, and other devices',
      ])}
      ${note('If your school\'s information is incorrect (wrong contact, outdated tablet count, etc.), report it to the system administrator for correction.')}
    `,

    troubleshoot: () => `
      ${h2('Troubleshooting Guides')}
      ${p('Before reporting an issue, check the <strong>Troubleshooting</strong> page for step-by-step solutions to common problems. Many issues can be resolved on-site without waiting for support.')}
      ${h3('How to Use')}
      ${steps([
        'Browse guides by category (Connectivity, Hardware, Platform, Power, Accounts) or search.',
        'Click a guide card to open the detailed steps.',
        'Follow each step in order — check off steps as you complete them.',
        'If the issue is resolved, you\'re done! No need to report.',
        'If all steps are completed and the issue persists, click <strong>Escalate Issue</strong> to report it.',
      ])}
      ${h3('Categories')}
      ${ul([
        '<strong>Connectivity</strong> — WiFi down, slow internet, no access to online platform',
        '<strong>Hardware</strong> — Tablet not charging, broken screen, projector issues',
        '<strong>Platform</strong> — App crashes, login issues, content not loading',
        '<strong>Power</strong> — Power outage, UPS failure, charging station issues',
        '<strong>Accounts</strong> — Forgotten passwords, locked accounts, new user setup',
      ])}
      ${h3('Progress Tracking')}
      ${p('Your progress is tracked as you complete steps. If you leave and come back, the system remembers where you were. Use <strong>Reset</strong> if you need to start over.')}
      ${note('The Troubleshooting guides are updated regularly by the support team. If you find a guide that is outdated or incorrect, please let the admin know.')}
    `,

    manuals: () => `
      ${h2('Resource Library')}
      ${p('The Resource Library contains manuals, training materials, guides, and reference documents. Download what you need or preview files directly in the browser.')}
      ${h3('What You Can Do')}
      ${ul([
        '<strong>Browse</strong> — View all available resources',
        '<strong>Filter</strong> — Filter by category (General, User Guide, Training, Technical, Policy)',
        '<strong>Preview</strong> — View images, videos, and PDFs directly in the browser',
        '<strong>Download</strong> — Download any file to your device',
      ])}
      ${h3('File Types Supported')}
      ${ul([
        '<strong>Documents:</strong> PDF, Word, PowerPoint, Excel, Text',
        '<strong>Images:</strong> PNG, JPG, GIF, SVG',
        '<strong>Video:</strong> MP4, WebM, MOV',
        '<strong>Audio:</strong> MP3, WAV, OGG',
      ])}
      ${h3('Finding What You Need')}
      ${p('Resources are organized by category. Use the category tabs to narrow your search. Each file shows its name, type, size, and when it was uploaded.')}
      ${note('Only system administrators can upload new resources. If you need a specific document that isn\'t available, contact the support team and they will add it.')}
    `,

    account: () => `
      ${h2('My Account')}
      ${p('Manage your account settings from the profile menu in the top-right corner of the screen.')}
      ${h3('Profile Menu')}
      ${p('Click your avatar/name in the top-right corner to access:')}
      ${ul([
        '<strong>My Profile</strong> — View your account details (name, email, role)',
        '<strong>Change Password</strong> — Update your login password',
        '<strong>Sign Out</strong> — Log out of the system securely',
      ])}
      ${h3('Changing Your Password')}
      ${steps([
        'Click your profile avatar in the top-right corner.',
        'Select <strong>Change Password</strong>.',
        'Enter your current password.',
        'Enter and confirm your new password.',
        'Click <strong>Update Password</strong>.',
      ])}
      ${warn('Choose a strong password: at least 8 characters with a mix of letters, numbers, and symbols. Never share your password with others.')}
      ${h3('Signing Out')}
      ${p('Always sign out when you\'re done, especially on shared computers. Click your profile icon → <strong>Sign Out</strong>.')}
      ${note('Your session expires automatically after 7 days of inactivity. If you see the login page unexpectedly, simply log in again — your data is safe.')}
    `,

    faq: () => `
      ${h2('Frequently Asked Questions')}
      ${h3('Q: I reported an error but nothing is happening. What do I do?')}
      ${p('Check the <strong>Error Tracker</strong> for your issue\'s status. If it\'s still "Open" after 4 hours, go to the <strong>Follow-Up Center</strong> and click <strong>Escalate</strong>. You can also call the support hotline at <strong>+255 658 066 983</strong>.')}
      ${h3('Q: I can\'t log in. What should I do?')}
      ${p('Make sure you\'re using the correct email and password. If you forgot your password, contact the system administrator to reset it. Check that your internet connection is working.')}
      ${h3('Q: The internet is down at my school. Can I still use this system?')}
      ${p('The system requires an internet connection to work. If your internet is down, try the <strong>Troubleshooting</strong> guide for connectivity issues first. If it can\'t be fixed, call the support hotline to report the issue by phone.')}
      ${h3('Q: How do I know if my issue is Critical or Medium priority?')}
      ${p('Use this guide:')}
      ${ul([
        '<strong>Critical:</strong> The school cannot teach or students cannot learn (total internet outage, all tablets dead, platform completely down)',
        '<strong>High:</strong> A large group is affected but school can partially operate (one lab down, half the tablets not working)',
        '<strong>Medium:</strong> Some users affected but work continues (slow internet, a few tablets not charging)',
        '<strong>Low:</strong> Minor inconvenience (one tablet has a cracked screen, printer jam)',
      ])}
      ${h3('Q: What is the Weekly Check-In and why is it important?')}
      ${p('The check-in is a quick status report you submit each week. It helps the support team spot problems early before they become critical. Schools that complete check-ins consistently get faster support response times.')}
      ${h3('Q: Can I see who is fixing my issue?')}
      ${p('Yes! Open the <strong>Error Tracker</strong>, click your issue, and look for the "Assigned To" field. This shows which engineer is handling your case.')}
      ${h3('Q: How do I download a resource/manual?')}
      ${p('Go to <strong>Resource Library</strong>, find the file you need, and click the download icon. The file will save to your device\'s Downloads folder.')}
      ${h3('Q: The system looks different on my phone. Is that normal?')}
      ${p('Yes! The system is responsive — it adjusts its layout for smaller screens. On phones and tablets, the sidebar becomes a slide-out menu (tap the ☰ icon). All features work the same way.')}
      ${note('If your question isn\'t answered here, contact support at <strong>+255 658 066 983</strong> or email <strong>support@opportunityeducation.or.tz</strong>.')}
    `,
  };

  return { load, render, setSection };
})();
