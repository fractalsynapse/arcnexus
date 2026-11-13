# Configuration documents

Pre-phase-three increment 1 delivered YAML configuration with legacy JSON support
under issue #63; historical execution evidence
remains JSON and is never migrated in place.

Components, roles, execution and composition profiles, environment declarations,
operations, assignments, workdays, bindings and experiments share one reader.
YAML documents contain only JSON-compatible values and string mapping keys.
Duplicate keys, aliases, custom tags, merge keys and multiple documents are errors.
Definitions with the same identity in YAML and JSON are ambiguous and rejected.
Schemas remain JSON Schema documents. Schema validation follows parsing.

Captured configuration includes its source path, original text, parsed value,
SHA-256 of original bytes and SHA-256 of deterministically normalized content.
Reading a captured Git revision must never consult mutable working-tree files.
Errors identify the source document and include parser locations when available.

## Ownership migration

Implementation, tests and documentation are grouped by component identity beneath
`src/`, `tests/` and `docs/`. Each maintained file has one accountable owner.
Foundation owns build standards, release owns delivery workflows, and the testing library owns shared test infrastructure; generated build output
does not grant authority over source. Cross-owner imports use declared public
entry points. TreeSeed is not reorganized by this migration.

Checked edits enforce captured ownership before maintained-source mutation.
Workers and managed operations receive source-read-only confinement; exact diff
checks remain an additional verification boundary. Platform/package containment is context,
not an implicit grant of write authority to every descendant.

## Current execution contract

Maintained tests/tooling use TypeScript, with formatting and 500-line files and
30-line functions enforced. Linting is available through declared operations.
Mandatory initialization and task proposals preserve captured authority; cancellation
and observable loop guards replace implicit execution limits.

Historical version-four ownership is defined in each component. See the
[version-four contract](component-contracts.md) for derived coverage, package roots,
patterns, contracts and discovered inventories. Versions 1–3 preserve their existing
interpretation. Empty version-three/four container permissions express containment,
not a deny-all ceiling. Container nodes cannot execute assignments.

## Minimal configuration migration (#109)

Minimal platform declarations are the single source for `director` (component
and profile), `reviewerProfile`, `defaultPackage`, and `verificationInputs`.
New execution rejects a simultaneous `architecture/execution` file. Director models
and reasoning come from the selected profile; absent configuration never selects a
hidden model or initializer. New execution requires schema six; historical version-five
catalogs remain readable and migratable. Shared-operation preparation feeds the
checked engineering workflow.

Environment schema 4 retains repository composition only. Operation schema 4 holds
fixed commands, prerequisite references, disposable outputs and artifacts once;
component usages capture owner-specific plans. See [workspace preparation](../workspace/workspaces.md)
and the [accepted migration plan](../../plans/minimal-component-configuration.md)
for current scope and the qualification gates still outstanding.

Trusted packaged result schemas may reference other packaged schema files by relative
path or a declared identity in that registry. The loader expands those references before validation and model configuration,
so shared result fields have one authored definition. References must resolve to
packaged registry entries; unregistered remote identities, cycles and external fragments are
rejected. Target-owned files cannot supply runtime response contracts.

Minimal public API inspection derives exported symbols and signatures with the
TypeScript compiler from captured source, including local re-exports and type-only
exports. `api` modules and schema artifacts must belong to the declaring owner.
Named exports must resolve; schema-to-code links require a named export. The catalog
retains artifact hashes and schema identities when present, without inventing versions
for ordinary modules. Missing local schema references fail validation; unsupported
external analysis remains explicitly unresolved. Candidate files never replace the
captured source used for this architectural view.

Captured compiler configuration supplies module aliases and output-to-source mapping
for public API analysis. Cross-owner imports must use a declared entry point and an
exposed symbol; a named API declaration does not expose the module's other exports.
Type-only imports and local re-exports participate in the derived relationship view.
Namespace access is checked against the symbols actually used; escaping or dynamic
namespace access cannot bypass a narrowed public surface. Import and consumer views
are generated from the captured source, never authored lists.

Effective policy evidence identifies the declarations contributing inherited reads,
constraints, standards and required operation usages, alongside scalar defaults.
Implicit readability of owned paths is reported separately from authored read policy.
Derived public catalogs may reuse an application-owned in-memory snapshot only when
the source revision, ownership, public declarations, file digests and analyzer version
match. Each caller receives an isolated copy; reuse cannot mutate active authority.

Task direction captures both the director component identity and its execution
profile from the platform declaration. Initial planning, reconsideration and final
goal assessment use that identity; the first engineering owner is not a substitute.
A declared platform director may assess a selected package outside its own package
under its captured read boundary. This exception applies only to read-only direction
with the declared director profile; it never makes that component an eligible
engineering recipient for the selected package. Workday stewardship retains each
steward's own identity and inherited engineering profile.

New execution requires component schema six. Historical v4/v5 definitions remain
available for inspection and explicit migration, not as alternate execution authority.
The [configuration migration](configuration-migration.md) upgrades supported families
without changing historical reports or a running supervisor's captured authority.

Inherited `standards` identities resolve definitions in `architecture/standards` and
capture owned documentation/examples at the architectural revision. Missing standards,
out-of-owner artifacts and checks outside the standard owner's declared operations
fail validation. References do not grant execution or write authority. Inspection
includes captured hashes; model context receives immutable artifact text. Historical
pattern snapshots retain their original names and interpretation.

### Model context and captured authority

Model-facing component context is a projection of the revision-bound catalog. It
retains identity, architectural intent, effective read/write boundaries, public API
symbols and schema links, cross-owner and unresolved relationships, and policy
provenance. Command definitions, file hashes, internal imports and duplicated
resolved operation plans stay in the immutable catalog and execution records;
they are not repeated in every component prompt. Verification references identify
captured host checks, and agent operation discovery remains host-controlled.
The projection does not replace any authority, selection or completion check.
Director, engineering and reviewer prompts use the same projection. No acceptance
criterion or evidence is truncated to fit transport limits.

Captured configuration source values remain the parsed authored data, paired with
their original text and hashes. Effective component resolution uses separate
objects. Inheritance, inventories and operation planning must never write derived
fields into retained authored values or make inherited policy appear leaf-authored.

Component test inspection/execution and npm's shared test entry discover the same
`.git/arcnexus/bindings.yaml` machine bindings as task/workday execution. Explicit
maintenance-command bindings take precedence. Linked worktrees use their canonical
Git common directory. The captured binding source and digest remain execution
evidence; npm's transient PATH does not replace an explicitly bound executable.
Confinement qualification exposes the same declared tool directories read-only as
the operation it qualifies, including runtimes installed outside system directories.

### Definition ownership across repository bindings

An executable definition belongs to its declaring catalog repository even when its
component implements a package in a bound dependency repository. The derived catalog
retains that definition's repository, path and captured hash. Its accountable owner
is still the component; the definition is not a phantom writable path in the dependency.
An activation's write scope remains confined to its captured implementation repository.
This does not grant dependency owners engineering eligibility in the primary package.

For minimal catalogs, ownership validation covers every locally bound captured
repository, not just the primary source. Every tracked maintained file must have one
owner in that repository. Unbound inventories remain explicitly unavailable. No extra
authored definition path or parallel ownership declaration is required.

## Engineering and assembled-delivery checks

Schema-six operation usages are `preflight`, `setup`, `refresh`, `verify`,
`delivery` and `agent`. Both `verify` and `delivery` accumulate through inheritance;
a leaf cannot remove an ancestor requirement. Delivery checks are finite operations
executed on the assembled head before publication, alongside accountable owners'
verification. They are not assignment baseline or regression choices.

A captured test profile supplies its `run` operation for owner verification. The host
refreshes owned suite selection using captured metadata and ownership, including new
suites. No leaf test recipe or inventory is needed. An owner with no suites records
`operation.not_applicable` for an implicit profile check; this is not a passing test.
An explicitly declared verification operation still fails if required selection is
empty. Agents cannot substitute another owner's test paths. Formatting proposals stay
available as checked edits. ArcNexus's owner format check intersects owned paths
with the same maintained-code coverage used by its full formatter; it does not add
new baseline requirements for documents outside that coverage. Full formatting,
lint, types, tests and architecture validation remain required at assembled delivery.

Retained runs continue using their captured supervisor and plans. Updating the source
policy changes new authority only, never active-run requirements or historical evidence.

Behavioral work requires component-owned documentation and regression locations.
The steward selects those files; assignment authors cannot grant or narrow ownership. Test-only characterization of
existing behavior uses the refactor workflow, with passing captured checks rather
than invented documentation edits or failing tests.

## Activity execution profiles (#277, activity model #394)

An activity states the execution profile its work runs under, next to its role, its
bound operations and its own direction. There is no separate `activityProfiles`
mapping: the selection lives inside `activities`, beside the position it belongs to.
Model settings remain authored only in the shared execution profiles, never inline.

Supported activity names are research, documentation, testing, implementation, review
and release. A key outside that set fails validation naming the valid activities, and
a declared activity missing any of its four fields is refused at load rather than
resolved by a fallback.

Whether an activity may inherit a profile from an ancestor instead of stating one is
open in #428. Under the current shape every declared activity must state the field, so
inheritance cannot be expressed and this document describes what is required.

The existing host workflow selects one primary activity per model turn. Planning
and coordination use the default; research and review use their matching overrides.
Specification uses documentation.
Implementation and correction use implementation, except documentation-only work
uses documentation. Other activities may occur within the same turn without changing
models midway. This mapping does not introduce a second workflow or change role
permissions. A release override has no effect until a release model turn exists;
the current publisher remains deterministic.

Assignments capture the effective profiles with their original authority. Each turn
records its selected profile and actual model settings, including continuation turns.
Existing captured assignments without overrides retain their default. Director and
independent verifier profiles remain separate from steward activity overrides.
ArcNexus uses Luna by default, Astra for research, and Sol for documentation and
steward review; independent verification remains Astra.
