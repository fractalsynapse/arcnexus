---
id: "database-recovery"
---

# Preserve one authoritative journal through deployment and restore

Prepare schemas through serialized, versioned migrations before dependent services accept work. Repeated setup recognizes applied versions; incompatible schemas or failed migrations prevent dependent execution. Runtime credentials lack schema-changing privileges.

Preserve one authoritative project writer across processes and containers. Writer disconnection does not establish that prior host effects have stopped. Reconcile retained work and observe safe ownership before readmission. Cutover preserves event identities, approvals, checkpoints and unfinished positions.

Back up quiesced database and Host state under a common snapshot identity. Restore to an empty database and verify archive digest, migration series, retained command and referenced artifacts before restarting services. Keep credentials outside archives.

## Observable success

- Clean and repeated setup succeed; migration failure blocks dependent services.
- Competing gateway commands admit one project writer.
- Lost writer connectivity cannot produce overlapping host effects.
- Matched restore resumes the same command, question, checkpoints and evidence.