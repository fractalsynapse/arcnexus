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
supervisor, preserving repository serialization and captured authority. The simulation adapter advances the complete isolated lifecycle. The live adapter
creates a verified host commit, repeats captured checks and independent verification,
pushes a generated branch, creates a correlated GitHub PR and observes current CI
and review gates. Authorized staging integration assembles the exact target,
repeats independent verification and reobserves provider requirements before a
non-rewriting compare-and-swap push. Promotion remains a separate implementation
gate; real releases remain human-controlled.

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
merge authority or fresh assembled verification; the live publication service
combines those gates before requesting integration. The provider follows GitHub's
[PR fields and merge states](https://docs.github.com/en/graphql/reference/pulls)
and [commit check rollups](https://docs.github.com/en/graphql/reference/commits).

Both adapters use one durable publication-effect service. Completed commits, pushes
and PRs are reused after interruption; uncertain mutations require reconciliation.
CI/review observations are refreshed on each explicit publication request, so a
pending check does not become a permanently cached failure. The live host reads
`GH_TOKEN` or `GITHUB_TOKEN` at the provider boundary; neither workers nor operation
evidence receive credentials. Local approval never submits a GitHub review.

Integration requires the target to be the assembled commit's first parent and the
result to match the host's private assembly pin. An explicit expected-ref Git lease
rejects even a concurrent update to another ancestor; it never permits history
rewrites or a different ref. Server-side policy rejection remains a blocker. No
admin override or GitHub review submission is available. Lost receipts reconcile
the actual target against the retained assembly before advancing delivery state.

Promotion must revalidate the source delivery's immutable attribution and retained
independent evidence before importing its objects. New delivery records identify
the reviewed candidate record explicitly. Earlier records remain readable and
require equivalent source proof; the latest workday candidate is not a substitute
for the candidate that was actually delivered. Source revalidation is separate
from fresh target-authority checks and independent verification.
