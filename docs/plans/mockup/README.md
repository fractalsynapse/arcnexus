# ArcNexus UI mockup

This is the source for the 14-view MVP design review. See the [wireframes](../arcnexus.wireframes.pdf) for the page map. The mockup replays a retained
refinement round and lets an operator try local interactions. Launch, queue,
steering, reply, and file edits are preview states. The design has no connection
to the CLI or live agents.

The project keeps the HTML and strict TypeScript source here. The capture, raw
transcripts, and generated preview stay outside tracked source. Use a saved
mockup capture with `npx --no-install jiti docs/plans/mockup/preview.ts <capture.json>` from the
repository root. Open the resulting `dist/docs/plans/mockup/index.html` in a
browser. The capture can contain retained operator messages and tool results,
so share the generated preview only with its intended reviewers.

For Codex design review, regenerate the preview after each revision from the
repository root using the same capture:

```sh
npx --no-install jiti docs/plans/mockup/preview.ts <capture.json> --viewer <viewer-output.html>
```

Put the output in the active chat's visualization directory and use the printed
absolute path in a fresh visualization reference. The builder uses the current
layout, TypeScript, and brand assets on each run. The embedded viewer refreshes
when the new preview is attached to the chat.

## Behaviors to review

- Read total input and output separately. Calculate cache rate from reported cached
  input divided by reported input. Show unavailable usage when there is no
  reported basis.
- Read messages and lifecycle entries in order. Expand the tool calls between
  messages, then open an individual tool to inspect its request and result.
- In Plan, compare phase elapsed time with the Planner's Codex execution time.
  Check the issue before the pull request and find the end-to-end refinement
  metrics beneath the phase details.
- Find a file by its extension-free name or description. Sort by priority and
  combine search and topic filters with Changed only. Preview topics illustrate
  the filter across captured goals and objectives.
- Use one composer across views. Start Plan and steer while the Planner is
  active. Advance the preview to simulate the approval question. Open the question,
  make a selection, return to Plan, and reopen it to verify the draft persists.
  The recorded historical question shows its existing answer and accepts no reply.
- Open a file, approval, activity, or delivery diff. Select a changed path to
  review its additions, deletions, and context.
  When delivery evidence contains excerpts, use the local patch picker to load
  the complete merge diff. An export from `git show --format= --no-color <merge>`
  works as a local patch.
