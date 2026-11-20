# Planner mapping evidence

Planner consumers use a mapping report to distinguish accepted direction from
observed behavior and trace each execution claim to its selected observation.
The [Planner contract](contract.md) defines standing goals, objective preservation
and the shared approval lifecycle.

## Intended citation-to-report behavior

The behavior below is the intended contribution for selected-observation tracing;
it is not a claim that implementation or live delivery has been demonstrated.

Source alignment and observed support are independent ratings. A captured source
citation identifies project text and its meaning. Source coverage, including a
test file or a goal's own measures, cannot by itself establish a `demonstrated`
evidence rating. Observed support must describe what applicable host-held evidence
actually establishes, within that observation's boundary.

A verified-run citation selects an observation from the supplied verified run.
Validation must retain that exact selection alongside the applicable run, rather
than replacing it with the run as a whole or another observation in that run.
The existing citation forms are:

| Citation form | Selected observation | Readable evidence category |
| --- | --- | --- |
| `{ run: "<run ID>", operation: "<operation ID>" }` | The named observed check operation | Check |
| `{ run: "<run ID>", criterion: "<criterion ID>" }` | The named independent review criterion | Independent review |
| `{ run: "<run ID>", delivery: true }` | The run's supported delivery observation | Delivery |

These are input-shape examples, not recorded results. Each readable rating must
explicitly show the selected category and operation ID, criterion ID or delivery
observation, together with the verified run ID and evaluated revision. Delivery
evidence must identify the associated pull request. A run containing several
checks and review criteria must not require readers to infer which one supports
the rating. A check citation does not become an independent review or delivery
claim merely because the run also contains those observations.

Unknown runs, stale evaluated revisions, operations absent from the verified
run, unknown review criteria and unsupported delivery citations remain invalid.
Delivery selection requires actual delivery support in the supplied run; an
accepting review alone cannot supply it. Preserving a selection must not weaken
these validation boundaries.

## Consumer boundary and distinguishing evidence

[decodeProposal](src/proposal.ts) validates the model response against the captured
inventory and sources. [reportProposal](src/records.ts) renders the validated
proposal into the readable mapping report. The selected observation must survive
both boundaries. Focused regressions should pass each citation form through both,
using a run with distinguishable operations and criteria so selection loss or
substitution changes the asserted report. They must also preserve the invalid
citation cases and rejection of source-only demonstrated ratings.

Observed results belong in mapping reports and retained journal evidence.
Standing goals continue to contain durable outcomes and success measures,
independent of component ownership. This change does not add run results or
component assignments to goals, and does not change objective or goal approval.
