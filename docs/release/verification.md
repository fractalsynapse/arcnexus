# Delivery verification

`development.yaml` verifies PRs targeting staging and cancels superseded PR runs.
`staging.yaml` verifies every pushed integration candidate. `production.yaml`
verifies PRs targeting main, main pushes and published releases. Staging and
production never cancel an in-progress verification merely because another arrives.

All three call `verification.yaml`: dependency installation, formatting, lint,
strict TypeScript, build and the complete deterministic test suite, architectural
ownership, guidance metadata and assembled CLI checks. The suite includes experiment
and sequential workday acceptance without paid inference or authentication.
Production additionally checks distribution executability and the packaged schema
registry. No workflow creates releases, tags, deployments, images or publications.

Actions are pinned to immutable revisions, permissions are contents-read, and jobs
retain the six-hour infrastructure ceiling. This ceiling does not create an
application execution timeout. At migration, staging and main had no required named
checks or review rules; no branch protection was removed. Future rules should select
the observed reusable `Repository checks` job for the applicable lifecycle.

## Collaboration documents

Use the [work-item template](../../.github/ISSUE_TEMPLATE/work-item.md) for issues
and the [pull-request template](../../.github/pull_request_template.md) for PRs.
These files are the authored format; do not maintain separate copies in prompts
or source. Fill them with concise descriptions and observed evidence, not raw
runtime JSON. Give issues and PRs meaningful titles rather than run identities.

Tracking identities and idempotency markers remain machine evidence. Preserve them
when correcting an existing document, without making them the human explanation.
Simulation must exercise the same document preparation as live publication.
Automatic template-aware issue/PR generation is being corrected under issue #293;
adding these templates alone does not establish that runtime acceptance.
