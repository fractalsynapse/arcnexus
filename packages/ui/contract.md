# Browser UI plugin

Stage · **Proposed**.

The plugin provides a Cordis workspace registration service and exports the
React frame and reusable browser components through one public entry.
Workspace plugins register navigation in order and contribute their own
content and header actions. Each path has one registration and a disposal
callback.

A command binding supplies stable snapshots, subscription, and an optional
structured submission function. The frame uses the binding for status,
measurements and availability. It owns visual state, local theme preferences
and an unsent instruction. Host admission and task lifecycle belong to the
application's future trusted transport.

The [web app browser suite](../../apps/web/tests/acceptance/frame.test.ts)
checks the composed entry, responsive layout, dialogs, persistence and
controlled command interactions.
