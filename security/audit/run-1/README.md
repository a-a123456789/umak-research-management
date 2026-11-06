# Security audit artifacts — run 1

The interim report is at the repository root: [00-INTERIM-SECURITY-AUDIT.md](../../../00-INTERIM-SECURITY-AUDIT.md).

- [Summary](SUMMARY.md)
- [Detailed validation leads](NEEDS-VALIDATION.md)
- [Confirmed findings detail](FINDINGS-DETAIL.md)
- [Structured findings](findings.json)
- [Coverage ledger](coverage-ledger.json)
- [Architecture and scope](architecture.md)
- [Reviewed state and metadata](run-metadata.json)

OWASP testing is pending, and the overall security assessment remains open. These artifacts record the completed source-review run. The historical metadata field `run_status: complete` describes that run’s workflow completion, not completion of OWASP testing or the overall assessment. Metadata, source hashes and preservation checks describe the original audited state, before these documentation files were added. Historical absolute paths in metadata identify the original audit environment. Ignored dependency sources are identified by hashes; they are not included here. Findings and coverage JSON are preserved byte-for-byte. Agent scratch files, prompts and orchestration scripts are excluded.

Validate the packaged records from the repository root:

```sh
node security/audit/run-1/validation/validate-findings.cjs security/audit/run-1/findings.json
node security/audit/run-1/validation/validate-coverage-ledger.cjs security/audit/run-1/coverage-ledger.json
```
