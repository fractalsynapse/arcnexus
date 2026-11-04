# Publisher

Publisher receives host-captured run, assignment and candidate evidence. It retains
an immutable delivery only after validating that the candidate still matches the
independently reviewed result. Delivery approval is local authorization for that
revision; it is not a GitHub review or permission to bypass CI.

Coordination-store owns durable delivery transitions and external-effect receipts.
Operations owns supervised effects and provider transport. Publisher owns the policy
that connects verified engineering to those effects. Worker input cannot replace
captured owner, repository, environment, candidate or verification authority.

Live and simulated deliveries use the same state model. Promotion preserves the
simulation record and creates a different live delivery after current-target
reconciliation and fresh verification. Real main merges, tags and package publication
remain outside this increment's automatic authority.

## Delivery services

`delivery list [package]` and `delivery get <id>` read retained state without starting
an execution host. `delivery approve <id>` authorizes the observed immutable revision
using a stale-revision check. `delivery publish <id>` queues advancement on the original
supervisor, preserving repository serialization and captured authority. The current
publication adapter advances simulation deliveries; live publication and promotion
remain separate implementation gates.

A shared `delivery.publish` operation declares the accountable publisher, destination
repository and target branch. Its definition digest accompanies each internal effect.
Automatic integration requires an explicit grant; otherwise publication retains a
pending PR until exact-revision approval. Simulated provider review is visibly synthetic
and never replaces independent engineering verification.

The simulation adapter makes real local Git commits and pushes, assembles a merge,
executes captured owner and publisher checks, and independently verifies the assembled
result before compare-and-swap integration. Releases require actual captured build
artifacts: their bytes are checked against retained hashes and copied into private
content-addressed storage. Failed checks, conflicts, missing artifacts and uncertain
operations retain honest blockers. Repeated requests reuse completed receipts.

The GitHub PR provider also observes readiness using a fixed repository-scoped
query. It binds CI rollups to the pushed commit, retains the provider's review and
merge state, and blocks missing/failed CI, pending review, drafts, conflicts and
main/default targets. Partial GraphQL results are errors. This observation is not
merge authority or fresh assembled verification; live publication wiring must
combine those gates before requesting integration. The provider follows GitHub's
[PR fields and merge states](https://docs.github.com/en/graphql/reference/pulls)
and [commit check rollups](https://docs.github.com/en/graphql/reference/commits).
