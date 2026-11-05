
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
