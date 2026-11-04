# Trigram search and consultation scheduling

Implemented 4 November 2026. Existing DAG API and pure lifecycle FSM remain separate.

## Installation and migration

Run `npm run db:setup` for an explicitly synthetic database; it creates the original schema, applies `db/migrations/*.sql` in filename order, then seeds. For an existing initialized database, run `npm run db:migrate` with ADMIN_DATABASE_URL. It requires permission to install pg_trgm and alter tables/grants, and does not reset existing records. Migration history and DDL commit atomically under a transaction advisory lock. A second run skips applied files. Do not edit an applied migration; add another numbered migration. Initial backfill/index creation takes table locks, so schedule a maintenance window for a populated installation. Backup before migration; there is no automatic down migration.

The generated title column applies PostgreSQL NFKC normalization, lowercase, punctuation-to-space conversion and whitespace collapse. It updates with title changes regardless of which writer inserts the record. It is not accent-insensitive or semantic matching. Optional research_year (1900..9999) and department (1..100 characters) can be supplied on record creation.

## Search API

POST `/api/v1/research/search` remains public and returns an array of up to 100 Approved records. Body:

```json
{"keyword":"IoT Waste Managemnt","year":2026,"department":"Computing","limit":20,"offset":0}
```

Only keyword is required. year and department are optional exact filters; limit is 1..100, offset 0..10000. Results include similarity, research_year and department and sort by descending similarity then ID. Empty/punctuation-only queries list approved records in ID order. Literal normalized substring matching preserves keyword fragments and 1–2 character behavior; pg_trgm similarity >=0.3 adds typo candidates. The threshold is fixed and set transaction-locally so connection-pool settings cannot leak. Short/common queries may scan many rows; results remain bounded. Offset pagination can shift under concurrent writes and is not a stable snapshot.

POST `/api/v1/research/duplicates` accepts the same fields, requires staff authentication and a nonblank keyword, and includes drafts. It uses title similarity only, not substring fallback, with the same threshold/order. Students cannot enumerate private candidates. Suggestions are advisory: no automatic merge or rejection, and no guarantee of duplicate/plagiarism detection. The threshold has not been calibrated against institution-labeled research pairs. Abstracts are returned only within the existing public/staff visibility rules.

All queries bind user parameters. GIN gin_trgm_ops supports candidate retrieval; a B-tree supports metadata filters. Query plans and benchmark outcomes are workload-dependent.

## Consultation API

All routes require an opaque bearer token. Unknown fields and invalid IDs/versions are rejected. Deadlines accept null or an actual UTC ISO instant in `YYYY-MM-DDTHH:mm:ssZ` or `YYYY-MM-DDTHH:mm:ss.sssZ` format. Past deadlines are allowed and receive earliest priority. Convert local deadlines to UTC before sending.

| Method / path | Access and behavior |
| --- | --- |
| POST `/api/v1/consultations` | Authenticated; service_type required (1..100 characters), deadline_at optional; requester bound to session, starts queued/version 1 |
| GET `/api/v1/consultations` | Own tickets; staff sees all; newest ID first, up to 100; optional `before` ID cursor |
| GET `/api/v1/consultations/queue?limit=100` | Staff only; queued tickets ordered earliest deadline, submission time, ID; absent deadlines last; limit 1..100 |
| POST `/api/v1/consultations/claim-next` | Staff only; empty body; claims earliest available unlocked ticket, returns updated ticket or 204 if none available |
| PATCH `/api/v1/consultations/:id/deadline` | Staff only; deadline_at (including null) and expected_version required; queued tickets only |
| POST `/api/v1/consultations/:id/resolve` | Assigned staff only; expected_version required; claimed -> resolved |
| POST `/api/v1/consultations/:id/cancel` | Requester can cancel own queued ticket; staff can cancel queued/claimed tickets; expected_version required |

Creation, claim, rescheduling and successful terminal transitions append existing minimal audit events in the same transaction. Errors/conflicts do not append success events. Missing or inaccessible cancellation targets return 404; stale versions/unavailable states return 409. The audit implementation remains plain append-only-by-grants; SHA-256 chaining is not part of this change.

## EDF guarantees and implementation

The partial B-tree index covers `(deadline_at NULLS LAST, submitted_at, id)` for queued rows. A short transaction claims using FOR UPDATE SKIP LOCKED and UPDATE RETURNING. Concurrent staff requests cannot successfully claim the same queued row. Locks are released on rollback; committed status survives process restarts. A locked earliest row may be skipped: claim order is earliest currently available, not strict global order under concurrency. An empty response can mean all queued rows are temporarily locked; retry later.

`src/consultations/edf-heap.js` implements a binary min-heap with an ID/position map, heapify, insert, peek, extract, deadline update and cancellation. It copies inputs/outputs and has deterministic ties. Heapify is O(n), peek O(1), mutations O(log n). It is used for algorithm experiments and is not the live web server's authoritative queue. A production heap dispatcher would require durable replay/election/synchronization; the current SQL solution avoids introducing those failure modes.

No calendar appointment/room/staff-capacity allocation is implemented. EDF prioritizes tickets; it does not guarantee deadline completion or fairness. There is no automatic recovery/reassignment of a claimed ticket after staff abandonment and no notification delivery. These require explicit policy and separate routes.

## Validation and benchmarks

`test/edf-heap.test.js`: deterministic ties/null deadlines, input isolation, validation and 50,000 seeded mixed operations against a sorted reference. `test/features.test.js`: typo matching, exhaustive-query agreement, normalization/metadata, draft visibility, concurrent claims, durable reads, version conflicts, permissions, rollback on failed audit and migration/backfill/repeatability.

See [benchmark instructions](../benchmarks/README.md). Real database integration checks use a disposable synthetic PostgreSQL database and the restricted crm_app role. Benchmarks compare equivalent query outputs before timing; min-heap measurements do not claim SQL dispatch speed.

References: [PostgreSQL pg_trgm](https://www.postgresql.org/docs/18/pgtrgm.html), [SELECT locking and SKIP LOCKED](https://www.postgresql.org/docs/18/sql-select.html).
