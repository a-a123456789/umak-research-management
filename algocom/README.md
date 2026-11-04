# ALGOCOM — Algorithms, Complexity, Pseudocode and Benchmarks

This is the algorithm reference for the UMak Center for Research Management repository. It explains the implemented algorithms, mathematical models, complexity, pseudocode, correctness checks and measured results. Measurements below were collected on **4 November 2026** using synthetic data; the original October results remain available separately.

The DAG, FSM, search and priority queue have different responsibilities. Keep the DAG for prerequisites/duration and the FSM for lifecycle rules; comparing their absolute execution times does not identify an overall winner.

## Contents

- [Implementation map](#implementation-map)
- [Notation](#notation)
- [1. DAG validation and workflow readiness](#1-dag-validation-and-workflow-readiness)
- [2. DAG critical-path dynamic programming](#2-dag-critical-path-dynamic-programming)
- [3. Lifecycle FSM with independent outcomes](#3-lifecycle-fsm-with-independent-outcomes)
- [4. Trigram inverted-index search](#4-trigram-inverted-index-search)
- [5. EDF consultation priority queue](#5-edf-consultation-priority-queue)
- [6. Measured benchmarks](#6-measured-benchmarks)
- [7. Reproduce and verify](#7-reproduce-and-verify)
- [8. Scope, provenance and references](#8-scope-provenance-and-references)

## Implementation map

| Algorithm | Purpose | Implementation | Current integration |
| --- | --- | --- | --- |
| Kahn + set membership | Reject cycles; report ready/blocked tasks | [prototype.py](prototype.py) | Python core used by staff algorithm API |
| DAG dynamic programming | Estimate remaining duration and critical-path certificate | [engine.py](engine.py) | Staff planning API; no persisted workflow approval |
| Lifecycle FSM | Validate transitions; preserve independent outcome dates | [lifecycle.py](lifecycle.py) | Pure Python prototype; no persistent lifecycle API |
| Trigram + GIN inverted index | Retrieve typo-tolerant titles and possible duplicates | [search.js](../src/research/search.js), [migration](../db/migrations/001_search_consultations.sql) | Express/PostgreSQL search and staff duplicate review |
| Indexed binary min-heap | Maintain earliest-deadline ordering under updates/cancellation | [edf-heap.js](../src/consultations/edf-heap.js) | Node algorithm implementation and benchmark |
| Indexed SQL EDF claim | Persist and atomically assign queued consultation tickets | [routes.js](../src/consultations/routes.js) | Live queue authority; not an in-memory heap |

Only the Python algorithms reside directly in this folder. Links point to the actual Node/PostgreSQL implementations rather than duplicating them in Python.

## Notation

| Symbol | Meaning |
| --- | --- |
| `G = (V, E)` | Directed workflow graph; in complexity formulas `V` and `E` also denote vertex/edge counts |
| `Pred(v)` | Direct prerequisites of step `v` |
| `D` | Set of completed steps |
| `Req(v)` | Required evidence/gate identifiers for `v` |
| `S` | Set of satisfied evidence/gate identifiers |
| `Q = Σᵥ |Req(v)|` | Total requirement memberships |
| `B` | Number of supplied evidence records |
| `d(v), r(v), F(v)` | Estimated duration, remaining work and dependency-only finish time |
| `M` | Number of lifecycle events processed across all histories |
| `N` | Number of research titles in a search corpus |
| `Lq, Li` | Character lengths of query and title `i` |
| `C, R` | Retrieved candidates and qualifying matches before pagination |
| `n` | Number of consultation tickets in a heap/workload |

`O(f(n))` is an asymptotic upper bound, `Ω(f(n))` a lower bound, and `Θ(f(n))` a tight bound. These describe growth, not milliseconds. Hash-set/map operations use expected O(1) behavior, not a worst-case guarantee. Identifier lengths and dates are bounded by the input contracts. Space claims include algorithm structures/output where stated, not interpreter/database process memory.

## 1. DAG validation and workflow readiness

### Model and formula

An edge `u -> v` means that `u` must finish before `v` is ready. For an incomplete step:

$$
\operatorname{ready}(v)
\iff v\notin D\;\land\;\operatorname{Pred}(v)\subseteq D\;\land\;\operatorname{Req}(v)\subseteq S.
$$

Evidence in `engine.py` has received/verified gates: a verified record satisfies both received and verified requirements; a received record satisfies only received requirements. Completed steps must have completed prerequisites. Historical evidence verification for completed steps is not reconstructed.

Kahn's algorithm validates acyclicity by repeatedly removing zero-indegree vertices. If fewer than `V` vertices are processed, a cycle exists. This structural removal is not the same as completing research tasks: readiness still uses the caller-supplied completed set.

### Proposed pseudocode

```text
EVALUATE_WORKFLOW(steps, edges, completed, satisfied, requirements):
    validate IDs and build adjacency, predecessor sets, indegree
    queue <- all vertices with indegree 0
    processed <- 0

    while queue is not empty:
        u <- dequeue(queue)
        processed <- processed + 1
        for each v in adjacency[u]:
            indegree[v] <- indegree[v] - 1
            if indegree[v] = 0:
                enqueue(queue, v)

    if processed != number of steps:
        return ERROR(cycle)
    reject unknown completed IDs or inconsistent completed prerequisites
    reject requirement keys that name unknown steps
    if every step is completed:
        return COMPLETE

    for each incomplete step v:
        missing_predecessors <- Pred(v) minus completed
        missing_requirements <- Req(v) minus satisfied
        if both are empty:
            add v to ready
        else:
            add v and missing reasons to blocked
    return SUCCESS(ready, blocked)
```

### Repeated-scan baseline pseudocode

```text
resolved <- empty set
repeat:
    changed <- false
    for v in input order:
        if v is unresolved and Pred(v) is a subset of resolved:
            add v to resolved
            changed <- true
until changed = false

if resolved does not contain every vertex:
    return ERROR(cycle)
perform the same state validation and readiness calculation as proposed
```

`resolved` is used for graph validation; it does not replace the real completed set. Reverse ordering of a chain can resolve only one additional vertex per pass.

### Complexity

Kahn processes each vertex once and each edge once. Requirement checks and missing-reason construction visit at most `Q` memberships:

$$
T_{\text{readiness}}=O(V+E+Q),\qquad
S_{\text{readiness}}=O(V+E+Q).
$$

With `p` full validation passes, the baseline has an upper bound:

$$
T_{\text{scan}}=O\bigl(p(V+E)+Q\bigr),\qquad
p=O(V),\qquad
T_{\text{scan,worst}}=O\bigl(V(V+E)+Q\bigr).
$$

The implementation includes a final no-progress pass. Favorable input order can reduce the scan to linear work; not every graph realizes the worst case. Both methods perform the same number of incomplete-step requirement checks. The principal improvement is graph validation, not fewer evidence checks.

## 2. DAG critical-path dynamic programming

### Recurrence

After validation, compute remaining work:

$$
r(v)=\begin{cases}0,&v\in D,\\d(v),&v\notin D.\end{cases}
$$

Process vertices in topological order:

$$
F(v)=r(v)+\max_{u\in\operatorname{Pred}(v)}F(u),
\qquad \max\varnothing=0,
\qquad T_{\text{remaining}}=\max_{v\in V}F(v).
$$

Store a maximizing predecessor for each vertex and follow parent pointers backward from the maximizing endpoint. Ties use original step order. The returned certificate omits completed vertices; an entirely completed workflow returns an empty path.

For example, if unfinished independent tasks `A` and `B` take 20 and 30 minutes and both precede `C` (10 minutes), then `F(C) = 10 + max(20, 30) = 40`. It is not the sum of every task duration.

This estimates dependency-only duration under unlimited parallel capacity. It excludes staff/resource contention, consultation waiting time and delays waiting for evidence.

### Pseudocode

```text
ESTIMATE_DURATION(validated DAG, completed, durations):
    order <- topological order of DAG
    for v in order:
        parent[v] <- predecessor with greatest finish time
                     (break ties by original input rank)
        before <- 0 if no predecessor, otherwise finish[parent[v]]
        remaining <- 0 if v is completed, otherwise durations[v]
        finish[v] <- before + remaining

    endpoint <- vertex with greatest finish time, ties by input rank
    certificate <- follow parent pointers from endpoint
    reverse certificate and remove completed vertices
    return finish, finish[endpoint], certificate
```

The baseline repeatedly scans unresolved vertices until their predecessors have finish times, then applies the same recurrence. The deployed engine performs readiness validation and duration traversals separately; multiple linear passes preserve the same asymptotic bound.

### Complexity

Dynamic programming itself takes O(V+E) time and O(V+E) structures. Including validation, evidence conversion, readiness and output:

$$
T_{\text{engine}}=O(V+E+Q+B),\qquad
S_{\text{engine}}=O(V+E+Q+B).
$$

For the repeated-scan engine:

$$
T_{\text{engine,baseline}}=O\bigl(V(V+E)+Q+B\bigr).
$$

These assume expected constant-time hashing and bounded IDs. Current API limits are 5,000 steps, 25,000 edges and 50,000 requirement memberships/evidence records; see [exact API contract](../docs/ALGORITHM_API.md).

## 3. Lifecycle FSM with independent outcomes

### State model and transition function

The research state has three orthogonal control regions:

$$
X=(L,P,U),\quad
L\in\{\text{Registered, In-Progress, UnderReview, Completed}\},\quad
P,U\in\{0,1\}.
$$

`P` represents Presented and `U` represents Published. This gives `4 × 2 × 2 = 16` possible control-state combinations; timestamp values are additional data, not included in that count. The implementation stores optional outcome dates, from which the booleans are derived.

The allowed lifecycle transition relation is:

$$
A=\{(R,I),(I,W),(W,I),(W,C)\},
$$

where `R=Registered`, `I=In-Progress`, `W=UnderReview`, `C=Completed`. `W -> I` handles revisions. Completion cannot currently be reopened. Outcome events can occur before or after completion, and changing an outcome never overwrites `completed_at`.

This is a shallow parallel-state model implemented as a transition set plus independent outcome fields, not a general-purpose hierarchical state-machine framework. It is not yet persisted by the API. The current prototype records each outcome once and rejects repeats; multiple conferences/journals require a future history model.

### Pseudocode

```text
APPLY_EVENT(state, action, occurrence_date):
    reject invalid date/event, preserving original state
    if action is Presented or Published:
        if corresponding outcome already has a date:
            return original state, rejected
        return immutable copy with only that outcome date changed, accepted

    if (state.lifecycle, action) is not in ALLOWED_TRANSITIONS:
        return original state, rejected

    next <- immutable copy with lifecycle = action
    if action = Completed:
        next.completed_at <- occurrence_date
    return next, accepted
```

The conditional baseline replaces membership in `ALLOWED_TRANSITIONS` with equivalent `if`/Boolean conditions. Both share date validation, outcome handling and immutable copying. Correctness tests therefore also check independently stated transition/date expectations.

### Complexity

For the fixed number of states/fields and bounded ISO date strings:

$$
T_{\text{transition}}=O(1),\quad S_{\text{transition}}=O(1),\quad
T_{\text{replay}}=\Theta(M).
$$

Replaying a single history retains O(1) current state; returning final states for `h` histories takes O(h) output space. Both the table and conditional implementation have the same complexity. The table is useful for expressing policy clearly; a runtime improvement is not assumed.

A DAG can check whether prerequisite work/evidence is ready before a separate FSM permits `UnderReview -> Completed`. The test suite demonstrates that composition; it does not constitute a transactional production integration.

## 4. Trigram inverted-index search

### Normalization and similarity

The generated database column normalizes a title using NFKC, lowercase, non-alphanumeric-to-space replacement and trimming. PostgreSQL then extracts per-word trigrams with two leading spaces and one trailing space. For example:

```text
word:     cat
padded:   "  cat "
trigrams: {"  c", " ca", "cat", "at "}
```

For trigram sets `A = T(query)` and `B = T(title)`, the standard PostgreSQL pg_trgm similarity uses intersection over union:

$$
\operatorname{sim}(q,t)=\frac{|A\cap B|}{|A\cup B|}
=\frac{|A\cap B|}{|A|+|B|-|A\cap B|}.
$$

No shared trigrams produce similarity zero; empty trigram inputs are handled by PostgreSQL as zero. The actual scorer is PostgreSQL, including its trigram generation/encoding, not a custom Python approximation. See [official formula source](https://github.com/postgres/postgres/blob/REL_18_STABLE/contrib/pg_trgm/trgm.h) and [pg_trgm documentation](https://www.postgresql.org/docs/18/pgtrgm.html).

The fixed similarity threshold is 0.3. Public search matches **similar titles or literal normalized substrings**, restricts visibility to Approved, and supports exact year/department filters. Staff duplicate review uses similarity alone and can include drafts. Results sort by score descending, then ID ascending. Empty normalized public queries list Approved records; short/common queries retain bounded substring behavior.

### Pseudocode

```text
BUILD_INDEX(records):
    for each record:
        maintain normalized_title from original title
        index its trigrams in PostgreSQL GIN postings

SEARCH(query, metadata, mode, limit, offset):
    validate input and pagination
    if mode = duplicates:
        require authenticated staff
    begin transaction
    set transaction-local trigram threshold to 0.3
    candidates <- database index/scan plan for similarity predicate
                  OR substring predicate if public mode
    restrict public mode to Approved records
    apply year/department filters
    recheck predicates and compute PostgreSQL similarity
    order by similarity descending, ID ascending
    return requested page; commit
```

This describes logical processing; PostgreSQL chooses and reorders physical operations. GIN performs inverted candidate retrieval and rechecks; it does not inherently deliver similarity-ranked results. Normalization/index updates occur through the generated column/index when titles change. Suggestions do not automatically reject or merge records, and title similarity is not plagiarism detection.

### Complexity model

Unlike Kahn or a binary heap, database lookup has no single unconditional O(log N) bound. Define:

- `gq`: number of distinct query trigrams; `K`: distinct indexed trigram keys.
- `Pq`: postings entries examined for the query; `P`: all document/trigram memberships.
- `Hq`: upper cost of one exact query/title score, including any trigram generation, deduplication and comparison needed by the scorer.

An abstract inverted-index candidate-and-sort model is:

$$
T_{\text{indexed}}=O\bigl(g_q\log K+P_q+C H_q+R\log(R+1)\bigr),
\qquad S_{\text{index}}=O(K+P).
$$

This is an explanatory model, not an exact bound for every PostgreSQL GIN plan. Bitmap handling, rechecks, metadata predicates, substring fallback, page I/O, offset and planner choices affect actual execution. A bounded top-k sort can replace full result sorting in some plans.

For an exhaustive equivalent scoring scan:

$$
T_{\text{scan}}=O\bigl(N H_q+R\log(R+1)\bigr).
$$

With already constructed trigram sets, an exact set comparison can take O(gq+gi); that simplification does not include PostgreSQL's title-to-trigram construction/deduplication. Merely extracting overlapping character windows is O(L), but that is not the whole index-build/scoring cost. Index construction must at least inspect the corpus: Ω(Σᵢ Li); physical build costs also include sorting/postings/page management.

Selective queries can have `C << N`. Common trigrams or short queries can make `C` approach `N`, or force a scan. No constant-time or universal speedup claim follows from using GIN.

## 5. EDF consultation priority queue

### Priority function and heap invariant

Earliest Deadline First compares tickets lexicographically by:

$$
\operatorname{key}(t)=\bigl(\operatorname{deadline}(t),\operatorname{submitted}(t),\operatorname{id}(t)\bigr),
\qquad \operatorname{deadline}(t)=+\infty\text{ when absent}.
$$

Thus overdue deadlines rise first, equal deadlines use submission time then ID, and tickets without deadlines sort last. Node heap timestamps are epoch milliseconds; the database stores UTC instants.

For a zero-indexed heap:

$$
\operatorname{parent}(i)=\left\lfloor\frac{i-1}{2}\right\rfloor,\quad
\operatorname{left}(i)=2i+1,\quad \operatorname{right}(i)=2i+2.
$$

The invariant is `key(parent) <= key(child)`. An ID-to-position map locates tickets for updates/removal without a linear ID scan.

### Pseudocode

```text
HEAPIFY(tickets):
    copy tickets into array; build ID -> position map; reject duplicate IDs
    for i from floor(n / 2) - 1 down to 0:
        SIFT_DOWN(i)

INSERT(ticket):
    append ticket; record position
    SIFT_UP(last position)

EXTRACT_MIN():
    if empty: return null
    return REMOVE(root ID)

REMOVE(id):
    locate i from position map; return null if absent
    save removed ticket; move final ticket into hole; remove final slot
    remove old ID from map; update moved ticket position
    restore order with SIFT_UP and SIFT_DOWN, updating positions on swaps
    return removed ticket

UPDATE(ticket):
    if ID absent: return false
    REMOVE(ticket.ID)
    INSERT(ticket)
    return true
```

### Complexity derivation

The heap height is O(log n). Bottom-up heap construction is linear because most vertices are near the leaves:

$$
\sum_{h\ge0}O\left(\frac{n}{2^{h+1}}h\right)=O(n).
$$

| Operation | Expected time with ID map | Explanation |
| --- | --- | --- |
| Heapify | O(n) | Bottom-up sifting and map construction |
| Peek | O(1) | Read root |
| Insert | O(log n) | Append and sift up |
| Extract minimum | O(log n) | Remove root and repair |
| Update deadline / cancel | O(log n) | Map lookup plus heap repair |
| Full heap drain | O(n log n) | n extractions |
| Storage | O(n) | Heap and position map |

Repeated minimum scanning over a draining list performs:

$$
\sum_{k=1}^{n}\Theta(k)=\Theta\left(\frac{n(n+1)}{2}\right)=\Theta(n^2).
$$

A one-time sort followed by ordered traversal is also O(n log n) for a static batch; it is not the measured baseline. Heap updates are useful for a changing queue. The benchmark includes heapify, deadline updates, cancellations and drain; retained dispatch output itself takes O(n) space.

### Live database claim pseudocode

```text
CLAIM_NEXT(staff):
    require authenticated staff
    begin transaction
    select earliest queued row by deadline NULLS LAST, submitted_at, ID
        FOR UPDATE SKIP LOCKED LIMIT 1
    if found:
        update to claimed; assign staff; increment version; set claim time
        append success audit event
    commit
    return ticket, or no-content when no unlocked candidate exists
```

A partial B-tree index supports queued-row ordering. The SQL service is the durable authority: no independent per-server heap can lose a ticket on restart or claim it twice. Contention/locked rows affect search cost, so the SQL transaction is not assigned the heap's O(log n) claim. SKIP LOCKED may bypass a locked earliest row and does not guarantee globally strict dispatch order under concurrency. EDF does not allocate staff/rooms, guarantee meeting deadlines, or implement fairness/abandoned-claim recovery. [API and guarantees](../docs/SEARCH_AND_CONSULTATIONS.md).

## 6. Measured benchmarks

### Method and interpretation

Both new suites used **five seeds**, **five warmups**, **30 timed repetitions per method/case/seed**, and randomized method order. Equivalent outputs were checked before timing. The Python suite used five different inputs per case; the feature suite used five heap inputs or query sets against a shared deterministic title corpus per size. Five seeds are workload variation, not five machines.

Each time below is the **median of per-seed median batch times**. Speedup is computed per matched seed before taking the median:

$$
\operatorname{speedup}_s=
\frac{\operatorname{median}(t_{\text{baseline},s})}
     {\operatorname{median}(t_{\text{proposed},s})},
\qquad
\operatorname{reported\ speedup}=\operatorname{median}_s(\operatorname{speedup}_s).
$$

Values greater than 1 favor proposed; below 1 favor baseline. Because ratios are aggregated separately, dividing two rounded table times need not equal the displayed speedup. These are batch measurements, not API response percentiles.

### DAG: readiness + critical-path estimates

Environment: Python 3.14.5, macOS arm64, 10 logical CPUs. Proposed uses Kahn/readiness plus topological dynamic programming; baseline uses repeated scanning with the same output contract. `V` is step count. Results cover the combined engine, not an isolated timing of Kahn alone.

| Workflow | V | Proposed ms | Baseline ms | Speedup | Proposed / baseline peak KiB |
| --- | ---: | ---: | ---: | ---: | ---: |
| Shuffled sequence | 10 | 0.0271 | 0.0310 | 1.13x | 9.6 / 8.8 |
| Shuffled sequence | 100 | 0.2205 | 0.7487 | 3.36x | 84.1 / 86.2 |
| Shuffled sequence | 1,000 | 2.6375 | 65.0799 | 24.91x | 784.5 / 783.7 |
| Branching DAG | 10 | 0.0355 | 0.0385 | 1.06x | 9.7 / 8.9 |
| Branching DAG | 100 | 0.3160 | 0.4863 | 1.54x | 91.5 / 94.9 |
| Branching DAG | 1,000 | 3.5696 | 22.3323 | 6.38x | 855.7 / 854.4 |
| Reversed sequence | 10 | 0.0330 | 0.0425 | 1.28x | 10.2 / 9.4 |
| Reversed sequence | 100 | 0.2344 | 1.2643 | 5.39x | 84.4 / 86.6 |
| Reversed sequence | 1,000 | 2.5851 | 113.6668 | 44.00x | 783.9 / 783.1 |

Scan sensitivity is largest for reversed chains. Allocation peaks are similar at 1,000 steps and sometimes slightly higher for proposed; the data does not establish a general memory saving.

### FSM: table versus equivalent conditionals

Each size is the number of **independent histories**, not the number of events. Histories include revisions, completion, independent outcomes and rejected events. The number of events varies by generated history.

| Histories | Table ms | Conditional ms | Speedup | Table / conditional peak KiB |
| --- | ---: | ---: | ---: | ---: |
| 100 | 0.7924 | 0.7948 | 1.00x | 27.8 / 27.8 |
| 1,000 | 7.8192 | 7.8195 | 1.00x | 183.2 / 183.2 |
| 10,000 | 78.7505 | 78.7906 | 1.00x | 1734.3 / 1734.3 |

Both have the same complexity and essentially tied timings. Choose the table for clear transition policy, not a demonstrated speed advantage.

DAG/FSM evidence: [full report and seed ranges](../benchmarks/results/20261104T143200Z/report.md), [raw timing CSV](../benchmarks/results/20261104T143200Z/samples.csv), [per-seed summaries](../benchmarks/results/20261104T143200Z/summary.csv), [environment, input/source hashes](../benchmarks/results/20261104T143200Z/metadata.json). There are **60 paired cases and 3,600 timing samples**. Peak memory is a separate tracemalloc run, excluding prebuilt inputs; it is Python allocation peak, not process RSS.

### Trigram queries and EDF heap

Environment: Node 24.14.0, PostgreSQL 18.3, Apple M4, 16 GiB RAM. Search compares the index-supported query form against exhaustive similarity scoring with equivalent matching, visibility and ordering. PostgreSQL chooses whether to use the index. Heap compares against repeated minimum scanning.

| Suite | Size | Proposed ms | Baseline ms | Speedup |
| --- | ---: | ---: | ---: | ---: |
| EDF heap workload | 100 tickets | 0.021 | 0.018 | 0.83x |
| EDF heap workload | 1,000 tickets | 0.305 | 1.194 | 3.89x |
| EDF heap workload | 10,000 tickets | 5.992 | 123.451 | 21.01x |
| Public search | 1,000 titles | 18.380 | 16.972 | 0.92x |
| Public search | 10,000 titles | 124.664 | 166.910 | 1.34x |
| Public search | 100,000 titles | 370.142 | 914.492 | 2.47x |
| Duplicate review | 1,000 titles | 16.749 | 15.359 | 0.92x |
| Duplicate review | 10,000 titles | 109.640 | 155.255 | 1.43x |
| Duplicate review | 100,000 titles | 437.067 | 858.064 | 1.93x |

Each search sample is a **six-query batch** containing exact title, typo, IoT typo, no-match, short and common queries. The 370.142 ms public result is not a single-query response time. Local database query/connection transport is included; HTTP/authentication is excluded. Representative selective plans used GIN at 10k/100k and scans at 1k.

The heap workload includes initial construction, deadline changes, cancellations and complete drain. It does not measure the live SQL claim endpoint. The simple scan won at 100 tickets; the query baseline won slightly at 1,000 titles. The proposed methods are not always faster.

Feature evidence: [full report](../benchmarks/results/features-2026-11-04T14-45-09-443Z/report.md), [raw timing JSON](../benchmarks/results/features-2026-11-04T14-45-09-443Z/samples.json), [per-seed summaries](../benchmarks/results/features-2026-11-04T14-45-09-443Z/summary.json), [query plans/index build costs](../benchmarks/results/features-2026-11-04T14-45-09-443Z/query-plans.json), [environment/source hashes](../benchmarks/results/features-2026-11-04T14-45-09-443Z/metadata.json). There are **45 paired cases and 2,700 timing samples**. No memory profiling was performed for this suite.

### Limits of the evidence

- One machine and synthetic workloads; no proof of institutional duplicate accuracy or production scheduling quality.
- Warmups and repeated runs do not establish controlled cold/warm database cache state. There is no cold-cache comparison or concurrent API load benchmark.
- No search/heap p95/p99 SLA, full process memory comparison, or statistical significance claim for tiny FSM differences.
- Complexity comes from the algorithms; timing tables illustrate finite workloads and do not prove asymptotic bounds.
- Heap versus scan, trigram versus exhaustive scoring, and FSM table versus conditionals are separate comparisons. Do not rank different business tasks against each other.

## 7. Reproduce and verify

Run these commands **from the repository root**, not from `algocom/`. Python 3.12+ is recommended; the Python core uses only the standard library. Node commands require Node 24 and installed npm dependencies.

### Pure algorithm correctness and new DAG/FSM benchmark

```sh
python3 -m unittest discover -s algocom -p 'test_*.py' -v
npm run test:features:unit
PYTHONHASHSEED=0 python3 benchmarks/benchmark_models.py
```

The Python suite passed **24 tests**, including 1,000 original randomized DAG agreements, 500 extended DAG comparisons and 500 lifecycle stream comparisons. Lifecycle tests also check all state pairs, revision/rejection behavior and independent dates. The Node heap test checks 50,000 randomized mixed operations against a sorted reference. Do not use Python `-O`: the runners use assertions for output agreement.

The new Python runner defaults to five seeds, 30 repetitions and five warmups; `--seeds` and `--reps` must be positive. Optional `--output PATH` must name a directory that does not exist. It writes a new UTC-stamped directory under `benchmarks/results/`, preserving earlier results.

### PostgreSQL/API correctness and feature benchmark

Use an explicitly disposable synthetic database and configured ignored `.env` with ADMIN_DATABASE_URL, DATABASE_URL, APP_DB_PASSWORD, DEMO_PASSWORD and ALLOW_SYNTHETIC_SETUP=yes. The owner connection installs pg_trgm; the API/tests use the restricted crm_app identity. The test suite deletes synthetic fixture users/records; never target a real database.

```sh
npm ci --ignore-scripts
npm run db:setup
npm test
ALLOW_BENCHMARK=yes npm run bench:features
```

`db:setup` creates the base schema, applies migrations and seeds accounts. Existing initialized databases can use `npm run db:migrate` without reseeding. PostgreSQL must already be running; see [repository setup](../README.md#start-locally).

The feature runner creates/drops a unique benchmark schema, needs the migrated public normalizer and does not reset operational tables. It uses the same five-seed/30-repeat/five-warmup protocol and writes a new `benchmarks/results/features-*` directory. Full backend integration passed **27 tests**, including privacy, migration/backfill, stale-version rejection, transaction-local threshold restoration, rollback on audit failure and 16 concurrent unique claims. Correctness tests do not constitute a concurrent throughput benchmark.

[Feature evidence and verification limits](../evidence/FEATURES_2026-11-04.md) records backup/restore and the pre-existing dependency audit findings. See [benchmark runner details](../benchmarks/README.md).

### Original historical benchmarks

```sh
python3 -m unittest discover -s algocom -p 'test_prototype.py' -v
PYTHONHASHSEED=0 python3 algocom/bench.py --seed 20261001 --reps 10
PYTHONHASHSEED=0 python3 algocom/bench_extended.py
```

These are different experiments from the November tables:

| Runner | Coverage | Outputs | Overwrite behavior |
| --- | --- | --- | --- |
| [bench.py](bench.py) | Original readiness comparison; one seed, fixed method order, one warmup, ten repeats | [results.md](results.md), [results.csv](results.csv) | Overwrites original result files |
| [bench_extended.py](bench_extended.py) | Readiness + duration comparison; one seed, fixed method order, ten repeats | [extended_results.json](extended_results.json), [extended_results.csv](extended_results.csv) | Overwrites extended result files |
| [benchmark_models.py](../benchmarks/benchmark_models.py) | New five-seed DAG/FSM experiment | New timestamped manifest/samples/summary/report | Preserves earlier runs |
| [benchmark-features.js](../benchmarks/benchmark-features.js) | Node heap and PostgreSQL trigram queries | New timestamped manifest/samples/summary/plans/report | Preserves earlier runs |

The original readiness generator uses 10/100/1,000 steps, shuffled sequences, branching DAGs and reversed chains; approximately 10% of steps receive requirements and the initial 30% of topological order are completed. It checks output equality and equal requirement-check counts. Its memory is separately traced; fixed order/one seed limit inference. The original baseline pass count includes the final no-progress pass.

The extended runner also checks a 5,000-step synthetic CI budget: nearest-rank p95 below 1,000 ms over ten warmed samples per graph family. It is a regression guard for that prototype, not an HTTP/service SLA. Historical results should retain their own dates/environment and must not be combined as if they came from the new protocol.

## 8. Scope, provenance and references

Bcrypt migration and cryptographic SHA-256 audit chaining are still proposals, not implemented/benchmarked algorithms in this folder. Current password storage is scrypt; existing bearer tokens use SHA-256 hashing; existing audit rows are protected by database grants but do not form a hash chain. RBAC/ownership checks exist, but no RBAC microbenchmark is reported here.

The original prototype was retained when duration support was added. Earlier pasted-code repairs corrected entry-point/filename strings and a malformed randint token; complexity comments were clarified to include requirements and hashing assumptions. ChatGPT/Codex assisted implementation, tests, benchmark runners and documentation. Measured artifacts record source hashes and working-tree status; results are not claimed to come from a committed release. Team review and institutional validation remain separate responsibilities.

- [Algorithm API contract](../docs/ALGORITHM_API.md)
- [Search and consultation API](../docs/SEARCH_AND_CONSULTATIONS.md)
- [DAG/FSM evaluation](../benchmarks/EVALUATION.md)
- [Implementation plan and remaining work](../docs/plans/SECURITY_LIFECYCLE_SEARCH_QUEUE_PLAN.md)
- [PostgreSQL 18 pg_trgm documentation](https://www.postgresql.org/docs/18/pgtrgm.html)
- [PostgreSQL 18 trigram similarity formula](https://github.com/postgres/postgres/blob/REL_18_STABLE/contrib/pg_trgm/trgm.h)
- [PostgreSQL SELECT locking behavior](https://www.postgresql.org/docs/18/sql-select.html)
