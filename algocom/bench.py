"""Benchmark supplied CRM methods on synthetic workflows; Python stdlib only.

Usage: python bench.py [--seed 20261001] [--reps 10]
Writes results.csv and results.md beside this script. No timing thresholds.
"""
import argparse
import csv
import gc
import os
import platform
import random
import statistics
import time
import tracemalloc
from datetime import datetime, timezone
from pathlib import Path
from prototype import evaluate_proposed, evaluate_baseline, canonical

SIZES = [10, 100, 1000]
KINDS = ['sequence', 'branch', 'sequence_reversed']


def generate(kind, n, seed):
    rng = random.Random(f'{seed}|{kind}|{n}')
    ids = [f'S{i}' for i in range(1, n + 1)]
    if kind.startswith('sequence'):
        edges = [(ids[i], ids[i + 1]) for i in range(n - 1)]
    else:
        edges = []
        for i in range(1, n):
            k = min(rng.choice([1, 1, 2, 3]), i, 10)
            for j in rng.sample(range(max(0, i - 10), i), k):
                edges.append((ids[j], ids[i]))
    reqs, verified = {}, set()
    for v in ids:
        if rng.random() < 0.10:
            items = [f'req_{v}_{k}' for k in range(rng.choice([1, 2]))]
            reqs[v] = set(items)
            verified |= {q for q in items if rng.random() < 0.7}
    completed = set(ids[:int(0.3 * n)])
    steps = ids[:]
    if kind == 'sequence_reversed':
        steps.reverse()
        edges.reverse()
    else:
        rng.shuffle(steps)
        rng.shuffle(edges)
    return steps, edges, completed, verified, reqs


def median_ms(fn, args, reps):
    fn(*args)  # One untimed warm-up for each implementation/case.
    samples = []
    for _ in range(reps):
        gc.collect()
        start = time.perf_counter()
        fn(*args)
        samples.append((time.perf_counter() - start) * 1000)
    return statistics.median(samples), min(samples), max(samples)


def peak_kib(fn, args):
    gc.collect()
    tracemalloc.start()
    try:
        fn(*args)
        return tracemalloc.get_traced_memory()[1] / 1024
    finally:
        tracemalloc.stop()


def positive_reps(value):
    count = int(value)
    if count < 1:
        raise argparse.ArgumentTypeError('--reps must be at least 1')
    return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seed', default='20261001')
    parser.add_argument('--reps', type=positive_reps, default=10)
    options = parser.parse_args()
    rows = []
    for kind in KINDS:
        for n in SIZES:
            args = generate(kind, n, options.seed)
            sp, sb = {}, {}
            rp = evaluate_proposed(*args, stats=sp)
            rb = evaluate_baseline(*args, stats=sb)
            if rp['status'] != 'SUCCESS' or canonical(rp) != canonical(rb):
                raise RuntimeError(f'Output mismatch: {kind}, V={n}')
            if sp['requirement_checks'] != sb['requirement_checks']:
                raise RuntimeError(f'Requirement-check mismatch: {kind}, V={n}')
            mp = median_ms(evaluate_proposed, args, options.reps)
            mb = median_ms(evaluate_baseline, args, options.reps)
            rows.append({
                'workflow': kind, 'V': n, 'E': len(args[1]),
                'Q_total': sum(len(s) for s in args[4].values()),
                'req_checks': sp['requirement_checks'], 'ready': len(rp['ready_steps']),
                'blocked': len(rp['blocked_steps']), 'baseline_passes': sb['passes'],
                'proposed_median_ms': round(mp[0], 4), 'baseline_median_ms': round(mb[0], 4),
                'proposed_min_ms': round(mp[1], 4), 'proposed_max_ms': round(mp[2], 4),
                'baseline_min_ms': round(mb[1], 4), 'baseline_max_ms': round(mb[2], 4),
                'speedup': round(mb[0] / mp[0], 2) if mp[0] else 'unresolved',
                'proposed_peak_kib': round(peak_kib(evaluate_proposed, args), 1),
                'baseline_peak_kib': round(peak_kib(evaluate_baseline, args), 1),
            })
    here = Path(__file__).resolve().parent
    with (here / 'results.csv').open('w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    environment = (
        f'Python {platform.python_version()} ({platform.python_implementation()}), '
        f'{platform.platform()}, {platform.machine()}, {os.cpu_count()} logical CPUs; '
        f'seed={options.seed}; reps={options.reps}; PYTHONHASHSEED={os.environ.get("PYTHONHASHSEED", "unset")}; '
        '1 untimed warm-up per method/case; timing=time.perf_counter; '
        'memory=tracemalloc peak in a separate single run; dependencies=stdlib only'
    )
    cols = list(rows[0])
    content = '# Measured ALGOCOM benchmark results\n\n'
    content += 'Measured (UTC): ' + datetime.now(timezone.utc).isoformat() + '\n\n'
    content += 'Environment: ' + environment + '\n\n'
    content += 'All nine cases passed output-equivalence and requirement-check comparisons before timing.\n\n'
    content += '| ' + ' | '.join(cols) + ' |\n|' + '---|' * len(cols) + '\n'
    for row in rows:
        content += '| ' + ' | '.join(str(row[col]) for col in cols) + ' |\n'
    content += '\nSpeedup = baseline median / proposed median. Above 1 favors proposed; below 1 favors baseline.\n'
    content += '\nSynthetic inputs; one input seed, one machine, and fixed method order. These measurements illustrate performance, not a proof of asymptotic complexity. Memory is traced Python allocation peak, not process RSS. See README.md for limitations.\n'
    (here / 'results.md').write_text(content, encoding='utf-8')
    print(content)


if __name__ == '__main__':
    main()
