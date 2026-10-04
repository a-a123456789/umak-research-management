# Security implementation and remaining risk

Local implementation status is separate from human acceptance and proposed production controls. No completed peer review is asserted.

| Ticket | Owner | Status / acceptance evidence |
|---|---|---|
| SEC-01 | Gian | Implemented locally; residual assumptions require human review. Parameterized search and publication filtering; synthetic exploit comparison and regression tests pass. |
| SEC-02 | Gian | Implemented locally; service workflow persistence proposed. Owner-or-staff predicates on records; default denial; cross-user tests pass. Collaborator grants are not implemented. |
| SEC-03 | Justin | Proposed cloud extension; no public export route. Local temporary backup only. Cloud public-access blocking and expiring download controls remain proposed. |
| SEC-04 | Gian | Implemented controls; owner-authorized merge exception is not peer review. Pre-commit rejection, Gitleaks CI and protected branches; rotate any real leaked credential. Native private-repo push protection unavailable. |
| SEC-05 | Gian | Partial defense; missed future query checks remain a risk. Non-owner runtime and tested application predicates; RLS not implemented. |
| SEC-06 | Justin | Production transport protection pending. Hashed expiring bearer sessions and revocation; local HTTP only. Production HTTPS remains required. No cookie authentication. |
| SEC-07 | Gian | Avoided in current scope; proposed feature risk. No upload or attachment parsing endpoint; defer until isolated parser security is reviewed. |
| SEC-08 | Justin | Local controls verified; production recovery pending. Loopback database binding, separate roles and actual synthetic restore test; immutable offsite recovery remains proposed. |
| SEC-09 | Justin | Local controls tested; distributed/OS resource isolation pending. Rate/body limits; staff-only solver; 5000 steps, 25000 edges, 50000 memberships, 2 MiB body; two Python workers, five-second timeout, 8 MiB output ceiling. No OS memory sandbox. |
| SEC-10 | Gian | Future frontend sink must be reviewed. JSON-only API with no HTML rendering frontend; safe output rendering required for future UI. |
| SEC-11 | Gian | Local grant controls verified; immutable external logging proposed. Server-derived audit actors and runtime INSERT/SELECT-only grants; administrator can still alter history. |

Highest DREAD priorities: SEC-04, SEC-01, SEC-08. Evidence: test/security.test.js, test/algorithm.test.js, scripts/demo-secret.js, scripts/demo-sqli.js and scripts/backup-restore.js. Aaliyah evaluates remaining assumptions; Anjelo records risk acceptance only after actual review.
