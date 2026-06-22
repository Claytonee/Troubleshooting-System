/**
 * Help / User Guide — School Admin Documentation
 * Simple, clear explanations of each feature
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
        <div class="section-sub">Mwongozo wa Matumizi &mdash; School Admin</div>
      </div>
    </div>
    <div class="help-layout" style="display:grid;grid-template-columns:200px 1fr;gap:16px;align-items:start">
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

  function title(icon, color, name, meaning) {
    return `<div class="card reveal" style="padding:18px;margin-bottom:14px;border-left:3px solid ${color}">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div style="width:36px;height:36px;background:${color}25;border-radius:10px;display:flex;align-items:center;justify-content:center">
          <i class="ti ${icon}" style="color:${color};font-size:18px"></i>
        </div>
        <div>
          <div style="font-size:15px;font-weight:600;color:var(--text)">${name}</div>
          <div style="font-size:12px;color:var(--text3)">${meaning}</div>
        </div>
      </div>`;
  }

  function section(heading, body) {
    return `<div class="card reveal" style="padding:16px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:8px">${heading}</div>
      <div style="font-size:12px;color:var(--text2);line-height:1.7">${body}</div>
    </div>`;
  }

  function tip(text) {
    return `<div style="background:rgba(79,124,255,0.06);border:1px solid rgba(79,124,255,0.15);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:11px;line-height:1.6;display:flex;align-items:flex-start;gap:8px;color:var(--text2)">
      <i class="ti ti-bulb" style="color:var(--accent);font-size:14px;flex-shrink:0;margin-top:1px"></i><div>${text}</div></div>`;
  }

  const content = {
    overview: () => `
      ${title('ti-home', '#4f7cff', 'Getting Started', 'Karibu kwenye mfumo wa QFT Technical Support')}
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          Mfumo huu unakusaidia ku-report matatizo ya kiufundi shuleni kwako, kufuatilia hali yake, na kupata ufumbuzi wa haraka.
          Kama School Admin, unaweza kufanya yafuatayo:
        </div>
      </div>

      <div class="card reveal" style="padding:16px;margin-bottom:12px">
        <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:10px">Features Zako</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
          <div style="background:var(--bg3);border-radius:6px;padding:10px 12px"><strong>Dashboard</strong> — Hali ya shule kwa muhtasari</div>
          <div style="background:var(--bg3);border-radius:6px;padding:10px 12px"><strong>Report Error</strong> — Tuma tatizo jipya</div>
          <div style="background:var(--bg3);border-radius:6px;padding:10px 12px"><strong>Error Tracker</strong> — Fuatilia matatizo yote</div>
          <div style="background:var(--bg3);border-radius:6px;padding:10px 12px"><strong>Follow-Up Center</strong> — Mawasiliano na timu</div>
          <div style="background:var(--bg3);border-radius:6px;padding:10px 12px"><strong>Weekly Check-Ins</strong> — Ripoti ya kila wiki</div>
          <div style="background:var(--bg3);border-radius:6px;padding:10px 12px"><strong>School Profiles</strong> — Taarifa za shule</div>
          <div style="background:var(--bg3);border-radius:6px;padding:10px 12px"><strong>Troubleshooting</strong> — Tatua mwenyewe</div>
          <div style="background:var(--bg3);border-radius:6px;padding:10px 12px"><strong>Resource Library</strong> — Nyaraka na miongozo</div>
        </div>
      </div>

      ${tip('Ukipata tatizo la kiufundi, jaribu kwanza <strong>Troubleshooting</strong> kabla ya ku-report. Matatizo mengi yanaweza kutatuliwa papo hapo!')}
    `,

    dashboard: () => `
      ${title('ti-layout-dashboard', '#4f7cff', 'Dashboard', 'Muhtasari wa hali ya kiufundi shuleni kwako')}
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          Hii ni ukurasa wa kwanza unaouona baada ya kuingia. Inaonyesha hali ya sasa ya shule yako kwa mtazamo mmoja wa haraka.
        </div>
      </div>

      ${section('Maana ya Nambari', `
        <strong style="color:var(--red)">Open Errors</strong> — Idadi ya matatizo ambayo bado hayajatatuliwa<br>
        <strong style="color:var(--amber)">In Progress</strong> — Matatizo yanayofanyiwa kazi sasa hivi na timu ya msaada<br>
        <strong style="color:var(--green)">Resolved (24h)</strong> — Matatizo yaliyotatuliwa katika masaa 24 yaliyopita<br>
        <strong style="color:var(--teal)">Schools Healthy</strong> — Kama shule yako haina matatizo makubwa<br>
        <strong>Week Check-Ins</strong> — Hali ya ripoti ya wiki hii
      `)}

      ${section('Alert Banner (Onyo Jekundu)', `
        Ikiwa kuna tatizo la <strong style="color:var(--red)">Critical</strong> (dharura), banner nyekundu itaonekana juu ya ukurasa. Bonyeza <strong>View</strong> kuona tatizo hilo moja kwa moja.
      `)}

      ${tip('Dashboard inasasishwa kila unapofungua ukurasa. Bonyeza "Dashboard" kwenye sidebar kupata data mpya.')}
    `,

    report: () => `
      ${title('ti-bug', '#ff5263', 'Report Error', 'Tuma tatizo jipya la kiufundi')}
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          Ukurasa huu ni kwa kutuma ripoti ya tatizo lolote la kiufundi shuleni kwako. Timu ya msaada itapokea ripoti yako na kuanza kufanyia kazi.
        </div>
      </div>

      ${section('Unajaza Nini', `
        <strong>School</strong> — Shule yako (imejazwa tayari, huwezi kubadilisha)<br>
        <strong>Category</strong> — Aina ya tatizo: Connectivity (mtandao), Hardware (vifaa), Platform (programu), Power (umeme), Accounts (akaunti)<br>
        <strong>Priority</strong> — Kiwango cha dharura (angalia hapa chini)<br>
        <strong>Title</strong> — Muhtasari mfupi wa tatizo<br>
        <strong>Description</strong> — Maelezo kamili: lilianza lini, nini kinatokea, ujumbe wa kosa kama upo
      `)}

      ${section('Viwango vya Dharura (Priority)', `
        <strong style="color:var(--red)">Critical</strong> — Shule haiwezi kufanya kazi kabisa. Msaada ndani ya <strong>masaa 2</strong><br>
        <strong style="color:var(--amber)">High</strong> — Usumbufu mkubwa kwa wanafunzi wengi. Msaada ndani ya <strong>masaa 8</strong><br>
        <strong style="color:var(--accent)">Medium</strong> — Usumbufu wa wastani, kazi inaendelea. Msaada ndani ya <strong>masaa 24</strong><br>
        <strong style="color:var(--green)">Low</strong> — Tatizo dogo, haizuii kazi. Msaada ndani ya <strong>masaa 72</strong>
      `)}

      ${tip('Baada ya kutuma ripoti, utapata code ya kufuatilia (mfano: QFT-0042). Tumia code hii kuongea na timu ya msaada kuhusu tatizo lako.')}
    `,

    tracker: () => `
      ${title('ti-list-check', '#f5a623', 'Error Tracker', 'Fuatilia matatizo yote na hali yake')}
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          Hapa unaona orodha ya matatizo yote uliyoyaripoti na hali yake ya sasa. Unaweza kuchuja kwa hali (status) na kutafuta kwa jina.
        </div>
      </div>

      ${section('Hali za Tatizo (Status)', `
        <strong style="color:var(--red)">Open</strong> — Tatizo limepokelewa lakini bado hakuna aliyeanza kulifanyia kazi<br>
        <strong style="color:var(--amber)">In Progress</strong> — Mhandisi analifanyia kazi sasa hivi<br>
        <strong style="color:var(--purple)">Escalated</strong> — Limeongezwa kwa timu ya juu kwa kuwa ni gumu<br>
        <strong style="color:var(--green)">Resolved</strong> — Tatizo limetatuliwa
      `)}

      ${section('Unaweza Kufanya Nini', `
        <strong>Bonyeza mstari wowote</strong> — Kuona maelezo kamili ya tatizo<br>
        <strong>Mark Resolved</strong> — Kama tatizo limeisha, weka kuwa limetatuliwa<br>
        <strong>Export</strong> — Pakua orodha kama CSV kwa ajili ya ripoti za shule
      `)}

      ${tip('Kama tatizo liko "Open" kwa zaidi ya masaa 4 bila maendeleo, nenda Follow-Up Center na bonyeza Escalate.')}
    `,

    followup: () => `
      ${title('ti-headset', '#9b7dff', 'Follow-Up Center', 'Mawasiliano na timu ya msaada')}
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          Huu ni ukurasa wa kufuatilia matatizo yanayochelewa (SLA breach), kuona timu ya msaada inafanya nini, na kusoma maelezo (notes) kuhusu matatizo yako.
        </div>
      </div>

      ${section('Sehemu Tatu', `
        <strong style="color:var(--red)">SLA Breaches</strong> — Matatizo yaliyopitisha muda wa kutatuliwa. Yanahitaji msaada wa haraka.<br>
        <strong>Team Status</strong> — Orodha ya wahandisi wa msaada na hali yao (active, onsite, remote)<br>
        <strong>Communication Log</strong> — Maelezo na ujumbe kuhusu matatizo yako
      `)}

      ${section('Hatua Unazoweza Kuchukua', `
        <strong>View</strong> — Ona maelezo kamili ya tatizo<br>
        <strong>Escalate</strong> — Pandisha tatizo kwa timu ya juu kama linachelewa<br>
        <strong>Resolve</strong> — Weka kuwa limetatuliwa kama tayari limekwisha
      `)}

      ${tip('SLA ni muda wa juu ambao timu ya msaada inapaswa kutatua tatizo. Ikipitisha muda huo, tatizo linaonyeshwa hapa kwa rangi nyekundu.')}
    `,

    weekly: () => `
      ${title('ti-calendar-week', '#36d9cc', 'Weekly Check-Ins', 'Ripoti ya hali ya vifaa kila wiki')}
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          Kila wiki, shule yako inatakiwa kutuma ripoti fupi kuhusu hali ya mtandao, tablets, programu, na umeme. Hii inasaidia timu ya msaada kujua hali kabla matatizo hayajawa makubwa.
        </div>
      </div>

      ${section('Jinsi ya Kujaza', `
        1. Chagua wiki sahihi (W1 hadi W10) kwenye tabs za juu<br>
        2. Tafuta shule yako kwenye jedwali<br>
        3. Bonyeza <strong>Check-In</strong> kama imeandikwa "Due"<br>
        4. Jaza hali ya kila eneo: Connectivity, Tablets, Platform, Power<br>
        5. Chagua hali ya jumla: Green (sawa), Amber (matatizo madogo), Red (dharura)<br>
        6. Ongeza maelezo kama yapo<br>
        7. Bonyeza <strong>Submit Check-In</strong>
      `)}

      ${section('Maana ya Rangi', `
        <strong style="color:var(--green)">Green</strong> — Kila kitu kinafanya kazi vizuri<br>
        <strong style="color:var(--amber)">Amber</strong> — Kuna matatizo madogo lakini shule inaendelea<br>
        <strong style="color:var(--red)">Red</strong> — Kuna matatizo makubwa yanayoathiri ufundishaji
      `)}

      ${tip('Jaza ripoti mapema mwanzoni mwa wiki (Jumatatu au Jumanne). Hii inatoa muda wa timu kutatua matatizo kabla hayajazidi.')}
    `,

    schools: () => `
      ${title('ti-school', '#2dd98a', 'School Profiles', 'Taarifa za shule yako')}
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          Hapa unaona taarifa za shule yako: mawasiliano, idadi ya wanafunzi, vifaa vilivyopo, na historia ya matatizo yaliyopita.
        </div>
      </div>

      ${section('Unaona Nini', `
        <strong>Overview</strong> — Jina la shule, eneo, mawasiliano, idadi ya wanafunzi<br>
        <strong>Equipment</strong> — Tablets, router, na vifaa vingine vilivyopewa shule<br>
        <strong>Error History</strong> — Orodha ya matatizo yote yaliyowahi kuripotiwa<br>
        <strong>Check-In History</strong> — Ripoti za wiki zilizopita
      `)}

      ${tip('Kama taarifa za shule yako si sahihi (namba ya simu, idadi ya tablets, nk), wasiliana na System Administrator kurekebisha.')}
    `,

    troubleshoot: () => `
      ${title('ti-tools', '#f5a623', 'Troubleshooting', 'Tatua matatizo ya kawaida mwenyewe')}
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          Kabla ya ku-report tatizo, angalia hapa kwanza. Kuna miongozo ya hatua kwa hatua ya kutatua matatizo ya kawaida kama mtandao kukatika, tablet isiyocharge, nk.
        </div>
      </div>

      ${section('Jinsi ya Kutumia', `
        1. Tafuta mwongozo kwa aina (Connectivity, Hardware, nk) au andika kwenye search<br>
        2. Bonyeza kadi ya mwongozo kufungua hatua zake<br>
        3. Fuata kila hatua kwa mpangilio, ukitia alama ukimaliza<br>
        4. Kama tatizo limeisha — huhitaji ku-report!<br>
        5. Kama bado — bonyeza <strong>Escalate Issue</strong> kutuma ripoti
      `)}

      ${section('Aina za Matatizo (Categories)', `
        <strong>Connectivity</strong> — WiFi imekatika, mtandao ni polepole, website haifunguki<br>
        <strong>Hardware</strong> — Tablet haicharge, skrini imevunjika, projector haifanyi kazi<br>
        <strong>Platform</strong> — App inacrash, haiwezi ku-login, content haipakui<br>
        <strong>Power</strong> — Umeme umekatika, UPS haifanyi kazi<br>
        <strong>Accounts</strong> — Nimesahau password, akaunti imefungwa
      `)}

      ${tip('Maendeleo yako yanahifadhiwa. Ukitoka na kurudi, mfumo unakumbuka hatua ulizokwisha maliza.')}
    `,

    manuals: () => `
      ${title('ti-books', '#9b7dff', 'Resource Library', 'Nyaraka, miongozo, na vifaa vya mafunzo')}
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          Hapa unapata manuals, nyaraka za mafunzo, na miongozo mingine muhimu. Unaweza kusoma ndani ya browser au kupakua kwenye simu/kompyuta yako.
        </div>
      </div>

      ${section('Unaweza Kufanya Nini', `
        <strong>Browse</strong> — Angalia nyaraka zote zinazopatikana<br>
        <strong>Filter</strong> — Chuja kwa aina (General, Training, Technical, Policy)<br>
        <strong>Preview</strong> — Angalia picha, video, na PDF ndani ya browser<br>
        <strong>Download</strong> — Pakua faili kwenye kifaa chako
      `)}

      ${section('Aina za Faili Zinazokubalika', `
        <strong>Nyaraka:</strong> PDF, Word, PowerPoint, Excel<br>
        <strong>Picha:</strong> PNG, JPG, GIF<br>
        <strong>Video:</strong> MP4, WebM<br>
        <strong>Sauti:</strong> MP3, WAV
      `)}

      ${tip('Ni Administrators pekee wanaoweza kupakia nyaraka mpya. Ukihitaji nyaraka ambayo haipo, omba timu ya msaada iiweke.')}
    `,

    account: () => `
      ${title('ti-user-circle', '#36d9cc', 'My Account', 'Simamia akaunti yako na usalama')}
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          Bonyeza picha yako ya profile (kona ya juu kulia) kupata chaguzi za akaunti.
        </div>
      </div>

      ${section('Chaguzi za Profile', `
        <strong>My Profile</strong> — Ona taarifa zako (jina, email, namba, eneo)<br>
        <strong>Change Password</strong> — Badilisha nenosiri lako<br>
        <strong>Sign Out</strong> — Toka kwenye mfumo kwa usalama
      `)}

      ${section('Kubadilisha Nenosiri', `
        1. Bonyeza picha yako ya profile (kona ya juu kulia)<br>
        2. Chagua "Change Password"<br>
        3. Andika nenosiri lako la sasa<br>
        4. Andika nenosiri jipya (angalau herufi 6)<br>
        5. Rudia nenosiri jipya<br>
        6. Bonyeza "Update Password"
      `)}

      ${section('Usalama', `
        <strong>Session Timeout</strong> — Mfumo unakutoa nje baada ya <strong>dakika 15</strong> za kutofanya kitu chochote. Hii inazuia mtu mwingine kutumia akaunti yako.<br><br>
        <strong>Ushauri:</strong> Tumia nenosiri gumu (herufi, nambari, na alama). Usimwambie mtu mwingine nenosiri lako. Bonyeza Sign Out ukimaliza, hasa kwenye kompyuta ya pamoja.
      `)}
    `,
  };

  return { load, render, setSection };
})();
