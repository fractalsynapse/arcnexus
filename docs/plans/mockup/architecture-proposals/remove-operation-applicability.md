# Remove operation applicability

**Draft for design review.** This proposal records the direction agreed during the Architect file editor review. The mockup previews the YAML change. Backend implementation, runtime verification, and adoption are deferred until the application UI design is finalized and the exact architecture change is reviewed.

## Decision

Remove `applicability` from operation declarations and resolution. When an activity invokes an authorized command, the host runs it under the existing confinement and retains its actual exit, diagnostics, and log. The command owns its input requirements. Owner-scoped lint and format checks still return file-scope evidence for the host to verify after execution.

Today the same field governs two different stages. `owner-test-suites` can skip an owner test command before launch. `owner-format-files` and `owner-lint-files` select the host's post-run report validator and can turn an empty scope into `not-applicable`. Remove the skip behavior and keep the report validation. [Current test preflight](../../../../packages/execution/src/check.ts#L58) · [Current quality observation](../../../../packages/execution/src/quality-observation.ts#L13)

## Command inputs and failures

- Delete the owner-suite preflight from check preparation and execution. `owner-tests` runs its declared command. Foundation already fails an owner or selector that yields no registered suites. Keep the exact diagnostic and return the failure to the responsible activity. [Suite selection](../../../../packages/foundation/src/index.ts#L63)
- Owner-scoped lint and format select their inputs inside the confined command. An empty required selection or missing required configuration file fails there with a diagnostic that identifies the owner and missing input. The quality command can require an explicitly configured path or the repository's named configuration. Commands without file inputs keep their own normal exit semantics. [Owner quality path](../../../../packages/foundation/docs/owner-quality.md)
- Preserve host checks for captured authority, valid bindings and arguments, and available confinement. Data inputs such as suites and tool configuration belong to the command. Keep dependency preparation failures distinct from command failures so they cannot satisfy an expected failing assertion.

## Owner scope after execution

Associate the scope validator with the trusted Execution bindings for `owner-format` and `owner-lint`. Resolve the expected report type from that binding on the shared host check path used by both MCP calls and activity completion verification. Component activities still configure command parameters through Architecture. The mockup and operation YAML need no replacement scope or skip field. [Shared host check path](../../../../packages/execution/src/run-check.ts#L9)

The confined quality runner reports the owner, quality action, and selected paths. Before accepting a zero exit from either bound operation, require one well-formed report that matches the binding and resolved owner and lists a nonempty set of maintained paths within captured Team ownership. A missing, malformed, empty, or out-of-scope report fails verification. Preserve a nonzero command exit and its diagnostics, including when configuration loading failed before a report could be produced. A generic check's exit and log remain sufficient when its binding promises no scope report.

## Adoption and acceptance

- Prepare an exact amendment to the locked [Execution contract](../../../../packages/execution/contract.md#L41), including EX-16, EX-23 and EX-27 where they distinguish host admission, command failures, and completion verification. Bring the three operation declarations, the [Foundation quality guide](../../../foundation/quality.md), and affected role guidance into the same reviewed batch. Preserve typed argument resolution, confinement, and independent assembled checks.
- Review the activity mappings before adoption. `agent`, `manager`, `project`, and `release` had Implementation verification mapped to `owner-tests` with zero registered suites at the design baseline. Decide for each owner whether the activity requires a real suite or can omit that verification binding. Preserve historical inapplicability and check evidence under its original authority.
- After implementation, verify that an assigned owner test with zero suites launches and fails with its own diagnostic, and that lint and format fail on missing required configuration or empty required selections. Verify that valid scope evidence passes, that a zero exit with a missing or foreign scope fails, and that per-activity parameters still resolve identically for MCP and automatic verification. Prevent earlier accepted observations from satisfying the revised check when its command or evidence requirements have changed.

## Mockup review

In Architect, open `owner-tests.yaml` and turn on **Edit**. The draft opens in **Form** without Applicability. **Raw** shows the same proposed YAML, and **Changes** shows the removed line against the selected capture. The read-only revision continues to show the captured YAML, and **Save** creates a local preview revision. This review exercises the proposed editing experience and leaves runtime behavior to the later implementation.
