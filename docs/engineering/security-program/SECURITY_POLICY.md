# Security policy — Technical Support System

Adopted 2026-09-24 under the owner's delegation (DECISIONS.md D13). Reviewed every year and
whenever the system or the organisation changes materially. NIST CSF 2.0 *Govern*.

## 1. Scope

The Technical Support System at `support.mkatolikikiganjani.com`: its code, its database, its
hosting account, its integrations (Cloudinary, AWS Bedrock, Meta WhatsApp, Africa's Talking),
and everyone who holds an account on it.

## 2. Who is responsible for what

| Role | Responsibility |
|---|---|
| **Platform admin (head office)** | **Security owner.** Approves accounts, runs the quarterly access review, leads incidents, decides on PDPC notification, owns this policy. |
| Developer / maintainer | Keeps the controls working: verification suites green before every deploy, dependencies patched, secrets out of the repository. |
| Field engineer (sub-admin) | Uses access only for assigned schools; reports anything suspicious to the security owner the same day. |
| School administrator | Approves teachers of their own school only; suspends a teacher's account on the day they leave. |
| Teacher | Keeps their password private; reports a lost or stolen device. |
| Hosting provider | Physical and network security of the server; backups (to be confirmed in writing — RECOVERY.md). |

## 3. Access

1. Every account belongs to one person. Accounts are never shared, including on school tablets.
2. Least privilege: the role that does the job, nothing wider. Delegated inventory access is granted per teacher and revoked when the task ends.
3. Leavers lose access within one working day: suspension takes effect on the next request.
4. **Quarterly access review:** the security owner lists every active sub-admin and school admin, confirms each is still needed, and suspends the rest. The date and the outcome are recorded in the audit trail.
5. No account stays on the default password. The Security Overview counts them; the owner resets any it shows.

## 4. Sign-in

- Passwords are at least 8 characters, stored only as bcrypt hashes, and never sent by email or chat.
- The platform admin signs in with a second factor (an authenticator app) once it ships (D4). SMS codes are not used as a second factor.
- Repeated failures are throttled and recorded (SEC-006).

## 5. Data

Personal data is handled as set out in [DATA_PROTECTION.md](DATA_PROTECTION.md): what is held, why, who
can see it, how long it is kept, and which outside services process it. No one exports school
data beyond what their role can already see.

## 6. Change control

1. Every change goes through Git, one reviewed commit per change, pushed to `origin` only.
2. Before a deploy, the security suites pass: `verify-security-boundaries`, `verify-role-matrix`, `verify-frontend-safety`. The endpoint inventory check is part of the first.
3. Production changes arrive only through the signed deploy webhook, never by editing files on the server.
4. Secrets live only in the hosting panel. They are rotated when someone with panel access leaves, after any suspected leak, and at least once a year.

## 7. Monitoring

Refusals and sign-ins are recorded for 90 days (`security_events`); administrative changes are
kept in the audit trail. The security owner looks at the Security Overview **weekly**.

## 8. Incidents

Anyone who suspects an incident tells the security owner **immediately**, by phone if necessary.
The response follows [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md), including whether and when to
notify the Personal Data Protection Commission.

## 9. Backup and recovery

Targets: **RPO 24 hours, RTO 4 hours**. A restore drill runs **monthly**
([RECOVERY.md](RECOVERY.md)); its result is recorded in TEST_RESULTS.md.

## 10. Review and exceptions

- Security review: quarterly, recorded in the issue register.
- This policy: annually.
- Any exception to this policy is written into DECISIONS.md with its reason and an end date.
