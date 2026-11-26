---
id: "staging-evidence"
---

# Distinguish milestone checkpoints from verified staging delivery

Preserve the proposed milestone and goal release distinction for exact amendment review before adoption. Milestone publication records its tested staging revision, checkpoint commit, checks and attribution on the shared issue branch. A checkpoint does not authorize goal integration.

Goal delivery retains separate observations for independent review, exact-head hosted gates, staging merge and checks of actual merged deliverables. Show running, failed and unavailable post-merge verification distinctly. Claim verified staging only after all required checks pass; production delivery remains a separate boundary.

Reconcile uncertain effects before retries. Before merge, engineering correction reuses the existing PR with refreshed acceptance. After a failed post-merge check, retain the observed merge and link correction through the normal task path.

## Observable success

- Multiple milestones publish attributable checkpoints while the goal retains one staging delivery.
- Post-merge evidence identifies the actual merge revision and deliverables.
- A confirmed merge with failed or unavailable checks cannot appear verified.
- Corrections preserve historical merge and failure observations.