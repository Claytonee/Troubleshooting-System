/**
 * Field Engineer Guide — Sub-Admin Documentation
 * Explains each feature from the field engineer's perspective
 */
const FieldGuidePage = (() => {
  let activeSection = 'overview';

  function load() { return Promise.resolve(); }

  const sections = [
    { id: 'overview', icon: 'ti-home', title: 'Getting Started', color: '#4f7cff' },
    { id: 'dashboard', icon: 'ti-layout-dashboard', title: 'Dashboard', color: '#4f7cff' },
    { id: 'tracker', icon: 'ti-list-check', title: 'Error Tracker', color: '#ff5263' },
    { id: 'followup', icon: 'ti-headset', title: 'Follow-Up Center', color: '#9b7dff' },
    { id: 'weekly', icon: 'ti-calendar-week', title: 'Weekly Check-Ins', color: '#36d9cc' },
    { id: 'schools', icon: 'ti-school', title: 'School Profiles', color: '#2dd98a' },
    { id: 'troubleshoot', icon: 'ti-tools', title: 'Troubleshooting', color: '#f5a623' },
    { id: 'manuals', icon: 'ti-books', title: 'Resource Library', color: '#9b7dff' },
    { id: 'inventory', icon: 'ti-device-tablet', title: 'Tablet Inventory', color: '#36d9cc' },
    { id: 'account', icon: 'ti-user-circle', title: 'My Account', color: '#f5a623' },
  ];

  function setSection(id) {
    activeSection = id;
    const contentEl = document.getElementById('fg-content');
    const navEl = document.getElementById('fg-nav');
    if (contentEl && navEl) {
      contentEl.innerHTML = getContent(id);
      navEl.innerHTML = buildNav();
      contentEl.querySelectorAll('.card').forEach(el => el.classList.add('reveal', 'visible'));
    } else {
      App.render();
    }
  }

  function buildNav() {
    return sections.map(s => {
      const active = activeSection === s.id;
      return `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:${active ? '600' : '400'};transition:all .15s;background:${active ? s.color + '15' : 'transparent'};color:${active ? s.color : 'var(--text2)'};border-left:3px solid ${active ? s.color : 'transparent'}" onclick="FieldGuidePage.setSection('${s.id}')">
        <i class="ti ${s.icon}" style="font-size:15px"></i>${s.title}
      </div>`;
    }).join('');
  }

  function render() {
    return `
    <div class="section-header">
      <div>
        <div class="section-title">Field Engineer Guide</div>
        <div class="section-sub">Mwongozo wa Matumizi &mdash; Field Engineer</div>
      </div>
    </div>
    <div class="help-layout">
      <div id="fg-nav" class="card help-nav" style="position:sticky;top:76px;padding:10px 8px">
        ${buildNav()}
      </div>
      <div id="fg-content">
        ${getContent(activeSection)}
      </div>
    </div>`;
  }

  function getContent(id) {
    const c = content[id];
    return c ? c() : '<div class="empty"><i class="ti ti-file-search"></i>Section not found</div>';
  }

  function hdr(icon, color, name, meaning) {
    return `<div class="card" style="padding:18px;margin-bottom:14px;border-left:3px solid ${color}">
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

  function sec(heading, body) {
    return `<div class="card" style="padding:16px;margin-bottom:12px">
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
      ${hdr('ti-home', '#4f7cff', 'Getting Started', 'Karibu — Mwongozo wa Field Engineer')}
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          Wewe ni Field Engineer — mtu wa msaada wa kiufundi kwenye shule zilizopewa. Kazi yako kuu ni kupokea errors zinazotumwa na shule, kuzishughulikia (kwenda site au remote), na kuhakikisha shule zinafanya kazi vizuri kiufundi.
        </div>
      </div>

      <div class="card" style="padding:16px;margin-bottom:12px">
        <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:10px">Features Zako</div>
        <div class="help-features-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
          <div style="background:var(--bg3);border-radius:6px;padding:10px 12px"><strong>Dashboard</strong> — Queue yako, SLA, performance</div>
          <div style="background:var(--bg3);border-radius:6px;padding:10px 12px"><strong>Error Tracker</strong> — Errors zote za schools zako</div>
          <div style="background:var(--bg3);border-radius:6px;padding:10px 12px"><strong>Follow-Up Center</strong> — SLA breaches, escalations</div>
          <div style="background:var(--bg3);border-radius:6px;padding:10px 12px"><strong>Weekly Check-Ins</strong> — Ripoti ya kila wiki</div>
          <div style="background:var(--bg3);border-radius:6px;padding:10px 12px"><strong>School Profiles</strong> — Taarifa za shule zako</div>
          <div style="background:var(--bg3);border-radius:6px;padding:10px 12px"><strong>Troubleshooting</strong> — Miongozo ya kutatua</div>
          <div style="background:var(--bg3);border-radius:6px;padding:10px 12px"><strong>Resource Library</strong> — Manuals na documents</div>
          <div style="background:var(--bg3);border-radius:6px;padding:10px 12px"><strong>Tablet Inventory</strong> — Simamia tablets</div>
        </div>
      </div>

      ${sec('Workflow Yako ya Kila Siku', `
        1. Fungua <strong>Dashboard</strong> — angalia errors mpya kwenye queue yako<br>
        2. Shughulikia errors kulingana na <strong>priority</strong> (critical kwanza)<br>
        3. Tumia <strong>Troubleshooting guides</strong> kama unahitaji steps<br>
        4. Update error status ukiendelea kushughulikia<br>
        5. Mark <strong>Resolved</strong> ukimaliza<br>
        6. Fanya <strong>Weekly Check-In</strong> kwa kila school yako
      `)}

      ${tip('Password yako ya mwanzo ni <strong>changeme123</strong> — ibadilishe mara ya kwanza unavyoingia kwa usalama wako.')}
    `,

    dashboard: () => `
      ${hdr('ti-layout-dashboard', '#4f7cff', 'Dashboard', 'Command center yako binafsi — hali ya kazi kwa mtazamo mmoja')}
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          Dashboard inaonyesha kila kitu muhimu kwako: errors zilizo kwenye queue yako, SLA performance, schools zako, na activity ya hivi karibuni.
        </div>
      </div>

      ${sec('Performance Metrics (Juu)', `
        <strong style="color:var(--green)">SLA Compliance Ring</strong> — Asilimia ya errors ulizo-resolve ndani ya muda (SLA). Jitahidi kuwa 80%+<br>
        <strong style="color:var(--green)">Resolved</strong> — Idadi ya errors ulizo-resolve wiki hii na jumla yote<br>
        <strong style="color:var(--purple)">Check-Ins</strong> — Asilimia ya shule ulizotembelea/check-in wiki hii
      `)}

      ${sec('My Queue (Katikati)', `
        Hizi ni errors zilizo-assigned kwako moja kwa moja. Zinaonyeshwa kwa mpangilio wa dharura:<br><br>
        <strong style="color:var(--red)">Mstari mwekundu</strong> — Critical priority<br>
        <strong style="color:var(--amber)">Mstari wa machungwa</strong> — High priority<br>
        <strong style="color:var(--accent)">Mstari wa bluu</strong> — Medium priority<br>
        <strong style="color:var(--green)">Mstari wa kijani</strong> — Low priority<br><br>
        Kila card inaonyesha SLA countdown — muda uliobaki kabla ya breach. Bonyeza card kufungua error detail.
      `)}

      ${sec('My Schools + Recent Activity (Kulia)', `
        <strong>My Schools</strong> — Schools zako na health status (kijani=sawa, machungwa=matatizo, nyekundu=dharura)<br>
        <strong>Recent Activity</strong> — Updates za hivi karibuni kwenye errors zako (admin notes, status changes)
      `)}

      ${tip('Kama error ina tag <strong style="color:var(--red)">OVERDUE</strong>, maana yake SLA imepitwa — shughulikia haraka iwezekanavyo!')}
    `,

    tracker: () => `
      ${hdr('ti-list-check', '#ff5263', 'Error Tracker', 'Orodha kamili ya errors za schools zako na zilizo-assigned kwako')}
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          Error Tracker inaonyesha errors ZOTE — sio tu zile kwenye queue yako (dashboard), bali errors zote za schools zilizopewa kwako. Ni register kamili ya matatizo.
        </div>
      </div>

      ${sec('Tofauti na Dashboard', `
        <strong>Dashboard "My Queue"</strong> — Errors assigned <em>kwako moja kwa moja</em> (unazoshughulikia wewe)<br>
        <strong>Error Tracker</strong> — Errors ZOTE za schools zako (including zile zisizo-assigned kwako, au zilizo-resolved)
      `)}

      ${sec('Filters na Search', `
        <strong>Status</strong> — Open, In Progress, Escalated, Resolved<br>
        <strong>Priority</strong> — Critical, High, Medium, Low<br>
        <strong>Category</strong> — Connectivity, Hardware, Platform, Power, Accounts<br>
        <strong>Search</strong> — Tafuta kwa title, error code, au jina la shule
      `)}

      ${sec('Unaweza Kufanya Nini', `
        <strong>Bonyeza error</strong> — Fungua maelezo kamili (Error Detail modal)<br>
        <strong>Mark Resolved</strong> — Weka error kuwa imetatuliwa<br>
        <strong>Add Update</strong> — Ongeza note (mfano: "Parts ordered, waiting 2 days")<br>
        <strong>Export CSV</strong> — Pakua orodha kama spreadsheet kwa ripoti
      `)}

      ${sec('Hali za Error (Status Flow)', `
        <strong style="color:var(--red)">Open</strong> → School iliripoti, hakuna aliyeanza<br>
        <strong style="color:var(--amber)">In Progress</strong> → Admin amekuassign, unafanyia kazi<br>
        <strong style="color:var(--purple)">Escalated</strong> → Ilipandishwa kwa OE platform team<br>
        <strong style="color:var(--green)">Resolved</strong> → Imetatuliwa, school itapata CSAT survey
      `)}

      ${tip('Export CSV ni muhimu kwa monthly reports. Unaweza filter kwanza (mfano: resolved, mwezi huu) kisha export.')}
    `,

    followup: () => `
      ${hdr('ti-headset', '#9b7dff', 'Follow-Up Center', 'SLA monitoring, escalations, na communications')}
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          Follow-Up Center inakusaidia kufuatilia errors zenye SLA breach (zimechelewa), kuona escalations, na kujua ni nini kinaendelea kwenye kila error.
        </div>
      </div>

      ${sec('SLA Targets (Muda wa Juu)', `
        <strong style="color:var(--red)">Critical</strong> — Lazima i-resolve ndani ya <strong>masaa 2</strong><br>
        <strong style="color:var(--amber)">High</strong> — Lazima i-resolve ndani ya <strong>masaa 8</strong><br>
        <strong style="color:var(--accent)">Medium</strong> — Lazima i-resolve ndani ya <strong>masaa 24</strong><br>
        <strong style="color:var(--green)">Low</strong> — Lazima i-resolve ndani ya <strong>masaa 72</strong><br><br>
        Muda ukipita, error inakuwa "SLA Breached" na inaonyeshwa kwa rangi nyekundu.
      `)}

      ${sec('Sehemu za Ukurasa', `
        <strong style="color:var(--red)">SLA Breaches</strong> — Errors zilizopitisha deadline. Hizi ndizo za kwanza kushughulikiwa!<br>
        <strong>Escalations</strong> — Errors zilizopandishwa kwa OE platform team<br>
        <strong>Communication Log</strong> — Notes na updates zote kwa mpangilio wa wakati
      `)}

      ${tip('SLA compliance yako inaonyeshwa kwenye Dashboard. Jitahidi ku-resolve errors kabla ya deadline ili performance yako ibaki juu ya 80%.')}
    `,

    weekly: () => `
      ${hdr('ti-calendar-week', '#36d9cc', 'Weekly Check-Ins', 'Ripoti ya hali ya kiufundi kwa kila shule — kila wiki')}
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          Kila wiki unapaswa ku-check-in kwa kila school iliyopewa. Check-in ni ripoti fupi ya hali ya kiufundi — haina haja ya kwenda site kila mara, unaweza piga simu au WhatsApp na kujaza.
        </div>
      </div>

      ${sec('Jinsi ya Kufanya Check-In', `
        1. Chagua <strong>wiki</strong> sahihi kwenye tabs za juu (W1-W52)<br>
        2. Tafuta school yako — ikisema "Due" maana bado haujafanya<br>
        3. Bonyeza <strong>Check-In</strong><br>
        4. Jaza hali ya kila eneo: Connectivity, Tablets, Platform, Power<br>
        5. Chagua hali ya jumla: <strong style="color:var(--green)">Green</strong> / <strong style="color:var(--amber)">Amber</strong> / <strong style="color:var(--red)">Red</strong><br>
        6. Ongeza maelezo kama yapo (mfano: "Router replaced yesterday")<br>
        7. Bonyeza <strong>Submit</strong>
      `)}

      ${sec('Nini cha Kuangalia', `
        <strong>Connectivity</strong> — WiFi inafanya kazi? Mtandao una speed nzuri?<br>
        <strong>Tablets</strong> — Zote zinacharge? Content ina-download? Skrini ziko sawa?<br>
        <strong>Platform</strong> — Apps zinafunguka? Students wana-login? Content up-to-date?<br>
        <strong>Power</strong> — Umeme stable? UPS inafanya kazi? Charging stations okay?
      `)}

      ${tip('Check-in inafanywa kila wiki (ideally Jumatatu/Jumanne). Admin anaona progress yako — 100% coverage = excellent performance.')}
    `,

    schools: () => `
      ${hdr('ti-school', '#2dd98a', 'School Profiles', 'Taarifa kamili za kila school iliyopewa kwako')}
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          Hapa unaona maelezo ya kila school unayoisimamia — contact info, vifaa, error history, na check-in history. Ni reference yako kabla ya site visit au phone call.
        </div>
      </div>

      ${sec('Unaona Nini kwa Kila School', `
        <strong>Overview</strong> — Jina, eneo (zone), contact person, namba ya simu<br>
        <strong>IT Coordinator</strong> — Mtu wa kuwasiliana naye kuhusu vifaa<br>
        <strong>Equipment</strong> — Idadi ya tablets, router model, vifaa vingine<br>
        <strong>Error History</strong> — Matatizo yote yaliyowahi kuripotiwa (na status)<br>
        <strong>Check-In History</strong> — Ripoti zako za wiki zilizopita
      `)}

      ${sec('Health Status (Rangi)', `
        <strong style="color:var(--green)">Green dot</strong> — School haina errors wazi za critical/high — sawa<br>
        <strong style="color:var(--amber)">Amber dot</strong> — Kuna errors wazi lakini sio critical<br>
        <strong style="color:var(--red)">Red dot</strong> — Kuna errors za critical au high — inahitaji attention
      `)}

      ${tip('Kabla ya kwenda site, fungua School Profile kwanza — uone error history na contact info ili uwe prepared.')}
    `,

    troubleshoot: () => `
      ${hdr('ti-tools', '#f5a623', 'Troubleshooting Guides', 'Miongozo ya hatua kwa hatua kutatua matatizo ya kawaida')}
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          Knowledge base yako ya kiufundi. Guides hizi zinakupa steps za kufuata ukiwa site (au remote) kutatua matatizo ya kawaida bila kuomba msaada wa ziada.
        </div>
      </div>

      ${sec('Jinsi ya Kutumia', `
        1. Tafuta guide kwa <strong>category</strong> (Connectivity, Hardware, nk) au search<br>
        2. Bonyeza guide kufungua<br>
        3. Fuata kila step kwa mpangilio<br>
        4. Tia alama (check) kila step ukimaliza<br>
        5. Kama imetatuliwa — rudi Error Tracker na mark Resolved<br>
        6. Kama bado — bonyeza <strong>Escalate</strong> kupandisha kwa level ya juu
      `)}

      ${sec('Categories za Guides', `
        <strong>Connectivity</strong> — WiFi haifanyi kazi, mtandao polepole, DNS issues<br>
        <strong>Hardware</strong> — Tablet haiwashi, screen cracked, speaker/mic issues<br>
        <strong>Platform</strong> — App crash, login failed, content sync issues<br>
        <strong>Power</strong> — No electricity, UPS beeping, charging issues<br>
        <strong>Accounts</strong> — Password reset, locked accounts, new user setup
      `)}

      ${sec('Progress Tracking', `
        Mfumo unakumbuka steps ulizokwisha fanya. Ukiondoka na kurudi baadaye, utaendelea pale ulipoacha — hauanzi upya.
      `)}

      ${tip('Kila guide ina estimated time na difficulty level. Anza na "Easy" guides kama ni issue ya kawaida, escalate kama ni "Advanced" na hufanyi kazi.')}
    `,

    manuals: () => `
      ${hdr('ti-books', '#9b7dff', 'Resource Library', 'Manuals, training documents, na reference materials')}
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          Hapa unapata nyaraka zote za kiufundi — tablet setup guides, network configuration manuals, training videos, na policy documents. Download au preview ndani ya browser.
        </div>
      </div>

      ${sec('Aina za Resources', `
        <strong>General</strong> — Policies, SOPs, organizational documents<br>
        <strong>Training</strong> — Mafunzo ya vifaa, procedures za site visit<br>
        <strong>Technical</strong> — Configuration guides, troubleshooting manuals, specs<br>
        <strong>Policy</strong> — Security policies, data handling, escalation procedures
      `)}

      ${sec('Unaweza Kufanya Nini', `
        <strong>Browse</strong> — Angalia nyaraka zote<br>
        <strong>Filter by category</strong> — Chuja kulingana na aina<br>
        <strong>Search</strong> — Tafuta kwa jina la document<br>
        <strong>Preview</strong> — Picha, video, PDF zinaonekana ndani ya browser<br>
        <strong>Download</strong> — Pakua kwenye simu/laptop yako kwa matumizi offline
      `)}

      ${tip('Download manuals muhimu KABLA ya kwenda site — mtandao wa shule unaweza kuwa down ndiyo sababu ya visit yako!')}
    `,

    inventory: () => `
      ${hdr('ti-device-tablet', '#36d9cc', 'Tablet Inventory', 'Simamia vifaa (tablets) vya schools zako')}
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          Tablet Inventory inakusaidia kufuatilia kila tablet iliyopo kwenye schools zako — ni nani anaishika, hali yake ikoje, serial number, na history ya matengenezo.
        </div>
      </div>

      ${sec('Unaona Nini', `
        <strong>Stats</strong> — Total tablets, active, in repair, lost/stolen<br>
        <strong>Table</strong> — Orodha ya tablets zote na details<br>
        <strong>Filters</strong> — Filter by school, status, au search by asset tag/serial
      `)}

      ${sec('Unaweza Kufanya Nini', `
        <strong>View Device</strong> — Bonyeza tablet kuona maelezo kamili (serial, model, student, history)<br>
        <strong>Change Status</strong> — Mark as Active, In Repair, Lost, Decommissioned<br>
        <strong>Assign/Unassign</strong> — Pea mwanafunzi au ondoa<br>
        <strong>Add Device</strong> — Sajili tablet mpya kwenye mfumo<br>
        <strong>Export CSV</strong> — Pakua orodha kwa inventory audit
      `)}

      ${sec('Status za Tablet', `
        <strong style="color:var(--green)">Active</strong> — Inafanya kazi na ipo kwa mwanafunzi<br>
        <strong style="color:var(--amber)">In Repair</strong> — Imeharibika na inasubiri kutengenezwa<br>
        <strong style="color:var(--red)">Lost/Stolen</strong> — Imepotea au kuibwa<br>
        <strong style="color:var(--text3)">Decommissioned</strong> — Imetolewa kwenye huduma (old/broken beyond repair)
      `)}

      ${tip('Ukienda site, check tablets kwa physical count na compare na system. Kama idadi hailingani, update mfumo papo hapo.')}
    `,

    account: () => `
      ${hdr('ti-user-circle', '#f5a623', 'My Account', 'Profile yako, password, na usalama')}
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          Simamia taarifa zako binafsi na usalama wa akaunti yako. Bonyeza avatar yako (kona ya juu kulia) kuona chaguzi.
        </div>
      </div>

      ${sec('Chaguzi za Profile', `
        <strong>My Profile</strong> — Jina, email, namba ya simu, zone/region<br>
        <strong>Change Password</strong> — Badilisha nenosiri<br>
        <strong>Sign Out</strong> — Toka kwa usalama
      `)}

      ${sec('Password ya Mwanzo', `
        Akaunti yako iliundwa na System Administrator. Password yako ya mwanzo ni <strong>changeme123</strong> (isipokuwa admin alikupa nyingine).<br><br>
        <strong style="color:var(--red)">MUHIMU:</strong> Badilisha password mara ya kwanza unavyoingia! Nenda Profile → Change Password.
      `)}

      ${sec('Usalama', `
        <strong>Session Timeout</strong> — Mfumo unakutoa nje baada ya <strong>dakika 15</strong> za kutofanya kitu. Hii ni kwa usalama.<br>
        <strong>Ushauri:</strong><br>
        • Tumia password ngumu (herufi + nambari + alama)<br>
        • Usimwambie mtu password yako<br>
        • Bonyeza Sign Out ukimaliza, hasa kwenye device ya pamoja<br>
        • Ukisahau password, omba admin afanye Reset Password
      `)}

      ${tip('Admin anaweza ku-reset password yako wakati wowote. Password mpya itakuwa "changeme123" kwa default — ibadilishe tena baada ya reset.')}
    `,
  };

  function afterRender() {
    const el = document.getElementById('fg-content');
    if (el) el.querySelectorAll('.card').forEach(c => { c.classList.add('reveal', 'visible'); });
  }

  return { load, render, afterRender, setSection };
})();
