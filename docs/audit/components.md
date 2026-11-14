# Component types as they exist in the implementation

Audited from code at `4714926`, not from documentation. Every statement names the file it came from.
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
  tree: 930 tracked files, 21 owners, **0 unowned, 0 multi-owned**, one `.arc/architecture` steward, and
  `validate` exit 0 with zero contract findings.
- The sequence's holder phase now lists **every** component holding `.arc/` content — `architecture-maintenance`
  (`.arc/architecture`, `.arc/README.md`), `report` (`.arc/learning`), `task-intake` (`.arc/plans`) — ordered
  by the type layer, then content held, then identifier, and none of them reappears in the type list.
  Concentrating all custody in one component is this project's choice, not a rule the code assumes.

## Resolution order

`CatalogLoader.load()` (`src/library/architecture/components.ts:214`) runs in this sequence, which is
also the order failures surface in:

1. component definitions
2. operation definitions
3. the environment definition
4. `ComponentMaterializer.resolve()` — derived fields, lineage policy, activities, ownership
5. non-empty catalog check
6. `CatalogComponentValidator` per component
7. `ComponentOperationPlans.resolve()` — plans per owner, usage/agent checks
8. `ArchitectureReferences` — standards and reference digests
9. composition profiles
10. `ownership()` — `OwnershipValidator` over the Git tree, then bound ownership for secondary
    repositories
11. `PublicApiCatalog.resolve()`

## Ordering rules the implementation now enforces

`ComponentSequence` (`src/library/architecture/component-sequence.ts`) emits every component exactly once:

1. **platform** — the single authoritative root; two documents are refused, not resolved;
2. **package** — containers, parent before child;
3. **model-maintainer** — the component holding the most paths under `.arc/architecture/`. The phase exists
   because the model root is loaded before the regular components: ownership, roles, operations and every
   profile directory are authored inside it, so a leaf is provisional until its declarations have been
   examined. In this catalog that is `architecture-maintenance`, which owns **all three profile directories**
   — `composition-profiles`, `execution-profiles` and `test-profiles` — by the architect's direction of
   2026-11-14; the rank is computed from what a component owns, never from its name;
4. **component** — every remaining component, by the type layer below, then identifier.

**Type layer:** `foundation` → `gateway` → `library` → `release`, exported as `componentTypeOrder` with
`componentTypeRank` for any list that enumerates components, matching the contract walk in AGENTS.md. The
layer is applied inside the final phase and the maintainer phase intentionally precedes it, so a library may
sit ahead of the foundation — that is the documented exception, not an ordering bug.

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

1. **The `project` type does not exist in code.** `docs/interface/arcnexus-project.md` is **locked at
   revision 3** and states it _supersedes_ "the `platform` and `package` component types,
   `.arc/architecture/environment.yaml`, `.arc/architecture/composition-profiles/`, and portfolio registration as
   a concept a user must learn". Searching `src/library/architecture` for a `project` type returns
   nothing; the schema still validates exactly `platform`, `package`, `foundation|gateway|library|release`.
   The implementation is therefore an entire model behind an approved contract.
2. **The model is at the wrong root.** Locked `arcnexus-foundation` revision row prescribes
   `.arc/architecture/standards/readable-typescript.yaml` → `.arc/architecture/standards/…`, and the project
   contract names the knowledge root as `.arc/`. The code has never read `.arc/architecture/`
   (`git grep` over `src`: zero hits); all 60 model files live in top-level `architecture/`, and
   `.arc/architecture/` holds a single `plan-template.md`. Architect ruled 2026-11-13 to finish the
   move.
3. **`environment.yaml` and `composition-profiles/` are still load-bearing** (`CatalogLoader.load`
   steps 3 and 9) although the project contract supersedes both — the first fold into project
   `repositories`, the second removed as a concept. The `workspace.primary.repository` confusion
   investigated this session was downstream of this: the TS type marks it optional while the schema
   requires it.
4. **The project contract still specifies an "activity profile map"** on `components()` (Provides §2),
   while ruling (A)/(B) removed `activityProfiles` in favour of a `profile` field on each declared
   activity. Code and contract disagree in the opposite direction from items 1–3: here the **code is
   ahead**, and the contract text needs the architect's correction.
