# DAG and lifecycle FSM measured benchmark

Synthetic pure Python measurements. Each method was checked for output agreement before timing.

Environment: macOS-26.5.2-arm64-arm-64bit-Mach-O; Python 3.14.5; 5 seeds, 30 samples per method/seed, five warmups.

Times below are medians of per-seed medians. Speedup is the median paired baseline/proposed ratio; the range spans seed ratios. These are batch latencies, not per-request percentiles.

| Suite / workload | Size | Proposed ms | Baseline ms | Speedup (seed range) | Proposed / baseline peak KiB |
| --- | ---: | ---: | ---: | ---: | ---: |
| dag / sequence | 10 | 0.0271 | 0.0310 | 1.13x (1.09–1.15) | 9.6 / 8.8 |
| dag / sequence | 100 | 0.2205 | 0.7487 | 3.36x (3.34–3.49) | 84.1 / 86.2 |
| dag / sequence | 1000 | 2.6375 | 65.0799 | 24.91x (23.92–25.48) | 784.5 / 783.7 |
| dag / branch | 10 | 0.0355 | 0.0385 | 1.06x (1.06–1.11) | 9.7 / 8.9 |
| dag / branch | 100 | 0.3160 | 0.4863 | 1.54x (1.49–1.62) | 91.5 / 94.9 |
| dag / branch | 1000 | 3.5696 | 22.3323 | 6.38x (6.06–6.59) | 855.7 / 854.4 |
| dag / sequence_reversed | 10 | 0.0330 | 0.0425 | 1.28x (1.25–1.30) | 10.2 / 9.4 |
| dag / sequence_reversed | 100 | 0.2344 | 1.2643 | 5.39x (5.23–5.61) | 84.4 / 86.6 |
| dag / sequence_reversed | 1000 | 2.5851 | 113.6668 | 44.00x (43.63–44.15) | 783.9 / 783.1 |
| fsm / mixed_histories | 100 | 0.7924 | 0.7948 | 1.00x (1.00–1.01) | 27.8 / 27.8 |
| fsm / mixed_histories | 1000 | 7.8192 | 7.8195 | 1.00x (1.00–1.00) | 183.2 / 183.2 |
| fsm / mixed_histories | 10000 | 78.7505 | 78.7906 | 1.00x (1.00–1.00) | 1734.3 / 1734.3 |

## Interpretation and limits

DAG compares the existing validated Kahn/readiness plus topological duration implementation against repeated scanning with the same result contract. Shuffled and reversed chains expose scan-order sensitivity. Both include input validation and output allocation. O(V+E+Q+B) expected hashing bounds differ from the scan worst-case bound; measurements do not prove these bounds.

FSM compares table membership against conditional transition logic, sharing date validation, outcome handling and immutable state construction. It replays independent research histories, including revisions and rejected events. Each transition method is O(1); total replay is O(number of events). A small timing difference does not imply a different complexity class. Peak allocation includes retained per-record outputs.

DAG and FSM perform different jobs and are not ranked against each other. Retain the DAG for prerequisites/duration, and use the lifecycle FSM for legal state transitions and independent outcomes. Integration still needs database transactions, authorization and concurrency control; the pure FSM is not a production lifecycle endpoint.

One machine, synthetic workloads, no database or HTTP load, and no operational SLA claims. Five seeds are workload variation, not five machines. Core timings include construction of outputs but exclude generation of inputs. Memory profiling is separate. Shared FSM logic means equivalence checks alone are insufficient; the lifecycle test suite also checks explicit expected transitions and dates.

Raw samples, per-seed summaries, dataset hashes, source hashes and environment are saved beside this report. Existing committed ALGOCOM results were not overwritten.
