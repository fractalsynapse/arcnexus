# Verification

Verification binds engineering acceptance to the assembled work and its captured
requirements. This reference is for maintainers implementing recovery and consumers
deciding whether retained evidence can authorize the candidate now being delivered.
The [locked contract](contract.md) governs the gate, especially VI-3, VI-5, VI-12,
VI-18 and VI-19. The rules below preserve the accepted recovery intent. The
current-source reconciliation for `recovered-acceptance-current-evidence` appears
below; source assertions and retained Execution results have different scopes.

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

The current [assembled gate](src/native.ts) distinguishes an
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
coverage intact. The current [failed-check rejection scenario](tests/integration/failed-check-rejection.test.ts)
passes in the retained characterization below. Its controlled Reviewer receives
the failed payload and returns a criterion-linked rejection; the companion cases
refuse acceptance over failed or invalid-scope evidence and retain unavailable holds.

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

## Current source and retained evidence: issue #720

This reconciliation inspects captured revision
`fef60bb8d6aec3c2dcbedb06cac13c2cc3ee79b8`. It replaces the earlier
`aae84422d50f59311f36cb0cd397c58293fe8c91` implementation-gap description;
that earlier inspection is history, not evidence of a current defect. No contract,
criterion or production behavior changes in this documentation contribution.

[Identity construction](src/identity.ts) now records `tree` from the assembled
candidate digest, `base` from the retained engineering configuration capture,
`capture` from active approved authority, `acceptance` from the complete goal
and plan, and `inputs` from owner evidence and current checklist observations.
[Verdict validation](src/index.ts) compares the supplied verification identity
structurally as well as checking the tree and complete criterion coverage.
[Verification](src/native.ts) runs the active captured acceptance operation IDs,
records identity and checks, and supplies that binding to
[Reviewer's assessment builder](../reviewer/src/index.ts). Numeric failures reach
assessment; an accepting response still cannot bypass failed or invalid-scope
required evidence. Null or not-applicable required results retain an unavailable
hold before review.

The current gate calls the existing check path on every assessment. It does not
restore an earlier checklist solely from a pending-review record.
[Execution's check identity](../execution/src/check-cache.ts) includes clean
committed revision, authority, operation declaration, resolved arguments and
parameters, relative cwd, scope and environment. Its environment includes runtime,
tool identities, confinement and installed dependency identity. Matching retained
numeric observations with readable logs may be reused, including failures as
failures. This implementation is conservative: a changed committed revision or
authority invalidates that identity even if some source bytes match. The broader
scoped-reuse rule above does not claim finer dependency analysis exists.

### Executed public characterization: run 145

The [recovered acceptance scenarios](tests/integration/recovered-acceptance.test.ts)
have SHA-256
`2d732405a3b87a9c1c5dda1036bb343bf5ded2e8c1bd920b54d1577418d86510`;
the [failed-check rejection scenario](tests/integration/failed-check-rejection.test.ts)
has SHA-256
`c1d6b099544fbd683f738b87dce2ebb86ada790bac84286116908cbe7c0b78bc`.
These source identities match the characterization retained by Testing. Complete
host observation `145-680-mcp-observation.json` records `owner-tests`, status 0,
with log `145-679-owner-tests.log` under invocation
`ad4f08f02034c389b42ff853b024e7ca2c21db31cd8c725686755a8a0c517664`.
The retained evidence index and `145-1-run-timeline.jsonl` locate the complete
artifacts. The log SHA-256 is
`1bf362c32b9f2bede3e24b54976a7911e0dd68fc7e08733f1af6ee2a61cc5c04`.
All 18 cases pass, with no failures or skips, across recovered acceptance,
failed-check rejection and quality-scope suites.

| Accepted criterion | Observed characterization and scope |
| --- | --- |
| `recovered-identity-refusal` | Varies tree, base, capture and acceptance separately; equal-tree cases and changed requirement text under the same criterion ID reject replay of the earlier verdict. Historical observations are compared unchanged. A further case supplies distinct recovered base and active capture to the new assessment. Cases 4–8 pass through the public gate with controlled assessment responses. |
| `recovered-required-evidence` | Changed operation mapping and added required check reach the assessment with current argv and logs. An incomplete pending checklist cannot bypass the added check. Failed, unavailable, skipped and invalid-scope results cannot accept; unchanged interrupted inputs reuse exact observations, while changed dependency installation on the same tree/capture refreshes evidence. Cases 10–18 pass; case 1 returns the valid numeric-failure rejection, while cases 2–3 distinguish invalid and valid check scope. |
| `recovered-review-inputs` | Assessment references retain the original goal/plan, exact multiline answer, distinguishable original and resumed findings and current acceptance. Complete artifacts are read and compared through the task boundary. The recovered assessment cases pass these complete-artifact comparisons; seeded history is not a live human conversation. |

The [assessment fixture](tests/fixtures/recovered-assessment.ts), SHA-256
`fefd52f0c59ab695a20f8e16b05862f927cf04a2dfb95fb1e09448cdc556a98d`,
uses the real public Verification/Reviewer path, operation resolver, check-input
identity and journal. Its [project fixture](tests/fixtures/recovered-project.ts),
SHA-256
`c233c1d1598e9e1df6dfe5bdf544d3cf473f40798ee16018a7b3ff29e6e10b78`,
constructs HostTask with real committed Git captures, Execution assembly and
reopened Coordination SQLite state. It creates the checkpoint and retained history
as setup. It does not drive prepared recovery admission or obtain an actual
checked-edit receipt or human answer.

HostTask check and activation responses are controlled: declared commands are
resolved but their processes do not run, and the accepted/rejected model verdicts
are simulated. These cases can characterize gate ordering, identity refusal,
evidence selection and complete assessment inputs. They cannot establish actual
required-command execution, live independent reasoning, native confinement,
publication refusal, hosted CI or a confirmed staging merge.

### Execution's completed contribution

[Execution's run 145 characterization](../execution/docs/prepared-checkpoint-recovery.md#executed-prepared-recovery-characterization-run-145)
already establishes the prepared-recovery boundary for the same issue and captured
revision. Its complete host observation `145-243-mcp-observation.json` records
`owner-tests`, status 0 and log `145-242-owner-tests.log` under invocation
`ad4f08f02034c389b42ff853b024e7ca2c21db31cd8c725686755a8a0c517664`.
The retained evidence index and `145-1-run-timeline.jsonl` locate those complete
external artifacts. The log SHA-256 is
`be99360a2acb4d847354998be190b663585c7463e92931af84dd8b896482db75`.
Prepared cases 161–169, caller-consumer cases 38–42 and authority case 33 pass;
the enclosing run records 252 passes, no failures and 16 skips.

Those cases exercise public Workflow, real Git/SQLite and a deterministic
executable using LocalMcp: exact answers, retained receipts and replay, changed
ownership refusal and conflict preservation are observed. Their final Verification
and Delivery results remain controlled, and the authority case compares review
identities rather than obtaining a verdict. They therefore supply continuity and
authority evidence without discharging this milestone's recovered assessment
observations. Skipped native cases remain gaps.

Testing also retained passing owner-format, owner-lint, repository-types and
repository-build observations: `145-683`, `145-686`, `145-689` and `145-692`
`mcp-observation.json` artifacts respectively, with complete logs `145-682`,
`145-685`, `145-688` and `145-691`. The source and fixtures match those inspected
here; this reconciliation changes prose only. No demonstrated runtime defect
requires a product correction or a manufactured red. The existing gate and
journal remain the sole implementation; no recovery abstraction, cache or limit
was added. Applicable mapped checks remain subject to host input matching.

Preserve matching historical evidence without treating these controlled results
as live independent assessment. Delivery's accepted
`retained-publication-current-evidence` milestone owns provider reconciliation,
stale publication refusal and one retained PR; no new supplier milestone is needed
for that already sequenced work. The later host assessment and delivery must
identify the reviewed final tree, recovered staging parent, required checks,
independent verdict and confirmed merge. No current live or hosted success is
established by this reconciliation.
