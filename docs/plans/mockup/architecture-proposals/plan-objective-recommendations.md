# Documentation-first objective recommendations for Plan

**Implementation checkpoint.** The exact contract amendment is applied. The Plan recommendation and onboarding flow is implemented on the issue branch.

[Approved follow-up](unified-plan-documentation.md) supersedes the draft-only design recorded here and adds documentation directories to project settings.

## Exact amendment for approval

Review the [exact patch](../../../../packages/architecture/docs/proposals/plan-objective-recommendations.patch) and its [manifest](../../../../packages/architecture/docs/proposals/plan-objective-recommendations.json). The manifest records the Git baseline and the before and after SHA-256 digests for every file.

- Baseline `32a59d7149170a2bac76592b5d59d1c95b0dab02`
- Patch SHA-256 `61275ce6ad058756dc7261b805bda2a6f7f1a3a7cb97fea544a514c9b28db8d4`

The amendment changes the locked Project and CLI gateway contracts, their registry entries, and the dependent Plan contracts and guidance. The Project clause permits documentation-only discovery under a trusted read-only binding. The CLI clauses retain exact human authorization for objectives and send goal edits through independent review and verified staging. Architect approval stays governed by its current contract.

On November 26, 2026, Adrian Webb recorded the approval and delegated application in Codex chat: “I approve the exact Plan amendment `61275ce6` and authorize Codex to apply it.” Codex verified the manifest preimages before applying the patch and matched every resulting file to its approved digest.

## Outcome

**Recommend objectives** is checked by default when someone selects Plan in the web command panel. The Planner reads the project’s existing documentation, identifies gaps in its objectives, and brings source-linked recommendations to the architect. Once the architect approves the objective wording, Plan aligns the goals and sends any resulting goal changes through independent review and verified staging delivery.

## 1. Read documentation before requiring migration

- Build one shared documentation reader over an authorized repository and a pinned Git revision. Discover relevant sources from the repository’s contents. Let the architect point to particular files or directories in the instruction field. Use the same reader for discovery and explicit selections, and record which sources the Planner actually consulted.
- Support a read-only connection for repositories that have yet to adopt ArcNexus. Run the same recommendation activity through a platform-owned read-only binding. Retain the objective drafts, source citations, and review discussion with the project so someone can start with the documentation they already have.
- Carry those drafts into Plan when the repository has a valid catalog and delivery configuration. Preserve the original citations. If a newer capture changes the evidence behind a draft, show the change before approval. Publishing objectives and running goal alignment use the normal admitted project workflow.

## 2. Organize objectives and goals into categories

- Use named directories under the project’s configured knowledge root, such as `objectives/efficiency/reduce-context-overhead.md` and `goals/efficiency/reduce-repeated-file-discovery.md`. Derive categories from directories and use topics for cross-category filtering.
- Keep stable IDs in metadata. Preserve existing objective identities, refinement links, goal IDs, and priorities during migration. A move or rename preserves identity. Historical file links resolve at the captured revision, and stale saves require a fresh capture.
- Share one recursive guide lookup and path validator across Planner, Data, file editing, and the Run inventory. Use the same rules to validate model proposals and direct edits.

## 3. Run one durable Plan session

| Web command input | Behavior |
| --- | --- |
| Recommend objectives checked | Discover and recommend objectives. The instruction can supply focus or point to sources. |
| Unchecked, instruction blank | Assess the standing objectives and goals. |
| Unchecked, instruction filled | Preserve the exact text as the architect’s objective submission and review the proposed record. |

- Put recommendation mode in the shared `task_plan` request. Web, REST, MCP, and `arcnexus task plan --recommend-objectives [<focus>]` dispatch through Commands. Keep scheduled refinement on the standing-inventory assessment so the web checkbox only affects the session it launches.
- Register a read-only Planner recommendation activity. Compare the documentation with existing objectives and goals. For each candidate, show the proposed wording, category, cited evidence, and gap it addresses. When the sources support no new objective, explain what was assessed and continue the standing-inventory assessment.
- Reuse the durable question receipt and the shared dialog, Markdown editor, and diff viewer. Let the architect approve selected drafts, edit them, request revisions, or decline the batch. Edits and requested revisions produce a new diff. Bind approval to the selected bytes and captured baseline. Refresh and restart restore the exact pending question and previous answers. Declining the batch ends the recommendation session.
- Pass the approved objective bytes into the existing goal-alignment activity. Show the links and goal diffs in Planner outcome. Route goal changes through checked edits, independent review, and staging, with review findings returning to Planner for repair. If alignment requires no goal changes, deliver the approved objectives on their own. A repair that changes approved objective wording reopens objective review.
- Use the shared file editor for direct objective and goal edits. An objective **Save** records the architect’s exact revision-bound edit as authorization. Goal edits use the same verified delivery route as Planner-generated goal changes.

## 4. Verify and deliver

- First, obtain approval of the exact amendment above. Apply the Project and CLI clauses, Plan contracts, scenarios, and steward guidance together. Establish failing public regressions before changing runtime behavior. [CLI gateway contract](../../../../apps/cli/contract.md)
- Test both a configured project with unconventional documentation paths and a repository with documentation but no ArcNexus catalog. Verify that both produce source-linked recommendations and that onboarding drafts survive project admission.
- Test the checked default, explicit objectives, nested files, renames, historical reads, and stale saves. In an isolated end-to-end session, revise a draft, restart while the review is pending, approve a subset, and verify that goal alignment receives exactly the approved wording. Verify that resulting goal edits reach independent review without a human approval prompt.
- Run the affected owner suites and specification checks, then verify the built Web, gateways, Host, and PostgreSQL together. Finish with a real recommendation session on ArcNexus and inspect the sources, retained decisions, and delivered guide changes in Plan.

## Implementation checkpoint

- Planner, Data, and the Run inventory share categorized guide lookup. The eight goals and four objectives retain their original IDs, priorities, refinement links, and body bytes. The API checks stable links at both the current and earlier captured revisions.
- Plan sends proposed and directly edited goals to independent review without a human approval prompt. Explicit submissions wait for exact objective review, and a direct objective save retains the operator's revision-bound bytes as authorization. Plan File uses one save component for both kinds of guide.
- Plan's checked-by-default control and the CLI `--recommend-objectives` option use the shared command request. The Planner reads committed Git objects through the read-only list and read tools. Review retains exact diffs, selections, edited text, feedback and citations in the existing approval path. Goals proceed to independent review after objective approval.
- The original implementation retained documentation-only drafts in the PostgreSQL journal. Those records remain historical evidence under the [approved follow-up](unified-plan-documentation.md).
- An isolated live Codex run on the ArcNexus project produced three source-cited proposals and paused for human review. No objectives were approved or published in that check. The cases for edited wording, resumed approvals, selected drafts, changed citations, and a repository without a catalog are covered by the relevant Planner, browser, and PostgreSQL suites. Candidate CI, independent review, and deployment remain separate.
