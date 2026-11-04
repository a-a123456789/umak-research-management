# IAS implementation evidence

5 November 2026, Asia/Manila. Local uncommitted workspace implementation. No production or remote CI claim. A new isolated PostgreSQL 18.3 cluster/database was used; the earlier project database and `.private/features.env` were not modified.

| Check | Executed result | Evidence / scope |
| --- | --- | --- |
| Full Node API/security/algorithm regression | **48 passed, 0 failed, 0 skipped** | [TAP](implementation-tests.tap); real PostgreSQL RLS, profile/member/reviewer scope, pool reuse, notes isolation, audit rollback, legacy upgrade, single-use/expired activation, distributed failure counters and token bucket concurrency |
| File ingestion | Passed within suite | PDF/DOCX structure, malformed/spoofed/macro/oversize/ZIP expansion rejection, fake storage workflow, clean/reject ClamAV protocol simulation, real SDK 600-second presigning with synthetic credentials. No live antivirus signature database or bucket was used |
| Authorization demonstration | Passed | [Transcript](demo.txt); real API/database, assigned/unassigned staff, hidden notes, unscoped SQL denied, audit deletion denied |
| Database restoration | Passed | [Result](database-restore.json); all 19 public tables plus policies, FORCE RLS flags, table grants and sequences compared. Quiescent synthetic snapshot |
| AES-256-GCM archive creation/restoration | Passed locally | [Backup](encrypted-backup.json), [restore](encrypted-restore.json); authenticated decryption, quarantined database restore, constraint/sequence smoke check and runtime RLS/audit grants. **Zero documents in this archived fixture**, no offsite access or deletion-event replay exercised |
| Crypto/DB calibration | Completed | [Report](../../benchmarks/results/ias-2026-11-04T16-01-58.239Z/report.md), raw samples and metadata in the same directory |
| Dependency audit | **0 vulnerabilities reported** | [npm audit](dependency-audit.txt); package install updated resolved dependencies. This is a tool result at this run, not a permanent guarantee |
| Static/secret checks | Passed | [Static](static-check.txt), [secret patterns](secret-check.txt); Gitleaks/Semgrep remote CI not rerun here |
| Android library / test APK / lint | **Build and lint passed** | [Gradle output](android-build.txt). Instrumentation was not run: `adb devices` reported no attached emulator/device. Full UI integration and airplane-mode demonstration remain pending |

Selected calibration p95: legacy synchronous scrypt verification 18.70 ms; async Argon2id verification 8.56 ms; protected owner query at 10k studies 1.90 ms versus 1.20 ms for the privileged app-predicate baseline. RLS is retained despite exceeding the original provisional 20% relative-overhead goal. This run includes transaction/connection context costs and does not isolate policy overhead. Audited mutation at 10k: 0.37 ms p95. Faster hashing does not mean stronger security; Argon2id parameters and memory resistance are the relevant design choices.

Benchmark limits: 30 measured samples and five warmups, 1k/10k synthetic records, sequential method blocks, no randomized multi-seed/multi-role or concurrent HTTP capacity workload. RSS/event-loop figures are instrumented process observations. They are calibration evidence, not a production SLA or an audit-chain benchmark. Source hashes and dirty-tree status at measurement time are retained. The final evidence source manifest identifies subsequent implementation files independently.

## Deployment checks still required

* Actual cloud IAM/public-access denial, pre-signed URL expiry enforcement, S3/R2 encryption metadata and every-hop TLS verification.
* Production database-volume encryption, narrow reverse-proxy trust if used, protected scanner transport and real ClamAV malware detection.
* Offsite credentials/account isolation, nonempty DB+manuscript recovery, independently exported deletion-event replay, failure monitoring and approved retention/version erasure. The recovery scripts and systemd units are implemented; no service/timer was enabled on this Mac.
* Android app integration and on-device tests; public content currently consists of clearly marked synthetic placeholders.
* External immutable audit anchoring, refresh-token rotation and a complete frontend were not implemented. The selected plan retains revocable opaque sessions and uses a protected transactional ledger without claiming administrator-proof history.

Use [implementation guide](../../docs/IAS_IMPLEMENTATION.md) for migrations, routes, configuration and reproducible commands. Existing reports/decks were not regenerated. All evidence uses synthetic data; passwords, raw session/activation tokens and encryption keys stay in ignored private files.
