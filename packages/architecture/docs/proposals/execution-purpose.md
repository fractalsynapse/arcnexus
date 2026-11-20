# Execution: purpose for architectural review

Execution makes an Agent's authorized activity happen on the host and makes its
effects recoverable, attributable and observable. Its consumer is the sequential
Workflow, which asks an Agent to perform a selected activity for an accepted
milestone. Execution prepares the actual environment, connects the Agent to the
configured provider, mediates project operations through local MCP, retains the
results and secures acknowledged changes. The useful outcome is engineering work
that survives interruption and can be independently assessed. Merely starting a
model process, obtaining plausible prose or creating a Git commit does not establish
that outcome. Execution must make it possible to explain what was requested, what
actually ran, what changed, what failed, what was retained and why the next activity
may proceed.

The central conceptual entities are Agents and Teams. An Agent combines a
component's purpose, the selected activity, role, approved profile, instructions,
standards, operations and current assignment. A Team provides the available agents
and resolves resource ownership. Execution does not maintain a competing steward
catalog or guess ownership from informal task wording. It uses the currently
adopted architecture and the Team service. The Director, stewards and independent
Reviewer use the same Agent request builder; their differing responsibilities and
capabilities come from explicit activity mappings. Execution supplies the host
boundary underneath those mappings, rather than replacing them with a second
conceptual model based on raw provider sessions or command-line invocations.

ArcNexus initially executes sequentially on host hardware. A task contributes to
one issue-linked branch, and each attempt has a fresh task worktree reconstructed
from retained checkpoints. This is a deliberate foundation for understandable
recovery and ownership. It is not an invitation to add concurrency, containers,
hierarchical schedulers or worktree pools in anticipation of future requirements.
Future providers and environments should replace an actual interface when a
demonstrated need justifies that change. Existing apps call transport-neutral
services. A CLI, MCP gateway or API gateway should not need to reproduce worktree
management, activity supervision, check execution or retry policy to use them.

Execution has two distinct kinds of concern. As a product plugin, it provides
generic host services to any supported target project. As a component steward, its
Agent maintains the Execution plugin's code, tests and documentation. Repository
instructions govern that engineering work when ArcNexus develops itself, but the
generic product must not hardcode this repository's charter, package names,
release policy or preferred profiles. A generic fixture explicitly supplies the
project architecture and local provider binding it needs. A real self-development
qualification intentionally uses this repository and identifies the exact runtime
and source revisions. Confusing these cases produces fixtures that accidentally
depend on live developer state or product code that only works for ArcNexus.

Workflow owns sequencing and durable activity progression. Direction owns goal
planning, legitimate plan revision and issue creation through Collaboration.
Coordination owns the existing project writer, journal and retained positions.
Architecture resolves approved authority and assembles the sole model request.
Agent represents the selected actor and invokes its activity. Verification owns
the assembled checks and final independent verdict. Delivery owns GitHub
publication and observation of uncertain external effects. Execution cooperates
through those public interfaces. It must not quietly take over planning,
independent acceptance or release decisions merely because it controls processes
and files. The boundaries should be visible in a short call path that a newcomer
can follow from the app to the effect and its receipt.

Admission establishes the target project, its approved architecture and the
configured local execution binding before engineering effects begin. The host
checks the repository identity, staging policy, working-tree conditions and
required bindings. It claims the project's existing Coordination writer rather
than creating another lock or scheduler. Sequential child phases share that
foreground ownership. An invalid admission is a precise diagnostic, not an excuse
to search PATH for a convenient provider, use another model, mutate a dirty tree
or create an alternate project state directory. The user's intended project and
approved configuration matter more than obtaining any successful invocation.

The accepted task plan is canonical host state. Execution receives the actual
milestone and activity selected by Workflow and enforces the corresponding
component's captured write scope and operation mappings. An accepted milestone
describes an outcome and criteria; it is not a list of permitted files. Its
accountable steward discovers the necessary owned changes. A supplier request does
not extend that scope. If another owner must contribute, Direction sequences the
contribution before the requester resumes. Execution preserves the original
milestone, acceptance identities and checked work while that happens. It should
not fabricate a new milestone merely to wrap a local tool error.

The source revision used as the engineering base and the approved architecture
version used by the next activation are related but distinct. The engineering
base determines the candidate diff and publication relationship to staging. An
exact approved architecture update may advance active authority between
activities without moving that base. The host first checks the exact proposal,
its human receipt and baseline, applies approved bytes through the protected path,
validates the resulting architecture and available implementation, revalidates
pending work and records adoption. An in-flight request keeps its actual
architecture identity. A later request uses the newly adopted version. Neither
freezing the entire task indefinitely nor reading arbitrary candidate declarations
as immediate authority is acceptable recovery.

Architecture adoption must be coherent. The next request, Team lookup, operation
parameters, MCP grants and required activity verification must agree on the same
version. An unavailable handler or executable cannot become usable just because
its declaration was approved. A candidate edit to a registry, standard, directive
or permission cannot approve itself. An incompatible retained owner or pending
activity needs a concrete diagnostic before progression. Historical results remain
associated with the authority under which they were produced. Updating a profile
for future work does not relabel prior token usage or turn an earlier failed
check into a pass. The combined candidate still needs independent verification
and staging delivery.

Provider invocation uses the same request builder as inspect. Inspection is
valuable because a person can see the complete selected context, its sources and
the task placeholder before spending a model invocation. Production wiring must
not insert a second private prompt with different grants or silently omit material
shown by inspect. The architect accepts the existing complete request string. Preserve the full
component purpose and selected activity procedure within it, with clear source
boundaries distinguishing guidance, task data and observations. Codex normally discovers AGENTS.md and skills from its
environment. Execution ensures that discovery sees approved guidance, without
selecting and pasting another copy into the request. This rewrite improves the actual operating text without requiring a new
request channel, provider adapter or CLI contract.

Local MCP is the project-operation boundary exposed to an Agent. It presents only
the selected activity's mapped operations and exact argument schemas. Native
shell, arbitrary tool names and unapproved operations are unavailable. Built-in
web access is a separate provider policy, resolved from the approved execution
profile; project MCP neither silently enables it nor disables it in contradiction
to the configured provider. Operation descriptions, host enforcement and tests
must describe the same behavior. A model's final response cannot smuggle effects
around the tool path by embedding an unchecked edit array, raw command or implied
research request. Effects happen during the authorized operation and return their
actual receipt to the caller.

An edit reads and writes one file through the checked path. It names the path,
expected current content identity and proposed replacement or supported transform.
The host resolves ownership, refuses unsafe aliases, validates the preimage and
checks protected-source rules before mutation. A successful write is checkpointed
and its receipt retained before acknowledgment. If a later file is refused, earlier
acknowledged files remain successful. The requesting activity receives the actual
refusal and can correct that call without writing the earlier files again. A
stale hash means the steward must read the actual current file and decide the
appropriate update; it does not authorize overwriting an unexpected version.

File transformations are conveniences within that same checked edit, not another
write authority. A literal replacement must identify the intended existing text;
formatting uses the configured supported transform and produces actual formatted
content under the same confinement. Tools should not accept invented formatting
fields that happen to look plausible. A formatter failure returns its exact log
and leaves the source truthfully represented. Complete-file reads and actual
replacement content remain available. Do not add a paging protocol, content
ceiling, report truncation or arbitrary edit budget to make transport easier.
Use the harness's supported I/O and preserve the evidence of any real external
failure.

Checks execute the resolved operation, with typed defaults and explicit
component/activity overrides applied by Architecture. Host identity values, such
as the accountable owner, cannot be replaced by model arguments. Argument tokens
expand as data into argv; they do not introduce a shell or expression language.
The operation determines its executable, working directory and confinement. The
result records actual command, arguments, directory, status, duration and log.
Changing a relevant parameter changes what was checked and therefore changes the
applicability of its previous evidence. Inspection and execution must show the
same resolved configuration rather than two independently interpreted versions
of an operation declaration.

Verification is selected by declared applicability and category. Formatting,
lint, TypeScript/build and relevant behavioral tests address different risks.
The presence of an owner's suite is not a substitute for the others, and the
absence of a suite does not waive applicable quality checks. Required activity
verification is run before the host accepts completion even when the model omits
the call. A model cannot weaken a required passing operation by predicting that
it should fail. Testing may separately establish a deliberately failing
regression; its evidence must identify the intended behavioral assertion, rather
than accepting a dependency failure, missing executable, invalid fixture or
disabled native test as useful red.

Reusable evidence is valuable when its relevant inputs and environment are known
to be unchanged. Execution retains actual observations, including failures, so a
returning activity can read what already happened and avoid repeating an
identical expensive check. A changed relevant input requires a fresh observation.
Unknown coverage requires a conservative check; it does not justify a speculative
dependency-analysis framework that continually reconstructs every package's
possible influences. Foundation provides shared tools and selection semantics.
The accountable component supplies its realistic fixtures and declared test
strategy. Keep applicability and reuse decisions inspectable enough that a person
can explain why the observation applies to this candidate.

A failed project operation returns to its caller with exact status, diagnostic,
log and retained successful receipts. That caller is normally best placed to
correct an argument, read a stale preimage, fix an assertion or repair owned code.
Workflow can rewind within the existing milestone to the earliest activity that
can change the outcome, then repeat affected downstream work. Documentation fixes
intent; Testing fixes an incorrect test or fixture; Implementation fixes product
behavior. Self-review rejection uses those local routes. An explicit cross-owner
or scope escalation engages Direction. Final independent rejection also returns
to Direction so the remaining plan can address criterion-linked integration
findings. These are distinct routes, not interchangeable retries.

Repeated unchanged failure is a diagnosis, not a reason to add an attempt count.
Compare the finding with relevant checked inputs and preserve the complete
originating issue as further diagnostics appear. Meaningful progress can justify
another correction in the same run. Repeating an unchanged error without new
inputs needs an actionable escalation or durable hold. Do not weaken acceptance,
invent a passing test, switch profiles automatically or create another recovery
engine to keep the process moving. Simplify the existing path when state and
handoff complexity prevents useful progress. Quantitative limits require express
human approval recorded in the project's accepted-limits log; provider constraints
are observed honestly instead of reproduced as arbitrary application budgets.

Questions and research preserve the requesting activity. A clarification is
bound to its actual caller, assignment and accepted criteria, and its complete
answer is recorded before the activity resumes. Research is optional and belongs
to the requesting component's research activity. The report addresses the full
question, records external sources and applicability, and can be archived for
later reuse. An answered question, completed report or acknowledged edit must
survive retry and approved in-run architecture adoption. The next request should
receive the complete answer and current observations, not merely a reference
that suggests an answer might exist or a paraphrase that loses the deciding
condition.

Checkpoint identity is part of the public recovery story. Execution secures
authorized changes on the task branch and uses Collaboration to push them with
issue-linked history. A crash after acknowledgment can leave a worktree and an
uncertain remote push. Restart observes the branch and retained checkpoint before
repeating mutation, preserves actual checked contents and removes only the
task-owned abandoned workspace. It reconstructs a fresh worktree from the
retained state and resumes the next legitimate position. It does not create
another issue or PR because the local directory disappeared. It does not discard
failed observations to manufacture a clean history. Publication reconciliation
belongs to Delivery; Execution supplies the exact branch, candidate and retained
local evidence that Delivery needs.

Cancellation must stop managed work and preserve recoverable state. The host
forwards the cancellation signal through the provider and operation process
groups, waits for managed descendants to stop, retains acknowledged checkpoints
and records an accurate terminal outcome. Cleanup removes the task-owned
worktree after protecting checked changes. Cleanup failure is a real failure,
with its evidence, rather than an invisible epilogue after a reported success.
Read-only planning workspaces follow the same identity discipline. Never remove
an arbitrary directory or kill an unrelated process merely because its name
resembles a prior task. Retention and cleanup should be derivable from the
existing journal and task identity, without a parallel recovery database.

Execution must be observable while work happens. Retain the exact request and
configuration, every exposed provider event, messages, tool calls/results,
stderr, errors and available usage. Preserve unknown event types and interrupted
records rather than silently filtering them away. Correlate native activation,
MCP call, checked file, checkpoint, check and publication observations using
durable journal identities and complete artifacts. The foreground observer
streams those observations to transport-neutral callers. Human CLI output and
JSONL output represent the same underlying events; they must not develop
separate orchestration logic or conceal a failing effect behind optimistic
progress narration.

The timeline is evidence, not another source of authority. Acting stewards can
read authorized current and retained observations through mapped file access.
They use it to see which work completed, which answer arrived, which check is
current and where effort was spent. Complete raw content stays in readable
artifacts; the task journal can index it by durable reference rather than
duplicating a large transcript inside every state read. References must be
retrievable and unambiguous. Do not discard the original material, summarize
away a diagnostic, or claim to capture provider internals that the harness does
not expose. Mark unavailable fields as unavailable.

Measure elapsed work and provider-reported tokens continuously for the whole
invocation and each actual execution profile. Preserve the profile alias and
resolved provider model/settings. Input, cached input, cache-write, output and
reasoning observations retain their provider semantics; subset fields are not
added twice. Separate wall time from inclusive nested activity and tool durations.
Missing usage remains unknown rather than zero. Cost estimates identify their
verified dated pricing or configured billing basis and are distinguished from
billed cost or subscription entitlement. Expensive work does not itself grant
permission to change an approved profile or impose a new work budget.

The measurements should improve decisions. A steward can compare a direct local
repair with repeated Director replanning, a reused applicable check with a fresh
run, or a corrected fixture with another activation that repeats the same wrong
assumption. Judge those differences against useful outcomes and acceptance, not
raw token minimization. A longer well-directed research report or detailed
activity prompt can reduce total effort by preventing incorrect work. Record
the hypothesis, actual result and remaining uncertainty in execution or learning
records. Later Planner and Architect assessments should consume those findings
and propose durable guide improvements where the evidence warrants them.

Execution tests must exercise the boundary whose correctness is claimed. A
controlled provider can establish deterministic response repair or sequencing,
but cannot establish a real Codex run. A real confined command can establish
argv, filesystem or cancellation behavior, but is not automatically a live
multi-agent delivery. A native/provider observation identifies the actual
binding, versions, request, flags, result and diagnostics. Its fixture includes
the required committed layout, registry, ownership, guidance, dependencies and
mount destinations. Nested working directories, stale hashes, ownership refusal,
interrupted acknowledgments, changed parameters and uncertain effects need
representative public assertions. A skip or missing prerequisite is never
reported as proof that the intended boundary passed.

The Execution steward should change the least code that restores the accepted
behavior. Reuse the existing lifecycle, public services, journal and checked-edit
machinery. Remove superseded state projections, alternate recovery paths,
duplicated prompt assembly and trivial wrappers when they obscure responsibility.
Keep dependency-bearing lifecycle state in cohesive TypeScript classes and pure
transformations in small helpers. Preserve readable explanations of meaningful
effects and failure behavior. A simplification is successful when a person can
trace the same approved outcome through fewer mechanisms while ownership,
cancellation, evidence honesty and independent verification remain intact.

Success for this component is therefore observable beyond its unit tests. An
actual Agent can use exactly its declared operations, recover locally from a
normal refusal, retain its complete answer and acknowledged edits across
interruption, consume an approved architecture update at a safe boundary and
finish useful work through the normal independent staging path. A human can
follow the timeline while it happens and audit the result afterward. The
evidence names the real candidate and runtime, separates controlled regressions
from native checks and live qualification, and explains where time and tokens
went. Gaps remain explicit until demonstrated; a plausible diagram, extensive
test count or clean-looking journal is not a substitute for that working loop.

Consider a steward implementing an operation that must read a generated file
from a nested working directory. The first check fails because the fixture mounts
the project at one destination while the operation selects another. Execution
returns that exact command, directory, status and log to the same caller. If the
fixture assumption is wrong, the steward requests the local Testing rewind,
corrects its owned fixture and runs the affected checks. Direction is unnecessary:
the accepted outcome, accountable owner and original criteria still apply. A
passing unrelated unit suite cannot discharge the missing native observation.
The final record should show both the original failed mount case and the fresh
applicable result, with no claim that the failure never happened.

Consider instead a steward that discovers an operation genuinely needs a file
owned by another component. Execution refuses its write before touching that
file, while preserving the earlier successfully checkpointed edit. The steward
can read the foreign public interface and request a distinct contribution with
its precise question. Direction sequences that owner's work in the existing
plan. When the requester resumes, it receives the complete supplier answer and
current evidence. It does not acquire the supplier's permissions, rewrite its
already acknowledged file, or treat conversational agreement as implementation.
These observable differences are the reason checked ownership, durable answers
and the sequential Team model must fit together.

Public interface changes should be evaluated by their effect on this trace. A
new provider may require a different event decoder or invocation adapter, but
should reuse the same Agent request, local operation mediation, checkpoint and
evidence lifecycle. A new gateway should consume the same event stream and typed
results. A change in operation selection should resolve through Architecture and
the shared command API, rather than being guessed from owner names inside
Execution. If a proposed abstraction needs duplicated state or makes those seams
harder to inspect, require the demonstrated responsibility that justifies it.
Keep rejected experiments as honest learning, and remove abandoned implementations
instead of carrying compatibility machinery that the supported system no longer
needs.
