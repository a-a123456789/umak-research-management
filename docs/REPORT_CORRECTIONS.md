# Corrections to the submitted working draft

The supplied 55-page PDF is a working draft, not verified implementation evidence. Keep the original intact; incorporate these corrections in the final portfolio.

- Use one title: Center for Research Management (CRM) Research Services and Information Management Platform. Explain UMak-RMLIS as a legacy label if retained.
- Student executive roles are classroom governance roles, not appointments to university offices. Do not identify student members as the University's actual DPO or invent official contact addresses.
- Actual milestone stack: Express on Node 24, PostgreSQL 18, server-side bearer sessions, local in-memory rate limiting, GitHub Actions. No frontend is included. Next.js/Tailwind, Redis, cloud storage, SSO, Turnitin, and deployment remain proposals.
- Task II pages 12–14: the upload-to-code-execution chain is a hypothetical scenario requiring a specific parser/execution flaw. Upload acceptance alone does not execute embedded JavaScript. Replace example SQLi responses with the isolated demo's real synthetic output. The patched query returns HTTP 200 with an empty array; do not claim every prevented exploit must return 401.
- Task III pages 19–25: use the implemented consent contract; identity and timestamp come from the server. Optional choices can both be false. Consent alone does not establish every legal basis. DPO must verify legal statements.
- Mark the NPC notice prominently: “ACADEMIC INCIDENT SIMULATION — NOT SUBMITTED.” The 1,250 people, timestamps, containment, notifications, and declaration are fictional. Remove unsupported “submitted,” “conducted,” and certification claims. Use placeholder institutional contacts until verified.
- Task IV: replace pasted/malformed YAML with actual repository files. Two-review branch rules, push protection, MFA, VPN, TLS, WAF, RLS, SIEM, private subnets, and KMS are not demonstrated merely by describing them. See evidence status for applied settings.
- Runtime DB role is non-owner and cannot update/delete audit history. Application ownership checks are implemented; PostgreSQL row-level security is not. The admin/migration identity can still change audit data; this is not tamper-proof storage.
- Hard deletion removes synthetic operational records after staff review. Existing backups are not erased. The retention/restore-replay plan remains a production requirement; cryptographic shredding is not implemented.
- The backup exercise verifies recovery of quiescent synthetic tables. It does not prove a 15-minute RPO, two-hour RTO, encrypted storage, or real cloud recovery.
- Tasks V–VI: keep financial inputs and risk-reduction figures labelled illustrative. A passing test does not establish the proposed residual likelihood or annual incident rate. Threats remain open until the team accepts evidence and remaining limitations.
- Append the required 10–14 slides, 60-second demo link, citations, and corrected AI disclosure. Do not claim completed human review before it happens.
