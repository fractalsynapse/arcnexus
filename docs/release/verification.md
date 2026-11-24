# Repository delivery verification

Use an issue-linked staging PR. Verify the candidate against applicable acceptance,
required CI and configured review before integration. Record the exact merge
identity, and keep staged integration distinct from production release. Follow the
[repository release procedure](../../.agents/skills/arcnexus-release/SKILL.md);
the [Delivery contract](../../packages/delivery/contract.md) defines the product flow
and the [production release boundary](../../packages/release/contract.md) preserves
human authority.

After merging to staging, include the exact staging merge commit and a reference
to the Staging workflow run for that commit in the delivery record alongside the
pull request checks, so both observations can be traced.

Use the [issue template](../../.github/ISSUE_TEMPLATE/work-item.md) and
[PR template](../../.github/pull_request_template.md). Report completed checks and
remaining evidence explicitly.

## Publication recovery evidence

This procedure is for an operator continuing prepared work after staging moves or
a publication response is lost. Rerun `task run` with the identical goal to resume
the retained task. Keep one task delivery, issue, issue branch and staging PR;
do not create another delivery to escape uncertainty or stale approval.

### Preserve work and capture current authority

[Execution's prepared-checkpoint recovery](../../packages/execution/docs/prepared-checkpoint-recovery.md)
retains secured checked bytes, successful receipts, complete evidence and verbatim
human answers, including meaningful whitespace and line breaks. The original
engineering base, acceptance, activation authority and review observations remain
history. An earlier answer remains task input; it does not renew approval for a
different candidate or capture.

Before continuation, the host observes current staging and captures its new base,
approved ownership, available operations and applicable acceptance. Reconcile that
acceptance with the original requirements. A necessary boundary or acceptance
change requires architectural authority through the existing approval route,
with the exact decision and evidence retained. Candidate edits cannot authorize
that change.

Current captured ownership governs subsequent edits. A changed owner or unavailable
activity prevents unauthorized continuation and retains its diagnostic. Compatible
checked and staging contributions are combined through Git's three-way merge.
A conflict retains the secured checkpoint and complete diagnostic before overwrite
or ref movement. Resolve it through the normal accountable activity under the new
capture; request a distinct owner's contribution through Direction when necessary.
Preserve the journal and failed evidence rather than manually repairing stored state
or discarding checked work.

### Obtain acceptance for the recovered candidate

[Verification's recovered acceptance](../../packages/verification/README.md) binds
the candidate tree, staging base, approved capture, complete captured acceptance
and actual check inputs. Earlier acceptance cannot authorize publication or merge
when any required identity changes, even when tree bytes or criterion IDs match.

Run newly required checks and refresh affected checks against current resolved
inputs, then obtain fresh independent review of the recovered final candidate and
its captured acceptance. Unchanged scoped observations may be reused only when
their relevant inputs, bindings and environment still match. Missing, skipped,
unavailable or failed required evidence prevents acceptance. Preserve historical
checks and verdicts with their actual identities.

### Reconcile provider facts before effects

[Delivery's publication recovery reference](../../packages/delivery/docs/check-recovery.md)
defines the retained-publication path under DE-5, DE-6 and DE-17. After a lost push,
PR or merge response, or when an open PR predates staging movement, inspect the
provider's PR and issue-branch facts before retrying effects. Unavailable facts
do not establish absence.

| Observed state | Continuation |
| --- | --- |
| Matching open PR and expected issue-branch head | Reuse its actual URL and observe the accepted head's required gates. |
| Open PR for the earlier retained candidate | Reconcile its head against checkpoint and publication history, recover through Execution and Verification, then continue the same PR with fresh acceptance. |
| Confirmed matching prior merge | Verify the historical publication and confirm its actual merge tree on staging; report that merge without another push, PR or merge. It does not approve additional recovered work. |
| Unexpected branch, head or target; closed unmerged PR; conflicting merge | Refuse further effects and retain the conflicting identities and diagnostic for resolution. |
| Required provider fact or external prerequisite unavailable | Retain the work, complete evidence, named prerequisite and required next action; claim no delivery success. |

A genuine human decision retains its exact question and answer at the existing
gate. External prerequisites retain their own evidence and required action.
Dependent work waits for observed satisfaction. Routine owned corrections and
authorized staging retries add no human approval gate and cannot bypass a required
one.

### Confirm the pinned staging result

Delivery consumes the newly accepting independent verdict; it cannot edit or
accept the candidate. Observe required hosted CI and configured PR review for
the accepted head. Keep delivery pinned to the reviewed tree and staging parent.
Further staging movement requires renewed reconciliation and applicable acceptance
before integration, including movement during provider verification.

A successful delivery record identifies the task, issue and single PR, newly
reviewed tree, staging parent, capture and acceptance, required check observations,
independent verdict, configured PR review and confirmed staging merge commit.
Confirm that the actual merge contains the accepted tree on staging; do not
substitute the latest staging head for a previously confirmed task merge.
An uncertain confirmation remains pending with its evidence.

### Current characterization: issue #720

The completed Execution, Verification and Delivery contributions characterize
the existing recovery path from captured revision
`fef60bb8d6aec3c2dcbedb06cac13c2cc3ee79b8`. No production defect requiring
a behavioral correction was demonstrated. Delivery extended its existing
[retained-publication regressions](../../packages/delivery/tests/integration/retained-publication.test.ts)
to distinguish a confirmed historical merge after later staging movement,
another staging advance after outdated-PR reassessment, and unavailable branch
facts after successful PR lookup. Earlier correction intent and observations,
including issue #701, remain historical evidence.

| Accountable contribution | Current observation and scope |
| --- | --- |
| [Execution](../../packages/execution/docs/prepared-checkpoint-recovery.md#executed-prepared-recovery-characterization-run-145) | `145-392-mcp-observation.json`, log `145-391-owner-tests.log`: 252 passes, no failures, 16 skips. Public recovery cases preserve exact answers and receipts, capture current authority, refuse changed ownership and retain conflict diagnostics. Final acceptance and delivery ports are controlled. |
| [Verification](../../packages/verification/README.md#executed-public-characterization-run-145) | Later observation `145-799-mcp-observation.json`, log `145-798-owner-tests.log`: 18 passes, no failures or skips. Identity refusal, current evidence selection and complete assessment inputs pass through the public gate; check processes and Reviewer responses are controlled, and history is seeded. |
| [Delivery](../../packages/delivery/docs/check-recovery.md#executed-production-service-characterization) | `145-1172-mcp-observation.json`, log `145-1171-owner-tests.log`: 49 passes, no failures or skips. Real Git and reopened Coordination state exercise lost responses, outdated-PR reuse, historical merge confirmation, conflicting or unavailable facts and repeated staging movement. Provider effects, check results and Reviewer responses are controlled. |

Complete observations and logs remain outside source under invocation
`ad4f08f02034c389b42ff853b024e7ca2c21db31cd8c725686755a8a0c517664`;
the host's retained-evidence index and `145-1-run-timeline.jsonl` resolve them.
The accountable references identify source and log digests and preserve earlier
observations. The owner test commands actually ran; controlled required-check
responses inside their recovery fixtures do not establish execution of those
declared commands or live independent reasoning.

These contributions establish deterministic regression evidence. Their thrown
interruptions follow normal cleanup; they do not demonstrate abrupt process
death. Skipped native cases remain gaps. Live inference recovery, actual native
confinement, live GitHub facts and effects, hosted CI, configured repository review
and this task's confirmed staging integration remain separate host observations.
The host must still obtain assembled independent acceptance and delivery for the
final candidate. No production release is established by this characterization.

Staging integration completes an engineering task. Production CI concerns the
actual main commit; a tag identifies a revision, and publication requires observing
the live release and its actual revision. Main integration, tags, publication and
deployment remain separate maintainer actions under the locked release boundary;
published identities remain immutable and runtime release commands remain deferred.
