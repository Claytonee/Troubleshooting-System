# Incident response runbook

Adopted 2026-09-24 (DECISIONS.md D17). It follows NIST SP 800-61r3, which maps incident response
onto CSF 2.0 (*Detect → Respond → Recover*), and Tanzania's Personal Data Protection Act s.27(5)
with GN 449C of 2023 for notification. **Not yet rehearsed:** the first tabletop exercise is due
within 30 days of adoption.

## Severity

| Level | Examples | Start within |
|---|---|---|
| **SEV-1** | Platform admin account compromised; personal data of several schools exposed; the deploy path abused; data destroyed | Immediately, any hour |
| **SEV-2** | One account compromised; one school's data exposed to another; a secret leaked; site defaced | Same working day |
| **SEV-3** | A pattern of probing with no confirmed access; malicious upload removed before use | Next working day |

## Roles

- **Incident lead:** the platform admin (security owner). Decides severity, containment and notification.
- **Technical responder:** the developer/maintainer. Collects evidence, contains, fixes.
- **Communications:** the incident lead, or someone they name. Only this person talks to schools, funders or the PDPC.

## The first hour

1. **Write down the time** and what was seen, by whom. Open an entry in the issue register (`INC-YYYYMMDD-n`).
2. **Preserve evidence before changing anything:** export the relevant `security_events` and `audit_log` rows (queries below). Download the hosting error log.
3. **Decide severity** from the table above.
4. **Contain** with the matching playbook below. Contain first, investigate after.
5. **Decide on personal data:** could personal data have been read, changed, lost or sent to the wrong person? If yes or unsure, start the PDPC clock (below).

## Containment playbooks

| Situation | Contain | Then |
|---|---|---|
| One account compromised | Suspend the account (takes effect on the next request). Reset its password. | Read its `security_events` and `audit_log` for the last 30 days; list every record it touched. |
| **Platform admin compromised** | Rotate `JWT_SECRET` in the hosting panel and restart. **This signs everyone out**; that is intended. Reset every admin password. | Review every admin action in `audit_log` since the suspected start. |
| Secret leaked (`WEBHOOK_SECRET`, `HEARTBEAT_KEY`, `WHATSAPP_APP_SECRET`, `PHONE_INTAKE_KEY`, Cloudinary, Bedrock) | Rotate it at the source and in the panel; restart the app. | Check `security_events` for `webhook.rejected` spikes before and after. |
| Cross-school exposure (a bug) | Remove the route or hide the page; deploy the fix. | List exactly which records were reachable, by whom, and when. That list decides PDPC notification. |
| Malicious upload | Delete the file from Cloudinary and its row from `error_attachments`. | Find who uploaded it (`uploaded_by`); treat that account as compromised. |
| Deploy path abused / site defaced | Reset the checkout to the last known good commit; rotate `WEBHOOK_SECRET`; restart. | Compare the server checkout against GitHub; check the `deploy/backups/` patches. |
| Data destroyed or corrupted | Stop writes if needed (maintenance mode or suspend accounts). | Restore by [RECOVERY.md](RECOVERY.md). |

## Evidence queries

```sql
-- Everything refused from one address in the last 7 days
SELECT occurred_at, last_at, event_type, user_id, role, path_template, status, count
  FROM security_events WHERE source_ip = ? AND occurred_at >= NOW() - INTERVAL 7 DAY ORDER BY occurred_at;

-- One account's refusals and sign-ins
SELECT occurred_at, event_type, source_ip, path_template, count
  FROM security_events WHERE user_id = ? ORDER BY occurred_at DESC LIMIT 500;

-- What that account changed
SELECT created_at, action, entity_type, entity_id, summary, ip
  FROM audit_log WHERE actor_id = ? ORDER BY created_at DESC LIMIT 500;
```

Events are kept for 90 days. Export them to a file at the start of an incident, before retention can delete them.

## Telling the Personal Data Protection Commission

- **The law:** PDPA s.27(5) requires the controller to inform the Commission of a breach
  "without undue delay"; the Act sets no fixed deadline. GN 449C of 2023 lists the contents.
- **Our rule (D17):** decide within **24 hours** of discovery whether personal data was affected.
  If it was, notify the PDPC within **72 hours** of that confirmation. The deadline is ours, set
  stricter than the law.
- **Contents (GN 449C):** controller details; a summary of the breach and its assessment; root
  cause; measures taken; areas for improvement; supporting documents; a declaration by the controller.
- **People affected:** the Act does not require telling them. We tell them when the breach is
  likely to harm them, because a head teacher who hears it from us keeps trusting us.
- **Processors** (Cloudinary, AWS, Meta, Africa's Talking, the host) must tell us promptly. If
  they report a breach, the clock starts when we hear.

## Closing an incident

An incident is closed only when all of these are true: containment is confirmed, the root cause is fixed with a regression test, notification is done or recorded as not required with its reason, and a short review is written into the issue register (what happened, what helped, what changes).

## Rehearsal

A **tabletop exercise** every quarter, about 45 minutes, walking one scenario through this page:
1. A field engineer's phone is stolen with the app signed in.
2. `WEBHOOK_SECRET` is found in a screenshot posted to a WhatsApp group.
3. A school admin reports seeing another school's faults.
4. The database is lost; restore from the latest backup.

Record the date, who took part and what this page got wrong. Then fix the page.
