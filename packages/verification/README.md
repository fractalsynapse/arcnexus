# Verification

Verification binds engineering acceptance to the assembled work and its captured
requirements. This reference is for maintainers implementing recovery and consumers
deciding whether retained evidence can authorize the candidate now being delivered.
The [locked contract](contract.md) governs the gate, especially VI-3, VI-5, VI-12,
VI-18 and VI-19. The rules below record implementation intent for
`recovered-acceptance-binding`; they do not establish passing runtime behavior.

## Assess the recovered identity

Consume the recovered staging base and approved capture supplied by
[Execution's prepared-checkpoint recovery](../execution/docs/prepared-checkpoint-recovery.md).
Use the actual assembled candidate and retained session relationship. Do not
reconstruct an assignment-shaped substitute or infer the engineering base from
the verification checkout.

Keep these identities distinct in the assessment record:

| Identity | Meaning |
| --- | --- |
| Candidate tree | Exact assembled source being checked and independently assessed. |
| Recovered staging base | Observed staging parent against which this contribution is evaluated and delivered. |
| Approved capture | Current authority, including ownership, instructions, operation bindings and completion obligations. |
| Captured acceptance | Full accepted criteria and their meaning, preserving the original goal and requirements. |
| Evidence and environment | Actual observations, resolved inputs and runtime conditions supporting this assessment. |

Matching tree bytes alone cannot recover an accepting verdict. A change to the
staging base, approved capture or captured acceptance also makes earlier acceptance
inapplicable, even if criterion IDs and source bytes remain identical. Compare the
captured requirements, not just their names. Obtain a fresh independent assessment
against the recovered identity after its required evidence is available. Approval
of the earlier candidate or capture does not authorize the recovered candidate.
Only a matching complete assessment identity, evidence and environment can recover
the same retained verdict without another assessment. A new worktree path alone
does not change those inputs.

Retain the original base, capture, criteria, evidence and verdict with their actual
identities in [Coordination](../coordination/contract.md). Append the recovered
relationship without rewriting the earlier observation as though it used today's
authority. Preserve the existing task, issue, secured checked bytes, receipts and
verbatim human answers, including meaningful whitespace. An earlier answer remains
task input; its retention does not turn earlier approval into current authorization.

The accepted plan remains authoritative. Goals describe desired outcomes; results
belong in evidence and learning. Reconcile newly applicable acceptance with the
preserved original requirements. A required boundary or acceptance change follows
the architectural authority route and retains the decision and gate evidence.
Verification cannot weaken acceptance or grant foreign edit scope. Execution
enforces newly captured ownership and retains conflicting work before overwrite.

## Resolve the applicable checklist

Select declared operations using the current capture and their category,
applicability, prerequisites and effective typed parameters. Activity completion
checks provide engineering feedback before progression. Required assembled checks
evaluate the combined candidate and remain separate obligations.

A component without a suite is valid. That suite's absence does not suppress
applicable formatting, lint, strict types/build or required assembled checks.
An optional owner suite cannot replace relevant integration coverage. Retain the
reason for each applicability decision. An explicit test selection matching no
cases, a disabled required native case and an optional absent suite have different
meanings.

After recovery, execute newly required checks and refresh affected observations
using current resolved inputs. Matching operation IDs do not establish equivalence:
owner, tag, level, path, working directory, native selection, parameter overrides,
dependencies, authority and environment can change what ran. Unknown input coverage
requires conservative verification.

Reuse an unchanged scoped observation only when its recorded relevant inputs,
resolved binding and environment still match and its complete evidence remains
retrievable. Explain that match in the retained record. An unrelated source edit
need not invalidate a demonstrably unaffected scoped check. Such reuse does not
make the earlier full-candidate verdict applicable to a changed recovery identity.
Use the existing check and journal path rather than another evidence cache.

Missing, skipped, unavailable or failed required evidence prevents acceptance.
Retain the exact diagnostic and prerequisite instead of silently dropping the
operation or interpreting a zero exit with no relevant cases as proof. Preserve
expected-red and deliberate refusal observations with their original interpretation;
historical red does not replace required current passing evidence.

### Route observed failures to correction

For `recovered-check-applicability`, the intended correction distinguishes an
ordinary numeric check failure from missing, skipped or unavailable required
evidence. A completed assembled check with a nonzero numeric status must reach
independent assessment with its complete diagnostics, current resolved inputs and
retained history. Verification must not return a terminal `blocked` result for
that ordinary failure before the Reviewer can assess it. Missing, skipped or
unavailable required evidence retains its explicit hold and exact prerequisite.

Reaching assessment does not make failed evidence acceptable. Preserve the
failed-check acceptance guard: an accepting response cannot authorize delivery
while a current required check fails. A valid independent rejection names the
deficient accepted criterion, accountable owner and supporting evidence.
[Workflow](../workflow/contract.md) passes that rejection to
[Direction](../direction/contract.md) for correction within the existing task.
Ordinary component feedback failures still return to their accountable activity;
they do not independently invoke Direction. Invalid Reviewer responses return to
the same assessor for response repair. Preserve the original acceptance and all
historical observations through each route.

The distinguishing public regression uses the actual assembled Verification entry
with real Git and SQLite records, a controlled numeric failed check and a valid
criterion-linked independent rejection. It must observe the Reviewer receiving
the failed evidence and Verification returning `rejected`, allowing the existing
correction lifecycle to proceed. Companion assertions must refuse acceptance over
that failed check and retain explicit holds for missing, skipped or unavailable
required evidence. Keep stale-identity refusal and recovered-check applicability
coverage intact. These are intended observations for Testing and Implementation;
this documentation does not establish that the runtime correction has passed.

## Give the independent Reviewer complete inputs

Retain each operation's binding and override provenance, command and arguments,
working directory, relevant source references and input identity, execution status,
complete diagnostics and readable log, timestamps and duration, environment,
versions and attribution. Keep its candidate and authority relationship explicit.
A passing operation supports assessment; it is not an independent verdict.

Supply the [Reviewer](../reviewer/contract.md) with the original goal, preserved
requirements, current captured acceptance, recovered candidate relationship and
complete authorized historical observations by reference. Include original findings,
failed attempts, exact human questions and answers, receipts and current applicable
checks. Do not replace complete source material with a later repair summary.
Retain the actual Reviewer request, identity, selected profile, evidence references
and input identity with its verdict.

The Reviewer remains independent and read-only. Invalid response shape or citations
return to that same assessor with the exact diagnostic while the candidate and
unchanged checks remain intact. Substantive rejection routes criterion-linked
findings through Workflow and Direction for accountable correction. A corrected
candidate needs affected evidence and an applicable independent verdict.

Native/provider observations use declared
[Execution operations](../execution/contract.md). Controlled provider responses,
real Git/Coordination integration, native confinement, live inference and hosted CI
are distinct evidence categories. Fixture execution cannot establish live acceptance.
Complete artifacts remain readable without sampling, truncation or an invented
content or attempt limit. An external harness refusal remains an unavailable
observation with its actual cause.

## Hand off the reviewed candidate

[Delivery](../delivery/contract.md) consumes the accepting result for the exact
reviewed tree, recovered staging parent, capture and acceptance. It owns provider
inspection, CI, configured review and confirmation of integration. Verification
cannot publish, merge, approve a PR or answer a human gate. A subsequent staging
advance requires renewed reconciliation and applicable verification before delivery.

An uncertain response or outdated PR does not create a new engineering verdict.
Delivery observes issue-branch and PR facts before effects, reuses the matching
retained publication or confirmed merge, and refuses conflicting identities.
Unavailable facts retain a named prerequisite and its evidence. No second delivery
can substitute for reconciliation or fresh acceptance.

## Distinguishing regression observations

Public regressions must use the actual assembled and session records from the
recovered Execution path. For `recovered-verification-identity`, vary tree, staging
base, approved capture and captured acceptance independently. Include equal-tree
cases and unchanged criterion IDs with changed requirements. Assert earlier
acceptance cannot authorize the recovered candidate and historical verdict identities
remain intact.

For `recovered-check-applicability`, change a resolved operation or add a required
check in the recovered capture. Observe its execution against current inputs before
an accepting verdict. Exercise missing, skipped, unavailable and failed required
evidence, alongside valid reuse of an unaffected scoped observation. Inspect the
independent request for preserved original requirements, distinguishable complete
historical observations and the exact retained multiline answer.

The inspected baseline at `aae84422d50f59311f36cb0cd397c58293fe8c91` exposes
[Candidate and verdict validation](src/index.ts) and the
[captured checklist and pending-review reuse path](src/native.ts).
Candidate currently carries a tree digest, owner-evidence digest and evidence
references; pending-review reuse compares candidate digest, capture source revision,
owner-evidence digest and retained log membership. Those source observations alone
do not prove the recovery identity and changed-checklist cases above. The later
Testing and Implementation activities must establish them through public regressions.
Only subsequent host assessment and delivery evidence can establish the reviewed
tree, staging parent, required checks, independent verdict and confirmed staging merge.
