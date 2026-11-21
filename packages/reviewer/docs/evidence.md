# Complete evidence through the existing file index

Final assessment and citation repair use Execution's retained-evidence index.
The request names that complete file and the current candidate diff; the mapped
read-file tool discovers original artifacts through their retained paths.
All original evidence remains available, and citations are validated against the
host's complete retained evidence set.

This follows Verification VI-4 and the Reviewer contract. Do not serialize the
whole historical path catalog into the initial request or a citation repair.
Reuse the existing index format and immutable artifact storage. Evidence, reports
and file reads remain complete: there is no size threshold, truncation, sampling,
pagination, new store or alternate assessment lifecycle.

The regression must exercise the public Verification/Reviewer call and successive
invalid citations. Every assessment request must retain the complete catalog by
reference while preserving candidate, acceptance, exact diagnostics and check
reuse. A live continuation must then independently review the retained #668
candidate and deliver it through the ordinary staging path.

## Verification identity through assess

The following is the intended behavior for the Reviewer identity propagation
contribution; implementation and public regression evidence remain pending.
This reference is for maintainers of the public `assess` boundary and consumers
interpreting its verdicts. It applies the existing
[Reviewer contract](../contract.md) and
[Verification binding obligations](../../verification/contract.md#obligations)
without changing either locked contract.

Verification supplies `Candidate.verification` using its exported
`VerificationIdentity` type and `verificationIdentity` function through the
[public entry](../../verification/src/index.ts). Reviewer presents that supplied
value unchanged as `assignment.verification` and as `verification` in both
`assignment.accepted` and `assignment.rejected` response templates.

| Field | Verification's authority |
| --- | --- |
| `tree` | Actual candidate tree, also identified by `candidate.digest`. |
| `base` | Engineering staging parent from `task.config.capture.source.revision`. |
| `capture` | Active approved capture revision from `task.capture.source.revision`. |
| `acceptance` | Digest of the complete original goal and current full plan. |
| `inputs` | Digest of actual checks together with the owner evidence identity. |

Reviewer consumes this identity; it does not compute a replacement. For example,
a bound accepted response has this shape (placeholders represent values supplied
by the host and actual retained evidence):

```json
{
  "kind": "accepted",
  "candidate": "<candidate.digest>",
  "verification": {
    "tree": "<supplied tree>",
    "base": "<supplied base>",
    "capture": "<supplied capture>",
    "acceptance": "<supplied acceptance digest>",
    "inputs": "<supplied inputs digest>"
  },
  "criteria": ["<every accepted criterion ID>"],
  "evidence": ["<exact retained evidence path>"]
}
```

A rejected response carries the same supplied `candidate` and `verification`,
with `findings` instead of `criteria` and top-level `evidence`. Each finding
names `criterion`, `owner`, `reason` and its retained `evidence` paths.
Neither response is a GitHub review approval or permission to publish.
[Workflow](../../workflow/contract.md) and
[Verification](../../verification/contract.md) own their existing lifecycle and
acceptance gates.

## Identity and response repair

A missing or stale submitted binding for a bound candidate is an invalid
response. Return the exact validation diagnostic to the same assessment, keeping
its original candidate, supplied identity, acceptance and check observations.
Reviewer must repair its response or retain the unresolved finding; it must not
silently attach today's identity to the submitted verdict. If the caller supplies
no identity, Reviewer must not fabricate one or claim a recovered bound verdict.

Citation-only repair begins after a semantically valid engineering determination.
Its immutable position includes the verdict kind, candidate, complete verification
identity, and accepted criteria or rejected criterion/owner/reason determinations.
Only evidence citations may change. A missing or changed identity during citation
repair cannot replace that position, even when the candidate tree is unchanged.
The original verdict, exact diagnostics and failed citations remain available.

Every repair retains complete request, evidence, diagnostic and selected-profile
history through the existing Agent and task journal. Optional research and verbatim
human answers return to the same assessment. A recovered candidate needs its own
applicable checks and independent determination under the new captured acceptance;
an earlier tree, base or capture binding remains historical.

Public regressions should distinguish bound acceptance and rejection, missing and
stale binding repair or refusal, and citation-only repair that preserves the full
identity and engineering position. They should inspect complete retained history,
using distinguishable attempts and actual response templates. This documentation
records intent before those behavioral observations; it does not establish that
the migration or recovered delivery has passed.
