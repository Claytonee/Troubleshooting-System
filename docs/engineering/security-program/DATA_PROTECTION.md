# Data protection record — Tanzania PDPA 2022

Adopted 2026-09-24 (DECISIONS.md D21). What personal data the system holds, why, who can see
it, how long it is kept, and where it travels. Read from the live schema, not from memory.
Legal basis: Personal Data Protection Act 2022 (Cap. 44 R.E. 2023) and GN 449C of 2023;
sources in RESEARCH_LIBRARY.md. **This is an engineering record, not legal advice.** Head
office confirms the legal positions with counsel.

## What is held

| Data | Where | About whom | Why | Who can see it |
|---|---|---|---|---|
| Name, username, email, phone, photo, bio | `users` | Staff and teachers | Accounts, contact about faults | The person; platform admin; school admin for their teachers |
| Password | `users.password_hash`, `registration_requests.password_hash` | Same | Sign-in | Nobody. bcrypt only, never shown |
| Registration requests and appeals: name, email, phone, message | `registration_requests`, `registration_appeals` | Applicants | Approving school admins | Platform admin |
| School contacts: head, IT and coordinator names, emails, phones | `schools` | School staff | Reaching the school | Staff roles for their schools |
| Reporter name and contact | `errors.reporter_*` | Whoever filed a fault | Following up the fault | That school's staff, its engineer, head office |
| **Student name on a device** | `tablets.student_name`, `tablet_swaps.student_name` | **Students (children)** | Which child holds which tablet | That school's staff; engineers for assigned schools; head office |
| Photos attached to faults | Cloudinary; `error_attachments` | May show people or rooms | Diagnosing the fault | As for the fault |
| WhatsApp number and messages; USSD/SMS number | `whatsapp_*`, `ussd_sessions` | Teachers who report by phone | Intake channels | Platform admin (and the stored fault) |
| AI chat messages | `ai_chat_messages` | The asker | Conversation history | The asker only |
| IP address, account, route of refused requests and sign-ins | `security_events` | Everyone | Security (SEC-006) | Platform admin |
| Actor name and IP of administrative changes | `audit_log` | Staff | Accountability | Platform admin |

**Children's data** is the most sensitive item: one name per tablet. Only the name is kept,
with no age, class or contact details, and it is visible only within the school's chain.

## Where it travels: processors and transfers out of Tanzania

| Processor | What it receives | Where | Status |
|---|---|---|---|
| Hosting provider (`213.139.204.238`) | Everything, at rest | **Unverified.** Confirm the data-centre country in writing | Owner action |
| Cloudinary | Fault photos, avatars, manuals | Cloudinary's storage region (default US). Confirm the account's region | Owner action |
| **AWS Bedrock (us-east-1)** | The question, the school's facts and fault titles, the asker's **role** | USA | **Minimised 2026-09-24:** the asker's name is no longer sent (D21). A suite test pins it |
| Meta (WhatsApp Cloud API) | Messages from teachers who choose WhatsApp | Meta's infrastructure | The teacher chose the channel |
| Africa's Talking | Phone number and USSD/SMS content | Kenya / region | The teacher chose the channel |

PDPA s.31–32 allows a transfer out of Tanzania where protection is adequate or guaranteed, or on
the grounds the Act lists (consent, contract, the person's interest). **Head office records the
ground it relies on for each processor above.** The engineering side keeps what leaves as small
as it can.

## Retention (s.28)

| Data | Kept | State |
|---|---|---|
| `security_events` | 90 days | **Enforced** by the service |
| `audit_log` | 2 years | Decided (D21); not yet enforced |
| Rejected registration requests and appeals | 1 year after the decision | Decided; not yet enforced |
| WhatsApp / USSD sessions | 1 year | Decided; not yet enforced |
| Accounts of people who left | Suspended on leaving; deleted after 1 year unless a fault record needs the name | Decided; not yet enforced |
| Student name on a device | Until the device is reassigned or retired | Current behaviour |

"Decided, not yet enforced" means a scheduled clean-up is to be built. Until then the page and
this record say so rather than claim it.

## People's rights

A person may ask what is held about them (s.33) and have wrong data corrected or deleted (s.38).
Requests go to the security owner, who answers from the tables above within 30 days and records
the request in the audit trail.

## Organisational steps for head office (the software cannot do these)

1. **Register with the Personal Data Protection Commission** as a data controller (s.14), if not already done.
2. Confirm hosting and Cloudinary regions, and record the transfer ground for each processor.
3. Publish a short privacy notice. Engineering will link it from the sign-in and registration pages once the text exists.
4. Name the contact for data-protection requests.
