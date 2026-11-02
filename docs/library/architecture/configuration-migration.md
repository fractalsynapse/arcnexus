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

## Shared operation extraction

Operation migration compares complete normalized execution semantics, including
repository, working directory, argv, category, activity availability, prerequisites,
outputs, artifacts, service/HTTP settings and network policy. Different display IDs
or purpose text alone do not require a duplicate executable definition. The migration
retains an old-to-new identity map for every reference; command names alone never
establish equivalence. Inline probes become finite referenced command operations in
their original execution context. Dependency and HTTP-service references are resolved
before deduplication, with cycles and missing references reported before returning a
migration result. Obsolete execution timeouts require an explicit diagnostic.

Generated IDs are deterministic from captured command semantics. Reprocessing the
resulting shared definitions produces the same definitions and no further identity
changes. This extraction does not invent typed context substitutions from similar
owner names; any such substitution must additionally prove equal resolved arguments
and execution semantics for every affected owner.
