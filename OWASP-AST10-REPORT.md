# OWASP Agentic Skills Top 10 Assessment

> **Current combined status:** See the [Overall Security Assessment and Remediation Report](OVERALL-SECURITY-ASSESSMENT.md) for both assessments, subsequent changes, verified Linux CI evidence, and outstanding work. Historical baseline statements below remain tied to their original review stage.

Assessment date: 2026-11-07 (Asia/Manila)  
Reviewed repository commit: `693f2edae511643546e460ff50257a710850b4f7`  
Original assessment worktree: reported clean; this report was untracked at revision time  
Application code: not modified

## Framework revision and scope

The assessed OWASP repository is `OWASP/www-project-agentic-skills-top-10`,
`main` at `d6f7d7d0de314f52a83a85d1828e06ab096e595c`, resolved on 2026-11-07.
The project describes this as **Version 1.0 (2026 Edition)** and covers
OpenClaw, Claude Code, Cursor/Codex, and VS Code skill ecosystems.

Reviewed the Cloudflare security-audit skill and all companion files under
`.agents/skills/security-audit/`, `skills-lock.json`, repository instructions,
supporting validators/scripts, package/Python/Gradle dependency inputs, GitHub
Actions workflows, hooks, permissions, and the committed audit artifacts under
`security/audit/run-1/` and `00-INTERIM-SECURITY-AUDIT.md`.

No repository `AGENTS.md`, `CLAUDE.md`, or other agent instruction file exists.
No live agent runtime, Cloudflare control plane, registry, GitHub settings,
runner policy, or production deployment was inspected. Those facts are
**UNVERIFIED**. Existing audit artifacts record that target execution was not
run because the required OS-enforced sandbox controls were unavailable.

## Linux sandbox implementation and verified CI evidence

The Linux workflow and host-side Docker launcher are implemented under
`.github/workflows/audit-sandbox.yml`, `scripts/audit-sandbox.py`, and
`security/sandbox/`. On 2026-11-07, [CI run 42342595964](https://github.com/project-works-collab/umak-research-management/actions/runs/42342595964)
passed all eight negative isolation/resource probes and the fixed,
dependency-free worker-result test workload. The host-generated receipt is
retained at `security/sandbox/evidence/8ac44ea.json` and records the reviewed
source revision, exact input hashes, immutable image digest, limits and results.
The existing security gate and algorithm checks also passed at that revision.

AST03 and AST06 now have **SATISFIED evidence for this specific Linux harness,
image, fixed workload and run**: filesystem/environment/egress boundaries,
file-size/disk/process/memory/CPU limits, wall timeout and output overflow were
exercised. General skill execution, other platforms, arbitrary commands, and
full application integration workloads remain **UNVERIFIED**. The general
runtime block in the skill registry is intentionally retained. CI artifacts and
the checked-in receipt are evidence, not independently tamper-evident logs.
No publisher signature or semantic behavioral-scanner coverage is claimed.

## Remediation update — 2026-11-07

This section supersedes the original matrix's statements about missing
repository inventory, revision pins, permission metadata, and integrity checks.
The matrix below preserves the assessment baseline rather than implying that
runtime controls have subsequently been verified.

Implemented `security/skills/registry.json`, `scripts/check-skills.js`, focused
regression tests, CI admission checks, skill-change PR review fields, and the
update procedure in `security/skills/README.md`. The complete 20-file upstream
skill directory was compared with commit
`c1c8a8c1471069fb0e188eeaff69b8e8db6564a8`; there were no differences. Installed
content and lockfile match. No HTTP(S) references occur in the vendored skill;
new remote references are rejected pending policy review. Local companions are
included in the file inventory and hashes.

| Category | Current control status after remediation |
| --- | --- |
| AST01 | PARTIAL: pinned provenance and file checks; independent behavioral approval and publisher authentication remain unverified |
| AST02 | PARTIAL: skill revision and content pinned; no claim about broader application supply-chain closure |
| AST03 | PARTIAL: machine-readable intended permissions; runtime enforcement remains UNVERIFIED |
| AST04 | PARTIAL: strict registry field and value checks; platform loader/parser behavior remains UNVERIFIED |
| AST05 | PARTIAL: vendored companions inventoried; remote references blocked by CI, platform fetching remains UNVERIFIED |
| AST06 | UNVERIFIED: neither Docker nor Podman is available; no execution-isolation evidence established |
| AST07 | SATISFIED for local integrity/revision checks; updates still require review and CI enforcement through repository settings |
| AST08 | PARTIAL: integrity/metadata checks and negative regression tests; semantic behavioral scanning remains absent |
| AST09 | PARTIAL: role owner, review state, inventory and PR review fields; actual human approval and protected runtime logs remain unverified |
| AST10 | PARTIAL for declared Codex scope; other platforms remain UNVERIFIED |

Verification: `npm run check:skills` and `npm run test:skills` passed. Negative
checks covered file drift, unregistered skills, symlinks, and broadened network
permissions. These are trusted integrity-checker tests, not execution of the
vendored audit skill or proof of an OS sandbox. The registry explicitly records
runtime execution as blocked pending evidence. No application code or installed
skill content was changed. Branch protection and platform controls require
separate verification; no signature, semantic scanner, or runtime approval is
claimed.

## Executive assessment

Positive controls include source-first audit instructions, explicit sandbox
requirements, read-only workflow permissions, secret scanning, Semgrep,
Gitleaks, npm audit, a package lockfile, tests, and structured prior audit
artifacts. The workflow lacks a complete skill control plane: provenance is
incomplete (the installed folder matches its lockfile, but no immutable source revision is recorded), external instructions are not inventoried or content-pinned, no
machine-readable per-skill permission manifest exists, and no agent-skill-aware
semantic scanner or runtime isolation evidence is present.

## Status and evidence conventions

Control status is **SATISFIED**, **PARTIAL**, **GAP**, **UNVERIFIED**, or
**NOT APPLICABLE**. PARTIAL means some controls are evidenced; UNVERIFIED means
execution or platform evidence is unavailable. These statuses are separate from
vulnerability confirmation. Missing repository evidence does not establish that
a platform lacks a control. Recommendations below are proportionate next steps,
not a claim that every suggested mechanism is an OWASP certification requirement.

Revision validation on 2026-11-07 corrected the AST07 hash comparison using the
locally installed Skills CLI folder-hash algorithm. Other original assessment
observations are retained with the scope and limitations below; this revision
does not constitute a new runtime audit.

## AST01–AST10 matrix

### AST01 — Malicious Skills

**Applicability:** Applicable to the Cloudflare audit skill and future skills.

**Evidence:** `.agents/skills/` contains behavioral instructions and
`skills-lock.json:4-8` identifies the Cloudflare GitHub source. Existing secret,
Semgrep, and Gitleaks checks target application/repository content; they do not
establish skill behavioral review. No signature, publisher verification, or
privileged-behavior approval is present.

**Gap and fix:** Add an approved inventory with publisher, owner, immutable
source, hash, permissions, review, and revocation state. Start with an immutable reviewed revision and verified folder hash; review
requested tool, file, secret, and network behavior. Add publisher signatures
where available and verifiable.

**Status:** **PARTIAL**; no malicious skill was confirmed.

### AST02 — Supply Chain Compromise

**Applicability:** Applicable to the skill and dependencies, actions, or images
that install, validate, or execute it. Broader application dependency concerns
belong in the application audit unless a skill-execution connection is shown.

**Evidence:** The skill lock records a source and folder hash but no immutable
source revision. Application CI uses a package lock and `npm ci --ignore-scripts`;
caret ranges alone do not establish installation drift under that lockfile.
The original assessment identified mutable action/image selectors and unhashed
Python inputs; their relevance to skill execution requires a dependency map.

**Gap and fix:** Pin the reviewed skill revision and verify its folder hash.
Map its execution dependencies, then pin relevant actions/images and lock or
hash relevant package inputs. Add provenance attestations or SBOMs where their
risk and operational value justify them.

**Status:** **PARTIAL**; no supply-chain compromise confirmed.

### AST03 — Over-Privileged Skills

**Applicability:** Applicable because the audit skill directs file inspection,
command execution, and processing of external inputs.

**Evidence:** `SKILL.md` requires no external network, an empty allowlisted
environment, read-only target/toolchain, scratch-only writes, and resource
limits. CI jobs declare `permissions: contents: read`. No machine-readable
per-skill capability manifest or runtime-enforcement evidence was identified in
the repository. Platform enforcement was not inspected. Backup integration-test
mounts and networking do not establish the audit agent’s effective permissions.

**Gap and fix:** Add and enforce per-skill filesystem, process, network, secret,
and write capabilities; fail closed when enforcement is unavailable.

**Status:** **UNVERIFIED**; no confirmed
over-privilege finding.

### AST04 — Insecure Metadata

**Applicability:** Applicable to skill metadata, `skills-lock.json`, CI YAML,
and dependency manifests.

**Evidence:** `skills-lock.json` has source/path/hash but no immutable source
revision, signature, permission declaration, or schema. No skill metadata
loader or validation command is present.

**Gap and fix:** Define a strict versioned manifest containing canonical source,
immutable revision, content hash, publisher, permissions, and platform. Reject
unknown fields and unsafe parser behavior.

**Status:** **PARTIAL**; no metadata parser exploit confirmed.

### AST05 — Untrusted External Instructions

**Applicability:** Directly applicable to the GitHub-sourced Cloudflare skill and
any linked/fetched instructions.

**Evidence:** `skills-lock.json:5-7` records a remote source but no commit,
referenced-content inventory, or content hashes. The skill itself is copied locally; a complete inventory and content pins for
its external instruction references, review receipts, and rescans are not evidenced.

**Gap and fix:** Inventory remote instructions, vendor or inline approved text,
pin URL plus commit/content hash, treat fetched text as untrusted data, and
rescan on change and on schedule.

**Status:** **PARTIAL**; platform fetching is
unverified.

### AST06 — Weak Isolation

**Applicability:** Applicable to agent execution and CI processing of skill and
repository content.

**Evidence:** The skill prescribes isolation, but the repository has no sandbox
implementation or proof of enforcement. Backup integration-test helpers use repository mounts and
`--network host`; these are not proof of the audit agent’s isolation policy. The prior audit records missing complete
OS-enforced sandbox quotas and unavailable container isolation.

**Gap and fix:** Use a dedicated non-root sandbox with read-only source,
isolated networking, explicit egress policy, scratch volume, dropped
capabilities, and CPU/memory/process/file/disk/time limits. Add negative tests.

**Status:** **UNVERIFIED**; high-priority validation requirement.

### AST07 — Update Drift

**Applicability:** Directly applicable to the Cloudflare skill and dependency
update channels.

**Evidence:** `skills-lock.json:5-8` records a GitHub source without an immutable
commit. Its `computedHash` is a folder hash, not a hash of `SKILL.md` alone.
Recalculation over all 20 regular files, using the locally installed Skills CLI
algorithm, produced:

```text
98b97aad2873b3b9a8e064007c25e7827b493ba27fda8bfbdb41dab586767973
```

This matches the lockfile. The previously reported single-file value is not
comparable and does not demonstrate drift. The algorithm recursively excludes
`.git` and `node_modules`, sorts slash-normalized relative paths using JavaScript
`localeCompare`, and feeds each path followed by its raw content into SHA-256.
It was inspected in `skills/dist/cli.mjs`, functions `computeSkillFolderHash`
and `collectFiles`, from the locally cached installer. Matching the lockfile
establishes local consistency, not publisher authenticity or upstream identity.

**Gap and fix:** Record the immutable reviewed upstream revision and verify its
relationship to the installed content. Add a repeatable folder-hash check and
require review and rescanning of intentional skill updates and rollbacks. Do
not change the existing lock hash merely to match a different hash algorithm.

**Status:** **PARTIAL**; local folder integrity check satisfied, immutable-source
provenance incomplete. No integrity mismatch or malicious update confirmed.

### AST08 — Poor Scanning

**Applicability:** Applicable to skills, scripts, external instructions,
archives, obfuscation, CI configuration, and dependencies.

**Evidence:** CI runs npm audit, secret checks, Gitleaks, Semgrep, package
validation, and tests. No agent-skill-aware semantic scan,
instruction-injection scan, external-content fetch-and-scan,
Unicode/encoding/archive coverage, or privileged-behavior human gate is
evidenced.

**Gap and fix:** Begin with metadata/hash validation and human review of privileged behavior.
Add layered scanning for dangerous tools, secret flows,
Unicode/encoding/archive content, dependencies, provenance, and semantic
behavior in quarantine. Record scanner versions and receipts.

**Status:** **PARTIAL**.

### AST09 — No Governance

**Applicability:** Applicable to the development and audit workflow.

**Evidence:** The PR template requests risk/control and evidence, and prior
audit artifacts provide structured findings and coverage. No skill inventory,
owner/approval record, review expiry, admission record, or tamper-evident agent
action log was identified in the reviewed repository; platform logging was not inspected. `security/BACKLOG.md` documents residual audit-history
tampering risk.

**Gap and fix:** Create a versioned skill registry with owner, purpose,
permissions, source/hash, platforms, approvals, expiry, exceptions, incident
contact, and revocation. Start with versioned approval and scan receipts. Log admission, updates,
invocations, privileged actions, and denials where the platform supports them;
use independently protected logs when the threat model requires tamper resistance.

**Status:** **PARTIAL**.

### AST10 — Cross-Platform Reuse

**Applicability:** Applicable if the skill is reused across Codex, Claude,
OpenClaw, VS Code, or another agent runtime; not applicable to the Express /
PostgreSQL application runtime.

**Evidence:** Only a Codex-style `.agents/skills/security-audit/` skill is
visible. No universal manifest, platform adapters, or cross-platform validation
matrix is present, and deployment on another platform is not evidenced.

**Gap and fix:** If reuse is intended, define a canonical capability manifest
and platform adapters, then verify equivalent permissions, confirmations,
isolation, logging, and update behavior. Otherwise document Codex as the currently assessed platform; assess other
platforms before claiming equivalent controls. Missing adapters alone are not a vulnerability.

**Status:** **UNVERIFIED** for cross-platform reuse; **NOT APPLICABLE** to the
application runtime.

## Prioritized remediation

1. Record an immutable reviewed skill revision and upstream-content verification;
   retain the matching folder-hash evidence (AST07, AST01, AST02).
2. Inventory skill files, external instruction references, intended capabilities,
   owner, approval, and assessed platform (AST03, AST04, AST05, AST09, AST10).
3. Verify execution isolation with negative tests for network access, source
   writes, secret/environment access, and resource limits (AST03, AST06).
4. Add repeatable integrity and metadata checks to CI; review changes to relevant
   skill execution dependencies (AST02, AST07, AST08).
5. Expand behavioral scanning, approval receipts, and protected action logging
   according to the workflow’s actual privilege and risk (AST01, AST08, AST09).

## Limitations

- No live agent runtime, hosted runner, GitHub settings, Cloudflare account,
  registry, or production deployment was inspected.
- No target-controlled execution was performed because the existing audit run
  recorded missing OS-enforced sandbox quotas and unavailable container
  isolation.
- No malicious skill or application vulnerability is asserted. The prior AST07 hash-mismatch claim is withdrawn: installer-compatible
  recalculation matches the lockfile. Missing immutable revision and runtime
  evidence remain control-assurance limitations, not confirmed exploits.
- This report assesses the workflow and skill supply chain; it does not replace
  the application security audit under `security/audit/run-1/`.

