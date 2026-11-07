# ArcNexus — architecture-directed self-development

Read [the charter](docs/charter.md) for purpose, objectives, constraints, questions,
and standards. The goal is a working ArcNexus that develops itself under human
architectural guidance. Every increment should shorten the path to that loop or
improve the loop through demonstrated use.

## Scope and authority

These instructions govern development of this repository. The generic product must
not hardcode this file, its text, or its policies. When ArcNexus is the target
project, the runtime may load these instructions and local skills normally, just
as it would load another target project's guidance. Generic tests use explicit
fixtures; self-development acceptance runs may use this real repository. These
local skills do not export ArcNexus's Git/release policy to another target project.

The architect owns purpose, boundaries, and changes to approved architecture.
Implement within the authorized objective; propose material scope changes. Existing
user authorization persists. Do not ask again for decisions already made. Skills
supply procedures within that authority; they cannot enlarge it. If local guidance
conflicts, preserve the authorized scope, identify the conflict, and continue work
that does not depend on the unresolved decision.

During self-development, the host controls approved ownership and acceptance.
Candidate edits to instructions, permissions or tests cannot grant new authority or
weaken acceptance. Recovery may use the current installed runtime at a validated
safe checkpoint; retaining a frozen supervisor is not a requirement. Record runtime
changes and reconcile uncertain operations before continuing. Preserve prior evidence
and edits; never rewrite a failed observation as success.

## Director, stewards and assignments

- The director chooses stewards from the real component catalog, with no prescribed
  count. Callers supply goals, not a fixed team.
- Assignments describe outcomes, technical requirements and acceptance criteria,
  not permitted files. The accountable steward discovers which files need changes.
- Component ownership is the only file-write scope. Never add per-assignment file
  permission lists or grant access through another steward's request.
- An inbox request links to an existing assignment when it requests that same
  accepted work. Preserve its accountable owner and acceptance criteria.
- Create another assignment only for distinct work. Do not duplicate implementation
  merely because another steward requests its result.
- Do not require agents to obtain peer agreement before implementing their own
  public contract within approved architectural authority.
- Dependencies represent required contributions, not conversational acknowledgments
  or agreement-only exchanges.

## Working style

- Deliver coherent implementation batches against accepted outcomes. Implement related
  responsibilities together when that shortens the path to usable behavior; do not
  require a separate PR or long test cycle for each small change.
- Use ArcNexus for its own development as soon as its runtime can reliably perform
  the task. Record bootstrap work still needed; do not wait for a complete studio.
- Prefer simple modules and concise functions with coherent responsibilities.
  Reuse existing code. Add abstractions, dependencies, or infrastructure only for
  a demonstrated requirement. Avoid trivial wrappers and speculative frameworks.
- No placeholder implementation or simulated output presented as delivered behavior.
- Keep execution logs, transcripts, run databases and generated evidence indexes in
  application storage outside source. Commit authored code, tests and documentation.
- One accountable owner per objective. Prefer native sequential work. Do not spawn
  agents merely to satisfy ceremony; focused independent validation may be used when
  a selected skill explicitly calls for it and the evidence warrants it.
- Keep guidance proportionate; avoid specifying implementation details ahead of
  the accepted implementation batch. Read relevant skills only; their procedures support the
  objective, not expand it.

## Simplification and reliability

Simplify within the human-approved architecture as a continuing engineering duty.
Use one canonical process and one authored source for each responsibility. Remove
superseded implementations, bypasses, duplicate state projections and redundant work;
do not add wrappers or compatibility paths merely to preserve unnecessary machinery.
Do not add layers, frameworks, alternate orchestration or recovery paths to work
around a failing process. Fix the existing path directly and remove unnecessary
machinery. Different gateways and live/simulated providers use the same application
lifecycle.

Prioritize a working MVP: one fresh real engineering task through staging, followed
by the consecutive clean cycles below. Historical recovery and feature breadth must
not become prerequisites for proving that path. Ask what could be removed if this
had to deliver within an hour; this is a scope test, not an execution deadline.

Disproportionate debugging, repeated handoff failures or operator workarounds are
signals that the design is too complicated. Diagnose the boundary, remove unnecessary
states or mechanisms, and unify the path before expanding it. Do not spend days
patching variants of the same failing design. Simplification must preserve component
ownership, checked edits, independent verification, cancellation, evidence honesty and
simulation isolation. Material changes beyond accepted scope require architectural
direction; already authorized simplifications do not need repeated permission.

Include concrete simplification findings or recommendations in status updates and
final results. Identify what was unified, removed or reused and the next useful
reduction; when none is warranted, say so briefly rather than inventing changes.
Record costs and observations outside the repository.

Qualify the simplified process through at least three consecutive error-free real
end-to-end self-development cycles before expanding it. Unexpected execution failures,
manual state repair or bypassed checks break the sequence. Expected failing regression
assertions and deliberate negative-test cases are normal verification, not failed
cycles. Changes to the execution path restart its qualification; ordinary verified
deliveries do not automatically invalidate it. After qualification, build up through
small useful increments directed and delivered by the agent system. Reuse unaffected
check evidence instead of repeating unrelated suites for each increment.

The current supported envelope and deferred scope are defined in the
[self-development MVP](docs/plans/self-development-mvp.md).

## Ownership and code quality

Use the declared gateway/library owner directories beneath `src`, `tests`, and
`docs`. Foundation owns shared build standards, release owns delivery workflows,
and the testing library owns reusable test infrastructure. Read the component YAML
definitions and their derived ownership before changing shared tooling or root files. Broad read access does not authorize writes. Import
another owner's implementation through its declared public modules; request an
owner change when the task requires private implementation changes.

Use cohesive TypeScript classes for dependencies and lifecycle state, class-based
test scenarios, and small pure helpers. After formatting, maintained code files
must fit within 500 physical lines and functions, methods, constructors, and
callbacks within 30, including comments and blank lines. Split responsibilities;
do not compress lines, add trivial wrappers, or suppress the rules. Existing strict
TypeScript checking remains enabled; explicit `any` is permitted.

Use declared owner-scoped lint, formatting checks and test-profile-selected suites
during engineering. Full repository checks belong to assembled deliveries, not
every steward activation. Formatting and lint fixes must stay within captured
writable scope. Repository-wide
`npm run format` and `npm run lint:fix` are for callers authorized to edit all
affected files; use explicit owned paths for a bounded assignment. Assembled-delivery
verification includes `npm run format:check`, `npm run lint`, type checking, ownership and guidance
validation, and the relevant built-program tests. Use `arcnexus test inspect/run`
for component selection; Node suites declare literal owner, level and tag metadata.
Host checks never reformat source.
See [code quality](docs/foundation/quality.md) for the executable contract.

## Development and release

Use the shared [release workflow](.agents/skills/release-workflow/SKILL.md) and
[ArcNexus release procedure](.agents/skills/arcnexus-release/SKILL.md) at the start
of a change and before its PR. Read-only discussion/audit needs no branch; edits do.
Create/adopt an issue, then branch from current `origin/staging` using
`codex/<issue>-<description>`. Never edit directly on `main` or `staging`.

Use issue and acceptance → documented intent → implementation with tests → assembled
verification/review → PR to staging. Record changed intent before product code; one
intent commit can cover the accepted batch. Write meaningful tests alongside the
implementation. A failing test before every edit and a full baseline run before
every refactor are not prerequisites. Preserve existing contracts and add missing
coverage for distinct risks. Documentation-only work uses document validation.

During implementation, use focused tests, builds and owner-scoped checks where they
resolve a concrete uncertainty. Assemble the batch before running long integrated,
native and CI suites. Fix failures using focused feedback, then refresh affected
integration evidence. Reuse evidence whose inputs and environment are unchanged;
repeat a full suite when integration risk warrants it, not after every small edit.
Do not claim completion or merge until applicable final checks pass. Batch size does
not change ownership, confinement, review or release authority.

Prioritize the working lifecycle and real self-development, then finish interface
breadth using that lifecycle where reliable. Apply the
[coordination rules](#director-stewards-and-assignments) during real qualification.
Keep deterministic scenarios in acceptance tests; real qualification follows the
current MVP contract. Preserve host-controlled authority across ordinary recovery.

For executable changes, test the assembled program and the default production wiring.
Fast deterministic tests may use fakes; introducing or changing real harness
behavior also needs a real end-to-end demonstration. Report local tests, build, CI,
and live acceptance separately; never substitute one for another or claim an unavailable check passed.

Keep commits and PRs issue-linked. Include a changelog entry for developer/user-visible
changes. Agents may merge to staging only after applicable verification, green CI,
and required review. Agents never approve PRs, merge to main, publish tags, or deploy
production. Remove a merged work branch after confirming the merge and no other open
PR uses it; retain main/staging. See the ArcNexus release procedure for exact gates.

Use HTTPS for origin: `https://github.com/fractalsynapse/arcnexus.git`.

## Research, verification, and process

Check primary documentation before relying on external API, version, or tool-limit
claims. A failed experiment proves its configuration, not a universal limitation.
Record versions, flags, dependencies, exact command, and source for negative findings.
Research should settle the current uncertainty, not become an open-ended phase.

Use [shared verification](.agents/skills/verification-before-completion/SKILL.md) and
[ArcNexus verification](.agents/skills/arcnexus-verification/SKILL.md) before claiming
a result. For changes to this guidance, use the
[ArcNexus guidance skill](.agents/skills/arcnexus-guidance/SKILL.md).

Verify claims against observed evidence at the current revision. After three
functionally identical attempts without progress, diagnose and change approach or
report the blocker. Waiting for an external process to change is not a retry loop.

When a defect escapes checks, a mistake recurs, or a delivered/current-batch promise
lacks verification (not a clearly deferred charter objective),
record the pattern, cost, and cheapest check that would catch it in a focused issue.
Keep unrelated process changes out of feature work. Do not build a process framework
in response to a hypothetical risk.

## CodeGraph

If `.codegraph/` exists at the repository root, use `codegraph_explore` or
`codegraph explore` before searching/reading code to locate or understand it.
If absent, skip it; do not index without the user's decision. Otherwise prefer `rg`.

## Readable implementation

Write a documentation header for every maintained class and method, including
constructors. Explain responsibility, meaningful side effects and failure behavior;
do not repeat TypeScript parameter annotations. Separate methods and top-level
declarations with blank lines, and separate imports from declarations. Group the
method body into logical paragraphs when it improves reading.

Keep descriptive scenario names without meaningless numeric suffixes. Preserve the
500/30 physical-line limits without compressing code or deleting useful explanation.
Lint checks header presence and spacing; review must still assess whether the
explanation helps a newcomer. See [the readable TypeScript standard](docs/foundation/typescript-standard.md).
