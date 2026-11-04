# Implemented controls and remaining architecture

| Control | Implementation/evidence target | Limit |
|---|---|---|
| ACL-01 / SEC-01 | Parameterized search; SQLi repeat-payload demo | Isolated lab proof, not a full penetration test |
| ACL-02 / SEC-02 | Membership/assigned-staff API gates and native FORCE RLS; 401/404/DB tests | Trusted server identity context; privileged DB owners can bypass |
| ACL-04 / SEC-04 | Local secret hook, Gitleaks CI, required PR checks | Local hooks can be bypassed; server push protection availability must be checked |
| ACL-08 / SEC-08 | Compose loopback binding, password auth; backup restore comparison | No deployed firewall/VPN/TLS, no measured production RPO/RTO |
| ACL-09 / SEC-09 | Shared PostgreSQL token buckets and rolling login-failure windows; bounded uploads | Per-process upload concurrency; deployment admission/load still needs verification |
| ACL-11 / SEC-11 | Transactional research/deletion audit; runtime insert/read-only audit grants | DB owner can alter records; no external immutable log |
| Consent / deletion | Server identity/time; optional refusal; staff review; session cascade | Backup erasure and cryptographic shredding pending |
| Default deny | No unlisted routes; role checks; DB PUBLIC privileges revoked | No claim of full production hardening |

Passwords now use asynchronous Argon2id with legacy scrypt upgrade. Random opaque bearer tokens are hashed in the database, expire after 15 minutes, and revoke on logout/deletion. Local development uses HTTP; production startup requires API/DB TLS configuration. See [current IAS implementation](IAS_IMPLEMENTATION.md) and its deployment limits.

Logical model: P-01 is middleware/routing inside Express; P-02 auth, P-03 research/privacy and P-04 audit are modules of the same backend; D-01 operational tables and D-02 audit_logs share PostgreSQL but differ in grants. P-05 is GitHub Actions. D-03 is temporary local backup/export storage; external cloud storage and E-03 identity provider are proposed. TB-01 browser-to-API, TB-02 routing-to-authenticated handlers, TB-03 application-to-database are logical trust boundaries; TB-02 is not a separate network segment.

Consultation ticket requests (A-03) now have authenticated ownership/staff scope, transactional audit events, version checks and atomic deadline-ordered claims; see SEARCH_AND_CONSULTATIONS.md. Private upload/storage/scanner adapters are implemented; live cloud deployment verification remains pending. Do not present diagram target architecture as deployed microservices.

P-06 is the separate administrative backup/restore script. DF-09 reads PostgreSQL into this process and DF-13 writes the temporary backup file; the research API does not create backups.

P-07 is the Python child worker, reached through DF-14 JSON pipes across TB-04. Staff authentication, 2 MiB body, 5,000 vertices, 25,000 edges, 50,000 memberships, two concurrent children, five-second timeout and 8 MiB stdout limit are implemented and tested. The worker receives no DB credentials; it is not an OS sandbox. A-04 approved research metadata is implemented; full public information pages remain proposed.

Both Threat Dragon views now open and rendered SVG exports are supplied. Native GitHub private-repo secret scanning/push protection was unavailable (422); local hook and Gitleaks CI are implemented. See COMPLETION_CHECKLIST.md for current integration state.
