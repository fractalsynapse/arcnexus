# Browser UI plugin

Stage · **Proposed**.

The plugin provides a Cordis workspace registration service and exports the
React frame and reusable browser components through one public entry.
Workspace plugins register navigation in order and contribute their own
content and header actions. Each path has one registration and a disposal
callback. Trusted feature plugins can register displays against a workspace
and dispose their registrations independently. The mounted frame observes
the registry for changes.

A command binding supplies stable snapshots, subscription, and an optional
structured submission function. The frame uses the binding for status,
measurements and availability. It owns visual state, local theme preferences
and an unsent instruction. The generic page settings editor saves a workspace's
desktop columns and display arrangement. The panel layout uses the same display
order for its mobile stack. Host admission and task lifecycle belong to the
application's future trusted transport.

## Source organization

Each React component has its own file. The public entry in `src/index.ts`
continues to collect the components and the Cordis plugin.

- `layouts/frame`, `layouts/page` and `layouts/panels` own the frame,
  workspace page and display arrangement. `layouts/panels/presets` defines
  each desktop layout in a separate file. Page Settings and the column
  renderer use the same layout definitions. The mobile stack has its own
  stylesheet.
- `displays` owns reusable display components. Feature plugins register
  them against a workspace through the UI registry.
- `controls`, `commands`, `settings/page` and `theme` group components
  by responsibility. Related hooks, types and styles live with their feature.
  Theme preferences own the saved scheme state. The theme color module
  derives presentation tokens and contrast warnings.

The [web app browser suite](../../apps/web/tests/acceptance/frame.test.ts)
checks the composed entry, responsive layout, dialogs, persistence and
controlled command interactions.
