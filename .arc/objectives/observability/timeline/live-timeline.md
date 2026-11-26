---
id: "live-timeline"
---

# Expose a complete live execution timeline

Capture and stream provider-exposed messages, item updates, tool calls, complete results, diagnostics, usage and final outcomes through the existing journal and evidence path. Retain exact invocation context before activation and preserve unknown events and malformed output for diagnosis. Keep credential values outside records.

Correlate observations with execution, phase, activity, model, runtime and relevant effects. Associate updates with their original item and avoid counting the same operation twice merely because host and harness both observed it.

Human output and structured streaming expose the same ordered observations before execution finishes. Preserve the acknowledged prefix across cancellation, stream boundaries and restart. Complete artifacts remain readable through existing references.

## Observable success

- A real provider workflow emits useful observations before completion.
- Tool results, refusals, usage and terminal outcomes remain attributable and readable.
- UTF-8 boundaries, unknown events, stderr and interruption preserve history without dropped observations.
- Timeline and artifact reads do not convert observations into authority.