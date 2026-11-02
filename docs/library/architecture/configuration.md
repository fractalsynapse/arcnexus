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
are implemented while full engineering execution remains gated.

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
