# DAG and lifecycle benchmark evidence

Run from any directory with Python 3.12+ (standard library only):

```sh
python3 -m unittest discover -s algocom -p 'test_*.py' -v
PYTHONHASHSEED=0 python3 benchmarks/benchmark_models.py
```

The runner preserves the original `algocom/results.*` and `extended_results.*` files. It creates a new UTC-stamped directory under `benchmarks/results/` containing an environment/source manifest, raw sample CSV, per-seed CSV/JSON and a generated Markdown report. `--output PATH` must name a directory that does not yet exist; `--reps` and `--seeds` must be positive. Defaults: five seeds, 30 timed repetitions per method/case/seed, five warmups. Method order is randomized per repetition. Memory is measured separately using tracemalloc.

DAG cases compare equivalent existing readiness plus critical-path outputs. Lifecycle cases compare table-based and conditional implementations of the same transition rules with independent presentation/publication dates. They are different workloads: do not compare their absolute times to choose between DAG and FSM.

`algocom/lifecycle.py` is a pure immutable algorithm prototype, not a database/API feature. Lifecycle transitions are Registered -> In-Progress -> UnderReview -> Completed, with UnderReview -> In-Progress revisions. Presentation/publication can occur independently and cannot overwrite completion date. Repeated outcome recording is rejected in this prototype; a future persistent outcome history can support multiple conferences/journals. ISO calendar dates are validated, but institutional date/authorization policies are outside the prototype.

The existing CI unit-test discovery already includes `test_lifecycle.py`. Large benchmarks remain manual so shared-runner timing noise cannot fail unrelated changes. Neither HTTP nor PostgreSQL integration, EDF, trigram search, chained auditing, bcrypt calibration nor RBAC throughput is measured by this suite. See the separate feature suite below for trigram/EDF measurements; the remaining security suites are still future work.

## PostgreSQL trigram and EDF heap suite

After migrating an explicitly disposable synthetic database:

```sh
ALLOW_BENCHMARK=yes npm run bench:features
```

Requires ADMIN_DATABASE_URL. The runner creates/drops only a uniquely named benchmark schema and does not reset application tables. It needs the migrated public normalization function and pg_trgm. It tests 1k/10k/100k title corpora against equivalent exhaustive queries for both public substring+fuzzy search and staff fuzzy duplicate review. Five query seeds include exact, typo, no-match, short and common queries. Index build bytes/time and representative query plans are retained. Thirty measured repetitions follow five warmups; method order is randomized.

EDF compares heapify + updates/cancellations + drain against repeated minimum scanning for 100/1k/10k tickets across five seeds. This is the deployed Node heap implementation, not a Python surrogate. SQL remains the live queue authority. The benchmark does not measure concurrent API load or SQL dispatch throughput; the integration tests separately prove unique concurrent claims. Outputs include metadata, raw samples, summary JSON, plans and report Markdown in a new `results/features-*` directory. No memory/RSS or production latency claim is made by this suite.
