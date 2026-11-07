---
name: arcnexus-release
description: Use when starting ArcNexus changes, preparing a staging PR, integrating a verified candidate, or preparing an authorized release.
---

# Deliver ArcNexus changes

Apply [AGENTS.md](../../../AGENTS.md) and the shared
[release workflow](../release-workflow/SKILL.md). Use the
[issue template](../../../.github/ISSUE_TEMPLATE/work-item.md) and
[PR template](../../../.github/pull_request_template.md). The
[release contract](../../../docs/release/verification.md) describes the checks.

## Prepare one delivery

Create or adopt an issue with observable acceptance before editing. Verify the
canonical HTTPS remote and its staging tip. Start the issue-numbered work branch
as `codex/<issue>-<description>` from current origin/staging. Preserve user work
and resolve conflicts on the work branch. Establishing staging in a new repository
requires authority and a verified main baseline.

Use the documented intent and assembled-batch cadence in AGENTS.md. Keep related
steward contributions in the same delivery with ownership and attribution intact.
Use issue-linked conventional commits and PR titles. Include one human-readable
Unreleased entry under the applicable category for a developer- or user-visible
change. Prepare version and changelog edits through the same issue branch and
staging PR process. A guidance edit alone needs no version bump.

Before opening a PR, verify the base and refresh affected evidence if it moved.
Review the full diff and apply [ArcNexus verification](../arcnexus-verification/SKILL.md).
Target staging and use `Part of #N`. Cross-link the issue and PR and keep
acceptance boxes tied to observed evidence. Record material decisions and
blockers on the issue. Use structured bodies or files for multiline content.

## Integrate a verified candidate

Squash-merge to staging only with authority, verified acceptance, applicable local
checks, green current CI and satisfied review requirements. Inspect the actual
repository rules and check runs. Keep integration pending when review requirements
are unknown or required evidence is unavailable. Agents never approve PRs or
merge to main. For the managed lifecycle, publish from the captured engineering
baseline and use the accepted assembly and its retained checks.

After merging, confirm the resulting commit on fetched origin/staging. Verify
the task branch has no later work, other open PR, worktree use or retention
requirement. Delete that branch remotely and locally, prune stale tracking refs
and verify their absence. Preserve staging, main and unrelated work.

## Prepare a release when authorized

Keep one active release candidate to main. Record its head and the prior release.
Derive included changes and issue closure from that range and verify acceptance
for each issue. Keep issues open through staging. Put closing references in the
release PR for complete issues. List any included partial work and its remaining
acceptance for the maintainer's decision.

When staging advances, refresh the candidate's scope, changelog, issue list and
affected verification and review. Ongoing staging work may continue while the
release candidate waits. Preserve published tag identities. The maintainer owns
main approval and merge, tags, hotfix direction and production publication.
