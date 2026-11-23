# ArcNexus UI mockup

This is the source for the MVP design review. See the [wireframes](../arcnexus.wireframes.pdf) for the original page map. The mockup replays a retained
refinement round and lets an operator try local interactions. Launch, queue,
steering, reply, and file edits are preview states. The design has no connection
to the CLI or live agents.

Keep backend changes surfaced during UI review in the [architecture proposals](architecture-proposals/README.md) collection.

The project keeps the HTML and strict TypeScript source here. The capture, raw
transcripts, and generated preview stay outside tracked source. Use a saved
mockup capture with `npx --no-install jiti docs/plans/mockup/preview.ts <capture.json>` from the
repository root. Open the resulting `dist/docs/plans/mockup/index.html` in a
browser. The capture can contain retained operator messages and tool results,
so share the generated preview only with its intended reviewers.

For inline Codex file review, generate a focused preview using the same capture:

```sh
npx --no-install jiti docs/plans/mockup/preview.ts <capture.json> --file .arc/goals/inspect-parity.md --viewer dist/docs/plans/mockup/arcnexus-mdx-file-review.html
```

Use the printed project-local absolute path in a fresh visualization reference.
The same editor and file panels run in both builds. The full browser preview
retains the complete round and navigation.

## Behaviors to review

- Open page settings from the gear before the title. Choose a desktop
  layout, place the active panels in regions, or use **Available panels** to add
  a panel. Reorder the active list with its drag handles or arrow keys. On
  desktop, drag column dividers or use their arrow keys. The layout is saved in
  the current browser for that page. Site appearance applies across pages, and
  each panel has a gear for its own overrides. Open a color field to choose
  from dark-to-light swatches or enter a custom hex color. Use **Save** to apply
  the settings or **Close** to discard the draft.

- Read total input and output separately. Calculate cache rate from reported cached
  input divided by reported input. Show unavailable usage when there is no
  reported basis.
- Read messages and lifecycle entries in order. Expand tool calls and inspect a
  request, result, or final response without leaving the current scroll position.
  Expand objects and arrays in structured responses as needed.
- Expand an event log, file explorer, or changes panel to focus on it. Collapse
  the panel to return to the page layout with filters, open tool groups, and
  drafts preserved. Follow a page link to start at its heading.
- In Plan, compare phase elapsed time with the Planner's Codex execution time.
  Expand Tools by frequency below the metric rows. Check the issue before the
  pull request, then use the Round metrics icon before the footer state readout
  to open the detailed round metrics.
- Find a file by its extension-free name or description. Sort by priority and
  combine search and topic filters with Changed only. Preview topics illustrate
  the filter across captured goals, objectives, and architecture files. In a
  file's Edit view, use the matching suggestions or type a new name and press
  Enter. Use the arrow keys to select a suggestion. Save to make a new topic
  available in the explorer.
- Use one composer across views. On wide layouts the instruction, operation,
  and Send share one row. On narrow layouts the operation and Send fill the
  top row, with the instruction below them. Start Plan and steer while the
  Planner is active. Advance the preview to simulate the approval question. Open the question,
  make a selection, return to Plan, and reopen it to verify the draft persists.
  The recorded historical question shows its existing answer and accepts no reply.
  Advance Run through its recorded actor roster and steer the active Director,
  steward, or Reviewer from the matching view.
- Open a file, approval, activity, or delivery diff. Select a changed path to
  review its additions, deletions, and context. When delivery evidence contains
  excerpts, use the local patch picker to load the complete merge diff. An
  export from `git show --format= --no-color <merge>` works as a local patch.
- Open a Plan or Architect file to see its full path and File information. Use
  **Git information** at the right of the breadcrumb for the file revision and
  repository capture.
  Markdown files use the rendered body and MDXEditor. In Edit mode, use Raw
  to review or edit the Markdown syntax and Visual to return to rich text.
  Save a draft after editing in either mode. Unsupported rich-text syntax
  remains available in Raw. YAML files use a highlighted document and text
  editor. Expand either pane while editing to check draft retention.
- Open any Architect operation and enable Edit. Purpose comes first and grows
  with the text. Command operations expose command settings,
  arguments, and configured parameters. Raw shows the ID and handler. The
  operation draft shows the proposed Purpose and removal of Applicability and
  Category. The current host requires network access to be disabled for
  confined checks.
- In a component, edit the catalog Summary above the collapsed Purpose field.
  Purpose and each activity instruction use the Markdown file editor when
  expanded in Edit mode and the Markdown viewer on a captured revision.
  Collapse a long field from the bottom, or open it fullscreen from its header.
  Closing fullscreen returns focus to the collapsed field and keeps draft
  edits. As the editor scrolls, its toolbar pins directly below the fullscreen
  header. The read-only page keeps the complete source under Raw YAML.
  Use Objectives, Constraints, and Ownership to review one list at a
  time. Each tab describes its list above the editable rows. Reorder the
  milestone sequence with the drag handles or their arrow keys. Expand an
  activity to change its participation, instructions, operation bindings,
  standards, and verification references. A host activity has no model
  profile. Use Raw for named-map changes such as adding an activity or
  declaring a new parameter.
- Reorder lists with the drag handle or its arrow keys. Check the same draft
  in Form, Raw, and Changes. Save applies the mockup's Zod validation and
  creates a local draft revision.
- In Run, check the metrics beside the Director and Reviewer outcomes. Expand
  an activity timeline or Changes to inspect it while retaining selected tabs
  and loaded patches. Read the issue before the PR in Release.
- In a milestone's Self-review or Release activity, open the Testing inbox
  from the routing preview. Select a rejected run revision to see the recorded
  Direction action on Review. The goal's Release view previews the final release route beside
  any captured hosted check failures.
- In Plan's goal file explorer, open **Reduce repeated Planner file discovery**
  and select **Progress**. The dialog shows an illustrative baseline and latest
  verified value of 24 `list-files` calls per activation (median), against a target
  of 12 or fewer. Follow **View strategy in Run** to see the candidate result of
  16, then open the `planner` assignment to check the method and citation quality check.
- In the Planner example, open **Activities → Release** to see its published
  checkpoint. Return to Run and open **Release** to expand the four evidence
  stages. Use **Example release state** to see alternatives waiting for review, verifying after
  merge, failing a post-merge check, and verified on staging. Recorded goals
  show which milestone and post-merge observations were retained.
- Open **Release** from the header after Run. Prepare revision B, simulate C's
  verification, and check that the prepared scope still includes A and B. Select
  C to preview A through C, then replace the candidate to pin the new scope.
- Pin revision B and use **Release scenario** under **Production release**.
  Try the specialist rejection, then switch scenarios to review the release
  approval, simulate merge, tag and publication, and run the post-release
  checks. The failure scenario opens an illustrative production incident in Run.
