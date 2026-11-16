# Reviewer plugin contract

Stage: **proposed**. The [registry](../../docs/interface/registry.yaml) records its status.

Reviewer supplies the final read-only Agent through the project's explicit
`reviewer/assessment` binding. [Verification](../verification/contract.md) owns the
acceptance gate and supplies the candidate, original goal, captured criteria,
trusted check results and authorized task evidence by reference.

`assess(input, signal)` uses [Agent](../agent/contract.md) for one activation. It
returns an independent verdict tied to the candidate and criteria. A rejection
names the deficient criteria, evidence and accountable owners so
[Direction](../direction/contract.md) can sequence corrections.

The same activation can return evidence-linked lessons for `.arc/learning/`,
which Reviewer owns. A lesson describes what happened, what may generalize and
which observation supports it. The host records lessons with the task evidence
through Coordination. Any tracked learning note enters through a checked change
with its own acceptance. Recording a lesson never changes the candidate tied to
the verdict. Lessons remain proposals until the architect adopts them.

A run that ends before review retains its observations. The host records the
outcome without inventing a verdict or lesson. A reviewer can cite earlier task
observations when they belong to its captured evidence scope.

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| RVR-1 | Verification obtains the final read-only verdict from the Reviewer Agent. A rejection routes criterion-linked findings to Direction. |
| RVR-2 | A lesson cites actual execution evidence and carries no authority to weaken acceptance or change active instructions. |
| RVR-3 | Recording a lesson through Coordination leaves the accepted candidate digest and its delivery eligibility unchanged. |
| RVR-4 | An interruption before review preserves observed evidence with no fabricated verdict or lesson. |
