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
