# Migration plan: aligning implementation with the component specifications

Phase deliverable of the audit plan: one numbered phase per gap, each testable on its own, ordered so a
phase never depends on a later one. Source material is `docs/audit/components.md` plus the per-component
reports; nothing here is derived from documentation of intent — every gap cites the file and line it was
read from. Status is recorded honestly: phases A and B are done, C is in progress, D onward are not started.

## Status

| phase | what it delivers                                             | state                                                            |
| ----- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| A     | automated unowned-file check over the tracked tree           | **done** — `catalog-ownership.test.ts`, 3/3 on staging `2593354` |
| B     | component-type relationship and audit sequence, written down | **done** — `docs/audit/components.md`                            |
| C     | per-component implementation audits                          | **in progress** — 2 of 23 (`arcnexus`, `cli-package`, PR #444)   |
| D     | deterministic audit sequence as product surface              | specified below, not implemented                                 |
| E+    | contract-alignment phases                                    | sequenced below, each gated on its audit report existing         |

## Phase D — derive the audit sequence from the catalog

The audit order in `components.md` was my authored judgement: `git grep -lE "audit sequence|audit order|
component ordering" -- src docs scripts` returns nothing, so no code produces it and it cannot be reliably
called when context is lost — which is how an audit strays. The architect directed 2026-11-14 to make it
deterministic by deriving it from the catalog instead.

**Algorithm** (to live in `architecture`, exposed as `arcnexus audit sequence [project] [--json]`):

1. Enumerate components from `loadCatalog()` — the same captured authority every gate already uses, so the
   sequence cannot disagree with validation. `CatalogLoader` sorts the enumerated tree (`components.ts:210`),
   which makes the output stable across runs without extra work.
2. Emit containers first: `type: platform`, then every `type: package` in sorted id order. Lineage
   inheritance means a leaf's defaults are undecidable until its containers are audited
   (`component-materialization-policy.ts`).
3. Emit the owner of the shared model files next — the component owning `.arc/architecture` directories and
   the contract registry (in this catalog, `architecture-maintenance`) — because the ownership declarations
   other audits read are its product.
4. Then a topological walk of remaining leaf owners over `relatedIds` and operation-consumer edges, ties
   broken by sorted id, so output is total and reproducible: an owner is audited after every owner whose
   declared public modules it imports.
5. Each entry reports: id, type, owned paths, audited-after ids, and the reason for its position, so a human
   can see why an item is where it is and challenge the placement instead of the whole document.

**Acceptance.** Two invocations on an unchanged catalog produce byte-identical output; every component in
`architecture/components` appears exactly once; no owner precedes an owner it consumes; containers precede
their leaves; the maintainer of the model precedes leaf owners. `docs/audit/components.md` then cites the
command as the source of the sequence rather than holding a hand-maintained list, and the per-component
reports are produced in that emitted order.

**Owner:** `architecture` (loader and catalog contract) for the derivation, `architecture-maintenance` for
the published `components.md` text.

## Phase E — contract-alignment phases, in dependency order

Each phase closes a divergence found by auditing implementation against the **locked** contracts, and each
names its own verification. None is started; the order below is the dependency order, not preference.

1. **E1 — remove version-conditional gates.** `platform-execution.ts:14` (`schemaVersion < 5`),
   `session-state.ts:119` and `initializer.ts:48` (`schemaVersion !== 6` with "migrate configuration"
   wording), `testing/test-paths.ts:36` (`schemaVersion >= 5` path layout). Schema validation is the single
   refusal point. Verify: architecture, assignment, task-intake and testing profiles; expected-message
   tests retargeted, not deleted.
2. **E2 — one identity field per concept.** Decide `defaultPackage` (currently authored, digest-locked,
   returned by `defaults()`, and consulted only in an error path) and the package-level `repository`
   (nothing requires a package to declare it; `component-operation-plans.ts:52` non-null-asserts the derived
   `repositoryRoot`). Either make both authoritative or collapse them; the #442 empty-path incident is the
   failure this prevents. Verify: operations, assignment, portfolio, workspace.
3. **E3 — make an activity's `profile` binding, not decoration.** It now selects a profile id at activation
   through `resolved.activities?.[activity]?.profile`, with a component-profile fallback. Verify: steward,
   task-intake, execution-runtime; the shipped frame-equality suite must stay green throughout.
4. **E4 — `project` migration.** Locked `arcnexus/project` rev 3 supersedes `platform` + `package`,
   `environment.yaml` and `composition-profiles`. Implement the `project` type with `repositories`;
   migrate the platform and package documents in the same phase (both location channels in E2 move once);
   keep the loader able to read captured older authority forms so retained evidence still validates,
   because evidence retention is not configuration versioning. Verify: all owners.
5. **E5 — profile budgets.** #440: the schema stops offering the seven budget properties, the guard
   delegates to `validateSchema` rather than keeping its own forbidden-key list, fixtures stop authoring
   budgets, and the guard-word expectations in `shared-preparation.test.ts`, `assignment/retired-execution
.test.ts`, `task-intake/retired-execution.test.ts` retarget in one change. Verify: `testing` reaches 0
   failures, which is the last owner keeping `staging` CI red.
6. **E6 — version-named schema identifiers.** 19 schemas still publish `-v1` `$id` URIs. Clearing them is
   contract-visible (identities appear in validation output and captured schema snapshots), so this phase
   needs the architect's decision before the rename, not after. Verify: `validate` with zero findings, plus
   the guidance and contract suites.
7. **E7 — documentation vocabulary.** `component-contracts.md` is titled "Component-owned architecture
   (version 4)"; other titles and prose still carry retired vocabulary. Verify: guidance validation.

## Rules for working this plan

- One phase per turn, verified against the committed tree, with per-owner counts reported as measured.
- Never batch several phases blind: the recorded failure mode is my #440 batch which took `testing` from 11
  failures to 12 and broke four green owners before it was reverted.
- A claim in a report carries the file and line it was read from. Four invented test filenames and three
  stale production messages were caught by checking `ls`/`git grep` before committing; the habit this plan
  encodes is that check.
- Locked contracts change only under recorded human authority; `docs/interface` is never a formatter target.
