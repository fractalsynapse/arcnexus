# Coordination sessions

The [contract](contract.md) requires one project writer across foreground
refinement, phase assessment and sequential task delivery. The implementation
uses the existing SQLite runs and events. A child session has its own task
identity and retained journal, while its ancestor retains the foreground lane.
Only one child of a session can be active. A session cannot finish before its
child, and closing a child leaves the shared connection and ancestor intact.

Recovery retains the interrupted stack's observations and records its departed
writers before admitting a replacement. Independent invocations cannot borrow a
live writer. Standalone tasks continue through the same admission path.

This is the intended #628 foundation for Architect prerequisites and refinement;
production composition and live evidence remain part of #615 acceptance.

## Journal provenance for child admission

The intended `architect-child-provenance` contribution addresses the
[retained Execution supplier finding][supplier-finding] from
`architect-child-admission`. Execution must establish that a supplied parent
Journal belongs to its trusted Coordination service and the captured
`source.remote` before calling `Journal.child`. This extends the public use of
the shared writer delivered in [#630](https://github.com/fractalsynapse/arcnexus/pull/630)
under the existing contract's **Obligations** and **CO-21**; it introduces no
additional writer or admission mechanism. This section records intent before
implementation; it does not establish that the capability is available.

Coordination will expose a typed public
`owns(journal: Journal, remote: string): boolean` capability. It returns true
only for a Journal issued by that exact Coordination instance for that exact
project remote and its associated store connection. Legitimate descendants
issued through `Journal.child` inherit that provenance. A different Coordination
instance is foreign even when configured with the same storage directory.
A different store or project remote cannot match.

Provenance comes from trusted runtime identity retained by Coordination when
issuing the Journal. Public Journal fields, constructor arguments, a matching
prototype, copied properties, journal observations and candidate-authored
metadata cannot establish it. Manually constructed or forged Journals and
mismatched remotes return false. The check does not admit a session, write an
event, release a writer or create another store. It establishes origin only:
`Journal.child` still enforces the live parent and sequential admission rules.
Execution must refuse a failed provenance check before attempting child
admission or recording task admission.

The existing journal remains authoritative for task position, answers, edit
receipts, failed observations and publication evidence. Provenance is an
in-process association, not a new durable fact or a derived report that can
authorize admission. On restart, normal Coordination admission issues a new
Journal and establishes its runtime provenance; retained observations never
authenticate an old or reconstructed object. **CO-15**, **CO-16** and **CO-22**
continue to govern interruption evidence and recovery.

Acceptance requires observed-red public regressions followed by passing owner
evidence for a matching root and child, a forged Journal, a foreign instance
using the same storage, a foreign store and a mismatched remote (**ACP-1** and
**ACP-2**). Existing child-session and restart evidence must continue to cover
sequential admission, parent writer retention and competing-writer refusal
(**ACP-3**). Locked contracts, registry and active declarations remain unchanged.

[supplier-finding]: /home/adrian/.local/state/arcnexus-planner-594.wr9OzP/state/arcnexus/8b40ccad5a575a6294e2358bad463bbffd81c5c2af4eac5f7c63f83a41af3f4c/evidence/186ce4769afd57c077fa0683aabae7d074d607f279fd80f3cafb827059cbee87/56-15-codex.jsonl
