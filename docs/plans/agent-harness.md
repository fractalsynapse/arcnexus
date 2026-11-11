# The agent harness

**Status: architecture, authoritative.** The single agent process every activation in ArcNexus runs
inside — `director`, `steward`, `verifier`, or a question answer, each running as the role that
holds the activity it is performing. Nothing in the platform gets a bespoke agent runtime, and no
role gets a file. Read [the charter](../charter.md) for purpose,
[`.arc/README.md`](../../.arc/README.md) for knowledge spaces, and the contracts in
[`docs/interface/`](../interface/) for component obligations.

This document is the foundational building block. The multi-agent system is this harness plus a
message flow between instances of it, and nothing else.

## The one rule

**One harness, many roles.** A role is a layered context plus a tool surface, not a separate
engine. Any fix to planning, evidence, escalation, journaling or recovery therefore lands once and
applies to every agent, the director included. A change that helps stewards but not the director is
evidence the harness has been forked, and the fork is the defect.

There are two different axes, and collapsing one into the other is the mistake this section exists
to prevent:

- **Mode** is what an agent is doing in the lane right now: `director` turns a goal into an
  executable sequence, `steward` delivers one assignment, `verifier` renders one independent
  assessment, and a question takes the shortened chain. A mode selects an **activity sequence**.
- **Role** is a position, and there is one per activity: `researcher`, `technical-writer`,
  `designer`, `systems-engineer`, `tester`, `release-engineer`. A role carries what is individual
  to it and **reusable by every component** — responsibilities, standing instructions, standards
  and execution profile. Think of it as the résumé the agent brings to the post. A role declares
  **no operations**: commands, permissions and test tags differ per owner, so they belong to the
  component and stay coupled to its ownership and activity responsibilities. Nothing restricts
  which component engages which role; the **pair** is what yields a single capability in context.

They differ only in the layers they receive and the operations they may perform. The point of the
role section of the architecture is reuse: the same researcher context serves research work in any
component, so the catalog does not re-describe a position once per owner.

## Ownership belongs to the component, never to the role

A component declares the files it owns and the responsibilities, instructions and acceptance detail
specific to them. It is where ownership lives and where a role's standing detail is combined with
the component's particular subject matter. A role grants no write scope and holds no path: role
`tester` cannot review a file nobody owns, and `release-engineer` integrates nothing that has no
component accountable for it. Authority to write therefore has exactly one source, and it is not a
matter of which position an activation happens to be running.

## The component activity is the unit of configuration

An activity is not just a label on a checklist item. Inside a component, each supported activity
declares three things together:

| Field | What it says | Why it lives there |
| --- | --- | --- |
| `role` | which position performs this activity here | roles are reusable, but **which** one holds an activity is a component decision |
| `instructions` | what this component's work in that activity requires | the same `tester` résumé applies everywhere; "run the owned test profile with tag X" does not |
| `operations` | what that activity may execute here | commands, scripts and test tags differ per owner, so they belong to the activity that invokes them |

**Operations are authored once, on the component side.** An operation definition keeps its command,
category, cwd, probes and artifacts — the mechanical facts of running it — and stops carrying a list of
activities that claim to own it. Today both exist: operation files declare `activities:` while components
map `operations: {id: [usage…]}`, so the same relation is written in two places and can disagree. That
duplication is the defect this section exists to remove, and the component side is the authority because
ownership is where the coupling to files and responsibilities lives.

The **usage** axis (`agent`, `verify`, `setup`, `preflight`, `refresh`, `delivery`) stays with the
component: it says *when* an operation runs in the lifecycle, which is a different question from which
activity is allowed to invoke it.

Nothing restricts which role a component selects for an activity. The value is the pairing: the
component's scope, operations and instructions combined with the role's responsibilities, standing
instructions, standards and execution profile produce **one capability** in the agent context, which is
what an activation actually runs on.

## Activities are the plan's spine

The catalog already validates each operation's `activities` against the acting role, so an activity
is an **authorization and standards axis**. The harness adds the second half: activities are also the
**shape of the plan**, so the same machinery that gates tools and selects standards also orders work.

Each activation follows one process, and its sequence is its **mode's**, drawn from the six canonical
activity names in their one order — research, documentation, testing, implementation, review,
release. The design-and-contract-test step of a milestone is the `testing` activity; the integration
step is `release`. These are positions in one order, not parallel vocabularies.

| Mode | Activity sequence | Who holds each step |
| --- | --- | --- |
| director | research → documentation → implementation → review → release | `release` and `implementation` here produce **the plan and the assignments**, not a source change |
| steward | research → documentation → testing → implementation → review → release | `testing` states acceptance as an observed failure before `implementation` turns it green |
| verifier | research → documentation → review → release | `review` is the independent verdict; `release` is **the decision and report** |
| question answer | research → documentation → review → release | the answer is the deliverable |

A plan declares **every activity in its mode's sequence**, in canonical order, and each activity it
declares must be one the component engages a role to hold. An activity in the sequence that carries
no checklist item is still declared and still performed — documentation and review happen because
they are listed — and the plan records what such a bucket examined and why nothing needed checking.
A mode that does not include an activity never declares it: a verifier's plan has no `implementation`
bucket, because that is not the post it is standing in.

So the director's *deliverable* is a plan and a set of assignments, authored, checked and reviewed
through the same activity discipline a steward uses to change code. There is no privileged planning
step outside the process, and no mode that skips documentation.

**Bucket, then run.** Planning assigns each step to its activity first; execution then proceeds in a
deterministic activity order rather than in the order items occurred to the agent. Steps sharing an
activity stay together so they draw one activity profile and one standards set, and the deterministic
order is what makes the guardrails meaningful: an activity's checks are known before its items start,
and a later activity cannot begin while an earlier one still has open items.

```
bucket by activity  →  order activities canonically  →  complete a bucket before the next opens
```

**Completion of a bucket is not completion of the work.** The activity sequence structures effort;
acceptance is still the independent verdict against goal and criteria. An agent that finishes every
bucket without meeting the goal has failed, and an agent that meets the goal while its plan was
revised mid-flight has succeeded — the structure exists to keep guardrails correct, not to become the
standard.

**The loops nest inside this sequence, and two pairs genuinely cycle.** A peer request issued during
implementation suspends that bucket, runs the recipient's **whole chain from its start**, and returns
into the same bucket with the delivered artifact — it is not a shortcut into the middle of another
agent's plan. Review is likewise a full loop rather than a step inside the work it reviews: a
deficiency returns to the accountable owner as a new activation, not as a note appended to the run
that produced it. Both pairs can repeat, and the bound is the run's turn and effect budgets, not a
rule about which activity may run twice.


## The activation frame

An agent runs in a **frame**, which is the unit of work, evidence, recovery and testing:

```
frame = { identity, layers, tools, journal, workspace, plan, checklist, deliverables, outcome }
```

Frames nest and return to their parent like stack frames. An agent asking a peer for a contribution,
or escalating a blocked goal, is a **return value**, not an exception path. The loop at the top of
this document is the whole system; there is no other control flow.

## Layered context

Context is assembled in four layers, lowest authority-change rights first. Each layer states what
the agent may not alter, so the boundary between guidance and rails is explicit.

| Layer | Content | Agent may revise? |
| --- | --- | --- |
| **L1 goal** | the objective and its acceptance criteria as a text prompt, plus the goal identity digest | **never** |
| **L2 project** | top-level purpose, objectives, questions, standards, ownership map, current plan and prior outcomes | never |
| **L3 component** | the agent's own component profile: why it exists, what it owns, its standards, its verification operations | never |
| **L4 plan** | the agent's own implementation plan and checklist for the goal | **freely, at any time** |

L1–L3 are read-only by construction and enforced by checked edits, not by instruction. L4 is the
agent's to change as often as its strategy requires.

**Strategy is the agent's.** There is deliberately no immutability on the plan or checklist, no
append-only item history and no "rejected item" marker. Forcing an agent to preserve a failing plan
makes it complete the list instead of the goal, which is a worse failure than the one such a rail
would prevent. History is not lost — the journal records every revision as it happens — but
telling the agent it may not change course is not how we keep it honest. L1 protects the outcome and
L3 protects scope; nothing else needs to be locked.

The director may set and re-set the sequence, the sub-goals and the owners. **It never names files
for another agent to write.** Write scope comes only from L3.

## Inputs: what is fed to the harness

Recorded at activation start, complete, before any model turn:

- the assembled prompt (L1–L4 in order) as one file,
- the goal identity digest and the plan revision it was derived from,
- the tool surface the activation received, by name and schema,
- the confined command or service definition it will execute, with its digest,
- the base revision: the exact commit the deliverable will be measured against.

Anything the agent can see must be reconstructible from this set. If a decision cannot be explained
from the recorded inputs, either the inputs are incomplete or the agent drifted; both are defects
and the capture is what tells them apart.

## Live evidence: what comes out, as it happens

Every frame writes an **append-only event journal**, flushed per event, containing the full harness
stream: reasoning and message items, tool calls with their structured input, command executions,
errors the harness itself reports, and turn metrics including token usage. Nothing is redacted or
summarised away, because the summaries are exactly what hides the signal — a harness warning that a
progress projection discarded was visible only in the raw stream.

Alongside the journal, per event, the frame captures:

- **plan and checklist revisions** — as they are written, not as a final state,
- **tracking issues and every comment** — at the moment they are created,
- **pull requests and provider-side comments** — review states, CI conclusions, and the observed
  merge identity as the provider returns it.

Bytes are **referenced, never duplicated**. Where content already has a durable home — a patch, a
command log, a snapshot, a diff, a checklist file — the journal records `{id, digest, byteLength,
path}` and readers resolve it through the evidence capability. Copying bytes into a second place
reintroduces the parallel-state failure this platform keeps paying to remove, and two copies of a
fact always end up disagreeing.

This makes the run legible while it is happening, which is the only form of observability that helps
a stuck agent. Post-hoc reconstruction is cheap and useless at 3 a.m. on a hung activation.

## Deliverables

An agent's output is a **diff against an explicit base revision**, plus its declared evidence, not a
description of work. The base is fixed at frame entry; the deliverable names it, so "what changed" is
never a matter of interpretation, and a stale base is detectable rather than assumed.

Completion is **not** a property of the checklist. A frame may declare its work finished only when an
independent verdict confirms the L1 goal and its acceptance criteria against the actual candidate.
All boxes ticked with an unmet goal is a failed frame, and that is the intended reading.

## Escalation

When an agent cannot satisfy its goal within its authority, it emits a **structured escalation
notice** and stops. It is an ordinary return value with a fixed shape: the goal identity, the strategy
it abandoned, what blocked it, the evidence that shows the block, the options it considered and
rejected, and the specific change it needs — sequence, another owner, scope, or authority.

Three properties make this load-bearing rather than decorative:

1. **The notice is a capture.** It is written to the journal and frozen, so it can be replayed
   against the director to capture and score the director's response. Escalation is therefore not a
   threat to controlled testing; it is one more testable transition with stable input.
2. **The director's answer is also a capture**, pairing notice to outcome, which makes the whole
   loop measurable without running agents at all.
3. **Asking a peer is not escalation.** Requesting another component's contribution is a normal
   forward step, and the director did not have to anticipate it.

The boundary is authority, not difficulty. An agent that finds its task hard keeps working; one that
finds it impossible **within its ownership or its acceptance criteria** stops and returns.

## Roles and what only they may do

| Role | Adds | May | May not |
| --- | --- | --- | --- |
| director | L1 + L2 for the goal | set/revise sequence, sub-goals, owners; answer escalations; ask the human one blocking question | name files; edit any component; weaken a goal |
| steward | L3 + L4 for one assignment | revise its own plan and checklist; edit inside owned paths; request peers; escalate | touch goal, acceptance, tests, or others' paths |
| verifier | the candidate and the acceptance text | issue one independent verdict per candidate revision | edit anything; delegate |
| steward (self-directed) | L2 + L3 for one component | choose bounded next work its component owns; report no useful work honestly | assign other owners |

Every row is a **mode**: the same harness with a different L-layer mix, tool surface and activity
sequence, while the **role** supplying each step's standing detail stays shared across components.
That is the entire implementation cost of the role system.

## What is protected

Not by prompting:

- **goal and acceptance criteria** — L1 is immutable to the executor; a revision requires the human or,
  for a sub-goal, the director, and is recorded as a new identity;
- **scope** — checked edits against L3 ownership, including newly created files and test paths;
- **the tests that decide acceptance** — captured before the agent works; the host asserts before every
  declared check that a mandatory suite was not deleted and its component, level and tags were not
  altered, so an agent cannot quietly re-select what the host runs. Assertion text inside a captured
  suite is still editable, and that residual is deliberate: it is surfaced to the verifier as a
  specification-to-candidate comparison rather than blocked by a second execution mechanism. Restoring
  specification-time tests for a verification run exists in code (`withFrozenTests`) but currently has
  **no production caller** — see the open decision below;
- **the candidate's identity** — a verdict is bound to a digest over its inputs and bytes, so reuse is
  provably safe and staleness is provable;
- **authority and effects** — identity is established by the host and cannot be claimed by an agent,
  and an uncertain effect is reconciled by observing the provider before anything is attempted again.

Anything not on this list is the agent's to change, including its whole approach. This list is short on
purpose: rails outside it cost capability and buy nothing, because the acceptance signal is already
protected.

## Failure and recovery

A frame is resumable from its own captures: plan, checklist, journal position, workspace revision and
outstanding effects. Recovery never fabricates progress — it re-reads what was observed. Where an
outcome is genuinely unknown, it is **asked about, not replayed**, and the answer routes to a human
only when the observation shows something only a human can supply: production release, or a blocking
question about the goal.

A run that cannot continue stops honestly with a recorded reason. A run that invents a plausible
continuation is the failure mode this design exists to prevent, and it is why a stalled frame reads as
escalation rather than as slow progress.

## Testing consequences

Because a frame is a capture, each frame can be **replayed against the real harness**: frozen
inputs, real model, comparable output; and every deterministic part — admission, checked edits,
capture, journaling, verdict computation, escalation routing, assembly, merge protocol — can be
regression-tested with injected responses, with no model at all. The full loop is then assembled from
controlled pieces rather than debugged as one long run. The rules are in
[the agent test strategy](agent-test-strategy.md).

## Where the design would be tempted to grow

Reject these if they appear, because each has been argued for and each costs more than it returns:

- immutable or append-only checklists, and per-item sign-off by another agent;
- a separate runtime for the director, the reviewer, or "planning";
- per-stage re-verification, or any status column duplicating a fact a provider already returned;
- copying evidence bytes into a second store "for convenience";
- an approval step for anything an agent can observe and act on itself;
- retrying an uncertain effect because the state is uncomfortable.

Simplification here means fewer states and fewer ledgers, never fewer guarantees. The protected
list above is the floor.

## Open decision: how far test protection goes

The design says goal, acceptance, scope and captured tests are protected. Verified reality is narrower:
**test selection and existence are enforced; test assertions are not.** Three ways to close that, and
they differ in cost, not in desirability:

| Option | Mechanism | Cost |
| --- | --- | --- |
| **Verdict-only** (today) | the independent reviewer sees a specification-to-candidate comparison and refuses a weakened suite | zero machinery; relies on one model judgement, unverifiable at L0–L1 |
| **Restore and run** | revive `withFrozenTests` so host verification executes specification-time tests | one call site; reintroduces a mechanism with no caller today |
| **Freeze acceptance suites** | mark suites that express acceptance criteria, refuse edits to them at edit time, let regression scope stay editable | a flag on existing metadata; strongest, least model-dependent |

Recommendation: the third. It puts the rail exactly where acceptance lives, leaves the agent free to
change *how* it proves behaviour, and makes the protection testable deterministically rather than
dependent on a reviewer noticing. Until that is settled, `withFrozenTests` is dead code under our own
rule and must either be wired or removed — carrying it unused is the remnant pattern we keep falling
into.
