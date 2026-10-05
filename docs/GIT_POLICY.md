# Git security policy and integration exception

Normal changes use a feature branch and a pull request into private `main`. Require two genuine approvals, dismiss stale approvals after changes, and require approval of the most recent reviewable push. Authors do not approve their own work. Resolve review conversations; keep linear history. No force pushes or branch deletion. Enforce protection for administrators.

Required GitHub Actions contexts are `security` and `algocom`, with strict up-to-date checking and GitHub Actions as the check provider. Rulebooks: `.github/workflows/security-gate.yml`, `.github/workflows/algocom.yml`, `.gitleaks.toml`, `.semgrep.yml`, `.githooks/pre-commit` and `scripts/scan-secrets.js`. A local hook is bypassable, so CI is independently required. Native private-repository secret scanning/push protection is unavailable on the checked account; do not claim it is enabled.

## Authorized integration exception

The repository owner explicitly authorized merging the recovered IAS work and ALGOCOM implementation without waiting for reviewer approval. Only the necessary approval restriction is temporarily relaxed, after both check contexts pass on the exact integration head. All other protection remains. The operation restores normal review settings in a `finally` cleanup even if merging fails, then verifies protection and repository privacy. Both check contexts are already required; preserve them. The owner also authorized the submission-correction merge under the same temporary exception.

This is an owner-authorized integration exception, not peer review. The integration PR's completion record contains the before/after settings, tested head, merge SHA, final-main check links and restoration result. Teammates still independently verify their assigned work. Future PRs follow the normal policy above.
