# Skill admission and provenance

Run `npm run check:skills` and `npm run test:skills` before using the audit skill.
CI runs both without installing dependencies. The registry pins the skill's
upstream commit, all 20 file hashes, installer-compatible folder hash, intended
permissions, assessed platform, and review state. The source folder was compared
byte-for-byte against Cloudflare commit
`c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` on 2026-11-07 with no differences.

The current upstream copy contains no HTTP(S) references. Its instruction
companions are vendored and individually hashed. The check rejects added remote
references, unregistered skills, extra/missing/changed files, symlinks, unexpected
metadata fields and capability changes. Remote instruction admission is currently
disabled; adding it requires an explicit policy/checker change and content review.
The check does not fetch upstream or execute any skill content.

For updates, fetch the proposed immutable upstream revision into a separate
inspection directory, inspect the entire diff and privileged behavior, compare
its source directory with the installed copy, then update the registry and lock
in the same reviewed PR. Never automatically accept or regenerate hashes on
failure. Record the reviewer in the PR. Re-run checks for rollback changes too.
The owner label identifies the responsible role, not a recorded human approval.

## Runtime admission remains blocked

The manifest is an admission policy and integrity control, not an OS sandbox or
semantic scanner. Codex source inspection is the assessed use. Target-controlled
process execution is not approved by this registry. A runtime must enforce the
skill's empty allowlisted environment, read-only source/toolchain, assigned
scratch-only writes, no external networking, and CPU/memory/process/file/disk/time
limits. Verify denials with negative tests before recording execution approval.
Neither Docker nor Podman was available during remediation; no isolation tests
or platform action-log guarantees are claimed. A container alone does not prove
all required controls. The CI integrity job is not a sandboxed audit runner.

Git review records and CI receipts support change traceability; they are not
publisher signatures, tamper-evident agent action logs, or a comprehensive
instruction-injection/semantic scan. Review repository settings to require this
CI job and independent review; files alone cannot enforce branch protection.
Broader application action/image/dependency pinning belongs to the application
supply-chain backlog unless those tools are used to execute skills.

## Linux execution harness

See [the sandbox runner](../sandbox/README.md) for the limited, fixed workload
and negative probes now implemented. Its CI receipts can establish evidence for
that run only. They do not approve arbitrary audit commands or lift the skill
registry's general runtime block.
