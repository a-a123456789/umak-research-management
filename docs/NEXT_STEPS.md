# Team next steps — IAS and ALGOCOM

Start with the corrected package in `submissions/` and the requirement/page map in `docs/COMPLETION_CHECKLIST.md`. Update your name, chosen task and evidence link in the shared Docs now. Source labs remain unchanged.

## 1. Independently verify your assigned work

| Member | Do this | Evidence to add |
|---|---|---|
| Gian | Follow README fresh setup; run `npm test`, `npm run demo:sqli`, `npm run demo:secret`; explain worker rejection | Command log with tested SHA, actual outcomes and any fix |
| Justin | Confirm architecture; run `npm run backup:verify` using PostgreSQL 18 client tools; open both model diagrams | Six-table restore results, diagram review and environment |
| John David | Test optional consent refusal and staff-reviewed deletion; review the proposed backup/key design and simulated NPC notice | Requests/responses and clearly stated privacy limits |
| Anjelo | Check both PDFs/decks, names/roles, repository access and protection; collect genuine acknowledgments | Review checklist; actual signatures outside Git; confirmed deadline/submitter |
| Aaliyah | Run model/risk validation and Python tests; explain DREAD/critical path; obtain valuation support or instructor decision | Calculation/model review and completed financial worksheet when evidence exists |

Shared algorithm check: `python3 -m unittest discover -s algocom -p 'test_*.py' -v`.
Model check: install `security/validation/requirements.txt` in a virtual environment, then run `python3 security/validation/validate_package.py` and `python3 scripts/validate-algorithm-contracts.py`.
Run only against synthetic disposable databases. After tests, rerun `npm run db:setup` before demonstrations because deletion tests remove seed records. Never include `.env`, passwords or tokens in evidence.

## 2. Submit genuine corrections through PRs

Pull `main`, create `team/your-name-review`, perform your check/fix, and save redacted evidence under `evidence/team/your-name/`. Commit and push, then open a PR describing what you actually did. Normal policy requires two real approvals and both security/algocom checks. No empty contribution commits or unreviewed approvals.

## 3. Resolve submission blockers

Aaliyah obtains real valuation evidence or an actual instructor decision using `FINANCIAL_EVIDENCE_WORKSHEET.md`. John David confirms institutional procedures/retention questions. Anjelo confirms the current deadline and designated submitter and gives the instructor authorized private-repository access if needed. Each person rehearses their course-specific role, signs only after review, and explains at least one control/algorithm example. These are not completed by automated tests.

## 4. Submit and keep the receipt

One designated member submits both separately named PDFs and the repository URL through the appropriate course portal. Each PDF already includes its 14-slide deck after references. Required filenames:
- `III-BCSAD_bolanatics_Milestone1_Proposal.pdf`
- `III-BCSAD_bolanatics_IAS_Capstone_Portfolio.pdf`

Internal deadline: [team to confirm]. Official deadline: [verify in TBL]. Designated submitter: [team to confirm]. Do not change repository visibility without separate authorization.

## Ready-to-send team note — not sent

Team, please update your task and name in the shared Docs now. Review the corrected IAS/ALGOCOM package, follow your checklist in docs/NEXT_STEPS.md, and add your actual test results or corrections through a PR. Check that your report section, slides, risks and diagrams agree. Complete your review by [internal deadline], flag missing information early, and rehearse your defense role. Financial evidence/instructor clarification and genuine acknowledgments still need our attention before submission.
