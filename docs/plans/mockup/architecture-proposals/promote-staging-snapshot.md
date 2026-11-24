# Promote one verified staging snapshot

**Direction agreed during UI review.** The project-level Release workspace previews staging selection and candidate preparation. Exact contract amendments and runtime adoption remain pending.

## Establish the release range

Read the prior production release record and its source staging commit. Retain that source identity alongside the production merge commit and tag, including when the histories differ after a squash. The source staging commit is the exclusive start of the range. A verified commit on the staging lineage is the inclusive end. Show a named hold if the source boundary cannot be established or the selected commit does not descend from it. [ArcNexus release procedure](../../../../.agents/skills/arcnexus-release/SKILL.md#prepare-a-release-when-authorized)

The staging revision selector lists newer snapshots in newest-first order with commit, time and staging verification state. Suggest the latest verified snapshot for a new candidate. Pending, failed and unavailable required evidence keep a revision ineligible. Require staging verification for the selected revision itself. Link the recorded checks and revision evidence to that selection. [Staging verification](../../../release/verification.md)

## Review what is included

Derive the Included PRs list from the staging integration history in the selected range. Show each PR in staging merge order with its title, issue links, staging merge commit and expandable acceptance evidence. Preserve visibility of partial acceptance and identify commits with no linked PR or unresolved attribution. Keep the list read-only. The chosen snapshot carries all changes in the range, including merge resolutions already tested on staging.

Preparing a candidate pins the source boundary, staging revision and derived scope. Fresh staging observations can surface newer eligible snapshots while an existing candidate stays pinned. A later snapshot can be previewed beside the pinned scope. Explicit replacement creates a new candidate identity and refreshes affected review and approval. If production's base changes, reconcile it and revalidate the resulting production candidate while preserving the staging selection and historical evidence. Production authorization remains a separate decision for the exact candidate. [Production authority](../../../../packages/release/contract.md)

## Adoption and acceptance

- Prepare the exact changes to the production Release boundary and relevant release guidance before runtime adoption. Exercise a prior production squash merge and an unavailable source boundary. Confirm the range always uses the recorded staging source and includes every staging change through the selected verified revision.
- With A, B and C integrated in that order and C still verifying, suggest B and list A and B. Pin B, observe C becoming eligible, and verify that B and its scope remain pinned. Preview C, see A through C, and explicitly replace the candidate. Keep earlier review and approval evidence bound to its original identity.
- Confirm that the release scope reports unlinked commits and partially accepted work. Verify that preparing a snapshot leaves staging integration and the selected goal's Run evidence independent of production preparation.

## Mockup review

Open **Release** from the header. Prepare the suggested B revision, then select **Simulate C verification**. The prepared scope stays at A and B. Choose C to preview the broader list, then use **Replace prepared candidate** to pin C. The workspace uses an illustrative history.
