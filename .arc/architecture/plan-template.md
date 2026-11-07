# Plan template

This is the contract for planning work in ArcNexus. The director is handed these categories
as its **generation** instructions, stewards receive them as their **working** instructions,
and the independent reviewer uses them as its **checking** instructions. It is architecture,
so the architect owns it; plans generated from it are agent work and live in `.arc/plans/`.

A plan is one file per goal. It always has a Focus block and an ordered list of milestones,
each milestone carrying the five Steps.

## Provenance of the Focus block

| Field | Source | Rule |
| --- | --- | --- |
| Purpose | The goal the human supplied | One sentence naming the outcome the user will observe, never the implementation |
| Objectives and measures of success | The director, from the goal | Written as evidence that must exist, not as effort |
| Constraints and measures of failure | **Copied from the component's architecture** | The director may not invent, weaken or drop a constraint; each carries the observation that means this milestone failed |
| Exclusions | The director | What this goal will not touch, and why |

## Categories, prompts and checks

| Category | The director must produce | This drives the steward to | The reviewer checks |
| --- | --- | --- | --- |
| Purpose | One observable outcome sentence | Work toward the outcome, not a described approach | Is it observable from outside the code? |
| Objectives + measures of success | For each objective, the artefact that proves it | Produce that artefact | Does every measure have a real artefact? |
| Constraints + measures of failure | Each architectural constraint with the observation that means failure | Stop and report instead of crossing a named line | Was any failure recorded as success? |
| Exclusions | The boundary this goal will not cross | Stay inside it | Did the diff stray? |
| Milestone owner | Exactly one existing owner, or a `component` proposal awaiting the architect | Discover which owned files need changing; request, never edit, outside them | One accountable owner, no shared write set? |
| Documentation step | Instruction: record the changed intent in owned documentation before behaviour changes | Write the intent first | Does the document describe intent rather than the diff? |
| Design and contract step | Instruction: state the acceptance as a failing test against the component's public contract and record the observed red | Write the red test before implementing, keep it as evidence | Was red actually observed against the pre-change base? |
| Implementation step | Instruction: the smallest change that turns the recorded red green, plus the checks that keep it owned and scoped | Implement, run owner-scoped checks | Net new concepts versus removed ones |
| Review step | Instruction: one independent verdict against the acceptance ids, from bounded evidence | Self-review inside the engineering turn; do not open a duplicate review assignment | Does the verdict cite criteria and evidence, not prose? |
| Integration step | Instruction: staging PR, CI, required review, merge identity; name human gates instead of routing around them | Deliver through the one route | Is the merge identity recorded? |
| Checklist items | `{id, step, criteria: [acceptance ids], text, evidence}` referencing acceptance by stable id, never by index | Mark status with the evidence that supports it | Does every acceptance criterion have at least one item? |
| Simplification ledger | Instruction: name what was removed, what was unified, what was retained and the demonstrated requirement for retaining it, plus the one-hour answer | Delete before adding | Positive net concept delta with no cited requirement is a failed measure |

## The five Steps

Every milestone carries all five. A Step may be declared `not-applicable: <reason>` **by the
plan**, never silently skipped by a steward.

1. **Documentation** — intended behaviour recorded before behaviour changes.
2. **Design and contract tests** — the acceptance expressed as an interface or contract test,
   observed failing. Behaviour-preserving work may characterise existing behaviour instead;
   documentation-only work uses document validation.
3. **Implementation** — the change plus owner-scoped checks.
4. **Review** — one independent read-only verdict against acceptance and the Focus measures.
5. **Integration** — delivery through staging, with CI and required review as observed gates.

Each Step runs as its own activity, and the activity selects the execution profile, so a
milestone can be documented and designed with one model, implemented with another, and
reviewed by a third without any scheduling machinery.

## Checklist item shape

```text
id          stable string, unique in the plan; never reused, never an index
step        documentation | design | implementation | review | integration
criteria    acceptance ids this item proves
text        what must be true, written as an observation
evidence    artefact ids, or the reason none exists yet
status      pending | done | failed | not-applicable
```

Progress claims are the steward's assertion until the host verifies them. A criterion index
is not an identifier: when acceptance is edited, indices shift and old evidence silently
points at the wrong thing.

## Sequence rules

- Milestones are strictly sequential and each has one owner. Work that needs another owner
  becomes the preceding milestone, not a parallel dependency.
- Only the director changes sequence or scope. A steward may propose a change; the proposal
  is recorded and the rewritten plan is the record of the decision.
- A run stops honestly at `blocked: awaiting <named gate>` when a checklist item can only be
  satisfied by a human. That single outcome replaces a pause, retry, promotion and recovery
  state family.
- The plan is updated at every Step close and every milestone close: status, evidence
  references, measures (time, attempts, added and removed lines) and any learning record.
- Failing-test-first is the default for behaviour change. It is not manufactured for
  documentation-only work or coverage alone, and a Step may declare it not-applicable with a
  reason that the reviewer sees.

## Milestone kinds

`plan`, `feature`, `refactor`, `guidance`, `skill`, `component`, `scaffold`, `release` and
`verify-release` are the same lifecycle with different owners of the outcome. `component`
proposes a new owner and waits for the architect. `scaffold` adopts the shared guidance
package into a target project and stops at that setup boundary. `verify-release` reads the
release identity, runs the delivery policy's live checks against what is actually deployed,
and writes the learning record that feeds the next cycle's `guidance` and `skill` milestones.
