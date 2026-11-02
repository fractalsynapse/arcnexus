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

Exact changed-path checks remain authoritative even where root instruction files
require broader directory sandbox grants. Platform/package containment is context,
not an implicit grant of write authority to every descendant.

## Current execution contract

Maintained tests/tooling use TypeScript, with formatting and 500-line files and
30-line functions enforced. Linting is available through declared operations.
Mandatory initialization and task proposals preserve captured authority; cancellation
and observable loop guards replace implicit execution limits.

Version-four ownership is defined in each component. See the
[version-four contract](component-contracts-v4.md) for derived coverage, package roots,
patterns, contracts and discovered inventories. Versions 1–3 preserve their existing
interpretation. Empty version-three/four container permissions express containment,
not a deny-all ceiling. Container nodes cannot execute assignments.

## Minimal configuration migration (#109)

Version-five platform declarations are the single source for `director` (component
and profile), `reviewerProfile`, `defaultPackage`, and `verificationInputs`.
New execution rejects a simultaneous `architecture/execution` file. Director models
and reasoning come from the selected profile; absent configuration never selects a
hidden model or initializer. Version-five catalogs and shared-operation preparation
feed the checked engineering workflow.

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
constraints, patterns and required operation usages, alongside scalar defaults.
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

Minimal research, review and change assignments may execute after confinement
qualification. The [first real checked-engineering task](../assignment/checked-engineering-qualification.md)
completed with independent verification. The remaining migration and live gates are
still open. Legacy executable configurations remain supported during this staged
migration; retiring them is unfinished. Historical reports remain read-only evidence.

Inherited v5 pattern identities resolve to captured standards and example artifacts
using the same revision-bound reference loader as historical definitions. Missing
patterns or out-of-owner artifacts fail validation. Referenced checks must belong
to the pattern owner’s declared operation usages; the reference itself grants no
additional execution or write authority. Inspection includes the captured hashes,
and steward context receives the immutable artifact text.

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
