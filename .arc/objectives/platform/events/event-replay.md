---
id: "event-replay"
---

# Replay and follow retained events without loss or duplication

Provide finite replay and live follow over committed observations using the same scoped cursor semantics across transports. Preserve exact sequence identities without lossy numeric conversion. Finite reads establish a stable end cursor; follow catches observations committed during the replay-to-live transition.

Scope cursors and access to the authorized project and pinned execution. Consumers resume from the last applied cursor and deduplicate by event identity. Preserve message order and operation correlation while loading full payloads on demand.

Reader disconnects must leave workflow execution active. Reconnect and host restart recover retained observations without repeating submissions or answers.

## Observable success

- Events committed during handoff appear exactly once to the consumer.
- Browser and MCP replay agree on identities and cursor boundaries.
- Sequence gaps and values beyond ordinary numeric precision remain valid.
- Wrong-scope cursors are refused and restart preserves the selected execution.