# Repository delivery verification

Use an issue-linked staging PR. Verify the candidate against applicable acceptance,
required CI and configured review before integration. Record the exact merge
identity, and keep staged integration distinct from production release. The
[Delivery contract](../../packages/delivery/contract.md) defines the product flow and
the [production release boundary](../../packages/release/contract.md) preserves human authority.

After merging to staging, include the exact staging merge commit and a reference
 to the Staging workflow run for that commit in the delivery record alongside the
pull request checks, so both observations can be traced.

Use the [issue template](../../.github/ISSUE_TEMPLATE/work-item.md) and
[PR template](../../.github/pull_request_template.md). Report completed checks and
remaining evidence explicitly.

## Publication recovery evidence

If publication is interrupted, rerun `task run` with the identical goal. In the
retained task evidence, compare the reused pull request, the reviewed tree and
the observed staging commit. The [Delivery contract](../../packages/delivery/contract.md)
scenarios DE-5 and DE-6 govern observation before retry and reuse of a recorded merge.
If the staging base moves before an unmerged publication, ArcNexus refuses to reuse the previous acceptance because it covers the earlier tree.
