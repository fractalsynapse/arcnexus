# Component types as they exist in the implementation

Audited from code at `aac5902`, not from documentation. Every statement names the file it came from.
Where the implementation and a locked contract disagree, that is recorded in
[Divergence](#divergence-from-locked-contracts) rather than smoothed over — this file describes what
**is**, so the per-component audits and the final plan can move it toward what **should be**.

## The three type groups

`src/library/architecture/schemas/component.json` validates a component document with a `oneOf` over
three branches, selected by the `type` field:

| branch    | `type` values                                 | required fields                          | fields it may add that others cannot                                  |
| --------- | --------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| root      | `platform`                                    | `schemaVersion`, `id`, `type`, `purpose` | `defaultPackage`, `director`, `reviewerProfile`, `verificationInputs` |
| container | `package`                                     | the above **+ `parentId`**               | `repository`, `root`, `classification`                                |
| owner     | `foundation`, `gateway`, `library`, `release` | the above **+ `parentId` + `owns`**      | `api`                                                                 |

All three may declare `activities`, `operations`, `objectives`, `constraints`, `questions`, `reads`,
`standards`, `executionProfile`, `testProfile`. Every branch sets `additionalProperties: false`, so a
document carrying a field outside its branch is refused — this is what caught the fixture migration
work, where `path`, `access`, `allowedWritePaths`, `verification` and `relatedIds` were authored
directly on components even though the loader derives them.

Two vocabularies the table above does not show are equally binding. `schemaVersion` is `const: 6` on all
three branches — a document at any other version is refused, which is why #448's "closed vocabularies"
item is about the fields *inside* the branches rather than the version. `activities` is keyed by
`propertyNames` over exactly six activities — `research`, `documentation`, `testing`, `implementation`,
`review`, `release` — and each activity requires `role`, `instructions`, `profile` and `operations`, so a
document naming a seventh activity or omitting one of those four is refused at load. Operation usages are
likewise closed: `preflight`, `setup`, `refresh`, `verify`, `delivery`, `agent`.

**Containers own nothing.** Neither `platform` nor `package` may declare `owns`. Write authority
exists only on the owner branch. A package's `root` and `repository` locate its source; they do not
grant it write scope.

## How the types connect

- **One platform.** `PlatformExecution.defaults` (`src/library/architecture/platform-execution.ts`)
  requires exactly one component of type `platform` and refuses a catalog without it; it also reads
  that platform's `defaultPackage` and `director`.
- **`parentId` builds the lineage.** `ancestry()` (`component-paths.ts`) walks platform → package →
  owner. A package's parent must be the platform; an owner's parent chain must reach a package
  (`components.ts`, the `related`/`ancestor` checks).
- **Nearest declaration wins for scalars, activities accumulate operations.**
  `ComponentMaterializationPolicy.apply` resolves each scalar (`executionProfile`, `testProfile`) and
  each activity's `role`/`profile` from the nearest ancestor that names it, while `operations` are the
  union across the lineage. A component holds only the activities **it declares**; an ancestor naming
  an activity does not hand it down — verified by the option-B ruling and by
  `activity-authoring.test.ts`.
- **An activity states position, model, bound operations, direction, and may state standards.**
  `ComponentActivity` (`components.ts`) = `role`, `instructions`, `profile`, `operations`,
  `standards`. `standardsInForce` (`frame.ts`) is the single resolver: the union of component,
  position and activity standards, filtered to ids the catalog knows.
- **Ownership is the only write authority.** `owns` becomes `ownership.paths`, and `allowedWritePaths`
  is derived from it (`component-materialization.ts`). A component's **own definition is not part of its
  ownership**: `.arc/architecture` is held by a single steward, `architecture-maintenance`, so the profile
  that says what a component may do is not writable by that component. The definition path remains captured
  on `definition` for digests and inspection, which is what `verify-architecture-maintenance` and the
  contract locks read.
  Reads come from `reads` up the lineage (`access.readPaths`). There is no separate write grant:
  `DirectoryGrants` and `access.writeDirectories` were deleted as unreachable state.
- **Operations are shared definitions, usages are declared by scope.** `.arc/architecture/operations/*.yaml`
  holds one definition per operation id; a component's `operations` map names which usages apply to it
  (`preflight`, `setup`, `refresh`, `verify`, `agent`, `delivery`). An operation bound with `agent`
  usage **must** appear in one of that component's declared activities, or
  `ComponentOperationPlans` refuses the catalog.
- **Every tracked file resolves to one owner.** `OwnershipValidator` enumerates
  `git ls-tree -r --name-only <base>` and refuses zero or multiple owners;
  `catalog-ownership.test.ts` now asserts the same over `git ls-files` for this repository.

## Ownership and holder rules as they now stand (2026-11-14)

- `.arc/architecture` is owned in one claim by `architecture-maintenance`, which also holds
  `.arc/README.md`. Container definitions (`arcnexus.yaml`, `cli-package.yaml`) and the readable-TypeScript
  standard are covered by that claim rather than itemised, and `foundation` no longer owns the standard.
- No component owns its own definition: `component-materialization.ts` stopped pushing it into ownership,
  and the duplicate-claim guard that accompanied it is gone. Changing a profile is therefore an act of the
  steward, which is how AGENTS.md's rule that candidate edits cannot grant new authority is enforced rather
  than merely stated.
- Verified consequence: every tracked file resolves to exactly one owner. Measured against the committed
  tree: 929 tracked files, 21 owners, **0 unowned, 0 multi-owned**, one `.arc/architecture` steward, and
  `validate` exit 0 with zero contract findings.
- The sequence's holder phase now lists **every** component holding `.arc/` content — `architecture-maintenance`
  (`.arc/architecture`, `.arc/README.md`), `report` (`.arc/learning`), `task-intake` (`.arc/plans`) — ordered
  by the type layer, then content held, then identifier, and none of them reappears in the type list.
  Concentrating all custody in one component is this project's choice, not a rule the code assumes.

## Resolution order

`CatalogLoader.load()` (`src/library/architecture/components.ts:214`) runs in this sequence, which is
also the order failures surface in. Every step is listed, because an audit that rates a component
against "the loader" needs to know which check had the first chance to refuse it:

1. definitions — components, roles **and execution profiles** (`components.ts:265`)
2. operation definitions
3. the environment definition, then `repositoryRevisions` for bound secondary repositories
   (`repository-revisions.ts:12`)
4. `ComponentMaterializer.resolve()` — derived fields, lineage policy, activities, ownership
5. non-empty catalog check
6. `CatalogComponentValidator` per component
7. `validateInitialization` (`initialization.ts:67`)
8. `captureComponentTests` (`testing/captured-tests.ts`) — the suite metadata each owner claims
9. `ComponentOperationPlans.resolve()` — plans per owner, usage/agent checks
10. `ArchitectureReferences` — standards and reference digests
11. composition profiles
12. `ownership()` — `OwnershipValidator` over the Git tree, then bound ownership for secondary
    repositories
13. `PublicApiCatalog.resolve()`

## Ordering rules the implementation now enforces

`ComponentSequence` (`src/library/architecture/component-sequence.ts`) emits every component exactly once:

1. **platform** — the single authoritative root; two documents are refused, not resolved;
2. **package** — containers, parent before child;
3. **model-maintainer** — **every** component holding knowledge-root content under `.arc/`, not the largest
   holder. The phase exists because the model root is loaded before the regular components: ownership, roles,
   operations and every profile directory are authored inside it, so a leaf is provisional until its
   declarations have been examined. A component's own definition is excluded, because holding content *for
   others* is the signal. In this catalog the phase is `architecture-maintenance`, `report` and
   `task-intake`, ranked by the type layer, then by content held, then by identifier; the rank is computed
   from what a component owns, never from its name;
4. **component** — every remaining component, by the type layer below, then identifier.

**Type layer:** `foundation` → `gateway` → `library` → `release`, exported as `componentTypeOrder` with
`componentTypeRank` for any list that enumerates components, matching the contract walk in AGENTS.md. The
layer is applied inside the final phase and the maintainer phase intentionally precedes it, so a library may
sit ahead of the foundation — that is the documented exception, not an ordering bug.

**Status, stated plainly: nothing in the product uses this yet.** `grep -rn ComponentSequence src
--include=*.ts` returns only the module that defines it, and its sole caller is
`tests/library/architecture/unit/component-sequence.test.ts`. There is no `arcnexus audit sequence`
command, no catalog field carrying the order into `inspect`, and no runtime walk that consumes it. An
order nobody calls is an authority on paper, so `docs/audit/migrate.md` Phase D records the choice: make
it a surface something reads, or delete the module. Until then, obtain the order directly:

```ts
import { loadCatalog } from './dist/library/architecture/components.js';
import { ComponentSequence } from './dist/library/architecture/component-sequence.js';
new ComponentSequence(await loadCatalog(process.cwd(), 'HEAD')).entries();
```

For this catalog that is 23 entries: `arcnexus`, `cli-package`, `architecture-maintenance`, `report`,
`task-intake`, `foundation`, `cli`, then the eighteen libraries in identifier order, then `release` —
each waiting only on `cli-package`, because no relationship edges exist (divergence 8).

## Audit sequence

Ordering follows the connection rules, because a component cannot be judged before the containers that
supply its inherited defaults, and cannot be judged as a consumer before the components it depends on.

1. **`platform`** then **packages** — they define defaults, source roots and repository identity for
   everything below.
2. **`architecture-maintenance`** — it owns the model files themselves, so its scope must be correct
   before any other component's `owns` is trusted.
3. **`foundation`** — build and check standards other components are measured against.
4. **The model and its loader: `architecture`, then `coordination-store`** — the catalog contract and
   the durable stores every other component reads.
5. **Execution spine, in dependency order: `operations`, `testing`, `workspace`, `assignment`,
   `execution-runtime`** — operation definitions, test selection, workspace lifecycle, resolution, and
   the host that runs activations.
6. **Agent-facing layer: `steward`, `agent-guidance`, `guidance-validation`, `task-intake`, `report`,
   `change-inspection`** — consumers of everything above.
7. **Gateway and delivery: `cli`, `publisher`, `release`, `workday`, `portfolio`, `experiments`.**

**This numbered list is the reporting priority, not the output of `ComponentSequence`.** The two orderings
answer different questions and must not be confused: the code's holder phase is determined purely by who
owns `.arc/` content (`architecture-maintenance`, `report`, `task-intake`) and is what any runtime walk
should use, while the list above is the sequence in which audit reports are worth writing, which puts
`foundation` third because its build and check standards are what other components are measured against.
Where they disagree, the code is the fact and this list is the plan.

Each phase produces `docs/audit/<component>.md`: file-level inventory with one-line purpose per file,
the TypeScript classes and their interfaces with relationships, then a completeness rating against that
component's specification with strengths, weaknesses and gaps. The final plan sequences fixes by phase
so each is testable before the next.

## Divergence from locked contracts

Found while auditing, not assumed. Each is a decision for the architect, listed with its evidence.
Contract identity is the content digest recorded in `docs/interface/registry.yaml`; revision ordinals
were retired under #449, so nothing below cites one.

1. **The `project` type does not exist in code.** `docs/interface/arcnexus-project.md` is **locked** and
   states it _supersedes_ "the `platform` and `package` component types, `architecture/environment.yaml`,
   `.arc/architecture/composition-profiles/`, and portfolio registration as a concept a user must learn".
   Searching `src/library/architecture` for a `project` type returns nothing; the schema still validates
   exactly `platform`, `package`, `foundation|gateway|library|release`. The implementation is therefore an
   entire model behind an approved contract.
2. **Resolved: the model is now at the knowledge root.** `CatalogLoader` enumerates
   `git ls-tree -r --name-only <base> -- .arc/architecture` (`components.ts:208`), 61 files are tracked
   under it, top-level `architecture/` no longer exists, and the readable-TypeScript standard sits at
   `.arc/architecture/standards/readable-typescript.yaml`, the path the foundation contract prescribes.
   This item is kept as history because the audit sequence and several ownership rules were re-cut on the
   strength of the move.
3. **`environment.yaml` and `composition-profiles/` are still load-bearing** (`CatalogLoader.load`
   steps 3 and 9) although the project contract supersedes both — the first folds into project
   `repositories`, the second is removed as a concept. An earlier version of this item claimed the schema
   required `workspace.primary.repository` while the TypeScript type made it optional; that is no longer
   true — `schemas/environment.json` requires only `id`, and the type is optional too. The two agree.
4. **The project contract still specifies an "activity profile map"** on `components()` (Provides §2),
   while ruling (A)/(B) removed `activityProfiles` in favour of a `profile` field on each declared
   activity. Code and contract disagree in the opposite direction from items 1 and 3: here the **code is
   ahead**, and the contract text needs the architect's correction.
5. **Two locked project services have no implementation.** Provides §2 requires objectives and constraints
   _with measures_, and `measures` appears nowhere in `schemas/component.json`; §6 names `deliveryPolicy()`
   and `grep -rn deliveryPolicy src` returns nothing. A required field the schema cannot express and a
   required service with no code are both gaps the audit cannot rate a component against.
6. **Six locked contracts are owned by components that do not exist.** `arcnexus/architecture-model`,
   `coordination`, `execution`, `direction`, `verification` and `delivery` name those owners and describe
   absorbing `architecture`+`guidance-validation`, `coordination-store`+`report`,
   `execution-runtime`+`workspace`+`steward`+`operations`+`change-inspection, `task-intake`+half of
   `assignment`+`workday`, and halves of `publisher`. Only `project`, `foundation`, `cli-gateway` and
   `release` match a catalog id, and `arcnexus/report`, `arcnexus/guidance` and `arcnexus/testing` are
   still in the registry `waiting` queue. Until this map is stated, "rate this component against its
   specification" has no fixed answer for most of the catalog.
7. **174 of the contracts' 179 acceptance scenarios are untraceable in tests.** Measured by searching
   every scenario id in `docs/interface/*.md` across `tests/` and `src/`: only `ARC-9`, `CO-20`, `EX-6`,
   `EX-20` and `GW-11` appear. `docs/interface/README.md` states each scenario becomes a deterministic
   test named after it. So a green suite cannot be cited as contract coverage, which is how the phases in
   `docs/audit/migrate.md` must be gated instead.
8. **The component dependency graph is cyclic, so the sequence cannot be derived from it.** Resolving
   owner-level `imports` for the shipped catalog gives 97 `src` edges whose condensation is one 13-node
   cycle (architecture, assignment, change-inspection, coordination-store, guidance-validation,
   operations, portfolio, report, steward, task-intake, testing, workday, workspace); 16 of 21 including
   test imports. `relatedIds` is empty for all 23 components and #446 rules its deletion, which is why
   `ComponentSequence` ranks by lineage, knowledge-root holdings and type layer instead. Breaking the
   cycle costs a cut of 38 edges over 247 import sites — a migration phase in itself, not an ordering
   detail. `dependsOn` in the contract registry is the acyclic source that already exists.
