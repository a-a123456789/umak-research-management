# Implemented controls and remaining architecture

| Control | Implementation/evidence target | Limit |
|---|---|---|
| ACL-01 / SEC-01 | Parameterized search; SQLi repeat-payload demo | Isolated lab proof, not a full penetration test |
| ACL-02 / SEC-02 | Authenticated ownership/staff predicates; 401/404 tests | API-level authorization; no PostgreSQL RLS |
| ACL-04 / SEC-04 | Local secret hook, Gitleaks CI, required PR checks | Local hooks can be bypassed; server push protection availability must be checked |
| ACL-08 / SEC-08 | Compose loopback binding, password auth; backup restore comparison | No deployed firewall/VPN/TLS, no measured production RPO/RTO |
| ACL-09 / SEC-09 | Per-process request/login limits; input size limits | In-memory limiter is not shared across replicas |
| ACL-11 / SEC-11 | Transactional research/deletion audit; runtime insert/read-only audit grants | DB owner can alter records; no external immutable log |
| Consent / deletion | Server identity/time; optional refusal; staff review; session cascade | Backup erasure and cryptographic shredding pending |
| Default deny | No unlisted routes; role checks; DB PUBLIC privileges revoked | No claim of full production hardening |

Passwords use salted scrypt. Bearer tokens are random, hashed in the database, expire after an hour, and revoke on logout/deletion. HTTP is local-only for the demo. Production needs HTTPS and a reviewed authentication/session deployment.

Logical model: P-01 is middleware/routing inside Express; P-02 auth, P-03 research/privacy and P-04 audit are modules of the same backend; D-01 operational tables and D-02 audit_logs share PostgreSQL but differ in grants. P-05 is GitHub Actions. D-03 is temporary local backup/export storage; external cloud storage and E-03 identity provider are proposed. TB-01 browser-to-API, TB-02 routing-to-authenticated handlers, TB-03 application-to-database are logical trust boundaries; TB-02 is not a separate network segment.

Service-request workflows (A-03), uploads and external integrations remain backlog items. Do not present diagram target architecture as deployed microservices.

P-06 is the separate administrative backup/restore script. DF-09 reads PostgreSQL into this process and DF-13 writes the temporary backup file; the research API does not create backups.
