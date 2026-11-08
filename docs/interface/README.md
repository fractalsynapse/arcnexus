# Component contracts

This directory holds the interfaces between components. Contracts are finalized before the
implementation is cleaned up, so that cleanup has a fixed target and acceptance tests can
anchor behaviour instead of chasing it.

A contract states what a component **owes** to the components that depend on it. It never
states how that component is implemented. Implementation may be rewritten freely while the
contract holds; changing a contract is an architectural act.

## Stages

| Stage | Meaning | Who may change it |
| --- | --- | --- |
| `draft` | Being written. Not reviewable. | Any agent within its owner's scope |
| `proposed` | Complete and ready for architectural review. | The owning steward, in response to review |
| `locked` | Accepted. The interface is fixed. | **Only the human architect.** An agent may propose a change through a `component` milestone; it may not edit a locked contract |

Locking is recorded in [`registry.yaml`](registry.yaml): contract id, file, stage, revision,
content digest, who accepted it and when. A locked contract whose digest changes without a
new registry entry is a validation finding. Enforcement of that rule is a listed follow-up;
until it exists, the rule is stated authority, not a checked guarantee.

After a lock, the acceptance scenarios in that contract are the specification. A change
request must add or amend scenarios **before** the interface text, so tests lead the contract
rather than follow it.

## Contract adherence is the first act of any request

These contracts are the absolute source of truth for what a component must support. An agent
working in this project runs the check below **before** any action that modifies the codebase.
Read-only analysis, review and answering questions do not require it.

1. **Validate the request against the relevant contracts.** Name the contract files and the
   clauses that govern the paths, interfaces and behaviour the request would change. Consult
   `.arc/architecture/` for boundaries and the registry for stage.
2. **If the request is consistent, proceed** within the owner's write scope.
3. **If the request conflicts, counter it before acting.** State the conflict in one short
   exchange: the clause, what the request would break, and the two available resolutions —
   change the request, or change the contract through recorded human authority. Then stop and
   wait. Do not partially comply, do not work around the clause, do not open a pull request
   that quietly crosses it, and do not assume the requester meant to override it.
4. **The human decides.** Only after that decision may anything change. A contract change is
   recorded in the registry with a new revision, digest and reason; a request change is simply
   re-planned.
5. **Silence is not consent.** If the decision is unavailable, do the work that does not
   depend on it and leave the conflicting part explicitly outstanding, with the clause named.

Counter-ing a request is not disobedience to the human. The human owns purpose, boundaries and
approved architecture, so an agent that silently damages a locked interface is the one that
broke the instruction. Drift starts as one small "just get it working" exception; this rule
exists to catch it at the first request instead of after nine days of divergence.

## What counts as contract surface

Anything a change to could break an external dependent or an internal relationship:

- names, arguments and outputs that a user, another component or an agent can call
- persisted shapes that outlive one run: stores, records, evidence, plan and learning files
- ownership boundaries and the authority rules attached to them
- exit codes, error kinds and their meaning
- check and verification interfaces, including what a passing result proves

Types, private helpers, file layout inside an owner's paths, and internal call order are not
contract surface. Do not lock what you have not needed to depend on.

## Naming

One file per contract instance: `docs/interface/<project>-<component>.md`, for example
`arcnexus-foundation.md`. The file header carries its type contract (`project`, `foundation`,
`gateway`, `library` or `release`), which defines the required sections below.

Every contract has the same sections: **Identity**, **Depends on**, **Provides**,
**Invariants**, **Ownership**, **Acceptance scenarios**, **Migration**, **Non-goals**,
**Lock record**.

## The graph and the walk

Contracts are walked from the outside in, so each stage is fixed against what already depends
on it and constrains what comes after:

```text
project ──┬── foundation ──┬── gateway (CLI) ──┬── libraries ── release
          │                │                   │
          └────────────────┴───────────────────┴── release
```

1. **Project** — identity, knowledge structure, ownership map, delivery policy. Nothing may
   depend on a component until what a project *is* is settled. This replaces platform and
   package.
2. **Foundation** — the shared build, type-check, format, lint, quality and test-selection
   substrate every other component consumes.
3. **Gateway** — the CLI. The first behavioural surface, and where user-visible acceptance
   tests anchor. Decided after project and foundation because its arguments are typed in
   project identity and check selection.
4. **Libraries** — one contract per component SDK, in dependency order: architecture model,
   coordination, execution, direction, verification, delivery, report, guidance, testing.
5. **Release** — delivery, integration and deployment verification, which depends on the
   gateway and on the delivery and verification library contracts.

Each stage ends with the architect locking its contracts. Later stages may reveal a defect in
an earlier one; that is a change request against a locked contract and needs your recorded
authority, not a silent edit.

## From contract to test

Every invariant gets a scenario id. During cleanup, each scenario becomes one deterministic
test in the owning component's suite, named after the scenario, with the contract's stated
observation as its assertion. A scenario that cannot be tested deterministically is either
made testable or is recorded as a live-qualification scenario and is not claimed as covered.
A suite whose scenarios no longer match its contract is a finding against the contract's
stage, not a reason to edit the contract.
