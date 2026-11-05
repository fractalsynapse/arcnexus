## Worker handoff and ordinary recovery (#269)

A steward's plan and checklist are progress evidence, not an independent completion
engine. Preserve pending or blocked checklist items honestly for the independent
reviewer. Do not demand that a worker complete host-owned delivery or publication
before handing its engineering result to that host.

Engineering still requires captured host checks, settled dependencies and independent
evidence for every acceptance criterion. A completed checklist cannot establish
acceptance, and an incomplete checklist cannot by itself prevent assessment.

A completed, scope-checked model turn that stops for semantic diagnosis retains a
recoverable checkpoint. Installed-runtime recovery validates the retained checkpoint
hash, authority, candidate, stopped services and settled operations before resuming
the same assignment. In-flight or uncertain model/operation execution remains blocked.

## Regression evidence and acceptance authority

Worker-authored regression checkpoints preserve the original tests and observed
expected failure as review evidence. They do not turn incidental test assertions
into new architectural requirements. Engineering may correct those tests within
component ownership; the original bytes, failure and subsequent diff remain
available to review. Final checks execute the current candidate, while captured
trusted acceptance remains separately enforced. Independent review must reject
missing or weakened coverage of the original objective, and may accept justified
test corrections. A passing command alone cannot establish criterion coverage.
This replaces replay of worker-authored frozen regressions; historical evidence
remains readable and recovery retains the original assignment and observations.
