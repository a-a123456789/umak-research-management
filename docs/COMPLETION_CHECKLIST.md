# Completion checklist and team handoff

Updated 5 October 2026. **Pass** means the artifact exists and the specified automated/document check was performed; it does not mean instructor acceptance or human approval. The integration pull request records the final merged SHA, CI results and protection restoration in its completion record. Until that record is posted, merge is pending. The independently saved merge record is part of the final handoff.

## ALGOCOM requirement-to-artifact map

| Requirement | Owner | Artifact | Status / boundary |
|---|---|---|---|
| I: problem, inputs/constraints, readiness objective and duration certificate | Aaliyah | submissions/ALGOCOM_Report.md I; algocom/engine.py | Pass; institutional workflow and duration estimates require confirmation |
| II: advanced paradigm, recurrence/schema, pseudocode, invariants and proof | Gian | Report II; engine.py; test_engine.py | Pass: DAG dynamic programming; exact for supplied estimates and dependency model |
| III: time/space, best/average/worst, 3V scalability | Anjelo | Report III | Pass; full input includes requirements/evidence; hashing assumption and baseline ordering explicit |
| IV: decoupled component diagram and exact API contract | John David | Report IV; submissions/figures/Algorithm_Architecture.svg; docs/ALGORITHM_API.md; src/algorithm.js | Pass; pure core, separate worker, authenticated staff route; no workflow persistence |
| V: two formal stories, tickets, benchmark assertions | Justin / Anjelo | Report V; algocom/bench_extended.py; test/algorithm.test.js | Pass: equivalent outputs before timing; separate memory; no empirical CRM workload claim |
| Original prototype, 12 tests, 1,000 random comparisons and measurements preserved | Gian | algocom/prototype.py; test_prototype.py; results.csv/.md | Pass; copying repairs preserved original behavior |
| DP hand cases, cycles/limits/invalid durations and 500 random comparisons | Gian | algocom/test_engine.py | Pass: 7 added groups; 19 total Python tests |
| Nine extended benchmark cases; seed 20261001; 10 repetitions | Anjelo | algocom/extended_results.csv/.json | Pass: measured local data, not universal speedups |
| 5,000-step warmed p95 <1,000 ms regression guard | Anjelo | bench_extended.py; .github/workflows/algocom.yml | Pass in integration CI and local recorded run; final-main run in merge record |
| VI: all six official defense questions | Justin / all | Report VI | Answers complete; each student's understanding/rehearsal remains |
| IEEE citations and four relevant AI assistance blocks | All | Report I–IV and references | Pass; Claude disclosure retained; human review not invented |
| Final PDF, 14 appended slides, names/IDs/roles and repository URL | Justin / Anjelo | submissions/III-BCSAD_bolanatics_Milestone1_Proposal.pdf; ALGOCOM_Defense.pptx | Pass: rendered and inspected; instructor acceptance and TBL submission remain |

## IAS requirement-to-artifact map

| Requirement | Owner | Artifact | Status / boundary |
|---|---|---|---|
| I: governance/reporting lines, C-suite duties, ≥4 classified assets and CIANA-PS | Gian | submissions/IAS_Report.md I | Pass: 8 stable IDs, classroom/student roles separate from institutional offices |
| II: actual stack/attack surface, seven Kill Chain phases + MITRE IDs | Justin | Report II; docs/CONTROLS.md | Pass: hypothetical upload chain clearly separate from implemented SQLi demonstration |
| Vulnerable code, payload, patch and actual repeat result | Justin / Gian | demos/; scripts/demo-sqli.js; src/app.js; evidence/integration/local-checks.txt | Pass on synthetic data; vulnerable example isolated from normal startup |
| III: five provisions each RA 10173/10175, consent JSON/API, deletion/backup treatment | John David | Report III; src/app.js; test/security.test.js | Pass for mapping and local behavior; institutional lawful basis/retention and backup erasure remain |
| Six-stage IR and draft NPC notification | John David | Report III | Complete academic simulation; no incident, signature or submission asserted |
| IV: five-part EISP, managerial policy, five-column default-deny ACL | Anjelo | Report IV; db/schema.sql; src/app.js | Pass; production adoption remains external |
| Working configurations, NIST CSF 2.0 vs ISO 27001 roadmap, three-tier SETA | Anjelo / Aaliyah | Report IV; compose.yaml; .githooks; .github/workflows | Pass for prototype/rules; no certification/training attendance claimed |
| Git rules: two approvals, required security and algocom checks, no force/deletion | Gian / Anjelo | Merge record; docs/GIT_POLICY.md | Final applied state is verified in merge record; owner-authorized exception is not peer review |
| V: four-attribute valuation, ≥10 TVA triples across five categories | Aaliyah | Report V; security/data/risks.json | Pass: 11 triples; valuation inputs remain estimates |
| SLE/ALE/safeguard costs/positive CBA + sensitivity; nine-column register | Aaliyah | Report V; financial_inputs.json; risk_register.csv; validation/validate_package.py | Arithmetic passes. **Remaining:** empirical institution-specific valuation/frequency evidence; no invoices or rates fabricated |
| VI: actual Threat Dragon L0/L1, ≥3 boundaries, ≥10 STRIDE/DREAD threats | Aaliyah / Justin | security/models/CRM_Threat_Dragon.json; diagrams/ThreatDragon_Level_*.svg | Pass: opened in Threat Dragon 2.6.2, browser SVG exports, 4 boundaries and 11 threats; residual-risk acceptance remains |
| AND/OR attack tree with leaf metrics; three mitigation tickets/assertions | Aaliyah / Gian | Report VI; diagrams/Attack_Tree.svg; security/BACKLOG.md | Pass: disclosure root and conditional branches; metrics are scenario scores |
| Asset→TVA→threat→risk→control→ticket→test traceability | Aaliyah | security/data/traceability.csv | Pass; proposed-feature risks explicitly lack executable control evidence |
| Auth/ownership/consent/SQLi resistance, secrets/static/audit/restore checks | Gian / Justin | test/; scripts/; evidence/integration/ | Local and integration CI pass; final-main checks in merge record |
| 60-second demonstration and speaking script | Gian | evidence/integration/secret-demo.cast/.html; Report demonstration section | Pass: real timed terminal capture. Team narration/rehearsal remains |
| IEEE references, concise AI collaboration disclosure | All | Report references/disclosure | Pass: required older laws/foundations retain real dates; automated checks distinguished from review |
| Report + 14 appended slides, all C-suite names/IDs and repository URL | Anjelo | submissions/III-BCSAD_bolanatics_IAS_Capstone_Portfolio.pdf; IAS_Defense.pptx | Pass: rendered and inspected; instructor acceptance and TBL submission remain |

## Each member's next contribution

1. **Gian:** fresh setup, run `npm test`, `npm run demo:sqli`, `npm run demo:secret`; inspect Git policy. Evidence: command log with commit and one explained fix/review finding.
2. **Justin:** run `npm run backup:verify`; confirm local/CI database assumptions and the DFD boundaries. Evidence: six-table recovery log and architecture correction if needed.
3. **John David:** exercise false optional consent and reviewed deletion; verify privacy language and simulated NPC notice. Evidence: request/response checks; institutional questions kept unresolved until answered.
4. **Anjelo:** verify actual protected-branch settings; compare report/decks against the official rubric, confirm deadlines/designated submitter. Evidence: settings snapshot, final package review and submission receipt only after actually submitted.
5. **Aaliyah:** recalculate SLE/ALE/CBA and DREAD; explain each critical-path example; open the model and check A-08/worker traceability. Evidence: calculation/model review; obtain real valuation support or instructor agreement to estimated scenarios.

For corrections: pull current main, create your own feature branch, commit the work you actually perform, run relevant checks, push and open a PR identifying changed artifacts and evidence. Normal two-review policy applies after the integration exception. Do not create cosmetic commits or approvals to imply work not done.

## External / proposed items

No production hosting, full frontend, Google SSO, Redis, uploads, Turnitin, immutable offsite backup, production TLS/RPO/RTO, institutional retention approval, actual risk acceptance or empirical financial evidence is claimed. Native GitHub private-repo secret scanning/push protection is unavailable; local hooks and Gitleaks CI are active. Local Docker Compose remains independently reproducible by a teammate with Docker; local native PostgreSQL and CI service-container tests passed. Keep repository private and give the instructor authorized access as required. Instructor acceptance, team understanding and TBL Hub submission cannot be completed by automated checks.
