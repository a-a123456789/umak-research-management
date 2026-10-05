# Evidence status — 5 October 2026

- Integrated implementation: `655114e0f4edf16697b6d4a9ebc9979573af91e0`; actual local command/result logs in `integration/local-checks.*`. All listed checks passed: 19 Python tests, 11 backend groups at that commit, SQLi comparison, fake-secret rejection, six-table restore, static/secret checks and dependency audit.
- Public-search cap revision `46bee21` adds a twelfth backend test group; the complete 12-group suite passed locally. PR #3 merged this integration as `bbe0a73`; its commit-bound checks are linked in the correction evidence index.
- GitHub integration checks passed at 655114e: [security/algorithm runs](https://github.com/a-a123456789/umak-research-management/actions/runs/37184676703) and [companion run](https://github.com/a-a123456789/umak-research-management/actions/runs/37184676704). Each later commit has its own status; these earlier runs are not claimed as final-main verification.
- Model schema/math/mapping checks pass. Both diagrams opened in Threat Dragon 2.6.2; corrected rendered SVG exports are in `security/diagrams/` and portable PNGs in `submissions/figures/`.
- Actual 60-second terminal recording: `integration/secret-demo.cast`; offline replay: `integration/secret-demo.html`. This records a real fake-secret rejection command, not team-member narration.
- Both final PDFs and editable decks are in `submissions/`; references precede 14 appended slides in each PDF.

## Limits

Native GitHub secret scanning/push protection returned HTTP 422 unavailable for this private repository. Gitleaks hook/CI remain active. Local Docker Compose was not executed because Docker is unavailable; CI uses PostgreSQL 18.3 service containers and local tests used PostgreSQL 18.3. Production HTTPS, distributed admission/OS sandboxing, immutable offsite backup, approved retention/deletion replay and external logging remain proposed. No real incident, NPC submission, institutional appointment, peer approval or production loss valuation is asserted. Team understanding/review and TBL submission remain pending. See `docs/COMPLETION_CHECKLIST.md`.

## Submission correction status

Prior integration PR #3 merged as `bbe0a73`; both main checks passed and normal protection was restored. See https://github.com/a-a123456789/umak-research-management/pull/3 . The current correction adds full worker-output validation, schemas and report/deck coverage. See [correction PR #4](https://github.com/a-a123456789/umak-research-management/pull/4) and [correction evidence](corrections/README.md) for commit-specific checks and the merge/protection completion record; earlier checks do not validate later edits.
