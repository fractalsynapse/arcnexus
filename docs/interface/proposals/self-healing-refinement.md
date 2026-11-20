# Self-healing refinement amendment

Status: **approved and applied; implementation in progress**. Part of
[#615](https://github.com/fractalsynapse/arcnexus/issues/615).

The implementation plan is approved. This record presents its exact contract,
catalog and guidance amendments before changing accepted authority. The product
does not yet provide the new capabilities described here.

## Exact change under review

Review the [complete proposed patch](self-healing-refinement.patch), based on
`fc6df1e8755764adfc133fbc2776257a9c6e1bbb`. Its SHA-256 is:

```text
f33fa43a9d98507ece5563063813bfc72779efd98b265d05be521ebcabe0fb63
```

The architect approved this exact patch in Codex chat and delegated its application
to the implementing agent on the #615 review branch. The patch is retained as the
accepted change record; its contract, registry, catalog and guidance amendments
have been applied. The new runtime host capability must itself be implemented,
validated and delivered before later runs can use it.

The architect remains the authority for objectives, goals and architecture.
Model checked-edit tools still cannot change locks or their registry. The proposed
host exception applies only the exact approved bytes against the recorded
baseline; it never changes the authority of an active capture.

## Observable corrections

| Finding or decision | Continuation |
| --- | --- |
| Invalid model response or failed tool operation | Return the exact error to its caller, retaining successful receipts and complete answers. |
| Same-owner build, type, lint, format or test failure | Repair within the accepted milestone, starting at the earliest affected applicable activity. |
| Steward self-review finding | Rewind to documentation for intent, testing for assertions, or implementation for code; rerun affected downstream work. |
| Missing external knowledge | Request optional research in that actor's component inbox and resume with the complete answer. |
| Another owner, different scope or authority required | Explicitly escalate to Direction; preserve accepted work and original criteria. |
| Final independent rejection | Direction receives the previous plan, rejected criteria and relevant evidence, then changes pending work. |
| Uncertain GitHub effect | Delivery observes the provider before retrying and reuses the existing publication. |
| Publication reveals an engineering defect | Return for accountable repair, refresh affected checks and the verdict, then resume delivery. |
| Repeated unchanged failure with unchanged relevant inputs | Retain an actionable hold or explicit escalation before another identical attempt. |

Ordinary technical repair does not add a Director call, milestone or human
approval. High-level guide changes receive one summary and exact diff per phase.
External prerequisites remain observable holds, rather than requests to approve
routine work. Existing ownership, confinement, original acceptance, independent
verification and configured staging gates remain enforced.

## Public capability and authority changes

| Boundary | Proposed change |
| --- | --- |
| CLI, locked | Add `architecture update [<feedback>]` and `refine [--rounds <N>]`, with the general `--json` option, cancellation and durable pending decisions. N defaults to one. |
| Architecture, locked | Add assessment, exact approval and host-only protected application; deliver prerequisite implementation within Architect before a fresh Run capture. |
| Direction, locked | Replace DI-7's correction-milestone requirement with local activity repair; retain initial planning, explicit escalation and final-rejection revision. Preserve completed outcomes and original acceptance. |
| Execution, locked | Preserve diagnostics, answers and single-file receipts across repair; select applicable quality operations; record real native observations and revalidate retained work after approved authority changes. |
| Coordination, locked | Extend the existing project writer and SQLite journal across sequential refinement phases; retain approvals, inventories, task identities and cursors. |
| Verification, locked | Distinguish local feedback from final rejection, repair invalid verdict output at the Reviewer, and reuse scoped observations only when their declared inputs still match. |
| Delivery, locked | Reconcile uncertain effects locally and return candidate defects for repair and refreshed verification, retaining one issue and publication identity. |
| Commands, proposed | Add transport-neutral `updateArchitecture` and `refine` operations. |
| Workflow, proposed | Own local rewinds and the outer Plan → Architect → Run sequence through the canonical lifecycle. Preserve its proposed stage. |
| Planner, proposed | Assess prior round findings; propose one objective/goal diff or justified no change. Keep owners and results out of goal records. |

The registry amendment retains prior identities and stages, updates every changed
contract's digest and scenario count, and distinguishes refused agent edits from
explicitly approved host application. It does not turn a proposed contract into
a locked one.

The catalog selects `architecture/updating` as the project's Architect activity.
Its explicit mapping uses `gpt-sol` and read, question, research and supplier
operations. It grants no model edit capability. The shared Director and steward
roles and plan template describe the corrected routing once, for reuse by their
existing component activities. Existing research and implementation profiles stay
unchanged.

The included AGENTS, ArcNexus skills, interface guide, development direction,
knowledge guide and qualification amendments refer to these same boundaries.
Inherited generic skills remain untouched. Native and component-quality operation
bindings must be implemented and validated before those capabilities are claimed
available; this proposal does not invent successful observations.

## Implementation and acceptance after approval

Apply the approved intent before product code. Establish focused failing public
regressions, implement local recovery and applicable checks, and prove one real
same-milestone correction reaches staging through one PR. Then implement Architect
assessment and prerequisite delivery, followed by durable refinement using the
same task lifecycle and project writer. No second scheduler, database or recovery
engine is introduced. Remove superseded Direction-on-every-failure behavior.

Test ordinary tool failures, distinct successive check failures, self-review
rewinds, explicit escalation, independent rejection, optional research, complete
answer reuse, stale or forged approval, missing handlers, native observations,
interrupted phases and single-file checkpoints, and uncertain publication.
Deliberate interruption tests precede the uninterrupted acceptance streak.

Reconcile retained interrupted work without deleting its failed observations.
Bootstrap only a named missing capability that prevents platform-led work and
follow each delivered capability with a demonstration through ArcNexus.

Finally run the production `arcnexus refine --rounds 3`. Each round assesses Plan
and Architect and invokes the Director for every captured approved goal. Across
the streak require actual approved guide improvement, useful staged implementation
and later consumption of prior findings. Justified no change and handled internal
repairs are valid. Operator state repair, bypassed checks and uncontrolled aborts
break the streak. Execution-path changes restart qualification.

Retain phase assessments, approvals, repair routes, Direction invocations and
request sizes, runtime identities, checks, PRs and staging commits in external
application evidence. Report static checks, deterministic tests, native enforcement,
CI and live qualification separately. Current live acceptance is **0/3**; this
proposal establishes no implementation or qualification result.

Main integration, tags and releases remain separate maintainer actions.

## Proposal verification

`npm run check:specification` passed on the proposal branch. `git apply --check`
accepted the proposed patch without applying it. An in-memory check of its future
contents verified all ten changed contract digests and scenario counts, unique
scenario IDs, retained prior identities and stages, YAML, ownership, local links
and the Architect activity binding. Before application, the active locked bytes
and registry matched the base revision.

The guidance walkthrough follows an ordinary failed check to local repair,
cross-owner work to explicit escalation, and final rejection to Direction. The
proposed approval path retains an unanswered proposal and refuses candidate-side
authority. These are specification checks, not demonstrations of the future
runtime. Product tests and live refinement have not run for this amendment.
