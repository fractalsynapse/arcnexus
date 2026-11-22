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
- Sort higher-priority files first, with the lowest numeric priority listed
  first. Highlight the file paths changed by the recorded Plan.
- Use one composer across views. Try starting an operation, queueing a second
  operation from another view, steering the displayed agent, and replying to the
  recorded Planner question in preview mode. Keep these preview messages
  identifiable in the log.
