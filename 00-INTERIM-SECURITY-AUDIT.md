# Interim security audit report

**Status: Interim — OWASP testing pending.** This report records the completed source-review pass. OWASP testing has not been performed; the overall security assessment remains open and this report is not the final assessment.

## Scope and reviewed state

Standard-profile source review, 6 November 2026 (Asia/Manila).

0 confirmed vulnerabilities; 4 independently reviewed needs-validation leads; 0 rejected claims. Unconfirmed leads have no severity.

Reviewed commit: d44e926c1405be27041bf4c93043f1956d06d6a6. Worktree contained untracked .agents/ files and skills-lock.json; exact paths, sizes and SHA-256 hashes are in [run-metadata.json](security/audit/run-1/run-metadata.json). Application code was not modified.

No target-controlled code, tests, builds, emulators or fixtures ran because the complete required OS sandbox was unavailable. No service was started or contacted, dependencies installed, real credentials accessed, or ambient environment captured.

Coverage: 31 units; 12 covered, 5 candidate, 14 blocked, 0 deferred. A separate final coverage critic accepted no further source work. Blocked units remain blocked. No prior compatible ledger existed; one pass does not exhaust this codebase.

Reports: [Interim report](00-INTERIM-SECURITY-AUDIT.md), [NEEDS-VALIDATION.md](security/audit/run-1/NEEDS-VALIDATION.md), [FINDINGS-DETAIL.md](security/audit/run-1/FINDINGS-DETAIL.md). Structured evidence: [findings.json](security/audit/run-1/findings.json) and [coverage-ledger.json](security/audit/run-1/coverage-ledger.json).

Scope: Express API and parallel public/private routes; PostgreSQL schema, migrations, grants, RLS and transaction identity; manuscript PDF/DOCX validation, scanning and storage; Python and Node workers; backup, restore and deletion maintenance; Android public-cache and session-vault library; all GitHub workflows. Generated diagrams, submitted binaries, benchmark results and historical evidence were context, not independent runtime proof. Actual .env, .private and credential contents were not read.

No agent budget was set. Four reconnaissance assignments informed eight focused hunter assignments in two waves. Each wave had a fresh coverage critic, followed by a distinct final-clean critic. Each retained lead received independent candidate validation and final-record review from a reviewer who neither hunted nor candidate-validated that lead. One malformed candidate response was discarded and independently rerun. Assignment mapping and discarded-response detail are recorded in run metadata.

## Security posture

Source consistently applies strict request schemas, parameterized SQL, current opaque bearer-session checks, transaction-local identity and forced RLS. Manuscripts require authorization, parsing and scanning before storage, with random object keys. Authenticated backup encryption, private Android storage and read-only CI token declarations are positive source patterns. Remaining leads concern shared-resource and availability boundaries. These observations do not establish runtime or deployment behavior.

## Confirmed findings

No confirmed vulnerabilities. No bounded target execution was permitted; no exploit, unauthorized record access, parser containment failure or availability loss was observed. There is no confirmed-findings severity table to populate.

## NEEDS VALIDATION

These independently reviewed hypotheses have source traces and exact blockers. They are not confirmed vulnerabilities and have no severity. Order below reflects investigation utility, not severity.

| Lead | Entry source | Missing validation |
|---|---|---|
| Anonymous failed activation requests consume a global activation account allowance | [src/app.js:68](src/app.js#L68) | No bounded HTTP/PostgreSQL reproduction was executed. The parent-approved OS sandbox is unavailable because configured OS-enforced memory, process-count and scratch disk quotas are missing, and Docker/Podman/bwrap are absent. |
| Interrupted compressed uploads may retain process-wide upload slots | [src/storage/routes.js:11](src/storage/routes.js#L11) | No target execution permitted: available Darwin sandbox-exec lacks configured memory, process-count and scratch-disk quotas, and no complete alternative sandbox is available. Repeatable retention after abort and after the configured HTTP timeout was not observed. |
| PDF object-stream expansion may exceed the worker memory budget | [src/storage/routes.js:22](src/storage/routes.js#L22) | No target code or PDF fixture was executed: the required OS sandbox lacks configured OS-enforced memory, process-count and scratch-disk quotas; Docker/Podman/bwrap are unavailable. |
| Public search may materialize the complete approved catalogue before applying bounded search filters | [src/app.js:132](src/app.js#L132) | Required OS-enforced execution sandbox is unavailable: sandbox-exec alone lacks configured memory, process-count and scratch-disk quotas; docker, podman and bwrap are unavailable. No target code was executed. |

### Anonymous failed activation requests consume a global activation account allowance

Fingerprint: src/app.js:activation-shared-account-lockout

Source review supports a shared activation reservation key: five syntactically valid failed activation requests could cause a different invitee to receive 429 before token verification. Independent runtime reproduction remains blocked. The apparent effect is temporary activation denial, not account takeover or denial of existing authenticated sessions.

Source path:

1. [src/app.js:68](src/app.js#L68) — anonymous activation endpoint: Strict schema accepts a lowercase 64-hex token and a 12–128-character password without bearer authentication.
2. [src/app.js:70](src/app.js#L70) — activation reservation selector: The account selector is the constant activation for every token and invitee; source IP remains a separate selector.
3. [src/security/limiter.js:13](src/security/limiter.js#L13) — reserveLogin key construction: SHA-256 of account:activation is identical for all activation requests; account and IP hashes are forwarded independently.
4. [src/security/context.js:19](src/security/context.js#L19) — reservation transaction persistence: Each db.query commits its own transaction, so successful reservation insertion is committed before the later token-verification query and invalid-token return.
5. [db/migrations/002_ias_controls.sql:141](db/migrations/002_ias_controls.sql#L141) — reservation accumulation: Admitted requests insert one reservation under each key, guarded by sorted transaction advisory locks; expiry pruning is 15 minutes.
6. [src/app.js:72](src/app.js#L72) — invalid activation cleanup: crm_activate returning false causes 400 without crm_finish_login; successful activation only deletes its own request UUID reservations.
7. [db/migrations/002_ias_controls.sql:140](db/migrations/002_ias_controls.sql#L140) — later unrelated reservation: A later request with another IP still shares the account key; five retained account reservations cause false before new insertion.
8. [src/app.js:70](src/app.js#L70) — unrelated valid invitee rejection: A false reservation result returns 429 and Retry-After 900 before crm_activate can verify an otherwise valid invitation. This cross-IP HTTP result has not been executed.

Exact blockers:

- No bounded HTTP/PostgreSQL reproduction was executed. The parent-approved OS sandbox is unavailable because configured OS-enforced memory, process-count and scratch disk quotas are missing, and Docker/Podman/bwrap are absent.
- A disposable seeded PostgreSQL service inside the required sandbox was not started or contacted.

Bounded local next step: When the complete OS sandbox is available, start disposable PostgreSQL with current migrations and synthetic roles; use an empty allowlisted environment, read-only source/tools, scratch-only writes, network isolation with loopback only, and explicit CPU/memory/process/file/disk/time limits. Create a synthetic staff invitation and first establish a clean valid activation control. Reset synthetic state, make five sequential compliant activation requests with nonmatching dummy tokens from one fixture-controlled peer IP, then submit a fresh valid invitation token from a different fixture-controlled peer IP. Observe the exact HTTP statuses, unchanged active/used state, and five account-key reservations; stop at that minimum result. Control peer IP with a trusted injected test adapter or separate isolated loopback source bindings, without enabling trust proxy. Confirm recovery by aging only disposable reservation timestamps beyond 15 minutes and issuing a fresh unexpired synthetic invitation. No real accounts, ambient credentials, live services or stress. Existing source controls require valid JSON under 16 KiB, sufficient ordinary request tokens and successful sequential password hashing.

### Interrupted compressed uploads may retain process-wide upload slots

Fingerprint: src/storage/routes.js:compressed-body-abort-upload-slot-retention

A student or faculty member with access to a study can pass authentication, membership and per-user upload-rate admission, then reserve one of two process-wide upload slots before raw body parsing. Cleanup is idempotent but runs only from the raw-parser error callback or subsequent handler finally. Locally installed body-parser source enables compression by default, pipes the HTTP request to a decoder and passes that decoder to raw-body; raw-body listens for decoder abort/end/error rather than HTTP-request abort. If an interrupted compressed request never completes the decoder callback, two small interrupted uploads could exhaust this process-wide capacity and deny uploads to another researcher. This cross-principal availability outcome and retention beyond the HTTP timeout are hypotheses, not observed effects. Strong controls include opaque-session authentication, student/faculty role and study membership checks before body parsing, global and per-user upload token buckets (upload burst5, refill1/180 seconds), exact octet-stream requirement, a 25,000,000-byte parsed-body limit, two-slot concurrency cap, parser-error/finally cleanup and server request/header timeouts of 60/15 seconds. Normal malformed or completed bodies can release slots; persistence until process restart is not established.

Source path:

1. [src/storage/routes.js:11](src/storage/routes.js#L11) — POST document upload: Authenticated member researcher supplies octet-stream content, filename and Content-Encoding.
2. [src/storage/routes.js:18](src/storage/routes.js#L18) — upload admission: Increment process-global uploads and install release closure, without registering HTTP abort/close listeners.
3. [src/storage/routes.js:22](src/storage/routes.js#L22) — raw body acquisition: Call express.raw with a byte limit and default inflation behavior; release on error only after its callback runs.
4. node_modules/body-parser/lib/read.js:118 (local dependency source; not committed) — compressed request reader: Locally installed dependency creates a decompression stream and req.pipe(stream); getBody at line 134 receives that stream. Correspondence to locked package bytes is unverified.
5. node_modules/raw-body/index.js:203 (local dependency source; not committed) — raw-body stream events: Locally installed raw-body registers aborted/close/data/end/error listeners on the supplied decoder stream; close cleans listeners without itself completing the callback. Actual Node request-abort propagation is unobserved.
6. [src/storage/routes.js:16](src/storage/routes.js#L16) — shared upload admission: If two slots remain retained, all further uploads receive capacity-exceeded 503, irrespective of study or user.

Exact blockers:

- No target execution permitted: available Darwin sandbox-exec lacks configured memory, process-count and scratch-disk quotas, and no complete alternative sandbox is available. Repeatable retention after abort and after the configured HTTP timeout was not observed.
- Node24 HTTP request abort/timeout to zlib decoder event propagation is decisive. The parser source alone cannot prove that its callback remains pending, that slots remain retained, or that a second dummy researcher is denied after cleanup should have occurred.
- Locally installed dependency files match the recorded dependency-source-manifest hashes when read during this review, but ignored installed source is not commit-controlled or verified against package-lock integrity.
- Deployed ingress compression rejection, full request buffering, disconnect propagation and process recovery/topology were not observed and may prevent or limit this scenario.

Bounded local next step: In a fully OS-enforced offline sandbox with low CPU/memory/process/file/disk/time bounds and isolated loopback, use the intended Node24 runtime and dependencies independently verified against the committed lock. Start the actual server timeout configuration with disposable PostgreSQL, synthetic researcher/member sessions and fake scanner/object store. Abort at most two tiny incomplete gzip uploads after deterministic admission confirmation, then inspect counter cleanup and one tiny valid upload from a second dummy researcher. Include observation after the 60-second request timeout within a bounded fixture; do not infer indefinite retention from a brief delay. Compare identity-body abort and compressed-body completion/error controls. Stop at the counter/admission result, never contact shared services, and reject the candidate if cleanup releases capacity.

Owner-observed configuration check: Owner should inspect ingress compressed-body acceptance/rejection, buffering and disconnect propagation, configured HTTP deadlines, process isolation and restart behavior from configuration and existing telemetry. Do not probe or load a deployed service.

### PDF object-stream expansion may exceed the worker memory budget

Fingerprint: src/storage/validate.js:pdf-object-stream-expanded-bytes-unbounded

An authenticated student/faculty member can reach eager PDF object-stream decoding with an upload of at most 25,000,000 bytes. The inspected local dependency grows typed-array buffers without an application decoded-byte ceiling. Two concurrent upload admissions, per-user upload throttling, a 128 MiB V8 old-generation limit, a 4 MiB stack limit, and a ten-second termination timer constrain the path. No accepted expansion fixture, bypass of those effective bounds, or meaningful effect on another principal has been observed. The missing decoded-byte cap alone is hardening; the shared-memory availability hypothesis remains unvalidated.

Source path:

1. [src/storage/routes.js:22](src/storage/routes.js#L22) — raw manuscript body: After bearer authentication, student/faculty role and research membership checks, a caller submits application/octet-stream bytes under the 25,000,000-byte raw-body limit; uploads are admitted at most two at a time per process.
2. [src/storage/routes.js:27](src/storage/routes.js#L27) — document validation dispatch: Accepted bytes and filename enter worker validation before antivirus scanning/storage.
3. [src/storage/isolated-validation.js:4](src/storage/isolated-validation.js#L4) — API-process worker thread: Bytes are supplied to a fixed worker module with 128 MiB old-generation and 4 MiB stack limits. A ten-second timer and message/error/exit handlers terminate the worker; total typed-array memory containment is not established by this source.
4. [src/storage/validation-worker.js:3](src/storage/validation-worker.js#L3) — validation worker: Construct buffer and call validateDocument.
5. [src/storage/validate.js:51](src/storage/validate.js#L51) — PDF branch: PDFDocument.load parses the document before page count/encryption checks, with no expansion option supplied.
6. node_modules/pdf-lib/cjs/core/parser/PDFParser.js:140 (local dependency source; not committed) — PDF object-stream dispatch: ObjStm indirect objects enter PDFObjectStreamParser.
7. node_modules/pdf-lib/cjs/core/parser/ByteStream.js:58 (local dependency source; not committed) — raw object stream decoding: Decode entire PDF raw stream eagerly before constructing parser ByteStream.
8. node_modules/pdf-lib/cjs/core/streams/DecodeStream.js:133 (local dependency source; not committed) — decoded buffer allocation: The inspected dependency doubles an allocation size and creates/copies a Uint8Array without an explicit expanded-byte ceiling. Allocation beyond effective runtime bounds and shared API impact are not observed.

Exact blockers:

- No target code or PDF fixture was executed: the required OS sandbox lacks configured OS-enforced memory, process-count and scratch-disk quotas; Docker/Podman/bwrap are unavailable.
- No bounded accepted PDF fixture establishes expansion magnitude, worker typed-array memory accounting under the selected Node runtime, or whether existing heap/time/admission bounds prevent meaningful shared-process pressure. No other-principal impact or resource retention after termination was observed.
- Actual API process/container limits, supervisor recovery, upstream upload admission and deployed dependency bytes are unobserved. Local installed dependency source was not independently reproduced from lock integrity.

Bounded local next step: Only after complete OS enforcement is available, reproduce locked dependency bytes in an empty allowlisted environment with no external network, read-only source/tools, scratch-only writes and low memory/process/disk/time limits. Use one synthetic authenticated member and disposable/mock database, scanner and object store. Through the native upload interface, compare a benign control with predeclared small compressed ObjStm fixtures at two low decoded-size points, capped at 8 MiB total expanded bytes. Observe acceptance/rejection, worker external/array-buffer accounting and total-process memory against the control, deadline termination and post-termination recovery. Keep a second synthetic principal making a trivial bounded request as a health control; do not cause or approach exhaustion. Stop at the predeclared limits. Small expansion alone does not confirm a vulnerability: require a defensible connection to an owner-observed shared budget without stress, or retain hardening/unvalidated status. Promote evidence only using the trusted parent bounded no-follow procedure.

Owner-observed configuration check: Owner should inspect effective rendered API/container memory and worker isolation settings, upload ingress limits, deployed Node/dependency versions and supervisor recovery. Determine whether worker backing allocations count against a separate enforceable budget or the same API-process budget and whether the bounded amplification could materially impair another principal under configured two-upload admission. Use isolated staging with synthetic data only; do not probe or exhaust production.

### Public search may materialize the complete approved catalogue before applying bounded search filters

Fingerprint: public-search-definer-materialization-shared-pool

An anonymous POST /api/v1/research/search can issue a small validated selective query against crm_public_research(). The SECURITY DEFINER SQL function accepts no predicates or bounds and selects all Approved catalogue rows; outer SQL applies filtering, ordering and pagination. This is a source-grounded hypothesis of corpus-dependent work that could occupy the same ten-connection pool used for login, authentication and the global limiter. It is not an established availability vulnerability: an expensive valid search alone is insufficient, actual function materialization and meaningful interference with another principal remain unobserved. Strong controls include parameterized SQL, a strict 16KiB JSON body and bounded keyword/metadata/pagination, Approved-only public projection with pinned search_path, the global 300-token/5-per-second IP bucket, a configured 10-second statement timeout and 5-second acquisition timeout, transaction rollback and finally-release. No search cancellation listener or separate search concurrency admission appears. Recovery should occur on statement completion/timeout and transaction cleanup; no persistent resource loss is claimed.

Source path:

1. [src/app.js:132](src/app.js#L132) — public search route: Anonymous POST /api/v1/research/search accepts a validated search body and calls searchResearch without authentication.
2. [src/research/search.js:8](src/research/search.js#L8) — searchSql: Selects from crm_public_research(), applying keyword/year/department predicates and LIMIT/OFFSET outside the function.
3. [db/migrations/002_ias_controls.sql:84](db/migrations/002_ias_controls.sql#L84) — crm_public_research: SECURITY DEFINER SQL set-returning function selects every Approved record including abstract, without accepting filter or limit parameters.
4. [src/research/search.js:30](src/research/search.js#L30) — searchResearch shared database query: Awaits query completion on the shared connection before COMMIT/release; no request cancellation is propagated to this function.

Exact blockers:

- Required OS-enforced execution sandbox is unavailable: sandbox-exec alone lacks configured memory, process-count and scratch-disk quotas; docker, podman and bwrap are unavailable. No target code was executed.
- No disposable PostgreSQL service was available for a bounded query-plan/materialization and cancellation fixture; neither query amplification nor a meaningful effect on a separate dummy principal was demonstrated.
- Actual catalogue cardinality, upstream search admission/concurrency, deployment pool isolation and timeout attachment remain owner-observed facts. Source alone does not establish that these controls permit meaningful shared interference.

Bounded local next step: Use only a fully enforced offline sandbox and disposable PostgreSQL with synthetic Approved and private rows. Preserve configured max10 pool, 10-second statement and 5-second acquisition timeouts. At two bounded corpus sizes, EXPLAIN (ANALYZE, BUFFERS) one selective keyword/year/department query with limit1 to establish Function Scan/materialization and filtering behavior. With a deterministic test-only query gate rather than load, inspect that one cancelled public request retains its connection until query cleanup and whether independently admitted dummy authentication work shares that resource. Do not saturate or stress the pool. Reject security classification if the result shows only ordinary search cost without meaningful shared effect; treat cancellation or workload isolation as hardening in that case.

Owner-observed configuration check: Owner should inspect existing normal-query plans and telemetry, catalogue size, deployed statement/acquisition timeout attachment, public-search concurrency/admission bounds and shared-pool topology. Establish whether permitted search work can delay another principal beyond the service availability budget, accounting for timeout recovery; do not send probes or generate load.

## Separate hardening notes

These observations do not establish vulnerabilities:

- Verify existing crm_app role attributes, memberships and migration ownership; setup creates restrictive attributes only when the role is absent.
- Define whether approval covers each metadata revision. Source permits members to edit Approved metadata; no immutable per-revision approval invariant was established.
- Consider authenticated tar member-type/link checks, descriptor-based key loading and aggregate backup quotas. Ordinary uploaded bytes cannot create tar headers in the current producer.
- Android public template files have no lifetime eviction. The current server publishes fixed synthetic content; no lower-trust publisher or cross-app disclosure was established.
- Pin reviewed CI action/image digests and strengthen dependency verification. Mutable tags alone do not establish a privileged release-boundary failure.
- Android CI builds instrumentation tests but does not run them on a device. Integrating-app packaging, logout and restore behavior remain unobserved.

## Positive source patterns

- Random hashed bearer tokens, active-account checks, expiring single-use activation and transaction-local request identity.
- FORCE RLS, owner/member/assigned-reviewer predicates, protected-column grants and explicit Approved-only public projection.
- Manuscript role/membership checks before raw admission; declared/actual DOCX expansion checks; fail-closed scanner; random object names and compensating removal.
- Repeatable-read database/object snapshots; AES-GCM with authenticated headers; authentication awaited before extraction; quarantined restore with deletion replay.
- Android HTTPS/no-redirect/same-origin downloads, size/checksum checks and Keystore AES-GCM vault in noBackupFilesDir.
- Contents-read workflows, ephemeral synthetic credentials and no visible publish/deploy path.

## Coverage ledger

| Area | Source covered | Candidate-linked | Blocked | Deferred |
|---|---:|---:|---:|---:|
| android | 2 | 0 | 2 | 0 |
| api | 4 | 1 | 1 | 0 |
| api_resources | 0 | 1 | 0 | 0 |
| backup | 0 | 0 | 5 | 0 |
| ci | 1 | 0 | 3 | 0 |
| database | 1 | 0 | 3 | 0 |
| storage | 2 | 2 | 0 | 0 |
| workers | 2 | 1 | 0 | 0 |

Totals: {"blocked": 14, "candidate": 5, "covered": 12}. Candidate-linked units retain their source evidence and final dispositions; they are not unreviewed findings. Every fingerprint has an independently verified final record. No units are deferred or out of scope; generated/context-only inputs are not represented as covered runtime surfaces.

Fourteen units retain execution/deployment blockers. Source-covered means a recorded source invariant was reviewed without a surviving candidate, not runtime safety. The first critic added HTTP/public-search resource admission; the next post-wave critic and separate final critic accepted no more source work. Storage expansion coverage and crosslinked worker evidence address decompression containment. No prior confirmations were carried or changed-source revalidations claimed; no prior ledger existed. This pass does not exhaust all dependencies, lifecycle interactions or historical revisions.

## Exact execution and service gaps

Host: Darwin. sandbox-exec exists; docker, podman and bwrap commands were absent. No configured mechanism established all required OS-enforced memory, process-count and scratch-disk quota bounds, or an isolated loopback namespace for disposable services. sandbox-exec alone does not establish these controls. The psql client exists, but no isolated PostgreSQL, scanner or object-store service was started because target execution was prohibited. This does not assert that PostgreSQL cannot be installed or exists nowhere on the host. Application Worker heap/time limits are not an audit sandbox.

No target-generated artifacts existed or were promoted. All ledger checks use source method and null artifacts. Only trusted audit orchestration, file hashing, source reads and the supplied audit validators ran outside the sandbox; application scripts, imports, builds, tests and fixture processing did not run.

Unperformed checks: multi-principal PostgreSQL RLS/grants/pool reuse; activation and HTTP cancellation fixtures; parser memory accounting; algorithm worker cancellation; cryptographic/restore/deletion replay fixtures; rendered policy/provider attachment; Android instrumentation/final manifests; workflow execution; current vulnerability-advisory queries. Ignored local dependency implementations were read as text and hashed in dependency-source-manifest.json; package-archive integrity and deployed bytes were not reproduced.

Deployment-only facts include runtime DB attributes/BYPASSRLS/ownership/migrations, TLS/CA/runtime mode, listener/proxy behavior, S3/IAM attachment and retained versions, ClamAV network trust, backup/recovery/key separation, enabled timers/retention, final Android packaging/lifecycle and hosted runner/branch protection. The resolution plans request bounded synthetic fixtures or owner observation of configuration/telemetry; no live probe or load is prescribed.

## Artifact verification and preservation

findings.json and coverage-ledger.json pass the supplied skill validators. This proves format and ledger consistency, not security correctness. Source-manifest and final Git/hash comparison confirm no application or pre-existing uncommitted file changes. The original audit output was saved outside the repository; this copy packages its finalized reports for review. See validation-results.json and source-preservation.json.
