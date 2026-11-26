---
id: "display-lifecycle"
---

# Keep workspace displays independent and context-consistent

Let each enabled display request the resources it needs under the selected project, execution, revision and authorization context. Load detailed files, tool payloads and secondary metrics when requested. Disabled displays release requests and subscriptions when no consumer remains.

Preserve request and cursor state while displays move or resize. Share equivalent requests only within matching context. Give each display explicit loading, empty and failure states so one unavailable resource does not disable unrelated displays.

Keep layout and theme preferences persistent under stable display identities. Reuse the same approved composition and presentation in fixture previews and the real application.

## Observable success

- Network observations show no resource loading for disabled displays.
- Moving panels preserves subscriptions and review state.
- Shared requests survive until their last consumer is removed.
- Resource failures remain local, and project or execution changes cannot leak stale data into a display.