# Evidence status — October 1, 2026

## Passed
- Tested implementation commit: `284455a1443ffe4788dae282b113709953007276`.
- Native macOS: Node 24.3.0 / PostgreSQL 18.3. Nine application test groups passed; isolated SQLi before/after, actual pre-commit rejection, and full six-table backup/restore comparison passed. See local-checks.txt and local-checks.json.
- GitHub Actions: [successful run 36835247039](https://github.com/a-a123456789/ias-pbl/actions/runs/36835247039). Gitleaks, Semgrep, dependency audit, model/risk validation, API tests, SQLi demonstration, hook demonstration and restore exercise all passed.
- Main branch protection API confirmed: two approving reviews, dismissal of stale approvals, last-push approval, required `security` check, strict up-to-date checks, admin enforcement, conversation resolution, linear history, no force push or deletion.
- Updated model: schema and eleven-threat/risk mapping checks pass. Both generated DFD review images were visually inspected. These are model-derived renderings, not Threat Dragon UI exports.

## Limitations and remaining checks
- GitHub rejected enabling native secret scanning/push protection: HTTP 422, “Secret scanning is not available for this repository.” Gitleaks CI and the local hook remain active; do not claim native push protection.
- Docker Compose was not run locally because Docker is unavailable. GitHub CI successfully used the same PostgreSQL 18.3 image with a disposable service container.
- Threat Dragon UI import/export remains pending after browser automation could not complete the local file import. Aaliyah must open both diagrams and export them from the app.
- Team review, independent setup, two reviewer approvals and final report/deck compilation remain pending. No real incident, NPC submission, production deployment, cloud firewall/TLS, production RPO/RTO, or backup erasure is asserted.
- The evidence/documentation PR adds records and model renderings; it does not change the tested backend. Its own GitHub checks must pass before merge.
