# IAS security calibration

Sequential owner-access query calibration and standalone crypto only. Method blocks are not randomized and no seeded multi-role corpus or HTTP load is measured. Event-loop/memory observations are instrumented process samples. No audit chain, cloud or Android performance claim.

| Method | Size | p50 ms | p95 ms | p99 ms |
| --- | ---: | ---: | ---: | ---: |
| legacy_sync_scrypt_verify | 1 | 18.190 | 18.695 | 19.384 |
| async_argon2id_verify | 1 | 6.329 | 8.555 | 9.031 |
| async_argon2id_hash | 1 | 6.506 | 6.767 | 6.789 |
| app_predicate_owner_admin_baseline | 1000 | 0.255 | 0.377 | 0.443 |
| app_predicate_plus_real_rls_owner | 1000 | 0.522 | 0.615 | 0.702 |
| audited_research_update | 1000 | 0.336 | 0.446 | 0.561 |
| app_predicate_owner_admin_baseline | 10000 | 1.093 | 1.204 | 1.272 |
| app_predicate_plus_real_rls_owner | 10000 | 1.780 | 1.899 | 1.902 |
| audited_research_update | 10000 | 0.322 | 0.372 | 0.378 |

Audit update timings include the business UPDATE, RLS, transaction context and trigger; they are not isolated audit overhead. Lower crypto latency is not a security-strength comparison.
