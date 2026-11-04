# Privacy behavior and production handoff

The local backend stores synthetic records only. A consent record contains authenticated user ID, known policy version, optional analytics/email choices, and server time. Repeating consent appends a new choice record; the latest record represents current preferences. No IP, user agent, real name, or client-supplied timestamp is collected. No analytics or email integration is active.

Core research processing requires a separately established legal basis and privacy notice; it is not forced into an optional consent checkbox. John David reviews this with the actual institutional policy before real use.

A student requests deletion with an empty JSON body. A staff member confirms review before completion. The transaction deletes that synthetic user and cascades research records, sessions, and consents; the request is retained with user ID removed. Minimal audit events retain action/time and a staff actor for accountability. This is classroom behavior, not a university records-retention authorization.

Production erasure design: DPO determines holds and retention before approval; remove eligible operational records; maintain a restricted deletion ledger separately from backups; expire backups according to an approved schedule; on every restore, replay erasures before allowing traffic. Audit retention must have a documented basis, duration, and access controls. These production controls are NOT implemented or validated here.

Soft deletion hides data but does not erase it. Hard deletion removes live rows but not old backups. Cryptographic shredding requires per-subject keys, verified destruction of every usable key copy, and backup/key recovery analysis. It remains proposed; this repository has no KMS implementation.


Consultation tickets store requester, service type, optional deadline, submission/claim
times, status, assigned staff and version. Students can list only their own tickets;
staff can access the processing queue. Requester deletion cascades ticket deletion;
removal of an assigned staff account clears its assignment reference. Existing
audit events retain the minimal action/time behavior described above. No freeform
consultation narrative is collected by these endpoints.
