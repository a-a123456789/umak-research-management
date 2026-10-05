# Requirement-to-artifact completion checklist

Updated 5 October 2026. **Verified** identifies an executed check or inspected artifact, not instructor acceptance. **Documented proposal** means designed but not operationally verified. **External action required** cannot be supplied by automated work. **Needs correction** is reserved for an identified unresolved artifact defect. No known repository correction is intentionally left open; external requirements below remain incomplete.

Page numbers are the PDF page numbers before the appended deck. Slide numbers are deck-local (1–14). IAS has 18 report + 14 deck pages; ALGOCOM has 9 + 14.

Prior integration: [PR #3](https://github.com/a-a123456789/umak-research-management/pull/3), merged as `bbe0a73`. Current correction evidence and its exact checked commit are linked in `evidence/corrections/README.md`; do not use an old run as proof of newer edits.

| Course | Requirement | Owner | Report pages | Slides | Artifact / evidence | Status and boundary |
|---|---|---|---|---|---|---|
| IAS | I: CIANA-PS including Privacy/Safety; member duties/hierarchy/conflict; owner/custodian and eight classified assets | Gian | 2–3 | 1–2 | submissions/IAS_Report.md I; security/data/risks.json | verified — documented student governance; institutional adoption external |
| IAS | Unsigned governance acknowledgment fields | Gian / Anjelo | 3 | 1 | IAS_Report.md I | external action required — genuine signatures/review |
| IAS | II: actual stack, attack matrix; seven Kill Chain phases with MITRE IDs | Justin | 3–4 | 2–3 | IAS_Report.md II; docs/CONTROLS.md | verified — seven-stage scenario is explicitly hypothetical |
| IAS | Vulnerable code, payload, patch and before/after response | Justin / Gian | 4–5 | 4 | demo/; scripts/demo-sqli.js; src/app.js; evidence/integration/local-checks.txt | verified — synthetic isolated exploit; parameterized normal route |
| IAS | III: five provisions each RA 10173 and 10175 | John David | 5 | 5 | IAS_Report.md III | verified — academic control mapping; legal adoption external |
| IAS | Consent API JSON, server identity/time and optional choices; live deletion | John David | 5–6 | 5 | src/app.js; test/security.test.js; docs/PRIVACY.md | verified — tested prototype behavior |
| IAS | Backup deletion ledger, retention, restore replay and key-destruction design | John David | 6 | 5 | IAS_Report.md III; docs/PRIVACY.md | documented proposal — not implemented or tested cryptographic erasure |
| IAS | Six-stage incident response and draft NPC notice | John David | 6–7 | 6 | IAS_Report.md III | documented proposal — unsigned academic simulation; not a sent notification |
| IAS | IV: five-part EISP, managerial policy, five-column default-deny ACL | Anjelo | 7–8 | 7 | IAS_Report.md IV; src/app.js; db/schema.sql | verified — written policy and prototype enforcement; institutional approval external |
| IAS | Working configurations; NIST CSF 2.0 versus ISO 27001 roadmap; three-tier SETA | Anjelo / Aaliyah | 8–9 | 7–8 | compose.yaml; .github/workflows/; IAS_Report.md IV | verified configurations; documented proposal for adoption, training and certification |
| IAS | Git rulebooks, two approvals, strict security/algocom checks | Gian / Anjelo | 9 | 8 | docs/GIT_POLICY.md; correction PR check/merge record | verified in commit-specific CI and final merge record; exception is not peer review |
| IAS | V: four-attribute valuation, eleven TVA triples in five categories | Aaliyah | 9–10 | 9 | security/data/risks.json; IAS_Report.md V | verified taxonomy; estimated financial inputs |
| IAS | SLE/ALE, annual safeguard cost, positive example CBA and sensitivity | Aaliyah | 10 | 9 | security/data/financial_inputs.json; security/validation/validate_package.py | verified arithmetic — estimates, including negative sensitivity scenario |
| IAS | Empirical valuation/frequency/cost evidence | Aaliyah | 16–17 | 9,14 | docs/FINANCIAL_EVIDENCE_WORKSHEET.md | external action required — records or explicit instructor decision absent |
| IAS | Nine-column risk register; inherent versus target scores | Aaliyah | 11–12 | 10 | security/data/risk_register.csv | verified consistency; ordinal scenario judgments need human review |
| IAS | VI: Threat Dragon L0/L1 files, four boundaries | Aaliyah / Justin | 12–13 | 11 | security/models/CRM_Threat_Dragon.json; security/diagrams/ThreatDragon_Level_*.svg | verified — both levels opened; corrected L1 browser SVG export |
| IAS | Eleven STRIDE threats with DREAD; AND/OR tree with leaf metrics | Aaliyah | 14–15 | 12 | security/data/risks.json; security/diagrams/Attack_Tree.svg | verified consistency — demonstrated, mitigated and residual scenarios separated |
| IAS | Three mitigation tickets, assertions, full asset-to-test traceability | Aaliyah / Gian | 15–16 | 13 | security/data/traceability.csv; security/BACKLOG.md; test/ | verified — control IDs map to actual rules or explicitly proposed controls |
| IAS | 60-second real technical recording and speaking script | Gian | 17 | 8 | evidence/integration/secret-demo.cast; secret-demo.html | verified — actual terminal capture; team narration/rehearsal external |
| IAS | IEEE citations, substantial AI workstream disclosure, 14-slide appendix | All / Anjelo | 17–18 | 14 | submissions/IAS_Report.md; IAS_Defense.pptx | verified — older required laws retain dates; human review not asserted |
| ALGOCOM | I: formal inputs, constraints, objective and critical-path certificate | Aaliyah | 2 | 2–5 | algocom/engine.py; ALGOCOM_Report.md I | verified model — unlimited parallel capacity, duration estimates only |
| ALGOCOM | II: advanced paradigm schema, recurrence, pseudocode, invariants and proof | Gian | 3 | 6–8 | algocom/engine.py; ALGOCOM_Report.md II | verified — DAG dynamic programming; receipt and verification gates distinct |
| ALGOCOM | III: time/space best/average/worst, requirement costs, 3V scalability | Anjelo | 4 | 9 | ALGOCOM_Report.md III | verified documented derivation — hashing assumptions stated |
| ALGOCOM | Preserve supplied algorithm, original measurements and twelve tests/1000 random cases | Gian | 4–5 | 10 | algocom/prototype.py; test_prototype.py; results.csv; results.md | verified — preserved original baseline and measurements |
| ALGOCOM | Nine extended equivalent benchmarks; seed, reps, separate memory and environment | Anjelo | 4–5 | 10 | algocom/extended_results.csv; extended_results.json; bench_extended.py | verified measured synthetic cases — not production workload facts |
| ALGOCOM | 5000-step p95 below 1000 ms over ten warmed runs | Anjelo | 5 | 10 | algocom/bench_extended.py; .github/workflows/algocom.yml | verified in successful commit-specific CI; engineering regression budget |
| ALGOCOM | IV: client–API–DB–worker architecture and exact API contracts | John David | 5–6 | 11 | docs/ALGORITHM_API.md; algocom/schemas/; src/algorithm.js; src/algorithm-result.js | verified — full worker-response validation and structured 502 errors |
| ALGOCOM | V: two formal stories; module/algorithm/steps/edge cases/executable ticket assertions | Justin | 7 | 12 | ALGOCOM_Report.md V; test/algorithm*.test.js | verified specification and automated assertions; human acceptance external |
| ALGOCOM | VI: all six official defense answers with supporting citations | Justin / all | 8 | 13 | ALGOCOM_Report.md VI | verified written answers — each member must rehearse independently |
| ALGOCOM | Four relevant AI assistance blocks; IEEE references; 14-slide appendix | All / Anjelo | 2–6,9 | 14 | submissions/ALGOCOM_Report.md; ALGOCOM_Defense.pptx | verified — ChatGPT/Codex and supplied Claude disclosure retained |
| Both | All five names, IDs, course-specific roles, ownership and current repository URL | All | 1 | 1 | Both report title pages and editable decks | verified metadata; writing assignments do not change defense roles |
| Both | Authentication, permissions, worker failures/timeout/cancellation/recovery and equivalent results | Gian | IAS 17; ALG 8 | IAS 13; ALG 12 | test/; algocom/test_*.py; evidence/corrections/local-checks.txt | verified local: 15 backend groups and 19 Python tests |
| Both | Secret/static/dependency checks, SQLi comparison and six-table backup restore | Gian / Justin | IAS 17 | IAS 4,8,13 | scripts/; evidence/corrections/; GitHub security check | verified local; Gitleaks/Semgrep results in commit-specific CI |
| Both | Editable sources, exact filenames, references then fourteen slides, reproducible build | Anjelo | IAS 18 then 19–32; ALG 9 then 10–23 | 1–14 each | submissions/README.md; build_reports.py; build-slides.mjs | verified — every report and slide page rendered and inspected |
| Both | Independent reviews, signatures, institutional facts, deadline/access and TBL receipt | All / Anjelo | IAS 3,16–17; ALG 8–9 | IAS 14; ALG 14 | docs/NEXT_STEPS.md; financial worksheet | external action required — no simulated approvals or submissions |

## Submission boundary

No frontend or production deployment is included. SSO, Redis, uploads, Turnitin, immutable offsite backup, production TLS, approved retention and external audit storage remain proposed. Empirical valuation is incomplete. Local native PostgreSQL and CI service containers support the evidence; a teammate must independently exercise Docker Compose. Private-repository native secret scanning/push protection was unavailable; hooks and Gitleaks CI are separate controls. Keep the repository private. Use `docs/NEXT_STEPS.md` for member commands, evidence and the unsent team note. Use `docs/FINANCIAL_EVIDENCE_WORKSHEET.md` for the unsent instructor clarification.
