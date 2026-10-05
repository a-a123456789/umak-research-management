# Team handoff

Update your name, task status, and evidence links in the shared Docs. The initial implementation is AI-assisted work prepared with Aaliyah; it is not evidence of each member's independent review.

| Member | Your concrete contribution | Evidence to add in your PR |
|---|---|---|
| Gian — Lead Engineer; Task I writer | Fresh install; run all tests and both demos; review queries, auth, hook and CI; correct Task I stack/storage claims | Commands/results, code fixes, CI link, review checklist |
| Justin — CIO; Task II writer | Run backup/restore; inspect local-only DB exposure; compare SQLi evidence and actual routes against Task II | Restore output, configuration screenshot, corrected attack-surface/PoC text |
| John David — DPO; Task III writer | Test optional consent refusal, identity spoof rejection, deletion review and session revocation; correct simulation language | API results, privacy review, corrected fictional incident notification |
| Anjelo — CEO; Task IV writer/compiler | Verify GitHub protections with two other reviewers; reconcile policy claims; compile six sections and 10–14-slide appendix | Settings screenshots, PR/check evidence, final PDF and slide references |
| Aaliyah — CISO; Tasks V–VI | Import/open model in Threat Dragon; inspect both diagrams; run risk validation; link actual tests to controls; review remaining risks | Model screenshots/exports, validation output, traceability corrections |

## Contribution steps
1. Accept the repository invitation using your own GitHub account (owner supplies invitations).
2. Clone the repository, follow README setup, and create `team/your-name-task` from main.
3. Make the assigned correction or add your own review/evidence in `evidence/team/your-name/`. Use synthetic data only; redact tokens and passwords.
4. Run relevant checks. Commit your own work, push your branch, and open a PR with commands/results and any unresolved issue.
5. Ask two other members to review. Reviewers must inspect the diff and evidence before approving. Merge only after required checks and approvals pass.

No minimum commit count is required by the supplied milestone. Meaningful work and reproducible evidence matter. Do not create empty commits or approve unreviewed work to simulate participation.

Internal deadline: confirm updated deadline in shared Docs. Submission date in supplied guide: October 3, 2026 (confirm in course portal).
Final filename: `III-BCSAD_bolanatics_IAS_Capstone_Portfolio.pdf`.
Repository: https://github.com/a-a123456789/umak-research-management

## Ready-to-send team note
Team, the CRM IAS implementation and review tasks are in the repository. Please update your task and name in the shared Docs, follow your checklist in docs/TEAM_HANDOFF.md, and add your actual test results or corrections through a pull request. Add your section's slides and evidence links to the shared document. Check that assets, controls, risks, and diagrams agree. Complete your work by [internal deadline] and flag missing information early.

GitHub native secret scanning/push protection was unavailable (HTTP 422). Report Gitleaks CI and local hook enforcement accurately. Main branch protection is enabled and requires two genuine reviewers.

Final reports and 14-slide editable decks are now in `submissions/`. Use `docs/COMPLETION_CHECKLIST.md` for the combined IAS/ALGOCOM handoff; the earlier task table remains a guide to independent review, not a claim that those members performed it.
