# ArcNexus UI mockup

This is the source for the 14-view MVP design review. See the [wireframes](../arcnexus.wireframes.pdf) for the page map. The mockup replays a retained
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
- Open a Plan or Architect file to see its full path and File information.
  Markdown files use the rendered body and MDXEditor. In Edit mode, use Raw
  to review or edit the Markdown syntax and Visual to return to rich text.
  Save a draft after editing in either mode. Unsupported rich-text syntax
  remains available in Raw. YAML files use a highlighted document and text
  editor. Expand either pane while editing to check draft retention.
- Open Architect’s `owner-tests.yaml` and enable Edit to try the YAML Form.
  Edit Purpose to update the MCP discovery description. Changes shows the
  proposed Purpose and the removal of Applicability and Category. Drag an
  argument or default selector by its handle. The gap marks the new position.
  Use the arrow keys on a focused handle to reorder with the keyboard. Switch to
  Raw to edit the same draft as YAML.
  Save validates the YAML with the preview schema and creates a local draft revision.
- In Run, check the metrics beside the Director and Reviewer outcomes. Expand
  an activity timeline or Changes to inspect it while retaining selected tabs
  and loaded patches. Read the issue before the PR in Delivery.
