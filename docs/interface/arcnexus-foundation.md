# Foundation contract — ArcNexus

Type contract: `foundation`. Stage: **locked**. Owner: `foundation`.
Depends on: [`arcnexus-project.md`](arcnexus-project.md).

Foundation is the substrate every other component builds, checks and ships through. It owns
how work is compiled and measured, never what a component measures. Suite registration and
test selection belong to the `testing` library contract and are finalized in the libraries
stage; foundation owes the commands, the rules and the reproducibility guarantee.

## Identity

| Field     | Value                                                                                                                                                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| component | `foundation`                                                                                                                                                                                                                        |
| type      | `foundation`                                                                                                                                                                                                                        |
| paths     | `scripts/foundation`, `tests/foundation`, `docs/foundation`, `package.json`, `package-lock.json`, the TypeScript configs, `eslint.config.ts`, `.prettierrc.yaml`, `.prettierignore`, `.gitignore`, the readable-TypeScript standard |
| purpose   | keep build, type-check, format, lint and quality rules reproducible for every owner                                                                                                                                                 |

## Provides

1. **Commands.** The stable interface a steward or a caller may depend on:

   | Command                           | Obligation                                                                                               |
   | --------------------------------- | -------------------------------------------------------------------------------------------------------- |
   | `npm run build`                   | compile maintained source and fixtures into the declared generated roots, and nothing else               |
   | `npm run check`                   | type-check maintained source, tests, fixtures and tooling in one invocation                              |
   | `npm run lint` / `lint:fix`       | enforce the quality rules; `lint:fix` may only rewrite files in the caller's writable scope              |
   | `npm run format:check` / `format` | formatting over a declared maintained coverage set; documentation is excluded by design                  |
   | `npm test [owner]`                | build what it needs, then run the selected deterministic suites; the optional argument selects one owner |

   A command's name, arguments and exit meaning are contract surface. Adding a new command is
   a contract change; adding a private script under `scripts/` is not.

2. **Quality rules.** Maintained code files fit 500 physical lines; methods, functions,
   constructors and callbacks fit 30, counting comments and blanks. Every maintained class and
   method, including constructors, carries a documentation header explaining responsibility,
   side effects and failure behaviour. Imports are separated from declarations and members are
   separated by blank lines. Strict TypeScript stays enabled; explicit `any` is permitted.
   Inline suppression is unavailable, so a rule can be met only by splitting a responsibility.

3. **Generated-output policy.** `dist`, `.test-build`, `.tool-build`, `.fixture-build` and
   `node_modules` are generated. They never appear in maintained source, are never the target
   of a checked edit, and are excluded from ownership. Execution logs, transcripts, run
   databases and evidence indexes belong to application storage, not the repository.

4. **Reproducible installation.** `npm ci` from the lockfile restores the toolchain, and the
   offline dependency-preparation route can supply a confined workspace from the same lockfile
   without network access. Both are verified by the same digest of `package-lock.json`.

5. **Failure reporting.** A check failure names the command, the working directory, the exit
   code and the retained log path. A skipped check is reported as skipped and never as passed.

## Invariants

| #   | Invariant                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| I1  | One build route. There is no second command that produces a different compiled view of the same source.                                         |
| I2  | A check never writes into maintained source.                                                                                                    |
| I3  | Quality rules are enforced by tooling, not by review preference, and cannot be suppressed per file.                                             |
| I4  | Owner-scoped selection returns only that owner's suites; repository-wide selection returns the full set. Both are deterministic and listed.     |
| I5  | The coverage set of maintained files subject to formatting and lint is declared in one place.                                                   |
| I6  | Foundation never weakens an acceptance rule to let a candidate pass. A rule change is an architectural decision, recorded against the standard. |
| I7  | Tooling behaviour is identical for a human caller, a steward operation and CI; there is no separate agent path.                                 |

## Acceptance scenarios

| Id     | Given / when / then                                                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FND-1  | `npm run build` emits only the declared generated roots; a build that writes a tracked source path fails the scenario.                                       |
| FND-2  | `npm run check` type-checks source, tests, fixtures and tooling in one command, and a defect in any one of them is reported with its file.                   |
| FND-3  | A file over 500 lines or a method over 30 lines fails lint, and adding an inline suppression comment is itself rejected.                                     |
| FND-4  | A maintained class or method without a documentation header fails lint; a header that merely restates the signature is a review finding, not a lint failure. |
| FND-5  | `npm test <owner>` runs exactly that owner's suites and reports the count; `npm test` runs the full set. Neither silently includes another owner's work.     |
| FND-6  | A suite registered with metadata that does not match its file's owner and level fails at selection time, before execution.                                   |
| FND-7  | Formatting coverage and the maintained inventory agree: a maintained file outside the declared coverage is a finding.                                        |
| FND-8  | `npm ci` in a clean checkout reproduces the toolchain, and the offline preparation route installs from the same lockfile digest without network.             |
| FND-9  | A required check that cannot run is reported as unavailable and leaves the candidate unaccepted; it is never recorded as skipped-and-passed.                 |
| FND-10 | The same command run by a steward operation and by a human caller produces the same exit status and the same retained log shape.                             |

## Migration

| Current                                                                                                                | Proposed                                                                           | Reason                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Five TypeScript configs (`tsconfig.json`, `.build`, `.tests`, `.fixtures`, `.tooling`) and six `tsc` passes in `check` | Three configs: base, build, tests — fixtures folded into build, tooling into tests | Two recorded incidents came from a stale compiled view produced by the split build routes; one build route is invariant I1 |
| `npm run build` then `npm run build:tests` as separate caller obligations, plus twelve `test:<owner>` scripts          | `npm run build` and `npm test [owner]`; the test command builds what it needs      | Removes the caller trap that produced a false product failure, and removes the per-owner script list from the interface    |
| `architecture/standards/readable-typescript.yaml`                                                                      | `.arc/architecture/standards/readable-typescript.yaml`                             | Standards move with the knowledge root; content unchanged                                                                  |
| `scripts/qualification/*` and `qualification/*` compatibility entry points                                             | deleted                                                                            | Retired-campaign shims with no live caller; owned by `experiments`, not foundation                                         |
| `.tool-build/build.js` output layout                                                                                   | unchanged                                                                          | Generated roots are already declared and excluded from ownership                                                           |

The command changes are contract changes and land in the same cleanup batch that removes the
second build route, so no intermediate state offers both spellings.

## Non-goals

Foundation does not own test content, component selection policy, delivery workflows or
container packaging (`release`), the reusable suite runtime (`testing`), or the operation
catalog (`architecture` model). It provides the substrate those contracts run on.

## Lock record

```yaml
id: arcnexus/foundation
stage: locked
revision: 1
acceptedBy: Adrian Webb (architect)
acceptedAt: 2026-11-07
changes:
  - revision 1: proposed in #346 and locked with the interface unchanged, including the two
    proposed command-surface reductions, which land in the cleanup batches
```
