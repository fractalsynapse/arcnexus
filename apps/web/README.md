# ArcNexus web frame

From the repository root, run `npm run build` and then `npm run web`.
Open the loopback URL printed by the server. To reuse a local port, pass it
with `npm run web -- <port>`.

Review the header and pinned workspace navigation, named site schemes,
responsive command panel, and round metrics dialog. The page gear opens
layout settings, where workspaces use one shared editor for registered
panels, desktop columns, placement and mobile display order. The frame reports
commands and metrics as unavailable until workspace integration.

The browser entry composes the UI plugin with separate workspace, command
binding, and React frame plugins in `src/plugins`.

For browser acceptance, install Chromium with
`npx --no-install playwright install chromium` and run
`npm test -- web-app`. The same suite can use an existing Chromium binary
through `ARC_CHROMIUM_PATH`. It exercises the built local entry and uses
the same composition with a controlled binding for command interaction.

## Platform setup design preview

From the repository root, run `npm run build`, then run
`node dist/apps/web/previews/platform/serve.js 38647`. Open
[the local preview](http://127.0.0.1:38647/plan/). The computer and folder
icons open Connection manager and Project manager in the shared frame.
Start with [sample providers](http://127.0.0.1:38647/plan/?providers=sample)
to exercise admission and revocation.

The preview represents registration and project entries with local fixture
state. ArcNexus is the initial project. Additional URLs can be entered and
selected for design review. Live reachability, registration and published
launcher binaries depend on the platform implementation.
