# Security implementation and remaining risk

Status records are evidence classifications, not peer acceptance. Scores and costs remain estimates.

| Ticket / owner | Status | Control and acceptance |
|---|---|---|
| SEC-01 / Gian | Demonstrated in isolated vulnerable example; mitigated in normal application | Parameterized search and publication filtering; synthetic exploit comparison and regression tests pass. Evidence: scripts/demo-sqli.js; test/security.test.js |
| SEC-02 / Gian | Mitigated scenario; owner/staff checks tested | Owner-or-staff predicates on records; default denial; cross-user tests pass. Collaborator grants are not implemented. Evidence: src/app.js; test/security.test.js |
| SEC-03 / Justin | Current residual risk; no application-level dump encryption | Temporary-directory cleanup and controlled operator access; application backup encryption and custody evidence remain proposed. Evidence: scripts/backup-restore.js; docs/PRIVACY.md |
| SEC-04 / Gian | Mitigated scenario; fake-secret rejection and CI verified | Pre-commit rejection, Gitleaks CI and protected branches; rotate any real leaked credential. Native private-repo push protection unavailable. Evidence: .githooks/pre-commit; .github/workflows/security-gate.yml |
| SEC-05 / Gian | Current residual risk; runtime role is not row-isolated | Non-owner runtime and tested application predicates; RLS not implemented. Evidence: db/schema.sql; test/security.test.js |
| SEC-06 / Justin | Current transport limitation; local HTTP only | Hashed expiring bearer sessions and revocation; local HTTP only. Production HTTPS remains required. No cookie authentication. Evidence: src/crypto.js; src/app.js; docs/CONTROLS.md |
| SEC-07 / Gian | Current recovery design gap; extortion is a hypothetical scenario | Verified local restore is a prerequisite, not offsite resilience. Proposed immutable independent recovery, segregated credentials and rehearsed incident recovery. Evidence: scripts/backup-restore.js; proposed offsite design only |
| SEC-08 / Justin | Current privileged-account threat scenario; compromise not demonstrated | Separate non-owner runtime, loopback DB and tested restore; protect setup credentials and add independent immutable backups before production. Evidence: compose.yaml; db/schema.sql; scripts/backup-restore.js |
| SEC-09 / Justin | Mitigated resource scenario; OS/distributed limits remain | Rate/body limits; staff-only solver; 5000 steps, 25000 edges, 50000 memberships, 2 MiB body; two Python workers, five-second timeout, 8 MiB output ceiling. No OS memory sandbox. Evidence: src/algorithm.js; algocom/engine.py; test/algorithm.test.js |
| SEC-10 / Gian | Demonstrated boundary defect; corrected and regression tested | Full structural/type/membership validation; malformed object yields WORKER_PROTOCOL/502; worker process is bounded. Evidence: src/algorithm-result.js; test/algorithm-result.test.js; test/algorithm.test.js |
| SEC-11 / Gian | Current residual risk; administrator can alter audit history | Runtime INSERT/SELECT-only audit grants tested; external tamper-resistant audit storage and administrator oversight remain proposed. Evidence: db/schema.sql; test/security.test.js |

Top three: SEC-04, SEC-01, SEC-08. See report VI for user stories and automated assertions.
