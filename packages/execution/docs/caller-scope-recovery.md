# Canonical caller scope after staging recovery

The `recovered-caller-knowledge-correction` milestone addresses
`recovery-history-preserved` and `recovery-current-capture`. The independent
finding in `129-3-independent-caller-scope-recovery.md` showed that actual MCP
questions and the public `HostTask.inboxScope` accessor diverged after staging
moved. The original observations, secured edits and exact answers remain history.

## Correction and simplification ledger

Execution changes only `HostTask.inboxScope` and its import in
[src/index.ts](../src/index.ts): pass the existing `callerRevision` into the
existing `inboxIdentity`. This makes hold-context answers, unanswered gates,
research and retained supplier diagnostics select the actual caller's journal
scope. No consumer-specific fallback, namespace, state store or observation
migration is needed. Current captured ownership and operations remain enforced.

Host decisions still call `inboxIdentity` directly with their exact admission
and proposal binding. Independent review still uses the canonical policy's
current-capture branch, including candidate, owner evidence and acceptance.
Neither approval nor independent review is carried forward as ordinary knowledge.

## Retained behavioral evidence

Completed Testing's `129-392-owner-tests.log` records five intended failures:
public scope mismatch and missing recovered answers, gates, research and supplier
diagnostics. Its host-approval and independent-review characterization passes.
The [public consumer regressions](../tests/integration/caller-scope-recovery.test.ts)
exercise real Git, SQLite admission/reopening and executable-provider LocalMcp;
complete answers and report artifacts are compared through their consumers.
The [authority characterization](../tests/integration/caller-authority-recovery.test.ts)
keeps exact host decisions and independent-review identity separate.

The host retains the checked-edit receipt, candidate diff, Execution attribution,
failed observations and subsequent verification observations outside source.
Controlled final verification and delivery in these fixtures do not establish
live inference, hosted CI, an independent verdict or a staging merge. Native
cases skipped by the owner runner remain outside this correction's proof.
