# Repository delivery verification

Use an issue-linked staging PR. Verify the candidate against applicable acceptance,
required CI and configured review before integration. Record the exact merge
identity, and keep staged integration distinct from production release. The
[Delivery contract](../../packages/delivery/contract.md) defines the product flow and
the [production release boundary](../../packages/release/contract.md) preserves human authority.

Use the [issue template](../../.github/ISSUE_TEMPLATE/work-item.md) and
[PR template](../../.github/pull_request_template.md). Report completed checks and
remaining evidence explicitly.
