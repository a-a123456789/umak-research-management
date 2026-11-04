# Trigram search and EDF benchmark results

Thirty timed samples per method after five warmups, five seeds. Median of seed medians below; speedup is median paired baseline/proposed. Search times cover six-query batches including selective, typo, common and short queries. All output comparisons passed before timing.

| Suite | Size | Proposed ms | Baseline ms | Speedup |
| --- | ---: | ---: | ---: | ---: |
| edf_heap_vs_scan | 100 | 0.021 | 0.018 | 0.83x |
| edf_heap_vs_scan | 1000 | 0.305 | 1.194 | 3.89x |
| edf_heap_vs_scan | 10000 | 5.992 | 123.451 | 21.01x |
| trigram_public | 1000 | 18.380 | 16.972 | 0.92x |
| trigram_public | 10000 | 124.664 | 166.910 | 1.34x |
| trigram_public | 100000 | 370.142 | 914.492 | 2.47x |
| trigram_duplicates | 1000 | 16.749 | 15.359 | 0.92x |
| trigram_duplicates | 10000 | 109.640 | 155.255 | 1.43x |
| trigram_duplicates | 100000 | 437.067 | 858.064 | 1.93x |

## Meaning and limits

Heap measurements include heapify, deadline changes, cancellation and complete drain. Baseline uses repeated linear minimum selection with identical ordering. Heap O(n log n) batch behavior differs from O(n²) repeated scans; a one-time sort is also O(n log n) and is not compared here. Runtime dispatch uses PostgreSQL atomic claims, not this in-memory benchmark.

Search compares index-supported pg_trgm predicates against exhaustive similarity scoring with the same public/duplicate semantics and ranking. Planner selection is automatic; broad public substring matches can favor scans. Five query seeds share one deterministic synthetic corpus per size. Warmups do not prove every page is cached; no cold-cache or concurrent load claim. Local database network/query overhead is included, HTTP is excluded. No memory or p99 claim. Index build time/size and representative EXPLAIN ANALYZE BUFFERS plans are saved separately.

These inputs test typo retrieval, not real-world duplicate precision or plagiarism detection. No guaranteed speedup for common/short queries. Query arrays, source and dataset generation are in the runner; metadata records source hashes/environment. Raw samples are retained.
