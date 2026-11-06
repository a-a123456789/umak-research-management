# Needs-validation detail

**Assessment status: Interim; OWASP testing pending.**

No item below is confirmed and no severity is assigned. No target fixture ran. Execute the bounded synthetic/disposable plans only after every required sandbox control is available.

## Anonymous failed activation requests consume a global activation account allowance

Fingerprint: src/app.js:activation-shared-account-lockout

Source review supports a shared activation reservation key: five syntactically valid failed activation requests could cause a different invitee to receive 429 before token verification. Independent runtime reproduction remains blocked. The apparent effect is temporary activation denial, not account takeover or denial of existing authenticated sessions.

Claimed root cause: The activation endpoint passes the constant string activation to a limiter designed to reject on either account-specific or IP-specific failed-attempt budgets, causing unrelated invitees to share an attacker-consumable account bucket.

### Verified source trace

1. [src/app.js:68](../../../src/app.js#L68) — anonymous activation endpoint: Strict schema accepts a lowercase 64-hex token and a 12–128-character password without bearer authentication.
2. [src/app.js:70](../../../src/app.js#L70) — activation reservation selector: The account selector is the constant activation for every token and invitee; source IP remains a separate selector.
3. [src/security/limiter.js:13](../../../src/security/limiter.js#L13) — reserveLogin key construction: SHA-256 of account:activation is identical for all activation requests; account and IP hashes are forwarded independently.
4. [src/security/context.js:19](../../../src/security/context.js#L19) — reservation transaction persistence: Each db.query commits its own transaction, so successful reservation insertion is committed before the later token-verification query and invalid-token return.
5. [db/migrations/002_ias_controls.sql:141](../../../db/migrations/002_ias_controls.sql#L141) — reservation accumulation: Admitted requests insert one reservation under each key, guarded by sorted transaction advisory locks; expiry pruning is 15 minutes.
6. [src/app.js:72](../../../src/app.js#L72) — invalid activation cleanup: crm_activate returning false causes 400 without crm_finish_login; successful activation only deletes its own request UUID reservations.
7. [db/migrations/002_ias_controls.sql:140](../../../db/migrations/002_ias_controls.sql#L140) — later unrelated reservation: A later request with another IP still shares the account key; five retained account reservations cause false before new insertion.
8. [src/app.js:70](../../../src/app.js#L70) — unrelated valid invitee rejection: A false reservation result returns 429 and Retry-After 900 before crm_activate can verify an otherwise valid invitation. This cross-IP HTTP result has not been executed.

### Source evidence

- [src/app.js:70](../../../src/app.js#L70) — Constant activation account selector is used for anonymous activation requests.
- [src/app.js:72](../../../src/app.js#L72) — Invalid tokens retain reservations; only successful activation reaches cleanup.
- [src/security/limiter.js:13](../../../src/security/limiter.js#L13) — Account/IP hashes are forwarded as two independent rejection keys.
- [db/migrations/002_ias_controls.sql:139](../../../db/migrations/002_ias_controls.sql#L139) — Reservations expire after 15 minutes; threshold is five on either key. Sorted advisory locking makes the shared state atomic across API instances.
- [db/migrations/005_activation_and_cleanup.sql:24](../../../db/migrations/005_activation_and_cleanup.sql#L24) — The token verifier correctly checks expiry, unused state and row locking, but runs only after the shared limiter has admitted the request.
- [src/app.js:26](../../../src/app.js#L26) — General request limiter precedes activation. Its default capacity 300 and refill 5/second in src/security/limiter.js:3 do not visibly prevent five sequential accepted invalid requests.
- [src/security/context.js:19](../../../src/security/context.js#L19) — The reservation query commits independently, excluding an enclosing HTTP transaction rollback as a source-visible refutation.
- [src/crypto.js:8](../../../src/crypto.js#L8) — Four concurrent expensive operations are allowed. Sequential requests avoid concurrency rejection; this cap does not partition reservation ownership.
- [db/migrations/002_ias_controls.sql:145](../../../db/migrations/002_ias_controls.sql#L145) — crm_finish_login deletes only the current request UUID, not all account reservations. SQL grants permit the application to call limiter helpers.
- [scripts/privacy-maintenance.js:26](../../../scripts/privacy-maintenance.js#L26) — Maintenance deletes reservations older than 15 minutes, limiting persistence but not preventing the earlier shared-window effect.
- [test/ias-controls.test.js:93](../../../test/ias-controls.test.js#L93) — Existing source tests cover single-use and expiring activation; login limiter tests at line 108 cover shared-window semantics, but neither independently demonstrates this cross-invitee activation trace.

### Exact blockers

- No bounded HTTP/PostgreSQL reproduction was executed. The parent-approved OS sandbox is unavailable because configured OS-enforced memory, process-count and scratch disk quotas are missing, and Docker/Podman/bwrap are absent.
- A disposable seeded PostgreSQL service inside the required sandbox was not started or contacted.

### Resolution plan

**Bounded local fixture**: When the complete OS sandbox is available, start disposable PostgreSQL with current migrations and synthetic roles; use an empty allowlisted environment, read-only source/tools, scratch-only writes, network isolation with loopback only, and explicit CPU/memory/process/file/disk/time limits. Create a synthetic staff invitation and first establish a clean valid activation control. Reset synthetic state, make five sequential compliant activation requests with nonmatching dummy tokens from one fixture-controlled peer IP, then submit a fresh valid invitation token from a different fixture-controlled peer IP. Observe the exact HTTP statuses, unchanged active/used state, and five account-key reservations; stop at that minimum result. Control peer IP with a trusted injected test adapter or separate isolated loopback source bindings, without enabling trust proxy. Confirm recovery by aging only disposable reservation timestamps beyond 15 minutes and issuing a fresh unexpired synthetic invitation. No real accounts, ambient credentials, live services or stress. Existing source controls require valid JSON under 16 KiB, sufficient ordinary request tokens and successful sequential password hashing.
## Interrupted compressed uploads may retain process-wide upload slots

Fingerprint: src/storage/routes.js:compressed-body-abort-upload-slot-retention

A student or faculty member with access to a study can pass authentication, membership and per-user upload-rate admission, then reserve one of two process-wide upload slots before raw body parsing. Cleanup is idempotent but runs only from the raw-parser error callback or subsequent handler finally. Locally installed body-parser source enables compression by default, pipes the HTTP request to a decoder and passes that decoder to raw-body; raw-body listens for decoder abort/end/error rather than HTTP-request abort. If an interrupted compressed request never completes the decoder callback, two small interrupted uploads could exhaust this process-wide capacity and deny uploads to another researcher. This cross-principal availability outcome and retention beyond the HTTP timeout are hypotheses, not observed effects. Strong controls include opaque-session authentication, student/faculty role and study membership checks before body parsing, global and per-user upload token buckets (upload burst5, refill1/180 seconds), exact octet-stream requirement, a 25,000,000-byte parsed-body limit, two-slot concurrency cap, parser-error/finally cleanup and server request/header timeouts of 60/15 seconds. Normal malformed or completed bodies can release slots; persistence until process restart is not established.

Claimed root cause: Upload admission cleanup depends on body-parser completing its callback; compressed-stream cancellation has no independent request lifecycle cleanup hook.

### Verified source trace

1. [src/storage/routes.js:11](../../../src/storage/routes.js#L11) — POST document upload: Authenticated member researcher supplies octet-stream content, filename and Content-Encoding.
2. [src/storage/routes.js:18](../../../src/storage/routes.js#L18) — upload admission: Increment process-global uploads and install release closure, without registering HTTP abort/close listeners.
3. [src/storage/routes.js:22](../../../src/storage/routes.js#L22) — raw body acquisition: Call express.raw with a byte limit and default inflation behavior; release on error only after its callback runs.
4. node_modules/body-parser/lib/read.js:118 (local dependency source; not committed) — compressed request reader: Locally installed dependency creates a decompression stream and req.pipe(stream); getBody at line 134 receives that stream. Correspondence to locked package bytes is unverified.
5. node_modules/raw-body/index.js:203 (local dependency source; not committed) — raw-body stream events: Locally installed raw-body registers aborted/close/data/end/error listeners on the supplied decoder stream; close cleans listeners without itself completing the callback. Actual Node request-abort propagation is unobserved.
6. [src/storage/routes.js:16](../../../src/storage/routes.js#L16) — shared upload admission: If two slots remain retained, all further uploads receive capacity-exceeded 503, irrespective of study or user.

### Source evidence

- [src/storage/routes.js:19](../../../src/storage/routes.js#L19) — Release closure is called by parser error callback or final handler finally; no request abort release is registered.
- node_modules/body-parser/lib/utils.js:45 (local dependency source; not committed) — Inflation enabled unless explicitly false; upload route does not disable it.
- node_modules/body-parser/lib/read.js:118 (local dependency source; not committed) — Compressed bodies use an independently created decoder with req.pipe(stream).
- node_modules/raw-body/index.js:203 (local dependency source; not committed) — Listener registration targets only the stream passed to raw-body.
- [src/server.js:14](../../../src/server.js#L14) — HTTP request timeout is present; whether socket closure completes decoder callback is the decisive missing fact.
- [package-lock.json:761](../../../package-lock.json#L761) — Committed lock selects body-parser 2.4.0; installed local dependency source was read as text, not executed.
- [src/storage/routes.js:11](../../../src/storage/routes.js#L11) — Upload-specific limiter allows burst5/refill1 per180 seconds, then checks configured services, researcher role, study membership and capacity before accepting exact octet-stream content.
- [src/storage/validate.js:4](../../../src/storage/validate.js#L4) — MAX_DOCUMENT_BYTES is 25,000,000 and is used as the raw parser decoded-byte limit; this bounds accepted body size but does not independently release admission on cancellation.
- node_modules/raw-body/index.js:291 (local dependency source; not committed) — Installed dependency close cleanup removes stream listeners and buffer; completion callback occurs through done on end/error/aborted. Runtime decoder lifecycle remains decisive and dependency bytes are not lock-integrity verified.

### Exact blockers

- No target execution permitted: available Darwin sandbox-exec lacks configured memory, process-count and scratch-disk quotas, and no complete alternative sandbox is available. Repeatable retention after abort and after the configured HTTP timeout was not observed.
- Node24 HTTP request abort/timeout to zlib decoder event propagation is decisive. The parser source alone cannot prove that its callback remains pending, that slots remain retained, or that a second dummy researcher is denied after cleanup should have occurred.
- Locally installed dependency files match the recorded dependency-source-manifest hashes when read during this review, but ignored installed source is not commit-controlled or verified against package-lock integrity.
- Deployed ingress compression rejection, full request buffering, disconnect propagation and process recovery/topology were not observed and may prevent or limit this scenario.

### Resolution plan

**Bounded local fixture**: In a fully OS-enforced offline sandbox with low CPU/memory/process/file/disk/time bounds and isolated loopback, use the intended Node24 runtime and dependencies independently verified against the committed lock. Start the actual server timeout configuration with disposable PostgreSQL, synthetic researcher/member sessions and fake scanner/object store. Abort at most two tiny incomplete gzip uploads after deterministic admission confirmation, then inspect counter cleanup and one tiny valid upload from a second dummy researcher. Include observation after the 60-second request timeout within a bounded fixture; do not infer indefinite retention from a brief delay. Compare identity-body abort and compressed-body completion/error controls. Stop at the counter/admission result, never contact shared services, and reject the candidate if cleanup releases capacity.

**Owner-observed facts**: Owner should inspect ingress compressed-body acceptance/rejection, buffering and disconnect propagation, configured HTTP deadlines, process isolation and restart behavior from configuration and existing telemetry. Do not probe or load a deployed service.
## PDF object-stream expansion may exceed the worker memory budget

Fingerprint: src/storage/validate.js:pdf-object-stream-expanded-bytes-unbounded

An authenticated student/faculty member can reach eager PDF object-stream decoding with an upload of at most 25,000,000 bytes. The inspected local dependency grows typed-array buffers without an application decoded-byte ceiling. Two concurrent upload admissions, per-user upload throttling, a 128 MiB V8 old-generation limit, a 4 MiB stack limit, and a ten-second termination timer constrain the path. No accepted expansion fixture, bypass of those effective bounds, or meaningful effect on another principal has been observed. The missing decoded-byte cap alone is hardening; the shared-memory availability hypothesis remains unvalidated.

Claimed root cause: PDF parsing eagerly expands compressed object streams inside a worker thread of the API process without an explicit decoded-byte budget. If typed-array backing allocations can exceed the effective worker budget before termination, the resulting memory pressure may affect unrelated requests in the same API process; runtime accounting and that cross-principal consequence remain decisive unknowns.

### Verified source trace

1. [src/storage/routes.js:22](../../../src/storage/routes.js#L22) — raw manuscript body: After bearer authentication, student/faculty role and research membership checks, a caller submits application/octet-stream bytes under the 25,000,000-byte raw-body limit; uploads are admitted at most two at a time per process.
2. [src/storage/routes.js:27](../../../src/storage/routes.js#L27) — document validation dispatch: Accepted bytes and filename enter worker validation before antivirus scanning/storage.
3. [src/storage/isolated-validation.js:4](../../../src/storage/isolated-validation.js#L4) — API-process worker thread: Bytes are supplied to a fixed worker module with 128 MiB old-generation and 4 MiB stack limits. A ten-second timer and message/error/exit handlers terminate the worker; total typed-array memory containment is not established by this source.
4. [src/storage/validation-worker.js:3](../../../src/storage/validation-worker.js#L3) — validation worker: Construct buffer and call validateDocument.
5. [src/storage/validate.js:51](../../../src/storage/validate.js#L51) — PDF branch: PDFDocument.load parses the document before page count/encryption checks, with no expansion option supplied.
6. node_modules/pdf-lib/cjs/core/parser/PDFParser.js:140 (local dependency source; not committed) — PDF object-stream dispatch: ObjStm indirect objects enter PDFObjectStreamParser.
7. node_modules/pdf-lib/cjs/core/parser/ByteStream.js:58 (local dependency source; not committed) — raw object stream decoding: Decode entire PDF raw stream eagerly before constructing parser ByteStream.
8. node_modules/pdf-lib/cjs/core/streams/DecodeStream.js:133 (local dependency source; not committed) — decoded buffer allocation: The inspected dependency doubles an allocation size and creates/copies a Uint8Array without an explicit expanded-byte ceiling. Allocation beyond effective runtime bounds and shared API impact are not observed.

### Source evidence

- [src/storage/validate.js:47](../../../src/storage/validate.js#L47) — Input buffer size is bounded; DOCX has separate inflated-size accounting, while PDF load has none.
- [src/storage/isolated-validation.js:4](../../../src/storage/isolated-validation.js#L4) — Worker limits old-generation heap and stack; timeout is 10 seconds at line 8.
- node_modules/pdf-lib/cjs/core/parser/PDFObjectStreamParser.js:14 (local dependency source; not committed) — Constructor calls ByteStream.fromPDFRawStream before object-offset validation.
- node_modules/pdf-lib/cjs/core/streams/DecodeStream.js:125 (local dependency source; not committed) — decode repeatedly calls readBlock until EOF.
- node_modules/pdf-lib/cjs/core/streams/FlateStream.js:280 (local dependency source; not committed) — Flate backreferences trigger buffer expansion via ensureBuffer.
- [package-lock.json:1614](../../../package-lock.json#L1614) — Committed lock selects pdf-lib 1.17.1; dependency implementation was inspected as local source only.
- [src/storage/routes.js:11](../../../src/storage/routes.js#L11) — Upload bucket capacity is five with one token per 180 seconds, keyed to authenticated identity; role, membership, enabled storage/scanner, and at most two process-wide admitted uploads precede raw body parsing.
- [src/storage/isolated-validation.js:6](../../../src/storage/isolated-validation.js#L6) — Success, invalid result, error, exit and ten-second deadline converge on finish, which clears the timer and invokes worker termination. No post-timeout resource retention was observed.

### Exact blockers

- No target code or PDF fixture was executed: the required OS sandbox lacks configured OS-enforced memory, process-count and scratch-disk quotas; Docker/Podman/bwrap are unavailable.
- No bounded accepted PDF fixture establishes expansion magnitude, worker typed-array memory accounting under the selected Node runtime, or whether existing heap/time/admission bounds prevent meaningful shared-process pressure. No other-principal impact or resource retention after termination was observed.
- Actual API process/container limits, supervisor recovery, upstream upload admission and deployed dependency bytes are unobserved. Local installed dependency source was not independently reproduced from lock integrity.

### Resolution plan

**Bounded local fixture**: Only after complete OS enforcement is available, reproduce locked dependency bytes in an empty allowlisted environment with no external network, read-only source/tools, scratch-only writes and low memory/process/disk/time limits. Use one synthetic authenticated member and disposable/mock database, scanner and object store. Through the native upload interface, compare a benign control with predeclared small compressed ObjStm fixtures at two low decoded-size points, capped at 8 MiB total expanded bytes. Observe acceptance/rejection, worker external/array-buffer accounting and total-process memory against the control, deadline termination and post-termination recovery. Keep a second synthetic principal making a trivial bounded request as a health control; do not cause or approach exhaustion. Stop at the predeclared limits. Small expansion alone does not confirm a vulnerability: require a defensible connection to an owner-observed shared budget without stress, or retain hardening/unvalidated status. Promote evidence only using the trusted parent bounded no-follow procedure.

**Owner-observed facts**: Owner should inspect effective rendered API/container memory and worker isolation settings, upload ingress limits, deployed Node/dependency versions and supervisor recovery. Determine whether worker backing allocations count against a separate enforceable budget or the same API-process budget and whether the bounded amplification could materially impair another principal under configured two-upload admission. Use isolated staging with synthetic data only; do not probe or exhaust production.
## Public search may materialize the complete approved catalogue before applying bounded search filters

Fingerprint: public-search-definer-materialization-shared-pool

An anonymous POST /api/v1/research/search can issue a small validated selective query against crm_public_research(). The SECURITY DEFINER SQL function accepts no predicates or bounds and selects all Approved catalogue rows; outer SQL applies filtering, ordering and pagination. This is a source-grounded hypothesis of corpus-dependent work that could occupy the same ten-connection pool used for login, authentication and the global limiter. It is not an established availability vulnerability: an expensive valid search alone is insufficient, actual function materialization and meaningful interference with another principal remain unobserved. Strong controls include parameterized SQL, a strict 16KiB JSON body and bounded keyword/metadata/pagination, Approved-only public projection with pinned search_path, the global 300-token/5-per-second IP bucket, a configured 10-second statement timeout and 5-second acquisition timeout, transaction rollback and finally-release. No search cancellation listener or separate search concurrency admission appears. Recovery should occur on statement completion/timeout and transaction cleanup; no persistent resource loss is claimed.

Claimed root cause: The bounded public search filters and pagination occur outside an unparameterized SECURITY DEFINER set-returning function. If this prevents predicate pushdown/materializes a sufficiently large Approved corpus, admitted anonymous searches can consume the shared authentication/limiter pool until statement completion or timeout. The source establishes the path, not the decisive shared availability effect.

### Verified source trace

1. [src/app.js:132](../../../src/app.js#L132) — public search route: Anonymous POST /api/v1/research/search accepts a validated search body and calls searchResearch without authentication.
2. [src/research/search.js:8](../../../src/research/search.js#L8) — searchSql: Selects from crm_public_research(), applying keyword/year/department predicates and LIMIT/OFFSET outside the function.
3. [db/migrations/002_ias_controls.sql:84](../../../db/migrations/002_ias_controls.sql#L84) — crm_public_research: SECURITY DEFINER SQL set-returning function selects every Approved record including abstract, without accepting filter or limit parameters.
4. [src/research/search.js:30](../../../src/research/search.js#L30) — searchResearch shared database query: Awaits query completion on the shared connection before COMMIT/release; no request cancellation is propagated to this function.

### Source evidence

- [src/research/search.js:21](../../../src/research/search.js#L21) — Strongest input limits constrain result count to 100 and offset to 10000, not the number of rows obtained from the function.
- [db/migrations/001_search_consultations.sql:9](../../../db/migrations/001_search_consultations.sql#L9) — Trigram and metadata indexes exist on research_records; a non-inlined function boundary may prevent outer search predicates from using them.
- [src/security/database-config.js:4](../../../src/security/database-config.js#L4) — Shared pool max10, 5000ms acquisition timeout and 10000ms statement timeout are explicit preventing/limiting controls and must be included in validation.
- [src/app.js:26](../../../src/app.js#L26) — Global limiter itself uses the same scoped database before the search handler.
- [src/security/limiter.js:3](../../../src/security/limiter.js#L3) — Per-IP request bucket permits capacity300 and refill5/sec; it is a rate gate rather than separate concurrent-search admission.
- [src/research/search.js:33](../../../src/research/search.js#L33) — Pool release occurs in finally after database work finishes; unlike the algorithm route, public search has no close listener or AbortController.
- [src/server.js:10](../../../src/server.js#L10) — Production entrypoint constructs one pool through databaseConfig and passes it to createApp; request/header receipt timeouts are 60/15 seconds at line 14.
- [src/security/validation.js:15](../../../src/security/validation.js#L15) — Strict search schema bounds keyword to 200 characters, year and department, limit to 100 and offset to 10000. Parameterized outer SQL prevents SQL injection.
- [src/security/context.js:18](../../../src/security/context.js#L18) — Scoped db.query uses the same pool and releases its transaction connection after COMMIT/ROLLBACK, including for limiter and authentication calls.

### Exact blockers

- Required OS-enforced execution sandbox is unavailable: sandbox-exec alone lacks configured memory, process-count and scratch-disk quotas; docker, podman and bwrap are unavailable. No target code was executed.
- No disposable PostgreSQL service was available for a bounded query-plan/materialization and cancellation fixture; neither query amplification nor a meaningful effect on a separate dummy principal was demonstrated.
- Actual catalogue cardinality, upstream search admission/concurrency, deployment pool isolation and timeout attachment remain owner-observed facts. Source alone does not establish that these controls permit meaningful shared interference.

### Resolution plan

**Bounded local fixture**: Use only a fully enforced offline sandbox and disposable PostgreSQL with synthetic Approved and private rows. Preserve configured max10 pool, 10-second statement and 5-second acquisition timeouts. At two bounded corpus sizes, EXPLAIN (ANALYZE, BUFFERS) one selective keyword/year/department query with limit1 to establish Function Scan/materialization and filtering behavior. With a deterministic test-only query gate rather than load, inspect that one cancelled public request retains its connection until query cleanup and whether independently admitted dummy authentication work shares that resource. Do not saturate or stress the pool. Reject security classification if the result shows only ordinary search cost without meaningful shared effect; treat cancellation or workload isolation as hardening in that case.

**Owner-observed facts**: Owner should inspect existing normal-query plans and telemetry, catalogue size, deployed statement/acquisition timeout attachment, public-search concurrency/admission bounds and shared-pool topology. Establish whether permitted search work can delay another principal beyond the service availability budget, accounting for timeout recovery; do not send probes or generate load.
