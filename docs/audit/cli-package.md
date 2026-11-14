# Audit: `cli-package` (package)

Phase 3, component 2, on branch `445-audit-reports` (routing decided by the architect: one audit branch,
PR updated each turn). Specification authority is the **locked contracts** — `arcnexus/project` rev 3 and
`arcnexus/architecture-model` — not the current documentation. Evidence read at `7c3a9aa`.

## What it declares

`.arc/architecture/components/cli-package.yaml` — the catalog's only `type: package`:

| field            | value                                                                                                                                         | note                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `parentId`       | `arcnexus`                                                                                                                                    | the platform                                                  |
| purpose          | Deliver self-directed workdays and externally directed tasks through the CLI                                                                  |                                                               |
| objectives       | Produce independently verifiable bounded work                                                                                                 | inherited-equal to the platform's                             |
| constraints      | the host validates dynamically selected existing package owners against captured authority; upstream effects require declared host operations |                                                               |
| `repository`     | `arcnexus`                                                                                                                                    | the only repository named in the catalog                      |
| `classification` | one entry: `{ path: docs/acceptance, kind: documentation }`                                                                                   |                                                               |
| `activities`     | `{}` — **empty**                                                                                                                              | a container that selects no positions                         |
| `owns`           | absent                                                                                                                                        | permitted: the `package` schema branch has no `owns` property |

## How packages work in the implementation

Two distinct inheritance channels run through the nearest container, and the audit keeps them separate
because conflating them is how a "package declares X" claim goes wrong:

**Identity channel — `repository`.** `component-materialization.ts:34` assigns
`c.repository = owner?.repository ?? …`, i.e. the nearest container that names one wins. Consumers:
`assignment.ts:204` compares `component.repository` against `env.workspace` identity when a workspace
environment is present; `bindings.ts:118` refuses `repository !== materialized.repository` and
`bindings.ts:39` asserts the captured binding; `catalog-view.ts:17,39` projects it into catalog output.

**Location channel — `root` → `repositoryRoot`.** `component-materialization.ts:35-36` sets
`c.repositoryRoot = this.policy.root(c)` and `c.path = c.repositoryRoot`, where
`MaterializationPolicy.root()` (`component-materialization-policy.ts`) resolves the nearest owner's
`root ?? '.'` through `scopePath()`. Consumers that treat it as the package root:
`component-operation-plans.ts:52` (`packageRoot: c.repositoryRoot!` — non-null asserted),
`testing/operation-plan.ts:53`, `references.ts:119` (digest of `posix.join(owner.repositoryRoot ?? '…')`),
`public-api.ts:51` and `derived-api-cache.ts:23` (`root: owner.repositoryRoot`).

**Container rules that are actually enforced** (`component-materialization-policy.ts`, read this turn):
a platform may not author `owns`; a component whose nearest container is not a package is refused with
`Component ${id} parent must be a package`; ownership roots are checked for overlap. The loader additionally
rejects authored ownership on `platform`/`package`. Nothing in `src/library/architecture` requires a package
to declare `repository`, and there is no "one repository per package" rule — I searched for those message
fragments and they do not exist; earlier notes in this session that claimed them were stale recollections of
code this branch already removed, and they are corrected here rather than carried forward.

## Classes and interfaces

| symbol                           | file                                       | contract                                                                                                                                                                     | relates to                                                                                 |
| -------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `MaterializedComponentFields`    | `component-materialization-policy.ts:7-25` | optional container projections: `definition`, `fileClassification`, `root`, `classification`, `standards`, `testProfile`                                                     | produced by `ComponentMaterializationPolicy.apply`, consumed by `ComponentMaterialization` |
| `ComponentMaterializationPolicy` | same file                                  | lineage inheritance, container ownership refusal, scope-overlap refusal                                                                                                      | `ancestry()`, `covered()`, `ComponentOperationPlans`                                       |
| `ComponentMaterialization`       | `component-materialization.ts`             | writes derived fields onto each component: `repository` (:34), `repositoryRoot`/`path` (:35-36), inventory capture (:90 compares `c.repository !== c.definition.repository`) | the loader's materialize step; every consumer listed above                                 |
| `ComponentCatalogValidator`      | `component-update.ts` / loader             | definition source selection by lineage (`sources(c)` with `parentEntry`), package-private path derivation                                                                    | refuses cross-lineage reads                                                                |
| `CatalogView`                    | `catalog-view.ts:17,39,40`                 | projects `repository`, `root`, `packageRoot` for inspection                                                                                                                  | the `inspect` gateway surface                                                              |

## Completeness against the specification

**Strengths**

1. Container discipline is genuinely enforced: no `owns` on the package, parent type checked, and the
   empty `activities` map is legal rather than accidental — the schema and policy agree.
2. Identity inheritance has exactly one implementation site (`component-materialization.ts:34`), so
   repository alignment checks in `assignment`/`bindings` cannot diverge from what the loader derived.
3. `docs/acceptance` classification is the single authored classification entry and matches the
   `docs/acceptance/**` layout that `verify-architecture-maintenance` hashes.
4. Nothing in the package claims file authority it should not have: it declares no ownership, and the
   platform's `verificationInputs` carry the shared root files instead.

**Weaknesses and gaps**

1. **The repository identity is decorative for this package.** `cli-package.yaml` names `repository:
arcnexus`, but no rule requires a package to declare it, and the platform declares none, so
   `owner?.repository` resolves for every component only because this one document happens to state it.
   Delete the line and the whole catalog silently loses repository identity — a schema that permits it and
   a validator that never demands it make the field a convention, not a contract.
2. **Two location fields for one concept.** `root` (authored, inherited, → `repositoryRoot` →
   `packageRoot`) and the package-level `repository` never cross-checked: `component-operation-plans.ts:52`
   uses `c.repositoryRoot!` with a non-null assertion, so an unrooted package produces a crash rather than a
   validation refusal. The #442 incident — operation binding to `repository: 'contract.txt'` producing empty
   paths and "unreachable parent" — is the same hazard arriving in the shipped catalog.
3. **`activities: {}` on the only package while the platform carries six activities.** Position selection is
   therefore entirely inherited for this delivery route, and nothing states what the package itself does when
   asked to work. A container with an empty activity map plus no ownership is a pure namespace: correct under
   ruling (A)/(B), but the audit records that the delivery CLI has no first-person architectural statement at
   all, only its children's.
4. **Version-conditional logic still sits on the location channel.** `testing/test-paths.ts:36` branches on
   `component.schemaVersion >= 5` to choose a path layout. Ruling (D) removed configuration versioning and the
   schema pins one version, so this predicate is dead-but-executed code on a path every test harness uses.
   Same class as the platform gates recorded in `docs/audit/arcnexus.md` gap 1.
5. **`project` supersedes the type outright.** Locked `arcnexus/project` rev 3 retires `platform`+`package`
   in favour of a single `project` with `repositories` (one entry for the MVP) and folds
   `architecture/environment.yaml` in. `cli-package` is therefore an implementation of a concept the contract
   says should not exist, and its `repository` field is exactly the shape the contract wants moved to
   `repositories`. Any phase plan that migrates the platform must migrate this container in the same phase,
   or the two location channels above get ported twice.

## Test surface that exists (verified by path, counts from `grep -cE '^test\('`)

- `tests/library/architecture/acceptance/component-operations.test.ts` — 8 tests
- `tests/library/architecture/acceptance/component-repositories.test.ts` — 4 tests
- `tests/library/portfolio/acceptance/portfolio.test.ts` — 12 tests
- repository and package identity are asserted from `architecture`'s own suites, verified present here:
  `activity-profiles.test.ts`, `architecture.test.ts`, `assignment-scope.test.ts`,
  `catalog-ownership.test.ts`, `component-materialization.test.ts`,
  `component-operations.test.ts`

There is **no** `assignment-package.test.ts`, `project-qualification.test.ts`,
`package-authority.test.ts` or `resolved-package-plan.ts`: I cited four names across the two drafts of this
audit and none of them exist. Package and repository behaviour is asserted inside the `architecture` suites
listed above — there is no suite named for the container, which is itself gap 4's evidence: the concept has
no test surface of its own.
