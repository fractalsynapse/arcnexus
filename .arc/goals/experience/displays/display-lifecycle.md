---
id: display-lifecycle
priority: 220
---

# Keep workspace displays independent and context-consistent

Each enabled display requests its resources under the selected project, execution, revision and authorization context. Load detailed files, tool payloads and secondary metrics on request. Disabled displays release requests and subscriptions when no consumer remains.

Preserve request and cursor state as displays move or resize. Share equivalent requests only within matching context. Give each display explicit loading, empty and failure states so one unavailable resource does not disable unrelated displays.

Persist layout and theme preferences under stable display identities. Reuse the same approved composition and presentation in fixture previews and the real application.

## Success measures

- Network observations show no resource loading for disabled displays.
- Moving panels preserves subscriptions and review state.
- Shared requests remain until their last consumer leaves.
- Resource failures stay local, and project or execution changes cannot expose stale data.
- Browser preferences survive refresh and shared presentation stays consistent.
