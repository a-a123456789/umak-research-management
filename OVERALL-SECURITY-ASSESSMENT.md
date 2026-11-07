# Overall Security Assessment and Remediation Report

**Project:** UMak Center for Research Management (CRM)  
**Report date:** 7 November 2026, Asia/Manila  
**Repository snapshot:** `8e5e602963986bbd5440fafc19a2d45d1cadd264` (`main`)  
**Status:** Both assessment reports are available; workflow remediation is implemented and scoped Linux isolation is verified. Application validation remains open.

## Overall assessment

The Cloudflare-method application audit and OWASP Agentic Skills Top 10 assessment
cover different boundaries. The application audit reviewed API, database,
processing, storage, recovery, mobile, and CI source. The OWASP assessment
reviewed the security of the agent skills and development/audit workflow.

The application audit recorded **0 confirmed vulnerabilities, 4 leads needing
validation, and 0 rejected claims**. These counts remain unchanged. No targeted
reproduction of those four leads has subsequently been recorded. Zero confirmed
findings does not establish that the application is vulnerability-free.

The workflow assessment led to implemented provenance, integrity, metadata,
review-process, and Linux execution controls. All eight isolation probes and the
approved worker-result unit tests passed in CI. General agent execution,
production deployment, and the four application leads are not covered by that
limited workload. No malicious skill or supply-chain compromise was confirmed.

This document is the current combined summary. The original reports preserve
their historical assessment snapshots. It consolidates documented evidence and
changes; it does not claim a fresh full application audit or certification by
Cloudflare or OWASP.

## Assessment scope and source reports

| Assessment | Reviewed snapshot and method | Primary evidence |
| --- | --- | --- |
| Cloudflare security-audit methodology | Standard source review, 6 November 2026; commit `d44e926c1405be27041bf4c93043f1956d06d6a6`, with additional untracked skill inputs inventoried in run metadata | [Application audit](00-INTERIM-SECURITY-AUDIT.md), [structured findings](security/audit/run-1/findings.json), [coverage ledger](security/audit/run-1/coverage-ledger.json) |
| OWASP Agentic Skills Top 10 | Assessment dated 7 November 2026; initial repository commit `693f2edae511643546e460ff50257a710850b4f7`; framework revision `d6f7d7d0de314f52a83a85d1828e06ab096e595c`; later remediation/evidence recorded separately | [OWASP assessment and updates](OWASP-AST10-REPORT.md) |
| Remediation and Linux verification | Changes merged through [PR #9](https://github.com/project-works-collab/umak-research-management/pull/9); main snapshot shown above | [Skill registry](security/skills/registry.json), [sandbox guide](security/sandbox/README.md), [saved runtime receipt](security/sandbox/evidence/8ac44ea.json) |

The initial application review covered 31 ledger units: 12 source-covered,
5 candidate-linked, and 14 blocked. Candidate-linked units are coverage records,
not five distinct confirmed findings; final records contain four unique
needs-validation leads. These historical coverage totals have not been
reclassified by the later sandbox run.

## Application assessment: unresolved leads

All four items remain **NEEDS VALIDATION**, without assigned severity. The
wording describes hypotheses supported by source traces, not observed exploits.
Detailed source evidence and bounded resolution plans are in
[NEEDS-VALIDATION.md](security/audit/run-1/NEEDS-VALIDATION.md).

| Lead | Potential boundary concern | Validation still required |
| --- | --- | --- |
| Shared activation allowance | Failed anonymous activation attempts may consume an account bucket shared by unrelated invitees | Disposable PostgreSQL and synthetic HTTP fixture demonstrating or refuting cross-invitee rejection, with clean-control and expiry recovery checks |
| Interrupted compressed uploads | An aborted compressed body may retain a shared upload slot | Node 24 request/decoder lifecycle fixture, including observation after the configured HTTP timeout and an independent dummy researcher's upload |
| PDF object-stream expansion | Expanded PDF buffers may exceed the effective worker memory budget and affect shared API resources | Small bounded PDF fixture establishing actual memory accounting, containment, termination, and any cross-principal consequence |
| Public-search materialization | Filtering may occur after full approved-catalogue materialization, increasing shared database work | Bounded synthetic PostgreSQL query plans and cancellation/resource-sharing checks; ordinary query cost alone is insufficient to confirm a vulnerability |

The current sandbox stages only `package.json`, `src/algorithm-result.js`, and
`test/algorithm-result.test.js`. It does not provision PostgreSQL, application
packages, document parsing, scanner, or object-store fixtures. Extending it for
these leads requires reviewed workloads, verified dependencies, appropriate
isolated service topology, and per-fixture resource limits. No application
source fix for these leads is claimed in this remediation.

## Documented changes

| Change | Implemented behavior and purpose | Repository evidence |
| --- | --- | --- |
| Immutable skill provenance | Records Cloudflare revision `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8`; all 20 installed files were compared with that upstream directory with no differences | [Registry](security/skills/registry.json), [update procedure](security/skills/README.md) |
| Per-file and folder integrity | Verifies the complete inventory, file hashes, installer-compatible folder hash, and source/path agreement with the existing skill lock; rejects missing, additional, changed, or unregistered skill content and symlinks | [Integrity checker](scripts/check-skills.js), [regression tests](test/skill-integrity.test.js) |
| Machine-readable capability policy | Declares intended filesystem, network, secret, process, platform, and review-state constraints; rejects unexpected metadata fields and policy values | [Registry](security/skills/registry.json), [checker](scripts/check-skills.js) |
| Instruction-reference admission | Inventories vendored companions through their hashes; the installed skill has no HTTP(S) references, and newly introduced references fail the check pending policy review | [Checker](scripts/check-skills.js), [skill policy](security/skills/README.md) |
| CI and change review | Runs skill verification and regression tests in the existing security gate; adds PR fields for upstream comparison, behavior review, and permission changes | [Security workflow](.github/workflows/security-gate.yml), [PR template](.github/pull_request_template.md) |
| Restricted Linux execution | Uses fresh non-root Docker containers with read-only source/toolchain, no external networking, dropped capabilities, sanitized target environment, scratch-only regular-file writes, and resource limits | [Launcher](scripts/audit-sandbox.py), [workflow](.github/workflows/audit-sandbox.yml) |
| Isolation gate | Runs eight negative probes before the approved workload; configuration or probe failure prevents workload execution; an unavailable engine produces a blocked result | [Probes](security/sandbox/probes.mjs), [launcher tests](security/sandbox/test_launcher.py) |
| Bounded execution receipts | Counts and discards target output, retains host-generated result metadata, uploads the receipt even on workflow failure, and preserves a successful receipt in the repository | [Saved receipt](security/sandbox/evidence/8ac44ea.json), [workflow](.github/workflows/audit-sandbox.yml) |
| Narrow scanner exception | Excludes one verified public upstream file digest from a Gitleaks false positive, scoped to the registry path and generic-key rule; does not exclude the whole registry | [Gitleaks configuration](.gitleaks.toml) |
| Assessment correction | Withdraws the supposed integrity mismatch: the original comparison used a single-file hash against a folder hash; installer-compatible recalculation matches the lockfile | [OWASP AST07 explanation](OWASP-AST10-REPORT.md#ast07--update-drift) |

The capability registry expresses admission policy; it is not itself OS
enforcement. Its general runtime-execution block remains in place. The Linux
harness supplies observed enforcement evidence only for its fixed workload and
configuration. No installed upstream skill content or application source was
changed by this remediation.

During CI verification, the process-count probe was adjusted to avoid exhausting
file descriptors first. Output-limit shutdown was also corrected to disconnect
the attach client before container termination, preventing shutdown from blocking
on a full output pipe. Both corrections are included in the passing harness.

## Verification evidence

| Check | Observed result | Evidence |
| --- | --- | --- |
| Skill integrity and policy checks | Passed; installed inventory and lock agree | CI admission steps; `node scripts/check-skills.js` |
| Skill regression tests | Passed; altered files, unregistered skills, symlinks, and broadened network policy are rejected | `node --test test/skill-integrity.test.js` |
| Launcher unit tests | Three passed: command policy, staged-source allowlist, and rejection of relaxed network configuration | `python3 -m unittest discover -s security/sandbox -p 'test_*.py'` |
| Linux isolation probes and approved workload | Eight probes plus workload passed; complete job took 30 seconds at recorded revision `8ac44ea6d199ba10a67e9770795b6318f30cf9f5` | [Run 42342595964](https://github.com/project-works-collab/umak-research-management/actions/runs/42342595964), [receipt](security/sandbox/evidence/8ac44ea.json) |
| Final branch sandbox validation | Passed again after evidence/documentation changes; job took 24 seconds | [Run 42342698109](https://github.com/project-works-collab/umak-research-management/actions/runs/42342698109) |
| Existing application security gate | Passed on final implementation branch, including its configured scans, tests, and backup/restore exercise | [Run 42342703353](https://github.com/project-works-collab/umak-research-management/actions/runs/42342703353) |
| Existing algorithm CI | Passed on final implementation branch | [Run 42342703347](https://github.com/project-works-collab/umak-research-management/actions/runs/42342703347) |

The eight probes cover filesystem/environment/egress boundaries, file-size,
scratch-disk capacity, process count, memory, CPU time, wall timeout, and output
overflow. The boundary probe also checks non-root execution, absent host/secret
mounts, dropped effective capabilities, and no-new-privileges.

The recorded configuration uses a digest-pinned Node image and commit-pinned
checkout/upload actions. Limits are 0.5 CPU, 2 CPU seconds, 256 MiB memory with
no additional swap, 64 tasks, 128 file descriptors, an 8 MiB file limit, 64 MiB
scratch space, and a 20-second normal wall deadline. Output exceeding 64 KiB
triggers termination; reading occurs in chunks, so the saved overflow probe
counts 73,728 bytes before termination. Raw output is not retained. The dedicated
wall-time probe uses a two-second deadline.

The existing security gate is a separate integration workflow. Its success does
not mean all its commands ran inside the new audit sandbox or that it reproduced
the four audit leads. The initial source audit's structured results and coverage
ledger have not been rerun or rewritten by these later CI checks.

## Current OWASP AST01–AST10 status

**SATISFIED** applies only to the stated control and scope. **PARTIAL** means
some controls have supporting evidence while others remain open. **UNVERIFIED**
means the necessary observations are unavailable. These are control statuses,
not vulnerability severities or an aggregate security score.

| Category | Current documented status | Remaining limitation |
| --- | --- | --- |
| AST01 — Malicious Skills | PARTIAL: upstream content pin, inventory, and integrity admission checks implemented | Independent behavioral approval and publisher authentication remain unverified; no malicious skill confirmed |
| AST02 — Supply Chain Compromise | PARTIAL: skill revision, runner image, and new workflow actions pinned | Broader execution dependencies and application supply-chain controls need their own scope and verification |
| AST03 — Over-Privileged Skills | PARTIAL overall; SATISFIED evidence for this harness's declared boundaries | Registry intent is not universal platform enforcement; arbitrary skill execution is not approved |
| AST04 — Insecure Metadata | PARTIAL: versioned registry and strict field/value checks implemented | Other platform loaders/parsers and metadata signatures are not verified |
| AST05 — Untrusted External Instructions | PARTIAL: local companions hashed and new HTTP(S) references rejected | This is not a semantic injection scanner or a guarantee about all platform-side fetching |
| AST06 — Weak Isolation | SATISFIED for the recorded harness/image/workload/run; UNVERIFIED for general agent execution | No claim of VM-level separation, container-escape resistance, or full application-fixture isolation |
| AST07 — Update Drift | SATISFIED for local inventory, content integrity, and immutable revision records | Reviewed update admission and required branch protections remain operational responsibilities |
| AST08 — Poor Scanning | PARTIAL: integrity/metadata checks, regression tests, and existing repository scanners | Dedicated behavioral/semantic scanning and comprehensive encoded/archive instruction coverage remain absent |
| AST09 — No Governance | PARTIAL: role ownership, review state, PR requirements, procedures, and CI receipts | Actual independent human approval, review expiry/revocation process, and independently protected agent logs remain incomplete or unverified |
| AST10 — Cross-Platform Reuse | PARTIAL for declared Codex scope; UNVERIFIED for reuse elsewhere | Equivalent controls across agent platforms have not been tested; not applicable to the Express/PostgreSQL runtime itself |

## Remaining work and closure criteria

| Priority | Work | Evidence needed to close it |
| --- | --- | --- |
| 1 | Validate the four application leads | Reviewed, isolated synthetic fixtures with source/dependency identity, bounded observations, and independent disposition of each lead; update findings and coverage only after verification |
| 2 | Expand sandbox workloads as needed | Explicit dependency and file allowlists, isolated disposable services, fixture-specific limits/timeouts, and passing negative probes before target execution |
| 3 | Add behavioral skill review/scanning | Reviewed coverage for dangerous tools, secret flows, external instructions, and relevant encoding/archive patterns; scanner versions and receipts; human review of privileged behavior |
| 4 | Complete governance and enforcement evidence | Named independent reviews, update/revocation records, required CI/branch protection verification, and a protected logging design appropriate to the threat model |
| 5 | Resolve deployment and mobile evidence gaps | Owner-observed database privileges, TLS/provider/scanner/storage/recovery configuration and Android device/application lifecycle tests identified by the original audit |

Repository maintainers own approval and merge policy; application maintainers
own lead-specific fixes and regression tests; runtime/platform owners own
sandbox deployment, protected logging, and infrastructure evidence. These are
responsibility roles, not assertions that a named person has approved a change.

## Reading and running the evidence

Start with this report for current overall status. Use the
[application audit](00-INTERIM-SECURITY-AUDIT.md) for source traces and hypotheses,
the [OWASP report](OWASP-AST10-REPORT.md) for the original control assessment,
and the [sandbox guide](security/sandbox/README.md) for execution details.
Statements in the historical reports that OWASP testing or a Linux runtime was
unavailable describe their original assessment stage; the current state is
summarized above.

Run **Actions → audit-sandbox → Run workflow** for the manually triggered
Linux checks. It runs deterministic probes and the approved unit-test workload,
not the full agent-led Cloudflare audit. On a Linux Docker engine, the equivalent
launcher command is:

```sh
python3 scripts/audit-sandbox.py --output /absolute/new/evidence-directory
```

The output path must not already exist. The runner prepares its pinned image
before target execution and returns a nonzero result if prerequisites or controls
fail. Review both the workflow conclusion and receipt; missing or failed evidence
must not be treated as a pass.
