# IAS implementation and operation

Updated 5 November 2026 (Asia/Manila). These changes are local workspace work, not a deployed university service or remote CI result. The original planning document is [here](plans/IAS_CIA_IMPLEMENTATION_PLAN.md).

## Implemented

* **Confidentiality:** PostgreSQL FORCE RLS on studies, membership, assignments, profiles, feedback, internal notes, document metadata, consultation tickets, consent and deletion requests. Transaction-local identity follows the authenticated opaque session across pooled connections. Student and faculty researchers have scoped access; CRM staff access private studies only when assigned. Explicitly Approved catalogue metadata remains public, including its abstract; approval must therefore mean permission to publish those catalogue fields. Manuscripts stay private.
* **Feedback:** researcher-visible feedback and internal staff notes have separate tables and policies. Researcher response projections never contain the internal column. Study owners can add/remove researcher members; reviewer assignment is an operator-controlled operation, with no staff self-assignment endpoint.
* **Credentials:** asynchronous Argon2id (19 MiB, t=2, p=1), random salts, bounded expensive-operation concurrency, exact legacy scrypt verification and upgrade on successful login. Opaque bearer tokens expire after 15 minutes and revoke on logout/deletion. No JWT migration or persistent refresh flow was introduced. Staff can issue single-use 15-minute activation tokens; only their SHA-256 digest is stored. High-entropy activation tokens use token hashing; the chosen human password uses Argon2id.
* **Integrity:** strict Zod contracts, parameterized SQL, database-triggered transactional `audit_history` with actor, target, old/new metadata, timestamp, request ID and IP. Runtime cannot insert/update/delete history. Passwords, manuscript abstracts, feedback content, internal note contents and object keys are excluded from audit payloads. Existing `audit_logs` are retained as legacy events. Database owners remain able to alter history; cryptographic chains/external immutable audit checkpoints are not implemented or claimed.
* **Documents:** bounded raw uploads (25,000,000 bytes), two active uploads per API process, isolated parser workers with heap/time limits, PDF parsing, bounded DOCX ZIP/XML inspection, fail-closed ClamAV scanning, fresh object keys, SHA-256 integrity metadata, private S3 adapter and authorized 600-second GET URLs. Nothing is placed in cloud storage until validation and scanning pass. Upload failure cleans its object when possible; an orphan-cleanup failure produces an operator log. The deployment must monitor that log. Per-worker concurrency plus shared upload token buckets bounds admission; a fleet-wide scanner concurrency lease is not implemented.
* **Availability:** PostgreSQL-backed atomic token buckets and a separate rolling five-failed-attempts/15-minute account/IP limiter shared across API instances. In-flight login reservations count conservatively; successful attempts remove their own reservations. Unknown-user passwords take the expensive dummy verification path. Dependency failures are sanitized; failures of the limiter store return controlled 503 responses. Health is a lightweight process liveness probe, not a database readiness guarantee.
* **Recovery:** encrypted AES-256-GCM database/object snapshot archives, a separate offsite destination, freshness checker, quarantined restore drill, object-deletion queue, independent encrypted deletion-event export/replay and Linux systemd deployment units. The dump and document inventory use one exported PostgreSQL snapshot. Restores verify archived object checksums; they do not publish recovered objects automatically. Deletion events use immutable UUID subject references. Export runs on a proposed five-minute timer, so an unexported deletion can be absent after a disaster; restore quarantine and operator reconciliation remain required.
* **Android library:** Room public-information cache, app-private template files, checksum validation, atomic cache publication, WorkManager refresh, Android Keystore AES-256-GCM session vault and instrumentation tests. No deprecated EncryptedSharedPreferences dependency. The repository has no complete Android application; this library needs integration into its screens/sign-in flow. Public catalogue/form contents are explicitly synthetic placeholders.

## Run and migration

Use Node 24 and PostgreSQL 18. Install with `npm ci --ignore-scripts`. On an existing installation, run `npm run db:migrate` using the privileged migration identity, then restart the API. New synthetic installations use the README setup sequence. Migration functions require a trusted owner that bypasses FORCE RLS (the tested setup/restore owner is PostgreSQL superuser `postgres`); never run the API with that identity. The migration identity owns protected functions with fixed search paths and restricted EXECUTE grants.

Migrations preserve existing author IDs and backfill ownership membership. They **do not** assign every existing staff member to every study. Provision reviewer mappings through the privileged operator connection using parameterized `INSERT INTO review_assignments(study_id,staff_id) VALUES($1,$2)` after verifying that the target account is CRM staff. `db:setup` adds explicit reviewer assignments only for its three synthetic studies, refreshes demo password hashes, and clears synthetic throttling counters; it is not a production migration command.

New routes:

| Route | Access / body |
| --- | --- |
| GET/PATCH `/api/v1/users/me` | Own profile; PATCH accepts email only |
| PATCH `/api/v1/research/:id` | Research member; title and optional abstract/year/department |
| POST `/api/v1/research/:id/members` | Owner; `{user_id}` for a student/faculty account |
| DELETE `/api/v1/research/:id/members/:memberId` | Owner; cannot remove self |
| GET `/api/v1/research/:id/feedback` | Member or assigned staff; researcher projection omits notes |
| PUT `/api/v1/research/:id/feedback` | Assigned staff; both `researcher_visible_feedback` and `internal_staff_notes` |
| POST `/api/v1/research/:studyId/documents?filename=study.pdf` | Member researcher; `Content-Type: application/octet-stream`, raw file bytes |
| GET `/api/v1/research/:studyId/documents/:documentId/url` | Member or assigned staff; temporary private URL |
| POST `/api/v1/admin/invitations` | Staff; `{email,role:"student"\|"faculty"}`; returns activation token once |
| POST `/api/v1/auth/activate` | `{token,password}`; password 12–128 characters; no automatic sign-in |
| GET `/api/v1/admin/audit-history` | Staff, last 100 metadata events |
| GET `/api/v1/public/content` | Synthetic published directory/requirements/instructions/template manifest, ETag |
| GET `/api/v1/public/templates/research-request.txt` | Blank synthetic form; never contains applicant data |

Role/ownership scope is enforced again in the database. The public search function exposes only approved catalogue columns through a narrowly granted function. Server-controlled transaction context is defense against omitted predicates, not protection against a fully compromised server or stolen privileged DB credential.

## Switch on deployment controls

1. Configure a private manuscript bucket with `ops/private-storage.yaml`; attach its least-privilege managed policy to the API workload identity. Use `S3_BUCKET`, `AWS_REGION` and the standard AWS credential chain. Prefer workload credentials over embedded keys. The S3 adapter supports an HTTPS custom endpoint for R2, but R2 requires its own provider policy, checksum/encryption and signed-URL verification; it was not deployed here.
2. Start ClamAV with StreamMaxLength at least 25,000,000 bytes and a scan timeout compatible with the API's 30-second scanner deadline. Set `CLAMAV_HOST`/`CLAMAV_PORT`. Without storage or scanner configuration uploads return 503. Place upload/scan services within the same protected trust boundary; the implemented ClamAV TCP protocol is not itself encrypted/authenticated. Production segmentation or a mutually authenticated transport wrapper is a deployment requirement.
3. Supply `TLS_CERT_FILE`, `TLS_KEY_FILE`, `DB_TLS_CA_FILE` and `NODE_ENV=production`. API ingress and runtime DB connections require TLS 1.3 and certificate verification. Configure database volume AES-256 encryption in the hosting platform; this source tree cannot encrypt a running cloud database volume. Verify actual protocols and encryption metadata after deployment. No `trust proxy` is enabled: the current limit/IP behavior uses the direct peer. A reverse-proxy deployment needs a narrowly scoped trust configuration and spoofing tests before launch.
4. Deploy `ops/offsite-storage.yaml` in a separate recovery account/region with independently governed permissions. API credentials must have no recovery access. Backup jobs need source DB/document read access plus destination write access; restore jobs need independent read credentials. The supplied policies are attachment templates, not automatic cross-account role assumption. Create the cross-account trust/grants explicitly. Keep `BACKUP_KEY_FILE` (0600, 64 hex characters from 32 CSPRNG bytes) outside backups and maintain separately governed recovery copies. AES encryption with a lost key is unrecoverable.
5. Install systemd units from `ops/` only on the intended Linux deployment. Create `/etc/crm/backup.env` (0600), `/var/lib/crm-backup` and service identity `crm-backup`; adapt `/opt/crm` and Node binary paths. Backup timer: daily 02:00 Asia/Manila; restore timer: monthly day 1 at 03:00; deletion export: every five minutes. Units are supplied **but not installed/enabled on this Mac**. Alert unit writes an operator journal/syslog event; connect the deployment monitoring system to failed units and run `backup:freshness` hourly. No external notifications were sent.
6. Approve retention for logs, old S3 object versions, backups and deletion ledgers before adding lifecycle expiry/Object Lock. Versioning is enabled by templates; no immutable-retention or permanent-erasure claim is made. S3 DeleteObject creates a delete marker in a versioned bucket; old versions require that approved lifecycle/sanitization procedure. Independent deletion events must outlive recoverable backups. Quarantined drills never reopen public service automatically.

Scripts: `npm run backup:offsite`, `npm run backup:restore:encrypted`, `npm run backup:freshness`, and `npm run privacy:maintain`. `BACKUP_STATUS_FILE` records the last successful upload; freshness fails on missing/stale/non-offsite evidence. For a synthetic local exercise only, use `BACKUP_LOCAL_DIR` and restore with `BACKUP_ARCHIVE_FILE`. These modes are not offsite evidence. Backup/maintenance administrative connections and pg_dump must be configured with verified production TLS through the supplied environment/connection settings; the local evidence uses isolated loopback/socket connections.

## Tests, calibration and demo

```sh
npm run db:setup                 # Disposable synthetic database only
npm test
npm run demo:ias
npm run backup:verify
ALLOW_BENCHMARK=yes npm run bench:ias
```

`test:ias:unit` needs no database. `test:ias:db` requires a seeded disposable DB. Tests intentionally delete synthetic users/studies. Benchmark defaults: five warmups, 30 samples, 1k/10k studies; `IAS_BENCH_SIZES=1000,10000,100000` enables the largest case. The runner measures current crypto, owner-query costs and audited mutations. It does not implement the complete randomized multi-seed/concurrent HTTP protocol in the original plan; its output states that limit explicitly.

Current results and remaining checks: [implementation evidence](../evidence/ias-plan/IMPLEMENTATION.md). The demo prints only access outcomes and column-visibility checks, never passwords, bearer tokens or signed URLs. Existing submission PDFs/slides/threat models describe earlier snapshots and were not regenerated; use this implementation report for current control claims.
