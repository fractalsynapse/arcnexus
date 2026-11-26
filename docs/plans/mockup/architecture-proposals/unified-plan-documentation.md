# One Plan flow and project documentation directories

**Proposed.** This amendment replaces the separate draft-only path from [objective recommendations](plan-objective-recommendations.md).

## Project settings

Add an optional **Documentation directories** field to project settings. Use a list of repository-relative directories. Store it once in the project definition so Web, CLI, REST, and MCP use the same settings at the captured revision. An empty list lets Planner discover documentation across the repository. The instruction can point a single run to other authorized files or directories at the same revision. Show invalid paths before discovery and name the directory to correct.

For example, a project can select `handbook` and `design/decisions`. Guide storage continues to use the existing knowledge root.

## Plan

- Keep one Plan command and the checked-by-default **Recommend objectives** option. Use ordinary project admission for every Plan run. When a repository needs a catalog, writable workspace, or delivery credentials, show the missing setup before starting. Completing migration provides that setup.
- Retain the exact batch and source citations in the journal. One approval carries the selected objective wording into goal refinement in the same run. The existing independent review and staging flow handles the resulting guide edits. A subsequent question can pause the run through the same timeline dialog.
- Remove the documentation-only Host binding, draft-only command branch, and preview UI. Preserve earlier journal records as historical evidence. Prior draft retention supplies no write approval.

## Exact amendment

The [patch](../../../../packages/architecture/docs/proposals/unified-plan-documentation.patch) updates the locked Project and CLI gateway clauses, the Planner and Workflow contracts, and their registry entries. The [manifest](../../../../packages/architecture/docs/proposals/unified-plan-documentation.json) records the baseline and hashes of the before and after files.

- Baseline `92b3fe4e86e0b4a99185aa66d831af0545942444`
- Patch SHA-256 `524312433f0be06b90d71e7caa07790f09f8fb0cab0e103f7979217e54d3336e`

After approval, verify configured and unrestricted discovery, invalid directories, and explicit source selection. Check a repository with missing setup and the same repository after setup. Run an admitted Plan from the real UI and verify that one approved batch reaches goal alignment and ordinary delivery.
