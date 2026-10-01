# 60-second defense demo

Before recording: run `npm ci`, install hooks, run `npm run db:setup`, and confirm tests pass. Use a terminal without visible .env contents. Do not display session tokens or real credentials.

- 0–10s: Explain A-05 → TVA-04 → THREAT-04 → ACL-04 → SEC-04: committed credentials can expose the database.
- 10–30s: Run `npm run demo:secret`. It creates a disposable local Git repository and attempts a real commit containing a recognizable fake secret. The actual pre-commit hook blocks the commit; no push occurs.
- 30–45s: Show the rejected filename and PASS result. Explain that local hooks can be bypassed, so CI and required PR checks are also necessary.
- 45–60s: Show the actual passing GitHub security workflow and its Gitleaks step. If unavailable, say it is pending; do not substitute a screenshot of a proposed workflow.

Alternative/longer rehearsal: `npm run demo:sqli` prints the same payload, vulnerable synthetic response, patched empty response, and assertion result. HTTP 200 with no unauthorized data is expected for this patch.
