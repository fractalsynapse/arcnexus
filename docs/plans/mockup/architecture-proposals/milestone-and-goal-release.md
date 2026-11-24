# Release milestones and verify goal delivery on staging

**Direction agreed during UI review.** Run previews milestone checkpoints and goal-level staging evidence. Exact contract amendments and runtime adoption remain pending.

## Milestone Release

After milestone Review, the host tests integration against the observed staging revision and runs the applicable checks. On success, Execution uses Collaboration to commit and push the checkpoint on the shared issue branch. Attach the tested staging revision, checkpoint commit, checks and milestone attribution to the issue comment and retained run evidence. The goal's staging PR remains a separate delivery action. A published checkpoint allows the plan to continue to the next applicable milestone activity.

Route same-owner failures directly to the steward's inbox with the observed failure and applicable repair activity. Direction handles a change of owner, scope or sequencing. After repair, refresh the affected integration evidence before publishing. Reconcile the provider state after an uncertain push or comment, then resume from the recorded checkpoint. [Component repair routing](configurable-component-activities.md#repair-routing) · [Delivery contract](../../../../packages/delivery/contract.md)

## Goal-level Release

1. **Independent review.** Verification binds an accepting verdict to the assembled tree, staging base and captured authority. Release uses this exact candidate.
2. **PR checks and external review.** The host opens or updates the issue-linked staging PR and records the verdict and evidence there. Observe required CI and configured external review for the exact PR head. External prerequisites remain named holds. When changed staging or corrective work alters the candidate, refresh the affected checks and applicable independent and external reviews.
3. **Staging merge.** The host requests the provider merge for the verified PR head and records the actual staging commit. Observe provider state before retrying an uncertain action.
4. **Post-merge checks.** Run the configured checks for the actual staging revision and its deliverables. Capture the check results and logs along with relevant artifact identities. Examples include launching the built CLI or checking the staging container. Mark the goal **Verified on staging** after all applicable checks pass. Retain distinct running, failed and unavailable evidence states. Reserve **Delivered** for verified production release. [Repository delivery verification](../../../release/verification.md) · [Production release boundary](../../../../packages/release/contract.md)

Send final review and release engineering failures through Direction with the candidate and evidence. Reuse the open PR for correction before it merges. After a failed post-merge check, preserve the merge as observed and link a corrective PR to it through the existing task path. A corrected candidate passes through the applicable review and check gates.

## Adoption and acceptance

- Amend the [plan template](../../../../.arc/architecture/plan-template.md), [Delivery](../../../../packages/delivery/contract.md), [Workflow](../../../../packages/workflow/contract.md), and applicable Execution and Verification obligations. The current milestone Integration step references the goal's staging merge. The proposed Release step records its own checkpoint. Treat the actual post-merge result as a separate observation on the single staging delivery path.
- Verify two milestones publish attributable checkpoints on one issue branch, with the check and issue comment bound to each checkpoint. Test a same-owner rewind and restart after an uncertain publication. The goal opens one staging PR after independent acceptance.
- Exercise a pending review, a staging-base change, a confirmed merge with running or unavailable checks, a failed post-merge check, and a successful one. Require evidence for the actual merged revision before showing **Verified on staging**. Retain earlier evidence under its original commit and leave production authority within the locked release boundary.

## Mockup review

In Run, open a steward's **Activities → Release** to inspect the checkpoint. The goal's **Release** card links to four expandable evidence stages. The retained round shows available evidence and gaps. The labeled Planner example offers selectable release states with illustrative checkpoint and post-merge evidence.
