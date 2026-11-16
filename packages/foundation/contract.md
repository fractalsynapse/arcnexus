# Foundation contract

Stage: **locked**. See the [registry](../../docs/interface/registry.yaml) for authority and history.

## Obligations

Provide one set of build, type-check, lint, formatting and test commands for the project:
`npm run build`, `npm run check`, `npm run lint`, `npm run lint:fix`,
`npm run format:check`, `npm run format`, and `npm test [owner]`.
Keep build configuration and repository-wide scripts shared. Tests and scripts for
one plugin live with that plugin. A suite's owner comes from its path. Its level and
tags describe selection and must agree with the catalog. Build only into declared
generated roots. Use the [readable TypeScript standard](../../docs/foundation/typescript-standard.md).

The same command means the same thing for a person, a steward operation and CI.
Read-only checks never change source. Fixers act only within caller scope.
Retain the command, directory, exit code and log reference for failures.
Install dependencies reproducibly from the lockfile. Offline dependency preparation
is deferred.

## Acceptance scenarios

| ID | Observation |
| --- | --- |
| FND-1 | `npm run build` emits only the declared generated roots; a build that writes a tracked source path fails the scenario. |
| FND-2 | `npm run check` type-checks source, tests, fixtures and tooling in one command, and a defect in any one of them is reported with its file. |
| FND-3 | A file over 500 lines or a method over 30 lines fails lint, and adding an inline suppression comment is itself rejected. |
| FND-4 | A maintained class or method without a documentation header fails lint; a header that merely restates the signature is a review finding, not a lint failure. |
| FND-5 | `npm test <owner>` runs exactly that owner's suites and reports the count; `npm test` runs the full set. Neither silently includes another owner's work. |
| FND-6 | A suite registered with inconsistent owner or level metadata fails validation before execution. Registration cannot override the path owner. |
| FND-7 | Formatting coverage and the maintained inventory agree: a maintained file outside the declared coverage is a finding. |
| FND-8 | An npm ci in a clean checkout reproduces the locked toolchain. |
| FND-9 | A required check that cannot run is reported as unavailable and leaves the candidate unaccepted; it is never recorded as skipped-and-passed. |
| FND-10 | The same command run by a steward operation and by a human caller produces the same exit status and the same retained log shape. |
