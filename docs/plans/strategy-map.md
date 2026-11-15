# Strategy map: the architecture as the guide for everything else

**Authoring rule for this document, and for any document written against the architecture:** it states no
counts or quantities — no file totals, no owner totals, no scenario totals. Those drift the moment anyone
edits the model, and a stale number in a guide is worse than none, because it is read as authority. The
only quantities allowed in project documentation are the maintained-source and method length limits in
`docs/foundation/typescript-standard.md`, which are fixed rules rather than measurements. This document
also avoids comparing documentation to implementation: the implementation is being rebuilt, so only the
architecture's own consistency is recorded here.

What the architecture is, in the order an implementer should read it:

1. **`.arc/architecture`** — the human-authored model. The machine-read statements of what exists:
   components and their ownership, roles, operations, standards, execution and test profiles, the
   environment, and `plan-template.md`. This is the guide. Everything below either serves it or is
   evidence about it.
2. **`docs/interface`** — one contract per concern, walked `project → foundation → gateway → libraries →
   release`. A locked contract is architecture; only the architect changes it, and its acceptance
   scenarios are the tests that drive implementation. `registry.yaml` records stage and content digest for
   each; identity is the digest, not an ordinal.
3. **`docs/plans/agent-harness.md`** and **`docs/plans/agent-test-strategy.md`** — both headed "Status:
   architecture, authoritative". No contract owner field points at them, so an implementer working from
   `docs/interface` alone misses the harness and test-layer rules entirely. Read both before designing any
   activation, context assembly or test tier.
4. **`docs/plans/self-development-mvp.md`** — the accepted target architecture and its reduction batches.
5. **`AGENTS.md`, `docs/charter.md`, `.arc/README.md`** — how work is directed, what the project is for, and
   which `.arc` space belongs to which author.
6. **`docs/foundation`** and **`docs/release`** — prescriptive: the executable quality contract, the
   readable-TypeScript standard the model binds, and CI/verification policy.
7. **`docs/library`, `docs/gateway`, `docs/acceptance`** — **ledger and evidence.** History of what was
   built, with issue citations. Not requirements. Read them for context, never as the specification, and do
   not let a ledger line outrank the model.

## What the architecture prescribes for the rebuilt implementation

- **One project, not a platform and package pair.** The project contract supersedes the `platform` and
  `package` component types, `environment.yaml`, `composition-profiles`, and portfolio registration as
  something a user must learn. A clean implementation declares one project document carrying repository,
  knowledge root, catalog and lane, and does not re-introduce the superseded types.
- **Ownership is the only write authority.** A component's `owns` is what grants writes; containers own
  nothing; a component does not own its own definition, so the model root has a single steward. Derived
  fields (`path`, `access`, `allowedWritePaths`, verification) are never authored — a document carrying
  them belongs to no schema branch and must be refused.
- **Roles are positions, components are owners.** A role states standing duties, instructions, standards
  and tool surface for an activity, and is reused by every component engaging it; it grants no write scope
  and carries no activities of its own. Activities belong to the component that engages them.
- **The Steps and the activity vocabulary are different sets.** `plan-template.md` defines the Steps —
  Documentation, Design and contract tests, Implementation, Review, Integration — mapping to the activities
  `documentation`, `testing`, `implementation`, `review`, `release`, while `research` is a Step-shaped
  activity available to every milestone. The vocabulary is therefore wider than the Steps: a build that
  treats the Steps as the whole activity list has no home for research work.
- **Operations are the single home for commands.** Each operation declares command, arguments,
  prerequisites, generated directories, network and category. Prerequisites are declared, not discovered,
  and an operation bound with `agent` usage must appear in a declared activity of the component.
- **Standards are short shared rules attached per activity**, and are the only mechanism that propagates a
  lesson between stewards: learning proposal → architect acceptance → `.arc/architecture/standards` →
  inherited by everyone performing that activity.
- **Profiles select model and permitted operation categories**, resolved nearest-declaration-wins up the
  lineage; an activity's `profile` selects at activation rather than decorating the document.
- **Acceptance scenarios are the test plan.** Every contract row is a stable scenario id; a locked
  contract's scenarios are what implementation is written to satisfy, and a test is named for the scenario
  id it closes. This is how traceability survives a rewrite: the ids are already authored and frozen in
  `docs/interface`, so the new build inherits its acceptance list rather than inventing one.

## The state of the model itself

The model is **internally clean and pointed at the wrong target**. Parsing `.arc/architecture` as a graph
finds no broken references: every parent, director, reviewer, default package, role, operation, standard,
profile and declared public path resolves; no two components claim the same path; no document repeats a
key; and every contract digest in `registry.yaml` matches the bytes it describes. This is not a rotting
model — it is a coherent model of a system that is about to stop existing.

What is missing or wrong inside the model, in the order it will bite the rebuild:

1. **No delivery policy, though the contracts read one.** `.arc/README.md:12` lists delivery-policy
   definitions among the contents of `.arc/architecture`, and the release, delivery, collaboration-provider,
   execution and architecture-model contracts all depend on that policy for publication targets and the
   single route. No such document exists in the model. A fresh implementation has to invent one, and
   whatever it invents will disagree with the contracts that already assume a specific shape.
2. **`measures` cannot be authored.** The project contract requires objectives and constraints *with
   measures*, and the coordination contract makes a missing measure a validation finding. The model's
   component documents carry plain strings with nowhere to put a measure. So the required evidence of
   whether an objective was met cannot exist, and no rebuild can satisfy that clause while the schema of the
   model has no place for it.
3. **The container types are still authored.** The project contract supersedes `platform` and `package`;
   the model still declares one of each and has no project document. Every inherited default, source root
   and repository identity in the catalog hangs off those two documents, so retiring them is a re-authoring
   task, not a deletion.
4. **Superseded model files are retained.** `environment.yaml` and `composition-profiles/local.yaml` are
   declared obsolete by the project contract, and the composition profile still speaks the retired container
   vocabulary internally.
5. **The model orders the rebuild to preserve what the contracts delete.** The architecture-model contract's
   migration table deletes the component constraints that require preserving historical versions and
   captured execution readers, precisely because they make deletion a policy violation. Those constraints are
   still authored in a majority of the container-adjacent owners. Read as-is, the model instructs every
   steward to keep superseded machinery — the single most consequential line in this document.
6. **The Integration Step has almost no owners.** `plan-template.md` requires every milestone to carry all
   five Steps and maps Integration to the `release` activity; the architecture-model invariant says a
   component declares what it supports. Only the publication and release owners declare a `release`
   activity, so nearly every owner is structurally unable to complete the plan form the director is
   required to generate. Either the template scopes Integration to owners that can deliver, or the model
   must author that activity broadly.
7. **An execution profile is declared that nothing selects**, while several documents claim it performs
   direction or review. The charter records an intent for that profile as a supervisor; the platform
   document selects a different profile for director and reviewer. This is an architect decision about
   which is authoritative, not an edit.
8. **Ownership claims point at content the rebuild replaces, and at some that never existed.** Most owners
   claim paths under the source, test, script and evidence trees — those claims must be re-cut with the new
   layout or the "every tracked file has exactly one owner" rule will refuse the tree. A few claims name
   directories the project has never had, and the `docs/audit` claim outlives the directory being removed.
9. **The knowledge spaces have one writer each, while the guidance expects many.** `.arc/learning` and
   `.arc/plans` are owned by a single component apiece, but AGENTS.md, the plan template and the
   architecture-model contract all require every steward to record there. Either authorship is a component's
   exclusive right, or ownership of those spaces is a directory policy rather than a claim.

## Where the documentation contradicts the architecture

Each of these is a documentation defect against the model and contracts — no implementation claim.

1. **Revision ordinals.** Some prose still says a contract is "locked at revision *n*". Ordinals were
   retired: contract identity is the content digest recorded in `registry.yaml`. Say "locked" and cite the
   digest only if the exact version matters.
2. **Superseded paths.** Several documents still cite `architecture/…` for model files. The model lives in
   `.arc/architecture`. Note that the project contract's own supersession line names the pre-move paths as
   well, so the contract text and the model disagree about *which* file is retired — an architect
   correction, not an editor's.
3. **`docs/gateway/cli/stewards.md` documents reserved verbs as live commands** (`workday start`, `pause`,
   `resume`), which the gateway contract reserves and the single-lane rule supersedes. This file will
   mislead a fresh implementation about what the CLI is allowed to offer.
4. **Version-named vocabulary survives in titles and prose** — "Component-owned architecture (version 4)",
   "Historical …" documents, `schemaVersion`-conditional explanations, and references to migration
   readers. The architecture carries one version of each document kind and no migration machinery; a guide
   that mentions migration implies the new build must implement it.
5. **Ledger read as specification.** `docs/library/**` mostly records increments and issue numbers rather
   than obligations, and a few library docs state requirements the contracts already moved on from (for
   example, requiring activity membership where the testing contract treats profile references as
   authorization). Mark the ledgers as history explicitly so nobody treats them as requirements.
6. **Cancelled constraints still authored in the model.** Several component definitions still carry
   constraints requiring preservation of historical versions and captured execution readers, which the
   architecture-model contract lists as deleted precisely because they make deletion a policy violation.
   This is the model contradicting itself — the single most dangerous item here, because the new
   implementation would inherit the instruction to keep what the architecture orders removed.
7. **The registry header's enforcement note** describes digest comparison as a future follow-up, while the
   contract-protocol history records it as delivered. Stale self-description in an authority file.
8. **`plan-template.md` is recorded `proposed`** while every plan, Step and checklist is shaped by it and
   AGENTS.md points at it as the definition. Either lock it or say what stage it is allowed to be quoted at.
9. **Owner names that are not components.** The library contracts name owners that the catalog does not
   contain, because they describe the consolidated target ownership. That is legitimate architecture, but
   any statement of *how many* owners the target has belongs to the model, not to prose: AGENTS.md and the
   MVP document express a preference for a small number of owners, and no contract fixes a count. Do not
   read a target owner count into the contracts.
10. **Concerns without a contract.** The registry keeps some library contracts in a waiting queue while the
    model already declares components for those concerns; the foundation contract defers suite registration
    and test selection to one of them. So a fresh build has authored model but no authored acceptance for
    that behaviour. That is a sequencing decision for the architect, not something implementation can infer.
 11. **The MVP direction understates the vocabulary.** `docs/plans/self-development-mvp.md` states that "the
     five Steps are the activity vocabulary", while `plan-template.md` — the authority that sentence cites —
     maps the Steps to their activities and keeps `research` outside the Step set, available to every
     milestone. So the MVP document equates two different sets. Either it distinguishes them, or the
     template drops `research` from the vocabulary. A build following the MVP sentence has no activity to
     bind research work to, and no plan can declare a research milestone.
 12. **The plan template cites an authority the model no longer has.** `plan-template.md` says the activity
     vocabulary is what "the role definition declares", but roles declare no activities: the activity-model
     rulings moved activities onto the component that engages them, and the role schema has no `activities`
     property, so a role document carrying one is refused as invalid. This matters more than most items here,
     because the template is what a director reads when deciding what a plan may declare. Fix the sentence to
     cite the component catalog.

13. **The authoritative harness document names a role the model does not declare, and omits one it does.**
    `docs/plans/agent-harness.md` states that there is one role per activity and lists `tester` among them;
    the model declares no `tester` role and does declare `reviewer`, which the harness list omits. Since the
    architecture-model invariant makes the role list the authority for what an activity can bind, a clean
    implementation following the harness would author a component activity against a role that validation
    refuses. Fix the harness wording or add the missing role — the model and the document cannot both stay
    as they are.
14. **`README.md` sends readers to a guide that contradicts the gateway contract.** It links
    `docs/gateway/cli/stewards.md` as the execution guide, and that file documents reserved verbs as live
    commands, retired options as current, the retired profile as active, the pre-move model location, and a
    declared package default the contract does not promise. The pointer is the defect here: the guide it
    names is not trustworthy until rewritten.

## Documentation disposition for the rebuild

Applying the rule that a ledger is not a specification, the documentation splits into three groups. No
counts here — the lists are what matters, and they change as files are merged or archived.

- **Specification, keep and correct.** `docs/foundation/quality.md`, `typescript-standard.md`,
  `scope-execution.md`; `docs/release/ci.md` and `verification.md`; `docs/library/steward/execution-contract.md`;
  `docs/library/coordination-store/coordination-store.md`; `docs/library/change-inspection/candidate-changes.md`;
  `docs/library/guidance-validation/guidance-validation.md`; `docs/library/agent-guidance/guidance-maintenance.md`;
  `docs/library/testing/component-tests.md`; `docs/library/workspace/candidates.md`;
  `docs/plans/agent-harness.md` and `agent-test-strategy.md` (after the role-name and budget wording below);
  `docs/plans/self-development-mvp.md`; this file.
- **History, archive rather than delete.** `docs/acceptance/**` (evidence of past runs), the dated
  qualification and retrospective records, the "Historical …" documents, and the per-issue ledgers under
  `docs/library/**`. Archive them so a newcomer cannot mistake an increment record for a requirement; do not
  cite them as authority in a plan.
- **Contradictory now, so remove from the reading path.** `docs/gateway/cli/stewards.md` — it is the guide
  `README.md` sends people to, and it documents reserved verbs as live commands, retired options as current,
  a retired profile as active, and the pre-move model location. Until it is rewritten, it should not be
  linked as guidance. `docs/dev.md` carries the same problem for the removed interfaces and the old
  stage machine.

## Contradictions inside the locked contracts — architect only

These cannot be fixed by editing documentation, because both sides are locked architecture. Each needs your
ruling, and until then a clean implementation has no lawful answer.

1. **How wide the retirement goes.** The gateway contract's migration table retires the
   `platform`, `package`, `config`, `workspace`, `delivery`, `experiment` and `guidance` commands
   **as families**, while its retired-commands section retires only specific verbs from those families
   (`config migrate`, `workspace prepare/cleanup/list/get`, `delivery approve/publish/promote`,
   `experiment inspect`, `guidance validate/run`) — and its reserved-names section reserves
   `delivery status` as the read-only view of a published candidate. So the same command family is
   wholesale-retired in one table, partly-retired in another, and partly-reserved in a third. A clean
   implementation cannot tell whether `config get`, `workspace list` or `delivery list` are supposed to
   exist. Only you can settle the scope; an editor cannot, because both readings are locked text.
2. **An option both delivered and rejected.** The command synopsis accepts `--activity` on
   `task run --component`, while the rejected-options list refuses `--activity` on the ground that
   "activity is positional" — a rule the synopsis itself does not follow for that command.
3. **Implementation inventories inside locked text.** The migration tables and current-state rows carry
   module counts, subcommand counts, option counts, reserved-name totals that disagree with the
   reserved-names list they summarise, and file-by-file inventories of the codebase. The contract protocol
   states that a contract says what a component **owes** and "never states how that component is
   implemented" — so this content is outside what a contract may assert, and your deletion turns each of
   those rows into a false statement inside a locked document. Restriping the contracts to services,
   invariants and scenarios is the correction, and it is yours to make: locked text is architecture.
4. **Pre-move paths inside the project contract.** The supersession and migration wording cites the old
   repository-root model location while the rest of the same file cites `.arc/architecture`. One of the two
   is wrong, and it determines what the new build is told to remove.
5. **A required service with no described shape.** The project contract names a project document and a
   delivery policy, and neither has an authored shape anywhere. The new implementation cannot satisfy a
   requirement that has no fields.
6. **Deferred authority that does not exist yet.** The foundation contract defers suite registration and
   test selection to a library contract still sitting unwritten in the registry queue, while the coordination
   contract makes a missing `measures` value a validation finding that the architecture-model contract's list
   of finding families does not include.
7. **Which profile directs and reviews.** The model selects one profile for the director and reviewer while
   the charter records intent for a different one, and documentation claims the unused profile is active.
8. **Who writes the knowledge spaces.** The architecture-model contract's change-proposal service writes into
   `.arc/learning`; the plan template and AGENTS.md require every steward to record there; the catalog gives
   that space a single owner.
9. **The Step and activity vocabularies.** The MVP direction equates the Steps with the activity vocabulary
   while the plan template keeps a sixth activity outside the Steps, and the guidance documents repeat the
   five-Steps framing. The new build's plan shape depends on which statement is authoritative.

## Open decisions, for the architect

1. Re-cut `components/` to the ownership the library contracts describe — the decision every other
   correction follows from, and it is a `component` milestone rather than an edit.
2. Delete the historical-preservation constraints from the model, so the model stops instructing stewards to
   preserve superseded machinery.
3. Correct the project contract's supersession paths, its "activity profile map" wording where the model
   now states a per-activity profile, and the registry's stale enforcement note.
4. Lock `plan-template.md` or state the stage at which it may be quoted as authority — and while
   it is open, correct the sentence that attributes the activity vocabulary to the role definition.
5. Write, defer or retire the queued library contracts — starting with the one that foundation explicitly
   defers test selection to, since the new build's whole test plan hangs on it.
6. Decide what `measures` on objectives and constraints, and the delivery policy service, mean in an
   authored document, since the project contract requires both.
