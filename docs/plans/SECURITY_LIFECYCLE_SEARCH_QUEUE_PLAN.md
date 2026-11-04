# Implementation and benchmark plan

Prepared 4 November 2026. Status: proposal grounded in repository inspection; no new algorithms or benchmark measurements implemented by this document.

Implementation update: trigram search and consultation EDF ticketing are now implemented; see [API and guarantees](../SEARCH_AND_CONSULTATIONS.md). The original proposal below records the starting state. DAG/FSM benchmark evidence and the pure FSM prototype are also complete. Security changes remain proposed.

## 1. Scope and current implementation

Implement the requested security, research lifecycle, duplicate detection/search, and consultation scheduling features in the existing Node 24 / Express 5 / PostgreSQL 18 backend. Keep the independent Python ALGOCOM module and its published results intact. A frontend and a complete file-storage subsystem are separate work; add audit coverage for uploads when an upload workflow actually exists.

| Capability | Current evidence | Proposed change |
| --- | --- | --- |
| Password storage | `src/crypto.js`: synchronous scrypt; `src/app.js`: synchronous login verification | Async bcrypt if required by the course specification, with legacy scrypt verification and upgrade |
| RBAC | `src/app.js`: authenticated staff middleware and owner-or-staff research access | Reusable permission gates plus ownership checks; deny by default |
| Audit | `audit_logs`: action, nullable actor FK, timestamp; application role has SELECT/INSERT | Transactional SHA-256 chain, serialized append, restricted writer, verifier and external checkpoints |
| Lifecycle | `research_records.status`: Draft/Approved | Separate visibility from lifecycle; independent presentation/publication outcomes |
| Search | Public Approved-only title ILIKE, LIMIT 100 | PostgreSQL trigram GIN candidates and similarity ranking; private duplicate checks behind access gates |
| Consultation queue | No ticket schema or routes | Persistent tickets and atomic claim; EDF heap algorithm with a documented deployment strategy |
| Benchmarks | `algocom/bench.py`, `bench_extended.py`: Kahn/readiness and DAG duration | New suites and result files; no relabeling existing DAG results as evidence for these features |

## 2. Design decisions

### Passwords and permission gates

Bcrypt is a requested compatibility requirement, not an upgrade justified by the existing code: OWASP prefers Argon2id, with scrypt when unavailable, and treats bcrypt mainly as a legacy option. If bcrypt remains mandatory, use a maintained Node bcrypt library and asynchronous hash/compare. Benchmark cost 10, 11, and 12 before selecting deployment cost; do not lower cost below 10 for throughput.

Detect the existing salt:hex scrypt format and bcrypt prefixes explicitly. Verify legacy credentials off the event loop, then replace the stored hash after successful login using a conditional update against the original hash. Existing passwords over bcrypt's 72 UTF-8 byte limit need a reset/migration path; never silently truncate or reject an otherwise valid legacy login before verification. Enforce the byte limit for new bcrypt credentials, including multibyte input. Await hashing in `scripts/setup-db.js`; asynchronously initialize the dummy hash and keep unknown-user login on the expensive verification path. Malformed stored hashes must fail safely. Keep opaque token SHA-256 hashing unchanged.

Retain the two existing roles initially. Define named permissions such as research.create, research.transition, research.outcome.record, ticket.create, ticket.claim, user.create, audit.read, and audit.verify. Use `requirePermission(name)` middleware and an explicit role-permission map. Staff account management can retain the existing `/admin` route naming without inventing an administrator role. Check ownership/resource scope after the permission gate. Use explicit response fields rather than exposing internal columns.

Bitmasks are optional representation, not a security improvement. Prefer a readable Set/map for this small permission set; if the rubric mandates masks, use BigInt or a strictly bounded integer mask, named constants and tests. JavaScript bitwise operators coerce to signed 32-bit integers. Prevent caller-supplied roles and permissions from granting privileges.

### Cryptographic append-only logging

Add a new versioned ledger rather than pretending historical rows were hashed when created. Start a genesis event referencing a deterministic digest of the frozen legacy audit export and a migration timestamp. Preserve legacy rows as read-only history.

New event fields: sequence, event_id, format_version, occurred_at, immutable actor_ref, action, entity_type, entity_id, request_id, minimal payload, previous_hash, event_hash. Use an opaque actor reference without a cascading or SET NULL foreign key: deleting an account must not mutate past hashed bytes. Keep identity mapping separate and reconcile its retention with `docs/PRIVACY.md`. Exclude passwords, tokens, file contents, and unnecessary personal data.

Specify one canonical encoding with exact field order, UTC timestamp precision, UTF-8, null handling and payload key sorting. Store/hash the exact canonical bytes so the Node verifier and database writer cannot disagree about JSON formatting. Define SHA-256(domain/version prefix || previous_hash bytes || canonical event bytes), using unambiguous length framing. Freeze serialization test vectors.

Use a singleton ledger-head row locked FOR UPDATE inside the business transaction. A narrowly scoped database append function takes the lock, allocates the next sequence, computes/inserts the event, then advances the head. Enforce unique sequence and hashes; rollbacks must roll back both business changes and events. Do not depend on identity sequences being gapless or lock only the currently last event. Lock ordering must be consistent to limit deadlocks.

The append function should construct trusted fields and enforce allowed action/actor context. Restrict its owner and search_path; revoke PUBLIC execution and direct application DML on the ledger/head. The application role can read authorized projections and execute the writer. An append function still cannot prove that a compromised application supplied a truthful actor or event. Test actual database permissions, not just middleware.

Verify every event in sequence, links, recomputed digests and head agreement. Report the first bad sequence. Periodically export/sign or independently retain sequence + head hash outside the database and compare against that anchor. An unkeyed chain alone detects edits against a trusted head but cannot expose a privileged attacker rewriting the entire chain or deleting the tail and replacing the head. A checkpoint detects changes only through its anchored sequence; state that interval explicitly. Include deletion, insertion, reorder, payload change, full recomputation and tail-truncation scenarios.

Audit research creation/transition/outcomes, account creation, ticket mutations and existing deletion operations in the same transaction. Add `POST /api/v1/admin/users` only with explicit permission and credential validation. For future uploads, record successful durable attachment metadata; never claim upload coverage before the workflow exists.

### Research lifecycle and outcomes

Keep Draft/Approved as visibility/moderation status for compatibility. Add lifecycle_state with Registered, In-Progress, UnderReview, Completed; version; registered_at; started_at; review_started_at; completed_at. Do not infer Completed from Approved: migrate existing records to Registered unless reviewed evidence supports another state.

Model an active research parent with parallel regions: one lifecycle region and independent presentation/publication regions. The implementation can use a transition table plus independent outcomes; a large HFSM framework is unnecessary for this shallow hierarchy. Document this accurately as a hierarchical model with orthogonal state regions, rather than claiming a complex HFSM algorithm.

Initial transitions: Registered -> In-Progress -> UnderReview -> Completed; UnderReview -> In-Progress for revision. Reject all other transitions initially. Reopening Completed requires a later explicit business rule. Outcomes may be recorded independently, including before completion, because the requested model does not impose completion as a prerequisite.

Use `research_outcomes` rows for presentation/publication events with occurrence date and minimal venue/reference metadata. Derive Presented/Published booleans from active outcome rows so multiple conferences/journals are supported. Authorized corrections should be audited and must never change completed_at. If dates are unknown, retain that distinction rather than inventing a date from the boolean.

Proposed routes: POST `/api/v1/research/:id/transitions` with target and expected_version; POST `/api/v1/research/:id/outcomes`; explicit correction route for outcomes. Validate date format and configured date rules. Use conditional version updates or row locks; stale writes return 409 and produce no success audit event. Preserve current public visibility rules.

### Trigram duplicate detection and metadata search

Enable pg_trgm through privileged migrations; do not give extension installation rights to crm_app. Store original title and a versioned normalized_title: Unicode normalization, consistent case folding/spacing and punctuation policy. Preserve meaningful technical tokens. Start with a GIN index using gin_trgm_ops on normalized_title. Use an index-supported candidate predicate, then similarity scoring and deterministic score/id ordering. Tune similarity threshold with validation data rather than guessing that one threshold fits every title.

Separate public Approved-only search from authenticated duplicate review. Duplicate review is staff-only initially so drafts cannot leak to unrelated users. Query authorization must be applied before any counts, suggestions or snippets are returned. Add validated metadata fields (year, department, keywords) and B-tree indexes according to measured query patterns. Abstract full-text search can be a later tsvector/GIN addition; trigram title matching is not semantic/plagiarism detection.

Treat 1–2 character queries, common words, empty searches, exact matches and long titles explicitly. Prefer bounded, paginated fallback behavior; document reduced short-query selectivity. Preserve the existing keyword request contract and use an explicit cursor contract for new pagination. Candidate suggestions warn rather than automatically merge or reject a record. A title similarity score is insufficient proof of duplication. Concurrent duplicate submissions require review; fuzzy lookup is not a uniqueness constraint.

### EDF consultation ticket scheduling

Add consultation_tickets: id, requester_id, service_type, deadline_at, submitted_at, status, assigned_staff_id, version, claimed_at. Validate deadlines and permissions. Represent unscheduled deadlines consistently as last priority. States: queued -> claimed -> resolved, with explicit cancel/requeue transitions. Use immutable tie-breaking order `(deadline_at NULLS LAST, submitted_at, id)` and UTC instants. Deadline rescheduling requires an audit event and queue update.

Implement a deterministic indexed binary min-heap: heapify O(n), peek O(1), insert/extract/update/remove O(log n), O(n) memory; id-to-position map avoids O(n) cancellation scans. EDF means deadline ordering only. It does not by itself guarantee meeting deadlines, staff availability, fair service, or optimal scheduling when tasks have resource/service constraints. Record waiting time and overdue rates; leave aging as an explicit future policy since it changes pure EDF ordering.

PostgreSQL remains authoritative. First ship atomic earliest-ticket claim using a partial composite B-tree index and SELECT ... ORDER BY ... FOR UPDATE SKIP LOCKED inside a short transaction. This is a database-backed EDF queue, not a min-heap implementation. SKIP LOCKED means earliest currently unlockable ticket; concurrent claims do not guarantee globally strict completion order.

Ship the heap as the benchmarked algorithm and optional single-process dispatch optimization. It must not become the production authority without durable synchronization. If enabling it operationally, use one elected dispatcher, committed ticket change notifications/outbox, idempotent versioned updates and startup replay/rebuild; stale heap entries require conditional database claim and retry. Multiple web processes must never maintain competing authoritative local heaps. Compare this architecture against indexed SQL before accepting its complexity.

Proposed routes: POST `/api/v1/consultations`; GET own tickets or staff queue; POST `/api/v1/consultations/claim-next`; PATCH authorized deadline; POST resolve/cancel. Claims must never assign a ticket twice. No-deadline and overdue behavior must be visible in queue responses.

## 3. Benchmark design

The main comparative algorithms are trigram retrieval, EDF heap scheduling and SHA-256 chain append/verification. Lifecycle and permission gates need correctness plus measured throughput, without manufacturing an asymptotic improvement. Bcrypt is cost calibration: a slower password hash can be the intended result.

| Suite | Baseline / comparator | Sizes and workloads | Measures and correctness oracle |
| --- | --- | --- | --- |
| Trigram core | Exhaustive trigram similarity scan vs postings candidate retrieval + identical scoring | 1k, 10k, 100k titles; optional 1m; exact/typo/transposition/hyphen/common/short/no-match queries | query time, build time, postings/memory, candidates scored; identical threshold result set/ranking with tie rules |
| PostgreSQL search | Unindexed exhaustive same-similarity query vs GIN candidate query; existing ILIKE as separate behavioral reference | Same corpus; 200+ queries per family; public/private subsets and metadata selectivity | p50/p95/p99, throughput, index bytes/build/update cost, EXPLAIN (ANALYZE, BUFFERS); same visibility and scores; ILIKE is not an equivalent fuzzy baseline |
| Duplicate quality | Human-labeled or generated held-out duplicate pairs and hard negatives | Separate tuning/test seeds; label typo variants separately from paraphrases | precision/recall/F1, recall@10, false-positive cases; synthetic variants do not establish institutional accuracy |
| EDF core | Linear min-scan list and sort-on-each-dispatch vs indexed heap | 100, 1k, 10k, 100k tickets; batch drain and mixed create/claim/update/cancel | operation latency, total workload time, memory and comparisons; exact same extraction sequence from a sorted reference |
| EDF database/API | Indexed atomic SQL claim vs optional dispatcher+heap claim | 1, 4, 16 concurrent clients; restart, updates, cancellations, empty queue | claim p95/p99, tickets/s, waits/retries, rebuild time; no lost/duplicate claims and equivalent priority under documented locking semantics |
| Audit | Minimal plain insert vs transactional chained append (different guarantees); full verifier | 1k, 10k, 100k events; payload 128 B/1 KiB/8 KiB; 1/4/16 writers | append latency/throughput, lock wait, WAL/storage, verifier events/s; full valid chain, rollback atomicity and all applicable tamper detections |
| Lifecycle | Transition table vs readable conditional reference with identical rules | All state pairs plus 1k/10k/100k generated events; concurrent updates | agreement, immutable completion date under outcomes, stale-write rejection; ns/op or throughput is descriptive, no expected asymptotic speedup |
| Bcrypt | Costs 10/11/12; existing scrypt as migration reference | Hash and valid/invalid verify separately; 1/4/16 concurrent logins; ASCII/multibyte boundaries | p50/p95, throughput, event-loop delay and CPU/RSS; successful legacy upgrade, wrong-password rejection; no faster-is-better winner |
| RBAC | Permission map vs optional equivalent bitmask | Actual role/action matrix, then 1m repeated evaluations after warmup | identical allow/deny and ownership integration outcomes; isolate gate time from authentication/database latency |

For trigram core experiments, implement the same padded/token trigram semantics in baseline and postings index, with exhaustive oracle checks; do not equate a custom scorer with pg_trgm until fixture parity proves it. Python teaching implementations are explanatory evidence; deployed Node/PostgreSQL results must be measured separately.

### Reproducibility protocol

1. Use only generated synthetic accounts/titles/tickets. Record corpus generation code, seed and dataset digest. Use at least five dataset seeds for core algorithm suites; hold out quality-evaluation cases from threshold selection.
2. Run correctness/equivalence first. Include adversarial cases and randomized model comparisons. Timings from incorrect outputs are invalid.
3. Record commit SHA, dirty status, timestamp, CPU/RAM, OS, Node/Python/PostgreSQL versions, library versions, database settings, pool size, worker/thread settings, concurrency and payload sizes.
4. Use monotonic high-resolution timers. Separate fixture generation, initialization/index construction, warmup, measured operations and cleanup. Report startup/build costs separately rather than hiding them.
5. For core suites, use 5 warmups and at least 30 measured batches per seed; alternate/randomize comparator order. Batch tiny operations enough to exceed timer noise. Publish raw samples and across-seed dispersion; measure memory separately. Python tracemalloc and Node RSS/heap are different metrics.
6. For load suites, use 10 s warmup plus 60 s measured windows, at least three independent runs per configuration. Store per-request latency histograms/samples so p99 has adequate observations; report counts, errors and confidence/dispersion. Avoid drawing p99 claims from 30 values.
7. Measure database warm-cache runs explicitly. Only call a run cold-cache when cache state is actually controlled and recorded. EXPLAIN is diagnostic and should be separate from normal latency timing. Include connection/network/API time only in the named end-to-end suite.
8. Report baseline/proposed speedup only for equivalent semantics. For plain versus chained audit and scrypt versus bcrypt, report cost/overhead and guarantees instead. Complexity analysis is separate from empirical timing.
9. Run destructive fixture reset only in an explicitly marked disposable benchmark database, never the normal development database. Use benchmark credentials/schema, deterministic cleanup and dataset reuse per comparator. Never log passwords or tokens in result files.

### Complexity claims to defend

- Trigram extraction is linear in title length. Exhaustive scoring scales with corpus and title lengths. An inverted index narrows candidates but common trigrams can still touch most records; ranking has a candidate-dependent cost. Do not promise constant time or “instant” lookup.
- A heap's repeated dispatch costs O(n log n) for a batch after O(n) heapify, versus O(n²) repeated min-scan; a one-time sort is O(n log n) too and may win for static batches. Heap advantage is mainly dynamic mixed workloads. SQL B-tree behavior is a separate implementation.
- Chain append hashing is O(b) in event bytes, plus transactional serialization; verification is O(total event bytes), commonly O(n) for bounded payloads. More writers may reduce throughput through contention.
- Fixed transition-table lookup and bounded role permission checks are O(1). Database round trips and locking usually dominate. Bcrypt work grows approximately with 2^cost; input byte limits still apply.

### Proposed acceptance criteria (not measured results)

Correctness is mandatory: all model comparisons agree; unauthorized visibility never leaks; concurrent events form one chain; business rollback leaves no success event; anchored tampering is detected; outcome changes never overwrite completion; ticket claims are unique across clients and restarts.

Provisional performance goals on the documented reference machine: p95 public indexed search <=200 ms for 100k bounded titles at four clients, and p95 claim-next <=250 ms at 16 clients. These are targets to validate and revise transparently, not existing SLAs. Audit append overhead, verifier scaling, heap crossover and bcrypt cost are measured first, then given justified budgets. Never add brittle universal speedup assertions to shared-runner CI. A slower result must be reported, not discarded.

## 4. Repository changes and delivery sequence

| Phase | Concrete changes | Completion evidence |
| --- | --- | --- |
| 1: contracts and migrations | `db/migrations/`, migration runner/history; API payloads/errors, transition/permission tables, event encoding vectors; fixture generator | Existing Draft/Approved records preserved; migrations run on empty and seeded databases; restore/rehearsal documented |
| 2: security foundation | Async `src/crypto.js`, `src/auth/permissions.js`, ledger writer/verifier, grants; update setup/app callers and deletion behavior | Existing security tests pass; boundary/migration/privilege/concurrency/tamper tests; initial security benchmarks |
| 3: lifecycle | `src/research/lifecycle.js`, outcome services/routes/schema; transactions and version checks | Exhaustive transition matrix, randomized interleavings, independent date regression tests |
| 4: search | Normalization, pg_trgm indexes, search/duplicate services and metadata contract | Oracle/index parity, held-out quality report, private-record tests and query plans |
| 5: consultation | `src/consultations/edf-heap.js`, ticket schema/service/claim routes; SQL authority first | Reference workload agreement, concurrent claim/update/cancel tests, restart behavior and queue benchmarks |
| 6: reproducible evidence | `benchmarks/` runners, `algocom/` teaching counterparts if needed, CI jobs, reports and docs | Raw CSV/JSON + methodology/report, rerunnable commands, updated controls/privacy/API/evidence status |

Keep API services cohesive rather than adding every route directly into the existing large `src/app.js`. Inject database/clock/algorithm dependencies for deterministic tests. Retain existing `/algorithm/solve` DAG contract; it estimates prerequisite duration, not lifecycle persistence or EDF dispatch.

Suggested new commands (to implement, not currently runnable): `npm run db:migrate`, `npm run test:algorithms`, `npm run bench:core`, `npm run bench:db`, `npm run bench:auth`, `npm run audit:verify`. Separate expensive optional scale/load suites from fast correctness checks. New outputs go in `benchmarks/results/<run-id>/` with metadata.json, samples.csv, summary.json and report.md; never overwrite `algocom/results.*` or `extended_results.*`.

CI: fast pure algorithm/model tests on every PR; integration checks with PostgreSQL 18 using both owner and crm_app identities; preserve existing security and ALGOCOM checks. Run longer benchmarks manually or on a controlled scheduled runner, upload artifacts, and compare equivalent machine/configuration results. Existing DAG performance budgets remain scoped to their original algorithms.

Each phase should be a separate reviewable change with its own evidence. Do not mark a feature complete based solely on a passing microbenchmark. Update `README.md`, `docs/CONTROLS.md`, `docs/PRIVACY.md`, API docs and `evidence/STATUS.md` to distinguish implemented, measured, and proposed capabilities.

## 5. Reference decisions and open policy items

Default engineering choices above allow implementation to start: gate middleware instead of masks; staff manages administrative operations; existing visibility preserved; no automatic fuzzy rejection; SQL as queue authority; optional heap dispatcher only after measurement. Institutional reviewers still need to settle who may transition/correct records, what proves completion, retention of actor references, checkpoint custody/frequency, verified ticket deadlines and consultation capacity. Keep those configurable/documented rather than inventing university policy.

References:

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html): password hash selection, bcrypt minimum work factor and 72-byte limit.
- [PostgreSQL 18 pg_trgm](https://www.postgresql.org/docs/18/pgtrgm.html): similarity operators and GIN/GiST indexes. GIN candidate filtering and GiST nearest-neighbor search are distinct strategies; benchmark GiST if top-k workloads justify it.
