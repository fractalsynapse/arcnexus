# Migration plan: aligning implementation with the component specifications

Phase deliverable of the audit plan: one numbered phase per gap, each testable on its own, ordered so a
phase never depends on a later one. Source material is `docs/audit/components.md` plus the per-component
reports; nothing here is derived from documentation of intent — every gap cites the file and line it was
read from. Status is recorded against the merged code, not against intention: A and B are done, C is
in progress at two reports of twenty-three, D is **partly** done and its stated acceptance is not
satisfiable as written, E onward are not started.

## Status

| phase | what it delivers                                             | state                                                            |
| ----- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| A     | automated unowned-file check over the tracked tree           | **done** — `catalog-ownership.test.ts`, 3/3; proven sensitive by an injected orphan |
| B     | component-type relationship and audit sequence, written down | **done** — `docs/audit/components.md`                            |
| C     | per-component implementation audits                          | **in progress** — 2 of 23 (`arcnexus`, `cli-package`)            |
| D     | deterministic audit sequence as product surface              | **partly** — derivation shipped without a surface; acceptance unsatisfiable as written |
| E+    | contract-alignment phases                                    | sequenced below, each gated on its audit report existing         |

## Phase D — the audit sequence: what shipped, and what the graph will not support

This phase was written as "specified below, not implemented". Two commits on PR #445 (`f9720b0`,
`c9f0d40`, `4e465db`) then shipped a derivation, so the plan is corrected against the code rather than
left describing an intention.

**Shipped.** `ComponentSequence` (`src/library/architecture/component-sequence.ts`, declared in
`architecture.yaml`'s api list) emits every component exactly once: the single platform; packages
parent-before-child; **every** component holding `.arc/` content — in this catalog `architecture-maintenance`,
`report` and `task-intake`, ranked by type layer, then amount held, then identifier — and the remainder by
the type layer `foundation → gateway → library → release`, then identifier. Measured output for this
repository at `92de7eb` is those 23 entries in that order, every one waiting only on `cli-package`.

**Not shipped, and the acceptance criterion cannot be met as written.** Two facts from this turn:

1. **No product surface and no consumer.** `grep -rn ComponentSequence src --include=*.ts` outside its own
   module returns nothing, so no runtime walk, `inspect` field or CLI command uses the order; its only
   caller is `tests/library/architecture/unit/component-sequence.test.ts`. There is no
   `arcnexus audit sequence`. A rule nothing calls is decoration, and the "deterministic audit sequence as
   product surface" row is therefore **not done**.
2. **The dependency edges the algorithm was to walk do not exist, and the real ones are cyclic.**
   `relatedIds` is empty for all 23 components and #446 records the ruling to delete it. Taking the
   edges the catalog already resolves — owner-level `imports` from `validate --json` — gives 97 `src`
   edges whose condensation is **one 13-node cycle** (architecture, assignment, change-inspection,
   coordination-store, guidance-validation, operations, portfolio, report, steward, task-intake, testing,
   workday, workspace); 16 of 21 including test imports. Making it acyclic costs a cut of 38 edges across
   247 import sites, worst first: `assignment→architecture` (28), `assignment→operations` (21),
   `architecture→operations` (20), `task-intake→architecture` (16). So "no owner precedes an owner it
   consumes" is not achievable from the module graph without re-layering those thirteen components, which
   is a contract-alignment phase in its own right, not a sort.

**Revised acceptance.** Either the derivation becomes an authority something uses, or it is deleted:

- [ ] a catalog field or command emits the sequence, and the audit walk that consumes it reports the same
      order the derivation produced — proven against the committed tree, not a fixture; or
- [ ] the module is removed as unreachable machinery and the audit order is stated where it is actually
      read.
- [ ] whichever order is used records its edge source explicitly. The acyclic source that already exists is
      `dependsOn` in `docs/interface/registry.yaml`:
      `project → foundation → cli-gateway → architecture-model → coordination → execution → direction →
      verification → delivery → release → collaboration-provider`. It describes the contract walk AGENTS.md
      already tells stewards to follow, and unlike the import graph it has no cycles to break.
- [ ] the import cycle above is filed as a finding for the migration plan, because "align implementation
      with the component specification exactly" means merging these thirteen owners into the contract's
      target set, and no ordering rule can disguise that.

## Phase E — contract-alignment phases, in dependency order

Each phase closes a divergence found by auditing implementation against the **locked** contracts, and each
names its own verification. None is started; the order below is the dependency order, not preference.

1. **E1 — remove version-conditional gates.** `platform-execution.ts:14` (`schemaVersion < 5`),
   `initializer.ts:46` (`schemaVersion !== 6`) and `testing/test-paths.ts:36` (`schemaVersion >= 5` path
   layout). Schema validation is the single refusal point. An earlier version of this item also cited
   `coordination-store/session-state.ts:119`; that file no longer exists, and re-checking it is what turns
   a plan line into a fact. Verify: architecture, assignment, task-intake and testing profiles;
   expected-message tests retargeted, not deleted.
2. **E2 — one identity field per concept.** Decide the package-level `repository`
   (nothing requires a package to declare it, while `component-operation-plans.ts:52` non-null-asserts the
   derived `repositoryRoot`), and make the depth-then-`defaultPackage` package resolution explicit about the
   tie it resolved. The #442 empty-path incident is the failure this prevents. Verify: operations, assignment, portfolio, workspace.
3. **E3 — make an activity's `profile` binding, not decoration.** It now selects a profile id at activation
   through `resolved.activities?.[activity]?.profile`, with a component-profile fallback. Verify: steward,
   task-intake, execution-runtime; the shipped frame-equality suite must stay green throughout.
4. **E4 — `project` migration.** Locked `arcnexus/project` supersedes `platform` + `package`,
   `environment.yaml` and `composition-profiles`. Implement the `project` type with `repositories`;
   migrate the platform and package documents in the same phase (both location channels in E2 move once);
   keep the loader able to read captured older authority forms so retained evidence still validates,
   because evidence retention is not configuration versioning. Verify: all owners.
5. **E5 — profile budgets.** #440: the schema stops offering the seven budget properties and the guard
   delegates to `validateSchema` rather than keeping its own forbidden-key list. The fixture half is already
   done on PR #445 — `catalog-fixture.ts` no longer authors budgets, which cleared six suites, and
   `minimal-discovery` now asserts the closed-schema refusal instead of the retired migrate message.
   Remaining: the schema and the guard. Verify: `testing` reaches 0 failures.
6. **E6 — version-named schema identifiers.** 19 schemas still publish `-v1` `$id` URIs. Clearing them is
   contract-visible (identities appear in validation output and captured schema snapshots), so this phase
   needs the architect's decision before the rename, not after. Verify: `validate` with zero findings, plus
   the guidance and contract suites.
7. **E7 — documentation vocabulary.** `component-contracts.md` is titled "Component-owned architecture
   (version 4)"; other titles and prose still carry retired vocabulary. Verify: guidance validation.

 8. **E8 — deliver the evidence reader the gateway already promises.** #450: locked `arcnexus/cli-gateway`
   lists `arcnexus evidence get <id> [--offset] [--length] [--json]` as a delivered command with scenario
   GW-9, and it has never existed. PR #445 retired `workday history|follow|list|get|inspect` onto it (SS4,
   GW-11), so retained workday evidence now has no built reader and the refusal names a command that
   dead-ends. The deleted reader was `workday-command.ts:33,90-106`. Verify: GW-9 end to end through the
   assembled CLI, and the §4 retirement table naming only surfaces a user can actually run. This is not
   polish — a retirement that routes to nothing is a worse interface than the one it removed.
 9. **E9 — fix the contract-to-component map before any completeness claim.** Six locked contracts are owned
   by names absent from the catalog (`architecture-model`, `coordination`, `execution`, `direction`,
   `verification`, `delivery`); several components are claimed by two contracts or by none (`report`,
   `experiments`, `portfolio`, `testing`); and 174 of 179 acceptance scenarios appear in no test or source
   file. Phase C's ratings are meaningless until each component names the contract clauses it is rated
   against, and every phase below is gated on scenario ids rather than suite counts. Verify: the map
   recorded in `docs/audit/components.md`, with scenario-anchored tests added as each phase lands.

## Rules for working this plan

- One phase per turn, verified against the committed tree, with per-owner counts reported as measured.
- A phase is verified by the acceptance scenario ids it closes, not by "the suites are green" — the
  suites do not reference the scenarios today, so green proves nothing about the contract (E9).
- Never batch several phases blind: the recorded failure mode is my #440 batch which took `testing` from 11
  failures to 12 and broke four green owners before it was reverted.
- A claim in a report carries the file and line it was read from. Four invented test filenames and three
  stale production messages were caught by checking `ls`/`git grep` before committing; the habit this plan
  encodes is that check.
- Locked contracts change only under recorded human authority; `docs/interface` is never a formatter target.
