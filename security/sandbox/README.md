# Linux audit sandbox

The `audit-sandbox` GitHub Actions workflow uses a fresh Ubuntu 24.04 hosted
runner. It runs on pushes to the implementation branch `codex/linux-audit-sandbox`
and can be manually dispatched after the workflow is available on the default
branch. No repository secrets or agent/API credentials are requested.

Run locally on a Linux Docker engine:

```sh
python3 scripts/audit-sandbox.py --output /absolute/new/evidence-directory
```

The launcher pulls an immutable Node 24 Debian image before processing target
code. It copies only `package.json`, the worker-result validator, and its unit
test to a disposable staging directory. No dependency installation, whole-repo
mount, host-home mount, Docker socket, source secrets, or Git credentials are
exposed. This is deliberately a small initial approved workload; database,
upload, Python worker, Android and full agent-led audits are not included.

Each probe and workload gets a separate non-root container, read-only root and
source/toolchain, dropped capabilities, no-new-privileges, network and IPC
isolation, an empty allowlisted process environment, and 64 MiB scratch tmpfs.
Limits: 0.5 CPU, 2 CPU seconds, 256 MiB memory with no extra swap, 64 tasks,
128 file descriptors, 8 MiB per file, 20 wall seconds and 64 KiB output. The wall
probe has a two-second deadline. Scratch is noexec/nosuid/nodev. Standard kernel
virtual filesystems are still present; this is a container boundary, not a VM.

Host-side inspection checks requested Docker controls before starting code.
Negative probes then exercise source/toolchain/harness write denial, absent
secrets/host mounts, sanitized environment, egress denial, file/disk/process/
memory/CPU limits, wall timeout, and output overflow. The approved unit tests
run only after every probe passes. Configuration or probe failures stop the
workload. An unavailable Linux Docker engine produces a blocked receipt and a
nonzero exit, never a fallback host execution.

Only a bounded host-generated JSON receipt is retained. Target stdout is
counted and discarded (never interpreted as a GitHub workflow command), and no
sandbox files are promoted. The receipt records source hashes, harness hash,
image digest, source revision/dirty state, limits and per-check results. It is
uploaded even on failure and retained for 14 days. Inspect Actions step status
as well as receipt results: failed/missing receipts are not passing evidence.
Receipts are not tamper-evident external action logs or publisher signatures.

These checks establish evidence for this exact launcher/image/workload and run.
They do not approve arbitrary commands, prove container-escape resistance, or
establish another agent runtime's isolation. Changes to the launcher, probes,
workflow or image require review and a fresh successful run. Do not switch the
skill registry to universal runtime approval based on this limited harness.

## Verified run

[Run 42342595964](https://github.com/project-works-collab/umak-research-management/actions/runs/42342595964)
passed all eight probes and the approved workload on 2026-11-07 in 30 seconds
for the complete job. The source revision and bounded results are preserved in
[evidence/8ac44ea.json](evidence/8ac44ea.json). The application security gate and
algorithm checks also passed for that revision. These results apply to the
recorded code/image/configuration, with the scope limitations above.
