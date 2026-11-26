---
id: "command-parity"
---

# Preserve workflow identity across operator interfaces

Provide equivalent authorized workflow submission, reading, answering and cancellation through browser, REST, MCP and platform CLI interfaces using the shared application lifecycle. Keep operator MCP separate from activity-scoped agent tools.

Retain a durable receipt linked to the execution and exact open question. Reconnect, project switching and adapter restart recover that receipt. Closing a question preserves its draft while the gate remains open; a successful answer removes the action and resumes the original request.

For bare Run, retain the captured inventory and checkpoint the exact aggregate result before closing its round. Recovery after round completion returns that result with its original identity. An unfinished round resumes without duplicating accepted goal outcomes.

## Observable success

- Equivalent interfaces preserve command authority, outcomes and exact gate identity.
- Adapter disconnect does not stop host execution.
- Answer and cancellation retries reconcile retained state without duplicate effects.
- Recovery between round completion and receipt completion returns the original result.