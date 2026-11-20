# Agent component purpose

## The actor that makes the architecture understandable

The Agent component gives ArcNexus one public representation of an actor doing
authorized work. A Director planning a goal, a component steward implementing a
change, a researcher investigating a question and an independent Reviewer assessing
a candidate all use that representation. Their purposes, instructions, observations
and capabilities differ, but a consumer can inspect and activate them through the
same interface. This is the central conceptual object of the platform: a scoped
participant with a reason to act, a selected activity, information it can perceive
and operations it can perform. Understanding an Agent should explain what that
participant can do and how its work connects to the team.

This component makes architectural direction operational for a single activation.
The project supplies accepted goals and constraints; component definitions supply
responsibilities and ownership; activities select a role, profile, instructions,
standards and operations. Agent exposes the resolved combination to callers. A
consumer should not need to reconstruct that combination from unrelated catalogs,
infer a steward's permissions from a plan paragraph or know which provider flag
happens to encode a model setting. Those concerns have an authored source and a
responsible plugin. Agent is the coherent public view that brings them together
for the person or process about to use them.

The useful outcome is a participant whose behavior is understandable before
activation and attributable afterward. A human can inspect an activity and see
its complete operating prompt. Workflow can activate that same activity against
the admitted task position. Execution can enforce its grants and record actual
effects. Verification can assess the resulting candidate without confusing a
steward's completion claim with an independent verdict. These interactions make
the architecture legible as a team of Agents rather than an opaque chain of
special-case prompts.

The Agent component also has its own steward. That steward maintains this public
interface, its implementation, documentation and tests. It uses the same Agent
model as every other component. Its engineering task can improve inspection,
activity selection or cancellation forwarding without granting it authority over
the entire runtime. Keeping the product entity and its component steward distinct
prevents a misleading assumption that the Agent owner may edit any code related
to artificial intelligence. Ownership still follows the captured Team and catalog.

## Public service and consumers

Inspection answers what a selected actor would receive and be allowed to do.
The caller supplies the captured project, component or special actor selection,
explicit activity and available task context. Agent delegates resolution and
request assembly to Architecture, then returns the resolved identity, placeholders,
request and invocation options. The request includes the full acting purpose and
selected activity instructions, relevant role guidance, standards, capability
descriptions and the compact discoverable team index. The existing public request
is a complete input string; readable source boundaries make its contents auditable.

Inspection remains read-only. It should be useful before a task is admitted,
when no issue, worktree, acceptance bundle or live goal exists. Named placeholders
show those unavailable values honestly. A guessed assignment or invented evidence
would make the preview misleading. Repeated inspection of the same source and
inputs should agree, and invalid selections should produce precise diagnostics
without creating state or making a model call. The CLI is a consumer of this
service, alongside any future gateway using the same Commands SDK.

Activation uses that same resolved view for one admitted task activity. It passes
the prepared request and cancellation signal to the execution boundary, surfaces
observations and returns the typed outcome expected by the application lifecycle.
The public behavior must remain consistent across the Director, stewards and final
Reviewer. Optional research is another explicitly selected activity using the
same authority discipline. A provider-specific adapter may encode the request
differently at transport level, but it must preserve the content and effective
options that inspection exposed.

Workflow is the principal activation consumer. It knows the accepted sequence,
current milestone and durable position. Direction consumes the Agent interface
to plan and revise legitimate remaining work; Verification uses it to obtain an
independent assessment. Commands exposes application capabilities to gateways.
Execution supplies the actual provider and operation enforcement. A new gateway
should gain Agent inspection or activation by using those services, rather than
copying the builder or implementing an alternative agent loop.

The result vocabulary matters. Ordinary stewardship can complete work, request
a valid earlier repair, ask a question or request a distinct supplier. A Director
returns its planning response, Planner its inventory assessment, Architect its
architecture decision and Reviewer its criterion-bound verdict. Agent provides
the shared activation seam without pretending that all those domain responses
are interchangeable. Keep response ownership with the responsible plugin and
preserve the original diagnostics when an invalid response returns to its caller.

## Identity, purpose and selected activity

An Agent's identity includes the selected component and activity under the
approved captured model. Special actor selectors resolve through explicit project
bindings. The Director is the activity selected by the project's director binding;
the independent Reviewer is selected by its verifier binding. Explicit component
IDs remain useful for inspection and ordinary stewardship. A role name alone is
insufficient to identify an actor because multiple components can use the same
researcher or systems-engineer role with different responsibilities and operations.

The component purpose supplies durable context about why the actor exists.
Objectives describe desired observable outcomes, constraints name failure boundaries,
and the activity procedure explains how to perform the current kind of work.
The task goal and milestone narrow that purpose to the present assignment.
Questions and findings identify information or correction still needed. These
parts should complement each other. A vague component purpose forces the model
to infer its responsibility repeatedly; a generic activity sentence leaves it
without a useful method. Complete instructions should make the intended decisions
explicit while preserving the user's approved direction.

Activities are declared explicitly in each component specification. Their role,
execution profile, instructions, standards and operations resolve against that
model. Missing activities are unavailable. An explicit empty operation list grants
no project tools. An actor cannot carry an Implementation capability into its
read-only review or silently change its own profile because a previous activation
was expensive. Host-only release is a host activity and cannot become a model
activation merely to complete an inventory row.

The selected activity also defines how to interpret an observation. Testing may
establish an intended failing assertion, while Implementation requires current
passing applicable checks. Self-review assesses its owner's contribution and can
request a local rewind. The final Reviewer evaluates the assembled candidate and
can reject criteria back to Direction. Treating these roles as equivalent would
erase useful independence or make every local defect require replanning. Agent
must expose enough resolved context for those distinctions to remain visible.

An activation is a scoped episode of work, not the entire durable project memory.
The host gives it the current position, accepted criteria, retained answers and
relevant evidence. The actor can use mapped operations to read complete source
and history. When an inbox request or interruption ends the episode, the next
activation can resume with that retained state. Agent does not need a competing
memory database, private planner or peer scheduler to achieve continuity.

## Sensory capabilities and permitted action

The Agent view makes sensory access explicit. An actor can perceive captured
project sources, its current assignment, approved guidance and authorized evidence
through the operations mapped to its activity. It can receive a complete human
answer, supplier contribution or research report when the host resumes its caller.
It can inspect actual check observations and successful edit receipts. These
observations help it decide what to do; they do not grant a broader permission or
replace the accepted goal with whatever the latest log happens to suggest.

Capabilities are resolved from the actor, component ownership and selected
operation bindings. A steward with checked editing can propose an owned file
change through that operation. A Director or independent Reviewer remains
read-only. An available research inbox allows a focused question, not arbitrary
new executable tools. Provider-level built-in web policy is resolved separately
from local project-operation grants. The interface should show these differences
without requiring a human to infer them from provider terminology.

The host enforces every effect. A persuasive model statement, operation-looking
string or peer request cannot widen scope. Execution validates the current owner,
Step, operation schema, expected source digest and protected-file conditions.
Agent should pass the captured view faithfully rather than reconstructing a
different permission list beside it. A second interpretation would let inspection
say one thing while activation did another, defeating the purpose of a shared
actor interface.

Failure feedback is part of the actor's sensory model. A refused write should
return the exact path and ownership diagnostic to the activity that attempted it.
A failed check supplies its real status and readable log. A successful earlier
edit remains acknowledged. The actor can therefore correct the failing request
without repeating all previous work. Agent must preserve the complete assignment
and answers across that continuation and avoid replacing an originating finding
with a later paraphrase that loses the actual requirement.

The same principle applies to information gathering. A supplier's answer is useful
only if the requesting actor receives its complete substance. An issue reference
or an acknowledgment is not enough to answer an architectural question. Research
should return a source-linked report with applicability and unresolved questions,
and it should remain optional. Detailed direction and long reports can improve
the actor's decisions. Agent should carry or reference the complete authorized
material without introducing a content budget, artificial paging or truncation.

## Relationships with the rest of the platform

Architecture owns the sole resolver and request builder. It validates references,
explicit mappings, source provenance, profiles, operation parameters and standards.
Agent consumes that model. It does not fork the builder to customize a Director
prompt or rewrite a Reviewer request. A defect in assembly should be corrected at
its authored source and covered through the common path. Consumers can then rely
on inspect and activation matching for identical captured inputs.

Team owns roster ordering, eligibility and ownership resolution. Agent represents
an individual member and its selected work; Team represents the collection and
resource responsibilities. Direction uses that collection to choose accountable
milestones and route required contributions. These responsibilities cooperate
without creating a global mutable Agent registry that competes with the captured
catalog. New components require architectural acceptance through the existing
proposal route, rather than being invented by an actor that wants a convenient peer.

Workflow owns sequence and recovery position. It chooses the next activity and
persists local rewinds. Direction participates initially, on explicit escalation
and after final independent rejection. Agent receives the selected position and
does not advance the plan on its own. This boundary lets a local tool failure
stay with the same caller while a genuine cross-owner dependency reaches the
Director. Moving sequencing into Agent would duplicate host state and make
resumption harder to explain.

Coordination supplies the journal, project writer and durable observations.
Execution manages admitted sessions, worktrees, checked operations and the native
provider. Their identities let a later activation reuse an answer or checkpoint
after cleanup or a hard crash. Agent should not manufacture a fresh task because
the provider process is new or a worktree path changed. It uses the task context
provided by those services and returns observations under that identity.

Verification binds assembled checks and the independent verdict to the actual
candidate. Reviewer supplies the assessment and useful lessons. Delivery performs
the observed staging effect and reconciles uncertain publication. Agent neither
accepts a candidate independently nor publishes it. Its completion is an activity
result that later boundaries may still reject. This makes it possible to explain
the difference between an implementation that looks finished, an accepted tree
and code actually integrated into staging.

## State, restart and approved evolution

Keep Agent's own lifecycle small. Resolve the captured actor view, expose it,
activate through the responsible execution service and propagate the result or
failure. Durable progress belongs to the existing task journal. Provider sessions
are an implementation detail of an activation and should not become another
authoritative unit of work. The component can hold the dependencies needed to
perform its public service without accumulating unrelated scheduling, persistence
or publication responsibilities.

Cancellation must follow the same signal through activation. Execution stops
managed processes and retains its actual evidence and acknowledged effects.
Agent propagates the cancelled result consistently; it cannot claim completion
because a provider emitted an optimistic message before cancellation. A later
attempt uses the retained state and selected activity. Tests should exercise the
observable public cancellation and identity relationships, rather than merely
calling a helper and assuming the production process behaves the same way.

Approved architecture can evolve between activations. The host validates the exact
human-approved change and required implementation, records adoption and revalidates
pending work and affected evidence. The next Agent uses the new model; a running
activation retains its original version. Historical profile and instruction
identities remain attached to the actual observations they produced. Freezing
the entire task indefinitely would prevent guided self-recovery, while reading
unapproved candidate instructions would let the candidate authorize itself.

Complete purpose and activity text may grow as the project learns. Keep it
authored once, explicitly selected and source-attributed. The acting component's
purpose belongs in full; the foreign-component index should remain discoverable
without duplicating every other complete purpose and activity map. A detailed
selected prompt and a compact roster solve different problems. Do not reduce
useful instructions simply to obtain a small byte count, and do not dump unrelated
definitions into the request as a substitute for selecting relevant context.

Future evolution should preserve the same seams. A new provider can replace the
execution adapter while consuming the same prepared actor request. A new gateway
can use Commands and Agent without taking over lifecycle state. A new sensory
operation can be declared and approved through Architecture, then enforced by
Execution. Add capabilities for demonstrated needs and retain the distinction
between declaring an operation and having a validated handler available to execute
it. A declaration alone is not a working feature.

## Characteristic failures and how to recognize them

The most damaging failure is inspect/activation drift. A preview may show complete
instructions while a private provider prompt omits them, or tool descriptions may
advertise operations that enforcement refuses for unrelated reasons. Verify the
actual subprocess input and effective options against the shared prepared request
for Director, steward and Reviewer. Comparing two builder calls cannot establish
what the harness received. Preserve tests that observe the real adapter boundary
with controlled executables and distinguish them from live inference.

A second failure is context loss across continuation. An actor may receive the
latest check error without the original self-review requirement, a report summary
without its full answer or an edit receipt that disappears when the activity
rewinds. These failures cause repeated questions, duplicate edits and unnecessary
Director calls. Assert complete returning context through public activity and inbox
paths, including nested distinct repairs. Keep actual current observations
discoverable without copying every historical artifact path into every activation.

A third failure is identity confusion. A role can be mistaken for a component,
the special Reviewer selector can obscure that component's own research activity,
or a missing activity can inherit capabilities accidentally. Exercise explicit
component selections alongside special bindings, unavailable activities, empty
operation lists and host-only release refusal. Validation should name the exact
selection and unresolved reference. Silent fallback to a convenient activity or
profile would make the apparent Agent different from the approved one.

A fourth failure is responsibility creep. Agent can become a wrapper that owns
its own task store, supplier queue, retries, prompt builder and publication helper.
That duplicates the platform and makes failures expensive to trace. Review a
proposed change by following its actual call path and identifying the existing
owner of each responsibility. Reuse public services and remove superseded paths.
Concise cohesive code is a means to reliable understandable behavior, not a reason
to omit a required boundary or replace real verification with a claim.

## Observable measures and learning

Consider a human comparing `inspect director planning` with a real planning
activation. The preview has an unavailable goal and worktree, while the admitted
activation has exact values. Once matching values are supplied to the shared
builder, the payload and effective options must agree. The comparison should
include the complete selected instructions, operation descriptions and source
labels, rather than a fragment that could pass while most context was missing.
The test also checks that inspection made no upstream request, admitted no task
and created no worktree. This scenario connects the human-facing explanation to
the actual provider boundary without confusing a preview with execution.

Consider a steward that pauses Implementation for research. The report belongs
to that component and is returned through its original caller. When the activity
resumes, its complete answer, original acceptance and current check expectations
remain available. A read-only research activation cannot inherit the caller's
edit capability, and the resumed Implementation cannot inherit an arbitrary
operation from the report. The Agent view must represent both selections
correctly. Tests should inspect the actual mapped tools and returning context,
not merely assert that a method named research was called.

Consider the final Reviewer returning an unsupported evidence reference. The
host retains the real candidate and checks and returns the citation diagnostic
to that same assessment. A corrected reference does not require a new candidate,
Director plan or steward execution. If the Reviewer instead finds a real unmet
criterion, its valid rejection reaches Direction through Verification. Agent's
shared interface must preserve this distinction between repairing an invalid
actor response and accepting a substantive domain outcome. Neither case gives
the Reviewer write or delivery authority.

These scenarios also explain how to judge changes to this plugin. A refactor
that removes a duplicate request transformation while preserving those observable
relationships reduces complexity. A new wrapper that merely delegates each Agent
operation under another name increases the trace without adding responsibility.
A fresh provider adapter is justified when a real consumer needs a different
implementation, provided the public actor contract and host authority survive.
Use focused public assertions and actual production wiring to distinguish those
changes, then refresh broader evidence when integration risk warrants it.

Success is visible when a human can inspect a selected Agent, understand its
purpose and procedure, and observe activation receiving that same context with
only honest live-input differences. The actor can use exactly its mapped operations,
receive complete results, repair ordinary owned failures locally and preserve
acknowledged work through continuation. Its final response fits its domain role,
and the host can connect that response to actual evidence and later acceptance.

Measure the cost of achieving those outcomes. Retain request bytes separately
from provider-reported tokens, attribute activations to the selected execution
profile and keep unknown usage or pricing explicit. A detailed procedure can
increase initial context while reducing expensive mistaken handoffs. Evaluate
that trade using useful completed work, local repair routes, Direction calls and
elapsed effort. Agent should expose the same observations to transport-neutral
consumers without turning measurement into a budget or automatically changing
the user's chosen profile.

Use incidents to improve the authored procedure and the cheapest relevant test.
If the acting context omits a complete answer, fix its canonical propagation and
add a public continuation regression. If a new activity is unavailable despite
valid-looking YAML, validate its full mapping and operation/category compatibility.
If a provider receives different instructions from inspect, correct the shared
adapter path rather than adding another comparison layer. Record the actual
finding and remaining uncertainty in execution or learning records, then let
the architect approve durable guide changes through the normal route.

The enduring measure is a comprehensible team of scoped actors that can develop
software under human direction. Agent succeeds when the surrounding plugins can
manage those actors through a stable small public interface, every effect remains
accountable and a newcomer can trace a goal through its participants. The platform
can grow richer sensory capabilities and activities over time while retaining
that simple conceptual center.
