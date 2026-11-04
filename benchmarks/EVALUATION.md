# Evaluation: retain DAG and add lifecycle FSM

Measured 4 November 2026 (Asia/Manila). Full [measurement report](results/20261104T143200Z/report.md), [raw samples](results/20261104T143200Z/samples.csv), [environment/source manifest](results/20261104T143200Z/metadata.json), and [reproduction instructions](README.md).

## Decision

Retain the existing DAG implementation. Use the new pure lifecycle FSM prototype as the basis for a separately persisted research lifecycle. There is no valid overall DAG-versus-FSM speed winner: DAG outputs prerequisite readiness and critical-path estimates; FSM outputs legal lifecycle transitions and independent outcome dates.

At 1,000 steps, median paired DAG speedup over equivalent repeated scanning was 24.91x for shuffled sequences, 6.38x for branches and 44.00x for reversed sequences. Proposed median batch times were 2.64 ms, 3.57 ms and 2.59 ms respectively. These favorable cases do not imply all graph families or small inputs will show the same gains. Python allocation peaks were similar at 1,000 steps and sometimes slightly larger for the proposed method; no general memory-saving claim is supported.

The transition table and conditional FSM were essentially tied: 10,000 independent histories took 78.75 ms and 78.79 ms respectively, with identical measured allocation peaks. Select the transition table for clarity and centralized policy, not a demonstrated runtime advantage. Both are constant-time transition checks; replay scales with total events.

## Evidence

The run covered 12 workload/size combinations, five dataset seeds each, and 30 timed repetitions per method/seed: 3,600 timed batch samples, plus warmups and separate allocation profiling. Method order was randomized; input construction and garbage collection were outside timing. Every pair passed output agreement before timing. The full algorithm suite passed 24 test methods, including existing 1,000 original and 500 extended randomized DAG comparisons plus 500 new randomized lifecycle comparisons. Explicit lifecycle tests also cover all state pairs, revisions, invalid dates/events, independent outcomes, and a DAG evidence-gate composition example.

The benchmark keeps raw per-seed data and reports medians and seed ranges. It does not infer statistical significance from tiny FSM differences. The shared FSM validation/output code means this measures the alternative transition predicates within a complete replay, not two fully independent implementations.

## Delivered implementation and remaining work

`algocom/lifecycle.py` adds an immutable lifecycle region with independent Presented/Published outcome dates. `algocom/test_lifecycle.py` verifies its behavior. `benchmarks/benchmark_models.py` reruns both DAG and FSM comparisons without overwriting older benchmark evidence. Existing CI unittest discovery already picks up the new tests.

No database schema, Express routes, dependencies, or existing DAG API contract were changed. Persisting the lifecycle still requires transactional state/version updates, permissions and audit integration. This DAG/FSM evaluation did not implement or measure trigram/EDF or the security suites. Trigram retrieval and EDF have since been added in a separate change; see [their API documentation](../docs/SEARCH_AND_CONSULTATIONS.md) and the feature benchmark section of [the benchmark instructions](README.md). Chained logging, bcrypt and RBAC benchmarks remain future phases.

Next implementation step: add lifecycle/outcome migrations and permission-protected transition services while retaining the current Draft/Approved visibility field. Use DAG readiness as an explicit prerequisite gate where required by a documented workflow; allow FSM transition only when both the workflow gate and lifecycle policy pass in a consistent transaction. Benchmark that integration separately against an equivalent baseline after it exists.
