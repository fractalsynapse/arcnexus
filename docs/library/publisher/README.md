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
non-rewriting compare-and-swap push. Promotion now queues fresh target verification through the existing task host;
real releases remain human-controlled.

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

`delivery promote <simulation-delivery-id>` now queues a separate live task under
current committed target authority. Its result supplies `runId` for `task get` or
`task follow`. Repeating promotion for the same source and target authority returns
the retained task rather than duplicating tracking issues. It verifies original
simulation proof, creates real goal tracking, applies only the attributed diff,
and runs current owner/publisher checks, an independent verifier and a director
assessment before capturing a new delivery. Original assignment identities remain
simulation provenance; the host does not manufacture completed live engineering
assignments. The new delivery retains `promotedFrom` and fresh goal evidence.

Promotion checkpoints share the task queue, pause controls, cancellation and stable
supervisor. Partial assembly with no complete validated pin and interrupted
verification require evidence inspection rather than automatic replay. Pausing
also prevents queued publication from dispatching. Fresh accepted candidates update
the live environment's candidate pointer atomically, and repeated accepted receipts
cannot rewind a later candidate. The normal live publisher then applies current CI,
review and exact-revision authorization gates. Native acceptance uses controlled
model/provider inputs; real-agent simulation and real staging promotion remain
separate qualification gates.

## Steward development branches

A verified run retains each writing assignment's original development branch,
base and verified candidate. Publication advances those branches in candidate
order through the development PR and staging workflow. Each branch retains its
accountable owner. The complete run requires independent engineering and goal
acceptance before publication begins. An aggregate delivery is complete only
when all its constituent development deliveries have completed their required
milestones. Approval of the exact aggregate candidate authorizes its captured
constituents. Conflicting refs and incomplete verification block publication.

### Promotion assessment evidence

A new promotion has a live-promotion goal. The original simulation objective remains
provenance; all original engineering acceptance criteria remain mandatory. Promoting
verified engineering does not claim that the source simulation completed publication.
Its lifecycle history and any separately retained recovery remain distinct evidence.

The promotion director receives the current candidate's complete host-check outputs
through the same paged publication evidence as the independent reviewer, plus the
candidate-bound independent assessment. Private report paths alone do not establish
validation. A foreign, incomplete or mismatched assessment must block promotion.
Existing promotion goals and frozen supervisors are not rewritten.

### Settled verification failures

Promotion retains its check-record identity before executing preparation or target
checks. A known failed operation is a completed observation, not an uncertain
interruption. Ordinary task resume may retry that checkpoint using the same
tracking issue and reconciled assembly, retaining earlier failures and their logs.
Running or interrupted operations still require reconciliation; missing evidence
is not permission to replay. Failed preparation must not leave a cache entry that
permanently prevents the ordinary installer from running again. Successful
preparation continues to use the existing environment-scoped reuse path.

The CLI reports the failed check and its evidence location instead of replacing
it with a generic acceptance error. Recovery neither skips current-target checks
nor grants publication authority.

### Changed staging during publication

An explicit publication retry reconciles retained merge attempts before selecting
current staging from its actual branch ref, not the PR's retained base metadata. A completed merge is reused even when staging has advanced beyond
it. If staging advanced without containing the attempted merge, the old target
lease is obsolete: retain its rejected observation and assemble a new target-specific
attempt. Unknown outcomes and rewritten target history remain blocked. Every new
assembly still requires current checks, independent verification and provider gates;
changing staging never authorizes replay of an uncertain push.

Failures observed before the integration transport starts remain known unapplied
attempts. They may return through ordinary verification and retry; a model review
finding is not an uncertain upstream push. Once transport starts, actual Git/provider
reconciliation is still mandatory before another attempt.
