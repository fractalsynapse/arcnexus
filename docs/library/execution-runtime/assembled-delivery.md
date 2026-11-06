# Assembled dependent deliveries

Implementation intent for #312; not yet shipped.

The host must allow a test contribution and its dependent implementation to reach
verification together. Owners continue to write only their component files on
separate development branches. Prepared source and observed failing checks remain
unverified until the assembled candidate passes the canonical acceptance path.

The implementation batch will:

1. Derive related contribution groups from current same-run engineering requests,
   excluding retired/replaced work. Retain explicit prepared state and atomic group
   completion in coordination-store; keep external dependencies verified.
2. Separate engineering contribution readiness from delivery acceptance in the
   existing assignment workflow. Preserve expected-red and owner-check evidence;
   group readiness must not claim green tests or release authority.
3. Reconcile prepared owner snapshots with the current verified candidate through
   existing candidate handling. Preserve both versions on conflict and journal
   preparation before filesystem changes.
4. Reuse captured host operations and independent verification for the complete
   assembly. Bind acceptance to every contributing owner and exact source revision.
   Promote all related receipts and the candidate in one durable transition.
5. Route deficiencies through existing assignments and normal director escalation.
   Qualify the observed report/test deadlock, cancellation, recovery, conflicts,
   unchanged authority and duplicate completion through production wiring.

Focused checks cover contribution grouping and transaction failure first; integrated
and native suites follow the coherent batch. The real paused task then exercises
the same path. No scripted success counts toward the three clean cycles.

Shared verification responsibility: assignment exposes its captured-acceptance checker
through the existing steward API. The publisher's existing delivery checker uses
that same checker for each assembled contribution, retaining the original executable
authority and the verified candidate's test baseline. Runtime composition does not
grant workers broader write authority. The existing publisher accepts joint
contribution attribution and advances one combined PR; it must not independently
publish a red constituent merely because the combined delivery passed.
