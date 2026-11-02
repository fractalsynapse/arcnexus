# Configuration migration

`config migrate` will preview a validated change set; `--write` will apply it to a
clean checkout without committing or publishing. Historical reports and retained
run authority are not migration inputs to rewrite. The migration must stop with
specific diagnostics where ownership, contract associations or operation semantics
cannot be preserved unambiguously.

## Inherited policy reduction

After converting declarations, migration reduces repeated policy using the same
parent identities and package path contexts as catalog loading. Role, execution
profile and test profile may move to the nearest common containing component only
when every child receives the identical effective value. Existing explicit
container policies remain authoritative. An absent policy is not a default.

Read declarations are compared as repository identities and resolved paths, not
as equal-looking relative strings. Reduction cannot widen a child, cross repository
identity, or re-anchor a path at another package root. Identical required operation
usages may move to an ancestor only when every child already requires them. An
owner-specific usage cannot become mandatory for a sibling. Repeated inherited
constraints and patterns may be removed locally; objectives, questions, ownership
and public boundaries never move.

Reduction is deterministic, preserves declaration order where meaningful, leaves
input objects untouched and produces no further changes on a second invocation.
Acceptance compares resolved policies before and after reduction and exercises
nested packages, absent defaults, narrower reads and differing operation usages.
This reduction is one migration stage; it does not by itself authorize applying
an unvalidated migration or establish completion of the maintenance CLI.
