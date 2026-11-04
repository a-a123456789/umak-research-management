"""Reproducible DAG and lifecycle benchmarks; standard library only."""
import argparse
import csv
from datetime import datetime, timezone
import gc
import hashlib
import json
import os
from pathlib import Path
import platform
import random
import statistics
import subprocess
import sys
import time
import tracemalloc

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'algocom'))
from bench import generate
from engine import solve
from bench_extended import equivalent
from lifecycle import replay


def lifecycle_batch(histories, method):
    return [replay(events, method) for events in histories]


def histories_for(n, seed):
    rng = random.Random(seed)
    histories = []
    for _ in range(n):
        events = ['In-Progress', 'UnderReview']
        if rng.random() < .5:
            events += ['In-Progress', 'UnderReview']
        events += ['Completed', 'Presented', 'Published']
        if rng.random() < .5:
            events.insert(0, 'Published')
        events += [rng.choice(('Registered', 'Completed', 'unknown'))]
        histories.append([(action, '2026-02-01') for action in events])
    return histories


def dag_payload(kind, n, seed):
    steps, edges, done, verified, requirements = generate(kind, n, str(seed))
    rng = random.Random(seed)
    return dict(steps=steps, dependencies=[list(e) for e in edges],
                completed_actions=sorted(done),
                requirements={v: [{'id': q, 'gate': 'verified'} for q in sorted(items)]
                              for v, items in requirements.items()},
                evidence=[{'id': q, 'state': 'verified'} for q in sorted(verified)],
                durations={v: rng.randint(0, 60) for v in steps})


def measure(functions, reps, rng):
    for fn in functions.values():
        for _ in range(5):
            fn()
    samples = {name: [] for name in functions}
    for repetition in range(reps):
        order = list(functions)
        rng.shuffle(order)
        for name in order:
            gc.collect()
            start = time.perf_counter_ns()
            functions[name]()
            samples[name].append((time.perf_counter_ns() - start) / 1e6)
    peaks = {}
    for name, fn in functions.items():
        gc.collect()
        tracemalloc.start()
        fn()
        _, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        peaks[name] = peak / 1024
    return samples, peaks


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--reps', type=int, default=30)
    parser.add_argument('--seeds', type=int, default=5)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if args.reps < 1 or args.seeds < 1:
        parser.error('reps and seeds must be positive')
    out = args.output or ROOT / 'benchmarks' / 'results' / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    out.mkdir(parents=True, exist_ok=False)
    metadata = dict(measured_utc=datetime.now(timezone.utc).isoformat(),
                    python=sys.version, platform=platform.platform(), machine=platform.machine(),
                    logical_cpus=os.cpu_count(), hash_seed=os.environ.get('PYTHONHASHSEED', 'unset'),
                    commit=subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
                    dirty_status=subprocess.check_output(['git', 'status', '--short'], cwd=ROOT, text=True),
                    reps=args.reps, seeds=list(range(20261104, 20261104 + args.seeds)), warmups=5,
                    timing='perf_counter_ns; GC before each sample outside timer; randomized method order',
                    memory='separate single tracemalloc run; prebuilt inputs excluded; Python allocations, not RSS',
                    scope='Pure Python, no API/database/network/concurrency; synthetic data')
    metadata['source_sha256'] = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in [Path(__file__).resolve(), ROOT/'algocom/lifecycle.py', ROOT/'algocom/engine.py',
                  ROOT/'algocom/prototype.py', ROOT/'algocom/bench.py']}
    (out / 'metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
    rows, raw = [], []
    for suite in ('dag', 'fsm'):
        kinds = ('sequence', 'branch', 'sequence_reversed') if suite == 'dag' else ('mixed_histories',)
        sizes = (10, 100, 1000) if suite == 'dag' else (100, 1000, 10000)
        for kind in kinds:
            for n in sizes:
                for seed in metadata['seeds']:
                    if suite == 'dag':
                        payload = dag_payload(kind, n, seed)
                        proposed = lambda: solve(payload)
                        baseline = lambda: solve(payload, True)
                        assert equivalent(proposed(), baseline()), (kind, n, seed)
                        units = n
                        input_data = payload
                    else:
                        histories = histories_for(n, seed)
                        proposed = lambda: lifecycle_batch(histories, 'table')
                        baseline = lambda: lifecycle_batch(histories, 'conditional')
                        assert proposed() == baseline(), (n, seed)
                        units = sum(map(len, histories))
                        input_data = histories
                    digest = hashlib.sha256(json.dumps(input_data, sort_keys=True).encode()).hexdigest()
                    times, peaks = measure({'proposed': proposed, 'baseline': baseline}, args.reps, random.Random(seed))
                    medians = {k: statistics.median(v) for k, v in times.items()}
                    rows.append(dict(suite=suite, workload=kind, size=n, seed=seed, units=units,
                        input_sha256=digest, proposed_median_ms=medians['proposed'],
                        baseline_median_ms=medians['baseline'], speedup=medians['baseline']/medians['proposed'],
                        proposed_peak_kib=peaks['proposed'], baseline_peak_kib=peaks['baseline']))
                    for method, samples in times.items():
                        raw.extend(dict(suite=suite, workload=kind, size=n, seed=seed,
                                        method=method, repetition=i, elapsed_ms=value)
                                   for i, value in enumerate(samples))
                print(suite, kind, n, 'complete', flush=True)
    for filename, data in [('summary.csv', rows), ('samples.csv', raw)]:
        with (out / filename).open('w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=list(data[0]))
            writer.writeheader()
            writer.writerows(data)
    (out / 'summary.json').write_text(json.dumps(rows, indent=2) + '\n')
    report = ['# DAG and lifecycle FSM measured benchmark', '',
              'Synthetic pure Python measurements. Each method was checked for output agreement before timing.', '',
              f"Environment: {metadata['platform']}; Python {platform.python_version()}; {args.seeds} seeds, {args.reps} samples per method/seed, five warmups.", '',
              'Times below are medians of per-seed medians. Speedup is the median paired baseline/proposed ratio; the range spans seed ratios. These are batch latencies, not per-request percentiles.', '',
              '| Suite / workload | Size | Proposed ms | Baseline ms | Speedup (seed range) | Proposed / baseline peak KiB |',
              '| --- | ---: | ---: | ---: | ---: | ---: |']
    for suite, kind, n in dict.fromkeys((r['suite'], r['workload'], r['size']) for r in rows):
        group = [r for r in rows if (r['suite'], r['workload'], r['size']) == (suite, kind, n)]
        median = lambda key: statistics.median(r[key] for r in group)
        ratios = [r['speedup'] for r in group]
        report.append(f"| {suite} / {kind} | {n} | {median('proposed_median_ms'):.4f} | {median('baseline_median_ms'):.4f} | {statistics.median(ratios):.2f}x ({min(ratios):.2f}–{max(ratios):.2f}) | {median('proposed_peak_kib'):.1f} / {median('baseline_peak_kib'):.1f} |")
    report += ['', '## Interpretation and limits', '',
               'DAG compares the existing validated Kahn/readiness plus topological duration implementation against repeated scanning with the same result contract. Shuffled and reversed chains expose scan-order sensitivity. Both include input validation and output allocation. O(V+E+Q+B) expected hashing bounds differ from the scan worst-case bound; measurements do not prove these bounds.', '',
               'FSM compares table membership against conditional transition logic, sharing date validation, outcome handling and immutable state construction. It replays independent research histories, including revisions and rejected events. Each transition method is O(1); total replay is O(number of events). A small timing difference does not imply a different complexity class. Peak allocation includes retained per-record outputs.', '',
               'DAG and FSM perform different jobs and are not ranked against each other. Retain the DAG for prerequisites/duration, and use the lifecycle FSM for legal state transitions and independent outcomes. Integration still needs database transactions, authorization and concurrency control; the pure FSM is not a production lifecycle endpoint.', '',
               'One machine, synthetic workloads, no database or HTTP load, and no operational SLA claims. Five seeds are workload variation, not five machines. Core timings include construction of outputs but exclude generation of inputs. Memory profiling is separate. Shared FSM logic means equivalence checks alone are insufficient; the lifecycle test suite also checks explicit expected transitions and dates.', '',
               'Raw samples, per-seed summaries, dataset hashes, source hashes and environment are saved beside this report. Existing committed ALGOCOM results were not overwritten.']
    (out / 'report.md').write_text('\n'.join(report) + '\n')
    print(out)

if __name__ == '__main__':
    main()
