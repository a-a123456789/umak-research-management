# ALGOCOM: CRM service-step benchmark

This standalone Python module compares two ways to validate a service workflow and identify its ready/blocked steps. It has no UI, database, Express dependency, or connection to the IAS API. All benchmark workflows are synthetic.

## Run from the repository root

```sh
python3 -m unittest discover -s algocom -p 'test_prototype.py' -v
PYTHONHASHSEED=0 python3 algocom/bench.py --seed 20261001 --reps 10
```

Python 3.12+ is recommended. No packages need installing. The benchmark writes `results.csv` and `results.md` beside itself, even when invoked from another working directory; rerunning overwrites those measured results. `--reps` must be at least 1. Do not use Python's `-O` flag when running assertion-based correctness checks.

## What the methods do

Inputs: a list of unique string step IDs, directed prerequisite edges, a set of completed steps, a set of verified requirement IDs, and a mapping of steps to requirement sets. A step is ready only when its prerequisite steps are completed and its requirements verified. The methods inspect the current state; they do not automatically complete steps.

Both return `SUCCESS` with ready/blocked steps, `COMPLETE` for an entirely completed valid workflow, or `ERROR` for a detected invalid graph/state. `canonical()` ignores output ordering when comparing results. Completed steps are checked for prerequisite consistency, not historical requirement verification. Input types are assumed to follow this contract; arbitrary malformed types are outside the supplied validator's scope.

- **Proposed:** Kahn's algorithm detects cycles, followed by set-based prerequisite checks and requirement membership checks.
- **Baseline:** repeatedly scans unresolved steps until no progress occurs, followed by loop-based readiness checks. Reversed step order forces many validation passes.

Let V be the number of steps, E the number of supplied dependency edges, and Q the total number of requirement memberships. Under average-case constant-time hashing, the proposed method has an O(V + E + Q) upper bound. The baseline has an O(V(V + E) + Q) worst-case upper bound. This is not a claim that every input reaches the bound. Both construct graph structures and allocate output; both perform the same number of incomplete-step requirement checks. The main benchmark contrast is repeated-scan graph validation, not fewer requirement checks.

## Experiment

Nine cases: 10, 100, and 1,000 steps for each of these families:

| Family | Meaning |
|---|---|
| sequence | Chain dependencies, with step and edge lists shuffled |
| branch | DAG with 1–3 parents chosen from the preceding ten steps; lists shuffled |
| sequence_reversed | Chain with reversed step and edge lists; adverse order for repeated scans |

About 10% of steps receive one or two requirements. The first 30% of the original topological order are marked completed. Each method receives the same inputs for a case. Before timing, the runner checks canonical output equality and equal requirement-check counts.

For each method/case: one untimed warm-up, then ten repetitions. Garbage collection runs before each timing, outside the measured interval. Record median/min/max elapsed milliseconds. Peak Python allocation in KiB is measured separately with `tracemalloc`, excluding prebuilt inputs. Speedup is **baseline median ÷ proposed median**: greater than 1 favors proposed; less than 1 favors baseline.

The random seed fixes generated inputs. `PYTHONHASHSEED=0` also stabilizes string-set iteration on this Python version. Neither guarantees identical timings. Machine load, Python version, caches, and input ordering affect results. The two sequence families have different per-family random seeds, so compare methods within a row, not as an exact paired experiment across families.

Only one seed/machine and a fixed proposed-then-baseline timing order are used. This is a small illustrative benchmark, not a statistically comprehensive study, a production load test, or mathematical proof. Tracemalloc reports Python allocations, not total operating-system memory. `baseline_passes` includes the final no-progress pass. `Q_total` includes completed-step requirements; `req_checks` excludes them.

## Validation and provenance

The supplied 12 tests cover chains, branches/joins, requirements, completed workflows, cycles, invalid IDs/state, unchanged inputs, counters, and 1,000 randomized agreement checks. CI runs these tests plus equivalence checks for all nine generated benchmark inputs. CI has no timing threshold and does not overwrite the committed local benchmark measurements.

Copied code repairs: the pasted `😎` in `randint` was interpreted as `8)`; the test entry-point became `__name__ == '__main__'`; benchmark Markdown escapes and `__file__`/`__name__` were repaired. Algorithm behavior is preserved. Complexity comments were clarified to include Q and hashing assumptions. Added benchmark changes: positive repetition validation, min/max output, timestamp/hash-seed metadata, and explicit failures on unequal results.

## Oral-defense explanation

“We compared our queue-based workflow validation against repeated scanning. We first checked that both produced the same answer, then measured runtime and memory on nine synthetic workflows. Reversed chains make repeated scanning revisit unresolved steps many times. Our measured speedup applies to these inputs and this machine; the complexity explanation comes from the algorithms, not the timing table alone.”

Review `results.md` for actual numbers before presenting. Do not claim the proposed method is always faster or uses less memory unless the measurements support that statement.
