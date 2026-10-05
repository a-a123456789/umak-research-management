# Algorithm service contract

`POST /api/v1/algorithm/solve` requires a valid staff bearer session. It evaluates a supplied **synthetic planning scenario**; it does not persist a workflow, grant approval, or trust student-supplied verification records. A future database adapter must derive evidence from authorized receipt/verification records.

Send `Content-Type: application/json`. The object must contain exactly these six fields:

| Field | JSON type and constraint |
|---|---|
| steps | 1–5,000 unique ASCII IDs, 1–64 letters/digits/underscore/hyphen |
| dependencies | At most 25,000 unique `[prerequisite, dependent]` pairs referencing steps; acyclic |
| completed_actions | Unique existing step IDs; every completed step's prerequisites must also be completed |
| requirements | Map from existing step IDs to lists of `{id, gate}`; gate is `received` or `verified`; at most 50,000 memberships; no duplicate pair per step |
| evidence | At most 50,000 unique `{id, state}` records; state is `received` or `verified` |
| durations | Exactly one integer minute estimate per step, 0–525,600; booleans and fractions rejected |

Verified evidence satisfies both gates; received evidence satisfies only the received gate. Receipt of payment proof can make a staff verification action ready; it never marks verification complete. Completed steps contribute zero remaining minutes. These are engineering bounds, not measured CRM workloads.

Example: `algocom/example.json`. Run standalone: `python3 algocom/worker.py < algocom/example.json`.

Success HTTP 200 returns `status` (`SUCCESS` or `COMPLETE`), the readiness fields defined by `prototype.py`, `earliest_finish_minutes` (step-to-integer map), `remaining_duration_minutes` (integer), `critical_path` (ordered incomplete step IDs), `duration_model` (limitations), and `metrics.worker_elapsed_ms` (nonnegative number). A critical path certifies the longest remaining prerequisite chain, assuming unlimited parallel capacity; evidence waits, staffing, external delays and calendar dates are excluded.

Errors: 400 malformed JSON or invalid graph/state; 401 unauthenticated; 403 non-staff; 413 body over 2 MiB; 503 capacity/unavailable worker; 504 five-second timeout; 502 failed/invalid/oversized worker output. Algorithm validation returns `{status:"ERROR", error_type, message}`; worker lifecycle errors use the same structured envelope; JSON-parser and authorization errors use the application's `{error}` envelope. See executable tests for exact values. Client disconnect cancels the child; no HTTP response is deliverable after disconnect.

Express spawns a fixed Python script without a shell, with no database credentials, two concurrent workers per server process, no waiting queue, a five-second wall timeout, and an 8 MiB stdout ceiling. Python reads at most 2 MiB. These controls bound ordinary prototype requests; they do not constitute an OS memory sandbox or multi-instance admission control.
