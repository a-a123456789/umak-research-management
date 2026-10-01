# Engineering handoff

All controls are proposed. The Word report contains complete user stories, implementation steps, assertions and evidence requirements for the top three tickets.

| Priority | Ticket | Owner | Threat | Required result |
|---|---|---|---|---|
| 1 | SEC-04 | Gian | THREAT-04 | Required secret scanning blocks synthetic secret fixtures; test credential revocation works. |
| 2 | SEC-01 | Gian | THREAT-01 | Bound SQL values and permission filters prevent private-sentinel disclosure under malicious search input. |
| 3 | SEC-08 | Justin with Gian | THREAT-08 | Approved DB access succeeds; unauthorized paths and privileges fail; synthetic backup restoration matches integrity checks. |

Aaliyah reviews evidence. Anjelo owns project risk acceptance. John David reviews privacy/legal handling. All three remain pending implementation because there is no application repository yet.

## Follow-up tickets

| Ticket | Owner | Control and acceptance assertion |
|---|---|---|
| SEC-02 | Gian | For two synthetic users and distinct research records, cross-user access is denied while explicitly authorized collaborators/staff succeed. |
| SEC-03 | Justin | A private synthetic export cannot be read anonymously; only the authorized identity can obtain it. |
| SEC-05 | Gian | Runtime query tests cannot retrieve unrelated rows; identity context resets between pooled requests. |
| SEC-06 | Justin | Test session cookies carry required flags; protected pages use HTTPS; CSRF and login rotation tests pass. |
| SEC-07 | Gian | Until uploads are approved, no upload endpoint is exposed. If adopted, oversized/invalid files are rejected and an isolated parser cannot execute arbitrary uploaded content. |
| SEC-09 | Justin | Requests beyond a documented test limit are throttled; oversized bodies rejected; query limits prevent unbounded retrieval. |
| SEC-10 | Gian | Stored untrusted text renders without script execution; normal research text remains readable. |
| SEC-11 | Gian | Updates produce server-attributed audit events; normal runtime cannot alter/delete audit history; unauthorized audit reads fail. |

## Evidence to request from teammates

- Gian: code paths, actual tech stack, schema, auth model, CI framework and repository permissions.
- Justin: hosting/network design, service identities and recovery environment.
- Anjelo: costing evidence and approval of risk treatment assumptions.
- John David: actual personal-data fields, retention obligations and scope of legal contingency.

Use synthetic data and isolated test environments. Do not treat passing document validation as security implementation evidence.


## Implementation handoff
SEC-01: src/app.js + test/security.test.js + scripts/demo-sqli.js. SEC-04: .githooks/pre-commit, scripts/scan-secrets.js, CI Gitleaks. SEC-08: compose.yaml + scripts/backup-restore.js. Local checks passed; retain review pending until teammates inspect evidence. Production cloud, network, TLS, deletion replay and immutable logging remain open.
