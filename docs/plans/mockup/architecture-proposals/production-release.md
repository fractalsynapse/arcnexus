# Review, authorize, and verify a production release

**Direction agreed during UI review.** The Release workspace previews the intended `release` command. The current locked contract gives the maintainer the protected merge, tag, publication and deployment actions. Exact approval of a contract amendment is required before the trusted host can perform the reviewed release actions. [Production release boundary](../../../../packages/release/contract.md)

## Release candidate and approval

Use new verified staging snapshots beyond the previous production release boundary. Prepare the reviewed production candidate from the pinned snapshot against the observed `main` base. Retain the staging source, included scope, production PR and head, candidate tree, `main` base, proposed tag, and configured deliverable checks. [Staging snapshot proposal](promote-staging-snapshot.md)

1. **Specialist reviews and pre-release checks.** Run the configured reviews, such as Performance, Security and Pluggability, and collect the required pre-release checks for the exact candidate. Each specialist supplies a verdict, criterion-linked findings and evidence. Route engineering corrections through Direction and staging. Pending or unavailable prerequisites retain a named hold. A changed candidate must satisfy the affected gates again.
2. **Final approval.** Present the exact candidate, intended tag and deliverables, diff, and linked review and check evidence. Capture the maintainer's **Approve release**, **Hold**, or **Request changes** decision. A hold retains the candidate for a later decision. A change request routes the concern through Direction. Record the approval against the exact candidate and effects. A changed PR head, `main` base, tag or scope requires revalidation and renewed approval.
3. **Merge, tag and publish.** After the applicable amendment and exact approval, the trusted host merges the approved PR head, confirms the actual `main` commit, tags that commit, and observes the published artifacts. Persist each effect and identity. On an uncertain result, reconcile provider facts before retrying. Preserve immutable tag and artifact identities. Report each stage separately. [Repository delivery verification](../../../release/verification.md)
4. **Post-release checks.** Invoke the configured checks for each actual deliverable using the approved operation bindings or declared npm or ArcNexus CLI commands. Record the observed commit, tag, artifact identity, results and logs. Examples include installing the published npm package, launching the released CLI binary, and checking the deployed container. Show **Released · verifying** while checks run. Show **Delivered** only after the production merge, tag and publication are confirmed and all required post-release checks pass.

## Production incident

A confirmed failed production check changes the release state to **Released · checks failed**. Preserve the actual merge, tag and published artifacts. Start one issue-linked incident via `task run` for that release at production-outage urgency. Include the original goal, affected artifact identity, complete failed-check evidence and the remediation goal. Retry or replay attaches observations to the same incident identity. Pending or unavailable evidence leaves verification on a named hold. Corrections go through staging and a fresh authorized production release.

## Adoption and acceptance

- Verify that a specialist rejection blocks approval and that changed candidate identity invalidates the old approval. Required provider review and checks still apply to the exact head. Apply the exact reviewed contract amendment before enabling protected effects.
- Exercise cancellation and uncertain merge, tag, publication and incident creation. Reconcile provider facts first, resume the recorded stage and preserve immutable release identities. Show Delivered only with live observations bound to the published revision.
- Verify that failed post-release checks create one attributable production incident and retain the released state and evidence. Missing evidence leaves verification pending or unavailable. Preserve the distinct staging verification and production delivery claims.

## Mockup review

Pin staging revision B in the **Release** workspace. Under **Production release**, choose **Specialist rejection**, **Successful release**, or **Post-release failure**. Review the four evidence stages. For either publish path, use **Review release** to inspect the exact example candidate, choose **Approve release**, then step through the simulated merge, tag, publication and post-release checks. On failure, **Open incident task** opens the illustrative Run task with its urgency, original goal and failed check.
