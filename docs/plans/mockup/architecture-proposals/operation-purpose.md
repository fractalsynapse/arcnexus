# Describe operations in MCP discovery

**Draft for design review.** The Architect mockup previews the proposed field and discovery description in `owner-tests.yaml`.

Add a short, nonblank `purpose` to each operation declaration. Describe what the operation does and when an agent should choose it. Use that purpose as its MCP description when the activity exposes the operation as a tool. [Current tool registration](../../../../packages/architecture/src/tools.ts#L73) · [Current discovery response](../../../../packages/execution/src/mcp.ts#L82)

Keep the operation ID as the tool name and the handler as the source of its input schema and host dispatch. Inspection and activation should use the same description. Propagate purpose through the captured operation definition and the shared tool builder so the description stays consistent in both. [Operation requirements](../../../../packages/architecture/contract.md#L35) · [Request builder](../../../../packages/architecture/src/request.ts#L135)

Verify that `owner-tests` and `owner-lint` advertise distinct purposes with the same check schema, that a missing or blank purpose is rejected, and that tool grants still follow the activity's operation list. In the mockup, edit Purpose to see the discovery description update and check that Raw and Changes show the same YAML value.
