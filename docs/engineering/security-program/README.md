# Security programme

Engineering records for making the Technical Support System measurably safer. Start with
**SESSION_HANDOFF.md** — it says where the work stands and what comes next.

| File | What it holds |
|---|---|
| [FINAL_REPORT.md](FINAL_REPORT.md) | The programme's final security and engineering report |
| [SESSION_HANDOFF.md](SESSION_HANDOFF.md) | Where the work stands, what waits on the owner, what comes next |
| [DECISIONS.md](DECISIONS.md) | Decisions taken, why, and when to revisit them |
| [SECURITY_POLICY.md](SECURITY_POLICY.md) | The adopted policy: owner, access, sign-in, change control, reviews |
| [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) | The first hour, playbooks, evidence queries, PDPC notification |
| [DATA_PROTECTION.md](DATA_PROTECTION.md) | Personal data held, processors, transfers, retention (Tanzania PDPA) |
| [RECOVERY.md](RECOVERY.md) | RPO/RTO, the monthly restore drill, restoring production |
| [ISSUE_REGISTER.md](ISSUE_REGISTER.md) | Every finding: evidence, root cause, fix, regression test |
| [THREAT_MODEL.md](THREAT_MODEL.md) | Assets, actors, request path, trust boundaries, what is impossible |
| [SECURITY_BASELINE.md](SECURITY_BASELINE.md) | Controls that exist, mapped to ASVS 5.0 and NIST CSF 2.0 |
| [API_SECURITY_MATRIX.md](API_SECURITY_MATRIX.md) | Every endpoint (count at the top of the file): auth, role gate, notes — checked against the routers before every push |
| [SECURITY_DESIGN.md](SECURITY_DESIGN.md) | Phase 2 design: security events, detection, alerts (built), reviewed IP blocking (not yet — D5) |
| [RESEARCH_LIBRARY.md](RESEARCH_LIBRARY.md) | Sources, and whether each was actually read |
| [TEST_RESULTS.md](TEST_RESULTS.md) | Commands run and their real output, before and after |

**For stakeholders:** the platform admin's *Security Overview* page (`#security`) explains the
same material in plain language, with live checks from the running deployment.

Rules this programme keeps: reproduce before fixing; a regression test must fail on the old
code; never test against production without approval; never claim a certification; say
"unverified" when it is.
