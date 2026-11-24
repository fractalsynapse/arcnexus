# ArcNexus web frame migration

**Status** · Local shell implementation authorized in issue #704. Live gateway qualification remains pending.

## First deliverable

Build the real mobile-first React application shell. Use the approved behavior
in the local mockup on the design branch at `51a4b4f3` as the visual and
interaction reference. The first build covers the header, workspace
navigation, site theme and command panel. Use an empty content region with
workspace headings to review the frame before adding the first Plan display.

| Area                  | Acceptance                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header and navigation | The black header puts the brain mark before the wordmark, with the palette button before the header action. Plan, Architect, Run and Release remain in that order. The navigation stays pinned as the brand and header actions scroll away. Desktop navigation retains the compact centered bar and rounded lower corners. Workspace navigation updates the active tab and starts at the destination heading. |
| Site theme            | The header palette popup creates, edits and selects named schemes using the established dark-to-light swatches and custom hex field. All pages inherit the selected site scheme directly. Theme preferences survive refresh in the same browser. Individual panel scheme overrides enter scope with the first display panels.                                                                                 |
| Command panel         | The dark-gray panel stays at the bottom of the visible workspace. It starts expanded on desktop and compact on mobile. The compact strip keeps the metrics icon, status, command and expand control. Wide layouts present instruction, operation and Send in that order. Narrow layouts place the full-width operation row above the optional instruction. The metrics icon opens a viewport-centered dialog. |
| Command availability  | The composer renders availability from its application binding. Unavailable commands and missing metrics have explicit states. A controlled test binding exercises active, waiting and failed states, preserves an instruction on a failed submission and passes a structured request to the binding. Live command execution, queueing, steering and approval submission belong to subsequent feature slices. |

Keep Plan, Plan Files, Architect and Architect Files as separate acceptance
slices. Run and Release content and production release behavior remain in design
review. Their workspace labels belong in the frame now.

## Ownership and shared source

| Proposed boundary              | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui`                  | Own the Cordis UI plugin and its public entry. Export reusable React layouts and display components, including the frame, header, docked command panel, dialogs, theme controls and shared visual tokens and assets. Later slices put their reusable panel layouts, event timeline, file views and editors here. Components receive typed data, capability state and callbacks. Their rendering works with browser state and injected services. |
| `apps/web`                     | Own the web entry, trusted browser composition, navigation, workspace bindings and browser acceptance. Feature plugins contribute routes and display registrations through the UI plugin's public entry. Keep route definitions, eligible displays, default placements and operation labels in one shared composition consumed by the eventual fixture mode.                                                                                    |
| Existing host and Commands SDK | Keep command admission, workflow, retained events, artifacts and approvals with their existing owners. When live Plan integration is in scope, a thin server-side transport plugin should project the existing [Commands SDK](../../packages/commands/contract.md) for the browser. Reuse the trusted host composition currently mounted by [CLI](../../apps/cli/src/host.ts) when there is a second live consumer.                             |
| Future fixture adapter         | Supply deterministic dummy records and interactions to the same web composition. Keep fixture entry and data separate from live transport and credentials. Keep the automated acceptance suite with the shared UI and real web application.                                                                                                                                                                                                     |

Use Cordis for application and feature composition, and React for rendering and
local interaction state. Register each replaceable feature at its actual
boundary. A button or card is a React component exported by its owning plugin.
Begin with the frame's immediate consumers. Add the page layout and display
registration contracts when Plan needs to register and arrange panels, using
stable IDs for browser preferences. Preserve local theme and layout preferences
in browser storage.

The [project contract](../interface/arcnexus-project.md) requires one accountable
owner per maintained path. Propose the UI and web-app steward definitions,
owned paths, applicable activities and checks before editing them. Catalog
adoption and any locked contract changes follow the
[architecture approval procedure](../interface/README.md). Share the named
layout and display definitions through public imports from a single source.

## Implementation order

1. **Establish authority and scope.** Check the current qualification evidence
   against the [first delivery and qualification plan](self-development-mvp.md).
   It requires three consecutive clean real cycles before expanding the
   surface. The latest tracked [qualification record](efficiency-foundation.md)
   records 0/3. The [locked CLI gateway](../../apps/cli/contract.md) reserves
   further launch surfaces for later qualification. Begin production
   implementation after qualifying or after the architect approves an exact,
   shell-only exception. Such an exception should cover a local browser frame
   with unavailable live commands while leaving live web access subject to the
   existing gate. Record acceptance in an issue and start its issue-numbered
   branch from current `origin/staging` using the
   [repository delivery procedure](../../.agents/skills/arcnexus-release/SKILL.md).
   Keep the approved mockup revision available for comparison.
2. **Prove the browser entry and plugin boundary.** Set up the real web entry
   and the UI plugin with one React root. Use the React dependencies already
   in [the manifest](../../package.json) and maintained strict `.ts` source.
   The existing [TypeScript standard](../foundation/typescript-standard.md)
   and specification check require `.ts`, and the mockup's
   Markdown editor already uses React's typed element
   API in that format. Integrate browser bundling into the existing build
   workflow and emit assets under `dist/`. The
   mockup builder already demonstrates browser bundling
   with esbuild. Pin the production build dependency through the package
   manifest and lockfile. Exercise the built asset in a real browser and verify
   that the browser bundle contains only browser dependencies.
3. **Implement the shared frame.** Capture a failing acceptance check for the
   shell behavior before implementing it. Move the approved frame styling and
   assets into the UI package as the production source. Implement the heading
   and navigation focus behavior, the site theme popup and persistence, then
   the docked composer and round-status display. The web application supplies
   route and command context through the registered bindings. Capture
   unavailable capabilities explicitly. Use the test binding to exercise the
   composer and metrics popup without starting an agent.
4. **Verify and review the assembled slice.** Use the existing
   [Foundation check workflow](../foundation/quality.md), including
   specification and ownership validation, format and lint, strict type
   checking, build and applicable owner tests. Add browser acceptance to the
   existing test entry through Foundation. Confirm navigation, theme
   persistence, command availability, keyboard and focus behavior, and dock
   behavior on desktop and mobile against the approved reference. Check that
   unavailable observations remain visible as such and that rendered shell
   controls cannot trigger a host operation. Present the built local app for
   frame approval. Record local browser evidence separately from hosted CI
   and live qualification.

## Follow-on slices and convergence

1. **Plan** registers the first real displays and the reusable page layout and
   panel controls. At this boundary, settle the live adapter contract against
   the actual Commands implementation and retained journal. For the local
   app, use a same-origin server adapter backed by Commands. Keep project
   selection and command authority on the trusted host. Use persisted event
   identity and ordering to replay on reconnect without repeating submissions.
   Verify command availability before exposing it. The current SDK offers
   planning, architecture update, run, refinement and an observer for progress
   and answers. Live steering and queue behavior visible in the mockup need
   separately verified host support.
2. **Plan Files** adds the shared file information, revision, Markdown and diff
   displays. Keep editing and validation behind the owning service boundary.
   Approve this reusable file experience before applying it to Architect.
3. **Architect** reuses the Plan layout, event log and metrics components with
   Architect's own registered data and operations. Preserve its exact proposal
   and approval semantics.
4. **Architect Files** reuses the file experience and adds a schema-backed
   YAML form and Raw view. Use the owning schema as the validation source.
   Architecture proposals shown in the current mockup still need the
   applicable approvals before their behavior becomes live.
5. **Unify the mockup after those live slices are approved.** Switch the active
   mockup to the same web composition and UI package with the fixture adapter.
   Confirm that changing a shared layout, display or registration changes both
   builds from that one edit. Remove the replaced mockup source for those
   views. Keep the reviewed version of the legacy Run and Release screens as
   a reference until their own migration. The shared fixture mode uses dummy
   data and runs locally. Keep automated tests with the shared UI and the
   real web application.
