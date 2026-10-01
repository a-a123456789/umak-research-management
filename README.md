# CRM IAS security implementation

A small Express/PostgreSQL CRM backend for the III-BCSAD bolanatics IAS milestone. This is a synthetic-data teaching implementation, not the complete university platform or a production deployment.

Repository: https://github.com/a-a123456789/ias-pbl

## Start locally
Requires Node 24, npm, Docker Compose (or an existing PostgreSQL 18 instance), and PostgreSQL 18 client tools for the backup exercise.

```sh
npm ci --ignore-scripts
node scripts/init-env.js
docker compose up -d --wait
npm run db:setup
npm run hooks:install
npm start
```

For an existing PostgreSQL instance, create an empty `crm_ias` database and update the ignored `.env` URLs before `db:setup`. The setup identity needs permission to create a login role and schema tables. The running API uses the separate non-owner `crm_app` identity. Never use a production database: tests intentionally delete synthetic records. Setup is opt-in through `ALLOW_SYNTHETIC_SETUP=yes`.

The API listens on http://127.0.0.1:3000. Synthetic accounts: `student1@example.test`, `student2@example.test`, and `staff@example.test`. Their shared local-only random password is in `.env` under `DEMO_PASSWORD`. Do not publish that file or include it in screenshots.

## Run the evidence checks
```sh
npm run db:setup
npm test
npm run db:setup
npm run demo:sqli
npm run demo:secret
npm run backup:verify
python3 -m pip install -r security/validation/requirements.txt
python3 security/validation/validate_package.py
npm run check:static
```

Tests are sequential and exercise a disposable synthetic database. `db:setup` recreates deleted seed users/records; it does not reset all evidence/history. SQLi demonstration uses a separate temporary schema with fake data and cleans it up. Normal startup never imports the vulnerable code.

CI also runs Gitleaks, Semgrep, npm audit, and model/risk validation. See `evidence/STATUS.md` for what has actually run and what remains pending. Local PostgreSQL 18 and Compose/CI execution are distinct evidence claims.

## API contracts
All nonpublic endpoints require `Authorization: Bearer <token>`.

| Method / route | Input and access |
|---|---|
| GET /health | Public health response |
| POST /api/v1/auth/login | `email`, `password`; returns one-hour opaque bearer token |
| POST /api/v1/auth/logout | Authenticated; revokes current token |
| POST /api/v1/research/search | Public; `keyword` string; approved records only |
| GET /api/v1/research/:id | Record owner or staff; other records return 404 |
| POST /api/v1/research | Authenticated; `title`, optional `abstract`; own Draft record |
| POST /api/v1/users/consent | `policy_version: "2026-10-v1"`, `choices: {institutional_analytics: false, email_notifications: false}` |
| POST /api/v1/users/deletion-requests | Student; empty object; requests staff review |
| POST /api/v1/admin/deletion-requests/:id/complete | Staff; `confirm_review: true`; synthetic hard deletion |
| GET /api/v1/admin/audit-logs | Staff only; last 100 minimal audit events |

No frontend, uploads, service-ticket workflow, SSO, Redis, cloud deployment or Turnitin integration is claimed.

## Team and submission
Read [team handoff](docs/TEAM_HANDOFF.md), [report corrections](docs/REPORT_CORRECTIONS.md), [privacy behavior](docs/PRIVACY.md), [controls](docs/CONTROLS.md), and [demo instructions](docs/DEMO.md).

Original C-suite roles and writing assignments remain unchanged. Teammates must personally perform their assigned reviews and use their own PRs; initial AI-assisted implementation is not their contribution evidence.

Threat models, financial assumptions and risk data are under `security/`. Threat Dragon UI opening/export remains a separate acceptance check from schema validation. Costs and residual risks remain estimates.

Final portfolio: `III-BCSAD_bolanatics_IAS_Capstone_Portfolio.pdf`, including six sections, citations, cross-traceability, AI disclosure and appended 10–14-slide deck. The repository does not replace that PDF.

## AI disclosure
ChatGPT/Codex assisted backend and schema drafting, security tests, isolated demonstrations, CI configuration, document comparison, risk/model integration, and handoff instructions. Actual executed checks are recorded in evidence; team review, institutional verification and final approval remain separate responsibilities.
