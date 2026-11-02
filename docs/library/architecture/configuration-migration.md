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

## Component declaration conversion

Component conversion keeps stable identity and architectural intent, maps exact
ownership to `owns`, and converts intentional public modules and schema contracts
to `api`. It preserves contract compatibility promises as constraints. It removes
only the executable owner's own definition from explicit ownership, because that
ownership is implicit in v5. A broader ownership root covering that definition
requires an explicit diagnostic rather than silently shrinking future authority.

Executable recipes must be resolved into shared operation usages before component
conversion can discard inline commands. Classification exceptions and historical
excluded-file ownership must likewise be resolved by the migration coordinator.
Unresolved recipe, classification, contract or ownership choices prevent a writable
migration. Container definitions never gain descendant ownership. The converter
validates both the old declaration and the generated v5 declaration and leaves
its input unchanged; already-v5 declarations remain unchanged.
