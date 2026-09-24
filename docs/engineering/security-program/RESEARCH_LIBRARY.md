# Research library

Sources consulted on 2026-09-24. **Fetched** means the page itself was read in this session.
**Search summary** means only a search engine's summary was seen. Treat those as leads to
confirm, not as citations. Several official pages (NIST CSRC, OWASP cheat sheets, Cloudflare
docs) refused the connection during the session and are marked as such.

| Source | How read | Control / idea taken | Applies here because |
|---|---|---|---|
| [OWASP ASVS 5.0 — chapter list (GitHub)](https://github.com/OWASP/ASVS/tree/master/5.0/en) | Fetched | The 17 chapters used as the baseline checklist | Standard vocabulary for "which control, how verified" |
| OWASP ASVS 5.0 release (May 2025), levels L1–L3, ~345 requirements | Search summary | Level structure | Not claimed; used as a checklist only |
| [OWASP API Security Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/) | Fetch failed (redirect, then reset) | API1 BOLA, API5 function-level authz | SEC-001/002/004 are BOLA |
| [NIST SP 800-61r3](https://csrc.nist.gov/pubs/sp/800/61/r3/final) (April 2025) | Search summary; CSRC fetch refused | Incident response mapped onto CSF 2.0's six functions | Structures the Respond/Recover gaps |
| NIST CSF 2.0 — Govern, Identify, Protect, Detect, Respond, Recover | Search summary | Function-level status on the Security Overview page | Explains posture to non-engineers |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Fetch refused | What to log and never log | Security Center event model (SECURITY_DESIGN.md) |
| [Google infrastructure security design](https://docs.cloud.google.com/docs/security/infrastructure/design) | Fetched | Layered model; services authenticate by credential, not by network location | "Layers of protection" framing |
| [Microsoft Zero Trust overview](https://learn.microsoft.com/en-us/security/zero-trust/zero-trust-overview) | Fetched | Verify explicitly · least privilege · assume breach | Per-request re-check of account status; page framing |
| [AWS Well-Architected security pillar](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/security.html) | Fetched | Traceability, security at all layers, prepare for events | Detect/Respond gaps are the traceability gap |
| [Cloudflare WAF docs](https://developers.cloudflare.com/waf/) | Fetch refused | — | No CDN in front of this site today (THREAT_MODEL.md) |
| Tanzania Personal Data Protection Act 2022 ([PDPC text](https://www.pdpc.go.tz/media/media/THE_PERSONAL_DATA_PROTECTION_ACT.pdf), [TanzLII](https://tanzlii.org/akn/tz/act/gn/2023/395b-1/eng@2023-06-13)) | Search summary | Reasonable safeguards; breach notification to PDPC and data subjects; controller registration | The system holds staff and student personal data |
| [FPF — Tanzania's data protection law, overview](https://fpf.org/blog/tanzanias-personal-information-protection-act-overview-key-takeaways-and-context/) | Fetched | s.14 registration, s.27 safeguards and breach notice, s.28 retention, s.31–32 cross-border, s.33/38 rights | DATA_PROTECTION.md, the AI minimisation (D21) |
| [Clyde & Co — breach notification in Tanzania (Feb 2026)](https://www.clydeco.com/en/insights/2026/02/notification-obligations-arising-from-personal-dat) | Fetched | "Without undue delay", no fixed deadline; GN 449C of 2023 lists the contents; processors must tell controllers | Our 24 h / 72 h rule (D17) |

## Not yet researched (explicitly in the programme brief)

OWASP WSTG, CISA logging guidance, MITRE ATT&CK mappings, AWS WAF rate rules, Google SCC,
Microsoft Sentinel playbooks. They inform the detection and response phase and will be read
before it is designed, not cited ahead of time.
