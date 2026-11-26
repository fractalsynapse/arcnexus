---
id: database-recovery
priority: 250
---

# Preserve one authoritative journal through deployment and restore

Prepare schemas through serialized, versioned migrations before dependent services accept work. Repeated setup recognizes applied versions; incompatible schemas and migration failures block dependent execution. Runtime credentials lack schema-changing privileges.

Preserve one authoritative project writer across processes and containers. Writer disconnection does not prove prior host effects stopped. Reconcile retained work and observe safe ownership before readmission. Cutover preserves event identities, approvals, checkpoints and unfinished positions.

Back up quiesced database and Host state under a common snapshot identity. Restore into an empty database and verify archive digest, migration series, retained command and referenced artifacts before restart. Keep credentials outside archives.

## Success measures

- Clean and repeated setup succeed; migration failure blocks dependent services.
- Competing commands admit one project writer.
- Lost writer connectivity cannot produce overlapping host effects.
- Matched restore resumes the same command, question, checkpoints and evidence.
