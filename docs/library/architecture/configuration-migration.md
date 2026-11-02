# Configuration migration

`config migrate` previews a validated change set; `--write` applies it to a
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
constraints and standards may be removed locally; objectives, questions, ownership
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

Service identities also identify independently managed leases. Equal commands do not
prove that two authored services are interchangeable. Migration preserves distinct
service identities and their HTTP associations, even when their process arguments
match. Finite command deduplication must not collapse those separate lifecycles.

Inline lifecycle and verification commands are extracted with an explicit repository,
working directory, output policy, activity availability, operation category and network
policy supplied by the migration coordinator. Equal command text in different contexts
must remain distinct. The extractor never infers network access, output permissions or
activity availability from a command name. Generated operation IDs are bound to the full
normalized definition; a conflicting authored ID blocks migration. Preparation purposes
remain attached to references rather than duplicating the executable definition.

When distinct prerequisite IDs resolve to the same finite operation, retain its first
position once in the migrated prerequisite list. This applies to extracted probes too;
deduplication must not turn a valid dependency graph into a duplicate-reference schema
error. Canonical identity ordering uses code-point order and does not depend on the
machine's locale.

## Maintenance command boundary

The architecture library exposes migration planning and application through its
`migration.ts` public module. The CLI supplies the current directory and the explicit
write choice; it cannot supply replacement operation definitions or owner identities.
Migration validates the captured source catalog, constructs an isolated candidate and
validates the candidate catalog before source application. Preview reports the actual
configuration diff and diagnostics. Application requires an unchanged clean checkout,
uses checked content hashes, and never changes the source branch or staging index.
Neither command resumes retained hosts or upgrades captured authority in place.

Migrated test profiles retain the sole preparation/runner references used by the
testing service. Migration does not generate duplicate component operation usages
from those references or infer agent availability from them. This preserves useful
inherited test conventions for owners that have no suites yet, while test selection
and operation context are validated when the testing service is invoked.

The current command migrates a complete version-four component family and leaves an
already migrated family unchanged. Dependency-local finite lifecycle recipes migrate
when their repository has declared executable owners. Inherited verification commands
are anchored to each owner's repository before shared-operation deduplication. Setup
and output grants never transfer to a different repository. Mixed configuration families,
recipes without accountable owners, and output-only policy without a finite recipe
produce explicit diagnostics. Historical excluded files need an explicit owner or the
unambiguous implicit ownership of their own component definition before writable
migration can pass catalog validation. The command never guesses an ownership transfer
or treats similar command names as equivalent execution semantics.

### ArcNexus bootstrap ownership decision

The four immutable qualification records currently at the top of `docs` belong to
`architecture-maintenance`, alongside the central charter, development guidance and
historical retrospective. Remove their coverage exclusions and assign these exact files:
`experiment-qualification.json`, `guidance-qualification.json`,
`operations-qualification.json` and `workday-qualification.json`. Their bytes and
historical-reader interpretation remain unchanged. This resolves an explicit ownership
decision before migration; the generic migrator must continue to reject unowned evidence
instead of guessing an owner from a filename.

ArcNexus declares the Node test convention once on its platform, including owners
with no current suites. This is an explicit project policy simplification; the
generic migrator does not infer a missing policy. Empty owners remain absent from
automatic test selection until they have a declared suite. The retired execution
file is removed from maintenance ownership, and purpose text is not repeated as an
identical objective. These changes do not add engineering operations or grant
container write authority.

### New run configuration gate

New task and workday hosts require every captured component to use version five.
They reject an older component family with a `config migrate` diagnostic before
creating a host or dispatching an activation. There is no fallback to the retired
`architecture/execution` defaults file. Read-only historical inspection and migration
continue to read old declarations; neither path grants execution authority.

The read-only migration capture still validates executable profile requirements.
A historical profile containing removed time, turn, operation or corrective-attempt
budgets must be corrected explicitly before preview or write; migration cannot
silently retain those budgets in a candidate that normal execution would reject.

New task/workday startup validates the execution family together: version-five
components require environment schema 4, whose repository composition contains no
inline prerequisites or setup recipes. A legacy environment cannot opt a minimal
component into the old preparation adapter. Startup must reject this mixed family
before creating a host or invoking operations, and identify the environment migration
needed. Historical catalog inspection remains read-only and available.

## Standards and schema six

The final migration target is component schema six. Version-five `patterns` become
`standards`; referenced definitions move from `architecture/patterns` to
`architecture/standards` with matching exact ownership/read path updates. Identity,
artifact content and declared check identities are preserved. Conflicting destinations
and mixed authored families produce diagnostics. Already-v6 families are unchanged.

The v4 converter retains a minimal v5 intermediate for its existing recipe/policy
checks; the maintenance command applies the same final standards conversion before
validating or writing. No intermediate executable compatibility path is introduced.
Preview leaves source unchanged, write requires a clean checkout, and a second
successful invocation produces no changes. Historical evidence is never rewritten.
