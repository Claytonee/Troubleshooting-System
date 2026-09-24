# Research library

Sources consulted on 2026-09-24. **Fetched** means the page itself was read in this session.
**Search summary** means only a search engine's summary was seen. Treat those as leads to
confirm, not as citations. Several official pages (NIST CSRC, OWASP cheat sheets, Cloudflare
docs) refused the connection during the session and are marked as such.

| Source | How read | Control / idea taken | Applies here because |
|---|---|---|---|
| [NN/g — Onboarding Tutorials vs. Contextual Help](https://www.nngroup.com/articles/onboarding-tutorials/) | Fetched (2026-09-24) | Pushed tutorials interrupt and are forgotten; contextual, dismissible, retrievable help works | D27: the tour is offered, never forced; page tours start where the work is |
| [Chameleon — product tour benchmarks](https://www.chameleon.io/blog/mastering-product-tours) | Fetched (2026-09-24) | 3–4 steps 72–74% completion, 7+ 16%; self-started 67% vs delayed 31% | D27: five stops at most, enforced by a test |
| [Shepherd.js](https://www.shepherdjs.dev/) | Fetched (2026-09-24) | Keyboard navigation, focus trapping and ARIA as the baseline; AGPL-3.0 | D27: same baseline, library not used (licence) |
| [Driver.js](https://github.com/kamranahmedse/driver.js) | Fetched (2026-09-24) | MIT, ~5 kB; spotlight and popover, no multi-page support | D27: the spotlight technique, not the library |
| Adobe Spectrum — Coach mark | Fetch returned no content | — | Not relied on |
| [RFC 6238 — TOTP](https://www.rfc-editor.org/rfc/rfc6238) | Fetched (2026-09-24) | 30-second step from the Unix epoch; Appendix B test vectors (e.g. time 59 → 94287082, SHA-1, 8 digits) | `verify-mfa.js` checks our implementation against those vectors, not against itself |
| [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html) | **Fetch refused** (both the -3 and -4 editions, 2026-09-24) | SMS codes as a restricted authenticator; one-time codes are not phishing-resistant | Cited from prior knowledge in D4; **confirm before quoting it to a stakeholder** |
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
