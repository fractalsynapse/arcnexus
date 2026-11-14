# Audit: `arcnexus` (platform)

Phase 3, component 1. Audited against the **locked contracts** (`arcnexus/project` rev 3,
`arcnexus/architecture-model`, `arcnexus/foundation`), per the architect's direction that the contracts
govern and documentation does not. Evidence read at the merged staging head `2593354`; every claim names
the file it came from.

## What the component declares

`.arc/architecture/components/arcnexus.yaml` — the only `type: platform` document in the catalog.

| field                              | value                                                                                                                                                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| purpose                            | Enable architecture-directed self-development                                                                                                                                                         |
| objectives                         | Produce independently verifiable bounded work                                                                                                                                                         |
| constraints                        | human authority final; candidates cannot redefine active acceptance; native agent commits and upstream mutations forbidden; director selects from eligible stewards; dependency requests may activate |
| `executionProfile` / `testProfile` | `luna` / `node`                                                                                                                                                                                       |
| `director`                         | `{ component: task-intake, profile: sol }`                                                                                                                                                            |
| `reviewerProfile`                  | `sol`                                                                                                                                                                                                 |
| `defaultPackage`                   | `cli-package`                                                                                                                                                                                         |
| `reads`                            | `.`                                                                                                                                                                                                   |
| `standards`                        | `readable-typescript`                                                                                                                                                                                 |
| `verificationInputs`               | package/lock, `scripts`, `tests`, `.arc/architecture/test-profiles`, the five `tsconfig*`, `eslint.config.ts`                                                                                         |
| `activities`                       | six: research, documentation, testing, implementation, review, release — each with `role`, `profile`, `operations`, `instructions`                                                                    |
| `operations`                       | 16 usages across `delivery`, `agent`, `verify`, `preflight`, `setup`                                                                                                                                  |

Its package, `.arc/architecture/components/cli-package.yaml`, declares `parentId: arcnexus`,
`repository: arcnexus`, one `classification` (`docs/acceptance` as documentation), an **empty** `activities`
map, and no `owns` — matching the schema, where neither container branch may declare ownership.

## Ownership reality, which the audit must not blur

The platform owns **only its own definition file**. Containers cannot declare `owns`
(`src/library/architecture/schemas/component.json`: the `platform` branch has no `owns` property;
`component-materialization-policy.ts` rejects authored ownership on `platform`/`package`), and
`component-materialization.ts` adds the definition path implicitly. So there is no file-scoped
"platform implementation" to inventory: the behaviour that makes a platform a platform lives in paths
owned by **other** components. Everything below is therefore audited as _concept implementation_, and the
owning component is named for each file. The gap between "one accountable owner per concern" and "this
concern has no owner" is itself a finding (see Gaps).

## File inventory — what each file does

### Source (owner: `architecture`)

| file                                                           | lines     | role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/library/architecture/platform-execution.ts`               | 59        | The whole platform contract as code. `defaults()` requires exactly one `type: platform` component, refuses the retired duplicate execution file (`git ls-tree … -- .arc/architecture/execution.{json,yaml,yml}`), then returns director component, director profile, reviewer profile, `defaultPackage` and scoped `verificationInputs`. `director()` enforces that the named director is a real non-container component descended from this platform, declares a `research` activity, and that both named profiles exist in the catalog. |
| `src/library/architecture/component-materialization-policy.ts` | 153       | Applies container semantics downward: rejects authored `owns` on containers, computes `reads` from lineage, resolves the nearest activity `role`/`profile`/`standards` outward, accumulates activity `operations` upward, and rejects `parent` named as an activity.                                                                                                                                                                                                                                                                      |
| `src/library/architecture/components.ts`                       | (extract) | `CatalogLoader` reads the platform definitions, then `ExecutionContext` consumes `PlatformExecution.defaults()`; also holds the `Component`/`Catalog` interfaces, including the container-only fields `defaultPackage`, `director`, `reviewerProfile`, `verificationInputs`.                                                                                                                                                                                                                                                              |
| `src/library/architecture/execution-context.ts`                | (extract) | Resolves a component's package when a leaf maps to more than one, failing with `Ambiguous or missing package; declare defaultPackage on the platform` — the only place `defaultPackage` acts as a tie-breaker.                                                                                                                                                                                                                                                                                                                            |
| `src/library/architecture/references.ts`                       | (extract) | Locks `directorProfile`/`reviewerProfile`/`defaultPackage` into the architecture digest, so a change to platform authority is a recorded contract change, not a silent edit.                                                                                                                                                                                                                                                                                                                                                              |

### Source (other owners, platform-shaped)

| file                                              | owner               | role                                                                                                                                  |
| ------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/library/assignment/resolved-package-plan.ts` | `assignment`        | Consumes the platform's `packageRoots`/`repository` to qualify component ids as `<project>/<component>`.                              |
| `src/library/execution-runtime/run-creation.ts`   | `execution-runtime` | Reads platform-derived authority when admitting fan-out work and calls `inPlaceIntersections(...)` over the write scopes it resolves. |
| `src/library/steward/codex-configuration.ts`      | `steward`           | Builds activation settings from the activity-resolved profile the platform's activity map ultimately selects.                         |

### Documentation

| file                                                 | title as authored                                 | note                                                              |
| ---------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| `docs/library/architecture/component-contracts.md`   | "Component-owned architecture (**version 4**)"    | Title still carries version vocabulary that ruling (D) retired.   |
| `docs/library/architecture/component-access.md`      | "Component ownership and execution access"        | Ownership-derived access, the model the platform is subject to.   |
| `docs/library/architecture/configuration.md`         | "Configuration documents"                         | Includes the retired-duplicate rejection this component enforces. |
| `docs/library/architecture/standard-resources.md`    | "Platform standard resources"                     | Platform-level standards, i.e. `readable-typescript`.             |
| `docs/library/architecture/architecture-contract.md` | "Historical architecture and assignment contract" | Marked historical; not authority for the current platform.        |
| `docs/library/architecture/regression-fixtures.md`   | "Valid architectural regression fixtures"         | Fixture expectations, including container shapes.                 |

### Tests

| file                                                                      | owner          | scenarios                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/library/architecture/acceptance/platform-execution.test.ts`        | `architecture` | 5 tests: legacy environment recipes refused; platform defaults and captured director profile resolve; duplicate retired configuration rejected; explicit director and reviewer required; declared director assessment preserves package engineering boundaries. |
| `tests/library/architecture/acceptance/activity-authoring.test.ts`        | `architecture` | 5 tests proving each activity states all supported fields and that a container may bind one position to many activities.                                                                                                                                        |
| `tests/library/architecture/acceptance/component-materialization.test.ts` | `architecture` | Derives leaf policy, ownership and inventory, and refuses widened inherited reads, unowned maintained files and overlapping future ownership — the enforcement side of "containers own nothing, ownership derives once".                                        |
| 62 test files reference `platform` overall                                | mixed          | Most are fixture scaffolding (`ComponentTestFixture`, `minimal-workflow-policy`) that must author a platform document to load any catalog at all.                                                                                                               |

## Classes, interfaces and their relationships

| symbol                           | file                                               | contract it satisfies                                                                                     | relates to                                                              |
| -------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `PlatformExecution`              | `architecture/platform-execution.ts`               | one authoritative platform; director and reviewer must be explicit                                        | reads `Catalog.components`, `Component.activities`                      |
| `PlatformExecution.defaults()`   | same                                               | returns `directorComponent`, `directorProfile`, `reviewerProfile`, `defaultPackage`, `verificationInputs` | consumed where plans and digests are built                              |
| `PlatformExecution.director()`   | same                                               | director is a non-container descendant of the declaring platform **and** declares `research`              | `ancestry()`, `catalog.profiles`                                        |
| `ComponentMaterializationPolicy` | `architecture/component-materialization-policy.ts` | lineage inheritance, container ownership refusal                                                          | feeds `Component.activities`, `reads`, `standards`                      |
| `Component` / `Catalog`          | `architecture/components.ts`                       | the authored shape, with container-only fields                                                            | produced by `loadCatalog()`, validated against `schemas/component.json` |
| `ExecutionContext`               | `architecture/execution-context.ts`                | project execution entry; package disambiguation via `defaultPackage`                                      | wraps `PlatformExecution`, `resolveAssignment`                          |
| `ArchitectureReferences`         | `architecture/references.ts`                       | platform authority is digest-locked                                                                       | hashes platform fields                                                  |

The single-platform rule is enforced twice, deliberately: `PlatformExecution.defaults()` at execution and
`references.ts` when locking platform fields; no third check exists.

## Completeness against the specification

**Strengths**

1. Authority is explicit and unambiguous. One platform, required `director` + `reviewerProfile`, director
   must be executable and declare `research`, unknown profiles refused — each backed by a named test.
2. Retired configuration cannot shadow the platform: the duplicate `execution.*` file check is a load-time
   refusal, and its message now names the moved path.
3. Platform changes are contract-visible because `references.ts` digests platform fields.
4. `verificationInputs` moved correctly with the model root (`.arc/architecture/test-profiles`).

**Gaps, each with the evidence that makes it a gap**

1. **Version-conditional behaviour survives in the platform gate.**
   `platform-execution.ts:13-15`: `platforms[0]!.schemaVersion < 5` throws
   `Version-five execution requires one authoritative platform`. Ruling (D) removed configuration
   versioning, and the schema pins one current version, so this predicate can only ever misfire on
   invalid input that validation already rejected. The version vocabulary also still appears in adjacent
   gates — `session-state.ts` and `initializer.ts` refuse documents whose `schemaVersion !== 6` with
   "migrate configuration" wording — which is why the counts in this audit cite those files: they are the
   same residue in three places.
2. **The type itself is superseded.** Locked `arcnexus/project` (revision 3) states it supersedes "the
   `platform` and `package` component types", introducing one `project` type with a `repositories` list.
   Nothing in `src/library/architecture` implements `project`; the schema validates exactly `platform`,
   `package`, `foundation|gateway|library|release`. So this component is audited against a contract that
   says it should not exist — the largest single divergence in the catalog, and the reason the final plan
   must sequence the migration rather than patch around it.
3. **`defaultPackage` works, but only as a tie-break, and my earlier reading of it was wrong.**
   `execution-context.ts:170-181` resolves a path's package by **maximum declared depth**, and only when two
   packages tie does it use `selected.find((c) => c.id === defaultId)` before throwing `Ambiguous or missing
package; declare defaultPackage on the platform`. So the field is honoured — not decoration — but it is
   invisible in the normal case, and the function name I claimed to grep (`resolveDefaultPackage`) does not
   exist, which is itself the evidence that I had not read this block before writing it. Narrowed gap: the
   tie-break is silent about _why_ depth tied, and no test I have located covers the tie path specifically.
4. **The platform has no owner for its own concept.** It owns one file; the rules that make it a platform
   live in `architecture`'s paths and its consumers in `assignment`, `execution-runtime` and `steward`.
   Nothing in the catalog is accountable for the platform _as a concern_, which is precisely the kind of
   drift the audit exists to surface: a change to platform semantics is an edit to another component's
   files, and the single-owner rule does not see the concept at all.
5. **Documentation still speaks the retired vocabulary.** `component-contracts.md` is titled
   "Component-owned architecture (version 4)". Its content needs review against the current schema; the
   title alone is enough to mislead a newcomer, which is the failure mode already recorded this session.

## Recommended next phase for this component

1. Delete the `schemaVersion < 5` predicate and the two sibling "migrate configuration" gates, leaving
   schema validation as the single refusal point, and retarget any test that quoted those messages.
2. Decide `defaultPackage`'s fate: make it the actual tie-breaker the message promises, or remove the
   field and require explicit package selection — as one change, with the contract row updated under
   recorded authority if the interface moves.
3. Fold the platform-implementation gap into the `project` migration rather than fixing `platform`
   in place, since the locked contract retires the type.
