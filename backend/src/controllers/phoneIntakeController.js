/**
 * USSD and SMS intake — the floor under every other channel.
 * Design: docs/features/08-phone-intake.md
 *
 * The web form, the PWA and WhatsApp all need data. WhatsApp needs a smartphone
 * as well. A teacher whose bundle ran out, or who carries a feature phone, had
 * no way to reach this system at all — and a fault nobody can report appears in
 * no metric, which is why the gap survived a year.
 *
 * USSD needs no internet, works on every handset sold in Tanzania, and everyone
 * already knows the interaction from mobile money. Africa's Talking provisions
 * the shortcode on Vodacom and Airtel Tanzania and is already this system's SMS
 * vendor.
 *
 * Authentication: Africa's Talking does not sign its callbacks, so the callback
 * URL carries a shared secret (`?key=`) configured in their dashboard. Unset, we
 * refuse — the same fail-closed rule as the deploy webhook and the heartbeat.
 */
const pool = require('../config/database');
const intake = require('../services/intake');
const sms = require('../services/sms');
const { logAudit } = require('../services/audit');
const { targetHours } = require('../services/sla');

const CALLBACK_KEY = () => process.env.PHONE_INTAKE_KEY || '';

/**
 * The categories a caller can pick, in the order a Tanzanian teacher meets them.
 * Swahili first: this is the channel for people who are not sitting at a
 * browser, and the browser is the only place English is unavoidable.
 */
const MENU_CATEGORIES = [
  { key: '1', label: 'Intaneti/WiFi', category: 'Connectivity' },
  { key: '2', label: 'Tablet/Kifaa', category: 'Hardware' },
  { key: '3', label: 'Quest', category: 'Platform' },
  { key: '4', label: 'Umeme', category: 'Power' },
  { key: '5', label: 'Akaunti', category: 'Accounts' },
  { key: '6', label: 'Nyingine', category: 'Other' }
];

/**
 * Scale, not severity. A caller cannot judge "critical"; they can judge whether
 * the whole school, one class, or one device is affected — and that maps onto
 * the SLA honestly.
 */
const MENU_SCOPE = [
  { key: '1', label: 'Shule nzima', priority: 'critical', en: 'whole school affected' },
  { key: '2', label: 'Darasa moja', priority: 'high', en: 'one class affected' },
  { key: '3', label: 'Kifaa kimoja', priority: 'medium', en: 'one device affected' }
];

const CON = (body) => 'CON ' + body;
const END = (body) => 'END ' + body;

/** Guard shared by both callbacks. Returns true when the request may proceed. */
function authorised(req, res) {
  const key = CALLBACK_KEY();
  if (!key) {
    console.error('[phone-intake] Rejected: PHONE_INTAKE_KEY is not set');
    res.status(503).type('text/plain').send('END Huduma hii bado haijawashwa. Tafadhali tumia simu ya msaada.');
    return false;
  }
  const given = req.query.key || req.headers['x-intake-key'];
  if (given !== key) {
    res.status(403).type('text/plain').send('END Ombi halikubaliki.');
    return false;
  }
  return true;
}

/**
 * Africa's Talking posts the whole input trail on every step, joined by `*`, so
 * the menu is a pure function of that string. No server-side session store, and
 * therefore nothing to expire, leak or clean up.
 */
function steps(text) {
  return String(text || '').split('*').filter(s => s !== '');
}

async function ussd(req, res) {
  if (!authorised(req, res)) return;
  const { sessionId, phoneNumber, text } = req.body || {};
  const trail = steps(text);
  res.type('text/plain');

  try {
    const who = await intake.resolveIdentity(phoneNumber);

    // ---- root menu --------------------------------------------------------
    if (trail.length === 0) {
      await recordSession(sessionId, phoneNumber, who, 'menu');
      return res.send(CON(
        'OE Msaada wa Vifaa\n' +
        '1. Ripoti hitilafu\n' +
        '2. Hali ya ripoti zangu\n' +
        '3. Namba ya msaada'
      ));
    }

    // ---- 3. support number ------------------------------------------------
    if (trail[0] === '3') {
      const [rows] = await pool.query("SELECT value FROM settings WHERE `key` = 'support_phone' LIMIT 1");
      const number = (rows[0] && rows[0].value) || process.env.SUPPORT_PHONE || '';
      await recordSession(sessionId, phoneNumber, who, 'support_number');
      return res.send(END(number
        ? `Msaada: ${number}\nAu piga *149*00# kuripoti.`
        : 'Namba ya msaada haijawekwa. Tumia menyu 1 kuripoti hitilafu.'));
    }

    // ---- 2. my reports ----------------------------------------------------
    if (trail[0] === '2') {
      // A phone number is not authentication. An unrecognised number may file a
      // fault but may never read anything back, or the shortcode becomes a way
      // to enumerate another school's problems.
      if (!who.verified) {
        await recordSession(sessionId, phoneNumber, who, 'status_denied');
        return res.send(END('Namba yako haijasajiliwa. Mwambie msimamizi wa shule akusajili, kisha jaribu tena.'));
      }
      const [rows] = await pool.query(
        `SELECT error_code, status, priority FROM errors
          WHERE reported_by_user_id = ? OR reporter_contact = ?
          ORDER BY created_at DESC LIMIT 3`,
        [who.user_id, intake.normalizeTz(phoneNumber)]
      );
      await recordSession(sessionId, phoneNumber, who, 'status');
      if (!rows.length) return res.send(END('Huna ripoti yoyote kwa sasa.'));
      const lines = rows.map(r => `${r.error_code}: ${statusSw(r.status)}`).join('\n');
      return res.send(END('Ripoti zako:\n' + lines));
    }

    // ---- 1. report a fault ------------------------------------------------
    if (trail[0] === '1') {
      // An unrecognised number has to say which school, or the fault has nowhere
      // to go. A recognised one skips this step entirely.
      const needsSchool = !who.school_id;
      const offset = needsSchool ? 1 : 0;

      if (needsSchool && trail.length === 1) {
        return res.send(CON('Andika CODE ya shule yako\n(mfano: mtakuja)'));
      }

      let school = null;
      if (needsSchool) {
        school = await intake.schoolByCode(trail[1]);
        if (!school) {
          await recordSession(sessionId, phoneNumber, who, 'bad_school_code');
          return res.send(END('Code ya shule haipo. Uliza msimamizi wa shule, kisha jaribu tena.'));
        }
      } else {
        const [rows] = await pool.query('SELECT id, name, code, assigned_admin_id FROM schools WHERE id = ?', [who.school_id]);
        school = rows[0];
        if (!school) return res.send(END('Shule yako haipatikani kwenye mfumo. Piga simu ya msaada.'));
      }

      if (trail.length === 1 + offset) {
        return res.send(CON('Tatizo ni lipi?\n' + MENU_CATEGORIES.map(c => `${c.key}. ${c.label}`).join('\n')));
      }

      const chosen = MENU_CATEGORIES.find(c => c.key === trail[1 + offset]);
      if (!chosen) return res.send(END('Chaguo si sahihi. Piga tena.'));

      if (trail.length === 2 + offset) {
        return res.send(CON('Limeathiri nini?\n' + MENU_SCOPE.map(s => `${s.key}. ${s.label}`).join('\n')));
      }

      const scope = MENU_SCOPE.find(s => s.key === trail[2 + offset]);
      if (!scope) return res.send(END('Chaguo si sahihi. Piga tena.'));

      // One free-text step, optional. Typing on a feature phone is slow, so it
      // is the last thing asked and "0" skips it.
      if (trail.length === 3 + offset) {
        return res.send(CON('Eleza kwa ufupi (au andika 0 kuruka):'));
      }

      const note = trail[3 + offset] === '0' ? '' : String(trail[3 + offset] || '').trim();
      const filed = await fileFault({
        school,
        who,
        phone: phoneNumber,
        category: chosen.category,
        priority: scope.priority,
        note,
        scopeEn: scope.en,
        channel: 'ussd'
      });

      await recordSession(sessionId, phoneNumber, who, 'filed', filed.errorId);
      return res.send(END(
        `Imepokelewa. Namba: ${filed.errorCode}\n` +
        `${school.name}\n` +
        (filed.routedTo === 'engineer'
          ? 'Fundi amearifiwa.'
          : 'Msimamizi wa shule amearifiwa.') +
        '\nAsante.'
      ));
    }

    return res.send(END('Chaguo si sahihi. Piga tena.'));
  } catch (err) {
    console.error('[ussd] failed:', err.message);
    // Never leave a caller staring at a dead session: they paid for the call.
    return res.send(END('Samahani, kuna hitilafu ya mfumo. Jaribu tena baadaye au piga simu ya msaada.'));
  }
}

/**
 * Inbound SMS. Africa's Talking POSTs `from`, `to`, `text`, `date`, `id`.
 *
 * Deliberately keyword-light: a teacher in a hurry writes what is wrong, not a
 * command. Anything that is not STATUS or MSAADA is treated as a fault report,
 * classified by the same rules the other channels use.
 */
async function smsInbound(req, res) {
  if (!authorised(req, res)) return;
  const from = req.body.from || req.body.From || '';
  const body = String(req.body.text || req.body.Text || '').trim();
  // Reply 200 immediately: the vendor retries on anything else, and a retry
  // would file the fault twice.
  res.status(200).json({ received: true });

  if (!body) return;
  try {
    const who = await intake.resolveIdentity(from);
    const word = body.split(/\s+/)[0].toUpperCase();

    if (word === 'STATUS' || word === 'HALI') {
      if (!who.verified) return reply(from, 'Namba yako haijasajiliwa. Mwambie msimamizi wa shule akusajili.');
      const [rows] = await pool.query(
        `SELECT error_code, status FROM errors WHERE reported_by_user_id = ? OR reporter_contact = ?
          ORDER BY created_at DESC LIMIT 3`,
        [who.user_id, intake.normalizeTz(from)]
      );
      return reply(from, rows.length
        ? 'Ripoti zako: ' + rows.map(r => `${r.error_code} ${statusSw(r.status)}`).join('; ')
        : 'Huna ripoti yoyote kwa sasa.');
    }

    if (word === 'MSAADA' || word === 'HELP') {
      return reply(from, 'Tuma ujumbe unaoeleza tatizo, tutalifungulia namba. Andika STATUS kuona ripoti zako. Au piga *149*00#.');
    }

    // A fault. An unrecognised number must name its school, exactly as on USSD.
    let school = null;
    if (who.school_id) {
      const [rows] = await pool.query('SELECT id, name, code, assigned_admin_id FROM schools WHERE id = ?', [who.school_id]);
      school = rows[0];
    } else {
      // "mtakuja tablets hazichaji" — the first word may be the school code.
      school = await intake.schoolByCode(word);
    }
    if (!school) {
      return reply(from, 'Hatujui shule yako. Anza ujumbe na CODE ya shule, mfano: mtakuja tablet haichaji.');
    }

    const filed = await fileFault({
      school, who, phone: from,
      category: intake.guessCategory(body),
      priority: intake.guessPriority(body),
      note: body,
      channel: 'sms'
    });
    return reply(from, `Imepokelewa: ${filed.errorCode}. ` +
      (filed.routedTo === 'engineer' ? 'Fundi amearifiwa.' : 'Msimamizi wa shule amearifiwa.'));
  } catch (err) {
    console.error('[sms-in] failed:', err.message);
  }
}

// ---------------------------------------------------------------------------

/**
 * Files the fault. Routing comes from services/intake.js so this channel cannot
 * drift from the web form the way WhatsApp did.
 */
async function fileFault({ school, who, phone, category, priority, note, scopeEn, channel }) {
  const contact = intake.normalizeTz(phone);
  const description = [
    note || `Reported over ${channel.toUpperCase()} — no description given.`,
    scopeEn ? `Caller said: ${scopeEn}.` : '',
    `Channel: ${channel}. From: ${contact}.`
  ].filter(Boolean).join('\n');

  const title = intake.makeTitle(note, `${category} issue reported by ${channel.toUpperCase()}`);
  const route = intake.routeFor({
    reporterRole: who.verified ? who.role : null,
    priority,
    fieldEngineerId: school.assigned_admin_id
  });

  const errorCode = await intake.nextErrorCode();
  const [result] = await pool.query(
    `INSERT INTO errors
       (error_code, title, description, school_id, category, priority, status, assigned_to,
        reporter_name, reporter_role, reporter_contact, sla_due_at, escalation_level,
        reported_by_user_id, intake_channel)
     VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), ?, ?, ?)`,
    [errorCode, title, description, school.id, category, priority, route.assignedTo,
      who.name || `${channel.toUpperCase()} report`,
      who.verified ? channel : `${channel}-unverified`,
      contact, targetHours(priority), route.escalationLevel, who.user_id || null, channel]
  );

  if (route.notifySchoolAdmin) {
    await intake.notifySchoolAdmin({
      schoolId: school.id, errorId: result.insertId, errorCode, priority, category,
      reporterName: who.name || contact, critical: route.critical
    });
  }

  await logAudit({
    actor: { id: who.user_id || null, full_name: who.name || contact, role: who.verified ? channel : `${channel}-unverified` },
    action: 'error.created', entityType: 'error', entityId: result.insertId,
    summary: `${errorCode}: reported over ${channel.toUpperCase()} from ${contact}`,
    meta: { channel, school_id: school.id, priority, category }
  }).catch(e => console.error('[phone-intake] audit failed:', e.message));

  return {
    errorId: result.insertId,
    errorCode,
    routedTo: route.assignedTo ? 'engineer' : 'school_admin'
  };
}

/**
 * One row per USSD session.
 *
 * Not telemetry for its own sake: a session that reaches the menu and stops is
 * a fault somebody wanted to report and could not, and that is the number this
 * whole feature exists to move. Nothing here is worth failing a call over.
 */
async function recordSession(sessionId, phone, who, outcome, errorId) {
  try {
    await pool.query(
      `INSERT INTO ussd_sessions (session_id, phone, user_id, school_id, outcome, error_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE outcome = VALUES(outcome), error_id = VALUES(error_id), updated_at = NOW()`,
      [String(sessionId || '').slice(0, 100), intake.normalizeTz(phone), who.user_id || null,
        who.school_id || null, outcome, errorId || null]
    );
  } catch (e) {
    console.error('[ussd] session record failed:', e.message);
  }
}

function reply(to, message) {
  return sms.sendSms(to, message).catch(e => console.error('[sms-in] reply failed:', e.message));
}

/** Status words a caller understands, in their language. */
function statusSw(status) {
  return ({
    open: 'imepokelewa',
    progress: 'inafanyiwa kazi',
    escalated: 'imepelekwa juu',
    resolved: 'imetatuliwa'
  })[status] || status;
}

module.exports = {
  ussd,
  smsInbound,
  _internal: { steps, fileFault, statusSw, MENU_CATEGORIES, MENU_SCOPE }
};
