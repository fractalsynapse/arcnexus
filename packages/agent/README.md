# Agent

The Agent is the central execution entity. Its [public service](src/index.ts)
uses Architecture's shared request builder for inspection and activation; callers
supply the selected activity and its scoped task context. See the
[Agent contract](contract.md) for the component boundary.

Invalid actor output carries its exact diagnostic and a separate stable finding
identity. Provider diagnostics retain the original transcript path for the
caller. The same malformed answer in another transcript has the same finding;
domain wrappers preserve that identity through their error cause. Architecture,
Direction and steward repair compare the finding independently of changing
evidence filenames, while retaining relevant checked-input progress. Distinct
findings remain repairable. An unchanged repeat holds with its honest evidence.

This corrects the observed Architect response issue in #637 through the existing
error and caller loops. Architecture requests explicitly require one JSON object,
without YAML or Markdown fences. Prior failed responses remain evidence.

Planner and Reviewer use this same caller recovery boundary. Successive distinct
response findings return exact diagnostics to the same activity. Planner retains
its original mapping and approval scope. Reviewer retains the assembled candidate,
checks and acceptance; citation repair cannot alter its engineering decision.
An unchanged repeat becomes a durable hold, rather than an execution abort.
Valid independent rejection still returns to Direction for pending-work revision.

Research also receives exact report-validation diagnostics, including the existing
field bounds, before resuming its requester. Distinct findings remain repairable;
unchanged failure or a genuine external error is retained as optional research
unavailability. Prior failed reports remain in the original evidence.

A pending reusable research entry links to its retained readable evidence as well
as its future archive path. Later activities can read the full report before
choosing its ordinary checked archival operation.
